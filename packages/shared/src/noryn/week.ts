/**
 * US NORYN-01 — `context/week` : la semaine, telle que Noryn la lit (spec §4.3). Ni nutrition, ni eau,
 * ni verdict : le contrat ne les met pas dans la semaine.
 *
 * Pur : aucune lecture d'horloge, aucune requête.
 */

import { MAX_DONE_PER_WEEK, type NorynWeek } from './contract';
import { stepGoalOf, stepsOn } from './day';
import { parisDayKey, weekKeysFrom } from './paris-date';
import { buildNorynSessions } from './sessions';
import {
  boundedInt,
  refPaceOf,
  sessionInputsFor,
  syncedAtOf,
  trackedDomains,
  type FinishedRow,
  type OwnerSnapshot,
} from './snapshot';

/** Les séances terminées dont le jour **à Paris** tombe dans la semaine — planifiées ou libres. */
function doneIn(rows: readonly FinishedRow[], keys: readonly string[]): number {
  const count = rows.filter((r) => r.finished_at !== null && keys.includes(parisDayKey(new Date(r.finished_at)))).length;
  return Math.min(count, MAX_DONE_PER_WEEK);
}

export function buildNorynWeek(snapshot: OwnerSnapshot, query: { start: string; now: Date }): NorynWeek {
  const { start, now } = query;
  const keys = weekKeysFrom(start);
  const syncedAt = syncedAtOf(snapshot.receivedAt, now);
  // Jamais synchronisé : aucun pas, aucune nuit, aucune séance, rien de fait (contrat).
  const synced = syncedAt !== null;
  const tracked = trackedDomains(snapshot.settings);

  const nights = synced
    ? keys
        .map((key) => boundedInt(snapshot.wellbeing.find((r) => r.log_date === key)?.sleep_minutes, 0, 840))
        .filter((minutes): minutes is number => minutes !== null)
    : [];

  return {
    start,
    generated_at: now.toISOString(),
    synced_at: syncedAt,
    steps: tracked.steps
      ? {
          daily_target: stepGoalOf(snapshot),
          days: keys.map((date) => ({ date, count: synced ? stepsOn(snapshot.steps, date) : null })),
        }
      : null,
    // D5 : le check-in est au socle, le sommeil est toujours suivi.
    sleep: {
      average_minutes:
        nights.length === 0 ? null : Math.round(nights.reduce((sum, m) => sum + m, 0) / nights.length),
      nights: nights.length,
    },
    training: synced
      ? {
          sessions: buildNorynSessions(sessionInputsFor(snapshot, keys), refPaceOf(snapshot)),
          done: { strength: doneIn(snapshot.workouts, keys), running: doneIn(snapshot.runs, keys) },
        }
      : { sessions: [], done: { strength: 0, running: 0 } },
  };
}
