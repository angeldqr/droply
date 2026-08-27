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
  Put,
} from '@nestjs/common';
import {
  createScheduleSchema,
  setFixedItemsSchema,
  updateScheduleSchema,
  type CreateScheduleInput,
  type DayPlanEntryView,
  type FixedItemView,
  type ScheduleView,
  type SetFixedItemsInput,
  type UpdateScheduleInput,
} from '@reconectate/contracts';
import { CurrentUserId } from '../../platform/http/current-user.decorator';
import { ZodBody } from '../../platform/http/zod-body.decorator';
import { InvalidInputError } from '../../shared/domain-error';
import { LibraryId, RecipientId, ScheduleId, type UserId } from '../../shared/identifiers';
import { orThrow } from '../../shared/result';
import { ListFixedItems, PreviewDayPlan, SetFixedItems } from '../application/fixed-item-use-cases';
import {
  CreateSchedule,
  DeleteSchedule,
  ListSchedules,
  UpdateSchedule,
  type ScheduleWithNames,
} from '../application/schedule-use-cases';

@Controller('schedules')
export class SchedulesController {
  constructor(
    @Inject(ListSchedules) private readonly listSchedules: ListSchedules,
    @Inject(CreateSchedule) private readonly createSchedule: CreateSchedule,
    @Inject(UpdateSchedule) private readonly updateSchedule: UpdateSchedule,
    @Inject(DeleteSchedule) private readonly deleteSchedule: DeleteSchedule,
    @Inject(ListFixedItems) private readonly listFixed: ListFixedItems,
    @Inject(SetFixedItems) private readonly setFixed: SetFixedItems,
    @Inject(PreviewDayPlan) private readonly previewDay: PreviewDayPlan,
  ) {}

  @Get()
  async list(@CurrentUserId() userId: UserId): Promise<ScheduleView[]> {
    const rows = await this.listSchedules.execute(userId);

    return rows.map(toView);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUserId() userId: UserId,
    @ZodBody(createScheduleSchema) body: CreateScheduleInput,
  ): Promise<ScheduleView> {
    const schedule = orThrow(
      await this.createSchedule.execute(
        userId,
        {
          libraryId: LibraryId.from(body.libraryId),
          recipientId: RecipientId.from(body.recipientId),
        },
        {
          weekdays: body.weekdays,
          startMinute: body.startMinute,
          endMinute: body.endMinute,
          timezone: body.timezone,
          senderName: body.senderName ?? null,
          kindFilter: body.kindFilter ?? null,
        },
      ),
    );

    // Los nombres los vuelve a leer la pantalla al invalidar; acá no valen dos
    // consultas más solo para responder.
    return toView({ schedule, libraryName: '', recipientLabel: '' });
  }

  @Patch(':scheduleId')
  async update(
    @CurrentUserId() userId: UserId,
    @Param('scheduleId') scheduleId: string,
    @ZodBody(updateScheduleSchema) body: UpdateScheduleInput,
  ): Promise<ScheduleView> {
    const schedule = orThrow(
      await this.updateSchedule.execute(userId, toScheduleId(scheduleId), {
        ...(body.weekdays === undefined ? {} : { weekdays: body.weekdays }),
        ...(body.startMinute === undefined ? {} : { startMinute: body.startMinute }),
        ...(body.endMinute === undefined ? {} : { endMinute: body.endMinute }),
        ...(body.timezone === undefined ? {} : { timezone: body.timezone }),
        ...(body.senderName === undefined ? {} : { senderName: body.senderName ?? null }),
        ...(body.kindFilter === undefined ? {} : { kindFilter: body.kindFilter ?? null }),
        ...(body.active === undefined ? {} : { active: body.active }),
      }),
    );

    return toView({ schedule, libraryName: '', recipientLabel: '' });
  }

  /**
   * Qué sale a qué hora en este horario.
   *
   * Cuelga del horario y no de la biblioteca porque un envío fijo es archivo,
   * hora y persona a la vez: el mismo video puede ir a las 6 para uno y no
   * salir nunca para otro.
   */
  @Get(':scheduleId/fixed-items')
  async fixedItems(
    @CurrentUserId() userId: UserId,
    @Param('scheduleId') scheduleId: string,
  ): Promise<FixedItemView[]> {
    return orThrow(await this.listFixed.execute(userId, toScheduleId(scheduleId)));
  }

  /**
   * El día entero: lo clavado y lo repartido, en orden de hora.
   *
   * Va aparte de `fixed-items` porque responde otra pregunta. Aquella dice qué
   * clavó el dueño; esta dice qué va a salir de verdad, que con la biblioteca
   * entera clavada puede ser bastante menos de lo que uno espera.
   */
  @Get(':scheduleId/day')
  async day(
    @CurrentUserId() userId: UserId,
    @Param('scheduleId') scheduleId: string,
  ): Promise<DayPlanEntryView[]> {
    return orThrow(await this.previewDay.execute(userId, toScheduleId(scheduleId)));
  }

  @Put(':scheduleId/fixed-items')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setFixedItems(
    @CurrentUserId() userId: UserId,
    @Param('scheduleId') scheduleId: string,
    @ZodBody(setFixedItemsSchema) body: SetFixedItemsInput,
  ): Promise<void> {
    orThrow(await this.setFixed.execute(userId, toScheduleId(scheduleId), body.fixedItems));
  }

  @Delete(':scheduleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUserId() userId: UserId,
    @Param('scheduleId') scheduleId: string,
  ): Promise<void> {
    orThrow(await this.deleteSchedule.execute(userId, toScheduleId(scheduleId)));
  }
}

function toScheduleId(raw: string) {
  if (!ScheduleId.is(raw)) {
    throw new InvalidInputError('schedule.id_invalid', 'Ese identificador de horario no vale.');
  }

  return ScheduleId.from(raw);
}

function toView({ schedule, libraryName, recipientLabel }: ScheduleWithNames): ScheduleView {
  return {
    id: schedule.id,
    libraryId: schedule.libraryId,
    libraryName,
    recipientId: schedule.recipientId,
    recipientLabel,
    weekdays: schedule.weekdays,
    startMinute: schedule.startMinute,
    endMinute: schedule.endMinute,
    timezone: schedule.timezone,
    senderName: schedule.senderName,
    kindFilter: schedule.kindFilter,
    active: schedule.active,
    nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
    lastRunAt: schedule.lastRunAt?.toISOString() ?? null,
  };
}
