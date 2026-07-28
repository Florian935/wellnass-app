/** Calcule la clé du jour précédent de façon DST-safe (via Date.UTC). */
function prevKey(key: string): string {
  const parts = key.split('-').map(Number);
  const y = parts[0] as number;
  const m = parts[1] as number;
  const d = parts[2] as number;
  const t = Date.UTC(y, m - 1, d) - 86_400_000;
  const p = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.getUTCFullYear()}-${pad(p.getUTCMonth() + 1)}-${pad(p.getUTCDate())}`;
}

/**
 * Calcule la série (streak) de jours actifs consécutifs.
 *
 * @param activeDays - Ensemble des clés de jours actifs (format AAAA-MM-JJ).
 * @param todayKey   - Clé du jour courant (passée en paramètre — pas de Date.now() interne).
 * @returns `current` : nombre de jours consécutifs ; `activeToday` : le jour courant est-il actif.
 */
export function computeStreak(
  activeDays: Set<string>,
  todayKey: string,
): { current: number; activeToday: boolean } {
  const activeToday = activeDays.has(todayKey);

  // Déterminer le point de départ du comptage
  let cursor: string;
  if (activeToday) {
    cursor = todayKey;
  } else {
    const yesterdayKey = prevKey(todayKey);
    if (activeDays.has(yesterdayKey)) {
      cursor = yesterdayKey;
    } else {
      return { current: 0, activeToday };
    }
  }

  // Compter les jours consécutifs en remontant
  let count = 0;
  while (activeDays.has(cursor)) {
    count += 1;
    cursor = prevKey(cursor);
  }

  return { current: count, activeToday };
}

/**
 * Représente l'activité d'un jour sur les 3 piliers, **plus les pas** (US PAS-01).
 *
 * `steps` n'est pas « l'utilisateur a fait des pas » mais « **l'objectif de pas est atteint** » : le
 * téléphone compte des pas tous les jours, donc la première lecture rendrait la série inbrisable et
 * vide de sens. La décision se prend chez l'appelant, via `isGoalReached()`.
 */
export type DayActivity = {
  day: string;
  strength: boolean;
  running: boolean;
  nutrition: boolean;
  /** Objectif de pas atteint ce jour-là (US PAS-01). Optionnel : absent = non atteint. */
  steps?: boolean;
};

/**
 * Extrait l'ensemble des clés de jours actifs depuis une liste d'activités.
 * Un jour est actif si au moins une dimension est vraie : musculation, course, nutrition
 * ou **objectif de pas atteint**.
 */
export function activeDayKeys(activities: DayActivity[]): Set<string> {
  const result = new Set<string>();
  for (const a of activities) {
    if (a.strength || a.running || a.nutrition || a.steps === true) {
      result.add(a.day);
    }
  }
  return result;
}
