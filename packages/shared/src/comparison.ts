/**
 * Comparaison de périodes : écart en pourcentage entre deux valeurs, et
 * calcul de la clé de jour de la période précédente (réutilise
 * `aggregateRunStats` avec cette clé comme `todayKey`).
 */
import { addDays, localDayKey } from './date';
import type { StatPeriod } from './run-stats';

/** Sens de variation entre la valeur courante et la valeur précédente. */
export type DeltaDirection = 'up' | 'down' | 'flat';

/** Résultat d'une comparaison en pourcentage : `pct` est `null` si la référence vaut 0. */
export type PercentChange = { pct: number | null; direction: DeltaDirection };

/**
 * Écart en pourcentage entre `current` et `previous`, arrondi à l'entier le
 * plus proche. Si `previous` vaut 0, le pourcentage n'est pas calculable
 * (`pct: null`) mais le sens (`direction`) reste déterminé.
 */
export function percentChange(current: number, previous: number): PercentChange {
  const direction: DeltaDirection =
    current > previous ? 'up' : current < previous ? 'down' : 'flat';
  const pct = previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
  return { pct, direction };
}

/** Parse une clé de jour AAAA-MM-JJ en Date locale (même convention que `run-stats.ts`). */
function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

/**
 * Clé de jour (AAAA-MM-JJ) représentant « aujourd'hui » dans la période
 * précédente, pour comparer via `aggregateRunStats(runs, period, cetteClé)` :
 * - `week` : 7 jours avant `todayKey` (même jour de la semaine précédente).
 * - `month` : dernier jour du mois précédent.
 * - `all` : pas de période précédente, retourne `null`.
 */
export function previousPeriodTodayKey(todayKey: string, period: StatPeriod): string | null {
  if (period === 'all') return null;
  const today = parseDayKey(todayKey);
  if (period === 'week') return localDayKey(addDays(today, -7));
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return localDayKey(addDays(firstOfMonth, -1));
}
