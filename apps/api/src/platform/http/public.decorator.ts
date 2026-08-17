import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'http:public';

/**
 * Marca una ruta como abierta.
 *
 * Vive en `platform` y no en el contexto de identity porque lo necesitan los
 * dos lados: identity define el guard que lo lee, y otras rutas de framework
 * —como las sondas de salud— tienen que poder marcarse sin depender de un
 * contexto de negocio.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
