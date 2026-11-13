import { PAGE_SIZE_DEFAULT, pageQuerySchema } from '@reconectate/contracts';
import { describe, expect, it } from 'vitest';
import { ZodValidationPipe } from '../../platform/http/zod-validation.pipe';
import type { PrismaService } from '../../platform/prisma/prisma.service';
import { InvalidInputError } from '../../shared/domain-error';
import type { UserId } from '../../shared/identifiers';
import { PrismaDeliveryLog } from '../infrastructure/prisma-delivery.adapters';
import { DeliveriesController } from '../presentation/deliveries.controller';

interface Attempt {
  id: string;
  scheduleId: string;
  status: 'SENT';
  error: null;
  occurredAt: Date;
  schedule: { ownerId: string; library: { name: string }; recipient: { label: string } };
}

/** `count` envíos de una cuenta, uno por día: el `n` más alto es el más reciente. */
function attempts(ownerId: string, count: number): Attempt[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${ownerId}-${index + 1}`,
    scheduleId: `horario-${ownerId}`,
    status: 'SENT' as const,
    error: null,
    occurredAt: new Date(Date.UTC(2026, 0, index + 1)),
    schedule: { ownerId, library: { name: 'Álbum' }, recipient: { label: 'Mamá' } },
  }));
}

/**
 * Un Prisma de mentira que hace lo que la consulta le pide: filtra por dueño,
 * ordena del más reciente al más viejo y corta con `skip` y `take`. Así el test
 * ejerce la consulta de verdad del adaptador y no una copia suya.
 */
function controller(rows: Attempt[]) {
  const mine = (where: { schedule: { ownerId: string } }) =>
    rows.filter((row) => row.schedule.ownerId === where.schedule.ownerId);

  const prisma = {
    deliveryAttempt: {
      findMany: (args: { where: { schedule: { ownerId: string } }; skip: number; take: number }) =>
        Promise.resolve(
          mine(args.where)
            .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
            .slice(args.skip, args.skip + args.take),
        ),
      count: (args: { where: { schedule: { ownerId: string } } }) =>
        Promise.resolve(mine(args.where).length),
    },
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  } as unknown as PrismaService;

  return new DeliveriesController(new PrismaDeliveryLog(prisma));
}

const ANA = 'ana' as UserId;
const BETO = 'beto' as UserId;
const query = (input: Record<string, string> = {}) => pageQuerySchema.parse(input);

describe('el historial de envíos por páginas', () => {
  const api = controller([...attempts(ANA, 45), ...attempts(BETO, 3)]);

  it('sin indicar página entrega los 20 más recientes y el total', async () => {
    const result = await api.page(ANA, query());

    expect(result.items).toHaveLength(PAGE_SIZE_DEFAULT);
    expect(result.items[0]?.id).toBe('ana-45');
    expect(result.items.at(-1)?.id).toBe('ana-26');
    expect(result).toMatchObject({ total: 45, page: 1, pageSize: 20 });
  });

  it('la última página trae los que quedan, que son los más viejos', async () => {
    const result = await api.page(ANA, query({ page: '3' }));

    expect(result.items.map((item) => item.id)).toEqual([
      'ana-5',
      'ana-4',
      'ana-3',
      'ana-2',
      'ana-1',
    ]);
    expect(result.total).toBe(45);
  });

  it('una página que no existe llega vacía y con el total de siempre', async () => {
    const result = await api.page(ANA, query({ page: '9' }));

    expect(result.items).toEqual([]);
    expect(result.total).toBe(45);
  });

  it('rechaza la página cero y un tamaño de 500 antes de llegar a la ruta', () => {
    // Es el mismo pipe que `@ZodQuery` le pone a la ruta.
    const pipe = new ZodValidationPipe(pageQuerySchema);

    expect(() => pipe.transform({ page: '0' })).toThrow(InvalidInputError);
    expect(() => pipe.transform({ pageSize: '500' })).toThrow(InvalidInputError);
    expect(pipe.transform({})).toEqual({ page: 1, pageSize: PAGE_SIZE_DEFAULT });
  });

  it('ni la lista ni el total incluyen envíos de otra cuenta', async () => {
    const result = await api.page(BETO, query());

    expect(result.total).toBe(3);
    expect(result.items.every((item) => item.id.startsWith('beto-'))).toBe(true);
  });
});
