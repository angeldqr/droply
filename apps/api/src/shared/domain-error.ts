/**
 * Errores que el dominio sabe nombrar. No conocen HTTP: la traducción a un
 * código de estado la hace `platform/http/domain-error.filter.ts`.
 */
export type DomainErrorKind =
  | 'not_found'
  | 'conflict'
  | 'invalid_input'
  /** No quedó probado quién sos: falta la credencial o venció. */
  | 'unauthenticated'
  /** Sé quién sos, pero esto no es tuyo. */
  | 'forbidden'
  | 'precondition_failed';

export class DomainError extends Error {
  readonly kind: DomainErrorKind;
  /** Identificador estable que el front puede usar para traducir el mensaje. */
  readonly code: string;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    kind: DomainErrorKind,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.kind = kind;
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, code = `${resource}.not_found`) {
    super('not_found', code, `No se encontró ${resource}.`);
  }
}

export class ConflictError extends DomainError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super('conflict', code, message, details);
  }
}

export class InvalidInputError extends DomainError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super('invalid_input', code, message, details);
  }
}

export class UnauthenticatedError extends DomainError {
  constructor(code: string, message: string) {
    super('unauthenticated', code, message);
  }
}

export class ForbiddenError extends DomainError {
  constructor(code = 'forbidden', message = 'No tenés acceso a este recurso.') {
    super('forbidden', code, message);
  }
}

export class PreconditionFailedError extends DomainError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super('precondition_failed', code, message, details);
  }
}
