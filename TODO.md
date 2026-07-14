# TODO — Wellness App

Suivi **vivant** des tâches. On y ajoute les US au fur et à mesure qu'elles entrent dans le
pipeline ; la commande [`/commit`](.claude/commands/commit.md) coche ce qui vient d'être livré.

- Légende : `[ ]` à faire · `[~]` en cours · `[x]` fait
- Le **backlog complet** (179 US, V0.1 → V1.1) vit dans
  [docs/roadmap/roadmap.md](docs/roadmap/roadmap.md) — ne pas le recopier ici, seulement
  remonter les US actives.
- Rappel workflow (voir [CLAUDE.md](CLAUDE.md)) : **spec → plan → design → validation → code**.
  Chaque US = une branche (`feature/…`, `fix/…`, `chore/…`).

*Dernière mise à jour : 14/07/2026 (recette device CIQUAL validée sur Pixel 6a + outillage : scripts `db:new`/`db:push`/`db:push:dry`, bloc `env` preview dans `eas.json`, doc migrations cloud dans CLAUDE.md ; nettoyage des artefacts de prebuild lancé à la racine par erreur. US « enrichir la bibliothèque CIQUAL » — **code livré** : 80 aliments 100 % CIQUAL 2025 (50 + 30), livrés par **migration idempotente** (biblio sortie de seed.sql), tooling reproductible ; reste `db:push` cloud + device (Florian). Précédemment : US « panel nutritionnel étendu » **code livré & revu (Approved)**, 10 → 31 micronutriments, sans migration ; reste recette device. Fix scan code-barres : messages d'échec honnêtes + affichage P/G/L + sucres/AGS/fibres captés d'OFF — voir §Bugs connus (recette device restante). Fix UI food-picker : onglets `scrollable` étirés en hauteur corrigés — recette device validée par Florian ✅. Précédemment : build à deux RÉSOLU + convention timestamps migration OK ; toutes les migrations cloud running R3a/R3b-i/R3b-ii/R3c-i/R4b + admin 8.4 appliquées (db:types + sync rules) ; validation terrain running R1 recettée par Florian ; MapLibre acté. Il reste la campagne de vérif device — voir sections 🟠 et running. Bannière URGENT retirée ; fix fuite inter-piliers muscu ; import CSV 8.6.)*

---

## ✅ Build à deux — RÉSOLU (14/07/2026)

> **Résolu (14/07/2026)** : le build à deux fonctionne, le contournement `app.json` local n'est
> plus nécessaire. Historique conservé ci-dessous pour trace.
> **Contexte initial (07/07/2026)** : Florian était **bloqué pour builder l'app** (EAS) — projet Expo
> sous le **compte perso `damdamdeoh`** (`projectId 4d24d343-…`), non partageable → `eas build` /
> `eas init` renvoyaient « Entity not authorized » pour `florian935`.

- [x] **Créer une Organisation Expo** (expo.dev) et y **transférer/héberger** le projet `wellness-app`. — org `wellness-appl`, projet transféré (07/07/2026).
- [x] **Inviter `florian935`** (`florian.martin63000@gmail.com`) comme membre (Developer/Admin).
- [x] Mettre `apps/mobile/app.json` → `"owner": "wellness-appl"` (au lieu de `damdamdeoh`). —
  **mergé dans `dev`** (PR #28, 07/07/2026). `extra.eas.projectId` + `updates.url` inchangés/cohérents.
  Transfert confirmé serveur (`eas project:info` → `@wellness-appl/wellness-app`, même projectId).
- [x] `npm run build:preview` / `build:dev` **passent sous le compte de Florian** ; `app.json`
  restauré, contournement local abandonné (confirmé 14/07/2026).
- [x] **Config env des builds autonomes** — ✅ **fait (07/07/2026)** : les 3 `EXPO_PUBLIC_*`
  (`SUPABASE_URL` / `_ANON_KEY` / `POWERSYNC_URL`) déclarées via **EAS Environment Variables**
  (`eas env:push` depuis `apps/mobile/.env`) pour **preview + production** (visibility PUBLIC ;
  vraies valeurs vérifiées via `eas env:list --format long`). _Contexte :_ `eas.json` n'a aucun bloc
  `env` → sinon les builds `preview`/`production` (JS compilé sur EAS cloud) sortaient **sans** ces
  variables → **crash au démarrage** (`supabase.ts` lève à l'import ; les dev builds marchaient car
  Metro injecte le `.env` local). _MàJ 14/07/2026 :_ un bloc `env` (mêmes 3 `EXPO_PUBLIC_*`, clé
  publishable) a aussi été ajouté au profil **preview** dans `eas.json` — redondant/explicite avec
  les EAS Environment Variables, versionné dans le repo (aucun secret).
- [x] **Coordination migrations** : convention de **plages de timestamps** de migration actée
  (collisions évitées de justesse le 06-07/07 : nutrition `140000-140002`, running `20260707120000`) —
  OK (14/07/2026).
- [x] Retirer la bannière ⚠️🔴 en tête de [CLAUDE.md](CLAUDE.md) — **fait (14/07/2026)**.

---

## 🐞 Bugs connus / à corriger

> Anomalies remontées hors du fil d'une US en cours. À traiter sur une branche `fix/…` dédiée
> (jamais en piggyback d'un dev en cours). Reproduire → spec courte si besoin → corriger → PR.

- [x] **Scan code-barres : « produit introuvable » trompeur + affichage nutritionnel pauvre** —
  **corrigé** (`fix/scan-code-barres`, 14/07/2026). Investigation (adb logcat + test direct endpoint
  OFF) : le scan **fonctionne** (validé Perrier physique) ; les échecs venaient de scanner des
  **codes-barres à l'écran** (mauvaise lecture → code absent d'OFF). Le pot de Nutella ne scanne pas
  (surface courbée = autofocus). **(1)** `fetchOpenFoodFactsByBarcode` renvoie un **résultat typé**
  `OffLookup` + helper pur `interpretOffProduct` → messages honnêtes (réseau / code inconnu affiché /
  fiche incomplète) au lieu d'« introuvable » générique. **(2)** `QuantityPanel` affiche **P/G/L** +
  **sucres/AGS/fibres** désormais captés depuis OFF et **stockés** à l'import (les 2 flux scan +
  recherche texte). +5 tests (39/39 mobile), i18n 787/787, typecheck/lint verts. **100 % client, pas
  de checkpoint 🔴.** **Reste** : recette device (rescanner un vrai produit → P/G/L + sucres/AGS
  visibles ; scanner une image → « code inconnu (…) »). _Note : `eas.json` local de Florian non
  commité (identifiants, hors git)._

- [x] **Onglets du food-picker étirés en hauteur (« Ajouter un aliment »)** — **corrigé**
  (`fix/food-picker-onglets-scrollable`, 14/07/2026). Régression de la variante `scrollable` de
  [Segment.tsx](apps/mobile/src/components/Segment.tsx) (commit `41e459b`) : un `ScrollView`
  horizontal enfant direct d'un flex colonne s'étire sur toute la hauteur → l'onglet sélectionné
  (« Tous ») devenait une grande barre orange, libellé en haut. Fix : `ScrollView` enveloppé dans
  une `View` qui se cale sur la hauteur du contenu et porte le cadre. typecheck/lint/test verts.
  **100 % client, UI pure.** **Recette device validée par Florian (14/07/2026)** ✅ — reste relecture Damien.

- [x] **Fuite inter-piliers dans « Mes programmes » muscu (pas de filtre par pilier)** — **corrigé**
  (`fix/programmes-filtre-pilier`, 13/07/2026). L'écran muscu [programs/index.tsx](apps/mobile/src/app/programs/index.tsx)
  ne passait **jamais** le pilier (`useMyPrograms()` sans argument + `filters` sans `pillar`) → les
  programmes running fuyaient dans « Mes programmes » **et** « Bibliothèque » muscu. Fix ~2 lignes :
  `useMyPrograms('strength')` + `pillar: 'strength'` toujours présent dans `filters`. Bug
  **unidirectionnel** (running filtrait déjà bien). typecheck mobile vert. **100 % client, aucune
  migration.** **Recette device validée par Florian (13/07/2026)** ✅ — reste relecture Damien.

- [x] **Écran détail programme (mobile) — séances repliables** — **livré & mergé `dev`**, **recette
  device validée par Florian (13/07/2026)**. Cadrage complet (spec + plan, maquette écartée). Composant
  partagé `CollapsibleCard` : séances **repliées par défaut**, ouverture indépendante, en-tête tappable
  + chevron, `footer` (Démarrer) toujours visible. **(1) Nom d'exercice tronqué → corrigé** (`PlanRow`
  sur 2 lignes). **(2) Séance cliquable → expansion inline** (muscu = « N exercices » + liste ; running
  = « type · cible » + puces/allure). Spec/plan :
  [detail-programme-seances-repliables.md](docs/specs/functional/us/detail-programme-seances-repliables.md).
  typecheck/lint/tests verts, i18n 796/796. **100 % client.** Reste : relecture Damien.

- [x] **🔴 BLOQUANT — Crash + non-enregistrement au 2ᵉ passage de l'onboarding** — **corrigé**
  (`fix/onboarding-rejeu-profil`, 13/07/2026), diagnostic device (adb logcat + logs temporaires).
  4 causes distinctes trouvées & corrigées : **(1) crash** = `active_pillars` triple-encodé relu
  en chaîne → `.map` planté → `parseJsonColumn` gagne un validateur de forme + garde `isPillarArray` ;
  **(2) profil affiché vide** (données pourtant enregistrées) = formulaire figé au montage alors que
  `useQuery` renvoie `null` au 1ᵉʳ rendu → **gate `isLoading`** sur `profile.tsx` + `infos.tsx` ;
  **(3) perte de saisie** = garde anti-écrasement prénom/sexe/date ; **(4) date de naissance −1** =
  `toISOString()` (UTC) sur date locale → helper `toIsoDate`. + objectif `scrollable` (UI) + note
  synchro corrigée. Vérifs vertes. Recette device validée par Florian ✅ (reste : relecture Damien).
  **Suivi levé** (`fix/finitions-affichage-profils`, 13/07/2026) : `nutrition-profile`/`running-profile`
  **vérifiés OK** — lecture réactive, pas de snapshot au montage, donc pas concernés par le bug.

- [x] **Typecheck `running-history` au vert** (`fix/finitions-affichage-profils`, 13/07/2026) : les 2
  erreurs préexistantes (`router.push` string → route typée `{ pathname, params }`) corrigées →
  **typecheck 100 % vert** sur tous les workspaces.

- [ ] **Doc** : [dev-build-android-local.md](docs/specs/technical/dev-build-android-local.md) créée
  (procédure dev build Android local pour Damien) — 13/07/2026.

---

## 🟠 Activation cloud — ✅ FAITE (09/07/2026), reste la vérif device

> **Cloud activé (09/07/2026)** : toutes les migrations sont appliquées sur Supabase, la publication
> `powersync` est en place et les **sync rules sont déployées** sur PowerSync. ⚠️ **Format réel =
> `bucket_definitions`** (et **non** « edition 3 » comme l'écrivaient les anciennes entrées TODO /
> CHANGELOG) : les Sync Streams `auto_subscribe` ne délivraient aucune donnée au client → revert
> documenté en tête de [powersync-sync-rules.yaml](docs/specs/technical/powersync-sync-rules.yaml).
> **Vérif device faite (Florian, 14/07/2026)** ✅ pour tous les piliers (muscu US1/US2/US3, nutrition,
> running R3/R4b*) + validation terrain running R1. _(* R4b records : vérif terrain prévue le 15/07.)_

- [x] **Migrations Supabase cloud appliquées** — les 14 migrations (socle + muscu US1/US2/US3, nutrition,
  food, recettes/poids, running `runs`, `nutrition_meals`) sont sur le cloud ; publication `powersync`
  en place (gérée via `alter publication … add table` dans les migrations).
- [x] **Sync rules déployées** — format `bucket_definitions`, 2 buckets (`user_data` / `shared_content`),
  toutes les tables — depuis [powersync-sync-rules.yaml](docs/specs/technical/powersync-sync-rules.yaml).
- [x] **`database.types.ts` régénéré depuis le cloud** (09/07/2026, `supabase gen types --project-id …`) —
  inclut la colonne `meals` ; typecheck vert sur les 3 workspaces.
- [x] **Seed** (16 exercices bilingues + 50 aliments) appliqué au cloud (chore db, 06/07/2026).
- [x] **Vérif device US1 (Task 22)** — **recettée (Florian, 14/07/2026)** ✅ : écriture/lecture mode avion,
  sync montante/descendante, RLS sur 2 appareils, i18n FR/EN.
- [ ] **Relecture a posteriori par Damien** — le merge US1 a court-circuité la relecture à deux
  (zones sync/sécurité) sur décision explicite de Florian ; à repasser.
- [x] **Vérif device US2** — **recettée (Florian, 14/07/2026)** ✅ : créer/dupliquer/activer un programme, démarrer une séance depuis un programme.
- [x] **Vérif device US3** — **recettée (Florian, 14/07/2026)** ✅ : record détecté à la clôture + mis en avant au résumé, historique liste/détail, courbes qui s'affichent, volume/groupe.
- [x] **Running R1 — VALIDATION TERRAIN faite (Florian, 14/07/2026)** ✅ : course réelle écran verrouillé
  + arrière-plan, perte GPS, auto-pause, mode avion→sync (1 ligne/course), reprise après kill, batterie,
  RLS 2 comptes, i18n — le cœur de R1 est recetté sur device.
  - [x] **Fix crash au lancement d'une course** (`fix/location-receive-boot-completed`, 09/07/2026) :
    ajout de la permission `RECEIVE_BOOT_COMPLETED` (manquait → `expo-location`/`task-manager`
    plantait à la 1ʳᵉ position GPS en programmant un job persistant). Diagnostic via `adb logcat`
    sur l'APK preview (Pixel 6a). **Nécessite un nouveau build** pour valider (l'APK actuel plante).

---

## 🚧 En cours

- [~] **Panel nutritionnel étendu (AG détaillés + oméga + toutes vitamines/minéraux)** — **code livré
  & revu (*Approved*)** (`feature/panel-nutritionnel-etendu`, 14/07/2026). Prolonge 4.33 (panel étendu
  différé). +21 nutriments (socle 10 → 31) : AG mono/poly/trans + oméga-3/6/9, minéraux (zinc,
  phosphore, cuivre, manganèse, sélénium, iode), vitamines A/E/K/B1/B2/B3/B5/B6/B7 — stockés dans la
  colonne JSON `micronutrients` (**aucune migration**), captés depuis OFF (present-only, garde-fou
  unité vitamine A en IU), affichés dans `MicronutrientDetails`. Vit C/D/B9/B12 déjà gérées (socle).
  **Décisions produit (Florian)** : périmètre **complet**, **pas de 2ᵉ source** (USDA/CIQUAL par nom)
  pour l'instant. Spec+plan : [spec](docs/specs/functional/us/panel-nutritionnel-etendu.md) ·
  [plan](docs/plans/panel-nutritionnel-etendu.md). Exécution subagent-driven + revue de code *Approved*.
  Propagation embrassée : le **formulaire admin** couvre aussi les 31 (+21 libellés admin FR). Garde
  vit A en IU (omise si unité non massique). typecheck/lint/build verts, shared 620 + mobile 42 tests,
  parité i18n 808/808. **Reste** : recette device (aliment riche → 3 groupes ; aliment pauvre →
  inchangé ; vit A IU non affichée) + relecture Damien. **Différé** : objectifs/RDA, regroupement
  visuel admin, agrégats recettes/repas types. **100 % client, pas de checkpoint 🔴.**
- [x] **US — Enrichir la bibliothèque d'aliments avec CIQUAL 2025** — **code livré**
  (`feature/seed-ciqual-enrichment`, 14/07/2026). **Approche A** : bibliothèque reconstruite depuis
  **CIQUAL 2025** (ANSES/Etalab) — **80 aliments** (50 identités conservées + toute la nutrition
  CIQUAL **macros de base incluses** ; **+30 nouveaux** fruits/légumes/viandes/poissons/légumineuses/
  oléagineux), **present-only, ne rien inventer** (oméga = somme des AG ; `trans`/biotine absents de
  CIQUAL ; café non mappé). **Livraison = migration idempotente** `20260714120000_seed_library_foods_ciqual`
  (upsert : réconcilie le cloud + insère les 30) — la biblio **quitte `seed.sql`** (nouvelle règle
  « jamais de SQL manuel »). Tooling reproductible `supabase/scripts/enrich-ciqual/` (générateur +
  `foods-catalog.json` + `mapping-columns.json`, export brut hors git). Spec+plan à jour (révision).
  **Terminée (14/07/2026)** ✅ — migration poussée par CLI (`npm run db:push`, cochée dans
  [MIGRATIONS.md](supabase/MIGRATIONS.md)) + recette device validée par Florian (build debug Pixel 6a).

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
- [x] **V0.4 — US4.1 Profil nutritionnel & TDEE** (`feature/4.1-profil-nutritionnel-repo`, 1.10/4.1-4.7) — objectif nutritionnel, facteur d'activité (5 niveaux), TDEE Mifflin-St Jeor, objectif calorique (auto + surcharge manuelle), macros par défaut/manuelles (%↔g), restrictions/allergènes. Calculs purs + `nutritionProfileRowSchema` dans `@wellness/shared` (+28 tests), **table `nutrition_profiles`** (schéma PowerSync + migrations 140000/140001 + RLS + sync rules), `nutrition-repository` (`useQuery`/upsert), écrans + FR/EN. typecheck/lint/test verts. Spec : [us/4.1-profil-nutritionnel.md](docs/specs/functional/us/4.1-profil-nutritionnel.md). **Activation cloud + vérif device faites (Florian, 14/07/2026).** ✅ (4.7 câblage planning muscu = ultérieur.) _(mergée en parallèle par Damien)_
- [x] **V0.4 — US4.8 Base d'aliments & journal** (`feature/4.8-aliments-journal`, 4.8/4.9/4.11-4.14/4.16/4.17/4.19-4.23) — 50 aliments bilingues (seed), recherche + OpenFoodFacts + favoris + aliment perso, journal 4 repas (nav jours, totaux + barres macros temps réel, quick add, portions). `food.ts` (+16 tests), 4 tables PowerSync + migrations `150000/150001` + RLS + sync rules + seed, `food-repository`/`journal-repository`/`lib/openfoodfacts`, écrans + FR/EN. typecheck/lint/test verts. Spec : [us/4.8-aliments-journal.md](docs/specs/functional/us/4.8-aliments-journal.md). **Activation cloud + vérif device faites (Florian, 14/07/2026).** ✅ **Différé** : renommer/ajouter repas (4.15), copier (4.18), recettes (4.24-4.26), poids & stats (1.13/1.14/4.30-4.32), notif (2.5).
- [x] **V0.4 — US4.10 Scan code-barres** (`feature/4.10-scan-code-barres`) — scan EAN/UPC via `expo-camera` → recherche d'abord le code-barres **en local** (évite un doublon d'import), sinon **OpenFoodFacts par code-barres** → panneau quantité (composant `QuantityPanel` extrait, partagé avec le picker) → ajout au journal. Gère la permission caméra + l'état « introuvable » (rescan / créer un aliment), FR/EN. `fetchOpenFoodFactsByBarcode` (`lib/openfoodfacts`) + `findFoodByBarcode` (`food-repository`) + écran `food-scan`. typecheck/lint/test verts. **Reste** : nouveau **dev build** (`expo-camera` natif) + vérif device.
- [x] **V0.4 — US4.24 Recettes, repas types, poids & stats** (`feature/4.24-recettes-poids-stats`, 4.24-4.26/1.13/4.30/4.31) — recettes (ingrédients + portions + valeurs par portion), repas types (enregistrer/réappliquer), poids corporel (pesée/jour + tendance + courbe 4 sem/3 mois/1 an), apports moyens 7/30 j + courbe. `recipe.ts`/`bodyweight.ts` (+tests), 5 tables PowerSync + migrations `130000/130001` + RLS + sync rules, repos + écrans (`recipe-edit`, `nutrition-stats`, food-picker étendu). typecheck/lint/test verts. Spec : [us/4.24-recettes-poids-stats.md](docs/specs/functional/us/4.24-recettes-poids-stats.md). **Activation cloud + vérif device faites (Florian, 14/07/2026).** ✅ **Différé** : 4.32 stat croisée, rappels (natif), planning (V1.1).
- [x] **V0.6 — US7.4–7.7 Dashboard live (MVP)** (`feature/7.4-7.7-dashboard-live`) — l'accueil placeholder devient un **dashboard branché sur les données locales réelles**, réactif (`useQuery`). Logique `computeStreak` + `localDayKey` (shared, purs, testés) ; hooks `dashboard-repository` (`useNextSession`/`useStreakData`/`useNutritionSummary`) ; 4 widgets (Séance du jour, Résumé nutrition, Régularité/streak, Poids) + `DashboardCard` extrait ; i18n `home.*` FR/EN ; suppression du « arrive bientôt ». Démarrage via `startWorkoutFromSession`. Spec + plan + **maquette** validés (Florian), exécution subagent-driven (revues par phase + revue finale *Approved*), smoke test streak. typecheck/lint/tests verts (362 shared + 29 mobile), parité i18n 535/535, 0 doublon de clé. **Décisions MVP H1–H4** (pas de planning hebdo, jour nutrition = ≥1 repas, pas de repos-neutre, widget Poids si pilier nutrition). **100 % client, sans activation cloud.** **Validé device (11/07/2026)** : 4 widgets branchés sur données réelles, temps réel OK, FR/EN, bascule d'unités widget Poids OK. Différé : personnalisation (7.1-7.3/7.11/7.12), widgets 7.8-7.10.
- [x] **V0.6 — US7.8–7.10 Widgets dashboard (Lot A)** (`feature/7.8-7.10-widgets-dashboard`) — 3 widgets additifs sur l'accueil : **Record récent** (7.8, dernier record battu muscu OU course, gardé par pilier), **Volume muscu semaine** (7.9, réutilise `MuscleVolumeBarChart`, kg), **Résumé running semaine** (7.10, distance + séances vs `weeklyFrequency`). Hook composite `useMostRecentRecord` (`dashboard-repository`) **respectant les piliers actifs** (sources muscu/running filtrées sur les résultats, hooks inconditionnels). i18n `home.record.*`/`home.volumeWeek.*`/`home.runningWeek.*` FR/EN à parité. typecheck/lint/tests verts (507 shared). **100 % client — aucune migration/cloud/dépendance native, pas de checkpoint 🔴.** Différé : objectif de distance hebdo (colonne dédiée), personnalisation dashboard (Lot B). **Vérif device faite (Florian, 14/07/2026).** ✅
- [x] **V0.6 — US7.1/7.2/7.3/7.11/7.12 Personnalisation dashboard (Lot B)** (`feature/dashboard-personnalisation`) — **mode édition** de l'accueil : **réorganiser par drag & drop** (7.2), **masquer/afficher** (7.3, œil sur **tous** les widgets, streak compris — masquabilité uniforme), **taille** compacte/normale (7.11, variante « une ligne » des 7 widgets via `DashboardCardCompact`), **persistance** locale + cloud (7.12) via la colonne existante `user_settings.dashboard_layout`. Logique pure `@wellness/shared/dashboard.ts` (registre + `resolveDashboardLayout` forward-compat/filtre piliers/tri + `moveWidget` + `parseDashboardLayout`, **25 tests**) ; `dashboard-layout-repository` (`useDashboardLayout` + mutateurs `updateSettings`, débounce ~400 ms sur le drag) ; `SortableDashboard` (gesture-handler `Pan` + reanimated, scroll neutralisé pendant le drag), `GestureHandlerRootView` posé à la racine. i18n `home.customize.*` FR/EN 65/65. typecheck/lint verts, 532 tests. **100 % client — aucune migration/cloud/dépendance native (reanimated/gesture-handler déjà présents), pas de checkpoint 🔴.** Spec+plan+maquette : [us/7.1-7.3-7.11-7.12-dashboard-personnalisation.md](docs/specs/functional/us/7.1-7.3-7.11-7.12-dashboard-personnalisation.md). **Vérif device du drag & drop faite (Florian, 14/07/2026).** ✅ **Différé** : auto-scroll près des bords pendant le drag (spec §8).
- [x] **V0.6 — US2.6/2.8/1.17 Notifications locales** (`feature/notifications-v0.6`) — rappel local **série en danger** (2.6, planifié aujourd'hui à l'heure choisie si aucune activité, annulé dès qu'actif), **Ne pas déranger** (2.8, fenêtre configurable défaut 22→7 pouvant enjamber minuit + max/jour défaut 3), **gestion par type** depuis les Réglages (1.17). Logique pure `@wellness/shared/notifications.ts` (`NotificationPrefs` + `defaultNotificationPrefs` + `parseNotificationPrefs` tolérant + `isWithinDnd` + `shouldScheduleStreakReminder` + `canScheduleMore`, testée) ; colonne `user_settings.notifications` enrichie (`z.record`→schéma typé) **sans migration** ; wrapper natif `lib/notifications.ts` (**expo-notifications SDK 57** : permission + canal Android `reminders` + trigger `DATE` avec id stable idempotent, permission refusée = no-op) ; `notification-repository` (`useNotificationPrefs`/`updateNotificationPrefs`/`useStreakReminderScheduler` réagissant à `activeToday`+prefs+`AppState`) ; section Réglages (Switches + `HourStepper` **pur JS** 0-23) + bandeau permission refusée ; init/scheduler monté dans `_layout`. i18n FR/EN à parité. typecheck/lint/tests verts (595 shared). **Une seule dépendance native (`expo-notifications`), aucune migration, pas de checkpoint 🔴.** Spec+plan+maquette : [us/2.6-2.8-1.17-notifications.md](docs/specs/functional/us/2.6-2.8-1.17-notifications.md). **Nouveau build + recette device faits (Florian, 14/07/2026)** ✅ (permission, rappel, DND, toggles). **Différé** : push distantes, types additionnels (rappel repas/suggestion séance), job d'arrière-plan garanti, iOS, exposition UI du `maxPerDay`.
- [x] **V0.4 — US4.34 + 4.35 Détail d'entrée & suivi micros** (`feature/nutrition-detail-suivi-micros`) — **4.34** : taper une entrée du journal ouvre un **modal détail** (macros + micros de la quantité, `MicronutrientDetails` + prop `showPer100`) ; appui long = suppression conservée. **4.35** : sélection de micros suivis (chips au profil, store **Zustand** persisté local device) → **totaux du jour** sous P/G/L dans le récap (`sumMicronutrients`, sel dérivé si sodium). **🐛 Fix** : `parseMicronutrients` tolérant au **double encodage JSON** (PowerSync/op-sqlite double-encode les colonnes texte-JSON écrites côté client — cause racine trouvée en interrogeant la base SQLite du device ; répare aussi les micros des aliments OFF). +1 test. i18n 616/616, typecheck/lint/test verts (401). **Validé device (Pixel, adb)**. Spec+plan : [us/4.34-4.35-nutrition-detail-suivi-micros.md](docs/specs/functional/us/4.34-4.35-nutrition-detail-suivi-micros.md). **100 % client — pas de checkpoint 🔴.** **⚠️ À traiter globalement** : le double encodage touche toutes les colonnes texte-JSON client (`active_pillars`, `portions`…) — helper de parse tolérant partagé à généraliser (lot dédié).
- [x] **V0.4 — US4.7 + 4.18 Finitions nutrition** (`feature/nutrition-finitions-4.7-4.18`) — branche deux fonctions déjà écrites mais inaccessibles. **4.7 calories jour de séance** : hook `useIsTrainingDay(dayKey)` (muscu OU course terminée ce jour, composé de `useWorkoutHistory`/`useRunHistory`, détection **rétroactive**) → objectif effectif = `trainingDayCalories(base, bonus)` dans le journal + widget dashboard, **badge** « +X kcal · jour de séance », réglage du bonus ajouté au profil nutritionnel (0 = désactivé). **4.18 copier une journée** : bouton « Copier toute la journée d'hier » (`duplicateDay`) sur jour vide, distinct du copier-repas. i18n FR/EN 612/612. typecheck/lint/test verts (400). Spec+plan : [us/4.7-4.18-nutrition-finitions.md](docs/specs/functional/us/4.7-4.18-nutrition-finitions.md). **100 % client — pas de checkpoint 🔴 cloud.** **Recette device faite (Florian, 14/07/2026).** ✅ **Assumé MVP** : macros non ventilées par le bonus ; objectif rétroactif (anticipé quand planning muscu US2b existera). _Design écarté (UI mineure, précédent 1.15)._
- [x] **US4.7b — Détection anticipée des jours d'entraînement** (`feature/nutrition-4.7-anticipee`) — complète US4.7 : un jour avec une séance **planifiée** (`planned_sessions`, statut `planned`/`done`) compte comme jour d'entraînement **par anticipation** (aujourd'hui + futur), déclenchant le bonus calorique nutrition. Le passé reste rétroactif uniquement. Helper pur `isTrainingDay(i)` dans `@wellness/shared` (TDD, 6 tests, frontière `dayKey===todayKey` couverte) ; hook `useHasPlannedSession(dayKey)` dans `planned-session-repository` (owner-scopé, réactif) ; composition dans `useIsTrainingDay` (aliasé `computeIsTrainingDay`). Streak inchangé. **Aucune migration, aucun cloud.** typecheck/lint/test verts. Spec+plan : [us/4.7b-nutrition-jour-entrainement-anticipe.md](docs/specs/functional/us/4.7b-nutrition-jour-entrainement-anticipe.md).
- [x] **V0.4 — Nutrition : édition d'entrée + 8 durcissements** (`feature/journal-modifier-supprimer-entree`) — (a) **US4.34** : éditer la quantité (aperçu live, `rescaleEntryNutrition`) / supprimer une entrée depuis le détail du journal. (b) **8 correctifs** issus de l'analyse des manques : **#1** éditer/supprimer un aliment (`updateFood`/`deleteFood`, food-custom en mode édition, appui long sur le picker) ; **#2** dédup OFF sur la recherche texte (`findFoodByBarcode` avant import) ; **#3** recherche insensible aux accents/ligatures (`search.ts`, filtrage JS) ; **#4** fibres/sucres/AG saturés branchés (saisie + stockage + aperçu `QuantityPanel`) ; **#5** onglet Récents (`useRecentFoods`) + multi-ajout ; **#6** réordonnancement (`moveEntry`) + horodatage du détail ; **#7** `rescaleEntryNutrition` extrait/testé dans shared ; **#8** `parseJsonColumn` partagé tolérant au double-encodage (généralise le contournement micros à `active_pillars`/`meals`/`portions` — **résout la dette « lot dédié » de l'US4.34**). +16 tests shared (467), i18n 708/708, typecheck/lint verts. Recette device Pixel 6a : #3/#5/#6 confirmés. **100 % client.** **Différé (checkpoint 🔴)** : suivi de l'eau (table `water_logs`) et snapshot fibres/sucres/AGS par entrée (`food_entries`) — migration cloud requise. ~~Reste : 2 erreurs typecheck `running-history`~~ → **corrigées le 13/07/2026** (`fix/finitions-affichage-profils`).
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
- [x] **Running R3 — Profil coureur + programmes** (5.1-5.11) — **découpé en R3a/R3b/R3c** :
  - [x] **R3a — Profil coureur + types de séance** (5.1, 5.8-5.11) — **code livré & revu** (`feature/running-r3a-profil-types`). `running-paces` (VMA dérivée + plages d'allure, testé) + parse allure M:SS ; table **`running_profiles`** (migration `20260712090000` + RLS + sync rules + schéma PowerSync) ; `running-profile-repository` ; écran profil + « Mes allures » + route + entrée Réglages ; i18n FR/EN. Cadrage complet, revues par phase + finale (*Approved*). typecheck/lint/tests verts. **Migration cloud + sync rules + `db:types` + vérif device faits (Florian, 14/07/2026).** ✅ _Récup +90-120 : plafond d'affichage à confirmer produit._
  - [x] **R3b — Programmes de course** — **découpé en R3b-i / R3b-ii** :
    - [x] **R3b-i — Programme custom** (5.4) — **code livré & revu** (`feature/running-r3b1-programme-custom`). Réutilise l'infra programmes muscu (pilier-aware) ; contenu de séance running (type + cible) ajouté à `sessions` (migration `20260712100000`) ; repo (`updateRunningSession`/`updateProgram`/`updateProgramTranslation`/duplicate étendu) ; écrans `running-programs` (liste/détail/éditeur) + allure dérivée R3a. Blocs d'intervalles différés. Cadrage + revues (par phase + finale *Approved*). typecheck/lint/tests verts, muscu non régressé. **Migration cloud + `db:types` + vérif device faits (Florian, 14/07/2026).** ✅
    - [x] **R3b-ii — Bibliothèque + filtres + seed** (5.2, 5.3) — **code livré & revu** (`feature/running-r3b2-bibliotheque`). Filtre pilier sur `useProgramLibrary` (champ `filters.pillar`, appelants muscu intacts) + `duplicateProgram` copie non active confirmée ; **seed** 3 programmes starter bilingues FR+EN (préfixe UUID `e…`, idempotent, séances `session_type`+cible conformes à la check R3b-i) ; **onglet « Bibliothèque »** (parcours + filtres objectif/niveau/durée + « Utiliser » → duplication → détail copie) ; i18n `running.library.*` FR/EN. Cadrage complet, revues spec (*conforme*) + qualité (*Approved*). typecheck/lint/tests verts (400 shared + 29 mobile), parité 617/617, muscu non régressé. _Micro-écart : résumé non affiché sur carte (comme muscu) — à arbitrer produit._ **Seed cloud + vérif device faits (Florian, 14/07/2026)** ✅ (sync `shared_content`).
  - [x] **R3c — Planning + coordination muscu/running + séance manquée** (5.5, 5.6, 5.7) — **découpé en R3c-i / (5.6 différée)** :
    - [x] **R3c-i — Planning daté + séance manquée** (5.5, 5.7) — **code livré & revu** (`feature/running-r3c1-planning`). Première **couche de planification datée** : table générique **`planned_sessions`** (migration `20260712110000` + RLS `owner_id` + sync rule `user_data` + schéma PowerSync) ; logique partagée testée (`generatePlannedSessions` semaine type 0=lundi + `isMissed` + helpers `date.ts`, validation Zod) ; `planned-session-repository` (`planRunningProgram` transactionnel idempotent + activation inlinée, `useWeekPlan`, `useMissedSessions`, reporter/sauter/fait ; `txInsert` extrait dans `_sql`) ; écrans **assistant Planifier** (durée + date de début + semaine type) + **vue semaine 7 jours** (allures via profil R3a, séances manquées, actions) ; i18n `running.planning.*` + `common.weekday.*`. Sélection de date en **JS pur** (pas de dépendance native). Cadrage complet (spec→plan→maquette), revues par phase (spec+qualité) + finale (*Ready to merge*). typecheck/lint/tests verts (shared 423 + mobile 29), parité 659/659, muscu non régressé. **Migration cloud + sync rule + `db:types` + vérif device faits (Florian, 14/07/2026).** ✅
    - [x] **5.6 — Coordination muscu ↔ running** (alerte 2 séances le même jour) — **livrée avec US 3.9** : indicateur « N séances » sur le calendrier unifié quand ≥ 2 séances (planned+done) le même jour (non bloquant). _(Coordination avancée charge/récup toujours différée.)_
- [~] **Running R4 — Historique, stats, records d'allure, export GPX** (5.28-5.33) — **découpé R4a / R4b / (GPX + dénivelé différés)** :
  - [x] **R4a — Historique + stats + courbe d'allure** (5.28, 5.29, 6.1) — **code livré & revu, intégré `dev`** (`feature/running-r4a-historique-stats`). Écran « Historique & progression » : stats (semaine/mois/début), courbe d'allure globale 30/90 j + tendance, liste chronologique → détail. Logique partagée testée (`run-stats.ts`, +`formatDurationHms`) + hooks lecture (`useRunStats`/`usePaceTrend`, `useRunHistory` inchangé). Lecture seule : **aucune migration, aucun rebuild**. Cadrage complet, revues par phase (spec+qualité) + finale (*Ready to merge*). typecheck/lint/tests verts (shared 436 + mobile 29), parité 678/678. _Pas de checkpoint 🔴 (lecture seule)._
  - [x] **R4b — Records d'allure (segment glissant) + maj auto allure de réf** (5.30, 5.31) — **code livré & revu, intégré `dev`** (`feature/running-r4b-records`). Table **`running_pace_records`** (migration `20260712120000` + RLS + sync `user_data` + schéma PowerSync) ; logique partagée testée (`pace-records.ts` : meilleur segment glissant + interpolation + filtre outliers, 9 tests) ; `running-record-repository` (`useRunningRecords`, `detectAndStoreRunRecords` idempotent GPS-only + maj ref 5 km, `backfillRunningRecords`) ; **section « Records »** dans l'Historique + **célébration in-app** (bandeau animé charte, aucun module natif). Notification poussée différée. Cadrage complet, revues par phase (spec+qualité) + finale (*Ready to merge*). typecheck/lint/tests verts (shared 445 + mobile 29), parité 688/688, muscu non régressé. **Migration cloud + `db:types` + sync rule appliqués (14/07/2026).** ⏳ **Vérif terrain prévue le 15/07/2026 (marche, Florian)** — records d'allure + célébration à valider sur le terrain.
  - [x] **Fix — précision GPS & records d'allure (marche/course lente)** — **code livré** (`fix/running-gps-precision-records`). Bug device : marche 1,01 km sans record 1 km + point (0,0) sur la carte. Diagnostic [fix-running-gps-precision-records.md](docs/specs/technical/fix-running-gps-precision-records.md). 3 volets : **(C, dominant)** encodage trace `1e-5→1e-6` avec **marqueur de version par segment** (compat ascendante, décode l'ancien 1e-5 et le nouveau 1e-6, aucune migration DB) ; **(A)** helper pur `isValidFix` + filtre ingestion (null island (0,0), hors bornes, `accuracy>50 m`) ; **(B)** auto-pause dé-sensibilisée (seuil `0,5→0,3 m/s` **+** vitesse lissée `smoothedSpeedMs` sur fenêtre 10 s). Test de repro rouge→vert + tests unitaires. typecheck/lint/tests verts (shared 478 + mobile 29). `distance_m` d'affichage inchangé (cumul live). **Rebuild preview + vérif device faits (Florian, 14/07/2026)** ✅ (badge 1 km OK, plus de point (0,0)). Reste : PR à relire.
  - [x] **Export GPX** (5.33) — **code livré** (`feature/5.33-export-gpx`). Bouton « Exporter (GPX) » sous la carte du résumé (course GPS terminée, ≥ 2 points valides) → GPX 1.1 sans altitude → feuille de partage OS. Logique pure testée (`buildGpx`, `gpxFileName`, `isValidCoord` extrait d'`isValidFix` sans régression) ; couche native `lib/gpx-export.ts` (API legacy `expo-file-system`, nom cache fixe) ; i18n FR/EN. 100 % local. typecheck/lint/tests verts (shared 506 + mobile 33). **Nouveau build + recette device faits (Florian, 14/07/2026)** ✅ : GPX exporté puis **ré-importé dans Garmin Connect**. _Export seul assumé — pas d'import GPX dans l'app Wellness (non spécifié/non prévu)._
  - [ ] **Dénivelé cumulé** (5.32) — **différé** : aucune altitude captée (`GpsPoint = {lat,lng,t}`) ; nécessite de modifier le tracker (R1) + étendre `GpsPoint`/le codec + un build.
  - [ ] **Découpage par type de séance** (stats/courbe par type) — différé : les courses libres n'ont pas de `session_type`.

---

## ⏭️ À faire prochainement (avant / début V0.1)

### Décisions bloquantes à trancher
- [x] Confirmer **PowerSync** via le spike ([spike-001](docs/specs/technical/spike-001-powersync.md)) — ✅ **validé le 05/07/2026** (voir [ADR-001](docs/adr/ADR-001-moteur-sync-offline.md)), débloque le modèle de données
- [x] Trancher **Mapbox vs MapLibre** (fournisseur de cartes, running V0.5) — ✅ **MapLibre acté** ([ADR-006](docs/adr/ADR-006-cartographie.md), livré & validé device en R2)
- 🚫 **BLOQUÉ — Média des exercices (images / GIF)** _(décision produit à trancher, 13/07/2026)_ : on n'a
  **ni images ni GIF** pour les exercices, et la **stratégie n'est pas décidée** — (a) **source** du média
  (exercises-dataset vs ExerciseDB vs médias maison), (b) **licence/droits**, (c) **stockage** (Supabase
  Storage vs CDN externe), (d) **upload/attribution** côté admin. **Bloque l'US 8.3** (upload média admin) et
  l'affichage média dans la biblio mobile (`exercises.media_url` reste vide en attendant). → **décision produit
  + technique à prendre (Florian et/ou Damien) avant de démarrer 8.3.** _(Remplace l'ancienne ligne « Source des GIF —
  exercises-dataset vs ExerciseDB ».)_
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
- [x] **US 8.1a — Admin Fondation-1** (`apps/admin`) : scaffold Vite+React+TS + auth Supabase (login/session/logout) + shell protégé (RequireAuth + layout + placeholder), libellés FR centralisés, `@wellness/shared` réutilisé. Build OK, racine typecheck/lint verts. 100 % client web, aucune migration/cloud. Gate par rôle = F2 (13/07/2026)
- [x] **US 8.4 — Admin constructeur de programmes** (`apps/admin`) : builder éditorial *pillar-aware* (muscu = séances→exos avec séries/reps/charge/repos ; running = cibles type/distance/durée), bilingue FR/EN, brouillon/publié, réorganisation glisser-déposer (@dnd-kit), archivage cascade. Migration RLS d'écriture éditoriale (`is_content_editor`, 4 tables), couche data `programs.ts`, composants `SortableList`/`ExercisePicker`, écrans liste/création/composition, routing gated. Impl. + 3 revues (data layer, écran compo, finale) ✅, typecheck/lint/build verts, mobile inchangé. **Migration (projet `nsxzflxsgovriwwvflxe`) + `db:types` + recette web faits (Florian, 14/07/2026).** ✅ (aucune sync rule à redéployer).
- [~] **US 8.6 — Import aliments CSV (CIQUAL)** (`feature/8.6-import-csv-ciqual`, 13/07/2026) — **code livré**. Cadrage complet (spec+plan). `@wellness/shared/food-csv.ts` (`parseFoodCsv` pur, 8 tests TDD) ; migration `foods.import_key` + index unique (**checkpoint appliqué** : migration cloud + `db:types` faits) ; admin : écran Import CSV (upload→papaparse→aperçu→confirmation→rapport + modèle CSV), `data/foods.ts` (upsert idempotent `foods`+`food_translations` FR/EN), route `/foods` + nav « Aliments » gated `content_editor`, `papaparse`. Contrat : `import_key`/`name_fr`/`name_en`/`category`/`kcal` requis + macros/10 micros optionnels. typecheck/lint/tests verts (shared 610), build admin OK. Spec/plan : [8.6-import-csv-ciqual.md](docs/specs/functional/us/8.6-import-csv-ciqual.md). **Recette de base OK (13/07/2026)** : import du fichier d'exemple (1 ligne) → chemin complet parse→aperçu→upsert→rapport + RLS validé (après application de la migration RLS 8.5). **Reste** : import d'un vrai lot CIQUAL + ré-import idempotent + relecture Damien. **Différé** : rollback, import mobile.
- [~] **US 8.5 — Gestion base d'aliments (admin)** (`feature/8.5-gestion-aliments`, 13/07/2026) — **code livré**. Cadrage complet (spec+plan). CRUD éditorial : lister/rechercher/filtrer, **créer**, **éditer** (macros + 10 micros), **archiver** (soft-delete). `@wellness/shared/food-form.ts` (`validateFoodInput` pur, 9 tests TDD) ; `data/foods.ts` étendu (list/get/save insert-ou-update-ciblé/archive) ; écrans `FoodsScreen` (liste = hub) + `FoodEditScreen` (formulaire) ; **routing « Aliments » réorganisé** (`/foods` liste, `/foods/import` = 8.6 déplacé, `/foods/new`, `/foods/:id`) ; i18n admin FR. typecheck/lint/build verts, shared 619 tests. 100 % client admin, pas de dépendance native. Spec/plan : [8.5-gestion-aliments.md](docs/specs/functional/us/8.5-gestion-aliments.md). **Migration RLS `20260713160000` appliquée + recette OK (Florian, 13/07/2026)** : créer/éditer/archiver validés (débloque aussi 8.6). **Reste** : relecture Damien. **Différé** : signalements (8.7), restauration, édition `portions`, audit (8.10).

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
- [x] **Suppression de programmes & de séances** (`feature/suppression-programmes-seances`, 13/07/2026) — supprimer un programme (muscu **isOwned only** + course) et une séance depuis l'app. **Durcissement data** : `deleteProgram` = `writeTransaction` (is_active=0 si actif **puis** soft-delete, ordre impératif) + cascade `planned_sessions` owner-scopée par `program_id` + cascade existante préservée ; `removeSession` = cascade `planned_sessions` par `session_id`. Variante **`Button` destructive** (couleur `danger`). UI : bouton destructif + confirmation `Alert` (loading, retour liste, erreur non bloquante) sur les 2 écrans détail ; confirmation ajoutée à la suppression de séance (2 éditeurs). i18n FR/EN à parité (12 nouvelles clés). typecheck/lint/tests verts (595 shared). **100 % client — soft delete, aucune migration, aucune dépendance native, pas de checkpoint 🔴.** Spec+plan : [us/suppression-programmes-seances.md](docs/specs/functional/us/suppression-programmes-seances.md). **Vérif device faite (Florian, 14/07/2026).** ✅
