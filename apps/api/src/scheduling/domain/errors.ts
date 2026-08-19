import { NotFoundError, PreconditionFailedError } from '../../shared/domain-error';

export class ScheduleNotFound extends NotFoundError {
  constructor() {
    super('el horario', 'schedule.not_found');
  }
}

/**
 * Se pidió programar hacia un destinatario que todavía no apretó Empezar.
 *
 * Dejarlo pasar sería aceptar un horario que no puede enviar nada: el bot no
 * tiene permiso para escribirle hasta que esa persona actúe.
 */
export class RecipientNotLinked extends PreconditionFailedError {
  constructor() {
    super('schedule.recipient_not_linked', 'Ese destinatario todavía no abrió su enlace.');
  }
}

/**
 * Esa biblioteca no le manda nada a ese destinatario.
 *
 * No es un error de permisos ni de propiedad —los dos son de la misma cuenta—
 * sino una decisión que el dueño tomó en la biblioteca y que el horario no
 * puede saltarse por la puerta de atrás.
 */
export class RecipientNotInLibrary extends PreconditionFailedError {
  constructor() {
    super(
      'schedule.recipient_not_in_library',
      'Esa biblioteca no tiene a ese destinatario. Agrégalo desde la biblioteca.',
    );
  }
}

/** La regla no vuelve a repetirse nunca: un horario así no dispararía jamás. */
export class ScheduleNeverRuns extends PreconditionFailedError {
  constructor() {
    super('schedule.never_runs', 'Esa repetición no vuelve a ocurrir.');
  }
}
