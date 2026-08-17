import { describe, expect, it } from 'vitest';
import { Email } from './email';

describe('Email', () => {
  it('recorta y baja a minúscula', () => {
    const email = Email.create('  Ana.Perez@Ejemplo.COM  ');

    expect(email.ok).toBe(true);
    if (!email.ok) return;

    expect(email.value.value).toBe('ana.perez@ejemplo.com');
  });

  it('considera iguales dos direcciones que solo difieren en mayúsculas', () => {
    const uno = Email.create('ana@ejemplo.com');
    const otro = Email.create('ANA@EJEMPLO.COM');

    expect(uno.ok && otro.ok && uno.value.equals(otro.value)).toBe(true);
  });

  it.each([
    ['vacío', ''],
    ['sin arroba', 'ana.ejemplo.com'],
    ['sin dominio', 'ana@'],
    ['dos arrobas', 'ana@otra@ejemplo.com'],
    ['dominio sin punto', 'ana@ejemplo'],
    ['con espacio', 'an a@ejemplo.com'],
    ['punto al final', 'ana@ejemplo.'],
  ])('rechaza un correo %s', (_caso, entrada) => {
    expect(Email.create(entrada).ok).toBe(false);
  });

  it('acepta direcciones legítimas que un regex estricto suele romper', () => {
    for (const entrada of [
      'ana+droply@ejemplo.com',
      "o'brien@ejemplo.com",
      'ana_perez@sub.dominio.com.co',
    ]) {
      expect(Email.create(entrada).ok).toBe(true);
    }
  });
});
