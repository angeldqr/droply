import { createHash, randomBytes } from 'node:crypto';
import { addDays } from '@reconectate/contracts';
import type {
  AccountChat as AccountChatRow,
  Habit as HabitRow,
  HabitEntry as HabitEntryRow,
} from '@prisma/client';
import type { PrismaService } from '../../platform/prisma/prisma.service';
import {
  HabitEntryId,
  HabitId,
  PhotoId,
  UserId,
  type HabitEntryId as HabitEntryIdType,
  type HabitId as HabitIdType,
  type PhotoId as PhotoIdType,
} from '../../shared/identifiers';
import { AccountChat } from '../domain/account-chat';
import { HabitEntry, NOTE_MAX_LENGTH } from '../domain/entry';
import { Habit } from '../domain/habit';
import type {
  AccountChatRepository,
  DayCounts,
  EntryRepository,
  HabitRepository,
  LinkCode,
  LinkCodeFactory,
  StoredPhoto,
  AccountStatus,
} from '../domain/ports';

export class PrismaHabitRepository implements HabitRepository {
  constructor(private readonly prisma: PrismaService) {}

  async add(habit: Habit): Promise<void> {
    const snapshot = habit.toSnapshot();

    await this.prisma.habit.create({
      data: {
        id: snapshot.id,
        ownerId: snapshot.ownerId,
        name: snapshot.name,
        position: snapshot.position,
        dailyTarget: snapshot.dailyTarget,
        activeDays: snapshot.activeDays,
        createdAt: snapshot.createdAt,
      },
    });
  }

  async save(habit: Habit): Promise<void> {
    const snapshot = habit.toSnapshot();

    await this.prisma.habit.update({
      where: { id: snapshot.id },
      data: {
        name: snapshot.name,
        position: snapshot.position,
        dailyTarget: snapshot.dailyTarget,
        activeDays: snapshot.activeDays,
      },
    });
  }

  async findOwned(id: HabitIdType, ownerId: UserId): Promise<Habit | null> {
    // El dueño va dentro del `where`: lo ajeno no existe, no está prohibido.
    const row = await this.prisma.habit.findFirst({ where: { id, ownerId } });

    return row ? toHabit(row) : null;
  }

  async listOwnedBy(ownerId: UserId): Promise<Habit[]> {
    const rows = await this.prisma.habit.findMany({
      where: { ownerId },
      orderBy: { position: 'asc' },
    });

    return rows.map(toHabit);
  }

  countOwnedBy(ownerId: UserId): Promise<number> {
    return this.prisma.habit.count({ where: { ownerId } });
  }

  async lastPositionOf(ownerId: UserId): Promise<number | null> {
    const row = await this.prisma.habit.findFirst({
      where: { ownerId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    return row?.position ?? null;
  }

  async remove(id: HabitIdType, ownerId: UserId): Promise<void> {
    // `deleteMany` y no `delete`: es la única forma de que el dueño entre en la
    // consulta en vez de comprobarse antes.
    await this.prisma.habit.deleteMany({ where: { id, ownerId } });
  }

  /**
   * Cuántas anotaciones tiene cada hábito y cuándo fue la última.
   *
   * Un `groupBy` y no una consulta por hábito: con veinte hábitos serían veinte
   * viajes para pintar una lista que cabe en una pantalla.
   */
  async statsOf(ownerId: UserId): Promise<Map<HabitIdType, { count: number; lastAt: Date }>> {
    const rows = await this.prisma.habitEntry.groupBy({
      by: ['habitId'],
      where: { ownerId },
      _count: { _all: true },
      _max: { openedAt: true },
    });

    return new Map(
      rows.flatMap((row) =>
        row._max.openedAt
          ? [
              [
                HabitId.from(row.habitId),
                { count: row._count._all, lastAt: row._max.openedAt },
              ] as const,
            ]
          : [],
      ),
    );
  }
}

export class PrismaEntryRepository implements EntryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cuántas anotaciones tuvo cada hábito cada día, en la zona de la cuenta.
   *
   * `opened_at` no lleva zona y se guarda en UTC: primero se le dice que es UTC
   * y después se pasa a la hora de la cuenta, y de ahí sale el día. Las vacías
   * no cuentan: la que se acaba de abrir todavía no es una vez.
   */
  async dayCountsOf(ownerId: UserId, now: Date, days: number): Promise<DayCounts> {
    const [account] = await this.prisma.$queryRaw<{ today: string }[]>`
      SELECT ((${now}::timestamptz AT TIME ZONE timezone)::date)::text AS today
      FROM users WHERE id = ${ownerId}::uuid`;

    const today = account?.today ?? now.toISOString().slice(0, 10);
    const from = addDays(today, -(days - 1));

    // El corte grueso va un día de más hacia atrás, por la zona; el fino, con `from`.
    const rows = await this.prisma.$queryRaw<{ habitId: string; day: string; n: number }[]>`
      SELECT e.habit_id::text AS "habitId",
             (((e.opened_at AT TIME ZONE 'UTC') AT TIME ZONE u.timezone)::date)::text AS day,
             COUNT(*)::int AS n
      FROM habit_entries e
      JOIN users u ON u.id = e.owner_id
      WHERE e.owner_id = ${ownerId}::uuid
        AND e.opened_at >= ((${now}::timestamptz - make_interval(days => ${days}::int + 1)) AT TIME ZONE 'UTC')
        AND (e.note IS NOT NULL
             OR EXISTS (SELECT 1 FROM habit_entry_photos p WHERE p.entry_id = e.id))
      GROUP BY 1, 2`;

    const counts = new Map<HabitIdType, Map<string, number>>();

    for (const row of rows) {
      if (row.day < from || row.day > today) continue;

      const habitId = HabitId.from(row.habitId);
      const perDay = counts.get(habitId) ?? new Map<string, number>();

      perDay.set(row.day, row.n);
      counts.set(habitId, perDay);
    }

    return { today, counts };
  }

  async add(entry: HabitEntry): Promise<void> {
    const snapshot = entry.toSnapshot();

    await this.prisma.habitEntry.create({
      data: {
        id: snapshot.id,
        habitId: snapshot.habitId,
        ownerId: snapshot.ownerId,
        chatId: snapshot.chatId,
        note: snapshot.note,
        openedAt: snapshot.openedAt,
        touchedAt: snapshot.touchedAt,
        closedAt: snapshot.closedAt,
      },
    });
  }

  async save(entry: HabitEntry): Promise<void> {
    const snapshot = entry.toSnapshot();

    await this.prisma.habitEntry.update({
      where: { id: snapshot.id },
      // La nota no se escribe acá: solo la toca `appendNote`, en la base. Si se
      // guardara desde la memoria, cerrar mientras llega un álbum pisaría el
      // texto que entró en medio.
      data: {
        habitId: snapshot.habitId,
        touchedAt: snapshot.touchedAt,
        closedAt: snapshot.closedAt,
      },
    });
  }

  async findOpenFor(chatId: string, ownerId: UserId): Promise<HabitEntry | null> {
    const row = await this.prisma.habitEntry.findFirst({
      // El dueño también: un chat puede cambiar de cuenta, y sin esto lo que
      // escriba el segundo caería en la anotación que dejó abierta el primero.
      where: { chatId, ownerId, closedAt: null },
      include: { _count: { select: { photos: true } } },
    });

    return row ? toEntry(row, row._count.photos) : null;
  }

  async listOf(habitId: HabitIdType, ownerId: UserId): Promise<HabitEntry[]> {
    const rows = await this.prisma.habitEntry.findMany({
      where: { habitId, ownerId },
      orderBy: { openedAt: 'desc' },
      include: { _count: { select: { photos: true } } },
    });

    return rows.map((row) => toEntry(row, row._count.photos));
  }

  async findOwned(id: HabitEntryIdType, ownerId: UserId): Promise<HabitEntry | null> {
    const row = await this.prisma.habitEntry.findFirst({
      where: { id, ownerId },
      include: { _count: { select: { photos: true } } },
    });

    return row ? toEntry(row, row._count.photos) : null;
  }

  async remove(id: HabitEntryIdType, ownerId: UserId): Promise<void> {
    await this.prisma.habitEntry.deleteMany({ where: { id, ownerId } });
  }

  async photosOf(
    ownerId: UserId,
    entryIds: readonly HabitEntryIdType[],
  ): Promise<Map<HabitEntryIdType, StoredPhoto[]>> {
    if (entryIds.length === 0) return new Map();

    const rows = await this.prisma.habitEntryPhoto.findMany({
      // El dueño viaja por la anotación: una foto no tiene dueño propio, pero
      // la fila de la que cuelga sí, y la consulta lo comprueba.
      where: { entryId: { in: [...entryIds] }, entry: { ownerId } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, entryId: true, storageKey: true, thumbKey: true },
    });

    const byEntry = new Map<HabitEntryIdType, StoredPhoto[]>();

    for (const row of rows) {
      const entryId = HabitEntryId.from(row.entryId);
      const list = byEntry.get(entryId) ?? [];

      list.push({ id: PhotoId.from(row.id), storageKey: row.storageKey, thumbKey: row.thumbKey });
      byEntry.set(entryId, list);
    }

    return byEntry;
  }

  /**
   * Guarda la foto y devuelve cuántas tiene ya la anotación.
   *
   * Las dos cosas en una transacción, y el recuento después de escribir: las
   * fotos de un álbum llegan como mensajes distintos y a la vez, y contándolas
   * antes las dos verían el mismo número y el tope se rebasaría.
   */
  async addPhoto(input: {
    id: PhotoIdType;
    ownerId: UserId;
    entryId: HabitEntryIdType;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    thumbKey: string | null;
    now: Date;
  }): Promise<number> {
    const { ownerId, now, ...photo } = input;

    return this.prisma.$transaction(async (tx) => {
      // El dueño dentro de la escritura: si la anotación no es suya, no entra
      // ninguna fila y el recuento sale cero. La misma escritura la mantiene
      // viva, o quien solo manda fotos la vería caducar a la media hora.
      const touched = await tx.habitEntry.updateMany({
        where: { id: photo.entryId, ownerId, closedAt: null },
        data: { touchedAt: now },
      });

      if (touched.count === 0) return 0;

      await tx.habitEntryPhoto.create({ data: photo });

      return tx.habitEntryPhoto.count({ where: { entryId: photo.entryId } });
    });
  }

  /**
   * Añade texto a la nota sin leerla antes.
   *
   * Es un `UPDATE` que concatena sobre lo que haya en la base. Leer, juntar en
   * memoria y guardar perdía uno de los dos mensajes cuando llegaban juntos,
   * que es lo que pasa con el pie de foto de un álbum.
   *
   * Los parámetros llevan su tipo escrito: Prisma manda los números como
   * `bigint`, `LEFT` no tiene esa firma y Postgres rechazaba el `UPDATE` entero.
   * La hora va en UTC, como en los otros `UPDATE` a mano: las columnas son
   * `TIMESTAMP` sin zona, y un `Date` a secas tomaba la zona de la sesión, que
   * en una base fuera de UTC dejaba la anotación caducada al siguiente mensaje.
   */
  async appendNote(id: HabitEntryIdType, ownerId: UserId, text: string, now: Date): Promise<void> {
    const clean = text.trim();

    if (clean.length === 0) return;

    await this.prisma.$executeRaw`
      UPDATE habit_entries
      SET note = LEFT(COALESCE(note || chr(10), '') || ${clean}::text, ${NOTE_MAX_LENGTH}::int),
          touched_at = (${now} AT TIME ZONE 'UTC')
      WHERE id = ${id}::uuid AND owner_id = ${ownerId}::uuid AND closed_at IS NULL
    `;
  }
}

export class PrismaAccountChatRepository implements AccountChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(userId: UserId): Promise<AccountChat | null> {
    const row = await this.prisma.accountChat.findUnique({ where: { userId } });

    return row ? toChat(row) : null;
  }

  async findByCodeHash(codeHash: string): Promise<AccountChat | null> {
    const row = await this.prisma.accountChat.findUnique({ where: { linkCodeHash: codeHash } });

    return row ? toChat(row) : null;
  }

  async findByChatId(chatId: string): Promise<AccountChat | null> {
    const row = await this.prisma.accountChat.findUnique({ where: { chatId } });

    return row ? toChat(row) : null;
  }

  async save(chat: AccountChat): Promise<void> {
    const snapshot = chat.toSnapshot();
    const fields = {
      chatId: snapshot.chatId,
      linkCodeHash: snapshot.linkCodeHash,
      linkCodeExpiresAt: snapshot.linkCodeExpiresAt,
      linkedAt: snapshot.linkedAt,
    };

    // La fila nace la primera vez que alguien pide su enlace, no con la cuenta:
    // quien nunca use el bot no tiene por qué arrastrar una fila vacía.
    await this.prisma.accountChat.upsert({
      where: { userId: snapshot.userId },
      create: { userId: snapshot.userId, ...fields },
      update: fields,
    });
  }
}

/**
 * El código del enlace.
 *
 * Dieciséis bytes en base64url y no treinta y dos, por lo mismo que el de los
 * destinatarios: el `start` de Telegram admite 64 caracteres y solo del juego
 * `A-Za-z0-9_-`, que es justo lo que produce base64url.
 */
export class Sha256JournalLinkCodes implements LinkCodeFactory {
  create(): LinkCode {
    const value = randomBytes(16).toString('base64url');

    return { value, hash: this.hash(value) };
  }

  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}

/** Lo que la bitácora necesita saber de la cuenta, leído de la tabla. */
export class PrismaJournalAccountStatus implements AccountStatus {
  constructor(private readonly prisma: PrismaService) {}

  async hasVerifiedEmail(userId: UserId): Promise<boolean> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true },
    });

    return row?.emailVerifiedAt !== null && row?.emailVerifiedAt !== undefined;
  }
}

function toHabit(row: HabitRow): Habit {
  return Habit.fromSnapshot({
    id: HabitId.from(row.id),
    ownerId: UserId.from(row.ownerId),
    name: row.name,
    position: row.position,
    dailyTarget: row.dailyTarget,
    activeDays: row.activeDays,
    createdAt: row.createdAt,
  });
}

function toEntry(row: HabitEntryRow, photoCount: number): HabitEntry {
  return HabitEntry.fromSnapshot({
    id: HabitEntryId.from(row.id),
    habitId: HabitId.from(row.habitId),
    ownerId: UserId.from(row.ownerId),
    chatId: row.chatId,
    note: row.note,
    openedAt: row.openedAt,
    touchedAt: row.touchedAt,
    closedAt: row.closedAt,
    photoCount,
  });
}

function toChat(row: AccountChatRow): AccountChat {
  return AccountChat.fromSnapshot({
    userId: UserId.from(row.userId),
    chatId: row.chatId,
    linkCodeHash: row.linkCodeHash,
    linkCodeExpiresAt: row.linkCodeExpiresAt,
    linkedAt: row.linkedAt,
  });
}
