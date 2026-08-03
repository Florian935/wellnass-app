/**
 * Couche notifications — permission, canal Android, planification, annulation.
 *
 * Lot 3 de [strategie-tests.md](../../../../../docs/specs/technical/strategie-tests.md).
 *
 * Ce module ne décide de rien : les règles métier (faut-il rappeler ? est-on en heure calme ?)
 * vivent dans `@wellness/shared` et y sont testées. Ce qu'il porte, en revanche, ce sont **deux
 * contrats invisibles à l'exécution** :
 *
 *  1. **Ne jamais lever.** Permission refusée, plateforme non prise en charge, module absent : tout
 *     doit finir en no-op silencieux. Une exception qui remonte ici crasherait l'app pour une
 *     notification — et sur un APK de production, personne ne saurait pourquoi.
 *  2. **Le booléen de `presentNow`.** Il est renvoyé à l'appelant *uniquement* pour qu'il décide de
 *     consommer, ou non, une unité du quota quotidien (décision D14). S'il renvoyait `true` sur un
 *     échec, une notification jamais affichée mangerait quand même le plafond du jour — et
 *     l'utilisateur perdrait des rappels sans qu'aucune trace n'existe.
 *
 * Le troisième invariant testé est l'**identifiant stable** : c'est lui, et rien d'autre, qui
 * garantit qu'au plus un rappel de chaque type est en attente. Le seul qui déroge est le push de
 * record, volontairement suffixé par séance (décision D10).
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import {
  cancelReminder,
  cancelStreakReminder,
  cancelWeeklyReview,
  ensurePermissionAndChannel,
  MEAL_REMINDER_ID,
  presentNow,
  RECORD_PUSH_PREFIX,
  REMINDERS_CHANNEL_ID,
  scheduleDatedReminder,
  scheduleStreakReminder,
  scheduleWeeklyReview,
  STREAK_REMINDER_ID,
  WEEKLY_REVIEW_ID,
} from '../notifications';

const schedule = Notifications.scheduleNotificationAsync as jest.Mock;
const cancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const setChannel = Notifications.setNotificationChannelAsync as jest.Mock;
const getPermissions = Notifications.getPermissionsAsync as jest.Mock;
const requestPermissions = Notifications.requestPermissionsAsync as jest.Mock;

const CONTENT = { title: 'Titre', body: 'Corps' };

/** Force la plateforme le temps d'un test (`Platform.OS` est en lecture seule en typage). */
function setPlatform(os: 'android' | 'ios'): void {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  setPlatform('android');
  getPermissions.mockResolvedValue({ granted: true, canAskAgain: true });
  requestPermissions.mockResolvedValue({ granted: true });
  schedule.mockResolvedValue('mock-id');
  cancel.mockResolvedValue(undefined);
  setChannel.mockResolvedValue(undefined);
});

afterAll(() => setPlatform('android'));

// ---------------------------------------------------------------------------
// Permission et canal
// ---------------------------------------------------------------------------

describe('ensurePermissionAndChannel', () => {
  it('crée le canal Android avant toute chose', async () => {
    await ensurePermissionAndChannel();

    expect(setChannel).toHaveBeenCalledWith(
      REMINDERS_CHANNEL_ID,
      expect.objectContaining({ importance: Notifications.AndroidImportance.DEFAULT }),
    );
  });

  it('ne crée aucun canal hors Android', async () => {
    setPlatform('ios');

    await ensurePermissionAndChannel();

    expect(setChannel).not.toHaveBeenCalled();
  });

  it('ne redemande rien quand la permission est déjà accordée', async () => {
    expect(await ensurePermissionAndChannel()).toBe(true);
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it('demande la permission quand elle n’est pas accordée mais peut l’être', async () => {
    getPermissions.mockResolvedValue({ granted: false, canAskAgain: true });

    expect(await ensurePermissionAndChannel()).toBe(true);
    expect(requestPermissions).toHaveBeenCalled();
  });

  it('renvoie le refus de l’utilisateur', async () => {
    getPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    requestPermissions.mockResolvedValue({ granted: false });

    expect(await ensurePermissionAndChannel()).toBe(false);
  });

  it('ne redemande PAS quand le système l’interdit — pas de boucle de demandes', async () => {
    getPermissions.mockResolvedValue({ granted: false, canAskAgain: false });

    expect(await ensurePermissionAndChannel()).toBe(false);
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it('renvoie false plutôt que de lever si le module natif est indisponible', async () => {
    setChannel.mockRejectedValue(new Error('module absent'));

    await expect(ensurePermissionAndChannel()).resolves.toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rappel ponctuel
// ---------------------------------------------------------------------------

describe('scheduleDatedReminder', () => {
  const DATE = new Date('2026-08-04T19:30:00.000Z');

  it('planifie sur un déclencheur daté, routé sur le canal Rappels', async () => {
    await scheduleDatedReminder(MEAL_REMINDER_ID, DATE, CONTENT);

    expect(schedule).toHaveBeenCalledWith({
      identifier: MEAL_REMINDER_ID,
      content: { title: 'Titre', body: 'Corps' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: DATE,
        channelId: REMINDERS_CHANNEL_ID,
      },
    });
  });

  it('réutilise le même identifiant — au plus un rappel en attente par type', async () => {
    await scheduleDatedReminder(MEAL_REMINDER_ID, DATE, CONTENT);
    await scheduleDatedReminder(MEAL_REMINDER_ID, new Date('2026-08-05T19:30:00.000Z'), CONTENT);

    const ids = schedule.mock.calls.map((c) => c[0].identifier);
    expect(new Set(ids).size).toBe(1);
  });

  it('ne lève jamais, même si l’OS refuse la planification', async () => {
    schedule.mockRejectedValue(new Error('date passée'));

    await expect(scheduleDatedReminder(MEAL_REMINDER_ID, DATE, CONTENT)).resolves.toBeUndefined();
  });

  it('passe par l’identifiant stable du streak', async () => {
    await scheduleStreakReminder(DATE, CONTENT);

    expect(schedule.mock.calls[0]?.[0].identifier).toBe(STREAK_REMINDER_ID);
  });
});

// ---------------------------------------------------------------------------
// Bilan hebdomadaire
// ---------------------------------------------------------------------------

describe('scheduleWeeklyReview', () => {
  it('utilise un déclencheur RÉCURRENT — rien à re-planifier chaque semaine', async () => {
    await scheduleWeeklyReview(2, 18, CONTENT);

    expect(schedule).toHaveBeenCalledWith({
      identifier: WEEKLY_REVIEW_ID,
      content: { title: 'Titre', body: 'Corps' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 2,
        hour: 18,
        minute: 0,
        channelId: REMINDERS_CHANNEL_ID,
      },
    });
  });

  it('transmet le jour tel quel — la convention 1 = dimanche appartient à l’appelant', async () => {
    await scheduleWeeklyReview(1, 9, CONTENT);

    // La valeur vient de `WEEKLY_REVIEW_WEEKDAY` (@wellness/shared) : ce module ne doit surtout
    // pas la retraduire, sinon la confusion se glisserait à deux endroits au lieu d'un.
    expect(schedule.mock.calls[0]?.[0].trigger.weekday).toBe(1);
  });

  it('ne lève pas sur une plateforme qui ne gère pas le déclencheur hebdomadaire', async () => {
    schedule.mockRejectedValue(new Error('trigger non supporté'));

    await expect(scheduleWeeklyReview(2, 18, CONTENT)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Annulation
// ---------------------------------------------------------------------------

describe('annulation', () => {
  it('annule par identifiant', async () => {
    await cancelReminder(MEAL_REMINDER_ID);

    expect(cancel).toHaveBeenCalledWith(MEAL_REMINDER_ID);
  });

  it('cible les bons identifiants pour le streak et le bilan', async () => {
    await cancelStreakReminder();
    await cancelWeeklyReview();

    expect(cancel.mock.calls.map((c) => c[0])).toEqual([STREAK_REMINDER_ID, WEEKLY_REVIEW_ID]);
  });

  it('est idempotente : annuler ce qui n’existe pas ne lève pas', async () => {
    cancel.mockRejectedValue(new Error('rien à annuler'));

    await expect(cancelReminder(MEAL_REMINDER_ID)).resolves.toBeUndefined();
    await expect(cancelStreakReminder()).resolves.toBeUndefined();
    await expect(cancelWeeklyReview()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Envoi immédiat — le contrat de quota (décision D14)
// ---------------------------------------------------------------------------

describe('presentNow', () => {
  it('envoie immédiatement, routé sur le canal, sans planification', async () => {
    await presentNow(`${RECORD_PUSH_PREFIX}workout-1`, CONTENT);

    expect(schedule).toHaveBeenCalledWith({
      identifier: `${RECORD_PUSH_PREFIX}workout-1`,
      content: { title: 'Titre', body: 'Corps' },
      trigger: { channelId: REMINDERS_CHANNEL_ID },
    });
  });

  it('renvoie true quand l’appel natif a abouti', async () => {
    expect(await presentNow('id', CONTENT)).toBe(true);
  });

  it('renvoie FALSE en cas d’échec — sinon le quota du jour serait mangé pour rien', async () => {
    schedule.mockRejectedValue(new Error('permission refusée'));

    // C'est tout l'objet du booléen (décision D14) : sans lui, une notification jamais affichée
    // consommerait quand même le plafond quotidien, et l'utilisateur perdrait des rappels.
    expect(await presentNow('id', CONTENT)).toBe(false);
  });

  it('donne un identifiant DISTINCT par séance — deux records le même jour ne s’écrasent pas', async () => {
    await presentNow(`${RECORD_PUSH_PREFIX}workout-1`, CONTENT);
    await presentNow(`${RECORD_PUSH_PREFIX}workout-2`, CONTENT);

    const ids = schedule.mock.calls.map((c) => c[0].identifier);
    expect(new Set(ids).size).toBe(2);
  });
});
