import { supabase } from '../lib/supabase';
import { type Database, type FoodImportRecord, MICRONUTRIENT_KEYS } from '@wellness/shared';

/**
 * Couche data de l'import d'aliments éditoriaux (US 8.6). Requêtes Supabase via supabase-js
 * (clé anon ; la RLS est la frontière — seul un éditeur de contenu écrit l'éditorial).
 * Aliments éditoriaux = `owner_id IS NULL`, `source = 'library'`. Upsert idempotent par
 * `import_key` (clé stable fournie par le CSV), traductions FR/EN par `(food_id, lang)`.
 */

type FoodInsert = Database['public']['Tables']['foods']['Insert'];
type FoodTranslationInsert = Database['public']['Tables']['food_translations']['Insert'];

export type ImportResult = { created: number; updated: number };

/** Ordre des colonnes du CSV (= contrat, cf. spec §3). */
const CSV_COLUMNS = [
  'import_key',
  'name_fr',
  'name_en',
  'category',
  'kcal_per_100g',
  'protein_per_100g',
  'carbs_per_100g',
  'sugars_per_100g',
  'fat_per_100g',
  'saturated_fat_per_100g',
  'fiber_per_100g',
  ...MICRONUTRIENT_KEYS,
] as const;

/** Modèle CSV téléchargeable : en-têtes + une ligne d'exemple. */
export function buildCsvTemplate(): string {
  const example: Record<string, string> = {
    import_key: 'CIQUAL_13000',
    name_fr: 'Pomme crue',
    name_en: 'Raw apple',
    category: 'fruits',
    kcal_per_100g: '52',
    protein_per_100g: '0.3',
    sodium_mg: '1',
    vitamin_c_mg: '4.6',
  };
  const header = CSV_COLUMNS.join(',');
  const line = CSV_COLUMNS.map((c) => example[c] ?? '').join(',');
  return `${header}\n${line}\n`;
}

/**
 * Importe (upsert idempotent) des aliments éditoriaux + leurs traductions FR/EN.
 * Renvoie le nombre de créés / mis à jour. Lève en cas d'échec Supabase (l'appelant retente ;
 * l'upsert est idempotent). Les enregistrements sont supposés déjà valides (`parseFoodCsv`).
 */
export async function importFoods(records: FoodImportRecord[]): Promise<ImportResult> {
  if (records.length === 0) return { created: 0, updated: 0 };
  const keys = records.map((r) => r.importKey);

  // Quelles clés existent déjà (éditorial) → distinguer créés / mis à jour dans le rapport.
  const { data: existing, error: exErr } = await supabase
    .from('foods')
    .select('import_key')
    .is('owner_id', null)
    .in('import_key', keys);
  if (exErr) throw exErr;
  const known = new Set((existing ?? []).map((r) => r.import_key));

  const foodRows: FoodInsert[] = records.map((r) => ({
    id: crypto.randomUUID(),
    owner_id: null,
    source: 'library',
    import_key: r.importKey,
    category: r.category,
    kcal_per_100g: r.kcalPer100g,
    protein_per_100g: r.proteinPer100g,
    carbs_per_100g: r.carbsPer100g,
    sugars_per_100g: r.sugarsPer100g,
    fat_per_100g: r.fatPer100g,
    saturated_fat_per_100g: r.saturatedFatPer100g,
    fiber_per_100g: r.fiberPer100g,
    micronutrients: r.micronutrients as FoodInsert['micronutrients'],
    portions: [],
  }));

  const { data: upserted, error: fErr } = await supabase
    .from('foods')
    .upsert(foodRows, { onConflict: 'import_key' })
    .select('id, import_key');
  if (fErr) throw fErr;

  const idByKey = new Map<string, string>(
    (upserted ?? []).map((r) => [r.import_key as string, r.id]),
  );

  const translationRows: FoodTranslationInsert[] = records.flatMap((r) => {
    const foodId = idByKey.get(r.importKey);
    if (!foodId) return [];
    return [
      { id: crypto.randomUUID(), food_id: foodId, owner_id: null, lang: 'fr', name: r.nameFr },
      { id: crypto.randomUUID(), food_id: foodId, owner_id: null, lang: 'en', name: r.nameEn },
    ];
  });
  const { error: tErr } = await supabase
    .from('food_translations')
    .upsert(translationRows, { onConflict: 'food_id,lang' });
  if (tErr) throw tErr;

  let created = 0;
  let updated = 0;
  for (const k of new Set(keys)) {
    if (known.has(k)) updated += 1;
    else created += 1;
  }
  return { created, updated };
}
