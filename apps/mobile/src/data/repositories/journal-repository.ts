/**
 * Repository du journal alimentaire (table `food_entries`, données utilisateur).
 *
 * Une entrée = un aliment (ou un quick add) ajouté à un repas d'une journée, avec un
 * **snapshot** des valeurs nutritionnelles (l'historique n'est pas recalculé, spec §8).
 * Le journal fonctionne 100 % hors-ligne (base locale PowerSync).
 */

import { useQuery } from '@powersync/react';
import type { Micronutrients } from '@wellness/shared';
import { computeJournalCompletion, localDayKey, parseMicronutrients } from '@wellness/shared';
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
  /** Horodatage de création (ISO UTC) — affiché dans le détail de l'entrée. */
  createdAt: string;
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
  created_at: string;
};

const SELECT_DAY = `
  SELECT id, meal_type, food_id, name, quantity_g, kcal, protein_g, carbs_g, fat_g, micronutrients, created_at
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
    createdAt: row.created_at,
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

/**
 * Met à jour une entrée existante. Deux usages :
 *  - entrée avec quantité : quantité + snapshot recalculé (règle de trois côté appelant) ;
 *  - quick add (sans quantité) : kcal/macros/nom saisis directement (quantityG = null).
 * `name`/`micronutrients` ne sont écrits que s'ils sont fournis (sinon inchangés).
 */
export async function updateEntry(
  entryId: string,
  values: {
    quantityG: number | null;
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    name?: string;
    micronutrients?: Micronutrients;
  },
): Promise<void> {
  const patchValues: Record<string, unknown> = {
    quantity_g: values.quantityG,
    kcal: values.kcal,
    protein_g: values.proteinG,
    carbs_g: values.carbsG,
    fat_g: values.fatG,
  };
  if (values.name !== undefined) patchValues.name = values.name;
  if (values.micronutrients !== undefined) {
    patchValues.micronutrients = JSON.stringify(values.micronutrients);
  }
  await patch('food_entries', entryId, patchValues);
}

/** Supprime (soft delete) une entrée du journal. */
export async function removeEntry(entryId: string): Promise<void> {
  await softDelete('food_entries', entryId);
}

/**
 * Réordonne une entrée au sein de son repas : échange son `order_index` avec l'entrée
 * voisine (au-dessus si `up`, en dessous si `down`). Sans voisin (extrémité), no-op.
 */
export async function moveEntry(entryId: string, direction: 'up' | 'down'): Promise<void> {
  const entry = await powerSync.getOptional<{
    id: string;
    log_date: string;
    meal_type: string;
    order_index: number;
  }>(
    `SELECT id, log_date, meal_type, order_index FROM food_entries WHERE id = ? AND deleted_at IS NULL`,
    [entryId],
  );
  if (!entry) return;

  const neighbor = await powerSync.getOptional<{ id: string; order_index: number }>(
    direction === 'up'
      ? `SELECT id, order_index FROM food_entries
         WHERE log_date = ? AND meal_type = ? AND deleted_at IS NULL AND order_index < ?
         ORDER BY order_index DESC LIMIT 1`
      : `SELECT id, order_index FROM food_entries
         WHERE log_date = ? AND meal_type = ? AND deleted_at IS NULL AND order_index > ?
         ORDER BY order_index ASC LIMIT 1`,
    [entry.log_date, entry.meal_type, entry.order_index],
  );
  if (!neighbor) return;

  await patch('food_entries', entry.id, { order_index: neighbor.order_index });
  await patch('food_entries', neighbor.id, { order_index: entry.order_index });
}

/**
 * Déplace une entrée vers un autre repas (change son `meal_type`) le même jour.
 * Récupère un `order_index` en fin du repas cible pour l'y placer proprement.
 * Sert notamment à récupérer une entrée « orpheline » (repas supprimé) via la
 * section « Autres » du journal. No-op si l'entrée est introuvable ou déjà dans le repas.
 */
export async function reassignEntryMeal(
  entryId: string,
  newMealKey: string,
): Promise<void> {
  const row = await powerSync.getOptional<{ log_date: string; meal_type: string }>(
    `SELECT log_date, meal_type FROM food_entries WHERE id = ? AND deleted_at IS NULL`,
    [entryId],
  );
  if (!row || row.meal_type === newMealKey) return;
  await patch('food_entries', entryId, {
    meal_type: newMealKey,
    order_index: await nextOrderIndex(row.log_date, newMealKey),
  });
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

// ---------------------------------------------------------------------------
// useJournalCompletion — carte NUTR-17 (régularité du journal)
// ---------------------------------------------------------------------------

/** Clé AAAA-MM-JJ locale du jour `n` jours avant aujourd'hui (miroir nutrition-stats/dashboard). */
const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDayKey(d);
};

const SELECT_FIRST_LOG_DATE =
  'SELECT MIN(log_date) AS first FROM food_entries WHERE deleted_at IS NULL';

/**
 * Régularité du journal (NUTR-17) sur les `windowDays` jours écoulés : part des jours renseignés,
 * dénominateur borné à l'ancienneté du compte (1ʳᵉ entrée), aujourd'hui exclu. Compose `useDailyTotals`
 * (jours renseignés) + `MIN(log_date)` (1ʳᵉ entrée) → règle pure `computeJournalCompletion`.
 */
export function useJournalCompletion(windowDays: number): {
  loggedDays: number;
  effectiveWindow: number;
  pct: number;
  isLoading: boolean;
} {
  const { totals, isLoading: totalsLoading } = useDailyTotals(daysAgo(windowDays));
  const { data, isLoading: firstLoading } = useQuery<{ first: string | null }>(SELECT_FIRST_LOG_DATE);
  const firstEntryDayKey = data[0]?.first ?? null;

  const { loggedDays, effectiveWindow, pct } = computeJournalCompletion({
    loggedDayKeys: totals.map((t) => t.logDate),
    firstEntryDayKey,
    windowDays,
    today: new Date(),
  });
  return { loggedDays, effectiveWindow, pct, isLoading: totalsLoading || firstLoading };
}
