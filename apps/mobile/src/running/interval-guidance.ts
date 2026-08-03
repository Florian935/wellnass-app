/**
 * Guidage vocal + vibration à chaque changement de phase fractionné (US RUN-F2d, roadmap 5.18).
 *
 * Déclenché depuis l'écran de suivi (`run/active.tsx`), pas depuis la tâche de fond
 * (`tracker-task.ts`) — même décision qu'RUN-F2a (spec R5) : ne pas ajouter d'inconnue (lecture
 * audio + vibration hors contexte React) dans le fichier le plus sensible du projet. Conséquence
 * assumée : aucune annonce/vibration si l'écran n'est pas monté ; la progression réelle
 * (distance/durée) continue d'être trackée en arrière-plan, et un rattrapage silencieux (spec
 * R8 bis) réaligne la phase courante au remontage, sans rejouer les transitions manquées.
 */

import { useEffect, useMemo, useRef } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Vibration } from 'react-native';
import * as Speech from 'expo-speech';
import {
  expandIntervalPhases,
  resyncIntervalPhase,
  type ExpandedIntervalPhase,
  type IntervalPhaseBlockInput,
} from '@wellness/shared';
import { advanceIntervalPhase } from '@/data/repositories/run-repository';
import type { IntervalBlockItem } from '@/data/repositories/program-repository';

function toPhaseBlockInput(block: IntervalBlockItem): IntervalPhaseBlockInput {
  return {
    reps: block.reps,
    fastDistanceM: block.fastDistanceM,
    fastDurationSeconds: block.fastDurationSeconds,
    fastPacePctVma: block.fastPacePctVma,
    recoveryDistanceM: block.recoveryDistanceM,
    recoveryDurationSeconds: block.recoveryDurationSeconds,
  };
}

/**
 * Compose le fragment de quantité d'une phase (spec R6/R7) : distance en km entier si multiple
 * de 1000 m sinon en mètres (même règle qu'RUN-F2a R3 bis) ; durée en secondes sous 90 s, en
 * minutes arrondies au-delà — jamais un nombre décimal lu.
 */
function formatPhaseAmount(
  t: TFunction,
  distanceM: number | null,
  durationSeconds: number | null,
): string {
  if (distanceM != null) {
    return distanceM % 1000 === 0
      ? t('running.guidance.distanceKm', { count: distanceM / 1000 })
      : t('running.guidance.distanceM', { count: distanceM });
  }
  if (durationSeconds != null) {
    return durationSeconds < 90
      ? t('running.guidance.durationSeconds', { count: durationSeconds })
      : t('running.guidance.durationMinutes', { count: Math.round(durationSeconds / 60) });
  }
  return '';
}

/** Annonce vocale du début d'une phase (spec §6) — pas de fragment %VMA si absent (RUN-F2c R4). */
function announcePhase(t: TFunction, phase: ExpandedIntervalPhase): void {
  const amount = formatPhaseAmount(t, phase.distanceM, phase.durationSeconds);
  const phrase =
    phase.kind === 'fast'
      ? phase.fastPacePctVma != null
        ? t('running.guidance.fastStartWithPace', { amount, pct: phase.fastPacePctVma })
        : t('running.guidance.fastStart', { amount })
      : t('running.guidance.recoveryStart', { amount });
  Speech.speak(phrase);
}

/**
 * Détecte les changements de phase d'une séance fractionné en cours et déclenche annonce +
 * vibration (spec R1). `enabled` gate l'effet en interne (GPS + réglage + type de séance + au
 * moins un bloc, spec R2/R3/R4) — hook appelé inconditionnellement (règle des hooks), comme les
 * deux guidages précédents sur cet écran.
 */
export function useIntervalGuidance(input: {
  enabled: boolean;
  runId: string | null;
  blocks: IntervalBlockItem[];
  distanceM: number;
  durationSeconds: number;
  persistedPhaseIndex: number | null;
  persistedPhaseStartDistanceM: number | null;
  persistedPhaseStartDurationS: number | null;
}): void {
  const { t } = useTranslation();
  const phases = useMemo(
    () => expandIntervalPhases(input.blocks.map(toPhaseBlockInput)),
    [input.blocks],
  );
  // `false` à chaque (re)montage du composant appelant : le premier calcul suivant un remontage
  // est silencieux (rattrapage, spec R8 bis), les suivants annoncent normalement.
  const hasResyncedRef = useRef(false);

  useEffect(() => {
    if (!input.enabled || !input.runId || phases.length === 0) return;

    if (input.persistedPhaseIndex == null) {
      // Départ neuf (spec §1, R1) : ce n'est pas un rattrapage, c'est le tout premier
      // déclenchement — annoncé immédiatement, avant même le premier mètre parcouru.
      void advanceIntervalPhase(input.runId, {
        phaseIndex: 0,
        phaseStartDistanceM: input.distanceM,
        phaseStartDurationS: input.durationSeconds,
      });
      announcePhase(t, phases[0]!);
      Vibration.vibrate();
      hasResyncedRef.current = true;
      return;
    }

    const result = resyncIntervalPhase(
      phases,
      input.persistedPhaseIndex,
      input.distanceM,
      input.durationSeconds,
      input.persistedPhaseStartDistanceM ?? 0,
      input.persistedPhaseStartDurationS ?? 0,
    );

    const isFirstEvaluationSinceMount = !hasResyncedRef.current;
    hasResyncedRef.current = true;

    if (!result.advanced) return;

    void advanceIntervalPhase(input.runId, {
      phaseIndex: result.index,
      phaseStartDistanceM: result.phaseStartDistanceM,
      phaseStartDurationS: result.phaseStartDurationS,
    });

    // Rattrapage silencieux au premier calcul suivant un remontage (spec R8 bis) : la
    // persistance avance, mais aucune annonce/vibration pour des transitions déjà passées
    // pendant que l'écran n'était pas monté.
    if (isFirstEvaluationSinceMount) return;

    if (result.index < phases.length) {
      announcePhase(t, phases[result.index]!);
      Vibration.vibrate();
    } else {
      Speech.speak(t('running.guidance.sessionComplete'));
    }
    // Ré-exécuté à chaque changement de distance/durée (comme `useDistanceAnnouncements`) —
    // `resyncIntervalPhase` est un simple no-op tant qu'aucun nouveau seuil n'est franchi.
  }, [
    input.enabled,
    input.runId,
    phases,
    input.distanceM,
    input.durationSeconds,
    input.persistedPhaseIndex,
    input.persistedPhaseStartDistanceM,
    input.persistedPhaseStartDurationS,
    t,
  ]);
}
