# US Refonte-D — Templates de séance libre — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans, tâche par tâche. Étapes en checkbox (`- [ ]`).

**Goal:** Permettre de composer un template de séance à froid (liste d'exercices + cibles), de l'enregistrer
après coup depuis une séance libre terminée, de démarrer une nouvelle séance libre pré-remplie depuis un
template, et de gérer les templates (éditer/dupliquer/supprimer).

**Architecture:** Deux nouvelles tables dédiées (`workout_templates`/`workout_template_exercises`), sur le
patron exact des repas types nutrition (`meal_templates`/`meal_template_items`) — pas de réutilisation de
`programs`/`sessions`/`exercise_plans`. Un seul nouveau fichier repository
(`workout-template-repository.ts`). La dérivation des cibles depuis une séance terminée est extraite en
**fonction pure testable** dans `packages/shared` (patron C3 : `computeReorderedExerciseOrder`/
`computeProgressionSuggestion`). Les écrans répliquent le patron `programs/` (index/edit/[id]), simplifié
(pas de niveau/objectif/durée/bibliothèque éditoriale).

**Tech Stack:** `packages/shared` (Zod + Vitest). `apps/mobile` (Expo Router, PowerSync `writeTransaction`,
i18next). Aucune dépendance native ajoutée.

**Spec :** [refonte-muscu-d-templates-seance-libre.md](../specs/functional/us/refonte-muscu-d-templates-seance-libre.md)
(validée Florian, 21/07/2026, 2 passages de revue). **Audit :** [audit-flux.md](../refonte-muscu/audit-flux.md)
(problème 5).

**Branche :** `feature/refonte-muscu-d` (créée depuis `dev`).

> **Invariants :**
> - **Offline-first** : écritures optimistes locales (`writeTransaction`/`patch`/`insertWithSyncFields`/
>   `softDelete`), lecture réactive `useQuery`.
> - **🔴 Deux checkpoints cloud distincts** (2 nouvelles tables, base partagée `nsxzflxsgovriwwvflxe`) :
>   `db:push` (CLI) **et** le déploiement des sync rules PowerSync (dashboard, Task 1 étape 6) — chacun
>   **seulement après go explicite de Florian**. Jamais de SQL collé à la main dans la console.
> - **i18n** parité FR/EN stricte, aucune chaîne en dur.
> - **Pas de bibliothèque éditoriale** dans cette US : chaque template est strictement scopé à son
>   propriétaire (`user_id`), aucune notion de partage/curation ici (reportée, cf. spec §7).
> - **Dérivation de cibles** : ne considère que les `workout_sets` **validées** (`done = 1`) d'une séance ;
>   un exercice sans aucune série validée est exclu du template créé.
> - **Aucun lien conservé** entre un template et les séances qu'il a servi à démarrer (pas de FK
>   `template_id` sur `workouts`) — supprimer/modifier un template n'affecte jamais l'historique.
> - À chaque commit : `npm run typecheck` + `npm run lint -w @wellness/mobile` + `npm run test` verts. Ne
>   jamais stager `apps/mobile/eas.json`. Tests mobile jest-expo non câblés → vérif typecheck/lint + relecture
>   + recette device ; la fonction pure (shared) suit TDD strict.

---

## Task 1 : Migration cloud (🔴 checkpoint)

**Files:** Create `supabase/migrations/<horodatage>_refonte_muscu_d_workout_templates.sql` ; Modify
`supabase/MIGRATIONS.md`, `packages/shared/src/database.types.ts` (régénéré).

- [ ] **Étape 1 — créer le fichier.** `npm run db:new refonte_muscu_d_workout_templates` puis copier le SQL
  complet de la spec §4.1 (tables `workout_templates` + `workout_template_exercises`, index partiel, triggers
  `set_updated_at`, publication `powersync`, RLS select/insert/update sans delete — patron
  `meal_templates`/`meal_template_items` combiné en un seul fichier, style C3).
- [ ] **Étape 2 — prévisualiser.** `npm run db:push:dry` ; vérifier que **seule** cette migration part.
- [ ] **Étape 3 — 🔴 GO explicite Florian**, puis `npm run db:push`. Vérifier « Remote database is up to date ».
- [ ] **Étape 4 — types.** `npm run db:types`. Vérifier que `workout_templates.Row` et
  `workout_template_exercises.Row` apparaissent dans `database.types.ts` avec les bonnes colonnes nullables.
- [ ] **Étape 5 — registre.** Cocher dans `supabase/MIGRATIONS.md` (case + date + note « US-D »).
- [ ] **Étape 6 — 🔴 sync rules PowerSync (2ᵉ checkpoint, séparé du `db:push`).** Sans cette étape, les deux
  tables existent côté Postgres/publication/schéma SQLite local mais **aucun bucket ne les sert** : les
  écritures locales optimistes fonctionnent quand même (illusion de succès en recette sur un seul appareil),
  mais rien ne redescend du cloud — perte de durabilité multi-appareil, violation de l'offline-first (patron
  déjà rencontré pour `exercise_notes` en C3, cf. `docs/refonte-muscu` sur ce piège).
  Modifier `docs/specs/technical/powersync-sync-rules.yaml`, section `user_data.data`, bloc « Musculation »
  (après la ligne `workout_superset_pairs`) :
  ```yaml
  - select * from workout_templates          where user_id = bucket.user_id and deleted_at is null
  - select * from workout_template_exercises where user_id = bucket.user_id and deleted_at is null
  ```
  (réaligner les `where` de ces deux lignes avec les colonnes du fichier réel au moment du collage —
  cosmétique, sans impact fonctionnel).
  Puis **🔴 GO explicite Florian** avant de coller ce YAML complet dans le dashboard PowerSync (Settings →
  Sync Rules) et cliquer **Deploy** (action manuelle, hors CLI — même geste que pour chaque table
  précédente, ex. `meal_templates`/`meal_template_items`).
- [ ] **Étape 7 — commit** (`feat(db)`, inclut la modif du fichier sync rules), typecheck vert.

> ⚠️ Non idempotente (comme toutes les migrations `create table` du projet) : ne jamais rejouer.
> ⚠️ Les étapes 3 (`db:push`) et 6 (déploiement sync rules) sont **deux checkpoints cloud distincts** : la
> migration SQL et le déploiement des sync rules ne se font pas dans le même geste (l'un est CLI, l'autre
> dashboard) — ne pas considérer la migration « terminée » tant que l'étape 6 n'est pas faite.

---

## Task 2 : Partagé — dérivation des cibles depuis une séance (packages/shared)

**Files:** Modify `packages/shared/src/workout.ts` ; Test `packages/shared/src/workout.test.ts`. **Lis les
deux fichiers d'abord** (types `SetType`, fonctions déjà extraites `computeReorderedExerciseOrder`/
`computeProgressionSuggestion` — même emplacement/style).

Isole la règle de dérivation des cibles d'un template à partir des `workout_sets` d'une séance terminée
(spec §3), pour la couvrir par Vitest (le reste de l'US est mobile-only, sans tests automatisés).

- [ ] **Étape 1 — test rouge.** Ajouter `describe('deriveTemplateTargetsFromWorkoutSets')` dans
  `workout.test.ts` :
  - Séance vide (`[]`) → `[]`.
  - Un seul exercice, 3 séries toutes `done: true`, ordre `[normal(10,80), normal(8,82.5), normal(6,85)]`
    (reps/weightKg) → `[{ exerciseId, setType: 'normal', targetSets: 3, targetReps: '6', targetWeightKg: 85 }]`
    (cibles dérivées de la **dernière** série validée, `targetSets` = nombre de séries validées).
  - Un exercice avec 2 séries `done: true` + 1 `done: false` en dernière position → la série `done: false`
    est **ignorée** pour `targetReps`/`targetWeightKg` (dérivés de la dernière **validée**), mais comptée
    **hors** de `targetSets` (qui ne compte que les validées) : `targetSets: 2`, cibles = celles de la 2ᵉ série
    (dernière validée).
  - Un exercice dont **aucune** série n'est `done: true` (toutes `false`) → **exclu** du résultat (tableau
    plus court, pas d'entrée `null`/undefined à filtrer par l'appelant).
  - Deux exercices, ordre de première apparition **préservé** même si leurs séries sont entrelacées dans
    `order_index` (ex. A,B,A,B) → résultat `[A, B]` dans l'ordre de première apparition, pas l'ordre
    alphabétique ni l'ordre de `order_index` brut.
  - `set_type` du résultat = celui de la **première série validée** de l'exercice (pas la dernière), même si
    les séries suivantes ont un autre type (ex. `warmup` puis `normal` → `set_type: 'warmup'`, cas volontaire
    et documenté — l'utilisateur corrige ensuite dans l'éditeur de template).
  Lancer `npm run test -w @wellness/shared` → rouge (fonction absente).
- [ ] **Étape 2 — implémentation.**
```ts
/** Une série de séance, telle que lue depuis `workout_sets` (déjà triée par `order_index`). */
export type WorkoutSetForTemplateDerivation = {
  exerciseId: string;
  setType: string;
  reps: number | null;
  weightKg: number | null;
  done: boolean;
};

/** Cibles d'un exercice de template, dérivées d'une séance terminée (US Refonte-D §3). */
export type DerivedTemplateExerciseTarget = {
  exerciseId: string;
  setType: string;
  targetSets: number;
  targetReps: string | null;
  targetWeightKg: number | null;
};

/**
 * Dérive les cibles d'un template à partir des séries **validées** d'une séance libre
 * terminée (US Refonte-D §3, `createTemplateFromWorkout`). Ne considère que les séries
 * `done: true` : une série jamais validée n'a pas été réellement faite, elle ne doit pas
 * définir un template. Un exercice sans aucune série validée est exclu du résultat.
 * L'ordre du résultat suit l'ordre de **première apparition** de chaque exercice dans
 * `sets` (déjà trié par `order_index` par l'appelant).
 */
export function deriveTemplateTargetsFromWorkoutSets(
  sets: ReadonlyArray<WorkoutSetForTemplateDerivation>,
): DerivedTemplateExerciseTarget[] {
  const order: string[] = [];
  const byExercise = new Map<string, WorkoutSetForTemplateDerivation[]>();

  for (const set of sets) {
    if (!byExercise.has(set.exerciseId)) {
      byExercise.set(set.exerciseId, []);
      order.push(set.exerciseId);
    }
    byExercise.get(set.exerciseId)!.push(set);
  }

  const results: DerivedTemplateExerciseTarget[] = [];
  for (const exerciseId of order) {
    const exerciseSets = byExercise.get(exerciseId)!;
    const doneSets = exerciseSets.filter((s) => s.done);
    if (doneSets.length === 0) continue;

    const first = doneSets[0]!;
    const last = doneSets[doneSets.length - 1]!;
    results.push({
      exerciseId,
      setType: first.setType,
      targetSets: doneSets.length,
      targetReps: last.reps == null ? null : String(last.reps),
      targetWeightKg: last.weightKg,
    });
  }
  return results;
}
```
- [ ] **Étape 3 — vérifier vert.** `npm run test -w @wellness/shared` + `npm run typecheck`. Commit
  (`feat(shared)`).

---

## Task 3 : Schéma PowerSync local (apps/mobile)

**Files:** Modify `apps/mobile/src/powersync/schema.ts`. **Lis le fichier d'abord** (patron des tables
existantes, ex. `exercise_plans`/`meal_templates`).

- [ ] **Étape 1 —** ajouter la table `workout_templates` (`user_id: column.text`, `name: column.text`,
  `created_at`/`updated_at`/`deleted_at: column.text`).
- [ ] **Étape 2 —** ajouter la table `workout_template_exercises` (`template_id: column.text`, `user_id:
  column.text`, `exercise_id: column.text`, `order_index: column.integer`, `set_type: column.text`,
  `target_sets: column.integer`, `target_reps: column.text`, `target_weight_kg: column.real`,
  `rest_seconds: column.integer`, `created_at`/`updated_at`/`deleted_at: column.text`).
- [ ] **Étape 3 —** ajouter les deux tables à l'export `AppSchema`.
- [ ] **Étape 4 — vérifier** `npm run typecheck`. Commit (`feat(mobile)`).

---

## Task 4 : workout-repository.ts — modifications connexes

**Files:** Modify `apps/mobile/src/data/repositories/workout-repository.ts`. **Lis `WorkoutHistoryItem`/
`WorkoutDbRow`/`SELECT_HISTORY`/`rowToHistoryItem` (~l.71-191) et `parseTargetReps` (~l.470) d'abord.**

- [ ] **Étape 1 — exporter `parseTargetReps`.** Ligne ~470 : ajouter `export` devant `function
  parseTargetReps`. Aucun changement de comportement, juste la visibilité (réutilisé par
  `workout-template-repository.ts`, Task 6).
- [ ] **Étape 2 — `WorkoutDbRow`** (~l.94-103) : ajouter `program_id: string | null`.
- [ ] **Étape 3 — `SELECT_HISTORY`** (~l.154-159) : ajouter `program_id` à la liste des colonnes
  sélectionnées (`SELECT id, started_at, finished_at, duration_seconds, rpe, notes, session_id, program_id
  FROM workouts ...`).
- [ ] **Étape 4 — `WorkoutHistoryItem`** (~l.71-78) : ajouter `sessionId: string | null` et `programId: string
  | null`.
- [ ] **Étape 5 — `rowToHistoryItem`** (~l.182-191) : mapper `sessionId: row.session_id` et `programId:
  row.program_id` (le champ `session_id` est déjà présent dans `WorkoutDbRow`/`SELECT_HISTORY`, seul son
  mapping vers `WorkoutHistoryItem` manquait).
- [ ] **Étape 6 — vérifier** `npm run typecheck` + `npm run lint -w @wellness/mobile`. Vérifier qu'aucun
  appelant existant de `useWorkoutHistory`/`WorkoutHistoryItem` (`workout-summary.tsx`, historique) ne casse
  (extension additive, pas de champ retiré). Commit (`feat(mobile)`).

---

## Task 5 : Nouveau repository — CRUD templates (lecture + gestion)

**Files:** Create `apps/mobile/src/data/repositories/workout-template-repository.ts`. **Lis
`meal-template-repository.ts` (patron lecture réactive + écritures) et `program-repository.ts`
(`nextOrderIndex`, `removeSession`, `duplicateProgram` — patron cascade/transaction) d'abord.**

- [ ] **Étape 1 — types de domaine.**
```ts
import { useQuery } from '@powersync/react';
import { useTranslation } from 'react-i18next';
import type { SetType } from '@wellness/shared';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, nowUtc, patch, softDelete, txInsert } from './_sql';

export type WorkoutTemplateListItem = {
  id: string;
  name: string;
  exerciseCount: number;
};

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
```
- [ ] **Étape 2 — lignes brutes + requêtes SQL.**
```ts
type TemplateListDbRow = { id: string; name: string; exercise_count: number };

const SELECT_TEMPLATES = `
  SELECT t.id, t.name, COUNT(e.id) AS exercise_count
  FROM workout_templates t
  LEFT JOIN workout_template_exercises e ON e.template_id = t.id AND e.deleted_at IS NULL
  WHERE t.deleted_at IS NULL
  GROUP BY t.id
  ORDER BY t.name COLLATE NOCASE
`;

type TemplateHeaderDbRow = { id: string; name: string };

type TemplateExerciseDbRow = {
  id: string;
  exercise_id: string;
  order_index: number;
  set_type: string;
  target_sets: number | null;
  target_reps: string | null;
  target_weight_kg: number | null;
  rest_seconds: number | null;
  exercise_name: string | null;
};

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
```
- [ ] **Étape 3 — lecture réactive.**
```ts
export function useWorkoutTemplates(): { templates: WorkoutTemplateListItem[]; isLoading: boolean } {
  const { data, isLoading } = useQuery<TemplateListDbRow>(SELECT_TEMPLATES);
  return {
    templates: data.map((t) => ({ id: t.id, name: t.name, exerciseCount: t.exercise_count })),
    isLoading,
  };
}

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
  if (!header) return { detail: null, isLoading };

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
```
- [ ] **Étape 4 — écritures CRUD.**
```ts
function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new Error('Aucune session active : impossible d’écrire un template.');
  return userId;
}

async function nextTemplateOrderIndex(templateId: string): Promise<number> {
  const row = await powerSync.getOptional<{ max_index: number | null }>(
    `SELECT MAX(order_index) AS max_index FROM workout_template_exercises
     WHERE template_id = ? AND deleted_at IS NULL`,
    [templateId],
  );
  const max = row?.max_index;
  return max === null || max === undefined ? 0 : max + 1;
}

export async function createWorkoutTemplate(name: string): Promise<string> {
  const userId = currentUserId();
  return insertWithSyncFields('workout_templates', { user_id: userId, name: name.trim() });
}

export async function renameWorkoutTemplate(templateId: string, name: string): Promise<void> {
  await patch('workout_templates', templateId, { name: name.trim() });
}

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

export async function updateTemplateExercise(
  id: string,
  input: TemplateExercisePatch,
): Promise<void> {
  const columns: Record<string, unknown> = {};
  if ('setType' in input) columns['set_type'] = input.setType;
  if ('targetSets' in input) columns['target_sets'] = input.targetSets;
  if ('targetReps' in input) columns['target_reps'] = input.targetReps;
  if ('targetWeightKg' in input) columns['target_weight_kg'] = input.targetWeightKg;
  if ('restSeconds' in input) columns['rest_seconds'] = input.restSeconds;
  await patch('workout_template_exercises', id, columns);
}

export async function removeTemplateExercise(id: string): Promise<void> {
  await softDelete('workout_template_exercises', id);
}

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
```
- [ ] **Étape 5 — vérifier** `npm run typecheck` + `npm run lint -w @wellness/mobile`. Commit
  (`feat(mobile)`).

---

## Task 6 : Repository — enregistrer depuis une séance + démarrer depuis un template

**Files:** Modify `apps/mobile/src/data/repositories/workout-template-repository.ts`. **Lis
`startWorkout`/`startWorkoutFromSession` (~l.396-577 de `workout-repository.ts`) d'abord — même garde et
même convention `planned_weight_kg`.**

- [ ] **Étape 1 — import de la fonction pure et de `parseTargetReps`.**
```ts
import { deriveTemplateTargetsFromWorkoutSets } from '@wellness/shared';
import { parseTargetReps } from './workout-repository';
```
- [ ] **Étape 2 — `createTemplateFromWorkout`.**
```ts
export async function createTemplateFromWorkout(workoutId: string, name: string): Promise<string> {
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
    const templateId = await txInsert(tx, 'workout_templates', { user_id: userId, name: name.trim() });
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
```
- [ ] **Étape 3 — `startWorkoutFromTemplate`** (même garde anti-double-séance que `startWorkout`, même
  convention de pré-remplissage que `startWorkoutFromSession`) :
```ts
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
```
- [ ] **Étape 4 — vérifier** `npm run typecheck` + `npm run lint -w @wellness/mobile`. Relire attentivement la
  correspondance avec les cas Vitest de Task 2 (dérivation) et la convention `planned_weight_kg` de
  `startWorkoutFromSession`. Commit (`feat(mobile)`).

---

## Task 7 : UI — extraire le composant présentation cibles + créer `TemplateExerciseEditor`

**Files:** Modify `apps/mobile/src/components/programs/ExercisePlanEditor.tsx` ; Create
`apps/mobile/src/components/programs/ExerciseTargetsFields.tsx`, `apps/mobile/src/components/templates/TemplateExerciseEditor.tsx`.
**Lis `ExercisePlanEditor.tsx` et `CurrentSetCard.tsx` (`TYPE_CHIPS`, ~l.19) d'abord.**

- [ ] **Étape 1 — extraire `ExerciseTargetsFields.tsx`.** Composant présentation pur : les 4 champs actuels de
  `ExercisePlanEditor` (séries, reps, charge, repos) + suppression, **valeurs et callbacks en props** (pas de
  dépendance à `program-repository`) :
```ts
export type ExerciseTargetsFieldsProps = {
  exerciseName: string;
  sets: string;
  onChangeSets: (v: string) => void;
  onBlurSets: () => void;
  reps: string;
  onChangeReps: (v: string) => void;
  onBlurReps: () => void;
  weight: string;
  onChangeWeight: (v: string) => void;
  onBlurWeight: () => void;
  weightSymbol: string;
  weightPlaceholder: string;
  rest: string;
  onChangeRest: (v: string) => void;
  onBlurRest: () => void;
  onRemove: () => void;
  removeA11yLabel: string;
};
```
  Déplacer le JSX des 4 champs tel quel (mêmes styles) **et exporter** les 3 fonctions utilitaires
  `toPositiveInt`/`toNonNegativeInt`/`numToStr` depuis `ExerciseTargetsFields.tsx` (`export function ...`) —
  elles servent à la fois au wrapper `ExercisePlanEditor` (état initial `useState(numToStr(plan.targetSets))`
  et conversion dans les `commitX`) et au nouveau `TemplateExerciseEditor` (Étape 4). Ne pas les dupliquer.
- [ ] **Étape 2 — `ExercisePlanEditor.tsx` devient un wrapper fin** : conserve sa signature `{ plan: PlanItem
  }`, **importe `toPositiveInt`/`toNonNegativeInt`/`numToStr` depuis `./ExerciseTargetsFields`**, garde l'état
  local (`sets`/`reps`/`weight`/`rest`, initialisé via `numToStr`/`weightInputValue`) et les fonctions
  `commitX` qui appellent `updateExercisePlan`/`removeExercisePlan` (utilisant `toPositiveInt`/
  `toNonNegativeInt` pour parser), mais délègue tout le rendu à `<ExerciseTargetsFields ... />`. **Aucun
  changement de comportement pour les appelants** (`SessionEditor.tsx`).
- [ ] **Étape 3 — vérifier non-régression programmes.** `npm run typecheck` + `npm run lint -w
  @wellness/mobile`. Relire `programs/edit.tsx` en tête pour confirmer qu'aucune prop publique n'a changé.
  Commit (`refactor(mobile)`).
- [ ] **Étape 4 — nouveau `TemplateExerciseEditor.tsx`** (dossier `components/templates/`, nouveau) : même
  patron que `ExercisePlanEditor` (état local + `commitX` → `updateTemplateExercise`/
  `removeTemplateExercise`, **importe** `toPositiveInt`/`toNonNegativeInt`/`numToStr` depuis
  `@/components/programs/ExerciseTargetsFields`), rendu = `<ExerciseTargetsFields ... />` **plus** un 5ᵉ champ
  **nouveau** : une
  rangée de chips pour `set_type` (7 valeurs : `normal`, `warmup`, `superset`, `duration`, `bodyweight`,
  `dropset`, `failure` — **toutes**, contrairement à `TYPE_CHIPS` de `CurrentSetCard.tsx` qui n'en expose que
  5 car `warmup`/`superset` y ont un traitement spécial live ; ici un template n'a besoin que d'un choix
  déclaratif simple, sans raccourci 1-tap ni dialogue de liaison). Prop `plan: WorkoutTemplateExerciseItem`.
```ts
const TEMPLATE_SET_TYPES: SetType[] = [
  'normal', 'warmup', 'superset', 'duration', 'bodyweight', 'dropset', 'failure',
];
```
  Rendu chip : même style que `CurrentSetCard.renderChip` (Pressable + `accessibilityState={{selected}}`),
  libellé `t(\`workout.setType.${type}\`)` (clés déjà existantes, réutilisées telles quelles).
- [ ] **Étape 5 — vérifier** `npm run typecheck` + `npm run lint -w @wellness/mobile`. Commit
  (`feat(mobile)`).

---

## Task 8 : UI — écrans `templates/` (liste, composition, détail)

**Files:** Create `apps/mobile/src/app/templates/_layout.tsx`, `apps/mobile/src/app/templates/index.tsx`,
`apps/mobile/src/app/templates/edit.tsx`, `apps/mobile/src/app/templates/[id].tsx`,
`apps/mobile/src/components/templates/TemplateComposer.tsx`. **Lis
`programs/_layout.tsx`, `programs/index.tsx`, `programs/edit.tsx`, `programs/[id].tsx` en entier d'abord —
patron répliqué à l'identique en plus simple (pas de niveau/objectif/durée/filtre/bibliothèque).**

- [ ] **Étape 1 — `templates/_layout.tsx`** : copie conforme de `programs/_layout.tsx` (`<Stack
  screenOptions={{ headerShown: false }} />`).
- [ ] **Étape 2 — `templates/index.tsx`** : liste réactive `useWorkoutTemplates()` (nom + `exerciseCount` via
  `t('templates.exerciseCount', { count })`), bouton **« + »** dans `ScreenHeader.action` → `router.push('/templates/edit')`.
  Gère le **mode sélection** (§2.3/§2.4 de la spec) via un paramètre de route optionnel :
  `useLocalSearchParams<{ selectMode?: string }>()`. Si `selectMode` est présent : tap sur une ligne appelle
  `startWorkoutFromTemplate(id)` puis `router.replace('/workout')` (loading local par id, patron
  `onStartSession` de `programs/[id].tsx`) ; les lignes dont `exerciseCount === 0` sont **désactivées**
  (`disabled`, style atténué, cf. spec §2.3). Sinon (mode normal) : tap → `router.push(\`/templates/${id}\`)`.
- [ ] **Étape 3 — composant partagé `TemplateComposer.tsx`** (`apps/mobile/src/components/templates/`,
  nouveau) : contrairement au patron `programs/` (où `edit.tsx?id=` et `[id].tsx` affichent deux rendus
  **différents** — composition éditable vs lecture seule), ici les deux routes de l'Étape 4/5 doivent
  afficher le **même** contenu éditable (un template est toujours possédé par l'utilisateur courant, jamais
  de distinction éditorial/lecture seule). Pour éviter ~100 lignes dupliquées entre deux fichiers `app/`,
  extraire ce contenu dans un composant partagé, props `{ templateId: string }` :
  `useWorkoutTemplateDetail(templateId)`, nom éditable en tête (`TextField`, `onBlur` →
  `renameWorkoutTemplate`), liste des exercices via `TemplateExerciseEditor` (Task 7), bouton **« + Ajouter un
  exercice »** → `ExercisePicker` (réutilisé tel quel, `onPick` → `addTemplateExercise(templateId, {
  exerciseId })`). Ni bouton « Terminé » ni actions Démarrer/Dupliquer/Supprimer dans ce composant — ce sont
  les deux écrans appelants (Étapes 4/5) qui les ajoutent autour.
- [ ] **Étape 4 — `templates/edit.tsx`** : sans `?id=` → formulaire nom seul (`TextField` + bouton
  `templates.create`), `createWorkoutTemplate(name)` puis `router.replace(\`/templates/edit?id=${id}\`)` (patron
  exact `ProgramCreateForm`/`onCreated`). Avec `?id=` → `<TemplateComposer templateId={id} />` (Étape 3) +
  bouton « Terminé » → `router.back()` (patron `ProgramComposer`/`onDone`).
- [ ] **Étape 5 — `templates/[id].tsx`** : `<TemplateComposer templateId={id} />` (Étape 3, même contenu que
  `edit.tsx?id=`) **plus** les actions **Démarrer** (`startWorkoutFromTemplate` + `router.push('/workout')`,
  désactivée si `detail.exercises.length === 0` — nécessite son propre `useWorkoutTemplateDetail(id)` pour
  connaître ce compte, en plus de celui interne à `TemplateComposer`), **Dupliquer** (`duplicateWorkoutTemplate`
  + `router.replace(\`/templates/${newId}\`)`), **Supprimer** (`Alert.alert` confirmation →
  `deleteWorkoutTemplate` + `router.replace('/templates')`, patron exact `ProgramDetailScreen.onDelete`/
  `handleDelete`).
- [ ] **Étape 6 — vérifier** `npm run typecheck` + `npm run lint -w @wellness/mobile`. Commit
  (`feat(mobile)`).

---

## Task 9 : Hub muscu — choix à blanc/template

**Files:** Modify `apps/mobile/src/app/(tabs)/strength.tsx`. **Lis le fichier en entier d'abord (3 branches
de carte : `active`, `today.state === 'today-session'`, sinon libre).**

- [ ] **Étape 1 — choix sur la carte « Séance libre ».** Le bouton `workout.startFree` (branche libre,
  ~l.119) : remplacer `onPress={onStart}` par un handler qui ouvre `Alert.alert(t('workout.freeStart.title'),
  undefined, [{ text: t('workout.freeStart.blank'), onPress: () => void onStart() }, { text:
  t('workout.freeStart.fromTemplate'), onPress: () => router.push('/templates?selectMode=1') }, { text:
  t('common.cancel'), style: 'cancel' }])`.
- [ ] **Étape 2 — lien secondaire sur la carte « Séance du jour ».** Sous le bouton `home.today.cta` (branche
  `today.state === 'today-session'`, ~l.102-106) : ajouter un `Pressable` texte discret (même style que
  `todayNoteRow`/`todayNoteText` déjà existants dans le fichier) libellé `workout.freeStart.fromTemplate`, qui
  navigue vers `router.push('/templates?selectMode=1')`. Pas d'ajout sur la carte `active` (séance déjà en
  cours).
- [ ] **Étape 3 — vérifier** `npm run typecheck` + `npm run lint -w @wellness/mobile`. Relire que la carte
  « Reprendre » (`active`) reste inchangée. Commit (`feat(mobile)`).

---

## Task 10 : Écran résumé — enregistrer comme template

**Files:** Modify `apps/mobile/src/app/workout-summary.tsx`. **Lis le fichier en entier d'abord (en
particulier le footer ~l.251-253 et le type `Summary`/`buildSummary`).**

- [ ] **Étape 1 — état local.** Ajouter `const [savingAsTemplate, setSavingAsTemplate] = useState(false)` et
  `const [templateName, setTemplateName] = useState('')`.
- [ ] **Étape 2 — condition de visibilité.** Le bouton n'apparaît que si `workout?.sessionId === null &&
  workout?.programId === null && summary !== null && summary.exercises > 0` (champs `sessionId`/`programId`
  ajoutés à `WorkoutHistoryItem` en Task 4).
- [ ] **Étape 3 — rendu.** Sous la `Card` du récapitulatif, avant `FeelingSection` (ou dans le footer, à la
  discrétion de l'implémenteur — cohérence visuelle avec le reste de l'écran) : si `!savingAsTemplate`, un
  bouton `variant="ghost"` libellé `workout.summary.saveAsTemplate` qui met `savingAsTemplate` à `true` et
  pré-remplit `templateName` (ex. `t('workout.summary.saveAsTemplateDefaultName', { date: <JJ/MM dérivé de
  workout.startedAt> })`). Si `savingAsTemplate`, un `TextField` (valeur `templateName`) + deux boutons
  « Valider »/« Annuler » : Valider → `createTemplateFromWorkout(workout.id, templateName)` puis
  `Alert.alert(t('workout.summary.templateSaved'), templateName)` et `setSavingAsTemplate(false)` ; Annuler
  → `setSavingAsTemplate(false)` sans écriture.
- [ ] **Étape 4 — vérifier** `npm run typecheck` + `npm run lint -w @wellness/mobile`. Commit
  (`feat(mobile)`).

---

## Task 11 : i18n FR/EN + parité

**Files:** Modify `apps/mobile/src/i18n/locales/fr.json` + `en.json`.

- [ ] **Étape 1 — clés `templates.*`** : `title`, `subtitle`, `create`, `createTitle`, `createSubtitle`, `name`,
  `namePlaceholder`, `editTitle`, `editSubtitle`, `addExercise`, `done`, `start`, `starting`, `duplicate`,
  `duplicating`, `delete`, `deleting`, `deleteConfirm`, `removeExerciseA11y`, `emptyList`, `emptyExercises`,
  `exerciseCount` (pluriel `{count}`), `notFoundTitle`, `notFoundMessage`.
- [ ] **Étape 2 — clés `workout.freeStart.*`** : `title`, `blank`, `fromTemplate`.
- [ ] **Étape 3 — clés `workout.summary.*` (nouvelles)** : `saveAsTemplate`, `saveAsTemplateDefaultName`
  (interpolation `{{date}}`), `templateSaved`, `templateNamePlaceholder`.
- [ ] **Étape 4 — parité.** Contrôle node ad hoc (même script que C2/C3 — comparaison des clés aplaties
  FR/EN) → 2 listes vides.
- [ ] **Étape 5 — vérifier** typecheck/lint. Commit (`feat(i18n)`).

---

## Task 12 : Vérification finale & recette

- [ ] `npm run typecheck` + `npm run lint` + `npm run test` (tous workspaces) verts.
- [ ] **Non-régression programmes** : édition d'un plan d'exercice de programme (4 champs) toujours
  fonctionnelle après le refactor Task 7.
- [ ] **Non-régression hub/résumé** : démarrage « Séance libre » à blanc (choix « À blanc ») et écran résumé
  d'une séance planifiée (bouton « Enregistrer comme template » absent) inchangés.
- [ ] **Recette device (Florian)** :
  - Composer un template à froid : créer, nommer, ajouter 2-3 exercices avec cibles (dont un type de série
    non-`normal`), réordonner en éditant à nouveau (`targetSets`/`targetReps`/`targetWeightKg`), supprimer un
    exercice du template.
  - Terminer une séance libre avec au moins un exercice comportant une série validée → « Enregistrer comme
    template » visible, saisir un nom, vérifier le template créé (cibles = dernière série validée par
    exercice).
  - Terminer une séance **planifiée** (depuis un programme) → bouton « Enregistrer comme template »
    **absent**.
  - Démarrer une séance depuis un template (« Séance libre » → « Depuis un template ») : vérifier
    pré-remplissage (nombre de séries, reps, charge **et** charge planifiée affichée comme pour une séance de
    programme).
  - Jour avec une séance planifiée (US-B) : vérifier le lien « Ou depuis un template » sous la carte « Séance
    du jour ».
  - Dupliquer un template, renommer la copie, supprimer l'original → la copie reste intacte.
  - Supprimer un template déjà utilisé pour démarrer une séance passée → l'historique de cette séance n'est
    pas affecté.
- [ ] CHANGELOG + TODO + roadmap (US-D marquée `[x]`, mention chantier refonte Muscu complet A→D) via
  `/commit` ; PR relue par les deux devs.

---

## Ordre & dépendances

Task 1 (migration) bloque 3/5/6 (tables cibles). Task 2 (shared) avant 6 (fonction pure importée). Task 4
avant 6 et 10 (`parseTargetReps` exporté, `sessionId`/`programId` sur l'historique). Task 5 avant 6 (types de
domaine/écritures CRUD de base réutilisés). Tasks 7 et 8 dépendent l'une de l'autre (8 consomme les
composants créés en 7) mais sont indépendantes de 1-6 côté **lecture** (peuvent démarrer dès le schéma
PowerSync de Task 3 posé, tant que les vrais hooks de Task 5 ne sont pas encore branchés — en pratique,
enchaîner 5 → 7 → 8 dans l'ordre reste le chemin le plus simple). Task 9 dépend de Task 8 (route
`/templates`). Task 10 dépend de Task 4 et Task 6 (`createTemplateFromWorkout`). Task 11 (i18n) transverse,
verrouillée en fin — mais les clés `workout.setType.*` (Task 7, sélecteur) existent déjà, aucune dépendance
bloquante. Task 12 = porte de sortie. Migration = **seul** point cloud → une passe, go explicite.
