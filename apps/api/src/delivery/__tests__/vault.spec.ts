import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../../platform/prisma/prisma.service';
import type { DispatchTarget } from '../domain/ports';
import { PrismaLibraryCatalog } from '../infrastructure/prisma-delivery.adapters';

const TARGET: DispatchTarget = {
  scheduleId: 'horario-1',
  libraryId: 'biblioteca-1',
  ownerId: 'ana',
  chatId: '123',
  senderName: 'Ana',
  strategy: 'RANDOM',
  kindFilter: null,
  startMinute: 480,
  endMinute: 1200,
  timezone: 'America/Bogota',
};

/** Con qué se le preguntó a la base, que es justo lo que hay que fijar. */
interface Where {
  readonly libraryId?: string;
  readonly kind?: string;
  readonly library?: { readonly isVault: boolean };
}

/** Un Prisma de mentira que solo apunta la consulta y devuelve nada. */
function spy() {
  const asked: Where[] = [];

  const prisma = {
    libraryItem: {
      findMany: (args: { where: Where }) => {
        asked.push(args.where);

        return Promise.resolve([]);
      },
    },
  } as unknown as PrismaService;

  return {
    catalog: new PrismaLibraryCatalog(prisma),
    lastWhere: (): Where => {
      const where = asked.at(-1);

      if (!where) throw new Error('no se consultó la base');

      return where;
    },
    count: () => asked.length,
  };
}

/**
 * El baúl es personal: lo que hay ahí no sale hacia nadie hasta que su dueño lo
 * copie a una biblioteca. La guarda tiene que vivir en la consulta y no en
 * quien llama, porque un camino nuevo puede olvidarse de comprobarlo y nadie se
 * enteraría hasta que alguien recibiera algo que nunca quiso mandar.
 */
describe('el baúl no sale hacia nadie', () => {
  it('la consulta de candidatos siempre excluye el baúl', async () => {
    const { catalog, count, lastWhere } = spy();

    await catalog.candidatesOf(TARGET, new Date('2026-08-19T13:00:00.000Z'));

    expect(count()).toBe(1);
    expect(lastWhere().library).toEqual({ isVault: false });
  });

  it('y sigue pidiendo solo los de esa biblioteca', async () => {
    const { catalog, lastWhere } = spy();

    await catalog.candidatesOf(TARGET, new Date('2026-08-19T13:00:00.000Z'));

    expect(lastWhere().libraryId).toBe('biblioteca-1');
  });

  it('el filtro por columna no reemplaza la guarda', async () => {
    const { catalog, lastWhere } = spy();

    await catalog.candidatesOf(
      { ...TARGET, kindFilter: 'IMAGE' },
      new Date('2026-08-19T13:00:00.000Z'),
    );

    expect(lastWhere().kind).toBe('IMAGE');
    expect(lastWhere().library).toEqual({ isVault: false });
  });
});
