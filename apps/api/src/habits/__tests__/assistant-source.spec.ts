import { beforeEach, describe, expect, it } from 'vitest';
import { habitPlansSource } from '../presentation/assistant-source';
import { ANA, build, OTRO, unPlan, type World } from './support';

let world: World;

beforeEach(() => {
  world = build();
});

describe('los planes que ve el asistente', () => {
  it('lista los planes del dueño con su estado en palabras', async () => {
    const plan = await unPlan(world);

    const listed = (await habitPlansSource(world.read).list(ANA)) as {
      id: string;
      estado: string;
    }[];

    expect(listed.map((row) => row.id)).toEqual([plan.id]);
    expect(listed[0]?.estado).toBe('En marcha');
  });

  it('el plan de otra cuenta no existe para el asistente', async () => {
    const plan = await unPlan(world);

    expect(await habitPlansSource(world.read).detail?.(OTRO, plan.id)).toBeNull();
    expect(await habitPlansSource(world.read).list(OTRO)).toEqual([]);
  });

  it('un id que no tiene forma de id no llega a la base', async () => {
    expect(await habitPlansSource(world.read).detail?.(ANA, 'el plan de Pedro')).toBeNull();
  });
});
