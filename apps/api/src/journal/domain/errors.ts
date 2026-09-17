import {
  InvalidInputError,
  NotFoundError,
  PreconditionFailedError,
} from '../../shared/domain-error';

export class HabitNotFound extends NotFoundError {
  constructor() {
    super('el hábito', 'habit.not_found');
  }
}

export class EntryNotFound extends NotFoundError {
  constructor() {
    super('la anotación', 'habit_entry.not_found');
  }
}

export class HabitAlreadyPaused extends PreconditionFailedError {
  constructor() {
    super('habit.already_paused', 'Ese hábito ya está en pausa.');
  }
}

export class HabitNotPaused extends PreconditionFailedError {
  constructor() {
    super('habit.not_paused', 'Ese hábito no está en pausa.');
  }
}

/** Se quiso correr una anotación a un día que todavía no llegó. */
export class DayInTheFuture extends InvalidInputError {
  constructor() {
    super('habit_entry.future_day', 'No puedes mover una anotación a un día que no ha llegado.');
  }
}

/** Se quiso anotar o mover algo a un hábito que está en pausa. */
export class HabitPaused extends PreconditionFailedError {
  constructor() {
    super('habit.paused', 'Ese hábito está en pausa. Reanúdalo para anotar ahí.');
  }
}

/** Se quiso corregir desde la pantalla una anotación que sigue viva en el chat. */
export class EntryStillOpen extends PreconditionFailedError {
  constructor() {
    super(
      'habit_entry.open',
      'Esa anotación sigue abierta en el chat: aprieta Listo y vuelve a intentarlo.',
    );
  }
}

/** La cuenta llegó al tope de hábitos. */
export class TooManyHabits extends PreconditionFailedError {
  constructor(max: number) {
    super('habit.too_many', `No puedes tener más de ${max} hábitos. Borra o archiva alguno.`);
  }
}

/**
 * Se pidió el enlace del chat sin tener el correo confirmado.
 *
 * Misma puerta que la de los destinatarios: vincular un chat es abrirle al bot
 * una vía hacia la cuenta, y eso no se le da a un correo sin verificar.
 */
export class EmailNotVerified extends PreconditionFailedError {
  constructor() {
    super('account_chat.email_not_verified', 'Confirma tu correo antes de conectar tu Telegram.');
  }
}

/** Ese chat ya es de otra cuenta. */
export class ChatTakenByAnotherAccount extends PreconditionFailedError {
  constructor() {
    super(
      'account_chat.taken',
      'Ese Telegram ya está conectado a otra cuenta. Desconéctalo ahí primero.',
    );
  }
}
