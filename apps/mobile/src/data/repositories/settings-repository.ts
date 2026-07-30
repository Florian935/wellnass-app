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

import { useQuery } from '@powersync/react';
import type { NotificationPrefs, Pillar, UnitSystem, UserSettingsRow } from '@wellness/shared';
import {
  PILLARS,
  defaultNotificationPrefs,
  parseJsonColumn,
  parseIntensityScale,
  parseNotificationPrefs,
} from '@wellness/shared';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
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
  | 'theme'
  | 'units'
  | 'intensityScale'
  | 'language'
  | 'activePillars'
  | 'notifications'
  | 'dashboardLayout'
  | 'analyticsEnabled'
  | 'healthConnectEnabled'
>;

/** Ligne brute renvoyée par SQLite (colonnes snake_case). */
type SettingsDbRow = {
  id: string;
  user_id: string;
  theme: string;
  units: string;
  /** Échelle d'intensité affichée (US UX-05). Absente des lignes anciennes → parse tolérant. */
  intensity_scale: string | null;
  language: string;
  /** Stockée en TEXT (JSON sérialisé). */
  active_pillars: string | null;
  /** Stockée en TEXT (JSON sérialisé). */
  notifications: string | null;
  /** Stockée en TEXT (JSON sérialisé) ou null. */
  dashboard_layout: string | null;
  /** 0/1 (consentement analytics) ou null si colonne non renseignée localement. */
  analytics_enabled: number | null;
  /** 0/1 (opt-in Health Connect) ou null si colonne non renseignée localement. */
  health_connect_enabled: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const SELECT_CURRENT =
  'SELECT * FROM user_settings WHERE deleted_at IS NULL LIMIT 1';

// ---------------------------------------------------------------------------
// Mapping snake_case ↔ camelCase
// ---------------------------------------------------------------------------

/**
 * Valide que la colonne `active_pillars` décodée est bien un tableau de piliers connus.
 * Sans ce garde-fou, une ligne corrompue (JSON trop profondément encodé) pouvait laisser
 * une **chaîne** typée `Pillar[]` → `activePillars.map` plantait le rendu du summary
 * d'onboarding (crash rejeu, fix/onboarding-rejeu-profil).
 */
const isPillarArray = (value: unknown): value is Pillar[] =>
  Array.isArray(value) && value.every((p) => (PILLARS as readonly string[]).includes(p as string));

/** Décode la colonne analytics_enabled (0/1/null) → booléen. Défaut opt-out ON (null/absent → true). */
function decodeAnalyticsEnabled(row: SettingsDbRow | null): boolean {
  return row?.analytics_enabled == null ? true : row.analytics_enabled === 1;
}

/**
 * Décode la colonne health_connect_enabled (0/1/null) → booléen. Défaut **opt-in OFF**
 * (null/absent → false) : à l'inverse d'`analytics_enabled`, l'absence de valeur ne vaut jamais
 * consentement — il s'agit de donnée de santé (US CONF-06).
 */
function decodeHealthConnectEnabled(row: SettingsDbRow | null): boolean {
  return row?.health_connect_enabled === 1;
}

/** Convertit une ligne SQLite (snake_case) → objet de domaine (camelCase). */
function rowToSettings(row: SettingsDbRow): UserSettings {
  return {
    id: row.id,
    userId: row.user_id,
    theme: row.theme as UserSettings['theme'],
    units: row.units as UserSettings['units'],
    // Parse tolérant : les lignes locales antérieures à la migration n'ont pas la colonne.
    intensityScale: parseIntensityScale(row.intensity_scale),
    language: row.language as UserSettings['language'],
    activePillars: parseJsonColumn<Pillar[]>(row.active_pillars, [...PILLARS], isPillarArray),
    // Parse tolérant : anciennes valeurs (Record<string,boolean> ou {}) → défauts.
    notifications: parseNotificationPrefs(parseJsonColumn(row.notifications, null)),
    dashboardLayout: parseJsonColumn<unknown>(row.dashboard_layout, null),
    analyticsEnabled: decodeAnalyticsEnabled(row),
    healthConnectEnabled: decodeHealthConnectEnabled(row),
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
  if ('intensityScale' in input) columns['intensity_scale'] = input.intensityScale;
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
  if ('analyticsEnabled' in input) {
    columns['analytics_enabled'] = input.analyticsEnabled ? 1 : 0;
  }
  if ('healthConnectEnabled' in input) {
    columns['health_connect_enabled'] = input.healthConnectEnabled ? 1 : 0;
  }
  return columns;
}

// ---------------------------------------------------------------------------
// Lecture réactive (hook)
// ---------------------------------------------------------------------------

/**
 * Réglages de l'utilisateur courant, réactifs aux changements de la base locale.
 *
 * `isLoading` ne dépend QUE de la résolution de la requête locale (SQLite),
 * jamais de la synchro réseau : le routage / contenu ne doit pas se bloquer sur
 * une synchro réseau (offline-first, ADR-001 / décision B). La base locale est
 * disponible hors-ligne ; `useQuery.isLoading` se résout sans réseau.
 *
 * Une fois `isLoading` faux et `settings` null, le consommateur doit appeler
 * `ensureSettings()` pour initialiser la ligne de réglages par défaut.
 */
export function useSettings(): { settings: UserSettings | null; isLoading: boolean } {
  const { data, isLoading: queryLoading } = useQuery<SettingsDbRow>(SELECT_CURRENT);

  const isLoading = queryLoading;
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

/** Consentement analytics courant (hors contexte React). Défaut opt-out ON si non défini. */
export async function getAnalyticsEnabled(): Promise<boolean> {
  return decodeAnalyticsEnabled(await getCurrentRow());
}

/**
 * Opt-in Health Connect courant (hors contexte React) — lu par le service `health-connect.ts`,
 * qui s'exécute depuis les repositories, en dehors de tout composant. Défaut **OFF**.
 */
export async function getHealthConnectEnabled(): Promise<boolean> {
  return decodeHealthConnectEnabled(await getCurrentRow());
}

/**
 * Préférences de notifications courantes (hors contexte React) — US MUSC-F8. Le push de record est
 * déclenché depuis `doFinish` (callback d'événement, pas un rendu), qui ne peut pas appeler
 * `useNotificationPrefs()`. Même parse tolérant que la version hook.
 */
export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const row = await getCurrentRow();
  return parseNotificationPrefs(parseJsonColumn(row?.notifications ?? null, null));
}

/**
 * Système d'unités courant (hors contexte React) — même besoin que ci-dessus : formater la valeur
 * d'un record dans le contenu du push de célébration.
 */
export async function getUnitSystem(): Promise<UnitSystem> {
  const row = await getCurrentRow();
  return (row?.units as UnitSystem | undefined) ?? 'metric';
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
    notifications: defaultNotificationPrefs(),
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
    ? parseJsonColumn<Pillar[]>(existing.active_pillars, [...PILLARS], isPillarArray)
    : [...PILLARS];

  const isActivation = !current.includes(pillar);
  const next = isActivation ? [...current, pillar] : current.filter((p) => p !== pillar);

  // Analytics : uniquement à l'activation (ajout), pas au retrait. Fire-and-forget.
  if (isActivation) void track(ANALYTICS_EVENTS.pillarActivated, { pillar });

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
    notifications: JSON.stringify(defaultNotificationPrefs()),
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
 * (FR ou EN, sinon FR), `active_pillars` = tous les piliers,
 * `notifications` = préférences par défaut (`defaultNotificationPrefs()`),
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
    notifications: JSON.stringify(defaultNotificationPrefs()),
    dashboard_layout: null,
  });
}
