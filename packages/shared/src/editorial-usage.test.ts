import { describe, expect, it } from 'vitest';

import {
  EDITORIAL_KINDS,
  USAGE_KEYS,
  summarizeUsage,
} from './editorial-usage';

describe('summarizeUsage', () => {
  it('agrège et n’expose que les lignes non nulles, dans l’ordre d’affichage', () => {
    const s = summarizeUsage('exercise', {
      workout_sets: 128,
      exercise_plans: 3,
      personal_records: 0,
      exercise_variants: 2,
    });

    expect(s.total).toBe(133);
    expect(s.isUnused).toBe(false);
    expect(s.unavailable).toBe(false);
    expect(s.lines).toEqual([
      { key: 'workout_sets', count: 128 },
      { key: 'exercise_plans', count: 3 },
      { key: 'exercise_variants', count: 2 },
    ]);
  });

  it('marque isUnused quand tout est à zéro — c’est l’info qui permet d’archiver sereinement', () => {
    const s = summarizeUsage('food', {
      food_entries: 0,
      recipe_ingredients: 0,
      meal_template_items: 0,
    });

    expect(s.total).toBe(0);
    expect(s.isUnused).toBe(true);
    expect(s.unavailable).toBe(false);
    expect(s.lines).toEqual([]);
  });

  it('traite un objet vide comme un vrai « aucun usage »', () => {
    // La fonction SQL lève sur un type inconnu plutôt que de renvoyer `{}` : un objet vide ne peut
    // donc pas venir d'une faute de frappe, c'est bien l'absence de référence.
    const s = summarizeUsage('program', {});
    expect(s.isUnused).toBe(true);
    expect(s.unavailable).toBe(false);
  });

  it('DISTINGUE « décompte indisponible » de « aucun usage »', () => {
    // Le cas qui compte : un échec d'appel ne doit jamais se lire comme un zéro rassurant.
    for (const raw of [null, undefined]) {
      const s = summarizeUsage('exercise', raw);
      expect(s.unavailable).toBe(true);
      expect(s.isUnused).toBe(false);
    }
  });

  it('ignore les clés inconnues et les valeurs aberrantes', () => {
    const s = summarizeUsage('exercise', {
      workout_sets: 5,
      inconnu: 999,
      exercise_plans: -3,
      personal_records: 'pas un nombre',
      exercise_variants: null,
    });

    expect(s.total).toBe(5);
    expect(s.lines).toEqual([{ key: 'workout_sets', count: 5 }]);
  });

  it('accepte les nombres rendus en chaîne (jsonb ↔ bigint)', () => {
    // `count(*)` est un bigint : selon le pilote, il peut arriver en chaîne.
    const s = summarizeUsage('food', { food_entries: '42', recipe_ingredients: '0' });
    expect(s.total).toBe(42);
    expect(s.lines).toEqual([{ key: 'food_entries', count: 42 }]);
  });

  it('couvre les 3 types de contenu éditorial', () => {
    expect(EDITORIAL_KINDS).toEqual(['exercise', 'program', 'food']);
    for (const kind of EDITORIAL_KINDS) {
      expect(USAGE_KEYS[kind].length).toBeGreaterThan(0);
      // Chaque type doit savoir répondre « aucun usage » sans planter.
      expect(summarizeUsage(kind, {}).isUnused).toBe(true);
    }
  });
});
