/**
 * Orchestration native de l'export RGPD (US CONF-01).
 *
 * Lit toutes les données perso de l'utilisateur dans la base locale PowerSync
 * (28 tables), assemble l'enveloppe JSON (logique pure partagée) → écrit dans le
 * cache app → feuille de partage OS. 100 % local/hors-ligne : aucun réseau, aucun
 * cloud. Non testée unitairement (I/O natif) — vérifiée en revue + recette device.
 * Patron identique à `gpx-export.ts`.
 */

import { buildExportEnvelope, exportFileName } from '@wellness/shared';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { TFunction } from 'i18next';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { powerSync } from '@/powersync/system';

/**
 * Tables exportées + colonne de possession. Toutes ont `deleted_at` (vérifié).
 *
 * NB — tables `*_translations` : elles portent un `owner_id` et contiennent à la fois de l'éditorial
 * (`owner_id NULL`, exclu) ET les libellés des contenus PERSO de l'utilisateur (nom/instructions d'un
 * exercice/aliment/programme créé sur mobile → `owner_id = utilisateur`). On les exporte donc en
 * `owner_id` : sans elles, un contenu perso ressortirait SANS son nom (complétude RGPD).
 */
const EXPORT_TABLES: { table: string; col: 'user_id' | 'owner_id' }[] = [
  { table: 'profiles', col: 'user_id' }, { table: 'user_settings', col: 'user_id' },
  { table: 'nutrition_profiles', col: 'user_id' }, { table: 'running_profiles', col: 'user_id' },
  { table: 'workouts', col: 'user_id' }, { table: 'workout_sets', col: 'user_id' },
  { table: 'programs', col: 'owner_id' }, { table: 'program_translations', col: 'owner_id' },
  { table: 'sessions', col: 'owner_id' },
  { table: 'exercise_plans', col: 'owner_id' }, { table: 'personal_records', col: 'user_id' },
  { table: 'exercise_notes', col: 'user_id' }, { table: 'workout_superset_pairs', col: 'user_id' },
  { table: 'workout_templates', col: 'user_id' }, { table: 'workout_template_exercises', col: 'user_id' },
  { table: 'planned_sessions', col: 'owner_id' }, { table: 'exercise_favorites', col: 'user_id' },
  { table: 'exercises', col: 'owner_id' }, { table: 'exercise_translations', col: 'owner_id' },
  { table: 'exercise_variants', col: 'owner_id' },
  { table: 'runs', col: 'user_id' }, { table: 'running_pace_records', col: 'user_id' },
  { table: 'food_entries', col: 'user_id' }, { table: 'recipes', col: 'user_id' },
  { table: 'recipe_ingredients', col: 'user_id' }, { table: 'meal_templates', col: 'user_id' },
  { table: 'meal_template_items', col: 'user_id' },
  { table: 'foods', col: 'owner_id' }, { table: 'food_translations', col: 'owner_id' },
  { table: 'food_favorites', col: 'user_id' }, { table: 'body_weight_entries', col: 'user_id' },
];

export type DataExportResult = { ok: true } | { error: 'unavailable' | 'failed' };

/**
 * Exporte toutes les données perso (base locale) en JSON et ouvre la feuille de partage.
 * 100 % local/hors-ligne. Noms de tables = CONSTANTES (pas d'injection) ; `userId` paramétré.
 */
export async function exportUserData(
  userId: string,
  syncComplete: boolean,
  t: TFunction,
): Promise<DataExportResult> {
  try {
    const tables: Record<string, unknown[]> = {};
    for (const { table, col } of EXPORT_TABLES) {
      tables[table] = await powerSync.getAll(
        `SELECT * FROM ${table} WHERE ${col} = ? AND deleted_at IS NULL`,
        [userId],
      );
    }
    const envelope = buildExportEnvelope({
      userId, exportedAt: new Date().toISOString(), syncComplete, tables,
    });
    const uri = FileSystem.cacheDirectory + exportFileName(new Date());
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(envelope, null, 2));

    if (!(await Sharing.isAvailableAsync())) return { error: 'unavailable' };
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: t('account.export.dialogTitle'),
    });
    // Analytics : export CONF-01 réussi (feuille de partage ouverte). Fire-and-forget.
    void track(ANALYTICS_EVENTS.dataExported);
    return { ok: true };
  } catch (err) {
    console.warn('[data-export] échec:', err);
    return { error: 'failed' };
  }
}
