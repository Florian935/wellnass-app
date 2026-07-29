/**
 * US NUTR-F2 — suggestion d'aliments pour combler un macro (roadmap 4.37).
 *
 * **Sélection déterministe, pas d'IA.** Ce n'est pas une limitation mais un choix : une suggestion
 * d'aliment doit être **reproductible**, **explicable** et fonctionner **hors ligne**, trois choses
 * qu'un appel à un modèle ne garantit pas.
 *
 * Trois règles portent toute la valeur de ce fichier, et chacune corrige une façon de se tromper :
 *
 * 1. **on trie sur la densité du macro POUR 100 KCAL**, pas pour 100 g. Trier sur les g/100 g
 *    désignerait mécaniquement les aliments les plus caloriques — on cherche l'aliment *efficace*,
 *    celui qui comble le manque sans manger le budget calorique restant.
 * 2. **on choisit le macro au plus grand écart RELATIF**, pas absolu. En absolu, les glucides
 *    gagneraient presque toujours : leur cible en grammes est la plus élevée.
 * 3. **une quantité hors des bornes plausibles écarte l'aliment**, elle ne le tronque pas. « 900 g de
 *    brocoli » et « 8 g de riz » sont arithmétiquement justes et culinairement absurdes : mieux vaut
 *    proposer autre chose que proposer n'importe quoi.
 */

/** Les 3 macros suggérables. */
export const SUGGESTIBLE_MACROS = ['protein', 'carbs', 'fat'] as const;

export type SuggestibleMacro = (typeof SUGGESTIBLE_MACROS)[number];

/** Sous le seuil, il n'y a rien à combler et la carte ne s'affiche pas (décision D6). */
export const MACRO_GAP_MIN_RATIO = 0.1;

/** Bornes de quantité plausible, en grammes (décision D3). */
export const SUGGESTION_MIN_G = 10;
export const SUGGESTION_MAX_G = 400;

/** Pas d'arrondi de la quantité proposée. */
export const SUGGESTION_STEP_G = 5;

/** Nombre maximum de suggestions (décision D7). */
export const SUGGESTION_MAX_COUNT = 3;

/** Écart de score en dessous duquel deux aliments sont jugés équivalents → la récence départage. */
const SCORE_TIE_RATIO = 0.1;

/** Grammes consommés et visés pour un macro. */
export type MacroTotals = Record<SuggestibleMacro, number>;

/** Écart d'un macro à sa cible. */
export type MacroGap = {
  macro: SuggestibleMacro;
  /** Grammes manquants. Jamais négatif : un macro dépassé n'a pas de « manque ». */
  gapG: number;
  /** Part de la cible encore à couvrir, entre 0 et 1. `0` si la cible est nulle ou atteinte. */
  ratio: number;
};

/** Un aliment candidat, réduit à ce dont le score a besoin. */
export type SuggestionCandidate = {
  id: string;
  name: string;
  kcalPer100g: number;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
};

/** Une suggestion prête à afficher — et à journaliser en un tap. */
export type MacroSuggestion = {
  foodId: string;
  name: string;
  /** Quantité proposée, arrondie et bornée. */
  quantityG: number;
  /** Calories apportées par cette quantité, arrondies. Le coût doit être visible. */
  kcal: number;
  /** Grammes du macro visé apportés par cette quantité, au dixième. */
  macroG: number;
};

/** Valeur du macro pour 100 g, ou `null` si la donnée est absente. */
function per100g(food: SuggestionCandidate, macro: SuggestibleMacro): number | null {
  const value =
    macro === 'protein'
      ? food.proteinPer100g
      : macro === 'carbs'
        ? food.carbsPer100g
        : food.fatPer100g;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Écart de chaque macro à sa cible, du plus en retard au moins en retard (en **relatif**).
 *
 * Un macro dépassé ressort à `gapG: 0` plutôt qu'en négatif : cette US comble des manques, elle ne
 * traite pas les excès.
 */
export function macroGaps(totals: MacroTotals, targets: MacroTotals): MacroGap[] {
  return SUGGESTIBLE_MACROS.map((macro) => {
    const target = targets[macro];
    const consumed = totals[macro];
    const gapG = Math.max(0, target - consumed);
    const ratio = target > 0 ? gapG / target : 0;
    return { macro, gapG, ratio };
  }).sort((a, b) => b.ratio - a.ratio);
}

/**
 * Macro à combler en priorité, ou `null` si aucun n'atteint le seuil.
 *
 * Le tri est sur l'écart **relatif** (règle 2) : à 20 g manquants sur une cible de 60 g de protéines
 * (33 %) contre 20 g sur 250 g de glucides (8 %), c'est la protéine qui est réellement en retard.
 */
export function pickMacroToFill(gaps: ReadonlyArray<MacroGap>): SuggestibleMacro | null {
  const best = gaps.find((gap) => gap.ratio >= MACRO_GAP_MIN_RATIO && gap.gapG > 0);
  return best ? best.macro : null;
}

/** Quantité (g) nécessaire pour apporter `gapG` du macro, arrondie au pas. */
function quantityFor(gapG: number, macroPer100g: number): number {
  const raw = (gapG / macroPer100g) * 100;
  return Math.round(raw / SUGGESTION_STEP_G) * SUGGESTION_STEP_G;
}

/**
 * Jusqu'à 3 aliments qui comblent l'écart, du plus efficace au moins efficace.
 *
 * Un candidat est **écarté** — et non ajusté — dès que :
 *  - la valeur du macro visé est absente ou nulle (rien à scorer) ;
 *  - la quantité nécessaire sort des bornes plausibles (règle 3) ;
 *  - l'apport calorique à cette quantité **dépasse le budget restant** : suggérer de combler un macro
 *    en faisant exploser les calories serait un mauvais conseil, pas un conseil imparfait.
 *
 * `recentIds` départage les scores proches (décision D4) : on mange ce qu'on a chez soi, et suggérer
 * un aliment jamais consommé reste un conseil théorique.
 */
export function suggestFoodsForMacro(params: {
  macro: SuggestibleMacro;
  gapG: number;
  /** Calories encore disponibles sur la journée. Un budget ≤ 0 ne produit aucune suggestion. */
  kcalBudget: number;
  candidates: ReadonlyArray<SuggestionCandidate>;
  recentIds?: ReadonlyArray<string>;
}): MacroSuggestion[] {
  const { macro, gapG, kcalBudget, candidates, recentIds = [] } = params;

  if (gapG <= 0 || kcalBudget <= 0) return [];

  const recent = new Set(recentIds);

  const scored = candidates.flatMap((food) => {
    const density = per100g(food, macro);
    if (density === null) return [];
    if (!Number.isFinite(food.kcalPer100g) || food.kcalPer100g <= 0) return [];

    const quantityG = quantityFor(gapG, density);
    if (quantityG < SUGGESTION_MIN_G || quantityG > SUGGESTION_MAX_G) return [];

    const kcal = Math.round((food.kcalPer100g * quantityG) / 100);
    if (kcal > kcalBudget) return [];

    return [
      {
        suggestion: {
          foodId: food.id,
          name: food.name,
          quantityG,
          kcal,
          macroG: Math.round(((density * quantityG) / 100) * 10) / 10,
        } satisfies MacroSuggestion,
        // Densité du macro **pour 100 kcal** (règle 1).
        score: (density / food.kcalPer100g) * 100,
        isRecent: recent.has(food.id),
      },
    ];
  });

  scored.sort((a, b) => {
    // Scores proches → la récence départage (D4), sinon le meilleur score gagne.
    const relative = Math.abs(a.score - b.score) / Math.max(a.score, b.score, 1);
    if (relative < SCORE_TIE_RATIO && a.isRecent !== b.isRecent) {
      return a.isRecent ? -1 : 1;
    }
    return b.score - a.score;
  });

  return scored.slice(0, SUGGESTION_MAX_COUNT).map((entry) => entry.suggestion);
}
