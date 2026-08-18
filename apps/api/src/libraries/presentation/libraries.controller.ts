import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  addTextItemSchema,
  copyFromVaultSchema,
  createLibrarySchema,
  moveItemSchema,
  renameLibrarySchema,
  requestUploadSchema,
  type AddTextItemInput,
  type CopyFromVaultInput,
  type CreateLibraryInput,
  type LibraryDetail,
  type LibraryItemView,
  type LibrarySummary,
  type MoveItemInput,
  type RenameLibraryInput,
  type RequestUploadInput,
  type StartUploadResult,
} from '@droply/contracts';
import { CurrentUserId } from '../../platform/http/current-user.decorator';
import { ZodBody } from '../../platform/http/zod-body.decorator';
import { InvalidInputError } from '../../shared/domain-error';
import { LibraryId, LibraryItemId, type UserId } from '../../shared/identifiers';
import { orThrow } from '../../shared/result';
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
import { emptyCounts, type ItemKind } from '../domain/item-kind';
import type { Library } from '../domain/library';
import type { LibraryItem } from '../domain/library-item';

@Controller('libraries')
export class LibrariesController {
  constructor(
    @Inject(CreateLibrary) private readonly createLibrary: CreateLibrary,
    @Inject(ListLibraries) private readonly listLibraries: ListLibraries,
    @Inject(GetLibrary) private readonly getLibrary: GetLibrary,
    @Inject(RenameLibrary) private readonly renameLibrary: RenameLibrary,
    @Inject(DeleteLibrary) private readonly deleteLibrary: DeleteLibrary,
    @Inject(AddTextItem) private readonly addTextItem: AddTextItem,
    @Inject(RemoveItem) private readonly removeItem: RemoveItem,
    @Inject(MoveItem) private readonly moveItem: MoveItem,
    @Inject(RequestMediaUpload) private readonly requestMediaUpload: RequestMediaUpload,
    @Inject(ConfirmMediaUpload) private readonly confirmMediaUpload: ConfirmMediaUpload,
    @Inject(OpenVault) private readonly openVault: OpenVault,
    @Inject(CopyFromVault) private readonly copyFromVault: CopyFromVault,
  ) {}

  @Get()
  async list(@CurrentUserId() userId: UserId): Promise<LibrarySummary[]> {
    const rows = await this.listLibraries.execute(userId);

    return rows.map((row) => toSummary(row.library, row.counts));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUserId() userId: UserId,
    @ZodBody(createLibrarySchema) body: CreateLibraryInput,
  ): Promise<LibrarySummary> {
    const library = orThrow(await this.createLibrary.execute(userId, body));

    return toSummary(library, emptyCounts());
  }

  /**
   * El baúl de la cuenta, que se crea solo la primera vez que se pide.
   *
   * Va **antes** de `:libraryId`: Nest prueba las rutas en el orden en que están
   * escritas, y al revés esta la comería el comodín y `vault` pasaría por un
   * identificador mal escrito.
   */
  @Get('vault')
  async vault(@CurrentUserId() userId: UserId): Promise<LibraryDetail> {
    const found = await this.openVault.execute(userId);

    return {
      ...toSummary(found.library, countByKind(found.items)),
      items: found.items.map((item) => toItemView(item, found.mediaLinks.get(item.id) ?? null)),
    };
  }

  @Get(':libraryId')
  async detail(
    @CurrentUserId() userId: UserId,
    @Param('libraryId') libraryId: string,
  ): Promise<LibraryDetail> {
    const found = orThrow(await this.getLibrary.execute(userId, toLibraryId(libraryId)));

    return {
      ...toSummary(found.library, countByKind(found.items)),
      items: found.items.map((item) => toItemView(item, found.mediaLinks.get(item.id) ?? null)),
    };
  }

  @Patch(':libraryId')
  async rename(
    @CurrentUserId() userId: UserId,
    @Param('libraryId') libraryId: string,
    @ZodBody(renameLibrarySchema) body: RenameLibraryInput,
  ): Promise<LibrarySummary> {
    const id = toLibraryId(libraryId);
    orThrow(await this.renameLibrary.execute(userId, id, body));

    // Se relee para responder con los contadores de verdad. Devolver ceros
    // sería más barato y mentiría: renombrar no vacía la biblioteca, y quien
    // guarde esta respuesta en caché vería todas las columnas en cero.
    const found = orThrow(await this.getLibrary.execute(userId, id));

    return toSummary(found.library, countByKind(found.items));
  }

  @Delete(':libraryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUserId() userId: UserId,
    @Param('libraryId') libraryId: string,
  ): Promise<void> {
    orThrow(await this.deleteLibrary.execute(userId, toLibraryId(libraryId)));
  }

  @Post(':libraryId/items/text')
  @HttpCode(HttpStatus.CREATED)
  async addText(
    @CurrentUserId() userId: UserId,
    @Param('libraryId') libraryId: string,
    @ZodBody(addTextItemSchema) body: AddTextItemInput,
  ): Promise<LibraryItemView> {
    const item = orThrow(await this.addTextItem.execute(userId, toLibraryId(libraryId), body.text));

    return toItemView(item, null);
  }

  /**
   * Devuelve el permiso para subir, no recibe el archivo. Los cincuenta megas
   * van del navegador al almacenamiento sin pasar por acá.
   */
  @Post(':libraryId/items/media')
  @HttpCode(HttpStatus.CREATED)
  async startUpload(
    @CurrentUserId() userId: UserId,
    @Param('libraryId') libraryId: string,
    @ZodBody(requestUploadSchema) body: RequestUploadInput,
  ): Promise<StartUploadResult> {
    const started = orThrow(
      await this.requestMediaUpload.execute(userId, toLibraryId(libraryId), body),
    );

    return { item: toItemView(started.item, null), upload: started.ticket };
  }

  /**
   * Acá se comprueba qué llegó de verdad. Sin cuerpo de respuesta: el navegador
   * recarga la biblioteca y ahí viene el elemento con su URL firmada.
   */
  @Post(':libraryId/items/:itemId/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmUpload(
    @CurrentUserId() userId: UserId,
    @Param('libraryId') libraryId: string,
    @Param('itemId') itemId: string,
  ): Promise<void> {
    orThrow(
      await this.confirmMediaUpload.execute(userId, toLibraryId(libraryId), toItemId(itemId)),
    );
  }

  /** Trae a esta biblioteca una copia de algo que ya está en el baúl. */
  @Post(':libraryId/items/copy')
  @HttpCode(HttpStatus.CREATED)
  async copyFromTheVault(
    @CurrentUserId() userId: UserId,
    @Param('libraryId') libraryId: string,
    @ZodBody(copyFromVaultSchema) body: CopyFromVaultInput,
  ): Promise<LibraryItemView> {
    const item = orThrow(
      await this.copyFromVault.execute(userId, toLibraryId(libraryId), toItemId(body.sourceItemId)),
    );

    return toItemView(item, null);
  }

  @Patch(':libraryId/items/:itemId/position')
  @HttpCode(HttpStatus.NO_CONTENT)
  async move(
    @CurrentUserId() userId: UserId,
    @Param('libraryId') libraryId: string,
    @Param('itemId') itemId: string,
    @ZodBody(moveItemSchema) body: MoveItemInput,
  ): Promise<void> {
    orThrow(await this.moveItem.execute(userId, toLibraryId(libraryId), toItemId(itemId), body));
  }

  @Delete(':libraryId/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeItemFromLibrary(
    @CurrentUserId() userId: UserId,
    @Param('libraryId') libraryId: string,
    @Param('itemId') itemId: string,
  ): Promise<void> {
    orThrow(await this.removeItem.execute(userId, toLibraryId(libraryId), toItemId(itemId)));
  }
}

/**
 * Un identificador con forma inválida es entrada mal escrita, no un recurso que
 * falta: se responde 400 y no 404, y sobre todo no se deja que reviente el
 * conversor con una excepción sin traducir.
 */
function toLibraryId(raw: string) {
  if (!LibraryId.is(raw)) {
    throw new InvalidInputError('library.id_invalid', 'Ese identificador de biblioteca no vale.');
  }

  return LibraryId.from(raw);
}

function toItemId(raw: string) {
  if (!LibraryItemId.is(raw)) {
    throw new InvalidInputError('item.id_invalid', 'Ese identificador de elemento no vale.');
  }

  return LibraryItemId.from(raw);
}

function countByKind(items: readonly LibraryItem[]): Record<ItemKind, number> {
  const counts = emptyCounts();

  for (const item of items) counts[item.kind] += 1;

  return counts;
}

function toSummary(library: Library, counts: Record<ItemKind, number>): LibrarySummary {
  return {
    id: library.id,
    name: library.name,
    description: library.description,
    counts,
    updatedAt: library.updatedAt.toISOString(),
  };
}

function toItemView(item: LibraryItem, mediaUrl: string | null): LibraryItemView {
  return {
    id: item.id,
    kind: item.kind,
    position: item.position,
    text: item.textContent,
    media: item.fileName === null ? null : { fileName: item.fileName, url: mediaUrl },
    createdAt: item.createdAt.toISOString(),
  };
}
