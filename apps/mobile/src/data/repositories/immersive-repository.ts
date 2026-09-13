/**
 * Lectures propres au **mode immersif** de la séance (US MUSCU-UX03).
 *
 * Trois besoins, trois requêtes, toutes locales (SQLite PowerSync, donc hors ligne) :
 *  - les **séries de référence** de chaque exercice de la séance — le verdict et le fantôme ;
 *  - les **meilleurs records** de chaque exercice — les records en direct ;
 *  - les **muscles** de chaque exercice — le corps qui chauffe.
 *
 * ── Pourquoi un fichier à part ──────────────────────────────────────────────────────────────────
 * Ces lectures **regroupent** ce que les repositories existants exposent exercice par exercice
 * (`useLastPerformance`, `useExerciseRecords`) : en séance, il faut les cinq ou six exercices d'un
 * coup, et appeler un hook par exercice est impossible (règle des hooks). Les laisser ici évite
 * aussi d'alourdir `workout-repository.ts` (1 300 lignes) que d'autres US touchent en parallèle.
 *
 * ⚠️ Les trois requêtes prennent une **liste d'ids** : le SQL est donc construit avec autant de `?`
 * que d'exercices, jamais par concaténation de valeurs. Liste vide → requête qui ne matche rien
 * (et non SQL invalide), pour que les hooks restent appelables de façon stable.
 */

import { useQuery } from '@powersync/react';
import {
  normalizeFineMuscles,
  normalizeSecondaryMuscles,
  parseJsonColumn,
  resolveFineMuscles,
  type ExerciseBests,
  type ExerciseMuscles,
  type FineMuscle,
  type GhostReference,
  type MuscleGroup,
  type SetType,
} from '@wellness/shared';

/** Liste de `?` pour une clause `IN`, avec un repli qui ne matche rien sur une liste vide. */
function placeholders(count: number): string {
  return count > 0 ? new Array(count).fill('?').join(', ') : "''";
}

// ---------------------------------------------------------------------------
// Séries de référence — « la dernière fois », pour tous les exercices de la séance
// ---------------------------------------------------------------------------

type ReferenceRow = {
  exercise_id: string;
  set_type: string;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  finished_at: string | null;
};

/**
 * Même logique que `SELECT_LAST_PERFORMANCE` (workout-repository), étendue à plusieurs exercices et
 * **enrichie de `w.finished_at`** : sans cette date, le verdict ne peut pas dire « mardi ».
 *
 * La sous-requête corrélée sur `s.exercise_id` choisit, pour chaque exercice, la dernière séance
 * terminée qui le contient. La séance **en cours** est exclue par `w.status = 'completed'`.
 */
const SELECT_SESSION_REFERENCES = (count: number): string => `
  SELECT s.exercise_id, s.set_type, s.reps, s.weight_kg, s.duration_seconds, w.finished_at
  FROM workout_sets s
  JOIN workouts w ON w.id = s.workout_id AND w.status = 'completed' AND w.deleted_at IS NULL
  WHERE s.exercise_id IN (${placeholders(count)})
    AND s.deleted_at IS NULL AND s.done = 1 AND s.set_type <> 'warmup'
    AND w.id = (
      SELECT w2.id FROM workouts w2
      JOIN workout_sets s2 ON s2.workout_id = w2.id AND s2.exercise_id = s.exercise_id
        AND s2.deleted_at IS NULL AND s2.done = 1 AND s2.set_type <> 'warmup'
      WHERE w2.status = 'completed' AND w2.deleted_at IS NULL
      ORDER BY w2.finished_at DESC LIMIT 1
    )
  ORDER BY s.exercise_id, s.order_index
`;

/**
 * Séries de référence par exercice, dans l'ordre des rangs. Un exercice jamais fait n'a pas de clé :
 * c'est ce qui fait dire « première référence posée » au verdict, et qui masque le fantôme.
 */
export function useSessionReferences(
  exerciseIds: readonly string[],
): Record<string, GhostReference> {
  const ids = [...exerciseIds];
  const { data } = useQuery<ReferenceRow>(SELECT_SESSION_REFERENCES(ids.length), ids);

  const references: Record<string, GhostReference> = {};
  for (const row of data) {
    const reference = references[row.exercise_id] ?? { sets: [], finishedAt: row.finished_at };
    references[row.exercise_id] = {
      finishedAt: reference.finishedAt ?? row.finished_at,
      sets: [
        ...reference.sets,
        {
          setType: row.set_type as SetType,
          reps: row.reps,
          weightKg: row.weight_kg,
          durationSeconds: row.duration_seconds,
        },
      ],
    };
  }
  return references;
}

// ---------------------------------------------------------------------------
// Meilleurs records — la référence des records en direct
// ---------------------------------------------------------------------------

type BestRow = { exercise_id: string; type: string; best: number | null };

/**
 * Meilleure valeur par (exercice, type). Pas de filtre `user_id` : la base locale ne contient que
 * les lignes de l'utilisateur (règles de synchro), comme les autres lectures de records de l'app.
 */
const SELECT_EXERCISE_BESTS = (count: number): string => `
  SELECT exercise_id, type, MAX(value) AS best
  FROM personal_records
  WHERE exercise_id IN (${placeholders(count)}) AND deleted_at IS NULL
  GROUP BY exercise_id, type
`;

/**
 * Meilleurs records connus par exercice. Un exercice **absent** de la table n'a **aucun** record :
 * `maxWeightKg` et `estimated1rm` restent `null`, et rien ne sera célébré en direct (spec §5.4,
 * « pas de record sans passé »).
 */
export function useExerciseBests(exerciseIds: readonly string[]): Record<string, ExerciseBests> {
  const ids = [...exerciseIds];
  const { data } = useQuery<BestRow>(SELECT_EXERCISE_BESTS(ids.length), ids);

  const bests: Record<string, ExerciseBests> = {};
  for (const id of ids) bests[id] = { maxWeightKg: null, estimated1rm: null };
  for (const row of data) {
    const current = bests[row.exercise_id] ?? { maxWeightKg: null, estimated1rm: null };
    if (row.type === 'max_weight') current.maxWeightKg = row.best;
    if (row.type === 'estimated_1rm') current.estimated1rm = row.best;
    bests[row.exercise_id] = current;
  }
  return bests;
}

// ---------------------------------------------------------------------------
// Muscles — le corps qui chauffe
// ---------------------------------------------------------------------------

type MuscleRow = {
  id: string;
  muscle_primary: string;
  muscles_secondary: string | null;
  muscles_fine: string | null;
};

const SELECT_SESSION_MUSCLES = (count: number): string => `
  SELECT id, muscle_primary, muscles_secondary, muscles_fine
  FROM exercises
  WHERE id IN (${placeholders(count)})
`;

// ---------------------------------------------------------------------------
// Matériel et consigne — la barre chargée, et ce que le coach dit au lancement
// ---------------------------------------------------------------------------

type ExerciseCardRow = { id: string; equipment: string | null; instructions: string | null };

const SELECT_SESSION_CARDS = (count: number): string => `
  SELECT id, equipment, instructions
  FROM exercises
  WHERE id IN (${placeholders(count)})
`;

/** Ce que la scène immersive sait d'un exercice au-delà de ses muscles. */
export type ExerciseCard = {
  equipment: string | null;
  /**
   * **Première phrase** des instructions, pas le texte entier : c'est une consigne dite à voix
   * haute au lancement de la série, pas une fiche à lire. Trois lignes de technique pendant qu'on
   * se met en place ne sont ni écoutées ni lues.
   */
  cue: string | null;
};

/** Découpe la première phrase d'un texte d'instructions, bornée à une longueur dicible. */
function firstSentence(text: string | null): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const end = trimmed.search(/[.!?](\s|$)/);
  const sentence = end > 0 ? trimmed.slice(0, end + 1) : trimmed;
  return sentence.length > 140 ? `${sentence.slice(0, 137)}…` : sentence;
}

/** Matériel et consigne courte par exercice de la séance. */
export function useSessionCards(exerciseIds: readonly string[]): Record<string, ExerciseCard> {
  const ids = [...exerciseIds];
  const { data } = useQuery<ExerciseCardRow>(SELECT_SESSION_CARDS(ids.length), ids);

  const cards: Record<string, ExerciseCard> = {};
  for (const row of data) {
    cards[row.id] = { equipment: row.equipment, cue: firstSentence(row.instructions) };
  }
  return cards;
}

// ---------------------------------------------------------------------------
// Brief d'entrée en séance (spec §5.1)
// ---------------------------------------------------------------------------

type BriefRow = {
  session_name: string | null;
  exercise_id: string;
  exercise_name: string | null;
  muscle_primary: string;
  target_sets: number | null;
  target_reps: string | null;
  target_weight_kg: number | null;
  rest_seconds: number | null;
};

/**
 * Le plan d'une séance **avant** de la démarrer.
 *
 * Même structure de jointures que `SELECT_TODAY_PLAN` (hub muscu) : traduction dans la langue
 * courante avec repli sur le français, pour qu'un exercice créé dans une langue et relu dans
 * l'autre ne s'affiche jamais vide. Paramètres : `[lang, sessionId]`.
 */
const SELECT_SESSION_BRIEF = `
  SELECT s.name AS session_name,
         ep.exercise_id,
         COALESCE(etl.name, etfr.name) AS exercise_name,
         e.muscle_primary,
         ep.target_sets, ep.target_reps, ep.target_weight_kg, ep.rest_seconds
  FROM sessions s
  JOIN exercise_plans ep ON ep.session_id = s.id AND ep.deleted_at IS NULL
  JOIN exercises e ON e.id = ep.exercise_id AND e.deleted_at IS NULL
  LEFT JOIN exercise_translations etl  ON etl.exercise_id  = e.id AND etl.lang  = ?  AND etl.deleted_at IS NULL
  LEFT JOIN exercise_translations etfr ON etfr.exercise_id = e.id AND etfr.lang = 'fr' AND etfr.deleted_at IS NULL
  WHERE s.id = ? AND s.deleted_at IS NULL
  ORDER BY ep.order_index
`;

export type SessionBriefExercise = {
  exerciseId: string;
  name: string;
  /** `null` quand la provenance ne le porte pas (un modèle de séance, par exemple). */
  musclePrimary: MuscleGroup | null;
  targetSets: number | null;
  /** Consigne de répétitions, telle qu'écrite dans le plan (« 8-12 », « AMRAP »). */
  targetReps: string | null;
  targetWeightKg: number | null;
  restSeconds: number | null;
};

export type SessionBrief = {
  name: string | null;
  exercises: SessionBriefExercise[];
};

/**
 * Plan de la séance à venir — `sessionId` vide (séance libre, reprise) renvoie une liste vide, et
 * l'écran de brief sait alors qu'il n'a rien à annoncer.
 */
export function useSessionBrief(sessionId: string, lang: string): SessionBrief {
  const { data } = useQuery<BriefRow>(SELECT_SESSION_BRIEF, [lang, sessionId]);

  return {
    name: data[0]?.session_name ?? null,
    exercises: data.map((row) => ({
      exerciseId: row.exercise_id,
      name: row.exercise_name ?? '—',
      musclePrimary: row.muscle_primary as MuscleGroup,
      targetSets: row.target_sets,
      targetReps: row.target_reps,
      targetWeightKg: row.target_weight_kg,
      restSeconds: row.rest_seconds,
    })),
  };
}

/**
 * Muscles sollicités par exercice, résolus par `resolveFineMuscles` — **le même chemin** que la
 * fiche exercice et l'aperçu de séance : la chaleur éclaire exactement ce que le schéma corporel
 * éclaire déjà ailleurs.
 *
 * ⚠️ `deleted_at` n'est pas filtré : un exercice archivé au catalogue pendant la séance doit
 * continuer de chauffer son muscle — c'est un fait passé, comme pour les records (ADMIN-01).
 */
export function useSessionMuscles(
  exerciseIds: readonly string[],
): Record<string, ExerciseMuscles> {
  const ids = [...exerciseIds];
  const { data } = useQuery<MuscleRow>(SELECT_SESSION_MUSCLES(ids.length), ids);

  const muscles: Record<string, ExerciseMuscles> = {};
  for (const row of data) {
    const primary = row.muscle_primary as MuscleGroup;
    muscles[row.id] = resolveFineMuscles({
      musclePrimary: primary,
      musclesSecondary: normalizeSecondaryMuscles(
        parseJsonColumn<unknown>(row.muscles_secondary, []),
        primary,
      ),
      musclesFine: normalizeFineMuscles(parseJsonColumn<unknown>(row.muscles_fine, [])) as FineMuscle[],
    });
  }
  return muscles;
}
