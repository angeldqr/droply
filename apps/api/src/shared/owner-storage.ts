/**
 * Borrar del almacenamiento todo lo de una cuenta.
 *
 * Vive en `shared` por lo mismo que `OccurrenceSink`: es la costura entre dos
 * contextos. `identity` es quien borra una cuenta, pero los archivos son de
 * `libraries`, y un contexto no puede importar el dominio de otro.
 *
 * La cascada de la base se lleva las filas sola; los objetos del bucket no los
 * borra nadie, y sin esto una cuenta borrada dejaría sus fotos y sus audios
 * ahí. Borrar tiene que borrar de verdad.
 *
 * Un solo prefijo alcanza porque la clave del objeto empieza por el dueño:
 * `ownerId/libraryId/itemId`.
 */
export interface OwnerStorage {
  removeAllOf(ownerId: string): Promise<void>;
}

export const OWNER_STORAGE = Symbol('OwnerStorage');
