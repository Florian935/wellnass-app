/**
 * US NORYN-02 — le **filet** de l'assemblage de la dépense d'une journée (`useEnergyItemsByDay`,
 * `useDayEnergy`, `useRestingMetabolismAt`).
 *
 * Écrit et vert **avant** que leur composition ne sorte vers `@wellness/shared` (pour être appelée
 * aussi par la fonction `noryn-context`) : il doit rester vert **sans une ligne modifiée** après.
 * C'est ce qui distingue « j'ai déplacé le calcul » de « j'ai changé les chiffres ».
 *
 * Les sources sont mockées (profil, pesées, activités, requêtes PowerSync) ; les briques pures ne le
 * sont pas. L'horloge est figée au jeudi 08/10/2026 à midi local (seule l'horloge : les minuteurs
 * restent réels), pour que l'âge et « aujourd'hui » ne dépendent pas du jour où l'on lance le test.
 */

import { renderHook } from '@testing-library/react-native';
import { useQuery } from '@powersync/react';
import {
  computeAge,
  estimateActivityEnergy,
  estimateRunEnergy,
  estimateStrengthEnergy,
  restingMetabolism,
} from '@wellness/shared';

import {
  SELECT_RUNS,
  SELECT_WORKOUTS,
  useDayEnergy,
  useEnergyItemsByDay,
  useRestingMetabolismAt,
} from '../energy-repository';
import { useProfile } from '../profile-repository';
import { useWeightEntries } from '../bodyweight-repository';
import { useActivities } from '../activity-repository';

jest.mock('../profile-repository', () => ({ useProfile: jest.fn() }));
jest.mock('../bodyweight-repository', () => ({ useWeightEntries: jest.fn() }));
jest.mock('../activity-repository', () => ({ useActivities: jest.fn() }));

const mockQuery = useQuery as jest.Mock;
const mockProfile = useProfile as jest.Mock;
const mockWeights = useWeightEntries as jest.Mock;
const mockActivities = useActivities as jest.Mock;

const NOW = new Date(2026, 9, 8, 12, 0, 0);
const TODAY = '2026-10-08';
const PROFILE = { sex: 'male' as const, weightKg: 82, heightCm: 180, birthDate: '1996-01-15' };
const AGE = computeAge(new Date(PROFILE.birthDate), NOW);

/** Un instant UTC qui tombe à `hour` heure **locale** du jour donné (indépendant du fuseau du test). */
const atLocal = (dayKey: string, hour: number, minute = 0): string => {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y!, m! - 1, d!, hour, minute, 0).toISOString();
};

type WorkoutRow = { id: string; started_at: string; finished_at: string; duration_seconds: number | null; rpe: number | null; total_sets: number };
type RunRow = { id: string; finished_at: string; distance_m: number | null; duration_seconds: number | null; elevation_gain_m: number | null; rpe: number | null };

function setUp(over: {
  profile?: typeof PROFILE | null;
  weights?: { logDate: string; weightKg: number }[];
  workouts?: WorkoutRow[];
  runs?: RunRow[];
  activities?: Record<string, unknown>[];
} = {}) {
  mockProfile.mockReturnValue({ profile: over.profile === undefined ? PROFILE : over.profile, isLoading: false });
  mockWeights.mockReturnValue({
    entries: (over.weights ?? []).map((w, i) => ({ id: `b${i}`, ...w })),
    isLoading: false,
  });
  mockActivities.mockReturnValue({ activities: over.activities ?? [], isLoading: false });
  mockQuery.mockImplementation((sql: string) => ({
    data: sql === SELECT_WORKOUTS ? (over.workouts ?? []) : sql === SELECT_RUNS ? (over.runs ?? []) : [],
    isLoading: false,
  }));
}

const restingWith = (weightKg: number) =>
  restingMetabolism({ sex: PROFILE.sex, weightKg, heightCm: PROFILE.heightCm, age: AGE });

beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  });
  mockQuery.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
  mockQuery.mockImplementation(() => ({ data: [], isLoading: false, error: undefined }));
});

describe('useRestingMetabolismAt — le repos au poids de la date', () => {
  it('prend la pesée la plus récente au plus tard ce jour-là', async () => {
    setUp({ weights: [{ logDate: '2026-10-01', weightKg: 80 }, { logDate: '2026-10-09', weightKg: 78 }] });
    const { result } = await renderHook(() => useRestingMetabolismAt(TODAY));
    expect(result.current.weightKg).toBe(80);
    expect(result.current.resting).toEqual(restingWith(80));
  });

  it('retombe sur la plus ancienne si toutes les pesées sont après la date', async () => {
    setUp({ weights: [{ logDate: '2026-10-09', weightKg: 78 }, { logDate: '2026-10-12', weightKg: 77 }] });
    const { result } = await renderHook(() => useRestingMetabolismAt(TODAY));
    expect(result.current.weightKg).toBe(78);
  });

  it('retombe sur le poids du profil sans aucune pesée', async () => {
    setUp();
    const { result } = await renderHook(() => useRestingMetabolismAt(TODAY));
    expect(result.current.weightKg).toBe(82);
    expect(result.current.resting).toEqual(restingWith(82));
  });

  it('rend null sans poids du tout', async () => {
    setUp({ profile: { ...PROFILE, weightKg: null as unknown as number } });
    const { result } = await renderHook(() => useRestingMetabolismAt(TODAY));
    expect(result.current).toMatchObject({ resting: null, weightKg: null });
  });

  it('se contente du MET standard sans date de naissance (repos non personnalisé)', async () => {
    setUp({ profile: { ...PROFILE, birthDate: null as unknown as string } });
    const { result } = await renderHook(() => useRestingMetabolismAt(TODAY));
    expect(result.current.resting).toEqual({ kcalPerHour: 82, personalised: false });
  });
});

describe('useEnergyItemsByDay / useDayEnergy — la journée en énergie', () => {
  const workout: WorkoutRow = {
    id: 'w1',
    started_at: atLocal(TODAY, 17),
    finished_at: atLocal(TODAY, 18),
    duration_seconds: 3600,
    rpe: 7,
    total_sets: 18,
  };
  const run: RunRow = {
    id: 'r1',
    finished_at: atLocal(TODAY, 7, 30),
    distance_m: 8000,
    duration_seconds: 2700,
    elevation_gain_m: 50,
    rpe: 5,
  };
  const activity = {
    id: 'a1',
    activityType: 'bike',
    startedAt: atLocal(TODAY, 10),
    durationSeconds: 3600,
    intensity: 'moderate',
    rpe: 6,
    distanceM: 25000,
    deviceKcal: null,
    notes: null,
  };

  it('rattache séance, course et activité à leur jour local, triées par début, au poids de la date', async () => {
    setUp({ weights: [{ logDate: '2026-10-05', weightKg: 79.5 }], workouts: [workout], runs: [run], activities: [activity] });
    const { result } = await renderHook(() => useEnergyItemsByDay());
    const items = result.current.byDay.get(TODAY) ?? [];
    const resting = restingWith(79.5);

    expect(items.map((i) => i.id)).toEqual(['r1', 'a1', 'w1']);
    expect(items[0]).toEqual({
      id: 'r1',
      kind: 'run',
      activityType: null,
      title: null,
      startedAt: run.finished_at,
      durationSeconds: 2700,
      estimate: estimateRunEnergy({ distanceM: 8000, durationSeconds: 2700, elevationGainM: 50, rpe: 5, weightKg: 79.5, resting }),
    });
    expect(items[1]?.estimate).toEqual(
      estimateActivityEnergy({ activityType: 'bike', intensity: 'moderate', durationSeconds: 3600, distanceM: 25000, deviceKcal: null, resting }),
    );
    expect(items[2]?.estimate).toEqual(estimateStrengthEnergy({ durationSeconds: 3600, totalSets: 18, rpe: 7, resting }));
  });

  it('une séance finie à 23 h 30 appartient à ce jour-là ; une activité commencée la veille, à la veille', async () => {
    setUp({
      workouts: [{ ...workout, started_at: atLocal(TODAY, 22, 30), finished_at: atLocal(TODAY, 23, 30) }],
      activities: [{ ...activity, startedAt: atLocal('2026-10-07', 23, 50) }],
    });
    const { result } = await renderHook(() => useEnergyItemsByDay());
    expect(result.current.byDay.get(TODAY)?.map((i) => i.id)).toEqual(['w1']);
    expect(result.current.byDay.get('2026-10-07')?.map((i) => i.id)).toEqual(['a1']);
  });

  it('chaque jour garde son propre poids (pesée du jour de la course passée)', async () => {
    setUp({
      weights: [{ logDate: '2026-09-01', weightKg: 85 }, { logDate: '2026-10-05', weightKg: 79.5 }],
      runs: [{ ...run, id: 'old', finished_at: atLocal('2026-09-10', 8) }, run],
    });
    const { result } = await renderHook(() => useEnergyItemsByDay());
    expect(result.current.byDay.get('2026-09-10')?.[0]?.estimate).toEqual(
      estimateRunEnergy({ distanceM: 8000, durationSeconds: 2700, elevationGainM: 50, rpe: 5, weightKg: 85, resting: restingWith(85) }),
    );
  });

  it('une estimation impossible (séance sans durée ni série) n’entre pas', async () => {
    setUp({ workouts: [{ ...workout, duration_seconds: null, total_sets: 0 }] });
    const { result } = await renderHook(() => useEnergyItemsByDay());
    expect(result.current.byDay.get(TODAY)).toBeUndefined();
  });

  it('les calories d’une montre priment, même pour un type hors catalogue', async () => {
    setUp({ activities: [{ ...activity, activityType: 'parapente', deviceKcal: 120 }] });
    const { result } = await renderHook(() => useEnergyItemsByDay());
    expect(result.current.byDay.get(TODAY)?.[0]?.estimate).toMatchObject({ kcal: 120, low: 120, source: 'device' });
  });

  it('useDayEnergy : total des estimations centrales, cible au bas des fourchettes', async () => {
    setUp({ weights: [{ logDate: '2026-10-05', weightKg: 79.5 }], workouts: [workout], runs: [run], activities: [activity] });
    const { result } = await renderHook(() => useDayEnergy(TODAY));
    const { items, totalKcal, targetKcal } = result.current;
    expect(items).toHaveLength(3);
    expect(totalKcal).toBe(items.reduce((s, i) => s + i.estimate.kcal, 0));
    expect(targetKcal).toBe(items.reduce((s, i) => s + i.estimate.low, 0));
    expect(targetKcal).toBeLessThan(totalKcal);
  });

  it('useDayEnergy : un jour sans rien vaut 0', async () => {
    setUp({ workouts: [workout] });
    const { result } = await renderHook(() => useDayEnergy('2026-10-07'));
    expect(result.current).toMatchObject({ items: [], totalKcal: 0, targetKcal: 0 });
  });
});
