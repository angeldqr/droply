import { Global, Logger, Module } from '@nestjs/common';
import { ENV, type ApiEnv } from '../../platform/config/env.module';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { OCCURRENCE_SINK, type DueOccurrenceEvent } from '../../shared/occurrence-sink';
import { DispatchOccurrence } from '../application/dispatch-occurrence';
import {
  DELIVERY_LOG,
  LIBRARY_CATALOG,
  MEDIA_SOURCE,
  MESSAGE_SENDER,
  RANDOMNESS,
  SCHEDULE_READER,
  SENT_BAG,
  type DeliveryLog,
  type LibraryCatalog,
  type MediaSource,
  type MessageSender,
  type ScheduleReader,
  type SentBag,
} from '../domain/ports';
import { systemRandomness, type Randomness } from '../domain/selection';
import {
  PrismaDeliveryLog,
  PrismaLibraryCatalog,
  PrismaScheduleReader,
  PrismaSentBag,
} from '../infrastructure/prisma-delivery.adapters';
import { S3MediaSource } from '../infrastructure/s3-media-source';
import { TelegramMessageSender } from '../infrastructure/telegram-message-sender';
import { DeliveriesController } from './deliveries.controller';

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
  controllers: [DeliveriesController],
  providers: [
    { provide: RANDOMNESS, useValue: systemRandomness },
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
      provide: SENT_BAG,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaSentBag(prisma),
    },
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
        SENT_BAG,
        MEDIA_SOURCE,
        MESSAGE_SENDER,
        DELIVERY_LOG,
        RANDOMNESS,
      ],
      useFactory: (
        schedules: ScheduleReader,
        libraries: LibraryCatalog,
        bag: SentBag,
        media: MediaSource,
        sender: MessageSender,
        log: DeliveryLog,
        random: Randomness,
      ) => new DispatchOccurrence(schedules, libraries, bag, media, sender, log, random),
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
