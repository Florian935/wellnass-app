import { describe, it, expect } from 'vitest';
import {
  defaultNotificationPrefs,
  parseNotificationPrefs,
  isWithinDnd,
  shouldScheduleStreakReminder,
  canScheduleMore,
  type NotificationPrefs,
} from './notifications';

// ─── defaultNotificationPrefs ────────────────────────────────────────────────

describe('defaultNotificationPrefs', () => {
  it('retourne les valeurs par défaut attendues', () => {
    expect(defaultNotificationPrefs()).toEqual({
      streakDanger: true,
      reminderHour: 20,
      dndEnabled: true,
      dndStartHour: 22,
      dndEndHour: 7,
      maxPerDay: 3,
    });
  });

  it('place reminderHour HORS de la fenêtre DND par défaut (invariant)', () => {
    const d = defaultNotificationPrefs();
    expect(isWithinDnd(d.reminderHour, d)).toBe(false);
  });

  it('retourne un nouvel objet à chaque appel (pas de partage de référence)', () => {
    expect(defaultNotificationPrefs()).not.toBe(defaultNotificationPrefs());
  });
});

// ─── parseNotificationPrefs ──────────────────────────────────────────────────

describe('parseNotificationPrefs — valeurs de repli', () => {
  it('null → défauts', () => {
    expect(parseNotificationPrefs(null)).toEqual(defaultNotificationPrefs());
  });

  it('undefined → défauts', () => {
    expect(parseNotificationPrefs(undefined)).toEqual(defaultNotificationPrefs());
  });

  it('objet vide {} → défauts', () => {
    expect(parseNotificationPrefs({})).toEqual(defaultNotificationPrefs());
  });

  it('ancien Record<string, boolean> → défauts (champs inconnus ignorés)', () => {
    expect(parseNotificationPrefs({ workout: true, streak: false })).toEqual(
      defaultNotificationPrefs(),
    );
  });

  it('tableau → défauts', () => {
    expect(parseNotificationPrefs([1, 2, 3])).toEqual(defaultNotificationPrefs());
  });

  it('primitive (string) → défauts', () => {
    expect(parseNotificationPrefs('nope')).toEqual(defaultNotificationPrefs());
  });
});

describe('parseNotificationPrefs — champs partiels et bornes', () => {
  it('complète les champs manquants avec les défauts', () => {
    const parsed = parseNotificationPrefs({ streakDanger: false, reminderHour: 8 });
    expect(parsed).toEqual({
      streakDanger: false,
      reminderHour: 8,
      dndEnabled: true,
      dndStartHour: 22,
      dndEndHour: 7,
      maxPerDay: 3,
    });
  });

  it('borne une heure négative sur le défaut', () => {
    expect(parseNotificationPrefs({ reminderHour: -1 }).reminderHour).toBe(20);
  });

  it('borne une heure > 23 sur le défaut', () => {
    expect(parseNotificationPrefs({ dndStartHour: 24 }).dndStartHour).toBe(22);
  });

  it('accepte les bornes 0 et 23', () => {
    const parsed = parseNotificationPrefs({ reminderHour: 0, dndStartHour: 23 });
    expect(parsed.reminderHour).toBe(0);
    expect(parsed.dndStartHour).toBe(23);
  });

  it('tronque une heure fractionnaire valide', () => {
    expect(parseNotificationPrefs({ reminderHour: 20.9 }).reminderHour).toBe(20);
  });

  it('ignore un type invalide (string) pour une heure', () => {
    expect(parseNotificationPrefs({ reminderHour: '20' }).reminderHour).toBe(20);
  });

  it('ignore un type invalide pour un booléen', () => {
    expect(parseNotificationPrefs({ dndEnabled: 'yes' }).dndEnabled).toBe(true);
  });

  it('accepte un maxPerDay valide', () => {
    expect(parseNotificationPrefs({ maxPerDay: 5 }).maxPerDay).toBe(5);
  });

  it('rejette un maxPerDay < 1 sur le défaut', () => {
    expect(parseNotificationPrefs({ maxPerDay: 0 }).maxPerDay).toBe(3);
  });

  it('rejette un maxPerDay non numérique sur le défaut', () => {
    expect(parseNotificationPrefs({ maxPerDay: 'lots' }).maxPerDay).toBe(3);
  });
});

// ─── isWithinDnd ─────────────────────────────────────────────────────────────

describe('isWithinDnd', () => {
  const base = defaultNotificationPrefs();

  it('retourne false si DND désactivé, même dans la fenêtre', () => {
    const prefs: NotificationPrefs = { ...base, dndEnabled: false };
    // 23h est dans [22,7) mais DND off
    expect(isWithinDnd(23, prefs)).toBe(false);
  });

  describe('fenêtre enjambant minuit (22 → 7, défaut)', () => {
    it.each([22, 23, 0, 3, 6])('%s h est dans la fenêtre', (h) => {
      expect(isWithinDnd(h, base)).toBe(true);
    });
    it.each([7, 8, 12, 20, 21])('%s h est hors de la fenêtre', (h) => {
      expect(isWithinDnd(h, base)).toBe(false);
    });
  });

  describe('fenêtre simple (9 → 17)', () => {
    const prefs: NotificationPrefs = { ...base, dndStartHour: 9, dndEndHour: 17 };
    it.each([9, 10, 16])('%s h est dans la fenêtre', (h) => {
      expect(isWithinDnd(h, prefs)).toBe(true);
    });
    it.each([8, 17, 18, 0])('%s h est hors de la fenêtre', (h) => {
      expect(isWithinDnd(h, prefs)).toBe(false);
    });
  });

  it('fenêtre vide (start === end) → false', () => {
    const prefs: NotificationPrefs = { ...base, dndStartHour: 10, dndEndHour: 10 };
    expect(isWithinDnd(10, prefs)).toBe(false);
    expect(isWithinDnd(11, prefs)).toBe(false);
  });
});

// ─── shouldScheduleStreakReminder ────────────────────────────────────────────

describe('shouldScheduleStreakReminder', () => {
  const prefs = defaultNotificationPrefs(); // reminderHour 20, DND 22-7

  it('true : activé, inactif, avant l’heure, hors DND', () => {
    expect(
      shouldScheduleStreakReminder({
        enabled: true,
        activeToday: false,
        nowHour: 12,
        reminderHour: 20,
        prefs,
      }),
    ).toBe(true);
  });

  it('false si désactivé', () => {
    expect(
      shouldScheduleStreakReminder({
        enabled: false,
        activeToday: false,
        nowHour: 12,
        reminderHour: 20,
        prefs,
      }),
    ).toBe(false);
  });

  it('false si déjà actif aujourd’hui', () => {
    expect(
      shouldScheduleStreakReminder({
        enabled: true,
        activeToday: true,
        nowHour: 12,
        reminderHour: 20,
        prefs,
      }),
    ).toBe(false);
  });

  it('false si l’heure de rappel est déjà passée (nowHour >= reminderHour)', () => {
    expect(
      shouldScheduleStreakReminder({
        enabled: true,
        activeToday: false,
        nowHour: 20,
        reminderHour: 20,
        prefs,
      }),
    ).toBe(false);
    expect(
      shouldScheduleStreakReminder({
        enabled: true,
        activeToday: false,
        nowHour: 21,
        reminderHour: 20,
        prefs,
      }),
    ).toBe(false);
  });

  it('false si le créneau de rappel tombe en DND', () => {
    // reminderHour 23 tombe dans DND 22-7
    expect(
      shouldScheduleStreakReminder({
        enabled: true,
        activeToday: false,
        nowHour: 12,
        reminderHour: 23,
        prefs,
      }),
    ).toBe(false);
  });
});

// ─── canScheduleMore ─────────────────────────────────────────────────────────

describe('canScheduleMore', () => {
  const prefs = defaultNotificationPrefs(); // maxPerDay 3

  it('true tant que countToday < maxPerDay', () => {
    expect(canScheduleMore(0, prefs)).toBe(true);
    expect(canScheduleMore(2, prefs)).toBe(true);
  });

  it('false une fois le plafond atteint', () => {
    expect(canScheduleMore(3, prefs)).toBe(false);
    expect(canScheduleMore(4, prefs)).toBe(false);
  });
});
