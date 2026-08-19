import {
  ConflictError,
  PreconditionFailedError,
  UnauthenticatedError,
} from '../../shared/domain-error';

export class EmailAlreadyRegistered extends ConflictError {
  constructor() {
    super('email.already_registered', 'Ese correo ya tiene una cuenta.');
  }
}

/**
 * Un solo error para "no existe la cuenta" y para "la contraseña no es esa".
 * Distinguirlos le regala a cualquiera una forma de averiguar qué correos
 * están registrados.
 */
export class InvalidCredentials extends UnauthenticatedError {
  constructor() {
    super('auth.invalid_credentials', 'Correo o contraseña incorrectos.');
  }
}

export class SessionExpired extends UnauthenticatedError {
  constructor() {
    super('auth.session_expired', 'Tu sesión venció, vuelve a entrar.');
  }
}

/**
 * Se detectó un token de refresco reutilizado y se cortó la familia entera.
 *
 * Hacia afuera es idéntico a una sesión vencida —mismo código, mismo texto—
 * porque un código propio le confirmaría a quien robó el token que lo
 * descubrimos, y le diría exactamente cuándo dejar de usarlo. La distinción
 * existe solo del lado del servidor: `name` la conserva para el log y para los
 * tests, y nunca sale en la respuesta.
 */
export class SessionCompromised extends SessionExpired {}

export class VerificationLinkInvalid extends PreconditionFailedError {
  constructor() {
    super('email.verification_invalid', 'Ese enlace ya no sirve. Pide uno nuevo.');
  }
}

/**
 * El enlace para restablecer la contraseña no sirve.
 *
 * Uno inexistente, uno vencido y uno ya usado responden exactamente lo mismo,
 * por la misma razón que los códigos de vinculación: separarlos permitiría
 * probar enlaces a ciegas y saber cuáles existieron.
 */
export class ResetLinkInvalid extends PreconditionFailedError {
  constructor() {
    super('password.reset_invalid', 'Ese enlace ya no sirve. Pide uno nuevo.');
  }
}

/** La contraseña actual que se escribió para cambiarla no es la que hay. */
export class CurrentPasswordWrong extends PreconditionFailedError {
  constructor() {
    super('password.current_wrong', 'Esa no es tu contraseña actual.');
  }
}

/**
 * Quien administra intentó dejarse a sí mismo fuera.
 *
 * Vale también para el sistema entero: si se pudiera quitar al último
 * administrador, no quedaría nadie que pueda crear cuentas ni devolver el
 * acceso a nadie, y la única salida sería entrar a la base a mano.
 */
export class AdminCannotBeRemoved extends PreconditionFailedError {
  constructor(reason: string) {
    super('admin.cannot_be_removed', reason);
  }
}
