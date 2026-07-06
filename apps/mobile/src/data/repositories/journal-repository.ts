/**
 * Repository du journal alimentaire (table `food_entries`, données utilisateur).
 *
 * Une entrée = un aliment (ou un quick add) ajouté à un repas d'une journée, avec un
 * **snapshot** des valeurs nutritionnelles (l'historique n'est pas recalculé, spec §8).
 * Le journal fonctionne 100 % hors-ligne (base locale PowerSync).
 */

import { useQuery } from '@powersync/react';
import type { MealType } from '@wellness/shared';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, patch, softDelete } from './_sql';

/** Entrée du journal telle qu'affichée. */
export type JournalEntry = {
  id: string;
  mealType: MealType;
  foodId: string | null;
  name: string;
  quantityG: number | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

type JournalDbRow = {
  id: string;
  meal_type: string;
  food_id: string | null;
  name: string;
  quantity_g: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

const SELECT_DAY = `
  SELECT id, meal_type, food_id, name, quantity_g, kcal, protein_g, carbs_g, fat_g
  FROM food_entries
  WHERE log_date = ? AND deleted_at IS NULL
  ORDER BY order_index, created_at
`;

function rowToEntry(row: JournalDbRow): JournalEntry {
  return {
    id: row.id,
    mealType: row.meal_type as MealType,
    foodId: row.food_id,
    name: row.name,
    quantityG: row.quantity_g,
    kcal: row.kcal,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
  };
}

/** Entrées d'une journée (`date` au format AAAA-MM-JJ), réactives. */
export function useDayEntries(date: string): { entries: JournalEntry[]; isLoading: boolean } {
  const { data, isLoading } = useQuery<JournalDbRow>(SELECT_DAY, [date]);
  return { entries: data.map(rowToEntry), isLoading };
}

/** Total nutritionnel par jour renseigné depuis `sinceDate` (stats §7.2). */
export type DailyTotal = { logDate: string; kcal: number; proteinG: number; carbsG: number; fatG: number };

const SELECT_DAILY_TOTALS = `
  SELECT log_date,
    SUM(kcal) AS kcal, SUM(protein_g) AS protein_g, SUM(carbs_g) AS carbs_g, SUM(fat_g) AS fat_g
  FROM food_entries
  WHERE deleted_at IS NULL AND log_date >= ?
  GROUP BY log_date
  ORDER BY log_date
`;

export function useDailyTotals(sinceDate: string): { totals: DailyTotal[]; isLoading: boolean } {
  const { data, isLoading } = useQuery<{
    log_date: string;
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>(SELECT_DAILY_TOTALS, [sinceDate]);
  return {
    totals: data.map((r) => ({
      logDate: r.log_date,
      kcal: Math.round(r.kcal),
      proteinG: Math.round(r.protein_g),
      carbsG: Math.round(r.carbs_g),
      fatG: Math.round(r.fat_g),
    })),
    isLoading,
  };
}

// ---------------------------------------------------------------------------
// Écritures
// ---------------------------------------------------------------------------

function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) {
    throw new Error("Aucune session active : impossible d'écrire dans le journal.");
  }
  return userId;
}

export type EntrySnapshot = {
  foodId: string | null;
  name: string;
  quantityG: number | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/** Ajoute une entrée (aliment ou quick add) à un repas d'une journée. Retourne l'id. */
export async function addFoodEntry(
  date: string,
  mealType: MealType,
  snapshot: EntrySnapshot,
): Promise<string> {
  return insertWithSyncFields('food_entries', {
    user_id: currentUserId(),
    log_date: date,
    meal_type: mealType,
    order_index: Date.now(),
    food_id: snapshot.foodId,
    name: snapshot.name,
    quantity_g: snapshot.quantityG,
    kcal: snapshot.kcal,
    protein_g: snapshot.proteinG,
    carbs_g: snapshot.carbsG,
    fat_g: snapshot.fatG,
  });
}

/** Met à jour la quantité + le snapshot nutritionnel d'une entrée existante. */
export async function updateEntry(
  entryId: string,
  values: { quantityG: number; kcal: number; proteinG: number; carbsG: number; fatG: number },
): Promise<void> {
  await patch('food_entries', entryId, {
    quantity_g: values.quantityG,
    kcal: values.kcal,
    protein_g: values.proteinG,
    carbs_g: values.carbsG,
    fat_g: values.fatG,
  });
}

/** Supprime (soft delete) une entrée du journal. */
export async function removeEntry(entryId: string): Promise<void> {
  await softDelete('food_entries', entryId);
}
