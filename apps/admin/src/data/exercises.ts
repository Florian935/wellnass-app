import { supabase } from '../lib/supabase';
import {
  MUSCLE_GROUPS,
  EQUIPMENTS,
  normalizeSecondaryMuscles,
  type Database,
  type MuscleGroup,
  type Equipment,
} from '@wellness/shared';
import { logAudit } from './audit';

/**
 * Couche data des exercices éditoriaux (US 8.2). Requêtes Supabase via
 * `supabase-js` (clé anon ; la RLS est la frontière — seul un admin peut écrire
 * l'éditorial). Exercices éditoriaux = `owner_id IS NULL`, `source = 'library'`.
 * Écriture séquentielle (exercice puis ses 2 traductions), UUID générés client.
 */

/** Statut éditorial d'un exercice (miroir du `check` SQL sur `exercises.status`). */
export type ExerciseStatus = 'draft' | 'published';

/** Statuts ordonnés (pour le filtre de la liste). */
export const EXERCISE_STATUSES: readonly ExerciseStatus[] = ['draft', 'published'];

/** Réexport des groupes musculaires (source unique `@wellness/shared`). */
export { MUSCLE_GROUPS };
export type { MuscleGroup };

/** Réexport des équipements (source unique `@wellness/shared`). */
export { EQUIPMENTS };
export type { Equipment };

/** Une ligne exercice éditorial enrichie de ses noms FR/EN (pour la liste). */
export type AdminExerciseRow = {
  id: string;
  musclePrimary: string;
  equipment: Equipment | null;
  status: string;
  createdAt: string;
  nameFr: string | null;
  nameEn: string | null;
};

/** Détail d'un exercice (formulaire d'édition) : ligne + 2 traductions. */
export type ExerciseDetail = {
  id: string;
  musclePrimary: MuscleGroup;
  musclesSecondary: MuscleGroup[];
  equipment: Equipment | null;
  status: ExerciseStatus;
  nameFr: string;
  nameEn: string;
  instructionsFr: string | null;
  instructionsEn: string | null;
};

/** Entrée de `saveExercise` (création si `id` absent, sinon mise à jour). */
export type ExerciseInput = {
  id?: string;
  musclePrimary: MuscleGroup;
  musclesSecondary: MuscleGroup[];
  equipment: Equipment | null;
  status: ExerciseStatus;
  nameFr: string;
  nameEn: string;
  instructionsFr: string | null;
  instructionsEn: string | null;
};

type TranslationRow = {
  lang: string;
  name: string;
  instructions: string | null;
};

/**
 * Liste des exercices éditoriaux (`owner_id IS NULL`, non supprimés), avec leurs
 * traductions FR/EN jointes, triés du plus récent au plus ancien. L'admin les
 * voit tous (brouillons compris) via la RLS `is_admin()`.
 */
export async function listEditorialExercises(): Promise<{
  rows: AdminExerciseRow[];
  error: unknown;
}> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, muscle_primary, equipment, status, created_at, exercise_translations(lang, name)')
    .is('owner_id', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    return { rows: [], error };
  }

  const rows: AdminExerciseRow[] = (data ?? []).map((ex) => {
    const translations = (ex.exercise_translations ?? []) as { lang: string; name: string }[];
    const fr = translations.find((t) => t.lang === 'fr');
    const en = translations.find((t) => t.lang === 'en');
    return {
      id: ex.id,
      musclePrimary: ex.muscle_primary,
      equipment: ex.equipment as Equipment | null,
      status: ex.status,
      createdAt: ex.created_at,
      nameFr: fr?.name ?? null,
      nameEn: en?.name ?? null,
    };
  });

  return { rows, error: null };
}

/** Détail d'un exercice éditorial (ligne + traductions FR/EN) pour édition. */
export async function getExercise(id: string): Promise<{
  exercise: ExerciseDetail | null;
  error: unknown;
}> {
  const { data, error } = await supabase
    .from('exercises')
    .select(
      'id, muscle_primary, muscles_secondary, equipment, status, exercise_translations(lang, name, instructions)',
    )
    .eq('id', id)
    .is('owner_id', null) // éditorial uniquement (jamais un exercice utilisateur)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    return { exercise: null, error };
  }
  if (!data) {
    return { exercise: null, error: null };
  }

  const translations = (data.exercise_translations ?? []) as TranslationRow[];
  const fr = translations.find((t) => t.lang === 'fr');
  const en = translations.find((t) => t.lang === 'en');

  const exercise: ExerciseDetail = {
    id: data.id,
    musclePrimary: data.muscle_primary as MuscleGroup,
    musclesSecondary: normalizeSecondaryMuscles(data.muscles_secondary, data.muscle_primary as MuscleGroup),
    equipment: data.equipment as Equipment | null,
    status: (data.status as ExerciseStatus) ?? 'draft',
    nameFr: fr?.name ?? '',
    nameEn: en?.name ?? '',
    instructionsFr: fr?.instructions ?? null,
    instructionsEn: en?.instructions ?? null,
  };
  return { exercise, error: null };
}

/**
 * Crée ou met à jour un exercice éditorial et ses deux traductions (FR, EN).
 * Écriture séquentielle : upsert de la ligne `exercises` (owner_id NULL, source
 * 'library'), puis upsert des deux `exercise_translations` (unique
 * `(exercise_id, lang)`). En cas d'échec partiel, renvoie l'erreur pour que l'UI
 * la surface (l'admin peut retenter — l'upsert est idempotent).
 */
export async function saveExercise(input: ExerciseInput): Promise<{
  id: string | null;
  error: unknown;
}> {
  const id = input.id ?? crypto.randomUUID();

  // `muscles_secondary` est typée `Json` en base → cast depuis `MuscleGroup[]` (assignable).
  const musclesSecondary =
    normalizeSecondaryMuscles(input.musclesSecondary, input.musclePrimary) as
      Database['public']['Tables']['exercises']['Insert']['muscles_secondary'];

  const exerciseUpsert: Database['public']['Tables']['exercises']['Insert'] = {
    id,
    owner_id: null,
    source: 'library',
    muscle_primary: input.musclePrimary,
    muscles_secondary: musclesSecondary,
    equipment: input.equipment,
    status: input.status,
  };

  const { error: exError } = await supabase
    .from('exercises')
    .upsert(exerciseUpsert, { onConflict: 'id' });

  if (exError) {
    return { id: null, error: exError };
  }

  const translations: Database['public']['Tables']['exercise_translations']['Insert'][] = [
    {
      id: crypto.randomUUID(),
      exercise_id: id,
      owner_id: null,
      lang: 'fr',
      name: input.nameFr,
      instructions: input.instructionsFr,
    },
    {
      id: crypto.randomUUID(),
      exercise_id: id,
      owner_id: null,
      lang: 'en',
      name: input.nameEn,
      instructions: input.instructionsEn,
    },
  ];

  // Séquentiel (pattern repo mobile). Conflit sur (exercise_id, lang) → update.
  // `id` généré ici sert seulement à l'insertion initiale (ignoré sur conflit).
  for (const t of translations) {
    const { error } = await supabase
      .from('exercise_translations')
      .upsert(t, { onConflict: 'exercise_id,lang' });
    if (error) {
      // L'exercice a bien été créé/mis à jour : on renvoie son `id` (pas null) pour
      // que l'appelant puisse y revenir et retenter (l'upsert est idempotent).
      return { id, error };
    }
  }

  // Best-effort, uniquement en succès complet (ligne + 2 traductions).
  await logAudit({
    action: input.id ? 'exercise.update' : 'exercise.create',
    targetTable: 'exercises',
    targetId: id,
    targetLabel: input.nameFr,
  });

  return { id, error: null };
}

/** Publie / repasse en brouillon un exercice éditorial (`status`). */
export async function setStatus(
  id: string,
  status: ExerciseStatus,
  opts?: { label?: string },
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('exercises')
    .update({ status })
    .eq('id', id)
    .is('owner_id', null); // éditorial uniquement
  if (error) return { error };

  // Dépublication hors périmètre : on ne journalise que la publication.
  if (status === 'published') {
    await logAudit({
      action: 'exercise.publish',
      targetTable: 'exercises',
      targetId: id,
      targetLabel: opts?.label ?? null,
      details: { status },
    });
  }

  return { error: null };
}

/**
 * Archive un exercice éditorial (soft-delete) et ses traductions
 * (`deleted_at = now`). Séquentiel : l'exercice d'abord, puis ses traductions.
 */
export async function archiveExercise(
  id: string,
  opts?: { label?: string },
): Promise<{ error: unknown }> {
  const now = new Date().toISOString();

  const { error: exError } = await supabase
    .from('exercises')
    .update({ deleted_at: now })
    .eq('id', id)
    .is('owner_id', null); // éditorial uniquement
  if (exError) {
    return { error: exError };
  }

  const { error: trError } = await supabase
    .from('exercise_translations')
    .update({ deleted_at: now })
    .eq('exercise_id', id)
    .is('owner_id', null); // traductions éditoriales uniquement
  if (trError) {
    return { error: trError };
  }

  await logAudit({
    action: 'exercise.archive',
    targetTable: 'exercises',
    targetId: id,
    targetLabel: opts?.label ?? null,
  });

  return { error: null };
}
