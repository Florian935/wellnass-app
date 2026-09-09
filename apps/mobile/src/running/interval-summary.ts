/**
 * Résumé lecture seule d'un segment de séance (US RUN-F2c, roadmap 5.9, spec §6 ;
 * étendu par US RUN-F4, lots A/B/C/D).
 *
 * Composé en JS plutôt qu'avec des gabarits i18n exhaustifs : la combinatoire
 * (nature × allure × chrono × récup × groupe) explose, et une clé par cas serait
 * ingérable. On assemble donc des fragments traduits.
 *
 * Ce que RUN-F4 a rendu nécessaire : le résumé ne connaissait que `fastPacePctVma`.
 * Un segment d'échauffement, une allure absolue, un chrono cible ou un groupe
 * s'affichaient donc **comme s'ils n'existaient pas** — on saisissait « 8 × 400 m à
 * 4:05 » et la ligne rendait « 8 × 400 m ». Ça ne se lisait pas comme un manque,
 * ça se lisait comme une perte de donnée.
 */

import type { TFunction } from 'i18next';
import { formatMmSs, normalizePaceRange } from '@wellness/shared';
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

/**
 * Fragment d'intensité de la phase rapide : allure absolue > chrono cible > %VMA.
 *
 * Même ordre de priorité que `resolvePhasePace`, mais **sans le repli %VMA calculé** :
 * ici on affiche ce qui est ÉCRIT sur le segment, pas ce qu'on en déduirait avec le
 * profil du coureur — cette fonction ne le connaît pas, et une ligne de résumé n'est
 * pas l'endroit où faire une conversion silencieuse.
 */
function intensityFragment(t: TFunction, block: IntervalBlockItem): string | null {
  const pace = normalizePaceRange(block.fastPaceMinSPerKm, block.fastPaceMaxSPerKm);
  if (pace !== null) {
    return pace.minSPerKm === pace.maxSPerKm
      ? t('running.intervals.atPace', { pace: formatMmSs(pace.minSPerKm) })
      : t('running.intervals.atPaceRange', {
          min: formatMmSs(pace.minSPerKm),
          max: formatMmSs(pace.maxSPerKm),
        });
  }

  // Chrono cible : n'a de sens qu'avec une distance (« 400 m EN 1:38 »). Sur une phase
  // bornée en durée, il ferait doublon avec l'étendue.
  if (block.fastDistanceM != null) {
    const min = block.fastTargetTimeMinSeconds;
    const max = block.fastTargetTimeMaxSeconds;
    if (min != null && max != null && min !== max) {
      return t('running.intervals.inTimeRange', { min: formatMmSs(min), max: formatMmSs(max) });
    }
    const single = min ?? max;
    if (single != null) return t('running.intervals.inTime', { time: formatMmSs(single) });
  }

  if (block.fastPacePctVma != null) {
    return t('running.intervals.atPctVma', { pct: block.fastPacePctVma });
  }
  return null;
}

/**
 * Résumé d'un segment, ex. « Échauffement — 12 min », « 8 × 400 m en 1:38, récup 1.2 min »,
 * « 3 × (…) · 800 m à 4:00 ».
 */
export function formatIntervalBlockSummary(t: TFunction, block: IntervalBlockItem): string {
  const fastLabel = formatPhaseLabel(t, block.fastDistanceM, block.fastDurationSeconds);
  const hasRecovery = block.recoveryDistanceM != null || block.recoveryDurationSeconds != null;
  const recoveryLabel = hasRecovery
    ? formatPhaseLabel(t, block.recoveryDistanceM, block.recoveryDurationSeconds)
    : null;

  // Corps de séance = la nature par défaut : l'annoncer sur chaque ligne serait du bruit.
  // Les quatre autres natures, elles, changent la lecture et méritent d'être dites.
  const kindPrefix =
    block.kind !== 'work' ? t(`running.segmentKind.${block.kind}`) : null;

  // Répétitions : « 1 × » n'apporte rien (un échauffement se lit « Échauffement — 12 min »).
  const core =
    block.reps > 1
      ? t('running.intervals.repsTimes', { reps: block.reps, fastLabel })
      : fastLabel;

  const parts: string[] = [core];

  const intensity = intensityFragment(t, block);
  if (intensity) parts.push(intensity);

  if (recoveryLabel) {
    const recoveryKind = block.recoveryKind
      ? t(`running.recoveryKind.${block.recoveryKind}`).toLowerCase()
      : null;
    parts.push(
      recoveryKind
        ? t('running.intervals.recoveryWithKind', { recoveryLabel, kind: recoveryKind })
        : t('running.intervals.recovery', { recoveryLabel }),
    );
  }

  let line = parts.join(', ');
  if (kindPrefix) line = `${kindPrefix} — ${line}`;

  // Le groupe est annoncé en tête : c'est lui qui donne le vrai volume de la ligne.
  // `groupReps` sans `groupKey` est ignoré — le moteur l'ignore aussi (voir `groupRuns`),
  // et afficher « 3 × » sur un segment qui ne se répète pas serait un mensonge.
  if (block.groupKey != null && block.groupReps != null && block.groupReps > 1) {
    line = `${t('running.intervals.groupPrefix', { reps: block.groupReps })} ${line}`;
  }
  return line;
}
