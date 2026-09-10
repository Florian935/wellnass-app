/**
 * Régularité du journal alimentaire (US NUTRI-UX01, R4.2 — catalogue NUTR-17 / NUTR-21).
 *
 * ── Le défaut corrigé ────────────────────────────────────────────────────────────────────────
 * `computeJournalCompletion` (NUTR-17, livrée) produit déjà un pourcentage. Il s'affichait nu :
 * « 83 % ». Or c'est la donnée la plus **motivante** du pilier, et un pourcentage ne montre ni
 * quand on a décroché, ni depuis combien de jours on tient. Cette brique produit de quoi dessiner
 * une heatmap et deux séries — sans rien recalculer de ce que NUTR-17 fait déjà.
 *
 * ── Le seuil « partiel » ─────────────────────────────────────────────────────────────────────
 * Une journée à 90 kcal n'est pas une journée renseignée : c'est un aliment oublié en cours de
 * route. On distingue donc trois états, et le seuil est **relatif à l'objectif** quand il existe
 * (un tiers de la cible), avec un plancher absolu — sinon un utilisateur sans objectif n'aurait
 * jamais de journée « complète ».
 */

/** Sous ce total, une journée compte comme vide même si elle porte une ligne. */
export const MIN_KCAL_FOR_PARTIAL = 50;
/** Part de l'objectif au-delà de laquelle la journée est considérée comme complète. */
const COMPLETE_SHARE_OF_TARGET = 1 / 3;
/** Repli quand aucun objectif n'est défini. */
const FALLBACK_COMPLETE_KCAL = 600;

export type DayFill = 'complete' | 'partial' | 'empty';

/** Total d'une journée, tel que le repository l'agrège. */
export interface DailyTotalInput {
  /** Clé de jour locale (AAAA-MM-JJ). */
  logDate: string;
  kcal: number;
}

export interface HeatmapCell {
  logDate: string;
  fill: DayFill;
  kcal: number;
}

/** Qualifie une journée d'après son total et l'objectif en vigueur. */
export function dayFill(kcal: number, targetKcal: number | null | undefined): DayFill {
  const value = Number.isFinite(kcal) ? Math.max(0, kcal) : 0;
  if (value < MIN_KCAL_FOR_PARTIAL) return 'empty';
  const threshold =
    targetKcal != null && Number.isFinite(targetKcal) && targetKcal > 0
      ? targetKcal * COMPLETE_SHARE_OF_TARGET
      : FALLBACK_COMPLETE_KCAL;
  return value >= threshold ? 'complete' : 'partial';
}

/**
 * Construit la suite de cellules pour les `days` derniers jours, **aujourd'hui en dernier**.
 *
 * Les jours sans ligne du tout n'apparaissent pas dans `totals` : ils sont ajoutés comme `empty`.
 * C'est tout l'intérêt de la heatmap — les trous sont l'information, pas l'absence de donnée.
 * `dayKeys` est fourni par l'appelant (la génération de clés locales vit dans `date.ts`) pour que
 * cette brique reste pure et sans dépendance à l'horloge.
 */
export function buildHeatmap(
  dayKeys: readonly string[],
  totals: readonly DailyTotalInput[],
  targetKcal: number | null | undefined,
): HeatmapCell[] {
  const byDate = new Map<string, number>();
  for (const t of totals) {
    byDate.set(t.logDate, (byDate.get(t.logDate) ?? 0) + (Number.isFinite(t.kcal) ? t.kcal : 0));
  }
  return dayKeys.map((logDate) => {
    const kcal = byDate.get(logDate) ?? 0;
    return { logDate, fill: dayFill(kcal, targetKcal), kcal };
  });
}

/**
 * Série en cours : nombre de jours consécutifs renseignés **en terminant par le dernier jour**.
 *
 * Une journée `partial` compte : elle prouve que la personne a ouvert l'app et saisi quelque
 * chose, ce qui est précisément ce que la série récompense. Seul `empty` casse la série.
 */
export function currentStreak(cells: readonly HeatmapCell[]): number {
  let streak = 0;
  for (let i = cells.length - 1; i >= 0; i -= 1) {
    if (cells[i]!.fill === 'empty') break;
    streak += 1;
  }
  return streak;
}

/** Plus longue suite de jours renseignés de la fenêtre. */
export function bestStreak(cells: readonly HeatmapCell[]): number {
  let best = 0;
  let run = 0;
  for (const cell of cells) {
    if (cell.fill === 'empty') {
      run = 0;
      continue;
    }
    run += 1;
    if (run > best) best = run;
  }
  return best;
}

/** Nombre de jours vides de la fenêtre. */
export function emptyDays(cells: readonly HeatmapCell[]): number {
  return cells.filter((c) => c.fill === 'empty').length;
}

/** Taux de jours renseignés de la fenêtre, en pourcentage entier. */
export function filledPct(cells: readonly HeatmapCell[]): number {
  if (cells.length === 0) return 0;
  const filled = cells.length - emptyDays(cells);
  return Math.round((filled / cells.length) * 100);
}
