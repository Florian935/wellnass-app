import { describe, expect, it } from 'vitest';

import type { BodyExercise } from './body-explorer';
import { bodySideForMuscle, findBodyExercises, parseBodyMuscle } from './body-explorer';

const exercise = (values: Partial<BodyExercise> & Pick<BodyExercise, 'id' | 'name'>): BodyExercise => ({
  id: values.id,
  name: values.name,
  muscle: values.muscle ?? 'arms',
  musclesSecondary: values.musclesSecondary ?? [],
  musclesFine: values.musclesFine ?? [],
  equipment: values.equipment ?? null,
  isFavorite: values.isFavorite ?? false,
});

describe('findBodyExercises', () => {
  it('exclut du triceps un curl explicitement marque biceps', () => {
    const curl = exercise({ id: 'curl', name: 'Curl', musclesFine: ['biceps'] });

    expect(findBodyExercises([curl], 'triceps')).toEqual([]);
  });

  it('utilise le repli large et le signale quand le marquage fin manque', () => {
    const curl = exercise({ id: 'curl', name: 'Curl', muscle: 'arms' });

    expect(findBodyExercises([curl], 'triceps')).toEqual([{ ...curl, inferred: true }]);
    expect(findBodyExercises([curl], 'biceps')).toEqual([{ ...curl, inferred: true }]);
  });

  it('considere un marquage fin exact comme precis', () => {
    const curl = exercise({ id: 'curl', name: 'Curl', musclesFine: ['biceps'] });

    expect(findBodyExercises([curl], 'biceps')).toEqual([{ ...curl, inferred: false }]);
  });

  it('recherche sans tenir compte des accents, de la casse ni des espaces de bord', () => {
    const exercises = [
      exercise({ id: 'developpe', name: 'Développé couché', muscle: 'chest' }),
      exercise({ id: 'ecarte', name: 'Ecarte poulie', muscle: 'chest' }),
    ];

    expect(findBodyExercises(exercises, 'chest', '  DEVELOPPE  ').map(({ id }) => id)).toEqual([
      'developpe',
    ]);
  });

  it('trie par precision, puis favori, puis nom et enfin identifiant stable', () => {
    const exercises = [
      exercise({ id: 'z-fallback', name: 'Alpha', muscle: 'arms', isFavorite: true }),
      exercise({ id: 'z-precise', name: 'Beta', musclesFine: ['biceps'] }),
      exercise({ id: 'b-precise-fav', name: 'Eclair', musclesFine: ['biceps'], isFavorite: true }),
      exercise({ id: 'a-precise-fav', name: 'Eclair', musclesFine: ['biceps'], isFavorite: true }),
    ];

    expect(findBodyExercises(exercises, 'biceps').map(({ id }) => id)).toEqual([
      'a-precise-fav',
      'b-precise-fav',
      'z-precise',
      'z-fallback',
    ]);
  });
});

describe('parseBodyMuscle', () => {
  it.each([
    ['chest', 'chest'],
    ['hamstrings', 'hamstrings'],
    ['unknown', null],
    ['', null],
    [null, null],
    [['biceps'], null],
  ] as const)('parse %j en %j', (value, expected) => {
    expect(parseBodyMuscle(value)).toBe(expected);
  });
});

describe('bodySideForMuscle', () => {
  it('bascule vers la seule vue disponible', () => {
    expect(bodySideForMuscle('triceps', 'front')).toBe('back');
    expect(bodySideForMuscle('chest', 'back')).toBe('front');
  });

  it('conserve la vue courante pour les epaules visibles des deux cotes', () => {
    expect(bodySideForMuscle('shoulders', 'front')).toBe('front');
    expect(bodySideForMuscle('shoulders', 'back')).toBe('back');
  });
});
