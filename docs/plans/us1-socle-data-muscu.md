# US1 — Socle data (PowerSync/Supabase) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Basculer le socle (profil, réglages) et la séance libre muscu (exercices, favoris, séances réalisées) de Zustand-persist vers PowerSync comme source de vérité unique, avec tables Supabase + RLS + sync rules.

**Architecture:** Écritures via une couche **repository** (`powerSync.execute`, UUID client, UTC, soft delete) ; lectures via **watched queries** réactives (`useQuery` de **`@powersync/react`**). Zustand ne garde que l'UI éphémère. La séance en cours devient une ligne `workouts` `status='active'`. Le contenu de bibliothèque (exercices) est répliqué en lecture seule (bucket `shared_content`), le reste en `user_data`.

> ⚠️ **Import correct** : `useQuery` et `PowerSyncContext` viennent de **`@powersync/react`** (déjà installé, cf. [PowerSyncProvider.tsx](../../apps/mobile/src/powersync/PowerSyncProvider.tsx)), **pas** de `@powersync/react-native` (qui fournit `Table`/`Schema`/`column` + le SDK natif).

**Tech Stack:** React Native + Expo (SDK 57), `@powersync/react` (hooks) + `@powersync/react-native` + `@powersync/op-sqlite` (natif), Supabase (Postgres + RLS + Auth), Zod (`@wellness/shared`), Vitest (shared) + jest-expo (mobile).

**Spec de référence :** [docs/specs/technical/schema-donnees-muscu.md](../specs/technical/schema-donnees-muscu.md) · Conventions : [offline-sync.md](../specs/technical/offline-sync.md), [bonnes-pratiques.md](../specs/technical/bonnes-pratiques.md).

**Branche :** `feature/data-socle-muscu` (depuis `dev`).

**Périmètre US1 (tables) :** `profiles`, `user_settings`, `exercises`, `exercise_translations`, `exercise_favorites`, `workouts`, `workout_sets`. *(programmes → US2 ; records → US3)*

**Réalité de test :** les repositories mobiles dépendent du module natif PowerSync → non testables en unitaire hors device. La discipline TDD porte sur **`packages/shared`** (Zod + logique pure) ; le mobile est validé par **jest-expo** (smoke/rendu, avec mock PowerSync) puis **sur device** (offline + 2 appareils). Ne pas fabriquer de faux tests d'intégration SQLite.

---

## Structure des fichiers

**Backend Supabase**
- Create: `supabase/migrations/<ts>_socle_muscu_tables.sql` — tables + triggers `set_updated_at` + publication `powersync`.
- Create: `supabase/migrations/<ts>_socle_muscu_rls.sql` — policies RLS.
- Modify: `supabase/seed.sql` — 16 exercices + traductions FR/EN.
- Create: `docs/specs/technical/powersync-sync-rules.yaml` — sync rules versionnées (appliquées à la main sur l'instance PowerSync Cloud).

**packages/shared** (types + Zod + logique pure)
- Modify: `packages/shared/src/sync.ts` — ajouter `contentOwnerSyncFieldsSchema` (owner_id nullable).
- Create: `packages/shared/src/exercise.ts` (+ `.test.ts`) — enums muscle/equipment, schémas `exercise`, `exerciseTranslation`, helper `resolveExerciseName`.
- Create: `packages/shared/src/workout.ts` (+ `.test.ts`) — enums set_type/status, schémas `workout`, `workoutSet`, helper `computeVolume`.
- Create: `packages/shared/src/settings.ts` (+ `.test.ts`) — schéma `userSettings` (theme/units/language/active_pillars/…).
- Modify: `packages/shared/src/profile.ts` — schéma `profileRow` aligné tables (réutilise SEXES/GOALS existants).
- Modify: `packages/shared/src/index.ts` — exports.

**Mobile — couche data**
- Modify: `apps/mobile/src/lib/id.ts` — vrai UUID v4.
- Modify: `apps/mobile/src/powersync/schema.ts` — déclarer les 7 tables (remplace `todos`).
- Create: `apps/mobile/src/data/repositories/profile-repository.ts`
- Create: `apps/mobile/src/data/repositories/settings-repository.ts`
- Create: `apps/mobile/src/data/repositories/exercise-repository.ts`
- Create: `apps/mobile/src/data/repositories/workout-repository.ts`
- Create: `apps/mobile/src/data/repositories/_sql.ts` — helpers communs (soft delete, timestamps).

**Mobile — bascule écrans** (suppression des stores persistés)
- Modify: onboarding (`infos`/`goal`/`pillars`/`summary`), `profile.tsx`, `(tabs)/index.tsx`, `settings.tsx`, `(tabs)/strength.tsx`, `exercises.tsx`, `workout.tsx`, `workout-summary.tsx`.
- Delete: `apps/mobile/src/stores/profile-store.ts`, `workout-store.ts`, `exercise-store.ts` ; `apps/mobile/src/data/exercises.ts`. Réduire `settings-store.ts` à l'UI éphémère (ou supprimer si vide).

**Mobile — tests**
- Create: config jest-expo (`apps/mobile/jest.config.js`, `apps/mobile/jest.setup.ts`, mock PowerSync) + script `test`.

---

## Phase A — Backend Supabase + PowerSync

### Task 1 : Migration des tables

**Files:**
- Create: `supabase/migrations/<ts>_socle_muscu_tables.sql`

- [ ] **Step 1 : Écrire la migration des tables** (colonnes conformes spec §4 ; `id uuid primary key` — **fourni par le client**, pas de `default`).

```sql
-- Socle + pilier muscu (US1) — voir docs/specs/technical/schema-donnees-muscu.md §4.
-- Colonnes de synchro sur chaque table : id, created_at, updated_at, deleted_at (+ user_id | owner_id).

-- 1. profiles ------------------------------------------------------------
create table public.profiles (
  id uuid primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  first_name text,
  birth_date date,
  sex text check (sex in ('female','male','unspecified')),
  height_cm numeric,
  weight_kg numeric,
  main_goal text check (main_goal in ('muscle','weightloss','performance','health')),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 2. user_settings -------------------------------------------------------
create table public.user_settings (
  id uuid primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  theme text not null default 'system' check (theme in ('light','dark','system')),
  units text not null default 'metric' check (units in ('metric','imperial')),
  language text not null default 'fr' check (language in ('fr','en')),
  active_pillars jsonb not null default '["strength","running","nutrition"]',
  notifications jsonb not null default '{}',
  dashboard_layout jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 3. exercises (biblio si owner_id null, custom sinon) -------------------
create table public.exercises (
  id uuid primary key,
  owner_id uuid references auth.users (id) on delete cascade,
  source text not null default 'library' check (source in ('library','custom')),
  muscle_primary text not null check (muscle_primary in ('chest','back','legs','shoulders','arms','core')),
  equipment text,
  media_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 4. exercise_translations ----------------------------------------------
create table public.exercise_translations (
  id uuid primary key,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  owner_id uuid references auth.users (id) on delete cascade,
  lang text not null check (lang in ('fr','en')),
  name text not null,
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (exercise_id, lang)
);

-- 5. exercise_favorites --------------------------------------------------
create table public.exercise_favorites (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, exercise_id)
);

-- 6. workouts (séance réalisée ; active = status 'active') --------------
create table public.workouts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid,      -- null = séance libre (FK ajoutée en US2)
  program_id uuid,      -- FK ajoutée en US2
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  started_at timestamptz not null,
  finished_at timestamptz,
  duration_seconds integer,
  rpe integer check (rpe between 1 and 10),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 7. workout_sets --------------------------------------------------------
create table public.workout_sets (
  id uuid primary key,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  order_index integer not null default 0,
  set_type text not null default 'normal' check (set_type in ('normal','warmup','superset','duration','bodyweight')),
  reps integer,
  weight_kg numeric,
  duration_seconds integer,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Triggers updated_at (fonction posée par la migration de conventions) ---
create trigger set_updated_at before update on public.profiles              for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.user_settings         for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.exercises             for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.exercise_translations for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.exercise_favorites    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.workouts              for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.workout_sets          for each row execute function public.set_updated_at();

-- Index utiles aux sync rules / lectures
create index on public.exercises (owner_id) where deleted_at is null;
create index on public.workouts (user_id, status) where deleted_at is null;
create index on public.workout_sets (workout_id) where deleted_at is null;

-- Publication PowerSync (réplication logique) ---------------------------
alter publication powersync add table
  public.profiles, public.user_settings, public.exercises,
  public.exercise_translations, public.exercise_favorites,
  public.workouts, public.workout_sets;
```

> ⚠️ Vérifier le **nom réel de la publication** utilisée par l'instance PowerSync (souvent `powersync`). Si elle n'existe pas encore : `create publication powersync;` d'abord. À confirmer sur le dashboard PowerSync (infra déjà provisionnée).

- [ ] **Step 2 : Appliquer et vérifier** (Docker requis pour le local ; sinon appliquer sur le projet cloud via `supabase db push`).

Run: `npm run db:reset` (local) **ou** `npx supabase db push` (cloud)
Expected: migration appliquée sans erreur ; `npm run db:status` liste les tables.

- [ ] **Step 3 : Régénérer les types** — Run: `npm run db:types` → `packages/shared/src/database.types.ts` contient les 7 tables.

- [ ] **Step 4 : Commit** — `chore(db): tables socle & muscu + publication powersync (US1)`

### Task 2 : RLS

**Files:**
- Create: `supabase/migrations/<ts>_socle_muscu_rls.sql`

- [ ] **Step 1 : Écrire les policies** (tables user : `user_id = auth.uid()` ; contenu : lecture biblio+owner, écriture owner seul ; pas de policy DELETE — soft delete via UPDATE).

```sql
-- RLS US1 — voir schema-donnees-muscu.md §3.3. Item 9.6.
alter table public.profiles              enable row level security;
alter table public.user_settings         enable row level security;
alter table public.exercises             enable row level security;
alter table public.exercise_translations enable row level security;
alter table public.exercise_favorites    enable row level security;
alter table public.workouts              enable row level security;
alter table public.workout_sets          enable row level security;

-- Tables « user_id » : accès à ses propres lignes (select/insert/update ; pas de delete).
do $$
declare t text;
begin
  foreach t in array array['profiles','user_settings','exercise_favorites','workouts','workout_sets']
  loop
    execute format('create policy %I_select on public.%I for select using (user_id = auth.uid());', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (user_id = auth.uid());', t, t);
    execute format('create policy %I_update on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid());', t, t);
  end loop;
end $$;

-- Contenu partageable : lecture biblio (owner_id null) OU ses customs ; écriture = owner seul.
do $$
declare t text;
begin
  foreach t in array array['exercises','exercise_translations']
  loop
    execute format('create policy %I_select on public.%I for select using (owner_id is null or owner_id = auth.uid());', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (owner_id = auth.uid());', t, t);
    execute format('create policy %I_update on public.%I for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());', t, t);
  end loop;
end $$;
```

> Le seed (contenu biblio, `owner_id null`) est inséré avec le rôle service (bypass RLS) — cohérent.

- [ ] **Step 2 : Appliquer** — `npm run db:reset` / `db push`. Expected: OK.
- [ ] **Step 3 : Vérifier isolation** — via SQL : un `select` sous un JWT utilisateur A ne renvoie pas les workouts de B (test manuel documenté dans la PR). 
- [ ] **Step 4 : Commit** — `chore(db): RLS socle & muscu (9.6, US1)`

### Task 3 : Seed des exercices

**Files:**
- Modify: `supabase/seed.sql`

- [ ] **Step 1 : Générer les inserts** depuis `apps/mobile/src/data/exercises.ts` (16 exercices, ids stables `ex-…` → **UUID déterministes**). Une ligne `exercises` (`owner_id null`, `source 'library'`, `muscle_primary`) + 2 `exercise_translations` (fr/en).

```sql
-- Bibliothèque d'exercices (seed dev) — 16 exercices bilingues, owner_id null (contenu global).
insert into public.exercises (id, owner_id, source, muscle_primary) values
  ('00000000-0000-4000-8000-000000000001', null, 'library', 'chest'),
  -- … 15 autres (UUID fixes)
  ;
insert into public.exercise_translations (id, exercise_id, owner_id, lang, name) values
  ('…', '00000000-0000-4000-8000-000000000001', null, 'fr', 'Développé couché'),
  ('…', '00000000-0000-4000-8000-000000000001', null, 'en', 'Bench press'),
  -- … pour chaque exercice
  ;
```

> Conserver une table de correspondance `ex-bench-press → UUID` dans un commentaire (traçabilité). Les UUID doivent être **valides v4-like** et **identiques en local et cloud** (parité de contenu partagé — c'est la vraie raison des UUID déterministes ; les « favoris de test » sont de toute façon purgés par la bascule §6).

- [ ] **Step 2 : Rejouer** — `npm run db:reset`. Expected: 16 lignes `exercises`, 32 `exercise_translations`.
- [ ] **Step 3 : Commit** — `chore(db): seed 16 exercices bilingues (US1)`

### Task 4 : Sync rules PowerSync

**Files:**
- Create: `docs/specs/technical/powersync-sync-rules.yaml`

- [ ] **Step 1 : Écrire les sync rules** (copie exacte de spec §3.2, limitée aux 7 tables US1) et les documenter comme appliquées à la main sur le dashboard PowerSync.

```yaml
bucket_definitions:
  user_data:
    parameters: select request.user_id() as user_id
    data:
      - select * from profiles            where user_id = bucket.user_id and deleted_at is null
      - select * from user_settings       where user_id = bucket.user_id and deleted_at is null
      - select * from exercises           where owner_id = bucket.user_id and deleted_at is null
      - select * from exercise_translations where owner_id = bucket.user_id and deleted_at is null
      - select * from exercise_favorites  where user_id = bucket.user_id and deleted_at is null
      - select * from workouts            where user_id = bucket.user_id and deleted_at is null
      - select * from workout_sets        where user_id = bucket.user_id and deleted_at is null
  shared_content:
    data:
      - select * from exercises            where owner_id is null and deleted_at is null
      - select * from exercise_translations where owner_id is null and deleted_at is null
```

- [ ] **Step 2 : Appliquer** sur le dashboard PowerSync (🔴 humain) et **déployer**. Vérifier l'état « connected » côté app.
- [ ] **Step 3 : Commit** — `docs(sync): sync rules PowerSync US1`

---

## Phase B — packages/shared (types + Zod + logique pure, TDD Vitest)

### Task 5 : Champs de synchro « contenu avec owner »

**Files:**
- Modify: `packages/shared/src/sync.ts`
- Test: `packages/shared/src/sync.test.ts`

- [ ] **Step 1 : Test qui échoue** — `contentOwnerSyncFieldsSchema` accepte `ownerId` nullable, refuse un mauvais UUID.

```ts
import { contentOwnerSyncFieldsSchema } from './sync';
it('accepte owner_id null (contenu biblio) et un uuid (custom)', () => {
  const base = { id: crypto.randomUUID(), createdAt: '2026-07-06T00:00:00Z', updatedAt: '2026-07-06T00:00:00Z', deletedAt: null };
  expect(contentOwnerSyncFieldsSchema.safeParse({ ...base, ownerId: null }).success).toBe(true);
  expect(contentOwnerSyncFieldsSchema.safeParse({ ...base, ownerId: 'x' }).success).toBe(false);
});
```

- [ ] **Step 2 : Vérifier l'échec** — `npm run test -w @wellness/shared`. Expected: FAIL (export inexistant).
- [ ] **Step 3 : Implémenter**

```ts
/** Contenu partageable : owner_id nullable (null = bibliothèque, sinon custom utilisateur). */
export const contentOwnerSyncFieldsSchema = syncFieldsSchema
  .omit({ userId: true })
  .extend({ ownerId: uuidSchema.nullable() });
export type ContentOwnerSyncFields = z.infer<typeof contentOwnerSyncFieldsSchema>;
```

- [ ] **Step 4 : Tests verts** — Expected: PASS.
- [ ] **Step 5 : Commit** — `feat(shared): champs de synchro contenu avec owner_id`

### Task 6 : Schéma & helpers exercice

**Files:**
- Create: `packages/shared/src/exercise.ts` · Test: `packages/shared/src/exercise.test.ts`

- [ ] **Step 1 : Tests qui échouent** — enums (`MUSCLE_GROUPS`), schéma `exerciseRowSchema`, et `resolveExerciseName(translations, lang)` avec **fallback FR**.

```ts
import { resolveExerciseName } from './exercise';
const tr = [{ lang: 'fr', name: 'Squat' }, { lang: 'en', name: 'Squat (EN)' }];
it('rend la langue demandée', () => expect(resolveExerciseName(tr, 'en')).toBe('Squat (EN)'));
it('retombe sur le FR si la langue manque', () => expect(resolveExerciseName([{ lang: 'fr', name: 'Squat' }], 'en')).toBe('Squat'));
```

- [ ] **Step 2 : Vérifier l'échec** — FAIL.
- [ ] **Step 3 : Implémenter** — `MUSCLE_GROUPS`, `EQUIPMENTS`, `exerciseRowSchema` (= `contentOwnerSyncFieldsSchema` + `source`/`musclePrimary`/`equipment`/`mediaUrl`), `exerciseTranslationRowSchema`, `resolveExerciseName` (cherche `lang`, sinon `'fr'`, sinon 1ʳᵉ).
- [ ] **Step 4 : Tests verts** — PASS.
- [ ] **Step 5 : Commit** — `feat(shared): schéma exercice + resolveExerciseName (fallback FR)`

### Task 7 : Schéma & helpers séance

**Files:**
- Create: `packages/shared/src/workout.ts` · Test: `packages/shared/src/workout.test.ts`

- [ ] **Step 1 : Tests qui échouent** — enums `SET_TYPES`/`WORKOUT_STATUSES`, `computeVolume(sets)` = Σ(reps×weight) sur séries `done`, **hors** `warmup`.

```ts
import { computeVolume } from './workout';
it('somme reps×charge des séries validées, hors échauffement', () => {
  const sets = [
    { setType: 'warmup', reps: 10, weightKg: 20, done: true },
    { setType: 'normal', reps: 8,  weightKg: 50, done: true },
    { setType: 'normal', reps: 8,  weightKg: 50, done: false },
  ];
  expect(computeVolume(sets)).toBe(400);
});
```

- [ ] **Step 2 : Vérifier l'échec** — FAIL.
- [ ] **Step 3 : Implémenter** — schémas `workoutRowSchema`/`workoutSetRowSchema` (sur `syncFieldsSchema`), `computeVolume`.
- [ ] **Step 4 : Tests verts** — PASS.
- [ ] **Step 5 : Commit** — `feat(shared): schéma séance + computeVolume`

### Task 8 : Schéma réglages + profil-row

**Files:**
- Create: `packages/shared/src/settings.ts` · Test: `settings.test.ts` · Modify: `profile.ts`, `index.ts`

- [ ] **Step 1 : Tests qui échouent** — `userSettingsRowSchema` (theme/units/language enums, `activePillars` = array de `PILLARS`, defaults), `profileRowSchema`.
- [ ] **Step 2 : FAIL.**
- [ ] **Step 3 : Implémenter** + exporter tout dans `index.ts`.
- [ ] **Step 4 : PASS.**
- [ ] **Step 5 : Commit** — `feat(shared): schémas user_settings + profile row`

---

## Phase C — Mobile : couche data

### Task 9 : UUID v4 client

**Files:**
- Modify: `apps/mobile/src/lib/id.ts`

- [ ] **Step 1 : Remplacer `generateId`** par un vrai UUID v4 (`expo-crypto` `randomUUID()` ou lib `uuid`). Conserver la même signature `(): string`.

```ts
import * as Crypto from 'expo-crypto';
/** UUID v4 généré côté client — clé de réconciliation PowerSync (modele-donnees §1). */
export function generateId(): string {
  return Crypto.randomUUID();
}
```

- [ ] **Step 2 : Vérifier** `npx expo install expo-crypto` (si absent) ; `npm run typecheck`.
- [ ] **Step 3 : Commit** — `refactor(mobile): generateId → UUID v4 (expo-crypto)`

### Task 10 : Schéma PowerSync local

**Files:**
- Modify: `apps/mobile/src/powersync/schema.ts`

- [ ] **Step 1 : Déclarer les 7 tables** (colonnes = spec §4, hors `id` implicite). Exemple :

```ts
import { column, Schema, Table } from '@powersync/react-native';

const profiles = new Table({
  user_id: column.text, first_name: column.text, birth_date: column.text,
  sex: column.text, height_cm: column.real, weight_kg: column.real,
  main_goal: column.text, onboarding_completed_at: column.text,
  created_at: column.text, updated_at: column.text, deleted_at: column.text,
});
const user_settings = new Table({
  user_id: column.text, theme: column.text, units: column.text, language: column.text,
  active_pillars: column.text, notifications: column.text, dashboard_layout: column.text,
  created_at: column.text, updated_at: column.text, deleted_at: column.text,
});
const exercises = new Table({
  owner_id: column.text, source: column.text, muscle_primary: column.text,
  equipment: column.text, media_url: column.text,
  created_at: column.text, updated_at: column.text, deleted_at: column.text,
});
const exercise_translations = new Table({
  exercise_id: column.text, owner_id: column.text, lang: column.text,
  name: column.text, instructions: column.text,
  created_at: column.text, updated_at: column.text, deleted_at: column.text,
});
const exercise_favorites = new Table({
  user_id: column.text, exercise_id: column.text,
  created_at: column.text, updated_at: column.text, deleted_at: column.text,
});
const workouts = new Table({
  user_id: column.text, session_id: column.text, program_id: column.text, status: column.text,
  started_at: column.text, finished_at: column.text, duration_seconds: column.integer,
  rpe: column.integer, notes: column.text,
  created_at: column.text, updated_at: column.text, deleted_at: column.text,
});
const workout_sets = new Table({
  workout_id: column.text, user_id: column.text, exercise_id: column.text,
  order_index: column.integer, set_type: column.text, reps: column.integer,
  weight_kg: column.real, duration_seconds: column.integer, done: column.integer,
  created_at: column.text, updated_at: column.text, deleted_at: column.text,
});

export const AppSchema = new Schema({
  profiles, user_settings, exercises, exercise_translations,
  exercise_favorites, workouts, workout_sets,
});
```

- [ ] **Step 2 : Typecheck** — `npm run typecheck`. Expected: OK. (La table jouet `todos` disparaît.)
- [ ] **Step 3 : Commit** — `feat(mobile): schéma PowerSync local socle & muscu`

### Task 11 : Helpers SQL communs

**Files:**
- Create: `apps/mobile/src/data/repositories/_sql.ts`

- [ ] **Step 1 : Écrire les helpers** — `nowUtc()`, `softDelete(table, id)`, insertion avec champs de synchro. Toute écriture y passe (DRY).

```ts
import { powerSync } from '@/powersync/system';

export const nowUtc = () => new Date().toISOString();

/** Soft delete = PATCH deleted_at (jamais de hard delete — connector.ts). */
export async function softDelete(table: string, id: string) {
  await powerSync.execute(
    `UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [nowUtc(), nowUtc(), id],
  );
}
```

- [ ] **Step 2 : Commit** — `feat(mobile): helpers repository (nowUtc, softDelete)`

### Task 12 : profile-repository

**Files:**
- Create: `apps/mobile/src/data/repositories/profile-repository.ts`

- [ ] **Step 1 : Implémenter** — `useProfile()` (hook `useQuery` sur `profiles` de l'utilisateur), `upsertProfile(patch)`, `completeOnboarding()`. UUID client, UTC, `user_id` = session. Mapping snake_case ↔ Zod camelCase via `@wellness/shared`.
- [ ] **Step 2 : État de chargement** — `useProfile()` retourne `{ profile, isLoading }`. **`isLoading` doit refléter l'état de la base locale** (avant premier rendu de `useQuery` / ouverture SQLite), pas seulement « 0 ligne ». Utiliser `useStatus()` de `@powersync/react` (`status.hasSynced` / `status.dataFlowStatus`) pour distinguer **« pas encore chargé »** de **« chargé, aucune ligne »**. Ceci **remplace le drapeau `hasHydrated`** des ex-stores Zustand.
- [ ] **Step 3 : Typecheck** — OK.
- [ ] **Step 4 : Commit** — `feat(mobile): profile-repository (PowerSync) + état de chargement`

### Task 13 : settings-repository

**Files:**
- Create: `apps/mobile/src/data/repositories/settings-repository.ts`

- [ ] **Step 1 : Implémenter** — `useSettings()` (→ `{ settings, isLoading }`, même gate que le profil, Step 12.2), `updateSettings(patch)`, `togglePillar(pillar)` (écrit `active_pillars`).
- [ ] **Step 2 : Upsert 1er accès** — définir explicitement la sémantique : **une fois la base chargée** (`isLoading` faux) et **aucune ligne** `user_settings`, écrire une ligne avec les **defaults** (`theme='system'`, `units='metric'`, `language` = locale device, `active_pillars` = tous). Ne **jamais** insérer les defaults pendant le chargement (sinon écrasement d'une ligne qui n'a pas encore synchronisé).
- [ ] **Step 3 : Typecheck** — OK.
- [ ] **Step 4 : Commit** — `feat(mobile): settings-repository (PowerSync, active_pillars, upsert defaults)`

### Task 14 : exercise-repository

**Files:**
- Create: `apps/mobile/src/data/repositories/exercise-repository.ts`

- [ ] **Step 1 : Implémenter** — `useExercises(search?)` (jointure `exercises` + `exercise_translations` selon la langue, biblio+custom), `useFavorites()`, `addCustomExercise(name, muscle)` (crée `exercises` `owner_id`=user + 1 `exercise_translations` dans la langue courante), `toggleFavorite(exerciseId)`.
- [ ] **Step 2 : Typecheck** — OK.
- [ ] **Step 3 : Commit** — `feat(mobile): exercise-repository (biblio + custom + favoris)`

### Task 15 : workout-repository

**Files:**
- Create: `apps/mobile/src/data/repositories/workout-repository.ts`

- [ ] **Step 1 : Implémenter** — la pièce maîtresse :
  - `useActiveWorkout()` — `select … from workouts where status='active'` (+ ses `workout_sets`).
  - `startWorkout()`, `cancelWorkout(id)` (soft delete + status cancelled), `finishWorkout(id, {rpe, notes})` (status completed, `finished_at`, `duration_seconds`).
  - `addExerciseToWorkout(workoutId, exerciseId)` (crée la 1ʳᵉ ligne `workout_sets`), `addSet/updateSet/removeSet` (soft delete), `useWorkoutHistory()` (status completed).
  - **Modèle plat** : pas d'entité « entry » ; les séries sont des lignes `workout_sets` regroupées à l'affichage par `exercise_id` puis triées par `order_index` (voir Task 20 pour le reshape depuis l'ancien store imbriqué).
  - Chaque mutation écrit immédiatement dans SQLite (optimistic).
- [ ] **Step 2 : Typecheck** — OK.
- [ ] **Step 3 : Commit** — `feat(mobile): workout-repository (séance active = ligne workouts)`

---

## Phase D — Mobile : jest-expo + bascule des écrans

### Task 16 : Câbler jest-expo

**Files:**
- Create: `apps/mobile/jest.config.js`, `apps/mobile/jest.setup.ts` (+ mocks **`@powersync/react`** — `useQuery`/`useStatus`/`PowerSyncContext` — et `@powersync/react-native`/`op-sqlite`), Modify: `apps/mobile/package.json` (script `test`, preset `jest-expo`).

- [ ] **Step 1 : Installer** — `npx expo install jest-expo jest @testing-library/react-native`.
- [ ] **Step 2 : Test smoke qui échoue puis passe** — rendu d'un écran simple avec `useSettings` mocké (vérifie que `npm run test` mobile tourne).
- [ ] **Step 3 : Vérifier** — `npm run test` (racine) exécute shared **et** mobile.
- [ ] **Step 4 : Commit** — `test(mobile): câble jest-expo + mock PowerSync`

### Task 17 : Bascule profil & onboarding

**Files:**
- Modify: onboarding (`infos`/`goal`/`summary`), `profile.tsx`, `(tabs)/index.tsx`

- [ ] **Step 1 : Remplacer** `useProfileStore` par `useProfile` / `upsertProfile` / `completeOnboarding`.
- [ ] **Step 2 : Gate de routing** — dans le layout qui décide **onboarding vs app** : tant que `isLoading` (profil **et** réglages), afficher un **splash/écran de chargement**, **ne pas router**. Ne rediriger vers l'onboarding que si `!isLoading && onboarding_completed_at == null`. Ceci évite le flash d'onboarding / la boucle de redirection au démarrage (remplace l'attente `hasHydrated`).
- [ ] **Step 3 : Vérifier** typecheck + lint + rendu (test smoke) ; au démarrage (compte existant en ligne) → **pas** de flash d'onboarding. Aucune chaîne en dur (i18n).
- [ ] **Step 4 : Commit** — `refactor(mobile): profil & onboarding sur PowerSync (+ gate de chargement)`

### Task 18 : Bascule réglages & masquage onglets

**Files:**
- Modify: `settings.tsx`, onboarding `pillars.tsx`, layout de masquage des onglets (2.2), consommateurs de thème/unités.

- [ ] **Step 1 : Remplacer** `useSettingsStore` par `useSettings`/`updateSettings`/`togglePillar`. Garder en Zustand éphémère uniquement ce qui ne se persiste pas.
- [ ] **Step 2 : Vérifier** — thème/unités/langue s'appliquent ; onglet masqué suit `active_pillars`.
- [ ] **Step 3 : Commit** — `refactor(mobile): réglages & masquage onglets sur PowerSync`

### Task 19 : Bascule exercices

**Files:**
- Modify: `exercises.tsx` · (lecture depuis repository, plus depuis `data/exercises.ts`)

- [ ] **Step 1 : Remplacer** `useExerciseStore` + import statique par `useExercises`/`useFavorites`/`addCustomExercise`/`toggleFavorite`. **Repointer** tout usage de `MUSCLE_GROUPS` / `type MuscleGroup` de `@/data/exercises` (supprimé en Task 21) vers **`@wellness/shared`** (recréés en Task 6).
- [ ] **Step 2 : Vérifier** — liste (biblio seed + customs), recherche, favoris, création.
- [ ] **Step 3 : Commit** — `refactor(mobile): écran exercices sur PowerSync`

### Task 20 : Bascule séance

**Files:**
- Modify: `(tabs)/strength.tsx`, `workout.tsx`, `workout-summary.tsx`

- [ ] **Step 1 : Remplacer** `useWorkoutStore` par `workout-repository`. Séance en cours lue via `useActiveWorkout`. Résumé via l'historique/`finishWorkout`.
  - ⚠️ **Reshape des données** : le store actuel imbrique `active.entries[].sets[]` (chaque *entry* porte `exerciseId`). Le nouveau modèle est **plat** : chaque `workout_sets` porte `workout_id` + `exercise_id` + `order_index` + `set_type`. L'ajout d'un exercice crée N lignes `workout_sets` (une par série) ; l'ordre d'affichage se reconstitue par `exercise_id` + `order_index`. Décrire ce mapping avant de toucher l'écran.
- [ ] **Step 2 : Vérifier** — démarrer, ajouter exercices/séries, valider, chrono repos (reste local/éphémère), clôturer, résumé.
- [ ] **Step 3 : Commit** — `refactor(mobile): séance libre sur PowerSync`

### Task 21 : Nettoyage (fin de la dette Zustand)

**Files:**
- Delete: `stores/profile-store.ts`, `stores/workout-store.ts`, `stores/exercise-store.ts`, `data/exercises.ts` ; réduire/supprimer `stores/settings-store.ts`. Vérifier `zustand-secure-storage.ts` (garder si encore utilisé par de l'éphémère, sinon supprimer).

- [ ] **Step 1 : Supprimer** les stores persistés et l'import statique ; corriger les imports résiduels.
- [ ] **Step 2 : Vérifier** — `npm run typecheck` + `lint` + `test` verts ; recherche `grep -r "persist(" apps/mobile/src` → plus aucune donnée métier persistée.
- [ ] **Step 3 : Commit** — `chore(mobile): supprime les stores Zustand persistés (dette data soldée)`

---

## Phase E — Vérification (Definition of Done)

### Task 22 : Validation sur device

- [ ] **Step 1 : Build dev** — `npm run build:dev` (ou dev client existant).
- [ ] **Step 2 : Offline** — mode avion : créer profil, séance libre, favori → tout marche, pas de spinner. Rouvrir l'app (kill) → séance active reprise.
- [ ] **Step 3 : Sync montante** — réseau rétabli → données visibles dans Supabase (table editor).
- [ ] **Step 4 : Sync descendante / RLS 2 appareils** — 2ᵉ appareil (même compte) : les données redescendent. Un autre compte **ne voit pas** ces données (RLS).
- [ ] **Step 5 : i18n** — bascule FR/EN : libellés biblio suivent la langue ; fallback FR OK.
- [ ] **Step 6 : Consigner** le résultat dans la PR + cocher la DoD.

---

## Definition of Done (rappel)
- `typecheck` + `lint` + `test` (shared **et** mobile) verts en CI.
- Écriture/lecture **offline** OK ; **optimistic UI** (aucun spinner sur écriture locale).
- **RLS vérifiée sur 2 appareils** (montante + descendante).
- **i18n FR/EN** complète, aucune chaîne en dur.
- Aucun secret en dur. CHANGELOG + TODO tenus via `/commit`.
- Stores Zustand persistés supprimés (source de vérité unique = SQLite/PowerSync).

## Points d'attention
- **Docker** requis pour `db:reset` local ; sinon appliquer les migrations sur le cloud (`supabase db push`). L'infra étant provisionnée, viser le cloud si Docker indisponible.
- **Nom de la publication** PowerSync à confirmer avant Task 1 step 1.
- Les **sync rules** (Task 4) et l'application des migrations cloud sont des étapes **🔴 humaines** (dashboard/CLI) à séquencer avant la vérif device.
- Repositories mobiles **non couverts en unitaire** (module natif) → jest-expo = rendu/logique d'écran ; l'intégration se valide device (Task 22). Assumé.
