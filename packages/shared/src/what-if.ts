/**
 * US DASH-01 — « Et si… » (spec §6.3) : manipuler son futur, avec un moteur déterministe.
 *
 * Point de départ : la pente de `projectSbd` (MUSCPWR-01), régression sur l'historique réel. Les
 * leviers la multiplient par des facteurs **fixes et lisibles** — c'est ce qui permet à la feuille
 * « Pourquoi ? » de montrer chaque étape du calcul (R5). Aucun de ces coefficients ne prétend à la
 * précision d'une étude : ce sont des ordres de grandeur prudents, et l'**éventail** est là pour le
 * dire à l'écran plutôt qu'en petits caractères.
 *
 * ── Les règles ────────────────────────────────────────────────────────────────────────────────────
 *  - Séances : rendement décroissant (+22 %, puis +30 %, puis +34 % au plus).
 *  - Sommeil long : ×1,12 · protéines hautes : ×1,06 — **pondérables** par l'utilisateur (R12).
 *  - Surcharge : +2 séances ou plus avec un sommeil court → ×0,82. **Garde-fou, non pondérable.**
 */

import { ACWR_RISK_THRESHOLD } from './training-time';

export type WhatIfLevers = {
  sessionsPerWeek: number;
  /** Rythme actuel, référence des facteurs. */
  baselineSessions: number;
  sleep: 'short' | 'long';
  protein: 'base' | 'high';
};

export type WhatIfInput = {
  lastTotalKg: number;
  /** Pente hebdomadaire issue de `projectSbd` (kg/semaine). */
  slopePerWeek: number;
  weeks: number;
  levers: WhatIfLevers;
  /** Poids des règles contestables, entre 0 et 1 (1 par défaut). */
  ruleWeights?: { sleep?: number; protein?: number };
};

export type WhatIfResult = {
  projectedKg: number;
  lowKg: number;
  highKg: number;
  slopePerWeek: number;
  factors: { sessions: number; sleep: number; protein: number; overreach: number };
  overreach: boolean;
};

const EXTRA_SESSION_GAIN = [0.22, 0.3, 0.34] as const;
const FEWER_SESSION_LOSS = 0.25;
const MIN_SESSIONS_FACTOR = 0.4;
const SLEEP_LONG_FACTOR = 1.12;
const PROTEIN_HIGH_FACTOR = 1.06;
export const OVERREACH_FACTOR = 0.82;

function clampWeight(w: number | undefined): number {
  if (w === undefined || !Number.isFinite(w)) return 1;
  return Math.max(0, Math.min(1, w));
}

function sessionsFactor(sessions: number, baseline: number): number {
  const extra = sessions - baseline;
  if (extra === 0) return 1;
  if (extra < 0) return Math.max(MIN_SESSIONS_FACTOR, 1 + FEWER_SESSION_LOSS * extra);
  return 1 + EXTRA_SESSION_GAIN[Math.min(extra, EXTRA_SESSION_GAIN.length) - 1]!;
}

export function projectWhatIf(input: WhatIfInput): WhatIfResult {
  const { levers, weeks, slopePerWeek, lastTotalKg } = input;
  const extra = levers.sessionsPerWeek - levers.baselineSessions;

  const sessions = sessionsFactor(levers.sessionsPerWeek, levers.baselineSessions);
  const sleep =
    levers.sleep === 'long' ? 1 + (SLEEP_LONG_FACTOR - 1) * clampWeight(input.ruleWeights?.sleep) : 1;
  const protein =
    levers.protein === 'high' ? 1 + (PROTEIN_HIGH_FACTOR - 1) * clampWeight(input.ruleWeights?.protein) : 1;
  const overreach = extra >= 2 && levers.sleep === 'short';
  const overreachFactor = overreach ? OVERREACH_FACTOR : 1;

  const slope = slopePerWeek * sessions * sleep * protein * overreachFactor;
  const projectedKg = lastTotalKg + slope * weeks;

  // L'éventail : proportionnel à l'horizon et au gain, élargi quand la récupération est incertaine.
  const spread = Math.max(3, Math.abs(slopePerWeek) * weeks * 0.35) + (levers.sleep === 'short' ? 3 : 0) + (overreach ? 4 : 0);

  return {
    projectedKg,
    lowKg: projectedKg - spread,
    highKg: projectedKg + spread,
    slopePerWeek: slope,
    factors: { sessions, sleep, protein, overreach: overreachFactor },
    overreach,
  };
}

export type WhatIfConsequences = {
  /** Ratio de charge estimé (ACWR), `null` sans historique de charge. */
  loadRatio: number | null;
  loadZone: 'safe' | 'watch' | 'risk' | null;
  kcalTarget: number;
};

/** Chaque séance hebdomadaire de plus ajoute environ 0,11 au ratio aigu/chronique. */
const LOAD_PER_EXTRA_SESSION = 0.11;
/** Au-delà de 1,2, on entre en vigilance ; au-delà du seuil ACWR, en risque. */
const LOAD_WATCH_THRESHOLD = 1.2;
const KCAL_PER_EXTRA_SESSION = 60;
const PROTEIN_HIGH_EXTRA_G_PER_KG = 0.4;

export function whatIfConsequences(input: {
  sessionsPerWeek: number;
  baselineSessions: number;
  loadRatio: number | null;
  baseKcalTarget: number;
  protein: 'base' | 'high';
  weightKg: number | null;
}): WhatIfConsequences {
  const extra = input.sessionsPerWeek - input.baselineSessions;

  let loadRatio: number | null = null;
  let loadZone: WhatIfConsequences['loadZone'] = null;
  if (input.loadRatio !== null) {
    loadRatio = Math.round((input.loadRatio + LOAD_PER_EXTRA_SESSION * extra) * 100) / 100;
    loadZone = loadRatio > ACWR_RISK_THRESHOLD ? 'risk' : loadRatio > LOAD_WATCH_THRESHOLD ? 'watch' : 'safe';
  }

  const proteinKcal =
    input.protein === 'high' && input.weightKg !== null
      ? Math.round(PROTEIN_HIGH_EXTRA_G_PER_KG * input.weightKg * 4)
      : 0;
  const kcalTarget = input.baseKcalTarget + Math.max(0, extra) * KCAL_PER_EXTRA_SESSION + proteinKcal;

  return { loadRatio, loadZone, kcalTarget };
}
