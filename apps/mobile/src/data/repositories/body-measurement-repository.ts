/**
 * Repository des mensurations corporelles (US MESUR-01) : table `body_measurements`.
 *
 * Modèle **normalisé** (décision D1) : une ligne par `(log_date, kind)`. Toute la logique de
 * repliage (séries, derniers relevés, deltas) vit dans `@wellness/shared` (`measurements.ts`, testée
 * sous Vitest) : ici, uniquement des entrées/sorties SQL.
 *
 * ⚠️ **Le poids n'est pas géré ici** : il vit dans `body_weight_entries` (roadmap 4.30) et sa courbe
 * existe déjà. Même règle que BIEN-01 — on ne fabrique pas deux vérités pour la même mesure.
 *
 * ⚠️ **Stockage toujours en centimètres.** La bascule métrique/impérial est un fait d'affichage :
 * convertir au stockage ferait dériver l'historique à chaque changement de réglage.
 */

import { useQuery } from '@powersync/react';
import {
  isMeasurementKind,
  isValidMeasurementCm,
  latestByKind,
  localDayKey,
  type MeasurementKind,
  type MeasurementPoint,
  type MeasurementRow,
} from '@wellness/shared';

import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, patch, softDelete } from './_sql';

type MeasurementDbRow = {
  id: string;
  log_date: string;
  kind: string;
  value_cm: number;
};

const SELECT_COLS = `id, log_date, kind, value_cm`;

/** Valeur saisie pour une mesure : un nombre en cm, ou `null` pour **retirer** la mesure du jour. */
export type MeasurementInput = Partial<Record<MeasurementKind, number | null>>;

function toRow(row: MeasurementDbRow): MeasurementRow | null {
  // Une ligne dont le `kind` est inconnu (valeur ajoutée en base sans mise à jour du client) est
  // écartée plutôt que de faire planter un `Record` typé.
  if (!isMeasurementKind(row.kind)) return null;
  return { logDate: row.log_date, kind: row.kind, valueCm: Number(row.value_cm) };
}

/**
 * Toutes les mensurations vivantes, du plus récent au plus ancien.
 *
 * PowerSync ne réplique que les lignes de l'utilisateur courant (bucket par JWT) : pas besoin de
 * filtrer sur `user_id` en lecture, comme partout ailleurs dans les repositories.
 */
export function useMeasurements(sinceDate?: string): {
  rows: MeasurementRow[];
  isLoading: boolean;
} {
  const sql = sinceDate
    ? `SELECT ${SELECT_COLS} FROM body_measurements WHERE deleted_at IS NULL AND log_date >= ? ORDER BY log_date DESC`
    : `SELECT ${SELECT_COLS} FROM body_measurements WHERE deleted_at IS NULL ORDER BY log_date DESC`;
  const { data, isLoading } = useQuery<MeasurementDbRow>(sql, sinceDate ? [sinceDate] : []);
  return {
    rows: data.map(toRow).filter((r): r is MeasurementRow => r !== null),
    isLoading,
  };
}

/** Dernière valeur connue de chaque mesure — pré-remplissage de la feuille de saisie. */
export function useLatestMeasurements(): {
  latest: Partial<Record<MeasurementKind, MeasurementPoint>>;
  isLoading: boolean;
} {
  const { rows, isLoading } = useMeasurements();
  return { latest: latestByKind(rows), isLoading };
}

function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new Error('Aucune session active : impossible d’écrire une mensuration.');
  return userId;
}

/**
 * Enregistre les mesures d'un jour.
 *
 * Pour chaque mesure fournie :
 *  - une **valeur** → met à jour la ligne vivante de ce `(jour, mesure)`, ou la crée ;
 *  - **`null`** → soft-delete la ligne de ce `(jour, mesure)`. C'est le seul moyen de corriger une
 *    saisie erronée, et ça ne touche **que** cette mesure, pas les autres du même jour.
 *
 * Refuse — et le dit, plutôt que d'échouer en silence — une date **future** ou une valeur
 * implausible. Aucune fenêtre de rattrapage en revanche (décision D4) : une mensuration est une
 * mesure objective qu'on saisit légitimement en retard.
 *
 * Renvoie le nombre de mesures réellement écrites ou retirées.
 */
export async function saveMeasurements(
  logDate: string,
  values: MeasurementInput,
): Promise<number> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
    throw new Error(`Date illisible : ${logDate}`);
  }
  if (logDate > localDayKey(new Date())) {
    throw new Error(`Date dans le futur : ${logDate}`);
  }

  const entries = Object.entries(values) as [MeasurementKind, number | null | undefined][];
  let written = 0;

  for (const [kind, value] of entries) {
    if (value === undefined) continue; // mesure non touchée par cette saisie

    if (value !== null && !isValidMeasurementCm(value)) {
      throw new Error(`Valeur implausible pour ${kind} : ${value}`);
    }

    const existing = await powerSync.getOptional<{ id: string }>(
      `SELECT id FROM body_measurements WHERE log_date = ? AND kind = ? AND deleted_at IS NULL LIMIT 1`,
      [logDate, kind],
    );

    if (value === null) {
      // Retrait : rien à faire si la mesure n'existait pas pour ce jour.
      if (existing) {
        await softDelete('body_measurements', existing.id);
        written += 1;
      }
      continue;
    }

    if (existing) {
      await patch('body_measurements', existing.id, { value_cm: value });
    } else {
      await insertWithSyncFields('body_measurements', {
        user_id: currentUserId(),
        log_date: logDate,
        kind,
        value_cm: value,
      });
    }
    written += 1;
  }

  return written;
}
