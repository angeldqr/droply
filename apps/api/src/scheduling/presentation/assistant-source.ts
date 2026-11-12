import {
  COLUMN_LABELS_SINGULAR,
  formatDayMinute,
  WEEKDAY_LABELS,
  type Weekday,
} from '@reconectate/contracts';
import type { AssistantSource } from '../../shared/assistant-source';
import type { ListSchedules } from '../application/schedule-use-cases';

/** Los horarios, para el asistente, con los minutos ya pasados a hora. */
export function schedulesSource(listSchedules: ListSchedules): AssistantSource {
  return {
    async list(ownerId) {
      return (await listSchedules.execute(ownerId)).map(
        ({ schedule, libraryName, recipientLabel }) => {
          const snapshot = schedule.toSnapshot();

          return {
            biblioteca: libraryName,
            destinatario: recipientLabel,
            dias: snapshot.weekdays.map((day) => WEEKDAY_LABELS[day as Weekday]),
            desde: formatDayMinute(snapshot.startMinute),
            hasta: formatDayMinute(snapshot.endMinute),
            zonaHoraria: snapshot.timezone,
            soloTipo: snapshot.kindFilter ? COLUMN_LABELS_SINGULAR[snapshot.kindFilter] : null,
            activo: snapshot.active,
            proximoEnvio: snapshot.nextRunAt?.toISOString() ?? null,
          };
        },
      );
    },
  };
}
