/**
 * Repository des recettes (spec §5.1-5.2) : `recipes` + `recipe_ingredients`.
 * Valeurs nutritionnelles = somme des ingrédients (snapshot), portion = total / servings.
 * Table utilisateur (user_id).
 */

import { useQuery } from '@powersync/react';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, patch, softDelete } from './_sql';

export type RecipeListItem = {
  id: string;
  name: string;
  servings: number;
  totalKcal: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
};

export type RecipeIngredient = {
  id: string;
  foodId: string | null;
  name: string;
  quantityG: number | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

type RecipeDbRow = {
  id: string;
  name: string;
  servings: number;
  total_kcal: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
};

type IngredientDbRow = {
  id: string;
  food_id: string | null;
  name: string;
  quantity_g: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

const SELECT_RECIPES = `
  SELECT r.id, r.name, r.servings,
    COALESCE(SUM(i.kcal), 0) AS total_kcal,
    COALESCE(SUM(i.protein_g), 0) AS total_protein_g,
    COALESCE(SUM(i.carbs_g), 0) AS total_carbs_g,
    COALESCE(SUM(i.fat_g), 0) AS total_fat_g
  FROM recipes r
  LEFT JOIN recipe_ingredients i ON i.recipe_id = r.id AND i.deleted_at IS NULL
  WHERE r.deleted_at IS NULL
  GROUP BY r.id
  ORDER BY r.name COLLATE NOCASE
`;

const SELECT_INGREDIENTS = `
  SELECT id, food_id, name, quantity_g, kcal, protein_g, carbs_g, fat_g
  FROM recipe_ingredients WHERE recipe_id = ? AND deleted_at IS NULL ORDER BY created_at
`;

export function useRecipes(): { recipes: RecipeListItem[]; isLoading: boolean } {
  const { data, isLoading } = useQuery<RecipeDbRow>(SELECT_RECIPES);
  return {
    recipes: data.map((r) => ({
      id: r.id,
      name: r.name,
      servings: r.servings,
      totalKcal: Math.round(r.total_kcal),
      totalProteinG: Math.round(r.total_protein_g),
      totalCarbsG: Math.round(r.total_carbs_g),
      totalFatG: Math.round(r.total_fat_g),
    })),
    isLoading,
  };
}

export function useRecipeIngredients(recipeId: string): { ingredients: RecipeIngredient[]; isLoading: boolean } {
  const { data, isLoading } = useQuery<IngredientDbRow>(SELECT_INGREDIENTS, [recipeId]);
  return {
    ingredients: data.map((i) => ({
      id: i.id,
      foodId: i.food_id,
      name: i.name,
      quantityG: i.quantity_g,
      kcal: i.kcal,
      proteinG: i.protein_g,
      carbsG: i.carbs_g,
      fatG: i.fat_g,
    })),
    isLoading,
  };
}

function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new Error('Aucune session active : impossible d’écrire une recette.');
  return userId;
}

export async function createRecipe(name: string, servings: number): Promise<string> {
  return insertWithSyncFields('recipes', {
    user_id: currentUserId(),
    name: name.trim(),
    servings: Math.max(1, Math.round(servings)),
  });
}

export async function setRecipeServings(recipeId: string, servings: number): Promise<void> {
  await patch('recipes', recipeId, { servings: Math.max(1, Math.round(servings)) });
}

export async function addRecipeIngredient(
  recipeId: string,
  ingredient: { foodId: string | null; name: string; quantityG: number | null; kcal: number; proteinG: number; carbsG: number; fatG: number },
): Promise<string> {
  return insertWithSyncFields('recipe_ingredients', {
    recipe_id: recipeId,
    user_id: currentUserId(),
    food_id: ingredient.foodId,
    name: ingredient.name,
    quantity_g: ingredient.quantityG,
    kcal: ingredient.kcal,
    protein_g: ingredient.proteinG,
    carbs_g: ingredient.carbsG,
    fat_g: ingredient.fatG,
  });
}

export async function removeRecipeIngredient(id: string): Promise<void> {
  await softDelete('recipe_ingredients', id);
}

export async function deleteRecipe(id: string): Promise<void> {
  await softDelete('recipes', id);
}
