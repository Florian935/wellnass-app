/**
 * Repository du journal alimentaire (table `food_entries`, données utilisateur).
 *
 * Une entrée = un aliment (ou un quick add) ajouté à un repas d'une journée, avec un
 * **snapshot** des valeurs nutritionnelles (l'historique n'est pas recalculé, spec §8).
 * Le journal fonctionne 100 % hors-ligne (base locale PowerSync).
 */

import { useQuery } from '@powersync/react';
import type { Micronutrients } from '@wellness/shared';
import { parseMicronutrients } from '@wellness/shared';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, patch, softDelete } from './_sql';

/** Entrée du journal telle qu'affichée. */
export type JournalEntry = {
  id: string;
  mealType: string;
  foodId: string | null;
  name: string;
  quantityG: number | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Snapshot des micronutriments figés pour la quantité (socle 4.33). */
  micronutrients: Micronutrients;
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
  micronutrients: string | null;
};

const SELECT_DAY = `
  SELECT id, meal_type, food_id, name, quantity_g, kcal, protein_g, carbs_g, fat_g, micronutrients
  FROM food_entries
  WHERE log_date = ? AND deleted_at IS NULL
  ORDER BY order_index, created_at
`;

function rowToEntry(row: JournalDbRow): JournalEntry {
  return {
    id: row.id,
    mealType: row.meal_type,
    foodId: row.food_id,
    name: row.name,
    quantityG: row.quantity_g,
    kcal: row.kcal,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    micronutrients: parseMicronutrients(row.micronutrients),
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
  /** Micronutriments déjà mis à l'échelle pour la quantité (facultatif, socle 4.33). */
  micronutrients?: Micronutrients;
};

/**
 * Prochain `order_index` pour un repas donné : `MAX + 1` (même idiome que les autres
 * repos). On garde un petit entier séquentiel — surtout **pas** `Date.now()`, dont la
 * valeur en millisecondes dépasse le `integer` Postgres de `food_entries.order_index`
 * (l'upload PowerSync échouait alors avec « out of range for type integer »).
 */
async function nextOrderIndex(logDate: string, mealType: string): Promise<number> {
  const row = await powerSync.getOptional<{ max_index: number | null }>(
    `SELECT MAX(order_index) AS max_index FROM food_entries
     WHERE log_date = ? AND meal_type = ? AND deleted_at IS NULL`,
    [logDate, mealType],
  );
  const max = row?.max_index;
  return max === null || max === undefined ? 0 : max + 1;
}

/** Ajoute une entrée (aliment ou quick add) à un repas d'une journée. Retourne l'id. */
export async function addFoodEntry(
  date: string,
  mealType: string,
  snapshot: EntrySnapshot,
): Promise<string> {
  return insertWithSyncFields('food_entries', {
    user_id: currentUserId(),
    log_date: date,
    meal_type: mealType,
    order_index: await nextOrderIndex(date, mealType),
    food_id: snapshot.foodId,
    name: snapshot.name,
    quantity_g: snapshot.quantityG,
    kcal: snapshot.kcal,
    protein_g: snapshot.proteinG,
    carbs_g: snapshot.carbsG,
    fat_g: snapshot.fatG,
    micronutrients: JSON.stringify(snapshot.micronutrients ?? {}),
  });
}

/** Met à jour la quantité + le snapshot nutritionnel d'une entrée existante. */
export async function updateEntry(
  entryId: string,
  values: {
    quantityG: number;
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    micronutrients?: Micronutrients;
  },
): Promise<void> {
  await patch('food_entries', entryId, {
    quantity_g: values.quantityG,
    kcal: values.kcal,
    protein_g: values.proteinG,
    carbs_g: values.carbsG,
    fat_g: values.fatG,
    micronutrients: JSON.stringify(values.micronutrients ?? {}),
  });
}

/** Supprime (soft delete) une entrée du journal. */
export async function removeEntry(entryId: string): Promise<void> {
  await softDelete('food_entries', entryId);
}

type CopyRow = {
  meal_type: string;
  food_id: string | null;
  name: string;
  quantity_g: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  micronutrients: string | null;
};

const COPY_COLS =
  'meal_type, food_id, name, quantity_g, kcal, protein_g, carbs_g, fat_g, micronutrients';

/** Reconstruit un snapshot d'entrée à partir d'une ligne copiée (micros inclus). */
function copyRowToSnapshot(r: CopyRow): EntrySnapshot {
  return {
    foodId: r.food_id,
    name: r.name,
    quantityG: r.quantity_g,
    kcal: r.kcal,
    proteinG: r.protein_g,
    carbsG: r.carbs_g,
    fatG: r.fat_g,
    micronutrients: parseMicronutrients(r.micronutrients),
  };
}

/** Copie toutes les entrées d'un repas d'un jour source vers (date, meal). Retourne le nb copié (4.18). */
export async function copyMeal(fromDate: string, meal: string, toDate: string): Promise<number> {
  const rows = await powerSync.getAll<CopyRow>(
    `SELECT ${COPY_COLS}
     FROM food_entries WHERE log_date = ? AND meal_type = ? AND deleted_at IS NULL ORDER BY order_index, created_at`,
    [fromDate, meal],
  );
  for (const r of rows) {
    await addFoodEntry(toDate, meal, copyRowToSnapshot(r));
  }
  return rows.length;
}

/** Duplique le journal complet d'un jour source vers `toDate` (tous repas). Retourne le nb copié (4.18). */
export async function duplicateDay(fromDate: string, toDate: string): Promise<number> {
  const rows = await powerSync.getAll<CopyRow>(
    `SELECT ${COPY_COLS}
     FROM food_entries WHERE log_date = ? AND deleted_at IS NULL ORDER BY order_index, created_at`,
    [fromDate],
  );
  for (const r of rows) {
    await addFoodEntry(toDate, r.meal_type, copyRowToSnapshot(r));
  }
  return rows.length;
}
