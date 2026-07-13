/**
 * Validation du formulaire d'un aliment éditorial (US 8.5, admin). Logique **pure** : reçoit
 * les champs saisis (tous en `string`, comme un formulaire web), valide/mappe, et renvoie soit
 * la forme typée (`values`), soit la liste d'erreurs par champ. Aucune I/O — l'admin fait l'écriture.
 *
 * Réutilise les primitives de `food.ts` (catégories, clés de micros, schéma strict). Miroir de
 * `food-csv.ts` (8.6) mais orienté champ-par-champ plutôt que ligne CSV.
 *
 * Contrat : cf. docs/specs/functional/us/8.5-gestion-aliments.md §5.
 */
import {
  FOOD_CATEGORIES,
  type FoodCategory,
  MICRONUTRIENT_KEYS,
  type Micronutrients,
  micronutrientsSchema,
} from './food';

/** Champs macro (clé de sortie camelCase). */
const MACRO_KEYS = [
  'proteinPer100g',
  'carbsPer100g',
  'sugarsPer100g',
  'fatPer100g',
  'saturatedFatPer100g',
  'fiberPer100g',
] as const;
type MacroKey = (typeof MACRO_KEYS)[number];

/** Entrée du formulaire : tous les champs sont saisis en chaîne (vide = absent). */
export type FoodFormInput = {
  nameFr: string;
  nameEn: string;
  category: string;
  kcalPer100g: string;
} & Record<MacroKey, string> &
  Record<(typeof MICRONUTRIENT_KEYS)[number], string>;

/** Forme validée typée (prête pour la couche data). */
export type FoodFormValues = {
  nameFr: string;
  nameEn: string;
  category: FoodCategory;
  kcalPer100g: number;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  sugarsPer100g: number | null;
  fatPer100g: number | null;
  saturatedFatPer100g: number | null;
  fiberPer100g: number | null;
  micronutrients: Micronutrients;
};

export type FoodFormError = { field: string; reason: string };
export type FoodFormResult = { values: FoodFormValues | null; errors: FoodFormError[] };

const CATEGORIES: readonly string[] = FOOD_CATEGORIES;

/**
 * Parse une cellule numérique optionnelle : vide → `null` ; sinon nombre fini ≥ 0 (virgule
 * décimale tolérée) → n ; invalide/négatif → `'invalid'`.
 */
function parseDecimal(raw: string | undefined): number | null | 'invalid' {
  const s = (raw ?? '').trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : 'invalid';
}

/** Valide/mappe les champs du formulaire aliment ; `values` null s'il reste ≥ 1 erreur. */
export function validateFoodInput(input: FoodFormInput): FoodFormResult {
  const errors: FoodFormError[] = [];
  const err = (field: string, reason: string) => errors.push({ field, reason });

  const nameFr = (input.nameFr ?? '').trim();
  const nameEn = (input.nameEn ?? '').trim();
  const category = (input.category ?? '').trim();

  if (!nameFr) err('nameFr', 'requis');
  if (!nameEn) err('nameEn', 'requis');
  if (!CATEGORIES.includes(category)) err('category', 'catégorie inconnue');

  // kcal : requis, nombre ≥ 0
  let kcalPer100g = 0;
  const kcalRaw = (input.kcalPer100g ?? '').trim();
  if (kcalRaw === '') {
    err('kcalPer100g', 'requis');
  } else {
    const n = parseDecimal(kcalRaw);
    if (n === 'invalid' || n === null) err('kcalPer100g', 'nombre ≥ 0 attendu');
    else kcalPer100g = n;
  }

  // macros optionnelles
  const macros: Record<MacroKey, number | null> = {
    proteinPer100g: null,
    carbsPer100g: null,
    sugarsPer100g: null,
    fatPer100g: null,
    saturatedFatPer100g: null,
    fiberPer100g: null,
  };
  for (const key of MACRO_KEYS) {
    const p = parseDecimal(input[key]);
    if (p === 'invalid') err(key, 'nombre ≥ 0 attendu');
    else macros[key] = p;
  }

  // micros optionnels (seules les clés renseignées sont conservées)
  const micros: Record<string, number> = {};
  for (const key of MICRONUTRIENT_KEYS) {
    const p = parseDecimal(input[key]);
    if (p === 'invalid') err(key, 'nombre ≥ 0 attendu');
    else if (p !== null) micros[key] = p;
  }

  if (errors.length > 0) return { values: null, errors };

  return {
    values: {
      nameFr,
      nameEn,
      category: category as FoodCategory,
      kcalPer100g,
      proteinPer100g: macros.proteinPer100g,
      carbsPer100g: macros.carbsPer100g,
      sugarsPer100g: macros.sugarsPer100g,
      fatPer100g: macros.fatPer100g,
      saturatedFatPer100g: macros.saturatedFatPer100g,
      fiberPer100g: macros.fiberPer100g,
      micronutrients: micronutrientsSchema.parse(micros),
    },
    errors: [],
  };
}
