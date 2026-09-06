import {
  HABIT_PLAN_DURATIONS,
  HABIT_PLAN_LIBRARIES_MAX,
  HABIT_PLAN_NAME_MAX_LENGTH,
} from '@reconectate/contracts';
import { MAX_PER_ACCOUNT as LIBRARIES_PER_ACCOUNT } from '../../libraries/domain/library';
import { describe, expect, it } from 'vitest';
import { DURATIONS, LIBRARIES_MAX, NAME_MAX_LENGTH } from './habit-plan';

/**
 * Los topes están escritos dos veces y tienen que decir lo mismo.
 *
 * El núcleo no puede importar `@reconectate/contracts`, así que el dominio
 * lleva su copia y el contrato la suya —la que el navegador usa para poner el
 * `maxLength` de los campos y las opciones del desplegable—. Si se separan, el
 * usuario escribe algo que la pantalla acepta y el servidor rechaza, o al revés,
 * y el fallo aparece en un formulario que se veía bien.
 *
 * Es el mismo guardián que ya tienen `libraries/domain/limits.spec.ts` y los
 * vocabularios de `scheduling` y `delivery`.
 */
describe('topes de un plan frente al contrato', () => {
  it('coincide el largo del nombre', () => {
    expect(NAME_MAX_LENGTH).toBe(HABIT_PLAN_NAME_MAX_LENGTH);
  });

  it('coinciden cuántas bibliotecas caben', () => {
    expect(LIBRARIES_MAX).toBe(HABIT_PLAN_LIBRARIES_MAX);
  });

  it('coinciden los cuatro plazos, y en el mismo orden', () => {
    expect([...DURATIONS]).toEqual([...HABIT_PLAN_DURATIONS]);
  });

  /*
   * Y el tope de bibliotecas por plan no puede ser mayor que el de bibliotecas
   * por cuenta: si lo fuera, el número de la pantalla prometería algo que la
   * cuenta no puede tener. Existe solo para que el borde HTTP no acepte un
   * arreglo sin fondo.
   */
  it('nunca puede morder: cabe todo lo que una cuenta puede tener', () => {
    expect(LIBRARIES_MAX).toBeGreaterThanOrEqual(LIBRARIES_PER_ACCOUNT);
  });
});
