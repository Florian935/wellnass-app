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
import type { MealSlot } from './meal-slots';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const emptyTally: DayTally = {
  strengthSessions: 0,
  runs: 0,
  mealsLogged: 0,
  streak: 0,
};

function meal(over: Partial<MealSlot> = {}): MealSlot {
  return { key: 'lunch', label: null, hour: 12.5, learned: true, logged: false, ...over };
}

/** La journée type d'un habitué : petit-déj 8 h, déjeuner 12 h 30, dîner 19 h 30. */
function threeMeals(logged: readonly string[] = []): MealSlot[] {
  return [
    meal({ key: 'breakfast', hour: 8, logged: logged.includes('breakfast') }),
    meal({ key: 'lunch', hour: 12.5, logged: logged.includes('lunch') }),
    meal({ key: 'dinner', hour: 19.5, logged: logged.includes('dinner') }),
  ];
}

/** Journée vierge à 7 h : rien en cours, rien de planifié, rien de dû. */
function input(over: Partial<NowActionInput> = {}): NowActionInput {
  return {
    hour: 7,
    moment: 'morning',
    activeWorkoutId: null,
    hasActiveRun: false,
    todayTrainings: [],
    meals: [],
    nutritionActive: false,
    weighInDue: false,
    weighInHabit: true,
    wellbeingLogged: false,
    wellbeingEnabled: true,
    strengthActive: true,
    hasStrengthProgram: true,
    tally: emptyTally,
    ...over,
  };
}

function training(over: Partial<TodayTraining> = {}): TodayTraining {
  return {
    pillar: 'strength',
    name: 'Push — Pecs / Épaules',
    scheduledTime: '18:30',
    exerciseCount: 6,
    targetDistanceM: null,
    targetDurationSeconds: null,
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

  it('range le prochain repas et le rattrapage AVANT le compte rendu — sinon « faite » mentirait', () => {
    const done = NOW_ACTION_ORDER.indexOf('day-done');
    expect(NOW_ACTION_ORDER.indexOf('meal-next')).toBeLessThan(done);
    expect(NOW_ACTION_ORDER.indexOf('meal-missed')).toBeLessThan(done);
    // Le repas qui arrive passe avant le point du soir : la journée se lit dans l'ordre des heures.
    expect(NOW_ACTION_ORDER.indexOf('meal-next')).toBeLessThan(
      NOW_ACTION_ORDER.indexOf('wellbeing-due'),
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
        meals: threeMeals(),
        hour: 13,
        weighInDue: true,
        hasActiveRun: true,
      }),
    );
    expect(r.kind).toBe('workout-active');
    if (r.kind === 'workout-active') expect(r.workoutId).toBe('w-9');
  });

  it('puis à une course en cours', () => {
    const r = resolveNowAction(
      input({ hasActiveRun: true, todayTrainings: [training()], meals: threeMeals(), hour: 13 }),
    );
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
      input({ todayTrainings: [training({ pillar: 'running', name: 'Sortie longue', targetDistanceM: 12000 })] }),
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

  it('propose le repas dû : son heure apprise est passée et il n’est pas noté', () => {
    const r = resolveNowAction(input({ hour: 13, moment: 'afternoon', meals: threeMeals(['breakfast']) }));
    expect(r.kind).toBe('meal-due');
    if (r.kind === 'meal-due') {
      expect(r.meal.key).toBe('lunch');
      expect(r.meal.hour).toBe(12.5);
    }
  });

  it('🔴 un repas noté ne fait plus taire les suivants (constat 1 du 24/10/2026)', () => {
    // Avant : `mealDue = !mealLoggedToday` — un petit-déj à 8 h, et ni le déjeuner ni le dîner
    // n'étaient plus jamais réclamés.
    const soir = resolveNowAction(
      input({ hour: 20, moment: 'evening', meals: threeMeals(['breakfast', 'lunch']) }),
    );
    expect(soir.kind === 'meal-due' && soir.meal.key).toBe('dinner');
  });

  it('🔴 un seul repas noté ne déclare plus « Ta journée est faite » (constat 1)', () => {
    const r = resolveNowAction(
      input({
        hour: 8,
        moment: 'morning',
        meals: threeMeals(['breakfast']),
        tally: { ...emptyTally, mealsLogged: 1 },
      }),
    );
    expect(r.kind).not.toBe('day-done');
    // À la place : le prochain repas, à son heure.
    expect(r.kind === 'meal-next' && r.meal.key).toBe('lunch');
  });

  it('propose la pesée après le repas dû', () => {
    expect(resolveNowAction(input({ weighInDue: true })).kind).toBe('weigh-in-due');
    expect(resolveNowAction(input({ hour: 8, weighInDue: true, meals: threeMeals() })).kind).toBe(
      'meal-due',
    );
  });

  it('🔴 ne réclame la pesée qu’à qui se pèse (constat 3)', () => {
    // Avant : « Pas encore pesé aujourd'hui » dès 10 h, chaque jour, même à qui ne se pèse jamais.
    expect(resolveNowAction(input({ weighInDue: true, weighInHabit: false })).kind).not.toBe(
      'weigh-in-due',
    );
  });

  it('annonce le prochain repas quand rien n’est dû', () => {
    const r = resolveNowAction(input({ hour: 9, meals: threeMeals(['breakfast']) }));
    expect(r.kind).toBe('meal-next');
    if (r.kind === 'meal-next') expect(r.meal.key).toBe('lunch');
  });

  it('propose de rattraper un repas manqué avant de déclarer la journée faite', () => {
    const r = resolveNowAction(
      input({
        hour: 21,
        moment: 'evening',
        wellbeingLogged: true,
        meals: threeMeals(['lunch', 'dinner']),
        tally: { ...emptyTally, mealsLogged: 2 },
      }),
    );
    expect(r.kind).toBe('meal-missed');
    if (r.kind === 'meal-missed') expect(r.meal.key).toBe('breakfast');
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

  it('rend compte de la journée quand la séance est faite ET chaque repas noté', () => {
    const tally: DayTally = { strengthSessions: 1, runs: 0, mealsLogged: 3, streak: 13 };
    const r = resolveNowAction(
      input({
        hour: 22,
        moment: 'evening',
        wellbeingLogged: true,
        meals: threeMeals(['breakfast', 'lunch', 'dinner']),
        tally,
      }),
    );
    expect(r.kind).toBe('day-done');
    if (r.kind === 'day-done') expect(r.tally.streak).toBe(13);
  });

  it('la journée n’est pas faite tant qu’une séance prévue reste à faire', () => {
    const r = resolveNowAction(
      input({
        hour: 21,
        moment: 'evening',
        todayTrainings: [training()],
        meals: threeMeals(['breakfast', 'lunch', 'dinner']),
        tally: { ...emptyTally, mealsLogged: 3 },
      }),
    );
    expect(r.kind).toBe('session-today');
  });

  it('sans pilier nutrition, la séance faite suffit', () => {
    const r = resolveNowAction(
      input({ hour: 19, moment: 'evening', wellbeingLogged: true, tally: { ...emptyTally, runs: 1 } }),
    );
    expect(r.kind).toBe('day-done');
  });

  it('ne prétend jamais que la journée est faite si elle ne porte aucune trace', () => {
    // « Ta journée est faite » sur une journée vide serait un mensonge, et le pire message
    // possible à 22 h pour quelqu'un qui n'a rien pu faire.
    const r = resolveNowAction(input({ hour: 22, moment: 'evening', wellbeingLogged: true }));
    expect(r.kind).toBe('idle');
    if (r.kind === 'idle') expect(r.moment).toBe('evening');
  });

  describe('rien de prévu — un geste qui a du sens (constat 2)', () => {
    const idle = (over: Partial<NowActionInput>) => {
      const r = resolveNowAction(input({ hour: 10, ...over }));
      return r.kind === 'idle' ? r.suggestion : `pas idle : ${r.kind}`;
    };

    it('🔴 jour de repos avec un programme : une activité, jamais « Créer un programme »', () => {
      expect(idle({ strengthActive: true, hasStrengthProgram: true })).toBe('activity');
    });

    it('🔴 compte nutrition seule : jamais de programme de musculation (décision H)', () => {
      expect(idle({ strengthActive: false, hasStrengthProgram: false, nutritionActive: true })).toBe(
        'meal',
      );
    });

    it('musculation active SANS programme : là, et là seulement, on propose d’en trouver un', () => {
      expect(idle({ strengthActive: true, hasStrengthProgram: false })).toBe('program');
    });

    it('coureur sans muscu, rien à noter : une activité', () => {
      expect(idle({ strengthActive: false, hasStrengthProgram: false })).toBe('activity');
    });
  });

  it('rend toujours une décision — jamais null, quelle que soit l’entrée', () => {
    // La carte est ÉPINGLÉE : si le résolveur pouvait ne rien rendre, on réintroduirait le trou de
    // mise en page que la grille a mis quatre tentatives à corriger.
    for (let h = 0; h <= 23; h += 1) {
      for (const moment of ['morning', 'afternoon', 'evening'] as const) {
        for (const meals of [[], threeMeals(), threeMeals(['breakfast'])]) {
          const r = resolveNowAction(input({ hour: h, moment, meals, nutritionActive: true }));
          expect(NOW_ACTION_ORDER as readonly string[]).toContain(r.kind);
        }
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
    expect(hasDoneSomething({ ...emptyTally, mealsLogged: 1 })).toBe(true);
  });

  it('ne compte pas la série comme une trace du JOUR', () => {
    // Une série de 12 jours dit ce qui s'est passé avant, pas ce qui s'est passé aujourd'hui.
    expect(hasDoneSomething({ ...emptyTally, streak: 12 })).toBe(false);
  });
});
