import { describe, expect, it } from 'vitest';
import { clockLabel, daySentence, greetingKind } from './home-greeting';
import type { NowAction } from './now-action';
import type { MealSlot } from './meal-slots';

const lunch: MealSlot = { key: 'lunch', label: null, hour: 12.5, learned: true, logged: false };
const tally = { strengthSessions: 0, runs: 0, mealsLogged: 3, streak: 4 };

describe('greetingKind — la salutation suit l’heure et la personne', () => {
  it('Bonjour le matin, Bon après-midi, Bonsoir', () => {
    expect(greetingKind({ hour: 7, comeback: false, firstDay: false })).toBe('morning');
    expect(greetingKind({ hour: 12, comeback: false, firstDay: false })).toBe('afternoon');
    expect(greetingKind({ hour: 18, comeback: false, firstDay: false })).toBe('evening');
  });

  it('« Content de te revoir » au retour, « Bienvenue » le premier jour — quelle que soit l’heure', () => {
    expect(greetingKind({ hour: 20, comeback: true, firstDay: false })).toBe('comeback');
    expect(greetingKind({ hour: 9, comeback: false, firstDay: true })).toBe('welcome');
  });
});

describe('daySentence — la phrase du jour', () => {
  const sentence = (action: NowAction, over: Partial<{ hour: number; kcalRemaining: number | null }> = {}) =>
    daySentence(action, { hour: 10, kcalRemaining: null, ...over });

  it('🔴 une clé par décision, jamais celle de la carte — le titre ne répète plus la carte (constat 6)', () => {
    const actions: NowAction[] = [
      { kind: 'workout-active', workoutId: 'w' },
      { kind: 'run-active' },
      { kind: 'meal-due', meal: lunch },
      { kind: 'weigh-in-due' },
      { kind: 'meal-next', meal: lunch },
      { kind: 'wellbeing-due' },
      { kind: 'meal-missed', meal: lunch },
      { kind: 'day-done', tally },
      { kind: 'idle', moment: 'morning', suggestion: 'activity' },
    ];
    for (const action of actions) {
      const { key } = sentence(action);
      expect(key.startsWith('home.sentence.')).toBe(true);
      expect(key).not.toContain('home.now.');
    }
  });

  it('séance : un compte à rebours, pas le nom déjà en titre de carte', () => {
    const training = {
      pillar: 'strength' as const,
      name: 'Jambes',
      scheduledTime: '18:00:00',
      exerciseCount: 6,
      targetDistanceM: null,
      targetDurationSeconds: null,
      programName: null,
      plannedSessionId: 'p',
      sessionId: 's',
    };
    expect(sentence({ kind: 'session-today', training }, { hour: 13 })).toEqual({
      key: 'home.sentence.sessionIn',
      params: { count: 5 },
    });
    expect(sentence({ kind: 'session-today', training }, { hour: 18 }).key).toBe(
      'home.sentence.sessionNow',
    );
    expect(sentence({ kind: 'session-today', training }, { hour: 20 }).key).toBe(
      'home.sentence.sessionLate',
    );
    expect(
      sentence({ kind: 'session-today', training: { ...training, scheduledTime: null } }).key,
    ).toBe('home.sentence.session');
  });

  it('repas : les kcal restantes quand la cible est connue', () => {
    expect(sentence({ kind: 'meal-due', meal: lunch }, { kcalRemaining: 1450 })).toEqual({
      key: 'home.sentence.mealDueKcal',
      params: { kcal: 1450 },
    });
    expect(sentence({ kind: 'meal-due', meal: lunch }, { kcalRemaining: -120 }).key).toBe(
      'home.sentence.mealDueReached',
    );
    expect(sentence({ kind: 'meal-due', meal: lunch }).key).toBe('home.sentence.mealDue');
    expect(sentence({ kind: 'meal-next', meal: lunch }, { kcalRemaining: 900 })).toEqual({
      key: 'home.sentence.mealNextKcal',
      params: { kcal: 900 },
    });
  });

  it('journée faite : on salue l’entraînement s’il y en a eu un', () => {
    expect(sentence({ kind: 'day-done', tally }).key).toBe('home.sentence.dayDone');
    expect(sentence({ kind: 'day-done', tally: { ...tally, runs: 1 } }).key).toBe(
      'home.sentence.dayDoneTrained',
    );
  });

  it('rien de prévu : la phrase suit le geste proposé', () => {
    const idle = (suggestion: 'program' | 'meal' | 'activity') =>
      sentence({ kind: 'idle', moment: 'morning', suggestion }).key;
    expect(idle('program')).toBe('home.sentence.idleProgram');
    expect(idle('meal')).toBe('home.sentence.idleMeal');
    expect(idle('activity')).toBe('home.sentence.idleRest');
  });
});

describe('clockLabel', () => {
  it('écrit l’heure d’un geste en HH:MM', () => {
    expect(clockLabel(12.75)).toBe('12:45');
    expect(clockLabel(8)).toBe('08:00');
    expect(clockLabel(19.5)).toBe('19:30');
  });

  it('reste dans la journée, même sur une entrée aberrante', () => {
    expect(clockLabel(Number.NaN)).toBe('00:00');
    expect(clockLabel(-3)).toBe('00:00');
    expect(clockLabel(30)).toBe('23:59');
  });
});

describe('daySentence — ACCUEIL-08', () => {
  it('le check-in du matin et la marche suggérée ont leur phrase', () => {
    expect(daySentence({ kind: 'checkin-due' }, { hour: 7, kcalRemaining: null }).key).toBe(
      'home.sentence.checkin',
    );
    expect(daySentence({ kind: 'walk-idea', stepsLeft: 3800 }, { hour: 17, kcalRemaining: null })).toEqual({
      key: 'home.sentence.walk',
      params: { steps: 3800 },
    });
  });

  it('🔴 la série en jeu prime sur tout le reste, le soir', () => {
    expect(
      daySentence({ kind: 'wellbeing-due' }, { hour: 21, kcalRemaining: 300, streakHoursLeft: 3 }),
    ).toEqual({ key: 'home.sentence.rescue', params: { count: 3 } });
  });
});
