/**
 * US MUSCU-UX01 — pré-affectation des jours d'un programme (règle R2-1).
 *
 * ── Le défaut que ça corrige ─────────────────────────────────────────────────────────────────────
 * `planning/plan.tsx` démarrait avec `dayAssignments` **vide**, et `canPlan` restait faux tant que
 * chaque séance n'avait pas reçu son jour. Pour un programme à trois séances : trois taps
 * obligatoires, sans la moindre suggestion — alors qu'une répartition raisonnable est évidente.
 *
 * ── Pourquoi une table et pas une formule ────────────────────────────────────────────────────────
 * Le premier jet calculait un pas constant `7 / n`. Résultat pour 4 séances : **lundi, mardi,
 * jeudi, samedi** — mathématiquement défendable, mais personne ne s'entraîne comme ça. La
 * répartition d'une semaine d'entraînement n'est pas un problème d'optimisation, c'est une
 * **convention de coach** : on garde le dimanche libre, on coupe le mercredi sur un 4 jours, on
 * enchaîne du lundi au vendredi sur un 5 jours.
 *
 * La table dit donc ce que font réellement les programmes, et se relit d'un coup d'œil :
 *
 *   1 → L        · 2 → L J      · 3 → L M V        · 4 → L M J V
 *   5 → L M M J V · 6 → L M M J V S · 7 → toute la semaine
 *
 * ⚠️ **Suggéré, jamais imposé** (décision H) : l'utilisateur reste libre de déplacer chaque séance.
 * Le seul rôle de cette fonction est de remplir le formulaire pour qu'il soit validable tout de
 * suite, pas de décider à sa place.
 */

/** Nombre de jours dans une semaine de planification. */
export const DAYS_PER_WEEK = 7;

/**
 * Répartitions usuelles par nombre de séances hebdomadaires, indices de jour (0 = lundi).
 *
 * Index du tableau = nombre de séances ; l'entrée 0 est vide et n'est jamais lue.
 */
const WEEKLY_SPREADS: readonly (readonly number[])[] = [
  [], // 0 séance
  [0], // L
  [0, 3], // L J — écart maximal sur deux séances
  [0, 2, 4], // L M V — le grand classique du full body
  [0, 1, 3, 4], // L M J V — repos le mercredi et le week-end (upper/lower, PPL 4)
  [0, 1, 2, 3, 4], // L M M J V — semaine de travail, week-end libre
  [0, 1, 2, 3, 4, 5], // L M M J V S — PPL 6 jours, dimanche libre
  [0, 1, 2, 3, 4, 5, 6], // toute la semaine
];

/**
 * Répartit `sessionCount` séances sur les 7 jours de la semaine, du lundi (0) au dimanche (6).
 *
 * Retourne un tableau d'indices de jour **strictement croissant**, de longueur
 * `min(sessionCount, 7)`. Au-delà de 7 séances par semaine, on ne peut plus espacer : les
 * surnuméraires ne reçoivent pas de jour propre et l'appelant reprend au lundi (voir
 * `assignSessionDays`).
 *
 * `sessionCount <= 0` → tableau vide (aucune séance à placer).
 */
export function spreadSessionsOverWeek(sessionCount: number): number[] {
  if (!Number.isFinite(sessionCount) || sessionCount <= 0) return [];
  const count = Math.min(Math.floor(sessionCount), DAYS_PER_WEEK);
  return [...(WEEKLY_SPREADS[count] ?? [])];
}

/**
 * Affecte un jour à chaque séance d'un programme, dans l'ordre où elles sont données.
 *
 * Retourne la carte `sessionId → jour (0 = lundi)` attendue par `planProgram`. Au-delà de 7
 * séances, les surnuméraires **reprennent au lundi** : deux séances le même jour est un choix
 * discutable, mais moins mauvais qu'un formulaire invalide que l'utilisateur devra réparer.
 */
export function assignSessionDays(sessionIds: readonly string[]): Record<string, number> {
  const days = spreadSessionsOverWeek(sessionIds.length);
  const assignments: Record<string, number> = {};
  sessionIds.forEach((id, index) => {
    assignments[id] = days[index] ?? index % DAYS_PER_WEEK;
  });
  return assignments;
}
