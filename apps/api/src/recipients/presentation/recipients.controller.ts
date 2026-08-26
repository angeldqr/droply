import { Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import {
  createRecipientSchema,
  type CreateRecipientInput,
  type RecipientView,
} from '@reconectate/contracts';
import { ENV, type ApiEnv } from '../../platform/config/env.module';
import { CurrentUserId } from '../../platform/http/current-user.decorator';
import { ZodBody } from '../../platform/http/zod-body.decorator';
import { InvalidInputError } from '../../shared/domain-error';
import { RecipientId, type UserId } from '../../shared/identifiers';
import { orThrow } from '../../shared/result';
import {
  CreateRecipient,
  DeleteRecipient,
  ListRecipients,
  RelinkRecipient,
} from '../application/recipient-use-cases';
import type { Recipient } from '../domain/recipient';

@Controller('recipients')
export class RecipientsController {
  constructor(
    @Inject(ENV) private readonly env: ApiEnv,
    @Inject(ListRecipients) private readonly listRecipients: ListRecipients,
    @Inject(CreateRecipient) private readonly createRecipient: CreateRecipient,
    @Inject(RelinkRecipient) private readonly relinkRecipient: RelinkRecipient,
    @Inject(DeleteRecipient) private readonly deleteRecipient: DeleteRecipient,
  ) {}

  @Get()
  async list(@CurrentUserId() userId: UserId): Promise<RecipientView[]> {
    const rows = await this.listRecipients.execute(userId);

    // Sin enlace: el código en claro solo existe en la respuesta que lo creó,
    // porque lo que se guarda es su hash. Para volver a tenerlo se pide uno
    // nuevo, que además invalida el anterior.
    return rows.map((recipient) => this.toView(recipient, null));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUserId() userId: UserId,
    @ZodBody(createRecipientSchema) body: CreateRecipientInput,
  ): Promise<RecipientView> {
    const issued = orThrow(await this.createRecipient.execute(userId, body.label));

    return this.toView(issued.recipient, issued.code);
  }

  /** Un enlace nuevo, que es también la forma de recuperar uno que se perdió. */
  @Post(':recipientId/link')
  @HttpCode(HttpStatus.OK)
  async relink(
    @CurrentUserId() userId: UserId,
    @Param('recipientId') recipientId: string,
  ): Promise<RecipientView> {
    const issued = orThrow(await this.relinkRecipient.execute(userId, toRecipientId(recipientId)));

    return this.toView(issued.recipient, issued.code);
  }

  @Delete(':recipientId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUserId() userId: UserId,
    @Param('recipientId') recipientId: string,
  ): Promise<void> {
    orThrow(await this.deleteRecipient.execute(userId, toRecipientId(recipientId)));
  }

  private toView(recipient: Recipient, code: string | null): RecipientView {
    return {
      id: recipient.id,
      label: recipient.label,
      channel: recipient.channel,
      status: recipient.isLinked ? 'VERIFIED' : 'PENDING',
      linkUrl: code
        ? `https://t.me/${this.env.TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(code)}`
        : null,
      linkExpiresAt: recipient.linkCodeExpiresAt?.toISOString() ?? null,
      createdAt: recipient.createdAt.toISOString(),
    };
  }
}

function toRecipientId(raw: string) {
  if (!RecipientId.is(raw)) {
    throw new InvalidInputError(
      'recipient.id_invalid',
      'Ese identificador de destinatario no vale.',
    );
  }

  return RecipientId.from(raw);
}
