/**
 * Planificateur du rappel « série en danger » (US 2.6) — l'orchestration autour de la règle.
 *
 * La **décision** (`shouldScheduleStreakReminder` : heure, DND, activité du jour) vit dans
 * `@wellness/shared` et y est testée. Ce qui n'est vérifié nulle part, c'est ce que le hook fait
 * **autour** — et c'est là que se logent les défauts qui coûtent cher, parce qu'ils produisent
 * tous la même chose à l'écran : rien.
 *
 *  1. **Ne pas décider pendant le chargement.** Tant que l'activité du jour n'est pas résolue,
 *     planifier ou annuler revient à trancher sur des données incomplètes — donc à annuler un
 *     rappel légitime une fois sur deux, au hasard de la latence de la base locale.
 *  2. **Permission refusée → annuler ce qui est en attente.** Garder un rappel planifié que l'OS
 *     ne délivrera jamais n'aide personne ; et si la permission revient, il faut repartir propre.
 *  3. **Réévaluer au retour au premier plan.** C'est le seul moment où l'app peut constater que
 *     l'utilisateur est devenu actif — il n'y a pas de tâche d'arrière-plan (limite assumée du MVP).
 *     Sans ce ré-examen, un rappel « ta série est en danger » partirait alors que la séance est
 *     déjà faite.
 */

import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';

import {
  cancelStreakReminder,
  ensurePermissionAndChannel,
  scheduleStreakReminder,
} from '@/lib/notifications';
import { useStreakData } from './../dashboard-repository';

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
  useWeeklyReview: jest.fn(() => ({ review: null, isLoading: false })),
}));

jest.mock('../planned-session-repository', () => ({
  useHasPlannedStrengthSessionToday: jest.fn(() => ({ has: false, isLoading: false })),
}));

jest.mock('../reminder-habits-repository', () => ({
  useMealDeadline: jest.fn(() => ({ hour: 20, minute: 0 })),
  useWeighInDeadline: jest.fn(() => ({ hour: 9, minute: 0 })),
  useSessionDeadline: jest.fn(() => ({ hour: 18, minute: 0 })),
  useMealLoggedToday: jest.fn(() => ({ done: false, isLoading: false })),
  useWeighInToday: jest.fn(() => ({ done: false, isLoading: false })),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  // Requis : `@/i18n` fait `i18n.use(initReactI18next)` au chargement du module, et le repository
  // l'importe. Le mocker sans cette clé fait échouer la **suite entière** à l'import.
  initReactI18next: { type: '3rdParty', init: jest.fn() },
}));

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: { language: 'fr', t: (k: string) => k },
  resolveDeviceLocale: () => 'fr',
  getAppLanguage: () => 'fr',
}));

// Import volontairement APRÈS les `jest.mock` ci-dessus : le module testé capture ses dépendances
// à son chargement. `useNotificationPrefs` vient du même module, d'où cet import unique.
import { useNotificationPrefs, useStreakReminderScheduler } from '../notification-repository';

const ensurePermission = ensurePermissionAndChannel as jest.Mock;
const schedule = scheduleStreakReminder as jest.Mock;
const cancel = cancelStreakReminder as jest.Mock;
const streakData = useStreakData as jest.Mock;

let addEventListener: jest.SpyInstance;

/** Rappel activé, planifié à 20 h, hors « ne pas déranger ». */
function prefs(over?: Record<string, unknown>) {
  return {
    streakDanger: true,
    reminderHour: 20,
    dndEnabled: false,
    dndStartHour: 22,
    dndEndHour: 8,
    mealReminder: false,
    weighInReminder: false,
    sessionReminder: false,
    recordPush: false,
    weeklyReview: false,
    maxPerDay: 3,
    ...over,
  } as never;
}

/** Fige l'horloge à `hour` du jour courant : la règle métier lit `new Date().getHours()`. */
function atHour(hour: number): void {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
  jest.setSystemTime(d);
}

/** Monte le planificateur en laissant tourner ses effets. */
const mount = () => renderHook(() => useStreakReminderScheduler());

/** Rejoue un passage au premier plan. */
async function foreground(state: 'active' | 'background' = 'active'): Promise<void> {
  const handlers = addEventListener.mock.calls
    .filter((c) => c[0] === 'change')
    .map((c) => c[1] as (s: string) => void);
  await act(async () => {
    for (const h of handlers) h(state);
  });
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.useRealTimers();

  addEventListener = jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() } as never);

  ensurePermission.mockResolvedValue(true);
  streakData.mockReturnValue({ activeToday: false, isLoading: false });
  (useNotificationPrefs as unknown as jest.Mock | undefined)?.mockReturnValue?.(prefs());

  // 19 h : avant l'heure de rappel (20 h), hors DND → la règle autorise la planification.
  atHour(19);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------

describe('pendant le chargement', () => {
  it('🔴 ne décide RIEN tant que l’activité du jour n’est pas résolue', async () => {
    streakData.mockReturnValue({ activeToday: false, isLoading: true });

    await mount();

    // Trancher ici reviendrait à annuler un rappel légitime une fois sur deux, au hasard de la
    // latence de la base locale.
    expect(schedule).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
    expect(ensurePermission).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

describe('permission', () => {
  it('ANNULE ce qui est en attente quand la permission est refusée', async () => {
    ensurePermission.mockResolvedValue(false);

    await mount();

    // Garder un rappel que l'OS ne délivrera jamais n'aide personne, et laisserait un état sale
    // si la permission revenait.
    expect(cancel).toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
  });

  it('demande la permission avant toute planification', async () => {
    await mount();

    expect(ensurePermission).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Décision
// ---------------------------------------------------------------------------

describe('décision', () => {
  it('planifie à l’heure de rappel quand la série est en danger', async () => {
    await mount();

    expect(schedule).toHaveBeenCalledTimes(1);
    const [date, content] = schedule.mock.calls[0] ?? [];
    expect((date as Date).getHours()).toBe(20);
    expect(content).toEqual({
      title: 'notifications.streakDanger.title',
      body: 'notifications.streakDanger.body',
    });
  });

  it('ANNULE quand l’utilisateur est déjà actif aujourd’hui', async () => {
    streakData.mockReturnValue({ activeToday: true, isLoading: false });

    await mount();

    expect(cancel).toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Retour au premier plan
// ---------------------------------------------------------------------------

describe('retour au premier plan', () => {
  it('🔴 réévalue — sans quoi un rappel partirait sur une séance déjà faite', async () => {
    await mount();
    expect(schedule).toHaveBeenCalledTimes(1);

    await foreground();

    // Pas de tâche d'arrière-plan (limite assumée du MVP) : le retour au premier plan est le seul
    // moment où l'app peut constater que l'utilisateur est devenu actif.
    expect(schedule).toHaveBeenCalledTimes(2);
  });

  it('ne réagit qu’à l’état « actif »', async () => {
    await mount();
    const avant = schedule.mock.calls.length;

    await foreground('background');

    expect(schedule).toHaveBeenCalledTimes(avant);
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
