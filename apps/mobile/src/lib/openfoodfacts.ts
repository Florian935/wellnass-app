/**
 * Client OpenFoodFacts — recherche d'aliments industriels par texte (item 4.11).
 * API publique, sans clé. Doc : https://world.openfoodfacts.org/data
 *
 * Le scan code-barres (4.10) est différé (nécessite expo-camera) ; ici, recherche texte
 * uniquement. Réseau requis pour cette recherche (le reste du journal marche hors-ligne).
 */

export type OffFood = {
  barcode: string | null;
  name: string;
  kcalPer100g: number;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
};

type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_fr?: string;
  product_name_en?: string;
  nutriments?: Record<string, number | string | undefined>;
};

const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';

function num(v: number | string | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
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
    fields: 'code,product_name,product_name_fr,product_name_en,nutriments',
  });

  try {
    const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
      headers: { 'User-Agent': 'WellnessApp/0.4 (contact via app)' },
    });
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
