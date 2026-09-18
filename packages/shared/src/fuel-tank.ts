/**
 * US RESERV-01 — Le Réservoir : la jauge de glucides de la journée.
 * Réf. : docs/specs/functional/us/reserv01-reservoir-glucides.md
 *
 * 🔴 **Ce module ne calcule AUCUNE dépense.** Il convertit en grammes de glucides ce que le moteur
 * DEPENSE-01 (`energy.ts`) a déjà estimé (spec D4). Deux estimations concurrentes de la même séance,
 * c'est exactement le défaut qui a coûté l'US GARDE-01.
 *
 * 🔴 **Ce module ne prescrit rien non plus.** `trainingDayMacroGrams` (MN-04) reste la seule autorité
 * sur les grammes cibles du journal, comme FUEL-01 l'a déjà acté. Ici on décrit un **stock estimé**,
 * jamais une cible.
 *
 * ⚠️ **Estimation, pas mesure.** Les cinq constantes ci-dessous sont des ordres de grandeur de la
 * littérature, exportées et nommées pour être relisibles par un praticien et ajustables sans relire
 * la logique — même intention que `CARB_TARGETS_G_PER_KG` (FUEL-01).
 *
 * Module **pur** : l'heure courante est une **entrée**, jamais `Date.now()`.
 */

import { CARBS_KCAL_PER_G } from './nutrition';

// ---------------------------------------------------------------------------
// Constantes de cadrage (spec §5)
// ---------------------------------------------------------------------------

/** Capacité de stockage estimée, muscles + foie (D1). */
export const GLYCOGEN_G_PER_KG = 5;

/** Niveau au réveil, en part de la capacité (D2) — aucun report d'un jour sur l'autre. */
export const START_OF_DAY_SHARE = 0.7;

/** Vitesse maximale d'absorption des glucides (R3) : un gros repas s'étale. */
export const ABSORPTION_G_PER_H = 60;

/** Vidange de repos, hors séance (R5) : cerveau et foie, sommeil compris. */
export const REST_DRAIN_G_PER_H = 4;

/** Sous cette part de la capacité, la carte parle de « zone basse » (R7). */
export const LOW_ZONE_SHARE = 0.3;

/** Quantité maximale conseillée en une collation (R7). */
export const MAX_SNACK_G = 120;

/** Pas de la simulation, en minutes. */
export const STEP_MIN = 5;

/**
 * Heure conventionnelle de chaque repas (D3).
 *
 * ⚠️ **Convention, pas mesure** : `food_entries` ne porte pas d'heure de consommation, seulement un
 * type de repas. Exploiter une heure réelle demandera une colonne `consumed_at` — lot à part, déjà
 * identifié par FUEL-01 §5.
 */
export const MEAL_HOURS = {
  breakfast: 8,
  lunch: 12.5,
  snack: 16.5,
  dinner: 20,
} as const;

/** Heure conventionnelle d'un type de repas, `undefined` pour un type inconnu (D3). */
export function mealHour(mealType: string): number | undefined {
  return (MEAL_HOURS as Record<string, number>)[mealType];
}

/** Part de l'énergie tirée des glucides, selon l'intensité lue dans le MET (R4). */
export const CARB_SHARE_BY_MET = { low: 0.5, moderate: 0.65, high: 0.8 } as const;

/** Bornes de MET entre les trois paliers (R4) — borne basse incluse. */
export const MET_THRESHOLDS = { moderate: 6, high: 9 } as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Un apport : des glucides à une heure conventionnelle. */
export type FuelMeal = { atHour: number; carbsG: number };

/** Une séance : sa place dans la journée et ce que DEPENSE-01 lui attribue. */
export type FuelSession = {
  startHour: number;
  durationH: number;
  /** Dépense estimée par `energy.ts` (kcal). */
  kcal: number;
  /** MET retenu par `energy.ts`, `null` pour un chiffre venu d'une montre. */
  met: number | null;
};

export type FuelPoint = { hour: number; grams: number };

// ---------------------------------------------------------------------------
// Calculs
// ---------------------------------------------------------------------------

/**
 * Capacité de stockage (D1). `null` sans poids exploitable : sans poids, un g/kg n'existe pas — même
 * règle que MN-06 et FUEL-01, et c'est ce qui masque la carte plutôt que d'afficher un chiffre faux.
 */
export function capacityG(weightKg: number | null): number | null {
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) return null;
  return Math.round(weightKg * GLYCOGEN_G_PER_KG);
}

/** Part glucidique de la dépense, selon l'intensité (R4). */
export function carbShareForMet(met: number | null): number {
  if (met == null || !Number.isFinite(met)) return CARB_SHARE_BY_MET.moderate;
  if (met >= MET_THRESHOLDS.high) return CARB_SHARE_BY_MET.high;
  if (met >= MET_THRESHOLDS.moderate) return CARB_SHARE_BY_MET.moderate;
  return CARB_SHARE_BY_MET.low;
}

/** Coût d'une séance en grammes de glucides (R4). */
export function sessionCarbCostG(input: { kcal: number; met: number | null }): number {
  if (!Number.isFinite(input.kcal) || input.kcal <= 0) return 0;
  return Math.round((input.kcal * carbShareForMet(input.met)) / CARBS_KCAL_PER_G);
}

/**
 * La courbe de la journée (R2, R3, R5), simulée par pas de `STEP_MIN` minutes de 0 h à 24 h.
 *
 * Trois flux se composent à chaque pas : la **vidange de repos** (toujours), le **coût des séances**
 * actives (réparti linéairement sur leur durée), et l'**absorption** des repas (plafonnée, ce qui
 * étale un gros apport). Le niveau est borné à `[0, capacité]` : ni réservoir négatif, ni
 * sur-remplissage — un excédent est perdu, jamais reporté.
 */
export function simulateDay(input: {
  capacityG: number;
  meals: ReadonlyArray<FuelMeal>;
  sessions: ReadonlyArray<FuelSession>;
  stepMin?: number;
}): FuelPoint[] {
  const { capacityG: capacity, meals, sessions } = input;
  const stepMin = input.stepMin ?? STEP_MIN;
  const stepH = stepMin / 60;

  // Reste à absorber pour chaque repas : on décrémente au fil de la journée.
  const pending = meals.map((m) => ({ atHour: m.atHour, remaining: Math.max(0, m.carbsG) }));
  const costs = sessions.map((s) => ({
    start: s.startHour,
    end: s.startHour + Math.max(0, s.durationH),
    ratePerH:
      s.durationH > 0 ? sessionCarbCostG({ kcal: s.kcal, met: s.met }) / s.durationH : 0,
  }));

  let grams = capacity * START_OF_DAY_SHARE;
  const curve: FuelPoint[] = [{ hour: 0, grams }];

  for (let step = 1; step * stepH <= 24 + 1e-9; step++) {
    const hour = step * stepH;

    grams -= REST_DRAIN_G_PER_H * stepH;

    for (const cost of costs) {
      // Chevauchement entre le pas courant et la séance : une séance qui commence au milieu d'un
      // pas ne coûte que sa part.
      const overlap = Math.min(hour, cost.end) - Math.max(hour - stepH, cost.start);
      if (overlap > 0) grams -= cost.ratePerH * overlap;
    }

    for (const meal of pending) {
      if (meal.remaining <= 0 || meal.atHour > hour - 1e-9) continue;
      const absorbed = Math.min(meal.remaining, ABSORPTION_G_PER_H * stepH);
      meal.remaining -= absorbed;
      grams += absorbed;
    }

    grams = Math.min(capacity, Math.max(0, grams));
    curve.push({ hour, grams });
  }

  return curve;
}

/** Niveau à une heure donnée, bornes comprises (aucune extrapolation hors de la journée). */
export function levelAt(curve: ReadonlyArray<FuelPoint>, hour: number): number {
  if (curve.length === 0) return 0;
  if (hour <= curve[0]!.hour) return curve[0]!.grams;
  const last = curve[curve.length - 1]!;
  if (hour >= last.hour) return last.grams;

  let lo = 0;
  let hi = curve.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (curve[mid]!.hour <= hour) lo = mid;
    else hi = mid;
  }
  const a = curve[lo]!;
  const b = curve[hi]!;
  const span = b.hour - a.hour;
  // Défensif : la simulation produit des heures strictement croissantes ; jamais de division par zéro.
  if (span <= 0) return b.grams;
  return a.grams + ((b.grams - a.grams) * (hour - a.hour)) / span;
}

/** Point le plus bas d'une fenêtre — c'est lui qui décide si l'on parle de zone basse (R7). */
export function lowestBetween(
  curve: ReadonlyArray<FuelPoint>,
  fromHour: number,
  toHour: number,
): FuelPoint {
  let lowest: FuelPoint = { hour: fromHour, grams: levelAt(curve, fromHour) };
  for (const point of curve) {
    if (point.hour < fromHour || point.hour > toHour) continue;
    if (point.grams < lowest.grams) lowest = point;
  }
  return lowest;
}

/**
 * Quantité de glucides à ajouter pour que la prochaine séance ne **finisse pas** sous la zone
 * basse (R7).
 *
 * `null` quand il n'y a rien à conseiller : pas de séance à venir (une jauge basse un soir de repos
 * n'est pas un problème), ou projection déjà au-dessus du seuil. Sinon, le **plus petit multiple de
 * 10 g** qui suffit, plafonné à `MAX_SNACK_G` — on préfère un conseil rond et atteignable à une
 * précision que l'estimation ne mérite pas.
 */
export function snackAdviceG(input: {
  capacityG: number;
  meals: ReadonlyArray<FuelMeal>;
  sessions: ReadonlyArray<FuelSession>;
  nextSession: FuelSession | null;
  /** Heure à laquelle la collation serait prise. */
  atHour: number;
}): number | null {
  const { capacityG: capacity, meals, sessions, nextSession, atHour } = input;
  if (nextSession === null) return null;

  const threshold = capacity * LOW_ZONE_SHARE;
  const endHour = nextSession.startHour + Math.max(0, nextSession.durationH);

  const endLevel = (extraG: number): number => {
    const withSnack = extraG > 0 ? [...meals, { atHour, carbsG: extraG }] : meals;
    return levelAt(simulateDay({ capacityG: capacity, meals: withSnack, sessions }), endHour);
  };

  if (endLevel(0) >= threshold) return null;

  for (let grams = 10; grams <= MAX_SNACK_G; grams += 10) {
    if (endLevel(grams) >= threshold) return grams;
  }
  return MAX_SNACK_G;
}
