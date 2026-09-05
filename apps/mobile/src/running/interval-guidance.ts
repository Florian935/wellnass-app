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
  buildIntervalDraft,
  expandIntervalPhases,
  formatPaceMMSS,
  resolvePhasePace,
  resyncIntervalPhase,
  type ExpandedIntervalPhase,
  type IntervalPhaseBlockInput,
} from '@wellness/shared';
import { advanceIntervalPhase, recordIntervalResult } from '@/data/repositories/run-repository';
import type { IntervalBlockItem } from '@/data/repositories/program-repository';

export function toPhaseBlockInput(block: IntervalBlockItem): IntervalPhaseBlockInput {
  return {
    reps: block.reps,
    fastDistanceM: block.fastDistanceM,
    fastDurationSeconds: block.fastDurationSeconds,
    fastPacePctVma: block.fastPacePctVma,
    recoveryDistanceM: block.recoveryDistanceM,
    recoveryDurationSeconds: block.recoveryDurationSeconds,
    // US RUN-F4 — nature, allures, chrono cible et imbrication descendent jusqu'au moteur.
    kind: block.kind,
    label: block.label,
    fastPaceMinSPerKm: block.fastPaceMinSPerKm,
    fastPaceMaxSPerKm: block.fastPaceMaxSPerKm,
    fastTargetTimeMinSeconds: block.fastTargetTimeMinSeconds,
    fastTargetTimeMaxSeconds: block.fastTargetTimeMaxSeconds,
    recoveryKind: block.recoveryKind,
    recoveryPaceMinSPerKm: block.recoveryPaceMinSPerKm,
    recoveryPaceMaxSPerKm: block.recoveryPaceMaxSPerKm,
    groupKey: block.groupKey,
    groupReps: block.groupReps,
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

/**
 * Annonce vocale du début d'une phase (spec §6).
 *
 * US RUN-F4 (lot A) : l'annonce dit désormais l'ALLURE quand la séance en porte une — c'est
 * l'information que le coureur attend au coup de sifflet (« 400 mètres à 4:05 »), et elle
 * n'existait pas. Ordre de repli : allure absolue → %VMA (RUN-F2c) → rien. On ne lit jamais
 * une allure inventée : sans consigne, la phrase reste celle d'avant.
 *
 * La nature du segment est annoncée pour l'échauffement, les gammes et le retour au calme
 * (lot B) : « échauffement, 12 minutes » est plus clair que « 12 minutes ».
 */
function announcePhase(
  t: TFunction,
  phase: ExpandedIntervalPhase,
  vmaPaceSPerKm: number | null,
): void {
  const amount = formatPhaseAmount(t, phase.distanceM, phase.durationSeconds);

  if (phase.kind === 'recovery') {
    Speech.speak(t('running.guidance.recoveryStart', { amount }));
    return;
  }

  // Échauffement / gammes / retour au calme : la nature prime sur la notion de « rapide ».
  if (phase.segmentKind !== 'work') {
    Speech.speak(
      t(`running.guidance.segmentStart.${phase.segmentKind}`, {
        amount,
        defaultValue: t('running.guidance.fastStart', { amount }),
      }),
    );
    return;
  }

  const resolved = resolvePhasePace(phase, vmaPaceSPerKm);
  if (resolved !== null && resolved.source !== 'derived') {
    Speech.speak(
      t('running.guidance.fastStartWithTargetPace', {
        amount,
        pace: formatPaceMMSS(Math.round(resolved.range.minSPerKm), '—'),
      }),
    );
    return;
  }
  Speech.speak(
    phase.fastPacePctVma != null
      ? t('running.guidance.fastStartWithPace', { amount, pct: phase.fastPacePctVma })
      : t('running.guidance.fastStart', { amount }),
  );
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
  /** US RUN-F4 — allure à 100 % VMA, pour résoudre le repli `%VMA`. `null` si pas de profil. */
  vmaPaceSPerKm?: number | null;
}): void {
  const { t } = useTranslation();
  const vmaPaceSPerKm = input.vmaPaceSPerKm ?? null;
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
      announcePhase(t, phases[0]!, vmaPaceSPerKm);
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

    // US RUN-F4 (lot F) — fige le RÉALISÉ de chaque phase franchie pendant ce resync.
    //
    // Une seule évaluation peut en franchir plusieurs d'un coup (écran non monté pendant tout
    // un rapide + sa récup) : on enregistre donc TOUTES les phases entre l'ancien et le nouvel
    // index, pas seulement la dernière — sinon le tableau du résumé aurait des trous là où le
    // coureur a le plus besoin de voir ce qui s'est passé.
    //
    // Le point de départ de chaque phase se reconstruit exactement comme `resyncIntervalPhase`
    // avance sa baseline : en ajoutant la cible de la phase, jamais en « snappant » sur la
    // valeur courante. Les deux calculs doivent rester d'accord.
    {
      // ⚠️ Une seule phase franchie = la mesure est exacte : l'axe que la phase ne borne pas se
      // lit directement entre sa baseline et MAINTENANT. Plusieurs phases d'un coup = cet axe
      // n'est PAS attribuable phase par phase (on connaît le total, pas la répartition), et on
      // l'écrit `null`. Une allure fausse dans le tableau serait pire qu'une case vide.
      const single = result.index - input.persistedPhaseIndex === 1;
      let startD = input.persistedPhaseStartDistanceM ?? 0;
      let startT = input.persistedPhaseStartDurationS ?? 0;

      for (let i = input.persistedPhaseIndex; i < result.index && i < phases.length; i += 1) {
        const phase = phases[i]!;
        const measuredD = single ? Math.max(0, input.distanceM - startD) : null;
        const measuredT = single ? Math.max(0, input.durationSeconds - startT) : null;

        void recordIntervalResult(input.runId, {
          ...buildIntervalDraft({
            phaseIndex: i,
            phase,
            actualDistanceM: phase.distanceM ?? measuredD,
            actualDurationSeconds: phase.durationSeconds ?? measuredT,
            plannedPace: resolvePhasePace(phase, vmaPaceSPerKm)?.range ?? null,
          }),
          blockId: input.blocks[phase.blockIndex]?.id ?? null,
        });

        // Même avancée de baseline que `resyncIntervalPhase` : on ajoute la cible de la phase,
        // jamais la valeur courante. Les deux calculs doivent rester d'accord.
        if (phase.distanceM != null) startD += phase.distanceM;
        else if (phase.durationSeconds != null) startT += phase.durationSeconds;
      }
    }

    // Rattrapage silencieux au premier calcul suivant un remontage (spec R8 bis) : la
    // persistance avance, mais aucune annonce/vibration pour des transitions déjà passées
    // pendant que l'écran n'était pas monté.
    if (isFirstEvaluationSinceMount) return;

    if (result.index < phases.length) {
      announcePhase(t, phases[result.index]!, vmaPaceSPerKm);
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
    // US RUN-F4 : lu dans l'effet pour retrouver le segment d'origine d'une phase
    // (`run_intervals.block_id`). Même identité que ce qui alimente `phases`, donc aucun
    // recalcul supplémentaire — mais la dépendance doit être déclarée.
    input.blocks,
    vmaPaceSPerKm,
    input.distanceM,
    input.durationSeconds,
    input.persistedPhaseIndex,
    input.persistedPhaseStartDistanceM,
    input.persistedPhaseStartDurationS,
    t,
  ]);
}
