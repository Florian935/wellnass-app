# US3 — Historique & records muscu — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Compléter le pilier muscu par les **records personnels** (calculés automatiquement à la clôture d'une séance), l'**historique** des séances (liste + détail) et les **courbes de progression** (charge/volume par exercice, volume par groupe musculaire).

**Architecture:** Même patron que US1/US2 — table `personal_records` (déjà figée spec §4.4) : migration Supabase + RLS + sync rules + schéma PowerSync local ; un `records-repository` (calcul pur des records dans `@wellness/shared`, écriture via `_sql`, lectures réactives `useQuery`, `isLoading = queryLoading`) ; écrans historique/records/courbes. Les courbes s'appuient sur `react-native-svg`.

**Tech Stack:** identique à US1/US2 + **`react-native-svg`** (Expo) + une petite lib de charts (ex. `react-native-gifted-charts`) au-dessus.

**Spec :** [schema-donnees-muscu.md §4.4](../specs/technical/schema-donnees-muscu.md) · **Patterns à copier :** repositories & écrans US1/US2 livrés.

**Branche :** `feature/historique-records-muscu`, depuis `dev` (US1+US2 déjà mergées).

**Périmètre US3** (validé 06/07/2026) :
- **Records** : `personal_records` calculés à la clôture d'une séance — charge max, **1RM estimé (Epley)**, meilleur volume de série ; détection « nouveau record » (3.22). Affichage des records par exercice.
- **Historique** (3.38) : liste chronologique filtrable des séances complétées + **détail d'une séance** (exercices, séries, volume, durée, RPE).
- **Courbes** (3.21 / 3.39 / 3.40) : progression charge max / volume par exercice (30/90 j), volume par groupe musculaire sur la semaine.

**Hors périmètre** : **notification nouveau record (3.42)** → différée (nécessite l'infra push expo-notifications, groupée V0.8) ; la **détection** de record est posée ici et réutilisable. Alerte déséquilibre musculaire (3.41) → optionnelle/US ultérieure.

**Décisions de modèle** : `personal_records.type ∈ {max_weight, estimated_1rm, best_volume}`. Un record est une **nouvelle ligne** horodatée (jamais d'écrasement — historique des records = journal, compatible gamification future). Séries `warmup` **exclues** de tout calcul. Records calculés **à la clôture** (`finishWorkout`) par le records-repository.

---

## Rappels de patron
Repositories : `*DbRow`, mappers snake↔camel, `useX()` réactif avec **`isLoading = queryLoading`**, écritures `_sql` (`insertWithSyncFields`), `currentUserId()` via `useAuthStore`, `powerSync.getAll`/`getOptional`/`writeTransaction`. Migration : colonnes de synchro §3.1, trigger `set_updated_at`, `user_id` (table utilisateur). RLS/sync rules : filtres `user_id = auth.uid()` / `bucket.user_id` (comme `workouts`).

## Structure des fichiers
**Backend :** `supabase/migrations/<ts>_personal_records.sql` (table + RLS + publication) ; MAJ `docs/specs/technical/powersync-sync-rules.yaml` (personal_records déjà listée §3.2 spec — l'ajouter au YAML si absent).
**Shared :** `packages/shared/src/records.ts` (+ `.test.ts`) ; MAJ `index.ts`.
**Mobile data :** MAJ `apps/mobile/src/powersync/schema.ts` (+`personal_records`) ; `apps/mobile/src/data/repositories/records-repository.ts` ; petite extension d'appel dans le flux de clôture de séance.
**Écrans :** `apps/mobile/src/app/history/` (liste + détail), section records + courbes ; composants de charts sous `apps/mobile/src/components/charts/`. i18n `fr.json`/`en.json`.

---

## Phase A — packages/shared (logique pure, TDD)

### Task 1 : Records — calcul & schéma
**Files:** Create `packages/shared/src/records.ts` (+ `.test.ts`) ; Modify `index.ts`.
- [ ] **Tests rouges** puis impl :
  - `RECORD_TYPES = ['max_weight','estimated_1rm','best_volume']` (+ schema/type).
  - `estimate1RM(weightKg, reps)` — **Epley** `weight × (1 + reps/30)` ; `reps<=0` → weight ; arrondi raisonnable.
  - `personalRecordRowSchema` (sur `syncFieldsSchema` + `exerciseId`, `type`, `value`, `reps` null, `weightKg` null, `workoutId` null, `achievedAt`).
  - `computeWorkoutRecords(setsByExercise)` — pour un ensemble de séries **done, hors warmup** groupées par exercice, retourne, par exercice, les valeurs candidates : `max_weight` (max weightKg), `estimated_1rm` (max Epley sur les séries), `best_volume` (max reps×weightKg d'une série). Fonction **pure** ; entrée typée librement `{ exerciseId; sets: {reps; weightKg; setType; done}[] }[]`.
- [ ] Tests : Epley (cas 100×5 → 116.67 ; reps 1 → weight), exclusion warmup/non-done, best_volume, exercice sans série valide → pas de candidat.
- [ ] Commit — `feat(shared): calcul records muscu (Epley 1RM, max, volume)`

## Phase B — Backend

### Task 2 : Migration `personal_records`
**Files:** Create `supabase/migrations/<ts>_personal_records.sql` ; MAJ `powersync-sync-rules.yaml`.
- [ ] Table `personal_records` (spec §4.4) : id uuid pk, user_id uuid not null references auth.users(id) on delete cascade, exercise_id uuid not null references exercises(id), type text check in ('max_weight','estimated_1rm','best_volume'), value numeric not null, reps integer, weight_kg numeric, workout_id uuid references workouts(id), achieved_at timestamptz not null, + sync cols + trigger `set_updated_at`. Index `personal_records(user_id, exercise_id, type) where deleted_at is null`. `alter publication powersync add table public.personal_records;`
- [ ] **RLS** (table utilisateur, comme `workouts`) : select/insert/update `user_id = auth.uid()`, pas de delete.
- [ ] **Sync rules** : ajouter `select * from personal_records where user_id = bucket.user_id and deleted_at is null` au bucket `user_data` (si pas déjà présent dans le YAML).
- [ ] Commits — `chore(db): table personal_records + RLS (US3)` ; `docs(sync): sync rules personal_records (US3)`

## Phase C — Mobile : couche data

### Task 3 : Schéma PowerSync local (+`personal_records`)
**Files:** Modify `apps/mobile/src/powersync/schema.ts`
- [ ] Déclarer `personal_records` (colonnes snake_case = migration). Typecheck. Commit — `feat(mobile): schéma local personal_records (US3)`

### Task 4 : records-repository + calcul à la clôture
**Files:** Create `apps/mobile/src/data/repositories/records-repository.ts` ; petite extension du flux de clôture.
- [ ] Impl :
  - `evaluateWorkoutRecords(workoutId): Promise<PersonalRecord[]>` — lit les `workout_sets` (done, hors warmup) du workout groupées par exercice, appelle `computeWorkoutRecords` (`@wellness/shared`), compare chaque candidat au **meilleur record courant** (`personal_records` de l'utilisateur pour cet exercice+type, max value) ; si strictement supérieur → **insère une nouvelle ligne** `personal_records` (value, reps, weight_kg, workout_id, achieved_at=nowUtc()). Retourne les nouveaux records battus.
  - `useWorkoutRecords(workoutId)` — hook réactif : les `personal_records` dont `workout_id = ?` (les records **battus lors de cette séance**). Sert au résumé (Task 9) **sans threader d'état via la navigation** : les records sont persistés par `evaluateWorkoutRecords`, l'écran de résumé les relit par requête (comme `useWorkoutHistory`).
  - `currentUserId()` : **répliquer** le helper file-private de `workout-repository` (lecture `useAuthStore.getState()` hors React), ne pas l'importer.
  - `useExerciseRecords(exerciseId)` — meilleurs records actuels par type (max value par type).
  - `useExerciseProgression(exerciseId, metric: 'max_weight'|'volume', period)` — série temporelle pour les courbes : points (date, valeur) dérivés soit de `personal_records` (max_weight/1RM), soit agrégés des `workouts`/`workout_sets` (volume par séance). Choisir la source la plus simple par métrique ; requêtes paramétrées.
  - `useMuscleVolumeThisWeek()` — volume par groupe musculaire sur 7 jours (join `workout_sets`→`exercises.muscle_primary`, somme reps×weight des séries done hors warmup depuis lundi local). ⚠️ Le **début de semaine (lundi, heure locale)** se calcule en JS puis se passe en **borne UTC paramétrée** — ne pas comparer `date()` sur des chaînes UTC.
  - `useWorkoutHistory(filters?)` — étend/duplique l'existant (US1 `workout-repository.useWorkoutHistory`) si besoin de filtres ; sinon réutiliser tel quel.
  - `useWorkoutDetail(workoutId)` — séance complétée + séries groupées par exercice (réutiliser la logique de `getWorkoutSets`/groupement).
- [ ] **Intégration clôture** : dans le flux `finishWorkout` (écran de séance / résumé, US1), appeler `evaluateWorkoutRecords(workoutId)` **après** `finishWorkout`, et passer les records battus à l'écran de résumé. Ne PAS modifier la logique interne de `finishWorkout` ; juste enchaîner l'appel côté flux. (Si un point d'accroche propre manque, exposer un `finishWorkoutAndEvaluate` mince dans records-repository qui appelle les deux — à décider en implémentation, sans dupliquer la logique de clôture.)
- [ ] Typecheck. Commit — `feat(mobile): records-repository + calcul à la clôture (US3)`

## Phase D — Charts + écrans

### Task 5 : Lib de graphes
**Files:** `apps/mobile/package.json` (+ lockfile)
- [ ] `npx expo install react-native-svg` (version SDK 57) ; ajouter la lib de charts (`react-native-gifted-charts`, ou charts custom minimalistes sur `react-native-svg` si peer-deps problématiques — **décider en vérifiant l'install**, ne pas rabbit-hole). typecheck. Commit — `chore(mobile): dépendances graphes (react-native-svg + charts)`
  - ⚠️ `react-native-svg` = module natif → **nouveau dev build requis** (le noter comme checkpoint device).

### Task 6 : Composants de charts réutilisables
**Files:** Create `apps/mobile/src/components/charts/` (LineChart, BarChart minimalistes, thémés).
- [ ] Petits composants (courbe temporelle, barres par groupe) paramétrés par des données `{label,value}` ; couleurs via le thème. Smoke test. Commit — `feat(mobile): composants graphes (courbe, barres)`

### Task 7 : Écran Historique (3.38) — liste + détail
**Files:** Create `apps/mobile/src/app/history/index.tsx` (liste) + `apps/mobile/src/app/history/[id].tsx` (détail) ; entrée depuis l'onglet muscu.
- [ ] Liste chronologique (`useWorkoutHistory`, plus récent d'abord) avec durée/volume/date ; filtre simple (période) ; tap → détail (`useWorkoutDetail` : exercices, séries, volume, RPE, records battus). i18n, états vides, isLoading. Entrée depuis `strength.tsx`. typecheck+lint+test. Commit — `feat(mobile): écran historique séances (3.38)`

### Task 8 : Records + courbes de progression (3.21/3.39/3.40)
**Files:** Create `apps/mobile/src/app/progress/…` (ou intégrer à l'historique/fiche exercice) ; réutiliser les composants charts.
- [ ] Affichage des **records par exercice** (`useExerciseRecords`) ; **courbe** charge max / volume par exercice (`useExerciseProgression`, 30/90 j) ; **barres** volume par groupe musculaire (`useMuscleVolumeThisWeek`). Sélecteur de période. i18n, isLoading, états vides (pas de graphe vide → message + CTA). typecheck+lint+test. Commit — `feat(mobile): records + courbes de progression (3.21/3.39/3.40)`

### Task 9 : Célébration record au résumé (sans push)
**Files:** Modify `apps/mobile/src/app/workout-summary.tsx`
- [ ] Afficher les **records battus** via `useWorkoutRecords(workoutId)` (le résumé relit les records persistés par `evaluateWorkoutRecords`, filtrés sur `workout_id` — **pas** de passage d'état via `router`). Mise en avant/animation, PAS de notification push (3.42 différé). i18n. Commit — `feat(mobile): mise en avant des records battus au résumé (3.22)`
  - Rappel flux clôture (Task 4) : `onFinish` appelle `finishWorkout(id)` **puis** `evaluateWorkoutRecords(id)` avant de router vers le résumé, pour que les lignes `personal_records` existent quand le résumé lit `useWorkoutRecords(id)`.

## Phase E — Tests & vérification

### Task 10 : Tests & i18n
- [ ] Clés i18n fr/en des nouveaux écrans (parité). Tests `packages/shared` (Epley, computeWorkoutRecords, détection). Smoke jest-expo sur un écran/chart. typecheck+lint+test verts. Commit — `test(us3): tests records + i18n`

### Task 11 : Vérification device *(checkpoint humain)*
- [ ] **Nouveau dev build** (react-native-svg natif). Faire une séance → clôture → record détecté et mis en avant ; historique liste+détail ; courbes s'affichent avec des données réelles ; volume/groupe correct ; offline OK, sync montante/descendante + **RLS 2 appareils** ; i18n FR/EN ; graphes lisibles en thème clair/sombre.

## Definition of Done
Idem US1/US2 : typecheck+lint+test verts · offline · RLS 2 appareils · i18n FR/EN · optimistic UI · CHANGELOG+TODO tenus. **Prérequis** : US1+US2 mergées + migrations appliquées.

## Points d'attention
- **Nouveau dev build** requis (dépendance native `react-native-svg`) — checkpoint device.
- `personal_records` = journal (nouvelle ligne par record, jamais d'écrasement) — compatible gamification future.
- Calcul records à la clôture : brancher **après** `finishWorkout` sans dupliquer sa logique.
- Notification 3.42 explicitement **différée** (infra push) — la détection est posée et réutilisable.
- Migration cloud + sync rules + device = checkpoints 🔴 humains (comme US1/US2).
