import { Controller, Get, Inject } from '@nestjs/common';
import {
  pageQuerySchema,
  type DeliveryRecordView,
  type Paged,
  type PageQuery,
} from '@reconectate/contracts';
import { CurrentUserId } from '../../platform/http/current-user.decorator';
import { ZodQuery } from '../../platform/http/zod-query.decorator';
import type { UserId } from '../../shared/identifiers';
import { DELIVERY_LOG, type DeliveryLog } from '../domain/ports';

@Controller('deliveries')
export class DeliveriesController {
  constructor(@Inject(DELIVERY_LOG) private readonly log: DeliveryLog) {}

  /**
   * El historial de envíos, por páginas, con su resultado.
   *
   * Sin esto nadie confía en un programador de envíos: si no se ve que salió,
   * la única forma de saberlo es preguntarle a quien lo recibe. Va paginado y
   * no recortado a los últimos: quien busca qué pasó hace un mes tiene que
   * poder llegar.
   */
  @Get()
  async page(
    @CurrentUserId() userId: UserId,
    @ZodQuery(pageQuerySchema) query: PageQuery,
  ): Promise<Paged<DeliveryRecordView>> {
    const { items, total } = await this.log.page(userId, query.page, query.pageSize);

    return {
      items: items.map((row) => ({
        id: row.id,
        scheduleId: row.scheduleId,
        libraryName: row.libraryName,
        recipientLabel: row.recipientLabel,
        status: row.status,
        error: row.error,
        occurredAt: row.occurredAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
