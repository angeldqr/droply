import { describe, expect, it } from 'vitest';
import { SessionCompromised } from '../domain/errors';
import { buildIdentity, REFRESH_LIFETIME_MS, validRegistration } from './support';

/**
 * La rotación con detección de reuso es lo que impide que un refresh token
 * filtrado sirva para siempre. Es la parte de identity que más conviene tener
 * cubierta.
 */
async function loggedIn() {
  const world = buildIdentity();

  await world.register.execute(validRegistration);
  const login = await world.login.execute({
    email: validRegistration.email,
    password: validRegistration.password,
  });

  if (!login.ok) throw new Error('El login de preparación falló.');

  return { world, first: login.value.session };
}

describe('refresco de sesión', () => {
  it('entrega un token nuevo y distinto del presentado', async () => {
    const { world, first } = await loggedIn();

    const result = await world.refresh.execute(first.refreshToken);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.session.refreshToken).not.toBe(first.refreshToken);
    expect(result.value.session.accessToken).not.toBe(first.accessToken);
  });

  it('quema el token anterior en cuanto se canjea', async () => {
    const { world, first } = await loggedIn();

    await world.refresh.execute(first.refreshToken);
    const segundoIntento = await world.refresh.execute(first.refreshToken);

    expect(segundoIntento.ok).toBe(false);
  });

  it('al detectar un token reusado tumba la familia entera', async () => {
    const { world, first } = await loggedIn();

    const rotated = await world.refresh.execute(first.refreshToken);
    if (!rotated.ok) throw new Error('El primer refresco debería haber funcionado.');

    // El atacante presenta el token viejo, que ya fue canjeado.
    const reuse = await world.refresh.execute(first.refreshToken);

    expect(reuse.ok).toBe(false);

    // Y el token legítimo, que estaba sano, también deja de servir: no hay
    // forma de saber cuál de las dos partes es la buena.
    const legitimo = await world.refresh.execute(rotated.value.session.refreshToken);

    expect(legitimo.ok).toBe(false);
  });

  it('responde a un reuso exactamente igual que a un token vencido', async () => {
    // El código y el mensaje son lo único que llega al cliente. Si difieren,
    // quien robó el token sabe que lo detectamos y cuándo dejar de usarlo.
    const vencido = await loggedIn();
    vencido.world.clock.advanceBy(REFRESH_LIFETIME_MS + 1000);
    const porVencimiento = await vencido.world.refresh.execute(vencido.first.refreshToken);

    const reusado = await loggedIn();
    await reusado.world.refresh.execute(reusado.first.refreshToken);
    const porReuso = await reusado.world.refresh.execute(reusado.first.refreshToken);

    expect(porVencimiento.ok).toBe(false);
    expect(porReuso.ok).toBe(false);
    if (porVencimiento.ok || porReuso.ok) return;

    expect(porReuso.error.code).toBe(porVencimiento.error.code);
    expect(porReuso.error.message).toBe(porVencimiento.error.message);
    expect(porReuso.error.message).not.toMatch(/reus|robad|atacante|comprometid/i);
  });

  it('distingue el reuso puertas adentro, para poder registrarlo', async () => {
    const { world, first } = await loggedIn();

    await world.refresh.execute(first.refreshToken);
    const reuse = await world.refresh.execute(first.refreshToken);

    expect(reuse.ok).toBe(false);
    if (reuse.ok) return;

    // Idéntico hacia afuera, distinguible hacia adentro.
    expect(reuse.error).toBeInstanceOf(SessionCompromised);
  });

  it('mantiene la misma familia mientras la cadena sea legítima', async () => {
    const { world, first } = await loggedIn();

    const segundo = await world.refresh.execute(first.refreshToken);
    if (!segundo.ok) throw new Error('refresco fallido');

    const tercero = await world.refresh.execute(segundo.value.session.refreshToken);

    expect(tercero.ok).toBe(true);

    const familias = new Set(
      [...world.refreshTokens.rows.values()].map((token) => token.toSnapshot().familyId),
    );

    expect(familias.size).toBe(1);
  });

  it('rechaza un token vencido', async () => {
    const { world, first } = await loggedIn();

    world.clock.advanceBy(REFRESH_LIFETIME_MS + 1000);

    const result = await world.refresh.execute(first.refreshToken);

    expect(result.ok).toBe(false);
  });

  it('rechaza un token que nunca existió', async () => {
    const { world } = await loggedIn();

    const result = await world.refresh.execute('esto-no-es-un-token');

    expect(result.ok).toBe(false);
  });

  it('cerrar sesión invalida también el refresco en vuelo', async () => {
    const { world, first } = await loggedIn();

    await world.logout.execute(first.refreshToken);

    const result = await world.refresh.execute(first.refreshToken);

    expect(result.ok).toBe(false);
  });

  it('cerrar sesión sin cookie no falla', async () => {
    const { world } = await loggedIn();

    await expect(world.logout.execute(undefined)).resolves.toEqual({ ok: true, value: undefined });
  });
});
