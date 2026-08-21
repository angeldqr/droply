import type { Clock } from '../../shared/clock';
import type {
  DeliveryLog,
  DispatchTarget,
  LibraryCatalog,
  MediaSource,
  MessageSender,
  NoticeWriter,
  Payload,
  PendingRetry,
  ScheduleReader,
} from '../domain/ports';

/** Qué pasó con una ocurrencia, para que el latido lo deje en el log. */
export type DispatchOutcome =
  | 'SENT'
  | 'DUPLICATE'
  | 'NOTHING_TO_SEND'
  | 'NOT_LINKED'
  | 'RETRYING'
  | 'FAILED'
  | 'GONE'
  /** La cuenta ya gastó su tope de envíos del día. */
  | 'OVER_DAILY_LIMIT';

/**
 * Cuánto se espera antes de cada reintento, en minutos.
 *
 * Creciente y corta: un minuto cubre el bache de red, cinco cubren un reinicio
 * del proveedor y veinticinco cubren una caída de verdad. Media hora larga es
 * todo lo que tiene sentido esperar cuando el envío siguiente puede estar a
 * hora y media.
 */
const BACKOFF_MINUTES = [1, 5, 25];

const MINUTE_MS = 60 * 1000;

const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * Cuántos envíos puede sacar una cuenta en un día.
 *
 * Es el único tope que acota lo que sale hacia afuera: los demás cuentan filas,
 * este cuenta mensajes a personas reales. Quinientos es mucho más de lo que un
 * uso normal alcanza —la franja de un horario no da para tantos— y sigue
 * cortando en seco una biblioteca de mil archivos apuntada a treinta chats.
 *
 * Se mide contra las últimas veinticuatro horas y no contra el día del
 * calendario: no hay un día común para toda la cuenta, porque cada horario
 * tiene su zona.
 */
export const MAX_PER_DAY = 500;

/**
 * Manda lo que le tocaba a un horario en un instante concreto.
 *
 * El orden de los pasos no es casual: **primero se reserva la ocurrencia y
 * después se envía**. Si fuera al revés, un corte entre el envío y la
 * anotación haría que el reintento mandara lo mismo otra vez, y el
 * destinatario recibiría dos veces la misma foto. Reservando antes, el peor
 * caso es un envío perdido, que se nota mucho menos.
 *
 * Un fallo pasajero —la red, el proveedor de mal humor, el almacenamiento que
 * no responde— ya no pierde la ocurrencia: la deja `RETRYING` con su hora, y
 * el latido la recoge. Los que no se arreglan solos —el bot bloqueado, un chat
 * que no existe— apagan el horario y avisan al dueño.
 */
export class DispatchOccurrence {
  constructor(
    private readonly schedules: ScheduleReader,
    private readonly libraries: LibraryCatalog,
    private readonly media: MediaSource,
    private readonly sender: MessageSender,
    private readonly log: DeliveryLog,
    private readonly notices: NoticeWriter,
    private readonly clock: Clock,
  ) {}

  /** El primer intento de una ocurrencia: es quien la reserva. */
  async execute(
    scheduleId: string,
    occurredAt: Date,
    occurrenceKey: string,
  ): Promise<DispatchOutcome> {
    const target = await this.schedules.find(scheduleId);

    // Se borró entre que el tick lo tomó y llegamos acá.
    if (!target) return 'GONE';

    if (!target.chatId) {
      await this.skip(scheduleId, occurrenceKey, occurredAt, 'sin vincular');

      return 'NOT_LINKED';
    }

    // A cada momento del día le corresponde un elemento: no hay nada que
    // elegir acá, solo preguntar a quién le toca.
    const itemId = await this.libraries.itemAt(target, occurredAt);
    const payload = itemId ? await this.libraries.payloadOf(itemId) : null;

    if (!payload) {
      await this.skip(scheduleId, occurrenceKey, occurredAt, 'nada que enviar');

      return 'NOTHING_TO_SEND';
    }

    if ((await this.log.countSentSince(target.ownerId, this.dayAgo())) >= MAX_PER_DAY) {
      await this.skip(scheduleId, occurrenceKey, occurredAt, 'tope diario de envíos alcanzado');

      return 'OVER_DAILY_LIMIT';
    }

    /*
     * La reserva se anota como enviada aunque todavía no haya salido.
     *
     * Es el lado por el que conviene equivocarse: si el proceso muere entre la
     * reserva y el envío, la ocurrencia queda dada por buena y se pierde un
     * mensaje. Al revés —anotarla al final— un corte la dejaría sin anotar y el
     * siguiente intento mandaría lo mismo dos veces.
     */
    const reserved = await this.log.reserve({
      scheduleId,
      itemId: payload.itemId,
      occurrenceKey,
      occurredAt,
      status: 'SENT',
      error: null,
    });

    // Otra réplica se nos adelantó y ya es dueña de esta ocurrencia.
    if (!reserved) return 'DUPLICATE';

    return this.deliver(target, payload, occurrenceKey, 0);
  }

  /**
   * Un intento posterior de una ocurrencia que falló por algo pasajero.
   *
   * No reserva: la fila ya es suya desde el primer intento, y la tomó el
   * latido con el mismo bloqueo que usa el calendario. Y manda **el mismo
   * elemento** que se eligió entonces, no el que el plan del día diga ahora: si
   * alguien agregó un archivo en el medio, lo que estaba a medio salir era el
   * de antes.
   */
  async retry(pending: PendingRetry): Promise<DispatchOutcome> {
    const target = await this.schedules.find(pending.scheduleId);

    if (!target) {
      await this.log.settle(pending.occurrenceKey, {
        status: 'SKIPPED',
        error: 'el horario ya no está',
        nextAttemptAt: null,
      });

      return 'GONE';
    }

    if (!target.chatId) {
      await this.log.settle(pending.occurrenceKey, {
        status: 'SKIPPED',
        error: 'sin vincular',
        nextAttemptAt: null,
      });

      return 'NOT_LINKED';
    }

    const payload = await this.libraries.payloadOf(pending.itemId);

    if (!payload) {
      await this.log.settle(pending.occurrenceKey, {
        status: 'SKIPPED',
        error: 'el archivo ya no está',
        nextAttemptAt: null,
      });

      return 'NOTHING_TO_SEND';
    }

    return this.deliver(target, payload, pending.occurrenceKey, pending.retryCount);
  }

  private async deliver(
    target: DispatchTarget,
    payload: Payload,
    occurrenceKey: string,
    retryCount: number,
  ): Promise<DispatchOutcome> {
    const bytes = await this.bytesOf(payload);

    // El almacenamiento no respondió. Es tan pasajero como que falle la red al
    // enviar, y se trata igual.
    if (bytes === 'unavailable') {
      return this.failed(target, occurrenceKey, retryCount, false, 'no se pudo leer el archivo');
    }

    const result = await this.sender.send(
      target.chatId ?? '',
      payload,
      // El remitente va en el propio mensaje: quien recibe tiene un chat con un
      // bot, no con una persona, así que sin esto no sabría de quién le llegó.
      `De ${target.senderName}`,
      bytes,
    );

    if (!result.failure) {
      await this.log.settle(occurrenceKey, {
        status: 'SENT',
        itemId: payload.itemId,
        providerMessageId: result.messageId,
        error: null,
        nextAttemptAt: null,
      });

      return 'SENT';
    }

    return this.failed(
      target,
      occurrenceKey,
      retryCount,
      result.failure.permanent,
      result.failure.reason,
    );
  }

  /** Decide si esto se vuelve a intentar, se rinde, o apaga el horario. */
  private async failed(
    target: DispatchTarget,
    occurrenceKey: string,
    retryCount: number,
    permanent: boolean,
    reason: string,
  ): Promise<DispatchOutcome> {
    /*
     * Un fallo permanente —el bot bloqueado, un chat que ya no existe— no se
     * arregla reintentando. Se apaga el horario y se avisa al dueño, en vez de
     * empujar contra una puerta cerrada cada día a la misma hora.
     */
    if (permanent) {
      await this.log.settle(occurrenceKey, {
        status: 'FAILED',
        error: reason,
        nextAttemptAt: null,
      });
      await this.schedules.deactivate(target.scheduleId, reason);
      await this.notices.write(
        target.ownerId,
        `Pausamos un envío: ${reason}. Revísalo en tus horarios.`,
      );

      return 'FAILED';
    }

    const wait = BACKOFF_MINUTES[retryCount];

    // Se acabaron los intentos. Se rinde y lo dice, en vez de seguir empujando.
    if (wait === undefined) {
      await this.log.settle(occurrenceKey, {
        status: 'FAILED',
        error: `${reason} (tras ${BACKOFF_MINUTES.length} reintentos)`,
        nextAttemptAt: null,
      });
      await this.notices.write(
        target.ownerId,
        `Un envío no salió: ${reason}. Lo intentamos ${BACKOFF_MINUTES.length} veces más y no hubo forma.`,
      );

      return 'FAILED';
    }

    await this.log.settle(occurrenceKey, {
      status: 'RETRYING',
      error: reason,
      retryCount: retryCount + 1,
      nextAttemptAt: new Date(this.clock.now().getTime() + wait * MINUTE_MS),
    });

    return 'RETRYING';
  }

  /**
   * Hace veinticuatro horas. El tope diario se mide contra esta ventana móvil.
   *
   * Los reintentos no lo consultan a propósito: esa ocurrencia ya está
   * reservada desde su primer intento y pasó el tope entonces. Volver a
   * cobrárselo sería castigar dos veces el mismo envío por un fallo de red.
   */
  private dayAgo(): Date {
    return new Date(this.clock.now().getTime() - DAY_MS);
  }

  /** Los bytes, o `'unavailable'` si el almacenamiento no contestó. */
  private async bytesOf(payload: Payload): Promise<Uint8Array | null | 'unavailable'> {
    if (!payload.storageKey) return null;

    try {
      return await this.media.bytesOf(payload.storageKey);
    } catch {
      return 'unavailable';
    }
  }

  /** Una ocurrencia que no tenía nada que enviar. No se reintenta. */
  private async skip(
    scheduleId: string,
    occurrenceKey: string,
    occurredAt: Date,
    reason: string,
  ): Promise<void> {
    await this.log.reserve({
      scheduleId,
      itemId: null,
      occurrenceKey,
      occurredAt,
      status: 'SKIPPED',
      error: reason,
    });
  }
}
