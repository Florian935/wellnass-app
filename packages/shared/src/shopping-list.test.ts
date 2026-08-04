import { describe, expect, it } from 'vitest';
import {
  aggregateShoppingList,
  aisleToggleAction,
  AISLE_ORDER,
  formatShoppingListText,
  normalizeIngredientName,
  sortShoppingLines,
  type IngredientContribution,
  type ShoppingLine,
} from './shopping-list';

function contribution(over: Partial<IngredientContribution> = {}): IngredientContribution {
  return {
    foodId: null,
    name: 'Brocoli',
    category: 'vegetables',
    quantityG: 100,
    factor: 1,
    ...over,
  };
}

function line(over: Partial<ShoppingLine> = {}): ShoppingLine {
  return {
    foodId: null,
    name: 'Brocoli',
    category: 'vegetables',
    quantityG: 100,
    unquantifiedCount: 0,
    ...over,
  };
}

describe('normalizeIngredientName (R9)', () => {
  it('ignore la casse, les accents et les espaces superflus', () => {
    expect(normalizeIngredientName('  Œufs   ENTIERS ')).toBe('œufs entiers');
    expect(normalizeIngredientName('Épinards')).toBe('epinards');
    expect(normalizeIngredientName('CRÈME fraîche')).toBe('creme fraiche');
  });

  it('ne devine aucun pluriel ni radical', () => {
    // Fusionner « tomate » et « tomates » demanderait un stemming : mieux vaut deux lignes justes
    // qu'une fusion fausse (« pomme » / « pommes de terre » finiraient ensemble).
    expect(normalizeIngredientName('tomate')).not.toBe(normalizeIngredientName('tomates'));
  });
});

describe('aggregateShoppingList — clé d’agrégat (R9)', () => {
  it('fusionne deux contributions du même aliment identifié', () => {
    const lines = aggregateShoppingList([
      contribution({ foodId: 'f1', quantityG: 400 }),
      contribution({ foodId: 'f1', quantityG: 200 }),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.quantityG).toBe(600);
  });

  it('fusionne par nom normalisé quand il n’y a pas d’aliment identifié', () => {
    const lines = aggregateShoppingList([
      contribution({ name: 'Échalote', quantityG: 30 }),
      contribution({ name: 'echalote', quantityG: 20 }),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.quantityG).toBe(50);
    // Le libellé affiché est celui de la première contribution, pas la forme normalisée.
    expect(lines[0]!.name).toBe('Échalote');
  });

  it('ne fusionne jamais deux aliments identifiés différents portant le même nom', () => {
    const lines = aggregateShoppingList([
      contribution({ foodId: 'f1', name: 'Yaourt', quantityG: 125 }),
      contribution({ foodId: 'f2', name: 'Yaourt', quantityG: 125 }),
    ]);
    expect(lines).toHaveLength(2);
  });

  it('garde « tomate » et « tomates cerises » séparés', () => {
    const lines = aggregateShoppingList([
      contribution({ name: 'Tomate', quantityG: 400 }),
      contribution({ name: 'Tomates cerises', quantityG: 200 }),
    ]);
    expect(lines).toHaveLength(2);
  });
});

describe('aggregateShoppingList — quantités (R7, R8)', () => {
  it('applique le facteur de portion aux quantités', () => {
    // Recette de 4 portions planifiée pour 2 → facteur 0,5.
    const lines = aggregateShoppingList([contribution({ quantityG: 800, factor: 0.5 })]);
    expect(lines[0]!.quantityG).toBe(400);
  });

  it('ne traite JAMAIS une quantité absente comme zéro', () => {
    // Le cas dangereux : compter `null` comme 0 produit une liste de courses incomplète
    // sans le dire, et on s'en aperçoit au magasin.
    const lines = aggregateShoppingList([contribution({ quantityG: null })]);
    expect(lines[0]!.quantityG).toBeNull();
    expect(lines[0]!.unquantifiedCount).toBe(1);
  });

  it('additionne les contributions quantifiées ET compte les autres à part', () => {
    const lines = aggregateShoppingList([
      contribution({ name: 'Oignon', quantityG: 150 }),
      contribution({ name: 'Oignon', quantityG: null }),
      contribution({ name: 'Oignon', quantityG: null }),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.quantityG).toBe(150);
    expect(lines[0]!.unquantifiedCount).toBe(2);
  });

  it('arrondit au gramme', () => {
    const lines = aggregateShoppingList([contribution({ quantityG: 100, factor: 1 / 3 })]);
    expect(lines[0]!.quantityG).toBe(33);
  });

  it('écarte une quantité non finie plutôt que de propager NaN', () => {
    const lines = aggregateShoppingList([
      contribution({ name: 'Riz', quantityG: Number.NaN }),
      contribution({ name: 'Riz', quantityG: 200 }),
    ]);
    expect(lines[0]!.quantityG).toBe(200);
    expect(lines[0]!.unquantifiedCount).toBe(1);
  });

  it('ignore les contributions à quantité négative', () => {
    const lines = aggregateShoppingList([contribution({ quantityG: -50 })]);
    expect(lines[0]!.quantityG).toBeNull();
    expect(lines[0]!.unquantifiedCount).toBe(1);
  });

  it('rend une liste vide sans contribution', () => {
    expect(aggregateShoppingList([])).toEqual([]);
  });
});

describe('aggregateShoppingList — rayon', () => {
  it('retient la catégorie de la première contribution qui en porte une', () => {
    const lines = aggregateShoppingList([
      contribution({ name: 'Lait', category: null }),
      contribution({ name: 'Lait', category: 'dairy' }),
    ]);
    expect(lines[0]!.category).toBe('dairy');
  });

  it('retombe sur « other » pour une catégorie inconnue ou absente', () => {
    const lines = aggregateShoppingList([
      contribution({ name: 'Mystère', category: 'condiments' }),
      contribution({ name: 'Autre chose', category: null }),
    ]);
    expect(lines.map((l) => l.category)).toEqual(['other', 'other']);
  });
});

describe('sortShoppingLines (R13)', () => {
  it('ordonne les rayons selon le parcours de magasin, « other » en dernier', () => {
    const sorted = sortShoppingLines([
      line({ name: 'Eau', category: 'drinks' }),
      line({ name: 'Sel', category: 'other' }),
      line({ name: 'Poulet', category: 'meat' }),
      line({ name: 'Carotte', category: 'vegetables' }),
    ]);
    expect(sorted.map((l) => l.category)).toEqual(['vegetables', 'meat', 'drinks', 'other']);
  });

  it('trie alphabétiquement dans un rayon, accents et casse ignorés', () => {
    const sorted = sortShoppingLines([
      line({ name: 'endive' }),
      line({ name: 'Éclair' }),
      line({ name: 'Aubergine' }),
    ]);
    expect(sorted.map((l) => l.name)).toEqual(['Aubergine', 'Éclair', 'endive']);
  });

  it('reste déterministe sur deux lignes de même nom (départage par foodId)', () => {
    const a = line({ name: 'Yaourt', foodId: 'f2' });
    const b = line({ name: 'Yaourt', foodId: 'f1' });
    expect(sortShoppingLines([a, b]).map((l) => l.foodId)).toEqual(['f1', 'f2']);
    // Même entrée dans l'autre sens → même sortie.
    expect(sortShoppingLines([b, a]).map((l) => l.foodId)).toEqual(['f1', 'f2']);
  });

  it('ne départage pas deux lignes libres de même nom (ordre d’insertion conservé)', () => {
    // Deux ingrédients libres homonymes : aucun foodId de part et d'autre, le comparateur
    // retourne 0 et le tri stable de JS préserve l'ordre d'arrivée.
    const sorted = sortShoppingLines([
      line({ name: 'Herbes', foodId: null, quantityG: 10 }),
      line({ name: 'herbes', foodId: null, quantityG: 20 }),
    ]);
    expect(sorted.map((l) => l.quantityG)).toEqual([10, 20]);
  });

  it('place une ligne sans foodId avant une ligne identifiée de même nom', () => {
    const sorted = sortShoppingLines([
      line({ name: 'Yaourt', foodId: 'f1' }),
      line({ name: 'Yaourt', foodId: null }),
    ]);
    expect(sorted[0]!.foodId).toBeNull();
  });

  it('ne modifie pas le tableau reçu', () => {
    const input = [line({ name: 'B' }), line({ name: 'A' })];
    sortShoppingLines(input);
    expect(input.map((l) => l.name)).toEqual(['B', 'A']);
  });

  it('couvre les 9 rayons de la base d’aliments', () => {
    expect(AISLE_ORDER).toHaveLength(9);
    expect(AISLE_ORDER.at(-1)).toBe('other');
  });
});

describe('aisleToggleAction (D13)', () => {
  it('coche tout un rayon vierge', () => {
    expect(aisleToggleAction([false, false])).toBe('check-all');
  });

  it('coche le reste d’un rayon partiellement coché — jamais de dé-cochage implicite', () => {
    expect(aisleToggleAction([true, false, false])).toBe('check-rest');
  });

  it('dé-coche un rayon entièrement coché', () => {
    expect(aisleToggleAction([true, true])).toBe('uncheck-all');
  });

  it('gère le rayon à un seul article', () => {
    expect(aisleToggleAction([false])).toBe('check-all');
    expect(aisleToggleAction([true])).toBe('uncheck-all');
  });

  it('reste inoffensif sur un rayon vide', () => {
    expect(aisleToggleAction([])).toBe('check-all');
  });
});

describe('formatShoppingListText (D8)', () => {
  it('met en page les rayons et les lignes', () => {
    const text = formatShoppingListText({
      title: 'Liste de courses — 04/08/2026',
      subtitle: 'Semaine du 3 au 9 août',
      groups: [
        {
          label: 'Légumes',
          lines: [
            { name: 'Brocoli', quantity: '600 g' },
            { name: 'Oignon', quantity: '150 g (+ 2 sans quantité)' },
          ],
        },
        { label: 'Fruits', lines: [{ name: 'Banane', quantity: '360 g' }] },
      ],
    });
    expect(text).toBe(
      [
        'Liste de courses — 04/08/2026',
        'Semaine du 3 au 9 août',
        '',
        'LÉGUMES',
        '- Brocoli : 600 g',
        '- Oignon : 150 g (+ 2 sans quantité)',
        '',
        'FRUITS',
        '- Banane : 360 g',
      ].join('\n'),
    );
  });

  it('écrit une ligne sans quantité sans séparateur orphelin', () => {
    const text = formatShoppingListText({
      title: 'Liste',
      subtitle: null,
      groups: [{ label: 'Légumes', lines: [{ name: 'Ail', quantity: null }] }],
    });
    expect(text).toContain('- Ail');
    expect(text).not.toContain('- Ail :');
  });

  it('omet le sous-titre absent sans laisser de ligne vide en trop', () => {
    const text = formatShoppingListText({
      title: 'Liste',
      groups: [{ label: 'Fruits', lines: [{ name: 'Banane', quantity: '1 kg' }] }],
    });
    expect(text).toBe(['Liste', '', 'FRUITS', '- Banane : 1 kg'].join('\n'));
  });

  it('omet les rayons vides', () => {
    const text = formatShoppingListText({
      title: 'Liste',
      groups: [
        { label: 'Légumes', lines: [] },
        { label: 'Fruits', lines: [{ name: 'Banane', quantity: '1 kg' }] },
      ],
    });
    expect(text).not.toContain('LÉGUMES');
  });

  it('rend le titre seul quand il n’y a rien à acheter', () => {
    expect(formatShoppingListText({ title: 'Liste', groups: [] })).toBe('Liste');
  });
});
