import { Controller, Get, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import type { NoticeView } from '@reconectate/contracts';
import { CurrentUserId } from '../../platform/http/current-user.decorator';
import type { UserId } from '../../shared/identifiers';
import { NOTICE_READER, type NoticeReader } from '../domain/ports';

/**
 * Los avisos que la aplicación le dejó al dueño.
 *
 * Viven en el contexto de envío porque hoy es el único que escribe alguno:
 * cuando un horario se apaga solo, o cuando un envío no salió después de todos
 * los reintentos. El día que otro contexto necesite avisar, la tabla y estos
 * dos puertos se mudan a `shared`.
 */
@Controller('notices')
export class NoticesController {
  constructor(@Inject(NOTICE_READER) private readonly notices: NoticeReader) {}

  /** Solo los sin leer: un aviso leído ya hizo su trabajo. */
  @Get()
  async unread(@CurrentUserId() userId: UserId): Promise<NoticeView[]> {
    const rows = await this.notices.unreadOf(userId);

    return rows.map((row) => ({
      id: row.id,
      text: row.text,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  @Post(':noticeId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(
    @CurrentUserId() userId: UserId,
    @Param('noticeId') noticeId: string,
  ): Promise<void> {
    // El dueño viaja hasta la consulta: nadie marca como leído el aviso de
    // otro, y un identificador que no sea suyo simplemente no afecta a nada.
    await this.notices.markRead(userId, noticeId);
  }
}
