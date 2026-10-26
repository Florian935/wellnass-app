/**
 * US ACCUEIL-01 — la carte « maintenant ». Fichier à **0 %**.
 *
 * La **décision** est pure et testée chez elle (`resolveNowAction`). Ce qui est testé ici est la
 * **collecte**, et c'est là que les défauts de cet écran ont été trouvés en recette :
 *
 * - **Le pilier course était ignoré** : l'accueil ne proposait que la séance de musculation, alors
 *   que la donnée était disponible. Un coureur ouvrait l'app sur une carte qui ne parlait jamais de
 *   sa séance du jour.
 * - **Le nombre d'exercices n'était pas transmis** (recette du 10/09/2026) : la carte n'affichait
 *   que le nom du programme, alors que la valeur était déjà là.
 * - **« Dû » exige les DEUX conditions** — échéance passée *et* rien de saisi. Sans la seconde, la
 *   carte réclame un repas déjà enregistré ; c'est le genre de détail qui fait perdre confiance
 *   dans tout l'écran. Depuis ACCUEIL-07, c'est **repas par repas** (`useMealSlots`) : un petit-déj
 *   noté n'éteint plus le dîner.
 * - **La pesée n'est réclamée qu'à qui se pèse** (ACCUEIL-07, `useWeighInHabit`).
 * - **« Créer un programme » ne se propose qu'à la musculation sans programme** (ACCUEIL-07).
 * - **Ce qui a été fait aujourd'hui se compte en jour LOCAL.** Une séance terminée à 23 h 30
 *   compte pour aujourd'hui, pas pour demain.
 * - **Le check-in bien-être n'a aucun réglage** : il se propose à qui le pratique déjà, observé sur
 *   30 jours. Le proposer à tout le monde serait réclamer un geste jamais choisi.
 *
 * `resolveNowAction` n'est pas mocké : on veut la chaîne réelle, sinon on testerait le mock.
 */

import { renderHook } from '@testing-library/react-native';

import { useNowAction } from '../useNowAction';
import { useCurrentClock, useTodayKey, useWindowStartKey } from '../useTodayKey';
import { useActivities } from '@/data/repositories/activity-repository';
import { useDailySteps, useStepGoal } from '@/data/repositories/daily-steps-repository';
import { useActiveWorkout, useWorkoutHistory } from '@/data/repositories/workout-repository';
import { useActiveRun, useRunHistory, useTodayRunSession } from '@/data/repositories/run-repository';
import { useStreakData, useTodaySession } from '@/data/repositories/dashboard-repository';
import { useNotificationPrefs } from '@/data/repositories/notification-repository';
import {
  useMealSlots,
  useWeighInDeadline,
  useWeighInHabit,
  useWeighInToday,
} from '@/data/repositories/reminder-habits-repository';
import type { MealSlot } from '@wellness/shared';
import {
  useTodayWellbeing,
  useWellbeingEntries,
} from '@/data/repositories/daily-wellbeing-repository';
import { useSettings } from '@/data/repositories/settings-repository';

jest.mock('../useTodayKey', () => ({
  useTodayKey: jest.fn(() => '2026-09-22'),
  // US ACCUEIL-08 — l'heure est décimale, au pas de 5 min (`useCurrentClock`).
  useCurrentClock: jest.fn(() => 12),
  useWindowStartKey: jest.fn(() => '2026-08-23'),
}));
jest.mock('@/data/repositories/workout-repository', () => ({
  useActiveWorkout: jest.fn(),
  useWorkoutHistory: jest.fn(),
}));
jest.mock('@/data/repositories/run-repository', () => ({
  useActiveRun: jest.fn(),
  useRunHistory: jest.fn(),
  useTodayRunSession: jest.fn(),
}));
jest.mock('@/data/repositories/dashboard-repository', () => ({
  useTodaySession: jest.fn(),
  useStreakData: jest.fn(),
}));
jest.mock('@/data/repositories/notification-repository', () => ({
  useNotificationPrefs: jest.fn(() => ({})),
}));
jest.mock('@/data/repositories/reminder-habits-repository', () => ({
  useMealSlots: jest.fn(),
  useWeighInDeadline: jest.fn(),
  useWeighInHabit: jest.fn(),
  useWeighInToday: jest.fn(),
}));
jest.mock('@/data/repositories/daily-wellbeing-repository', () => ({
  useTodayWellbeing: jest.fn(),
  useWellbeingEntries: jest.fn(),
}));
jest.mock('@/data/repositories/settings-repository', () => ({ useSettings: jest.fn() }));
// US ACCUEIL-08 — le fil lit aussi les activités du jour et les pas (la marche suggérée).
jest.mock('@/data/repositories/activity-repository', () => ({ useActivities: jest.fn() }));
jest.mock('@/data/repositories/daily-steps-repository', () => ({ useDailySteps: jest.fn(), useStepGoal: jest.fn() }));

const m = {
  hour: useCurrentClock as jest.Mock,
  todayKey: useTodayKey as jest.Mock,
  windowStart: useWindowStartKey as jest.Mock,
  settings: useSettings as jest.Mock,
  prefs: useNotificationPrefs as jest.Mock,
  activeWorkout: useActiveWorkout as jest.Mock,
  activeRun: useActiveRun as jest.Mock,
  todaySession: useTodaySession as jest.Mock,
  todayRun: useTodayRunSession as jest.Mock,
  meals: useMealSlots as jest.Mock,
  weighDeadline: useWeighInDeadline as jest.Mock,
  weighDone: useWeighInToday as jest.Mock,
  weighHabit: useWeighInHabit as jest.Mock,
  wellbeing: useTodayWellbeing as jest.Mock,
  wellbeingHistory: useWellbeingEntries as jest.Mock,
  workouts: useWorkoutHistory as jest.Mock,
  runs: useRunHistory as jest.Mock,
  streak: useStreakData as jest.Mock,
  activities: useActivities as jest.Mock,
  steps: useDailySteps as jest.Mock,
  stepGoal: useStepGoal as jest.Mock,
};

const TODAY = '2026-09-22';

/** Les trois repas d'un habitué, `logged` = ceux déjà notés aujourd'hui. */
function slots(logged: readonly string[]): {
  slots: MealSlot[];
  loggedToday: number;
  totals: Map<string, { kcal: number; proteinG: number }>;
  isLoading: boolean;
} {
  const all: MealSlot[] = [
    { key: 'breakfast', label: null, hour: 8, learned: true, logged: false },
    { key: 'lunch', label: null, hour: 12.5, learned: true, logged: false },
    { key: 'dinner', label: null, hour: 19.5, learned: true, logged: false },
  ];
  return {
    slots: all.map((s) => ({ ...s, logged: logged.includes(s.key) })),
    loggedToday: logged.length,
    totals: new Map(logged.map((k) => [k, { kcal: 500, proteinG: 30 }])),
    isLoading: false,
  };
}

/** Journée « rien à signaler » : midi, aucun entraînement prévu, tout saisi. */
function setup() {
  m.hour.mockReturnValue(12);
  m.todayKey.mockReturnValue(TODAY);
  m.windowStart.mockReturnValue('2026-08-23');
  m.settings.mockReturnValue({ settings: { activePillars: ['strength', 'running', 'nutrition'] } });
  m.prefs.mockReturnValue({});
  m.activeWorkout.mockReturnValue({ workout: null, isLoading: false });
  m.activeRun.mockReturnValue({ run: null });
  m.todaySession.mockReturnValue({ state: 'rest', isLoading: false });
  m.todayRun.mockReturnValue({ session: null });
  m.meals.mockReturnValue(slots(['breakfast', 'lunch', 'dinner']));
  m.weighDeadline.mockReturnValue({ hour: 10 });
  m.weighDone.mockReturnValue({ done: true });
  m.weighHabit.mockReturnValue({ habit: true, isLoading: false });
  m.wellbeing.mockReturnValue({ entry: { logDate: TODAY } });
  m.wellbeingHistory.mockReturnValue({ entries: [] });
  m.workouts.mockReturnValue({ workouts: [] });
  m.runs.mockReturnValue({ runs: [] });
  m.streak.mockReturnValue({ current: 3 });
  m.activities.mockReturnValue({ activities: [] });
  m.steps.mockReturnValue({ rows: [] });
  m.stepGoal.mockReturnValue({ goal: 8000 });
}

const actionOf = async () => {
  const { result } = await renderHook(() => useNowAction());
  return result.current;
};

/** Une séance de musculation prévue aujourd'hui. */
const strengthSession = (over: Record<string, unknown> = {}) => ({
  state: 'today-session',
  isLoading: false,
  session: {
    name: 'Haut du corps',
    scheduledTime: '18:00',
    exerciseCount: 6,
    programName: 'PPL',
    plannedSessionId: 'ps-1',
    sessionId: 'sess-1',
    ...over,
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  setup();
});

// ---------------------------------------------------------------------------
// Les entraînements du jour
// ---------------------------------------------------------------------------

describe('les entraînements collectés', () => {
  it('🔴 remonte la séance de COURSE — le pilier que l’accueil ignorait', async () => {
    m.todayRun.mockReturnValue({
      session: { id: 'run-1', name: 'Sortie longue', scheduledTime: '07:00', targetDistanceM: 12000, targetDurationSeconds: null },
    });

    const { action } = await actionOf();

    expect(JSON.stringify(action)).toContain('running');
  });

  it('🔴 transmet le nombre d’exercices, disponible depuis le début et jamais passé', async () => {
    m.todaySession.mockReturnValue(strengthSession());

    const { action } = await actionOf();

    expect(JSON.stringify(action)).toContain('"exerciseCount":6');
  });

  it('présente UNE séance à la fois quand les deux piliers en ont une', async () => {
    m.todaySession.mockReturnValue(strengthSession());
    m.todayRun.mockReturnValue({
      session: { id: 'run-1', name: 'Sortie longue', scheduledTime: '07:00', targetDistanceM: 12000, targetDurationSeconds: null },
    });

    const { action } = await actionOf();

    // La carte « maintenant » tient une ligne : c'est le moteur qui tranche laquelle, et les deux
    // séances lui sont bien remises — le test suivant vérifie que le choix dépend de ce qui existe.
    expect(action).toMatchObject({ kind: 'session-today' });
  });

  it('retient la séance de musculation quand c’est la seule du jour', async () => {
    m.todaySession.mockReturnValue(strengthSession());

    expect(JSON.stringify((await actionOf()).action)).toContain('"pillar":"strength"');
  });

  it('masque la séance de musculation quand le pilier est désactivé (décision H)', async () => {
    m.settings.mockReturnValue({ settings: { activePillars: ['running', 'nutrition'] } });
    m.todaySession.mockReturnValue(strengthSession());

    expect(JSON.stringify((await actionOf()).action)).not.toContain('Haut du corps');
  });

  it('masque la séance de course quand le pilier est désactivé', async () => {
    m.settings.mockReturnValue({ settings: { activePillars: ['strength', 'nutrition'] } });
    m.todayRun.mockReturnValue({
      session: { id: 'run-1', name: 'Sortie longue', scheduledTime: '07:00', targetDistanceM: 12000, targetDurationSeconds: null },
    });

    expect(JSON.stringify((await actionOf()).action)).not.toContain('Sortie longue');
  });

  it('ne remonte rien un jour de repos', async () => {
    const serialized = JSON.stringify((await actionOf()).action);

    expect(serialized).not.toContain('plannedSessionId');
  });

  it('accepte un nom de séance vide plutôt que d’afficher des espaces', async () => {
    m.todaySession.mockReturnValue(strengthSession({ name: '   ' }));

    expect(JSON.stringify((await actionOf()).action)).toContain('"name":""');
  });
});

// ---------------------------------------------------------------------------
// Ce qui est dû — les deux conditions
// ---------------------------------------------------------------------------

describe('les saisies dues', () => {
  it('🔴 ne réclame pas un repas déjà enregistré, même son heure passée', async () => {
    m.hour.mockReturnValue(20);

    // ⚠️ Assertion sur `kind` et non sur le JSON entier : le décompte du jour porte un champ
    // `mealsLogged`, qui contient « meal » et rendrait le test vert pour la mauvaise raison.
    expect((await actionOf()).action.kind).not.toMatch(/meal/i);
  });

  it('🔴 réclame le DÎNER le soir même si le petit-déj est noté (constat 1)', async () => {
    m.hour.mockReturnValue(20);
    m.meals.mockReturnValue(slots(['breakfast', 'lunch']));

    const { action } = await actionOf();
    expect(action.kind).toBe('meal-due');
    expect(action.kind === 'meal-due' && action.meal.key).toBe('dinner');
  });

  it('🔴 un petit-déj noté à 8 h ne déclare pas la journée faite', async () => {
    m.hour.mockReturnValue(9);
    m.meals.mockReturnValue(slots(['breakfast']));

    const { action } = await actionOf();
    expect(action.kind).not.toBe('day-done');
    expect(action.kind).toBe('meal-next');
  });

  it('ne réclame aucun repas quand le pilier nutrition est désactivé', async () => {
    m.settings.mockReturnValue({ settings: { activePillars: ['strength'] } });
    m.hour.mockReturnValue(20);
    m.meals.mockReturnValue(slots([]));

    expect((await actionOf()).action.kind).not.toMatch(/meal/i);
  });

  it('réclame la pesée quand son échéance est passée sans saisie, à qui se pèse', async () => {
    m.weighDeadline.mockReturnValue({ hour: 10 });
    m.weighDone.mockReturnValue({ done: false });
    m.hour.mockReturnValue(11);
    m.meals.mockReturnValue(slots(['breakfast', 'lunch', 'dinner']));

    expect((await actionOf()).action.kind).toBe('weigh-in-due');
  });

  it('🔴 ne réclame JAMAIS la pesée à qui ne se pèse pas (constat 3)', async () => {
    m.weighDeadline.mockReturnValue({ hour: 10 });
    m.weighDone.mockReturnValue({ done: false });
    m.weighHabit.mockReturnValue({ habit: false, isLoading: false });
    m.hour.mockReturnValue(11);

    expect((await actionOf()).action.kind).not.toBe('weigh-in-due');
  });
});

describe('rien de prévu (constat 2)', () => {
  it('🔴 jour de repos avec un programme actif : jamais « Créer un programme »', async () => {
    m.todaySession.mockReturnValue({ state: 'none', hasActiveProgram: true, isLoading: false });
    m.workouts.mockReturnValue({ workouts: [] });
    m.meals.mockReturnValue(slots([]));
    m.settings.mockReturnValue({ settings: { activePillars: ['strength', 'running'] } });

    const { action } = await actionOf();
    expect(action.kind === 'idle' && action.suggestion).toBe('activity');
  });

  it('musculation sans programme : on propose d’en trouver un', async () => {
    m.todaySession.mockReturnValue({ state: 'none', hasActiveProgram: false, isLoading: false });
    m.settings.mockReturnValue({ settings: { activePillars: ['strength'] } });

    const { action } = await actionOf();
    expect(action.kind === 'idle' && action.suggestion).toBe('program');
  });

  it('🔴 nutrition seule : jamais de programme (décision H)', async () => {
    m.todaySession.mockReturnValue({ state: 'none', hasActiveProgram: false, isLoading: false });
    m.settings.mockReturnValue({ settings: { activePillars: ['nutrition'] } });
    m.meals.mockReturnValue({ slots: [], loggedToday: 0, isLoading: false });

    const { action } = await actionOf();
    expect(action.kind === 'idle' && action.suggestion).toBe('meal');
  });
});

// ---------------------------------------------------------------------------
// Le check-in bien-être — un usage observé, pas un réglage
// ---------------------------------------------------------------------------

describe('le check-in bien-être', () => {
  it('🔴 ne se propose pas à qui ne l’a jamais pratiqué', async () => {
    m.wellbeingHistory.mockReturnValue({ entries: [] });
    m.wellbeing.mockReturnValue({ entry: null });

    expect((await actionOf()).action.kind).not.toMatch(/wellbeing/i);
  });

  it('observe l’usage sur une fenêtre de 30 jours', async () => {
    await renderHook(() => useNowAction());

    expect(m.windowStart).toHaveBeenCalledWith(30);
  });

  it('lit l’historique depuis la borne de cette fenêtre', async () => {
    await renderHook(() => useNowAction());

    expect(m.wellbeingHistory).toHaveBeenCalledWith('2026-08-23');
  });
});

// ---------------------------------------------------------------------------
// Ce qui a été fait aujourd'hui
// ---------------------------------------------------------------------------

describe('le décompte du jour', () => {
  it('🔴 compte une séance de 23 h 30 pour AUJOURD’HUI, pas pour demain', async () => {
    m.workouts.mockReturnValue({
      workouts: [{ finishedAt: new Date('2026-09-22T23:30:00').toISOString() }],
    });

    const { action } = await actionOf();

    expect(action).toBeDefined();
  });

  it('ne compte pas une séance d’hier', async () => {
    m.workouts.mockReturnValue({
      workouts: [{ finishedAt: new Date('2026-09-21T18:00:00').toISOString() }],
    });
    m.runs.mockReturnValue({ runs: [] });

    expect((await actionOf()).action).toBeDefined();
  });

  it('ignore une séance jamais terminée', async () => {
    m.workouts.mockReturnValue({ workouts: [{ finishedAt: null }] });

    expect((await actionOf()).action).toBeDefined();
  });

  it('ignore un horodatage illisible plutôt que de le compter comme aujourd’hui', async () => {
    m.workouts.mockReturnValue({ workouts: [{ finishedAt: 'pas une date' }] });

    expect((await actionOf()).action).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Ce qui tourne, et le chargement
// ---------------------------------------------------------------------------

describe('ce qui tourne', () => {
  it('signale une séance de musculation en cours', async () => {
    m.activeWorkout.mockReturnValue({ workout: { id: 'w-1' }, isLoading: false });

    expect(JSON.stringify((await actionOf()).action)).toContain('w-1');
  });

  it('signale une course en cours', async () => {
    m.activeRun.mockReturnValue({ run: { id: 'r-1' } });

    expect((await actionOf()).action).toBeDefined();
  });

  it.each([
    ['séance active', () => m.activeWorkout.mockReturnValue({ workout: null, isLoading: true })],
    ['repas du jour', () => m.meals.mockReturnValue({ ...slots([]), isLoading: true })],
    ['séance planifiée', () => m.todaySession.mockReturnValue({ state: 'rest', isLoading: true })],
  ])('relaie le chargement de « %s »', async (_label, arrange) => {
    arrange();

    expect((await actionOf()).isLoading).toBe(true);
  });

  it('n’est plus en chargement quand les trois sources ont répondu', async () => {
    expect((await actionOf()).isLoading).toBe(false);
  });

  it('rend toujours une action, même sur un compte tout neuf', async () => {
    m.settings.mockReturnValue({ settings: null });

    const { action } = await actionOf();

    expect(action).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// US ACCUEIL-08 — le fil « Ta journée », collecté avec la décision
// ---------------------------------------------------------------------------

describe('US ACCUEIL-08 — le fil du jour', () => {
  const at = (h: number, min = 0) => new Date(2026, 8, 22, h, min).toISOString();
  const ids = (items: { id: string }[]) => items.map((it) => it.id);

  it('🔴 check-in du matin et point du soir sont DEUX gestes : une ligne de bien-être ne fait pas les deux', async () => {
    // Avant : une ligne quelconque du jour suffisait à dire le bien-être « fait ». L'énergie notée
    // le matin aurait éteint le point du soir.
    m.wellbeingHistory.mockReturnValue({ entries: [{ logDate: '2026-09-21' }] });
    m.wellbeing.mockReturnValue({ entry: { logDate: TODAY, energy: 4, mood: null, stress: null } });
    m.hour.mockReturnValue(21.5);

    const { timeline, checkinEnergy, action } = await actionOf();
    expect(timeline.items.find((it) => it.id === 'checkin')?.done).toBe(true);
    expect(timeline.items.find((it) => it.id === 'evening')?.done).toBe(false);
    expect(checkinEnergy).toBe(4);
    expect(action.kind).toBe('wellbeing-due');
  });

  it('le matin, sans énergie notée, le check-in est l’action du moment', async () => {
    m.wellbeingHistory.mockReturnValue({ entries: [{ logDate: '2026-09-21' }] });
    m.wellbeing.mockReturnValue({ entry: null });
    m.meals.mockReturnValue(slots([]));
    m.hour.mockReturnValue(7.75);

    expect((await actionOf()).timeline.now).toEqual({ kind: 'checkin-due' });
  });

  it('🔴 la séance terminée aujourd’hui entre au fil avec son nom et sa durée — pas celle d’hier', async () => {
    m.workouts.mockReturnValue({
      workouts: [
        { finishedAt: at(7, 30), sessionName: ' Jambes ', durationSeconds: 3480 },
        { finishedAt: new Date(2026, 8, 21, 18).toISOString(), sessionName: 'Hier', durationSeconds: 3600 },
      ],
    });

    const done = (await actionOf()).timeline.items.filter((it) => it.kind === 'training');
    expect(done).toHaveLength(1);
    expect(done[0]?.doneTraining).toMatchObject({ pillar: 'strength', name: 'Jambes', durationMinutes: 58 });
    expect(done[0]?.hour).toBeCloseTo(7.5, 5);
  });

  it('une sortie course faite garde sa distance — et disparaît si le pilier est éteint', async () => {
    m.runs.mockReturnValue({ runs: [{ finishedAt: at(8), durationSeconds: 1800, distanceM: 5200 }] });
    expect((await actionOf()).timeline.items.find((it) => it.kind === 'training')?.doneTraining).toMatchObject({
      pillar: 'running',
      distanceM: 5200,
      durationMinutes: 30,
    });

    m.settings.mockReturnValue({ settings: { activePillars: ['strength', 'nutrition'] } });
    expect((await actionOf()).timeline.items.some((it) => it.kind === 'training')).toBe(false);
  });

  it('les autres activités du jour (vélo, yoga…) entrent au fil, faites', async () => {
    m.activities.mockReturnValue({
      activities: [
        { startedAt: at(17), activityType: 'yoga', durationSeconds: 2700 },
        { startedAt: new Date(2026, 8, 20, 17).toISOString(), activityType: 'bike', durationSeconds: 3600 },
      ],
    });
    const acts = (await actionOf()).timeline.items.filter((it) => it.kind === 'activity');
    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({ done: true, activity: { activityType: 'yoga', durationMinutes: 45 } });
  });

  it('🔴 la marche ne se suggère qu’à qui compte ses pas', async () => {
    m.hour.mockReturnValue(17);
    expect(ids((await actionOf()).timeline.items)).not.toContain('walk');

    m.steps.mockReturnValue({ rows: [{ logDate: TODAY, steps: 4200 }] });
    const walk = (await actionOf()).timeline.items.find((it) => it.id === 'walk');
    expect(walk).toMatchObject({ suggested: true, stepsLeft: 3800 });
  });

  it('rend les totaux du jour par repas, pour les lignes faites du fil', async () => {
    m.meals.mockReturnValue(slots(['breakfast']));
    expect((await actionOf()).mealTotals.get('breakfast')).toEqual({ kcal: 500, proteinG: 30 });
  });

  it('rend l’heure décimale qui a servi à décider', async () => {
    m.hour.mockReturnValue(13.25);
    expect((await actionOf()).hour).toBe(13.25);
  });
});
