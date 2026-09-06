import { habitAnswer, habitPlanStatus } from '@reconectate/contracts';
import { describe, expect, it } from 'vitest';
import { HABIT_ANSWERS, HABIT_PLAN_STATUSES } from './vocabulary';
import { HABIT_ANSWERS as SHARED_ANSWERS } from '../../shared/habit-vote';

/**
 * Tres copias del mismo vocabulario, y las tres tienen que decir lo mismo.
 *
 * La del dominio existe porque el núcleo no puede importar el contrato; la de
 * `shared/habit-vote` existe porque el `callback_data` se escribe en un
 * contexto y se lee en otro. Si se separan, el botón seguiría apareciendo y la
 * respuesta se descartaría sin que nada lo diga.
 */
describe('vocabulario de hábitos frente al contrato', () => {
  it('coinciden los estados de un plan', () => {
    expect([...HABIT_PLAN_STATUSES]).toEqual([...habitPlanStatus.values]);
  });

  it('coinciden las respuestas', () => {
    expect([...HABIT_ANSWERS]).toEqual([...habitAnswer.values]);
  });

  it('la copia que viaja en el botón dice lo mismo', () => {
    expect([...SHARED_ANSWERS]).toEqual([...habitAnswer.values]);
  });
});
