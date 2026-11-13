import { Controller, Get, Inject, Param } from '@nestjs/common';
import {
  pageQuerySchema,
  type AccountDetailView,
  type AccountSummaryView,
  type Paged,
  type PageQuery,
} from '@reconectate/contracts';
import { Roles } from '../../platform/http/roles.decorator';
import { ZodQuery } from '../../platform/http/zod-query.decorator';
import { UserId } from '../../shared/identifiers';
import { InvalidInputError, NotFoundError } from '../../shared/domain-error';
import { ACCOUNT_DIRECTORY, type AccountDirectory } from '../domain/ports';

/**
 * El panel de administración: dos lecturas y nada más.
 *
 * `@Roles('ADMIN')` va en la clase y no en cada método, así una ruta nueva nace
 * cerrada en vez de quedar abierta si alguien se olvida del decorador.
 */
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(@Inject(ACCOUNT_DIRECTORY) private readonly accounts: AccountDirectory) {}

  @Get('accounts')
  async list(@ZodQuery(pageQuerySchema) query: PageQuery): Promise<Paged<AccountSummaryView>> {
    const { items, total } = await this.accounts.list(query.page, query.pageSize);

    return {
      items: items.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  @Get('accounts/:userId')
  async detail(@Param('userId') userId: string): Promise<AccountDetailView> {
    if (!UserId.is(userId)) {
      throw new InvalidInputError('admin.user_id_invalid', 'Ese identificador no vale.');
    }

    const account = await this.accounts.find(UserId.from(userId));

    if (!account) {
      throw new NotFoundError('admin.account_not_found', 'Esa cuenta no existe.');
    }

    return { ...account, createdAt: account.createdAt.toISOString() };
  }
}
