import { renderHook } from '@testing-library/react-native';
import { useQuery } from '@powersync/react';

import {
  SELECT_BODY_TRAINING_PROGRAM,
  useBodyTrainingProgram,
} from '../body-training-program-repository';
import { getTestDb, resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { session: { user: { id: string } } }) => unknown) =>
    selector({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' } }),
}));

type ProgramSqlRow = Record<string, string | number | null>;

const queryRows = (userId = 'user-1', lang = 'en') =>
  testPowerSync.getAll<ProgramSqlRow>(SELECT_BODY_TRAINING_PROGRAM, [userId, lang]);

function seedProgram(
  id: string,
  values: { ownerId?: string; pillar?: string; active?: boolean; deleted?: boolean } = {},
): void {
  seed('programs', [
    {
      id,
      owner_id: values.ownerId ?? 'user-1',
      pillar: values.pillar ?? 'strength',
      status: 'published',
      is_active: values.active === false ? 0 : 1,
      ...(values.deleted ? { deleted_at: '2026-09-13T10:00:00.000Z' } : {}),
    },
  ]);
}

function seedProgramTranslation(programId: string, lang: 'fr' | 'en', name: string, deleted = false) {
  seed('program_translations', [
    {
      program_id: programId,
      owner_id: 'user-1',
      lang,
      name,
      ...(deleted ? { deleted_at: '2026-09-13T10:00:00.000Z' } : {}),
    },
  ]);
}

function seedSession(programId: string, id: string, orderIndex: number, name: string | null) {
  seed('sessions', [
    { id, program_id: programId, owner_id: 'user-1', order_index: orderIndex, name },
  ]);
}

function seedSessionTranslation(sessionId: string, lang: 'fr' | 'en', name: string, deleted = false) {
  seed('session_translations', [
    {
      session_id: sessionId,
      owner_id: 'user-1',
      lang,
      name,
      ...(deleted ? { deleted_at: '2026-09-13T10:00:00.000Z' } : {}),
    },
  ]);
}

function seedExercise(
  id: string,
  values: { primary?: string; secondary?: unknown; fine?: unknown; deleted?: boolean } = {},
) {
  seed('exercises', [
    {
      id,
      owner_id: null,
      source: 'library',
      muscle_primary: values.primary ?? 'arms',
      muscles_secondary: JSON.stringify(values.secondary ?? []),
      muscles_fine: JSON.stringify(values.fine ?? []),
      ...(values.deleted ? { deleted_at: '2026-09-13T10:00:00.000Z' } : {}),
    },
  ]);
  seed('exercise_translations', [
    { exercise_id: id, owner_id: null, lang: 'fr', name: `FR ${id}` },
    { exercise_id: id, owner_id: null, lang: 'en', name: `EN ${id}` },
  ]);
}

function seedPlan(
  sessionId: string,
  id: string,
  exerciseId: string,
  orderIndex: number,
  values: { deleted?: boolean; setType?: string; targetSets?: number | null } = {},
) {
  seed('exercise_plans', [
    {
      id,
      session_id: sessionId,
      owner_id: 'user-1',
      exercise_id: exerciseId,
      order_index: orderIndex,
      set_type: values.setType ?? 'normal',
      target_sets: values.targetSets === undefined ? 3 : values.targetSets,
      ...(values.deleted ? { deleted_at: '2026-09-13T10:00:00.000Z' } : {}),
    },
  ]);
}

beforeEach(() => {
  resetTestDb();
  jest.mocked(useQuery).mockReset();
});

describe('SELECT_BODY_TRAINING_PROGRAM sur SQLite reel', () => {
  it('ignore les descendants et traductions d un autre compte', async () => {
    seedProgram('mine');
    seedProgramTranslation('mine', 'en', 'Nom etranger');
    seedSession('mine', 'foreign-session', 0, 'Etrangere');
    seedSession('mine', 'mine-session', 1, 'Ma seance');
    seedExercise('curl', { fine: ['biceps'] });
    seedPlan('mine-session', 'foreign-plan', 'curl', 0);
    seedPlan('mine-session', 'mine-plan', 'curl', 1);
    getTestDb().exec(`
      UPDATE program_translations SET owner_id = 'user-2';
      UPDATE sessions SET owner_id = 'user-2' WHERE id = 'foreign-session';
      UPDATE exercise_plans SET owner_id = 'user-2' WHERE id = 'foreign-plan';
      UPDATE exercises SET owner_id = 'user-2';
    `);
    expect(await queryRows()).toEqual([
      expect.objectContaining({
        program_id: 'mine', program_name: '', session_id: 'mine-session',
        plan_id: 'mine-plan', exercise_name: '', muscle_primary: null, muscles_fine: null,
      }),
    ]);
    expect(await queryRows('')).toEqual([]);
  });

  it('ignore les traductions supprimees et replie les exercices sur le francais', async () => {
    seedProgram('program');
    seedProgramTranslation('program', 'en', 'Old name', true);
    seedProgramTranslation('program', 'fr', 'Programme FR');
    seedSession('program', 'session', 0, 'Nom historique');
    seedSessionTranslation('session', 'en', 'Old session', true);
    seedSessionTranslation('session', 'fr', 'Seance FR');
    seedExercise('curl', { fine: ['biceps'] });
    seedPlan('session', 'plan', 'curl', 0);
    getTestDb().exec("UPDATE exercise_translations SET deleted_at = '2026-09-13T12:00:00Z' WHERE lang = 'en'");
    expect((await queryRows())[0]).toMatchObject({
      program_name: 'Programme FR', session_name: 'Seance FR', exercise_name: 'FR curl',
    });
  });
  it('lit seulement le programme strength actif possede par le compte', async () => {
    seedProgram('inactive', { active: false });
    seedProgram('running', { pillar: 'running' });
    seedProgram('foreign', { ownerId: 'user-2' });
    seedProgram('mine');
    seedProgramTranslation('mine', 'fr', 'Mon programme');

    const rows = await queryRows();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ program_id: 'mine', program_name: 'Mon programme' });
  });

  it('retourne l entete d un programme vide', async () => {
    seedProgram('empty');
    seedProgramTranslation('empty', 'fr', 'Programme vide');

    expect(await queryRows()).toEqual([
      expect.objectContaining({
        program_id: 'empty',
        program_name: 'Programme vide',
        session_id: null,
        plan_id: null,
      }),
    ]);
  });

  it('resout programme, seance et exercice en anglais puis en francais', async () => {
    seedProgram('program');
    seedProgramTranslation('program', 'fr', 'Programme FR');
    seedSession('program', 'session-en', 0, 'Nom historique EN');
    seedSessionTranslation('session-en', 'fr', 'Seance FR');
    seedSessionTranslation('session-en', 'en', 'Session EN');
    seedSession('program', 'session-fr', 1, 'Nom historique FR');
    seedSessionTranslation('session-fr', 'fr', 'Deuxieme FR');
    seedExercise('curl', { fine: ['biceps'] });
    seedPlan('session-en', 'plan-en', 'curl', 0);
    seedPlan('session-fr', 'plan-fr', 'curl', 0);

    const rows = await queryRows();

    expect(rows.map((row) => row.program_name)).toEqual(['Programme FR', 'Programme FR']);
    expect(rows.map((row) => row.session_name)).toEqual(['Session EN', 'Deuxieme FR']);
    expect(rows.map((row) => row.exercise_name)).toEqual(['EN curl', 'EN curl']);
  });

  it('replie le nom de seance sur sessions.name si les traductions manquent ou sont supprimees', async () => {
    seedProgram('program');
    seedSession('program', 'session', 0, 'Nom historique');
    seedSessionTranslation('session', 'en', 'Ancien nom', true);

    expect((await queryRows())[0]).toMatchObject({ session_name: 'Nom historique' });
  });

  it('exclut programmes, seances et plans supprimes logiquement', async () => {
    seedProgram('deleted-program', { deleted: true });
    expect(await queryRows()).toEqual([]);

    resetTestDb();
    seedProgram('program');
    seed('sessions', [
      {
        id: 'deleted-session',
        program_id: 'program',
        owner_id: 'user-1',
        order_index: 0,
        name: 'Supprimee',
        deleted_at: '2026-09-13T10:00:00.000Z',
      },
      {
        id: 'active-session',
        program_id: 'program',
        owner_id: 'user-1',
        order_index: 1,
        name: 'Active',
      },
    ]);
    seedExercise('curl');
    seedPlan('deleted-session', 'hidden-plan', 'curl', 0);
    seedPlan('active-session', 'deleted-plan', 'curl', 0, { deleted: true });

    expect(await queryRows()).toEqual([
      expect.objectContaining({ session_id: 'active-session', plan_id: null }),
    ]);
  });

  it('laisse un exercice absent ou supprime sans association musculaire', async () => {
    seedProgram('program');
    seedSession('program', 'session', 0, 'Seance');
    seedPlan('session', 'missing', 'missing-exercise', 0);
    seedExercise('deleted', { primary: 'legs', fine: ['glutes'], deleted: true });
    seedPlan('session', 'deleted-exercise', 'deleted', 1);

    const rows = await queryRows();

    expect(rows).toEqual([
      expect.objectContaining({ plan_id: 'missing', muscle_primary: null, muscles_fine: null }),
      expect.objectContaining({ plan_id: 'deleted-exercise', muscle_primary: null, muscles_fine: null }),
    ]);
  });
});

describe('useBodyTrainingProgram', () => {
  it('laisse les marquages invalides sans association', async () => {
    seedProgram('program');
    seedSession('program', 'session', 0, 'A');
    seedExercise('invalid', { primary: 'invalid', secondary: ['unknown'], fine: ['unknown'] });
    seedPlan('session', 'plan', 'invalid', 0);
    jest.mocked(useQuery).mockReturnValue({
      data: await queryRows(), isLoading: false, isFetching: false, error: undefined,
    });
    const { result } = await renderHook(() => useBodyTrainingProgram());
    expect(result.current.program?.sessions[0]?.plans[0]).toMatchObject({
      musclePrimary: null, musclesSecondary: [], musclesFine: [],
    });
  });

  it('masque les donnees conservees du compte precedent', async () => {
    seedProgram('foreign', { ownerId: 'user-2' });
    jest.mocked(useQuery).mockReturnValue({
      data: await queryRows('user-2'), isLoading: false, isFetching: false, error: undefined,
    });
    const { result } = await renderHook(() => useBodyTrainingProgram());
    expect(result.current.program).toBeNull();
  });
  it('conserve un groupe secondaire valide meme si le primaire est invalide', async () => {
    seedProgram('program');
    seedSession('program', 'session', 0, 'A');
    seedExercise('secondary', { primary: 'invalid', secondary: ['legs', 'legs', 'unknown'], fine: [] });
    seedPlan('session', 'plan', 'secondary', 0);
    jest.mocked(useQuery).mockReturnValue({
      data: await queryRows(), isLoading: false, isFetching: false, error: undefined,
    });
    const { result } = await renderHook(() => useBodyTrainingProgram());
    expect(result.current.program?.sessions[0]?.plans[0]).toMatchObject({
      musclePrimary: null, musclesSecondary: ['legs'], musclesFine: [],
    });
  });
  it('construit le programme ordonne et normalise les marquages musculaires', async () => {
    seedProgram('program');
    seedProgramTranslation('program', 'en', 'My program');
    seedSession('program', 'session-b', 1, 'B');
    seedSession('program', 'session-a', 0, 'A');
    seedExercise('curl', {
      primary: 'arms',
      secondary: ['chest', 'invalid', 'arms'],
      fine: ['biceps', 'invalid', 'biceps'],
    });
    seedPlan('session-a', 'plan', 'curl', 0, { setType: 'bodyweight', targetSets: 0 });
    const rows = await queryRows();
    jest.mocked(useQuery).mockReturnValue({
      data: rows,
      isLoading: false,
      isFetching: false,
      error: undefined,
    });

    const { result } = await renderHook(() => useBodyTrainingProgram());

    expect(result.current.program).toEqual({
      id: 'program',
      name: 'My program',
      sessions: [
        {
          id: 'session-a',
          name: 'A',
          plans: [
            {
              id: 'plan',
              exerciseId: 'curl',
              exerciseName: 'EN curl',
              setType: 'bodyweight',
              targetSets: 0,
              musclePrimary: 'arms',
              musclesSecondary: ['chest'],
              musclesFine: ['biceps'],
            },
          ],
        },
        { id: 'session-b', name: 'B', plans: [] },
      ],
    });
  });

  it('distingue absence, chargement et erreur de lecture', async () => {
    const error = new Error('sqlite unavailable');
    jest.mocked(useQuery).mockReturnValue({
      data: [],
      isLoading: true,
      isFetching: true,
      error,
    });

    const { result } = await renderHook(() => useBodyTrainingProgram());

    expect(result.current).toEqual({ program: null, isLoading: true, error });
  });
});
