/**
 * Repository du journal des zones douloureuses (US DOUL-01, roadmap 1.29) : table `pain_reports`.
 *
 * Toute la règle vit dans `@wellness/shared` (`pain-zones.ts`) : ici, uniquement des entrées/sorties
 * SQL.
 *
 * ⚠️ **Donnée de santé, opt-in strict** (R7). Aucune écriture n'est possible tant que
 * `user_settings.pain_journal_enabled` est faux — la garde est ici, dans le repository, et pas
 * seulement dans l'UI : une route atteinte par deep-link ne doit pas pouvoir écrire. C'est le défaut
 * exact relevé en recette de CYCLE-01, où `wellness://cycle` s'ouvrait suivi éteint.
 *
 * ⚠️ **Aucune écriture dans Health Connect**, délibérément — c'est ce qui garde la déclaration Play
 * « Health apps » à 6 types et évite un délai d'instruction externe.
 */

import { useMemo } from 'react';

import { useQuery } from '@powersync/react';
import {
  latestByZone,
  painZoneToMuscle,
  pickSessionPainSignal,
  type FineMuscle,
  type PainLevel,
  type PainReport,
  type PainZone,
  type SessionPainSignal,
} from '@wellness/shared';

import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { useTodayKey } from '@/hooks/useTodayKey';
import { insertWithSyncFields, patch, softDelete } from './_sql';
import { useSettings } from './settings-repository';

/** Ligne brute de `pain_reports`. */
type PainRow = { id: string; log_date: string; zone: string; level: string };

const SELECT_REPORTS = `
  SELECT id, log_date, zone, level
  FROM pain_reports
  WHERE deleted_at IS NULL
  ORDER BY log_date DESC
`;

/**
 * Une ligne brute devient un `PainReport`.
 *
 * `zone` n'a **pas** de contrainte en base (liste applicative, évolutive) : une valeur inconnue peut
 * donc arriver d'un client plus récent. On la laisse passer telle quelle plutôt que de jeter la ligne
 * — les fonctions pures l'ignoreront faute de projection, et l'historique la montrera avec sa clé
 * brute plutôt que de faire disparaître une déclaration réelle.
 */
function toReport(row: PainRow): PainReport {
  return {
    id: row.id,
    logDate: row.log_date,
    zone: row.zone as PainZone,
    level: row.level as PainLevel,
  };
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

/** Toutes les déclarations, la plus récente d'abord. */
export function usePainReports(): { reports: PainReport[]; isLoading: boolean } {
  const { data, isLoading } = useQuery<PainRow>(SELECT_REPORTS);
  const reports = useMemo(() => data.map(toReport), [data]);
  return { reports, isLoading };
}

/** L'état courant par zone (R5) — la dernière déclaration de chacune, jamais une moyenne. */
export function useCurrentPainZones(): { zones: PainReport[]; isLoading: boolean } {
  const { reports, isLoading } = usePainReports();
  return { zones: useMemo(() => latestByZone(reports), [reports]), isLoading };
}

/**
 * Le signal à afficher sur une séance planifiée, ou `null` (R4).
 *
 * Rend `null` sans discuter si le journal est désactivé : un réglage éteint ne doit produire aucune
 * surface, pas même à partir de données restées en base après une désactivation sans suppression.
 */
export function useSessionPainSignal(
  sessionMuscles: ReadonlyArray<FineMuscle>,
): SessionPainSignal | null {
  const { settings } = useSettings();
  const { reports } = usePainReports();
  const todayKey = useTodayKey();
  const enabled = settings?.painJournalEnabled ?? false;

  return useMemo(
    () =>
      enabled ? pickSessionPainSignal({ reports, sessionMuscles, todayKey }) : null,
    [enabled, reports, sessionMuscles, todayKey],
  );
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new Error('Aucune session active : impossible de déclarer une zone.');
  return userId;
}

/** Le journal est-il activé ? Relu **en base**, pas repris de l'affichage. */
async function assertJournalEnabled(): Promise<void> {
  const row = await powerSync.getOptional<{ pain_journal_enabled: number | null }>(
    `SELECT pain_journal_enabled FROM user_settings WHERE deleted_at IS NULL LIMIT 1`,
  );
  if (row?.pain_journal_enabled !== 1) {
    throw new Error('Journal des zones sensibles désactivé : aucune écriture possible.');
  }
}

/**
 * Déclare une zone, ou **met à jour** son niveau si elle l'a déjà été ce jour-là (R2).
 *
 * Un upsert applicatif plutôt qu'un `ON CONFLICT` : PowerSync écrit dans SQLite local puis rejoue les
 * opérations côté serveur, et une clause de conflit ne survivrait pas au trajet. L'index unique
 * partiel reste en base comme filet, il n'est pas le mécanisme.
 *
 * Renvoie l'id de la ligne écrite.
 */
export async function reportPain(input: {
  zone: PainZone;
  level: PainLevel;
  logDate: string;
}): Promise<string> {
  await assertJournalEnabled();

  const existing = await powerSync.getOptional<{ id: string }>(
    `SELECT id FROM pain_reports WHERE log_date = ? AND zone = ? AND deleted_at IS NULL LIMIT 1`,
    [input.logDate, input.zone],
  );

  if (existing) {
    await patch('pain_reports', existing.id, { level: input.level });
    return existing.id;
  }

  return insertWithSyncFields('pain_reports', {
    user_id: currentUserId(),
    log_date: input.logDate,
    zone: input.zone,
    level: input.level,
  });
}

/** Retire une déclaration (soft delete). */
export async function deletePainReport(id: string): Promise<void> {
  await softDelete('pain_reports', id);
}

/**
 * Supprime **toutes** les déclarations — proposé à la désactivation du journal (R14).
 *
 * Soft delete ligne à ligne dans une transaction : le connecteur PowerSync ne sait pousser que des
 * opérations par ligne, et un `UPDATE` de masse hors transaction laisserait un état partiel si
 * l'application était tuée au milieu.
 */
export async function deleteAllPainReports(): Promise<number> {
  const rows = await powerSync.getAll<{ id: string }>(
    `SELECT id FROM pain_reports WHERE deleted_at IS NULL`,
  );
  const now = new Date().toISOString();

  await powerSync.writeTransaction(async (tx) => {
    for (const row of rows) {
      await tx.execute(`UPDATE pain_reports SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
        now,
        now,
        row.id,
      ]);
    }
  });

  return rows.length;
}

/** Ré-export pratique pour les écrans : évite d'importer `@wellness/shared` juste pour ça. */
export { painZoneToMuscle };
