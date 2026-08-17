import { describe, expect, it } from 'vitest';
import { buildIdentity, validRegistration } from './support';

describe('registro', () => {
  it('crea la cuenta y manda el correo de verificación', async () => {
    const world = buildIdentity();

    const result = await world.register.execute(validRegistration);

    expect(result.ok).toBe(true);
    expect(world.mailer.sent).toHaveLength(1);
    expect(world.mailer.lastUrl).toContain('https://droply.test/verificar-correo?token=');
  });

  it('normaliza el correo para que no entren dos cuentas de la misma persona', async () => {
    const world = buildIdentity();

    await world.register.execute(validRegistration);
    const repetido = await world.register.execute({
      ...validRegistration,
      email: '  ana@ejemplo.com  ',
    });

    expect(repetido.ok).toBe(false);
    if (repetido.ok) return;

    expect(repetido.error.code).toBe('email.already_registered');
  });

  it('nace sin verificar y por eso todavía no puede programar', async () => {
    const world = buildIdentity();

    const result = await world.register.execute(validRegistration);
    if (!result.ok) throw new Error('registro fallido');

    const user = [...world.users.rows.values()][0];

    expect(user?.isEmailVerified).toBe(false);
    expect(user?.ensureCanSchedule().ok).toBe(false);
  });

  it('rechaza una contraseña corta antes de tocar la base', async () => {
    const world = buildIdentity();

    const result = await world.register.execute({ ...validRegistration, password: 'corta' });

    expect(result.ok).toBe(false);
    expect(world.users.rows.size).toBe(0);
    expect(world.mailer.sent).toHaveLength(0);
  });

  it('rechaza una zona horaria que no existe', async () => {
    const world = buildIdentity();

    const result = await world.register.execute({
      ...validRegistration,
      timezone: 'Marte/Olympus',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe('timezone.invalid');
  });

  it('guarda la contraseña pasada por el hasher, no como llegó', async () => {
    const world = buildIdentity();

    await world.register.execute(validRegistration);
    const user = [...world.users.rows.values()][0];

    // Que el hash no sea reversible se comprueba contra argon2 de verdad, en
    // `infrastructure/argon2-password-hasher.spec.ts`: acá el hasher es un
    // doble y afirmarlo sería engañarse.
    expect(user?.hashedPassword).not.toBe(validRegistration.password);
  });
});

describe('verificación de correo', () => {
  it('deja programar una vez confirmado el enlace', async () => {
    const world = buildIdentity();
    await world.register.execute(validRegistration);

    const result = await world.verifyEmail.execute(world.mailer.lastToken);

    expect(result.ok).toBe(true);

    const user = [...world.users.rows.values()][0];

    expect(user?.isEmailVerified).toBe(true);
    expect(user?.ensureCanSchedule().ok).toBe(true);
  });

  it('no permite reutilizar el mismo enlace', async () => {
    const world = buildIdentity();
    await world.register.execute(validRegistration);

    await world.verifyEmail.execute(world.mailer.lastToken);
    const segundaVez = await world.verifyEmail.execute(world.mailer.lastToken);

    expect(segundaVez.ok).toBe(false);
  });

  it('rechaza un enlace vencido', async () => {
    const world = buildIdentity();
    await world.register.execute(validRegistration);

    world.clock.advanceBy(61 * 60 * 1000);

    const result = await world.verifyEmail.execute(world.mailer.lastToken);

    expect(result.ok).toBe(false);
  });

  it('responde igual ante un enlace inexistente, uno usado y uno vencido', async () => {
    const inventado = buildIdentity();
    await inventado.register.execute(validRegistration);
    const inexistente = await inventado.verifyEmail.execute('token-inventado');

    const gastado = buildIdentity();
    await gastado.register.execute(validRegistration);
    await gastado.verifyEmail.execute(gastado.mailer.lastToken);
    const usado = await gastado.verifyEmail.execute(gastado.mailer.lastToken);

    // Este caso necesita su propio mundo: una vez usado el enlace, adelantar
    // el reloj ya no ejercita el camino del vencimiento.
    const viejo = buildIdentity();
    await viejo.register.execute(validRegistration);
    viejo.clock.advanceBy(61 * 60 * 1000);
    const vencido = await viejo.verifyEmail.execute(viejo.mailer.lastToken);

    expect([inexistente.ok, usado.ok, vencido.ok]).toEqual([false, false, false]);
    if (inexistente.ok || usado.ok || vencido.ok) return;

    const respuestas = [inexistente, usado, vencido].map(
      (r) => `${r.error.code}|${r.error.message}`,
    );

    expect(new Set(respuestas).size).toBe(1);
  });
});
