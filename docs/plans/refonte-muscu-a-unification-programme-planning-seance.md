# US Refonte-A — Unifier programme → planning → séance — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour implémenter ce plan tâche par tâche. Les étapes utilisent la syntaxe checkbox (`- [ ]`).

**Goal:** Relier programme, planning et séance : fusionner « activer »/« planifier » en un seul geste, démarrer une vraie séance **depuis le calendrier**, et faire basculer l'occurrence planifiée en « faite » quand la séance liée se termine.

**Architecture:** Ajoute une colonne `planned_session_id` (nullable) sur `workouts` (lien explicite occurrence ↔ séance). `startWorkoutFromSession` la renseigne ; `finishWorkout` marque l'occurrence liée `done` (best-effort). L'écran planning gagne une action **Démarrer** (gatée pilier muscu) ; la fiche programme fusionne ses deux boutons en un seul « Démarrer ce programme / Modifier la planification » ; l'assistant gère le **changement de programme** (popup retirer/garder les occurrences futures de l'ancien).

**Tech Stack:** `apps/mobile` (Expo Router SDK 57, PowerSync SQLite local, i18next FR/EN), Supabase (migration CLI sans Docker). Fichiers pivots : `workout-repository.ts`, `planned-session-repository.ts`, `planning/index.tsx`, `planning/plan.tsx`, `programs/[id].tsx`, `powersync/schema.ts`, `i18n/locales/{fr,en}.json`, `supabase/migrations/`.

**Spec :** [refonte-muscu-a-unification-programme-planning-seance.md](../specs/functional/us/refonte-muscu-a-unification-programme-planning-seance.md) (validée Florian + revue Approved). **Audit :** [audit-flux.md](../refonte-muscu/audit-flux.md) (problèmes 1 + 2).

**Branche :** `feature/refonte-muscu-a` (déjà créée, spec commitée `c867a9d`).

**Option §7 retenue par défaut : (b)** — lien de complétion **muscu** dans cette US ; « Démarrer » **masqué** sur les occurrences running (pas de câblage tracker running ici).

> **Invariants :**
> - **Offline-first** : toute écriture reste optimiste locale (SQLite) ; `planned_session_id` nullable = rétrocompatible.
> - **i18n** : aucune chaîne en dur ; parité FR/EN à chaque ajout de clé.
> - **Non-régression running** : le planning est partagé ; « Démarrer » ne doit s'afficher que pour `pillar === 'strength'`. Les occurrences running gardent uniquement les actions secondaires.
> - **Migration = checkpoint 🔴 cloud** : pousser (`db:push`) + `db:types` **avant** toute recette device synchronisée.
> - À chaque commit : `npm run typecheck` + `npm run lint -w @wellness/mobile` + `npm run test` verts. **Ne jamais stager `apps/mobile/eas.json`.**
> - Tests mobile (jest-expo) non câblés dans le repo : la vérification repose sur typecheck/lint, un **grep de contrôle** et la **recette device** (pas de tests unitaires de repository). Toute logique **pure** extractible va dans `@wellness/shared` avec un test Vitest.

---

## Phase A — Données : lien explicite occurrence ↔ séance

### Task 1 : Migration `planned_session_id` sur `workouts` + schéma PowerSync

**Files:**
- Create: `supabase/migrations/<horodaté>_workouts_planned_session_link.sql` (via `npm run db:new`)
- Modify: `apps/mobile/src/powersync/schema.ts` (table `workouts`, ~L163-176)
- Modify: `supabase/MIGRATIONS.md` (nouvelle ligne)
- Modify: `packages/shared/src/database.types.ts` (régénéré, ne pas éditer à la main)

- [ ] **Étape 1 : générer le fichier de migration**

Run: `npm run db:new workouts_planned_session_link`
Puis écrire dans le fichier créé :

```sql
-- US Refonte-A — lien explicite entre une séance (workouts) et l'occurrence planifiée
-- qu'elle réalise (planned_sessions.id). Nullable : séance libre / ad hoc = pas de lien.
-- Sync rule PowerSync = "select * from workouts" => la colonne descend au client sans modif.
alter table public.workouts
  add column if not exists planned_session_id text;
```

- [ ] **Étape 2 : prévisualiser**

Run: `npm run db:push:dry`
Expected: la nouvelle migration listée comme « à pousser ».

- [ ] **Étape 3 : pousser sur le cloud (🔴 checkpoint)**

Run: `npm run db:push`
Expected: migration appliquée, une transaction OK.

- [ ] **Étape 4 : régénérer les types**

Run: `npm run db:types`
Expected: `planned_session_id: string | null` apparaît sur `workouts` dans `database.types.ts`.

- [ ] **Étape 5 : ajouter la colonne au schéma PowerSync local**

Dans `apps/mobile/src/powersync/schema.ts`, table `workouts`, ajouter `planned_session_id: column.text` (après `program_id`) :

```ts
const workouts = new Table({
  user_id: column.text,
  session_id: column.text,
  program_id: column.text,
  planned_session_id: column.text, // US Refonte-A : occurrence planifiée réalisée (nullable)
  status: column.text,
  // …inchangé
});
```

- [ ] **Étape 6 : cocher le registre**

Dans `supabase/MIGRATIONS.md`, ajouter la ligne `[x] … _workouts_planned_session_link | <date> | CLI (npm run db:push)`.

- [ ] **Étape 7 : vérifier**

Run: `npm run typecheck`
Expected: PASS (schéma + types alignés).

- [ ] **Étape 8 : commit**

```bash
git add supabase/migrations/*_workouts_planned_session_link.sql supabase/MIGRATIONS.md apps/mobile/src/powersync/schema.ts packages/shared/src/database.types.ts
git commit -m "feat(mobile): colonne planned_session_id sur workouts (lien occurrence <-> seance)"
```

---

## Phase B — Repository workout : pose et résolution du lien

### Task 2 : `startWorkoutFromSession` accepte et stocke `plannedSessionId`

**Files:** Modify `apps/mobile/src/data/repositories/workout-repository.ts` (`startWorkoutFromSession`, ~L381-455 ; `startWorkout` ~L313-337). READ le fichier entier d'abord.

- [ ] **Étape 1 : étendre la signature**

`startWorkoutFromSession(sessionId: string, opts?: { plannedSessionId?: string }): Promise<string>`.

- [ ] **Étape 2 : stocker le lien à l'insertion**

Dans le `txInsert(tx, 'workouts', { … })`, ajouter `planned_session_id: opts?.plannedSessionId ?? null`.
⚠️ **Garde inchangée** : si une séance `status='active'` existe déjà, on retourne son id **avant** la transaction — le `plannedSessionId` n'est donc **pas** appliqué (documenté ; la reprise est gérée côté UI, Task 5). Ajouter/mettre à jour le commentaire JSDoc en ce sens.

- [ ] **Étape 3 : `startWorkout` (séance libre) reste explicitement nul**

Dans l'insert de `startWorkout`, ajouter `planned_session_id: null` (clarté ; séance libre non liée).

- [ ] **Étape 4 : vérifier**

Run: `npm run typecheck && npm run lint -w @wellness/mobile`
Expected: PASS.

- [ ] **Étape 5 : commit**

```bash
git add apps/mobile/src/data/repositories/workout-repository.ts
git commit -m "feat(mobile): startWorkoutFromSession lie la seance a l'occurrence planifiee"
```

### Task 3 : `finishWorkout` marque l'occurrence liée `done` (best-effort)

**Files:** Modify `apps/mobile/src/data/repositories/workout-repository.ts` (`finishWorkout`, ~L479-508).

- [ ] **Étape 1 : lire `planned_session_id` avec `started_at`**

Étendre le SELECT initial :

```ts
const row = await powerSync.getOptional<{ started_at: string; planned_session_id: string | null }>(
  `SELECT started_at, planned_session_id FROM workouts WHERE id = ?`,
  [id],
);
```

- [ ] **Étape 2 : après le `patch('workouts', …)`, basculer l'occurrence (best-effort)**

À la fin de `finishWorkout`, si `row?.planned_session_id` est renseigné, marquer l'occurrence `done`. **Ne jamais bloquer** la clôture du workout si ça échoue :

```ts
if (row?.planned_session_id) {
  try {
    await patch('planned_sessions', row.planned_session_id, {
      status: 'done',
      completed_at: nowUtc(),
    });
  } catch (error) {
    console.warn("Échec du marquage de l'occurrence planifiée (ignoré, best-effort) :", error);
  }
}
```

- [ ] **Étape 3 : `cancelWorkout` inchangé** — vérifier qu'il **ne touche pas** l'occurrence (l'occurrence reste `planned` sur abandon). Aucun changement de code attendu ; juste confirmer.

- [ ] **Étape 4 : vérifier**

Run: `npm run typecheck && npm run lint -w @wellness/mobile`
Expected: PASS.

- [ ] **Étape 5 : commit**

```bash
git add apps/mobile/src/data/repositories/workout-repository.ts
git commit -m "feat(mobile): finishWorkout marque l'occurrence planifiee liee comme faite"
```

---

## Phase C — Repository planning : changement de programme

### Task 4 : `planProgram` gère le retrait des occurrences futures de l'ancien programme

**Files:** Modify `apps/mobile/src/data/repositories/planned-session-repository.ts` (`planProgram`, ~L310-399).

**Contexte :** `planProgram` désactive déjà les autres programmes actifs du même pilier (étape 6) mais **laisse leurs occurrences** dans le calendrier — c'est le résidu que le popup adresse.

- [ ] **Étape 1 : étendre la signature**

`planProgram(programId, rawInput, opts?: { removePreviousFuture?: boolean }): Promise<number>`.

- [ ] **Étape 2 : dans la transaction, avant l'activation (étape 6), retirer les futures de l'ancien si demandé**

Quand `opts?.removePreviousFuture === true`, soft-delete les occurrences **`planned` de date ≥ aujourd'hui** des **autres** programmes actifs du **même pilier** (l'historique `done`/`skipped` et les occurrences passées sont conservés) :

```ts
if (opts?.removePreviousFuture) {
  const today = localDayKey(new Date());
  await tx.execute(
    `UPDATE planned_sessions SET deleted_at = ?, updated_at = ?
     WHERE owner_id = ? AND status = 'planned' AND scheduled_date >= ?
       AND deleted_at IS NULL
       AND program_id IN (
         SELECT id FROM programs
         WHERE owner_id = ? AND pillar = ? AND is_active = 1 AND id <> ? AND deleted_at IS NULL
       )`,
    [now, now, ownerId, today, ownerId, target.pillar, programId],
  );
}
```

⚠️ `target.pillar` est lu à l'étape 6 ; déplacer la lecture du programme **avant** ce bloc si nécessaire (garder une seule lecture). `localDayKey` est déjà importé.

- [ ] **Étape 3 : vérifier**

Run: `npm run typecheck && npm run lint -w @wellness/mobile`
Expected: PASS.

- [ ] **Étape 4 : commit**

```bash
git add apps/mobile/src/data/repositories/planned-session-repository.ts
git commit -m "feat(mobile): planProgram peut retirer les occurrences futures de l'ancien programme"
```

---

## Phase D — UI : démarrer depuis le calendrier

### Task 5 : `planning/index.tsx` — action « Démarrer » (gatée muscu) + reprise

**Files:** Modify `apps/mobile/src/app/planning/index.tsx` (modal d'actions, ~L252-291).

- [ ] **Étape 1 : imports** — ajouter `useRouter` (expo-router), `startWorkoutFromSession` et `useActiveWorkout` (workout-repository).

- [ ] **Étape 2 : hooks** — dans le composant : `const router = useRouter();` et `const { workout: active } = useActiveWorkout();`.

- [ ] **Étape 3 : handler de démarrage** — avec garde de reprise :

```ts
const onStartSelected = async () => {
  if (!selected) return;
  // Reprise : une seule séance active à la fois.
  if (active) {
    closeSheet();
    router.push('/workout');
    return;
  }
  const sessionId = selected.sessionId;
  const plannedSessionId = selected.id;
  closeSheet();
  try {
    await startWorkoutFromSession(sessionId, { plannedSessionId });
    router.push('/workout');
  } catch {
    // Écriture offline-first optimiste : échec improbable.
  }
};
```

- [ ] **Étape 4 : rendu conditionnel du bouton principal** — dans le `Modal`, afficher « Démarrer » **uniquement** si `selected.pillar === 'strength'` **et** `selected.status === 'planned'`. Placer en **tête** du sheet (action principale), avant « Marquer fait » :

```tsx
{selected?.pillar === 'strength' && selected?.status === 'planned' ? (
  <Button
    label={active ? t('workout.resume') : t('planning.start')}
    onPress={() => void onStartSelected()}
  />
) : null}
```

- [ ] **Étape 5 : renommer l'action « Marquer fait »** en secondaire « Marquer fait sans détailler » (clé `planning.markDoneQuick`), variant `ghost`. Conserver Reporter/Sauter tels quels.

- [ ] **Étape 6 : vérifier** — occurrence running : pas de bouton « Démarrer » ; occurrence muscu `done`/`skipped` : pas de bouton « Démarrer ».

Run: `npm run typecheck && npm run lint -w @wellness/mobile`
Expected: PASS.

- [ ] **Étape 7 : commit**

```bash
git add apps/mobile/src/app/planning/index.tsx
git commit -m "feat(mobile): demarrer une seance muscu depuis le calendrier (+ reprise)"
```

---

## Phase E — UI : fusion activer/planifier

### Task 6 : fusion « Démarrer ce programme » sur les **deux** fiches programme (muscu + running)

**Files:**
- Modify `apps/mobile/src/app/programs/[id].tsx` (bloc actions, ~L216-263 ; imports)
- Modify `apps/mobile/src/app/running-programs/[id].tsx` (fiche running **quasi identique** : boutons Activer/Planifier ~L187-205, import + appel `activateProgram` ~L52 ; réutilise les **mêmes** clés `programs.detail.*`)

⚠️ **Les deux fiches doivent être converties dans la même tâche** (spec §1 : fusion « muscu + running ») : elles partagent les clés `programs.detail.alreadyActive`/`activating`/`activate`. Ne convertir qu'une seule laisserait l'autre avec des clés que Task 8 retire → clés brutes affichées (régression) et grep de contrôle ≠ 0.

- [ ] **Étape 1 (muscu, `programs/[id].tsx`)** : retirer `activateProgram` de l'import ; supprimer `onActivate` + l'état `activating`. Remplacer le bloc bouton actif/activer **+ le ghost « Planifier »** par **un seul** bouton principal :

```tsx
<Button
  label={detail.isActive ? t('programs.detail.editPlanning') : t('programs.detail.startProgram')}
  onPress={onPlan}
/>
```

(`onPlan` route déjà vers `/planning/plan?id=…` — inchangé.) Conserver `edit`/`duplicate`/`delete` et la carte de séance **ad hoc** (`SessionCard` → `onStartSession`, `planned_session_id` nul).

- [ ] **Étape 2 (running, `running-programs/[id].tsx`)** : appliquer **la même** transformation — retirer `activateProgram` (import + appel ~L52) et l'état associé ; remplacer les deux boutons par le bouton unique ci-dessus. `onPlan` de cette fiche route déjà vers `/planning/plan?id=…` et le popup Task 7 est **pilier-agnostique** (`detail.pillar`) → fonctionne tel quel. Conserver le reste de la fiche.

- [ ] **Étape 3 : vérifier**

Run: `npm run typecheck && npm run lint -w @wellness/mobile`
Expected: PASS ; plus aucun appel à `activateProgram` dans les deux fiches.

- [ ] **Étape 4 : commit**

```bash
git add apps/mobile/src/app/programs/[id].tsx apps/mobile/src/app/running-programs/[id].tsx
git commit -m "feat(mobile): fusionne activer/planifier en 'Demarrer ce programme' (muscu + running)"
```

### Task 7 : `planning/plan.tsx` — popup de changement de programme

**Files:** Modify `apps/mobile/src/app/planning/plan.tsx` (`onPlan`, ~L96-113). READ le fichier d'abord.

- [ ] **Étape 1 : détecter un autre programme actif du même pilier** — utiliser le hook **`useActiveProgram(pillar)`** (program-repository, retourne `{ program, isLoading }` ; **`useActivePrograms` au pluriel n'existe pas**). ⚠️ **Ordre des hooks** : l'appeler **avant** le early-return `if (!detail)`, quand `detail` peut être `null` (chargement) → passer `detail?.pillar ?? 'strength'` pour garder un ordre d'appel stable. Puis : `const hasOtherActive = !!activeProgram && activeProgram.id !== programId;`.

- [ ] **Étape 2 : au clic de planification**, si un autre programme actif existe, ouvrir un `Alert` à 3 choix (utiliser `planning.switchProgram.*`) :
  - « Retirer les séances à venir » → `planProgram(programId, input, { removePreviousFuture: true })`
  - « Les garder » → `planProgram(programId, input, { removePreviousFuture: false })`
  - « Annuler »

  Sinon (aucun autre actif) → `planProgram(programId, input)` directement (comportement actuel).

```ts
const doPlan = async (removePreviousFuture: boolean) => {
  setPlanning(true);
  try {
    await planProgram(programId, {
      startDate: weekStart, durationWeeks: parsedDuration, dayAssignments,
    }, { removePreviousFuture });
    router.replace('/planning');
  } catch {
    Alert.alert(t('planning.planErrorTitle'), t('planning.planErrorMessage'));
    setPlanning(false);
  }
};

const onPlan = () => {
  if (!canPlan) return;
  if (hasOtherActive) {
    Alert.alert(t('planning.switchProgram.title'), t('planning.switchProgram.message'), [
      { text: t('planning.switchProgram.remove'), onPress: () => void doPlan(true) },
      { text: t('planning.switchProgram.keep'), onPress: () => void doPlan(false) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  } else {
    void doPlan(false);
  }
};
```

- [ ] **Étape 3 : vérifier**

Run: `npm run typecheck && npm run lint -w @wellness/mobile`
Expected: PASS.

- [ ] **Étape 4 : commit**

```bash
git add apps/mobile/src/app/planning/plan.tsx
git commit -m "feat(mobile): popup de changement de programme (retirer/garder les futures)"
```

---

## Phase F — i18n

### Task 8 : clés FR + EN (parité)

**Files:** Modify `apps/mobile/src/i18n/locales/fr.json` et `en.json`.

- [ ] **Étape 1 : bloc `planning`** — ajouter :
  - `"start": "Démarrer la séance"` (EN: `"Start session"`)
  - `"markDoneQuick": "Marquer fait sans détailler"` (EN: `"Mark done without logging"`)
  - `"switchProgram": { "title": "Changer de programme", "message": "Ton programme actif a des séances à venir. Les retirer du calendrier ou les garder ?", "remove": "Retirer les séances à venir", "keep": "Les garder" }`
    (EN: `"Switch program"`, `"Your active program has upcoming sessions. Remove them from the calendar or keep them?"`, `"Remove upcoming sessions"`, `"Keep them"`)
  - Conserver `markDone` si encore utilisé ailleurs ; sinon le retirer (grep).
- [ ] **Étape 2 : bloc `programs.detail`** — ajouter `"startProgram": "Démarrer ce programme"` (EN `"Start this program"`), `"editPlanning": "Modifier la planification"` (EN `"Edit schedule"`). Les deux fiches (muscu + running) étant converties en Task 6, les clés `activate`/`activating`/`alreadyActive` deviennent orphelines : **les retirer** — mais **une clé seulement si son grep est à 0** (voir Étape 3 ; attention à un éventuel bloc i18n distinct côté running qui redéfinirait `activate`).
- [ ] **Étape 3 : contrôle** — Grep dans `apps/mobile/src` de `detail.activate`, `detail.activating`, `detail.alreadyActive` → **0 occurrence de code** (hors définition i18n) avant de supprimer chaque clé correspondante. Vérifier **parité FR/EN** (mêmes clés des deux côtés). Ne retirer une clé du JSON que si plus aucun `t('…')` ne la référence.

- [ ] **Étape 4 : vérifier**

Run: `npm run typecheck && npm run lint -w @wellness/mobile && npm run test`
Expected: PASS.

- [ ] **Étape 5 : commit**

```bash
git add apps/mobile/src/i18n/locales/fr.json apps/mobile/src/i18n/locales/en.json
git commit -m "i18n(mobile): libelles US-A (demarrer programme/seance, changement de programme)"
```

---

## Phase G — Vérification & clôture

### Task 9 : contrôle final + suivi

- [ ] **Étape 1 : suite complète** — `npm run typecheck && npm run lint && npm run test` → tout vert.
- [ ] **Étape 2 : grep de non-régression** — aucune référence à `activateProgram` dans les écrans (`apps/mobile/src/app`, **muscu ET running**), aucune clé i18n orpheline (`detail.activate`/`activating`/`alreadyActive`).
- [ ] **Étape 3 : revue de code** — `superpowers:requesting-code-review` sur le diff complet de la branche.
- [ ] **Étape 4 : mettre à jour** `TODO.md` (US-A `[~]` → à cocher `[x]` seulement après recette) + `CHANGELOG.md` (via `/commit` sur le commit final) ; **roadmap** : pas de ligne dédiée (refonte), mais ajuster le Statut des items concernés si la livraison les complète (à évaluer).
- [ ] **Étape 5 : maquette** — produire la maquette (design) des 2 surfaces modifiées (menu d'action du calendrier + fiche programme fusionnée) dans `design/refonte-muscu-a/`, **avant** la validation finale (rappel workflow : design validé avant merge).

### Definition of Done (rappel spec §6)
- [ ] Fusion : un seul bouton « Démarrer ce programme » / « Modifier la planification » ; plus de bouton « Activer » isolé ; `activateProgram` retiré de l'UI.
- [ ] Démarrer une séance **depuis le calendrier** (occurrence `planned`, muscu) → workout pré-rempli lié.
- [ ] Complétion : séance liée terminée → occurrence `done` + `completed_at` ; abandon → reste `planned` ; libre/ad hoc → aucune occurrence touchée.
- [ ] Actions secondaires (Reporter/Sauter/Marquer fait sans détailler) conservées ; « Démarrer » masqué si non `planned` **et** sur occurrences running.
- [ ] Popup de changement de programme (retirer/garder) ; historique conservé.
- [ ] Migration `planned_session_id` poussée cloud + `db:types` + schéma PowerSync + MIGRATIONS.md coché.
- [ ] i18n FR+EN (parité) ; offline-first ; typecheck/lint/tests verts ; non-régression running/muscu/nutrition.
- [ ] Maquette validée + PR relue par les deux devs.

---

## Ordre & dépendances

```
Task 1 (migration+schéma)
  └─ Task 2 (start lie l'occurrence)  ── Task 3 (finish marque done)
  └─ Task 4 (planProgram retrait futures)
Task 5 (planning: Démarrer)  → dépend de Task 2
Task 6 (fiche programme fusion) → Task 7 (popup) dépend de Task 4
Task 8 (i18n) → référencée par Tasks 5/6/7 (peut être faite juste avant ou en parallèle des libellés)
Task 9 (clôture)
```

**Note pratique :** faire **Task 8 (i18n)** tôt (ou au fil de l'eau) évite des libellés manquants pendant les Tasks 5-7 ; le plan la place en Phase F par lisibilité, mais les clés peuvent être ajoutées juste avant leur premier usage.
