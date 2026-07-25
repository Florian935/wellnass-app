import { assertOwnsVariant, dedupeVariants } from '../exercise-variant-repository';

describe('assertOwnsVariant', () => {
  it('accepte le propriétaire', () => {
    expect(() => assertOwnsVariant('u1', 'u1')).not.toThrow();
  });
  it('refuse un lien non possédé (éditorial ou autre user)', () => {
    expect(() => assertOwnsVariant(null, 'u1')).toThrow();
    expect(() => assertOwnsVariant('u2', 'u1')).toThrow();
  });
});

const row = (over: Partial<Parameters<typeof dedupeVariants>[0][number]>) => ({
  link_id: 'l1',
  owner_id: null as string | null,
  other_id: 'x',
  source: 'library',
  name: 'Développé',
  ...over,
});

describe('dedupeVariants', () => {
  it('un lien perso de l’utilisateur est supprimable', () => {
    const out = dedupeVariants([row({ link_id: 'l1', owner_id: 'u1', other_id: 'x' })], 'u1');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ isEditorial: false, canRemove: true });
  });

  it('un lien éditorial n’est pas supprimable', () => {
    const out = dedupeVariants([row({ owner_id: null, other_id: 'x' })], 'u1');
    expect(out[0]).toMatchObject({ isEditorial: true, canRemove: false });
  });

  it('un lien perso d’un autre user n’est pas supprimable', () => {
    const out = dedupeVariants([row({ owner_id: 'u2', other_id: 'x' })], 'u1');
    expect(out[0]).toMatchObject({ isEditorial: false, canRemove: false });
  });

  it('priorité éditoriale quel que soit l’ordre (perso puis éditorial)', () => {
    const out = dedupeVariants(
      [
        row({ link_id: 'perso', owner_id: 'u1', other_id: 'x' }),
        row({ link_id: 'edito', owner_id: null, other_id: 'x' }),
      ],
      'u1',
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ isEditorial: true, canRemove: false });
  });

  it('priorité éditoriale quel que soit l’ordre (éditorial puis perso)', () => {
    const out = dedupeVariants(
      [
        row({ link_id: 'edito', owner_id: null, other_id: 'x' }),
        row({ link_id: 'perso', owner_id: 'u1', other_id: 'x' }),
      ],
      'u1',
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ isEditorial: true, canRemove: false });
  });

  it('omet une cible sans nom résolu', () => {
    const out = dedupeVariants([row({ other_id: 'x', name: null as unknown as string })], 'u1');
    expect(out).toHaveLength(0);
  });
});
