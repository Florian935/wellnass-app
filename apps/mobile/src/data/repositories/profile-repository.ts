/**
 * Repository du profil utilisateur (une ligne par compte).
 *
 * Responsabilité unique : lire/écrire la table locale `profiles` de PowerSync et
 * assurer le mapping snake_case (base) ↔ camelCase (domaine Zod `@wellness/shared`).
 *
 * Règles offline-first (voir docs/specs/technical/offline-sync.md) :
 *  - UUID généré côté client (via `insertWithSyncFields`).
 *  - Timestamps en UTC.
 *  - `user_id` = utilisateur de la session courante (posé à l'insertion).
 *
 * PowerSync ne réplique que les lignes de l'utilisateur courant (bucket par JWT) :
 * en lecture, on peut donc se contenter de `WHERE deleted_at IS NULL LIMIT 1`
 * (pas besoin de filtrer sur `user_id`). En écriture, `user_id` reste obligatoire.
 */

import { useQuery } from '@powersync/react';
import type { ProfileRow } from '@wellness/shared';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, nowUtc, patch } from './_sql';

/** Profil applicatif (forme camelCase du domaine partagé). */
export type Profile = ProfileRow;

/**
 * Champs applicatifs modifiables du profil (hors champs de synchro `id`, `userId`,
 * timestamps, gérés automatiquement par la couche `_sql`).
 */
export type ProfileInput = Pick<
  ProfileRow,
  | 'firstName'
  | 'birthDate'
  | 'sex'
  | 'heightCm'
  | 'weightKg'
  | 'targetWeightKg'
  | 'startWeightKg'
  | 'mainGoal'
  | 'onboardingCompletedAt'
>;

/** Ligne brute renvoyée par SQLite (colonnes snake_case). */
type ProfileDbRow = {
  id: string;
  user_id: string;
  first_name: string | null;
  birth_date: string | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  start_weight_kg: number | null;
  main_goal: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const SELECT_CURRENT = 'SELECT * FROM profiles WHERE deleted_at IS NULL LIMIT 1';

// ---------------------------------------------------------------------------
// Mapping snake_case ↔ camelCase
// ---------------------------------------------------------------------------

/** Convertit une ligne SQLite (snake_case) → objet de domaine (camelCase). */
function rowToProfile(row: ProfileDbRow): Profile {
  return {
    id: row.id,
    userId: row.user_id,
    firstName: row.first_name,
    birthDate: row.birth_date,
    sex: row.sex as Profile['sex'],
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    targetWeightKg: row.target_weight_kg,
    startWeightKg: row.start_weight_kg,
    mainGoal: row.main_goal as Profile['mainGoal'],
    onboardingCompletedAt: row.onboarding_completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/** Convertit un patch de domaine (camelCase) → colonnes SQLite (snake_case). */
function inputToColumns(input: Partial<ProfileInput>): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  if ('firstName' in input) columns['first_name'] = input.firstName;
  if ('birthDate' in input) columns['birth_date'] = input.birthDate;
  if ('sex' in input) columns['sex'] = input.sex;
  if ('heightCm' in input) columns['height_cm'] = input.heightCm;
  if ('weightKg' in input) columns['weight_kg'] = input.weightKg;
  if ('targetWeightKg' in input) columns['target_weight_kg'] = input.targetWeightKg;
  if ('startWeightKg' in input) columns['start_weight_kg'] = input.startWeightKg;
  if ('mainGoal' in input) columns['main_goal'] = input.mainGoal;
  if ('onboardingCompletedAt' in input) {
    columns['onboarding_completed_at'] = input.onboardingCompletedAt;
  }
  return columns;
}

// ---------------------------------------------------------------------------
// Lecture réactive (hook)
// ---------------------------------------------------------------------------

/**
 * Profil de l'utilisateur courant, réactif aux changements de la base locale.
 *
 * `isLoading` ne dépend QUE de la résolution de la requête locale (SQLite),
 * jamais de la synchro réseau : le routage / contenu ne doit pas se bloquer sur
 * une synchro réseau (offline-first, ADR-001 / décision B). La base locale est
 * disponible hors-ligne ; `useQuery.isLoading` se résout sans réseau.
 *
 * Remplace le drapeau `hasHydrated` des ex-stores Zustand.
 */
export function useProfile(): { profile: Profile | null; isLoading: boolean } {
  const { data, isLoading: queryLoading } = useQuery<ProfileDbRow>(SELECT_CURRENT);

  const isLoading = queryLoading;
  const row = data[0];
  const profile = row ? rowToProfile(row) : null;

  return { profile, isLoading };
}

// ---------------------------------------------------------------------------
// Écritures (hors contexte hook)
// ---------------------------------------------------------------------------

/** Identifiant de l'utilisateur de la session courante (lève si déconnecté). */
function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) {
    throw new Error('Aucune session active : impossible d’écrire le profil.');
  }
  return userId;
}

/** Lit la ligne de profil courante (ou null) hors contexte réactif. */
async function getCurrentRow(): Promise<ProfileDbRow | null> {
  return powerSync.getOptional<ProfileDbRow>(SELECT_CURRENT);
}

/**
 * Crée ou met à jour le profil de l'utilisateur courant.
 * Met à jour la ligne existante si elle existe, sinon l'insère (avec `user_id`).
 */
export async function upsertProfile(patchInput: Partial<ProfileInput>): Promise<void> {
  const columns = inputToColumns(patchInput);
  const existing = await getCurrentRow();

  if (existing) {
    await patch('profiles', existing.id, columns);
    return;
  }

  await insertWithSyncFields('profiles', {
    user_id: currentUserId(),
    ...columns,
  });
}

/**
 * Marque l'onboarding comme terminé (`onboarding_completed_at = maintenant UTC`).
 * Crée la ligne de profil au besoin.
 */
export async function completeOnboarding(): Promise<void> {
  await upsertProfile({ onboardingCompletedAt: nowUtc() });
}
