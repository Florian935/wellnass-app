/**
 * `useGoalAdherenceForRange` — l'**assemblage** de la cible calorique effective, jour par jour.
 *
 * Ce hook n'a jamais eu de test direct : seules ses briques pures (`computeEffectiveTargetForDay`,
 * `computeGoalAdherence`, `computeCaloricBalance`) sont couvertes dans `@wellness/shared`. Or ce
 * n'est pas là que le risque vit — les briques sont triviales et testées. Le risque est dans
 * **l'ordre et le périmètre** : quels jours entrent dans la fenêtre, quelle cible de base s'applique
 * à chacun, quels jours comptent comme jours de séance, et quand la dépense d'une course s'ajoute.
 *
 * Il est écrit **avant** la factorisation de l'assemblage partagé avec `useTrainingNutritionCross`
 * (dette BACKLOG du 08/08/2026), et c'est tout son intérêt : ces tests décrivent le comportement
 * **actuel** de deux chemins livrés (NUTR-10 adhérence, NUTR-18 bilan calorique, BILAN-01 bilan
 * hebdo). Ils doivent rester verts **à l'identique** après extraction — c'est le seul filet qui
 * distingue « j'ai factorisé » de « j'ai changé les chiffres de trois écrans ».
 *
 * Les briques pures ne sont **pas** mockées : on veut l'assemblage réel bout en bout. Seules les
 * sources de données (les hooks de repository) le sont.
 *
 * ⚠️ `renderHook()` de @testing-library/react-native v14 est **async** — toujours l'awaiter, sinon
 * `result` est `undefined` et l'échec ne dit pas pourquoi.
 */

import { renderHook } from '@testing-library/react-native';
import { tdee, targetCalories, estimateRunCalories } from '@wellness/shared';

import { useGoalAdherenceForRange } from '../dashboard-repository';
import { useNutritionProfile } from '../nutrition-repository';
import { useProfile } from '../profile-repository';
import { useLatestWeight } from '../bodyweight-repository';
import { useDailyTotals } from '../journal-repository';
import { useRealLifePeriods } from '../real-life-repository';
import { useWorkoutHistory } from '../workout-repository';
import { useRunHistory } from '../run-repository';
import { useSettings } from '../settings-repository';

jest.mock('../nutrition-repository', () => ({
  useNutritionProfile: jest.fn(),
}));
jest.mock('../profile-repository', () => ({
  useProfile: jest.fn(),
}));
jest.mock('../bodyweight-repository', () => ({
  useLatestWeight: jest.fn(),
}));
jest.mock('../journal-repository', () => ({
  useDailyTotals: jest.fn(),
}));
jest.mock('../real-life-repository', () => ({
  useRealLifePeriods: jest.fn(),
  useRealLifeState: jest.fn(() => ({ isActive: false, isLoading: false })),
  SELECT_WEEK_STRENGTH_SESSIONS: 'select-week-strength-sessions',
}));
jest.mock('../workout-repository', () => ({
  useWorkoutHistory: jest.fn(),
  useActiveWorkout: jest.fn(() => ({ workout: null, isLoading: false })),
}));
jest.mock('../run-repository', () => ({
  useRunHistory: jest.fn(),
  useRunStats: jest.fn(() => ({ stats: null, isLoading: false })),
}));
jest.mock('../settings-repository', () => ({
  useSettings: jest.fn(),
}));

const mockNutritionProfile = useNutritionProfile as jest.Mock;
const mockProfile = useProfile as jest.Mock;
const mockLatestWeight = useLatestWeight as jest.Mock;
const mockDailyTotals = useDailyTotals as jest.Mock;
const mockRealLifePeriods = useRealLifePeriods as jest.Mock;
const mockWorkoutHistory = useWorkoutHistory as jest.Mock;
const mockRunHistory = useRunHistory as jest.Mock;
const mockSettings = useSettings as jest.Mock;

// ---------------------------------------------------------------------------
// Semis
// ---------------------------------------------------------------------------

const J1 = '2026-07-20';
const J2 = '2026-07-21';
const J3 = '2026-07-22';

/**
 * Profil complet et déterministe. Les valeurs importent peu **sauf** qu'elles doivent produire un
 * TDEE non nul : sans TDEE, `hasTarget` tombe à faux et tous les jours sortent du dénominateur.
 */
const BIRTH_YEAR = 1996;
const PROFILE = {
  sex: 'male' as const,
  weightKg: 80,
  heightCm: 180,
  birthDate: `${BIRTH_YEAR}-01-15`,
  mainGoal: 'muscle' as const,
};

/**
 * TDEE réellement calculé par le hook pour `PROFILE` — sert à poser des kcal signifiantes.
 * L'âge est dérivé de la date du jour, comme le fait `computeAge` côté hook (anniversaire au 15/01,
 * donc déjà passé quelle que soit la date d'exécution après janvier).
 */
const AGE = new Date().getFullYear() - BIRTH_YEAR;
const TDEE = tdee({
  sex: PROFILE.sex,
  weightKg: PROFILE.weightKg,
  heightCm: PROFILE.heightCm,
  age: AGE,
  activityLevel: 'moderate',
}) as number;

/**
 * Cible de base fixée à une valeur ronde via `manualCalories`, qui prime sur le calcul TDEE.
 * Rend les assertions lisibles partout où l'objectif du jour n'est **pas** le sujet du test.
 */
const MANUAL_TARGET = 2000;

type NutritionOverrides = {
  objective?: string;
  trainingBonusMode?: 'fixed' | 'auto';
  trainingDayBonus?: number;
  adherenceMarginPct?: number | null;
  manualCalories?: number | null;
};

function setUp(options?: {
  totals?: { logDate: string; kcal: number }[];
  nutrition?: NutritionOverrides;
  workouts?: { finishedAt: string | null }[];
  runs?: { finishedAt: string | null; distanceM: number; durationSeconds: number }[];
  periods?: { startedOn: string; endsOn: string }[];
  activePillars?: string[] | null;
  loading?: Partial<
    Record<'nutrition' | 'profile' | 'weight' | 'totals' | 'workouts' | 'runs', boolean>
  >;
  profile?: typeof PROFILE | null;
}) {
  const loading = options?.loading ?? {};
  mockNutritionProfile.mockReturnValue({
    nutritionProfile: {
      objective: 'maintain',
      activityLevel: 'moderate',
      trainingBonusMode: 'fixed',
      trainingDayBonus: 0,
      adherenceMarginPct: 10,
      manualCalories: MANUAL_TARGET,
      meals: null,
      ...options?.nutrition,
    },
    isLoading: loading.nutrition ?? false,
  });
  mockProfile.mockReturnValue({
    profile: options?.profile === undefined ? PROFILE : options.profile,
    isLoading: loading.profile ?? false,
  });
  mockLatestWeight.mockReturnValue({
    latest: { id: 'w1', logDate: J1, weightKg: 80 },
    isLoading: loading.weight ?? false,
  });
  mockDailyTotals.mockReturnValue({
    totals: (options?.totals ?? []).map((t) => ({
      logDate: t.logDate,
      kcal: t.kcal,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    })),
    isLoading: loading.totals ?? false,
  });
  mockRealLifePeriods.mockReturnValue({ periods: options?.periods ?? [], isLoading: false });
  mockWorkoutHistory.mockReturnValue({
    workouts: options?.workouts ?? [],
    isLoading: loading.workouts ?? false,
  });
  mockRunHistory.mockReturnValue({ runs: options?.runs ?? [], isLoading: loading.runs ?? false });
  mockSettings.mockReturnValue({
    settings: { activePillars: options?.activePillars ?? ['strength', 'running', 'nutrition'] },
    isLoading: false,
  });
}

/**
 * Horodatage UTC correspondant à **midi local** du jour donné.
 *
 * Le hook rattache une séance à un jour via `localDayKey(new Date(finishedAt))`. Écrire
 * `'2026-07-20T23:50:00Z'` en dur ferait passer le test dans un fuseau et échouer dans un autre —
 * exactement le genre de test qui devient intermittent en CI. On construit donc la date en **heure
 * locale**, puis on la sérialise.
 */
const atLocalNoon = (dayKey: string): string => {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12, 0, 0).toISOString();
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Fenêtre : la borne haute est le cœur de l'extraction BILAN-01
// ---------------------------------------------------------------------------

describe('fenêtre [fromKey, toKey]', () => {
  it('exclut les jours postérieurs à toKey (bornes incluses)', async () => {
    setUp({
      totals: [
        { logDate: J1, kcal: MANUAL_TARGET },
        { logDate: J2, kcal: MANUAL_TARGET },
        { logDate: J3, kcal: MANUAL_TARGET },
      ],
    });

    const { result } = await renderHook(() => useGoalAdherenceForRange(J1, J2));

    // J3 est hors bornes : sans ce filtre, un bilan titré « semaine close » compterait un jour
    // de la semaine en cours.
    expect(result.current.loggedDays).toBe(2);
  });

  it('prend tous les jours fournis quand toKey vaut null', async () => {
    setUp({
      totals: [
        { logDate: J1, kcal: MANUAL_TARGET },
        { logDate: J2, kcal: MANUAL_TARGET },
        { logDate: J3, kcal: MANUAL_TARGET },
      ],
    });

    const { result } = await renderHook(() => useGoalAdherenceForRange(J1, null));

    expect(result.current.loggedDays).toBe(3);
  });

  it('inclut le jour exactement égal à toKey', async () => {
    setUp({ totals: [{ logDate: J2, kcal: MANUAL_TARGET }] });

    const { result } = await renderHook(() => useGoalAdherenceForRange(J1, J2));

    expect(result.current.loggedDays).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// US VIE-01 — la cible de base est une fonction DU JOUR, pas de la fenêtre
// ---------------------------------------------------------------------------

describe('cible de base par jour (US VIE-01)', () => {
  it('neutralise le déficit des seuls jours en période « vie réelle »', async () => {
    const cutTarget = targetCalories(TDEE, 'cut');
    const maintainTarget = targetCalories(TDEE, 'maintain');
    // Prérequis du test : les deux cibles doivent différer, sinon il ne prouve rien.
    expect(cutTarget).toBeLessThan(maintainTarget);

    setUp({
      nutrition: { objective: 'cut', manualCalories: null },
      // Chaque jour est logué exactement à la cible « maintien ».
      totals: [
        { logDate: J1, kcal: maintainTarget },
        { logDate: J2, kcal: maintainTarget },
        { logDate: J3, kcal: maintainTarget },
      ],
      periods: [{ startedOn: J2, endsOn: J2 }],
    });

    const { result } = await renderHook(() => useGoalAdherenceForRange(J1, null));

    // Seul J2 retombe sur « maintain » et tombe donc pile dans sa cible. J1 et J3 restent en
    // déficit et sont au-dessus. Une cible unique calculée pour toute la fenêtre — la régression
    // que cette règle a corrigée — donnerait 0 ou 3, jamais 1.
    expect(result.current.daysInTarget).toBe(1);
    expect(result.current.daysAbove).toBe(2);
    expect(result.current.daysBelow).toBe(0);
  });

  it('applique l’objectif réel quand aucune période ne couvre le jour', async () => {
    const cutTarget = targetCalories(TDEE, 'cut');

    setUp({
      nutrition: { objective: 'cut', manualCalories: null },
      totals: [{ logDate: J1, kcal: cutTarget }],
      periods: [{ startedOn: J3, endsOn: J3 }],
    });

    const { result } = await renderHook(() => useGoalAdherenceForRange(J1, null));

    expect(result.current.daysInTarget).toBe(1);
    expect(result.current.balanceKcal).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Jours de séance — quels jours reçoivent le bonus
// ---------------------------------------------------------------------------

describe('jours de séance', () => {
  it('ajoute le forfait aux seuls jours portant une séance terminée', async () => {
    setUp({
      nutrition: { trainingBonusMode: 'fixed', trainingDayBonus: 300 },
      totals: [
        { logDate: J1, kcal: MANUAL_TARGET + 300 },
        { logDate: J2, kcal: MANUAL_TARGET + 300 },
      ],
      workouts: [{ finishedAt: atLocalNoon(J1) }],
    });

    const { result } = await renderHook(() => useGoalAdherenceForRange(J1, null));

    // J1 : cible 2300, mangé 2300 → dans la cible. J2 : cible 2000, mangé 2300 → +300, au-delà
    // des 10 % de marge (200).
    expect(result.current.daysInTarget).toBe(1);
    expect(result.current.daysAbove).toBe(1);
    expect(result.current.balanceKcal).toBe(300);
  });

  it('ignore une séance non terminée', async () => {
    setUp({
      nutrition: { trainingBonusMode: 'fixed', trainingDayBonus: 300 },
      totals: [{ logDate: J1, kcal: MANUAL_TARGET }],
      workouts: [{ finishedAt: null }],
    });

    const { result } = await renderHook(() => useGoalAdherenceForRange(J1, null));

    // Une séance en cours ne doit pas relever la cible du jour : le bonus se mérite à la clôture.
    expect(result.current.daysInTarget).toBe(1);
    expect(result.current.balanceKcal).toBe(0);
  });

  it('compte une course terminée comme jour de séance', async () => {
    setUp({
      nutrition: { trainingBonusMode: 'fixed', trainingDayBonus: 300 },
      totals: [{ logDate: J1, kcal: MANUAL_TARGET + 300 }],
      runs: [{ finishedAt: atLocalNoon(J1), distanceM: 5000, durationSeconds: 1800 }],
    });

    const { result } = await renderHook(() => useGoalAdherenceForRange(J1, null));

    expect(result.current.balanceKcal).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Dépense de course — mode auto et pilier running
// ---------------------------------------------------------------------------

describe('dépense de course (mode auto)', () => {
  it('ajoute la dépense de la course du jour quand le pilier running est actif', async () => {
    const run = { finishedAt: atLocalNoon(J1), distanceM: 10000, durationSeconds: 3000 };
    const runKcal = estimateRunCalories({
      distanceM: run.distanceM,
      durationSeconds: run.durationSeconds,
      weightKg: 80,
    });
    expect(runKcal).toBeGreaterThan(0);

    setUp({
      nutrition: { trainingBonusMode: 'auto', trainingDayBonus: 0 },
      totals: [{ logDate: J1, kcal: MANUAL_TARGET + runKcal }],
      runs: [run],
    });

    const { result } = await renderHook(() => useGoalAdherenceForRange(J1, null));

    expect(result.current.balanceKcal).toBe(0);
  });

  it('n’ajoute aucune dépense de course quand le pilier running est désactivé', async () => {
    const run = { finishedAt: atLocalNoon(J1), distanceM: 10000, durationSeconds: 3000 };

    setUp({
      nutrition: { trainingBonusMode: 'auto', trainingDayBonus: 0 },
      totals: [{ logDate: J1, kcal: MANUAL_TARGET }],
      runs: [run],
      activePillars: ['strength', 'nutrition'],
    });

    const { result } = await renderHook(() => useGoalAdherenceForRange(J1, null));

    // La cible reste la cible de base : sans le pilier running, la course ne finance rien.
    expect(result.current.balanceKcal).toBe(0);
    expect(result.current.daysInTarget).toBe(1);
  });

  it('cumule deux courses du même jour', async () => {
    const first = { finishedAt: atLocalNoon(J1), distanceM: 5000, durationSeconds: 1500 };
    const second = { finishedAt: atLocalNoon(J1), distanceM: 5000, durationSeconds: 1500 };
    const oneRun = estimateRunCalories({
      distanceM: first.distanceM,
      durationSeconds: first.durationSeconds,
      weightKg: 80,
    });

    setUp({
      nutrition: { trainingBonusMode: 'auto', trainingDayBonus: 0 },
      totals: [{ logDate: J1, kcal: MANUAL_TARGET + oneRun * 2 }],
      runs: [first, second],
    });

    const { result } = await renderHook(() => useGoalAdherenceForRange(J1, null));

    expect(result.current.balanceKcal).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Marge, absence d'objectif, chargement
// ---------------------------------------------------------------------------

describe('marge et cas limites', () => {
  it('applique la marge de l’utilisateur, pas une constante', async () => {
    setUp({
      nutrition: { adherenceMarginPct: 2 },
      // +100 kcal sur 2000 = 5 % : dans la marge par défaut (10 %), hors marge à 2 %.
      totals: [{ logDate: J1, kcal: MANUAL_TARGET + 100 }],
    });

    const { result } = await renderHook(() => useGoalAdherenceForRange(J1, null));

    expect(result.current.marginPct).toBe(2);
    expect(result.current.daysInTarget).toBe(0);
  });

  it('retombe sur 10 % quand la marge n’est pas renseignée', async () => {
    setUp({
      nutrition: { adherenceMarginPct: null },
      totals: [{ logDate: J1, kcal: MANUAL_TARGET + 100 }],
    });

    const { result } = await renderHook(() => useGoalAdherenceForRange(J1, null));

    expect(result.current.marginPct).toBe(10);
    expect(result.current.daysInTarget).toBe(1);
  });

  it('signale l’absence d’objectif et exclut tous les jours du dénominateur', async () => {
    setUp({
      profile: null,
      nutrition: { manualCalories: null },
      totals: [{ logDate: J1, kcal: 2000 }],
    });

    const { result } = await renderHook(() => useGoalAdherenceForRange(J1, null));

    // Sans TDEE calculable, aucun jour n'est jugeable : mieux vaut 0 jour qu'un pourcentage faux.
    expect(result.current.hasTarget).toBe(false);
    expect(result.current.loggedDays).toBe(0);
    expect(result.current.pct).toBe(0);
    expect(result.current.balanceKcal).toBe(0);
  });

  it('reste en chargement tant qu’une seule source charge encore', async () => {
    setUp({ totals: [{ logDate: J1, kcal: MANUAL_TARGET }], loading: { runs: true } });

    const { result } = await renderHook(() => useGoalAdherenceForRange(J1, null));

    // Six sources alimentent ce calcul. Publier un pourcentage avant qu'elles soient toutes
    // résolues, c'est afficher une adhérence bâtie sur un historique de séances encore vide.
    expect(result.current.isLoading).toBe(true);
  });

  it('renvoie un état neutre sans aucun jour logué', async () => {
    setUp({ totals: [] });

    const { result } = await renderHook(() => useGoalAdherenceForRange(J1, null));

    expect(result.current.loggedDays).toBe(0);
    expect(result.current.pct).toBe(0);
    expect(result.current.balanceKcal).toBe(0);
    expect(result.current.daysAbove).toBe(0);
    expect(result.current.daysBelow).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Bilan calorique signé (US NUTR-18)
// ---------------------------------------------------------------------------

describe('bilan calorique signé (US NUTR-18)', () => {
  it('somme les écarts signés et compte les jours de part et d’autre', async () => {
    setUp({
      totals: [
        { logDate: J1, kcal: MANUAL_TARGET + 500 },
        { logDate: J2, kcal: MANUAL_TARGET - 200 },
        { logDate: J3, kcal: MANUAL_TARGET },
      ],
    });

    const { result } = await renderHook(() => useGoalAdherenceForRange(J1, null));

    expect(result.current.balanceKcal).toBe(300);
    expect(result.current.daysAbove).toBe(1);
    expect(result.current.daysBelow).toBe(1);
    // Les deux décomptes ne mesurent pas la même chose, et c'est le point : `daysBelow` est
    // **binaire** (strictement sous la cible), `daysInTarget` applique la marge de ±10 %. J2 est
    // donc à la fois « en dessous » (−200) et « dans la cible » (−200 ≤ 200). Seul J1 (+500) sort
    // de la marge.
    expect(result.current.daysInTarget).toBe(2);
  });
});
