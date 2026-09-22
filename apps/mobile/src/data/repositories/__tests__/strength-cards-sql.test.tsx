/**
 * US MUSCU-UX05 — les trois cartes neuves du hub Musculation. Fichier à **0 %**.
 *
 * Les deux requêtes ne sont pas exportées : on les **capture** au passage de `useQuery` puis on les
 * rejoue sur le harness SQLite, ce qui teste le SQL réellement embarqué et non une copie (§3.3).
 *
 * Trois règles portées par ce fichier, dont deux invisibles à l'écran :
 *
 * - **Le mur ne montre que `max_weight`.** Une même série produit souvent deux records (la charge
 *   *et* le 1RM estimé) : les mélanger remplirait le mur de doublons célébrant une seule
 *   performance. Rien ne le signale — le mur a juste l'air deux fois plus rempli qu'il ne l'est.
 * - **La valeur précédente exclut le record lui-même** (`achieved_at <`), sinon le « +5 kg » de la
 *   carte vaudrait toujours zéro.
 * - **La fenêtre de lecture des charges est plus large que la fenêtre de comparaison.** Sans
 *   l'historique d'avant, aucun exercice n'a de référence et la carte est vide pour tout le monde.
 */

import { renderHook } from '@testing-library/react-native';
import { useQuery } from '@powersync/react';
import { MAX_INSIGHTS } from '@wellness/shared';

import {
  STRENGTH_THREAD_MAX,
  useLoadProgress,
  useRecentRecords,
  useStrengthThread,
} from '../strength-cards-repository';
import { useMuscleBalance, useNeglectedFavorites } from '../records-repository';
import { useSettings } from '../settings-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('../settings-repository', () => ({ useSettings: jest.fn() }));
jest.mock('../records-repository', () => ({
  useMuscleBalance: jest.fn(),
  useNeglectedFavorites: jest.fn(),
}));
jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: jest.fn(() => '2026-09-22') }));

const mockedQuery = useQuery as unknown as jest.Mock;
const settingsOf = useSettings as jest.Mock;
const balanceOf = useMuscleBalance as jest.Mock;
const neglectedOf = useNeglectedFavorites as jest.Mock;

/**
 * Un équilibre musculaire « rien à signaler ». `candidateFromMuscleBalance` lit `hasEnoughData`
 * sans garde : passer `null` ferait planter le hook — le mock doit suivre le **type réel**, pas une
 * forme simplifiée (septième famille de faux vert, §5 bis).
 */
const EQUILIBRE = { groups: [], neglected: [], totalSets: 0, hasEnoughData: false };

type Emitted = { sql: string; params: unknown[] };

/** Monte un hook, rend les requêtes qu'il émet et alimente celles qu'on désigne. */
async function emitted(
  hook: () => unknown,
  rows: { match: string; data: unknown[] }[] = [],
): Promise<Emitted[]> {
  const calls: Emitted[] = [];
  mockedQuery.mockImplementation((sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    return { data: rows.find((r) => sql.includes(r.match))?.data ?? [], isLoading: false, error: undefined };
  });
  await renderHook(hook);
  return calls;
}

/** La première requête émise par un hook. */
async function firstQuery(hook: () => unknown): Promise<Emitted> {
  const calls = await emitted(hook);
  if (calls.length === 0) throw new Error('Le hook n’a émis aucune requête');
  return calls[0]!;
}

const feed = (data: unknown[]) =>
  mockedQuery.mockReturnValue({ data, isLoading: false, error: undefined });

beforeEach(() => {
  resetTestDb();
  jest.clearAllMocks();
  settingsOf.mockReturnValue({ settings: { sbdLifts: null }, isLoading: false });
  balanceOf.mockReturnValue({ balance: EQUILIBRE, isLoading: false });
  neglectedOf.mockReturnValue({ neglected: [], isLoading: false });
});

// ---------------------------------------------------------------------------
// « Tes charges »
// ---------------------------------------------------------------------------

describe('useLoadProgress', () => {
  it('lit les séries sur une fenêtre plus large que les 30 jours de comparaison', async () => {
    const { params } = await firstQuery(() => useLoadProgress());
    const since = params[1] as string;

    const days = Math.round((Date.now() - new Date(since).getTime()) / 86_400_000);
    expect(days).toBeGreaterThan(30);
  });

  it('sa requête s’exécute sur le schéma réel', async () => {
    const { sql, params } = await firstQuery(() => useLoadProgress());

    await expect(testPowerSync.getAll(sql, params)).resolves.toEqual([]);
  });

  it('écarte échauffements et séries au temps — ni l’un ni l’autre n’a de 1RM', async () => {
    seed('exercises', [{ id: 'ex-1', source: 'library', muscle_primary: 'chest' }]);
    seed('workouts', [
      { id: 'w-1', user_id: 'u', status: 'completed', started_at: '2026-09-20T18:00:00.000Z', finished_at: '2026-09-20T18:00:00.000Z' },
    ]);
    seed('workout_sets', [
      { id: 's-ok', workout_id: 'w-1', user_id: 'u', exercise_id: 'ex-1', order_index: 0, set_type: 'normal', reps: 5, weight_kg: 80, done: 1 },
      { id: 's-warm', workout_id: 'w-1', user_id: 'u', exercise_id: 'ex-1', order_index: 1, set_type: 'warmup', reps: 10, weight_kg: 40, done: 1 },
      { id: 's-time', workout_id: 'w-1', user_id: 'u', exercise_id: 'ex-1', order_index: 2, set_type: 'duration', reps: 1, weight_kg: 0, done: 1 },
      { id: 's-non', workout_id: 'w-1', user_id: 'u', exercise_id: 'ex-1', order_index: 3, set_type: 'normal', reps: 5, weight_kg: 90, done: 0 },
    ]);

    const { sql, params } = await firstQuery(() => useLoadProgress());
    const rows = await testPowerSync.getAll<{ id: string; weight_kg: number }>(sql, params);

    expect(rows.map((r) => r.weight_kg)).toEqual([80]);
  });

  it('écarte une séance non terminée : une charge sans date de fin n’a pas de jour', async () => {
    seed('exercises', [{ id: 'ex-1', source: 'library' }]);
    seed('workouts', [
      { id: 'w-1', user_id: 'u', status: 'in_progress', started_at: '2026-09-20T18:00:00.000Z', finished_at: null },
    ]);
    seed('workout_sets', [
      { id: 's-1', workout_id: 'w-1', user_id: 'u', exercise_id: 'ex-1', order_index: 0, set_type: 'normal', reps: 5, weight_kg: 80, done: 1 },
    ]);

    const { sql, params } = await firstQuery(() => useLoadProgress());

    expect(await testPowerSync.getAll(sql, params)).toHaveLength(0);
  });

  it('garde l’id de l’exercice comme nom quand la traduction manque : laid mais honnête', async () => {
    // Deux jours et une charge qui monte : sans progression réelle, `computeLoadProgress` rend
    // `empty` et le nom n'apparaît nulle part — le cas ne serait pas testé.
    feed([
      { exercise_id: 'ex-orphelin', exercise_name: null, finished_at: new Date('2026-09-15T18:00:00').toISOString(), reps: 5, weight_kg: 80 },
      { exercise_id: 'ex-orphelin', exercise_name: null, finished_at: new Date('2026-09-20T18:00:00').toISOString(), reps: 5, weight_kg: 90 },
    ]);
    const { result } = await renderHook(() => useLoadProgress());

    expect(result.current.progress.kind).not.toBe('empty');
    expect(JSON.stringify(result.current.progress)).toContain('ex-orphelin');
  });

  it('relaie le chargement des réglages autant que celui de la requête', async () => {
    settingsOf.mockReturnValue({ settings: null, isLoading: true });
    mockedQuery.mockReturnValue({ data: [], isLoading: false, error: undefined });

    const { result } = await renderHook(() => useLoadProgress());

    expect(result.current.isLoading).toBe(true);
  });

  it('montre le visage « charges » tant que les trois mouvements ne sont pas désignés', async () => {
    feed([]);
    const { result } = await renderHook(() => useLoadProgress());

    expect(result.current.face).toBe('loads');
  });
});

// ---------------------------------------------------------------------------
// « Le mur » — les records tombés
// ---------------------------------------------------------------------------

describe('useRecentRecords', () => {
  const records = () => {
    seed('exercise_translations', [{ id: 't1', exercise_id: 'ex-1', lang: 'fr', name: 'Développé couché' }]);
    seed('personal_records', [
      { id: 'r-vieux', user_id: 'u', exercise_id: 'ex-1', type: 'max_weight', value: 80, achieved_at: '2026-09-01T18:00:00.000Z' },
      { id: 'r-neuf', user_id: 'u', exercise_id: 'ex-1', type: 'max_weight', value: 85, achieved_at: '2026-09-20T18:00:00.000Z' },
      { id: 'r-1rm', user_id: 'u', exercise_id: 'ex-1', type: 'estimated_1rm', value: 98, achieved_at: '2026-09-20T18:00:00.000Z' },
    ]);
  };

  it('⚠️ ne retient que `max_weight` : le 1RM estimé de la même série ferait un doublon', async () => {
    records();
    const { sql, params } = await firstQuery(() => useRecentRecords(6));
    const rows = await testPowerSync.getAll<{ id: string }>(sql, params);

    expect(rows.map((r) => r.id)).toEqual(['r-neuf', 'r-vieux']);
  });

  it('donne la valeur précédente, celle qui produit le « +5 kg »', async () => {
    records();
    const { sql, params } = await firstQuery(() => useRecentRecords(6));
    const rows = await testPowerSync.getAll<{ id: string; previous: number | null }>(sql, params);

    expect(rows.find((r) => r.id === 'r-neuf')!.previous).toBe(80);
  });

  it('laisse la valeur précédente à null pour un premier record, plutôt qu’à zéro', async () => {
    records();
    const { sql, params } = await firstQuery(() => useRecentRecords(6));
    const rows = await testPowerSync.getAll<{ id: string; previous: number | null }>(sql, params);

    expect(rows.find((r) => r.id === 'r-vieux')!.previous).toBeNull();
  });

  it('respecte la limite demandée', async () => {
    records();
    const { sql, params } = await firstQuery(() => useRecentRecords(1));

    expect(await testPowerSync.getAll(sql, params)).toHaveLength(1);
  });

  it('exclut un record supprimé', async () => {
    seed('personal_records', [
      { id: 'r-1', user_id: 'u', exercise_id: 'ex-1', type: 'max_weight', value: 85, achieved_at: '2026-09-20T18:00:00.000Z', deleted_at: '2026-09-21T00:00:00.000Z' },
    ]);
    const { sql, params } = await firstQuery(() => useRecentRecords(6));

    expect(await testPowerSync.getAll(sql, params)).toHaveLength(0);
  });

  it('convertit l’horodatage en clé de jour locale', async () => {
    feed([
      { id: 'r', exercise_id: 'ex-1', exercise_name: 'Squat', type: 'max_weight', value: 100, previous: 95, achieved_at: new Date('2026-09-20T22:30:00').toISOString() },
    ]);
    const { result } = await renderHook(() => useRecentRecords());

    expect(result.current.records[0]!.achievedOn).toBe('2026-09-20');
  });

  it('retombe sur l’id quand l’exercice n’a pas de nom', async () => {
    feed([
      { id: 'r', exercise_id: 'ex-orphelin', exercise_name: null, type: 'max_weight', value: 100, previous: null, achieved_at: '2026-09-20T18:00:00.000Z' },
    ]);
    const { result } = await renderHook(() => useRecentRecords());

    expect(result.current.records[0]!.exerciseName).toBe('ex-orphelin');
  });
});

// ---------------------------------------------------------------------------
// « Le fil du jour »
// ---------------------------------------------------------------------------

describe('useStrengthThread', () => {
  it('ne montre jamais plus d’une ligne, quel que soit le plafond général des insights', () => {
    expect(STRENGTH_THREAD_MAX).toBe(1);
    expect(MAX_INSIGHTS).toBeGreaterThanOrEqual(1);
  });

  it('rend null quand aucun candidat ne se présente', async () => {
    feed([]);
    const { result } = await renderHook(() => useStrengthThread());

    expect(result.current.thread).toBeNull();
  });

  it('retient un seul insight là où le moteur pourrait en rendre plusieurs', async () => {
    balanceOf.mockReturnValue({
      balance: { dominant: 'chest', neglected: 'back', ratio: 3.2, windowDays: 28 },
      isLoading: false,
    });
    neglectedOf.mockReturnValue({
      neglected: [{ exerciseId: 'ex-9', exerciseName: 'Rowing', lastDoneOn: '2026-07-01', daysSince: 83 }],
      isLoading: false,
    });
    feed([
      { id: 'r', exercise_id: 'ex-1', exercise_name: 'Squat', type: 'max_weight', value: 100, previous: 95, achieved_at: '2026-09-21T18:00:00.000Z' },
    ]);

    const { result } = await renderHook(() => useStrengthThread());

    expect(result.current.thread).not.toBeNull();
  });

  it.each([
    ['balance', () => balanceOf.mockReturnValue({ balance: EQUILIBRE, isLoading: true })],
    ['favoris délaissés', () => neglectedOf.mockReturnValue({ neglected: [], isLoading: true })],
  ])('relaie le chargement de la source « %s »', async (_label, arrange) => {
    feed([]);
    arrange();

    const { result } = await renderHook(() => useStrengthThread());

    expect(result.current.isLoading).toBe(true);
  });

  it('ne demande qu’un seul record au mur : le fil n’en affiche qu’un', async () => {
    const calls = await emitted(() => useStrengthThread());
    const wall = calls.find((c) => c.sql.includes('personal_records'));

    expect(wall).toBeDefined();
    expect(wall!.params[1]).toBe(1);
  });
});
