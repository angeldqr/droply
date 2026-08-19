import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@droply/contracts';

export const REQUIRED_ROLE = 'http:role';

/**
 * Exige un rol además de la sesión.
 *
 * Gemelo de `@Public()` y leído por el mismo guard: la autorización no merece un
 * segundo guard cuando el primero ya tiene al usuario en la mano y sabe leer
 * metadatos de la ruta.
 *
 * Vive en `platform` por lo mismo que `CurrentUserId`: lo necesita cualquier
 * contexto con rutas restringidas, e identity es quien lo hace cumplir.
 */
export const Roles = (role: UserRole) => SetMetadata(REQUIRED_ROLE, role);
