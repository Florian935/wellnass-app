import { describe, expect, it } from 'vitest';
import { normalizeOwnerId, normalizeTokenHash, parseBearer, sameHash } from './auth';

const TOKEN = 'synthetique-0123456789-abcdef';
const HASH = 'a'.repeat(64);

describe('parseBearer', () => {
  it('lit un jeton Bearer, schéma insensible à la casse', () => {
    expect(parseBearer(`Bearer ${TOKEN}`)).toBe(TOKEN);
    expect(parseBearer(`bearer ${TOKEN}`)).toBe(TOKEN);
    expect(parseBearer(`BEARER   ${TOKEN}`)).toBe(TOKEN);
  });

  it('refuse un en-tête absent, vide ou d’un autre schéma', () => {
    expect(parseBearer(null)).toBeNull();
    expect(parseBearer('')).toBeNull();
    expect(parseBearer('Bearer')).toBeNull();
    expect(parseBearer('Bearer ')).toBeNull();
    expect(parseBearer(`Basic ${TOKEN}`)).toBeNull();
    expect(parseBearer(TOKEN)).toBeNull();
  });

  it('borne le jeton à 16–4 096 caractères ASCII visibles (la borne de Noryn)', () => {
    expect(parseBearer(`Bearer ${'x'.repeat(16)}`)).toBe('x'.repeat(16));
    expect(parseBearer(`Bearer ${'x'.repeat(15)}`)).toBeNull();
    expect(parseBearer(`Bearer ${'x'.repeat(4096)}`)).toBe('x'.repeat(4096));
    expect(parseBearer(`Bearer ${'x'.repeat(4097)}`)).toBeNull();
    expect(parseBearer(`Bearer ${'é'.repeat(20)}`)).toBeNull();
    expect(parseBearer(`Bearer ${TOKEN} suite`)).toBeNull();
  });
});

describe('normalizeTokenHash', () => {
  it('accepte 64 hexadécimaux, ramenés en minuscules, espaces autour retirés', () => {
    expect(normalizeTokenHash(HASH)).toBe(HASH);
    expect(normalizeTokenHash(HASH.toUpperCase())).toBe(HASH);
    expect(normalizeTokenHash(` ${HASH}\n`)).toBe(HASH);
  });

  it('refuse un secret absent, trop court ou non hexadécimal', () => {
    expect(normalizeTokenHash(undefined)).toBeNull();
    expect(normalizeTokenHash('')).toBeNull();
    expect(normalizeTokenHash('a'.repeat(63))).toBeNull();
    expect(normalizeTokenHash('g'.repeat(64))).toBeNull();
  });
});

describe('sameHash — comparaison à temps constant', () => {
  it('égal / différent, y compris au dernier caractère', () => {
    expect(sameHash(HASH, HASH)).toBe(true);
    expect(sameHash(HASH, `${'a'.repeat(63)}b`)).toBe(false);
    expect(sameHash(HASH, `b${'a'.repeat(63)}`)).toBe(false);
  });

  it('longueurs différentes : faux', () => {
    expect(sameHash(HASH, 'a')).toBe(false);
  });
});

describe('normalizeOwnerId', () => {
  it('accepte un UUID, ramené en minuscules', () => {
    expect(normalizeOwnerId('11111111-1111-4111-8111-11111111111A')).toBe('11111111-1111-4111-8111-11111111111a');
    expect(normalizeOwnerId(' 11111111-1111-4111-8111-111111111111 ')).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('refuse un secret absent ou qui n’est pas un UUID', () => {
    expect(normalizeOwnerId(undefined)).toBeNull();
    expect(normalizeOwnerId('florian')).toBeNull();
    expect(normalizeOwnerId('11111111111141118111111111111111')).toBeNull();
  });
});
