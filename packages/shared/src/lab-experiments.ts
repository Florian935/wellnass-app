/**
 * US LABO-01 (roadmap 7.30) — le Labo, onglet « Acquis » : les expériences sur soi, et ce que les
 * données apprennent de la personne.
 *
 * ── Les expériences ────────────────────────────────────────────────────────────────────────────
 * Quatre semaines, **deux « essai » et deux « habitude »**, dans un ordre tiré au sort : c'est ce qui
 * sépare une expérience d'une impression (on ne choisit pas les « bonnes » semaines pour tester). Le
 * verdict reste **scellé** jusqu'au bout — le regarder en cours de route biaise ce qu'on fait des
 * semaines restantes. Une semaine « essai » où la consigne n'a pas été tenue ne compte pas pour
 * l'essai : on mesure ce qu'on a vraiment fait.
 *
 * Trois modèles seulement, tous **sans restriction** : jamais d'essai de déficit calorique, de jeûne
 * ou de complément (analyse du Labo, §9 « La sécurité »).
 *
 * ── Les acquis ─────────────────────────────────────────────────────────────────────────────────
 * Des associations mesurées sur l'historique réel, avec un **nombre de cas minimal** : sous ce seuil,
 * l'écran dit « en cours d'apprentissage » et combien de cas il manque, jamais un chiffre. « Pas de
 * lien » est un résultat à part entière. Aucune n'est présentée comme une preuve.
 */

import { addDays, localDateFromDayKey, localDayKey } from './date';
import type { LabPair, LabProposalKind } from './lab-week';
import { GOOD_NIGHT_MINUTES, SHORT_NIGHT_MINUTES } from './lab-week';
import type { Pillar } from './pillar';

// ---------------------------------------------------------------------------
// Expériences
// ---------------------------------------------------------------------------

export const LAB_EXPERIMENT_KINDS = ['legs48h', 'carbsHardDays', 'earlierBedtime'] as const;
export type LabExperimentKind = (typeof LAB_EXPERIMENT_KINDS)[number];

export const LAB_EXPERIMENT_WEEKS = 4;

export type LabExperimentArm = 'test' | 'usual';

/** Ce qu'on mesure : l'allure des séances de qualité (plus bas = mieux) ou l'énergie du check-in. */
export type LabMetric = 'qualityPace' | 'energy';

export type LabExperimentTemplate = {
  kind: LabExperimentKind;
  /** Piliers qui doivent être actifs pour proposer l'expérience. */
  requires: readonly Pillar[];
  metric: LabMetric;
  pair: LabPair;
};

export const LAB_EXPERIMENT_TEMPLATES: Record<LabExperimentKind, LabExperimentTemplate> = {
  legs48h: { kind: 'legs48h', requires: ['strength', 'running'], metric: 'qualityPace', pair: ['strength', 'running'] },
  carbsHardDays: { kind: 'carbsHardDays', requires: ['running', 'nutrition'], metric: 'qualityPace', pair: ['nutrition', 'running'] },
  earlierBedtime: { kind: 'earlierBedtime', requires: [], metric: 'energy', pair: ['sleep', 'strength'] },
};

/** Écart sous lequel on conclut « pas d'effet net » : 3 s/km d'allure, un demi-point d'énergie. */
export const LAB_EFFECT_THRESHOLD: Record<LabMetric, number> = { qualityPace: 3, energy: 0.5 };

/** Mesures nécessaires dans chaque bras pour oser un verdict. */
export const LAB_MIN_OBSERVATIONS_PER_ARM = 2;

/** Les six ordres possibles de deux « essai » et deux « habitude ». */
const ARRANGEMENTS: readonly (readonly LabExperimentArm[])[] = [
  ['test', 'test', 'usual', 'usual'],
  ['test', 'usual', 'test', 'usual'],
  ['test', 'usual', 'usual', 'test'],
  ['usual', 'test', 'test', 'usual'],
  ['usual', 'test', 'usual', 'test'],
  ['usual', 'usual', 'test', 'test'],
];

/**
 * Le tirage de l'ordre des semaines. `random` est **injecté** (∈ [0, 1[) : le tirage réel se fait
 * une fois, à la création, puis l'ordre est enregistré — un calcul qui retirerait au sort à chaque
 * rendu changerait le protocole en cours de route.
 */
export function drawExperimentSchedule(random: number): LabExperimentArm[] {
  const index = Math.min(ARRANGEMENTS.length - 1, Math.max(0, Math.floor(random * ARRANGEMENTS.length)));
  return [...ARRANGEMENTS[index]!];
}

export type LabExperimentRecord = {
  id: string;
  kind: LabExperimentKind;
  /** Lundi de la première semaine. */
  startKey: string;
  schedule: readonly LabExperimentArm[];
  /**
   * `running` : les 4 semaines courent · `finished` : elles sont passées, le verdict est rendu ·
   * `stopped` : arrêtée en route, elle ne rendra pas de verdict.
   *
   * ⚠️ `finished` est **écrit** par l'app quand la fenêtre est close, alors que `experimentProgress`
   * sait déjà le calculer par date. Ce n'est pas une redondance : c'est l'index unique de la base
   * (`where status = 'running'`) qui a besoin de le savoir, sans quoi une expérience terminée
   * garderait son modèle réservé à vie et on ne pourrait refaire un essai qu'une seule fois.
   */
  status: 'running' | 'finished' | 'stopped';
};

export type LabExperimentProgress = {
  /** Jour de l'expérience (1 à 28), 0 avant le début. */
  day: number;
  totalDays: number;
  /** Semaine en cours (0 à 3), `null` avant le début ou une fois finie. */
  weekIndex: number | null;
  arm: LabExperimentArm | null;
  finished: boolean;
  endKey: string;
};

export function experimentProgress(record: LabExperimentRecord, todayKey: string): LabExperimentProgress {
  const totalDays = LAB_EXPERIMENT_WEEKS * 7;
  const start = localDateFromDayKey(record.startKey);
  const endKey = localDayKey(addDays(start, totalDays - 1));
  const elapsed = Math.round((localDateFromDayKey(todayKey).getTime() - start.getTime()) / 86_400_000);
  const finished = todayKey > endKey;
  const running = elapsed >= 0 && !finished;
  const weekIndex = running ? Math.floor(elapsed / 7) : null;
  return {
    day: finished ? totalDays : running ? elapsed + 1 : 0,
    totalDays,
    weekIndex,
    arm: weekIndex === null ? null : record.schedule[weekIndex]!,
    finished,
    endKey,
  };
}

export type LabObservation = { dayKey: string; value: number };

export type LabVerdict =
  | { status: 'sealed'; endKey: string }
  | { status: 'stopped' }
  | { status: 'insufficient'; testCount: number; usualCount: number; needed: number }
  | { status: 'effect' | 'noEffect'; delta: number; better: boolean; testCount: number; usualCount: number };

/**
 * Le verdict. **Scellé** tant que l'expérience court. `adherence[i]` dit si la consigne de la
 * semaine `i` a été tenue : une semaine « essai » non tenue sort du bras « essai ».
 */
export function experimentVerdict(input: {
  record: LabExperimentRecord;
  todayKey: string;
  observations: readonly LabObservation[];
  adherence: readonly boolean[];
}): LabVerdict {
  const { record } = input;
  if (record.status === 'stopped') return { status: 'stopped' };
  const progress = experimentProgress(record, input.todayKey);
  if (!progress.finished) return { status: 'sealed', endKey: progress.endKey };

  const start = localDateFromDayKey(record.startKey).getTime();
  const test: number[] = [];
  const usual: number[] = [];
  for (const o of input.observations) {
    const week = Math.floor(Math.round((localDateFromDayKey(o.dayKey).getTime() - start) / 86_400_000) / 7);
    if (week < 0 || week >= LAB_EXPERIMENT_WEEKS) continue;
    const arm = record.schedule[week]!;
    if (arm === 'test' && input.adherence[week] !== true) continue;
    (arm === 'test' ? test : usual).push(o.value);
  }
  if (test.length < LAB_MIN_OBSERVATIONS_PER_ARM || usual.length < LAB_MIN_OBSERVATIONS_PER_ARM) {
    return { status: 'insufficient', testCount: test.length, usualCount: usual.length, needed: LAB_MIN_OBSERVATIONS_PER_ARM };
  }
  const metric = LAB_EXPERIMENT_TEMPLATES[record.kind].metric;
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const delta = Math.round((mean(test) - mean(usual)) * 10) / 10;
  const better = metric === 'qualityPace' ? delta < 0 : delta > 0;
  return {
    status: Math.abs(delta) >= LAB_EFFECT_THRESHOLD[metric] ? 'effect' : 'noEffect',
    delta,
    better,
    testCount: test.length,
    usualCount: usual.length,
  };
}

/**
 * La consigne de chaque semaine a-t-elle été tenue ? Mesurée sans saisie quand c'est possible :
 *  - `legs48h` : aucune séance de jambes lourdes la veille d'une séance de qualité ;
 *  - `carbsHardDays` : glucides des jours de qualité au-dessus de la borne d'un jour dur ;
 *  - `earlierBedtime` : nuits de la semaine à 7 h 30 en moyenne ou plus.
 * Les semaines « habitude » sont toujours tenues (il n'y a rien à tenir).
 */
export function experimentAdherence(input: {
  record: LabExperimentRecord;
  heavyLegDays: readonly string[];
  qualityRunDays: readonly string[];
  carbsByDay: readonly { dayKey: string; gPerKg: number }[];
  carbsHardMinGPerKg: number | null;
  nights: readonly { dayKey: string; sleepMinutes: number }[];
}): boolean[] {
  const start = localDateFromDayKey(input.record.startKey);
  return input.record.schedule.map((arm, week) => {
    if (arm === 'usual') return true;
    const from = localDayKey(addDays(start, week * 7));
    const to = localDayKey(addDays(start, week * 7 + 6));
    const within = (key: string) => key >= from && key <= to;
    const runs = input.qualityRunDays.filter(within);
    if (input.record.kind === 'legs48h') {
      const heavy = new Set(input.heavyLegDays);
      return runs.every((day) => !heavy.has(localDayKey(addDays(localDateFromDayKey(day), -1))));
    }
    if (input.record.kind === 'carbsHardDays') {
      const days = input.carbsByDay.filter((d) => runs.includes(d.dayKey));
      return input.carbsHardMinGPerKg !== null && days.length > 0 && days.every((d) => d.gPerKg >= input.carbsHardMinGPerKg!);
    }
    const nights = input.nights.filter((n) => within(n.dayKey));
    return nights.length > 0 && nights.reduce((s, n) => s + n.sleepMinutes, 0) / nights.length >= GOOD_NIGHT_MINUTES + 30;
  });
}

// ---------------------------------------------------------------------------
// Acquis : les associations apprises
// ---------------------------------------------------------------------------

export const LAB_ASSOCIATION_KINDS = ['shortNightPace', 'heavyLegsPace', 'carbsPace'] as const;
export type LabAssociationKind = (typeof LAB_ASSOCIATION_KINDS)[number];

/** Cas nécessaires de chaque côté pour dire quelque chose. */
export const LAB_ASSOCIATION_MIN_CASES = 3;
/** Au-delà, avec deux fois le minimum de cas, l'association est « solide ». */
export const LAB_ASSOCIATION_SOLID_CASES = 6;
/** Écart d'allure (s/km) sous lequel on conclut « pas de lien ». */
export const LAB_ASSOCIATION_NO_LINK_S = 2;

export type LabKnowledgeStatus = 'verified' | 'contrary' | 'noEffect' | 'inconclusive' | 'solid' | 'probable' | 'noLink' | 'learning';

export type LabKnowledgeCard = {
  id: string;
  source: 'experiment' | 'association';
  kind: LabExperimentKind | LabAssociationKind;
  status: LabKnowledgeStatus;
  pair: LabPair;
  values: Record<string, number>;
  /** La proposition de l'onglet Semaine qui s'appuie sur cet acquis, s'il y en a une. */
  usedBy: LabProposalKind | null;
};

const ASSOCIATION_META: Record<LabAssociationKind, { pair: LabPair; usedBy: LabProposalKind }> = {
  shortNightPace: { pair: ['sleep', 'running'], usedBy: 'shortNight' },
  heavyLegsPace: { pair: ['strength', 'running'], usedBy: 'collision' },
  carbsPace: { pair: ['nutrition', 'running'], usedBy: 'carbs' },
};

/** Compare l'allure des séances « exposées » à celle des autres. Écart positif = plus lent exposé. */
function association(kind: LabAssociationKind, exposed: number[], other: number[]): LabKnowledgeCard {
  const { pair, usedBy } = ASSOCIATION_META[kind];
  const base = { id: `association:${kind}`, source: 'association' as const, kind, pair, usedBy };
  const cases = Math.min(exposed.length, other.length);
  if (cases < LAB_ASSOCIATION_MIN_CASES) {
    return { ...base, status: 'learning', values: { cases, needed: LAB_ASSOCIATION_MIN_CASES } };
  }
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const delta = Math.round(mean(exposed) - mean(other));
  const status: LabKnowledgeStatus =
    Math.abs(delta) < LAB_ASSOCIATION_NO_LINK_S ? 'noLink' : cases >= LAB_ASSOCIATION_SOLID_CASES ? 'solid' : 'probable';
  return { ...base, status, values: { delta, exposed: exposed.length, other: other.length } };
}

export function buildLabKnowledge(input: {
  activePillars: readonly Pillar[];
  weightKg: number | null;
  carbsHardMinGPerKg: number | null;
  qualityRuns: readonly { dayKey: string; paceSPerKm: number }[];
  nights: readonly { dayKey: string; sleepMinutes: number }[];
  heavyLegDays: readonly string[];
  carbsByDay: readonly { dayKey: string; carbsG: number }[];
  experiments: readonly { record: LabExperimentRecord; verdict: LabVerdict }[];
}): LabKnowledgeCard[] {
  const has = (p: Pillar) => input.activePillars.includes(p);
  const cards: LabKnowledgeCard[] = [];

  for (const { record, verdict } of input.experiments) {
    if (verdict.status === 'sealed' || verdict.status === 'stopped') continue;
    const template = LAB_EXPERIMENT_TEMPLATES[record.kind];
    const status: LabKnowledgeStatus =
      verdict.status === 'insufficient' ? 'inconclusive' : verdict.status === 'noEffect' ? 'noEffect' : verdict.better ? 'verified' : 'contrary';
    cards.push({
      id: `experiment:${record.id}`,
      source: 'experiment',
      kind: record.kind,
      status,
      pair: template.pair,
      values: verdict.status === 'insufficient' ? { testCount: verdict.testCount, usualCount: verdict.usualCount } : { delta: verdict.delta },
      usedBy: null,
    });
  }

  if (has('running')) {
    const nightBefore = new Map(input.nights.map((n) => [n.dayKey, n.sleepMinutes]));
    const withNight = input.qualityRuns.filter((r) => nightBefore.has(r.dayKey));
    cards.push(
      association(
        'shortNightPace',
        withNight.filter((r) => nightBefore.get(r.dayKey)! < SHORT_NIGHT_MINUTES).map((r) => r.paceSPerKm),
        withNight.filter((r) => nightBefore.get(r.dayKey)! >= GOOD_NIGHT_MINUTES).map((r) => r.paceSPerKm),
      ),
    );
    if (has('strength')) {
      const heavy = new Set(input.heavyLegDays);
      const eve = (day: string) => localDayKey(addDays(localDateFromDayKey(day), -1));
      cards.push(
        association(
          'heavyLegsPace',
          input.qualityRuns.filter((r) => heavy.has(eve(r.dayKey))).map((r) => r.paceSPerKm),
          input.qualityRuns.filter((r) => !heavy.has(eve(r.dayKey))).map((r) => r.paceSPerKm),
        ),
      );
    }
    if (has('nutrition') && input.carbsHardMinGPerKg !== null && input.weightKg !== null) {
      const carbs = new Map(input.carbsByDay.map((d) => [d.dayKey, d.carbsG / input.weightKg!]));
      const logged = input.qualityRuns.filter((r) => carbs.has(r.dayKey));
      cards.push(
        association(
          'carbsPace',
          logged.filter((r) => carbs.get(r.dayKey)! < input.carbsHardMinGPerKg!).map((r) => r.paceSPerKm),
          logged.filter((r) => carbs.get(r.dayKey)! >= input.carbsHardMinGPerKg!).map((r) => r.paceSPerKm),
        ),
      );
    }
  }
  return cards;
}
