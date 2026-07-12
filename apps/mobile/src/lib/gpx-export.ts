/**
 * Couche native fine d'export GPX (US 5.33).
 *
 * Orchestre : décodage de la trace → construction du GPX (logique pure partagée) →
 * écriture dans le cache app → feuille de partage OS. 100 % local/hors-ligne : aucun
 * réseau, aucun cloud, aucune migration. Non testée unitairement (I/O natif) —
 * vérifiée en revue + recette device. La logique testable vit dans `@wellness/shared`
 * (`buildGpx`, `gpxFileName`, `isValidCoord`).
 */

import { buildGpx, decodeTrack, gpxFileName } from '@wellness/shared';
// API LEGACY d'expo-file-system (SDK 57) : `writeAsStringAsync` + `cacheDirectory`.
// Choix legacy (vs nouvelle API `File`) : plus éprouvée sur l'existant et cohérente
// avec op-sqlite/PowerSync (cf. spec §4). La nouvelle API vit sous l'import racine.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { TFunction } from 'i18next';
import type { RunDetail } from '@/data/repositories/run-repository';

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
  // Date de départ corrompue (NaN) → échec propre AVANT tout `toISOString`/`toLocaleString`.
  if (Number.isNaN(startedAtMs)) {
    return { error: 'failed' };
  }

  // Libellé daté i18n (date/heure LOCALE) — RunDetail n'a AUCUN nom (cf. spec §3).
  const date = new Date(startedAtMs).toLocaleString();
  const name = t('running.export.defaultName', { date });

  const gpx = buildGpx(points, { startedAtMs, name });
  if (gpx === null) {
    return { error: 'empty' };
  }

  // Nom de fichier PHYSIQUE lisible et daté (`course-AAAA-MM-JJ-HHmm.gpx`) : c'est le
  // nom que verra l'app réceptrice (Strava/Garmin…). Un ré-export de la même course
  // (même horodatage) écrase le fichier ; des courses différentes créent des fichiers
  // distincts (texte léger, purgé par l'OS avec le cache).
  const uri = FileSystem.cacheDirectory + gpxFileName(run.startedAt);

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
