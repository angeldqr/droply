import { Global, Module } from '@nestjs/common';
import { ENV, type ApiEnv } from '../../platform/config/env.module';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CLOCK, type Clock } from '../../shared/clock';
import { HABIT_VOTE_SINK } from '../../shared/habit-vote-sink';
import { ID_GENERATOR, type IdGenerator } from '../../shared/identifiers';
import { CastHabitVote } from '../application/cast-habit-vote';
import { CloseDueDays, SendPlanReport } from '../application/close-due-days';
import { ScoreADay } from '../application/score-a-day';
import {
  CancelHabitPlan,
  CreateHabitPlan,
  ReadHabitPlans,
} from '../application/habit-plan-use-cases';
import {
  DAY_CALENDAR,
  DELIVERY_DIRECTORY,
  HABIT_LIBRARY_DIRECTORY,
  HABIT_PLAN_REPOSITORY,
  HABIT_RECIPIENT_DIRECTORY,
  PLAN_NOTIFIER,
  RESPONSE_STORE,
  SCORE_STORE,
  type DayCalendar,
  type DeliveryDirectory,
  type HabitPlanRepository,
  type LibraryDirectory,
  type PlanNotifier,
  type RecipientDirectory,
  type ResponseStore,
  type ScoreStore,
} from '../domain/ports';
import { HabitTicker } from '../infrastructure/habit-ticker';
import { LuxonDayCalendar } from '../infrastructure/luxon-day-calendar';
import {
  PrismaDeliveryDirectory,
  PrismaHabitLibraryDirectory,
  PrismaHabitRecipientDirectory,
  PrismaResponseStore,
  PrismaScoreStore,
} from '../infrastructure/prisma-directories';
import { PrismaHabitPlanRepository } from '../infrastructure/prisma-habit.repository';
import { TelegramPlanNotifier } from '../infrastructure/telegram-plan-notifier';
import { HabitPlansController } from './habit-plans.controller';

/**
 * Los planes de hábitos, y el sumidero por el que les llegan las respuestas.
 *
 * Es `@Global` por la misma razón que `DeliveryModule`: `recipients` tiene la
 * puerta del bot y necesita entregar los toques de los botones, pero un
 * contexto no puede importar el módulo de otro sin atarse a él. Declarando el
 * token global, `recipients` solo conoce la interfaz de `shared`, que es todo
 * lo que debería conocer.
 */
@Global()
@Module({
  controllers: [HabitPlansController],
  providers: [
    { provide: DAY_CALENDAR, useClass: LuxonDayCalendar },
    {
      provide: HABIT_PLAN_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaHabitPlanRepository(prisma),
    },
    {
      provide: HABIT_LIBRARY_DIRECTORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaHabitLibraryDirectory(prisma),
    },
    {
      provide: HABIT_RECIPIENT_DIRECTORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaHabitRecipientDirectory(prisma),
    },
    {
      provide: DELIVERY_DIRECTORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaDeliveryDirectory(prisma),
    },
    {
      provide: RESPONSE_STORE,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaResponseStore(prisma),
    },
    {
      provide: SCORE_STORE,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaScoreStore(prisma),
    },
    {
      provide: PLAN_NOTIFIER,
      inject: [ENV],
      useFactory: (env: ApiEnv) => new TelegramPlanNotifier(env.TELEGRAM_BOT_TOKEN),
    },

    {
      // Contar un día es lo que comparten el latido, anular un plan y la
      // pantalla de detalle. Vive una vez y los tres lo piden.
      provide: ScoreADay,
      inject: [HABIT_PLAN_REPOSITORY, DELIVERY_DIRECTORY, RESPONSE_STORE, DAY_CALENDAR],
      useFactory: (
        plans: HabitPlanRepository,
        deliveries: DeliveryDirectory,
        responses: ResponseStore,
        calendar: DayCalendar,
      ) => new ScoreADay(plans, deliveries, responses, calendar),
    },
    {
      provide: CreateHabitPlan,
      inject: [
        HABIT_PLAN_REPOSITORY,
        HABIT_LIBRARY_DIRECTORY,
        HABIT_RECIPIENT_DIRECTORY,
        DAY_CALENDAR,
        ID_GENERATOR,
        CLOCK,
      ],
      useFactory: (
        plans: HabitPlanRepository,
        libraries: LibraryDirectory,
        recipients: RecipientDirectory,
        calendar: DayCalendar,
        ids: IdGenerator,
        clock: Clock,
      ) => new CreateHabitPlan(plans, libraries, recipients, calendar, ids, clock),
    },
    {
      provide: CancelHabitPlan,
      inject: [HABIT_PLAN_REPOSITORY, ScoreADay, DAY_CALENDAR, CLOCK],
      useFactory: (
        plans: HabitPlanRepository,
        scoreADay: ScoreADay,
        calendar: DayCalendar,
        clock: Clock,
      ) => new CancelHabitPlan(plans, scoreADay, calendar, clock),
    },
    {
      provide: ReadHabitPlans,
      inject: [
        HABIT_PLAN_REPOSITORY,
        SCORE_STORE,
        ScoreADay,
        HABIT_RECIPIENT_DIRECTORY,
        DAY_CALENDAR,
        CLOCK,
      ],
      useFactory: (
        plans: HabitPlanRepository,
        scores: ScoreStore,
        scoreADay: ScoreADay,
        recipients: RecipientDirectory,
        calendar: DayCalendar,
        clock: Clock,
      ) => new ReadHabitPlans(plans, scores, scoreADay, recipients, calendar, clock),
    },
    {
      provide: CloseDueDays,
      inject: [
        HABIT_PLAN_REPOSITORY,
        ScoreADay,
        SCORE_STORE,
        HABIT_RECIPIENT_DIRECTORY,
        PLAN_NOTIFIER,
        DAY_CALENDAR,
        CLOCK,
      ],
      useFactory: (
        plans: HabitPlanRepository,
        scoreADay: ScoreADay,
        scores: ScoreStore,
        recipients: RecipientDirectory,
        notifier: PlanNotifier,
        calendar: DayCalendar,
        clock: Clock,
      ) => new CloseDueDays(plans, scoreADay, scores, recipients, notifier, calendar, clock),
    },
    {
      provide: SendPlanReport,
      inject: [HABIT_PLAN_REPOSITORY, SCORE_STORE, HABIT_RECIPIENT_DIRECTORY, PLAN_NOTIFIER, CLOCK],
      useFactory: (
        plans: HabitPlanRepository,
        scores: ScoreStore,
        recipients: RecipientDirectory,
        notifier: PlanNotifier,
        clock: Clock,
      ) => new SendPlanReport(plans, scores, recipients, notifier, clock),
    },
    {
      provide: HabitTicker,
      inject: [CloseDueDays],
      useFactory: (closeDue: CloseDueDays) => new HabitTicker(closeDue),
    },

    {
      provide: HABIT_VOTE_SINK,
      inject: [HABIT_PLAN_REPOSITORY, RESPONSE_STORE, DAY_CALENDAR, CLOCK],
      useFactory: (
        plans: HabitPlanRepository,
        responses: ResponseStore,
        calendar: DayCalendar,
        clock: Clock,
      ) => new CastHabitVote(plans, responses, calendar, clock),
    },
  ],
  exports: [HABIT_VOTE_SINK],
})
export class HabitsModule {}
