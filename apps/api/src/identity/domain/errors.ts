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
    super('auth.session_expired', 'Tu sesión venció, volvé a entrar.');
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
    super('email.verification_invalid', 'Ese enlace ya no sirve. Pedí uno nuevo.');
  }
}
