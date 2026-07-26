---
id: REFONTE-C2
titre: "Écran de séance : saisie enrichie (types de séries, RPE par série, charge planifiée vs réalisée)"
roadmap: [3.27]
catalogue: []
etape: close
branche: feature/refonte-muscu-c2
maj: 20/07/2026
---
# US Refonte-C2 — Écran de séance : saisie enrichie (types de séries, RPE par série, charge planifiée vs réalisée)

> **Chantier refonte Muscu**, US-C **découpée en 3 sous-US** (C1 ✅ → **C2** → C3). **C2 = enrichir la saisie**
> d'une série : exposer les **types de séries** (échauffement exclu du volume/records — déjà câblé côté calcul —,
> durée, poids de corps, dropset, échec), ajouter un **RPE par série** et distinguer **charge planifiée vs
> réalisée**. Corrige les **problèmes 5 & 6** de l'[audit](../../../refonte-muscu/audit-flux.md) et couvre les
> points **5, 6, 13, 14, 18** de l'[analyse](../../../refonte-muscu/analyse-seance-en-cours.md).
> Dépend d'US-C1 (livrée : carte focus `CurrentSetCard`, liste `ExerciseList`, validation + repos). Absorbe
> **MUSC-F5 / MUSC-F6** du backlog. Branche : `feature/refonte-muscu-c2` · Date : 20/07/2026 ·
> **Statut : à valider (pas de code avant validation).**
> **🔴 Migration cloud requise** (colonnes `workout_sets.rpe` + `workout_sets.planned_weight_kg` + assouplissement
> du `CHECK` sur `set_type` de `workout_sets` **et** `exercise_plans`).

## 0. Contexte

Après C1, l'écran de séance est guidé, rapide et sûr, mais la **saisie reste pauvre** : toutes les séries sont
traitées comme « normales », le `set_type` (présent en base) n'est **pas exposé** — les échauffements comptent
donc dans le volume et les records affichés (règle §8 violée à l'écran, alors que `computeVolume` /
`computeWorkoutRecords` **excluent déjà** `warmup`). Les exercices **en durée** ou **au poids de corps** ne sont
pas gérés (seulement reps + charge). Il n'existe aucun **RPE par série**, et la **charge cible du plan** est
écrasée dès la première saisie (une seule valeur `weight_kg`) : impossible de comparer **prévu vs réalisé**.

Décisions de cadrage (brainstorming Florian, 20/07/2026) :
- **Une seule US C2** (les 3 volets touchent la même ligne de série et le même écran → une passe, migrations groupées).
- **Charge planifiée vs réalisée** = **colonne figée** `workout_sets.planned_weight_kg` (snapshot au démarrage) ;
  le champ saisissable reste le **réalisé** (`weight_kg`). Comparaison conservée dans le résumé et l'historique.
- **RPE par série** = échelle **1-10** (standard muscu ; RPE 8 ≈ 2 reps en réserve), **optionnel**, distinct du
  **ressenti global 5★** de fin de séance (C1, `workouts.rpe`). Nouvelle colonne `workout_sets.rpe`.
- **Types exposés** : `warmup` (échauffement, **exclu** volume/records) · `duration` (durée) · `bodyweight`
  (poids de corps) — déjà en base — **plus** `dropset` · `failure` (échec) — **nouvelles** valeurs d'enum.
  Le **superset** reste **hors C2** (logique de flux → C3).

## 1. Périmètre à livrer (C2)

- **Sélecteur de type de série** par série (carte focus `CurrentSetCard` + liste `ExerciseList`), avec un
  **raccourci « échauffement » en 1 tap** (point 18). Badge visuel sur les séries non-normales.
- **Saisie adaptée au type** : `duration` → durée (mm:ss) au lieu de reps ; `bodyweight` → charge optionnelle
  (lest « +X kg » ou vide) ; `dropset`/`failure` → saisie normale + marqueur.
- **RPE par série** (1-10, optionnel) saisissable sur la carte focus et affiché dans le détail d'historique.
- **Charge planifiée vs réalisée** : snapshot `planned_weight_kg` figé au démarrage d'une séance de programme,
  affiché **en référence** à côté du champ réalisé, avec indicateur d'écart (=, ▲, ▼).
- **Exclusion échauffement rendue visible** : le résumé (volume, séries comptées, records 🏆) et l'historique
  reflètent l'exclusion des `warmup` (le calcul le fait déjà ; il s'agit de l'exposer et de le rendre marquable).
- **Migrations** + régénération des types + extension du schéma PowerSync + enum partagé `SET_TYPES`.
- **i18n** FR/EN ; offline-first.

**Hors périmètre (→ C3, à ne pas implémenter ici) :**
- **Superset / circuit** (enchaînement de 2 exercices, repos après la paire) — logique de flux.
- Réorganiser, « machine prise » (sauter/revenir), remplacer par variante, note par exercice, accès démo en
  séance, suggestion de progression (surcharge progressive).

## 2. Comportement attendu

### 2.1 Type de série
- Chaque série porte un **type** (défaut `normal`). Choix parmi : **Normale** · **Échauffement** · **Dropset** ·
  **Échec** · **Durée** · **Poids de corps**. Sélecteur compact sur la **carte focus** (série en cours) et
  accessible depuis la **liste dépliée** d'un exercice (chaque série).
- **Raccourci échauffement (1 tap)** : un contrôle dédié bascule la série courante en `warmup` / la ramène à
  `normal` sans ouvrir le sélecteur complet (usage « live » le plus fréquent, point 18).
- **Badge** : une série non-`normal` affiche un marqueur discret (ex. « Éch. », « Drop », « Échec », « Durée »,
  « PdC ») dans la liste et sur la carte.
- **Échauffement** : visuellement distingué et **exclu du volume et des records** (déjà le cas dans le calcul) ;
  le résumé n'en tient pas compte.

### 2.2 Saisie adaptée au type
- **Normale / Dropset / Échec** : reps + charge (steppers − / + de C1 inchangés). Ces séries **comptent** dans le
  volume et les records (ce sont des marqueurs de technique, pas des exclusions).
- **Durée** (`duration`) : la saisie **reps** est remplacée par une **durée** (mm:ss, saisie ou steppers ± 5/10 s) ;
  la charge reste optionnelle. `reps` n'est pas pertinent.
- **Poids de corps** (`bodyweight`) : la charge est **optionnelle** (vide = poids de corps seul) ; on peut saisir
  un **lest** (`weight_kg` = charge additionnelle). reps present.
- Le changement de type **conserve** les valeurs déjà saisies quand elles restent pertinentes (ex. normal ↔
  dropset ↔ échec : reps/charge inchangés).

### 2.3 RPE par série
- **RPE (1-10) optionnel**, **masqué par défaut** derrière une affordance discrète **« ＋ RPE »** sur la carte
  focus (la majorité des utilisateurs ne s'en servent pas → ne pas encombrer). Au tap, un **sélecteur 1-10**
  se déplie ; une fois renseigné, la carte affiche « RPE {n} » (ré-éditable). Persisté sur `workout_sets.rpe`.
- Aucune obligation : une série validée sans RPE reste valide. Le RPE **n'entre pas** dans le volume ni les records.
- **Distinct** du ressenti global 5★ (C1) : le global (`workouts.rpe`) est subjectif de fin de séance, **affiché
  en 5★ par convention UI** (la colonne DB, elle, est 1-10) ; le RPE/série (1-10) mesure la proximité de l'échec
  série par série. Les deux coexistent — **ne pas modifier** l'échelle de `workouts.rpe` en base.
- Affiché dans le **détail d'historique** par série (à côté de reps × charge).

### 2.4 Charge planifiée vs réalisée
- Au **démarrage d'une séance de programme** (`startWorkoutFromSession`), chaque série pré-remplie **fige** la
  charge cible du plan dans `planned_weight_kg` (snapshot), **en plus** de pré-remplir le réalisé `weight_kg` avec
  cette même cible (comportement C1 conservé : valeur de départ modifiable).
- Sur la carte focus, quand `planned_weight_kg` est renseigné, afficher la **cible en référence** (« Prévu : 80 kg »)
  à côté du champ réalisé, avec un **indicateur d'écart** une fois la série validée (**=** égal, **▲** au-dessus,
  **▼** en dessous).
- **Séries ajoutées au-delà du plan** (`addSet`) et **séances libres** / exercices ajoutés en cours
  (`addExerciseToWorkout`) : `planned_weight_kg = null` → **aucune** référence affichée (rien à comparer).
- La comparaison **survit** dans le **résumé** et l'**historique** (le snapshot est stocké, pas recalculé).

### 2.5 Résumé & historique
- **Résumé** ([workout-summary.tsx](../../../../apps/mobile/src/app/workout-summary.tsx)) : le **volume** et les
  **records 🏆** excluent **déjà** les `warmup` (calcul partagé, inchangé). En revanche le **décompte de séries**
  ([:38](../../../../apps/mobile/src/app/workout-summary.tsx#L38)) et le **décompte d'exercices**
  ([:41](../../../../apps/mobile/src/app/workout-summary.tsx#L41)) les **incluent aujourd'hui** → **à modifier**
  pour filtrer `setType !== 'warmup'` (un exercice qui n'a que des échauffements ne compte pas). Optionnel :
  mention « X échauffement(s) » séparée.
- **Historique détail** ([history/[id].tsx](../../../../apps/mobile/src/app/history/[id].tsx)) : afficher le
  **type** de chaque série (badge), le **RPE/série** s'il existe, et l'écart **prévu/réalisé** s'il existe.

## 3. Règles métier

- **Volume** (`computeVolume`) : **seul `warmup` est exclu** — `dropset`, `failure`, `duration`, `bodyweight`
  comptent. **Calcul inchangé** (C2 n'ajoute pas d'exclusion de volume).
- **Records** (`computeWorkoutRecords`) : exclure `warmup` (déjà le cas) **et** `duration` (travail au temps, pas
  une charge de force — sinon un gainage lesté remonterait un record « charge max »). `bodyweight` **avec lest**
  reste éligible (traction/dips lestés = record `max_weight` légitime) ; sans lest (`weightKg` nul) aucun candidat
  `max_weight` n'est émis (le calcul ignore déjà les charges nulles). `dropset`/`failure` comptent.
  → **petite modification** de `computeWorkoutRecords` (shared) : ajouter `duration` à l'exclusion (aujourd'hui
  `warmup` seul). `evaluateWorkoutRecords` (records-repository) **délègue** à cette fonction → propagation
  automatique, **rien à changer** dans l'évaluation live.
- **`duration`** : `reps` nul, `duration_seconds` renseigné ; contribue au volume selon la règle existante
  (reps×charge → 0 si reps nul — n'ajoute pas de tonnage, cohérent avec un travail au temps).
- **`bodyweight`** : `weight_kg` peut être nul (poids de corps) ; s'il est renseigné, c'est le **lest** (le volume
  tonnage n'intègre pas le poids de corps de l'utilisateur — hors périmètre, non estimé).
- **« Dernière fois » (C1)** : `useLastPerformance` / `SELECT_LAST_PERFORMANCE` doit **exclure les `warmup`**
  (`AND s.set_type <> 'warmup'`) pour ne montrer que les séries de travail, cohérent avec l'exclusion ci-dessus.
- **RPE/série** : entier **1-10**, nullable ; contrainte `check (rpe between 1 and 10)` en base (comme
  `runs.rpe` et le CHECK réel de `workouts.rpe`, lui aussi 1-10 en base).
- **`planned_weight_kg`** : snapshot **immuable** (posé au démarrage, non réécrit quand l'utilisateur modifie le
  réalisé). Nullable (séries hors plan). `check (planned_weight_kg is null or planned_weight_kg >= 0)`.
- **Rétrocompatibilité** : les séries et séances **existantes** ont `rpe = null`, `planned_weight_kg = null`,
  `set_type` inchangé → aucun écran ne régresse (absence = pas d'affichage enrichi).
- **Offline-first** : toutes les écritures optimistes locales ; la migration ne change pas ce contrat.

## 4. Architecture & données

### 4.1 Migrations (🔴 checkpoint cloud)
Un seul fichier de migration (`npm run db:new refonte_muscu_c2_saisie_enrichie`) regroupant :
1. `alter table public.workout_sets add column if not exists rpe integer check (rpe between 1 and 10);`
2. `alter table public.workout_sets add column if not exists planned_weight_kg numeric check (planned_weight_kg is null or planned_weight_kg >= 0);`
3. Assouplir le `CHECK` sur `set_type` **des deux tables** (drop + recréation avec les 2 nouvelles valeurs) :
   ```sql
   alter table public.workout_sets   drop constraint if exists workout_sets_set_type_check;
   alter table public.workout_sets   add  constraint workout_sets_set_type_check
     check (set_type in ('normal','warmup','superset','duration','bodyweight','dropset','failure'));
   alter table public.exercise_plans drop constraint if exists exercise_plans_set_type_check;
   alter table public.exercise_plans add  constraint exercise_plans_set_type_check
     check (set_type in ('normal','warmup','superset','duration','bodyweight','dropset','failure'));
   ```
Puis `npm run db:push:dry` → **go explicite de Florian** → `npm run db:push` → `npm run db:types` → cocher
[supabase/MIGRATIONS.md](../../../../supabase/MIGRATIONS.md).

> ✅ Noms de contraintes confirmés : les CHECK d'origine sont des contraintes de colonne **inline anonymes**
> (socle:81, programmes:52) → Postgres les nomme `workout_sets_set_type_check` / `exercise_plans_set_type_check`.
> Le `drop … if exists` + `add` fonctionnera.
> ⚠️ **Non idempotente** : `drop if exists` + `add` échoue si rejouée (doublon de nom). Conforme à la règle projet
> « jamais rejouer une migration appliquée » — ne pas la relancer. Rien d'autre à ajouter (pas d'index nécessaire,
> trigger `set_updated_at` déjà posé sur `workout_sets`, table déjà dans la publication `powersync`).

### 4.2 Partagé (`packages/shared`)
- `SET_TYPES` (dans [workout.ts](../../../../packages/shared/src/workout.ts)) : ajouter `'dropset'`, `'failure'`
  (+ compléter le JSDoc décrivant chaque type).
- `workoutSetRowSchema` : ajouter `rpe` (`z.number().int().min(1).max(10).nullable()`) et `plannedWeightKg`
  (`z.number().nonnegative().nullable()`, en miroir du CHECK `>= 0`).
- `computeVolume` : **inchangé** (seul `warmup` exclu). **Ajouter des tests** confirmant que dropset/failure/
  bodyweight/duration comptent (ou 0 pour duration faute de reps) et que warmup reste exclu.
- `computeWorkoutRecords` : **petite modification** — exclure `duration` en plus de `warmup` (voir §3). Tests :
  dropset/failure éligibles, bodyweight-lesté éligible `max_weight`, duration exclu, warmup exclu.
- Table de correspondance type → libellé i18n (helper ou clés) pour les badges.

### 4.3 PowerSync (`apps/mobile`)
- [schema.ts](../../../../apps/mobile/src/powersync/schema.ts) : ajouter `rpe: column.integer` et
  `planned_weight_kg: column.real` à la table `workout_sets`.

### 4.4 Repositories (`workout-repository.ts` **et** `records-repository.ts`)
- **`workout-repository.ts`** :
  - `WorkoutSetItem` : ajouter `rpe: number | null` et `plannedWeightKg: number | null` ; mapper dans
    `rowToSetItem` + `SELECT_SETS_FOR_WORKOUT` (+ `getWorkoutSets`).
  - `WorkoutSetPatch` : ajouter `rpe?: number | null` ; `updateSet` écrit `rpe` (colonne `rpe`). **Ne pas** ajouter
    `plannedWeightKg` au patch (snapshot immuable).
  - `startWorkoutFromSession` : seed `planned_weight_kg = plan.target_weight_kg` (en plus de `weight_kg`).
  - `addSet` / `addExerciseToWorkout` : `planned_weight_kg = null` (hors plan). `addSet` **ne doit pas hériter**
    d'un `set_type = 'warmup'` de la série précédente → retomber sur `'normal'` si la dernière série était un
    échauffement (éviter d'enchaîner des warmup involontaires).
  - **`useLastPerformance` / `SELECT_LAST_PERFORMANCE`** : ajouter `AND s.set_type <> 'warmup'` (voir §3).
- **`records-repository.ts`** (⚠️ bloc **dupliqué** du read de séries pour l'historique détail) : ajouter
  `s.rpe`, `s.planned_weight_kg` à **son** `SELECT_SETS_FOR_WORKOUT`, aux champs de **son** `WorkoutSetDbRow` et à
  **son** `rowToSetItem` — sinon `WorkoutSetItem` est incomplet (**typecheck KO**) et l'historique détail n'expose
  ni RPE ni écart. `evaluateWorkoutRecords` délègue à `computeWorkoutRecords` → exclusion `duration` automatique,
  rien d'autre à toucher ici.
- Le type de série est déjà pris en charge par `updateSet({ setType })` ; le raccourci échauffement l'utilise.
- **Dashboard/progression** : `useExerciseProgression`, `useMuscleVolumeThisWeek`, `useMuscleBalance`,
  `useWeeklyVolumeComparison`, `useTrainingNutritionCross` filtrent **déjà** `set_type <> 'warmup'` + reps/poids
  non nuls → **rien à toucher** (vérifié).

### 4.5 UI (`apps/mobile`)
- **`CurrentSetCard`** : sélecteur de type + raccourci échauffement 1 tap ; saisie conditionnelle
  (durée vs reps) ; champ RPE optionnel ; ligne « Prévu : X kg » + indicateur d'écart.
- **`ExerciseList`** : badge de type par série ; accès au sélecteur de type ; affichage RPE si présent.
- **`workout-summary.tsx`** / **`history/[id].tsx`** : badges de type, RPE/série, écart prévu/réalisé ; s'assurer
  que le décompte « séries » et le volume n'incluent pas les échauffements.
- **i18n** : clés `workout.setType.*` (labels + badges), `workout.rpeSet.*`, `workout.plannedWeight`,
  `workout.plannedDelta.*` (égal/au-dessus/en-dessous), `workout.duration*` — FR + EN, parité stricte.

## 5. Offline & données

- Écritures **locales optimistes** inchangées ; nouvelles colonnes synchronisées par PowerSync comme les autres.
- **🔴 Migration = checkpoint cloud** : `db:push` sur la base partagée `nsxzflxsgovriwwvflxe` **uniquement après
  go explicite**. Pas de SQL collé à la main (registre CLI). Régénérer `database.types.ts` ensuite.
- **Pas de nouvelle dépendance native** (aucun module natif ajouté).

## 6. Definition of Done

- [ ] Spec + plan + **maquette** validés (pas de code avant).
- [ ] Migration créée, prévisualisée (`db:push:dry`), **poussée après go**, types régénérés, MIGRATIONS.md coché.
- [ ] `SET_TYPES` étendu (dropset/failure) + schémas Zod (`rpe`, `plannedWeightKg`) + schéma PowerSync.
- [ ] Sélecteur de type par série + raccourci échauffement 1 tap + badges.
- [ ] Saisie adaptée : durée (mm:ss) pour `duration`, charge optionnelle pour `bodyweight`.
- [ ] RPE/série (1-10, optionnel) saisi et affiché (carte + historique) ; distinct du ressenti global 5★.
- [ ] Charge planifiée figée (`planned_weight_kg`) + affichage « Prévu » + écart (=/▲/▼), survit en historique.
- [ ] `records-repository.ts` (read dupliqué) enrichi de `rpe`/`planned_weight_kg` → typecheck OK + historique
      détail affiche type + RPE + écart.
- [ ] Résumé : volume/records (déjà) **et** décompte séries/exercices (modifié) excluent les échauffements.
- [ ] Records : `duration` exclu, `bodyweight` lesté éligible, warmup exclu ; `useLastPerformance` exclut warmup.
- [ ] Tests `shared` (nouveaux types dans volume ; duration exclu des records, bodyweight-lest éligible) verts ;
      typecheck/lint verts ; non-régression C1.
- [ ] i18n FR+EN (parité) ; offline-first ; PR relue par les deux devs.

## 7. Explicitement différé (→ C3)

- **Superset / circuit** : enchaînement de 2 exercices, repos après la paire.
- Réorganiser / « machine prise » (sauter et revenir) / remplacer par variante / note par exercice persistante /
  accès démo en séance / **suggestion de progression** (surcharge progressive §6.5).
