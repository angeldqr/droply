import { describe, expect, it } from 'vitest';
import { averagePercent, percentOf, scoreDay, VALUE_OF } from './scoring';

describe('cuánto vale una respuesta', () => {
  it('realizado vale uno, a medias medio, no cumplido cero', () => {
    expect(VALUE_OF).toEqual({ DONE: 1, HALF: 0.5, MISSED: 0 });
  });

  /*
   * El ejemplo literal del cliente: «si se envían para esa biblioteca cien
   * archivos, cada uno tendrá el valor del 1% si es marcado como Realizado».
   */
  it('con cien archivos, cada realizado vale un uno por ciento', () => {
    const answers = Array.from({ length: 37 }, () => 'DONE' as const);

    expect(percentOf(scoreDay(100, answers))).toBe(37);
  });

  it('lo que no se responde cuenta cero, igual que no cumplido', () => {
    const soloUna = percentOf(scoreDay(4, ['DONE']));
    const conNegativas = percentOf(scoreDay(4, ['DONE', 'MISSED', 'MISSED', 'MISSED']));

    expect(soloUna).toBe(25);
    expect(conNegativas).toBe(25);
  });

  it('el botón del medio vale la mitad', () => {
    expect(percentOf(scoreDay(2, ['DONE', 'HALF']))).toBe(75);
  });
});

describe('los días que no cuentan', () => {
  /*
   * Un día sin envíos no es un cero. El horario no corre los domingos, o la
   * biblioteca estaba vacía: contarlo como fallo hundiría el promedio de un
   * plan de treinta días con los ocho días en que no tenía nada que hacer.
   */
  it('un día sin envíos no da porcentaje', () => {
    expect(percentOf(scoreDay(0, []))).toBeNull();
  });

  it('los días sin envíos quedan fuera del promedio', () => {
    expect(averagePercent([100, null, 50, null])).toBe(75);
  });

  it('sin ningún día que cuente, no hay promedio', () => {
    expect(averagePercent([null, null])).toBeNull();
    expect(averagePercent([])).toBeNull();
  });
});

describe('el promedio del plan', () => {
  /*
   * Se promedian porcentajes y no archivos, y es la diferencia que importa: un
   * hábito de cien fotos y otro de dos audios pesan lo mismo, porque los dos
   * son un hábito. Sumando archivos, el de cien decidiría el plan él solo.
   */
  it('cada hábito pesa igual, tenga los archivos que tenga', () => {
    const muchos = percentOf(
      scoreDay(
        100,
        Array.from({ length: 100 }, () => 'DONE' as const),
      ),
    );
    const pocos = percentOf(scoreDay(2, []));

    expect(averagePercent([muchos, pocos])).toBe(50);
  });

  it('redondea a un decimal', () => {
    expect(percentOf(scoreDay(3, ['DONE']))).toBe(33.3);
  });
});
