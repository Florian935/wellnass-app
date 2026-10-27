/**
 * US ACCUEIL-08 — **les astuces croisées** de la carte du moment.
 *
 * Constat 13 du 24/10/2026 : les piliers ne se parlaient pas sur l'accueil. Le bonus de kcal d'un
 * jour de séance, les glucides avant l'effort, l'écart de protéines existaient tous… mais pas au
 * moment où ils servent. Une astuce, une seule, posée dans la carte de l'action du moment, et
 * seulement quand elle croise deux faits réels de la journée. Calculée, jamais d'IA.
 *
 * L'ordre est la priorité : la séance qui arrive d'abord (elle change ce qu'on mange maintenant),
 * puis la séance faite (elle a ouvert des kcal), puis l'écart de protéines.
 *
 * ── US ACCUEIL-09 — enrichies ────────────────────────────────────────────────────────────────────
 *  - **La carte de la séance** en porte aussi une : la forme du jour (TRI-03) d'abord — un jour de
 *    « repos conseillé » ne pousse pas un record —, puis le record à portée (« Squat : à 2,5 kg de
 *    ton record »), puis « tous les signaux au vert ».
 *  - **Les protéines se disent par repas** quand il en reste plusieurs : « Vise ~25 g à ce repas »
 *    plutôt qu'un écart de 72 g qui ne dit pas quoi faire maintenant.
 */

import type { DayNow } from './day-timeline';
import { parseClock } from './day-timeline';
import type { TodayTraining } from './now-action';
import type { ReadinessVerdict } from './readiness';

export type CrossTipTag =
  | 'strength-nutrition'
  | 'running-nutrition'
  | 'nutrition'
  | 'readiness-strength'
  | 'readiness-running'
  | 'strength-record';

export interface CrossTip {
  key: string;
  params: Record<string, string | number>;
  tag: CrossTipTag;
}

export interface CrossTipFacts {
  /** Séances encore à faire aujourd'hui. */
  pendingTrainings: readonly TodayTraining[];
  /** Le pilier de la séance ou de la sortie terminée aujourd'hui, `null` sinon. */
  trainedPillar: 'strength' | 'running' | null;
  /** Kcal ajoutées à la cible par l'entraînement du jour (0 si aucune). */
  trainingBonusKcal: number;
  /** Protéines qui manquent sur la journée, `null` sans cible. */
  proteinGapG: number | null;
  /** US ACCUEIL-09 — repas encore à noter aujourd'hui, celui du moment compris (ni notés ni manqués). */
  mealsLeft?: number;
  /** US ACCUEIL-09 — le verdict de forme du jour (TRI-03), `null` s'il n'a pas de quoi se dire. */
  readinessVerdict?: ReadinessVerdict | null;
  /** US ACCUEIL-09 — le record à portée de la séance du jour (`sessionNearRecord`). */
  nearRecord?: { exerciseName: string; gapKind: 'kg' | 'reps' | 'beaten'; gap: number } | null;
}

/** En dessous, la part d'un repas ne vaut pas une astuce : « vise 5 g » ne change rien. */
export const PROTEIN_PER_MEAL_MIN_G = 10;

/** L'astuce de la carte d'une séance (ACCUEIL-09) : forme du jour, puis record à portée. */
function sessionTip(training: TodayTraining, facts: CrossTipFacts): CrossTip | null {
  const verdict = facts.readinessVerdict ?? null;
  if (training.pillar === 'running') {
    return verdict === 'rest' ? { key: 'home.tips.runRest', params: {}, tag: 'readiness-running' } : null;
  }
  if (verdict === 'rest') return { key: 'home.tips.sessionRest', params: {}, tag: 'readiness-strength' };
  const near = facts.nearRecord ?? null;
  // Un record déjà battu n'est plus « à portée » : il n'y a rien à tenter.
  if (near && near.gapKind !== 'beaten') {
    return near.gapKind === 'kg'
      ? { key: 'home.tips.nearRecordKg', params: { exercise: near.exerciseName, gap: near.gap }, tag: 'strength-record' }
      : { key: 'home.tips.nearRecordReps', params: { exercise: near.exerciseName, count: near.gap }, tag: 'strength-record' };
  }
  if (verdict === 'push') return { key: 'home.tips.sessionPush', params: {}, tag: 'readiness-strength' };
  return null;
}

/** En dessous, l'écart de protéines ne vaut pas une astuce (même seuil d'esprit que le brief). */
export const PROTEIN_TIP_MIN_G = 30;

/** L'astuce de la carte du moment, ou `null`. Repas (dus ou à venir) et séance du jour en portent. */
export function crossTip(now: DayNow, facts: CrossTipFacts): CrossTip | null {
  if (now.kind === 'session-today') return sessionTip(now.training, facts);
  if (now.kind !== 'meal-due' && now.kind !== 'meal-next') return null;
  const mealHour = now.meal.hour;

  // 1 · Une séance plus tard dans la journée : ce repas est son carburant.
  const later = facts.pendingTrainings.find((t) => {
    const at = parseClock(t.scheduledTime);
    return at === null || at > mealHour;
  });
  if (later) {
    const name = later.name.trim();
    return later.pillar === 'strength'
      ? { key: name ? 'home.tips.beforeStrengthNamed' : 'home.tips.beforeStrength', params: name ? { name } : {}, tag: 'strength-nutrition' }
      : { key: name ? 'home.tips.beforeRunNamed' : 'home.tips.beforeRun', params: name ? { name } : {}, tag: 'running-nutrition' };
  }

  // 2 · Une séance faite : elle a ouvert des kcal.
  if (facts.trainedPillar !== null && facts.trainingBonusKcal > 0) {
    return {
      key: 'home.tips.afterTraining',
      params: { kcal: Math.round(facts.trainingBonusKcal) },
      tag: facts.trainedPillar === 'strength' ? 'strength-nutrition' : 'running-nutrition',
    };
  }

  // 3 · L'écart de protéines de la journée, arrondi à 5 g — réparti sur les repas qui restent.
  if (facts.proteinGapG !== null && facts.proteinGapG >= PROTEIN_TIP_MIN_G) {
    const left = facts.mealsLeft ?? 1;
    if (left >= 2) {
      const grams = Math.round(facts.proteinGapG / left / 5) * 5;
      return grams >= PROTEIN_PER_MEAL_MIN_G
        ? { key: 'home.tips.proteinPerMeal', params: { grams }, tag: 'nutrition' }
        : null;
    }
    return {
      key: 'home.tips.proteinGap',
      params: { grams: Math.round(facts.proteinGapG / 5) * 5 },
      tag: 'nutrition',
    };
  }

  return null;
}
