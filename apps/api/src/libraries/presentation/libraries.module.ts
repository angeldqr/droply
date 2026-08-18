import { Module } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CLOCK, type Clock } from '../../shared/clock';
import { ID_GENERATOR, type IdGenerator } from '../../shared/identifiers';
import { AddTextItem, MoveItem, RemoveItem } from '../application/item-use-cases';
import {
  CreateLibrary,
  DeleteLibrary,
  GetLibrary,
  ListLibraries,
  RenameLibrary,
} from '../application/library-use-cases';
import {
  LIBRARY_ITEM_REPOSITORY,
  LIBRARY_REPOSITORY,
  type LibraryItemRepository,
  type LibraryRepository,
} from '../domain/ports';
import { PrismaLibraryItemRepository } from '../infrastructure/prisma-library-item.repository';
import { PrismaLibraryRepository } from '../infrastructure/prisma-library.repository';
import { LibrariesController } from './libraries.controller';

@Module({
  controllers: [LibrariesController],
  providers: [
    {
      provide: LIBRARY_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaLibraryRepository(prisma),
    },
    {
      provide: LIBRARY_ITEM_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaLibraryItemRepository(prisma),
    },

    {
      provide: CreateLibrary,
      inject: [LIBRARY_REPOSITORY, ID_GENERATOR, CLOCK],
      useFactory: (libraries: LibraryRepository, ids: IdGenerator, clock: Clock) =>
        new CreateLibrary(libraries, ids, clock),
    },
    {
      provide: ListLibraries,
      inject: [LIBRARY_REPOSITORY],
      useFactory: (libraries: LibraryRepository) => new ListLibraries(libraries),
    },
    {
      provide: GetLibrary,
      inject: [LIBRARY_REPOSITORY, LIBRARY_ITEM_REPOSITORY],
      useFactory: (libraries: LibraryRepository, items: LibraryItemRepository) =>
        new GetLibrary(libraries, items),
    },
    {
      provide: RenameLibrary,
      inject: [LIBRARY_REPOSITORY, CLOCK],
      useFactory: (libraries: LibraryRepository, clock: Clock) =>
        new RenameLibrary(libraries, clock),
    },
    {
      provide: DeleteLibrary,
      inject: [LIBRARY_REPOSITORY],
      useFactory: (libraries: LibraryRepository) => new DeleteLibrary(libraries),
    },

    {
      provide: AddTextItem,
      inject: [LIBRARY_REPOSITORY, LIBRARY_ITEM_REPOSITORY, ID_GENERATOR, CLOCK],
      useFactory: (
        libraries: LibraryRepository,
        items: LibraryItemRepository,
        ids: IdGenerator,
        clock: Clock,
      ) => new AddTextItem(libraries, items, ids, clock),
    },
    {
      provide: RemoveItem,
      inject: [LIBRARY_REPOSITORY, LIBRARY_ITEM_REPOSITORY, CLOCK],
      useFactory: (libraries: LibraryRepository, items: LibraryItemRepository, clock: Clock) =>
        new RemoveItem(libraries, items, clock),
    },
    {
      provide: MoveItem,
      inject: [LIBRARY_REPOSITORY, LIBRARY_ITEM_REPOSITORY, CLOCK],
      useFactory: (libraries: LibraryRepository, items: LibraryItemRepository, clock: Clock) =>
        new MoveItem(libraries, items, clock),
    },
  ],
})
export class LibrariesModule {}
