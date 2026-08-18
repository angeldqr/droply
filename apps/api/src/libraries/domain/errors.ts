import {
  InvalidInputError,
  NotFoundError,
  PreconditionFailedError,
} from '../../shared/domain-error';

/**
 * Una biblioteca ajena responde igual que una inexistente. Distinguirlas
 * confirmaría que ese identificador existe y es de otra persona.
 */
export class LibraryNotFound extends NotFoundError {
  constructor() {
    super('la biblioteca', 'library.not_found');
  }
}

/**
 * El baúl no es una biblioteca que el usuario haya creado: no se renombra ni se
 * borra. Vaciarlo, en cambio, es quitar sus elementos uno a uno, como en
 * cualquier otra.
 */
export class VaultNotEditable extends PreconditionFailedError {
  constructor() {
    super('library.vault_not_editable', 'El baúl no se puede renombrar ni borrar.');
  }
}

export class ItemNotFound extends NotFoundError {
  constructor() {
    super('el elemento', 'item.not_found');
  }
}

/**
 * Los dos vecinos indicados no dejan hueco donde ubicar el elemento, ni
 * siquiera después de repartir posiciones nuevas. Pasa si son el mismo, que es
 * lo que el esquema ya rechaza antes de llegar acá.
 */
export class ItemMoveImpossible extends PreconditionFailedError {
  constructor() {
    super('item.move_impossible', 'No hay lugar entre esos dos elementos.');
  }
}

/**
 * Se pidió confirmar una subida que nunca llegó al almacenamiento. Pasa si el
 * navegador se cayó a mitad de camino.
 */
export class MediaNotUploaded extends PreconditionFailedError {
  constructor() {
    super('item.media_not_uploaded', 'El archivo todavía no terminó de subir.');
  }
}

/**
 * Los bytes que llegaron no son del tipo que el navegador declaró. Renombrar un
 * archivo cambia lo que dice ser, no lo que es.
 */
export class MediaTypeMismatch extends InvalidInputError {
  constructor() {
    super('item.media_type_mismatch', 'Ese archivo no es del tipo que dice ser.');
  }
}

/** El archivo que llegó pesa más de lo que la columna admite. */
export class MediaTooLarge extends InvalidInputError {
  constructor() {
    super('item.media_too_large', 'El archivo no entra en esta columna.');
  }
}
