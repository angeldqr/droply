import type {
  DeliveryLog,
  LibraryCatalog,
  MediaSource,
  MessageSender,
  ScheduleReader,
  SentBag,
} from '../domain/ports';
import { selectOne, type Randomness } from '../domain/selection';

/** Qué pasó con una ocurrencia, para que el latido lo deje en el log. */
export type DispatchOutcome =
  'SENT' | 'DUPLICATE' | 'NOTHING_TO_SEND' | 'NOT_LINKED' | 'FAILED' | 'GONE';

/**
 * Manda lo que le tocaba a un horario en un instante concreto.
 *
 * El orden de los pasos no es casual: **primero se anota el intento y después
 * se envía**. Si fuera al revés, un corte entre el envío y la anotación haría
 * que el reintento mandara lo mismo otra vez, y el destinatario recibiría dos
 * veces la misma foto. Anotando antes, el peor caso es un envío perdido, que se
 * nota mucho menos y se arregla solo en la siguiente ocurrencia.
 *
 * ponytail: no hay reintento con espera creciente. Un fallo pasajero se salta
 * esa ocurrencia y la siguiente vuelve a intentar; los que no se arreglan
 * solos, que son los que importan, ya apagan el horario. Un reintento de verdad
 * pide una cola, y eso entra cuando haya volumen que lo justifique.
 */
export class DispatchOccurrence {
  constructor(
    private readonly schedules: ScheduleReader,
    private readonly libraries: LibraryCatalog,
    private readonly bag: SentBag,
    private readonly media: MediaSource,
    private readonly sender: MessageSender,
    private readonly log: DeliveryLog,
    private readonly random: Randomness,
  ) {}

  async execute(
    scheduleId: string,
    occurredAt: Date,
    occurrenceKey: string,
  ): Promise<DispatchOutcome> {
    const target = await this.schedules.find(scheduleId);

    // Se borró entre que el tick lo tomó y llegamos acá.
    if (!target) return 'GONE';

    if (!target.chatId) {
      await this.record(occurrenceKey, scheduleId, null, occurredAt, 'SKIPPED', 'sin vincular');

      return 'NOT_LINKED';
    }

    const candidates = await this.libraries.candidatesOf(target, occurredAt);

    const sent = new Set(await this.bag.idsOf(scheduleId));
    const choice = selectOne(target.strategy, candidates, sent, this.random);

    if (!choice) {
      await this.record(occurrenceKey, scheduleId, null, occurredAt, 'SKIPPED', 'nada que enviar');

      return 'NOTHING_TO_SEND';
    }

    const payload = await this.libraries.payloadOf(choice.chosen.id);

    if (!payload) {
      await this.record(occurrenceKey, scheduleId, null, occurredAt, 'SKIPPED', 'nada que enviar');

      return 'NOTHING_TO_SEND';
    }

    // La anotación es la que reserva la ocurrencia. Si ya estaba, otra réplica
    // se nos adelantó y acá no se manda nada.
    const reserved = await this.record(
      occurrenceKey,
      scheduleId,
      payload.itemId,
      occurredAt,
      'SENT',
      null,
    );

    if (!reserved) return 'DUPLICATE';

    if (choice.resetBag) await this.bag.clear(scheduleId);
    await this.bag.add(scheduleId, payload.itemId);

    const bytes = payload.storageKey ? await this.media.bytesOf(payload.storageKey) : null;
    const result = await this.sender.send(
      target.chatId,
      payload,
      // El remitente va en el propio mensaje: quien recibe tiene un chat con un
      // bot, no con una persona, así que sin esto no sabría de quién le llegó.
      `De ${target.senderName}`,
      bytes,
    );

    if (!result.failure) {
      await this.log.record({
        scheduleId,
        itemId: payload.itemId,
        occurrenceKey,
        occurredAt,
        status: 'SENT',
        providerMessageId: result.messageId,
        error: null,
      });

      return 'SENT';
    }

    await this.log.record({
      scheduleId,
      itemId: payload.itemId,
      occurrenceKey,
      occurredAt,
      status: 'FAILED',
      providerMessageId: null,
      error: result.failure.reason,
    });

    /*
     * Un fallo permanente —el bot bloqueado, un chat que ya no existe— no se
     * arregla reintentando. Se apaga el horario y se avisa al dueño, en vez de
     * empujar contra una puerta cerrada cada día a la misma hora.
     */
    if (result.failure.permanent) {
      await this.schedules.deactivate(scheduleId, result.failure.reason);
      await this.sender.notifyOwner(
        target.ownerId,
        `Pausamos un envío: ${result.failure.reason}. Revísalo en Droply.`,
      );
    }

    return 'FAILED';
  }

  /** Devuelve `false` si esa ocurrencia ya estaba anotada por alguien más. */
  private record(
    occurrenceKey: string,
    scheduleId: string,
    itemId: string | null,
    occurredAt: Date,
    status: 'SENT' | 'FAILED' | 'SKIPPED',
    error: string | null,
  ): Promise<boolean> {
    return this.log.record({
      scheduleId,
      itemId,
      occurrenceKey,
      occurredAt,
      status,
      providerMessageId: null,
      error,
    });
  }
}
