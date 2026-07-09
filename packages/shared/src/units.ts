import { z } from 'zod';

/**
 * Système d'unités choisi par l'utilisateur. **Indépendant de la langue** (ne jamais coupler
 * `lang === 'en'` avec `imperial` — voir modele-donnees.md §3.1).
 */
export const UNIT_SYSTEMS = ['metric', 'imperial'] as const;

export const unitSystemSchema = z.enum(UNIT_SYSTEMS);
export type UnitSystem = z.infer<typeof unitSystemSchema>;

// Facteurs de conversion exacts.
export const LB_PER_KG = 2.2046226218;
export const MI_PER_KM = 0.6213711922;
export const CM_PER_IN = 2.54;

/** Poids : kilogrammes ↔ livres. Le stockage reste **toujours en métrique** (SI). */
export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}
export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

/** Distance : kilomètres ↔ miles. */
export function kmToMi(km: number): number {
  return km * MI_PER_KM;
}
export function miToKm(mi: number): number {
  return mi / MI_PER_KM;
}

/** Symboles d'unité (universels, non traduits). */
export const unitSymbol = {
  metric: { weight: 'kg', distance: 'km' },
  imperial: { weight: 'lb', distance: 'mi' },
} as const satisfies Record<UnitSystem, { weight: string; distance: string }>;

export type Measurement = { value: number; unit: string };

/**
 * Convertit un poids **stocké en kg** vers le système d'affichage.
 * `fractionDigits` par défaut 1.
 */
export function displayWeight(kg: number, system: UnitSystem, fractionDigits = 1): Measurement {
  const value = system === 'imperial' ? kgToLb(kg) : kg;
  return { value: round(value, fractionDigits), unit: unitSymbol[system].weight };
}

/** Convertit une distance **stockée en km** vers le système d'affichage. */
export function displayDistance(km: number, system: UnitSystem, fractionDigits = 2): Measurement {
  const value = system === 'imperial' ? kmToMi(km) : km;
  return { value: round(value, fractionDigits), unit: unitSymbol[system].distance };
}

function round(value: number, fractionDigits: number): number {
  const factor = 10 ** fractionDigits;
  return Math.round(value * factor) / factor;
}

/** cm -> pieds + pouces (pouce le plus proche, avec report de retenue à 12). */
export function cmToFtIn(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cm / CM_PER_IN);
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

/** pieds + pouces -> cm (SI). */
export function ftInToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_IN;
}

/** Allure s/km -> s par unité affichée (mile en impérial). */
export function paceToSystem(sPerKm: number, system: UnitSystem): number {
  return system === 'imperial' ? sPerKm / MI_PER_KM : sPerKm;
}

/** Secondes par unité -> "M:SS" ; placeholder si nul/négatif/NaN. */
export function formatPaceMMSS(secondsPerUnit: number | null, noData: string): string {
  if (secondsPerUnit == null || !Number.isFinite(secondsPerUnit) || secondsPerUnit <= 0) {
    return noData;
  }
  const total = Math.round(secondsPerUnit);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Parse un nombre tolérant (virgule ou point) ; null si vide/invalide. */
function parseNumberLoose(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Texte saisi dans l'unité `system` -> kg (SI) ; null si vide/invalide. */
export function parseWeightToKg(text: string, system: UnitSystem): number | null {
  const n = parseNumberLoose(text);
  if (n === null) return null;
  return system === 'imperial' ? lbToKg(n) : n;
}

/** Texte saisi dans l'unité `system` -> km (SI) ; null si vide/invalide. */
export function parseDistanceToKm(text: string, system: UnitSystem): number | null {
  const n = parseNumberLoose(text);
  if (n === null) return null;
  return system === 'imperial' ? miToKm(n) : n;
}

/**
 * Deux champs de taille -> cm (SI).
 * - metric  : `a` = cm (champ unique), `b` ignoré.
 * - imperial: `a` = pieds, `b` = pouces.
 * Renvoie null si aucune valeur exploitable.
 */
export function heightPartsToCm(a: string, b: string, system: UnitSystem): number | null {
  if (system === 'metric') {
    return parseNumberLoose(a);
  }
  const ft = parseNumberLoose(a);
  const inch = parseNumberLoose(b);
  if (ft === null && inch === null) return null;
  return ftInToCm(ft ?? 0, inch ?? 0);
}
