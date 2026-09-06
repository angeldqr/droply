import { NotFoundError, PreconditionFailedError } from '../../shared/domain-error';

export class HabitPlanNotFound extends NotFoundError {
  constructor() {
    super('el plan de hábitos', 'habit_plan.not_found');
  }
}

/**
 * Se quiso armar un plan hacia alguien que todavía no apretó Empezar.
 *
 * Sin `chat_id` no hay a dónde mandar los botones ni el informe del final, así
 * que el plan nacería mudo. Se dice ahora y no cuando el informe no llegue.
 */
export class RecipientNotLinked extends PreconditionFailedError {
  constructor() {
    super('habit_plan.recipient_not_linked', 'Ese destinatario todavía no abrió su enlace.');
  }
}

/**
 * Esa biblioteca ya está en otro plan vivo.
 *
 * Un envío no puede contar para dos planes: llegaría con dos juegos de botones
 * y la respuesta no sabría a cuál pertenece. Anular el otro plan la libera.
 */
export class LibraryAlreadyInPlan extends PreconditionFailedError {
  constructor(label: string) {
    super(
      'habit_plan.library_already_in_plan',
      `«${label}» ya está en otro plan de hábitos. Anúlalo o elige otra biblioteca.`,
    );
  }
}

/** Una de las bibliotecas elegidas no es de esta cuenta, o ya no existe. */
export class LibraryNotAvailable extends PreconditionFailedError {
  constructor() {
    super(
      'habit_plan.library_not_available',
      'Alguna de esas bibliotecas ya no está disponible. Vuelve a elegirlas.',
    );
  }
}

/**
 * El baúl no puede ser un hábito.
 *
 * Es personal y no sale hacia nadie, así que un plan armado sobre él no
 * recibiría jamás una respuesta y se quedaría en cero los treinta días.
 */
export class VaultIsNotAHabit extends PreconditionFailedError {
  constructor() {
    super(
      'habit_plan.vault_is_not_a_habit',
      'El baúl no puede ser un hábito: no sale hacia nadie.',
    );
  }
}

/**
 * Se quiso tocar un plan que ya no está en marcha.
 *
 * Cubre las dos formas de llegar tarde: anular algo ya anulado y anular algo ya
 * cerrado. En los dos casos la respuesta correcta es la misma —no hay nada que
 * cambiar— y distinguirlas solo daría dos mensajes para el mismo callejón.
 */
export class HabitPlanNotActive extends PreconditionFailedError {
  constructor() {
    super('habit_plan.not_active', 'Ese plan ya no está en marcha.');
  }
}

/** Se pidió reenviar el informe de un plan que todavía no terminó. */
export class HabitPlanNotClosed extends PreconditionFailedError {
  constructor() {
    super(
      'habit_plan.not_closed',
      'El informe se manda cuando el plan termina. Este todavía está en marcha.',
    );
  }
}
