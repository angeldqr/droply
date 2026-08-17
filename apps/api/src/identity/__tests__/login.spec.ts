import { describe, expect, it } from 'vitest';
import { buildIdentity, validRegistration } from './support';

describe('login', () => {
  it('abre sesión con las credenciales correctas', async () => {
    const world = buildIdentity();
    await world.register.execute(validRegistration);

    const result = await world.login.execute({
      email: validRegistration.email,
      password: validRegistration.password,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.session.accessToken).toBeTruthy();
    expect(result.value.session.refreshToken).toBeTruthy();
    expect(result.value.user.email.value).toBe('ana@ejemplo.com');
  });

  it('deja entrar aunque el correo todavía no esté verificado', async () => {
    const world = buildIdentity();
    await world.register.execute(validRegistration);

    const result = await world.login.execute({
      email: validRegistration.email,
      password: validRegistration.password,
    });

    // Poder entrar es lo que permite reenviarse el correo o cambiar la
    // dirección; lo que queda bloqueado es programar envíos.
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.user.isEmailVerified).toBe(false);
  });

  it('responde lo mismo ante una cuenta inexistente y una contraseña incorrecta', async () => {
    const world = buildIdentity();
    await world.register.execute(validRegistration);

    const inexistente = await world.login.execute({
      email: 'nadie@ejemplo.com',
      password: 'una frase larga y tranquila',
    });
    const claveMala = await world.login.execute({
      email: validRegistration.email,
      password: 'otra frase completamente distinta',
    });

    expect(inexistente.ok).toBe(false);
    expect(claveMala.ok).toBe(false);
    if (inexistente.ok || claveMala.ok) return;

    expect(inexistente.error.code).toBe(claveMala.error.code);
    expect(inexistente.error.message).toBe(claveMala.error.message);
  });

  it('gasta el mismo trabajo de verificación cuando la cuenta no existe', async () => {
    const world = buildIdentity();
    let verificaciones = 0;

    const original = world.hasher.verify.bind(world.hasher);
    world.hasher.verify = (hash, plain) => {
      verificaciones += 1;

      return original(hash, plain);
    };

    await world.login.execute({ email: 'nadie@ejemplo.com', password: 'lo que sea' });

    // Sin esta llamada de relleno, el tiempo de respuesta delataría qué
    // correos están registrados.
    expect(verificaciones).toBe(1);
  });

  it('trata un correo mal formado como credencial incorrecta y no como error de validación', async () => {
    const world = buildIdentity();

    const result = await world.login.execute({ email: 'no-es-un-correo', password: 'lo que sea' });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe('auth.invalid_credentials');
  });

  it('rehashea la contraseña si los parámetros quedaron viejos', async () => {
    const world = buildIdentity();
    await world.register.execute(validRegistration);

    // El hasher falso es determinista, así que comparar el hash antes y
    // después no probaría nada: hay que contar las llamadas.
    let vecesHasheada = 0;
    const original = world.hasher.hash.bind(world.hasher);
    world.hasher.hash = (plain) => {
      vecesHasheada += 1;

      return original(plain);
    };

    world.hasher.needsRehashNext = true;

    await world.login.execute({
      email: validRegistration.email,
      password: validRegistration.password,
    });

    expect(vecesHasheada).toBe(1);
  });

  it('no rehashea cuando el hash guardado sigue vigente', async () => {
    const world = buildIdentity();
    await world.register.execute(validRegistration);

    let vecesHasheada = 0;
    const original = world.hasher.hash.bind(world.hasher);
    world.hasher.hash = (plain) => {
      vecesHasheada += 1;

      return original(plain);
    };

    await world.login.execute({
      email: validRegistration.email,
      password: validRegistration.password,
    });

    expect(vecesHasheada).toBe(0);
  });

  it('cada login abre una familia de tokens distinta', async () => {
    const world = buildIdentity();
    await world.register.execute(validRegistration);

    const credenciales = {
      email: validRegistration.email,
      password: validRegistration.password,
    };

    await world.login.execute(credenciales);
    await world.login.execute(credenciales);

    const familias = new Set(
      [...world.refreshTokens.rows.values()].map((token) => token.toSnapshot().familyId),
    );

    // Cerrar sesión en el teléfono no tiene por qué echarte de la computadora.
    expect(familias.size).toBe(2);
  });
});
