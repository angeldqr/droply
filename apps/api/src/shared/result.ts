/**
 * Los casos de uso devuelven un Result en vez de lanzar. Un fallo esperable
 * —email ya registrado, destinatario sin verificar— es parte del contrato del
 * caso de uso, no una excepción. Las excepciones quedan para lo que de verdad
 * no debería pasar.
 *
 * El discriminante `ok` alcanza para que TypeScript estreche el tipo solo, así
 * que no hacen falta guardas aparte:
 *
 *   const result = await useCase.execute(input);
 *   if (!result.ok) return handle(result.error);
 *   result.value; // acá ya está tipado
 */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok(): Result<void, never>;
export function ok<T>(value: T): Result<T, never>;
export function ok<T>(value?: T): Result<T | undefined, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Convierte un fallo esperable en una excepción. Es el puente en el borde HTTP:
 * los casos de uso devuelven `Result`, y el filtro de errores de Nest necesita
 * algo lanzado para traducirlo a un código de estado.
 *
 * Solo en `presentation`. Dentro del núcleo se trabaja con el `Result`.
 */
export function orThrow<T, E extends Error>(result: Result<T, E>): T {
  if (!result.ok) throw result.error;

  return result.value;
}
