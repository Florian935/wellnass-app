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
}

/**
 * Valeurs par défaut des préférences de notifications.
 *
 * Note : `reminderHour = 20` est **volontairement hors** de la fenêtre DND par
 * défaut `[22, 7)` — sinon le rappel serait systématiquement supprimé par le
 * filtre DND. Toute modification des défauts doit préserver cet invariant
 * (`!isWithinDnd(reminderHour, defaults)`).
 */
export function defaultNotificationPrefs(): NotificationPrefs {
  return {
    streakDanger: true,
    reminderHour: 20,
    dndEnabled: true,
    dndStartHour: 22,
    dndEndHour: 7,
    maxPerDay: 3,
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
