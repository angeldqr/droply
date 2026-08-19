import { Global, Module } from '@nestjs/common';
import { ENV, type ApiEnv } from '../../platform/config/env.module';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CLOCK, type Clock } from '../../shared/clock';
import { ID_GENERATOR, type IdGenerator } from '../../shared/identifiers';
import { OWNER_STORAGE, type OwnerStorage } from '../../shared/owner-storage';
import {
  AddTextItem,
  MoveItem,
  RemoveItem,
  SetItemTimesPerDay,
} from '../application/item-use-cases';
import {
  ListLibraryRecipients,
  SetLibraryRecipients,
} from '../application/library-recipient-use-cases';
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
  LIBRARY_ITEM_REPOSITORY,
  LIBRARY_RECIPIENT_REPOSITORY,
  LIBRARY_REPOSITORY,
  LINKED_RECIPIENTS,
  SCHEDULE_PRUNER,
  MEDIA_STORAGE,
  type LibraryItemRepository,
  type LibraryRecipientRepository,
  type LibraryRepository,
  type LinkedRecipients,
  type SchedulePruner,
  type MediaStorage,
} from '../domain/ports';
import { PrismaLibraryItemRepository } from '../infrastructure/prisma-library-item.repository';
import {
  PrismaLibraryRecipientRepository,
  PrismaLinkedRecipients,
  PrismaSchedulePruner,
} from '../infrastructure/prisma-library-recipient.repository';
import { PrismaLibraryRepository } from '../infrastructure/prisma-library.repository';
import { S3MediaStorage } from '../infrastructure/s3-media-storage';
import { LibrariesController } from './libraries.controller';

/*
 * Es `@Global` por una sola razón: `identity` necesita poder vaciar el
 * almacenamiento de una cuenta al borrarla, y un contexto no puede importar el
 * módulo de otro sin atarse a él. Declarándolo global, el token de `shared`
 * viaja por el contenedor y quien lo usa solo conoce la interfaz. Es el mismo
 * arreglo que usa `delivery` con el sumidero de ocurrencias.
 */
@Global()
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
      provide: LIBRARY_RECIPIENT_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaLibraryRecipientRepository(prisma),
    },
    {
      provide: LINKED_RECIPIENTS,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaLinkedRecipients(prisma),
    },
    {
      provide: SCHEDULE_PRUNER,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaSchedulePruner(prisma),
    },
    {
      provide: OWNER_STORAGE,
      inject: [MEDIA_STORAGE],
      useFactory: (storage: MediaStorage): OwnerStorage => ({
        // La clave del objeto empieza por el dueño, así que un solo prefijo
        // cubre todas sus bibliotecas.
        removeAllOf: (ownerId) => storage.removeUnder(`${ownerId}/`),
      }),
    },
    {
      provide: MEDIA_STORAGE,
      inject: [ENV],
      useFactory: (env: ApiEnv) => new S3MediaStorage(env),
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
      inject: [LIBRARY_REPOSITORY, LIBRARY_ITEM_REPOSITORY, MEDIA_STORAGE],
      useFactory: (
        libraries: LibraryRepository,
        items: LibraryItemRepository,
        storage: MediaStorage,
      ) => new GetLibrary(libraries, items, storage),
    },
    {
      provide: RenameLibrary,
      inject: [LIBRARY_REPOSITORY, CLOCK],
      useFactory: (libraries: LibraryRepository, clock: Clock) =>
        new RenameLibrary(libraries, clock),
    },
    {
      provide: DeleteLibrary,
      inject: [LIBRARY_REPOSITORY, MEDIA_STORAGE],
      useFactory: (libraries: LibraryRepository, storage: MediaStorage) =>
        new DeleteLibrary(libraries, storage),
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
      inject: [LIBRARY_REPOSITORY, LIBRARY_ITEM_REPOSITORY, MEDIA_STORAGE, CLOCK],
      useFactory: (
        libraries: LibraryRepository,
        items: LibraryItemRepository,
        storage: MediaStorage,
        clock: Clock,
      ) => new RemoveItem(libraries, items, storage, clock),
    },
    {
      provide: SetItemTimesPerDay,
      inject: [LIBRARY_REPOSITORY, LIBRARY_ITEM_REPOSITORY, CLOCK],
      useFactory: (libraries: LibraryRepository, items: LibraryItemRepository, clock: Clock) =>
        new SetItemTimesPerDay(libraries, items, clock),
    },
    {
      provide: MoveItem,
      inject: [LIBRARY_REPOSITORY, LIBRARY_ITEM_REPOSITORY, CLOCK],
      useFactory: (libraries: LibraryRepository, items: LibraryItemRepository, clock: Clock) =>
        new MoveItem(libraries, items, clock),
    },

    {
      provide: RequestMediaUpload,
      inject: [LIBRARY_REPOSITORY, LIBRARY_ITEM_REPOSITORY, MEDIA_STORAGE, ID_GENERATOR, CLOCK],
      useFactory: (
        libraries: LibraryRepository,
        items: LibraryItemRepository,
        storage: MediaStorage,
        ids: IdGenerator,
        clock: Clock,
      ) => new RequestMediaUpload(libraries, items, storage, ids, clock),
    },
    {
      provide: ConfirmMediaUpload,
      inject: [LIBRARY_REPOSITORY, LIBRARY_ITEM_REPOSITORY, MEDIA_STORAGE, CLOCK],
      useFactory: (
        libraries: LibraryRepository,
        items: LibraryItemRepository,
        storage: MediaStorage,
        clock: Clock,
      ) => new ConfirmMediaUpload(libraries, items, storage, clock),
    },

    {
      provide: OpenVault,
      inject: [LIBRARY_REPOSITORY, LIBRARY_ITEM_REPOSITORY, MEDIA_STORAGE, ID_GENERATOR, CLOCK],
      useFactory: (
        libraries: LibraryRepository,
        items: LibraryItemRepository,
        storage: MediaStorage,
        ids: IdGenerator,
        clock: Clock,
      ) => new OpenVault(libraries, items, storage, ids, clock),
    },
    {
      provide: ListLibraryRecipients,
      inject: [LIBRARY_REPOSITORY, LIBRARY_RECIPIENT_REPOSITORY],
      useFactory: (libraries: LibraryRepository, members: LibraryRecipientRepository) =>
        new ListLibraryRecipients(libraries, members),
    },
    {
      provide: SetLibraryRecipients,
      inject: [
        LIBRARY_REPOSITORY,
        LIBRARY_RECIPIENT_REPOSITORY,
        LINKED_RECIPIENTS,
        SCHEDULE_PRUNER,
      ],
      useFactory: (
        libraries: LibraryRepository,
        members: LibraryRecipientRepository,
        linked: LinkedRecipients,
        schedules: SchedulePruner,
      ) => new SetLibraryRecipients(libraries, members, linked, schedules),
    },
    {
      provide: CopyFromVault,
      inject: [LIBRARY_REPOSITORY, LIBRARY_ITEM_REPOSITORY, MEDIA_STORAGE, ID_GENERATOR, CLOCK],
      useFactory: (
        libraries: LibraryRepository,
        items: LibraryItemRepository,
        storage: MediaStorage,
        ids: IdGenerator,
        clock: Clock,
      ) => new CopyFromVault(libraries, items, storage, ids, clock),
    },
  ],
  // Solo esto sale del contexto: el resto de sus proveedores son asunto suyo.
  exports: [OWNER_STORAGE],
})
export class LibrariesModule {}
