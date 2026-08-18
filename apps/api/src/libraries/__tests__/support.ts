import { FixedClock } from '../../shared/clock';
import { UserId, type IdGenerator } from '../../shared/identifiers';
import { AddTextItem, MoveItem, RemoveItem } from '../application/item-use-cases';
import { ConfirmMediaUpload, RequestMediaUpload } from '../application/media-use-cases';
import { CopyFromVault, OpenVault } from '../application/vault-use-cases';
import {
  CreateLibrary,
  DeleteLibrary,
  GetLibrary,
  ListLibraries,
  RenameLibrary,
} from '../application/library-use-cases';
import {
  InMemoryLibraryItemRepository,
  InMemoryLibraryRepository,
  InMemoryMediaStorage,
} from './fakes';

class SequentialIds implements IdGenerator {
  private counter = 0;

  generate(): string {
    this.counter += 1;

    return `00000000-0000-4000-8000-${String(this.counter).padStart(12, '0')}`;
  }
}

export const ana = UserId.from('00000000-0000-4000-8000-00000000aaaa');
export const beto = UserId.from('00000000-0000-4000-8000-00000000bbbb');

export function buildLibraries(startingAt = new Date('2026-08-17T09:00:00.000Z')) {
  const items = new InMemoryLibraryItemRepository();
  const libraries = new InMemoryLibraryRepository(items);
  const storage = new InMemoryMediaStorage();
  const ids = new SequentialIds();
  const clock = new FixedClock(startingAt);

  return {
    libraries,
    items,
    storage,
    clock,
    create: new CreateLibrary(libraries, ids, clock),
    list: new ListLibraries(libraries),
    get: new GetLibrary(libraries, items, storage),
    rename: new RenameLibrary(libraries, clock),
    remove: new DeleteLibrary(libraries, storage),
    addText: new AddTextItem(libraries, items, ids, clock),
    removeItem: new RemoveItem(libraries, items, storage, clock),
    move: new MoveItem(libraries, items, clock),
    requestUpload: new RequestMediaUpload(libraries, items, storage, ids, clock),
    confirmUpload: new ConfirmMediaUpload(libraries, items, storage, clock),
    openVault: new OpenVault(libraries, items, storage, ids, clock),
    copyFromVault: new CopyFromVault(libraries, items, storage, ids, clock),
  };
}
