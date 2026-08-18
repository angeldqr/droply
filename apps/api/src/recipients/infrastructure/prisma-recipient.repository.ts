import type { Recipient as RecipientRow } from '@prisma/client';
import type { PrismaService } from '../../platform/prisma/prisma.service';
import { RecipientId, UserId } from '../../shared/identifiers';
import type { RecipientRepository } from '../domain/ports';
import { Recipient } from '../domain/recipient';

export class PrismaRecipientRepository implements RecipientRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listOwnedBy(ownerId: UserId): Promise<Recipient[]> {
    const rows = await this.prisma.recipient.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map(toDomain);
  }

  async findOwned(id: RecipientId, ownerId: UserId): Promise<Recipient | null> {
    // El dueño va en el `where`, no en un chequeo posterior.
    const row = await this.prisma.recipient.findFirst({ where: { id, ownerId } });

    return row ? toDomain(row) : null;
  }

  async findByCodeHash(codeHash: string): Promise<Recipient | null> {
    // La única lectura sin dueño del contexto: quien llega por el enlace no
    // tiene sesión, y el código es lo único que trae.
    const row = await this.prisma.recipient.findUnique({ where: { linkCodeHash: codeHash } });

    return row ? toDomain(row) : null;
  }

  async findLinkedChat(ownerId: UserId, externalId: string): Promise<Recipient | null> {
    const row = await this.prisma.recipient.findFirst({
      where: { ownerId, externalId, verifiedAt: { not: null } },
    });

    return row ? toDomain(row) : null;
  }

  async add(recipient: Recipient): Promise<void> {
    const snapshot = recipient.toSnapshot();

    await this.prisma.recipient.create({
      data: {
        id: snapshot.id,
        ownerId: snapshot.ownerId,
        label: snapshot.label,
        channel: snapshot.channel,
        externalId: snapshot.externalId,
        linkCodeHash: snapshot.linkCodeHash,
        linkCodeExpiresAt: snapshot.linkCodeExpiresAt,
        verifiedAt: snapshot.verifiedAt,
        createdAt: snapshot.createdAt,
      },
    });
  }

  async save(recipient: Recipient): Promise<void> {
    const snapshot = recipient.toSnapshot();

    await this.prisma.recipient.update({
      where: { id: snapshot.id },
      data: {
        label: snapshot.label,
        externalId: snapshot.externalId,
        linkCodeHash: snapshot.linkCodeHash,
        linkCodeExpiresAt: snapshot.linkCodeExpiresAt,
        verifiedAt: snapshot.verifiedAt,
      },
    });
  }

  async remove(id: RecipientId, ownerId: UserId): Promise<void> {
    await this.prisma.recipient.deleteMany({ where: { id, ownerId } });
  }
}

function toDomain(row: RecipientRow): Recipient {
  return Recipient.fromSnapshot({
    id: RecipientId.from(row.id),
    ownerId: UserId.from(row.ownerId),
    label: row.label,
    channel: row.channel,
    externalId: row.externalId,
    linkCodeHash: row.linkCodeHash,
    linkCodeExpiresAt: row.linkCodeExpiresAt,
    verifiedAt: row.verifiedAt,
    createdAt: row.createdAt,
  });
}
