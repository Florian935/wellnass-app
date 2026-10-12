/**
 * US TRI-03 — Score de forme / readiness global (catalogue d'analyses). Composition pure de 3
 * briques déjà posées ailleurs (`computeAcwr` META-19/RUN-18, `averageIntake`/`DEFICIT_ALERT_RATIO`
 * MN-02, `wellbeingAverages` BIEN-01) : ce fichier ne recalcule rien, il classe et combine.
 *
 * R4 (verdict) : un seul signal négatif suffit pour « rest », un seul signal positif suffit pour
 * « push » (symétrique) — jamais une moyenne qui lisserait un vrai signal. La nutrition (R2) ne
 * produit jamais l'état `positive` (pas de symétrie sur le surplus) : une règle « toutes positives »
 * aurait rendu `push` inatteignable dès que la nutrition est active — corrigé pendant le TDD.
 */

import { averageIntake, DEFICIT_ALERT_RATIO, MIN_LOGGED_DAYS } from './bodyweight';
import { localDateFromDayKey, localDayKey, localMidnightDaysAgo } from './date';
import type { DayKeyOf } from './day-energy';
import { resolveActivePillars, type Pillar } from './pillar';
import {
  activityLoadSessions,
  ACWR_ACUTE_WINDOW_DAYS,
  ACWR_CHRONIC_WINDOW_DAYS,
  computeAcwr,
  type AcwrResult,
  type LoadSession,
} from './training-time';
import { isPoorNight, wellbeingAverages, type LocalWellbeing, type WellbeingAverage } from './wellbeing';

export type ReadinessComponentState = 'positive' | 'neutral' | 'negative' | 'unavailable';

export type ReadinessVerdict = 'rest' | 'ok' | 'push';

export type ReadinessUnavailableReason =
  | 'insufficient-history'
  | 'insufficient-logged-days'
  | 'no-recent-checkin';

export interface ReadinessComponent {
  state: ReadinessComponentState;
  reason?: ReadinessUnavailableReason;
}

export interface ReadinessResult {
  show: boolean;
  verdict: ReadinessVerdict | null;
  load: ReadinessComponent;
  nutrition: ReadinessComponent;
  wellbeing: ReadinessComponent;
  /**
   * Comptes ajoutés par **US INSIGHTS-02** (décision D3-B). Le score de forme était le **seul** des
   * 21 widgets d'accueil à ne porter aucun nombre : il ne pouvait donc pas devenir une carte
   * d'insight, où une affirmation sans chiffre est un défaut bloquant. « 2 des 3 signaux sont au
   * rouge » en est un — et il se **dérive** des trois composantes déjà classées, sans rien
   * recalculer, ce qui respecte la règle « aucune analyse nouvelle ».
   */
  negativeCount: number;
  /** Composantes réellement évaluables (ni `unavailable`) — le dénominateur du « X sur Y ». */
  availableCount: number;
}

const WELLBEING_LOW_ENERGY = 2;
const WELLBEING_HIGH_ENERGY = 4;
const WELLBEING_LOW_STRESS = 2;
const WELLBEING_HIGH_STRESS = 4;

/** R1 — indisponible si l'ACWR n'a pas assez d'historique chronique, sinon mappe la zone. */
export function classifyLoadComponent(acwr: AcwrResult | null): ReadinessComponent {
  if (acwr == null) return { state: 'unavailable', reason: 'insufficient-history' };
  if (acwr.zone === 'low') return { state: 'positive' };
  if (acwr.zone === 'risk') return { state: 'negative' };
  return { state: 'neutral' };
}

/** R2 — indisponible sous MIN_LOGGED_DAYS ou sans cible ; jamais `positive` (pas de symétrie surplus). */
export function classifyNutritionComponent(input: {
  loggedDaysCount: number;
  avgKcal: number;
  targetKcal: number;
}): ReadinessComponent {
  if (input.loggedDaysCount < MIN_LOGGED_DAYS) {
    return { state: 'unavailable', reason: 'insufficient-logged-days' };
  }
  if (input.targetKcal <= 0) return { state: 'unavailable' };

  const deficitRatio = (input.targetKcal - input.avgKcal) / input.targetKcal;
  return deficitRatio >= DEFICIT_ALERT_RATIO ? { state: 'negative' } : { state: 'neutral' };
}

/**
 * R3/D5 — énergie + stress seulement (pas l'humeur), stress lu à l'envers (BIEN-01).
 *
 * US BIEN-04 — **deux signaux de plus, seulement quand le pilier Bien-être est activé** : la nuit de
 * ce matin (courte ou agitée, `isPoorNight`) et l'étiquette « malade ». L'appelant ne les passe que
 * pilier activé ; absents, la règle est **exactement** celle de TRI-03 (non-régression testée). Un
 * seul signal défavorable rend la composante négative, comme le reste de TRI-03 (R4).
 */
export function classifyWellbeingComponent(averages: {
  energy: WellbeingAverage;
  stress: WellbeingAverage;
  /** US BIEN-04 — nuit de ce matin courte ou agitée ; `null`/absent = inconnue ou pilier éteint. */
  poorNight?: boolean | null;
  /** US BIEN-04 — étiquette « malade » du jour. */
  sick?: boolean;
}): ReadinessComponent {
  const { energy, stress } = averages;
  const poorNight = averages.poorNight ?? null;
  const sick = averages.sick === true;
  if (energy.average == null && stress.average == null && poorNight === null && !sick) {
    return { state: 'unavailable', reason: 'no-recent-checkin' };
  }

  const lowEnergy = energy.average != null && energy.average <= WELLBEING_LOW_ENERGY;
  const highStress = stress.average != null && stress.average >= WELLBEING_HIGH_STRESS;
  if (lowEnergy || highStress || poorNight === true || sick) return { state: 'negative' };

  const highEnergy = energy.average != null && energy.average >= WELLBEING_HIGH_ENERGY;
  const lowStress = stress.average != null && stress.average <= WELLBEING_LOW_STRESS;
  if (highEnergy && lowStress) return { state: 'positive' };

  return { state: 'neutral' };
}

/** R4/R5 — combine les composantes déjà classées ; ne recalcule rien. */
export function computeReadiness(input: {
  load: ReadinessComponent;
  nutrition: ReadinessComponent;
  wellbeing: ReadinessComponent;
}): ReadinessResult {
  const components = [input.load, input.nutrition, input.wellbeing];
  const negativeCount = components.filter((c) => c.state === 'negative').length;
  const availableCount = components.filter((c) => c.state !== 'unavailable').length;
  const base = {
    load: input.load,
    nutrition: input.nutrition,
    wellbeing: input.wellbeing,
    negativeCount,
    availableCount,
  };

  if (components.every((c) => c.state === 'unavailable')) {
    return { show: false, verdict: null, ...base };
  }

  const verdict: ReadinessVerdict = components.some((c) => c.state === 'negative')
    ? 'rest'
    : components.some((c) => c.state === 'positive')
      ? 'push'
      : 'ok';

  return { show: true, verdict, ...base };
}

// ---------------------------------------------------------------------------
// US NORYN-02 — la composition du verdict, sortie de `useReadiness`
// ---------------------------------------------------------------------------

/** Fenêtre nutrition (TRI-03 R2) — fixe, 7 j calendaires, indépendante des fenêtres ACWR. */
export const READINESS_NUTRITION_WINDOW_DAYS = 7;

/** Fenêtre bien-être (TRI-03 R3/D5) — 3 jours du calendrier, énergie + stress seulement. */
export const READINESS_WELLBEING_WINDOW_DAYS = 3;

/**
 * Borne basse d'une fenêtre de `days` jours **incluant** `todayKey` (`days = 7` → J−6) — le même calcul
 * que `useWindowStartKey` du mobile, en clés de jour.
 */
export function windowStartKey(todayKey: string, days: number): string {
  return localDayKey(localMidnightDaysAgo(days - 1, localDateFromDayKey(todayKey)));
}

/**
 * Le verdict de forme d'**aujourd'hui** (`useReadiness`, TRI-03 + BIEN-04), composé une seule fois
 * pour l'app et pour la fonction `noryn-context`. Sortie **sans changement de calcul**.
 *
 * - **Charge** : ACWR sur les séances des piliers actifs (muscu, course) et les autres activités,
 *   jamais gardées par un pilier ; fenêtres J−6 et J−27 sur le jour de la **fin**, sans borne haute.
 * - **Nutrition** : jours notés depuis J−6 (sans borne haute) contre la cible **de base** d'aujourd'hui
 *   (jamais l'effective) ; pilier Nutrition éteint → aucun jour.
 * - **Bien-être** : énergie et stress des 3 jours du calendrier ; pilier Bien-être allumé, la nuit de ce
 *   matin et « malade ».
 *
 * `dayKeyOf` rattache un instant à son jour (voir `day-energy.ts`).
 */
export function composeReadiness(input: {
  todayKey: string;
  activePillars: readonly Pillar[] | null | undefined;
  wellbeingPillarEnabled: boolean;
  workouts: ReadonlyArray<LoadSession>;
  /** Courses **terminées** (`status = 'completed'`). */
  completedRuns: ReadonlyArray<LoadSession>;
  activities: ReadonlyArray<{ rpe: number | null; durationSeconds: number; startedAt: string }>;
  /** Totaux de kcal par jour noté (`SELECT_DAILY_TOTALS`, arrondis jour par jour). */
  dailyKcal: ReadonlyArray<{ logDate: string; kcal: number }>;
  /** Cible **de base** d'aujourd'hui (`composeDayCalorieTarget(...).target`). */
  baseTargetKcal: number | null;
  wellbeingRows: ReadonlyArray<LocalWellbeing>;
  dayKeyOf: DayKeyOf;
}): ReadinessResult {
  const { todayKey, dayKeyOf } = input;
  const activePillars = resolveActivePillars(input.activePillars);
  const strengthActive = activePillars.includes('strength');
  const runningActive = activePillars.includes('running');
  const nutritionActive = activePillars.includes('nutrition');

  const acuteStartKey = windowStartKey(todayKey, ACWR_ACUTE_WINDOW_DAYS);
  const chronicStartKey = windowStartKey(todayKey, ACWR_CHRONIC_WINDOW_DAYS);

  // R1 — charge : séances des seuls piliers actifs ; les autres activités ne sont jamais gardées.
  const sessions: LoadSession[] = [
    ...(strengthActive
      ? input.workouts.map((w) => ({ rpe: w.rpe, durationSeconds: w.durationSeconds, finishedAt: w.finishedAt }))
      : []),
    ...(runningActive
      ? input.completedRuns.map((r) => ({ rpe: r.rpe, durationSeconds: r.durationSeconds, finishedAt: r.finishedAt }))
      : []),
    ...activityLoadSessions(input.activities),
  ];
  const byWindow = (startKey: string) =>
    sessions.filter((s) => s.finishedAt != null && dayKeyOf(s.finishedAt) >= startKey);
  const load = classifyLoadComponent(
    computeAcwr({ acuteSessions: byWindow(acuteStartKey), chronicSessions: byWindow(chronicStartKey) }),
  );

  // R2 — nutrition : pilier inactif traité comme aucun jour noté (même dégradation naturelle).
  const nutritionStartKey = windowStartKey(todayKey, READINESS_NUTRITION_WINDOW_DAYS);
  const totals = input.dailyKcal
    .filter((d) => d.logDate >= nutritionStartKey)
    .map((d) => ({ kcal: d.kcal, proteinG: 0, carbsG: 0, fatG: 0 }));
  const nutrition = classifyNutritionComponent({
    loggedDaysCount: nutritionActive ? totals.length : 0,
    avgKcal: averageIntake(totals).kcal,
    targetKcal: input.baseTargetKcal ?? 0,
  });

  // R3/D5 — bien-être : transverse. BIEN-04 — pilier allumé : la nuit de ce matin et « malade ».
  const wellbeingAvg = wellbeingAverages(input.wellbeingRows, READINESS_WELLBEING_WINDOW_DAYS, todayKey);
  const pillarOn = input.wellbeingPillarEnabled;
  const todayRow = pillarOn
    ? (input.wellbeingRows.find((r) => r.logDate === todayKey && r.deletedAt == null) ?? null)
    : null;
  const wellbeing = classifyWellbeingComponent({
    energy: wellbeingAvg.energy,
    stress: wellbeingAvg.stress,
    ...(pillarOn ? { poorNight: isPoorNight(todayRow), sick: todayRow?.sick === true } : {}),
  });

  return computeReadiness({ load, nutrition, wellbeing });
}
