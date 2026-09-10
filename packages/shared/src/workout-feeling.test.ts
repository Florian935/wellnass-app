import { describe, expect, it } from 'vitest';
import {
  WORKOUT_FEELINGS,
  feelingFromStoredRpe,
  feelingToStoredRpe,
  type WorkoutFeeling,
} from './workout-feeling';

describe('workout-feeling', () => {
  it('l’aller-retour niveau → RPE → niveau est stable', () => {
    // C'est ce qui garantit qu'un ressenti choisi se relit à l'identique à la réouverture.
    for (const feeling of WORKOUT_FEELINGS) {
      expect(feelingFromStoredRpe(feelingToStoredRpe(feeling))).toBe(feeling);
    }
  });

  it('range chaque RPE de 1 à 10 dans un cran, par paires', () => {
    const expected: WorkoutFeeling[] = [
      'easy', 'easy', 'fine', 'fine', 'solid', 'solid', 'hard', 'hard', 'max', 'max',
    ];
    expect(Array.from({ length: 10 }, (_, i) => feelingFromStoredRpe(i + 1))).toEqual(expected);
  });

  it('stocke bien un RPE 1-10, pas un 1-5', () => {
    // Le champ reste `workouts.rpe` : la base ne change pas de nature (patron d'intensity.ts).
    expect(feelingToStoredRpe('max')).toBe(10);
    expect(feelingToStoredRpe('easy')).toBe(2);
  });

  it('ne transforme pas une absence de note en ressenti', () => {
    // Le piège de la conversion naïve : `rpe ?? 0` ferait passer « non noté » pour « très facile ».
    expect(feelingFromStoredRpe(null)).toBeNull();
    expect(feelingFromStoredRpe(undefined)).toBeNull();
    expect(feelingFromStoredRpe(Number.NaN)).toBeNull();
  });

  it('borne les valeurs hors plage plutôt que de rendre null', () => {
    expect(feelingFromStoredRpe(0)).toBe('easy');
    expect(feelingFromStoredRpe(42)).toBe('max');
  });

  it('relit une ancienne note 1-5 sans la faire passer pour facile', () => {
    // Les séances d'avant cette US stockaient 1-5 dans le même champ. On ne peut pas les
    // distinguer d'un RPE, mais le découpage évite qu'un « 5 étoiles » se lise « Facile ».
    expect(feelingFromStoredRpe(5)).toBe('solid');
    expect(feelingFromStoredRpe(4)).toBe('fine');
  });

  it('arrondit un RPE fractionnaire', () => {
    expect(feelingFromStoredRpe(7.4)).toBe('hard');
  });
});
