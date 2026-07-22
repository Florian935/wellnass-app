import { buildCustomExerciseWrite } from '../exercise-repository';

describe('buildCustomExerciseWrite', () => {
  it('normalise les muscles secondaires (exclut le primaire, dédup) en JSON', () => {
    const out = buildCustomExerciseWrite({
      muscle: 'chest',
      musclesSecondary: ['chest', 'arms', 'arms', 'shoulders'],
      instructions: null,
    });
    expect(JSON.parse(out.musclesSecondaryJson)).toEqual(['arms', 'shoulders']);
  });

  it('instructions vides → null ; sinon trim', () => {
    expect(
      buildCustomExerciseWrite({ muscle: 'back', musclesSecondary: [], instructions: '   ' }).instructions,
    ).toBeNull();
    expect(
      buildCustomExerciseWrite({ muscle: 'back', musclesSecondary: [], instructions: '  Dos droit  ' })
        .instructions,
    ).toBe('Dos droit');
  });

  it('liste vide → JSON []', () => {
    expect(
      buildCustomExerciseWrite({ muscle: 'legs', musclesSecondary: [], instructions: null })
        .musclesSecondaryJson,
    ).toBe('[]');
  });
});
