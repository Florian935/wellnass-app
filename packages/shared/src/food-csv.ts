/**
 * Import d'aliments éditoriaux par CSV (US 8.6). Logique **pure** : reçoit des lignes déjà
 * tokenisées (papaparse côté admin), valide/mappe chaque ligne, et sépare enregistrements
 * valides et erreurs (par ligne). Aucune I/O ici — l'admin fait la lecture fichier + l'upsert.
 *
 * Contrat CSV : cf. docs/specs/functional/us/8.6-import-csv-ciqual.md §3.
 */
import {
  FOOD_CATEGORIES,
  type FoodCategory,
  MICRONUTRIENT_KEYS,
  type Micronutrients,
  micronutrientsSchema,
} from './food';

export type FoodImportRecord = {
  importKey: string;
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

export type FoodCsvRowError = { rowIndex: number; field: string; reason: string };
export type FoodCsvResult = { valid: FoodImportRecord[]; errors: FoodCsvRowError[] };

/** Colonnes macro optionnelles (nom CSV) → clé de sortie camelCase. */
const MACRO_FIELDS = {
  protein_per_100g: 'proteinPer100g',
  carbs_per_100g: 'carbsPer100g',
  sugars_per_100g: 'sugarsPer100g',
  fat_per_100g: 'fatPer100g',
  saturated_fat_per_100g: 'saturatedFatPer100g',
  fiber_per_100g: 'fiberPer100g',
} as const;

/** Parse une cellule numérique optionnelle : vide → null ; invalide/négatif → 'invalid'. */
function parseOptionalNumber(raw: string | undefined): number | null | 'invalid' {
  const s = (raw ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : 'invalid';
}

const CATEGORIES: readonly string[] = FOOD_CATEGORIES;

/** Valide/mappe des lignes CSV tokenisées en enregistrements d'import (+ erreurs par ligne). */
export function parseFoodCsv(rows: Record<string, string>[]): FoodCsvResult {
  const valid: FoodImportRecord[] = [];
  const errors: FoodCsvRowError[] = [];

  // Comptage des import_key (non vides) pour détecter les doublons intra-fichier.
  const keyCounts = new Map<string, number>();
  for (const row of rows) {
    const k = (row.import_key ?? '').trim();
    if (k) keyCounts.set(k, (keyCounts.get(k) ?? 0) + 1);
  }

  rows.forEach((row, i) => {
    const rowIndex = i + 1; // 1-based, hors en-tête
    const rowErrors: FoodCsvRowError[] = [];
    const err = (field: string, reason: string) => rowErrors.push({ rowIndex, field, reason });

    const importKey = (row.import_key ?? '').trim();
    const nameFr = (row.name_fr ?? '').trim();
    const nameEn = (row.name_en ?? '').trim();
    const category = (row.category ?? '').trim();

    if (!importKey) err('import_key', 'requis');
    else if ((keyCounts.get(importKey) ?? 0) > 1) err('import_key', 'dupliqué dans le fichier');
    if (!nameFr) err('name_fr', 'requis');
    if (!nameEn) err('name_en', 'requis');
    if (!CATEGORIES.includes(category)) err('category', 'catégorie inconnue');

    // kcal : requis, nombre ≥ 0
    const kcalRaw = (row.kcal_per_100g ?? '').trim();
    let kcalPer100g = 0;
    if (kcalRaw === '') {
      err('kcal_per_100g', 'requis');
    } else {
      const n = Number(kcalRaw);
      if (Number.isFinite(n) && n >= 0) kcalPer100g = n;
      else err('kcal_per_100g', 'nombre ≥ 0 attendu');
    }

    // macros optionnelles
    const macros: Record<string, number | null> = {};
    for (const csvKey of Object.keys(MACRO_FIELDS) as (keyof typeof MACRO_FIELDS)[]) {
      const p = parseOptionalNumber(row[csvKey]);
      if (p === 'invalid') err(csvKey, 'nombre ≥ 0 attendu');
      else macros[MACRO_FIELDS[csvKey]] = p;
    }

    // micros optionnels (seules les clés fournies sont incluses)
    const micros: Record<string, number> = {};
    for (const key of MICRONUTRIENT_KEYS) {
      const p = parseOptionalNumber(row[key]);
      if (p === 'invalid') err(key, 'nombre ≥ 0 attendu');
      else if (p !== null) micros[key] = p;
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }

    valid.push({
      importKey,
      nameFr,
      nameEn,
      category: category as FoodCategory,
      kcalPer100g,
      proteinPer100g: macros.proteinPer100g ?? null,
      carbsPer100g: macros.carbsPer100g ?? null,
      sugarsPer100g: macros.sugarsPer100g ?? null,
      fatPer100g: macros.fatPer100g ?? null,
      saturatedFatPer100g: macros.saturatedFatPer100g ?? null,
      fiberPer100g: macros.fiberPer100g ?? null,
      micronutrients: micronutrientsSchema.parse(micros),
    });
  });

  return { valid, errors };
}
