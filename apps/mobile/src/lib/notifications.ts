/**
 * Couche native fine au-dessus d'`expo-notifications` (SDK 57) — US 2.6/2.8/1.17.
 *
 * Toute la logique *métier* décidant s'il faut planifier vit dans
 * `@wellness/shared` (`shouldScheduleStreakReminder`, `isWithinDnd`, …) et est
 * testée unitairement. Ce module ne fait qu'exécuter la décision côté OS :
 * permission, canal Android, planification/annulation.
 *
 * Contrat de robustesse : permission refusée / plateforme non prise en charge →
 * no-op silencieux (jamais de `throw` propagé à l'appelant). L'app ne doit
 * jamais crasher parce que les notifications sont indisponibles.
 *
 * API SDK 57 utilisée (voir https://docs.expo.dev/versions/v57.0.0/sdk/notifications/) :
 *  - `setNotificationChannelAsync('reminders', { importance, … })` (canal Android)
 *  - `getPermissionsAsync` / `requestPermissionsAsync` (retour `{ granted }`)
 *  - `scheduleNotificationAsync({ identifier, content, trigger })` avec un
 *    trigger `SchedulableTriggerInputTypes.DATE` (`{ type, date }`) ou
 *    `SchedulableTriggerInputTypes.WEEKLY` (`{ type, weekday, hour, minute }`,
 *    **récurrent** — `weekday` 1 = dimanche ; Android)
 *  - `cancelScheduledNotificationAsync(identifier)` (identifiant stable → idempotence)
 *  - `setNotificationHandler` (affichage au premier plan)
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/** Identifiant du canal Android « Rappels ». */
export const REMINDERS_CHANNEL_ID = 'reminders';

/**
 * Identifiant stable du rappel « série en danger ». Réutiliser le même id à
 * chaque planification garantit qu'au plus **un** rappel streak est en attente
 * (idempotence : re-planifier remplace l'existant).
 */
export const STREAK_REMINDER_ID = 'streak-danger-reminder';

/**
 * Identifiant stable du bilan hebdomadaire (US BILAN-01). Même raison que ci-dessus : re-planifier
 * remplace, donc il n'y a jamais deux bilans en attente.
 */
export const WEEKLY_REVIEW_ID = 'weekly-review';

/** Contenu i18n d'une notification (résolu par l'appelant via i18next). */
export interface StreakReminderContent {
  title: string;
  body: string;
}

/**
 * Affiche les notifications même lorsque l'app est au premier plan (bannière +
 * liste, sans son ni badge). Enregistré une seule fois au chargement du module.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * S'assure que la permission de notification est accordée et que le canal
 * Android « Rappels » existe. Idempotent.
 *
 * @returns `true` si la permission est accordée (planification possible),
 *   `false` sinon (refusée / indéterminée non accordable / erreur). Ne lève jamais.
 */
export async function ensurePermissionAndChannel(): Promise<boolean> {
  try {
    // Canal Android requis avant toute notification (Android 8+). No-op sur iOS.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(REMINDERS_CHANNEL_ID, {
        name: 'Rappels',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;

    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    // Plateforme non supportée / module indisponible → pas de notification.
    return false;
  }
}

/**
 * (Re)planifie le rappel streak pour l'instant `date` avec un identifiant
 * stable (remplace tout rappel streak déjà en attente → au plus un).
 *
 * L'appelant est responsable de n'appeler cette fonction *que* lorsque la
 * règle métier l'autorise (`shouldScheduleStreakReminder`) et que la permission
 * est accordée. Ne lève jamais (no-op silencieux en cas d'erreur).
 */
export async function scheduleStreakReminder(
  date: Date,
  content: StreakReminderContent,
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: STREAK_REMINDER_ID,
      content: {
        title: content.title,
        body: content.body,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: REMINDERS_CHANNEL_ID,
      },
    });
  } catch {
    // no-op : permission refusée / date passée / module indisponible.
  }
}

/**
 * Annule le rappel streak en attente (par identifiant stable). Idempotent :
 * sans rappel en attente, no-op. Ne lève jamais.
 */
export async function cancelStreakReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(STREAK_REMINDER_ID);
  } catch {
    // no-op : rien à annuler / module indisponible.
  }
}

/**
 * (Re)planifie le **bilan hebdomadaire** (US BILAN-01) sur un rendez-vous récurrent.
 *
 * Trigger `WEEKLY` (`{ type, weekday, hour, minute }`) et non `DATE` : l'OS répète le rendez-vous
 * tout seul, donc **rien à mémoriser** — ni « dernière semaine notifiée », ni re-planification
 * hebdomadaire à la main.
 *
 * ⚠️ `weekday` suit la convention du SDK : **1 = dimanche**, donc lundi vaut 2. La valeur vient de
 * `WEEKLY_REVIEW_WEEKDAY` (@wellness/shared) pour que la confusion ne puisse pas se glisser ici.
 *
 * ⚠️ Le contenu est **volontairement non chiffré** (décision D1) : les chiffres sont calculés à
 * l'ouverture de l'écran. C'est ce qui rend la notification insensible au doze mode Android — même
 * livrée six heures plus tard, elle reste exacte, parce qu'elle n'affirme aucun nombre.
 *
 * `WEEKLY` est documenté côté Android dans le SDK 57 ; sur iOS il faudrait un
 * `CalendarNotificationTrigger` — hors périmètre (décision E, Android d'abord). Sur une plateforme
 * qui ne le gère pas, l'appel échoue en silence : l'écran et le widget restent la voie d'accès.
 */
export async function scheduleWeeklyReview(
  weekday: number,
  hour: number,
  content: StreakReminderContent,
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: WEEKLY_REVIEW_ID,
      content: { title: content.title, body: content.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday,
        hour,
        minute: 0,
        channelId: REMINDERS_CHANNEL_ID,
      },
    });
  } catch {
    // no-op : permission refusée / trigger non supporté (iOS) / module indisponible.
  }
}

/** Annule le bilan hebdomadaire en attente. Idempotent, ne lève jamais. */
export async function cancelWeeklyReview(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(WEEKLY_REVIEW_ID);
  } catch {
    // no-op : rien à annuler / module indisponible.
  }
}
