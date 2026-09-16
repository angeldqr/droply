import { beforeEach, describe, expect, it } from 'vitest';
import { LINK_CODE_TTL_MS } from '../domain/account-chat';
import { ANA, BETO, CHAT, build, type World } from './support';

let world: World;

beforeEach(() => {
  world = build();
});

async function unEnlace(owner = ANA): Promise<string> {
  const issued = await world.issueLink.execute(owner);

  if (!issued.ok) throw issued.error;

  return issued.value.code;
}

describe('conectar el Telegram de la cuenta', () => {
  it('vincula al abrir el enlace y lo dice', async () => {
    const code = await unEnlace();

    expect(await world.bot.handle({ chatId: CHAT, text: `/start ${code}` })).toBe(true);
    expect(world.voice.last()).toContain('ya estás conectado');
    expect((await world.readLink.execute(ANA)).linked).toBe(true);
  });

  /*
   * Es la mitad del contrato con `recipients`: un código que no es de ninguna
   * cuenta se deja pasar **sin decir nada**, y el flujo de los destinatarios lo
   * atiende. Contestar acá convertiría el bot en un oráculo para probar códigos
   * a ciegas.
   */
  it('un código que no es suyo se deja pasar en silencio', async () => {
    expect(await world.bot.handle({ chatId: CHAT, text: '/start codigo-de-un-destinatario' })).toBe(
      false,
    );
    expect(world.voice.said).toHaveLength(0);
  });

  it('quema el código: el mismo enlace no vincula un segundo chat', async () => {
    const code = await unEnlace();

    await world.bot.handle({ chatId: CHAT, text: `/start ${code}` });

    expect(await world.bot.handle({ chatId: '777', text: `/start ${code}` })).toBe(false);
    expect((await world.chats.find(ANA))?.chatId).toBe(CHAT);
  });

  it('rechaza un código vencido', async () => {
    const code = await unEnlace();

    world.clock.advanceBy(LINK_CODE_TTL_MS + 1000);

    expect(await world.bot.handle({ chatId: CHAT, text: `/start ${code}` })).toBe(false);
    expect((await world.readLink.execute(ANA)).linked).toBe(false);
  });

  it('un enlace nuevo invalida el anterior', async () => {
    const primero = await unEnlace();
    const segundo = await unEnlace();

    expect(await world.bot.handle({ chatId: CHAT, text: `/start ${primero}` })).toBe(false);

    await world.bot.handle({ chatId: CHAT, text: `/start ${segundo}` });

    expect((await world.readLink.execute(ANA)).linked).toBe(true);
  });

  /*
   * Un chat resuelve a una sola cuenta, y de ahí sale toda la seguridad de
   * `/habits`. Sin esto, dos cuentas se pelearían por el mismo chat y el bot no
   * sabría de quién son los hábitos que está enseñando.
   */
  it('no deja robarle el chat a otra cuenta', async () => {
    await world.bot.handle({ chatId: CHAT, text: `/start ${await unEnlace(ANA)}` });

    const deBeto = await unEnlace(BETO);

    expect(await world.bot.handle({ chatId: CHAT, text: `/start ${deBeto}` })).toBe(true);
    expect(world.voice.last()).toContain('ya está conectado a otra cuenta');
    expect((await world.readLink.execute(BETO)).linked).toBe(false);
    expect((await world.chats.find(ANA))?.chatId).toBe(CHAT);
  });

  it('pedir un enlace nuevo suelta el chat de antes, para poder cambiar de teléfono', async () => {
    await world.bot.handle({ chatId: CHAT, text: `/start ${await unEnlace()}` });

    const nuevo = await unEnlace();

    expect((await world.readLink.execute(ANA)).linked).toBe(false);

    await world.bot.handle({ chatId: '888', text: `/start ${nuevo}` });

    expect((await world.chats.find(ANA))?.chatId).toBe('888');
  });

  it('desconectar deja la cuenta sin chat', async () => {
    await world.bot.handle({ chatId: CHAT, text: `/start ${await unEnlace()}` });
    await world.unlink.execute(ANA);

    expect((await world.readLink.execute(ANA)).linked).toBe(false);
    expect(await world.bot.handle({ chatId: CHAT, text: '/habits' })).toBe(false);
  });

  it('sin el correo confirmado no hay enlace', async () => {
    world.accounts.verified.delete(ANA);

    const issued = await world.issueLink.execute(ANA);

    expect(issued.ok ? '' : issued.error.code).toBe('account_chat.email_not_verified');
  });
});
