# US Refonte-C2 — Écran de séance : saisie enrichie — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans, tâche par tâche. Étapes en checkbox (`- [ ]`).

**Goal:** Enrichir la saisie d'une série sur l'écran de séance muscu : **types de séries** exposés (échauffement exclu du volume/records, durée, poids de corps, dropset, échec) avec raccourci échauffement 1 tap, **RPE par série** (1-10, optionnel), et **charge planifiée vs réalisée** (snapshot figé + écart), le tout reflété dans le résumé et l'historique.

**Architecture:** Descente de bas en haut — d'abord la **migration** (2 colonnes `workout_sets` + assouplissement du `CHECK set_type` sur `workout_sets` et `exercise_plans`), puis le **partagé** (`SET_TYPES` + Zod + règle records), puis les **repositories** (workout + records dupliqué), enfin l'**UI** (carte focus, liste, résumé, historique) et l'**i18n**. Le calcul de volume est inchangé ; `computeWorkoutRecords` gagne l'exclusion `duration`.

**Tech Stack:** `supabase` CLI (migration cloud, **sans Docker**) ; `packages/shared` (Zod + Vitest) ; `apps/mobile` (Expo Router, PowerSync `useQuery`, i18next). **Aucune dépendance native ajoutée** → pas de rebuild.

**Spec :** [refonte-muscu-c2-saisie-enrichie.md](../specs/functional/us/refonte-muscu-c2-saisie-enrichie.md) (validée Florian, 20/07/2026). **Analyse :** [analyse-seance-en-cours.md](../refonte-muscu/analyse-seance-en-cours.md) (points 5, 6, 13, 14, 18).

**Branche :** `feature/refonte-muscu-c2` (créée depuis `dev`).

> **Invariants :**
> - **Offline-first** : écritures optimistes locales (`updateSet`/`patch`/`insertWithSyncFields`), lecture réactive `useQuery`.
> - **🔴 Migration = checkpoint cloud** (base partagée `nsxzflxsgovriwwvflxe`) : `db:push` **seulement après go explicite de Florian**. Jamais de SQL collé à la main. Régénérer `database.types.ts` ensuite, cocher `supabase/MIGRATIONS.md`.
> - **i18n** parité FR/EN stricte, aucune chaîne en dur.
> - **Périmètre C2 strict** : PAS de superset (enchaînement + repos après la paire), réorg, machine prise, remplacer, note par exercice, démo, suggestion de progression → **C3**.
> - **Règle métier** : volume exclut `warmup` seul ; records excluent `warmup` **et** `duration` ; `bodyweight` lesté = record légitime ; dropset/échec comptent partout.
> - À chaque commit : `npm run typecheck` + `npm run lint -w @wellness/mobile` + `npm run test` verts. Ne jamais stager `apps/mobile/eas.json`. Tests mobile jest-expo non câblés → vérif typecheck/lint + Vitest (shared) + relecture + recette device.

---

## Task 1 : Migration cloud (🔴 checkpoint)

**Files:** Create `supabase/migrations/<horodatage>_refonte_muscu_c2_saisie_enrichie.sql` ; Modify `supabase/MIGRATIONS.md`, `packages/shared/src/database.types.ts` (régénéré).

- [ ] **Étape 1 — créer le fichier.** `npm run db:new refonte_muscu_c2_saisie_enrichie` puis y écrire :
```sql
-- US Refonte-C2 : RPE par série, charge planifiée figée, nouveaux types de séries (dropset, échec).
alter table public.workout_sets
  add column if not exists rpe integer check (rpe between 1 and 10);
alter table public.workout_sets
  add column if not exists planned_weight_kg numeric check (planned_weight_kg is null or planned_weight_kg >= 0);

-- Assouplir le CHECK set_type (ajout de 'dropset' et 'failure') sur les deux tables porteuses.
alter table public.workout_sets   drop constraint if exists workout_sets_set_type_check;
alter table public.workout_sets   add  constraint workout_sets_set_type_check
  check (set_type in ('normal','warmup','superset','duration','bodyweight','dropset','failure'));
alter table public.exercise_plans drop constraint if exists exercise_plans_set_type_check;
alter table public.exercise_plans add  constraint exercise_plans_set_type_check
  check (set_type in ('normal','warmup','superset','duration','bodyweight','dropset','failure'));
```
- [ ] **Étape 2 — prévisualiser.** `npm run db:push:dry` ; vérifier que **seule** cette migration part.
- [ ] **Étape 3 — 🔴 GO explicite Florian**, puis `npm run db:push`. Vérifier « Remote database is up to date » / migration jouée.
- [ ] **Étape 4 — types.** `npm run db:types` (régénère `packages/shared/src/database.types.ts`). Vérifier que `workout_sets.Row` contient `rpe` + `planned_weight_kg`.
- [ ] **Étape 5 — registre.** Cocher la migration dans `supabase/MIGRATIONS.md` (case + date + note « C2 »).
- [ ] **Étape 6 — commit** (`feat(db)`), typecheck vert.

> ⚠️ Migration **non idempotente** (drop+add) : ne jamais rejouer. En cas d'échec `db:push`, **stopper et prévenir** (ne pas coller le SQL à la main).

---

## Task 2 : Partagé — enum, schémas, règle records + tests (packages/shared)

**Files:** Modify `packages/shared/src/workout.ts` ; Test `packages/shared/src/workout.test.ts` ; (records) `packages/shared/src/records.ts` + `records.test.ts`. **Lis les fichiers d'abord.**

- [ ] **Étape 1 — test rouge (enum).** Dans `workout.test.ts`, adapter l'assertion `SET_TYPES` pour inclure `'dropset','failure'` ; ajouter `setTypeSchema.parse('dropset')` / `'failure'`. Lancer → **rouge**.
- [ ] **Étape 2 — enum.** `SET_TYPES = ['normal','warmup','superset','duration','bodyweight','dropset','failure']` + compléter le JSDoc (dropset = série dégressive ; failure = série à l'échec). Vert.
- [ ] **Étape 3 — schémas Zod.** Dans `workoutSetRowSchema` : ajouter `rpe: z.number().int().min(1).max(10).nullable()` et `plannedWeightKg: z.number().nonnegative().nullable()`. Typecheck.
- [ ] **Étape 4 — test rouge (records duration).** Dans `records.test.ts`, ⚠️ un cas « duration » existe déjà (~l.421) mais avec `weightKg: null` → il reste vert quoi qu'il arrive et **ne couvre pas** le cas visé. Ajouter un cas **distinct** : série `duration` avec `weightKg` **renseigné** (ex. gainage lesté `weightKg:20, reps:null, done:true`) → **ne doit PAS** produire de candidat `max_weight` ; et une série `bodyweight` lestée (`weightKg:40, reps:5, done:true`) → **doit** produire `max_weight=40`. Lancer → le cas duration lesté est **rouge** aujourd'hui (il remonte un max_weight).
- [ ] **Étape 5 — règle records.** Dans `computeWorkoutRecords` (`records.ts`), étendre le filtre des séries éligibles : `s.done === true && s.setType !== 'warmup' && s.setType !== 'duration'`. Vert. Vérifier que les cas warmup existants restent verts.
- [ ] **Étape 6 — test volume nouveaux types.** Dans `workout.test.ts` (`computeVolume`), ajouter : dropset/failure comptent (reps×charge), duration compte 0 (reps null), bodyweight sans charge compte 0, bodyweight lesté compte reps×lest. Vert.
- [ ] **Étape 7 — test schémas Zod.** Ajouter un cas rouge→vert sur `workoutSetRowSchema` : `rpe` accepte 1-10 et null, rejette 0/11 ; `plannedWeightKg` accepte un nombre ≥ 0 et null, rejette un négatif. Vert.
- [ ] **Étape 8 — vérifier** `npm run test` + `npm run typecheck`. Commit (`feat(shared)`).

---

## Task 3 : Schéma PowerSync local (apps/mobile)

**Files:** Modify `apps/mobile/src/powersync/schema.ts`.

- [ ] **Étape 1 —** dans la table `workout_sets`, ajouter `rpe: column.integer` et `planned_weight_kg: column.real` (à côté de `done`). Commentaire « US Refonte-C2 ».
- [ ] **Étape 2 — vérifier** `npm run typecheck`. (Pas de test dédié ; PowerSync lit ces colonnes déjà présentes en base après Task 1.)

---

## Task 4 : workout-repository.ts (lecture/écriture enrichies)

**Files:** Modify `apps/mobile/src/data/repositories/workout-repository.ts`. **Lis le fichier d'abord.**

- [ ] **Étape 1 — type de domaine.** `WorkoutSetItem` : ajouter `rpe: number | null` et `plannedWeightKg: number | null`.
- [ ] **Étape 2 — read.** `SELECT_SETS_FOR_WORKOUT` : ajouter `s.rpe, s.planned_weight_kg` ; `WorkoutSetDbRow` : ajouter `rpe: number | null` + `planned_weight_kg: number | null` ; `rowToSetItem` : mapper les 2 champs (`rpe: row.rpe`, `plannedWeightKg: row.planned_weight_kg`).
- [ ] **Étape 3 — patch.** `WorkoutSetPatch` : ajouter `rpe?: number | null`. `updateSet` : `if ('rpe' in input) columns['rpe'] = input.rpe;`. **Ne pas** ajouter `plannedWeightKg` (snapshot immuable).
- [ ] **Étape 4 — seed snapshot.** `startWorkoutFromSession` : dans l'insert des séries pré-remplies, ajouter `planned_weight_kg: plan.target_weight_kg` (à côté de `weight_kg: plan.target_weight_kg`).
- [ ] **Étape 5 — hors plan = null.** `addExerciseToWorkout` et `addSet` : ajouter `planned_weight_kg: null` à l'insert. Dans `addSet`, quand la dernière série est `warmup`, **ne pas hériter** l'échauffement : forcer `set_type: 'normal'` **et** repartir de `reps: null` / `weight_kg: null` / `duration_seconds: null` (une charge d'échauffement n'est pas un point de départ réaliste pour une série de travail). Sinon (dernière série non-warmup) : héritage inchangé (comportement C1).
- [ ] **Étape 6 — dernière perf sans warmup.** `SELECT_LAST_PERFORMANCE` : ajouter `AND s.set_type <> 'warmup'` dans la requête principale **et** la sous-requête de sélection de la séance (pour ne considérer que les séances où l'exercice a une série de travail validée).
- [ ] **Étape 7 — vérifier** `npm run typecheck` + `npm run lint -w @wellness/mobile`. Commit (`feat(mobile)`).

---

## Task 5 : records-repository.ts (read dupliqué de l'historique détail)

**Files:** Modify `apps/mobile/src/data/repositories/records-repository.ts`. **Lis le bloc lignes 188-242.**

- [ ] **Étape 1 — read.** `SELECT_SETS_FOR_WORKOUT` (file-private, ~ligne 188) : ajouter `s.rpe, s.planned_weight_kg`.
- [ ] **Étape 2 — type.** `WorkoutSetDbRow` (~ligne 200) : ajouter `rpe: number | null` + `planned_weight_kg: number | null`.
- [ ] **Étape 3 — mapping.** `rowToSetItem` (~ligne 231) : mapper `rpe` + `plannedWeightKg` (sinon `WorkoutSetItem` incomplet → typecheck KO).
- [ ] **Étape 4 — vérifier** `npm run typecheck`. (L'exclusion `duration` des records est déjà propagée via `computeWorkoutRecords` — rien à faire ici.) Commit (`fix(mobile)` ou fusionné à Task 4).

---

## Task 6 : CurrentSetCard — type de série + saisie adaptée + charge planifiée

**Files:** Modify `apps/mobile/src/components/workout/CurrentSetCard.tsx` (+ `apps/mobile/src/app/workout.tsx` pour câbler les handlers). **Lis les fichiers d'abord.** Maquette validée = référence visuelle.

- [ ] **Étape 1 — sélecteur de type.** Ajouter un contrôle compact (segmenté ou menu) : Normale / Échauffement / Dropset / Échec / Durée / Poids de corps → `onSetType(setId, type)` → `updateSet({ setType })`. Libellés i18n.
- [ ] **Étape 2 — raccourci échauffement 1 tap.** Bouton dédié qui bascule `normal ↔ warmup` sans ouvrir le sélecteur. État visuel actif quand `warmup`.
- [ ] **Étape 3 — saisie conditionnelle durée.** Si `setType === 'duration'` : remplacer le champ reps par une saisie **mm:ss** (ou steppers ± 5/10 s) écrivant `durationSeconds` ; masquer reps. Charge reste optionnelle.
- [ ] **Étape 4 — poids de corps.** Si `setType === 'bodyweight'` : la charge devient optionnelle (placeholder « lest », vide = poids de corps). reps conservé.
- [ ] **Étape 5 — charge planifiée.** Si `plannedWeightKg != null` : afficher « Prévu : {X} kg » (unité active) près du champ réalisé ; après validation, indicateur d'écart réalisé vs prévu (**=** / **▲** / **▼**). Rien si null.
- [ ] **Étape 6 — non-régression.** Steppers, validation (log+repos+avance) et pré-remplissage C1 inchangés pour `normal`. Vérifier typecheck/lint. Commit.

---

## Task 7 : RPE par série (carte focus)

**Files:** Modify `apps/mobile/src/components/workout/CurrentSetCard.tsx` (+ `workout.tsx`).

- [ ] **Étape 1 — champ RPE optionnel, masqué.** Par défaut, une affordance discrète **« ＋ RPE »** (pas de contrôle visible). Au tap → déplie un **sélecteur 1-10** ; sélection → `updateSet({ rpe })`. Si `set.rpe != null`, afficher « RPE {n} » (ré-éditable, effaçable → retour à null). Ne pas encombrer la carte quand le RPE n'est pas utilisé (maquette validée).
- [ ] **Étape 2 — clair vs global.** Libellé i18n distinguant « RPE (série) » du ressenti global 5★ de fin de séance. Aucun caractère obligatoire (une série sans RPE reste valide).
- [ ] **Étape 3 — vérifier** typecheck/lint. Commit.

---

## Task 8 : ExerciseList — badges de type + RPE

**Files:** Modify `apps/mobile/src/components/workout/ExerciseList.tsx`.

- [ ] **Étape 1 — badge de type.** Sur chaque série non-`normal`, afficher un badge court (Éch. / Drop / Échec / Durée / PdC), i18n.
- [ ] **Étape 2 — accès type + RPE.** Permettre le changement de type depuis la liste dépliée (réutilise `onSetType`) ; afficher le RPE de la série s'il existe.
- [ ] **Étape 3 — vérifier** typecheck/lint. Commit.

---

## Task 9 : Résumé — exclure les échauffements du décompte

**Files:** Modify `apps/mobile/src/app/workout-summary.tsx`. **Lis lignes 33-43.**

- [ ] **Étape 1 — décompte séries.** `doneSets` (~ligne 38) : filtrer `s.done && s.setType !== 'warmup'`.
- [ ] **Étape 2 — décompte exercices.** `exercises` (~ligne 41) : ne compter que les exercices ayant ≥ 1 série non-`warmup` (filtrer avant le `Set`).
- [ ] **Étape 3 — (optionnel) mention échauffements.** Afficher « X échauffement(s) » séparé si ≥ 1. i18n.
- [ ] **Étape 4 — vérifier** typecheck/lint (volume/records déjà corrects via shared). Commit.

---

## Task 10 : Historique détail — type + RPE + écart prévu/réalisé

**Files:** Modify `apps/mobile/src/app/history/[id].tsx`. **Lis le fichier d'abord.**

- [ ] **Étape 1 — badge type** par série (réutilise les libellés de Task 8).
- [ ] **Étape 2 — RPE/série** affiché s'il existe (à côté de reps × charge).
- [ ] **Étape 3 — écart prévu/réalisé** : si `plannedWeightKg != null`, afficher « prévu {X} → réalisé {Y} » avec indicateur =/▲/▼.
- [ ] **Étape 4 — vérifier** typecheck/lint. Commit.

---

## Task 11 : i18n FR/EN (parité)

**Files:** Modify `apps/mobile/src/i18n/locales/fr.json` + `en.json`.

- [ ] **Étape 1 — clés.** `workout.setType.{normal,warmup,dropset,failure,duration,bodyweight}` (labels) + `.badge.*` (courts) ; `workout.warmupToggle` ; `workout.rpeSet.{label,hint}` ; `workout.plannedWeight` ; `workout.plannedDelta.{equal,above,below}` ; `workout.durationInput` ; `workout.summary.warmupCount_one/_other`. Ajouter au fil des tâches 6-10, centraliser ici la vérif.
- [ ] **Étape 2 — parité (contrôle ad hoc).** Il n'existe **pas** de script npm de parité. Vérifier via un
  contrôle node ad hoc comparant les jeux de clés **aplaties** des deux fichiers, p. ex. :
```bash
node -e "const f=require('./apps/mobile/src/i18n/locales/fr.json'),e=require('./apps/mobile/src/i18n/locales/en.json');const F=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'&&v?F(v,p+k+'.'):[p+k]);const a=new Set(F(f)),b=new Set(F(e));const only=(x,y)=>[...x].filter(k=>!y.has(k));console.log('FR seules:',only(a,b));console.log('EN seules:',only(b,a));"
```
  Attendu : les deux listes **vides**. Corriger tout écart.
- [ ] **Étape 3 — vérifier** typecheck/lint. Commit.

---

## Task 12 : Vérification finale & non-régression

- [ ] `npm run typecheck` + `npm run lint` + `npm run test` (tous workspaces) verts.
- [ ] Bundle mobile : `npx expo export --platform web` (smoke-test) OK.
- [ ] **Non-régression C1** : démarrage séance planifiée (reps/charge pré-remplis, `planned_weight_kg` figé) ; validation = log+repos+avance ; dé-valider ; résumé éditable ; historique.
- [ ] **Cohérence records dashboard** : confirmer qu'aucun hook dashboard (`useExerciseProgression`, `useMuscleVolumeThisWeek`, etc.) ne calcule une charge max / 1RM à partir de séries `duration` lestées (ils filtrent déjà `warmup` + reps/poids non nuls → à vérifier suffisant vis-à-vis de la nouvelle règle records).
- [ ] **Recette device (Florian)** : marquer échauffement 1 tap → exclu du volume/records/décompte ; série durée (mm:ss) ; poids de corps (lest) ; dropset/échec comptent ; RPE/série saisi + relu en historique ; écart prévu/réalisé.
- [ ] CHANGELOG + TODO + roadmap (Statut) via `/commit` à chaque étape ; PR relue par les deux devs.

---

## Ordre & dépendances

Task 1 (migration) **bloque** 2-12 (colonnes requises). 2 (shared) avant 4/5 (types importés). 3 (schema) avant 4/5 (colonnes locales). 6-10 (UI) après 4/5. 11 (i18n) transverse, verrouillée en fin. 12 = porte de sortie. Migration = **seul** point cloud → une passe, go explicite.
