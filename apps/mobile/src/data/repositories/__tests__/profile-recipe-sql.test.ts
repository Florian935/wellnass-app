/**
 * Profil et recettes — écritures sur **du vrai SQLite**.
 *
 * Le point dur est le **poids de départ** (règle NUTR-11) : il est figé au moment où la cible est
 * posée, et c'est lui qui sert de référence à toute la progression affichée. Deux façons de le
 * casser, aucune visible à l'écran :
 *
 *  - **le ré-ancrer à tort** — enregistrer la même cible une seconde fois remettrait le départ au
 *    poids d'aujourd'hui, et la progression repartirait de zéro alors que rien n'a changé ;
 *  - **le prendre à la mauvaise source** — c'est la dernière **pesée** qui fait foi, pas le poids
 *    du profil, lequel peut dater de l'onboarding.
 *
 * Côté recettes : un ingrédient est un **snapshot** comme une entrée de journal, et les portions
 * ont un plancher à 1 — diviser par zéro produirait des macros infinies.
 */

import {
  completeOnboarding,
  dismissActivationPath,
  setWeightTarget,
  upsertProfile,
} from '../profile-repository';
import {
  addRecipeIngredient,
  createRecipe,
  deleteRecipe,
  removeRecipeIngredient,
  setRecipeServings,
} from '../recipe-repository';
import { resetTestDb, rowsOf, seed } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

type ProfileRow = {
  id: string;
  user_id: string;
  first_name: string | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  start_weight_kg: number | null;
  onboarding_completed_at: string | null;
  activation_path_dismissed_at: string | null;
};

type RecipeRow = { id: string; user_id: string; name: string; servings: number };
type IngredientRow = {
  id: string;
  recipe_id: string;
  name: string;
  quantity_g: number | null;
  kcal: number;
};

const profiles = (d = false) => rowsOf<ProfileRow>('profiles', d);
const profile = () => profiles()[0];
const recipes = (d = false) => rowsOf<RecipeRow>('recipes', d);
const ingredients = (d = false) => rowsOf<IngredientRow>('recipe_ingredients', d);

/** Une pesée enregistrée à la date donnée. */
const seedWeight = (weightKg: number, logDate: string) =>
  seed('body_weight_entries', [{ user_id: 'user-1', weight_kg: weightKg, log_date: logDate }]);

const ingredient = (over?: Partial<Record<string, unknown>>) => ({
  foodId: null,
  name: 'Riz',
  quantityG: 100,
  kcal: 350,
  proteinG: 7,
  carbsG: 78,
  fatG: 0.6,
  ...over,
});

beforeEach(() => {
  resetTestDb();
});

// ---------------------------------------------------------------------------
// Profil
// ---------------------------------------------------------------------------

describe('upsertProfile', () => {
  it('crée la ligne au nom de l’utilisateur courant', async () => {
    await upsertProfile({ firstName: 'Damien', heightCm: 180 });

    expect(profiles()).toHaveLength(1);
    expect(profile()).toMatchObject({ user_id: 'user-1', first_name: 'Damien' });
  });

  it('met à jour sans créer de doublon', async () => {
    await upsertProfile({ firstName: 'Damien' });

    await upsertProfile({ firstName: 'Florian' });

    expect(profiles()).toHaveLength(1);
    expect(profile()?.first_name).toBe('Florian');
  });

  it('n’écrit QUE les clés fournies', async () => {
    await upsertProfile({ firstName: 'Damien', weightKg: 78 });

    await upsertProfile({ weightKg: 77 });

    expect(profile()).toMatchObject({ first_name: 'Damien', weight_kg: 77 });
  });

  it('ne ressuscite pas un profil supprimé : il en crée un neuf', async () => {
    seed('profiles', [
      { user_id: 'user-1', first_name: 'Ancien', deleted_at: new Date().toISOString() },
    ]);

    await upsertProfile({ firstName: 'Damien' });

    expect(profiles()).toHaveLength(1);
    expect(profile()?.first_name).toBe('Damien');
  });
});

describe('completeOnboarding / dismissActivationPath', () => {
  it('horodate la fin d’onboarding, en créant le profil au besoin', async () => {
    await completeOnboarding();

    expect(profiles()).toHaveLength(1);
    expect(profile()?.onboarding_completed_at).toEqual(expect.any(String));
  });

  it('ferme le parcours 7 jours sans toucher à l’onboarding', async () => {
    await completeOnboarding();
    const onboarding = profile()?.onboarding_completed_at;

    await dismissActivationPath();

    expect(profile()?.activation_path_dismissed_at).toEqual(expect.any(String));
    expect(profile()?.onboarding_completed_at).toBe(onboarding);
  });
});

// ---------------------------------------------------------------------------
// Poids cible — la règle NUTR-11
// ---------------------------------------------------------------------------

describe('setWeightTarget', () => {
  it('fige le poids de départ sur la DERNIÈRE pesée, pas sur le poids du profil', async () => {
    await upsertProfile({ weightKg: 85 }); // valeur d'onboarding, potentiellement ancienne
    seedWeight(80, '2026-07-01');
    seedWeight(78, '2026-08-01');

    await setWeightTarget(72);

    // C'est la pesée la plus récente qui fait foi : sinon la progression partirait d'un poids
    // que l'utilisateur n'a plus depuis des mois.
    expect(profile()).toMatchObject({ target_weight_kg: 72, start_weight_kg: 78 });
  });

  it('retombe sur le poids du profil quand aucune pesée n’existe', async () => {
    await upsertProfile({ weightKg: 85 });

    await setWeightTarget(78);

    expect(profile()?.start_weight_kg).toBe(85);
  });

  it('🔴 NE ré-ancre PAS le départ quand la cible est ré-enregistrée à l’identique', async () => {
    seedWeight(80, '2026-07-01');
    await setWeightTarget(72);
    seedWeight(76, '2026-08-01'); // l'utilisateur a perdu 4 kg entre-temps

    await setWeightTarget(72); // même cible, re-validée depuis l'écran

    // Ré-ancrer remettrait le départ à 76 : la progression déjà accomplie disparaîtrait de
    // l'écran, sans le moindre message.
    expect(profile()?.start_weight_kg).toBe(80);
  });

  it('ré-ancre le départ quand la cible CHANGE', async () => {
    seedWeight(80, '2026-07-01');
    await setWeightTarget(72);
    seedWeight(76, '2026-08-01');

    await setWeightTarget(70);

    expect(profile()).toMatchObject({ target_weight_kg: 70, start_weight_kg: 76 });
  });

  it('efface la cible ET le départ ensemble', async () => {
    seedWeight(80, '2026-07-01');
    await setWeightTarget(72);

    await setWeightTarget(null);

    // Garder un départ sans cible laisserait une progression orpheline, calculée vers rien.
    expect(profile()).toMatchObject({ target_weight_kg: null, start_weight_kg: null });
  });

  it('ignore une pesée supprimée pour ancrer le départ', async () => {
    await upsertProfile({ weightKg: 85 });
    seed('body_weight_entries', [
      {
        user_id: 'user-1',
        weight_kg: 70,
        log_date: '2026-08-01',
        deleted_at: new Date().toISOString(),
      },
    ]);

    await setWeightTarget(72);

    expect(profile()?.start_weight_kg).toBe(85);
  });
});

// ---------------------------------------------------------------------------
// Recettes
// ---------------------------------------------------------------------------

describe('createRecipe / setRecipeServings', () => {
  it('crée la recette au nom de l’utilisateur, nom rogné', async () => {
    const id = await createRecipe('  Chili  ', 4);

    expect(recipes()).toEqual([
      expect.objectContaining({ id, user_id: 'user-1', name: 'Chili', servings: 4 }),
    ]);
  });

  it.each([
    [0, 1],
    [-3, 1],
    [2.4, 2],
    [2.6, 3],
  ])('normalise %s portion(s) en %s', async (input, expected) => {
    // Plancher à 1 : diviser les macros par zéro produirait des valeurs infinies à l'écran.
    const id = await createRecipe('Chili', input);

    expect(recipes().find((r) => r.id === id)?.servings).toBe(expected);
  });

  it('applique la même normalisation à la modification', async () => {
    const id = await createRecipe('Chili', 4);

    await setRecipeServings(id, 0);

    expect(recipes()[0]?.servings).toBe(1);
  });
});

describe('ingrédients', () => {
  it('enregistre un SNAPSHOT — pas une référence à l’aliment', async () => {
    const recipeId = await createRecipe('Chili', 4);

    await addRecipeIngredient(recipeId, ingredient({ name: 'Riz basmati', kcal: 350 }));

    // Même raison que le journal alimentaire : corriger la fiche d'un aliment ne doit pas
    // déformer une recette écrite il y a six mois.
    expect(ingredients()[0]).toMatchObject({
      recipe_id: recipeId,
      name: 'Riz basmati',
      kcal: 350,
      quantity_g: 100,
    });
  });

  it('accepte un ingrédient libre, sans aliment de référence', async () => {
    const recipeId = await createRecipe('Chili', 4);

    await addRecipeIngredient(recipeId, ingredient({ foodId: null, quantityG: null }));

    expect(ingredients()).toHaveLength(1);
    expect(ingredients()[0]?.quantity_g).toBeNull();
  });

  it('retire un ingrédient en soft delete, sans toucher aux autres', async () => {
    const recipeId = await createRecipe('Chili', 4);
    const a = await addRecipeIngredient(recipeId, ingredient({ name: 'Riz' }));
    await addRecipeIngredient(recipeId, ingredient({ name: 'Haricots' }));

    await removeRecipeIngredient(a);

    expect(ingredients().map((i) => i.name)).toEqual(['Haricots']);
    expect(ingredients(true)).toHaveLength(2);
  });

  it('ne mélange pas deux recettes', async () => {
    const chili = await createRecipe('Chili', 4);
    const soupe = await createRecipe('Soupe', 2);
    await addRecipeIngredient(chili, ingredient({ name: 'Riz' }));
    await addRecipeIngredient(soupe, ingredient({ name: 'Poireau' }));

    expect(ingredients().filter((i) => i.recipe_id === chili).map((i) => i.name)).toEqual(['Riz']);
  });
});

describe('deleteRecipe', () => {
  it('supprime la recette en douceur', async () => {
    const id = await createRecipe('Chili', 4);

    await deleteRecipe(id);

    expect(recipes()).toHaveLength(0);
    expect(recipes(true)).toHaveLength(1);
  });

  it('ne touche pas une autre recette', async () => {
    const cible = await createRecipe('Chili', 4);
    await createRecipe('Soupe', 2);

    await deleteRecipe(cible);

    expect(recipes().map((r) => r.name)).toEqual(['Soupe']);
  });
});
