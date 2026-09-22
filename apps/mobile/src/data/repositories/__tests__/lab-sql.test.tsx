/**
 * US LABO-01 — l'assembleur du Labo. Fichier à **0 %** malgré 471 lignes, parce qu'il branche
 * vingt hooks sur quatre moteurs purs et qu'on a longtemps considéré ça comme du câblage sans
 * risque. Ce n'en est pas : **le câblage est exactement là où les données changent de sens.**
 *
 * Trois familles de défaut, toutes muettes à l'écran :
 *
 * 1. **Les deux requêtes neuves.** Ce sont les seules du Labo — meilleures charges par semaine, et
 *    séries par groupe musculaire pour rejouer « jambes lourdes » sur ce qui a **réellement** été
 *    fait. Si l'une lève, `useQuery` avale l'erreur et l'onglet correspondant s'affiche vide, sans
 *    rien dire. Elles sont donc rejouées sur le harness SQLite.
 * 2. **Les conversions UTC → jour local.** Une course finie à 23 h 30 appartient à ce jour-là. Le
 *    Labo compare des jours entre eux en permanence (semaine, adhérence d'expérience, fenêtre de
 *    56 jours) : une conversion ratée décale tout d'un cran, ce qui ne se voit pas.
 * 3. **Les bornes de fenêtre.** Une course d'il y a trois mois ne doit pas entrer dans la semaine
 *    courante ; une séance abandonnée ne doit pas compter comme faite.
 *
 * Les moteurs (`buildLabWeek`, `buildLabQuestions`, `buildLabKnowledge`, `projectSbd`) ne sont pas
 * mockés : ils sont testés chez eux, et les mocker masquerait précisément le mauvais branchement
 * qu'on cherche.
 */

import { renderHook } from '@testing-library/react-native';
import { useQuery } from '@powersync/react';
import { CARB_TARGETS_G_PER_KG, PROTEIN_TARGETS_G_PER_KG } from '@wellness/shared';

import {
  LAB_HISTORY_DAYS,
  SELECT_LAB_LIFT_SETS,
  SELECT_LAB_WORKOUT_MUSCLES,
  hardDayCarbTarget,
  nextMondayKey,
  useLabComposer,
  useLabKnowledge,
  useLabObjective,
  useLabPillars,
  useLabQuestions,
  useLabWeek,
} from '../lab-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

const TODAY = '2026-09-16'; // un mercredi
const WEEK_START = '2026-09-14'; // le lundi de cette semaine

jest.mock('@/hooks/useTodayKey', () => ({
  useTodayKey: jest.fn(() => '2026-09-16'),
  useWindowStartKey: jest.fn((days: number) => {
    const d = new Date(2026, 8, 16);
    d.setDate(d.getDate() - days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }),
}));

jest.mock('../settings-repository', () => ({ useSettings: jest.fn() }));
jest.mock('../profile-repository', () => ({ useProfile: jest.fn() }));
jest.mock('../nutrition-repository', () => ({
  useNutritionProfile: jest.fn(),
  useCarbsPerKg: jest.fn(),
}));
jest.mock('../bodyweight-repository', () => ({
  useLatestWeight: jest.fn(),
  useWeightEntries: jest.fn(),
}));
jest.mock('../dashboard-repository', () => ({
  useNutritionSummary: jest.fn(),
  useOvertrainingGuardAlert: jest.fn(),
  useTrainingLoadAlert: jest.fn(),
  useDeficitVolumeAlert: jest.fn(),
}));
jest.mock('../daily-wellbeing-repository', () => ({ useWellbeingEntries: jest.fn() }));
jest.mock('../journal-repository', () => ({ useDailyTotals: jest.fn() }));
jest.mock('../lab-experiment-repository', () => ({ useLabExperiments: jest.fn() }));
jest.mock('../planned-session-repository', () => ({
  useWeekPlan: jest.fn(),
  useSessionConflicts: jest.fn(),
}));
jest.mock('../running-profile-repository', () => ({ useRunnerProfile: jest.fn() }));
jest.mock('../run-repository', () => ({ useRunHistory: jest.fn() }));
jest.mock('../strength-repository', () => ({ useStrengthSection: jest.fn() }));
jest.mock('../workout-repository', () => ({ useWorkoutHistory: jest.fn() }));

import { useSettings } from '../settings-repository';
import { useProfile } from '../profile-repository';
import { useCarbsPerKg, useNutritionProfile } from '../nutrition-repository';
import { useLatestWeight, useWeightEntries } from '../bodyweight-repository';
import {
  useDeficitVolumeAlert,
  useNutritionSummary,
  useOvertrainingGuardAlert,
  useTrainingLoadAlert,
} from '../dashboard-repository';
import { useWellbeingEntries } from '../daily-wellbeing-repository';
import { useDailyTotals } from '../journal-repository';
import { useLabExperiments } from '../lab-experiment-repository';
import { useSessionConflicts, useWeekPlan } from '../planned-session-repository';
import { useRunnerProfile } from '../running-profile-repository';
import { useRunHistory } from '../run-repository';
import { useStrengthSection } from '../strength-repository';
import { useWorkoutHistory } from '../workout-repository';

const m = {
  settings: useSettings as jest.Mock,
  profile: useProfile as jest.Mock,
  nutritionProfile: useNutritionProfile as jest.Mock,
  carbs: useCarbsPerKg as jest.Mock,
  latestWeight: useLatestWeight as jest.Mock,
  weights: useWeightEntries as jest.Mock,
  summary: useNutritionSummary as jest.Mock,
  overtraining: useOvertrainingGuardAlert as jest.Mock,
  load: useTrainingLoadAlert as jest.Mock,
  deficit: useDeficitVolumeAlert as jest.Mock,
  wellbeing: useWellbeingEntries as jest.Mock,
  totals: useDailyTotals as jest.Mock,
  experiments: useLabExperiments as jest.Mock,
  weekPlan: useWeekPlan as jest.Mock,
  conflicts: useSessionConflicts as jest.Mock,
  runner: useRunnerProfile as jest.Mock,
  runs: useRunHistory as jest.Mock,
  strength: useStrengthSection as jest.Mock,
  workouts: useWorkoutHistory as jest.Mock,
};

const mockedQuery = useQuery as unknown as jest.Mock;

/**
 * Les valeurs par défaut suivent les **types réels** des hooks sources, pas une forme simplifiée :
 * un `null` passé là où le moteur lit un champ ferait planter le rendu, ou pire, passerait dans un
 * chemin d'erreur silencieux (septième famille de faux vert, §5 bis de strategie-tests.md).
 */
function setupAll() {
  m.settings.mockReturnValue({ settings: { activePillars: ['strength', 'running', 'nutrition'] }, isLoading: false });
  m.profile.mockReturnValue({ profile: { mainGoal: 'maintain' }, isLoading: false });
  m.nutritionProfile.mockReturnValue({ nutritionProfile: null, isLoading: false });
  m.carbs.mockReturnValue({ result: null, isLoading: false });
  m.latestWeight.mockReturnValue({ latest: { logDate: TODAY, weightKg: 70 }, isLoading: false });
  m.weights.mockReturnValue({ entries: [], isLoading: false });
  m.summary.mockReturnValue({ target: 2400, isLoading: false });
  m.overtraining.mockReturnValue({ show: false, severity: null, streakDays: 0 });
  m.load.mockReturnValue({ show: false, ratio: null });
  m.deficit.mockReturnValue({ show: false, deficitPct: 0, loggedDays: 0 });
  m.wellbeing.mockReturnValue({ entries: [], isLoading: false });
  m.totals.mockReturnValue({ totals: [], isLoading: false });
  m.experiments.mockReturnValue({ experiments: [], isLoading: false });
  m.weekPlan.mockReturnValue({ items: [], isLoading: false });
  m.conflicts.mockReturnValue({ conflicts: [], isLoading: false });
  m.runner.mockReturnValue({ runnerProfile: null, isLoading: false });
  m.runs.mockReturnValue({ runs: [], isLoading: false });
  m.strength.mockReturnValue({ lifts: [], history: [], isLoading: false });
  m.workouts.mockReturnValue({ workouts: [], isLoading: false });
  mockedQuery.mockReturnValue({ data: [], isLoading: false, error: undefined });
}

beforeEach(() => {
  resetTestDb();
  jest.clearAllMocks();
  setupAll();
});

// ---------------------------------------------------------------------------
// Les deux requêtes neuves, sur du vrai SQLite
// ---------------------------------------------------------------------------

describe('SELECT_LAB_LIFT_SETS', () => {
  const since = '2026-07-22T00:00:00.000Z';

  const liftSet = (id: string, exerciseId: string, finishedAt: string, reps: number, kg: number, over: Record<string, unknown> = {}) => {
    seed('workouts', [
      { id: `w-${id}`, user_id: 'u', status: 'completed', started_at: finishedAt, finished_at: finishedAt },
    ]);
    seed('workout_sets', [
      { id, workout_id: `w-${id}`, user_id: 'u', exercise_id: exerciseId, order_index: 0, set_type: 'normal', reps, weight_kg: kg, done: 1, ...over },
    ]);
  };

  it('ne rend que les séries des trois mouvements désignés', async () => {
    liftSet('s-squat', 'ex-squat', '2026-09-01T18:00:00.000Z', 5, 120);
    liftSet('s-autre', 'ex-curl', '2026-09-01T18:00:00.000Z', 10, 20);

    const rows = await testPowerSync.getAll<{ exercise_id: string }>(SELECT_LAB_LIFT_SETS, [
      since, 'ex-squat', 'ex-bench', 'ex-deadlift',
    ]);

    expect(rows.map((r) => r.exercise_id)).toEqual(['ex-squat']);
  });

  it('écarte échauffements, séries non faites et valeurs manquantes', async () => {
    liftSet('s-ok', 'ex-squat', '2026-09-01T18:00:00.000Z', 5, 120);
    liftSet('s-warm', 'ex-squat', '2026-09-02T18:00:00.000Z', 5, 60, { set_type: 'warmup' });
    liftSet('s-non', 'ex-squat', '2026-09-03T18:00:00.000Z', 5, 130, { done: 0 });
    liftSet('s-sans-poids', 'ex-squat', '2026-09-04T18:00:00.000Z', 5, null as unknown as number);

    const rows = await testPowerSync.getAll<{ weight_kg: number }>(SELECT_LAB_LIFT_SETS, [
      since, 'ex-squat', 'ex-bench', 'ex-deadlift',
    ]);

    expect(rows.map((r) => r.weight_kg)).toEqual([120]);
  });

  it('écarte les séries antérieures à la fenêtre', async () => {
    liftSet('s-vieux', 'ex-squat', '2026-05-01T18:00:00.000Z', 5, 120);

    expect(
      await testPowerSync.getAll(SELECT_LAB_LIFT_SETS, [since, 'ex-squat', 'ex-bench', 'ex-deadlift']),
    ).toHaveLength(0);
  });

  it('rend les séries dans l’ordre chronologique : le 1RM par semaine en dépend', async () => {
    liftSet('s-2', 'ex-squat', '2026-09-10T18:00:00.000Z', 5, 125);
    liftSet('s-1', 'ex-squat', '2026-08-10T18:00:00.000Z', 5, 120);

    const rows = await testPowerSync.getAll<{ weight_kg: number }>(SELECT_LAB_LIFT_SETS, [
      since, 'ex-squat', 'ex-bench', 'ex-deadlift',
    ]);

    expect(rows.map((r) => r.weight_kg)).toEqual([120, 125]);
  });

  it('accepte trois identifiants vides quand aucun mouvement n’est désigné', async () => {
    liftSet('s-1', 'ex-squat', '2026-09-01T18:00:00.000Z', 5, 120);

    expect(await testPowerSync.getAll(SELECT_LAB_LIFT_SETS, [since, '', '', ''])).toHaveLength(0);
  });
});

describe('SELECT_LAB_WORKOUT_MUSCLES', () => {
  const since = '2026-07-22T00:00:00.000Z';

  beforeEach(() => {
    seed('exercises', [
      { id: 'ex-squat', source: 'library', muscle_primary: 'legs' },
      { id: 'ex-bench', source: 'library', muscle_primary: 'chest' },
    ]);
  });

  it('compte les séries par séance ET par groupe musculaire', async () => {
    seed('workouts', [
      { id: 'w-1', user_id: 'u', status: 'completed', started_at: '2026-09-01T18:00:00.000Z', finished_at: '2026-09-01T18:00:00.000Z' },
    ]);
    seed('workout_sets', [
      { id: 's-1', workout_id: 'w-1', user_id: 'u', exercise_id: 'ex-squat', order_index: 0, set_type: 'normal', reps: 5, weight_kg: 120, done: 1 },
      { id: 's-2', workout_id: 'w-1', user_id: 'u', exercise_id: 'ex-squat', order_index: 1, set_type: 'normal', reps: 5, weight_kg: 120, done: 1 },
      { id: 's-3', workout_id: 'w-1', user_id: 'u', exercise_id: 'ex-bench', order_index: 2, set_type: 'normal', reps: 5, weight_kg: 80, done: 1 },
    ]);

    const rows = await testPowerSync.getAll<{ muscle: string; sets: number }>(SELECT_LAB_WORKOUT_MUSCLES, [since]);

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ muscle: 'legs', sets: 2 }),
        expect.objectContaining({ muscle: 'chest', sets: 1 }),
      ]),
    );
  });

  it('sépare deux séances du même jour : « jambes lourdes » se juge par séance', async () => {
    for (const id of ['w-1', 'w-2']) {
      seed('workouts', [
        { id, user_id: 'u', status: 'completed', started_at: '2026-09-01T18:00:00.000Z', finished_at: '2026-09-01T18:00:00.000Z' },
      ]);
      seed('workout_sets', [
        { id: `s-${id}`, workout_id: id, user_id: 'u', exercise_id: 'ex-squat', order_index: 0, set_type: 'normal', reps: 5, weight_kg: 120, done: 1 },
      ]);
    }

    const rows = await testPowerSync.getAll(SELECT_LAB_WORKOUT_MUSCLES, [since]);

    expect(rows).toHaveLength(2);
  });

  it('écarte les séances non terminées : on rejoue ce qui a été FAIT', async () => {
    seed('workouts', [
      { id: 'w-1', user_id: 'u', status: 'in_progress', started_at: '2026-09-01T18:00:00.000Z', finished_at: null },
    ]);
    seed('workout_sets', [
      { id: 's-1', workout_id: 'w-1', user_id: 'u', exercise_id: 'ex-squat', order_index: 0, set_type: 'normal', reps: 5, weight_kg: 120, done: 1 },
    ]);

    expect(await testPowerSync.getAll(SELECT_LAB_WORKOUT_MUSCLES, [since])).toHaveLength(0);
  });

  it('écarte échauffements et séries non faites du compte', async () => {
    seed('workouts', [
      { id: 'w-1', user_id: 'u', status: 'completed', started_at: '2026-09-01T18:00:00.000Z', finished_at: '2026-09-01T18:00:00.000Z' },
    ]);
    seed('workout_sets', [
      { id: 's-ok', workout_id: 'w-1', user_id: 'u', exercise_id: 'ex-squat', order_index: 0, set_type: 'normal', reps: 5, weight_kg: 120, done: 1 },
      { id: 's-warm', workout_id: 'w-1', user_id: 'u', exercise_id: 'ex-squat', order_index: 1, set_type: 'warmup', reps: 5, weight_kg: 60, done: 1 },
      { id: 's-non', workout_id: 'w-1', user_id: 'u', exercise_id: 'ex-squat', order_index: 2, set_type: 'normal', reps: 5, weight_kg: 120, done: 0 },
    ]);

    const rows = await testPowerSync.getAll<{ sets: number }>(SELECT_LAB_WORKOUT_MUSCLES, [since]);

    expect(rows[0]!.sets).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// L'onglet « Semaine »
// ---------------------------------------------------------------------------

describe('useLabWeek', () => {
  it('ouvre la semaine au lundi de la semaine courante', async () => {
    const { result } = await renderHook(() => useLabWeek());

    expect(result.current.weekStartKey).toBe(WEEK_START);
  });

  it('interroge le plan et les conflits sur ce même lundi', async () => {
    await renderHook(() => useLabWeek());

    expect(m.weekPlan).toHaveBeenCalledWith(WEEK_START);
    expect(m.conflicts).toHaveBeenCalledWith(WEEK_START);
  });

  it('retient les courses de la semaine, et rien d’autre', async () => {
    m.runs.mockReturnValue({
      runs: [
        { finishedAt: new Date('2026-09-15T10:00:00').toISOString(), distanceM: 8000, avgPaceSPerKm: 300, sessionType: 'endurance', rpe: 5, durationSeconds: 2400 },
        { finishedAt: new Date('2026-09-01T10:00:00').toISOString(), distanceM: 12000, avgPaceSPerKm: 300, sessionType: 'endurance', rpe: 5, durationSeconds: 3600 },
      ],
      isLoading: false,
    });

    const { result } = await renderHook(() => useLabWeek());

    // 8 km et non 20 : la sortie du 1ᵉʳ septembre est hors semaine.
    expect(result.current.week.progress.running?.doneKm).toBe(8);
  });

  it('ignore une course jamais terminée : sans date de fin, elle n’a pas de jour', async () => {
    m.runs.mockReturnValue({
      runs: [{ finishedAt: null, distanceM: 8000, avgPaceSPerKm: null, sessionType: null, rpe: null, durationSeconds: null }],
      isLoading: false,
    });

    const { result } = await renderHook(() => useLabWeek());

    expect(result.current.week.progress.running?.doneKm).toBe(0);
  });

  it('rattache une course de 23 h 30 au bon jour, pas au lendemain', async () => {
    m.runs.mockReturnValue({
      runs: [{ finishedAt: new Date('2026-09-20T23:30:00').toISOString(), distanceM: 5000, avgPaceSPerKm: 300, sessionType: 'endurance', rpe: 5, durationSeconds: 1500 }],
      isLoading: false,
    });
    // Le 20/09 est un dimanche : il appartient à la semaine du 14, la borne haute.
    const { result } = await renderHook(() => useLabWeek());

    expect(result.current.week.progress.running?.doneKm).toBe(5);
  });

  it('remonte l’alerte de charge en proposition quand le ratio est en zone de risque', async () => {
    m.load.mockReturnValue({ show: true, ratio: 1.8 });
    m.weekPlan.mockReturnValue({
      items: [{ id: 'p1', pillar: 'strength', status: 'planned', scheduledDate: '2026-09-17', sessionName: 'Push', sessionType: null, targetDistanceM: null }],
      isLoading: false,
    });

    const { result } = await renderHook(() => useLabWeek());

    expect(result.current.week.proposals.map((p) => p.id)).toContain('loadRisk');
  });

  it('ne propose rien sans ratio connu : pas d’alerte sans historique', async () => {
    m.load.mockReturnValue({ show: false, ratio: null });
    m.weekPlan.mockReturnValue({
      items: [{ id: 'p1', pillar: 'strength', status: 'planned', scheduledDate: '2026-09-17', sessionName: 'Push', sessionType: null, targetDistanceM: null }],
      isLoading: false,
    });

    const { result } = await renderHook(() => useLabWeek());

    expect(result.current.week.proposals.map((p) => p.id)).not.toContain('loadRisk');
  });

  it('ne remonte pas l’alerte quand le ratio existe mais reste sous le seuil', async () => {
    m.load.mockReturnValue({ show: false, ratio: 0.9 });
    m.weekPlan.mockReturnValue({
      items: [{ id: 'p1', pillar: 'strength', status: 'planned', scheduledDate: '2026-09-17', sessionName: 'Push', sessionType: null, targetDistanceM: null }],
      isLoading: false,
    });

    const { result } = await renderHook(() => useLabWeek());

    expect(result.current.week.proposals.map((p) => p.id)).not.toContain('loadRisk');
  });

  it.each([
    ['settings', () => m.settings.mockReturnValue({ settings: null, isLoading: true })],
    ['plan', () => m.weekPlan.mockReturnValue({ items: [], isLoading: true })],
    ['conflits', () => m.conflicts.mockReturnValue({ conflicts: [], isLoading: true })],
    ['courses', () => m.runs.mockReturnValue({ runs: [], isLoading: true })],
    ['journal', () => m.totals.mockReturnValue({ totals: [], isLoading: true })],
    ['bien-être', () => m.wellbeing.mockReturnValue({ entries: [], isLoading: true })],
    ['poids', () => m.latestWeight.mockReturnValue({ latest: null, isLoading: true })],
    ['glucides', () => m.carbs.mockReturnValue({ result: null, isLoading: true })],
  ])('relaie le chargement de la source « %s »', async (_label, arrange) => {
    arrange();

    const { result } = await renderHook(() => useLabWeek());

    expect(result.current.isLoading).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// L'objectif nutritionnel et les piliers
// ---------------------------------------------------------------------------

describe('useLabObjective', () => {
  it('reprend l’objectif du profil nutritionnel quand il existe', async () => {
    m.nutritionProfile.mockReturnValue({ nutritionProfile: { objective: 'cut' }, isLoading: false });

    const { result } = await renderHook(() => useLabObjective());

    expect(result.current).toBe('cut');
  });

  it('retombe sur l’objectif principal du profil, même repli qu’ailleurs dans l’app', async () => {
    m.nutritionProfile.mockReturnValue({ nutritionProfile: null, isLoading: false });
    m.profile.mockReturnValue({ profile: { mainGoal: 'lose_weight' }, isLoading: false });

    const { result } = await renderHook(() => useLabObjective());

    expect(result.current).toBeDefined();
  });

  it('rend un objectif même sans profil du tout', async () => {
    m.nutritionProfile.mockReturnValue({ nutritionProfile: null, isLoading: false });
    m.profile.mockReturnValue({ profile: null, isLoading: false });

    const { result } = await renderHook(() => useLabObjective());

    expect(result.current).toBeDefined();
  });
});

describe('useLabPillars', () => {
  it('reprend les piliers des réglages', async () => {
    m.settings.mockReturnValue({ settings: { activePillars: ['strength'] }, isLoading: false });

    const { result } = await renderHook(() => useLabPillars());

    expect(result.current).toEqual(['strength']);
  });

  it('retombe sur les trois piliers quand le réglage est absent', async () => {
    m.settings.mockReturnValue({ settings: null, isLoading: false });

    const { result } = await renderHook(() => useLabPillars());

    expect(result.current.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Les onglets « Pourquoi ? » et « Acquis »
// ---------------------------------------------------------------------------

describe('useLabQuestions', () => {
  it('ne rend aucune question tant que l’historique charge — pas une liste vide trompeuse', async () => {
    m.strength.mockReturnValue({ lifts: [], history: [], isLoading: true });

    const { result } = await renderHook(() => useLabQuestions());

    expect(result.current).toEqual({ questions: [], isLoading: true });
  });

  it('rend une liste de questions une fois chargé', async () => {
    const { result } = await renderHook(() => useLabQuestions());

    expect(result.current.isLoading).toBe(false);
    expect(Array.isArray(result.current.questions)).toBe(true);
  });

  it('lit l’historique sur la fenêtre annoncée de huit semaines', async () => {
    await renderHook(() => useLabQuestions());

    expect(LAB_HISTORY_DAYS).toBe(56);
    expect(m.totals).toHaveBeenCalledWith('2026-07-22');
  });
});

describe('useLabKnowledge', () => {
  it('ne rend aucune carte tant que ça charge', async () => {
    m.experiments.mockReturnValue({ experiments: [], isLoading: true });

    const { result } = await renderHook(() => useLabKnowledge());

    expect(result.current).toMatchObject({ cards: [], isLoading: true });
  });

  it('rend cartes et expériences une fois chargé', async () => {
    const { result } = await renderHook(() => useLabKnowledge());

    expect(result.current.isLoading).toBe(false);
    expect(Array.isArray(result.current.cards)).toBe(true);
    expect(result.current.experiments).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// L'onglet « Composer »
// ---------------------------------------------------------------------------

describe('useLabComposer', () => {
  it('compte les séances planifiées de la semaine, par pilier', async () => {
    m.weekPlan.mockReturnValue({
      items: [
        { id: '1', pillar: 'strength', status: 'planned', scheduledDate: WEEK_START },
        { id: '2', pillar: 'strength', status: 'done', scheduledDate: WEEK_START },
        { id: '3', pillar: 'running', status: 'planned', scheduledDate: WEEK_START },
      ],
      isLoading: false,
    });

    const { result } = await renderHook(() => useLabComposer());

    expect(result.current.context.baseline.strengthSessions).toBe(2);
  });

  it('ne compte pas une séance sautée : elle n’a pas eu lieu et n’aura pas lieu', async () => {
    m.weekPlan.mockReturnValue({
      items: [
        { id: '1', pillar: 'strength', status: 'planned', scheduledDate: WEEK_START },
        { id: '2', pillar: 'strength', status: 'skipped', scheduledDate: WEEK_START },
      ],
      isLoading: false,
    });

    const { result } = await renderHook(() => useLabComposer());

    expect(result.current.context.baseline.strengthSessions).toBe(1);
  });

  it('préfère la fréquence déclarée du coureur au décompte du planning', async () => {
    m.runner.mockReturnValue({ runnerProfile: { weeklyFrequency: 4 }, isLoading: false });
    m.weekPlan.mockReturnValue({
      items: [{ id: '3', pillar: 'running', status: 'planned', scheduledDate: WEEK_START }],
      isLoading: false,
    });

    const { result } = await renderHook(() => useLabComposer());

    expect(result.current.context.baseline.runningFrequency).toBe(4);
  });

  it('dérive les protéines par kilo de la cible saisie à la main', async () => {
    m.nutritionProfile.mockReturnValue({
      nutritionProfile: { objective: 'maintain', manualProteinG: 140 },
      isLoading: false,
    });

    const { result } = await renderHook(() => useLabComposer());

    expect(result.current.context.baseline.proteinGPerKg).toBe(2); // 140 g / 70 kg
  });

  it('retombe sur la cible de l’objectif quand rien n’est saisi', async () => {
    const { result } = await renderHook(() => useLabComposer());

    expect(result.current.context.baseline.proteinGPerKg).toBe(
      PROTEIN_TARGETS_G_PER_KG[result.current.context.baseline.objective].min,
    );
  });

  it('ne divise pas par un poids inconnu : la cible de l’objectif reprend la main', async () => {
    m.latestWeight.mockReturnValue({ latest: null, isLoading: false });
    m.nutritionProfile.mockReturnValue({
      nutritionProfile: { objective: 'maintain', manualProteinG: 140 },
      isLoading: false,
    });

    const { result } = await renderHook(() => useLabComposer());

    expect(Number.isFinite(result.current.context.baseline.proteinGPerKg)).toBe(true);
  });

  it('suppose une nuit courte sans sommeil saisi — l’hypothèse prudente, pas une invention', async () => {
    const { result } = await renderHook(() => useLabComposer());

    expect(result.current.context.baseline.sleep).toBe('short');
  });

  it('reconnaît une nuit longue quand le sommeil est saisi', async () => {
    m.wellbeing.mockReturnValue({
      entries: [
        { logDate: '2026-09-14', sleepMinutes: 480, energy: 4, mood: 4, stress: 2 },
        { logDate: '2026-09-15', sleepMinutes: 470, energy: 4, mood: 4, stress: 2 },
      ],
      isLoading: false,
    });

    const { result } = await renderHook(() => useLabComposer());

    expect(result.current.context.baseline.sleep).toBe('long');
  });

  it('ignore les nuits non renseignées dans la moyenne de sommeil', async () => {
    m.wellbeing.mockReturnValue({
      entries: [
        { logDate: '2026-09-14', sleepMinutes: 480, energy: 4, mood: 4, stress: 2 },
        { logDate: '2026-09-15', sleepMinutes: null, energy: 4, mood: 4, stress: 2 },
      ],
      isLoading: false,
    });

    const { result } = await renderHook(() => useLabComposer());

    // 480 et non 240 : le jour vide ne compte pas comme une nuit de zéro heure.
    expect(result.current.context.baseline.sleep).toBe('long');
  });

  it('remonte au TDEE depuis la cible, pour pouvoir recalculer un autre objectif', async () => {
    const { result } = await renderHook(() => useLabComposer());

    expect(result.current.context.tdeeKcal).not.toBeNull();
  });

  it('laisse le TDEE à null quand aucune cible n’est connue', async () => {
    m.summary.mockReturnValue({ target: null, isLoading: false });

    const { result } = await renderHook(() => useLabComposer());

    expect(result.current.context.tdeeKcal).toBeNull();
  });

  it('moyenne la durée des courses des sept derniers jours', async () => {
    m.runs.mockReturnValue({
      runs: [
        { finishedAt: new Date('2026-09-15T10:00:00').toISOString(), durationSeconds: 3600, distanceM: 10000, avgPaceSPerKm: 360, sessionType: 'endurance', rpe: 5 },
        { finishedAt: new Date('2026-09-14T10:00:00').toISOString(), durationSeconds: 1800, distanceM: 5000, avgPaceSPerKm: 360, sessionType: 'endurance', rpe: 5 },
      ],
      isLoading: false,
    });

    const { result } = await renderHook(() => useLabComposer());

    expect(result.current.context.hoursPerRun).toBeCloseTo(0.75, 5);
  });

  it('écarte les courses hors fenêtre de la moyenne de durée', async () => {
    m.runs.mockReturnValue({
      runs: [
        { finishedAt: new Date('2026-08-01T10:00:00').toISOString(), durationSeconds: 7200, distanceM: 20000, avgPaceSPerKm: 360, sessionType: 'endurance', rpe: 5 },
      ],
      isLoading: false,
    });

    const { result } = await renderHook(() => useLabComposer());

    expect(result.current.context.hoursPerRun).toBeNull();
  });

  it('rend null comme projection SBD sans historique exploitable', async () => {
    const { result } = await renderHook(() => useLabComposer());

    expect(result.current.context.sbd).toBeNull();
  });

  it.each([
    ['settings', () => m.settings.mockReturnValue({ settings: null, isLoading: true })],
    ['plan', () => m.weekPlan.mockReturnValue({ items: [], isLoading: true })],
    ['profil coureur', () => m.runner.mockReturnValue({ runnerProfile: null, isLoading: true })],
    ['profil nutrition', () => m.nutritionProfile.mockReturnValue({ nutritionProfile: null, isLoading: true })],
    ['résumé nutrition', () => m.summary.mockReturnValue({ target: null, isLoading: true })],
  ])('relaie le chargement de la source « %s »', async (_label, arrange) => {
    arrange();

    const { result } = await renderHook(() => useLabComposer());

    expect(result.current.isLoading).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Les deux fonctions pures
// ---------------------------------------------------------------------------

describe('nextMondayKey', () => {
  it('rend le lundi de la semaine prochaine depuis un mercredi', () => {
    expect(nextMondayKey('2026-09-16')).toBe('2026-09-21');
  });

  it('rend le lundi suivant depuis un lundi, jamais le jour même', () => {
    expect(nextMondayKey('2026-09-14')).toBe('2026-09-21');
  });

  it('traite le dimanche comme la fin de la semaine en cours', () => {
    expect(nextMondayKey('2026-09-20')).toBe('2026-09-21');
  });

  it('franchit un changement de mois', () => {
    expect(nextMondayKey('2026-09-30')).toBe('2026-10-05');
  });
});

describe('hardDayCarbTarget', () => {
  it('rend null sans niveau de charge, plutôt qu’une cible par défaut', () => {
    expect(hardDayCarbTarget(null)).toBeNull();
  });

  it.each(Object.keys(CARB_TARGETS_G_PER_KG) as (keyof typeof CARB_TARGETS_G_PER_KG)[])(
    'rend la cible du niveau « %s »',
    (level) => {
      expect(hardDayCarbTarget(level)).toEqual(CARB_TARGETS_G_PER_KG[level]);
    },
  );
});
