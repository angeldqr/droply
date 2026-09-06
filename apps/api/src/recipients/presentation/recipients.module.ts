import { Module } from '@nestjs/common';
import { ENV, type ApiEnv } from '../../platform/config/env.module';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CLOCK, type Clock } from '../../shared/clock';
import { HABIT_VOTE_SINK, type HabitVoteSink } from '../../shared/habit-vote-sink';
import { ID_GENERATOR, type IdGenerator } from '../../shared/identifiers';
import { HandleTelegramCallback } from '../application/handle-telegram-callback';
import { HandleTelegramMessage } from '../application/handle-telegram-message';
import { LinkTelegramChat } from '../application/link-telegram-chat';
import {
  CreateRecipient,
  DeleteRecipient,
  ListRecipients,
  RelinkRecipient,
} from '../application/recipient-use-cases';
import {
  ACCOUNT_STATUS,
  CALLBACK_RESPONDER,
  CHANNEL_GATEWAY,
  LINK_CODE_FACTORY,
  RECIPIENT_REPOSITORY,
  type AccountStatus,
  type CallbackResponder,
  type ChannelGateway,
  type LinkCodeFactory,
  type RecipientRepository,
} from '../domain/ports';
import { PrismaAccountStatus } from '../infrastructure/prisma-account-status';
import { PrismaRecipientRepository } from '../infrastructure/prisma-recipient.repository';
import { Sha256LinkCodeFactory } from '../infrastructure/sha256-link-code-factory';
import { TelegramApi } from '../infrastructure/telegram-api';
import { TelegramChannelGateway } from '../infrastructure/telegram-channel-gateway';
import { TelegramConnection } from '../infrastructure/telegram-connection';
import { RecipientsController } from './recipients.controller';
import { TelegramController } from './telegram.controller';

/** El cliente HTTP del bot, compartido entre el envío y la conexión entrante. */
const TELEGRAM_API = Symbol('TelegramApi');

@Module({
  controllers: [RecipientsController, TelegramController],
  providers: [
    { provide: LINK_CODE_FACTORY, useClass: Sha256LinkCodeFactory },

    {
      provide: RECIPIENT_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaRecipientRepository(prisma),
    },
    {
      provide: ACCOUNT_STATUS,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaAccountStatus(prisma),
    },
    {
      provide: TELEGRAM_API,
      inject: [ENV],
      useFactory: (env: ApiEnv) => new TelegramApi(env.TELEGRAM_BOT_TOKEN),
    },
    {
      // Un solo adaptador para los dos puertos: los dos hablan por el mismo bot,
      // y quien responde un toque no tiene por qué poder mandar mensajes.
      provide: CALLBACK_RESPONDER,
      inject: [CHANNEL_GATEWAY],
      useFactory: (gateway: TelegramChannelGateway) => gateway,
    },
    {
      provide: CHANNEL_GATEWAY,
      inject: [TELEGRAM_API],
      useFactory: (api: TelegramApi) => new TelegramChannelGateway(api),
    },

    {
      provide: ListRecipients,
      inject: [RECIPIENT_REPOSITORY],
      useFactory: (recipients: RecipientRepository) => new ListRecipients(recipients),
    },
    {
      provide: CreateRecipient,
      inject: [RECIPIENT_REPOSITORY, ACCOUNT_STATUS, LINK_CODE_FACTORY, ID_GENERATOR, CLOCK],
      useFactory: (
        recipients: RecipientRepository,
        accounts: AccountStatus,
        codes: LinkCodeFactory,
        ids: IdGenerator,
        clock: Clock,
      ) => new CreateRecipient(recipients, accounts, codes, ids, clock),
    },
    {
      provide: RelinkRecipient,
      inject: [RECIPIENT_REPOSITORY, ACCOUNT_STATUS, LINK_CODE_FACTORY, CLOCK],
      useFactory: (
        recipients: RecipientRepository,
        accounts: AccountStatus,
        codes: LinkCodeFactory,
        clock: Clock,
      ) => new RelinkRecipient(recipients, accounts, codes, clock),
    },
    {
      provide: DeleteRecipient,
      inject: [RECIPIENT_REPOSITORY],
      useFactory: (recipients: RecipientRepository) => new DeleteRecipient(recipients),
    },
    {
      provide: LinkTelegramChat,
      inject: [RECIPIENT_REPOSITORY, LINK_CODE_FACTORY, CLOCK],
      useFactory: (recipients: RecipientRepository, codes: LinkCodeFactory, clock: Clock) =>
        new LinkTelegramChat(recipients, codes, clock),
    },
    {
      provide: HandleTelegramMessage,
      inject: [LinkTelegramChat, CHANNEL_GATEWAY],
      useFactory: (link: LinkTelegramChat, channel: ChannelGateway) =>
        new HandleTelegramMessage(link, channel),
    },

    {
      provide: HandleTelegramCallback,
      inject: [HABIT_VOTE_SINK, CALLBACK_RESPONDER],
      useFactory: (votes: HabitVoteSink, chat: CallbackResponder) =>
        new HandleTelegramCallback(votes, chat),
    },

    {
      provide: TelegramConnection,
      inject: [TELEGRAM_API, HandleTelegramMessage, HandleTelegramCallback, ENV],
      useFactory: (
        api: TelegramApi,
        handler: HandleTelegramMessage,
        callbacks: HandleTelegramCallback,
        env: ApiEnv,
      ) =>
        new TelegramConnection(api, handler, callbacks, {
          url: env.TELEGRAM_WEBHOOK_URL,
          secret: env.TELEGRAM_WEBHOOK_SECRET,
          isProduction: env.NODE_ENV === 'production',
          botUsername: env.TELEGRAM_BOT_USERNAME,
        }),
    },
  ],
})
export class RecipientsModule {}
