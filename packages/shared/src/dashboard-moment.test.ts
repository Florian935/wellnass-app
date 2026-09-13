import { describe, expect, it } from 'vitest';
import {
  COMEBACK_AFTER_DAYS,
  countdownToSession,
  resolveHomeMoment,
  timeLeftToday,
  type HomeMomentInput,
} from './dashboard-moment';

/** Une date locale à l'heure voulue — les règles portent sur l'heure affichée à l'utilisateur. */
const at = (hour: number, minute = 0) => new Date(2026, 8, 14, hour, minute, 0);

const base: HomeMomentInput = {
  now: at(14),
  activeToday: false,
  streak: 5,
  daysSinceLastActivity: 1,
  checkinDoneToday: true,
  reminderHour: null,
};

describe('resolveHomeMoment (US DASH-01, §4.1)', () => {
  it('journée ordinaire → day', () => {
    expect(resolveHomeMoment(base)).toBe('day');
  });

  it('avant 11 h sans check-in → morning', () => {
    expect(resolveHomeMoment({ ...base, now: at(7, 42), checkinDoneToday: false })).toBe('morning');
  });

  it('avant 11 h avec check-in déjà fait → day (on ne redemande pas)', () => {
    expect(resolveHomeMoment({ ...base, now: at(7, 42), checkinDoneToday: true })).toBe('day');
  });

  it('11 h pile → plus le matin', () => {
    expect(resolveHomeMoment({ ...base, now: at(11), checkinDoneToday: false })).toBe('day');
  });

  it('à partir de 18 h, rien fait aujourd’hui, série en cours → evening-at-risk', () => {
    expect(resolveHomeMoment({ ...base, now: at(18) })).toBe('evening-at-risk');
  });

  it('le soir mais déjà actif aujourd’hui → day (la série est sauve)', () => {
    expect(resolveHomeMoment({ ...base, now: at(20, 15), activeToday: true })).toBe('day');
  });

  it('le soir sans série en cours → day (rien à perdre, rien à rappeler)', () => {
    expect(resolveHomeMoment({ ...base, now: at(20), streak: 0 })).toBe('day');
  });

  it('une heure de rappel plus tardive que 18 h repousse le moment du soir', () => {
    expect(resolveHomeMoment({ ...base, now: at(19), reminderHour: 21 })).toBe('day');
    expect(resolveHomeMoment({ ...base, now: at(21), reminderHour: 21 })).toBe('evening-at-risk');
  });

  it('une heure de rappel plus précoce ne l’avance pas avant 18 h', () => {
    expect(resolveHomeMoment({ ...base, now: at(16), reminderHour: 9 })).toBe('day');
  });

  it(`${COMEBACK_AFTER_DAYS} jours sans activité → comeback, prioritaire sur le matin et le soir`, () => {
    const comeback = { ...base, daysSinceLastActivity: COMEBACK_AFTER_DAYS, streak: 0 };
    expect(resolveHomeMoment(comeback)).toBe('comeback');
    expect(resolveHomeMoment({ ...comeback, now: at(8), checkinDoneToday: false })).toBe('comeback');
    expect(resolveHomeMoment({ ...comeback, now: at(21) })).toBe('comeback');
  });

  it('6 jours sans activité → pas encore un retour', () => {
    expect(resolveHomeMoment({ ...base, daysSinceLastActivity: 6, streak: 0 })).toBe('day');
  });

  it('aucun historique du tout → jamais comeback (un compte neuf ne « revient » pas)', () => {
    expect(resolveHomeMoment({ ...base, daysSinceLastActivity: null, streak: 0 })).toBe('day');
  });

  it('actif aujourd’hui après une longue absence → plus un retour', () => {
    expect(
      resolveHomeMoment({ ...base, daysSinceLastActivity: 12, activeToday: true, streak: 1 }),
    ).toBe('day');
  });
});

describe('timeLeftToday', () => {
  it('20 h 15 → 3 h 45 avant minuit', () => {
    expect(timeLeftToday(at(20, 15))).toEqual({ hours: 3, minutes: 45 });
  });

  it('23 h 59 → 0 h 1', () => {
    expect(timeLeftToday(at(23, 59))).toEqual({ hours: 0, minutes: 1 });
  });

  it('minuit pile → 24 h', () => {
    expect(timeLeftToday(at(0))).toEqual({ hours: 24, minutes: 0 });
  });
});

// ---------------------------------------------------------------------------
// Compte à rebours de la séance du jour (US DASH-01, §4.3 — l'heure de HORAIRE-01)
// ---------------------------------------------------------------------------

describe('countdownToSession', () => {
  it('annonce les heures qui restent avant l’heure prévue', () => {
    expect(countdownToSession(15, '18:30:00')).toEqual({ kind: 'in', hours: 3 });
  });

  it('accepte une heure sans secondes', () => {
    expect(countdownToSession(7, '09:00')).toEqual({ kind: 'in', hours: 2 });
  });

  it('« c’est maintenant » pendant l’heure de la séance', () => {
    // 18 h 05 comme 18 h 55 : on ne dit pas « dans 0 h », on dit que c'est l'heure.
    expect(countdownToSession(18, '18:30')).toEqual({ kind: 'now' });
  });

  it('🔴 une heure passée n’invente pas un compte à rebours négatif', () => {
    expect(countdownToSession(21, '18:30')).toEqual({ kind: 'past', hours: 3 });
  });

  it('sans heure prévue, rien à dire', () => {
    expect(countdownToSession(10, null)).toBeNull();
    expect(countdownToSession(10, '')).toBeNull();
  });

  it('🔴 une heure illisible ne fait pas planter la scène', () => {
    expect(countdownToSession(10, 'bientôt')).toBeNull();
    expect(countdownToSession(10, '99:00')).toBeNull();
  });
});
