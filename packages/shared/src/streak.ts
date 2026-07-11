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

/** Représente l'activité d'un jour sur les 3 piliers. */
export type DayActivity = {
  day: string;
  strength: boolean;
  running: boolean;
  nutrition: boolean;
};

/**
 * Extrait l'ensemble des clés de jours actifs depuis une liste d'activités.
 * Un jour est actif si au moins un pilier (strength, running ou nutrition) est vrai.
 */
export function activeDayKeys(activities: DayActivity[]): Set<string> {
  const result = new Set<string>();
  for (const a of activities) {
    if (a.strength || a.running || a.nutrition) {
      result.add(a.day);
    }
  }
  return result;
}
