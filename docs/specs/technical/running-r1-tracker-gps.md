# Spec technique — Running R1 : tracker GPS nu (course libre)

> **Spec technique** (étape 1 du workflow). Premier incrément du pilier **Running** (V0.5) : le
> **tracker GPS nu** en course libre, à valider sur le terrain avant tout le reste — c'est le
> **risque technique majeur** du projet (GPS arrière-plan, écran verrouillé, batterie).
> Traduit en tables/couche technique la [spec fonctionnelle running](../functional/running.md) et
> applique les conventions [offline-sync.md](./offline-sync.md) / [modele-donnees.md](./modele-donnees.md).
> **Statut : à valider (Damien / Florian) avant tout code.** · Date : 06/07/2026.

---

## 1. Contexte & décision de découpage

V0.5 Running = **33 features** — trop pour une seule spec/US. La roadmap ([ADR-002](../adr/ADR-002-perimetre-v1.md)) impose de **commencer par le tracker GPS nu** (5.12-5.16) et de le **valider sur le terrain** avant le reste, car le GPS en arrière-plan (batterie, écran verrouillé) est le plus gros risque technique.

**Découpage V0.5 (validé 06/07/2026)** :
- **R1 — Tracker GPS nu (course libre)** — *cette spec*. GPS + chrono + distance/allure temps réel (5.12-5.16), pause/auto-pause (5.22/5.16), écran verrouillé Android (5.20), mode sans GPS (5.21), résumé + enregistrement (5.24 partiel/5.25/5.26).
- **R2 — Carte** (5.17/5.27) : tracé en direct + au résumé. **← nécessite de trancher Mapbox vs MapLibre** (décision bloquante encore ouverte).
- **R3 — Profil coureur + programmes** (5.1-5.11, 5.4-5.7) : allure de réf., types de séance, biblio, planning.
- **R4 — Historique, stats, records d'allure, export GPX** (5.28-5.33).

**Hors R1** : carte, profil coureur, programmes, types de séance/guidage vocal (5.18/5.19), stats/records, export GPX, météo/terrain au résumé (ajout léger ultérieur), Live Activity iOS.

## 2. Décisions de cadrage actées (06/07/2026)

- **Trace GPS = colonne encodée sur la ligne `run`** (pas de table de points). PowerSync ne synchronise qu'**1 ligne par course** → évite l'explosion en milliers de lignes, qui est le risque flaggé par [offline-sync.md §7](./offline-sync.md). Downsampling Douglas-Peucker **à l'affichage** (R2), on stocke la trace complète encodée.
- **Profil coureur différé à R3** ; R1 = course libre uniquement (aucune cible d'allure).
- **Décision carte (Mapbox/MapLibre) repoussée à R2** — R1 n'affiche pas de carte.
- **Android d'abord** : écran verrouillé = **service de premier plan + notification persistante** (Live Activity iOS = ultérieur).

## 3. Modèle de données — 1 table `runs`

Table utilisateur (bucket `user_data`), colonnes de synchro §3.1 de [offline-sync.md](./offline-sync.md).

| Colonne (local / Postgres) | Type local | Notes |
|---|---|---|
| `id` | text / uuid | UUID client. |
| `user_id` | text / uuid | Propriétaire (RLS + bucket). |
| `status` | text | `active` / `completed` / `cancelled`. |
| `source` | text | `gps` / `manual` (mode sans GPS 5.21). |
| `started_at` | text / timestamptz | UTC. |
| `finished_at` | text null | Null tant qu'active. |
| `duration_seconds` | integer null | Temps de course **hors pauses** (calculé). |
| `distance_m` | real null | Distance cumulée (Haversine), null en mode manuel sans saisie. |
| `avg_pace_s_per_km` | real null | Allure moyenne (s/km) = duration/distance, **calculée à la clôture** ; **null pendant la course** (l'écran calcule l'allure moyenne live en mémoire, pas depuis la colonne). |
| `gps_track` | text null | **Trace encodée** (polyline Google encoded polyline algorithm, ou JSON compact `[[lat,lng,t],…]`). Null en mode manuel. |
| `rpe` | integer null | Ressenti 1-10 (5.24). |
| `notes` | text null | Note libre (5.24). |
| + `created_at`, `updated_at`, `deleted_at` | text | Conventions §3.1. |

> **Encodage de la trace (format figé — append-friendly)** : **polyline encodée** (Google encoded polyline, précision ~1e-5) pour les coordonnées + **tableau de deltas de temps** parallèle (secondes depuis `started_at`). Les deux sont **concaténables par segment** : un flush **ajoute** l'encodage des nouveaux points sans réencoder toute la trace (voir §5). Fonctions pures `@wellness/shared`, testées : `encodeSegment(points)` (encode un incrément), `appendToTrack(track, segment)`, `decodeTrack(track)`. Métrique/impérial (1.15) = **affichage uniquement** ; stockage toujours en mètres/secondes.

**Migration** : `runs` + trigger `set_updated_at` + index `runs(user_id, status) where deleted_at is null` + `alter publication powersync add table public.runs`. **RLS** (table utilisateur, comme `workouts`) : select/insert/update `user_id = auth.uid()`, pas de delete.

**Sync rules — format edition 3 (Sync Streams)** ⚠️ : l'instance PowerSync est en **edition 3 (streams)**, PAS en ancien `bucket_definitions` (rework Damien 06/07 — l'ancien format n'était pas déployable). Ajouter un **stream** dans [powersync-sync-rules.yaml](powersync-sync-rules.yaml), même patron que les streams « données utilisateur » existants (`auth.user_id()`, `auto_subscribe: true`) :
```yaml
streams:
  runs:
    query: SELECT * FROM runs WHERE user_id = auth.user_id()
    auto_subscribe: true
```

> ⚠️ **Coordination timestamp de migration** : Damien travaille en parallèle sur V0.4 nutrition (migrations `20260706140000/140001`, records `140002`). Choisir un timestamp **nettement postérieur** — proposé `20260707120000_running_runs.sql` — et se synchroniser avec lui pour éviter une collision (cf. incident du 06/07 sur `140000`).

## 4. Suivi GPS (cœur technique)

### 4.1 Acquisition
- **`expo-location`** : permissions `foreground` **et** `background` ; `watchPositionAsync` en avant-plan ; `startLocationUpdatesAsync` + **`expo-task-manager`** (tâche nommée) pour l'arrière-plan.
- **Android — service de premier plan** : option `foregroundService` d'`expo-location` (notification persistante « Course en cours »), indispensable pour le suivi **écran verrouillé** (5.20) et pour ne pas être tué par l'OS. Actions **pause / reprise** sur la notification.
- **Config plugin** (`app.json`/`app.config`) : `expo-location` (messages de permission FR/EN, `isAndroidBackgroundLocationEnabled`, foreground service type `location`). ⚠️ **Nouveau dev build requis** (module natif + permissions).
- Précision : `Accuracy.BestForNavigation` ; intervalle ~1 s / ~5 m (paramétrable ; compromis batterie).

### 4.2 Calculs (fonctions pures — `@wellness/shared`, TDD)
- `haversineMeters(a, b)` : distance entre deux points lat/lng.
- `totalDistance(points)` : somme des segments (filtre les sauts aberrants — accuracy trop faible / vitesse irréaliste).
- `averagePace(distanceM, durationS)` : s/km.
- `instantPace(points, windowS=60)` : allure sur la dernière minute glissante.
- `encodeTrack` / `decodeTrack`.
- Ces fonctions sont **100 % testables sans device** — c'est là que porte la discipline TDD.

### 4.3 Auto-pause (5.16)
- Détection vitesse < seuil pendant N s → pause auto ; reprise auto au redémarrage. Désactivable (réglage running local). Le temps en pause **n'est pas** compté dans `duration_seconds`.

### 4.4 Mode sans GPS (5.21)
- `source='manual'` : chrono seul, `gps_track=null`, `distance_m` saisie manuellement en fin (optionnel). Compte pour l'historique/durée, **exclu des records** (R4).

## 5. Offline-first & survie au kill

- La course en cours = ligne `runs` `status='active'` (comme la séance muscu active).
- Les points GPS **s'accumulent en mémoire** (buffer du tracker) et sont **flushés périodiquement** (~toutes les 30 s ou 200 m) **et** à chaque pause / à la clôture.
- **Flush append-only (coût borné par flush)** : le flush **encode uniquement les nouveaux points** (`encodeSegment`) et les **concatène** à `gps_track` existant (`appendToTrack`) — il ne réencode PAS toute la trace. Le coût d'un flush est donc O(nouveaux points), pas O(trace entière) → **pas de coût quadratique** sur une course longue (2-3 h). Le flush met aussi à jour `distance_m`/`duration_seconds` courants (valeurs scalaires).
  > ⚠️ **Contexte JS séparé (expo-task-manager)** : la tâche de fond s'exécute dans un **contexte JS distinct** de l'app. Le buffer de points et le déclenchement du flush doivent donc être accessibles depuis ce contexte — écrire les points via un mécanisme atteignable par la tâche (ex. `flushTrack` du repository appelé directement depuis la tâche, qui écrit dans le SQLite PowerSync partagé). À traiter explicitement dans le plan (sharp edge connu).
- Tout marche **hors-ligne** ; PowerSync remonte la ligne `runs` (avec trace) au retour du réseau — **1 ligne/course**, écritures bornées par flush, léger.

## 6. Couche d'accès — `run-repository`

Même patron que les repos muscu (`isLoading = queryLoading`, `currentUserId()`, `_sql`/`writeTransaction`, mapping snake↔camel) :
- `useActiveRun()` — la course `status='active'` (+ trace décodée pour l'écran).
- `startRun(source)` — insère `runs` active ; garde anti double-course-active.
- `flushTrack(runId, points, distanceM, durationS)` — met à jour `gps_track`/`distance_m`/`duration_seconds` (appelé périodiquement par le tracker).
- `pauseRun`/`resumeRun` — gèrent l'accumulation du temps hors pause.
- `finishRun(runId, {rpe?, notes?, manualDistanceM?})` — `status='completed'`, `finished_at`, calcule `avg_pace`, flush final.
- `cancelRun(runId)` — `status='cancelled'` + soft delete.
- `useRunHistory()` — courses complétées (liste basique ; l'historique riche = R4).

Le **service de tracking** (expo-location/task-manager) est une unité séparée (`src/running/tracker`) qui pousse les points au repository via `flushTrack` ; l'écran lit `useActiveRun`.

## 7. UI R1

- **Onglet Running** (déjà présent, masquable) → « Démarrer une course libre » (+ bascule mode sans GPS).
- **Écran de suivi** : distance en grand, temps, allure instantanée + moyenne, boutons pause/reprise/stop, indicateur GPS (recherche/actif/perdu), bandeau offline (2.13 déjà existant). `keepAwake` pendant la course (2.3).
- **Résumé** : distance / durée / allure moyenne + RPE + note → « Enregistrer ». (Carte = R2 ; météo/terrain = ultérieur.)
- **i18n FR+EN** (aucune chaîne en dur), y compris les textes de permission et de notification.

## 8. Tests & Definition of Done

- **`packages/shared` (Vitest, TDD)** : `haversineMeters`, `totalDistance` (dont filtrage des points aberrants), `averagePace`, `instantPace`, `encodeTrack`/`decodeTrack` (round-trip), `runRowSchema`.
- **Mobile (jest-expo)** : smoke de l'écran de suivi avec `expo-location`/repository mockés.
- **Device / terrain (checkpoint humain — le cœur de R1)** : dev build → course réelle avec **écran verrouillé**, en **arrière-plan**, tunnel/perte GPS, auto-pause, mode avion (offline) puis sync, **batterie** sur 30-45 min, reprise après kill. RLS 2 comptes. i18n FR/EN.
- **DoD** : typecheck+lint+test verts · offline OK · **validation terrain** documentée · i18n · aucun secret · CHANGELOG+TODO tenus.

## 9. Découpage R1 en tâches (pour le plan)
1. `@wellness/shared` : calculs GPS + `runRowSchema` (+ encode/decode) — TDD.
2. Backend : migration `runs` + RLS + sync rules (fichiers ; timestamp coordonné avec Damien).
3. Schéma PowerSync local (+`runs`).
4. `run-repository`.
5. Dépendances + config : `expo-location` + `expo-task-manager` + config plugin (permissions, foreground service) — **nouveau dev build**.
6. Service de tracking (avant-plan + arrière-plan + foreground service Android + auto-pause).
7. Écran de suivi + démarrage course libre + mode sans GPS.
8. Écran résumé + enregistrement (RPE/note).
9. Tests + i18n.
10. **Validation terrain (device)** — checkpoint humain.

## 10. Points ouverts / à acter
- **Mapbox vs MapLibre** : à trancher avant R2 (pas nécessaire pour R1).
- ~~Format d'encodage de la trace~~ : **figé** (§3) — polyline + deltas de temps, append-friendly.
- **Timestamp de migration** : coordonner avec Damien (parallèle nutrition).
- Seuils auto-pause / intervalle GPS / fréquence de flush : valeurs par défaut dans le plan, ajustées au terrain.
