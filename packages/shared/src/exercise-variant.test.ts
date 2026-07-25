import { describe, it, expect } from 'vitest';
import { canonicalPair, exerciseVariantRowSchema } from './exercise-variant';

describe('canonicalPair', () => {
  it('trie deux id (déjà ordonnés)', () => {
    expect(canonicalPair('aaa', 'bbb')).toEqual({ a: 'aaa', b: 'bbb' });
  });
  it('trie deux id (inversés)', () => {
    expect(canonicalPair('zzz', 'aaa')).toEqual({ a: 'aaa', b: 'zzz' });
  });
});

describe('exerciseVariantRowSchema', () => {
  const base = {
    id: '11111111-1111-1111-1111-111111111111',
    ownerId: null,
    exerciseIdA: '22222222-2222-2222-2222-222222222222',
    exerciseIdB: '33333333-3333-3333-3333-333333333333',
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
    deletedAt: null,
  };
  it('parse un lien éditorial (ownerId null)', () => {
    expect(exerciseVariantRowSchema.parse(base).ownerId).toBeNull();
  });
  it('parse un lien perso (ownerId uuid)', () => {
    const uid = '44444444-4444-4444-4444-444444444444';
    expect(exerciseVariantRowSchema.parse({ ...base, ownerId: uid }).ownerId).toBe(uid);
  });
});
