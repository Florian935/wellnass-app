import { MUSCLE_GROUPS, type MuscleGroup } from './exercise';

/**
 * Équilibre du volume d'entraînement par groupe musculaire (spec MUSC-05).
 * Chaque groupe est comparé à une cible uniforme (1/6 du volume total).
 */

export type MuscleBalanceStatus = 'neglected' | 'balanced' | 'over';

export type MuscleGroupBalance = {
  muscle: MuscleGroup;
  sets: number;
  share: number;
  status: MuscleBalanceStatus;
};

export type MuscleBalance = {
  groups: MuscleGroupBalance[];
  neglected: MuscleGroup[];
  totalSets: number;
  hasEnoughData: boolean;
};

/** Part cible par groupe si le volume était parfaitement uniforme (1 / 6 groupes). */
export const EVEN_SHARE = 1 / 6;
/** Sous ce ratio de la part cible, le groupe est considéré délaissé. */
export const NEGLECTED_SHARE_RATIO = 0.5;
/** Au-dessus de ce ratio de la part cible, le groupe est considéré sur-représenté. */
export const OVER_SHARE_RATIO = 2;
/** Volume minimum (toutes séries confondues) requis pour évaluer l'équilibre. */
export const MIN_SETS_FOR_BALANCE = 12;

/**
 * Calcule l'équilibre musculaire à partir du nombre de séries par groupe.
 * Les groupes absents de `setsByGroup` sont normalisés à 0 série. En-dessous
 * de `MIN_SETS_FOR_BALANCE` séries au total, l'historique est jugé trop
 * maigre pour classer les groupes (tous `balanced`, aucun `neglected`).
 */
export function computeMuscleBalance(
  setsByGroup: ReadonlyArray<{ muscle: MuscleGroup; sets: number }>,
): MuscleBalance {
  const setsOf = (m: MuscleGroup) => setsByGroup.find((s) => s.muscle === m)?.sets ?? 0;
  const totalSets = MUSCLE_GROUPS.reduce((acc, m) => acc + setsOf(m), 0);
  const hasEnoughData = totalSets >= MIN_SETS_FOR_BALANCE;

  const groups: MuscleGroupBalance[] = MUSCLE_GROUPS.map((muscle) => {
    const sets = setsOf(muscle);
    const share = totalSets > 0 ? sets / totalSets : 0;
    let status: MuscleBalanceStatus = 'balanced';
    if (hasEnoughData) {
      if (sets === 0 || share < EVEN_SHARE * NEGLECTED_SHARE_RATIO) status = 'neglected';
      else if (share > EVEN_SHARE * OVER_SHARE_RATIO) status = 'over';
    }
    return { muscle, sets, share, status };
  });

  const neglected = groups.filter((g) => g.status === 'neglected').map((g) => g.muscle);
  return { groups, neglected, totalSets, hasEnoughData };
}
