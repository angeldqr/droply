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
