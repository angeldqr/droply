/**
 * Un día del calendario, sin hora y sin zona: `AAAA-MM-DD`.
 *
 * Un plan de hábitos razona en días civiles —«el día 7 de 30»—, no en
 * instantes. Guardar un `Date` obligaría a acordarse de la zona en cada
 * comparación, y basta olvidarse una vez para que a alguien en Bogotá el día se
 * le corte a las siete de la tarde.
 *
 * Traducir un instante a uno de estos sí necesita la base de zonas del sistema,
 * y por eso esa conversión vive en infraestructura. Acá solo se cuenta.
 */
export type CivilDay = string;

const PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isCivilDay(value: string): value is CivilDay {
  if (!PATTERN.test(value)) return false;

  // Rechaza el 31 de febrero, que pasa el patrón: `Date.UTC` lo normaliza a
  // marzo, así que si al volver a escribirlo no dice lo mismo, no era una
  // fecha.
  return toIso(toUtc(value)) === value;
}

/** El día `count` días después. Acepta negativos. */
export function addDays(day: CivilDay, count: number): CivilDay {
  return toIso(new Date(toUtc(day).getTime() + count * DAY_MS));
}

/** Cuántos días hay de `from` a `to`. Negativo si `to` es anterior. */
export function daysBetween(from: CivilDay, to: CivilDay): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS);
}

/** Todos los días de `from` a `to`, los dos incluidos. */
export function daysFrom(from: CivilDay, to: CivilDay): CivilDay[] {
  const total = daysBetween(from, to);

  if (total < 0) return [];

  return Array.from({ length: total + 1 }, (_unused, index) => addDays(from, index));
}

/*
 * Los días se comparan como texto y no como fecha, a propósito: en formato
 * `AAAA-MM-DD` el orden alfabético y el cronológico son el mismo, y así una
 * comparación no puede equivocarse de zona.
 */
export function isBefore(day: CivilDay, other: CivilDay): boolean {
  return day < other;
}

export function isAfter(day: CivilDay, other: CivilDay): boolean {
  return day > other;
}

function toUtc(day: CivilDay): Date {
  const [year, month, date] = day.split('-').map(Number);

  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1));
}

function toIso(moment: Date): CivilDay {
  return moment.toISOString().slice(0, 10);
}
