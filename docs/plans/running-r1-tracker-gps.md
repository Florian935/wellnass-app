# Running R1 — Tracker GPS nu — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Livrer le tracker GPS nu en course libre (GPS + chrono + distance/allure temps réel, pause/auto-pause, écran verrouillé Android, mode sans GPS, résumé + enregistrement), sur la couche PowerSync/repository existante.

**Architecture:** Trace GPS stockée comme **colonne encodée append-friendly** sur une ligne `runs` (pas de table de points → 1 ligne/course pour PowerSync). Suivi via `expo-location` (avant-plan + arrière-plan) + `expo-task-manager` + **foreground service Android**. Calculs GPS purs et testables dans `@wellness/shared`. Course en cours = ligne `runs` `status='active'` (survit au kill), trace flushée périodiquement (append).

**Tech Stack:** RN + Expo SDK 57, `expo-location` + `expo-task-manager` (natifs → **nouveau dev build**), PowerSync, Zod (`@wellness/shared`), Vitest + jest-expo.

**Spec :** [running-r1-tracker-gps.md](../specs/technical/running-r1-tracker-gps.md) · **Patterns à copier :** repos muscu (`apps/mobile/src/data/repositories/*`, `_sql.ts`), migrations (`supabase/migrations/`), sync rules **edition 3** ([powersync-sync-rules.yaml](../specs/technical/powersync-sync-rules.yaml)).

**Branche :** `feature/running-r1-tracker` depuis `dev`.

**Périmètre :** R1 uniquement (course libre). PAS de carte (R2), profil coureur/programmes (R3), stats/records/GPX (R4), guidage vocal, météo/terrain.

---

## Rappels de patron
Repository : `*DbRow` + mappers snake↔camel, `useX()` réactif **`isLoading = queryLoading`**, `currentUserId()` (répliqué, file-private), écritures `_sql` (`insertWithSyncFields`/`patch`/`softDelete`) ou `writeTransaction`. Migration : colonnes synchro §3.1, trigger `set_updated_at`, table utilisateur `user_id`. Sync rules : **edition 3 (streams)**, `auth.user_id()`, `auto_subscribe: true`. Aucune chaîne en dur (i18n fr/en). Stockage en m/s ; conversion unités = affichage (mais 1.15 non câblé — hors R1, cf. US de suivi).

## Structure des fichiers
**Shared :** `packages/shared/src/running.ts` (+ `.test.ts`) ; MAJ `index.ts`.
**Backend :** `supabase/migrations/20260707120000_running_runs.sql` (table+RLS+publication) ; MAJ `docs/specs/technical/powersync-sync-rules.yaml` (stream `runs`).
**Mobile data :** MAJ `apps/mobile/src/powersync/schema.ts` (+`runs`) ; `apps/mobile/src/data/repositories/run-repository.ts`.
**Tracking :** `apps/mobile/src/running/tracker.ts` (service task-manager + expo-location), `apps/mobile/src/running/tracker-task.ts` (définition tâche background).
**Config :** `apps/mobile/app.json` (ou `app.config`) — plugin `expo-location` ; `package.json` deps.
**Écrans :** `apps/mobile/src/app/run/index.tsx` (démarrage course libre), `run/active.tsx` (suivi), `run/summary.tsx` (résumé) + `run/_layout.tsx` ; entrée onglet Running (`(tabs)/running.tsx`). i18n.

---

## Phase A — packages/shared (calculs GPS + schéma, TDD)

### Task 1 : Calculs GPS + encodage trace + schéma
**Files:** Create `packages/shared/src/running.ts` (+ `.test.ts`) ; Modify `index.ts`.
- [ ] **Tests rouges** puis impl (fonctions PURES) :
  - `haversineMeters(a, b)` — a/b = `{lat, lng}`. Test : deux points connus → distance attendue (±1 m).
  - `totalDistance(points)` — somme des segments Haversine sur `{lat, lng, t}[]` ; **filtre les points aberrants** (segment impliquant une vitesse > seuil, ex. 12 m/s, ou `accuracy` fournie trop faible) → ignoré. Test : trajet simple, + un point aberrant ignoré.
  - `averagePace(distanceM, durationS)` — s/km ; `distanceM<=0` → null.
  - `instantPace(points, windowS=60)` — allure sur la fenêtre glissante des `windowS` dernières secondes ; null si distance nulle sur la fenêtre.
  - **Encodage append-friendly** : `encodeSegment(points)` (polyline Google encoded + tableau de deltas de temps du segment), `appendToTrack(track, segment)` (concatène), `decodeTrack(track)` → `{lat,lng,t}[]`. Test **round-trip** : `decodeTrack(appendToTrack(appendToTrack('', encodeSegment(seg1)), encodeSegment(seg2)))` ≈ `[...seg1, ...seg2]` (tolérance ~1e-5 sur lat/lng).
  - `RUN_STATUSES`/`RUN_SOURCES` enums + `runRowSchema` (sur `syncFieldsSchema` + status, source, startedAt, finishedAt null, durationSeconds null, distanceM null, avgPaceSPerKm null, gpsTrack null, rpe null, notes null).
- [ ] `npm run test -w @wellness/shared` vert. **Commit** — `feat(shared): calculs GPS running + encodage trace + runRowSchema`

## Phase B — Backend (fichiers ; application = checkpoint humain)

### Task 2 : Migration `runs` + RLS + sync stream
**Files:** Create `supabase/migrations/20260707120000_running_runs.sql` ; Modify `docs/specs/technical/powersync-sync-rules.yaml`.
- [ ] Table `runs` (spec §3) : `id uuid pk, user_id uuid not null references auth.users(id) on delete cascade, status text check in ('active','completed','cancelled'), source text check in ('gps','manual'), started_at timestamptz not null, finished_at timestamptz, duration_seconds integer, distance_m numeric, avg_pace_s_per_km numeric, gps_track text, rpe integer check (rpe between 1 and 10), notes text` + sync cols + trigger `set_updated_at` + index `runs(user_id, status) where deleted_at is null` + `alter publication powersync add table public.runs`. **RLS** table utilisateur (comme `workouts`) : select/insert/update `user_id = auth.uid()`, pas de delete. (Un seul fichier ou deux, au choix.)
- [ ] **Sync rules edition 3** : ajouter le stream `runs` (même patron que les streams user existants) :
  ```yaml
  runs:
    query: SELECT * FROM runs WHERE user_id = auth.user_id() AND deleted_at IS NULL
    auto_subscribe: true
  ```
  > `AND deleted_at IS NULL` **obligatoire** (comme tous les streams user existants) : `cancelRun` fait un soft delete → sans ce filtre, les courses annulées continueraient de se synchroniser.
- [ ] **Commit** — `chore(db): table runs + RLS + stream running (R1)` *(application cloud + déploiement streams = checkpoint humain)*.
  > ⚠️ Timestamp `20260707120000` choisi après les migrations nutrition (`140000-140002`, Damien) — vérifier au moment du commit qu'aucune migration `20260707…` n'a été ajoutée entre-temps ; sinon décaler.

## Phase C — Mobile : couche data

### Task 3 : Schéma PowerSync local (+`runs`)
**Files:** Modify `apps/mobile/src/powersync/schema.ts`
- [ ] Déclarer `runs` (colonnes snake_case = migration ; `distance_m`/`avg_pace_s_per_km` `column.real`, `duration_seconds`/`rpe` `column.integer`, le reste `column.text`). Ne pas toucher aux tables existantes. typecheck. **Commit** — `feat(mobile): schéma local runs (R1)`

### Task 4 : run-repository
**Files:** Create `apps/mobile/src/data/repositories/run-repository.ts`
- [ ] Impl (patron repos muscu) :
  - `useActiveRun()` — la course `status='active'` (trace décodée via `decodeTrack` pour l'écran ; ou exposer la trace brute + laisser l'écran décoder). `isLoading = queryLoading`.
  - `startRun(source: 'gps'|'manual')` — insère `runs` active (garde anti double-course active, comme `startWorkout`). Retourne l'id.
  - `flushTrack(runId, { segmentEncoded, distanceM, durationSeconds })` — `appendToTrack` sur `gps_track` existant (lire la valeur courante puis `patch`), met à jour `distance_m`/`duration_seconds`. **Appelable hors React** (depuis la tâche background). ⚠️ **Sérialiser les flush** : un seul flush en vol à la fois (promesse in-flight unique côté tracker, ou append dans un `writeTransaction` qui relit dans la tx) — évite qu'un flush périodique et un flush de pause lisent le même `gps_track` et s'écrasent.
  - **Source de vérité des scalaires** : le **tracker** est seul responsable de `distance_m`/`duration_seconds` (incrémentaux). `finishRun` ne recalcule PAS la distance depuis toute la trace — il **dérive `avg_pace` des dernières valeurs flushées** (évite un écart avec la distance incrémentale).
  - `pauseRun`/`resumeRun` — gèrent le temps hors pause (le tracker fournit `durationSeconds` net ; le repo persiste l'état).
  - `finishRun(runId, { rpe?, notes?, manualDistanceM? })` — `status='completed'`, `finished_at`, calcule `avg_pace_s_per_km` (depuis distance+durée finales), flush final.
  - `cancelRun(runId)` — `status='cancelled'` + soft delete.
  - `useRunHistory()` — courses complétées (liste basique). 
- [ ] typecheck. **Commit** — `feat(mobile): run-repository (course active = ligne runs)`

## Phase D — Tracking GPS (natif)

### Task 5 : Dépendances + config plugin
**Files:** Modify `apps/mobile/package.json`, `apps/mobile/app.json`
- [ ] `npx expo install expo-location expo-task-manager` (versions SDK 57).
- [ ] Config plugin `expo-location` dans `app.json` : messages de permission (FR par défaut), `isAndroidBackgroundLocationEnabled: true`, `isAndroidForegroundServiceEnabled: true`. Vérifier les permissions Android générées (`ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`).
- [ ] typecheck. **Commit** — `chore(mobile): expo-location + task-manager + config foreground service (R1)`
  > ⚠️ **Nouveau dev build requis** (`npm run build:dev`) — modules natifs. Noté comme checkpoint device.

### Task 6 : Service de tracking
**Files:** Create `apps/mobile/src/running/tracker-task.ts`, `apps/mobile/src/running/tracker.ts`
- [ ] `tracker-task.ts` : `TaskManager.defineTask(RUN_TASK, ...)` — reçoit un **batch** de `locations`, les convertit en `{lat,lng,t}`, et **encode+append immédiatement ce batch** via `flushTrack` (pas d'accumulation d'un buffer inter-invocations). ⚠️ **Contexte JS séparé** : la tâche ne partage pas l'état React ; elle écrit directement via `run-repository.flushTrack` (SQLite PowerSync = singleton module accessible partout).
  - **Décision figée (pas de buffer fragile)** : chaque invocation de la tâche flush son propre batch (`encodeSegment(batch)` → `appendToTrack`). Coût O(batch), et aucun état à faire survivre entre invocations → l'edge « buffer inter-invocations » de la spec §5 est évité par construction. `distanceM`/`durationSeconds` courants sont recalculés incrémentalement (distance += segments du batch ; durée nette gérée par le tracker).
  - Doit être **importée au niveau racine** (ex. dans `_layout.tsx` ou un `import './running/tracker-task'`) pour que la tâche soit enregistrée au chargement JS.
- [ ] `tracker.ts` : API `startTracking(runId, { autoPause })` / `stopTracking()` / `pauseTracking()` / `resumeTracking()` — configure `Location.startLocationUpdatesAsync(RUN_TASK, { accuracy: BestForNavigation, timeInterval, distanceInterval, foregroundService: { notificationTitle, notificationBody } })`. Gère l'**auto-pause** (vitesse < seuil N s) et le calcul incrémental distance/durée (via `@wellness/shared`).
- [ ] typecheck. **Commit** — `feat(mobile): service de tracking GPS (foreground + background + auto-pause)`
  > Runtime non testable ici → validé device (Task 10). Garder le service isolé et découplé de l'UI.

## Phase E — Écrans

### Task 7 : Démarrage + écran de suivi
**Files:** Create `apps/mobile/src/app/run/_layout.tsx`, `run/index.tsx`, `run/active.tsx` ; Modify `(tabs)/running.tsx`, root `_layout.tsx` (registration). 
- [ ] `run/index.tsx` : « Démarrer une course libre » + bascule **mode sans GPS**. `startRun(source)` → `startTracking` (si gps) → navigue vers `run/active`.
- [ ] `run/active.tsx` : lit `useActiveRun` ; affiche **distance en grand**, temps, allure instantanée + moyenne (calculées en mémoire depuis la trace/ticks), indicateur GPS (recherche/actif/perdu), bandeau offline, `keepAwake`. Boutons **pause/reprise/stop**. Stop → `run/summary`.
- [ ] Entrée depuis l'onglet Running. i18n (dont textes permission/notification). typecheck+lint+test. **Commit** — `feat(mobile): écran de suivi de course libre (5.12-5.16, 5.20-5.22)`

### Task 8 : Résumé + enregistrement
**Files:** Create `apps/mobile/src/app/run/summary.tsx`
- [ ] Reçoit le `runId` ; affiche distance / durée / allure moyenne (depuis la ligne `runs` clôturée) + **RPE + note** → `finishRun` déjà appelé au stop (ou appelé ici avec rpe/notes). i18n. typecheck+lint+test. **Commit** — `feat(mobile): résumé de course + enregistrement (5.24-5.26)`
  > **Retenu** : `finishRun` **au stop** (clôture la ligne, calcule `avg_pace`), puis le résumé édite RPE/note via `patch` — ainsi une course n'est jamais perdue si l'utilisateur quitte le résumé (offline-first : la ligne est la source de vérité).

## Phase F — Tests & vérification

### Task 9 : Tests + i18n
- [ ] Compléter i18n fr/en (parité) des écrans run. Tests `@wellness/shared` (déjà en Task 1 ; compléter cas limites GPS). Smoke jest-expo d'un écran run avec `expo-location`/repository mockés. typecheck+lint+test verts. **Commit** — `test(running-r1): tests + i18n`

### Task 10 : Validation terrain *(checkpoint 🔴 humain — le cœur de R1)*
- [ ] **Nouveau dev build** (`npm run build:dev`). Course réelle : **écran verrouillé** (notif persistante + pause/reprise), **arrière-plan** (app minimisée), perte GPS (tunnel), **auto-pause**, **mode avion** (offline) puis retour réseau → sync (1 ligne/course), **reprise après kill**, **batterie** sur 30-45 min. RLS 2 comptes. i18n FR/EN. Consigner les résultats.

## Definition of Done
typecheck+lint+test verts · offline OK · **validation terrain documentée** · i18n FR/EN · aucun secret · CHANGELOG+TODO tenus. **Prérequis** : migrations socle appliquées sur le cloud (US1) ; dev build à jour.

## Points d'attention
- **Dev build obligatoire** (expo-location/task-manager natifs) avant tout test device.
- **Contexte JS séparé** de la tâche background : `flushTrack` doit écrire via le singleton PowerSync (pas via l'état React). Tâche enregistrée au chargement racine.
- **Flush append-only** (Task 4/6) : ne jamais réencoder toute la trace ; `appendToTrack` sur le segment nouveau uniquement.
- **Timestamp migration** : vérifier l'absence de collision `20260707…` avec le travail parallèle de Damien avant commit.
- Le cœur (GPS arrière-plan, écran verrouillé, batterie) **n'est pas testable hors device** — la validation terrain (Task 10) est le vrai juge.
