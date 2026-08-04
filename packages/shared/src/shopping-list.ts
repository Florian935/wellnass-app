/**
 * US REPAS-01 (roadmap 4.28 / 4.29) — briques pures de la **liste de courses**.
 *
 * Agrégation des ingrédients d'une semaine planifiée, tri par rayon, et mise en page du texte
 * partageable. Aucune dépendance i18n : les libellés (rayons, unités, « sans quantité ») sont
 * **injectés** par l'appelant, qui seul connaît la langue active.
 *
 * Réf. : docs/specs/functional/us/repas01-planning-repas-liste-courses.md
 */

/** Rayons = les 9 catégories de `foods.category`. Aucune taxonomie inventée ici. */
export const AISLE_ORDER = [
  'vegetables',
  'fruits',
  'meat',
  'fish',
  'dairy',
  'starchy',
  'nuts',
  'drinks',
  'other',
] as const;

export type ShoppingAisle = (typeof AISLE_ORDER)[number];

/** Un ingrédient tel qu'il sort d'une recette ou d'un repas type planifié. */
export type IngredientContribution = {
  foodId: string | null;
  name: string;
  /** `foods.category`, ou `null` pour un ingrédient libre. */
  category: string | null;
  /** Quantité **totale de la recette** — nullable en base, et ça compte (R7). */
  quantityG: number | null;
  /** Multiplicateur de portion déjà calculé par `portionFactor` (R8). */
  factor: number;
};

/** Une ligne agrégée de la liste de courses. */
export type ShoppingLine = {
  foodId: string | null;
  name: string;
  category: ShoppingAisle;
  /** `null` = aucune contribution quantifiée. **Jamais 0 par défaut** (R7). */
  quantityG: number | null;
  /** Nombre de contributions sans quantité exploitable, restitué en clair à l'écran. */
  unquantifiedCount: number;
};

/** Action que déclenche un tap sur un en-tête de rayon (décision D13). */
export type AisleToggleAction = 'check-all' | 'check-rest' | 'uncheck-all';

const AISLE_SET = new Set<string>(AISLE_ORDER);

/**
 * Clé de regroupement d'un nom d'ingrédient : minuscules, accents retirés, espaces compactés.
 *
 * **Aucun stemming, aucun pluriel deviné** (R9) : « tomate » et « tomates » restent deux lignes.
 * Deviner les radicaux fusionnerait « pomme » et « pommes de terre » — mieux vaut deux lignes
 * justes qu'une fusion fausse au rayon.
 */
export function normalizeIngredientName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function toAisle(category: string | null | undefined): ShoppingAisle {
  return category && AISLE_SET.has(category) ? (category as ShoppingAisle) : 'other';
}

/**
 * Agrège les ingrédients d'une semaine en lignes de courses (R7, R8, R9).
 *
 * Clé d'agrégat : `foodId` quand l'aliment est identifié en base, sinon le **nom normalisé**. Deux
 * aliments identifiés distincts ne fusionnent jamais, même sous le même nom.
 *
 * Une quantité absente, non finie ou négative **n'est pas comptée 0** : elle alimente
 * `unquantifiedCount`, que l'écran restitue en clair (« + 2 sans quantité »). C'est la différence
 * entre une liste incomplète qui le dit et une liste incomplète qui ne le dit pas.
 */
export function aggregateShoppingList(
  contributions: readonly IngredientContribution[],
): ShoppingLine[] {
  const lines = new Map<string, ShoppingLine>();

  for (const c of contributions) {
    const key = c.foodId ? `id:${c.foodId}` : `name:${normalizeIngredientName(c.name)}`;
    let existing = lines.get(key);
    if (!existing) {
      existing = {
        foodId: c.foodId,
        name: c.name,
        category: toAisle(c.category),
        quantityG: null,
        unquantifiedCount: 0,
      };
      lines.set(key, existing);
    } else if (existing.category === 'other') {
      // Une première contribution sans catégorie ne doit pas condamner la ligne au rayon « other »
      // si une suivante en porte une.
      existing.category = toAisle(c.category);
    }

    const quantified =
      c.quantityG !== null && Number.isFinite(c.quantityG) && c.quantityG > 0;
    if (quantified) {
      existing.quantityG = (existing.quantityG ?? 0) + c.quantityG! * c.factor;
    } else {
      existing.unquantifiedCount += 1;
    }
  }

  return [...lines.values()].map((l) => ({
    ...l,
    quantityG: l.quantityG === null ? null : Math.round(l.quantityG),
  }));
}

/**
 * Trie les lignes dans l'ordre d'un parcours de magasin (R13) : rayons dans l'ordre de
 * `AISLE_ORDER`, puis alphabétique casse et accents ignorés, puis `foodId` pour un ordre
 * **totalement déterministe** (donc testable, et stable d'une génération à l'autre).
 *
 * Ne modifie pas le tableau reçu.
 */
export function sortShoppingLines(lines: readonly ShoppingLine[]): ShoppingLine[] {
  return [...lines].sort((a, b) => {
    const aisle = AISLE_ORDER.indexOf(a.category) - AISLE_ORDER.indexOf(b.category);
    if (aisle !== 0) return aisle;
    const name = normalizeIngredientName(a.name).localeCompare(normalizeIngredientName(b.name));
    if (name !== 0) return name;
    return (a.foodId ?? '').localeCompare(b.foodId ?? '');
  });
}

/**
 * Action d'un tap sur l'en-tête d'un rayon (décision D13), depuis l'état coché de ses articles.
 *
 * Un rayon partiellement coché **complète** le cochage : jamais de dé-cochage implicite, qui
 * effacerait un travail de magasin qu'on ne peut pas reconstituer de mémoire. Seul
 * `uncheck-all` est destructeur — c'est le seul que l'écran fait confirmer.
 */
export function aisleToggleAction(checkedStates: readonly boolean[]): AisleToggleAction {
  if (checkedStates.length === 0) return 'check-all';
  if (checkedStates.every((c) => c)) return 'uncheck-all';
  if (checkedStates.some((c) => c)) return 'check-rest';
  return 'check-all';
}

export type ShoppingTextInput = {
  title: string;
  subtitle?: string | null;
  groups: ReadonlyArray<{
    label: string;
    lines: ReadonlyArray<{ name: string; quantity: string | null }>;
  }>;
};

/**
 * Met en page la liste en **texte brut** partageable (décision D8) : collable dans un message, un
 * e-mail ou une note, sans émoji, sans lien, sans mention de l'app.
 *
 * Les quantités arrivent **déjà formatées** par l'appelant (unités et pluriels sont de l'i18n) ;
 * cette fonction ne décide que de la mise en page. Les rayons vides sont omis.
 */
export function formatShoppingListText(input: ShoppingTextInput): string {
  const blocks = input.groups
    .filter((g) => g.lines.length > 0)
    .map((g) =>
      [
        g.label.toUpperCase(),
        ...g.lines.map((l) => (l.quantity ? `- ${l.name} : ${l.quantity}` : `- ${l.name}`)),
      ].join('\n'),
    );

  const header = input.subtitle ? `${input.title}\n${input.subtitle}` : input.title;
  return blocks.length === 0 ? header : `${header}\n\n${blocks.join('\n\n')}`;
}
