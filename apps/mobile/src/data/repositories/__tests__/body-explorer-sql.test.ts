import { renderHook } from '@testing-library/react-native';
import { useQuery } from '@powersync/react';

import {
  SELECT_BODY_EXERCISES,
  useBodyExercises,
} from '../body-explorer-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' } }),
}));

type BodyExerciseDbRow = {
  id: string;
  muscle_primary: string;
  muscles_secondary: string | null;
  muscles_fine: string | null;
  equipment: string | null;
  name: string | null;
  is_favorite: number;
};

const queryRows = (lang = 'en') =>
  testPowerSync.getAll<BodyExerciseDbRow>(SELECT_BODY_EXERCISES, [lang]);

function seedExercise(
  id: string,
  values: {
    muscle?: string;
    musclesSecondary?: string | null;
    musclesFine?: string | null;
    equipment?: string | null;
    deleted?: boolean;
  } = {},
): void {
  seed('exercises', [
    {
      id,
      owner_id: null,
      source: 'library',
      muscle_primary: values.muscle ?? 'arms',
      muscles_secondary:
        values.musclesSecondary === undefined ? JSON.stringify([]) : values.musclesSecondary,
      muscles_fine: values.musclesFine === undefined ? JSON.stringify([]) : values.musclesFine,
      equipment: values.equipment ?? null,
      ...(values.deleted ? { deleted_at: '2026-09-12T08:00:00Z' } : {}),
    },
  ]);
}

function seedTranslation(
  exerciseId: string,
  lang: 'fr' | 'en',
  name: string,
  deleted = false,
): void {
  seed('exercise_translations', [
    {
      exercise_id: exerciseId,
      owner_id: null,
      lang,
      name,
      ...(deleted ? { deleted_at: '2026-09-12T08:00:00Z' } : {}),
    },
  ]);
}

beforeEach(() => {
  resetTestDb();
  jest.mocked(useQuery).mockReset();
});

describe('SELECT_BODY_EXERCISES', () => {
  it('prend la traduction demandee puis replie sur le francais', async () => {
    seedExercise('curl');
    seedTranslation('curl', 'fr', 'Curl francais');
    seedTranslation('curl', 'en', 'English curl');
    seedExercise('extension');
    seedTranslation('extension', 'fr', 'Extension francaise');

    const rows = await queryRows('en');
    const names = new Map(rows.map((row) => [row.id, row.name]));

    expect(names.get('curl')).toBe('English curl');
    expect(names.get('extension')).toBe('Extension francaise');
  });

  it('exclut les exercices et traductions supprimes logiquement', async () => {
    seedExercise('active');
    seedTranslation('active', 'fr', 'Nom actif');
    seedTranslation('active', 'en', 'Archived name', true);
    seedExercise('archived', { deleted: true });
    seedTranslation('archived', 'fr', 'Exercice archive');

    const rows = await queryRows('en');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'active', name: 'Nom actif' });
  });

  it('marque seulement un favori actif', async () => {
    seedExercise('favorite');
    seedTranslation('favorite', 'fr', 'Favori');
    seed('exercise_favorites', [{ user_id: 'user-1', exercise_id: 'favorite' }]);
    seedExercise('old-favorite');
    seedTranslation('old-favorite', 'fr', 'Ancien favori');
    seed('exercise_favorites', [
      {
        user_id: 'user-1',
        exercise_id: 'old-favorite',
        deleted_at: '2026-09-12T08:00:00Z',
      },
    ]);

    const rows = await queryRows();
    const favorites = new Map(rows.map((row) => [row.id, row.is_favorite]));

    expect(favorites.get('favorite')).toBe(1);
    expect(favorites.get('old-favorite')).toBe(0);
  });
});

describe('useBodyExercises', () => {
  it('tolere le JSON absent ou invalide et normalise les cles musculaires', async () => {
    seedExercise('fallback', {
      muscle: 'arms',
      musclesSecondary: null,
      musclesFine: '{invalid',
    });
    seedTranslation('fallback', 'en', 'Fallback curl');
    seedExercise('precise', {
      muscle: 'chest',
      musclesSecondary: JSON.stringify(['arms', 'invalid', 'chest']),
      musclesFine: JSON.stringify(['biceps', 'invalid', 'biceps']),
    });
    seedTranslation('precise', 'en', 'Precise curl');
    const rows = await queryRows();
    jest.mocked(useQuery).mockReturnValue({
      data: rows,
      isLoading: false,
      isFetching: false,
      error: undefined,
    });

    const { result } = await renderHook(() => useBodyExercises('biceps'));

    expect(result.current.exercises).toEqual([
      expect.objectContaining({
        id: 'precise',
        musclesSecondary: ['arms'],
        musclesFine: ['biceps'],
        inferred: false,
      }),
      expect.objectContaining({
        id: 'fallback',
        musclesSecondary: [],
        musclesFine: [],
        inferred: true,
      }),
    ]);
  });

  it('ignore une ligne sans nom ou groupe musculaire valide', async () => {
    const rows: BodyExerciseDbRow[] = [
      {
        id: 'no-name',
        name: null,
        muscle_primary: 'arms',
        muscles_secondary: '[]',
        muscles_fine: '[]',
        equipment: null,
        is_favorite: 0,
      },
      {
        id: 'bad-muscle',
        name: 'Bad muscle',
        muscle_primary: 'unknown',
        muscles_secondary: '[]',
        muscles_fine: '[]',
        equipment: null,
        is_favorite: 0,
      },
    ];
    jest.mocked(useQuery).mockReturnValue({
      data: rows,
      isLoading: false,
      isFetching: false,
      error: undefined,
    });

    const { result } = await renderHook(() => useBodyExercises('biceps'));

    expect(result.current.exercises).toEqual([]);
  });

  it('expose le chargement et l erreur de lecture locale', async () => {
    const error = new Error('sqlite unavailable');
    jest.mocked(useQuery).mockReturnValue({
      data: [],
      isLoading: true,
      isFetching: true,
      error,
    });

    const { result } = await renderHook(() => useBodyExercises(null, 'curl'));

    expect(result.current).toEqual({ exercises: [], isLoading: true, error });
  });
});
