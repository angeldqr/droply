import { describe, expect, it } from 'vitest';
import { UserId } from '../../shared/identifiers';
import { buildIdentity, validRegistration } from './support';

/** Crea la cuenta de Ana y devuelve el mundo con su identificador. */
async function withAna(startingAt?: Date) {
  const world = buildIdentity(startingAt);
  const created = await world.register.execute(validRegistration);

  if (!created.ok) throw new Error('no se creó la cuenta');

  return { world, anaId: UserId.from(created.value.userId) };
}

const entrar = (world: Awaited<ReturnType<typeof withAna>>['world'], password: string) =>
  world.login.execute({ email: validRegistration.email, password });

describe('cambiar la propia contraseña', () => {
  it('cambia y deja entrar con la nueva', async () => {
    const { world, anaId } = await withAna();

    const result = await world.changePassword.execute(anaId, {
      currentPassword: validRegistration.password,
      newPassword: 'otra frase igual de larga',
    });

    expect(result.ok).toBe(true);
    expect((await entrar(world, 'otra frase igual de larga')).ok).toBe(true);
    expect((await entrar(world, validRegistration.password)).ok).toBe(false);
  });

  it('no cambia nada si la contraseña actual no es esa', async () => {
    const { world, anaId } = await withAna();

    const result = await world.changePassword.execute(anaId, {
      currentPassword: 'esta no es',
      newPassword: 'otra frase igual de larga',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('password.current_wrong');
    expect((await entrar(world, validRegistration.password)).ok).toBe(true);
  });

  it('cierra las sesiones abiertas', async () => {
    const { world, anaId } = await withAna();
    const session = await entrar(world, validRegistration.password);

    if (!session.ok) throw new Error('no se abrió la sesión');

    await world.changePassword.execute(anaId, {
      currentPassword: validRegistration.password,
      newPassword: 'otra frase igual de larga',
    });

    /*
     * Es el punto de todo esto: cambiar la contraseña porque sospechas que
     * alguien entró no sirve de nada si su sesión sigue viva.
     */
    const refreshed = await world.refresh.execute(session.value.session.refreshToken);

    expect(refreshed.ok).toBe(false);
  });

  it('no acepta una contraseña demasiado corta', async () => {
    const { world, anaId } = await withAna();

    const result = await world.changePassword.execute(anaId, {
      currentPassword: validRegistration.password,
      newPassword: 'corta',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('password.too_short');
  });
});

describe('recuperar la contraseña olvidada', () => {
  it('manda el enlace y deja poner una nueva', async () => {
    const { world } = await withAna();

    await world.requestReset.execute(validRegistration.email);

    const result = await world.resetPassword.execute(
      world.mailer.lastResetToken,
      'una contraseña recien puesta',
    );

    expect(result.ok).toBe(true);
    expect((await entrar(world, 'una contraseña recien puesta')).ok).toBe(true);
  });

  it('no dice nada de un correo que no existe', async () => {
    const { world } = await withAna();

    // No lanza y no manda nada: desde fuera es idéntico a un correo que sí
    // existe, que es justo lo que impide usar esto para descubrir cuentas.
    await world.requestReset.execute('desconocido@ejemplo.com');

    expect(world.mailer.resets).toHaveLength(0);
  });

  it('el enlace sirve una sola vez', async () => {
    const { world } = await withAna();

    await world.requestReset.execute(validRegistration.email);
    const token = world.mailer.lastResetToken;

    expect((await world.resetPassword.execute(token, 'una contraseña recien puesta')).ok).toBe(
      true,
    );

    const segunda = await world.resetPassword.execute(token, 'y otra distinta todavia');

    expect(segunda.ok).toBe(false);
    if (!segunda.ok) expect(segunda.error.code).toBe('password.reset_invalid');
  });

  it('un enlace inventado responde igual que uno usado', async () => {
    const { world } = await withAna();

    const result = await world.resetPassword.execute('inventado', 'una contraseña cualquiera');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('password.reset_invalid');
  });

  it('un enlace vencido no sirve', async () => {
    const { world } = await withAna(new Date('2026-08-17T09:00:00.000Z'));

    await world.requestReset.execute(validRegistration.email);
    const token = world.mailer.lastResetToken;

    world.clock.set(new Date('2026-08-17T11:00:00.000Z'));

    const result = await world.resetPassword.execute(token, 'una contraseña recien puesta');

    expect(result.ok).toBe(false);
  });

  it('cierra las sesiones abiertas', async () => {
    const { world } = await withAna();
    const session = await entrar(world, validRegistration.password);

    if (!session.ok) throw new Error('no se abrió la sesión');

    await world.requestReset.execute(validRegistration.email);
    await world.resetPassword.execute(world.mailer.lastResetToken, 'una contraseña recien puesta');

    expect((await world.refresh.execute(session.value.session.refreshToken)).ok).toBe(false);
  });
});
