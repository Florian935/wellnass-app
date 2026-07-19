# US Refonte-C1 — Écran de séance : cœur du flux guidé + garde-fous — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans, tâche par tâche. Étapes en checkbox (`- [ ]`).

**Goal:** Transformer l'écran de séance (liste plate) en **flux guidé** — carte « série en cours » + liste repliée, saisie rapide (steppers, pré-remplissage, dernière perf), validation = log + repos + avance, repos plein écran, keep-awake, garde-fous (✕ Continuer/Pause/Abandonner, garde 0 série), résumé éditable (ressenti 5★ + note).

**Architecture:** `workout.tsx` refondu autour d'un état « exercice/série courant » calculé depuis les `workout_sets` groupés (modèle inchangé, tout est `normal` — les types de séries = C2). Plomberie repository ajoutée (session_id sur la séance active, repos du plan, dernière perf, feedback résumé). Nouveau composant `RestOverlay`. **Aucune migration** (réutilise `workouts.rpe` 1-5 + `notes`).

**Tech Stack:** `apps/mobile` (Expo Router, PowerSync `useQuery`, i18next). `Vibration` de `react-native` (core, **pas** expo-haptics → pas de rebuild) ; `useKeepAwake` de `expo-keep-awake` (déjà utilisé par `run/active.tsx`).

**Spec :** [refonte-muscu-c1-seance-live-coeur.md](../specs/functional/us/refonte-muscu-c1-seance-live-coeur.md) (validée). **Analyse :** [analyse-seance-en-cours.md](../refonte-muscu/analyse-seance-en-cours.md).

**Branche :** `feature/refonte-muscu-c1` (spec commitée `7267ba5`).

> **Invariants :**
> - **Offline-first** : écritures optimistes locales (`updateSet`/`patch`), lecture réactive `useQuery`. Aucune migration, aucun checkpoint cloud.
> - **i18n** parité FR/EN, aucune chaîne en dur.
> - **Périmètre C1 strict** : tout `set_type` reste `normal` (types de séries = C2) ; pas de RPE/série, pas de charge planifiée/réalisée, pas de réorg/superset/remplacer/démo/suggestion (C2/C3).
> - **Pas de nouvelle dépendance native** (Vibration core + keep-awake déjà présent) → pas de rebuild.
> - À chaque commit : `npm run typecheck` + `npm run lint -w @wellness/mobile` + `npm run test` verts. Ne jamais stager `apps/mobile/eas.json`. Tests mobile jest-expo non câblés → vérif typecheck/lint + relecture.

---

## Task 1 : Plomberie repository (workout-repository.ts)

**Files:** Modify `apps/mobile/src/data/repositories/workout-repository.ts`. **Lis le fichier d'abord.**

- [ ] **Étape 1 — `session_id` sur la séance active.** Étendre `SELECT_ACTIVE_WORKOUT` pour sélectionner
  `session_id`, ajouter `session_id: string | null` au type de ligne brute **`WorkoutDbRow`** (partagé avec
  `SELECT_HISTORY`/`rowToHistoryItem` → l'ajouter aussi à `SELECT_HISTORY`, ou le typer optionnel ; l'historique
  ne le lit pas → sans effet), et ajouter `sessionId: string | null` au type `ActiveWorkout` (+ mapping dans la
  construction de l'objet). Sert à retrouver le plan (repos prévu par exercice).
- [ ] **Étape 2 — repos prévu par exercice (hook).** Ajouter `useSessionRest(sessionId: string | null)` →
  `Record<exerciseId, number>` (secondes), depuis `exercise_plans` de la séance (0 ligne si `sessionId` nul) :
```sql
SELECT exercise_id, rest_seconds FROM exercise_plans
WHERE session_id = ? AND deleted_at IS NULL AND rest_seconds IS NOT NULL
```
  (appel `useQuery` inconditionnel ; `sessionId ?? ''` → 0 ligne). Défaut applicatif **90 s** géré côté UI si
  l'exercice n'a pas d'entrée.
- [ ] **Étape 3 — dernière perf par exercice (hook).** Ajouter `useLastPerformance(exerciseId: string)` →
  `{ weightKg: number | null; reps: number | null }[] | null` : les séries **validées** de l'exercice dans la
  **dernière séance terminée** qui le contient, triées par `order_index` :
```sql
SELECT s.weight_kg, s.reps FROM workout_sets s
JOIN workouts w ON w.id = s.workout_id AND w.status = 'completed' AND w.deleted_at IS NULL
WHERE s.exercise_id = ? AND s.deleted_at IS NULL AND s.done = 1
  AND w.id = (
    SELECT w2.id FROM workouts w2
    JOIN workout_sets s2 ON s2.workout_id = w2.id AND s2.exercise_id = ? AND s2.deleted_at IS NULL AND s2.done = 1
    WHERE w2.status = 'completed' AND w2.deleted_at IS NULL
    ORDER BY w2.finished_at DESC LIMIT 1
  )
ORDER BY s.order_index
```
  Retourne `null`/tableau vide si jamais fait. (Le formatage « 80 kg × 8/8/7 » est fait côté UI.)
- [ ] **Étape 4 — feedback résumé.** Ajouter `setWorkoutFeedback(id: string, input: { rpe?: number | null;
  notes?: string | null }): Promise<void>` → `patch('workouts', id, { … })` (ne mappe que les clés fournies).
  Évite d'importer `_sql`/`patch` dans l'écran de résumé.
- [ ] **Étape 5 — vérifier** `npm run typecheck` + `npm run lint -w @wellness/mobile`.
- [ ] **Étape 6 — commit** `feat(mobile): plomberie seance C1 (sessionId, repos plan, derniere perf, feedback)`.

---

## Task 2 : i18n — libellés du flux guidé (FR/EN)

**Files:** Modify `apps/mobile/src/i18n/locales/fr.json` + `en.json` (bloc `workout` ~L37 ; sous-bloc `workout.summary`).

- [ ] **Étape 1** — ajouter au bloc `workout` (FR, + EN parité) :
  - `"setProgress": "Série {{current}}/{{total}}"`
  - `"lastTime": "La dernière fois : {{perf}}"`
  - `"validateSet": "Valider la série"`
  - `"restTitle": "Repos"`, `"restExtend": "+15 s"`, `"restRemaining": "{{seconds}} s"`
  - `"sessionDone": "Séance terminée ?"`, `"sessionDoneHint": "Toutes tes séries sont validées."`
  - `"leave": { "title": "Quitter la séance ?", "continue": "Continuer", "pause": "Mettre en pause", "abandon": "Abandonner", "abandonConfirmTitle": "Abandonner la séance ?", "abandonConfirmMessage": "La séance et ses séries seront supprimées.", "abandonConfirm": "Abandonner" }`
  - `"finishNoSetsTitle": "Aucune série validée"`, `"finishNoSetsMessage": "Terminer quand même ?"`, `"finishAnyway": "Terminer"`
- [ ] **Étape 2** — ajouter au sous-bloc `workout.summary` : `"feeling": "Ressenti"`, `"note": "Note de séance"`,
  `"notePlaceholder": "Sensation, contexte, remarques…"`.
- [ ] **Étape 3** — **retirer la clé morte** `workout.rest` (« Repos {{seconds}} s », remplacée par
  `restTitle`/`restRemaining`) une fois l'ancienne barre de repos supprimée (Task 4) — vérifier grep = 0 avant retrait.
- [ ] **Étape 4** — parité FR/EN (script `node` comparant les clés aplaties → 0 écart) ; `npm run typecheck`.
- [ ] **Étape 5 — commit** `i18n(mobile): libelles flux guide de seance (C1)`.

---

## Task 3 : composant `RestOverlay`

**Files:** Create `apps/mobile/src/components/workout/RestOverlay.tsx`.

- [ ] **Étape 1** — composant présentational + minuterie :
```tsx
type Props = {
  secondsLeft: number;      // décrémenté par le parent (source de vérité = restEndsAt)
  onSkip: () => void;
  onExtend: () => void;     // +15 s
};
```
  Rendu plein écran/overlay dominant : grand compte à rebours (`workout.restRemaining`), titre `workout.restTitle`,
  boutons `workout.skipRest` (Passer) et `workout.restExtend` (+15 s). Style design system (bordeaux muscu,
  `useTheme`). **La vibration en fin est déclenchée par le parent** (le composant reste sans effet de bord)
  OU exposer `onElapsed` — au choix de l'implémenteur, mais garder la logique de minuterie dans `workout.tsx`.
- [ ] **Étape 2 — vérifier** `npm run typecheck` + `npm run lint -w @wellness/mobile`.
- [ ] **Étape 3 — commit** `feat(mobile): composant RestOverlay (repos plein ecran + prolonger)`.

---

## Task 4 : refonte de `workout.tsx` (flux guidé + garde-fous) — **gros morceau**

**Files:** Modify `apps/mobile/src/app/workout.tsx`. Possible extraction : `components/workout/CurrentSetCard.tsx`,
`components/workout/ExerciseList.tsx` (recommandé pour garder des fichiers focalisés). **Lis `workout.tsx` en entier d'abord.**

- [ ] **Étape 1 — imports & keep-awake** : ajouter `import { useKeepAwake } from 'expo-keep-awake';` + `useKeepAwake();`
  dans le composant. Ajouter **`Alert`** et **`Vibration`** à l'import `react-native` (absents aujourd'hui).
  Vérifier que la route `workout` a bien `gestureEnabled: false` dans `app/_layout.tsx` (déjà le cas) pour que le
  dialogue ✕/Pause ne soit pas contournable par le swipe-back.
- [ ] **Étape 2 — état de flux** : calculer, depuis `active.entries` (déjà groupés par exercice, triés), l'**index
  exercice courant** et l'**index série courante** = première série `done === false` (ordre d'apparition). État
  local additionnel : `restEndsAt: number | null`, `restLeft: number`, override repos `Record<exerciseId, number>`
  (session), et `focusOverride` (quand l'utilisateur saute à un exercice via la liste).
- [ ] **Étape 3 — carte focus `CurrentSetCard`** : nom exercice, `workout.setProgress` (N/M), ligne
  `workout.lastTime` via `useLastPerformance(exerciseId)` (formatage « 80 kg × 8/8/7 » : regrouper poids identique
  sinon lister ; masquer si null), champs **reps** + **charge** avec **steppers − / +** (incrément 2,5 kg via
  `useUnits`, saisie clavier possible), bouton `workout.validateSet`.
  ⚠️ **Valeur initiale des champs = règle de pré-remplissage (spec §2.2)** : la valeur affichée pour la série
  courante = **valeur stockée de la série si non nulle** (`set.weightKg` seedé depuis la cible du plan par US-A ;
  `addSet` hérite de la série précédente) **sinon la dernière perf** de même rang (`useLastPerformance`[rangSérie])
  **sinon vide**. Concrètement, `reps` étant laissé `null` par le seed du plan, il se **pré-remplit depuis la
  dernière perf**. La valeur **résolue affichée** est celle qui sera enregistrée à la validation (Étape 4).
- [ ] **Étape 4 — validation** : `onValidate` = `updateSet(setId, { reps, weightKg, done: true })` → démarre le
  repos (durée = override[exId] ?? `useSessionRest`[exId] ?? 90) via `restEndsAt = Date.now()+d*1000` → l'avance
  du focus est **naturelle** (la prochaine série `done=false` devient courante au prochain rendu). Dé-valider
  depuis la liste : `updateSet(setId,{done:false})` **sans** toucher au repos.
- [ ] **Étape 5 — `RestOverlay`** : afficher quand `restEndsAt !== null` ; tick chaque seconde (déjà un pattern
  dans le fichier) ; à `secondsLeft <= 0` → `Vibration.vibrate()` (import `Vibration` de `react-native`) +
  `restEndsAt = null`. `onSkip` → `restEndsAt = null` ; `onExtend` → `restEndsAt += 15000`. Édition de la durée
  par exercice : tap sur la durée (sur la carte) → ajuste `override[exId]` (steppers/preset).
- [ ] **Étape 6 — liste repliée `ExerciseList`** : un rang par entrée (`exerciseName`, « k/M ✓ » = séries done /
  total), tap → `focusOverride = exerciseId` (le focus bascule sur sa 1ʳᵉ série non validée). Exercice tout validé = ✓.
- [ ] **Étape 7 — état de fin** : si **toutes** les séries de tous les exercices sont `done`, la carte focus
  affiche `workout.sessionDone` + `workout.sessionDoneHint` (incite à Terminer). « Ajouter un exercice » et
  « Terminer » restent disponibles.
- [ ] **Étape 8 — dialogue ✕** : `onClose` → `Alert.alert(workout.leave.title, undefined, [Continuer, Pause, Abandonner])`.
  Continuer = rien. Pause = `router.replace('/(tabs)')` **sans** mutation (séance reste `active`). Abandonner →
  2ᵉ `Alert` (`leave.abandonConfirm*`) → `cancelWorkout(workoutId)` + `router.replace('/(tabs)')`.
- [ ] **Étape 9 — Terminer** : si **aucune** série `done` → `Alert` `finishNoSets*` (Terminer / Annuler) ; sinon
  (ou après confirmation) → `finishWorkout(workoutId)` + `evaluateWorkoutRecords` (best-effort, déjà en place) →
  `router.replace({ pathname:'/workout-summary', params:{ id: workoutId } })`. (Le ressenti/note sont saisis sur
  le résumé — Task 5.)
- [ ] **Étape 10 — « Ajouter un exercice »** : inchangé (`router.push('/exercises')`).
- [ ] **Étape 11 — vérifier** `npm run typecheck` + `npm run lint -w @wellness/mobile`. Vérifier à la lecture :
  plus de suppression en un tap (dialogue), keep-awake monté, focus/validation/avance cohérents.
- [ ] **Étape 12 — commit** `feat(mobile): refonte ecran de seance en flux guide + garde-fous (C1)`.

---

## Task 5 : résumé éditable (ressenti 5★ + note)

**Files:** Modify `apps/mobile/src/app/workout-summary.tsx`. Éventuel `components/StarRating.tsx` si absent.

- [ ] **Étape 1** — ajouter sous la carte de stats : un sélecteur **5 étoiles** (valeur = `workout.rpe` borné 1-5)
  + un champ **note** (`workout.notes`), pré-remplis depuis la séance (`useWorkoutHistory().find(id)` porte déjà
  `rpe`/`notes`). Libellés `workout.summary.feeling` / `note` / `notePlaceholder`.
- [ ] **Étape 2** — écritures via `setWorkoutFeedback(id, { rpe })` au tap d'une étoile et `setWorkoutFeedback(id,
  { notes })` sur la note (débounce léger). **Ne pas** importer `_sql`.
- [ ] **Étape 3 — vérifier** `npm run typecheck` + `npm run lint -w @wellness/mobile`.
- [ ] **Étape 4 — commit** `feat(mobile): resume de seance editable (ressenti 5 etoiles + note)`.

---

## Task 6 : contrôle final + revue

- [ ] `npm run typecheck` + `npm run lint` + `npm run test` verts.
- [ ] Grep : aucune chaîne en dur ajoutée ; parité i18n FR/EN à 0 écart ; pas d'import d'`expo-haptics`.
- [ ] Revue de code globale (`superpowers:requesting-code-review` / `/code-review`) sur `git diff dev...HEAD`.
- [ ] MAJ `TODO.md` (C1 `[~]`, cocher à la recette) + `CHANGELOG.md` (commit final). Pas de Statut roadmap (refonte).

## Ordre & dépendances
```
Task 1 (repo) ─┐
Task 2 (i18n) ─┼─→ Task 4 (workout.tsx) ─→ Task 6
Task 3 (RestOverlay) ─┘        Task 5 (résumé) ─→ Task 6
```
Task 4 dépend de 1 (hooks) + 2 (clés) + 3 (RestOverlay). Task 5 dépend de 1 (setWorkoutFeedback) + 2 (clés).

## Definition of Done (rappel spec §6)
- [ ] Carte focus (série en cours + dernière perf + steppers) + liste repliée (aperçu/saut) + état de fin.
- [ ] Valider = log + repos + avance ; dé-valider sans relancer le repos.
- [ ] Repos plein écran (plan/90 s) + vibration (RN core) + Passer/Prolonger + éditable/exo (session).
- [ ] Keep-awake actif ; ✕ → Continuer/Pause/Abandonner (2ᵉ confirmation) ; plus de suppression en un tap.
- [ ] Terminer + garde 0 série ; résumé éditable (ressenti 5★ + note via `setWorkoutFeedback`).
- [ ] Aucune migration ; i18n FR/EN parité ; typecheck/lint/tests verts ; non-régression (démarrage US-A/B).
- [ ] Maquette validée + PR relue par les deux devs.
