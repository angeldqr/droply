import { describe, expect, it } from 'vitest';
import {
  firstParts,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  pageCount,
  pageQuerySchema,
} from './pagination.js';

describe('pageQuerySchema', () => {
  it('sin parámetros pide la primera página con el tamaño por defecto', () => {
    expect(pageQuerySchema.parse({})).toEqual({ page: 1, pageSize: PAGE_SIZE_DEFAULT });
  });

  it('convierte los números que llegan como texto en la dirección', () => {
    expect(pageQuerySchema.parse({ page: '3', pageSize: '10' })).toEqual({ page: 3, pageSize: 10 });
  });

  it('rechaza la página cero', () => {
    expect(pageQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });

  it('rechaza un tamaño por encima del máximo', () => {
    expect(pageQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
    expect(pageQuerySchema.safeParse({ pageSize: String(PAGE_SIZE_MAX) }).success).toBe(true);
  });

  it('rechaza lo que no es un número entero', () => {
    expect(pageQuerySchema.safeParse({ page: 'dos' }).success).toBe(false);
    expect(pageQuerySchema.safeParse({ page: '1.5' }).success).toBe(false);
  });
});

describe('pageCount', () => {
  it('redondea hacia arriba, y con nada sigue habiendo una página', () => {
    expect(pageCount(45, 20)).toBe(3);
    expect(pageCount(40, 20)).toBe(2);
    expect(pageCount(0, 20)).toBe(1);
  });
});

describe('firstParts', () => {
  const forty = Array.from({ length: 40 }, (_, index) => index + 1);

  it('una lista corta se muestra entera y no deja nada por ver', () => {
    expect(firstParts([1, 2, 3], 1, 10)).toEqual({ shown: [1, 2, 3], remaining: 0 });
  });

  it('la primera parte trae el tamaño pedido y dice cuántos quedan', () => {
    const { shown, remaining } = firstParts(forty, 1, 10);

    expect(shown).toEqual(forty.slice(0, 10));
    expect(remaining).toBe(30);
  });

  it('cada «ver más» suma una parte debajo de lo que ya se veía', () => {
    expect(firstParts(forty, 2, 10).shown).toEqual(forty.slice(0, 20));
    expect(firstParts(forty, 4, 10).remaining).toBe(0);
  });

  it('nunca cambia la lista original, que es la que usan los resúmenes', () => {
    firstParts(forty, 1, 10);

    expect(forty).toHaveLength(40);
  });
});
