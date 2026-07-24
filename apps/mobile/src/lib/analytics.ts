import { Platform } from 'react-native';
import * as Application from 'expo-application';

import { generateId } from '@/lib/id';
import { useAuthStore } from '@/stores/auth-store';
import { getAnalyticsEnabled } from '@/data/repositories/settings-repository';
import { insertAnalyticsEvent } from '@/data/repositories/analytics-repository';

// Allowlist stricte anti-PII : n'AJOUTER ici QUE des clés non identifiantes (jamais de donnée
// de santé/perso ni de texte libre). Toute clé absente est écartée par sanitizeProps.
export const ALLOWED_PROP_KEYS = ['pillar'] as const;

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
export async function track(eventName: string, props?: Record<string, unknown>): Promise<void> {
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
