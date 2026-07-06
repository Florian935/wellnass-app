/**
 * Saisie de repas en langage naturel (spec alimentation §4.5).
 * Parseur **pur** : découpe une phrase libre en items { quantité, unité, nom d'aliment }.
 * Fonctionne FR + EN, hors-ligne. La correspondance avec la base d'aliments et le calcul
 * des grammes se font côté app (avec les portions usuelles) — voir food-repository.
 *
 * Exemple : « une banane, 3 tranches de pain de mie, et beurre de cacahuète »
 *   → [ {qty:1, unit:null, name:'banane'},
 *       {qty:3, unit:'slice', name:'pain de mie'},
 *       {qty:1, unit:null, name:'beurre de cacahuète'} ]
 */

/** Unité normalisée reconnue (ou `null` = pièce/portion par défaut). */
export type ParsedUnit = 'gram' | 'slice' | 'tbsp' | 'tsp' | 'glass' | 'handful' | 'piece' | null;

export type ParsedMealItem = {
  /** Texte brut du segment (pour l'affichage / l'édition). */
  raw: string;
  /** Quantité (défaut 1). */
  quantity: number;
  /** Unité normalisée (null = pièce/portion par défaut). */
  unit: ParsedUnit;
  /** Nom d'aliment extrait (recherché dans la base). */
  foodName: string;
};

// Connecteurs de segmentation : virgule, point-virgule, retour ligne, « et/avec/and/with/+ ».
const SEGMENT_SPLIT = /\s*(?:,|;|\n|\+|\bet\b|\bavec\b|\band\b|\bwith\b|\bplus\b)\s*/gi;

// Nombres écrits en toutes lettres (FR + EN) → valeur.
const WORD_NUMBERS: Record<string, number> = {
  un: 1, une: 1, a: 1, an: 1, one: 1,
  deux: 2, two: 2, trois: 3, three: 3, quatre: 4, four: 4, cinq: 5, five: 5,
  six: 6, sept: 7, seven: 7, huit: 8, eight: 8, neuf: 9, nine: 9, dix: 10, ten: 10,
  demi: 0.5, demie: 0.5, half: 0.5,
};

// Articles/quantifieurs vagues traités comme quantité 1 (« du beurre », « des pâtes »).
const VAGUE_ARTICLES = new Set(['du', 'de', "d'", 'des', 'la', 'le', 'les', "l'", 'of', 'some']);

// Mots-unités → unité normalisée. Ordre : on teste ces motifs après la quantité.
const UNIT_PATTERNS: Array<{ re: RegExp; unit: Exclude<ParsedUnit, null> }> = [
  { re: /^(?:tranches?|slices?)\b/i, unit: 'slice' },
  { re: /^(?:c\.?\s*(?:à|a)\s*soupe|cuill[eè]res?\s*(?:à|a)\s*soupe|cs|tbsp|tablespoons?)\b/i, unit: 'tbsp' },
  { re: /^(?:c\.?\s*(?:à|a)\s*caf[eé]|cuill[eè]res?\s*(?:à|a)\s*caf[eé]|cc|tsp|teaspoons?)\b/i, unit: 'tsp' },
  { re: /^(?:verres?|glass(?:es)?)\b/i, unit: 'glass' },
  { re: /^(?:poign[eé]es?|handfuls?)\b/i, unit: 'handful' },
  { re: /^(?:grammes?|g|gr)\b/i, unit: 'gram' },
  { re: /^(?:pi[eè]ces?|pieces?|unit[eé]s?|units?)\b/i, unit: 'piece' },
];

/** Retire les articles de liaison en tête (« de », « d' », « of »…). */
function stripLeadingFillers(text: string): string {
  let s = text.trim();
  // Peut y avoir « de la », « d' » enchaînés.
  for (;;) {
    const m = /^([a-zàâäéèêëïîôöùûüç']+)\s+/i.exec(s);
    if (m && VAGUE_ARTICLES.has(m[1]!.toLowerCase())) {
      s = s.slice(m[0].length);
      continue;
    }
    // « d'huile » → retire « d' »
    const apos = /^(?:d'|l')/i.exec(s);
    if (apos) {
      s = s.slice(apos[0].length);
      continue;
    }
    break;
  }
  return s.trim();
}

/** Parse un segment unique en item, ou `null` si vide. */
function parseSegment(segment: string): ParsedMealItem | null {
  const raw = segment.trim();
  if (raw.length === 0) return null;

  let rest = raw;
  let quantity = 1;

  // 1) Quantité : chiffre (« 3 », « 2,5 ») ou mot (« une », « deux », « demi »).
  const numMatch = /^(\d+(?:[.,]\d+)?)\s*/.exec(rest);
  if (numMatch) {
    quantity = parseFloat(numMatch[1]!.replace(',', '.'));
    rest = rest.slice(numMatch[0].length);
  } else {
    const wordMatch = /^([a-zàâäéèêëïîôöùûüç]+)\s+/i.exec(rest);
    const w = wordMatch?.[1]?.toLowerCase();
    if (w && w in WORD_NUMBERS) {
      quantity = WORD_NUMBERS[w]!;
      rest = rest.slice(wordMatch![0].length);
    }
  }

  // 2) Unité éventuelle juste après la quantité.
  let unit: ParsedUnit = null;
  for (const { re, unit: u } of UNIT_PATTERNS) {
    const m = re.exec(rest);
    if (m) {
      unit = u;
      rest = rest.slice(m[0].length);
      break;
    }
  }

  // 3) Nom = reste, débarrassé des articles de liaison (« de », « d' »…).
  const foodName = stripLeadingFillers(rest).replace(/\s+/g, ' ').trim();
  if (foodName.length === 0) return null;

  return { raw, quantity: quantity > 0 ? quantity : 1, unit, foodName };
}

/**
 * Découpe une phrase libre en items de repas. Ignore les segments vides / sans aliment.
 * Ne modifie jamais le journal (la validation se fait sur l'écran de revue, spec §8).
 */
export function parseMealText(text: string): ParsedMealItem[] {
  if (!text || text.trim().length === 0) return [];
  // Normalise les décimales (« 2,5 » → « 2.5 ») pour ne pas confondre la virgule
  // décimale avec un séparateur de segment (évite un lookbehind, non garanti sur Hermes).
  const normalized = text.replace(/(\d)[.,](\d)/g, '$1.$2');
  return normalized
    .split(SEGMENT_SPLIT)
    .map(parseSegment)
    .filter((item): item is ParsedMealItem => item !== null);
}

/** Normalise un nom pour la recherche floue : minuscules, sans accents, espaces compactés. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Forme singulier grossière (retire un « s » final sur les mots > 3 lettres). */
function singular(word: string): string {
  return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
}

/**
 * Indice du meilleur aliment correspondant à `name` parmi `candidateNames`
 * (tolérant aux accents et au pluriel). Renvoie -1 si aucune correspondance plausible.
 */
export function bestMatchIndex(name: string, candidateNames: ReadonlyArray<string>): number {
  const t = normalizeName(name);
  if (t.length === 0) return -1;
  const tWords = t.split(' ').map(singular);
  let best = -1;
  let bestScore = 0;
  candidateNames.forEach((candidate, i) => {
    const n = normalizeName(candidate);
    let score = 0;
    if (n === t) {
      score = 100;
    } else if (n.includes(t) || t.includes(n)) {
      score = 60 - Math.abs(n.length - t.length);
    } else {
      const cWords = n.split(' ').map(singular);
      const overlap = tWords.filter((w) => cWords.includes(w)).length;
      score = overlap > 0 ? 20 * overlap : 0;
    }
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/** Grammes approximatifs par défaut d'une unité (fallback si l'aliment n'a pas la portion). */
export const DEFAULT_UNIT_GRAMS: Record<Exclude<ParsedUnit, null>, number> = {
  gram: 1,
  slice: 25,
  tbsp: 15,
  tsp: 5,
  glass: 200,
  handful: 30,
  piece: 100,
};
