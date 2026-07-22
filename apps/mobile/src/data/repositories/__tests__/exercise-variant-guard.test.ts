import { assertOwnsVariant } from '../exercise-variant-repository';

describe('assertOwnsVariant', () => {
  it('accepte le propriétaire', () => {
    expect(() => assertOwnsVariant('u1', 'u1')).not.toThrow();
  });
  it('refuse un lien non possédé (éditorial ou autre user)', () => {
    expect(() => assertOwnsVariant(null, 'u1')).toThrow();
    expect(() => assertOwnsVariant('u2', 'u1')).toThrow();
  });
});
