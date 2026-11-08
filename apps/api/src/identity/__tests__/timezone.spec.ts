import { describe, expect, it } from 'vitest';
import { UserId } from '../../shared/identifiers';
import { ChangeTimezone } from '../application/change-timezone.use-case';
import { buildIdentity, validRegistration } from './support';

async function unaCuenta() {
  const world = buildIdentity();
  const created = await world.register.execute(validRegistration);

  if (!created.ok) throw new Error('no se creó la cuenta');

  return { world, userId: UserId.from(created.value.userId) };
}

describe('cambiar la zona horaria', () => {
  it('guarda la nueva', async () => {
    const { world, userId } = await unaCuenta();

    const cambiada = await new ChangeTimezone(world.users).execute(userId, 'Europe/Madrid');

    expect(cambiada.ok).toBe(true);
    expect((await world.users.findById(userId))?.timezone).toBe('Europe/Madrid');
  });

  it('rechaza una que no existe y deja la que tenía', async () => {
    const { world, userId } = await unaCuenta();

    const cambiada = await new ChangeTimezone(world.users).execute(userId, 'Marte/Olympus');

    expect(cambiada.ok ? '' : cambiada.error.code).toBe('timezone.invalid');
    expect((await world.users.findById(userId))?.timezone).toBe('America/Bogota');
  });
});
