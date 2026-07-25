# Plan d'implémentation — MUSC-F10c-1 (muscles secondaires)

> **Pour les workers agentiques :** SOUS-SKILL REQUISE — `superpowers:subagent-driven-development`
> (ou `superpowers:executing-plans`) pour exécuter ce plan tâche par tâche. Les étapes utilisent des
> cases (`- [ ]`).

**But :** ajouter aux exercices une liste de **muscles secondaires** (0..N groupes musculaires),
saisie en back-office admin et affichée sur la fiche exercice mobile (mode lecture).

**Architecture :** nouvelle colonne `exercises.muscles_secondary jsonb default '[]'` (additive,
table déjà répliquée PowerSync). Écriture éditoriale (admin, jsonb natif via supabase-js) ; lecture
mobile (PowerSync `column.text` → `parseJsonColumn`). Une fonction pure partagée
`normalizeSecondaryMuscles` garantit l'invariant *primaire ∉ secondaires*, la déduplication et le
filtrage des valeurs invalides. Filtre MUSC-F3 **inchangé** (primaire seul).

**Stack :** Postgres (Supabase CLI), PowerSync, Zod + Vitest (`packages/shared`), React (admin Vite),
React Native/Expo (mobile), i18next FR/EN.

**Spec :** [docs/specs/functional/us/muscf10c1-muscles-secondaires.md](../specs/functional/us/muscf10c1-muscles-secondaires.md)

---

## Structure des fichiers

- `supabase/migrations/<horodaté>_muscf10c1_exercises_muscles_secondary.sql` — **créer** (ALTER TABLE).
- `supabase/MIGRATIONS.md` — **modifier** (cocher).
- `packages/shared/src/database.types.ts` — **régénéré** (`db:types`).
- `apps/mobile/src/powersync/schema.ts` — **modifier** (`muscles_secondary: column.text`).
- `packages/shared/src/exercise.ts` — **modifier** (`normalizeSecondaryMuscles` + `exerciseRowSchema`).
- `packages/shared/src/exercise.test.ts` — **créer/modifier** (tests Vitest).
- `apps/admin/src/data/exercises.ts` — **modifier** (types + get/save).
- `apps/admin/src/screens/ExerciseEditScreen.tsx` — **modifier** (multi-sélecteur).
- `apps/admin/src/i18n/fr.ts` — **modifier** (`secondaryMusclesLabel`).
- `apps/mobile/src/data/repositories/exercise-repository.ts` — **modifier** (détail seulement).
- `apps/mobile/src/app/exercises/[id].tsx` — **modifier** (ligne d'affichage).
- `apps/mobile/src/i18n/locales/fr.json` + `en.json` — **modifier** (`exercises.detail.secondaryMuscles`).

---

## Task 1 : Migration + schéma PowerSync

**Files:**
- Create: `supabase/migrations/<horodaté>_muscf10c1_exercises_muscles_secondary.sql`
- Modify: `apps/mobile/src/powersync/schema.ts` (table `exercises`)
- Modify: `supabase/MIGRATIONS.md`
- Regen: `packages/shared/src/database.types.ts`

- [ ] **Étape 1 : créer la migration**

```bash
npm run db:new muscf10c1_exercises_muscles_secondary
```

Contenu SQL du fichier généré :

```sql
-- MUSC-F10c-1 : muscles secondaires sur les exercices (0..N groupes musculaires).
-- Additif, rétrocompatible : les lignes existantes prennent '[]'. La table exercises
-- est déjà dans la publication PowerSync → aucun changement de sync rule.
alter table public.exercises
  add column muscles_secondary jsonb not null default '[]'::jsonb;
```

- [ ] **Étape 2 : prévisualiser** — `npm run db:push:dry` (vérifie que seule cette migration part).
- [ ] **Étape 3 : STOP — demander le feu vert de Florian avant `db:push`** (base cloud partagée).
- [ ] **Étape 4 : pousser** — `npm run db:push` (après feu vert).
- [ ] **Étape 5 : régénérer les types** — `npm run db:types` (met à jour `database.types.ts`).
- [ ] **Étape 6 : cocher** la migration dans `supabase/MIGRATIONS.md` (case + date du jour).
- [ ] **Étape 7 : schéma PowerSync** — dans `apps/mobile/src/powersync/schema.ts`, table `exercises`,
      ajouter après `media_url: column.text,` :

```ts
  muscles_secondary: column.text, // JSON [MuscleGroup] — MUSC-F10c-1 (éditorial)
```

- [ ] **Étape 8 : vérifier** — `npm run typecheck` (vert).
- [ ] **Étape 9 : commit**

```bash
git add supabase/migrations apps/mobile/src/powersync/schema.ts supabase/MIGRATIONS.md packages/shared/src/database.types.ts
git commit -m "feat(muscf10c1): colonne muscles_secondary + schema powersync"
```

---

## Task 2 : Partagé — `normalizeSecondaryMuscles` + schéma (TDD)

**Files:**
- Modify: `packages/shared/src/exercise.ts`
- Test: `packages/shared/src/exercise.test.ts`

- [ ] **Étape 1 : écrire les tests d'abord** (`exercise.test.ts`) :

```ts
import { describe, it, expect } from 'vitest';
import { normalizeSecondaryMuscles, exerciseRowSchema } from './exercise';

describe('normalizeSecondaryMuscles', () => {
  it('conserve les groupes valides distincts du primaire', () => {
    expect(normalizeSecondaryMuscles(['arms', 'shoulders'], 'chest')).toEqual(['arms', 'shoulders']);
  });
  it('déduplique', () => {
    expect(normalizeSecondaryMuscles(['arms', 'arms'], 'chest')).toEqual(['arms']);
  });
  it('exclut le muscle primaire', () => {
    expect(normalizeSecondaryMuscles(['chest', 'arms'], 'chest')).toEqual(['arms']);
  });
  it('filtre les valeurs inconnues', () => {
    expect(normalizeSecondaryMuscles(['arms', 'bogus'], 'chest')).toEqual(['arms']);
  });
  it('renvoie [] pour une entrée non-tableau', () => {
    expect(normalizeSecondaryMuscles('nope', 'chest')).toEqual([]);
    expect(normalizeSecondaryMuscles(null, 'chest')).toEqual([]);
    expect(normalizeSecondaryMuscles(undefined, 'chest')).toEqual([]);
  });
});

describe('exerciseRowSchema — musclesSecondary', () => {
  const base = {
    id: '11111111-1111-1111-1111-111111111111',
    ownerId: null,
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
    deletedAt: null,
    source: 'library' as const,
    musclePrimary: 'chest' as const,
    equipment: null,
    mediaUrl: null,
  };
  it('défaut [] si absent', () => {
    expect(exerciseRowSchema.parse(base).musclesSecondary).toEqual([]);
  });
  it('accepte des groupes valides', () => {
    expect(exerciseRowSchema.parse({ ...base, musclesSecondary: ['arms'] }).musclesSecondary).toEqual(['arms']);
  });
});
```

- [ ] **Étape 2 : lancer les tests, vérifier l'échec** — `npm run test -w packages/shared`
      (attendu : FAIL, `normalizeSecondaryMuscles` non défini).
- [ ] **Étape 3 : implémenter** dans `exercise.ts` :
  - Dans l'objet passé au `.extend()` qui définit `exerciseRowSchema` (lignes ~42-47), ajouter :
    `musclesSecondary: z.array(muscleGroupSchema).default([])`.
  - Ajouter la fonction pure :

```ts
/**
 * Normalise une liste de muscles secondaires : ne garde que des `MuscleGroup`
 * valides, dédupliqués et **distincts du muscle primaire** (invariant primaire ∉
 * secondaires). Entrée non-tableau ou vide → `[]`. Utilisée à l'écriture (admin)
 * et comme garde de forme à la lecture (mobile).
 */
export function normalizeSecondaryMuscles(input: unknown, primary: MuscleGroup): MuscleGroup[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<MuscleGroup>();
  for (const v of input) {
    const parsed = muscleGroupSchema.safeParse(v);
    if (parsed.success && parsed.data !== primary) seen.add(parsed.data);
  }
  return [...seen];
}
```

- [ ] **Étape 4 : lancer les tests, vérifier le succès** — `npm run test -w packages/shared` (PASS).
- [ ] **Étape 5 : typecheck** — `npm run typecheck` (vert ; l'export est repris par le barrel `index.ts` via `export *`).
- [ ] **Étape 6 : commit**

```bash
git add packages/shared/src/exercise.ts packages/shared/src/exercise.test.ts
git commit -m "feat(muscf10c1): normalizeSecondaryMuscles + schema partagé"
```

---

## Task 3 : Admin — saisie des muscles secondaires

**Files:**
- Modify: `apps/admin/src/data/exercises.ts`
- Modify: `apps/admin/src/screens/ExerciseEditScreen.tsx`
- Modify: `apps/admin/src/i18n/fr.ts`

- [ ] **Étape 1 : i18n** — dans `apps/admin/src/i18n/fr.ts`, objet `exercises`, ajouter après
      `equipmentEmpty` :

```ts
    secondaryMusclesLabel: 'Muscles secondaires',
```

- [ ] **Étape 2 : data — types** — dans `data/exercises.ts` :
  - `import { normalizeSecondaryMuscles }` depuis `@wellness/shared`.
  - Ajouter `musclesSecondary: MuscleGroup[]` à `ExerciseDetail` et à `ExerciseInput`.

- [ ] **Étape 3 : data — `getExercise`** : ajouter `muscles_secondary` au `select(...)`, et dans le
      mapping :

```ts
    musclesSecondary: normalizeSecondaryMuscles(data.muscles_secondary, data.muscle_primary as MuscleGroup),
```

- [ ] **Étape 4 : data — `saveExercise`** : dans `exerciseUpsert`, ajouter :

```ts
    muscles_secondary: normalizeSecondaryMuscles(input.musclesSecondary, input.musclePrimary),
```

- [ ] **Étape 5 : écran — état + pré-remplissage** dans `ExerciseEditScreen.tsx` :
  - `const [musclesSecondary, setMusclesSecondary] = useState<MuscleGroup[]>([]);`
  - dans `load()` : `setMusclesSecondary(exercise.musclesSecondary);`
  - passer `musclesSecondary` à `saveExercise({ ... })`.

- [ ] **Étape 6 : écran — invariant au changement de primaire** : dans le `onChange` du `<select>`
      groupe, après `setMusclePrimary(next)`, retirer `next` des secondaires :

```tsx
onChange={(e) => {
  const next = e.target.value as MuscleGroup;
  setMusclePrimary(next);
  setMusclesSecondary((prev) => prev.filter((m) => m !== next));
}}
```

- [ ] **Étape 7 : écran — bloc cases à cocher** : ajouter un `field` (après le `row` groupe/équipement)
      listant `MUSCLE_GROUPS.filter((g) => g !== musclePrimary)`, chaque case cochée si présente dans
      `musclesSecondary`, togglant la sélection ; libellé `fr.exercises.groupNames[g]` ; titre de
      section `fr.exercises.secondaryMusclesLabel`. (Réutiliser les styles existants ; case = `<input
      type="checkbox">` + `<label>`.)

- [ ] **Étape 8 : vérifier** — `npm run typecheck` + `npm run lint` (verts). Build admin : `npm run build -w apps/admin` si dispo.
- [ ] **Étape 9 : commit**

```bash
git add apps/admin/src/data/exercises.ts apps/admin/src/screens/ExerciseEditScreen.tsx apps/admin/src/i18n/fr.ts
git commit -m "feat(muscf10c1): saisie des muscles secondaires (admin)"
```

---

## Task 4 : Mobile — affichage sur la fiche

**Files:**
- Modify: `apps/mobile/src/data/repositories/exercise-repository.ts`
- Modify: `apps/mobile/src/app/exercises/[id].tsx`
- Modify: `apps/mobile/src/i18n/locales/fr.json` + `en.json`

- [ ] **Étape 1 : i18n** — ajouter dans `exercises.detail` de `fr.json` :
      `"secondaryMuscles": "Muscles secondaires"` (après `"instructions"`), et dans `en.json` la clé
      miroir `"secondaryMuscles": "Secondary muscles"`. Vérifier la parité des deux fichiers.

- [ ] **Étape 2 : repo — imports & type** dans `exercise-repository.ts` :
  - importer `parseJsonColumn, normalizeSecondaryMuscles` depuis `@wellness/shared`.
  - `ExerciseDetailDbRow` : ajouter `muscles_secondary: string | null;`.
  - `ExerciseDetail` : ajouter `musclesSecondary: MuscleGroup[];`.

- [ ] **Étape 3 : repo — requête & mapping (détail seulement)** :
  - dans `SELECT_EXERCISE_DETAIL`, ajouter `e.muscles_secondary` à la liste des colonnes.
  - dans `useExercise`, construire l'objet détail :

```ts
  const exercise: ExerciseDetail | null = row
    ? {
        ...rowToListItem(row),
        instructions: row.instructions,
        musclesSecondary: normalizeSecondaryMuscles(
          parseJsonColumn<unknown>(row.muscles_secondary, []),
          row.muscle_primary as MuscleGroup,
        ),
      }
    : null;
```

  - **Ne pas** toucher `SELECT_EXERCISES`, `ExerciseListItem`, `ExerciseListDbRow`.

- [ ] **Étape 4 : fiche — affichage** dans `app/exercises/[id].tsx`, mode lecture, après le champ
      « Groupe musculaire » (le `View style={styles.field}` du muscle) et avant l'équipement :

```tsx
{exercise.musclesSecondary.length > 0 ? (
  <View style={styles.field}>
    <Text style={[styles.label, { color: colors.textMuted }]}>
      {t('exercises.detail.secondaryMuscles')}
    </Text>
    <Text style={[styles.value, { color: colors.text }]}>
      {exercise.musclesSecondary.map((m) => t(`muscle.${m}`)).join(' · ')}
    </Text>
  </View>
) : null}
```

- [ ] **Étape 5 : vérifier** — `npm run typecheck` + `npm run lint` (verts).
- [ ] **Étape 6 : smoke bundling** — `npx expo export --platform web` dans `apps/mobile` (bundle OK).
- [ ] **Étape 7 : commit**

```bash
git add apps/mobile/src/data/repositories/exercise-repository.ts "apps/mobile/src/app/exercises/[id].tsx" apps/mobile/src/i18n/locales/fr.json apps/mobile/src/i18n/locales/en.json
git commit -m "feat(muscf10c1): ligne muscles secondaires sur la fiche (mobile)"
```

---

## Clôture (après les 4 tâches)
- Revue de code finale (subagent) sur l'ensemble du diff.
- `/commit`-like : CHANGELOG, TODO, roadmap (ligne MUSC-F2 / muscles secondaires → 🟡 Partiel, F10c-2
  restant), merge ff-only sur `dev`, push `origin dev`, retour sur la branche.
- Recette Florian (admin : saisie ; mobile : affichage) + relecture Damien.
