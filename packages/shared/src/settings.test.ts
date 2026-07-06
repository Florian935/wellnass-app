import { describe, it, expect } from 'vitest';
import { THEMES, themeSchema, userSettingsRowSchema } from './settings';
import { PILLARS } from './pillar';
import { UNIT_SYSTEMS } from './units';

// ─── Constantes ────────────────────────────────────────────────────────────────

describe('THEMES', () => {
  it('contient exactement les trois valeurs attendues', () => {
    expect(THEMES).toEqual(['light', 'dark', 'system']);
  });
});

// ─── themeSchema ───────────────────────────────────────────────────────────────

describe('themeSchema', () => {
  it.each(THEMES)('accepte la valeur "%s"', (theme) => {
    expect(() => themeSchema.parse(theme)).not.toThrow();
  });

  it('rejette une valeur invalide', () => {
    expect(() => themeSchema.parse('blue')).toThrow();
  });
});

// ─── userSettingsRowSchema ─────────────────────────────────────────────────────

/** Ligne minimale valide (champs sync obligatoires). */
const syncBase = {
  id: '00000000-0000-0000-0000-000000000001',
  userId: '00000000-0000-0000-0000-000000000002',
  createdAt: '2026-07-05T10:00:00Z',
  updatedAt: '2026-07-05T10:00:00Z',
  deletedAt: null,
};

describe('userSettingsRowSchema — defaults', () => {
  it('applique theme = "system" par défaut', () => {
    const row = userSettingsRowSchema.parse({ ...syncBase });
    expect(row.theme).toBe('system');
  });

  it('applique units = "metric" par défaut', () => {
    const row = userSettingsRowSchema.parse({ ...syncBase });
    expect(row.units).toBe('metric');
  });

  it('applique language = "fr" par défaut', () => {
    const row = userSettingsRowSchema.parse({ ...syncBase });
    expect(row.language).toBe('fr');
  });

  it('applique activePillars = tous les piliers par défaut', () => {
    const row = userSettingsRowSchema.parse({ ...syncBase });
    expect(row.activePillars).toEqual([...PILLARS]);
  });

  it('applique notifications = {} par défaut', () => {
    const row = userSettingsRowSchema.parse({ ...syncBase });
    expect(row.notifications).toEqual({});
  });

  it('applique dashboardLayout = null par défaut', () => {
    const row = userSettingsRowSchema.parse({ ...syncBase });
    expect(row.dashboardLayout).toBeNull();
  });
});

describe('userSettingsRowSchema — valeurs explicites', () => {
  it('accepte theme = "dark"', () => {
    const row = userSettingsRowSchema.parse({ ...syncBase, theme: 'dark' });
    expect(row.theme).toBe('dark');
  });

  it('accepte units = "imperial"', () => {
    const row = userSettingsRowSchema.parse({ ...syncBase, units: 'imperial' });
    expect(row.units).toBe('imperial');
  });

  it('accepte language = "en"', () => {
    const row = userSettingsRowSchema.parse({ ...syncBase, language: 'en' });
    expect(row.language).toBe('en');
  });

  it('accepte un sous-ensemble de piliers', () => {
    const row = userSettingsRowSchema.parse({
      ...syncBase,
      activePillars: ['strength', 'nutrition'],
    });
    expect(row.activePillars).toEqual(['strength', 'nutrition']);
  });

  it('accepte des préférences de notifications', () => {
    const row = userSettingsRowSchema.parse({
      ...syncBase,
      notifications: { workout: true, streak: false },
    });
    expect(row.notifications).toEqual({ workout: true, streak: false });
  });

  it('accepte un dashboardLayout non nul', () => {
    const layout = { columns: 2, widgets: ['streak', 'last-workout'] };
    const row = userSettingsRowSchema.parse({ ...syncBase, dashboardLayout: layout });
    expect(row.dashboardLayout).toEqual(layout);
  });

  it('reporte les enums du système d\'unités existant', () => {
    // Vérifie que la valeur acceptée correspond bien à UNIT_SYSTEMS
    for (const u of UNIT_SYSTEMS) {
      expect(() => userSettingsRowSchema.parse({ ...syncBase, units: u })).not.toThrow();
    }
  });
});

describe('userSettingsRowSchema — rejets', () => {
  it('rejette un theme invalide', () => {
    expect(() => userSettingsRowSchema.parse({ ...syncBase, theme: 'neon' })).toThrow();
  });

  it('rejette un pilier invalide dans activePillars', () => {
    expect(() =>
      userSettingsRowSchema.parse({ ...syncBase, activePillars: ['strength', 'yoga'] }),
    ).toThrow();
  });

  it('rejette une langue non supportée', () => {
    expect(() => userSettingsRowSchema.parse({ ...syncBase, language: 'es' })).toThrow();
  });

  it('rejette un id non-UUID', () => {
    expect(() =>
      userSettingsRowSchema.parse({ ...syncBase, id: 'not-a-uuid' }),
    ).toThrow();
  });
});
