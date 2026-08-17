/**
 * El dominio nunca llama a `new Date()`. Todo lo que dependa del tiempo pasa
 * por acá, así los tests de horarios y expiraciones son deterministas.
 */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('Clock');

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** Reloj de mentira para tests: arranca donde le digas y avanza a mano. */
export class FixedClock implements Clock {
  private current: Date;

  constructor(start: Date) {
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  advanceBy(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }

  set(moment: Date): void {
    this.current = new Date(moment);
  }
}
