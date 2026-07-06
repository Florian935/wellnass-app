# US2 — Programmes muscu (structure + bibliothèque + lien séance) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser les programmes de musculation (créer un programme custom, parcourir/dupliquer une bibliothèque éditoriale, activer un programme, démarrer une séance depuis un programme), sur la couche PowerSync/repository posée en US1.

**Architecture:** Même patron que l'US1 — tables `programs`/`program_translations`/`sessions`/`exercise_plans` (déjà figées spec §4.3), schéma PowerSync local + migration Supabase + RLS + sync rules, un `program-repository` (écritures via `_sql`, lectures réactives `useQuery`), écrans branchés dessus. `programs`/… portent `owner_id` nullable (null = éditorial lecture seule, sinon custom utilisateur), exactement comme `exercises`.

**Tech Stack:** identique à l'US1 (React Native + Expo SDK 57, `@powersync/react`/`react-native`/`op-sqlite`, Supabase + RLS, Zod `@wellness/shared`, Vitest + jest-expo).

**Spec de référence :** [schema-donnees-muscu.md §4.3](../specs/technical/schema-donnees-muscu.md) · **Patterns à copier :** [plan US1](us1-socle-data-muscu.md) et les repositories/écrans livrés en US1 (`apps/mobile/src/data/repositories/*`).

**Branche :** `feature/programmes-muscu`, créée depuis `dev` **une fois l'US1 mergée** (dépend de la couche data US1 : `_sql`, connecteur, schéma local, workout-repository pour le lien séance).

**Périmètre US2 (features)** — validé 06/07/2026 :
- 3.4 Création programme custom · 3.5 Semaine type · 3.6 Composition de séance
- 3.1 Bibliothèque de programmes (seed éditorial, lecture seule) · 3.2 Filtres · 3.3 Dupliquer
- 3.12 Un programme actif par pilier
- 3.24 Plan de séance avant démarrage **+ démarrer une séance depuis une session de programme** (lie `workouts.session_id`/`program_id`, colonnes déjà présentes depuis l'US1)

**Hors périmètre (→ US2b, nécessite une nouvelle table « séances planifiées »)** : planning calendaire (3.9/3.10/3.11), progression auto & deload (3.7/3.8), notifications rappel séance (2.4/2.7). Également hors périmètre : historique & records (US3). **À noter dans le TODO** pour ne pas les croire couverts.

**Décisions de modèle** (héritées / à confirmer) : nom de programme **toujours** en `program_translations` (custom inclus, 1 ligne langue de saisie — comme les exercices). `sessions.name` = **texte libre non traduit** en V0.3 (spec §9, point laissé ouvert — **confirmé simple pour US2**). Un seul programme `is_active=1` par `(user, pillar)` — invariant tenu **côté repository** (activer désactive l'actif précédent, historique conservé).

---

## Rappels de patron (pour éviter la répétition)

Chaque repository suit EXACTEMENT le patron des repositories US1 (`profile`/`settings`/`exercise`/`workout-repository.ts`) : type `*DbRow`, mappers snake↔camel, `useX()` réactif avec **`isLoading = queryLoading`** (⚠️ **pas** `hasSynced` — cf. correctif offline-first US1), écritures via `_sql` (`insertWithSyncFields`/`patch`/`softDelete`), `currentUserId()` via `useAuthStore`, `powerSync.getOptional`/`getAll` hors hook, résolution de nom en SQL `COALESCE(lang, 'fr')` avec la **langue applicative** (`useTranslation().i18n.language` en hook, `getAppLanguage()` de `@/i18n` hors hook). Migrations : colonnes de synchro §3.1, triggers `set_updated_at`, `owner_id` nullable pour le contenu. RLS/ sync rules : mêmes filtres que l'US1 (`owner_id is null or = auth.uid()`).

## Structure des fichiers
**Backend :** `supabase/migrations/<ts>_programmes_tables.sql`, `<ts2>_programmes_rls.sql` ; MAJ `supabase/seed.sql` (programmes éditoriaux) ; MAJ `docs/specs/technical/powersync-sync-rules.yaml`.
**Shared :** `packages/shared/src/program.ts` (+ `.test.ts`) ; MAJ `index.ts`.
**Mobile data :** MAJ `apps/mobile/src/powersync/schema.ts` (+4 tables) ; `apps/mobile/src/data/repositories/program-repository.ts`.
**Écrans :** `apps/mobile/src/app/programs/` (liste/biblio, détail, création/édition) + branchements dans l'onglet muscu (`(tabs)/strength.tsx`) et le lien « démarrer depuis programme » (via workout-repository). i18n `fr.json`/`en.json`.

---

## Phase A — packages/shared (Zod + logique pure, TDD)

### Task 1 : Schémas programme
**Files:** Create `packages/shared/src/program.ts` (+ `.test.ts`) ; Modify `index.ts`.
- [ ] **Step 1 : Tests qui échouent** — enums `PROGRAM_STATUSES` (`draft`/`published`), `PROGRAM_LEVELS` (`beginner`/`intermediate`/`advanced`) ; schémas `programRowSchema` (sur `contentOwnerSyncFieldsSchema` + `pillar` (reuse `pillarSchema`), `status`, `isActive` bool, `level` null, `goal` null, `durationWeeks` int null), `programTranslationRowSchema` (owner + `programId`, `lang`, `name`, `summary` null, `description` null), `sessionRowSchema` (owner + `programId`, `orderIndex`, `name` null), `exercisePlanRowSchema` (owner + `sessionId`, `exerciseId`, `orderIndex`, `setType`, `targetSets` null, `targetReps` string null, `targetWeightKg` null, `restSeconds` null) ; helper `resolveProgramName(translations, lang)` (fallback FR — même logique que `resolveExerciseName`, factoriser si trivial).
- [ ] **Step 2 : FAIL** — `npm run test -w @wellness/shared`.
- [ ] **Step 3 : Implémenter** (patron `exercise.ts`). Réutiliser `contentOwnerSyncFieldsSchema`, `pillarSchema`, `localeSchema`, `SET_TYPES`.
- [ ] **Step 4 : PASS** (+ tests fallback nom, defaults).
- [ ] **Step 5 : Commit** — `feat(shared): schémas programme (programs/sessions/exercise_plans)`

## Phase B — Backend (fichiers ; application = checkpoint humain)

### Task 2 : Migration des tables programmes
**Files:** Create `supabase/migrations/<ts>_programmes_tables.sql`
- [ ] **Step 1** — 4 tables conformes spec §4.3 (colonnes §3.1 ; `owner_id` nullable ; FK `program_id`→programs, `session_id`→sessions, `exercise_id`→exercises). `is_active` integer/boolean, `unique` non imposée sur (user,pillar,active) — l'invariant est géré côté repo. Triggers `set_updated_at` sur les 4 tables. Index `programs(owner_id) where deleted_at is null`, `program_translations(program_id)`, `sessions(program_id)`, `exercise_plans(session_id)`. **Ajouter les FK manquantes sur `workouts`** (`session_id`→sessions, `program_id`→programs) laissées en attente par l'US1. `alter publication powersync add table` pour les 4 tables.
- [ ] **Step 2 : Commit** — `chore(db): tables programmes muscu + FK workouts (US2)` *(application cloud = checkpoint humain)*

### Task 3 : RLS programmes
**Files:** Create `supabase/migrations/<ts2>_programmes_rls.sql`
- [ ] **Step 1** — RLS sur les 4 tables, patron **contenu** (comme `exercises`) : `select using (owner_id is null or owner_id = auth.uid())`, `insert/update with check (owner_id = auth.uid())`, pas de delete.
- [ ] **Step 2 : Commit** — `chore(db): RLS programmes muscu (US2)`

### Task 4 : Sync rules
**Files:** Modify `docs/specs/technical/powersync-sync-rules.yaml`
- [ ] **Step 1** — ajouter aux buckets : `user_data` (les 4 tables `where owner_id = bucket.user_id and deleted_at is null`) ; `shared_content` (`programs where owner_id is null and status='published' and deleted_at is null`, + `program_translations`/`sessions`/`exercise_plans where owner_id is null and deleted_at is null`).
- [ ] **Step 2 : Commit** — `docs(sync): sync rules programmes (US2)` *(déploiement dashboard = checkpoint humain)*

### Task 5 : Seed programmes éditoriaux (minimal)
**Files:** Modify `supabase/seed.sql`
- [ ] **Step 1** — 1 à 2 programmes éditoriaux exemples (ex. « Full Body débutant 3j »), `owner_id null`, `status='published'`, avec `program_translations` fr/en, quelques `sessions` + `exercise_plans` **référençant les UUID d'exercices seedés en US1** (`a10000XX-…`). UUID déterministes. `on conflict do nothing`. Contenu **placeholder** — industrialisé au back-office V0.7 (le noter en commentaire). Comme le seed d'exercices US1, ces inserts `owner_id null` tournent **sous le rôle service (bypass RLS)** — l'écriture de contenu de bibliothèque est interdite depuis un JWT normal.
- [ ] **Step 2 : Commit** — `chore(db): seed programmes éditoriaux placeholder (US2)`

## Phase C — Mobile : couche data

### Task 6 : Schéma PowerSync local (+4 tables)
**Files:** Modify `apps/mobile/src/powersync/schema.ts`
- [ ] **Step 1** — déclarer `programs`, `program_translations`, `sessions`, `exercise_plans` (colonnes snake_case = migration). Ne pas toucher aux 7 tables US1.
- [ ] **Step 2 : typecheck** OK. **Commit** — `feat(mobile): schéma PowerSync local programmes (US2)`

### Task 7 : program-repository *(pièce maîtresse)*
**Files:** Create `apps/mobile/src/data/repositories/program-repository.ts`
- [ ] **Step 1 : Implémenter** (patron des repos US1) :
  - Lectures réactives : `useProgramLibrary(filters?)` (éditoriaux publiés `owner_id is null`, nom résolu `COALESCE(lang,'fr')`, filtres level/goal/durationWeeks en **clauses SQL paramétrées** — ces colonnes vivent sur `programs`, donc préférer le filtrage SQL au JS), `useMyPrograms()` (customs de l'utilisateur), `useActiveProgram(pillar)` (le `is_active=1`), `useProgramDetail(programId)` (programme + sessions + exercise_plans groupés, noms d'exercices résolus).
  - Écritures : `createProgram({pillar, name, ...})` (crée `programs` custom `owner_id`=user + `program_translations` langue courante), `addSession(programId, {name, orderIndex})`, `addExercisePlan(sessionId, {exerciseId, ...cibles})`, `updateExercisePlan/removeExercisePlan` (soft delete), `duplicateProgram(sourceId)` (copie éditorial→custom : programme + traductions (langue courante) + sessions + exercise_plans, nouveaux UUID, `owner_id`=user), `activateProgram(programId)` (transaction : `is_active=0` sur l'actif courant du même pilier, `is_active=1` sur la cible — invariant 3.12), `deleteProgram` (soft delete cascade sessions/plans).
  - ⚠️ `isLoading = queryLoading` (pas de `hasSynced`). Langue via `useTranslation().i18n.language` en hook, `getAppLanguage()` hors hook.
- [ ] **Step 2 : typecheck** OK. **Commit** — `feat(mobile): program-repository (biblio + custom + activation)`

## Phase D — Écrans

### Task 8 : Bibliothèque de programmes (3.1/3.2/3.3)
**Files:** Create `apps/mobile/src/app/programs/index.tsx` (liste biblio + mes programmes), filtres, action **dupliquer**. Branch depuis l'onglet muscu.
- [ ] Liste réactive via `useProgramLibrary`/`useMyPrograms` ; filtres (3.2) ; `duplicateProgram` (3.3). i18n, états vides, `isLoading`. typecheck+lint+test. **Commit** — `feat(mobile): écran bibliothèque de programmes (3.1-3.3)`

### Task 9 : Création / édition d'un programme custom (3.4/3.5/3.6)
**Files:** Create `apps/mobile/src/app/programs/edit.tsx` (+ sous-composants)
- [ ] Composer un programme : métadonnées → sessions (semaine type 3.5) → exercices par session avec cibles séries/reps/charge/repos (3.6), via `program-repository`. Écritures async, UX réactive. i18n. typecheck+lint+test. **Commit** — `feat(mobile): création/édition de programme custom (3.4-3.6)`

### Task 10 : Détail + activation (3.12)
**Files:** Create `apps/mobile/src/app/programs/[id].tsx`
- [ ] Détail programme (sessions + plans, `useProgramDetail`) + bouton **Activer** (`activateProgram`, un actif par pilier). Indiquer le programme actif dans l'onglet muscu. i18n. typecheck+lint+test. **Commit** — `feat(mobile): détail de programme + activation (3.12)`

### Task 11 : Plan de séance avant démarrage + démarrer depuis un programme (3.24)
**Files:** Modify `apps/mobile/src/app/(tabs)/strength.tsx`, `apps/mobile/src/app/workout.tsx` ; possiblement une petite extension du **workout-repository** (US1) : `startWorkoutFromSession(sessionId)` qui crée le `workouts` (`session_id`/`program_id` renseignés) **et** pré-remplit les `workout_sets` depuis les `exercise_plans` de la session.
- [ ] Écran « plan de séance » (récap des exercices/cibles prévus de la session, `useProgramDetail`) + CTA « Démarrer » → `startWorkoutFromSession`. Réutilise le flux séance US1. i18n. typecheck+lint+test. **Commit** — `feat(mobile): plan de séance + démarrage depuis un programme (3.24)`
  - ⚠️ Cette extension **touche le workout-repository** (US1) : à faire proprement (nouvelle fonction, ne pas casser `startWorkout`). Relecture ciblée.

## Phase E — Tests & vérification

### Task 12 : Tests & i18n
- [ ] Compléter les clés i18n fr/en des nouveaux écrans (aucune chaîne en dur). Tests `packages/shared` (schémas + `resolveProgramName` + toute logique pure d'activation extraite). Smoke jest-expo sur un écran programme. typecheck+lint+test verts. **Commit** — `test(us2): tests programmes + i18n`

### Task 13 : Vérification device *(checkpoint humain)*
- [ ] Créer un programme custom, dupliquer un éditorial, activer (vérifier un seul actif/pilier), démarrer une séance depuis une session → séries pré-remplies, offline OK, sync montante/descendante + **RLS 2 appareils** (un compte ne voit pas les programmes custom d'un autre), i18n FR/EN.

## Definition of Done
Idem US1 : typecheck+lint+test verts (CI) · offline (mode avion) · RLS 2 appareils · i18n FR/EN · optimistic UI · aucun secret · CHANGELOG + TODO tenus. **Prérequis :** US1 mergée + migrations US1 appliquées.

## Points d'attention
- **Dépend de l'US1 mergée** (couche data, workout-repository). Ne pas démarrer l'implémentation avant.
- **Application cloud des migrations + sync rules + device = checkpoints 🔴 humains**, comme en US1.
- L'extension `startWorkoutFromSession` modifie un fichier US1 (workout-repository) — la seule intrusion hors « nouveaux fichiers ».
- Nom de `sessions` non traduit (V0.3) : confirmé simple pour US2 ; réévaluer si les programmes éditoriaux doivent être bilingues au niveau session.
