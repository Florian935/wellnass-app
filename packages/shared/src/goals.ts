/**
 * US OBJ-01 — objectifs personnels à échéance (roadmap 7.15).
 *
 * Aucune dépendance React ni base : du calcul, testé sous Vitest.
 *
 * ── La décision qui structure tout le fichier (D5) ────────────────────────────────────────────────
 * **Rien n'est stocké de la progression ni du statut.** Les deux sont des **fonctions pures de la
 * fenêtre `[start_date, deadline]`**. Trois bénéfices, et ce sont eux qui justifient le choix :
 *
 *  1. **aucun travail de fond** : pas de cron, pas de job au démarrage, personne à réveiller pour
 *     clôturer les objectifs échus ;
 *  2. **un verdict stable** : un record battu deux mois plus tard ne peut pas « réussir »
 *     rétroactivement un objectif passé, parce qu'il tombe hors de la fenêtre ;
 *  3. **ça marche hors ligne**, puisqu'il n'y a rien à écrire.
 *
 * Le prix à payer est un recalcul à chaque affichage. Sur des fenêtres de quelques semaines et des
 * listes de 3 objectifs, c'est négligeable.
 */

/** Les 2 types d'objectif au lancement (décision D1). */
export const GOAL_KINDS = ['run_distance', 'exercise_1rm'] as const;

export type GoalKind = (typeof GOAL_KINDS)[number];

/** Nombre maximum d'objectifs actifs simultanés (décision D2). */
export const MAX_ACTIVE_GOALS = 3;

/** Jalons visuels sur l'anneau (décision D4) — des repères, pas des récompenses. */
export const GOAL_MILESTONES = [0.25, 0.5, 0.75] as const;

/** Un objectif tel qu'il est stocké. */
export type Goal = {
  id: string;
  kind: GoalKind;
  /** Mètres pour `run_distance`, kilogrammes pour `exercise_1rm`. */
  targetValue: number;
  /** Valeur de départ figée à la création. `null` pour un cumul (décision D6). */
  startValue: number | null;
  /** Exercice visé, requis pour `exercise_1rm`. `null` si l'exercice a été supprimé. */
  exerciseId: string | null;
  startDate: string;
  deadline: string;
};

/** Une course, réduite à ce dont le calcul a besoin. */
export type GoalRun = { dayKey: string; distanceM: number };

/** Un meilleur 1RM estimé d'une séance, pour un exercice donné. */
export type GoalLift = { dayKey: string; exerciseId: string; estimated1RM: number };

/** État d'un objectif : en cours jusqu'à l'échéance incluse, puis clos avec son verdict. */
export type GoalStatus = 'active' | 'achieved' | 'missed';

/** Progression d'un objectif, prête à afficher. */
export type GoalProgress = {
  /** Valeur atteinte dans la fenêtre (mètres ou kg). `null` si non calculable. */
  currentValue: number | null;
  /** Ratio **borné** à [0, 1], pour l'anneau. `null` si non calculable. */
  ratio: number | null;
  /** Ratio **brut**, non borné : dépasser sa cible est une information. */
  rawRatio: number | null;
  status: GoalStatus;
  /** Vrai si la progression n'a pas pu être calculée (ex. exercice supprimé). */
  unavailable: boolean;
};

/** Vrai si `day` est dans `[from, to]` (comparaison lexicographique de clés `AAAA-MM-JJ`). */
function within(day: string, from: string, to: string): boolean {
  return day >= from && day <= to;
}

/**
 * Borne haute de la fenêtre de mesure : l'échéance, ou aujourd'hui si l'objectif court encore.
 *
 * C'est ce plafond qui rend le verdict **stable** : après l'échéance, la fenêtre ne bouge plus, donc
 * plus aucune activité ultérieure ne peut la modifier.
 */
export function goalWindowEnd(goal: Goal, todayKey: string): string {
  return todayKey < goal.deadline ? todayKey : goal.deadline;
}

/** Vrai si l'objectif court encore. L'échéance est **incluse** : il se clôt le lendemain. */
export function isGoalActive(goal: Goal, todayKey: string): boolean {
  return todayKey <= goal.deadline;
}

/**
 * Progression d'un objectif de **distance de course** : cumul des courses terminées dans la fenêtre.
 *
 * Un cumul part de zéro par construction — d'où l'inutilité d'une valeur de départ (D6).
 */
function runDistanceProgress(goal: Goal, runs: ReadonlyArray<GoalRun>, end: string): number {
  return runs
    .filter((run) => within(run.dayKey, goal.startDate, end))
    .reduce((sum, run) => sum + run.distanceM, 0);
}

/**
 * Progression d'un objectif de **force** : meilleur 1RM estimé atteint dans la fenêtre.
 *
 * `null` si l'exercice n'est plus référencé (supprimé côté catalogue) : on ne peut pas prétendre
 * mesurer une progression sur un mouvement qui n'existe plus. L'UI doit le **dire** plutôt
 * qu'afficher 0 %, qui se lirait comme un échec.
 */
function exercise1rmProgress(
  goal: Goal,
  lifts: ReadonlyArray<GoalLift>,
  end: string,
): number | null {
  if (goal.exerciseId === null) return null;

  const inWindow = lifts.filter(
    (lift) => lift.exerciseId === goal.exerciseId && within(lift.dayKey, goal.startDate, end),
  );
  if (inWindow.length === 0) return goal.startValue;

  const best = Math.max(...inWindow.map((lift) => lift.estimated1RM));
  // Le départ reste le plancher : une mauvaise séance ne fait pas « régresser » l'objectif.
  return goal.startValue === null ? best : Math.max(best, goal.startValue);
}

/**
 * Progression et statut d'un objectif.
 *
 * Le statut est **`active` jusqu'à l'échéance incluse, même à 100 %** : atteindre sa cible en avance
 * n'interdit pas de continuer à accumuler, et clore l'objectif priverait l'utilisateur de la suite.
 */
export function computeGoalProgress(params: {
  goal: Goal;
  runs?: ReadonlyArray<GoalRun>;
  lifts?: ReadonlyArray<GoalLift>;
  todayKey: string;
}): GoalProgress {
  const { goal, runs = [], lifts = [], todayKey } = params;
  const end = goalWindowEnd(goal, todayKey);

  let currentValue: number | null;
  let rawRatio: number | null;

  if (goal.kind === 'run_distance') {
    currentValue = runDistanceProgress(goal, runs, end);
    rawRatio = goal.targetValue > 0 ? currentValue / goal.targetValue : null;
  } else {
    currentValue = exercise1rmProgress(goal, lifts, end);
    const start = goal.startValue ?? 0;
    const span = goal.targetValue - start;
    // Une cible ≤ départ est refusée à la création ; si elle arrivait quand même, on refuse de
    // diviser par zéro (ou par un négatif) et on rend la progression non calculable.
    rawRatio = currentValue === null || span <= 0 ? null : (currentValue - start) / span;
  }

  const unavailable = rawRatio === null;
  const ratio = rawRatio === null ? null : Math.min(1, Math.max(0, rawRatio));

  const status: GoalStatus = isGoalActive(goal, todayKey)
    ? 'active'
    : rawRatio !== null && rawRatio >= 1
      ? 'achieved'
      : 'missed';

  return { currentValue, ratio, rawRatio, status, unavailable };
}

/** Vrai si un nouvel objectif peut être créé (décision D2). */
export function canCreateGoal(activeCount: number): boolean {
  return activeCount < MAX_ACTIVE_GOALS;
}

/**
 * Valide une cible avant création. Renvoie `null` si tout va bien, sinon un code d'erreur que l'UI
 * traduit.
 *
 * Le cas qui compte : pour un objectif de force, une cible **inférieure ou égale** au 1RM actuel
 * serait déjà atteinte le jour de sa création. Elle n'engagerait rien, et l'anneau afficherait 100 %
 * immédiatement — un objectif qui ne demande aucun effort n'est pas un objectif.
 */
export function validateGoalTarget(params: {
  kind: GoalKind;
  targetValue: number;
  startValue: number | null;
  startDate: string;
  deadline: string;
}): 'invalid_target' | 'target_below_start' | 'deadline_before_start' | null {
  const { kind, targetValue, startValue, startDate, deadline } = params;

  if (!Number.isFinite(targetValue) || targetValue <= 0) return 'invalid_target';
  if (deadline < startDate) return 'deadline_before_start';
  if (kind === 'exercise_1rm' && startValue !== null && targetValue <= startValue) {
    return 'target_below_start';
  }
  return null;
}
