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

/**
 * Identifiants stables des rappels programmés (US NUTR-F1). Même raison que ci-dessus : re-planifier
 * remplace, donc il y a **au plus un** rappel en attente par type. C'est cet invariant qui borne
 * structurellement le volume de notifications à un par type et par jour (décision D3).
 */
export const MEAL_REMINDER_ID = 'meal-reminder';
export const WEIGH_IN_REMINDER_ID = 'weigh-in-reminder';

/**
 * Préfixe de l'identifiant du push de record (US MUSC-F8). **Volontairement pas un id stable** :
 * `<préfixe><workoutId>` produit un identifiant **par séance**, pour que deux séances à record le
 * même jour laissent deux traces distinctes dans le tiroir de notifications au lieu que la seconde
 * n'efface la première (décision D10, revue après un premier essai avec id stable).
 */
export const RECORD_PUSH_PREFIX = 'record-push-';

/** Identifiant du rappel de séance planifiée muscu (US MUSC-F8). */
export const SESSION_REMINDER_ID = 'session-reminder';

/**
 * Contenu i18n d'une notification (résolu par l'appelant via i18next).
 *
 * Nommé `StreakReminderContent` à l'origine, quand le rappel streak était le seul type. Il sert
 * désormais de contrat à tous les rappels — d'où le renommage.
 */
export interface ReminderContent {
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
 * (Re)planifie un rappel **ponctuel** pour l'instant `date`, sous un identifiant stable — donc
 * remplace tout rappel déjà en attente sous le même id (au plus un par type).
 *
 * L'appelant est responsable de n'appeler cette fonction *que* lorsque la règle métier l'autorise et
 * que la permission est accordée. Ne lève jamais (no-op silencieux en cas d'erreur).
 *
 * Généralisée par NUTR-F1 : le rappel streak et les deux rappels programmés partagent exactement ce
 * comportement, il n'y avait pas de raison d'en avoir trois copies.
 */
export async function scheduleDatedReminder(
  id: string,
  date: Date,
  content: ReminderContent,
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
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
 * Annule le rappel en attente sous cet identifiant. Idempotent : sans rappel en attente, no-op.
 * Ne lève jamais.
 */
export async function cancelReminder(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // no-op : rien à annuler / module indisponible.
  }
}

/** (Re)planifie le rappel streak (US 2.6). */
export async function scheduleStreakReminder(
  date: Date,
  content: ReminderContent,
): Promise<void> {
  await scheduleDatedReminder(STREAK_REMINDER_ID, date, content);
}

/** Annule le rappel streak en attente. */
export async function cancelStreakReminder(): Promise<void> {
  await cancelReminder(STREAK_REMINDER_ID);
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
  content: ReminderContent,
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

/**
 * Envoie une notification **immédiatement**, sous l'identifiant fourni par l'appelant (US MUSC-F8).
 *
 * `trigger: { channelId }` est la forme `ChannelAwareTriggerInput` du SDK 57 : pas de planification,
 * mais un routage obligatoire sur le canal Android (tout passe par `REMINDERS_CHANNEL_ID`).
 * ⚠️ `presentNotificationAsync` n'existe plus en SDK 57 — ne pas le chercher, cette fonction est le
 * remplacement.
 *
 * @returns `true` si l'appel natif n'a pas levé — **et seulement dans ce cas** l'appelant doit
 * consommer une unité de quota (décision D14, `notification-quota-store.ts`). `false` sinon, jamais
 * de `throw` : sans ce contrat booléen, une notification qui échoue silencieusement consommerait
 * quand même le plafond quotidien.
 */
export async function presentNow(id: string, content: ReminderContent): Promise<boolean> {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title: content.title, body: content.body },
      trigger: { channelId: REMINDERS_CHANNEL_ID },
    });
    return true;
  } catch {
    return false;
  }
}
