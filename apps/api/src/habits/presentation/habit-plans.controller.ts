import { Controller, Get, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import {
  createHabitPlanSchema,
  habitPlanStatus,
  type CreateHabitPlanInput,
  type HabitPlanDetail,
  type HabitPlanSummary,
} from '@reconectate/contracts';
import { CurrentUserId } from '../../platform/http/current-user.decorator';
import { ZodBody } from '../../platform/http/zod-body.decorator';
import { HabitPlanId, LibraryId, RecipientId, type UserId } from '../../shared/identifiers';
import { orThrow } from '../../shared/result';
import {
  CancelHabitPlan,
  CreateHabitPlan,
  ReadHabitPlans,
  type PlanView,
} from '../application/habit-plan-use-cases';
import { SendPlanReport } from '../application/close-due-days';

/**
 * Los planes de hábitos.
 *
 * **No hay `PATCH` ni `DELETE`, y es la decisión de diseño de este contexto.**
 * Un plan no se edita: sus bibliotecas y su fecha de cierre son lo que hace que
 * el número del final signifique algo, y un plan al que se le cambian los
 * hábitos a mitad de camino mide algo distinto cada semana. La salida antes de
 * tiempo es anularlo, que libera las bibliotecas y deja lo contado a la vista.
 * Que la interfaz no muestre el botón sería un aviso; que la API no tenga la
 * ruta es una propiedad.
 */
@Controller('habit-plans')
export class HabitPlansController {
  constructor(
    @Inject(ReadHabitPlans) private readonly read: ReadHabitPlans,
    @Inject(CreateHabitPlan) private readonly createPlan: CreateHabitPlan,
    @Inject(CancelHabitPlan) private readonly cancelPlan: CancelHabitPlan,
    @Inject(SendPlanReport) private readonly sendReport: SendPlanReport,
  ) {}

  @Get()
  async list(@CurrentUserId() userId: UserId): Promise<HabitPlanSummary[]> {
    const plans = await this.read.list(userId);

    return plans.map(toSummary);
  }

  @Get(':planId')
  async detail(
    @CurrentUserId() userId: UserId,
    @Param('planId') planId: string,
  ): Promise<HabitPlanDetail> {
    return toDetail(orThrow(await this.read.detail(userId, HabitPlanId.from(planId))));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUserId() userId: UserId,
    @ZodBody(createHabitPlanSchema) body: CreateHabitPlanInput,
  ): Promise<HabitPlanSummary> {
    const plan = orThrow(
      await this.createPlan.execute(
        userId,
        {
          name: body.name,
          // La marca se pone acá, en el borde, y no dentro del caso de uso: es
          // el único sitio donde entra texto de fuera, y a partir de acá el tipo
          // impide cruzar un identificador con otro.
          recipientId: RecipientId.from(body.recipientId),
          durationDays: body.durationDays,
          libraryIds: body.libraryIds.map((id) => LibraryId.from(id)),
        },
        body.timezone,
      ),
    );

    return toSummary(orThrow(await this.read.detail(userId, plan.id)));
  }

  @Post(':planId/cancel')
  async cancel(
    @CurrentUserId() userId: UserId,
    @Param('planId') planId: string,
  ): Promise<HabitPlanSummary> {
    const id = HabitPlanId.from(planId);

    orThrow(await this.cancelPlan.execute(userId, id));

    return toSummary(orThrow(await this.read.detail(userId, id)));
  }

  /**
   * Vuelve a mandar el informe de un plan terminado.
   *
   * Es lo único que se puede pedirle a un plan cerrado. Devuelve 204 porque lo
   * que cambia no está acá sino en el chat de la otra persona.
   */
  @Post(':planId/report')
  @HttpCode(HttpStatus.NO_CONTENT)
  async report(@CurrentUserId() userId: UserId, @Param('planId') planId: string): Promise<void> {
    orThrow(await this.sendReport.execute(userId, HabitPlanId.from(planId)));
  }
}

function toSummary(view: PlanView): HabitPlanSummary {
  return {
    id: view.id,
    name: view.name,
    recipientId: view.recipientId,
    recipientLabel: view.recipientLabel,
    durationDays: view.durationDays,
    timezone: view.timezone,
    startOn: view.startOn,
    endOn: view.endOn,
    // El estado sale del dominio, que tiene su propia copia del vocabulario; el
    // guardián de `domain/vocabulary.spec.ts` es quien ata las dos listas.
    status: habitPlanStatus.is(view.status) ? view.status : 'ACTIVE',
    dayNumber: view.dayNumber,
    libraryIds: view.habits.map((habit) => habit.libraryId),
    percent: view.percent,
    reportSentAt: view.reportSentAt?.toISOString() ?? null,
  };
}

function toDetail(view: PlanView): HabitPlanDetail {
  return {
    ...toSummary(view),
    habits: view.habits.map((habit) => ({
      libraryId: habit.libraryId,
      label: habit.label,
      percent: habit.percent,
      days: habit.days,
    })),
  };
}
