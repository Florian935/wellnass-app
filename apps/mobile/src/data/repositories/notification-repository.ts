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

import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  buildRecordPushContent,
  canScheduleMore,
  decideProgrammedReminder,
  displayWeight,
  localDayKey,
  parseNotificationPrefs,
  shouldScheduleStreakReminder,
  shouldScheduleWeeklyReview,
  WEEKLY_REVIEW_WEEKDAY,
  // US HORAIRE-01 (roadmap 2.4) — convocation d'une séance à heure connue.
  computeSessionCallTime,
  SESSION_LEAD_MINUTES,
  type BeatenRecordSummary,
  type NotificationPrefs,
} from '@wellness/shared';
import {
  cancelReminder,
  cancelStreakReminder,
  cancelWeeklyReview,
  ensurePermissionAndChannel,
  MEAL_REMINDER_ID,
  presentNow,
  RECORD_PUSH_PREFIX,
  scheduleDatedReminder,
  scheduleStreakReminder,
  scheduleWeeklyReview,
  SESSION_REMINDER_ID,
  WEIGH_IN_REMINDER_ID,
} from '@/lib/notifications';
import i18n from '@/i18n';
import { useTodayKey } from '@/hooks/useTodayKey';
import { useNotificationQuota } from '@/stores/notification-quota-store';
import type { BeatenRecord } from './records-repository';
import {
  getNotificationPrefs,
  getUnitSystem,
  useSettings,
  updateSettings,
} from './settings-repository';
import { useStreakData } from './dashboard-repository';
import { useWeeklyReview } from './weekly-review-repository';
import {
  useHasPlannedStrengthSessionToday,
  usePlannedStrengthTimesToday,
  type PlannedSessionTime,
} from './planned-session-repository';
import {
  useMealDeadline,
  useMealLoggedToday,
  useSessionDeadline,
  useWeighInDeadline,
  useWeighInToday,
} from './reminder-habits-repository';

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

  // `apply` dépend explicitement des valeurs métier : il change à chaque
  // changement d'activité/prefs, ce qui déclenche la (re)planification via les
  // effets ci-dessous (et ré-abonne le listener AppState — inoffensif, l'id
  // stable garantit l'idempotence).
  // Les trois heures du « Ne pas déranger » ne sont plus listées à part : elles sont portées par
  // `prefs`, qui est désormais passé tel quel à la règle métier.
  const apply = useCallback(async () => {
    // Tant que l'activité du jour n'est pas résolue, on ne décide pas (évite
    // d'annuler puis replanifier sur des données incomplètes).
    if (isLoading) return;

    const granted = await ensurePermissionAndChannel();
    if (!granted) {
      // Permission refusée : rien à planifier (et rien en attente à garder).
      await cancelStreakReminder();
      return;
    }

    // `prefs` est déjà un `NotificationPrefs` complet : on le passe tel quel. Il était auparavant
    // recopié champ par champ dans un objet local — un patron qui cassait à chaque ajout de champ au
    // type, et qui a effectivement cassé quand NUTR-F1 en a ajouté cinq.
    const should = shouldScheduleStreakReminder({
      enabled: streakDanger,
      activeToday,
      nowHour: new Date().getHours(),
      reminderHour,
      prefs,
    });

    // NB (limite assumée MVP) : planification déclenchée UNIQUEMENT à l'ouverture /
    // au retour au premier plan (pas de tâche d'arrière-plan). Un rappel programmé
    // plus tôt aujourd'hui peut donc encore se déclencher même si l'utilisateur est
    // devenu actif alors que l'app était fermée : c'est toléré (simple rappel), et
    // `apply()` réévalue (annule si actif) au prochain passage au premier plan.
    // NB : `maxPerDay` n'est **volontairement pas** appliqué ICI — décision D3 de NUTR-F1, **soldée**
    // par D14 de MUSC-F8. Ce rappel (comme les 4 autres rappels programmés) est déjà borné à un par
    // jour par son identifiant stable : un compteur quotidien n'ajouterait aucune protection, et en
    // ferait perdre puisque `apply()` re-tourne à chaque retour au premier plan et qu'un type déjà
    // compté se verrait refuser sa re-planification. Le plafond s'applique en revanche bien aux
    // notifications **immédiates** (le push de record, `notification-quota-store.ts`) : celles-là
    // sont fire-and-forget, jamais réévaluées, donc comptables sans rien perdre. Deux mécanismes
    // distincts pour deux natures de notification différentes — volontaire, pas incohérent.
    if (should) {
      await scheduleStreakReminder(todayAtHour(reminderHour), {
        title: t('notifications.streakDanger.title'),
        body: t('notifications.streakDanger.body'),
      });
    } else {
      await cancelStreakReminder();
    }
  }, [isLoading, activeToday, streakDanger, reminderHour, prefs, t]);

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

// ---------------------------------------------------------------------------
// Planificateur des rappels programmés (NUTR-F1)
// ---------------------------------------------------------------------------

/**
 * Monte le planificateur des **rappels programmés** : journal alimentaire et pesée (US NUTR-F1).
 * À monter une fois, au même endroit que les deux planificateurs ci-dessus.
 *
 * ── Un seul hook pour les deux rappels ────────────────────────────────────────────────────────────
 * Un seul `apply()`, un seul abonnement `AppState`, une seule passe : les deux rappels partagent
 * exactement la même règle, seules changent la préférence, l'échéance et la source du « déjà fait ».
 *
 * ── Ce qui rend ces rappels rares, et donc supportables ───────────────────────────────────────────
 * L'échéance visée est le **p90** de l'heure du geste (décision D1), c'est-à-dire l'heure avant
 * laquelle l'utilisateur a d'habitude déjà fini. Un utilisateur régulier ne reçoit donc presque
 * jamais ces notifications. C'est le but : la première version de la spec visait l'heure *habituelle*
 * (médiane), ce qui aurait fait partir le rappel pendant que l'utilisateur faisait le geste, un jour
 * sur deux — et une notification déjà tirée ne s'annule pas.
 *
 * Même limite assumée que le rappel streak : sans ouverture de l'app dans la journée, pas de rappel
 * (pas de tâche d'arrière-plan).
 */
export function useProgrammedRemindersScheduler(): void {
  const { t } = useTranslation();
  const prefs = useNotificationPrefs();

  const meal = useMealDeadline(prefs);
  const weighIn = useWeighInDeadline(prefs);
  const mealDone = useMealLoggedToday();
  const weighInDone = useWeighInToday();
  // US MUSC-F8 : rappel de séance muscu. `doneToday` = « pas de séance planned pilier strength
  // aujourd'hui » — inversé par rapport aux deux autres (voir §2.3 de la spec, D16) : ce rappel
  // n'a de sens que s'il y a quelque chose au planning ; sans occurrence, il n'y a rien à faire.
  const session = useSessionDeadline(prefs);
  const todayKey = useTodayKey();
  const plannedSession = useHasPlannedStrengthSessionToday(todayKey);
  // US HORAIRE-01 (roadmap 2.4) — occurrences muscu du jour portant une heure, les plus tôt d'abord.
  // Leur présence fait basculer le rappel d'un régime d'ÉCHÉANCE (« la journée avance ») à un régime
  // de CONVOCATION (« ça commence dans 30 min »). Les deux sont exclusifs (règle R5).
  const plannedTimes = usePlannedStrengthTimesToday(todayKey);

  /**
   * Jeton de génération, pour qu'un `apply()` périmé ne ressuscite pas un rappel.
   *
   * `apply()` démarre par deux allers-retours natifs (`ensurePermissionAndChannel`), donc deux
   * invocations peuvent se chevaucher : A décide « planifier » sur un journal vide, l'utilisateur
   * ajoute un aliment, la requête surveillée réémet, B décide « annuler » — et si les promesses
   * natives ne se résolvent pas dans l'ordre de départ, le `schedule` de A s'exécute **après** le
   * `cancel` de B et le rappel revient alors que le journal est rempli.
   *
   * Ce hook est réveillé par **deux tables surveillées** (`food_entries`, `body_weight_entries`) :
   * chaque aliment ajouté déclenche un tour, donc le chevauchement n'est pas théorique.
   */
  const generation = useRef(0);

  const apply = useCallback(async () => {
    // Tant qu'une des six sources n'est pas résolue, on ne décide pas : on annulerait un rappel
    // valide sur la base d'un « déjà fait » qui n'est faux que parce qu'il n'est pas encore chargé.
    if (
      meal.isLoading ||
      weighIn.isLoading ||
      mealDone.isLoading ||
      weighInDone.isLoading ||
      session.isLoading ||
      plannedSession.isLoading ||
      plannedTimes.isLoading
    ) {
      return;
    }

    const gen = ++generation.current;

    const granted = await ensurePermissionAndChannel();
    if (gen !== generation.current) return;

    if (!granted) {
      await cancelReminder(MEAL_REMINDER_ID);
      await cancelReminder(WEIGH_IN_REMINDER_ID);
      await cancelReminder(SESSION_REMINDER_ID);
      return;
    }

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    /**
     * US HORAIRE-01 — convocation de la **prochaine** séance à heure connue, ou `null`.
     *
     * `find` et non `[0]` : la liste est triée par heure croissante, mais la première peut déjà être
     * passée (séance de 12 h consultée à 15 h). On prend donc la première dont la **convocation** est
     * encore à venir — c'est la décision D6 (« un seul rappel, pour la prochaine séance »), et R3
     * (« rien ne se programme dans le passé ») est portée par `computeSessionCallTime` elle-même.
     */
    const convocation = plannedTimes.sessions
      .map((s) => ({
        session: s,
        at: computeSessionCallTime({
          scheduledDate: todayKey,
          scheduledTime: s.scheduledTime,
          now,
        }),
      }))
      .find((c): c is { session: PlannedSessionTime; at: Date } => c.at !== null);

    const plan = [
      {
        id: MEAL_REMINDER_ID,
        enabled: prefs.mealReminder,
        doneToday: mealDone.done,
        deadline: meal,
        titleKey: 'notifications.mealReminder.title',
        bodyKey: 'notifications.mealReminder.body',
      },
      {
        id: WEIGH_IN_REMINDER_ID,
        enabled: prefs.weighInReminder,
        doneToday: weighInDone.done,
        deadline: weighIn,
        titleKey: 'notifications.weighInReminder.title',
        bodyKey: 'notifications.weighInReminder.body',
      },
      {
        id: SESSION_REMINDER_ID,
        enabled: prefs.sessionReminder,
        // « Rien à faire » couvre les deux cas à la fois : aucune séance planifiée aujourd'hui, ou
        // la séance planifiée a déjà été faite (`useHasPlannedStrengthSessionToday` filtre
        // `status = 'planned'` strictement — une séance faite n'y apparaît plus).
        doneToday: !plannedSession.hasPlanned,
        deadline: session,
        titleKey: 'notifications.sessionReminder.title',
        bodyKey: 'notifications.sessionReminder.body',
      },
    ] as const;

    for (const item of plan) {
      /**
       * 🔴 **Régime de CONVOCATION — il court-circuite l'échéance apprise, il ne s'y ajoute pas.**
       *
       * Le même identifiant (`SESSION_REMINDER_ID`) porte les deux régimes, et c'est ce qui garantit
       * **mécaniquement** la règle R5 : `scheduleDatedReminder` remplace tout rappel en attente sous
       * cet id, donc basculer de régime annule l'autre sans qu'on ait à y penser. Deux identifiants
       * distincts auraient permis deux notifications pour la même séance.
       *
       * La préférence `sessionReminder` et le « rien à faire » restent respectés (R6) : une nouvelle
       * raison de notifier n'est pas une dérogation aux réglages de l'utilisateur.
       */
      if (item.id === SESSION_REMINDER_ID && convocation !== undefined) {
        if (item.enabled && !item.doneToday) {
          await scheduleDatedReminder(item.id, convocation.at, {
            title: t('notifications.sessionSoon.title'),
            body: t('notifications.sessionSoon.body', {
              name: convocation.session.name ?? t('notifications.sessionSoon.fallbackName'),
              minutes: SESSION_LEAD_MINUTES,
            }),
          });
        } else {
          await cancelReminder(item.id);
        }
        if (gen !== generation.current) return;
        continue;
      }

      const decision = decideProgrammedReminder({
        enabled: item.enabled,
        doneToday: item.doneToday,
        nowMinutes,
        targetHour: item.deadline.hour,
        learned: item.deadline.learned,
        prefs,
      });

      if (decision.kind === 'schedule') {
        await scheduleDatedReminder(item.id, todayAtHour(decision.atHour), {
          title: t(item.titleKey),
          body: t(item.bodyKey),
        });
      } else {
        await cancelReminder(item.id);
      }

      // Une décision prise sur un état devenu obsolète ne doit pas continuer d'agir sur le second
      // rappel : `apply()` sera de toute façon rappelé avec les données fraîches.
      if (gen !== generation.current) return;
    }
  }, [prefs, meal, weighIn, mealDone, weighInDone, session, plannedSession, plannedTimes, todayKey, t]);

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

// ---------------------------------------------------------------------------
// Push de record (US MUSC-F8) — décisions D10, D11, D14
// ---------------------------------------------------------------------------

/**
 * Envoie, si les conditions sont réunies, **un seul** push agrégé pour les records battus par une
 * séance. Best-effort : appelée depuis `doFinish` (`workout.tsx`) dans le même `try/catch` que
 * `evaluateWorkoutRecords`, elle ne doit jamais faire échouer la navigation vers le résumé.
 *
 * ── Fonction de module, pas un hook ───────────────────────────────────────────────────────────────
 * `doFinish` est un callback d'événement, pas un rendu : les préférences et le système d'unités sont
 * donc lus via les accesseurs hors-hook de `settings-repository` (`getNotificationPrefs`,
 * `getUnitSystem`), pas via `useNotificationPrefs()`/`useUnits()`.
 *
 * `localDayKey(new Date())` est **correct ici**, et c'est le seul endroit de cette US où il l'est :
 * on est dans un callback, jamais mémoïsé par React Compiler (donc jamais dans un bloc
 * `memo_cache_sentinel`), pas dans un corps de rendu. Le garde-fou `no-frozen-clock` ne signale rien
 * ici parce que cette fonction n'est **jamais mémoïsée** — pas parce qu'il « ignorerait les closures ».
 *
 * ── Ordre des vérifications, et pourquoi il compte (D14) ──────────────────────────────────────────
 * La permission est vérifiée **avant** toute consommation de quota. Sans cet ordre, une permission
 * refusée consommerait quand même les 3 unités du jour sans qu'aucune notification ne s'affiche.
 * Et le quota n'est incrémenté que **si `presentNow` a renvoyé `true`** — jamais sur un échec.
 *
 * ── Identifiant par séance, pas stable (D10) ──────────────────────────────────────────────────────
 * `RECORD_PUSH_PREFIX + workoutId` : deux séances à record le même jour laissent deux traces
 * distinctes dans le tiroir. Un identifiant stable aurait fait remplacer la trace de la première
 * séance par la seconde — ce qui aurait détruit la valeur même invoquée par D11 (« la valeur du push
 * est la trace, pas l'information »).
 */
export async function maybePushRecords(
  workoutId: string,
  beaten: BeatenRecord[],
): Promise<void> {
  if (beaten.length === 0) return;

  const prefs = await getNotificationPrefs();
  if (!prefs.recordPush) return;

  const granted = await ensurePermissionAndChannel();
  if (!granted) return;

  const todayKey = localDayKey(new Date());
  await useNotificationQuota.getState().hydrate();
  const countToday = useNotificationQuota.getState().countFor(todayKey);
  if (!canScheduleMore(countToday, prefs)) return;

  const unitSystem = await getUnitSystem();
  const summaries: BeatenRecordSummary[] = beaten.map((record) => {
    const formatted = displayWeight(record.value, unitSystem);
    return {
      exerciseId: record.exerciseId,
      exerciseName: record.exerciseName,
      formattedValue:
        record.type === 'best_volume' ? String(record.value) : `${formatted.value} ${formatted.unit}`,
    };
  });

  const content = buildRecordPushContent(summaries);
  if (!content) return;

  const title = i18n.t(content.titleKey, content.titleParams);
  const body = i18n.t(content.bodyKey, content.bodyParams);

  const sent = await presentNow(RECORD_PUSH_PREFIX + workoutId, { title, body });
  if (sent) {
    useNotificationQuota.getState().recordSuccess(todayKey);
  }
}
