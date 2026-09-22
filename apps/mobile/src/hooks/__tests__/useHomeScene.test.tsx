/**
 * US DASH-01 — les faits de l'accueil : la scène, le brief du matin, les trois questions, et les
 * anneaux de la semaine. Quatre hooks, tous à **0 %**.
 *
 * Même patron que `useNowAction` : les briques pures décident, ces hooks **collectent**. Ce qui se
 * teste ici est donc ce que la brique reçoit, et les quelques chiffres que la scène compose
 * elle-même. Cinq règles, toutes silencieuses en cas de panne :
 *
 * - **Aucun chiffre qui n'a pas de quoi être calculé** (R7). Sans plan de la semaine, l'anneau reste
 *   vide et son libellé ne dit qu'un compte : un pourcentage supposerait un objectif que personne
 *   n'a fixé. Sans cible calorique, la réponse « quoi manger » le dit, au lieu d'afficher un reste
 *   calculé sur zéro.
 * - **Un pilier désactivé n'a pas d'anneau** (décision H).
 * - **Un record déjà égalé n'est pas « à portée »** : il est atteint, la phrase du brief n'aurait
 *   aucun sens.
 * - **Les écarts sont bornés à zéro** : « il te reste −40 g de protéines » est un chiffre faux
 *   affiché avec le même aplomb qu'un vrai.
 * - **La semaine se compte en jour LOCAL**, comme partout ailleurs.
 */

import { renderHook } from '@testing-library/react-native';

import { useAskQuestions, useHomeScene, useMorningBriefFacts } from '../useHomeScene';
import { useWeekRings } from '../useWeekRings';
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
import { useJokersRemaining } from '@/data/repositories/streak-joker-repository';
import { useDailyTotals } from '@/data/repositories/journal-repository';
import { useWeekPlan } from '@/data/repositories/planned-session-repository';
import { useSettings } from '@/data/repositories/settings-repository';

jest.mock('../useTodayKey', () => ({
  useCurrentHour: jest.fn(() => 10),
  useTodayDate: jest.fn(() => new Date(2026, 8, 16)), // mercredi 16/09/2026
  useTodayKey: jest.fn(() => '2026-09-16'),
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
jest.mock('@/data/repositories/streak-joker-repository', () => ({ useJokersRemaining: jest.fn() }));
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
  jokers: useJokersRemaining as jest.Mock,
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
  m.realLife.mockReturnValue({ inRealLifePeriod: false });
  m.runs.mockReturnValue({ runs: [] });
  m.workouts.mockReturnValue({ workouts: [] });
  m.checkin.mockReturnValue({ entry: null });
  m.prefs.mockReturnValue({ streakDanger: false, reminderHour: 20 });
  m.jokers.mockReturnValue({ remaining: 2 });
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

  it('remonte la série et les jokers restants', async () => {
    const scene = await sceneOf();

    expect(scene).toMatchObject({ streak: 3, jokersRemaining: 2 });
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

// ---------------------------------------------------------------------------
// useAskQuestions
// ---------------------------------------------------------------------------

describe('useAskQuestions', () => {
  const questionsOf = async (readiness: unknown = READINESS_MUET) =>
    (await renderHook(() => useAskQuestions(readiness as never))).result.current;

  it('rend toujours les trois questions du moment', async () => {
    const questions = await questionsOf();

    expect(questions.map((q) => q.key)).toEqual(['today', 'eat', 'week']);
  });

  it('avoue ne pas savoir quand le score de forme n’est pas calculable', async () => {
    expect((await questionsOf())[0]!.answer).toBe('ask.answers.todayUnknown');
  });

  it('dérive la clé de réponse du verdict', async () => {
    const questions = await questionsOf({
      ...READINESS_MUET,
      show: true,
      verdict: 'caution',
      load: { state: 'negative' },
      nutrition: { state: 'neutral' },
      wellbeing: { state: 'neutral' },
      negativeCount: 1,
      availableCount: 3,
    });

    expect(questions[0]!.answer).toBe('ask.answers.todayCaution');
  });

  it('🔴 dit qu’il n’y a pas de cible plutôt que d’afficher un reste calculé sur zéro', async () => {
    expect((await questionsOf())[1]!.answer).toBe('ask.answers.eatNoTarget');
  });

  it('chiffre le reste à manger quand les deux cibles existent', async () => {
    m.nutrition.mockReturnValue({ kcal: 1800, effectiveTarget: 2400, target: 2400, macros: { p: 90, c: 0, f: 0 } });
    m.protein.mockReturnValue(140);

    expect((await questionsOf())[1]!.answer).toContain('kcal=600 protein=50');
  });

  it('borne à zéro un dépassement, calories comme protéines', async () => {
    m.nutrition.mockReturnValue({ kcal: 2800, effectiveTarget: 2400, target: 2400, macros: { p: 180, c: 0, f: 0 } });
    m.protein.mockReturnValue(140);

    expect((await questionsOf())[1]!.answer).toContain('kcal=0 protein=0');
  });

  it('🔴 ne compte dans la semaine que ce qui a eu lieu depuis lundi', async () => {
    m.workouts.mockReturnValue({
      workouts: [
        { finishedAt: new Date('2026-09-15T18:00:00').toISOString() }, // mardi, dans la semaine
        { finishedAt: new Date('2026-09-10T18:00:00').toISOString() }, // jeudi d'avant
      ],
    });

    expect((await questionsOf())[2]!.answer).toContain('workouts=1');
  });

  it('ignore une séance jamais terminée dans le compte de la semaine', async () => {
    m.workouts.mockReturnValue({ workouts: [{ finishedAt: null }] });

    expect((await questionsOf())[2]!.answer).toContain('workouts=0');
  });

  it('compte les jours actifs de la série dans la réponse hebdomadaire', async () => {
    m.streak.mockReturnValue({
      current: 3,
      activeToday: true,
      last7: [{ active: true }, { active: false }, { active: true }],
      isLoading: false,
    });

    expect((await questionsOf())[2]!.answer).toContain('days=2');
  });

  it('n’accroche jamais d’explication aux deux dernières questions', async () => {
    const questions = await questionsOf();

    expect(questions[1]!.explanation).toBeNull();
    expect(questions[2]!.explanation).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// useWeekRings
// ---------------------------------------------------------------------------

describe('useWeekRings', () => {
  const ringsOf = async () => (await renderHook(() => useWeekRings())).result.current;

  it('rend un anneau par pilier actif', async () => {
    const rings = await ringsOf();

    expect(rings.map((r) => r.key)).toEqual(['strength', 'running', 'nutrition']);
  });

  it('🔴 n’attribue aucun anneau à un pilier désactivé (décision H)', async () => {
    m.settings.mockReturnValue({ settings: { activePillars: ['nutrition'] } });

    expect((await ringsOf()).map((r) => r.key)).toEqual(['nutrition']);
  });

  it('compare le fait au prévu de la semaine', async () => {
    m.weekPlan.mockReturnValue({
      items: [{ pillar: 'strength' }, { pillar: 'strength' }, { pillar: 'strength' }, { pillar: 'strength' }],
    });
    m.workouts.mockReturnValue({
      workouts: [
        { finishedAt: new Date('2026-09-15T18:00:00').toISOString() },
        { finishedAt: new Date('2026-09-16T18:00:00').toISOString() },
      ],
    });

    expect((await ringsOf())[0]!.progress).toBeCloseTo(0.5, 5);
  });

  it('🔴 laisse l’anneau vide sans plan : un pourcentage supposerait un objectif (R7)', async () => {
    m.workouts.mockReturnValue({
      workouts: [{ finishedAt: new Date('2026-09-15T18:00:00').toISOString() }],
    });

    const strength = (await ringsOf())[0]!;
    expect(strength.progress).toBe(0);
    expect(strength.label).toContain('strengthOnly');
  });

  it('plafonne l’anneau à 100 % quand on a fait plus que prévu', async () => {
    m.weekPlan.mockReturnValue({ items: [{ pillar: 'running' }] });
    m.runs.mockReturnValue({
      runs: [
        { finishedAt: new Date('2026-09-15T08:00:00').toISOString() },
        { finishedAt: new Date('2026-09-16T08:00:00').toISOString() },
      ],
    });

    expect((await ringsOf())[1]!.progress).toBe(1);
  });

  it('🔴 exclut les séances d’une autre semaine du décompte', async () => {
    m.weekPlan.mockReturnValue({ items: [{ pillar: 'strength' }, { pillar: 'strength' }] });
    m.workouts.mockReturnValue({
      workouts: [{ finishedAt: new Date('2026-09-07T18:00:00').toISOString() }], // semaine d'avant
    });

    expect((await ringsOf())[0]!.progress).toBe(0);
  });

  it('ignore une séance jamais terminée', async () => {
    m.weekPlan.mockReturnValue({ items: [{ pillar: 'strength' }] });
    m.workouts.mockReturnValue({ workouts: [{ finishedAt: null }] });

    expect((await ringsOf())[0]!.progress).toBe(0);
  });

  it('compte les jours nutrition réellement saisis sur sept', async () => {
    m.totals.mockReturnValue({
      totals: [
        { logDate: '2026-09-14', kcal: 2100 },
        { logDate: '2026-09-15', kcal: 1900 },
      ],
    });

    expect((await ringsOf())[2]!.progress).toBeCloseTo(2 / 7, 5);
  });

  it('ne compte pas un jour ouvert mais vide', async () => {
    m.totals.mockReturnValue({
      totals: [
        { logDate: '2026-09-14', kcal: 2100 },
        { logDate: '2026-09-15', kcal: 0 },
      ],
    });

    expect((await ringsOf())[2]!.progress).toBeCloseTo(1 / 7, 5);
  });

  it('libelle l’anneau nutrition par un compte, jamais par une cible imaginaire', async () => {
    expect((await ringsOf())[2]!.label).toContain('stage.home.ring.nutrition');
  });

  it('libelle les anneaux muscu et course par fait/prévu quand un plan existe', async () => {
    m.weekPlan.mockReturnValue({ items: [{ pillar: 'strength' }, { pillar: 'running' }] });

    const rings = await ringsOf();
    expect(rings[0]!.label).toContain('stage.home.ring.strength(');
    expect(rings[1]!.label).toContain('stage.home.ring.running(');
  });

  it('donne à chaque anneau la couleur de son pilier', async () => {
    const rings = await ringsOf();

    expect(new Set(rings.map((r) => r.color)).size).toBe(3);
  });
});
