/**
 * US MUSCU-UX01 — durée **estimée** d'une séance planifiée, avant de la démarrer.
 *
 * ⚠️ À ne pas confondre avec `session-duration.ts` (US EXEC-01), qui analyse la durée **réelle**
 * des séances passées (médiane, tendance, aberrantes). Ici on estime à l'avance, à partir du plan.
 *
 * La spec `musculation.md` §4.2 promet un « temps prévu estimé » avant de démarrer ; il n'existait
 * nulle part. La carte du jour l'affiche désormais, parce que « 55 min » change la décision de
 * démarrer maintenant ou plus tard bien plus sûrement que « 5 exercices ».
 *
 * ── Le modèle, volontairement grossier ───────────────────────────────────────────────────────────
 * `durée ≈ Σ séries × (temps d'exécution + repos)`. Une série de musculation dure une trentaine de
 * secondes ; on retient **40 s**, mise en place comprise. Le repos vient du plan quand il est
 * renseigné, sinon du défaut de l'écran de séance (90 s).
 *
 * On ne cherche pas la précision : c'est un ordre de grandeur pour décider, pas une promesse. Il
 * est arrondi à 5 minutes près, ce qui le dit visuellement — « 55 min » se lit comme une
 * estimation, « 53 min » se lirait comme un calcul.
 */

/** Temps d'exécution moyen d'une série, mise en place comprise (secondes). */
export const SET_EXECUTION_SECONDS = 40;

/** Repos retenu quand le plan n'en donne pas — même défaut que l'écran de séance. */
export const DEFAULT_PLAN_REST_SECONDS = 90;

/** Ce qu'un exercice planifié apporte à l'estimation. */
export type PlannedExerciseDuration = {
  targetSets: number | null;
  restSeconds: number | null;
};

/**
 * Estime la durée d'une séance en minutes, arrondie à 5 min.
 *
 * `null` quand rien n'est estimable (aucun exercice, ou aucune série cible renseignée) : mieux
 * vaut ne rien afficher qu'annoncer « 0 min » ou un chiffre inventé.
 */
export function estimateSessionMinutes(plans: readonly PlannedExerciseDuration[]): number | null {
  if (plans.length === 0) return null;

  let seconds = 0;
  let counted = 0;
  for (const plan of plans) {
    const sets = plan.targetSets;
    if (sets == null || sets <= 0) continue;
    const rest =
      plan.restSeconds != null && plan.restSeconds >= 0
        ? plan.restSeconds
        : DEFAULT_PLAN_REST_SECONDS;
    seconds += sets * (SET_EXECUTION_SECONDS + rest);
    counted += 1;
  }
  if (counted === 0) return null;

  // Le dernier repos de la séance ne se vit pas : on ne rentre pas chez soi en récupérant.
  const lastRest = plans[plans.length - 1]?.restSeconds ?? DEFAULT_PLAN_REST_SECONDS;
  seconds = Math.max(seconds - lastRest, 0);

  const minutes = Math.round(seconds / 60 / 5) * 5;
  return Math.max(minutes, 5);
}
