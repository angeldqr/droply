import type { Clock } from '../../shared/clock';
import type { DeliveryLog } from '../domain/ports';
import type { DispatchOccurrence } from './dispatch-occurrence';

/** Cuántos reintentos vencidos se atienden por vuelta. */
const BATCH = 50;

/**
 * La segunda pasada del latido: lo que falló por algo pasajero y ya toca
 * volver a intentar.
 *
 * Es una pasada aparte y no parte del tick del calendario porque son dos
 * preguntas distintas: aquel busca horarios vencidos, este busca intentos
 * vencidos. Comparten la forma —tomar con bloqueo, despachar, anotar— y nada
 * más.
 */
export class RunDueRetries {
  constructor(
    private readonly log: DeliveryLog,
    private readonly dispatch: DispatchOccurrence,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<number> {
    const due = await this.log.claimDueRetries(this.clock.now(), BATCH);

    for (const pending of due) await this.dispatch.retry(pending);

    return due.length;
  }
}
