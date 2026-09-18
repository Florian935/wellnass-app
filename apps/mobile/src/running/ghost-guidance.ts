/**
 * US FANT-01 (R6, R7) — l'annonce vocale du fantôme.
 *
 * Même architecture que RUN-F2a, RUN-F2d et RUN-F4 lot E, et pour la même raison (spec RUN-F2a R5) :
 * déclenchée depuis **l'écran de suivi**, jamais depuis la tâche de fond — on n'ajoute pas de lecture
 * audio hors contexte React dans le fichier le plus sensible du projet. Conséquence assumée et
 * identique aux trois précédentes : pas d'annonce écran éteint.
 *
 * Toute la décision (changement de statut, anti-répétition, silence sur le coude à coude et le
 * fantôme terminé) vit dans `run-ghost.ts`, pur et testé. Ce fichier ne fait que tenir l'état et
 * parler.
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as Speech from 'expo-speech';
import { shouldAnnounceGhost, type GhostGap, type GhostStatus } from '@wellness/shared';

import { useRunnerProfile } from '@/data/repositories/running-profile-repository';

export function useGhostGuidance(input: {
  gap: GhostGap | null;
  netSeconds: number;
  ghostDate: string | null;
}): void {
  const { t } = useTranslation();
  const { runnerProfile } = useRunnerProfile();
  const lastStatusRef = useRef<GhostStatus | null>(null);
  const lastAnnouncedAtRef = useRef<number | null>(null);

  // Le réglage existant du profil coureur commande : FANT-01 n'ajoute AUCUN interrupteur (spec R6).
  const enabled = runnerProfile?.voiceAnnouncementsEnabled === true;

  useEffect(() => {
    const { gap, netSeconds } = input;
    if (gap === null) return;

    // R7 — au montage de l'écran, on adopte le statut courant SANS parler : revenir sur l'écran ne
    // doit pas déclencher une annonce. C'est la même correction que RUN-F2a (initialisation depuis
    // la distance courante, pas depuis zéro).
    if (lastStatusRef.current === null) {
      lastStatusRef.current = gap.status;
      return;
    }

    const speak = shouldAnnounceGhost({
      status: gap.status,
      lastStatus: lastStatusRef.current,
      lastAnnouncedAtS: lastAnnouncedAtRef.current,
      netSeconds,
    });

    if (!speak) {
      // On mémorise quand même le statut : sinon un aller-retour devant/derrière pendant le délai
      // de silence resterait « en attente » et parlerait au mauvais moment.
      lastStatusRef.current = gap.status;
      return;
    }

    const previous = lastStatusRef.current;
    lastStatusRef.current = gap.status;
    lastAnnouncedAtRef.current = netSeconds;

    if (!enabled) return; // décision prise et mémorisée, mais rien n'est prononcé

    const key =
      gap.status === 'ahead'
        ? previous === 'behind'
          ? 'running.ghost.voice.passed'
          : 'running.ghost.voice.ahead'
        : previous === 'ahead'
          ? 'running.ghost.voice.overtaken'
          : 'running.ghost.voice.behind';

    Speech.speak(t(key, { meters: String(Math.abs(gap.meters)) }));
  }, [input, enabled, t]);
}
