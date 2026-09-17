import { Global, Module } from '@nestjs/common';
import { ENV, type ApiEnv } from '../../platform/config/env.module';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CLOCK, type Clock } from '../../shared/clock';
import { ID_GENERATOR, type IdGenerator } from '../../shared/identifiers';
import { JOURNAL_INBOX } from '../../shared/journal-inbox';
import {
  IssueChatLink,
  LinkAccountChat,
  ReadChatLink,
  UnlinkChat,
} from '../application/account-chat-use-cases';
import {
  CreateHabit,
  DeleteEntry,
  DeleteHabit,
  PauseHabit,
  ReadJournal,
  ResumeHabit,
  UpdateHabit,
} from '../application/habit-use-cases';
import { JournalConversation } from '../application/journal-conversation';
import {
  ACCOUNT_CHAT_REPOSITORY,
  CHAT_VOICE,
  ENTRY_REPOSITORY,
  HABIT_REPOSITORY,
  JOURNAL_ACCOUNT_STATUS,
  JOURNAL_LINK_CODES,
  JOURNAL_PHOTOS,
  type AccountChatRepository,
  type AccountStatus,
  type ChatVoice,
  type EntryRepository,
  type HabitRepository,
  type JournalPhotos,
  type LinkCodeFactory,
} from '../domain/ports';
import {
  PrismaAccountChatRepository,
  PrismaEntryRepository,
  PrismaHabitRepository,
  PrismaJournalAccountStatus,
  Sha256JournalLinkCodes,
} from '../infrastructure/prisma-journal.repository';
import { S3JournalPhotos } from '../infrastructure/s3-journal-photos';
import { TelegramChatVoice } from '../infrastructure/telegram-chat-voice';
import { JournalController } from './journal.controller';

/**
 * La bitácora, y la puerta por la que le llega lo que el usuario escribe.
 *
 * Es `@Global` por la misma razón que `DeliveryModule` y `HabitsModule`:
 * `recipients` tiene la puerta del bot y necesita darle primera opción a la
 * bitácora sobre cada mensaje, pero un contexto no puede importar el módulo de
 * otro sin atarse a él. Declarando el token global, `recipients` solo conoce la
 * interfaz de `shared`.
 */
@Global()
@Module({
  controllers: [JournalController],
  providers: [
    { provide: JOURNAL_LINK_CODES, useClass: Sha256JournalLinkCodes },
    {
      provide: HABIT_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaHabitRepository(prisma),
    },
    {
      provide: ENTRY_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaEntryRepository(prisma),
    },
    {
      provide: ACCOUNT_CHAT_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaAccountChatRepository(prisma),
    },
    {
      provide: JOURNAL_ACCOUNT_STATUS,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaJournalAccountStatus(prisma),
    },
    {
      provide: JOURNAL_PHOTOS,
      inject: [ENV],
      useFactory: (env: ApiEnv) => new S3JournalPhotos(env),
    },
    {
      provide: CHAT_VOICE,
      inject: [ENV],
      useFactory: (env: ApiEnv) => new TelegramChatVoice(env.TELEGRAM_BOT_TOKEN),
    },

    {
      provide: CreateHabit,
      inject: [HABIT_REPOSITORY, ID_GENERATOR, CLOCK],
      useFactory: (habits: HabitRepository, ids: IdGenerator, clock: Clock) =>
        new CreateHabit(habits, ids, clock),
    },
    {
      provide: UpdateHabit,
      inject: [HABIT_REPOSITORY],
      useFactory: (habits: HabitRepository) => new UpdateHabit(habits),
    },
    {
      provide: PauseHabit,
      inject: [HABIT_REPOSITORY, CLOCK],
      useFactory: (habits: HabitRepository, clock: Clock) => new PauseHabit(habits, clock),
    },
    {
      provide: ResumeHabit,
      inject: [HABIT_REPOSITORY, CLOCK],
      useFactory: (habits: HabitRepository, clock: Clock) => new ResumeHabit(habits, clock),
    },
    {
      provide: DeleteHabit,
      inject: [HABIT_REPOSITORY, ENTRY_REPOSITORY, JOURNAL_PHOTOS],
      useFactory: (habits: HabitRepository, entries: EntryRepository, photos: JournalPhotos) =>
        new DeleteHabit(habits, entries, photos),
    },
    {
      provide: DeleteEntry,
      inject: [ENTRY_REPOSITORY, JOURNAL_PHOTOS],
      useFactory: (entries: EntryRepository, photos: JournalPhotos) =>
        new DeleteEntry(entries, photos),
    },
    {
      provide: ReadJournal,
      inject: [HABIT_REPOSITORY, ENTRY_REPOSITORY, JOURNAL_PHOTOS, CLOCK],
      useFactory: (
        habits: HabitRepository,
        entries: EntryRepository,
        photos: JournalPhotos,
        clock: Clock,
      ) => new ReadJournal(habits, entries, photos, clock),
    },

    {
      provide: IssueChatLink,
      inject: [ACCOUNT_CHAT_REPOSITORY, JOURNAL_ACCOUNT_STATUS, JOURNAL_LINK_CODES, CLOCK],
      useFactory: (
        chats: AccountChatRepository,
        accounts: AccountStatus,
        codes: LinkCodeFactory,
        clock: Clock,
      ) => new IssueChatLink(chats, accounts, codes, clock),
    },
    {
      provide: ReadChatLink,
      inject: [ACCOUNT_CHAT_REPOSITORY],
      useFactory: (chats: AccountChatRepository) => new ReadChatLink(chats),
    },
    {
      provide: UnlinkChat,
      inject: [ACCOUNT_CHAT_REPOSITORY],
      useFactory: (chats: AccountChatRepository) => new UnlinkChat(chats),
    },
    {
      provide: LinkAccountChat,
      inject: [ACCOUNT_CHAT_REPOSITORY, JOURNAL_LINK_CODES, CLOCK],
      useFactory: (chats: AccountChatRepository, codes: LinkCodeFactory, clock: Clock) =>
        new LinkAccountChat(chats, codes, clock),
    },

    {
      provide: JOURNAL_INBOX,
      inject: [
        ACCOUNT_CHAT_REPOSITORY,
        HABIT_REPOSITORY,
        ENTRY_REPOSITORY,
        JOURNAL_PHOTOS,
        CHAT_VOICE,
        LinkAccountChat,
        ID_GENERATOR,
        CLOCK,
      ],
      useFactory: (
        chats: AccountChatRepository,
        habits: HabitRepository,
        entries: EntryRepository,
        photos: JournalPhotos,
        voice: ChatVoice,
        linkChat: LinkAccountChat,
        ids: IdGenerator,
        clock: Clock,
      ) => new JournalConversation(chats, habits, entries, photos, voice, linkChat, ids, clock),
    },
  ],
  exports: [JOURNAL_INBOX],
})
export class JournalModule {}
