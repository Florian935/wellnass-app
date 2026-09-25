/**
 * Le calendrier du mois de l'historique muscu — US MUSCU-UX07, règles R5 et R6.
 *
 * Une grille lundi → dimanche, en jours **locaux** (`dayKey` = `AAAA-MM-JJ`, déjà calculés par
 * l'appelant avec `localDayKey`). Les jours des mois voisins restent des cases vides : on ne les
 * affiche pas, on ne les compte pas.
 *
 * États d'un jour, par priorité :
 *  - `record` : au moins une séance terminée, dont l'une a battu un record ;
 *  - `done`   : au moins une séance terminée ;
 *  - `planned`: une occurrence muscu prévue, **aujourd'hui ou plus tard** — une séance prévue dans le
 *    passé et jamais faite n'est pas affichée (§6 de la spec, hors périmètre) ;
 *  - `empty`.
 */

export type YearMonth = { year: number; month: number };

/** Une séance terminée, rangée à son jour local. */
export type CalendarWorkout = { dayKey: string; recordCount: number };

export type CalendarDayState = 'empty' | 'done' | 'record' | 'planned';

export type CalendarCell = {
  /** `null` pour une case hors du mois. */
  dayKey: string | null;
  day: number | null;
  state: CalendarDayState;
  isToday: boolean;
  /** Nombre de séances terminées ce jour-là. */
  count: number;
};

const pad = (n: number) => String(n).padStart(2, '0');
const dayKeyOf = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

const EMPTY_CELL: CalendarCell = { dayKey: null, day: null, state: 'empty', isToday: false, count: 0 };

export function buildMonthGrid(input: {
  year: number;
  /** 1 à 12. */
  month: number;
  workouts: readonly CalendarWorkout[];
  plannedDayKeys: readonly string[];
  todayKey: string;
}): CalendarCell[][] {
  const { year, month, workouts, plannedDayKeys, todayKey } = input;

  const byDay = new Map<string, { count: number; records: number }>();
  for (const w of workouts) {
    const entry = byDay.get(w.dayKey) ?? { count: 0, records: 0 };
    entry.count += 1;
    entry.records += w.recordCount;
    byDay.set(w.dayKey, entry);
  }
  const planned = new Set(plannedDayKeys);

  // Lundi = 0. `new Date(année, mois, 1)` est en heure locale : aucun décalage de fuseau.
  const leading = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: CalendarCell[] = [];
  for (let i = 0; i < leading; i++) cells.push(EMPTY_CELL);
  for (let day = 1; day <= daysInMonth; day++) {
    const dayKey = dayKeyOf(year, month, day);
    const done = byDay.get(dayKey);
    const state: CalendarDayState = done
      ? done.records > 0
        ? 'record'
        : 'done'
      : planned.has(dayKey) && dayKey >= todayKey
        ? 'planned'
        : 'empty';
    cells.push({ dayKey, day, state, isToday: dayKey === todayKey, count: done?.count ?? 0 });
  }
  while (cells.length % 7 !== 0) cells.push(EMPTY_CELL);

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Le résumé d'un mois : séances, tonnage (kg, métrique — R6) et records. */
export function monthSummary(workouts: readonly { tonnageKg: number; recordCount: number }[]): {
  count: number;
  tonnageKg: number;
  records: number;
} {
  return {
    count: workouts.length,
    tonnageKg: workouts.reduce((sum, w) => sum + w.tonnageKg, 0),
    records: workouts.reduce((sum, w) => sum + w.recordCount, 0),
  };
}

export function monthOfDayKey(dayKey: string): YearMonth {
  const [y, m] = dayKey.split('-');
  return { year: Number(y), month: Number(m) };
}

export function shiftMonth(ym: YearMonth, delta: number): YearMonth {
  const index = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** < 0 si `a` est avant `b`, 0 si c'est le même mois. */
export function compareMonths(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

/**
 * Bornes de navigation : du mois de la première séance au mois courant. Sans aucune séance, le
 * mois courant seul — ses jours prévus restent visibles.
 */
export function monthRange(
  firstWorkoutDayKey: string | null,
  todayKey: string,
): { min: YearMonth; max: YearMonth } {
  const max = monthOfDayKey(todayKey);
  if (firstWorkoutDayKey === null) return { min: max, max };
  const first = monthOfDayKey(firstWorkoutDayKey);
  return { min: compareMonths(first, max) <= 0 ? first : max, max };
}
