/**
 * Repository des templates de séance libre (US Refonte-D, spec
 * docs/specs/functional/us/refonte-muscu-d-templates-seance-libre.md) :
 * `workout_templates` + `workout_template_exercises`. Patron exact des repas types
 * nutrition (`meal-template-repository.ts`) — pas de réutilisation de
 * `programs`/`sessions`/`exercise_plans`. Tables strictement scopées à leur
 * propriétaire (`user_id`), aucune notion de bibliothèque éditoriale ici.
 *
 * Cette Task (5) couvre la lecture réactive et le CRUD de gestion (créer, renommer,
 * ajouter/modifier/retirer un exercice, dupliquer, supprimer). L'enregistrement
 * d'un template depuis une séance terminée et le démarrage d'une séance depuis un
 * template arrivent en Task 6, dans ce même fichier.
 *
 * Règles offline-first (voir docs/specs/technical/offline-sync.md) :
 *  - UUID généré côté client (via `insertWithSyncFields`/`txInsert`).
 *  - Timestamps en UTC ; suppression = soft delete (jamais de hard delete client).
 *  - `user_id` = utilisateur de la session courante sur toute écriture.
 */

import { useQuery } from '@powersync/react';
import { deriveTemplateTargetsFromWorkoutSets, type SetType } from '@wellness/shared';
import { useTranslation } from 'react-i18next';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { insertWithSyncFields, nowUtc, patch, softDelete, txInsert } from './_sql';
import { parseTargetReps } from './workout-repository';

// ---------------------------------------------------------------------------
// Types de domaine exposés à l'UI
// ---------------------------------------------------------------------------

/** Élément de template tel qu'affiché dans la liste. */
export type WorkoutTemplateListItem = {
  id: string;
  name: string;
  exerciseCount: number;
};

/** Un exercice planifié au sein d'un template, prêt pour l'écran de composition. */
export type WorkoutTemplateExerciseItem = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  orderIndex: number;
  setType: SetType;
  targetSets: number | null;
  targetReps: string | null;
  targetWeightKg: number | null;
  restSeconds: number | null;
};

/** Détail complet d'un template : entête + exercices (triés par `order_index`). */
export type WorkoutTemplateDetail = {
  id: string;
  name: string;
  exercises: WorkoutTemplateExerciseItem[];
};

/** Champs modifiables d'un exercice de template via `updateTemplateExercise`. */
export type TemplateExercisePatch = {
  setType?: SetType;
  targetSets?: number | null;
  targetReps?: string | null;
  targetWeightKg?: number | null;
  restSeconds?: number | null;
};

// ---------------------------------------------------------------------------
// Lignes brutes SQLite (colonnes snake_case)
// ---------------------------------------------------------------------------

type TemplateListDbRow = { id: string; name: string; exercise_count: number };

type TemplateHeaderDbRow = { id: string; name: string };

/** Ligne brute d'un exercice de template avec le nom d'exercice résolu (langue courante → fr). */
type TemplateExerciseDbRow = {
  id: string;
  exercise_id: string;
  order_index: number;
  set_type: string;
  target_sets: number | null;
  target_reps: string | null;
  target_weight_kg: number | null;
  rest_seconds: number | null;
  /** Nom d'exercice résolu par COALESCE(langue courante, fr) — peut être null. */
  exercise_name: string | null;
};

// ---------------------------------------------------------------------------
// Requêtes SQL (noms de tables/colonnes statiques ; valeurs toujours liées via ?)
// ---------------------------------------------------------------------------

const SELECT_TEMPLATES = `
  SELECT t.id, t.name, COUNT(e.id) AS exercise_count
  FROM workout_templates t
  LEFT JOIN workout_template_exercises e ON e.template_id = t.id AND e.deleted_at IS NULL
  WHERE t.deleted_at IS NULL
  GROUP BY t.id
  ORDER BY t.name COLLATE NOCASE
`;

/**
 * Exercices d'un template, triés par position, avec nom d'exercice résolu.
 * Premier `?` = langue courante ; second `?` = id du template. Même patron que
 * `SELECT_PLANS_FOR_PROGRAM` de `program-repository.ts`.
 */
const SELECT_TEMPLATE_EXERCISES = `
  SELECT e.id, e.exercise_id, e.order_index, e.set_type, e.target_sets, e.target_reps,
         e.target_weight_kg, e.rest_seconds,
         COALESCE(tl.name, tfr.name) AS exercise_name
  FROM workout_template_exercises e
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = e.exercise_id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = e.exercise_id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  WHERE e.template_id = ? AND e.deleted_at IS NULL
  ORDER BY e.order_index
`;

// ---------------------------------------------------------------------------
// Lecture réactive (hooks)
// ---------------------------------------------------------------------------

/**
 * Templates de l'utilisateur courant, réactifs aux changements locaux. PowerSync ne
 * réplique que les lignes de l'utilisateur : pas besoin de filtre `user_id = ?`
 * explicite ici (même choix que `useMealTemplates`).
 *
 * `isLoading` ne dépend QUE de la résolution de la requête locale (offline-first,
 * ADR-001 / décision B) — jamais d'une synchro réseau.
 */
export function useWorkoutTemplates(): {
  templates: WorkoutTemplateListItem[];
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery<TemplateListDbRow>(SELECT_TEMPLATES);
  return {
    templates: data.map((t) => ({ id: t.id, name: t.name, exerciseCount: t.exercise_count })),
    isLoading,
  };
}

/**
 * Détail complet d'un template (entête + exercices ordonnés), réactif. Les noms
 * d'exercice sont résolus dans la langue applicative.
 *
 * Deux requêtes réactives (entête, exercices) toujours appelées (règle des hooks) ;
 * quand `templateId` est vide/inconnu, elles renvoient des résultats vides.
 */
export function useWorkoutTemplateDetail(templateId: string): {
  detail: WorkoutTemplateDetail | null;
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  const { data: headerRows, isLoading: headerLoading } = useQuery<TemplateHeaderDbRow>(
    `SELECT id, name FROM workout_templates WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [templateId],
  );
  const { data: exerciseRows, isLoading: exercisesLoading } = useQuery<TemplateExerciseDbRow>(
    SELECT_TEMPLATE_EXERCISES,
    [lang, templateId],
  );

  const isLoading = headerLoading || exercisesLoading;
  const header = headerRows[0];
  if (!header) {
    return { detail: null, isLoading };
  }

  const detail: WorkoutTemplateDetail = {
    id: header.id,
    name: header.name,
    exercises: exerciseRows.map((e) => ({
      id: e.id,
      exerciseId: e.exercise_id,
      exerciseName: e.exercise_name ?? '',
      orderIndex: e.order_index,
      setType: e.set_type as SetType,
      targetSets: e.target_sets,
      targetReps: e.target_reps,
      targetWeightKg: e.target_weight_kg,
      restSeconds: e.rest_seconds,
    })),
  };
  return { detail, isLoading };
}

// ---------------------------------------------------------------------------
// Écritures (hors contexte hook) — toutes optimistes (SQLite immédiat)
// ---------------------------------------------------------------------------

/** Identifiant de l'utilisateur de la session courante (lève si déconnecté). */
function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) {
    throw new Error('Aucune session active : impossible d’écrire un template.');
  }
  return userId;
}

/**
 * `order_index` suivant pour les exercices d'un template : max(order_index) + 1, ou 0
 * si aucun exercice. Même patron que `nextOrderIndex` de `program-repository.ts`.
 */
async function nextTemplateOrderIndex(templateId: string): Promise<number> {
  const row = await powerSync.getOptional<{ max_index: number | null }>(
    `SELECT MAX(order_index) AS max_index FROM workout_template_exercises
     WHERE template_id = ? AND deleted_at IS NULL`,
    [templateId],
  );
  const max = row?.max_index;
  return max === null || max === undefined ? 0 : max + 1;
}

/** Crée un template de séance vide (nom uniquement). Retourne l'`id` créé. */
export async function createWorkoutTemplate(name: string): Promise<string> {
  const userId = currentUserId();
  return insertWithSyncFields('workout_templates', { user_id: userId, name: name.trim() });
}

/** Renomme un template. */
export async function renameWorkoutTemplate(templateId: string, name: string): Promise<void> {
  await patch('workout_templates', templateId, { name: name.trim() });
}

/**
 * Ajoute un exercice à un template.
 * `order_index` = position suivante (max+1) dans le template ; `set_type` défaut 'normal'.
 */
export async function addTemplateExercise(
  templateId: string,
  input: {
    exerciseId: string;
    setType?: SetType;
    targetSets?: number | null;
    targetReps?: string | null;
    targetWeightKg?: number | null;
    restSeconds?: number | null;
  },
): Promise<void> {
  const userId = currentUserId();
  const orderIndex = await nextTemplateOrderIndex(templateId);

  await insertWithSyncFields('workout_template_exercises', {
    template_id: templateId,
    user_id: userId,
    exercise_id: input.exerciseId,
    order_index: orderIndex,
    set_type: input.setType ?? 'normal',
    target_sets: input.targetSets ?? null,
    target_reps: input.targetReps ?? null,
    target_weight_kg: input.targetWeightKg ?? null,
    rest_seconds: input.restSeconds ?? null,
  });
}

/**
 * Met à jour un exercice de template (type de série, cibles, repos).
 * Seules les clés présentes dans `input` sont modifiées.
 */
export async function updateTemplateExercise(
  templateExerciseId: string,
  input: TemplateExercisePatch,
): Promise<void> {
  const columns: Record<string, unknown> = {};
  if ('setType' in input) columns['set_type'] = input.setType;
  if ('targetSets' in input) columns['target_sets'] = input.targetSets;
  if ('targetReps' in input) columns['target_reps'] = input.targetReps;
  if ('targetWeightKg' in input) columns['target_weight_kg'] = input.targetWeightKg;
  if ('restSeconds' in input) columns['rest_seconds'] = input.restSeconds;

  await patch('workout_template_exercises', templateExerciseId, columns);
}

/** Retire un exercice d'un template (soft delete). */
export async function removeTemplateExercise(templateExerciseId: string): Promise<void> {
  await softDelete('workout_template_exercises', templateExerciseId);
}

/** Supprime un template (soft delete du template ET de tous ses exercices). */
export async function deleteWorkoutTemplate(templateId: string): Promise<void> {
  const exercises = await powerSync.getAll<{ id: string }>(
    `SELECT id FROM workout_template_exercises WHERE template_id = ? AND deleted_at IS NULL`,
    [templateId],
  );
  for (const e of exercises) {
    await softDelete('workout_template_exercises', e.id);
  }
  await softDelete('workout_templates', templateId);
}

/**
 * Duplique un template en un nouveau template de l'utilisateur courant : nouveaux
 * UUID partout, même nom. Copie l'entête et tous les exercices.
 *
 * Effectué dans une transaction : une copie partielle est impossible. Retourne
 * l'`id` du nouveau template.
 */
export async function duplicateWorkoutTemplate(templateId: string): Promise<string> {
  const userId = currentUserId();

  return powerSync.writeTransaction(async (tx) => {
    const source = await tx.getOptional<{ name: string }>(
      `SELECT name FROM workout_templates WHERE id = ? AND deleted_at IS NULL`,
      [templateId],
    );
    if (!source) {
      throw new Error('Template source introuvable : duplication impossible.');
    }

    const newTemplateId = await txInsert(tx, 'workout_templates', {
      user_id: userId,
      name: source.name,
    });

    const exercises = await tx.getAll<{
      exercise_id: string;
      order_index: number;
      set_type: string;
      target_sets: number | null;
      target_reps: string | null;
      target_weight_kg: number | null;
      rest_seconds: number | null;
    }>(
      `SELECT exercise_id, order_index, set_type, target_sets, target_reps, target_weight_kg, rest_seconds
       FROM workout_template_exercises
       WHERE template_id = ? AND deleted_at IS NULL
       ORDER BY order_index`,
      [templateId],
    );
    for (const e of exercises) {
      await txInsert(tx, 'workout_template_exercises', {
        template_id: newTemplateId,
        user_id: userId,
        exercise_id: e.exercise_id,
        order_index: e.order_index,
        set_type: e.set_type,
        target_sets: e.target_sets,
        target_reps: e.target_reps,
        target_weight_kg: e.target_weight_kg,
        rest_seconds: e.rest_seconds,
      });
    }

    return newTemplateId;
  });
}

// ---------------------------------------------------------------------------
// Enregistrer depuis une séance / démarrer depuis un template (Task 6)
// ---------------------------------------------------------------------------

/**
 * Enregistre une séance libre terminée comme nouveau template (US Refonte-D §3).
 * Lit les `workout_sets` de la séance (triées par `order_index`), délègue la
 * dérivation des cibles à la fonction pure `deriveTemplateTargetsFromWorkoutSets`
 * (packages/shared, testée Vitest — ne considère que les séries validées), puis
 * crée le template et ses exercices dans une transaction atomique. Retourne
 * l'`id` du template créé.
 */
export async function createTemplateFromWorkout(
  workoutId: string,
  name: string,
): Promise<string> {
  const userId = currentUserId();

  const sets = await powerSync.getAll<{
    exercise_id: string;
    set_type: string;
    reps: number | null;
    weight_kg: number | null;
    done: number;
  }>(
    `SELECT exercise_id, set_type, reps, weight_kg, done
     FROM workout_sets
     WHERE workout_id = ? AND deleted_at IS NULL
     ORDER BY order_index`,
    [workoutId],
  );

  const targets = deriveTemplateTargetsFromWorkoutSets(
    sets.map((s) => ({
      exerciseId: s.exercise_id,
      setType: s.set_type,
      reps: s.reps,
      weightKg: s.weight_kg,
      done: s.done === 1,
    })),
  );

  return powerSync.writeTransaction(async (tx) => {
    const templateId = await txInsert(tx, 'workout_templates', {
      user_id: userId,
      name: name.trim(),
    });

    let orderIndex = 0;
    for (const target of targets) {
      await txInsert(tx, 'workout_template_exercises', {
        template_id: templateId,
        user_id: userId,
        exercise_id: target.exerciseId,
        order_index: orderIndex,
        set_type: target.setType,
        target_sets: target.targetSets,
        target_reps: target.targetReps,
        target_weight_kg: target.targetWeightKg,
        rest_seconds: null,
      });
      orderIndex += 1;
    }

    return templateId;
  });
}

/**
 * Démarre une nouvelle séance libre pré-remplie depuis un template (US Refonte-D §3)
 * et retourne l'id de la séance créée.
 *
 * Garde défensive identique à `startWorkout`/`startWorkoutFromSession` : si une
 * séance `status='active'` non supprimée existe déjà pour l'utilisateur courant,
 * on retourne son id sans en créer une seconde (au plus une séance active à la fois).
 *
 * Sinon, dans une transaction atomique (une séance partielle est impossible) :
 *  1. lit les exercices du template (triés par `order_index`) ;
 *  2. insère la ligne `workouts` (séance libre : `session_id`/`program_id`/
 *     `planned_session_id` tous `null`, `status='active'`) ;
 *  3. pour chaque exercice, insère `max(1, target_sets)` séries pré-remplies :
 *     `set_type` repris de l'exercice de template, `reps` pré-rempli depuis
 *     `target_reps` (via `parseTargetReps`), `weight_kg` ET `planned_weight_kg`
 *     = `target_weight_kg` (même convention que `startWorkoutFromSession`),
 *     `done=false`. L'`order_index` est séquentiel sur l'ensemble de la séance.
 */
export async function startWorkoutFromTemplate(templateId: string): Promise<string> {
  const userId = currentUserId();

  const existing = await powerSync.getOptional<{ id: string }>(
    `SELECT id FROM workouts
     WHERE user_id = ? AND status = 'active' AND deleted_at IS NULL
     LIMIT 1`,
    [userId],
  );
  if (existing) {
    return existing.id;
  }

  // Analytics : démarrage effectif d'une nouvelle séance (pas une reprise). Fire-and-forget.
  void track(ANALYTICS_EVENTS.workoutStarted);

  return powerSync.writeTransaction(async (tx) => {
    const exercises = await tx.getAll<{
      exercise_id: string;
      set_type: string;
      target_sets: number | null;
      target_reps: string | null;
      target_weight_kg: number | null;
    }>(
      `SELECT exercise_id, set_type, target_sets, target_reps, target_weight_kg
       FROM workout_template_exercises
       WHERE template_id = ? AND deleted_at IS NULL
       ORDER BY order_index`,
      [templateId],
    );

    const workoutId = await txInsert(tx, 'workouts', {
      user_id: userId,
      session_id: null,
      program_id: null,
      planned_session_id: null,
      status: 'active',
      started_at: nowUtc(),
      finished_at: null,
      duration_seconds: null,
      rpe: null,
      notes: null,
    });

    let orderIndex = 0;
    for (const exercise of exercises) {
      const count = Math.max(1, exercise.target_sets ?? 1);
      for (let i = 0; i < count; i++) {
        await txInsert(tx, 'workout_sets', {
          workout_id: workoutId,
          user_id: userId,
          exercise_id: exercise.exercise_id,
          order_index: orderIndex,
          set_type: exercise.set_type,
          reps: parseTargetReps(exercise.target_reps),
          weight_kg: exercise.target_weight_kg,
          duration_seconds: null,
          done: 0,
          planned_weight_kg: exercise.target_weight_kg,
        });
        orderIndex += 1;
      }
    }

    return workoutId;
  });
}
