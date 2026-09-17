import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  createHabitSchema,
  updateHabitSchema,
  type AccountChatView,
  type CreateHabitBody,
  type HabitEntryView,
  type HabitView,
  type UpdateHabitInput,
} from '@reconectate/contracts';
import { ENV, type ApiEnv } from '../../platform/config/env.module';
import { CurrentUserId } from '../../platform/http/current-user.decorator';
import { ZodBody } from '../../platform/http/zod-body.decorator';
import { HabitEntryId, HabitId, type UserId } from '../../shared/identifiers';
import { err, ok, orThrow } from '../../shared/result';
import { HabitNotFound } from '../domain/errors';
import { IssueChatLink, ReadChatLink, UnlinkChat } from '../application/account-chat-use-cases';
import {
  CreateHabit,
  DeleteEntry,
  DeleteHabit,
  PauseHabit,
  ReadJournal,
  ResumeHabit,
  UpdateHabit,
  type EntryRow,
  type HabitRow,
} from '../application/habit-use-cases';

/**
 * La bitácora desde la aplicación.
 *
 * Acá solo se administran los hábitos y se lee lo anotado: **nada de esto
 * escribe una anotación**. Las anotaciones entran por el chat y solo por el
 * chat, que es justo lo que pidió el cliente.
 */
@Controller('journal')
export class JournalController {
  constructor(
    @Inject(ENV) private readonly env: ApiEnv,
    @Inject(ReadJournal) private readonly read: ReadJournal,
    @Inject(CreateHabit) private readonly createHabit: CreateHabit,
    @Inject(UpdateHabit) private readonly updateHabit: UpdateHabit,
    @Inject(DeleteHabit) private readonly deleteHabit: DeleteHabit,
    @Inject(PauseHabit) private readonly pauseHabit: PauseHabit,
    @Inject(ResumeHabit) private readonly resumeHabit: ResumeHabit,
    @Inject(DeleteEntry) private readonly deleteEntry: DeleteEntry,
    @Inject(IssueChatLink) private readonly issueLink: IssueChatLink,
    @Inject(ReadChatLink) private readonly readLink: ReadChatLink,
    @Inject(UnlinkChat) private readonly unlink: UnlinkChat,
  ) {}

  @Get('habits')
  async list(@CurrentUserId() userId: UserId): Promise<HabitView[]> {
    return (await this.read.list(userId)).map(toHabitView);
  }

  @Post('habits')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUserId() userId: UserId,
    @ZodBody(createHabitSchema) body: CreateHabitBody,
  ): Promise<HabitView> {
    const habit = orThrow(await this.createHabit.execute(userId, body));

    return this.viewOf(userId, habit.id);
  }

  @Patch('habits/:habitId')
  async update(
    @CurrentUserId() userId: UserId,
    @Param('habitId') habitId: string,
    @ZodBody(updateHabitSchema) body: UpdateHabitInput,
  ): Promise<HabitView> {
    // La marca se pone en el borde, que es el único sitio donde entra texto de
    // fuera; a partir de acá el tipo impide cruzar un identificador con otro.
    const habit = orThrow(await this.updateHabit.execute(userId, HabitId.from(habitId), body));

    return this.viewOf(userId, habit.id);
  }

  @Post('habits/:habitId/pause')
  @HttpCode(HttpStatus.OK)
  async pause(
    @CurrentUserId() userId: UserId,
    @Param('habitId') habitId: string,
  ): Promise<HabitView> {
    const habit = orThrow(await this.pauseHabit.execute(userId, HabitId.from(habitId)));

    return this.viewOf(userId, habit.id);
  }

  @Post('habits/:habitId/resume')
  @HttpCode(HttpStatus.OK)
  async resume(
    @CurrentUserId() userId: UserId,
    @Param('habitId') habitId: string,
  ): Promise<HabitView> {
    const habit = orThrow(await this.resumeHabit.execute(userId, HabitId.from(habitId)));

    return this.viewOf(userId, habit.id);
  }

  /** La fila recién escrita, tal como la pinta la lista. */
  private async viewOf(userId: UserId, habitId: string): Promise<HabitView> {
    const row = (await this.read.list(userId)).find((habit) => habit.id === habitId);

    return toHabitView(orThrow(row ? ok(row) : err(new HabitNotFound())));
  }

  @Delete('habits/:habitId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUserId() userId: UserId, @Param('habitId') habitId: string): Promise<void> {
    orThrow(await this.deleteHabit.execute(userId, HabitId.from(habitId)));
  }

  @Get('habits/:habitId/entries')
  async entries(
    @CurrentUserId() userId: UserId,
    @Param('habitId') habitId: string,
  ): Promise<HabitEntryView[]> {
    const rows = orThrow(await this.read.entriesOf(userId, HabitId.from(habitId)));

    return rows.map(toEntryView);
  }

  @Delete('entries/:entryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeEntry(
    @CurrentUserId() userId: UserId,
    @Param('entryId') entryId: string,
  ): Promise<void> {
    orThrow(await this.deleteEntry.execute(userId, HabitEntryId.from(entryId)));
  }

  @Get('chat')
  async chat(@CurrentUserId() userId: UserId): Promise<AccountChatView> {
    const state = await this.readLink.execute(userId);

    // Sin `linkUrl`: el código se guarda hasheado y no se puede volver a
    // mostrar. Para verlo otra vez hay que pedir uno nuevo, igual que con los
    // destinatarios.
    return {
      linked: state.linked,
      linkUrl: null,
      linkExpiresAt: state.expiresAt?.toISOString() ?? null,
    };
  }

  @Post('chat/link')
  async link(@CurrentUserId() userId: UserId): Promise<AccountChatView> {
    const issued = orThrow(await this.issueLink.execute(userId));

    return {
      linked: false,
      linkUrl: `https://t.me/${this.env.TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(issued.code)}`,
      linkExpiresAt: issued.expiresAt.toISOString(),
    };
  }

  @Delete('chat')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(@CurrentUserId() userId: UserId): Promise<void> {
    await this.unlink.execute(userId);
  }
}

function toHabitView(row: HabitRow): HabitView {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    dailyTarget: row.dailyTarget,
    activeDays: row.activeDays,
    createdAt: row.createdAt.toISOString(),
    entryCount: row.entryCount,
    lastEntryAt: row.lastEntryAt?.toISOString() ?? null,
    today: row.today,
    week: row.week,
    streak: row.streak,
    paused: row.paused,
    pauses: row.pauses,
  };
}

function toEntryView(row: EntryRow): HabitEntryView {
  return {
    id: row.id,
    note: row.note,
    photos: row.photos,
    openedAt: row.openedAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
  };
}
