/**
 * Repository du check-in de bien-être (US BIEN-01) : table `daily_wellbeing`, une ligne par jour.
 *
 * Toute la logique de décision (échelle valide, check-in vide, fenêtre de rattrapage, séries et
 * moyennes) vit dans `@wellness/shared` (`wellbeing.ts`, testée sous Vitest) : ici, uniquement des
 * entrées/sorties SQL.
 *
 * ⚠️ **Le poids n'est pas géré ici.** Il vit dans `body_weight_entries` et passe par
 * `logWeight()` de `bodyweight-repository`, qui sait déjà mettre à jour la pesée du jour au lieu
 * d'en créer une seconde. Dupliquer cette logique fabriquerait deux vérités pour la même mesure.
 */

import { useQuery } from '@powersync/react';
import {
  WELLBEING_INDICATORS,
  canEditDay,
  isEmptyCheckin,
  isWellbeingLevel,
  localDayKey,
  type LocalWellbeing,
  type WellbeingCheckinInput,
} from '@wellness/shared';

import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, patch } from './_sql';
import { useTodayKey } from '@/hooks/useTodayKey';

/** Un check-in, forme applicative. */
export type WellbeingEntry = {
  id: string;
  logDate: string;
  mood: number | null;
  energy: number | null;
  stress: number | null;
};

type WellbeingDbRow = {
  id: string;
  log_date: string;
  mood: number | null;
  energy: number | null;
  stress: number | null;
};

const SELECT_COLS = `id, log_date, mood, energy, stress`;

function toEntry(row: WellbeingDbRow): WellbeingEntry {
  return {
    id: row.id,
    logDate: row.log_date,
    mood: row.mood,
    energy: row.energy,
    stress: row.stress,
  };
}

/**
 * Check-ins depuis `sinceDate` (AAAA-MM-JJ incluse), du plus récent au plus ancien.
 *
 * PowerSync ne réplique que les lignes de l'utilisateur courant (bucket par JWT) : pas besoin de
 * filtrer sur `user_id` en lecture, comme partout ailleurs dans les repositories.
 */
export function useWellbeingEntries(sinceDate?: string): {
  entries: WellbeingEntry[];
  isLoading: boolean;
} {
  const sql = sinceDate
    ? `SELECT ${SELECT_COLS} FROM daily_wellbeing WHERE deleted_at IS NULL AND log_date >= ? ORDER BY log_date DESC`
    : `SELECT ${SELECT_COLS} FROM daily_wellbeing WHERE deleted_at IS NULL ORDER BY log_date DESC`;
  const { data, isLoading } = useQuery<WellbeingDbRow>(sql, sinceDate ? [sinceDate] : []);
  return { entries: data.map(toEntry), isLoading };
}

/**
 * Lignes brutes pour les briques pures de `@wellness/shared` (séries, moyennes) — même forme que
 * `LocalWellbeing`, `deletedAt` compris pour que les briques puissent l'ignorer elles-mêmes.
 */
export function useWellbeingRows(sinceDate?: string): {
  rows: LocalWellbeing[];
  isLoading: boolean;
} {
  const { entries, isLoading } = useWellbeingEntries(sinceDate);
  return { rows: entries, isLoading };
}

/** Check-in du jour, ou `null` s'il n'a pas encore été fait — alimente l'état du widget. */
export function useTodayWellbeing(): { entry: WellbeingEntry | null; isLoading: boolean } {
  const todayKey = useTodayKey();
  const { data, isLoading } = useQuery<WellbeingDbRow>(
    `SELECT ${SELECT_COLS} FROM daily_wellbeing WHERE deleted_at IS NULL AND log_date = ? LIMIT 1`,
    [todayKey],
  );
  const row = data[0];
  return { entry: row ? toEntry(row) : null, isLoading };
}

/** Check-in d'un jour donné (pour le rattrapage depuis l'historique). */
export async function getWellbeingForDay(logDate: string): Promise<WellbeingEntry | null> {
  const row = await powerSync.getOptional<WellbeingDbRow>(
    `SELECT ${SELECT_COLS} FROM daily_wellbeing WHERE deleted_at IS NULL AND log_date = ? LIMIT 1`,
    [logDate],
  );
  return row ? toEntry(row) : null;
}

function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new Error('Aucune session active : impossible d’écrire un check-in.');
  return userId;
}

/** Normalise en valeur stockable : un niveau hors échelle est traité comme absent. */
function toColumn(value: number | null | undefined): number | null {
  return isWellbeingLevel(value) ? value : null;
}

/**
 * Enregistre le check-in d'un jour : **met à jour** la ligne existante, ou la crée.
 *
 * Refuse — et le dit, plutôt que d'échouer en silence :
 * - un check-in **vide** (aucun indicateur exploitable), qui ne créerait qu'une ligne inutile ;
 * - un jour **hors fenêtre** de rattrapage (décision D4 : J-6 → aujourd'hui, jamais le futur).
 *
 * Renvoie `true` si quelque chose a été écrit.
 */
export async function saveWellbeing(
  logDate: string,
  input: WellbeingCheckinInput,
): Promise<boolean> {
  if (!canEditDay(logDate, localDayKey(new Date()))) {
    throw new Error(`Jour hors fenêtre de saisie : ${logDate}`);
  }
  if (isEmptyCheckin(input)) return false;

  const columns = Object.fromEntries(
    WELLBEING_INDICATORS.map((indicator) => [indicator, toColumn(input[indicator])]),
  );

  const existing = await powerSync.getOptional<{ id: string }>(
    `SELECT id FROM daily_wellbeing WHERE log_date = ? AND deleted_at IS NULL LIMIT 1`,
    [logDate],
  );

  if (existing) {
    await patch('daily_wellbeing', existing.id, columns);
    return true;
  }

  await insertWithSyncFields('daily_wellbeing', {
    user_id: currentUserId(),
    log_date: logDate,
    ...columns,
  });
  return true;
}
