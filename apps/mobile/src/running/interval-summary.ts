/**
 * Résumé lecture seule d'un bloc fractionné (US RUN-F2c, roadmap 5.9, spec §6).
 * Composé en JS plutôt qu'avec 4 gabarits i18n séparés pour la phase (distance vs
 * durée) : seule la combinaison pace/récup (2×2 = 4 cas) justifie des clés dédiées.
 */

import type { TFunction } from 'i18next';
import type { IntervalBlockItem } from '@/data/repositories/program-repository';

function formatPhaseLabel(
  t: TFunction,
  distanceM: number | null,
  durationSeconds: number | null,
): string {
  if (distanceM != null) {
    return t('running.intervals.distanceLabel', { value: distanceM });
  }
  if (durationSeconds != null) {
    const minutes = durationSeconds / 60;
    const value = Number.isInteger(minutes) ? minutes : Math.round(minutes * 10) / 10;
    return t('running.intervals.durationLabel', { value });
  }
  return '';
}

/** Résumé d'un bloc, ex. « 6 × 400 m à 95 % VMA, récup 200 m ». */
export function formatIntervalBlockSummary(t: TFunction, block: IntervalBlockItem): string {
  const fastLabel = formatPhaseLabel(t, block.fastDistanceM, block.fastDurationSeconds);
  const hasRecovery = block.recoveryDistanceM != null || block.recoveryDurationSeconds != null;
  const recoveryLabel = hasRecovery
    ? formatPhaseLabel(t, block.recoveryDistanceM, block.recoveryDurationSeconds)
    : null;
  const hasPace = block.fastPacePctVma != null;

  if (hasPace && hasRecovery) {
    return t('running.intervals.blockSummaryWithPaceWithRecovery', {
      reps: block.reps,
      fastLabel,
      pct: block.fastPacePctVma,
      recoveryLabel,
    });
  }
  if (hasPace) {
    return t('running.intervals.blockSummaryWithPaceNoRecovery', {
      reps: block.reps,
      fastLabel,
      pct: block.fastPacePctVma,
    });
  }
  if (hasRecovery) {
    return t('running.intervals.blockSummaryNoPaceWithRecovery', {
      reps: block.reps,
      fastLabel,
      recoveryLabel,
    });
  }
  return t('running.intervals.blockSummaryNoPaceNoRecovery', { reps: block.reps, fastLabel });
}
