/**
 * Un booleano no puede inyectarse por su tipo, así que necesita un token
 * propio. Decide si la cookie de refresco sale marcada como `secure`.
 */
export const IS_PRODUCTION = Symbol('IsProduction');
