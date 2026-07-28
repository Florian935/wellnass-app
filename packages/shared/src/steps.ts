/**
 * US PAS-01 — briques pures des pas quotidiens (lecture Health Connect).
 *
 * Même principe que `health-connect.ts` : **aucune dépendance native**, toute la logique métier ici
 * (testée sous Vitest), l'adaptateur mobile ne fait que des entrées/sorties.
 *
 * Deux règles structurent ce fichier, et ce sont les deux endroits où l'on se trompe :
 * 1. **le total du jour vient de l'API d'agrégation**, jamais d'une somme de records — Health Connect
 *    reçoit des pas de plusieurs sources (téléphone, montre, Google Fit) sur des plages qui se
 *    chevauchent, et les additionner gonfle le total ;
 * 2. **la date d'un bucket se lit littéralement**, cf. `dayKeyOfBucket` ci-dessous.
 */

import { localDateOfInstant } from './health-connect';

/** Objectif de pas par défaut (cf. spec §2.3 — délibérément 8 000, pas 10 000). */
export const DEFAULT_STEP_GOAL = 8000;

/** Bornes du réglage d'objectif, en pas. */
export const MIN_STEP_GOAL = 1000;
export const MAX_STEP_GOAL = 50000;

/** Pas du réglage d'objectif. */
export const STEP_GOAL_INCREMENT = 500;

/**
 * Au-delà, on considère la valeur comme corrompue (source tierce défaillante) et on l'écarte.
 * Le record du monde sur 24 h est très en dessous ; aucun utilisateur réel n'atteint ce seuil.
 */
export const MAX_PLAUSIBLE_STEPS = 200000;

/** Un total de pas pour un jour civil (`AAAA-MM-JJ`). */
export type DailyStepsInput = { logDate: string; steps: number };

/**
 * Bucket renvoyé par `aggregateGroupByPeriod` (sous-ensemble utilisé).
 *
 * `startTime` est produit côté natif par `it.startTime.toString()` où `startTime` est un
 * **`LocalDateTime`** : la chaîne vaut donc `2026-07-27T00:00` — **sans fuseau, et sans les secondes
 * quand elles sont nulles**.
 */
export type StepsBucket = {
  startTime?: string | null;
  endTime?: string | null;
  result?: { COUNT_TOTAL?: number | null } | null;
};

/** Une ligne `daily_steps` telle qu'elle existe déjà en base locale. */
export type LocalDailySteps = { logDate: string; steps: number; deletedAt?: string | null };

/**
 * Clé de jour (`AAAA-MM-JJ`) d'un bucket d'agrégation.
 *
 * ⚠️ Le cas normal est une chaîne **sans marqueur de fuseau** (`2026-07-27T00:00`), parce que
 * Health Connect découpe en périodes **civiles locales**. On lit donc les 10 premiers caractères
 * **littéralement**. Passer par `new Date(...)` supposerait un fuseau : la chaîne serait interprétée
 * en UTC (ou en local selon la plateforme), et un utilisateur à l'est de Greenwich verrait ses pas
 * datés de **la veille** — exactement le bug que `formatDayFull` évite déjà ailleurs dans le projet.
 *
 * Si un jour la bibliothèque renvoyait un **instant** (suffixe `Z` ou `±hh:mm`), le calcul de fuseau
 * redevient nécessaire : on délègue alors à `localDateOfInstant`. Défense pure, jamais empruntée
 * aujourd'hui.
 */
export function dayKeyOfBucket(
  startTime: string | null | undefined,
  fallbackOffsetSeconds?: number,
): string | null {
  if (!startTime) return null;
  const trimmed = startTime.trim();

  if (/(Z|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
    return localDateOfInstant(trimmed, undefined, fallbackOffsetSeconds);
  }

  const match = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  return match ? match[1]! : null;
}

/**
 * Buckets d'agrégation → lignes journalières exploitables.
 *
 * Écarte : les buckets sans date lisible, les totaux non finis, **les totaux nuls** et les valeurs
 * invraisemblables. Le zéro est écarté volontairement : Health Connect ne distingue pas « journée
 * sans donnée » de « journée à zéro pas », et matérialiser des zéros fabriquerait un historique faux
 * (moyennes tirées vers le bas, jours « enregistrés » qui n'ont jamais été mesurés).
 *
 * En cas de doublon de date (ne devrait pas arriver avec un slicer d'un jour), on garde le plus grand.
 */
export function toDailySteps(
  buckets: ReadonlyArray<StepsBucket>,
  fallbackOffsetSeconds?: number,
): DailyStepsInput[] {
  const byDay = new Map<string, number>();

  for (const bucket of buckets) {
    const logDate = dayKeyOfBucket(bucket.startTime, fallbackOffsetSeconds);
    if (logDate === null) continue;

    const raw = bucket.result?.COUNT_TOTAL;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;

    const steps = Math.round(raw);
    if (steps <= 0 || steps > MAX_PLAUSIBLE_STEPS) continue;

    const current = byDay.get(logDate);
    if (current === undefined || steps > current) byDay.set(logDate, steps);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([logDate, steps]) => ({ logDate, steps }));
}

/** Ce qu'il faut écrire en base après un import. */
export type DailyStepsMerge = {
  /** Jours absents localement → à insérer. */
  toCreate: DailyStepsInput[];
  /** Jours présents dont le total stocké est **inférieur** → à mettre à jour. */
  toUpdate: DailyStepsInput[];
};

/**
 * Confronte les totaux lus à ceux déjà stockés — **règle du max** (spec, décision 7).
 *
 * Pourquoi le max et non « la dernière valeur gagne » :
 * - dans la journée, un compteur de pas ne **redescend jamais** : le max est donc la valeur juste,
 *   et il rend l'import idempotent quel que soit l'ordre des appels ;
 * - avec **deux appareils**, la dernière écriture pourrait être celle d'une tablette peu portée
 *   (300 pas) et écraserait le vrai total du téléphone (9 000). Le max protège de ça.
 *
 * Une ligne locale **supprimée** (`deletedAt` non nul) est traitée comme absente : on la recrée
 * plutôt que de ressusciter une ligne effacée par ailleurs.
 */
export function mergeDailySteps(
  remote: ReadonlyArray<DailyStepsInput>,
  local: ReadonlyArray<LocalDailySteps>,
): DailyStepsMerge {
  const stored = new Map<string, number>();
  for (const row of local) {
    if (row.deletedAt != null) continue;
    stored.set(row.logDate, row.steps);
  }

  const toCreate: DailyStepsInput[] = [];
  const toUpdate: DailyStepsInput[] = [];

  for (const row of remote) {
    const current = stored.get(row.logDate);
    if (current === undefined) {
      toCreate.push(row);
    } else if (row.steps > current) {
      toUpdate.push(row);
    }
  }

  return { toCreate, toUpdate };
}

/** Objectif exploitable : borne les valeurs absurdes et retombe sur le défaut. */
export function normalizeStepGoal(goal: number | null | undefined): number {
  if (typeof goal !== 'number' || !Number.isFinite(goal) || goal <= 0) return DEFAULT_STEP_GOAL;
  return Math.min(MAX_STEP_GOAL, Math.max(MIN_STEP_GOAL, Math.round(goal)));
}

/**
 * L'objectif du jour est-il atteint ? Comparaison **inclusive** : 8 000 pas sur un objectif de
 * 8 000 est un objectif atteint.
 *
 * Un objectif invalide est ramené au défaut plutôt qu'ignoré : sans ça, un `goal` nul rendrait
 * n'importe quelle journée « atteinte » et, les pas comptant dans la série, la rendrait inbrisable.
 */
export function isGoalReached(steps: number | null | undefined, goal: number | null | undefined): boolean {
  if (typeof steps !== 'number' || !Number.isFinite(steps) || steps <= 0) return false;
  return steps >= normalizeStepGoal(goal);
}

/**
 * Jours (clés `AAAA-MM-JJ`) où l'objectif a été atteint — la forme attendue par le streak.
 *
 * C'est **l'objectif atteint** qui rend un jour actif, jamais « au moins un pas » : le téléphone
 * compte des pas tous les jours, la série ne se casserait donc plus jamais et ne voudrait plus rien
 * dire (spec, décision 4).
 */
export function stepsActiveDays(
  rows: ReadonlyArray<{ logDate: string; steps: number }>,
  goal: number | null | undefined,
): Set<string> {
  const target = normalizeStepGoal(goal);
  const active = new Set<string>();
  for (const row of rows) {
    if (isGoalReached(row.steps, target)) active.add(row.logDate);
  }
  return active;
}

/**
 * Faut-il relancer l'import des pas ? Calque de `shouldImportWeight`, mais avec une fenêtre bien plus
 * courte côté appelant (1 h contre 6 h) : une pesée est un événement quotidien, un compteur de pas
 * évolue toute la journée.
 *
 * En cas de doute (curseur illisible, horloge dans le futur), on **autorise** : un import de trop est
 * indolore et idempotent, un utilisateur bloqué ne l'est pas.
 */
export function shouldImportSteps(
  lastImportAt: string | null | undefined,
  nowMs: number,
  throttleHours: number,
): boolean {
  if (!lastImportAt) return true;
  const last = Date.parse(lastImportAt.includes('T') ? lastImportAt : lastImportAt.replace(' ', 'T'));
  if (!Number.isFinite(last) || last > nowMs) return true;
  return nowMs - last >= throttleHours * 3600 * 1000;
}

/** Moyenne (arrondie) des totaux fournis — 0 si la liste est vide. */
export function averageSteps(rows: ReadonlyArray<{ steps: number }>): number {
  if (rows.length === 0) return 0;
  const total = rows.reduce((sum, row) => sum + (Number.isFinite(row.steps) ? row.steps : 0), 0);
  return Math.round(total / rows.length);
}

/** Meilleur total de la période — 0 si la liste est vide. */
export function bestSteps(rows: ReadonlyArray<{ steps: number }>): number {
  return rows.reduce((max, row) => (Number.isFinite(row.steps) && row.steps > max ? row.steps : max), 0);
}
