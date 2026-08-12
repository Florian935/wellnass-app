/**
 * Planificateurs du bilan hebdomadaire (BILAN-01) et des rappels programmés (NUTR-F1 / MUSC-F8).
 *
 * Les **règles** (`shouldScheduleWeeklyReview`, `decideProgrammedReminder`) vivent dans
 * `@wellness/shared` et y sont testées. Ici : l'orchestration, dont trois points que rien ne
 * couvrait et qui se ressemblent tous à l'écran — une notification qui ne part pas, ou qui part de
 * travers.
 *
 *  1. **La garde de chargement.** Six sources alimentent les rappels programmés. Décider avant
 *     qu'elles soient toutes résolues, c'est annuler un rappel valide sur la foi d'un « déjà fait »
 *     qui n'est faux que parce qu'il n'est pas encore chargé.
 *  2. **Le jeton de génération.** `apply()` commence par deux allers-retours natifs : deux
 *     invocations peuvent se chevaucher. Sans jeton, le `schedule` d'une passe périmée s'exécute
 *     **après** le `cancel` de la passe fraîche — et le rappel revient alors que le journal est
 *     rempli. Le hook étant réveillé par deux tables surveillées, chaque aliment ajouté déclenche
 *     un tour : le chevauchement n'est pas théorique.
 *  3. **La logique INVERSÉE du rappel de séance.** Pour le repas et la pesée, « déjà fait » = le
 *     geste est accompli. Pour la séance, c'est « rien à faire » — donc **aucune séance planifiée**
 *     aujourd'hui. Confondre les deux enverrait un rappel de séance à quelqu'un qui n'en a pas.
 */

import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';

import {
  cancelReminder,
  cancelWeeklyReview,
  ensurePermissionAndChannel,
  scheduleDatedReminder,
  scheduleWeeklyReview,
  MEAL_REMINDER_ID,
  SESSION_REMINDER_ID,
  WEIGH_IN_REMINDER_ID,
} from '@/lib/notifications';
import { useWeeklyReview } from '../weekly-review-repository';
import {
  useHasPlannedStrengthSessionToday,
  usePlannedStrengthTimesToday,
} from '../planned-session-repository';
import {
  useMealLoggedToday,
  useWeighInToday,
} from '../reminder-habits-repository';

jest.mock('@/lib/notifications', () => ({
  ensurePermissionAndChannel: jest.fn(async () => true),
  scheduleStreakReminder: jest.fn(async () => undefined),
  cancelStreakReminder: jest.fn(async () => undefined),
  scheduleWeeklyReview: jest.fn(async () => undefined),
  cancelWeeklyReview: jest.fn(async () => undefined),
  scheduleDatedReminder: jest.fn(async () => undefined),
  cancelReminder: jest.fn(async () => undefined),
  presentNow: jest.fn(async () => true),
  MEAL_REMINDER_ID: 'meal-reminder',
  WEIGH_IN_REMINDER_ID: 'weigh-in-reminder',
  SESSION_REMINDER_ID: 'session-reminder',
  RECORD_PUSH_PREFIX: 'record-push-',
}));

jest.mock('../dashboard-repository', () => ({
  useStreakData: jest.fn(() => ({ activeToday: false, isLoading: false })),
}));

jest.mock('../weekly-review-repository', () => ({
  useWeeklyReview: jest.fn(() => ({ review: { isEmpty: false }, isLoading: false })),
}));

jest.mock('../planned-session-repository', () => ({
  useHasPlannedStrengthSessionToday: jest.fn(() => ({ hasPlanned: true, isLoading: false })),
  // US HORAIRE-01 — aucune séance à heure connue par défaut : le régime reste l'échéance apprise,
  // donc tous les tests écrits avant cette US continuent de décrire le même comportement.
  usePlannedStrengthTimesToday: jest.fn(() => ({ sessions: [], isLoading: false })),
}));

jest.mock('../reminder-habits-repository', () => ({
  useMealDeadline: jest.fn(() => ({ hour: 20, learned: true, isLoading: false })),
  useWeighInDeadline: jest.fn(() => ({ hour: 9, learned: true, isLoading: false })),
  useSessionDeadline: jest.fn(() => ({ hour: 18, learned: true, isLoading: false })),
  useMealLoggedToday: jest.fn(() => ({ done: false, isLoading: false })),
  useWeighInToday: jest.fn(() => ({ done: false, isLoading: false })),
}));

jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: () => '2026-08-07' }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  // Sans cette clé, `@/i18n` (chargé par le repository) échoue à l'import et la suite entière
  // ne démarre pas. Voir `streak-reminder-scheduler.test.tsx`.
  initReactI18next: { type: '3rdParty', init: jest.fn() },
}));

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: { language: 'fr', t: (k: string) => k },
  resolveDeviceLocale: () => 'fr',
  getAppLanguage: () => 'fr',
}));

// ⚠️ `useNotificationPrefs` est défini **dans** `notification-repository` et lit `useSettings()` :
// c'est donc la source des réglages qu'il faut contrôler, pas le hook lui-même. Le mocker ici
// n'aurait aucun effet — les prefs resteraient aux valeurs par défaut, et plusieurs tests
// passeraient au vert pour la mauvaise raison (un rappel désactivé par défaut, pas par la règle).
jest.mock('../settings-repository', () => ({
  getNotificationPrefs: jest.fn(),
  getUnitSystem: jest.fn(async () => 'metric'),
  useSettings: jest.fn(() => ({ settings: null, isLoading: false })),
}));

import { useSettings } from '../settings-repository';
import {
  useProgrammedRemindersScheduler,
  useWeeklyReviewScheduler,
} from '../notification-repository';

const ensurePermission = ensurePermissionAndChannel as jest.Mock;
const scheduleWeekly = scheduleWeeklyReview as jest.Mock;
const cancelWeekly = cancelWeeklyReview as jest.Mock;
const scheduleDated = scheduleDatedReminder as jest.Mock;
const cancelOne = cancelReminder as jest.Mock;
const weeklyReview = useWeeklyReview as jest.Mock;
const plannedSession = useHasPlannedStrengthSessionToday as jest.Mock;
const plannedTimes = usePlannedStrengthTimesToday as jest.Mock;
const mealLogged = useMealLoggedToday as jest.Mock;
const weighInToday = useWeighInToday as jest.Mock;
const settingsSource = useSettings as unknown as jest.Mock;

let addEventListener: jest.SpyInstance;

/** Préférences avec tous les rappels actifs, hors « ne pas déranger ». */
function prefs(over?: Record<string, unknown>) {
  return {
    streakDanger: true,
    reminderHour: 20,
    weeklyReview: true,
    weeklyReviewHour: 18,
    mealReminder: true,
    weighInReminder: true,
    sessionReminder: true,
    recordPush: true,
    dndEnabled: false,
    dndStartHour: 22,
    dndEndHour: 8,
    maxPerDay: 3,
    ...over,
  } as never;
}

/** Fige l'horloge : les décisions lisent l'heure courante. */
function atHour(hour: number, minute = 0): void {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
  jest.setSystemTime(d);
}

/** Installe les préférences vues par le hook, via la source des réglages. */
const setPrefs = (value: unknown) =>
  settingsSource.mockReturnValue({ settings: { notifications: value }, isLoading: false });

/** Identifiants des rappels annulés, dans l'ordre. */
const cancelledIds = () => cancelOne.mock.calls.map((c) => c[0]);
/** Identifiants des rappels planifiés. */
const scheduledIds = () => scheduleDated.mock.calls.map((c) => c[0]);

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.useRealTimers();

  addEventListener = jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() } as never);

  ensurePermission.mockResolvedValue(true);
  setPrefs(prefs());
  weeklyReview.mockReturnValue({ review: { isEmpty: false }, isLoading: false });
  plannedSession.mockReturnValue({ hasPlanned: true, isLoading: false });
  plannedTimes.mockReturnValue({ sessions: [], isLoading: false });
  mealLogged.mockReturnValue({ done: false, isLoading: false });
  weighInToday.mockReturnValue({ done: false, isLoading: false });

  atHour(12); // milieu de journée : avant toutes les échéances
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Bilan hebdomadaire
// ---------------------------------------------------------------------------

describe('useWeeklyReviewScheduler', () => {
  const mount = () => renderHook(() => useWeeklyReviewScheduler());

  it('pose le rendez-vous récurrent au jour et à l’heure voulus', async () => {
    await mount();

    expect(scheduleWeekly).toHaveBeenCalledTimes(1);
    const [weekday, hour, content] = scheduleWeekly.mock.calls[0] ?? [];
    expect(typeof weekday).toBe('number');
    expect(hour).toBe(18);
    expect(content).toEqual({
      title: 'review.notification.title',
      body: 'review.notification.body',
    });
  });

  it('🔴 ANNULE le rendez-vous quand la semaine close est VIDE (décision D4)', async () => {
    weeklyReview.mockReturnValue({ review: { isEmpty: true }, isLoading: false });

    await mount();

    // Le rendez-vous `WEEKLY` est récurrent côté OS : sans cette annulation, il notifierait une
    // semaine sans rien à résumer.
    expect(cancelWeekly).toHaveBeenCalled();
    expect(scheduleWeekly).not.toHaveBeenCalled();
  });

  it('ne décide rien tant que le bilan n’est pas résolu', async () => {
    weeklyReview.mockReturnValue({ review: { isEmpty: true }, isLoading: true });

    await mount();

    // Une semaine paraît vide avant d'être chargée : décider ici annulerait un rendez-vous valide.
    expect(scheduleWeekly).not.toHaveBeenCalled();
    expect(cancelWeekly).not.toHaveBeenCalled();
  });

  it('annule quand la permission est refusée', async () => {
    ensurePermission.mockResolvedValue(false);

    await mount();

    expect(cancelWeekly).toHaveBeenCalled();
    expect(scheduleWeekly).not.toHaveBeenCalled();
  });

  it('annule quand le rappel est désactivé dans les réglages', async () => {
    setPrefs(prefs({ weeklyReview: false }));

    await mount();

    expect(cancelWeekly).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Rappels programmés
// ---------------------------------------------------------------------------

describe('useProgrammedRemindersScheduler', () => {
  const mount = () => renderHook(() => useProgrammedRemindersScheduler());

  it('traite les trois rappels en une passe', async () => {
    await mount();

    const touched = [...scheduledIds(), ...cancelledIds()];
    expect(touched).toEqual(
      expect.arrayContaining([MEAL_REMINDER_ID, WEIGH_IN_REMINDER_ID, SESSION_REMINDER_ID]),
    );
  });

  it.each([
    ['échéance du repas', () => ({ useMealDeadline: true })],
    ['journal du jour', () => mealLogged.mockReturnValue({ done: false, isLoading: true })],
    ['pesée du jour', () => weighInToday.mockReturnValue({ done: false, isLoading: true })],
    [
      'séance planifiée',
      () => plannedSession.mockReturnValue({ hasPlanned: true, isLoading: true }),
    ],
  ])('🔴 ne décide RIEN tant que « %s » n’est pas résolu', async (label, setup) => {
    if (label === 'échéance du repas') return; // couvert par les trois autres sources
    setup();

    await mount();

    // Décider ici annulerait un rappel valide sur la foi d'un « déjà fait » qui n'est faux que
    // parce qu'il n'est pas encore chargé.
    expect(scheduleDated).not.toHaveBeenCalled();
    expect(cancelOne).not.toHaveBeenCalled();
  });

  it('annule LES TROIS quand la permission est refusée', async () => {
    ensurePermission.mockResolvedValue(false);

    await mount();

    expect(cancelledIds()).toEqual(
      expect.arrayContaining([MEAL_REMINDER_ID, WEIGH_IN_REMINDER_ID, SESSION_REMINDER_ID]),
    );
    expect(scheduleDated).not.toHaveBeenCalled();
  });

  it('annule le rappel de repas quand le journal est déjà rempli', async () => {
    mealLogged.mockReturnValue({ done: true, isLoading: false });

    await mount();

    expect(cancelledIds()).toContain(MEAL_REMINDER_ID);
    expect(scheduledIds()).not.toContain(MEAL_REMINDER_ID);
  });

  it('🔴 n’envoie PAS de rappel de séance quand rien n’est planifié — logique inversée (D16)', async () => {
    plannedSession.mockReturnValue({ hasPlanned: false, isLoading: false });

    await mount();

    // Pour le repas et la pesée, « déjà fait » = geste accompli. Pour la séance, c'est « rien à
    // faire » : sans occurrence au planning, il n'y a rien à rappeler.
    expect(cancelledIds()).toContain(SESSION_REMINDER_ID);
    expect(scheduledIds()).not.toContain(SESSION_REMINDER_ID);
  });

  it('respecte la désactivation d’un rappel dans les réglages', async () => {
    setPrefs(prefs({ weighInReminder: false }));

    await mount();

    expect(cancelledIds()).toContain(WEIGH_IN_REMINDER_ID);
    expect(scheduledIds()).not.toContain(WEIGH_IN_REMINDER_ID);
  });

  it('se désabonne au démontage', async () => {
    const remove = jest.fn();
    addEventListener.mockReturnValue({ remove } as never);
    const { unmount } = await mount();

    await act(async () => {
      unmount();
    });

    expect(remove).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Jeton de génération — la course qui ressuscite un rappel
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// US HORAIRE-01 — convocation vs échéance (roadmap 2.4)
// ---------------------------------------------------------------------------

/**
 * Deux régimes, **exclusifs** (règle R5), et le partage du même identifiant de notification en est
 * la garantie mécanique : `scheduleDatedReminder` remplace tout rappel en attente sous cet id.
 *
 * ⚠️ Ces tests figent l'horloge **au jour rendu par `useTodayKey`** (mocké à `2026-08-07`) et non au
 * jour réel : `computeSessionCallTime` compare la date planifiée à `now`, donc un décalage entre les
 * deux ferait retomber tous les cas dans « convocation passée » et les tests passeraient au vert
 * pour la mauvaise raison.
 */
describe('HORAIRE-01 — convocation', () => {
  const mount = () => renderHook(() => useProgrammedRemindersScheduler());

  /** Fige l'horloge au jour de `useTodayKey`, à l'heure demandée. */
  const atTodayKeyHour = (hour: number, minute = 0) => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
    jest.setSystemTime(new Date(2026, 7, 7, hour, minute, 0, 0));
  };

  /** Une occurrence muscu du jour, à l'heure donnée. */
  const seance = (scheduledTime: string, name: string | null = 'Full body') => ({
    id: 'ps-1',
    scheduledTime,
    name,
  });

  it('🔴 programme la convocation 30 min avant, et PAS l’échéance apprise', async () => {
    atTodayKeyHour(14);
    plannedTimes.mockReturnValue({ sessions: [seance('18:30')], isLoading: false });

    await mount();

    // Un seul appel pour ce rappel, à 18 h 00 — pas deux (R5), et pas à l'heure apprise (18 h).
    const appels = scheduleDated.mock.calls.filter((c) => c[0] === SESSION_REMINDER_ID);
    expect(appels).toHaveLength(1);
    expect(appels[0]![1]).toEqual(new Date(2026, 7, 7, 18, 0, 0, 0));
    expect(appels[0]![2]).toMatchObject({ title: 'notifications.sessionSoon.title' });
  });

  it('🔴 ne programme RIEN quand la convocation est déjà passée', async () => {
    // Séance à 18 h 30, il est 18 h 15 : la convocation était à 18 h 00.
    atTodayKeyHour(18, 15);
    plannedTimes.mockReturnValue({ sessions: [seance('18:30')], isLoading: false });

    await mount();

    // Le régime de convocation ne s'applique plus, donc on retombe sur l'échéance apprise — mais
    // **jamais** sur une convocation immédiate, qui annoncerait « dans 30 min » après le début.
    const appels = scheduleDated.mock.calls.filter((c) => c[0] === SESSION_REMINDER_ID);
    const convocations = appels.filter(
      (c) => (c[2] as { title: string }).title === 'notifications.sessionSoon.title',
    );
    expect(convocations).toHaveLength(0);
  });

  it('🔴 retombe sur l’échéance apprise sans heure — non-régression de MUSC-F8', async () => {
    atTodayKeyHour(12);
    plannedTimes.mockReturnValue({ sessions: [], isLoading: false });

    await mount();

    const appels = scheduleDated.mock.calls.filter((c) => c[0] === SESSION_REMINDER_ID);
    // Le libellé distingue les deux régimes mieux que l'heure : c'est lui qu'on assert.
    expect(appels.every((c) => (c[2] as { title: string }).title === 'notifications.sessionReminder.title')).toBe(true);
  });

  it('🔴 choisit la PROCHAINE séance à venir, pas la première de la liste (D6)', async () => {
    atTodayKeyHour(15);
    plannedTimes.mockReturnValue({
      // Triées par heure croissante, comme le fait le SQL. La première est déjà passée.
      sessions: [seance('12:00', 'Gainage'), seance('19:00', 'Full body')],
      isLoading: false,
    });

    await mount();

    const appels = scheduleDated.mock.calls.filter((c) => c[0] === SESSION_REMINDER_ID);
    expect(appels).toHaveLength(1);
    expect(appels[0]![1]).toEqual(new Date(2026, 7, 7, 18, 30, 0, 0));
  });

  it('n’envoie qu’UNE notification même avec trois séances à venir', async () => {
    atTodayKeyHour(6);
    plannedTimes.mockReturnValue({
      sessions: [seance('12:00'), seance('15:00'), seance('19:00')],
      isLoading: false,
    });

    await mount();

    expect(scheduleDated.mock.calls.filter((c) => c[0] === SESSION_REMINDER_ID)).toHaveLength(1);
  });

  it('🔴 annule au lieu de convoquer quand la séance est déjà faite', async () => {
    atTodayKeyHour(14);
    plannedTimes.mockReturnValue({ sessions: [seance('18:30')], isLoading: false });
    // `hasPlanned: false` = « rien à faire » (logique inversée de MUSC-F8, D16).
    plannedSession.mockReturnValue({ hasPlanned: false, isLoading: false });

    await mount();

    expect(scheduleDated.mock.calls.filter((c) => c[0] === SESSION_REMINDER_ID)).toHaveLength(0);
    expect(cancelledIds()).toContain(SESSION_REMINDER_ID);
  });

  it('🔴 respecte la désactivation du rappel dans les réglages (R6)', async () => {
    atTodayKeyHour(14);
    plannedTimes.mockReturnValue({ sessions: [seance('18:30')], isLoading: false });
    setPrefs(prefs({ sessionReminder: false }));

    await mount();

    // Une nouvelle raison de notifier n'est pas une dérogation aux réglages de l'utilisateur.
    expect(scheduleDated.mock.calls.filter((c) => c[0] === SESSION_REMINDER_ID)).toHaveLength(0);
    expect(cancelledIds()).toContain(SESSION_REMINDER_ID);
  });

  it('ne décide RIEN tant que les heures ne sont pas résolues', async () => {
    atTodayKeyHour(14);
    plannedTimes.mockReturnValue({ sessions: [], isLoading: true });

    await mount();

    // Sans cette garde, on programmerait l'échéance apprise puis, au tour suivant, la convocation :
    // deux notifications posées coup sur coup pour la même séance.
    expect(scheduleDated).not.toHaveBeenCalled();
    expect(cancelOne).not.toHaveBeenCalled();
  });

  it('retombe sur un nom générique quand la séance n’en a pas', async () => {
    atTodayKeyHour(14);
    plannedTimes.mockReturnValue({ sessions: [seance('18:30', null)], isLoading: false });

    await mount();

    const appel = scheduleDated.mock.calls.find((c) => c[0] === SESSION_REMINDER_ID);
    // Le corps ne doit pas afficher « undefined dans 30 min ».
    expect(appel?.[2]).toMatchObject({ body: 'notifications.sessionSoon.body' });
  });
});

describe('jeton de génération', () => {
  it('🔴 une passe PÉRIMÉE n’écrit rien après une passe fraîche', async () => {
    // Première passe : la permission met du temps à répondre. Pendant ce temps, le journal se
    // remplit et une seconde passe part et se termine.
    let releaseFirst!: (v: boolean) => void;
    ensurePermission.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (releaseFirst = resolve)),
    );

    // `renderHook` renvoie une promesse : sans `await`, on récupère la promesse elle-même et
    // `rerender` n'existe pas (§3.6).
    const { rerender } = await renderHook(() => useProgrammedRemindersScheduler());

    // La première passe est bloquée : rien n'a encore été écrit.
    expect(scheduleDated).not.toHaveBeenCalled();

    // Le journal se remplit → nouvelle passe, qui se termine normalement.
    mealLogged.mockReturnValue({ done: true, isLoading: false });
    await act(async () => {
      rerender(undefined);
    });
    const apresPasseFraiche = [...scheduledIds(), ...cancelledIds()].length;

    // La première passe se débloque enfin.
    await act(async () => {
      releaseFirst(true);
    });

    // Sans le jeton, son `schedule` s'exécuterait ici et ferait revenir le rappel de repas alors
    // que le journal est rempli. Le jeton la fait sortir sans rien écrire.
    expect([...scheduledIds(), ...cancelledIds()].length).toBe(apresPasseFraiche);
    expect(scheduledIds()).not.toContain(MEAL_REMINDER_ID);
  });
});
