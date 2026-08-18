import { z } from 'zod';
import type { Channel, RecipientStatus } from './primitives.js';

export const RECIPIENT_LABEL_MAX_LENGTH = 40;

/**
 * Crear un destinatario es ponerle un nombre y nada más.
 *
 * No se pide ni un teléfono ni un usuario de Telegram, y no por comodidad: un
 * bot no puede escribirle a alguien que nunca le habló, así que el identificador
 * de chat no lo elige quien crea el destinatario. Aparece cuando la otra persona
 * abre el enlace y aprieta Empezar.
 */
export const createRecipientSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Ponle un nombre, como «Mamá».')
    .max(RECIPIENT_LABEL_MAX_LENGTH, `No puede pasar de ${RECIPIENT_LABEL_MAX_LENGTH} caracteres.`),
});

export type CreateRecipientInput = z.infer<typeof createRecipientSchema>;

/**
 * El canal sale del vocabulario de `primitives`, que ya lo declara junto con
 * WhatsApp. Escribir acá una lista propia con un solo valor sería el segundo
 * lugar donde vive la misma verdad, esperando a separarse del primero.
 */
export const CHANNEL_LABELS: Readonly<Record<Channel, string>> = {
  TELEGRAM: 'Telegram',
  WHATSAPP: 'WhatsApp',
};

/**
 * Un destinatario visto desde la pantalla.
 *
 * `PENDING` no es un error ni un estado transitorio que se resuelve solo: es lo
 * normal hasta que la otra persona actúa, y la interfaz tiene que decirlo con
 * todas las letras en vez de esconderlo detrás de un punto gris.
 */
export interface RecipientView {
  readonly id: string;
  readonly label: string;
  readonly channel: Channel;
  /**
   * `PENDING` hasta que la otra persona apriete Empezar, `VERIFIED` después.
   * `BLOCKED` lo declara el vocabulario para cuando el envío descubra que el
   * bot fue bloqueado; hasta la fase 6 no lo emite nadie.
   */
  readonly status: RecipientStatus;
  /** El enlace que hay que hacerle llegar. Solo mientras está pendiente. */
  readonly linkUrl: string | null;
  readonly linkExpiresAt: string | null;
  readonly linkedAt: string | null;
  readonly createdAt: string;
}
