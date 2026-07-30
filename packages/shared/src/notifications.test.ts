import { describe, it, expect } from 'vitest';
import {
  defaultNotificationPrefs,
  parseNotificationPrefs,
  isWithinDnd,
  shouldScheduleStreakReminder,
  canScheduleMore,
  shouldScheduleWeeklyReview,
  WEEKLY_REVIEW_WEEKDAY,
  clampOutOfDnd,
  decideProgrammedReminder,
  REMINDER_MIN_LEAD_MINUTES,
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
      weeklyReview: true,
      weeklyReviewHour: 9,
      mealReminder: false,
      mealReminderHour: 13,
      weighInReminder: false,
      weighInReminderHour: 10,
      learnedHour: true,
    });
  });

  it('laisse les deux rappels programmés ÉTEINTS par défaut (opt-in, NUTR-F1)', () => {
    const d = defaultNotificationPrefs();
    expect(d.mealReminder).toBe(false);
    expect(d.weighInReminder).toBe(false);
  });

  it('place les QUATRE heures par défaut HORS de la fenêtre DND (invariant)', () => {
    // Sans cet invariant, la notification serait planifiée puis systématiquement supprimée par le
    // filtre DND — une fonctionnalité muette, sans aucune erreur visible.
    const d = defaultNotificationPrefs();
    for (const hour of [d.reminderHour, d.weeklyReviewHour, d.mealReminderHour, d.weighInReminderHour]) {
      expect(isWithinDnd(hour, d)).toBe(false);
    }
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
      weeklyReview: true,
      weeklyReviewHour: 9,
      mealReminder: false,
      mealReminderHour: 13,
      weighInReminder: false,
      weighInReminderHour: 10,
      learnedHour: true,
    });
  });

  it('lit les 5 champs de NUTR-F1, et sinon retombe sur leurs défauts', () => {
    // Le point qui compte : les réglages DÉJÀ enregistrés en base ne contiennent aucun de ces
    // champs. Ils doivent continuer de fonctionner sans migration — et surtout **rappels éteints**,
    // pour ne pas se mettre à notifier des utilisateurs qui n'ont rien demandé.
    expect(parseNotificationPrefs({ streakDanger: true })).toMatchObject({
      mealReminder: false,
      mealReminderHour: 13,
      weighInReminder: false,
      weighInReminderHour: 10,
      learnedHour: true,
    });
    expect(
      parseNotificationPrefs({
        mealReminder: true,
        mealReminderHour: 14,
        weighInReminder: true,
        weighInReminderHour: 9,
        learnedHour: false,
      }),
    ).toMatchObject({
      mealReminder: true,
      mealReminderHour: 14,
      weighInReminder: true,
      weighInReminderHour: 9,
      learnedHour: false,
    });
    expect(parseNotificationPrefs({ mealReminderHour: 99 }).mealReminderHour).toBe(13);
    expect(parseNotificationPrefs({ weighInReminderHour: -2 }).weighInReminderHour).toBe(10);
    expect(parseNotificationPrefs({ learnedHour: 'oui' }).learnedHour).toBe(true);
  });

  it('lit les 2 champs du bilan hebdo, et sinon retombe sur leurs défauts', () => {
    // Le point qui compte : les réglages DÉJÀ enregistrés par les utilisateurs ne contiennent pas
    // ces champs. Ils doivent continuer de fonctionner sans aucune migration (BILAN-01, D7).
    expect(parseNotificationPrefs({ weeklyReview: false, weeklyReviewHour: 18 })).toMatchObject({
      weeklyReview: false,
      weeklyReviewHour: 18,
    });
    expect(parseNotificationPrefs({ streakDanger: true })).toMatchObject({
      weeklyReview: true,
      weeklyReviewHour: 9,
    });
    expect(parseNotificationPrefs({ weeklyReviewHour: 99 }).weeklyReviewHour).toBe(9);
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

// ─── shouldScheduleWeeklyReview (BILAN-01) ───────────────────────────────────

describe('shouldScheduleWeeklyReview', () => {
  const prefs = defaultNotificationPrefs(); // weeklyReview true, 9 h, DND [22,7)

  it('planifie quand c’est activé et qu’il y a quelque chose à dire', () => {
    expect(shouldScheduleWeeklyReview({ enabled: true, hasContent: true, prefs })).toBe(true);
  });

  it('NE planifie PAS pour une semaine vide — pas de « tu n’as rien fait »', () => {
    // Décision D4 : une notification punitive fait désinstaller. Le silence respecte l'utilisateur.
    expect(shouldScheduleWeeklyReview({ enabled: true, hasContent: false, prefs })).toBe(false);
  });

  it('ne planifie pas si la préférence est désactivée', () => {
    expect(shouldScheduleWeeklyReview({ enabled: false, hasContent: true, prefs })).toBe(false);
  });

  it('ne planifie pas si l’heure visée tombe en DND', () => {
    // Cas réel : l'utilisateur règle son bilan à 23 h et garde le DND par défaut [22,7).
    const nightly: NotificationPrefs = { ...prefs, weeklyReviewHour: 23 };
    expect(shouldScheduleWeeklyReview({ enabled: true, hasContent: true, prefs: nightly })).toBe(
      false,
    );
  });

  it('planifie à 23 h si le DND est désactivé', () => {
    const nightly: NotificationPrefs = { ...prefs, weeklyReviewHour: 23, dndEnabled: false };
    expect(shouldScheduleWeeklyReview({ enabled: true, hasContent: true, prefs: nightly })).toBe(
      true,
    );
  });

  it('lundi vaut 2 dans la convention du SDK (1 = dimanche), pas 1', () => {
    // La confusion la plus probable de tout le lot : 1 = dimanche côté expo-notifications.
    expect(WEEKLY_REVIEW_WEEKDAY).toBe(2);
  });
});

// ─── clampOutOfDnd (NUTR-F1, D5) ─────────────────────────────────────────────

describe('clampOutOfDnd', () => {
  const prefs = defaultNotificationPrefs(); // DND [22, 7)

  it('laisse une heure déjà hors fenêtre inchangée', () => {
    expect(clampOutOfDnd(8, prefs)).toBe(8);
    expect(clampOutOfDnd(13, prefs)).toBe(13);
    expect(clampOutOfDnd(21, prefs)).toBe(21);
  });

  it('laisse inchangé quand le DND est désactivé', () => {
    const off: NotificationPrefs = { ...prefs, dndEnabled: false };
    expect(clampOutOfDnd(2, off)).toBe(2);
  });

  it('laisse inchangé quand la fenêtre est vide (start === end)', () => {
    const empty: NotificationPrefs = { ...prefs, dndStartHour: 9, dndEndHour: 9 };
    expect(clampOutOfDnd(9, empty)).toBe(9);
  });

  describe('fenêtre enjambant minuit [22, 7)', () => {
    it.each([
      [22, 21],
      [23, 21],
      [0, 21],
      [3, 7], // à équidistance de 21 h (6 h en arrière) et 7 h (4 h en avant) → le plus proche
      [5, 7],
      [6, 7],
    ])('rabat %i h sur %i h', (hour, expected) => {
      expect(clampOutOfDnd(hour, prefs)).toBe(expected);
    });
  });

  describe('fenêtre simple [9, 17)', () => {
    const day: NotificationPrefs = { ...prefs, dndStartHour: 9, dndEndHour: 17 };

    it.each([
      [9, 8],
      [10, 8],
      [16, 17],
    ])('rabat %i h sur %i h', (hour, expected) => {
      expect(clampOutOfDnd(hour, day)).toBe(expected);
    });
  });

  it('à égalité de distance, rabat vers l’arrière', () => {
    // Fenêtre [10, 15) : depuis 12 h, 9 h est à 3 h en arrière et 15 h à 3 h en avant.
    // On préfère l'arrière : rappeler un peu tôt le jour même plutôt que trop tard.
    const window: NotificationPrefs = { ...prefs, dndStartHour: 10, dndEndHour: 15 };
    expect(clampOutOfDnd(12, window)).toBe(9);
  });

  it('gère start = 0 (le bord arrière vaut 23 h)', () => {
    const fromMidnight: NotificationPrefs = { ...prefs, dndStartHour: 0, dndEndHour: 6 };
    expect(clampOutOfDnd(1, fromMidnight)).toBe(23);
    expect(clampOutOfDnd(5, fromMidnight)).toBe(6);
  });

  it('gère une fenêtre couvrant 23 h sur 24 — les deux bords convergent', () => {
    const almostAll: NotificationPrefs = { ...prefs, dndStartHour: 8, dndEndHour: 7 };
    expect(clampOutOfDnd(12, almostAll)).toBe(7);
  });

  // ── La vraie garantie : une propriété, pas un cas ──
  it('produit TOUJOURS une heure hors DND, pour toute fenêtre et toute heure', () => {
    const windows: Array<[number, number]> = [
      [22, 7],
      [9, 17],
      [0, 6],
      [8, 7],
      [23, 1],
      [12, 13],
    ];
    for (const [dndStartHour, dndEndHour] of windows) {
      const p: NotificationPrefs = { ...prefs, dndStartHour, dndEndHour };
      for (let hour = 0; hour < 24; hour += 1) {
        const clamped = clampOutOfDnd(hour, p);
        expect(clamped).toBeGreaterThanOrEqual(0);
        expect(clamped).toBeLessThanOrEqual(23);
        expect(isWithinDnd(clamped, p)).toBe(false);
      }
    }
  });
});

// ─── decideProgrammedReminder (NUTR-F1) ──────────────────────────────────────

describe('decideProgrammedReminder', () => {
  const prefs = defaultNotificationPrefs(); // DND [22, 7)
  /** 9 h pile, échéance à 13 h : 4 h de marge, tout est réuni. */
  const base = {
    enabled: true,
    doneToday: false,
    nowMinutes: 9 * 60,
    targetHour: 13,
    learned: true,
    prefs,
  };

  it('planifie à l’échéance quand tout est réuni', () => {
    expect(decideProgrammedReminder(base)).toEqual({ kind: 'schedule', atHour: 13 });
  });

  it('refuse si le rappel est désactivé', () => {
    expect(decideProgrammedReminder({ ...base, enabled: false })).toEqual({
      kind: 'skip',
      reason: 'disabled',
    });
  });

  it('refuse si le geste est déjà fait aujourd’hui', () => {
    expect(decideProgrammedReminder({ ...base, doneToday: true })).toEqual({
      kind: 'skip',
      reason: 'done',
    });
  });

  it('refuse une heure MANUELLE tombant en DND (D6 — on ne réécrit pas un choix)', () => {
    expect(decideProgrammedReminder({ ...base, learned: false, targetHour: 23 })).toEqual({
      kind: 'skip',
      reason: 'dnd',
    });
  });

  it('n’oppose PAS le DND à une heure apprise — elle a déjà été rabattue en amont (D5)', () => {
    // Si `clampOutOfDnd` a été appliqué, `targetHour` est hors DND ; ce test verrouille le fait
    // qu'on ne re-teste pas le DND sur ce chemin, sinon un rabattement raté deviendrait invisible.
    expect(decideProgrammedReminder({ ...base, learned: true, targetHour: 21 })).toEqual({
      kind: 'schedule',
      atHour: 21,
    });
  });

  it('refuse quand l’échéance est déjà passée — pas de rattrapage (D7)', () => {
    expect(decideProgrammedReminder({ ...base, nowMinutes: 14 * 60 })).toEqual({
      kind: 'skip',
      reason: 'passed',
    });
  });

  it('refuse à la minute pile de l’échéance (borne exacte)', () => {
    // `nowMinutes >= targetMinutes` : à 13 h 00 pour une échéance de 13 h, il est trop tard.
    // C'est la borne où vivent les bugs.
    expect(decideProgrammedReminder({ ...base, nowMinutes: 13 * 60 })).toEqual({
      kind: 'skip',
      reason: 'passed',
    });
  });

  // ── Marge d'imminence : le pendant de D7, avant l'échéance ──
  it('refuse une échéance imminente — on ne notifie pas quelqu’un qui est dans l’app', () => {
    // 12 h 59 pour une échéance à 13 h : sans cette règle, la notification « ton journal est encore
    // vide » arriverait 60 secondes plus tard, pendant que l'utilisateur le remplit.
    expect(decideProgrammedReminder({ ...base, nowMinutes: 12 * 60 + 59 })).toEqual({
      kind: 'skip',
      reason: 'imminent',
    });
  });

  it.each([
    [13 * 60 - 1, { kind: 'skip', reason: 'imminent' }],
    [13 * 60 - 14, { kind: 'skip', reason: 'imminent' }],
    [13 * 60 - 15, { kind: 'schedule', atHour: 13 }],
    [13 * 60 - 16, { kind: 'schedule', atHour: 13 }],
  ])('à %i minutes depuis minuit, décide %o (bornes de la marge)', (nowMinutes, expected) => {
    expect(decideProgrammedReminder({ ...base, nowMinutes })).toEqual(expected);
  });

  it('accepte une marge surchargée', () => {
    expect(
      decideProgrammedReminder({ ...base, nowMinutes: 12 * 60 + 50, minLeadMinutes: 5 }),
    ).toEqual({ kind: 'schedule', atHour: 13 });
  });

  it('distingue « trop tard » de « trop tôt » — ils ne se diagnostiquent pas pareil', () => {
    expect(decideProgrammedReminder({ ...base, nowMinutes: 13 * 60 + 1 })).toMatchObject({
      reason: 'passed',
    });
    expect(decideProgrammedReminder({ ...base, nowMinutes: 13 * 60 - 5 })).toMatchObject({
      reason: 'imminent',
    });
  });

  it('évalue « désactivé » avant tout le reste', () => {
    expect(
      decideProgrammedReminder({
        ...base,
        enabled: false,
        doneToday: true,
        nowMinutes: 20 * 60,
        learned: false,
        targetHour: 23,
      }),
    ).toEqual({ kind: 'skip', reason: 'disabled' });
  });

  it('expose une marge par défaut de 15 minutes', () => {
    expect(REMINDER_MIN_LEAD_MINUTES).toBe(15);
  });
});
