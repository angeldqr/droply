import { Controller, Get, Inject, Param } from '@nestjs/common';
import type { AccountDetailView, AccountSummaryView } from '@droply/contracts';
import { Roles } from '../../platform/http/roles.decorator';
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
  async list(): Promise<AccountSummaryView[]> {
    const rows = await this.accounts.list();

    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
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
