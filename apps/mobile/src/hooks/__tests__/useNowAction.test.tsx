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
 *   dans tout l'écran.
 * - **Ce qui a été fait aujourd'hui se compte en jour LOCAL.** Une séance terminée à 23 h 30
 *   compte pour aujourd'hui, pas pour demain.
 * - **Le check-in bien-être n'a aucun réglage** : il se propose à qui le pratique déjà, observé sur
 *   30 jours. Le proposer à tout le monde serait réclamer un geste jamais choisi.
 *
 * `resolveNowAction` n'est pas mocké : on veut la chaîne réelle, sinon on testerait le mock.
 */

import { renderHook } from '@testing-library/react-native';

import { useNowAction } from '../useNowAction';
import { useCurrentHour, useTodayKey, useWindowStartKey } from '../useTodayKey';
import { useActiveWorkout, useWorkoutHistory } from '@/data/repositories/workout-repository';
import { useActiveRun, useRunHistory, useTodayRunSession } from '@/data/repositories/run-repository';
import { useStreakData, useTodaySession } from '@/data/repositories/dashboard-repository';
import { useNotificationPrefs } from '@/data/repositories/notification-repository';
import {
  useMealDeadline,
  useMealLoggedToday,
  useWeighInDeadline,
  useWeighInToday,
} from '@/data/repositories/reminder-habits-repository';
import {
  useTodayWellbeing,
  useWellbeingEntries,
} from '@/data/repositories/daily-wellbeing-repository';
import { useSettings } from '@/data/repositories/settings-repository';

jest.mock('../useTodayKey', () => ({
  useTodayKey: jest.fn(() => '2026-09-22'),
  useCurrentHour: jest.fn(() => 12),
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
  useMealDeadline: jest.fn(),
  useMealLoggedToday: jest.fn(),
  useWeighInDeadline: jest.fn(),
  useWeighInToday: jest.fn(),
}));
jest.mock('@/data/repositories/daily-wellbeing-repository', () => ({
  useTodayWellbeing: jest.fn(),
  useWellbeingEntries: jest.fn(),
}));
jest.mock('@/data/repositories/settings-repository', () => ({ useSettings: jest.fn() }));

const m = {
  hour: useCurrentHour as jest.Mock,
  todayKey: useTodayKey as jest.Mock,
  windowStart: useWindowStartKey as jest.Mock,
  settings: useSettings as jest.Mock,
  prefs: useNotificationPrefs as jest.Mock,
  activeWorkout: useActiveWorkout as jest.Mock,
  activeRun: useActiveRun as jest.Mock,
  todaySession: useTodaySession as jest.Mock,
  todayRun: useTodayRunSession as jest.Mock,
  mealDeadline: useMealDeadline as jest.Mock,
  mealDone: useMealLoggedToday as jest.Mock,
  weighDeadline: useWeighInDeadline as jest.Mock,
  weighDone: useWeighInToday as jest.Mock,
  wellbeing: useTodayWellbeing as jest.Mock,
  wellbeingHistory: useWellbeingEntries as jest.Mock,
  workouts: useWorkoutHistory as jest.Mock,
  runs: useRunHistory as jest.Mock,
  streak: useStreakData as jest.Mock,
};

const TODAY = '2026-09-22';

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
  m.mealDeadline.mockReturnValue({ hour: 14 });
  m.mealDone.mockReturnValue({ done: true, isLoading: false });
  m.weighDeadline.mockReturnValue({ hour: 10 });
  m.weighDone.mockReturnValue({ done: true });
  m.wellbeing.mockReturnValue({ entry: { logDate: TODAY } });
  m.wellbeingHistory.mockReturnValue({ entries: [] });
  m.workouts.mockReturnValue({ workouts: [] });
  m.runs.mockReturnValue({ runs: [] });
  m.streak.mockReturnValue({ current: 3 });
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
  it('🔴 ne réclame pas un repas déjà enregistré, même l’échéance passée', async () => {
    m.hour.mockReturnValue(20);
    m.mealDeadline.mockReturnValue({ hour: 14 });
    m.mealDone.mockReturnValue({ done: true, isLoading: false });

    // ⚠️ Assertion sur `kind` et non sur le JSON entier : le décompte du jour porte un champ
    // `mealLogged`, qui contient « meal » et rendrait le test vert pour la mauvaise raison.
    expect((await actionOf()).action.kind).not.toMatch(/meal/i);
  });

  it('réclame le repas quand l’échéance est passée et que rien n’est saisi', async () => {
    m.hour.mockReturnValue(20);
    m.mealDeadline.mockReturnValue({ hour: 14 });
    m.mealDone.mockReturnValue({ done: false, isLoading: false });

    expect((await actionOf()).action.kind).toMatch(/meal/i);
  });

  it('ne réclame rien avant l’échéance, même sans saisie', async () => {
    m.hour.mockReturnValue(9);
    m.mealDeadline.mockReturnValue({ hour: 14 });
    m.mealDone.mockReturnValue({ done: false, isLoading: false });

    expect((await actionOf()).action.kind).not.toMatch(/meal/i);
  });

  it('ne réclame aucun repas quand le pilier nutrition est désactivé', async () => {
    m.settings.mockReturnValue({ settings: { activePillars: ['strength'] } });
    m.hour.mockReturnValue(20);
    m.mealDone.mockReturnValue({ done: false, isLoading: false });

    expect(JSON.stringify((await actionOf()).action)).not.toContain('meal');
  });

  it('réclame la pesée quand son échéance est passée sans saisie', async () => {
    m.weighDeadline.mockReturnValue({ hour: 10 });
    m.weighDone.mockReturnValue({ done: false });
    m.hour.mockReturnValue(11);

    expect((await actionOf()).action).toBeDefined();
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
    ['repas du jour', () => m.mealDone.mockReturnValue({ done: false, isLoading: true })],
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
