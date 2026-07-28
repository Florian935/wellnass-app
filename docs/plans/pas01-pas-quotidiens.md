# Plan d'implémentation — US PAS-01 (pas quotidiens, lecture Health Connect)

> Spec : [docs/specs/functional/us/pas01-pas-quotidiens.md](../specs/functional/us/pas01-pas-quotidiens.md).
> Branche : `feature/pas01-pas-quotidiens`. Exécution **par incréments TDD** : brique pure testée →
> intégration → UI. Un commit par tâche ([`/commit`](../../.claude/commands/commit.md)).

**Objectif :** lire le total de pas par jour dans Health Connect, le stocker dans une table
**synchronisée**, l'afficher (widget + historique), permettre de fixer un **objectif quotidien**, et
faire **compter les pas dans le streak** (jour actif = objectif atteint).

**Architecture :** logique pure dans `@wellness/shared` (`steps.ts` + extension de `streak.ts`, Vitest)
· adaptateur natif étendu (`lib/health-connect.ts`, une fonction de plus) · nouvelle table PowerSync
(`daily_steps`) · widget + écran · i18n FR/EN.

**Deux points à ne pas rater, ils cassent en silence :**
1. la **sync rule PowerSync** n'est pas versionnée côté outil → sans déploiement manuel dans le
   dashboard, la table ne descend jamais sur l'appareil et **aucune erreur n'est levée** ;
2. `PERMISSIONS` passe de 3 à 4 entrées → **tous les utilisateurs CONF-06 existants** repassent en
   `permissions_missing`. C'est attendu, mais ça doit être vu en recette **avant** tout le reste
   (tâche 5, critère 1).

## Maquette

**Maquette requise** (nouvel écran + nouveau widget 3 formes) :
`design/pas01-pas-quotidiens/pas01-pas-quotidiens.html`. Elle doit montrer : le widget dans ses 3
formes, l'écran d'historique, le sélecteur d'objectif, et les **5 états** du §2.4 de la spec
(indisponible / opt-in OFF / permission manquante / vide / nominal).

## Fichiers touchés

**Créer**
- `packages/shared/src/steps.ts` + `steps.test.ts`
- `apps/mobile/src/data/repositories/daily-steps-repository.ts`
- `apps/mobile/src/components/widgets/StepsWidget.tsx`
- `apps/mobile/src/app/steps.tsx`
- `supabase/migrations/<horodaté>_pas01_daily_steps.sql`
- `design/pas01-pas-quotidiens/pas01-pas-quotidiens.html`

**Modifier**
- `packages/shared/src/streak.ts` + `streak.test.ts` (`DayActivity.steps`)
- `packages/shared/src/widgets.ts` + `widgets.test.ts` (widget `steps` au registre accueil)
- `packages/shared/src/index.ts` (exports)
- `apps/mobile/src/lib/health-connect.ts` (`PERMISSIONS`, `importSteps`, `importStepsIfDue`, `SyncReport.kind`)
- `apps/mobile/src/powersync/schema.ts` (table `daily_steps`, colonne `profiles.daily_step_goal`)
- `docs/specs/technical/powersync-sync-rules.yaml` (+ **déploiement manuel dans le dashboard**)
- `apps/mobile/src/data/repositories/profile-repository.ts` (objectif de pas)
- `apps/mobile/src/data/repositories/dashboard-repository.ts` (`useStreakData` : 4ᵉ dimension)
- `apps/mobile/src/components/HealthConnectSection.tsx` (bouton d'import + compte rendu `steps`)
- `apps/mobile/src/app/_layout.tsx` (import throttlé au premier plan)
- `apps/mobile/src/app/settings.tsx` (accès au réglage d'objectif si pertinent)
- `apps/mobile/src/i18n/locales/fr.json` + `en.json` (`steps.*`, `settings.healthConnect.*`, `legal.privacy.body`)
- `apps/mobile/app.json` (`android.permissions` : `READ_STEPS`)
- `apps/mobile/src/lib/data-export.ts` (export RGPD : `daily_steps`)
- `docs/specs/technical/health-connect-play-declaration.md` (4ᵉ type, « Sécurité des données », scorie §3.3)
- `supabase/MIGRATIONS.md` (registre)

---

### Tâche 1 — Briques pures `steps.ts` (TDD)

**Fichiers :** créer `packages/shared/src/steps.ts` + `steps.test.ts` ; exporter dans `index.ts`.

- [ ] **Étape 1 — Tests rouges.**
  - `toDailySteps(buckets)` : un bucket `{ startTime: '2026-07-27T00:00:00+02:00', result: { COUNT_TOTAL: 8432 } }`
    → `{ logDate: '2026-07-27', steps: 8432 }` ; **la date vient du `startTime` du bucket** (test avec un
    offset différent du fuseau de la machine — sinon le test ne prouve rien) ; `COUNT_TOTAL: 0` → **ignoré** ;
    total non entier → arrondi ; total > 200 000 → **écarté** ; total négatif → écarté.
  - `mergeDailySteps(remote, local)` : jour absent localement → **à créer** ; jour présent avec une valeur
    **inférieure** → **à mettre à jour** ; jour présent avec une valeur **supérieure ou égale** → **rien**
    (règle du max, décision 7) ; jour local supprimé (`deleted_at` non nul) → traité comme absent.
  - `isGoalReached(steps, goal)` : `>=` (8 000/8 000 = atteint) ; `goal` nul/`NaN`/≤ 0 → repli sur le
    défaut 8 000 (jamais « atteint » par accident).
  - `stepsActiveDays(rows, goal)` → `Set<string>` des jours ayant atteint l'objectif.
  - `shouldImportSteps(lastImportAt, now, throttleHours)` : `null` → `true` ; dans la fenêtre → `false` ;
    au-delà → `true` ; horodatage invalide → `true` (calque de `shouldImportWeight`).
- [ ] **Étape 2 — Vérifier l'échec** (`npm run test`, code de sortie lu **sans pipe**).
- [ ] **Étape 3 — Implémenter**, sans aucune dépendance native ni `Date.now()` interne (l'instant est
  toujours **passé en paramètre**, convention du dépôt).
- [ ] **Étape 4 — Exporter** dans `index.ts` + `DEFAULT_STEP_GOAL = 8000` et `MAX_PLAUSIBLE_STEPS = 200000`.
- [ ] **Étape 5 — Vert**, puis commit : `feat(shared): briques pures des pas quotidiens (US PAS-01, 9.15)`.

### Tâche 2 — Le streak accueille une 4ᵉ dimension (TDD)

**Fichiers :** `packages/shared/src/streak.ts` + `streak.test.ts`, puis `dashboard-repository.ts`.

- [ ] **Étape 1 — Tests rouges** : `DayActivity` gagne `steps: boolean` ; `activeDayKeys()` marque actif
  un jour **`steps: true` seul** (aucun pilier) ; un jour `steps: false` sans pilier reste inactif ;
  **non-régression** : tous les tests existants passent avec `steps: false` ajouté.
- [ ] **Étape 2 — Implémenter** : champ + `strength || running || nutrition || steps`.
- [ ] **Étape 3 — Mettre à jour les appelants.** `useStreakData()` dans `dashboard-repository.ts` est le
  seul (vérifié) : ajouter `steps: false` dans le `touch()` initial. **Le comportement ne change pas
  encore** — le branchement réel des pas arrive en tâche 6, ce qui garde le dépôt vert entre les deux.
- [ ] **Étape 4 — Vert**, commit : `feat(shared): les pas peuvent rendre un jour actif dans le streak (US PAS-01)`.

### Tâche 3 — Migration, schéma PowerSync et sync rule

**Fichiers :** `supabase/migrations/<horodaté>_pas01_daily_steps.sql`, `schema.ts`,
`powersync-sync-rules.yaml`, `MIGRATIONS.md`.

- [ ] **Étape 1 — `npm run db:new pas01_daily_steps`**, puis écrire le SQL :
  - `create table public.daily_steps (id uuid primary key, user_id uuid not null references auth.users (id) on delete cascade, log_date date not null, steps integer not null check (steps >= 0), source text not null default 'health_connect', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz);`
  - `create unique index daily_steps_user_day_uq on public.daily_steps (user_id, log_date) where deleted_at is null;`
  - `create index daily_steps_user_date_idx on public.daily_steps (user_id, log_date desc);`
  - `alter table public.daily_steps enable row level security;` + politiques `select` / `insert` /
    `update` sur `user_id = auth.uid()` (calque de `body_weight_entries` —
    `20260707130001_recipes_bodyweight_rls.sql`). **Pas de politique `delete`** : le dépôt fait du
    soft delete.
  - `alter table public.profiles add column daily_step_goal integer check (daily_step_goal is null or (daily_step_goal between 1000 and 50000));` — `NULL` toléré (comptes antérieurs), coercition à 8 000 côté app (précédent MUSC-F13).
- [ ] **Étape 2 — `npm run db:push:dry`** puis **`npm run db:push`** (cloud, pas de Docker).
- [ ] **Étape 3 — `npm run db:types`** (régénère `packages/shared/src/database.types.ts`).
- [ ] **Étape 4 — Cocher** la migration dans [MIGRATIONS.md](../../supabase/MIGRATIONS.md) avec la date.
- [ ] **Étape 5 — Schéma client PowerSync** (`schema.ts`) : table `daily_steps`
  (`user_id`/`log_date`/`source` en `column.text`, `steps` en `column.integer`, + les 3 champs de
  synchro), ajout à la liste du `Schema`, et **`daily_step_goal: column.integer`** sur `profiles`.
- [ ] **Étape 6 — Sync rule** : ajouter à `powersync-sync-rules.yaml`, bucket `user_data`, section
  « Alimentation / corps » près de `body_weight_entries` :
  `- select * from daily_steps where user_id = bucket.user_id and deleted_at is null`
- [ ] **Étape 7 — ⚠️ Déployer le YAML dans le dashboard PowerSync** (copier-coller + déployer). **Sans
  cette étape manuelle, rien ne descend et rien ne le signale.** Vérifier par une lecture réelle
  (ligne écrite côté cloud → visible sur l'appareil).
- [ ] **Étape 8 — Commit** : `feat(db): table daily_steps + objectif de pas (US PAS-01, 9.15)`.

### Tâche 4 — Repository `daily_steps` + objectif

**Fichiers :** créer `daily-steps-repository.ts` ; modifier `profile-repository.ts`.

- [ ] **Étape 1 — Repository** (patron de `bodyweight-repository.ts`, écritures via
  `insertWithSyncFields` / `patch`, **jamais** de SQL d'écriture direct) :
  - `upsertDailySteps(rows: { logDate, steps }[])` : applique la **règle du max** via
    `mergeDailySteps` (la décision vient de la brique pure, pas du SQL) ;
  - `useTodaySteps()` : `{ steps, goal, reached, isLoading }` ;
  - `useDailySteps(sinceDate)` : historique ordonné, pour l'histogramme ;
  - `getStepsGoal()` : accesseur **hors React** (le service d'import en a besoin), calque de
    `getHealthConnectEnabled()`.
- [ ] **Étape 2 — Objectif** dans `profile-repository.ts` : lecture avec coercition `NULL → 8000`
  (`DEFAULT_STEP_GOAL`) et écriture bornée 1 000–50 000.
- [ ] **Étape 3 — Test** (Jest mobile, patron des tests de repository existants) : upsert d'un jour
  nouveau, upsert d'un jour existant avec valeur plus faible → **pas d'écrasement**, avec valeur plus
  forte → mise à jour.
- [ ] **Étape 4 — Commit** : `feat(mobile): repository des pas quotidiens et objectif (US PAS-01)`.

### Tâche 5 — Permission, lecture Health Connect, câblage — **dev build requis**

**Fichiers :** `app.json`, `lib/health-connect.ts`, `HealthConnectSection.tsx`, `_layout.tsx`.

- [ ] **Étape 1 — `app.json`** : ajouter `android.permission.health.READ_STEPS` à `android.permissions`.
- [ ] **Étape 2 — Adaptateur** :
  - `PERMISSIONS` : 4ᵉ entrée `{ accessType: 'read', recordType: 'Steps' }` ;
  - `SyncReport['kind']` : ajouter `'steps'` ;
  - `STEPS_IMPORT_THROTTLE_HOURS = 1` (distinct du poids : 6 h) + clé de curseur
    `healthConnect.lastStepsImportAt` dans `expo-secure-store` ;
  - `importSteps(days = DEFAULT_WINDOW_DAYS)` : garde `ready()`, appel
    `aggregateGroupByPeriod({ recordType: 'Steps', timeRangeFilter: { operator: 'between', startTime, endTime }, timeRangeSlicer: { period: 'DAYS', length: 1 } })`,
    passage par `toDailySteps` puis `upsertDailySteps`, `report('steps', n, error | null)` — **avec le
    message explicite « aucun pas lu sur N jours »** quand la liste est vide (le silence est
    indiagnosticable en recette, leçon de CONF-06) ;
  - `importStepsIfDue()` : throttle via `shouldImportSteps` ;
  - **incrémenter `SERVICE_REV`** (`r3` → `r4`) : c'est ce qui permet de savoir, en recette, si l'APK
    installé contient bien ce lot.
- [ ] **Étape 3 — Câblage premier plan** : appeler `importStepsIfDue()` là où `importWeightIfDue()` est
  déjà appelé (`_layout` racine), en `void`, indépendamment (l'un ne doit pas empêcher l'autre).
- [ ] **Étape 4 — Section Réglages** : bouton « Importer les pas maintenant », date du dernier import,
  et affichage du compte rendu `steps` en cas d'échec (le composant sait déjà le faire pour les autres
  `kind`).
- [ ] **Étape 5 — `npm run build:dev`** (ou build local Android) : **une permission de manifest ne
  s'ajoute pas à chaud**. Vérifier après `prebuild` que `READ_STEPS` est bien dans
  `android/app/src/main/AndroidManifest.xml`.
- [ ] **Étape 6 — Recette anticipée du cas n°1** (utilisateur CONF-06 déjà autorisé → état
  `permissions_missing`, séances qui partent toujours). À faire **avant** de continuer : si ce
  comportement ne convient pas, il vaut mieux le savoir maintenant.
- [ ] **Étape 7 — Commit** : `feat(health-connect): lecture des pas quotidiens (US PAS-01, 9.15)`.

### Tâche 6 — Le streak lit vraiment les pas

**Fichiers :** `dashboard-repository.ts`.

- [ ] **Étape 1 — Brancher** `useDailySteps(sinceKey)` + l'objectif dans `useStreakData()` :
  `touch(jour).steps = isGoalReached(steps, goal)`.
- [ ] **Étape 2 — Vérifier** que les **pastilles de la semaine** du widget streak s'allument sur un jour
  « objectif atteint » (le contrat visuel ne change pas, seule la source s'élargit).
- [ ] **Étape 3 — Commit** : `feat(mobile): les pas comptent dans la série (US PAS-01)`.

### Tâche 7 — Widget `steps` (3 formes)

**Fichiers :** `packages/shared/src/widgets.ts` + `widgets.test.ts` ; `StepsWidget.tsx` ; rendu du hub accueil.

- [ ] **Étape 1 — Registre (TDD)** : `'steps'` ajouté à `HOME_WIDGET_IDS`, `pillars: 'always'`,
  `defaultSize: 'wide'`. Test : un layout stocké **sans** `steps` se résout **avec** `steps` en fin de
  grille (`resolveScreenLayout` complète les IDs manquants) → **aucune migration de
  `dashboard_layout`**.
- [ ] **Étape 2 — Composant** `StepsWidget` : `small` (anneau + total), `wide` (total + objectif + barre
  + 7 pastilles), `large` (+ histogramme de la semaine). Les **5 états** du §2.4 de la spec, chacun
  avec son texte — jamais un widget vide et muet.
- [ ] **Étape 3 — Accessibilité** : valeur textuelle sur l'anneau et la barre (« 6 200 pas sur 8 000,
  objectif non atteint »).
- [ ] **Étape 4 — Commit** : `feat(mobile): widget des pas quotidiens (US PAS-01, 7.13)`.

### Tâche 8 — Écran d'historique `/steps`

**Fichiers :** `apps/mobile/src/app/steps.tsx`.

- [ ] **Étape 1 — Écran** : histogramme 30 jours (composant de graphique existant → **infobulle UX-01
  acquise**), barres distinguant « objectif atteint » **par motif ou intensité, pas seulement par la
  teinte**, moyenne de la période, meilleur jour, nombre de jours d'objectif atteint.
- [ ] **Étape 2 — Réglage de l'objectif** : sélecteur 1 000–50 000 par pas de 500, cible tactile ≥ 44 px,
  écriture immédiate (offline-first).
- [ ] **Étape 3 — Navigation** : tap sur le widget → cet écran.
- [ ] **Étape 4 — Commit** : `feat(mobile): écran d'historique des pas et objectif quotidien (US PAS-01)`.

### Tâche 9 — i18n, confidentialité, export, purge

**Fichiers :** `fr.json`, `en.json`, `lib/data-export.ts`.

- [ ] **Étape 1 — Clés `steps.*`** (§4 de la spec) + `settings.healthConnect.importSteps` /
  `stepsImported`, FR et EN, **parité stricte**.
- [ ] **Étape 2 — ⚠️ Corriger `settings.healthConnect.subtitle`** : la phrase « **Tout reste sur ton
  téléphone.** » devient **fausse** dès que les pas montent dans le cloud. Nouveau texte : séances et
  poids restent locaux, **les pas sont enregistrés sur le compte** pour suivre d'un appareil à l'autre.
- [ ] **Étape 3 — `legal.privacy.body`** (FR/EN) : les pas comme donnée de santé **collectée et
  conservée** sur nos serveurs, finalité, conservation, suppression avec le compte.
- [ ] **Étape 4 — Export RGPD (CONF-01)** : ajouter `daily_steps` à la liste des tables exportées, et
  vérifier le contenu d'un export réel.
- [ ] **Étape 5 — Purge de compte (CONF-02)** : **vérifier** (ne pas supposer) que la cascade FK
  supprime bien les lignes `daily_steps`.
- [ ] **Étape 6 — Commit** : `feat(i18n): pas quotidiens + mise à jour de la politique de confidentialité (US PAS-01)`.

### Tâche 10 — Documentation Play

**Fichiers :** `docs/specs/technical/health-connect-play-declaration.md`.

- [ ] **Étape 1 — 4ᵉ permission** dans le tableau du §2, avec sa justification (§9 de la spec) ;
  retirer « pas » de la liste « ne pas demander », **garder le sommeil**.
- [ ] **Étape 2 — §4 « Sécurité des données »** : réécrire. CONF-06 déclarait des données de santé
  **non transmises hors de l'appareil** ; avec les pas synchronisés, il faut déclarer **collecte +
  transmission**, chiffrées en transit, finalité « fonctionnalité de l'app », **sans partage tiers**.
- [ ] **Étape 3 — §5** : ajouter `READ_STEPS` à la liste des vérifications post-`prebuild`.
- [ ] **Étape 4 — Corriger la scorie du §3.3** : l'intent-filter y est encore attribué à
  `expo-health-connect`, dépendance **supprimée** par CONF-06 (le §5 du même document est, lui, exact).
- [ ] **Étape 5 — Commit** : `docs(play): déclaration Health Connect étendue aux pas (US PAS-01)`.

---

## Ordre de build et pourquoi

1. **1 → 2** : tout le raisonnable est pur et testé avant de toucher au natif ou à la base. Le dépôt
   reste vert (la 4ᵉ dimension du streak est branchée « à faux » avant d'être alimentée).
2. **3** avant **4** : le repository a besoin de la table et des types générés.
3. **5** tôt malgré le coût du dev build : c'est là qu'est le **risque de recette** (permission plus
   stricte pour les utilisateurs existants). Le découvrir en fin de lot serait le pire moment.
4. **6 → 8** : l'UI en dernier, sur une donnée déjà réelle sur l'appareil.
5. **9 → 10** : les textes et la conformité en clôture, quand le comportement est figé — mais
   **avant** la recette finale, parce que la correction du `subtitle` fait partie de ce qui est recetté.

## Tests prévus

- **Vitest (`packages/shared`)** : `steps.test.ts` (~18 cas : dates/fuseaux, zéros, arrondis, valeurs
  aberrantes, règle du max, objectif, throttle) · `streak.test.ts` étendu (jour actif par les seuls
  pas, non-régression) · `widgets.test.ts` (résolution d'un layout ancien → widget `steps` ajouté).
- **Jest (`apps/mobile`)** : test du repository (upsert / non-écrasement) et smoke-test de l'écran
  `/steps` dans ses états vide et nominal.
- **Manuel obligatoire (device réel)** : les 18 critères du §11 de la spec. Les deux qui ne peuvent pas
  être simulés : le **tapis de marche** (critère 5) et la **double source** téléphone + montre/Google
  Fit (critère 6, celui qui prouve l'absence de double comptage).

## Risques

| Risque | Parade |
|---|---|
| Sync rule non déployée → aucun pas sur l'appareil, **aucune erreur** | Étape explicite (tâche 3, étape 7) + critère de recette 11 (multi-appareils) |
| Utilisateurs CONF-06 renvoyés en « permissions manquantes » | Attendu et documenté ; recetté **en premier** (tâche 5, étape 6) |
| Double comptage des pas si on additionne les records | Interdit par construction : **API d'agrégation** uniquement (décision 5) ; critère de recette 6 |
| Streak trivialement inbrisable | Jour actif = **objectif atteint**, jamais « au moins un pas » (décision 4) |
| Rappel « série en danger » à tort | Limite assumée et documentée (spec §2.5) + reformulation du texte, pas de lecture en arrière-plan |
| Politique de confidentialité devenue fausse | Tâche 9, étapes 2-3 — **dans la Definition of Done**, pas en option |
| Déclaration Play à refaire | Le 4ᵉ type doit partir dans le **même** dossier que CONF-06 (tâche 10 **avant** LANCE-00) |
