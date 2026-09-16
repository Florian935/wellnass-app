/**
 * US LABO-01 (roadmap 7.30) — le Labo, onglet « Pourquoi ? » : quand une courbe cale, chercher la
 * cause dans tous les piliers.
 *
 * ── La méthode, en une phrase ───────────────────────────────────────────────────────────────────
 * Détecter un plateau sur une courbe réelle (force, poids, allure), puis **comparer les trois
 * dernières semaines aux trois précédentes** sur chaque facteur connu pour peser : ce qui a bougé est
 * un suspect, ce qui n'a pas bougé est écarté, ce qui manque de données est dit.
 *
 * ── Ce que ce module ne prétend pas ─────────────────────────────────────────────────────────────
 * **Aucune causalité.** Ce sont des associations sur les données d'une seule personne ; l'écran le
 * dit (« associations, pas des preuves ») et propose une expérience pour trancher. Les « forces »
 * ne sont pas des probabilités : ce sont des écarts ramenés sur une échelle 0-1 par des bornes
 * **nommées et exportées**, pour qu'on puisse les rediscuter (même parti pris que COLLIS-01).
 *
 * Catalogue : META-11 (rupture de pente), META-12 (plateau), MN-18 (stagnation + apport
 * insuffisant), NUTR-19 (poids théorique vs réel), NUTR-17 (régularité du journal).
 */

import { addDays, localDateFromDayKey, localDayKey } from './date';
import type { LabExperimentKind } from './lab-experiments';
import type { LabPair, LabPillar, LabProposalKind } from './lab-week';
import { GOOD_NIGHT_MINUTES } from './lab-week';
import type { NutritionObjective } from './nutrition';
import type { Pillar } from './pillar';
import { linearRegression } from './regression';

// ---------------------------------------------------------------------------
// Bornes
// ---------------------------------------------------------------------------

/** Les deux fenêtres comparées : 21 jours récents, et les 21 jours qui les précèdent. */
export const LAB_WINDOW_DAYS = 21;
/** Une charge est « à plat » si le meilleur récent ne dépasse pas l'ancien de plus de 1 %. */
export const LIFT_PLATEAU_TOLERANCE = 0.01;
/** Semaines de force nécessaires pour parler de plateau (sur les 8 lues). */
export const LIFT_MIN_WEEKS = 5;
/** Perte de poids hebdomadaire sous laquelle une perte est « à plat » (kg/semaine). */
export const WEIGHT_FLAT_KG_PER_WEEK = 0.15;
/** Pesées récentes nécessaires pour tracer une pente. */
export const WEIGHT_MIN_ENTRIES = 6;
/** Ralentissement (s/km) des 3 dernières séances de qualité qui ouvre une enquête. */
export const PACE_FADE_S_PER_KM = 3;
/** Séances de qualité nécessaires sur 8 semaines. */
export const PACE_MIN_RUNS = 5;
/** Jours saisis nécessaires dans une fenêtre pour juger l'alimentation. */
export const LAB_MIN_LOGGED_DAYS = 4;
/** Nuits saisies nécessaires dans une fenêtre pour juger le sommeil. */
export const LAB_MIN_NIGHTS = 5;
/** Au-delà de cette force, un suspect est « fort » ; au-delà de la seconde, « moyen ». */
export const SUSPECT_STRONG = 0.66;
export const SUSPECT_MEDIUM = 0.33;
/** Suspects montrés au plus. */
export const LAB_MAX_SUSPECTS = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LabHistoryInput = {
  todayKey: string;
  activePillars: readonly Pillar[];
  objective: NutritionObjective;
  weightKg: number | null;
  /** Borne basse de protéines de l'objectif (g/kg). */
  proteinMinGPerKg: number;
  /** Calories cibles du jour type, `null` sans profil nutrition. */
  targetKcal: number | null;
  /** Borne basse de glucides d'un jour dur (FUEL-01), `null` si inconnue. */
  carbsHardMinGPerKg: number | null;
  /** Meilleur 1RM estimé par semaine, 8 semaines, de la plus ancienne à la plus récente. */
  lifts: readonly { exerciseId: string; name: string; weeks: readonly (number | null)[] }[];
  weights: readonly { dayKey: string; weightKg: number }[];
  /** Séances de qualité courues (fractionné), allure moyenne. */
  qualityRuns: readonly { dayKey: string; paceSPerKm: number }[];
  /** Séances de musculation faites, marquées « jambes lourdes » (COLLIS-01). */
  strengthDays: readonly { dayKey: string; heavyLegs: boolean }[];
  nutritionDays: readonly { dayKey: string; kcal: number; proteinG: number; carbsG: number }[];
  nights: readonly { dayKey: string; sleepMinutes: number }[];
  /** Charge d'une séance (sRPE, `sessionLoad`), muscu et course. */
  loads: readonly { dayKey: string; load: number }[];
};

export type LabQuestionKind = 'liftPlateau' | 'paceFade' | 'weightPlateau';

export type LabSuspectKind =
  | 'legsBeforeQuality'
  | 'proteinLow'
  | 'deficit'
  | 'sleepShort'
  | 'loadHigh'
  | 'weekendSurplus'
  | 'journalGaps'
  | 'carbsLowHardDays';

export type LabSuspect = {
  kind: LabSuspectKind;
  pair: LabPair;
  /** Écart ramené sur 0-1 — pas une probabilité. */
  effect: number;
  level: 'strong' | 'medium' | 'weak';
  values: Record<string, number>;
  /** La carte de l'onglet Semaine qui règle ce suspect, s'il en existe une. */
  proposal: LabProposalKind | null;
  /** L'expérience qui tranche ce suspect, s'il en existe une. */
  experiment: LabExperimentKind | null;
};

export type LabQuestion = {
  id: string;
  kind: LabQuestionKind;
  values: Record<string, number | string>;
  /** La courbe à tracer, de la plus ancienne à la plus récente (`null` = semaine sans donnée). */
  series: (number | null)[];
  /** Index du premier point « à plat », pour surligner le plateau. */
  flatFrom: number;
  suspects: LabSuspect[];
  /** Facteurs vérifiés et sans écart : l'écran les dit « écartés ». */
  cleared: LabSuspectKind[];
  /** Facteurs qu'on ne peut pas juger faute de données. */
  missing: LabSuspectKind[];
  /** Les piliers vers lesquels la scène 3D s'approche. */
  focus: LabPillar[];
  experiment: LabExperimentKind | null;
};

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const round1 = (x: number): number => Math.round(x * 10) / 10;
const mean = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

type Windows = { recentFrom: string; beforeFrom: string; todayKey: string };

function windowsOf(todayKey: string): Windows {
  const today = localDateFromDayKey(todayKey);
  return {
    todayKey,
    recentFrom: localDayKey(addDays(today, -(LAB_WINDOW_DAYS - 1))),
    beforeFrom: localDayKey(addDays(today, -(2 * LAB_WINDOW_DAYS - 1))),
  };
}

const inRecent = (w: Windows, dayKey: string) => dayKey >= w.recentFrom && dayKey <= w.todayKey;
const inBefore = (w: Windows, dayKey: string) => dayKey >= w.beforeFrom && dayKey < w.recentFrom;
const eveOf = (dayKey: string) => localDayKey(addDays(localDateFromDayKey(dayKey), -1));

function level(effect: number): LabSuspect['level'] {
  return effect >= SUSPECT_STRONG ? 'strong' : effect >= SUSPECT_MEDIUM ? 'medium' : 'weak';
}

/** Un facteur jugé : `null` = données insuffisantes, sinon sa force (0 = écarté). */
type Judged = { kind: LabSuspectKind; effect: number; values: Record<string, number> } | null;

// ---------------------------------------------------------------------------
// Les facteurs
// ---------------------------------------------------------------------------

const PAIRS: Record<LabSuspectKind, LabPair> = {
  legsBeforeQuality: ['strength', 'running'],
  proteinLow: ['nutrition', 'strength'],
  deficit: ['nutrition', 'strength'],
  sleepShort: ['sleep', 'strength'],
  loadHigh: ['strength', 'running'],
  weekendSurplus: ['nutrition', 'nutrition'],
  journalGaps: ['nutrition', 'nutrition'],
  carbsLowHardDays: ['nutrition', 'running'],
};

const LINKS: Record<LabSuspectKind, { proposal: LabProposalKind | null; experiment: LabExperimentKind | null }> = {
  legsBeforeQuality: { proposal: 'collision', experiment: 'legs48h' },
  proteinLow: { proposal: 'protein', experiment: null },
  deficit: { proposal: 'deficitVolume', experiment: null },
  sleepShort: { proposal: 'shortNight', experiment: 'earlierBedtime' },
  loadHigh: { proposal: 'loadRisk', experiment: null },
  weekendSurplus: { proposal: null, experiment: null },
  journalGaps: { proposal: null, experiment: null },
  carbsLowHardDays: { proposal: 'carbs', experiment: 'carbsHardDays' },
};

/** Jambes lourdes la veille d'une séance de qualité, sur les 3 dernières semaines. */
function legsBeforeQuality(input: LabHistoryInput, w: Windows): Judged {
  const heavy = new Set(input.strengthDays.filter((d) => d.heavyLegs).map((d) => d.dayKey));
  const recentRuns = input.qualityRuns.filter((r) => inRecent(w, r.dayKey));
  if (recentRuns.length === 0) return null;
  const count = recentRuns.filter((r) => heavy.has(eveOf(r.dayKey))).length;
  return { kind: 'legsBeforeQuality', effect: clamp01(count / 3), values: { count, runs: recentRuns.length } };
}

function nutritionWindow(input: LabHistoryInput, w: Windows) {
  return input.nutritionDays.filter((d) => inRecent(w, d.dayKey));
}

/** Protéines récentes sous la borne basse de l'objectif (un écart de 20 % vaut 1). */
function proteinLow(input: LabHistoryInput, w: Windows): Judged {
  const days = nutritionWindow(input, w);
  if (days.length < LAB_MIN_LOGGED_DAYS || input.weightKg === null) return null;
  const gPerKg = round1(mean(days.map((d) => d.proteinG)) / input.weightKg);
  const gap = (input.proteinMinGPerKg - gPerKg) / input.proteinMinGPerKg;
  return { kind: 'proteinLow', effect: clamp01(gap / 0.2), values: { gPerKg, targetMin: input.proteinMinGPerKg } };
}

/** Déficit récent au-delà de 10 % de la cible (25 % vaut 1). */
function deficit(input: LabHistoryInput, w: Windows): Judged {
  const days = nutritionWindow(input, w);
  if (days.length < LAB_MIN_LOGGED_DAYS || input.targetKcal === null) return null;
  const avg = Math.round(mean(days.map((d) => d.kcal)));
  const pct = (input.targetKcal - avg) / input.targetKcal;
  return { kind: 'deficit', effect: clamp01((pct - 0.1) / 0.15), values: { avgKcal: avg, targetKcal: input.targetKcal, deficitPct: Math.round(pct * 100) } };
}

/** Nuits récentes sous 7 h en moyenne (une heure de moins vaut 1). */
function sleepShort(input: LabHistoryInput, w: Windows): Judged {
  const nights = input.nights.filter((n) => inRecent(w, n.dayKey));
  if (nights.length < LAB_MIN_NIGHTS) return null;
  const avg = Math.round(mean(nights.map((n) => n.sleepMinutes)));
  return { kind: 'sleepShort', effect: clamp01((GOOD_NIGHT_MINUTES - avg) / 60), values: { avgMinutes: avg } };
}

/** Charge hebdomadaire récente vs la fenêtre d'avant (+10 % toléré, +40 % vaut 1). */
function loadHigh(input: LabHistoryInput, w: Windows): Judged {
  const recent = input.loads.filter((l) => inRecent(w, l.dayKey)).reduce((s, l) => s + l.load, 0);
  const before = input.loads.filter((l) => inBefore(w, l.dayKey)).reduce((s, l) => s + l.load, 0);
  if (recent <= 0 || before <= 0) return null;
  const ratio = recent / before;
  return { kind: 'loadHigh', effect: clamp01((ratio - 1.1) / 0.3), values: { changePct: Math.round((ratio - 1) * 100) } };
}

/** Week-ends au-dessus des jours de semaine (+150 kcal toléré, +600 vaut 1). */
function weekendSurplus(input: LabHistoryInput, w: Windows): Judged {
  const days = nutritionWindow(input, w);
  const isWeekend = (key: string) => [0, 6].includes(localDateFromDayKey(key).getDay());
  const weekend = days.filter((d) => isWeekend(d.dayKey));
  const weekdays = days.filter((d) => !isWeekend(d.dayKey));
  if (weekend.length < 2 || weekdays.length < LAB_MIN_LOGGED_DAYS) return null;
  const surplus = Math.round(mean(weekend.map((d) => d.kcal)) - mean(weekdays.map((d) => d.kcal)));
  return { kind: 'weekendSurplus', effect: clamp01((surplus - 150) / 450), values: { surplusKcal: surplus } };
}

/** Jours sans saisie sur les 21 derniers (2 tolérés, 8 valent 1). Toujours jugeable. */
function journalGaps(input: LabHistoryInput, w: Windows): Judged {
  const gaps = LAB_WINDOW_DAYS - nutritionWindow(input, w).length;
  return { kind: 'journalGaps', effect: clamp01((gaps - 2) / 6), values: { gaps, days: LAB_WINDOW_DAYS } };
}

/** Glucides des jours de qualité sous la borne d'un jour dur (40 % d'écart vaut 1). */
function carbsLowHardDays(input: LabHistoryInput, w: Windows): Judged {
  if (input.carbsHardMinGPerKg === null || input.weightKg === null) return null;
  const runDays = new Set(input.qualityRuns.filter((r) => inRecent(w, r.dayKey)).map((r) => r.dayKey));
  const days = input.nutritionDays.filter((d) => runDays.has(d.dayKey));
  if (days.length < 2) return null;
  const gPerKg = round1(mean(days.map((d) => d.carbsG)) / input.weightKg);
  const gap = (input.carbsHardMinGPerKg - gPerKg) / input.carbsHardMinGPerKg;
  return { kind: 'carbsLowHardDays', effect: clamp01(gap / 0.4), values: { gPerKg, targetMin: input.carbsHardMinGPerKg } };
}

/** Un facteur retenu pour une question : son nom, et son jugement (`null` = données insuffisantes). */
type Considered = { kind: LabSuspectKind; judged: Judged };

function assemble(considered: readonly Considered[], pairOf: (kind: LabSuspectKind) => LabPair = (k) => PAIRS[k]) {
  const known = considered.filter((c) => c.judged !== null).map((c) => c.judged!);
  const suspects: LabSuspect[] = known
    .filter((j) => j.effect > 0)
    // À force égale, l'ordre des facteurs de la question départage (tri stable).
    .sort((a, b) => b.effect - a.effect)
    .slice(0, LAB_MAX_SUSPECTS)
    .map((j) => ({
      kind: j.kind,
      pair: pairOf(j.kind),
      effect: Math.round(j.effect * 100) / 100,
      level: level(j.effect),
      values: j.values,
      ...LINKS[j.kind],
    }));
  const cleared = known.filter((j) => j.effect === 0).map((j) => j.kind);
  const missing = considered.filter((c) => c.judged === null).map((c) => c.kind);
  const experiment = suspects.find((s) => s.experiment !== null)?.experiment ?? null;
  const focus: LabPillar[] = suspects[0] ? uniqueFocus(suspects[0].pair) : [];
  return { suspects, cleared, missing, experiment, focus };
}

function uniqueFocus(pair: LabPair): LabPillar[] {
  return pair[0] === pair[1] ? [pair[0]] : [pair[0], pair[1]];
}

// ---------------------------------------------------------------------------
// Les questions
// ---------------------------------------------------------------------------

function liftQuestion(input: LabHistoryInput, w: Windows): LabQuestion | null {
  const has = (p: Pillar) => input.activePillars.includes(p);
  for (const lift of input.lifts) {
    const values = lift.weeks.filter((v): v is number => v !== null);
    const recent = lift.weeks.slice(-3).filter((v): v is number => v !== null);
    const before = lift.weeks.slice(0, -3).filter((v): v is number => v !== null);
    // Cinq semaines chiffrées dont au plus trois récentes : il reste toujours au moins deux semaines « avant ».
    if (values.length < LIFT_MIN_WEEKS || recent.length < 2) continue;
    const bestRecent = Math.max(...recent);
    if (bestRecent > Math.max(...before) * (1 + LIFT_PLATEAU_TOLERANCE)) continue;
    const considered: Considered[] = [
      ...(has('running') ? [{ kind: 'legsBeforeQuality' as const, judged: legsBeforeQuality(input, w) }] : []),
      ...(has('nutrition')
        ? [
            { kind: 'proteinLow' as const, judged: proteinLow(input, w) },
            { kind: 'deficit' as const, judged: deficit(input, w) },
          ]
        : []),
      { kind: 'sleepShort', judged: sleepShort(input, w) },
      { kind: 'loadHigh', judged: loadHigh(input, w) },
    ];
    const verdict = assemble(considered);
    return {
      id: `liftPlateau:${lift.exerciseId}`,
      kind: 'liftPlateau',
      values: { exerciseName: lift.name, valueKg: Math.round(bestRecent), weeksFlat: 3 },
      series: [...lift.weeks],
      flatFrom: lift.weeks.length - 3,
      ...verdict,
      focus: verdict.focus.length > 0 ? verdict.focus : ['strength'],
    };
  }
  return null;
}

function paceQuestion(input: LabHistoryInput, w: Windows): LabQuestion | null {
  const runs = [...input.qualityRuns].sort((a, b) => a.dayKey.localeCompare(b.dayKey)).slice(-8);
  if (runs.length < PACE_MIN_RUNS) return null;
  const recent = mean(runs.slice(-3).map((r) => r.paceSPerKm));
  const previous = mean(runs.slice(0, -3).map((r) => r.paceSPerKm));
  const delta = Math.round(recent - previous);
  if (delta < PACE_FADE_S_PER_KM) return null;
  const has = (p: Pillar) => input.activePillars.includes(p);
  const considered: Considered[] = [
    { kind: 'sleepShort', judged: sleepShort(input, w) },
    ...(has('strength') ? [{ kind: 'legsBeforeQuality' as const, judged: legsBeforeQuality(input, w) }] : []),
    ...(has('nutrition') ? [{ kind: 'carbsLowHardDays' as const, judged: carbsLowHardDays(input, w) }] : []),
    { kind: 'loadHigh', judged: loadHigh(input, w) },
  ];
  // Ici, le sommeil pèse sur l'allure : sa paire devient sommeil × course.
  const verdict = assemble(considered, (k) => (k === 'sleepShort' ? ['sleep', 'running'] : PAIRS[k]));
  return {
    id: 'paceFade',
    kind: 'paceFade',
    values: { recentPace: Math.round(recent), previousPace: Math.round(previous), deltaS: delta },
    series: runs.map((r) => r.paceSPerKm),
    flatFrom: runs.length - 3,
    ...verdict,
    focus: verdict.focus.length > 0 ? verdict.focus : ['running'],
  };
}

function weightQuestion(input: LabHistoryInput, w: Windows): LabQuestion | null {
  if (input.objective !== 'weightloss' && input.objective !== 'cut') return null;
  const recent = input.weights.filter((e) => inRecent(w, e.dayKey));
  if (recent.length < WEIGHT_MIN_ENTRIES) return null;
  const origin = localDateFromDayKey(w.recentFrom).getTime();
  const fit = linearRegression(
    recent.map((e) => ({ x: (localDateFromDayKey(e.dayKey).getTime() - origin) / 86_400_000, y: e.weightKg })),
  );
  // 🔴 `linearRegression` renvoie `null` quand la variance de x est nulle, et ce cas EXISTE : le
  // commentaire d'origine invoquait un index unique par jour sur `body_weight_entries` qui n'a
  // jamais été posé (`create index`, pas `create unique index`), et `logWeight` fait un
  // read-then-write que deux appareils hors ligne dédoublent. Six pesées le même jour suffisaient
  // donc à lever un TypeError — et à emporter tout l'écran du Labo.
  if (fit === null) return null;
  if (fit.slope * 7 < -WEIGHT_FLAT_KG_PER_WEEK) return null;
  const kgs = recent.map((e) => e.weightKg);
  // Deux facteurs seulement, et c'est délibéré : un poids qui ne descend plus sur un journal qui
  // affiche un déficit veut dire que le journal ne dit pas tout — c'est ce que mesurent les
  // week-ends et les jours sans saisie. Aucune expérience ici : jamais d'essai de restriction.
  const verdict = assemble([
    { kind: 'weekendSurplus', judged: weekendSurplus(input, w) },
    { kind: 'journalGaps', judged: journalGaps(input, w) },
  ]);
  return {
    id: 'weightPlateau',
    kind: 'weightPlateau',
    values: { avgKg: round1(mean(kgs.slice(-7))), rangeKg: round1(Math.max(...kgs) - Math.min(...kgs)), weeks: 3 },
    series: weeklyMeans(input.weights, w.todayKey),
    flatFrom: 5,
    ...verdict,
    focus: ['nutrition'],
    experiment: null,
  };
}

/** Moyenne des pesées par semaine glissante, 8 semaines jusqu'à aujourd'hui. */
function weeklyMeans(weights: LabHistoryInput['weights'], todayKey: string): (number | null)[] {
  const today = localDateFromDayKey(todayKey);
  return Array.from({ length: 8 }, (_, i) => {
    const to = localDayKey(addDays(today, -7 * (7 - i)));
    const from = localDayKey(addDays(today, -7 * (7 - i) - 6));
    const week = weights.filter((e) => e.dayKey >= from && e.dayKey <= to).map((e) => e.weightKg);
    return week.length > 0 ? round1(mean(week)) : null;
  });
}

/**
 * Les questions que les données posent, dans l'ordre force → course → poids. Une question par
 * courbe au plus (la première charge à plat), et seulement pour les piliers activés.
 */
export function buildLabQuestions(input: LabHistoryInput): LabQuestion[] {
  const w = windowsOf(input.todayKey);
  const has = (p: Pillar) => input.activePillars.includes(p);
  return [
    has('strength') ? liftQuestion(input, w) : null,
    has('running') ? paceQuestion(input, w) : null,
    has('nutrition') ? weightQuestion(input, w) : null,
  ].filter((q): q is LabQuestion => q !== null);
}
