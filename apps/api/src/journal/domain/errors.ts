import { NotFoundError, PreconditionFailedError } from '../../shared/domain-error';

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
