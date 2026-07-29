/**
 * Repository des préférences de notifications + planificateur du rappel streak.
 *
 * US 2.6 (rappel série en danger), 2.8 (Ne pas déranger + max/jour), 1.17
 * (gestion par type). Tout est **local** (offline-first) : les préférences sont
 * persistées dans `user_settings.notifications` (déjà synchronisé) et la
 * planification est locale (aucun serveur).
 *
 * Séparation des responsabilités :
 *  - décision *métier* (faut-il planifier ?) → helpers purs de `@wellness/shared`
 *    (`shouldScheduleStreakReminder`, testés) ;
 *  - exécution *native* (planifier/annuler) → `@/lib/notifications` (wrapper SDK 57).
 * Ce module orchestre les deux et lit l'activité du jour (`useStreakData`).
 */

import { useCallback, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  parseNotificationPrefs,
  shouldScheduleStreakReminder,
  shouldScheduleWeeklyReview,
  WEEKLY_REVIEW_WEEKDAY,
  type NotificationPrefs,
} from '@wellness/shared';
import {
  cancelStreakReminder,
  cancelWeeklyReview,
  ensurePermissionAndChannel,
  scheduleStreakReminder,
  scheduleWeeklyReview,
} from '@/lib/notifications';
import { useSettings, updateSettings } from './settings-repository';
import { useStreakData } from './dashboard-repository';
import { useWeeklyReview } from './weekly-review-repository';

// ---------------------------------------------------------------------------
// Lecture réactive des préférences
// ---------------------------------------------------------------------------

/**
 * Préférences de notifications de l'utilisateur courant (réactives).
 * Retombe sur les défauts tant que les réglages ne sont pas chargés.
 */
export function useNotificationPrefs(): NotificationPrefs {
  const { settings } = useSettings();
  return parseNotificationPrefs(settings?.notifications ?? null);
}

// ---------------------------------------------------------------------------
// Écriture (patch partiel)
// ---------------------------------------------------------------------------

/**
 * Applique un patch partiel aux préférences de notifications et persiste.
 * Lit les prefs courantes (via la ligne locale), fusionne, puis
 * `updateSettings({ notifications })`. Offline-first.
 */
export async function updateNotificationPrefs(
  current: NotificationPrefs,
  patch: Partial<NotificationPrefs>,
): Promise<void> {
  const next: NotificationPrefs = { ...current, ...patch };
  await updateSettings({ notifications: next });
}

// ---------------------------------------------------------------------------
// Planificateur du rappel streak (2.6)
// ---------------------------------------------------------------------------

/** Construit la Date d'aujourd'hui à `hour:00:00` (heure locale). */
function todayAtHour(hour: number): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

/**
 * Monte le planificateur du rappel « série en danger ». À monter **une fois**
 * (ex. dans `RootNavigator`, après chargement des réglages).
 *
 * `apply()` : si la permission est accordée ET que la règle métier
 * (`shouldScheduleStreakReminder`) est vraie → (re)planifie le rappel
 * d'aujourd'hui à `reminderHour` ; sinon → annule tout rappel en attente.
 * Idempotent (identifiant stable côté wrapper : au plus un rappel).
 *
 * Déclenché : au montage, à chaque changement de `activeToday`/prefs, et au
 * retour de l'app au premier plan (`AppState` 'active'). L'abonnement AppState
 * est nettoyé au démontage. Hooks inconditionnels (React Compiler).
 */
export function useStreakReminderScheduler(): void {
  const { t } = useTranslation();
  const { activeToday, isLoading } = useStreakData();
  const prefs = useNotificationPrefs();

  const streakDanger = prefs.streakDanger;
  const reminderHour = prefs.reminderHour;
  const dndEnabled = prefs.dndEnabled;
  const dndStartHour = prefs.dndStartHour;
  const dndEndHour = prefs.dndEndHour;

  // `apply` dépend explicitement des valeurs métier : il change à chaque
  // changement d'activité/prefs, ce qui déclenche la (re)planification via les
  // effets ci-dessous (et ré-abonne le listener AppState — inoffensif, l'id
  // stable garantit l'idempotence).
  const apply = useCallback(async () => {
    // Tant que l'activité du jour n'est pas résolue, on ne décide pas (évite
    // d'annuler puis replanifier sur des données incomplètes).
    if (isLoading) return;

    const p: NotificationPrefs = {
      streakDanger,
      reminderHour,
      dndEnabled,
      dndStartHour,
      dndEndHour,
      maxPerDay: prefs.maxPerDay,
      // Sans effet sur le rappel streak, mais `NotificationPrefs` est un objet complet : ces deux
      // champs appartiennent au bilan hebdomadaire (BILAN-01) et sont recopiés tels quels.
      weeklyReview: prefs.weeklyReview,
      weeklyReviewHour: prefs.weeklyReviewHour,
    };

    const granted = await ensurePermissionAndChannel();
    if (!granted) {
      // Permission refusée : rien à planifier (et rien en attente à garder).
      await cancelStreakReminder();
      return;
    }

    const should = shouldScheduleStreakReminder({
      enabled: streakDanger,
      activeToday,
      nowHour: new Date().getHours(),
      reminderHour,
      prefs: p,
    });

    // NB (limite assumée MVP) : planification déclenchée UNIQUEMENT à l'ouverture /
    // au retour au premier plan (pas de tâche d'arrière-plan). Un rappel programmé
    // plus tôt aujourd'hui peut donc encore se déclencher même si l'utilisateur est
    // devenu actif alors que l'app était fermée : c'est toléré (simple rappel), et
    // `apply()` réévalue (annule si actif) au prochain passage au premier plan.
    // NB : `maxPerDay` n'est pas encore appliqué ici — un seul type de notification
    // au MVP (rappel streak, id stable → au plus 1 en attente, donc plafond respecté
    // trivialement). `canScheduleMore` est du câblage prêt pour les futurs types.
    if (should) {
      await scheduleStreakReminder(todayAtHour(reminderHour), {
        title: t('notifications.streakDanger.title'),
        body: t('notifications.streakDanger.body'),
      });
    } else {
      await cancelStreakReminder();
    }
  }, [
    isLoading,
    activeToday,
    streakDanger,
    reminderHour,
    dndEnabled,
    dndStartHour,
    dndEndHour,
    prefs.maxPerDay,
    prefs.weeklyReview,
    prefs.weeklyReviewHour,
    t,
  ]);

  // (Re)applique au montage et à chaque changement de `apply` (activité/prefs).
  useEffect(() => {
    void apply();
  }, [apply]);

  // Re-applique au retour au premier plan. Abonnement nettoyé au démontage.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void apply();
    });
    return () => sub.remove();
  }, [apply]);
}

// ---------------------------------------------------------------------------
// Planificateur du bilan hebdomadaire (BILAN-01)
// ---------------------------------------------------------------------------

/**
 * Monte le planificateur du **bilan hebdomadaire**. À monter une fois, au même endroit que
 * `useStreakReminderScheduler`.
 *
 * ── Pourquoi ce planificateur est révisé à chaque ouverture ────────────────────────────────────
 * Le rendez-vous `WEEKLY` est récurrent côté OS : une fois posé, il se répète sans nous. Mais la
 * décision D4 impose de **ne pas notifier une semaine vide**, et le contenu d'une semaine ne peut
 * pas être connu à l'avance. On réévalue donc la règle à chaque ouverture : si la semaine close est
 * vide, le rendez-vous est **annulé** ; sinon il est (re)posé.
 *
 * Conséquence honnête à connaître : si l'utilisateur n'ouvre **jamais** l'app pendant une semaine
 * vide, le rendez-vous posé la semaine précédente se déclenchera quand même. Il tombera sur un écran
 * qui dit « rien à résumer », ce qui est neutre — pas sur un chiffre faux. C'est le prix de
 * l'absence de tâche d'arrière-plan, et c'est le bon prix : aucun texte n'est jamais périmé (D1).
 */
export function useWeeklyReviewScheduler(): void {
  const { t } = useTranslation();
  const prefs = useNotificationPrefs();
  const { review, isLoading } = useWeeklyReview();

  const weeklyReview = prefs.weeklyReview;
  const weeklyReviewHour = prefs.weeklyReviewHour;
  const hasContent = !review.isEmpty;

  const apply = useCallback(async () => {
    // Tant que le bilan n'est pas résolu, on ne décide pas : on annulerait un rendez-vous valide
    // sur la base d'une semaine qui paraît vide seulement parce qu'elle n'est pas encore chargée.
    if (isLoading) return;

    const granted = await ensurePermissionAndChannel();
    if (!granted) {
      await cancelWeeklyReview();
      return;
    }

    const should = shouldScheduleWeeklyReview({
      enabled: weeklyReview,
      hasContent,
      prefs,
    });

    if (should) {
      await scheduleWeeklyReview(WEEKLY_REVIEW_WEEKDAY, weeklyReviewHour, {
        title: t('review.notification.title'),
        body: t('review.notification.body'),
      });
    } else {
      await cancelWeeklyReview();
    }
  }, [isLoading, weeklyReview, weeklyReviewHour, hasContent, prefs, t]);

  useEffect(() => {
    void apply();
  }, [apply]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void apply();
    });
    return () => sub.remove();
  }, [apply]);
}
