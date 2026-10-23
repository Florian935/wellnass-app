/**
 * US CARDIO-02 (R10) — le test de 12 minutes, pendant la course : deux annonces, une interruption.
 *
 * Même architecture que RUN-F2a, RUN-F2d et FANT-01, et pour la même raison : déclenché depuis
 * **l'écran de suivi**, jamais depuis la tâche de fond. Conséquence assumée et identique : écran
 * éteint, pas d'annonce (la mesure, elle, se fait sur la trace à l'arrivée).
 *
 * ── Ce qui diffère des autres annonces ───────────────────────────────────────────────────────────
 * Elles parlent **même si les annonces vocales sont coupées** (D2) : le coureur a lancé un test guidé,
 * et un test qui finit en silence ne guide rien. Une pause avant 12:00 — y compris celle que pose
 * « Terminer », l'arrêt étant en deux temps — interrompt le test : il se court d'une traite.
 *
 * Toute la décision (phase, annonce à faire, silence au montage) vit dans `reference-pace.ts`, pur et
 * testé. Ce fichier ne fait que tenir l'état, marquer l'interruption, et parler.
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Vibration } from 'react-native';
import * as Speech from 'expo-speech';
import {
  COOPER_TEST,
  cooperCue,
  cooperPhase,
  cooperRemainingS,
  type CooperPhase,
} from '@wellness/shared';
import { useCooperMarker } from '@/running/cooper-measure';
import { useCooperTest } from '@/stores/cooper-test-store';

/** Une vibration longue et deux brèves : la fin se sent même casque sur les oreilles. */
const DONE_PATTERN = [0, 500, 200, 250, 150, 250];

export type CooperGuidance =
  | { active: false }
  | { active: true; phase: CooperPhase; remainingS: number };

export function useCooperGuidance(input: {
  runId: string | null;
  netSeconds: number;
  paused: boolean;
}): CooperGuidance {
  const { t } = useTranslation();
  const marker = useCooperMarker();
  const interrupt = useCooperTest((s) => s.interrupt);
  const { runId, netSeconds, paused } = input;

  const active = runId != null && marker?.runId === runId;
  const interrupted = marker?.interrupted === true;
  const phase = active ? cooperPhase(netSeconds, interrupted) : null;

  // R10 — une pause avant 12:00 interrompt le test de cette course.
  useEffect(() => {
    if (active && runId && paused && !interrupted && netSeconds < COOPER_TEST.durationS) interrupt(runId);
  }, [active, runId, paused, interrupted, netSeconds, interrupt]);

  // R10 — chaque passage annoncé une fois ; rien au montage (on adopte l'état sans parler).
  const lastPhase = useRef<CooperPhase | null>(null);
  useEffect(() => {
    if (phase === null) {
      lastPhase.current = null;
      return;
    }
    const cue = cooperCue(lastPhase.current, phase);
    lastPhase.current = phase;
    if (cue === 'lastMinute') {
      Vibration.vibrate();
      Speech.speak(t('running.cooper.voice.lastMinute'));
    } else if (cue === 'done') {
      Vibration.vibrate(DONE_PATTERN);
      Speech.speak(t('running.cooper.voice.done'));
    }
  }, [phase, t]);

  return phase === null ? { active: false } : { active: true, phase, remainingS: cooperRemainingS(netSeconds) };
}
