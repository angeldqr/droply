import { NotFoundError, PreconditionFailedError } from '../../shared/domain-error';

/** Un destinatario ajeno responde igual que uno inexistente. */
export class RecipientNotFound extends NotFoundError {
  constructor() {
    super('el destinatario', 'recipient.not_found');
  }
}

/**
 * El código no existe, ya se usó o venció. Los tres casos responden lo mismo:
 * distinguirlos permitiría probar códigos a ciegas y saber cuáles existen.
 */
export class LinkCodeInvalid extends PreconditionFailedError {
  constructor() {
    super('recipient.link_code_invalid', 'Ese enlace ya no sirve. Pide uno nuevo.');
  }
}

/**
 * Sin correo verificado no se crean destinatarios.
 *
 * Es lo único que separa esta aplicación de una máquina de mandar mensajes a
 * desconocidos desde cuentas desechables. Armar bibliotecas sin verificar sí se
 * permite: ahí no sale nada hacia afuera.
 */
export class AccountNotVerified extends PreconditionFailedError {
  constructor() {
    super('recipient.account_not_verified', 'Confirma tu correo antes de agregar destinatarios.');
  }
}

/**
 * Ese chat ya recibe envíos de esta misma cuenta, con otra etiqueta.
 *
 * Sin esto, el índice único saltaba dentro del repositorio y salía como 500,
 * que es justo lo que hace que Telegram reintente la misma entrega durante
 * horas. No es un error de nadie: es alguien que abrió dos enlaces del mismo
 * remitente, y se le dice tal cual.
 */
export class ChatAlreadyLinked extends PreconditionFailedError {
  constructor() {
    super('recipient.chat_already_linked', 'Ese chat ya recibe envíos de esta cuenta.');
  }
}

/** Ya está vinculado: pedir un enlace nuevo no tendría a quién llevar. */
export class RecipientAlreadyLinked extends PreconditionFailedError {
  constructor() {
    super('recipient.already_linked', 'Este destinatario ya está vinculado.');
  }
}
