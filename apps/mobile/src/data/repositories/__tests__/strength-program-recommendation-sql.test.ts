import { renderHook, waitFor } from '@testing-library/react-native';
import { useQuery } from '@powersync/react';
import { fingerprintStrengthProgram } from '@wellness/shared';

import {
  SELECT_STRENGTH_PROGRAM_CANDIDATE_SIGNAL,
  readStrengthProgramCandidates,
  useStrengthProgramCandidates,
} from '../strength-program-recommendation-repository';
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
  useTranslation: () => ({ i18n: { language: 'en-GB' } }),
}));

type OwnerId = string | null;

function seedProgram(
  id: string,
  options: {
    ownerId?: OwnerId;
    pillar?: string;
    status?: string;
    active?: boolean;
    deleted?: boolean;
  } = {},
): void {
  seed('programs', [
    {
      id,
      owner_id: Object.hasOwn(options, 'ownerId') ? options.ownerId : null,
      pillar: options.pillar ?? 'strength',
      status: options.status ?? 'published',
      is_active: options.active ? 1 : 0,
      level: 'intermediate',
      goal: 'hypertrophy',
      duration_weeks: 8,
      target_time_seconds: 3600,
      event_name: 'Finale',
      ...(options.deleted ? { deleted_at: '2026-09-14T09:00:00.000Z' } : {}),
    },
  ]);
}

function seedProgramTranslation(
  programId: string,
  ownerId: OwnerId,
  lang: string,
  name: string,
  options: { deleted?: boolean; summary?: string | null; description?: string | null } = {},
): void {
  seed('program_translations', [
    {
      program_id: programId,
      owner_id: ownerId,
      lang,
      name,
      summary: options.summary ?? null,
      description: options.description ?? null,
      ...(options.deleted ? { deleted_at: '2026-09-14T09:00:00.000Z' } : {}),
    },
  ]);
}

function seedSession(
  programId: string,
  ownerId: OwnerId,
  id: string,
  orderIndex: number,
  options: Record<string, unknown> = {},
): void {
  seed('sessions', [
    {
      id,
      program_id: programId,
      owner_id: ownerId,
      order_index: orderIndex,
      week_index: null,
      name: `Base ${id}`,
      session_type: 'strength',
      target_distance_m: null,
      target_duration_seconds: 2700,
      target_pace_min_s_per_km: null,
      target_pace_max_s_per_km: null,
      target_rpe: 7,
      target_time_seconds: 2600,
      pacing_plan: JSON.stringify({ split: [1, 2] }),
      description: `Description ${id}`,
      instructions: `Instructions ${id}`,
      adaptation_criterion: 'RPE <= 7',
      ...options,
    },
  ]);
}

function seedSessionTranslation(
  sessionId: string,
  ownerId: OwnerId,
  lang: string,
  name: string,
  deleted = false,
): void {
  seed('session_translations', [
    {
      session_id: sessionId,
      owner_id: ownerId,
      lang,
      name,
      description: `${name} description`,
      instructions: `${name} instructions`,
      ...(deleted ? { deleted_at: '2026-09-14T09:00:00.000Z' } : {}),
    },
  ]);
}

function seedExercise(
  id: string,
  ownerId: OwnerId = null,
  options: Record<string, unknown> = {},
): void {
  seed('exercises', [
    {
      id,
      owner_id: ownerId,
      source: ownerId === null ? 'library' : 'custom',
      muscle_primary: 'arms',
      muscles_secondary: JSON.stringify(['back']),
      muscles_fine: JSON.stringify(['biceps', 'triceps']),
      equipment: 'dumbbell',
      ...options,
    },
  ]);
}

function seedExerciseTranslation(
  exerciseId: string,
  ownerId: OwnerId,
  lang: string,
  name: string,
): void {
  seed('exercise_translations', [{ exercise_id: exerciseId, owner_id: ownerId, lang, name }]);
}

function seedPlan(
  sessionId: string,
  ownerId: OwnerId,
  id: string,
  exerciseId: string,
  orderIndex = 0,
  options: Record<string, unknown> = {},
): void {
  seed('exercise_plans', [
    {
      id,
      session_id: sessionId,
      owner_id: ownerId,
      exercise_id: exerciseId,
      order_index: orderIndex,
      set_type: 'normal',
      target_sets: 4,
      target_reps: '8-10',
      target_weight_kg: 22.5,
      rest_seconds: 90,
      ...options,
    },
  ]);
}

function seedInterval(sessionId: string, ownerId: OwnerId, options: Record<string, unknown> = {}) {
  seed('session_intervals', [
    {
      session_id: sessionId,
      owner_id: ownerId,
      order_index: 2,
      reps: 4,
      fast_distance_m: 400,
      fast_duration_seconds: 80,
      fast_pace_pct_vma: 95,
      recovery_distance_m: 200,
      recovery_duration_seconds: 60,
      kind: 'work',
      label: 'Rapide',
      fast_pace_min_s_per_km: 210,
      fast_pace_max_s_per_km: 220,
      fast_target_time_min_seconds: 78,
      fast_target_time_max_seconds: 82,
      fast_pace_progressive: 1,
      recovery_kind: 'jog',
      recovery_pace_min_s_per_km: 330,
      recovery_pace_max_s_per_km: 360,
      group_key: 'bloc-a',
      group_reps: 2,
      ...options,
    },
  ]);
}

async function signalRows() {
  return testPowerSync.getAll<{ id: string; signal: string }>(
    SELECT_STRENGTH_PROGRAM_CANDIDATE_SIGNAL,
    ['user-1'],
  );
}

beforeEach(() => {
  resetTestDb();
  jest.mocked(useQuery).mockReset();
});

describe('lecture SQLite des candidats de programme musculation', () => {
  it('retient les editoriaux publies et le seul programme personnel actif du compte', async () => {
    seedProgram('editorial');
    seedProgramTranslation('editorial', null, 'fr', 'Editorial');
    seedProgram('draft', { status: 'draft' });
    seedProgram('running', { pillar: 'running' });
    seedProgram('deleted', { deleted: true });
    seedProgram('personal', { ownerId: 'user-1', active: true, status: 'draft' });
    seedProgramTranslation('personal', 'user-1', 'fr', 'Personnel');
    seedProgram('inactive', { ownerId: 'user-1' });
    seedProgram('foreign', { ownerId: 'user-2', active: true });

    const result = await readStrengthProgramCandidates('user-1', 'fr');

    expect(result.error).toBeNull();
    expect(result.candidates.map((candidate) => candidate.program.id)).toEqual([
      'editorial',
      'personal',
    ]);
    expect(result.candidates.filter((candidate) => candidate.isCurrent)).toHaveLength(1);
    expect(result.candidates.find((candidate) => candidate.isCurrent)?.program.id).toBe('personal');
  });

  it('choisit deterministement le plus recent si deux programmes personnels sont actifs', async () => {
    seedProgram('personal-old', { ownerId: 'user-1', active: true });
    seedProgramTranslation('personal-old', 'user-1', 'fr', 'Ancien');
    seedProgram('personal-new', { ownerId: 'user-1', active: true });
    seedProgramTranslation('personal-new', 'user-1', 'fr', 'Recent');
    getTestDb()
      .prepare("UPDATE programs SET updated_at = '2026-09-13T12:00:00Z' WHERE id = 'personal-old'")
      .run();
    getTestDb()
      .prepare("UPDATE programs SET updated_at = '2026-09-15T12:00:00Z' WHERE id = 'personal-new'")
      .run();

    const result = await readStrengthProgramCandidates('user-1', 'fr');

    expect(result.error).toBeNull();
    expect(result.candidates.map((candidate) => candidate.program.id)).toEqual(['personal-new']);
    expect((await signalRows()).map((row) => row.id)).toEqual(['personal-new']);
  });

  it('resout les langues et fournit le snapshot complet utilise par la copie', async () => {
    seedProgram('complete');
    seedProgramTranslation('complete', null, 'de', 'Deutsch', {
      summary: 'Zusammenfassung',
      description: 'Beschreibung',
    });
    seedProgramTranslation('complete', null, 'fr', 'Francais', {
      summary: 'Resume',
      description: 'Description FR',
    });
    seedProgramTranslation('complete', null, 'en', 'English', {
      summary: 'Summary',
      description: 'English description',
    });
    seedProgramTranslation('complete', 'user-2', 'en', 'Wrong owner');
    seedProgramTranslation('complete', null, 'it', 'Deleted', { deleted: true });

    seedSession('complete', null, 'session-fr', 0, { week_index: 3 });
    seedSessionTranslation('session-fr', null, 'fr', 'Seance francaise');
    seedSessionTranslation('session-fr', null, 'en', 'English session', true);
    seedSession('complete', null, 'session-first', 1);
    seedSessionTranslation('session-first', null, 'de', 'Erste Sitzung');
    seedSession('complete', null, 'session-base', 2);
    seedSession('complete', 'user-2', 'foreign-session', 3);
    seedSession('complete', null, 'deleted-session', 4, {
      deleted_at: '2026-09-14T09:00:00.000Z',
    });

    seedExercise('curl');
    seedExerciseTranslation('curl', null, 'fr', 'Curl francais');
    seedExerciseTranslation('curl', null, 'en', 'English curl');
    seedPlan('session-fr', null, 'plan', 'curl');
    seedPlan('session-fr', 'user-2', 'foreign-plan', 'curl', 1);
    seedPlan('session-fr', null, 'deleted-plan', 'curl', 2, {
      deleted_at: '2026-09-14T09:00:00.000Z',
    });
    seedInterval('session-fr', null);
    seedInterval('session-fr', 'user-2', { order_index: 3 });
    seedInterval('session-fr', null, {
      order_index: 4,
      deleted_at: '2026-09-14T09:00:00.000Z',
    });

    const first = await readStrengthProgramCandidates('user-1', 'en-GB');
    const frenchFallback = await readStrengthProgramCandidates('user-1', 'es-MX');
    getTestDb().prepare("UPDATE programs SET updated_at = '2026-09-15T12:00:00Z' WHERE id = 'complete'").run();
    const second = await readStrengthProgramCandidates('user-1', 'en-GB');
    const candidate = first.candidates[0]!;

    expect(first.error).toBeNull();
    expect(candidate.program.name).toBe('English');
    expect(frenchFallback.candidates[0]?.program.name).toBe('Francais');
    expect(frenchFallback.candidates[0]?.program.sessions[0]?.name).toBe('Seance francaise');
    expect(frenchFallback.candidates[0]?.program.sessions[0]?.plans[0]?.exerciseName).toBe(
      'Curl francais',
    );
    expect(candidate.program.sessions.map((session) => session.name)).toEqual([
      'Seance francaise',
      'Erste Sitzung',
      'Base session-base',
    ]);
    expect(candidate.program.sessions[0]?.plans).toEqual([
      expect.objectContaining({
        id: 'plan',
        exerciseName: 'English curl',
        equipment: 'dumbbell',
        musclePrimary: 'arms',
        musclesSecondary: ['back'],
        musclesFine: ['biceps', 'triceps'],
      }),
    ]);
    expect(candidate.sourceSnapshot).toEqual({
      program: {
        pillar: 'strength',
        level: 'intermediate',
        goal: 'hypertrophy',
        durationWeeks: 8,
        targetTimeSeconds: 3600,
        eventName: 'Finale',
      },
      translations: [
        { lang: 'de', name: 'Deutsch', summary: 'Zusammenfassung', description: 'Beschreibung' },
        { lang: 'en', name: 'English', summary: 'Summary', description: 'English description' },
        { lang: 'fr', name: 'Francais', summary: 'Resume', description: 'Description FR' },
      ],
      sessions: [
        expect.objectContaining({
          orderIndex: 0,
          weekIndex: 3,
          name: 'Base session-fr',
          sessionType: 'strength',
          targetDurationSeconds: 2700,
          targetRpe: 7,
          targetTimeSeconds: 2600,
          pacingPlan: { split: [1, 2] },
          description: 'Description session-fr',
          instructions: 'Instructions session-fr',
          adaptationCriterion: 'RPE <= 7',
          translations: [
            {
              lang: 'fr',
              name: 'Seance francaise',
              description: 'Seance francaise description',
              instructions: 'Seance francaise instructions',
            },
          ],
          plans: [
            {
              exerciseId: 'curl',
              orderIndex: 0,
              setType: 'normal',
              targetSets: 4,
              targetReps: '8-10',
              targetWeightKg: 22.5,
              restSeconds: 90,
            },
          ],
          intervals: [
            {
              orderIndex: 2,
              reps: 4,
              fastDistanceM: 400,
              fastDurationSeconds: 80,
              fastPacePctVma: 95,
              recoveryDistanceM: 200,
              recoveryDurationSeconds: 60,
              kind: 'work',
              label: 'Rapide',
              fastPaceMinSPerKm: 210,
              fastPaceMaxSPerKm: 220,
              fastTargetTimeMinSeconds: 78,
              fastTargetTimeMaxSeconds: 82,
              fastPaceProgressive: true,
              recoveryKind: 'jog',
              recoveryPaceMinSPerKm: 330,
              recoveryPaceMaxSPerKm: 360,
              groupKey: 'bloc-a',
              groupReps: 2,
            },
          ],
        }),
        expect.objectContaining({ orderIndex: 1, weekIndex: null }),
        expect.objectContaining({ orderIndex: 2, weekIndex: null }),
      ],
    });
    expect(candidate.fingerprint).toBe(fingerprintStrengthProgram(candidate.sourceSnapshot));
    expect(second.candidates[0]?.fingerprint).toBe(candidate.fingerprint);
  });

  it('omet les candidats incomplets et conserve les candidats valides avec une erreur explicite', async () => {
    seedProgram('valid');
    seedProgramTranslation('valid', null, 'fr', 'Valide');

    seedProgram('bad-json');
    seedProgramTranslation('bad-json', null, 'fr', 'JSON invalide');
    seedSession('bad-json', null, 'bad-json-session', 0);
    seedExercise('bad-exercise', null, { muscles_fine: '["biceps"' });
    seedExerciseTranslation('bad-exercise', null, 'fr', 'Exercice invalide');
    seedPlan('bad-json-session', null, 'bad-plan', 'bad-exercise');

    seedProgram('missing-exercise');
    seedProgramTranslation('missing-exercise', null, 'fr', 'Exercice absent');
    seedSession('missing-exercise', null, 'missing-session', 0);
    seedPlan('missing-session', null, 'missing-plan', 'does-not-exist');

    seedProgram('foreign-exercise');
    seedProgramTranslation('foreign-exercise', null, 'fr', 'Exercice etranger');
    seedSession('foreign-exercise', null, 'foreign-exercise-session', 0);
    seedExercise('private-exercise', 'user-2');
    seedExerciseTranslation('private-exercise', 'user-2', 'fr', 'Prive');
    seedPlan('foreign-exercise-session', null, 'foreign-exercise-plan', 'private-exercise');

    const result = await readStrengthProgramCandidates('user-1', 'fr');

    expect(result.candidates.map((candidate) => candidate.program.id)).toEqual(['valid']);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toContain('bad-json');
    expect(result.error?.message).toContain('missing-exercise');
    expect(result.error?.message).toContain('foreign-exercise');
  });
});

describe('useStrengthProgramCandidates', () => {
  it('distingue chargement et liste vide', async () => {
    jest.mocked(useQuery).mockReturnValue({
      data: [], isLoading: true, isFetching: true, error: undefined,
    });
    const loading = await renderHook(() => useStrengthProgramCandidates());
    expect(loading.result.current).toEqual({ candidates: [], isLoading: true, error: null });
    await loading.unmount();

    jest.mocked(useQuery).mockReturnValue({
      data: [], isLoading: false, isFetching: false, error: undefined,
    });
    const empty = await renderHook(() => useStrengthProgramCandidates());
    await waitFor(() => expect(empty.result.current.isLoading).toBe(false));
    expect(empty.result.current).toEqual({ candidates: [], isLoading: false, error: null });
    await empty.unmount();
  });

  it('expose une erreur de transaction sans la confondre avec une liste vide', async () => {
    seedProgram('candidate');
    seedProgramTranslation('candidate', null, 'fr', 'Candidate');
    jest.mocked(useQuery).mockReturnValue({
      data: await signalRows(), isLoading: false, isFetching: false, error: undefined,
    });
    const failure = new Error('sqlite unavailable');
    const transaction = jest.spyOn(testPowerSync, 'readTransaction').mockRejectedValueOnce(failure);

    const { result } = await renderHook(() => useStrengthProgramCandidates());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toEqual({ candidates: [], isLoading: false, error: failure });
    transaction.mockRestore();
  });
});
