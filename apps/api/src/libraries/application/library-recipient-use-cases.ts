import type { LibraryId, UserId } from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import { LibraryNotFound, RecipientNotAvailable, VaultNotEditable } from '../domain/errors';
import type {
  LibraryRecipientRepository,
  LibraryRepository,
  LinkedRecipients,
  SchedulePruner,
} from '../domain/ports';

export class ListLibraryRecipients {
  constructor(
    private readonly libraries: LibraryRepository,
    private readonly members: LibraryRecipientRepository,
  ) {}

  async execute(ownerId: UserId, libraryId: LibraryId): Promise<Result<string[], LibraryNotFound>> {
    const library = await this.libraries.findOwned(libraryId, ownerId);
    if (!library) return err(new LibraryNotFound());

    return ok(await this.members.idsOf(libraryId));
  }
}

/**
 * Reemplaza de una vez la lista entera de destinatarios de una biblioteca.
 *
 * Reemplazar y no agregar/quitar de a uno porque así es como se usa: un diálogo
 * de casillas que se guarda entero. Con dos operaciones sueltas, dos pestañas
 * abiertas a la vez podrían dejar una mezcla que ninguna de las dos pidió.
 */
export class SetLibraryRecipients {
  constructor(
    private readonly libraries: LibraryRepository,
    private readonly members: LibraryRecipientRepository,
    private readonly linked: LinkedRecipients,
    private readonly schedules: SchedulePruner,
  ) {}

  async execute(
    ownerId: UserId,
    libraryId: LibraryId,
    recipientIds: readonly string[],
  ): Promise<Result<string[], LibraryNotFound | VaultNotEditable | RecipientNotAvailable>> {
    const library = await this.libraries.findOwned(libraryId, ownerId);
    if (!library) return err(new LibraryNotFound());

    // El baúl es personal: nada de lo que hay ahí sale hacia nadie, así que no
    // tiene sentido darle destinatarios.
    if (library.isVault) return err(new VaultNotEditable());

    /*
     * Cada id tiene que ser de esta cuenta y estar vinculado. Se comprueba
     * contra la lista de la cuenta en vez de uno por uno: es una consulta en
     * lugar de N, y de paso el dueño entra en la comparación sin que haya que
     * acordarse de filtrarlo en cada vuelta.
     */
    const allowed = new Set(await this.linked.idsOf(ownerId));
    const chosen = [...new Set(recipientIds)];

    if (chosen.some((id) => !allowed.has(id))) return err(new RecipientNotAvailable());

    await this.members.replace(libraryId, chosen);

    /*
     * Y se cortan los envíos que quedaron apuntando a quien se desmarcó.
     *
     * Sin esto, desmarcar a alguien apaga la casilla pero no el envío: el
     * horario que ya existía le seguiría llegando cada mañana, y el dueño
     * creería que lo quitó. Va después de guardar la lista para que el corte
     * use exactamente la lista que quedó.
     */
    await this.schedules.dropOutside(libraryId, chosen);

    return ok(chosen);
  }
}
