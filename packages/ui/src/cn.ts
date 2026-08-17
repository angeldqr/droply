import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Une clases condicionales y deja que la última gane cuando dos chocan. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
