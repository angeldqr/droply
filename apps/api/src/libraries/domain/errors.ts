import { NotFoundError, PreconditionFailedError } from '../../shared/domain-error';

/**
 * Una biblioteca ajena responde igual que una inexistente. Distinguirlas
 * confirmaría que ese identificador existe y es de otra persona.
 */
export class LibraryNotFound extends NotFoundError {
  constructor() {
    super('la biblioteca', 'library.not_found');
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
