import { Module } from '@nestjs/common';
import { ENV, type ApiEnv } from '../../platform/config/env.module';
import { PrismaService } from '../../platform/prisma/prisma.service';
import {
  DELIVERIES_SOURCE,
  HABIT_PLANS_SOURCE,
  JOURNAL_SOURCE,
  LIBRARIES_SOURCE,
  RECIPIENTS_SOURCE,
  SCHEDULES_SOURCE,
  type AssistantSource,
} from '../../shared/assistant-source';
import { CLOCK, type Clock } from '../../shared/clock';
import { AskAssistant } from '../application/ask-assistant';
import {
  ASSISTANT_ACCOUNT_READER,
  ASSISTANT_MODEL,
  type AccountReader,
  type AssistantModel,
} from '../domain/ports';
import { GroqAssistantModel } from '../infrastructure/groq-assistant-model';
import { PrismaAssistantAccountReader } from '../infrastructure/prisma-account-reader';
import { AssistantController } from './assistant.controller';

/**
 * El asistente del chat. No tiene datos propios: lee los de los demás contextos
 * por los puertos que cada uno exporta en `shared/assistant-source.ts`.
 */
@Module({
  controllers: [AssistantController],
  providers: [
    {
      provide: ASSISTANT_MODEL,
      inject: [ENV],
      // Sin clave, el asistente responde "no disponible" en vez de impedir que
      // arranque el resto de la aplicación.
      useFactory: (env: ApiEnv): AssistantModel | null =>
        env.GROQ_API_KEY ? new GroqAssistantModel(env.GROQ_API_KEY) : null,
    },
    {
      provide: ASSISTANT_ACCOUNT_READER,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaAssistantAccountReader(prisma),
    },
    {
      provide: AskAssistant,
      inject: [
        ASSISTANT_MODEL,
        HABIT_PLANS_SOURCE,
        JOURNAL_SOURCE,
        LIBRARIES_SOURCE,
        RECIPIENTS_SOURCE,
        SCHEDULES_SOURCE,
        DELIVERIES_SOURCE,
        ASSISTANT_ACCOUNT_READER,
        CLOCK,
      ],
      useFactory: (
        model: AssistantModel | null,
        habitPlans: AssistantSource,
        journal: AssistantSource,
        libraries: AssistantSource,
        recipients: AssistantSource,
        schedules: AssistantSource,
        deliveries: AssistantSource,
        accounts: AccountReader,
        clock: Clock,
      ) =>
        new AskAssistant(
          model,
          { habitPlans, journal, libraries, recipients, schedules, deliveries },
          accounts,
          clock,
        ),
    },
  ],
})
export class AssistantModule {}
