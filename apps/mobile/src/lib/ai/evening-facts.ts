/**
 * US PRISME-01 — les faits du soir, assemblés à partir de ce que les repositories savent déjà.
 *
 * **Pur** : aucune base, aucun React (le hook `useEveningFacts` ne fait que rassembler les sources).
 * C'est ici que se décide ce qui figure sur la carte « Ta journée », donc ce qui peut partir chez le
 * fournisseur : la sortie est un `EveningFacts`, la liste blanche de `@wellness/shared` (spec R4).
 *
 * Ce qui n'entre **jamais**, et pourquoi on ne le reçoit même pas en entrée : le nom d'une séance
 * (texte saisi par l'utilisateur, on envoie son type), les notes, et tout ce qui vient du bien-être ou
 * de Health Connect (pas, nuit) — DD4, DD5.
 */

import { localDayKey, type EveningFacts, type EveningSession, type PrismeSessionType } from '@wellness/shared';

type Finished = { startedAt: string; finishedAt: string | null; durationSeconds: number | null };

export type EveningSources = {
  todayKey: string;
  tomorrowKey: string;
  dayLabel: string;
  workouts: readonly (Finished & { volumeKg: number; recordCount: number })[];
  runs: readonly (Finished & { distanceM: number | null; avgPaceSPerKm: number | null })[];
  /** Les autres activités **du jour** (AUTRE-01), déjà filtrées par la requête. */
  activities: readonly { durationSeconds: number }[];
  nutrition: {
    kcal: number;
    target: number | null;
    proteinG: number;
    proteinTarget: number | null;
    carbsG: number;
    /** Repas distincts saisis aujourd'hui. */
    meals: number;
  };
  /** Les séances planifiées **demain**, telles que le planning les rend. */
  plannedTomorrow: readonly {
    scheduledTime: string | null;
    pillar: string;
    targetDistanceM: number | null;
    status: string;
    orderIndex: number;
  }[];
  week: { done: number; goal: number | null };
  realLife: boolean;
  activePillars: { strength: boolean; running: boolean; nutrition: boolean };
};

/** Terminée aujourd'hui (jour **local** de fin). Une séance en cours n'est pas un fait de la journée. */
function finishedOn(item: Finished, dayKey: string): boolean {
  return item.finishedAt !== null && localDayKey(new Date(item.finishedAt)) === dayKey;
}

/** Durée en minutes ; à défaut de durée enregistrée, l'écart entre le début et la fin. */
function minutesOf(item: Finished): number {
  if (item.durationSeconds !== null) return Math.round(item.durationSeconds / 60);
  const ms = new Date(item.finishedAt ?? item.startedAt).getTime() - new Date(item.startedAt).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

const sessionTypeOf = (pillar: string): PrismeSessionType =>
  pillar === 'strength' ? 'strength' : pillar === 'running' ? 'run' : 'other';

export function assembleEveningFacts(sources: EveningSources): EveningFacts {
  const { todayKey, activePillars } = sources;
  const sessions: EveningSession[] = [];

  if (activePillars.strength) {
    for (const workout of sources.workouts) {
      if (!finishedOn(workout, todayKey)) continue;
      sessions.push({
        type: 'strength',
        minutes: minutesOf(workout),
        tonnageKg: workout.volumeKg,
        // L'historique ne porte pas les séries : on ne les dit pas, plutôt que d'écrire zéro.
        setsDone: null,
        setsPlanned: null,
        records: workout.recordCount,
      });
    }
  }

  if (activePillars.running) {
    for (const run of sources.runs) {
      if (!finishedOn(run, todayKey)) continue;
      sessions.push({
        type: 'run',
        minutes: minutesOf(run),
        distanceKm: (run.distanceM ?? 0) / 1000,
        paceSPerKm: run.avgPaceSPerKm,
      });
    }
  }

  for (const activity of sources.activities) {
    sessions.push({ type: 'other', minutes: Math.round(activity.durationSeconds / 60) });
  }

  const { nutrition } = sources;
  const plate =
    activePillars.nutrition && nutrition.meals > 0
      ? {
          kcal: Math.round(nutrition.kcal),
          targetKcal: nutrition.target,
          proteinG: Math.round(nutrition.proteinG),
          targetProteinG: nutrition.proteinTarget,
          carbsG: Math.round(nutrition.carbsG),
          meals: nutrition.meals,
        }
      : null;

  // La première séance **encore prévue** demain : par heure, puis par ordre du programme.
  const next = [...sources.plannedTomorrow]
    .filter((s) => s.status === 'planned')
    .sort((a, b) => (a.scheduledTime ?? '99').localeCompare(b.scheduledTime ?? '99') || a.orderIndex - b.orderIndex)[0];

  return {
    dayLabel: sources.dayLabel,
    sessions,
    plate,
    week: sources.week.goal !== null ? { done: sources.week.done, goal: sources.week.goal } : null,
    tomorrow: next
      ? {
          type: sessionTypeOf(next.pillar),
          time: next.scheduledTime ? next.scheduledTime.slice(0, 5) : null,
          distanceKm: next.targetDistanceM !== null ? next.targetDistanceM / 1000 : null,
        }
      : null,
    realLife: sources.realLife,
  };
}
