/**
 * Repository des records d'allure (table `running_pace_records` — pilier Running R4b).
 *
 * Trois responsabilités :
 *  1. **Lecture réactive** (`useRunningRecords`) : expose à l'UI les records par distance
 *     canonique (1 km → marathon), triés dans l'ordre `RUNNING_RECORD_DISTANCES`.
 *  2. **Détection à la clôture** (`detectAndStoreRunRecords`) : à la fin d'une course GPS,
 *     recalcule les meilleurs temps par distance atteignable et met à jour les records
 *     battus (strictement plus rapides). **Idempotent** : rejouer ne change rien.
 *  3. **Backfill** (`backfillRunningRecords`) : rejoue la détection sur tout l'historique
 *     GPS terminé (migration / réconciliation), protégé par un verrou d'exécution.
 *
 * Règles offline-first (voir docs/specs/technical/offline-sync.md) :
 *  - UUID généré côté client (via `insertWithSyncFields`).
 *  - Timestamps en UTC ; suppression = soft delete (jamais de hard delete client).
 *  - Chaque mutation écrit immédiatement dans SQLite (optimiste), la synchro suit.
 *  - `user_id` = utilisateur de la session courante à l'écriture.
 *
 * GPS-only : seules les courses `source != 'manual'` avec une trace non vide comptent
 * (une saisie manuelle n'a pas de trace exploitable pour un record d'allure).
 *
 * PowerSync ne réplique que les lignes de l'utilisateur courant (bucket par JWT) :
 * en lecture, filtrer sur `deleted_at IS NULL` suffit (pas de clause `user_id`).
 */

import { useQuery } from '@powersync/react';
import {
  computeRunRecords,
  decodeTrack,
  RUNNING_RECORD_DISTANCES,
  type RecordDistanceKey,
} from '@wellness/shared';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, nowUtc, patch } from './_sql';
import { upsertRunnerProfile } from './running-profile-repository';

// ---------------------------------------------------------------------------
// Types de domaine exposés à l'UI
// ---------------------------------------------------------------------------

/** Record d'allure pour une distance canonique (camelCase). */
export type RunningPaceRecord = {
  distanceKey: RecordDistanceKey;
  bestTimeSeconds: number;
  runId: string;
  achievedAt: string;
};

// ---------------------------------------------------------------------------
// Ligne brute SQLite (colonnes snake_case)
// ---------------------------------------------------------------------------

/** Ligne brute d'un record d'allure. */
type RunningPaceRecordDbRow = {
  distance_key: string;
  best_time_seconds: number;
  run_id: string;
  achieved_at: string;
};

// ---------------------------------------------------------------------------
// Requête de base
// ---------------------------------------------------------------------------

/** Records de l'utilisateur courant (le tri canonique est fait en TS). */
const SELECT_CURRENT = `
  SELECT distance_key, best_time_seconds, run_id, achieved_at
  FROM running_pace_records
  WHERE deleted_at IS NULL
`;

// ---------------------------------------------------------------------------
// Mapping snake_case ↔ camelCase
// ---------------------------------------------------------------------------

/** Convertit une ligne SQLite (snake_case) → objet de domaine (camelCase). */
function rowToRunningPaceRecord(row: RunningPaceRecordDbRow): RunningPaceRecord {
  return {
    distanceKey: row.distance_key as RecordDistanceKey,
    bestTimeSeconds: row.best_time_seconds,
    runId: row.run_id,
    achievedAt: row.achieved_at,
  };
}

/** Index d'une distance dans l'ordre canonique (records inconnus renvoyés en fin). */
function canonicalOrderIndex(key: RecordDistanceKey): number {
  const idx = RUNNING_RECORD_DISTANCES.findIndex((d) => d.key === key);
  return idx === -1 ? RUNNING_RECORD_DISTANCES.length : idx;
}

// ---------------------------------------------------------------------------
// Lecture réactive (hook)
// ---------------------------------------------------------------------------

/**
 * Records d'allure de l'utilisateur courant, réactifs aux changements de la base locale.
 *
 * Triés dans l'ordre canonique `RUNNING_RECORD_DISTANCES` (1 km → marathon) — le tri se
 * fait en TS car `distance_key` est textuel (un `ORDER BY` lexicographique serait faux).
 *
 * `isLoading` ne dépend QUE de la résolution de la requête locale (SQLite), jamais de la
 * synchro réseau (offline-first, ADR-001 / décision B).
 */
export function useRunningRecords(): {
  records: RunningPaceRecord[];
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery<RunningPaceRecordDbRow>(SELECT_CURRENT);
  const records = data
    .map(rowToRunningPaceRecord)
    .sort(
      (a, b) =>
        canonicalOrderIndex(a.distanceKey) - canonicalOrderIndex(b.distanceKey),
    );
  return { records, isLoading };
}

// ---------------------------------------------------------------------------
// Écritures (hors contexte hook)
// ---------------------------------------------------------------------------

/** Identifiant de l'utilisateur de la session courante (lève si déconnecté). */
function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) {
    throw new Error("Aucune session active : impossible d'écrire un record d'allure.");
  }
  return userId;
}

/**
 * Détecte et enregistre les records d'allure battus par une course, à sa clôture.
 *
 * **GPS-only** : no-op si la course est introuvable, non `completed`, `source='manual'`,
 * ou sans trace GPS exploitable (retourne `[]`).
 *
 * Pour chaque distance atteignable (`computeRunRecords`), on compare au record existant :
 *  - absent → insertion du record ;
 *  - strictement plus rapide (`<`) → mise à jour du record ;
 *  - sinon → rien.
 *
 * **Idempotent** : rejouer sur la même course ne bat plus rien (comparaison stricte) et
 * retourne `[]`.
 *
 * Si le 5 km est battu, l'allure de référence du profil coureur est mise à jour
 * (`ref5kPaceSPerKm = temps_5k / 5` s/km, arrondi à l'entier) — c'est l'allure de
 * référence servant aux zones et prédictions (voir running-profile-repository).
 *
 * @returns les clés de distance dont le record a été battu (insertion ou amélioration).
 */
export async function detectAndStoreRunRecords(
  runId: string,
): Promise<RecordDistanceKey[]> {
  const run = await powerSync.getOptional<{
    source: string;
    status: string;
    gps_track: string | null;
    finished_at: string | null;
  }>(
    `SELECT source, status, gps_track, finished_at FROM runs WHERE id = ? AND deleted_at IS NULL`,
    [runId],
  );

  // GPS-only + course terminée uniquement.
  if (
    !run ||
    run.status !== 'completed' ||
    run.source === 'manual' ||
    !run.gps_track
  ) {
    return [];
  }

  const points = decodeTrack(run.gps_track);
  const records = computeRunRecords(points);

  const userId = currentUserId();
  const achievedAt = run.finished_at ?? nowUtc();

  const beaten: RecordDistanceKey[] = [];
  // Temps 5 km RETENU (arrondi, tel que stocké) si le 5 km est battu — sert à
  // dériver l'allure de référence de façon cohérente avec ce qui est persisté.
  let rounded5k: number | null = null;

  // Écritures des records = source de vérité, faites AVANT la maj du profil (dérivé)
  // et HORS transaction : choix délibéré (offline-first, base locale mono-utilisateur).
  // Une erreur dans cette boucle interrompt les distances suivantes (fail-fast) ; c'est
  // acceptable car le backfill, idempotent, reprendra proprement au prochain lancement.
  for (const { key } of RUNNING_RECORD_DISTANCES) {
    const timeSeconds = records[key];
    if (timeSeconds == null) continue;

    // On arrondit UNE seule fois et on compare arrondi ↔ arrondi : comparer le float
    // brut au temps déjà stocké (entier) casserait l'idempotence (ex. 299,6 s stocké à
    // 300 rebattrait 300 à chaque replay). Ici `rounded < stored` est strictement `false`
    // au replay → aucun re-patch, aucune re-célébration.
    const rounded = Math.round(timeSeconds);

    const existing = await powerSync.getOptional<{
      id: string;
      best_time_seconds: number;
    }>(
      `SELECT id, best_time_seconds FROM running_pace_records
       WHERE user_id = ? AND distance_key = ? AND deleted_at IS NULL`,
      [userId, key],
    );

    if (!existing) {
      await insertWithSyncFields('running_pace_records', {
        user_id: userId,
        distance_key: key,
        best_time_seconds: rounded,
        run_id: runId,
        achieved_at: achievedAt,
      });
      beaten.push(key);
      if (key === '5k') rounded5k = rounded;
    } else if (rounded < existing.best_time_seconds) {
      await patch('running_pace_records', existing.id, {
        best_time_seconds: rounded,
        run_id: runId,
        achieved_at: achievedAt,
      });
      beaten.push(key);
      if (key === '5k') rounded5k = rounded;
    }
  }

  // Record 5 km battu → met à jour l'allure de référence (s/km) du profil coureur,
  // dérivée du temps ARRONDI retenu (cohérence avec le record stocké).
  if (rounded5k != null) {
    await upsertRunnerProfile({
      ref5kPaceSPerKm: Math.round(rounded5k / 5),
    });
  }

  return beaten;
}

// ---------------------------------------------------------------------------
// Backfill (réconciliation de l'historique)
// ---------------------------------------------------------------------------

/**
 * Verrou d'exécution : empêche deux backfills concurrents (double lecture-écriture
 * entrelacée sur les mêmes records). Un second appel pendant qu'un premier tourne
 * retourne immédiatement (no-op).
 */
let backfilling = false;

/**
 * Rejoue la détection de records sur tout l'historique GPS terminé.
 *
 * **Idempotent** (repose sur `detectAndStoreRunRecords`) et protégé par un verrou
 * d'exécution (`backfilling`) pour éviter les exécutions concurrentes. Les courses
 * manuelles sont exclues côté SQL (GPS-only).
 */
export async function backfillRunningRecords(): Promise<void> {
  if (backfilling) return;
  backfilling = true;
  try {
    const rows = await powerSync.getAll<{ id: string }>(
      `SELECT id FROM runs WHERE status = 'completed' AND source != 'manual' AND deleted_at IS NULL`,
    );
    for (const row of rows) {
      await detectAndStoreRunRecords(row.id);
    }
  } finally {
    backfilling = false;
  }
}
