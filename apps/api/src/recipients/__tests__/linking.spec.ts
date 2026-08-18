import { describe, expect, it } from 'vitest';
import { RecipientId } from '../../shared/identifiers';
import { ana, beto, buildRecipients } from './support';

const UN_DIA = 24 * 60 * 60 * 1000;

type World = ReturnType<typeof buildRecipients>;

async function conDestinatario(world: World, label = 'Mamá') {
  const created = await world.create.execute(ana, label);

  if (!created.ok) throw new Error('no se creó el destinatario');

  return created.value;
}

describe('destinatarios y vinculación', () => {
  it('no deja crear destinatarios sin el correo confirmado', async () => {
    const world = buildRecipients();

    const created = await world.create.execute(beto, 'Mamá');

    expect(created.ok).toBe(false);
    expect(world.recipients.rows.size).toBe(0);
  });

  it('nace pendiente y con un código que solo se ve al crearlo', async () => {
    const world = buildRecipients();
    const { recipient, code } = await conDestinatario(world);

    expect(recipient.isLinked).toBe(false);
    expect(recipient.externalId).toBeNull();
    expect(code).not.toHaveLength(0);
    // Lo que queda guardado es el hash, nunca el valor.
    expect(recipient.toSnapshot().linkCodeHash).not.toBe(code);
  });

  it('queda vinculado cuando alguien abre el enlace y aprieta empezar', async () => {
    const world = buildRecipients();
    const { recipient, code } = await conDestinatario(world);

    await world.handle.execute({ chatId: '99887766', text: `/start ${code}` });

    const stored = world.recipients.rows.get(recipient.id);

    expect(stored?.isLinked).toBe(true);
    expect(stored?.externalId).toBe('99887766');
    // Y se le contesta a ese mismo chat, no a otro.
    expect(world.channel.sent).toHaveLength(1);
    expect(world.channel.sent[0]?.externalId).toBe('99887766');
  });

  it('quema el código: el mismo enlace no vincula un segundo chat', async () => {
    const world = buildRecipients();
    const { code } = await conDestinatario(world);

    await world.handle.execute({ chatId: '111', text: `/start ${code}` });
    const second = await world.link.execute(code, '222');

    expect(second.ok).toBe(false);
  });

  it('rechaza un código vencido', async () => {
    const world = buildRecipients();
    const { code } = await conDestinatario(world);

    world.clock.advanceBy(UN_DIA + 1000);

    expect((await world.link.execute(code, '111')).ok).toBe(false);
  });

  it('rechaza un código que no existe', async () => {
    const world = buildRecipients();

    expect((await world.link.execute('inventado', '111')).ok).toBe(false);
  });

  it('un enlace nuevo invalida el anterior', async () => {
    const world = buildRecipients();
    const { recipient, code } = await conDestinatario(world);

    const reissued = await world.relink.execute(ana, recipient.id);

    expect(reissued.ok).toBe(true);
    if (!reissued.ok) return;

    expect((await world.link.execute(code, '111')).ok).toBe(false);
    expect((await world.link.execute(reissued.value.code, '111')).ok).toBe(true);
  });

  it('no genera enlaces para uno ya vinculado', async () => {
    const world = buildRecipients();
    const { recipient, code } = await conDestinatario(world);

    await world.link.execute(code, '111');

    expect((await world.relink.execute(ana, recipient.id)).ok).toBe(false);
  });

  it('el destinatario de otra cuenta responde igual que uno inexistente', async () => {
    const world = buildRecipients();
    const { recipient } = await conDestinatario(world);

    const foreign = await world.relink.execute(beto, recipient.id);
    const missing = await world.relink.execute(
      beto,
      RecipientId.from('00000000-0000-4000-8000-0000000000ff'),
    );

    expect(foreign.ok).toBe(false);
    expect(missing.ok).toBe(false);
    if (foreign.ok || missing.ok) return;

    expect(foreign.error.code).toBe(missing.error.code);

    // Y no lo borra tampoco.
    expect((await world.remove.execute(beto, recipient.id)).ok).toBe(false);
    expect(world.recipients.rows.has(recipient.id)).toBe(true);
  });

  it('no deja pedir un enlace nuevo sin el correo confirmado', async () => {
    const world = buildRecipients();
    const { recipient } = await conDestinatario(world);

    // La cuenta pierde la verificación entre una cosa y la otra.
    world.accounts.verified.delete(ana);

    expect((await world.relink.execute(ana, recipient.id)).ok).toBe(false);
  });

  it('un chat que ya recibe de esta cuenta no revienta al abrir otro enlace', async () => {
    const world = buildRecipients();
    const primero = await conDestinatario(world, 'Mamá');
    const segundo = await conDestinatario(world, 'Mamá otra vez');

    await world.handle.execute({ chatId: '555', text: `/start ${primero.code}` });
    await world.handle.execute({ chatId: '555', text: `/start ${segundo.code}` });

    // El segundo queda sin vincular, pero se le contesta y no se cae nada: un
    // fallo acá saldría como 500 y Telegram reintentaría durante horas.
    expect(world.recipients.rows.get(segundo.recipient.id)?.isLinked).toBe(false);
    expect(world.channel.sent).toHaveLength(2);
    expect(world.channel.sent[1]?.text).toContain('Ya estás recibiendo');
  });

  it('a quien escribe sin código le explica qué hacer, sin vincular nada', async () => {
    const world = buildRecipients();
    await conDestinatario(world);

    await world.handle.execute({ chatId: '111', text: 'hola' });
    await world.handle.execute({ chatId: '111', text: '/start' });

    expect(world.channel.sent).toHaveLength(2);
    expect([...world.recipients.rows.values()].every((row) => !row.isLinked)).toBe(true);
  });
});
