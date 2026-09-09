import { describe, expect, it } from 'vitest';
import {
  NOW_ACTION_ORDER,
  hasDoneSomething,
  resolveNowAction,
  sortTrainingsByTime,
  type DayTally,
  type NowActionInput,
  type TodayTraining,
} from './now-action';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const emptyTally: DayTally = {
  strengthSessions: 0,
  runs: 0,
  mealLogged: false,
  streak: 0,
};

/** Journée vierge à 7 h : rien en cours, rien de planifié, rien de dû. */
function input(over: Partial<NowActionInput> = {}): NowActionInput {
  return {
    hour: 7,
    moment: 'morning',
    activeWorkoutId: null,
    hasActiveRun: false,
    todayTrainings: [],
    mealDue: false,
    mealDeadlineHour: null,
    weighInDue: false,
    wellbeingLogged: false,
    wellbeingEnabled: true,
    tally: emptyTally,
    ...over,
  };
}

function training(over: Partial<TodayTraining> = {}): TodayTraining {
  return {
    pillar: 'strength',
    name: 'Push — Pecs / Épaules',
    scheduledTime: '18:30',
    detail: '6 exercices',
    programName: 'PPL',
    plannedSessionId: 'ps-1',
    sessionId: 's-1',
    ...over,
  };
}

// ---------------------------------------------------------------------------
// La table de priorité
// ---------------------------------------------------------------------------
describe('NOW_ACTION_ORDER', () => {
  it('est une table ordonnée sans doublon', () => {
    expect(new Set(NOW_ACTION_ORDER).size).toBe(NOW_ACTION_ORDER.length);
  });

  it('place ce qui tourne déjà en tête, et le repli en queue', () => {
    // L'ordre EST la priorité : ce test est le seul endroit où elle est vérifiée.
    expect(NOW_ACTION_ORDER[0]).toBe('workout-active');
    expect(NOW_ACTION_ORDER[1]).toBe('run-active');
    expect(NOW_ACTION_ORDER[NOW_ACTION_ORDER.length - 1]).toBe('idle');
  });

  it('fait passer la séance planifiée avant les saisies dues', () => {
    // Une séance est un engagement pris ; une saisie oubliée se rattrape.
    expect(NOW_ACTION_ORDER.indexOf('session-today')).toBeLessThan(
      NOW_ACTION_ORDER.indexOf('meal-due'),
    );
    expect(NOW_ACTION_ORDER.indexOf('meal-due')).toBeLessThan(
      NOW_ACTION_ORDER.indexOf('weigh-in-due'),
    );
  });
});

// ---------------------------------------------------------------------------
// Le choix
// ---------------------------------------------------------------------------
describe('resolveNowAction', () => {
  it('donne la priorité absolue à une séance en cours', () => {
    const r = resolveNowAction(
      input({
        activeWorkoutId: 'w-9',
        // Tout le reste réclame en même temps : rien ne doit passer devant.
        todayTrainings: [training()],
        mealDue: true,
        weighInDue: true,
        hasActiveRun: true,
      }),
    );
    expect(r.kind).toBe('workout-active');
    if (r.kind === 'workout-active') expect(r.workoutId).toBe('w-9');
  });

  it('puis à une course en cours', () => {
    const r = resolveNowAction(input({ hasActiveRun: true, todayTrainings: [training()], mealDue: true }));
    expect(r.kind).toBe('run-active');
  });

  it('affiche la séance de MUSCULATION planifiée du jour', () => {
    const r = resolveNowAction(input({ todayTrainings: [training()] }));
    expect(r.kind).toBe('session-today');
    if (r.kind === 'session-today') {
      expect(r.training.pillar).toBe('strength');
      expect(r.training.scheduledTime).toBe('18:30');
    }
  });

  it('affiche aussi la séance de COURSE — le défaut que cette US corrige', () => {
    // L'accueil livré appelait `useTodaySession('strength')` avec le pilier EN DUR : un coureur
    // lisait « Rien de prévu aujourd'hui » le jour de sa sortie longue.
    const r = resolveNowAction(
      input({ todayTrainings: [training({ pillar: 'running', name: 'Sortie longue', detail: '12 km' })] }),
    );
    expect(r.kind).toBe('session-today');
    if (r.kind === 'session-today') expect(r.training.pillar).toBe('running');
  });

  it('retient la séance la PLUS PROCHE quand les deux piliers sont programmés le même jour', () => {
    // Cas normal chez quelqu'un qui suit deux piliers — et c'est même le cœur du produit.
    const r = resolveNowAction(
      input({
        todayTrainings: [
          training({ pillar: 'strength', scheduledTime: '19:00' }),
          training({ pillar: 'running', scheduledTime: '07:30', name: 'Fractionné' }),
        ],
      }),
    );
    expect(r.kind).toBe('session-today');
    if (r.kind === 'session-today') expect(r.training.name).toBe('Fractionné');
  });

  it('propose la saisie du repas quand l’échéance apprise est passée', () => {
    const r = resolveNowAction(input({ hour: 22, moment: 'evening', mealDue: true, mealDeadlineHour: 20 }));
    expect(r.kind).toBe('meal-due');
    if (r.kind === 'meal-due') {
      expect(r.deadlineHour).toBe(20);
      // 22 h → dîner, et non la collation qui correspondrait à l'heure d'échéance.
      expect(r.meal).toBe('dinner');
    }
  });

  it('dérive le repas de l’heure COURANTE, pas de l’heure d’échéance', () => {
    const midi = resolveNowAction(input({ hour: 13, moment: 'afternoon', mealDue: true, mealDeadlineHour: 20 }));
    expect(midi.kind === 'meal-due' && midi.meal).toBe('lunch');
  });

  it('propose la pesée après le repas', () => {
    const r = resolveNowAction(input({ weighInDue: true }));
    expect(r.kind).toBe('weigh-in-due');
    // Et le repas passe devant quand les deux sont dus.
    expect(resolveNowAction(input({ weighInDue: true, mealDue: true })).kind).toBe('meal-due');
  });

  it('ne propose le check-in de bien-être QUE le soir', () => {
    expect(resolveNowAction(input({ moment: 'morning' })).kind).not.toBe('wellbeing-due');
    expect(resolveNowAction(input({ hour: 21, moment: 'evening' })).kind).toBe('wellbeing-due');
  });

  it('ne propose pas le check-in s’il est déjà fait, ou si l’utilisateur ne le suit pas', () => {
    expect(
      resolveNowAction(input({ hour: 21, moment: 'evening', wellbeingLogged: true })).kind,
    ).not.toBe('wellbeing-due');
    expect(
      resolveNowAction(input({ hour: 21, moment: 'evening', wellbeingEnabled: false })).kind,
    ).not.toBe('wellbeing-due');
  });

  it('rend compte de la journée plutôt que de réclamer, quand tout est fait', () => {
    const tally: DayTally = { strengthSessions: 1, runs: 0, mealLogged: true, streak: 13 };
    const r = resolveNowAction(input({ hour: 22, moment: 'evening', wellbeingLogged: true, tally }));
    expect(r.kind).toBe('day-done');
    if (r.kind === 'day-done') expect(r.tally.streak).toBe(13);
  });

  it('ne prétend jamais que la journée est faite si elle ne porte aucune trace', () => {
    // « Ta journée est faite » sur une journée vide serait un mensonge, et le pire message
    // possible à 22 h pour quelqu'un qui n'a rien pu faire.
    const r = resolveNowAction(input({ hour: 22, moment: 'evening', wellbeingLogged: true }));
    expect(r.kind).toBe('idle');
    if (r.kind === 'idle') expect(r.moment).toBe('evening');
  });

  it('rend toujours une décision — jamais null, quelle que soit l’entrée', () => {
    // La carte est ÉPINGLÉE : si le résolveur pouvait ne rien rendre, on réintroduirait le trou de
    // mise en page que la grille a mis quatre tentatives à corriger.
    for (let h = 0; h <= 23; h += 1) {
      for (const moment of ['morning', 'afternoon', 'evening'] as const) {
        const r = resolveNowAction(input({ hour: h, moment }));
        expect(NOW_ACTION_ORDER as readonly string[]).toContain(r.kind);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Tri des séances
// ---------------------------------------------------------------------------
describe('sortTrainingsByTime', () => {
  it('trie par heure croissante', () => {
    const out = sortTrainingsByTime([
      training({ name: 'C', scheduledTime: '19:00' }),
      training({ name: 'A', scheduledTime: '07:00' }),
      training({ name: 'B', scheduledTime: '12:30' }),
    ]);
    expect(out.map((t) => t.name)).toEqual(['A', 'B', 'C']);
  });

  it('range les séances SANS heure en dernier', () => {
    // Une séance sans heure n'est pas « à minuit » : elle n'a pas d'engagement horaire, elle passe
    // donc derrière celles qui en ont un.
    const out = sortTrainingsByTime([
      training({ name: 'sans', scheduledTime: null }),
      training({ name: 'avec', scheduledTime: '20:00' }),
    ]);
    expect(out.map((t) => t.name)).toEqual(['avec', 'sans']);
  });

  it('traite une heure malformée comme absente plutôt que de désordonner la liste', () => {
    const out = sortTrainingsByTime([
      training({ name: 'cassée', scheduledTime: 'bientôt' }),
      training({ name: 'valide', scheduledTime: '06:15' }),
    ]);
    expect(out.map((t) => t.name)).toEqual(['valide', 'cassée']);
  });

  it('à heure égale, ordonne de façon STABLE (musculation d’abord)', () => {
    const out = sortTrainingsByTime([
      training({ pillar: 'running', name: 'course', scheduledTime: '18:00' }),
      training({ pillar: 'strength', name: 'muscu', scheduledTime: '18:00' }),
    ]);
    expect(out.map((t) => t.name)).toEqual(['muscu', 'course']);
  });

  it('ne modifie pas le tableau reçu', () => {
    const src = [training({ name: 'B', scheduledTime: '19:00' }), training({ name: 'A', scheduledTime: '07:00' })];
    sortTrainingsByTime(src);
    expect(src.map((t) => t.name)).toEqual(['B', 'A']);
  });
});

describe('hasDoneSomething', () => {
  it('reconnaît une trace, quelle qu’elle soit', () => {
    expect(hasDoneSomething(emptyTally)).toBe(false);
    expect(hasDoneSomething({ ...emptyTally, strengthSessions: 1 })).toBe(true);
    expect(hasDoneSomething({ ...emptyTally, runs: 1 })).toBe(true);
    expect(hasDoneSomething({ ...emptyTally, mealLogged: true })).toBe(true);
  });

  it('ne compte pas la série comme une trace du JOUR', () => {
    // Une série de 12 jours dit ce qui s'est passé avant, pas ce qui s'est passé aujourd'hui.
    expect(hasDoneSomething({ ...emptyTally, streak: 12 })).toBe(false);
  });
});
