import { Module } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CLOCK, type Clock } from '../../shared/clock';
import { OCCURRENCE_SINK, type OccurrenceSink } from '../../shared/occurrence-sink';
import { ID_GENERATOR, type IdGenerator } from '../../shared/identifiers';
import { ListFixedItems, SetFixedItems } from '../application/fixed-item-use-cases';
import { RunDueSchedules } from '../application/run-due-schedules';
import {
  CreateSchedule,
  DeleteSchedule,
  ListSchedules,
  UpdateSchedule,
} from '../application/schedule-use-cases';
import {
  FIXED_ITEM_REPOSITORY,
  LIBRARY_DIRECTORY,
  OCCURRENCE_PLANNER,
  RECIPIENT_DIRECTORY,
  SCHEDULE_REPOSITORY,
  type FixedItemRepository,
  type LibraryDirectory,
  type OccurrencePlanner,
  type RecipientDirectory,
  type ScheduleRepository,
} from '../domain/ports';
import {
  PrismaFixedItemRepository,
  PrismaLibraryDirectory,
  PrismaRecipientDirectory,
} from '../infrastructure/prisma-directories';
import { PrismaScheduleRepository } from '../infrastructure/prisma-schedule.repository';
import { WindowOccurrencePlanner } from '../infrastructure/window-occurrence-planner';
import { ScheduleTicker } from '../infrastructure/schedule-ticker';
import { SchedulesController } from './schedules.controller';

@Module({
  controllers: [SchedulesController],
  providers: [
    { provide: OCCURRENCE_PLANNER, useClass: WindowOccurrencePlanner },
    {
      provide: SCHEDULE_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaScheduleRepository(prisma),
    },
    {
      provide: LIBRARY_DIRECTORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaLibraryDirectory(prisma),
    },
    {
      provide: RECIPIENT_DIRECTORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaRecipientDirectory(prisma),
    },
    {
      provide: FIXED_ITEM_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaFixedItemRepository(prisma),
    },

    {
      provide: ListSchedules,
      inject: [SCHEDULE_REPOSITORY, LIBRARY_DIRECTORY, RECIPIENT_DIRECTORY],
      useFactory: (
        schedules: ScheduleRepository,
        libraries: LibraryDirectory,
        recipients: RecipientDirectory,
      ) => new ListSchedules(schedules, libraries, recipients),
    },
    {
      provide: CreateSchedule,
      inject: [
        SCHEDULE_REPOSITORY,
        LIBRARY_DIRECTORY,
        RECIPIENT_DIRECTORY,
        OCCURRENCE_PLANNER,
        ID_GENERATOR,
        CLOCK,
      ],
      useFactory: (
        schedules: ScheduleRepository,
        libraries: LibraryDirectory,
        recipients: RecipientDirectory,
        planner: OccurrencePlanner,
        ids: IdGenerator,
        clock: Clock,
      ) => new CreateSchedule(schedules, libraries, recipients, planner, ids, clock),
    },
    {
      provide: UpdateSchedule,
      inject: [
        SCHEDULE_REPOSITORY,
        LIBRARY_DIRECTORY,
        OCCURRENCE_PLANNER,
        CLOCK,
        FIXED_ITEM_REPOSITORY,
      ],
      useFactory: (
        schedules: ScheduleRepository,
        libraries: LibraryDirectory,
        planner: OccurrencePlanner,
        clock: Clock,
        fixed: FixedItemRepository,
      ) => new UpdateSchedule(schedules, libraries, planner, clock, fixed),
    },
    {
      provide: ListFixedItems,
      inject: [SCHEDULE_REPOSITORY, FIXED_ITEM_REPOSITORY, LIBRARY_DIRECTORY],
      useFactory: (
        schedules: ScheduleRepository,
        fixed: FixedItemRepository,
        libraries: LibraryDirectory,
      ) => new ListFixedItems(schedules, fixed, libraries),
    },
    {
      provide: SetFixedItems,
      inject: [
        SCHEDULE_REPOSITORY,
        FIXED_ITEM_REPOSITORY,
        LIBRARY_DIRECTORY,
        OCCURRENCE_PLANNER,
        CLOCK,
      ],
      useFactory: (
        schedules: ScheduleRepository,
        fixed: FixedItemRepository,
        libraries: LibraryDirectory,
        planner: OccurrencePlanner,
        clock: Clock,
      ) => new SetFixedItems(schedules, fixed, libraries, planner, clock),
    },
    {
      provide: DeleteSchedule,
      inject: [SCHEDULE_REPOSITORY],
      useFactory: (schedules: ScheduleRepository) => new DeleteSchedule(schedules),
    },
    {
      provide: RunDueSchedules,
      inject: [
        SCHEDULE_REPOSITORY,
        LIBRARY_DIRECTORY,
        OCCURRENCE_PLANNER,
        CLOCK,
        OCCURRENCE_SINK,
        FIXED_ITEM_REPOSITORY,
      ],
      useFactory: (
        schedules: ScheduleRepository,
        libraries: LibraryDirectory,
        planner: OccurrencePlanner,
        clock: Clock,
        sink: OccurrenceSink,
        fixed: FixedItemRepository,
      ) => new RunDueSchedules(schedules, libraries, planner, clock, sink, fixed),
    },
    {
      provide: ScheduleTicker,
      inject: [RunDueSchedules],
      useFactory: (runDue: RunDueSchedules) => new ScheduleTicker(runDue),
    },
  ],
})
export class SchedulingModule {}
