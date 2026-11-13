/**
 * La curva de toda la aplicación, para `motion/react`.
 *
 * Es la misma que `--ease-salida` en `tokens.css`: lo que se anima por CSS y lo
 * que se anima por JavaScript se mueven igual.
 */

/** Salida firme: arranca rápido y frena al final, que es lo que se siente como respuesta. */
export const EASE_OUT = [0.38, 0.49, 0, 1] as const;
