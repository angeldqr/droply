import { Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import type { RunDueSchedules } from '../application/run-due-schedules';

/** Una vuelta por minuto: es la resolución más fina que ofrece la interfaz. */
const TICK_MS = 60_000;

/**
 * El latido que llama al tick.
 *
 * Es un temporizador y no un trabajo repetible de BullMQ porque hoy no hay
 * nadie del otro lado de la cola: encolar contra un consumidor que no existe
 * sería mover cajas vacías. La consulta ya se salta lo que otra réplica tomó,
 * así que correr esto en varios procesos es seguro tal como está.
 *
 * ponytail: cuando la fase 6 traiga el despacho, esto pasa a encolar
 * `delivery.dispatch` con la clave de idempotencia que el tick ya calcula, y el
 * temporizador se muda al worker. El caso de uso no se entera.
 */
export class ScheduleTicker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ScheduleTicker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly runDue: RunDueSchedules) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.tick(), TICK_MS);

    // Que no retenga el proceso: si no queda nada más vivo, que pueda cerrarse.
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    // Una vuelta lenta no puede solaparse con la siguiente: serían dos lecturas
    // simultáneas del mismo proceso peleando por las mismas filas.
    if (this.running) return;

    this.running = true;

    try {
      const due = await this.runDue.execute();

      for (const occurrence of due) {
        // ponytail: por ahora se registra. En la fase 6, acá va el encolado.
        this.logger.log(`Toca enviar: ${occurrence.idempotencyKey}`);
      }
    } catch (caught) {
      // Un fallo no puede matar el latido: la vuelta siguiente reintenta, y las
      // filas tomadas vuelven a estar vencidas por el préstamo de un minuto.
      this.logger.error('Falló una vuelta del planificador.', caught);
    } finally {
      this.running = false;
    }
  }
}
