/**
 * US MUSCU-UX05 — **« Tes charges »**, la carte dominante du hub Musculation.
 *
 * ── Ce qu'elle remplace, et pourquoi ─────────────────────────────────────────────────────────────
 * La première rédaction de cette carte affichait le **total SBD** (squat + développé couché +
 * soulevé de terre) et le score DOTS. Retour de Florian, 19/09/2026 : « ça parle à un powerlifter,
 * mais un pratiquant de muscu ou un débutant qui ne fait pas les trois mouvements s'en fiche
 * complètement ». Le défaut est réel et il est de nature : le total SBD est une métrique **de
 * pratique** déguisée en métrique **de progrès**.
 *
 * La carte mesure donc désormais la progression **des exercices que la personne pratique**, quels
 * qu'ils soient. Conséquence heureuse : un powerlifter retrouve ses trois mouvements sans rien
 * régler — ce sont les siens.
 *
 * ── Trois visages, choisis par les DONNÉES ───────────────────────────────────────────────────────
 *  1. `onboarding` — trop peu d'historique pour une tendance. On montre les **gains bruts depuis la
 *     première séance**, qui sont énormes au début. Motivant exactement au moment où l'app risque
 *     le plus d'être désinstallée.
 *  2. `established` — le défaut. Médiane des écarts de 1RM estimé sur la fenêtre, plus le détail
 *     par exercice.
 *  3. La variante **force** (total SBD) n'est pas ici : `practisesBigThree` dit seulement si elle
 *     est *méritée*, et l'écran décide. Voir `resolveLoadCardMode`.
 *
 * ── Les deux règles qui évitent d'afficher du bruit ──────────────────────────────────────────────
 *  - **Médiane, jamais moyenne** : un exercice aberrant (une série de test à 140 %) ne doit pas
 *    déplacer le titre de la carte.
 *  - **Séries de 3 à 10 reps uniquement** : Epley est une approximation qui se dégrade vite en
 *    hautes répétitions. Un 1RM « estimé » sur une série de 15 n'est pas une mesure, c'est un
 *    chiffre. Le filtrage vit ici, pas dans l'appelant, pour qu'il soit impossible de l'oublier.
 *
 * Aucune dépendance React, ni base, ni horloge : `todayKey` entre par paramètre, comme pour
 * `insights.ts` et `neglected-exercises.ts`.
 */

import { daysBetween } from './date';
import { estimate1RM } from './records';
import { SBD_LIFTS, type SbdLifts } from './settings';

// ---------------------------------------------------------------------------
// Constantes de règle
// ---------------------------------------------------------------------------

/** Bornes de répétitions où le 1RM estimé garde un sens (voir l'en-tête). */
export const LOAD_MIN_REPS = 3;
export const LOAD_MAX_REPS = 10;

/** Fenêtre de comparaison par défaut, en jours. */
export const LOAD_WINDOW_DAYS = 30;

/** En deçà, on n'a pas de quoi parler de tendance : la carte passe en `onboarding`. */
export const LOAD_MIN_HISTORY_DAYS = 56;

/** Un exercice n'est « régulier » qu'à partir de ce nombre de jours de pratique distincts. */
export const LOAD_MIN_SESSIONS = 3;

/** Nombre d'exercices détaillés sous le chiffre principal. */
export const LOAD_MAX_ITEMS = 4;

/**
 * Un écart sous ce seuil se dit « stagne » plutôt que de rendre un `+0,3 %` qui ferait croire à une
 * précision que l'estimation n'a pas.
 */
export const LOAD_FLAT_PCT = 1;


// ---------------------------------------------------------------------------
// Entrées / sorties
// ---------------------------------------------------------------------------

/** Une série retenue, réduite à ce dont le calcul a besoin. */
export type LoadSet = {
  exerciseId: string;
  /** Nom déjà résolu dans la langue de l'app. */
  exerciseName: string;
  /** `dayKey` (AAAA-MM-JJ) de la séance qui porte la série. */
  day: string;
  reps: number | null;
  weightKg: number | null;
};

export type LoadTrend = 'up' | 'flat' | 'down';

/** Un exercice et son évolution sur la fenêtre. */
export type LoadItem = {
  exerciseId: string;
  exerciseName: string;
  /** 1RM estimé de référence (début de fenêtre). */
  fromKg: number;
  /** 1RM estimé courant (fin de fenêtre). */
  toKg: number;
  deltaPct: number;
  trend: LoadTrend;
};

/** Un gain brut depuis la première séance — l'état `onboarding`. */
export type LoadGain = {
  exerciseId: string;
  exerciseName: string;
  fromKg: number;
  toKg: number;
  gainKg: number;
};

export type LoadProgress =
  /** Rien d'exploitable : aucune série dans les bornes de reps. */
  | { kind: 'empty' }
  /** Historique trop court pour une tendance — on montre les gains bruts. */
  | { kind: 'onboarding'; weeks: number; best: LoadGain; gains: LoadGain[] }
  /** Le cas courant. */
  | {
      kind: 'established';
      medianPct: number;
      /** Nombre d'exercices qui montent, sur le total suivi. */
      up: number;
      total: number;
      items: LoadItem[];
    };

export type LoadProgressInput = {
  sets: readonly LoadSet[];
  todayKey: string;
  windowDays?: number;
};

// ---------------------------------------------------------------------------
// Calcul
// ---------------------------------------------------------------------------

/** Les séries exploitables : charge réelle, reps dans les bornes où Epley tient. */
function usable(sets: readonly LoadSet[]): LoadSet[] {
  return sets.filter(
    (s) =>
      s.reps != null &&
      s.weightKg != null &&
      Number.isFinite(s.reps) &&
      Number.isFinite(s.weightKg) &&
      s.weightKg > 0 &&
      s.reps >= LOAD_MIN_REPS &&
      s.reps <= LOAD_MAX_REPS,
  );
}

/** Médiane d'une liste non vide. Pour un nombre pair d'éléments, moyenne des deux du milieu. */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Meilleur 1RM estimé d'un lot de séries, ou `null` s'il n'y en a aucune. */
function bestOneRm(sets: readonly LoadSet[]): number | null {
  let best: number | null = null;
  for (const s of sets) {
    const value = estimate1RM(s.weightKg!, s.reps!);
    if (best === null || value > best) best = value;
  }
  return best;
}

function trendOf(deltaPct: number): LoadTrend {
  if (deltaPct > LOAD_FLAT_PCT) return 'up';
  if (deltaPct < -LOAD_FLAT_PCT) return 'down';
  return 'flat';
}

/**
 * Regroupe par exercice, en conservant l'ordre de première apparition — l'appelant trie ses séries
 * par date, donc cet ordre est chronologique.
 */
function groupByExercise(sets: readonly LoadSet[]): Map<string, LoadSet[]> {
  const out = new Map<string, LoadSet[]>();
  for (const s of sets) {
    const bucket = out.get(s.exerciseId);
    if (bucket) bucket.push(s);
    else out.set(s.exerciseId, [s]);
  }
  return out;
}

/**
 * L'état de la carte « Tes charges ».
 *
 * `sets` peut arriver dans n'importe quel ordre : le calcul ne dépend que des `day`.
 */
export function computeLoadProgress(input: LoadProgressInput): LoadProgress {
  const windowDays = input.windowDays ?? LOAD_WINDOW_DAYS;
  const sets = usable(input.sets);
  if (sets.length === 0) return { kind: 'empty' };

  const days = sets.map((s) => s.day).sort();
  const firstDay = days[0]!;
  const historyDays = daysBetween(firstDay, input.todayKey);

  const byExercise = groupByExercise(sets);

  // ── Historique court : les gains bruts depuis le début ───────────────────────────────────────
  if (historyDays < LOAD_MIN_HISTORY_DAYS) {
    const gains: LoadGain[] = [];
    for (const [exerciseId, list] of byExercise) {
      const sorted = [...list].sort((a, b) => a.day.localeCompare(b.day));
      // Premier jour de pratique contre meilleur jamais atteint : c'est la lecture honnête d'un
      // début, où la charge de départ est souvent un tâtonnement.
      const firstDayOfExercise = sorted[0]!.day;
      const from = bestOneRm(sorted.filter((s) => s.day === firstDayOfExercise));
      const to = bestOneRm(sorted);
      if (from === null || to === null || to <= from) continue;
      gains.push({
        exerciseId,
        exerciseName: sorted[0]!.exerciseName,
        fromKg: from,
        toKg: to,
        gainKg: to - from,
      });
    }
    if (gains.length === 0) return { kind: 'empty' };
    gains.sort((a, b) => b.gainKg - a.gainKg);
    return {
      kind: 'onboarding',
      weeks: Math.max(1, Math.round(historyDays / 7)),
      best: gains[0]!,
      gains: gains.slice(0, LOAD_MAX_ITEMS),
    };
  }

  // ── Régime établi : l'écart sur la fenêtre, exercice par exercice ────────────────────────────
  const items: LoadItem[] = [];
  for (const [exerciseId, list] of byExercise) {
    const practiceDays = new Set(list.map((s) => s.day));
    if (practiceDays.size < LOAD_MIN_SESSIONS) continue;

    const recent = list.filter((s) => daysBetween(s.day, input.todayKey) <= windowDays);
    const before = list.filter((s) => daysBetween(s.day, input.todayKey) > windowDays);
    const to = bestOneRm(recent);
    const from = bestOneRm(before);
    // Sans point de comparaison, il n'y a pas d'écart à afficher — et inventer une référence
    // (la première série de la fenêtre, par exemple) fabriquerait une progression.
    if (to === null || from === null || from <= 0) continue;

    const deltaPct = ((to - from) / from) * 100;
    items.push({
      exerciseId,
      exerciseName: list[0]!.exerciseName,
      fromKg: from,
      toKg: to,
      deltaPct,
      trend: trendOf(deltaPct),
    });
  }

  if (items.length === 0) return { kind: 'empty' };

  items.sort((a, b) => b.deltaPct - a.deltaPct);
  return {
    kind: 'established',
    medianPct: median(items.map((i) => i.deltaPct)),
    up: items.filter((i) => i.trend === 'up').length,
    total: items.length,
    items: items.slice(0, LOAD_MAX_ITEMS),
  };
}

// ---------------------------------------------------------------------------
// La variante force — méritée, jamais imposée
// ---------------------------------------------------------------------------

/**
 * Vrai si les **trois** mouvements du total sont **désignés** et pratiqués régulièrement.
 *
 * ⚠️ Les mouvements ne sont pas reconnus par un identifiant canonique : MUSCPWR-01 les fait
 * **désigner par l'utilisateur** dans ses réglages (`sbdLifts`, un id d'exercice par mouvement),
 * précisément parce qu'un « squat » peut être une barre haute, une barre basse ou un gobelet. Les
 * deviner depuis un nom serait à la fois faux et fragile.
 *
 * On exige les trois : deux sur trois donnent un total faux (règle R11 de `strength-sbd`), et
 * proposer un « total SBD » à qui ne soulève jamais de terre reproduirait le défaut qu'on corrige.
 */
export function practisesBigThree(sets: readonly LoadSet[], designated: SbdLifts): boolean {
  const wanted = SBD_LIFTS.map((lift) => designated[lift]);
  if (wanted.some((id) => id == null || id === '')) return false;

  const days = new Map<string, Set<string>>();
  for (const s of usable(sets)) {
    if (!wanted.includes(s.exerciseId)) continue;
    const bucket = days.get(s.exerciseId) ?? new Set<string>();
    bucket.add(s.day);
    days.set(s.exerciseId, bucket);
  }
  return wanted.every((id) => (days.get(id!)?.size ?? 0) >= LOAD_MIN_SESSIONS);
}

/** Le réglage de la carte. `auto` laisse les données décider. */
export const LOAD_CARD_MODES = ['auto', 'loads', 'strength'] as const;
export type LoadCardMode = (typeof LOAD_CARD_MODES)[number];

/**
 * Le visage à rendre, une fois le réglage et les données croisés.
 *
 * `strength` demandé mais les trois mouvements absents → on retombe sur `loads` plutôt que
 * d'afficher un total bâti sur deux barres : un réglage ne rend pas une donnée vraie.
 */
export function resolveLoadCardMode(input: {
  mode: LoadCardMode;
  sets: readonly LoadSet[];
  designated: SbdLifts;
}): 'loads' | 'strength' {
  const big = practisesBigThree(input.sets, input.designated);
  if (input.mode === 'loads') return 'loads';
  if (input.mode === 'strength') return big ? 'strength' : 'loads';
  return big ? 'strength' : 'loads';
}
