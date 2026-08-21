import { Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import type { SweepStaleUploads } from '../application/media-use-cases';

/** Una vuelta al día: lo que se recoge lleva por lo menos veinticuatro horas. */
const TICK_MS = 24 * 60 * 60 * 1000;

/**
 * El barrido de las subidas que se quedaron a medias.
 *
 * Corre una vez al arrancar y una vez al día. La de arranque es la que importa
 * en la práctica: un servidor que se reinicia cada despliegue no llegaría nunca
 * a la vuelta de las veinticuatro horas, y sin ella el barrido no correría
 * jamás.
 *
 * ponytail: con varias réplicas las dos barrerían a la vez. No pasa nada —
 * borrar dos veces el mismo objeto no falla y `deleteMany` de una fila que ya
 * no está tampoco—, así que no lleva el bloqueo que sí llevan los envíos.
 */
export class UploadSweeper implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(UploadSweeper.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly sweep: SweepStaleUploads) {}

  onApplicationBootstrap(): void {
    void this.run();

    this.timer = setInterval(() => void this.run(), TICK_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async run(): Promise<void> {
    try {
      const swept = await this.sweep.execute();

      if (swept > 0) this.logger.log(`Subidas a medias recogidas: ${swept}.`);
    } catch (caught) {
      // Una limpieza que falla no puede tumbar el arranque ni el proceso: lo
      // que quede sin recoger sigue ahí para la vuelta siguiente.
      this.logger.error('Falló el barrido de subidas a medias.', caught);
    }
  }
}
