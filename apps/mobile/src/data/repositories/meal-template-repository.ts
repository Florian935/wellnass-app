/**
 * Repository des repas types (spec §5.3) : `meal_templates` + `meal_template_items`.
 * Enregistre un repas entier (snapshot) et le réapplique en 1 tap. Table utilisateur.
 */

import { useQuery } from '@powersync/react';
import type { MealType } from '@wellness/shared';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { addFoodEntry, type EntrySnapshot } from './journal-repository';
import { insertWithSyncFields, softDelete } from './_sql';

export type MealTemplateItem = {
  id: string;
  name: string;
  itemCount: number;
  totalKcal: number;
};

type TemplateDbRow = {
  id: string;
  name: string;
  item_count: number;
  total_kcal: number;
};

type TemplateItemDbRow = {
  food_id: string | null;
  name: string;
  quantity_g: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

const SELECT_TEMPLATES = `
  SELECT t.id, t.name,
    COUNT(i.id) AS item_count,
    COALESCE(SUM(i.kcal), 0) AS total_kcal
  FROM meal_templates t
  LEFT JOIN meal_template_items i ON i.template_id = t.id AND i.deleted_at IS NULL
  WHERE t.deleted_at IS NULL
  GROUP BY t.id
  ORDER BY t.name COLLATE NOCASE
`;

export function useMealTemplates(): { templates: MealTemplateItem[]; isLoading: boolean } {
  const { data, isLoading } = useQuery<TemplateDbRow>(SELECT_TEMPLATES);
  return {
    templates: data.map((t) => ({
      id: t.id,
      name: t.name,
      itemCount: t.item_count,
      totalKcal: Math.round(t.total_kcal),
    })),
    isLoading,
  };
}

function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new Error('Aucune session active : impossible d’écrire un repas type.');
  return userId;
}

/** Enregistre une liste d'entrées (snapshots) comme repas type nommé. */
export async function saveMealAsTemplate(name: string, items: EntrySnapshot[]): Promise<string> {
  const userId = currentUserId();
  const templateId = await insertWithSyncFields('meal_templates', { user_id: userId, name: name.trim() });
  for (const it of items) {
    await insertWithSyncFields('meal_template_items', {
      template_id: templateId,
      user_id: userId,
      food_id: it.foodId,
      name: it.name,
      quantity_g: it.quantityG,
      kcal: it.kcal,
      protein_g: it.proteinG,
      carbs_g: it.carbsG,
      fat_g: it.fatG,
    });
  }
  return templateId;
}

/** Réapplique un repas type : ajoute tous ses items au repas (date, meal) donné. */
export async function applyTemplate(templateId: string, date: string, meal: MealType): Promise<void> {
  const items = await powerSync.getAll<TemplateItemDbRow>(
    `SELECT food_id, name, quantity_g, kcal, protein_g, carbs_g, fat_g
     FROM meal_template_items WHERE template_id = ? AND deleted_at IS NULL`,
    [templateId],
  );
  for (const it of items) {
    await addFoodEntry(date, meal, {
      foodId: it.food_id,
      name: it.name,
      quantityG: it.quantity_g,
      kcal: it.kcal,
      proteinG: it.protein_g,
      carbsG: it.carbs_g,
      fatG: it.fat_g,
    });
  }
}

export async function deleteMealTemplate(id: string): Promise<void> {
  await softDelete('meal_templates', id);
}
