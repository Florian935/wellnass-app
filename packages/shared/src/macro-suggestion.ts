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

/**
 * Plafond de quantité quand l'aliment n'a **pas** de portion de référence en base.
 *
 * `SUGGESTION_MAX_G` (400 g) est la borne d'absurdité — au-delà, la proposition ne veut plus rien
 * dire. Ce n'est pas la même chose qu'une **portion** : 400 g d'avocat restent dans les bornes et
 * restent inmangeables (recette device du 01/08/2026). Sans portion connue, on s'arrête donc à une
 * assiette plausible tous aliments confondus.
 */
export const SUGGESTION_NO_PORTION_MAX_G = 200;

/**
 * Part minimale de l'écart qu'une portion doit couvrir pour valoir la peine d'être proposée.
 *
 * Contrepartie indispensable du plafond de portion. Sans elle, rabattre la quantité transforme
 * « 1 kg de brocoli pour 30 g de protéines » — écarté, à juste titre — en « 200 g de brocoli,
 * +5,6 g » : une ligne exacte, honnête, et sans aucun intérêt. Une suggestion qui ne déplace pas
 * l'aiguille est du bruit, et trois lignes de bruit valent moins qu'une carte vide.
 */
export const SUGGESTION_MIN_GAP_COVERAGE = 0.25;

/**
 * Part maximale du budget calorique restant qu'une **seule** suggestion peut consommer.
 *
 * La quantité proposée comble l'écart **en entier** : pour 80 g de lipides manquants, cela donnait
 * « Chipolatas 350 g · 952 kcal » ou « Rillettes de saumon 380 g · 999 kcal » — dans les bornes en
 * grammes, sous le budget du jour, et pourtant inutilisables (recette device du 31/07/2026,
 * critère 2 « aucun 900 g, aucun 8 g »).
 *
 * Les bornes en grammes ne peuvent pas attraper ce cas : 380 g de rillettes et 380 g de courgettes
 * ont la même masse et rien à voir. C'est la **densité calorique** qui rend la proposition absurde,
 * donc c'est elle qu'on plafonne. Un aliment qui coûterait plus du tiers de ce qu'il reste à manger
 * n'est pas un complément, c'est un repas.
 *
 * ⚠️ Valeur de **calibrage**, pas une règle métier figée : à réévaluer à l'usage.
 */
export const SUGGESTION_MAX_KCAL_RATIO = 1 / 3;

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
  /**
   * Portion de référence de l'aliment en grammes (« 1 banane » = 120 g), quand la base la connaît.
   * C'est le plafond de quantité le plus honnête dont on dispose : « 1 avocat » veut dire quelque
   * chose, « 390 g d'avocat » non. Absente → repli sur {@link SUGGESTION_NO_PORTION_MAX_G}.
   */
  portionG?: number | null;
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

/** Arrondit une quantité au pas d'affichage. */
function roundToStep(grams: number): number {
  return Math.round(grams / SUGGESTION_STEP_G) * SUGGESTION_STEP_G;
}

/** Quantité (g) nécessaire pour apporter `gapG` du macro, arrondie au pas. */
function quantityFor(gapG: number, macroPer100g: number): number {
  return roundToStep((gapG / macroPer100g) * 100);
}

/**
 * Jusqu'à 3 aliments qui **rapprochent** de la cible, du plus efficace au moins efficace.
 *
 * ── Ce que la fonction promet, et ce qu'elle ne promet plus ──────────────────────────────────────
 * Elle proposait la quantité qui comble l'écart **en entier**. Pour 80 g de lipides manquants —
 * c'est-à-dire la cible d'une journée complète — cela donnait « Chipolatas 350 g », « Rillettes de
 * saumon 380 g », « Avocat 390 g » : arithmétiquement exact, inutilisable en cuisine (recette
 * device des 31/07 et 01/08/2026, critère 2 « aucun 900 g, aucun 8 g »).
 *
 * Le défaut n'était pas dans les bornes mais dans le **contrat** : aucun aliment unique ne couvre
 * la cible d'un macro sur une journée, et prétendre le contraire produit mécaniquement des portions
 * absurdes. La fonction propose donc désormais une **portion réaliste** — plafonnée par la portion
 * de référence de l'aliment quand la base la connaît — et `macroG` dit ce qu'elle apporte
 * réellement. C'est à l'appelant d'afficher cet apport : une suggestion qui tait sa contribution
 * laisserait croire qu'elle comble tout, ce qui est précisément le défaut corrigé.
 *
 * Un candidat est **écarté** — et non ajusté — dès que :
 *  - la valeur du macro visé est absente ou nulle (rien à scorer) ;
 *  - la quantité retenue sort des bornes plausibles (règle 3) ;
 *  - la portion retenue couvre moins de {@link SUGGESTION_MIN_GAP_COVERAGE} de l'écart : elle est
 *    exacte mais sans intérêt (« 200 g de brocoli, +5,6 g de protéines ») ;
 *  - l'apport calorique à cette quantité **dépasse le budget restant** : suggérer de combler un macro
 *    en faisant exploser les calories serait un mauvais conseil, pas un conseil imparfait ;
 *  - cet apport dépasse {@link SUGGESTION_MAX_KCAL_RATIO} du budget restant.
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

    // Quantité idéale (comble tout l'écart), puis rabattue sur une portion mangeable. On ne garde
    // pas la plus grande des deux : c'est justement la quantité idéale qui produisait les absurdités.
    const ideal = quantityFor(gapG, density);
    const ceiling =
      food.portionG != null && Number.isFinite(food.portionG) && food.portionG > 0
        ? Math.min(food.portionG, SUGGESTION_MAX_G)
        : SUGGESTION_NO_PORTION_MAX_G;
    const quantityG = roundToStep(Math.min(ideal, ceiling));

    if (quantityG < SUGGESTION_MIN_G || quantityG > SUGGESTION_MAX_G) return [];

    // Ce que cette portion apporte réellement. C'est le chiffre affiché, et le chiffre jugé.
    const macroG = Math.round(((density * quantityG) / 100) * 10) / 10;
    if (macroG < gapG * SUGGESTION_MIN_GAP_COVERAGE) return [];

    const kcal = Math.round((food.kcalPer100g * quantityG) / 100);
    if (kcal > kcalBudget) return [];
    // Une suggestion est un **complément**, pas un repas : au-delà d'une fraction du budget
    // restant, la proposition est écartée même si elle comble parfaitement le macro.
    if (kcal > kcalBudget * SUGGESTION_MAX_KCAL_RATIO) return [];

    return [
      {
        suggestion: {
          foodId: food.id,
          name: food.name,
          quantityG,
          kcal,
          macroG,
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
