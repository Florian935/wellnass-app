/**
 * Repères de qualité de l'assiette (US NUTRI-UX01, R3.5 — catalogue NUTR-15).
 *
 * ── Le défaut corrigé ────────────────────────────────────────────────────────────────────────
 * Les sucres, les fibres et les acides gras saturés sont **stockés et affichés** depuis le socle
 * 4.33, mais jamais rapportés à un repère. « Fibres 12 g » ne dit rien à qui ne connaît pas la
 * référence ; « 12 g sur 25-30 » dit tout. C'est exactement le traitement déjà retenu pour les
 * micronutriments (couverture VNR), étendu aux trois nutriments qui n'en ont pas.
 *
 * ── Pourquoi deux seuils sur trois sont proportionnels ───────────────────────────────────────
 * L'OMS exprime les sucres libres et les AGS en **pourcentage de l'apport énergétique** (10 %),
 * pas en grammes. Figer 50 g de sucres et 22 g d'AGS reviendrait à supposer 2 000 kcal pour tout
 * le monde : un sportif à 2 800 kcal serait signalé à tort, et une sèche à 1 600 kcal ne le
 * serait jamais. Les fibres, elles, ont une **référence absolue** (ANSES, 30 g/j adulte) qui ne
 * dépend pas de l'apport — on la garde telle quelle, avec une plage basse à 25 g.
 */

/** Kcal par gramme, pour convertir un pourcentage d'énergie en grammes. */
const KCAL_PER_G_CARB = 4;
const KCAL_PER_G_FAT = 9;

/** Part maximale de l'apport énergétique (OMS). */
const SUGAR_MAX_ENERGY_SHARE = 0.1;
const SATURATED_MAX_ENERGY_SHARE = 0.1;

/** Références absolues des fibres (ANSES, adulte). */
export const FIBER_MIN_G = 25;
export const FIBER_TARGET_G = 30;

export type QualityKey = 'fiber' | 'sugars' | 'saturatedFat';

/** `under` = sous la plage, `ok` = dans la plage / sous le plafond, `over` = au-delà du plafond. */
export type QualityStatus = 'under' | 'ok' | 'over';

export interface QualityTarget {
  key: QualityKey;
  /** Borne basse d'une plage à atteindre (fibres). `null` pour un plafond. */
  minG: number | null;
  /** Cible haute d'une plage, ou plafond à ne pas dépasser. */
  maxG: number;
  /** `range` = à atteindre, `cap` = à ne pas dépasser. Pilote le libellé et la couleur. */
  kind: 'range' | 'cap';
}

/**
 * Les trois repères du jour, dérivés de l'objectif calorique.
 *
 * `targetKcal` nul ou absent → les deux plafonds proportionnels retombent sur une base de
 * 2 000 kcal, **et l'appelant doit le dire** : sans objectif, l'app n'a pas de quoi personnaliser
 * le repère. C'est un repli d'affichage, pas une vérité nutritionnelle.
 */
export function qualityTargets(targetKcal: number | null | undefined): QualityTarget[] {
  const kcal =
    targetKcal != null && Number.isFinite(targetKcal) && targetKcal > 0 ? targetKcal : 2000;
  return [
    { key: 'fiber', minG: FIBER_MIN_G, maxG: FIBER_TARGET_G, kind: 'range' },
    {
      key: 'sugars',
      minG: null,
      maxG: Math.round((kcal * SUGAR_MAX_ENERGY_SHARE) / KCAL_PER_G_CARB),
      kind: 'cap',
    },
    {
      key: 'saturatedFat',
      minG: null,
      maxG: Math.round((kcal * SATURATED_MAX_ENERGY_SHARE) / KCAL_PER_G_FAT),
      kind: 'cap',
    },
  ];
}

/**
 * Position d'un apport face à son repère.
 *
 * Pour un **plafond**, être en dessous est le résultat visé → `ok`. Pour une **plage**, être en
 * dessous de la borne basse est un manque → `under`, et la dépasser n'est pas une faute → `ok`
 * (personne n'a jamais eu de problème pour avoir mangé 34 g de fibres).
 */
export function qualityStatus(target: QualityTarget, valueG: number): QualityStatus {
  const value = Number.isFinite(valueG) ? Math.max(0, valueG) : 0;
  if (target.kind === 'cap') return value > target.maxG ? 'over' : 'ok';
  if (target.minG != null && value < target.minG) return 'under';
  return 'ok';
}

/**
 * Avancement à afficher, dans [0, 1] — borné comme les barres de macros.
 * Pour une plage, la référence est la **cible haute** ; pour un plafond, le plafond lui-même.
 */
export function qualityRatio(target: QualityTarget, valueG: number): number {
  const value = Number.isFinite(valueG) ? Math.max(0, valueG) : 0;
  if (target.maxG <= 0) return 0;
  return Math.min(1, value / target.maxG);
}
