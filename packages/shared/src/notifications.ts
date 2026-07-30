/**
 * Préférences de notifications (local, offline-first) et helpers purs de
 * planification — US 2.6 (rappel streak), 2.8 (Ne pas déranger + max/jour),
 * 1.17 (gestion par type).
 *
 * Aucune dépendance native : toute la logique décidant *s'il faut* planifier
 * vit ici et est testée unitairement. La couche native (`apps/mobile/src/lib/
 * notifications.ts`) se contente d'exécuter la décision.
 *
 * Persistance : colonne `user_settings.notifications` (JSON TEXT, déjà
 * synchronisée). Le schéma a été **enrichi** d'un ancien `Record<string, boolean>`
 * vers cet objet typé — **sans migration** : `parseNotificationPrefs` est
 * tolérant et retombe sur les défauts pour toute valeur ancienne/invalide.
 */

/** Préférences de notifications d'un utilisateur. */
export interface NotificationPrefs {
  /** Rappel « série en danger » activé (défaut `true`). */
  streakDanger: boolean;
  /** Heure du rappel streak, 0-23 (défaut `20`). */
  reminderHour: number;
  /** « Ne pas déranger » activé (défaut `true`). */
  dndEnabled: boolean;
  /** Début de la fenêtre DND, 0-23 (défaut `22`). */
  dndStartHour: number;
  /** Fin de la fenêtre DND, 0-23 (défaut `7`). */
  dndEndHour: number;
  /** Plafond de notifications planifiées par jour (défaut `3`). */
  maxPerDay: number;
  /** Bilan hebdomadaire activé (défaut `true`) — US BILAN-01. */
  weeklyReview: boolean;
  /** Heure du bilan hebdomadaire, 0-23 (défaut `9`). Le jour est fixé au **lundi**. */
  weeklyReviewHour: number;
  /** Rappel de journal alimentaire activé (défaut `false`, **opt-in**) — US NUTR-F1. */
  mealReminder: boolean;
  /** Échéance du rappel de repas, 0-23 (défaut `13`). Sert de **repli** et de valeur manuelle. */
  mealReminderHour: number;
  /** Rappel de pesée activé (défaut `false`, **opt-in**) — US NUTR-F1. */
  weighInReminder: boolean;
  /** Échéance du rappel de pesée, 0-23 (défaut `10`). Sert de **repli** et de valeur manuelle. */
  weighInReminderHour: number;
  /**
   * Caler les rappels programmés sur les habitudes de l'utilisateur (défaut `true`) — US NUTR-F1.
   *
   * Global à la section : un seul concept, pas un réglage auto/manuel par rappel. Quand il est
   * actif, `mealReminderHour` / `weighInReminderHour` ne servent que de repli tant que l'historique
   * est insuffisant.
   */
  learnedHour: boolean;
}

/**
 * Valeurs par défaut des préférences de notifications.
 *
 * Note : les **quatre** heures par défaut (`reminderHour = 20`, `weeklyReviewHour = 9`,
 * `mealReminderHour = 13`, `weighInReminderHour = 10`) sont **volontairement hors** de la fenêtre
 * DND par défaut `[22, 7)` — sinon ces notifications seraient systématiquement supprimées par le
 * filtre DND. Toute modification des défauts doit préserver cet invariant, qui est **testé**.
 */
export function defaultNotificationPrefs(): NotificationPrefs {
  return {
    streakDanger: true,
    reminderHour: 20,
    dndEnabled: true,
    dndStartHour: 22,
    dndEndHour: 7,
    maxPerDay: 3,
    // Lundi 9 h : la semaine résumée est **close** (donc le bilan est définitif) et la décision
    // arrive au début de la semaine où elle s'applique — pas la veille au soir (BILAN-01, D5).
    weeklyReview: true,
    weeklyReviewHour: 9,
    // NUTR-F1 — **opt-in assumé.** L'app envoie aujourd'hui environ une notification par jour ;
    // activer ces deux rappels d'office pour les utilisateurs existants en triplerait le volume
    // sans qu'ils l'aient demandé. C'est le genre de mise à jour qui fait couper les notifications
    // au niveau système — on perdrait alors *aussi* le rappel streak.
    mealReminder: false,
    // Ce sont des **échéances**, pas des heures de geste : 13 h = « midi passé, rien de noté »,
    // 10 h = « la matinée est bien avancée, pas de pesée ». Cohérent avec le p90 appris (D1), donc
    // sans saut choquant quand l'apprentissage prend le relais au 5ᵉ jour.
    mealReminderHour: 13,
    weighInReminder: false,
    weighInReminderHour: 10,
    learnedHour: true,
  };
}

/** Borne un nombre entier d'heure dans [0, 23], sinon retourne `fallback`. */
function clampHour(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const h = Math.trunc(value);
  if (h < 0 || h > 23) return fallback;
  return h;
}

/** Retourne `value` si booléen, sinon `fallback`. */
function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Parse tolérant : accepte `null`, `{}`, l'ancien `Record<string, boolean>` ou
 * un objet partiel/malformé, et retourne des `NotificationPrefs` complètes.
 * Chaque champ retombe sur son défaut si absent ou invalide ; les heures sont
 * bornées à [0, 23] ; `maxPerDay` est borné à un entier >= 1.
 */
export function parseNotificationPrefs(raw: unknown): NotificationPrefs {
  const d = defaultNotificationPrefs();
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return d;
  }
  const obj = raw as Record<string, unknown>;

  const maxRaw = obj['maxPerDay'];
  const maxPerDay =
    typeof maxRaw === 'number' && Number.isFinite(maxRaw) && Math.trunc(maxRaw) >= 1
      ? Math.trunc(maxRaw)
      : d.maxPerDay;

  return {
    streakDanger: boolOr(obj['streakDanger'], d.streakDanger),
    reminderHour: clampHour(obj['reminderHour'], d.reminderHour),
    dndEnabled: boolOr(obj['dndEnabled'], d.dndEnabled),
    dndStartHour: clampHour(obj['dndStartHour'], d.dndStartHour),
    dndEndHour: clampHour(obj['dndEndHour'], d.dndEndHour),
    maxPerDay,
    weeklyReview: boolOr(obj['weeklyReview'], d.weeklyReview),
    weeklyReviewHour: clampHour(obj['weeklyReviewHour'], d.weeklyReviewHour),
    mealReminder: boolOr(obj['mealReminder'], d.mealReminder),
    mealReminderHour: clampHour(obj['mealReminderHour'], d.mealReminderHour),
    weighInReminder: boolOr(obj['weighInReminder'], d.weighInReminder),
    weighInReminderHour: clampHour(obj['weighInReminderHour'], d.weighInReminderHour),
    learnedHour: boolOr(obj['learnedHour'], d.learnedHour),
  };
}

/**
 * Vrai si `hour` (0-23) tombe dans la fenêtre « Ne pas déranger » `[start, end)`.
 *
 * - `dndEnabled === false` → toujours `false`.
 * - Fenêtre simple (`start < end`) → `start <= hour < end`.
 * - Fenêtre enjambant minuit (`start > end`, ex. 22→7) → `hour >= start || hour < end`.
 * - `start === end` → fenêtre vide → `false`.
 */
export function isWithinDnd(hour: number, prefs: NotificationPrefs): boolean {
  if (!prefs.dndEnabled) return false;
  const { dndStartHour: start, dndEndHour: end } = prefs;
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  // enjambe minuit
  return hour >= start || hour < end;
}

/** Arguments de la règle de planification du rappel streak (2.6). */
export interface StreakReminderInput {
  /** Rappel streak activé (`prefs.streakDanger`, passé explicitement). */
  enabled: boolean;
  /** L'utilisateur a-t-il été actif aujourd'hui ? */
  activeToday: boolean;
  /** Heure courante (0-23), pour ne pas planifier dans le passé. */
  nowHour: number;
  /** Heure de rappel visée (0-23, `prefs.reminderHour`). */
  reminderHour: number;
  /** Préférences (pour le filtre DND). */
  prefs: NotificationPrefs;
}

/**
 * Décide s'il faut planifier le rappel « série en danger » pour aujourd'hui.
 *
 * Vrai **uniquement si** : rappel activé ET pas encore actif aujourd'hui ET
 * l'heure de rappel n'est pas déjà passée (`nowHour < reminderHour`) ET le
 * créneau visé n'est pas en DND.
 */
export function shouldScheduleStreakReminder(input: StreakReminderInput): boolean {
  const { enabled, activeToday, nowHour, reminderHour, prefs } = input;
  return (
    enabled &&
    !activeToday &&
    nowHour < reminderHour &&
    !isWithinDnd(reminderHour, prefs)
  );
}

/** Vrai s'il reste de la place sous le plafond quotidien (`< maxPerDay`). */
export function canScheduleMore(countToday: number, prefs: NotificationPrefs): boolean {
  return countToday < prefs.maxPerDay;
}

/**
 * Jour du bilan hebdomadaire au format `expo-notifications` : **lundi**.
 *
 * ⚠️ La convention du SDK 57 est `1 = dimanche` … `7 = samedi` — donc lundi vaut **2**, et non 1
 * comme le voudrait l'intuition (ni 0 comme `weekdayIndex` côté projet). Constante nommée pour que
 * l'erreur ne puisse pas se glisser dans un appel.
 */
export const WEEKLY_REVIEW_WEEKDAY = 2;

/** Arguments de la règle de planification du bilan hebdomadaire (BILAN-01). */
export interface WeeklyReviewScheduleInput {
  /** Bilan activé (`prefs.weeklyReview`). */
  enabled: boolean;
  /** Y a-t-il quelque chose à dire ? Faux si la semaine close est vide (décision D4). */
  hasContent: boolean;
  /** Préférences (heure visée + filtre DND). */
  prefs: NotificationPrefs;
}

/**
 * Décide s'il faut maintenir le rendez-vous hebdomadaire du bilan.
 *
 * Vrai **uniquement si** : activé ET la semaine close a quelque chose à dire ET l'heure visée n'est
 * pas en DND.
 *
 * La condition `hasContent` est ce qui implémente la décision D4 : **pas de notification pour une
 * semaine vide.** Une notification qui dit « tu n'as rien fait » est punitive, et c'est le genre de
 * message qui fait désinstaller. Comme le contenu ne peut pas être connu à l'avance, l'appelant
 * réévalue cette règle **à chaque ouverture de l'app** et annule le rendez-vous si elle devient
 * fausse.
 */
export function shouldScheduleWeeklyReview(input: WeeklyReviewScheduleInput): boolean {
  const { enabled, hasContent, prefs } = input;
  return enabled && hasContent && !isWithinDnd(prefs.weeklyReviewHour, prefs);
}

/* ────────────────────────────────────────────────────────────────────────────────────────────────
 * Rappels programmés — US NUTR-F1 (journal alimentaire, pesée)
 * ──────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Ramène `hour` **hors** de la fenêtre « Ne pas déranger », en la rabattant sur le bord le plus
 * proche : soit `dndEndHour` (l'heure où le DND se lève), soit `dndStartHour - 1` (la dernière heure
 * avant qu'il commence). **Égalité de distance → vers l'arrière** : mieux vaut rappeler un peu tôt
 * le soir même que le lendemain matin, quand le geste n'a plus de sens.
 *
 * Retourne `hour` inchangée si elle est déjà hors fenêtre, si le DND est désactivé, ou si la fenêtre
 * est vide (`dndStartHour === dndEndHour`).
 *
 * Les deux bords candidats sont **toujours** hors de la fenêtre `[start, end)` dès que
 * `start !== end` : `end` en est exclu par construction (borne haute ouverte), et `start - 1` la
 * précède. Un test de propriété le vérifie sur les 24 heures.
 *
 * ⚠️ **À n'appliquer QUE sur une heure apprise.** Réécrire en douce le 23 h qu'un utilisateur a
 * composé au stepper reproduirait le « pourquoi cette heure-là ? » qu'on cherche à éliminer : une
 * heure réglée à la main et tombant en DND est **supprimée**, avec un avertissement à l'écran
 * (décisions D5 et D6).
 */
export function clampOutOfDnd(hour: number, prefs: NotificationPrefs): number {
  if (!isWithinDnd(hour, prefs)) return hour;

  const { dndStartHour: start, dndEndHour: end } = prefs;
  const forward = end;
  const backward = (start + 23) % 24;

  const distForward = (forward - hour + 24) % 24;
  const distBackward = (hour - backward + 24) % 24;

  return distBackward <= distForward ? backward : forward;
}

/**
 * Délai minimal entre l'instant de la décision et l'échéance visée, en minutes.
 *
 * ── Pourquoi cette marge existe ───────────────────────────────────────────────────────────────────
 * La décision est prise **à l'ouverture de l'app**, donc l'app est au premier plan — et le handler de
 * notification affiche la bannière même au premier plan. Sans marge, ouvrir l'app à 12 h 59 avec une
 * échéance à 13 h ferait arriver « ton journal est encore vide » **60 secondes plus tard, pendant que
 * l'utilisateur le remplit**.
 *
 * C'est mot pour mot le scénario qui a fait écarter la fenêtre de rattrapage (décision D7) : celle-ci
 * couvrait le cas « échéance juste dépassée », et la même absurdité existait, symétrique, juste
 * **avant** l'échéance. Trouvé en revue avant livraison.
 */
export const REMINDER_MIN_LEAD_MINUTES = 15;

/** Arguments de la règle de planification d'un rappel programmé (NUTR-F1). */
export interface ProgrammedReminderInput {
  /** Ce rappel est-il activé dans les réglages ? */
  enabled: boolean;
  /** Le geste est-il déjà fait aujourd'hui (repas loggé / pesée saisie) ? */
  doneToday: boolean;
  /** Minutes écoulées depuis minuit local (`h * 60 + min`). */
  nowMinutes: number;
  /**
   * Échéance visée (0-23) : soit apprise **et déjà rabattue** par `clampOutOfDnd`, soit réglée à la
   * main et prise telle quelle.
   */
  targetHour: number;
  /**
   * L'échéance vient-elle de l'apprentissage ? Décide de la politique DND : une heure apprise a
   * déjà été rabattue en amont, une heure manuelle doit être respectée — donc supprimée si elle
   * tombe en DND (D6).
   */
  learned: boolean;
  /** Préférences (fenêtre DND). */
  prefs: NotificationPrefs;
  /** Marge minimale avant l'échéance, en minutes. Défaut `REMINDER_MIN_LEAD_MINUTES`. */
  minLeadMinutes?: number;
}

/**
 * Décision de planification d'un rappel programmé.
 *
 * Union discriminée plutôt qu'un booléen (le patron de `shouldScheduleStreakReminder`) : chaque
 * refus est ainsi testable **nommément** et exploitable en diagnostic pendant la recette.
 */
export type ReminderDecision =
  | { kind: 'schedule'; atHour: number }
  | { kind: 'skip'; reason: 'disabled' | 'done' | 'passed' | 'imminent' | 'dnd' };

/**
 * Décide s'il faut planifier un rappel programmé aujourd'hui.
 *
 * Ordre d'évaluation : `disabled` → `done` → `dnd` (heures manuelles seulement) → `passed` →
 * `imminent` → planifie.
 *
 * **Échéance dépassée = pas de rappel aujourd'hui**, sans fenêtre de rattrapage (décision D7). Le
 * backlog prévoyait une tolérance de 30 min pour le doze mode ; elle a été écartée parce que
 * l'évaluation a lieu **à l'ouverture de l'app** : rattraper aurait notifié l'utilisateur pendant
 * qu'il est dans l'app. Et si l'échéance est passée, c'est précisément qu'il a ouvert l'app — il n'a
 * pas besoin d'une notification l'invitant à l'ouvrir.
 *
 * **Échéance trop proche = pas de rappel non plus** (`imminent`, voir `REMINDER_MIN_LEAD_MINUTES`).
 * `passed` et `imminent` sont distingués parce qu'ils ne se diagnostiquent pas pareil en recette :
 * l'un dit « trop tard », l'autre « tu es déjà là ».
 */
export function decideProgrammedReminder(input: ProgrammedReminderInput): ReminderDecision {
  const {
    enabled,
    doneToday,
    nowMinutes,
    targetHour,
    learned,
    prefs,
    minLeadMinutes = REMINDER_MIN_LEAD_MINUTES,
  } = input;

  if (!enabled) return { kind: 'skip', reason: 'disabled' };
  if (doneToday) return { kind: 'skip', reason: 'done' };
  if (!learned && isWithinDnd(targetHour, prefs)) return { kind: 'skip', reason: 'dnd' };

  const targetMinutes = targetHour * 60;
  if (nowMinutes >= targetMinutes) return { kind: 'skip', reason: 'passed' };
  if (targetMinutes - nowMinutes < minLeadMinutes) return { kind: 'skip', reason: 'imminent' };

  return { kind: 'schedule', atHour: targetHour };
}
