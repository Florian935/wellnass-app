/**
 * Réglages — écritures et lectures hors contexte React, sur **du vrai SQLite**.
 *
 * Ce repository est **la cause du bug de la recette du 31/07/2026** qui a lancé tout ce chantier :
 * une colonne (`cycle_tracking_enabled`) absente du schéma PowerSync local faisait échouer
 * l'écriture, `void updateSettings()` avalait l'erreur, et l'interrupteur restait éteint **sans le
 * moindre message**. Le harness rejoue les requêtes contre le schéma réel : cette classe de panne
 * ne peut plus passer inaperçue.
 *
 * Trois familles d'invariants, toutes silencieuses en cas de défaut :
 *
 *  1. **Les défauts des opt-in sensibles.** Health Connect et les deux réglages du cycle valent
 *     **OFF** en l'absence de ligne ou de valeur — un défaut inversé activerait une synchro de
 *     santé que personne n'a demandée. À l'inverse, l'analytics est en **opt-out** : ON par défaut.
 *     Se tromper de sens ne se voit sur aucun écran.
 *  2. **Les colonnes JSON.** `active_pillars`, `notifications`, `dashboard_layout` sont
 *     sérialisées à la main. Une valeur illisible doit **retomber sur un défaut**, pas faire
 *     planter l'app au démarrage.
 *  3. **Le patch partiel.** `updateSettings` ne doit écrire que les clés fournies : régler le
 *     thème ne doit pas réinitialiser les piliers actifs.
 */

import {
  ensureSettings,
  getAnalyticsEnabled,
  getCycleHealthConnectEnabled,
  getCycleTrackingEnabled,
  getHealthConnectEnabled,
  getNotificationPrefs,
  getUnitSystem,
  togglePillar,
  updateSettings,
} from '../settings-repository';
import { resetTestDb, rowsOf, seed } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

type SettingsRow = {
  id: string;
  user_id: string;
  theme: string | null;
  units: string | null;
  language: string | null;
  active_pillars: string | null;
  notifications: string | null;
  dashboard_layout: string | null;
  analytics_enabled: number | null;
  health_connect_enabled: number | null;
  cycle_tracking_enabled: number | null;
  cycle_health_connect_enabled: number | null;
  intensity_scale: string | null;
};

const settings = (d = false) => rowsOf<SettingsRow>('user_settings', d);
const row = () => settings()[0];

/** Piliers actifs décodés depuis la colonne JSON. */
const pillars = (): string[] => JSON.parse(row()?.active_pillars ?? '[]');

beforeEach(() => {
  resetTestDb();
});

// ---------------------------------------------------------------------------
// Création de la ligne
// ---------------------------------------------------------------------------

describe('ensureSettings', () => {
  it('crée la ligne de réglages avec ses défauts', async () => {
    await ensureSettings();

    expect(settings()).toHaveLength(1);
    expect(row()).toMatchObject({ user_id: 'user-1', theme: 'system', units: 'metric' });
    expect(pillars()).toEqual(expect.arrayContaining(['strength', 'running', 'nutrition']));
  });

  it('est idempotente — un second appel ne crée pas de doublon', async () => {
    await ensureSettings();
    await ensureSettings();

    expect(settings()).toHaveLength(1);
  });

  it('ne ressuscite pas une ligne supprimée : elle en crée une neuve', async () => {
    seed('user_settings', [
      { user_id: 'user-1', theme: 'dark', deleted_at: new Date().toISOString() },
    ]);

    await ensureSettings();

    expect(settings()).toHaveLength(1);
    expect(row()?.theme).toBe('system');
  });
});

// ---------------------------------------------------------------------------
// Patch partiel
// ---------------------------------------------------------------------------

describe('updateSettings', () => {
  it('crée la ligne avec les défauts quand elle n’existe pas, patch appliqué par-dessus', async () => {
    await updateSettings({ theme: 'dark' });

    expect(row()).toMatchObject({ theme: 'dark', units: 'metric' });
    expect(pillars().length).toBeGreaterThan(0);
  });

  it('n’écrit QUE les clés fournies — régler le thème ne touche pas les piliers', async () => {
    await ensureSettings();
    await updateSettings({ activePillars: ['strength'] });

    await updateSettings({ theme: 'dark' });

    expect(row()?.theme).toBe('dark');
    expect(pillars()).toEqual(['strength']);
  });

  it('sérialise les colonnes JSON', async () => {
    await updateSettings({
      activePillars: ['strength', 'nutrition'],
      dashboardLayout: ['streak', 'steps'],
    });

    expect(pillars()).toEqual(['strength', 'nutrition']);
    expect(JSON.parse(row()?.dashboard_layout ?? 'null')).toEqual(['streak', 'steps']);
  });

  it('écrit `null` — et non la chaîne « null » — pour une disposition effacée', async () => {
    await updateSettings({ dashboardLayout: ['streak'] });

    await updateSettings({ dashboardLayout: null });

    // Une chaîne « null » serait relue comme une valeur, pas comme une absence.
    expect(row()?.dashboard_layout).toBeNull();
  });

  it('stocke les booléens en 0/1', async () => {
    await updateSettings({ analyticsEnabled: false, healthConnectEnabled: true });

    expect(row()).toMatchObject({ analytics_enabled: 0, health_connect_enabled: 1 });
  });

  it('écrit la colonne du suivi de cycle — celle qui manquait au 31/07/2026', async () => {
    await updateSettings({ cycleTrackingEnabled: true });

    // Non-régression du bug fondateur : colonne absente du schéma local → écriture rejetée,
    // erreur avalée par le `void`, interrupteur éteint sans message.
    expect(row()?.cycle_tracking_enabled).toBe(1);
    expect(await getCycleTrackingEnabled()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Défauts des opt-in — le sens compte
// ---------------------------------------------------------------------------

describe('défauts des opt-in', () => {
  it('analytics : ON par défaut (opt-OUT), même sans aucune ligne', async () => {
    expect(await getAnalyticsEnabled()).toBe(true);

    await ensureSettings();
    expect(await getAnalyticsEnabled()).toBe(true);
  });

  it.each([
    ['Health Connect', getHealthConnectEnabled],
    ['suivi du cycle', getCycleTrackingEnabled],
    ['synchro cycle ↔ Health Connect', getCycleHealthConnectEnabled],
  ])('%s : OFF par défaut, même sans aucune ligne', async (_label, read) => {
    // Donnée de santé : un défaut inversé activerait une synchro que personne n'a demandée.
    expect(await read()).toBe(false);

    await ensureSettings();
    expect(await read()).toBe(false);
  });

  it('respecte la valeur enregistrée une fois posée', async () => {
    await updateSettings({ analyticsEnabled: false, healthConnectEnabled: true });

    expect(await getAnalyticsEnabled()).toBe(false);
    expect(await getHealthConnectEnabled()).toBe(true);
  });

  it('ignore une ligne supprimée pour les lectures', async () => {
    seed('user_settings', [
      {
        user_id: 'user-1',
        health_connect_enabled: 1,
        deleted_at: new Date().toISOString(),
      },
    ]);

    expect(await getHealthConnectEnabled()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Colonnes JSON — tolérance
// ---------------------------------------------------------------------------

describe('colonnes JSON illisibles', () => {
  it('retombe sur les préférences de notification par défaut', async () => {
    seed('user_settings', [{ user_id: 'user-1', notifications: 'pas du json' }]);

    // Une valeur corrompue ne doit pas faire planter l'app au démarrage.
    await expect(getNotificationPrefs()).resolves.toEqual(expect.any(Object));
  });

  it('retombe sur tous les piliers quand `active_pillars` est illisible', async () => {
    seed('user_settings', [{ user_id: 'user-1', active_pillars: '{{{' }]);

    await togglePillar('strength');

    // Défaut = tous les piliers, moins celui qu'on vient de retirer.
    expect(pillars()).not.toContain('strength');
    expect(pillars().length).toBeGreaterThan(0);
  });

  it('retombe sur le système métrique quand l’unité est absente', async () => {
    seed('user_settings', [{ user_id: 'user-1' }]);

    expect(await getUnitSystem()).toBe('metric');
  });
});

// ---------------------------------------------------------------------------
// Bascule de pilier
// ---------------------------------------------------------------------------

describe('togglePillar', () => {
  it('retire un pilier actif et le signale comme désactivé', async () => {
    await ensureSettings();

    const result = await togglePillar('running');

    expect(result).toEqual({ activated: false });
    expect(pillars()).not.toContain('running');
  });

  it('rajoute un pilier absent et le signale comme activé', async () => {
    await updateSettings({ activePillars: ['strength'] });

    const result = await togglePillar('nutrition');

    expect(result).toEqual({ activated: true });
    expect(pillars()).toEqual(expect.arrayContaining(['strength', 'nutrition']));
  });

  it('crée la ligne complète si elle n’existe pas encore', async () => {
    const result = await togglePillar('running');

    expect(result).toEqual({ activated: false });
    expect(settings()).toHaveLength(1);
    expect(row()).toMatchObject({ theme: 'system', units: 'metric' });
    expect(pillars()).not.toContain('running');
  });

  it('est réversible — deux bascules ramènent à l’état initial', async () => {
    await ensureSettings();
    const avant = pillars().slice().sort();

    await togglePillar('running');
    await togglePillar('running');

    expect(pillars().slice().sort()).toEqual(avant);
  });

  it('ne crée jamais de doublon dans la liste', async () => {
    await updateSettings({ activePillars: ['strength'] });

    await togglePillar('strength');
    await togglePillar('strength');

    expect(pillars().filter((p) => p === 'strength')).toHaveLength(1);
  });
});
