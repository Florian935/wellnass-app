/**
 * Repository des réglages utilisateur (une ligne par compte).
 *
 * Responsabilité unique : lire/écrire la table locale `user_settings` de
 * PowerSync et assurer le mapping snake_case (base) ↔ camelCase (domaine Zod
 * `@wellness/shared`).
 *
 * Colonnes JSON (`active_pillars`, `notifications`, `dashboard_layout`) sont
 * stockées en TEXT côté SQLite (déclaration PowerSync `column.text`) et
 * sérialisées / désérialisées explicitement ici.
 *
 * Règles offline-first (voir docs/specs/technical/offline-sync.md) :
 *  - UUID généré côté client (via `insertWithSyncFields`).
 *  - Timestamps en UTC.
 *  - `user_id` = utilisateur de la session courante (posé à l'insertion).
 *
 * PowerSync ne réplique que les lignes de l'utilisateur courant (bucket par
 * JWT) : en lecture, `WHERE deleted_at IS NULL LIMIT 1` suffit.
 */

import { useQuery, useStatus } from '@powersync/react';
import type { UserSettingsRow } from '@wellness/shared';
import { PILLARS } from '@wellness/shared';
import type { Pillar } from '@wellness/shared';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { resolveDeviceLocale } from '@/i18n';
import { insertWithSyncFields, patch } from './_sql';

/** Réglages applicatifs (forme camelCase du domaine partagé). */
export type UserSettings = UserSettingsRow;

/**
 * Champs applicatifs modifiables des réglages (hors champs de synchro `id`,
 * `userId`, timestamps, gérés automatiquement par la couche `_sql`).
 */
export type SettingsInput = Pick<
  UserSettingsRow,
  'theme' | 'units' | 'language' | 'activePillars' | 'notifications' | 'dashboardLayout'
>;

/** Ligne brute renvoyée par SQLite (colonnes snake_case). */
type SettingsDbRow = {
  id: string;
  user_id: string;
  theme: string;
  units: string;
  language: string;
  /** Stockée en TEXT (JSON sérialisé). */
  active_pillars: string | null;
  /** Stockée en TEXT (JSON sérialisé). */
  notifications: string | null;
  /** Stockée en TEXT (JSON sérialisé) ou null. */
  dashboard_layout: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const SELECT_CURRENT =
  'SELECT * FROM user_settings WHERE deleted_at IS NULL LIMIT 1';

// ---------------------------------------------------------------------------
// Parsing sécurisé des colonnes JSON
// ---------------------------------------------------------------------------

/** Parse une colonne TEXT stockée en JSON ; retourne `fallback` si vide/invalide. */
function parseJsonColumn<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Mapping snake_case ↔ camelCase
// ---------------------------------------------------------------------------

/** Convertit une ligne SQLite (snake_case) → objet de domaine (camelCase). */
function rowToSettings(row: SettingsDbRow): UserSettings {
  return {
    id: row.id,
    userId: row.user_id,
    theme: row.theme as UserSettings['theme'],
    units: row.units as UserSettings['units'],
    language: row.language as UserSettings['language'],
    activePillars: parseJsonColumn<Pillar[]>(row.active_pillars, [...PILLARS]),
    notifications: parseJsonColumn<Record<string, boolean>>(row.notifications, {}),
    dashboardLayout: parseJsonColumn<unknown>(row.dashboard_layout, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/** Convertit un patch de domaine (camelCase) → colonnes SQLite (snake_case). */
function inputToColumns(input: Partial<SettingsInput>): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  if ('theme' in input) columns['theme'] = input.theme;
  if ('units' in input) columns['units'] = input.units;
  if ('language' in input) columns['language'] = input.language;
  if ('activePillars' in input) {
    columns['active_pillars'] = JSON.stringify(input.activePillars);
  }
  if ('notifications' in input) {
    columns['notifications'] = JSON.stringify(input.notifications);
  }
  if ('dashboardLayout' in input) {
    columns['dashboard_layout'] =
      input.dashboardLayout !== null && input.dashboardLayout !== undefined
        ? JSON.stringify(input.dashboardLayout)
        : null;
  }
  return columns;
}

// ---------------------------------------------------------------------------
// Lecture réactive (hook)
// ---------------------------------------------------------------------------

/**
 * Réglages de l'utilisateur courant, réactifs aux changements de la base locale.
 *
 * `isLoading` reflète l'état de la base locale, pas seulement « 0 ligne » :
 *  - tant que `useQuery` n'a pas résolu (ouverture SQLite / premier rendu) ;
 *  - OU tant que la première synchro n'est pas terminée (`status.hasSynced` faux),
 *    pour distinguer « pas encore chargé » de « chargé, aucune ligne ».
 *
 * Une fois `isLoading` faux et `settings` null, le consommateur doit appeler
 * `ensureSettings()` pour initialiser la ligne de réglages par défaut.
 */
export function useSettings(): { settings: UserSettings | null; isLoading: boolean } {
  const status = useStatus();
  const { data, isLoading: queryLoading } = useQuery<SettingsDbRow>(SELECT_CURRENT);

  const isLoading = queryLoading || !status.hasSynced;
  const row = data[0];
  const settings = row ? rowToSettings(row) : null;

  return { settings, isLoading };
}

// ---------------------------------------------------------------------------
// Écritures (hors contexte hook)
// ---------------------------------------------------------------------------

/** Identifiant de l'utilisateur de la session courante (lève si déconnecté). */
function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) {
    throw new Error("Aucune session active : impossible d'écrire les réglages.");
  }
  return userId;
}

/** Lit la ligne de réglages courante (ou null) hors contexte réactif. */
async function getCurrentRow(): Promise<SettingsDbRow | null> {
  return powerSync.getOptional<SettingsDbRow>(SELECT_CURRENT);
}

/**
 * Met à jour les réglages de l'utilisateur courant.
 * Patch la ligne existante si elle existe, sinon insère avec `user_id` +
 * defaults fusionnés.
 */
export async function updateSettings(patchInput: Partial<SettingsInput>): Promise<void> {
  const columns = inputToColumns(patchInput);
  const existing = await getCurrentRow();

  if (existing) {
    await patch('user_settings', existing.id, columns);
    return;
  }

  // Aucune ligne : insérer avec les defaults + le patch appliqué par-dessus.
  const deviceLocale = resolveDeviceLocale();
  const defaults = inputToColumns({
    theme: 'system',
    units: 'metric',
    language: deviceLocale,
    activePillars: [...PILLARS],
    notifications: {},
    dashboardLayout: null,
  });

  await insertWithSyncFields('user_settings', {
    user_id: currentUserId(),
    ...defaults,
    ...columns,
  });
}

/**
 * Active ou désactive un pilier dans `active_pillars`.
 * Si le pilier est présent → retrait. S'il est absent → ajout.
 * En l'absence de ligne existante, part de tous les piliers puis applique le toggle.
 */
export async function togglePillar(pillar: Pillar): Promise<void> {
  const existing = await getCurrentRow();
  const current: Pillar[] = existing
    ? parseJsonColumn<Pillar[]>(existing.active_pillars, [...PILLARS])
    : [...PILLARS];

  const next = current.includes(pillar)
    ? current.filter((p) => p !== pillar)
    : [...current, pillar];

  if (existing) {
    await patch('user_settings', existing.id, {
      active_pillars: JSON.stringify(next),
    });
    return;
  }

  // Aucune ligne : créer la ligne complète avec les defaults + active_pillars patché.
  const deviceLocale = resolveDeviceLocale();
  await insertWithSyncFields('user_settings', {
    user_id: currentUserId(),
    theme: 'system',
    units: 'metric',
    language: deviceLocale,
    active_pillars: JSON.stringify(next),
    notifications: JSON.stringify({}),
    dashboard_layout: null,
  });
}

/**
 * Insère une ligne de réglages par défaut si aucune n'existe encore.
 *
 * À appeler côté consommateur uniquement lorsque `isLoading` est `false` et
 * que `settings` est `null` (premier accès après création de compte).
 * NE PAS appeler pendant le chargement.
 *
 * Defaults : `theme='system'`, `units='metric'`, `language` = locale appareil
 * (FR ou EN, sinon FR), `active_pillars` = tous les piliers, `notifications={}`,
 * `dashboard_layout=null`.
 */
export async function ensureSettings(): Promise<void> {
  const existing = await getCurrentRow();
  if (existing) return;

  const deviceLocale = resolveDeviceLocale();

  await insertWithSyncFields('user_settings', {
    user_id: currentUserId(),
    theme: 'system',
    units: 'metric',
    language: deviceLocale,
    active_pillars: JSON.stringify([...PILLARS]),
    notifications: JSON.stringify({}),
    dashboard_layout: null,
  });
}
