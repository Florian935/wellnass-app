import { percentChange, type PercentChange } from './comparison';

export type WeeklyTrainingNutrition = {
  weekStart: string;                    // dayKey lundi (AAAA-MM-JJ, local)
  sessions: number;                     // nb séances terminées de la semaine
  tonnage: number | null;               // Σ reps×kg ; null si 0 séance (0 possible si séances sans série)
  avgKcal: number | null;               // moyenne/jour loggé ; null si 0 jour loggé
  avgProteinG: number | null;           // idem protéines
  tonnageChange: PercentChange | null;  // vs semaine précédente affichée ; null si pas de base
  kcalChange: PercentChange | null;
};

type WorkoutInput = { dayKey: string; tonnage: number };
type DailyKcalInput = { dayKey: string; kcal: number; proteinG: number };

/**
 * Agrège charge muscu et apports par semaine calendaire (MN-03, descriptif). Pure, déterministe,
 * sans I/O ni `Date`. `weekStarts` = lundis récent → ancien ; bucketing sans borne haute
 * (semaine d'un dayKey = le plus grand `weekStart <= dayKey`). Deltas = vs semaine précédente
 * AFFICHÉE (ligne du dessous) ; `null` sur la dernière ligne ou si une valeur comparée est `null`.
 */
export function computeWeeklyTrainingNutrition(input: {
  weekStarts: ReadonlyArray<string>;
  workouts: ReadonlyArray<WorkoutInput>;
  dailyKcals: ReadonlyArray<DailyKcalInput>;
}): WeeklyTrainingNutrition[] {
  const { weekStarts, workouts, dailyKcals } = input;
  const oldest = weekStarts[weekStarts.length - 1];

  const bucketOf = (dayKey: string): string | null => {
    if (oldest == null || dayKey < oldest) return null; // hors fenêtre
    for (const ws of weekStarts) if (ws <= dayKey) return ws;
    return null;
  };

  const sessions = new Map<string, number>();
  const tonnage = new Map<string, number>();
  const kcalSum = new Map<string, number>();
  const protSum = new Map<string, number>();
  const loggedDays = new Map<string, number>();

  for (const w of workouts) {
    const ws = bucketOf(w.dayKey);
    if (ws == null) continue;
    sessions.set(ws, (sessions.get(ws) ?? 0) + 1);
    tonnage.set(ws, (tonnage.get(ws) ?? 0) + w.tonnage);
  }
  for (const d of dailyKcals) {
    const ws = bucketOf(d.dayKey);
    if (ws == null) continue;
    kcalSum.set(ws, (kcalSum.get(ws) ?? 0) + d.kcal);
    protSum.set(ws, (protSum.get(ws) ?? 0) + d.proteinG);
    loggedDays.set(ws, (loggedDays.get(ws) ?? 0) + 1);
  }

  const rows: WeeklyTrainingNutrition[] = weekStarts.map((weekStart) => {
    const s = sessions.get(weekStart) ?? 0;
    const ld = loggedDays.get(weekStart) ?? 0;
    return {
      weekStart,
      sessions: s,
      tonnage: s > 0 ? (tonnage.get(weekStart) ?? 0) : null,
      avgKcal: ld > 0 ? Math.round((kcalSum.get(weekStart) ?? 0) / ld) : null,
      avgProteinG: ld > 0 ? Math.round((protSum.get(weekStart) ?? 0) / ld) : null,
      tonnageChange: null,
      kcalChange: null,
    };
  });

  for (let i = 0; i < rows.length; i++) {
    const cur = rows[i]!;
    const prev = rows[i + 1]; // semaine plus ancienne = base de comparaison
    if (!prev) continue;
    if (cur.tonnage != null && prev.tonnage != null) cur.tonnageChange = percentChange(cur.tonnage, prev.tonnage);
    if (cur.avgKcal != null && prev.avgKcal != null) cur.kcalChange = percentChange(cur.avgKcal, prev.avgKcal);
  }

  return rows;
}
