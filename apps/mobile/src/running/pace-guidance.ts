/**
 * US RUN-F4 (lot E) — alerte vocale d'écart à l'allure cible.
 * Réf. : docs/product/analyse-seances-structurees-running.md (mur M13)
 *
 * RUN-F2d annonce le **changement de phase** ; personne n'annonçait **l'écart à l'allure**. Le
 * plan analysé demande pourtant, pour sa séance de tempo, « un bloc de 20 min avec alerte
 * d'allure 4:20–4:25/km ».
 *
 * Même architecture que RUN-F2a et RUN-F2d, et pour la même raison (spec RUN-F2a R5) :
 * déclenché depuis l'écran de suivi, **jamais depuis la tâche de fond** — on n'ajoute pas de
 * lecture audio hors contexte React dans le fichier le plus sensible du projet. Conséquence
 * assumée et identique aux deux précédents : pas d'alerte si l'écran n'est pas monté.
 *
 * Toute la décision (verdict, anti-répétition, délai minimum) vit dans `run-pace-guidance.ts`,
 * pur et testé. Ce fichier ne fait que tenir l'état et parler.
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as Speech from 'expo-speech';
import {
  evaluatePace,
  formatPaceMMSS,
  shouldAnnouncePace,
  type PaceRange,
  type PaceVerdict,
} from '@wellness/shared';

export function usePaceGuidance(input: {
  enabled: boolean;
  /** Allure courante (s/km) — l'instantanée, c'est elle qu'on pilote. */
  currentPaceSPerKm: number | null;
  /** Plage cible du moment : celle du segment courant, sinon celle de la séance. */
  targetRange: PaceRange | null;
  /** Durée nette de la course (s) — sert de base de temps pour l'anti-répétition. */
  durationSeconds: number;
}): void {
  const { t } = useTranslation();
  const lastVerdictRef = useRef<PaceVerdict | null>(null);
  const lastAnnouncedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!input.enabled) return;

    const evaluation = evaluatePace(input.currentPaceSPerKm, input.targetRange);
    const elapsed =
      lastAnnouncedAtRef.current == null
        ? null
        : input.durationSeconds - lastAnnouncedAtRef.current;

    if (
      !shouldAnnouncePace({
        evaluation,
        lastAnnouncedVerdict: lastVerdictRef.current,
        elapsedSecondsSinceLastAnnounce: elapsed,
      })
    ) {
      // On mémorise quand même le retour dans la plage : sinon, après un « trop lent » suivi
      // d'une correction, un nouveau ralentissement ne serait jamais annoncé (le verdict
      // n'aurait pas « changé » depuis le dernier message).
      if (evaluation?.verdict === 'in_range') lastVerdictRef.current = 'in_range';
      return;
    }

    const delta = Math.abs(Math.round(evaluation!.deltaSPerKm));
    Speech.speak(
      t(
        evaluation!.verdict === 'too_fast'
          ? 'running.paceGuidance.tooFast'
          : 'running.paceGuidance.tooSlow',
        { delta, target: formatPaceMMSS(Math.round(input.targetRange!.minSPerKm), '—') },
      ),
    );
    lastVerdictRef.current = evaluation!.verdict;
    lastAnnouncedAtRef.current = input.durationSeconds;
  }, [input.enabled, input.currentPaceSPerKm, input.targetRange, input.durationSeconds, t]);
}
