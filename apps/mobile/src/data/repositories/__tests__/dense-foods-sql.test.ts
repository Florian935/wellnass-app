/**
 * US NUTR-F2 — vivier de repli : les aliments les plus **denses** de la base, sur du vrai SQLite.
 *
 * Ce vivier existe parce que la version livrée le 29/07/2026 ne piochait que dans les **aliments
 * récents**. La raison du report était bonne (ne pas charger CIQUAL en mémoire), mais elle laissait
 * un trou que la recette n'aurait pas forcément vu : **au lancement, aucun compte n'a d'aliment
 * récent**. La carte de suggestion ne pouvait donc rien proposer à 100 % des nouveaux
 * utilisateurs — exactement quand le conseil a le plus de valeur.
 *
 * Ce que la requête doit garantir, et qu'aucun test de composant ne verrait :
 *
 *  1. **Le tri est sur la densité rapportée aux CALORIES**, pas aux 100 g (décision D2). C'est
 *     toute la différence entre « l'aliment le plus riche » et « l'aliment le plus efficace » : le
 *     beurre est plus gras que l'amande au 100 g, mais il coûte bien plus cher en calories.
 *  2. **Les aliments sans valeur pour le macro sont écartés**, `NULL` comme `0`. Les garder
 *     consommerait la limite avec des lignes inutilisables.
 *  3. **Aucune division par zéro** : un aliment à 0 kcal ne doit pas remonter en tête avec une
 *     densité infinie.
 *  4. **Les aliments archivés restent dehors** (`deleted_at`), sinon on suggère un aliment retiré
 *     de la bibliothèque.
 */

import { selectDenseFoods } from '../food-repository';
import { resetTestDb, seed, getTestDb } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: { language: 'fr', t: (k: string) => k },
  resolveDeviceLocale: () => 'fr',
  getAppLanguage: () => 'fr',
}));

/** Exécute la requête d'un macro et rend les noms, dans l'ordre du tri. */
function noms(macro: 'protein' | 'carbs' | 'fat', limit = 15): string[] {
  const rows = getTestDb()
    .prepare(selectDenseFoods(macro))
    .all('fr', limit) as { name: string | null }[];
  return rows.map((r) => r.name ?? '');
}

/** Sème un aliment de bibliothèque avec sa traduction FR. */
function aliment(
  id: string,
  name: string,
  valeurs: {
    kcal: number;
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
    deleted?: boolean;
  },
) {
  seed('foods', [
    {
      id,
      owner_id: null,
      source: 'library',
      category: 'other',
      kcal_per_100g: valeurs.kcal,
      protein_per_100g: valeurs.protein ?? null,
      carbs_per_100g: valeurs.carbs ?? null,
      fat_per_100g: valeurs.fat ?? null,
      deleted_at: valeurs.deleted ? new Date().toISOString() : null,
    },
  ]);
  seed('food_translations', [{ id: `${id}-fr`, food_id: id, lang: 'fr', name }]);
}

beforeEach(() => {
  resetTestDb();
});

// ---------------------------------------------------------------------------
// Le tri : densité par calorie, pas par 100 g
// ---------------------------------------------------------------------------

describe('tri par densité', () => {
  it('🔴 classe sur le macro rapporté aux CALORIES, pas aux 100 g', () => {
    // Le blanc de poulet est moins protéiné au 100 g que le jambon sec, mais bien moins calorique :
    // c'est lui qui comble le mieux un manque de protéines sans manger le budget.
    aliment('poulet', 'Blanc de poulet', { kcal: 165, protein: 31 }); // 0,188 g/kcal
    aliment('jambon', 'Jambon sec', { kcal: 340, protein: 33 }); // 0,097 g/kcal

    // Un tri sur `protein_per_100g` mettrait le jambon devant (33 > 31). C'est exactement
    // l'erreur que la décision D2 écarte.
    expect(noms('protein')).toEqual(['Blanc de poulet', 'Jambon sec']);
  });

  it('classe les glucides de la même façon', () => {
    aliment('pdt', 'Pomme de terre', { kcal: 80, carbs: 17 }); // 0,212
    aliment('riz', 'Riz blanc', { kcal: 350, carbs: 78 }); // 0,223

    expect(noms('carbs')).toEqual(['Riz blanc', 'Pomme de terre']);
  });

  it('classe les lipides de la même façon', () => {
    aliment('huile', 'Huile d’olive', { kcal: 900, fat: 100 }); // 0,111
    aliment('avocat', 'Avocat', { kcal: 160, fat: 15 }); // 0,094

    expect(noms('fat')).toEqual(['Huile d’olive', 'Avocat']);
  });

  it('respecte la limite demandée', () => {
    aliment('a', 'A', { kcal: 100, protein: 30 });
    aliment('b', 'B', { kcal: 100, protein: 20 });
    aliment('c', 'C', { kcal: 100, protein: 10 });

    // La limite protège la mémoire : c'est elle qui remplace le « charger tout CIQUAL » qui avait
    // motivé le report du repli.
    expect(noms('protein', 2)).toEqual(['A', 'B']);
  });
});

// ---------------------------------------------------------------------------
// Ce qui doit rester dehors
// ---------------------------------------------------------------------------

describe('exclusions', () => {
  it('🔴 écarte les aliments sans valeur pour le macro visé', () => {
    aliment('poulet', 'Blanc de poulet', { kcal: 165, protein: 31 });
    aliment('huile', 'Huile', { kcal: 900, protein: null, fat: 100 });

    // `NULL` n'est pas « zéro protéine », c'est « on ne sait pas » — dans les deux cas la ligne
    // est inutilisable pour combler des protéines, et elle occuperait la limite.
    expect(noms('protein')).toEqual(['Blanc de poulet']);
  });

  it('🔴 écarte les aliments à zéro pour le macro visé', () => {
    aliment('poulet', 'Blanc de poulet', { kcal: 165, protein: 31 });
    aliment('sucre', 'Sucre', { kcal: 400, protein: 0, carbs: 100 });

    expect(noms('protein')).toEqual(['Blanc de poulet']);
    // Il reste bien candidat pour les glucides, lui.
    expect(noms('carbs')).toContain('Sucre');
  });

  it('🔴 écarte les aliments à zéro calorie — pas de division par zéro', () => {
    aliment('poulet', 'Blanc de poulet', { kcal: 165, protein: 31 });
    // Une ligne mal renseignée (0 kcal mais des protéines) donnerait une densité infinie et
    // trusterait la première place de toutes les suggestions.
    aliment('bug', 'Aliment mal saisi', { kcal: 0, protein: 50 });

    expect(noms('protein')).toEqual(['Blanc de poulet']);
  });

  it('🔴 écarte les aliments archivés', () => {
    aliment('poulet', 'Blanc de poulet', { kcal: 165, protein: 31 });
    aliment('retire', 'Aliment retiré', { kcal: 100, protein: 40, deleted: true });

    // Suggérer un aliment retiré de la bibliothèque enverrait l'utilisateur ajouter au journal
    // quelque chose qui n'existe plus.
    expect(noms('protein')).toEqual(['Blanc de poulet']);
  });

  it('rend une liste vide quand la base n’a rien d’exploitable', () => {
    aliment('vide', 'Sans macros', { kcal: 100 });

    expect(noms('protein')).toEqual([]);
    expect(noms('carbs')).toEqual([]);
    expect(noms('fat')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Langue
// ---------------------------------------------------------------------------

describe('résolution du nom', () => {
  it('rend le nom dans la langue demandée', () => {
    aliment('poulet', 'Blanc de poulet', { kcal: 165, protein: 31 });
    seed('food_translations', [
      { id: 'poulet-en', food_id: 'poulet', lang: 'en', name: 'Chicken breast' },
    ]);

    const rows = getTestDb().prepare(selectDenseFoods('protein')).all('en', 15) as {
      name: string | null;
    }[];
    expect(rows.map((r) => r.name)).toEqual(['Chicken breast']);
  });

  it('retombe sur le français quand la traduction manque', () => {
    aliment('poulet', 'Blanc de poulet', { kcal: 165, protein: 31 });

    const rows = getTestDb().prepare(selectDenseFoods('protein')).all('en', 15) as {
      name: string | null;
    }[];
    // Un aliment sans traduction EN doit rester **suggérable**, pas disparaître du vivier.
    expect(rows.map((r) => r.name)).toEqual(['Blanc de poulet']);
  });
});
