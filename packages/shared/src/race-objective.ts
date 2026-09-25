/**
 * L'objectif chrono d'une course, face à ce que tu vaux aujourd'hui — US CARDIO-UX03, D8, R11 (Q9).
 *
 * Deux briques existaient sans se parler : l'objectif du programme (`programs.target_time_seconds`,
 * RUN-F4 lot H) et les prédictions de Riegel (RUN-14). On les met face à face, **sans verdict** : pas
 * de couleur, pas de « dans les temps » — un adulte lit deux chiffres.
 *
 * Même règle que « Si tu courais demain » (RUN-14 R3) : une vraie performance prime toujours sur une
 * estimation. Un record à la distance de la course est donc montré tel quel ; sinon, l'estimation
 * depuis le record 5 km.
 */

import { RUNNING_RECORD_DISTANCES, predictRaceTime, type RecordDistanceKey } from './pace-records';

const ESTIMATE_SOURCE: RecordDistanceKey = '5k';
const ESTIMATE_SOURCE_M = 5000;
/** Tolérance pour reconnaître une distance canonique saisie en mètres (21097 pour 21097,5). */
const DISTANCE_TOLERANCE_M = 1;

export type RaceObjective = {
  targetSeconds: number;
  /** Le chrono en face : ton record à cette distance, ou l'estimation du jour ; `null` si rien. */
  compareSeconds: number | null;
  compareKind: 'record' | 'estimate' | null;
};

export function raceObjective(input: {
  targetTimeSeconds: number | null;
  /** Distance de la course (la `target_distance_m` de la séance « course » du programme). */
  raceDistanceM: number | null;
  records: ReadonlyArray<{ distanceKey: RecordDistanceKey; bestTimeSeconds: number }>;
}): RaceObjective | null {
  const { targetTimeSeconds, raceDistanceM, records } = input;
  if (targetTimeSeconds == null || !(targetTimeSeconds > 0)) return null;

  const none: RaceObjective = { targetSeconds: targetTimeSeconds, compareSeconds: null, compareKind: null };
  if (raceDistanceM == null || !(raceDistanceM > 0)) return none;

  const canonical = RUNNING_RECORD_DISTANCES.find((d) => Math.abs(d.meters - raceDistanceM) <= DISTANCE_TOLERANCE_M);
  const exact = canonical ? records.find((r) => r.distanceKey === canonical.key) : undefined;
  if (exact) {
    return { targetSeconds: targetTimeSeconds, compareSeconds: exact.bestTimeSeconds, compareKind: 'record' };
  }

  const source = records.find((r) => r.distanceKey === ESTIMATE_SOURCE);
  if (!source) return none;
  return {
    targetSeconds: targetTimeSeconds,
    compareSeconds: Math.round(predictRaceTime(source.bestTimeSeconds, ESTIMATE_SOURCE_M, raceDistanceM)),
    compareKind: 'estimate',
  };
}
