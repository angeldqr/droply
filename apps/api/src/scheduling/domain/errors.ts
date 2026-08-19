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

/**
 * Se quiso clavar un envío a una hora que queda fuera de la franja.
 *
 * La franja es una sola para todo lo que sale: si algo tiene que ir a las 5 de
 * la mañana, lo que se mueve es el inicio de la franja. Con dos nociones de
 * "cuándo envío" la pantalla dejaría de poder decir de un vistazo entre qué
 * horas llega algo.
 */
export class FixedItemOutsideWindow extends PreconditionFailedError {
  constructor() {
    super(
      'schedule.fixed_item_outside_window',
      'Esa hora queda fuera de la franja del horario. Amplía la franja o elige otra hora.',
    );
  }
}

/** El archivo que se quiso clavar no es de la biblioteca de ese horario. */
export class FixedItemNotInLibrary extends PreconditionFailedError {
  constructor() {
    super(
      'schedule.fixed_item_not_in_library',
      'Ese archivo no es de la biblioteca de este horario.',
    );
  }
}

/**
 * El archivo clavado no es de la columna que el horario filtra.
 *
 * Dejarlo pasar sería un horario que dice "solo videos" y manda un audio a las
 * 6: una de las dos cosas está mal y el usuario tiene que decir cuál.
 */
export class FixedItemKindFiltered extends PreconditionFailedError {
  constructor() {
    super(
      'schedule.fixed_item_kind_filtered',
      'Ese archivo no es de la columna que filtra este horario.',
    );
  }
}

/** La regla no vuelve a repetirse nunca: un horario así no dispararía jamás. */
export class ScheduleNeverRuns extends PreconditionFailedError {
  constructor() {
    super('schedule.never_runs', 'Esa repetición no vuelve a ocurrir.');
  }
}
