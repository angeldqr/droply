import { Global, Module } from '@nestjs/common';
import { CLOCK, SystemClock } from '../../shared/clock';
import { ID_GENERATOR } from '../../shared/identifiers';
import { UuidGenerator } from './uuid-generator';

/**
 * El reloj y el generador de identificadores los usa todo contexto que cree
 * entidades. Se proveen una sola vez y de forma global: repetirlos en cada
 * módulo daría instancias distintas y, en los tests, relojes que no se pueden
 * fijar desde un mismo lugar.
 */
@Global()
@Module({
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: UuidGenerator },
  ],
  exports: [CLOCK, ID_GENERATOR],
})
export class KernelModule {}
