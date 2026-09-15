import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@powersync/react';
import {
  DEFAULT_SEGMENT_KIND,
  fingerprintStrengthProgram,
  resolveExerciseName,
  resolveProgramName,
  strengthProgramCandidateSchema,
  strengthProgramSourceSnapshotSchema,
  type StrengthProgramCandidate,
  type StrengthProgramSourceSnapshot,
} from '@wellness/shared';
import { useTranslation } from 'react-i18next';

import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';

export type StrengthProgramRecommendationCandidate = StrengthProgramCandidate & {
  sourceSnapshot: StrengthProgramSourceSnapshot;
  fingerprint: string;
};

export type StrengthProgramCandidateResult = {
  candidates: StrengthProgramRecommendationCandidate[];
  isLoading: boolean;
  error: Error | null;
};

type StrengthProgramReadResult = Pick<StrengthProgramCandidateResult, 'candidates' | 'error'>;

/**
 * Une seule requête réactive signale toute modification susceptible de changer un candidat.
 * Les agrégats ne servent pas à construire le résultat : ils forcent PowerSync à observer les
 * sept tables, puis `readStrengthProgramCandidates` relit l'ensemble dans un snapshot SQLite.
 */
export const SELECT_STRENGTH_PROGRAM_CANDIDATE_SIGNAL = `
  WITH eligible_programs AS (
    SELECT p.id, p.updated_at
    FROM programs p
    WHERE p.deleted_at IS NULL AND p.pillar = 'strength'
      AND (
        (p.owner_id IS NULL AND p.status = 'published')
        OR p.id = (
          SELECT personal.id
          FROM programs personal
          WHERE personal.owner_id = ? AND personal.pillar = 'strength'
            AND personal.is_active = 1 AND personal.deleted_at IS NULL
          ORDER BY personal.updated_at DESC, personal.id
          LIMIT 1
        )
      )
  )
  SELECT p.id,
         COALESCE(p.updated_at, '') || '|' ||
         (SELECT COUNT(*) || ':' || COALESCE(MAX(pt.updated_at), '')
            FROM program_translations pt WHERE pt.program_id = p.id) || '|' ||
         (SELECT COUNT(*) || ':' || COALESCE(MAX(s.updated_at), '')
            FROM sessions s WHERE s.program_id = p.id) || '|' ||
         (SELECT COUNT(*) || ':' || COALESCE(MAX(st.updated_at), '')
            FROM session_translations st
            JOIN sessions s ON s.id = st.session_id
           WHERE s.program_id = p.id) || '|' ||
         (SELECT COUNT(*) || ':' || COALESCE(MAX(ep.updated_at), '')
            FROM exercise_plans ep
            JOIN sessions s ON s.id = ep.session_id
           WHERE s.program_id = p.id) || '|' ||
         (SELECT COUNT(*) || ':' || COALESCE(MAX(si.updated_at), '')
            FROM session_intervals si
            JOIN sessions s ON s.id = si.session_id
           WHERE s.program_id = p.id) || '|' ||
         (SELECT COUNT(*) || ':' || COALESCE(MAX(e.updated_at), '')
            FROM exercises e
            JOIN exercise_plans ep ON ep.exercise_id = e.id
            JOIN sessions s ON s.id = ep.session_id
           WHERE s.program_id = p.id) || '|' ||
         (SELECT COUNT(*) || ':' || COALESCE(MAX(et.updated_at), '')
            FROM exercise_translations et
            JOIN exercise_plans ep ON ep.exercise_id = et.exercise_id
            JOIN sessions s ON s.id = ep.session_id
           WHERE s.program_id = p.id) AS signal
  FROM eligible_programs p
  ORDER BY p.id
`;

const ELIGIBLE_PROGRAM = `
  p.deleted_at IS NULL AND p.pillar = 'strength'
  AND (
    (p.owner_id IS NULL AND p.status = 'published')
    OR p.id = (
      SELECT personal.id
      FROM programs personal
      WHERE personal.owner_id = ? AND personal.pillar = 'strength'
        AND personal.is_active = 1 AND personal.deleted_at IS NULL
      ORDER BY personal.updated_at DESC, personal.id
      LIMIT 1
    )
  )
`;

type ProgramRow = {
  id: string;
  owner_id: string | null;
  pillar: string;
  is_active: number;
  level: string | null;
  goal: string | null;
  duration_weeks: number | null;
  target_time_seconds: number | null;
  event_name: string | null;
};

type ProgramTranslationRow = {
  program_id: string;
  lang: string;
  name: string;
  summary: string | null;
  description: string | null;
};

type SessionRow = {
  id: string;
  program_id: string;
  order_index: number;
  week_index: number | null;
  name: string | null;
  session_type: string | null;
  target_distance_m: number | null;
  target_duration_seconds: number | null;
  target_pace_min_s_per_km: number | null;
  target_pace_max_s_per_km: number | null;
  target_rpe: number | null;
  target_time_seconds: number | null;
  pacing_plan: string | null;
  description: string | null;
  instructions: string | null;
  adaptation_criterion: string | null;
};

type SessionTranslationRow = {
  session_id: string;
  lang: string;
  name: string | null;
  description: string | null;
  instructions: string | null;
};

type PlanRow = {
  id: string;
  program_id: string;
  session_id: string;
  exercise_id: string;
  order_index: number;
  set_type: string;
  target_sets: number | null;
  target_reps: string | null;
  target_weight_kg: number | null;
  rest_seconds: number | null;
  resolved_exercise_id: string | null;
  muscle_primary: string | null;
  muscles_secondary: string | null;
  muscles_fine: string | null;
  equipment: string | null;
};

type ExerciseTranslationRow = {
  exercise_id: string;
  lang: string;
  name: string;
};

type IntervalRow = {
  program_id: string;
  session_id: string;
  order_index: number;
  reps: number;
  fast_distance_m: number | null;
  fast_duration_seconds: number | null;
  fast_pace_pct_vma: number | null;
  recovery_distance_m: number | null;
  recovery_duration_seconds: number | null;
  kind: string | null;
  label: string | null;
  fast_pace_min_s_per_km: number | null;
  fast_pace_max_s_per_km: number | null;
  fast_target_time_min_seconds: number | null;
  fast_target_time_max_seconds: number | null;
  fast_pace_progressive: number | null;
  recovery_kind: string | null;
  recovery_pace_min_s_per_km: number | null;
  recovery_pace_max_s_per_km: number | null;
  group_key: string | null;
  group_reps: number | null;
};

const SELECT_PROGRAMS = `
  SELECT p.id, p.owner_id, p.pillar, p.is_active, p.level, p.goal, p.duration_weeks,
         p.target_time_seconds, p.event_name
  FROM programs p
  WHERE ${ELIGIBLE_PROGRAM}
  ORDER BY p.id
`;

const SELECT_PROGRAM_TRANSLATIONS = `
  SELECT pt.program_id, pt.lang, pt.name, pt.summary, pt.description
  FROM program_translations pt
  JOIN programs p ON p.id = pt.program_id
  WHERE ${ELIGIBLE_PROGRAM}
    AND pt.owner_id IS p.owner_id AND pt.deleted_at IS NULL
  ORDER BY pt.program_id, pt.lang, pt.id
`;

const SELECT_SESSIONS = `
  SELECT s.id, s.program_id, s.order_index, s.week_index, s.name, s.session_type,
         s.target_distance_m, s.target_duration_seconds,
         s.target_pace_min_s_per_km, s.target_pace_max_s_per_km, s.target_rpe,
         s.target_time_seconds, s.pacing_plan, s.description, s.instructions,
         s.adaptation_criterion
  FROM sessions s
  JOIN programs p ON p.id = s.program_id
  WHERE ${ELIGIBLE_PROGRAM}
    AND s.owner_id IS p.owner_id AND s.deleted_at IS NULL
  ORDER BY s.program_id, s.order_index, s.id
`;

const SELECT_SESSION_TRANSLATIONS = `
  SELECT st.session_id, st.lang, st.name, st.description, st.instructions
  FROM session_translations st
  JOIN sessions s ON s.id = st.session_id
  JOIN programs p ON p.id = s.program_id
  WHERE ${ELIGIBLE_PROGRAM}
    AND s.owner_id IS p.owner_id AND s.deleted_at IS NULL
    AND st.owner_id IS p.owner_id AND st.deleted_at IS NULL
  ORDER BY st.session_id, st.lang, st.id
`;

const SELECT_PLANS = `
  SELECT ep.id, s.program_id, ep.session_id, ep.exercise_id, ep.order_index, ep.set_type,
         ep.target_sets, ep.target_reps, ep.target_weight_kg, ep.rest_seconds,
         e.id AS resolved_exercise_id, e.muscle_primary, e.muscles_secondary,
         e.muscles_fine, e.equipment
  FROM exercise_plans ep
  JOIN sessions s ON s.id = ep.session_id
  JOIN programs p ON p.id = s.program_id
  LEFT JOIN exercises e ON e.id = ep.exercise_id AND e.deleted_at IS NULL
    AND (e.owner_id IS NULL OR e.owner_id = p.owner_id)
  WHERE ${ELIGIBLE_PROGRAM}
    AND s.owner_id IS p.owner_id AND s.deleted_at IS NULL
    AND ep.owner_id IS p.owner_id AND ep.deleted_at IS NULL
  ORDER BY s.program_id, s.order_index, ep.order_index, ep.id
`;

const SELECT_EXERCISE_TRANSLATIONS = `
  SELECT DISTINCT et.exercise_id, et.lang, et.name
  FROM exercise_translations et
  JOIN exercises e ON e.id = et.exercise_id AND e.deleted_at IS NULL
  JOIN exercise_plans ep ON ep.exercise_id = e.id AND ep.deleted_at IS NULL
  JOIN sessions s ON s.id = ep.session_id AND s.deleted_at IS NULL
  JOIN programs p ON p.id = s.program_id
  WHERE ${ELIGIBLE_PROGRAM}
    AND s.owner_id IS p.owner_id AND ep.owner_id IS p.owner_id
    AND (e.owner_id IS NULL OR e.owner_id = p.owner_id)
    AND et.owner_id IS e.owner_id AND et.deleted_at IS NULL
  ORDER BY et.exercise_id, et.lang, et.name
`;

const SELECT_INTERVALS = `
  SELECT s.program_id, si.session_id, si.order_index, si.reps,
         si.fast_distance_m, si.fast_duration_seconds, si.fast_pace_pct_vma,
         si.recovery_distance_m, si.recovery_duration_seconds, si.kind, si.label,
         si.fast_pace_min_s_per_km, si.fast_pace_max_s_per_km,
         si.fast_target_time_min_seconds, si.fast_target_time_max_seconds,
         si.fast_pace_progressive, si.recovery_kind,
         si.recovery_pace_min_s_per_km, si.recovery_pace_max_s_per_km,
         si.group_key, si.group_reps
  FROM session_intervals si
  JOIN sessions s ON s.id = si.session_id
  JOIN programs p ON p.id = s.program_id
  WHERE ${ELIGIBLE_PROGRAM}
    AND s.owner_id IS p.owner_id AND s.deleted_at IS NULL
    AND si.owner_id IS p.owner_id AND si.deleted_at IS NULL
  ORDER BY s.program_id, s.order_index, si.order_index, si.id
`;

function normalizeLanguage(language: string): string {
  return language.trim().toLowerCase().split('-')[0] || 'fr';
}

function groupBy<K, V>(values: readonly V[], keyOf: (value: V) => K): Map<K, V[]> {
  const grouped = new Map<K, V[]>();
  for (const value of values) {
    const key = keyOf(value);
    const group = grouped.get(key);
    if (group) group.push(value);
    else grouped.set(key, [value]);
  }
  return grouped;
}

function parseJson(value: string | null, field: string): unknown {
  if (value === null) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${field} contient un JSON invalide.`);
  }
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function buildCandidate(
  program: ProgramRow,
  language: string,
  programTranslations: readonly ProgramTranslationRow[],
  sessions: readonly SessionRow[],
  sessionTranslationsBySession: ReadonlyMap<string, SessionTranslationRow[]>,
  plansBySession: ReadonlyMap<string, PlanRow[]>,
  exerciseTranslationsByExercise: ReadonlyMap<string, ExerciseTranslationRow[]>,
  intervalsBySession: ReadonlyMap<string, IntervalRow[]>,
): StrengthProgramRecommendationCandidate {
  const programName = resolveProgramName(programTranslations, language);
  if (programName === undefined) {
    throw new Error('aucune traduction de programme disponible.');
  }

  const sourceSnapshot = strengthProgramSourceSnapshotSchema.parse({
    program: {
      pillar: program.pillar,
      level: program.level,
      goal: program.goal,
      durationWeeks: program.duration_weeks,
      targetTimeSeconds: program.target_time_seconds,
      eventName: program.event_name,
    },
    translations: programTranslations.map((translation) => ({
      lang: translation.lang,
      name: translation.name,
      summary: translation.summary,
      description: translation.description,
    })),
    sessions: sessions.map((session) => ({
      orderIndex: session.order_index,
      weekIndex: session.week_index,
      name: session.name,
      sessionType: session.session_type,
      targetDistanceM: session.target_distance_m,
      targetDurationSeconds: session.target_duration_seconds,
      targetPaceMinSPerKm: session.target_pace_min_s_per_km,
      targetPaceMaxSPerKm: session.target_pace_max_s_per_km,
      targetRpe: session.target_rpe,
      targetTimeSeconds: session.target_time_seconds,
      pacingPlan: parseJson(session.pacing_plan, `sessions.${session.id}.pacing_plan`),
      description: session.description,
      instructions: session.instructions,
      adaptationCriterion: session.adaptation_criterion,
      translations: (sessionTranslationsBySession.get(session.id) ?? []).map((translation) => ({
        lang: translation.lang,
        name: translation.name,
        description: translation.description,
        instructions: translation.instructions,
      })),
      plans: (plansBySession.get(session.id) ?? []).map((plan) => {
        if (plan.resolved_exercise_id === null) {
          throw new Error(`exercice ${plan.exercise_id} introuvable ou non autorisé.`);
        }
        return {
          exerciseId: plan.exercise_id,
          orderIndex: plan.order_index,
          setType: plan.set_type,
          targetSets: plan.target_sets,
          targetReps: plan.target_reps,
          targetWeightKg: plan.target_weight_kg,
          restSeconds: plan.rest_seconds,
        };
      }),
      intervals: (intervalsBySession.get(session.id) ?? []).map((interval) => ({
        orderIndex: interval.order_index,
        reps: interval.reps,
        fastDistanceM: interval.fast_distance_m,
        fastDurationSeconds: interval.fast_duration_seconds,
        fastPacePctVma: interval.fast_pace_pct_vma,
        recoveryDistanceM: interval.recovery_distance_m,
        recoveryDurationSeconds: interval.recovery_duration_seconds,
        kind: interval.kind ?? DEFAULT_SEGMENT_KIND,
        label: interval.label,
        fastPaceMinSPerKm: interval.fast_pace_min_s_per_km,
        fastPaceMaxSPerKm: interval.fast_pace_max_s_per_km,
        fastTargetTimeMinSeconds: interval.fast_target_time_min_seconds,
        fastTargetTimeMaxSeconds: interval.fast_target_time_max_seconds,
        fastPaceProgressive: (interval.fast_pace_progressive ?? 0) === 1,
        recoveryKind: interval.recovery_kind,
        recoveryPaceMinSPerKm: interval.recovery_pace_min_s_per_km,
        recoveryPaceMaxSPerKm: interval.recovery_pace_max_s_per_km,
        groupKey: interval.group_key,
        groupReps: interval.group_reps,
      })),
    })),
  });

  const candidate = strengthProgramCandidateSchema.parse({
    program: {
      id: program.id,
      name: programName,
      ownerId: program.owner_id,
      level: program.level,
      sessions: sessions.map((session) => {
        const translations = sessionTranslationsBySession.get(session.id) ?? [];
        const translatedName = resolveProgramName(
          translations.flatMap((translation) =>
            translation.name === null ? [] : [{ lang: translation.lang, name: translation.name }],
          ),
          language,
        );
        return {
          id: session.id,
          name: translatedName ?? session.name,
          plans: (plansBySession.get(session.id) ?? []).map((plan) => {
            if (plan.resolved_exercise_id === null) {
              throw new Error(`exercice ${plan.exercise_id} introuvable ou non autorisé.`);
            }
            const exerciseName = resolveExerciseName(
              exerciseTranslationsByExercise.get(plan.exercise_id) ?? [],
              language,
            );
            if (exerciseName === undefined) {
              throw new Error(`aucune traduction pour l'exercice ${plan.exercise_id}.`);
            }
            return {
              id: plan.id,
              exerciseId: plan.exercise_id,
              exerciseName,
              setType: plan.set_type,
              targetSets: plan.target_sets,
              musclePrimary: plan.muscle_primary,
              musclesSecondary: parseJson(
                plan.muscles_secondary,
                `exercises.${plan.exercise_id}.muscles_secondary`,
              ),
              musclesFine: parseJson(
                plan.muscles_fine,
                `exercises.${plan.exercise_id}.muscles_fine`,
              ),
              restSeconds: plan.rest_seconds,
              equipment: plan.equipment,
            };
          }),
        };
      }),
    },
    isCurrent: program.owner_id !== null && program.is_active === 1,
  });

  return {
    ...candidate,
    sourceSnapshot,
    fingerprint: fingerprintStrengthProgram(sourceSnapshot),
  };
}

export async function readStrengthProgramCandidates(
  userId: string | null,
  requestedLanguage: string,
): Promise<StrengthProgramReadResult> {
  const language = normalizeLanguage(requestedLanguage);
  const snapshot = await powerSync.readTransaction(async (tx) => {
    const params = [userId];
    const programs = await tx.getAll<ProgramRow>(SELECT_PROGRAMS, params);
    const programTranslations = await tx.getAll<ProgramTranslationRow>(
      SELECT_PROGRAM_TRANSLATIONS,
      params,
    );
    const sessions = await tx.getAll<SessionRow>(SELECT_SESSIONS, params);
    const sessionTranslations = await tx.getAll<SessionTranslationRow>(
      SELECT_SESSION_TRANSLATIONS,
      params,
    );
    const plans = await tx.getAll<PlanRow>(SELECT_PLANS, params);
    const exerciseTranslations = await tx.getAll<ExerciseTranslationRow>(
      SELECT_EXERCISE_TRANSLATIONS,
      params,
    );
    const intervals = await tx.getAll<IntervalRow>(SELECT_INTERVALS, params);
    return {
      programs,
      programTranslations,
      sessions,
      sessionTranslations,
      plans,
      exerciseTranslations,
      intervals,
    };
  });

  const programTranslationsByProgram = groupBy(
    snapshot.programTranslations,
    (translation) => translation.program_id,
  );
  const sessionsByProgram = groupBy(snapshot.sessions, (session) => session.program_id);
  const sessionTranslationsBySession = groupBy(
    snapshot.sessionTranslations,
    (translation) => translation.session_id,
  );
  const plansBySession = groupBy(snapshot.plans, (plan) => plan.session_id);
  const exerciseTranslationsByExercise = groupBy(
    snapshot.exerciseTranslations,
    (translation) => translation.exercise_id,
  );
  const intervalsBySession = groupBy(snapshot.intervals, (interval) => interval.session_id);

  const candidates: StrengthProgramRecommendationCandidate[] = [];
  const failures: string[] = [];
  for (const program of snapshot.programs) {
    try {
      candidates.push(
        buildCandidate(
          program,
          language,
          programTranslationsByProgram.get(program.id) ?? [],
          sessionsByProgram.get(program.id) ?? [],
          sessionTranslationsBySession,
          plansBySession,
          exerciseTranslationsByExercise,
          intervalsBySession,
        ),
      );
    } catch (error) {
      failures.push(`${program.id}: ${asError(error).message}`);
    }
  }

  return {
    candidates,
    error:
      failures.length === 0
        ? null
        : new Error(`Programmes de musculation incomplets (${failures.join(' | ')})`),
  };
}

export function useStrengthProgramCandidates(): StrengthProgramCandidateResult {
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const { i18n } = useTranslation();
  const { data, isLoading: signalLoading, error: signalError } = useQuery<{
    id: string;
    signal: string;
  }>(SELECT_STRENGTH_PROGRAM_CANDIDATE_SIGNAL, [userId]);
  const signal = useMemo(
    () => data.map((row) => `${row.id}:${row.signal}`).join('|'),
    [data],
  );
  const readKey = `${userId ?? ''}\u0000${i18n.language}\u0000${signal}`;
  const [state, setState] = useState<StrengthProgramReadResult & { readKey: string | null }>({
    readKey: null,
    candidates: [],
    error: null,
  });

  useEffect(() => {
    if (signalLoading || signalError) return;

    let active = true;
    void readStrengthProgramCandidates(userId, i18n.language)
      .then((result) => {
        if (active) setState({ ...result, readKey });
      })
      .catch((error: unknown) => {
        if (active) setState({ candidates: [], error: asError(error), readKey });
      });
    return () => {
      active = false;
    };
  }, [i18n.language, readKey, signalError, signalLoading, userId]);

  if (signalLoading) return { candidates: [], isLoading: true, error: null };
  if (signalError) return { candidates: [], isLoading: false, error: asError(signalError) };
  if (state.readKey !== readKey) return { candidates: [], isLoading: true, error: null };
  return { candidates: state.candidates, isLoading: false, error: state.error };
}
