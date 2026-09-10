/**
 * US MUSCU-UX01 — le ressenti de fin de séance, sur l'échelle de la séance (règle R5).
 *
 * ── Le défaut ────────────────────────────────────────────────────────────────────────────────────
 * Pendant la séance, l'intensité se note en **RPE 1-10 ou en RIR**, au choix de l'utilisateur
 * (US UX-05). Au résumé, le ressenti se notait en **cinq étoiles sans échelle nommée**. Même
 * question — « c'était dur ? » — deux formats, aucun lien entre eux, et cinq étoiles qui ne disent
 * pas ce que vaut trois.
 *
 * ── Le principe, repris d'`intensity.ts` ─────────────────────────────────────────────────────────
 * **La base ne change pas de nature.** `workouts.rpe` continue de stocker un RPE 1-10 ; les cinq
 * niveaux nommés ne sont qu'une lecture. Un ressenti saisi hier reste lisible, et une séance notée
 * finement en RPE ne perd rien à s'afficher en cinq crans.
 *
 * ⚠️ **L'ancienne échelle stockait 1-5 dans le même champ** (`FeelingSection`, cinq étoiles →
 * `rpe: 1..5`). Les deux cohabitent donc en base. `feelingFromStoredRpe` traite ce cas
 * explicitement plutôt que de laisser une séance ancienne s'afficher « Facile » à tort — voir la
 * note sur le seuil.
 */

/** Les cinq niveaux de ressenti, du plus facile au plus dur. */
export const WORKOUT_FEELINGS = ['easy', 'fine', 'solid', 'hard', 'max'] as const;
export type WorkoutFeeling = (typeof WORKOUT_FEELINGS)[number];

/**
 * RPE représentatif de chaque niveau — la valeur écrite en base quand l'utilisateur choisit ce cran.
 *
 * Choisis au milieu de leur plage pour qu'un aller-retour niveau → RPE → niveau soit stable.
 */
const FEELING_TO_RPE: Record<WorkoutFeeling, number> = {
  easy: 2,
  fine: 4,
  solid: 6,
  hard: 8,
  max: 10,
};

/** Convertit un niveau de ressenti en RPE à stocker. */
export function feelingToStoredRpe(feeling: WorkoutFeeling): number {
  return FEELING_TO_RPE[feeling];
}

/**
 * Lit un RPE stocké comme l'un des cinq niveaux.
 *
 * Découpage par paires : 1-2 `easy`, 3-4 `fine`, 5-6 `solid`, 7-8 `hard`, 9-10 `max`. C'est le seul
 * découpage qui rende `feelingToStoredRpe` réciproque sur les cinq valeurs représentatives.
 *
 * ⚠️ **Les séances notées avant cette US portent un 1-5**, pas un 1-10 : une séance « 5 étoiles »
 * (très dure) vaut 5 en base et se relirait `solid` au lieu de `max`. C'est assumé et non
 * corrigeable sans migration : rien ne distingue en base un ancien 5/5 d'un nouveau RPE 5. Le
 * découpage retenu limite les dégâts — un ancien 5/5 se lit « Solide », pas « Facile ».
 */
export function feelingFromStoredRpe(rpe: number | null | undefined): WorkoutFeeling | null {
  if (rpe == null || !Number.isFinite(rpe)) return null;
  const clamped = Math.min(Math.max(Math.round(rpe), 1), 10);
  const index = Math.ceil(clamped / 2) - 1;
  return WORKOUT_FEELINGS[index] ?? null;
}
