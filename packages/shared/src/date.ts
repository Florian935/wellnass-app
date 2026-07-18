/** Clé de jour local AAAA-MM-JJ (pour agréger séances/courses UTC et journées nutrition/poids locales). */
export function localDayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Jour de semaine ISO : 0 = lundi … 6 = dimanche (JS getDay() est 0 = dimanche). */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Nouvelle date décalée de `n` jours (préserve l'heure locale ; usage sur dates calendaires). */
export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** Lundi de la semaine contenant `d`. */
export function startOfWeek(d: Date): Date {
  return addDays(d, -weekdayIndex(d));
}

/**
 * Nombre de jours calendaires de `fromKey` à `toKey` (clés locales AAAA-MM-JJ).
 * Calcul via midi UTC → insensible aux transitions d'heure d'été (DST-safe).
 */
export function daysBetween(fromKey: string, toKey: string): number {
  const toMs = (key: string): number => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y!, m! - 1, d!, 12);
  };
  return Math.round((toMs(toKey) - toMs(fromKey)) / 86_400_000);
}
