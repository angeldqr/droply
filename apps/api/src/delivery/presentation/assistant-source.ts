import { DELIVERY_STATUS_LABELS } from '@reconectate/contracts';
import { clip, type AssistantSource } from '../../shared/assistant-source';
import type { DeliveryLog } from '../domain/ports';

/** Los envíos que ve el asistente: los más recientes. */
const DELIVERIES_LIMIT = 30;

/** El historial de envíos, para el asistente. */
export function deliveriesSource(log: DeliveryLog): AssistantSource {
  return {
    async list(ownerId) {
      return (await log.recent(ownerId, DELIVERIES_LIMIT)).map((record) => ({
        cuando: record.occurredAt.toISOString(),
        biblioteca: record.libraryName,
        destinatario: record.recipientLabel,
        estado: DELIVERY_STATUS_LABELS[record.status],
        error: clip(record.error, 120),
      }));
    },
  };
}
