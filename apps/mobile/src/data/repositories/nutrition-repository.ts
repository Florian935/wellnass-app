/**
 * Repository du profil nutritionnel (une ligne par compte — pilier Alimentation).
 *
 * Responsabilité unique : lire/écrire la table locale `nutrition_profiles` de PowerSync
 * et assurer le mapping snake_case (base) ↔ camelCase (domaine Zod `@wellness/shared`).
 *
 * Colonnes JSON (`restrictions`, `allergens`) stockées en TEXT côté SQLite
 * (déclaration PowerSync `column.text`), sérialisées / désérialisées explicitement ici.
 *
 * Règles offline-first (voir docs/specs/technical/offline-sync.md) :
 *  - UUID généré côté client (via `insertWithSyncFields`).
 *  - Timestamps en UTC.
 *  - `user_id` = utilisateur de la session courante (posé à l'insertion).
 *
 * PowerSync ne réplique que les lignes de l'utilisateur courant (bucket par JWT) :
 * en lecture, `WHERE deleted_at IS NULL LIMIT 1` suffit.
 */

import { useQuery } from '@powersync/react';
import type { DietRestriction, MealConfigItem, NutritionProfileRow } from '@wellness/shared';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, patch } from './_sql';

/** Profil nutritionnel applicatif (forme camelCase du domaine partagé). */
export type NutritionProfile = NutritionProfileRow;

/**
 * Champs applicatifs modifiables (hors champs de synchro `id`, `userId`,
 * timestamps, gérés automatiquement par la couche `_sql`).
 */
export type NutritionProfileInput = Pick<
  NutritionProfileRow,
  | 'objective'
  | 'activityLevel'
  | 'manualCalories'
  | 'manualProteinG'
  | 'manualCarbsG'
  | 'manualFatG'
  | 'restrictions'
  | 'allergens'
  | 'trainingDayBonus'
  | 'meals'
>;

/** Ligne brute renvoyée par SQLite (colonnes snake_case). */
type NutritionDbRow = {
  id: string;
  user_id: string;
  objective: string | null;
  activity_level: string;
  manual_calories: number | null;
  manual_protein_g: number | null;
  manual_carbs_g: number | null;
  manual_fat_g: number | null;
  restrictions: string | null;
  allergens: string | null;
  training_day_bonus: number | null;
  meals: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const SELECT_CURRENT =
  'SELECT * FROM nutrition_profiles WHERE deleted_at IS NULL LIMIT 1';

// ---------------------------------------------------------------------------
// Parsing sécurisé des colonnes JSON
// ---------------------------------------------------------------------------

/** Parse une colonne TEXT stockée en JSON ; retourne `fallback` si vide/invalide. */
function parseJsonColumn<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Mapping snake_case ↔ camelCase
// ---------------------------------------------------------------------------

/** Convertit une ligne SQLite (snake_case) → objet de domaine (camelCase). */
function rowToNutritionProfile(row: NutritionDbRow): NutritionProfile {
  return {
    id: row.id,
    userId: row.user_id,
    objective: row.objective as NutritionProfile['objective'],
    activityLevel: row.activity_level as NutritionProfile['activityLevel'],
    manualCalories: row.manual_calories,
    manualProteinG: row.manual_protein_g,
    manualCarbsG: row.manual_carbs_g,
    manualFatG: row.manual_fat_g,
    restrictions: parseJsonColumn<DietRestriction[]>(row.restrictions, []),
    allergens: parseJsonColumn<string[]>(row.allergens, []),
    trainingDayBonus: row.training_day_bonus ?? 0,
    meals: parseJsonColumn<MealConfigItem[] | null>(row.meals, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/** Convertit un patch de domaine (camelCase) → colonnes SQLite (snake_case). */
function inputToColumns(input: Partial<NutritionProfileInput>): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  if ('objective' in input) columns['objective'] = input.objective;
  if ('activityLevel' in input) columns['activity_level'] = input.activityLevel;
  if ('manualCalories' in input) columns['manual_calories'] = input.manualCalories;
  if ('manualProteinG' in input) columns['manual_protein_g'] = input.manualProteinG;
  if ('manualCarbsG' in input) columns['manual_carbs_g'] = input.manualCarbsG;
  if ('manualFatG' in input) columns['manual_fat_g'] = input.manualFatG;
  if ('restrictions' in input) columns['restrictions'] = JSON.stringify(input.restrictions ?? []);
  if ('allergens' in input) columns['allergens'] = JSON.stringify(input.allergens ?? []);
  if ('trainingDayBonus' in input) columns['training_day_bonus'] = input.trainingDayBonus;
  if ('meals' in input) columns['meals'] = input.meals ? JSON.stringify(input.meals) : null;
  return columns;
}

// ---------------------------------------------------------------------------
// Lecture réactive (hook)
// ---------------------------------------------------------------------------

/**
 * Profil nutritionnel de l'utilisateur courant, réactif aux changements de la base locale.
 *
 * `isLoading` ne dépend QUE de la résolution de la requête locale (SQLite), jamais de la
 * synchro réseau (offline-first, ADR-001 / décision B). Peut être `null` tant qu'aucun
 * profil nutritionnel n'a été créé : le consommateur applique alors les valeurs par défaut.
 */
export function useNutritionProfile(): {
  nutritionProfile: NutritionProfile | null;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery<NutritionDbRow>(SELECT_CURRENT);
  const row = data[0];
  const nutritionProfile = row ? rowToNutritionProfile(row) : null;
  return { nutritionProfile, isLoading };
}

// ---------------------------------------------------------------------------
// Écritures (hors contexte hook)
// ---------------------------------------------------------------------------

/** Identifiant de l'utilisateur de la session courante (lève si déconnecté). */
function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) {
    throw new Error('Aucune session active : impossible d’écrire le profil nutritionnel.');
  }
  return userId;
}

/** Lit la ligne courante (ou null) hors contexte réactif. */
async function getCurrentRow(): Promise<NutritionDbRow | null> {
  return powerSync.getOptional<NutritionDbRow>(SELECT_CURRENT);
}

/**
 * Crée ou met à jour le profil nutritionnel de l'utilisateur courant.
 * Patch la ligne existante si elle existe, sinon l'insère (avec `user_id`).
 */
export async function upsertNutritionProfile(
  patchInput: Partial<NutritionProfileInput>,
): Promise<void> {
  const columns = inputToColumns(patchInput);
  const existing = await getCurrentRow();

  if (existing) {
    await patch('nutrition_profiles', existing.id, columns);
    return;
  }

  await insertWithSyncFields('nutrition_profiles', {
    user_id: currentUserId(),
    ...columns,
  });
}
