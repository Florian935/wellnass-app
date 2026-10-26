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
 */

import type { DayNow } from './day-timeline';
import { parseClock } from './day-timeline';
import type { TodayTraining } from './now-action';

export type CrossTipTag = 'strength-nutrition' | 'running-nutrition' | 'nutrition';

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
}

/** En dessous, l'écart de protéines ne vaut pas une astuce (même seuil d'esprit que le brief). */
export const PROTEIN_TIP_MIN_G = 30;

/** L'astuce de la carte du moment, ou `null`. Seuls les repas en portent (dus ou à venir). */
export function crossTip(now: DayNow, facts: CrossTipFacts): CrossTip | null {
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

  // 3 · L'écart de protéines de la journée, arrondi à 5 g.
  if (facts.proteinGapG !== null && facts.proteinGapG >= PROTEIN_TIP_MIN_G) {
    return {
      key: 'home.tips.proteinGap',
      params: { grams: Math.round(facts.proteinGapG / 5) * 5 },
      tag: 'nutrition',
    };
  }

  return null;
}
