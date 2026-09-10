/**
 * Classement des résultats de recherche du sélecteur d'aliments (US NUTRI-UX01, R2.3).
 *
 * ── Le défaut corrigé ────────────────────────────────────────────────────────────────────────
 * La recherche était un `matchesSearch` (sous-chaîne) suivi d'un `ORDER BY name` : les résultats
 * sortaient donc par **ordre alphabétique**, pas par pertinence. Taper « pain » pouvait placer
 * « Chapelure de pain » avant « Pain complet », et taper « poullet » ne rendait **rien** — alors
 * que `bestMatchIndex`, la brique de correspondance floue, existait déjà dans le dépôt sans être
 * branchée sur la recherche manuelle.
 *
 * Ici, un score. Quatre paliers, du plus fort au plus faible :
 *   1. égalité exacte              « riz » → « Riz »
 *   2. préfixe du nom              « pain » → « Pain complet »
 *   3. début d'un mot du nom       « comp » → « Pain complet »
 *   4. sous-chaîne quelconque      « plet » → « Pain complet »
 * puis, si rien ne matche, un **repli flou** tolérant aux fautes de frappe.
 *
 * Deux bonus s'ajoutent au palier, sans jamais lui permettre de rattraper le palier supérieur
 * (ils valent moins que l'écart entre deux paliers) : un aliment **récemment consommé** et un
 * **nom court** remontent. Le second évite qu'« Huile d'olive vierge extra bio » double « Huile
 * d'olive » sur le terme « huile ».
 */

import { normalizeForSearch } from './search';

/** Ce qu'une ligne de résultat doit porter pour être classée — aliment, recette ou repas type. */
export interface SearchableItem {
  id: string;
  name: string;
  /** Départage les familles à score égal (voir `KIND_TIEBREAK`). */
  kind: 'food' | 'recipe' | 'template';
}

/** Une correspondance classée. `score` est croissant : le plus grand d'abord. */
export interface RankedMatch<T extends SearchableItem> {
  item: T;
  score: number;
}

/**
 * Paliers. L'écart entre deux paliers (1 000) est très supérieur à la somme des bonus possibles
 * (au plus ~130), donc un bonus ne fait jamais franchir un palier — c'est la propriété qui rend
 * le classement lisible et testable.
 */
const TIER_EXACT = 5000;
const TIER_PREFIX = 4000;
const TIER_WORD_PREFIX = 3000;
const TIER_SUBSTRING = 2000;
const TIER_FUZZY = 1000;

/** Bonus « je mange déjà ça » : décisif entre deux résultats du même palier. */
const RECENT_BONUS = 120;
/** Bonus de brièveté, plafonné : un nom court est plus probablement le terme générique cherché. */
const MAX_SHORTNESS_BONUS = 60;
/** À score égal, un aliment simple passe devant une recette, elle-même devant un repas type. */
const KIND_TIEBREAK: Record<SearchableItem['kind'], number> = { food: 2, recipe: 1, template: 0 };

/**
 * Distance de Levenshtein bornée : dès que le minimum d'une ligne dépasse `max`, on abandonne.
 * Sur une base d'un millier d'aliments, la borne évite de payer le coût complet pour des mots
 * qui n'ont manifestement rien à voir.
 */
export function boundedEditDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
      current.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[b.length] ?? max + 1;
}

/** Tolérance aux fautes, proportionnelle à la longueur : 0 sous 4 lettres, 1 jusqu'à 7, sinon 2. */
export function fuzzyTolerance(termLength: number): number {
  if (termLength < 4) return 0;
  if (termLength <= 7) return 1;
  return 2;
}

/**
 * Score d'un nom pour un terme **déjà normalisé**. `null` = aucune correspondance.
 * Exporté pour être testé seul : c'est là que vit toute la règle de pertinence.
 */
export function scoreName(name: string, normalizedTerm: string): number | null {
  const haystack = normalizeForSearch(name);
  if (normalizedTerm.length === 0) return TIER_SUBSTRING;

  // Plus le nom est court, plus le bonus est fort — plafonné, et jamais négatif.
  const shortness = Math.max(0, MAX_SHORTNESS_BONUS - haystack.length);

  if (haystack === normalizedTerm) return TIER_EXACT + shortness;
  if (haystack.startsWith(normalizedTerm)) return TIER_PREFIX + shortness;

  // Début d'un mot : on découpe sur tout ce qui n'est ni lettre ni chiffre (espaces, tirets,
  // apostrophes — « huile d'olive » doit matcher « olive »).
  const words = haystack.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (words.some((w) => w.startsWith(normalizedTerm))) return TIER_WORD_PREFIX + shortness;

  if (haystack.includes(normalizedTerm)) return TIER_SUBSTRING + shortness;

  // Repli flou, mot à mot : « poullet » doit trouver « poulet » dans « Blanc de poulet ».
  const tolerance = fuzzyTolerance(normalizedTerm.length);
  if (tolerance > 0) {
    for (const word of words) {
      if (Math.abs(word.length - normalizedTerm.length) > tolerance) continue;
      if (boundedEditDistance(word, normalizedTerm, tolerance) <= tolerance) {
        return TIER_FUZZY + shortness;
      }
    }
  }
  return null;
}

/**
 * Classe des candidats par pertinence décroissante.
 *
 * `recentIds` remonte ce que l'utilisateur mange déjà : c'est le levier qui fait qu'une recherche
 * courte tombe juste au premier essai, puisque 80 % des ajouts portent sur une vingtaine
 * d'aliments. Un terme vide renvoie les candidats **dans leur ordre d'entrée** (l'appelant a déjà
 * trié : récents puis favoris), sans les re-scorer.
 */
export function rankFoodMatches<T extends SearchableItem>(
  items: readonly T[],
  term: string,
  options: { recentIds?: readonly string[]; limit?: number } = {},
): RankedMatch<T>[] {
  const normalized = normalizeForSearch(term);
  const recent = new Set(options.recentIds ?? []);
  const limit = options.limit ?? Number.POSITIVE_INFINITY;

  if (normalized.length === 0) {
    return items.slice(0, limit === Number.POSITIVE_INFINITY ? undefined : limit).map((item) => ({
      item,
      score: TIER_SUBSTRING,
    }));
  }

  const scored: { item: T; score: number; index: number }[] = [];
  items.forEach((item, index) => {
    const base = scoreName(item.name, normalized);
    if (base == null) return;
    const score = base + (recent.has(item.id) ? RECENT_BONUS : 0) + KIND_TIEBREAK[item.kind];
    scored.push({ item, score, index });
  });

  // Tri stable explicite : à score égal on garde l'ordre d'entrée, pour que deux rendus
  // successifs de la même liste ne permutent jamais deux lignes sous le doigt.
  scored.sort((a, b) => (b.score - a.score) || (a.index - b.index));
  const capped = limit === Number.POSITIVE_INFINITY ? scored : scored.slice(0, limit);
  return capped.map(({ item, score }) => ({ item, score }));
}
