/** La primera y la última hora de los avisos, en minutos desde medianoche. */
const FIRST_MINUTE = 8 * 60;
const LAST_MINUTE = 20 * 60;

/**
 * A qué minutos del día sale cada aviso de progreso: repartidos parejo entre
 * las 8 y las 20. Uno solo sale a las 20, cuando ya se puede decir cómo fue
 * el día; con tres, a las 8, a las 14 y a las 20.
 */
export function progressMinutes(perDay: number): number[] {
  if (perDay <= 0) return [];
  if (perDay === 1) return [LAST_MINUTE];

  const step = (LAST_MINUTE - FIRST_MINUTE) / (perDay - 1);

  return Array.from({ length: perDay }, (_, index) => Math.round(FIRST_MINUTE + index * step));
}

/**
 * El aviso que toca mandar ahora, o `null`.
 *
 * Es el último que ya pasó y todavía no salió. Si el proceso estuvo caído, no
 * se manda una ráfaga con los atrasados: solo el más reciente, que es el único
 * que dice algo verdadero sobre cómo va el día. Tampoco sale uno de antes de
 * crear el plan: crearlo a las tres de la tarde no dispara el de las dos.
 *
 * ponytail: medianoche más los minutos ignora el cambio de hora; en esos días
 * un aviso sale una hora corrido. Colombia no tiene horario de verano.
 */
export function dueProgressSlot(input: {
  now: Date;
  /** La medianoche de hoy en la zona del plan. */
  midnight: Date;
  perDay: number;
  lastSentAt: Date | null;
  notBefore: Date;
}): Date | null {
  const slot = progressMinutes(input.perDay)
    .map((minute) => new Date(input.midnight.getTime() + minute * 60_000))
    .filter((moment) => moment <= input.now)
    .at(-1);

  if (!slot || slot < input.notBefore) return null;
  if (input.lastSentAt && input.lastSentAt >= slot) return null;

  return slot;
}
