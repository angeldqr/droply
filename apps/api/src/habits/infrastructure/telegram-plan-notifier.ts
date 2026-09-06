import { Logger } from '@nestjs/common';
import type { PlanNotifier } from '../domain/ports';

/**
 * El resumen del día y el informe del final, por el chat del destinatario.
 *
 * Es un `sendMessage` y nada más, así que no comparte código con el envío de
 * archivos ni con las respuestas de la vinculación: los tres hablan con
 * Telegram, pero cada uno pertenece a un contexto y no pueden verse entre sí.
 *
 * Un fallo acá **no se propaga, pero sí se devuelve**. El día ya quedó contado
 * y escrito cuando esto corre, así que tirar la vuelta del latido dejaría sin
 * cerrar los planes que vienen detrás; pero quien llama necesita saberlo,
 * porque el informe de cierre se sella en el plan y sellarlo sin que saliera
 * dejaría al dueño mirando una fecha de envío que no ocurrió.
 */
export class TelegramPlanNotifier implements PlanNotifier {
  private readonly logger = new Logger(TelegramPlanNotifier.name);
  private readonly base: string;

  constructor(botToken: string) {
    this.base = `https://api.telegram.org/bot${botToken}`;
  }

  async send(chatId: string, text: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.base}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
        signal: AbortSignal.timeout(30_000),
      });

      const payload = (await response.json()) as { ok: boolean; description?: string };

      if (!payload.ok) {
        // El token va en la URL, así que se nombra el motivo y nunca la
        // dirección completa.
        this.logger.warn(`Telegram rechazó el resumen: ${payload.description ?? 'sin motivo'}`);
      }

      return payload.ok;
    } catch (caught) {
      this.logger.warn('No se pudo mandar el resumen de un plan de hábitos.', caught);

      return false;
    }
  }
}
