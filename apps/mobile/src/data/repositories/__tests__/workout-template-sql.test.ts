/**
 * Modèles de séance (US Refonte-D) — écritures sur **du vrai SQLite**.
 *
 * Un template est une **copie figée** : c'est tout l'intérêt du concept, et c'est aussi ce qui se
 * casse sans bruit. Trois propriétés portent le tout, et aucune ne se voit à l'écran :
 *
 *  1. **`createTemplateFromWorkout` fige des cibles, pas des références.** Modifier la séance
 *     d'origine après coup ne doit pas déformer le modèle qu'on en a tiré.
 *  2. **`duplicateWorkoutTemplate` copie en transaction.** Un template à moitié dupliqué
 *     s'afficherait comme un template normal, avec des exercices en moins.
 *  3. **`startWorkoutFromTemplate` respecte la garde « une seule séance active »**, comme les deux
 *     autres portes d'entrée d'une séance (`startWorkout`, `startWorkoutFromSession`). Trois
 *     chemins, une seule règle : c'est le genre d'invariant qu'on oublie de rejouer sur le
 *     troisième.
 */

import {
  createTemplateFromWorkout,
  createWorkoutTemplate,
  deleteWorkoutTemplate,
  duplicateWorkoutTemplate,
  removeTemplateExercise,
  renameWorkoutTemplate,
  startWorkoutFromTemplate,
} from '../workout-template-repository';
import { resetTestDb, rowsOf, seed } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

jest.mock('@/lib/analytics', () => ({
  ANALYTICS_EVENTS: { workoutStarted: 'workout_started' },
  track: jest.fn(async () => undefined),
}));

type TemplateRow = { id: string; user_id: string; name: string };
type TemplateExerciseRow = {
  id: string;
  template_id: string;
  exercise_id: string;
  order_index: number;
  set_type: string;
  target_sets: number | null;
  target_reps: string | null;
  target_weight_kg: number | null;
};
type SetRow = {
  workout_id: string;
  exercise_id: string;
  order_index: number;
  reps: number | null;
  weight_kg: number | null;
  planned_weight_kg: number | null;
  done: number;
};

const templates = (d = false) => rowsOf<TemplateRow>('workout_templates', d);
const templateExercises = (d = false) =>
  rowsOf<TemplateExerciseRow>('workout_template_exercises', d);

/** Exercices d'un template, dans l'ordre. */
const exercisesOf = (templateId: string) =>
  templateExercises()
    .filter((e) => e.template_id === templateId)
    .sort((a, b) => a.order_index - b.order_index);

/** Séries d'une séance, dans l'ordre. */
const setsOf = (workoutId: string) =>
  rowsOf<SetRow>('workout_sets')
    .filter((s) => s.workout_id === workoutId)
    .sort((a, b) => a.order_index - b.order_index);

/** Une séance terminée avec les séries fournies. */
function seedWorkout(
  sets: {
    exerciseId?: string;
    setType?: string;
    reps?: number | null;
    weightKg?: number | null;
    done?: boolean;
  }[],
): string {
  const [workoutId] = seed('workouts', [
    { user_id: 'user-1', status: 'completed', started_at: new Date().toISOString() },
  ]);
  seed(
    'workout_sets',
    sets.map((s, i) => ({
      workout_id: workoutId,
      user_id: 'user-1',
      exercise_id: s.exerciseId ?? 'squat',
      order_index: i,
      set_type: s.setType ?? 'normal',
      reps: s.reps ?? null,
      weight_kg: s.weightKg ?? null,
      done: s.done === false ? 0 : 1,
    })),
  );
  return workoutId!;
}

beforeEach(() => {
  resetTestDb();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Entête
// ---------------------------------------------------------------------------

describe('createWorkoutTemplate / renameWorkoutTemplate', () => {
  it('crée le modèle au nom de l’utilisateur courant', async () => {
    const id = await createWorkoutTemplate('Haut du corps');

    expect(templates()).toEqual([
      expect.objectContaining({ id, user_id: 'user-1', name: 'Haut du corps' }),
    ]);
  });

  it('renomme sans créer de doublon', async () => {
    const id = await createWorkoutTemplate('Haut du corps');

    await renameWorkoutTemplate(id, 'Push');

    expect(templates()).toHaveLength(1);
    expect(templates()[0]?.name).toBe('Push');
  });
});

// ---------------------------------------------------------------------------
// Depuis une séance — la copie figée
// ---------------------------------------------------------------------------

describe('createTemplateFromWorkout', () => {
  it('dérive une cible par exercice, dans l’ordre de la séance', async () => {
    const workoutId = seedWorkout([
      { exerciseId: 'squat', reps: 10, weightKg: 100 },
      { exerciseId: 'squat', reps: 8, weightKg: 100 },
      { exerciseId: 'bench', reps: 5, weightKg: 80 },
    ]);

    const templateId = await createTemplateFromWorkout(workoutId, 'Jour A');

    const exercises = exercisesOf(templateId);
    expect(exercises.map((e) => e.exercise_id)).toEqual(['squat', 'bench']);
    expect(exercises[0]).toMatchObject({ target_sets: 2, target_weight_kg: 100 });
  });

  it('exclut les séries NON validées', async () => {
    const workoutId = seedWorkout([
      { exerciseId: 'squat', reps: 5, weightKg: 100 },
      { exerciseId: 'squat', reps: 5, weightKg: 100, done: false },
    ]);

    const templateId = await createTemplateFromWorkout(workoutId, 'Jour A');

    expect(exercisesOf(templateId)[0]?.target_sets).toBe(1);
  });

  it('COMPTE les échauffements validés — contrairement au résumé de séance', async () => {
    const workoutId = seedWorkout([
      { exerciseId: 'squat', setType: 'warmup', reps: 15, weightKg: 40 },
      { exerciseId: 'squat', reps: 5, weightKg: 100 },
    ]);

    const templateId = await createTemplateFromWorkout(workoutId, 'Jour A');

    // ⚠️ Divergence **volontaire** entre deux fonctionnalités voisines, et facile à confondre :
    // `buildSummary` (résumé de fin de séance) écarte les échauffements du décompte, parce qu'il
    // rend compte de l'effort ; `deriveTemplateTargetsFromWorkoutSets` les garde, parce qu'un
    // modèle sert à **reproduire** une séance — échauffement compris. Ce test existe pour que la
    // divergence reste un choix et non un oubli : aligner les deux « pour faire propre » casserait
    // le modèle de quelqu'un.
    expect(exercisesOf(templateId)[0]?.target_sets).toBe(2);
  });

  it('FIGE les cibles — modifier la séance après coup ne déforme pas le modèle', async () => {
    const workoutId = seedWorkout([{ exerciseId: 'squat', reps: 10, weightKg: 100 }]);
    const templateId = await createTemplateFromWorkout(workoutId, 'Jour A');

    // La séance d'origine est corrigée après coup (erreur de saisie, série ajoutée…).
    seed('workout_sets', [
      {
        workout_id: workoutId,
        user_id: 'user-1',
        exercise_id: 'squat',
        order_index: 9,
        set_type: 'normal',
        reps: 20,
        weight_kg: 200,
        done: 1,
      },
    ]);

    // Un template qui suivrait sa séance d'origine cesserait d'être un modèle.
    expect(exercisesOf(templateId)[0]).toMatchObject({ target_sets: 1, target_weight_kg: 100 });
  });

  it('rogne le nom', async () => {
    const workoutId = seedWorkout([{ reps: 5, weightKg: 100 }]);

    const templateId = await createTemplateFromWorkout(workoutId, '  Jour A  ');

    expect(templates().find((t) => t.id === templateId)?.name).toBe('Jour A');
  });

  it('crée un modèle vide plutôt que d’échouer sur une séance sans série validée', async () => {
    const workoutId = seedWorkout([{ reps: 5, weightKg: 100, done: false }]);

    const templateId = await createTemplateFromWorkout(workoutId, 'Vide');

    // Un modèle vide est récupérable (on y ajoute des exercices) ; une erreur, non.
    expect(templates().find((t) => t.id === templateId)).toBeDefined();
    expect(exercisesOf(templateId)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Duplication
// ---------------------------------------------------------------------------

describe('duplicateWorkoutTemplate', () => {
  /** Un modèle à deux exercices. */
  async function seedTemplate(): Promise<string> {
    const workoutId = seedWorkout([
      { exerciseId: 'squat', reps: 10, weightKg: 100 },
      { exerciseId: 'bench', reps: 8, weightKg: 60 },
    ]);
    return createTemplateFromWorkout(workoutId, 'Jour A');
  }

  it('copie l’entête et tous les exercices, avec de nouveaux identifiants', async () => {
    const sourceId = await seedTemplate();

    const copyId = await duplicateWorkoutTemplate(sourceId);

    expect(copyId).not.toBe(sourceId);
    expect(templates().find((t) => t.id === copyId)?.name).toBe('Jour A');
    expect(exercisesOf(copyId).map((e) => e.exercise_id)).toEqual(['squat', 'bench']);
    const sourceIds = exercisesOf(sourceId).map((e) => e.id);
    expect(exercisesOf(copyId).every((e) => !sourceIds.includes(e.id))).toBe(true);
  });

  it('conserve les cibles de chaque exercice', async () => {
    const sourceId = await seedTemplate();

    const copyId = await duplicateWorkoutTemplate(sourceId);

    expect(exercisesOf(copyId)[0]).toMatchObject({ target_sets: 1, target_weight_kg: 100 });
  });

  it('ne touche pas la source', async () => {
    const sourceId = await seedTemplate();

    await duplicateWorkoutTemplate(sourceId);

    expect(exercisesOf(sourceId)).toHaveLength(2);
  });

  it('refuse une source introuvable SANS laisser d’entête orpheline', async () => {
    await expect(duplicateWorkoutTemplate('inconnu')).rejects.toThrow(/introuvable/);

    // La transaction est annulée : un template vide serait pire qu'une erreur — il s'afficherait.
    expect(templates(true)).toHaveLength(0);
  });

  it('ne recopie pas un exercice supprimé', async () => {
    const sourceId = await seedTemplate();
    await removeTemplateExercise(exercisesOf(sourceId)[1]!.id);

    const copyId = await duplicateWorkoutTemplate(sourceId);

    expect(exercisesOf(copyId).map((e) => e.exercise_id)).toEqual(['squat']);
  });
});

// ---------------------------------------------------------------------------
// Suppression
// ---------------------------------------------------------------------------

describe('deleteWorkoutTemplate', () => {
  it('supprime en douceur le modèle ET ses exercices', async () => {
    const workoutId = seedWorkout([{ exerciseId: 'squat', reps: 10, weightKg: 100 }]);
    const templateId = await createTemplateFromWorkout(workoutId, 'Jour A');

    await deleteWorkoutTemplate(templateId);

    expect(templates()).toHaveLength(0);
    expect(templateExercises()).toHaveLength(0);
    // Soft delete : tout subsiste, marqué supprimé.
    expect(templates(true)).toHaveLength(1);
    expect(templateExercises(true)).toHaveLength(1);
  });

  it('ne touche pas un autre modèle', async () => {
    const w = seedWorkout([{ reps: 10, weightKg: 100 }]);
    const cible = await createTemplateFromWorkout(w, 'A');
    const autre = await createTemplateFromWorkout(w, 'B');

    await deleteWorkoutTemplate(cible);

    expect(exercisesOf(autre)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Démarrage depuis un modèle
// ---------------------------------------------------------------------------

describe('startWorkoutFromTemplate', () => {
  /** Un modèle à un exercice, 3 séries de 8-12 à 80 kg. */
  async function seedTemplate(): Promise<string> {
    const [templateId] = seed('workout_templates', [{ user_id: 'user-1', name: 'Jour A' }]);
    seed('workout_template_exercises', [
      {
        template_id: templateId,
        user_id: 'user-1',
        exercise_id: 'squat',
        order_index: 0,
        set_type: 'normal',
        target_sets: 3,
        target_reps: '8-12',
        target_weight_kg: 80,
      },
    ]);
    return templateId!;
  }

  it('pré-remplit une séance LIBRE — sans programme ni occurrence planifiée', async () => {
    const templateId = await seedTemplate();

    const workoutId = await startWorkoutFromTemplate(templateId);

    const workout = rowsOf<{
      id: string;
      status: string;
      session_id: string | null;
      program_id: string | null;
      planned_session_id: string | null;
    }>('workouts')[0];
    expect(workout).toMatchObject({
      id: workoutId,
      status: 'active',
      session_id: null,
      program_id: null,
      planned_session_id: null,
    });
  });

  it('crée `target_sets` séries, avec reps et charge pré-remplies', async () => {
    const templateId = await seedTemplate();

    const workoutId = await startWorkoutFromTemplate(templateId);

    const sets = setsOf(workoutId);
    expect(sets).toHaveLength(3);
    expect(sets.map((s) => s.order_index)).toEqual([0, 1, 2]);
    expect(sets[0]).toMatchObject({
      reps: 8, // « 8-12 » → 8
      weight_kg: 80,
      planned_weight_kg: 80, // la cible est conservée à part, pour la comparaison
      done: 0,
    });
  });

  it('crée au moins UNE série même sans cible de séries', async () => {
    const [templateId] = seed('workout_templates', [{ user_id: 'user-1', name: 'Jour A' }]);
    seed('workout_template_exercises', [
      {
        template_id: templateId,
        user_id: 'user-1',
        exercise_id: 'squat',
        order_index: 0,
        set_type: 'normal',
        target_sets: null,
      },
    ]);

    const workoutId = await startWorkoutFromTemplate(templateId!);

    expect(setsOf(workoutId)).toHaveLength(1);
  });

  it('respecte la garde « une seule séance active » — 3ᵉ porte d’entrée, même règle', async () => {
    const templateId = await seedTemplate();
    const [existant] = seed('workouts', [
      { user_id: 'user-1', status: 'active', started_at: new Date().toISOString() },
    ]);

    const workoutId = await startWorkoutFromTemplate(templateId);

    expect(workoutId).toBe(existant);
    // Et surtout : aucune série pré-remplie n'est venue polluer la séance en cours.
    expect(rowsOf('workout_sets')).toHaveLength(0);
  });

  it('ignore les exercices supprimés du modèle', async () => {
    const templateId = await seedTemplate();
    await removeTemplateExercise(exercisesOf(templateId)[0]!.id);

    const workoutId = await startWorkoutFromTemplate(templateId);

    expect(setsOf(workoutId)).toHaveLength(0);
  });
});
