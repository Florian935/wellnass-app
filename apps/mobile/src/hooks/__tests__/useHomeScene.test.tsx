/**
 * US DASH-01 — les faits de l'accueil : la scène et le brief du matin.
 *
 * US ACCUEIL-08 — « Demande-moi » a quitté l'accueil (D3) et les anneaux ont cédé la place à « Ta
 * semaine » : `useAskQuestions` et `useWeekRings` ont été supprimés avec ce qu'ils nourrissaient. La
 * semaine se compte désormais dans `buildWeekStrip` (brique pure, `home-sections.test.ts`) et se
 * collecte dans `useHomeWeek` (`useHomeWeek.test.tsx`), qui reprend les règles de la semaine des
 * anneaux (jour local, séance jamais terminée, autre semaine, pilier désactivé).
 *
 * Même patron que `useNowAction` : les briques pures décident, ces hooks **collectent**. Ce qui se
 * teste ici est donc ce que la brique reçoit, et les quelques chiffres que la scène compose
 * elle-même. Trois règles, toutes silencieuses en cas de panne :
 *
 * - **Un record déjà égalé n'est pas « à portée »** : il est atteint, la phrase du brief n'aurait
 *   aucun sens.
 * - **Les écarts sont bornés à zéro** : « il te reste −40 g de protéines » est un chiffre faux
 *   affiché avec le même aplomb qu'un vrai.
 * - **Aucun chiffre qui n'a pas de quoi être calculé** (R7) : sans score calculable, pas de verdict ;
 *   sans journée de pas, pas de cadran Marcher.
 */

import { renderHook } from '@testing-library/react-native';

import { useHomeScene, useMorningBriefFacts } from '../useHomeScene';
import { useCurrentHour, useTodayDate, useTodayKey } from '../useTodayKey';
import {
  useDaysSinceLastActivity,
  useNutritionSummary,
  useProteinTarget,
  useReadiness,
  useStreakData,
} from '@/data/repositories/dashboard-repository';
import { useNearRecords } from '@/data/repositories/records-repository';
import { useRealLifeState } from '@/data/repositories/real-life-repository';
import { useRunHistory } from '@/data/repositories/run-repository';
import { useWorkoutHistory } from '@/data/repositories/workout-repository';
import { useTodayWellbeing } from '@/data/repositories/daily-wellbeing-repository';
import { useNotificationPrefs } from '@/data/repositories/notification-repository';
import { useJokerDays } from '@/data/repositories/streak-joker-repository';
import { useDailySteps, useStepGoal } from '@/data/repositories/daily-steps-repository';
import { useDailyTotals } from '@/data/repositories/journal-repository';
import { useWeekPlan } from '@/data/repositories/planned-session-repository';
import { useSettings } from '@/data/repositories/settings-repository';

jest.mock('../useTodayKey', () => ({
  useCurrentHour: jest.fn(() => 10),
  useTodayDate: jest.fn(() => new Date(2026, 8, 16)), // mercredi 16/09/2026
  useTodayKey: jest.fn(() => '2026-09-16'),
  useWindowStartKey: jest.fn(() => '2026-09-10'),
}));
jest.mock('@/data/repositories/dashboard-repository', () => ({
  useDaysSinceLastActivity: jest.fn(),
  useNutritionSummary: jest.fn(),
  useProteinTarget: jest.fn(),
  useReadiness: jest.fn(),
  useStreakData: jest.fn(),
}));
jest.mock('@/data/repositories/records-repository', () => ({ useNearRecords: jest.fn() }));
jest.mock('@/data/repositories/real-life-repository', () => ({ useRealLifeState: jest.fn() }));
jest.mock('@/data/repositories/run-repository', () => ({ useRunHistory: jest.fn() }));
jest.mock('@/data/repositories/workout-repository', () => ({ useWorkoutHistory: jest.fn() }));
jest.mock('@/data/repositories/daily-wellbeing-repository', () => ({ useTodayWellbeing: jest.fn() }));
jest.mock('@/data/repositories/notification-repository', () => ({ useNotificationPrefs: jest.fn() }));
jest.mock('@/data/repositories/streak-joker-repository', () => ({ useJokerDays: jest.fn() }));
jest.mock('@/data/repositories/daily-steps-repository', () => ({
  useDailySteps: jest.fn(),
  useStepGoal: jest.fn(),
}));
jest.mock('@/data/repositories/journal-repository', () => ({ useDailyTotals: jest.fn() }));
jest.mock('@/data/repositories/planned-session-repository', () => ({ useWeekPlan: jest.fn() }));
jest.mock('@/data/repositories/settings-repository', () => ({ useSettings: jest.fn() }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}(${Object.entries(vars).map(([k, v]) => `${k}=${String(v)}`).join(' ')})` : key,
  }),
}));

const m = {
  hour: useCurrentHour as jest.Mock,
  today: useTodayDate as jest.Mock,
  todayKey: useTodayKey as jest.Mock,
  daysSince: useDaysSinceLastActivity as jest.Mock,
  nutrition: useNutritionSummary as jest.Mock,
  protein: useProteinTarget as jest.Mock,
  readiness: useReadiness as jest.Mock,
  streak: useStreakData as jest.Mock,
  nearRecords: useNearRecords as jest.Mock,
  realLife: useRealLifeState as jest.Mock,
  runs: useRunHistory as jest.Mock,
  workouts: useWorkoutHistory as jest.Mock,
  checkin: useTodayWellbeing as jest.Mock,
  prefs: useNotificationPrefs as jest.Mock,
  jokers: useJokerDays as jest.Mock,
  steps: useDailySteps as jest.Mock,
  stepGoal: useStepGoal as jest.Mock,
  totals: useDailyTotals as jest.Mock,
  weekPlan: useWeekPlan as jest.Mock,
  settings: useSettings as jest.Mock,
};

/**
 * Score de forme « rien à dire », au **type réel** (`ReadinessResult`) et non à une forme
 * simplifiée : `explainReadiness` lit `load.state`, `nutrition.state` et `wellbeing.state` sans
 * garde. Un mock à trois champs fait planter le hook à trois pas de la cause — c'est la septième
 * famille de faux vert, rencontrée une fois de plus ici (§5 bis de strategie-tests.md).
 */
const READINESS_MUET = {
  show: false,
  verdict: null,
  load: { state: 'unavailable', reason: 'insufficient-history' },
  nutrition: { state: 'unavailable', reason: 'insufficient-history' },
  wellbeing: { state: 'unavailable', reason: 'insufficient-history' },
  negativeCount: 0,
  availableCount: 0,
} as const;

function setup() {
  m.hour.mockReturnValue(10);
  m.today.mockReturnValue(new Date(2026, 8, 16));
  m.todayKey.mockReturnValue('2026-09-16');
  m.daysSince.mockReturnValue({ days: 0 });
  m.nutrition.mockReturnValue({ kcal: 0, effectiveTarget: null, target: null, macros: { p: 0, c: 0, f: 0 } });
  m.protein.mockReturnValue(null);
  m.readiness.mockReturnValue(READINESS_MUET);
  m.streak.mockReturnValue({ current: 3, activeToday: false, last7: [], isLoading: false });
  m.nearRecords.mockReturnValue({ items: [] });
  m.realLife.mockReturnValue({ inRealLifePeriod: false, pausedDays: new Set<string>() });
  m.runs.mockReturnValue({ runs: [] });
  m.workouts.mockReturnValue({ workouts: [] });
  m.checkin.mockReturnValue({ entry: null });
  m.prefs.mockReturnValue({ streakDanger: false, reminderHour: 20 });
  m.jokers.mockReturnValue({ days: [] });
  m.steps.mockReturnValue({ rows: [{ id: 's', logDate: '2026-09-16', steps: 6100 }] });
  m.stepGoal.mockReturnValue({ goal: 8000 });
  m.totals.mockReturnValue({ totals: [] });
  m.weekPlan.mockReturnValue({ items: [] });
  m.settings.mockReturnValue({ settings: { activePillars: ['strength', 'running', 'nutrition'] } });
}

beforeEach(() => {
  jest.clearAllMocks();
  setup();
});

// ---------------------------------------------------------------------------
// useHomeScene
// ---------------------------------------------------------------------------

describe('useHomeScene', () => {
  const sceneOf = async () => (await renderHook(() => useHomeScene())).result.current;

  it('remonte la série', async () => {
    const scene = await sceneOf();

    expect(scene).toMatchObject({ streak: 3 });
  });

  it('🔴 ACCUEIL-07 — propose les vrais gestes pour sauver la série (marcher, activité, joker)', async () => {
    expect((await sceneOf()).rescue).toEqual([
      { kind: 'walk', stepsLeft: 1900, minutes: 20 },
      { kind: 'activity' },
      { kind: 'joker' },
    ]);
  });

  it('pas de marche proposée quand les pas ne sont pas suivis (aucune journée de pas)', async () => {
    m.steps.mockReturnValue({ rows: [] });
    expect((await sceneOf()).rescue.map((o) => o.kind)).toEqual(['activity', 'joker']);
  });

  it('🔴 un joker posé aujourd’hui couvre la journée : la série n’est plus « en jeu » le soir', async () => {
    m.hour.mockReturnValue(20);
    m.jokers.mockReturnValue({ days: ['2026-09-16'] });

    const scene = await sceneOf();
    expect(scene.coveredToday).toBe(true);
    expect(scene.moment).not.toBe('evening-at-risk');
  });

  it('🔴 un jour de période « vie réelle » non plus', async () => {
    m.hour.mockReturnValue(20);
    m.realLife.mockReturnValue({ inRealLifePeriod: true, pausedDays: new Set(['2026-09-16']) });

    expect((await sceneOf()).moment).not.toBe('evening-at-risk');
  });

  it('sans joker ni pause, la série est bien en jeu le soir', async () => {
    m.hour.mockReturnValue(20);
    expect((await sceneOf()).moment).toBe('evening-at-risk');
  });

  it('premier jour = aucun historique, mais pas pendant la lecture', async () => {
    m.daysSince.mockReturnValue({ days: null, isLoading: true });
    expect((await sceneOf()).firstDay).toBe(false);

    m.daysSince.mockReturnValue({ days: null, isLoading: false });
    expect((await sceneOf()).firstDay).toBe(true);
  });

  it('tait le verdict de forme tant qu’il n’y a pas de quoi le calculer (R7)', async () => {
    expect((await sceneOf()).verdict).toBeNull();
  });

  it('dit le verdict quand le score est calculable', async () => {
    m.readiness.mockReturnValue({ ...READINESS_MUET, show: true, verdict: 'caution' });

    expect((await sceneOf()).verdict).toBe('caution');
  });

  it('remonte le résultat complet, celui que « Pourquoi ? » détaille', async () => {
    expect((await sceneOf()).readiness).toBe(READINESS_MUET);
  });

  it('sait si le check-in du jour est fait', async () => {
    m.checkin.mockReturnValue({ entry: { logDate: '2026-09-16' } });

    expect((await sceneOf()).checkinDone).toBe(true);
  });

  it('compte les heures restantes avant minuit, à l’heure près', async () => {
    m.hour.mockReturnValue(21);

    expect((await sceneOf()).hoursLeft).toBe(3);
  });

  it('ne rend aucune heure restante à minuit passé', async () => {
    m.hour.mockReturnValue(0);

    expect((await sceneOf()).hoursLeft).toBe(24);
  });

  it('ne transmet l’heure de rappel que si l’alerte de série est activée', async () => {
    m.prefs.mockReturnValue({ streakDanger: false, reminderHour: 20 });

    expect((await sceneOf()).moment).toBeDefined();
  });

  it('relaie le chargement de la série', async () => {
    m.streak.mockReturnValue({ current: 0, activeToday: false, last7: [], isLoading: true });

    expect((await sceneOf()).isLoading).toBe(true);
  });

  it('rend toujours un moment, même sur un compte vide', async () => {
    expect((await sceneOf()).moment).toBeDefined();
  });

  it('US ACCUEIL-08 — les pas du jour, pour le cadran Marcher', async () => {
    expect((await sceneOf()).steps).toEqual({ tracked: true, today: 6100, goal: 8000 });
  });

  it('🔴 US ACCUEIL-08 — pas de journée de pas : le suivi n’est pas actif, aucun cadran à zéro', async () => {
    m.steps.mockReturnValue({ rows: [] });
    expect((await sceneOf()).steps).toMatchObject({ tracked: false, today: 0 });
  });

  it('US ACCUEIL-08 — la série hebdomadaire, pour la pastille de « Ta semaine » (SERIE-01)', async () => {
    m.streak.mockReturnValue({
      current: 9,
      activeToday: true,
      last7: [],
      isLoading: false,
      weekly: { unit: 'week', current: 4 },
    });
    expect((await sceneOf()).weeklyStreak).toEqual({ unit: 'week', current: 4 });
  });

  it('🔴 US ACCUEIL-08 — les offres de la série sont lues ICI, une fois, pour « Ta semaine »', async () => {
    const gap = { day: '2026-09-14', streakIfUsed: 6 };
    m.streak.mockReturnValue({
      current: 3,
      activeToday: false,
      last7: [],
      isLoading: false,
      restorableGap: gap,
      weekly: { unit: 'day', current: 1, offerSwitch: true },
    });
    expect((await sceneOf()).offers).toEqual({ restorableGap: gap, offerSwitch: true });
  });

  it('rien à proposer quand la série ne dit rien des offres', async () => {
    expect((await sceneOf()).offers).toEqual({ restorableGap: null, offerSwitch: false });
  });

  it('sans série hebdomadaire lue, l’unité reste le jour', async () => {
    expect((await sceneOf()).weeklyStreak).toEqual({ unit: 'day', current: 0 });
  });
});

// ---------------------------------------------------------------------------
// useMorningBriefFacts
// ---------------------------------------------------------------------------

describe('useMorningBriefFacts', () => {
  const factsOf = async (action: unknown, verdict: string | null = null) =>
    (await renderHook(() => useMorningBriefFacts(action as never, verdict as never))).result.current;

  const sessionToday = {
    kind: 'session-today',
    training: { name: 'Haut du corps', scheduledTime: '18:00' },
  };

  it('reprend la séance du jour quand il y en a une', async () => {
    const facts = await factsOf(sessionToday);

    expect(facts.todaySession).toEqual({ title: 'Haut du corps', time: '18:00' });
  });

  it('ne présente aucune séance quand la carte parle d’autre chose', async () => {
    expect((await factsOf({ kind: 'day-done' })).todaySession).toBeNull();
  });

  it('🔴 n’annonce pas comme « à portée » un record déjà égalé', async () => {
    m.nearRecords.mockReturnValue({
      items: [{ exerciseName: 'Squat', gapKind: 'beaten', gap: 0 }],
    });

    expect((await factsOf({ kind: 'day-done' })).nearRecord).toBeNull();
  });

  it('annonce un record réellement à portée', async () => {
    m.nearRecords.mockReturnValue({
      items: [{ exerciseName: 'Squat', gapKind: 'weight', gap: 2.5 }],
    });

    expect((await factsOf({ kind: 'day-done' })).nearRecord).toMatchObject({
      exerciseName: 'Squat',
      gap: 2.5,
    });
  });

  it('n’annonce rien sans record proche', async () => {
    expect((await factsOf({ kind: 'day-done' })).nearRecord).toBeNull();
  });

  it('calcule l’écart de protéines restant', async () => {
    m.protein.mockReturnValue(140);
    m.nutrition.mockReturnValue({ kcal: 0, effectiveTarget: null, target: null, macros: { p: 90, c: 0, f: 0 } });

    expect((await factsOf({ kind: 'day-done' })).proteinGapG).toBe(50);
  });

  it('🔴 borne l’écart à zéro : « il te reste −40 g » serait un chiffre faux', async () => {
    m.protein.mockReturnValue(140);
    m.nutrition.mockReturnValue({ kcal: 0, effectiveTarget: null, target: null, macros: { p: 180, c: 0, f: 0 } });

    expect((await factsOf({ kind: 'day-done' })).proteinGapG).toBe(0);
  });

  it('laisse l’écart à null sans cible de protéines (R7)', async () => {
    expect((await factsOf({ kind: 'day-done' })).proteinGapG).toBeNull();
  });

  it('signale une période de vraie vie en cours', async () => {
    m.realLife.mockReturnValue({ inRealLifePeriod: true });

    expect((await factsOf({ kind: 'day-done' })).realLifeActive).toBe(true);
  });
});
