import type { Goal } from './profile';
import type { NutritionObjective } from './nutrition';
import type { RunnerObjective } from './running-paces';

/**
 * US GUID-01 volet E — les objectifs qui se contredisent.
 *
 * ── Le point aveugle que ça referme ──────────────────────────────────────────────────────────────
 * Le dépôt porte **quatre** notions d'objectif sans aucun pont entre elles : `profiles.main_goal`,
 * `nutrition_profiles.objective`, `runner_profiles.objective`, et les objectifs personnels d'OBJ-01.
 * On peut donc déclarer « Prise de masse » au global, « Sèche » en nutrition et « Perte de poids »
 * en course — les trois écrans l'acceptent **sans un mot**, chacun sur son onglet.
 *
 * C'est exactement ce que le différenciateur produit prétend faire (décision H : « les piliers se
 * parlent »), et c'est ici le plus petit morceau démontrable de cette promesse.
 *
 * ── Ce qu'on ne fait PAS ─────────────────────────────────────────────────────────────────────────
 * On **détecte** la contradiction ; on ne la résout pas automatiquement. L'objectif hybride unifié à
 * arbitrage de priorités (IDEAS, 25/07/2026) est une brique de positionnement, pas une US : elle
 * suppose de savoir dire « ces trois objectifs ne tiennent pas ensemble sur douze semaines, lequel
 * recule ? », ce qui demande un moteur de compromis qui n'existe pas.
 *
 * ── Pourquoi aucun texte ici ─────────────────────────────────────────────────────────────────────
 * Ce module rend des **identifiants stables**, jamais de phrases : l'i18n est obligatoire en FR + EN
 * (décision G), et le ton de ces cartes est le point dur de l'US. Le texte vit dans les locales.
 */

/** Les règles livrées. L'identifiant est **stable** : c'est lui qu'on stocke quand on rejette. */
export const GOAL_CONFLICT_RULES = ['bulkVsCut', 'enduranceVsMass'] as const;
export type GoalConflictRule = (typeof GOAL_CONFLICT_RULES)[number];

/**
 * Les deux résolutions proposées. Toujours deux, jamais une : une carte qui ne propose qu'une issue
 * n'est pas un arbitrage, c'est une injonction.
 */
export type GoalConflictResolution = 'keepMainGoal' | 'keepPillarGoal';

export type GoalConflict = {
  rule: GoalConflictRule;
  /**
   * Les deux valeurs qui s'opposent, sous forme d'identifiants (`'goal.muscle'`,
   * `'nutrition.cut'`…). L'interface les traduit ; le moteur ne les formule jamais.
   */
  left: string;
  right: string;
};

export type GoalConflictInput = {
  mainGoal: Goal | null | undefined;
  nutritionObjective: NutritionObjective | null | undefined;
  runnerObjective: RunnerObjective | null | undefined;
};

/** Objectifs de course qui engagent un volume d'endurance élevé sur plusieurs mois. */
const LONG_DISTANCE: readonly RunnerObjective[] = ['semi', 'marathon'];

/** Objectifs nutritionnels en déficit calorique. */
const DEFICIT: readonly NutritionObjective[] = ['cut', 'weightloss'];

/**
 * Les contradictions actuellement détectables.
 *
 * ⚠️ **Deux règles sur les trois annoncées par l'analyse.** La troisième — « perte de poids + volume
 * de course élevé + déficit » — correspond à **RN-17**, qui est au catalogue avec le statut
 * « non construit » : le calcul de volume de course croisé au déficit n'existe pas dans le dépôt.
 * L'écrire ici reviendrait à inventer un seuil. La structure l'accueille sans modification le jour
 * où RN-17 est livrée : une entrée de plus dans `GOAL_CONFLICT_RULES`, une branche de plus ici.
 */
export function detectGoalConflicts(input: GoalConflictInput): GoalConflict[] {
  const conflicts: GoalConflict[] = [];

  // ① L'objectif global veut prendre de la masse, la nutrition est en déficit.
  //    Le plus fréquent des trois, et le plus silencieux : les deux réglages vivent sur deux
  //    écrans que rien n'oblige à ouvrir le même jour.
  if (input.mainGoal === 'muscle' && input.nutritionObjective) {
    if (DEFICIT.includes(input.nutritionObjective)) {
      conflicts.push({
        rule: 'bulkVsCut',
        left: 'goal.muscle',
        right: `nutrition.${input.nutritionObjective}`,
      });
    }
  }

  // ② Une préparation longue distance pendant une prise de masse — c'est l'interférence que MR-08
  //    mesure déjà, exprimée cette fois au niveau des intentions et non de la charge réalisée.
  if (input.mainGoal === 'muscle' && input.runnerObjective) {
    if (LONG_DISTANCE.includes(input.runnerObjective)) {
      conflicts.push({
        rule: 'enduranceVsMass',
        left: 'goal.muscle',
        right: `running.${input.runnerObjective}`,
      });
    }
  }

  return conflicts;
}

/**
 * Un seul conflit s'affiche à la fois.
 *
 * Ce n'est pas une simplification : l'accueil est **plafonné** (ADR-007 §2, amendé le 09/09/2026),
 * et INSIGHTS-02 a montré qu'empiler des cartes y coûte plus cher que ce qu'elles rapportent. Deux
 * cartes de contradiction côte à côte transformeraient un signal en reproche.
 *
 * L'ordre est celui de `GOAL_CONFLICT_RULES` — stable, donc prévisible : la même situation montre
 * toujours la même carte, et un rejet ne fait pas surgir la suivante par surprise.
 */
export function firstVisibleConflict(
  conflicts: readonly GoalConflict[],
  dismissedRules: readonly string[],
): GoalConflict | null {
  for (const rule of GOAL_CONFLICT_RULES) {
    if (dismissedRules.includes(rule)) continue;
    const found = conflicts.find((c) => c.rule === rule);
    if (found) return found;
  }
  return null;
}
