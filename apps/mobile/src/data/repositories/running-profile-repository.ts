/**
 * Repository du profil coureur (une ligne par compte — pilier Running).
 *
 * Responsabilité unique : lire/écrire la table locale `running_profiles` de PowerSync
 * et assurer le mapping snake_case (base) ↔ camelCase (domaine `@wellness/shared`).
 *
 * Colonnes scalaires uniquement (`objective`, `level`, `ref_5k_pace_s_per_km`,
 * `weekly_frequency`) : pas de sérialisation JSON nécessaire.
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
import type { RunnerObjective, RunnerLevel } from '@wellness/shared';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, patch } from './_sql';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Ligne brute renvoyée par SQLite (colonnes snake_case). */
type RunnerProfileDbRow = {
  id: string;
  user_id: string;
  objective: string | null;
  level: string | null;
  ref_5k_pace_s_per_km: number | null;
  weekly_frequency: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Profil coureur de domaine (camelCase). */
export type RunnerProfile = {
  id: string;
  userId: string;
  objective: RunnerObjective | null;
  level: RunnerLevel | null;
  ref5kPaceSPerKm: number | null;
  weeklyFrequency: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/**
 * Champs applicatifs modifiables (hors champs de synchro `id`, `userId`,
 * timestamps, gérés automatiquement par la couche `_sql`).
 */
export type RunnerProfileInput = Pick<
  RunnerProfile,
  | 'objective'
  | 'level'
  | 'ref5kPaceSPerKm'
  | 'weeklyFrequency'
>;

// ---------------------------------------------------------------------------
// Requête de base
// ---------------------------------------------------------------------------

const SELECT_CURRENT =
  'SELECT * FROM running_profiles WHERE deleted_at IS NULL LIMIT 1';

// ---------------------------------------------------------------------------
// Mapping snake_case ↔ camelCase
// ---------------------------------------------------------------------------

/** Convertit une ligne SQLite (snake_case) → objet de domaine (camelCase). */
function rowToRunnerProfile(row: RunnerProfileDbRow): RunnerProfile {
  return {
    id: row.id,
    userId: row.user_id,
    objective: row.objective as RunnerProfile['objective'],
    level: row.level as RunnerProfile['level'],
    ref5kPaceSPerKm: row.ref_5k_pace_s_per_km,
    weeklyFrequency: row.weekly_frequency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/** Convertit un patch de domaine (camelCase) → colonnes SQLite (snake_case). */
function inputToColumns(input: Partial<RunnerProfileInput>): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  if ('objective' in input) columns['objective'] = input.objective;
  if ('level' in input) columns['level'] = input.level;
  if ('ref5kPaceSPerKm' in input) columns['ref_5k_pace_s_per_km'] = input.ref5kPaceSPerKm;
  if ('weeklyFrequency' in input) columns['weekly_frequency'] = input.weeklyFrequency;
  return columns;
}

// ---------------------------------------------------------------------------
// Lecture réactive (hook)
// ---------------------------------------------------------------------------

/**
 * Profil coureur de l'utilisateur courant, réactif aux changements de la base locale.
 *
 * `isLoading` ne dépend QUE de la résolution de la requête locale (SQLite), jamais de la
 * synchro réseau (offline-first, ADR-001 / décision B). Peut être `null` tant qu'aucun
 * profil coureur n'a été créé : le consommateur applique alors les valeurs par défaut.
 */
export function useRunnerProfile(): {
  runnerProfile: RunnerProfile | null;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery<RunnerProfileDbRow>(SELECT_CURRENT);
  const row = data[0];
  const runnerProfile = row ? rowToRunnerProfile(row) : null;
  return { runnerProfile, isLoading };
}

// ---------------------------------------------------------------------------
// Écritures (hors contexte hook)
// ---------------------------------------------------------------------------

/** Identifiant de l'utilisateur de la session courante (lève si déconnecté). */
function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) {
    throw new Error("Aucune session active : impossible d'écrire le profil coureur.");
  }
  return userId;
}

/** Lit la ligne courante (ou null) hors contexte réactif. */
async function getCurrentRow(): Promise<RunnerProfileDbRow | null> {
  return powerSync.getOptional<RunnerProfileDbRow>(SELECT_CURRENT);
}

/**
 * Crée ou met à jour le profil coureur de l'utilisateur courant.
 * Patch la ligne existante si elle existe, sinon l'insère (avec `user_id`).
 */
export async function upsertRunnerProfile(
  patchInput: Partial<RunnerProfileInput>,
): Promise<void> {
  const columns = inputToColumns(patchInput);
  const existing = await getCurrentRow();

  if (existing) {
    await patch('running_profiles', existing.id, columns);
    return;
  }

  await insertWithSyncFields('running_profiles', {
    user_id: currentUserId(),
    ...columns,
  });
}
