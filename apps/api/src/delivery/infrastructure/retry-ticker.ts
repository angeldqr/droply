import { Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import type { RunDueRetries } from '../application/run-due-retries';

/** Una vuelta por minuto, la misma cadencia que el calendario. */
const TICK_MS = 60_000;

/**
 * El latido de los reintentos.
 *
 * Tiene el suyo y no se cuelga del tick del calendario a propósito: aquel es de
 * `scheduling` y un contexto no maneja el latido de otro. Además una vuelta
 * lenta de uno no debe retrasar al otro — el calendario tiene que despertar a
 * su hora aunque haya cincuenta reintentos esperando.
 */
export class RetryTicker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RetryTicker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly runDue: RunDueRetries) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();

    this.logger.log('Reintentos en marcha: una vuelta por minuto.');
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    // Una vuelta lenta no puede solaparse con la siguiente: serían dos lecturas
    // del mismo proceso peleando por las mismas filas.
    if (this.running) return;

    this.running = true;

    try {
      const attended = await this.runDue.execute();

      if (attended > 0) this.logger.log(`Reintentos despachados: ${attended}`);
    } catch (caught) {
      // Un fallo no puede matar el latido: la vuelta siguiente reintenta, y las
      // filas tomadas vuelven a estar vencidas en cuanto se les ponga hora.
      this.logger.error('Falló una vuelta de reintentos.', caught);
    } finally {
      this.running = false;
    }
  }
}
