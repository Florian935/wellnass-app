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

import { DEFICIT_ALERT_RATIO, MIN_LOGGED_DAYS } from './bodyweight';
import type { AcwrResult } from './training-time';
import type { WellbeingAverage } from './wellbeing';

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

/** R3/D5 — énergie + stress seulement (pas l'humeur), stress lu à l'envers (BIEN-01). */
export function classifyWellbeingComponent(averages: {
  energy: WellbeingAverage;
  stress: WellbeingAverage;
}): ReadinessComponent {
  const { energy, stress } = averages;
  if (energy.average == null && stress.average == null) {
    return { state: 'unavailable', reason: 'no-recent-checkin' };
  }

  const lowEnergy = energy.average != null && energy.average <= WELLBEING_LOW_ENERGY;
  const highStress = stress.average != null && stress.average >= WELLBEING_HIGH_STRESS;
  if (lowEnergy || highStress) return { state: 'negative' };

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
