/**
 * Repository des jokers de série (US STREAK-01) : table `streak_jokers`.
 *
 * Toute la logique — série avec jokers, décompte mensuel, détection du trou rattrapable — vit dans
 * `@wellness/shared` (`streak-joker.ts`, 18 tests) : ici, uniquement des entrées/sorties SQL.
 *
 * ⚠️ **Un joker protège la série et rien d'autre** (décision D3). Ce fichier n'écrit **que** dans
 * `streak_jokers` : aucune séance, aucune sortie, aucun repas n'est fabriqué pour « remplir » le jour.
 * Le journal et les statistiques continuent de voir un jour vide, parce qu'il l'est.
 */

import { useQuery } from '@powersync/react';
import { jokersRemaining, localDayKey } from '@wellness/shared';

import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields } from './_sql';

/** Jours couverts par un joker (clés `AAAA-MM-JJ`), du plus récent au plus ancien. */
export function useJokerDays(): { days: string[]; isLoading: boolean } {
  const { data, isLoading } = useQuery<{ log_date: string }>(
    `SELECT log_date FROM streak_jokers WHERE deleted_at IS NULL ORDER BY log_date DESC`,
  );
  return { days: data.map((r) => r.log_date), isLoading };
}

/** Jokers encore disponibles ce mois calendaire. */
export function useJokersRemaining(): { remaining: number; isLoading: boolean } {
  const { days, isLoading } = useJokerDays();
  return { remaining: jokersRemaining(days, localDayKey(new Date())), isLoading };
}

function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new Error('Aucune session active : impossible de consommer un joker.');
  return userId;
}

/**
 * Consomme un joker sur un jour manqué.
 *
 * Le quota est **relu ici**, pas repris de l'affichage : entre le moment où la proposition s'affiche
 * et le tap, le mois peut avoir changé (ou un autre appareil avoir consommé le joker). Refuse en
 * levant plutôt qu'en échouant en silence.
 *
 * Idempotent : si le jour est déjà couvert, on ne crée pas de seconde ligne.
 */
export async function consumeJoker(logDate: string): Promise<boolean> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
    throw new Error(`Date illisible : ${logDate}`);
  }

  const existing = await powerSync.getOptional<{ id: string }>(
    `SELECT id FROM streak_jokers WHERE log_date = ? AND deleted_at IS NULL LIMIT 1`,
    [logDate],
  );
  if (existing) return false;

  const rows = await powerSync.getAll<{ log_date: string }>(
    `SELECT log_date FROM streak_jokers WHERE deleted_at IS NULL`,
  );
  const remaining = jokersRemaining(
    rows.map((r) => r.log_date),
    localDayKey(new Date()),
  );
  if (remaining <= 0) {
    throw new Error('Aucun joker disponible ce mois-ci.');
  }

  await insertWithSyncFields('streak_jokers', {
    user_id: currentUserId(),
    log_date: logDate,
  });
  return true;
}
