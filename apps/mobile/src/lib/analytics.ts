import { Platform } from 'react-native';
import * as Application from 'expo-application';

import { generateId } from '@/lib/id';
import { useAuthStore } from '@/stores/auth-store';
import { getAnalyticsEnabled } from '@/data/repositories/settings-repository';
import { insertAnalyticsEvent } from '@/data/repositories/analytics-repository';

// Allowlist stricte anti-PII : n'AJOUTER ici QUE des clés non identifiantes (jamais de donnée
// de santé/perso ni de texte libre). Toute clé absente est écartée par sanitizeProps.
export const ALLOWED_PROP_KEYS = ['pillar'] as const;

// Catalogue centralisé des noms d'événements (socle + adoption). Source unique pour éviter les
// fautes de frappe : n'appeler track() qu'avec ANALYTICS_EVENTS.xxx.
export const ANALYTICS_EVENTS = {
  appOpened: 'app_opened',
  onboardingStarted: 'onboarding_started',
  onboardingCompleted: 'onboarding_completed',
  onboardingSkipped: 'onboarding_skipped',
  pillarActivated: 'pillar_activated',
  workoutStarted: 'workout_started',
  workoutCompleted: 'workout_completed',
  runStarted: 'run_started',
  runCompleted: 'run_completed',
  foodLogged: 'food_logged',
  statsViewed: 'stats_viewed',
  dashboardCustomized: 'dashboard_customized',
  dataExported: 'data_exported',
  helpOpened: 'help_opened',
  bugReported: 'bug_reported',
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export type AnalyticsEventRow = {
  id: string;
  user_id: string;
  event_name: string;
  properties: string;
  app_version: string | null;
  platform: string;
  occurred_at: string;
  created_at: string;
};

/** Ne conserve que les clés autorisées et les valeurs scalaires. PUR. */
export function sanitizeProps(
  props?: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!props) return out;
  for (const key of ALLOWED_PROP_KEYS) {
    const v = props[key];
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[key] = v;
  }
  return out;
}

/** Assemble la ligne d'événement. PUR (valeurs impures injectées → déterministe/testable). */
export function buildEventRow(input: {
  id: string;
  userId: string;
  eventName: string;
  props?: Record<string, unknown>;
  appVersion: string | null;
  platform: string;
  occurredAt: string;
}): AnalyticsEventRow {
  return {
    id: input.id,
    user_id: input.userId,
    event_name: input.eventName,
    properties: JSON.stringify(sanitizeProps(input.props)),
    app_version: input.appVersion,
    platform: input.platform,
    occurred_at: input.occurredAt,
    // Offline-first : created_at = occurred_at (heure client réelle) plutôt que l'heure serveur de réception.
    created_at: input.occurredAt,
  };
}

/**
 * Capte un événement d'usage. Respecte le consentement (no-op si OFF / pas de session),
 * assainit les propriétés (anti-PII), écrit offline-first (PowerSync). NE JETTE JAMAIS.
 */
export async function track(
  eventName: AnalyticsEventName,
  props?: Record<string, unknown>,
): Promise<void> {
  try {
    const userId = useAuthStore.getState().session?.user.id;
    if (!userId) return;
    if (!(await getAnalyticsEnabled())) return;
    const row = buildEventRow({
      id: generateId(),
      userId,
      eventName,
      props,
      appVersion: Application.nativeApplicationVersion ?? null,
      platform: Platform.OS,
      occurredAt: new Date().toISOString(),
    });
    await insertAnalyticsEvent(row);
  } catch (err) {
    console.warn('[analytics] track échec:', err);
  }
}
