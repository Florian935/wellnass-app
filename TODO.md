# TODO — Wellness App

Suivi **vivant** des tâches. On y ajoute les US au fur et à mesure qu'elles entrent dans le
pipeline ; la commande [`/commit`](.claude/commands/commit.md) coche ce qui vient d'être livré.

- Légende : `[ ]` à faire · `[~]` en cours · `[x]` fait
- Le **backlog complet** (179 US, V0.1 → V1.1) vit dans
  [docs/roadmap/roadmap.md](docs/roadmap/roadmap.md) — ne pas le recopier ici, seulement
  remonter les US actives.
- Rappel workflow (voir [CLAUDE.md](CLAUDE.md)) : **spec → plan → design → validation → code**.
  Chaque US = une branche (`feature/…`, `fix/…`, `chore/…`).

*Dernière mise à jour : 11/07/2026 (Running R3a profil coureur : code livré et revu → reste checkpoint 🔴 cloud+device)*

---

## 🔴🔴 URGENT — DAMIEN, À TRAITER EN PREMIER (setup build à deux)

> **Contexte (07/07/2026)** : Florian est **bloqué pour builder l'app** (EAS). Le projet Expo est
> sous ton **compte perso `damdamdeoh`** (`projectId 4d24d343-…`), non partageable avec un autre
> compte perso → `eas build` / `eas init` renvoient « Entity not authorized » pour `florian935`.
> En dépannage, Florian build via un **`app.json` local modifié** (`owner`/`projectId` à lui) qu'il
> **ne doit pas committer** — c'est un contournement, pas la solution.

- [x] **Créer une Organisation Expo** (expo.dev) et y **transférer/héberger** le projet `wellness-app`. — org `wellness-appl`, projet transféré (07/07/2026).
- [x] **Inviter `florian935`** (`florian.martin63000@gmail.com`) comme membre (Developer/Admin).
- [x] Mettre `apps/mobile/app.json` → `"owner": "wellness-appl"` (au lieu de `damdamdeoh`). —
  **mergé dans `dev`** (PR #28, 07/07/2026). `extra.eas.projectId` + `updates.url` inchangés/cohérents.
  Transfert confirmé serveur (`eas project:info` → `@wellness-appl/wellness-app`, même projectId).
- [ ] Confirmer à Florian que `npm run build:preview` / `build:dev` passent sous son compte, puis
  qu'il **restaure** son `app.json` (`git checkout apps/mobile/app.json`).
- [x] **Config env des builds autonomes** — ✅ **fait (07/07/2026)** : les 3 `EXPO_PUBLIC_*`
  (`SUPABASE_URL` / `_ANON_KEY` / `POWERSYNC_URL`) déclarées via **EAS Environment Variables**
  (`eas env:push` depuis `apps/mobile/.env`) pour **preview + production** (visibility PUBLIC ;
  vraies valeurs vérifiées via `eas env:list --format long`). _Contexte :_ `eas.json` n'a aucun bloc
  `env` → sinon les builds `preview`/`production` (JS compilé sur EAS cloud) sortaient **sans** ces
  variables → **crash au démarrage** (`supabase.ts` lève à l'import ; les dev builds marchaient car
  Metro injecte le `.env` local).
- [ ] **Coordination migrations** : se mettre d'accord sur les **plages de timestamps** de migration
  (collisions évitées de justesse le 06-07/07 : nutrition `140000-140002`, running `20260707120000`).
  → convention à écrire (ex. par pilier/personne).
- [ ] Retirer la bannière ⚠️🔴 en tête de [CLAUDE.md](CLAUDE.md) une fois ce point réglé.

**Ensuite seulement**, reprendre le reste (activation cloud ci-dessous, V0.4, etc.).

---

## 🟠 Activation cloud — ✅ FAITE (09/07/2026), reste la vérif device

> **Cloud activé (09/07/2026)** : toutes les migrations sont appliquées sur Supabase, la publication
> `powersync` est en place et les **sync rules sont déployées** sur PowerSync. ⚠️ **Format réel =
> `bucket_definitions`** (et **non** « edition 3 » comme l'écrivaient les anciennes entrées TODO /
> CHANGELOG) : les Sync Streams `auto_subscribe` ne délivraient aucune donnée au client → revert
> documenté en tête de [powersync-sync-rules.yaml](docs/specs/technical/powersync-sync-rules.yaml).
> Il **reste la vérif device** (accès Damien + téléphone) pour chaque pilier + la validation terrain running.

- [x] **Migrations Supabase cloud appliquées** — les 14 migrations (socle + muscu US1/US2/US3, nutrition,
  food, recettes/poids, running `runs`, `nutrition_meals`) sont sur le cloud ; publication `powersync`
  en place (gérée via `alter publication … add table` dans les migrations).
- [x] **Sync rules déployées** — format `bucket_definitions`, 2 buckets (`user_data` / `shared_content`),
  toutes les tables — depuis [powersync-sync-rules.yaml](docs/specs/technical/powersync-sync-rules.yaml).
- [x] **`database.types.ts` régénéré depuis le cloud** (09/07/2026, `supabase gen types --project-id …`) —
  inclut la colonne `meals` ; typecheck vert sur les 3 workspaces.
- [x] **Seed** (16 exercices bilingues + 50 aliments) appliqué au cloud (chore db, 06/07/2026).
- [ ] **Vérif device US1 (Task 22)** : écriture/lecture mode avion, sync montante, sync descendante,
  **RLS sur 2 appareils**, i18n FR/EN.
- [ ] **Relecture a posteriori par Damien** — le merge US1 a court-circuité la relecture à deux
  (zones sync/sécurité) sur décision explicite de Florian ; à repasser.
- [ ] **Vérif device US2** : créer/dupliquer/activer un programme, démarrer une séance depuis un programme.
- [ ] **Vérif device US3** — **nouveau dev build requis** (`npm run build:dev`, `react-native-svg` natif) :
  record détecté à la clôture + mis en avant au résumé, historique liste/détail, courbes qui s'affichent, volume/groupe.
- [ ] **Running R1** — **nouveau dev build requis** (`expo-location`/`task-manager` natifs + fix permission
  `RECEIVE_BOOT_COMPLETED`), **VALIDATION TERRAIN** (Task 10, le cœur de R1) : course réelle écran verrouillé
  + arrière-plan, perte GPS, auto-pause, mode avion→sync (1 ligne/course), **reprise après kill**, batterie
  30-45 min, RLS 2 comptes, i18n. Caveats à vérifier : relance process Android, seuils auto-pause, notif foreground service.
  - [x] **Fix crash au lancement d'une course** (`fix/location-receive-boot-completed`, 09/07/2026) :
    ajout de la permission `RECEIVE_BOOT_COMPLETED` (manquait → `expo-location`/`task-manager`
    plantait à la 1ʳᵉ position GPS en programmant un job persistant). Diagnostic via `adb logcat`
    sur l'APK preview (Pixel 6a). **Nécessite un nouveau build** pour valider (l'APK actuel plante).

---

## 🚧 En cours

- [x] **Session persistante & chiffrée** (1.5/9.8) — SecureStore/Keystore — mergé, **testé sur device** (persistance OK après fermeture) (05/07/2026)
- [x] **PowerSync** (9.13/9.3) — SQLite local (op-sqlite) + connecteur Supabase + sync streams — mergé, **« Synchronisé » vert sur device** (05/07/2026)
- [x] **Légal + consentement + âge 16+** (1.21) — CGU/confidentialité (brouillon) + contrôle d'âge — mergé, testé device (05/07/2026)
- [x] **🏷️ Tag v0.1.0** — fin de version V0.1 (05/07/2026)
- [x] **V0.2 — Onboarding skippable** (1.7-1.11) — parcours 5 étapes + store profil — mergé, testé device (05/07/2026)
- [x] **V0.2 — Profil persistant & éditable** (1.12) — persistance SecureStore + profil éditable + accueil perso + relance onboarding — mergé, testé device (05/07/2026)
- [x] **V0.2 — Séance libre (muscu)** — bibliothèque/recherche/favoris/perso (3.13-3.16), séance libre + validation + chrono repos + édition séries (3.23/3.25/3.28/3.30/3.31), résumé (3.35) — mergé (PR #13), testé device (06/07/2026). ⚠️ stores persistés **local Zustand** (dette data adressée par le cadrage ci-dessous).
- [x] **Cadrage — Schéma de données socle & muscu (PowerSync)** — spec [schema-donnees-muscu.md](docs/specs/technical/schema-donnees-muscu.md) + plan [us1-socle-data-muscu.md](docs/plans/us1-socle-data-muscu.md), tous deux revus et **validés**. Découpé en 3 US. (06/07/2026)
- [x] **US1 — Socle data (bascule PowerSync)** — **code mergé dans `dev`** (`248e2b2`, 06/07/2026) : `packages/shared` (schémas Zod + logique, 127 tests), 4 repositories, schéma PowerSync local, migrations+RLS+seed+sync rules, bascule de tous les écrans + gate offline, jest-expo, suppression des stores Zustand (dette soldée). typecheck/lint/test verts, 2 revues + fix offline-first. **Activation cloud + vérif device = section 🔴 en haut.**
- [x] **US2 — Programmes muscu** — **mergée dans `dev`** (`cdf0032`, 06/07/2026) : schémas shared, migrations+RLS+seed+sync rules, `program-repository`, écrans biblio/création/détail/activation + démarrer depuis programme (3.1-3.6, 3.12, 3.24). Revues repo + finale GO. Activation cloud + device = section 🔴. (Planning/progression/notifs → US2b.)
- [x] **US3 — Historique & records** — **mergée dans `dev`** (06/07/2026) : logique records shared (Epley, +39 tests), table `personal_records`+RLS+sync rules, `records-repository` (détection à la clôture), graphes (`react-native-svg`+gifted-charts), écrans historique + progression + records au résumé (3.22/3.38/3.21/3.39/3.40). Revues repo + finale GO. Activation cloud + **dev build svg** + device = section 🔴. (Notif record 3.42 → V0.8.)
- [~] **V0.4 — US4.1 Profil nutritionnel & TDEE** (`feature/4.1-profil-nutritionnel-repo`, 1.10/4.1-4.7) — objectif nutritionnel, facteur d'activité (5 niveaux), TDEE Mifflin-St Jeor, objectif calorique (auto + surcharge manuelle), macros par défaut/manuelles (%↔g), restrictions/allergènes. Calculs purs + `nutritionProfileRowSchema` dans `@wellness/shared` (+28 tests), **table `nutrition_profiles`** (schéma PowerSync + migrations 140000/140001 + RLS + sync rules), `nutrition-repository` (`useQuery`/upsert), écrans + FR/EN. typecheck/lint/test verts. Spec : [us/4.1-profil-nutritionnel.md](docs/specs/functional/us/4.1-profil-nutritionnel.md). **Reste** : activation cloud (migrations+sync rules) + vérif device (section 🔴). (4.7 câblage planning muscu = ultérieur.) _(mergée en parallèle par Damien)_
- [~] **V0.4 — US4.8 Base d'aliments & journal** (`feature/4.8-aliments-journal`, 4.8/4.9/4.11-4.14/4.16/4.17/4.19-4.23) — 50 aliments bilingues (seed), recherche + OpenFoodFacts + favoris + aliment perso, journal 4 repas (nav jours, totaux + barres macros temps réel, quick add, portions). `food.ts` (+16 tests), 4 tables PowerSync + migrations `150000/150001` + RLS + sync rules + seed, `food-repository`/`journal-repository`/`lib/openfoodfacts`, écrans + FR/EN. typecheck/lint/test verts. Spec : [us/4.8-aliments-journal.md](docs/specs/functional/us/4.8-aliments-journal.md). **Reste** : activation cloud (migrations+seed+sync rules) + vérif device. **Différé** : renommer/ajouter repas (4.15), copier (4.18), recettes (4.24-4.26), poids & stats (1.13/1.14/4.30-4.32), notif (2.5).
- [x] **V0.4 — US4.10 Scan code-barres** (`feature/4.10-scan-code-barres`) — scan EAN/UPC via `expo-camera` → recherche d'abord le code-barres **en local** (évite un doublon d'import), sinon **OpenFoodFacts par code-barres** → panneau quantité (composant `QuantityPanel` extrait, partagé avec le picker) → ajout au journal. Gère la permission caméra + l'état « introuvable » (rescan / créer un aliment), FR/EN. `fetchOpenFoodFactsByBarcode` (`lib/openfoodfacts`) + `findFoodByBarcode` (`food-repository`) + écran `food-scan`. typecheck/lint/test verts. **Reste** : nouveau **dev build** (`expo-camera` natif) + vérif device.
- [~] **V0.4 — US4.24 Recettes, repas types, poids & stats** (`feature/4.24-recettes-poids-stats`, 4.24-4.26/1.13/4.30/4.31) — recettes (ingrédients + portions + valeurs par portion), repas types (enregistrer/réappliquer), poids corporel (pesée/jour + tendance + courbe 4 sem/3 mois/1 an), apports moyens 7/30 j + courbe. `recipe.ts`/`bodyweight.ts` (+tests), 5 tables PowerSync + migrations `130000/130001` + RLS + sync rules, repos + écrans (`recipe-edit`, `nutrition-stats`, food-picker étendu). typecheck/lint/test verts. Spec : [us/4.24-recettes-poids-stats.md](docs/specs/functional/us/4.24-recettes-poids-stats.md). **Reste** : activation cloud + vérif device. **Différé** : 4.32 stat croisée, rappels (natif), planning (V1.1).
- [x] **V0.6 — US7.4–7.7 Dashboard live (MVP)** (`feature/7.4-7.7-dashboard-live`) — l'accueil placeholder devient un **dashboard branché sur les données locales réelles**, réactif (`useQuery`). Logique `computeStreak` + `localDayKey` (shared, purs, testés) ; hooks `dashboard-repository` (`useNextSession`/`useStreakData`/`useNutritionSummary`) ; 4 widgets (Séance du jour, Résumé nutrition, Régularité/streak, Poids) + `DashboardCard` extrait ; i18n `home.*` FR/EN ; suppression du « arrive bientôt ». Démarrage via `startWorkoutFromSession`. Spec + plan + **maquette** validés (Florian), exécution subagent-driven (revues par phase + revue finale *Approved*), smoke test streak. typecheck/lint/tests verts (362 shared + 29 mobile), parité i18n 535/535, 0 doublon de clé. **Décisions MVP H1–H4** (pas de planning hebdo, jour nutrition = ≥1 repas, pas de repos-neutre, widget Poids si pilier nutrition). **100 % client, sans activation cloud.** **Validé device (11/07/2026)** : 4 widgets branchés sur données réelles, temps réel OK, FR/EN, bascule d'unités widget Poids OK. Différé : personnalisation (7.1-7.3/7.11/7.12), widgets 7.8-7.10.
- [x] **V0.4 — US4.33 Micronutriments (socle)** (`feature/4.33-micronutriments`) — enrichit la base d'aliments et le journal d'un **panel de 10 micronutriments** (cholestérol, sodium+sel dérivé, magnésium, potassium, calcium, fer, vitamines C/D/B9/B12) stocké en **colonne JSON `micronutrients`** (pour 100 g sur `foods`, **snapshot** figé pour la quantité sur `food_entries`). `food.ts` (+18 tests : schéma strict, `parseMicronutrients` tolérant, `scaleMicronutrients`/`sumMicronutrients`/`saltFromSodiumMg`), migration `20260711140000` (jsonb default `{}`, additif/rétrocompatible), mapping **OpenFoodFacts** avec normalisation d'unité (`mapOffMicronutrients`, +3 tests), repos food/journal, composant **`MicronutrientDetails`** (accordéon « Valeurs détaillées », sel dérivé, état vide) dans `QuantityPanel` + bloc facultatif dans l'aliment perso, i18n FR/EN (520/520). Spec/plan/maquette (Claude Design) inclus. typecheck/lint/test verts. **Activation cloud faite** (migration + re-seed + `database.types.ts` régénéré, 11/07). **Vérif device faite** (Pixel, adb) : affichage enrichi + mise à l'échelle (banane 120 g : Mg 27→32, K 358→430, Fe 0,3, sel dérivé 0,00 g), **seuls les nutriments présents** affichés (D/B12 masqués), **snapshot** journal, **état vide** (Sucre), écran aliment perso (bloc facultatif). **Unité OFF confirmée** (11/07, `api/v2` Nutella : `sodium_100g` 0,0428 g → 42,8 mg, recoupé au sel 0,107 g) : le `×1000`/`×1e6` (g→mg/µg) est juste ; sodium 0 → omis. NB : la **recherche texte OFF** (`search.pl`) renvoie 503 côté OFF (panne d'infra) → app dégrade en « Aucun résultat » ; le **scan** (`api/v2`) est le chemin fiable. **Reste** : (b) EN à l'écran (pas de toggle in-app, suit la locale système — parité 520/520 OK) ; (c) offline/sync 2 appareils. **Points d'attention** : seed enrichi de **7 aliments** seulement (compléter d'après l'export CIQUAL réel, ne pas inventer). **Différé** : agrégat micros du jour, objectifs/RDA, micros recettes/repas types, panel étendu.
- [x] **Session test device + correctifs (07/07/2026)** — app lancée sur **Pixel 6a** (USB) et passe de
  tests. Correctifs mergés dans `dev` : **résolution `@wellness/shared` sous Windows/Metro** (junction npm →
  `resolver.extraNodeModules`, PR #24) · **sync du journal** (`order_index: Date.now()` dépassait l'`integer`
  Postgres → `MAX(order_index)+1`, PR #25) · **bouton « Enregistrer »** qui wrappait (PR #26) · **nom d'app**
  dans les permissions localisation (SparkWine → Wellness, PR #29). Journal nutrition **vérifié device**
  (ajout aliment + upload sync OK). Constat : le **dashboard d'accueil est un placeholder statique** (3 cartes
  non branchées) → spec US « Dashboard live » V0.6 rédigée
  ([us/7.4-7.7-dashboard-live.md](docs/specs/functional/us/7.4-7.7-dashboard-live.md)) → **implémentée le 11/07/2026** (voir entrée US7.4–7.7 ci-dessus ; la spec a été reprise à jour sur une branche depuis `dev`, l'ancienne PR #27 étant obsolète).
- [x] **US 1.15 transverse — Affichage & saisie des unités (métrique/impérial)** — **livrée & validée device (11/07/2026)** : câbler
  `useSettings().units` sur **tout l'affichage ET toute la saisie** des grandeurs (poids charges +
  corporel, distance, allure, taille), stockage toujours SI. Dette pré-existante (`displayWeight`
  existait mais n'était lu nulle part → tout s'affichait en kg/km).
  - [x] **Spec** ([us/1.15-unites-metrique-imperial.md](docs/specs/functional/us/1.15-unites-metrique-imperial.md)) — commit `c2c0e84`, revue *Approved*.
  - [x] **Plan** ([1.15-unites-metrique-imperial.md](docs/plans/1.15-unites-metrique-imperial.md)) — 14 tâches TDD, revue *Approved*.
  - [x] **Design/maquette** — écartée (option 2 : changement d'UI mineur), validé Florian 09/07/2026.
  - [x] **Code** — 16 commits (`0d1df62`→`379a7cc`), subagent-driven : shared (ft/in, allure, parseurs) + hook `useUnits()` + smoke test + branchement de tous les écrans/composants (affichage + saisie) + i18n FR/EN (miroir) + anti-dérive. Garde-fou grep vert, typecheck/lint/test verts (343 shared + 23 mobile), parité FR/EN 495/495. Revues par phase + revue finale (1 bloquant corrigé : collision clé `workout.set`).
  - [x] **Recette device (11/07/2026)** — build preview `87de89b5`, testé Pixel 6a : bascule metric↔imperial (Réglages → Unités) OK sur les surfaces §1, taille en ft/in OK, saisie round-trip OK.
  - _Décision produit actée : unités = **réglage in-app**, défaut **métrique**, **non dérivées de la région OS** (découplage confirmé). Le changement de région du téléphone n'influe volontairement pas ; l'utilisateur choisit dans Réglages._
  - _US 100 % client : validée sans activation cloud (pas de checkpoint 🔴)._

### V0.5 — Running (spec [running-r1-tracker-gps.md](docs/specs/technical/running-r1-tracker-gps.md), découpage R1-R4)
- [x] **Running R1 — Tracker GPS nu (course libre)** — **mergé dans `dev`** (06/07/2026) : calculs GPS shared (+45 tests) + encodage trace append-friendly, table `runs`+RLS+stream, `run-repository` (flush sérialisé), tracking `expo-location`+task-manager+foreground service, écrans démarrage/suivi/résumé (5.12-5.16, 5.20-5.22, 5.24-5.26). Revues repo + finale GO. **Activation cloud + dev build + VALIDATION TERRAIN = section 🔴.**
- [x] **Running R2 — Carte** (5.17/5.27) — **livrée & validée device (11/07/2026)** (`feature/running-r2-carte`, MapLibre + MapTiler, [ADR-006](docs/adr/ADR-006-cartographie.md)). `simplifyTrack` (Douglas-Peucker, shared, testé) + `RouteMap` réutilisable (live `follow` / résumé fit-bounds) + `RunDetail.gpsTrack` + branchement `active`/`summary` + i18n FR/EN. Cadrage complet (spec→plan→maquette), revues par phase + finale. Clé MapTiler en EAS env (preview+prod, hors git). **Validé sur Pixel** : carte live tracé+caméra, résumé fit-bounds, tuiles outdoor, états vides. Différé : tuiles offline, sélecteur de style, export GPX (R4).
- [~] **Running R3 — Profil coureur + programmes** (5.1-5.11) — **découpé en R3a/R3b/R3c** :
  - [~] **R3a — Profil coureur + types de séance** (5.1, 5.8-5.11) — **code livré & revu** (`feature/running-r3a-profil-types`). `running-paces` (VMA dérivée + plages d'allure, testé) + parse allure M:SS ; table **`running_profiles`** (migration `20260712090000` + RLS + sync rules + schéma PowerSync) ; `running-profile-repository` ; écran profil + « Mes allures » + route + entrée Réglages ; i18n FR/EN. Cadrage complet, revues par phase + finale (*Approved*). typecheck/lint/tests verts. **Reste 🔴 (avec Damien)** : confirmer le timestamp de migration, **appliquer la migration cloud + déployer sync rules + `npm run db:types`**, puis **vérif device**. _Récup +90-120 : plafond d'affichage à confirmer produit._
  - [ ] **R3b — Programmes de course** (5.4 custom, 5.2 bibliothèque, 5.3 filtres).
  - [ ] **R3c — Planning + coordination muscu/running + séance manquée** (5.5, 5.6, 5.7).
- [ ] **Running R4 — Historique, stats, records d'allure, export GPX** (5.28-5.33).

---

## ⏭️ À faire prochainement (avant / début V0.1)

### Décisions bloquantes à trancher
- [x] Confirmer **PowerSync** via le spike ([spike-001](docs/specs/technical/spike-001-powersync.md)) — ✅ **validé le 05/07/2026** (voir [ADR-001](docs/adr/ADR-001-moteur-sync-offline.md)), débloque le modèle de données
- [ ] Trancher **Mapbox vs MapLibre** (fournisseur de cartes, running V0.5)
- [ ] Source des **GIF d'exercices** — exercises-dataset vs ExerciseDB (avant V0.2)
- [x] Source de la **base d'aliments** — ✅ **CIQUAL (bruts FR, + traduction EN) + OpenFoodFacts (industriels via scan)**, tranché le 06/07/2026 — débloque les US base d'aliments / journal (4.8+)

### Scaffolding (fondations, à poser avant tout code fonctionnel)
- [x] Initialiser le **monorepo** (`apps/mobile`, `apps/admin`, `packages/shared`) — npm workspaces (05/07/2026)
- [x] Créer l'**app Expo** (React Native + TypeScript + Expo Router + Zustand) — SDK 57, Metro monorepo (05/07/2026)
- [x] Poser l'infra **i18n** (i18next + expo-localization, FR + EN, aucune chaîne en dur) (05/07/2026)
- [x] Renseigner la section **Commandes** de [CLAUDE.md](CLAUDE.md) (05/07/2026)
- [x] Câbler un **runner de tests** — Vitest sur `packages/shared` (couverture 100 %) + `npm run test` (05/07/2026)
- [x] **Dev build Expo** (EAS) — profils `eas.json`, `eas init`, **1er build `build:dev` réussi** (APK dev client) (05/07/2026)
- [~] **Socle Supabase local** — `supabase/` (config, migration conventions, seed), client typé mobile + `.env.example`, scripts `db:*`. Reste : `db:start` (Docker) + provisioning cloud + schéma métier (avec les US)
- [x] Câbler les **tests mobile** (jest-expo) — fait avec l'US1 (mocks PowerSync + smoke) (06/07/2026)
- [x] Provisionner **Supabase cloud** (projet) + instance **PowerSync** — provisionné (confirmé 06/07/2026). Reste : pousser tables + RLS + sync rules (US1)
- [~] Intégrer **PowerSync** dans l'app (SQLite local, sync rules, repository) — plomberie posée (schéma jouet `todos`, connecteur générique) ; vrai schéma métier = US1

### Modèle de données & bascule PowerSync — pilier muscu (spec [schema-donnees-muscu.md](docs/specs/technical/schema-donnees-muscu.md))
- [x] **US1 — Socle data** — mergée dans `dev` (`248e2b2`, 06/07/2026). Activation cloud + device = section 🔴 en haut.
- [x] **US2 — Programmes muscu** — mergée dans `dev` (`cdf0032`, 06/07/2026).
- [x] **US3 — Historique & records** — mergée dans `dev` (06/07/2026). **Pilier muscu (V0.2+V0.3) complet côté code.**

---

## 📋 Backlog par version

Voir [docs/roadmap/roadmap.md](docs/roadmap/roadmap.md). Ordre de build :
**V0.1** socle & compte → **V0.2/V0.3** muscu → **V0.4** alimentation → **V0.5** running →
**V0.6** dashboard & sync cloud → **V0.7** admin → **V0.8** bêta → **V1.0** lancement → **V1.1** post-lancement.

Les US remontent ici (dans « À faire prochainement » puis « En cours ») dès qu'elles
démarrent leur cycle spec → plan → design → validation → code.

---

## ✅ Fait

- [x] Phase de cadrage : fusion des cadrages Florian + Damien, arbitrages A→H, roadmap versionnée (04/07/2026)
- [x] Process de travail : workflow spec→plan→design→validation→code, branches, `/commit` (revue + CHANGELOG + push `dev`) (05/07/2026)
- [x] Fichiers de config dépôt : `.gitignore` + `.gitattributes` (normalisation LF) (05/07/2026)
- [x] Bundle design FitTrio (handoff Claude Design) importé dans `design/` (05/07/2026)
- [x] Scaffolding monorepo : npm workspaces + Expo (SDK 57, Router, Zustand, i18n FR/EN) + `packages/shared` (Zod) + stub `apps/admin` — typecheck ✅, bundle web ✅ (05/07/2026)
- [x] Runner de tests : Vitest sur `packages/shared`, 15 tests, couverture **100 %** (05/07/2026)
- [x] **V0.1 — Shell de navigation** : onglets + masquage piliers (2.1/2.2), thème (1.16), états vides (2.10), i18n FR/EN — mergé, **testé sur device** (05/07/2026)
- [x] **V0.1 — Polices custom** : Bricolage / Hanken / Space Mono d'après la maquette — mergé, testé sur device (05/07/2026)
- [x] **V0.1 — Unités (1.15) + blocs dashboard** : métrique/impérial (conversions 100 %) + accueil étoffé — mergé, testé sur device (05/07/2026)
- [x] **Écrans piliers** : en-tête structuré (`ScreenHeader`) + tagline — mergé (05/07/2026)
- [x] **V0.1 — Auth Supabase** (1.1/1.4/1.5/1.6/9.5) : inscription, connexion, session, reset, déconnexion — mergé, testé sur device (05/07/2026)
- [x] ESLint mobile (eslint-config-expo, flat config) + config EAS (`eas.json`) + `eas init` (05/07/2026)
- [x] CI GitHub Actions : typecheck + lint + tests sur chaque PR `dev`/`main` (05/07/2026)
