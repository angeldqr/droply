import type { PrismaService } from '../../platform/prisma/prisma.service';
import type { LibraryId, UserId } from '../../shared/identifiers';
import type { LibraryRecipientRepository, LinkedRecipients, SchedulePruner } from '../domain/ports';

export class PrismaLibraryRecipientRepository implements LibraryRecipientRepository {
  constructor(private readonly prisma: PrismaService) {}

  async idsOf(libraryId: LibraryId): Promise<string[]> {
    const rows = await this.prisma.libraryRecipient.findMany({
      where: { libraryId },
      select: { recipientId: true },
    });

    return rows.map((row) => row.recipientId);
  }

  /**
   * Borrar y volver a insertar, dentro de una transacción.
   *
   * Calcular el diferencial sería más consultas para el mismo resultado: son
   * cinco o seis filas, no cinco mil. La transacción es lo que importa: sin
   * ella, un fallo entre el borrado y el alta dejaría la biblioteca sin
   * destinatarios y sus horarios apuntando al vacío.
   */
  async replace(libraryId: LibraryId, recipientIds: readonly string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.libraryRecipient.deleteMany({ where: { libraryId } }),
      this.prisma.libraryRecipient.createMany({
        data: recipientIds.map((recipientId) => ({ libraryId, recipientId })),
      }),
    ]);
  }
}

/**
 * Se escribe en la tabla de horarios desde acá, sin importar su contexto.
 *
 * Es el mismo trato que con los destinatarios: dos columnas y un borrado, en
 * vez de montar un puente de módulos. Y tiene que ser un borrado y no un
 * apagado: un horario hacia alguien que ya no está en la biblioteca no es algo
 * que el dueño vaya a querer reanudar, es algo que dejó de tener sentido.
 */
export class PrismaSchedulePruner implements SchedulePruner {
  constructor(private readonly prisma: PrismaService) {}

  async dropOutside(libraryId: LibraryId, recipientIds: readonly string[]): Promise<number> {
    const { count } = await this.prisma.schedule.deleteMany({
      where: { libraryId, recipientId: { notIn: [...recipientIds] } },
    });

    return count;
  }
}

export class PrismaLinkedRecipients implements LinkedRecipients {
  constructor(private readonly prisma: PrismaService) {}

  async idsOf(ownerId: UserId): Promise<string[]> {
    const rows = await this.prisma.recipient.findMany({
      // Vinculado es tener chat y fecha de verificación, igual que en el
      // dominio de destinatarios.
      where: { ownerId, verifiedAt: { not: null }, externalId: { not: null } },
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }
}
