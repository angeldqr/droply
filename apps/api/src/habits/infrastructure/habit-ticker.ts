import { Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import type { CloseDueDays } from '../application/close-due-days';

/**
 * Una vuelta por minuto. No hace falta más fino: lo que se busca es el momento
 * en que a algún plan se le venció el día, y eso pasa una vez cada veinticuatro
 * horas por plan.
 */
const TICK_MS = 60_000;

/**
 * El latido que cierra los días de los planes.
 *
 * Es un temporizador y no un trabajo repetible de una cola por lo mismo que el
 * del calendario: hoy no hay nadie del otro lado. La consulta ya reparte el
 * trabajo por planes y la escritura es condicional, así que correr esto en
 * varios procesos es seguro tal como está.
 *
 * ponytail: si algún día hace falta repartir esto entre varios procesos, lo que
 * se muda es el temporizador; `CloseDueDays` no se entera, porque quien decide
 * quién cierra un día es la condición de `commitDay` y no el reloj.
 */
export class HabitTicker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(HabitTicker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly closeDue: CloseDueDays) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.tick(), TICK_MS);

    // Que no retenga el proceso: si no queda nada más vivo, que pueda cerrarse.
    this.timer.unref();

    /*
     * Se anuncia al arrancar, igual que el planificador y por el mismo motivo:
     * un latido que no late no se queja. Los resúmenes simplemente no llegan, y
     * desde afuera se ve igual que un plan recién creado.
     */
    this.logger.log('Planes de hábitos en marcha: una vuelta por minuto.');
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    // Una vuelta lenta no puede solaparse con la siguiente: serían dos lecturas
    // del mismo proceso peleando por los mismos planes.
    if (this.running) return;

    this.running = true;

    try {
      for (const closed of await this.closeDue.execute()) {
        this.logger.log(`Día cerrado: ${closed}`);
      }
    } catch (caught) {
      // Un fallo no puede matar el latido: la vuelta siguiente reintenta, y el
      // día sigue sin cerrar hasta que alguna lo consiga.
      this.logger.error('Falló una vuelta de los planes de hábitos.', caught);
    } finally {
      this.running = false;
    }
  }
}
