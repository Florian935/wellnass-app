/**
 * US CIBLE-04 — le socle du Labo « Et si… » et du Conseil des trois (spec §1, §5, §11).
 *
 * `useLabComposer` remontait la dépense de référence par « cible de base − delta de l'objectif » : faux
 * pendant une pause « vie réelle » (la cible est déjà au maintien : +400 kcal en sèche) et avec une
 * cible saisie à la main (« surcharge − delta », la dépense de personne). Il lit désormais le `socle` que
 * `composeDayCalorieTarget` rend à Aujourd'hui.
 *
 * Test d'**assemblage** : le vrai `useLabComposer`, le vrai `useDayCalorieTarget`, les vraies briques
 * pures ; seules les **sources** sont simulées (`day-target-sources.ts`). Simuler `useDayCalorieTarget`
 * ne prouverait que l'appel, pas le chiffre.
 *
 * Profil A : homme, 80 kg, 180 cm, 30 ans ; but « muscle », sèche, « modéré », forfait 300, pesée à
 * 80 kg. Socle `tdee` 2 759, hors sport « debout » 2 448. Les attendus sont **écrits en dur** et recopiés
 * dans la spec : ils ne se recalculent pas avec les fonctions qu'ils vérifient.
 */

import { renderHook } from '@testing-library/react-native';
import { LAB_OBJECTIVE_ORDER, buildCouncil, composeLab, type GoalConflict } from '@wellness/shared';

import { useDayCalorieTarget } from '../dashboard-repository';
import { useLabComposer } from '../lab-repository';
import { useWellbeingEntries } from '../daily-wellbeing-repository';
import { useRunnerProfile } from '../running-profile-repository';
import { useStrengthSection } from '../strength-repository';
import { FROZEN_CLOCK, TODAY, setSources, type Sources } from '@/test-utils/day-target-sources';
import { J } from '@/test-utils/cible01-dataset';

jest.mock('@/data/repositories/nutrition-repository', () => ({ useNutritionProfile: jest.fn() }));
jest.mock('@/data/repositories/profile-repository', () => ({ useProfile: jest.fn() }));
jest.mock('@/data/repositories/bodyweight-repository', () => ({ useLatestWeight: jest.fn(), useWeightEntries: jest.fn() }));
jest.mock('@/data/repositories/settings-repository', () => ({ useSettings: jest.fn() }));
jest.mock('@/data/repositories/workout-repository', () => ({
  useWorkoutHistory: jest.fn(),
  useActiveWorkout: jest.fn(() => ({ workout: null, isLoading: false })),
}));
jest.mock('@/data/repositories/run-repository', () => ({
  useRunHistory: jest.fn(),
  useRunStats: jest.fn(() => ({ stats: null, isLoading: false })),
}));
jest.mock('@/data/repositories/activity-repository', () => ({ useActivities: jest.fn(), useActivitiesOnDay: jest.fn() }));
jest.mock('@/data/repositories/planned-session-repository', () => ({
  useHasPlannedSession: jest.fn(),
  usePlannedDayKeys: jest.fn(),
  useWeekPlan: jest.fn(),
}));
jest.mock('@/data/repositories/real-life-repository', () => ({
  useRealLifePeriods: jest.fn(),
  useRealLifeState: jest.fn(() => ({ inRealLifePeriod: false, isLoading: false })),
  SELECT_WEEK_STRENGTH_SESSIONS: 'select-week-strength-sessions',
}));
jest.mock('@/data/repositories/energy-repository', () => ({ useDayEnergy: jest.fn(), useEnergyTargetByDay: jest.fn() }));
jest.mock('@/data/repositories/journal-repository', () => ({ useDailyTotals: jest.fn() }));
// Les sources propres au Labo : `setSources` ne les remplit pas, elles sont posées ci-dessous.
jest.mock('@/data/repositories/daily-wellbeing-repository', () => ({
  useWellbeingRows: jest.fn(),
  useWellbeingEntries: jest.fn(),
}));
jest.mock('@/data/repositories/running-profile-repository', () => ({ useRunnerProfile: jest.fn() }));
jest.mock('@/data/repositories/strength-repository', () => ({ useStrengthSection: jest.fn() }));

beforeEach(() => {
  jest.useFakeTimers(FROZEN_CLOCK);
  // Une semaine vide, sans profil coureur, sans nuit saisie, sans historique de force : les réglages
  // actuels du Composer sont 0 séance, 0 sortie, 1,8 g/kg (le bas de la sèche), sèche, nuits courtes.
  (useRunnerProfile as jest.Mock).mockReturnValue({ runnerProfile: null, isLoading: false });
  (useWellbeingEntries as jest.Mock).mockReturnValue({ entries: [], isLoading: false });
  (useStrengthSection as jest.Mock).mockReturnValue({ lifts: [], history: [], isLoading: false });
});
afterEach(() => jest.useRealTimers());

/** Pause « vie réelle » qui couvre aujourd'hui (J−1 → J+2). */
const PAUSE: Sources = { periods: [{ startedOn: J(-1), endsOn: J(2) }] };
const ACTIVITIES = { trainingBonusMode: 'activities' as const, sportFreeLevel: 'standing' as const };
const SANS_TAILLE = { heightCm: null as unknown as number };
/** But « muscle » + sèche : la contradiction de GUID-01 que le Conseil chiffre. */
const CONFLIT: GoalConflict = { rule: 'bulkVsCut', left: 'goal.muscle', right: 'nutrition.cut' };

/** Le jeu de la spec : profil A, pesée à 80 kg, trois piliers, aucune séance ni course. */
const sources = (extra: Sources): Sources => ({ latestWeightKg: 80, ...extra });

async function render(extra: Sources) {
  setSources(sources(extra));
  const { result } = await renderHook(() => ({ lab: useLabComposer(), today: useDayCalorieTarget(TODAY) }));
  return result.current;
}

describe('le socle du Labo est celui d’Aujourd’hui (R1, R3)', () => {
  // [cas, cible de base d'Aujourd'hui, socle attendu, ce que donnait l'inversion « cible − delta », sources]
  it.each([
    ['S0 — mode Forfait', 2359, 2759, 2759, {}],
    ['S1 — pause « vie réelle »', 2759, 2759, 3159, PAUSE],
    ['S2 — cible saisie à la main (2 000)', 2000, 2759, 2400, { nutrition: { manualCalories: 2000 } }],
    ['S3 — pause et cible saisie à la main', 2000, 2759, 2400, { ...PAUSE, nutrition: { manualCalories: 2000 } }],
    ['S4 — « Selon ce que tu fais »', 2048, 2448, 2448, { nutrition: ACTIVITIES }],
    ['S5 — « Selon ce que tu fais » et pause', 2448, 2448, 2848, { ...PAUSE, nutrition: ACTIVITIES }],
  ] as const)('%s : Aujourd’hui %i, socle %i (l’inversion donnait %i)', async (_cas, todayTarget, socle, _avant, extra) => {
    const { lab, today } = await render(extra);

    // La cible d'Aujourd'hui prouve que le cas est bien posé : sans elle, une pause mal câblée dans le
    // jeu rendrait S1 vert pour de mauvaises raisons.
    expect(today.target).toBe(todayTarget);
    expect(lab.context.tdeeKcal).toBe(socle);
    expect(lab.context.tdeeKcal).toBe(today.socle);
  });

  it.each([
    ['sans cible saisie', {}],
    ['avec une cible saisie à la main', { nutrition: { manualCalories: 2000 } }],
  ] as const)('profil incomplet, %s : pas de socle, pas de Conseil (R4)', async (_cas, extra) => {
    const { lab, today } = await render({ ...extra, profile: SANS_TAILLE });

    expect(today.socle).toBeNull();
    expect(lab.context.tdeeKcal).toBeNull();
    expect(buildCouncil(CONFLIT, lab.context)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Les chiffres affichés (spec §1) — les mêmes quels que soient la pause et la surcharge
// ---------------------------------------------------------------------------

/** Les quatre crans du levier objectif, dans l'ordre du Composer. */
const OBJECTIFS = ['cut', 'weightloss', 'maintain', 'bulk'] as const;

const FORFAIT = {
  kcal: [2359, 2509, 2759, 3059],
  voix: { kcal: 2359, tdee: 2759 },
  issues: { keepMainGoal: 3059, keepPillarGoal: 2359 },
};
const SELON_CE_QUE_TU_FAIS = {
  kcal: [2048, 2198, 2448, 2748],
  voix: { kcal: 2048, tdee: 2448 },
  issues: { keepMainGoal: 2748, keepPillarGoal: 2048 },
};

describe('Labo › Composer et Conseil des trois : les projections (spec §1, critères 3 et 4)', () => {
  it('le levier objectif suit l’ordre du Composer', () => {
    expect(LAB_OBJECTIVE_ORDER).toEqual(OBJECTIFS);
  });

  it.each([
    ['S0', {}, FORFAIT],
    ['S1', PAUSE, FORFAIT],
    ['S2', { nutrition: { manualCalories: 2000 } }, FORFAIT],
    ['S3', { ...PAUSE, nutrition: { manualCalories: 2000 } }, FORFAIT],
    ['S4', { nutrition: ACTIVITIES }, SELON_CE_QUE_TU_FAIS],
    ['S5', { ...PAUSE, nutrition: ACTIVITIES }, SELON_CE_QUE_TU_FAIS],
  ] as const)('%s', async (_cas, extra, attendu) => {
    const { lab } = await render(extra);
    const { context } = lab;

    // Le Composer : réglages actuels (sèche), puis chaque cran du levier objectif.
    const projections = OBJECTIFS.map((objective) => composeLab(context, { ...context.baseline, objective }));
    expect(projections.map((p) => p.kcalTarget)).toEqual(attendu.kcal);
    // Le poids et les protéines ne lisent pas le socle : inchangés par l'US.
    expect(projections.map((p) => p.weightChangeKg)).toEqual([-2.9, -1.8, 0, 2.2]);
    expect(projections.map((p) => p.proteinGPerDay)).toEqual([144, 144, 144, 144]);

    // Le Conseil : la voix Nutrition et les deux issues.
    const council = buildCouncil(CONFLIT, context);
    expect(council?.voices.find((v) => v.pillar === 'nutrition')?.values).toEqual(attendu.voix);
    expect(Object.fromEntries(council!.options.map((o) => [o.id, o.projection.kcalTarget]))).toEqual(attendu.issues);
    expect(council!.options.map((o) => [o.projection.weightChangeKg, o.projection.proteinGPerDay])).toEqual([
      [2.2, 144],
      [-2.9, 144],
    ]);
  });
});
