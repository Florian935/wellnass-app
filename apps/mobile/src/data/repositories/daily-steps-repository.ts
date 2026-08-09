/**
 * Repository des pas quotidiens (US PAS-01) : table `daily_steps`, une ligne par jour.
 *
 * La donnée vient de Health Connect (lecture seule côté hub) et est **synchronisée** : c'est ce qui
 * la rend disponible sur un 2ᵉ appareil et après réinstallation, contrairement au poids importé qui
 * n'était qu'un déclencheur d'écriture locale.
 *
 * Toute la logique de décision (quoi créer, quoi mettre à jour, règle du max) vit dans
 * `@wellness/shared` (`steps.ts`, testée sous Vitest) : ici, uniquement des entrées/sorties SQL.
 */

import { useQuery } from '@powersync/react';
import {
  DEFAULT_STEP_GOAL,
  MAX_STEP_GOAL,
  MIN_STEP_GOAL,
  isGoalReached,
  mergeDailySteps,
  normalizeStepGoal,
  type DailyStepsInput,
  type LocalDailySteps,
} from '@wellness/shared';

import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, patch } from './_sql';
import { useTodayKey } from '@/hooks/useTodayKey';

/** Un jour de pas, forme applicative. */
export type DailySteps = { id: string; logDate: string; steps: number };

type DailyStepsDbRow = { id: string; log_date: string; steps: number };

/**
 * Pas des jours depuis `sinceDate` (AAAA-MM-JJ incluse), ordonnés chronologiquement.
 *
 * PowerSync ne réplique que les lignes de l'utilisateur courant (bucket par JWT) : pas besoin de
 * filtrer sur `user_id` en lecture, comme partout ailleurs dans les repositories.
 */
export function useDailySteps(sinceDate?: string): { rows: DailySteps[]; isLoading: boolean } {
  const sql = sinceDate
    ? `SELECT id, log_date, steps FROM daily_steps WHERE deleted_at IS NULL AND log_date >= ? ORDER BY log_date`
    : `SELECT id, log_date, steps FROM daily_steps WHERE deleted_at IS NULL ORDER BY log_date`;
  const { data, isLoading } = useQuery<DailyStepsDbRow>(sql, sinceDate ? [sinceDate] : []);
  return {
    rows: data.map((r) => ({ id: r.id, logDate: r.log_date, steps: r.steps })),
    isLoading,
  };
}

/** Objectif de pas courant (réactif), déjà normalisé — jamais `null` pour l'UI. */
export function useStepGoal(): { goal: number; isLoading: boolean } {
  const { data, isLoading } = useQuery<{ daily_step_goal: number | null }>(
    `SELECT daily_step_goal FROM profiles WHERE deleted_at IS NULL LIMIT 1`,
  );
  return { goal: normalizeStepGoal(data[0]?.daily_step_goal ?? null), isLoading };
}

/** Pas du jour + objectif + atteinte, pour le widget. */
export function useTodaySteps(): {
  steps: number;
  goal: number;
  reached: boolean;
  isLoading: boolean;
} {
  const todayKey = useTodayKey();
  const { data, isLoading } = useQuery<DailyStepsDbRow>(
    `SELECT id, log_date, steps FROM daily_steps WHERE deleted_at IS NULL AND log_date = ? LIMIT 1`,
    [todayKey],
  );
  const { goal, isLoading: goalLoading } = useStepGoal();
  const steps = data[0]?.steps ?? 0;
  return { steps, goal, reached: isGoalReached(steps, goal), isLoading: isLoading || goalLoading };
}

/** Bornes du réglage, réexportées pour l'UI (une seule source : `@wellness/shared`). */
export { DEFAULT_STEP_GOAL, MAX_STEP_GOAL, MIN_STEP_GOAL };

function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new Error('Aucune session active : impossible d’écrire les pas du jour.');
  return userId;
}

/**
 * Applique un lot de totaux journaliers lus dans Health Connect.
 *
 * Deux passes, dans cet ordre : on relit l'état local (y compris les lignes supprimées, pour ne pas
 * ressusciter une pesée effacée — même règle que le poids), puis on délègue la **décision** à
 * `mergeDailySteps` (règle du max). Renvoie le nombre de jours réellement écrits.
 */
export async function upsertDailySteps(rows: readonly DailyStepsInput[]): Promise<number> {
  if (rows.length === 0) return 0;

  const existing = await powerSync.getAll<{
    id: string;
    log_date: string;
    steps: number;
    deleted_at: string | null;
  }>(`SELECT id, log_date, steps, deleted_at FROM daily_steps`);

  const local: LocalDailySteps[] = existing.map((r) => ({
    logDate: r.log_date,
    steps: r.steps,
    deletedAt: r.deleted_at,
  }));

  const { toCreate, toUpdate } = mergeDailySteps(rows, local);

  // `id` de la ligne vivante d'un jour donné (les lignes supprimées sont recréées, pas patchées).
  const idByDay = new Map<string, string>();
  for (const r of existing) {
    if (r.deleted_at == null) idByDay.set(r.log_date, r.id);
  }

  const userId = toCreate.length > 0 ? currentUserId() : '';

  for (const row of toCreate) {
    await insertWithSyncFields('daily_steps', {
      user_id: userId,
      log_date: row.logDate,
      steps: row.steps,
      source: 'health_connect',
    });
  }

  for (const row of toUpdate) {
    const id = idByDay.get(row.logDate);
    if (id) await patch('daily_steps', id, { steps: row.steps });
  }

  return toCreate.length + toUpdate.length;
}
