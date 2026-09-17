import {
  ENTRY_IDLE_MINUTES,
  JOURNAL_COMMAND,
  JOURNAL_TODAY_COMMAND,
  MEDIA_LIMITS,
  ENTRY_NOTE_MAX_LENGTH,
  ENTRY_PHOTOS_MAX,
  HABIT_NAME_MAX_LENGTH,
  HABITS_MAX,
} from '@reconectate/contracts';
import { describe, expect, it } from 'vitest';
import {
  CALLBACK_DATA_MAX_BYTES,
  COMMAND,
  TODAY_COMMAND,
  doneButton,
  moveButton,
  offerMoveButton,
  parseChatAction,
  pickButton,
} from './chat-actions';
import { IDLE_MINUTES, NOTE_MAX_LENGTH, PHOTO_MAX_BYTES, PHOTO_TYPES, PHOTOS_MAX } from './entry';
import { MAX_PER_ACCOUNT, NAME_MAX_LENGTH } from './habit';

/**
 * Los topes están escritos dos veces y tienen que decir lo mismo.
 *
 * El núcleo no puede importar `@reconectate/contracts`, así que el dominio lleva
 * su copia y el contrato la suya —la que la pantalla usa para poner el
 * `maxLength` de los campos—. Si se separan, el usuario escribe algo que la
 * pantalla acepta y el servidor rechaza, y el fallo aparece en un formulario
 * que se veía bien.
 *
 * Es el mismo guardián que ya tienen `libraries` y `habits`.
 */
describe('topes de la bitácora frente al contrato', () => {
  it('coincide el largo del nombre de un hábito', () => {
    expect(NAME_MAX_LENGTH).toBe(HABIT_NAME_MAX_LENGTH);
  });

  it('coinciden cuántos hábitos caben', () => {
    expect(MAX_PER_ACCOUNT).toBe(HABITS_MAX);
  });

  it('coincide lo que cabe en una anotación', () => {
    expect(NOTE_MAX_LENGTH).toBe(ENTRY_NOTE_MAX_LENGTH);
    expect(PHOTOS_MAX).toBe(ENTRY_PHOTOS_MAX);
  });

  it('coincide cuánto aguanta abierta', () => {
    expect(IDLE_MINUTES).toBe(ENTRY_IDLE_MINUTES);
  });

  /*
   * El comando está escrito tres veces: acá, en el contrato y en el menú que el
   * bot publica al arrancar. Si se separan, Telegram ofrece uno que el bot no
   * atiende, y quien lo toque recibe la explicación de los destinatarios.
   */
  it('coincide el comando que abre la bitácora', () => {
    expect(COMMAND).toBe(JOURNAL_COMMAND);
    expect(TODAY_COMMAND).toBe(JOURNAL_TODAY_COMMAND);
  });

  /*
   * Las fotos van al mismo bucket que las imágenes de una biblioteca, así que
   * comparten techo. El GIF se queda fuera a propósito: Telegram lo manda como
   * animación y no como foto.
   */
  it('los tipos de foto son los del contrato, menos el GIF', () => {
    expect(PHOTO_TYPES).toEqual(
      MEDIA_LIMITS.IMAGE.mimeTypes.filter((type) => type !== 'image/gif'),
    );
    expect(PHOTO_MAX_BYTES).toBe(MEDIA_LIMITS.IMAGE.maxBytes);
  });
});

/**
 * Telegram corta el `callback_data` en 64 bytes **sin avisar**: manda el botón
 * igual y el toque vuelve mutilado. Es de los fallos que no dejan rastro.
 */
describe('lo que cabe en un botón', () => {
  it('el de un hábito cabe, con el nombre más largo posible', () => {
    const boton = pickButton(
      20,
      'x'.repeat(NAME_MAX_LENGTH),
      'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    );

    expect(Buffer.byteLength(boton.data, 'utf8')).toBeLessThanOrEqual(CALLBACK_DATA_MAX_BYTES);
  });

  it('el de cerrar y los de mover también', () => {
    const uuid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

    for (const boton of [doneButton(), offerMoveButton(), moveButton(20, 'x', uuid)]) {
      expect(Buffer.byteLength(boton.data, 'utf8')).toBeLessThanOrEqual(CALLBACK_DATA_MAX_BYTES);
    }
  });

  it('cada botón vuelve como la acción que representa', () => {
    const uuid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

    expect(parseChatAction(pickButton(1, 'x', uuid).data)).toEqual({ kind: 'PICK', habitId: uuid });
    expect(parseChatAction(moveButton(1, 'x', uuid).data)).toEqual({ kind: 'MOVE', habitId: uuid });
    expect(parseChatAction(offerMoveButton().data)).toEqual({ kind: 'OFFER_MOVE' });
    expect(parseChatAction('j:m:no-es-un-uuid')).toBeNull();
  });
});
