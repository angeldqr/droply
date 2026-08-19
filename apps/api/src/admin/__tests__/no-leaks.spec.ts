import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../../platform/prisma/prisma.service';
import type { UserId } from '../../shared/identifiers';
import { PrismaAccountDirectory } from '../infrastructure/prisma-account.directory';

const CREATED_AT = new Date('2026-08-01T10:00:00.000Z');

/**
 * Una fila con todo lo que NO puede salir: el chat de Telegram de una persona
 * que no es el administrador, más el contenido y las claves de almacenamiento
 * que Prisma devolvería si alguien pidiera la fila entera.
 */
const ROW = {
  id: 'ana',
  email: 'ana@ejemplo.com',
  displayName: 'Ana',
  role: 'USER',
  emailVerifiedAt: CREATED_AT,
  deactivatedAt: null,
  createdAt: CREATED_AT,
  passwordHash: '$argon2id$no-deberia-salir',
  _count: { recipients: 2, schedules: 1 },
  libraries: [
    {
      id: 'biblioteca-1',
      name: 'Álbum',
      description: 'Fotos viejas',
      isVault: false,
      _count: { items: 4, recipients: 1 },
    },
    {
      id: 'baul',
      name: 'Baúl',
      description: null,
      isVault: true,
      _count: { items: 7, recipients: 0 },
    },
  ],
  recipients: [
    { id: 'mama', label: 'Mamá', verifiedAt: CREATED_AT, externalId: '8907580411' },
    { id: 'papa', label: 'Papá', verifiedAt: null, externalId: null },
  ],
};

function directory() {
  const prisma = {
    user: {
      findMany: () => Promise.resolve([ROW]),
      findUnique: () => Promise.resolve(ROW),
    },
  } as unknown as PrismaService;

  return new PrismaAccountDirectory(prisma);
}

/**
 * Quien administra crea las cuentas y ve cuánto tiene cada una, y ahí se acaba.
 * No abre archivos, no lee textos y no se entera del chat de nadie: son cosas
 * de terceros que nunca aceptaron que un administrador las mirara.
 */
describe('el panel de administración solo muestra metadatos', () => {
  it('el detalle no trae el chat de un destinatario, solo si está vinculado', async () => {
    const account = await directory().find('ana' as UserId);

    expect(account?.recipients).toEqual([
      { id: 'mama', label: 'Mamá', linked: true },
      { id: 'papa', label: 'Papá', linked: false },
    ]);
    expect(JSON.stringify(account)).not.toContain('8907580411');
  });

  it('el detalle no trae contraseñas ni contenido', async () => {
    const account = await directory().find('ana' as UserId);
    const serialized = JSON.stringify(account);

    expect(serialized).not.toContain('argon2');
    expect(serialized).not.toContain('textContent');
    expect(serialized).not.toContain('storageKey');
  });

  it('cuenta el baúl aparte y no lo lista como biblioteca', async () => {
    const account = await directory().find('ana' as UserId);

    expect(account?.libraries.map((library) => library.name)).toEqual(['Álbum']);
    expect(account?.vaultItemCount).toBe(7);
  });

  it('el listado tampoco trae nada de más', async () => {
    const [summary] = await directory().list();

    if (!summary) throw new Error('el listado salió vacío');

    expect(JSON.stringify(summary)).not.toContain('argon2');
    expect(summary.libraryCount).toBe(1);
    expect(summary.vaultItemCount).toBe(7);
  });
});
