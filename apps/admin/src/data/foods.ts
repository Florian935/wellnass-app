import { supabase } from '../lib/supabase';
import {
  type Database,
  type FoodCategory,
  type FoodFormValues,
  type FoodImportRecord,
  type Micronutrients,
  MICRONUTRIENT_KEYS,
  parseMicronutrients,
} from '@wellness/shared';

/**
 * Couche data de l'import d'aliments éditoriaux (US 8.6). Requêtes Supabase via supabase-js
 * (clé anon ; la RLS est la frontière — seul un éditeur de contenu écrit l'éditorial).
 * Aliments éditoriaux = `owner_id IS NULL`, `source = 'library'`. Upsert idempotent par
 * `import_key` (clé stable fournie par le CSV), traductions FR/EN par `(food_id, lang)`.
 */

type FoodInsert = Database['public']['Tables']['foods']['Insert'];
type FoodUpdate = Database['public']['Tables']['foods']['Update'];
type FoodTranslationInsert = Database['public']['Tables']['food_translations']['Insert'];

export type ImportResult = { created: number; updated: number };

/** Une ligne aliment éditorial pour la liste d'administration (US 8.5). */
export type AdminFoodRow = {
  id: string;
  category: FoodCategory;
  kcalPer100g: number;
  importKey: string | null;
  createdAt: string;
  nameFr: string | null;
  nameEn: string | null;
};

/** Détail d'un aliment éditorial pour le formulaire d'édition (ligne + noms FR/EN). */
export type FoodDetail = {
  id: string;
  category: FoodCategory;
  kcalPer100g: number;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  sugarsPer100g: number | null;
  fatPer100g: number | null;
  saturatedFatPer100g: number | null;
  fiberPer100g: number | null;
  micronutrients: Micronutrients;
  importKey: string | null;
  nameFr: string;
  nameEn: string;
};

/** Entrée de `saveFood` : forme validée (`FoodFormValues`) + `id` en édition. */
export type SaveFoodInput = FoodFormValues & { id?: string };

type FoodTranslation = { lang: string; name: string };

function pickNames(translations: FoodTranslation[] | null): {
  nameFr: string | null;
  nameEn: string | null;
} {
  const list = translations ?? [];
  return {
    nameFr: list.find((t) => t.lang === 'fr')?.name ?? null,
    nameEn: list.find((t) => t.lang === 'en')?.name ?? null,
  };
}

/**
 * Liste des aliments éditoriaux (`owner_id IS NULL`, non archivés) + noms FR/EN,
 * triés du plus récent au plus ancien. La RLS `select` les rend lisibles par tous.
 */
export async function listEditorialFoods(): Promise<{
  rows: AdminFoodRow[];
  error: unknown;
}> {
  const { data, error } = await supabase
    .from('foods')
    .select('id, category, kcal_per_100g, import_key, created_at, food_translations(lang, name)')
    .is('owner_id', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) return { rows: [], error };

  const rows: AdminFoodRow[] = (data ?? []).map((f) => {
    const { nameFr, nameEn } = pickNames(f.food_translations as FoodTranslation[]);
    return {
      id: f.id,
      category: f.category as FoodCategory,
      kcalPer100g: Number(f.kcal_per_100g),
      importKey: f.import_key,
      createdAt: f.created_at,
      nameFr,
      nameEn,
    };
  });
  return { rows, error: null };
}

/** Détail d'un aliment éditorial (ligne + traductions FR/EN) pour l'édition. */
export async function getFood(id: string): Promise<{
  food: FoodDetail | null;
  error: unknown;
}> {
  const { data, error } = await supabase
    .from('foods')
    .select(
      'id, category, kcal_per_100g, protein_per_100g, carbs_per_100g, sugars_per_100g, fat_per_100g, saturated_fat_per_100g, fiber_per_100g, micronutrients, import_key, food_translations(lang, name)',
    )
    .eq('id', id)
    .is('owner_id', null) // éditorial uniquement (jamais un aliment utilisateur)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return { food: null, error };
  if (!data) return { food: null, error: null };

  const list = (data.food_translations as FoodTranslation[]) ?? [];
  const num = (v: unknown): number | null => (v == null ? null : Number(v));

  const food: FoodDetail = {
    id: data.id,
    category: data.category as FoodCategory,
    kcalPer100g: Number(data.kcal_per_100g),
    proteinPer100g: num(data.protein_per_100g),
    carbsPer100g: num(data.carbs_per_100g),
    sugarsPer100g: num(data.sugars_per_100g),
    fatPer100g: num(data.fat_per_100g),
    saturatedFatPer100g: num(data.saturated_fat_per_100g),
    fiberPer100g: num(data.fiber_per_100g),
    micronutrients: parseMicronutrients(data.micronutrients),
    importKey: data.import_key,
    nameFr: list.find((t) => t.lang === 'fr')?.name ?? '',
    nameEn: list.find((t) => t.lang === 'en')?.name ?? '',
  };
  return { food, error: null };
}

/**
 * Crée (insert) ou met à jour (update ciblé) un aliment éditorial + ses 2 traductions FR/EN.
 * À l'édition, seules les colonnes du formulaire sont écrites → `portions` / `import_key` /
 * `barcode` restent intacts. Séquentiel, idempotent (l'appelant peut retenter).
 */
export async function saveFood(input: SaveFoodInput): Promise<{ id: string | null; error: unknown }> {
  const id = input.id ?? crypto.randomUUID();
  const micronutrients = input.micronutrients as FoodInsert['micronutrients'];

  if (input.id) {
    const patch: FoodUpdate = {
      category: input.category,
      kcal_per_100g: input.kcalPer100g,
      protein_per_100g: input.proteinPer100g,
      carbs_per_100g: input.carbsPer100g,
      sugars_per_100g: input.sugarsPer100g,
      fat_per_100g: input.fatPer100g,
      saturated_fat_per_100g: input.saturatedFatPer100g,
      fiber_per_100g: input.fiberPer100g,
      micronutrients,
    };
    const { error } = await supabase
      .from('foods')
      .update(patch)
      .eq('id', id)
      .is('owner_id', null); // éditorial uniquement
    if (error) return { id: null, error };
  } else {
    const row: FoodInsert = {
      id,
      owner_id: null,
      source: 'library',
      category: input.category,
      kcal_per_100g: input.kcalPer100g,
      protein_per_100g: input.proteinPer100g,
      carbs_per_100g: input.carbsPer100g,
      sugars_per_100g: input.sugarsPer100g,
      fat_per_100g: input.fatPer100g,
      saturated_fat_per_100g: input.saturatedFatPer100g,
      fiber_per_100g: input.fiberPer100g,
      micronutrients,
      portions: [],
    };
    const { error } = await supabase.from('foods').insert(row);
    if (error) return { id: null, error };
  }

  const translations: FoodTranslationInsert[] = [
    { id: crypto.randomUUID(), food_id: id, owner_id: null, lang: 'fr', name: input.nameFr },
    { id: crypto.randomUUID(), food_id: id, owner_id: null, lang: 'en', name: input.nameEn },
  ];
  for (const t of translations) {
    const { error } = await supabase
      .from('food_translations')
      .upsert(t, { onConflict: 'food_id,lang' });
    // La ligne aliment est écrite : on renvoie son `id` (pas null) pour permettre un ré-essai.
    if (error) return { id, error };
  }

  return { id, error: null };
}

/**
 * Archive un aliment éditorial (soft-delete `deleted_at`) et ses traductions.
 * Séquentiel : l'aliment d'abord, puis ses traductions. Éditorial uniquement.
 */
export async function archiveFood(id: string): Promise<{ error: unknown }> {
  const now = new Date().toISOString();

  const { error: fErr } = await supabase
    .from('foods')
    .update({ deleted_at: now })
    .eq('id', id)
    .is('owner_id', null);
  if (fErr) return { error: fErr };

  const { error: tErr } = await supabase
    .from('food_translations')
    .update({ deleted_at: now })
    .eq('food_id', id)
    .is('owner_id', null);
  return { error: tErr };
}

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
