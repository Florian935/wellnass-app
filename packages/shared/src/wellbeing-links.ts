/**
 * US BIEN-05 — ce que ton état du jour explique de tes piliers, et l'inverse.
 *
 * ── Pourquoi ce fichier ──────────────────────────────────────────────────────────────────────────
 * Le pilier Bien-être recueille chaque jour la nuit, l'énergie, l'envie, l'humeur, le stress et le
 * contexte. Ces signaux n'ont de valeur que **croisés** : « après une nuit courte, ton tonnage baisse
 * de 9 % », « les jours où tu t'entraînes, ton humeur du soir est plus haute ». Ce module calcule ces
 * croisements **sur les données de l'utilisateur, en local**, et dit pour chacun s'il tient.
 *
 * ── Ce qu'il dit, et comment (règles de la planche « Croisements » validée le 01/10/2026) ───────
 *  1. **« Va souvent avec », jamais « parce que ».** Le module compare deux groupes de jours ; il ne
 *     prétend pas qu'une chose cause l'autre. Les textes affichés tiennent cette règle.
 *  2. **Toujours le nombre de cas**, et un seuil sous lequel on ne parle pas : `WELLBEING_LINK_MIN_CASES`
 *     jours **de chaque côté**. En dessous, le lien est « à apprendre », avec la jauge de ce qui manque.
 *  3. **Les pistes écartées s'affichent** : un écart trop faible sur assez de cas est un résultat
 *     (« rien de visible »), pas un silence.
 *  4. **Aucune lecture d'horloge** : `todayKey` entre par paramètre.
 *
 * Le registre des liens du Labo (LIENS-01) en fait **un** lien, « Ton état du jour pèse-t-il sur tes
 * séances ? », dont chaque croisement ci-dessous est une ligne (`cross-links.ts`). Les croisements
 * internes au pilier (caféine → nuit, alcool → nuit) restent dans l'onglet « Ce qui compte ».
 */

import { addDays, daysBetween, localDateFromDayKey, localDayKey } from './date';
import type { Pillar } from './pillar';
import { isAlcoholDrinks, isPoorNight, isSleepMinutes, isWellbeingLevel, type LocalWellbeing } from './wellbeing';

export const WELLBEING_LINK_IDS = [
  'nightStrength', // Après une nuit courte ou agitée, ta séance de muscu
  'nightRunning', // … ton allure, à effort égal
  'nightIntake', // … ce que tu manges
  'motivationTraining', // Envie faible le matin → séance faite ce jour-là ?
  'stressJournal', // Journée stressée → journal nutrition complet ?
  'trainingMood', // S'entraîner → humeur du soir
  'alcoholRunning', // Deux verres ou plus la veille → allure du lendemain
  'alcoholNight', // Deux verres ou plus → nuit suivante (interne au pilier)
  'caffeineNight', // Café après 16 h → nuit suivante (interne au pilier)
] as const;
export type WellbeingLinkId = (typeof WELLBEING_LINK_IDS)[number];

/** Même vocabulaire que les acquis du Labo (`LabKnowledgeCard.status`). */
export type WellbeingLinkStatus = 'learning' | 'noLink' | 'probable' | 'solid';

export type WellbeingLinkUnit = 'pct' | 'secPerKm' | 'kcal' | 'points' | 'pctPoints' | 'minutes';

/** Jours regardés. Assez pour réunir 8 nuits courtes chez quelqu'un qui en a une par semaine. */
export const WELLBEING_LINKS_WINDOW_DAYS = 90;
/** Cas minimaux **de chaque côté** avant de dire quoi que ce soit. */
export const WELLBEING_LINK_MIN_CASES = 8;
/** Au-delà, de chaque côté, une piste est « solide » plutôt que « probable ». */
export const WELLBEING_LINK_SOLID_CASES = 14;
/** Séances minimales d'un même type (ou d'un même effort) pour en tirer une référence. */
export const WELLBEING_LINK_MIN_BASELINE = 3;

/**
 * L'écart sous lequel on dit « rien de visible ». Choisis pour être **au-dessus du bruit** d'une
 * semaine ordinaire : 5 % de tonnage, 5 s/km, 150 kcal, 0,4 point d'humeur, 15 points de pourcentage,
 * 20 minutes de sommeil. Nommés pour être rediscutés en recette, pas enfouis dans le calcul.
 */
export const WELLBEING_LINK_THRESHOLDS: Record<WellbeingLinkUnit, number> = {
  pct: 5,
  secPerKm: 5,
  kcal: 150,
  points: 0.4,
  pctPoints: 15,
  minutes: 20,
};

export type WellbeingLinkScope = 'cross' | 'intra';

type Definition = {
  scope: WellbeingLinkScope;
  unit: WellbeingLinkUnit;
  /** Le pilier dont le lien mesure le résultat ; vide pour un lien interne au bien-être. */
  pillars: readonly Pillar[];
  /** `true` si un écart **négatif** est défavorable (moins de tonnage, moins de séances…). */
  lowerIsWorse: boolean;
  available: (ctx: { activePillars: readonly Pillar[]; modules: WellbeingLinkModules }) => boolean;
};

export type WellbeingLinkModules = { alcohol: boolean; caffeine: boolean };

const has = (a: readonly Pillar[], p: Pillar) => a.includes(p);

export const WELLBEING_LINKS: Record<WellbeingLinkId, Definition> = {
  nightStrength: { scope: 'cross', unit: 'pct', pillars: ['strength'], lowerIsWorse: true, available: ({ activePillars: a }) => has(a, 'strength') },
  nightRunning: { scope: 'cross', unit: 'secPerKm', pillars: ['running'], lowerIsWorse: false, available: ({ activePillars: a }) => has(a, 'running') },
  nightIntake: { scope: 'cross', unit: 'kcal', pillars: ['nutrition'], lowerIsWorse: false, available: ({ activePillars: a }) => has(a, 'nutrition') },
  motivationTraining: {
    scope: 'cross',
    unit: 'pctPoints',
    pillars: ['strength', 'running'],
    lowerIsWorse: true,
    available: ({ activePillars: a }) => has(a, 'strength') || has(a, 'running'),
  },
  stressJournal: { scope: 'cross', unit: 'pctPoints', pillars: ['nutrition'], lowerIsWorse: true, available: ({ activePillars: a }) => has(a, 'nutrition') },
  trainingMood: {
    scope: 'cross',
    unit: 'points',
    pillars: ['strength', 'running'],
    lowerIsWorse: true,
    available: ({ activePillars: a }) => has(a, 'strength') || has(a, 'running'),
  },
  alcoholRunning: {
    scope: 'cross',
    unit: 'secPerKm',
    pillars: ['running'],
    lowerIsWorse: false,
    available: ({ activePillars: a, modules }) => modules.alcohol && has(a, 'running'),
  },
  alcoholNight: { scope: 'intra', unit: 'minutes', pillars: [], lowerIsWorse: true, available: ({ modules }) => modules.alcohol },
  caffeineNight: { scope: 'intra', unit: 'minutes', pillars: [], lowerIsWorse: true, available: ({ modules }) => modules.caffeine },
};

export type WellbeingLink = {
  id: WellbeingLinkId;
  scope: WellbeingLinkScope;
  unit: WellbeingLinkUnit;
  pillars: readonly Pillar[];
  status: WellbeingLinkStatus;
  /** Groupe « exposé » moins groupe « autre », arrondi. `null` tant qu'on apprend. */
  delta: number | null;
  /** Cas de chaque côté — affichés à chaque fois (règle 2). */
  exposed: number;
  other: number;
  /** Le seuil de cas, pour la jauge « 5 sur 8 ». */
  need: number;
  /**
   * Le sens de l'écart pour l'utilisateur : `true` si le groupe exposé fait **moins bien**. `null`
   * tant qu'on apprend ou que rien n'est visible — un « rien » n'a pas de sens.
   */
  adverse: boolean | null;
};

export type WellbeingLinksInput = {
  todayKey: string;
  checkins: readonly LocalWellbeing[];
  /** Séances de musculation terminées : tonnage et une clé de comparaison (template, ou nom). */
  strength: readonly { dayKey: string; tonnage: number; groupKey: string }[];
  /** Courses : allure moyenne (s/km) et effort perçu (`null` si non saisi). */
  runs: readonly { dayKey: string; paceSPerKm: number; rpe: number | null }[];
  /** Jours où le journal nutrition porte au moins une entrée, avec le total du jour. */
  intake: readonly { dayKey: string; kcal: number }[];
  /** Jours où une séance, une course ou une activité a été faite. */
  trainingDays: readonly string[];
  activePillars: readonly Pillar[];
  modules: WellbeingLinkModules;
};

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

function roundFor(unit: WellbeingLinkUnit, x: number): number {
  if (unit === 'points') return Math.round(x * 10) / 10;
  if (unit === 'kcal') return Math.round(x / 10) * 10;
  return Math.round(x);
}

function shiftKey(dayKey: string, n: number): string {
  return localDayKey(addDays(localDateFromDayKey(dayKey), n));
}

/** Classe un écart entre deux groupes (règles 2 et 3). */
export function compareGroups(
  exposed: readonly number[],
  other: readonly number[],
  unit: WellbeingLinkUnit,
  lowerIsWorse: boolean,
): Pick<WellbeingLink, 'status' | 'delta' | 'exposed' | 'other' | 'need' | 'adverse'> {
  const base = { exposed: exposed.length, other: other.length, need: WELLBEING_LINK_MIN_CASES };
  if (exposed.length < WELLBEING_LINK_MIN_CASES || other.length < WELLBEING_LINK_MIN_CASES) {
    return { ...base, status: 'learning', delta: null, adverse: null };
  }
  const raw = mean(exposed) - mean(other);
  const delta = roundFor(unit, raw);
  if (Math.abs(raw) < WELLBEING_LINK_THRESHOLDS[unit]) {
    return { ...base, status: 'noLink', delta, adverse: null };
  }
  const solid = exposed.length >= WELLBEING_LINK_SOLID_CASES && other.length >= WELLBEING_LINK_SOLID_CASES;
  return { ...base, status: solid ? 'solid' : 'probable', delta, adverse: lowerIsWorse ? raw < 0 : raw > 0 };
}

// ---------------------------------------------------------------------------
// Le calcul
// ---------------------------------------------------------------------------

/** Les jours de la fenêtre, `today` compris ou non selon que le résultat a besoin d'une journée finie. */
function inWindow(dayKey: string, todayKey: string, includeToday: boolean): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return false;
  const age = daysBetween(dayKey, todayKey);
  return age >= (includeToday ? 0 : 1) && age < WELLBEING_LINKS_WINDOW_DAYS;
}

/**
 * Les croisements disponibles pour cet utilisateur, dans l'ordre du registre.
 *
 * Un croisement dont le pilier (ou le module) n'est pas activé **n'existe pas** — même règle que les
 * liens du Labo (décision H) : ni « à apprendre », ni grisé.
 */
export function buildWellbeingLinks(input: WellbeingLinksInput): WellbeingLink[] {
  const { todayKey } = input;
  const byDay = new Map<string, LocalWellbeing>();
  for (const row of input.checkins) {
    if (row.deletedAt != null) continue;
    byDay.set(row.logDate, row);
  }
  const night = (dayKey: string) => isPoorNight(byDay.get(dayKey) ?? null);
  const trained = new Set(input.trainingDays);
  const intakeByDay = new Map(input.intake.map((d) => [d.dayKey, d.kcal]));

  // Références : tonnage médian par type de séance, allure médiane par niveau d'effort, apport médian.
  const strength = input.strength.filter((s) => inWindow(s.dayKey, todayKey, true) && s.tonnage > 0);
  const tonnageGroups = new Map<string, number[]>();
  for (const s of strength) tonnageGroups.set(s.groupKey, [...(tonnageGroups.get(s.groupKey) ?? []), s.tonnage]);
  const tonnageRef = new Map<string, number>();
  for (const [key, values] of tonnageGroups) if (values.length >= WELLBEING_LINK_MIN_BASELINE) tonnageRef.set(key, median(values));

  // Une allure hors de 2 min/km — 20 min/km est une erreur de trace ou une marche, pas une course.
  const runs = input.runs.filter(
    (r) => inWindow(r.dayKey, todayKey, true) && Number.isFinite(r.paceSPerKm) && r.paceSPerKm >= 120 && r.paceSPerKm <= 1200 && r.rpe !== null,
  );
  const paceGroups = new Map<number, number[]>();
  for (const r of runs) paceGroups.set(r.rpe as number, [...(paceGroups.get(r.rpe as number) ?? []), r.paceSPerKm]);
  const paceRef = new Map<number, number>();
  for (const [rpe, values] of paceGroups) if (values.length >= WELLBEING_LINK_MIN_BASELINE) paceRef.set(rpe, median(values));

  const intakeDays = input.intake.filter((d) => inWindow(d.dayKey, todayKey, false) && d.kcal > 0);
  const intakeRef = intakeDays.length >= WELLBEING_LINK_MIN_BASELINE ? median(intakeDays.map((d) => d.kcal)) : null;

  const pastCheckins = [...byDay.values()].filter((row) => inWindow(row.logDate, todayKey, false));

  const values: Record<WellbeingLinkId, { exposed: number[]; other: number[] }> = {
    nightStrength: { exposed: [], other: [] },
    nightRunning: { exposed: [], other: [] },
    nightIntake: { exposed: [], other: [] },
    motivationTraining: { exposed: [], other: [] },
    stressJournal: { exposed: [], other: [] },
    trainingMood: { exposed: [], other: [] },
    alcoholRunning: { exposed: [], other: [] },
    alcoholNight: { exposed: [], other: [] },
    caffeineNight: { exposed: [], other: [] },
  };
  const push = (id: WellbeingLinkId, isExposed: boolean, value: number) =>
    (isExposed ? values[id].exposed : values[id].other).push(value);

  // Nuit → séance de muscu du jour : tonnage relatif à la référence de CE type de séance.
  for (const s of strength) {
    const ref = tonnageRef.get(s.groupKey);
    const poor = night(s.dayKey);
    if (ref === undefined || ref <= 0 || poor === null) continue;
    push('nightStrength', poor, (s.tonnage / ref - 1) * 100);
  }

  // Nuit → allure, à effort égal ; alcool de la veille → allure.
  for (const r of runs) {
    const ref = paceRef.get(r.rpe as number);
    if (ref === undefined) continue;
    const gap = r.paceSPerKm - ref;
    const poor = night(r.dayKey);
    if (poor !== null) push('nightRunning', poor, gap);
    const drinks = byDay.get(shiftKey(r.dayKey, -1))?.alcoholDrinks;
    if (isAlcoholDrinks(drinks) && drinks !== 1) push('alcoholRunning', drinks >= 2, gap);
  }

  // Nuit → apports de la journée (journée finie seulement).
  if (intakeRef !== null) {
    for (const d of intakeDays) {
      const poor = night(d.dayKey);
      if (poor !== null) push('nightIntake', poor, d.kcal - intakeRef);
    }
  }

  for (const row of pastCheckins) {
    const day = row.logDate;
    // Envie du matin → une séance ce jour-là ? (1-2 contre 4-5 ; le 3 ne tranche rien)
    if (isWellbeingLevel(row.motivation) && row.motivation !== 3) {
      push('motivationTraining', row.motivation <= 2, trained.has(day) ? 100 : 0);
    }
    // Stress du jour → journal nutrition tenu ce jour-là ? (4-5 contre 1-2)
    if (isWellbeingLevel(row.stress) && row.stress !== 3) {
      push('stressJournal', row.stress >= 4, intakeByDay.has(day) ? 100 : 0);
    }
    // S'entraîner → humeur du soir (exposé = jour d'entraînement).
    if (isWellbeingLevel(row.mood)) push('trainingMood', trained.has(day), row.mood);
    // Soirée arrosée, café tardif → la nuit suivante.
    const nextSleep = byDay.get(shiftKey(day, 1))?.sleepMinutes;
    if (isSleepMinutes(nextSleep)) {
      if (isAlcoholDrinks(row.alcoholDrinks) && row.alcoholDrinks !== 1) push('alcoholNight', row.alcoholDrinks >= 2, nextSleep);
      if (typeof row.lateCaffeine === 'boolean') push('caffeineNight', row.lateCaffeine, nextSleep);
    }
  }

  const ctx = { activePillars: input.activePillars, modules: input.modules };
  return WELLBEING_LINK_IDS.filter((id) => WELLBEING_LINKS[id].available(ctx)).map((id) => {
    const def = WELLBEING_LINKS[id];
    const v = values[id];
    return { id, scope: def.scope, unit: def.unit, pillars: def.pillars, ...compareGroups(v.exposed, v.other, def.unit, def.lowerIsWorse) };
  });
}

/** Nuits courtes ou agitées parmi les `days` derniers matins renseignés (aujourd'hui compris). */
export function recentPoorNights(checkins: readonly LocalWellbeing[], todayKey: string, days = 7): { poor: number; known: number } {
  let poor = 0;
  let known = 0;
  for (const row of checkins) {
    if (row.deletedAt != null || !/^\d{4}-\d{2}-\d{2}$/.test(row.logDate)) continue;
    const age = daysBetween(row.logDate, todayKey);
    if (age < 0 || age >= days) continue;
    const p = isPoorNight(row);
    if (p === null) continue;
    known += 1;
    if (p) poor += 1;
  }
  return { poor, known };
}

/** Un lien qui dit quelque chose (« probable » ou « solide »). */
export function isKnownLink(link: WellbeingLink): boolean {
  return link.status === 'probable' || link.status === 'solid';
}

/** Les cas déjà réunis du côté le plus maigre — la jauge « 5 sur 8 » d'un lien à apprendre. */
export function linkProgress(link: WellbeingLink): number {
  return Math.min(link.exposed, link.other);
}
