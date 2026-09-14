import { useQuery } from '@powersync/react';
import {
  muscleGroupSchema,
  normalizeFineMuscles,
  parseJsonColumn,
  setTypeSchema,
  type BodyTrainingProgram,
} from '@wellness/shared';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '@/stores/auth-store';

/** Une seule lecture cohérente, y compris pour un programme ou une séance vide.
 * Paramètres : compte courant, langue courante (fr/en).
 */
export const SELECT_BODY_TRAINING_PROGRAM = `
  WITH context AS (SELECT ? AS user_id, ? AS lang),
  active_program AS (
    SELECT p.* FROM programs p, context c
    WHERE p.owner_id = c.user_id AND p.pillar = 'strength'
      AND p.is_active = 1 AND p.deleted_at IS NULL
    ORDER BY p.updated_at DESC, p.id
    LIMIT 1
  )
  SELECT p.id AS program_id, p.owner_id AS program_owner_id,
    COALESCE(pt.name, pt_fr.name, '') AS program_name,
    s.id AS session_id, COALESCE(st.name, st_fr.name, s.name) AS session_name,
    ep.id AS plan_id, ep.exercise_id, ep.set_type, ep.target_sets,
    COALESCE(et.name, et_fr.name, '') AS exercise_name,
    e.muscle_primary, e.muscles_secondary, e.muscles_fine
  FROM active_program p CROSS JOIN context c
  LEFT JOIN program_translations pt ON pt.program_id = p.id AND pt.lang = c.lang
    AND pt.owner_id = p.owner_id AND pt.deleted_at IS NULL
  LEFT JOIN program_translations pt_fr ON pt_fr.program_id = p.id AND pt_fr.lang = 'fr'
    AND pt_fr.owner_id = p.owner_id AND pt_fr.deleted_at IS NULL
  LEFT JOIN sessions s ON s.program_id = p.id AND s.owner_id = p.owner_id
    AND s.deleted_at IS NULL
  LEFT JOIN session_translations st ON st.session_id = s.id AND st.lang = c.lang
    AND st.owner_id = p.owner_id AND st.deleted_at IS NULL
  LEFT JOIN session_translations st_fr ON st_fr.session_id = s.id AND st_fr.lang = 'fr'
    AND st_fr.owner_id = p.owner_id AND st_fr.deleted_at IS NULL
  LEFT JOIN exercise_plans ep ON ep.session_id = s.id AND ep.owner_id = p.owner_id
    AND ep.deleted_at IS NULL
  LEFT JOIN exercises e ON e.id = ep.exercise_id AND e.deleted_at IS NULL
    AND (e.owner_id IS NULL OR e.owner_id = p.owner_id)
  LEFT JOIN exercise_translations et ON et.exercise_id = e.id AND et.lang = c.lang
    AND et.owner_id IS e.owner_id AND et.deleted_at IS NULL
  LEFT JOIN exercise_translations et_fr ON et_fr.exercise_id = e.id AND et_fr.lang = 'fr'
    AND et_fr.owner_id IS e.owner_id AND et_fr.deleted_at IS NULL
  ORDER BY s.order_index, s.id, ep.order_index, ep.id
`;

type BodyTrainingProgramRow = {
  program_id: string;
  program_owner_id: string;
  program_name: string;
  session_id: string | null;
  session_name: string | null;
  plan_id: string | null;
  exercise_id: string | null;
  exercise_name: string;
  set_type: string | null;
  target_sets: number | null;
  muscle_primary: string | null;
  muscles_secondary: string | null;
  muscles_fine: string | null;
};

function mapProgram(rows: BodyTrainingProgramRow[]): BodyTrainingProgram | null {
  const first = rows[0];
  if (!first) return null;
  const program: BodyTrainingProgram = { id: first.program_id, name: first.program_name, sessions: [] };
  const sessions = new Map<string, BodyTrainingProgram['sessions'][number]>();
  for (const row of rows) {
    if (row.session_id === null) continue;
    let session = sessions.get(row.session_id);
    if (!session) {
      session = { id: row.session_id, name: row.session_name, plans: [] };
      sessions.set(row.session_id, session);
      program.sessions.push(session);
    }
    if (row.plan_id === null || row.exercise_id === null) continue;
    const primary = muscleGroupSchema.safeParse(row.muscle_primary);
    const setType = setTypeSchema.safeParse(row.set_type);
    const secondaryRaw = parseJsonColumn<unknown>(row.muscles_secondary, []);
    const secondary = Array.isArray(secondaryRaw)
      ? secondaryRaw.flatMap((value) => {
          const parsed = muscleGroupSchema.safeParse(value);
          return parsed.success && parsed.data !== (primary.success ? primary.data : null)
            ? [parsed.data]
            : [];
        })
      : [];
    session.plans.push({
      id: row.plan_id,
      exerciseId: row.exercise_id,
      exerciseName: row.exercise_name,
      setType: setType.success ? setType.data : 'normal',
      targetSets: row.target_sets,
      musclePrimary: primary.success ? primary.data : null,
      musclesSecondary: [...new Set(secondary)],
      musclesFine: normalizeFineMuscles(parseJsonColumn<unknown>(row.muscles_fine, [])),
    });
  }
  return program;
}

export function useBodyTrainingProgram(): {
  program: BodyTrainingProgram | null;
  isLoading: boolean;
  error: unknown;
} {
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('en') ? 'en' : 'fr';
  const { data, isLoading, error } = useQuery<BodyTrainingProgramRow>(
    SELECT_BODY_TRAINING_PROGRAM,
    [userId, lang],
  );
  const program = mapProgram(data.filter((row) => row.program_owner_id === userId));
  return { program, isLoading, error };
}
