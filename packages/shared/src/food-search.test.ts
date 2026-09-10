import { describe, expect, it } from 'vitest';
import {
  boundedEditDistance,
  fuzzyTolerance,
  rankFoodMatches,
  scoreName,
  type SearchableItem,
} from './food-search';

const food = (id: string, name: string): SearchableItem => ({ id, name, kind: 'food' });

describe('boundedEditDistance', () => {
  it('vaut 0 pour deux chaînes identiques', () => {
    expect(boundedEditDistance('poulet', 'poulet', 2)).toBe(0);
  });

  it('compte les substitutions, insertions et suppressions', () => {
    expect(boundedEditDistance('poullet', 'poulet', 2)).toBe(1);
    expect(boundedEditDistance('polet', 'poulet', 2)).toBe(1);
    expect(boundedEditDistance('poulat', 'poulet', 2)).toBe(1);
  });

  it('abandonne au-delà de la borne plutôt que de calculer la distance exacte', () => {
    // La valeur exacte importe peu : ce qui compte est qu'elle dépasse `max`.
    expect(boundedEditDistance('courgette', 'riz', 2)).toBeGreaterThan(2);
  });

  it('court-circuite sur un écart de longueur supérieur à la borne', () => {
    expect(boundedEditDistance('a', 'abcdefgh', 2)).toBeGreaterThan(2);
  });
});

describe('fuzzyTolerance', () => {
  it("n'autorise aucune faute sous 4 caractères — trop de faux positifs", () => {
    expect(fuzzyTolerance(1)).toBe(0);
    expect(fuzzyTolerance(3)).toBe(0);
  });

  it('autorise une faute jusqu’à 7 caractères, deux au-delà', () => {
    expect(fuzzyTolerance(4)).toBe(1);
    expect(fuzzyTolerance(7)).toBe(1);
    expect(fuzzyTolerance(8)).toBe(2);
  });
});

describe('scoreName — les quatre paliers', () => {
  it('classe égalité > préfixe > début de mot > sous-chaîne', () => {
    const exact = scoreName('Riz', 'riz')!;
    const prefix = scoreName('Riz basmati', 'riz')!;
    const wordPrefix = scoreName('Galette de riz', 'riz')!;
    const substring = scoreName('Grizzli', 'riz')!;
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(wordPrefix);
    expect(wordPrefix).toBeGreaterThan(substring);
  });

  it('ignore accents, casse et ligatures', () => {
    expect(scoreName('Crème fraîche', 'creme')).not.toBeNull();
    expect(scoreName('Œuf dur', 'oeuf')).not.toBeNull();
    expect(scoreName('POULET', 'poulet')).not.toBeNull();
  });

  it("coupe les mots sur l'apostrophe et le tiret", () => {
    expect(scoreName("Huile d'olive", 'olive')).toBeGreaterThan(scoreName('Grizzli', 'riz')!);
    expect(scoreName('Pain de mie sans-gluten', 'gluten')).not.toBeNull();
  });

  it('rattrape une faute de frappe, en dernier palier', () => {
    const fuzzy = scoreName('Blanc de poulet', 'poullet');
    const real = scoreName('Blanc de poulet', 'poulet')!;
    expect(fuzzy).not.toBeNull();
    expect(fuzzy!).toBeLessThan(real);
  });

  it('ne rend rien quand le terme est étranger au nom', () => {
    expect(scoreName('Courgette', 'saumon')).toBeNull();
  });

  it('préfère le nom le plus court à palier égal', () => {
    const court = scoreName("Huile d'olive", 'huile')!;
    const long = scoreName("Huile d'olive vierge extra biologique", 'huile')!;
    expect(court).toBeGreaterThan(long);
  });
});

describe('rankFoodMatches', () => {
  const catalogue: SearchableItem[] = [
    food('1', 'Chapelure de pain'),
    food('2', 'Pain complet'),
    food('3', 'Pain'),
    food('4', 'Pain de mie'),
    food('5', 'Courgette'),
  ];

  it('classe par pertinence, pas par ordre alphabétique — le défaut corrigé', () => {
    const names = rankFoodMatches(catalogue, 'pain').map((m) => m.item.name);
    expect(names[0]).toBe('Pain');
    expect(names.indexOf('Pain complet')).toBeLessThan(names.indexOf('Chapelure de pain'));
  });

  it('écarte ce qui ne correspond pas', () => {
    expect(rankFoodMatches(catalogue, 'pain').map((m) => m.item.name)).not.toContain('Courgette');
  });

  it('remonte un aliment récent à palier égal', () => {
    // « Pain complet » (2) et « Pain de mie » (4) sont tous deux des préfixes : seul le bonus
    // de brièveté les sépare, et le bonus « récent » doit pouvoir le renverser.
    const prefixes = catalogue.filter((f) => f.name.startsWith('Pain '));
    const sans = rankFoodMatches(prefixes, 'pain').map((m) => m.item.id);
    const avec = rankFoodMatches(prefixes, 'pain', { recentIds: ['2'] }).map((m) => m.item.id);
    expect(sans[0]).toBe('4');
    expect(avec[0]).toBe('2');
  });

  it('ne laisse jamais un bonus « récent » franchir un palier', () => {
    // « Pain » est une égalité exacte ; « Chapelure de pain » n'est qu'une sous-chaîne, même
    // récente. C'est la propriété qui garantit que le classement reste lisible.
    const ids = rankFoodMatches(catalogue, 'pain', { recentIds: ['1'] }).map((m) => m.item.id);
    expect(ids[0]).toBe('3');
  });

  it('rend les candidats dans leur ordre d’entrée quand le terme est vide', () => {
    const ids = rankFoodMatches(catalogue, '   ').map((m) => m.item.id);
    expect(ids).toEqual(['1', '2', '3', '4', '5']);
  });

  it('respecte la limite demandée', () => {
    expect(rankFoodMatches(catalogue, 'pain', { limit: 2 })).toHaveLength(2);
    expect(rankFoodMatches(catalogue, '', { limit: 3 })).toHaveLength(3);
  });

  it('départage aliment > recette > repas type à score égal', () => {
    const items: SearchableItem[] = [
      { id: 't', name: 'Bowl', kind: 'template' },
      { id: 'r', name: 'Bowl', kind: 'recipe' },
      { id: 'f', name: 'Bowl', kind: 'food' },
    ];
    expect(rankFoodMatches(items, 'bowl').map((m) => m.item.id)).toEqual(['f', 'r', 't']);
  });

  it('mélange les trois familles dans une seule liste classée (spec §5.2)', () => {
    const items: SearchableItem[] = [
      food('f1', 'Poulet rôti'),
      { id: 'r1', name: 'Poulet', kind: 'recipe' },
      { id: 't1', name: 'Mon déjeuner poulet', kind: 'template' },
    ];
    const ranked = rankFoodMatches(items, 'poulet');
    expect(ranked).toHaveLength(3);
    expect(ranked[0]!.item.id).toBe('r1'); // égalité exacte
  });

  it('garde un ordre stable entre deux appels identiques', () => {
    const a = rankFoodMatches(catalogue, 'pain').map((m) => m.item.id);
    const b = rankFoodMatches(catalogue, 'pain').map((m) => m.item.id);
    expect(a).toEqual(b);
  });
});
