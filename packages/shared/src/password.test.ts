import { describe, it, expect } from 'vitest';
import { MIN_PASSWORD_LENGTH, validatePasswordPair } from './password';

describe('validatePasswordPair', () => {
  it('longueur insuffisante → too-short (prioritaire sur la concordance)', () => {
    expect(validatePasswordPair('abc', 'abc')).toBe('too-short');
    expect(validatePasswordPair('abc', 'xyz')).toBe('too-short');
  });

  it('assez long mais différents → mismatch', () => {
    expect(validatePasswordPair('motdepasse1', 'motdepasse2')).toBe('mismatch');
  });

  it('valide → null', () => {
    expect(validatePasswordPair('motdepasse1', 'motdepasse1')).toBeNull();
  });

  it('exactement la longueur minimale → valide', () => {
    const pwd = 'a'.repeat(MIN_PASSWORD_LENGTH);
    expect(validatePasswordPair(pwd, pwd)).toBeNull();
  });

  it('un caractère de moins que le minimum → too-short', () => {
    const pwd = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);
    expect(validatePasswordPair(pwd, pwd)).toBe('too-short');
  });

  it('confirmation vide → too-short (le mot de passe est contrôlé en premier)', () => {
    expect(validatePasswordPair('motdepasse1', '')).toBe('mismatch');
    expect(validatePasswordPair('', '')).toBe('too-short');
  });

  it('la casse et les espaces comptent (aucune normalisation)', () => {
    expect(validatePasswordPair('MotDePasse1', 'motdepasse1')).toBe('mismatch');
    expect(validatePasswordPair('motdepasse1 ', 'motdepasse1')).toBe('mismatch');
  });

  it('constante = 8 (contrat repris de sign-up)', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });
});
