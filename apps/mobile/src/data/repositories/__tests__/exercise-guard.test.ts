import { assertOwnedCustomExercise } from '../exercise-repository';

describe('assertOwnedCustomExercise', () => {
  const U = 'user-1';
  it('accepte un exo perso de l’utilisateur', () => {
    expect(() =>
      assertOwnedCustomExercise({ source: 'custom', owner_id: 'user-1' }, U),
    ).not.toThrow();
  });
  it('refuse un exo de bibliothèque', () => {
    expect(() =>
      assertOwnedCustomExercise({ source: 'library', owner_id: null }, U),
    ).toThrow();
  });
  it('refuse l’exo perso d’un autre utilisateur', () => {
    expect(() =>
      assertOwnedCustomExercise({ source: 'custom', owner_id: 'user-2' }, U),
    ).toThrow();
  });
  it('refuse un exo introuvable (null)', () => {
    expect(() => assertOwnedCustomExercise(null, U)).toThrow();
  });
});
