/**
 * US DASH-01 (§7) — l'assistant IA est-il utilisable **maintenant** ?
 *
 * Trois conditions, et l'UI doit pouvoir dire laquelle manque : le consentement (opt-in explicite,
 * révocable), le réseau (la fonction Edge est le seul chemin), et le quota du jour. Le quota affiché
 * est **indicatif** : le compteur qui fait foi vit côté serveur, celui-ci sert à ne pas proposer un
 * geste qui échouera.
 */

import { useMemo } from 'react';
import { useStatus } from '@powersync/react';
import { AI_DAILY_QUOTA, type AiKind } from '@wellness/shared';
import { useSettings } from '@/data/repositories/settings-repository';

export type AiAvailability = {
  /** Consentement donné (et non révoqué). */
  consented: boolean;
  /** Prêt à appeler : consentement + réseau. */
  ready: boolean;
  online: boolean;
  /** Plafond quotidien du geste demandé, tel que le serveur l'applique. */
  quota: number;
};

export function useAiAvailability(kind: AiKind): AiAvailability {
  const { settings } = useSettings();
  // L'état de connexion PowerSync fait office de signal réseau : c'est déjà la source qu'affiche la
  // pastille de synchro, et en ajouter une seconde les ferait diverger à l'écran.
  const online = useStatus().connected;

  const consented = settings?.aiConsentAt != null;
  return useMemo(
    () => ({ consented, ready: consented && online, online, quota: AI_DAILY_QUOTA[kind] }),
    [consented, online, kind],
  );
}
