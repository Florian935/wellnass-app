import type { NutritionObjective } from './nutrition';

export type ProteinTarget = { min: number; max: number }; // g/kg

/** Fourchettes cibles de protéines (g/kg PdC) par objectif — heuristiques, ajustables. */
export const PROTEIN_TARGETS_G_PER_KG: Record<NutritionObjective, ProteinTarget> = {
  bulk:       { min: 1.6, max: 2.2 },
  maintain:   { min: 1.6, max: 2.0 },
  cut:        { min: 1.8, max: 2.4 },
  weightloss: { min: 1.8, max: 2.2 },
};

export type ProteinPerKgStatus = 'low' | 'in' | 'high';
export type ProteinPerKg = { gPerKg: number; target: ProteinTarget; status: ProteinPerKgStatus };

/**
 * Ratio protéines/poids et statut vs la cible de l'objectif (déterministe, pur, sans I/O ni Date).
 * `null` si données insuffisantes (pas de poids valide, ou pas de protéines moyennes = 0 jour loggé).
 * Bornes INCLUSES → `in`.
 */
export function computeProteinPerKg(params: {
  avgProteinG: number | null;
  weightKg: number | null;
  objective: NutritionObjective;
}): ProteinPerKg | null {
  const { avgProteinG, weightKg, objective } = params;
  if (avgProteinG == null || weightKg == null || weightKg <= 0) return null;
  const gPerKg = Math.round((avgProteinG / weightKg) * 10) / 10; // 1 décimale
  const target = PROTEIN_TARGETS_G_PER_KG[objective];
  const status: ProteinPerKgStatus =
    gPerKg < target.min ? 'low' : gPerKg > target.max ? 'high' : 'in';
  return { gPerKg, target, status };
}
