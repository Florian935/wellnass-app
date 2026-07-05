import { z } from 'zod';

/**
 * Système d'unités choisi par l'utilisateur. **Indépendant de la langue** (ne jamais coupler
 * `lang === 'en'` avec `imperial` — voir modele-donnees.md §3.1).
 */
export const UNIT_SYSTEMS = ['metric', 'imperial'] as const;

export const unitSystemSchema = z.enum(UNIT_SYSTEMS);
export type UnitSystem = z.infer<typeof unitSystemSchema>;

// Facteurs de conversion exacts.
const LB_PER_KG = 2.2046226218;
const MI_PER_KM = 0.6213711922;

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
