import { userRole } from '@reconectate/contracts';
import { describe, expect, it } from 'vitest';
import { USER_ROLES } from './user';

/**
 * El núcleo no puede importar `@reconectate/contracts`, así que los roles están
 * escritos dos veces. Si se separan, el guard exigiría un rol que el contrato
 * no sabe nombrar y nadie podría entrar al panel.
 */
describe('roles del dominio frente al contrato', () => {
  it('coinciden', () => {
    expect([...USER_ROLES]).toEqual([...userRole.values]);
  });
});
