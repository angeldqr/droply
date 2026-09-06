import type { Clock } from '../../shared/clock';
import type { HabitVote, HabitVoteOutcome, HabitVoteSink } from '../../shared/habit-vote-sink';
import type { DayCalendar, HabitPlanRepository, ResponseStore } from '../domain/ports';

/**
 * Anota la respuesta que llega de un botón.
 *
 * Es lo que hay del otro lado del sumidero: `recipients` recibe el toque y
 * traduce lo que manda Telegram, pero no sabe nada de planes; acá se decide si
 * cuenta y se guarda.
 *
 * Tres cosas tienen que darse, y las tres se comprueban acá y no en quien
 * llama:
 *
 * 1. Que el envío sea de un plan **vivo**. Un plan anulado o terminado deja
 *    botones dando vueltas en el chat de la gente: siguen ahí y hay que
 *    ignorarlos.
 * 2. Que el toque venga del chat de ese destinatario. El `callback_data` viaja
 *    por un canal público y lleva un identificador adivinable; sin esta
 *    comprobación, cualquiera que hablara con el bot podría votar por otro.
 * 3. Que el día **del envío** no haya cerrado ya.
 */
export class CastHabitVote implements HabitVoteSink {
  constructor(
    private readonly plans: HabitPlanRepository,
    private readonly responses: ResponseStore,
    private readonly calendar: DayCalendar,
    private readonly clock: Clock,
  ) {}

  async cast(vote: HabitVote): Promise<HabitVoteOutcome> {
    const found = await this.plans.findActiveForDelivery(vote.deliveryId);

    if (!found) return 'IGNORED';

    // El chat es la única prueba de quién está votando: el bot no tiene sesión.
    if (found.chatId === null || found.chatId !== vote.chatId) return 'IGNORED';

    /*
     * El día que decide es el del **envío**, no el del toque.
     *
     * Un envío de las once de la noche se contesta a menudo a la mañana
     * siguiente, y esa respuesta pertenece al día de ayer. Mirando el día del
     * toque, la comprobación no servía para nada —el cierre solo alcanza días
     * ya pasados, así que el día de hoy nunca está cerrado— y la respuesta
     * tardía se guardaba, contestaba «Anotado» y no se contaba jamás, porque el
     * día al que pertenecía ya estaba escrito.
     */
    const day = this.calendar.dayAt(found.occurredAt, found.plan.timezone);

    if (found.plan.isScored(day)) return 'CLOSED';

    const recorded = await this.responses.record({
      deliveryId: vote.deliveryId,
      planId: found.plan.id,
      libraryId: found.libraryId,
      answer: vote.answer,
      answeredAt: this.clock.now(),
    });

    // La clave primaria de la tabla es el envío: el segundo toque choca contra
    // el índice, y eso es lo que hace que una votación no se pueda cambiar.
    return recorded ? 'RECORDED' : 'ALREADY';
  }
}
