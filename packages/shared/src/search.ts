/**
 * Normalisation de texte pour la recherche (base d'aliments, exercices…).
 *
 * SQLite `LIKE` + `COLLATE NOCASE` ignore la casse mais **pas** les accents : sur une base
 * française (CIQUAL), « creme » ne trouve pas « crème ». On replie donc les diacritiques et
 * les ligatures côté application, et on filtre en mémoire (bibliothèque de taille modeste).
 */

/** Replie accents (é→e) et ligatures courantes (œ→oe, æ→ae). */
export function foldDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE');
}

/** Forme comparable d'une chaîne : sans accent, en minuscules, sans espaces de bord. */
export function normalizeForSearch(input: string): string {
  return foldDiacritics(input).toLowerCase().trim();
}

/** Vrai si `term` (normalisé) est contenu dans `haystack` ; un terme vide matche tout. */
export function matchesSearch(haystack: string, term: string): boolean {
  const needle = normalizeForSearch(term);
  if (needle.length === 0) return true;
  return normalizeForSearch(haystack).includes(needle);
}
