# Changelog

Toutes les modifications notables du projet sont consignées ici — **maintenu automatiquement
par la commande [`/commit`](.claude/commands/commit.md)**. Chaque entrée est construite à partir
de l'analyse du `git diff` du commit, pour garder une **trace complète** des modifications
(utile aux devs et au débogage).

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/). Dates au format **JJ/MM/AAAA**.
Catégories : **Ajouté** · **Modifié** · **Corrigé** · **Supprimé** · **Technique / Notes**.

<!-- Nouvelles entrées ajoutées ICI (ordre anté-chronologique, la plus récente en haut) -->

## 12/07/2026 — Running R4b : records d'allure + maj auto allure de réf

_Branche : `feature/running-r4b-records`. Cadrage complet (spec+plan+maquette validés) puis code subagent-driven (revue spec + qualité par phase + revue finale = **Ready to merge**). **US data → checkpoint 🔴 cloud non encore appliqué (après R3a/R3b-i/R3c-i).** Aucun module natif ajouté → **pas de rebuild**._

### Ajouté
- **`@wellness/shared`** `pace-records.ts` (pur, testé — 9 tests) : `RUNNING_RECORD_DISTANCES` (1/5/10 km, semi 21097,5 m, marathon 42195 m), `cumulativeDistances` (filtre outliers `MAX_PLAUSIBLE_SPEED_MS` → 0 m, point conservé), `bestSegmentTimeFromSamples` (**fenêtre glissante deux-pointeurs** + **interpolation linéaire de `t` au franchissement de D**), `bestSegmentTime`, `computeRunRecords`.
- **Table `running_pace_records`** : migration `20260712120000_running_pace_records.sql` (1 ligne par utilisateur × distance, `best_time_seconds`, `run_id`, `achieved_at` ; index **unique partiel `(user_id, distance_key) where deleted_at is null`** ; RLS `user_id = auth.uid()` ; publication PowerSync) + schéma PowerSync local + sync rule bucket `user_data`.
- **`running-record-repository.ts`** : `useRunningRecords()` (lecture réactive triée par ordre canonique) ; `detectAndStoreRunRecords(runId)` — **détection idempotente à la fin de course** (GPS terminée uniquement ; upsert « seulement si strictement plus rapide », comparaison et stockage **arrondi↔arrondi** ; renvoie les distances battues) + **maj auto de l'allure de référence** du profil coureur si le **5 km** est battu (5.31) ; `backfillRunningRecords()` (peuplement de l'historique existant, verrou in-flight).
- **Section « Records »** dans l'écran Historique : les 5 distances (allure dérivée + date via `useUnits`, tap → détail `run/summary?id=`, « — » si aucun record) ; **backfill** au 1ᵉʳ affichage si vide.
- **Célébration in-app** sur le résumé de course : bandeau animé (RN `Animated`, couleurs charte bordeaux/doré, **aucun module natif**) « Nouveau record ! » listant les distances battues + ligne « allure de réf mise à jour » si 5 km battu. Effet one-shot (déps primitives + garde démontage). i18n `running.records.*` FR/EN.

### Technique / Notes
- **Idempotence / non-re-célébration** : garantie par l'upsert « seulement si strictement plus rapide » comparant **arrondi↔arrondi** — rejouer le résumé d'une course déjà traitée renvoie `[]` (pas de re-célébration, pas de flag persistant).
- **GPS uniquement** (manuel exclu partout — données non vérifiables, spec §8) ; records **par course** (`t` = secondes depuis le départ, jamais à cheval sur deux courses).
- **Notification poussée différée** (infra `expo-notifications` dédiée, couvrira aussi muscu) → célébration **in-app** seule au MVP. Dénivelé (5.32), export GPX (5.33), découpage par type : différés.
- **Muscu non régressé** (`personal_records` hors diff) ; `upsertRunnerProfile` ne touche que `ref_5k_pace_s_per_km`.
- Offline-first (écritures locales `_sql`, UUID client, timestamps UTC, soft delete) ; qualité verte (typecheck 3 workspaces / lint / shared 445 + mobile 29) ; parité i18n 688/688 ; 0 doublon.
- **Reste (🔴, avec Damien)** : appliquer la migration `20260712120000` **après** R3a/R3b-i/R3c-i (ordre des timestamps) + `npm run db:types` + déployer la sync rule `user_data` + **vérif device** (établir un record → célébration + maj allure réf 5 km, rejouer sans re-célébration, section Records, backfill, RLS 2 comptes, FR/EN, offline).

## 12/07/2026 — Running R4a : historique + stats + courbe d'allure

_Branche : `feature/running-r4a-historique-stats`. Cadrage complet (spec+plan+maquette validés) puis code subagent-driven (revue spec + qualité par phase + revue finale = **Ready to merge**). **Lecture seule** sur `runs` : aucune migration, aucune dépendance, **aucun rebuild**._

### Ajouté
- **`@wellness/shared`** `run-stats.ts` (pur, testé — 13 tests) : `aggregateRunStats(runs, period, todayKey)` (distance/temps/nombre par **semaine lun→dim / mois calendaire / depuis le début**), `paceTrendPoints(runs, days, todayKey)` (fenêtre **glissante** 30/90 j, courses avec allure), `paceTrend(points)` (`improving`/`declining`/`stable`, seuil ±2 %, allure basse = plus rapide), `formatDurationHms(seconds)` (durée lisible).
- **`run-repository.ts`** : hooks **lecture seule** `useRunStats(period)` et `usePaceTrend(days)` réutilisant `useRunHistory` (inchangé → **dashboard streak / jour d'entraînement non régressés**) ; mapping course → `StatRun` via `localDayKey(finishedAt)`.
- **Écran `app/running-history/`** : « Historique & progression » (onglet Course, entrée gatée `runningActive`) — **stats** (sélecteur Semaine/Mois/Début), **courbe d'allure** (`ProgressLineChart`, sélecteur 30/90 j + libellé de **tendance**), **liste chronologique** (date/distance/durée/allure) → détail existant `run/summary?id=`. État de chargement (loader) + état vide. i18n `running.history.*` FR/EN. Route enregistrée dans `app/_layout.tsx`.

### Technique / Notes
- **Lecture seule / offline-first** : uniquement des lectures `useQuery` ; aucune écriture, aucune migration, aucune sync rule, `runs` intacte. **Charts déjà présents** (`react-native-gifted-charts`) → aucun nouveau module natif, **pas de rebuild**.
- **Périodes calendaires** (stats) vs **fenêtres glissantes** (courbe) ; dates en clés `AAAA-MM-JJ` (`localDayKey`), sans dérive fuseau. **Courbe globale** (pas par type — les courses libres n'ont pas de `session_type`). Manuel : compté en distance/temps/nombre ; dans la courbe seulement si une allure existe.
- **Limitation assumée** : l'axe Y de la courbe est numérique (allure en secondes de l'unité) — une **ligne descendante = progrès** ; le libellé de tendance + la liste donnent la valeur précise.
- **Hors périmètre / différé** : export GPX (5.33, incrément dédié + build) ; records d'allure + maj allure réf (5.30/5.31 → **R4b**) ; dénivelé (5.32, altitude non captée) ; découpage par type ; filtres de liste.
- Qualité verte (typecheck 3 workspaces / lint / shared 436 + mobile 29) ; parité i18n 678/678 ; 0 doublon de clé. **Pas de checkpoint 🔴 cloud.**

## 12/07/2026 — Running R3c-i : planning daté + séance manquée

_Branche : `feature/running-r3c1-planning`. Cadrage complet (spec+plan+maquette validés) puis code subagent-driven (revue spec + qualité par phase + revue finale = **Ready to merge**). Introduit la **première couche de planification datée** de l'app, générique et pilier-agnostique. **5.6 (coordination muscu↔running) différée** (dépend d'un planning muscu daté inexistant). **US data → checkpoint 🔴 cloud non encore appliqué (après R3a + R3b-i).**_

### Ajouté
- **`@wellness/shared`** : helpers de semaine dans `date.ts` (`startOfWeek`/`addDays`/`weekdayIndex`, convention **0=lundi**) + `planning.ts` (`generatePlannedSessions` — semaine type × durée → instances datées alignées sur le lundi de la semaine de départ, `isMissed`, schéma Zod `planRunningProgramInputSchema`). Purs, **testés** (date 8 + planning 15 tests).
- **Table générique `planned_sessions`** : migration `20260712110000_planned_sessions.sql` (instance datée référençant `programs`/`sessions` ; `scheduled_date` **date calendaire**, `status` planned/done/skipped, `week_index`, `completed_at` ; index `(owner_id, scheduled_date)` ; RLS `owner_id = auth.uid()` select/insert/update ; `alter publication powersync`) + schéma PowerSync local + sync rule bucket `user_data`. Le **pilier est hérité** de la séance/programme — jamais dupliqué.
- **`planned-session-repository.ts`** : `planRunningProgram(programId, { startDate, durationWeeks, dayAssignments })` — **une seule transaction** (soft-delete des instances `planned` du programme → génération → insertion → **activation inlinée**), **idempotente** (re-planifier remplace le futur+passé `planned`, conserve `done`/`skipped`), validée par Zod avant transaction + garde programme sans séances ; `useWeekPlan(weekStart)` (fenêtre 7 jours jointe au détail séance), `useMissedSessions()` (running, passées `planned`), `reschedulePlannedSession`/`skipPlannedSession`/`markPlannedSessionDone`.
- **Écrans** `app/running-programs/plan.tsx` (assistant : durée **obligatoire**, semaine de début JS pur ◀/▶ prochain lundi, affectation séance→jour, allures via profil R3a) et `app/running-planning/` (vue **semaine 7 jours** lun→dim, séances type/cible/allure via `useUnits`, jours de repos, **bannière séances manquées**, feuille d'actions Marquer faite / Reporter (aujourd'hui/demain/+7) / Sauter, état vide). Entrées « Planifier » (détail programme) et « Mon planning » (onglet Course). i18n `running.planning.*` + `common.weekday.*` FR/EN.

### Technique / Notes
- **`txInsert` extrait** de `program-repository.ts` vers `_sql.ts` (exporté, réutilisable) — muscu non régressé (`duplicateProgram` inchangé).
- **Dates calendaires** (`AAAA-MM-JJ`) partout, construites composant-par-composant (jamais `new Date('AAAA-MM-JJ')`) → aucune dérive fuseau/DST. Comparaison chronologique = lexicographique.
- **Pas de date-picker natif** (sélection JS pur) → aucun nouveau module natif, build standard.
- **Hors périmètre / différé** : coordination 5.6 (planning muscu daté requis) ; démarrer une course depuis une séance planifiée (lien tracker, R4) ; progression auto de volume ; décalage en cascade ; auto-détection « fait » via course libre ; intégration dashboard « séance du jour » running.
- Offline-first (écritures locales, UUID client, timestamps UTC, soft delete, réactif) ; qualité verte (typecheck 3 workspaces / lint / shared 423 + mobile 29) ; parité i18n 659/659 ; 0 doublon de clé.
- **Reste (🔴, avec Damien)** : appliquer la migration `20260712110000` sur le cloud (après R3a `…090000` + R3b-i `…100000`, ordre des timestamps) + déployer la sync rule `user_data` + `npm run db:types` (committer) + **vérif device** (planifier, vue semaine, reporter/sauter/fait, manquées, re-planif sans doublon, muscu intact, RLS 2 comptes, FR/EN, offline).

## 12/07/2026 — chore : `.easignore` (archive de build EAS allégée)

_Branche : `chore/easignore-build-archive`. Suite au constat que l'archive uploadée à EAS Build faisait **344 Mo** (upload ~5 min) alors que les sources trackées ne pèsent que ~5 Mo._

### Ajouté
- **`.easignore`** à la racine : exclut de l'archive de build tout ce qui est inutile (`node_modules/`, `.git/`, `.expo/`, caches, artefacts natifs, secrets, logs) **et** le non-build (`docs/`, `design/`, `supabase/`, `.claude/`, `.github/`, Markdown racine, bases `.db` de debug). Devrait ramener l'archive de ~344 Mo à quelques Mo → uploads bien plus rapides.

### Technique / Notes
- ⚠️ **`.easignore` remplace `.gitignore`** pour l'archive EAS (ne les combine pas) → il reprend les exclusions essentielles de `.gitignore` (node_modules, secrets, caches).
- **Ne pas exclure** `apps/admin/` ni `packages/*` : ce sont des **workspaces npm** dont le `package.json` doit rester présent pour que `npm ci` réussisse côté EAS.
- Prendra effet au **prochain build EAS** (aucun impact sur le build déjà réalisé aujourd'hui).

## 12/07/2026 — Running R3b-ii : bibliothèque de programmes de course

_Branche : `feature/running-r3b2-bibliotheque`. Cadrage (spec+plan+maquette) puis code subagent-driven (revue spec = **conforme**, revue qualité = **Approved**). Réutilise l'infra bibliothèque muscu (`owner_id NULL` + `status='published'`, bucket `shared_content`). **Aucune migration de schéma** ; seul ajout data = contenu seedé → checkpoint 🔴 cloud non encore appliqué (après R3a + R3b-i)._

### Ajouté
- **Filtre pilier sur `useProgramLibrary`** (`program-repository.ts`) : nouveau champ `ProgramLibraryFilters.pillar?` (signature `useProgramLibrary(filters?)` **inchangée** → appelants muscu intacts) ; quand fourni, ajoute une clause `p.pillar = ?` (paramètre lié). `duplicateProgram` confirmé : copie utilisateur **`is_active=0`** (non active, éditable).
- **Seed bibliothèque running** (`supabase/seed.sql`) : 3 programmes « starter » bilingues FR+EN (préfixe UUID dédié `e…`, `owner_id null`, `status='published'`, `pillar='running'`, idempotent `ON CONFLICT DO NOTHING`) — « 10 km en 8 semaines » (10k/débutant), « Prépa semi-marathon » (semi/intermédiaire), « Reprise en douceur » (endurance/débutant). Séances avec `session_type` + `target_distance_m` (respecte la check R3b-i).
- **Onglet « Bibliothèque »** dans `app/running-programs/index.tsx` (sélecteur `Segment` « Mes programmes » / « Bibliothèque ») : parcours des programmes publiés running via `useProgramLibrary({ pillar:'running', …filters })` + **barre de filtres** (objectif `RUNNER_OBJECTIVES`, niveau `beginner/intermediate/advanced`, durée) combinés en ET ; **carte** (nom + chips objectif/niveau/durée) ; bouton **« Utiliser »** → `duplicateProgram` (anti double-clic) → navigation vers le détail de la copie ; état vide. i18n `running.library.*` FR/EN.

### Technique / Notes
- **Muscu non régressé** : `useProgramLibrary()` sans `pillar` inchangé, écran `programs/index.tsx` hors diff. **Aucune nouvelle table, aucune sync rule modifiée** (`sessions`/`programs` déjà dans `user_data` + `shared_content`).
- **Micro-écart maquette↔code** (non bloquant, à arbitrer produit) : le **résumé** du programme n'est pas affiché sur la carte (comme l'écran muscu de référence — `ProgramListItem` ne remonte pas `summary`) ; soit l'ajouter aux deux écrans dans un incrément cohérent, soit mettre à jour la maquette.
- Offline-first ; qualité verte (typecheck 3 workspaces / lint / 400 shared + 29 mobile) ; parité i18n (617/617) ; 0 doublon de clé (2 clés mortes `used`/`filters` retirées après revue).
- **Reste (🔴, avec Damien)** : appliquer le **seed running** sur le cloud **après R3a + R3b-i** (les séances utilisent les colonnes running de R3b-i) — `db:types` non requis (pas de schéma changé) — puis **vérif device** (les 3 programmes apparaissent via `shared_content`, filtres OK, « Utiliser » → copie éditable non active, muscu intact, FR/EN, offline).
## 12/07/2026 — US 4.34 + 4.35 : détail d'une entrée & suivi de micronutriments (+ fix double encodage)

_Branche : `feature/nutrition-detail-suivi-micros` (depuis `origin/dev`, commit précédent `733347c`). Cadrage (spec + plan), code, **test en direct sur device (Pixel, adb)** → bug de double encodage JSON trouvé et corrigé. **100 % client, aucune migration, aucun checkpoint cloud 🔴.**_

### Ajouté
- **4.34 — Détail d'une entrée de journal** : taper un aliment journalisé ouvre un **modal** (nom, quantité, `kcal` + P/G/L, puis micronutriments **de la quantité**, via `MicronutrientDetails`). L'appui long (suppression) est conservé. Écran [(tabs)/nutrition.tsx](<apps/mobile/src/app/(tabs)/nutrition.tsx>) (composant `EntryDetailModal`).
- **4.35 — Suivi de micronutriments dans le récap** : sélection de micros à suivre (chips sur les 10 clés) dans le **profil nutritionnel** ; **totaux du jour** des micros suivis affichés sous les barres P/G/L (+ sel dérivé si sodium suivi), réactifs (`sumMicronutrients`). Sélection persistée en **préférence locale (device)** via un **store Zustand** [tracked-micros.ts](apps/mobile/src/stores/tracked-micros.ts) + `secure-storage` (hydratée au boot dans [_layout.tsx](apps/mobile/src/app/_layout.tsx)).
- **`MicronutrientDetails`** : prop **`showPer100`** (défaut `true`) — masque la ligne « pour 100 g » quand les valeurs sont déjà un snapshot mis à l'échelle (détail d'entrée).
- **i18n** FR/EN (4 clés) : `journal.detail.{quantity, close}`, `nutrition.micros.tracked.{title, hint}`. Parité **616/616**.

### Corrigé
- **🐛 Micronutriments vides pour les données écrites côté client** (détail d'entrée, aliments importés d'OpenFoodFacts) : **`parseMicronutrients`** ([food.ts](packages/shared/src/food.ts)) est désormais **tolérant au double encodage**. **Cause racine** (diagnostiquée en interrogeant la base SQLite du device) : **PowerSync/op-sqlite stocke les colonnes texte-JSON écrites côté client en double encodage** (une string JSON dans une string JSON), alors que les données synchronisées du serveur (seed) sont en simple encodage. `parseMicronutrients` ne faisait qu'un `JSON.parse` → obtenait une string → renvoyait `{}`. Il parse maintenant **jusqu'à 2 fois**. Test ajouté ([food.test.ts](packages/shared/src/food.test.ts)).

### Technique / Notes
- **⚠️ Double encodage systémique** : le même phénomène touche **toutes** les colonnes texte-JSON écrites côté client (`active_pillars`, `notifications`, `portions` d'aliments perso, etc.). Les lecteurs existants (`parseJsonColumn`, `parsePortions`) font un seul `JSON.parse` → ils tolèrent le serveur mais **pas** le client (certains « marchent » par coïncidence via `String.includes`, d'autres perdent silencieusement la donnée). **À traiter globalement** dans un lot dédié (helper de parse tolérant partagé + revue des writers), hors périmètre de cette US.
- **Préférence micros suivis = locale (device), non synchronisée** entre appareils (assumé cloud-free ; promotion vers `user_settings` = migration ultérieure).
- **Détail = snapshot** (grams=100 sur `MicronutrientDetails` ⇒ valeurs affichées = quantité journalisée, pas de ligne « pour 100 g »).
- Vérifs : typecheck ✅ · lint 0 erreur ✅ · tests **401** ✅ (+1 double encodage) · i18n 616/616 ✅. **Validé device** (Pixel) : détail micros OK après fix, suivi micros dans le récap OK (Mg 32 / K 430 = total du jour).

## 12/07/2026 — US 4.7 + 4.18 : finitions Nutrition (calories jour de séance · copier une journée)

_Branche : `feature/nutrition-finitions-4.7-4.18` (depuis `origin/dev`, commit précédent `a2373a8`). Cadrage (spec + plan), code, vérifs vertes. Branche deux fonctions **déjà écrites mais inaccessibles** ; **100 % client, aucune migration, aucun nouveau build natif** (pas de checkpoint 🔴 cloud)._

### Ajouté
- **4.7 — Calories des jours d'entraînement** : l'objectif calorique du jour est **rehaussé du bonus** quand le jour porte au moins une **séance muscu OU une course terminée** (décision produit 12/07 : détection **rétroactive**, faute de planning muscu daté). Nouveau hook réactif **`useIsTrainingDay(dayKey)`** ([dashboard-repository.ts](apps/mobile/src/data/repositories/dashboard-repository.ts)) composé de `useWorkoutHistory` + `useRunHistory` (aucune SQL directe ; `finishedAt` UTC ramené au jour local via `localDayKey`).
- **Réglage du bonus** dans l'écran profil nutritionnel ([nutrition-profile.tsx](apps/mobile/src/app/nutrition-profile.tsx)) : champ « Bonus jour d'entraînement (kcal) », `parseBonus` (entier ≥ 0, `0`/vide = **désactivé**).
- **Badge** « +X kcal · jour de séance » sous la ligne calories, dans le **journal** ([(tabs)/nutrition.tsx](<apps/mobile/src/app/(tabs)/nutrition.tsx>)) et le **widget dashboard** ([NutritionSummaryCard.tsx](apps/mobile/src/components/dashboard/NutritionSummaryCard.tsx)).
- **4.18 — Copier une journée** : bouton « Copier toute la journée d'hier » (branché sur `duplicateDay`, déjà présent au repo), rendu **uniquement si le jour affiché est vide** ; alerte « rien à copier » si la veille est vide. Distinct du « Copier hier » **par repas** existant.
- **i18n** FR + EN (6 clés miroir) : `journal.{copyDayYesterday, nothingYesterdayFull, trainingDayBadge}`, `nutrition.calories.{trainingBonus, trainingBonusHint}`, `home.nutrition.trainingDayBadge`. Parité vérifiée **612/612**.

### Modifié
- **`useNutritionSummary`** expose désormais `effectiveTarget` (base + bonus), `isTrainingDay`, `trainingBonus` ; `target` reste l'objectif **de base** (référence des macros cibles). Le journal utilise `effectiveTarget` pour l'objectif affiché **et** le « restant ».

### Technique / Notes
- **Macros cibles calées sur l'objectif de base** : le bonus est un supplément **calorique non ventilé** en P/G/L (assumé MVP — évite d'inventer une répartition).
- **Détection rétroactive assumée** : l'objectif monte **après** l'enregistrement de la séance ; passera en anticipé quand le planning muscu (US2b) existera.
- Sur le dashboard, `useNutritionSummary` charge maintenant l'historique séances/courses via `useIsTrainingDay` **en plus** de `useStreakData` (déjà présent) — coût négligeable (requêtes locales PowerSync).
- Vérifs : typecheck (3 workspaces) ✅ · lint 0 erreur (4 warnings pré-existants hors périmètre) ✅ · tests **400** ✅. `trainingDayCalories`/`duplicateDay` déjà couverts/écrits en amont — aucune nouvelle logique pure.
- **Reste** : recette device (checklist : bonus + séance → objectif+badge réactif journal/accueil ; jour vide → copie ; bonus 0 → aucun badge ; FR/EN).

## 12/07/2026 — Running R3b-i : programme de course custom

_Branche : `feature/running-r3b1-programme-custom`. Cadrage (spec+plan+maquette) puis code subagent-driven (revues par phase + revue finale = **Approved for merge**). Réutilise l'infra programmes muscu (pilier-aware). **US data → checkpoint 🔴 cloud non encore appliqué (après R3a).**_

### Ajouté
- **`packages/shared/src/running-paces.ts`** : `PROGRAM_SESSION_TYPES` (4 types, course libre exclue) + `hasRunningSessionTarget(distanceM, durationS)`. Testés (400 shared).
- **Contenu de séance running** sur la table partagée `sessions` : migration `20260712100000_running_session_content.sql` (colonnes nullables `session_type`/`target_distance_m`/`target_duration_seconds` + **check conditionnelle** `session_type is null or au moins une cible` — les séances muscu passent toujours) + schéma PowerSync local.
- **`program-repository.ts`** : `updateRunningSession`, `updateProgram`, `updateProgramTranslation` (upsert traduction par langue) ; `SessionDetail` étendu (champs running nullables) ; `duplicateProgram` **étendu** (recopie le contenu running) ; `useMyPrograms(pillar?)` (filtre pilier optionnel).
- **Écrans `app/running-programs/`** : liste (« Mes programmes de course »), détail (métadonnées + séances : type, cible, **allure dérivée du profil R3a** via `sessionTargetPace`+`useUnits`), éditeur (création + composition) ; composant **`RunningSessionEditor`** (type + cible distance km/durée min + allure affichée + validation cible). Entrée « Mes programmes de course » dans l'onglet Course (si pilier running actif). i18n FR/EN.

### Technique / Notes
- **Réutilisation** de `programs` (`pillar='running'`, `goal`=objectif, `level`=beginner/intermediate/advanced) / `sessions` / `program_translations` — **aucune nouvelle table**. **Muscu non régressé** (fichiers `programs/*` hors diff, colonnes nullables, `useMyPrograms()` sans arg inchangé).
- **Blocs d'intervalles différés** (fractionné = type + cible + allure, sans structure) ; **bibliothèque + filtres + seed = R3b-ii** ; **planning = R3c** ; démarrer une course depuis une séance = différé.
- Offline-first ; qualité verte (typecheck 3 workspaces / lint / 400 shared + 29 mobile) ; parité i18n ; 0 doublon de clé.
- **Reste (🔴, avec Damien)** : appliquer la migration cloud **après R3a** (ordre des timestamps `…090000` → `…100000`), `npm run db:types`, puis **vérif device** (créer/activer/dupliquer un programme, allures affichées, muscu intact, RLS, FR/EN, offline).

## 11/07/2026 — Running R3a : profil coureur + types de séance (allures)

_Branche : `feature/running-r3a-profil-types`. Cadrage (spec+plan+maquette) puis code subagent-driven (revues par phase + revue finale = **Approved for merge**). Premier incrément de R3 (R3a/R3b/R3c). **US data → checkpoint 🔴 cloud non encore appliqué.**_

### Ajouté
- **`packages/shared/src/running-paces.ts`** : enums `RUNNER_OBJECTIVES` / `RUNNER_LEVELS` / `SESSION_TYPES` (+ schémas Zod), `VMA_COEFFICIENT = 0.95`, `derivedVmaPace`, `sessionTargetPace(type, ref5kPaceSPerKm)` → plages `{minSPerKm,maxSPerKm}` (endurance réf+60-90, sortie longue +30-60, récup +90-120, fractionné 95-100 % VMA ; `course_libre` → null). Purs, testés.
- **`packages/shared/src/units.ts`** : `parsePaceToSPerKm(text, system)` (saisie « M:SS » → s/km, garde de plausibilité 2:30–12:00 /km) + `formatPaceValue`. Tests (394 shared au total).
- **Table `running_profiles`** (1 ligne/utilisateur) : migration `supabase/migrations/20260712090000_running_profiles.sql` (colonnes scalaires + CHECK enum/fréquence + RLS `user_id = auth.uid()` + `alter publication powersync`), sync rules (bucket `user_data`), schéma PowerSync local.
- **`running-profile-repository.ts`** : `useRunnerProfile()` réactif + `upsertRunnerProfile()` (patron nutrition).
- **`useUnits`** : `parsePace` / `paceInputValue` (saisie/pré-remplissage d'allure).
- **Écran `running-profile.tsx`** : objectif / niveau / allure de réf (5 km, saisie M:SS) / fréquence + section « Mes allures d'entraînement » (plages via `useUnits`, min/km ou min/mi). Route modale + entrée « Profil coureur » dans Réglages (si pilier running actif). i18n FR/EN.

### Technique / Notes
- **Découpage R3** : R3a (profil + types/allures) *livré* · R3b (programmes : custom/bibliothèque/filtres) · R3c (planning + coordination + séance manquée) — à venir.
- **VMA dérivée** de l'allure 5 km (coeff. 0.95) ; **allures en plages** ; **récup +90-120** (plafond d'affichage assumé — running.md §4.4 dit « +90 ou plus », à confirmer produit). FCmax = V2.
- **Offline-first** ; qualité verte (typecheck 3 workspaces / lint / 394 shared + 29 mobile) ; parité i18n ; 0 doublon de clé.
- **Reste (🔴 checkpoint cloud, avec Damien)** : confirmer le **timestamp de migration** (`20260712090000`, > `20260711140000`), appliquer la migration sur le cloud, déployer les sync rules, `npm run db:types` (régénérer `database.types.ts`), puis **vérif device** (édition profil + sync + RLS + allures + FR/EN + offline).
- Point mineur (revue) : course théorique de double-insert au 1er remplissage (même patron que nutrition, couverte par la contrainte `unique` au cloud) — durcissement possible ultérieurement.

## 11/07/2026 — Running R2 : carte du parcours (MapLibre + MapTiler)

_Branche : `feature/running-r2-carte`. Cadrage (spec+plan+maquette) puis code subagent-driven (revues par phase + revue finale = **Approved for merge**, 1 point i18n corrigé). Décision fournisseur : [ADR-006](docs/adr/ADR-006-cartographie.md)._

### Ajouté
- **`packages/shared/src/geo.ts`** : `simplifyTrack(points, epsilonMeters): GpsPoint[]` — **Douglas-Peucker** (distance perpendiculaire en mètres, projection équirectangulaire), conserve `.t`, préserve les extrémités. Pur, testé (367 tests shared). Simplification **à l'affichage uniquement** — la trace stockée reste complète.
- **`@maplibre/maplibre-react-native@^11`** + config plugin `app.json` ([ADR-006](docs/adr/ADR-006-cartographie.md)). Module natif → **nouveau dev/preview build requis**.
- **`apps/mobile/src/lib/map.ts`** : `hasMapKey` + `MAP_STYLE_URL` (style **outdoor** MapTiler) depuis `EXPO_PUBLIC_MAPTILER_KEY` (env, jamais committée ; ajoutée à `.env.example`).
- **`apps/mobile/src/components/running/RouteMap.tsx`** : composant réutilisable (MapLibre v11 `Map`/`Camera`/`GeoJSONSource`/`Layer`). Tracé (LineString, couleur accent) + marqueur de position ; `follow` (caméra suit le dernier point) vs fit-bounds (résumé). États sans crash : clé absente → « Carte indisponible » ; sans point → `emptyLabel` (attente GPS / manuel) ; 1 point → marqueur seul ; attribution © OSM/© MapTiler conservée.
- i18n `running.map.{awaitingGps,noTrack,unavailable}` (FR + EN).

### Modifié
- **`run/active.tsx`** : carte **live** (`follow`) sous les allures — tracé simplifié en temps réel.
- **`run/summary.tsx`** : carte **statique** (fit-bounds) entre métriques et RPE — décode `run.gpsTrack`.
- **`run-repository.ts`** : `RunDetail.gpsTrack` exposé (3 changements coordonnés : `SELECT_RUN_BY_ID` + `RunDetailDbRow` + type/mapper).

### Technique / Notes
- **Tuiles en ligne au MVP** ; le **tracking GPS reste 100 % offline** (inchangé). Aucune migration, aucun impact sync. Pas de checkpoint 🔴 cloud (mais **dev/preview build requis** pour le module natif).
- Qualité : typecheck (3 workspaces) / lint (0 erreur, 4 warnings pré-existants) / tests (367 shared + 29 mobile) verts ; parité i18n FR/EN ; 0 doublon de clé.
- **Reste** : recette device (build + clé MapTiler à fournir). Différé : tuiles offline, sélecteur de style, marqueurs km, export GPX (R4). Profil coureur/programmes = R3.

## 11/07/2026 — ADR-006 : fournisseur de cartographie (MapLibre + MapTiler)

_Branche : `docs/adr-006-cartographie`. Décision d'architecture (débloque Running R2)._

### Ajouté
- **[docs/adr/ADR-006-cartographie.md](docs/adr/ADR-006-cartographie.md)** : tranche le point ouvert « Mapbox vs MapLibre ». **Décision : MapLibre** (`@maplibre/maplibre-react-native`, open-source BSD, sans token, coût maîtrisé, RGPD-friendly, offline, cross-platform) **+ MapTiler** (palier gratuit) comme source de tuiles pour démarrer R2. Comparatif, justification, pistes d'évolution (Stadia EU / Protomaps auto-hébergé sur Supabase Storage).

### Modifié
- **[architecture.md](docs/specs/technical/architecture.md)** : table stack + point ouvert « Fournisseur de cartes » → **fermé** (MapLibre + MapTiler, réf. ADR-006).
- **[roadmap.md](docs/roadmap/roadmap.md)** : 5.17 + décision pré-V0.5 → MapLibre + MapTiler.
- **[TODO.md](TODO.md)** : Running R2 **débloqué** (décision carte tranchée) ; prochaine étape = cadrage R2.

## 11/07/2026 — US 7.4–7.7 : dashboard d'accueil « live » (MVP)

_Branche : `feature/7.4-7.7-dashboard-live` (commit précédent : `fa5d222`). Cadrage (spec+plan+maquette) puis 11 commits de code, exécution subagent-driven (par phase : implémenteur → revue conformité → revue qualité), revue finale consolidée = **Approved for merge**._

### Ajouté
- **`packages/shared`** : `date.ts` (`localDayKey` — clé de jour local `AAAA-MM-JJ`) et `streak.ts` (`computeStreak(activeDays, todayKey)` **pur, `today` en paramètre**, arithmétique de jours **anti-DST** via `Date.UTC` ; `DayActivity` + `activeDayKeys`). Tests Vitest (362 verts au total).
- **`apps/mobile/src/data/repositories/dashboard-repository.ts`** : hooks d'agrégation réactifs composant les repos existants — `useNextSession` (prochaine séance du programme muscu actif / séance en cours), `useStreakData` (agrège séances muscu + courses running + journées nutrition en `DayActivity[]` → streak + pastilles semaine L→D), `useNutritionSummary` (totaux du jour + objectif `tdee`/`targetCalories`).
- **Widgets** `apps/mobile/src/components/dashboard/` : `TodaySessionCard`, `NutritionSummaryCard`, `StreakCard`, `WeightCard` (poids via `useUnits().formatWeight` → kg/lb). `DashboardCard` extrait en composant partagé ([components/DashboardCard.tsx](apps/mobile/src/components/DashboardCard.tsx)).
- Smoke test `jest-expo` de `StreakCard` (garde-fou anti double-nombre + états vide/loading).

### Modifié
- **[app/(tabs)/index.tsx](apps/mobile/src/app/(tabs)/index.tsx)** : l'accueil placeholder devient un dashboard **live** — widgets conditionnés aux piliers actifs (décision H), max 4 blocs, temps réel (`useQuery` PowerSync). Démarrer une séance passe par `startWorkoutFromSession(id)` (pré-remplit les exercices).
- **i18n** `home.*` (FR + EN miroir) : nouvelles clés séance/nutrition/streak/poids.

### Supprimé
- Message « le journal alimentaire arrive bientôt » (`home.nutrition.empty`) et clés placeholder devenues inutiles (`home.streak.count_*`) — grep = 0 référence.

### Corrigé (en cours de revue)
- Séance démarrée depuis le dashboard : lançait une séance **libre** au lieu de la séance **planifiée** → corrigé (`startWorkoutFromSession`).
- `StreakCard` affichait le nombre **en double** (grand chiffre + `{{count}} jours`) → clé `home.streak.suffix` sans le compte.

### Technique / Notes
- **Décisions MVP validées (H1–H4)** : séance = prochaine séance du programme (pas de planning hebdo) ; jour actif nutrition = ≥ 1 repas ; pas de « jour de repos neutre » ; widget Poids si pilier nutrition actif.
- **100 % client / offline-first** — aucune migration, aucune sync rule. i18n : 0 doublon de clé, parité FR/EN 535/535. typecheck (3 workspaces) / lint / tests (362 shared + 29 mobile) verts.
- **Reste** : recette device (build). Écarts maquette assumés/conformes spec : flèche de tendance poids sans la valeur ; sous-titre d'en-tête = nom de l'app.

## 11/07/2026 — US 4.33 : activation cloud (types régénérés)

_Branche : `feature/4.33-micronutriments` (commit précédent : `33ea91f`). Migration
`20260711140000_food_micronutrients.sql` **appliquée sur le cloud** par Damien._

### Modifié
- **`packages/shared/src/database.types.ts`** régénéré depuis le cloud (`supabase gen types
  --project-id …`) : inclut `foods.micronutrients` et `food_entries.micronutrients` (`Json`).
  typecheck (3 workspaces) vert.

### Technique / Notes
- **Sync rules** inchangées (streams en `select *`). **Reste** : re-seed cloud des 7 aliments
  enrichis (bloc `update … set micronutrients` de `seed.sql`, à exécuter dans le SQL editor) +
  **vérif device**.

## 11/07/2026 — US 4.33 : micronutriments (socle) + rangement du dossier design

_Branche : `feature/4.33-micronutriments` (commit précédent : `e26596b`). Spec + plan + maquette
(Claude Design) + implémentation TDD d'un seul tenant (workflow US complet)._

### Ajouté
- **Spec & plan** : [docs/specs/functional/us/4.33-micronutriments.md](docs/specs/functional/us/4.33-micronutriments.md)
  et [docs/plans/4.33-micronutriments.md](docs/plans/4.33-micronutriments.md). Décisions validées :
  **panel socle ciblé** (10 champs), **stockage JSON** `micronutrients`, **snapshot** dans le journal.
- **Maquette** [design/FitTrio - Micronutriments.dc.html](design/) (Claude Design) : détail aliment
  (accordéon « Valeurs détaillées ») + aliment perso (saisie micros), clair & sombre, états vide/partiel.
- **`packages/shared/src/food.ts`** (+18 tests) : `MICRONUTRIENT_KEYS` (cholesterol_mg, sodium_mg,
  magnesium_mg, potassium_mg, calcium_mg, iron_mg, vitamin_c_mg, vitamin_d_ug, vitamin_b9_ug,
  vitamin_b12_ug), `micronutrientsSchema` (écriture stricte), `parseMicronutrients` (lecture tolérante
  → `{}` sur JSON invalide, clés hors panel/valeurs ≤0 ignorées), `scaleMicronutrients`,
  `sumMicronutrients`, `saltFromSodiumMg` (sodium×2,5/1000, 2 déc.). Colonne `micronutrients` (défaut
  `{}`) sur `foodRowSchema` **et** `foodEntryRowSchema`.
- **Composant `MicronutrientDetails`** : accordéon repliable, 3 groupes (lipides/minéraux/vitamines),
  valeur pour la quantité + pour 100 g, **sel dérivé** sous le sodium, **état vide** ; n'affiche que les
  nutriments **présents** (jamais `0` par défaut). Intégré au `QuantityPanel` (partagé picker + scan).
- **Aliment perso** : bloc repliable **facultatif** de saisie des 10 micros (`food-custom.tsx`).
- **Migration** [`20260711140000_food_micronutrients.sql`](supabase/migrations/20260711140000_food_micronutrients.sql) :
  `foods.micronutrients` + `food_entries.micronutrients` en `jsonb not null default '{}'` (additif,
  rétrocompatible). Seed enrichi de **7 aliments bruts** (valeurs pour 100 g d'après CIQUAL ; épinards =
  valeurs de la maquette) — les autres gardent `{}`.
- **i18n** FR + EN (miroir, `nutrition.micros.*`, parité 520/520).
- **Tests** : `mapOffMicronutrients` (+3, `apps/mobile/src/lib/__tests__/openfoodfacts.test.ts`).

### Modifié
- **`lib/openfoodfacts.ts`** : `mapOffMicronutrients` extrait/normalise les micros du bloc `nutriments`
  (grammes OFF → mg ×1000 / µg ×1e6, alias `folates_100g` pour la B9), ajoutés à `OffFood` → import.
- **`powersync/schema.ts`** : colonne `micronutrients` (text/JSON) sur `foods` et `food_entries`.
- **Repos** : `food-repository` (lecture `parseMicronutrients`, écriture perso/OFF) ; `journal-repository`
  (**snapshot** figé à l'ajout/édition + transport dans copyMeal/duplicateDay).
- **`food-picker` / `food-scan`** : figent `scaleMicronutrients(micros, grammes)` dans le snapshot d'entrée.

### Supprimé
- **Rangement `design/`** : double emboîtement `prototype-d-application-markdown/` aplati (nouveautés
  remontées) ; doublons/brouillons supprimés (`dark.html`, `dark2.html`, `FitTrio.dc (1).webp`,
  `download.md`, `.gitkeep`) ; `Architecture Applicative (1).jpg` → `Architecture Applicative.jpg` ;
  note obsolète du `design-system.md` corrigée + inventaire à jour.

### Technique / Notes
- **Rétrocompatible** : colonne à défaut `'{}'`, aucune donnée existante impactée. **Sync rules : rien à
  faire** (streams `foods`/`food_entries` en `select *`). Stockage micros = pour 100 g sur `foods`, figés
  pour la quantité sur `food_entries` (cohérent avec la règle de non-recalcul de l'historique).
- typecheck (3 workspaces) / lint (0 err) / test (354 shared + 26 mobile) verts.
- **Reste (checkpoint 🔴)** : appliquer migration + re-seed sur le cloud + `db:types` ; **vérif device**
  (lecture micros, snapshot journal, import OFF avec/sans micros, offline, sync, FR/EN). **Point
  d'attention** : (a) enrichissement seed limité à 7 aliments — compléter d'après l'**export CIQUAL réel**
  (ne pas inventer de valeurs) ; (b) **normalisation d'unité OFF** (hypothèse g→mg/µg) à confirmer sur
  quelques produits réels au test device. **Différé** : agrégat micros du jour, objectifs/RDA, micros
  dans recettes/repas types, panel étendu.

## 09/07/2026 — US 1.15 : implémentation affichage & saisie des unités (métrique/impérial)

_Branche : `feature/1.15-unites-metrique-imperial` (commit précédent : `a7822fb`). 16 commits (`0d1df62` → `379a7cc`), exécution subagent-driven (implémenteur → revue spec → revue qualité par phase)._

### Ajouté
- **`packages/shared/src/units.ts`** (+ `units.test.ts`, 343 tests verts) : `cmToFtIn`/`ftInToCm` (+ `CM_PER_IN`), `paceToSystem`/`formatPaceMMSS` (allure s/km↔s/mi → `M:SS`), parseurs de saisie `parseWeightToKg`/`parseDistanceToKm`/`heightPartsToCm` (texte→SI, virgule/point, vide/invalide/≤0/notation scientifique → `null`). `LB_PER_KG`/`MI_PER_KM` exportées.
- **`apps/mobile/src/hooks/useUnits.ts`** (+ smoke test jest-expo metric/imperial × FR/EN) : hook mince liant `useSettings().units` + locale i18n à `units.ts` ; `formatWeight`/`formatDistance`/`formatHeight`/`formatPace` (via `Intl.NumberFormat`), symboles, parseurs liés, pré-remplissages `weightInputValue`/`distanceInputValue`/`heightPartsFromCm`, convertisseurs numériques `toWeightValue`/`toDistanceValue`/`formatDistanceValue` (pour les axes de courbes). Aucune conversion dans le hook (délègue à shared).

### Modifié
- **Affichage branché sur le hook** (plus aucune unité codée en dur) : `workout.tsx` (en-tête + saisie charge), `workout-summary.tsx` (volume + records), `history/[id].tsx` (séries/records/volume), `progress/index.tsx` (records + **séries de courbes converties**, axe = symbole), `programs/[id].tsx` (PlanRow), `nutrition-stats.tsx` (poids + **courbe de poids convertie**), `run/active.tsx` & `run/summary.tsx` (distance + allure).
- **Saisie reconvertie en SI** : charge de série (`workout.tsx`), charge cible programme (`components/programs/ExercisePlanEditor.tsx`), distance manuelle (`run/summary.tsx`), pesée (`nutrition-stats.tsx`), **poids + taille** (`(onboarding)/infos.tsx`, `profile.tsx`) avec **taille = 1 champ cm (métrique) / 2 champs ft+in (impérial)**.
- **Anti-dérive d'arrondi** sur les champs à valeur stockée (`profile.tsx`, `ExercisePlanEditor.tsx`) : chaîne initiale mémorisée (`useRef`) ; si le champ n'est pas modifié, on réécrit le **SI d'origine** (jamais `parse(display(SI))`).
- **i18n FR+EN (miroir, 495 clés chacune)** : symboles sortis des chaînes ; gabarits `{{kg}} kg` → `{{weight}}` (valeur pré-formatée) ; placeholders d'exemple par unité.

### Supprimé
- Clés i18n devenues inutiles (grep = 0 réf) : `running.active.kmUnit`/`paceUnit`, `progress.unit.kg`, `programs.edit.targets.weightPlaceholder`, et l'orpheline `history.row.volumeKg`. `formatPace` locales + styles orphelins des écrans run.

### Corrigé
- **Collision de clé JSON `workout.set`** (en-tête de colonne « Série/Set » cassé, rendait la clé brute) : les placeholders avaient été ajoutés comme objet `workout.set.*`, écrasant la chaîne `workout.set`. Placeholders déplacés en `workout.weightPlaceholderMetric/Imperial`. Détecté par la revue finale ; scan anti-doublon des 2 locales = 0 collision.

### Technique / Notes
- **Stockage 100 % SI** (kg/km/cm) — aucune migration, aucun impact sync/offline/PowerSync. Unités **découplées de la langue**.
- **Revues** : Phases A & B revues par phase (spec + qualité, avec durcissements) ; Phase C+D revue consolidée finale (1 bloquant corrigé = la collision `workout.set`). `typecheck` (3 workspaces) / `lint` / `test` (343 shared + 23 mobile) verts. Parité FR/EN 495/495.
- **Reste (Task 14 DoD)** : recette manuelle sur device (bascule metric↔imperial réactive, FR+EN, round-trip saisie, taille ft/in, anti-dérive) — **nécessite un build**. US validable **sans activation cloud** (pas de 🔴).
- Rebord UX connu (non bloquant) : le champ charge de série en impérial ré-affiche la valeur reconvertie à chaque frappe (`.toFixed(1)`) — à confirmer sur device, bascule possible vers le patron état-local si gênant.

## 09/07/2026 — US 1.15 : cadrage (spec + plan) affichage & saisie des unités (métrique/impérial)

_Branche : `feature/1.15-unites-metrique-imperial` (commit précédent : `c2c0e84`)_

### Ajouté
- **[docs/plans/1.15-unites-metrique-imperial.md](docs/plans/1.15-unites-metrique-imperial.md)** :
  plan d'implémentation de l'US 1.15 (14 tâches TDD). Approche A validée : logique pure étendue
  dans `packages/shared/src/units.ts` (conversions taille cm↔ft/in, allure s/km↔s/mi + format
  `M:SS`, parseurs de saisie tolérants vide→`null`) + hook mince `apps/mobile/src/hooks/useUnits.ts`
  (formateurs/parseurs liés au réglage `useSettings().units` et à la locale i18n via
  `Intl.NumberFormat`) ; branchement de 12 écrans (affichage + saisie) ; refonte des clés i18n
  porteuses d'unité (FR+EN miroir) ; anti-dérive d'arrondi par champ ; garde-fou grep.
- Pour mémoire, la **spec** correspondante ([docs/specs/functional/us/1.15-unites-metrique-imperial.md](docs/specs/functional/us/1.15-unites-metrique-imperial.md))
  avait été commitée en `c2c0e84` (non encore tracée ici) : elle est consignée avec ce commit.

### Technique / Notes
- **Décisions de cadrage** : stockage **toujours en SI** (aucune migration/sync/PowerSync) →
  **US 100 % client, validable sans activation cloud** (pas de checkpoint 🔴). Unités **découplées
  de la langue**. Seul vrai changement d'UI de saisie : la **taille** (1 champ `cm` en métrique →
  2 champs `ft` + `in` en impérial).
- **Workflow** : spec ✔ → plan ✔ (revu par un plan-document-reviewer : *Approved*) → maquette
  **écartée** (option 2, changement d'UI mineur, validé par Florian le 09/07/2026) → **code à suivre**.

## 09/07/2026 — V0.4 US4.10 : scan code-barres nutrition (OpenFoodFacts)

_Branche : `feature/4.10-scan-code-barres` (commit précédent sur `dev` : `c26abe2`)_

### Ajouté
- **Scan de code-barres (4.10)** : ajout d'un aliment au journal en scannant son EAN/UPC.
  - **`expo-camera`** (`~57.0.1`) + config plugin dans [app.json](apps/mobile/app.json)
    (`cameraPermission` FR). **Module natif → nécessite un nouveau dev build.**
  - **[lib/openfoodfacts.ts](apps/mobile/src/lib/openfoodfacts.ts)** : `fetchOpenFoodFactsByBarcode`
    (API produit v2, garde le code numérique EAN/UPC, `null` si introuvable/hors-réseau ; constantes
    d'URL/headers/fields factorisées avec la recherche texte existante).
  - **[food-repository.ts](apps/mobile/src/data/repositories/food-repository.ts)** :
    `findFoodByBarcode` — lookup **local** (lecture ponctuelle) pour réutiliser un produit déjà
    importé et **éviter un doublon** avant d'interroger le réseau.
  - **Écran [food-scan.tsx](apps/mobile/src/app/food-scan.tsx)** (modale) : caméra + cadre de visée,
    machine à états (scan → résolution → quantité / introuvable), gestion de la permission,
    verrou anti double-scan. Résolution : local d'abord, puis OpenFoodFacts, puis état « introuvable »
    (rescan / créer un aliment). Ajout au journal via `addFoodEntry`, retour au journal (`dismissAll`).
  - Entrée **« Scanner »** dans le footer du food-picker (mode journal) + route déclarée dans
    [_layout.tsx](apps/mobile/src/app/_layout.tsx). i18n FR/EN (`scan.*`).

### Modifié
- **[food-picker.tsx](apps/mobile/src/app/food-picker.tsx)** : le `QuantityPanel` local est
  **extrait** en composant partagé [components/QuantityPanel.tsx](apps/mobile/src/components/QuantityPanel.tsx)
  (avec le type `PickTarget`), réutilisé par le picker et l'écran de scan (DRY).

### Technique / Notes
- Qualité : `typecheck` OK (3 workspaces), `lint` 0 erreur (4 warnings pré-existants hors périmètre),
  `test` **325** verts. Régénération des typed-routes Expo pour inclure la route `food-scan`.
- Pas de test unitaire ajouté : `fetchOpenFoodFactsByBarcode` (réseau) et `findFoodByBarcode`
  (module natif PowerSync) suivent la même convention que l'existant (`searchOpenFoodFacts`,
  repositories) → validés device.
- **Reste 🔴** : nouveau **dev build** (`expo-camera`) + **vérif device** (scan réel, permission
  refusée, produit absent d'OpenFoodFacts, offline).

## 09/07/2026 — chore(db) : CLI Supabase + régén des types depuis le cloud + activation cloud actée

_Branche : `chore/supabase-cli-db-types-cloud` (commit précédent sur `dev` : `e70e2df`)_

### Ajouté
- **Supabase CLI** en devDependency racine (`supabase@^2.109.1`) — les scripts `db:*` la résolvent
  via `npm run` (l'install globale npm est volontairement bloquée par Supabase). La génération de
  types depuis le **cloud** ne nécessite ni Docker ni Supabase local.

### Modifié
- **[package.json](package.json)** : le script `db:types` bascule de `--local` (exigeait Docker +
  une base Supabase locale) vers `--project-id nsxzflxsgovriwwvflxe` (génération depuis le **cloud**,
  source de vérité du projet). Corrige un **footgun** : `--local` sans Docker échouait en laissant
  la redirection `>` **vider `database.types.ts`**.
- **[packages/shared/src/database.types.ts](packages/shared/src/database.types.ts)** régénéré depuis
  le cloud — inclut désormais la colonne `meals` de `nutrition_profiles` (migration `20260707140000`),
  absente depuis le 06/07. Confirme que **le cloud est à jour** : toutes les migrations appliquées,
  publication `powersync` + sync rules déployées.
- **[TODO.md](TODO.md)** : section « infra cloud » requalifiée en **activation faite (09/07/2026)** ;
  correction de la mention périmée « sync rules **edition 3** » → format réel **`bucket_definitions`**
  (les Sync Streams `auto_subscribe` ne délivraient aucune donnée au client ; revert documenté en tête
  de [powersync-sync-rules.yaml](docs/specs/technical/powersync-sync-rules.yaml)). Reste = **vérif
  device** par pilier + validation terrain running.

### Technique / Notes
- Qualité : `lint` 0 erreur (4 warnings pré-existants hors périmètre, `charts-smoke.test.tsx`),
  `typecheck` OK (3 workspaces), `test` **325** verts.
- `--project-id` s'authentifie via le token Supabase déjà présent dans l'environnement ; **aucun
  secret committé** (le project-ref est public, présent dans l'URL de l'API).

## 09/07/2026 — Running R1 : correction du crash au lancement d'une course (permission Android)

_Branche : `fix/location-receive-boot-completed` (commit précédent : `d8b919e`)_

### Corrigé
- **[apps/mobile/app.json](apps/mobile/app.json)** : ajout de
  `android.permissions: ["android.permission.RECEIVE_BOOT_COMPLETED"]`. Sans cette permission,
  l'app **plantait quelques secondes après le démarrage d'une course** (puis en boucle à chaque
  relance) : à la 1ʳᵉ position GPS, `expo-location` (`LocationTaskConsumer`) demande à
  `expo-task-manager` de programmer un **job JobScheduler persistant** pour livrer la position à
  la tâche JS ; Android **exige** `RECEIVE_BOOT_COMPLETED` pour tout job persistant → sinon
  `IllegalArgumentException: Requested job cannot be persisted without holding ...RECEIVE_BOOT_COMPLETED`
  → `FATAL EXCEPTION` (process tué, `crashed too many times, killing!`).

### Technique / Notes
- **Diagnostic** : `adb logcat` sur l'APK **preview** installé sur un Pixel 6a (Android 14/15).
  Le foreground service démarrait correctement — la piste initiale « foreground service mal
  déclaré » était donc **fausse** ; c'est bien le job persistant de task-manager qui manquait la
  permission (trace : `TaskManagerUtils.scheduleJob` → `LocationTaskConsumer.reportLocationsImmediately`).
- En Expo (prebuild), `android.permissions` est **additif** avec les permissions injectées par les
  config plugins (`expo-location` : `FOREGROUND_SERVICE`, `ACCESS_BACKGROUND_LOCATION`, etc.) — celles-ci
  restent en place ; on ne fait qu'**ajouter** `RECEIVE_BOOT_COMPLETED`.
- **Nécessite un nouveau build** (`npm run build:dev` / `build:preview`) pour prendre effet : la
  permission est native, l'APK actuel ne peut pas être corrigé à chaud. Validation terrain à refaire.
- Qualité : `typecheck` **OK** (3 workspaces), `lint` **OK** (0 erreur ; 4 warnings pré-existants
  hors périmètre dans `charts-smoke.test.tsx`). Tests non exécutés (changement de config native
  `app.json`, sans impact possible sur les suites ; tests mobile non encore câblés).
- Hors périmètre volontairement laissé de côté : modif locale non commitée de `apps/mobile/eas.json`
  (bloc `env` `EXPO_PUBLIC_*`).

## 07/07/2026 — EAS : projet sous l'organisation Expo (owner → `wellness-appl`)

_Branche : `chore/expo-org-owner`_

### Modifié
- **[apps/mobile/app.json](apps/mobile/app.json)** : `owner` `damdamdeoh` → `wellness-appl`
  (organisation Expo), suite au **transfert** du projet EAS vers l'org (buildable à deux).
  `extra.eas.projectId` (`4d24d343-…ac689`) + `updates.url` **inchangés** (le transfert conserve
  le projectId) et cohérents entre eux.

### Technique / Notes
- Débloque le build par **Florian** (`florian935` invité dans l'org).
- Transfert **confirmé côté serveur** (`eas project:info` → `@wellness-appl/wellness-app`, même
  projectId). Le `owner` local encore à `damdamdeoh` provoquait un mismatch qui **bloquait toute
  commande `eas`** (`env:push` : « does not match owner specified in the "owner" field ») — d'où cette mise à jour.
- **Reste** (section URGENT TODO) : EAS Environment Variables `EXPO_PUBLIC_*` (preview + production
  = faites) ; confirmer un `eas build` sous l'org puis retirer la bannière.

## 07/07/2026 — Corrige le nom d'app dans les permissions de localisation (SparkWine → Wellness)

_Branche : `fix/app-name-location-permissions`_

### Corrigé
- **Permissions de localisation** ([app.json](apps/mobile/app.json)) : la popup système affichait
  « **SparkWine** utilise votre position… » (copier-coller d'un autre projet) au lieu de
  « **Wellness** ». Corrigé sur `locationAlwaysAndWhenInUsePermission` + `locationWhenInUsePermission`.

### Technique / Notes
- Seule occurrence dans le code suivi (l'artefact `android/…/app.config` est ignoré et se régénère).
- Prend effet au prochain build natif.

## 07/07/2026 — Corrige le bouton « Enregistrer » qui passait à la ligne (écran Suivi)

_Branche : `fix/weight-save-button-wrap`_

### Corrigé
- **Bouton « Enregistrer » (pesée, écran Suivi) tronqué sur 2 lignes** : le conteneur avait une
  largeur fixe `120` trop courte pour le libellé. Passé en `minWidth: 120` (le bouton s'adapte
  au texte, robuste aux traductions) — [nutrition-stats.tsx](apps/mobile/src/app/nutrition-stats.tsx).
- **Défensif** : `numberOfLines={1}` sur le libellé du composant [Button](apps/mobile/src/components/Button.tsx)
  — un libellé de bouton ne doit jamais wrapper sur 2 lignes (évite ce défaut ailleurs).

### Technique / Notes
- Trouvé en testant l'app sur device. `typecheck` + `lint` (0 erreur) + `test` (325 + 21) verts.
- Vérifié en live : le libellé tient désormais sur une seule ligne.

## 07/07/2026 — Corrige l'overflow de `food_entries.order_index` (sync PowerSync)

_Branche : `fix/food-entries-order-index-overflow`_

### Corrigé
- **Le journal alimentaire ne se synchronisait pas au cloud** : `addFoodEntry` écrivait
  `order_index: Date.now()` (epoch en **ms**, ≈ 1,78 × 10¹²), au-delà du `integer` Postgres
  de `food_entries.order_index` (max 2,147 × 10⁹). SQLite local l'acceptait (typage lâche,
  affichage OK) mais chaque upload PowerSync échouait — `value "…" is out of range for type
  integer` — et **rejouait en boucle toutes les ~5 s**, bloquant toute la file d'upload.
  Correctif : `order_index` = `MAX(order_index)+1` scopé au repas (helper `nextOrderIndex`,
  même idiome que `workout-repository` / `program-repository`) → un petit entier séquentiel.
  Fichier : [journal-repository.ts](apps/mobile/src/data/repositories/journal-repository.ts).

### Technique / Notes
- Trouvé en testant l'app sur device (Pixel 6a) : warning `[PowerSync] upload PUT food_entries
  échoué` en boucle. Le connecteur upload via `op.opData` (snapshot capturé à l'écriture,
  [connector.ts](apps/mobile/src/powersync/connector.ts)) : les entrées **déjà** créées
  gardent l'`order_index` géant et continueront de bloquer la file tant que la base locale
  n'est pas réinitialisée (`disconnectAndClear`) — ce fix ne concerne que les écritures futures.

## 07/07/2026 — Corrige la résolution de `@wellness/shared` sous Windows (Metro)

_Branche : `fix/metro-resolution-shared-windows`_

### Corrigé
- **Bundling natif impossible sur Windows** : Metro échouait avec
  `Unable to resolve "@wellness/shared" from …/goal.tsx` (donc écran d'erreur du dev-client au
  lieu de l'app). Cause : sur Windows, npm workspaces crée des **junctions** (et non des
  symlinks) pour lier les packages locaux ; le resolver Metro ne les suit pas (`lstat` ne les
  voit pas comme des liens). Correctif : `resolver.extraNodeModules` dans
  [apps/mobile/metro.config.js](apps/mobile/metro.config.js) mappe explicitement
  `@wellness/shared` → `packages/shared`.

### Technique / Notes
- Lancement sur **téléphone Android physique en USB depuis Windows** (mémo débogage) :
  1. `adb reverse tcp:8081 tcp:8081` puis viser `http://127.0.0.1:8081` (le loopback n'est pas
     filtré par le pare-feu Windows, qui bloque sinon le port 8081 en Wi-Fi → `ETIMEDOUT`).
  2. Démarrer Metro **sans** `--host localhost` (sinon bind IPv6 `::1` seul et `adb reverse`,
     qui tape en IPv4, renvoie `unexpected end of stream`).

## 07/07/2026 — V0.4 : repas personnalisables (4.15) + alerte croisée déficit/volume (4.32)

_Branche : `feature/4.15-4.32-finitions-v04`_

### Ajouté
- **Repas personnalisables (4.15)** : renommer / ajouter / supprimer ses repas.
  - `@wellness/shared` : `mealConfigItemSchema`, `DEFAULT_MEAL_CONFIG`, `resolveMealConfig`,
    champ `meals` sur `nutritionProfileRowSchema`. Migration `20260707140000` (colonne `meals` jsonb +
    **relâche le CHECK `food_entries.meal_type`** pour autoriser des clés custom). Schéma PowerSync + repo.
  - Journal rendu depuis la config ; écran **Gérer les repas** (`nutrition-meals`). Signatures
    repository `MealType` → `string` (clés de repas libres).
- **Alerte croisée (4.32)** : `shouldAlertDeficitVolume` (shared) + carte sur `nutrition-stats` —
  déficit calorique hebdo ≥ 15 % **et** fort volume muscu (Σ reps×kg sur 7 j) → conseil de récupération.
  Première stat croisée inter-piliers (décision H).

### Technique / Notes
- `typecheck` + `lint` (0 erreur) + `test` (325) verts.
- **Checkpoint 🔴** : appliquer la migration `20260707140000_nutrition_meals.sql` sur le cloud.
- **Reste V0.4** : 4.10 scan + 1.14/2.5 rappels (**natif** → build).

## 07/07/2026 — V0.4 : saisie de repas par liste (langage naturel) + copier un repas (4.5 / 4.18)

_Branche : `feature/4.5-saisie-langage-naturel`_

### Ajouté
- **Saisie par liste (4.5)** : écrire un repas en une phrase (« une banane, 3 tranches de pain de
  mie, et beurre de cacahuète ») → l'app retrouve chaque aliment.
  - `@wellness/shared/meal-parser` : parseur pur (segmentation `,`/et/avec/and/with/+/retours ligne,
    quantité chiffre|mot, unités FR/EN tranche/tbsp/verre/g…, décimales `2,5` préservées) +
    `normalizeName` / `bestMatchIndex` (recherche floue tolérante **accents + pluriel**) +
    `DEFAULT_UNIT_GRAMS`. **+12 tests** (318 au total).
  - Écran `meal-quick-entry` : analyse → **revue éditable** (grammes/kcal, items non reconnus
    signalés) → confirmation. Rien n'est ajouté avant validation (spec §8). Offline. Entrée depuis
    le food-picker (« Saisie par liste »).
- **Copier (4.18)** : `copyMeal` / `duplicateDay` (repository) + action « **Copier d'hier** » sur un
  repas vide du journal.

### Technique / Notes
- `typecheck` + `lint` (0 erreur) + `test` verts.
- **Reste V0.4** : 4.15 renommer/ajouter repas (schéma), 4.32 stat croisée, 4.10 scan + 1.14/2.5
  rappels (**natif** → nouveau build).

## 06/07/2026 — chore(db) : types Supabase régénérés (food, recipes, runs, bodyweight)

_Branche : `chore/db-types-food-recipes`_

### Modifié
- **`packages/shared/src/database.types.ts`** régénéré via l'API Management Supabase après
  application sur le cloud des migrations food (`150000/150001` + seed), running (`120000`),
  recettes/poids (`130000/130001`). Contient désormais `foods`/`food_*`, `recipes`/
  `recipe_ingredients`, `meal_templates`/`meal_template_items`, `body_weight_entries`, `runs`.

### Technique / Notes
- **Cloud à jour** : 10 tables créées + seed 50 aliments + RLS + publication PowerSync (24 tables) —
  appliqué via API Management. `typecheck` vert.
- Reste (hors SQL) : redéployer les **sync rules edition 3** sur le dashboard PowerSync.

## 06/07/2026 — V0.4 US4.24 : recettes, repas types, poids & stats

_Branche : `feature/4.24-recettes-poids-stats`_

### Ajouté (items 4.24-4.26, 1.13, 4.30, 4.31)
- **`packages/shared`** : `recipe.ts` (schémas recettes/ingrédients/repas types + helpers `perServing`/
  `scalePortions`) + `bodyweight.ts` (pesées + `weightTrend`/`averageIntake`). **+tests** (306 shared).
- **5 tables PowerSync** (user_id) : `recipes`, `recipe_ingredients`, `meal_templates`,
  `meal_template_items`, `body_weight_entries`. Migrations `20260707130000/130001` + RLS + sync rules edition 3.
- **Repositories** : `recipe-repository` (totaux SQL), `meal-template-repository` (save/apply),
  `bodyweight-repository` + `useDailyTotals` (stats apports).
- **Écrans** : `recipe-edit` (ingrédients via food-picker mode recette, total + par portion, 4.24/4.25) ;
  **food-picker** étendu (onglets Recettes/Repas types + mode recette) ; **nutrition-stats** (pesée,
  courbe poids 4 sem/3 mois/1 an, apports moyens 7/30 j — `ProgressLineChart` réutilisé) ; onglet
  Nutrition (icône Suivi + « enregistrer comme repas type » par repas, 4.26).

### Technique / Notes
- `typecheck` + `lint` (0 erreur) + `test` verts.
- **Différé** : 4.32 stat croisée déficit/volume, rappels 1.14/2.5 (`expo-notifications` natif), planning/liste de courses (V1.1).
- **Checkpoints 🔴** : appliquer migrations `130000/130001` sur Supabase, redéployer sync rules (5 streams), `db:types`, vérif device.

## 06/07/2026 — V0.4 US4.8 : base d'aliments & journal alimentaire

_Branche : `feature/4.8-aliments-journal` · commit précédent sur `dev` : `632f5b5`_

### Ajouté (cœur du pilier Alimentation — items 4.8/4.9/4.11-4.14/4.16/4.17/4.19-4.23)
- **`packages/shared/src/food.ts`** : enums (catégories, sources, repas), schémas `foods`/
  `food_translations`/`food_entries`/portions, helpers purs `resolveFoodName` / `scaleNutrition` /
  `sumNutrients`. **+16 tests** (253 shared).
- **4 tables PowerSync** : `foods` (owner_id null = bibliothèque), `food_translations`,
  `food_favorites`, `food_entries` (snapshot). Migrations `20260706150000_food_tables.sql` +
  `150001_food_rls.sql` + **sync rules edition 3** (streams food) + **seed 50 aliments bilingues** curés.
- **`food-repository`** (recherche nom résolu SQL, favoris, aliment perso, import OFF) +
  **`journal-repository`** (entrées du jour, ajout/maj/suppr) + **`lib/openfoodfacts.ts`** (recherche texte, sans clé).
- **Écrans** : onglet **Nutrition** = journal (nav jours, totaux + barres macros temps réel, 4 repas) ;
  **food-picker** (recherche locale + OpenFoodFacts, favoris, portions/quantité, quick add) ;
  **food-custom** (aliment perso). FR + EN.

### Technique / Notes
- `typecheck` + `lint` (0 erreur) + `test` verts.
- **Différé** : scan code-barres (4.10, expo-camera), renommer/ajouter repas (4.15), copier repas/
  journée (4.18), recettes & repas types (4.24-4.26), poids & stats (1.13/1.14/4.30-4.32), notif repas (2.5).
- **Checkpoints 🔴 humains** : appliquer migrations `150000/150001` + **seed** sur Supabase, redéployer
  les sync rules (streams food), `db:types`, vérif device.

## 06/07/2026 — V0.5 Running R1 : tracker GPS nu (course libre)

_Branche : `feature/running-r1-tracker` · commit précédent sur `dev` : `5f1b91d`_

### Ajouté (premier incrément V0.5 — Running)
- **`packages/shared/src/running.ts`** : calculs GPS purs — `haversineMeters`, `totalDistance` (filtre
  outliers via `MAX_PLAUSIBLE_SPEED_MS`), `averagePace`, `instantPace`, **encodage trace append-friendly**
  (`encodeSegment`/`appendToTrack`/`decodeTrack`, polyline + deltas de temps, length-prefix), `runRowSchema`.
  **+45 tests.**
- **Table `runs`** : migration `20260707120000_running_runs.sql` + RLS (table utilisateur) + **stream
  edition 3** + schéma PowerSync local. Trace GPS = **1 colonne encodée** sur la ligne (pas de table de
  points → 1 ligne/course, évite l'explosion PowerSync).
- **`run-repository`** : `useActiveRun`/`useRun`/`useRunHistory`, `startRun` (garde anti double-active),
  `flushTrack` (append-only **sérialisé**, garde de statut), `finishRun` (au stop, `avg_pace` des scalaires
  flushés, garde active), `cancelRun` (soft delete), `setRunFeedback`/`setManualRunDistance`.
- **Suivi GPS** : `expo-location` + `expo-task-manager` + **foreground service Android** (nouveau dev build),
  service `tracker`/`tracker-task` (encode+append par batch, auto-pause, pause observable, stop→drain→finish).
- **Écrans** : démarrage course libre (GPS/sans-GPS, refus permission → bascule manuelle), suivi temps réel
  (distance/temps/allure inst.+moy., pause/reprise, écran verrouillé, keep-awake), résumé (RPE/note/distance
  manuelle). i18n FR/EN, smoke test.

### Technique / Notes
- **Découpage V0.5** : R1 (ce livrable) → R2 carte (**Mapbox/MapLibre à trancher**) → R3 profil/programmes → R4 stats/records/GPX.
- **Nouveau dev build requis** (`expo-location`/`task-manager` natifs) avant tout test device.
- Revues repo + finale : **GO**. Le cœur (GPS arrière-plan, écran verrouillé, batterie, reprise après kill,
  offline→sync) **n'est validable que sur le terrain** = checkpoint 🔴 humain (Task 10).
- **Checkpoints 🔴** : migration `runs` + stream sur le cloud, dev build, **validation terrain**.
- Caveats terrain notés : relance process Android (batch ignoré si `startTracking` pas rejoué), seuils
  auto-pause à ajuster, rendu notif foreground service à vérifier.

## 06/07/2026 — chore(db) : sync rules PowerSync en edition 3 + types Supabase générés

_Branche : `chore/db-types-sync-edition3` · commit précédent sur `dev` : `d45ac5b`_

### Modifié
- **`docs/specs/technical/powersync-sync-rules.yaml`** : **réécrit en Sync Streams (edition 3)**
  pour coller à l'instance PowerSync réelle (l'ancien format `bucket_definitions` n'était pas
  déployable dessus). 18 streams `auto_subscribe` couvrant les 13 tables (données utilisateur
  `user_id`, contenu custom `owner_id = auth.user_id()`, bibliothèque `owner_id IS NULL`) —
  socle + muscu (US1/US2/US3) + nutrition.
- **`packages/shared/src/database.types.ts`** : régénéré depuis le schéma Supabase cloud
  (`supabase gen types`) — remplace le fichier vide. Contient profils, réglages, exercices,
  séances, programmes, **nutrition_profiles**.

### Technique / Notes
- `typecheck` + `test` (241) verts ; lint 0 erreur (warnings pré-existants US3).
- **`personal_records` (US3, migration 140002) absent** des types : la table n'est pas encore
  appliquée sur le cloud. À régénérer (`npm run db:types`) une fois 140002 appliquée — les sync
  rules l'incluent déjà (à déployer quand la table existe).

## 06/07/2026 — V0.4 US4.1 : profil nutritionnel & TDEE (1.10 / 4.1-4.7)

_Branche : `feature/4.1-profil-nutritionnel-repo` · commit précédent sur `dev` : `a1c9e9f`_

### Ajouté (première US de la V0.4 — Alimentation)
- **`packages/shared/src/nutrition.ts`** : calculs purs — **TDEE Mifflin-St Jeor** (homme +5 /
  femme −161 / non précisé = moyenne, constante −78) × **facteur d'activité** 5 niveaux (4.1/4.2),
  **objectif calorique** = TDEE + delta d'objectif avec **surcharge manuelle** prioritaire (4.3),
  **macros par défaut** selon l'objectif (4.4) + conversions **%↔grammes** (grammes prioritaires,
  spec §8, 4.5), `objectiveFromGoal`, bonus jours d'entraînement (4.7). **+ `nutritionProfileRowSchema`**
  (Zod) + enum `DIET_RESTRICTIONS` (4.6). **+28 tests** (202 au total shared).
- **Table `nutrition_profiles`** (une ligne par compte) : schéma **PowerSync local** + migrations
  Supabase `20260706140000_nutrition_tables.sql` + `…140001_nutrition_rls.sql` (RLS user_id) +
  **sync rules** (bucket `user_data`).
- **`data/repositories/nutrition-repository.ts`** : `useNutritionProfile()` (lecture réactive
  `useQuery`) + `upsertNutritionProfile()` (écriture via `_sql`, mapping snake↔camel, JSON pour
  restrictions/allergènes). Aligné sur le pattern repository US1 (aucun store Zustand).
- **Écran Profil nutritionnel** (`nutrition-profile.tsx`, modale) : objectif, activité, TDEE en
  direct, macros éditables + barres, restrictions en puces, allergènes, état « profil incomplet ».
- **Onglet Nutrition** : carte résumé (objectif calorique + macros) ou CTA de configuration.
  Entrée Réglages (gated pilier actif) + route modale.
- **i18n FR + EN** : bloc `nutrition.*` complet (aucune chaîne en dur).

### Technique / Notes
- **Rebasé sur la nouvelle archi `dev`** : la 1ʳᵉ version (branche `feature/4.1-profil-nutritionnel`,
  commit `981b91d`) suivait le pattern Zustand/SecureStore, **supprimé par l'US1** (bascule
  repositories/PowerSync). Portée intégralement sur la couche data actuelle.
- `typecheck` + `lint` (0 problème) + `test` verts (jest-expo mobile + vitest shared).
- **Checkpoints 🔴 humains avant activation** : appliquer les migrations nutrition sur Supabase
  cloud, vérifier la publication `powersync`, redéployer les sync rules PowerSync, `db:types`,
  **vérif device** (offline, sync, RLS) — comme US1/US2.
- **Décision bloquante 4.8 tranchée** le 06/07/2026 : base d'aliments = **CIQUAL (bruts FR + trad. EN)
  + OpenFoodFacts** (scan) — débloque les US base d'aliments / journal.
- **Différé** : câblage 4.7 au planning muscu (dépend de la donnée planning).

## 06/07/2026 — US3 : historique & records muscu

_Branche : `feature/historique-records-muscu` · commit précédent sur `dev` : `a1c9e9f`_

### Ajouté
- **`packages/shared`** : logique records — `estimate1RM` (Epley), `computeWorkoutRecords` (max charge / 1RM estimé / meilleur volume, hors échauffement), `personalRecordRowSchema` — +39 tests (213 au total).
- **Backend** : table `personal_records` + **RLS** (table utilisateur) + sync rules + schéma PowerSync local.
- **`records-repository`** : `evaluateWorkoutRecords` (détection **strictement supérieur** à la clôture, insert atomique), `useWorkoutRecords`/`useExerciseRecords`/`useExerciseProgression`/`useMuscleVolumeThisWeek`/`useWorkoutDetail`. Calcul branché **après** `finishWorkout` (best-effort, clôture résiliente).
- **Graphes** : `react-native-svg` + `react-native-gifted-charts` ; composants `ProgressLineChart`/`MuscleVolumeBarChart` (thémés, empty-safe).
- **Écrans** : historique (liste + détail, 3.38), progression (records par exercice + courbe charge/volume 30/90j/1an + volume par groupe musculaire semaine, 3.21/3.39/3.40), **mise en avant des records battus au résumé** (3.22). Entrées depuis l'onglet muscu.

### Corrigé (revues)
- Clôture de séance **résiliente** : `onFinish` navigue même si l'évaluation des records échoue.
- Label du record `best_volume` (reps×kg) affiché **sans « kg »** (évite « 800 kg »).
- Retrait de `finishWorkoutAndEvaluate` (code mort).

### Technique / Notes
- Périmètre : records + historique + courbes. **Hors périmètre** : notification push nouveau record (3.42, différée V0.8 — détection déjà posée) ; alerte déséquilibre (3.41).
- Records = **journal** (nouvelle ligne par record, jamais d'écrasement) — compatible gamification future.
- **Nouveau dev build requis** (`react-native-svg` natif) avant test device.
- **Dette connue (transverse, pré-existante)** : l'affichage des poids ignore le réglage métrique/impérial (1.15) sur **tout le muscu** (US1/US2/US3) — `displayWeight` (`@wellness/shared`) existe mais n'est câblé nulle part → **US de suivi dédiée** (voir TODO).
- **Checkpoints 🔴 humains** : migration `personal_records` + sync rules sur le cloud, dev build svg, vérif device.
- ⚠️ **Collision de timestamp résolue au merge** : la migration records renommée `20260706140002_personal_records.sql` (l'US4.1 nutrition, mergée en parallèle, occupe `140000`/`140001`).

## 06/07/2026 — US2 : programmes muscu (structure + bibliothèque + lien séance)

_Branche : `feature/programmes-muscu` (13 commits) · commit précédent sur `dev` : `5e590fd`_

### Ajouté
- **`packages/shared`** : schémas Zod `program`/`program_translations`/`sessions`/`exercise_plans`
  (+ enums `PROGRAM_STATUSES`/`PROGRAM_LEVELS`, `resolveProgramName` fallback FR) — +47 tests (174 au total).
- **Backend Supabase (fichiers à appliquer)** : migration 4 tables programmes + **FK `workouts.session_id`/`program_id`** (différées par l'US1), migration **RLS** (pattern contenu `owner_id`), extension des **sync rules**, **seed** d'un programme éditorial placeholder (bilingue, référence les exercices US1).
- **Schéma PowerSync local** étendu (+4 tables).
- **`program-repository`** : biblio/mes-programmes/actif/détail réactifs + `createProgram`/`addSession`/`addExercisePlan`/`updateExercisePlan`/`removeExercisePlan`/`removeSession`/`duplicateProgram`/`activateProgram`/`deleteProgram` (transactions atomiques pour duplication & activation).
- **Écrans** : bibliothèque + filtre niveau + duplication (3.1-3.3), création/édition de programme (métadonnées → séances → exercices/cibles, 3.4-3.6), détail + activation un-actif-par-pilier (3.12), **démarrer une séance depuis un programme** (3.24) via `startWorkoutFromSession` (extension ciblée du workout-repository, séries pré-remplies).
- Indicateur du programme actif dans l'onglet muscu. Smoke test programmes (jest-expo).

### Technique / Notes
- Périmètre : structure + biblio + lien séance. **Hors périmètre → US2b** (nouvelle table requise) : planning calendaire (3.9-3.11), progression auto/deload (3.7/3.8), notifs séance (2.4/2.7). Records → US3.
- Revue du program-repository + revue finale d'intégration : **GO**, cohérence 5 couches vérifiée, offline-first (`isLoading = queryLoading`) et i18n FR/EN respectés. Mineurs (noms de séances FR dans le seed placeholder, filtre `goal` non exposé) → suivi.
- **Checkpoints 🔴 humains avant activation** : appliquer les migrations US2 sur Supabase cloud, redéployer les sync rules PowerSync, `db:types`, **vérif device** (Task 13) — comme l'US1.

## 06/07/2026 — US1 : socle data muscu sur PowerSync (bascule complète)

_Branche : `feature/data-socle-muscu` (22 commits) · commit précédent sur `dev` : `69134aa`_

### Ajouté
- **`packages/shared`** : schémas Zod + logique pure — `contentOwnerSyncFieldsSchema` (owner_id), `exercise`
  (+ `resolveExerciseName`, fallback FR), `workout` (+ `computeVolume`, hors échauffement),
  `user_settings`, `profileRow`. Couverture Vitest portée à **127 tests**.
- **Couche data mobile** (`apps/mobile/src/data/repositories/`) : helpers `_sql` (UUID client, UTC,
  soft delete via PATCH) + 4 repositories (`profile`, `settings`, `exercise`, `workout`) — lectures
  réactives `useQuery` (`@powersync/react`), écritures via repository. Séance en cours = ligne
  `workouts` active.
- **Schéma PowerSync local** : 7 tables (remplace la table jouet `todos`).
- **Backend Supabase** (fichiers, à appliquer) : migrations `tables` + `RLS` (9.6), `seed.sql`
  (16 exercices bilingues, UUID déterministes), `powersync-sync-rules.yaml`.
- **jest-expo** câblé (+ mocks PowerSync) — `npm run test` couvre désormais mobile **et** shared.

### Modifié
- Bascule de tous les écrans vers les repositories : onboarding, profil, réglages (+ masquage
  onglets, thème/unités/langue synchronisés), accueil, exercices, séance, résumé.
- **Gate de routing** (`_layout.tsx`) : splash tant que la base locale n'a pas résolu, puis
  onboarding vs app selon `onboarding_completed_at` — remplace `hasHydrated`. `ensureSettings`
  crée la ligne de réglages au 1er accès.
- `generateId` → **UUID v4** (`expo-crypto`).

### Supprimé
- Stores Zustand persistés `profile` / `workout` / `exercise` / `settings`, `data/exercises.ts`,
  `lib/zustand-secure-storage.ts` (**dette data soldée** : `grep persist( = 0`).

### Corrigé (revues)
- Revue workout-repo : requête des séries stable sans séance active (le `AND 0` mal placé).
- Revue finale : **démarrage offline-first** — `isLoading` ne dépend plus de `hasSynced` (évitait un
  splash infini hors-ligne pour un compte connecté) ; langue des noms d'exercices cohérente en
  séance (langue applicative, pas locale device) ; garde anti double-séance-active dans `startWorkout`.

### Technique / Notes
- Enums alignés sur `@wellness/shared` (`SEXES`, `GOALS`, `UNIT_SYSTEMS`, `PILLARS`).
- **Checkpoints 🔴 humains restants avant merge** : appliquer les 2 migrations sur Supabase cloud +
  vérifier le nom de la publication `powersync` ; déployer les sync rules sur le dashboard PowerSync ;
  **vérif device** (offline, sync montante/descendante, RLS 2 appareils, i18n FR/EN) — Task 22.
- Repositories mobiles non couverts en unitaire (module natif) → validés device.

## 06/07/2026 — Plan d'implémentation US1 (socle data muscu)

_Branche : `docs/schema-donnees-muscu` · commit précédent : `cabe5f6`_

### Ajouté
- **Plan d'implémentation** [`docs/plans/us1-socle-data-muscu.md`](docs/plans/us1-socle-data-muscu.md) :
  22 tâches en 5 phases (backend Supabase + RLS + sync rules → schémas/logique `packages/shared`
  TDD → couche data mobile repository → jest-expo + bascule des écrans → vérif device). Découpage
  bite-sized, commits bornés, points 🔴 humains isolés (migrations cloud, sync rules dashboard).

### Corrigé (revue de plan)
- `useQuery`/`useStatus` rattachés au bon package **`@powersync/react`** (et non `@powersync/react-native`).
- Ajout explicite du **gate de chargement/routing** (remplace `hasHydrated` ; évite le flash
  d'onboarding avec les lectures async) + sémantique d'upsert des réglages par défaut au 1er accès.
- Migration du symbole `MUSCLE_GROUPS`/`MuscleGroup` vers `@wellness/shared` ; reshape explicite
  de l'ancien modèle imbriqué `entries[].sets[]` vers `workout_sets` plat.

### Technique / Notes
- Commit **docs uniquement**. Revue de plan (agent `plan-document-reviewer`) traitée ; validation
  humaine (Damien/Florian) requise avant implémentation (workflow CLAUDE.md).

## 06/07/2026 — Spec : schéma de données socle & muscu (PowerSync / Supabase)

_Branche : `docs/schema-donnees-muscu` · commit précédent : `727c7f6`_

### Ajouté
- **Spec technique** [`docs/specs/technical/schema-donnees-muscu.md`](docs/specs/technical/schema-donnees-muscu.md) :
  fige le **schéma physique** du socle transverse + pilier musculation complet (V0.2 **et** V0.3)
  et la couche d'accès aux données PowerSync.
  - **13 tables** : `profiles`, `user_settings` ; contenu partagé `exercises` /
    `exercise_translations` / `programs` / `program_translations` ; muscu utilisateur
    `exercise_favorites`, `sessions`, `exercise_plans`, `workouts`, `workout_sets`,
    `personal_records`.
  - **Conventions transverses** : colonnes de synchro (`id` UUID client, `created_at`/`updated_at`
    UTC, `deleted_at` soft delete), buckets `user_data` / `shared_content` (via `owner_id`
    nullable), sync rules YAML, RLS Supabase (item 9.6).
  - **Approche d'accès** actée : lectures réactives PowerSync (`useQuery`) + **repository** pour
    les écritures ; Zustand réduit à l'UI éphémère ; **séance en cours = ligne `workouts` active**
    (fin de la persistance Zustand).
  - **Bascule propre** (cutover sans migration) des stores `profile`/`settings`/`exercise`/`workout`
    et du fichier statique `data/exercises.ts` (→ seed Supabase).
  - **Découpage en 3 US** : socle data → programmes → historique/records.

### Technique / Notes
- Décisions de cadrage tranchées (05-06/07/2026) : périmètre muscu complet · infra déjà
  provisionnée (Supabase + PowerSync) · réglages synchronisés · nom d'exercice toujours en table de
  traduction · `active_pillars` porté par `user_settings`.
- Revue de spec (agent `spec-document-reviewer`) : **approuvée**. Écarts corrigés — enums réalignés
  sur `packages/shared` (`SEXES`, `GOALS`), propriété de `active_pillars` clarifiée, garantie
  soft-delete du connecteur ancrée.
- Point laissé à valider : traduction du `name` des `sessions` (non traduit en V0.3).
- Commit **docs uniquement** (aucun code applicatif) → gates lint/typecheck/tests non rejouées.

## 06/07/2026 — V0.2 : séance libre (muscu) — 10 items

_Branche : `feat/3.23-seance-libre`_

### Ajouté (parcours cœur muscu)
- **Bibliothèque d'exercices** (3.13) : seed local bilingue (16 exercices, 6 groupes musculaires)
  + **recherche** (3.14) + **favoris** (3.15) + **exercice personnalisé** (3.16). Écran
  `exercises.tsx` (sélecteur).
- **Séance libre** (3.23) : `workout.tsx` — ajout d'exercices au fil de l'eau, **validation de
  série** reps × charge (3.25), **chrono de repos** automatique 90 s (3.28), **ajout/suppression
  de série** (3.30), **édition charge/reps en direct** (3.31), chrono de séance.
- **Résumé de fin de séance** (3.35) : durée, exercices, séries validées, volume total.
- Onglet **Muscu** : démarrer / reprendre une séance ; compteur d'historique.

### Technique / Notes
- Stores `exercise` (favoris + perso) et `workout` (séance active + historique) **persistés**
  chiffrés (SecureStore) — la séance survit à un kill (spec 3.36).
- Frontend + local (pas de rebuild). Vérifié : `typecheck` OK, `lint` (0 problème), `test` 43/43.
- **Différé** : synchro cloud (tables `exercises`/`workouts` PowerSync), GIF/démos (6.1, décision
  bloquante), records/1RM (3.22), types de séries avancés (3.27), vibration fin de repos (3.29).

## 05/07/2026 — V0.2 : profil persistant & éditable (item 1.12)

_Branche : `feat/1.12-profil-persist`_

### Ajouté (4 points)
1. **Persistance** des stores `profile` et `settings` via **SecureStore** (Zustand `persist`,
   chiffré) — l'onboarding et les préférences (thème, unités, piliers, langue) **survivent au
   redémarrage**. Gating d'hydratation dans le layout racine (`useHydrated`).
2. **Écran Profil éditable** (`app/profile.tsx`, modale) accessible depuis les Réglages :
   prénom, sexe, date de naissance, poids, taille, objectif (item 1.12).
3. **Accueil personnalisé** : « Bonjour {prénom} » quand le profil est renseigné.
4. **Relancer l'onboarding** depuis les Réglages (compte-profil-onboarding §3.3).

### Technique / Notes
- `lib/zustand-secure-storage.ts` (StateStorage SecureStore + hook `useHydrated`).
- Frontend + SecureStore (déjà dans le dev build) → **pas de rebuild**. Vérifié : `typecheck`,
  `lint` (0 problème), `test` 43/43.

## 05/07/2026 — V0.2 : onboarding skippable (items 1.7-1.11)

_Branche : `feat/1.7-onboarding`_

### Ajouté
- **Parcours d'onboarding** (groupe `(onboarding)`) après inscription, **non bloquant** :
  intro → infos (prénom, sexe, date de naissance, poids, taille) → piliers → objectif → récap.
  **« Passer »** (saute l'étape) et **« Passer tout »** disponibles partout (décision F).
- **Store profil** (`stores/profile-store.ts`) : prénom, sexe, date de naissance, poids/taille
  (SI), objectif, `onboardingCompleted`.
- **Gating** dans le layout racine : session sans onboarding → parcours ; sinon → app.
- **`packages/shared/profile.ts`** : enums `Sex` / `Goal` (+ Zod), 4 tests (100 %).
- Composants réutilisables : `Segment` (extrait des Réglages), `OnboardingScaffold`.

### Technique / Notes
- Frontend pur (hot-reload). Vérifié : `typecheck` OK, `lint` (0 problème), `test` **43/43**.
- **Profil en mémoire** pour l'instant → l'onboarding se rejoue après un redémarrage complet.
  La persistance/synchro via la table `profiles` (PowerSync) est l'US suivante.
- Étape « alimentation » (1.10) simplifiée / différée ; unités d'entrée en métrique.

## 05/07/2026 — V0.1 : écrans légaux & consentement + âge 16+ (item 1.21)

_Branche : `feat/1.21-legal-consent`_

### Ajouté
- **`packages/shared/age.ts`** : `computeAge`, `isAtLeast`, `toDate` (validation calendrier) +
  `MIN_SIGNUP_AGE` (16). **11 tests, couverture 100 %.**
- **Inscription** : champs **date de naissance** (JJ/MM/AAAA) avec contrôle **âge ≥ 16 ans**
  (RGPD) + **case de consentement** CGU / politique de confidentialité (obligatoire).
- **Écrans légaux** `(auth)/terms` et `(auth)/privacy` (composant `LegalScreen`, contenu
  **brouillon** bilingue à faire relire juridiquement) accessibles via liens à l'inscription.
- Composant `Checkbox` réutilisable. i18n FR/EN complet.

### Technique / Notes
- Frontend pur (testé en hot-reload). Vérifié : `typecheck` OK, `lint` (0 problème),
  `test` **39/39** (shared 100 %).
- Contenu légal = **placeholder** (roadmap : « textes juridiques à fournir / faire relire »).

## 05/07/2026 — V0.1 : intégration PowerSync (SQLite local + connecteur Supabase, 9.13)

_Branche : `feat/9.13-powersync`_

### Ajouté
- **SDK PowerSync** (compatible RN 0.86 / new architecture) : `@powersync/react-native`,
  `@powersync/react`, adaptateur **`@powersync/op-sqlite` + `@op-engineering/op-sqlite`**,
  polyfill `@azure/core-asynciterator-polyfill`, plugin babel `transform-async-generator-functions`.
- **`src/powersync/`** :
  - `schema.ts` — schéma local (table jouet `todos` du runbook pour valider le pipeline).
  - `connector.ts` — connecteur Supabase (`fetchCredentials` via JWT, `uploadData` rejoue le CRUD).
  - `system.ts` — `PowerSyncDatabase` sur op-sqlite.
  - `PowerSyncProvider.tsx` — contexte + connexion auto quand une session existe.
- **Indicateur de synchro** (`SyncStatus`) dans l'accueil (navigation-ux §7).
- Config `babel.config.js` + `metro.config.js` (inlineRequires blockList op-sqlite).

### Technique / Notes
- Vérifié : `typecheck` OK (API PowerSync validées), `lint` (0 problème), `test` 28/28.
- ⚠️ **Non testé au runtime** : modules natifs (op-sqlite) → nécessite un **nouveau `build:dev`**
  ET une **config cloud** (table + publication Supabase, sync rules PowerSync — voir runbook).
  Schéma métier réel à ajouter avec les US (ici table jouet `todos`).

## 05/07/2026 — Session persistante & chiffrée (SecureStore / Keystore, item 9.8)

_Branche : `feat/9.8-secure-session`_

### Ajouté
- **`lib/secure-storage.ts`** : adaptateur de stockage **chiffré et persistant** pour la
  session Supabase via `expo-secure-store` (Android Keystore — architecture §7). Découpage en
  morceaux (SecureStore limite ~2 Ko/valeur ; la session Supabase dépasse cette taille).

### Modifié
- **`lib/supabase.ts`** : le client utilise désormais `secureStorage` (session **persistée**
  entre redémarrages, item 1.5 + chiffrée, item 9.8) au lieu du stockage mémoire temporaire.
- Dépendances : `+ expo-secure-store` ; **retrait** de `@react-native-async-storage/async-storage`
  (devenu inutilisé → un module natif de moins dans le build).

### Technique / Notes
- **Nécessite un nouveau `build:dev`** : `expo-secure-store` est un module natif absent du dev
  client actuel. Après rebuild, la session survit à une fermeture complète de l'app.
- **PowerSync** volontairement **non inclus** dans ce rebuild (US dédiée) : compat native à
  vérifier avec RN 0.86 (new architecture) avant de l'ajouter.

## 05/07/2026 — V0.1 : authentification Supabase (inscription, connexion, session)

_Branche : `feat/1.1-auth-supabase`_

### Ajouté
- **Store d'auth** (`stores/auth-store.ts`) : session Supabase + `signUp` / `signIn` /
  `signOut` / `resetPassword`, résolution de session au démarrage et abonnement
  `onAuthStateChange` (session persistante, refresh silencieux — items 1.1/1.4/1.5/1.6/9.5).
- **Groupe de routes `(auth)`** : `sign-in`, `sign-up`, `forgot-password`, `verify-email`.
- **Gating de navigation** dans le layout racine : redirige vers `(auth)` sans session, vers
  `(tabs)` une fois connecté (splash maintenu jusqu'à résolution de la session).
- **Composants** réutilisables : `Button`, `TextField`, `FormScreen`.
- Réglages : section **Compte** (email + déconnexion). i18n FR/EN complet.

### Modifié
- **`lib/supabase.ts`** : stockage de session **en mémoire** (aucun module natif) pour tester
  le flux sur le dev client actuel sans rebuild.

### Technique / Notes
- Vérifié : `typecheck` OK, `lint` (0 problème), `test` 28/28, testé sur device (inscription →
  vérif email → connexion → déconnexion).
- **`.env`** local (gitignoré) créé pour charger les clés client Supabase.
- **Différé** (prochain dev build, groupé avec PowerSync) : stockage **chiffré/persistant**
  (`expo-secure-store`, item 9.8). En attendant, la session ne survit pas à une fermeture totale.
- **Différé** (US dédiées) : OAuth Google, CGU + âge 16+ (1.21), onboarding (V0.2),
  localisation des messages d'erreur Supabase.

## 05/07/2026 — Écrans piliers : en-tête structuré (ScreenHeader)

_Branche : `feat/pillar-screens`_

### Ajouté
- **Composant `ScreenHeader`** réutilisable : gros titre display + sous-titre + action optionnelle.
- Les 3 écrans piliers (Muscu / Course / Alim) reçoivent un **en-tête + tagline** au-dessus de
  l'état vide (plutôt qu'un simple état vide centré). i18n FR/EN.

### Technique / Notes
- Frontend pur, aucun package. Vérifié : `typecheck` OK, `lint` (0 problème), `test` 28/28.

## 05/07/2026 — V0.1 : unités (1.15) + blocs du dashboard d'accueil

_Branche : `feat/1.15-unites-dashboard`_

### Ajouté
- **Unités métrique/impérial** (item 1.15) :
  - **`packages/shared/units.ts`** : `UnitSystem` + schéma Zod, conversions pures
    (`kgToLb`/`lbToKg`, `kmToMi`/`miToKm`), formateurs `displayWeight`/`displayDistance`
    (stockage **toujours en SI**, conversion à l'affichage). **13 tests, couverture 100 %.**
  - Préférence `units` dans le store + **section « Unités »** dans les Réglages (segmented).
- **Tableau de bord d'accueil** (spec navigation-ux §3) : blocs en **états vides structurés** —
  *Séance du jour*, *Régularité* (semaine + compteur de série pluralisé), *Nutrition*
  (affiché seulement si le pilier est actif). Nouveau composant `Card`.

### Modifié
- Réglages : segment extrait en composant `Segment` réutilisé (thème + unités).
- Accueil : `EmptyState` unique remplacé par les blocs du dashboard.
- i18n FR/EN : clés dashboard + unités (avec pluriels `count_one`/`count_other`).

### Technique / Notes
- Vérifié : `typecheck` OK, `lint` (0 problème), `test` **28/28** (couverture shared 100 %),
  testé sur le dev client. Aucun package natif → pas de rebuild.

## 05/07/2026 — Polices custom (identité de la maquette)

_Branche : `feat/design-fonts`_

### Ajouté
- **Polices Google** (via `@expo-google-fonts`) fidèles à la maquette : **Bricolage Grotesque**
  (display/titres), **Hanken Grotesk** (corps/UI), **Space Mono** (chiffres).
- **`src/theme/fonts.ts`** : hook `useAppFonts` (chargement des graisses via `expo-font`) +
  constantes `fontFamily`. **`src/theme/typography.ts`** : presets sémantiques (display, title,
  body, mono…).
- **Splash gate** : le layout racine maintient le splash (`expo-splash-screen`) tant que les
  polices ne sont pas prêtes, puis le masque.

### Modifié
- Application des polices : accueil, écrans piliers (`EmptyState`), Réglages, libellés d'onglets,
  titre de la modale — `fontWeight` remplacé par les familles custom (livrées par graisse).

### Technique / Notes
- Chargées à l'exécution → **aucun rebuild natif** (testé sur le dev client existant).
- Vérifié : `typecheck` OK, `lint` (0 problème), `test` (15/15), bundle Android OK (1547 modules).
- Rappel outillage : **relancer Metro avec `-c`** après tout `expo install` (le cache ignore les
  nouveaux assets, cf. `.ttf`).

## 05/07/2026 — V0.1 : shell de navigation (onglets, thème, états vides)

_Branche : `feat/2.1-navigation-onglets`_

### Ajouté
- **Navigation à onglets** (spec navigation-ux §2 · items 2.1/2.2) : groupe `src/app/(tabs)/`
  — Accueil, Muscu, Course, Alim. Les onglets des **piliers non activés sont masqués**
  (décision H), pilotés par le store, réactivables dans les Réglages (`href: null`).
- **Écran Réglages** (`settings.tsx`, en modale) : activation des piliers + **choix du thème**
  clair / sombre / système (item 1.16).
- **Système de thème** (`src/theme/`) : échelle nommée clair/sombre (accent terracotta) dérivée
  de la maquette de référence, hook `useTheme`, application à la navigation + StatusBar.
- **États vides soignés** (item 2.10) : composant `EmptyState` (icône + texte + CTA) sur chaque
  écran pilier + accueil ; conteneur `Screen` thémé.
- **i18n FR + EN** de toute l'US (aucune chaîne en dur — décision G).
- Dépendance `@expo/vector-icons` (icônes onglets/états vides).

### Technique / Notes
- Vérifié : `typecheck` OK, `lint` (0 problème), `test` (15/15), `expo export web` OK (11 routes).
- **Aucun module natif ajouté** → chargeable par le dev client existant sans rebuild.
- **Différé** : polices custom (Bricolage Grotesque / Hanken Grotesk / Space Mono) et unités
  métrique/impérial (item 1.15) — US dédiées.

## 05/07/2026 — Socle Supabase local

_Branche : `chore/supabase-socle`_

### Ajouté
- **`supabase/`** (`supabase init`) : `config.toml`, `.gitignore` ; **migration de conventions**
  `20260705150000_init_conventions.sql` (extension `pgcrypto` + trigger réutilisable
  `set_updated_at()` pour l'offline-first) ; `seed.sql` (placeholder). Aucune table métier
  (viendront avec leurs US).
- **Client Supabase typé** mobile ([src/lib/supabase.ts](apps/mobile/src/lib/supabase.ts)) :
  `createClient<Database>` (Auth), session persistée (AsyncStorage), auto-refresh piloté par
  `AppState`, polyfill URL. Lit `EXPO_PUBLIC_SUPABASE_URL` / `..._ANON_KEY`.
- **`apps/mobile/.env.example`** (valeurs client uniquement — jamais de secret).
- **`packages/shared`** : `database.types.ts` (stub des types générés) exporté (`Database`, `Json`).
- **Scripts racine** : `db:start` / `db:stop` / `db:reset` / `db:status` / `db:types`.
- Dépendances mobile : `@supabase/supabase-js`, `@react-native-async-storage/async-storage`,
  `react-native-url-polyfill`.

### Modifié
- **CLAUDE.md** / **TODO.md** : commandes `db:*`, structure `/supabase`, état du socle Supabase.

### Technique / Notes
- **Non provisionné / non appliqué** : pas de Docker sur ce poste → `supabase start` et la
  génération réelle des types (`db:types`) restent à faire ; pas de projet cloud.
- Stockage des tokens en clair (AsyncStorage) pour l'instant — à passer en chiffré
  (SecureStore/Keystore) avec l'US d'authentification (architecture §7).
- Vérifié : `npm run typecheck` OK, `npm run lint` (0 problème), `npm run test` (15/15).

## 05/07/2026 — CI GitHub Actions + ESLint mobile

_Branche : `chore/scaffolding-monorepo`_

### Ajouté
- **`.github/workflows/ci.yml`** : workflow **CI** sur PR/push vers `dev`/`main` — `npm ci`
  puis **typecheck + lint + tests** (Node depuis `.nvmrc`, cache npm, concurrency avec
  annulation, timeout 15 min). Répond à bonnes-pratiques §10 (qualité < 10 min sur chaque PR).
- **ESLint mobile** : `eslint` + `eslint-config-expo` (flat config `eslint.config.js`) —
  `npm run lint` (`expo lint`) désormais non interactif.

### Modifié
- **`src/i18n/index.ts`** : suppression d'une warning eslint (faux positif
  `import/no-named-as-default-member` sur `i18n.use()`), lint à **0 problème**.
- **CLAUDE.md** / **TODO.md** : CI et lint documentés.

### Technique / Notes
- Vérifié en local : `npm run lint` (0 problème), `npm run typecheck` OK, `npm run test`
  (15/15) ; `ci.yml` = YAML valide.

## 05/07/2026 — Config EAS (profils de build Android)

_Branche : `chore/scaffolding-monorepo`_

### Ajouté
- **`apps/mobile/eas.json`** : 3 profils alignés sur architecture §9 —
  `development` (dev client APK, **requis PowerSync**), `preview` (bêta interne APK),
  `production` (AAB, `autoIncrement`) ; `submit.production` → Google Play **track internal**.
  `appVersionSource: remote` (EAS gère le `versionCode`).
- **Scripts npm** mobile : `build:dev` / `build:preview` / `build:prod` / `submit:prod`.
- **README mobile** : section Builds (EAS) + procédure `eas login` / `eas init`.

### Technique / Notes
- **`eas init` effectué** (compte `damdamdeoh`) : `extra.eas.projectId`, bloc `updates`
  (EAS Update) et `runtimeVersion` (policy `appVersion`) ajoutés dans `app.json` ; dépendances
  `expo-dev-client` + `expo-updates` installées.
- **Reste à faire** : lancer le **premier build** (`npm run build:dev`).
- Vérifié : `eas.json` = JSON valide, `npm run typecheck` OK, `expo install --check` aligné.

## 05/07/2026 — Runner de tests unitaires (Vitest sur packages/shared)

_Branche : `chore/scaffolding-monorepo`_

### Ajouté
- **Vitest** sur `packages/shared` (`vitest.config.ts`, env node) avec **seuils de couverture
  à 100 %** (statements / branches / functions / lines) — exigence bonnes-pratiques §4 pour la
  logique pure. Scripts `test`, `test:watch`, `test:coverage`.
- **15 tests** couvrant les schémas Zod : `sync.test.ts` (UUID, timestamp UTC, champs de synchro,
  soft delete, contenu global sans `userId`) et `pillar.test.ts` (piliers, locales FR/EN).

### Modifié
- **package.json** (`@wellness/shared`) : dépendances de dev `vitest` + `@vitest/coverage-v8`.
- **CLAUDE.md** / **TODO.md** : commande `test` documentée, item runner de tests coché.

### Technique / Notes
- Vérifié : `npm run test` OK (15/15), couverture **100 %**, `npm run typecheck` OK (fichiers de
  test inclus).
- Tests **mobile** (jest-expo) volontairement différés à la première feature.

## 05/07/2026 — Scaffolding du monorepo (npm workspaces + Expo + shared)

_Branche : `chore/scaffolding-monorepo`_

### Ajouté
- **Racine monorepo** : `package.json` (npm workspaces `apps/*` + `packages/*`),
  `tsconfig.base.json` (TS strict + `noUncheckedIndexedAccess`), `.editorconfig`, `.nvmrc`
  (Node 20), config Prettier (`.prettierrc.json`, `.prettierignore`). Scripts agrégés :
  `typecheck` / `lint` / `test` / `mobile`.
- **`apps/mobile`** (`@wellness/mobile`) : app **Expo SDK 57** (React Native 0.86, React 19.2)
  générée avec **Expo Router**, adaptée au monorepo (`metro.config.js` : watch racine +
  résolution `node_modules` hoistés). Démo du template retirée, écran d'accueil minimal.
  - **i18n** (`src/i18n/`) : i18next + react-i18next + expo-localization, **FR + EN**,
    résolution de la langue du terminal, français par défaut.
  - **State** (`src/stores/settings-store.ts`) : store **Zustand** des réglages (langue,
    thème, piliers actifs opt-in — décision H).
- **`packages/shared`** (`@wellness/shared`) : types + schémas **Zod** partagés — champs de
  synchro transverses (UUID client, timestamps UTC, soft delete) et piliers / locales.
- **`apps/admin`** (`@wellness/admin`) : **stub** du back-office web (détaillé en V0.7).

### Modifié
- **CLAUDE.md** : état du projet (scaffolding posé) + section **Commandes** renseignée +
  arbre de structure (`apps/`, `packages/`).
- **TODO.md** : items de scaffolding cochés (monorepo, app Expo, i18n, Commandes).

### Technique / Notes
- Vérifié : `npm install` (604 paquets) OK, `npm run typecheck` OK sur les 3 workspaces,
  `expo export --platform web` OK (bundle Metro résout `@wellness/shared` et i18n).
- **Pas encore câblés** (US dédiées à venir) : dev build EAS, runner de tests, Supabase,
  intégration PowerSync.

## 05/07/2026 — Ajout du bundle design FitTrio (handoff Claude Design)

_Branche : `docs/verdict-spike-001`_

### Ajouté
- **`design/`** : bundle de handoff exporté depuis Claude Design (« FitTrio ») — prototype
  HTML/CSS/JS (`FitTrio.dc.html`), preview (`FitTrio.preview.webp`), `design-system.md`,
  script `support.js` et `README.md` d'instructions pour l'agent.

### Fichiers touchés
- `design/FitTrio.dc.html`, `design/FitTrio.preview.webp`, `design/README.md`,
  `design/design-system.md`, `design/support.js`

## 05/07/2026 — Spike 001 PowerSync : verdict ✅ + runbook corrigé

_Branche : `docs/verdict-spike-001`_

### Ajouté
- **ADR-001** — section « Résultat du spike 001 (05/07/2026) » : tableau des 6 critères,
  verdict (**PowerSync validé**), 2 pièges de config rencontrés, réserve sur la volumétrie GPS.

### Modifié
- **ADR-001** : statut → « ✅ Accepté et confirmé » (confirmé par le spike le 05/07/2026).
- **runbook-provisioning-spike** : rôle de réplication dédié `powersync_role` (1.3) ;
  formulaire de connexion réel + étape **Client Auth « Use Supabase Auth »** contre le 401
  `PSYNC_S2101` (2.2/2.2b) ; **Sync Streams `edition: 3` avec `auto_subscribe: true`** (2.3).

### Technique / Notes
- Le code de la mini-app du spike vit **hors du repo** (`../wellness-spike`, dépôt git séparé),
  conforme à la spec spike-001 (« jetable / archivé hors du repo principal »).

### Fichiers touchés
- `docs/adr/ADR-001-moteur-sync-offline.md`, `docs/specs/technical/runbook-provisioning-spike.md`,
  `CHANGELOG.md`, `TODO.md`

## 05/07/2026 — Ajout de `.gitignore` et `.gitattributes`

_Branche : `chore/gitignore-gitattributes` · commit précédent : `d81b11e`_

### Ajouté
- **`.gitignore`** : dépendances, secrets/env (`.env*`, clés, `google-services.json`, keystores),
  artefacts Expo/Metro/Android/iOS, Supabase local, caches, fichiers OS/IDE. Le dossier `.claude/`
  reste suivi volontairement.
- **`.gitattributes`** : normalisation des fins de ligne (LF dans le dépôt), scripts Windows en
  CRLF, fichiers binaires marqués — **supprime les avertissements « LF will be replaced by CRLF »**.

### Fichiers touchés
- `.gitignore`, `.gitattributes`

## 05/07/2026 — `/commit` : robustesse du hash CHANGELOG (pas de self-amend)

_Branche : `chore/mise-en-place-process`_

### Corrigé
- Règle CHANGELOG de `/commit` : ne plus embarquer le hash du commit courant (circulaire) ni
  faire de `--amend` pour l'insérer. Une entrée est identifiée par date + branche + sujet ; le
  hash court du **commit précédent** est renseigné au passage.
- Hash de l'entrée précédente corrigé (`e174d89`).

### Fichiers touchés
- `.claude/commands/commit.md`, `CHANGELOG.md`

## 05/07/2026 — `/commit` : revue de code, CHANGELOG et traces de diff (`e174d89`)

_Branche : `chore/mise-en-place-process`_

### Ajouté
- **`CHANGELOG.md`** : trace des modifications par commit, construite à partir du `git diff`,
  maintenue par `/commit`.
- **`/commit`** : étape de **revue de code** (relecture critique du diff, délégable à
  `superpowers:code-reviewer`) et étape de **tenue du CHANGELOG** ; l'analyse exploite le diff
  complet comme trace pour les devs / le débogage.

### Modifié
- `CLAUDE.md` : responsabilités élargies de `/commit` (revue + CHANGELOG + traçabilité) et ajout
  de `CHANGELOG.md` à la structure documentaire.

### Fichiers touchés
- `CHANGELOG.md`, `.claude/commands/commit.md`, `CLAUDE.md`

## 05/07/2026 — Adoption de `dev` comme branche d'intégration (`785459c`)

_Branche : `chore/mise-en-place-process`_

### Modifié
- **Modèle de branches** : `main` (release, protégée) · `dev` (intégration, cible du travail
  courant) · `feature/*` (travail). Les branches partent désormais de `dev`.
- **`/commit`** : refuse aussi `dev` (étape branche) et pousse le travail sur `dev` distant en
  fin de commande.

### Fichiers touchés
- `CLAUDE.md`, `.claude/commands/commit.md`

## 05/07/2026 — Base documentaire de cadrage & process de travail (`b46d458`)

_Branche : `chore/mise-en-place-process`_

### Ajouté
- Base documentaire unique sous `docs/` (product, specs functional/technical, adr, roadmap).
- `CLAUDE.md`, `SYNTHESE-CADRAGE.md`, `TODO.md` (suivi vivant), `design/` (maquettes).
- Workflow obligatoire par fonctionnalité (spec → plan → design → validation → code) et
  convention de branches dans `CLAUDE.md`.
- Commande `/commit` adaptée au projet (`.claude/commands/commit.md`).

### Supprimé
- Anciens dossiers de cadrage séparés `dams/` et `flo/` (fusionnés dans `docs/`).

### Modifié
- `README.md` (mise à jour post-fusion).
