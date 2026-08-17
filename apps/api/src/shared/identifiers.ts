declare const brand: unique symbol;

/**
 * Marca nominal sobre un tipo primitivo. Existe solo en tiempo de compilación:
 * en runtime un UserId sigue siendo un string.
 *
 * Sirve para que pasar un LibraryId donde se espera un RecipientId sea un error
 * de compilación y no un bug que aparece cuando alguien recibe el archivo
 * equivocado.
 */
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type UserId = Brand<string, 'UserId'>;
export type LibraryId = Brand<string, 'LibraryId'>;
export type LibraryItemId = Brand<string, 'LibraryItemId'>;
export type MediaAssetId = Brand<string, 'MediaAssetId'>;
export type RecipientId = Brand<string, 'RecipientId'>;
export type ScheduleId = Brand<string, 'ScheduleId'>;
export type DeliveryAttemptId = Brand<string, 'DeliveryAttemptId'>;

/** Cualquier UUID con versión y variante válidas, de la v1 a la v8. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Construye el conversor de un tipo de id. La validación de formato vive acá y
 * no repartida por los casos de uso.
 *
 * El nombre sale del propio parámetro de marca, así no hay forma de que el
 * mensaje de error diga un tipo y la firma diga otro.
 */
function identifier<B extends string, T extends Brand<string, B>>(label: B) {
  return {
    from(value: string): T {
      if (!UUID.test(value)) {
        throw new TypeError(`${label} inválido: se esperaba un UUID.`);
      }
      return value as T;
    },
    is(value: unknown): value is T {
      return typeof value === 'string' && UUID.test(value);
    },
  };
}

export const UserId = identifier<'UserId', UserId>('UserId');
export const LibraryId = identifier<'LibraryId', LibraryId>('LibraryId');
export const LibraryItemId = identifier<'LibraryItemId', LibraryItemId>('LibraryItemId');
export const MediaAssetId = identifier<'MediaAssetId', MediaAssetId>('MediaAssetId');
export const RecipientId = identifier<'RecipientId', RecipientId>('RecipientId');
export const ScheduleId = identifier<'ScheduleId', ScheduleId>('ScheduleId');
export const DeliveryAttemptId = identifier<'DeliveryAttemptId', DeliveryAttemptId>(
  'DeliveryAttemptId',
);

/**
 * El dominio no llama a `crypto` directamente: pide un id por acá, y así los
 * tests pueden fijar la secuencia y quedar deterministas.
 */
export interface IdGenerator {
  generate(): string;
}

export const ID_GENERATOR = Symbol('IdGenerator');
