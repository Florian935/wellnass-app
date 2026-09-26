/**
 * Le calendrier de l'onglet Historique du hub Nutrition — US NUTRI-UX03, règles R7 et R8.
 *
 * Chaque jour passé est un petit **verre**, rempli à hauteur de ce qui a été mangé par rapport à la
 * cible **de ce jour-là** (cible effective, bonus de séance compris) : c'est la demande de Florian du
 * 25/09/2026 (Q2), « voir si on était loin de la jauge ou pas, comme les anciens verres ». Les
 * anciens verres (trame de la semaine, DASH-01) ne distinguaient que trois états ; ici le niveau est
 * continu, et le statut dans / au-dessus / en dessous suit la marge de l'utilisateur, la même règle
 * que l'adhérence (`computeGoalAdherence`).
 *
 * Grille lundi → dimanche en jours locaux (`AAAA-MM-JJ`) ; les jours des mois voisins sont des cases
 * vides. Même squelette que `buildMonthGrid` de la muscu (MUSCU-UX07) : la factorisation est notée au
 * §11 de la spec.
 */

import { addDays, localDateFromDayKey, localDayKey } from './date';

export type DayTargetStatus = 'in' | 'over' | 'under';

/** Remplissage d'un jour noté dont la cible n'est pas calculable (profil incomplet). */
export const NO_TARGET_FILL = 0.5;

/** Jours vides récents proposés à compléter dans la liste (même fenêtre que la trame de DASH-01). */
export const RECENT_EMPTY_DAYS = 6;

export function dayTargetStatus(
  kcal: number,
  target: number | null | undefined,
  marginPct: number,
): DayTargetStatus | null {
  if (!(kcal > 0) || target == null || !(target > 0)) return null;
  if (Math.abs(kcal - target) <= target * (marginPct / 100)) return 'in';
  return kcal > target ? 'over' : 'under';
}

export function dayFillRatio(kcal: number, target: number | null | undefined): number {
  if (!(kcal > 0)) return 0;
  if (target == null || !(target > 0)) return NO_TARGET_FILL;
  return Math.min(1, kcal / target);
}

export type NutritionCalendarDay = {
  dayKey: string;
  kcal: number;
  /** Cible effective du jour, ou `null` si elle n'est pas calculable. */
  target: number | null;
};

export type NutritionCalendarCell = {
  /** `null` pour une case hors du mois. */
  dayKey: string | null;
  day: number | null;
  kind: 'blank' | 'past' | 'today' | 'future';
  kcal: number;
  logged: boolean;
  /** De 0 à 1. */
  fill: number;
  status: DayTargetStatus | null;
};

const pad = (n: number) => String(n).padStart(2, '0');

const BLANK: NutritionCalendarCell = {
  dayKey: null,
  day: null,
  kind: 'blank',
  kcal: 0,
  logged: false,
  fill: 0,
  status: null,
};

export function buildNutritionMonthGrid(input: {
  year: number;
  /** 1 à 12. */
  month: number;
  days: readonly NutritionCalendarDay[];
  todayKey: string;
  marginPct: number;
}): NutritionCalendarCell[][] {
  const { year, month, days, todayKey, marginPct } = input;
  const byDay = new Map(days.map((d) => [d.dayKey, d]));

  // Lundi = 0. `new Date(année, mois, 1)` est en heure locale : aucun décalage de fuseau.
  const leading = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: NutritionCalendarCell[] = [];
  for (let i = 0; i < leading; i++) cells.push(BLANK);
  for (let day = 1; day <= daysInMonth; day++) {
    const dayKey = `${year}-${pad(month)}-${pad(day)}`;
    const kind = dayKey === todayKey ? 'today' : dayKey > todayKey ? 'future' : 'past';
    const entry = kind === 'future' ? undefined : byDay.get(dayKey);
    const kcal = entry?.kcal ?? 0;
    cells.push({
      dayKey,
      day,
      kind,
      kcal,
      logged: kcal > 0,
      fill: dayFillRatio(kcal, entry?.target ?? null),
      status: kind === 'past' ? dayTargetStatus(kcal, entry?.target ?? null, marginPct) : null,
    });
  }
  while (cells.length % 7 !== 0) cells.push(BLANK);

  const weeks: NutritionCalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export type NutritionMonthSummary = {
  /** Jours notés avant aujourd'hui. */
  loggedDays: number;
  averageKcal: number;
  inTarget: number;
  over: number;
  under: number;
  /** Jours notés dont la cible est calculable : le dénominateur de la répartition. */
  withTarget: number;
};

/**
 * Le résumé d'un mois. **Aujourd'hui est exclu** : une journée en cours ferait baisser la moyenne et
 * compterait « en dessous » un jour qui n'est pas fini — la règle de NUTR-17 (régularité bornée à
 * hier).
 */
export function nutritionMonthSummary(
  days: readonly NutritionCalendarDay[],
  todayKey: string,
  marginPct: number,
): NutritionMonthSummary {
  const past = days.filter((d) => d.dayKey < todayKey && d.kcal > 0);
  const summary: NutritionMonthSummary = {
    loggedDays: past.length,
    averageKcal: past.length ? Math.round(past.reduce((s, d) => s + d.kcal, 0) / past.length) : 0,
    inTarget: 0,
    over: 0,
    under: 0,
    withTarget: 0,
  };
  for (const d of past) {
    const status = dayTargetStatus(d.kcal, d.target, marginPct);
    if (status === null) continue;
    summary.withTarget += 1;
    if (status === 'in') summary.inTarget += 1;
    else if (status === 'over') summary.over += 1;
    else summary.under += 1;
  }
  return summary;
}

/**
 * R8 — les jours de la liste d'Historique, du plus récent au plus ancien : les jours notés du mois
 * affiché (aujourd'hui compris s'il a des entrées), plus les jours **vides** des
 * `RECENT_EMPTY_DAYS` jours précédant aujourd'hui, pour qu'un oubli récent se complète en un geste.
 */
export function historyListDayKeys(input: {
  year: number;
  month: number;
  loggedDayKeys: readonly string[];
  todayKey: string;
}): string[] {
  const { year, month, loggedDayKeys, todayKey } = input;
  const prefix = `${year}-${pad(month)}-`;
  const keys = new Set(loggedDayKeys.filter((k) => k.startsWith(prefix) && k <= todayKey));
  const today = localDateFromDayKey(todayKey);
  for (let i = 1; i <= RECENT_EMPTY_DAYS; i++) {
    const key = localDayKey(addDays(today, -i));
    if (key.startsWith(prefix)) keys.add(key);
  }
  return [...keys].sort().reverse();
}
