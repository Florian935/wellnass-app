/**
 * Orchestration native de l'export RGPD (US CONF-01).
 *
 * Lit toutes les données perso de l'utilisateur dans la base locale PowerSync
 * (voir `EXPORT_TABLES` ci-dessous pour le compte exact et l'historique des ajouts — le chiffre
 * a été retiré d'ici pour ne plus se périmer à chaque US qui étend la liste), assemble l'enveloppe
 * JSON (logique pure partagée) → écrit dans le
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
export const EXPORT_TABLES: { table: string; col: 'user_id' | 'owner_id' }[] = [
  { table: 'profiles', col: 'user_id' }, { table: 'user_settings', col: 'user_id' },
  { table: 'nutrition_profiles', col: 'user_id' }, { table: 'running_profiles', col: 'user_id' },
  { table: 'workouts', col: 'user_id' }, { table: 'workout_sets', col: 'user_id' },
  { table: 'programs', col: 'owner_id' }, { table: 'program_translations', col: 'owner_id' },
  { table: 'sessions', col: 'owner_id' },
  { table: 'exercise_plans', col: 'owner_id' },
  // US RUN-F2c — blocs fractionné d'une séance de course. Miroir structurel d'`exercise_plans` :
  // sans eux, un programme fractionné personnel s'exportait avec ses séances mais **sans leur
  // contenu**. Oubli de l'US d'origine, rattrapé le 03/08/2026 par le test de complétude.
  { table: 'session_intervals', col: 'owner_id' },
  { table: 'personal_records', col: 'user_id' },
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
  // US PAS-01 — donnée de santé conservée sur nos serveurs : elle doit être exportable (RGPD).
  { table: 'daily_steps', col: 'user_id' },
  // US BIEN-01 — indicateurs subjectifs (humeur / énergie / stress), synchronisés : même exigence.
  { table: 'daily_wellbeing', col: 'user_id' },
  // US MESUR-01 — mensurations corporelles : donnée personnelle historisée, donc exportable.
  { table: 'body_measurements', col: 'user_id' },
  // US STREAK-01 — jokers de série consommés.
  { table: 'streak_jokers', col: 'user_id' },
  // US OBJ-01 — objectifs à échéance. Seuls la cible et le point de départ sont stockés : la
  // progression est dérivée, donc absente de l'export par construction (elle se recalcule).
  { table: 'personal_goals', col: 'user_id' },
  // US VIE-01 — périodes « mode vie réelle ». Donnée personnelle déclarée par l'utilisateur et
  // synchronisée : exportable. Elle est aussi ce qui **explique** une semaine creuse dans le reste de
  // l'export (décision D2 : les jours restent dans les données, la période les annote) — l'omettre
  // rendrait l'archive exacte mais illisible.
  { table: 'real_life_periods', col: 'user_id' },
  // US CYCLE-01 — cycle menstruel. **Catégorie sensible au sens du RGPD** : l'omettre de l'export
  // ne serait pas une finition oubliée mais un manquement réglementaire. Les deux tables sont
  // exportées même quand le suivi a été désactivé sans suppression (R17 : « garder » est un choix
  // possible, et ce qui est gardé reste exportable).
  { table: 'menstrual_periods', col: 'user_id' },
  { table: 'menstrual_daily_logs', col: 'user_id' },
  // US REPAS-01 — planning repas et listes de courses. Le planning est une **intention**, pas du
  // consommé (règle R1), mais c'est une donnée personnelle saisie par l'utilisateur et synchronisée :
  // elle relève de la portabilité au même titre que le journal. Les listes de courses sont dérivées
  // du planning, mais leur état coché est un travail de l'utilisateur qui n'est reconstituable
  // nulle part ailleurs.
  { table: 'meal_plan_entries', col: 'user_id' },
  { table: 'shopping_lists', col: 'user_id' },
  { table: 'shopping_list_items', col: 'user_id' },
];

/**
 * Tables du schéma local **volontairement absentes** de l'export, avec leur raison.
 *
 * Existe pour que l'omission soit un **choix** et non un oubli : le test de complétude
 * (`data-export.test.ts`) échoue dès qu'une table du schéma PowerSync n'est ni exportée, ni listée
 * ici. Une table de données personnelles ajoutée sans y penser n'est pas une finition manquante,
 * c'est un manquement RGPD — et il resterait invisible, l'export « réussissant » sans elle.
 */
export const EXPORT_EXCLUSIONS: Record<string, string> = {
  // Télémétrie d'usage, opt-in et sans donnée identifiante (allowlist stricte `ALLOWED_PROP_KEYS`).
  // ⚠️ À trancher : la table porte un `user_id` et vit sur nos serveurs, donc son inclusion dans le
  // droit à la portabilité est défendable. Exclusion **héritée**, jamais arbitrée explicitement —
  // signalée le 03/08/2026, décision produit/juridique à prendre.
  analytics_events: 'télémétrie opt-in, sans donnée identifiante — inclusion à arbitrer',
};

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
