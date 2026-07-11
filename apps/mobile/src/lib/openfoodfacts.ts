/**
 * Client OpenFoodFacts — recherche d'aliments industriels par texte (item 4.11) et
 * lookup par code-barres (item 4.10, alimenté par le scan `expo-camera`).
 * API publique, sans clé. Doc : https://world.openfoodfacts.org/data
 *
 * Réseau requis pour ces appels (le reste du journal marche hors-ligne).
 */

import type { MicronutrientKey, Micronutrients } from '@wellness/shared';

export type OffFood = {
  barcode: string | null;
  name: string;
  kcalPer100g: number;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
  /** Micronutriments normalisés pour 100 g (socle 4.33). Souvent vide côté OFF. */
  micronutrients: Micronutrients;
};

type Nutriments = Record<string, number | string | undefined>;

type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_fr?: string;
  product_name_en?: string;
  nutriments?: Nutriments;
};

const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';
const OFF_FIELDS = 'code,product_name,product_name_fr,product_name_en,nutriments';
const OFF_HEADERS = { 'User-Agent': 'WellnessApp/0.4 (contact via app)' };

function num(v: number | string | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Correspondance OpenFoodFacts → socle micronutriments. Les champs `*_100g` d'OFF sont
 * normalisés en **grammes** ; on convertit vers l'unité de la clé (mg = ×1000, µg = ×1e6).
 * `fields` liste les alias OFF possibles (le premier renseigné gagne).
 */
const MICRO_MAP: { key: MicronutrientKey; fields: string[]; factor: number }[] = [
  { key: 'cholesterol_mg', fields: ['cholesterol_100g'], factor: 1000 },
  { key: 'sodium_mg', fields: ['sodium_100g'], factor: 1000 },
  { key: 'magnesium_mg', fields: ['magnesium_100g'], factor: 1000 },
  { key: 'potassium_mg', fields: ['potassium_100g'], factor: 1000 },
  { key: 'calcium_mg', fields: ['calcium_100g'], factor: 1000 },
  { key: 'iron_mg', fields: ['iron_100g'], factor: 1000 },
  { key: 'vitamin_c_mg', fields: ['vitamin-c_100g'], factor: 1000 },
  { key: 'vitamin_d_ug', fields: ['vitamin-d_100g'], factor: 1_000_000 },
  { key: 'vitamin_b9_ug', fields: ['vitamin-b9_100g', 'folates_100g'], factor: 1_000_000 },
  { key: 'vitamin_b12_ug', fields: ['vitamin-b12_100g'], factor: 1_000_000 },
];

/** Extrait et normalise les micronutriments du bloc `nutriments`. Clés omises si absentes/≤0. */
export function mapOffMicronutrients(n: Nutriments): Micronutrients {
  const out: Micronutrients = {};
  for (const m of MICRO_MAP) {
    let raw: number | null = null;
    for (const f of m.fields) {
      raw = num(n[f]);
      if (raw != null) break;
    }
    if (raw != null && raw > 0) out[m.key] = Math.round(raw * m.factor * 10) / 10;
  }
  return out;
}

function mapProduct(p: OffProduct, lang: string): OffFood | null {
  const name = (lang === 'en' ? p.product_name_en : p.product_name_fr) || p.product_name;
  const n = p.nutriments ?? {};
  const kcal = num(n['energy-kcal_100g']);
  // On exige un nom et des calories exploitables.
  if (!name || kcal == null) return null;
  return {
    barcode: p.code ?? null,
    name,
    kcalPer100g: kcal,
    proteinPer100g: num(n['proteins_100g']),
    carbsPer100g: num(n['carbohydrates_100g']),
    fatPer100g: num(n['fat_100g']),
    micronutrients: mapOffMicronutrients(n),
  };
}

/**
 * Recherche des produits OpenFoodFacts par nom. Renvoie une liste normalisée
 * (aliments avec calories exploitables). En cas d'erreur réseau, renvoie [].
 */
export async function searchOpenFoodFacts(query: string, lang = 'fr'): Promise<OffFood[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const params = new URLSearchParams({
    search_terms: term,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '20',
    fields: OFF_FIELDS,
  });

  try {
    const res = await fetch(`${SEARCH_URL}?${params.toString()}`, { headers: OFF_HEADERS });
    if (!res.ok) return [];
    const data = (await res.json()) as { products?: OffProduct[] };
    const products = data.products ?? [];
    const mapped: OffFood[] = [];
    for (const p of products) {
      const f = mapProduct(p, lang);
      if (f) mapped.push(f);
    }
    return mapped;
  } catch {
    return [];
  }
}

/**
 * Récupère un produit OpenFoodFacts par son code-barres (item 4.10, scan). Renvoie
 * l'aliment normalisé, `null` si introuvable / sans calories exploitables, ou en cas
 * d'erreur réseau. Le code-barres scanné n'est retenu que s'il est numérique (EAN/UPC).
 */
export async function fetchOpenFoodFactsByBarcode(barcode: string, lang = 'fr'): Promise<OffFood | null> {
  const code = barcode.trim();
  if (!/^\d{6,14}$/.test(code)) return null;

  const params = new URLSearchParams({ fields: OFF_FIELDS });
  try {
    const res = await fetch(`${PRODUCT_URL}/${code}.json?${params.toString()}`, { headers: OFF_HEADERS });
    if (!res.ok) return null;
    const data = (await res.json()) as { status?: number; product?: OffProduct };
    if (data.status !== 1 || !data.product) return null;
    const mapped = mapProduct(data.product, lang);
    // On garantit que le code-barres scanné est bien porté par le résultat.
    return mapped ? { ...mapped, barcode: mapped.barcode ?? code } : null;
  } catch {
    return null;
  }
}
