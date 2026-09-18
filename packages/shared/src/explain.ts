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

/**
 * US DEPENSE-02 — d'où sort une **dépense estimée**.
 *
 * Quatre étapes, dans l'ordre où on les raconterait à voix haute : le corps au repos, l'intensité,
 * le temps actif, et ce que ça donne. Puis deux phrases qui désamorcent les deux malentendus
 * garantis — « ma montre dit plus » (elle compte le repos, déjà dans la cible) et « et mon
 * niveau ? » (il n'entre pas, et c'est voulu).
 *
 * 🔴 La `confidence` **vient de l'estimation**, elle n'est pas recalculée : l'explication ne peut
 * pas être plus sûre que le chiffre qu'elle explique.
 */
export function explainEnergy(input: {
  /** kcal/h au repos (Mifflin ÷ 24), ou 1 kcal/kg/h en repli. */
  restingKcalPerHour: number;
  /** `false` quand l'âge ou la taille manquent : le repli est dit à l'écran. */
  personalised: boolean;
  /** MET retenu ; `null` pour un chiffre venu d'une montre. */
  met: number | null;
  activeMinutes: number;
  kcal: number;
  low: number;
  high: number;
  confidence: Confidence;
}): Explanation {
  const steps: ExplainStep[] = [
    {
      key: input.personalised ? 'explain.energy.resting' : 'explain.energy.restingFallback',
      value: Math.round(input.restingKcalPerHour),
    },
  ];
  if (input.met != null) {
    steps.push({ key: 'explain.energy.met', value: input.met });
    steps.push({ key: 'explain.energy.minutes', value: Math.round(input.activeMinutes) });
    steps.push({
      key: 'explain.energy.result',
      value: input.kcal,
      params: { low: input.low, high: input.high },
    });
    // Le repos pendant l'effort est dans la cible, pas dans la dépense : sans cette phrase, l'écart
    // avec la montre passe pour une erreur de l'app.
    steps.push({
      key: 'explain.energy.watch',
      params: { kcal: Math.round((input.restingKcalPerHour * input.activeMinutes) / 60) },
    });
    steps.push({ key: 'explain.energy.level' });
  } else {
    steps.push({ key: 'explain.energy.device', value: input.kcal });
  }
  steps.push({ key: 'explain.energy.target', value: input.low });

  return { steps, confidence: input.confidence };
}

/**
 * US RESERV-01 (R8) — d'où sort la jauge de glucides.
 *
 * Cinq étapes, dans l'ordre où la journée se déroule : la capacité, le départ, ce qui a rempli, ce
 * qui a vidé, et le niveau du moment. La confiance **vient des données**, pas du calcul : un poids
 * ancien ou un journal vide rendent l'estimation fragile, et l'explication doit le dire — elle ne
 * peut pas être plus sûre que le chiffre qu'elle explique.
 */
export function explainGlycogen(input: {
  capacityG: number;
  startG: number;
  mealsCarbsG: number;
  mealsCount: number;
  sessionsCostG: number;
  sessionsCount: number;
  restDrainG: number;
  nowG: number;
  weightAgeDays: number | null;
}): Explanation {
  const steps: ExplainStep[] = [
    { key: 'explain.glycogen.capacity', value: input.capacityG },
    { key: 'explain.glycogen.start', value: Math.round(input.startG) },
  ];

  steps.push(
    input.mealsCount > 0
      ? {
          key: 'explain.glycogen.meals',
          value: Math.round(input.mealsCarbsG),
          params: { count: input.mealsCount },
        }
      : { key: 'explain.glycogen.noMeal' },
  );

  if (input.sessionsCount > 0) {
    steps.push({
      key: 'explain.glycogen.sessions',
      value: Math.round(input.sessionsCostG),
      params: { count: input.sessionsCount },
    });
  }

  steps.push({ key: 'explain.glycogen.rest', value: Math.round(input.restDrainG) });
  steps.push({ key: 'explain.glycogen.now', value: Math.round(input.nowG) });
  // La phrase qui désamorce le malentendu garanti : ce n'est pas une mesure.
  steps.push({ key: 'explain.glycogen.estimate' });

  const weightStale = input.weightAgeDays === null || input.weightAgeDays > 30;
  const confidence: Confidence =
    weightStale || input.mealsCount < 2 ? 'low' : input.sessionsCount === 0 ? 'medium' : 'high';

  return { steps, confidence };
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
