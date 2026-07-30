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

  it('applique notifications = préférences par défaut', () => {
    const row = userSettingsRowSchema.parse({ ...syncBase });
    expect(row.notifications).toEqual({
      streakDanger: true,
      reminderHour: 20,
      dndEnabled: true,
      dndStartHour: 22,
      dndEndHour: 7,
      maxPerDay: 3,
      weeklyReview: true,
      weeklyReviewHour: 9,
      mealReminder: false,
      mealReminderHour: 13,
      weighInReminder: false,
      weighInReminderHour: 10,
      learnedHour: true,
      recordPush: true,
      sessionReminder: false,
      sessionReminderHour: 18,
    });
  });

  it('applique dashboardLayout = null par défaut', () => {
    const row = userSettingsRowSchema.parse({ ...syncBase });
    expect(row.dashboardLayout).toBeNull();
  });

  it('applique analyticsEnabled = true par défaut (opt-out)', () => {
    const row = userSettingsRowSchema.parse({ ...syncBase });
    expect(row.analyticsEnabled).toBe(true);
  });

  it('applique healthConnectEnabled = false par défaut (opt-in — donnée de santé)', () => {
    const row = userSettingsRowSchema.parse({ ...syncBase });
    expect(row.healthConnectEnabled).toBe(false);
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

  // Ce test énumérait 6 des 8 champs et **entérinait la dérive** : `weeklyReview` /
  // `weeklyReviewHour` étaient strippés sans que rien ne le signale. Il énumère désormais les 16
  // champs, ce qui fait de lui le garde-fou contre une nouvelle dérive.
  it('accepte des préférences de notifications explicites — sans stripper aucun champ', () => {
    expect.hasAssertions();
    const prefs = {
      streakDanger: false,
      reminderHour: 8,
      dndEnabled: false,
      dndStartHour: 23,
      dndEndHour: 6,
      maxPerDay: 5,
      weeklyReview: false,
      weeklyReviewHour: 11,
      mealReminder: true,
      mealReminderHour: 14,
      weighInReminder: true,
      weighInReminderHour: 9,
      learnedHour: false,
      recordPush: false,
      sessionReminder: true,
      sessionReminderHour: 19,
    };
    const row = userSettingsRowSchema.parse({ ...syncBase, notifications: prefs });
    expect(row.notifications).toEqual(prefs);
  });

  // La colonne `notifications` est enrichie **sans migration** : son contrat est le parse tolérant,
  // pas le rejet. Une heure hors bornes est donc **ramenée à son défaut**, jamais levée — sinon le
  // schéma exploserait sur toute ligne écrite avant l'ajout d'un champ.
  it('borne une heure hors bornes au lieu de lever', () => {
    const row = userSettingsRowSchema.parse({
      ...syncBase,
      notifications: { streakDanger: true, reminderHour: 24 },
    });
    expect(row.notifications.reminderHour).toBe(20);
    expect(row.notifications.streakDanger).toBe(true);
  });

  // Le test qui aurait attrapé le piège si on avait complété la liste à 13 champs obligatoires :
  // une ligne écrite avant NUTR-F1 (et même avant BILAN-01) doit continuer de se lire.
  it('lit une ligne antérieure (6 champs) sans lever, en complétant les 7 autres', () => {
    const legacy = {
      streakDanger: false,
      reminderHour: 8,
      dndEnabled: false,
      dndStartHour: 23,
      dndEndHour: 6,
      maxPerDay: 5,
    };
    const row = userSettingsRowSchema.parse({ ...syncBase, notifications: legacy });
    expect(row.notifications).toMatchObject(legacy);
    expect(row.notifications.weeklyReview).toBe(true);
    expect(row.notifications.weeklyReviewHour).toBe(9);
    expect(row.notifications.mealReminder).toBe(false);
    expect(row.notifications.weighInReminderHour).toBe(10);
    expect(row.notifications.learnedHour).toBe(true);
  });

  it("lit l'ancien Record<string, boolean> sans lever", () => {
    const row = userSettingsRowSchema.parse({
      ...syncBase,
      notifications: { streakDanger: true, someLegacyFlag: false },
    });
    expect(row.notifications.reminderHour).toBe(20);
  });

  it('accepte un dashboardLayout non nul', () => {
    const layout = { columns: 2, widgets: ['streak', 'last-workout'] };
    const row = userSettingsRowSchema.parse({ ...syncBase, dashboardLayout: layout });
    expect(row.dashboardLayout).toEqual(layout);
  });

  it('accepte analyticsEnabled = false (opt-out explicite)', () => {
    const row = userSettingsRowSchema.parse({ ...syncBase, analyticsEnabled: false });
    expect(row.analyticsEnabled).toBe(false);
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
