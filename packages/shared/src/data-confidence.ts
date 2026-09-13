/**
 * US DASH-01 — le brouillard de confiance (spec §4.2).
 *
 * Une donnée incomplète ne doit pas se dessiner pleine. Cette fonction dit, pour la semaine écoulée,
 * quels jours n'ont aucune saisie : l'écran pointille leurs verres et nomme le plus récent, qui est la
 * donnée qui améliorerait le plus les conseils. **Aujourd'hui n'est jamais « manquant »** : la journée
 * est en cours.
 */

export type LoggingConfidence = {
  level: 'full' | 'partial' | 'low';
  /** Jours sans saisie, du plus récent au plus ancien. */
  missingDayKeys: string[];
};

function shiftDayKey(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! + delta));
  return date.toISOString().slice(0, 10);
}

/**
 * @param days  totaux caloriques par jour (les jours absents comptent comme vides)
 * @param windowDays taille de la fenêtre **aujourd'hui compris** (7 = les 6 jours passés + aujourd'hui)
 */
export function weekLoggingConfidence(
  days: ReadonlyArray<{ dayKey: string; kcal: number }>,
  todayKey: string,
  windowDays = 7,
): LoggingConfidence {
  const logged = new Set(days.filter((d) => d.kcal > 0).map((d) => d.dayKey));
  const missingDayKeys: string[] = [];
  for (let i = 1; i < windowDays; i += 1) {
    const key = shiftDayKey(todayKey, -i);
    if (!logged.has(key)) missingDayKeys.push(key);
  }
  const level = missingDayKeys.length === 0 ? 'full' : missingDayKeys.length <= 2 ? 'partial' : 'low';
  return { level, missingDayKeys };
}
