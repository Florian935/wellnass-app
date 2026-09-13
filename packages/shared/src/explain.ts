/**
 * US DASH-01 — « Pourquoi ? » (spec §6.1) : d'où sort un chiffre.
 *
 * Chaque explication est une liste d'étapes **à clés i18n** et de valeurs brutes, plus un niveau de
 * confiance. Aucun texte ici : la langue et le formatage des nombres appartiennent à l'UI (décision G).
 * Aucune valeur recalculée non plus : les étapes reprennent ce que les moteurs existants ont produit,
 * c'est ce qui rend l'explication honnête — elle ne peut pas diverger du chiffre qu'elle explique.
 */

import { RIEGEL_EXPONENT, type RacePrediction } from './pace-records';
import type { ReadinessResult } from './readiness';
import type { WhatIfResult } from './what-if';

export type ExplainStep = {
  key: string;
  value?: number;
  params?: Record<string, number | string>;
};

export type Confidence = 'high' | 'medium' | 'low';

export type Explanation = { steps: ExplainStep[]; confidence: Confidence };

export function explainReadiness(r: ReadinessResult): Explanation | null {
  if (!r.show || r.verdict === null) return null;
  const steps: ExplainStep[] = [
    { key: `explain.readiness.load.${r.load.state}` },
    { key: `explain.readiness.nutrition.${r.nutrition.state}` },
    { key: `explain.readiness.wellbeing.${r.wellbeing.state}` },
    {
      key: `explain.readiness.verdict.${r.verdict}`,
      params: { negative: r.negativeCount, available: r.availableCount },
    },
  ];
  const confidence: Confidence = r.availableCount >= 3 ? 'high' : r.availableCount === 2 ? 'medium' : 'low';
  return { steps, confidence };
}

export function explainWhatIf(
  result: WhatIfResult,
  ctx: { baseSlopePerWeek: number; historyPoints: number },
): Explanation {
  const steps: ExplainStep[] = [
    { key: 'explain.whatIf.slope', value: ctx.baseSlopePerWeek },
    { key: 'explain.whatIf.sessions', value: result.factors.sessions },
    { key: 'explain.whatIf.recovery', value: result.factors.sleep * result.factors.protein },
    {
      key: result.overreach ? 'explain.whatIf.overreachOn' : 'explain.whatIf.overreachOff',
      value: result.factors.overreach,
    },
  ];
  const confidence: Confidence = ctx.historyPoints >= 12 ? 'high' : ctx.historyPoints >= 6 ? 'medium' : 'low';
  return { steps, confidence };
}

const DAY_MS = 86_400_000;

export function explainRacePrediction(prediction: RacePrediction, nowIso: string): Explanation {
  const ageDays = (Date.parse(nowIso) - Date.parse(prediction.sourceAchievedAt)) / DAY_MS;
  const confidence: Confidence = ageDays <= 30 ? 'high' : ageDays <= 90 ? 'medium' : 'low';
  return {
    steps: [
      { key: 'explain.race.source', value: prediction.sourceTimeSeconds },
      { key: 'explain.race.riegel', value: RIEGEL_EXPONENT },
      { key: 'explain.race.result', value: prediction.predictedSeconds, params: { distance: prediction.distanceKey } },
    ],
    confidence,
  };
}

export function explainCalorieTarget(input: {
  tdee: number;
  objectiveDeltaKcal: number;
  trainingDayBonusKcal: number;
  target: number;
  /** Âge, taille, poids et niveau d'activité renseignés : sinon la dépense est une estimation par défaut. */
  profileComplete: boolean;
}): Explanation {
  const steps: ExplainStep[] = [
    { key: 'explain.kcal.tdee', value: input.tdee },
    { key: 'explain.kcal.objective', value: input.objectiveDeltaKcal },
  ];
  if (input.trainingDayBonusKcal !== 0) steps.push({ key: 'explain.kcal.trainingDay', value: input.trainingDayBonusKcal });
  steps.push({ key: 'explain.kcal.target', value: input.target });
  return { steps, confidence: input.profileComplete ? 'high' : 'low' };
}
