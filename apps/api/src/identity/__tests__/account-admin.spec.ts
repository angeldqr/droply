import { describe, expect, it } from 'vitest';
import { UserId } from '../../shared/identifiers';
import { buildIdentity, validRegistration } from './support';

type World = ReturnType<typeof buildIdentity>;

/**
 * Crea una cuenta, y la asciende si hace falta.
 *
 * El registro no admite rol a propósito —no hay ruta que ascienda a nadie, solo
 * el arranque con `ADMIN_EMAIL`—, así que acá se hace igual que allá: se crea y
 * se promueve.
 */
async function crear(
  world: World,
  input: { email: string; displayName: string; role?: 'ADMIN' },
): Promise<UserId> {
  const created = await world.register.execute({
    ...validRegistration,
    email: input.email,
    displayName: input.displayName,
  });

  if (!created.ok) throw new Error(`no se creó ${input.email}`);

  const id = UserId.from(created.value.userId);

  if (input.role === 'ADMIN') {
    const user = await world.users.findById(id);

    if (!user) throw new Error('se perdió la cuenta recién creada');

    user.promoteToAdmin();
    await world.users.save(user);
  }

  return id;
}

/** Un administrador y una cuenta normal, que es el reparto de siempre. */
async function build() {
  const world = buildIdentity();
  const adminId = await crear(world, {
    email: 'admin@ejemplo.com',
    displayName: 'Admin',
    role: 'ADMIN',
  });
  const anaId = await crear(world, { email: 'ana@ejemplo.com', displayName: 'Ana' });

  return { world, adminId, anaId };
}

describe('restablecer la contraseña de una cuenta', () => {
  it('devuelve una contraseña que sirve para entrar', async () => {
    const { world, anaId } = await build();

    const result = await world.resetAccountPassword.execute(anaId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Es lo único que hace útil a esta ruta: quien administra dicta esa
    // contraseña y su dueño entra con ella.
    const entrada = await world.login.execute({
      email: 'ana@ejemplo.com',
      password: result.value.password,
    });

    expect(entrada.ok).toBe(true);
    expect(result.value.password.length).toBe(18);
  });

  it('la contraseña vieja deja de valer', async () => {
    const { world, anaId } = await build();

    await world.resetAccountPassword.execute(anaId);

    const entrada = await world.login.execute({
      email: 'ana@ejemplo.com',
      password: validRegistration.password,
    });

    expect(entrada.ok).toBe(false);
  });
});

describe('cortarle el acceso a una cuenta', () => {
  it('desactivada no puede entrar, y responde como una contraseña incorrecta', async () => {
    const { world, adminId, anaId } = await build();

    expect((await world.setAccountActive.execute(adminId, anaId, false)).ok).toBe(true);

    const entrada = await world.login.execute({
      email: 'ana@ejemplo.com',
      password: validRegistration.password,
    });

    expect(entrada.ok).toBe(false);
    if (!entrada.ok) expect(entrada.error.code).toBe('auth.invalid_credentials');
  });

  it('reactivada vuelve a entrar con lo de siempre', async () => {
    const { world, adminId, anaId } = await build();

    await world.setAccountActive.execute(adminId, anaId, false);
    await world.setAccountActive.execute(adminId, anaId, true);

    const entrada = await world.login.execute({
      email: 'ana@ejemplo.com',
      password: validRegistration.password,
    });

    expect(entrada.ok).toBe(true);
  });

  it('desactivar cierra sus sesiones abiertas', async () => {
    const { world, adminId, anaId } = await build();
    const session = await world.login.execute({
      email: 'ana@ejemplo.com',
      password: validRegistration.password,
    });

    if (!session.ok) throw new Error('no se abrió la sesión');

    await world.setAccountActive.execute(adminId, anaId, false);

    // Sin esto seguiría dentro hasta que venciera su token, o sea días.
    expect((await world.refresh.execute(session.value.session.refreshToken)).ok).toBe(false);
  });

  it('una cuenta desactivada tampoco recibe enlace para recuperar', async () => {
    const { world, adminId, anaId } = await build();

    await world.setAccountActive.execute(adminId, anaId, false);
    await world.requestReset.execute('ana@ejemplo.com');

    expect(world.mailer.resets).toHaveLength(0);
  });
});

describe('borrar una cuenta', () => {
  it('la borra y vacía su almacenamiento', async () => {
    const { world, adminId, anaId } = await build();

    expect((await world.deleteAccount.execute(adminId, anaId)).ok).toBe(true);
    expect(await world.users.findById(anaId)).toBeNull();

    // Las filas se van por cascada, pero los objetos del bucket no los borra
    // nadie: sin esto, una cuenta borrada dejaría sus fotos ahí.
    expect(world.storage.emptied).toEqual([anaId]);
  });
});

/**
 * Las tres guardas que impiden que el sistema se quede sin quien lo administre.
 * Sin ellas, un clic distraído deja a todos fuera y la única salida es entrar a
 * la base a mano.
 */
describe('nadie deja el sistema sin administrador', () => {
  it('un administrador no se borra a sí mismo', async () => {
    const { world, adminId } = await build();

    const result = await world.deleteAccount.execute(adminId, adminId);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('admin.cannot_be_removed');
    expect(await world.users.findById(adminId)).not.toBeNull();
  });

  it('un administrador no se desactiva a sí mismo', async () => {
    const { world, adminId } = await build();

    const result = await world.setAccountActive.execute(adminId, adminId, false);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('admin.cannot_be_removed');
  });

  it('no se puede borrar al último administrador', async () => {
    const { world, adminId } = await build();
    const otroAdmin = await crear(world, {
      email: 'otro@ejemplo.com',
      displayName: 'Otro',
      role: 'ADMIN',
    });

    // Con dos, se puede borrar a uno.
    expect((await world.deleteAccount.execute(adminId, otroAdmin)).ok).toBe(true);

    // Con uno solo, ya no: quedaría nadie que pueda crear cuentas.
    const solo = await world.deleteAccount.execute(otroAdmin, adminId);

    expect(solo.ok).toBe(false);
  });

  it('no se puede desactivar al último que puede entrar', async () => {
    const { world, adminId } = await build();
    const otroAdmin = await crear(world, {
      email: 'otro@ejemplo.com',
      displayName: 'Otro',
      role: 'ADMIN',
    });

    // Con dos activos, desactivar a uno se puede.
    expect((await world.setAccountActive.execute(otroAdmin, adminId, false)).ok).toBe(true);

    /*
     * Y acá está la trampa: contar por rol daría dos y dejaría pasar esto,
     * dejando el sistema con dos administradores y ninguno capaz de entrar.
     */
    const solo = await world.setAccountActive.execute(adminId, otroAdmin, false);

    expect(solo.ok).toBe(false);
    if (!solo.ok) expect(solo.error.code).toBe('admin.cannot_be_removed');
  });

  it('borrar a un administrador ya desactivado sí se puede', async () => {
    const { world, adminId } = await build();
    const otroAdmin = await crear(world, {
      email: 'otro@ejemplo.com',
      displayName: 'Otro',
      role: 'ADMIN',
    });

    await world.setAccountActive.execute(adminId, otroAdmin, false);

    // No cambia cuántos pueden entrar, así que no hay nada que proteger.
    expect((await world.deleteAccount.execute(adminId, otroAdmin)).ok).toBe(true);
  });
});
