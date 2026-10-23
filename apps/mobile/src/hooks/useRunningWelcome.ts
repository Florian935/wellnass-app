/**
 * Ouvre l'accueil du pilier Course, une seule fois (US CARDIO-02, R14, R15, D4).
 *
 * ── Quand ────────────────────────────────────────────────────────────────────────────────────────
 * **Quand le hub a le focus**, pour un compte **sans profil coureur**, hors course en cours — et
 * seulement **en ligne, après une synchronisation terminée pendant ce lancement**
 * (`shouldOpenRunningWelcome`).
 *
 * - **Le focus** : l'onglet Course reste monté sous les autres onglets et sous les écrans empilés. Sans
 *   cette garde, la fin d'une course (`hasActiveRun` repasse à faux) ouvrait l'accueil par-dessus
 *   l'écran d'arrivée, et une synchro tardive par-dessus la Muscu (relecture du code, constat 1).
 * - **La synchro de ce lancement**, pas seulement « déjà synchronisé une fois » (`hasSynced`, mémorisé
 *   d'un lancement à l'autre) : un second téléphone synchronisé avant que le profil existe, rouvert
 *   hors ligne, écrirait une seconde ligne de profil. L'unicité de `user_id` la refuserait au serveur,
 *   et l'erreur bloquerait **toute** sa file d'envoi (relecture de la spec, constat 2). L'heure de
 *   lancement vient de `lib/app-launch` (`inlineRequires` : une constante de ce module aurait daté le
 *   premier affichage du hub, pas le lancement).
 * - **Une relecture de la table au moment d'ouvrir** : le statut annonce la synchro avant que la
 *   requête réactive du profil ait relu la ligne qu'elle a apportée (constat 3).
 *
 * ── Le marqueur ──────────────────────────────────────────────────────────────────────────────────
 * Une ligne de profil vide, écrite à l'ouverture : quitter l'accueil de n'importe quelle façon ne le
 * fait pas revenir, et la ligne se synchronise (aucune colonne neuve). Une garde de module empêche
 * une seconde ouverture pendant le même lancement, le temps que la ligne apparaisse.
 */

import { shouldOpenRunningWelcome } from '@wellness/shared';
import { useStatus } from '@powersync/react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useActiveRun } from '@/data/repositories/run-repository';
import {
  hasRunnerProfile,
  upsertRunnerProfile,
  useRunnerProfile,
} from '@/data/repositories/running-profile-repository';
import { appLaunchedAt } from '@/lib/app-launch';

let openedThisLaunch = false;

/** Réservé aux tests : rejoue « un nouveau lancement ». */
export function resetRunningWelcomeForTests(): void {
  openedThisLaunch = false;
}

export function useRunningWelcome(): void {
  const router = useRouter();
  const status = useStatus();
  const { runnerProfile, isLoading: profileLoading } = useRunnerProfile();
  const { run: activeRun, isLoading: activeLoading } = useActiveRun();

  const online = status.connected === true;
  const syncedThisLaunch = (status.lastSyncedAt?.getTime() ?? 0) >= appLaunchedAt();
  const hasProfile = runnerProfile != null;
  const hasActiveRun = activeRun != null;
  const loading = profileLoading || activeLoading;

  useFocusEffect(
    useCallback(() => {
      const open = shouldOpenRunningWelcome({
        online,
        syncedThisLaunch,
        profileLoading: loading,
        hasProfile,
        hasActiveRun,
        alreadyOpened: openedThisLaunch,
      });
      if (!open) return undefined;
      openedThisLaunch = true;

      let cancelled = false;
      void (async () => {
        try {
          if (await hasRunnerProfile()) return;
          if (cancelled) {
            // Le hub a perdu le focus pendant la relecture : on réessaiera au prochain focus.
            openedThisLaunch = false;
            return;
          }
          await upsertRunnerProfile({});
          router.push('/running-welcome');
        } catch (error: unknown) {
          console.warn('[useRunningWelcome] accueil non ouvert :', error);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [online, syncedThisLaunch, loading, hasProfile, hasActiveRun, router]),
  );
}
