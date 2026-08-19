/**
 * A qué horas del día sale un elemento que pide enviarse `timesPerDay` veces.
 *
 * Los envíos se reparten **de extremo a extremo** de la franja: el primero a la
 * hora de inicio, el último a la de fin, y el resto igualmente espaciados en
 * medio. Con la franja de 8:00 a 20:00 y tres envíos salen a las 8:00, 14:00 y
 * 20:00 — la primera hora, la del medio y la última.
 *
 * Se reparte sobre `n - 1` huecos y no sobre `n` justamente para que el último
 * caiga en el fin de la franja. Repartir sobre `n` dejaría el último antes del
 * cierre, y la franja diría una hora que nunca se usa.
 *
 * Una sola vez al día sale al inicio: sin un segundo punto no hay reparto que
 * hacer, y el inicio es lo que el usuario eligió como "la hora del envío".
 *
 * Los minutos se redondean, así que dos repeticiones vecinas pueden caer en el
 * mismo minuto si la franja es muy corta; quien reciba la lista debe quitar
 * duplicados.
 *
 * Vive en `shared` y no en el dominio de `scheduling` porque hacen falta las
 * mismas horas en dos contextos: el calendario las usa para saber cuándo
 * despertar, y el envío para saber a quién le toca salir en ese minuto. Si
 * fueran dos copias y se separaran, el tick despertaría a una hora en la que el
 * otro lado no encontraría nada que enviar.
 */
export function slotsOf(timesPerDay: number, startMinute: number, endMinute: number): number[] {
  const times = Math.max(1, Math.floor(timesPerDay));

  if (times === 1) return [startMinute];

  const step = (endMinute - startMinute) / (times - 1);

  return Array.from({ length: times }, (_, index) => Math.round(startMinute + step * index));
}
