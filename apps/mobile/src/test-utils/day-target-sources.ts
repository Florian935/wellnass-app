/**
 * US NORYN-02 — les **sources** de la cible du jour et du verdict de forme, pour les tests
 * d'assemblage (`day-calorie-target-assembly`, `day-nutrition-targets-assembly`,
 * `readiness-assembly`).
 *
 * Ce module ne mocke rien lui-même : chaque fichier de test déclare ses `jest.mock` (ils doivent
 * être en tête de fichier pour être remontés), puis appelle `setSources` pour remplir les hooks de
 * lecture. Les briques pures ne sont **jamais** mockées : on veut l'assemblage réel bout en bout.
 *
 * US CIBLE-01 — `setSources` ne remplit **que les hooks que le fichier de test a mockés**
 * (`jest.isMockFunction`) : un scénario décrit une fois nourrit toutes les lectures, anciennes et
 * nouvelles (`useWeekPlan` du planning d'avant, `usePlannedDayKeys` de la lecture par plage), sans
 * obliger les filets de NORYN-02 à déclarer des mocks qu'ils n'utilisent pas.
 *
 * Les jours sont des clés **locales** et les instants sont fabriqués à une heure locale
 * (`atLocal`) : le test ne dépend pas du fuseau de la machine qui le lance.
 */

import { localDayKey } from '@wellness/shared';

import { useActivities, useActivitiesOnDay } from '@/data/repositories/activity-repository';
import * as plannedSessionRepository from '@/data/repositories/planned-session-repository';
import { useLatestWeight, useWeightEntries } from '@/data/repositories/bodyweight-repository';
import { useWellbeingRows } from '@/data/repositories/daily-wellbeing-repository';
import { useDayEnergy, useEnergyTargetByDay } from '@/data/repositories/energy-repository';
import { useDailyTotals } from '@/data/repositories/journal-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { useHasPlannedSession } from '@/data/repositories/planned-session-repository';
import { useProfile } from '@/data/repositories/profile-repository';
import { useRealLifePeriods } from '@/data/repositories/real-life-repository';
import { useRunHistory } from '@/data/repositories/run-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { useWorkoutHistory } from '@/data/repositories/workout-repository';

/** « Maintenant » : jeudi 08/10/2026, midi local. */
export const NOW = new Date(2026, 9, 8, 12, 0, 0);
export const TODAY = '2026-10-08';

/** Horloge figée, minuteurs réels (le rendu asynchrone de `renderHook` en a besoin). */
export const FROZEN_CLOCK = {
  now: NOW,
  doNotFake: [
    'nextTick',
    'setImmediate',
    'queueMicrotask',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
  ] as ('nextTick' | 'setImmediate' | 'queueMicrotask' | 'setTimeout' | 'clearTimeout' | 'setInterval' | 'clearInterval')[],
};

/**
 * Le profil A de DEPENSE-00 : homme, 80 kg, 180 cm, 30 ans au 08/10/2026. Métabolisme de base
 * 1 780 kcal, `tdee` « modéré » 2 759, socle hors sport « debout » 2 448.
 */
export const PROFILE_A = {
  sex: 'male' as const,
  weightKg: 80,
  heightCm: 180,
  birthDate: '1996-01-15',
  mainGoal: 'muscle' as const,
};

/** Profil nutritionnel de référence : sèche, « modéré », forfait de 300 kcal, mode `fixed`. */
export const NUTRITION_A = {
  objective: 'cut' as const,
  activityLevel: 'moderate' as const,
  manualCalories: null as number | null,
  manualProteinG: null as number | null,
  manualCarbsG: null as number | null,
  manualFatG: null as number | null,
  trainingDayBonus: 300,
  trainingBonusMode: 'fixed' as 'fixed' | 'auto' | 'activities',
  sportFreeLevel: null as 'seated' | 'standing' | 'physical' | null,
  adherenceMarginPct: 10,
  meals: null,
  waterTargetMl: null,
  glassSizeMl: null,
  restrictions: [],
  allergens: [],
};

/** Un instant UTC qui tombe à `hour` heure **locale** du jour donné. */
export const atLocal = (dayKey: string, hour: number, minute = 0): string => {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y!, m! - 1, d!, hour, minute, 0).toISOString();
};

/** La clé du jour décalée de `n` jours (calendrier local). */
export const shiftKey = (dayKey: string, n: number): string => {
  const [y, m, d] = dayKey.split('-').map(Number);
  return localDayKey(new Date(y!, m! - 1, d! + n));
};

export type SourceWorkout = { finishedAt: string | null; durationSeconds?: number | null; rpe?: number | null };
export type SourceRun = { finishedAt: string | null; distanceM?: number | null; durationSeconds?: number | null; rpe?: number | null };
export type SourceActivity = { startedAt: string; durationSeconds?: number; rpe?: number | null; activityType?: string };
/**
 * Une séance planifiée (CIBLE-01). Sans statut : `planned`. `plannedDays` reste accepté (filets de
 * NORYN-02) et vaut une séance `planned` par jour.
 */
export type SourcePlannedSession = { date: string; status?: 'planned' | 'done' | 'skipped' };
export type SourceWellbeing = {
  logDate: string;
  energy?: number | null;
  stress?: number | null;
  sleepMinutes?: number | null;
  sleepQuality?: number | null;
  sick?: boolean;
  deletedAt?: string | null;
};

export type Sources = {
  profile?: Partial<typeof PROFILE_A> | null;
  nutrition?: Partial<typeof NUTRITION_A> | null;
  latestWeightKg?: number | null;
  activePillars?: string[] | null;
  wellbeingPillarEnabled?: boolean;
  workouts?: SourceWorkout[];
  runs?: SourceRun[];
  activities?: SourceActivity[];
  plannedDays?: string[];
  /** Séances planifiées avec leur statut (CIBLE-01) ; s'ajoutent à `plannedDays`. */
  plannedSessions?: SourcePlannedSession[];
  periods?: { startedOn: string; endsOn: string }[];
  /** Dépense retenue (bas de fourchette) par jour, telle que `useDayEnergy` la rendrait. */
  energyByDay?: Record<string, number>;
  /** Totaux de kcal par jour ; `useDailyTotals(since)` les filtre comme son SQL (sans borne haute). */
  dailyKcal?: { logDate: string; kcal: number }[];
  /** Check-ins ; `useWellbeingRows(since)` les filtre comme son SQL. */
  wellbeing?: SourceWellbeing[];
};

/**
 * Le mock d'un hook, **s'il est mocké** par le fichier de test ; sinon un mock jetable, sans effet. Un
 * export absent (un hook que le module n'a pas encore, ou que le fichier n'a pas déclaré) est ignoré.
 */
const asMock = (fn: unknown): jest.Mock => (jest.isMockFunction(fn) ? fn : jest.fn());

/** Le mock d'un export lu par son nom — il peut ne pas exister encore dans le module réel. */
const exportOf = (module: unknown, name: string): unknown => (module as Record<string, unknown>)[name];

/** Une séance planifiée telle que `useWeekPlan` la rend (seuls la date et le statut comptent ici). */
const plannedItem = (s: SourcePlannedSession, i: number) => ({
  id: `ps${i}`,
  programId: 'prog-1',
  sessionId: `sess-${i}`,
  scheduledDate: s.date,
  scheduledTime: null,
  status: s.status ?? 'planned',
  weekIndex: 0,
  sessionName: null,
  sessionType: null,
  targetDistanceM: null,
  targetDurationSeconds: null,
  orderIndex: i,
  pillar: 'strength',
  exerciseCount: 0,
});

/** Remplit tous les hooks de lecture d'après `sources` (le reste reste vide). */
export function setSources(sources: Sources = {}): void {
  asMock(useProfile).mockReturnValue({
    profile: sources.profile === null ? null : { ...PROFILE_A, ...sources.profile },
    isLoading: false,
  });
  asMock(useNutritionProfile).mockReturnValue({
    nutritionProfile: sources.nutrition === null ? null : { ...NUTRITION_A, ...sources.nutrition },
    isLoading: false,
  });
  asMock(useLatestWeight).mockReturnValue({
    latest:
      sources.latestWeightKg == null
        ? null
        : { id: 'w-last', logDate: '2026-10-05', weightKg: sources.latestWeightKg },
    isLoading: false,
  });
  asMock(useWeightEntries).mockReturnValue({ entries: [], isLoading: false });
  asMock(useSettings).mockReturnValue({
    settings: {
      activePillars: sources.activePillars === undefined ? ['strength', 'running', 'nutrition'] : sources.activePillars,
      wellbeingPillarEnabled: sources.wellbeingPillarEnabled ?? false,
    },
    isLoading: false,
  });
  asMock(useWorkoutHistory).mockReturnValue({
    workouts: (sources.workouts ?? []).map((w, i) => ({
      id: `w${i}`,
      durationSeconds: null,
      rpe: null,
      ...w,
    })),
    isLoading: false,
  });
  asMock(useRunHistory).mockReturnValue({
    runs: (sources.runs ?? []).map((r, i) => ({
      id: `r${i}`,
      distanceM: null,
      durationSeconds: null,
      rpe: null,
      ...r,
    })),
    isLoading: false,
  });
  const activities = (sources.activities ?? []).map((a, i) => ({
    id: `a${i}`,
    activityType: 'bike',
    durationSeconds: 3600,
    intensity: 'moderate',
    rpe: null,
    distanceM: null,
    deviceKcal: null,
    notes: null,
    ...a,
  }));
  asMock(useActivities).mockReturnValue({ activities, isLoading: false });
  asMock(useActivitiesOnDay).mockImplementation((dayKey: string) => ({
    activities: activities.filter((a) => localDayKey(new Date(a.startedAt)) === dayKey),
    isLoading: false,
  }));
  // Une seule liste de séances planifiées pour toutes les lectures : `SELECT_HAS_PLANNED` et la lecture
  // par plage retiennent `planned`/`done` ; `useWeekPlan` (le planning d'avant CIBLE-01), tout statut.
  const sessions: SourcePlannedSession[] = [
    ...(sources.plannedDays ?? []).map((date) => ({ date, status: 'planned' as const })),
    ...(sources.plannedSessions ?? []),
  ];
  const anticipated = new Set(sessions.filter((s) => (s.status ?? 'planned') !== 'skipped').map((s) => s.date));
  asMock(useHasPlannedSession).mockImplementation((dayKey: string) => ({
    hasPlanned: anticipated.has(dayKey),
    isLoading: false,
  }));
  asMock(exportOf(plannedSessionRepository, 'usePlannedDayKeys')).mockImplementation((fromKey: string, toKey: string) => ({
    dayKeys: new Set([...anticipated].filter((d) => d >= fromKey && d <= toKey)),
    isLoading: false,
  }));
  asMock(exportOf(plannedSessionRepository, 'useWeekPlan')).mockImplementation((weekStart: string) => ({
    items: sessions
      .map(plannedItem)
      .filter((item) => item.scheduledDate >= weekStart && item.scheduledDate <= shiftKey(weekStart, 6)),
    isLoading: false,
  }));
  asMock(useRealLifePeriods).mockReturnValue({
    periods: (sources.periods ?? []).map((p, i) => ({ id: `rl${i}`, ...p })),
    isLoading: false,
  });
  asMock(useDayEnergy).mockImplementation((dayKey: string) => ({
    items: [],
    totalKcal: sources.energyByDay?.[dayKey] ?? 0,
    targetKcal: sources.energyByDay?.[dayKey] ?? 0,
    isLoading: false,
  }));
  asMock(useEnergyTargetByDay).mockReturnValue({
    byDay: new Map(Object.entries(sources.energyByDay ?? {})),
    isLoading: false,
  });
  asMock(useDailyTotals).mockImplementation((since: string) => ({
    totals: (sources.dailyKcal ?? [])
      .filter((d) => d.logDate >= since)
      .map((d) => ({ logDate: d.logDate, kcal: d.kcal, proteinG: 0, carbsG: 0, fatG: 0 })),
    isLoading: false,
  }));
  asMock(useWellbeingRows).mockImplementation((since?: string) => ({
    rows: (sources.wellbeing ?? [])
      .filter((r) => r.deletedAt == null && (since === undefined || r.logDate >= since))
      .map((r) => ({ deletedAt: null, ...r })),
    isLoading: false,
  }));
}
