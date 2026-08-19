import { Global, Logger, Module } from '@nestjs/common';
import { ENV, type ApiEnv } from '../../platform/config/env.module';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { OCCURRENCE_SINK, type DueOccurrenceEvent } from '../../shared/occurrence-sink';
import { CLOCK, type Clock } from '../../shared/clock';
import { DispatchOccurrence } from '../application/dispatch-occurrence';
import { RunDueRetries } from '../application/run-due-retries';
import {
  DELIVERY_LOG,
  LIBRARY_CATALOG,
  MEDIA_SOURCE,
  MESSAGE_SENDER,
  NOTICE_READER,
  NOTICE_WRITER,
  SCHEDULE_READER,
  type DeliveryLog,
  type LibraryCatalog,
  type MediaSource,
  type MessageSender,
  type NoticeWriter,
  type ScheduleReader,
} from '../domain/ports';
import {
  PrismaDeliveryLog,
  PrismaLibraryCatalog,
  PrismaNotices,
  PrismaScheduleReader,
} from '../infrastructure/prisma-delivery.adapters';
import { RetryTicker } from '../infrastructure/retry-ticker';
import { S3MediaSource } from '../infrastructure/s3-media-source';
import { TelegramMessageSender } from '../infrastructure/telegram-message-sender';
import { DeliveriesController } from './deliveries.controller';
import { NoticesController } from './notices.controller';

/**
 * El contexto de envío, y el sumidero que lo une con el del calendario.
 *
 * Es `@Global` por una razón concreta: `scheduling` necesita el sumidero, pero
 * un contexto no puede importar el módulo de otro sin atarse a él. Declarándolo
 * global, el token viaja por el contenedor y `scheduling` solo conoce la
 * interfaz de `shared`, que es todo lo que debería conocer.
 */
@Global()
@Module({
  controllers: [DeliveriesController, NoticesController],
  providers: [
    {
      provide: SCHEDULE_READER,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaScheduleReader(prisma),
    },
    {
      provide: LIBRARY_CATALOG,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaLibraryCatalog(prisma),
    },
    {
      // Un solo adaptador para los dos puertos: es la misma tabla, y quien
      // envía solo ve el de escritura.
      provide: PrismaNotices,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaNotices(prisma),
    },
    { provide: NOTICE_WRITER, inject: [PrismaNotices], useFactory: (n: PrismaNotices) => n },
    { provide: NOTICE_READER, inject: [PrismaNotices], useFactory: (n: PrismaNotices) => n },
    {
      provide: DELIVERY_LOG,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaDeliveryLog(prisma),
    },
    {
      provide: MEDIA_SOURCE,
      inject: [ENV],
      useFactory: (env: ApiEnv) => new S3MediaSource(env),
    },
    {
      provide: MESSAGE_SENDER,
      inject: [ENV],
      useFactory: (env: ApiEnv) => new TelegramMessageSender(env.TELEGRAM_BOT_TOKEN),
    },

    {
      provide: DispatchOccurrence,
      inject: [
        SCHEDULE_READER,
        LIBRARY_CATALOG,
        MEDIA_SOURCE,
        MESSAGE_SENDER,
        DELIVERY_LOG,
        NOTICE_WRITER,
        CLOCK,
      ],
      useFactory: (
        schedules: ScheduleReader,
        libraries: LibraryCatalog,
        media: MediaSource,
        sender: MessageSender,
        log: DeliveryLog,
        notices: NoticeWriter,
        clock: Clock,
      ) => new DispatchOccurrence(schedules, libraries, media, sender, log, notices, clock),
    },
    {
      provide: RunDueRetries,
      inject: [DELIVERY_LOG, DispatchOccurrence, CLOCK],
      useFactory: (log: DeliveryLog, dispatch: DispatchOccurrence, clock: Clock) =>
        new RunDueRetries(log, dispatch, clock),
    },
    {
      provide: RetryTicker,
      inject: [RunDueRetries],
      useFactory: (runDue: RunDueRetries) => new RetryTicker(runDue),
    },

    {
      provide: OCCURRENCE_SINK,
      inject: [DispatchOccurrence],
      useFactory: (dispatch: DispatchOccurrence) => {
        const logger = new Logger('Delivery');

        return {
          async emit(occurrence: DueOccurrenceEvent): Promise<void> {
            /*
             * Un envío que revienta no puede parar el latido: la vuelta atiende
             * hasta cincuenta horarios y el fallo de uno no es asunto de los
             * otros cuarenta y nueve.
             */
            try {
              const outcome = await dispatch.execute(
                occurrence.scheduleId,
                occurrence.occurredAt,
                occurrence.key,
              );

              logger.log(`${occurrence.key} → ${outcome}`);
            } catch (caught) {
              logger.error(`No se pudo despachar ${occurrence.key}.`, caught);
            }
          },
        };
      },
    },
  ],
  exports: [OCCURRENCE_SINK],
})
export class DeliveryModule {}
