/**
 * Repository de l'hydratation (US NUTRI-UX01, R5 — catalogue NUTR-12).
 *
 * Table `water_entries` : **une ligne par ajout**, jamais un total mis à jour. Ce choix est
 * offline-first avant d'être ergonomique — deux appareils qui boivent hors réseau produisent deux
 * lignes qui s'additionnent, là où un compteur unique s'écraserait au dernier écrivain — mais il
 * sert aussi le geste : « annuler » défait **le dernier verre posé**, avec son volume exact, sans
 * avoir à deviner de combien décrémenter un cumul.
 */

import { useQuery } from '@powersync/react';
import { DEFAULT_GLASS_ML } from '@wellness/shared';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, softDelete } from './_sql';

export type WaterEntry = { id: string; logDate: string; volumeMl: number };

type WaterTotalRow = { total_ml: number | null };
type WaterEntryRow = { id: string; log_date: string; volume_ml: number };

/** Volume maximal accepté pour un ajout unique (garde-fou aligné sur le `check` SQL). */
const MAX_SINGLE_ADD_ML = 5000;

/**
 * Total bu sur un jour donné, en ml. Requête agrégée plutôt que somme en mémoire : le journal la
 * réévalue à chaque rendu, et une journée peut porter une dizaine de lignes.
 */
export function useDayWater(dayKey: string): { totalMl: number; isLoading: boolean } {
  const { data, isLoading } = useQuery<WaterTotalRow>(
    `SELECT SUM(volume_ml) AS total_ml FROM water_entries
     WHERE log_date = ? AND deleted_at IS NULL`,
    [dayKey],
  );
  return { totalMl: data[0]?.total_ml ?? 0, isLoading };
}

/** Ajouts du jour, du plus récent au plus ancien (le premier est celui qu'« annuler » retire). */
export function useDayWaterEntries(dayKey: string): { entries: WaterEntry[]; isLoading: boolean } {
  const { data, isLoading } = useQuery<WaterEntryRow>(
    `SELECT id, log_date, volume_ml FROM water_entries
     WHERE log_date = ? AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [dayKey],
  );
  return {
    entries: data.map((r) => ({ id: r.id, logDate: r.log_date, volumeMl: r.volume_ml })),
    isLoading,
  };
}

function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new Error('Aucune session active : impossible d’enregistrer une boisson.');
  return userId;
}

/**
 * Ajoute un verre au jour donné.
 *
 * Le volume est **borné** avant écriture : la contrainte SQL rejetterait une valeur hors bornes,
 * et un rejet côté serveur **bloquerait la file d'upload PowerSync** — la leçon de REPAS-01 (D6),
 * qui vaut pour toute contrainte qu'un client peut violer.
 */
export async function addWater(dayKey: string, volumeMl: number = DEFAULT_GLASS_ML): Promise<void> {
  const volume = Math.round(volumeMl);
  if (!Number.isFinite(volume) || volume <= 0) return;
  await insertWithSyncFields('water_entries', {
    user_id: currentUserId(),
    log_date: dayKey,
    volume_ml: Math.min(MAX_SINGLE_ADD_ML, volume),
  });
}

/**
 * Retire le **dernier** ajout du jour. Sans effet si la journée est vide — c'est le cas normal
 * d'un double-tap sur « annuler », pas une erreur à signaler.
 */
export async function removeLastWater(dayKey: string): Promise<void> {
  const row = await powerSync.getOptional<{ id: string }>(
    `SELECT id FROM water_entries
     WHERE log_date = ? AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [dayKey],
  );
  if (!row) return;
  await softDelete('water_entries', row.id);
}
