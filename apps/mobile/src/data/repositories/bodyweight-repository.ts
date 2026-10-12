/**
 * Repository du poids corporel (spec §7.1) : `body_weight_entries` (une pesée / jour).
 * Table utilisateur (user_id). Poids stocké en kg (SI) ; conversion à l'affichage.
 */

import { useQuery } from '@powersync/react';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, patch } from './_sql';

export type WeightEntry = { id: string; logDate: string; weightKg: number };

type WeightDbRow = { id: string; log_date: string; weight_kg: number };

// Exportées pour le test de parité de NORYN-02 (`noryn02-parity-sql.test.ts`) : la fonction
// `noryn-context` doit retenir exactement les mêmes pesées que ces requêtes.
export const SELECT_WEIGHT_ENTRIES = `SELECT id, log_date, weight_kg FROM body_weight_entries WHERE deleted_at IS NULL ORDER BY log_date`;
export const SELECT_LATEST_WEIGHT = `SELECT id, log_date, weight_kg FROM body_weight_entries WHERE deleted_at IS NULL ORDER BY log_date DESC LIMIT 1`;

/** Pesées depuis `sinceDate` (AAAA-MM-JJ), ordonnées chronologiquement. */
export function useWeightEntries(sinceDate?: string): { entries: WeightEntry[]; isLoading: boolean } {
  const sql = sinceDate
    ? `SELECT id, log_date, weight_kg FROM body_weight_entries WHERE deleted_at IS NULL AND log_date >= ? ORDER BY log_date`
    : SELECT_WEIGHT_ENTRIES;
  const params = sinceDate ? [sinceDate] : [];
  const { data, isLoading } = useQuery<WeightDbRow>(sql, params);
  return {
    entries: data.map((r) => ({ id: r.id, logDate: r.log_date, weightKg: r.weight_kg })),
    isLoading,
  };
}

/** Dernière pesée enregistrée (ou null). */
export function useLatestWeight(): { latest: WeightEntry | null; isLoading: boolean } {
  const { data, isLoading } = useQuery<WeightDbRow>(SELECT_LATEST_WEIGHT);
  const r = data[0];
  return { latest: r ? { id: r.id, logDate: r.log_date, weightKg: r.weight_kg } : null, isLoading };
}

/** Dernière pesée en kg (ou null) — hors contexte hook. */
export async function getLatestWeightKg(): Promise<number | null> {
  const row = await powerSync.getOptional<{ weight_kg: number }>(
    `SELECT weight_kg FROM body_weight_entries WHERE deleted_at IS NULL ORDER BY log_date DESC LIMIT 1`,
  );
  return row?.weight_kg ?? null;
}

function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new Error('Aucune session active : impossible d’écrire une pesée.');
  return userId;
}

/** Enregistre le poids du jour (une pesée par jour : met à jour si déjà présente). */
export async function logWeight(date: string, weightKg: number): Promise<void> {
  const existing = await powerSync.getOptional<{ id: string }>(
    `SELECT id FROM body_weight_entries WHERE log_date = ? AND deleted_at IS NULL LIMIT 1`,
    [date],
  );
  if (existing) {
    await patch('body_weight_entries', existing.id, { weight_kg: weightKg });
    return;
  }
  await insertWithSyncFields('body_weight_entries', {
    user_id: currentUserId(),
    log_date: date,
    weight_kg: weightKg,
  });
}
