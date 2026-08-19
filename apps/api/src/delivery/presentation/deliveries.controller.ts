import { Controller, Get, Inject } from '@nestjs/common';
import type { DeliveryRecordView } from '@droply/contracts';
import { CurrentUserId } from '../../platform/http/current-user.decorator';
import type { UserId } from '../../shared/identifiers';
import { DELIVERY_LOG, type DeliveryLog } from '../domain/ports';

/** Cuántos envíos se muestran. Es un historial reciente, no un archivo. */
const RECENT = 50;

@Controller('deliveries')
export class DeliveriesController {
  constructor(@Inject(DELIVERY_LOG) private readonly log: DeliveryLog) {}

  /**
   * Lo último que salió, con su resultado.
   *
   * Sin esto nadie confía en un programador de envíos: si no se ve que salió,
   * la única forma de saberlo es preguntarle a quien lo recibe.
   */
  @Get()
  async recent(@CurrentUserId() userId: UserId): Promise<DeliveryRecordView[]> {
    const rows = await this.log.recent(userId, RECENT);

    return rows.map((row) => ({
      id: row.id,
      scheduleId: row.scheduleId,
      libraryName: row.libraryName,
      recipientLabel: row.recipientLabel,
      status: row.status as 'SENT',
      error: row.error,
      occurredAt: row.occurredAt.toISOString(),
    }));
  }
}
