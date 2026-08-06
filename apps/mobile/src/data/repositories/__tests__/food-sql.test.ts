/**
 * Aliments — écritures et recherche par code-barres, sur **du vrai SQLite**.
 *
 * Un aliment est **partagé entre trois sources** : la bibliothèque CIQUAL (lecture seule, commune
 * à tout le monde), les aliments perso, et les produits importés d'OpenFoodFacts. Deux invariants
 * en découlent, tous deux invisibles à l'écran :
 *
 *  1. **Ce qui appartient à l'utilisateur porte son `owner_id` ; la bibliothèque non.** Un
 *     `owner_id` oublié à l'écriture ferait apparaître un aliment perso dans la bibliothèque
 *     partagée — donc chez tout le monde après synchro.
 *  2. **Le journal garde son snapshot.** Modifier ou supprimer un aliment ne doit **rien** changer
 *     aux repas déjà enregistrés (spec §8). Sans ça, corriger la fiche d'un aliment réécrirait
 *     rétroactivement des mois d'historique nutritionnel — et personne ne s'en apercevrait.
 *
 * S'y ajoute la recherche par code-barres, qui existe pour **éviter de réimporter** un produit
 * déjà scanné : si elle rate, la base se remplit de doublons au fil des scans.
 */

import {
  addCustomFood,
  deleteFood,
  findFoodByBarcode,
  getFood,
  importOpenFoodFactsFood,
  isEditableFood,
  toggleFoodFavorite,
  updateFood,
} from '../food-repository';
import { resetTestDb, rowsOf, seed } from '@/test-utils/sqlite-harness';

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

type FoodRow = {
  id: string;
  owner_id: string | null;
  source: string;
  barcode: string | null;
  category: string | null;
  kcal_per_100g: number | null;
  protein_per_100g: number | null;
  micronutrients: string | null;
};

type TranslationRow = { id: string; food_id: string; lang: string; name: string };

const foods = (d = false) => rowsOf<FoodRow>('foods', d);
const translations = (d = false) => rowsOf<TranslationRow>('food_translations', d);
const favorites = (d = false) => rowsOf<{ user_id: string; food_id: string }>('food_favorites', d);

const nameOf = (foodId: string) => translations().find((t) => t.food_id === foodId)?.name;

/** Formulaire d'aliment perso valide. */
const custom = (over?: Partial<Record<string, unknown>>) => ({
  name: 'Riz basmati',
  category: 'starchy' as const,
  kcalPer100g: 350,
  proteinPer100g: 7,
  carbsPer100g: 78,
  fatPer100g: 0.6,
  sugarsPer100g: 0.1,
  saturatedFatPer100g: 0.1,
  fiberPer100g: 1.3,
  micronutrients: {},
  ...over,
});

beforeEach(() => {
  resetTestDb();
});

// ---------------------------------------------------------------------------
// Aliment perso
// ---------------------------------------------------------------------------

describe('addCustomFood', () => {
  it('crée l’aliment au nom de l’utilisateur, avec sa traduction', async () => {
    const id = await addCustomFood(custom());

    expect(foods()).toEqual([
      expect.objectContaining({ id, owner_id: 'user-1', source: 'custom', kcal_per_100g: 350 }),
    ]);
    expect(nameOf(id)).toBe('Riz basmati');
  });

  it('porte un `owner_id` — sans lui, un aliment perso atterrirait dans la bibliothèque partagée', async () => {
    const id = await addCustomFood(custom());

    // La bibliothèque CIQUAL, elle, a `owner_id = NULL` : c'est ce seul champ qui sépare
    // « mon aliment » de « l'aliment de tout le monde ».
    expect(foods().find((f) => f.id === id)?.owner_id).toBe('user-1');
  });

  it('rogne le nom', async () => {
    const id = await addCustomFood(custom({ name: '  Riz basmati  ' }));

    expect(nameOf(id)).toBe('Riz basmati');
  });

  it('n’a pas de code-barres', async () => {
    const id = await addCustomFood(custom());

    expect(foods().find((f) => f.id === id)?.barcode).toBeNull();
  });
});

describe('updateFood', () => {
  it('met à jour les valeurs nutritionnelles', async () => {
    const id = await addCustomFood(custom());

    await updateFood(id, custom({ kcalPer100g: 360, proteinPer100g: 8 }));

    expect(foods()[0]).toMatchObject({ kcal_per_100g: 360, protein_per_100g: 8 });
  });

  it('met à jour la traduction existante sans créer de doublon', async () => {
    const id = await addCustomFood(custom());

    await updateFood(id, custom({ name: 'Riz complet' }));

    expect(translations().filter((t) => t.food_id === id)).toHaveLength(1);
    expect(nameOf(id)).toBe('Riz complet');
  });

  it('crée la traduction quand la langue courante n’en a pas encore', async () => {
    const [id] = seed('foods', [
      { owner_id: 'user-1', source: 'custom', category: 'starchy', kcal_per_100g: 350 },
    ]);
    seed('food_translations', [
      { food_id: id, owner_id: 'user-1', lang: 'en', name: 'Basmati rice' },
    ]);

    await updateFood(id!, custom({ name: 'Riz basmati' }));

    expect(translations().filter((t) => t.food_id === id)).toHaveLength(2);
    expect(translations().find((t) => t.lang === 'fr')?.name).toBe('Riz basmati');
  });

  it('ne ressuscite pas une traduction supprimée : elle en crée une neuve', async () => {
    const [id] = seed('foods', [
      { owner_id: 'user-1', source: 'custom', category: 'starchy', kcal_per_100g: 350 },
    ]);
    seed('food_translations', [
      {
        food_id: id,
        owner_id: 'user-1',
        lang: 'fr',
        name: 'Ancien',
        deleted_at: new Date().toISOString(),
      },
    ]);

    await updateFood(id!, custom({ name: 'Riz basmati' }));

    expect(translations().filter((t) => t.food_id === id)).toHaveLength(1);
    expect(nameOf(id!)).toBe('Riz basmati');
  });

  it('🔴 ne touche PAS aux entrées de journal déjà écrites (spec §8)', async () => {
    const id = await addCustomFood(custom());
    seed('food_entries', [
      {
        user_id: 'user-1',
        log_date: '2026-08-01',
        meal_type: 'lunch',
        order_index: 0,
        food_id: id,
        name: 'Riz basmati',
        quantity_g: 100,
        kcal: 350,
        protein_g: 7,
      },
    ]);

    await updateFood(id, custom({ name: 'Riz complet', kcalPer100g: 999 }));

    // Le journal est un **snapshot** : corriger une fiche ne doit pas réécrire rétroactivement
    // des mois d'historique nutritionnel — et personne ne s'en apercevrait.
    expect(rowsOf<{ name: string; kcal: number }>('food_entries')[0]).toMatchObject({
      name: 'Riz basmati',
      kcal: 350,
    });
  });
});

describe('deleteFood', () => {
  it('supprime en douceur, sans toucher au journal', async () => {
    const id = await addCustomFood(custom());
    seed('food_entries', [
      {
        user_id: 'user-1',
        log_date: '2026-08-01',
        meal_type: 'lunch',
        order_index: 0,
        food_id: id,
        name: 'Riz basmati',
        quantity_g: 100,
        kcal: 350,
      },
    ]);

    await deleteFood(id);

    expect(foods()).toHaveLength(0);
    expect(foods(true)).toHaveLength(1);
    // Seul l'aliment disparaît de la recherche ; le repas reste au journal.
    expect(rowsOf('food_entries')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Droit de modification
// ---------------------------------------------------------------------------

describe('isEditableFood', () => {
  it.each([
    ['custom', true],
    ['openfoodfacts', true],
    ['library', false],
  ])('« %s » → modifiable : %s', (source, expected) => {
    // La bibliothèque CIQUAL est partagée : la rendre modifiable laisserait un utilisateur
    // corriger l'aliment de tous les autres.
    expect(isEditableFood(source as never)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Import OpenFoodFacts et code-barres
// ---------------------------------------------------------------------------

describe('importOpenFoodFactsFood', () => {
  it('crée l’aliment avec sa source, son code-barres et son propriétaire', async () => {
    const id = await importOpenFoodFactsFood({
      name: 'Nutella',
      category: 'other',
      barcode: '3017620422003',
      kcalPer100g: 539,
    });

    expect(foods()[0]).toMatchObject({
      id,
      owner_id: 'user-1',
      source: 'openfoodfacts',
      barcode: '3017620422003',
      kcal_per_100g: 539,
    });
    expect(nameOf(id)).toBe('Nutella');
  });

  it('met les macros absentes à null plutôt qu’à zéro', async () => {
    const id = await importOpenFoodFactsFood({
      name: 'Produit incomplet',
      category: 'other',
      barcode: null,
      kcalPer100g: 100,
    });

    // Zéro affirmerait « 0 g de protéines » ; null dit « on ne sait pas ». La nuance compte
    // quand on additionne une journée.
    expect(foods().find((f) => f.id === id)?.protein_per_100g).toBeNull();
  });

  it('sérialise les micronutriments, même absents', async () => {
    const id = await importOpenFoodFactsFood({
      name: 'Produit',
      category: 'other',
      barcode: null,
      kcalPer100g: 100,
    });

    expect(JSON.parse(foods().find((f) => f.id === id)?.micronutrients ?? 'null')).toEqual({});
  });
});

describe('findFoodByBarcode', () => {
  it('retrouve un produit déjà importé — c’est ce qui évite les doublons au rescan', async () => {
    await importOpenFoodFactsFood({
      name: 'Nutella',
      category: 'other',
      barcode: '3017620422003',
      kcalPer100g: 539,
    });

    const found = await findFoodByBarcode('3017620422003', 'fr');

    expect(found?.name).toBe('Nutella');
  });

  it('rogne le code scanné', async () => {
    await importOpenFoodFactsFood({
      name: 'Nutella',
      category: 'other',
      barcode: '3017620422003',
      kcalPer100g: 539,
    });

    expect(await findFoodByBarcode('  3017620422003 ', 'fr')).not.toBeNull();
  });

  it('renvoie null sur un code vide, sans interroger la base', async () => {
    expect(await findFoodByBarcode('   ', 'fr')).toBeNull();
  });

  it('renvoie null sur un code inconnu', async () => {
    expect(await findFoodByBarcode('0000000000000', 'fr')).toBeNull();
  });

  it('ne retrouve pas un aliment supprimé — il serait réimportable', async () => {
    const id = await importOpenFoodFactsFood({
      name: 'Nutella',
      category: 'other',
      barcode: '3017620422003',
      kcalPer100g: 539,
    });
    await deleteFood(id);

    expect(await findFoodByBarcode('3017620422003', 'fr')).toBeNull();
  });
});

describe('getFood', () => {
  it('relit un aliment par son id', async () => {
    const id = await addCustomFood(custom());

    expect((await getFood(id, 'fr'))?.name).toBe('Riz basmati');
  });

  it('renvoie null sur un id inconnu', async () => {
    expect(await getFood('inconnu', 'fr')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Favoris
// ---------------------------------------------------------------------------

describe('toggleFoodFavorite', () => {
  it('ajoute puis retire, en soft delete', async () => {
    const id = await addCustomFood(custom());

    await toggleFoodFavorite(id);
    expect(favorites()).toEqual([
      expect.objectContaining({ user_id: 'user-1', food_id: id }),
    ]);

    await toggleFoodFavorite(id);
    expect(favorites()).toHaveLength(0);
    expect(favorites(true)).toHaveLength(1);
  });

  it('est réversible sans accumuler de lignes vivantes', async () => {
    const id = await addCustomFood(custom());

    await toggleFoodFavorite(id);
    await toggleFoodFavorite(id);
    await toggleFoodFavorite(id);

    expect(favorites()).toHaveLength(1);
  });

  it('ne mélange pas deux aliments', async () => {
    const a = await addCustomFood(custom({ name: 'A' }));
    const b = await addCustomFood(custom({ name: 'B' }));

    await toggleFoodFavorite(a);
    await toggleFoodFavorite(b);
    await toggleFoodFavorite(a);

    expect(favorites().map((f) => f.food_id)).toEqual([b]);
  });
});
