/**
 * « Ton programme », sur le hub Course — US CARDIO-UX03, D8 et R11.
 *
 * Deux lectures locales pour le programme de course actif :
 *  - l'**avancement** : séances faites, total, semaine courante — la même forme que la requête du hub
 *    muscu (`SELECT_PROGRAM_PROGRESS`), recopiée ici plutôt qu'importée pour ne toucher aucun fichier
 *    de la muscu pendant que les deux chantiers avancent en parallèle (spec §11) ;
 *  - l'**échéance** : date de course, objectif chrono, nom de l'événement (RUN-F4 lot H), et la
 *    **distance de la course**, qui ne vit pas sur le programme mais sur sa séance de type « course »
 *    (`programs.target_time_seconds` est un chrono « sur la distance de la séance de course »,
 *    commentaire de la migration `20260905090004`).
 *
 * Aucune écriture, aucune colonne nouvelle.
 */

import { useQuery } from '@powersync/react';
import { resolveProgramProgress } from '@wellness/shared';
import { useAuthStore } from '@/stores/auth-store';

export const SELECT_RUN_PROGRAM_PROGRESS = `
  SELECT
    SUM(CASE WHEN ps.status = 'done' THEN 1 ELSE 0 END) AS done_count,
    COUNT(*) AS total_count,
    COALESCE(
      MIN(CASE WHEN ps.status = 'planned' THEN ps.week_index END),
      MAX(ps.week_index)
    ) AS current_week
  FROM planned_sessions ps
  WHERE ps.owner_id = ? AND ps.deleted_at IS NULL AND ps.program_id = ?
`;

/**
 * L'échéance du programme, et la distance de sa course : la séance de type `course` la plus tardive
 * (semaine la plus haute, puis dernière dans l'ordre) qui porte une distance (R11).
 */
export const SELECT_RUN_PROGRAM_RACE = `
  SELECT p.target_date, p.target_time_seconds, p.event_name,
    (SELECT s.target_distance_m FROM sessions s
      WHERE s.program_id = p.id AND s.deleted_at IS NULL
        AND s.session_type = 'course' AND s.target_distance_m IS NOT NULL
      ORDER BY COALESCE(s.week_index, -1) DESC, s.order_index DESC
      LIMIT 1) AS race_distance_m
  FROM programs p
  WHERE p.id = ? AND p.deleted_at IS NULL
  LIMIT 1
`;

type ProgressRow = { done_count: number | null; total_count: number | null; current_week: number | null };
type RaceRow = {
  target_date: string | null;
  target_time_seconds: number | null;
  event_name: string | null;
  race_distance_m: number | null;
};

export type RunProgramRace = {
  targetDate: string;
  targetTimeSeconds: number | null;
  eventName: string | null;
  raceDistanceM: number | null;
};

export type RunProgramData = {
  progress: ReturnType<typeof resolveProgramProgress>;
  /** `null` sans date de course : c'est le cas de la majorité des programmes (« Reprise en douceur »). */
  race: RunProgramRace | null;
};

/**
 * L'avancement et l'échéance du programme de course actif. Les deux requêtes tournent toujours (règle
 * des hooks) ; sans programme, l'identifiant vide ne ramène rien.
 */
export function useRunProgram(program: { id: string; durationWeeks: number | null } | null): RunProgramData {
  const userId = useAuthStore((s) => s.session?.user.id ?? '');
  const programId = program?.id ?? '';
  const { data: progressRows } = useQuery<ProgressRow>(SELECT_RUN_PROGRAM_PROGRESS, [userId, programId]);
  const { data: raceRows } = useQuery<RaceRow>(SELECT_RUN_PROGRAM_RACE, [programId]);

  const progressRow = progressRows[0];
  const raceRow = raceRows[0];

  return {
    progress:
      program && progressRow
        ? resolveProgramProgress({
            currentWeekIndex: progressRow.current_week,
            durationWeeks: program.durationWeeks,
            doneSessions: progressRow.done_count ?? 0,
            totalSessions: progressRow.total_count ?? 0,
          })
        : null,
    race:
      program && raceRow?.target_date
        ? {
            targetDate: raceRow.target_date,
            targetTimeSeconds: raceRow.target_time_seconds,
            eventName: raceRow.event_name,
            raceDistanceM: raceRow.race_distance_m,
          }
        : null,
  };
}
