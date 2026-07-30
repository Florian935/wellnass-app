import { z } from 'zod';
import { addDays, localDateFromDayKey, daysBetween, localDayKey } from './date';

/**
 * Domaine du suivi de cycle menstruel (US CYCLE-01) — **calculs purs uniquement**.
 *
 * ⚠️ **Aucune fonction de ce fichier ne produit de phrase.** Elles renvoient des nombres et des
 * états ; tous les libellés vivent dans l'i18n. Ce n'est pas une préférence de style : sur un sujet
 * où une formulation ambiguë peut se lire comme un conseil médical ou une garantie contraceptive,
 * c'est ce qui permet de **relire toutes les formulations d'un coup** (spec §0, critère de recette 14)
 * au lieu de les traquer au milieu du calcul.
 *
 * Réf. : docs/specs/functional/us/cycle01-suivi-menstruel.md
 */

// ---------------------------------------------------------------------------
// Vocabulaire — listes fermées (R7)
// ---------------------------------------------------------------------------

export const MENSTRUAL_FLOWS = ['spotting', 'light', 'medium', 'heavy'] as const;
export const menstrualFlowSchema = z.enum(MENSTRUAL_FLOWS);
export type MenstrualFlow = z.infer<typeof menstrualFlowSchema>;

/**
 * Symptômes : **liste fermée et courte**, aucun champ libre (R7). Un texte libre dans une donnée de
 * santé sensible est un risque disproportionné pour un gain nul — et il ne serait ni traduisible,
 * ni exploitable en croisement.
 */
export const MENSTRUAL_SYMPTOMS = [
  'cramps',
  'headache',
  'fatigue',
  'bloating',
  'breast_tenderness',
  'mood_swings',
  'acne',
  'cravings',
] as const;
export const menstrualSymptomSchema = z.enum(MENSTRUAL_SYMPTOMS);
export type MenstrualSymptom = z.infer<typeof menstrualSymptomSchema>;

export const CYCLE_PHASES = ['menstrual', 'follicular', 'ovulatory', 'luteal'] as const;
export const cyclePhaseSchema = z.enum(CYCLE_PHASES);
export type CyclePhase = z.infer<typeof cyclePhaseSchema>;

// ---------------------------------------------------------------------------
// Seuils — tous nommés, aucun nombre magique dans le code
// ---------------------------------------------------------------------------

/** R3 — au-delà, une période ouverte est close d'office (oubli de saisie, pas un fait médical). */
export const MAX_PERIOD_DAYS = 15;

/** R6 — bornes de plausibilité d'un cycle. Hors bornes = exclu du calcul, jamais effacé. */
export const MIN_PLAUSIBLE_CYCLE_DAYS = 15;
export const MAX_PLAUSIBLE_CYCLE_DAYS = 90;

/** R8 — en dessous, aucune estimation : 2 débuts ne donnent qu'un intervalle, donc aucune idée de
 *  la régularité. */
export const MIN_CYCLES_FOR_PREDICTION = 3;

/** R10 — au-delà de cette dispersion, on n'affiche **pas** de date. Se taire vaut mieux qu'une date
 *  fausse présentée comme une prévision. */
export const MAX_STDDEV_FOR_PREDICTION = 7;

/** R13 — seuils du croisement, vérifiés **par métrique**. */
export const MIN_CYCLES_FOR_INSIGHTS = 3;
export const MIN_SAMPLES_PER_PHASE = 10;

/** Nombre de jours entre l'ovulation et le début du cycle suivant (phase lutéale, stable). */
const LUTEAL_PHASE_DAYS = 14;
/** Demi-largeur de la fenêtre ovulatoire, en jours. */
const OVULATORY_HALF_WINDOW = 2;

// ---------------------------------------------------------------------------
// Types de domaine
// ---------------------------------------------------------------------------

/** Une période de règles. `endedOn: null` = **en cours** (état normal, pas donnée manquante). */
export type MenstrualPeriod = {
  id: string;
  /** AAAA-MM-JJ, local. */
  startedOn: string;
  /** AAAA-MM-JJ, local, ou `null` si la période est en cours. */
  endedOn: string | null;
};

export type CycleLength = { startedOn: string; length: number };

// ---------------------------------------------------------------------------
// Tri
// ---------------------------------------------------------------------------

/** Copie triée par date de début croissante. Toutes les fonctions trient : l'ordre d'arrivée du
 *  repository ne doit jamais changer un résultat. */
function sortedByStart(periods: readonly MenstrualPeriod[]): MenstrualPeriod[] {
  return [...periods].sort((a, b) => a.startedOn.localeCompare(b.startedOn));
}

// ---------------------------------------------------------------------------
// R2 — une seule période en cours à la fois
// ---------------------------------------------------------------------------

/**
 * Clôtures à appliquer avant d'enregistrer un nouveau début à `newStartKey`.
 *
 * Sans cette règle, un oubli de « fin » laisse deux périodes ouvertes et fausse **silencieusement**
 * toutes les longueurs de cycle — donc la moyenne, donc la prédiction. La période ouverte est close
 * **la veille** du nouveau début.
 *
 * Une période ouverte qui commencerait *après* le nouveau début est ignorée : c'est le cas d'une
 * saisie rétroactive, qui ne doit pas clore un cycle plus récent.
 */
export function closeOpenPeriodsFor(
  periods: readonly MenstrualPeriod[],
  newStartKey: string,
): { id: string; endedOn: string }[] {
  return periods
    .filter((p) => p.endedOn === null && p.startedOn < newStartKey)
    .map((p) => ({
      id: p.id,
      endedOn: localDayKey(addDays(localDateFromDayKey(newStartKey), -1)),
    }));
}

// ---------------------------------------------------------------------------
// R3 — clôture automatique des périodes trop longues
// ---------------------------------------------------------------------------

/**
 * Périodes ouvertes depuis plus de `MAX_PERIOD_DAYS` jours, à clore d'office.
 *
 * `flagged` marque la ligne comme « à vérifier » côté UI : la clôture est une **correction de
 * saisie**, pas un constat médical, et l'utilisatrice doit pouvoir la corriger.
 */
export function staleOpenPeriods(
  periods: readonly MenstrualPeriod[],
  todayKey: string,
): { id: string; endedOn: string; flagged: true }[] {
  return periods
    .filter((p) => p.endedOn === null && daysBetween(p.startedOn, todayKey) + 1 > MAX_PERIOD_DAYS)
    .map((p) => ({
      id: p.id,
      endedOn: localDayKey(addDays(localDateFromDayKey(p.startedOn), MAX_PERIOD_DAYS - 1)),
      flagged: true as const,
    }));
}

// ---------------------------------------------------------------------------
// R5 — longueur d'un cycle = début → début
// ---------------------------------------------------------------------------

/**
 * Longueurs des cycles, **mesurées d'un début au début suivant** — jamais d'une fin à un début.
 * C'est la définition usuelle, et la seule qui rende la valeur interprétable.
 *
 * La dernière période n'a pas de longueur : le cycle qu'elle ouvre n'est pas terminé.
 */
export function cycleLengths(periods: readonly MenstrualPeriod[]): CycleLength[] {
  const sorted = sortedByStart(periods);
  const out: CycleLength[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i]!;
    const to = sorted[i + 1]!;
    out.push({ startedOn: from.startedOn, length: daysBetween(from.startedOn, to.startedOn) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// R6 — aberrants exclus du calcul, jamais effacés
// ---------------------------------------------------------------------------

/**
 * Sépare les cycles exploitables de ceux qui ne le sont pas (saisie erronée, aménorrhée,
 * post-partum…). Les seconds sont **restitués**, pas jetés : l'app ne réécrit jamais ce que
 * l'utilisatrice a saisi, elle explique seulement ce qu'elle ne sait pas exploiter.
 */
export function usableCycleLengths(lengths: readonly CycleLength[]): {
  usable: CycleLength[];
  ignored: CycleLength[];
} {
  const usable: CycleLength[] = [];
  const ignored: CycleLength[] = [];
  for (const c of lengths) {
    if (c.length >= MIN_PLAUSIBLE_CYCLE_DAYS && c.length <= MAX_PLAUSIBLE_CYCLE_DAYS) usable.push(c);
    else ignored.push(c);
  }
  return { usable, ignored };
}

// ---------------------------------------------------------------------------
// R8 / R9 / R10 — prédiction
// ---------------------------------------------------------------------------

export type CyclePrediction =
  | { status: 'insufficient'; cyclesAvailable: number; cyclesNeeded: number }
  | { status: 'irregular'; minLength: number; maxLength: number; stdDev: number; cyclesUsed: number }
  | {
      status: 'ready';
      /** AAAA-MM-JJ. Peut être **dans le passé** : on ne signale jamais un retard (R11). */
      predictedOn: string;
      /** Demi-largeur de la fourchette, en jours. Toujours ≥ 1 : une date nue serait une promesse. */
      marginDays: number;
      averageLength: number;
      cyclesUsed: number;
    };

function mean(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdDev(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/**
 * Estimation du prochain début.
 *
 * Trois issues, et **aucune n'est une erreur** — ce sont trois états d'affichage à part entière :
 *  - `insufficient` : moins de 3 cycles exploitables (R8) ;
 *  - `irregular`    : dispersion > `MAX_STDDEV_FOR_PREDICTION` → **aucune date** (R10) ;
 *  - `ready`        : une date **et** sa fourchette (R9).
 *
 * ⚠️ Une date déjà dépassée est rendue telle quelle. Signaler un retard transformerait un carnet en
 * outil anxiogène, voire en substitut de test — c'est explicitement exclu (R11).
 */
export function predictNextPeriod(
  periods: readonly MenstrualPeriod[],
  _todayKey: string,
): CyclePrediction {
  const sorted = sortedByStart(periods);
  const { usable } = usableCycleLengths(cycleLengths(sorted));

  if (usable.length < MIN_CYCLES_FOR_PREDICTION) {
    return {
      status: 'insufficient',
      cyclesAvailable: usable.length,
      cyclesNeeded: MIN_CYCLES_FOR_PREDICTION,
    };
  }

  const lengths = usable.map((c) => c.length);
  const dispersion = stdDev(lengths);

  if (dispersion > MAX_STDDEV_FOR_PREDICTION) {
    return {
      status: 'irregular',
      minLength: Math.min(...lengths),
      maxLength: Math.max(...lengths),
      stdDev: Math.round(dispersion * 10) / 10,
      cyclesUsed: lengths.length,
    };
  }

  const averageLength = Math.round(mean(lengths));
  const lastStart = sorted[sorted.length - 1]!.startedOn;
  return {
    status: 'ready',
    predictedOn: localDayKey(addDays(localDateFromDayKey(lastStart), averageLength)),
    // Plancher à 1 jour : même sur des cycles parfaitement réguliers, annoncer une date **sans**
    // fourchette la ferait lire comme une certitude.
    marginDays: Math.max(1, Math.round(dispersion)),
    averageLength,
    cyclesUsed: lengths.length,
  };
}

// ---------------------------------------------------------------------------
// R12 — phases
// ---------------------------------------------------------------------------

/** Période la plus récente ayant commencé au plus tard à `dateKey`. */
function periodCovering(
  dateKey: string,
  periods: readonly MenstrualPeriod[],
): MenstrualPeriod | null {
  const candidates = sortedByStart(periods).filter((p) => p.startedOn <= dateKey);
  return candidates.length > 0 ? candidates[candidates.length - 1]! : null;
}

/**
 * Jour du cycle (**J1 = premier jour des règles**, pas J0), ou `null` si `dateKey` précède toute
 * période connue — on n'invente pas un jour de cycle sur une date sans repère.
 */
export function cycleDayFor(dateKey: string, periods: readonly MenstrualPeriod[]): number | null {
  const current = periodCovering(dateKey, periods);
  if (current === null) return null;
  return daysBetween(current.startedOn, dateKey) + 1;
}

/**
 * Phase du cycle à une date donnée, ou `null` quand elle ne peut pas être affirmée.
 *
 * `null` est un résultat **normal et fréquent** : avant toute période connue, au-delà d'un cycle
 * invraisemblable (données périmées), ou hors phase menstruelle quand la longueur moyenne n'est pas
 * encore connue. Les phases sont un **repère de lecture**, jamais un diagnostic — mieux vaut ne rien
 * afficher que de les deviner.
 */
export function phaseForDate(
  dateKey: string,
  periods: readonly MenstrualPeriod[],
  averageLength: number | null,
): CyclePhase | null {
  const current = periodCovering(dateKey, periods);
  if (current === null) return null;

  const day = daysBetween(current.startedOn, dateKey) + 1;
  // Au-delà d'un cycle invraisemblable, la donnée est périmée : aucune phase.
  if (day > MAX_PLAUSIBLE_CYCLE_DAYS) return null;

  // Pendant la période elle-même. Une période encore ouverte reste menstruelle jusqu'à la date
  // demandée : c'est ce que la donnée dit, et on ne présume pas d'une fin non saisie.
  if (current.endedOn === null || dateKey <= current.endedOn) return 'menstrual';

  // Hors période, sans longueur moyenne, on ne peut pas situer l'ovulation → on se tait.
  if (averageLength === null) return null;

  const ovulationDay = averageLength - LUTEAL_PHASE_DAYS;
  if (day < ovulationDay - OVULATORY_HALF_WINDOW) return 'follicular';
  if (day <= ovulationDay + OVULATORY_HALF_WINDOW) return 'ovulatory';
  return 'luteal';
}

// ---------------------------------------------------------------------------
// R13 / R14 — croisement
// ---------------------------------------------------------------------------

export type PhaseSample = { phase: CyclePhase; value: number };

export type CrossPhaseResult =
  | {
      status: 'insufficient';
      cyclesAvailable: number;
      cyclesNeeded: number;
      /** Nombre d'échantillons encore attendus, **par phase** (0 = phase déjà couverte). */
      missingByPhase: Record<CyclePhase, number>;
    }
  | {
      status: 'ready';
      byPhase: Record<CyclePhase, { average: number; sampleCount: number }>;
      cyclesObserved: number;
    };

/**
 * Moyennes **observées** par phase, pour une seule métrique.
 *
 * ⚠️ Cette fonction ne renvoie **que des moyennes et des effectifs**. Elle n'établit aucune
 * causalité et ne formule aucun conseil : « ton énergie baisse **à cause de** ta phase lutéale » ou
 * « **évite** les séances lourdes » sont hors de portée du calcul comme de l'affichage (R14).
 *
 * Le seuil est vérifié **par métrique** (l'appelant fait un appel par métrique) *et* par phase :
 * comparer des phases suppose de les avoir toutes les quatre. En dessous, on dit ce qui manque
 * plutôt que de sortir une moyenne sur 4 points — ce serait du bruit présenté comme un constat.
 */
export function crossPhaseAverages(
  samples: readonly PhaseSample[],
  cyclesObserved: number,
): CrossPhaseResult {
  const counts = {} as Record<CyclePhase, number>;
  const sums = {} as Record<CyclePhase, number>;
  for (const phase of CYCLE_PHASES) {
    counts[phase] = 0;
    sums[phase] = 0;
  }
  for (const s of samples) {
    counts[s.phase] += 1;
    sums[s.phase] += s.value;
  }

  const missingByPhase = {} as Record<CyclePhase, number>;
  let complete = true;
  for (const phase of CYCLE_PHASES) {
    const missing = Math.max(0, MIN_SAMPLES_PER_PHASE - counts[phase]);
    missingByPhase[phase] = missing;
    if (missing > 0) complete = false;
  }

  if (!complete || cyclesObserved < MIN_CYCLES_FOR_INSIGHTS) {
    return {
      status: 'insufficient',
      cyclesAvailable: cyclesObserved,
      cyclesNeeded: MIN_CYCLES_FOR_INSIGHTS,
      missingByPhase,
    };
  }

  const byPhase = {} as Record<CyclePhase, { average: number; sampleCount: number }>;
  for (const phase of CYCLE_PHASES) {
    byPhase[phase] = {
      average: Math.round((sums[phase] / counts[phase]) * 10) / 10,
      sampleCount: counts[phase],
    };
  }
  return { status: 'ready', byPhase, cyclesObserved };
}
