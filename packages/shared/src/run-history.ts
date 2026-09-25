/**
 * L'historique des sorties, en mois et en types — US CARDIO-UX03, R7 à R10.
 *
 * La grille du calendrier elle-même est celle de la muscu (`buildMonthGrid`, `monthRange` dans
 * `history-calendar.ts`, déjà agnostiques du pilier et réutilisées sans modification). Ce fichier
 * porte ce qui est propre à la course : le jour d'une sortie, le résumé d'un mois en distance et en
 * durée, et le regroupement « par type de séance ».
 */

import { localDayKey } from './date';
import { GHOST_MIN_DISTANCE_M } from './run-ghost';
import type { RunSource } from './running';
import type { ProgramSessionType } from './running-paces';

/** Le strict nécessaire d'une course de l'historique. */
export type RunHistoryLike = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  distanceM: number | null;
  durationSeconds: number | null;
  avgPaceSPerKm: number | null;
  sessionType: ProgramSessionType | null;
};

/** R8 — le jour **local** d'une sortie : sa fin, sinon son début (une sortie à cheval sur minuit est rangée au jour de fin). */
export function runDayKey(run: { startedAt: string; finishedAt: string | null }): string {
  return localDayKey(new Date(run.finishedAt ?? run.startedAt));
}

/**
 * R5 — une sortie peut-elle être recourue, c'est-à-dire servir de fantôme ? Même seuil que les
 * propositions de FANT-01 (`GHOST_MIN_DISTANCE_M`) : une trace GPS, et au moins 500 m. Une sortie
 * sans GPS n'a pas de trace à suivre ; en deçà de 500 m, la comparaison n'apprend rien.
 */
export function canRunAgain(run: { source: RunSource; distanceM: number | null }): boolean {
  return run.source === 'gps' && run.distanceM != null && run.distanceM >= GHOST_MIN_DISTANCE_M;
}

/**
 * R7 — nombre de records d'allure **détenus** par chaque course.
 *
 * `running_pace_records` est un palmarès (une ligne par distance, EFFORT-01) : une course dont le
 * record a été battu depuis n'y figure plus. On ne compte donc que ce qui tient encore.
 */
export function recordCountsByRun(recordRunIds: readonly (string | null | undefined)[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of recordRunIds) {
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** R9 — le résumé d'un mois : sorties, distance (m), durée (s) et records détenus. */
export function runMonthSummary(
  runs: readonly Pick<RunHistoryLike, 'id' | 'distanceM' | 'durationSeconds'>[],
  recordCounts: ReadonlyMap<string, number>,
): { count: number; distanceM: number; durationSeconds: number; records: number } {
  let distanceM = 0;
  let durationSeconds = 0;
  let records = 0;
  for (const r of runs) {
    distanceM += r.distanceM ?? 0;
    durationSeconds += r.durationSeconds ?? 0;
    records += recordCounts.get(r.id) ?? 0;
  }
  return { count: runs.length, distanceM, durationSeconds, records };
}

/** R10 — la clé « course libre », pour une course qui ne réalise aucune séance. */
export const RUN_FREE_TYPE = 'free' as const;
export type RunTypeKey = ProgramSessionType | typeof RUN_FREE_TYPE;

export function runTypeKey(sessionType: ProgramSessionType | null): RunTypeKey {
  return sessionType ?? RUN_FREE_TYPE;
}

export type RunTypeSummary = {
  type: RunTypeKey;
  count: number;
  lastRunId: string;
  lastDayKey: string;
  lastDistanceM: number | null;
  lastAvgPaceSPerKm: number | null;
  lastDurationSeconds: number | null;
};

/** R10 — un résumé par type de séance couru, du plus récemment couru au plus ancien. */
export function runTypeSummaries(runs: readonly RunHistoryLike[]): RunTypeSummary[] {
  const finished = runs
    .filter((r): r is RunHistoryLike & { finishedAt: string } => r.finishedAt != null)
    .slice()
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));

  const byType = new Map<RunTypeKey, RunTypeSummary>();
  for (const r of finished) {
    const type = runTypeKey(r.sessionType);
    const current = byType.get(type);
    if (current) {
      current.count += 1;
      continue;
    }
    byType.set(type, {
      type,
      count: 1,
      lastRunId: r.id,
      lastDayKey: runDayKey(r),
      lastDistanceM: r.distanceM,
      lastAvgPaceSPerKm: r.avgPaceSPerKm,
      lastDurationSeconds: r.durationSeconds,
    });
  }
  // L'ordre d'insertion suit déjà la date de dernière sortie, la plus récente d'abord.
  return [...byType.values()];
}
