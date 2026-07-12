/**
 * Couche native fine d'export GPX (US 5.33).
 *
 * Orchestre : décodage de la trace → construction du GPX (logique pure partagée) →
 * écriture dans le cache app → feuille de partage OS. 100 % local/hors-ligne : aucun
 * réseau, aucun cloud, aucune migration. Non testée unitairement (I/O natif) —
 * vérifiée en revue + recette device. La logique testable vit dans `@wellness/shared`
 * (`buildGpx`, `gpxFileName`, `isValidCoord`).
 */

import { buildGpx, decodeTrack } from '@wellness/shared';
// API LEGACY d'expo-file-system (SDK 57) : `writeAsStringAsync` + `cacheDirectory`.
// Choix legacy (vs nouvelle API `File`) : plus éprouvée sur l'existant et cohérente
// avec op-sqlite/PowerSync (cf. spec §4). La nouvelle API vit sous l'import racine.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { TFunction } from 'i18next';
import type { RunDetail } from '@/data/repositories/run-repository';

/**
 * Nom de fichier PHYSIQUE fixe dans le cache : réécrit à chaque export pour éviter
 * l'accumulation de fichiers (cf. spec §4). Le nom « lisible/daté » sert de titre de
 * dialogue, pas de nom de fichier physique.
 */
const CACHE_FILE_NAME = 'course.gpx';

/** Résultat typé pour que l'écran affiche le bon message. */
export type GpxExportResult =
  | { ok: true }
  | { error: 'empty' | 'unavailable' | 'failed' };

/**
 * Exporte une course GPS terminée en `.gpx` et ouvre la feuille de partage OS.
 *
 * @param run - Détail de la course (trace `gpsTrack` encodée, `startedAt` ISO UTC).
 * @param t   - Fonction i18n (libellé daté + titre de dialogue).
 * @returns `{ ok: true }` en cas de succès (ou d'annulation par l'utilisateur — sans
 *          effet), sinon un statut d'erreur (`empty` / `unavailable` / `failed`).
 */
export async function exportRunAsGpx(
  run: RunDetail,
  t: TFunction,
): Promise<GpxExportResult> {
  const points = run.gpsTrack ? decodeTrack(run.gpsTrack) : [];

  const startedAtMs = Date.parse(run.startedAt);
  // Libellé daté i18n (date/heure LOCALE) — RunDetail n'a AUCUN nom (cf. spec §3).
  const date = new Date(startedAtMs).toLocaleString();
  const name = t('running.export.defaultName', { date });

  const gpx = buildGpx(points, { startedAtMs, name });
  if (gpx === null) {
    return { error: 'empty' };
  }

  const uri = FileSystem.cacheDirectory + CACHE_FILE_NAME;

  try {
    await FileSystem.writeAsStringAsync(uri, gpx);

    if (!(await Sharing.isAvailableAsync())) {
      return { error: 'unavailable' };
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'application/gpx+xml',
      dialogTitle: t('running.export.dialogTitle'),
    });

    return { ok: true };
  } catch (err) {
    console.warn('[gpx-export] échec écriture/partage:', err);
    return { error: 'failed' };
  }
}
