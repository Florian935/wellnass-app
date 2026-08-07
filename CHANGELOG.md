# Changelog

Toutes les modifications notables du projet sont consignées ici — **maintenu automatiquement
par la commande [`/commit`](.claude/commands/commit.md)**. Chaque entrée est construite à partir
de l'analyse du `git diff` du commit, pour garder une **trace complète** des modifications
(utile aux devs et au débogage).

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/). Dates au format **JJ/MM/AAAA**.
Catégories : **Ajouté** · **Modifié** · **Corrigé** · **Supprimé** · **Technique / Notes**.

<!-- Nouvelles entrées ajoutées ICI (ordre anté-chronologique, la plus récente en haut) -->

### 07/08/2026 — `chore/socle-tests-unitaires` — Substitutions d'exercice, et resserrage des cliquets

**12 tests** sur la requête des candidats de remplacement (MUSC-F14), puis **remontée des trois
seuils de couverture mobile**, devenus inopérants à force d'être dépassés.

#### Ajouté

- **`exercise-substitution-sql.test.ts` — 12 tests.** Le classement (`rankSubstitutions`) était
  déjà testé dans `packages/shared` ; la requête qui l'**alimente** ne l'était pas. Elle fait trois
  choses qu'un mock n'aurait jamais exercées :
  - **🔴 La clause est un OU, pas un ET.** Une variante déclarée par un humain doit remonter
    **quel que soit son groupe musculaire** — si quelqu'un a lié « squat » et « soulevé de terre »,
    on ne remet pas cette information en cause. Un `AND` accidentel ferait disparaître toutes les
    variantes inter-groupes **sans la moindre erreur**, juste une liste plus courte.
  - **🔴 Les exercices archivés sont exclus** (ADMIN-01), y compris quand ils sont déclarés comme
    variante : proposer en remplacement un exercice retiré du catalogue enverrait l'utilisateur
    vers une fiche qui n'existe plus.
  - **Le `json_each`** : la liste de variantes transite en **chaîne JSON**. Une sérialisation
    cassée ne lève pas — elle rend simplement « aucune suggestion » là où l'utilisateur en attend.
  - Plus : le repli de langue (un exercice sans traduction anglaise ressort avec son nom français,
    au lieu de disparaître), le groupe vide qui ne doit pas tout ramener, et l'absence de doublon
    quand un exercice est à la fois du bon groupe **et** déclaré variante.

#### Modifié

- **`exercise-substitution-repository.ts`** : `SELECT_CANDIDATES` exporté **pour les tests
  uniquement** (patron §3.3 de la stratégie), avec le commentaire qui dit pourquoi.
- **Cliquets de couverture mobile resserrés** : `src/data/repositories` 28 → **44**, `src/lib`
  50 → **52**, `src/stores` 45 → **47**. Le réel avait dépassé les seuils de 17 points par endroits :
  on pouvait supprimer une quinzaine de points de couverture sans que la CI bronche. **Un cliquet
  qu'on ne remonte pas cesse d'être un cliquet** — à recaler sous le réel à chaque lot.

#### Technique / Notes

- **Les repositories sont finis.** Ce qui reste dans `src/data/repositories` est exclusivement
  composé de hooks `useQuery` sur des `SELECT … WHERE deleted_at IS NULL` simples : le rendement
  de l'extraction §3.3 y devient marginal. Le prochain gisement, ce sont les **écrans à état**
  (`workout.tsx`, `run/active.tsx`, `running-history/index.tsx`) — noté au §8 de la stratégie.
- **3 147 tests verts** (1 924 shared + 1 042 mobile + 181 admin). Couverture mobile **28,8 %**,
  `src/data/repositories` **45,8 %**. Typecheck, lint et seuils propres.
### 07/08/2026 — `feature/fuel01-socle-glucidique-coureur` — FUEL-01 livré : socle glucidique du coureur (RN-05 + RN-06)

Commit précédent : `8d7ac75`. **D1 → D7 et la maquette validées par Florian le 07/08/2026**, telles
que recommandées. Code livré en TDD (5 lots), US à `etape: recette`.
Vérifié : lint **0 erreur**, typecheck **0**, **3 175 tests verts** (181 admin + 1 046 mobile +
1 948 shared), `carb-target.ts` à **100 %** instructions/branches/fonctions/lignes.
✅ **Aucune migration, aucune sync rule, aucune dépendance native → recettable sur l'APK existant.**

#### Ajouté

- **`packages/shared/src/carb-target.ts`** — 4 briques pures, 22 tests. `computeCarbLoadLevel`
  (heures/semaine → `light`/`moderate`/`high`), `computeCarbsPerKg` (g/kg + fourchette + statut
  3 états, bornes incluses), `classifyRunningDay` (types de séance → journée dure/facile/repos/
  indisponible) et `weeklyEquivalentHours` (R6 bis, ci-dessous). Cloné sur `protein-target.ts` :
  même forme, même statut, mêmes bornes — deux macros lues côte à côte doivent se calculer pareil.
- **`CARB_TARGETS_G_PER_KG`** (3-5 / 5-7 / 7-10) et **`CARB_LOAD_THRESHOLDS_H`** (3 h, 6 h) —
  exportées et nommées, pas enfouies dans une condition : c'est ce qui rend praticable le critère de
  recette 9 (relecture par un pratiquant) et permet de corriger un seuil en une ligne.
- **`useCarbsPerKg`** (nutrition-repository) + `SELECT_TODAY_RUN_SESSION_TYPES`, 8 tests SQL sur
  base réelle : owner-scoping, filtre pilier, exclusion des séances sautées, **absence de `LIMIT`**
  (deux séances le même jour existent, la plus exigeante gagne), `session_type` NULL, soft delete.
- **Carte « Macros par kg »** — la carte protéines de MN-06 porte désormais les deux macros, via un
  sous-composant `MacroRow` mutualisé (la brique « jauge valeur vs cible » qu'ADR-007 §3 demande).
  8 tests, dont **4 de non-régression MN-06**.
- **i18n `stats.macrosPerKg.*`** FR + EN, alignement des deux fichiers vérifié par script
  (2 052 clés de chaque côté, aucun écart).
- **`RECETTES.md` §50** — 15 critères. 50 US en recette ↔ **50 sections**.

#### Technique / Notes

- 🔴 **Le garde-fou le plus important de cette US n'est pas une fonctionnalité, c'est un test.**
  `nutrition.test.ts` gagne un bloc « frontière avec MN-04 » : la cible du journal doit rester
  pilotée par les calories, et `nutrition.ts` ne doit **rien** importer de `carb-target.ts`. Sans
  lui, rien n'empêcherait un futur contributeur de brancher le g/kg sur la cible — ce qui ferait
  diverger deux chiffres affichés (425 g contre 490-700 g à gros volume pour 70 kg) et casserait le
  critère 5 de la recette de MN-04. C'est la traduction en code de la décision D1.
- **R6 bis ajoutée à l'implémentation** : la carte partage un sélecteur 7 j / 30 j avec les
  protéines, or les seuils sont **hebdomadaires**. Sur 30 jours, un cumul mensuel comparé à des
  seuils de semaine classerait presque tout en « gros volume ». La charge est donc normalisée en
  **équivalent hebdomadaire** (`heures ÷ jours × 7`). Sur 7 jours c'est l'identité : **R6 bis
  complète D6, elle ne la contredit pas** — elle définit le cas que la spec validée laissait ouvert.
- **Deux écarts assumés avec la maquette validée** (spec §10 bis), tous deux dans le sens du moins
  d'invention : les puces de statut reprennent le `statusColor()` **existant** de la carte (doré /
  accent / grisé) plutôt que les pastilles vert-ambre-rouge de la maquette, et les libellés de statut
  sont ceux des protéines. Donner aux glucides un second vocabulaire de couleur **dans la même
  carte** se lirait comme deux échelles différentes — et c'est ce qui rend vraie l'affirmation du
  §8 : aucune couleur nouvelle n'est introduite.
- **La requête des séances du jour vit dans `nutrition-repository.ts`, pas dans `run-repository.ts`**
  — délibérément : ce dernier est lu par RUN-F2b, RUN-F2c, RUN-F2d et RUN-F3, **toutes en recette**.
  Y ajouter une requête pour une autre US aurait élargi la surface de régression de quatre recettes
  en attente, pour aucun gain.
- ⚠️ **Découverte d'outillage, coûteuse et non documentée jusqu'ici** : dans ce dépôt,
  **`render()` de `@testing-library/react-native` est ASYNCHRONE** (RNTL 14 + React 19) — il renvoie
  une promesse. Sans `await`, les queries de `screen` échouent sur « `render` function has not been
  called », un message qui envoie chercher le problème au mauvais endroit ; et les queries
  destructurées de `render()` **n'existent plus** (il faut `screen`). Les tests d'écran existants
  masquent le premier point derrière un `setup()` `async` sans l'expliquer. C'est désormais écrit en
  tête de `ProteinPerKgCard.test.tsx`, pour le prochain.
- **Catalogue** : RN-05 et RN-06 passent 🆕 → ✅ avec le détail des décisions. **Aucune ligne de
  roadmap créée** (US d'analyse, catalogue seul — règle du 02/08/2026).
- **Reste 4 lots** au chantier « Nutrition du coureur » : RN-07/08/09/21 (autour de la sortie),
  RN-15/16/19/20 (sodium, fractionné, carburant embarqué, affûtage). Ils s'appuient tous sur ce socle.

### 07/08/2026 — `feature/fuel01-socle-glucidique-coureur` — FUEL-01 : cadrage du socle glucidique (catalogue RN-05 + RN-06)

Commit précédent : `5c6db3b`. **Cadrage seul — aucune ligne de code applicatif** (règle du workflow
obligatoire). Les 3 livrables d'amont sont écrits, l'US est à `etape: validation` et **attend
Florian ou Damien**. Lint **0**, typecheck **0**, **1 030 tests mobile verts**.

Premier lot du chantier « Nutrition du coureur » choisi par Florian le 07/08/2026 après audit du
catalogue : **RN-05 → RN-21, 9 analyses non cadrées**, la paire de piliers la plus pauvre du produit
(3 items livrés sur 21). Ce lot livre le **socle** — les 4 lots suivants (fueling de sortie longue,
recharge glycogène, sodium, affûtage) en dépendent.

#### Ajouté

- **Spec** [fuel01-socle-glucidique-coureur.md](docs/specs/functional/us/fuel01-socle-glucidique-coureur.md)
  — 7 décisions à arbitrer, 8 règles, 14 cas limites, 14 critères de recette, i18n FR+EN, offline.
- **Plan** [fuel01-socle-glucidique-coureur.md](docs/plans/fuel01-socle-glucidique-coureur.md)
  — 5 lots TDD, ~32 tests attendus, fichiers touchés, 6 risques et leurs parades.
- **Maquette** [design/fuel01-socle-glucidique-coureur/](design/fuel01-socle-glucidique-coureur/)
  — 5 états de la carte « Macros par kg », palette réelle du thème (aucune couleur inventée).

#### Technique / Notes

- 🔴 **Le cadrage a trouvé une collision, et c'est ce qui commande toute la spec.** Une cible
  glucidique **existe déjà** : `trainingDayMacroGrams` ([nutrition.ts:371](packages/shared/src/nutrition.ts)),
  livrée par **MN-04 le 04/08/2026**, calcule les glucides en **pourcentage des calories** (45/50/35 %
  selon l'objectif) plus le bonus d'entraînement redirigé à 100 % en glucides. RN-05, tel que le
  catalogue le décrit, propose une cible **en g/kg de poids de corps**. **Les deux ne donnent pas le
  même nombre**, et l'écart se creuse exactement là où la fonctionnalité sert : pour un coureur de
  70 kg en `maintain`, jour de repos **325 g vs 210-350 g** (compatible), semaine à gros volume
  **425 g vs 490-700 g** — soit **+65 à +275 g**.
  C'est le **schéma exact qui a coûté l'US GARDE-01** (TRI-12 et MR-14 validées à 2 jours d'écart en
  se contredisant), en pire : la contradiction porterait sur **un chiffre affiché**, donc visible.
- 🔴 **Et elle aurait fait régresser une recette en cours** : le critère 5 de MN-04
  ([RECETTES.md §42](RECETTES.md)) exige que « les 3 barres macro totalisent l'objectif calorique ».
  Une cible glucides pilotée par le poids de corps est indépendante des calories : **elle casse cette
  égalité**. → **D1 recommandée : indicateur descriptif, jamais prescriptif**, patron MN-06
  (protéines g/kg, livré et validé). Verrouillé par la règle R1 **et** par une assertion de test
  dédiée (lot 5 du plan) : si quelqu'un branche un jour la cible sur le g/kg, le test tombe.
- **D2 — zéro bloc ajouté à l'écran Stats nutrition**, qui en a déjà **8** quand ADR-007 §2 fixe le
  Tier 1 à « ~4-5 sections, au-delà → repliable ». La ligne glucides se fond dans la carte
  `ProteinPerKgCard` renommée « Macros par kg ». Précédent vieux de 3 jours et venu du **même
  écran** : NUTR-18 s'est fondue dans la carte Adhérence plutôt que d'ajouter un 9ᵉ bloc.
- **D6 — fenêtre glissante, et c'est un piège évité de justesse** : `aggregateRunStats(period:'week')`
  est **calendaire** ([run-stats.ts:33](packages/shared/src/run-stats.ts), lundi→dimanche). L'utiliser
  aurait fait chuter la charge de « gros volume » à « repos » **chaque lundi matin**, sans qu'aucun
  entraînement ne change. Un test dédié (« J-6 compte, J-7 non ») garde la règle.
- **D3 — charge mesurée en heures, pas en km** : même arbitrage que RUN-02 (« complète la distance
  pour les séances au temps/sans GPS »). Un tapis ou une saisie manuelle ont une durée fiable, pas
  toujours une distance.
- **D4 — une course libre ne se classe pas** : `course_libre` n'a structurellement pas de
  `session_type` — c'est la raison pour laquelle **RUN-07 est encore ⏳** au catalogue. Elle compte
  dans la **charge** (elle a une durée) mais pas dans le **classement** dur/facile. Précédent MUSC-20
  critère 2 : « indisponible », jamais un chiffre inventé.
- **D5 — les fourchettes sourcées sont assumées**, la ligne étant déjà franchie par
  `PROTEIN_TARGETS_G_PER_KG` (en production, commenté « heuristiques, ajustables »). Ce que le projet
  refuse est différent : MUSC-F14 refusait une **action** (suggérer un remplacement sans donnée
  articulaire), DOUL-01 refusait d'**expliquer** une douleur. ⚠️ Le vrai risque est celui des
  coefficients DOTS (MUSCPWR-01 critère 21) : un seuil faux produit un chiffre **plausible donc
  invisible en recette** → constantes exportées et nommées + critère de recette 9 (relecture par un
  pratiquant d'endurance).
- **Aucune migration, aucune sync rule, aucune dépendance native, aucune table ni colonne neuve** —
  vérifié : toutes les données lues existent et sont déjà synchronisées. Conséquence de D1 : une US
  qui ne fait que lire ne touche pas au schéma. **Recettable sur l'APK existant.**
- **Aucune ligne de roadmap créée** : US d'analyse, suivie au catalogue seul (règle du 02/08/2026,
  respectée depuis META-19). `roadmap: []`, `catalogue: [RN-05, RN-06]`.
- ⚠️ **Incident d'outillage à retenir** : la spec a d'abord été écrite avec des **fins de ligne CRLF**
  (écriture via Python sous Windows, qui traduit `\n` par défaut). Résultat : `scripts/etat.mjs` ne
  reconnaissait plus le front-matter et signalait « 1 spec sans front-matter » — l'US était
  **invisible dans ETAT.md**. Reconverti en LF. Toutes les autres specs sont en LF : **ne pas écrire
  de fichier suivi avec un outil qui traduit les fins de ligne.**

### 07/08/2026 — `chore/socle-tests-unitaires` — Bilan hebdo et rappels programmés : la course qui ressuscite un rappel

**16 tests** sur `useWeeklyReviewScheduler` (BILAN-01) et `useProgrammedRemindersScheduler`
(NUTR-F1 / MUSC-F8). `notification-repository` est désormais couvert sur ses trois planificateurs.

#### Ajouté

- **`programmed-reminders-scheduler.test.tsx` — 16 tests.**
  - **🔴 Le jeton de génération.** `apply()` commence par un aller-retour natif : deux invocations
    peuvent se chevaucher. Sans jeton, le `schedule` d'une passe **périmée** s'exécute *après* le
    `cancel` de la passe fraîche — et le rappel « pense à remplir ton journal » revient alors que
    le journal vient d'être rempli. Le hook étant réveillé par **deux tables surveillées**, chaque
    aliment ajouté déclenche un tour : le chevauchement n'est pas théorique. Le test bloque
    volontairement la première passe, en fait passer une seconde, puis débloque la première et
    vérifie qu'elle **n'écrit rien**.
  - **🔴 La semaine vide n'est pas notifiée** (BILAN-01, D4). Le rendez-vous `WEEKLY` est récurrent
    côté OS : sans annulation explicite, il notifierait une semaine sans rien à résumer.
  - **🔴 La logique inversée du rappel de séance** (MUSC-F8, D16). Pour le repas et la pesée,
    « déjà fait » = le geste est accompli ; pour la séance, c'est « rien à faire », donc **aucune
    occurrence planifiée**. Confondre les deux enverrait un rappel de séance à quelqu'un qui n'en
    a pas au programme.
  - Plus : la garde de chargement sur chacune des sources (décider avant résolution annulerait un
    rappel valide sur la foi d'un « déjà fait » simplement pas encore chargé), l'annulation des
    **trois** rappels quand la permission est refusée, et le désabonnement au démontage.

#### Technique / Notes

- ⚠️ **Piège de mock corrigé en cours de route** : `useNotificationPrefs` est défini **dans**
  `notification-repository` et lit `useSettings()`. Le mocker depuis `settings-repository` n'a
  aucun effet — les préférences restaient aux **valeurs par défaut**, où `mealReminder` et
  `weighInReminder` sont à `false`. Deux tests passaient donc au vert pour la mauvaise raison : le
  rappel était annulé parce qu'il est désactivé par défaut, pas parce que la règle l'avait décidé.
  C'est la source des réglages qu'il faut contrôler ; le commentaire le dit à l'endroit du mock.
- Deuxième rappel de la même leçon : `renderHook` renvoie une **promesse**. Sans `await`, le
  destructurage donne `rerender === undefined` (§3.6).
- Quality gate au vert : lint 0 erreur, typecheck 0 erreur, `npm run test:coverage` propre —
  **1 924 (shared) + 1 030 (mobile) + 181 (admin) = 3 135 tests**. Mobile 28,3 % → **28,8 %** ;
  `src/data/repositories` 43,7 % → **45,8 %**.

### 07/08/2026 — `chore/socle-tests-unitaires` — Planificateur de rappel : l'orchestration autour de la règle

**8 tests** sur `useStreakReminderScheduler` (US 2.6). Premier planificateur de
`notification-repository` couvert — un fichier de 477 lignes fait presque entièrement de hooks,
donc jusqu'ici hors de portée du harness SQL.

#### Ajouté

- **`streak-reminder-scheduler.test.tsx` — 8 tests.** La **décision**
  (`shouldScheduleStreakReminder` : heure, « ne pas déranger », activité du jour) vit dans
  `@wellness/shared` et y est testée. Ce qui n'était vérifié nulle part, c'est ce que le hook fait
  **autour** — et ces défauts-là produisent tous la même chose à l'écran : **rien**.
  - **🔴 Ne pas décider pendant le chargement.** Tant que l'activité du jour n'est pas résolue,
    planifier ou annuler revient à trancher sur des données incomplètes — donc à annuler un rappel
    légitime une fois sur deux, au hasard de la latence de la base locale. Le test vérifie qu'on ne
    demande même pas la permission dans cet état.
  - **Permission refusée → annuler ce qui est en attente.** Garder un rappel que l'OS ne délivrera
    jamais n'aide personne, et laisserait un état sale si la permission revenait.
  - **🔴 Réévaluer au retour au premier plan.** Il n'y a pas de tâche d'arrière-plan (limite
    assumée du MVP) : c'est le seul moment où l'app peut constater que l'utilisateur est devenu
    actif. Sans ce ré-examen, un rappel « ta série est en danger » partirait alors que la séance
    est déjà faite.
  - Plus : planification à la bonne heure avec le bon contenu i18n, annulation quand l'utilisateur
    est déjà actif, indifférence au passage en arrière-plan, désabonnement au démontage.

#### Technique / Notes

- ⚠️ **Piège de mock à connaître** : mocker `react-i18next` sans exposer `initReactI18next` fait
  échouer **la suite entière à l'import** (« You are passing an undefined module »), parce que
  `@/i18n` appelle `i18n.use(initReactI18next)` au chargement du module et que le repository
  l'importe. La clé est ajoutée au mock, avec le commentaire qui explique pourquoi.
- Quality gate au vert : lint 0 erreur, typecheck 0 erreur, `npm run test:coverage` propre —
  **1 924 (shared) + 1 014 (mobile) + 181 (admin) = 3 119 tests**. Mobile 28,0 % → **28,3 %** ;
  `src/data/repositories` 42,6 % → **43,7 %**.

### 07/08/2026 — `chore/socle-tests-unitaires` — Pesées, repas types, profil coureur

**20 tests** sur trois repositories courts, réunis parce qu'ils partagent la même famille
d'invariants : ce qui est **une ligne par jour**, ce qui est **un instantané**, et ce qui **ajoute**
au lieu de remplacer. `apps/mobile` franchit les **1 000 tests**.

#### Ajouté

- **`bodyweight-meal-template-sql.test.ts` — 20 tests.**
  - **🔴 Une pesée par jour.** Se repeser le soir doit **corriger** la valeur du matin, pas créer
    une seconde ligne. Deux lignes le même jour afficheraient deux points sur la courbe **et**
    fausseraient l'ancrage du poids de départ (NUTR-11) — donc toute la progression vers
    l'objectif. Testé aussi : une pesée supprimée n'est pas ressuscitée.
  - **`getLatestWeightKg` retourne la plus récente par DATE, pas la dernière écrite.** Le test
    enregistre une pesée du 5 août puis une saisie rétroactive du 1ᵉʳ : c'est bien celle du 5 qui
    remonte. Prendre la dernière écrite ancrerait la progression sur un poids que l'utilisateur
    n'a plus.
  - **🔴 Réappliquer un repas type AJOUTE, ça ne remplace pas.** Appliqué sur un déjeuner déjà
    rempli, il complète la liste et numérote à la suite — remplacer effacerait ce que
    l'utilisateur venait de saisir, sans confirmation. Et chaque application est un **instantané
    indépendant** : réappliquer deux lundis de suite donne deux repas distincts, pas deux
    références liées.
  - Supprimer un repas type **ne touche pas** aux repas déjà appliqués : ce sont des faits au
    journal, pas des références.
  - `upsertRunnerProfile` : patch partiel — l'allure de référence, mise à jour automatiquement par
    la détection de records, ne doit pas écraser au passage la fréquence hebdomadaire saisie à la
    main.

#### Technique / Notes

- J'avais écrit les tests du profil coureur autour d'un champ **`vmaKmh` qui n'existe pas** : la
  table porte `weekly_frequency`, `objective`, `level` et `ref_5k_pace_s_per_km`. Le harness l'a
  rejeté immédiatement (colonne absente du schéma), fixtures corrigées. Sans lui, un mock aurait
  accepté ce champ fantôme sans broncher.
- Quality gate au vert : lint 0 erreur, typecheck 0 erreur, `npm run test:coverage` propre —
  **1 924 (shared) + 1 006 (mobile) + 181 (admin) = 3 111 tests**. Mobile 27,8 % → **28,0 %** ;
  `src/data/repositories` 41,9 % → **42,6 %**.

### 06/08/2026 — `chore/socle-tests-unitaires` — Records d'allure : l'idempotence par l'arrondi

**19 tests** sur `running-record-repository`. Un record d'allure est un **fait définitif** dérivé
d'une trace GPS, et il alimente en cascade l'allure de référence du profil coureur — donc les zones
et les prédictions. Rien de tout cela n'est reproductible sans aller courir.

#### Ajouté

- **`running-record-sql.test.ts` — 19 tests.**
  - **🔴 L'idempotence par l'arrondi.** Le temps est arrondi **une seule fois**, et la comparaison
    se fait arrondi ↔ arrondi. Comparer le flottant brut au temps déjà stocké (entier) casserait
    tout : 299,6 s stocké à 300 rebattrait 300 à chaque rejeu — donc **une re-célébration à chaque
    ouverture de l'app**, sur un record vieux de six mois. Testé au rejeu simple, au triple rejeu
    (aucun doublon) et via le backfill.
  - **Le périmètre GPS.** Une course **manuelle** ne peut produire aucun record : sans cette garde,
    une distance saisie à la main deviendrait un record d'allure. Idem pour une course non
    terminée, sans trace, supprimée ou inconnue.
  - **La cascade vers le profil.** Battre le 5 km met à jour l'allure de référence — et
    **seulement** le 5 km : la dériver d'un 1 km la surestimerait nettement. Un test vérifie en
    plus qu'elle est dérivée du temps **arrondi retenu**, donc cohérente avec le record stocké.
  - Plus : un record n'est jamais **dégradé** par une course plus lente, et il est horodaté à la
    **fin de la course** et non à « maintenant » — sans quoi un backfill d'historique daterait tous
    les records du jour où on l'a lancé.

#### Technique / Notes

- Les traces de test sont générées par une fonction `track(km, allure)` qui produit un point tous
  les 100 m et passe par **les vraies fonctions d'encodage** (`encodeSegment` + `appendToTrack`).
  Écrire le format à la main le rendrait non représentatif au premier changement — le test
  continuerait de passer en testant autre chose.
- Quality gate au vert : lint 0 erreur, typecheck 0 erreur, `npm run test:coverage` propre —
  **1 924 (shared) + 986 (mobile) + 181 (admin) = 3 091 tests**. Mobile 27,3 % → **27,8 %** ;
  `src/data/repositories` 40,0 % → **41,9 %**.

### 06/08/2026 — `chore/socle-tests-unitaires` — Profil et recettes : le poids de départ

**24 tests** sur `profile-repository` et `recipe-repository`.

#### Ajouté

- **`profile-recipe-sql.test.ts` — 24 tests.** Le point dur est le **poids de départ**
  (règle NUTR-11) : figé au moment où la cible est posée, il sert de référence à toute la
  progression affichée. Deux façons de le casser, aucune visible à l'écran :
  - **🔴 le ré-ancrer à tort.** Ré-enregistrer la **même** cible depuis l'écran ne doit pas remettre
    le départ au poids d'aujourd'hui — sinon la progression déjà accomplie disparaît, sans le
    moindre message. Le test pose une cible, simule 4 kg perdus, re-valide la même cible et vérifie
    que le départ n'a pas bougé. Le pendant est testé aussi : une cible **modifiée** doit, elle,
    ré-ancrer.
  - **le prendre à la mauvaise source.** C'est la dernière **pesée** qui fait foi, pas le poids du
    profil — lequel peut dater de l'onboarding. Testé avec un profil à 85 kg et deux pesées : c'est
    la plus récente (78) qui ancre. Avec repli sur le profil s'il n'y a aucune pesée, et exclusion
    des pesées supprimées.
  - Effacer la cible efface **aussi** le départ : garder un départ orphelin laisserait une
    progression calculée vers rien.
- Côté recettes : l'ingrédient est un **snapshot** (même raison que le journal alimentaire —
  corriger la fiche d'un aliment ne doit pas déformer une recette écrite il y a six mois), et les
  portions ont un **plancher à 1**, testé sur 0, négatif et décimales : diviser les macros par zéro
  produirait des valeurs infinies à l'écran.

#### Technique / Notes

- Quality gate au vert : lint 0 erreur, typecheck 0 erreur, `npm run test:coverage` propre —
  **1 924 (shared) + 967 (mobile) + 181 (admin) = 3 072 tests**. Mobile 26,8 % → **27,3 %** ;
  `src/data/repositories` 38,2 % → **40,0 %**.

### 06/08/2026 — `docs/recettes-15-us-sans-criteres` — Les 15 US en recette sans critères (RECETTES.md §35-49)

Commit précédent : `a4e8f42`. Ferme la dette 🔴 ouverte le matin même par la réconciliation :
**49 US étaient à `etape: recette`, RECETTES.md n'avait que 34 sections**. Diff documentaire, aucun
fichier de code touché. Lint **0**, typecheck **0**, **2 960 tests verts**.

#### Ajouté

- **15 sections de recette, §35 à §49** — RUN-F1b, RUN-F2a, RUN-F2b, RUN-18, META-19, MUSC-F15,
  TRI-03, MN-04, MR-08, MUSC-12, MUSC-19, MUSC-20, NUTR-18, RN-03, GARDE-01. Ordre de livraison
  (02 → 04/08), format des 34 existantes. **565 critères cochables** au total dans le fichier.
  Vérifié par script : **49 US en recette ↔ 49 sections**, numérotation **1 → 49 continue et sans
  doublon**, tous les liens relatifs résolvent.
  Chaque section porte son en-tête de prérequis — spec, roadmap **ou** catalogue, migration, sync
  rule, dépendance native — établi **contre le code et le registre des migrations**, pas contre les
  specs seules.

#### Corrigé

- 🔴 **Cinq listes de critères étaient périmées, et c'est le vrai gain de l'exercice.**
  **META-19, GARDE-01, TRI-03, MR-08 et RN-03** décrivaient tous « le widget s'affiche sur
  l'accueil ». Or **INSIGHTS-02** (7.21, 05/08/2026) a ramené l'accueil de 21 à 7 widgets : leurs
  signaux sont devenus des **cartes d'insight** sur l'écran Insights
  ([widget-destinations.ts](packages/shared/src/widget-destinations.ts) — `training_load`,
  `overtraining_guard`, `readiness`, `concurrent_interference`, `activity_level`).
  Les recetter tels quels aurait produit **5 faux défauts**.
- 🔴 **Et un piège plus fin, ajouté en encadré commun aux §35-49** : un signal **armé n'est pas
  forcément affiché**. Le moteur plafonne à **3 cartes** (`MAX_INSIGHTS`) et **2 par famille**
  (`MAX_PER_FAMILY`), et ces 5 signaux sont **tous de la famille `alert`** avec `deficit_volume` :
  **au plus 2 coexistent**, dans l'ordre `overtraining_guard` › `training_load` › `readiness` ›
  `concurrent_interference` › `deficit_volume` › `activity_level`. L'absence d'une carte moins
  prioritaire est donc **le comportement voulu** — dit explicitement, avec la consigne d'isoler un
  signal avant de le recetter.
- **RN-03 est le seul des cinq mis en sourdine pendant une période « vie réelle »**
  (`REAL_LIFE_MUTED_INSIGHTS`) : les 4 autres sont des garde-fous de charge, volontairement armés en
  permanence. Le contraste est posé comme critère dans les deux sens (§48 pt 7 vs §39 pt 7) — c'est
  exactement le genre d'asymétrie qu'un recetteur remonte à tort.
- **§25 RUN-F2d — précision de build.** Sa spec dit « aucun nouveau build », vrai **relativement à
  RUN-F2a**, mais [interval-guidance.ts](apps/mobile/src/running/interval-guidance.ts) importe bien
  `expo-speech` : sur un APK antérieur au 02/08/2026 le guidage est **muet sans erreur**. La section
  le dit désormais.
- **Encadré « Comment procéder » refait.** Il annonçait « les dix US device » et ne listait plus la
  moitié du fichier. Remplacé par la liste réelle des **20 + 14 US recettables sur l'APK existant**
  et les **3 exceptions** qui exigent un APK précis : MUSC-F9 (`expo-haptics`), RUN-F2a **et
  RUN-F2d** (`expo-speech`), LAUNCHER-01 (`react-native-android-widget`).
  🔴 **Dit comme tel** : les 4 paquets sont bien dans
  [package.json](apps/mobile/package.json) et le build du 03/08 leur est postérieur, donc il
  **devrait** les embarquer — mais les APK ne sont pas versionnés, **le dépôt ne peut pas le
  prouver**. D'où une vérification de 30 secondes à faire avant de dérouler une liste, plutôt qu'une
  affirmation.

#### Technique / Notes

- **Méthode** : les critères viennent de la section « Critères d'acceptation » de chaque spec, mais
  **relus contre le code du 06/08** — c'est cette relecture qui a trouvé les 5 périmés. Les listes
  minces ont été complétées des vérifications transverses du fichier (mode avion, EN, TalkBack) et,
  là où la spec le fondait, d'un critère d'interaction avec VIE-01. **Rien n'a été inventé** : aucun
  critère ne porte sur un comportement que le code ne montre pas.
- **GARDE-01 (§49) porte 16 critères** : sa liste consolidée remplace celles de TRI-12 (§8) et MR-14
  (§11), passées à `close` — leurs critères décrivaient deux cartes et un masquage mutuel qui
  n'existent plus. Deux critères sont explicitement marqués **« ne pas remonter comme un bug »** (pas
  de compteur au niveau surcharge, carte encore visible le jour de repos en cours) : les deux sont
  des décisions tracées, pas des défauts.
- **Aucun front-matter d'US modifié** : les 15 restent à `etape: recette` — ce commit leur donne de
  quoi être recettées, il ne les fait pas avancer. Rien à changer non plus à la roadmap ni au
  catalogue.
### 06/08/2026 — `chore/socle-tests-unitaires` — Aliments : propriété et snapshot du journal

**26 tests** sur `food-repository`. Un aliment est partagé entre trois sources — la bibliothèque
CIQUAL (lecture seule, commune à tous), les aliments perso, et les produits OpenFoodFacts
importés — d'où deux invariants invisibles à l'écran.

#### Ajouté

- **`food-sql.test.ts` — 26 tests.**
  - **🔴 Le journal garde son snapshot (spec §8).** Un test seed une entrée de journal, modifie
    l'aliment (nom **et** kcal), et vérifie que l'entrée n'a pas bougé. Sans cette garantie,
    corriger la fiche d'un aliment réécrirait **rétroactivement des mois d'historique
    nutritionnel** — et personne ne s'en apercevrait, puisque les chiffres resteraient plausibles.
    Idem à la suppression : l'aliment sort de la recherche, le repas reste au journal.
  - **`owner_id` sépare « mon aliment » de « l'aliment de tout le monde ».** La bibliothèque a
    `owner_id = NULL` ; un oubli à l'écriture ferait apparaître un aliment perso dans la
    bibliothèque partagée, donc chez tous les utilisateurs après synchro. Testé sur les deux
    chemins de création (perso et import OFF), plus `isEditableFood` — la bibliothèque doit rester
    en lecture seule, sinon un utilisateur corrigerait l'aliment des autres.
  - **La recherche par code-barres existe pour éviter les doublons au rescan** : si elle rate, la
    base se remplit d'un produit de plus à chaque scan. Couvre le code rogné, le code vide (sortie
    avant toute requête), l'inconnu, et le fait qu'un aliment **supprimé** ne remonte pas — il est
    donc réimportable.
  - Plus : les macros absentes valent `null` et non `0` à l'import OFF (« on ne sait pas » ≠ « 0 g »,
    la nuance compte quand on additionne une journée), la gestion des traductions (mise à jour sans
    doublon, création si la langue courante manque, pas de résurrection d'une traduction supprimée)
    et les favoris (bascule réversible, aucune accumulation, pas de mélange entre aliments).

#### Technique / Notes

- Trois catégories inventées dans mes fixtures (`grains`, `sweets`) ont été rejetées par le
  typecheck : l'énumération réelle est `starchy` / `other`. Corrigé — c'est le genre d'écart que
  seul le type attrape, un test peut très bien passer au vert sur une valeur qui n'existe pas.
- Quality gate au vert : lint 0 erreur, typecheck 0 erreur, `npm run test:coverage` propre —
  **1 924 (shared) + 943 (mobile) + 181 (admin) = 3 048 tests**. Mobile 26,4 % → **26,8 %** ;
  `src/data/repositories` 36,8 % → **38,2 %**.

### 06/08/2026 — `chore/socle-tests-unitaires` — Réglages : le repository à l'origine de tout le chantier

**23 tests** sur `settings-repository` — celui dont une colonne manquante a produit le bug de la
recette du 31/07/2026 qui a lancé ce chantier.

#### Ajouté

- **`settings-sql.test.ts` — 23 tests.** Rappel du bug fondateur : `cycle_tracking_enabled` était
  absente du schéma PowerSync local, l'écriture échouait, `void updateSettings()` avalait l'erreur,
  et l'interrupteur restait éteint **sans le moindre message**. Un test nommé verrouille désormais
  cette écriture ; et comme le harness rejoue les requêtes contre le schéma réel, toute la classe
  de panne est devenue impossible à rater.

  Trois familles d'invariants, toutes silencieuses en cas de défaut :
  - **Le sens des défauts d'opt-in.** Health Connect et les deux réglages du cycle valent **OFF**
    en l'absence de ligne ou de valeur — un défaut inversé activerait une synchro de **données de
    santé** que personne n'a demandée. L'analytics, à l'inverse, est en **opt-out** : ON par
    défaut. Se tromper de sens ne se voit sur aucun écran. Chacun a son test, ligne présente comme
    absente, plus le cas de la ligne en soft delete.
  - **La tolérance des colonnes JSON.** `active_pillars`, `notifications` et `dashboard_layout`
    sont sérialisées à la main : une valeur illisible doit **retomber sur un défaut**, pas faire
    planter l'app au démarrage. Testé avec du JSON volontairement corrompu.
  - **Le patch partiel.** Régler le thème ne doit pas réinitialiser les piliers actifs. Et
    effacer la disposition du dashboard doit écrire un vrai `null`, pas la chaîne « null » — qui
    serait relue comme une valeur au lieu d'une absence.

  Plus `togglePillar` : réversibilité, pas de doublon dans la liste, création de la ligne complète
  quand elle n'existe pas encore.

#### Technique / Notes

- Quality gate au vert : lint 0 erreur, typecheck 0 erreur, `npm run test:coverage` propre —
  **1 924 (shared) + 917 (mobile) + 181 (admin) = 3 022 tests**. Mobile 26,1 % → **26,4 %** ;
  `src/data/repositories` 35,7 % → **36,8 %**.

### 06/08/2026 — `chore/socle-tests-unitaires` — Modèles de séance : la copie figée

**20 tests** sur `workout-template-repository` (503 l., le plus gros repository encore nu).

#### Ajouté

- **`workout-template-sql.test.ts` — 20 tests.** Un template est une **copie figée** : c'est tout
  l'intérêt du concept, et c'est aussi ce qui se casse sans bruit. Trois propriétés portent le
  tout, aucune visible à l'écran :
  - **`createTemplateFromWorkout` fige des cibles, pas des références.** Un test modifie la séance
    d'origine *après* création du modèle et vérifie qu'il n'a pas bougé — un template qui suivrait
    sa séance cesserait d'être un modèle.
  - **`duplicateWorkoutTemplate` copie en transaction** : une source introuvable ne doit pas
    laisser d'entête orpheline. Un template vide s'afficherait comme un template normal, avec des
    exercices en moins — pire qu'une erreur franche.
  - **`startWorkoutFromTemplate` respecte la garde « une seule séance active »**, comme
    `startWorkout` et `startWorkoutFromSession`. Trois portes d'entrée, une seule règle : c'est le
    genre d'invariant qu'on oublie de rejouer sur la troisième. Le test vérifie en plus qu'**aucune
    série pré-remplie ne vient polluer la séance déjà en cours**.

#### Technique / Notes

- ⚠️ **Une divergence volontaire est désormais verrouillée par un test** : `buildSummary` (résumé
  de fin de séance) **écarte** les échauffements du décompte — il rend compte de l'effort ;
  `deriveTemplateTargetsFromWorkoutSets` les **garde** — un modèle sert à *reproduire* une séance,
  échauffement compris. Deux fonctionnalités voisines, deux traitements opposés, faciles à
  confondre. Le test existe pour que ça reste un choix : aligner les deux « pour faire propre »
  casserait le modèle de quelqu'un.
- J'avais d'abord écrit deux tests supposant que les échauffements étaient exclus **ici aussi**.
  Ils ont rougi ; c'est la supposition qui était fausse, pas le code. Tests réécrits sur le
  comportement réel — et la divergence documentée plutôt que gommée.
- Quality gate au vert : lint 0 erreur, typecheck 0 erreur, `npm run test:coverage` propre —
  **1 924 (shared) + 894 (mobile) + 181 (admin) = 2 999 tests**. Mobile 25,7 % → **26,1 %** ;
  `src/data/repositories` 33,9 % → **35,7 %**.

### 06/08/2026 — `chore/socle-tests-unitaires` — Résumé de séance : la règle des échauffements

Suite du lot 5. **11 tests** sur `buildSummary` (`workout-summary.tsx`), la fonction qui produit
les chiffres du récapitulatif de fin de séance.

#### Ajouté

- **`workout-summary-build.test.ts` — 11 tests.** La règle des échauffements (spec Refonte-C2 §2.5)
  est **invisible en recette** : pour constater qu'un exercice composé *uniquement* de séries
  d'échauffement ne doit pas compter, il faudrait délibérément en faire un et recompter le résumé à
  la main. Personne ne le fait — et si le filtre sautait, le résumé annoncerait simplement « 2
  exercices » au lieu d'un, sans que rien ne cloche à l'œil.

  Couvre les trois faces de la règle : les échauffements sont comptés **à part** (jamais dans les
  séries validées), exclus du **tonnage**, et un exercice qui n'en a que ne compte pas comme
  exercice. Plus les séries non validées (y compris un échauffement non validé, qui ne compte
  nulle part), et la durée — arrondi à la minute, **plancher d'une minute** pour qu'une densité ne
  se divise jamais par zéro.

- `buildSummary` passe `export`, avec le motif habituel écrit en commentaire : consommée nulle part
  ailleurs, exportée pour être vérifiable. **On teste la fonction plutôt que l'écran** : la règle
  est une fonction pure au-dessus des séries, et l'écran n'y ajoute que de la mise en forme —
  monter tout l'écran aurait coûté une dizaine de mocks pour la même assertion.

#### Technique / Notes

- Les briques de calcul (`computeVolume`, `computeTrainingDensity`) restent testées dans
  `@wellness/shared` : ce qui est vérifié ici, c'est **ce qu'on leur donne à manger**.
- Quality gate au vert : lint 0 erreur, typecheck 0 erreur, `npm run test:coverage` propre sur les
  3 workspaces — **1 924 (shared) + 874 (mobile) + 181 (admin) = 2 979 tests**.

### 06/08/2026 — `chore/socle-tests-unitaires` — Effets de montage de `cycle` et `help`, et **§3.6 corrigée**

Reprise du lot 5. En voulant « rattraper » les `*-smoke.test.tsx`, j'ai découvert que le problème
que j'avais documenté **n'existait pas** — et que la §3.6 disait deux choses fausses.

#### Correction du diagnostic (2ᵉ passe sur le même sujet)

`render()` et `renderHook()` de RNTL 14 renvoient des **promesses** : c'est l'`await` qui exécute
les effets de montage. Rien d'autre n'est nécessaire.

Le diagnostic du 03/08 (« RNTL enveloppe le montage dans un `act` asynchrone qu'il faut laisser
passer », d'où un idiome `await act(async () => { view = render(...) })`) venait d'un **`await`
oublié dans ma sonde**. Conséquences corrigées ici :

- **Le helper `render-with-effects.tsx`, créé il y a une heure, est supprimé** : il contournait un
  problème inexistant.
- **Mes propres tests sont simplifiés** (`useAuthDeepLink`, `app-state-hooks`) : `await
  renderHook(...)` remplace la danse autour d'`act`. Un `act` explicite ne subsiste que là où il
  est réellement utile — les déclencheurs **hors React** (gestionnaire d'`AppState`, de deep link,
  appelés à la main).
- **L'affirmation « les `*-smoke.test.tsx` n'assertent que du rendu statique » était fausse.** Ils
  font tous `await render(...)` : leurs effets s'exécutent. La « reprise » inscrite au plan et au
  BACKLOG n'a pas lieu d'être et est retirée.

Ce qui reste vrai, et qui est la seule chose à retenir : **sans `await`, un test d'effet passe au
vert sans rien exécuter.**

#### Ajouté

Le vrai écart n'était pas l'outillage mais des **comportements que personne n'assertait**. Deux
sont couverts (4 tests) :

- **`cycle/index.tsx` déclenche `autoCloseStalePeriods` à l'ouverture** (US CYCLE-01, R3 : « à
  appeler à l'ouverture de l'écran, pas sur un minuteur — c'est une correction de saisie, pas un
  fait à horodater »). Vérifie aussi qu'elle **ne part pas** quand le suivi est désactivé : écrire
  dans une donnée de santé sensible sur un écran auquel on n'a pas accès serait invisible **et**
  non consenti.
- **`help.tsx` émet `help_opened` au montage** (US 9.10), et **une seule fois** — ouvrir des
  questions de la FAQ ne doit pas regonfler la mesure.

#### Modifié

- `docs/specs/technical/strategie-tests.md` — **§3.6 réécrite** (« `await` le rendu, tout
  simplement »), avec les deux fausses pistes consignées pour qu'elles ne soient pas rouvertes :
  `IS_REACT_ACT_ENVIRONMENT`, et le helper supprimé. Lot 5 actualisé.

#### Technique / Notes

- Mesure faite avant de conclure, cette fois : `await render(<C/>)` → l'espion du `useEffect` est à
  **1** ; sans `await`, à **0**. Idem pour `renderHook`.
- Sur les 16 `*-smoke.test.tsx`, **seuls 3 composants testés ont des effets** (`cycle/index`,
  `help`, `CelebrationCard`) : l'écart réel était bien plus étroit que ce que ma formulation
  laissait croire.
- Quality gate au vert : lint 0 erreur, typecheck 0 erreur, `npm run test:coverage` propre sur les
  3 workspaces — **1 924 (shared) + 863 (mobile) + 181 (admin) = 2 968 tests**.

### 06/08/2026 — `chore/reconciliation-06-08-2026` — Réconciliation code ↔ documentation (13 écarts)

Commit précédent : `7599be2`. Audit `/reconcilier` complet (roadmap, catalogue, backlog, specs,
migrations, git). **Diff 100 % documentaire — aucun fichier de code touché.** Vérifié :
lint **0**, typecheck **0**, **2 943 tests verts** (181 admin + 842 mobile + 1 920 shared), codes de
sortie lus sans pipe.

**Deux arbitrages Florian du 06/08/2026** : (1) la convention ✅ — **option A** ; (2) le chantier
Codex — **abandonné**. Et une confirmation : **les sync rules PowerSync sont à jour**.

#### Modifié

- **Convention de statut tranchée (roadmap, en-tête).** ✅ = **le code est complet** ; une recette
  device en attente ne fait **plus** redescendre une ligne à 🟡, réservé à un socle réellement
  incomplet. La règle était déjà écrite ligne à ligne (7.19, 7.20, 7.21, 1.27, 3.57) mais **15 autres
  lignes appliquaient l'inverse** : la colonne mesurait deux choses à la fois.
  → **15 lignes 🟡 → ✅** : 1.24, 1.25, 1.26, 3.51, 3.55, 7.14, 7.15, 7.16, 7.17, 8.11, 4.27, 4.28,
  4.29, 1.28, 1.29. Restent **4 🟡**, les seuls trous réels : **2.4** (rappel 30 min impossible,
  `scheduled_date` est un jour sans heure), **5.24** (météo, RUN-F3b), **3.52** (pas de parcours
  « remplacer » dans l'éditeur de programme), **4.37** (vivier limité aux aliments récents).
  Ce découpage confirme l'audit du 05/08 (« 15/17 des 🟡 sont de la dette de recette »).
- **Compteurs : 196/19/2 → `211 livré / 4 partiel / 2 à faire` sur 223** (~89 % → **~95 %**).
  L'agrégat était déjà juste ; c'est le **« Détail par version » qui ne s'additionnait plus**
  (somme **219 ≠ 223**) avec **5 lignes fausses sur 12**, recalculées ligne à ligne :
  · **V0.4** annoncé 32 ✅ / 2 ⬜ → **34 ✅** (la note « 2 notifs manquantes » était périmée : 1.14 et
  2.5 livrées le 30/07 par NUTR-F1) · **V0.8** annoncé (10) → **9 lignes** (9.16 vit physiquement dans
  le tableau V0.9, total faux depuis le 31/07) · **V0.9** annoncé (16) 4/7/5 → **17 lignes, 15 ✅ /
  2 🟡** · **Hors cadrage** annoncé (20) → **24 lignes** (les 4 créées depuis le 05/08 — 7.20, 7.21,
  1.28, 1.29 — n'avaient pas été comptées) · **V0.1** 1 ⬜ → **1 ⏳** (9.14 est reporté, pas à faire).
  Contrôlé par script : lignes **223**, colonnes **211/4/2/2/4 = 223**.
- **Périmètre : « ~210 fonctionnalités (179 + 17 + 14) » → 223, compté et non estimé.**
  L'en-tête « réconcilié le 03/08 » redaté au 06/08.
- 🔴 **Déclaration Google Play « Health apps » : 4 → 6 types.** Deux fichiers sur quatre étaient à
  jour. `health-connect-play-declaration.md` §2 bis annonçait **6 types** depuis le 30/07/2026
  (CYCLE-01 ajoute `READ_MENSTRUATION` / `WRITE_MENSTRUATION`), mais le **§4 de la fiche LANCE-00**
  et le bullet « Décisions bloquantes » de la roadmap annonçaient encore **4**, et le backlog **4**
  en tête et **3** dans les prérequis. **La déclaration se dépose une seule fois** : la déposer à 4
  types imposait une re-déclaration complète et **~2 semaines de délai externe** sur le chemin
  critique du lancement. L'écart le plus coûteux de l'audit.
- **RECETTES.md — le « ⛔ Prérequis bloquant » devient une checklist par collage.** Il était coché
  `[x]` (« fait le 29/07 ») et n'énumérait que les 4 changements de ce collage, alors que **6 lignes
  de sync rule ont été ajoutées après** : `session_intervals` ×2 (03/08), `meal_plan_entries` /
  `shopping_lists` / `shopping_list_items` (04/08), `real_life_periods` (05/08). Pendant deux
  semaines l'encadré annonçait « prérequis levé » sans l'être. Florian confirme le déploiement à
  jour → **les 8 mentions bloquantes du fichier sont levées, plus aucun ⛔**.
- **CLAUDE.md — 6 compteurs périmés** : « ~194 fonctionnalités » ×2 → **223** · « 74 specs d'US » →
  **129** · « 72 plans » → **120** · « migrations (44) » ×2 → **79**. Et le résumé d'état annonçait
  **3 items bloquants** (9.9, 9.11/9.12, 9.2) alors que 9.9 est recetté depuis le 28/07 et 9.11/9.12
  livrés le 01/08 → **il ne reste que 9.2**, dont tout le chemin critique est hors-code.
- **Catalogue d'analyses : « 11 ⏳ » → 8.** Les 3 derniers ⏳ actionnables (**MUSC-16** %1RM,
  **MUSC-27** DOTS, **MUSC-29** total SBD) ont été livrés le 04/08 par MUSCPWR-01 et leurs lignes
  passées ✅ le jour même, mais le paragraphe de réconciliation n'avait pas suivi. Compté sur les
  220 items : **71 ✅ · 131 🆕 · 9 🟡 · 8 ⏳ · 1 ❌**. Il ne reste **aucun ⏳ actionnable** hors
  RUN-07 et META-18.

#### Corrigé

- **Deux collisions de numéro de roadmap, ouvertes depuis le 30/07/2026.** `7.14` désignait à la fois
  « Joker de série » (V0.9) et « Cercle d'accent sur les cartes » (hors cadrage) ; `4.37` à la fois
  « Substitution d'aliments » (V0.9) et « Refonte visuelle du journal alimentaire » (hors cadrage).
  → les deux lignes **hors cadrage** sont renumérotées **7.22** et **4.39** : ce sont les specs qui
  possèdent les numéros d'origine (`streak01-joker.md` → `roadmap: [7.14]`,
  `nutrf2-substitution-aliments.md` → `roadmap: [4.37]`), donc **aucun front-matter à propager**.
  Vérifié par script : **plus aucun numéro en double** dans le fichier.
  Referme la dette ouverte au backlog le 02/08/2026.

#### Supprimé

- **BACKLOG.md purgé : 338 → 187 lignes.** **34 lignes de candidats barrées** (déjà livrés, donc
  sortis du backlog par définition) et **11 entrées de dette cochées** retirées, avec les 3 sections
  devenues vides (« Enrichissements V0.9 », « Finitions UX », « 2ᵉ salve »). Le fichier reproduisait
  le défaut que la refonte du 26/07 devait supprimer : il ne faisait plus que grossir. La trace vit
  dans ce CHANGELOG. Restent **5 candidats réels** (LANCE-00, LANCE-01, RUN-F3b, SOCLE-01) et
  **9 dettes ouvertes**.
- **CONTENU-01 sorti des candidats P1.** Il a une spec depuis le 28/07 (`etape: recette`) et devait
  quitter le fichier en entrant dans le pipeline — il y était resté, **en contradiction avec ETAT.md**
  qui l'excluait déjà. Ce qui reste ouvert dessus est une décision de contenu (travail de coach), pas
  un candidat de dev.

#### Ajouté

- 🔴 **Dette nouvelle, la plus grave de l'audit : 15 US en recette sans aucun critère cochable.**
  **49 US** sont à `etape: recette`, **34 sections** existent dans RECETTES.md. Manquent **GARDE-01,
  META-19, MN-04, MR-08, MUSC-12, MUSC-19, MUSC-20, MUSC-F15, NUTR-18, RN-03, RUN-18, RUN-F1b,
  RUN-F2a, RUN-F2b, TRI-03** — et **4 lignes du backlog pointaient vers ces sections inexistantes**.
  Leurs critères vivent dans leur spec, mais rien n'est cochable : personne ne sait ce qu'il reste à
  vérifier sur device. C'est exactement l'information que RECETTES.md existe pour empêcher de mourir
  avec la session qui l'a produite. Consignée en tête de RECETTES.md **et** en P0 de la dette.
- **IDEAS.md — archive du chantier Codex abandonné.** `chore/compatibilite-claude-codex`, **5 commits
  / 1 318 insertions** (skill `/commit` partagé, `.codex/config.toml`, `docs/agent-workflows/`,
  `scripts/check-agent-compat.mjs`, plan + design du 21/07/2026), **jamais mergé** — les 6 fichiers
  sont absents de `dev` — et **cité nulle part** : zéro occurrence de « codex » dans BACKLOG.md,
  IDEAS.md, la roadmap ou CLAUDE.md. Trois semaines durant, du travail réel n'existait dans aucun
  fichier de suivi : **c'est l'angle mort que l'audit « code → roadmap » cherche**. Décision Florian :
  on n'entretient pas deux outillages d'agent en parallèle. **La branche est conservée** (seule trace
  du travail) et référencée dans la dette.

#### Technique / Notes

- **Méthode.** Chaque statut a été vérifié **contre le code**, jamais contre un fichier de suivi.
  Confirmés exacts, donc **non touchés** : `9.2` et `1.20` en ⬜ (aucun code d'import — 0 occurrence
  de `parseHevy`/`parseStrong`/MyFitnessPal ; `gpx.ts` n'expose que l'export de 5.33) · `5.24` en 🟡
  (0 occurrence de `weather`) · `2.4` en 🟡 (recadrage réel, `notifications.ts:339`) · catalogue ⏳
  **NUTR-12**/**RN-14** et **RUN-24** (aucune notion d'hydratation ni de fréquence cardiaque — les
  occurrences de « hydrat » sont des `store.hydrate()` Zustand) · **registre des migrations 79/79**,
  aucun écart dans les deux sens · **aucune spec livrée sans ligne de suivi** (les seules à
  `roadmap: []` **et** `catalogue: []` sont les deux `fix-*`, explicitement exclues).
- **Non vérifiable depuis le dépôt, dit comme tel** : le déploiement réel des sync rules sur le
  dashboard PowerSync. Le YAML versionné est la **source**, pas l'état de l'instance. Retenu sur
  **confirmation explicite de Florian**, pas sur une preuve de code.
- **Signalé sans trancher** : **MUSC-17** (« Courbe de force SBD ») reste 🆕 au catalogue et c'est
  défendable — mais la moitié de la brique existe et tourne déjà (`sbdHistory()`,
  `strength-sbd.ts:78`, appelée par `strength-repository.ts:167`). Elle n'alimente que `projectSbd`,
  **aucune courbe n'est rendue** et la comparaison des 3 lifts n'existe pas. L'item est bien moins
  cher qu'il n'en a l'air.
- **Branche.** Ce commit **n'est pas parti sur `feature/doul01-journal-zones-douloureuses`**, où la
  session s'était ouverte : `HEAD` y était déjà à `dev` (DOUL-01 intégrée), une réconciliation n'a
  rien à y faire. Branche dédiée `chore/reconciliation-06-08-2026`, patron de
  `chore/reconcilier-catalogue-analyses`.
- **Deux branches locales mortes** consignées en dette : `feature/1.15-unites-metrique-imperial`
  (1 commit orphelin `5c4901b` ne touchant que `TODO.md`, fichier supprimé depuis) et
  `chore/compatibilite-claude-codex` (conservée volontairement).
- **Aucun front-matter d'US modifié** : ce commit ne fait avancer aucune US, il corrige la
  documentation de suivi. `main` reste à **1 088 commits** de retard sur `dev` (dette ouverte,
  à traiter à LANCE-01).
- ⚠️ **Rebasé sur `7599be2`** : `origin/dev` avait avancé de 2 commits pendant l'audit
  (`46781a7` hooks `AppState` + `shared` à 100 %, `7599be2` résolution ESLint du monorepo), qui
  touchaient **les 3 mêmes fichiers de suivi**. Conflits résolus à la main : CHANGELOG **fusionné**
  (mes entrées au-dessus des leurs, même journée), ETAT **régénéré**.
  🔴 **Un arbitrage à signaler, pour qu'il ne passe pas pour une perte** : leur commit avait ajouté à
  BACKLOG.md une entrée de dette **`[x]` close** (le faux positif `eslint-config-expo` /
  `moduleDirectory` et ses 2 fausses pistes). La purge de ce commit la retire — **par la règle, pas
  par accident** : ce fichier ne garde que ce qui reste à faire. Son contenu n'est **pas perdu**, il
  est intégralement dans leur propre entrée de CHANGELOG ci-dessous, qui est sa place.
### 06/08/2026 — `chore/socle-tests-unitaires` — La CI repasse au vert : résolution ESLint du monorepo

Correctif du point 🔴 signalé dans l'entrée précédente (`46781a7`). **La cause n'était pas celle
qu'on croyait**, et elle ne concerne pas que ce paquet.

#### Corrigé

- 🔴 **`npm run lint` échouait sur `dev`** (`import/no-unresolved` sur
  `react-native-android-widget`, 3 fichiers de `src/widgets/`).

  **Ce n'était ni un défaut d'installation, ni un défaut du paquet.** Diagnostic mené par
  élimination : le paquet est au lockfile committé, `require.resolve` le trouve, et le résolveur
  d'`eslint-plugin-import` appelé **à la main** le trouve aussi. Le fil conducteur était ailleurs :
  `npx eslint .` passait, `expo lint` échouait — sur le même fichier, la même config.

  `eslint-config-expo` configure le résolveur `node` avec les bonnes extensions mais **sans
  `moduleDirectory`** : la recherche part alors du **répertoire de travail** d'ESLint, qui diffère
  entre les deux invocations. `npm run lint` appelant `expo lint`, **c'est la version qui échoue
  que lance la CI**.

  Le piège n'est pas propre à ce paquet : **tout paquet hoisté à la racine et non dupliqué** dans
  `apps/mobile/node_modules` peut déclencher le même faux positif, au gré des arbitrages
  d'installation de npm. Le correctif rend donc les **deux racines de recherche explicites**
  (`node_modules` et `../../node_modules`) dans
  [`apps/mobile/eslint.config.js`](apps/mobile/eslint.config.js), plutôt qu'une exception par
  paquet — qu'il aurait fallu rouvrir à chaque nouvelle dépendance. Les extensions sont réimportées
  du préréglage Expo pour ne pas en dupliquer la liste.

#### Technique / Notes

- Quality gate **entièrement au vert**, pour la première fois depuis l'intégration des 33 commits :
  lint 0 erreur, typecheck 0 erreur, `npm run test:coverage` (seuils inclus) propre sur les
  3 workspaces — **1 924 (shared) + 859 (mobile) + 181 (admin) = 2 964 tests**.

### 06/08/2026 — `chore/socle-tests-unitaires` — Hooks `AppState` + `shared` remis à 100 %, et **la CI est rouge**

Reprise du lot 5 après l'intégration de 33 commits sur `dev`. Le quality gate a été passé **avant**
d'écrire quoi que ce soit : trois portes étaient rouges, dont une qui l'est encore.

#### 🔴 À savoir en priorité — `npm run lint` échoue sur `dev`

Les 3 imports de `src/widgets/` (LAUNCHER-01) déclenchent `import/no-unresolved` sur
`react-native-android-widget`. **Ce n'est pas un défaut d'installation** : le paquet est au
lockfile committé, `npm ci` l'installe, et `require.resolve` le trouve — seul le résolveur
d'`eslint-plugin-import` échoue. La CI lançant `npm run lint`, **elle est rouge**. Inscrit au
BACKLOG avec la piste (le paquet n'a ni `exports` ni extension dans `main`). **Non corrigé ici** :
c'est de la config ESLint sur du code que je n'ai pas écrit, et le faire au passage mélangerait
les sujets.

Deux **fausses pistes** écartées au passage, pour que personne ne les rouvre :
- **11 erreurs de typecheck** sur `/meal-plan`, `/pain`, `/insights`, `/strength-lifts` : dues à un
  `.expo/types/router.d.ts` **local et périmé**, généré avant l'arrivée de ces écrans. Le dossier
  est gitignoré donc absent en CI — le supprimer suffit, et le typecheck repasse au vert (0 erreur).
- **`packages/shared` sous son seuil de 100 %** : celui-là était un **vrai** trou, corrigé ci-dessous.

#### Corrigé

- **`packages/shared` était retombé à 99,96 %**, sous le seuil de 100 % posé après l'avoir atteint.
  Deux branches non couvertes, la même dans les deux cas : le `return winner` / `return best` d'un
  `reduce` — celui qui **garde** le gagnant courant quand le candidat suivant est moins grave ou
  plus ancien. 4 tests ajoutés (`pain-zones`, `real-life`), tous formulés comme le **miroir** d'un
  test existant, ordre d'entrée inversé : le verdict ne doit pas dépendre de l'ordre des lignes
  remontées par la base, qui n'est garanti par rien. Retour à **100 %**.

#### Ajouté

- **`app-state-hooks.test.tsx` — 17 tests** sur les trois hooks branchés sur `AppState`, montés une
  fois à la racine :
  - **`useAppOpenedAnalytics`** : le throttle de 30 min vit dans une variable de module pour
    survivre aux remontages. Vérifier ça en vrai demande d'ouvrir et refermer l'app plusieurs fois
    en surveillant `analytics_events`. Couvre l'invariant du code — **sans session, aucun jalon
    n'est posé**, donc un démarrage déconnecté ne consomme pas la fenêtre et le premier
    `app_opened` est capté dès l'arrivée de la session.
  - **`useTodayKey`** : la garde d'idempotence (même référence quand le jour n'a pas changé) évite
    de re-rendre tous les abonnés — c'est-à-dire l'essentiel du dashboard — à chaque retour au
    premier plan. Et le rafraîchissement au passage de minuit.
  - **`useHealthConnectImports`** : les trois imports partent **sans être sérialisés**, un import
    qui traîne ne retenant pas les autres.

#### Technique / Notes

- Le test « l'échec de l'un ne bloque pas les autres » a été **réécrit** : il simulait un rejet que
  le service ne produit **jamais** (il ne jette pas, par contrat) et provoquait une rejection non
  gérée. Remplacé par un import qui **traîne** — ce qui teste le vrai invariant, l'absence de
  sérialisation, au lieu d'un scénario impossible en production.
- `jest.resetModules()` a été écarté pour rouvrir la fenêtre de throttle : il recharge React et
  casse les hooks (« Cannot read properties of null »). Remplacé par une **horloge de test avancée
  monotoniquement** entre les scénarios. `AppState.addEventListener` doit être espionné
  explicitement : le preset ne le mocke pas, et sans espion **tous les tests de retour au premier
  plan passeraient au vert sans rien déclencher**.
- Quality gate : typecheck **0 erreur**, `npm run test:coverage` (seuils inclus) au vert sur les
  3 workspaces — **1 924 (shared) + 859 (mobile) + 181 (admin) = 2 964 tests**. Lint : voir le
  point 🔴 ci-dessus.

### 06/08/2026 — `feature/doul01-journal-zones-douloureuses` — Journal des zones douloureuses (roadmap 1.29)

Suite de `a26d685`. Déclarer une zone sensible sur un schéma corporel, en garder l'historique, et
recevoir un **fait daté** quand une séance planifiée cible une zone récemment signalée. Idée promue
depuis IDEAS.md (13/07/2026).

**2 943 tests** (1 920 shared `+40`, 842 mobile `+18`, 181 admin), typecheck et lint à **0 erreur**.
**3 migrations poussées**, **sync rule déployée** — recettable immédiatement, sur l'APK existant.

**4 arbitrages Florian** : zones **muscles + articulations** · **signal factuel, jamais de conseil** ·
3 niveaux (gêne / douleur / bloquant) · **substitution hors périmètre**.

#### 🔴 La correction de cadrage qui définit l'US

L'US **ne débloque pas** la substitution d'exercice, contrairement à ce qui avait été annoncé à l'oral
en la proposant. MUSC-F14 n'avait pas retiré le motif « zone douloureuse » faute de savoir *où*
l'utilisateur a mal, mais faute d'**information articulaire et de schéma de mouvement sur
`exercises`** (sa spec §0.1). Ce journal fournit la moitié gauche de l'équation ; la droite reste
absente, et suggérer un remplacement serait un **conseil de santé inventé**.

**Conséquence structurante, et testée** : les 10 zones **musculaires** produisent un signal
(projetables vers `FINE_MUSCLES`), les 8 zones **articulaires** n'en produisent aucun — on sait qu'un
squat charge les quadriceps, pas qu'il charge le genou. Un test vérifie que les articulations n'ont
**aucune** projection, pour que personne ne « corrige » un jour cette asymétrie en croyant combler un
oubli.

#### Ajouté

- **`packages/shared/src/pain-zones.ts`** — vocabulaire (18 zones, 3 niveaux), fraîcheur glissante de
  7 jours, projection partielle, choix du signal, `dominantFineMuscles`. **40 tests.**
- **Table `pain_reports`** (3 migrations) + sync rule + `powersync/schema.ts` + export RGPD.
  ⚠️ **`zone` sans `CHECK`** (liste applicative évolutive ; une violation bloquerait la file d'upload
  PowerSync — patron `meal_key` de REPAS-01), `level` **avec** `CHECK` (3 valeurs fermées).
- **`pain-repository.ts`** + **12 tests SQL**. La garde d'opt-in est **dans le repository**, pas
  seulement dans l'UI : une route atteinte par deep-link ne doit pas pouvoir écrire une donnée de
  santé — défaut relevé en recette de CYCLE-01.
- **`PainBodyMap.tsx`** — 8 pastilles articulaires ajoutées à la géométrie existante. Muscles =
  plaques, articulations = pastilles : la **forme** distingue `shoulders` de `shoulder_joint` sans
  lire un libellé. Trois niveaux par **trois teintes**, pas trois opacités (MUSC-F1b avait constaté
  qu'une 3ᵉ opacité est illisible).
- **Écran `/pain`** (+ route déclarée dans `_layout.tsx` — leçon PAS-01), **bandeau de signal** sur le
  planning, **réglage d'opt-in**, **42 clés i18n × FR/EN**.
- **Test de vocabulaire interdit** (6 cas) : les clés `pain.*` échouent sur « blessure », « repos
  conseillé », « consulte », « guérison »… La règle R6 est exécutable, pas déclarative.

#### Modifié

- **`BodyMap.tsx`** — **un seul changement** : `MUSCLE_PATHS` est exporté. Trois écrans en dépendent
  (`exercises/[id]`, `programs/[id]`, `review`), dont deux en recette : on duplique la géométrie dans
  un composant distinct plutôt que de rendre celui-ci interactif.
- **`planned-session-repository.ts`** — `useWeekPainSignals` réutilise **la requête d'enrichissement
  de COLLIS-01** plutôt que d'en écrire une seconde : même chiffre, et deux requêtes auraient divergé.
- **`settings-repository.ts` / `settings.ts` / `powersync/schema.ts`** — les 6 points d'édition d'un
  réglage booléen, checklist héritée de la panne silencieuse de CYCLE-01.

#### Corrigé

- **`pain-zones.test.ts` passait au vert sur un type faux.** `{ back: 14, biceps: 4 }` — `biceps` est
  un muscle **fin**, alors que l'entrée attend les 6 groupes **larges**. Vitest ne typechecke pas ;
  seul `tsc` l'a vu, à la vérification globale. Rappel utile : des tests verts ne remplacent pas un
  typecheck.
- **`expect(valeur, message)` est l'API Vitest, pas Jest.** Le paquet mobile tourne sous Jest, qui
  refuse le 2ᵉ argument. Le contexte est désormais porté par l'assertion elle-même.

#### Technique / Notes

- ✅ **Conformité légère, à l'inverse de CYCLE-01** : la catégorie « Santé » et le disclaimer médical
  **existaient déjà** dans la fiche Play, et l'US **n'écrit rien dans Health Connect** → déclaration
  « Health apps » **inchangée à 6 types**, **aucun délai externe ajouté**. C'est un choix, pas une
  chance.
- ⚠️ **`react-native-svg` n'accepte ni `accessibilityRole` ni `accessibilityState`** sur ses formes,
  seulement `accessibilityLabel` (constaté au typecheck). Le parcours accessible passe donc par une
  **liste de zones** sous le schéma — de vrais boutons, qui règlent au passage le problème des petites
  articulations difficiles à viser au doigt.
- ⚠️ Warning CLI au push (`failed to cache migrations catalog`), **le même qu'aux push de REPAS-01 et
  VIE-01** : mise en cache du catalogue pg-delta, pas exécution. Démenti par `npm run db:types`
  (+44 lignes, **aucune suppression**).
- 🟠 **1 point ouvert en recette** : la fenêtre de fraîcheur de **7 jours** demande un jugement de
  pratiquant (critère 22). La changer coûte une ligne (`PAIN_FRESHNESS_DAYS`).
- **Ce qu'il faudrait pour débloquer la substitution** est tracé en spec §8 : taguer chaque exercice
  avec l'articulation sollicitée et son schéma de mouvement — **travail de coach**, même blocage que
  CONTENU-01. Tracé, pas promis.

### 06/08/2026 — `feature/vie01-mode-vie-reelle` — Mode « vie réelle », dégradation gracieuse (roadmap 1.28)

Suite de `a06e406`. En **un tap**, l'utilisateur déclare une période où la vie prend le dessus
(vacances, maladie, déplacement) : l'app **abaisse ce qu'elle demande** puis **reprend le plan normal
toute seule, sans reset**. Idée promue depuis IDEAS.md (25/07), portée par **3 modèles sur 4** du
benchmark et désignée **cause n°1 d'abandon à 3-6 semaines**. Sa fiche annonçait « cadrage **après**
le détecteur de collisions, les deux partagent le même moteur de règles » — COLLIS-01 étant livrée la
veille, c'était son tour.

**2 885 tests** (1 880 shared, 824 mobile `+12`, 181 admin), typecheck et lint à **0 erreur**.

**4 arbitrages Florian, acquis avant rédaction** : (D1) on fléchit **les cibles, pas le programme** ·
(D2) les analyses **restent vraies et sont annotées**, jamais amputées · (D3) **durée choisie**
(3/7/14 j), sortie automatique · (D4) la série est **mise en pause**, ni cassée ni allongée.
**2 décisions de cadrage** validées : rétro-déclaration bornée à 7 j (D5) et **aucun effet sur les
échéances d'OBJ-01** (D6).

#### Ajouté

- **`packages/shared/src/real-life.ts`** — le moteur pur, 8 fonctions, **38 tests**. Aucune lecture
  d'horloge (`todayKey` en paramètre, patron `session-conflicts`). `REAL_LIFE_MAX_BACKDATE_DAYS`
  **réutilise littéralement** `JOKER_MAX_AGE_DAYS` : STREAK-01 avait déjà arbitré la même question,
  deux constantes à 7 auraient divergé au premier ajustement.
- **Table `real_life_periods`** (2 migrations, poussées le 05/08) + sync rule + déclaration dans
  `powersync/schema.ts` + export RGPD. **Aucune contrainte de plage en base, délibérément** (patron
  REPAS-01 D6 : une violation bloquerait la file d'upload PowerSync) — la lecture absorbe un
  chevauchement en prenant l'**union** des jours.
- **`real-life-repository.ts`** + **12 tests SQL** sur le harness SQLite. Ces tests existent pour une
  raison : le harness génère son DDL depuis `powersync/schema.ts`, donc une écriture-relecture qui
  passe **prouve** que la table y est — la panne exacte de CYCLE-01.
- **UI** : `RealLifeSheet` (déclaration) et `RealLifeCard` (**deux états dans un seul id**). **Aucune
  dépendance native, aucun sélecteur de date** — patron `GoalFormSheet`, ce qui préserve la promesse
  « recettable sur l'APK existant ».
- **30 clés i18n × FR/EN**, parité vérifiée par script.

#### Modifié

- **`streak-joker.ts`** — 3ᵉ état de jour : un jour en période **et inactif** est **transparent**
  (traversé, non compté) ; un jour en période où l'on s'est entraîné **compte**. ⚠️ Le point délicat
  était la **condition de sortie de boucle** : avec `while (counts(cursor))` la série s'arrêtait au
  premier jour transparent et la fonctionnalité **ne faisait rien, en silence**. Un test fige le cas
  (« période au milieu de la série »).
- **`insights.ts`** — `REAL_LIFE_MUTED_INSIGHTS` + muets **à la baisse seulement** pour
  `tonnage_change`/`distance_change`. ⚠️ Le sens n'est **pas** dans `metrics` (`Math.abs(pct)`) mais
  dans `variant` : un filtre sur le signe d'une métrique n'aurait jamais rien mué. Les garde-fous de
  charge ne sont **jamais** filtrés.
- **`weekly-review.ts`** — `decide()` saute 4 des 6 natures de décision pendant une période.
  🔴 **`goal_behind` est CONSERVÉ**, conséquence directe de D6 : puisqu'une période ne décale pas une
  échéance, masquer qu'un objectif décroche serait un piège. Un test le fige, motif en commentaire.
- **`nutrition.ts`** — `effectiveNutritionObjective`, neutralisant le delta **dans les deux sens**
  (un surplus pris sans s'entraîner n'est pas une prise de masse). `targetCalories` **inchangée** :
  le `manualOverride` continue de primer sans une ligne de plus.
- **7 appels de `targetCalories` câblés dans 5 fichiers**, dont **2 volontairement exclus**
  (`nutrition-profile.tsx`) : un écran qui montre la **cible du jour** applique la règle, l'écran où
  l'on **configure l'objectif** ne l'applique pas — sinon on croit que son réglage `cut` n'a pas pris.
- **`useDayCalorieTarget` et `useGoalAdherenceForRange`** — la cible de base devient une **fonction
  du jour**. Ces hooks servent des **jours passés** : une cible unique aurait faussé l'adhérence
  (NUTR-10) et le bilan calorique (NUTR-18) sur toute la fenêtre, pas seulement sur les jours en
  période.
- **`widgets.ts`** — `MAX_HOME_WIDGETS` **7 → 8**. Le cliquet posé par INSIGHTS-02 a **cassé la CI**,
  ce qui est exactement son rôle : il a forcé l'arbitrage au lieu de laisser passer un `+1`
  silencieux. Motivé dans le code — le plafond d'ADR-007 porte sur les widgets **visibles** (typique :
  5-6, dans la fourchette), et `real-life` porte deux états dans un seul id.
- **`widget-destinations.ts`** — `HOME_WIDGET_IDS_POST_V1` + `HOME_WIDGET_IDS_WITH_DESTINATION`.
  `HOME_WIDGET_IDS_V1` est un **snapshot figé** (21 entrées, figées par un test) : y ajouter un id né
  après le dégonflage aurait réécrit l'histoire.

#### Corrigé

- **Le delta `cut` vaut −400, pas −350.** Le chiffre était faux dans la maquette, le plan, la roadmap
  **et un test** — la recette aurait vérifié un mauvais nombre.
- **Un test de cette US était faux, pas le code.** « activeToday=false pendant une période » ne mettait
  en pause que le jour courant tout en attendant une série de 12 : les jours intermédiaires restaient
  des trous réels, donc la série tombait bien à 0.
- **`insight-adapters.test.ts`** — son helper `review()` construit un `WeeklyReview` en littéral et
  devait recevoir le nouveau champ. Une recherche antérieure avait conclu à tort que « rien ne
  construit `WeeklyReview` en littéral » : la pagination des résultats avait tronqué ce fichier.

#### Technique / Notes

- 🔴 **Une seule étape reste hors code** : déployer la **sync rule PowerSync** (table neuve) sur le
  dashboard. Oubliée deux fois (BIEN-01, RUN-F2c). Le piège : le 1ᵉʳ critère de recette **passerait
  quand même**, l'écriture étant locale — l'absence ne se voit qu'au 2ᵉ appareil.
- ⚠️ **Import circulaire créé puis défait** : `real-life-repository` → `dashboard-repository` →
  `real-life-repository`. `useMinimalWeekTargets` vit finalement côté dashboard (où la chaîne
  nutrition existe déjà) ; seule la requête SQL est exportée depuis `real-life-repository`.
- ⚠️ Warning CLI au push (`failed to cache migrations catalog`), **identique à celui de REPAS-01** :
  il porte sur la mise en cache du catalogue pg-delta, pas sur l'exécution. Démenti par
  `npm run db:types`, dont le diff ne contient **que** les 38 lignes de la nouvelle table.
- 🟠 **2 points ouverts en recette** : l'arbitrage du plafond de widgets (critère 21) et la
  confirmation de D5/D6 sur device (critère 22).
- **Aucune donnée de santé ajoutée** : la période ne porte **pas de motif**. Stocker « malade » aurait
  rouvert la politique de confidentialité **et** la déclaration Google Play « Health apps », déjà
  passée à 6 types par CYCLE-01 et sur le chemin critique du lancement — pour un champ sans effet
  fonctionnel (D1 rend le fléchissement identique quelle que soit la cause).

### 05/08/2026 — `feature/collis01-detecteur-collisions` — Détecteur de collisions entre séances (roadmap 3.57)

Suite de `f764732`. Le planning **plaçait** les séances sans rien dire de leur **enchaînement** :
il détecte désormais les combinaisons qui s'auto-sabotent et **propose une correction — jamais un
blocage**. Idée promue depuis IDEAS.md (25/07), **signal le plus fort du benchmark IA (4 modèles
sur 4)**, design brainstormé et validé le 05/08.

**2 799 tests** (1 806 shared `+32`, 812 mobile `+12`, 181 admin), typecheck et lint verts, cliquet
`packages/shared` tenu (100 / 97,47 / 100 / 100).

#### Ajouté

- **Moteur pur** — `packages/shared/src/session-conflicts.ts` (+ 32 tests, 100 % couvert).
  **UNE seule règle en V1** : jambes **strictement dominantes** ET **≥ 8 séries**, suivies **le
  lendemain** d'une `sortie_longue` ou d'un `fractionne`. Sens unique. Aucune lecture d'horloge —
  `todayKey` entre par paramètre.
- **Repli déterministe** : premier jour de la semaine affichée qui résout le conflit, **après puis
  avant**. La séance de muscu ne bouge jamais. Aucun jour valable → on informe sans proposer.
- **Bandeau** sur `/planning`, sur le jour de la course, avec l'échange en un tap
  (`reschedulePlannedSession`, déjà éprouvée par MUSC-F9).
- **Réglage opt-in**, désactivé par défaut (décision H) — migration
  `20260805081425_collis01_session_conflicts_opt_in`, **poussée et cochée** au registre.
- **Requête d'enrichissement** du planning : séries par groupe musculaire d'une séance planifiée.
  `PlannedSessionItem` ne portait que `exerciseCount`. **Seule donnée nouvelle du chantier.**
- i18n FR + EN (1 970 clés, symétrie vérifiée).

#### Technique-Notes

- 🔴 **Un vrai bug trouvé par mes propres tests.** Le jour de repli pouvait être **celui de la
  séance de jambes elle-même** : on aurait déplacé la course **sur** le problème au lieu de l'en
  éloigner. Trois conditions sont désormais nécessaires — ni course, ni grosse séance de jambes ce
  jour-là, ni la veille. Aucune relecture de spec n'attrape ça ; seule l'exécution le fait.
- **Une garde prouvée inatteignable, supprimée** (`indexOf === -1` dans la recherche de repli :
  l'appelant l'a déjà écartée via `previousDayKey`). Même traitement que `bucketOf` le 04/08 — on
  retire le code mort plutôt que d'écrire un test qui fige un appel impossible.
- ✅ **Aucune sync rule**, et c'est une correction : le premier cadrage en faisait son risque n° 1.
  `user_settings` est lue en **`select *`**, donc y ajouter une colonne ne change pas une ligne du
  YAML — la migration de la veille le disait déjà. 🔴 Le vrai risque, lui, est traité : la colonne
  est déclarée dans le **schéma PowerSync local**, sans quoi l'écriture échoue et
  `void updateSettings()` avale l'erreur — l'interrupteur reste éteint **sans message**, panne
  exacte de CYCLE-01 (recette du 31/07).
- **Six points d'édition** pour un booléen sur `user_settings`, pas quatre : migration, schéma
  local, schéma Zod, `database.types`, et **quatre** endroits dans `settings-repository`. La
  relecture de spec avait relevé les deux manquants avant qu'ils ne coûtent une session.
- **Trois autres corrections de cadrage** issues de la relecture : le moteur ne recevait pas
  `todayKey` alors que sa règle R1 l'exigeait (il aurait pu proposer un repli **dans le passé**,
  rendant la course « manquée ») ; le raisonnement sur `target_sets` nullable **s'annulait
  lui-même** (« `SUM` ignore les NULL » revient exactement à les compter 0) ; et la requête
  n'était pas scopée par `owner_id` alors que les six autres du fichier le sont.
- **Le `JOIN exercises` ne filtre volontairement pas `deleted_at`** : les exercices archivés sont
  répliqués en local et l'utilisateur fera la séance quand même. Les exclure sous-compterait ses
  jambes et masquerait un conflit réel.
- ⚠️ **Le seuil de 8 séries ne repose sur rien de mesuré.** Constante exportée et nommée
  (`LEG_SETS_CONFLICT_THRESHOLD`) ; le critère de recette 17 demande à un pratiquant de le juger.
- **Trois familles de conflit écartées de la V1** (course ↔ course, densité de semaine, charge ↔
  nutrition). Quatre règles moyennes valent moins qu'une règle juste : chacune multiplie les faux
  positifs, et c'est le bruit qui fait désactiver ce genre de fonctionnalité. Le moteur est conçu
  pour les accueillir — une règle s'ajoute, elle ne réécrit rien.
#### Corrigé en revue de diff

- 🔴 **Le bouton d'échange aurait été inatteignable sous TalkBack.** `accessible` était posé sur la
  racine du bandeau, qui contient le `Pressable` : sur Android, un conteneur accessible **absorbe**
  ses enfants focusables, qui perdent focus, rôle « bouton » et double-tap. Le bloc accessible ne
  couvre plus que les deux textes. Contredisait le plan **et** le critère de recette 15.
- **Le texte disait « hier » et « aujourd'hui »** — faux dès qu'on navigue vers une autre semaine,
  c'est-à-dire le cas normal quand on planifie. Devenu « la veille » / « le lendemain ».
- **R2 rétablie plutôt que la spec amendée** : le plan avait relâché « réglage éteint = requête non
  montée » en la croyant coûteuse. Elle ne l'est pas — lier un `owner_id` vide suffit, sans
  sentinelle SQL. La spec validée reste la source de vérité.
- **`muscle_primary` NULL** produisait une clé `"null"` qui entrait dans le test de dominance comme
  un groupe concurrent, et pouvait faire perdre aux jambes leur dominance — donc masquer un
  conflit réel. Exclu par la requête.
- **Les tests promis par le plan n'avaient pas été écrits** — dont celui qui garde exactement la
  panne CYCLE-01. `SELECT_PLANNED_MUSCLE_SETS` était un export mort. **12 tests SQL ajoutés** :
  owner-scoping, `target_sets` nul, exercice archivé compté, `muscle_primary` nul exclu, fenêtre de
  dates, et surtout **écriture-relecture du réglage** sur un SQLite dont le DDL vient d'`AppSchema`.

- ⚠️ **Le `db:push` a affiché une erreur SSL** (étape annexe du planificateur `pg-delta`) tout en
  concluant « Finished ». Vérifié par `db:push:dry` : « Remote database is up to date ». La
  migration **est** appliquée. À connaître, l'erreur est trompeuse.

### 05/08/2026 — `feature/insights02-degonflage-tier0` — Dégonflage du Tier 0 : l'accueil passe de 21 à 7 widgets

Suite de `547a8fa`. Solde la promesse d'INSIGHTS-01, qui avait créé l'écran « Insights » **sans**
dégonfler l'accueil. **2 755 tests** (1 774 shared `+24`, 800 mobile, 181 admin), typecheck et lint
verts, cliquet `packages/shared` tenu (100 / 97,46 / 100 / 100).

**Aucune migration, aucune sync rule, aucune dépendance native** → recettable sur l'APK existant.

#### Modifié

- **`HOME_WIDGET_IDS` : 21 → 7** — `today-session`, `nutrition-summary`, `streak`, `steps`, plus
  trois qui ne s'affichent **jamais tous ensemble par défaut** (`insights` conditionnel,
  `activation-path` 7 jours, `cycle` opt-in). Compte **visible** : 4-6, la fourchette d'ADR-007 §2,
  dépassée de 350 % depuis le 16/07/2026.
- **Les hubs gagnent ce que l'accueil perd** : muscu 5 → 7, course 3 → 4.
- **`isWidgetActive` retombe de 7 branches à 2.** C'est le second bénéfice : la classe de bug du
  « trou dans la grille » s'était produite **quatre fois**, et sa surface d'exposition fond.
- **7 hooks cessent d'être montés deux fois** sur l'écran le plus ouvert de l'app — dont
  `useWeeklyReview` et ses **≥ 13 requêtes**. La dette consignée la veille est soldée.
- **ADR-007 §2 amendé** : le plafond n'est plus déclaratif, il est **appliqué par un test**.
- **`ConcurrentTrainingInterference` et `ReadinessResult` gagnent leurs chiffres** — deux ratios
  calculés puis jetés d'un côté, deux comptes dérivés de composantes déjà classées de l'autre.
  Aucune analyse nouvelle : on cesse de perdre ce qui existe.

#### Ajouté

- **`widget-destinations.ts`** (+ 12 tests) — la table qui rend R1 exécutable. Le type **interdit**
  de compter une carte d'insight comme destination : `alert-insight` n'est acceptable que pour les
  signaux conditionnels par nature. Une carte est du **surfaçage**, pas une destination — au plus 3
  s'affichent, avec quota de famille et porte de fraîcheur.
- **Section « Suivi » dans les Réglages** → `/goals`, `/wellbeing`, `/review`. Ces trois écrans
  livrés n'avaient **que leur widget** comme point d'entrée.
- **3 destinations de hub créées** : `strength-records`, `strength-training-time` et
  **`running-training-time`** — cette dernière parce que `TrainingTimeCard` se rend pilier par
  pilier : la placer seulement côté muscu l'aurait retirée aux coureurs.
- **3 nouvelles cartes d'insight** : `readiness`, `concurrent_interference`, `activity_level`.
- **Compaction horizontale** de la grille, et **`MAX_HOME_WIDGETS`** appliqué par test.
- **35 clés i18n** FR + EN, symétrie vérifiée (1 962 clés au total).

#### Corrigé

- **§2.4 d'INSIGHTS-01 : une affirmation fausse, corrigée.** Il y était écrit qu'`activity_level`
  ne portait « aucune quantité ». Faux — `runningDays` existe, et c'est précisément le chiffre qui
  justifie la suggestion. Le signal pouvait donc devenir un insight dès la 7.20. La relecture de
  l'époque avait reproduit l'erreur. La ligne est barrée et datée : une spec est une source de
  vérité, pas un souvenir.

#### Technique-Notes

- 🔴 **Le lot 0 est ce qui rend cette US acceptable, et il a payé.** Écrire la table de destinations
  **avant** tout retrait a transformé « aucun signal ne disparaît » d'une phrase de spec en une
  assertion qui casse la CI. Sans lui, `/review` partait à la poubelle — voir ci-dessous.
- **Le cadrage annonçait 3 signaux irrécupérables ; 2 l'étaient à tort** (`activity_level` avait
  déjà son chiffre, `concurrent_interference` jetait les siens). Et la relecture de la spec a
  démenti **7 affirmations**, dont deux qui auraient fait perdre une fonctionnalité : la
  notification hebdomadaire **ne mène pas** à `/review` (l'app n'a aucun handler de réponse aux
  notifications), et `/progress` › Records est **par exercice sélectionné**, donc pas l'équivalent
  du widget de records.
- **La compaction horizontale est volontairement conservatrice** : un widget ne se rabat à gauche
  que si sa **propre ligne** a un trou. Un first-fit complet aurait remonté des widgets d'une ligne
  à l'autre et détruit des dispositions voulues. Et jamais pendant un glisser-déposer : là, la
  colonne choisie *est* l'intention de l'utilisateur.
- **Aucune migration de `dashboard_layout`** : `resolveScreenLayout` ignore les ids inconnus
  (filtre `known.has`, appliqué avant le branchement, donc sur les deux chemins).
- **La carte `readiness` est la seule au pluriel variable** — i18next choisit la forme sur `count`,
  qu'il faut lui passer explicitement, sinon les clés `_one`/`_other` ne se résolvent pas et la clé
  brute s'affiche.
- **Aucun `*Card.tsx` n'a été supprimé.** Un composant orphelin est du code mort visible ; un
  composant supprimé trop tôt est une fonctionnalité perdue. Conséquence assumée : **~12 composants
  deviennent du code mort**, inventoriés dans [BACKLOG.md](BACKLOG.md) pour un `chore/` dédié.
  Les effacer ici, dans un commit qui touche déjà 31 fichiers, aurait été plus risqué qu'utile.
- 🔴 **Deux défauts trouvés en revue de diff, corrigés avant commit.** (1) Les 3 destinations créées
  sur les hubs **n'avaient aucune `defaultSize` déclarée** : `defaultSizeOf` retombant sur `'wide'`,
  elles rendaient **correctement par accident** — le pire cas, celui qui ne se voit jamais.
  (2) Le test « chaque widget a une garde » que cette US venait d'ajouter ne portait **que sur
  l'accueil**, et c'est précisément pour ça qu'il n'a rien vu : il couvre désormais les **trois**
  hubs, gardes **et** tailles.

### 05/08/2026 — `feature/insights01-ecran-insights` — BILAN-01 : le groupe musculaire s'affichait en clé brute

Suite de `c079055`. Correctif demandé par Florian juste après la livraison d'INSIGHTS-01.
**2 731 tests** (1 750 shared, 800 mobile `+4`, 181 admin), typecheck et lint verts.

#### Corrigé

- **« Tu délaisses un groupe musculaire : **back** » → « … : **Dos** ».**
  `ReviewDecision.subject` vaut `balance.neglected[0]` pour la décision `muscle_imbalance` — une
  **clé métier**, pas un libellé — et les trois surfaces qui rendent cette décision l'interpolaient
  telle quelle : [review.tsx](apps/mobile/src/app/review.tsx),
  [ReviewCard.tsx](apps/mobile/src/components/dashboard/ReviewCard.tsx) et la carte
  `weekly_decision` de l'écran « Insights ».

#### Ajouté

- **[`lib/decision-subject.ts`](apps/mobile/src/lib/decision-subject.ts)** — `resolveDecisionSubject()`,
  fonction **unique** désormais partagée par les trois surfaces (+ 4 tests). `resolveInsightSubject`
  lui **délègue** le cas `weekly_decision` au lieu de reproduire la règle.

#### Technique-Notes

- **Le défaut est préexistant** (livré avec BILAN-01), pas introduit par INSIGHTS-01. Il a vécu sans
  être vu parce qu'il n'existait qu'à un seul endroit ; c'est en l'exposant sur une **3ᵉ surface**
  que la revue de code l'a fait apparaître. La leçon est la raison d'être du fichier ci-dessus :
  **un seul endroit doit savoir** laquelle des six natures de décision porte une clé de muscle.
- **Écran en recette touché, en connaissance de cause.** BILAN-01 est à `etape: recette` et la
  recette a lieu ce week-end : le correctif change ce que Florian va tester. Décision explicitement
  demandée par lui (« rajoute les deux conditions maintenant ») après avoir été prévenu du
  compromis. Le rendu est **plus** conforme à la spec qu'avant, pas moins.
- `review.tsx` calcule désormais le texte **une seule fois** : le libellé d'accessibilité et le
  texte visible partaient de deux interpolations distinctes, qui auraient pu diverger.

### 05/08/2026 — `feature/insights01-ecran-insights` — Écran « Insights » (Tier 3, ADR-007) : moteur de sélection des analyses pertinentes

Suite de `ca95ec6`. Dernier morceau non construit d'[ADR-007](docs/adr/ADR-007-surfacage-analyses.md),
qui le nommait explicitement « US à cadrer ». **2 721 tests** (1 750 shared `+70`, 790 mobile `+8`,
181 admin), typecheck et lint verts, cliquet de couverture `packages/shared` tenu
(100 / 97,44 / 100 / 100).

**Aucune migration, aucune sync rule, aucune dépendance native** → **recettable sur l'APK
existant**, contrairement à PARTAGE-01 / RUN-F2a / MUSC-F9 / RUN-F2c / LAUNCHER-01.

#### Ajouté

- **Moteur de sélection pur** — `packages/shared/src/insights.ts` (+ 29 tests). Choisit **1 à 3**
  insights parmi les candidats, **au plus 2 par famille** (`alert` / `change` / `celebration`).
  Classement par **table ordonnée `INSIGHT_ORDER`**, sans arithmétique. `todayKey` entre par
  paramètre : aucune lecture d'horloge dans le moteur.
- **9 adaptateurs purs** — `packages/shared/src/insight-adapters.ts` (+ 41 tests). Un par signal,
  plus `buildInsightCandidates()` qui compose l'ensemble. Aucune analyse nouvelle calculée.
- **Agrégateur** — `apps/mobile/src/data/repositories/insights-repository.ts`. Compose 8 hooks
  déjà livrés. Expose `canAccessInsights()`, **point de gating unique** (retourne `true`).
- **Contexte de mutualisation** — `insights-context.tsx`. Voir Technique-Notes.
- **Écran** — `apps/mobile/src/app/insights.tsx` + `components/insights/InsightCard.tsx` (+ 8 tests
  d'écran). Route déclarée dans `_layout.tsx`.
- **Widget d'accueil conditionnel** — `components/dashboard/InsightsCard.tsx`, id `insights` en fin
  de `HOME_WIDGET_IDS`, garde `'always'`, **déclaré dans `isWidgetActive` dans le même commit**.
- **i18n** — 35 clés FR + EN, symétrie vérifiée.

#### Modifié

- **`useTrainingLoadAlert` cesse de jeter son ratio** — `dashboard-repository.ts`.
  `TrainingLoadAlert` passe de `{ show }` à `{ show, ratio }`. `computeAcwr` le calculait déjà et il
  était perdu, ce qui rendait l'alerte de charge inaffichable (une carte doit porter le chiffre qui
  la justifie). **Seule modification de code livré de l'US.** Le widget `training-load` ne lit que
  `show` : aucune régression.
- **`ADR-007` amendé et daté** — le §2 disait le Tier 3 « derrière le paywall » ; l'écran est livré
  **gratuit**, SOCLE-01/RevenueCat étant différée (aucun entitlement, aucun produit configurable,
  donc un écran gaté aurait été un écran invisible). La conséquence « US à cadrer » est cochée.
- **`widgets.test.ts`** — compteurs 20 → 21 (accueil), 19 → 20 et 20 → 21 (layouts résolus).
- **`cycle/insights.tsx`** — commentaire d'en-tête croisé : deux écrans homonymes cohabitent
  délibérément (décision D4), celui-ci s'affichant sous le titre « Croisement ».

#### Technique-Notes

- 🔴 **Le plafond Tier 0 d'ADR-007 s'éloigne** : l'accueil passe de **20 à 21 widgets** contre les
  **4-6** du §2. C'est le périmètre convenu — cette US crée l'endroit où faire vivre les signaux
  conditionnels, **INSIGHTS-02** dégonflera après la recette. Consigné dans l'ADR et dans le test.
- **Duplication de montage repérée puis mutualisée — et une dette résiduelle, mesurée.** Avec le
  widget sur l'accueil, `useInsights()` était appelé **deux fois** (`isWidgetActive` + la carte).
  L'accueil calcule désormais **une fois** et diffuse via `InsightsProvider`, posé **une seule fois
  autour de `WidgetGrid`**. Le contexte n'a **aucun repli calculant** : hors provider,
  `useSharedInsights()` rend `null` — un repli aurait rétabli le double montage en silence.
  🟠 **Reste une duplication réelle, non résolue** : `useWeeklyReview`, `useMuscleBalance`,
  `useGoals` et `useRecentStrengthRecords` sont **déjà montés** sur l'accueil par les widgets
  `review`, `muscle-volume`, `goals` et `record-recent`. `useQuery` de `@powersync/react` ouvre une
  souscription **par instance**, sans déduplication : l'accueil passe donc de 1 à 2 instances de
  chacun, soit **~15 requêtes surveillées de plus**. Le critère de recette 16 le vérifie à l'usage ;
  la vraie résolution appartient à **INSIGHTS-02**, qui touchera de toute façon ces widgets.
  *(Une première rédaction de cette entrée affirmait ces hooks « absents de l'accueil jusqu'ici » —
  c'était faux, corrigé après revue de code.)*
- **Champ `variant` ajouté au candidat**, absent du cadrage. Trois sources recouvrent plusieurs
  messages sous un même id (2 niveaux de gravité, 3 types de record qui ne se formatent pas pareil,
  6 natures de décision hebdo). Effet de bord utile : la carte du bilan rend
  `review.decisions.<kind>`, **la clé même de BILAN-01** — aucune retraduction, donc aucune
  divergence possible entre les deux écrans.
- **La spec a été relue contre le code avant d'écrire une ligne, et 8 affirmations étaient
  fausses** (§11 de la spec). Trois conséquences de conception : le moteur à **score pondéré a été
  abandonné** (la `severity` qu'il exigeait n'existe dans aucune source, et la décote de fraîcheur
  faisait passer les alertes **derrière** les célébrations) ; **4 sources sur 13 retirées** faute de
  porter le moindre nombre (`readiness`, `concurrent_interference`, `activity_level`, jalons de
  série) ; et `goal_milestone` **remplacé par `goal_achieved`** — `GOAL_MILESTONES` est documenté
  « des repères, **pas des récompenses** » (OBJ-01 D4), en faire une célébration aurait inversé un
  arbitrage produit daté.
#### Corrigé

- **Clé de groupe musculaire affichée brute sur l'accueil** — `InsightsCard.tsx`. Le widget
  interpolait `subject` tel quel dans son titre, alors que le moteur y transporte une **clé métier**
  (`back`), pas du texte : l'accueil affichait **« back sous-travaillé »** pendant que l'écran
  affichait « Dos sous-travaillé ». Les deux surfaces passent désormais par
  `resolveInsightSubject()`, exportée de `InsightCard.tsx` et couverte par 5 tests. Cas courant :
  `muscle_neglected` arrive en tête dès qu'aucune alerte ni célébration récente ne concourt.
  **Trouvé en revue de code**, invisible aux tests d'écran qui ne couvraient que `app/insights.tsx`.
- **Même défaut sur la décision hebdo `muscle_imbalance`**, dont le sujet vient aussi de
  `balance.neglected[0]` — traité par la même fonction.
- **Ligne 7.20 hors de son tableau** — `docs/roadmap/roadmap.md`. Une ligne vide la séparait du
  tableau, ce qui en Markdown **ferme le tableau** : elle se serait rendue en texte brut avec des
  barres verticales. Invisible dans ETAT.md, dont le script la comptait correctement.
- **`insights-repository.ts` ajouté au garde-fou `no-frozen-clock`** — sa liste `WATCHED` est
  explicite, et l'agrégateur porte une décision « aujourd'hui » (la porte des 14 jours). Le code
  était correct ; rien ne protégeait la modification suivante.

#### Technique-Notes (suite)

- **Écarts documentaires relevés, non corrigés** (hors périmètre) : le catalogue d'analyses annonce
  **11 ⏳ alors qu'il en reste 8**, et **7.14 est en collision** dans la roadmap (« Joker de série »
  en V0.9 vs « Cercle d'accent sur les cartes » hors cadrage) — 3ᵉ collision après 4.5/4.36 et 4.37.
  À traiter via [`/reconcilier`](.claude/commands/reconcilier.md).
- **Audit d'ouverture de session** : les **17 🟡** de la roadmap sont à **15/17 de la dette de
  recette ou de sync rule**, pas du code incomplet. Seuls **2.4**, **3.52** et **4.37** ont un vrai
  trou fonctionnel.

### 04/08/2026 — `feature/muscpwr01-module-force` — Module force livré : %1RM, DOTS et total SBD (MUSC-16 / MUSC-27 / MUSC-29)

Suite de `76797b5` (socle). Lots 5 et 6 : l'UI et le transverse. **782 tests mobile** (+16),
**1680 tests shared**, i18n à parité (1 914 clés).

#### Ajouté

- **`StrengthSection.tsx`** — une **seule** section, **repliée par défaut**, sur Progression
  (ADR-007, D4). Elle rend `null` tant que rien n'est calculable : ce module ne sert qu'aux
  pratiquants de force et ne doit **rien coûter** aux autres. **16 tests de rendu.**
- **`RelativeIntensityCard.tsx`** + `useExerciseRelativeIntensity` — %1RM par série de la dernière
  séance sur la **fiche exercice**, avec moyenne pondérée par les répétitions.
- **`app/strength-lifts.tsx`** — désignation des 3 mouvements, exercices **perso inclus**
  (indispensable pour les variantes de compétition). Route déclarée dans `_layout.tsx`.
- **i18n `strength.*`** FR + EN (44 clés), namespace `strength` et non `powerlifting` : le module sert
  aussi qui suit un programme en pourcentages sans faire de compétition.

#### Modifié

- Catalogue : **MUSC-16 / MUSC-27 / MUSC-29 → ✅**. Le catalogue passe de **19 à 8 items ⏳** sur la
  journée, dont **2 seulement réellement faisables** (RUN-07, META-18) — les 6 autres attendent des
  données (FC, hydratation) ou sont hors périmètre (espace coach).
- `progress/index.tsx`, `exercises/[id].tsx`, `_layout.tsx` : branchements.

#### Technique — Notes

**Un écart avec ma propre spec, trouvé au moment de clôturer.** J'avais codé et testé les briques de
MUSC-16 (lot 1) mais **aucune UI ne les utilisait** : la section Force n'affichait que le DOTS et le
total SBD. La spec place le %1RM sur la **fiche exercice** (D5 : pas sur l'écran de séance, déjà
dense). Marquer MUSC-16 « livré » aurait été faux — d'où `RelativeIntensityCard`, ajoutée avant de
cocher quoi que ce soit. Un lot de briques pures sans consommateur reste du code mort, quelle que
soit sa couverture.

**Trois pièges de test rencontrés, tous documentés dans la doc du projet** :
1. `CollapsibleCard` porte `accessibilityLabel={title}` sur son `Pressable` : presser le `<Text>`
   interne ne déclenche rien. Il faut cibler **le label**.
2. Le dépli exige **`await act`** — sans lui, l'assertion porte sur la version repliée et échoue en
   annonçant un texte introuvable (§3.6 de strategie-tests.md, piège connu).
3. Deux mouvements valant 195 kg dans la fixture → `getByText` échoue sur « Found multiple ».
   `getAllByText` avec un décompte explicite est plus juste que de tordre la fixture.

⚠️ **Le critère de recette 21 ne peut pas être coché par un agent** : les coefficients du DOTS
viennent de l'extérieur du projet. Un coefficient faux produit un score **plausible**, donc
indétectable en recette ordinaire. Les tests séparent explicitement les **propriétés structurelles**
(monotonie, sens de la normalisation, bornes — vraies quels que soient les coefficients) des
**valeurs figées**, qui ne détectent qu'une régression. La validation de justesse est humaine.

Qualité : `typecheck` 0, `lint` **0 erreur**, `test` et `test:coverage` **exit 0**.

### 04/08/2026 — `feature/import01-import-donnees-externes` — IMPORT-01 cadrée puis mise en pause sur dépendance externe (roadmap 1.20)

Suite de `d4c2634`. **Aucun code applicatif** — cette entrée consigne un cadrage complet et un arrêt
volontaire, pour que la reprise ne coûte rien.

#### Ajouté

- **Spec** [import01-import-donnees-externes.md](docs/specs/functional/us/import01-import-donnees-externes.md)
  — 14 règles, 12 décisions, 16 cas limites, 23 critères de recette.
- **Plan** [import01-import-donnees-externes.md](docs/plans/import01-import-donnees-externes.md)
  — 10 lots, 5 jalons, 8 risques nommés.
- **Maquette** 9 écrans : point d'entrée, aperçu avant écriture, mapping d'exercices, erreurs par
  ligne, progression, rapport, annulation, réimport.
- **[import-samples/README.md](docs/specs/technical/import-samples/README.md)** — le document qui
  débloque l'US : ce qu'il faut fournir, où le trouver dans chaque app, et **ce que les données
  doivent contenir** pour être utiles (l'unité de charge en tête, un exercice connu **et** un
  exotique, une série au poids du corps, les 4 repas MFP…).

#### Modifié

- **`scripts/etat.mjs`** — support d'un champ `bloque:` dans le front-matter, rendu par une pastille
  ⏸️ dans le tableau « En cours » **et** par un bloc dédié. Sans lui, une US arrêtée sur une
  dépendance externe reste `etape: validation`, donc **indistinguable d'une US qui avance** — le
  meilleur moyen de la retrouver trois semaines plus tard sans savoir ce qu'on attendait.
- Roadmap **1.20** : reste **⬜** (rien de livré) avec le détail du cadrage et du blocage.

#### Technique — Notes

**Pourquoi s'arrêter avant de coder** plutôt que d'écrire le moteur sur des hypothèses de colonnes :
chaque hypothèse fausse se paie deux fois — une fois pour le code, une fois pour le corriger avec ses
tests. Sur trois formats d'une dizaine de colonnes, c'est l'essentiel du travail de mapping. Le
cadrage, lui, est fait et ne se périme pas. Les lots 1 à 3 (tokenizer CSV, parsing GPX, détection de
source) sont **indépendants des alias** et auraient pu démarrer ; décision de ne pas les entamer, une
US livrée en deux moitiés à des semaines d'écart coûtant plus en reprise de contexte qu'elle ne fait
gagner.

**Trois découvertes de cadrage qui ont changé la conception** — et qui justifient à elles seules
l'étape spec :

- **`food_entries.food_id` est nullable** → une ligne MyFitnessPal devient un *quick add* portant son
  nom et ses macros : **aucune correspondance d'aliment à tenter**. Le fichier contient déjà les
  valeurs nutritionnelles ; une correspondance approximative substituerait des valeurs différentes de
  ce que la personne a réellement mangé, pour zéro bénéfice.
- **`workout_sets.exercise_id` est NOT NULL avec FK** → l'inverse : impossible d'importer une série
  sans résoudre l'exercice. D'où trois passes (nom normalisé FR/EN → dictionnaire d'alias → création
  en perso). La passe 3 seule polluerait la bibliothèque de doublons (« Bench Press » **et**
  « Développé couché », avec des records séparés) ; les passes 1-2 seules **jetteraient des séries**.
- **`personal_records` n'est pas dérivée** : elle est écrite par `evaluateWorkoutRecords`, appelée
  uniquement depuis `workout.tsx`. Sans appel explicite, un historique importé n'aurait **aucun
  record**. Et deux pièges en découlent : traiter les séances **dans l'ordre chronologique croissant**
  (sinon un record de 2024 est écarté parce qu'une séance de 2026 fait mieux) et passer la **date de
  la séance** en `achieved_at` (sinon « record établi le 04/08/2026 » pour une perf de 2024).
  Bénéfice collatéral : `maybePushRecords` vivant ailleurs, le **silence des notifications pendant un
  import est gratuit**.

**Ajouté au périmètre sans être demandé : l'annulation d'un import.** Sans elle, la seule issue après
un import raté serait de supprimer des milliers de lignes à la main — donc personne n'essaie, et la
fonctionnalité ne sert à rien. Coût réel : une colonne (`import_batch_id`) et une requête. Elle retire
aussi les `personal_records` créés par le lot, sinon annuler laisserait des **records fantômes** plus
hauts que tout l'historique restant.

**Deux garde-fous repris de REPAS-01** : aucun index unique sur `import_key` (une violation d'unicité
bloque la file d'upload PowerSync en offline multi-appareils — la dédup est applicative), et une
règle explicite « aucune valeur inventée » (un `0 kg` se lit comme une performance, un `null` comme
une absence).

### 04/08/2026 — `chore/socle-tests-lot5-ecrans` — Back-office : `exercise-variants.ts` de 0 % à 100 %, et un point de reprise corrigé

Suite de `f730ac4`. Dernier lot du chantier tests. **157 → 181 tests** sur `apps/admin`,
couverture **61,33 % → 68,88 %** d'instructions.

#### Ajouté

- **`apps/admin/src/data/exercise-variants.test.ts`** (24 tests) — le fichier couvert était à
  **0 %** : 172 lignes de couche data sans un seul test, le plus gros trou du paquet. Il passe à
  **100 % d'instructions et de fonctions** (branches 89,1 %).

#### Modifié

- `apps/admin/vitest.config.ts` — cliquet relevé 60/86/64 → **68/87/70**.
- [strategie-tests.md](docs/specs/technical/strategie-tests.md) §5 bis et §8.

#### Technique — Notes

Ce que ces liens ont de particulier, et pourquoi les tester valait mieux qu'une recette navigateur :
ils vivent dans le **contenu partagé par tous les utilisateurs**, sur une table à **paire canonique**
(`exercise_id_a < exercise_id_b`) avec un unique `(owner_id, a, b) nulls not distinct`. Trois défauts
y sont invisibles à l'écran, et les trois sont désormais couverts :

1. **oublier `owner_id IS NULL`** → l'écran d'admin lirait ou écraserait les liens **personnels** des
   utilisateurs, créés depuis le mobile. Une fuite de données privées, pas un bug d'affichage.
2. **oublier la canonisation** → lier B↔A après A↔B viole l'unique, ou crée un doublon que la lecture
   affiche deux fois.
3. **insérer au lieu de réactiver** une ligne soft-deletée → violation de l'unique, donc un lien
   **impossible à recréer** une fois retiré. C'est le défaut qui casse durablement.

Chaque écriture est aussi vérifiée sur son chemin d'échec : **aucun audit n'est journalisé quand
l'écriture a échoué** — une trace mensongère dans le journal d'admin est pire que pas de trace.
`./audit` n'est volontairement **pas** mocké : on observe la ligne réellement insérée dans
`audit_log` via le double Supabase, comme `admin-users.test.ts`. Ça vérifie qu'on journalise **la
bonne action sur la bonne cible**, pas seulement qu'on appelle une fonction.

⚠️ **Point de reprise corrigé — le §8 envoyait sur un chantier qui n'existe plus.** Il annonçait
« reprendre les `*-smoke.test.tsx` : leurs effets n'ont jamais tourné ». Vérification faite fichier
par fichier : les **15** smoke tests utilisent tous `await render` ou `await act` (47 appels sur 47),
et plusieurs assertent explicitement des effets — `cycle-index-smoke` vérifie une redirection, qui
échouerait si les effets ne partaient pas. Le constat décrivait l'état du 03/08 au matin ; les tests
ont été écrits ou corrigés avec l'idiome depuis. La note a été remplacée par un avertissement
explicite pour ne pas y renvoyer un troisième lecteur.

⚠️ Une erreur de typage introduite puis corrigée : `vi.mock('./audit', () => ({ logAudit: (...args:
unknown[]) => … }))` ne type pas le spread. Résolu en supprimant le mock au profit de la convention
du dépôt (observer `audit_log`) — meilleure au passage.

Qualité : `typecheck` 0, `lint` **0 erreur**, `test` et `test:coverage` **exit 0**.

### 04/08/2026 — `chore/socle-tests-lot5-ecrans` — `packages/shared` à 100 % (instructions, fonctions, lignes) et arbitrage du seuil de branches

Suite de `1aebbbc`. Ferme la dette « `packages/shared` n'atteint pas les 100 % exigés » inscrite au
[BACKLOG](BACKLOG.md) depuis le 03/08/2026. **1 503 → 1 615 tests.**

| Axe | Avant | Après | Seuil CI |
|---|---:|---:|---:|
| Instructions | 99,35 % | **100 %** | **100** (verrouillé) |
| Fonctions | 99,17 % | **100 %** | **100** (verrouillé) |
| Lignes | 99,35 % | **100 %** | **100** (verrouillé) |
| Branches | 95,12 % | **97,35 %** | **97** (arbitré) |

#### Modifié

- `packages/shared/vitest.config.ts` — seuils relevés, avec la justification de l'arbitrage.
- 12 fichiers de tests complétés : `geo`, `pace-records`, `learned-hour`, `widgets`,
  `running-intervals`, `macro-suggestion`, `menstrual-cycle`, `food-csv`, `food-form`, `date`,
  `measurements`, `wellbeing`, `bodyweight`, `run-stats`.
- [strategie-tests.md](docs/specs/technical/strategie-tests.md) §1, §5 bis et §8 · [BACKLOG.md](BACKLOG.md).

#### Technique — Notes

**L'arbitrage du seuil de branches à 97 %** est la décision que le BACKLOG demandait de prendre, pas
un renoncement. Les ~2,5 % restants ont été audités un par un : ils ne relèvent pas d'un manque de
tests mais de **code défensif inatteignable**, de deux familles seulement — (1) cas d'égalité de
comparateurs de tri appliqués à des **clés de `Map`**, uniques par construction, donc l'égalité ne
peut jamais survenir ; (2) replis `?? 0` sur des `Map.get` dont la clé vient d'être écrite quelques
lignes plus haut. Les couvrir exigerait des tests figeant des comportements absurdes, ou de retirer
ces filets : une métrique échangée contre une protection réelle.

**Ce que viser 100 % a réellement fait apparaître** — et c'est l'argument pour l'avoir fait :

- **trois vrais trous fonctionnels**, qu'aucun pourcentage ne signalait comme tels : les suggestions
  de **glucides** n'étaient exercées nulle part (seuls protéines et lipides l'étaient — un
  copier-coller entre les trois macros aurait suggéré des aliments sur le mauvais nutriment, donc
  plausible et invisible en relecture) ; les fractionnés définis **en durée** (« 30/30 ») n'étaient
  jamais resynchronisés en test, tous les cas portant sur la distance ; et `shouldImportCycleData`
  n'était appelée par aucun test, alors que sa règle de repli est délibérément permissive.
- **deux défauts de code**, corrigés plutôt que couverts par des tests complaisants :
  `bestSegmentTimeFromSamples` renvoyait **`NaN`** pour une distance cible ≤ 0 (l'index de départ
  sortait du tableau) — soit un record de « NaN seconde » écrivable en base ; et le `return null`
  final de `bucketOf` (`training-nutrition.ts`) était **prouvé inatteignable** (`oldest` appartient à
  `weekStarts` et `oldest <= dayKey`, donc la recherche aboutit toujours).
- **deux fonctions publiques importées mais jamais appelées** par leur propre fichier de test :
  `bestSegmentTime` (le point d'entrée réellement utilisé par l'app, qui part de points GPS) et
  `compactLayout` (celle qui empêche un widget masqué de laisser un trou dans la grille — exactement
  le symptôme corrigé le 03/08 sur `training-load`/`overtraining-guard`).
- des cas limites métier désormais figés : boucle GPS revenant à son point de départ (segment
  dégénéré), colonne **absente** d'un CSV d'import vs cellule vide, plusieurs pesées ou courses le
  même jour (variance nulle → aucune tendance calculable), allure moyenne nulle (division par zéro).

⚠️ Une erreur de typage a été introduite puis corrigée dans `run-stats.test.ts` : un `as typeof runs`
masquait un mauvais nom de champ (`durationSeconds` au lieu de `durationS`). Le cast a été retiré au
profit du type réel — un `as` sur une fixture de test, c'est le typecheck qu'on désactive là où il
sert le plus.

Qualité : `typecheck` 0, `lint` **0 erreur**, `test` et `test:coverage` **exit 0**.

### 04/08/2026 — `feature/repas01-planning-repas-liste-courses` — Duplication de semaine : action masquée et expliquée quand la source est vide (US REPAS-01, D12)

Suite de `b94277d`. Solde le **point d'attention** que la revue de ce commit avait laissé ouvert
pour la recette : « Dupliquer la semaine précédente » restait actif même quand la semaine source
était vide. L'appel « réussissait » alors en ne copiant **rien**, et **sans aucun retour visuel** —
le pire des trois comportements possibles (agir, expliquer, ou laisser croire qu'on a agi).
**Tranché par Florian** : masquer le bouton **et** afficher un message.

#### Modifié

- **`meal-plan-repository.ts`** — `COUNT_PLAN_BETWEEN` + hook `useWeekMealPlanCount(weekStart)`.
  Un `COUNT` et non un `useWeekMealPlan(semainePrécédente)` : l'écran n'affiche aucune de ces
  entrées, il a seulement besoin de savoir s'il y en a. Requête réactive, donc le bouton
  réapparaît dès qu'on planifie quelque chose la semaine d'avant, **sans quitter l'écran**.
- **`app/meal-plan/index.tsx`** — le bouton n'est rendu que si `previousWeekCount > 0` ; sinon un
  message prend sa place. **Même principe que le bouton « liste de courses »** de cet écran : une
  action absente est expliquée, jamais retirée en silence.
- **i18n** `mealPlan.duplicateWeek.emptySource` (FR + EN, parité vérifiée : 1870 clés de chaque côté).
- Spec : cas limite ajouté au §5, décision **D12** complétée, **critère de recette 7 bis**.
  [RECETTES.md §28](RECETTES.md) : critère **11 bis**.

#### Technique — Notes

- **6 tests au harness SQLite** sur le comptage (42 au total pour ce repository) : bornes de semaine
  incluses, semaine voisine exclue, entrées archivées et entrées d'un autre utilisateur non comptées.
  Plus un cas qui dit une intention produit : **une semaine entièrement portée au journal reste
  duplicable** — c'est même le cas d'usage principal (« refais-moi la semaine dernière »).
- Le comportement vaut aussi **en reculant dans le passé**, où les semaines antérieures sont vides :
  le message y remplace le bouton, ce qui explique l'absence au lieu de la subir.
- Qualité : `typecheck` 0, `lint` **0 erreur**, `test` **exit 0** — 756 tests Jest (+6), 1559 Vitest.

### 04/08/2026 — `feature/repas01-planning-repas-liste-courses` — Planning repas, liste de courses et partage (US REPAS-01, roadmap 4.27 / 4.28 / 4.29)

Suite de `f9ee91e`. Trois lignes de roadmap **remontées de V1.1 dans le périmètre courant** puis
livrées le jour même (arbitrage Florian) : le code est en avance sur le cahier des charges pendant
les délais externes de Google. **Aucun impact sur le chemin critique du lancement** — pas de
dépendance Play, pas de donnée de santé, pas de service tiers.

**Le lot était bien plus petit que les 10 h estimées** : `recipes`, `recipe_ingredients`,
`meal_templates`, `meal_template_items` et `applyTemplate()` existaient déjà avec leurs repositories
complets, et `foods.category` portait déjà 9 rayons **traduits FR+EN**. Seule la table de planning
manquait ; le regroupement par rayon de la liste de courses était littéralement gratuit.

#### Ajouté

- **3 tables** (`20260804145909`) : `meal_plan_entries`, `shopping_lists`, `shopping_list_items` —
  RLS utilisateur (patron `personal_goals`, pas de `delete`, soft delete), triggers `updated_at`,
  index partiels, publication PowerSync. + **1 migration additive** (`20260804150934`) :
  `meal_plan_entries.consumed_entry_ids jsonb`.
- **`packages/shared/src/meal-plan.ts`** — `portionFactor`, `sumPlannedDay`, `dayTargetKcal`,
  `groupEntriesByMeal`, `weekDayKeys`. **24 tests, 100 % instructions et branches.**
- **`packages/shared/src/shopping-list.ts`** — `normalizeIngredientName`, `aggregateShoppingList`,
  `sortShoppingLines`, `aisleToggleAction`, `formatShoppingListText`. **32 tests, 100 %.**
- **`meal-plan-repository.ts`** (planification, duplication de semaine, portage au journal) et
  **`shopping-list-repository.ts`** (génération, régénération, cochage par article et par rayon) —
  **36 + 28 tests au harness SQLite**.
- **Écrans** `app/meal-plan/index.tsx` (vue semaine + feuille d'ajout) et `shopping.tsx`,
  **`MealPlanDayCard.tsx`** (16 tests de rendu), **carte dédiée sur le hub Nutrition** (point P1
  tranché par Florian : le module demande un investissement de saisie, caché il ne serait pas adopté).
- **Namespace i18n `mealPlan.*`** FR + EN (parité vérifiée : 1869 clés de chaque côté).
- 3 tables ajoutées à l'**export RGPD** — c'est le test de complétude de `data-export` qui l'impose,
  celui qui avait rattrapé l'oubli de `session_intervals` le 03/08.

#### Modifié

- **`docs/specs/functional/alimentation.md` §6 — deux points du cadrage d'origine étaient périmés** :
  il annonçait « **4 cases par jour** » alors que l'US 4.15 a rendu les repas **personnalisables**
  (`nutrition_profiles.meals`) — coder 4 en dur aurait fait **régresser du livré**, sans qu'aucun test
  pur ne le voie (d'où un test de rendu dédié). Et son export « texte ou **PDF** » : écarté (D8).
- `powersync-sync-rules.yaml` (+3 règles), `powersync/schema.ts` (+3 tables), `_layout.tsx` (route
  `meal-plan`), `database.types.ts` régénéré.

#### Technique — Notes

- 🔴 **Le garde-fou central est R1 : le planning n'écrit JAMAIS dans `food_entries`.** Des calories
  planifiées comptées comme consommées auraient faussé les totaux du jour, l'adhérence, la série, le
  bilan hebdo et les analyses inter-piliers — **silencieusement**, et l'historique pollué aurait été
  irrattrapable. Matérialisé par une assertion « le journal est vide après planification » ; le
  portage est un geste explicite, idempotent et réversible (R2/R3).
- **Piège de modèle neutralisé** : `recipe_ingredients.quantity_g` porte la quantité **totale de la
  recette** (`portion = total / servings`). Planifier 2 portions d'une recette qui en produit 4
  demande donc `P/S = 0,5`, pas `P`. Testé deux fois — unitairement et **bout-en-bout jusqu'aux
  grammes en base**, parce qu'un facteur juste en théorie peut se perdre dans les jointures.
- **`quantity_g` est nullable, et un `null` compté comme 0 est le cas dangereux** : il produit une
  liste de courses incomplète **sans le dire**, et on s'en aperçoit au magasin. Les contributions non
  quantifiées sont donc comptées à part (`unquantified_count`) et restituées en clair.
- ⚠️ **Aucune contrainte `unique (user_id, week_start_date)` sur `shopping_lists`, délibérément**
  (D6) : deux appareils générant la même semaine hors réseau produiraient une violation d'unicité qui
  **fait échouer l'upload PowerSync et bloque la file d'écriture**. La liste active est la plus
  récente par `generated_at`. Une contrainte d'unicité sur une table synchronisée est un piège.
- **Liste matérialisée et non dérivée** (D5) : recalculée en continu, elle changerait de lignes et de
  quantités **pendant qu'on est au rayon**, et perdrait les cases cochées à chaque édition de recette.
  En revanche la **génération** lit les ingrédients vivants (R6) — on achète ce qu'on va cuisiner.
- **Export en texte brut via `Share.share()`** (D8) → **aucune dépendance native, donc recettable sur
  l'APK existant**, contrairement à PARTAGE-01 / RUN-F2a / MUSC-F9 / LAUNCHER-01 qui attendent un build.
- **Bonus des jours d'entraînement : forfait fixe seulement**, jamais le mode `auto` de RN-02 — celui-ci
  dérive le bonus de la dépense d'une course **déjà enregistrée**, notion sans objet pour un jour futur.
- **Trouvé en revue de mon propre diff** : `new Date().toLocaleDateString('fr-FR')` dans le titre du
  texte partagé — locale en dur, faux en EN. Remplacé par `formatDayFull` (JJ/MM/AAAA, indépendant du
  système), qui existait déjà dans `shared`.
- 🟠 **Point d'attention pour la recette** : « Dupliquer la semaine précédente » reste actif même
  quand la semaine source est vide — l'appel retourne alors 0 sans aucun retour visuel. À trancher en
  recette (masquer le bouton, ou afficher un message).
- ⚠️ **3 sync rules PowerSync à déployer à la main** avant toute recette : sans elles le planning
  saisi **ne survit pas à une resynchro**. Étape déjà oubliée deux fois (BIEN-01, RUN-F2c).
- Qualité : `typecheck` 0, `lint` **0 erreur**, `test` **exit 0** — 1559 tests Vitest (+56) et
  750 tests Jest (+80) sur 75 suites.

### 04/08/2026 — `refactor/garde01-fusion-garde-fou` — Garde-fou unifié charge & récupération (US GARDE-01, fusion TRI-12 + MR-14)

Suite de `c33db5c`. **Refactor de résolution de contradiction**, pas une feature : la revue de code
de MR-14 (livrée quelques heures plus tôt) avait montré que les deux US **se contredisaient sur le
fond**, et que les deux positions avaient été validées à deux jours d'écart.

| Question | TRI-12 (02/08) | MR-14 (04/08) | GARDE-01 |
|---|---|---|---|
| Un streak seul justifie une alerte ? | Non (R4) | Oui (sa thèse) | **Oui** → niveau `streak` |
| Un widget doit-il en masquer un autre ? | Non (§1, « masquerait un vrai signal ») | Oui (D1) | **Sans objet** — un seul widget |
| Gating | 3 piliers | 2 piliers | **2**, nutrition en composante |

Algèbre du constat (P = muscu∧course, N = nutrition, S = streak ≥ 6 j, D = déficit) : TRI-12 ⟺
`P∧N∧S∧D`, MR-14 ⟺ `P∧S∧¬(P∧N∧S∧D)`, donc **union = `P∧S`**. Le déficit ne décidait plus *si* une
carte s'affiche mais **laquelle** — et deux cartes visuellement identiques se relayaient à des
positions différentes du registre (index 16 vs 20), ce qui se lisait comme « mon alerte a changé de
titre et de place » quand l'utilisateur loggait un repas. GARDE-01 assume ce périmètre et
l'**exprime directement**. Sujet repris immédiatement à la demande de Florian, les deux US
n'ayant pas encore été recettées sur device.

#### Modifié

- **`computeOvertrainingGuard`** (`training-time.ts`) renvoie désormais
  `{ show, severity, streakDays }` avec `severity ∈ 'streak' | 'streakAndDeficit'`. **`show` ne
  dépend que du streak** : R2 remplace R4 de TRI-12, le déficit ne détermine plus que le niveau —
  ce qui rend `show` **monotone** (il ne dépend plus de la négation d'un signal asynchrone) et
  supprime le flash + saut de mise en page pendant l'hydratation PowerSync.
- **`useOvertrainingGuardAlert`** : gating **3 → 2 piliers**. La nutrition **dégrade sa composante**
  (`deficitDaysCount: 0` si inactive) au lieu de masquer le widget — patron déjà posé par TRI-03 D2
  (`useReadiness`). Remplace R5 de TRI-12, qui rendait le garde-fou structurellement invisible aux
  utilisateurs muscu+course : la raison d'être de feu MR-14.
- **`OvertrainingGuardCard`** : message variable selon le niveau, **eyebrow commun aux deux** (c'est
  ce qui fait percevoir une carte qui change de contenu, et non deux cartes). + smoke test (7 tests).
- **i18n** `home.overtrainingGuard.*` réorganisée en sous-objets `streak`/`deficit`. Les 7 chaînes
  sont **déplacées, pas réécrites** — vérifié octet par octet en revue (R6).

#### Supprimé

- `computeLoadStreakAlert` / `LoadStreakAlert` (+ 8 tests), `useLoadStreakAlert`,
  `LoadStreakAlertCard` (+ son test), famille i18n `home.loadStreakAlert.*`.
- `load-streak-alert` retiré de `HOME_WIDGET_IDS` : **21 → 20 widgets, première baisse du compteur
  Tier 0**. Aucune migration de `user_settings.dashboard_layout` — `resolveScreenLayout` ignore les
  ids inconnus ; couvert par un test dédié sur un layout **complet** de 20 widgets.
- **La duplication du calcul de streak** (assumée par MR-14 §3) et **l'appel imbriqué** qui
  instanciait une seconde fois les requêtes surveillées du garde-fou : les abonnements PowerSync
  passent de 6 à 2 instanciations.

#### Technique / Notes

- ⚠️ **Le test « streak 6 + déficit 3 » change volontairement de valeur attendue** (`{show:false}` →
  `{show:true, severity:'streak'}`) : c'est R2 qui remplace R4, **pas une régression**. Documenté sur
  place en 4 lignes. Les 3 autres tests d'origine de TRI-12 sont conservés et prouvent la
  non-régression du diagnostic composite.
- **Aucune régression de couverture** (recalculée en revue) : l'union des deux anciens widgets valait
  `P∧S`, le widget fusionné s'affiche exactement à `P∧S`. Seul changement de contenu voulu : un
  utilisateur 3 piliers avec un streak mais des apports corrects passe du **silence** de TRI-12 au
  niveau `streak`.
- Aucun seuil, aucune formule modifiés (`OVERTRAINING_LOAD_STREAK_DAYS`=6,
  `OVERTRAINING_DEFICIT_DAYS_REQUIRED`=4, `DEFICIT_ALERT_RATIO`=15 % inchangés).
- **Point de recette à connaître** : au niveau surcharge, le titre n'a **pas** de compteur de jours
  (« Signal de surcharge » vs « 8 jours sans repos ») — conséquence de D3 (titres conservés tels
  quels), tracé en spec §9 et §11 pt 7 pour éviter qu'il soit remonté comme un bug.
- Specs [TRI-12](docs/specs/functional/us/tri12-garde-fou-global.md) et
  [MR-14](docs/specs/functional/us/mr14-jours-consecutifs-sans-repos.md) passées à `etape: close`
  avec bandeau de fusion ; leurs listes de critères de recette marquées ⚠️ REMPLACÉES (elles
  attendaient l'inverse du comportement livré) et renvoyant vers
  [GARDE-01 §11](docs/specs/functional/us/garde01-fusion-garde-fou-charge-repos.md) — **liste
  consolidée unique**. Idée IDEAS.md promue ✅ et archivée.
- Qualité : `typecheck` ✅ · `lint` ✅ (0 erreur, 47 warnings **strictement identiques** au baseline) ·
  `test` ✅ **1503 tests shared (70 fichiers) + 670 tests mobile (72 suites) + 157 admin, 0 échec**.

### 04/08/2026 — `feature/mr14-jours-consecutifs-sans-repos` — Jours consécutifs sans repos (US MR-14, catalogue d'analyses)

Suite de `a68a958`. Neuvième candidat catalogue de la session. **US à haut risque de doublon** :
TRI-12 (livrée) calcule déjà le même streak avec le même seuil. Vérification faite au cadrage
(après MR-10 → META-19 et MR-23 → TRI-03, deux absorptions cette semaine) : MR-14 reste distincte
car elle change de **portée** — 2 piliers au lieu de 3, streak **seul** au lieu de « streak ET
déficit » — et couvre donc l'utilisateur muscu+course sans nutrition activée, que TRI-12 ne peut
structurellement pas voir. Cycle complet : `/us` → validation Florian (D1) → implémentation TDD →
revue de code → correctif.

#### Ajouté

- **`packages/shared/src/training-time.ts`** (+ 8 tests) : `computeLoadStreakAlert` — réutilise le
  seuil `OVERTRAINING_LOAD_STREAK_DAYS` (6 j) **déjà établi par TRI-12**, pas un nouveau chiffre.
  Porte aussi la règle D1 (masquage mutuel).
- Hook `useLoadStreakAlert` (`dashboard-repository.ts`), gating `['strength','running']` (2
  piliers, contre 3 pour TRI-12 — c'est la distinction qui justifie l'US).
- Widget `LoadStreakAlertCard` (3 formes), Tier 2 conditionnel (render-null), ton `"warn"`, titre
  interpolé avec le nombre réel de jours. Enregistré dans `widgets.ts`/`dashboard-widgets.tsx`
  (`HOME_WIDGET_IDS` 20 → 21) et dans `isWidgetActive` **dès cet incrément**.
- Nouveau test de registre assertant explicitement la garde 2-vs-3 piliers face à
  `overtraining-guard` : si ces deux gardes deviennent un jour identiques, l'une des deux US est
  un doublon — le test le fera savoir.
- i18n FR + EN (`home.loadStreakAlert.*`, 4 clés, eyebrow volontairement distinct de TRI-12).

#### Corrigé

- 🔴 **Trouvé en revue de code, avant commit : la règle D1 n'avait aucun test.** Elle vivait en
  post-traitement dans le hook (`if (guard.show) return …`) ; inverser la condition laissait les
  **2169 tests verts**. Déplacée dans la fonction pure (`overtrainingGuardShown` en paramètre) et
  couverte par 3 tests. **Validité prouvée par mutation** : condition inversée → 2 tests rouges,
  restaurée → 38 verts.
- Spec §7 amendée : l'appel imbriqué `useOvertrainingGuardAlert()` instancie une seconde fois les
  requêtes surveillées de TRI-12 (aucune requête *nouvelle*, mais des abonnements en plus).
- Spec §9 complétée d'un cas limite manquant : `computeStreak` tolérant « hier », l'alerte reste
  visible toute la journée où l'utilisateur se repose enfin. **Assumé** — exiger `activeToday`
  changerait la sémantique du streak pour TRI-01/TRI-12 aussi.

#### Technique / Notes

- US d'analyse catalogue-only (`roadmap: []`) : aucune ligne de roadmap touchée.
- **`useOvertrainingGuardAlert`/TRI-12 non modifiée** (vérifié en revue) : le calcul du streak est
  **volontairement dupliqué** plutôt qu'extrait — TRI-12 est déjà à `etape: recette`, on ne
  réorganise pas son code pour une US sans rapport. Les deux copies sont strictement identiques
  (vérifié par diff en revue) ; **si le seuil ou `sessionLoad` change, penser aux deux endroits**.
- ⚠️ **Conséquence de conception tracée dans [IDEAS.md](IDEAS.md)** : l'union TRI-12 ∪ MR-14 vaut
  « muscu+course actifs ∧ streak ≥ 6 » — depuis MR-14, une carte s'affiche donc **toujours** dans
  ce cas, le déficit ne décidant plus que *laquelle*. Un utilisateur dont le déficit repasse sous
  son seuil voit la carte changer de titre **et de position**. Candidat de **fusion des deux
  cartes** en un widget à message variable, à reprendre après la recette device de TRI-12 —
  hors périmètre ici (modifierait TRI-12).
- Qualité : `typecheck` ✅ · `lint` ✅ (0 erreur, aucun nouveau warning) · `test` ✅ **1505 tests
  shared (70 fichiers) + 667 tests mobile (72 suites) + admin, 0 échec**.

### 04/08/2026 — `feature/mr08-interference-concurrent-training` — Interférence concurrent training (US MR-08, catalogue d'analyses)

Suite de `902143b`. Huitième candidat catalogue de la session, décision D1 (seuils de détection)
laissée à mon jugement par Florian (« Fais ce qu'il te semble le plus logique ») — tranchée en
réutilisant **exactement** les seuils ACWR déjà validés (META-19/RUN-18 : ratio 7j/28j > 1,3 =
hausse, < 0,8 = chute), plutôt qu'un nouveau chiffre non sourcé. Cycle complet : `/us` →
validation → implémentation TDD → revue de code (`superpowers:code-reviewer`, aucun finding
bloquant).

#### Ajouté

- **`packages/shared/src/training-time.ts`** (+ 8 tests) : `computeConcurrentTrainingInterference`
  — divergence muscu/course, deux ratios acute(7j)/chronique(28j) calculés séparément dans leur
  unité native (`volumeKg` muscu, `distanceM` course), **pas** la charge sRPE combinée de
  `computeAcwr` (ça, c'est META-19 — pas de doublon, cf. spec §1). Réutilise les constantes de
  module déjà présentes dans ce fichier (`ACUTE_WINDOW_DAYS`, `CHRONIC_WINDOW_DAYS`,
  `ACWR_RISK_THRESHOLD`, `ACWR_LOW_THRESHOLD`), aucun nouveau chiffre.
- Hook `useConcurrentTrainingInterference` (`dashboard-repository.ts`), gating tout-ou-rien
  `['strength','running']`, composé de `useWorkoutHistory()`/`useRunHistory()` déjà chargées
  ailleurs sur le dashboard — aucune nouvelle requête.
- Widget `ConcurrentTrainingInterferenceCard` (3 formes), Tier 2 conditionnel (render-null), ton
  neutre `"card"` (pas `"warn"` — un constat factuel, pas une alerte de sécurité, même patron que
  `ActivityLevelSuggestionCard`). Enregistré dans `widgets.ts`/`dashboard-widgets.tsx`
  (`HOME_WIDGET_IDS` 19 → 20) et dans `isWidgetActive` (`(tabs)/index.tsx`) **dès cet incrément**
  — pas laissé à la revue, contrairement à 3 widgets conditionnels précédents cette session.
- i18n FR + EN (`home.concurrentTrainingInterference.*`, 6 clés, message symétrique
  bidirectionnel via `{{up}}`/`{{down}}`).
- Spec + plan + maquette : [mr08-interference-concurrent-training.md](docs/specs/functional/us/mr08-interference-concurrent-training.md),
  [plan](docs/plans/mr08-interference-concurrent-training.md), [maquette](design/mr08-interference-concurrent-training/mr08-interference-concurrent-training.html).

#### Technique / Notes

- US d'analyse catalogue-only (`roadmap: []`) : aucune ligne de roadmap touchée.
- Diff strictement additif : `computeAcwr`/`sessionLoad` (META-19) non touchés, vérifié en revue.
- Catalogue et maquette resynchronisés dès la validation, avant l'implémentation.
- Qualité : `typecheck` ✅ · `lint` ✅ (0 erreur, aucun nouveau warning) · `test` ✅ **1496 tests
  shared (70 fichiers) + 663 tests mobile (71 suites) + admin, 0 échec**.

### 04/08/2026 — `feature/nutr18-bilan-calorique-hebdo` — Bilan calorique hebdomadaire (US NUTR-18, catalogue d'analyses)

Suite de `94fe516`. Septième candidat catalogue de la session — pas de nouvelle carte : ADR-007
avait explicitement anticipé la saturation de l'écran Stats nutrition (déjà 8 blocs) et prescrit
le regroupement à la prochaine analyse qui s'y ajoute. NUTR-18 applique ce remède : deux lignes
ajoutées à la carte Adhérence (NUTR-10) déjà existante, pas une 9ᵉ carte. Cycle complet : `/us` →
validation Florian (D1 : suit le sélecteur 7j/30j existant) → implémentation TDD → revue de code
(`superpowers:code-reviewer`, aucun finding bloquant).

#### Ajouté

- **`packages/shared/src/nutrition.ts`** (+ 5 tests) : `computeCaloricBalance` — bilan cumulé
  signé (Σ kcal − Σ objectif effectif) + décompte binaire jours au-dessus/en dessous, sur le
  **même filtre** de jours exploitables que `computeGoalAdherence` (pas de 2ᵉ convention).
- `GoalAdherence` (`dashboard-repository.ts`) étendu avec `balanceKcal`/`daysAbove`/`daysBelow` —
  extension purement additive de `useGoalAdherenceForRange`, sur le `perDay` déjà construit
  (aucune requête supplémentaire). Confirmé sans régression pour le 2ᵉ consommateur du hook
  (BILAN-01, `weekly-review-repository.ts`) par le typecheck + la suite Jest complète.
- Carte Adhérence (`nutrition-stats.tsx`) : 2 nouvelles lignes, `formatSignedKcal` (`Intl.
  NumberFormat`, `signDisplay: 'exceptZero'`, patron déjà utilisé par `formatSteps` dans
  `StepsCard.tsx`), i18n FR + EN (`stats.adherence.balance`/`aboveBelow`).
- Spec + plan + maquette : [nutr18-bilan-calorique-hebdo.md](docs/specs/functional/us/nutr18-bilan-calorique-hebdo.md),
  [plan](docs/plans/nutr18-bilan-calorique-hebdo.md), [maquette](design/nutr18-bilan-calorique-hebdo/nutr18-bilan-calorique-hebdo.html).

#### Technique / Notes

- US d'analyse catalogue-only (`roadmap: []`) : aucune ligne de roadmap touchée.
- Catalogue et maquette resynchronisés dès la validation, avant l'implémentation (plutôt qu'après
  coup en revue, comme les 6 US précédentes de la session).
- Qualité : `typecheck` ✅ · `lint` ✅ (0 erreur, aucun nouveau warning) · `test` ✅ **1488 tests
  shared (70 fichiers) + 658 tests mobile (70 suites) + admin, 0 échec**.

### 04/08/2026 — `feature/musc20-regularite-entrainement` — Régularité & consistance d'entraînement (US MUSC-20, catalogue d'analyses)

Suite de `a91dc42`. Sixième et dernier candidat catalogue de la session, le plus riche : 5ᵉ section
sur l'écran Progression (`/progress`), 3 métriques indépendamment disponibles ou non (séances/sem
vs objectif, écart-type des intervalles, taux de séances tenues). Cycle complet : `/us` →
validation Florian (4 décisions) → implémentation TDD → revue de code → correctif.

#### Ajouté

- **`packages/shared/src/workout.ts`** (+ 4 tests) : `computeIntervalRegularity` — écart-type de
  population des intervalles en jours entre séances, formule et seuil (< 3 séances → indisponible)
  repris tels quels de CYCLE-01 (`stdDev`), aucun nouveau chiffre inventé.
- Hook `useTrainingRegularity` (`planned-session-repository.ts`, 28 j glissants) : **réutilise
  `computeWeekCompletionRate`** (posée par MUSC-F15) pour le taux de séances tenues plutôt que
  d'écrire une nouvelle fonction — trouvaille faite pendant le cadrage.
- Section `RegularitySection` sur `/progress`, i18n FR + EN (`progress.regularity.*`), état vide
  explicite si les 3 métriques sont indisponibles.
- Spec + plan + maquette : [musc20-regularite-entrainement.md](docs/specs/functional/us/musc20-regularite-entrainement.md),
  [plan](docs/plans/musc20-regularite-entrainement.md), [maquette](design/musc20-regularite-entrainement/musc20-regularite-entrainement.html).
  Décision structurante : « objectif » = le planning réel de l'utilisateur (`planned_sessions`),
  pas un nouveau système de but — aucun champ de fréquence cible n'existe ailleurs dans l'app (ni
  sur les programmes, ni dans OBJ-01).

#### Corrigé

- 🔴 **Bug critique trouvé en revue de code (`superpowers:code-reviewer`), avant commit** : la
  requête `planned_sessions` (`useTrainingRegularity`) n'avait pas de borne haute sur
  `scheduled_date` — perdue entre le plan (qui la prévoyait) et le code. `generatePlannedSessions`
  générant tout le programme dès l'activation, tout utilisateur avec un programme actif faisait
  remonter l'intégralité des séances **futures** dans le calcul, gonflant l'objectif hebdomadaire
  et faisant chuter artificiellement le taux de séances tenues. Corrigé (`AND ps.scheduled_date <=
  ?`, borne = aujourd'hui) et couvert par 3 nouveaux tests SQL directs sur du vrai SQLite
  (`planned-session-sql.test.ts`) qui auraient attrapé le bug — vérifié en revert temporaire du
  correctif (le test casse bien sans lui).
- 🟢 Catalogue et maquette resynchronisés après validation (même réflexe que les US précédentes).

#### Technique / Notes

- US d'analyse catalogue-only (`roadmap: []`) : aucune ligne de roadmap touchée.
- **Point de vigilance ADR-007 signalé, pas résolu** : `/progress` atteint 5 sections avec cette
  US — le seuil de repli recommandé (~4-5 sections) est franchi. Accepté pour cette US (décision
  D4) ; un refactor en sections repliables toucherait les 4 sections existantes et reste hors
  périmètre d'une US d'analyse. À reprendre si la densité de l'écran s'avère gênante en usage réel.
- Aucune fonction de MUSC-F15/CYCLE-01 modifiée — MUSC-20 consomme uniquement leurs sorties déjà
  testées (`computeWeekCompletionRate`, formule d'écart-type).
- Qualité : `typecheck` ✅ · `lint` ✅ (0 erreur, aucun nouveau warning) · `test` ✅ **1483 tests
  shared (70 fichiers) + 658 tests mobile (70 suites), 0 échec**.

### 04/08/2026 — `feature/musc12-densite-entrainement` — Densité d'entraînement volume/temps (US MUSC-12, catalogue d'analyses)

Suite de `ecd3da4`. Cinquième candidat de la session, le plus petit périmètre de la série : une
ligne « Densité » (kg/min) ajoutée au résumé de fin de séance existant
(`workout-summary.tsx`), qui calculait déjà volume et durée séparément sans jamais afficher leur
rapport. Aucun nouveau widget, aucune nouvelle requête, aucun hook nouveau. Cycle complet : `/us` →
validation Florian (1 décision) → implémentation TDD → revue de code.

#### Ajouté

- **`packages/shared/src/workout.ts`** (+ 4 tests) : `computeTrainingDensity` — volume ÷ durée,
  arrondi à 1 décimale, garde contre une durée nulle.
- `apps/mobile/src/app/workout-summary.tsx` : champ `density` dans `Summary`/`buildSummary`,
  nouvelle `Row` juste après Volume, réutilisant `units.formatWeight()` (déjà en place pour cette
  ligne) suffixé `/min`.
- i18n FR + EN : clé `workout.summary.density`.
- Spec + plan + maquette : [musc12-densite-entrainement.md](docs/specs/functional/us/musc12-densite-entrainement.md),
  [plan](docs/plans/musc12-densite-entrainement.md), [maquette](design/musc12-densite-entrainement/musc12-densite-entrainement.html).
  Décision D1 (périmètre v1 limité à la stat par séance, tendance historique différée) validée par
  Florian.

#### Corrigé

- 🟢 **Trouvé en revue de code** : catalogue et maquette pas resynchronisés après la validation de
  Florian (même réflexe oublié que sur RN-03/MN-04/MUSC-19 en tout début de commit, corrigé avant
  celui-ci cette fois) ; DoD de la spec pas cochée malgré des critères déjà vérifiés vrais.

#### Technique / Notes

- US d'analyse catalogue-only (`roadmap: []`) : aucune ligne de roadmap touchée.
- Carte de séance partageable (PARTAGE-01, `ShareCardSheet`) volontairement non modifiée (spec R4)
  — vérifié en revue, la densité n'apparaît pas dans ce qui est partagé.
- Qualité : `typecheck` ✅ · `lint` ✅ (0 erreur, aucun nouveau warning) · `test` ✅ **1479 tests
  shared (70 fichiers) + 655 tests mobile (70 suites), 0 échec**.

### 04/08/2026 — `feature/musc19-tonnage-cumule` — Tonnage cumulé lifetime/annuel (US MUSC-19, catalogue d'analyses)

Suite de `06752c6`. Quatrième candidat piochée dans le catalogue d'analyses. **Pas un widget
dashboard** : une 4ᵉ section sur l'écran Progression existant (`/progress`) — total de kg soulevés
à vie et sur l'année civile en cours, plus un jalon symbolique (1 000 000 kg) affiché en badge
silencieux, sans notification (arbitrage C, gamification hors V1). Cycle complet : `/us` →
validation Florian (4 décisions) → implémentation TDD → revue de code → correctifs.

#### Ajouté

- **`packages/shared/src/date.ts`** (+ 3 tests) : `localStartOfYear` — minuit local du 1er janvier,
  même patron que `localMidnightDaysAgo`.
- **`packages/shared/src/workout.ts`** (+ 4 tests) : `TONNAGE_MILESTONE_KG`, `hasReachedTonnageMilestone`
  — un seul jalon (décision D3), pas une échelle de paliers.
- Hook `useLifetimeTonnage` (`records-repository.ts`) : même patron SQL que `useMuscleBalance`
  (`SUM(s.reps * s.weight_kg)`, mêmes filtres), sans `GROUP BY` — deux sommes (à vie, cette année)
  dans une seule requête.
- Section `LifetimeTonnageSection` sur `/progress`, i18n FR + EN (`progress.lifetimeTonnage.*`).
- Spec + plan + maquette : [musc19-tonnage-cumule.md](docs/specs/functional/us/musc19-tonnage-cumule.md),
  [plan](docs/plans/musc19-tonnage-cumule.md), [maquette](design/musc19-tonnage-cumule/musc19-tonnage-cumule.html).

#### Corrigé

- 🟠 **Trouvé en revue de code (`superpowers:code-reviewer`), avant commit** — 4 points :
  1. Le badge du jalon était rendu **hors** du bloc `accessible` de la section : TalkBack l'aurait
     énoncé deux fois. Déplacé à l'intérieur (même patron que `GoalCard`).
  2. Formatage des nombres en `toLocaleString()` nu, sans locale explicite — alors que
     `useUnits().formatWeight()` existe déjà (utilisé par `WeeklyVolumeSection`, même écran) et gère
     conversion kg/lb + locale + décimales en un seul appel. Les deux totaux et le message du jalon
     l'utilisent désormais.
  3. **Déviation de la maquette validée** : le message du jalon interpolait le total à vie courant
     (qui grandit avec chaque séance) au lieu du **seuil fixe** (1 000 000 kg) montré dans la
     maquette. Corrigé — `{{weight}}` reçoit maintenant `TONNAGE_MILESTONE_KG`, jamais le total live.
  4. `docs/product/analyses-donnees.md` et la maquette affichaient encore « décisions non
     arbitrées » après la validation de Florian — même défaut mineur que sur RN-03/MN-04,
     resynchronisé.
- 🟢 Nit cosmétique : les commentaires de sections dans `progress/index.tsx` numérotaient la
  nouvelle section « 1ter » alors qu'elle est rendue **avant** la section « 1bis » existante —
  renumérotées dans l'ordre réel d'affichage.

#### Technique / Notes

- US d'analyse catalogue-only (`roadmap: []`) : aucune ligne de roadmap touchée.
- Distincte de l'idée « Il y a 1 an » / souvenirs (`IDEAS.md`, différée le 13/07/2026 car elle exige
  un an d'historique) — le tonnage cumulé n'a aucune dépendance de ce type.
- Avertissement pré-existant, non lié à ce diff (vérifié par `git diff`) : `localMidnightDaysAgo`
  importé mais jamais appelé dans `records-repository.ts` (seulement mentionné en commentaire) —
  hors périmètre de cette US, non corrigé.
- Qualité : `typecheck` ✅ · `lint` ✅ (0 erreur, 1 warning pré-existant sans lien) · `test` ✅
  **1475 tests shared (70 fichiers) + 655 tests mobile (70 suites), 0 échec**.

### 04/08/2026 — `feature/mn04-glucides-peri-seance` — Macros ajustées jours muscu (US MN-04, catalogue d'analyses)

Suite de `3c390b5`. Troisième candidat piochée dans le catalogue d'analyses pendant la fenêtre de
recette. **Périmètre volontairement petit** : pas un nouveau widget — corrige un trou déjà
**documenté dans un commentaire du code** (`nutrition.tsx`, « les macros cibles restent calées sur
l'objectif de base — bonus non ventilé ») : les 3 barres macro (protéines/glucides/lipides) ne
totalisaient jamais l'objectif calorique effectif affiché juste au-dessus, un jour d'entraînement,
parce qu'elles étaient calculées depuis l'objectif de **base** au lieu de l'objectif **effectif**
(base + bonus MN-01/RN-02). Cycle complet : `/us` → validation Florian (1 seule décision, D1) →
implémentation TDD → revue de code.

#### Ajouté

- **`packages/shared/src/nutrition.ts`** (+ 5 tests) : `trainingDayMacroGrams`. Redirige le bonus
  calorique du jour (déjà calculé par MN-01/RN-02, jamais recalculé ici) intégralement vers les
  glucides — décision D1, validée par Florian : pas de répartition avec les protéines, déjà
  couvertes indépendamment par MN-06 (g/kg par objectif). Sans bonus, résultat strictement
  identique au calcul précédent (R4, non-régression jour de repos).
- Spec + plan + maquette : [mn04-glucides-peri-seance.md](docs/specs/functional/us/mn04-glucides-peri-seance.md),
  [plan](docs/plans/mn04-glucides-peri-seance.md), [maquette](design/mn04-glucides-peri-seance/mn04-glucides-peri-seance.html)
  (avant/après chiffré : 2 004 kcal de macros affichées vs 2 400 annoncés → 2 404 après correction).

#### Corrigé

- 🟠 **`NutritionSummaryCard.tsx` et `(tabs)/nutrition.tsx`** appelaient tous les deux
  `macroGramsFromCalories(target, …)` avec l'objectif de **base**, jamais l'objectif **effectif** —
  bug pré-existant, déjà repéré et documenté en commentaire par un dev précédent mais jamais corrigé.
  Les deux écrans utilisent désormais `trainingDayMacroGrams({ targetBase, effectiveTarget,
  objective })`. Un 3ᵉ appel (`apps/mobile/src/app/nutrition-profile.tsx`, écran de configuration du
  profil, aucune notion de jour/bonus) est resté inchangé à bon droit — vérifié en revue de code.
- 🟢 **Trouvé en revue de code, avant commit** : le catalogue d'analyses et la maquette affichaient
  encore « décision D1 non arbitrée » après la validation de Florian — resynchronisés (même défaut
  mineur que sur RN-03, la relecture systématique après validation paie).

#### Technique / Notes

- US d'analyse catalogue-only (`roadmap: []`) : aucune ligne de roadmap touchée.
- Aucune fonction de MN-01/RN-02/RN-03/MN-06 modifiée — MN-04 consomme uniquement leur résultat déjà
  calculé (`effectiveTarget - target`), aucun risque de double-comptage calorique.
- Qualité : `typecheck` ✅ · `lint` ✅ (0 erreur, aucun nouveau warning, imports morts retirés) ·
  `test` ✅ **1468 tests shared (70 fichiers) + 655 tests mobile (70 suites), 0 échec**.

### 04/08/2026 — `feature/rn03-tdee-ajuste-course` — Ajustement auto du TDEE selon le volume de course (US RN-03, catalogue d'analyses)

Suite de `cadaf56`. Deuxième candidat piochée dans le catalogue d'analyses pendant la fenêtre de
recette. Comble un trou identifié dans [alimentation.md §2.2](docs/specs/functional/alimentation.md)
(« ajustement automatique selon le planning d'entraînement », jamais construit) : le facteur
d'activité (`nutrition_profiles.activity_level`) reste figé depuis l'onboarding, même quand le
volume réel de course change durablement — distinct de RN-02 (déjà livrée), qui n'ajuste que le
**jour** de séance/course, jamais le **socle**. Cycle complet : `/us` → validation Florian →
implémentation TDD → revue de code → correctifs.

#### Ajouté

- **`packages/shared/src/nutrition.ts`** (+ 10 tests) : `activityLevelFromRunningFrequency`,
  `suggestActivityLevel`. Compare la fréquence de course réelle sur 14 j glissants au palier
  `activity_level` déclaré ; bidirectionnelle (hausse et baisse), plafonnée à `active` (aucun seuil
  sourcé pour `very_active` dans la spec d'origine). Aucune modification de
  `dayCalorieBonus`/`trainingBonusMode`/`computeEffectiveTargetForDay` (RN-02) — vérifié en revue.
- Widget dashboard **conditionnel** (Tier 2) `activity-level-suggestion` : `HOME_WIDGET_IDS` 18 →
  19, gating registre `['running', 'nutrition']` (sémantique **OU** au niveau grille — le vrai ET
  est appliqué dans le hook, comme `training-load`), hook `useActivityLevelSuggestion`
  (`dashboard-repository.ts`), composant `ActivityLevelSuggestionCard.tsx` (3 formes) + son smoke
  test (écrit avec le composant cette fois, contrairement à TRI-03).
- i18n FR + EN, famille `home.activityLevelSuggestion.*` — réutilise les libellés de palier
  existants (`nutrition.activity.options.*`) plutôt que de les dupliquer.
- Spec + plan + maquette : [rn03-tdee-ajuste-course.md](docs/specs/functional/us/rn03-tdee-ajuste-course.md),
  [plan](docs/plans/rn03-tdee-ajuste-course.md), [maquette](design/rn03-tdee-ajuste-course/rn03-tdee-ajuste-course.html).
  **Aucun bouton d'application directe** (décision D5) : texte seul, renvoi vers l'écran profil
  nutrition existant — même patron que toutes les suggestions déjà livrées (MUSC-F7).

#### Corrigé

- 🔴 **Trouvé en revue de code (`superpowers:code-reviewer`), avant commit** : `isWidgetActive`
  (`apps/mobile/src/app/(tabs)/index.tsx`) n'avait pas été mis à jour pour le nouveau widget —
  `WidgetGrid` réservait une cellule vide dès qu'il rendait `null` (palier déjà cohérent, ou
  gating incomplet), **même défaut** déjà corrigé une fois pour `training-load`/`overtraining-guard`
  (commit `1b112de`). La revue a aussi révélé que **`readiness` (US TRI-03) avait le même trou**,
  jamais câblé dans `isWidgetActive` lors de sa livraison — corrigé pour les deux d'un coup, même
  fichier, même fonction.

#### Technique / Notes

- US d'analyse catalogue-only (`roadmap: []`, comme TRI-03/TRI-12/META-19/RUN-18) : aucune ligne de
  roadmap touchée, pas d'entrée RECETTES.md.
- Qualité : `typecheck` ✅ · `lint` ✅ (0 erreur, aucun nouveau warning) · `test` ✅ **1463 tests
  shared (70 fichiers) + 655 tests mobile (70 suites), 0 échec** — inclut le correctif
  `isWidgetActive`, revérifié après coup.

### 03/08/2026 — `feature/tri03-score-readiness` — Score de forme / readiness global (US TRI-03, catalogue d'analyses)

Suite de `48356e2`. Candidat piochée dans le [catalogue d'analyses](docs/product/analyses-donnees.md)
pendant la fenêtre de recette de LAUNCHER-01 (rien d'autre n'était en état d'être codé : les 34 US en
cours attendaient toutes une recette device, et les 2 P0 restants — LANCE-00/01 — sont administratifs).
Cycle complet en une session : `/us` (spec + plan + maquette) → validation Florian → implémentation TDD
→ revue de code → correctifs.

#### Ajouté

- **`packages/shared/src/readiness.ts`** (+ `readiness.test.ts`, 22 tests) : `classifyLoadComponent`,
  `classifyNutritionComponent`, `classifyWellbeingComponent`, `computeReadiness`. Composition **pure**
  de 3 briques déjà existantes — `computeAcwr` (META-19/RUN-18), `averageIntake`/`DEFICIT_ALERT_RATIO`/
  `MIN_LOGGED_DAYS` (MN-02), `wellbeingAverages` (BIEN-01) — aucune donnée nouvelle, aucune migration.
- Widget dashboard **transverse** `readiness` (`'always'`, comme `wellbeing`/`review` — pas un gating
  tout-ou-rien par pilier comme `training-load`/`overtraining-guard`) : `HOME_WIDGET_IDS` 17 → 18,
  hook `useReadiness` (`dashboard-repository.ts`), composant `ReadinessCard.tsx` (3 formes + détail des
  3 composantes en forme `large`, jamais un verdict nu) + son smoke test.
- i18n FR + EN complètes, famille `home.readiness.*` (verdicts, libellés de composantes, raisons
  d'indisponibilité).
- Spec + plan + maquette : [tri03-score-readiness.md](docs/specs/functional/us/tri03-score-readiness.md),
  [plan](docs/plans/tri03-score-readiness.md), [maquette](design/tri03-score-readiness/tri03-score-readiness.html).

#### Corrigé

- 🔴 **Bug de conception trouvé pendant le TDD (RED, avant tout code applicatif)** : la règle R4
  initiale exigeait que *toutes* les composantes disponibles soient positives pour afficher
  « Prêt à pousser ». Or la composante nutrition (R2) ne produit **jamais** l'état positif (pas de
  symétrie sur le surplus, décision assumée) — avec cette règle, un utilisateur nutrition active
  n'aurait **jamais** pu voir ce verdict, quelle que soit sa forme réelle. Corrigé en symétrisant R4 :
  un seul signal positif suffit pour « push », comme un seul signal négatif suffit pour « rest ».
  Spec, plan et maquette mis à jour avec la correction documentée.
- 🟠 **Trouvé en revue de code (`superpowers:code-reviewer`), avant commit** : le texte i18n du
  verdict « push » (FR/EN) reflétait encore l'ancienne règle (« tous vos signaux sont au vert »),
  en contradiction avec le détail des composantes juste en dessous (qui n'affiche jamais
  « Nutrition : positive »). Reformulé (« un signal positif se distingue aujourd'hui, sans rien à
  signaler ailleurs ») ; même correction apportée à la maquette HTML, qui illustrait encore un état
  « Nutrition : positive » impossible à produire par le code livré.
- 🟢 Revue additionnelle : absence de smoke test pour `ReadinessCard` relevée (contrairement à
  `WellbeingCard`/`ReviewCard`, le précédent le plus proche pour un widget transverse) — ajouté
  après coup (5 tests : masquage R5, verdicts rest/push, forme small sans détail, forme large avec
  composante indisponible + raison).

#### Technique / Notes

- **MR-23** (« Score de récupération/readiness croisé », catalogue) marquée **absorbée par TRI-03**
  dans `analyses-donnees.md` (même précédent que MR-10 → META-19) : la dégradation par composante de
  TRI-03 couvre déjà le scénario muscu+course « sans wearable » que MR-23 décrivait séparément.
  `weightTrend` (listé par le jet initial du catalogue) volontairement hors périmètre v1 (décision D4).
- US d'analyse catalogue-only (`roadmap: []`, comme TRI-12/META-19/RUN-18) : aucune ligne de roadmap
  touchée, pas d'entrée RECETTES.md (les critères de recette vivent dans la spec elle-même, §11).
- Qualité : `typecheck` ✅ · `lint` ✅ (0 erreur, aucun nouveau warning) · `test` ✅ **1452 tests
  shared (70 fichiers) + 651 tests mobile (69 suites), 0 échec**.

### 03/08/2026 — `feature/launcher01-widget-ecran-accueil` — LAUNCHER-01 : widget transparent en recette, deux causes racines trouvées et corrigées

Suite de `55db491`. Constaté en recette device (Pixel 6a) le soir même : le widget s'ajoutait à
l'écran d'accueil mais restait **entièrement transparent**. Deux bugs indépendants, diagnostiqués
par `adb logcat` (aucun des deux n'était reproductible en lecture de code seule).

#### Corrigé

- 🔴 **Course perdue entre l'invocation native du widget et l'enregistrement JS de sa tâche de
  fond.** Log exact : `No task registered for key RNWidgetBackgroundTask`. Après un `WIDGET_ADDED`
  à froid, Android relance le process et invoque la tâche de fond **~1,7 s** après le démarrage —
  mais `registerWidgetTaskHandler` (`register-home-widget.tsx`) n'était atteint qu'au fond du
  graphe de require d'Expo Router (`_layout.tsx` → i18n → PowerSync → tous les écrans...), qui met
  lui **plus de 3,5 s** à charger. Corrigé en créant `apps/mobile/index.js` (nouveau point d'entrée,
  `package.json` → `main`) qui enregistre la tâche **avant** `import 'expo-router/entry'` — patron
  standard des tâches Headless JS React Native (registre au plus haut niveau du bundle, jamais dans
  un composant imbriqué). Retiré de `_layout.tsx`, avec un commentaire expliquant pourquoi ne pas
  l'y remettre.
- 🔴 **`HomeWidget.tsx` incompatible avec le React Compiler.** Une fois la course ci-dessus corrigée,
  nouveau log : `Widget Error: Invalid Hook Call detected... Fix: Add "use no memo"; at the very top
  of your widget file`. Le React Compiler (`app.json` → `experiments.reactCompiler`, activé pour
  tout le projet) transforme le composant d'une façon incompatible avec `buildWidgetTree` de
  `react-native-android-widget`, qui appelle la fonction directement hors du reconciler React. **Ce
  point était identifié dans la recherche technique initiale** (§1 de la spec) mais oublié à
  l'écriture du composant — leçon retenue, documentée en commentaire dans le fichier pour ne pas la
  reperdre. Corrigé par l'ajout de `'use no memo';` en tout premier de `HomeWidget.tsx`.

#### Technique / Notes

- Diagnostic mené en 3 allers-retours : APK instrumenté → `adb logcat -c` → reproduction (retrait +
  ajout du widget) → `adb logcat -d`, à chaque fois. Aucun des deux bugs n'était visible en lecture
  de code ni en test unitaire (les deux sont des interactions avec le runtime natif Android /
  React Compiler, hors du périmètre de ce que `home-widget-data.test.ts`/`home-widget-texts.test.ts`
  peuvent couvrir).
- **Validé sur device** (Pixel 6a) après le second correctif : logs propres (`WM-WorkerWrapper:
  Worker result SUCCESS`), plus aucune trace de `No task registered` ni `Invalid Hook Call`, widget
  affiché avec son vrai contenu.
- Qualité : `typecheck` ✅ · `lint` ✅ (0 erreur) · `test` ✅ **69 shared + 68 suites mobile
  (646 tests) + 6 admin, 0 échec** (aucun changement dans ce commit ne touche du code testable
  unitairement — les deux bugs vivent à la frontière runtime natif / bundler).

### 03/08/2026 — `feature/launcher01-widget-ecran-accueil` — Widget écran d'accueil Android (US LAUNCHER-01, roadmap 7.19)

Suite de `4c24843` (spec/plan/maquette validés par Florian). Dernier candidat non démarré de la
2ᵉ salve d'enrichissements — code livré le jour même de la validation.

#### Ajouté

- **`react-native-android-widget`** (dépendance native, config plugin Expo) : rend la UI du widget
  en JSX (`FlexWidget`/`TextWidget`), zéro Kotlin écrit à la main. Révision à la baisse du coût
  initialement estimé « le plus cher des 5 » (natif Kotlin/Glance) — voir spec §1.
- **`apps/mobile/src/widgets/home-widget-data.ts`** — `computeHomeWidgetSnapshot()`, orchestration
  **hors contexte React** (D2/D3) : la tâche Headless JS du widget peut s'exécuter sans qu'aucun
  arbre React ne soit monté, même contrainte déjà documentée pour la tâche de fond GPS
  (`@/running/tracker-task`). Réutilise le **même singleton PowerSync** que l'app UI (jamais une
  seconde connexion — PowerSync documente explicitement le risque de verrous/`watch()` cassé sur
  ce point) et les **mêmes fonctions pures déjà testées** de `@wellness/shared`
  (`computeStreakWithJokers`, `tdee`, `targetCalories`...), jamais une logique dupliquée. 12 tests
  sur harness SQLite réel (`@/test-utils/sqlite-harness`).
- **`apps/mobile/src/widgets/home-widget-texts.ts`** — résout tout le texte affiché **avant** de le
  passer au widget natif (D4, même patron que `notification-repository.ts`/`notifications.ts` :
  l'orchestration résout via `i18n.t()`, l'affichage ne fait que peindre). 5 tests.
- **`apps/mobile/src/widgets/HomeWidget.tsx`** — composant JSX du widget (streak / séance du jour /
  kcal restantes), fond/accent repris de la charte (`#1c130c`/`#dd6e40`, comme PARTAGE-01).
  `accessibilityLabel` posé sur la racine, lu d'un bloc par TalkBack — **le risque d'accessibilité
  soulevé en spec (rendu bitmap, pas d'éléments natifs typés) est levé** : la lib expose bien cette
  API.
- **Rafraîchissement (D5)** : `apps/mobile/src/widgets/refresh-home-widget.ts` +
  `useHomeWidgetRefresh` (foreground/background de l'app, même patron que
  `useAppOpenedAnalytics`), déclenché aussi depuis `finishWorkout`, `finishRun`/`finishManualRun`
  et `addFoodEntry` (fire-and-forget, jamais bloquant pour l'action réelle).
- **i18n** : famille `homeWidget.*` (FR+EN), réutilise `pillars.strength`/`pillars.running` déjà
  existants pour le sous-titre de la séance du jour.

#### Simplifications assumées (V1, hors périmètre — spec §8)

- **Séance du jour** : ne distingue pas une séance déjà **en cours** ni les replis riches de
  `useTodaySession` — seulement « prévue aujourd'hui » ou « repos ».
- **Kcal restantes** : objectif de **base** (TDEE + objectif), sans le bonus jour d'entraînement de
  `useDayCalorieTarget` — sous-estime le restant les jours de séance, jamais un sur-estimé.
- **`previewImage`** non fourni (aucun asset dédié) ; description du sélecteur de widgets en
  français uniquement (limitation du config plugin, `translatable: 'false'`) — les textes du
  widget lui-même restent, eux, entièrement FR/EN.

#### Technique / Notes

- **Spike de compatibilité confirmé sur device** (Pixel 6a) avant d'investir dans le contenu réel :
  Expo SDK 57 / RN 0.86 / New Architecture (TurboModule `AndroidWidget`) — build + widget statique
  affiché et posé sur l'écran d'accueil.
- ⚠️ **Dépendance native neuve : second build requis** avant recette, comme
  `react-native-view-shot`/`expo-haptics`/`expo-speech` avant elle.
- Qualité au moment du commit : `typecheck` ✅ · `lint` ✅ (0 erreur, warnings préexistants
  inchangés) · `test` ✅ **69 shared + 68 suites mobile (646 tests) + 6 admin, 0 échec**.
- `npm install` déjà fait plus tôt dans la session (dépendance déjà matérialisée) ; build Gradle
  final vérifié — bundle réellement régénéré (piège monorepo déjà documenté : contrôlé en
  extrayant `assets/index.android.bundle` de l'APK et en y cherchant le texte résolu du widget).

### 03/08/2026 — `chore/socle-tests-unitaires` — Lot 5 débloqué : **le blocage annoncé n'en était pas un**

Suite de `f328e3d`, qui déclarait le lot 5 bloqué par « les effets React ne s'exécutent pas ».
**Ce diagnostic était faux, et il est corrigé ici.**

#### Correction du diagnostic

Les effets **s'exécutent** : RNTL 14 enveloppe le montage dans un `act` **asynchrone**. Au retour
de `render()` / `renderHook()`, le composant est monté mais les effets ne sont que **planifiés** —
ils partent au tour de boucle suivant. Il suffit d'en laisser passer un.

Établi par une mesure et non par déduction : après `render()`, l'espion d'un `useEffect` est à 0 ;
après un `await act(async () => {})`, il est à 1.

**L'idiome, et le seul qui fonctionne** — rendre **à l'intérieur** de l'`act` :

```ts
await act(async () => { view = renderHook(() => useMonHook()); });
```

Rendre puis envelopper séparément déclenche « overlapping act() calls » : `renderHook` ouvre déjà
son propre scope sans l'attendre. `waitFor` ne suffit pas (essayé, l'assertion échoue), et
`unmount()` doit lui aussi être enveloppé pour que l'effet de nettoyage parte.

#### Ajouté

- **`useAuthDeepLink.test.tsx` — 10 tests**, premier test à effet du dépôt. Ce hook décide de ce
  qui se passe quand l'app s'ouvre sur un lien d'e-mail. Trois choses y sont verrouillées :
  - **l'ordre `recoveryPending` AVANT `setSession`**, documenté dans le code comme « exactement le
    bug qu'on veut éviter » — inversé, un rendu intermédiaire voit la session sans le drapeau et
    redirige vers l'app au lieu de l'écran « nouveau mot de passe ». Le test enregistre l'ordre
    **réel** des deux appels, pas seulement l'état final : une race de rendu ne se reproduit pas à
    la demande sur un téléphone, l'ordre des appels si ;
  - **un lien refusé n'ouvre AUCUNE session** — la frontière entre « lien expiré, redemande-en un »
    et « te voilà connecté par un lien mort » ;
  - **les deux chemins d'entrée** (app lancée par le lien / app déjà ouverte) et le retrait de
    l'abonnement au démontage, sans quoi chaque remontage empilerait un gestionnaire.

#### Modifié

- `docs/specs/technical/strategie-tests.md` — **§3.6 réécrite** : le titre passe de « 🔴 Blocage »
  à « Tester un effet », avec l'idiome, le bruit résiduel connu (3 avertissements « overlapping
  act » émis par les internes de RNTL, sans effet sur les assertions) et la **fausse piste écartée**
  (`IS_REACT_ACT_ENVIRONMENT`, que RNTL pose déjà elle-même — ne pas le rajouter). Lot 5 marqué en
  cours, §8 réordonnée.
- `BACKLOG.md` — l'entrée 🔴 de blocage est **retirée** ; ce qui reste au lot 5 est reformulé.

#### Technique / Notes

- ⚠️ **Le constat qui survit à la correction** : les `*-smoke.test.tsx` d'écran existants n'attendent
  aucun tour de boucle. Leurs effets n'ont donc **jamais tourné** — ils n'assertent que du rendu
  statique. Un smoke test vert ne dit rien du comportement de l'écran, et les reprendre est le
  chantier où se cache le plus gros écart entre couverture affichée et couverture réelle.
- Quality gate au vert : typecheck, lint et `npm run test:coverage` (seuils inclus) propres sur les
  3 workspaces. **1 429 (shared) + 629 (mobile) + 157 (admin) = 2 215 tests.**

### 03/08/2026 — `chore/socle-tests-unitaires` — Lot 5 **bloqué** (effets React) + lectures admin

Suite de `7db4a45`. Le lot 5 (écrans) devait suivre. Il ne suivra pas encore : **les effets React
ne s'exécutent pas dans les tests**. Ce qui était prévu pour ce lot a donc été remplacé par le
reliquat du lot 4, réellement testable.

#### 🔴 Blocage documenté — les effets React ne tournent pas

Constaté en écrivant le premier test de hook à effet. `render()` et `renderHook()` montent bien le
composant, mais **aucun `useEffect` ne s'exécute** : un composant dont le seul rôle est d'appeler
un espion dans un `useEffect(() => …, [])` laisse l'espion à zéro appel. React signale bien
« The current testing environment is not configured to support act(…) » — et le test **passe**.

C'est le même mode d'échec que celui du §3.5 (imports dynamiques), en pire : un test vérifiant
« l'écran s'abonne au retour au premier plan », « le hook émet l'événement au montage » ou « le
formulaire se pré-remplit » passerait au vert **en n'ayant rien exécuté**. Écrire le lot 5 dans
cet état aurait produit des tests qui ne protègent rien tout en occupant la place de vrais tests.

- **Tenté et insuffisant** : `globalThis.IS_REACT_ACT_ENVIRONMENT = true` dans `jest.setup.ts`
  (l'exigence documentée de React 19). L'avertissement persiste, les effets ne tournent toujours
  pas. Le changement a été **retiré** plutôt que laissé en place avec un commentaire faux.
- **Piste** : compatibilité `@testing-library/react-native@14` × `react@19.2` ×
  `react-test-renderer@19.2` sous `jest-expo@57`.
- **À savoir pour lire l'existant** : les `*-smoke.test.tsx` d'écran n'assertent que du **rendu
  statique**. Ce n'est pas un oubli de leurs auteurs, c'est tout ce que l'outillage permet — ne pas
  conclure d'un smoke test vert que le comportement de l'écran est couvert.

Documenté en **§3.6** de `strategie-tests.md`, avec le lot 5 marqué 🔴 et le déblocage inscrit
comme **préalable** en tête de la §8 (reprise).

#### Ajouté

- **`src/data/listings.test.ts` — 29 tests** (reliquat du lot 4). Les lectures de liste sont moins
  risquées que les écritures — une liste fausse se voit — mais deux choses ne se voient pas sur un
  back-office de recette :
  - **la portée `active` / `archived` / `all`**, construite par une chaîne conditionnelle. Se
    tromper de branche affiche les contenus **archivés** dans la liste active, donc republie
    visuellement ce qu'un admin avait retiré. Sur un jeu de données sans archive, les trois
    portées rendent exactement la même chose : le défaut est invisible. Testé sur les trois listes
    (programmes, exercices, aliments) × quatre portées, plus le défaut (`active`), le
    cloisonnement éditorial (`owner_id IS NULL`) et le tri ;
  - **`deleted_at` sur les traductions, indépendamment du programme** : une traduction archivée
    seule doit faire tomber le libellé à `null` (« sans nom ») et non ressortir. Le commentaire du
    code l'affirmait, rien ne le vérifiait.

#### Modifié

- `apps/admin/vitest.config.ts` — seuils relevés **54 → 60** (instructions), 84 → 86 (branches),
  55 → 64 (fonctions), après le gain de couverture. Un cliquet laissé sous le réel ne sert à rien :
  on le remonte à chaque palier gagné.
- `docs/specs/technical/strategie-tests.md` — §3.6 (le blocage), lot 5 marqué bloqué, §8 réordonnée
  (débloquer les effets devient le point 1), chiffres actualisés.

#### Technique / Notes

- Quality gate au vert : typecheck, lint et `npm run test:coverage` (seuils inclus) propres sur les
  3 workspaces. **1 429 (shared) + 619 (mobile) + 157 (admin) = 2 205 tests.** `apps/admin` :
  56 % → **61,3 %** d'instructions.

### 03/08/2026 — `chore/socle-tests-unitaires` — Lot 6 : les seuils de couverture deviennent réels

Suite de `bc04b58`. Le chantier ne s'arrête plus à « on a ajouté des tests » : la CI **applique**
désormais des seuils. Et en les posant, une découverte qui vaut à elle seule le lot.

#### Corrigé

- 🔴 **Les seuils de couverture de `packages/shared` n'étaient appliqués nulle part.** Le paquet
  déclarait `thresholds: 100` sur les quatre métriques depuis des mois — mais l'étape « Tests » de
  la CI lançait `npm run test`, **sans `--coverage`**. Un seuil sans mesure est du texte mort : il
  n'a jamais échoué, et personne ne pouvait voir que **le réel était à 99,17 % / 95,13 %**, donc
  que la règle des 100 % de [bonnes-pratiques §4](docs/specs/technical/bonnes-pratiques.md)
  n'était pas tenue. L'étape CI passe à `npm run test:coverage`.
- **`src/database.types.ts` sorti de la mesure de `shared`** : 2 589 lignes **générées** par
  `npm run db:types`, à 0 % de couverture par construction (types purs + un objet `Constants`
  vide). Les compter n'apprenait rien et faussait le total du paquet.

#### Ajouté

- **Seuils par périmètre**, calés **sous le réel du jour** :

  | Périmètre | Instructions | Branches | Fonctions |
  |---|---:|---:|---:|
  | `packages/shared` | 99 | 95 | 99 |
  | `apps/mobile/src/data/repositories/` | 28 | 20 | 23 |
  | `apps/mobile/src/lib/` | 50 | 48 | 64 |
  | `apps/mobile/src/stores/` | 45 | 34 | 44 |
  | `apps/mobile` — reste (écrans, composants) | 12 | 8 | 10 |
  | `apps/admin` (`src/data` + `src/lib`) | 54 | 84 | 55 |

  **Par chemin, jamais un seuil global unique** : la moyenne d'un dossier d'écrans à 6 % et d'une
  couche data à 31 % ne veut rien dire, et un seuil global se satisfait de n'importe quel équilibre
  entre les deux — on pourrait laisser pourrir le SQL en couvrant des composants. Le seuil du
  « reste » est volontairement bas : le monter bloquerait l'ajout de tout nouvel écran, et **un
  garde-fou qu'on désactive ne protège rien**.
- Mécanisme **vérifié**, pas supposé : un seuil volontairement inatteignable a été passé en ligne
  de commande pour confirmer que Jest échoue bien et rapporte la vraie valeur
  (`"./src/data/repositories/" coverage threshold for statements (99%) not met: 30.73%`). Un
  seuil sur un chemin qui ne matche rien serait ignoré **en silence** — pire qu'aucun seuil.

#### Modifié

- `docs/specs/technical/strategie-tests.md` — nouvelle section **§5 bis** (le tableau des seuils,
  les trois principes, et l'avertissement sur l'écart de `shared`), lot 6 marqué fait, §7 et §8
  actualisées.
- `BACKLOG.md` — **nouvelle entrée** : `packages/shared` n'atteint pas les 100 % exigés (99,35 % /
  95,12 %). Deux issues à trancher — couvrir les branches manquantes (`geo.ts` 85,7 %,
  `pace-records.ts` 94,1 %, `menstrual-cycle.ts`, `widgets.ts`, `workout.ts` : surtout des gardes
  défensives) ou ré-arbitrer la règle si elle n'est pas tenable. **Ne pas rebaisser le seuil** :
  c'est le seul garde-fou du paquet.

#### Technique / Notes

- Les seuils sont des **cliquets**, pas des objectifs. Une PR qui les fait rougir a **retiré** de
  la couverture ; la réponse est d'en ajouter. C'est écrit dans les trois fichiers de config et
  dans le workflow, à l'endroit où quelqu'un sera tenté de baisser le chiffre.
- `src/test-utils/**` exclu de la collecte mobile : l'outillage de test ne se mesure pas lui-même.
- Quality gate au vert, codes de sortie lus **sans pipe** : typecheck, lint, `npm run test` **et
  `npm run test:coverage`** (nouveau) propres sur les 3 workspaces. **2 176 tests.**

### 03/08/2026 — `fix/dashboard-widgets-tier2-vides` — Dette technique : trou dans la grille du dashboard

Suite de `12a17d2`. Correctif d'une ligne du backlog (§Dette & suivi technique), trouvé en préparant
ACTIV-01.

#### Corrigé

- 🟢 **`training-load`/`overtraining-guard` laissaient un trou dans la grille du dashboard quand ils
  rendent `null`.** Ces deux widgets Tier 2 (ADR-007, garde-fous META-19/TRI-12) rendent `null` en
  interne hors de leur zone de risque, mais `isWidgetActive` (`apps/mobile/src/app/(tabs)/index.tsx`)
  ne connaissait que `deficit-volume` et `activation-path` — `WidgetGrid` réservait donc leur cellule
  même vide. Ajout des deux mêmes conditions, en réutilisant `useTrainingLoadAlert().show` /
  `useOvertrainingGuardAlert().show`, déjà calculés par les cartes elles-mêmes pour décider de leur
  propre rendu — aucun nouveau calcul.

#### Technique / Notes

- ⚠️ **Trouvé en lançant les tests** : les 65 suites mobile échouaient toutes à l'import du harness
  (`Cannot find module 'babel-plugin-dynamic-import-node'`). Le plugin avait été ajouté à
  `apps/mobile/babel.config.js` par ACTIV-01 (transpile les `import()` dynamiques en `require` sous
  Jest, CommonJS) et déclaré dans `package.json`/`package-lock.json`, mais **jamais matérialisé** dans
  `node_modules` (pas de `npm install` relancé après ce commit). Résolu par un `npm install` à la
  racine — le lockfile était déjà correct, donc **aucun fichier suivi modifié** par cette réinstallation.
- Qualité au moment du commit : `typecheck` ✅ · `lint` ✅ (0 erreur, 45 warnings préexistants) ·
  `test` ✅ **69 shared + 65 suites mobile (619 tests) + 5 admin (128 tests), 0 échec**.

### 03/08/2026 — `fix/objectif-pas-et-partage-course` — Deux bugs remontés par Florian en usage réel

Suite de `bc04b58`. Deux corrections indépendantes, trouvées en testant l'app sur device.

#### Corrigé

- 🔴 **Objectif de pas quotidien jamais enregistré (US PAS-01, 9.15).** `daily_step_goal` existait
  côté Supabase (migration `20260728132424_pas01_daily_steps.sql`) et dans tout le code applicatif
  (`profile-repository.ts`, `daily-steps-repository.ts`) depuis la clôture de PAS-01, mais n'avait
  jamais été déclarée dans le **schéma client** PowerSync (`schema.ts`) — même anti-pattern que celui
  déjà documenté pour `cycle_tracking_enabled`. Conséquence : toute lecture/écriture SQL locale de
  cette colonne échouait silencieusement (`void upsertProfile(...)` sans erreur visible) ; l'UI
  affichait le changement (state local `draftGoal`) mais rien n'était persisté, et l'objectif
  retombait à 8 000 (défaut) à tout remontage de l'écran. Colonne ajoutée au schéma. Aucune action
  sur le dashboard PowerSync : les sync rules font déjà `select * from profiles`.
- 🟡 **Carte noire à l'export du partage de course (US PARTAGE-01, 7.17 — reste en recette).**
  L'aperçu affiché dans l'app rend le tracé SVG correctement (vérifié sur capture d'écran), mais
  l'image produite par `captureRef` (react-native-view-shot) après un appui sur « Partager » sortait
  avec la zone du tracé noire. Hypothèse retenue après lecture du code natif Android de la
  librairie : `ShareCardSheet.share()` appelle `setBusy(true)` (donc un re-rendu React) immédiatement
  avant `captureRef`, sans laisser ce re-rendu se stabiliser côté natif — contrairement au composant
  `<ViewShot>` de la librairie, qui attend lui-même le premier `onLayout` avant de capturer, mais que
  ce code n'utilise pas (appel direct à `captureRef`). Un délai de deux frames (`requestAnimationFrame`
  ×2) a été ajouté avant la capture. ⚠️ **Non vérifié sur device** (pas d'appareil disponible dans cet
  environnement) : c'est l'hypothèse la mieux étayée par le code, à confirmer par Florian. Si le bug
  persiste après ce correctif, il faudra instrumenter la capture (logs natifs) pour aller plus loin.

#### Technique / Notes

- Qualité au moment du commit : `typecheck` ✅ · `lint` ✅ (0 erreur, 40 warnings préexistants) ·
  `test` ✅ **1416 shared + 517 mobile, 0 échec**.
- Revue de code (agent `superpowers:code-reviewer`) : aucun problème bloquant. Point mineur relevé :
  le null-check de `cardRef.current` n'est pas refait après l'attente de 2 frames — si l'utilisateur
  ferme la feuille en tapant le fond pendant cette fenêtre, `captureRef` échoue proprement
  (`{ error: 'failed' }`, déjà géré par le `catch` existant) plutôt que de planter. Pas de correctif
  nécessaire.

### 03/08/2026 — `chore/socle-tests-unitaires` — Lot 3 terminé + **trou trouvé dans l'export RGPD**

Suite de `34e3012`. **25 tests ajoutés**, le lot 3 est clos (102 tests). Mais l'essentiel de cette
passe n'est pas le compte : c'est **un manquement RGPD trouvé et corrigé**.

#### Corrigé

- 🔴 **`session_intervals` était absente de l'export de données personnelles (US CONF-01).**
  Trouvé en écrivant un test qui compare `EXPORT_TABLES` au schéma PowerSync réel. La table a été
  créée par RUN-F2c (blocs fractionné, miroir structurel d'`exercise_plans` — qui, lui, **est**
  exporté) et n'a jamais rejoint la liste. Conséquence : un utilisateur exportant ses données
  récupérait ses programmes de course **avec leurs séances mais sans leur contenu** — les blocs
  d'intervalles disparaissaient.
  Ce défaut ne produit **aucune erreur** : l'export réussit, le fichier se télécharge, il est
  simplement incomplet. Ce n'est pas une finition oubliée, c'est un manquement au droit à la
  portabilité, et rien dans l'app ne pouvait le signaler. Table ajoutée à `EXPORT_TABLES` +
  test de non-régression nommé.

#### Ajouté

- **`EXPORT_EXCLUSIONS`** dans `data-export.ts` — registre des tables **volontairement** absentes
  de l'export, avec leur raison. Sa seule fonction est de rendre l'omission délibérée : le test de
  complétude échoue dès qu'une table du schéma n'est ni exportée, ni listée ici. Le silence n'est
  plus une option.
  ⚠️ **Une décision reste à prendre** : `analytics_events` y figure comme exclusion **héritée,
  jamais arbitrée**. La table porte un `user_id` et vit sur nos serveurs, donc son inclusion dans
  le droit à la portabilité est défendable. Signalé, pas tranché — arbitrage produit/juridique.
- **`data-export.test.ts` — 15 tests.** Complétude (ci-dessus), plus : aucune table exportée qui
  n'existe pas au schéma (une table renommée en migration ferait échouer l'export entier), aucune
  exclusion périmée, aucun doublon, chaque exclusion documentée. Puis les trois issues
  d'orchestration (`ok` / `unavailable` / `failed`) et le fait qu'un partage indisponible **ne
  journalise pas** un export réussi.
- **`gpx-export.test.ts` — 10 tests.** Les quatre issues produisent quatre messages différents à
  l'écran : confondre « trace vide » avec « échec » enverrait l'utilisateur chercher une panne
  inexistante. Couvre notamment la garde sur une **date de départ corrompue** — sans elle,
  `toISOString()` sur un `NaN` lève et l'export part dans le `catch` générique, où aucun retry ne
  peut aboutir. Plus le nommage daté du fichier (celui que verra Strava) : stable pour une même
  course (un ré-export écrase au lieu d'empiler), distinct entre deux courses.
- `EXPORT_TABLES` passe `export` — même motif qu'aux lots précédents : consommée nulle part
  ailleurs, exportée pour être vérifiable.

#### Modifié

- `docs/specs/technical/strategie-tests.md` — lot 3 marqué terminé, §8 réordonnée (le lot 6, seuils
  CI, devient la prochaine étape maintenant que tout ce qui devait être couvert l'est), chiffres
  actualisés. `BACKLOG.md` — entrée du chantier mise à jour.

#### Technique / Notes

- La trace GPS de test est construite avec **les vraies fonctions d'encodage** (`encodeSegment` +
  `appendToTrack`) et non écrite à la main : le format est versionné et compressé, une trace
  fabriquée à côté de l'encodeur cesserait d'être représentative au premier changement — le test
  continuerait de passer en testant autre chose. Première tentative faite en JSON : rejetée par
  `decodeTrack`, donc échec franc et immédiat.
- Quality gate au vert, codes de sortie lus **sans pipe** : lint 0 erreur, typecheck propre sur les
  3 workspaces, **1 429 (shared) + 619 (mobile) + 128 (admin) = 2 176 tests**. Couverture mobile
  23,1 % → **23,3 %** ; `src/lib` 48 % → **54 %**.

### 03/08/2026 — `chore/socle-tests-unitaires` — Lot 3 : notifications, Health Connect, store d'auth

Suite de `523eafa`. **77 tests ajoutés** sur `src/lib` et `src/stores` du mobile, tous deux passés
de ~20 % à **48 %**. Outillage — aucune ligne de roadmap, aucun front-matter d'US avancé.

#### Corrigé

- **Les tests d'un module à import dynamique passaient au vert en testant le chemin d'erreur.**
  `health-connect.ts` charge son module natif par `await import('react-native-health-connect')` —
  c'est ce qui permet à l'app de démarrer sans Health Connect installé. Jest ne sait pas exécuter
  un `import()` non transpilé (« A dynamic import callback was invoked without
  `--experimental-vm-modules` ») ; comme le module entoure ses appels de `try/catch`, il ne
  plantait pas : il **partait dans son repli**. Un test écrit sans le savoir vérifiait donc le cas
  dégradé en croyant couvrir le cas nominal — un faux positif qui ressemble à de la couverture.
  Corrigé dans [`babel.config.js`](apps/mobile/babel.config.js) : plugin `dynamic-import-node`
  activé **uniquement si `NODE_ENV=test`** (nouvelle devDep `babel-plugin-dynamic-import-node`).
  `api.cache(true)` remplacé par `api.cache.using(() => process.env.NODE_ENV)`, sans quoi la config
  serait figée pour tous les environnements. **Le bundle Metro n'est pas concerné** : le chargement
  paresseux reste intact en production. Suite complète relancée après le changement, aucune
  régression (594 tests mobile).

#### Ajouté

- **`notifications.test.ts` — 21 tests.** Ce module ne décide de rien (les règles vivent dans
  `@wellness/shared`), mais il porte deux contrats invisibles à l'exécution. **Ne jamais lever** :
  permission refusée, plateforme non prise en charge, module absent — tout doit finir en no-op,
  sinon l'app crashe pour une notification, sur un APK où personne ne saura pourquoi. Et surtout
  **le booléen de `presentNow`** (décision D14) : il n'existe que pour décider de consommer ou non
  une unité du quota quotidien. S'il renvoyait `true` sur un échec, une notification jamais
  affichée mangerait le plafond du jour et l'utilisateur perdrait des rappels sans trace. Couvre
  aussi les identifiants stables (au plus un rappel en attente par type), le déclencheur
  **récurrent** du bilan hebdomadaire, et l'identifiant **distinct par séance** du push de record
  (décision D10 — deux records le même jour ne doivent pas s'écraser).
- **`health-connect-state.test.ts` — 31 tests.** La machine d'état des Réglages : six états, et
  c'est elle qui décide entre « installe Health Connect », « active la synchro » et « accorde les
  permissions ». Se tromper d'état, c'est envoyer quelqu'un régler un problème qu'il n'a pas. Fixe
  deux subtilités qui se sont déjà retournées contre nous : **`hasPermissions()` est un ET
  logique** (ajouter `Steps` en PAS-01 a fait repasser tous les comptes existants en
  `permissions_missing` — voulu, mais qui doit rester délibéré), et **les permissions du cycle sont
  à part** (les mêler ferait basculer des comptes qui n'ont jamais activé le suivi, R20). Couvre
  aussi les throttles d'import — dont le fait que la fenêtre des pas (1 h) est plus courte que
  celle du poids (6 h), et qu'un curseur absent vaut « jamais importé » et non « à l'instant »,
  sans quoi un appareil neuf n'importerait jamais rien. Aucun de ces cas n'est reproductible en
  recette sans désinstaller Health Connect ou révoquer des permissions une par une.
- **`auth-store.test.ts` — 25 tests.** Trois décisions dont **l'inverse ne se voit pas** sur
  l'appareil qui agit : la **portée de la déconnexion** (`scope: 'local'` pour un logout ordinaire —
  le défaut de `@supabase/auth-js` est `global`, donc sans l'argument explicite se déconnecter du
  téléphone déconnecterait la tablette ; scope global **voulu** après une réinitialisation de mot de
  passe, un test par cas) ; le **contrat d'erreur de Google**, qui renvoie une clé i18n là où
  `signIn`/`signUp` renvoient le message brut de Supabase — l'écran fait `t(res.error)`, l'inverser
  afficherait une clé technique ; et **l'ordre de la suppression de compte** (RPC → purge SQLite →
  `signOut`), avec le fait qu'un échec de la RPC ne purge **rien**.

#### Modifié

- `docs/specs/technical/strategie-tests.md` — nouvelle section **3.5** sur le piège des imports
  dynamiques (avec le rappel de vider le cache Jest après un changement Babel), lot 3 marqué en
  cours, §8 (reprise) actualisée, chiffres mis à jour.
- `BACKLOG.md` — entrée du chantier actualisée.

#### Technique / Notes

- Un échec transitoire de 16 tests a été observé pendant la passe : **cache de transformation
  périmé** après le changement de plugin Babel, pas un défaut du code. `npx jest --clearCache` puis
  relance → 594 tests verts. Le piège est documenté en §3.5.
- Quality gate au vert, codes de sortie lus **sans pipe** : lint 0 erreur, typecheck propre sur les
  3 workspaces, **1 416 (shared) + 594 (mobile) + 128 (admin) = 2 138 tests**. Couverture mobile
  21,4 % → **23,1 %** ; `src/lib` 28 % → **48 %** ; `src/stores` 16 % → **48 %**.

### 03/08/2026 — `chore/socle-tests-unitaires` — Lot 4 terminé : programmes, utilisateurs, rôles, audit

Suite de `5ce41bb`, après intégration de RUN-F2d (`5aef9a5`) dans la branche — la suite est restée
verte, y compris les tests posés sur `run-repository` et `program-repository` que cette US touchait.
**73 tests ajoutés**, le lot 4 est clos : **128 tests sur `apps/admin`, 56 % d'instructions et
86,9 % de branches**, contre **aucun runner** il y a quelques heures. Outillage — aucune ligne de
roadmap, aucun front-matter d'US avancé.

#### Ajouté

- **`src/data/programs.test.ts` — 37 tests** (1 140 l., le plus gros fichier de l'admin). Ce qui se
  joue ici n'existe nulle part ailleurs dans le projet : **l'archivage et la restauration sont des
  cascades séquentielles sur 5 tables, sans transaction** — supabase-js n'en propose pas côté
  client, chaque étape est un aller-retour réseau qui peut échouer seul. Trois propriétés
  compensent, et sont désormais tenues par des tests :
  - **l'ordre** — l'archivage descend (plans → blocs → séances → traductions → entête), la
    restauration remonte exactement en miroir. Ce n'est pas du style : un arrêt en cours ne doit
    jamais laisser un enfant vivant sous un parent mort, ni l'inverse. Les tests comparent la
    **séquence réelle des tables écrites** ;
  - **l'idempotence** — `.is('deleted_at', null)` à l'archivage, `.not('deleted_at','is',null)` à
    la restauration, sur chacun des 5 niveaux, pour que l'UI puisse retenter après une erreur ;
  - **l'arrêt net sans journalisation** — un `program.archive` dans l'audit alors que la moitié
    des lignes sont vivantes est pire que pas d'entrée.
  Couvre aussi : `status` jamais touché par une restauration, relecture des séances **sans** filtre
  `deleted_at` (volontaire), création en `draft` avec `id` renvoyé malgré un échec de traduction,
  `upsert` sur `(program_id, lang)`, positionnement `max+1` des séances et plans, et
  `reorderSessions` **borné au programme** — sans ce filtre, une liste d'ids mal formée réécrirait
  l'ordre des séances d'un autre programme.
- **`src/data/admin-users.test.ts` — 36 tests** (`users` + `roles` + `audit`). Les opérations les
  plus sensibles du back-office. La sécurité est côté serveur (RPC `SECURITY DEFINER`, RLS) et
  n'est pas testable ici ; ce qui l'est, c'est **ce que le client fait autour** : passer par la RPC
  et **jamais** par une écriture directe (qui contournerait les garde-fous anti-self / anti-admin),
  et **ne rien journaliser** quand l'opération a échoué. Couvre aussi les **trois** cas de
  `grantRole` là où un `upsert` naïf n'en verrait que deux (déjà actif → ne rien écrire ; révoqué →
  **réactiver** ; sinon insérer) — l'unicité reposant sur un **index partiel** que supabase-js ne
  peut pas désigner comme arbitre de conflit, cette logique vit côté client et doit être juste.
  Plus `parseActivePillars` (tolère le tableau natif **et** la chaîne JSON produite par le mobile),
  la pagination et la recherche de `listUsers`, les filtres de `listAudit`, et le contrat
  best-effort de `logAudit` : ne lève **jamais**, même session corrompue ou insertion refusée.

#### Corrigé

- **`supabase-mock.ts` — `hasFilter` comparait par identité (`Object.is`).** Un filtre à argument
  objet (`order('created_at', { ascending: false })`, `in(col, [a, b])`) ne pouvait donc **jamais**
  correspondre : l'assertion échouait en donnant l'impression que le filtre était absent du code.
  Remplacé par une comparaison **structurelle**. Le défaut a été trouvé par deux tests rouges ; le
  helper est corrigé plutôt que les tests, parce que le piège aurait resservi à chaque nouveau
  fichier.

#### Modifié

- `docs/specs/technical/strategie-tests.md` — lot 4 marqué terminé, chiffres actualisés, §8
  (reprise) réordonnée : le lot 3 (stores + lib mobile) devient la prochaine étape, et le reliquat
  de l'admin (lectures de liste, moins risquées que les écritures) passe en dernier.
- `BACKLOG.md` — entrée du chantier mise à jour.

#### Technique / Notes

- Quality gate au vert, codes de sortie lus **sans pipe** : lint 0 erreur, typecheck propre sur les
  3 workspaces, **1 416 (shared) + 517 (mobile) + 128 (admin) = 2 061 tests**.

### 03/08/2026 — `feature/activ01-parcours-7-jours` — ACTIV-01 : parcours 7 jours pour démarrer (roadmap 1.27 → ✅)

Implémentation complète. Idée promue depuis IDEAS.md (13/07/2026, différée après V0.9) — cadrée
maintenant qu'aucune US n'est en cours. Spec/plan/maquette validés dans l'entrée précédente.

#### Ajouté

- **Nouvelle famille de fonctions pures** (`packages/shared/src/activation-path.ts`, testée
  d'abord, 13 tests) : `activationPathDayIndex` (jour calendaire 1-7 depuis
  `onboardingCompletedAt`, `null` hors fenêtre), `rankedActivePillars` (piliers actifs triés
  muscu＞running＞nutrition), `activationDayTheme` (thème du jour — pilier ciblé ou repli
  universel, calcul **structurel**, jamais dépendant de ce qui a été fait).
- **Repository mobile** (`activation-path-repository.ts`, nouveau) : `useActivationPath` (jour,
  thème, coche de complétion informative) + `useDayCompletion` (existence ciblée sur
  `workouts`/`runs`/`food_entries`/`daily_wellbeing`/`personal_goals`, aucune nouvelle table de
  suivi). `profile-repository.ts` : `activationPathDismissedAt` + `dismissActivationPath()`.
- **Widget d'accueil** `ActivationPathCard.tsx` (3 formes, comme `TrainingLoadAlertCard`) :
  progression « Jour N sur 7 », titre/description/action du jour, coche si déjà fait, bouton
  « Passer ». Enregistré `'always'` dans `HOME_WIDGET_IDS` (fin de registre, zéro migration de
  `dashboard_layout`) et dans `WIDGET_COMPONENTS`.
- i18n `home.activationPath.*` (FR+EN, parité vérifiée) — **contenu brouillon** (7 thèmes), à
  valider par Florian/Damien avant de le considérer figé (comme CONTENU-01).

#### Modifié

- `(tabs)/index.tsx` : `isWidgetActive` étend le prédicat déjà utilisé pour `deficit-volume`,
  cette fois pour `activation-path` — **condition nécessaire** pour que le widget disparaisse
  sans laisser de trou dans la grille après le jour 7 ou un dismiss (voir Technique/Notes).
- Migration `20260803101009_activ01_dismiss` : `profiles.activation_path_dismissed_at
  timestamptz null`, additive. **Aucune sync rule à redéployer** (`profiles` déjà publiée en
  `select *`).
- Roadmap 1.27 : ⬜ → ✅.

#### Technique / Notes

- Relecture (agent) sur la spec initiale : 2 corrections avant tout code — (1) le patron « widget
  auto-masquant » cité comme déjà éprouvé (`training-load`/`overtraining-guard`) ne l'était qu'à
  moitié : ces deux widgets rendent bien `null` mais ne sont **pas** déclarés dans
  `isWidgetActive`, donc laissent déjà un trou dans la grille aujourd'hui — bug préexistant non
  corrigé ici (widget différent), consigné en dette technique dans BACKLOG.md ; (2) « pilier non
  encore couvert » (jours 3/5) était ambigu entre lecture comportementale et structurelle,
  clarifié en calcul purement structurel (spec §2 ter), avec un exemple concret désormais dans
  la spec et testé (`running-nutrition actifs, muscu désactivé`).
- `widgets.test.ts` (packages/shared) : 5 assertions de comptage codées en dur (16/15 widgets
  home) mises à jour pour le 17ᵉ widget — comportement attendu d'un ajout au registre, pas une
  régression.
- Quality gate vert : typecheck/lint propres, 55 tests admin + 517 tests mobile + 1429 tests
  shared (dont les 13 nouveaux d'`activation-path.test.ts`), tous verts.
- **Aucune notification, aucune nouvelle table de suivi** — périmètre délibérément borné (spec §4).

### 03/08/2026 — `feature/runf2d-guidage-fractionne-vocal` — RUN-F2d : guidage fractionné vocal (roadmap 5.18 → ✅)

Implémentation complète, 4ᵉ et dernier candidat de la famille RUN-F2 (dépendait de RUN-F2a et
RUN-F2c, toutes deux livrées). Spec/plan/maquette validés dans l'entrée précédente.

#### Ajouté

- **3 fonctions pures neuves** (`packages/shared/src/running-intervals.ts`, testées d'abord,
  11 tests) : `expandIntervalPhases` (linéarise les blocs `session_intervals` en phases
  rapide/récup successives — un `reps=6` produit 12 phases, pas 2), `isIntervalPhaseComplete`,
  `resyncIntervalPhase` (rattrapage : avance l'index de phase autant de fois que nécessaire en une
  seule évaluation, pour le cas où l'écran de suivi est resté démonté pendant plusieurs
  transitions). **Bug trouvé et corrigé par les tests écrits d'abord** : la première version de
  `resyncIntervalPhase` recalait la baseline sur la valeur absolue courante à chaque franchissement
  au lieu d'avancer exactement de la cible de la phase franchie — un rattrapage multi-phases
  effaçait silencieusement la progression déjà faite dans la phase suivante (100 m perdus sur
  l'exemple testé). Corrigé avant tout code d'intégration.
- **Repository mobile** (`run-repository.ts`) : `ActiveRun` étendu (`intervalPhaseIndex`,
  `intervalPhaseStartDistanceM`, `intervalPhaseStartDurationS`), `advanceIntervalPhase` (persiste
  la progression), `useIntervalBlocksForRun` (résout `plannedSessionId → session_type + blocs`,
  requête absente jusqu'ici — `useRunTarget` ne portait pas ces champs). `program-repository.ts` :
  `IntervalDbRow`/`rowToIntervalItem` exportés pour réutilisation.
- **Hook de guidage** (`apps/mobile/src/running/interval-guidance.ts`, nouveau) :
  `useIntervalGuidance` détecte les transitions de phase et déclenche `Speech.speak` +
  `Vibration.vibrate()` (aucune dépendance native neuve). Rattrapage silencieux au premier calcul
  suivant un remontage d'écran (pas de rafale d'annonces obsolètes) ; le tout premier
  déclenchement (phase 0) est annoncé immédiatement au démarrage de la course.
- Wiring dans `run/active.tsx` (3ᵉ guidage sur cet écran, après RUN-F2a et RUN-F2b) et nouveau
  réglage indépendant dans `running-profile.tsx` (« Guidage fractionné », désactivé par défaut).
- i18n `running.guidance.*` (FR+EN, parité vérifiée) : distance en km entier si multiple de
  1000 m sinon en mètres (même règle qu'RUN-F2a R3 bis) ; durée en secondes sous 90 s, en minutes
  arrondies au-delà — jamais un nombre décimal lu.

#### Modifié

- Migration `20260803061055_runf2d_interval_guidance` : 3 colonnes additives sur `runs`
  (`interval_phase_index`, `interval_phase_start_distance_m`, `interval_phase_start_duration_s`),
  1 sur `running_profiles` (`interval_guidance_enabled`). **Aucune sync rule à redéployer** — les
  deux tables sont déjà publiées en `select *`, contrairement à RUN-F2c.
- Roadmap 5.18 : ⬜ → ✅.

#### Technique / Notes

- Relecture (agent) sur la spec initiale : 3 points corrigés avant tout code — (1) la règle
  « distances toujours en mètres » se contredisait avec l'exemple même de RUN-F2c (« 1 km
  d'échauffement » se serait annoncé « 1000 mètres »), corrigée pour reprendre exactement la règle
  d'RUN-F2a ; (2) aucun algorithme de rattrapage n'était prévu pour un remontage après plusieurs
  phases franchies d'un coup, ajouté (R8 bis) ; (3) la résolution `plannedSessionId → blocs` était
  présentée comme déjà disponible alors qu'elle n'existait pas, reclassée en travail neuf.
- Quality gate vert après chaque étape (comme RUN-F2c). Suite finale : 517 tests Jest (mobile) +
  1416 tests Vitest (shared, dont 11 nouveaux pour `running-intervals.ts`), tous verts ; aucun
  nouveau warning lint ; typecheck propre sur les 3 workspaces.
- **Aucun risque sur le tracker/la tâche de fond** : troisième US consécutive de la famille RUN-F2
  à ne jamais toucher `tracker-task.ts` (même décision qu'RUN-F2a, spec R5).

### 03/08/2026 — `chore/socle-tests-unitaires` — Point de reprise du chantier de tests

Documentation seule, aucun code. Le chantier des lots 0→4 était traçable dans le CHANGELOG et
dans `strategie-tests.md`, mais **rien ne disait par quoi reprendre** ni ne le rendait visible
depuis les fichiers de suivi. Corrigé avant de refermer la session.

#### Ajouté

- **`strategie-tests.md` §8 « Reprise — par où continuer »** : branche et dernier commit intégré
  (`cbab8a0`), le prérequis `nvm use 24` **en tête** (sur Node 20 la suite mobile échoue à
  l'import du harness sans dire pourquoi), puis l'ordre conseillé par rentabilité — finir
  `apps/admin` (`programs.ts` 1 140 l., `users`, `roles`, `audit`), lot 3 (`src/stores` +
  `src/lib` mobile, avec le volume non couvert par fichier), lot 6 (seuils CI, **après** 3 et 4
  sinon ils bloquent le travail en cours), lot 5 (écrans, le moins rentable et le seul qui demande
  une décision d'outillage).
- **§8 « Ce qui n'est volontairement pas fait »**, pour qu'aucune de ces trois absences ne soit
  relue plus tard comme un oubli : `weekly-review` n'a pas de test d'écriture (il n'en expose
  aucune, le bilan est dérivé — D1/D7) ; **aucune ligne de RECETTES.md n'a été cochée** (un test
  unitaire couvre la règle, pas le rendu ni le device : il réduit le risque derrière une recette,
  il ne la remplace pas) ; aucun front-matter d'US ni statut de roadmap n'a bougé, ce chantier
  étant de l'outillage.
- **Entrée dans `BACKLOG.md` § Dette & suivi technique** — le chantier n'apparaissait dans aucun
  fichier de suivi alors que 6 commits étaient déjà sur `dev`. Porte les chiffres (1 681 →
  1 977 tests, mobile 15,0 % → 21,4 %, `data/repositories` 9 % → 31 %, admin 0 → 55), le reste à
  faire par rentabilité décroissante, et l'avertissement Node 24.

#### Technique / Notes

- Quality gate au vert, codes de sortie lus **sans pipe** : typecheck et lint propres sur les
  3 workspaces, **1 405 (shared) + 517 (mobile) + 55 (admin) = 1 977 tests**.

### 03/08/2026 — `chore/socle-tests-unitaires` — Lot 4 : le back-office sort du zéro absolu

Suite de `4dfc32f`. `apps/admin` n'avait **aucun runner de test** — 9 716 lignes sans le moindre
filet, alors que c'est l'outil qui écrit dans le **contenu partagé par tous les utilisateurs** :
une erreur n'y casse pas un compte, elle en casse des milliers. **55 tests** posés. Outillage —
aucune ligne de roadmap, aucun front-matter d'US avancé.

#### Ajouté

- **Runner Vitest sur `apps/admin`** : `vitest` + `@vitest/coverage-v8` en devDeps,
  `vitest.config.ts`, scripts `test` / `test:watch` / `test:coverage`. La CI les exécute déjà —
  `npm run test` à la racine délègue à tous les workspaces. Environnement `node` (couche data +
  briques pures) ; `jsdom` + Testing Library restent à ajouter le jour où on couvrira les écrans,
  pas avant (un jsdom chargé pour rien ralentit chaque exécution). `vitest.config.ts` injecte les
  variables `VITE_SUPABASE_*` car `src/lib/supabase.ts` **lève au chargement** sans elles.
- **`src/test-utils/supabase-mock.ts`** — double de test du client Supabase. L'admin parle au
  réseau (supabase-js + RLS), pas à une base locale : il n'y a pas d'équivalent au harness SQLite.
  Ce qu'on peut tester sans réseau, c'est **la requête émise** et **ce qu'on fait de la réponse**.
  Le double enregistre, par requête : table, opération, **tous les filtres dans l'ordre**
  (`eq`/`is`/`in`/`not`…), lignes écrites et options (`onConflict`). Builder *thenable*, donc
  insensible à la longueur de la chaîne. Réponses programmables par `table.operation`, en valeur
  fixe ou en file. Aides d'assertion : `lastQuery`, `queriesOn`, `hasFilter`, `reset`.
- **`src/data/foods.test.ts` — 29 tests.** Cible l'import d'aliments, l'opération qui écrit le plus
  de lignes d'un coup. Vérifie le **décompte à trois branches** créé / mis à jour / **réactivé**
  (US ADMIN-01, D7) : `import_key` étant unique, l'upsert mettait auparavant à jour une ligne
  archivée sans remettre `deleted_at` à null — l'aliment restait invisible partout et le rapport
  annonçait un succès. Vérifie aussi `onConflict: 'import_key'` (ce qui rend l'import rejouable),
  `owner_id: null` + `source: 'library'` sur chaque ligne, la déduplication d'une clé répétée dans
  le CSV, l'absence de traduction orpheline si l'upsert ne renvoie pas d'id, les trois chemins
  d'échec (lecture, upsert aliments, upsert traductions) et le fait qu'**aucun faux succès n'est
  journalisé**. Plus `saveFood` (filtre éditorial sur l'update, `id` renvoyé malgré un échec de
  traduction pour permettre un ré-essai), `archiveFood`, `restoreFood` et `buildCsvTemplate`.
- **`src/data/exercises.test.ts` — 19 tests.** Trois invariants invisibles à l'écran :
  `owner_id IS NULL` sur chaque écriture (sans quoi une action d'admin déborde sur les exercices
  **créés par les utilisateurs**) ; **`status` jamais touché** par un archivage ou une restauration
  (les mélanger republierait un brouillon par accident, pour tout le monde) ; restauration bornée
  aux lignes archivées, donc rejouable. Couvre aussi `setStatus` (la dépublication n'est
  volontairement **pas** journalisée) et `fetchUsageSummary` — dont le contrat central : en cas
  d'erreur, renvoyer « indisponible » et **jamais un zéro**, un décompte faux étant plus dangereux
  que pas de décompte puisqu'il donne confiance.
- **`src/lib/archive-confirm.test.ts` — 7 tests**, `src/lib` à **100 %**. Vérifie que les trois
  messages (usages listés / aucun usage / décompte indisponible) restent **deux à deux distincts**
  — s'ils convergeaient, l'admin archiverait un contenu référencé partout en croyant qu'il ne sert
  à rien. Un rendu vert dans le navigateur ne dit pas lequel des trois s'est affiché.

#### Modifié

- `docs/specs/technical/strategie-tests.md` — nouvelle section **3.4** (double Supabase, usage,
  piège des UUID), constat mis à jour, lot 4 marqué en cours (3/7).

#### Technique / Notes

- **Piège découvert en écrivant les tests** : `auditEntrySchema` valide `targetId` en
  `z.string().uuid()` et `logAudit` est **best-effort**. Un identifiant de test fantaisiste
  (`'food-1'`) ne fait donc pas échouer l'appel — il fait **disparaître l'entrée d'audit**, et
  l'assertion passe au vert pour la mauvaise raison. Les fixtures utilisent désormais de vrais
  UUID, et le piège est documenté dans la spec et en commentaire.
- Le mock doit être posé **avant** l'import du module testé (`await import('./foods')` après
  `vi.mock`) : la couche data capture `supabase` à son chargement.
- Quality gate au vert, codes de sortie lus **sans pipe** : lint 0 erreur, typecheck propre sur les
  3 workspaces, **1 405 (shared) + 517 (mobile) + 55 (admin) = 1 977 tests**. Couverture admin :
  21,6 % d'instructions sur `src/data` + `src/lib`, dont **100 % sur `src/lib`**.

### 03/08/2026 — `chore/socle-tests-unitaires` — Lot 2 terminé : journal alimentaire et profil nutritionnel

Suite de `68ff2e9`. **34 tests ajoutés**, le lot 2 est clos (103 tests sur les lectures).
Outillage — aucune ligne de roadmap, aucun front-matter d'US avancé.

#### Ajouté

- **`journal-sql.test.ts` — 34 tests** (`journal-repository` + `nutrition-repository`). Le journal
  est le repository le plus **manipulé** de l'app : on y ajoute, corrige, déplace, réassigne et
  copie des entrées plusieurs fois par jour. Deux familles de défauts y sont coûteuses et
  invisibles hors inspection de la base :
  - **l'ordre** — `order_index` est porté par `(jour, repas)` et non global. Trois tests bornent
    explicitement `moveEntry` : il ne cherche un voisin **que dans le même repas** et **que dans le
    même jour**. Sans ces filtres, deux entrées de repas différents partageant `order_index = 0`
    s'échangeraient à travers les repas — une entrée sauterait du déjeuner au dîner. Un quatrième
    vérifie qu'un déplacement saute par-dessus une entrée supprimée.
  - **la copie** — `copyMeal` / `duplicateDay` doivent reproduire le **snapshot**, pas une
    référence. Un test vérifie que modifier la copie ne réécrit pas la source : sans ça, corriger
    un aliment réécrirait rétroactivement tous les repas déjà journalisés.
  - Couvre aussi : numérotation par repas, micronutriments sérialisés (y compris absents → `{}`),
    quick add sans quantité, patch partiel de `updateEntry` (nom et micros préservés s'ils ne sont
    pas fournis), `reassignEntryMeal` (récupération d'une entrée orpheline, no-op si déjà dans le
    repas), copie qui **s'ajoute** à un repas déjà rempli au lieu de l'écraser, et les 4 requêtes
    de lecture (`SELECT_DAY`, `SELECT_DAILY_TOTALS`, `SELECT_MEAL_TOTALS` — dont le groupement sur
    une clé de repas **personnalisée**, `SELECT_FIRST_LOG_DATE` et son `null` sur journal vide).
  - `upsertNutritionProfile` : création, mise à jour sans doublon, patch partiel, et absence de
    résurrection d'un profil supprimé.

#### Modifié

- `journal-repository.ts` — `export` sur 4 constantes SQL, avec l'en-tête explicatif habituel.
  **Aucun changement de comportement.**
- `docs/specs/technical/strategie-tests.md` — lots 0/1/2 marqués terminés, chiffres actualisés, et
  mention explicite que **le plus gros trou restant est `apps/admin`** (lot 4).

#### Technique / Notes

- Quality gate au vert, codes de sortie lus **sans pipe** : lint 0 erreur, typecheck propre,
  **1 405 (shared) + 517 (mobile) = 1 922 tests**. Couverture mobile 20,7 % → **21,4 %** ;
  `src/data/repositories` 29 % → **31 %**.

### 03/08/2026 — `chore/socle-tests-unitaires` — Lot 2 : tests SQL des lectures (bilan, dashboard, programmes)

Suite de `17139aa`. **69 tests ajoutés** sur les requêtes de **lecture**. Outillage — aucune ligne
de roadmap, aucun front-matter d'US avancé.

#### Décision — comment tester une lecture

Les lectures passent par des hooks `useQuery`, **non exécutables hors React**. Deux options
étaient sur la table : exporter les constantes SQL, ou brancher un faux `useQuery` sur le harness.
**Retenu : exporter les constantes** (arbitré par Damien le 03/08/2026, « touche au code »). C'est
le seul choix qui teste le SQL **réellement embarqué** plutôt qu'une copie qui divergerait.

Les 13 constantes concernées portent désormais un en-tête `Requêtes — exportées pour être
testables` disant explicitement que l'`export` n'existe que pour les tests et qu'aucun code
applicatif ne doit les importer.

#### Ajouté

- **`weekly-review-sql.test.ts` — 25 tests** (US BILAN-01). Un bilan est **fait de chiffres**
  affichés sous un titre de semaine : une borne fausse, un `deleted_at` oublié ou un échauffement
  compté produisent un bilan **qui ment sans jamais planter**, invisible en recette puisqu'il
  faudrait recalculer sa semaine à la main. Couvre `utcBounds` (conversion fenêtre locale →
  instants UTC, borne haute exclusive — une séance du dimanche 23 h compte, une du lundi 0 h non),
  `SELECT_STRENGTH`, `SELECT_MUSCLE_SETS`, `SELECT_RUNS`, `SELECT_RECORDS`, `SELECT_LOGGED_DAYS`
  (dont le seuil « > 0 kcal » et la borne haute **inclusive** sur `log_date`, contrairement aux
  bornes UTC), `SELECT_ACTIVITY_DAYS` et `SELECT_STEPS`. Fixe au passage par un test que **le
  joker de série ne compte pas comme jour actif** (STREAK-01, décision D3).
- **`dashboard-sql.test.ts` — 20 tests**. Le dashboard est le premier écran vu ; ses requêtes
  joignent jusqu'à 4 tables et filtrent sur propriétaire, pilier et date. Une jointure fausse
  affiche **la mauvaise séance** ou le record d'un autre — sans planter. Couvre
  `SELECT_TODAY_OCCURRENCES` (tri par ordre de séance, comptage des exercices hors supprimés,
  résolution du libellé de programme avec repli FR, exclusion des occurrences/séances/programmes
  supprimés), `SELECT_NEXT_UPCOMING` (strictement après aujourd'hui, `planned` seulement),
  les deux requêtes de records (repli de langue, cloisonnement par utilisateur), et
  `SELECT_WEEKLY_STRENGTH_VOLUME` — dont un test **documente** qu'elle compte volontairement la
  séance **en cours**, divergence assumée avec le bilan hebdomadaire qui n'admet que les séances
  closes.
- **`program-sql.test.ts` — 24 tests**. Trois opérations à fort risque de perte silencieuse :
  `duplicateProgram` copie 5 tables en remappant les `session_id` (un oubli produit un programme
  d'apparence correcte dont les exercices ou les blocs fractionné ont disparu — c'est exactement
  ce qui avait été rattrapé en cours d'US RUN-F2c, en lisant le code) ; `activateProgram` doit
  garantir **un seul actif par pilier** et **refuser un programme non possédé** (un éditorial
  activé en local passe la base locale puis est rejeté par la RLS au sync → divergence
  local↔cloud invisible sur l'appareil) ; `deleteProgram` doit désactiver **avant** de
  soft-deleter, sans quoi une ligne supprimée resterait `is_active = 1`. Couvre aussi les cascades
  de `removeSession` (plans + blocs + planning) et `updateProgramTranslation` (pas de résurrection
  d'une traduction supprimée).

#### Modifié

- `docs/specs/technical/strategie-tests.md` — nouvelle section **3.3** documentant la technique
  des constantes exportées et ce qu'elle attrape : plusieurs **propriétaires**, plusieurs
  **piliers** et plusieurs **langues** en base, qu'un téléphone de recette n'a jamais (un compte,
  un programme actif, une langue). Lot 2 marqué en cours (3/5).
- `weekly-review-repository.ts`, `dashboard-repository.ts` — `export` sur 13 constantes SQL et sur
  `utcBounds`, avec l'en-tête explicatif. **Aucun changement de comportement.**

#### Technique / Notes

- Quality gate au vert, codes de sortie lus **sans pipe** : lint 0 erreur, typecheck propre,
  **1 405 (shared) + 483 (mobile) = 1 888 tests**. Couverture mobile 19,9 % → **20,7 %** ;
  `src/data/repositories` 25 % → **29 %**.

### 03/08/2026 — `chore/socle-tests-unitaires` — Lot 1 terminé : records, objectifs, joker, mensurations

Suite de `a9425b3`. **49 tests ajoutés**, le lot 1 est clos : les 7 repositories d'écriture qui
sous-tendent les US en recette sont couverts sur du vrai SQL (146 tests au total pour ce lot).
Outillage — aucune ligne de roadmap, aucun front-matter d'US avancé.

#### Ajouté

- **`records-sql.test.ts` — 17 tests** (`evaluateWorkoutRecords`). Un record est un **fait daté et
  définitif** : une fausse insertion pollue l'historique de façon permanente et n'est pas
  rattrapable côté UI, alors que la détecter en recette suppose d'enchaîner plusieurs séances
  réelles. Couvre : trois types de record par série éligible, contexte (reps/charge) de la série
  qui a produit la valeur, **égaler n'est pas battre** (strictement supérieur), comparaison au
  `MAX(value)` et non au plus récent, exclusion des records supprimés et de ceux d'un autre
  utilisateur, cloisonnement par exercice, horodatage commun à une même évaluation, idempotence
  d'une ré-évaluation, et **conservation du libellé d'un exercice archivé** (US ADMIN-01 : un
  record est un fait passé, son nom doit survivre à l'archivage au catalogue).
- **`goal-joker-sql.test.ts` — 21 tests** (`goal-repository` + `streak-joker-repository`). Les deux
  partagent le point dur testé ici : **le quota est relu en base au moment de l'écriture**, jamais
  repris de l'affichage. Sans ça, un second appareil ou un écran resté ouvert laisserait passer un
  4ᵉ objectif ou un 2ᵉ joker dans le mois — une divergence qu'une recette sur un seul téléphone ne
  peut pas produire. Couvre aussi : plafond de 3 objectifs actifs avec échéance du jour comptée
  comme active, suppression qui libère une place, `currentBest1RM` (meilleur estimé toutes séances,
  hors séances non terminées / séries non validées / échauffements / supprimées / sans reps ou
  charge), et pour le joker : idempotence sur un jour déjà couvert, quota par mois calendaire,
  dates illisibles rejetées avant écriture, et le fait qu'un joker **n'écrit que dans
  `streak_jokers`** — aucune séance ni sortie fabriquée pour « remplir » le jour (décision D3).
- **`body-measurement-write.test.ts` — réécrit sur SQL, 11 tests** (était mock-based). La version
  précédente vérifiait qu'on **appelait** `softDelete`, pas que la bonne ligne — et elle seule —
  disparaissait : c'est pourtant exactement le critère de recette 4 de MESUR-01. Ajoute au passage
  trois cas qu'un mock ne pouvait pas exprimer : vider une mesure ne touche pas la même mesure d'un
  **autre jour**, une mesure retirée peut être **recréée**, et une ligne supprimée n'est pas
  ressuscitée par une mise à jour.

#### Modifié

- `docs/specs/technical/strategie-tests.md` — lot 1 marqué terminé (146 tests), chiffres
  actualisés. Le lot 2 gagne un avertissement : les repositories de lecture passent par des hooks
  `useQuery`, il faudra **d'abord décider** comment les brancher (extraire les constantes SQL ou
  faire un faux `useQuery`) avant d'écrire quoi que ce soit.

#### Technique / Notes

- `weekly-review-repository` est sorti du lot 1 : il n'expose aucune écriture, uniquement des
  hooks de lecture — il relève du lot 2.
- Quality gate au vert, codes de sortie lus **sans pipe** : lint 0 erreur, typecheck propre,
  **1 405 (shared) + 414 (mobile) = 1 819 tests**. Couverture mobile 19,1 % → **19,9 %** ;
  `src/data/repositories` 22 % → **25 %**.

### 03/08/2026 — `chore/socle-tests-unitaires` — Lot 1 : tests SQL des repositories d'écriture

Suite directe du socle poussé juste avant (`5d75e94`). Outillage : aucune ligne de roadmap,
aucun front-matter d'US avancé. **82 tests ajoutés** sur les trois repositories d'écriture qui
sous-tendent le plus d'US en recette, tous exécutés sur du vrai SQLite via le harness.

#### Ajouté

- **`workout-sql.test.ts` — 44 tests** (`workout-repository`, 1 187 l.). Couvre : au plus une
  séance active (y compris après annulation en soft delete), séries pré-remplies depuis un
  programme avec `order_index` continu et `max(1, target_sets)`, `parseTargetReps`
  (« 8-12 » → 8), héritage des valeurs de la série précédente et **remise à zéro après un
  échauffement**, idempotence de `finishWorkout` (double-tap « Terminer »), durée jamais négative,
  marquage de l'occurrence planifiée liée, clôture auto d'une séance périmée **datée sur la
  dernière activité réelle** et non sur « maintenant » (spec 3.37), renumérotation des exercices
  avec position absolue préservée pour les exercices validés, `replaceExercise` qui n'écrase que
  les séries non validées, normalisation des notes, unicité des paires superset, et **atomicité
  d'une transaction en échec**.
- **`run-sql.test.ts` — 22 tests** (`run-repository`, 777 l.). Cible les gardes coûteuses à
  reproduire sur device (il faut sortir courir) : au plus une course active, lien vers
  l'occurrence planifiée posé une seule fois et jamais réécrit, **flush GPS tardif jeté** après
  `finishRun`/`cancelRun` (le scénario de corruption le plus vicieux du pilier), **sérialisation
  des flushs concurrents** (3 flushs en `Promise.all` → aucun segment perdu), chaîne de flush qui
  survit à un échec, allure calculée depuis les scalaires flushés, distance manuelle appliquée
  uniquement en `source='manual'`.
- **`planned-session-sql.test.ts` — 16 tests** (`planned-session-repository`). `planProgram` est la
  plus grosse transaction de l'app (8 étapes, 3 tables) et **l'ordre des étapes porte du sens** :
  le retrait des occurrences futures de l'ancien programme doit précéder la désactivation, sinon
  le sous-select `is_active = 1` ne trouve plus rien et l'ancien planning survit en silence — c'est
  désormais tenu par un test. Couvre aussi : génération alignée au lundi avec `week_index`,
  activation exclusive **par pilier**, re-planification qui remplace sans empiler et **conserve
  l'historique fait/sauté**, gardes (programme sans séance, séance sans jour affecté, durée
  nulle/négative/non entière rejetée par Zod **avant** toute écriture, séances d'un autre
  propriétaire ignorées), et le cycle de vie report/saut/fait.

#### Modifié

- `docs/specs/technical/strategie-tests.md` — lot 1 marqué en cours (4/7 fichiers), chiffres de
  vérification actualisés.

#### Technique / Notes

- **Deux attentes de test étaient fausses, pas le code** — corrigées côté test après lecture :
  (1) `nextOrderIndex` prend le `MAX` des séries **non supprimées**, donc l'index d'une série
  retirée est réutilisé (voulu : sans ça l'ordre se creuserait de trous) ; (2) une séance annulée
  étant en soft delete, il faut la relire avec `rowsOf(table, true)`.
- Le harness a rejeté d'emblée trois colonnes inventées dans les seeds (`programs.user_id`,
  `sessions.user_id`, `planned_sessions.user_id` — la vraie colonne est `owner_id`). C'est
  exactement le garde-fou visé : avec un `powerSync` mocké, ces tests seraient passés au vert.
- Effets de bord `fire-and-forget` mockés localement (`track`, `pushWorkout`/`pushRun`) : hors
  périmètre, et Health Connect toucherait un module natif Android.
- Quality gate au vert, codes de sortie lus **sans pipe** : lint 0 erreur, typecheck propre,
  **1 405 (shared) + 373 (mobile) = 1 778 tests**. Couverture mobile 15,0 % → **19,1 %** ;
  `src/data/repositories` 9 % → **22 %**.

### 03/08/2026 — `chore/socle-tests-unitaires` — Socle de tests des repositories (SQLite en mémoire)

Outillage, pas une fonctionnalité produit : aucune ligne de roadmap, aucun front-matter d'US
avancé. Point de départ = un audit chiffré de la couverture (`npm run test:coverage`), qui montre
un déséquilibre net : `packages/shared` à **99,2 %** d'instructions couvertes, `apps/mobile` à
**15,0 %** (dont `src/data/repositories` à **9 %** pour 12 157 lignes), `apps/admin` à **0 %**
sans aucun runner installé.

La cause n'est pas de la négligence : jusqu'ici on ne savait tester la couche base locale qu'en
mockant `powerSync` de bout en bout (`getAll` → `[]`), ce qui vérifie **qu'on a appelé une
fonction**, jamais **que la requête est juste**. C'est ce qui a laissé passer le bug de la recette
device du 31/07/2026 (`cycle_tracking_enabled` absent du schéma PowerSync local → écriture avalée
en silence, interrupteur qui reste éteint).

#### Ajouté

- **`apps/mobile/src/test-utils/sqlite-harness.ts`** — fausse instance PowerSync adossée à une
  base **SQLite réelle en mémoire**, dont le DDL est **dérivé du `AppSchema` de l'app**
  (`@/powersync/schema`). Moteur `node:sqlite`, intégré à Node : **aucune dépendance ajoutée**.
  Surface couverte : `execute` / `getAll` / `getOptional` / `get` / `writeTransaction` /
  `readTransaction`. Les transactions sont réelles (`BEGIN` / `COMMIT` / `ROLLBACK`), donc
  l'atomicité d'une écriture multi-tables est testable. Helpers `resetTestDb()`, `seed()`
  (complète `id`/`created_at`/`updated_at`/`deleted_at`), `rowsOf()` (relecture d'assertion,
  option `includeDeleted`).
  Ce que ça attrape et que le mock laissait passer : colonne absente du schéma local,
  `WHERE deleted_at IS NULL` oublié, idempotence annoncée mais fausse, `ORDER BY` inversé,
  jointure fausse, transaction non atomique.
- **`apps/mobile/src/test-utils/node-sqlite.d.ts`** — déclaration ambiante minimale de
  `node:sqlite`. Choix délibéré de **ne pas** ajouter `@types/node` au champ `types` du tsconfig
  mobile : cela rendrait `process`/`Buffer` visibles dans le code applicatif React Native, où ils
  n'existent pas à l'exécution.
- **`apps/mobile/src/data/repositories/__tests__/menstrual-cycle-sql.test.ts`** — 15 tests, premier
  usage du harness et **fichier de référence à copier** pour tout nouveau test de repository.
  Couvre les écritures d'US CYCLE-01 sur du vrai SQL : garde d'activation (R16, y compris réglage
  absent), idempotence de `startPeriod` sur la date de début (R21) et son insensibilité aux lignes
  en soft delete, clôture de la période ouverte la veille du nouveau début (R2), refus des dates
  futures (R4), `autoCloseStalePeriods` (R3), création puis mise à jour du journal sans doublon,
  saisie vide acceptée (c'est ainsi qu'on efface), `deleteAllCycleData` en soft delete (R17).
- **`docs/specs/technical/strategie-tests.md`** — le cadrage : constat chiffré par dossier, les
  4 niveaux (pur / base locale / rendu / device) avec l'outil et l'objectif de chacun, conventions
  d'écriture, **plan en 6 lots** priorisés par risque × coût de la recette manuelle, seuils de
  couverture proposés, et la liste de **ce qui doit rester sur téléphone** (permissions Android,
  GPS réel, notifications système, Health Connect, synchro 2 appareils, TalkBack, batterie).
  Principe directeur : ne pas courir après le pourcentage, mais **faire descendre du niveau 4 vers
  les niveaux 2 et 3** tout ce qui peut l'être, pour raccourcir [RECETTES.md](RECETTES.md).
- Scripts `test:coverage` (racine + `apps/mobile`) et `test:watch` (`apps/mobile`).

#### Corrigé

- **`expo-crypto` n'était pas mocké dans `jest.setup.ts`** : `Crypto.randomUUID()` renvoyait
  `undefined` en test, donc toute ligne insérée par `insertWithSyncFields` recevait un `id` nul et
  les `WHERE id = ?` suivants ne matchaient rien. Panne muette qui rendait **intestable tout
  parcours écriture → relecture** — découverte en écrivant les premiers tests du harness, qui
  échouaient sur `id: null`. Mock ajouté (délègue à `node:crypto`).

#### Modifié

- **`.nvmrc` : 20 → 24** et `engines.node` : `>=20` → `>=24`. **Nécessaire** : `node:sqlite`
  n'existe pas en Node 20 et exige un drapeau en 22 ; il n'est disponible tel quel qu'à partir de
  Node 23.4/24. La CI suit `.nvmrc` automatiquement.
  ⚠️ **Action requise côté devs** : `nvm install 24` / `nvm use 24`, sinon la suite mobile échoue
  à l'import du harness. C'est le seul coût imposé par ce socle.

#### Technique / Notes

- `readSchema()` sonde plusieurs emplacements (`tables` / `props` / racine) pour lire le
  `AppSchema`, car sa forme diffère selon qu'il est mocké (`jest.setup.ts`) ou réel, et selon la
  version de PowerSync. **Échoue bruyamment** si aucune table n'est trouvée : un schéma vide
  produirait des tests verts sans aucune table, le pire des faux positifs.
- `bind()` convertit booléens (→ 0/1) et `undefined` (→ `null`) : op-sqlite est plus permissif que
  `node:sqlite` sur les types liés, sans quoi un test échouerait sur une différence de binding et
  non sur la logique testée.
- `node:sqlite` est marqué expérimental par Node : chaque exécution de test émet un
  `ExperimentalWarning`. Bruit uniquement, aucun impact fonctionnel.
- Un test de repository doit poser son propre `jest.mock('@/powersync/system', …)` pour remplacer
  le mock global de `jest.setup.ts` — sans ce bloc, le harness n'est pas branché et le test
  retombe silencieusement sur les mocks vides. Le fichier de référence le montre en en-tête.
- Quality gate au vert, codes de sortie lus **sans pipe** : lint 0 erreur (30 warnings
  préexistants, aucun dans les fichiers ajoutés), typecheck propre sur les 3 workspaces,
  **291 tests Jest (mobile, +15) + 1 405 tests Vitest (shared) = 1 696 tests, tous verts**.

### 03/08/2026 — `feature/runf2c-blocs-fractionne` — RUN-F2c : blocs fractionné / intervalles (roadmap 5.9 → ✅)

Implémentation complète, 3ᵉ des 4 candidats issus du découpage de RUN-F2 — la plus grosse des
quatre. Spec/plan/maquette validés dans les entrées précédentes (02/08/2026).

#### Ajouté

- **Nouvelle table `session_intervals`** (migration `20260802213841_runf2c_session_intervals`,
  déjà poussée sur le cloud) : `reps`, `fast_distance_m`/`fast_duration_seconds` (exactement l'un
  des deux), `fast_pace_pct_vma` (nullable), `recovery_distance_m`/`recovery_duration_seconds`
  (récup entièrement optionnelle). Une ligne = un bloc de répétitions (analogie `exercise_plans`).
  RLS + trigger `updated_at` + publication PowerSync identiques au patron `exercise_plans`.
- `packages/shared/src/running-paces.ts` — `paceAtVmaPercent(vmaPaceSPerKm, pct)`, testée (3 tests).
  `packages/shared/src/program.ts` — `sessionIntervalRowSchema`/`SessionIntervalRow`.
- **Repository mobile** (`program-repository.ts`) : `IntervalBlockItem`, `SessionDetail.intervals`,
  `addIntervalBlock`/`updateIntervalBlock`/`removeIntervalBlock`, cascade `removeSession` et
  **cascade `duplicateProgram`** (copie des blocs par `sessionIdMap`, sans quoi dupliquer un
  programme fractionné perdrait silencieusement ses blocs — trouvé en lisant le code réel, pas
  dans la spec initiale).
- **Éditeur mobile** — `IntervalBlockEditor.tsx` (nouveau, miroir de `ExercisePlanEditor`) : reps,
  toggle distance/durée pour la phase rapide (R2), %VMA optionnel, toggle aucune/distance/durée
  pour la récupération (R3), suppression. Monté dans `RunningSessionEditor.tsx` quand
  `sessionType === 'fractionne'`, avec bouton d'ajout.
- **Repository + éditeur admin** (`apps/admin/src/data/programs.ts`,
  `ProgramEditScreen.tsx`) : CRUD complet (`addIntervalBlock`/`updateIntervalBlock`/
  `removeIntervalBlock`/`reorderIntervalBlocks`) + `SortableList` de blocs (ajout, édition inline,
  suppression, réordonnancement) dans la branche `isRunning` de `SessionCard`, quand
  `sessionType === 'fractionne'` — intégration nouvelle dans cette branche (auparavant un simple
  bloc de champs sans liste). Cascade `archiveProgram`/`restoreProgram`/`removeSession` étendue.
- **Affichage lecture seule** — `apps/mobile/src/running/interval-summary.ts` (nouveau,
  `formatIntervalBlockSummary`, 4 gabarits selon présence %VMA/récup) monté dans
  `RunningSessionCard` (`running-programs/[id].tsx`) et `PlanSessionCard` (`planning/plan.tsx`).
- i18n `running.intervals.*` (FR+EN, parité vérifiée) : titre, libellés de champs, gabarits de
  résumé de bloc. Admin (FR uniquement) : `programs.intervals*`/`programs.addInterval`/etc.

#### Modifié

- `docs/specs/technical/powersync-sync-rules.yaml` — 2 nouvelles lignes pour `session_intervals`
  (owner + éditorial). **⚠️ Déploiement manuel dashboard PowerSync requis avant recette** — non
  effectué par cette session (pas d'accès dashboard), à vérifier par Florian/Damien.
- Roadmap 5.9 : 🟡 → ✅. `apps/mobile/src/powersync/schema.ts` : nouvelle table locale
  `session_intervals`.

#### Technique / Notes

- Quality gate exécuté par étape (comme prévu au plan vu l'ampleur de cette US), jamais uniquement
  à la fin : typecheck/lint/test au vert après chaque groupe d'étapes, aucune régression détectée.
  Suite complète finale : 276 tests Jest (mobile) + 1405 tests Vitest (shared), tous verts ;
  lint sans nouveau warning ; typecheck propre sur les 3 workspaces.
- Distances de bloc saisies en **mètres bruts** (pas de conversion impériale) : un fractionné se
  décrit universellement en mètres (convention piste, « 400 m »), à la différence de la distance
  totale d'une séance qui suit le système d'unités choisi.
- **Aucun risque sur le tracker/la tâche de fond** : cette US s'arrête à la planification et à
  l'affichage ; le guidage vocal pendant la course reste RUN-F2d (hors périmètre, dépend de
  RUN-F2a et RUN-F2c).

### 02/08/2026 — `feature/runf2c-blocs-fractionne` — RUN-F2c entrée en pipeline (spec + plan + maquette, doc uniquement)

3ᵉ des 4 candidats issus du découpage de RUN-F2 (roadmap 5.9) — la plus grosse des quatre. Aucun
code.

#### Ajouté

- [Spec](docs/specs/functional/us/runf2c-blocs-fractionne.md) — modèle de données par analogie
  explicite avec `exercise_plans` : **une ligne = un bloc de répétitions**, exactement comme
  `target_sets` est déjà un compteur sur une seule ligne côté musculation (« 6×400 m » = une seule
  ligne `reps=6`, pas 6 lignes répétées). Nouvelle table `session_intervals` (reps, distance/durée
  rapide, %VMA nullable, distance/durée récup entièrement optionnelle), étendue au type
  `fractionne` uniquement, coexistant sans conflit avec la cible globale de séance déjà existante.
  Seule fonction pure neuve : `paceAtVmaPercent` (packages/shared) — un pourcentage de VMA plus bas
  donne une allure plus lente, vérifié par calcul en relecture (reproduit une valeur déjà connue de
  `sessionTargetPace`).
- [Plan](docs/plans/runf2c-blocs-fractionne.md) — 8 étapes : migration + schéma + **sync rules
  (déploiement manuel dashboard, contrairement aux 3 US précédentes de la famille qui n'en avaient
  pas besoin)** → fonction pure + Zod → repository mobile (CRUD + cascade suppression/duplication
  de programme) → éditeur mobile → repository admin → éditeur admin (`SortableList`, déjà utilisé
  pour les exercices) → affichage lecture seule (détail programme + planning) → i18n.
- [Maquette](design/runf2c-blocs-fractionne/runf2c-blocs-fractionne.html) — l'affichage d'une
  séance structurée vs. sans structure (comportement inchangé), l'édition d'un bloc, et le rappel
  de l'analogie avec `exercise_plans`.

#### Technique / Notes

- Relecture (agent) sur la spec initiale : aucune contradiction interne trouvée, 3 clarifications
  mineures apportées (positivité de `reps` ≥ 1, affordance d'ajout de bloc explicitée côté admin
  — pas seulement le réordonnancement —, et précision que la règle « exactement une cible » est
  vérifiée côté application, pas par une contrainte SQL, cohérent avec `hasRunningSessionTarget`
  déjà ainsi).
- 2 risques réels trouvés en préparant le plan (pas dans la spec initiale) : les **sync rules** de
  la nouvelle table doivent être déployées manuellement sur le dashboard PowerSync (leçon déjà
  notée dans CLAUDE.md, oubliée une fois sur CYCLE-01) ; la **duplication de programme**
  (`duplicateProgram`) doit explicitement copier `session_intervals`, sinon un programme fractionné
  dupliqué perdrait silencieusement ses blocs.

### 02/08/2026 — `feature/runf2b-cible-en-direct` — RUN-F2b : cible en direct (roadmap 5.23 → ✅)

Implémentation validée dans l'entrée précédente. 2ᵉ des 4 candidats issus du découpage de RUN-F2,
la plus petite et la plus sûre — aucune fonction pure neuve, aucune clé i18n neuve, aucun fichier
`packages/shared` touché.

#### Ajouté

- `apps/mobile/src/data/repositories/run-repository.ts` — `ActiveRun`/`ActiveRunDbRow`/
  `SELECT_ACTIVE_RUN`/`rowToActiveRun` étendus (`plannedSessionId`, colonne déjà en base depuis
  RUN-F3).
- `apps/mobile/src/app/run/active.tsx` — carte « Objectif » sous les métriques principales,
  montée seulement si une cible chiffrée existe (`hasTarget`, jamais un encart vide). Réutilise
  `compareToTarget` (packages/shared, non modifiée) + `useRunTarget` (déjà exporté) + les clés
  i18n `running.target.*` de RUN-F3, appelés en continu avec les valeurs **en cours** au lieu des
  valeurs finales — usage déjà couvert par leur signature actuelle. L'axe durée utilise
  exclusivement `active.durationSeconds` (net, post-flush), jamais l'horloge murale de secours
  (`elapsedSeconds`, qui inclut les pauses) — sinon un faux « objectif dépassé » aurait pu
  s'afficher dans la fenêtre avant le premier flush GPS (R1 bis, relevé en relecture de spec).

#### Technique / Notes

- Quality gate complet : `npm run typecheck` (0 erreur), `npm run lint` (0 erreur), `npm run test`
  (67 fichiers / 1402 tests côté `packages/shared`, 50 suites / 276 tests côté `apps/mobile` —
  compteurs inchangés, aucune fonction/test neuf nécessaire).
- Duplication volontaire avec `run/summary.tsx` (construction des libellés) plutôt qu'un partage
  d'abstraction : RUN-F3 est encore en recette (non clôturée), toucher son code pour factoriser
  ~15 lignes aurait ajouté un risque de régression sur une fonctionnalité pas encore validée par un
  humain. Un futur nettoyage post-clôture RUN-F3 pourra factoriser un helper commun.
- Aucune migration, aucune dépendance nouvelle, aucune sync rule à redéployer — recettable sur
  l'APK existant (contrairement à RUN-F2a).

### 02/08/2026 — `feature/runf2b-cible-en-direct` — RUN-F2b entrée en pipeline (spec + plan + maquette, doc uniquement)

2ᵉ des 4 candidats issus du découpage de RUN-F2 (roadmap 5.23). Aucun code.

#### Ajouté

- [Spec](docs/specs/functional/us/runf2b-cible-en-direct.md) — reformulation du besoin roadmap
  (« terminer avant la cible ou continuer en libre ») : les deux actions sont **déjà natives**
  (le bouton Stop existant termine à tout moment, rien ne bloque la poursuite après la cible) — le
  vrai manque diagnostiqué par le backlog est l'absence de **visibilité** de la cible pendant la
  course. Réutilise intégralement ce que RUN-F3 (en recette) a déjà construit :
  `compareToTarget`/`TargetComparison` (packages/shared, non modifié), `useRunTarget` (déjà
  exporté), clés i18n `running.target.*` (déjà neutres en tense, « X sur Y visés » valable pendant
  et après une course) — **aucune fonction pure neuve, aucune clé i18n neuve**. Seule extension :
  `ActiveRun` gagne `plannedSessionId` (colonne déjà en base depuis RUN-F3).
- [Plan](docs/plans/runf2b-cible-en-direct.md) — 2 étapes : extension de `ActiveRun`/requête SQL →
  carte objectif dans `run/active.tsx` (calcul de libellé dupliqué depuis `summary.tsx`,
  volontairement pas partagé — RUN-F3 encore en recette, un refactor à cheval ajouterait un risque
  de régression sur du code pas encore validé, pour un gain de duplication mineur).
- [Maquette](design/runf2b-cible-en-direct/runf2b-cible-en-direct.html) — les 3 états de la carte
  objectif (en dessous, atteinte, dépassée) et le rappel que les deux actions du titre roadmap sont
  déjà natives.

#### Technique / Notes

- Relecture (agent) sur la spec initiale : 1 correction réelle apportée avant validation — le
  repli `elapsedSeconds` (horloge murale, inclut les pauses) aurait pu fausser la comparaison à une
  cible de durée dans la fenêtre avant le premier flush GPS (faux « dépassé » possible) ; la
  comparaison de durée utilise désormais exclusivement `active.durationSeconds` (net, post-flush),
  absente sinon plutôt que de retomber sur l'horloge murale (R1 bis).
- Aucune migration, aucune donnée nouvelle (`runs.planned_session_id` déjà en base et synchronisé).

### 02/08/2026 — `feature/runf2a-annonces-audio` — RUN-F2a : annonces audio périodiques (roadmap 5.19 → ✅)

Implémentation validée dans l'entrée précédente. Premier des 4 candidats issus du découpage de
RUN-F2, et premier réglage de comportement de course jamais exposé à l'utilisateur.

#### Ajouté

- `expo-speech` (dépendance native neuve → **nouveau dev build EAS requis** pour la recette, comme
  `expo-haptics`/MUSC-F9). Mock Jest ajouté (`jest.setup.ts`, même patron que `expo-notifications`).
- `packages/shared/src/running.ts` — `nextAnnouncementThreshold(distanceM, intervalM,
  lastAnnouncedIndex)` : renvoie le prochain seuil franchi ou `null`, jamais deux fois le même
  seuil ; un saut de plusieurs seuils d'un coup n'annonce que le dernier (pas de rattrapage). 6
  tests ajoutés.
- Migration : `running_profiles.voice_announcements_enabled boolean not null default false`,
  `voice_announcement_interval_m integer not null default 1000`, additives — **désactivé par
  défaut** (une annonce vocale peut interrompre une musique en cours). Aucune sync rule à
  redéployer (`running_profiles` déjà en `select *`).
- `apps/mobile/src/data/repositories/running-profile-repository.ts` — `RunnerProfile`/
  `RunnerProfileInput` étendus, lecture défensive (`?? false`/`?? 1000`) pour les lignes locales
  antérieures à la migration.
- `apps/mobile/src/app/running-profile.tsx` — réglage (`Switch` + choix d'intervalle 500 m/1 km/
  2 km, affiché seulement si activé), même patron que `CycleTrackingSection`.
- `apps/mobile/src/running/announcements.ts` (nouveau) — `buildAnnouncementPhrase` (pluriels
  i18next `_one`/`_other`, jamais une concaténation manuelle ; mètres sous 1 km, kilomètres entiers
  sinon — jamais une décimale lue à voix haute) et `useDistanceAnnouncements` (compteur de seuil
  initialisé depuis la distance courante, pas 0, pour ne pas rejouer les annonces déjà passées si
  l'écran est remonté via la carte « Reprendre » du hub course).
- `apps/mobile/src/app/run/active.tsx` — câblage du hook (GPS uniquement, spec R4), calcul de
  `distanceM`/`avgPaceValue` remonté avant les retours anticipés pour respecter la règle des hooks.
- i18n `running.announcement.*` (7 clés avec pluriels) + `running.profile.announcements*` (4
  clés), FR + EN. Parité vérifiée (1659 clés de chaque côté).

#### Technique / Notes

- Quality gate complet : `npm run typecheck` (0 erreur), `npm run lint` (0 erreur), `npm run test`
  (67 fichiers / 1402 tests côté `packages/shared`, 50 suites / 276 tests côté `apps/mobile`).
- **Limite assumée et documentée dans la spec, pas un bug** : les annonces ne se déclenchent que si
  `run/active.tsx` est monté. Changer d'onglet pendant la course (cas fréquent, confirmé par
  relecture) coupe les annonces jusqu'au retour sur l'écran, même app au premier plan — décision
  volontaire de ne pas déclencher depuis la tâche de fond, pour ne pas ajouter une inconnue dans le
  fichier le plus sensible du projet.
- Roadmap 5.19 ⬜ → ✅. RUN-F2 restant à cadrer : RUN-F2b (cible en temps réel), RUN-F2c (blocs
  fractionné, le plus gros morceau), RUN-F2d (dépend des deux précédents + de celle-ci).

### 02/08/2026 — `feature/runf2a-annonces-audio` — RUN-F2 scindée en 4 + RUN-F2a entrée en pipeline (spec + plan + maquette, doc uniquement)

RUN-F2 (« Séances guidées vocales ») regroupait 4 items de roadmap hétérogènes (5.19, 5.23, 5.9,
5.18) — trop inégaux en taille/dépendances pour un seul incrément. Scindée en 4 candidats
(RUN-F2a/b/c/d, BACKLOG.md), ordre logique 5.19 → 5.23 → 5.9 → 5.18. Cette entrée cadre uniquement
RUN-F2a. Aucun code.

#### Ajouté

- [Spec](docs/specs/functional/us/runf2a-annonces-audio.md) — annonces vocales périodiques
  (distance/temps/allure) pendant une course GPS, via `expo-speech` (nouvelle dépendance native,
  nouveau dev build requis). Déclenchées depuis `run/active.tsx` (premier plan), pas depuis la
  tâche de fond — décision explicite pour ne pas toucher au fichier le plus sensible du projet
  juste après RUN-F1b. Limite assumée et documentée : aucune annonce si l'écran de suivi n'est pas
  monté, y compris le cas **fréquent** (pas seulement le verrouillage) de changer d'onglet pendant
  la course puis revenir via « Reprendre ». Réglage opt-in (désactivé par défaut) sur
  `running_profiles`, premier réglage de comportement de course jamais exposé à l'utilisateur
  (`autoPause` est câblé en dur aujourd'hui).
- [Plan](docs/plans/runf2a-annonces-audio.md) — dépendance native → fonction pure
  `nextAnnouncementThreshold` (testée d'abord) → réglage `running_profiles` (migration + éditeur) →
  composition i18n de la phrase → hook + câblage dans `active.tsx`.
- [Maquette](design/runf2a-annonces-audio/runf2a-annonces-audio.html) — l'écran de suivi avec/sans
  annonce, le réglage (switch + fréquence), et la limite du changement d'onglet illustrée.

#### Technique / Notes

- Relecture (agent) sur la spec initiale : 4 corrections apportées avant validation — le scénario
  de remontage de l'écran (R2) était présenté comme hypothétique alors que la carte « Reprendre »
  du hub course le rend systématique ; la limite §1 ne couvrait que l'écran verrouillé, pas le cas
  bien plus fréquent du changement d'onglet (tracker de fond actif, écran démonté) ; R3 violait la
  règle de pluralisation i18next du projet (`docs/specs/technical/i18n.md`) ; le cas des seuils à
  500 m (demi-kilomètres) n'était pas traité (résolu en R3 bis : mètres sous 1 km).
- Aucune migration de données rétroactive nécessaire (2 colonnes à défaut sur `running_profiles`).

### 02/08/2026 — `feature/runf1b-denivele-cumule` — RUN-F1b : dénivelé cumulé, blocage codec levé (roadmap 5.32 → ✅)

Implémentation validée dans l'entrée précédente. Candidat marqué ⛔ bloqué (« il faut étendre le
tracker et le codec de trace ») — blocage levé sans toucher au codec.

#### Ajouté

- 1 migration (`runs.elevation_gain_m numeric`, `runs.elevation_loss_m numeric`, nullable,
  additives) + `apps/mobile/src/powersync/schema.ts` étendu. Aucune sync rule à redéployer
  (`select * from runs` déjà en place).
- `apps/mobile/src/running/tracker-task.ts` — `TrackerState` gagne 2 cumuls flushés
  (`cumulativeElevationGainM`/`LossM`) + 2 champs internes (`pendingElevationDeltaM`,
  `lastAltitudeM`). `toGpsPointsWithAltitude` remplace `toGpsPoints` : altitude appariée **dans la
  même boucle** que le filtre de validité horizontale (`isValidFix`), jamais par un second passage
  — évite une désynchronisation silencieuse point/altitude. `handleLocationBatch` accumule le
  dénivelé uniquement sur les segments déjà jugés fiables pour la distance, avec un filtre de bruit
  vertical (seuil 3 m, solde en attente remis à zéro une fois validé) et un filtre de précision
  (`altitudeAccuracy` > 30 m → traité comme absent). La pause suit exactement le même traitement que
  `lastPoint`/`lastPointT` (pas de faux relief à la reprise). **Le codec de trace
  (`GpsPoint`/`encodeSegment`/`decodeTrack`) reste entièrement inchangé.** 7 tests ajoutés
  (`tracker-task.test.ts`).
- `apps/mobile/src/data/repositories/run-repository.ts` — `FlushInput`, `RunHistoryItem`,
  `RunDetail` étendus ; `startRun` initialise les 2 colonnes à `null` explicitement.
- `packages/shared/src/run-stats.ts` — `StatRun`/`RunStats` gagnent les champs dénivelé ;
  `aggregateRunStats` les somme avec `?? 0` (même convention que distance/durée). 4 tests existants
  mis à jour (comparaison `toEqual` littérale), fixture étendue pour couvrir un mélange de courses
  avec/sans dénivelé connu dans une même période.
- Affichage : `run/summary.tsx` (ligne dénivelé + course, **absente** si `null` — jamais « 0 m ») et
  `running-history/index.tsx` (`StatsSection`, dénivelé cumulé par période). i18n
  `running.elevation.*` (3 clés), FR + EN. Parité vérifiée (1648 clés de chaque côté).

#### Technique / Notes

- Quality gate complet : `npm run typecheck` (0 erreur), `npm run lint` (0 erreur), `npm run test`
  (67 fichiers / 1396 tests côté `packages/shared`, 50 suites / 276 tests côté `apps/mobile`).
- Relecture de spec (agent, niveau d'exigence élevé — tâche de fond GPS) avait fait remonter 2
  points avant le code : l'appariement point↔altitude contraint à une seule boucle (appliqué), et
  les 4 tests `aggregateRunStats` à mettre à jour (fait).
- ⚠️ **Seuils non validés terrain** (`ALTITUDE_ACCURACY_MAX_M = 30`, `ELEVATION_NOISE_THRESHOLD_M = 3`)
  — posés par analogie avec des pratiques connues (montres GPS grand public), à ajuster après une
  vraie sortie de recette sur un parcours vallonné (comparaison avec une référence Strava/Garmin/IGN).
- Aucune dépendance native nouvelle → recettable sur l'APK existant.

### 02/08/2026 — `feature/runf1b-denivele-cumule` — RUN-F1b : blocage levé, entrée en pipeline (spec + plan + maquette, doc uniquement)

Candidat marqué ⛔ bloqué dans BACKLOG.md (« la trace GPS ne capte pas l'altitude, il faut étendre
le tracker et le codec »). Aucun code — cette entrée pose le cadrage qui désamorce le blocage.

#### Ajouté

- [Spec](docs/specs/functional/us/runf1b-denivele-cumule.md) — décision centrale (§0) : **ne pas
  toucher au codec de trace** (`GpsPoint`, `encodeSegment`/`decodeTrack` restent `{lat,lng,t}`
  inchangés). Le dénivelé suit exactement le patron déjà établi de `distance_m`/`duration_seconds` :
  deux scalaires (`elevation_gain_m`/`elevation_loss_m`) cumulés **en direct** par le tracker à
  partir de `coords.altitude` (déjà fourni par `expo-location`, aucune dépendance native nouvelle),
  jamais recalculés depuis `gps_track`. Filtre de bruit vertical (seuil 3 m, R3) et filtre de
  précision (`altitudeAccuracy` > 30 m → absent, R1) — les deux seuils explicitement signalés (R7)
  comme non validés terrain, à ajuster après recette réelle (même exigence que R1/running, qui avait
  nécessité une validation terrain dédiée). Hors périmètre assumé : pas de profil d'altitude, pas de
  balise GPX `<ele>` (nécessiteraient d'étendre le codec).
- [Plan](docs/plans/runf1b-denivele-cumule.md) — 5 étapes : migration (2 colonnes nullable, aucune
  sync rule à redéployer — `select * from runs` déjà en place) → tracker (`TrackerState` étendu,
  appariement point↔altitude dans la même boucle que le filtre de validité existant, testé
  d'abord) → repository + `aggregateRunStats` (packages/shared) → affichage (résumé de course +
  stats de période) → solde.
- [Maquette](design/runf1b-denivele-cumule/runf1b-denivele-cumule.html) — le contraste architecture
  écartée/retenue, l'affichage par sortie (présent/absent) et par période, un schéma du filtre de
  bruit.

#### Technique / Notes

- Relecture (agent) sur la spec initiale, avec un niveau d'exigence élevé (tâche de fond GPS,
  zone la plus sensible du projet) : 2 points corrigés avant validation — l'appariement
  point↔altitude devait être explicitement contraint à **une seule boucle** avec le filtre de
  validité horizontale (une seconde passe indépendante désynchroniserait silencieusement, sans
  crash) ; les 4 tests existants de `aggregateRunStats` (`toEqual` littéral) casseront en ajoutant
  des champs à `RunStats` — désormais listés explicitement dans le plan plutôt que découverts après
  coup.
- Aucune dépendance native nouvelle → recettable sur l'APK existant.

### 02/08/2026 — `feature/muscf15-progression-programme` — MUSC-F15 : progression au niveau du programme (roadmap 3.7 → ✅)

Implémentation validée dans l'entrée précédente. Chantier scindé de MUSC-F7 faute de cadrage —
cadrage tranché sans inventer de cible de charge stockée.

#### Ajouté

- `packages/shared/src/workout.ts` — `computeWeekCompletionRate(sessions)` (compte `done`/total,
  `null` si liste vide) et extension de `ProgressionSuggestion`/`computeProgressionSuggestion` :
  nouvelle variante `{ kind: 'weightHold'; weightKg; reps }` + option
  `opts.priorWeekAdherenceOk?: boolean` (défaut non fourni = comportement inchangé). Si
  `false`, la branche `weightOrReps` se dégrade en `weightHold` (poids inchangé, reps toujours
  proposées) — évaluée **après** le deload (MUSC-F7), qui reste seul prioritaire. 8 tests ajoutés
  (dont 1 vérifiant explicitement que deload + adhérence insuffisante ensemble → le deload gagne).
- `apps/mobile/src/data/repositories/workout-repository.ts` — `ActiveWorkout` gagne `programId`/
  `plannedSessionId`/`weekIndex` ; `SELECT_ACTIVE_WORKOUT` résout `week_index` en une jointure sur
  `planned_sessions` (une seule requête, pas d'aller-retour supplémentaire).
- `apps/mobile/src/data/repositories/planned-session-repository.ts` — `usePriorWeekAdherence(programId,
  weekIndex)` : requête `planned_sessions` filtrée `program_id`+`week_index − 1`, délègue à
  `computeWeekCompletionRate`, retourne `boolean | null` (`null` = signal absent, décision du défaut
  laissée à l'appelant, pas au hook).
- `apps/mobile/src/app/workout.tsx` — câblage `priorWeekAdherenceOk` dans l'appel existant à
  `computeProgressionSuggestion`, branche `weightHold` ajoutée au switch de libellé.
- i18n `workout.suggestion.weightHold` (1 clé, FR + EN) — **dédiée**, pas un recyclage de
  `workout.suggestion.reps` (relecture agent : ce texte est déjà utilisé pour le cas structurel
  « poids de corps », le réutiliser aurait confondu deux situations différentes pour l'utilisateur).
  Parité FR/EN vérifiée (1645 clés de chaque côté).

#### Technique / Notes

- Quality gate complet : `npm run typecheck` (0 erreur), `npm run lint` (0 erreur), `npm run test`
  (67 fichiers / 1396 tests côté `packages/shared`, 50 suites / 269 tests côté `apps/mobile`).
- Aucune migration : `workouts.program_id`/`planned_session_id` et `planned_sessions.week_index`/
  `status` étaient déjà en base, seule la requête de lecture change.
- Roadmap 3.7 🟡 → ✅ (Récapitulatif et V0.3 mis à jour : Livré 185→186, Partiel 16→15). BACKLOG.md :
  ligne retirée (US désormais suivie par sa spec + RECETTES.md).

### 02/08/2026 — `feature/muscf15-progression-programme` — MUSC-F15 (3.7) : entrée en pipeline (spec + plan + maquette, doc uniquement)

Chantier scindé de MUSC-F7 le 01/08/2026, faute de cadrage produit. Cette entrée pose le cadrage
manquant. Aucun code.

#### Ajouté

- [Spec](docs/specs/functional/us/muscf15-progression-programme.md) — résout les 3 questions
  ouvertes du split (BACKLOG.md) en évitant d'inventer une cible de charge stockée : **second gate**
  sur `computeProgressionSuggestion` (même patron que `previousStruggled`/MUSC-F7), évalué à la
  volée à partir du taux de complétion de la semaine `week_index − 1` du **même programme** (≥ 80 %,
  seuil déjà donné par la roadmap 3.7 — pas à re-trancher). Nouvelle variante `weightHold` du type
  `ProgressionSuggestion` (poids gelé, reps toujours proposées à la hausse) et nouvelle clé i18n
  dédiée — **pas** un recyclage de la clé « poids de corps » existante (relecture agent : réutiliser
  ce texte aurait confondu deux situations différentes pour l'utilisateur).
- [Plan](docs/plans/muscf15-progression-programme.md) — 2 étapes : `computeWeekCompletionRate` +
  extension de `computeProgressionSuggestion` (packages/shared, purs, testés d'abord) → `ActiveWorkout`
  étendu (`programId`/`plannedSessionId`/`weekIndex`) + hook `usePriorWeekAdherence` + câblage
  `workout.tsx` → solde (roadmap 3.7 🟡→✅, retrait BACKLOG.md).
- [Maquette](design/muscf15-progression-programme/muscf15-progression-programme.html) — 3 états de
  la même bulle de suggestion (hausse pleine, poids gelé, deload prioritaire), aucun nouvel écran.

#### Technique / Notes

- Relecture (agent) sur la spec initiale : 2 corrections apportées avant validation — le choix
  i18n initial (réutiliser `workout.suggestion.reps`) confondait le cas « poids de corps » et le cas
  « adhérence insuffisante », corrigé en clé dédiée `weightHold` ; R3 confondait « séance libre » et
  « séance de programme démarrée hors planning » (même résultat, causes différentes), reformulé pour
  nommer les deux cas explicitement.
- Aucune migration : `workouts.program_id`/`planned_session_id` et `planned_sessions.week_index`/
  `status` sont déjà en base, seule la requête de lecture change.

### 02/08/2026 — `feature/tri12-garde-fou-global` — TRI-12 : détection de surcharge / sous-récupération globale

Implémentation validée dans l'entrée précédente. Dernière des trois déclinaisons de la brique ACWR
identifiées par META-19 (avec RUN-18 livrée et MR-10 absorbée) — les trois sont désormais réglées.

#### Ajouté

- `packages/shared/src/training-time.ts` — `countDeficitDaysInWindow(loggedDays, targetKcal)`
  (compte absolu de jours en déficit ≥ `DEFICIT_ALERT_RATIO` sur une liste déjà bornée par
  l'appelant, jamais une proportion) et `computeOvertrainingGuard({ loadStreakDays,
  deficitDaysCount })` (R4 : `show` seulement si les deux seuils — streak ≥ 6, déficit ≥ 4 — sont
  atteints simultanément). Nouvelle constante `OVERTRAINING_DEFICIT_DAYS_REQUIRED`, distincte de
  `MIN_LOGGED_DAYS` (bodyweight.ts) malgré la valeur numérique identique (4) — sémantiques
  différentes, documenté en commentaire pour ne pas les confondre plus tard. 9 tests ajoutés.
- `apps/mobile/src/data/repositories/dashboard-repository.ts` — `useOvertrainingGuardAlert()` :
  agrège `useWorkoutHistory()`/`useRunHistory()` en jours à charge non nulle (`sessionLoad` par
  jour, 30 derniers jours), passe le tout à `computeStreak` (même primitive que le streak
  d'activité, TRI-01, réutilisée sur un ensemble de jours différent) ; combine avec
  `useDailyTotals()`/`useNutritionSummary().target` sur les 7 derniers jours calendaires pour le
  compte de déficit. Gating **tri-pilier** (`strength`+`running`+`nutrition`, les trois) — seule US
  de la famille garde-fou à en exiger 3.
- `apps/mobile/src/components/dashboard/OvertrainingGuardCard.tsx` (nouveau) — copie structurelle
  de `TrainingLoadAlertCard` (META-19) : `if (!alert.show) return null;`, ton `warn`, 3 formes, bloc
  `accessible` unique par forme.
- `packages/shared/src/widgets.ts` — `'overtraining-guard'` ajouté en fin de `HOME_WIDGET_IDS`
  (15 → 16) et à `WIDGET_REGISTRY.home.pillars` (`['strength', 'running', 'nutrition']`).
- i18n `home.overtrainingGuard.*` (eyebrow/title/message/recommend), FR + EN. Parité vérifiée
  (1644 clés de chaque côté).

#### Corrigé

- `packages/shared/src/widgets.test.ts` — 6 assertions `toHaveLength()`/valeurs codées en dur
  mises à jour pour refléter le 16ᵉ widget (registre, `defaultScreenLayout`, 3 scénarios
  `resolveScreenLayout`), + 1 nouveau test de gating tri-pilier.

#### Technique / Notes

- Quality gate complet : `npm run typecheck` (0 erreur), `npm run lint` (0 erreur), `npm run test`
  (67 fichiers / 1388 tests côté `packages/shared`, 50 suites / 269 tests côté `apps/mobile`).
- Aucune migration, aucune sync rule PowerSync à redéployer (aucune nouvelle table).
- Catalogue `analyses-donnees.md` mis à jour (TRI-12 🆕 → ✅), aucune ligne roadmap (US d'analyse).
  Les 3 déclinaisons identifiées par META-19 (RUN-18, MR-10, TRI-12) sont désormais toutes réglées.

### 02/08/2026 — `feature/tri12-garde-fou-global` — TRI-12 : entrée en pipeline (spec + plan + maquette, doc uniquement)

Dernier candidat ouvert de la famille garde-fou identifiée par META-19 (avec RUN-18 livrée et MR-10
absorbée). Aucun code, **aucune ligne roadmap** (US d'analyse, catalogue seul).

#### Ajouté

- [Spec](docs/specs/functional/us/tri12-garde-fou-global.md) — garde-fou tri-pilier combinant (a)
  un enchaînement de ≥ 6 jours à charge sans repos (réutilise `sessionLoad`/`computeStreak`) et (b)
  un déficit calorique persistant (≥ 4 des 7 derniers jours calendaires en déficit ≥ 15 %, seule la
  constante `DEFICIT_ALERT_RATIO` de MN-02 est réutilisée, le comptage par jour est neuf). Alerte
  **seulement si les deux signaux sont vrais** (R4) — ni un doublon d'ACWR, ni un doublon de MN-02.
  Gating tri-pilier (`strength`+`running`+`nutrition`), Tier 2 (ADR-007), même patron que
  `TrainingLoadAlertCard`.
- [Plan](docs/plans/tri12-garde-fou-global.md) — 2 étapes : `countDeficitDaysInWindow` +
  `computeOvertrainingGuard` (packages/shared, purs, testés d'abord, même fichier que
  `sessionLoad`) → hook `useOvertrainingGuardAlert` + `OvertrainingGuardCard` (copie structurelle de
  `TrainingLoadAlertCard`) → solde (catalogue seul).
- [Maquette](design/tri12-garde-fou-global/tri12-garde-fou-global.html) — le widget visible + les 3
  cas où il reste absent (un seul signal, gating incomplet) + une note explicite sur la coexistence
  possible avec `DeficitVolumeAlertCard`/`TrainingLoadAlertCard`.

#### Technique / Notes

- Relecture (agent) sur la spec initiale : 5 corrections apportées avant validation — réutilisation
  de MN-02 recadrée (seule la constante `DEFICIT_ALERT_RATIO` l'est, pas les fonctions, qui sont sur
  une moyenne hebdo et un seuil de volume muscu sans rapport), collision de valeur avec
  `MIN_LOGGED_DAYS` (bodyweight.ts) signalée et nommée distinctement, formulation « majorité »
  corrigée en compte absolu sur fenêtre fixe (avec cas limite explicité), limite connue sur les
  repas non loggés documentée comme héritée de MN-02 (pas un défaut nouveau), et coexistence des 3
  widgets d'alerte dashboard traitée explicitement plutôt que passée sous silence.
- Aucune migration, aucune nouvelle donnée (`workouts`/`runs`/`food_entries` déjà en base).

### 02/08/2026 — `docs/mr10-absorbee-meta19` — MR-10 marquée absorbée par META-19 (doublon de formulation)

Doc uniquement, aucun code.

#### Modifié

- [Catalogue](docs/product/analyses-donnees.md) — MR-10 (« Ratio charge aiguë:chronique, ACWR
  combiné ») 🆕 → ✅ absorbée par META-19 : sa description était quasi identique à META-19 (même
  méthode, mêmes deux piliers, mêmes fenêtres 7 j/28 j), sans nuance de portée ou de surfaçage —
  même type de doublon que MN-13/MN-06 (constaté le 28/07/2026). Note mise à jour sur les 3
  déclinaisons identifiées par META-19 : **RUN-18 livrée**, **MR-10 absorbée**, **TRI-12 non
  concernée** (combine charge + déficit nutritionnel persistant, vraie troisième dimension —
  candidat toujours ouvert).

### 02/08/2026 — `feature/run18-acwr-running` — RUN-18 : charge d'entraînement & ACWR (running seul)

Implémentation validée dans l'entrée précédente. Déclinaison running-seule de la brique ACWR posée
par META-19, affichée en Tier 1 (écran de stats du pilier) plutôt qu'en widget dashboard.

#### Ajouté

- `packages/shared/src/training-time.ts` — `AcwrZone` (`'low' | 'safe' | 'risk'`) et extension
  additive de `computeAcwr`/`AcwrResult` : nouveau champ `zone`, bornes inclusives côté zone saine
  (0,8 et 1,3 comptent comme « saine »). `showAlert` (consommé par META-19) inchangé. 3 tests
  ajoutés (zone par cas + les 2 bornes pile 0,8/1,3).
- `apps/mobile/src/app/running-history/index.tsx` — nouvelle section `TrainingLoadSection`, sous
  « Objectifs estimés » (RUN-14) : calcul inline à partir de `useRunHistory()` (aucun nouveau hook
  de repository), fenêtres 7 j / 28 j via `useWindowStartKey`, délégation à `computeAcwr` sur les
  seules courses. Affiche les 3 zones dans tous les cas (contrairement au widget dashboard de
  META-19, qui reste conditionnel) ; absente si aucune course sur 28 jours (R5, convention
  « absent, jamais zéro »). Ligne accessible unique (label + zone + ratio), pattern déjà utilisé par
  `PredictionsSection` (`accessible` sur une `View` non-`Pressable`).
- i18n `running.trainingLoad.*` (title/ratioLabel/zoneLow/zoneSafe/zoneRisk/empty), FR + EN. Parité
  vérifiée (1640 clés de chaque côté).

#### Technique / Notes

- Quality gate complet : `npm run typecheck` (0 erreur), `npm run lint` (0 erreur), `npm run test`
  (67 fichiers / 1379 tests côté `packages/shared`, 50 suites / 269 tests côté `apps/mobile`).
- Aucune migration, aucune sync rule PowerSync à redéployer (aucune nouvelle table, `runs` déjà
  synchronisée).
- Catalogue `analyses-donnees.md` mis à jour (RUN-18 🆕 → ✅), aucune ligne roadmap (US d'analyse).

### 02/08/2026 — `feature/run18-acwr-running` — RUN-18 : entrée en pipeline (spec + plan + maquette, doc uniquement)

Déclinaison running-seule du garde-fou ACWR (META-19, livré juste avant). Aucun code, **aucune
ligne roadmap** (US d'analyse, catalogue seul — même règle que META-19).

#### Ajouté

- [Spec](docs/specs/functional/us/run18-acwr-running.md) — réutilise `sessionLoad`/`computeAcwr`
  (posés par META-19) sur les seules courses. **Surfaçage Tier 1** (écran `running-history`, à la
  demande) et non Tier 2 dashboard : évite la redite avec l'alerte combinée de META-19 et affiche
  les **3 zones** (basse/saine/risque), pas un simple booléen d'alerte. Seuil aligné sur 1,3
  (méthode déjà validée par META-19), écart assumé avec le « 1,5 » du catalogue (non sourcé pour un
  cas « course seule » distinct — même type de correction que le R5 de META-19 sur une formulation
  trop large du catalogue).
- [Plan](docs/plans/run18-acwr-running.md) — 2 étapes : extension additive de `computeAcwr` (ajout
  du champ `zone`, sans toucher `showAlert` ni la signature) → section `TrainingLoadSection` dans
  `running-history/index.tsx` (calcul inline, même patron que `PredictionsSection`/RUN-14, pas de
  nouveau hook de repository) → solde (catalogue seul).
- [Maquette](design/run18-acwr-running/run18-acwr-running.html) — les 4 états (zone basse, zone
  saine, zone de risque, pas de base de comparaison) + le rappel des 4 différences avec le widget
  dashboard de META-19.

#### Technique / Notes

- Relecture (agent) sur la spec initiale : 5 corrections apportées avant validation — bornes de
  zone tranchées explicitement (comparaisons inclusives 0,8/1,3, alignées sur le code), format du
  ratio précisé (2 décimales, sans formatage localisé), critère de recette sur le seuil déplacé vers
  les tests unitaires (non vérifiable sur device), critère RPE manquant reformulé en scénario
  intra-compte, et surtout : **le patron d'accessibilité `RecordsSection` n'était pas transposable
  tel quel** (ses lignes sont des `Pressable`, accessibles par un mécanisme que cette section
  n'aura pas — lignes `View`/`Text` pures nécessitant un `accessible` explicite).
- Aucune migration, aucune nouvelle donnée (`runs.rpe`/`durationSeconds`/`finishedAt` déjà en base).

### 02/08/2026 — `feature/meta19-acwr-garde-fou` — META-19 : garde-fou surentraînement (ACWR combiné)

Implémentation du garde-fou validé dans l'entrée précédente. Widget conditionnel Tier 2 (ADR-007) :
**15ᵉ entrée de `HOME_WIDGET_IDS`**, mais rendu `null` hors de la zone de risque — jamais un ajout
permanent au plafond Tier 0.

#### Ajouté

- `packages/shared/src/training-time.ts` — `sessionLoad(session)` (RPE × durée en minutes, méthode
  session-RPE de Foster ; séance sans RPE ou sans durée → 0, ni ignorée ni inventée) et
  `computeAcwr({ acuteSessions, chronicSessions })` (charge aiguë 7 j ÷ charge chronique 28 j ;
  `null` si aucune charge chronique — pas de division par une base vide ; `showAlert` uniquement au-
  dessus du seuil de risque 1,3, jamais pour la zone basse). 7 tests.
- `apps/mobile/src/data/repositories/dashboard-repository.ts` — `useTrainingLoadAlert()` : compose
  `useWorkoutHistory()` + `useRunHistory()` (déjà chargés ailleurs sur le dashboard, aucune nouvelle
  requête), filtre par `finishedAt` sur les fenêtres 7 j / 28 j (`useWindowStartKey`, même patron que
  `useTrainingTime`), délègue à `computeAcwr`. Gating `['strength', 'running']` — l'ACWR combine les
  deux piliers, un seul actif ne donnerait qu'une moitié du calcul.
- `apps/mobile/src/components/dashboard/TrainingLoadAlertCard.tsx` (nouveau) — copie structurelle de
  `DeficitVolumeAlertCard` : `if (!alert.show) return null;`, ton `warn`, 3 formes. Accessibilité :
  bloc `accessible` unique par forme (titre + message + recommandation), pas des `Text` disjoints
  (spec §7).
- `packages/shared/src/widgets.ts` — `'training-load'` ajouté en fin de `HOME_WIDGET_IDS` (14→15) et
  à `WIDGET_REGISTRY.home.pillars` (`['strength', 'running']`).
- `apps/mobile/src/components/dashboard/dashboard-widgets.tsx` — `'training-load': TrainingLoadAlertCard`
  dans `WIDGET_COMPONENTS`.
- i18n `home.trainingLoad.*` (eyebrow/title/message/recommend), FR + EN, ton factuel (spec §7 : pas
  de mot comme « échec » ou « danger »). Parité FR/EN vérifiée (1634 clés de chaque côté).

#### Corrigé

- `packages/shared/src/widgets.test.ts` — 5 assertions `toHaveLength()` codées en dur (14→15) mises à
  jour pour refléter le 15ᵉ widget : registre (accueil), `defaultScreenLayout`, et 3 scénarios de
  `resolveScreenLayout` (stored=null, cycle masqué, cycle affiché).

#### Technique / Notes

- Quality gate complet : `npm run typecheck` (0 erreur), `npm run lint` (0 erreur), `npm run test`
  (67 fichiers / 1377 tests côté `packages/shared`, 50 suites / 269 tests côté `apps/mobile` —
  lus sans pipe pour ne pas masquer un code de sortie non nul).
- Aucune migration, aucune sync rule PowerSync à redéployer (aucune nouvelle table).

### 02/08/2026 — `feature/meta19-acwr-garde-fou` — META-19 : entrée en pipeline (spec + plan + maquette, doc uniquement)

Seul candidat encore ouvert de la liste de priorisation officielle du catalogue d'analyses — aucun
code, **aucune ligne roadmap** (règle appliquée correctement cette fois, cf. commit précédent).

#### Ajouté

- [Spec](docs/specs/functional/us/meta19-acwr-garde-fou.md) — garde-fou surentraînement, ACWR
  combiné (charge aiguë 7 j ÷ charge chronique 28 j, méthode session-RPE de Foster). **Surfaçage
  ADR-007 déclaré explicitement (Tier 2, conditionnel)** : ce n'est pas un 15ᵉ widget permanent du
  dashboard, il se replie hors de la zone de risque — même patron que `DeficitVolumeAlertCard`
  (MN-02). Écart assumé par rapport à la formulation du catalogue : **seule la zone haute
  (ACWR > 1,3) déclenche l'alerte** — la zone basse (< 0,8) signale un sous-entraînement, pas un
  risque de surcharge, et suggérer un repos y serait contradictoire (R5).
- [Plan](docs/plans/meta19-acwr-garde-fou.md) — 2 étapes : `sessionLoad`/`computeAcwr`
  (packages/shared, purs, testés d'abord, même fichier que `computeTrainingTime`) → hook
  `useTrainingLoadAlert` (même patron que `useDeficitVolumeAlert`) + `TrainingLoadAlertCard`
  (copie structurelle de `DeficitVolumeAlertCard`) → solde (catalogue seul).
- [Maquette](design/meta19-acwr-garde-fou/meta19-acwr-garde-fou.html) — le widget visible (zone de
  risque) + les 3 cas où il disparaît (zone saine, zone basse hors périmètre, pas de charge
  chronique).

#### Technique / Notes

- Brique commune explicitement identifiée par le catalogue pour 3 candidats non cadrés (RUN-18,
  MR-10, TRI-12) — les construire plus tard sera moins cher une fois `computeAcwr` en place.
- Aucune migration, aucune dépendance native, aucune nouvelle requête réseau (réutilise
  `useWorkoutHistory`/`useRunHistory` déjà chargés ailleurs sur le dashboard).
- `etape: validation` — en attente de Florian/Damien avant tout code.

### 02/08/2026 — `docs/catalogue-statuts-run14-nutr16-musc09` — Correction : statut catalogue de RUN-14/NUTR-16/MUSC-09

Constat en cherchant un numéro roadmap pour META-19 : `docs/roadmap/roadmap.md` documente
explicitement que les **US d'analyse** (catalogue) ne reçoivent **jamais** de ligne roadmap — leur
statut vit uniquement dans [analyses-donnees.md](docs/product/analyses-donnees.md), pour ne pas
dupliquer un backlog dans l'autre. RUN-14, NUTR-16 et MUSC-09 sont des US d'analyse et ont pourtant
reçu une ligne (5.34/4.38/3.56) — la règle a été retrouvée *après coup*.

#### Corrigé

- [analyses-donnees.md](docs/product/analyses-donnees.md) — statut de RUN-14, NUTR-16, MUSC-09
  passé 🆕 → ✅ avec une note de ce qui est livré (jusqu'ici toujours affiché 🆕, activement
  trompeur pour quiconque consulte ce fichier comme source de vérité).
- [roadmap.md](docs/roadmap/roadmap.md) — note ajoutée sous l'exclusion des US d'analyse,
  documentant l'exception constatée. Les 3 lignes roadmap (5.34/4.38/3.56) **ne sont pas retirées** :
  les défaire aurait exigé de désosser plusieurs commits de récapitulatif déjà poussés, un risque
  plus élevé que la duplication elle-même une fois documentée.

#### Technique / Notes

- **META-19 et toute US d'analyse suivante suivront la règle correctement** : catalogue seul,
  aucune nouvelle ligne roadmap.

### 02/08/2026 — `feature/musc09-record-plage-reps` — MUSC-09 : record par plage de reps livré (3.56, en recette)

Commit précédent : `2215558`. Validation reçue (« ok go ») sur les 3 livrables — code implémenté
directement.

#### Ajouté

- [records.ts (shared)](packages/shared/src/records.ts) — `REP_BUCKETS` (6 plages fixes, bornes en
  intervalles plutôt que valeurs exactes — une série réelle tombe rarement pile sur les ancres du
  catalogue) et `resolveRepBucketRecords(sets)` : bucketing pur, égalité de charge → la série la
  plus récente gagne, plage sans série qualifiante absente du résultat (pas une ligne à 0), ordre
  figé sur `REP_BUCKETS`. 7 tests, dont la couverture totale du spectre 1..30 sans trou ni
  chevauchement.
- [records-repository.ts](apps/mobile/src/data/repositories/records-repository.ts) —
  `useExerciseRepRanges(exerciseId)` (même patron que `useExerciseTopSingle`, sans le filtre
  `reps = 1`) ; `ExerciseFicheRecords` étendu d'un champ `repRanges`, composé dans
  `useExerciseFicheRecords` au même titre que les 3 records existants.
- [id].tsx](apps/mobile/src/app/exercises/[id].tsx) — nouvelle section « Force par plage de reps »
  sous les 3 tuiles de records existantes, réutilisant `formatRecordDate`/`units.formatWeight`
  déjà présents dans ce fichier. Chaque ligne est un bloc `accessible` unique.
- 8 clés `exercises.detail.records.repRanges.*`, FR+EN.

#### Technique / Notes

- **Aucune migration** — `workout_sets` déjà en base, calcul pur en lecture. Recettable sur l'APK
  existant. `personal_records` (table des 3 records existants) n'est pas touchée.
- `npm run typecheck` / `npm run lint` / `npm run test` (mobile Jest 50 suites/269 tests + shared
  Vitest 67 fichiers/**1369** tests, +7) — lus sans pipe, tous verts. Parité i18n FR/EN vérifiée
  (1657 clés).
- Roadmap 3.56 → ✅ (V0.3 : 20 livré / 0 à faire). RECETTES.md #23 créée, 8 critères.

### 02/08/2026 — `feature/musc09-record-plage-reps` — MUSC-09 : entrée en pipeline (spec + plan + maquette, doc uniquement)

Candidat du [catalogue d'analyses](docs/product/analyses-donnees.md) promu via `/us` — aucun code.

#### Ajouté

- [Spec](docs/specs/functional/us/musc09-record-plage-reps.md) — record personnel par plage de
  répétitions (1/3/5/8/10/12+), complément aux 3 records déjà affichés sur la fiche exercice (1RM,
  charge max, meilleur volume). **Bornes de plage fixées** (§1, pas des valeurs exactes) : une
  série réelle tombe rarement pile sur l'ancre du catalogue, des plages couvrant tout le spectre
  sans trou ni chevauchement sont nécessaires. Même éligibilité de série que le reste du système
  de records (R3, `done`/`set_type`/`weight_kg` — pas une règle inventée), plage jamais travaillée
  absente plutôt qu'à 0 (R4, même convention que NUTR-16), ordre fixe 1→12+ (R6).
- [Plan](docs/plans/musc09-record-plage-reps.md) — 2 étapes : `resolveRepBucketRecords`
  (packages/shared, pur, testé d'abord) + nouvelle requête (même patron que
  `SELECT_EXERCISE_TOP_SINGLE`, sans le filtre `reps = 1`) → section sous les tuiles de records
  existantes de la fiche exercice. **Aucune migration.**
- [Maquette](design/musc09-record-plage-reps/musc09-record-plage-reps.html) — 2 états : historique
  riche (4 plages sur 6 présentes) · exercice jamais logué avec charge+reps (état vide).

#### Technique / Notes

- ⚠️ Cette entrée du catalogue **n'avait aucune ligne roadmap** : le lien qu'elle portait vers 6.3
  était erroné (6.3 = accès démo pendant la séance, ❌ abandonné avec les GIF, sans rapport).
  **3.56 créée** (V0.3 — Muscu : programmes, historique & records, section thématique exacte).
- `etape: validation` — en attente de Florian/Damien sur les 3 livrables avant tout code.

### 02/08/2026 — `feature/nutr16-repartition-repas` — NUTR-16 : répartition calorique par repas livrée (4.38, en recette)

Commit précédent : `68781e9`. Validation reçue (« ok let's go ») sur les 3 livrables — code
implémenté directement.

#### Ajouté

- [nutrition.ts (shared)](packages/shared/src/nutrition.ts) — `resolveMealSplit(mealTotals,
  configuredMeals, loggedDays)` : distribue les totaux de kcal groupés sur la **clé réelle** de
  `meal_type` (jamais `MEAL_TYPES`, obsolète comme liste exhaustive depuis les repas personnalisés)
  vers les repas configurés, route le reste vers `OTHER_MEAL_KEY` (toujours en dernier). Calcule
  part (%) et moyenne kcal/jour (diviseur = jours **renseignés**, pas la longueur de la fenêtre —
  même convention qu'`averageIntake`). Un repas configuré sans aucune entrée dans la fenêtre est
  **absent** du résultat, pas une ligne à 0 %. 8 tests, dont le filtre bucket « Autres »/ordre figé
  (le plus important) et la non-division-par-zéro.
- [journal-repository.ts](apps/mobile/src/data/repositories/journal-repository.ts) —
  `useMealTotals(sinceDate)` : même patron que `useDailyTotals`, `GROUP BY meal_type` au lieu de
  `GROUP BY log_date`.
- [nutrition-stats.tsx](apps/mobile/src/app/nutrition-stats.tsx) — section « Répartition par
  repas » sous « Apports moyens », **même toggle 7 j/30 j** (pas un 2ᵉ sélecteur), `totals.length`
  déjà calculé réutilisé comme diviseur (pas une 2ᵉ requête). Résolution de libellé identique au
  journal ((tabs)/nutrition.tsx) : repas custom sans nom → « Repas N » (position parmi les repas
  configurés), bucket via `journal.meals.other`. Chaque ligne est un bloc `accessible` unique.
- 2 clés `stats.mealSplit.*`, FR+EN.

#### Technique / Notes

- **Aucune migration** — `food_entries`/`nutrition_profiles` déjà en base, calcul pur en lecture.
  Recettable sur l'APK existant.
- `npm run typecheck` / `npm run lint` / `npm run test` (mobile Jest 50 suites/269 tests + shared
  Vitest 67 fichiers/**1362** tests, +8) — lus sans pipe, tous verts. Parité i18n FR/EN vérifiée
  (1649 clés).
- Roadmap 4.38 → ✅ (V0.4 : 32 livré / 2 à faire). RECETTES.md #22 créée, 9 critères.

### 02/08/2026 — `feature/nutr16-repartition-repas` — NUTR-16 : entrée en pipeline (spec + plan + maquette, doc uniquement)

Candidat du [catalogue d'analyses](docs/product/analyses-donnees.md) promu via `/us` — aucun code.

#### Ajouté

- [Spec](docs/specs/functional/us/nutr16-repartition-calorique-repas.md) — répartition calorique
  par repas : part (%) **et** moyenne absolue (kcal/jour) par repas, sur la fenêtre 7 j/30 j déjà
  présente sur l'écran de stats nutrition. **Piège de lecture documenté (§0)** :
  `MEAL_TYPES = ['breakfast','lunch','dinner','snack']` n'est **plus** la contrainte réelle de
  `food_entries.meal_type` depuis la migration `20260707140000_nutrition_meals` (repas
  personnalisés, item 4.15) — grouper par cette liste fixe ignorerait les repas renommés/ajoutés.
  R2 impose de grouper par la clé réelle et de résoudre le libellé via `resolveMealConfig`, déjà
  éprouvé par le journal. R3 route les entrées orphelines vers le bucket « Autres » existant
  (`journal.meals.other`), R4 fige l'ordre d'affichage sur celui des repas configurés.
- [Plan](docs/plans/nutr16-repartition-calorique-repas.md) — 3 étapes : `resolveMealSplit`
  (packages/shared, pur, testé d'abord) + nouvelle requête `SELECT_MEAL_TOTALS` (même patron que
  `SELECT_DAILY_TOTALS`) → section sous « Apports moyens » (aucun nouveau toggle) → solde. **Aucune
  migration.**
- [Maquette](design/nutr16-repartition-calorique-repas/nutr16-repartition-calorique-repas.html) —
  2 états : les 4 repas par défaut · un repas renommé (« Brunch ») + entrées orphelines groupées
  sous « Autres ».

#### Technique / Notes

- ⚠️ **Collision de numéro trouvée en cherchant un numéro libre pour cette US** : `4.37` est utilisé
  deux fois dans la roadmap (NUTR-F2 en V0.9, refonte visuelle du journal en Hors périmètre) — même
  défaut que la collision déjà connue sur 4.5/4.36. **Non corrigée** (hors scope), notée dans
  BACKLOG.md pour un futur `/reconcilier`.
- Roadmap : **4.38 créée** (V0.4 — Alimentation), candidat né après le cadrage. `etape: validation`
  — en attente de Florian/Damien sur les 3 livrables avant tout code.

### 02/08/2026 — `feature/run14-prediction-riegel` — RUN-14 : prédiction de temps de course livrée (5.34, en recette)

Commit précédent : `d6d83b2`. Validation reçue (« ok go ») sur les 3 livrables — code implémenté
directement, la spec avait déjà tranché toutes les questions produit.

#### Ajouté

- [pace-records.ts (shared)](packages/shared/src/pace-records.ts) — `predictRaceTime(t1Seconds,
  d1Meters, d2Meters)` (formule de Riegel, cas limite `d1 === d2` → identité) et
  `resolveRacePredictions(records)` : source fixe = record des 5 km (R1, `[]` si absent), 3
  distances cibles (10 km/semi/marathon) **filtrées** de celles ayant déjà un vrai record dans
  `records` (R3 — le test le plus important de cette US, une seule ligne de filtre à ne pas casser).
  7 tests : formule vs règle de trois naïve, cas limite, croissance non linéaire, et les 4
  combinaisons de R1/R3.
- [running-history/index.tsx](apps/mobile/src/app/running-history/index.tsx) — nouvelle section
  « Objectifs estimés » sous les records existants (`PredictionsSection`), recalculée à chaque
  affichage (`useRunningRecords()` déjà réactif + fonction pure → un nouveau record 5 km met à jour
  les 3 lignes sans code supplémentaire). Réutilise `RECORD_DISTANCE_KEY`/`isoToDate`/
  `formatDurationHms` déjà en place dans ce fichier — aucun nouveau formateur. La ligne marathon
  porte l'avertissement R5 dans le **même bloc accessible** (`accessible` sur la `View`), pas une
  info-bulle séparée.
- 4 clés `running.predictions.*`, FR+EN.

#### Technique / Notes

- **Aucune migration, aucune dépendance native** — donnée déjà en base
  (`running_pace_records`, alimentée par `detectAndStoreRunRecords`), calcul pur. Recettable sur
  l'APK existant.
- `npm run typecheck` / `npm run lint` / `npm run test` (mobile Jest 50 suites/269 tests + shared
  Vitest 67 fichiers/**1354** tests, +7) — lus sans pipe, tous verts. Parité i18n FR/EN vérifiée
  (1647 clés).
- Roadmap 5.34 → ✅ (V0.5 : 28 livré / 4 à faire). RECETTES.md #21 créée, 9 critères.

### 02/08/2026 — `feature/run14-prediction-riegel` — RUN-14 : entrée en pipeline (spec + plan + maquette, doc uniquement)

Candidat du [catalogue d'analyses](docs/product/analyses-donnees.md) promu via `/us` — aucun code.

#### Ajouté

- [Spec](docs/specs/functional/us/run14-prediction-riegel.md) — prédiction de temps de course
  (formule de Riegel, `T2 = T1×(D2/D1)^1,06`) depuis le record des **5 km** (source fixe, R1 —
  réutilise la convention déjà établie par `ref5kPaceSPerKm`/VMA, pas une nouvelle notion de
  référence). Règle centrale : **R3** — si un vrai record existe déjà pour une distance cible
  (10 km/semi/marathon), sa prédiction ne s'affiche pas, la vraie donnée prime toujours sur une
  estimation. **R5** — avertissement dédié sur le marathon (ratio d'extrapolation ≈8,4×, hors de la
  zone où Riegel reste fiable).
- [Plan](docs/plans/run14-prediction-riegel.md) — 3 étapes : `predictRaceTime` +
  `resolveRacePredictions` (packages/shared, purs, testés d'abord) → nouvelle section
  « Objectifs estimés » sous les records existants (`running-history/index.tsx`, aucune nouvelle
  route) → solde. **Aucune migration, aucune dépendance native** : donnée déjà en base
  (`running_pace_records`), calcul pur.
- [Maquette](design/run14-prediction-riegel/run14-prediction-riegel.html) — 3 états à valider :
  record 5 km seul (3 prédictions) · 5 km + record semi réel (R3 masque la ligne semi) · aucun
  record 5 km (état vide).

#### Technique / Notes

- Roadmap : **5.34 créée** (V0.5 — Running), candidat né après le cadrage, aucun numéro existant à
  réutiliser. `etape: validation` — en attente de Florian/Damien sur les 3 livrables avant tout code.
- Aucun test, aucune ligne applicative modifiée (US bloquée avant l'étape 5 du workflow, CLAUDE.md).

### 02/08/2026 — `fix/dette-analytics-tests-cycle` — Dette analytics (US 9.10) : dépendance circulaire détricotée + tests de gating

Commit précédent : `a311fa7`. Dernier item repris de la liste « Dette & suivi technique ».

#### Modifié

- [settings-repository.ts](apps/mobile/src/data/repositories/settings-repository.ts) —
  `togglePillar` **n'importe plus `@/lib/analytics`** (qui importe lui-même `getAnalyticsEnabled`
  d'ici → c'était le cycle). Retourne désormais `{ activated: boolean }` ; c'est l'appelant qui
  décide de tracker `pillarActivated`, uniquement à l'activation.
- [(onboarding)/pillars.tsx](apps/mobile/src/app/(onboarding)/pillars.tsx) et
  [settings.tsx](apps/mobile/src/app/settings.tsx) — les deux call sites de `togglePillar`
  enchaînent désormais `.then(({ activated }) => ...)` pour émettre l'événement, comportement
  utilisateur strictement inchangé.
- [(onboarding)/intro.tsx](apps/mobile/src/app/(onboarding)/intro.tsx) — garde `useRef` sur
  l'effet qui émet `onboarding_started` : le doublon observé en dev était un artefact React
  StrictMode (effet à double-invocation), pas un vrai bug de tracking. La garde rend la question
  sans objet plutôt que d'attendre une confirmation sur build de prod.

#### Ajouté

- [analytics.test.ts](apps/mobile/src/lib/__tests__/analytics.test.ts) — 4 tests sur `track()`
  (jusqu'ici seuls les helpers purs `sanitizeProps`/`buildEventRow` l'étaient) : écrit si
  session + consentement ON, no-op si OFF, no-op si pas de session **sans même consulter le
  consentement**, et surtout **ne jette jamais** même si l'écriture échoue (garantie best-effort
  du service, jusqu'ici non vérifiée).

#### Technique / Notes

- `app_version` était déjà réelle depuis le 30/07/2026 (`app.json` → `1.0.0`) — rien à faire, item
  du même point de dette déjà clos.
- `npm run typecheck` / `npm run lint` / `npm run test` (mobile Jest 50 suites/**269** tests, +4 —
  shared Vitest 67 fichiers/1347 tests) — lus sans pipe, tous verts.
- Aucune ligne roadmap (dette hors US, pas de numéro thématique). BACKLOG.md : item « Suivi
  analytics (US 9.10) » clos.

### 02/08/2026 — `fix/planning-preview-pillar-label` — Widget planning cross-pilier : ambiguïté levée (décision Florian)

Commit précédent : `6f0fc5d`. Point ouvert du BACKLOG tranché par Florian : le widget « Planning »
du hub Muscu montrant une séance de course (et vice versa sur le hub Running) est **voulu** —
cohérent avec le planning unifié (US 3.9), les deux widgets pointent vers le même `/planning`. Seule
l'ambiguïté constatée en recette (« Prochaine : Fractionné (VMA) » sous l'en-tête *Musculation*,
sans repère de pilier) restait à corriger.

#### Modifié

- [PlanningPreview.tsx](apps/mobile/src/components/PlanningPreview.tsx) — `sessionLabel` préfixe
  désormais chaque libellé par son pilier (« Musculation · … » / « Course · … »), sur la ligne
  « Prochaine » (forme `small`) et la liste des prochaines séances (forme `large`). Même convention
  que le chip de pilier déjà affiché sur l'écran `/planning` (texte, pas seulement une couleur de
  pastille — accessible).

#### Technique / Notes

- Composant purement présentationnel, utilisé identiquement par `StrengthPlanningWidget` et
  `RunningPlanningWidget` (aucun prop de pilier « hôte » à threader) : le préfixe s'applique donc
  aux deux hubs, symétriquement.
- `npm run typecheck` / `npm run lint` / `npm run test` (mobile Jest 50 suites/265 tests + shared
  Vitest 67 fichiers/1347 tests) — lus sans pipe, tous verts. Aucun test n'exerçait `sessionLabel`
  ou `previewNext` textuellement, aucune régression à corriger.
- Aucune ligne roadmap (dette hors US, pas de numéro thématique).

### 02/08/2026 — `fix/dette-technique-ecrans-a11y-seed` — Dette technique : 3 items déjà corrigés reconciliés, a11y + seed.sql traités

Pendant que les 20 US en recette attendent la vérification device de Florian/Damien : passe sur
la liste « 🧹 Dette & suivi technique » du BACKLOG. Deux constats en relisant le code avant de
corriger (Étape 0 du plan, comme d'habitude) : 2 des 4 items étaient **déjà corrigés** par un
commit antérieur (`936ec81`, 30/07/2026) sans que le BACKLOG ne soit mis à jour — reconciliés
plutôt que retravaillés.

#### Corrigé

- [food-custom.tsx](apps/mobile/src/app/food-custom.tsx) — les 9 chips de catégorie (`FOOD_CATEGORIES.map`)
  gagnent `accessibilityRole="button"`, `accessibilityLabel` et `accessibilityState={{selected}}` :
  seul le libellé visuel adjacent portait l'information jusqu'ici.
- [Segment.tsx](apps/mobile/src/components/Segment.tsx) — `accessibilityLabel` ajouté sur chaque
  option. Composant partagé (sexe, objectif, thème, unités, intensité…) : corrige d'un coup le
  point relevé sur `profile.tsx` **et** tous ses autres usages dans l'app.
- [recipe-edit.tsx](apps/mobile/src/app/recipe-edit.tsx) — bouton « Ajouter un ingrédient » gagne
  `accessibilityRole`/`Label`.
- [Button.tsx](apps/mobile/src/components/Button.tsx) — **`accessibilityLabel` retombe désormais sur
  `label` par défaut** (`accessibilityLabel ?? label`) au lieu de rester `undefined` sans override
  explicite. C'était la vraie cause du point relevé sur `account-delete.tsx` : sans ce défaut, un
  bouton en `loading` (texte visible remplacé par le spinner) n'a **aucun** nom accessible. Corrige
  ce composant partout où il est utilisé sans `accessibilityLabel` explicite, pas seulement là.
- `supabase/seed.sql` → **migration idempotente**
  ([20260802055147_debt_seed_exercices_programme_placeholder.sql](supabase/migrations/20260802055147_debt_seed_exercices_programme_placeholder.sql)),
  même patron que le seed CIQUAL : les 16 exercices de bibliothèque + le programme placeholder
  « Full Body Débutant » (US1/US2 du seed) étaient déjà sur le cloud par un chemin non tracé
  (`seed.sql` n'est joué que par `db:reset`, qui exige Docker — absent chez les deux devs).
  `seed.sql` réduit à un pointeur vers la migration.

#### Technique / Notes

- ⚠️ **1ʳᵉ tentative de migration en échec** : `on conflict (id) do nothing` sur
  `exercise_translations` n'a pas suffi — les lignes déjà en base portent des `id` différents des
  UUID déterministes du seed, mais le même `(exercise_id, lang)` (contrainte unique réelle).
  Conflit levé sur la mauvaise colonne cible. Corrigé en `on conflict (exercise_id, lang)`.
  **Transaction annulée proprement par le CLI** (une erreur = rollback de cette migration, comme
  documenté dans CLAUDE.md) — aucune ligne partielle, aucune donnée dupliquée. Poussée avec succès
  à la 2ᵉ tentative.
- Reconciliation BACKLOG : `run/active` (état vide sans course) et `planning/plan` (cul-de-sac sur
  programme invalide) étaient déjà corrigés par `936ec81` — entrées cochées, pas retravaillées.
  Le point ouvert « widget planning cross-pilier » (décision produit) reste en l'état, non tranché.
- `npm run typecheck` / `npm run lint` / `npm run test` (mobile Jest 50 suites/265 tests + shared
  Vitest 67 fichiers/1347 tests) — lus sans pipe, tous verts, aucune régression.
- Aucune ligne roadmap (dette hors US, pas de numéro thématique).

### 02/08/2026 — `feature/muscf1b-schema-muscles` — MUSC-F1b : schéma corporel, anatomie fine (6.2 livrée)

Commit précédent : `a293ba8`. Dernière des 4 US validées ce lot (« Oui, go ») — la plus grosse,
traitée en dernier. Recadrage Voie B (anatomie fine) décidé par Florian le 01/08/2026, contre la
recommandation initiale de la spec (Voie A) : voir le commit doc `3d2acd1` pour le raisonnement
complet (18 fichiers consommaient déjà les 6 groupes larges, d'où le design additif).

#### Ajouté

- [exercise.ts (shared)](packages/shared/src/exercise.ts) — `FINE_MUSCLES` (10 clés, référentiel
  repris tel quel d'`administration.md` §3.3, jamais implémenté), `FINE_MUSCLE_VIEWS`,
  `BROAD_TO_FINE`, `normalizeFineMuscles`, et **3 fonctions pures de résolution** :
  `resolveFineMuscles` (un exercice), `resolveSessionFineMuscles` (union sur une séance, sans
  doublon d'émphase), `resolveTonnageFineMuscles` (bilan hebdo, tonnage agrégé par muscle fin,
  silhouette neutre si semaine vide — 22 tests au total pour les 3).
- Migration additive `exercises.muscles_fine jsonb not null default '[]'`, **indépendante** de
  `muscles_secondary` (deux champs distincts, aucun invariant d'exclusion). **Aucune sync rule à
  redéployer** (`exercises` déjà en `select *`).
- [BodyMap.tsx](apps/mobile/src/components/body/BodyMap.tsx) (**nouveau**) — silhouette muette,
  deux vues (face/dos, 11 tracés au total — épaules sur les deux), coordonnées reprises de la
  maquette validée. Deux niveaux d'émphase (`full`/`reduced`), un muscle non sollicité reste
  **neutre**, jamais éteint (R2).
- **3 points de montage**, un seul chemin de rendu (`resolveFineMuscles` et dérivées) :
  fiche d'exercice ([\[id\].tsx](apps/mobile/src/app/exercises/[id].tsx)), aperçu de séance avant
  démarrage ([programs/\[id\].tsx](apps/mobile/src/app/programs/[id].tsx), union par séance),
  bilan hebdomadaire ([review.tsx](apps/mobile/src/app/review.tsx), nouvelle requête
  `SELECT_EXERCISE_TONNAGE` **additive et indépendante** de `SELECT_MUSCLE_SETS` — celle-ci reste
  intouchée, elle alimente `computeMuscleBalance` sur les 6 groupes larges).
- Écran admin ([ExerciseEditScreen.tsx](apps/admin/src/screens/ExerciseEditScreen.tsx)) — section
  « Muscles fins (optionnel) », 10 checkboxes groupées par région (Haut du corps / Bas du corps /
  Tronc) plutôt qu'un mur en vrac.
- 10 clés `muscleFine.*` + 4 `bodyMap.*`, FR+EN.

#### Technique / Notes

- **Design additif (spec §0)** : les 6 groupes larges (`musclePrimary`/`musclesSecondary`) ne
  bougent pas — aucun des 18 fichiers qui les consomment (alerte déséquilibre, filtre bibliothèque,
  remplacement d'exercice, graphique de volume, écran admin) n'est touché.
- `apps/mobile/src/powersync/connector.ts` — `muscles_fine` ajoutée à `JSON_COLUMNS.exercises`
  (leçon CYCLE-01 : une colonne JSON absente de cette liste échoue silencieusement à l'écriture).
- Aucune dépendance native neuve (`react-native-svg` déjà présent) → recettable sur l'APK existant.
- `npm run typecheck` / `npm run lint` / `npm run test` (mobile Jest 50 suites/265 tests + shared
  Vitest 67 fichiers/1347 tests) — lus sans pipe, tous verts. Parité i18n FR/EN vérifiée
  (1643 clés).
- Le tagging fin des 16 exercices existants reste **hors dev** (travail de coach, ~1-2h) : le code
  fonctionne en repli large tant qu'il n'est pas fait, et s'améliore exercice par exercice.
- Roadmap 6.2 → ✅ (V0.2 complet : 29 livré / 0 à faire hors abandons). RECETTES.md #20 créée,
  13 critères — dont le critère 12 (relecture anatomique des 11 tracés), seul point qu'un agent ne
  peut pas franchir.

### 01/08/2026 — `feature/muscf9-planning-glisser-deposer` — MUSC-F9 : glisser-déposer d'une séance planifiée (3.10 livrée)

Commit précédent : `1773aaf`. Consolidation des 4 validations (« Oui, go ») reçues pour CONF-07,
RUN-F3, MUSC-F9, MUSC-F1b — traité dans l'ordre du plus simple au plus gros. Front-matter
`etape: recette` (spec §7, 11 critères device).

#### Ajouté

- [drop-target.ts (shared)](packages/shared/src/drop-target.ts) — `findDropTarget(y, zones)`, pur :
  jour dont la zone `[y, y+height)` contient la coordonnée testée, `null` hors de toute zone (dépôt
  annulé, R6). 7 tests, dont les bornes exactes (une frontière ne matche jamais deux zones à la fois).
- [planning/index.tsx](apps/mobile/src/app/planning/index.tsx) — geste `Gesture.Pan()` sur chaque
  carte de séance (`activateAfterLongPress(200)`, plus court que les 700 ms du réagencement du
  dashboard car la liste ne défile pas sur la même zone) : élévation visuelle au doigt
  (`useAnimatedStyle`/`reanimated`), retour haptique à la prise et au dépôt (D3, `expo-haptics`),
  toast de confirmation, surbrillance de la zone survolée.
- Les zones de dépôt sont mesurées **à chaque début de geste** (`measureInWindow`, coordonnées
  écran absolues), pas une fois au montage — ce qui les garde justes même après un défilement
  vertical, sans avoir à suivre l'offset de scroll explicitement (aucun auto-défilement, D2-option 1).
- Indice textuel `planning.dragHint` au-dessus de la grille + `planning.movedTo` dans le toast,
  FR+EN. Les 3 boutons de report existants **restent en place** (chemin accessible sous TalkBack,
  R6/§6 — un glisser-déposer n'est jamais utilisable en lecture d'écran seule).
- `reschedulePlannedSession(id, dateCible)` réutilisée telle quelle (R2) : aucune règle métier
  neuve, aucune migration, aucune sync rule à redéployer.

#### Technique / Notes

- `expo-haptics` (`~57.0.1`) est une **dépendance native neuve** — non recettable sur l'APK
  existant, un nouveau dev build EAS est requis avant la recette device (RECETTES.md #19).
- `npm run typecheck` / `npm run lint` / `npm run test` (mobile Jest 50 suites/265 tests + shared
  Vitest 67 fichiers/1319 tests, +7 pour `drop-target.test.ts`) — lus sans pipe, tous verts.
  Parité i18n FR/EN vérifiée (1628 clés).
- Roadmap 3.10 → ✅ (V0.3 : 19 livré / 2 partiel). RECETTES.md #19 créée. BACKLOG.md : entrée
  MUSC-F9 marquée livrée.

### 01/08/2026 — `feature/runf3-resume-course-enrichi` — RUN-F3 : comparaison à l'objectif + terrain (5.25 livrée, D3)

Commit précédent : `4d6594d`. Florian valide de construire le parcours complet (pas une
heuristique). Front-matter `etape: recette` (spec §7, critères device).

#### Le vrai chantier de cette US : un lien qui n'existait pas

En lisant le code (Étape 0 du plan, comme demandé) : `runs` n'avait **aucune** colonne vers
`planned_sessions`, et — découverte non anticipée par la spec — **il n'existait aucun parcours
pour démarrer une course planifiée** : `startRun()` ne prenait qu'une source, jamais d'identifiant
de séance, et `useTodaySession` (le widget « séance du jour ») n'était câblé que sur `'strength'`
malgré une signature générique. Construit de bout en bout plutôt qu'une heuristique approximative
(date + pilier, qui se serait trompée avec 2 courses le même jour).

#### Ajouté

- [run-target.ts (shared)](packages/shared/src/run-target.ts) — `compareToTarget`, pur, tolérance
  relative de 2 % (R5, dans les deux sens). 10 tests, dont le cas qui compte : 4,95 km sur 5 km
  visés → `reached` (sans la tolérance, une séance réussie s'afficherait presque toujours manquée).
- 2 migrations additives sur `runs` — `planned_session_id` (uuid, nullable) et `terrain` (text,
  check 4 valeurs). **Aucune sync rule à redéployer** (`runs` déjà en `select *`).
- [run-repository.ts](apps/mobile/src/data/repositories/run-repository.ts) —
  `useTodayRunSession()` (symétrique de `useTodaySession` côté muscu, mais **délibérément séparé** :
  ne touche pas au hook existant, propre à `strength`), `useRunTarget(plannedSessionId)`,
  `setRunTerrain`. `startRun(source, plannedSessionId?)` étendu.
- Carte « Course planifiée aujourd'hui » sur le hub course
  ([running.tsx](apps/mobile/src/app/(tabs)/running.tsx)), entre la reprise et le démarrage libre.
- Bloc de comparaison à l'objectif + sélecteur de terrain (4 choix) sur
  [summary.tsx](apps/mobile/src/app/run/summary.tsx) — monté **seulement** si la course a une
  cible résolue (R1, aucun encart vide pour une course libre).
- 6 clés i18n `running.target.*` (phrases à variables, jamais de concaténation — R2) + 5
  `running.terrain.*` + 5 `running.plannedToday.*`, FR+EN.

#### Technique / Notes

- `npm run typecheck` / `npm run lint` / `npm run test` (mobile Jest 265 + shared Vitest, +10 pour
  `run-target.test.ts`) — lus sans pipe, tous verts. Parité i18n FR/EN vérifiée (1599 clés).
- `runRowSchema`/`RunDetail` gagnent 2 champs — fixtures de test existantes mises à jour
  (`running.test.ts`, `run-summary-smoke.test.tsx`).
- Roadmap 5.25 → ✅, 5.24 reste 🟡 (terrain livré, météo scindée en RUN-F3b). RECETTES.md #18 créée.

### 01/08/2026 — `fix/conf07-accessibilite` — CONF-07 : contraste WCAG AA corrigé, V0.8 complète

Commit précédent : `3d2acd1`. D1 et D2 validées par Florian (maquette envoyée avant décision).
Front-matter `etape: recette` (spec §7 a des critères visuels, device requis).

#### Ajouté

- [contrast.ts (shared)](packages/shared/src/contrast.ts) — `relativeLuminance`/`contrastRatio`,
  purs, formule WCAG 2.1. 7 tests (`contrast.test.ts` : noir/blanc = 21, blanc/blanc = 1,
  symétrie, valeur illisible → `null`).
- [contrast.test.ts (mobile)](apps/mobile/src/theme/__tests__/contrast.test.ts) — le vrai
  livrable durable : parcourt la **palette réelle** sur une table de paires explicite (reprise de
  la spec §0), échoue si l'une repasse sous son seuil. **Vérifié rouge avant le correctif** (4
  assertions en échec, exactement les ratios mesurés par l'audit du 30/07) puis vert après —
  la 1ʳᵉ passe avait échoué faute de mesure automatisée, c'est exactement ce que ce test empêche
  de se reproduire.
- RECETTES.md — section #17 créée (8 critères visuels, spec §7).

#### Modifié

- [colors.ts](apps/mobile/src/theme/colors.ts) — 4 constantes, assombrissement pur en HSL (R1,
  teinte/saturation conservées) : `success` clair 3,23→4,53, `warnText` clair (vs `warn`)
  3,19→4,52, `amber` clair 2,29→3,03, `accentText` sombre (D1) 3,29→5,48. `accent`/`surface`
  sombre (D2, 4,45) laissé **tel quel**, commenté comme écart assumé — pour qu'un futur lecteur
  ne le « corrige » pas sans revalider D2. `chartGreen` **volontairement inchangé** (R3, diverge
  de `success` : ne peint que des courbes, seuil 3,0 déjà tenu).
- `docs/roadmap/roadmap.md` — 9.11 et 9.12 : 🟡 → ✅. **V0.8 est désormais complète** (10/10),
  l'en-tête de section mise à jour. Récapitulatif (✅ 177→**179**, 🟡 20→**18**), journal des
  réconciliations.
- `BACKLOG.md` — CONF-07 retirée des P0 (n'en reste que 2, tous deux hors-code : LANCE-00/01).

#### Technique / Notes

- `npm run typecheck` / `npm run lint` / `npm run test` (mobile Jest 265 + shared Vitest, dont 7
  pour `contrast.test.ts`) — lus sans pipe, tous verts.
- Diff constant côté données : aucune migration, aucune sync rule, aucun impact i18n/offline.

### 01/08/2026 — `feature/muscf1b-schema-muscles` — MUSC-F1b : recadrage complet en Voie B (spec + plan + maquette)

Commit précédent : `fe24e1f`. Documentation uniquement, **aucun code**. Florian a validé la **Voie B**
(anatomie fine) contre la recommandation initiale de la v1 (Voie A) — cette entrée remplace
entièrement la spec, le plan et la maquette du 30/07/2026.

#### Modifié

- [docs/specs/functional/us/muscf1b-schema-muscles.md](docs/specs/functional/us/muscf1b-schema-muscles.md)
  — spec réécrite. **Trouvaille de cadrage centrale** : le système actuel de 6 groupes larges est
  consommé par **18 fichiers** (alerte de déséquilibre MUSC-05, graphique de volume, remplacement
  d'exercice, filtre de bibliothèque, écran admin) — le remplacer aurait fait dépendre tout ce code
  déjà livré et recetté d'une nouvelle taxonomie. **Décision de conception : additive.** Nouvelle
  colonne `musclesFine`, indépendante, les 6 groupes larges ne bougent pas.
  - **Taxonomie reprise, pas inventée** : les 10 muscles de
    `docs/specs/functional/administration.md` §3.3 (Pectoraux, Dos, Épaules, Biceps, Triceps,
    Abdominaux, Fessiers, Quadriceps, Ischio-jambiers, Mollets), décrits le 04/07/2026, jamais
    implémentés — plutôt qu'une liste de 15-20 muscles latins à inventer.
  - **Une seule fonction de résolution** (`resolveFineMuscles`) unifie fiche/aperçu/bilan : un
    exercice tagué fin s'affiche précisément (`full`), un exercice non tagué retombe sur
    l'expansion de ses groupes larges (`BROAD_TO_FINE`) — reproduisant fidèlement le défaut
    d'origine (un curl non tagué éclaire encore tout le bras) jusqu'à ce qu'un coach le corrige.
  - **11 tracés SVG, pas 20** : seules les épaules apparaissent sur les deux vues (face+dos), les
    9 autres muscles n'apparaissent que sur une vue chacun.
  - **Correction d'une affirmation obsolète** : la v1 disait « la bibliothèque est encore vide
    (CONTENU-01) » — faux depuis le 29/07/2026 (16 exercices livrés, avant même la rédaction de la
    v1 le 30/07). Ne change pas la conclusion à elle seule, mais l'argument ne portait plus.
- [docs/plans/muscf1b-schema-muscles.md](docs/plans/muscf1b-schema-muscles.md) — plan réécrit, 5
  étapes : fonction pure + tests, migration additive + admin, `BodyMap` (11 tracés), 3 points de
  montage, solde. **Aucune sync rule à redéployer** (`exercises` est en `select *`) — contrairement
  à ce qu'annonçait la v1 pour la Voie B.
- [design/muscf1b-schema-muscles/muscf1b-schema-muscles.html](design/muscf1b-schema-muscles/muscf1b-schema-muscles.html)
  — maquette réécrite : deux vues de référence (tous les muscles nommés, pour la relecture
  anatomique du critère de recette 12) + 3 cas d'usage (curl tagué fin, curl en repli large, bilan
  hebdomadaire) montrant explicitement que le repli **n'est pas un cas d'erreur caché** — c'est
  l'état réel des 16 exercices actuels au lancement de cette US.
- `BACKLOG.md` — entrée MUSC-F1b mise à jour (Voie B, recadrage, référence à la maquette).

#### Technique / Notes

- Pas de recette device à ce stade : la maquette doit être validée **avant** tout code (critère 12).
- Front-matter `etape: validation` — en attente de validation Florian/Damien sur les 3 livrables.

### 01/08/2026 — `feature/muscf7-deload` — MUSC-F7 : deload câblé (code livré, en recette)

Commit précédent : `52fe4fe`. Décision D1 validée par Florian : activer la règle telle qu'écrite.
Front-matter `etape: code` → `recette` (spec §5 a des critères observables, contrairement à MUSC-F6).

#### Ajouté

- [workout-repository.ts](apps/mobile/src/data/repositories/workout-repository.ts) —
  `SELECT_SECOND_LAST_PERFORMANCE` (même forme que `SELECT_LAST_PERFORMANCE`, sous-requête
  `OFFSET 1` au lieu de `LIMIT 1` seul) + `usePreviousStruggled(exerciseId): boolean`, qui applique
  `sessionStruggled` aux séries qualifiantes de l'**avant-dernière** séance sur l'exercice.
  `false` s'il n'existe pas d'avant-dernière séance qualifiante — pas de deload sans donnée
  suffisante pour l'établir. Pas de test dédié à la requête elle-même (même convention que
  `useLastPerformance`, non testée en tant que requête SQL).
- [workout.test.ts](packages/shared/src/workout.test.ts) — 5 tests directs de `sessionStruggled`
  (échec sans RPE, RPE 8/9, RPE 7 sans échec, aucune série qualifiante, RPE max parmi plusieurs
  séries) — elle devient une API publique du package, elle doit être testée comme telle.
- RECETTES.md — section #16 créée (4 critères, spec §5).

#### Modifié

- [workout.ts](packages/shared/src/workout.ts) — `sessionStruggled` passe de privée à **exportée**
  (aucun changement de signature) : réutilisée par `usePreviousStruggled` sans dupliquer la règle.
- [workout.tsx](apps/mobile/src/app/workout.tsx) — `usePreviousStruggled(currentExerciseId)` appelé
  et passé dans les `opts` de `computeProgressionSuggestion`. Seule ligne changée dans ce fichier :
  la restitution (`suggestion.kind === 'deload'`) et les 2 clés i18n existaient déjà (Refonte-C3).
- `docs/roadmap/roadmap.md` — 3.8 : 🟡 → ✅. Récapitulatif (✅ 176→**177**, 🟡 21→**20**), détail V0.3
  (17/4→**18/3**), entrée au Journal des réconciliations.
- `BACKLOG.md` — entrée MUSC-F7 marquée livrée, en recette (patron `~~MUSC-F14~~`).

#### Technique / Notes

- `npm run typecheck` / `npm run lint` / `npm run test` (mobile Jest 260 + shared Vitest 1287, dont
  82 pour `workout.test.ts` : +5) — lus sans pipe, tous verts.
- Le Volet A (roadmap 3.7, progression au niveau programme) reste hors périmètre — scindé dans le
  commit précédent (`52fe4fe`), aucun changement ici.

### 01/08/2026 — `feature/muscf7-deload` — MUSC-F7 : entrée en pipeline, scindée du roadmap 3.7 (spec + plan)

Commit précédent : `8b37cf4`. Documentation uniquement, **aucun code**. Front-matter `etape:
validation` — arrêt avant tout code, en attente de la décision D1 (Florian/Damien).

#### Ajouté

- [docs/specs/functional/us/muscf7-progression-assistee.md](docs/specs/functional/us/muscf7-progression-assistee.md)
  — spec. **Pas de maquette** : la restitution UI et les 2 clés i18n (`workout.suggestion.deload`
  FR/EN) existent déjà depuis Refonte-C3.
  - **Trouvaille de cadrage la plus importante** : le backlog présentait MUSC-F7 comme un seul
    chantier (« progression programme + câblage deload »). Cartographie (agent Explore) : ce sont
    deux volets d'ampleur radicalement différente.
    - **Volet B (roadmap 3.8, deload)** — brique de calcul déjà livrée et testée
      (`computeProgressionSuggestion`, `packages/shared/src/workout.ts`), UI déjà câblée. Il ne
      manque qu'un signal, `previousStruggled`, jamais fourni à l'appel actuel. **C'est le seul
      périmètre retenu pour cette US.**
    - **Volet A (roadmap 3.7, progression au niveau programme)** — `exercise_plans.target_weight_kg`
      est figé par plan (aucune notion de semaine), aucun taux de complétion n'est calculé nulle
      part, `planned_sessions.week_index` n'est posé qu'une fois à la génération. Ce n'est pas un
      signal manquant : c'est un **concept de données à concevoir** (où stocker une cible qui
      évolue, quelle fenêtre, quand recalculer, comment l'exposer). **Scindé, traité comme un
      futur candidat séparé** avec son propre cadrage produit.
  - Décision D1 posée : confirmer la règle déjà écrite (2 séances d'affilée en échec/RPE ≥ 8,
    −10 %, arrondi 0,5 kg) avant de l'activer — elle est dormante depuis Refonte-C3, jamais revue.
- [docs/plans/muscf7-progression-assistee.md](docs/plans/muscf7-progression-assistee.md) — 6 tasks :
  exporter `sessionStruggled`, requête symétrique à `SELECT_LAST_PERFORMANCE` (offset 1), hook
  `usePreviousStruggled`, branchement dans `workout.tsx`.
- `BACKLOG.md` — ligne MUSC-F7 recadrée sur le seul volet 3.8 (patron `~~MUSC-F7~~`) ; nouvelle
  ligne séparée pour le volet 3.7 (« Progression au niveau du programme »), non encore une US.
- `docs/roadmap/roadmap.md` — 3.7 : remarque honnête sur l'ampleur réelle du chantier (estimation
  « 3h » signalée sous-évaluée) ; 3.8 : pointeur vers la spec/plan.

### 01/08/2026 — `feature/muscf6-fenetre-reprise-seance` — MUSC-F6 : réconciliation livrée (Option A, US clôturée)

Commit précédent : `78b6ead`. Décision D1 validée par Florian : **Option A**. Documentation
uniquement, **aucun code applicatif**. Front-matter `etape: close` directement (spec §4 : aucun
critère de recette).

#### Modifié

- [musculation.md §4.4](docs/specs/functional/musculation.md) — le paragraphe « Abandon de
  séance / reprise » ne promet plus une fenêtre de 4h et une popup « Pause » jamais construites :
  il décrit maintenant le comportement réel (quitter laisse la séance `active`, reprenable via
  « Reprendre » jusqu'à la clôture automatique à 3h, US 3.37).
- `docs/roadmap/roadmap.md` — ligne 3.36 : libellé + remarque réécrits, statut 🟡 → ✅. Récapitulatif
  (✅ 175→**176**, 🟡 22→**21**), détail V0.2 (27/1→**28/0**), entrée au Journal des réconciliations.
- `BACKLOG.md` — entrée MUSC-F6 retirée (US clôturée).

#### Technique / Notes

- Aucun test à ajouter ni à modifier : `WORKOUT_AUTO_CLOSE_SECONDS` et `workout.test.ts` restent
  inchangés — c'est justement le point de cette US (le code avait déjà raison, la doc mentait).
- Coïncidence notée en recette device (voir l'entrée du lot de correctifs juste en dessous) :
  une séance du 22/07 trouvée à **3 150 min** (52 h), laissée ouverte — la donnée réelle confirme
  après coup le bien-fondé de cette réconciliation.

### 01/08/2026 — `feature/cycle01-suivi-menstruel` — Lot de correctifs de la recette device (CYCLE-01, NUTR-F2, MESUR-01, PARTAGE-01, BIEN-01)

Commit précédent : `3300104`. **Aucune fonctionnalité nouvelle** : 8 défauts trouvés en pilotant l'app
sur Pixel 6a (build release, 34 routes balayées), corrigés et **revérifiés à l'écran** un par un.

#### Corrigé

**🔴 CYCLE-01 — le suivi du cycle était impossible à activer**

L'interrupteur des réglages ne basculait pas, **sans le moindre message**.
[schema.ts](apps/mobile/src/powersync/schema.ts) ne déclarait pas `cycle_tracking_enabled` ni
`cycle_health_connect_enabled` dans la table locale `user_settings` : les tables `menstrual_*` avaient
été ajoutées à la migration `20260730230615`, les **deux colonnes du réglage** non. L'écriture
PowerSync échouait et `void updateSettings(...)` avalait l'erreur.

> **Aucun des 1 529 tests ne pouvait l'attraper** : ils mockent le repository. Le défaut n'existe que
> contre le schéma local réel. C'est l'argument le plus net de la session pour la recette device.

**CYCLE-01 — les routes s'ouvraient suivi éteint (critère de recette 1)**

`wellness://cycle` et `wellness://cycle/insights` s'affichaient **entièrement** alors que l'opt-in était
désactivé. Aucun garde dans le code : la protection reposait sur une convention (« on n'y accède que
depuis le widget »), or Expo Router enregistre les routes et le schéma `wellness://` est déclaré. Pour
une donnée de santé en opt-in strict, la convention ne suffit pas.
→ [CycleTrackingGuard](apps/mobile/src/components/cycle/CycleTrackingGuard.tsx), appliqué aux 2 écrans.
Le garde **enveloppe** le contenu : suivi éteint, aucun hook de `menstrual-cycle-repository` ne
s'exécute, la route ne lit rien. Ne redirige **jamais** pendant le chargement des réglages (sinon on
renverrait à l'accueil un utilisateur qui a bien activé le suivi).

**NUTR-F2 — des suggestions inutilisables : « Chipolatas 350 g · 952 kcal »**

Pour 80 g de lipides manquants, la carte proposait *Chipolatas 350 g · 952 kcal*, *Beurre de cacahuète
155 g · 997 kcal*, *Rillettes de saumon 380 g · 999 kcal* — dans les bornes en grammes, sous le budget
du jour, et impossibles à cuisiner (critère de recette 2 : « aucun 900 g, aucun 8 g »).

Le défaut n'était **pas dans les bornes, mais dans le contrat** : la quantité proposée comblait 100 % de
l'écart. Or un écart de 80 g de lipides, c'est la cible d'une **journée entière** — aucun aliment seul ne
la couvre, et prétendre le contraire produit mécaniquement des portions absurdes. Trois changements
dans [macro-suggestion.ts](packages/shared/src/macro-suggestion.ts) :

- **Plafond de portion** — la quantité est rabattue sur la **portion de référence** de l'aliment
  (`SuggestionCandidate.portionG`, alimentée par `foods.portions`), ou `SUGGESTION_NO_PORTION_MAX_G`
  (200 g) à défaut. La portion sert de **plafond**, jamais de plancher : un petit écart reste un petit
  apport.
- **Plafond calorique** — `SUGGESTION_MAX_KCAL_RATIO` (1/3) : une suggestion ne peut pas coûter plus du
  tiers des calories restantes. Les bornes en grammes ne peuvent pas attraper ce cas — 380 g de rillettes
  et 380 g de courgettes ont la même masse et rien à voir ; c'est la **densité calorique** qui rend la
  proposition absurde, donc c'est elle qu'on plafonne. Reste utile après le plafond de portion : 100 g
  d'huile est une portion normale et pèse 900 kcal.
- **Seuil d'utilité** — `SUGGESTION_MIN_GAP_COVERAGE` (25 %). **Contrepartie indispensable** du plafond :
  sans lui, rabattre la quantité transformait « 1 kg de brocoli », correctement rejeté, en « 200 g de
  brocoli, +5,6 g » — exact, honnête, et sans le moindre intérêt. *C'est le test existant sur le brocoli
  qui a fait échouer la première version du correctif et imposé ce seuil.*
- **La carte annonce ce qu'elle apporte**
  ([MacroSuggestionCard](apps/mobile/src/components/nutrition/MacroSuggestionCard.tsx)) — « 150 g ·
  305 kcal · **+30,9 g de lipides** ». Sans ce chiffre, une portion laisserait croire qu'elle comble la
  cible : c'est précisément le défaut corrigé. Chaîne `suggestion.noCandidate` réalignée sur le nouveau
  contrat (« n'apporte ce macro dans une portion raisonnable », plus « ne comble cet écart »).

**NUTR-F2 — 50 des 80 aliments de bibliothèque n'avaient aucune portion**

Conséquence directe : après le correctif ci-dessus, **toutes** les suggestions sortaient à exactement
200 g — la borne de repli. Le plafonnement par portion ne pouvait pas s'appliquer.
→ Migration [`20260801001204`](supabase/migrations/20260801001204_nutrf2_portions_reference_aliments.sql),
**poussée sur le cloud** et cochée dans [MIGRATIONS.md](supabase/MIGRATIONS.md). `update` par id, donc
idempotent. Le catalogue source `foods-catalog.json` est mis à jour dans le même commit — une
régénération du seed conservera ces portions.
Résultat device : *Avocat **150 g** · 305 kcal · +30,9 g de lipides*.

**MESUR-01 — « réessaie » sur une valeur qui échouera toujours (critère de recette 7)**

Saisir 500 cm affichait « Les mesures n'ont pas pu être enregistrées. **Réessaie.** » — un conseil faux.
La borne (1-300 cm) existait bien dans `isValidMeasurementCm`, mais uniquement au dépôt : la valeur se
parsait, le bouton restait actif, l'écriture échouait, et l'utilisateur recevait le catch générique.
→ [MeasurementSheet](apps/mobile/src/components/measurements/MeasurementSheet.tsx) contrôle les bornes
**avant** l'envoi : message qui donne les limites dans l'unité active, bouton désactivé.

**PARTAGE-01 — « Wellness » collé à « DURÉE »** sur la carte partageable : `styles.brand` n'avait aucune
marge haute, les deux lignes se lisaient comme une seule. `marginTop` proportionnel à la taille de carte,
comme le reste de [ShareCard](apps/mobile/src/components/share/ShareCard.tsx).

**BIEN-01 — barres d'énergie invisibles** : les glyphes `▁▃▅▆█` sont du **texte**, pas des emoji — sans
`color`, ils héritent du noir par défaut de RN sur Android et disparaissaient sur le thème sombre. Les
emoji d'humeur et de stress portent leur propre couleur, d'où un défaut visible sur une seule des trois
échelles. Couleur de thème explicite dans
[WellbeingScale](apps/mobile/src/components/wellbeing/WellbeingScale.tsx).

**food-picker — un écran qui confirmait un enregistrement fantôme**

`params.date ?? ''` écrivait l'entrée sur une **clé de jour vide** : ligne enregistrée sans erreur,
comptée par « N aliments ajoutés », et invisible dans tous les journaux. Repli sur aujourd'hui
(`useTodayKey`). ⚠️ **Conséquence sous-estimée à la première analyse** : ces lignes bloquaient aussi la
file d'envoi PowerSync (`invalid input syntax for type date: ""`), au même titre que le défaut jsonb du
commit `3300104`.

**Trois occurrences du même symptôme : le point décimal en français**

- « Essaie 82.**5** kg » — `weightInputValue()` (fait pour pré-remplir un `TextInput`, qui n'accepte pas
  la virgule) réutilisé comme **texte d'affichage** → `formatWeight`
  ([workout.tsx](apps/mobile/src/app/workout.tsx)).
- Axe des mensurations « 90.2 | 67.7 | 45.1 » — sans `formatYLabel`, gifted-charts génère ses propres
  libellés en formatage JS brut → nouveau `formatAxisNumber` dans
  [useUnits](apps/mobile/src/hooks/useUnits.ts). Bénéfice au passage : l'échelle suit désormais la plage
  réelle (81 → 82) au lieu de partir de 0, où un tour de taille est une ligne plate.
- « +41.**2** g de lipides » — i18next interpole les nombres avec un `String()` brut → formatage
  **avant** passage de la variable.

- **« 1 ajouté(s) à ce repas »** → pluriel i18next (`addedCount_one` / `_other`), FR + EN.

#### Ajouté

- [CycleTrackingGuard.tsx](apps/mobile/src/components/cycle/CycleTrackingGuard.tsx) — garde d'accès des
  écrans de cycle.
- **Règle ESLint** ([eslint.config.js](apps/mobile/eslint.config.js)) — `no-restricted-syntax` refusant un
  helper `*InputValue` à l'intérieur d'un `t(...)`. **Vérifiée en réintroduisant le bug d'origine** : elle
  le rattrape, et laisse passer le code corrigé.
- [bonnes-pratiques.md §2](docs/specs/technical/bonnes-pratiques.md) — « tout nombre affiché passe par un
  formateur localisé », avec les **trois pièges** ci-dessus. Seul le premier est détectable
  statiquement ; les deux autres relèvent de la convention.
- **Tests** : +5 sur `macro-suggestion` (plafond de portion, apport réel annoncé, repli sans portion, pas
  de gonflement, portion aberrante en base) ; +3 sur le garde de cycle (suivi éteint, réglages absents,
  chargement en cours) ; plafond calorique réécrit sur l'huile d'olive — le cas où une portion **normale**
  reste hors budget, que le plafond de portion ne couvre pas.

#### Modifié

- [buildPaceYAxis](packages/shared/src/units.ts) — paramètre `flatPad` optionnel (défaut inchangé : 30 s
  d'allure). Le nom reste historique, la fonction est générique. Les mensurations passent **2 cm** : le
  défaut aurait ouvert une bande de 60 cm autour d'un relevé plat.
- `apps/mobile/src/app/(tabs)/nutrition.tsx` — `portionG` transmis aux candidats.

#### Technique / Notes

- **Périmètre volontairement large** : 8 défauts d'un même passage de recette, tous des `fix`, tous
  revérifiés sur device. Le correctif de synchro, lui, a été **isolé** dans `3300104` — il touche toutes
  les écritures de l'app et doit pouvoir être révoqué seul.
- ⚠️ **Deux points restent ouverts côté NUTR-F2.** Les suggestions issues d'aliments **OpenFoodFacts**
  (scannés) restent au repli 200 g : ces aliments n'ont légitimement pas de portion déclarée. Et les trois
  seuils (1/3 du budget, 200 g, 25 % de couverture) sont des **valeurs de calibrage** commentées comme
  telles, à réévaluer à l'usage — pas des règles métier figées.
- **Anomalie de données trouvée, non corrigée** : une séance du 22/07 dure **3 150 min** (52 h), laissée
  ouverte. C'est exactement ce que vise la spec MUSC-F6 cadrée le 31/07 — la donnée réelle confirme le
  besoin.
- **Non reproduit / non testé** : Health Connect de bout en bout (permissions système à valider à la main)
  et les notifications programmées (attente d'échéance).

### 01/08/2026 — `feature/cycle01-suivi-menstruel` — 🔴 Synchro bloquée : les colonnes `jsonb` remontaient en texte

Commit précédent : `e6b9e08`. **Correctif le plus important de la recette device du 31/07–01/08/2026.**
Isolé dans son propre commit parce qu'il touche **toutes les écritures de l'app** : s'il régresse, il
doit pouvoir être révoqué seul.

#### Le symptôme

Découvert en cherchant pourquoi une mise à jour de `foods` poussée sur le cloud n'arrivait jamais sur
le device. Les logs tournaient en boucle, toutes les 5 secondes :

```
[PowerSync] upload PUT menstrual_daily_logs échoué :
  new row for relation "menstrual_daily_logs" violates check constraint "menstrual_daily_logs_symptoms_check"
```

…**pendant que le tableau de bord affichait « Synchronisé »**.

#### La cause

PowerSync n'a pas de type JSON : les colonnes `jsonb` sont stockées en **TEXT** côté SQLite, donc le
client sérialise (`JSON.stringify`) pour écrire en local. `uploadData` remontait `op.opData` **brut** —
la *chaîne* `'["cramps"]'` partait donc dans une colonne `jsonb`, où Postgres stockait une valeur de
type `string` au lieu du tableau attendu.

Deux conséquences, selon que la colonne est gardée ou non :

- **`menstrual_daily_logs.symptoms`** porte `check (jsonb_typeof(symptoms) = 'array')` → l'upload est
  **rejeté**, l'opération rejouée indéfiniment, et la **file d'envoi PowerSync reste bloquée**. Rien ne
  monte, et — c'est le piège — **rien ne descend non plus**. Une seule ligne malformée gèle toute la
  synchronisation d'un utilisateur, sans le moindre signal dans l'UI.
- **`foods.portions`**, sans garde équivalente → corruption **silencieuse**. Constaté en base : 5
  aliments créés depuis l'app portaient `"[]"` (une chaîne) au lieu de `[]`.

> **Ce défaut était connu à moitié.** Le côté **lecture** était déjà contourné par
> [`parseJsonColumn`](packages/shared/src/json-column.ts), qui déballe jusqu'à **trois** fois et dont le
> commentaire documente le double-encodage depuis l'US 4.34. Ce helper traitait le symptôme ; personne
> n'avait remonté la chaîne jusqu'à l'écriture. Le contournement en lecture reste utile (les lignes déjà
> corrompues existent), mais il n'a plus vocation à voir de nouvelles occurrences.

#### Corrigé

- [connector.ts](apps/mobile/src/powersync/connector.ts) — `decodeJsonColumns()` déballe les colonnes
  `jsonb` déclarées avant l'envoi, pour `PUT` comme pour `PATCH`. Registre `JSON_COLUMNS` des **13**
  colonnes, relevé sur le schéma réel :
  `audit_log.details` · `exercises.muscles_secondary` · `food_entries.micronutrients` ·
  `foods.micronutrients` · `foods.portions` · `menstrual_daily_logs.symptoms` ·
  `nutrition_profiles.{allergens,meals,restrictions}` · `user_settings.{active_pillars,dashboard_layout,notifications}`.
  - **Tolérant par conception** : valeur déjà décodée, `null`, ou chaîne non-JSON sont laissées
    telles quelles plutôt que de faire échouer la transaction — bloquer la synchro est exactement ce
    qu'on cherche à éviter ici.
  - **Ne mute pas** `op.opData` (copie à la première réécriture).

#### Ajouté

- [connector-json-columns.test.ts](apps/mobile/src/powersync/__tests__/connector-json-columns.test.ts)
  — 10 tests : le cas qui bloquait la synchro, la corruption silencieuse de `portions`, colonnes
  multiples, tables sans colonne JSON, colonnes non déclarées, valeur déjà décodée, `null`, chaîne
  illisible, non-mutation de la source, `opData` absent.

#### Vérification device

Rebuild + réinstallation : l'erreur `menstrual_daily_logs` **disparaît au premier lancement**. Une
deuxième opération empoisonnée attendait derrière (`food_entries` avec `date: ""`, cf. l'entrée du lot
de correctifs) ; après purge de la base locale et reconnexion, **0 erreur d'upload** et la mise à jour
cloud des portions est enfin descendue sur l'appareil.

#### Technique / Notes

- ⚠️ **`JSON_COLUMNS` est un registre manuel.** Toute nouvelle colonne `jsonb` doit y être ajoutée.
  Requête de contrôle dans le commentaire du fichier :
  `select table_name, column_name from information_schema.columns where table_schema='public' and data_type in ('jsonb','json');`
- ⚠️ **La résilience reste à traiter — c'est un arbitrage produit, pas un oubli.** Les deux causes de
  ce soir sont corrigées, mais le **mécanisme** demeure : une opération en échec bloque la file
  indéfiniment. Un traitement des « opérations empoisonnées » (abandon après N tentatives sur une
  erreur 4xx, avec trace) suppose d'accepter une **perte de données** — décision Florian/Damien.
- ⚠️ **L'indicateur « Synchronisé » ment dans cet état.** C'est ce qui rend le défaut invisible : il
  devrait refléter l'état réel de la file d'envoi, pas seulement la connexion.
- **Les 5 lignes `foods.portions` déjà corrompues ne sont pas réparées** par ce commit. Impact faible :
  `parseJsonColumn` déballe `"[]"` en `[]` à la lecture. À nettoyer par une migration si besoin.

### 31/07/2026 — `feature/muscf6-fenetre-reprise-seance` — MUSC-F6 : entrée en pipeline (spec + plan)

Commit précédent : `5643442`. Documentation uniquement, **aucun code**. Front-matter `etape:
validation` — arrêt avant tout code, en attente de la décision D1 (Florian/Damien).

#### Ajouté

- [docs/specs/functional/us/muscf6-fenetre-reprise-seance.md](docs/specs/functional/us/muscf6-fenetre-reprise-seance.md)
  — spec. **Pas de maquette** pour l'option recommandée (aucun écran ne change).
  - **Trouvaille de cadrage** : le « conflit 3h/4h » que le roadmap documentait depuis le 28/07 n'a
    **jamais existé dans le comportement observable de l'app**. Recherche exhaustive (code
    applicatif + i18n) : aucune trace du chiffre « 4 heures », aucun statut `paused`, aucune popup
    « Abandonner/Pause ». La seule limite réelle est `WORKOUT_AUTO_CLOSE_SECONDS` (3h,
    `packages/shared/src/workout.ts`, déjà testée) — le « 4h » n'était qu'un vestige de la
    rédaction initiale de `musculation.md` §4.4, jamais implémenté ni retouché depuis.
  - **Décision D1 posée, pas tranchée** : Option A (officialiser 3h, corriger la doc pour qu'elle
    dise ce que le code fait déjà — recommandée, zéro ligne de code) vs Option B (construire une
    vraie fenêtre de reprise distincte de la clôture auto, avec avertissement — chantier réel,
    bénéfice non démontré : personne n'a réclamé ce chiffre depuis la rédaction de la spec).
- [docs/plans/muscf6-fenetre-reprise-seance.md](docs/plans/muscf6-fenetre-reprise-seance.md) — 4
  tasks pour l'Option A uniquement ; si Option B est retenue, ce plan est explicitement caduc et
  une nouvelle spec/plan/maquette seront nécessaires (l'US redevient un vrai chantier de code + UI).
- `BACKLOG.md` — entrée MUSC-F6 marquée entrée en pipeline (patron `~~NUTR-F1~~`).

### 31/07/2026 — `fix/health-connect-erreur-opt-in-off` — Health Connect : bandeau d'échec clarifié pour les utilisateurs EN

Commit précédent : `d639a72`. Correctif issu de « Constats de la passe device automatisée du
30/07/2026 » (BACKLOG.md). Deux problèmes distincts avaient été notés dans le même constat — la
relecture a montré que **le premier était déjà corrigé** :

- **(a) « opt-in OFF traité comme une panne »** : déjà résolu par le commit `936ec81` (30/07/2026),
  qui a introduit le drapeau `inactive` dans `ready()`/`readyCycle()` — un abandon normal
  (plateforme, opt-in désactivé) n'appelle plus jamais `report()`. Verrouillé par
  `health-connect-inactive.test.ts` (toujours vert). La case du BACKLOG n'avait simplement jamais
  été cochée malgré le correctif déjà livré.
- **(b) « détail technique non traduit lu par un utilisateur anglophone »** : **c'est celui-là qui
  restait réellement à corriger.**

#### Corrigé

- [HealthConnectSection.tsx](apps/mobile/src/components/HealthConnectSection.tsx) — le bandeau
  d'échec (`report?.error`, affiché **uniquement** sur une vraie panne) encadre désormais le
  diagnostic technique interpolé d'une mention **explicite et traduite** : « détail technique, non
  traduit » (FR) / « technical detail, not translated » (EN). Le contenu du diagnostic lui-même
  reste volontairement en français brut (`SERVICE_REV`, messages internes) — le traduire
  dynamiquement serait disproportionné pour un outil de diagnostic — mais un utilisateur EN
  comprend maintenant que c'est **voulu**, plutôt que de lire une app mal traduite.
  - Clé i18n `settings.healthConnect.lastAttemptFailed` (FR + EN).
  - Commentaire du composant mis à jour pour expliciter les deux moitiés du correctif (a) et (b) et
    pointer vers le test de non-régression existant.

#### Technique / Notes

- `npm run typecheck` / `npm run lint` / `npm run test` (mobile Jest 247 + shared Vitest 1282) —
  lus sans pipe, tous verts. Parité i18n FR/EN vérifiée (1580 clés de chaque côté).
- BACKLOG.md : entrée retirée (les deux volets du constat sont désormais traités).
- Roadmap 9.9 (Health Connect, déjà ✅) : remarque additionnelle datée, pas de changement de statut.
- Pas de spec/plan/maquette dédiés : correctif ponctuel sur une fonctionnalité déjà livrée et
  recettée (CONF-06, 9.9 ✅), branche `fix/*` — même traitement que le correctif d'en-tête PAS-01
  du 30/07/2026.

### 31/07/2026 — `refactor/refacto01-acces-pilier` — REFACTO-01 : unification livrée (US clôturée)

Commit précédent : `51626ac`. Front-matter `etape: close` — **aucune recette device** requise
(spec §3 : comportement strictement inchangé à 3 piliers, vérifiable par lecture + tests).

#### Ajouté

- [pillar.ts (shared)](packages/shared/src/pillar.ts) — `resolveActivePillars(activePillars)` :
  source **unique** du repli « piliers actifs, ou tous si non chargés ». 5 tests Vitest
  (`undefined`, `null`, tableau vide **non** retombé sur le repli, sous-ensemble préservé, copie
  défensive — pas la même référence que l'entrée).

#### Modifié — remplacement du repli en ligne par `resolveActivePillars` (10 sites)

- [`(tabs)/_layout.tsx`](apps/mobile/src/app/(tabs)/_layout.tsx) — visibilité des 3 onglets pilier.
- [`settings.tsx`](apps/mobile/src/app/settings.tsx) — boutons profil nutrition/course + switches piliers.
- [`(onboarding)/pillars.tsx`](apps/mobile/src/app/(onboarding)/pillars.tsx) — switches piliers à l'onboarding.
- [`(onboarding)/summary.tsx`](apps/mobile/src/app/(onboarding)/summary.tsx) — libellé récapitulatif.
- [`dashboard-repository.ts`](apps/mobile/src/data/repositories/dashboard-repository.ts) — 5 sites :
  `useDayCalorieTarget`, `useMostRecentRecord`, `useDeficitVolumeAlert`, `useTrainingTime`,
  `useGoalAdherenceForRange` (ce dernier enchaînait le repli et `.includes()` sans variable
  intermédiaire — même remplacement, une ligne).
- [`records-repository.ts`](apps/mobile/src/data/repositories/records-repository.ts) —
  `useTrainingNutritionCross` : variable locale renommée `pillars` → `activePillars` au passage
  (cohérence avec les 9 autres sites, usage strictement local à la fonction).
- [`weekly-review-repository.ts`](apps/mobile/src/data/repositories/weekly-review-repository.ts)
  — **corrige un bug latent** : le repli était **codé en dur**
  (`['strength', 'running', 'nutrition']`) au lieu de `[...PILLARS]`, donc désynchronisé de la
  source de vérité — un 4ᵉ pilier futur n'y aurait jamais été vu, sans erreur TypeScript (le
  littéral reste un sous-ensemble valide de `Pillar[]`). Comportement identique aujourd'hui (3
  piliers), corrigé pour de bon.
- [`widget-layout-repository.ts`](apps/mobile/src/data/repositories/widget-layout-repository.ts)
  — **un seul** des deux appels à `[...PILLARS]` touché (celui du calcul réactif filtré). L'autre
  (`fullScreenFrom`, layout **non filtré** utilisé par l'écran de réorganisation) reste
  intentionnellement un littéral `[...PILLARS]` — ce n'est pas un repli sur donnée absente, c'est
  une valeur volontairement différente des piliers réels de l'utilisateur.

#### Volontairement non touché (documenté en spec §1/§3, pour ne pas être « corrigé » par erreur)

- `packages/shared/src/widgets.ts` (`WidgetGuard`) — mécanisme du registre de widgets, ne fait pas
  le repli lui-même, aucun rapport direct avec cette dette.
- Les 2 sites de conjonction `&&` (`useDeficitVolumeAlert`, `useTrainingNutritionCross`) — 2
  occurrences, lisibles telles quelles, aucun bug constaté. Introduire un type de garde générique
  pour 2 sites aurait été une abstraction sans bénéfice mesurable.
- `apps/admin/src/data/users.ts` (`parseActivePillars`) — repli **inversé** (absent → aucun pilier,
  pas tous) et rendu d'affichage, pas une décision d'accès : fusionner aurait inversé un
  comportement voulu ailleurs.
- Les littéraux `'strength'`/`'running'`/`'nutrition'` codés en dur dans le JSX de
  `(tabs)/_layout.tsx` (3 onglets fixes) — pas une décision dupliquée, juste une expression directe.

#### Technique / Notes

- `npm run typecheck` / `npm run lint` / `npm run test` (mobile Jest 247 + shared Vitest 1282) —
  lus sans pipe, tous verts. `grep` de contrôle : plus aucune occurrence de `?? [...PILLARS]` ni de
  repli codé en dur hors de `resolveActivePillars`.
- Front-matter `docs/specs/functional/us/refacto01-acces-pilier.md` : `etape: code` → `close`
  directement (pas d'étape recette pour ce refactor, spec §3).
- Roadmap 9.16 → ✅, Récapitulatif 🟡 23 → 22 / ✅ 174 → 175, V0.8 (10) : 7/3 → 8/2.
- Entrée REFACTO-01 retirée de [BACKLOG.md](BACKLOG.md) (US clôturée).

### 31/07/2026 — `refactor/refacto01-acces-pilier` — REFACTO-01 : entrée en pipeline (spec + plan)

Commit précédent : `010a4d3`. Documentation uniquement, **aucun code**. Front-matter `etape:
validation` — arrêt avant code, en attente de validation Florian/Damien (workflow obligatoire).

#### Ajouté

- [docs/specs/functional/us/refacto01-acces-pilier.md](docs/specs/functional/us/refacto01-acces-pilier.md)
  — spec technique. **Pas de maquette** : refactor invisible, zéro écran touché.
  - Cartographie exhaustive (agent Explore) des ~10 sites qui recopient
    `settings?.activePillars ?? [...PILLARS]` : `(tabs)/_layout.tsx`, `settings.tsx`,
    `(onboarding)/pillars.tsx`, `(onboarding)/summary.tsx`, 5 hooks de
    `dashboard-repository.ts`, `records-repository.ts`, `weekly-review-repository.ts`,
    `widget-layout-repository.ts`.
  - **Trouvaille concrète** : `weekly-review-repository.ts` a un repli **codé en dur**
    (`['strength', 'running', 'nutrition']`) au lieu de `[...PILLARS]` — désynchronisé de la
    source de vérité, un 4ᵉ pilier futur ne serait jamais vu par ce site sans erreur TypeScript.
    Sera corrigé en même temps que l'unification.
  - Périmètre volontairement étroit (documenté explicitement en §1/§3 pour ne pas être
    « corrigé » plus tard par erreur) : `WidgetGuard`/`widgets.ts` non touché (rôle différent,
    pas de repli à corriger), les 2 sites de conjonction `&&` non touchés (2 occurrences,
    lisibles, aucun bug constaté), `apps/admin/src/data/users.ts` non touché (repli **inversé** —
    absent → `[]`, pas `[...PILLARS]` — fusionner casserait un comportement voulu).
- [docs/plans/refacto01-acces-pilier.md](docs/plans/refacto01-acces-pilier.md) — 10 tasks, une par
  site + la fonction pure + le contrôle final par `grep`.
- `docs/roadmap/roadmap.md` — ligne **9.16** créée (V0.8), Récapitulatif 212→213 / Partiel 22→23,
  entrée courte au Journal des réconciliations.
- `BACKLOG.md` — entrée REFACTO-01 marquée entrée en pipeline (patron `~~NUTR-F1~~`).

### 31/07/2026 — `feature/cycle01-suivi-menstruel` — CYCLE-01 : Health Connect câblé (code complet)

Commit précédent : `4e9c2c3`. Roadmap **1.25** et **1.26** passent front-matter `etape: recette` —
**code complet**, ne reste que la recette device (RECETTES.md #15). Termine le dernier point de la
US ("le seul reste" déclaré dans le front-matter précédent).

#### Ajouté

- [health-connect.ts (shared)](packages/shared/src/health-connect.ts) — briques pures
  Menstruation : `buildMenstruationPeriodRecord`/`buildMenstruationFlowRecord` (construction),
  `selectPeriodsToImport`/`selectFlowLogsToImport` (réduction des records lus), `flowToHealthConnect`/
  `flowFromHealthConnect` (mapping 4 niveaux internes ↔ 3 niveaux Health Connect). 33 tests Vitest.
  - **Point de vérification important avant d'écrire une ligne de code** : la déclaration
    TypeScript de `react-native-health-connect@3.5.3` fait hériter `MenstruationPeriodRecord`
    d'`InstantaneousRecord` (`time` seul) — ce qui aurait imposé de regrouper des marqueurs
    quotidiens en périodes. Vérification faite dans le binding **natif** Kotlin de la bibliothèque
    (`ReactMenstruationPeriodRecord.kt`) : il construit bien un
    `MenstruationPeriodRecord(startTime, endTime, …)` — un vrai intervalle. La déclaration
    TypeScript est simplement fausse. Sans cette vérification, l'implémentation serait partie sur
    un modèle plus complexe et inutile ; documenté en commentaire dans le fichier pour la prochaine
    mise à jour de la lib.
  - `MenstruationPeriodRecord.endTime` posé à **minuit du lendemain** du dernier jour de règles
    (borne exclusive) : une période d'un seul jour donnerait sinon `startTime === endTime`, que
    Health Connect refuse. Symétrique à la lecture (`selectPeriodsToImport` retranche 1 ms avant de
    redater localement).
  - `spotting` (notre niveau le plus faible, R7) n'a pas d'équivalent Health Connect (3 niveaux
    seulement) : mappé sur `LIGHT`, pas `UNKNOWN` — un flux « inconnu » se lirait comme
    « non renseigné » pour un partenaire santé, ce qu'un spotting n'est pas. Ce choix n'est pas
    réversible à l'import : Health Connect ne renvoie jamais `spotting`.
- [menstrual-cycle.ts (shared)](packages/shared/src/menstrual-cycle.ts) — `shouldImportCycleData`,
  throttle dédié (dupliqué depuis `shouldImportWeight`/`shouldImportSteps`, pas partagé — c'est déjà
  la convention du reste de l'intégration Health Connect : un throttle par domaine).
- [menstrual-cycle-repository.ts](apps/mobile/src/data/repositories/menstrual-cycle-repository.ts)
  — `getManualClosedPeriodsForExport`/`getDailyLogsWithFlowForExport` (lecture hors contexte React,
  export) ; `importPeriodFromHealthConnect`/`importDailyFlowFromHealthConnect` (écriture d'import,
  R21) :
  - Périodes : dédup sur `started_on`. Une période **saisie à la main** (`source = 'manual'`)
    trouvée à cette date n'est **jamais** modifiée, même si sa fin diffère de celle lue. Une
    période déjà importée (`source = 'health_connect'`) voit sa fin **mise à jour** — c'est la
    même période relue, pas un conflit.
  - Journal quotidien : `menstrual_daily_logs` **n'a pas** de colonne `source` (contrairement aux
    périodes) — impossible de distinguer une saisie manuelle d'un import antérieur. Politique
    volontairement conservatrice : un flux déjà présent n'est **jamais** modifié par un import, quelle
    que soit son origine. Plus strict que nécessaire pour le cas « réimport », mais garantit qu'une
    saisie manuelle n'est jamais écrasée (R21).
- [health-connect.ts (mobile)](apps/mobile/src/lib/health-connect.ts) — `CYCLE_PERMISSIONS` (4
  entrées : lecture/écriture × Period/Flow), `hasCyclePermissions`/`requestCyclePermissions`,
  `getCycleState`, `readyCycle()` (garde sur les **trois** opt-in R20 :
  `cycleTrackingEnabled` + `healthConnectEnabled` + `cycleHealthConnectEnabled` + permissions),
  `pushCycleData()` (périodes closes **saisies à la main** + flux, fire-and-forget), `importCycleData`/
  `importCycleDataIfDue` (throttle 6 h, retour au premier plan).
  - ⚠️ **`CYCLE_PERMISSIONS` est une liste séparée de `PERMISSIONS`**, jamais fusionnée.
    `hasPermissions()`/`getState()` conditionnent la synchro séances/poids/pas de **tout le monde** ;
    y ajouter 2 permissions de santé sensible aurait fait régresser en `permissions_missing` tous
    les comptes n'ayant jamais activé le cycle (opt-in indépendant, R20).
  - `pushCycleData()` n'exporte que les périodes **closes** (`MenstruationPeriodRecord` exige une
    fin — une période ouverte forcerait une fin provisoire fausse) et de source **`manual`**
    (réexporter une période elle-même importée serait un aller-retour inutile).
- Permissions Android `READ_MENSTRUATION`/`WRITE_MENSTRUATION` : **déjà déclarées** dans
  [app.json](apps/mobile/app.json) par un travail antérieur — vérifié, rien à ajouter côté manifest.
- Câblage UI : [CycleTrackingSection.tsx](apps/mobile/src/components/CycleTrackingSection.tsx)
  (interrupteur dédié → permissions système → push + import initial, même séquence que
  `HealthConnectSection.enable()`), [cycle/index.tsx](apps/mobile/src/app/cycle/index.tsx) (push
  fire-and-forget à la clôture d'une période), [CycleDaySheet.tsx](apps/mobile/src/components/cycle/CycleDaySheet.tsx)
  (push fire-and-forget à l'enregistrement d'un flux),
  [useHealthConnectImports.ts](apps/mobile/src/hooks/useHealthConnectImports.ts) (import throttlé
  au retour au premier plan, aux côtés du poids et des pas).
- [settings-repository.ts](apps/mobile/src/data/repositories/settings-repository.ts) —
  `getCycleTrackingEnabled`/`getCycleHealthConnectEnabled` (accesseurs async hors contexte React,
  même patron que `getHealthConnectEnabled`).
- Clé i18n `cycle.settings.healthConnectDenied` (FR/EN) — bandeau affiché si la demande de
  permissions échoue ou est refusée.
- RECETTES.md — section **#15 CYCLE-01** créée (20 critères §7 de la spec, jamais recensés
  jusqu'ici) avec un prérequis bloquant propre à cette US : les sync rules PowerSync du cycle
  n'ont, contrairement au lot du 29/07/2026, **aucune confirmation de déploiement**.

#### Technique / Notes

- Un test (`cycle-index-smoke.test.tsx`) mockait `react-i18next` mais pas `@/lib/health-connect` :
  le nouvel import de `pushCycleData` dans `cycle/index.tsx` remontait jusqu'à `@/i18n` (via
  `settings-repository`) et plantait `i18next.use(undefined)`. Même piège que documenté pour
  `cycle-insights-smoke.test.tsx` la veille — corrigé par un mock ciblé du module.
- `npm run typecheck` / `npm run lint` / `npm run test` (mobile Jest 247 + shared Vitest 1277) —
  lus sans pipe, tous verts.
- Front-matter `docs/specs/functional/us/cycle01-suivi-menstruel.md` : `etape: code` → `recette`.

### 31/07/2026 — `feature/cycle01-suivi-menstruel` — CYCLE-01 : calendrier, croisement complet, tests smoke

Commit précédent : `e947659`. Roadmap **1.25** et **1.26** restent 🟡 — seul Health Connect subsiste.

Reprise du travail codé la nuit précédente par une autre session, sur la base d'un audit complet du
code réel avant de continuer (voir la section « Ce qui reste » du commit `1fa7eee`). Trois des quatre
manques déclarés sont traités ; **Health Connect reste hors périmètre**, délibérément — il exige un
`expo prebuild` + un nouveau build (permissions natives) que le reste de cette US n'exige pas.

#### Ajouté

- [CycleMonthCalendar.tsx](apps/mobile/src/components/cycle/CycleMonthCalendar.tsx) — calendrier
  mensuel (navigation mois précédent/suivant, futur non navigable), coloré par intensité de flux et
  appartenance à une période, jour courant mis en avant, tap ouvre `CycleDaySheet` pour **n'importe
  quel jour** (pas seulement aujourd'hui). Pas de librairie externe — même famille de calcul que
  `PlanningPreview`, réécrite spécifiquement (les données à colorer n'ont rien à voir).
  - Le futur reste refusé (R4) : jour affiché mais non appuyable, cohérent avec
    `assertNotFuture` côté repository.
- Mini-calendrier de la **période en cours** sur le widget `CycleCard` (forme `large`) — bande de
  pastilles colorées par intensité de flux, du début de la période ouverte à aujourd'hui. Absent
  jusqu'ici malgré le commentaire du fichier qui l'annonçait déjà.
- **2 métriques de croisement** : `calories` (apport quotidien) et `pace` (allure de course), dans
  [cycle-insights-repository.ts](apps/mobile/src/data/repositories/cycle-insights-repository.ts).
  `CYCLE_INSIGHT_METRICS` passe de 4 à 6.
- 16 tests smoke Jest, sur 4 fichiers : `CycleMonthCalendar.test.tsx` (3),
  `CycleCard.test.tsx` (5), `cycle-index-smoke.test.tsx` (4), `cycle-insights-smoke.test.tsx` (4).
  Aucun écran de cycle n'en avait, malgré 33 tests Vitest côté calculs purs.
- 12 clés i18n FR/EN (`cycle.calendar.*`, `cycle.widget.periodStripA11y`,
  `cycle.insights.metrics.{calories,pace}`). Parité vérifiée : 1606 = 1606.

#### Corrigé

- ⚠️ **Le CHANGELOG de la nuit précédente affirmait à tort que les kcal/allure « nécessitaient un
  nouvel agrégat, ce n'est pas une simple lecture ».** Faux : `journal-repository.ts` expose depuis
  l'US 7.2 un `useDailyTotals(sinceDate)` qui agrège déjà `food_entries` par jour, et
  `run-repository.ts` calcule déjà `avgPaceSPerKm` par course. L'affirmation ne portait en réalité
  que sur `nutrition-repository.ts` (profil, cibles), pas sur le repository qui compte. Les deux
  métriques n'ont donc demandé **aucun nouvel agrégat** — seulement le branchement, comme les 4
  autres. `'1970-01-01'` est passé à `useDailyTotals` pour lire « depuis toujours », même convention
  que la période `'all'` de `records-repository.ts`.
- Commentaire périmé dans
  [data-export.ts](apps/mobile/src/lib/data-export.ts) : annonçait « 30 tables », le total réel est
  39 (37 avant CYCLE-01) — chiffre hérité d'une version antérieure du fichier, jamais mis à jour au
  fil des US qui l'ont étendu. Retiré plutôt que corrigé une fois de plus : le chiffre se périmerait
  à la prochaine US, `EXPORT_TABLES` fait foi.

#### Technique / Notes

- **Piège d'environnement rencontré, déjà documenté par la session précédente** (CHANGELOG,
  commit `1fa7eee` : « deuxième rencontre du même piège ») : `tsc` échoue sur toute nouvelle route
  Expo Router tant que `.expo/types/router.d.ts` (gitignored, généré) n'a pas été réécrit par un
  démarrage réel de Metro. Confirmé **pré-existant** (reproductible sur `dev` avant tout changement
  de cette session, via `git stash`) — pas une régression de CYCLE-01. Résolu en laissant
  `expo start` tourner ~50 s avant de l'arrêter proprement.
- **Décile de robustesse implicite** : le filtre `w.volumeKg > 0` du tonnage (séance cardio/poids du
  corps non mesurée, écartée plutôt que comptée zéro) ne s'applique **pas** aux calories — un jour à
  0 kcal ne peut pas exister dans `useDailyTotals` (agrégat `GROUP BY`, donc au moins une entrée par
  ligne renvoyée), contrairement au tonnage où 0 est une valeur réelle et trompeuse. Documenté dans
  le code pour que personne n'ajoute le même filtre par réflexe.
- **Le mini-calendrier du widget ne s'affiche que s'il y a une période ouverte** — état normal la
  plupart du temps, pas une régression silencieuse : couvert par un test dédié.
- **Vérifications** (codes de sortie lus **sans pipe**) : `npm run typecheck` 0 · `npm run lint` 0
  (30 warnings, tous préexistants) · `npm run test` 0 → **1257 tests Vitest** (inchangé, aucun calcul
  pur ajouté) + **247 tests Jest** (+16).
- **Reste sur CYCLE-01** : Health Connect (lecture/écriture `MenstruationPeriod`/`MenstruationFlow`,
  nouveau build, déclaration Play à 6 types — délai externe ~2 semaines). Traité comme un incrément
  séparé, sur la même branche.
- **Vérification humaine encore ouverte, non technique** : le redéploiement des sync rules PowerSync
  pour les 2 tables du cycle est affirmé dans le CHANGELOG/commit de la nuit précédente, mais
  indérivable du code — à confirmer dans le dashboard avant de considérer l'étape 1 close, vu
  l'historique d'oublis sur ce point précis.

### 31/07/2026 — `feature/cycle01-suivi-menstruel` — CYCLE-01 : réglages, désactivation et croisement

Commit précédent : `1fa7eee`. Roadmap **1.25 → 🟡**, **1.26 → 🟡**.

#### Ajouté

- [CycleTrackingSection.tsx](apps/mobile/src/components/CycleTrackingSection.tsx) — section des
  Réglages : opt-in principal, second interrupteur Health Connect (n'apparaît **que** si le suivi est
  actif), suppression des données, et l'avertissement répété au point d'activation.
- [cycle-insights-repository.ts](apps/mobile/src/data/repositories/cycle-insights-repository.ts) +
  [app/cycle/insights.tsx](apps/mobile/src/app/cycle/insights.tsx) — écran « Croisement », **4
  métriques** (énergie, humeur, stress, tonnage) étiquetées par phase.
- **2 permissions Health Connect** déclarées dans [app.json](apps/mobile/app.json) :
  `READ_MENSTRUATION` / `WRITE_MENSTRUATION`.
- i18n FR + EN : `cycle.settings.*` et `cycle.insights.*`, **pluriels en clés distinctes**.

#### Technique / Notes

- **R17 mis en œuvre dans le bon ordre** : à l'extinction, on coupe **d'abord** le réglage — la
  fonctionnalité disparaît immédiatement — **puis** on propose la suppression. L'inverse laisserait
  le widget affiché derrière une boîte de dialogue. Et « Garder » est un choix de premier rang, pas
  un bouton d'annulation déguisé : ce qui est conservé reste dans l'export RGPD.
- **Le seuil du croisement est vérifié métrique par métrique** (R13) : un bloc peut être disponible
  pendant qu'un autre annonce ce qui lui manque. Attendre que *tout* soit prêt donnerait un écran
  vide pendant des mois. Et le message dit **ce qui manque, phase par phase**, pas un « pas assez de
  données » opaque.
- ⚠️ **Une séance à tonnage nul est écartée, pas comptée comme faible.** Cardio ou poids du corps non
  chiffré : ce n'est pas une séance « légère », c'est une séance non mesurable sur cet axe. La
  compter zéro tirerait la moyenne vers le bas pour une raison qui n'a rien à voir avec le cycle.
  Même logique pour les jours sans phase déterminable : écartés plutôt qu'attribués par défaut.
- ⚠️ **Types de routes Expo Router** : deuxième rencontre du même piège, à chaque nouvelle route sous
  `app/`. `tsc` échoue tant que le serveur de dev n'a pas réécrit `.expo/types/router.d.ts`.
- Qualité : `typecheck` **0** · `lint` **0 erreur** · `test` **1257 shared + 231 mobile, 0 échec**.

#### ⏭️ Ce qui reste sur CYCLE-01

- 🔴 **Health Connect n'est pas câblé.** Les 2 permissions sont déclarées et les 2 interrupteurs
  existent, mais **aucune lecture ni écriture** n'est implémentée dans `lib/health-connect.ts`. Il
  faut aussi un `expo prebuild` + **nouveau build** (permissions natives) et la **déclaration Play à
  6 types**. C'est le plus gros reste, et son délai est externe.
- 🟠 **2 métriques de croisement non branchées** : apport calorique et allure de course. Aucun
  agrégat quotidien existant côté nutrition (`nutrition-repository` n'expose ni totaux ni kcal par
  jour) — à créer, ce n'est pas une simple lecture.
- 🟠 **Pas de calendrier mensuel** sur l'écran de détail : l'historique est une liste. La maquette en
  montre un ; c'est une finition d'affichage, la donnée est là.
- 🟠 **Aucun test mobile** sur les nouveaux écrans (les calculs, eux, ont 33 tests). À ajouter au
  niveau smoke, comme les autres écrans.

### 31/07/2026 — `feature/cycle01-suivi-menstruel` — CYCLE-01 étapes 3 & 4 : opt-in, widget, écrans

Commit précédent : `3d4fb5d`. Roadmap 1.25.

#### Ajouté

- **3ᵉ forme de garde de widget** dans [widgets.ts](packages/shared/src/widgets.ts) :
  `WidgetGuard = Pillar[] | 'always' | { setting: WidgetSettingKey }`. C'est **le** point technique
  de l'étape — voir Notes.
- [menstrual-cycle-repository.ts](apps/mobile/src/data/repositories/menstrual-cycle-repository.ts) —
  lectures réactives, `startPeriod` / `endPeriod` / `autoCloseStalePeriods` /
  `saveMenstrualDailyLog` / `deleteAllCycleData`.
- [CycleCard.tsx](apps/mobile/src/components/dashboard/CycleCard.tsx) — widget aux **3 formes**,
  14ᵉ entrée du hub Accueil.
- [app/cycle/index.tsx](apps/mobile/src/app/cycle/index.tsx) — écran de détail (bandeau
  d'avertissement en tête, état courant, prédiction, actions, historique) et
  [CycleDaySheet.tsx](apps/mobile/src/components/cycle/CycleDaySheet.tsx) — saisie flux + symptômes.
- **i18n FR + EN** : famille `cycle.*` complète (phases, flux, 8 symptômes, prédiction, historique,
  feuille). Les 3 états de prédiction et les pluriels sont des **clés distinctes**, jamais des
  concaténations.
- **6 tests** de garde par réglage dans [widgets.test.ts](packages/shared/src/widgets.test.ts).

#### Modifié

- [settings.ts](packages/shared/src/settings.ts) + [settings-repository.ts](apps/mobile/src/data/repositories/settings-repository.ts) :
  `cycleTrackingEnabled` et `cycleHealthConnectEnabled`, **`false` par défaut** — `null` ou colonne
  absente ne vaut **jamais** consentement.
- [widget-layout-repository.ts](apps/mobile/src/data/repositories/widget-layout-repository.ts) :
  le drapeau est passé aux deux appels de `resolveScreenLayout`.
- Comptes de widgets du hub Accueil : **13 → 14** (2 assertions de test mises à jour).

#### Technique / Notes

- 🔑 **Le registre de widgets ne savait exprimer que deux conditions** : une liste de piliers, ou le
  sentinelle `'always'`. Le cycle n'est **ni l'un ni l'autre** — il n'appartient à aucun pilier
  (donc pas de liste) mais ne doit pas s'afficher pour tout le monde (donc pas `'always'`). Plutôt
  qu'une **13ᵉ copie en ligne** de la décision d'accès (la dette relevée par REFACTO-01), le registre
  gagne une troisième forme de garde. `WIDGET_SETTING_KEYS` est volontairement une **liste fermée
  d'une entrée** : ce n'est pas un mécanisme de feature-flags générique.
- ⚠️ **Pour une garde par réglage, l'absence de valeur vaut NON.** C'est l'inverse du repli des
  piliers (où l'absence de garde vaut « visible »), et c'est délibéré : un drapeau manquant
  (réglages pas encore chargés, ligne locale d'avant la migration) doit **masquer** le widget. Le
  paramètre `flags` de `resolveScreenLayout` est optionnel — un appelant qui l'oublie cache le
  widget au lieu de le révéler, ce qui est le sens sûr de l'erreur. Un test verrouille les deux cas.
- ⚠️ **`fullScreenFrom` passe `cycleTrackingEnabled: true` volontairement.** C'est la base **non
  filtrée** sur laquelle opèrent les mutateurs de layout : sans ce drapeau, réagencer n'importe quel
  autre widget ferait **disparaître `cycle` du JSON stocké**, et sa position serait perdue.
- **La garde d'opt-in est appliquée au niveau du repository, pas seulement de l'UI.** Masquer un
  écran ne garantit pas qu'aucune ligne n'est écrite ; sur une donnée sensible, la garantie doit
  tenir au point d'écriture. Elle lit le réglage **en base locale** et non dans un store React —
  un état désynchronisé laisserait passer une écriture.
- ⚠️ **`deleteAllCycleData` ne passe PAS par cette garde** : on doit pouvoir supprimer *après* avoir
  désactivé (R17).
- **Un jour sans flux ni symptôme est une saisie valide** : c'est ainsi qu'on efface une saisie
  précédente. Refuser la ligne vide rendrait la correction impossible. Idem pour le flux, qu'un
  second appui désélectionne.
- `startPeriod` est **idempotent sur `started_on`** et applique R2 dans la même passe (clôture de la
  période restée ouverte) — sans quoi l'index unique partiel rejetterait l'insertion.
- Le parse des symptômes est **tolérant** : valeur illisible ou code inconnu → liste vide plutôt
  qu'exception. Un journal de santé ne doit pas devenir inaccessible parce qu'une ligne est malformée.
- ⚠️ **Types de routes Expo Router à régénérer** après création de `app/cycle/` : `tsc` échoue tant
  que le serveur de dev n'a pas réécrit `.expo/types/router.d.ts`. Piège non évident — l'erreur
  parle d'un type de chaîne, pas d'un fichier manquant.
- Qualité : `typecheck` **0** · `lint` **0 erreur** (29 warnings préexistants) · `test` **1257 shared
  + 231 mobile, 0 échec**.
- ⏭️ Reste : croisement par phase, écran de réglages + désactivation, Health Connect, solde.

### 31/07/2026 — `feature/cycle01-suivi-menstruel` — CYCLE-01 étapes 1 & 2 : socle de données et calculs

Commit précédent : `4bff808`. **Validée par Damien** → `etape: validation` → `code`. Roadmap 1.25 / 1.26.

#### Ajouté

- **2 migrations poussées sur le cloud** (44 → 46), cochées dans [MIGRATIONS.md](supabase/MIGRATIONS.md) :
  `menstrual_periods` (début / fin / `source`) et `menstrual_daily_logs` (flux / symptômes `jsonb`),
  **volontairement sans FK entre elles** — un jour de flux peut exister sans période déclarée, les
  lier imposerait un ordre de saisie que personne ne respecte. Découpage **calqué sur Health
  Connect** (`MenstruationPeriod` / `MenstruationFlow`) pour que l'étape 7 soit une correspondance
  directe. + `user_settings.cycle_tracking_enabled` et `cycle_health_connect_enabled`, **tous deux
  `default false`**.
- [menstrual-cycle.ts](packages/shared/src/menstrual-cycle.ts) — 8 fonctions **pures** couvrant
  R2, R3, R5, R6, R8, R9, R10, R12, R13, R14. **33 tests**, écrits avant le code.
- Vocabulaire fermé exporté : 4 niveaux de flux, **8 symptômes**, 4 phases. Aucun champ libre (R7).

#### Modifié

- [powersync/schema.ts](apps/mobile/src/powersync/schema.ts) : les 2 tables déclarées.
- [powersync-sync-rules.yaml](docs/specs/technical/powersync-sync-rules.yaml) : 2 lignes ajoutées au
  bucket `user_data` — **déployées par Damien le 31/07**.
- [data-export.ts](apps/mobile/src/lib/data-export.ts) : export RGPD **28 → 30 tables**. Traité dès
  l'étape 1, pas relégué en finition : sur une catégorie sensible, l'omettre serait un manquement
  réglementaire, et les données conservées après désactivation (R17) restent exportables.

#### Technique / Notes

- 🔑 **L'index unique partiel `(user_id) where ended_on is null and deleted_at is null`** est la
  contrainte qui protège tout le reste : sans elle, un oubli de « fin » laisse deux périodes ouvertes
  et fausse **silencieusement** les longueurs de cycle, donc la moyenne, donc la prédiction.
- ⚠️ **La borne des 15 jours n'est PAS un `check` SQL**, et c'est délibéré. R3 veut une clôture
  *automatique*, pas un refus : un `check` rejetterait aussi les imports Health Connect plus longs,
  alors que la règle veut les **accueillir puis les signaler**. Refuser la donnée aurait été pire.
- ⚠️ **L'opt-in n'est pas non plus une contrainte SQL** : il doit rester possible de *conserver* les
  données quand l'utilisatrice désactive le suivi sans les supprimer (R17, « garder » est un choix).
  La garde est applicative, au niveau du repository (étape 3).
- **Aucune fonction de `menstrual-cycle.ts` ne produit de phrase** — elles renvoient nombres et
  états, les libellés vivent en i18n. Ce n'est pas du style : c'est ce qui permettra de relire
  **toutes** les formulations d'un coup au critère de recette 14, au lieu de les traquer dans le
  calcul.
- **Trois choix de calcul qui méritent d'être connus** :
  1. `predictNextPeriod` a un **plancher de fourchette à 1 jour**. Sur des cycles parfaitement
     réguliers la dispersion est nulle, et annoncer une date **sans** fourchette la ferait lire
     comme une certitude.
  2. Une prédiction **déjà dépassée est rendue telle quelle** — aucune notion de « retard » nulle
     part (R11). Un test verrouille ce comportement.
  3. `phaseForDate` renvoie **`null`** dans trois cas normaux et fréquents : avant toute période
     connue, au-delà d'un cycle invraisemblable (données périmées), et hors phase menstruelle tant
     que la longueur moyenne est inconnue. Se taire plutôt que deviner.
- Les **cycles aberrants sont exclus du décompte du seuil autant que de la moyenne** : un historique
  contenant 3 cycles valides + 1 aberrant est `ready` sur 3, pas 4. Testé.
- Qualité : `typecheck` **0** · `test` shared **1251 passés / 64 fichiers** (+33).
- ⏭️ Reste : étapes 3 à 8. Et **2 démarches externes à lancer** (déclaration Health apps à 6 types,
  relecture juridique du paragraphe cycle) — délais en série, hors du chemin du code.

### 31/07/2026 — `feature/cycle01-suivi-menstruel` — CYCLE-01 : widget au lieu d'un 5ᵉ onglet

Commit précédent : `44f74eb`. Toujours **aucun code applicatif** — `etape: validation`.

#### Modifié

- **Arbitrage Damien : pas d'onglet de navigation pour le cycle, un widget complet.** La maquette
  Claude Design plaçait « Cycle » en **5ᵉ onglet** ; c'est écarté. À la place : un widget `cycle` sur
  le hub Accueil, décliné sur les **3 formes** (`small` / `wide` / `large`), l'écran de détail étant
  atteint en appuyant dessus — le patron de `steps` (PAS-01) et `wellbeing` (BIEN-01).
  → spec **R16 bis**, plan **étape 4** (6 h → 8 h), roadmap 1.25.
- **Deux raisons, toutes deux issues de décisions antérieures** : BIEN-01 avait explicitement tranché
  que le bien-être est une « 4ᵉ dimension légère, **pas** un 4ᵉ pilier » — le cycle est de la même
  famille et en faire un onglet le hisserait au-dessus sans justification ; et la barre du bas varie
  déjà de **2 à 5 entrées** selon les piliers activés (décision H).

#### Ajouté

- [ECART-AVEC-LA-SPEC.md](design/cycle01-suivi-menstruel/ECART-AVEC-LA-SPEC.md) dans le dossier de
  maquette. La maquette reste la référence pour **tout le reste** ; seule la barre de navigation est
  à ignorer. Sans cette note, quelqu'un qui implémente en lisant le HTML sans la spec recréerait
  l'onglet — c'est le genre d'écart qui se rattrape en recette, trop tard.

#### Technique / Notes

- ⚠️ **Le widget introduit une troisième dimension de filtrage, et c'est le vrai point technique de
  l'étape 4.** `WIDGET_REGISTRY` ([widgets.ts](packages/shared/src/widgets.ts)) ne connaît que deux
  cas : une **liste de piliers**, ou le sentinelle **`'always'`**. Le cycle n'est **ni l'un ni
  l'autre** — il n'appartient à aucun pilier (donc pas de liste) mais ne doit pas s'afficher pour
  tout le monde (donc pas `'always'`) : il dépend d'un **réglage**. C'est exactement la dette relevée
  par **REFACTO-01** (~12 copies en ligne de la décision d'accès). Consigne posée dans la spec
  (R16 ter) et le plan : **étendre proprement le registre à un garde par réglage**, ne pas ajouter
  une 13ᵉ copie.
- La capture **04 Historique**, absente du bundle, a été relue depuis une image partagée par Damien :
  elle confirme **R6** (le cycle de 119 j porte « ignoré du calcul » avec « exclu de la moyenne, mais
  conservé — rien n'est effacé ») et **R5** (chaque ligne porte la longueur du cycle qui *commence* à
  cette date). Le fichier n'a pas pu être récupéré sur disque.
- La maquette affiche aussi une **durée de règles** (« 5 j de règles ») distincte de la longueur du
  cycle. **Dérivable du modèle tel quel** (`ended_on − started_on`) — aucune colonne à ajouter.

### 31/07/2026 — `feature/cycle01-suivi-menstruel` — maquette Claude Design intégrée

Commit précédent : `4bef8d8`. **Aucun code applicatif** — CYCLE-01 reste à `etape: validation`.

#### Ajouté

- **Maquette Claude Design** dans [design/cycle01-suivi-menstruel/](design/cycle01-suivi-menstruel/) :
  `FitTrio - Cycle.dc.html` (6 écrans), son aperçu `.preview.webp`, le `README` du bundle, et
  **5 captures** nommées d'après l'écran qu'elles montrent (onglet cycle, saisie du jour, prédiction
  état A, croisement, réglages) — clair **et** sombre.
- [PROMPT-claude-design.md](design/cycle01-suivi-menstruel/PROMPT-claude-design.md) — le prompt qui a
  produit la maquette, versionné pour être rejouable si la charte bouge.

#### Supprimé

- `cycle01-suivi-menstruel.html` — la maquette **d'attente** que j'avais dessinée à la main le 30/07.
  Remplacée par l'export Claude Design, qui est le livrable attendu par le workflow. Garder les deux
  aurait exposé au risque d'implémenter la mauvaise. Récupérable dans l'historique git.
- Dossier `TEMP/` à la racine, après vérification par empreinte (voir Notes).

#### Technique / Notes

- ⚠️ **Le bundle livré avait des noms et des extensions systématiquement faux.** Sur 34 fichiers :
  `FitTrio - Cycle.dc.html` était en réalité une **image WEBP**, `01-cycle-check.png` du **HTML**,
  `Architecture Applicative (3).md` un **JPEG**, `download (3)` du **Markdown**, `support (2) (2).js`
  un JPEG… Les noms étaient **décalés par rapport aux contenus**. Identification faite par
  **octets d'en-tête et par contenu**, jamais par nom — la vraie maquette Cycle se cachait sous
  `FitTrio - Nutrition.dc (2).html` (75 occurrences du vocabulaire du cycle).
- **Tri par empreinte MD5 avant toute suppression** : sur 34 fichiers, **24 étaient des doublons
  exacts** de fichiers déjà dans `design/` (partage01, FitTrio, support.js…), **3 des doublons
  internes**, et **4 une image blanche vide** (raté d'export, présente en 4 exemplaires) — écartée.
  Il ne restait que **8 fichiers utiles**. Vérifié qu'aucun fichier de `TEMP/` n'était perdu avant de
  supprimer le dossier.
- **Aucune capture de l'écran 04 (historique)** dans le bundle — l'écran existe bien dans le HTML,
  seule la capture manque. Sans conséquence.
- **Conformité de la maquette à la spec vérifiée**, point par point : avertissement « carnet, pas un
  dispositif médical » présent · les **3 états de prédiction** (dont « trop irrégulier », sans date) ·
  fourchette ± · 4 phases · cycle aberrant marqué « ignoré » · opt-in désactivé par défaut · seuil
  affiché **par métrique**. Et les 5 formulations interdites sont **absentes** (fertilité, conception,
  probabilité de grossesse, « consulte un médecin », « évite les séances »).

### 30/07/2026 — `feature/cycle01-suivi-menstruel` — CYCLE-01 cadrée (spec + plan + maquette)

Commit précédent : `0aff4d2`. Roadmap **1.25 / 1.26** (lignes **créées**). **Aucun code applicatif** —
`etape: validation`, en attente du feu vert de Damien ou Florian.

#### Ajouté

- [spec](docs/specs/functional/us/cycle01-suivi-menstruel.md) ·
  [plan](docs/plans/cycle01-suivi-menstruel.md) ·
  [maquette](design/cycle01-suivi-menstruel/). *(Maquette d'attente remplacée le 31/07/2026 par
  l'export Claude Design — voir l'entrée du 31/07.)*
- **Roadmap 1.25 et 1.26 créées.** Le sujet n'existait **nulle part** avant aujourd'hui : zéro
  occurrence de `menstrual`/`ovulation`/`luteal`/`follicular` dans le code, les **58 migrations**, les
  220 items du catalogue d'analyses et IDEAS.md.

#### Technique / Notes

- **4 arbitrages de Damien, tous en option maximale** : périmètre **journal + prédiction +
  croisement** · **tout part en V1** · **Health Connect dès maintenant** · **opt-in pour tous, sans
  filtre sur `sex`**. J'ai signalé le coût, il a été réaffirmé — c'est acté.
- 🔴 **Conséquence chiffrée sur le lancement : chemin critique ~3 → ~5 semaines.** La relecture
  juridique s'élargit à une catégorie sensible, et une **nouvelle déclaration Health apps** (~7 j
  d'instruction + 5-7 j ouvrés de propagation) s'ajoute **en série**.
- **Deux documents de conformité marqués périmés en tête**, pour qu'aucune fiche ne parte sur
  l'ancienne version : [lance00-fiche-play-et-confidentialite.md](docs/specs/technical/lance00-fiche-play-et-confidentialite.md)
  (§1 politique, §3 Sécurité des données, §4 déclaration) et
  [health-connect-play-declaration.md](docs/specs/technical/health-connect-play-declaration.md)
  (§2 bis ajouté : 4 → **6 types**, avec justifications prêtes à coller). ⚠️ **La déclaration doit
  être déposée une seule fois avec les 6 types** — la déposer à 4 puis l'étendre ferait payer deux
  fois les ~2 semaines.
- **Le risque dominant de cette US n'est pas technique, il est rédactionnel.** Une formulation qui
  laisserait croire à une fiabilité contraceptive ou à un avis médical est un défaut **bloquant**
  (critère de recette 14). Deux garde-fous structurels en réponse : les fonctions de calcul **ne
  produisent aucune phrase** (elles renvoient nombres et états, les libellés vivent en i18n, donc
  toutes les formulations se relisent d'un coup), et le croisement n'affiche que des **moyennes
  observées** — jamais une causalité ni un conseil.
- **Aucune notification, jamais** (R11) : ni rappel, ni alerte de retard. C'est le point précis où un
  carnet devient anxiogène, voire un substitut de test.
- **Seuils anti-bruit** : pas de prédiction sous 3 cycles complets ; **pas de date du tout** si
  l'écart-type dépasse 7 jours ; pas de croisement sous 3 cycles **et** 10 jours par phase, vérifié
  **métrique par métrique**. Un cycle aberrant est **exclu du calcul mais jamais effacé**.
- **Modèle calqué sur Health Connect** (`menstrual_periods` + `menstrual_daily_logs` ↔
  `MenstruationPeriod` + `MenstruationFlow`) : la synchronisation devient quasi directe au lieu
  d'exiger une couche de traduction.
- **Symptômes en liste fermée, aucun champ libre** : un texte libre dans une donnée de santé sensible
  est un risque disproportionné, et il ne serait ni traduisible ni exploitable en croisement.
- **Export RGPD traité dès l'étape 1 du plan** (`EXPORT_TABLES` 28 → 30) : une donnée sensible absente
  de l'export est un manquement réglementaire, pas une finition.
- ⚠️ Le plan impose **1 migration + redéploiement manuel des sync rules** et un **nouveau build**
  (permissions natives) : la recette ne se fera **pas** sur l'APK actuel.

### 30/07/2026 — `docs/reconciliation-30-07` — réconciliation : le suivi rattrape le code

Commit précédent : `a073b9a`. **Aucun statut de livraison ne change** — rien n'a été codé aujourd'hui
hors le restyle de `ShareCard`. Cette entrée solde l'**écart entre ce que la documentation affirmait
et ce que le code dit**.

#### Corrigé — 4 affirmations fausses

| Où | Ce qui était écrit | Le réel, vérifié |
|---|---|---|
| roadmap **9.12** | « le clair passe désormais AA sur texte **et** composants » | **3 non-conformités** subsistent en clair (`success` 3,23 · `warnText` 3,19 · `amber` 2,29). La 1ʳᵉ passe n'avait mesuré que 3 paires. |
| BACKLOG **RUN-F3** | « aujourd'hui la météo n'est qu'un champ post-séance » | **Aucun champ météo n'existe.** `runs` = distance, durée, allure, tracé, rpe, notes. `weather`/`terrain`/`elevation` absents des **58 migrations**. |
| BACKLOG « suivi » | « 2 tests mobile en échec par timeout (~250 s/suite) » | **Non reproduit.** 44 suites / 231 tests verts en 20 s ; les 2 incriminées en 6,4 s et 7,2 s. |
| BACKLOG « suivi » | `main` à **927** commits de retard | **972** au 30/07/2026. |

#### Modifié — 4 candidats sortis du backlog vers le pipeline

**CONF-07**, **MUSC-F9**, **MUSC-F1b**, **RUN-F3** ont désormais spec + plan (+ maquette pour les
trois premiers) et `etape: validation`. Conformément à la règle du dépôt, ils **quittent le backlog**.
Il reste **2 P0**, tous deux **hors-code** : LANCE-00 et LANCE-01.

#### Ajouté

- **RUN-F3b — Météo de course**, nouveau candidat P1 **scindé de RUN-F3**. Motif : une requête météo
  transmet des **coordonnées à un service tiers**, ce qui contredit la politique de confidentialité et
  le formulaire « Sécurité des données » rédigés le jour même pour LANCE-00. 🔴 **À trancher avant de
  soumettre la fiche Play**, sinon la déclaration sera à refaire.

#### Technique / Notes

- **Vérifié, et exact** : l'entrée RUN-F1b (dénivelé bloqué) dit vrai — `GpsPoint` est bien
  `{ lat, lng, t }` dans [running.ts](packages/shared/src/running.ts), sans altitude, et aucune
  colonne d'élévation n'existe. Contrôlée plutôt que recopiée.
- **Le motif commun aux 4 erreurs** : chacune était une affirmation **plausible et invérifiée**, née
  d'un audit partiel présenté comme complet. Le garde-fou proposé par CONF-07 (un test qui échoue si
  une paire de contraste repasse sous son seuil) répond exactement à ça — une mesure qui tourne vaut
  mieux qu'une phrase dans un fichier.
- `node scripts/etat.mjs` : **93 specs, 18 en cours, 2 P0**. Aucune spec sans front-matter.

### 30/07/2026 — `docs/lance00-prerequis-publication` — prérequis de publication rédigés d'avance

Commit précédent : `0df5e02`. Roadmap **9.2** (LANCE-00). Objectif : que la création du compte Play
— délai externe de plusieurs jours — ne soit **pas** suivie d'une seconde attente de rédaction.

#### Ajouté

- [lance00-fiche-play-et-confidentialite.md](docs/specs/technical/lance00-fiche-play-et-confidentialite.md)
  — politique de confidentialité **publiable** (distincte du résumé in-app, qui reste un brouillon
  assumé), fiche Play (titre 29 car., description courte 79 car., description complète), réponses au
  formulaire **Sécurité des données** établies d'après les **41 tables réelles** des migrations, et
  l'ordre d'exécution des 6 étapes en série.

#### Corrigé

- **`app.json` : `version` `0.0.0` → `1.0.0`.** Incohérent avec le `runtimeVersion: "1.0.0"` déjà
  présent, et la roadmap vise V1.0 au lancement. ⚠️ **Effet de bord à connaître** : le suivi
  analytics (9.10) enregistre cette valeur — **toutes les mesures collectées jusqu'ici portent
  `0.0.0`** et sont indistinguables entre elles.

#### Technique / Notes

- 🟠 **Trouvé en relisant `app.json` : l'app démarre sur un écran bleu Expo.**
  `expo-splash-screen.backgroundColor` vaut `#208AEF` et `android.adaptiveIcon.backgroundColor`
  `#E6F4FE` — les **couleurs du gabarit de départ**, jamais remplacées. La palette du produit est
  crème `#f7eede` / terracotta `#dd6e40`, et `expo-notifications` est déjà correctement réglé sur
  `#dd6e40`. C'est la **première chose vue à chaque lancement**, et c'est le fond de l'icône sur la
  fiche Play. **Non corrigé ici** : c'est un choix de charte (proposition `#f7eede` pour les deux)
  → Damien/Florian, à trancher avec CONF-07 §4.
- 🟠 Pas de `android.versionCode` explicite : EAS l'incrémente, mais le **build local Gradle** n'est
  alors pas reproductible. Play refuse un `versionCode` déjà soumis et ne le dit qu'à l'upload.
- 🔴 **Deux trous que je ne peux pas combler** : l'identité du **responsable de traitement** et
  l'**e-mail de contact** sont exigés par le RGPD et laissés en `<à compléter>` — les inventer serait
  produire un document juridiquement faux. La **version EN** de la politique est également à produire
  (décision G : FR + EN dès le lancement), de préférence avant la relecture juridique pour n'en faire
  qu'une.
- Trois affirmations de la fiche sont signalées comme **à revérifier avant publication** (« gratuit
  sans abonnement », « aucune publicité », captures d'écran) : une fiche qui promet ce que l'app ne
  fait pas est un motif de rejet, et les captures sont contrôlées par un humain chez Google. Les
  captures ne doivent pas être produites **avant** l'arbitrage CONF-07 (les couleurs de boutons
  peuvent changer).

### 30/07/2026 — `fix/conf07-accessibilite` — CONF-07 cadrée (spec + plan + maquette)

Commit précédent : `cf17e5c`. Roadmap **9.11 / 9.12**. **Aucun code applicatif** — l'US s'arrête à
`etape: validation`, 2 décisions de charte en attente.

#### Ajouté

- [spec](docs/specs/functional/us/conf07-accessibilite.md) · [plan](docs/plans/conf07-accessibilite.md)
  · [maquette](design/conf07-accessibilite/conf07-accessibilite.html) (comparatif avant/après).

#### Corrigé

- ⚠️ **Affirmation fausse rectifiée dans la roadmap 9.12** (et au CHANGELOG du 30/07 matin) : « le
  clair passe désormais AA sur texte **et** composants ». **Faux.** La 1ʳᵉ passe
  (`fix/theme-contraste-et-flash`) n'avait mesuré que **3 paires texte/fond**. Un audit exhaustif —
  toutes les paires réellement employées, seuil choisi d'après l'**usage constaté dans le code** et
  non d'après le nom du token — trouve **5 non-conformités restantes**.

  | Rôle | Thème | Mesuré | Seuil | Pourquoi ce seuil |
  |---|---|---|---|---|
  | `accentText` / `accent` | sombre | **3,29** | 4,5 | libellé de **chaque bouton plein**, mode par défaut |
  | `warnText` / `warn` | clair | **3,19** | 4,5 | c'est du texte (DeficitVolumeAlertCard, StreakCard, GoalCard) |
  | `success` / `background` | clair | **3,23** | 4,5 | employé **comme texte** (sign-in, steps, WeightGoalCard) |
  | `amber` / `background` | clair | **2,29** | 3,0 | couleur de **donnée** — échoue **même au seuil abaissé** |
  | `accent` / `surface` | sombre | **4,45** | 4,5 | à 0,05 du seuil |

#### Technique / Notes

- **Valeurs correctives calculées**, pas choisies à l'œil : recherche de l'assombrissement **minimal**
  en HSL franchissant le seuil, teinte et saturation **conservées** (règle R1, héritée de la 1ʳᵉ passe).
  → `success` `#66714b` (4,53) · `warnText` `#8a6419` (4,52) · `amber` `#b47f31` (3,03) ·
  `accentText` sombre `#1c150e` (5,48).
- **`success` et `chartGreen` divergent désormais** alors qu'ils partagent `#7c8a5b`. `success` est du
  texte (4,5) et descend ; `chartGreen` ne peint que des courbes (3,0) et **ne bouge pas** — les
  assombrir tous les deux noircirait les graphes pour un gain nul. Ce sont déjà deux tokens distincts.
- **Dynamic Type (9.11) : la conclusion est de ne *rien* poser.** Les 41 écrans à 1,5× ne montrent
  aucune troncature. Poser des `maxFontSizeMultiplier` en masse *dégraderait* l'accessibilité (brider
  l'agrandissement) pour cocher une case.
- 🔴 **2 décisions de charte pour Damien / Florian** (spec §4) : **D1** — le libellé des boutons pleins
  passe du blanc au brun foncé en sombre, changement très visible, d'où la maquette ; **D2** — l'écart
  de 0,05 sur `accent`/`surface`, recommandation **écart assumé et documenté**.
- **Le vrai livrable durable est le garde-fou** : le plan prévoit d'ancrer l'audit dans un test qui
  échoue si une paire repasse sous son seuil. La 1ʳᵉ passe a échoué **parce que rien ne mesurait** —
  d'où un ordre de build inversé, test rouge **avant** correctif.

### 30/07/2026 — `feature/refonte-nutrition` — carte de partage : charte alignée sur le thème sombre

Commit précédent : `56ea41d`. US **PARTAGE-01** (roadmap **7.17**), reste à `etape: recette`.

Change l'habillage de la carte partageable livrée le 29/07/2026, **avant** sa recette device.
Aucune logique métier touchée : uniquement des constantes de couleur et un cadre.

#### Modifié

- **Charte de la carte** ([ShareCard.tsx](apps/mobile/src/components/share/ShareCard.tsx)) — abandon
  du bordeaux/doré (`#6b0028` / `#c9a96e`) au profit des couleurs du **thème sombre** :
  `CARD_BG #1c130c` · `CARD_ACCENT #dd6e40` · `CARD_TEXT #f4ecdd` · `CARD_MUTED #c9b79a`.
  **Ce n'est pas un correctif d'accessibilité** — les deux directions passaient AA. C'est une mise
  en cohérence : le bordeaux ne renvoyait à rien de visible dans l'app, alors que l'image circule
  **hors** de l'app, où reprendre les couleurs du produit la rend reconnaissable.
- **Cadre du bloc records** — fond `rgba(221,110,64,0.14)` + trait `rgba(221,110,64,0.34)`, rayon et
  rembourrage proportionnels à `size`. Détache le bloc **sans introduire une cinquième couleur**.

#### Ajouté

- **Maquette** [design/partage01-carte-partageable/](design/partage01-carte-partageable/) — 13
  fichiers (Claude Design) : les deux directions comparées (`existing` vs `proposed`) et les
  aperçus de contrôle.

#### Technique / Notes

- ⚠️ **Les couleurs sont volontairement recopiées du thème sombre, pas lues via `useTheme()`.** La
  carte doit rendre **à l'identique quel que soit le thème actif** : une carte claire chez l'un et
  sombre chez l'autre ne serait plus une identité. Le lien avec la palette est intentionnel mais
  **figé** — si la palette sombre bouge, ces 4 constantes ne suivront pas toutes seules.
- `borderWidth: 1` laissé **fixe** (non proportionnel à `size`) : c'est un trait, il ne doit pas
  grossir avec la carte. Vérifié sur l'aperçu à 320 dp.
- Contrastes mesurés contre `CARD_BG` : texte **15,58** · secondaire **9,34** · accent **5,56**
  (AA ≥ 4,5 partout).
- **Recette PARTAGE-01 impactée** : les critères visuels décrivaient la carte bordeaux. Ils sont
  réécrits dans [RECETTES.md](RECETTES.md). La recette exigeait déjà un **second build**
  (`react-native-view-shot` est natif) — ce commit ne change pas ce besoin.
- Qualité au moment du commit : `typecheck` ✅ · `lint` ✅ (0 erreur, 29 warnings préexistants de
  variables inutilisées) · `test` ✅ **1218 shared + 231 mobile, 44 suites, 0 échec**.
- **Constat de suivi corrigé dans [BACKLOG.md](BACKLOG.md)** : les « 2 tests mobile en échec par
  timeout » (`edit-exercise-modal-smoke`, `exercise-detail-smoke`) **ne se reproduisent pas** —
  6,4 s et 7,2 s isolément, contre un budget de 15 s. Le « ~250 s par suite » était un artefact de
  poste chargé. Entrée close, aucun `testTimeout` relevé. Compteur de retard de `main` réactualisé
  (927 → 972).

### 30/07/2026 — `feature/refonte-nutrition` — refonte visuelle du journal alimentaire

Commit précédent : `5fda5e3`. Roadmap : **4.37** et **7.14** (lignes créées hors cadrage).

Maquette source : [FitTrio - Nutrition.dc.html](design/FitTrio%20-%20Nutrition.dc.html) (Claude Design,
10 écrans). **Seul l'écran 01 (journal) est réimplémenté** ; les 9 autres écrans du pilier gardent leur
habillage actuel.

#### Ajouté

- **Carte héros « Bilan du jour »** ([DayBalanceCard.tsx](apps/mobile/src/components/nutrition/DayBalanceCard.tsx)) —
  anneau calorique, restant au centre, détail Consommé / Objectif / Restant, badge de bonus séance.
  La maquette proposait deux variantes (anneau vs chiffres géants) : **l'anneau est retenu**, c'est la
  forme déjà employée par le widget `NutritionSummaryCard` et le timer de repos. Le dépassement n'est
  pas traité comme une faute (couleur `danger` + libellé « au-delà », aucune alerte).
- **Macros en 3 colonnes** ([MacroTriple.tsx](apps/mobile/src/components/nutrition/MacroTriple.tsx)) —
  la carte passe de ~200 px à ~90 px. Remplissage borné à 100 %.
- **Grille de micronutriments à couverture**
  ([MicroCoverageGrid.tsx](apps/mobile/src/components/nutrition/MicroCoverageGrid.tsx)) — mini-anneaux
  + % des VNR au lieu d'une liste de valeurs nues. Seuils de la maquette (vert ≥ 70 %, ambre 45–69 %,
  terracotta < 45 %). La couleur **ne porte pas seule** l'information (WCAG 1.4.1) : le % est écrit.
- **Valeurs nutritionnelles de référence**
  ([micronutrient-reference.ts](packages/shared/src/micronutrient-reference.ts)) — VNR de l'annexe XIII
  du **règlement (UE) 1169/2011**, 23 vitamines et minéraux, + `micronutrientCoverage` / `coverageLevel`.
  ⚠️ **Sodium et lipides détaillés volontairement exclus** : ce sont des **plafonds**, pas des cibles —
  afficher « 95 % couverts » sur du sel inverserait le message. Ces clés s'affichent sans anneau.
- **Cercle d'accent sur les cartes** ([AccentHalo.tsx](apps/mobile/src/components/AccentHalo.tsx)) +
  contexte d'identité de widget ([widget-identity.tsx](apps/mobile/src/components/widgets/widget-identity.tsx)),
  fourni par les deux grilles et consommé par le halo.
- Token de thème **`panelAccent`** (accent lisible sur fond `panel`).
- 25 tests : VNR (10), géométrie du halo (8), cartes du journal (9 dans
  [journal-cards-smoke.test.tsx](apps/mobile/src/components/nutrition/__tests__/journal-cards-smoke.test.tsx)),
  hydratation des repas (3).

#### Modifié

- [nutrition.tsx](apps/mobile/src/app/(tabs)/nutrition.tsx) — navigation par jour encartée
  (« Aujourd'hui » + date en sous-titre) ; cartes de repas (icône, total, menu `⋯` replié portant
  *Copier* / *Enregistrer comme modèle*) ; repas vides en carte pointillée ; **état « journée vide »
  plein** avec *Copier la journée d'hier* et *+ Ajouter un aliment*.
- **Repas et carte de suggestion masqués sur une journée vide** — l'état vide portait déjà les deux
  actions utiles ; empiler 5 cartes pointillées identiques par-dessus n'ajoutait que du bruit, et
  « il te manque 160 g de protéines » sur une journée vide n'est qu'une paraphrase de l'objectif.

#### Corrigé

- 🔴 **Perte de configuration des repas** — [nutrition-meals.tsx](apps/mobile/src/app/nutrition-meals.tsx).
  Le formulaire s'initialisait avec `useState(() => resolveMealConfig(nutritionProfile?.meals))` :
  l'initialiseur ne s'exécute qu'au **premier rendu**, alors que `useNutritionProfile` lit SQLite en
  asynchrone et renvoie `null` en attendant. L'écran affichait donc **toujours les 4 repas par défaut**,
  quelle que soit la configuration réelle — et « Enregistrer » l'écrasait silencieusement, les entrées
  de journal rattachées aux repas perdus basculant dans la section « Autres ».
  **Reproduit en recette sur device** : un repas créé puis l'écran rouvert → il avait disparu du
  formulaire. Explique très probablement les entrées « Autres » déjà présentes en base.
  Correctif : état à `null` jusqu'à `isLoading === false`, indicateur de chargement, initialisation
  **unique** (une resynchro écraserait les saisies en cours), garde-fou dans `save()`.
  `nutrition-profile.tsx` a été vérifié : il dérive ses valeurs à chaque rendu, il n'a pas ce défaut.
- **Rose saumon en thème clair** — repas vides, pastille `+`, bouton `⋯` et icône d'état vide
  utilisaient `surfaceAlt`, qui est la surface **teintée accent** du design system (`--soft`), pas un
  neutre. Invisible en thème sombre, franchement rose en clair. Repassés sur `surface` / `track`.

#### Technique / Notes

- **Halo : le bord net est voulu.** Une variante en dégradé radial (`react-native-svg`) a été
  implémentée pour adoucir l'arête, puis **écartée par Damien** après comparaison sur device au profit
  du cercle de la maquette. C'est noté dans le fichier — ne pas le « corriger » lors d'un futur passage.
- **Halo : géométrie et présence par hachage** (FNV-1a de l'id du widget). Trois tranches
  indépendantes du hash → coin, taille, présence. ~**1 carte sur 3** en porte : un cercle sur *chaque*
  carte n'accentue plus rien. Déterministe (pas de saut au re-render) et stable au réagencement (la clé
  est l'id, pas la position). Hors grille, repli sur une géométrie par module (`MENU_HALO`).
- Diamètre du halo indexé sur `pad` (90 / 115 / 140) et opacité à .1 sur les cartes claires : le cercle
  fixe de 150 de la maquette, dessiné pour une carte pleine largeur, couvrait le tiers d'une petite tuile.
- **Dossier `design/` mis à jour.** L'export Claude Design avait des **noms de fichiers mélangés** (la
  maquette Nutrition s'appelait `FitTrio.dc (2).html`, le `support.js` était un `.png`) : la
  réconciliation s'est faite **par empreinte MD5**, pas par nom. 19 des 23 fichiers étaient déjà présents
  à l'identique ; 4 étaient neufs.
- **Écran recetté sur device** (Pixel 6a, APK release local) : bilan, macros, grille micros avec de
  vraies données (Magnésium 22 %, Calcium 10 %, Fer 7 %, Sodium et Sel sans anneau), cartes de repas,
  swipe Modifier/Supprimer, états vides, thèmes clair et sombre, et le parcours complet de
  « Gérer les repas » (ajout, renommage, réordonnancement, suppression).
- ⚠️ **Reste à faire** : les écrans 02 à 10 du pilier (détail d'entrée, sélection d'aliment, scan,
  saisie rapide, aliment perso, recette, profil, statistiques, gestion des repas) gardent leur
  habillage d'origine. Le choix entre les variantes « anneau » et « chiffres » du bilan reste
  ré-ouvrable — la seconde est dans la maquette.
### 30/07/2026 — `feature/muscf8-notifications-muscu` — notifications muscu : push de record agrégé, célébration animée, rappel de séance (US MUSC-F8, roadmap 3.42/2.7/2.4)

Commit précédent : `0710b73`.

Trois capacités : un **push « nouveau record »** agrégé (un seul par séance, jamais un par record),
la **célébration animée** au résumé de séance, et un **rappel de séance planifiée** — recadré en
échéance apprise, parce que la formulation de la roadmap (« 30 min avant ») décrit quelque chose que
le modèle de données ne permet pas. Au passage, cette US **solde la décision D3** de NUTR-F1 : le
plafond quotidien devient réel pour les notifications immédiates.

**Aucune migration, aucune sync rule, aucune dépendance native, aucun nouveau build** : 3 nouvelles
préférences dans la colonne JSON déjà synchronisée, `trigger: { channelId }` étant déjà du SDK 57
installé.

#### Deux erreurs de conception corrigées en revue, avant livraison

- 🔴 **J'apprenais `started_at` au lieu de `finished_at`** pour le rappel de séance — la même erreur
  que D1 (NUTR-F1), sous une autre forme. Le p90 des heures de *début* fait partir le rappel pendant
  l'échauffement, pas après. Corrigé : l'apprentissage porte sur `finished_at`, avec
  `finished_at IS NOT NULL` (exclut les séances en cours et les abandons soft-deleted).
- 🔴 **Contradiction interne entre D10 et D11** : la première version posait un identifiant *stable*
  pour le push de record (« au plus un en attente »), alors que D11 justifiait le push entier par
  « la valeur, c'est la trace dans le tiroir ». Un id stable aurait fait **effacer** la trace de la
  première séance à la deuxième séance à record du jour — détruisant la valeur même invoquée pour
  justifier le push. Corrigé : identifiant **unique par séance** (`record-push-<workoutId>`), donc
  le plafond de D14 devient nécessaire pour de vraies raisons.
- 🔴 Le cas limite de la spec disait « 15 records battus ! » pour une première séance de 5 exercices,
  alors que D10 impose de dédoublonner par exercice — les deux ne pouvaient pas être vrais en même
  temps. Corrigé en « Records battus sur 5 exercices ! » ; un test dédié verrouille que le décompte
  porte sur les exercices, pas sur les lignes de record.
- 🔴 **`useHasPlannedSession` ne convient pas** à la condition « une séance muscu est planifiée
  aujourd'hui » : son `WHERE` accepte `status = 'done'` et n'a aucun filtre de pilier — une course
  planifiée aurait déclenché le rappel muscu. Requête dédiée avec `programs.pillar = 'strength'`.
- 🔴 **`maybePushRecords` n'avait accès à rien hors React** : c'est un callback d'événement
  (`doFinish`), pas un rendu, et aucun accesseur asynchrone n'existait pour les préférences de
  notification ni le système d'unités. Deux accesseurs ajoutés (`getNotificationPrefs`,
  `getUnitSystem`), même patron que `getAnalyticsEnabled`.
- ⚠️ **Le contrat no-throw rendait le quota immesurable** : sans un retour booléen de `presentNow`,
  une notification qui échoue silencieusement aurait quand même consommé une unité de plafond.
  Corrigé : `presentNow` renvoie `boolean`, et la permission est vérifiée **avant** toute
  consommation de quota — sinon une permission refusée aurait brûlé les 3 unités du jour pour rien.

#### Ajouté

- [record-notification.ts](packages/shared/src/record-notification.ts) — `buildRecordPushContent`,
  brique pure : **deux dédoublonnages distincts** (par `exerciseId` pour le décompte, par libellé
  pour la liste de noms — un exercice custom dupliqué ou recréé peut porter deux fois le même nom).
  Nom vide exclu de la liste mais compté. 11 tests, dont le cas 15 records / 5 exercices de la spec.
- [CelebrationCard.tsx](apps/mobile/src/components/CelebrationCard.tsx) — conteneur animé extrait de
  `CelebrationBanner` (course) : fondu + zoom 320 ms, **respect de « réduire les animations »**
  (nouveau — le composant course ne le gérait pas). 3 tests, dont un qui a trouvé un vrai bug :
  la première version jouait `Animated.timing` une fois avant de recevoir la réponse asynchrone du
  réglage système, donc une animation aurait joué même avec « réduire les animations » actif.
  Corrigé avec un état tri-valué (`null | boolean`) : on attend une réponse connue avant d'animer.
- [notification-quota-store.ts](apps/mobile/src/stores/notification-quota-store.ts) — plafond
  quotidien des notifications **immédiates** (décision D14). Ne compte que les **tentatives
  réussies** (`recordSuccess`, jamais sur un échec). Local à l'appareil, non synchronisé.
- `presentNow(id, content): Promise<boolean>` + `RECORD_PUSH_PREFIX` + `SESSION_REMINDER_ID` dans
  [notifications.ts](apps/mobile/src/lib/notifications.ts) — notification immédiate via
  `trigger: { channelId }` (SDK 57 ; `presentNotificationAsync` n'existe plus).
- `maybePushRecords(workoutId, beaten)` dans
  [notification-repository.ts](apps/mobile/src/data/repositories/notification-repository.ts) —
  fonction de module (pas un hook), branchée dans `doFinish` ([workout.tsx](apps/mobile/src/app/workout.tsx))
  dans le **même** `try/catch` best-effort que `evaluateWorkoutRecords` : un échec du push ne bloque
  pas plus la navigation qu'un échec de l'évaluation.
- `useSessionDeadline` + `useHasPlannedStrengthSessionToday` — 3ᵉ entrée du planificateur
  `useProgrammedRemindersScheduler`, sur la structure existante (jeton de génération inchangé).
- 3 préférences (`recordPush: true`, `sessionReminder: false`, `sessionReminderHour: 18`) — deux
  défauts **opposés**, délibérément : le push **célèbre** (opt-out), le rappel **réclame** (opt-in).
- 3 nouveaux contrôles dans les réglages ; hint de section réécrit pour la **deuxième fois de la
  journée** (« Au plus un rappel par type et par jour, plus 3 célébrations de record au maximum »).
- 18 clés i18n FR/EN (parité vérifiée : 1509 = 1509, zéro orpheline).

#### Modifié

- `run/summary.tsx` — `CelebrationBanner` (course) consomme désormais le conteneur extrait
  `CelebrationCard` ; gagne au passage le respect de « réduire les animations », qu'il n'avait pas.
- `workout-summary.tsx` — nouvelle `WorkoutCelebrationBanner`, montée **juste après `ScreenHeader`**
  et non au-dessus de `RecordsSection` (~60 lignes de JSX plus bas) : une bannière montée trop bas
  aurait déjà fini son animation, hors écran, avant que l'utilisateur y arrive en scrollant.
- `notification-repository.ts` : le commentaire d'aveu sur `maxPerDay` renvoie désormais à **D14**
  (solde de D3) au lieu de dire que le plafond n'est appliqué nulle part — ce qui reste vrai pour les
  5 rappels programmés, mais plus pour le push de record.

#### Technique / Notes

- **Muscu seulement, pas la course** : les deux mécanismes de détection de record sont entièrement
  séparés, et le chemin course est **aussi** celui de `backfillRunningRecords`, qui rejoue tout
  l'historique — un push branché là partirait en rafale au premier passage.
- **D11 reste ouverte et assumée** : le push part même au premier plan, donc il double l'écran de
  résumé qui affiche déjà les mêmes records. La spec propose un premier essai de recette : un
  handler de notification sélectif par identifiant pourrait supprimer la bannière tout en gardant la
  trace dans le tiroir — non vérifié, Android pourrait ne pas le permettre.
- **Garde-fou `no-frozen-clock` non modifié** : `notification-repository.ts` y figurait déjà, et
  `maybePushRecords` n'est jamais mémoïsée par React Compiler (fonction de module, pas un
  composant/hook) — le `localDayKey(new Date())` qu'elle contient est donc correct et ne pouvait de
  toute façon pas y être signalé à tort. Vérifié en relançant le garde-fou après tous les changements.
- **Vérifications** (codes de sortie lus **sans pipe**) : `npm run typecheck` 0 · `npm run lint` 0
  (28 warnings, tous préexistants) · `npm run test` 0 → **1208 tests Vitest** (62 fichiers, +13) +
  **211 tests Jest** (41 suites, +16).
- **Reste à faire** : recette device (§7 de la spec) — **pas de nouveau build nécessaire**. Le point
  D11 (push au premier plan) est le premier à réévaluer si l'usage réel déplaît.

### 30/07/2026 — `fix/date-gelee-react-compiler` — 19 lectures d'horloge gelées par React Compiler

Commit précédent : `e7c60ee`.

#### Corrigé

- 🔴 **Toute une famille de bugs, invisible en dev et en test, active uniquement en build release.**

  `experiments.reactCompiler` est activé ([app.json](apps/mobile/app.json)). Quand une valeur calculée
  dans un composant ou un hook n'a **aucune entrée réactive** — le cas de `localDayKey(new Date())`,
  qui ne dépend d'aucune prop, d'aucun state, d'aucun hook — le compilateur la classe **constante** et
  la range dans un slot `useMemoCache` **mount-only**, évalué **une seule fois** pour la durée de vie
  de l'instance.

  Sur les hooks montés dans le layout racine (`useStreakData`, `useWeeklyReview`), l'instance vit
  aussi longtemps que le process JS. Sur les onglets, **aucun `unmountOnBlur` n'est configuré** : un
  onglet monté au premier affichage ne se démonte jamais. La requête « et aujourd'hui ? » interrogeait
  donc éternellement **le jour du montage**.

  **Pourquoi personne ne l'avait vu** : `tsc` ne voit rien (le code est bien typé) ; en dev,
  `enableResetCacheOnSourceFileChanges: !isProduction` réinitialise le cache à chaque sauvegarde ; et
  sous Jest, `babel-preset-expo` n'applique le plugin que si l'appelant pose `supportsReactCompiler`,
  ce que seul le transformer Metro fait — **jamais `babel-jest`**. Aucune des trois portes de qualité
  ne pouvait l'attraper.

  Découvert le matin même sur `reminder-habits-repository.ts` pendant la revue de NUTR-F1, puis
  généralisé : l'audit a compilé chaque fichier de `apps/mobile/src` et trouvé **19 sites réels**.

  Ce qui était cassé, concrètement :

  | Hook / composant | Effet en release |
  |---|---|
  | `useStreakData` | `activeToday` répond sur la veille → **le rappel de série ne repart plus jamais** si l'utilisateur était actif hier ; le compteur se figeait ; `restorableGap` proposait un joker sur le mauvais jour |
  | `useWeeklyReview` | Le planificateur décidait « notifier ou pas » sur **la semaine d'avant celle qu'il faut**, dès que le process survivait au lundi |
  | `useTodaySession` | La carte « séance du jour » proposait celle de la veille — et **la valider marquait l'occurrence du mauvais jour** (`plannedSessionId` est le lien de complétion) |
  | `WellbeingCard` | `todayKey` était passé en `logDate` à la feuille de saisie → **un check-in écrivait sur le mauvais jour** |
  | `useTodayWellbeing` | Le check-in d'hier passait pour celui d'aujourd'hui → l'app ne proposait plus jamais de le faire |
  | `useNutritionSummary`, onglet nutrition | Kcal et macros de la veille ; les repas du jour n'apparaissaient jamais |
  | `useGoals` | Un objectif échu aujourd'hui restait « actif » ; les jours restants n'avançaient plus |
  | `useTodaySteps`, `useUpcomingSessions`, `useRunStats`, `useTrainingTime`, `useDeficitVolumeAlert`, 4 sites de `records-repository` | Widgets et fenêtres glissantes figés. `useDeficitVolumeAlert().show` conditionnant une cellule de la grille, c'était même **la mise en page du dashboard** qui se figeait |

#### Ajouté

- [useTodayKey.ts](apps/mobile/src/hooks/useTodayKey.ts) — **une seule source d'horloge réactive**, et
  tout le reste en dérive. C'est ce qui rend le correctif sûr : une fois la racine réactive, chaque
  valeur calculée à partir d'elle tombe dans un scope mémoïsé **keyé sur elle**, donc se rafraîchit
  avec elle. Il n'y a pas à auditer les dérivations une par une.
  - `useTodayKey()` — clé `AAAA-MM-JJ`, rafraîchie au retour au premier plan (seul moment où l'app
    peut constater un changement de jour sans minuteur qui la réveille pour rien) ;
  - `useTodayDate()` — **minuit** local, pour les helpers de `shared` qui prennent une référence
    injectable. Volontairement pas l'instant courant : une valeur changeant à la seconde
    re-souscrirait les requêtes en boucle ;
  - `useWindowStartKey(days)` / `useWindowStartUtc(days)` — bornes de fenêtre glissante
    **inclusives** (`days = 7` → J-6), pour ne plus recopier le `- 1` qui est la source d'erreur de
    bord classique.
- [no-frozen-clock.test.ts](apps/mobile/src/hooks/__tests__/no-frozen-clock.test.ts) — **le garde-fou,
  et il était indispensable** : puisque ni `tsc`, ni le dev, ni Jest ne voient cette classe de bugs, le
  seul test possible **applique lui-même le compilateur** et échoue si un bloc mémoïsé au montage
  contient une lecture d'horloge. 12 fichiers surveillés, liste explicite (un scan complet serait lent
  en CI et signalerait des cas bénins, donc finirait désactivé). Inclut un **test du test** : on
  compile un hook volontairement fautif et on vérifie que le détecteur le voit — sans ça, un détecteur
  cassé passerait pour un code sain.
- `localDateFromDayKey(key)` dans [date.ts](packages/shared/src/date.ts) — inverse de `localDayKey`,
  par composants et non via `new Date('AAAA-MM-JJ')`, que la spec ECMAScript parse en **UTC** (donc la
  veille dans un fuseau négatif).

#### Modifié

- **Onglet nutrition** : le jour affiché était un `useState` — gelé par **conception**, pas par le
  compilateur, mais l'onglet ne se démontant jamais, le résultat utilisateur était le même (on revenait
  le lendemain, le journal était encore sur la veille). Règle retenue : **suivre le jour courant
  uniquement si l'utilisateur était déjà sur « aujourd'hui »**, pour ne pas écraser une navigation
  délibérée vers un jour passé.
- `rollingWindowLowerBound` (records) prend sa référence en paramètre. ⚠️ **Seul changement de
  comportement de ce commit** : la borne était calculée depuis l'**instant** courant, elle l'est
  désormais depuis **minuit local**. La fenêtre devient jour-alignée, comme `rollingWeekStartLocalUtc`
  et comme toutes les autres du dépôt ; c'était l'outlier, et une borne à l'instant faisait bouger les
  stats au fil de la journée. Concerne `useMuscleBalance` (14 j) et `useWeeklyVolumeSeries`.
- `periodLowerBound`, `bucketWeeklyVolume`, `last8RollingWeeksLocal`, `daysAgo` : la date de référence
  devient un **paramètre**. Le commentaire de `rollingWindowLowerBound` affirmait qu'extraire l'appel
  dans une fonction dédiée suffisait à « respecter la règle de pureté du rendu » — c'est faux, le
  compilateur mémoïse **l'appel**.
- `weekly-review-repository` : `elapsedRatio` vivait dans un `useMemo` écrit à la main dont la liste de
  dépendances **omettait le jour**. Péremption antérieure au compilateur, corrigée au passage.
- `useTodayKey` était privé à `reminder-habits-repository` depuis le matin : dédupliqué vers le hook
  partagé (41 lignes en moins).
- `NutritionSummaryCard` : le hook est remonté **avant** le `if (isLoading) return null` — un simple
  calcul pouvait vivre après un retour anticipé, un hook non.

#### Technique / Notes

- **Ce commit ne change aucune fenêtre de calcul, à l'exception documentée ci-dessus.** Les bornes de
  `useDeficitVolumeAlert` ont été **délibérément laissées identiques à l'avant-correctif**, alors que
  deux écarts y sont visibles : `daysAgo(7)` donne J-7, donc **8 jours inclusifs** pour un hook dit
  « weekly », et `+ 'T00:00:00.000Z'` étiquette un minuit **local** comme s'il était UTC. Les redresser
  ici aurait changé les chiffres de l'alerte au milieu d'un commit censé ne corriger que le gel.
  **À traiter dans une passe dédiée** — c'est écrit en commentaire dans le code, à l'endroit exact.
- **Restent classés 🟠, non traités** : `useMissedSessions`, `useProgression`, `usePaceTrend`, et les
  libellés « J-n » de `GoalsCard`/`GoalCard`. Tous sur des écrans Stack qui se démontent, ou dans des
  scopes réactifs qui se rafraîchissent au moindre changement de données. Impact borné.
- **Règle à retenir** : dans le corps d'un composant ou d'un hook, jamais de `new Date()` ni de
  `Date.now()`. Dans un **callback d'événement**, en revanche, c'est correct et attendu — la closure lit
  l'horloge à l'appel. Le garde-fou ne regarde que les blocs mémoïsés, donc il ne gêne pas ce cas.
- **Vérifications** (codes de sortie lus **sans pipe**) : `npm run typecheck` 0 · `npm run lint` 0 ·
  `npm run test` 0 → **1195 Vitest** (61 fichiers) + **195 Jest** (38 suites — +1 suite et +13 tests
  apportés par le garde-fou).
- ⚠️ **Recette** : ces correctifs ne sont vérifiables qu'en **build release**. Scénario minimal : ouvrir
  l'app, laisser en arrière-plan **sans tuer le process**, revenir le lendemain, et vérifier que la
  séance du jour, le journal nutrition, le widget bien-être et la série ont suivi.

### 30/07/2026 — `docs/socle01-differee` — SOCLE-01 différée, REFACTO-01 créée (suivi seul, aucun code)

Commit précédent : `ba4e9ee`.

**Aucun code applicatif.** Trois fichiers de suivi. L'US SOCLE-01 a été **cadrée puis reportée le
même jour** : elle n'est jamais entrée dans le pipeline, donc pas de spec, pas de plan, pas de
maquette, et **pas de front-matter à faire avancer**.

#### Modifié

- [BACKLOG.md](BACKLOG.md) — **SOCLE-01 → ⏳ différée**, avec les 4 constats qui l'ont motivée :
  1. [prd.md:122](docs/product/prd.md) qualifie les paliers Premium → Écosystème → IA de
     « conservés **pour mémoire uniquement, non engageants** » — les définir aurait été les inventer,
     contre une position produit écrite ;
  2. **« Premium muscu » n'a aucun contenu défini nulle part**, « Écosystème » n'est nommé que dans
     l'ADR-003 ; seul le palier **IA** a une décision datée (Florian, 15/07/2026 : 1-2 bilans croisés
     gratuits bridés vs analyses exhaustives à la demande + chatbot à quota) ;
  3. **aucune fonctionnalité IA n'est livrée** ([ia-integration-analyse.md](docs/product/ia-integration-analyse.md)
     n'est pas encore une US) → la couture d'accès n'aurait eu **aucun consommateur réel**, donc
     aurait été une promesse non vérifiée plutôt qu'une conception validée ;
  4. LANCE-00 non fait → sans compte Play, aucun produit configurable, donc **un SDK RevenueCat
     n'aurait rien à récupérer**. À noter pour la reprise : une clé SDK publique `goog_` **n'est pas
     un secret** (elle est conçue pour être embarquée dans le client, même classe que
     `EXPO_PUBLIC_SUPABASE_ANON_KEY`) — c'est l'inutilité qui l'a écartée, pas le garde-fou.

  **Point de reprise : la première US IA**, qui fournira le premier point d'accès réellement gatable.
- [roadmap.md](docs/roadmap/roadmap.md) — **9.14 → ⏳ Reporté** avec le motif, compteurs
  **170 ✅ / 19 🟡 / 13 ⬜ / 2 ⏳** (8.7 et 9.14), entrée au journal des réconciliations.
- **MUSC-F8 enrichie** dans le backlog : l'**échéance apprise** (p90) et le **rabattement DND** livrés
  par NUTR-F1 sont réutilisables tels quels — et surtout, les décisions **D8** (marge d'imminence de
  15 min) et **D9** (clé du jour réactive) l'attendent au même endroit. Sans cette note, le prochain
  rappel muscu retomberait dans les deux mêmes pièges.

#### Ajouté

- **REFACTO-01 — Unifier la décision d'accès par pilier** (backlog P2). Trouvée en cadrant SOCLE-01,
  et c'est le vrai enseignement de ce cadrage : le gating de la décision H
  (`settings?.activePillars ?? [...PILLARS]` puis `.includes()`) est **recopié en ligne dans
  ~12 endroits** — `(tabs)/_layout.tsx`, `settings.tsx`, `dashboard-repository`,
  `records-repository`, `weekly-review-repository`, `widget-layout-repository` — **sans aucun helper
  partagé**. La seule version propre est interne aux widgets (`WIDGET_REGISTRY.pillars` + son
  sentinelle `'always'`), et c'est exactement la forme cible.

  **La refonte que l'ADR-003 croyait prévenir existe donc déjà, et elle n'a rien à voir avec
  RevenueCat.** Y brancher des entitlements plus tard devient alors une entrée de plus, pas une
  refonte. ⚠️ Touche du code livré et recetté en 12 endroits : refacto dédiée, jamais passager
  clandestin d'une autre US. ~6-8 h.

#### Technique / Notes

- **Dette de doc repérée, non corrigée ici** : [analyses-donnees.md:38-40](docs/product/analyses-donnees.md)
  cite `WIDGET_PILLARS` + `resolveDashboardLayout` dans `packages/shared/src/dashboard.ts`. **Ce
  fichier n'existe pas** ; les vrais noms sont `WIDGET_REGISTRY[screen].pillars` +
  `resolveScreenLayout` dans `widgets.ts`. À corriger au prochain passage sur le catalogue.
- **Bug confirmé dans du code livré, à traiter ensuite** : `dashboard-repository.ts` présente
  **4 occurrences** (lignes 166, 243, 419, 537) du patron responsable du bug bloquant de NUTR-F1 —
  `localDayKey(new Date())` passé en paramètre de requête sans entrée réactive, donc **gelé au
  montage par React Compiler en build release**. Les fonctionnalités concernées sont vivantes :
  `useTodaySession` (séance du jour au dashboard) et `useStreakData` (`activeToday`, qui pilote le
  **rappel streak**). Correctif prévu sur `fix/date-gelee-react-compiler` — le remède
  (`useTodayKey`) est déjà écrit et testé dans `reminder-habits-repository.ts`.
- Vérifications malgré l'absence de code (codes de sortie lus **sans pipe**) : `npm run typecheck` 0 ·
  `npm run lint` 0 · `npm run test` 0.

### 30/07/2026 — `feature/nutrf1-rappels-nutrition` — rappels programmés nutrition (US NUTR-F1, roadmap 1.14 + 2.5)

Commit précédent : `038c664`.

Deux rappels locaux — **journal alimentaire** et **pesée** — déclenchés à une **échéance apprise** du
comportement. **Aucune migration, aucune sync rule à redéployer, aucune dépendance native, aucun
nouveau build** : les 5 nouvelles préférences vivent dans la colonne JSON `user_settings.notifications`
déjà synchronisée, et tout le calcul est local.

#### Le défaut de conception corrigé avant d'écrire une ligne de code

La première rédaction de la spec apprenait la **médiane** de l'heure de saisie et déclenchait le
rappel à cette heure. La relecture critique a montré que c'était contre-productif : la médiane est par
définition l'heure où le geste est fait **une fois sur deux**, donc un utilisateur régulier qui logge à
8 h aurait reçu « ton journal est vide » à 8 h, **un jour sur deux, pendant qu'il le remplit** — et une
notification déjà tirée ne s'annule pas (la re-planification n'a lieu qu'à l'ouverture de l'app, et le
handler affiche la bannière même au premier plan).

On apprend donc une **échéance** : le **p90** de l'heure du geste, l'heure avant laquelle c'est déjà
fait 9 jours sur 10. Le rappel devient **rare par construction**, ce qui est le but.

#### Ajouté

- [learned-hour.ts](packages/shared/src/learned-hour.ts) — brique pure de l'échéance apprise.
  `usableDailyHours` (une heure locale par jour, filtre anti-saisie-rétroactive),
  `percentileHour` (percentile **par rang**, sans interpolation), `resolveLearnedDeadline`.
  Constantes : fenêtre 14 jours, seuil 5 jours, décile 0,9. **28 tests** — dont les tests
  indépendants du fuseau de la machine (les horodatages sont construits depuis des `Date` locales
  puis sérialisés en UTC, comme le fait l'app).
- `clampOutOfDnd(hour, prefs)` dans [notifications.ts](packages/shared/src/notifications.ts) —
  rabat une heure **apprise** hors de la fenêtre « Ne pas déranger », sur le bord le plus proche
  (`dndEndHour` ou `dndStartHour − 1`), égalité vers l'arrière. Couvert par un **test de propriété**
  (6 fenêtres × 24 heures : le résultat vérifie toujours `!isWithinDnd`).
- `decideProgrammedReminder(input): ReminderDecision` — union discriminée
  `{schedule, atHour} | {skip, reason}` avec `reason ∈ disabled|done|passed|dnd`, chaque refus testé
  nommément.
- 5 préférences dans `NotificationPrefs` : `mealReminder` (défaut `false`), `mealReminderHour` (13),
  `weighInReminder` (`false`), `weighInReminderHour` (10), `learnedHour` (`true`).
- [reminder-habits-repository.ts](apps/mobile/src/data/repositories/reminder-habits-repository.ts) —
  lecture locale des habitudes (`useMealDeadline`, `useWeighInDeadline`, `useMealLoggedToday`,
  `useWeighInToday`).
- `useProgrammedRemindersScheduler()` dans
  [notification-repository.ts](apps/mobile/src/data/repositories/notification-repository.ts) — un
  seul hook et un seul abonnement `AppState` pour les deux rappels ; monté dans
  [_layout.tsx](apps/mobile/src/app/_layout.tsx).
- `scheduleDatedReminder(id, date, content)` / `cancelReminder(id)` +
  `MEAL_REMINDER_ID` / `WEIGH_IN_REMINDER_ID` dans
  [notifications.ts](apps/mobile/src/lib/notifications.ts).
- Réglages : switch **« Caler sur mes habitudes »** + 2 rappels (switch + `HourStepper`) avec la
  **provenance de l'heure** affichée, dans [settings.tsx](apps/mobile/src/app/settings.tsx).
- Mock `expo-notifications` dans [jest.setup.ts](apps/mobile/jest.setup.ts) — il n'existait pas, et
  `@/lib/notifications` enregistre un `setNotificationHandler` **au chargement du module** : sans le
  mock, tout test important indirectement ce module échouait à l'import.
- 15 clés i18n FR/EN (parité vérifiée : 1495 = 1495, zéro orpheline).

#### Corrigé — trouvés en revue de code, AVANT livraison

- 🔴 **BLOQUANT : la date « aujourd'hui » était gelée au montage par React Compiler.**
  `reminder-habits-repository.ts` écrivait `useQuery(sql, [localDayKey(new Date())])`, avec un
  commentaire affirmant que la valeur était « recalculée à chaque render ». **Faux en production.**
  `experiments.reactCompiler` est activé ([app.json:83](apps/mobile/app.json#L83)) : le tableau de
  paramètres n'ayant aucune entrée réactive, le compilateur le classe constant et le range dans un
  slot `useMemoCache` **mount-only**.

  Le hook étant monté dans le layout racine — donc une seule instance pour toute la vie du process,
  qu'Android conserve en arrière-plan — le scénario réel était : l'utilisateur note son dîner le soir,
  revient le lendemain matin, la requête « déjà fait aujourd'hui ? » répond encore sur **la veille**
  → `true` → `cancelReminder`. **Plus aucun rappel de repas, jamais**, pour exactement l'utilisateur
  qu'on cible. Et la fenêtre d'apprentissage cessait de glisser.

  **Le bug était invisible partout où on l'aurait cherché** : en dev, le cache du compilateur est
  réinitialisé à chaque sauvegarde de fichier ; sous Jest, le plugin n'est pas appliqué. Il ne se
  manifestait qu'en **build release**. Corrigé par un `useTodayKey()` à base de `useState`, rafraîchi
  au retour au premier plan — la clé devient une entrée réactive (décision **D9**).

  ⚠️ **Même patron ailleurs, non corrigé ici** : `dashboard-repository.ts` (`useStreakData` →
  `activeToday`) présente la même construction. C'est une famille de bugs préexistante qui mérite sa
  propre passe — elle affecte le rappel streak de la même manière.
- 🔴 **Aucune marge avant l'échéance** (décision **D8**, ajoutée) : D7 avait supprimé le rattrapage
  *après* l'échéance, mais rien ne protégeait *juste avant*. Ouvrir l'app à 12 h 59 pour une échéance
  à 13 h faisait arriver « ton journal est encore vide » **60 secondes plus tard, pendant que
  l'utilisateur le remplit** — le scénario exact que D7 invoque pour se justifier. Marge de
  `REMINDER_MIN_LEAD_MINUTES = 15`, avec un motif de refus **distinct** (`imminent` vs `passed`) :
  en recette, l'un dit « trop tard », l'autre « tu es déjà là ».
- ⚠️ **Course entre deux `apply()` concurrents.** `apply()` démarre par deux allers-retours natifs, donc
  deux invocations peuvent se chevaucher : A décide « planifier » sur un journal vide, l'utilisateur
  ajoute un aliment, B décide « annuler » — et si les promesses ne se résolvent pas dans l'ordre de
  départ, le `schedule` de A s'exécute **après** le `cancel` de B et le rappel revient alors que le
  journal est rempli. Ce hook étant réveillé par **deux tables surveillées**, le chevauchement n'est
  pas théorique. Corrigé par un jeton de génération (`useRef`), vérifié après chaque `await`.
- ⚠️ **`resolveDeadline` n'était pas testé** — et c'était le **seul** morceau de logique métier de l'US
  qui ne l'était pas, alors que c'est là que D5 et D6 sont réellement câblés. Il était pur et sans
  dépendance React : déplacé dans `packages/shared` sous le nom `resolveReminderDeadline`, avec
  6 tests. Le chemin qui manquait entièrement : apprentissage **puis** rabattement
  (`daysAt(23, 7)` → `{ hour: 21, learned: true, shifted: true }`).
- **Fenêtre d'apprentissage à 15 jours au lieu de 14** : `localMidnightDaysAgo(14)` couvre J-14…J0.
  Corrigé en `LEARNED_HOUR_WINDOW_DAYS - 1`, la convention du dépôt (cf. `ROLLING_WEEK_DAYS - 1`).

#### Corrigé

- 🔴 **Dérive Zod de `notificationPrefsSchema`** ([settings.ts](packages/shared/src/settings.ts)) :
  le schéma ne déclarait que **6** des 8 champs de `NotificationPrefs` — `weeklyReview` et
  `weeklyReviewHour` manquaient depuis BILAN-01. `z.object` étant strippant, tout passage par ce
  schéma les **perdait silencieusement**. Dérive **latente** (le chemin runtime passe par
  `parseNotificationPrefs`, pas par Zod), donc jamais visible en production — mais le piège attendait
  les 5 champs suivants.

  ⚠️ **Première tentative de correction rejetée en revue** : compléter la liste à 13 champs
  **obligatoires** n'aurait pas corrigé le piège, ça l'aurait **approfondi**. La colonne est enrichie
  *sans migration*, donc aucune ligne existante ne contient les champs ajoutés après coup : au lieu de
  stripper en silence, le schéma se serait mis à **lever** sur toute ligne antérieure. Le schéma
  délègue désormais à `parseNotificationPrefs` (`z.unknown().transform(...)`), ce qui est le contrat
  réel de cette colonne — une seule implémentation de la tolérance, testée en un seul endroit. Trois
  tests ajoutés, dont « une ligne de 6 champs se lit sans lever, les 7 autres sont complétés ».
- ⚠️ **Le hint « Max 3 notifications par jour » était faux depuis V0.6.** `canScheduleMore` existe,
  est testé, et n'était appelé par personne — aveu explicite en commentaire dans
  `notification-repository.ts`. Décision **D3** : on corrige le **texte**, pas le code, parce qu'un
  compteur n'ajouterait aucune protection (chaque type est déjà borné à un par jour par son
  identifiant stable) et **ferait perdre des rappels** (les planificateurs re-tournent à chaque retour
  au premier plan ; sans court-circuit, un type déjà compté se verrait refuser sa re-planification et
  la branche d'annulation supprimerait le rappel à la deuxième ouverture de l'app). Le hint énonce
  désormais la garantie réelle : « Au plus un rappel par type et par jour. »
- Un trou trouvé en relecture du code livré : apprentissage actif **mais historique insuffisant** →
  l'heure de repli s'applique sans être rabattue, donc un repli tombant dans le DND ne partait jamais,
  alors que l'écran affichait sereinement « 23:00 en attendant ». L'avertissement DND dépend maintenant
  de `deadline.learned` et non du mode d'apprentissage, et les deux lignes explicatives coexistent.

#### Modifié

- `useStreakReminderScheduler` (**code livré et recetté**) : il recopiait `NotificationPrefs` champ par
  champ dans un objet local — patron qui casse à chaque ajout de champ au type, et qui a effectivement
  cassé au typecheck dès l'ajout des 5 champs de cette US. Il passe désormais `prefs` directement
  (8 lignes de moins, plus de littéral à maintenir). Les 3 heures du DND quittent la liste de
  dépendances du `useCallback` (elles sont portées par `prefs`), ce qui aligne ce hook sur son
  jumeau `useWeeklyReviewScheduler`. **Point d'attention** : `prefs` est un objet recréé à chaque
  render par `parseNotificationPrefs`, donc `apply` change d'identité à chaque render — comportement
  déjà celui de `useWeeklyReviewScheduler`, et inoffensif grâce aux identifiants stables (planifier
  remplace, annuler est idempotent).
- `scheduleStreakReminder` / `cancelStreakReminder` deviennent de fines enveloppes sur la paire
  générique — comportement identique, une seule implémentation au lieu de trois copies à venir.

#### Technique / Notes

- **Aucun agrégat SQL sur `created_at`.** Le plan prévoyait initialement
  `MIN(created_at) … GROUP BY log_date` ; c'est faux, parce que le choix de l'entrée retenue dépend du
  filtre anti-rétroactif, qui se calcule en **heure locale** donc en JS. Un `strftime('%H', created_at)`
  aurait renvoyé l'heure **UTC** et décalé tout l'apprentissage de 1 à 2 h selon la saison.
- **Cycle d'import évité** : `reminder-habits-repository` reçoit les préférences en **paramètre** au
  lieu d'appeler `useNotificationPrefs()`, sinon il serait en cycle avec `notification-repository` qui
  le consomme. L'écran de réglages et le planificateur disposent tous deux déjà des prefs — et
  consomment **les mêmes hooks**, donc l'heure affichée ne peut pas diverger de l'heure planifiée.
- **Percentile par rang** (`trié[ceil(p × n) − 1]`) et non médiane : défini pour tout `n`, sans règle
  à inventer pour les échantillons pairs (majoritaires ici : fenêtre 14, seuil 5), et il neutralise le
  problème circulaire dans le sens utile — sur `{23,0,23,0,23,0}` la médiane renvoie 11 h 30 (le point
  antipodal de l'habitude réelle), le p90 renvoie 23 (le bord tardif, ce qu'on cherche).
- **Limite assumée du filtre anti-rétroactif (D4)** : il n'attrape **pas** les copies du jour même
  (`copyMeal`, `duplicateDay`, repas types portent `created_at = maintenant` et `log_date` = le jour
  affiché, presque toujours aujourd'hui). Quelqu'un qui duplique la veille chaque matin à 10 h
  apprendra « 10 h ». Assumé : sous D1, une contamination qui **repousse** l'échéance va dans le sens
  sûr — elle rend le rappel plus rare, jamais plus intrusif. Distinguer une copie exigerait une
  colonne `source`, donc une migration, pour un gain nul dans la direction qui compte.
- **Aucune fenêtre de rattrapage (D7)**, alors que le backlog en prévoyait une de ~30 min pour le doze
  mode. Écartée : l'évaluation a lieu **à l'ouverture de l'app**, donc rattraper aurait notifié
  l'utilisateur pendant qu'il est dans l'app. Et si l'échéance est passée, c'est précisément qu'il a
  ouvert l'app — il n'a pas besoin d'une notification l'invitant à l'ouvrir.
- **Deux politiques DND, une par origine de l'heure** : rabattement pour une heure que l'app a choisie
  (D5), respect strict — donc non-envoi + avertissement à l'écran — pour une heure que l'humain a
  composée (D6). On ne réécrit pas en douce un choix de l'utilisateur.
- **Rappels opt-in** (défaut `false`) : l'app envoie environ une notification par jour ; les activer
  d'office pour les utilisateurs existants en triplerait le volume sans qu'ils l'aient demandé — c'est
  le genre de mise à jour qui fait couper les notifications au niveau système, et on perdrait alors
  *aussi* le rappel streak.
- **Invariant étendu et testé** : les **4** heures par défaut (20, 9, 13, 10) sont hors de la fenêtre
  DND par défaut `[22, 7)`. Sans lui, la notification serait planifiée puis systématiquement supprimée
  — une fonctionnalité muette, sans erreur visible.
- **Vérifications** (codes de sortie lus **sans pipe**) : `npm run typecheck` 0 · `npm run lint` 0
  (9 warnings, tous préexistants, aucun sur les fichiers de cette US) · `npm run test` 0 →
  **1195 tests Vitest** (61 fichiers) + **182 tests Jest** (37 suites).
- **La revue de code a payé, et voici comment** : elle n'a pas raisonné à vide, elle a **compilé** le
  code avec `babel-plugin-react-compiler` pour inspecter la sortie réelle. C'est ce qui a produit le
  bug bloquant, qu'aucune des trois portes de qualité ne pouvait attraper (le compilateur n'est pas
  appliqué sous Jest, et son cache est réinitialisé en dev). **Leçon à garder** : sur ce dépôt,
  `reactCompiler` étant activé, un paramètre de requête `useQuery` sans entrée réactive est gelé au
  montage — et `panicThreshold: 'NONE'` en production signifie qu'un fichier non compilable est
  abandonné **en silence**, donc ne jamais faire dépendre une propriété de *correction* du compilateur.
- **Reste à faire** : recette device (§7 de la spec), prévue par Florian le 30/07/2026 au soir.
  **Pas de nouveau build nécessaire.**
- **Ce que cette US pose pour MUSC-F8** : l'échéance apprise et le rabattement DND sont réutilisables
  tels quels pour les rappels muscu (P1). C'était la raison de faire NUTR-F1 en premier.

### 30/07/2026 — `fix/theme-contraste-et-flash` — flash de thème à chaque navigation

Commit précédent : `c227127`.

#### Corrigé

- 🔴 **Flash de thème à chaque changement d'écran.** Symptôme rapporté par Damien en entrant dans le
  module poids : « thème sombre 0,2 s, puis **petit à petit** le clair ». Reproduit — préférence
  stockée `light`, système `dark`.

  **Deux causes qui se combinaient**, toutes deux dans [useTheme.ts](apps/mobile/src/theme/useTheme.ts) :

  1. `useColorSchemePref` faisait `settings?.theme ?? 'system'`. Le commentaire affirmait que ce repli
     *évitait* un flash — il le **causait** dès que la préférence stockée diffère du réglage OS : tant
     que la lecture n'avait pas abouti, l'app peignait avec le thème **système**.
  2. `useTheme()` est appelé par **126 composants**, et chacun ouvrait **sa propre requête PowerSync**
     via `useSettings()`. À chaque navigation, les composants du nouvel écran montaient tous avec
     `settings === null` puis se résolvaient **indépendamment** → le basculement se voyait composant
     par composant. C'est le « petit à petit » : pas un fondu, 126 rebascules successives.

  Le démarrage, lui, était sain : `resolveRootRoute` maintient déjà le splash tant que
  `settingsLoading`. Le défaut ne se manifestait donc **qu'à la navigation**.

#### Ajouté

- [color-scheme-store.ts](apps/mobile/src/stores/color-scheme-store.ts) — le schéma effectif, résolu
  **une seule fois** et partagé. `null` tant que non résolu (fenêtre couverte par le splash).
- `useSyncColorScheme()`, appelée **uniquement** dans [_layout.tsx](apps/mobile/src/app/_layout.tsx) :
  seul endroit qui lit la préférence en base, et qui ne publie **rien** avant que la lecture aboutisse.

#### Technique / Notes

- **Store Zustand plutôt que contexte React**, pour trois raisons : c'est le patron déjà en place
  (`menu-accent-store`, `useTrackedMicros`) ; un store se lit **sans provider**, donc les tests qui
  rendent un composant isolé continuent de fonctionner ; et la valeur **survit à la navigation** — un
  contexte remonté aurait reproduit le défaut.
- **`useTheme()` garde exactement la même signature** : les 126 appels sont inchangés, d'où un diff de
  3 fichiers pour un correctif structurel.
- Effet de bord favorable : **125 requêtes PowerSync redondantes supprimées** (une seule
  souscription aux réglages au lieu d'une par composant thémé).
- Le repli sur le thème système subsiste dans `useColorSchemePref`, mais **uniquement** si le store
  n'a jamais été alimenté — composant rendu hors de l'app (test isolé). En fonctionnement normal il
  ne sert jamais.
- ⚠️ **Vérification incomplète, à assumer** : `adb screencap` prend ~150 ms par image, donc les
  captures ne peuvent pas *prouver* l'absence d'une frame sombre de 200 ms. Elles montrent le
  dashboard et l'écran Suivi/Poids en clair dès la première image. La garantie réelle est
  structurelle : le thème ne dépend plus d'une requête asynchrone par composant. **Confirmation
  finale à l'œil, en recette.**
- Qualité (racine, codes de sortie lus sans pipe) : `lint` **0** · `typecheck` **0** · `test` **0** —
  1 126 Vitest + 182 Jest.

### 30/07/2026 — `fix/theme-contraste-et-flash` — contraste WCAG du thème clair (9.12)

Commit précédent : `1cdaf11`.

#### Corrigé

- 🔴 **Trois non-conformités WCAG AA en thème clair**, mesurées sur la palette (le sombre passait,
  sur ces paires-là). Teinte et saturation conservées → l'identité chaude est intacte.
  → [colors.ts](apps/mobile/src/theme/colors.ts).

  | Rôle | Avant | Après | / fond | Seuil |
  |---|---|---|---|---|
  | `textMuted` | `#96856f` | `#786a59` | 3,10 → **4,55** | 4,5 |
  | `accent` | `#c0562f` | `#b14f2b` | 3,95 → **4,53** | 4,5 |
  | `borderStrong` *(nouveau)* | — | `#90897d` | 1,13 → **3,01** | 3,0 |

  Effet de bord favorable : le blanc sur `accent` passe de 4,55 à **5,22** en clair.

- 🟠 **Les champs de saisie n'avaient aucune limite perceptible**, dans les **deux** thèmes
  (`border` / fond = 1,13 en clair, 1,37 en sombre — loin des 3,0 exigés par WCAG 1.4.11 pour un
  composant d'interface). Flagrant en clair, où un champ vide se confondait avec la page.

#### Ajouté

- Token **`borderStrong`** dans `Palette` (clair `#90897d`, sombre `#797169`), appliqué aux **trois**
  endroits où le trait *est* la limite du composant : [TextField](apps/mobile/src/components/TextField.tsx)
  (27 écrans), la variante **contour** de [Button](apps/mobile/src/components/Button.tsx) — où le trait
  est la seule délimitation — et les champs de
  [ExerciseTargetsFields](apps/mobile/src/components/exercise/ExerciseTargetsFields.tsx).
- [docs/plan-de-test.md](docs/plan-de-test.md) : §0 bis complété du tableau de contraste et de la
  méthode pour refaire la mesure **sans device** ; §0 ter ajouté — évaluation « quels écrans ont
  besoin d'une maquette » (voir Notes).

#### Technique / Notes

- **`border` n'a volontairement PAS été monté à 3:1.** Cerner toutes les cartes d'un trait lourd pour
  un gain d'accessibilité nul aurait été le mauvais arbitrage : WCAG 1.4.11 vise les **limites de
  composants**, pas les séparateurs décoratifs. D'où un token distinct plutôt qu'un durcissement
  global. `Card`, `CollapsibleCard` et `ChartTooltip` gardent `border`.
- ⚠️ **Correction d'une affirmation antérieure.** Le CHANGELOG du 30/07 disait « le thème sombre
  passe partout » : **c'est faux**. L'audit initial ne mesurait que les paires texte/fond. Le **blanc
  sur `accent` en sombre donne 3,29** (< 4,5) — soit le libellé de **chaque bouton plein**, dans le
  mode par défaut de l'app. **Non corrigé ici** : assombrir `#dd6e40` changerait la couleur signature
  du produit. Le correctif propre est de passer `accentText` en brun foncé (`#1c150e` → **5,48**) ;
  c'est un choix de charte, laissé à Damien/Florian. Également ouvert : `accent`/`surface` en sombre
  à 4,45, à 0,05 du seuil.
- **Évaluation des maquettes** (§0 ter du plan de test) : 33 maquettes pour 58 écrans, mais la
  conclusion est de **ne pas rétro-maquetter** les écrans livrés qui réutilisent le système de
  composants (nutrition, onboarding, auth, exercises, history, progress). **Une seule vraie lacune :
  `ShareCard`** (PARTAGE-01) — seul composant à ne pas utiliser `useTheme`, à fixer ses couleurs en
  dur, à dessiner en `react-native-svg`, et **le seul visuel qui sort de l'app**. À maquetter même
  après coup. À maquetter **avant** de coder : MUSC-F1b (schéma SVG), widget écran d'accueil Android,
  MUSC-F9 (design d'interaction).
- **Règle de process à trancher** : 8 US récentes sont passées à `code` sans maquette et sans
  dispense documentée. Proposition — maquette **obligatoire si l'US introduit une primitive visuelle
  nouvelle ou sort du système de design**, explicitement dispensable sinon.
- Qualité (racine, codes de sortie lus sans pipe) : `lint` **0** (8 warnings préexistants) ·
  `typecheck` **0** · `test` **0** — 1 126 Vitest + 182 Jest.
- Vérifié sur device en thème clair : les champs de « Créer un aliment » ont désormais une limite
  nette, les libellés secondaires sont lisibles.

### 30/07/2026 — `chore/gitignore-artefacts-design` — artefacts locaux de Claude Design ignorés

Commit précédent : `936ec81`.

#### Modifié

- [.gitignore](.gitignore) : ajout de `design/**/.thumbnail` et `design/**/uploads/`. L'outil de
  maquettage dépose un cache de vignette et les fichiers glissés dans l'éditeur à côté des
  maquettes ; ils dépendent du poste et polluaient `git status` depuis le 20/07/2026.
  **Les maquettes de `design/<fonctionnalité>/` restent versionnées** — c'est l'étape 3 du workflow
  obligatoire ; vérifié par `git check-ignore` sur un fichier de maquette.

#### Technique / Notes

- `design/**/uploads/` couvre **aussi** la racine de `design/` : un `**` de gitignore matche zéro
  dossier intermédiaire. Les lignes non préfixées étaient donc redondantes et ont été retirées.
- Aucune fonctionnalité touchée → pas de mise à jour de statut de roadmap.

### 30/07/2026 — `fix/passe-device-30-07` — 5 correctifs issus de la passe device + plan de test

Commit précédent : `ecee20e`.

Tous les défauts de ce lot ont été trouvés par une **passe adb automatisée sur 41 écrans**
(37 routes atteintes par deep link + 4 onglets), en 3 campagnes : nominal, police 1,5×, mode avion.
Aucun n'était détectable par la CI — ils rendent tous, ils rendent mal.

#### Ajouté

- **[docs/plan-de-test.md](docs/plan-de-test.md)** — inventaire des **73 écrans** (58 mobile +
  15 back-office) et des fonctionnalités attendues dans chacun, **303 cases à cocher**. Construit
  depuis le code réel (arborescence des routes, déclarations de `_layout.tsx`, docblocks, clés i18n
  effectivement utilisées) : chaque case correspond à quelque chose qui existe. Le §1 regroupe les
  8 contrôles transverses (offline, i18n, police, TalkBack, thèmes, états vides, sortie, chargement)
  plutôt que de les répéter 58 fois. **Distinct de [RECETTES.md](RECETTES.md)** : celui-ci est
  permanent et stable, RECETTES.md est temporaire et rétrécit.
- **[health-connect-inactive.test.ts](apps/mobile/src/lib/__tests__/health-connect-inactive.test.ts)**
  — 3 cas de non-régression qui verrouillent **les deux côtés** de la frontière : abandon normal →
  aucun compte rendu, échec réel → compte rendu bien présent.
- Clé i18n `running.active.ended` (FR + EN).

#### Corrigé

- 🔴 **Les Réglages affichaient une erreur alors que Health Connect était simplement désactivé.**
  `ready()` renvoyait une `reason` pour l'opt-in sur OFF exactement comme pour une vraie panne, et
  l'UI en fait un bandeau bordé `danger` : tout utilisateur n'ayant rien activé lisait
  « Dernière tentative (steps) en échec : [r4] synchronisation désactivée (opt-in OFF) » —
  **l'état normal de l'app présenté comme un échec**. `ready()` marque désormais les abandons
  normaux (plateforme, opt-in) d'un `inactive: true` que les **5** appelants (`pushWorkout`,
  `pushRun`, `pushRecent`, `importWeight`, `importSteps`) ne rapportent plus.
  → [health-connect.ts](apps/mobile/src/lib/health-connect.ts).
  ⚠️ CONF-06 est clôturée (9.9 ✅) et Health Connect est sur le chemin critique de la déclaration Play.
- 🟠 **`run/active` sans course active : écran vide avec un « Retour » seul**, sans un mot
  d'explication — **seul écran sur 41** à violer la convention maison « jamais d'écran vide ».
  → [run/active.tsx](apps/mobile/src/app/run/active.tsx).
- 🟠 **11 champs de saisie muets pour TalkBack.** Le `label` de `TextField` n'était qu'un `Text`
  voisin, jamais relié au champ : TalkBack annonçait « champ de saisie » sans dire lequel. Le label
  devient le `accessibilityLabel` par défaut — **placé avant le spread**, un `accessibilityLabel`
  explicite de l'appelant le remplace toujours. **Un point de code, 27 écrans couverts.**
  → [TextField.tsx](apps/mobile/src/components/TextField.tsx).
- 🟠 **OBJ-01 — « Nouvel objectif » annoncé deux fois** sur l'état vide (bouton du haut + CTA de
  l'`EmptyState`, `content-desc` en double). Le bouton du haut est masqué tant que la liste est vide.
  → [goals.tsx](apps/mobile/src/app/goals.tsx).
- 🟠 **BIEN-01 — l'état vide du bien-être était un cul-de-sac.** Le check-in ne s'ouvrait qu'en
  tapant un jour du journal, donc jamais quand le journal est vide. Bouton « Faire mon check-in »
  ajouté (clés i18n existantes réutilisées). → [wellbeing.tsx](apps/mobile/src/app/wellbeing.tsx).
- 🟢 **`planning/plan` en état « programme introuvable » était sans issue** (pile `planning`,
  `headerShown: false`, donc aucun retour natif). Bouton « Retour » ajouté.
  → [planning/plan.tsx](apps/mobile/src/app/planning/plan.tsx).

#### Technique / Notes

- **Le premier jet du test passait pour la mauvaise raison.** Sous Jest, `Platform.OS` vaut `ios` :
  `ready()` sortait dès la garde de plateforme sans **jamais** évaluer l'opt-in. C'est le second cas
  du test qui l'a démasqué. Il faut `Object.defineProperty(Platform, 'OS', { value: 'android' })` —
  commenté dans le fichier. À retenir pour tout test futur touchant ce module.
- **Piège de méthode de la passe** : `uiautomator dump` ne capture que le **viewport visible**. À
  1,5×, le contenu descend et des libellés « disparaissent » du dump sans être tronqués. La première
  comparaison a produit une quinzaine de fausses troncatures, écartées après vérification à l'écran
  (`running-profile`, `food-custom`). Documenté dans [docs/plan-de-test.md](docs/plan-de-test.md).
- **Non corrigé, délibérément** : le widget planning du hub Muscu annonce une séance de **course**.
  Ce n'est pas un bug de filtre — les requêtes de `planned-session-repository.ts` portent la mention
  explicite « TOUS piliers » et l'US 3.9 s'appelle « planning muscu **unifié** ». Le corriger
  défairait une décision d'architecture. Entrée ouverte dans [BACKLOG.md](BACKLOG.md).
- **`SERVICE_REV = 'r4'` et les messages techniques non traduits sont conservés** : leur raison
  d'être (savoir quel APK tourne quand `app.json` reste en `0.0.0`) tient toujours, et ils
  n'apparaissent plus que sur un **échec réel**, où un message technique est à sa place.
- **OBJ-01 et BIEN-01 restent `etape: recette`** : ces correctifs lèvent deux constats de recette,
  ils ne remplacent pas la validation humaine. Notes mises à jour dans [RECETTES.md](RECETTES.md)
  avec ce qu'il reste à vérifier.
- **Correction d'un rapport erroné en cours de session** : un `npm run test` avait été lancé depuis
  `apps/mobile` (répertoire courant PowerShell persistant) et n'exécutait donc que Jest, sans Vitest.
  Relancé depuis la racine. **Leçon** : vérifier `> @wellness/shared` **et** `> @wellness/mobile`
  dans la sortie avant de conclure au vert.
- Qualité (depuis la racine, codes de sortie lus sans pipe) : `lint` **0** (8 warnings préexistants)
  · `typecheck` **0** · `test` **0** — **1 126 Vitest + 182 Jest** (37 suites).
- **Chaque correctif est vérifié sur device**, chiffres avant/après : bandeau HC absent · message
  d'état vide présent · CTA « Nouvel objectif » 2 → **1** · champs muets de food-custom 8 → **0** ·
  boutons « Retour » présents sur `run/active` et `planning/plan`.

### 30/07/2026 — `fix/pas01-entete-ecran-pas` — en-tête de l'écran « Pas » + constats de recette (9.15)

Commit précédent : `7459258`.

#### Corrigé

- **L'écran « Pas » n'avait pas d'en-tête de navigation.** La route `steps` était **absente** de
  [_layout.tsx](apps/mobile/src/app/_layout.tsx) — contrairement à ses quatre sœurs `measurements`,
  `review`, `goals` et `wellbeing`, toutes déclarées avec un `Stack.Screen`. Sans cette déclaration,
  Expo Router ne pose ni barre d'en-tête ni bouton retour : le titre de page remontait sous la barre
  d'état, à l'emplacement attendu du retour, et se superposait au bouton flottant du dev client.
  Ajout d'un `Stack.Screen name="steps"` **aligné mot pour mot** sur ses sœurs (`presentation: 'modal'`,
  `headerShown: true`, `title: t('steps.title')`, mêmes couleurs et typo).
  → 1 fichier : [apps/mobile/src/app/_layout.tsx](apps/mobile/src/app/_layout.tsx) (+14).

#### Modifié — suivi

- [RECETTES.md](RECETTES.md) : prérequis **sync rules PowerSync coché** (déployées le 29/07/2026) ;
  l'encadré « PARTAGE-01 exige un second build » est remplacé — le dev build du 29/07 est postérieur
  à PARTAGE-01 et embarque bien `react-native-view-shot` 5.1.0 (vérifié dans le
  `debugRuntimeClasspath`), donc **les 10 US device se recettent sur le même APK**, et non 9 + un
  rebuild. Ajout du piège `prebuild --clean` (ci-dessous).
- [RECETTES.md](RECETTES.md) : 2 constats consignés sous leurs US, **tous deux des décisions produit
  non tranchées**, pas des bugs — OBJ-01 affiche **deux fois** l'action « Nouvel objectif » sur l'état
  vide (confirmé dans l'arbre d'accessibilité : `content-desc` en double, donc annoncé 2× par
  TalkBack) ; BIEN-01 expose un écran d'historique **sans aucune action** pour lancer un check-in,
  là où Mensurations et Objectifs en ont une.
- [BACKLOG.md](BACKLOG.md) : entrée de dette ouverte puis cochée dans la même passe (le défaut a été
  corrigé aussitôt trouvé).

#### Technique / Notes

- **Le piège qui a coûté un build.** `apps/mobile/android/` n'est pas versionné (CNG) : après un
  `git pull` qui touche `app.json` ou un plugin natif, le dossier reste tel quel. Ici il datait
  d'avant l'ajout d'`expo-build-properties` et gardait `minSdkVersion 24`, alors que
  `androidx.health.connect:connect-client` en exige **26** → `Manifest merger failed`.
  Correctif : `npx expo prebuild --platform android --clean`, qui réécrit
  `android.minSdkVersion=26` dans `android/gradle.properties`. Documenté dans
  [RECETTES.md](RECETTES.md).
- **Ce bug ne pouvait pas être attrapé par la CI** : une route non déclarée ne casse ni le typecheck
  ni un test — l'écran rend, il rend mal. Seul un regard sur l'écran le voit. C'est l'argument le
  plus concret en faveur des recettes device.
- **Méthode de la passe** : pilotage adb (deep links `wellness://<route>`, `screencap`,
  `uiautomator dump`, `settings put system font_scale`). Vérifié au passage — les labels
  d'accessibilité de PAS-01 et BILAN-01 portent unités et deltas **en texte**
  (« Jours actifs : 3 / 7, en baisse de 57 % »), ce qui satisfait les critères « lisible sans la
  couleur » ; et le contenu reflue sans troncature à 1,5×. `font_scale` remis à 1.0.
- **Non vérifié, et à ne pas croire acquis** : l'activité réelle des sync rules. Les 5 nouvelles
  tables sont bien dans le schéma PowerSync local, mais **toutes vides** — et une table vide ne
  produit aucune ligne d'oplog, donc leur absence des buckets ne prouve rien. Le test décisif reste
  celui de [RECETTES.md](RECETTES.md) : archiver un exercice et vérifier que l'historique garde son nom.
- `package-lock.json` : churn de métadonnées `npm` uniquement (52 lignes `"peer": true` déplacées),
  **aucun changement de version ni de paquet** — sous-produit du `npm install` d'après-pull.
- PAS-01 reste `etape: close` et 9.15 reste ✅ : correctif cosmétique post-clôture, aucun périmètre
  fonctionnel ajouté ni retiré.
- Qualité : `npm run lint` **0 erreur** (8 warnings préexistants, fichiers de test) ·
  `npm run typecheck` **0** · `npm run test` **0** — 1 126 Vitest + 179 Jest. Codes de sortie lus
  sans pipe.

### 29/07/2026 — `feature/muscf14-substitution-exercice` — MUSC-F14 : substitution d'exercice (3.52 🟡)

3 décisions arbitrées par Florian, **2 dérivées**. Deux limites ont été énoncées **avant** de coder, et
ce sont elles qui définissent réellement ce lot.

#### Le motif « zone douloureuse » a été retiré, et ce n'est pas un raccourci

Le backlog demandait de suggérer une alternative en cas de « matériel pris **ou zone douloureuse** ».
Le premier motif est traitable ; le second ne l'est pas.

Nous n'avons en base **ni information articulaire, ni schéma de mouvement** (poussée / tirage,
dominance hanche ou genou). Rien ne permet d'affirmer qu'un exercice « ménage l'épaule ». Y répondre
aurait produit un **conseil de santé sans fondement**, présenté comme fiable — la première
fonctionnalité de l'app à affirmer ce qu'elle ne sait pas, sur le sujet où l'erreur blesse.

Les suggestions sont donc **neutres** : même groupe musculaire, et rien de plus. La justification
affichée reste **factuelle et vérifiable** — « Variante » ou le matériel. **Un test vérifie qu'aucun
vocabulaire de douleur, de blessure ou d'articulation n'apparaît dans le rendu.**

#### L'éditeur de programme : la demande ne pouvait pas être honorée telle quelle

Florian avait demandé les suggestions **en séance et dans l'éditeur de programme**. Vérification faite,
`SessionEditor` **n'expose que « ajouter » et « retirer »** — aucun parcours de remplacement, donc
**aucun exercice source** à partir duquel suggérer.

Livré : **la séance seule**, là où le remplacement existe. La spec §0.2 pose les deux suites possibles
(ajouter le remplacement dans l'éditeur — une US en soi — ou en rester là) ; **le composant et le hook
sont déjà génériques**, donc la première option ne demanderait pas de code de suggestion supplémentaire.

#### Le classement

- `packages/shared/src/exercise-substitution.ts` (**13 tests**) : une **variante déclarée** prime
  toujours sur une suggestion calculée. C'est une donnée saisie par un **humain** (éditeur ou
  utilisateur) — elle vaut mieux que n'importe quel score, et elle est retenue **même si son groupe
  musculaire diffère** : si quelqu'un a lié deux exercices, on ne remet pas cette information en cause.
- Score : variante (1000) > même groupe (100) > matériel différent (20) > muscles secondaires communs
  (5 chacun). Le bonus « matériel différent » est ce qui répond au cas réel « la machine est occupée ».
- **Tri déterministe** : à score égal, l'ordre alphabétique tranche. Sans cela l'ordre dépendrait de
  celui des candidats en entrée, et un même résultat s'afficherait différemment d'une fois à l'autre —
  ce qui se lit comme un bug. Un test le vérifie en inversant la liste d'entrée.
- **Aucune suggestion pertinente → aucune section.** Pas de bloc vide, pas de suggestion forcée.

#### Application

- `exercise-substitution-repository.ts` : requête dédiée, bornée au groupe musculaire de la source —
  `useExercises` ne remonte pas `muscles_secondary`, et l'alourdir aurait touché tous les écrans de
  sélection. Les exercices **archivés sont exclus** : nuance avec ADMIN-01, où afficher le **nom** d'un
  exercice archivé est nécessaire, mais le **proposer** ne l'est pas.
- `SubstitutionSection` (**6 tests**) : un seul composant, prêt pour les deux surfaces.
- `onPick` de l'écran d'exercices a été **resserré à `{ id: string }`** — c'est tout ce qu'il utilisait
  réellement. La section n'a donc pas à fabriquer un faux `ExerciseListItem` avec des champs inventés.

#### Qualité

`npm run typecheck` 0 erreur · `npm run lint` 0 erreur (8 warnings préexistants) ·
`npm run test` **1305 verts** (1126 Vitest + 179 Jest), dont **19 pour MUSC-F14**.
**Aucune migration, aucune table, aucune sync rule.**

🟠 **Décision attendue de Florian** : que faire pour l'éditeur de programme (spec §0.2).

### 29/07/2026 — `feature/ux05-rpe-ou-rir` — UX-05 : intensité en RPE ou en RIR (3.55 🟡)

3 décisions arbitrées par Florian, **2 dérivées**. L'inventaire préalable a **réduit le périmètre**, et
c'est le point le plus utile de cette US.

#### Ce que l'inventaire a révélé

Le RPE existait à **trois endroits, avec deux échelles** : par série (`workout_sets.rpe`, 1-10), en
ressenti de séance (`workouts.rpe`, affiché en **5 étoiles** bornées 1-5) et en ressenti de course
(`runs.rpe`, 1-10).

Or « RIR » signifie **répétitions en réserve**. Cela n'a de sens que pour une **série de musculation** :
sur une sortie de 10 km c'est absurde, et sur le ressenti de séance la formule `10 − RPE` serait
**arithmétiquement fausse** puisque l'échelle y est 1-5. D'où le périmètre retenu : **le RPE par série
uniquement**, les deux autres explicitement inchangés.

#### Le choix qui protège les données existantes

**Inversion pure `RIR 0 → 9`**, et non la plage réellement utilisée `0-4`. La plage restreinte aurait
rendu **inaffichables les RPE de 1 à 5 déjà saisis**, et repasser en mode RPE ne les aurait pas
retrouvés. Ici la bascule est **réversible et sans perte** — un test le vérifie sur les 10 valeurs, en
composant `toDisplay` puis `toStored`.

- `packages/shared/src/intensity.ts` (**14 tests**) : `toDisplayIntensity` / `fromDisplayIntensity`
  (réciproques exactes), `intensityChoices` (ordre de lecture propre à chaque échelle),
  `parseIntensityScale` (tolérant → `rpe`).
- **`null` reste `null`.** La conversion naïve `10 - (rpe ?? 0)` aurait transformé une intensité **non
  saisie** en « RIR 10 », c'est-à-dire en information inventée. Verrouillé deux fois : dans la brique,
  et au niveau du composant.
- **Ordre de lecture** : RPE 1 → 10 (l'effort croît vers la droite), RIR 0 → 9 (la réserve croît, donc
  l'effort décroît). Chaque échelle se lit comme l'utilisateur la pense ; afficher le RIR en 9 → 0
  « pour garder l'ordre du RPE » aurait été déroutant.

#### Base de données : 1 migration, 0 sync rule

`user_settings.intensity_scale text not null default 'rpe'` + `check in ('rpe','rir')`.
**Le RIR n'est jamais stocké** : `workout_sets.rpe` reste la seule vérité. C'est le patron exact de
`user_settings.units` (« stockage toujours en SI, conversion à l'affichage »), et c'est pour cette
raison que la préférence vit **juste à côté** d'elle.

`user_settings` étant déjà publiée et lue en `select *`, **aucune sync rule à redéployer** — précédent
vérifié (`health_connect_enabled`). Et **une seule migration**, sans complément de publication.

#### Surfaces

- `hooks/useIntensity.ts` : pendant de `useUnits`, pour que trois écrans ne réinventent pas `10 - rpe`.
- `CurrentSetCard` : les pastilles proposent les valeurs de l'échelle choisie, et la sélection est
  **reconvertie en RPE** avant stockage. `RPE_VALUES`, devenu mort, a été retiré.
- `history/[id].tsx` : la série affiche l'échelle choisie.
- `settings.tsx` : le réglage, placé juste après les unités — même nature de choix. L'aide affichée est
  celle de l'échelle **active** : « RIR » seul ne dit rien à qui hésite.
- **4 clés i18n existantes sont désormais paramétrées** par `{{scale}}` (`workout.rpeAdd`,
  `workout.rpeValue`, `workout.rpeLabel`, `history.detail.setRpe`).

#### Un test qui verrouillait l'ancien comportement

`CurrentSetCard.level.test.tsx` comparait au littéral `fr.workout.rpeAdd`, devenu « ＋ {{scale}} série ».
Mis au nouveau contrat en interpolant l'échelle par défaut — ce qui **teste au passage le repli sur
« RPE »** quand les réglages ne sont pas encore chargés. Plus un nouveau fichier de 6 tests qui
verrouille la bascule elle-même.

#### Qualité

`npm run typecheck` 0 erreur · `npm run lint` 0 erreur · `npm run test` **1286 verts**
(1113 Vitest + 173 Jest), dont **20 pour UX-05**.

> **Correction d'un chiffre annoncé au commit précédent** : j'avais écrit « 6 warnings préexistants »
> pour PARTAGE-01 ; il y en avait **8**, les 2 derniers venant du fichier de test que j'avais créé
> après avoir lancé le lint. Ce sont des `require()` dans des mocks Jest — patron imposé par le
> hoisting de Babel, déjà toléré dans `charts-smoke.test.tsx`. Le « 0 erreur » était exact.

⚠️ **Reste à faire par Florian** : la recette device, 9 critères. **Recettable sur l'APK actuel** —
aucune dépendance native ajoutée, contrairement à PARTAGE-01.

### 29/07/2026 — `feature/partage01-carte-partageable` — PARTAGE-01 : carte partageable (7.17 🟡)

Fait descendre **META-41** du catalogue. 4 décisions arbitrées par Florian, **3 dérivées**. Périmètre
élargi à sa demande : **les deux cartes** (course **et** muscu) dès le premier lot, contre ma
recommandation de commencer par la course. Arbitrage assumé — deux mises en page au lieu d'une.

#### Le piège évité : ne pas capturer la carte

`RouteMap` repose sur **MapLibre natif**, et capturer une vue native de carte avec `captureRef` donne
en pratique une image **noire ou vide**. Le tracé est donc **reprojeté en polyligne SVG** à partir des
points GPS. Ce détour rapporte deux choses qui n'étaient pas l'intention de départ : la carte
fonctionne **sans clé MapTiler** et **hors ligne**, là où l'écran de résumé a besoin des deux.

#### Ce qui sépare un tracé d'un gribouillis

- `packages/shared/src/share-card.ts` (**21 tests**) : `projectTrack` applique une **échelle uniforme**
  sur les deux axes et corrige la longitude par `cos(latitude)`. Sans la première, un parcours de 2 km
  sur 100 m serait étiré pour remplir le carré — illisible **et faux**. Sans la seconde, tous les
  tracés paraîtraient étirés horizontalement, d'autant plus qu'on s'éloigne de l'équateur. **Deux
  tests dédiés** verrouillent ces deux propriétés.
- L'axe Y est **inversé** (la latitude monte vers le nord, `y` descend en SVG) : sans ça, le tracé
  serait un miroir vertical du parcours réel. Testé aussi.
- Cas dégénérés : tracé vide → `[]` ; point unique ou **points tous confondus** (GPS bloqué) → centre
  de la boîte. **Aucun `NaN`** ne peut sortir de la projection, y compris sur un tracé purement
  horizontal ou vertical.
- `sampleTrack` borne à 400 points en **conservant le premier et le dernier**. On ne réutilise pas
  `simplifyTrack` (Douglas-Peucker) : son critère est une tolérance **en mètres**, donc il ne garantit
  aucune borne sur la taille du `path` SVG.

#### Une seule vue pour l'aperçu et la capture

`ShareCard` est dimensionnée **proportionnellement à `size`** : dessinée à ~320 dp elle sert d'aperçu,
capturée à 1080 px elle donne l'image partagée. Une seule mise en page à maintenir, et ce que
l'utilisateur voit **est** ce qu'il envoie.

- `ShareCardSheet` : aperçu puis partage (D4). Une image part sur un réseau **public** — un tracé
  illisible ou un chiffre tronqué ne doit pas se découvrir après publication.
- `lib/share-card-export.ts` : capture → copie sous un nom lisible et daté → feuille de partage. Même
  contrat d'erreurs typées que `gpx-export`. Si le renommage échoue, on partage le fichier temporaire
  **plutôt que de perdre l'image** — le nom est un confort, pas une condition.
- Branché dans les **2** écrans de résumé. Côté course, le bouton apparaît sur **toute** course
  terminée, y compris manuelle : sans tracé la carte affiche ses chiffres seuls, ce qui reste
  partageable. C'est la différence avec l'export GPX, qui exige une trace.

#### Ce que la carte ne montrera jamais (D7)

Ni poids de corps, ni mensuration, ni indicateur de bien-être : ce sont des données de santé, et une
image partie sur un réseau public ne se rattrape pas. **Un test fige cette intention** — si quelqu'un
ajoute le poids à la carte un jour, il échoue.

Les 7 tests de `ShareCard` couvrent aussi : une séance sans record n'affiche **pas** de section vide,
les records sont bornés à 3 (au-delà la carte devient une liste), et une course sans tracé rend quand
même sa carte.

#### ⚠️ Le coût caché : un second build

`react-native-view-shot` (5.1.0, version **alignée SDK 57** vérifiée par `expo install --check`) est
une **dépendance native**. Le dev client et l'APK doivent être reconstruits : **PARTAGE-01 ne peut pas
être recettée sur l'APK des 9 autres US.** Ce coût n'apparaissait pas dans l'estimation de 4 h ; il est
documenté dans la spec §0.2 et dans [RECETTES.md](RECETTES.md), avec les deux façons de s'organiser.

#### Qualité

`npm run typecheck` 0 erreur · `npm run lint` 0 erreur (6 warnings préexistants) ·
`npm run test` **1260 verts** (1099 Vitest + 161 Jest), dont **28 pour PARTAGE-01**.
**Aucune migration, aucune table, aucune sync rule.**

### 29/07/2026 — `feature/bilan01-bilan-hebdo` — BILAN-01 : bilan hebdomadaire automatique (7.16 🟡)

Fait descendre **MR-22**, **TRI-07** et **NUTR-18** du catalogue d'analyses. 4 décisions arbitrées par
Florian, **3 dérivées** tranchées et signalées comme telles dans la spec.

#### La contradiction que le backlog ne disait pas

Le récap est calculé **localement**, donc seulement quand l'app tourne — mais la notification doit
partir app fermée. Résolution (D1) : **la notification ne contient aucun chiffre**, tout est recalculé
à l'ouverture de l'écran. Conséquence directe et voulue : le **doze mode Android**, annoncé comme le
point dur de l'US, devient **sans conséquence**. Une notification livrée six heures en retard reste
exacte, parce qu'elle n'affirme aucun nombre.

#### « Aucune narration sans les chiffres » — imposé par le type, pas par la discipline

`ReviewDecision.metrics` **n'est pas optionnel**. Un signal qui ne transporte pas les chiffres qui le
justifient ne compile pas. Un test le vérifie sur les 6 signaux d'un coup.

- `packages/shared/src/weekly-review.ts` (**26 tests**) : `lastClosedWeek`, `previousWeek`,
  `isEmptyWeek`, `buildWeeklyReview`. La décision est choisie par **règles ordonnées** (D2), la
  première qui déclenche gagne : objectif en retard → régularité → déséquilibre musculaire → volume →
  adhérence nutrition → rien à signaler. Déterministe, testable, et surtout **explicable**.
- L'ordre est justifié dans la spec §3.3, rang par rang. La nutrition est **en dernier** délibérément :
  on ne veut pas ouvrir chaque semaine sur l'alimentation.
- Un objectif dont la progression est **non calculable** est ignoré : un retard indéterminable n'est
  pas un retard, et l'annoncer serait une accusation sans preuve.
- Pas de semaine précédente → **aucune comparaison**. Un « +100 % » depuis zéro serait une flatterie
  mensongère au premier usage.

#### La semaine, et pourquoi elle est close (D5)

Le bilan porte sur la dernière semaine ISO **close** (lundi→dimanche). Il est donc **définitif** — même
raisonnement que le verdict d'OBJ-01. Consulté un **dimanche**, il montre encore la semaine d'avant :
résumer une semaine non terminée serait faux. Un test verrouille ce cas.

#### Un défaut que j'ai introduit puis corrigé à la source (D6)

J'avais d'abord branché l'adhérence nutrition sur `useGoalAdherence(7)` — une fenêtre **glissante**,
alors que tout le reste porte sur la semaine ISO. Sous un titre « semaine du 20 au 26 juillet »,
un chiffre d'une autre période : exactement la narration non adossée aux chiffres que l'US interdit.
Corrigé en extrayant **`useGoalAdherenceForRange(from, to)`** de `useGoalAdherence`, qui n'en est plus
qu'un wrapper — **API existante inchangée**, aucun appelant touché.

- `weekly-review-repository.ts` : toutes les requêtes sont bornées sur la **même** fenêtre. Les
  timestamps sont convertis en jours **locaux** (`localDayKey`), jamais par `date()` en SQLite qui
  donnerait le jour UTC.
- ⚠️ **Les jokers de série ne comptent pas** comme jours actifs : un joker protège le compteur de
  série **et rien d'autre** (STREAK-01, D3). Le bilan doit voir la semaine telle qu'elle a été vécue,
  sinon il féliciterait pour un jour où rien n'a eu lieu.

#### Notification, préférences — et zéro migration (D7)

- Déclencheur **`WEEKLY` récurrent** côté OS (`weekday` **2 = lundi** — la convention du SDK 57 est
  `1 = dimanche`, constante nommée `WEEKLY_REVIEW_WEEKDAY` pour que l'erreur ne puisse pas se glisser
  dans un appel). Récurrent, donc **rien à mémoriser** : ni « dernière semaine notifiée », ni
  re-planification à la main.
- Révisé **à chaque ouverture** : la décision D4 interdit de notifier une semaine vide, et le contenu
  ne peut pas être connu à l'avance. Limite assumée et documentée dans la spec.
- **2 préférences** (`weeklyReview`, `weeklyReviewHour` défaut 9 h) dans `user_settings.notifications`
  — colonne JSON déjà synchronisée, parseur déjà tolérant : **aucune migration, aucune sync rule**.
  Les réglages déjà enregistrés continuent de fonctionner, et un test le vérifie.
- Invariant **testé** : 9 h reste **hors** de la fenêtre DND par défaut `[22, 7)`. Sans lui, le bilan
  serait planifié puis systématiquement supprimé par le filtre — une fonctionnalité muette, sans
  aucune erreur visible.

#### Surfaces

- `app/review.tsx` : la **décision d'abord** (c'est ce qui sert à agir), puis « Les chiffres » qui la
  rendent vérifiable. Les variations sont annoncées **en mots** (« en hausse de 12 % »), jamais par la
  seule couleur. La ligne « jours dans la cible » est **omise** quand aucune cible n'est définie —
  jamais affichée à 0.
- `ReviewCard` (widget, 3 formes, **6 tests**) : gardé `'always'`, contrairement à `goals` — le bilan
  **agrège ce qui existe**, donc un utilisateur « nutrition seule » y trouve du contenu. Un test
  verrouille cette distinction.

#### Qualité

`npm run typecheck` 0 erreur · `npm run lint` 0 erreur (6 warnings préexistants) ·
`npm run test` **1239 verts** (1078 Vitest + 161 Jest), dont **32 pour BILAN-01**. Les compteurs de
`widgets.test.ts` passent à 13 widgets d'accueil.

⚠️ **Reste à faire par Florian** : la recette device, 12 critères. **Aucune sync rule pour cette US.**

### 29/07/2026 — `feature/obj01-objectifs` — OBJ-01 : objectifs à échéance (fin du lot) + registre de recettes

**Deux choses dans ce commit** : la fin d'OBJ-01 (l'increment précédent s'arrêtait au cadrage et à la
brique de calcul) et un **registre de recettes** né d'un vrai besoin — la recette est la seule étape
que je ne peux pas franchir, donc la seule dont l'information mourait avec la session.

#### `RECETTES.md` (nouveau) — le suivi qui manquait

Les critères cochables des 8 US bloquées à `etape: recette`, avec le **prérequis bloquant** en tête
(le déploiement des sync rules), le support de chaque recette (📱 device / 🌐 navigateur) et l'ordre
dans lequel s'y prendre — six US se recettent sur **un seul APK**, mais seulement après le
déploiement, sinon trois d'entre elles échouent pour une raison qui n'a rien à voir avec leur code.

Il obéit à la règle du dépôt : **une section disparaît dès que l'US est clôturée**. Un fichier de
suivi qui ne fait que grossir a cessé d'être un tableau de bord.

- `scripts/etat.mjs` : renvoi **calculé** vers `RECETTES.md` sous le tableau des US en cours, avec le
  compte et la liste des US concernées. Généré, donc il se met à jour — et disparaîtra tout seul
  quand plus aucune US ne sera en recette.
- `CLAUDE.md` : entrée dans « Où se trouve quoi » et dans la structure de la documentation.

#### OBJ-01 — base de données

- `20260729131013_obj01_personal_goals` : table `personal_goals`. **Ni `status` ni `progress`** —
  les deux sont dérivés (D5), et les stocker aurait demandé un **écrivain** à déclencher, or une app
  mobile hors ligne n'offre aucun moment fiable pour clôturer les objectifs échus.
  `check` sur `kind` plutôt qu'un enum : un type d'objectif de plus (volume, poids, pas) ne demandera
  pas de migration de données. `exercise_id` en `on delete set null` **et non cascade** : un exercice
  supprimé rend l'objectif non calculable, il ne l'efface pas.
- `20260729131107_..._publication` : `alter publication powersync add table`, gardé par
  `pg_publication_tables`.
- Registre coché (55 → 57), types régénérés, `powersync-sync-rules.yaml` complété.

#### OBJ-01 — application

- `goal-repository.ts` : lecture des objectifs + assemblage des sources d'activité. Les timestamps
  sont convertis en jour **local** en JS (`localDayKey`) et non par `date()` en SQLite, qui donnerait
  le jour **UTC** — une course de 23 h le 31 juillet basculerait au 1ᵉʳ août et sortirait de la
  fenêtre. Les jointures de traduction **ne filtrent pas `deleted_at`** : même correctif qu'ADMIN-01,
  un exercice archivé doit continuer d'afficher son nom. Le plafond de 3 est **relu à l'écriture**,
  pas repris de l'affichage (un autre appareil peut avoir créé un objectif entre-temps).
- `app/goals.tsx` + `GoalCard` + `GoalFormSheet` : liste (en cours / terminés avec verdict) et
  création. L'échéance se choisit **en semaines** (4/8/12), pas dans un calendrier : un objectif se
  pense en durée d'engagement. Le 1RM de départ est **calculé et montré avant validation** — sans ce
  repère, « 105 kg » ne dit pas s'il s'agit d'un pas ou d'un bond.
- `RingGauge` : prop `milestones` plutôt qu'un second composant d'anneau. Les repères sont dessinés
  en couleur de **fond**, donc lus comme des encoches visibles que la portion soit remplie ou non.
- `GoalsCard` (widget, 3 formes, 5 tests) : ordonné par **urgence** et non par avancement — un
  objectif à 90 % avec trois semaines devant lui est moins pressant qu'un à 40 % qui se joue demain.
  Gardé par `['strength','running']` et **pas** `'always'` : les 2 types portent sur la course et la
  force, un utilisateur « nutrition seule » n'aurait qu'un vide permanent.
- Export RGPD, `powersync/schema.ts`, route dans `_layout.tsx`, i18n FR+EN (namespace `goals`).

#### Correction d'une affirmation fausse

**Le typecheck que j'ai annoncé vert au commit `67b171f` ne l'était pas.** `goals.ts` exportait un
type `Goal` déjà exporté par `profile.ts` (l'objectif de profil : muscle / perte de poids / …), ce
qui cassait `packages/shared/src/index.ts`. Renommé en **`PersonalGoal`**, qui colle au nom de la
table. J'avais lancé la commande depuis un sous-répertoire : npm ne couvrait alors qu'un workspace.

#### Qualité

`npm run typecheck` 0 erreur · `npm run lint` 0 erreur (6 warnings préexistants) ·
`npm run test` **1193 verts** (1043 Vitest + 150 Jest), dont 26 pour OBJ-01. Trois tests de
`widgets.test.ts` attendaient 11 widgets d'accueil : passés à 12, plus une assertion qui verrouille
la garde pilier de `goals` — c'est le choix non évident du lot.

⚠️ **Reste à faire par Florian** : déployer la sync rule (`personal_goals` est le **4ᵉ** changement
en attente dans le même collage) puis la recette device, 11 critères.

### 29/07/2026 — `feature/obj01-objectifs` — OBJ-01 : cadrage + cœur de calcul (US **non livrée**)

> ⚠️ **Increment partiel, assumé et annoncé.** Sont livrés : le cadrage (4 décisions arbitrées par
> Florian + 2 dérivées) et la **brique de progression pure**, 21 tests. Restent les 2 migrations, le
> repository, l'écran, le widget et l'i18n. **Roadmap 7.15 reste ⬜** — rien n'est utilisable par un
> utilisateur, donc la marquer 🟡 serait mentir. Commit précédent : `fcee5ca`.

**Ajouté**

- `docs/specs/functional/us/obj01-objectifs.md` — spec complète, 6 décisions, 9 cas limites,
  11 critères de recette.
- `packages/shared/src/goals.ts` + `.test.ts` (**21 tests**) — `computeGoalProgress`,
  `goalWindowEnd`, `isGoalActive`, `canCreateGoal`, `validateGoalTarget`.

**Technique / Notes**

- **D5, la décision qui structure tout : rien n'est stocké de la progression ni du statut.** Les deux
  sont des **fonctions pures de la fenêtre `[start_date, deadline]`**. Trois bénéfices : aucun travail
  de fond à déclencher (pas de cron, personne à réveiller pour clôturer les objectifs échus) ; un
  **verdict stable**, puisqu'un record battu deux mois plus tard tombe hors fenêtre et ne peut pas
  réussir rétroactivement un objectif passé ; et **ça marche hors ligne**. Un test vérifie
  explicitement qu'un verdict passé ne change pas quand on court davantage ensuite.
- **D1 — deux types, choisis pour être les cas durs** : un **cumul** qui part de zéro (`run_distance`)
  et un **record** qui part d'une valeur existante (`exercise_1rm`). Valider l'architecture sur ces
  deux formes de progression, c'est la valider ; un seul type l'aurait mal dimensionnée.
- **D6 — valeur de départ figée** pour l'objectif de force : « +5 kg au développé » n'a de sens que
  par rapport au 1RM du jour de création. Même patron que `start_weight_kg` (NUTR-11). Conséquence
  testée : un 1RM antérieur à la fenêtre **ne compte pas**, sinon l'objectif serait atteint dès sa
  création.
- **Trois règles fines que les tests verrouillent** : la progression ne **régresse jamais** sous le
  départ (une mauvaise séance ne fait pas reculer l'objectif) ; le statut reste **`active` même à
  100 %** avant l'échéance (atteindre sa cible en avance n'interdit pas de continuer) ; et un exercice
  supprimé rend la progression **non calculable** plutôt que « 0 % », qui se lirait comme un échec.
- `validateGoalTarget` **refuse une cible de force déjà atteinte** : un objectif qui ne demande aucun
  effort n'est pas un objectif, et l'anneau afficherait 100 % immédiatement.
- **Ce qui reste à faire**, dans l'ordre : 2 migrations (table `personal_goals` + publication, spec §4)
  → repository → écran liste/création avec anneaux et jalons visuels → widget → i18n. Le modèle est
  déjà conçu pour accueillir les types différés (volume, poids, pas) **sans migration** grâce au
  `check` sur `kind`.
- Qualité : `npm run test` **vert** (56 fichiers Vitest + 31 suites Jest / 150 tests),
  `npm run typecheck` vert, `npm run lint` 0 erreur.

### 29/07/2026 — `feature/streak01-joker` — STREAK-01 : joker de série (7.14 ⬜ → 🟡)

> **4 décisions produit arbitrées par Florian avant tout code** — c'était la demande du backlog, et
> c'est bien de la mécanique produit, pas de la technique. Commit précédent : `34abbde`.

**Ajouté**

- 2 migrations : table `streak_jokers` (une ligne par jour manqué couvert, index unique partiel, RLS
  own sans `delete`) + `alter publication powersync`.
- `packages/shared/src/streak-joker.ts` + `.test.ts` (**18 tests, verts d'emblée**) :
  `computeStreakWithJokers`, `findRestorableGap`, `jokersRemaining`.
- `apps/mobile/src/data/repositories/streak-joker-repository.ts` — `consumeJoker` **relit le quota**
  au moment du tap plutôt que de reprendre celui de l'affichage : entre les deux, le mois peut avoir
  changé ou un autre appareil avoir consommé le joker.
- Proposition dans le widget de série, i18n FR + EN, table ajoutée à l'export RGPD.

**Technique / Notes**

- **D1 — manuel et rétroactif à l'ouverture.** L'app détecte la rupture et propose le joker en
  annonçant **les jours sauvés**. Un joker automatique rendrait la série sourdement inbrisable — la
  même erreur que si le check-in de BIEN-01 comptait dans la série. Et le rétroactif est ce qui rend
  le manuel viable : on manque sa journée **parce qu'on n'a pas ouvert l'app**, donc exiger l'action
  le jour même l'aurait rendue inopérante.
- **D3 — un joker protège le compteur, il ne fabrique pas d'activité.** Le repository n'écrit **que**
  dans `streak_jokers` : l'adhérence, la complétion du journal et les corrélations post-V1 continuent
  de voir un jour vide, parce qu'il l'est. Un test vérifie même que `activeToday` reste **faux** quand
  seul un joker couvre aujourd'hui. Falsifier la donnée pour sauver un affichage aurait été le pire
  des choix.
- **D4 — le garde-fou des jokers consécutifs est dans le CALCUL, pas seulement à la consommation.** Si
  la base contenait deux jokers d'affilée (anomalie, import, bug futur), la série **s'arrête** au
  second plutôt que de propager une valeur fausse. Testé.
- **Deux règles déjà décidées par le code**, documentées en §0 de la spec pour éviter de les
  re-débattre : ce qui rend un jour actif, et la tolérance existante du jour courant (une journée
  commencée n'est pas une journée manquée) — le joker ne concerne donc que les jours **révolus**.
- **Un test existant a cassé, et c'était utile** : les mocks de `StreakCard.test.tsx` ne connaissaient
  pas le nouveau champ `restorableGap`, qui valait donc `undefined` — et mon `=== null` ne le couvrait
  pas. Corrigé des deux côtés : le widget teste `== null` (une proposition optionnelle ne doit pas
  faire planter un widget si l'appelant omet le champ) **et** les mocks ont été complétés.
- ⚠️ **Écart repéré et corrigé avant commit** : j'avais ajouté deux clés i18n que le widget n'affichait
  pas. `jokerNoneLeft` était de toute façon inatteignable — `findRestorableGap` renvoie `null` aussi
  bien quand il n'y a pas de trou que quand il n'y a plus de joker, donc le widget ne peut pas
  distinguer les deux cas. Clé **supprimée**, et `jokerRule` est désormais **affichée dans la
  proposition** : la règle est expliquée au seul moment où elle compte. Spec §3, §6 et critère 3 mis
  au réel.
- ⚠️ **Reste à faire avant ✅** : déployer la **sync rule** (bucket `user_data`) et la recette device.
- Qualité : `npm run test` **vert** (55 fichiers Vitest + 31 suites Jest / 150 tests),
  `npm run typecheck` vert, `npm run lint` 0 erreur, 0 avertissement nouveau.

### 29/07/2026 — `feature/nutrf2-substitution-aliments` — NUTR-F2 : suggestion pour combler un macro (4.37 ⬜ → 🟡)

> Validée par Florian le 29/07/2026, mes recommandations valant arbitrage des 7 décisions. Rend le
> journal nutrition **actionnable** au lieu de constatif. Commit précédent : `9704ece`.
> **Aucune migration, aucune sync rule** — que du calcul local.

**Ajouté**

- `packages/shared/src/macro-suggestion.ts` + `.test.ts` (**18 tests**) — `macroGaps`,
  `pickMacroToFill`, `suggestFoodsForMacro`. **Déterministe, sans IA** : une suggestion d'aliment doit
  être reproductible, explicable et fonctionner hors ligne.
- `apps/mobile/src/components/nutrition/MacroSuggestionCard.tsx` — carte conditionnelle, sélecteur de
  macro, ajout au journal en un tap.
- i18n `suggestion` FR + EN.

**Modifié**

- `(tabs)/nutrition.tsx` — carte montée sous les repas, **jour courant seulement** (suggérer un ajout
  à une journée passée n'a pas de sens).
- Roadmap 4.37 → 🟡, compteurs **168 / 13 / 22**.

**Technique / Notes**

- **Les trois règles qui font la différence entre un conseil et un gadget**, chacune corrigeant une
  façon naturelle de se tromper :
  1. **tri sur la densité du macro POUR 100 KCAL**, pas pour 100 g. Un tri sur les g/100 g désignerait
     mécaniquement les aliments les plus caloriques ; on cherche l'aliment *efficace*. Le test qui
     verrouille ça : les **amandes**, les plus riches en protéines pour 100 g des trois candidats,
     doivent finir **dernières** ;
  2. **macro choisi sur l'écart RELATIF**, pas absolu — en absolu les glucides gagneraient presque
     toujours, leur cible en grammes étant la plus élevée ;
  3. **quantité hors bornes → aliment ÉCARTÉ**, pas tronqué. « 900 g de brocoli » et « 8 g de whey »
     sont arithmétiquement justes et culinairement absurdes. C'était le risque n°1 nommé par le
     backlog ; il est testé aux deux bornes.
- Un candidat est aussi écarté si son apport calorique à la quantité proposée **dépasse le budget
  restant** : combler un macro en faisant exploser les calories n'est pas un conseil imparfait, c'est
  un mauvais conseil. Et la carte ne s'affiche pas du tout si le budget est déjà épuisé (D6).
- **Deux erreurs dans mes propres tests, révélées par leur exécution** : j'avais supposé que le
  fromage blanc 0 % battait le blanc de poulet en efficacité protéique (faux : 5,9 kcal par gramme de
  protéine contre 5,3), et mes deux valeurs du test de départage par récence étaient inversées. Le
  code était juste, les attentes non — corrigées, avec les calculs explicités en commentaire.
- ⚠️ **Réduction assumée : le vivier est limité aux aliments récents (40).** La spec prévoyait
  « récents **puis la base** ». Scorer la base côté client obligerait à charger l'intégralité de CIQUAL
  en mémoire **à chaque rendu** de l'onglet — un vrai problème de performance pour un gain marginal,
  les récents étant de toute façon le vivier le plus utile (on mange ce qu'on a chez soi). Un repli
  propre demande un **pré-filtrage SQL**. Spec §2 et §D4 mises au réel, et un critère de recette
  ajouté pour mesurer si les récents suffisent.
- ⚠️ **Limite affichée, pas masquée** : la suggestion **ne tient pas compte du régime ni des allergènes
  déclarés**. `nutrition_profiles` les porte, mais **aucun aliment n'est étiqueté** en base pour les
  recouper. La carte le dit explicitement — les ignorer en silence serait un faux service.
- **Hors périmètre clarifié** : le titre de la roadmap dit « substitution » mais son contenu décrit un
  **ajout** pour combler un manque. Remplacer une entrée déjà journalisée suppose de choisir laquelle
  retirer : autre geste, autre US.
- Qualité : `npm run test` **vert** (54 fichiers Vitest + 31 suites Jest / 150 tests),
  `npm run typecheck` vert, `npm run lint` 0 erreur — et **0 avertissement nouveau** (2 introduits
  puis corrigés : `ReadonlyArray<T>` → `readonly T[]`, la convention du dépôt).

### 29/07/2026 — `feature/mesur01-mensurations` — MESUR-01 : mensurations corporelles (3.51 ⬜ → 🟡)

> Validée par Florian le 29/07/2026, mes recommandations valant arbitrage des 6 décisions.
> Fait enfin descendre **E8** de la spec muscu §5, cadrée le 04/07 et jamais dotée d'un modèle de
> données — 25 jours d'écart. **🟡 et non ✅** : sync rule à redéployer + recette device.
> Commit précédent : `1d59fa7`.

**Ajouté**

- `supabase/migrations/20260729091950_mesur01_body_measurements.sql` — table **normalisée** : une
  ligne par `(user_id, log_date, kind)`, `kind` contraint par `check` (pas un enum : remplacer un
  check est trivial, faire évoluer un enum ne l'est pas), `value_cm numeric(5,1)` borné 1–300 cm
  (écarte la virgule oubliée sans juger la morphologie de personne), index unique **partiel**, index
  de lecture `(user_id, kind, log_date desc)`, RLS own sans `delete`.
- `supabase/migrations/20260729091953_..._publication.sql` — `alter publication powersync`.
- `packages/shared/src/units.ts` — **`cmToIn` / `inToCm`**, qui n'existaient pas.
- `packages/shared/src/measurements.ts` + `.test.ts` (**16 tests**) — les 6 mesures, bornes,
  `measurementSeries` (trous conservés), `latestByKind`, `measurementDeltas`.
- `apps/mobile/src/data/repositories/body-measurement-repository.ts` + test (**8 tests**).
- `apps/mobile/src/components/measurements/MeasurementSheet.tsx` — feuille pré-remplie.
- `apps/mobile/src/app/measurements.tsx` — historique : sélecteur de mesure, courbe, relevés + delta.
- `apps/mobile/src/hooks/useUnits.ts` — `formatCircumference`, `toCircumferenceValue`,
  `parseCircumferenceToCm` (accepte la **virgule** décimale).

**Modifié**

- `progress/index.tsx` — point d'entrée (décision D5 : pas de widget, une mesure **mensuelle** ne
  mérite pas une place permanente sur un écran quotidien ; et E8 est un epic muscu).
- `_layout.tsx` — écran `measurements` enregistré… **et `wellbeing` aussi**, qui avait été oublié à
  la livraison de BIEN-01 : l'écran fonctionnait mais sans en-tête ni titre configurés.
- `powersync/schema.ts`, `powersync-sync-rules.yaml` (bucket `user_data`), `MIGRATIONS.md` (2 lignes),
  `data-export.ts` (export RGPD), `database.types.ts`, i18n `{fr,en}` (namespace `measurements`,
  26 clés dont les 6 libellés de mesure), roadmap 3.51 → 🟡 (**168 / 12 / 23**).

**Technique / Notes**

- **D1, la décision structurante : modèle normalisé, à l'inverse de BIEN-01.** La liste des mesures a
  vocation à bouger (la spec E8 dit « etc. ») ; en table large, chaque ajout coûterait une migration
  pour des colonnes majoritairement `NULL`. BIEN-01 est large **parce que** ses 3 indicateurs sont
  figés par la roadmap. Bénéfice acquis : ajouter gauche/droite (D3, écarté en V1) ne coûtera **aucune
  migration**.
- **`formatHeight` ne convenait pas** : il rend l'impérial en pieds-pouces, donc un tour de bras de
  35 cm se serait affiché « 1 ft 1,8 in » au lieu de **13,8 in**. D'où des helpers dédiés aux
  circonférences, avec un test d'**aller-retour** de conversion — une conversion asymétrique ferait
  dériver l'historique à chaque bascule de réglage.
- **Stockage toujours en cm.** La bascule métrique/impérial est un fait d'affichage ; convertir au
  stockage réécrirait l'historique.
- **Delta du premier relevé = `null`, pas `0`** — « rien à comparer » n'est pas « aucun changement ».
  Testé explicitement, y compris le cas d'une valeur réellement stable (delta `0` légitime).
- **D4 : pas de fenêtre de rattrapage, contrairement à BIEN-01.** Un tour de taille est une mesure
  *objective* qu'on saisit légitimement en retard ; borner serait un garde-fou sans objet.
- ⚠️ **Écart assumé entre spec et code, corrigé dans la spec** : §3.1 annonçait une date modifiable.
  La feuille n'expose **pas** de sélecteur de date — seule la saisie du jour est possible. Le
  repository accepte pourtant toute date passée (testé) : il ne manque que le contrôle d'UI. Ajouter
  un sélecteur mal testé sur une saisie de 6 champs en fin de lot coûterait plus qu'il n'apporte.
  Spec §3.1 et critère de recette 8 mis au réel.
- ⚠️ **Reste à faire avant ✅** : déployer la **sync rule** (bucket `user_data`) et la recette device
  (12 critères, dont la bascule d'unités **sans altérer l'historique**).
- Qualité : `npm run test` **vert** (53 fichiers Vitest + 31 suites Jest / 150 tests, **24 nouveaux**),
  `npm run typecheck` vert, `npm run lint` 0 erreur.

### 29/07/2026 — `feature/uxlot01-finitions-recette` — UX-LOT-01 : les 3 finitions de recette (3.53, 3.54, 7.18 → ✅)

> Un seul lot pour trois correctifs de recette de même nature. Commit précédent : `911922b`.
> **L'inventaire du code, fait avant d'écrire la spec, a évité de développer du déjà-livré** — et a
> montré qu'un des trois diagnostics du backlog était faux.

**Constaté avant de coder**

- **UX-02 (3.53) était DÉJÀ LIVRÉ** par `12bd3a1` (« feat(muscf11): modale bottom-sheet de création
  d'exercice perso »), et même avant que la ligne de roadmap n'existe. `CreateExerciseModal.tsx` est
  un `Modal` bottom-sheet, avec `placeholder` sur le nom et segment `scrollable` : **les 3 points du
  backlog, ligne pour ligne**. → ✅ par réconciliation, **zéro ligne de code**.
- **UX-03 (3.54) était à moitié livré** : l'édition des instructions et muscles secondaires existait
  déjà (`EditExerciseModal` + `updateCustomExercise`). Seuls les états vides restaient.
- **UX-04 (7.18) : diagnostic faux sur 2 des 3 points.** L'appui long existait
  (`activateAfterLongPress(700)`) et le retour visuel aussi (échelle + ombre). Il n'y avait d'ailleurs
  **aucune poignée** : le geste est porté par toute la carte.

**Corrigé**

- `apps/mobile/src/app/exercises/[id].tsx` — les sections **Muscles secondaires**, **Matériel** et
  **Instructions** sont désormais **toujours rendues**, avec « Non renseigné » au lieu de disparaître.
  Un exo perso créé sur mobile n'ayant ni l'un ni l'autre, sa fiche n'avait pas la même structure que
  celle d'un exo de bibliothèque — et l'absence de section se lisait comme un bug.
- `SortableWidgetGrid.tsx` — les deux chips passent de `hitSlop={6}` à `{12}` → **48 dp** de cible
  effective (24 de visuel + 12 de chaque côté), le minimum de CONF-07. Le visuel est inchangé : la
  grille est dense, agrandir les icônes déséquilibrerait les cartes.
- `SortableWidgetGrid.tsx` — **poignée visible** (`reorder-two-outline`) en `pointerEvents="none"` :
  elle **signale** le geste sans le capter, donc la zone de préhension reste **toute la carte**. Une
  poignée réellement interactive aurait au contraire réduit cette zone à 48 dp.
- `(tabs)/index.tsx` — le bandeau du mode édition annonce le geste : « Appui long sur un widget pour
  le déplacer ». Un geste qu'on ne découvre pas n'existe pas.

**Modifié**

- `exercise-detail-smoke.test.tsx` — un test **verrouillait l'ancien comportement** (« n'affiche pas
  la ligne quand la liste est vide »), c'est-à-dire précisément le défaut remonté en recette. Mis au
  nouveau contrat, et enrichi : il vérifie aussi que l'état vide **ne remplace pas** du contenu réel.
- `i18n/locales/{fr,en}.json` — `exercises.detail.notSet`, `home.customize.dragHint`.
- Roadmap 3.53 / 3.54 / 7.18 → ✅, compteurs **168 / 11 / 24**, V0.9 4/2/8.

**Technique / Notes**

- **Le lot était annoncé à ~7 h ; le travail réel a été d'une fraction.** Ce qui a coûté, c'est de
  lire le code avant d'écrire — et c'est ce qui a évité de re-livrer UX-02.
- **Aucune migration, aucune sync rule** : trois changements de présentation.
- Ma première version du test assertait 3 états vides ; le fixture en a **1** (il porte du matériel
  et des instructions). Corrigé : l'assertion vérifie maintenant les deux faces, l'état vide **et**
  les valeurs réelles.
- Qualité : `npm run test` **vert** (52 fichiers Vitest + 30 suites Jest / 142 tests),
  `npm run typecheck` vert, `npm run lint` 0 erreur.

### 29/07/2026 — `feature/admin01-archivage-sur` — ADMIN-01 : archivage sûr du contenu éditorial (8.11 ⬜ → 🟡)

> Validé par Florian le 29/07/2026 avec arbitrage des 7 décisions. **🟡 et non ✅** : la sync rule doit
> être redéployée à la main et la recette navigateur n'a pas eu lieu. Commit précédent : `44e567f`.

**Ajouté**

- `supabase/migrations/20260729080925_admin01_editorial_usage_counts.sql` — fonction
  `editorial_usage_counts(kind, id)`, `security definer`, `search_path` figé, **réservée aux admins**
  (`is_admin()` en première ligne, `grant execute` à `authenticated` seulement — un appel anonyme
  reçoit bien un 401, vérifié). Renvoie un `jsonb` de compteurs de références **vivantes**.
- `packages/shared/src/editorial-usage.ts` + `.test.ts` (7 tests) — `summarizeUsage`, pure.
- `apps/admin/src/data/usage-counts.ts` — appel RPC ; en cas d'échec renvoie `USAGE_UNAVAILABLE`.
- `apps/admin/src/lib/archive-confirm.ts` — message de confirmation, 3 cas distincts.
- `restoreExercise`, `restoreProgram` (cascade **miroir** : entête → enfants), `restoreFood`, chacune
  idempotente (`.not('deleted_at', 'is', null)`) et **sans toucher `status`** (D5).
- Actions d'audit `exercise.restore`, `program.restore`, `food.restore` + libellés FR.
- `EditorialScope` (`active` | `archived` | `all`) sur les 3 listes éditoriales, `active` par défaut.

**Corrigé**

- 🐛 **Import CSV (D7)** : la requête d'existence ne filtrait pas `deleted_at` et l'upsert ne
  réinitialisait pas la colonne → ré-importer un aliment archivé **mettait à jour une ligne que
  personne ne voyait**, en annonçant un succès. Désormais l'import **réactive** (`deleted_at: null`
  dans le payload) et **le compte** (`ImportResult.reactivated`, affiché dans le rapport).
- **Historique muscu et records** : les jointures de traduction ne filtrent plus `deleted_at`, et la
  résolution de nom des records ne filtre plus `e.deleted_at`. C'est **le** correctif de l'US.

**Technique / Notes**

- **La question que le plan demandait de lever en premier avait bien une réponse coûteuse** : la RLS
  ne permet **pas** à un admin de compter les données des autres (`workout_sets_select` vaut
  `user_id = auth.uid()`, aucun bypass). Sans la fonction SQL, l'écran aurait affiché **les séries de
  l'admin lui-même** — un décompte faux est pire que pas de décompte, il donne confiance.
- **Deux corrections au diagnostic de la spec, constatées à l'implémentation** (consignées en §4bis) :
  1. **le journal alimentaire n'était pas affecté** — `food_entries` stocke le nom en **instantané**
     ([journal-repository.ts:49](apps/mobile/src/data/repositories/journal-repository.ts#L49)). La §0
     généralisait à tort « aucun nom dénormalisé » : vrai de `workout_sets`, faux de `food_entries` ;
  2. **le risque redouté n'existait pas et le vrai correctif était ailleurs.** Le plan craignait que
     du contenu archivé apparaisse dans les listes de sélection après le changement de sync rule.
     Audit requête par requête : **toutes** les sélections filtrent **déjà** `deleted_at IS NULL`.
     Ce qui bloquait, c'étaient les **jointures de traduction**, qui filtraient aussi — donc le nom
     restait introuvable *même* en répliquant la ligne archivée.
- **Périmètre de la sync rule volontairement minimal** : seuls `exercises` et `exercise_translations`
  perdent le filtre `deleted_at`. `programs`, `sessions`, `exercise_plans`, `foods`,
  `food_translations` et `exercise_variants` **gardent** le leur — aucune surface d'historique n'en
  dépend pour résoudre un libellé. `status = 'published'` est conservé : un brouillon ne descend jamais.
- **Deux écarts au plan, assumés** : (1) les tests de la logique pure sont dans `packages/shared` et
  non `apps/admin`, qui **n'a ni script de test ni tests** — y installer Vitest était hors périmètre ;
  (2) pas de composant `ArchiveConfirmDialog` : le back-office confirme partout avec `window.confirm`,
  on garde ce patron et on y injecte les décomptes. La valeur de l'US n'est pas la forme du dialogue.
- **Le back-office est francophone uniquement** (un seul `i18n/fr.ts`, aucun sélecteur de langue) : la
  DoD demandait « i18n FR + EN côté admin », ce qui n'a pas de sens ici. Créer un `en.ts` aurait été du
  périmètre en plus, sans consommateur. La règle FR+EN vaut pour l'app utilisateur.
- ⚠️ **Reste à faire avant ✅** : **redéployer la sync rule** (sans quoi les exercices archivés quittent
  toujours les appareils et l'historique reste cassé), puis la **recette navigateur** (6 critères) et
  les 2 critères device (nom conservé dans l'historique, absent de la sélection).
- Qualité : `npm run test` **vert** (52 fichiers Vitest + 30 suites Jest / 142 tests),
  `npm run typecheck` vert, `npm run lint` 0 erreur (6 avertissements préexistants).

### 29/07/2026 — `feature/contenu01-seed-programmes` — CONTENU-01 : bibliothèques de programmes (3.1 et 5.2 🟡 → ✅)

> Contenu **délégué par Florian** (« fais ce qu'il te semble cohérent »). Méthode déjà tranchée le
> 28/07 : migration SQL idempotente. Commit précédent : `085cc71`.
> ⚠️ **Les programmes sont écrits sans la voix de coach de Florian** — séries, fourchettes de reps et
> temps de repos sont des valeurs standard défendables, **à relire avant publication**.

**Corrigé — la spec décrivait un état qui n'existait pas**

- L'inventaire du cloud (fait **avant** d'écrire une ligne de SQL) a démenti deux affirmations de la
  spec du 25/07 :
  - la **bibliothèque course n'était pas vide** : 3 programmes complets et bilingues existaient déjà
    (10 km/8 sem, Prépa semi-marathon, Reprise en douceur), séances typées avec distances cibles ;
  - **4 programmes de test** traînaient dans la bibliothèque, dont **2 publiés** donc **visibles par
    les utilisateurs dans l'app** : « Test admin programme » (muscu) et « Run run » (course). Ce
    problème-là était plus urgent que le manque de contenu, et la spec ne l'avait pas vu.
- `docs/specs/functional/us/contenu-01-seed-bibliotheques-programmes.md` — §0 réécrit avec l'état réel,
  §7 : décisions 2, 3 et 4 tranchées, décision 5 ajoutée (limite i18n des séances).

**Ajouté**

- `supabase/migrations/20260729075443_contenu01_seed_programmes_muscu.sql` — migration de **données**
  (aucun changement de schéma), idempotente (UUID déterministes + `on conflict do nothing`) :
  - **(A)** les 2 programmes de test publiés passent en `draft`. **Dépublier plutôt qu'archiver** :
    les sync rules ne répliquent que `status = 'published'`, donc ça les retire de l'app **sans rien
    perdre** — ils restent utilisables au back-office pour la recette. Archiver (`deleted_at`) serait
    plus destructeur et **irréversible depuis l'admin tant qu'ADMIN-01 n'est pas livrée**. Réversible
    d'une ligne, documentée dans la migration.
  - **(B)** **Push / Pull / Legs — Intermédiaire** (8 sem) : 3 séances, 14 exercices planifiés.
  - **(C)** **Half Body — Haut / Bas** (8 sem, 4 séances/sem) : 2 séances, 12 exercices planifiés.
  - Les deux sont bilingues FR+EN (`program_translations` : nom, résumé, description).

**Modifié**

- `docs/roadmap/roadmap.md` — **3.1 → ✅** (3 programmes muscu publiés) et **5.2 → ✅** (contenu course
  vérifié en base, le 🟡 supposait un catalogue vide). Compteurs **165 / 10 / 28**, V0.3 15/3/3,
  V0.5 26/3/4. Entrée au journal des réconciliations.
- `supabase/MIGRATIONS.md` — migration cochée.

**Technique / Notes**

- **Vérifié avant d'écrire, pas supposé** : les 16 exercices de bibliothèque sont bien en base avec
  **exactement** les UUID déterministes de `seed.sql` (`a1000001` → `a1000016`) — ce qui n'était pas
  acquis, le backlog signalant que ce seed « est arrivé sur le cloud par un chemin non tracé ». Les
  UUID des nouvelles lignes ont aussi été vérifiés **libres** en base avant insertion.
- **Aucune sync rule à redéployer** : `programs`, `sessions` et `exercise_plans` sont déjà dans
  `shared_content`, et le filtre `status = 'published'` fait le reste.
- **Limite assumée : les noms de séance ne sont pas bilingues.** `sessions.name` est une colonne texte
  simple, il n'existe pas de `session_translations`. D'où des noms lisibles dans les deux langues
  (« Push », « Pull », « Legs », « Upper », « Lower ») plutôt que du français seul comme le seed
  initial (« Séance A/B/C »). Une vraie i18n des séances demanderait une table dédiée → hors périmètre.
- **« Force 5×5 » écarté** (il était optionnel en §4.1) : il recouvre largement le PPL, et la
  bibliothèque de 16 exercices ne permet pas de le différencier vraiment.
- **Reste à faire** : recette du parcours « bibliothèque → dupliquer → planifier la copie → activer »,
  et **relecture du contenu par Florian** avant publication.
- Qualité non rejouée : le diff ne contient que du **SQL de données** et de la documentation, aucun
  fichier applicatif touché depuis la passe verte de `45579cb`.

### 28/07/2026 — `feature/admin01-archivage-sur` — ADMIN-01 : livrables d'amont (spec, plan, maquette)

> Entrée dans le pipeline de l'US **ADMIN-01** (roadmap **8.11**, V0.9, P1, ~4 h) via
> [`/us`](.claude/commands/us.md). **Aucune ligne de code applicatif** — `etape: validation`, en
> attente du feu vert de Florian ou Damien. Commit précédent : `45579cb`.
> Enchaînée pendant que BIEN-01 attend sa recette device : ADMIN-01 est du **back-office web**, donc
> sa recette se fait au navigateur et ne réclame pas d'APK.

**Ajouté**

- `docs/specs/functional/us/admin01-archivage-sur.md` — spec : la chaîne de défaillance vérifiée dans
  le code, périmètre, **7 décisions (D1→D7)**, comportement, 8 cas limites, DoD, 8 critères de recette.
- `docs/plans/admin01-archivage-sur.md` — plan en 5 tâches, fichiers touchés, ordre justifié, 7 risques.
- `design/admin01-archivage-sur/admin01-archivage-sur.html` — maquette **format écran large** (c'est du
  web, pas du mobile) : dialogue de confirmation avec décomptes (cas « 128 usages » et cas « zéro »),
  filtre archivés, ligne restaurable, et 4 cartouches d'analyse.

**Technique / Notes**

- **Le diagnostic est plus précis que ce que disait le backlog.** Le backlog annonçait « le nom
  disparaît de l'historique ». La chaîne exacte, vérifiée : `archiveExercise` pose `deleted_at`
  ([exercises.ts:272](apps/admin/src/data/exercises.ts#L272)) → la sync rule filtre
  `deleted_at is null` → la ligne quitte les bases locales → et comme `workout_sets` ne porte **que**
  `exercise_id`, le `LEFT JOIN` de l'historique retombe sur son repli ultime : **la chaîne vide**
  ([workout-repository.ts:225](apps/mobile/src/data/repositories/workout-repository.ts#L225)). Donc
  pas un message d'erreur ni « exercice archivé » — **du vide**, sans rien pour le signaler.
- **D2 est la décision qui décide de la forme du lot** : ne plus retirer le contenu éditorial archivé
  des appareils (retirer `deleted_at is null` de `shared_content`) et déplacer le masquage dans l'app,
  côté listes de **sélection**. C'est le seul choix qui répare la cause. L'alternative
  (dénormaliser le nom dans `workout_sets`) est écartée : migration + remplissage rétroactif, et
  surtout elle **fige** le nom, donc une correction d'orthographe ne remonterait plus jamais.
- 🐛 **Bug silencieux trouvé au cadrage (D7)** : l'import CSV fait
  `upsert(..., { onConflict: 'import_key' })` ([foods.ts:323](apps/admin/src/data/foods.ts#L323)) et
  `import_key` **est unique** (seul index unique concerné du schéma). Ré-importer un CSV contenant un
  aliment archivé **met donc à jour une ligne que personne ne voit**, sans remettre `deleted_at` à
  null, et le rapport annonce un succès. Il faut réactiver **et** le compter dans le rapport.
- **D3 vérifiée, pas supposée** : `grep` sur tous les `create unique index` du schéma → aucun ne porte
  sur un nom (les seuls sont `running_pace_records`, `user_roles`, `foods.import_key`,
  `exercise_notes`, `exercise_variants`, `account_deletion_pending`, `daily_steps`, `daily_wellbeing`).
  Restaurer = remettre `deleted_at` à null, rien de plus ; une gestion de conflit de nom serait du
  code mort.
- **Le risque n'est pas dans l'admin, il est dans l'app** : après le changement de sync rule, toute
  requête de sélection oubliée proposerait un contenu archivé. Le plan impose un **recensement écrit**,
  requête par requête, plutôt qu'une relecture rapide.
- **Question à lever en tâche 1, avant toute UI** : la RLS admin autorise-t-elle le décompte
  inter-utilisateurs (`count(*)` sur les `workout_sets` d'autrui) ? Si non, il faut une fonction
  `security definer` réservée aux admins — donc une **migration**, à découvrir au début et pas à la fin.
- **Précédent réutilisable** : « désarchiver » n'est pas un patron nouveau — `addEditorialVariant`
  remet déjà `deleted_at: null` ([exercise-variants.ts:126](apps/admin/src/data/exercise-variants.ts#L126)).
- Qualité non rejouée : diff **documentation seule**, aucun fichier applicatif touché depuis la passe
  verte de `45579cb`.

### 28/07/2026 — `feature/bien01-checkin-bien-etre` — BIEN-01 : check-in de bien-être (code livré, roadmap 1.24 ⬜ → 🟡)

> Les 3 livrables d'amont ont été **validés par Florian** le 28/07/2026, avec arbitrage des
> **7 décisions D1→D7** conformément aux recommandations de la spec. Code livré derrière.
> **🟡 et non ✅** : la sync rule PowerSync reste à déployer à la main et la recette device n'a pas
> eu lieu. Commit précédent : `5131cd0`.

**Ajouté**

- `supabase/migrations/20260728185757_bien01_daily_wellbeing.sql` — table `daily_wellbeing` :
  `mood` / `energy` / `stress` en 1-5, **nullables et indépendants** (décision D3), index unique
  **partiel** `(user_id, log_date) where deleted_at is null`, index de lecture
  `(user_id, log_date desc)`, RLS `select`/`insert`/`update` sur `auth.uid()` **sans politique
  `delete`** (soft delete), FK `on delete cascade`. **Aucune colonne poids.**
- `supabase/migrations/20260728185759_bien01_daily_wellbeing_publication.sql` —
  `alter publication powersync add table`, gardé par `pg_publication_tables`.
- `packages/shared/src/wellbeing.ts` + `.test.ts` — briques **pures** (21 tests) : bornes d'échelle,
  `isEmptyCheckin`, `canEditDay` (fenêtre J-6 → J), `wellbeingSeries` (**trous conservés**),
  `wellbeingAverages` (**jours renseignés seulement**).
- `apps/mobile/src/data/repositories/daily-wellbeing-repository.ts` + test d'écriture (7 tests) :
  `saveWellbeing` **met à jour** la ligne du jour au lieu de créer un doublon, refuse un check-in
  vide, lève hors fenêtre.
- `apps/mobile/src/components/wellbeing/WellbeingScale.tsx` — l'échelle 1-5 partagée + les
  pictogrammes, `accessibilityRole="radio"`, `hitSlop`, `maxFontSizeMultiplier`.
- `apps/mobile/src/components/wellbeing/WellbeingCheckinSheet.tsx` — la feuille (décision D7).
- `apps/mobile/src/components/dashboard/WellbeingCard.tsx` + smoke test (6 tests) — widget 3 formes.
- `apps/mobile/src/app/wellbeing.tsx` — historique : sélecteur d'indicateur, courbe lissée, journal.

**Modifié**

- `packages/shared/src/widgets.ts` — `wellbeing` **en fin** de `HOME_WIDGET_IDS` et `pillars: 'always'`
  → aucune migration de `dashboard_layout` (précédent PAS-01). Test ajouté : le widget reste visible
  avec `active_pillars = ['nutrition']` seul, alors que `muscle-volume` et `running-week` disparaissent.
- `packages/shared/src/widgets.test.ts` — compteurs de widgets d'accueil 10 → **11**.
- `apps/mobile/src/powersync/schema.ts`, `docs/specs/technical/powersync-sync-rules.yaml`,
  `supabase/MIGRATIONS.md` (2 lignes cochées), `packages/shared/src/database.types.ts` (régénéré),
  `apps/mobile/src/i18n/locales/{fr,en}.json` (namespace `wellbeing`, **15 libellés de niveaux** par
  langue), `apps/mobile/src/lib/data-export.ts` (table ajoutée à l'export RGPD).

**Technique / Notes**

- **D5 — le check-in ne compte PAS dans la série.** Trois taps sur des pictogrammes ne sont pas de
  l'activité ; l'y inclure permettrait de tenir un streak sans rien faire et le dévaloriserait
  (arbitrage C). Conséquence tenue : **`streak.ts` n'est pas touché**.
- **Ce n'est pas un 4ᵉ pilier** : aucune entrée dans `active_pillars`, aucun onglet, widget `'always'`.
- **Le poids n'est jamais dupliqué** : la feuille délègue à `logWeight()`, qui met déjà à jour la
  pesée du jour. Une pesée inchangée n'est même pas réécrite (`weightChanged`).
- **Un jour non renseigné est un trou, jamais un zéro** — règle posée dans la brique pure et testée,
  pas dans le composant. Le widget affiche un tiret par indicateur manquant (testé : 2 tirets quand
  seule l'énergie est saisie), et la courbe omet le jour.
- **Point de conception refait après lint** : la première version pré-remplissait le formulaire dans
  un `useEffect` → **erreur** `react-hooks` (setState synchrone dans un effet, cascades de rendus,
  refusé par le React Compiler). Corrigé en montant le formulaire à l'ouverture avec une `key`
  (l'état initial vient des props) et en dérivant le poids affiché d'un état « non touché » plutôt
  que d'un effet. Aucun effet de réamorçage ne subsiste.
- **Types de routes Expo Router** : `.expo/types/router.d.ts` est **généré et gitignoré**, et
  `expo export` ne le régénère pas — seul le serveur de dev le fait. Il a fallu démarrer
  `npx expo start` pour que `/wellbeing` devienne typé, sinon `router.push('/wellbeing')` échoue au
  typecheck. À savoir pour toute future US qui ajoute un écran.
- **RGPD** : table ajoutée à la liste explicite de `data-export.ts`. La suppression de compte est
  couverte par la **cascade FK** (`purge_expired_accounts()` fait `delete from auth.users`) — vérifié
  dans la migration CONF-02, aucune modification nécessaire. La **politique de confidentialité doit
  mentionner humeur / énergie / stress** avant la relecture juridique (chemin critique LANCE-00). La
  déclaration Health Connect reste **inchangée** : rien n'est lu ni écrit de ce côté.
- ⚠️ **Reste à faire avant ✅** : déployer la **sync rule** `daily_wellbeing` sur l'instance PowerSync
  (sans quoi les données restent locales, sans aucune erreur visible), puis la **recette device**
  (11 critères, dont le chronomètre à 10 s et la vérification que la série ne bouge pas).
- Qualité : `npm run test` **vert** (51 fichiers Vitest + 30 suites Jest / 142 tests, dont 34
  nouveaux), `npm run typecheck` vert, `npm run lint` **0 erreur** (6 avertissements préexistants
  dans `charts-smoke.test.tsx`, non touché).

### 28/07/2026 — `feature/bien01-checkin-bien-etre` — BIEN-01 : livrables d'amont (spec, plan, maquette)

> Entrée dans le pipeline de l'US **BIEN-01** (roadmap **1.24**, V0.9, P1, ~5 h) via
> [`/us`](.claude/commands/us.md). **Aucune ligne de code applicatif** — `etape: validation`, en
> attente du feu vert de Florian ou Damien. Commit précédent : `575599c`.

**Ajouté**

- `docs/specs/functional/us/bien01-checkin-bien-etre.md` — spec fonctionnelle : périmètre, modèle de
  données `daily_wellbeing`, comportement offline, i18n, accessibilité, RGPD, 10 cas limites, DoD et
  11 critères de recette device. **7 décisions de cadrage (D1→D7)** à arbitrer avant code, chacune
  avec sa recommandation.
- `docs/plans/bien01-checkin-bien-etre.md` — plan en 7 tâches TDD, fichiers touchés (8 créés,
  10 modifiés), ordre de build justifié, tests prévus, 8 risques avec parade.
- `design/bien01-checkin-bien-etre/bien01-checkin-bien-etre.html` — maquette : parcours en 4 écrans
  (widget vide → check-in → widget rempli → historique), 3 formes du widget, échelles 1-5 avec les
  15 libellés, et 4 cartouches (décisions, accessibilité, pièges, hors périmètre).

**Technique / Notes**

- **Pourquoi BIEN-01 avant les 5 autres US de rétention de V0.9** : c'est la seule dont la valeur
  **dépend du temps**. La donnée est **historisée** — un jour non collecté est perdu définitivement,
  donc la livrer en dernier, c'est lancer avec une table vide. C'est aussi la **source transverse**
  désignée par le catalogue comme prérequis de TRI-03, TRI-12, TRI-18, MR-23, MUSC-23 (tous post-V1).
- **Décision la plus structurante — D5 : le check-in ne compte PAS dans la série.** Trois taps sur
  des pictogrammes ne sont pas de l'activité ; l'y inclure permettrait de tenir un streak sans rien
  faire et le dévaloriserait (arbitrage C : pas de boucle de jeu). PAS-01 a fait compter les pas
  parce que marcher *est* une activité. Conséquence de plan : `streak.ts` **n'est pas touché**.
- **Ce n'est pas un 4ᵉ pilier** : aucune entrée dans `active_pillars`, aucun onglet, widget en
  `'always'` comme `streak` et `steps`. Ajouté en **fin** de `HOME_WIDGET_IDS` → `resolveScreenLayout`
  complète les layouts stockés, donc **aucune migration de `dashboard_layout`** (précédent PAS-01).
- **Aucune colonne poids** dans la nouvelle table : le poids reste dans `body_weight_entries` et le
  check-in **met à jour** la pesée du jour au lieu d'en créer une seconde.
- ⚠️ **Deux migrations attendues**, comme PAS-01 : la table **puis** `alter publication powersync`.
  Et la **sync rule reste à déployer à la main** sur l'instance — panne silencieuse si oubliée
  (déjà arrivé le 24/07), d'où sa présence en DoD **et** en critère de recette.
- **RGPD** : `daily_wellbeing` devra être ajoutée à la liste **explicite** de tables de
  `data-export.ts` (une table absente = donnée non exportable). La suppression de compte est couverte
  par la cascade FK (`purge_expired_accounts()` fait `delete from auth.users`), à vérifier en recette.
  La politique de confidentialité doit mentionner humeur / énergie / stress **avant** la relecture
  juridique, qui est sur le chemin critique de LANCE-00. La déclaration Health Connect reste
  **inchangée** (aucune lecture/écriture HC ici).
- Relecture de la spec faite **en direct** plutôt que déléguée à un agent (consigne de session : pas
  d'agent non demandé). Deux points resserrés à cette relecture : ajout de **D7** (feuille vs écran)
  et correction d'un cas limite qui parlait de « 7 jours » là où la fenêtre D4 s'arrête à J-6.

### 28/07/2026 — `docs/reconciliation-catalogue-analyses` — CONTENU-01 : méthode de seed tranchée

> Arbitrage Florian du 28/07/2026 sur la **décision structurante** de CONTENU-01, qui bloquait l'US à
> l'étape `validation`. Documentation seule. Commit précédent : `67076ec`.

**Modifié**

- `docs/specs/functional/us/contenu-01-seed-bibliotheques-programmes.md` — §2 « méthode de seed »
  passe de *(à trancher)* à **tranchée : Option A, migration SQL idempotente** (patron du seed CIQUAL),
  le constructeur admin **8.4 restant le pipeline d'entretien/enrichissement**, pas celui du seed
  initial. Contraintes d'implémentation consignées : **UUID déterministes**,
  `on conflict (id) do nothing`, **FR + EN obligatoires** dans `program_translations`, et migration à
  **cocher dans le registre** après `npm run db:push`. Décision ouverte n°1 (§7) rayée ; `maj` → 28/07/2026.
- `BACKLOG.md` — ligne CONTENU-01 : le reste-à-trancher n'est plus la méthode mais le **contenu**
  (nombre de programmes par pilier, qui fournit séances/exos/reps) — **travail de coach, pas de dev**.

**Technique / Notes**

- `etape:` **reste à `validation`** : la méthode est tranchée, mais les décisions de **contenu** (§7.2
  à §7.4) ne le sont pas, et la DoD exige « méthode **+ catalogue** validés » avant code.
- Qualité non rejouée : le diff ne touche que deux fichiers Markdown et **aucun fichier applicatif
  n'a changé** depuis la passe verte du commit `67076ec` (Vitest 50 fichiers, Jest 28 suites /
  129 tests, typecheck, lint 0 erreur).

### 28/07/2026 — `docs/reconciliation-catalogue-analyses` — réconciliation : le catalogue d'analyses avait dérivé, pas la roadmap

> Audit [`/reconcilier`](.claude/commands/reconcilier.md) mené **à charge** (on suppose la doc fausse
> jusqu'à preuve dans le code). Verdict : la **roadmap est juste**, le **catalogue d'analyses** ne
> l'était pas — il annonçait comme restant à faire des analyses livrées depuis plusieurs jours.
> **Documentation seule : aucun fichier applicatif touché.** Commit précédent : `c1bcc49`.

**Corrigé**

- `docs/product/analyses-donnees.md` — **4 lignes fausses** remises au réel du code :
  - **RUN-10** « Tableau des allures par km (splits) » ⏳ → ✅ — **livré depuis le 25/07/2026** :
    `computeKmSplits` ([packages/shared/src/running.ts:179](packages/shared/src/running.ts#L179)),
    tableau sur [apps/mobile/src/app/run/summary.tsx:229](apps/mobile/src/app/run/summary.tsx#L229)
    + reprise dans un widget course. Roadmap 5.26 était, elle, correctement à ✅.
  - **RUN-05** « Courbe & tendance d'allure (30/90 j) » 🟡 → ✅ — `usePaceTrend` + `ProgressLineChart`
    dans [running-history/index.tsx:233](apps/mobile/src/app/running-history/index.tsx#L233).
    Reste noté comme différé : le découpage **par type de séance** (les courses libres n'ont pas de
    `session_type`).
  - **MUSC-06** « Alerte de déséquilibre musculaire » ⏳ → ✅ — livrée **avec MUSC-05**
    (`useMuscleBalance` + alerte groupes délaissés) ; roadmap 3.41 était déjà à ✅.
  - **MN-13** « Ratio g/kg protéines vs cible » 🆕 → ✅ — **absorbée par MN-06** (livrée) : doublon de
    formulation, pas une analyse distincte.
- `docs/product/analyses-donnees.md` — **MUSC-09 pointait une US abandonnée** : le lien « US liée 6.3 »
  était erroné (roadmap 6.3 = « accès démo pendant la séance », ❌ abandonné avec les GIF le
  20/07/2026). MUSC-09 n'a donc **aucune ligne roadmap** — signalé dans la table, à créer en « Hors
  périmètre de cadrage » si l'item entre en pipeline.
- `docs/product/analyses-donnees.md` — **« Pistes de priorisation » assainies** : sur les 3 candidats
  qu'elle donnait encore à démarrer, **2 étaient déjà réglés** (pistes 3 et 10 barrées). **Seule la
  piste 12 (META-19, garde-fou ACWR) reste ouverte.**
- **Front-matter : `roadmap:` vide sur 4 US livrées** alors que leur ligne existe — le lien US↔roadmap
  lu par `scripts/etat.mjs` était cassé : `langue-selecteur-reglages` → **1.23**,
  `muscf10b-records-fiche-exercice` → **3.48**, `detail-programme-seances-repliables` → **3.49**,
  `suppression-programmes-seances` → **3.50**.

**Ajouté**

- `BACKLOG.md` — section **« Après V0.9 — 2ᵉ salve d'enrichissements »** : 5 candidats avec leur point
  dur, **explicitement séquencés après les 13 items restants de V0.9** (arbitrage Florian) — RUN-14
  (prédiction Riegel), NUTR-16 (répartition calorique par repas), MUSC-09 (PR par plage de reps),
  widget écran d'accueil Android, parcours « 7 jours pour démarrer ».
- `IDEAS.md` — les **2 idées promues** de cette salve descendent en Archives avec la décision (widget
  écran d'accueil, parcours « 7 jours ») ; les 3 autres candidats viennent du catalogue.
- `docs/roadmap/roadmap.md` — entrée au « Journal des réconciliations ».

**Technique / Notes**

- ⚠️ **Le catalogue d'analyses n'est pas une source de vérité sur l'état du code.** C'est un backlog
  de 220 lignes tenu à la main, et il dérive : 4 lignes fausses en 10 jours. **Vérifier
  `packages/shared/src` avant de démarrer une ligne** — une note en ce sens est ajoutée dans le
  fichier. Le piège s'est refermé pendant cette session même : « splits par km » a été proposé comme
  candidat n°1 à développer alors qu'il est livré depuis 3 jours.
- **Aucun compteur de roadmap ne change** (163 / 11 / 29 sur 208) : les 4 corrections portent sur le
  catalogue, explicitement **hors décompte** du périmètre de lancement. Vérifié au passage : les 12
  versions somment bien à 208 et chaque colonne s'additionne.
- **Roadmap vérifiée à charge sur ses 40 lignes ⬜/🟡 : zéro faux.** Preuve du contraire cherchée et
  non trouvée pour aucun `expo-speech` (5.18/5.19), altitude (5.32), météo/terrain (5.24), schéma
  corporel (6.2), `maxFontSizeMultiplier` (9.11), glisser-déposer (3.10), notifications autres que
  `scheduleStreakReminder` (1.14/2.4/2.5/2.7/3.42), table mensurations/check-in/joker/objectifs
  (3.51/1.24/7.14/7.15).
- **47 migrations / 47 cases cochées** dans le registre ; `c1bcc49` (PAS-01) bien présent sur
  `origin/dev` ; aucun candidat déjà livré dans le backlog.
- Utile pour PARTAGE-01 (7.17) : `expo-sharing` est **déjà** au projet (data-export, export GPX) —
  seule la **capture d'image** reste à écrire.
- Les **12 specs qui gardent `roadmap: []` sont intentionnelles** : 10 US d'analyse (suivies au
  catalogue, hors décompte) + 2 correctifs. Ne pas les « corriger ».
- Qualité : `npm run test` **vert** (50 fichiers Vitest + 28 suites Jest / 129 tests),
  `npm run typecheck` vert, `npm run lint` 0 erreur (6 avertissements préexistants dans
  `charts-smoke.test.tsx`, non touché). Les 2 échecs par timeout notés au backlog **ne se sont pas
  reproduits** sur cette machine.

### 28/07/2026 — `feature/pas01-pas-quotidiens` — PAS-01 : pas quotidiens lus dans Health Connect, comptés dans la série (recette validée)

> **Recette device validée par Florian le 28/07/2026** sur APK release local (`r4`). L'US PAS-01
> passe en `close`, la roadmap **9.15** en ✅. Livrables d'amont (spec, plan, maquette) et création
> de la version **V0.9** : commit précédent `73f91a8`.
>
> **Ce que ça apporte** : le total de pas du jour est lu dans Health Connect (jamais recalculé),
> stocké **sur le compte** donc synchronisé et présent après réinstallation, affiché en widget et en
> historique 30 jours, avec un objectif quotidien réglable — et **atteindre cet objectif rend la
> journée active dans le streak**, même sans séance ni repas loggé. Cas d'usage d'origine : le
> **tapis de marche**, où le compteur de pas (accéléromètre) compte alors que le GPS ne voit rien.

**Ajouté**
- `packages/shared/src/steps.ts` (+ `steps.test.ts`, **28 tests**) — briques pures : `toDailySteps`,
  `mergeDailySteps` (règle du max), `isGoalReached`, `stepsActiveDays`, `shouldImportSteps`,
  `normalizeStepGoal`, `averageSteps`, `bestSteps`, et les constantes `DEFAULT_STEP_GOAL` (8 000),
  `MIN/MAX_STEP_GOAL`, `MAX_PLAUSIBLE_STEPS` (200 000).
- `apps/mobile/src/data/repositories/daily-steps-repository.ts` — `useDailySteps`, `useStepGoal`,
  `useTodaySteps`, `upsertDailySteps` (+ `__tests__/daily-steps-write.test.ts`, 5 tests).
- `apps/mobile/src/components/dashboard/StepsCard.tsx` — widget 3 formes (small / wide / large)
  (+ `__tests__/StepsCard.test.tsx`, 8 tests couvrant les **5 états** de la spec §2.4).
- `apps/mobile/src/app/steps.tsx` — écran d'historique : histogramme 30 j, moyenne / objectifs
  atteints / meilleur jour, réglage de l'objectif (1 000 → 50 000 par pas de 500).
- `apps/mobile/src/hooks/useHealthConnectState.ts` — état Health Connect partagé par le widget, l'écran
  et les Réglages (évite un widget « prêt » face à des Réglages « autorisation manquante »).
- `apps/mobile/src/hooks/useHealthConnectImports.ts` — remplace `useHealthConnectWeightImport`
  (**supprimé**) : deux imports indépendants, poids (6 h) et pas (1 h).
- **2 migrations** : `20260728132424_pas01_daily_steps` (table `daily_steps` + index unique partiel
  `(user_id, log_date)` + RLS own + `profiles.daily_step_goal`) et
  `20260728132601_pas01_daily_steps_publication` (`alter publication powersync add table`).
- `android.permission.health.READ_STEPS` dans `app.json` — **4ᵉ** permission santé.

**Modifié**
- `health-connect.ts` : `importSteps()` / `importStepsIfDue()`, `PERMISSIONS` (3 → 4),
  `SyncReport.kind` (+ `'steps'`), `STEPS_IMPORT_THROTTLE_HOURS = 1`, `SERVICE_REV` `r3` → `r4`.
- `streak.ts` : `DayActivity` gagne `steps?: boolean` ; `activeDayKeys()` intègre la 4ᵉ dimension.
  `dashboard-repository.useStreakData` l'alimente via `stepsActiveDays(rows, goal)`.
- `widgets.ts` : `'steps'` au registre accueil (`pillars: 'always'`, `defaultSize: 'wide'`).
- `profile.ts` / `profile-repository.ts` : `dailyStepGoal` (NULL → 8 000 à la lecture).
- `HealthConnectSection.tsx` : bouton « Importer les pas maintenant », date du dernier import des pas.
- `Button.tsx` : prop `accessibilityLabel` — les boutons « − » / « + » de l'objectif n'annonçaient
  rien au lecteur d'écran.
- `data-export.ts` : `daily_steps` ajoutée à l'export RGPD (CONF-01).
- **i18n FR + EN** : section `steps.*` + `settings.healthConnect.importSteps` / `stepsImported` /
  `lastStepsImport`.

**Technique / Notes**
- ⚠️ **Deux pièges évités, tous deux déjà tombés sur ce projet.** (1) La lecture passe par
  `aggregateGroupByPeriod` (bucket `DAYS`) et **jamais** par `readRecords('Steps')` : Health Connect
  reçoit des pas de plusieurs sources (téléphone, montre, Google Fit) sur des plages qui **se
  chevauchent**, les sommer gonflerait le total. (2) La 2ᵉ migration (`alter publication`) reproduit
  la correction du 24/07 sur `analytics_events` : sans elle, le déploiement des sync rules échoue
  « table not part of publication ».
- **Date d'un bucket lue littéralement.** Côté natif, `startTime` vient de
  `LocalDateTime.toString()` → `"2026-07-27T00:00"`, **sans fuseau et sans les secondes**. Toute
  conversion via `new Date()` l'interpréterait comme un instant UTC et daterait les pas **de la
  veille** à l'est de Greenwich. `dayKeyOfBucket` lit donc les 10 premiers caractères, avec repli sur
  `localDateOfInstant` si l'API renvoyait un jour un instant. 2 tests verrouillent le comportement.
- **Jour actif = objectif atteint**, jamais « au moins un pas » : sinon le téléphone dans la poche
  rendrait la série inbrisable et vide de sens (décision produit, spec §2.5).
- **Confidentialité : le périmètre change.** CONF-06 pouvait affirmer que rien ne quittait
  l'appareil ; les pas, eux, **partent sur nos serveurs**. La phrase `settings.healthConnect.subtitle`
  (« Tout reste sur ton téléphone. ») était devenue **fausse** → réécrite, et `legal.privacy.body`
  nomme désormais les pas comme donnée de santé conservée, exportable et supprimée avec le compte.
  Conséquence Play : la section « Sécurité des données » doit déclarer une donnée de santé
  **transmise** (doc mise à jour).
- **Utilisateurs CONF-06 : effet attendu.** `hasPermissions()` étant un ET logique sur les 4
  permissions, tout compte déjà autorisé repasse en `permissions_missing` jusqu'à ce qu'il accorde
  la lecture des pas. L'écriture des séances continue de fonctionner (permissions indépendantes).
- **Limite assumée** : aucune lecture en arrière-plan. Un objectif atteint sans ouvrir l'app
  n'apparaît qu'au prochain import — la série se **répare rétroactivement**, mais le rappel de 20 h
  peut partir pour rien. Le temps réel exigerait `READ_HEALTH_DATA_IN_BACKGROUND` + WorkManager → US
  séparée. L'horodatage de fraîcheur **sur le widget**, prévu au cadrage, a été écarté (curseur en
  `expo-secure-store`, donc lecture asynchrone) : il reste dans les Réglages ; spec §2.6 réalignée.
- **Points relevés en revue et corrigés avant commit** : formatage des milliers forcé en `fr-FR`
  quelle que soit la langue (→ suit `i18n.language`) ; export `getStepGoal()` mort-né (retiré) ;
  3 clés i18n sans usage (retirées) ; commentaire de `_layout.tsx` devenu faux (ne mentionnait que
  les pesées) ; test du widget rendu déterministe (`mockReturnValue` au lieu de `…Once`, qui
  dépendait du nombre de rendus).
- **Reste hors code** : ⚠️ **sync rule `daily_steps` à déployer dans le dashboard PowerSync**
  (sinon la table ne descend jamais, sans erreur), et déclaration Play à étendre avant LANCE-00.
- Qualité : `npm run lint`, `npm run typecheck`, `npm run test` verts — **940 tests Vitest + 129 Jest**,
  codes de sortie lus sans pipe.

### 28/07/2026 — `feature/conf06-health-connect` — CONF-06 : correctif de format d'horodatage + retour visible d'erreur (recette validée)

> **Recette device validée par Florian le 28/07/2026.** L'US CONF-06 passe en `close`, la roadmap
> **9.9** en ✅. Précédent commit : `c682993`.
>
> **Le bug qui bloquait tout.** Aucune séance n'arrivait dans Health Connect, sans le moindre
> message. Cause : nos horodatages en base locale valent `2026-07-24 12:39:10.931Z` — un **espace**
> là où l'ISO-8601 met un `T` (format Postgres propagé tel quel par PowerSync dans SQLite).
> JavaScript tolère cette forme, d'où tout le reste de l'app qui fonctionne depuis des mois avec
> `new Date(row.finished_at)` ; le `Instant.parse()` de **Java la refuse** :
> `Text '…' could not be parsed at index 10` (index 10 = l'espace). Passée brute dans un record, la
> valeur faisait rejeter **chaque** écriture.

**Corrigé**

- **`toIsoInstant()`** (`packages/shared/src/health-connect.ts`) : normalise tout horodatage en ISO
  strict UTC avant écriture. Applique aussi le `Z` quand le fuseau manque — sans quoi JS
  interpréterait la valeur en heure **locale** et décalerait l'activité selon l'appareil.
  Utilisée pour les bornes de séance, de course, de distance, et pour `clientRecordVersion`.
- `normalizedInterval()` remplace `validInterval()` : valide **et** normalise en un seul endroit,
  pour qu'aucun chemin ne puisse produire un record aux bornes brutes.
- **7 tests de régression** sur le format réel de la base (48 tests au total sur les briques pures).

**Ajouté**

- **Compte rendu de synchronisation visible** (`SyncReport`, `getLastSyncReport()`) : le service
  mémorise le résultat de sa dernière tentative — succès, échec **ou raison de l'abandon** — et la
  section Réglages l'affiche en rouge si elle a échoué. `ready()` ne renvoie plus un `null` muet mais
  la cause exacte (`opt-in OFF`, `permissions non accordées`, `getSdkStatus = N`…).
- **Bouton « Renvoyer mes activités récentes »** : relance le rattrapage 30 jours à la demande. Sert
  au diagnostic **et** à l'utilisateur (rattraper une séance non partie sans basculer le réglage).
- **`SERVICE_REV`** (`r3`), préfixée aux messages d'erreur : permet de savoir quelle version du code
  a produit une erreur. Deux APK indiscernables (même UI, `version: 0.0.0`) avaient coûté trois
  allers-retours de recette à confondre « le correctif ne marche pas » et « le correctif n'est pas là ».
- i18n FR/EN : `settings.healthConnect.{syncNow, lastAttemptFailed}`.

**Technique-Notes**

- ⚠️ **Piège monorepo documenté** dans
  [dev-build-android-local.md](docs/specs/technical/dev-build-android-local.md) : une modification
  dans `packages/shared` **ne réinvalide pas** le bundle Gradle. La tâche de bundling ne déclare comme
  entrées que les sources d'`apps/mobile` ; Metro résout `@wellness/shared`, Gradle l'ignore. Résultat :
  `BUILD SUCCESSFUL`, APK inchangé, correctif absent. Contrôle (`grep` d'une clé **sans accent** dans
  le bundle — Metro échappe les non-ASCII) et correctif ciblé (supprimer l'output du bundle plutôt
  qu'un `clean`) consignés. **Deux itérations de recette perdues dessus.**
- **Leçon de test, deux fois de suite sur cette US** : les cas couverts décrivaient le format de la
  **documentation**, pas celui que le **système produit** — `zoneOffset` (objet, pas chaîne) puis les
  horodatages (espace, pas `T`). Une couverture verte qui ne protégeait rien. Les tests de régression
  sont désormais écrits à partir des valeurs réellement observées sur device.
- Le silence sur erreur était un **défaut de conception**, pas seulement une gêne de débogage : un
  `console.warn` est illisible sur un APK de production, et un lot vide ne produit aucune erreur du
  tout. C'est ce qui a rendu la première recette impossible à diagnostiquer.
- Contrôles : `lint` 0 erreur, `typecheck` 0 erreur, **1025 tests verts** (909 shared + 116 mobile),
  codes de sortie lus **sans pipe**.

**Reste hors de cette US** : la **déclaration Google Play « Health apps »** et le **compte
développeur** (LANCE-00) — ils conditionnent la publication, pas le fonctionnement. Health Connect
marche en dev build sans eux.

### 27/07/2026 — `feature/conf06-health-connect` — US CONF-06 : Health Connect (écriture des séances, lecture du poids)

> **Quoi.** L'app cesse d'être un silo : les séances de musculation et les courses terminées sont
> **écrites** dans Health Connect (le hub santé d'Android), et le poids mesuré par une balance
> connectée est **relu** pour alimenter le suivi de poids. Roadmap **9.9**, dernier P0 fonctionnel
> avant lancement. Consentement **opt-in** (donnée de santé). L'échange est **local à l'appareil** :
> aucune donnée de santé ne transite par nos serveurs du fait de cette US — seul un booléen de
> réglage part vers Supabase.
>
> **Étape atteinte : `recette`.** Le code est livré et les contrôles sont verts, mais **rien n'a
> encore tourné sur un device** : nouveau module natif → dev build obligatoire. Statut roadmap
> **🟡 Partiel** jusqu'à la recette (14 critères, spec §11).

**Ajouté**

- **`packages/shared/src/health-connect.ts`** — briques **pures**, sans dépendance native (donc
  testables sous Vitest, sans device) : `buildWorkoutSessionRecord`, `buildRunRecords`,
  `localDateOfInstant`, `selectWeightEntriesToImport`, `shouldImportWeight`. **41 tests**
  (`health-connect.test.ts`) couvrant les cas limites : durée ≤ 0, horodatage illisible, course sans
  distance, plusieurs pesées le même jour, poids aberrants, fuseau du record (les 3 formes), record
  sans poids, `updated_at` illisible.
- **`apps/mobile/src/lib/health-connect.ts`** — adaptateur d'I/O, seule frontière avec le natif.
  `getAvailability`, `getState`, `hasPermissions`, `requestPermissions`, `pushWorkout`, `pushRun`,
  `pushRecent`, `importWeight`, `importWeightIfDue`, `openSettings`, `openProviderInstall`.
- **`apps/mobile/src/components/HealthConnectSection.tsx`** — section Réglages, 6 états
  (`unsupported` / `provider_missing` / `provider_update_required` / `off` / `permissions_missing` /
  `ready`), retour d'action **inline** (pas d'`Alert` modale).
- **`apps/mobile/src/hooks/useHealthConnectWeightImport.ts`** — import de poids au premier plan,
  throttlé 6 h, gardé sur `session && hasSynced`.
- **`apps/mobile/plugins/withHealthConnect.js`** — config plugin **maison** (voir Technique-Notes).
- **Migration** `20260726202133_health_connect_enabled` — `user_settings.health_connect_enabled`
  (`boolean not null default false`). Poussée sur le cloud le 27/07/2026, types régénérés, registre coché.
- **`docs/specs/technical/health-connect-play-declaration.md`** — procédure de déclaration Google
  Play avec les justifications des 3 permissions, prêtes à coller.
- Spec, plan et maquette de l'US (`docs/specs/functional/us/`, `docs/plans/`, `design/`).

**Modifié**

- **`finishWorkout`** / **`finishRun`** — un `void pushWorkout(...)` / `void pushRun(...)` en
  fire-and-forget, à côté du `void track(...)` existant. **Aucun `await`** dans le chemin de clôture.
- **`user_settings`** — colonne dans le schéma PowerSync (`integer` 0/1), `healthConnectEnabled` dans
  `userSettingsRowSchema` (défaut `false`), mapping + `getHealthConnectEnabled()` dans le repository.
- **i18n FR/EN** — `settings.healthConnect.*` (22 clés, pluriels `_one`/`_other`), paragraphe Health
  Connect dans `legal.privacy.body`, `account.delete.healthConnectHint`.
- **`app.json`** — 3 permissions santé dans `android.permissions`, plugin maison,
  `expo-build-properties` (`minSdkVersion: 26`).
- **`BACKLOG.md`** — **LANCE-00** créé (compte développeur Play, non démarré) + chaîne des prérequis
  hors-code remise dans l'ordre des dépendances (~3 semaines de délais externes **en série**).

**Supprimé**

- Dépendance **`expo-health-connect`** (voir Technique-Notes).

**Technique-Notes** (points d'attention pour le débogage)

- **`insertRecords` refuse les lots hétérogènes et jette sur une liste vide** (v3.5.3 : « All records
  must have the same type »). D'où : **un appel par `recordType`**, chacun gardé par `length > 0`, et
  `buildRunRecords` qui renvoie `{ sessions, distances }` séparés plutôt qu'un tableau mélangé. Une
  course sans distance produit un lot `Distance` vide → aucun appel.
- **Idempotence par `clientRecordId`** (`workout-<uuid>` / `run-<uuid>` / `run-dist-<uuid>`) +
  `clientRecordVersion` dérivée d'`updated_at`. C'est le mécanisme natif de Health Connect :
  réinsérer un id connu **met à jour** au lieu de dupliquer. Conséquence : **aucune table de suivi
  des exports** côté app, et le rattrapage 30 jours est rejouable sans risque.
- **Plugin maison plutôt que `expo-health-connect`.** Cette dépendance n'apportait que 20 lignes de
  Kotlin (l'appel `setPermissionDelegate`) et 2 entrées de manifest, sans publication depuis le
  **31/07/2024**, avec un `build.gradle` figeant `compileSdkVersion` 34 et
  `com.facebook.react:react-native:+`. Reproduite dans `plugins/withHealthConnect.js` :
  `withAndroidManifest` (intent-filter + `activity-alias`) et `withMainActivity` (import + appel après
  `super.onCreate`). **Idempotent** (vérifié : prebuild rejoué sans `--clean` → 1 seule occurrence de
  chaque) et **échoue bruyamment** si `super.onCreate(...)` devient introuvable — un prebuild rouge
  vaut mieux qu'une build où la demande de permissions plante en recette.
- ⚠️ **Ne jamais ajouter `react-native-health-connect` aux `plugins` d'`app.json`** : son
  `app.plugin.js` pousse le même intent-filter **sans garde d'idempotence** → doublon dans le manifest.
- **Les 3 permissions santé ne sont posées par aucun plugin** (ni celui de la lib, ni
  `expo-health-connect`) : elles vivent dans `android.permissions` d'`app.json`. Piège vérifié.
- **`MainActivity` doit enregistrer le délégué** avant que l'activité passe à `RESUMED`
  (`registerForActivityResult`), d'où l'insertion juste après `super.onCreate`.
- **Titre de séance** : `workouts` n'a **pas** de colonne `name` — il vient de `sessions.name` par
  `LEFT JOIN` sur `session_id`, absent pour une séance libre ou issue d'un template → repli sur le
  libellé i18n. Les **notes de séance ne sont jamais exportées** (minimisation, vérifié par un test).
- **Conflit de poids : l'app gagne toujours.** L'import ne comble que les jours **absents**
  localement, jamais d'écrasement. La requête des jours connus ignore volontairement `deleted_at`,
  sinon une pesée supprimée serait ressuscitée à chaque import.
- **Aucun curseur de lecture** : fenêtre glissante de 30 jours relue intégralement (Health Connect
  est local à l'appareil ; un curseur synchronisé entre appareils serait faux). Seul l'horodatage du
  dernier import est persisté (`expo-secure-store`), pour le throttle **et** l'affichage.
- **Filtrage de nos propres records côté client** (`metadata.dataOrigin`) : l'API ne propose qu'un
  filtre d'origine *inclusif*, pas d'exclusion.
- **Pas de suppression de record** : l'app ne permet pas de supprimer une séance *terminée*
  (`cancelWorkout`/`cancelRun` ne portent que sur une activité active, jamais écrite). Point ouvert
  assumé, documenté dans la spec §2.6.
- **Sync rules PowerSync : aucun redéploiement attendu** — `user_settings` est en `select *`. À
  confirmer en recette (critère 8) ; si la colonne ne remonte pas, redéployer pour forcer la re-sync.
- **`expo export --platform web` échoue toujours** sur `better-sqlite3` — **pré-existant**
  (limitation PowerSync-sur-web), sans rapport avec cette US.
- Contrôles : `lint` 0 erreur, `typecheck` 0 erreur, **1018 tests verts** (902 shared + 116 mobile),
  codes de sortie lus **sans pipe**.

**Corrigé avant commit — issu de la revue de diff**

- 🐛 **`zoneOffset` mal typé → toutes les pesées auraient été datées en UTC.** La brique n'acceptait
  que `string | number`, alors que la bibliothèque renvoie **un objet** `{ id, totalSeconds }`
  (vérifié : `ZoneOffset` dans `base.types.d.ts`, `zoneOffsetToJsMap` côté Kotlin). Aucune branche ne
  matchait, l'offset retombait à 0 : à UTC+2, une pesée entre 00 h et 02 h locales était datée de la
  **veille** — et, décalée d'un jour, elle échappait à la garde « l'app gagne toujours », créant un
  doublon avec la saisie manuelle. La forme objet est désormais traitée en premier, et le **repli**
  (quand `zoneOffset` est `null`, cas courant) est le **fuseau de l'appareil**, pas UTC — cohérent
  avec le reste de l'app. Injecté en paramètre pour rester pur et testable. Les tests d'origine
  ne couvraient que les formes que la bibliothèque **n'émet jamais**, d'où la fausse confiance.
- **Le rattrapage n'est plus tout-ou-rien** : si `insertRecords` refuse un lot (un seul record
  aberrant suffit), `insertBatch` **retente record par record** au lieu de tout perdre.
- **« N activités synchronisées » comptait des records, pas des activités** : une course avec
  distance en produit 2, donc 3 courses annonçaient « 6 activités ». `pushRecent` renvoie désormais
  le nombre de **sessions** écrites.
- Ligne vide qui cassait le tableau de `supabase/MIGRATIONS.md` ; en-tête de la spec resté sur
  « à valider » ; commentaire inexact sur Metro (il *résout* le module, l'import paresseux évite son
  *évaluation*).

### 26/07/2026 — `docs/refonte-suivi-avancement` — Refonte du suivi d'avancement (ETAT généré, backlog, front-matter, réconciliation roadmap)

> **Pourquoi.** Audit demandé par Florian : les fichiers de suivi avaient dérivé du code. Trois
> constats. (1) `CLAUDE.md` et `README.md` décrivaient encore le projet du **05/07** — « scaffolding
> posé », « admin stub », « PowerSync reste à poser » — alors que `CLAUDE.md` est chargé à **chaque
> session**. (2) `TODO.md` (1592 lignes) était devenu un journal append-only : reste-à-faire à partir
> de la ligne 728, section « En cours » ne contenant **que des `[x]`**, et un unique paragraphe
> ligne 424 chaîné par « Précédemment : … » à l'infini. (3) La roadmap ignorait **15 fonctionnalités
> livrées** (refonte muscu, widgets multi-formes, micronutriments…), donc son « 143/179 »
> **sous-estimait** le travail réel.
>
> **Le principe retenu** : chaque information a un seul endroit, et cet endroit **se remplace au lieu
> de grossir**. Un fichier de suivi qui ne fait que croître a cessé d'être un tableau de bord.
> Aucune ligne de code applicatif touchée.

**Ajouté**

- **`ETAT.md`** — tableau de bord « où on en est », **généré** : cap (% MVP1 + jauge), US en cours
  avec leur étape, P0/P1/P2 restants, santé du dépôt, alertes, derniers commits.
  **Ne se modifie jamais à la main.**
- **`scripts/etat.mjs`** — le générateur. Lit le front-matter des specs, `BACKLOG.md`, les compteurs
  de la roadmap, le registre des migrations et git. Option `--check` (sort en 1 si périmé) qui ne
  compare que la **partie stable** du document — comparer la section git produirait un échec
  permanent. Embarque un **contrôle arithmétique** : recompte les statuts de la roadmap et alerte si
  le récapitulatif diverge.
- **`BACKLOG.md`** — reste-à-faire priorisé P0 (3, bloquant lancement) / P1 (8) / P2 (2), une ligne
  par candidat **sans spec encore**, avec son **point dur**. Plus une section dette technique et une
  section reporté/abandonné pour la trace.
- **Front-matter YAML sur les 74 specs d'US** — `id`, `titre`, `roadmap`, `catalogue`, `etape`
  (`spec`→`plan`→`design`→`validation`→`code`→`recette`→`relecture`→`close`), `branche`, `maj`.
  L'avancement d'une US vit désormais **dans sa spec**, ce qui rend `ETAT.md` générable.
- **3 skills** : `/etat` (début de session), `/us` (démarrer une US jusqu'à la validation, sans code),
  `/reconcilier` (audit à charge code ↔ documentation).
- **`docs/journal/`** + son README — dossier des archives gelées.
- **Roadmap § « Hors périmètre de cadrage — livré en cours de route »** : 15 fonctionnalités
  numérotées (1.23 langue · 3.43→3.50 refonte muscu, records fiche, séances repliables, suppression ·
  4.33→4.36 micros et saisie langage naturel · 6.4 infobulle · 7.13 widgets multi-formes).
- **Roadmap § « Journal des réconciliations »** — entrées courtes (3 lignes max) en remplacement du
  paragraphe monolithique.

**Corrigé**

- **6 lignes de roadmap périmées**, toutes dans le sens « livré mais affiché à faire », héritées de
  la refonte muscu jamais réconciliée : **3.13** (fiche exercice `/exercises/[id]`), **3.27**
  (sélecteur de type de série `TYPE_CHIPS`), **3.28** (repos configurable par exercice via
  `restOverride`/`sessionRest`), **3.32** (`replaceExercise`) 🟡⬜ → ✅ ; **3.7** (suggestion de
  progression câblée) et **3.8** (brique deload livrée non déclenchée) ⬜ → 🟡.
- **Erreur de comptage préexistante** débusquée par le nouveau contrôle arithmétique : l'item **5.2**
  (bibliothèque de programmes de course, catalogue **vide**) était compté **livré** depuis la
  réconciliation du 18/07 alors qu'il est 🟡. V0.5 passe de 26/3/4 à **25/4/4**.
- **Collision de numérotation `4.5`** : l'US « saisie de repas par liste (langage naturel) » portait
  le même numéro que « Modification manuelle des macros ». Le numéro qui fait foi devient **4.36**
  (le nom de fichier reste `4.5-saisie-langage-naturel.md` pour ne pas casser une cinquantaine de liens).
- **`CLAUDE.md`** — section « État du projet » réécrite (renvoi vers `/etat`), tableau « où se trouve
  quoi », modèle de suivi en 4 niveaux, arborescence à jour, table des skills, note sur les **sync
  rules PowerSync non versionnées** (étape manuelle déjà oubliée une fois).
- **`README.md`** — supprimé « le code applicatif n'est pas encore initialisé » (930 commits plus tôt).
- **`apps/mobile/README.md`** — « la mise en place EAS reste à faire » remplacé par le renvoi au
  build local Android.
- **Liens morts vers `TODO.md`** dans les documents vivants (`IDEAS.md`, `docs/refonte-muscu/*`).
  Ceux des plans et specs clôturés sont **laissés tels quels** : ce sont des archives d'un moment.
- **`/commit`** — étapes 7-8 réorientées (front-matter + roadmap + régénération d'`ETAT.md`),
  obligation de **créer la ligne de roadmap si elle manque**, avertissement sur la lecture du code de
  sortie sans pipe, `Co-Authored-By` corrigé en Opus 5.
- **`widgets-multiformes.md`** — l'en-tête annonçait encore « à valider (pas de code avant
  validation) » alors que les 16 widgets sont livrés.
- **Bug du générateur** trouvé en testant son propre garde-fou : la jauge plantait
  (`RangeError: Invalid count value`) dès que le pourcentage dépassait 100 à cause d'un compteur
  incohérent. Bornée — une roadmap fausse produit une **alerte**, pas une exception.

**Supprimé**

- **`TODO.md`** de la racine → archivé en `docs/journal/todo-archive-2026-07.md` avec une bannière
  « archive gelée » et une table de renvoi. Contenu **intégralement conservé** (l'historique détaillé
  vit de toute façon dans ce CHANGELOG).

**Technique / Notes**

- Périmètre roadmap : **179 → 194** fonctionnalités ; avancement **79 % → 83 %** (161 livré /
  11 partiel / 17 à faire / 1 reporté / 4 abandonné). Récapitulatif, détail par version et comptage
  réel **vérifiés cohérents par script**.
- Les **US d'analyse** (META/MN/MR/NUTR/RN) restent suivies dans
  `docs/product/analyses-donnees.md` — délibérément **non dupliquées** dans la roadmap.
- Statuts des front-matter reconstruits depuis l'archive TODO : **73 `close`**, 1 `validation`
  (CONTENU-01, en attente d'arbitrage sur la méthode de seed).
- Qualité : `typecheck` 0 · `lint` 0 erreur · **860 tests shared + 116 mobile verts** (exit 0 lu
  **sans pipe**). Les 2 échecs mobile constatés en cours d'audit étaient des **timeouts de 15 s**
  liés à la charge machine, non reproduits — consignés au backlog.
- Dette relevée au passage (dans `BACKLOG.md`) : `supabase/seed.sql` **inatteignable** sans Docker
  (les 16 exercices de bibliothèque sont arrivés sur le cloud par un chemin non tracé) ; `main`
  **937 commits** derrière `dev`, sans tag ni release.
- À faire hors dev : **prévenir Damien**, dont le workflow change (front-matter au lieu du TODO,
  `/us` pour démarrer une US).

### 26/07/2026 — `feature/ux01-infobulle-graphiques` — clés de build : Client ID Google versionné, clé MapTiler écartée du dépôt

> Commit précédent : `d8cd84c`, qui laissait `eas.json` en attente d'arbitrage. **Le dépôt GitHub est
> public** (`github.com/Florian935/wellnass-app`) : tout ce qui entre dans `eas.json` est publié.
> Vérifié avant décision : la clé MapTiler **n'était présente dans aucun commit de l'historique**
> (`git log -S`) — elle n'a donc jamais été exposée et **aucune révocation n'est nécessaire**.

**Modifié**
- `apps/mobile/eas.json` (profil `preview`) — ajout de `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` seul.
  Un client ID OAuth est un **identifiant public** (documenté comme non secret par Google) et il est
  nécessaire au build. `EXPO_PUBLIC_MAPTILER_KEY` **volontairement non versionnée** : clé à quota
  facturable, sans équivalent de la RLS pour la protéger → passe par une variable d'environnement EAS.
- `docs/specs/technical/environnement-dev-local.md` — nouvelle section « Le dépôt GitHub est public » :
  tableau de ce qui peut/ne peut pas figurer dans `eas.json` (avec la justification par valeur),
  commandes `eas env:create` pour la clé MapTiler (`preview` + `production`), et rappel qu'un secret
  réellement committé doit être **révoqué**, le retirer du dépôt ne suffisant pas.

**Technique / Notes**
- **Action requise côté Florian** : `eas env:create` pour `EXPO_PUBLIC_MAPTILER_KEY` sur `preview` et
  `production`, sinon la carte running sera muette dans les builds EAS. En local, `.env` (gitignoré)
  contient déjà la valeur, le dev n'est pas impacté.
- **Visibilité du dépôt non modifiée** — décision de présence publique laissée à Florian. À noter que
  l'anon key Supabase déjà versionnée est acceptable **par conception** (protection par RLS).
- Nuance assumée : `EXPO_PUBLIC_*` est inlinée dans le bundle, donc extractible de l'APK. Sortir la
  clé du dépôt évite le moissonnage automatique de GitHub, pas l'extraction ciblée ; le complément
  est de restreindre la clé côté compte MapTiler.
- Aucun code applicatif touché. `eas.json` revalidé comme JSON strict.

### 26/07/2026 — `feature/ux01-infobulle-graphiques` — US UX-01 clôturée · workflow allégé · environnement de dev local

> Commit précédent : `77088f9`. **Aucun code applicatif touché** — clôture d'US, règle de workflow
> et documentation. Recette UX-01 **validée par Florian** (8 critères, spec §9) → US close sans
> relecture croisée, conformément à la nouvelle règle ci-dessous.

**Ajouté**
- `docs/specs/technical/environnement-dev-local.md` — mise en place d'un poste Windows de zéro :
  versions de référence (JDK **Temurin 17** obligatoire, Android SDK Platform **36**, Build-Tools
  **36.0.0**, NDK **27.1.12297006** — épinglé par RN dans `react-native/gradle/libs.versions.toml`,
  CMake 3.22.1), installation **sans droits admin** (archives ZIP dans le profil utilisateur),
  variables d'environnement, démarrage du dépôt, **build APK local**, dépannage, émulateur optionnel.

**Modifié**
- `CLAUDE.md` — **la relecture croisée par l'autre dev n'est plus requise pour clôturer une US.**
  Une seule validation (Florian **ou** Damien) suffit. Étape 6 « Clôture » ajoutée au workflow
  obligatoire ; puce « relecture des PR par les deux devs » de la méthode de travail réécrite.
  La relecture reste possible à la demande, jamais bloquante.
- `TODO.md` — US **UX-01** : bloc passé de « 🧪 RECETTE À FAIRE » à « ✅ CLÔTURÉE », recette device
  cochée (Florian, 26/07/2026), ligne « Relecture Damien » cochée comme non requise ; ligne
  « Dernière mise à jour » actualisée.

**Technique / Notes**
- **Roadmap non modifiée** : UX-01 est une idée promue depuis `IDEAS.md`, sans ligne dans
  `docs/roadmap/roadmap.md` (aucun numéro thématique) → étape roadmap sans objet.
- ⚠️ **`apps/mobile/eas.json` volontairement NON committé.** La modification présente dans l'arbre
  de travail ajoute `EXPO_PUBLIC_MAPTILER_KEY` et `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` au profil
  `preview`. **Le dépôt GitHub est public** : une clé MapTiler en clair y serait moissonnée par des
  robots (quota/facturation). Décision laissée à Florian — voir les options dans le rapport de
  commit. Le Client ID Google est public par nature, il ne pose pas de problème.
- **`package-lock.json` restauré** (`git restore`) : le `npm install` du nouveau poste Windows
  **retirait** `@emnapi/core` et `@emnapi/runtime` (dépendances optionnelles dépendantes de la
  plateforme). Committer cette dérive risquait de casser l'installation sur le poste de Damien.
- **Rappel** : `apps/mobile/android/` (généré par `expo prebuild`), `.env` et `local.properties`
  sont gitignorés — aucun artefact natif ni secret dans ce commit.
- Qualité : **typecheck 0** · **lint 0 erreur** (6 avertissements préexistants sur des fichiers de
  test : imports `require()`, `View` non utilisé) · **860 tests verts**.

### 25/07/2026 — `feature/ux01-infobulle-graphiques` — US UX-01 : infobulle de valeur au tap (code livré)

> **Première idée promue depuis [IDEAS.md](IDEAS.md)** (16/07, remontée par Florian en recette MUSC-04).
> On lisait les courbes « à la louche » sur l'axe — impossible dès que les gridlines sont espacées ou que
> l'axe est formaté. Un tap donne désormais **date complète + valeur exacte**. Spec + plan + maquette
> validés Florian. 6 tasks TDD. **Aucune migration, aucun module natif, aucune dépendance** → reload Metro.
> **Levier** : les 6 surfaces graphiques passent par 2 composants mutualisés → un seul chantier les couvre.

**Ajouté**
- `packages/shared/src/chart-tooltip.ts` (+ 12 tests) : `formatTooltipValue` (**pur**) — formateur de
  l'appelant prioritaire, sinon arrondi 1 décimale sans zéro inutile, séparateur selon la locale, pas de
  séparateur de milliers (cohérence avec les libellés d'axe), unité omise si absente. Garde-fou : valeur
  non finie → chaîne vide (jamais « NaN »).
- `packages/shared/src/date.ts` : **`formatDayFull`** (+ 5 tests) — JJ/MM/AAAA acceptant **les deux formes**
  qui circulent : clé de jour `YYYY-MM-DD` lue **littéralement** (⚠️ `new Date('2026-07-12')` parse à
  minuit **UTC** puis `getDate()` rend en local → **la veille** dans un fuseau négatif ; piège évité et
  testé) et timestamp ISO rendu avec les getters locaux.
- `apps/mobile/src/components/charts/ChartTooltip.tsx` (+ 4 tests) : infobulle **partagée** par les deux
  graphiques, présentationnelle pure, largeur bornée, `accessibilityLabel` groupé.

**Modifié**
- `ProgressLineChart` : `DataPoint.detail?` + **propagation dans `chartData`** (sans elle,
  `pointerLabelComponent` ne voit jamais la date et l'infobulle retombe silencieusement sur l'abrégé
  d'axe) ; `pointerConfig` (tap instantané, `persistPointer`, recalage aux bords, repère vertical).
  `items[0]` = série **brute** : avec le lissage deux séries sont passées, on n'affiche jamais la lissée.
- `MuscleVolumeBarChart` : `detail?` + `focusBarOnPress` + `renderTooltip` → **le même** `ChartTooltip`.
- `progress/index.tsx`, `nutrition-stats.tsx`, `running-history/index.tsx` : `detail` renseigné sur les
  4 surfaces datées ; `label` d'axe **inchangés**.
- `charts-smoke.test.tsx` : mock `react-i18next` ajouté — les graphes lisent désormais la locale, ce qui
  provoquait un avertissement à chaque rendu.

**Technique / Notes**
- **2 écarts au plan, arbitrés à l'implémentation et documentés dans la spec** :
  **(1) fermeture par un tap ailleurs → NON implémentée (§2.4)**. `gifted-charts` garde l'index du pointeur
  en interne sans API de remise à zéro ; le seul contournement serait un remontage par `key`, qui
  **relancerait l'animation à chaque tap**. L'infobulle reste jusqu'au tap suivant. En revanche
  `resetPointerOnDataChange` traite le cas important : changement de période / métrique / exercice ferme
  l'infobulle plutôt que de pointer une donnée disparue.
  **(2) barre tapée non repeinte (§2.2)**. `FocusedBarConfig` n'offre qu'un aplat (`color`/`opacity`), pas
  de contour — vérifié dans les types. Repeindre écraserait les **couleurs sémantiques** de l'équilibre
  musculaire (délaissé/équilibré/sur-représenté), que la spec protège. Le retour visuel est l'infobulle,
  ancrée au-dessus de la barre tapée.
- **Aucune clé i18n ajoutée** : le titre du graphique d'équilibre est déjà « Séries par groupe », donc
  « 18 » seul est sans ambiguïté — le point laissé ouvert par la spec (§7) se résout sans code.
- **À noter, non fait volontairement** : `formatDateFr` est **dupliqué dans 4 écrans** (`account-delete`,
  `deletion-pending`, `history/index`, `history/[id]`) et pourrait migrer vers `formatDayFull`. Refactor
  hors périmètre de cette US.
- **Qualité** : typecheck, lint, tests shared et tests mobile → **exit code 0 lu sans pipe** à chaque task
  (leçon de la CI rouge du 25/07). **846 tests shared + 116 mobile.**
- **Roadmap : aucune ligne concernée** (finition transverse hors périmètre chiffré) → étape statut sautée.
  `IDEAS.md` : idée du 16/07 passée en **✅ promue** et descendue dans « Archives » avec la décision.
- **Reste** : recette device (8 critères, spec §9) — en particulier le **recalage aux deux bords** et la
  **valeur brute** sur courbe lissée. Commit précédent : `b97556a`.

### 25/07/2026 — `feature/deload-suggestion` — brique deload (gestion de stagnation, 3.8)

> Dev autonome. Brique **pure + testée**, label UI prêt — **pas encore déclenchée** (voir Notes).
> typecheck 0 · lint 0 err · shared 77 + mobile 112 tests. Aucune migration.

**Ajouté**
- **Deload dans `computeProgressionSuggestion`** ([workout.ts](packages/shared/src/workout.ts)) : nouveau kind
  `deload` + `DEFAULT_DELOAD_FACTOR` (−10 %) + helper `sessionStruggled` (échec ou RPE ≥ 8). Règle : dernière
  séance difficile **ET** précédente difficile (`opts.previousStruggled`) **ET** exercice chargé → propose une
  **charge réduite** (arrondi 0,5 kg), jamais imposé. Params optionnels → **rétrocompatible**. 5 tests.
- **Label UI** `workout.suggestion.deload` ([workout.tsx](apps/mobile/src/app/workout.tsx) + i18n FR/EN).

**Technique / Notes**
- **Pas encore déclenché** : `workout.tsx` ne passe pas `previousStruggled` (il faudrait la **séance
  avant-dernière** de l'exercice — requête à ajouter). Sans ce signal, `deload` ne sort jamais → **aucun
  changement de comportement** pour l'instant.
- **Règle de coaching à valider (Florian)** : « 2 séances difficiles d'affilée » = échec **ou** RPE ≥ 8 ;
  baisse −10 %. Seuils tunables (`deloadFactor`, critère de difficulté) — à confirmer avant câblage final.

### 25/07/2026 — `feature/run-summary-splits` — tableau de splits/km sur le résumé de course (RUN-F1, 5.26)

> Dev autonome (suite de `computeKmSplits`). 100 % UI, aucune migration. typecheck 0 · lint 0 err · 112 tests.

**Ajouté**
- **Splits par km** sur l'écran résumé de course ([run/summary.tsx](apps/mobile/src/app/run/summary.tsx)) :
  décode la trace (déjà fait pour la carte) → `computeKmSplits` → tableau (Km N · barre relative · allure
  M:SS), **km le plus rapide en accent**. Affiché seulement pour une course GPS avec trace ≥ 1 km plein
  (rien sinon). Clés i18n `running.summary.splits` / `splitKm`.

**Technique / Notes**
- Allure des splits en **M:SS par km** (`formatPaceMMSS`, pas de conversion d'unité) — splits toujours
  par km même en réglage impérial (standard coach ; à confirmer si on veut du /mile).
- **5.32 dénivelé cumulé** reste **non faisable** : la trace encode lat/lng/t **sans altitude**.

### 25/07/2026 — `feature/auto-close-seance-perimee` — clôture automatique d'une séance périmée (3.37)

> Dev autonome (Damien : « lance des corrections ou dev en autonomie »). Comble un **vrai trou** du
> backlog muscu (le reste de MUSC-F4/F5/F7 était déjà livré par le chantier refonte muscu, cases restées
> `[ ]`). 100 % logique, aucune migration. typecheck 0 · lint 0 err · shared 72 + mobile 112 tests.

**Ajouté**
- **Clôture auto d'une séance « zombie »** (spec 3.37) : une séance oubliée restait `active` **à vie** →
  le widget « Séance du jour » proposait « Reprendre » indéfiniment et bloquait un nouveau départ. Désormais,
  au **démarrage de l'app** (après la synchro initiale), une séance active depuis **plus de 3 h**
  (`WORKOUT_AUTO_CLOSE_SECONDS`) est **terminée automatiquement**.
- Brique pure **`isWorkoutStale(startedAt, nowMs, maxSeconds?)`** + constante `WORKOUT_AUTO_CLOSE_SECONDS`
  ([workout.ts](packages/shared/src/workout.ts)), testées (seuil strict, seuil custom, date invalide → faux).
- **`autoCloseStaleWorkout()`** ([workout-repository.ts](apps/mobile/src/data/repositories/workout-repository.ts)) :
  best-effort, idempotent (délègue à `finishWorkout`). Câblée une fois via un effet gaté `hasSynced` dans
  [_layout.tsx](apps/mobile/src/app/_layout.tsx).
- `finishWorkout` accepte un **`finishedAt` optionnel** : la clôture auto date la fin à la **dernière
  activité réelle** (dernier `updated_at` des séries, sinon `started_at`) → **durée non gonflée** jusqu'à
  « maintenant » (sinon stats/records/widgets de temps faussés).

**Technique / Notes**
- **Non recetté device** : impossible de fabriquer une séance vieille de 3 h à la demande ; logique
  couverte par tests unitaires + typecheck. À vérifier device par Damien (ou en abaissant le seuil en test).
- **Choix de design à confirmer** (Damien) : (1) seuil = **3 h** ; (2) une séance périmée **vide** (aucune
  série) est clôturée en `completed` avec **durée 0** (pas de discard) ; (3) l'occurrence planifiée liée est
  marquée `done` (comportement `finishWorkout` standard).

### 25/07/2026 — `fix/signout-scope-local` — « Se déconnecter » ne déconnecte plus tous les appareils

> Bug connu (repéré le 25/07 en vérifiant l'API pour CONF-08). 100 % logique, aucune migration.
> typecheck 0 · lint 0 erreur · 112 tests.

**Corrigé**
- **Déconnexion ordinaire (bouton Réglages)** : `supabase.auth.signOut()` sans argument utilise le scope
  **`global`** (défaut de `@supabase/auth-js`) → révoquait les refresh tokens de **tous** les appareils.
  Passé en **`{ scope: 'local' }`** dans le seul `signOut` du store
  ([auth-store.ts](apps/mobile/src/stores/auth-store.ts)) → ne déconnecte que l'appareil courant.

**Technique / Notes**
- **Non modifiés** (scope global voulu) : `completePasswordRecovery` (révoquer les autres appareils après
  un reset MDP — documenté) et le `signOut` de la suppression de compte.
- **Recette** : à faire **sur 2 appareils** (déconnecter A ne doit pas déconnecter B) — non vérifiable sur
  un seul device (recetter y déconnecterait la session). Fix vérifié en code.

### 25/07/2026 — `fix/activation-programme-owner-scope` — activation d'un programme éditorial (divergence local↔cloud)

> Bug remonté par Damien via la recette widgets (« il y a un programme actif mais absent du widget »).
> **Diagnostic vérifié en SQL + dans le code** (pas une supposition) — voir Notes. 100 % UI/logique,
> aucune migration. typecheck 0 · lint 0 erreur · 112 tests.

**Corrigé**
- **On pouvait « activer » un programme éditorial** (bibliothèque, `owner_id IS NULL`) sans le dupliquer :
  le détail de programme affichait « Démarrer le programme » **même pour un éditorial**, ce qui appelait
  `planProgram(editorialId)` → `is_active=1` écrit **en local** (SQLite sans RLS) puis **rejeté par la RLS
  au sync** (interdit d'écrire `owner_id null`). Résultat : la bibliothèque affichait « Actif » alors que
  `useActiveProgram` (owner-scopé) ne le voyait pas → widget « Aucun programme actif » + divergence local↔cloud.
- **UI** ([programs/[id].tsx](apps/mobile/src/app/programs/%5Bid%5D.tsx),
  [running-programs/[id].tsx](apps/mobile/src/app/running-programs/%5Bid%5D.tsx)) : le bouton
  « Démarrer / Modifier le planning » (et, côté course, Modifier / Supprimer) est désormais **réservé aux
  programmes possédés** (`isOwned`). Un éditorial ne propose plus que **« Dupliquer »** (recetté device).
- **Repository (filet de sécurité)** : l'`UPDATE ... SET is_active = 1` est **owner-scopé** (`AND owner_id = ?`)
  dans [`activateProgram`](apps/mobile/src/data/repositories/program-repository.ts) **et** dans l'activation
  inlinée de [`planProgram`](apps/mobile/src/data/repositories/planned-session-repository.ts) — la désactivation
  l'était déjà, pas l'activation. Un éditorial ne peut plus jamais être flaggé actif.

**Technique / Notes**
- Vérifications : seed éditorial = `is_active false` ([seed.sql:128](supabase/seed.sql#L128)) ;
  `useActiveProgram` filtre `owner_id = user AND is_active = 1` ; `useProgramLibrary` surface `is_active`
  (d'où le badge « Actif » trompeur). Bug **pré-existant** (hors refonte widgets ; le widget était correct).
- **Nettoyage de donnée** : sur un device déjà touché, l'`is_active=1` fantôme reste en local jusqu'à un
  resync (ex. réinstallation propre / `pm clear` → re-sync depuis le cloud où l'éditorial est `is_active=false`).

### 25/07/2026 — `feature/widgets-data-suite` — widgets Course : splits/km (grand carré Historique)

> Complétion d'une des 2 données reportées. La trace GPS encode lat/lng **+ temps par point**
> (`GpsPoint.t`) → les splits/km sont calculables. Brique pure + testée. Commit précédent : `514134b`.
> 100 % UI + data (aucune migration). typecheck 0 · lint 0 erreur · 112 tests mobile + 85 shared.

**Ajouté**
- **`computeKmSplits(points)`** ([running.ts](packages/shared/src/running.ts), `@wellness/shared`) :
  découpe une trace en splits par kilomètre plein (parcours haversine + filtre outliers comme
  `totalDistance`, interpolation du temps aux bornes km, dernier km partiel ignoré). Pur, testé
  (3 cas : < 2 points, < 1 km, numérotation + secondes positives).
- **Grand carré Course · Historique** ([running-widgets.tsx](apps/mobile/src/components/widgets/running-widgets.tsx)) :
  affiche les **splits/km** de la dernière course (mini-barres, km le plus rapide en accent, pied
  « Meilleur km · M:SS ») quand une trace GPS existe ; **repli** sur la sparkline des distances
  récentes sinon. Détail de course via `useRun(lastRun.id)` (hook inconditionnel). Clés i18n
  `widgets.running.splitsEyebrow` / `bestKm`.

**Technique / Notes**
- Non recettable sur le device de test tel quel : la dernière course y est un ajout manuel à 0 km
  **sans trace** → repli sparkline (déjà validé). La logique splits est couverte par les tests unitaires.
- **Reste reporté** : semaine X/Y d'un programme (faisable via `planned_sessions.week_index`, mais
  **non recettable** faute de programme actif sur le compte de test — à faire quand un programme existe).

### 25/07/2026 — `feature/widgets-v2-dnd` — widgets : complétion des données (volume hebdo + tonnage historique)

> Suite recette device : formes riches complétées avec de vraies données au lieu de dégradations.
> Recetté sur device (sparkline Progression multi-points + tonnage par séance affichés). Commit
> précédent : `0b9c124`. 100 % UI + data (aucune migration). typecheck 0 · lint 0 erreur · 112 tests verts.

**Ajouté**
- **`useWeeklyVolumeSeries(weeks)`** ([records-repository.ts](apps/mobile/src/data/repositories/records-repository.ts)) :
  série de tonnage hebdomadaire (8 semaines glissantes, bucketing par `finished_at`, module-level pur pour
  la règle `react-hooks/purity`) → la **sparkline Progression** (widget muscu) devient une vraie courbe
  multi-points au lieu d'une diagonale à 2 points.
- **Tonnage par séance** dans l'historique : `SELECT_HISTORY` calcule `volume_kg` (correlated subquery
  Σ reps × poids, non-échauffement), exposé via `WorkoutHistoryItem.volumeKg`
  ([workout-repository.ts](apps/mobile/src/data/repositories/workout-repository.ts)) ; le widget
  **Historique muscu** (formes `wide`/`large`) affiche le tonnage par séance (« 4,3 t »). Clé i18n
  `widgets.strength.tonnage`.

**Technique / Notes**
- Test `history-smoke` : fixtures `WorkoutHistoryItem` complétées de `volumeKg`.
- **Reportés** (non branchés) : **splits/km** du grand carré Course (la trace GPS est encodée dans
  `runs.gps_track`, aucune table de points → décodage + géométrie lourds/risqués ; la sparkline des
  distances récentes reste) ; **semaine X/Y** d'un programme (faisable via `planned_sessions.week_index`
  mais chaînage plus lourd — à faire en suivi si besoin).

### 25/07/2026 — `feature/widgets-v2-dnd` — fix widgets : trou de grille (widget conditionnel) + état vide démesuré

> Recette **sur device** (prise de contrôle ADB : screenshots + navigation accueil/muscu/course/édition).
> Deux bugs de rendu corrigés, revérifiés sur le Pixel après rebuild release. Commit précédent : `dcce386`.
> 100 % UI, aucune migration. typecheck 0 · lint 0 erreur · 44 tests verts.

**Corrigé**
- **Trou dans la grille de widgets** (le « module qui ne s'affiche pas » remonté par Damien) :
  `DeficitVolumeAlertCard` rend `null` tant que l'alerte n'est pas déclenchée (widget conditionnel,
  spec 4.32), mais la grille en positions absolues lui **réservait quand même une cellule** → un trou
  qui décalait/masquait les widgets suivants (Semaine running). `WidgetGrid` reçoit un prédicat
  **`isActive`** ([WidgetGrid.tsx](apps/mobile/src/components/widgets/WidgetGrid.tsx)) qui **exclut les
  widgets inactifs** de la grille (affichage ET édition) ; l'accueil
  ([index.tsx](apps/mobile/src/app/%28tabs%29/index.tsx)) le câble sur `deficit-volume` via
  `useDeficitVolumeAlert().show`. Le widget réapparaît à sa place quand l'alerte se déclenche.
- **État vide démesuré** : les libellés d'état vide (« Aucune », « Aucun programme actif »…) passaient
  par le gros chiffre héro (38 px) de `Metric`. `Metric` en mode `muted` utilise désormais une police
  modeste (20 px, [WidgetFrame.tsx](apps/mobile/src/components/widgets/WidgetFrame.tsx)).

**Technique / Notes**
- Non corrigés (hors bug de rendu) : « 3150 min » (donnée de recette factice), sparkline Progression à
  2 points (diagonale — pas d'historique de volume hebdo branché), carte `large` clairsemée d'un
  programme absent (cosmétique).
### 25/07/2026 — `fix/reset-mot-de-passe-deeplink` — US CONF-08 : recette validée & US clôturée (RECETTE)

> **RECETTÉE & VALIDÉE par Florian (25/07/2026) ✅ → mergé sur `dev`.** Relecture Damien **non requise**
> (go explicite de Florian). Le parcours complet fonctionne : lien « mot de passe oublié » → l'app s'ouvre
> sur l'écran de saisie → nouveau mot de passe enregistré → retour connexion. Config Supabase faite
> (`wellness://password-reset` dans les Redirect URLs).

**Corrigé pendant la recette** — 2 bugs de la même classe, trouvés grâce au retour terrain
- **`wellness://password-reset` → écran « Unmatched Route »** (capture fournie par Florian). Cause :
  **Expo Router résout le deep link entrant comme un chemin de route et y navigue lui-même** ; l'écran
  s'appelait `new-password.tsx` alors que le lien pointe sur `password-reset` → aucune route ne correspond,
  et **cette navigation gagne la course** contre celle du gate (le drapeau et la redirection fonctionnaient,
  ils étaient écrasés). Fix : `new-password.tsx` → **`password-reset.tsx`** (route, composant, test,
  branchement du layout). La contrainte **« nom de fichier = chemin du deep link »** est désormais écrite en
  tête du fichier, dans la spec (§2.3) et dans le plan — piège invisible à la relecture.
- **Blocage latent sur `wellness://auth-callback`** (confirmation d'inscription, livrée la veille) : ce
  chemin n'a **pas** d'écran non plus. Le bug ne s'était pas vu en recette parce qu'un **nouveau** compte
  part sur `route = 'onboarding'`, dont la branche redirige **inconditionnellement** ; mais un compte **déjà
  onboardé** restait **bloqué** sur « Unmatched Route », la branche `route === 'app'` ne redirigeant que
  depuis `(auth)` et `(onboarding)`. Échappatoire ajoutée pour ce chemin d'atterrissage.

**Technique / Notes**
- Le namespace i18n reste `auth.newPassword.*` alors que la route s'appelle `password-reset` : **voulu**
  (le namespace décrit l'écran, la route doit matcher l'URL du lien). Ne pas « harmoniser ».
- **Reste ouvert, hors périmètre** : (a) bug préexistant du **« Se déconnecter »** en scope `global`
  (déconnecte tous les appareils) — consigné [TODO.md](TODO.md) §🐞, correction = décision produit + recette
  dédiée ; (b) **SMTP custom** Supabase (service intégré rate-limité) = prérequis bêta ; (c) changement de
  mot de passe depuis les **Réglages** (utilisateur connecté) — besoin distinct non cadré.
- 9 commits (`d33f252`→`c7dd417`). typecheck + lint verts (0 erreur) ; **829 tests shared + 112 mobile** ;
  parité i18n 1217/1217. Aucune migration, aucun module natif. Roadmap **1.6** → remarque complétée.
- Commit précédent : `e377c83`.

### 25/07/2026 — `fix/reset-mot-de-passe-deeplink` — US CONF-08 : réinitialisation du mot de passe (code livré)

> **Trou fonctionnel du socle auth (roadmap 1.6), prérequis bêta.** Le lien « mot de passe oublié » menait à
> une page morte `localhost:3000` et **aucun écran de saisie du nouveau mot de passe n'existait** → un
> utilisateur qui oubliait son mot de passe **ne pouvait pas récupérer son compte**. Prolonge le fix de la
> confirmation d'inscription du 25/07 (mêmes briques, flux différent). Spec + plan + maquette **validés par
> Florian et Damien**. 5 tâches TDD (`1091381`→`b21d1cf`). **Aucune migration, aucun module natif.**

**Le piège évité (raison d'être du cadrage)**
- Le lien de récupération renvoie **des jetons de session**, comme celui de confirmation. Ajouter simplement
  `redirectTo` aurait donc **connecté l'utilisateur dans l'app sans jamais lui demander de nouveau mot de
  passe**, l'ancien restant actif — le bug devenait *silencieux* au lieu d'être visible.
- D'où : drapeau `recoveryPending` levé **avant** `setSession` + nouvel état de routing `password-recovery`
  qui court-circuite onboarding/app. Dans l'autre ordre, `onAuthStateChange` peut produire un rendu où la
  session existe sans le drapeau → redirection éclair vers `(tabs)`.

**Ajouté**
- `packages/shared/src/password.ts` (+ test, 8 cas) : `MIN_PASSWORD_LENGTH` + `validatePasswordPair`
  (**pur**) — longueur avant concordance, aucune normalisation.
- `packages/shared/src/root-route.ts` : état **`password-recovery`** + entrée **optionnelle**
  `recoveryPending` (⇒ non-régression des appels existants), évaluée après `deletionPending` et **avant**
  l'attente profil/réglages (l'écran n'en a pas besoin). 7 tests, priorités verrouillées.
- `apps/mobile/src/lib/auth-redirect.ts` : `PASSWORD_RESET_REDIRECT_URL` (`wellness://password-reset`) +
  `parseAuthDeepLink` (**pur**, 9 tests) → `tokens` (avec `isRecovery`) · `error` (lien expiré/consommé) ·
  `null`. Discriminant = **le chemin du lien** (structurel), `type=recovery` en contrôle secondaire.
- `apps/mobile/src/app/new-password.tsx` (+ smoke, 5 tests) : écran-gate **de niveau racine** (à côté de
  `deletion-pending`, **pas** dans `(auth)` dont le segment entrerait en collision avec la branche
  `route === 'auth'`), `gestureEnabled: false`, seule sortie = « Annuler » (déconnexion).
- Store : `recoveryPending`, `deepLinkError`, `passwordJustReset`, `completePasswordRecovery`, +3 `clear*`.

**Modifié**
- `resetPassword` passe `redirectTo` (sinon Supabase retombe sur le Site URL).
- `useAuthDeepLink` : dispatch par `kind`, no-op par défaut inchangé.
- `_layout.tsx` : `recoveryPending` au routing + branche de redirection + `Stack.Screen`.
- `sign-in.tsx` : messages « mot de passe modifié » / « lien expiré », effacés au démontage.
- `sign-up.tsx` : bascule sur la règle mutualisée, **iso-comportement** (mêmes clés, même ordre).
- i18n FR+EN : `auth.newPassword.*` + 2 clés `auth.signIn.*` — **parité 1217/1217 vérifiée par script**.

**Corrigé**
- Liens de reset **expirés / déjà utilisés** : message explicite au lieu d'un **no-op silencieux**.

**Technique / Notes**
- **Décision d'implémentation corrigée en cours de route, API vérifiée dans `@supabase/auth-js`** :
  `signOut()` **sans argument utilise le scope `global`** (types + doc de `GoTrueClient`), qui révoque les
  refresh tokens de *tous* les appareils **et** efface la session locale. Un seul appel remplace donc la
  séquence `{scope:'others'}` puis `signOut()` initialement prévue au plan — pas d'ordre fragile, pas de
  gestion d'échec non bloquant. Spec + plan mis à jour avant de coder.
- ⚠️ **Bug préexistant repéré, NON corrigé** (consigné en [TODO.md](TODO.md) §🐞) : le bouton
  **« Se déconnecter »** des Réglages hérite du même défaut `global` → il déconnecte l'utilisateur **de tous
  ses appareils**. Inattendu pour une déconnexion ordinaire. Correction = changement de comportement
  existant → décision produit + recette à part. **Ne pas toucher `completePasswordRecovery`**, où le scope
  global est au contraire voulu.
- **Pas de désactivation du bouton hors-ligne** (écart assumé vs CONF-02) : `useStatus().connected`
  (PowerSync) n'est pas fiable juste après une ouverture par deep link → il bloquerait un utilisateur en
  ligne. On laisse partir l'appel et on mappe l'échec réseau.
- **Message de succès porté par le store** (`passwordJustReset`) et non par un paramètre de route : c'est le
  gate qui redirige après la perte de session, un `router.replace` avec params serait écrasé.
- **Filet de sécurité** dans `onAuthStateChange` : toute perte de session éteint `recoveryPending` (sinon un
  drapeau resté levé referait apparaître l'écran à la prochaine connexion).
- `accessibilityLabel` sur les 2 champs (nécessaire pour les cibler en test — RNTL v14 a retiré
  `UNSAFE_getAllByType` — et gain a11y avant 9.11/9.12). Les `fireEvent` doivent être **awaités** (patron
  maison, cf. `edit-exercise-modal-smoke`) sinon les états ne sont pas vidés.
- ⚠️ **Limite assumée** (spec §2.5) : drapeau **en mémoire**. App tuée sur l'écran de saisie → le lancement
  suivant entre normalement dans l'app, mot de passe inchangé. Accepté : l'utilisateur a prouvé qu'il
  possède l'adresse, et un gate persistant risquerait de le **piéger hors de son compte**.
- 🔧 **Prérequis avant recette** : `wellness://password-reset` à ajouter aux **Redirect URLs** Supabase.
  Si la recette retombe sur `localhost:3000`, c'est **ce réglage**, pas le code.
- typecheck + lint verts (0 erreur) ; **829 tests shared + 112 mobile** verts. Roadmap 1.6 : remarque
  complétée (l'envoi seul ne suffisait pas). **Reste** : prérequis Supabase + recette device (9 critères) +
  relecture Damien.
- Commit précédent : `e377c83`.

### 25/07/2026 — `dev` — IDEAS : salve « benchmark 4 modèles IA » (6 idées + 2 enrichissements)

> **Documentation seule** (`IDEAS.md`), aucun code applicatif. Dépouillement des 4 dumps de `_inbox-ia/`
> (Gemini, ChatGPT, Qwen-3.7-plus, Qwen-3.8-max — ~93 propositions), croisés avec l'existant : **6 idées
> nettes** retenues + **2 enrichissements** greffés sur des lignes du 13/07. Sélection arbitrée par Florian
> (25/07). ⚠️ **Commit fait directement sur `dev`** — dérogation explicite de Florian (doc seule, pas de
> branche dédiée). `_inbox-ia/` reste **gitignoré** (décision Florian : les dumps bruts restent locaux).

**Ajouté** — `IDEAS.md`, 7 entrées en tête de « À trier » (date `[25/07/2026]`, statut 🔍)
- **Note de benchmark** (source + garde-fous) : trace les 4 dumps, les **2 biais à ne pas suivre**
  (stack IA **on-device** contraire à l'archi « IA = backend » ; **synchro P2P Bluetooth** contraire à
  PowerSync/ADR-001), les 4 idées **écartées** (correction de forme caméra temps réel, pacing électrolytes
  HYROX…) et les **chiffres marché non vérifiés** (plan annuel ≈ 60 % des revenus fitness, essai 17-32 j
  ≈ 42 % de conversion médiane) → à confronter aux sources avant usage RevenueCat post-V1.
- **Détecteur de collisions + séquençage inter-séances** (signal 4/4 modèles) — cœur du différenciateur
  d'intégration.
- **Mode « vie réelle » / journée minimale viable** (dégradation gracieuse anti-abandon).
- **Simulateur « What-If »** (projection avec fourchette d'incertitude).
- **Objectif hybride unifié** (un plan, priorités explicites, arbitrage des compromis).
- **Recommandations explicables ET contestables** — posé en **note de principe UX transverse**, pas en US.
- **Défi composite cross-pilier** (un seul objectif exigeant les 3 piliers ; cible V3/V4 — décision C).

**Modifié** — 2 greffes en sous-puce `_**Enrichissement 25/07/2026**_` (même patron que les arbitrages du 15/07)
- « Rappels intelligents contextuels » (13/07) : rappel envoyé **au moment probable appris** (moyenne
  glissante des heures de log, calcul 100 % local) + points durs **doze mode** Android / plafond de notifs.
- « Bilan hebdo/mensuel automatique » (13/07) : format « **une seule décision** » ; si l'IA rédige, elle le
  fait **à partir des chiffres affichés** (pas de narration sans données visibles).

**Technique / Notes**
- **Vérifications faites avant rédaction** (elles ont changé le texte) : le détecteur de collisions est
  **moins net-new** qu'annoncé en analyse — **US 3.9 « Planning calendrier auto » livrée ✅** (calendrier
  unifié muscu+running) qui **diffère explicitement** la « coordination avancée (charge/récup) » et
  l'« alerte de chevauchement bloquante » (`docs/specs/functional/us/3.9-planning-muscu-unifie.md` §7), et
  `docs/product/analyses-donnees.md` porte déjà **RN-17** (conflit objectifs nutrition ↔ course) et
  **META-19** (garde-fou surentraînement ACWR). Ce qui reste neuf = **séquencer les séances entre elles**.
  Également noté : le « chevauchement » cadré est un **conflit d'agenda**, pas physiologique. US **4.7**
  (calories adaptées à l'entraînement) déjà ✅ → le consensus 4/4 « nutrition qui suit la séance » est couvert.
- **Roadmap non touchée** (aucune fonctionnalité livrée/avancée — boîte de dépôt d'idées) → étape statut roadmap sautée.
- Qualité verte malgré un diff doc : typecheck OK · **814 tests shared** OK · lint **0 erreur** (6 warnings
  pré-existants dans des fichiers de test, sans lien avec ce commit).
- Commit précédent : `67bcd27`.

### 25/07/2026 — `fix/email-confirmation-deeplink` — recette validée & fix clôturé (RECETTE)

> **RECETTÉE & VALIDÉE à 100 % par Florian (25/07/2026) ✅ → mergé sur `dev`.** Relecture Damien non requise.
> Clic du lien de confirmation depuis le téléphone → l'app se rouvre, utilisateur connecté (fini la page
> `localhost:3000`). Config Supabase faite (`wellness://auth-callback` dans les Redirect URLs).
> Suivi séparé : reset de mot de passe (même redirection + écran dédié) et **SMTP custom** Supabase (prérequis bêta).

### 25/07/2026 — `fix/email-confirmation-deeplink` — Confirmation d'e-mail : redirection deep link (mobile)

> **Fix (circuit court).** Le lien de confirmation d'e-mail (inscription e-mail/mot de passe) redirigeait vers
> le **Site URL Supabase par défaut** (`http://localhost:3000`) → page morte sur mobile. Remontée Florian
> (test d'un e-mail neuf). La confirmation réussissait côté serveur, mais l'UX de retour dans l'app était cassée.

**Corrigé**
- `apps/mobile/src/lib/auth-redirect.ts` (+ test) : constante `AUTH_REDIRECT_URL` (`wellness://auth-callback`) +
  `parseAuthTokensFromUrl` (**pur, testé** — extrait `access_token`/`refresh_token` du fragment, flux implicite).
- `auth-store.signUp` : passe `options.emailRedirectTo = AUTH_REDIRECT_URL` (redirige vers le deep link de l'app,
  plus le Site URL localhost).
- `apps/mobile/src/hooks/useAuthDeepLink.ts` + montage dans `_layout.tsx` : au retour via
  `wellness://auth-callback#access_token=…&refresh_token=…`, établit la session (`setSession`) → `onAuthStateChange`
  prend le relais (l'utilisateur revient connecté dans l'app).

**Technique / Notes**
- ⚠️ **Config Supabase requise** (déploiement) : ajouter `wellness://auth-callback` dans **Authentication → URL
  Configuration → Redirect URLs**. Site URL laissé tel quel.
- typecheck + lint verts ; **814 shared + 98 mobile verts** (+4 tests parser). Module natif ajouté en amont
  (Google) → recette sur dev build.
- **Reste (hors périmètre de ce fix)** : même traitement pour le **reset de mot de passe** (`resetPasswordForEmail`
  redirige encore vers Site URL + nécessite un écran « nouveau mot de passe ») — à cadrer séparément.

### 24/07/2026 — `feature/1.2-oauth-google` — US 1.2 : recette validée & US clôturée (RECETTE)

> **RECETTÉE & VALIDÉE à 100 % par Florian (24/07/2026) ✅ → US CLÔTURÉE.** Relecture Damien **non requise**.

**Technique / Notes**
- Recette sur APK local (build gradle signé avec un **keystore release unique** dédié, SHA‑1 enregistrée dans
  un client OAuth Android Google Cloud — le quota EAS gratuit étant épuisé ; réglage `android/` local jetable,
  gitignoré). Fix `runtimeVersion` fixe (`1.0.0`) pour EAS en workflow bare (commit `db56728`).
- **Liaison de compte confirmée** : connexion Google sur un e‑mail **déjà existant et vérifié**
  (`florian.martin63000@gmail.com`) → Supabase rattache l'identité Google au **même** utilisateur (2 identités
  `email` + `google` sous un seul `user_id`), **aucun doublon**, données retrouvées. Comportement voulu (option A).
- Double mention de consentement sur l'écran d'inscription (case e‑mail + mention Google) **acceptée** en l'état.
- **V0.8** : 1.18 + 1.19 + 1.22 + 9.10 + **1.2** livrés & clôturés ; reste **9.9 (Health Connect)** + accessibilité (9.11/9.12).

### 24/07/2026 — `feature/1.2-oauth-google` — US 1.2 : code livré (connexion via Google)

> Implémentation subagent-driven (4 tâches TDD `359670b`→`eeb0e91` + correctifs post-revue), chaque tâche revue
> conformité-spec **puis** qualité, + revue finale **PRÊT À MERGER** (0 bloquant). typecheck + lint verts ;
> **814 tests shared + 94 mobile verts**. Aucune migration. Roadmap 1.2 → ✅. ⚠️ **Reste** : prérequis Google
> Cloud/Supabase + `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` + dev build + recette.

**Ajouté**
- `apps/mobile/src/lib/google-signin.ts` : `configureGoogleSignin()` (webClientId via env), side-effect importé
  dans `_layout.tsx`. Dépendance `@react-native-google-signin/google-signin` + `.env.example`.
- `apps/mobile/src/lib/google-auth-errors.ts` (+ test) : `mapGoogleSignInError` (**pur, testé**, statusCodes
  Google + patterns Supabase → clés i18n, réseau prioritaire, co-occurrence anti faux positifs).
- `apps/mobile/src/stores/auth-store.ts` : action `signInWithGoogle` (`hasPlayServices` → `signIn` → `signInWithIdToken`).
  Annulation & `IN_PROGRESS` = no-op ; succès-sans-idToken = anomalie mappée (config) ; **contrat d'erreur = clé
  i18n** documenté (≠ signIn/signUp). Session via `onAuthStateChange` (routing/onboarding inchangés).
- `apps/mobile/src/components/GoogleButton.tsx` : bouton « Continuer avec Google » (logo SVG 4 couleurs guidelines,
  `loading`/`disabled`, a11y) + **mention de consentement par action** (CGU/confidentialité/16+, liens `terms`/`privacy`).
- Intégration `sign-in.tsx` + `sign-up.tsx` (séparateur « ou » + handler `t(res.error)`). i18n FR/EN bloc `auth.google`.
- Test infra : mock global `@react-native-google-signin/google-signin` (`jest.setup.ts`) — débloque les suites
  tirant `auth-store` transitivement + smoke test bouton.

**Technique / Notes**
- Consentement par action (option A, **non persisté** — la persistance serveur reste une US dédiée). Liaison auto
  par e-mail vérifié (Supabase). **Hors périmètre** : OAuth Apple (iOS reporté), unlink, One Tap.
- **Reste avant recette** (déploiement contrôlé, Florian) : Client IDs Google (Web+Android/SHA‑1), provider Google
  Supabase, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, **nouveau dev build EAS**. **À valider visuellement** : double
  mention de consentement sur l'écran d'inscription (case e‑mail + mention Google).

### 24/07/2026 — `feature/1.2-oauth-google` — US 1.2 : spec connexion via Google (cadrage + validation)

> Ouverture de l'US **1.2** (OAuth Google, V0.8). Spec écrite, revue subagent **APPROUVÉE** (0 bloquant,
> faisabilité vérifiée contre le code : gate d'onboarding `resolveRootRoute`, intégration `auth-store`, env
> `EXPO_PUBLIC_*`), **validée Florian (24/07)**. Aucun code applicatif.

**Ajouté**
- `docs/specs/functional/us/1.2-connexion-google.md` : spec. Sign-In **natif**
  (`@react-native-google-signin/google-signin`) → `supabase.auth.signInWithIdToken` ; liaison auto par e-mail
  vérifié ; bouton « Continuer avec Google » sur connexion + inscription + **mention de consentement par action**
  (CGU + confidentialité + 16+) ; helper pur de mapping d'erreurs (testé, statusCodes Google + erreurs Supabase).
- Décisions de cadrage : natif (pas de flux web), liaison e-mail vérifié, consentement non persisté (option A),
  bouton 2 écrans. **Hors périmètre** : OAuth Apple (iOS reporté), persistance serveur du consentement (US dédiée),
  unlink, One Tap.

**Technique / Notes**
- Suivi : US 1.2 au pipeline [TODO.md](TODO.md) (🚧). Roadmap inchangée (1.2 reste ⬜ tant que non livré).
  ⚠️ Module natif → **nouveau dev build** ; prérequis **Google Cloud (Client IDs Web+Android) + provider Supabase
  + `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`** = déploiement contrôlé.

### 24/07/2026 — `feature/9.10-analytics` — US 9.10 : recette validée & US clôturée (RECETTE)

> **RECETTÉE & VALIDÉE à 100 % par Florian (24/07/2026) ✅ → US CLÔTURÉE.** Relecture Damien **non requise**
> (Florian valide l'ensemble). Sync rule PowerSync déployée sur l'instance ; événements confirmés remontés au cloud.

**Corrigé**
- Migration corrective `20260724123616_analytics_events_publication.sql` : `alter publication powersync add table
  public.analytics_events` — oublié dans `20260724112210` (pattern standard de toute table synchronisée). Sans lui,
  le déploiement des sync rules échouait (« table not part of publication 'powersync' »). Appliquée sur le cloud.

**Technique / Notes**
- Recette côté Supabase : lignes `analytics_events` créées (`app_opened`, `onboarding_started`, `workout_started`,
  `workout_completed`…), `properties` = `{}` (anti-PII confirmé), `user_id` pseudonyme, `platform`/`occurred_at` OK.
  Opt-out, offline, purge, i18n validés. Remontée cloud opérationnelle (sync rule active).
- **Suivi non bloquant** (hors US) : dépendance circulaire `analytics.ts ↔ settings-repository.ts` (bénigne) ;
  test du gating `track()` ; doublon `onboarding_started` observé en dev (probable React StrictMode, à confirmer
  hors dev) ; `app_version` à passer de `0.0.0` à une vraie version dans `app.json` avant la bêta.
- **V0.8** : 1.18 + 1.19 + 1.22 + **9.10** livrés & clôturés ; restent **1.2** (OAuth Google) + **9.9** (Health Connect).

### 24/07/2026 — `feature/9.10-analytics` — US 9.10 : code livré + migration déployée (analytics produit)

> Implémentation subagent-driven (5 tâches TDD `3214285`→`f321a1f` + correctifs post-revue), chaque tâche revue
> conformité-spec **puis** qualité, + revue finale **PRÊT À MERGER** (0 bloquant). typecheck + lint verts ;
> **814 tests shared + 83 mobile verts**. Migration poussée sur le cloud (`db:push` + `db:types`, `d973807`).
> Roadmap 9.10 → ✅. ⚠️ **Reste** : sync rule PowerSync (instance) + recette.

**Ajouté**
- Migration `supabase/migrations/20260724112210_analytics_events.sql` : table `analytics_events` (append-only,
  RLS insert/select own, FK `auth.users` cascade) + colonne `user_settings.analytics_enabled` (opt-out, défaut `true`).
- `apps/mobile/src/lib/analytics.ts` (+ test) : `sanitizeProps`/`buildEventRow` (**purs, testés**), `track()`
  (gating consentement/session + **allowlist anti-PII** `pillar` + non bloquant, offline-first), constante
  `ANALYTICS_EVENTS` + type `AnalyticsEventName`.
- `apps/mobile/src/data/repositories/analytics-repository.ts` : `insertAnalyticsEvent` (insert **append-only**
  dédié, pas de `insertWithSyncFields`).
- Schéma PowerSync `analytics_events` + colonne `analytics_enabled` (`schema.ts`) ; type partagé
  `UserSettings.analyticsEnabled` + mapping repository (helper `decodeAnalyticsEnabled`, accesseur `getAnalyticsEnabled`).
- Réglage **« Statistiques d'usage »** (opt-out) dans les Réglages + mention politique de confidentialité ; i18n FR/EN.
- Instrumentation **15 points** (socle : `app_opened` throttlé, onboarding, `pillar_activated`, workout/run
  started/completed, `food_logged` ; adoption : `stats_viewed`, `dashboard_customized`, `data_exported`,
  `help_opened`, `bug_reported`).
- Correctifs post-revue : throttle `app_opened` gaté sur session (1ᵉʳ open post-login capté) ; garde
  d'idempotence `finishWorkout` (miroir `finishRun`).

**Technique / Notes**
- Déploiement cloud : `db:push:dry` (seule `20260724112210`) → `db:push` (migration listée en `remote`) →
  `db:types` (`analytics_events` + `analytics_enabled` présents) → `MIGRATIONS.md` coché.
- `properties` en **text** (JSON) et non jsonb (gotcha PowerSync text→jsonb) ; purge analytics à la suppression
  de compte par cascade FK. **Hors périmètre** : dashboards/funnels (outil BI ultérieur), crash reporting, purge locale.
- **Reste** : **sync rule PowerSync** `analytics_events` (bucket par `user_id`, instance) + **recette** (JS pur,
  reload Metro après la sync rule — `expo-application` déjà dans le dev build 1.22). Dette légère tracée :
  dépendance circulaire `analytics.ts ↔ settings-repository.ts` (bénigne) + test du gating de `track()`.

### 24/07/2026 — `feature/9.10-analytics` — US 9.10 : spec analytics produit first-party (cadrage + validation)

> Ouverture de l'US **9.10** (analytics, V0.8, avant bêta). Spec écrite, revue subagent **APPROUVÉE**
> (0 bloquant, faisabilité vérifiée contre le code réel dont la purge cascade CONF-02), **validée Florian
> (24/07)**. Aucun code applicatif (workflow spec → plan → design → validation → code).

**Ajouté**
- `docs/specs/functional/us/9.10-analytics-produit.md` : spec de l'US. Table `analytics_events` (append-only,
  Supabase + RLS + FK `auth.users` cascade), consentement **opt-out** (`user_settings.analytics_enabled` défaut
  ON) + réglage « Statistiques d'usage » + mention politique de confidentialité, service `track()` offline-first
  (PowerSync) avec gating + **allowlist anti-PII** (`pillar`), instrumentation ~15 points (socle + adoption).
- Décisions de cadrage : first-party (données chez nous, pas d'outil tiers/infra), opt-out, identifiant
  `user_id` (purge cascade), écriture via PowerSync. **Hors périmètre** : dashboards/funnels, crash reporting,
  purge locale, analytics dans l'export CONF-01.

**Technique / Notes**
- Suivi : US 9.10 ajoutée au pipeline [TODO.md](TODO.md) (🚧). Roadmap inchangée (9.10 reste ⬜ tant que le code
  n'est pas livré). Étape déploiement notée : sync rules PowerSync (instance) + `db:push`/`db:types`.

### 24/07/2026 — `feature/1.22-aide-support` — US 1.22 : recette validée & US clôturée (RECETTE)

> **RECETTÉE & VALIDÉE à 100 % par Florian (24/07/2026) ✅ → US CLÔTURÉE.** Relecture Damien **non requise**
> (Florian valide l'ensemble). Aucun écart remonté.

**Technique / Notes**
- Recette sur dev build EAS (modules natifs `expo-mail-composer`/`expo-application`) : accès offline, FAQ
  accordéon mono-ouverture (7 Q/R), « Nous contacter » (mail natif corps vide), « Signaler un bug » (mail +
  bloc technique effaçable), i18n FR/EN. Adresse de support réelle `wellnessfit.app.support@gmail.com`.
- **V0.8** avance : 1.18 (CONF-01) + 1.19 (CONF-02) + **1.22** livrés & clôturés ; restent **1.2** (OAuth
  Google), **9.9** (Health Connect), **9.10** (analytics) + finitions accessibilité (9.11/9.12).

### 24/07/2026 — `feature/1.22-aide-support` — US 1.22 : code livré (Aide & support)

> Implémentation subagent-driven (5 tâches TDD `e55c775`→`fd289fb` + durcissement `c2b0e1c`), chaque tâche
> revue conformité-spec **puis** qualité. Revue finale code-reviewer → **PRÊT À MERGER** (0 bloquant).
> typecheck + lint verts ; **812 tests shared + 80 mobile verts**. Roadmap 1.22 → ✅. Zéro backend, zéro
> migration. ⚠️ Modules natifs ajoutés → **dev build EAS requis avant recette** (reload Metro insuffisant).

**Ajouté**
- `apps/mobile/src/lib/support.ts` (+ test) : `SUPPORT_EMAIL` (placeholder centralisé), `formatBugReportBody`
  (helper **pur**, testé), `collectSupportMeta` (métadonnées non identifiantes, non bloquant), `contactSupport`
  (ouvre le client mail natif via `expo-mail-composer` ; fallback `Alert` si indisponible ; **ne rejette jamais**).
- `apps/mobile/src/components/FaqItem.tsx` : item de FAQ **contrôlé** (accessible, chevron), piloté par le parent.
- `apps/mobile/src/app/help.tsx` (+ smoke test) : écran `/help` = FAQ **accordéon mono-ouverture** (7 Q/R via
  `returnObjects`, garde `Array.isArray`) + section contact (« Nous contacter » / « Signaler un bug »).
- Route modale `help` dans `_layout.tsx` (patron `account-delete`/`profile`) + section « Aide & support » dans
  les Réglages (bouton `ghost` → `/help`).
- i18n **FR + EN** (`settings.help.*`, objet racine `help.*` : FAQ, contact, bug, mail indisponible) — parité
  stricte vérifiée (1189 clés de chaque côté).
- Dépendances `expo-mail-composer` + `expo-application` (SDK 57) + config plugin `expo-mail-composer` (`app.json`).

**Technique / Notes**
- Découpage pur/I-O respecté ; signalement de bug = métadonnées **minimales** (version app/build, OS, appareil,
  langue), **visibles et effaçables**, aucune donnée perso silencieuse (RGPD). Offline : FAQ embarquée + mail natif.
- **Reste** : renseigner `SUPPORT_EMAIL` (adresse à créer) + ajuster le préfixe d'objet `[Wellness]` avant le
  build ; **dev build EAS** ; **recette device** (Florian) ; **relecture Damien**.

### 24/07/2026 — `feature/1.22-aide-support` — US 1.22 : spec Aide & support (cadrage + validation)

> Ouverture du chantier **V0.8 (conformité & intégrations)** après clôture de CONF-01/CONF-02. Item **1.22**
> (Aide & support), prérequis bêta. Spec écrite, revue subagent **APPROUVÉE** (0 bloquant), **validée Florian
> (24/07)**. Aucun code applicatif (workflow : spec → plan → design → validation → code).

**Ajouté**
- `docs/specs/functional/us/1.22-aide-support.md` : spec de l'US. Section « Aide & support » (Réglages) → écran
  `/help` = **FAQ** statique embarquée (≈ 7 entrées, bilingue FR/EN, hors-ligne) + **« Nous contacter »** (mail
  natif, corps vide) + **« Signaler un bug »** (mail natif + bloc technique minimal, visible/effaçable).
- Décisions de cadrage : canal = client mail natif (`expo-mail-composer`), **zéro backend/migration** ; FAQ
  statique embarquée ; métadonnées minimales non identifiantes (pas d'UUID/logs) ; `SUPPORT_EMAIL` = placeholder
  centralisé (à trancher avant build). Table Supabase / file de tickets / FAQ éditable = **hors périmètre**.
- Découpage testable prévu : helper pur `formatBugReportBody` (testé) / I/O natif isolé (`collectSupportMeta`,
  `composeAsync`) / fallback `Alert` si aucun client mail.

**Technique / Notes**
- Suivi : US 1.22 ajoutée au pipeline [TODO.md](TODO.md) (🚧 en cours). Roadmap inchangée (1.22 reste ⬜ tant
  que le code n'est pas livré). Prochaines étapes : plan d'implémentation → maquette (Claude Design) →
  validation des 3 livrables → code.

### 23/07/2026 — `feature/conf01-export-donnees` — CONF-01 : recette validée & US clôturée (RECETTE)

> **RECETTÉE & VALIDÉE à 100 % par Florian (23/07/2026) ✅ → US CLÔTURÉE.** Florian valide l'ensemble. Aucun
> écart remonté.

**Technique / Notes**
- Recette couverte (8 sections) : export nominal + en-tête (`exportedAt`/`userId`/`syncComplete`) ;
  complétude (données des 3 piliers retrouvées) ; **contenus perso avec leur nom** (via `*_translations`
  filtrées `owner_id`) ; pas d'éditorial ; soft-delete exclu ; hors-ligne ; avertissement synchro ; i18n FR/EN.
- Commit précédent : `fd15327`. CONF-01 close. **P0 conformité : 1.18 + 1.19 livrés & clôturés** ; restent
  CONF-03/04/05/06/07 + LANCE-01.

### 23/07/2026 — `feature/conf01-export-donnees` — CONF-01 : code livré (export des données, RGPD)

> Implémentation subagent-driven (5 commits `afc33c9`→`e197a46`). Revue finale code-reviewer → **1 point
> important trouvé et corrigé** (traductions perso). typecheck + lint + 812 tests shared + 73 mobile verts.
> Roadmap 1.18 → ✅. 100 % local, aucune migration.

**Ajouté**
- `packages/shared/src/data-export.ts` (+ test) : `buildExportEnvelope` (en-tête RGPD + sections) +
  `exportFileName` (daté), purs, testés Vitest.
- `apps/mobile/src/lib/data-export.ts` : `exportUserData(userId, syncComplete, t)` — lit **31 tables**
  possédées (`user_id`/`owner_id` = user + `deleted_at IS NULL`) de la base locale, assemble le JSON, écrit
  dans le cache et ouvre la feuille de partage (patron `gpx-export`). Noms de tables = constantes (pas
  d'injection) ; `userId` paramétré.
- Entrée Réglages « Exporter mes données » (section Données, au-dessus de la Zone de danger) : avertissement
  non bloquant si `!hasSynced`, indicateur de chargement, gestion d'erreur ; **pas** de désactivation
  hors-ligne (export local). i18n FR/EN (`settings.dataExport.*`, `account.export.*`).

**Modifié**
- `account.delete.exportHint` (CONF-02) : retrait de « bientôt disponible » → pointe vers Réglages → Export.

**Corrigé**
- Revue finale (important) : les **noms/instructions des contenus perso** vivent dans `*_translations`
  (exclues en bloc) → un exercice/aliment/programme perso s'exportait **sans son nom**. Ajout des 3 tables
  `*_translations` filtrées `owner_id = user` (l'éditorial `owner_id NULL` reste exclu). Complétude RGPD.

**Technique / Notes**
- Commit précédent (docs) : `f0ace6b`. **Reste** : recette device + relecture Damien.

### 23/07/2026 — `feature/conf01-export-donnees` — CONF-01 : maquette (DESIGN)

> Maquette HTML du flux d'export. 3ᵉ livrable réuni (spec ✅ + plan ✅ + design) → en attente de validation.

**Ajouté**
- `design/conf01/conf01.html` — 4 vues : entrée Réglages (section Données) → avertissement synchro non
  bloquant → génération locale + feuille de partage → structure du fichier JSON (en-tête + sections par table).

**Technique / Notes**
- Commit précédent : `868438b`. Prochaine étape : validation Florian/Damien → exécution (subagent-driven).

### 23/07/2026 — `feature/conf01-export-donnees` — CONF-01 : plan d'implémentation (PLAN)

> Plan TDD en 4 tâches (aucune migration/serveur). Revue subagent → **APPROUVÉ** (3 mineurs corrigés).

**Ajouté**
- `docs/plans/conf01-export-donnees.md` — 4 tâches : helper pur shared (`buildExportEnvelope`/`exportFileName`
  + tests) → orchestration `data-export.ts` (map `EXPORT_TABLES` des 28 tables + `getAll` filtré possession +
  `deleted_at IS NULL` → assemblage → écriture cache → `Sharing.shareAsync`) → entrée Réglages + i18n + maj
  `exportHint` → parité/clôture. Code concret, patron `gpx-export`.

**Technique / Notes**
- Revue de plan → APPROUVÉ ; corrigés : ajout `Alert` à l'import de `settings.tsx`, réutilisation de
  `useStatus()`/`useAuthStore` déjà importés (destructurer `hasSynced`), test `exportFileName` en date locale
  (robuste fuseau CI). Couverture des 28 tables + colonnes de possession vérifiée exacte contre le schéma.
- Commit précédent : `b415dee`. Prochaine étape : maquette → validation → code.

### 23/07/2026 — `feature/conf01-export-donnees` — CONF-01 : spec « Export des données » (SPEC)

> Cadrage (brainstorming Florian, 23/07) de l'export RGPD (roadmap 1.18) : export JSON de toutes les données
> perso, construit depuis la base locale PowerSync, hors-ligne, livré via feuille de partage. Aucune migration/
> serveur. Aucun code (spec seule).

**Ajouté**
- `docs/specs/functional/us/conf01-export-donnees.md` — spec complète : format JSON (en-tête + section par
  table), 28 tables exportées (filtre `user_id`/`owner_id` = user + `deleted_at IS NULL`, éditorial exclu),
  livraison patron `gpx-export` (write cache + `Sharing.shareAsync`), entrée Réglages, helper pur shared,
  avertissement `hasSynced`, i18n, cas limites, DoD, recette.

**Technique / Notes**
- Revue de spec par sous-agent → **CORRECTIONS REQUISES** (0 bloquant), corrigées (spec simplifiée) :
  possession **directe** sur les 28 tables (pas de jointure indirecte) ; ajout `deleted_at IS NULL` ; limite
  identité/e-mail (Supabase Auth) hors périmètre car non répliquée localement.
- Complément de CONF-02 ; `account.delete.exportHint` sera mis à jour (retrait « bientôt disponible »).
- Commit précédent : `b23ca30`. Prochaines étapes : plan → maquette → validation → code.

### 23/07/2026 — `feature/conf02-suppression-compte` — CONF-02 : recette validée & US clôturée (RECETTE)

> **RECETTÉE & VALIDÉE à 100 % par Florian (23/07/2026) ✅ → US CLÔTURÉE.** Florian valide l'ensemble
> (recette device + revue). Aucun écart remonté.

**Technique / Notes**
- Recette couverte (6 sections) : zone Danger + désactivation hors-ligne ; déclenchement + ré-auth mot de
  passe (mauvais mdp → aucune suppression) ; gate de récupération + annulation (données intactes) + se
  déconnecter ; **purge serveur J+30** (`purge_expired_accounts()` : compte purgé + cascade, exercice perso
  utilisé + compte admin ayant banni sans gel, contenu éditorial intact) ; **job pg_cron** planifié & actif ;
  i18n FR/EN.
- Commit précédent : `6a70089`. CONF-02 close ; V0.8 (conformité) entamée. Prochain candidat P0 : CONF-01
  (export RGPD), complément naturel.

### 23/07/2026 — `feature/conf02-suppression-compte` — CONF-02 : code livré (suppression du compte, RGPD)

> Implémentation subagent-driven (8 commits `2e06821`→`fc68ff7`) de la suppression de compte. Revue finale
> code-reviewer → **1 bug bloquant trouvé et corrigé** (sortie de la gate après annulation). typecheck + lint
> + 810 tests shared + 73 tests mobile verts. Roadmap 1.19 → ✅.

**Ajouté**
- **Migration cloud** (`20260723131921`, appliquée + `db:types` + registre) : table `account_deletion_requests`
  (RLS select-own, index unique partiel pending) + RPC `request_/cancel_account_deletion` (SECURITY DEFINER,
  scopées `auth.uid()`) + `purge_expired_accounts()` (résiliente par ligne) + **job pg_cron** quotidien +
  correctif FK `user_bans.acted_by` → `on delete set null`.
- `packages/shared` : route `'deletion-pending'` dans `resolveRootRoute` (champs `deletionCheckLoading?`/
  `deletionPending?` optionnels, prioritaire sur onboarding) + tests.
- `apps/mobile` : repository `account-deletion-repository` (query pending + RPC) ; actions `auth-store`
  (`reauthenticate`, `requestAccountDeletion` avec `disconnectAndClear`, `cancelAccountDeletion`) ; store
  partagé `deletion-store` (détection + `reset()`) ; écran `account-delete` (avertissement + ré-auth mot de
  passe) ; écran-gate `deletion-pending` ; zone « Danger » dans les Réglages (bouton désactivé hors-ligne) ;
  i18n FR/EN (`settings.dangerZone.*`, `account.delete.*`, `account.deletePending.*`).

**Corrigé**
- Bug bloquant (revue finale) : l'annulation depuis la gate ne réinitialisait pas la détection locale à
  `_layout` → utilisateur piégé sur la gate. Détection déplacée dans `deletion-store` (Zustand) + `reset()` à
  l'annulation → sortie effective.

**Technique / Notes**
- Détection keyée sur `session.user.id` (stable entre refreshes de token) ; fail-open hors-ligne ; hard delete
  via cascade FK ; `disconnectAndClear` réservé au chemin suppression. pg_cron activé sans geste dashboard.
- TODO restant (cas de bord, documenté) : signOut gracieux si compte purgé à distance (J+30).
- Commit précédent (docs) : `ea0eae6`. **Reste** : recette device (Florian) + relecture Damien.

### 23/07/2026 — `feature/conf02-suppression-compte` — CONF-02 : maquette (DESIGN)

> Maquette HTML du flux de suppression. 3ᵉ livrable réuni (spec ✅ + plan ✅ + design) → en attente de validation.

**Ajouté**
- `design/conf02/conf02.html` — 4 écrans : zone Danger (Réglages) → avertissement + ré-auth mot de passe →
  confirmation « suppression programmée » (déconnexion) → gate de récupération bloquant (Annuler / Se
  déconnecter) ; + note technique (pg_cron / cascade). Charte alignée, accent destructif rouge.

**Technique / Notes**
- Commit précédent : `aa1f331`. Prochaine étape : validation Florian/Damien → exécution (subagent-driven).

### 23/07/2026 — `feature/conf02-suppression-compte` — CONF-02 : plan d'implémentation (PLAN)

> Plan TDD en 7 tâches. Aucun code (plan seul). Revue subagent contre spec + code.

**Ajouté**
- `docs/plans/conf02-suppression-compte.md` — 7 tâches : migration serveur 🔴 (table + fix FK `acted_by` +
  RPC + `purge_expired_accounts` résiliente + pg_cron) → route `deletion-pending` (shared) → repository
  (query pending + RPC) → actions `auth-store` (reauth + request/cancel + `disconnectAndClear`) → détection +
  gate dans `_layout` → écrans (zone Danger, flux, gate) + i18n → clôture. Code SQL/TS concret, checkpoint cloud.

**Technique / Notes**
- Revue de plan par sous-agent → **CORRECTIONS REQUISES**, toutes corrigées : (bloquant 1) champs
  `deletionCheckLoading?`/`deletionPending?` de `resolveRootRoute` rendus **optionnels** (sinon typecheck
  rouge sur toute la fenêtre Task 2→5 : tests existants + appel `_layout`) ; (bloquant 2) détection keyée sur
  `session.user.id` + vérif unique par utilisateur (évite le flash/remontage du Stack à chaque refresh de
  token) ; (mineurs) `request_account_deletion` race-safe (`on conflict do nothing`), import repo aliasé dans
  le store, gate placé avant la garde anti-race.
- Commit précédent : `97218af`.
- **Prochaine étape** : maquette (flux + gate) → validation des 3 livrables → exécution (subagent-driven).

### 23/07/2026 — `feature/conf02-suppression-compte` — CONF-02 : spec « Suppression du compte » (SPEC)

> Cadrage (brainstorming Florian, 23/07) de la suppression de compte (RGPD + exigence stores, roadmap 1.19) :
> délai de grâce 30 j récupérable, double confirmation (avertissement + ré-auth mot de passe), purge serveur
> par cascade FK planifiée via pg_cron. Aucun code (spec seule ; pas de code avant validation des 3 livrables).

**Ajouté**
- `docs/specs/functional/us/conf02-suppression-compte.md` — spec complète : mécanisme serveur (table
  `account_deletion_requests`, RPC `request/cancel_account_deletion` SECURITY DEFINER, correctif FK
  `user_bans.acted_by` → `set null`, fonction `purge_expired_accounts()` résiliente par ligne + job pg_cron),
  verrou applicatif + fenêtre de récupération (gate à la reconnexion, prioritaire sur onboarding),
  parcours client (zone Danger, ré-auth `signInWithPassword`, `disconnectAndClear`), i18n, sécurité/RGPD,
  cas limites, DoD, critères de recette.

**Technique / Notes**
- Findings clés : toutes les tables user sont `ON DELETE CASCADE` → supprimer `auth.users` purge tout ;
  pg_cron absent (à activer, possiblement via dashboard). Purge = hard delete (droit à l'effacement).
- Revue de spec par sous-agent → **CORRECTIONS REQUISES**, toutes corrigées : (bloquant 1) `user_bans.acted_by`
  sans cascade + purge ensembliste tout-ou-rien → FK `set null` + purge résiliente par ligne ; (bloquant 2)
  API de purge locale nommée (`disconnectAndClear`). + gate offline fail-open, ordre gate > onboarding,
  `reauthenticate()` inadapté, signOut gracieux si purge à distance.
- **🔴 Dépendance externe** : activation de `pg_cron` sur le cloud (geste dashboard possible).
- Commit précédent : `fc5dc84`.
- **Prochaines étapes** : plan → maquette (flux + gate) → validation → code.

### 23/07/2026 — `feature/muscf13b-vignette-onboarding` — MUSC-F13 (+ F13b) : recette device validée (RECETTE)

> **RECETTÉE & VALIDÉE à 100 % (Florian, 23/07/2026) ✅** — les 3 niveaux d'affichage de la séance et la
> vignette d'onboarding sont validés sur device (9 sections de recette). Reste : relecture Damien.

**Technique / Notes**
- Recette couverte : réglage + défaut Normale + persistance/synchro ; onboarding (étape 4/4 + vignette
  schématique) ; matrice des champs par niveau (Simplifiée / Normale / Détaillée) ; nature d'exercice
  (durée / poids de corps) jamais masquée ; changement de niveau **en direct** pendant une séance ;
  non-destructivité (RPE/note masqués puis réaffichés intacts) ; i18n FR/EN.
- Aucun écart remonté. Commit précédent : `abd4589`.

### 23/07/2026 — `feature/muscf13b-vignette-onboarding` — MUSC-F13b : vignette d'aperçu par niveau à l'onboarding

> Suite MUSC-F13 (retour Florian) : l'étape d'onboarding « niveau d'affichage » montre désormais un **aperçu
> visuel schématique** par niveau, pour que l'utilisateur voie « à quoi ça ressemble ». typecheck + lint +
> 73 tests mobile (70 + 3) verts.

**Ajouté**
- `apps/mobile/src/components/workout/WorkoutLevelPreview.tsx` (+ test) : mini-illustration décorative pilotée
  par `workoutFieldVisibility(level)` (même source de vérité que la carte) — barre de titre + rangée de
  pastilles des suppléments visibles au niveau (🔥 💡 Types RPE 📝 ⇄) + barres « champs cœur ». Purement
  présentationnelle, masquée à l'accessibilité (décorative). 3 smoke tests (aucune pastille en Simplifiée →
  toutes en Détaillée).

**Modifié**
- `(onboarding)/displayLevel.tsx` : chaque option affiche la vignette sous le libellé + description.
- `design/muscf13/muscf13.html` : aperçu onboarding mis à jour avec les vignettes schématiques.

**Technique / Notes**
- Forme retenue (brainstorm Florian) : schématique légère (Views RN, pas d'asset image) → offline, léger,
  charte respectée. Commit précédent : `739a172`.
- **Reste** : recette device (Florian) + relecture Damien.

### 23/07/2026 — `feature/muscf13-niveaux-affichage-seance` — MUSC-F13 : code livré (3 niveaux d'affichage de la séance)

> Implémentation subagent-driven (8 commits `a00ae2f`→`87880df`) de MUSC-F13 : la carte « série en cours »
> (`CurrentSetCard`) s'affiche à 3 densités selon le niveau choisi par l'utilisateur. Revue finale
> **PRÊT À MERGER** (0 bloquant). typecheck + lint + 807 tests shared + 70 tests mobile verts.

**Ajouté**
- `packages/shared/src/workout-display.ts` (+ test) : enum `WORKOUT_DISPLAY_LEVELS`, `workoutDisplayLevelSchema`,
  `coerceWorkoutDisplayLevel` (NULL/inconnu → `normal`), `workoutFieldVisibility(level)` (matrice pure des
  champs supplémentaires visibles) — fonctions pures, couverture Vitest exhaustive.
- Colonne cloud `profiles.workout_display_level` (migration `20260723100835`, appliquée + `db:types` +
  `column.text` PowerSync ; `profiles` en `select *` → pas de redéploiement sync rules).
- Champ `workoutDisplayLevel` dans le Zod `ProfileRow` + mapping repository (coercion dans `rowToProfile`).
- Prop `level` sur `CurrentSetCard` : gating de delta/suggestion/🔥 (normal+) et types/RPE/note/superset
  (détaillée) ; nature d'exercice (durée/poids de corps) jamais masquée ; consigne du plan visible partout,
  seul le badge d'écart gaté. 3 smoke tests jest-expo (un par niveau).
- Réglage « Niveau d'affichage de la séance » dans les Réglages (sélecteur en cartes, sélection immédiate).
- Étape d'onboarding « niveau d'affichage » inconditionnelle (compteur 3→4, insérée entre objectif et récap).
- i18n FR/EN : `workout.displayLevel.*`, `settings.workoutDisplayLevel.*`, `onboarding.displayLevel.*` (parité stricte).

**Modifié**
- `workout.tsx` lit `profile.workoutDisplayLevel` (via `useProfile`, défaut `normal`) et le transmet à la carte.

**Technique / Notes**
- Défaut `normal` ; masquer un champ n'efface aucune donnée (RPE/note/type persistés réapparaissent en
  Détaillée) ; changement de niveau réactif en séance (pas de remontage — `key` sans `level`).
- Périmètre Muscu strict : `workout-summary`, historique, `ExerciseList`, Running non touchés.
- Commit précédent (docs) : `ae2aff6`.
- **Point ouvert (mineur)** : l'étape d'onboarding livre libellé + description par niveau (conforme à la
  maquette validée) ; un aperçu visuel/vignette par niveau reste à confirmer avec Florian.
- **Reste** : recette device (Florian) + relecture Damien.

### 23/07/2026 — `feature/muscf13-niveaux-affichage-seance` — MUSC-F13 : maquette (DESIGN)

> Maquette HTML des 3 niveaux d'affichage de la carte de séance. Aucun code applicatif. Complète le 3ᵉ livrable
> du workflow (spec ✅ + plan ✅ + design) → en attente de validation Florian/Damien avant code.

**Ajouté**
- `design/muscf13/muscf13.html` — carte « série en cours » aux 3 niveaux côte à côte (Simplifiée / Normale /
  Détaillée) avec annotations « + xxx » du supplément par niveau, matrice de synthèse, et aperçus de l'étape
  d'onboarding (compteur 4/4) + de l'entrée Réglages. Charte alignée sur les maquettes sœurs (refonte-muscu-c*).

**Technique / Notes**
- Commit précédent : `2c89e70`.
- **3 livrables réunis** (spec + plan + maquette) → prochaine étape : **validation Florian/Damien**, puis
  exécution du plan (subagent-driven).

### 23/07/2026 — `feature/muscf13-niveaux-affichage-seance` — MUSC-F13 : plan d'implémentation (PLAN)

> Plan TDD en 9 tâches bornées pour MUSC-F13. Aucun code applicatif (plan seul ; le code ne démarre qu'après
> validation des 3 livrables spec → plan → maquette). Revue par sous-agent contre spec + code réel.

**Ajouté**
- `docs/plans/muscf13-niveaux-affichage-seance.md` — plan complet : structure des fichiers, 9 tâches
  (shared enum/coercition → matrice de visibilité → migration cloud 🔴 → champ profil + mapping repo →
  gating `CurrentSetCard` → câblage `workout.tsx` → réglage Réglages → étape onboarding → parité i18n/clôture),
  code concret, commandes, points de test, checkpoint cloud.

**Technique / Notes**
- Revue de plan par sous-agent → **CORRECTIONS REQUISES** (1 bloquant + 3 mineurs), **toutes corrigées** :
  (bloquant) réordonnancement — l'ajout du champ à `profileRowSchema` est regroupé avec le mapping
  `rowToProfile` dans la **même tâche/commit** pour éviter un typecheck mobile rouge (TS2741) ; (mineurs)
  `flexDirection:'row'` inline sur le sélecteur Réglages, note i18n de test rectifiée (`import '@/i18n'`, pas de
  mock i18n dans le setup jest), coercition couverte via le test shared.
- Commit précédent : `42b8d80`.
- **Prochaine étape** : maquette (3 aperçus de niveaux, Claude Design) → validation Florian/Damien des 3
  livrables → exécution du plan (subagent-driven).

### 23/07/2026 — `feature/muscf13-niveaux-affichage-seance` — MUSC-F13 : spec « Niveaux d'affichage de la séance » (SPEC)

> Cadrage (brainstorming Florian, 23/07/2026) d'une nouvelle US promue depuis [IDEAS.md](IDEAS.md) :
> adapter la densité de l'écran de séance muscu au niveau de l'utilisateur via **3 niveaux d'affichage**
> — **Simplifiée** (débutant), **Normale** (intermédiaire/confirmé), **Détaillée** (avancé) — pilotant la
> visibilité des champs de `CurrentSetCard`. Aucun code applicatif (spec seule ; pas de code avant
> validation des 3 livrables spec → plan → design).

**Ajouté**
- `docs/specs/functional/us/muscf13-niveaux-affichage-seance.md` — spec fonctionnelle complète :
  matrice des champs par niveau (§2.1), règles fines (§2.2 : nature d'exercice jamais masquée, consigne
  vs delta, échauffement dès Normale, masquer ≠ effacer), réglage synchronisé `profiles.workout_display_level`
  (défaut `normal`, coercition NULL→normal dans le repository), étape d'onboarding inconditionnelle
  (compteur 3→4), entrée Réglages, migration additive, i18n FR/EN, offline, DoD + critères de recette.

**Technique / Notes**
- Décisions de cadrage : réglage **profil seulement** (pas de bascule en séance) ; « dernière fois » aux
  3 niveaux ; RPE en Détaillée uniquement ; périmètre **Musculation**.
- Revue de spec par sous-agent contre le code réel → **APPROUVÉ** (0 correction bloquante) ; 5 imprécisions
  de rédaction corrigées (patron Réglages `Segment`/`Switch` + sélecteur en cartes ; chaîne `NEXT` onboarding
  et `TOTAL_STEPS` unique ; coercition côté repository, pas Zod ; `profiles` en `select *` → pas de
  redéploiement sync rules ; ajout de `useProfile` dans `workout.tsx` signalé).
- Commit précédent : `399d950`.
- **Prochaines étapes** : plan d'implémentation → maquette (3 aperçus de niveaux, Claude Design) → validation
  Florian/Damien → code.

### 23/07/2026 — `fix/modales-exo-tronquees` — CI : timeout Jest sur `edit-exercise-modal-smoke` (CORRECTIF)

> Retour CI GitHub : le suite `EditExerciseModal — smoke` échouait par **timeout de 5000 ms** sur
> son premier test. Diagnostic (débogage systématique) : pas un bug du code — le composant est
> correct et rapide (même rendu en 30 ms au 2ᵉ test). Le 1ᵉʳ test paie tout le coût de **démarrage à
> froid** (transformation Babel + arbre React Native + init react-i18next + safe-area) dans son corps
> chronométré. En CI le cache de transformation Jest n'est pas persisté (seul npm est mis en cache) et
> le runner est à 2 cœurs, donc chaque run est « à froid » : mesuré à **4114 ms** en local à froid
> (`--no-cache`), au-delà en CI → dépassement du défaut de 5 s. 16 suites / 67 tests verts.

**Corrigé**
- [jest.config.js](apps/mobile/jest.config.js) : `testTimeout` relevé à **15000 ms**. Levier minimal
  visant la cause (budget par défaut trop juste pour un premier rendu lourd à froid), sans masquer un
  éventuel vrai blocage (un deadlock serait toujours détecté), et bien en deçà du plafond de 15 min du job.

**Technique / Notes**
- Pistes complémentaires non retenues (non nécessaires) : mettre en cache le dossier de cache Jest dans
  le workflow, ou fixer `--maxWorkers`. Le relèvement du timeout suffit à fiabiliser la CI.

### 23/07/2026 — `fix/modales-exo-tronquees` — Modales exo création/édition tronquées (CORRECTIF)

> Retour recette Florian : les modales de **création** (MUSC-F11) et d'**édition** (MUSC-F12) d'exercice
> perso étaient tronquées en bas — boutons Annuler/Ajouter·Enregistrer sous la barre de gestes, sans
> indice qu'il fallait scroller. typecheck/lint verts, 67 tests mobile.

**Corrigé**
- [CreateExerciseModal.tsx](apps/mobile/src/components/exercises/CreateExerciseModal.tsx) +
  [EditExerciseModal.tsx](apps/mobile/src/components/exercises/EditExerciseModal.tsx) : les boutons
  passent dans un **pied de page fixe** (toujours visible, séparateur), les champs défilent au-dessus
  (`ScrollView` `flexShrink`), et la **safe-area basse** est respectée (`useSafeAreaInsets` →
  `paddingBottom`). Plus de troncature, boutons toujours atteignables.

**Technique / Notes**
- Ajout du mock `react-native-safe-area-context` dans [jest.setup.ts](apps/mobile/jest.setup.ts)
  (sinon `useSafeAreaInsets` lève « No safe area value available » en tests).

### 23/07/2026 — `feature/muscf12-coherence-fiche-exo-perso` — MUSC-F12 : cohérence fiche exo perso ↔ bibliothèque (CODE LIVRÉ)

> Retour recette F10c (Florian). Rend la fiche d'un exo perso cohérente avec un exo bibliothèque en
> rendant **instructions + muscles secondaires** éditables, via une **modale d'édition bottom-sheet**
> (remplace le formulaire inline). **Aucune migration.** typecheck/lint verts, 67 tests mobile + 800 shared.

**Ajouté**
- `EditExerciseModal` ([EditExerciseModal.tsx](apps/mobile/src/components/exercises/EditExerciseModal.tsx)) :
  bottom-sheet (patron `CreateExerciseModal`) — nom, groupe, matériel, **muscles secondaires** (chips hors
  primaire), **instructions** (multiligne) ; pré-remplie ; clavier géré ; réinitialisation à la fermeture.
- Helper pur `buildCustomExerciseWrite` (muscles secondaires normalisés → JSON, instructions trim→null),
  testé ([custom-exercise-write.test.ts](apps/mobile/src/data/repositories/__tests__/custom-exercise-write.test.ts)).
- i18n FR/EN : `exercises.detail.instructionsPlaceholder`.

**Modifié**
- `updateCustomExercise` ([exercise-repository.ts](apps/mobile/src/data/repositories/exercise-repository.ts))
  gère désormais `musclesSecondary` + `instructions` (transaction atomique `exercises` + traduction ;
  invariant primaire ∉ secondaires via `normalizeSecondaryMuscles`).
- Fiche [exercises/[id].tsx](apps/mobile/src/app/exercises/%5Bid%5D.tsx) : **retrait du formulaire d'édition
  inline** (états `isEditing`/`edit*`, `onSave`, styles morts) ; le bouton **Modifier** ouvre la modale
  (`key={exercise.id}`). Lecture inchangée → une fiche perso peut être aussi riche qu'une biblio.

**Corrigé**
- `EditExerciseModal` : `saving` figé après enregistrement (bouton bloqué à la réouverture) + saisies
  annulées persistantes → `close()` réinitialise l'état depuis l'exercice (revue de code finale).

**Technique / Notes**
- Sérialisation `muscles_secondary` en `JSON.stringify` (symétrique de la lecture `parseJsonColumn`, F10c-1).
- Aucune migration (colonne `muscles_secondary` existe ; RLS `exercises_update` autorise déjà le propriétaire).
- Création (MUSC-F11) volontairement laissée **minimale** (nom + groupe) ; la richesse se fait à l'édition.

### 23/07/2026 — `feature/muscf11-modale-creation-exo` — MUSC-F11 : création d'exercice perso en modale (CODE LIVRÉ)

> Finition UX (retour recette F10c, Florian). La création d'exercice perso passe de la **card inline**
> (effet « sandwich », Segment multi-ligne, nom sans placeholder) à une **modale bottom-sheet**.
> Exécution subagent-driven (2 tâches). **Aucune migration.** typecheck/lint verts, 62 tests mobile.

**Ajouté**
- Composant [CreateExerciseModal.tsx](apps/mobile/src/components/exercises/CreateExerciseModal.tsx) :
  bottom-sheet (patron `ExerciseFilterDrawer`) — titre, champ **Nom** (avec placeholder), groupe
  musculaire en `Segment` **`scrollable`**, boutons Annuler/Ajouter, `KeyboardAvoidingView`, reset à la
  fermeture ; métier inchangé (`addCustomExercise`). Smoke test.
- i18n FR/EN : `exercises.createTitle`, `exercises.customNamePlaceholder`.

**Modifié**
- [exercises.tsx](apps/mobile/src/app/exercises.tsx) : le bouton « Créer un exercice perso » ouvre la
  **modale** ; suppression de la card inline (`creating`/`newName`/`newMuscle`/`onCreate`/`createBox`) et
  des styles morts.

**Technique / Notes**
- Corrige 3 défauts de recette : effet sandwich, sélecteur de groupe qui débordait sur plusieurs lignes
  (`scrollable`), champ nom qui paraissait vide (placeholder). Finition de la fonctionnalité 3.16
  (Exercice personnalisé). Point 1 du retour recette (cohérence fiche biblio VS perso) = US séparée à venir.

### 22/07/2026 — `feature/muscf10c2-variantes-alternatives` — MUSC-F10c-2 : variantes / alternatives d'exercice (CODE LIVRÉ)

> 2ᵉ et dernier incrément de F10c (= MUSC-F2). Exécution **subagent-driven** (5 tâches ; revue de code
> finale transverse *rien de bloquant*). **Une migration** (nouvelle table + `alter publication`) + **⚠️
> redéploiement manuel des sync rules dans le dashboard PowerSync** (geste humain, à faire avant recette
> device). typecheck/lint verts, **800 tests shared + 54 tests mobile**. Commit précédent : `9f68e38`.
> **Reste : redéploiement sync rules + recette (admin éditorial, mobile perso) + relecture Damien.**

**Ajouté**
- BDD : table `exercise_variants` (liaison **symétrique** canonique `a<b`, `owner_id` null=éditorial global /
  non-null=perso) + RLS (`is_content_editor` pour l'éditorial, `owner_id = auth.uid()` pour le perso) +
  `alter publication powersync` — migration
  [20260722151024_muscf10c2_exercise_variants.sql](supabase/migrations/20260722151024_muscf10c2_exercise_variants.sql)
  (poussée sur le cloud, cochée dans [MIGRATIONS.md](supabase/MIGRATIONS.md)) ; `column.text` PowerSync ;
  `database.types.ts` régénéré.
- Sync rules : `exercise_variants` ajouté aux buckets `shared_content` (éditorial) et `user_data` (perso)
  dans [powersync-sync-rules.yaml](docs/specs/technical/powersync-sync-rules.yaml) — **à redéployer manuellement**.
- `packages/shared` : `canonicalPair(a, b)` (tri de paire, pur) + `exerciseVariantRowSchema` — tests Vitest.
- Mobile : repository [exercise-variant-repository.ts](apps/mobile/src/data/repositories/exercise-variant-repository.ts)
  — `useExerciseVariants` (lecture éditorial + perso, dédup priorité éditoriale via `dedupeVariants` pure
  testée), `addExerciseVariant`/`removeExerciseVariant` (**upsert par clé naturelle** : réactive une ligne
  soft-deletée → anti-bug d'unicité), gardes de portée (`assertOwnsVariant`).
- Mobile : section **« Variantes / alternatives »** sur la fiche (liens cliquables → fiche liée, ✕ sur les
  liens perso, bouton « + Ajouter une variante ») + nouveau mode **`pickVariant`** du sélecteur d'exercices
  (exclut soi + déjà liés ; branche traitée avant le garde séance active).
- Admin : gestion des liens **éditoriaux** (biblio↔biblio) dans `ExerciseEditScreen` (recherche + chips
  supprimables) via [data/exercise-variants.ts](apps/admin/src/data/exercise-variants.ts) ; journalisation
  d'audit (`exercise_variant.link`/`unlink` ajoutés à `AUDIT_ACTIONS`).
- i18n FR/EN : `exercises.detail.variants/variantsEmpty/addVariant/removeVariant` (mobile) + libellés admin.

**Technique / Notes**
- Symétrie : stockage canonique `a<b` (contrainte `check`) + unique `(owner_id, a, b) nulls not distinct` ;
  lecture par extrémité (`a=self OR b=self`), résolution de « l'autre » exo (nom langue → fr).
- Anti-bug (leçon `exercise_favorites`) : l'ajout **réactive** une ligne soft-deletée au lieu d'insérer
  (sinon violation d'unicité au ré-ajout) — appliqué mobile **et** admin.
- Offline-first : lecture mobile locale réactive ; écriture perso locale (UUID client, soft-delete) ; admin
  en ligne (supabase-js).
- **Rattrapage** : spec + plan de **F10c-1** (non commités lors de sa clôture) ajoutés au passage.
- Roadmap : **3.20** (Variantes/alternatives) ⬜ → ✅. Remplacement en séance (3.32) reste distinct.

### 22/07/2026 — `feature/muscf10c1-muscles-secondaires` — MUSC-F10c-1 : muscles secondaires sur la fiche exercice (CODE LIVRÉ)

> 1ᵉʳ des 2 incréments de F10c (= MUSC-F2) : **F10c-1 (muscles secondaires)** → F10c-2 (variantes, plus tard).
> Exécution **subagent-driven** (4 tâches TDD ; revue de code finale transverse *rien de bloquant*). **Une
> migration additive** (ajout de colonne, table déjà répliquée PowerSync → pas de changement de sync rule).
> typecheck/lint verts, **796 tests shared + smoke fiche mobile**. Commit précédent : `6e1b713`.
> **Reste : recette (admin saisie + fiche affichage) + relecture Damien.**

**Ajouté**
- BDD : colonne `exercises.muscles_secondary jsonb not null default '[]'` — migration
  [20260722140518_muscf10c1_exercises_muscles_secondary.sql](supabase/migrations/20260722140518_muscf10c1_exercises_muscles_secondary.sql)
  (poussée sur le cloud, cochée dans [MIGRATIONS.md](supabase/MIGRATIONS.md)) ; `column.text` dans le schéma
  PowerSync ([schema.ts](apps/mobile/src/powersync/schema.ts)) ; `database.types.ts` régénéré.
- `packages/shared` : fonction pure `normalizeSecondaryMuscles(input, primary)` (dédup, exclut le primaire, filtre
  les valeurs invalides ; entrée non-tableau → `[]`) + `musclesSecondary` sur `exerciseRowSchema` — 7 tests Vitest
  ([exercise.ts](packages/shared/src/exercise.ts)).
- Admin : multi-sélecteur **« Muscles secondaires »** (cases hors muscle primaire, retrait auto au changement de
  primaire) dans [ExerciseEditScreen.tsx](apps/admin/src/screens/ExerciseEditScreen.tsx) ; lecture/écriture de
  `muscles_secondary` dans [data/exercises.ts](apps/admin/src/data/exercises.ts) ; libellé FR `secondaryMusclesLabel`.
- Mobile : ligne **« Muscles secondaires »** sur la fiche (mode lecture, si non vide ; libellés `muscle.*` séparés
  par « · ») ([exercises/[id].tsx](apps/mobile/src/app/exercises/%5Bid%5D.tsx)) ; `musclesSecondary` porté par
  `ExerciseDetail` (lecture via `parseJsonColumn` + `normalizeSecondaryMuscles`, **détail seulement** — liste et
  filtre MUSC-F3 intacts) ([exercise-repository.ts](apps/mobile/src/data/repositories/exercise-repository.ts)).
- i18n FR/EN : `exercises.detail.secondaryMuscles` ; réutilise `muscle.*` / `groupNames`.
- Tests : 2 smoke tests fiche (ligne présente + libellés résolus / absente si vide).

**Technique / Notes**
- Sérialisation : écriture admin = tableau JS → `jsonb` natif (supabase-js, pas de double-encodage) ; lecture
  mobile = `column.text` → `parseJsonColumn` → `normalizeSecondaryMuscles` (garde de forme + exclusion primaire).
- Invariant **primaire ∉ secondaires** garanti en triple : UI admin (filtre + purge), écriture admin, lecture mobile.
- Filtre MUSC-F3 **inchangé** (matche le muscle primaire seul — décision Florian). Schéma corporel SVG = 6.2 (séparé).
- Roadmap : **3.19** (Muscles ciblés) 🟡 → ✅.

### 22/07/2026 — `feature/muscf10b-records-fiche-exercice` — MUSC-F10b : section records sur la fiche exercice (CODE LIVRÉ)

> 2ᵉ des 3 incréments du chantier « fiche exercice » (F10a livré → **F10b** → F10c/MUSC-F2). Exécution
> **subagent-driven** (6 tâches ; chacune revue spec + revue qualité ; 2 correctifs intégrés en cours ; revue
> finale transverse *prête à merger*). **Aucune migration**, lecture seule. typecheck/lint verts, **789 tests
> shared + 50 tests mobile**. Commit précédent : `360c6ed`. **Reste : recette device + relecture Damien.**

**Ajouté**
- `packages/shared` : fonction pure `pickOneRepMax(real, estimated)` + type `OneRepMaxSample` (3 tests) — choisit
  le 1RM **réel** si présent, sinon l'**estimé** ([records.ts](packages/shared/src/records.ts)).
- Mobile : `useExerciseTopSingle(id)` (1RM réel = charge max d'une série à **1 rep** validée, hors warmup/durée,
  jointe à une séance terminée avec `finished_at` non nul pour la date) + `useExerciseFicheRecords(id)` (composite
  1RM/charge max/volume + dates) dans [records-repository.ts](apps/mobile/src/data/repositories/records-repository.ts).
- Fiche : section **« Tes records »** en tuiles (mode lecture) — 1RM (réel/estimé + badge), charge max, meilleur
  volume, chacun label · valeur · date (JJ/MM/AAAA) ; état vide ; lien **« Voir la progression »** →
  `/progress?exerciseId=…` ([exercises/[id].tsx](apps/mobile/src/app/exercises/%5Bid%5D.tsx)).
- i18n FR/EN : `exercises.detail.records.*` (title/oneRepMax/real/estimated/seeProgression) ; réutilise
  `progress.records.type.*` + `progress.records.empty`.

**Modifié**
- [progress/index.tsx](apps/mobile/src/app/progress/index.tsx) : pré-sélection de l'exercice via le param
  `exerciseId` (valeur dérivée `pickedExercise ?? paramExercise` — évite un `useEffect`/`setState` interdit par la
  règle lint `react-hooks/set-state-in-effect`) ; sans param → comportement inchangé.

**Technique / Notes**
- Décisions : poids via `units.formatWeight` (métrique/impérial), volume via `toFixed(0)` (sans unité, comme
  /progress) ; dates JJ/MM/AAAA ; le 1RM **réel prime** sur l'estimé dès qu'une série à 1 rep existe (décision
  cadrage) → **à signaler en recette** : la fiche peut afficher un 1RM réel **inférieur** au 1RM estimé de
  l'écran Progression (deux mesures différentes).
- **Dette notée** (non bloquant, non aggravée) : composant records partagé /progress↔fiche différé (spec §7) ;
  réutilisation i18n cross-namespace ; formateur de date JJ/MM/AAAA dupliqué entre écrans (candidat à un util
  partagé, chore transverse séparé) ; smoke fiche ne couvre que l'état vide des records.
- Roadmap **inchangée** : les records par exercice ne correspondent pas à une ligne roadmap dédiée.

### 22/07/2026 — `feature/muscf10b-records-fiche-exercice` — plan d'implémentation (MUSC-F10b)

> Suite de la spec (commit précédent `57caa8b`). Plan revu par le subagent `plan-document-reviewer` (Approved —
> colonnes SQL du 1RM réel, `useExerciseRecords`/`achievedAt`, `/progress` en état local sans param,
> `useUnits.formatWeight`, clés i18n et export barrel de `pickOneRepMax` vérifiés contre le dépôt) ; 1 précision
> d'import ajoutée (`useEffect` dans /progress). **Doc seulement, aucun code.**

**Ajouté**
- [muscf10b-records-fiche-exercice.md](docs/plans/muscf10b-records-fiche-exercice.md) : plan en 6 tâches TDD —
  (1) `pickOneRepMax` pur (shared) ; (2) `useExerciseTopSingle` (1RM réel dérivé de `workout_sets`) +
  `useExerciseFicheRecords` (composite) ; (3) i18n FR/EN ; (4) `/progress` param `exerciseId` (pré-sélection) ;
  (5) section tuiles + lien « Voir la progression » sur la fiche ; (6) revue finale + clôture. Aucune migration,
  lecture seule.

### 22/07/2026 — `feature/muscf10b-records-fiche-exercice` — spec : section records sur la fiche exercice (MUSC-F10b)

> 2ᵉ des 3 incréments du chantier « fiche exercice » (F10a livré → **F10b** → F10c/MUSC-F2). Cadrée par
> brainstorming (Florian, maquette comparée → mise en page **tuiles**). Claims code vérifiés (colonnes
> `workout_sets`/`workouts` pour la dérivation 1RM réel, `useExerciseRecords` renvoie `achievedAt`, `/progress`
> en état local sans param, clés i18n `progress.records.*` FR/EN, aucune migration). Revue subagent interrompue
> par la limite d'usage hebdomadaire → **vérification faite manuellement**. **Doc seulement, aucun code.**

**Ajouté**
- [muscf10b-records-fiche-exercice.md](docs/specs/functional/us/muscf10b-records-fiche-exercice.md) : spec —
  section « Tes records » en **tuiles** sur la fiche (mode lecture) : **1RM** (réel si une série à 1 rep existe,
  sinon estimé + badge), **charge max**, **meilleur volume**, chacun avec sa date. 1RM réel dérivé de
  `workout_sets` (reps=1, validé, hors warmup/durée) ; fonction pure `pickOneRepMax` (réel sinon estimé). Lien
  **« Voir la progression »** → écran Progression pré-sélectionné (extension `/progress` : param `exerciseId`).
  Réutilise `useExerciseRecords` + `units.formatWeight` + clés `progress.records.*`. Aucune migration, lecture seule.

**Technique / Notes**
- Hors périmètre : muscles secondaires/variantes (F10c), courbes sur la fiche (lien seul), composant records
  partagé /progress↔fiche (dette notée).
- **Statut : spec validée (Florian) → prochaine étape plan d'implémentation** (à dérouler après réinitialisation
  de la limite d'usage hebdomadaire si nécessaire).

### 22/07/2026 — `feature/muscf10a-bibliotheque-fiche-exercice` — MUSC-F10a : bibliothèque en accès direct + fiche exercice (CODE LIVRÉ)

> 1ᵉʳ des 3 incréments du chantier « fiche exercice » (F10a socle → F10b records → F10c/MUSC-F2 muscles
> secondaires). Exécution **subagent-driven** du plan (8 tâches ; chacune revue spec + revue qualité ; 3
> correctifs intégrés en cours : jest env central + throw si traduction absente, a11y de l'étoile, gestion
> d'erreur/anti-double-submit sur Enregistrer ; revue finale transverse *prête à merger*). **Aucune migration.**
> typecheck/lint verts, **786 tests shared + 50 tests mobile** (dont 2 nouvelles suites). Commit précédent : `3f7a1dd`.
> **Reste : recette device + relecture Damien.**

**Ajouté**
- **Entrée « Bibliothèque d'exercices »** persistante dans le hub Muscu
  ([strength.tsx](apps/mobile/src/app/%28tabs%29/strength.tsx), hors grille de widgets) → ouvre l'écran biblio
  en **mode parcours** (`/exercises?mode=browse`).
- **Écran fiche exercice** ([app/exercises/[id].tsx](apps/mobile/src/app/exercises/%5Bid%5D.tsx), route
  enregistrée dans `_layout.tsx`) : nom, groupe musculaire, matériel (si renseigné), instructions (si
  présentes), badge « perso », favori ⭐ (a11y `accessibilityLabel`/`accessibilityState`) ; états chargement +
  introuvable.
- **Gestion des exos perso** sur la fiche (custom uniquement) : **Modifier** (nom + groupe + matériel via
  `Segment` scrollable avec sentinelle « aucun » → null) et **Supprimer** (Alert de confirmation → retour biblio).
- Repository ([exercise-repository.ts](apps/mobile/src/data/repositories/exercise-repository.ts)) :
  `useExercise(id)` + type `ExerciseDetail`, `assertOwnedCustomExercise` (garde pure testée),
  `updateCustomExercise` (transaction atomique, lève si traduction absente), `deleteCustomExercise`
  (**soft-delete de la ligne `exercises` seule** — jamais les traductions, pour préserver le nom sur
  l'historique/les programmes).
- i18n FR/EN (parité) : `exercises.library` + `exercises.detail.*` (12 clés).
- Tests : `exercise-guard.test.ts` (garde, 4 cas) + `exercise-detail-smoke.test.tsx` (écran, 2 cas).

**Modifié**
- [exercises.tsx](apps/mobile/src/app/exercises.tsx) : **mode parcours** (`mode=browse` → tap ouvre la fiche) ;
  comportement d'ajout/remplacement en séance **strictement inchangé**.
- [jest.setup.ts](apps/mobile/jest.setup.ts) : défauts `EXPO_PUBLIC_SUPABASE_*` (jest ne charge pas `.env`) →
  les tests peuvent importer les vrais repos/écrans sans lever au chargement.

**Technique / Notes**
- Décisions : suppression d'exo perso **toujours autorisée** (soft-delete, pas de blocage si référencé) ;
  références orphelines dans programmes/templates conservées (nom toujours résolu, traductions vivantes) ;
  fiche accessible **uniquement** depuis la biblio en mode parcours (autres points d'entrée différés).
- **Note pour F10b** (records sur la fiche) : le recalcul des records
  ([records-repository.ts](apps/mobile/src/data/repositories/records-repository.ts)) fait un `JOIN exercises …
  deleted_at IS NULL` (INNER) → un exo perso soft-deleted serait exclu du recalcul futur (sans incidence F10a).
- **Dette notée** (non bloquant) : `Pressable` étoile favori dupliqué entre `exercises.tsx` et la fiche (→ futur
  `FavoriteStar`/`ExerciseListRow` partagé, avec MUSC-F2) — la copie de la fiche est la meilleure (a11y).
- **Points de recette device** : navigation hub → biblio parcours → fiche (route `exercises/[id]` en modal
  empilée) ; modifier/supprimer un exo perso ; vérifier que l'historique/les programmes affichent toujours le
  nom d'un exo perso supprimé ; i18n FR/EN.
- Roadmap **inchangée** : la fiche complète (3.13/3.19/3.20, muscles secondaires + variantes) relève de F10c —
  non livré ici, donc pas de bascule de statut.

### 22/07/2026 — `feature/muscf10a-bibliotheque-fiche-exercice` — plan d'implémentation (MUSC-F10a)

> Suite de la spec (commit précédent `d3f4907`). Plan revu par le subagent `plan-document-reviewer` (Approved —
> API `writeTransaction`, helpers `_sql`, forme des SELECT et symboles importés vérifiés contre le dépôt) ;
> 1 coquille corrigée (ne pas importer `patch`, le code utilise `tx.execute` brut → sinon import inutilisé =
> lint KO). **Doc seulement, aucun code.**

**Ajouté**
- [muscf10a-bibliotheque-fiche-exercice.md](docs/plans/muscf10a-bibliotheque-fiche-exercice.md) : plan en
  8 tâches TDD — (1) `useExercise(id)` ; (2) `update/deleteCustomExercise` + garde pure testée ; (3) i18n FR/EN ;
  (4) écran fiche lecture `app/exercises/[id].tsx` + route ; (5) gestion perso (modifier/supprimer) ; (6) mode
  parcours dans `exercises.tsx` (tap → fiche) ; (7) entrée « Bibliothèque » dans le hub Muscu ; (8) revue finale
  + clôture. Aucune migration ; soft-delete de la ligne `exercises` seule. Point à smoke-checker : coexistence
  de route `exercises.tsx` + `exercises/[id].tsx` (supportée expo-router 57, sans précédent dans le repo).

### 22/07/2026 — `feature/muscf10a-bibliotheque-fiche-exercice` — spec : bibliothèque en accès direct + fiche exercice (MUSC-F10a)

> Nouvelle US issue du besoin remonté pendant la recette MUSC-F3 (l'écran bibliothèque n'est atteignable que
> depuis une séance en cours). Cadrée par brainstorming (Florian). **1ᵉʳ des 3 incréments** du chantier « fiche
> exercice » : **F10a** (socle) → **F10b** (records sur la fiche) → **F10c = MUSC-F2** (muscles secondaires +
> variantes, migration + admin). Spec revue par le subagent `spec-document-reviewer` : **1 point bloquant
> corrigé** (le soft-delete ne doit toucher que la ligne `exercises`, pas les traductions — sinon le nom se vide
> sur les écrans d'historique/programmes qui résolvent le nom via `exercise_translations`), puis **Approved**.
> **Doc seulement, aucun code.**

**Ajouté**
- [muscf10a-bibliotheque-fiche-exercice.md](docs/specs/functional/us/muscf10a-bibliotheque-fiche-exercice.md) :
  spec complète — entrée persistante « Bibliothèque d'exercices » dans le hub Muscu → écran biblio en **mode
  parcours** (param de route ; tap → fiche, mode séance inchangé) → nouvel écran **fiche `/exercises/[id]`** (nom,
  groupe, matériel, instructions, favori, badge perso) → **gestion des exos perso** (Modifier + Supprimer,
  soft-delete **de la ligne `exercises` seule** toujours autorisé). Aucune migration. Records et muscles
  secondaires explicitement hors périmètre (F10b/F10c).

**Technique / Notes**
- Décisions de cadrage : entrée hub non masquable ; suppression d'exo perso toujours autorisée (pas de blocage si
  référencé) ; fiche accessible uniquement depuis la biblio en mode parcours (autres points d'entrée différés).
- Note pour F10b consignée dans la spec : `records-repository.ts` calcule les records via un `JOIN exercises …
  AND e.deleted_at IS NULL` (INNER) → un exo perso soft-deleted serait exclu du recalcul futur des records.
- **Statut : spec validée (Florian) → prochaine étape plan d'implémentation.**

### 22/07/2026 — `feature/muscf3-recherche-multicriteres` — MUSC-F3 : recherche d'exercices multi-critères (CODE LIVRÉ)

> Roadmap [3.14](docs/roadmap/roadmap.md) 🟡 → ✅. Exécution **subagent-driven** du plan (10 tâches,
> chacune passée par revue spec + revue qualité ; revue finale transverse *prête à merger*). Filtre
> par **groupe musculaire** et **matériel** (liste contrôlée) dans les 2 surfaces de recherche
> d'exercices, en plus de la recherche par nom. 🔴 **Migration cloud appliquée** (`db:push` sur
> `nsxzflxsgovriwwvflxe`, registre coché). typecheck/lint verts, **786 tests** (dont 5 nouveaux).
> **Reste : recette device + relecture Damien.** Commit précédent : `556b0a0`.

**Ajouté**
- `packages/shared` : fonction pure `buildExerciseFilterClause(muscles?, equipment?)` →
  `{ clause, params }` (fragment SQL paramétré : **OU** intra-facette via `IN`, **ET** inter-facette),
  5 tests Vitest ([exercise-filter.ts](packages/shared/src/exercise-filter.ts)). L'enum `EQUIPMENTS`
  (8 valeurs, posé dès US1 mais jamais branché) est désormais **réellement consommé**.
- Mobile : composant partagé [ExerciseFilterDrawer.tsx](apps/mobile/src/components/programs/ExerciseFilterDrawer.tsx)
  (tiroir bas d'écran `Modal transparent`, 2 sections de chips groupe musculaire + matériel,
  fermer = appliquer, bouton Réinitialiser, a11y `accessibilityRole`/`accessibilityState` sur les chips).
- Mobile : bouton **« Filtres · N »** + montage du tiroir + affichage du matériel dans la ligne
  d'exercice (`{muscle} · {matériel}`) + **état vide filtré dédié** (« Aucun résultat pour ces
  filtres » + raccourci Réinitialiser) dans [ExercisePicker.tsx](apps/mobile/src/components/programs/ExercisePicker.tsx)
  **et** [exercises.tsx](apps/mobile/src/app/exercises.tsx).
- i18n mobile FR/EN (parité) : `equipment.*` (8 clés) + `exercises.filters` / `emptyFiltered` /
  `filterDrawer.{muscleSection,equipmentSection,reset,close}`.
- Admin : sélecteur `<select>` matériel contraint à `EQUIPMENTS` (remplace le texte libre) +
  libellés FR `equipmentNames` ([ExerciseEditScreen.tsx](apps/admin/src/screens/ExerciseEditScreen.tsx)).
- Migration [20260722080703_muscf3_equipment_check.sql](supabase/migrations/20260722080703_muscf3_equipment_check.sql) :
  contrainte `CHECK` sur `exercises.equipment` (colonne déjà nullable — aucune colonne ajoutée,
  donc pas de `db:types`). Seed dev : matériel plausible sur les 16 exercices de bibliothèque.

**Modifié**
- Mobile : `useExercises(search?, muscles?, equipment?)` — 2 paramètres optionnels câblés dans la
  requête SQLite via `buildExerciseFilterClause` ; rétrocompatible (appelants existants inchangés,
  `useFavorites` non touché) ([exercise-repository.ts](apps/mobile/src/data/repositories/exercise-repository.ts)).
- Admin : types `equipment` resserrés à `Equipment | null` (data layer + formulaire).

**Technique / Notes**
- **Dette / suivi** (relevé en revue finale, non bloquant) : duplication résiduelle entre les 2
  écrans (bouton Filtres, état vide, sous-titre 3 parties, styles) → candidate à un futur
  `ExerciseListRow`/`FiltersButton` partagés (à traiter avec MUSC-F2) ; `ExerciseListItem.equipment`
  encore typé `string | null` côté mobile (pourrait suivre la contrainte DB en `Equipment | null`).
- **Points de recette device** : tiroir empilé sur une `Modal pageSheet` (comportement Android du
  bouton retour / barre de statut à vérifier) ; inset bas (barre gestuelle) sous le tiroir ;
  découvrabilité de la fermeture (croix explicite non rendue — tap-outside + geste natif + backdrop
  labellisé en place ; §2.1 la liste comme option). Exercice perso créé sans matériel → invisible si
  un filtre matériel est actif (conforme spec §2.3/§4.4, observation UX).

### 22/07/2026 — `feature/muscf3-recherche-multicriteres` — plan d'implémentation : recherche d'exercices multi-critères (MUSC-F3)

> Suite de la spec (commit précédent `a9a8558`). Plan revu par le subagent `plan-document-reviewer`
> (Approved dès la première passe — vérification croisée de chaque référence de code contre l'état
> réel du dépôt) ; 2 ajustements mineurs appliqués suite aux recommandations (couleur de texte des
> chips sélectionnées `colors.accentText` au lieu de `colors.background` ; précision sur l'ajout de
> `flexDirection: 'row'` à `styles.searchRow`, absent aujourd'hui des deux écrans). **Doc seulement,
> aucun code** — typecheck inchangé (vérifié vert).

**Ajouté**
- [muscf3-recherche-multicriteres.md](docs/plans/muscf3-recherche-multicriteres.md) : plan en 10
  tâches TDD — (1) `buildExerciseFilterClause` pur (shared) ; (2) admin — matériel en `<select>`
  contrôlé (réutilise `EQUIPMENTS` déjà présent, jamais branché) ; (3) i18n mobile `equipment.*` +
  clés du tiroir ; (4) `useExercises` étendu (2 paramètres optionnels) ; (5) composant partagé
  `ExerciseFilterDrawer` (tiroir `Modal transparent`, aucune nouvelle dépendance) ; (6-7) intégration
  dans `ExercisePicker.tsx` et `exercises.tsx` ; (8) seed dev enrichi (16 exercices) ; (9) migration
  (contrainte `CHECK` sur `exercises.equipment`, checkpoint cloud avec vérification préalable des
  valeurs existantes + go explicite de Florian) ; (10) revue finale + clôture.

### 22/07/2026 — `feature/muscf3-recherche-multicriteres` — spec : recherche d'exercices multi-critères (MUSC-F3)

> Roadmap [3.14](docs/roadmap/roadmap.md) — recherche d'exercices aujourd'hui par nom seul. Cadrage par
> brainstorming (Florian, maquettes visuelles comparées) : sélectionné comme prochaine US après la clôture
> côté implémentation du chantier refonte Muscu (A/B/C1/C2/C3/D, reste relecture Damien). Commit précédent :
> `685dec9`. **Doc seulement, aucun code** — typecheck/lint/781 tests inchangés (vérifiés verts).

**Ajouté**
- [muscf3-recherche-multicriteres.md](docs/specs/functional/us/muscf3-recherche-multicriteres.md) : spec
  complète — filtre par groupe musculaire (déjà propre, enum contraint) + matériel (liste contrôlée
  réutilisant `EQUIPMENTS`/`Equipment` posés dès US1 dans `packages/shared` mais jamais branchés nulle
  part). UI = bouton « Filtres » + tiroir 2 sections (préféré aux chips inline permanentes et aux
  dropdowns, pour garder la recherche par nom comme action principale). Périmètre : `ExercisePicker`
  (composant partagé programme/template/séance) **et** `exercises.tsx` (bibliothèque autonome). Migration
  prévue : contrainte `CHECK` sur `exercises.equipment` (colonne déjà existante et nullable, aucune donnée
  à migrer — actuellement tout `null`). Hors périmètre : MUSC-F2 (fiche exercice complète, muscles
  secondaires), rétro-remplissage du matériel en production.

**Technique / Notes**
- `.gitignore` : ajout de `.superpowers/` (scratch local du brainstorming visuel, maquettes non versionnées).
- **Statut : à valider (Florian/Damien) avant tout code**, conformément au workflow spec → plan → design →
  validation → code.

### 22/07/2026 — `feature/couleurs-menu-toggle` — couleurs des menus, réintroduites avec un réglage on/off

> Retour sur le rollback `1ae20d4` (couleur d'accent par menu, commit original `751fa5d` du
> 20/07, jugée peu lisible en pratique). Demande de Florian : la remettre, mais cette fois
> **pilotable par un réglage** plutôt qu'imposée en permanence. Spec ajoutée :
> [compte-profil-onboarding.md §4.3](docs/specs/functional/compte-profil-onboarding.md).
> Commit précédent : `f169a4b` (revert de `1ae20d4`, conflit limité au CHANGELOG, résolu
> manuellement). typecheck/lint/781 tests verts. Reste : recette device.

**Ajouté**
- **Réglage « Activer les couleurs par menu »** ([settings.tsx](apps/mobile/src/app/settings.tsx),
  Réglages → Apparence) : `Switch` **off par défaut**. Off → accent unique (orange) sur tous les
  onglets, comportement inchangé par rapport à avant ce commit. On → pastilles de couleur par
  menu + bouton « Réinitialiser » (état restauré de `751fa5d`), visibles seulement si activé.
- `menu-accent-store.ts` : nouveau champ `enabled` (+ `setEnabled`), persisté en local device
  (`secureStorage`, clé `menu_accent_enabled`) au même titre que les couleurs — non synchronisé,
  aucune migration.
- i18n FR/EN : `settings.menuColors.enable`.

**Modifié**
- `useTheme.ts` : l'accent n'est surchargé par la couleur du menu actif que si `enabled` est vrai ;
  sinon la palette de base (accent unique) s'applique, comme avant `751fa5d`.
- [(tabs)/_layout.tsx](apps/mobile/src/app/%28tabs%29/_layout.tsx) : `tabBarActiveTintColor` par
  onglet passe par un helper `tabTint()` qui retombe sur `colors.accent` quand `enabled` est faux
  (les 4 couleurs `menuColors.*` n'étaient jusqu'ici pas gatées par le toggle — corrigé pour que
  « off » soit vraiment un accent unique partout, y compris sur la barre d'onglets).

### 22/07/2026 — `feature/couleurs-menu-toggle` — revert : rétablit la couleur d'accent par menu (751fa5d)

> Annule `1ae20d4` pour repartir de la base `751fa5d` avant d'y ajouter le toggle on/off
> (entrée suivante). `git revert 1ae20d4` propre — seul conflit sur ce CHANGELOG (entrées
> ajoutées depuis), résolu manuellement ; aucun conflit de code.

**Ajouté**
- **Couleur d'accent par menu** (état de `751fa5d`) : `menu-accent-store.ts`, `useMenuFocus.ts`,
  `useTheme.ts` (accent = couleur du menu actif), onglets `(tabs)/_layout.tsx`/`index.tsx`/
  `nutrition.tsx`/`running.tsx`/`strength.tsx`, `_layout.tsx` racine, section « Couleurs des
  menus » dans `settings.tsx` + clés i18n FR/EN.

### 22/07/2026 — `feature/refonte-muscu-d` — US-D : recette validée (Florian) ✅

> Chantier refonte Muscu (A/B/C1/C2/C3/D) **complet côté implémentation** : les 5 US sont livrées et
> recettées. Reste la relecture de Damien sur l'ensemble. Cette entrée regroupe aussi 2 fichiers documentaires
> non liés, en attente de commit, inclus ici à la demande de Florian plutôt que d'ouvrir une branche dédiée.
> Merge avec `dev` : intègre en parallèle le design riche des widgets (`feature/widgets-v2-dnd`, entrée
> suivante) — le widget « Mes templates » (US-D) a été réécrit sur les nouvelles primitives `WidgetFrame`/
> `Eyebrow`/`Metric` pour rester cohérent avec les 4 autres widgets muscu.

**Technique / Notes**
- US-D (templates de séance libre) : recette device validée après le correctif d'accès (widget dédié + fin du
  mode sélection, voir entrée précédente). Aucun code applicatif dans ce commit.
- `IDEAS.md` : ajout d'une idée déjà notée par Florian (21/07) — « 3 niveaux d'affichage pour la séance live
  (Simplifiée / Normale / Détaillée) », en attente de tri, non liée à US-D.
- `AGENTS.md.pre-codex-fallback.bak` : fichier de sauvegarde (racine), en attente, non lié à US-D.
- **Merge `dev` → widget « Mes templates »** : réécrit sur `WidgetFrame`/`Eyebrow`/`Metric` (au lieu de
  `WidgetShell`/`ModulePreviewCard`, abandonnés par le design riche) pour rester visuellement cohérent avec
  les widgets Programmes/Historique/Planning/Progression du hub muscu. Nouvelle clé i18n
  `widgets.strength.templatesEyebrow` (FR/EN). typecheck/lint/test re-vérifiés verts après réécriture.

### 21/07/2026 — `feature/widgets-v2-dnd` — widgets multi-formes au nouveau design (galerie « FitTrio · Widgets »)

> Demande Damien : « dev la partie Widgets » d'après le design mis à jour
> ([design/FitTrio - Widgets.dc.html](design/FitTrio%20-%20Widgets.dc.html)). Les **16 widgets ×
> 3 formes** (petit carré / rectangle / grand carré) passent d'un rendu sobre (en-tête + 1 ligne) au
> **langage visuel riche** de la galerie : anneaux, sparklines, mini-barres, barres par groupe,
> bande de 7 jours, carte panneau. typecheck workspace + mobile, lint (0 erreur), **44 tests** verts.
> Commit précédent : `751fa5d`. **Aucune migration** (UI pure). Recette device requise.
> Périmètre choisi par Damien : **les 16 widgets d'un coup** + branchement des données au fil.

**Ajouté**
- **Primitives visuelles SVG** ([primitives.tsx](apps/mobile/src/components/widgets/primitives.tsx),
  `react-native-svg`) : `RingGauge` (anneau de progression), `Sparkline` (courbe + zone dégradée),
  `MiniBars` (mini-barres verticales), `HBars` (barres horizontales étiquetées), `WeekDots` (bande
  de 7 jours). Légères, sans axes ni mesure de layout, suivent l'accent dynamique du menu actif.
- **Cadre + blocs de widget** ([WidgetFrame.tsx](apps/mobile/src/components/widgets/WidgetFrame.tsx)) :
  `WidgetFrame` (tons `card` / `warn` / `panel`), `Eyebrow` (sur-titre mono), `Chip` (pastille de
  tendance), `Metric` (gros chiffre + unité + sous-libellé).
- **Helper couleur** ([color-utils.ts](apps/mobile/src/theme/color-utils.ts)) : `withAlpha` /
  `hexToRgb` (surfaces teintées accent, dégradés de sparkline).
- **Tokens thème** ([colors.ts](apps/mobile/src/theme/colors.ts), light + dark) : `track`, `warn` /
  `warnBorder` / `warnText`, `panel` / `panelText` / `panelMuted`, `chartGreen`, `amber`.
- **Hook `useRecentStrengthRecords`** ([dashboard-repository.ts](apps/mobile/src/data/repositories/dashboard-repository.ts)) :
  liste owner-scopée des derniers records muscu (nom d'exercice résolu langue → fr) pour le grand
  carré Records récents.
- **i18n** : 60 clés FR + EN (eyebrows, sous-titres, unités, bannières) dans
  [fr.json](apps/mobile/src/i18n/locales/fr.json) / [en.json](apps/mobile/src/i18n/locales/en.json).
- **Design source** : [design/FitTrio - Widgets.dc.html](design/FitTrio%20-%20Widgets.dc.html)
  (maquette de référence des 16 widgets × 3 formes).

**Modifié**
- **9 widgets Accueil** (`dashboard/*.tsx`) refondus aux 3 formes : Séance du jour (carte panneau +
  bouton démarrer/reprendre), Résumé nutrition (anneau kcal + barres macro consommé/cible), Streak
  (bande 7 jours), Poids (sparkline + pastille de tendance), Records récents (hero + liste), Volume
  muscu (barres par groupe + bandeau groupe délaissé), Semaine running (mini-barres par jour), Alerte
  déficit (ton warn), Temps d'entraînement (anneau muscu/course + légende).
- **Widgets Muscu / Course** ([strength-widgets.tsx](apps/mobile/src/components/widgets/strength-widgets.tsx),
  [running-widgets.tsx](apps/mobile/src/components/widgets/running-widgets.tsx)) refondus aux 3 formes
  (Programmes, Historique, Planning via `PlanningPreview` réutilisé, Progression) ; abandon de
  `WidgetShell` / `ModulePreviewCard` / `DashboardCard` au profit de `WidgetFrame` + primitives.

**Technique / Notes**
- **Données branchées au fil** : `useNutritionSummary` + `macroGramsFromCalories` (cibles macro),
  `useMuscleBalance` (répartition + groupe délaissé), `useWeeklyVolumeComparison` (tonnage + variation),
  `useRunStats` / `useRunHistory` (semaine running, barres par jour), `useWeightEntries` (sparkline
  poids sur 6 semaines).
- **Dégradations gracieuses assumées** (données non encore branchées, pas d'invention) : % de semaine
  et liste de séances d'un programme (`ProgramListItem` = nom/durée/niveau) ; nom de séance + tonnage
  dans l'historique muscu (`WorkoutHistoryItem` = date/durée) ; splits/km + tracé GPS du grand carré
  Course (remplacés par une sparkline des distances récentes) ; objectif hebdo running.
- **Purity** : `Date.now()` déplacé hors du rendu (helpers `daysSince` / `countWithin7Days` au niveau
  module dans RecordRecentCard) pour respecter la règle `react-hooks/purity`.
- **StreakCard.test** : rendu adapté (nœuds texte isolés) pour garder le garde-fou « double-nombre » ;
  le test reste vert.
- **Non branché** : le bundling web (`expo export`) échoue sur `@powersync/op-sqlite` (module natif) —
  **préexistant**, sans rapport avec ce commit. Non committé : `design/.thumbnail`, `design/uploads/`
  (artefacts Claude Design hors périmètre).

### 22/07/2026 — `feature/refonte-muscu-d` — US-D : accès aux templates indépendant de « Séance libre »

> Retour recette (Florian) : le seul chemin vers « Mes templates » passait par le hub → « Séance libre » →
> « Depuis un template », qui ouvrait la liste en **mode sélection** (tap = démarrage direct d'une séance) —
> aucun moyen d'atteindre édition/duplication/suppression depuis l'app réelle (le mode normal existait dans le
> code mais n'était jamais atteignable). typecheck/lint/781+44 tests verts.

**Ajouté**
- **Widget « Mes templates »** ([strength-widgets.tsx](apps/mobile/src/components/widgets/strength-widgets.tsx),
  [widgets.ts](packages/shared/src/widgets.ts)) : nouvel id `strength-templates` sur le hub muscu, même patron
  que le widget « Mes programmes » — accès permanent, indépendant du flux « Séance libre ».
- i18n : `templates.countLabel_one`/`countLabel_other` (FR/EN).

**Modifié**
- [templates/index.tsx](apps/mobile/src/app/templates/index.tsx) : suppression du « mode sélection » — taper
  un template ouvre désormais **toujours** son détail (Démarrer explicite + Dupliquer + Supprimer), plus de
  lancement direct au tap.
- [strength.tsx](apps/mobile/src/app/%28tabs%29/strength.tsx) : les 2 liens vers `/templates?selectMode=1`
  redirigent simplement vers `/templates`.

### 21/07/2026 — `feature/refonte-muscu-d` — US-D : CODE LIVRÉ (templates de séance libre)

> Chantier refonte Muscu, dernière US (A/B/C1/C2/C3/D) — implémentation complète, 12 tâches (subagent-driven,
> 11 commits `a57ebb1`→`13d60b7`, revue spec+qualité à chaque étape + revue finale globale). Reste recette
> device + relecture Damien sur l'ensemble du chantier. typecheck/lint/781 tests (shared) + 44 tests (mobile)
> verts, parité i18n FR/EN stricte.

**Ajouté**
- **Migration cloud** (`20260721074949_refonte_muscu_d_workout_templates`, poussée) : tables
  `workout_templates`/`workout_template_exercises` (RLS `user_id`, soft delete), patron `meal_templates`.
  **Sync rules PowerSync déployées** (2ᵉ checkpoint cloud distinct du `db:push` — oubli identifié et corrigé
  dès la revue du plan, piège déjà rencontré en C3).
- **`deriveTemplateTargetsFromWorkoutSets`** ([workout.ts](packages/shared/src/workout.ts)) : fonction pure
  testée Vitest (6 cas) qui dérive les cibles d'un template depuis les séries **validées** d'une séance libre
  terminée (nombre de séries, reps/charge de la dernière validée, type de la première validée).
- **`workout-template-repository.ts`** (nouveau) : lecture réactive (`useWorkoutTemplates`/
  `useWorkoutTemplateDetail`) + CRUD complet (créer/renommer/ajouter-modifier-retirer un exercice, dupliquer,
  supprimer avec cascade) + `createTemplateFromWorkout` (enregistrer depuis une séance terminée) +
  `startWorkoutFromTemplate` (démarrer une séance libre pré-remplie, `planned_weight_kg` alimenté comme
  `startWorkoutFromSession`).
- **Écrans `templates/`** (liste « Mes templates » avec mode sélection depuis le hub, composition partagée
  `TemplateComposer`, détail avec Démarrer/Dupliquer/Supprimer).
- **Hub muscu** : le bouton « Séance libre » ouvre un choix (à blanc / depuis un template) ; lien secondaire
  « Ou depuis un template » sous la carte « Séance du jour » (jours de séance planifiée, sinon templates
  inaccessibles ce jour-là).
- **Écran résumé** : bouton « Enregistrer comme template » (séance libre terminée, au moins un exercice),
  formulaire inline (nom pré-rempli depuis la date **locale**).
- **`ExerciseTargetsFields`** ([components/exercise/](apps/mobile/src/components/exercise/ExerciseTargetsFields.tsx),
  nouveau) : composant présentation extrait d'`ExercisePlanEditor` (programmes), réutilisé par le nouveau
  `TemplateExerciseEditor` (templates) qui ajoute un 5ᵉ champ inédit — sélecteur de type de série (7 valeurs).

**Modifié**
- `workout-repository.ts` : `parseTargetReps` exporté (réutilisé par le nouveau repository) ;
  `WorkoutHistoryItem`/`SELECT_HISTORY`/`rowToHistoryItem` exposent désormais `sessionId`/`programId`
  (nécessaire pour masquer le bouton « Enregistrer comme template » sur une séance planifiée).

**Technique / Notes**
- Revues (spec compliance + qualité) à chaque tâche : corrections notables — garde `!detail` avant le footer
  d'actions de `templates/[id].tsx`, cohérence `push`/`replace` après démarrage, clé i18n dédiée pour le
  bouton Valider (au lieu de réutiliser le libellé du déclencheur), dérivation de date **locale** (pas un
  slice de chaîne ISO UTC) + garde `submitting`/`try-catch` sur l'enregistrement depuis le résumé.
- Revue finale globale (vue d'ensemble sur les 12 commits) : parcours de bout en bout vérifié cohérent
  (créer → composer → démarrer → terminer → ré-enregistrer), aucune rupture ni régression trouvée.

### 21/07/2026 — `feature/refonte-muscu-d` — US-D : spec + plan + maquette (templates de séance libre)

> Chantier refonte Muscu, dernière US (arbitrable). Corrige le problème 5 de l'audit-flux : pas de cran
> intermédiaire entre séance libre et programme structuré. Spec (2 passages de revue), plan (2 passages de
> revue — un oubli critique corrigé : sync rules PowerSync) et maquette validés par Florian. Aucun code
> applicatif dans ce commit (docs uniquement, conformément au workflow obligatoire).

**Ajouté**
- **Spec** [refonte-muscu-d-templates-seance-libre.md](docs/specs/functional/us/refonte-muscu-d-templates-seance-libre.md) :
  tables dédiées `workout_templates`/`workout_template_exercises` (patron repas types nutrition, **pas** de
  réutilisation `programs`/`sessions`/`exercise_plans`) ; deux chemins de création (composer à froid **et**
  enregistrer après coup depuis une séance libre terminée, cibles dérivées des séries **validées**
  uniquement) ; démarrer depuis un template (pré-remplissage `planned_weight_kg`, même convention que
  `startWorkoutFromSession`) ; gestion (éditer/dupliquer/supprimer). Liste séparée « Mes templates ». Hors
  périmètre : templates éditoriaux débutants (reportés), export/partage, lien automatique superset.
- **Plan** [refonte-muscu-d-templates-seance-libre.md](docs/plans/refonte-muscu-d-templates-seance-libre.md) :
  12 tâches — migration (🔴 2 checkpoints cloud distincts : `db:push` **et** déploiement sync rules
  PowerSync, piège identifié et corrigé pendant la revue) ; fonction pure testable Vitest
  `deriveTemplateTargetsFromWorkoutSets` (packages/shared) ; nouveau repository
  `workout-template-repository.ts` ; modifications connexes à `workout-repository.ts` (export
  `parseTargetReps`, `sessionId`/`programId` sur l'historique) ; refactor `ExercisePlanEditor.tsx` →
  composant présentation partagé `ExerciseTargetsFields.tsx` + nouveau `TemplateExerciseEditor.tsx` (5ᵉ champ
  inédit : sélecteur de type de série, 7 valeurs) ; écrans `templates/` (composant partagé `TemplateComposer`
  pour éviter la duplication entre édition et détail) ; intégration hub muscu (choix à blanc/template + lien
  secondaire les jours de séance planifiée) et écran résumé (« Enregistrer comme template »).
- **Maquette** [refonte-muscu-d.html](design/refonte-muscu-d/refonte-muscu-d.html) : 6 écrans (choix de
  démarrage, lien secondaire, liste, composition, détail + actions, enregistrement depuis le résumé).

**Technique / Notes**
- Branche `feature/refonte-muscu-d` créée depuis `dev`.
- Revue spec : 2 passages (❌ → ✅) — correction de la condition d'affichage du bouton « Enregistrer comme
  template » (champs `sessionId`/`programId` manquants sur l'historique), clarification du sélecteur de type
  de série (travail neuf, pas un refactor), ajout d'un accès template les jours de séance planifiée.
- Revue plan : 2 passages (❌ → ✅) — ajout du 2ᵉ checkpoint sync rules PowerSync (oubli qui aurait rendu les
  2 nouvelles tables muettes côté synchro cloud), clarification du partage des helpers de champs, extraction
  d'un composant `TemplateComposer` partagé.

### 20/07/2026 — `feature/widgets-v2-dnd` — couleur d'accent par menu (Accueil/Muscu/Course/Alim)

> Demande Damien : une couleur secondaire par onglet (au lieu de l'orange unique), personnalisable.
> typecheck + lint verts. **Aucune migration** (préférence locale device). Recette device requise.

**Ajouté**
- **Couleur d'accent par menu** ([menu-accent-store.ts](apps/mobile/src/stores/menu-accent-store.ts)) :
  4 couleurs (Accueil terracotta / Muscu bordeaux / Course bleu / Alimentation vert) par défaut,
  **personnalisables** dans les réglages. Préférence **locale device** persistée (`secureStorage`),
  non synchronisée → aucune migration.
- **Accent dynamique** ([useTheme.ts](apps/mobile/src/theme/useTheme.ts)) : `colors.accent` prend la couleur
  du **menu actif** (posé par chaque onglet au focus via `useMenuFocus` ; les écrans enfants héritent).
  Tout ce qui utilise `colors.accent` (boutons, liens, pastilles…) se teinte automatiquement par onglet.
- **Onglets** ([(tabs)/_layout.tsx](apps/mobile/src/app/%28tabs%29/_layout.tsx)) : l'onglet actif prend sa
  propre couleur (`tabBarActiveTintColor` par écran).
- **Réglages → « Couleurs des menus »** ([settings.tsx](apps/mobile/src/app/settings.tsx)) : choix par
  pastilles (8 teintes) pour chaque menu + réinitialisation. i18n FR/EN.

### 20/07/2026 — `feature/widgets-v2-dnd` — grille : compaction verticale (pas d'espace entre modules)

> Retour Damien : pas de lignes vides — si une ligne se vide, tout remonte. 762 tests verts.

**Modifié**
- **Compaction verticale** ([widgets.ts](packages/shared/src/widgets.ts)) : remplace la poussée-vers-le-bas.
  Après tout déplacement / redimensionnement (et au chargement), chaque widget **remonte** aussi haut que
  possible (colonne inchangée) sans chevauchement → **aucune ligne vide** entre les modules. Le module
  déplacé reste prioritaire (gagne le slot le plus haut de sa colonne). L'empilage vertical de deux petits
  carrés reste possible (une ligne où une seule colonne est occupée n'est pas « vide »). Tests : invariant
  « aucune ligne vide » + compaction précise.
- Le **reflow live** reflète désormais la compaction en direct (les modules remontent quand une place se libère).

### 20/07/2026 — `feature/widgets-v2-dnd` — reflow live pendant le glisser-déposer

> Retour Damien : voir les modules se déplacer en direct pendant le drag. typecheck + lint verts.
> **Recette device requise.**

**Modifié**
- **Reflow live** ([SortableWidgetGrid.tsx](apps/mobile/src/components/widgets/SortableWidgetGrid.tsx)) :
  pendant le déplacement, la disposition résultante est recalculée en continu (`moveWidgetToCell`) et
  **les autres modules glissent (animés) vers leur nouvelle case** en temps réel — plus seulement une
  case fantôme. Le module tiré suit le doigt ; la case d'atterrissage reste marquée discrètement.
- `active` (état « en cours de drag ») piloté **uniquement par les worklets** du geste (onStart/onFinalize),
  jamais par un effet → conforme à la règle reanimated (`react-hooks`), pas de conflit de valeur.

### 20/07/2026 — `feature/widgets-v2-dnd` — vrai quadrillage : placement par cases + collision

> Refonte du modèle de grille (retour Damien : « vrai quadrillage », deux petits carrés
> empilables). Logique pure testée (761 tests). typecheck + lint verts. **Recette device requise.**

**Modifié (re-architecture du moteur de widgets)**
- **Placement par coordonnées de grille** ([widgets.ts](packages/shared/src/widgets.ts)) : chaque widget
  porte `col`/`row` (au lieu d'un simple `order`) ; empreinte dérivée de la forme (`sizeSpan` : small
  1×1, wide 2×1, large 2×2). **Placement libre** (trous autorisés) → on peut empiler deux petits carrés
  dans la même colonne. `moveWidgetToCell` place puis **pousse vers le bas** les widgets chevauchés
  (résolution de collision, cascade bornée). `defaultScreenLayout`/`resolveScreenLayout` migrent l'ancien
  format (ordre + `full|compact`, sans grille) par premier emplacement libre (`firstFitAll`).
- **Rendu en grille absolue** ([WidgetGrid.tsx](apps/mobile/src/components/widgets/WidgetGrid.tsx)) :
  case unité = ½ largeur (hauteur de ligne = largeur de colonne).
- **Drag aimanté à la case** ([SortableWidgetGrid.tsx](apps/mobile/src/components/widgets/SortableWidgetGrid.tsx)) :
  appui long ~0,7 s, le widget suit le doigt, **case fantôme** accent en prévisualisation (aimantée,
  empreinte de la forme) ; drop → `moveToCell`. Cible calculée en JS depuis la position visuelle
  (translation), worklets sans appel JS synchrone.
- Repository : `reorder(index)` → `moveToCell(col,row)` ; `setSize`/`cycleSize` re-résolvent les
  collisions (agrandir peut chevaucher les voisins)
  ([widget-layout-repository.ts](apps/mobile/src/data/repositories/widget-layout-repository.ts)).

**Supprimé**
- Modèle de flux `packWidgets` / `moveWidget` (ordre → pavage) remplacé par la grille par coordonnées.

**Technique / Notes**
- À surveiller en recette : une carte `wide` riche (graphe/pastilles) dans une case d'**une** unité de
  haut peut déborder — ajuster la hauteur d'unité ou compacter le rendu `wide` si besoin.

### 20/07/2026 — `feature/widgets-v2-dnd` — fix crash : appui long sur un widget (worklet)

> Crash device reproduit puis corrigé (logcat : `[Worklets] Tried to synchronously call a Remote
> Function`). Rebuild APK release + réinstall sur appareil : OK. typecheck + lint verts.

**Corrigé**
- **Crash à l'appui long sur un module** en édition ([SortableWidgetGrid.tsx](apps/mobile/src/components/widgets/SortableWidgetGrid.tsx)) :
  les callbacks du geste `Pan` sont des **worklets** (thread UI) ; ils appelaient des fonctions JS
  (`toLocalX`/`toLocalY`) de façon synchrone → `Tried to synchronously call a Remote Function`. Désormais
  le worklet ne passe que des **primitives brutes** (coordonnées absolues) via `runOnJS` ; la conversion
  absolu → repère conteneur se fait **côté JS** dans `onUpdate`/`onEnd` du parent.

### 20/07/2026 — `feature/refonte-muscu-c3` — Recette : superset repensé (lien explicite, choix libre)

**Ajouté**
- **Table `workout_superset_pairs`** (migration `20260720200254`) : liaison superset explicite par séance
  (exercise_id_a ↔ exercise_id_b), RLS utilisateur, soft delete. Ajoutée au schéma PowerSync **et** aux sync
  rules (bucket `user_data`) dans le même lot.
- **`SupersetPickerModal`** ([SupersetPickerModal.tsx](apps/mobile/src/components/workout/SupersetPickerModal.tsx)) :
  dialogue listant les autres exercices de la séance (non terminés, non déjà appariés) pour choisir librement
  le partenaire — plus de contrainte d'adjacence.
- Repository : `useSupersetPairs` (map bidirectionnelle), `linkSupersetPair` (un exercice = un seul partenaire,
  rompt toute paire existante avant d'en créer une), `unlinkSupersetPair`.

**Modifié**
- **Mécanisme superset entièrement revu** (2 vagues de recette) : d'abord une action nommée « Lier avec {X} »
  mais toujours limitée à un exercice **adjacent** (jugé « pas intuitif »), puis **lien explicite** choisi
  librement dans un dialogue, valable pour **toute la séance**. `workout.tsx` cherche désormais le partenaire
  via la table (`findSupersetPartnerSet`), plus par adjacence. Le chip « Superset » du sélecteur de type est
  retiré (remplacé par l'UI dédiée sur la carte focus). `ExerciseList` affiche « 🔗 Superset avec {nom} » par
  exercice lié.
- i18n FR/EN : `workout.superset.{link,linked,orphaned,remove,pickerTitle,pickerEmpty}` (parité vérifiée).

**Technique / Notes**
- Migration cloud appliquée (go Florian). typecheck/lint verts, 778 tests verts, parité i18n 0/0.
- **Limite connue** (hors demande initiale, notée) : un `exercise_plan` marqué `superset` côté admin ne crée
  plus de paire automatique au démarrage d'une séance planifiée — seule la liaison en direct (dialogue)
  fonctionne. `set_type='superset'` reste dans l'enum mais n'est plus le mécanisme de liaison.
- **Rappel action manuelle** : les sync rules PowerSync (2 tables C3 : `exercise_notes` + `workout_superset_pairs`)
  doivent être **déployées dans le dashboard PowerSync** avant recette multi-appareils.

### 20/07/2026 — `feature/refonte-muscu-c3` — US-C3 : ajustements en direct (CODE LIVRÉ, subagent-driven)

**Ajouté**
- **Réorganiser les exercices restants** : flèches ↑/↓ + « Plus tard » (machine prise), limité aux exercices
  non entièrement validés ; les exercices terminés gardent leur position absolue
  ([ExerciseList.tsx](apps/mobile/src/components/workout/ExerciseList.tsx)).
- **Superset** : liaison positionnelle (2 exercices adjacents, même rang, tous deux `superset`) — la validation
  de la 1ʳᵉ série du couple bascule directement sur la série jumelle **sans repos** ; la 2ᵉ déclenche le repos
  normalement ([workout.tsx](apps/mobile/src/app/workout.tsx)). Chip réintégré dans le sélecteur de type.
- **Remplacer un exercice en direct** : réutilise le picker existant (`exercises.tsx`), qui exclut désormais les
  exercices déjà présents dans la séance ; seules les séries non validées basculent.
- **Note persistante par exercice** : nouvelle table `exercise_notes` (migration), éditable sur la carte focus,
  visible en lecture dans la liste.
- **Suggestion de progression** (RPE-aware) : aucune suggestion si la dernière fois comportait une série
  `failure` ou un RPE ≥ 8 ; adaptée au type (charge+reps / reps seules / durée).
- **Migration cloud** appliquée (`20260720121317`) : table `exercise_notes`.

**Modifié**
- `computeReorderedExerciseOrder`/`computeProgressionSuggestion` (fonctions pures, testées Vitest) ajoutées à
  [workout.ts](packages/shared/src/workout.ts) — réorganisation (renumérotation complète de l'`order_index`,
  correcte même après un `addSet` intercalaire) et règle de suggestion.
- `useLastPerformance` étendu (`setType`, `rpe`, `durationSeconds`) pour nourrir la suggestion.
- [TODO.md](TODO.md) : **C3** passée en `[~]` (code livré, reste recette + relecture Damien).

**Corrigé (revue finale)**
- **Bug bascule superset** : la bascule ciblait l'exercice partenaire mais retombait sur sa 1ʳᵉ série non
  validée (ex. échauffement) au lieu de la série jumelle au même rang. `focusOverride` porte désormais un rang
  optionnel — corrigé et retracé à la main.
- **🔴 Sync rules PowerSync** : la nouvelle table `exercise_notes` était absente de
  [powersync-sync-rules.yaml](docs/specs/technical/powersync-sync-rules.yaml) — sans cette ligne, une note
  n'aurait pas survécu à une resynchronisation complète (changement d'appareil, réinstallation). **Action
  manuelle requise** : coller le fichier mis à jour dans le dashboard PowerSync (Settings → Sync Rules) puis
  Deploy — non automatisable depuis le CLI, à faire par Florian/Damien avant la recette multi-appareils.

**Technique / Notes**
- 8 commits (cadrage + migration + shared + repository + superset + UI + câblage + correctifs de revue).
  typecheck/lint verts, **778 tests** shared verts, parité i18n 0/0.
- **Revue finale** (subagent) : 1 bloquant corrigé (sync rules), 1 important corrigé (bascule superset). 4
  points mineurs/nits documentés comme limites connues acceptées (course multi-appareils sur l'upsert de note ;
  contiguïté cosmétique après remplacement, auto-corrigée au prochain réordonnancement ; interaction dé-validation
  manuelle + superset en cours, cas marginal ; fenêtre transitoire de chargement du picker).
- **Reste** : recette device (Florian, **après déploiement des sync rules**) + relecture Damien. Chantier
  refonte Muscu (US-A/B/C1/C2/C3) ainsi complet côté implémentation.

### 20/07/2026 — `feature/refonte-muscu-c3` — US-C3 : spec + plan + maquette (ajustements en direct)

**Ajouté**
- **Spec fonctionnelle US-C3** ([refonte-muscu-c3-ajustements-live.md](docs/specs/functional/us/refonte-muscu-c3-ajustements-live.md)) :
  réorganiser les exercices restants + « Plus tard » (machine prise), **superset** (liaison positionnelle, repos
  différé après la paire), remplacer un exercice (picker existant filtré), **note persistante par exercice**
  (migration `exercise_notes`), **suggestion de progression** RPE-aware. Accès démo explicitement exclu
  (abandonné). Validée Florian.
- **Plan d'implémentation US-C3** ([refonte-muscu-c3-ajustements-live.md](docs/plans/refonte-muscu-c3-ajustements-live.md)) :
  13 tâches. Deux algorithmes à risque extraits en fonctions pures testables Vitest dans `packages/shared`
  (`computeReorderedExerciseOrder`, `computeProgressionSuggestion`). Validé Florian.
- **Maquette US-C3** ([refonte-muscu-c3.html](design/refonte-muscu-c3/refonte-muscu-c3.html)) : 4 écrans (note +
  suggestion sur la carte focus, liste avec réorganisation/remplacement, superset bascule sans repos, superset
  repos après la paire).

**Modifié**
- [TODO.md](TODO.md) : **C3** passée en `[~]` (spec/plan/maquette validés, implémentation lancée) ; date de MàJ.

**Technique / Notes**
- **Décisions de cadrage** : remplacement via le picker existant (pas de système de variantes) ; réorganiser +
  « machine prise » = un seul mécanisme (flèches ↑/↓, patron `moveEntry` nutrition) ; superset = liaison
  positionnelle sans nouvelle colonne ; suggestion de progression RPE-aware (pas de suggestion si `failure` ou
  RPE ≥ 8 la dernière fois).
- **Relectures intégrées** — spec : 3 bugs réels (algorithme de réorganisation supposait des blocs `order_index`
  contigus par exercice, faux dès `addSet` → renumérotation complète ; remplacement par un exercice déjà présent
  aurait fusionné deux groupes → exclu du picker ; colonne `note` `NOT NULL` incohérente avec l'API → rendue
  nullable). Plan : garde `active` à préserver dans `exercises.tsx`, annotation de type explicite de
  `useLastPerformance` à mettre à jour, dépendance Task 8→7 inutile retirée.
- **🔴 Migration cloud** (Task 1) à pousser sur **go explicite** : nouvelle table `exercise_notes`.
- Aucun code applicatif dans ce commit (livrables de cadrage uniquement).

### 20/07/2026 — `dev` (doc) — Décision : GIF/vidéos de démo exercices abandonnés

**Modifié**
- [docs/roadmap/roadmap.md](docs/roadmap/roadmap.md) : nouveau statut **❌ Abandonné** ajouté à la légende ; items
  **6.1** (GIF animé par exercice), **3.18** (affichage GIF fiche), **6.3** (accès démo pendant la séance) et
  **8.3** (upload média admin) passés ❌ avec remarque. Récapitulatif (compteurs + détail par version + colonne ❌)
  et décision bloquante « source des GIF » recalculés/résolus en conséquence. Autonomie Claude 🔴 ajustée (6.1 retiré).
- [docs/specs/functional/musculation.md](docs/specs/functional/musculation.md) : §3.3 renommée « Démonstrations
  visuelles (GIF/vidéo) — abandonné », contenu original conservé pour trace historique ; ligne « Démonstration »
  retirée du tableau §3.1 ; mention d'accès démo en séance retirée de §3.2.
- [docs/refonte-muscu/analyse-seance-en-cours.md](docs/refonte-muscu/analyse-seance-en-cours.md) : point 10 —
  « accès démo » barré, marqué abandonné, retiré du périmètre C3.
- [TODO.md](TODO.md) : MUSC-F1 clos (❌ abandonné) ; nouveau MUSC-F1b isolant les muscles ciblés sur schéma SVG
  (6.2, **sujet distinct**, reste ouvert) ; MUSC-F4 et la description de C3 (chantier refonte Muscu) perdent
  « accès démo en séance ».

**Technique / Notes**
- Décision produit (Florian + Damien, échange du 19-20/07/2026), pas de code touché. Périmètre jugé trop complexe
  (sourcing d'une base de GIF, hébergement, import en masse, upload admin) pour la valeur apportée.
- `media_url` (colonne `exercises`) **reste en base**, inutilisée — nullable et inoffensive, aucune migration de
  suppression jugée nécessaire. À rouvrir uniquement si le calcul valeur/effort change.
- **6.2 (muscles ciblés sur schéma SVG) n'est PAS concerné** : c'est un schéma corporel statique, pas un média
  animé — reste au backlog (MUSC-F1b).

### 20/07/2026 — `feature/refonte-muscu-c2` — US-C2 : saisie enrichie (CODE LIVRÉ, subagent-driven)

**Ajouté**
- **Types de séries** exposés sur l'écran de séance : sélecteur (Normale / Dropset / Échec / Durée / Poids de
  corps) + **raccourci 🔥 échauffement en 1 tap** ([CurrentSetCard.tsx](apps/mobile/src/components/workout/CurrentSetCard.tsx)).
  Nouvelles valeurs d'enum `dropset`/`failure` ([workout.ts](packages/shared/src/workout.ts)).
- **Saisie adaptée au type** : durée en **m:ss** (steppers ±5 s) pour `duration` ; champ charge « Lest » optionnel
  pour `duration`/`bodyweight`.
- **Charge planifiée vs réalisée** : snapshot `planned_weight_kg` figé au démarrage d'une séance de programme,
  « Prévu : X » + écart (=/▲/▼) sur la carte et dans l'historique.
- **RPE par série** (1-10, optionnel) masqué derrière « ＋ RPE » (sélecteur déplié), affiché dans la liste et
  l'historique. Colonne `workout_sets.rpe`.
- **Migration cloud** appliquée (`20260719230416`) : `rpe` + `planned_weight_kg` + assouplissement `CHECK
  set_type` sur `workout_sets` et `exercise_plans`.

**Modifié**
- **Records** : `computeWorkoutRecords` exclut désormais `duration` en plus de `warmup` (un gainage lesté ne crée
  pas de record « charge max ») ; `bodyweight` lesté reste éligible ([records.ts](packages/shared/src/records.ts)).
- **Résumé** : décompte de séries et d'exercices **exclut les échauffements** (+ mention « +N échauf. »)
  ([workout-summary.tsx](apps/mobile/src/app/workout-summary.tsx)).
- **`addSet`** ne recopie plus un échauffement (retombe sur `normal` + valeurs nulles) ;
  **`useLastPerformance`** exclut les warmup ([workout-repository.ts](apps/mobile/src/data/repositories/workout-repository.ts)).
- `records-repository.ts` : read dupliqué (historique détail) enrichi de `rpe`/`planned_weight_kg`.
- Admin : `setTypeNames` complété (dropset/échec) ([fr.ts](apps/admin/src/i18n/fr.ts)).

**Technique / Notes**
- 6 commits (`2fb692f` migration, `8b70636` shared, `1a50126` repos, `5bbbe0e` écran, `cbc4600` résumé/historique).
  typecheck racine vert, lint mobile vert (hors 4 warnings pré-existants), **765 tests** shared verts, parité i18n 0/0.
- **Revue finale** (subagent) : aucun bloquant, aucune régression C1. Points ouverts pour la recette : (1) écart
  prévu/réalisé affiché **en direct** sur la carte (conforme à la maquette validée, spec plus lâche) ; (2) mineur —
  série poids de corps sans lest : taper « − » écrit `weight_kg=0` → « × 0 kg » à l'historique (cas limite) ;
  (3) nit — pré-remplissage `lastPerf` légèrement désaligné si l'exercice intercale des échauffements (→ C3).
- **`expo export --platform web`** échoue sur `better-sqlite3` (limitation PowerSync-sur-web pré-existante, hors C2).
- Badges/chips sur l'accent du thème (la `Palette` n'expose pas de teintes par type) — distinction par emoji + libellé.
- **Reste** : recette device (Florian) + relecture Damien. Superset et suggestion de progression → **C3**.

### 20/07/2026 — `feature/refonte-muscu-c2` — US-C2 : spec + plan + maquette (saisie enrichie)

**Ajouté**
- **Spec fonctionnelle US-C2** ([refonte-muscu-c2-saisie-enrichie.md](docs/specs/functional/us/refonte-muscu-c2-saisie-enrichie.md)) :
  types de séries exposés (échauffement exclu du volume/records, durée, poids de corps, **dropset**, **échec**),
  **RPE par série** (1-10, optionnel), **charge planifiée vs réalisée** (snapshot `planned_weight_kg`). Superset
  renvoyé en C3. Validée Florian.
- **Plan d'implémentation US-C2** ([refonte-muscu-c2-saisie-enrichie.md](docs/plans/refonte-muscu-c2-saisie-enrichie.md)) :
  12 tâches, descente bas→haut (migration → shared → schema → repos → UI → i18n → vérif). Validé Florian.
- **Maquette US-C2** ([refonte-muscu-c2.html](design/refonte-muscu-c2/refonte-muscu-c2.html)) : 5 écrans (carte
  focus enrichie, variantes durée/poids de corps, liste à badges, résumé, historique). RPE masqué derrière « ＋ RPE ».
- **IDEAS** : idée « RIR en alternative au RPE par série (préférence profil) » (20/07/2026).

**Modifié**
- [TODO.md](TODO.md) : **C2** passée en `[~]` (spec/plan/maquette validés, implémentation lancée) ; date de MàJ.

**Technique / Notes**
- **Décisions de cadrage** : une seule US ; charge planifiée = colonne figée `planned_weight_kg` ; RPE/série 1-10
  distinct du ressenti global 5★ (C1) ; records excluent `warmup` **et** `duration`, `bodyweight` lesté éligible.
- **Relectures intégrées** — spec : read de séries **dupliqué** dans `records-repository.ts` à enrichir (sinon
  typecheck KO), décompte de séries du résumé n'excluait pas les échauffements, `useLastPerformance` doit exclure
  warmup. Plan : pas de script npm de parité i18n (contrôle node ad hoc), `addSet` ne recopie plus un échauffement.
- **🔴 Migration cloud** (Task 1) à pousser sur **go explicite** : `workout_sets.rpe` + `planned_weight_kg` +
  assouplissement du `CHECK set_type` sur `workout_sets` et `exercise_plans` (ajout `dropset`/`failure`).
- Aucun code applicatif dans ce commit (livrables de cadrage uniquement).

### 20/07/2026 — `feature/widgets-v2-dnd` — widgets v2 : glisser-déposer en grille + 3 formes par module

> typecheck + lint (0 erreur) + tests **verts**. **Aucune migration.** **Recette device requise**
> (drag & drop reanimated + remplissage des formes non vérifiables en statique).

**Ajouté**
- **Glisser-déposer 2D** ([SortableWidgetGrid.tsx](apps/mobile/src/components/widgets/SortableWidgetGrid.tsx)) :
  **appui long ~700 ms** → module soulevé (fantôme + tilt + ombre), **barre d'insertion** accent, dépôt libre
  dans la grille 2 colonnes (deux petits carrés côte à côte). Rectangles mesurés figés au démarrage → index
  d'insertion par hit-test ; écriture unique au drop. Remplace le tri 1 colonne du MVP.
- **Pastilles de coin** d'édition (œil = masquer, ◻/▭/▣ = forme) sur chaque cellule, pour tenir sur un petit carré.
- **3 formes par module** : les 9 widgets d'accueil ont désormais un `small` (chiffre clé qui **remplit** le carré),
  un `wide` (carte riche) et un `large` (visuel — pastilles / graphe / valeurs — qui **remplit** le grand carré),
  via [WidgetShell](apps/mobile/src/components/widgets/WidgetShell.tsx) (`onPress` rendu optionnel).

**Modifié**
- [WidgetGrid.tsx](apps/mobile/src/components/widgets/WidgetGrid.tsx) : mode édition branché sur `SortableWidgetGrid`.
- Spec [widgets-multiformes.md](docs/specs/functional/us/widgets-multiformes.md) §8bis (révision v2) + maquette v2.

**Supprimé**
- `SortableDashboard`, `DashboardWidgetRow`, `DashboardEditControls`, `DashboardCardCompact` (remplacés par
  la grille triable + `WidgetShell` ; plus référencés).

**Technique / Notes**
- Caveats assumés : `TodaySessionCard` en `large` réutilise le rendu riche `wide` (machine à états à 4 branches) ;
  les états « vide » en `large` retombent sur la carte standard (edge cases).

### 20/07/2026 — `feature/widgets-v2-dnd` — stats « semaine » → fenêtre glissante 7 jours

> typecheck + lint + tests **verts** (750, dont 3 nouveaux). **Aucune migration.** Parité i18n FR/EN.

**Modifié**
- **Toutes les stats « semaine en cours » raisonnent sur les 7 derniers jours glissants** (aujourd'hui + 6 jours ;
  « précédente » = J−14 à J−7), y compris les **tendances 8 semaines** (8 fenêtres glissantes). Remplace la
  semaine calendaire lundi→dimanche. Concerne `useMuscleVolumeThisWeek`, `useWeeklyVolumeComparison`,
  `useTrainingTime`, et `useTrainingNutritionCross`
  ([records-repository.ts](apps/mobile/src/data/repositories/records-repository.ts),
  [dashboard-repository.ts](apps/mobile/src/data/repositories/dashboard-repository.ts)).
- Libellés « cette semaine » → « 7 derniers jours » / « 7 j » (FR/EN).

**Ajouté**
- Helpers partagés `localMidnightDaysAgo` / `rollingWeekStarts` / `ROLLING_WEEK_DAYS`
  ([date.ts](packages/shared/src/date.ts)) + tests ([date.test.ts](packages/shared/src/date.test.ts)).

### 19/07/2026 — `docs/recette-c1-validee` — US-C1 : recette device validée

**Modifié**
- [TODO.md](TODO.md) : **US-C1** (chantier refonte Muscu) passée en `[x]` — **recette device validée par Florian
  le 19/07/2026** ✅ (après 2 vagues de correctifs recette + fix chevron repos). Reste la **relecture Damien**.

**Technique / Notes**
- Suivi uniquement (aucun code). Pas de changement de Statut roadmap (refonte d'existant). Suite du chantier :
  **spec C2** (types de séries + RPE par série + charge planifiée vs réalisée, avec migrations) puis **C3**.

### 19/07/2026 — `fix/refonte-muscu-c1-recette2` — recette C1 (2ᵉ vague, Florian)

**Ajouté**
- **Saisie manuelle du repos** : le libellé « X s » de la carte « série en cours » devient un **input**
  éditable (en plus des − / + 15 s) ([CurrentSetCard.tsx](apps/mobile/src/components/workout/CurrentSetCard.tsx)).
- **Chrono de repos repliable** : le repos plein écran gagne un bouton **Réduire** → **barre compacte en bas**
  (le compte à rebours continue de tourner, visible, et laisse la séance manipulable) ; tap sur la barre pour
  ré-agrandir ; Passer reste accessible ([RestOverlay.tsx](apps/mobile/src/components/workout/RestOverlay.tsx)).

**Modifié**
- **Couleurs** : le bordeaux `#6b0028` (perçu « alerte » + illisible en thème sombre) est remplacé par
  **`colors.accent`** (accent standard de l'app) pour les éléments **interactifs** du flux guidé : bouton
  **« Valider la série »**, **bordure** de la série/exercice en cours, bouton **« + Série »**. (L'écran de repos
  plein écran garde son fond bordeaux — non signalé.)

**Technique / Notes**
- Points recette n°1 (saisie repos), n°2 (repli chrono), n°3 & 4 (couleur). Offline-first ; aucune migration ;
  typecheck/lint/tests(746) verts ; parité i18n FR/EN (clé `workout.restCollapse` ajoutée).
- Option ouverte : « Valider » pourrait passer en **vert** (success) si l'accent terracotta reste trop chaud — 1 ligne.

### 19/07/2026 — `fix/refonte-muscu-c1-recette` — correctifs recette C1 (Florian)

**Corrigé**
- **Reps planifiées non affichées** : `startWorkoutFromSession` sème désormais `reps` depuis la cible du plan
  (`exercise_plans.target_reps`, 1er entier — « 8-12 » → 8) en miroir de la charge cible (helper `parseTargetReps`).
  Le champ reps d'une séance planifiée n'est plus vide.
- **Charge à virgule tronquée** dans la carte « série en cours » : input de charge élargi (padding réduit,
  boutons − / + 44→40) → « 52.5 » n'est plus rogné ([CurrentSetCard.tsx](apps/mobile/src/components/workout/CurrentSetCard.tsx)).
- **Étoiles affichées « RPE » dans l'historique** : le ressenti (5★, stocké dans `workouts.rpe`) était libellé
  « RPE » sur la liste et le détail d'historique → relabélisé **« Ressenti X / 5 »**
  ([history/index.tsx](apps/mobile/src/app/history/index.tsx), [history/[id].tsx](apps/mobile/src/app/history/%5Bid%5D.tsx),
  i18n FR/EN). (Le vrai **RPE par série** — échelle 1-10, distinct — viendra en C2.)

**Technique / Notes**
- Point recette n°3 (**charge planifiée vs réalisée par série**) = périmètre **C2** (volontairement différé) — non traité ici.
- Offline-first ; aucune migration ; typecheck/lint/tests(746) verts ; parité i18n FR/EN.

### 19/07/2026 — `feature/widgets-multiformes` — fix repas : réordonnancement + récupération des entrées orphelines

> typecheck + lint + tests **verts**, parité i18n FR/EN. **Aucune migration.** Vérif runtime device non effectuée.

**Ajouté**
- **Réordonnancement des repas** ([nutrition-meals.tsx](apps/mobile/src/app/nutrition-meals.tsx)) : flèches ↑↓ par repas.
  Le réordonnancement **conserve les clés** → aucune entrée du journal n'est orpheline (contrairement à
  supprimer/recréer un repas, contournement qui causait la perte).
- **Section « Autres »** ([nutrition.tsx](apps/mobile/src/app/%28tabs%29/nutrition.tsx)) : surface les entrées dont
  le repas n'existe plus (repas supprimé / renommé avec nouvelle clé) au lieu de les perdre silencieusement.
- **Déplacer une entrée vers un repas** : rangée « Déplacer vers » dans le détail d'une entrée + nouvelle fonction
  `reassignEntryMeal` ([journal-repository.ts](apps/mobile/src/data/repositories/journal-repository.ts)) — voie de
  retour des orphelines, utile aussi au quotidien.

**Corrigé**
- **Repas custom mal étiqueté (bug « deux collations »)** : un repas ajouté sans nom (clé technique `custom-<ts>`)
  s'affichait avec sa **clé brute** comme titre → l'utilisateur « ne retrouvait pas » sa 2ᵉ collation alors que les
  aliments y étaient. Fallback corrigé en **« Repas N »** ([nutrition.tsx](apps/mobile/src/app/%28tabs%29/nutrition.tsx)).

**Technique / Notes**
- i18n : `journal.meals.other`, `journal.detail.moveTo`/`moveToMeal`, `meals.moveUp`/`moveDown`.
- Les entrées déjà orphelines (repas perdus avant ce correctif) réapparaissent désormais sous « Autres ».

### 19/07/2026 — `feature/widgets-multiformes` — système de widgets multi-formes (accueil, muscu, course)

> Spec + plan + design **validés** (Damien). typecheck + lint + tests **verts** (747 tests shared, dont le
> nouveau socle). **Aucune migration SQL** (JSON multi-hubs rétro-compatible). Vérif runtime device non effectuée.

**Ajouté**
- **Socle partagé** ([widgets.ts](packages/shared/src/widgets.ts) + [widgets.test.ts](packages/shared/src/widgets.test.ts)) :
  3 formes `small`/`wide`/`large`, registres par hub, layout multi-écrans `{ screens }`, migration
  `full→wide`/`compact→small`, parseur rétro-compatible, `packWidgets` (grille 2 colonnes).
- **Repository** `useScreenLayout(screen)` ([widget-layout-repository.ts](apps/mobile/src/data/repositories/widget-layout-repository.ts)) :
  persistance des 3 dispositions dans la colonne existante `dashboard_layout`, sans migration SQL.
- **WidgetGrid** ([WidgetGrid.tsx](apps/mobile/src/components/widgets/WidgetGrid.tsx)) : grille 2 colonnes en
  affichage, 1 colonne triable en édition ; **sélecteur de forme à 3 états**
  ([DashboardEditControls](apps/mobile/src/components/dashboard/DashboardEditControls.tsx)).
- **Widgets muscu & course** ([strength-widgets.tsx](apps/mobile/src/components/widgets/strength-widgets.tsx),
  [running-widgets.tsx](apps/mobile/src/components/widgets/running-widgets.tsx)) issus des `ModulePreviewCard`
  existants, + `WidgetShell` (formes carrées) et `CustomizeButton`.
- **Hubs muscu & course** ([strength.tsx](apps/mobile/src/app/%28tabs%29/strength.tsx),
  [running.tsx](apps/mobile/src/app/%28tabs%29/running.tsx)) : carte d'action **épinglée hors grille** + bouton
  Personnaliser + grille de widgets.
- **Livrables** : spec [widgets-multiformes.md](docs/specs/functional/us/widgets-multiformes.md), plan
  [widgets-multiformes.md](docs/plans/widgets-multiformes.md), design `design/widgets-multiformes/`.

**Modifié**
- **Planning** ([PlanningPreview.tsx](apps/mobile/src/components/PlanningPreview.tsx)) : **7 prochains jours** (au
  lieu de la semaine en cours) + visuel **calendrier** (bande semaine en `small`, grille 7 colonnes en `wide`,
  grille + liste des prochaines séances en `large`).
- **Accueil** ([index.tsx](apps/mobile/src/app/%28tabs%29/index.tsx)) basculé sur le nouveau moteur ; les 9 widgets
  adaptés aux formes (`full→wide`, `compact→small`).
- **i18n** : namespace `widgets.customize.*` (libellés de formes) ; retrait de
  `home.customize.sizeCompact`/`sizeFull` (bascule binaire obsolète).

**Supprimé**
- `packages/shared/src/dashboard.ts` (+ test) et `apps/mobile/src/data/repositories/dashboard-layout-repository.ts`,
  remplacés par `widgets.ts` / `widget-layout-repository.ts`.

### 19/07/2026 — `feature/refonte-muscu-c1` — implémentation US Refonte-C1 (écran de séance guidé)

> Implémentation subagent-driven (9 commits `8586607`→`b369bee`), revue de code globale **sans bug bloquant**.
> typecheck + lint + tests **verts**, parité i18n FR/EN. **Aucune migration.**

**Ajouté**
- **Plomberie repo** ([workout-repository.ts](apps/mobile/src/data/repositories/workout-repository.ts)) : `sessionId`
  sur la séance active, `useSessionRest` (repos du plan par exercice), `useLastPerformance` (dernière perf),
  `setWorkoutFeedback`.
- **Composants** : [RestOverlay](apps/mobile/src/components/workout/RestOverlay.tsx) (repos plein écran),
  [CurrentSetCard](apps/mobile/src/components/workout/CurrentSetCard.tsx), [ExerciseList](apps/mobile/src/components/workout/ExerciseList.tsx).
- **Écran de séance refondu** ([workout.tsx](apps/mobile/src/app/workout.tsx)) : carte « série en cours »
  (dernière perf + steppers − / + 2,5 kg + pré-remplissage cible plan → dernière perf → série précédente),
  **valider = log + repos + avance**, **état de fin**, **keep-awake**, dialogue ✕ **Continuer / Pause /
  Abandonner** (2ᵉ confirmation), garde « Terminer » si 0 série. **Repos plein écran** (plan/90 s) + vibration
  (RN core) + Passer / +15 s + **éditable par exercice** (session). **Gestion des séries en direct** (liste
  dépliable) : **+ Série**, **supprimer**, **dé-valider** (sans relancer le repos).
- **Résumé éditable** ([workout-summary.tsx](apps/mobile/src/app/workout-summary.tsx)) : ressenti **5★**
  (`workouts.rpe` 1-5) + **note** via `setWorkoutFeedback`.

**Supprimé**
- Ancienne barre de repos basse + validation-toggle ; clé i18n morte `workout.rest`.

**Technique / Notes**
- Offline-first (écritures optimistes) ; `Vibration` RN core + `expo-keep-awake` déjà présent → **pas de rebuild**.
- Revue globale : 1 point DoD (dé-validation) + 1 régression (+ Série) relevés → **traités dans C1** (incrément
  gestion des séries, validé Florian) ; 2 mineurs (flash « 0 s » corrigé ; note persistée au `onBlur`).
- **Reste : recette device + relecture Damien.** Suite du chantier : **C2** (types de séries, RPE/série,
  charge planifiée-réalisée, migrations) puis **C3** (réorg, superset, remplacer, démo, suggestion).

### 19/07/2026 — `feature/refonte-muscu-c1` — maquette US Refonte-C1

**Ajouté**
- [design/refonte-muscu-c1/refonte-muscu-c1.html](design/refonte-muscu-c1/refonte-muscu-c1.html) : maquette des
  4 vues clés — carte « série en cours » (dernière perf + steppers) + liste repliée ; repos plein écran ; dialogue
  de sortie Continuer/Pause/Abandonner ; résumé éditable (ressenti 5★ + note). Design system app (muscu bordeaux).

**Technique / Notes**
- **Design uniquement** (aucun code). **Validée par Florian** → spec ✅ + plan ✅ + design ✅ : feu vert
  implémentation (subagent-driven, 6 tâches, **aucune migration**).

### 19/07/2026 — `feature/refonte-muscu-c1` — plan d'implémentation US Refonte-C1

**Ajouté**
- [docs/plans/refonte-muscu-c1-seance-live-coeur.md](docs/plans/refonte-muscu-c1-seance-live-coeur.md) :
  plan (6 tâches, aucune migration). **T1** plomberie repo (`sessionId` sur séance active, `useSessionRest`,
  `useLastPerformance`, `setWorkoutFeedback`) ; **T2** i18n ; **T3** composant `RestOverlay` ; **T4** refonte
  `workout.tsx` (carte focus + liste repliée + steppers + pré-remplissage cible plan → dernière perf → série
  précédente + valider=log+repos+avance + état de fin + keep-awake + dialogue ✕ Continuer/Pause/Abandonner) ;
  **T5** résumé éditable (ressenti 5★ + note) ; **T6** contrôle + revue. `Vibration` RN core (pas de rebuild).

**Technique / Notes**
- **Plan uniquement** (aucun code). Revue de plan (subagent) : 1 issue corrigée (règle de pré-remplissage des
  champs explicitée — `reps` seedé `null` par le plan → pré-rempli depuis la dernière perf) + affinages (typage
  `WorkoutDbRow.session_id`, imports `Alert`/`Vibration`, retrait clé morte `workout.rest`, `gestureEnabled` vérifié).
- Prochaine étape : **maquette** (3 vues : carte focus, repos plein écran, dialogue ✕) puis validation avant code.

### 19/07/2026 — `feature/refonte-muscu-c1` — spec US Refonte-C1 (écran de séance : cœur du flux guidé)

**Ajouté**
- [docs/specs/functional/us/refonte-muscu-c1-seance-live-coeur.md](docs/specs/functional/us/refonte-muscu-c1-seance-live-coeur.md) :
  spec de **C1** (1er des 3 sous-US d'US-C). Décisions (brainstorming Florian) : **carte « série en cours »
  (dernière perf + steppers − / +) + liste repliée** ; **valider = log + repos + avance auto** (pré-remplissage
  cible plan → dernière perf → série précédente) ; **repos plan/90 s plein écran + vibration + Passer/Prolonger +
  éditable par exercice (session)** ; **keep-awake** ; **✕ → Continuer / Pause / Abandonner** (2ᵉ confirmation) ;
  **Terminer** avec garde 0 série ; **résumé rendu éditable** (ressenti 5★ + note après coup). **Aucune migration**
  (réutilise `workouts.rpe`/`notes`).

**Technique / Notes**
- **Spec uniquement** (aucun code). Revue de spec (subagent) **Approved** ; 4 affinages intégrés : **Vibration
  RN core** (pas d'`expo-haptics` → pas de rebuild), plomberie du `rest_seconds` du plan (non seedé → extension
  de requête), fonction repository dédiée `setWorkoutFeedback` pour le résumé, état de fin de séance.
- **Découpage US-C acté** : **C1** (ce socle) → **C2** (types de séries, RPE/série, charge planifiée-réalisée,
  migrations) → **C3** (réorg, machine prise, superset, remplacer, note par exo, démo, suggestion de progression).
- Prochaine étape : **plan d'implémentation C1**.

### 19/07/2026 — `docs/us-c-idees-terrain` — US-C : idées UX terrain + liste stabilisée

**Modifié**
- [docs/refonte-muscu/analyse-seance-en-cours.md](docs/refonte-muscu/analyse-seance-en-cours.md) : ajout de la
  section **§3 « Idées UX terrain » (mise en situation « à la salle »)** — 8 idées validées Florian (focus
  exercice/série courant + aperçu « à suivre », steppers − / + incréments plaque, repos plein écran + vibration,
  échauffement marqué en direct auto-exclu, « machine prise » sauter/revenir, superset repos après la paire,
  keep-awake, suggestion de progression). Doc marqué **liste stabilisée** (22 points) → **prêt pour la spec US-C** ;
  note d'ampleur ajoutée (évaluer un **découpage** de US-C en sous-US à l'ouverture de la spec).

**Technique / Notes**
- Analyse/suivi uniquement (aucun code). Prochaine étape : **brainstorm/spec US-C** (sur go Florian).

### 19/07/2026 — `docs/analyse-seance-us-c` — analyse de flux de l'écran de séance (pré-spec US-C)

**Ajouté**
- [docs/refonte-muscu/analyse-seance-en-cours.md](docs/refonte-muscu/analyse-seance-en-cours.md) : **document
  vivant** de findings pour la future US-C (refonte de l'écran de séance en cours). 12 points relevés par Claude
  (dont : abandon destructif sans confirmation ⚠️, liste plate vs flux guidé, échauffement qui pollue
  volume/records, fin de séance sans ressenti/note) + 2 compléments Florian (**RPE par série**, **charge
  planifiée vs réalisée**). **Pas la spec** : liste en cours de croisement (Florian continue d'analyser).

**Technique / Notes**
- Suivi/analyse uniquement (aucun code). Référencé depuis la ligne US-C du [TODO.md](TODO.md). Migrations
  pressenties pour US-C : `workout_sets.rpe`, éventuellement charge planifiée. **Spec US-C non entamée** (attente
  liste stabilisée).

### 19/07/2026 — `docs/recette-refonte-ab` — US-A & US-B : recette device validée

**Modifié**
- [TODO.md](TODO.md) : **US-A** et **US-B** (chantier refonte Muscu) passées en `[x]` — **recette device
  validée par Florian le 19/07/2026** ✅. Reste la **relecture Damien** sur les deux.

**Technique / Notes**
- Suivi uniquement (aucun code). Pas de changement de Statut roadmap : les deux US sont de la **refonte**
  d'existant (hors lignes roadmap versionnées ; les items 3.x/7.4 concernés étaient déjà ✅).
- Suite du chantier : **US-C** (refonte de l'écran de séance en cours — analyse de flux déjà remontée à Florian,
  reconciliation des listes en cours avant la spec) puis **US-D** (templates de séance libre).

### 18/07/2026 — `feature/refonte-muscu-b` — implémentation US Refonte-B (séance du jour sur le hub)

> Implémentation subagent-driven (6 commits `10f267b`→`f5c7027`), revue de code globale **sans bloquant**.
> typecheck + lint + tests **verts**, parité i18n FR/EN. **Aucune migration.**

**Ajouté**
- **Hook `useTodaySession('strength')`** ([dashboard-repository.ts](apps/mobile/src/data/repositories/dashboard-repository.ts)) :
  source de vérité unique de la « séance du jour ». Lit l'occurrence `planned_sessions` du jour (**tous statuts** →
  règle `planned` d'abord → sinon `done`), la **prochaine future**, l'état séance active ; `programName` résolu
  depuis le programme **de l'occurrence** (jointure `program_translations`).
- **Hub muscu** ([(tabs)/strength.tsx](apps/mobile/src/app/(tabs)/strength.tsx)) : carte d'action à 3 états —
  Reprendre / **Séance du jour** (« Démarrer » **lié** `plannedSessionId`) / repli **Séance libre** + coche
  **« ✓ Séance du jour faite »** + mention **« Prochaine : jj/mm · … »** (→ planning). Les 2 lignes coexistent.

**Modifié**
- **Widget dashboard 7.4** ([TodaySessionCard.tsx](apps/mobile/src/components/dashboard/TodaySessionCard.tsx)) :
  consomme `useTodaySession` ; démarrage désormais **lié** (corrige la lacune post-US-A où le widget ne marquait
  pas l'occurrence) ; variantes compact/full + état vide « Créer un programme » conservées.
- i18n FR/EN : `home.today.next` / `doneToday` / `noneToday`.

**Supprimé**
- `useNextSession` + type `NextSessionState` (remplacés par `useTodaySession`) ; import `useProgramDetail`
  devenu inutile ; mock du test `StreakCard.test.tsx` renommé. Grep `useNextSession` → 0.

**Technique / Notes**
- Offline-first (lecture locale `useQuery`), aucune écriture nouvelle (démarrage géré par US-A). Aucune migration.
- Points **mineurs** relevés en revue (non bloquants, non corrigés) : (1) repli « Séance N » figé à N=1 pour les
  lignes coche/prochaine quand `sessions.name` est nul (rare) ; (2) le hub ne gate pas sur `isLoading` → bref flash
  possible « Séance libre » → « Séance du jour » au 1ᵉʳ rendu (négligeable en SQLite local, comportement pré-existant).
- **Reste** : recette device (**avec US-A**) + relecture Damien. US-B non cochée `[x]` avant recette.

### 18/07/2026 — `feature/refonte-muscu-b` — maquette US Refonte-B

**Ajouté**
- [design/refonte-muscu-b/refonte-muscu-b.html](design/refonte-muscu-b/refonte-muscu-b.html) : maquette des
  3 états de la carte d'action du hub muscu (Séance du jour liée / repli Séance libre + coche « ✓ faite » +
  mention « Prochaine » / Reprendre), cartes-modules inchangées dessous. Design system de l'app (muscu bordeaux).

**Technique / Notes**
- **Design uniquement** (aucun code). **Validée par Florian** → spec ✅ + plan ✅ + design ✅ réunis : feu vert
  implémentation (subagent-driven, 5 tâches, **aucune migration**).

### 18/07/2026 — `feature/refonte-muscu-b` — plan d'implémentation US Refonte-B

**Ajouté**
- [docs/plans/refonte-muscu-b-seance-du-jour-hub.md](docs/plans/refonte-muscu-b-seance-du-jour-hub.md) :
  plan (5 tâches, aucune migration). **T1** hook `useTodaySession('strength')` (occurrence du jour tous statuts
  + prochaine future + `programName` via `program_translations` + `hasActiveProgram`) ; **T2** i18n (`next`,
  `doneToday`, `noneToday`) ; **T3** widget dashboard 7.4 sur le nouveau hook (démarrage **lié** `plannedSessionId`) ;
  **T4** hub muscu carte 3 états (Reprendre / Séance du jour liée / repli Séance libre + mention « Prochaine » +
  coche « ✓ faite ») ; **T5** retrait de `useNextSession` + nettoyage mock + contrôle final. Commits atomiques, DoD.

**Technique / Notes**
- **Plan uniquement** (aucun code). Aucun secret. Ne livre aucune fonctionnalité.
- Revue de plan (subagent) **Approved** ; 1 correction factuelle intégrée (`startWorkoutFromSession` à **ajouter**
  à l'import de `strength.tsx`) + robustesse fuseau (formater la date « Prochaine » depuis la chaîne AAAA-MM-JJ,
  pas `new Date`). Prochaine étape : **maquette** puis validation finale avant code.

### 18/07/2026 — `feature/refonte-muscu-b` — spec US Refonte-B (séance du jour sur le hub muscu)

**Ajouté**
- [docs/specs/functional/us/refonte-muscu-b-seance-du-jour-hub.md](docs/specs/functional/us/refonte-muscu-b-seance-du-jour-hub.md) :
  spec de l'US-B (chantier refonte Muscu, corrige le problème 3 de l'audit). Décisions (brainstorming Florian) :
  (1) **source = occurrence réelle du calendrier du jour** (pilier muscu, 1ʳᵉ non faite), « Démarrer » passe
  `plannedSessionId` → complétion remonte (cohérent US-A) ; (2) rien planifié → « Séance libre » principal +
  **mention discrète** de la prochaine occurrence ; (3) occurrence du jour **faite** → repli séance libre +
  **coche « ✓ Séance du jour faite »** ; (4) **hook partagé `useTodaySession('strength')`** (remplace
  `useNextSession`) consommé par le hub **et** le widget dashboard 7.4 (réaligné, démarrage désormais **lié**).

**Technique / Notes**
- **Spec uniquement** (aucun code). **Aucune migration** (`planned_session_id` déjà posé par US-A). Aucun secret.
- Revue de spec (subagent) **Approved** après 1 itération : la requête « occurrence du jour » lit désormais
  **tous statuts** (pour alimenter la coche « faite ») ; `programName` tiré du programme **de l'occurrence**
  (jointure `program_translations`), pas de `useActiveProgram` — couvre le cas « garder les séances à venir » d'US-A.
- Détail pour le plan : nettoyer le mock résiduel `useNextSession` dans `StreakCard.test.tsx` au renommage.
- Prochaine étape : **plan d'implémentation**.

### 18/07/2026 — `feature/refonte-muscu-a` — implémentation US Refonte-A (programme → planning → séance)

> Implémentation subagent-driven (7 commits `c0f6a07`→`c53d85a`), revue de code globale **sans bloquant**.
> typecheck + lint + tests **verts**, parité i18n FR/EN parfaite.

**Ajouté**
- **Lien occurrence ↔ séance** : colonne `planned_session_id` (nullable) sur `workouts`
  ([migration](supabase/migrations/20260718125516_workouts_planned_session_link.sql) **appliquée cloud**
  + `db:types` + [schéma PowerSync](apps/mobile/src/powersync/schema.ts)).
- **Démarrer depuis le calendrier** : [planning/index.tsx](apps/mobile/src/app/planning/index.tsx) — action
  principale « Démarrer la séance » sur une occurrence, **gatée `pillar === 'strength'` + `status === 'planned'`**
  (jamais de « Démarrer » sur une occurrence course → pas de workout vide) ; garde « reprise » si une séance
  est déjà active ; « Marquer fait sans détailler » en secondaire.
- **Popup de changement de programme** : [planning/plan.tsx](apps/mobile/src/app/planning/plan.tsx) —
  `planProgram(..., { removePreviousFuture })` + `Alert` retirer/garder les séances futures de l'ancien.

**Modifié**
- [workout-repository.ts](apps/mobile/src/data/repositories/workout-repository.ts) : `startWorkoutFromSession`
  pose `planned_session_id` ; `finishWorkout` bascule l'occurrence liée `done` (**best-effort**, ne bloque
  jamais la clôture) ; `startWorkout` = lien nul ; `cancelWorkout` inchangé (abandon → occurrence reste `planned`).
- [planned-session-repository.ts](apps/mobile/src/data/repositories/planned-session-repository.ts) :
  `planProgram` retire (option) les occurrences **futures `planned`** des autres programmes actifs du même
  pilier, **avant** la désactivation ; historique conservé.
- **Fusion activer/planifier** sur les **2 fiches** ([programs/[id].tsx](apps/mobile/src/app/programs/%5Bid%5D.tsx)
  + [running-programs/[id].tsx](apps/mobile/src/app/running-programs/%5Bid%5D.tsx)) : un seul bouton
  « Démarrer ce programme » / « Modifier la planification » ; `activateProgram` retiré des écrans.
- i18n FR/EN : clés ajoutées (`planning.start`, `planning.markDoneQuick`, `planning.switchProgram.*`,
  `programs.detail.startProgram`/`editPlanning`) ; **clés orphelines retirées** (`detail.activate`/`activating`/
  `alreadyActive`, `planning.markDone`, `running.program.activate`).

**Technique / Notes**
- **Offline-first** : écritures optimistes locales ; migration additive nullable → rétrocompatible.
- Point d'attention (revue) : la « reprise » d'une séance active se fait par **changement de libellé** du bouton
  (« Reprendre ») + navigation directe, plutôt que par un dialogue de confirmation — interprétation à confirmer
  en recette (spec §3/§7 « proposer de reprendre »).
- **Reste** : **recette device** (checkpoint migration déjà poussée) + **relecture Damien**. US-A non cochée `[x]`
  tant que la recette n'est pas validée.

### 18/07/2026 — `feature/refonte-muscu-a` — maquette US Refonte-A

**Ajouté**
- [design/refonte-muscu-a/refonte-muscu-a.html](design/refonte-muscu-a/refonte-muscu-a.html) : maquette des
  3 surfaces modifiées par l'US-A, dans le design system de l'app (muscu = bordeaux `#6b0028`) :
  (1) menu d'action d'une occurrence du calendrier avec **« Démarrer la séance »** en principal + secondaires
  (Reporter / Sauter / Marquer fait sans détailler) et « Démarrer » masqué sur les occurrences course ;
  (2) fiche programme **avant** (Activer + Planifier) → **après** (un seul « Démarrer ce programme » /
  « Modifier la planification ») ; (3) popup de changement de programme (retirer/garder les futures) +
  rappel du flux de complétion. Réutilise le langage visuel de la maquette 3.9.

**Technique / Notes**
- **Design uniquement** (aucun code) → build non impacté. Aucun secret. Ne livre aucune fonctionnalité.
- **Validée par Florian** → les 3 livrables du workflow (spec ✅ + plan ✅ + design ✅) sont réunis :
  feu vert pour l'**implémentation** (subagent-driven). ⚠️ Task 1 = migration cloud (checkpoint 🔴, `db:push`
  confirmé au cas par cas).

### 18/07/2026 — `feature/refonte-muscu-a` — plan d'implémentation US Refonte-A

**Ajouté**
- [docs/plans/refonte-muscu-a-unification-programme-planning-seance.md](docs/plans/refonte-muscu-a-unification-programme-planning-seance.md) :
  plan d'implémentation (9 tâches, phases A→G) de l'US-A. **A** migration `planned_session_id` sur
  `workouts` + schéma PowerSync + `db:types` (🔴 checkpoint cloud) ; **B** `startWorkoutFromSession`
  pose le lien / `finishWorkout` marque l'occurrence `done` (best-effort) ; **C** `planProgram` retire
  les occurrences futures de l'ancien programme ; **D** calendrier : bouton « Démarrer » gaté muscu +
  garde reprise + « Marquer fait sans détailler » ; **E** fusion des boutons sur les **2 fiches**
  (muscu `programs/[id].tsx` + running `running-programs/[id].tsx`) + popup de changement de programme ;
  **F** i18n FR/EN ; **G** contrôle + maquette. Commits atomiques, DoD, ordre/dépendances.

**Technique / Notes**
- **Plan uniquement** (aucun code) → lint/typecheck/tests non impactés. Aucun secret. Ne livre aucune
  fonctionnalité → aucun Statut roadmap modifié.
- Revue de plan (subagent) **Approved** après 1 itération : ajout de la 2ᵉ fiche `running-programs/[id].tsx`
  à la tâche de fusion (mêmes boutons/clés partagées → sinon régression running + grep i18n cassé) ;
  correction `useActiveProgram` (singulier) + ordre des hooks ; grep de retrait de clés i18n rendu prudent.
- Prochaine étape workflow : **maquette** (design/refonte-muscu-a/) puis **validation finale** avant tout code.

### 18/07/2026 — `feature/refonte-muscu-a` — spec US Refonte-A (unifier programme → planning → séance)

**Ajouté**
- [docs/specs/functional/us/refonte-muscu-a-unification-programme-planning-seance.md](docs/specs/functional/us/refonte-muscu-a-unification-programme-planning-seance.md) :
  spec fonctionnelle de l'US-A du chantier refonte Muscu. Reprend le différé de l'US 3.9
  (« démarrer depuis le planning » + « lien de complétion automatique ») et **fusionne** « activer » /
  « planifier » un programme. 4 décisions actées (brainstorming Florian) : (1) un seul concept
  « programme actif = au calendrier » via un geste « Démarrer ce programme » ; (2) action principale
  « Démarrer la séance » sur une occurrence + secondaires Reporter/Sauter/Marquer-fait ; (3) complétion
  par **lien explicite** (migration `planned_session_id` sur `workouts` → séance terminée = occurrence
  `done`) ; (4) popup de changement de programme (retirer/garder les occurrences futures). Pilier-agnostique
  (muscu + running), offline-first, i18n FR/EN.

**Technique / Notes**
- **Spec uniquement** (aucun code) → lint/typecheck/tests non impactés. Aucun secret. Ne livre aucune
  fonctionnalité → aucun Statut roadmap modifié.
- Revue de spec (subagent) **Approved** après 1 itération : correction du gating « Démarrer » (muscu-spécifique
  `startWorkoutFromSession` → masqué sur occurrences running, sauf option (a) du §7) pour éviter un workout vide.
- **Point à trancher au plan** (§7) : inclure ou non le démarrage d'une course planifiée (tracker running) dans
  US-A — défaut **(b)** = lien de complétion muscu seul, adaptation running en suivant.
- ⚠️ L'implémentation portera une **migration** `planned_session_id` (checkpoint cloud). Prochaine étape : **plan**.

### 18/07/2026 — `docs/refonte-muscu` — audit des flux Muscu + ouverture du chantier de refonte

**Ajouté**
- [docs/refonte-muscu/audit-flux.md](docs/refonte-muscu/audit-flux.md) : **diagnostic figé** des flux
  du pilier Musculation (spec vs code réel). 5 problèmes documentés avec preuves (fichier:ligne) et
  gravité [S]/[P] : (1) planning ↔ logging déconnectés, (2) « activer » vs « planifier » confus,
  (3) séance du jour enfouie sur le hub, (4) écran de séance en-deçà de la spec §4.3, (5) pas de
  templates de séance libre. Cross-référence à l'existant (neuf vs MUSC-F4/F5/F6 déjà au backlog) +
  découpage en 4 US (A→B→C→D) validé par Florian.
- [TODO.md](TODO.md) : section **« 🔧 Chantier refonte Muscu »** — les 4 US avec portée, dépendances,
  ordre, et le fait que **US-C absorbe MUSC-F4/F5/F6**.

**Technique / Notes**
- Documentation uniquement (aucun code touché) → lint/typecheck/tests non impactés (non relancés).
  Aucun secret. **Ne livre aucune fonctionnalité** → aucun Statut roadmap modifié.
- **Décision assumée** : les 4 US de refonte ne sont **pas** ajoutées comme lignes de la roadmap
  versionnée (refonte d'existant ≠ nouvelles features) ; rationale notée dans le TODO. US-C fera
  évoluer le Statut des items roadmap concernés à sa livraison.
- Prochaine étape : **US-A** (spec, 1ʳᵉ étape du workflow).

### 18/07/2026 — `docs/roadmap-reconciliation` — outillage du suivi roadmap + backlog Reste-à-faire MVP1

**Modifié**
- [docs/roadmap/roadmap.md](docs/roadmap/roadmap.md) : **colonne Statut renseignée** par réconciliation
  code ↔ roadmap (✅ Livré · 🟡 Partiel · ⬜ À faire · ⏳ Reporté) sur les ~179 fonctionnalités du
  périmètre de lancement ; en-têtes de tableaux réalignés (colonne Statut), objectifs de versions
  annotés (V0.6 « 100 % livrée », V0.8 « quasi vide — reste-à-faire clé »), **Récapitulatif recalculé**
  (127 livré / 12 partiel / 39 à faire + tableau « Détail par version ») et décisions bloquantes mises à jour.
- [CLAUDE.md](CLAUDE.md) + [.claude/commands/commit.md](.claude/commands/commit.md) : nouvelle **étape
  obligatoire** dans le workflow `/commit` — mettre à jour la **colonne Statut de la roadmap** dès qu'un
  commit livre/fait avancer une fonctionnalité (sautée si le commit ne touche aucune fonctionnalité roadmap).
  Section « Suivi — TODO.md & roadmap » clarifiant les deux niveaux (TODO = US actives ; roadmap = photo d'ensemble).
- [TODO.md](TODO.md) : ajout du backlog **« 🗺️ Reste-à-faire MVP1 »** (US candidates priorisées
  P0/P1/P2 : CONF-01→07, LANCE-01, MUSC-F1→9, RUN-F1→3, CONTENU-01, NUTR-F1, SOCLE-01) + note de suivi.

**Technique / Notes**
- Travail **documentaire uniquement** : aucun fichier de code (`.ts`/`.tsx`) touché → lint/typecheck/tests
  non impactés (non relancés). Aucun secret. Cohérent avec la note « Dernière mise à jour » du TODO
  (18/07/2026) qui décrivait déjà cette réconciliation, restée jusqu'ici **non commitée**.
- Ce commit **ne livre aucune fonctionnalité** : l'étape « statut roadmap » du workflow est sans objet
  (le remplissage du Statut EST la charge utile).

### 18/07/2026 — `feature/meta09-lissage-courbes` — lissage des courbes par moyenne mobile (brique socle META-09)

**Ajouté**
- [moving-average.ts](packages/shared/src/moving-average.ts) : brique pure `movingAverage(values, window)`
  — moyenne mobile **centrée** (fenêtre en points, bords rétrécis), copie si `window ≤ 1` ou
  `values.length < 2`. Réutilisable par les courbes et les projections futures (META-14/15/16).
- [ProgressLineChart](apps/mobile/src/components/charts/ProgressLineChart.tsx) : prop opt-in `smooth`
  — superpose la courbe **brute estompée** (`data`, sans zone) et la courbe **lissée accentuée**
  (`data2`, avec zone), fenêtre **auto-adaptée** (impaire, bornée [3,7]), **seuil ≥ 4 points** (sinon
  brut seul), axe Y inchangé (calculé sur le brut). Rétrocompatible : `smooth` off → rendu identique.

**Modifié**
- Lissage activé sur **4 courbes** : poids + apports kcal ([nutrition-stats.tsx](apps/mobile/src/app/nutrition-stats.tsx)),
  allure ([running-history](apps/mobile/src/app/running-history/index.tsx)), progression charge/volume/1RM
  ([progress](apps/mobile/src/app/progress/index.tsx)).

**Technique / Notes**
- Maquette légère validée Florian ([design/meta09-lissage-courbes](design/meta09-lissage-courbes/meta09-lissage-courbes.html)).
- **Aucune** migration, **aucun** contrôle ajouté (fenêtre fixe auto), **aucune** i18n nouvelle —
  100 % client offline (reload Metro). API `gifted-charts` (data2/areaChart1-2/color1-2) vérifiée sur la
  version installée. typecheck ✅ · lint ✅ · **790 tests ✅** (shared 746 + mobile 44). Catalogue
  META-09 → ✅. Spec 1 passe + plan 1 passe (approuvé) + revues par tâche + revue finale *prête à merger*.
  **Reste : recette device (4 courbes, lissé cohérent + brut visible, pas de glitch d'axe allure) + relecture Damien.**

### 18/07/2026 — `feature/meta08-tendance-regression-lineaire` — moteur de tendance par régression linéaire (brique socle META-08)

**Ajouté**
- [regression.ts](packages/shared/src/regression.ts) : moteur pur `linearRegression(points)` (moindres
  carrés → `{ slope, intercept, r2, n }`), retourne `null` sur cas dégénéré (< 2 points ou variance de x
  nulle) ; convention série constante en y → `slope 0, r2 1`. Brique socle réutilisable (débloque les
  projections META-14/15/16).
- [daysBetween](packages/shared/src/date.ts) : nombre de jours calendaires entre deux clés `AAAA-MM-JJ`,
  calcul via midi UTC (DST-safe).

**Modifié**
- `weightTrend` ([bodyweight.ts](packages/shared/src/bodyweight.ts)) **rebranché** sur la régression :
  signature élargie de `number[]` à des points datés `{ logDate, weightKg }` ; verdict = `pente × fenêtre`
  vs seuils inchangés (±0,3 kg). Appelants mis à jour : [nutrition-stats.tsx](apps/mobile/src/app/nutrition-stats.tsx),
  [WeightCard.tsx](apps/mobile/src/components/dashboard/WeightCard.tsx), et le test [recipe.test.ts](packages/shared/src/recipe.test.ts).
- `paceTrend` ([run-stats.ts](packages/shared/src/run-stats.ts)) **rebranché** sur la régression
  (signature inchangée) : X = jours écoulés, diviseur = moyenne de la série, seuils inchangés (±2 %).
  Correction des `dayKey` de test non datés (`'a'..'d'` → vraies dates).

**Technique / Notes**
- **Iso-comportement** prouvé par des tests « golden » de non-régression (oracle = ancienne logique) ;
  divergences non-monotones **figées honnêtement** (ex. `weightTrend([81,76,84,80])` : `down` → `up`
  ; `paceTrend([360,340,380,350])` : `declining` → `stable`). R² calculé mais **non exposé** (réserve).
- **Aucune** surface UI, **aucun** i18n, **aucune** migration — 100 % `packages/shared` + 2 appelants
  mobiles. typecheck ✅ · lint ✅ · **739 tests ✅**. Catalogue META-08 → ✅. Spec+plan+code relus par
  sous-agents (spec 1 passe, plan 2 passes, revue par tâche + revue finale *prête à merger*).
  **Reste : recette device (non-régression des tendances poids + allure) + relecture Damien.**

### 18/07/2026 — `feature/modules-cartes-apercu` — cartes-aperçu des modules (Muscu & Course) + mini-calendrier planning

**Ajouté**
- [ModulePreviewCard](apps/mobile/src/components/ModulePreviewCard.tsx) : carte de module réutilisable,
  **entièrement tappable** (icône + titre + chevron + zone d'aperçu). Remplace le pattern « titre +
  sous-titre générique + bouton » — le bouton disparaît, toute la carte ouvre le module.
- [PlanningPreview](apps/mobile/src/components/PlanningPreview.tsx) + hook `useUpcomingSessions(days)`
  ([planned-session-repository](apps/mobile/src/data/repositories/planned-session-repository.ts)) :
  **mini-calendrier des 4 prochains jours** (aujourd'hui inclus) — une case par jour (abréviation +
  numéro), pastille(s) colorée(s) par pilier (bordeaux muscu / accent course), « repos » si vide,
  aujourd'hui surligné, + ligne « Prochaine : … ». Tous piliers, réactif, offline-first.
- i18n FR/EN : `planning.restShort`, `planning.previewNext`, `planning.previewEmpty`, `programs.noneActive`.

**Modifié**
- Onglet **Muscu** ([strength](apps/mobile/src/app/(tabs)/strength.tsx)) : modules Programmes (programme
  actif + durée), Mon planning (mini-calendrier), Historique (2 dernières séances : date + durée),
  Progression (volume de la semaine + `DeltaBadge`) passés en cartes-aperçu tappables. La carte d'action
  démarrer/reprendre reste un bouton.
- Onglet **Course** ([running](apps/mobile/src/app/(tabs)/running.tsx)) : modules Mes programmes
  (programme running actif), Mon planning (mini-calendrier), Historique (dernière course : distance ·
  durée · allure) passés en cartes-aperçu tappables.

**Technique / Notes**
- Réutilise les hooks existants (`useActiveProgram`, `useWorkoutHistory`, `useWeeklyVolumeComparison`,
  `useRunHistory`) + `percentChange`/`DeltaBadge`. **100 % client, aucune migration.**
- typecheck ✅ · lint ✅. **Reste : recette device + relecture Damien.**
### 18/07/2026 — `fix/food-picker-footer-deborde` — footer « Ajouter un aliment » sans débordement

**Corrigé**
- Écran **« Ajouter un aliment »** ([food-picker](apps/mobile/src/app/food-picker.tsx)) : le footer
  aligne jusqu'à **4 boutons** (Scanner, Liste rapide, Ajout rapide, Créer un aliment) en
  `flexDirection:'row'` sans retour à la ligne → le 4ᵉ bouton **débordait** hors de l'écran (« début de
  bouton » coupé en bas à droite).

**Modifié**
- Style `footer` : ajout de `flexWrap:'wrap'` → les boutons passent proprement à la ligne quand ils ne
  tiennent pas sur une seule rangée (le `gap:12` gère aussi l'espacement vertical).

**Technique / Notes**
- **100 % JS, aucune migration.** typecheck ✅ · lint ✅. **Reste : recette device + relecture Damien.**

### 18/07/2026 — `fix/note-course-clavier-invisible` — note facultative visible sous le clavier (Android)

**Corrigé**
- Un champ de saisie situé en bas d'écran (typiquement la **note facultative après une course**,
  écran de résumé de course) restait **masqué par le clavier** pendant la saisie sur Android : on
  tapait sans voir le texte. Cause : le `KeyboardAvoidingView` partagé de
  [FormScreen](apps/mobile/src/components/FormScreen.tsx) avait `behavior={undefined}` sur Android
  (actif seulement sur iOS avec `'padding'`) → aucune remontée du contenu au-dessus du clavier.

**Modifié**
- `FormScreen` : `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}` — l'évitement du clavier
  est désormais actif sur Android aussi. Corrige du même coup **tous les formulaires longs** partageant
  ce conteneur (8 écrans).

**Technique / Notes**
- **100 % JS, aucune migration.** typecheck ✅ · lint ✅. **Reste : recette device + relecture Damien.**

### 17/07/2026 — `fix/admin-piliers-affichage` — back-office `/users` : colonne « Piliers » affichée correctement

_Commit précédent : `054e510`._

**Corrigé**
- Back-office `/users` (liste + fiche) : la colonne/ligne **« Piliers »** affichait « — » pour **tous**
  les comptes, même ceux ayant des piliers actifs. Cause : le mobile sérialise `active_pillars` avec
  `JSON.stringify(...)` dans une colonne PowerSync `text` → à la synchro, la **chaîne JSON** est stockée
  telle quelle dans la colonne `jsonb` `user_settings.active_pillars` (jsonb de type `string`, pas
  `array`). L'admin faisait un simple `Array.isArray(value)` → toujours faux → « — ». Le mobile, lui,
  re-parse déjà de façon tolérante (`parseJsonColumn`).

**Ajouté**
- Helper `parseActivePillars(value)` dans [apps/admin/src/data/users.ts](apps/admin/src/data/users.ts) :
  normalise `active_pillars` en `string[]`, tolérant à la **chaîne JSON** comme au **tableau natif**
  (retourne `[]` si absent/illisible). Mutualise la logique entre les deux écrans.

**Modifié**
- [apps/admin/src/screens/UsersScreen.tsx](apps/admin/src/screens/UsersScreen.tsx) et
  [apps/admin/src/screens/UserDetailScreen.tsx](apps/admin/src/screens/UserDetailScreen.tsx) :
  `renderPillars` utilise désormais `parseActivePillars` au lieu du `Array.isArray` direct.

**Technique / Notes**
- **100 % JS, aucune migration, aucune reprise de données** (les valeurs déjà en base restent lisibles).
- Correctif défensif côté lecture : si un jour la donnée arrive en tableau natif, le helper la gère aussi.
- typecheck ✅ · lint ✅ (0 erreur) · tests ✅ (711). Reste : recette back-office + relecture Damien.

### 16/07/2026 — `fix/profil-champs-numeriques-invalides` — champs numériques du Profil : plus d'effacement silencieux

**Corrigé**
- Écran **Profil** : une saisie non vide mais **invalide** dans un champ numérique (poids, taille,
  poids cible) écrasait silencieusement la valeur en base à l'enregistrement — le parseur
  (`parseWeightToKg` / `heightPartsToCm`) renvoie `null` sur une entrée non numérique (ou ≤ 0), et ce
  `null` était écrit tel quel (pour « Poids cible » cela **supprimait l'objectif**). Désormais un champ
  numérique non vide qui ne parse pas est détecté : le bouton **« Enregistrer » est désactivé** + message
  d'aide `profile.invalidNumber` (FR/EN), tant que la saisie n'est pas corrigée. Un champ **vide** reste
  autorisé (effacement volontaire, ex. retirer le poids cible).

**Technique / Notes**
- `apps/mobile/src/app/profile.tsx` : parsing centralisé (une fois) + drapeaux `weightInvalid` /
  `heightInvalid` / `targetInvalid` → `hasInvalidNumber` (garde-fou dans `onSave` + `disabled` du bouton) ;
  réutilisation des valeurs parsées dans l'`upsertProfile`/`setWeightTarget` (plus de double parsing).
- **100 % client, aucune migration.** typecheck/lint verts. Suite au point de vigilance de la revue
  NUTR-11 (durcissement commun des champs numériques du Profil). **Reste : recette device + relecture Damien.**
- Commit précédent : `a68098b`.

### 16/07/2026 — `feature/nutr11-progression-poids` — carte « Progression vers l'objectif de poids » (NUTR-11)

**Ajouté** (analyse NUTR-11 du catalogue, Phase A — implémentation subagent-driven)
- Carte **« Progression vers l'objectif de poids »** sur Stats nutrition (section Poids, après la courbe) :
  **% (+ kg)** du chemin entre un **poids de départ figé** et un **poids cible**. Départ figé au moment où
  la cible est définie (option A) ; formule bornée [0,1] (perte comme prise) ; poids actuel = dernière
  pesée (repli poids profil) ; dépassement → 100 % + badge « 🎯 Objectif atteint » ; recul → 0 % ; pct
  plafonné à **99 %** tant que l'objectif n'est pas atteint (cohérence badge) ; pas de carte si aucune
  cible ou départ = cible.
- Fonction pure `computeWeightGoalProgress` (shared, testée, 9 cas). Write path `setWeightTarget` qui
  **fige** `start_weight_kg` sur le poids courant à la création/modification de la cible (no-op si
  inchangée, efface si null). Hook `useWeightGoalProgress`. Champ **« Poids cible »** dans le Profil
  (câblé uniquement via `setWeightTarget`). `WeightGoalCard` (3 états : loading / invite sans cible /
  masquée). i18n `stats.weightGoal.*` + `profile.targetWeight` FR/EN.

**Technique / Notes**
- **Migration cloud appliquée** : `profiles.target_weight_kg` + `start_weight_kg` (numeric nullable,
  `check > 0`) — `db:push` + `db:types` + colonnes déclarées dans `powersync/schema.ts` + mapping
  repository (4 points) + `MIGRATIONS.md` coché. Sync rule inchangée (`select * from profiles`).
- **100 % client hormis la migration**, offline. typecheck/lint/tests(710) verts.
- Exécution **subagent-driven** (Task 1→5 + clôture), revue de code finale ***APPROVED*** (1 correctif
  d'arrondi appliqué : pct plafonné à 99 % tant que non atteint + test dédié). Catalogue NUTR-11 → ✅.
- **Reste** : merge `dev` + recette device (perte/prise, dépassement/badge, recul, modif de cible qui
  ré-ancre le départ, état vide, unités métrique/impérial, i18n) + relecture Damien.
- Commit précédent : `331c05b`.

### 16/07/2026 — `feature/nutr11-progression-poids` — spec + plan « Progression vers l'objectif de poids » (NUTR-11)

**Ajouté** (docs uniquement — pipeline spec → plan, analyse NUTR-11 du catalogue, Phase A)
- Spec fonctionnelle [nutr11-progression-poids.md](docs/specs/functional/us/nutr11-progression-poids.md) :
  carte Stats nutrition (section Poids) montrant un **% (et les kg)** du chemin parcouru entre un **poids
  de départ figé** et un **poids cible**. Cadrage Florian : départ = poids au moment où la cible est
  définie (option A) ; formule bornée [0,1] (perte ou prise) ; actuel = dernière pesée ; dépassement →
  100 % + badge « Objectif atteint » ; recul → 0 % ; pas de carte si aucune cible ou départ = cible.
- Plan d'implémentation [nutr11-progression-poids.md](docs/plans/nutr11-progression-poids.md) : 7 tâches
  TDD, 1 migration (colonnes `profiles.target_weight_kg` + `start_weight_kg`), fonction pure
  `computeWeightGoalProgress`, write path `setWeightTarget` (fige le départ), hook `useWeightGoalProgress`,
  champ « Poids cible » (Profil), `WeightGoalCard` (Stats), i18n FR/EN.

**Technique / Notes**
- **Aucun code applicatif** à ce commit (gate CLAUDE.md : spec ✅ validée, plan ✅ validé Florian, maquette
  écartée → implémentation autorisée ensuite). Commit **sur la branche** (pas de merge `dev` : `/commit`
  indisponible — classifieur `claude-sonnet-5` down — commit manuel).
- Commit précédent : `aba444c`.

### 16/07/2026 — `feature/nutr17-regularite-journal` — carte « Régularité du journal » (NUTR-17)

**Ajouté** (analyse NUTR-17 du catalogue, Phase A)
- Carte **« Régularité du journal »** sur Stats nutrition : part % + « N/M jours renseignés » sur la
  fenêtre 7 j/30 j (sélecteur partagé). **Dénominateur borné à l'ancienneté** (min(fenêtre, jours depuis
  la 1ʳᵉ entrée)) ; **aujourd'hui exclu** (fenêtre = jours écoulés jusqu'à hier).
- Fonction pure `computeJournalCompletion` (shared, testée) : reçoit `today: Date` (pas de reparse de
  clé en UTC), comparaisons en clés `AAAA-MM-JJ`, écart de jours calculé en **UTC exact** (DST-safe),
  garde anti-négatif. Hook `useJournalCompletion` (journal-repository : `useDailyTotals` + `MIN(log_date)`).
- i18n `stats.completion.*` (pluriel `logged_one/_other`) FR/EN.

**Technique / Notes**
- **100 % client, aucune migration, offline** (lecture de `food_entries` existant). Troisième carte de
  la section apports (Apports moyens · Adhérence NUTR-10 · Régularité), même sélecteur 7 j/30 j.
- Exécution **subagent-driven** (commits `9b8b1ec`→`f6b54a1`), spec + plan relus par sous-agent
  (2 bloquants dates corrigés en amont : `today: Date`, garde anti-négatif, compte UTC exact),
  **revue finale *ready-to-merge*** (+ test dédié « aujourd'hui exclu du numérateur »).
- typecheck/lint/tests(702) verts. Catalogue NUTR-17 → ✅.
- **Reste** : recette device (jours renseignés/sautés ; aujourd'hui non compté ; compte récent = borne
  ancienneté ; 7 j/30 j ; aucune entrée) + relecture Damien.
- Commit précédent : `6b650c1`.

### 16/07/2026 — `feature/nutr10-adherence-objectif` — carte « Adhérence à l'objectif » (NUTR-10)

**Ajouté** (analyse NUTR-10 du catalogue, Phase A)
- Carte **« Adhérence à l'objectif »** sur l'écran Stats nutrition : part % + « N/M jours dans la
  cible » sur la fenêtre 7 j/30 j (sélecteur existant réutilisé). « Dans la cible » = |kcal du jour −
  **objectif effectif du jour**| ≤ marge % ; dénominateur = **jours loggés** seulement.
- **Marge configurable** (5/10/15 %, défaut 10) **synchronisée** : colonne `nutrition_profiles.adherence_margin_pct`
  (**migration cloud appliquée + `db:types`**, sync rule `select *` inchangée) ; réglage `Segment` dans
  le profil nutritionnel. Colonne déclarée dans `powersync/schema.ts` + 4 points de mapping repo + schéma
  Zod (`min 1 max 50 default 10`).
- **Objectif effectif par jour** (base + bonus jour de séance, mode Forfait/Auto RN-01) calculé en
  **batch** en réutilisant les briques pures ; helper `computeEffectiveTargetForDay` + `computeGoalAdherence`
  (shared, testés) ; hook `useGoalAdherence` (dashboard-repository).
- i18n `stats.adherence.*` (pluriel `inTarget_one/_other`) + `nutrition.calories.adherenceMargin` FR/EN.

**Technique / Notes**
- **100 % client hormis la migration** (additive, checkpoint 🔴). Objectif effectif calculé en mémoire
  (données déjà chargées), mode Auto inclus.
- Exécution **subagent-driven** (commits `bf689ef`→`f61b194`), spec + plan relus par sous-agent
  (corrections intégrées : schéma PowerSync client, mapping repo, helper pur testable, cas « aujourd'hui »),
  **revue finale *ready-to-merge*** (+ correctif flash « définis ton objectif » au chargement).
- typecheck/lint/tests(697) verts. Catalogue NUTR-10 → ✅.
- **Simplification assumée** : pour aujourd'hui, une séance *planifiée non faite* n'anticipe pas le
  bonus (le batch reste rétroactif) — cas marginal.
- **Reste** : recette device (part % + jours dans la cible ; changement de marge ; jour de séance vs
  base ; 7 j/30 j ; profil sans objectif ; fenêtre vide) + relecture Damien.
- Commit précédent : `7bd4aef`.

### 16/07/2026 — `feature/mr06-temps-entrainement` — widget « Temps d'entraînement » (MR-06, inter-piliers)

**Ajouté** (analyse MR-06 du catalogue, Phase A, 1ʳᵉ stat **inter-piliers** en temps)
- Widget dashboard **`training-time`** : temps total d'entraînement (muscu + course) de la **semaine
  ISO courante** (lundi→dimanche, borné `finished_at`) + **ventilation** muscu / course. Gating
  transverse `['strength','running']` (visible si muscu **OU** course actif) ; ventilation affichée
  seulement si les deux piliers sont actifs (sinon le total suffit). Variante compacte + empty state.
- Logique pure `@wellness/shared` : `computeTrainingTime` (agrégation + clamp) et `formatHoursMinutes`
  (« Xh YY », minutes plancher zéro-paddées) — testées (Vitest).
- Hook `useTrainingTime` (dashboard-repository) : **composition** de `useRunStats('week')` (course) et
  `useWorkoutHistory` filtré semaine (muscu), gating au retour, hooks inconditionnels.
- Composant `TrainingTimeCard` + entrée `WIDGET_COMPONENTS` ; registre `dashboard.ts` étendu
  (8 → 9 widgets) + `dashboard.test.ts` mis à jour ; i18n `home.trainingTime` FR/EN (parité).

**Technique / Notes**
- **100 % client, offline, aucune migration** (durées déjà présentes : `workouts`/`runs`
  `duration_seconds`). Fenêtre alignée sur `muscle-volume`/`running-week` → les chiffres se réconcilient.
- Exécution **subagent-driven** (commits `f1c8a5a`→`6face77`), spec + plan relus par sous-agent
  (corrections intégrées : semaine ISO vs 7 j glissants, `formatHoursMinutes` dédié, ordre des commits),
  **revue finale de code *ready-to-merge*** (cohérence inter-widgets vérifiée au fuseau).
- typecheck/lint/tests(689) verts. Catalogue MR-06 → ✅.
- **Reste** : recette device (total + ventilation ; gating 1/2 piliers / nutrition seule ; empty ;
  compact) + relecture Damien.
- Commit précédent : `6603c65`.

### 16/07/2026 — `feature/8.8b-admin-bannissement` — bannissement des utilisateurs (back-office) → US 8.8 complète

**Ajouté** (US 8.8b — seconde moitié de 8.8 ; complète 8.8a)
- **Migration** `20260716150753_user_bans` (**appliquée cloud CLI + `db:types`**, cochée
  [MIGRATIONS.md](supabase/MIGRATIONS.md)) :
  - Table `public.user_bans` **append-only** (historique ban/unban + motif) : RLS `select` réservé à
    `can_manage_users()`, **aucune** policy d'écriture (seules les RPC écrivent).
  - RPC `public.ban_user(target_user_id, reason)` / `public.unban_user(target_user_id)`
    (`SECURITY DEFINER`, `search_path=public`, `revoke execute from public, anon` + `grant to
    authenticated`) : bannissent en posant `banned_until` à une **date lointaine** (`'9999-12-31'` —
    ban permanent, évite le risque de parsing `'infinity'` côté GoTrue). Garde-fous **serveur** :
    habilitation `can_manage_users()`, motif obligatoire, **anti-auto-ban**, **anti-ban d'un compte
    admin**.
  - Colonne **`is_admin`** ajoutée **en dernier** à la vue `admin_users` (garde-fou UI, lisible même
    par un moderator).
- **Audit** : actions `user.ban` / `user.unban` ajoutées à `AUDIT_ACTIONS`
  ([packages/shared/src/audit.ts](packages/shared/src/audit.ts)) + libellés `fr.audit.action`.
- **Data** `data/users.ts` : `banUser` / `unbanUser` (RPC + `logAudit` best-effort) / `listUserBans`.
- **UI** : section **Modération** sur la fiche `/users/:id` — Bannir (motif obligatoire via prompt) /
  Débannir (confirmation) + **historique** ; garde-fous UI (section masquée pour **soi-même** et pour un
  **compte admin**, double barrière avec le serveur) ; i18n `fr.users.ban`.

**Technique / Notes**
- **Clé anon uniquement (aucun `service_role`), pas de sync rule**, coupure d'accès au **prochain
  refresh** (~1 h) assumée. `banned_until = '9999-12-31'` (décision Florian : date lointaine plutôt
  qu'`'infinity'`, non testable en CLI).
- Exécution **subagent-driven** (commits `0845df6`→`b6b3aca`), spec + plan relus par sous-agent
  (corrections intégrées), **revue finale de code *ready-to-merge*** (7/7 points sécurité conformes).
- **Rattrapage** : les specs+plans **8.8a** (jamais commités lors de la livraison) ont été ajoutés au
  passage (`6ca0d4a`).
- **Reste** : **recette** (bannir un compte normal → Banni + historique ; auto-ban / ban d'admin
  refusés ; débannir → Actif ; parcours moderator ; coupure effective au refresh) + **relecture
  Damien**. **US 8.8 complète** une fois recettée.
- Commit précédent : `3c1d2e1`.

### 16/07/2026 — `feature/8.8a-admin-consultation-utilisateurs` — consultation des utilisateurs (back-office)

**Ajouté** (US 8.8a — première moitié de 8.8 ; le bannissement = 8.8b, à cadrer avec Damien)
- **Migration** `20260716134626_admin_users_view` (**appliquée cloud CLI + `db:types`**, cochée
  [MIGRATIONS.md](supabase/MIGRATIONS.md)) :
  - Fonction `public.can_manage_users()` (`SECURITY DEFINER`, `super_admin` **ou** `moderator`).
  - Vue `public.admin_users` (`security_invoker=false` + `WHERE can_manage_users()` = **barrière serveur
    authoritative** ; `REVOKE anon` / `GRANT authenticated`) joignant `auth.users`+`profiles`+
    `user_settings`, **colonnes sobres RGPD** (email, inscription, dernière connexion, `is_banned`,
    prénom, objectif, onboarding, piliers, langue — **aucune donnée de santé**). Hors PowerSync.
- **Gate `canManageUsers`** (super_admin/moderator) : `rolesContext.ts` + `RolesProvider.tsx` + garde de
  route `RequireCanManageUsers` (`App.tsx`). **`content_editor` explicitement exclu.**
- **Écrans admin** : liste `/users` (recherche email débouncée + pagination serveur + statut Actif/Banni),
  fiche `/users/:id` (lecture seule, sobre). Couche data `data/users.ts` (`listUsers`/`getUser`, typés
  sur la vue). i18n FR `fr.users`.

**Modifié**
- `AdminLayout` : entrée « Utilisateurs » convertie de placeholder « bientôt » en vrai lien gated
  `canManageUsers` ; `NAV_SOON` + styles morts retirés.

**Technique / Notes**
- **Lecture seule, clé anon uniquement (aucun `service_role`), aucune écriture, aucun `logAudit`**
  (la consultation n'écrit rien). Colonnes de vue toutes nullables → guards systématiques côté écrans
  (`formatDate`, `renderPillars`/`Array.isArray`, cast des clés i18n littérales, pagination sans
  interpolation).
- Exécution **subagent-driven** (commits `48c2f1f`→`5573579`), spec + plan relus par sous-agent
  (corrections intégrées), **revue finale de code *ready-to-merge*** (barrière serveur validée : un
  compte non habilité obtient 0 ligne).
- **Reste** : **recette** (super_admin/moderator voient la liste + fiche ; `content_editor` ne voit rien,
  `/users` redirige ; recherche/pagination ; compte sans profil → « — ») + **relecture Damien**.
- **8.8b (bannissement)** à cadrer avec Damien : RPC `SECURITY DEFINER` sur `auth.users.banned_until`
  + table `user_bans` (motif) + actions UI + audit.
- Commit précédent : `e2220c4`.

### 16/07/2026 — `fix/journal-entree-swipe-edition` — implémentation : swipe + édition élargie des entrées de repas

**Corrigé** (bug §🐞 « modifier / supprimer un aliment ajouté à un repas »)
- **Découvrabilité** : une entrée de repas est désormais un **swipe gauche** (`ReanimatedSwipeable`)
  révélant **Modifier** (ouvre le détail en édition) et **Supprimer** (confirmation → soft delete).
  Le **tap** ouvre le détail en consultation. L'**appui long** (suppression invisible) est **retiré**.
- **Édition élargie** : les **quick add** (entrées sans quantité) deviennent éditables — kcal, P/G/L
  et **nom** en saisie directe. Les entrées **avec quantité** conservent l'édition par les grammes
  (règle de trois `rescaleEntryNutrition`, **non régressé**).

**Ajouté**
- `journal.swipeEdit`, `journal.swipeHint`, `journal.detail.calories` (i18n FR/EN, parité).

**Modifié**
- `updateEntry` ([journal-repository.ts](apps/mobile/src/data/repositories/journal-repository.ts)) :
  `quantityG: number | null`, `name?` optionnel, `micronutrients` **conditionnel** (ne réécrit plus
  `{}` par défaut → micros existants préservés).
- `EntryDetailContent` / `MealSection` ([nutrition.tsx](apps/mobile/src/app/(tabs)/nutrition.tsx)) :
  swipe, ouverture directe en édition (`startEditing`), formulaire d'édition branché sur `hasQuantity`,
  aperçu macros périmé masqué en édition quick add, bouton « Modifier » toujours visible.

**Supprimé**
- Clé i18n orpheline `journal.longPressDelete` (FR+EN) ; variable `canEdit` (remplacée par `hasQuantity`).

**Technique / Notes**
- **100 % client, aucune migration, pas de checkpoint 🔴.** typecheck/lint verts, **684 tests** verts.
- Exécution **subagent-driven** (4 commits `5e00ac9`→`0729039` : updateEntry → i18n → swipe → édition),
  revues spec + qualité par tâche + **revue finale de code *ready-to-merge*** (aucun bloquant).
- ⚠️ **Premier usage de `ReanimatedSwipeable` dans le repo** → **recette device** requise : swipe
  Modifier/Supprimer, tap → détail, édition quick add (kcal/macros/nom), non-régression édition par
  quantité, **actions de swipe non rognées** malgré `overflow:'hidden'` de la carte de repas, confort
  de fermeture du swipe après action. Relecture Damien à faire.
- Commit précédent : `7958b8c`.

### 16/07/2026 — `fix/journal-entree-swipe-edition` — cadrage (spec + plan) édition/suppression d'une entrée de repas + report US 8.7

**Ajouté**
- [docs/specs/functional/us/fix-journal-entree-swipe-edition.md](docs/specs/functional/us/fix-journal-entree-swipe-edition.md) —
  spec du fix du bug §🐞 « modifier / supprimer un aliment ajouté à un repas ». Deux volets :
  **(1) découvrabilité** = swipe gauche sur l'entrée → Modifier + Supprimer (tap conservé, appui long
  retiré) ; **(2) édition élargie** = les quick add (entrées sans quantité) deviennent éditables
  (kcal/P/G/L/nom), les entrées avec quantité restent en édition par les grammes (règle de trois,
  inchangé). 100 % client, aucune migration. **Validée Florian (16/07/2026)**, relue par sous-agent
  (3 corrections intégrées : `ReanimatedSwipeable` au lieu du `Swipeable` déprécié, clés i18n
  rectifiées, `updateEntry.micronutrients` conditionnel).
- [docs/plans/fix-journal-entree-swipe-edition.md](docs/plans/fix-journal-entree-swipe-edition.md) —
  plan d'implémentation en 5 tâches (updateEntry → i18n → swipe → édition élargie → vérifs/recette).
  **Validé Florian (16/07/2026)**, relu par sous-agent (5 corrections mineures intégrées : parité i18n
  manuelle, swap `onSelectEntry`, suppression `canEdit`, masquage aperçu périmé, unité labels macros).

**Modifié**
- [docs/roadmap/roadmap.md](docs/roadmap/roadmap.md) — US **8.7 (modération aliments signalés)** passée
  en **⏳ Reporté** avec justification.
- [TODO.md](TODO.md) — note de report 8.7 dans « Décisions bloquantes » ; bug §🐞 passé en `[~]`
  (spec + plan validés, code à venir).

**Notes**
- **Docs uniquement** (aucun code applicatif touché) → lint/typecheck/tests non pertinents pour ce commit.
- **Report US 8.7** _(décision Florian, 16/07/2026)_ : modèle **privé par utilisateur** (RLS
  `foods_select` = `owner_id IS NULL OR owner_id = auth.uid()`) → aliments utilisateurs non partagés +
  **aucun mécanisme de signalement** (table + geste mobile). La file de modération n'aurait rien à
  traiter → reprise conditionnée à un choix produit (signalement de l'éditorial, ou modèle
  communautaire hors périmètre). **8.8 reste disponible.**
- ⚠️ Nom de branche `fix/journal-entree-swipe-edition` **réutilisé** (une session précédente l'a
  employé pour l'ajout IDEAS.md, déjà mergé sur `dev`). Sans incidence : travail additif.
- Commit précédent : `ab2ded2`.

### 16/07/2026 — `fix/journal-entree-swipe-edition` — 2 idées consignées (IDEAS.md)

**Ajouté**
- [IDEAS.md](IDEAS.md), section « À trier » — deux idées brutes captées (hors pipeline, avant cadrage),
  chacune adossée à l'existant vérifié :
  - 🔍 **Import de données depuis d'autres apps (Garmin/Strava…)** — trace GPX + FC + données non
    modélisées. Recoupe l'US 1.20 (déjà backlog V1.1) ; export GPX déjà codé (écriture seule, sans FC) ;
    FC classée V2. Distinction trace GPX vs métriques non modélisées ; piège FC = extension GPX / FIT / TCX ;
    question ouverte migration ponctuelle (A) vs connexion continue (B).
  - 🆕 **Générateur IA de plan de repas hebdo + liste de courses** — s'appuie sur 4.27/4.28/4.4 (manuels,
    V1.1) mais ajoute la génération IA (nouvel usage IA non cadré). Point dur = optimisation sous contraintes
    (kcal + macros) → calcul déterministe en appui de l'IA. Candidat premium.

**Notes**
- **Docs uniquement** (aucun code touché) ; commité sur la branche de travail courante `fix/journal-entree-swipe-edition`
  (IDEAS.md = fichier transverse hors pipeline). Fichiers non suivis de l'US swipe/édition journal laissés
  hors de ce commit. Commit précédent : `2399ffd`.

### 16/07/2026 — `dev` — CI en échec : erreur de typage `fontsReady` (_layout.tsx)

**Corrigé**
- [_layout.tsx:71](apps/mobile/src/app/_layout.tsx#L71) — `fontsReady = loaded || error` produisait
  le type `true | Error | null` (car `useAppFonts().error` est `Error | null`), refusé par
  `resolveRootRoute` qui attend `fontsReady: boolean`. Le typecheck CI échouait
  (TS2322, run #194). Correction : `loaded || error != null` — vrai booléen, **intention préservée**
  (polices « prêtes » si chargées **ou** en erreur, pour ne pas bloquer le splash indéfiniment).

**Notes**
- **100 % client, une ligne, aucune migration.** typecheck/lint verts, mobile 42 tests + shared 684 tests OK.
  Régression introduite par le commit précédent `d1c0e14` (extraction `resolveRootRoute`). Commit précédent : `2b0ecd5`.

### 16/07/2026 — `fix/onboarding-rejeu-connexion` — onboarding redemandé après réinstallation (race offline-first)

**Corrigé**
- Sur une **réinstallation**, l'app renvoyait vers l'onboarding pourtant terminé : la gate de routing
  ([_layout.tsx](apps/mobile/src/app/_layout.tsx)) concluait « onboarding non fait » sur un profil
  **local** nul, **avant** que PowerSync ait redescendu la ligne `profiles` (qui porte
  `onboarding_completed_at`) — **race offline-first** (déco/reco OK car la base locale garde le profil).
  Repro Florian (16/07/2026) : déco/reco OK, réinstall → onboarding systématique.
- Décision de routing extraite dans une **fonction pure testée** `resolveRootRoute`
  (`packages/shared/src/root-route.ts`, 8 tests Vitest) : garde « ne pas ouvrir l'onboarding sur profil
  local absent tant que `hasSynced` n'est pas vrai » ; `_layout.tsx` consomme le helper. **Comportement
  de routing inchangé hors le cas réinstall.**

**Notes**
- **100 % client, aucune migration, pas de checkpoint 🔴.** typecheck/lint verts, shared 684 tests.
  Reste : recette device (réinstaller → reconnexion → app directe) + relecture Damien. Commit précédent : `cf83d61`.

### 16/07/2026 — `docs/bug-onboarding-rejeu-connexion` — bug onboarding consigné + recettes MN-06/MN-03 validées (TODO)

**Modifié**
- `TODO.md` — **US MN-06** (protéines/kg) et **US MN-03** (vue croisée charge muscu & apports 8 sem)
  passées de `[~]` à `[x]` : **recette device validée par Florian le 16/07/2026** (mentions « 🔴 Reste
  recette » remplacées par le statut validé ; reste relecture Damien). _Note : validations saisies hors
  de cette session, intégrées au même commit sur décision de Florian._
- `TODO.md` — nouvelle entrée dans **§🐞 Bugs connus** : **onboarding relancé à chaque connexion** alors
  qu'il est déjà terminé (remontée Florian, 16/07/2026, à reproduire sur device). Distinct du bug déjà
  corrigé `fix/onboarding-rejeu-profil` (qui était un *crash* au 2ᵉ passage). Diagnostic code consigné :
  la gate de routing ([_layout.tsx:79](apps/mobile/src/app/_layout.tsx#L79), [_layout.tsx:132-137](apps/mobile/src/app/_layout.tsx#L132-L137))
  route vers l'onboarding dès que `profile` est `null`, et `ready` n'attend que la **requête locale
  SQLite** (`profileLoading`), **pas** la **synchro initiale réseau** (`hasSynced`) → **hypothèse de race
  offline-first** (profil pas encore rapatrié = considéré comme onboarding non fait). Pistes de fix
  (attendre `hasSynced` / distinguer « pas encore synchro » de « nouveau compte ») + question à trancher
  à la reproduction (chaque login vs réinstall/2ᵉ appareil). À cadrer : spec courte avant fix.

**Notes**
- Mise à jour **documentaire** (suivi) uniquement — aucun code applicatif ni schéma, aucun secret.
  Commit précédent : `9f161e0`.

### 16/07/2026 — `fix/affichage-graphes-et-filtre-course` — catalogue d'analyses : recette + priorisation à jour

**Modifié**
- `docs/product/analyses-donnees.md` — mention « recette device OK 16/07/2026 » ajoutée aux **6 analyses
  livrées & recettées** (MUSC-04, MUSC-05, MN-02/4.32, RN-01, RN-02, META-06) ; section **« Pistes de
  priorisation »** corrigée : items **1/2/6/11 barrés** (livrés + recettés, statuts périmés ⏳/🟡 retirés),
  note de MàJ ajoutée. _Rappel : ce catalogue trace l'**existence** d'une analyse (✅ = implémenté), pas
  la recette — le suivi de recette vit dans `TODO.md` / `CHANGELOG.md`._

**Notes**
- Mise à jour **documentaire** uniquement — aucun code ni schéma, aucun secret. Commit précédent : `263a539`.

### 16/07/2026 — `fix/affichage-graphes-et-filtre-course` — recettes device TOUTES validées (TODO)

**Modifié**
- `TODO.md` — les **6 US en attente de recette** (MUSC-04, MUSC-05, META-06, 4.32, RN-01/02 + 8.10)
  **recettées et validées par Florian le 16/07/2026** (APK release + dataset de recette ; 8.10 côté
  back-office web) : bandeau ⛔ « recettes en attente » → **✅ TOUTES VALIDÉES**, cases `[x]`, mentions
  « 🔴 Reste recette » / « PAS ENCORE RECETTÉ » remplacées par le statut validé. **8.7 (modération) →
  8.8 (utilisateurs) débloquées** (dépendaient de la recette 8.10).

**Notes**
- Mise à jour **documentaire** (suivi) uniquement — aucun code ni schéma. Aucun secret.
  Commit précédent : `bc2ef62`.

### 16/07/2026 — `fix/affichage-graphes-et-filtre-course` — recette : fix typage UNION (personal_records)

**Corrigé**
- `supabase/scripts/recette-dataset.sql` (section 9) — le `UNION ALL` insérait des `null` **nus** dans
  `reps` / `weight_kg` ; Postgres les typait en `text` → `ERROR 42804: column "reps" is of type integer
  but expression is of type text` (remontée Florian à l'exécution). Casts explicites `null::int` /
  `null::numeric` dans les 3 branches. Le bloc `DO $$` étant **transactionnel**, l'échec n'avait **rien
  appliqué** (effacement inclus → données intactes). Commit précédent : `008c1cd`.

### 16/07/2026 — `fix/affichage-graphes-et-filtre-course` — affichage : graphiques débordants + filtre course multiligne

**Corrigé**
- [ProgressLineChart.tsx](apps/mobile/src/components/charts/ProgressLineChart.tsx) /
  [MuscleVolumeBarChart.tsx](apps/mobile/src/components/charts/MuscleVolumeBarChart.tsx) — les
  graphiques débordaient à droite de leur carte (visible Nutrition → Stats). Largeur codée en dur
  (`window − 48`) sans compter l'axe Y de `react-native-gifted-charts`, rendu **hors** de `width`
  (empreinte = `yAxisLabelWidth + width + endSpacing`). Largeur désormais **mesurée** via `onLayout`
  et répartie (axe Y 44 px + marge 12 px + tracé) → tient dans la carte partout (nutrition, course,
  muscu). Repli au 1ᵉʳ rendu = écran − paddings usuels (garde le test smoke vert).
- [running-history/index.tsx](apps/mobile/src/app/running-history/index.tsx) — `Segment` de la card
  « Statistiques » passé en `scrollable` : « Semaine / Mois / Depuis le début » sur une seule ligne
  défilable (fin du retour à la ligne).

**Notes**
- **100 % JS** (aucun module natif) → reload Metro suffit, pas de build. **Recette device validée par
  Florian (16/07/2026)** sur APK release. typecheck/lint/tests verts (charts smoke 6/6, shared 663).
  Aucun secret. Commit précédent : `b19df7c`. Reste : relecture Damien.

### 16/07/2026 — `fix/affichage-graphes-et-filtre-course` — recette : dataset charge max (historique des paliers) + idée infobulle

**Corrigé**
- `supabase/scripts/recette-dataset.sql` — la courbe « charge max » (écran Progression) lit
  `personal_records` : **1 point = 1 record battu** ([records-repository.ts:512-543](apps/mobile/src/data/repositories/records-repository.ts#L512-L543)),
  pas le max par séance. Le dataset ne semait qu'**un seul** record `max_weight` daté du jour → un
  point unique (remontée Florian, recette MUSC-04). Il reconstitue désormais l'**historique des
  paliers** (`max_weight` / `estimated_1rm` / `best_volume`) via fonctions fenêtre : une ligne par
  palier réellement franchi (valeur strictement supérieure aux séances précédentes), datée de la
  séance. Exercices au poids du corps (charge 0) **exclus** (restent absents des courbes charge/1RM,
  comportement voulu). ⚠️ Re-exécuter le script d'injection pour bénéficier du correctif.

**Ajouté**
- `supabase/scripts/recette-verification.sql` — contrôle « Paliers charge max DC (courbe) »
  (attendu **6** : 60 → 65 → 70 → 72 → 75 → 80).
- `IDEAS.md` — idée **infobulle de donnée au tap sur les graphiques** (points cliquables), transverse
  à tous les graphiques, à cadrer via le workflow spec → plan → design (remontée Florian, recette MUSC-04).

**Notes**
- Outillage de recette (SQL **non joué par le CLI**) + note d'idée. **Aucun code applicatif, aucun
  schéma, aucun secret.** Commit précédent : `ac0a691`.

### 16/07/2026 — `dev` (exceptionnel, sans branche) — bug consigné : édition/suppression d'un aliment de repas

**Ajouté**
- `TODO.md` (§🐞 Bugs connus) — nouvelle entrée `[ ]` : *modifier / supprimer un aliment ajouté à un
  repas* — geste peu découvrable + édition limitée à la quantité. Remontée Florian (16/07/2026).
  Vérif code [nutrition.tsx](apps/mobile/src/app/(tabs)/nutrition.tsx) : suppression via appui long
  **ou** fiche détail (corbeille), modification limitée à la **quantité** (grammes) et seulement si
  `quantityG > 0` (un quick add sans quantité n'est pas éditable ; pas de changement de l'aliment ni
  des macros). Pistes notées (actions visibles / swipe, édition d'un quick add). À reproduire device +
  cadrer une spec courte avant `fix/…`.

**Notes**
- Commit **direct sur `dev`** (dev→dev, sans branche dédiée), **exceptionnellement** à la demande de
  Florian. Changement **documentaire uniquement** (aucun code ni schéma) → lint/typecheck/tests non
  rejoués. Aucun secret. Commit précédent : `3898567`.

### 16/07/2026 — `chore/recette-outillage-device` — outillage de recette sur device (sans EAS)

**Ajouté**
- `supabase/scripts/recette-dataset.sql` — script de **données de test** (pas une migration) :
  remise à plat (hard delete) des données perso de l'utilisateur cible + injection de ~3 mois
  d'historique cohérent (muscu 14 j déséquilibrée, historique 1RM DC, tractions charge 0, runs
  ~2 mois dont 2 aujourd'hui, nutrition 60 j en 3 paliers kcal, poids hebdo, records, profils
  pré-réglés 3 piliers / nutrition Auto). Couvre les recettes 🔴 en attente : MUSC-04, MUSC-05,
  META-06, 4.32, RN-01/02. Un seul paramètre à renseigner : `v_email`. Tout en une transaction
  `DO $$`. À jouer dans le **SQL Editor** cloud (bypass RLS), **jamais** via `db push`.
- `supabase/scripts/recette-verification.sql` — contrôles **lecture seule** : une grille
  bloc · contrôle · attendu · obtenu · statut (✅/⚠️) validant le dataset ci-dessus (compteurs,
  déficit 7 j, deltas N vs N-1, courbe 1RM, équilibre 14 j par groupe, dépense course du jour).

**Modifié**
- `docs/specs/technical/dev-build-android-local.md` — ajout du **mode B : APK autonome (release,
  sans Metro ni câble)**. Build local via `gradlew.bat assembleRelease` (signé `debug.keystore`
  du projet, `EXPO_PUBLIC_*` embarquées depuis `.env`), transfert sans fil, install sans câble,
  **hors quota EAS**. Intro reformulée (2 modes A/B, prérequis §1 communs), renumérotation
  (§5 fichiers locaux, §6 dépannage) + 1 ligne de dépannage (`.env` absent → crash au lancement).

**Notes**
- Aucun code applicatif ni schéma touché (docs `.md` + `.sql` autonomes non importés) → lint/
  typecheck/tests non rejoués. Scripts SQL **non idempotents** et **destructifs** (hard delete
  ciblé sur `v_email`) : à réserver à un compte de recette. Aucun secret (email en placeholder
  `REMPLACE-MOI@exemple.fr`). Commit précédent : `fe11bcb`.

### 15/07/2026 — `feature/musc05-equilibre-groupes` — MUSC-05 livrée (équilibre par groupe, 14 j)

**Ajouté**
- `computeMuscleBalance(setsByGroup)` + constantes de seuils (`packages/shared/src/muscle-balance.ts`,
  testée) — parts par groupe, classement délaissé/équilibré/sur-représenté vs cible uniforme (1/6),
  liste des délaissés, `hasEnoughData` (≥ 12 séries). Métrique = **nombre de séries** (comparable
  entre groupes, contrairement au tonnage).
- Hook `useMuscleBalance()` (records-repository) — `COUNT` séries + `SUM` tonnage par groupe sur
  **14 j glissants** (mêmes filtres que `useMuscleVolumeThisWeek`).
- Section « Équilibre musculaire (14 j) » dans `/progress` : barres par séries **colorées** selon le
  classement (délaissé = doré `#c9a96e`, équilibré = accent, sur-représenté = grisé) + **alerte douce**
  listant les groupes délaissés (si historique ≥ 12 séries). i18n `progress.balance.*` FR/EN.
- `MuscleVolumeBarChart` étendu : couleur par barre optionnelle (`color?`), **rétrocompatible**.

**Notes**
- 100 % offline, **pas de migration**. Section « volume hebdo » + widget dashboard inchangés
  (non-régression ; chart rétrocompatible). Revue finale *prête à merger* (aucun bloquant). 663 tests verts.
- Ratio **pousser/tirer reporté à MUSC-11** (nécessite le « type de mouvement », absent du schéma).
  Catalogue MUSC-05 → ✅.

### 15/07/2026 — `feature/meta06-comparaison-periode` — META-06 livrée (delta N vs N-1, 3 surfaces)

**Ajouté**
- `percentChange(current, previous)` + `previousPeriodTodayKey(todayKey, period)` + types
  (`packages/shared/src/comparison.ts`, testés) — écart % + direction ↑/↓/→ (`previous=0` → `null`),
  et clé de jour de la période précédente (semaine −7 j, mois précédent, `all` → null).
- Composant mutualisé `DeltaBadge` (`apps/mobile/src/components/DeltaBadge.tsx`) — flèche + %
  (ou « nouveau »), **ton neutre** (couleur accent), a11y i18n. i18n `stats.delta.*` FR/EN.
- Hook `useRunStatsAt(period, todayKey)` (run-repository) — agrégat course sur une fenêtre décalée ;
  `useRunStats` délègue (comportement inchangé).
- Hook `useWeeklyVolumeComparison()` (records-repository) — volume muscu total semaine courante vs
  précédente (2 `SUM` bornés, jointure `exercises` alignée sur l'histogramme).
- Deltas « vs période précédente » sur **3 surfaces** : running (distance/temps/nb, sem/mois),
  nutrition (kcal moyens 7/30 j), muscu (volume hebdo total). i18n `progress.weeklyVolume.total`/`vsPrevious`.

**Notes**
- 100 % offline, **pas de migration**. `max_weight`/`volume`/affichages courants inchangés
  (non-régression). Revue finale *prête à merger* (aucun bloquant). 658 tests verts. Catalogue META-06 → ✅.
- Mineurs connus (non bloquants) : « 0 vs 0 » affiche « nouveau » (écran totalement vide) ; borne
  hebdo muscu décalée d'≈ 1 h les 2 semaines de bascule heure été/hiver (impact marginal).

### 15/07/2026 — `feature/musc04-courbe-1rm-periode-tout` — MUSC-04 clôturée (courbe 1RM estimé + période « tout »)

**Ajouté**
- `sessionBestEstimated1RM(sets)` (`packages/shared/src/records.ts`, testée) — meilleur 1RM estimé
  d'une séance (max de `estimate1RM` sur les séries à reps+poids non nuls, 0 sinon).
- Métrique `estimated_1rm` et période `all` dans `useExerciseProgression` (records-repository) :
  1RM estimé **par séance** (regroupement `workout_id`, agrégation JS via `sessionBestEstimated1RM`,
  **pas d'Epley en SQL**) ; borne `all` = epoch. Toggles `/progress` : 3 métriques × 4 périodes.
- i18n FR/EN : `progress.curve.metric.estimated_1rm`, `metricLabel.estimated_1rm`, `period.all`.

**Notes**
- Ferme le delta MUSC-04 vs spec 6.2 ; le reste de l'écran `/progress` existait déjà (~80 %).
  `max_weight`/`volume` **strictement inchangées** (SQL/mapping intouchés). Catalogue MUSC-04 → ✅.
- 100 % offline, **pas de migration**. Revue finale *prête à merger* (aucun bloquant). 647 tests verts.
- Recette : un exercice **au poids du corps** (charge 0) n'apparaît pas sur la courbe 1RM (voulu).

### 15/07/2026 — `feature/rn01-depense-course-objectif` — RN-01/RN-02 dépense course → objectif du jour (code livré)

**Ajouté (code)**
- `estimateRunCalories` (`packages/shared/src/running.ts`, testée) — dépense NET d'une course ≈ poids ×
  distance × 1,0 kcal/kg/km + terme d'intensité borné (EPOC, +1 %/km·h > 8 km/h, plafond +10 %) ;
  0 si distance/poids manquant.
- `dayCalorieBonus` + type `TrainingBonusMode` (`packages/shared/src/nutrition.ts`, testée) — bonus du
  jour selon le mode ; champ `trainingBonusMode` (`z.enum(['fixed','auto']).default('fixed')`) au
  `nutritionProfileRowSchema`.
- Hook `useDayCalorieTarget(dayKey)` (`dashboard-repository.ts`) — calcul **centralisé** de l'objectif
  effectif (mode, forfait, poids, courses du jour, gating running+nutrition) exposant `bonusSource`
  (`run`/`forfait`/`none`) ; consommé par `useNutritionSummary(today)` **et** le journal (jour sélectionné).
- Sélecteur **Forfait/Auto** dans l'écran profil nutrition (`Segment`) + badge adaptatif « · course »
  (journal + carte dashboard), i18n FR/EN (`bonusMode.*`, `runDayBadge`).
- Migration `20260715152227_nutrition_training_bonus_mode.sql` (colonne additive, défaut `'fixed'`,
  check `in ('fixed','auto')`) + colonne au schéma PowerSync local.

**Modifié**
- `nutrition.tsx` : suppression du recalcul local d'objectif effectif (dé-duplication) → consomme
  `useDayCalorieTarget(day)`, redevient sensible au jour navigable.
- `nutrition-repository.ts` : câblage `training_bonus_mode` ↔ `trainingBonusMode` (lecture + écriture,
  repli `'fixed'`).

**Notes**
- Revues spec + plan + revue finale (subagents) : ✅ prêt à merger, aucun bloquant. Non-régression du
  mode Forfait prouvée (identique à l'existant à l'arrondi près).
- ⚠️ **Séquencement obligatoire** : appliquer la migration cloud (`db:push` + `db:types`) **AVANT**
  toute bascule en mode **Auto** sur un device synchronisé — sinon l'`UPDATE` de `training_bonus_mode`
  vers un Postgres sans la colonne peut **bloquer la file de synchro PowerSync**. En lecture / mode
  Forfait, aucun risque (repli `'fixed'`).

### 15/07/2026 — `feature/rn01-depense-course-objectif` — Cadrage RN-01/RN-02 (dépense course → objectif du jour)

**Ajouté**
- `docs/specs/functional/us/rn01-depense-course-objectif.md` — spec validée : réglage **Forfait/Auto**
  du bonus calorique ; en Auto l'objectif du jour suit la **dépense estimée des courses terminées**
  (repli forfait muscu), Forfait inchangé. Formule NET ≈ poids × distance × 1,0 + terme d'intensité
  borné (EPOC, +1 %/km·h > 8 km/h, plafond +10 %). Croisement running↔nutrition, Phase A.
- `docs/plans/rn01-depense-course-objectif.md` — plan d'implémentation en 8 tâches (TDD, subagent-driven) :
  `estimateRunCalories` (running.ts) · `dayCalorieBonus` + mode Zod (nutrition.ts) · câblage repository
  mobile + schéma PowerSync local · migration `training_bonus_mode` · centralisation objectif effectif ·
  sélecteur profil · badge adaptatif · catalogue.

**Notes**
- Revue de spec + revue de plan (subagents) : références codebase vérifiées ; la revue de plan a
  rattrapé le câblage repository (le mobile ne parse pas via Zod) + le schéma PowerSync local, et
  2 bugs de référence (poids depuis `profile`, `localDayKey(new Date(...))`).
- Migration = **checkpoint 🔴 Florian** (`db:push` + `db:types`), non bloquante (défaut `'fixed'`).

## 15/07/2026 — Ajouté — IDEAS.md : SaaS coach (web) + arbitrage surfaces coach/créateur

Branche `docs/ideas-saas-coach`. Capture produit (aucun code, aucune US en pipeline). Issu d'un
échange de cadrage exploratoire avec Florian + recherche marché (WebSearch). Idée ciblée **post-V1**.

### Ajouté
- **IDEAS.md** — nouvelle idée `[[saas-coach-import-ia]]` (🔍 à creuser) : **SaaS web séparé** pour
  coachs (B2B, coach payant, athlète gratuit), 3 modules — **program builder « en béton »**
  (réutilise le constructeur admin US 8.4), **import IA de fichiers Excel/Sheets hétérogènes** = wedge
  choisi (parcours → inférence de structure → mapping en préviz → correction → push en base), et
  **dashboard coach** (athlètes, perfs, stats). Côté client = l'app Wellness gratuite. Monétisation
  incl. **paiements hors-plateforme sans commission**. Recherche marché consignée (catégorie saturée :
  Trainerize/TrueCoach/Everfit/… ; concurrent import à benchmarker = **Repport** ; gap paiements).
  Points durs notés : pipeline import IA non trivial ; **relation coach↔athlète casse le RLS `owner_id`**.

### Modifié
- **IDEAS.md** — arbitrage daté **15/07/2026** ajouté à `[[module-coach-coache]]` et
  `[[module-influenceur]]`, principe directeur : **on produit sur le web, on consomme sur mobile**
  (intensité 1-à-1 coach vs 1-à-N créateur décide de la surface). Conséquences : **console coach →
  SaaS web** (module coach mobile rendu superflu, seule la **face coaché** reste sur mobile) ;
  **influenceur reste sur mobile** côté audience (vente/communauté) mais **authoring = moteur web
  partagé** avec le SaaS coach. MàJ de `[[offre-payante-coach]]` (monétisation portée par le SaaS).

### Technique / Notes
- **Docs uniquement** (`IDEAS.md` + `CHANGELOG.md`) → lint/typecheck/tests non exécutés (aucune
  surface de code touchée). `TODO.md` non modifié (aucune US n'entre/ne sort du pipeline).
- Branche créée **depuis `origin/dev`** (et non depuis `feature/4.32-alerte-deficit-volume`) pour
  **ne pas embarquer** le commit de code 4.32 en cours (`e918efb`) dans `dev`.

## 15/07/2026 — Ajouté / Modifié — US 4.32 : alerte croisée déficit + volume (code livré, subagent-driven)

Branche `feature/4.32-alerte-deficit-volume`. Exécution subagent-driven (implémenteur + revues spec &
qualité par tâche, revue finale *ready to merge*). Première **stat croisée inter-piliers** livrée sous
forme de **widget dashboard conditionnel**. **100 % client, offline — aucune migration/cloud/natif.**

### Ajouté
- **`@wellness/shared/bodyweight.ts`** : `computeDeficitVolumeAlert({ loggedDailyKcals, targetKcal,
  weeklyVolume }) → { show, deficitPct, loggedDays }` + `MIN_LOGGED_DAYS = 4` (réutilise
  `shouldAlertDeficitVolume`/`averageIntake`). +tests (shared 631).
- **Registre dashboard** (`dashboard.ts`) : widget `deficit-volume` (`WIDGET_PILLARS`
  `['strength','nutrition']`) ; `dashboard.test.ts` mis à jour (8 widgets).
- **Hook** `useDeficitVolumeAlert` (`dashboard-repository.ts`) : `useDailyTotals(7 j)` (épars) →
  `loggedDailyKcals`, cible **de base** via `useNutritionSummary().target`, requête volume muscu 7 j
  glissante dédiée (`set_type != 'warmup'`), **gating muscu ET nutrition actifs**.
- **Widget** `DeficitVolumeAlertCard` (rend `null` hors alerte) + mapping `dashboard-widgets.tsx`.
- **i18n** `home.deficitVolume.{title,message}` FR/EN (`{{pct}}`).

### Modifié / Supprimé
- **`nutrition-stats.tsx`** : **retrait** de l'ancienne alerte (v1 faible, commit `193c5ff`) — bloc +
  calcul + requête volume + imports morts (`Ionicons`, `useQuery`, `useProfile`,
  `useNutritionProfile`, `tdee`, `targetCalories`, `objectiveFromGoal`, `computeAge`,
  `shouldAlertDeficitVolume`) + styles. Clé i18n **`stats.deficitAlert` supprimée** (FR/EN). Sections
  poids & apports intactes.

### Technique / Notes
- Gating « les deux piliers » porté par le hook (le registre filtre en `.some()`). Cible de base (pas
  ajustée jour-de-séance). Fenêtre 7 j (borne verbatim de l'existant). typecheck/tests(631)/lint verts.
- **Reste 🔴 recette (Florian/Damien)** : provoquer/lever l'alerte, gating piliers, disparition de
  l'écran Stats, cadre vide en mode édition. Export web KO = **pré-existant** (op-sqlite/better-sqlite3,
  sans rapport avec 4.32).

## 15/07/2026 — Ajouté — Plan d'implémentation US 4.32 (alerte déficit + volume, relu Approved)

Branche `feature/4.32-alerte-deficit-volume`. Plan issu de `writing-plans`, relu par sous-agent
`plan-document-reviewer` (Approved après corrections).

### Ajouté
- **Plan** [docs/plans/4.32-alerte-deficit-volume.md](docs/plans/4.32-alerte-deficit-volume.md) :
  7 tâches TDD — `computeDeficitVolumeAlert` (shared, testé), enregistrement widget `deficit-volume`
  au registre dashboard (+ maj `dashboard.test.ts`), hook `useDeficitVolumeAlert` (réutilise
  `useNutritionSummary().target` base + `useDailyTotals` + requête volume 7 j déplacée + gating
  piliers), widget `DeficitVolumeAlertCard` (rend `null` hors alerte), i18n `home.deficitVolume.*`
  FR/EN + retrait `stats.deficitAlert`, retrait de l'ancienne alerte sur `nutrition-stats.tsx`,
  vérif d'ensemble. Pas de checkpoint 🔴.

## 15/07/2026 — Ajouté — Spec US 4.32 : alerte croisée déficit + fort volume (cadrage validé)

Branche `feature/4.32-alerte-deficit-volume`. Première **stat croisée inter-piliers** (muscu↔nutrition)
du catalogue d'analyses — Phase A (déterministe, gratuite, offline, **sans IA**). Cadrage issu du
brainstorming (Florian), relu par un sous-agent `spec-document-reviewer` (Approved).

### Ajouté
- **Spec fonctionnelle** [docs/specs/functional/us/4.32-alerte-deficit-volume.md](docs/specs/functional/us/4.32-alerte-deficit-volume.md) :
  widget dashboard **conditionnel** alertant sur une semaine à déficit calorique ≥ 15 % (moyenne sur
  **≥ 4 jours loggés**) **et** volume muscu 7 j ≥ 8000, message **informatif** paramétré (`%`), gating
  **piliers actifs** (muscu **et** nutrition). Logique pure `computeDeficitVolumeAlert` (shared, testée)
  réutilisant `shouldAlertDeficitVolume`/`averageIntake` existants ; hook `useDeficitVolumeAlert`
  (requête volume 7 j glissante dédiée) ; widget `DeficitVolumeAlertCard`.

### Technique / Notes
- **Découverte en revue** : une **v1 faible** de 4.32 existe déjà en prod (commit `193c5ff`) sur
  l'écran **Stats nutrition** (message statique, sans `%`, sans règle ≥4 jours, **sans gating piliers**).
  **Décision (Florian)** : la **déplacer** sur le dashboard (retrait de l'ancienne + clé `stats.deficitAlert`).
  `TODO.md` marquait 4.32 « différé » à tort — corrigé.
- Gating dashboard confirmé : le registre filtre « au moins un pilier actif » → le « les deux requis »
  est porté par le hook. **100 % client, offline — pas de checkpoint 🔴.**

## 14/07/2026 — Ajouté — US 8.10 : log d'audit admin (code livré, subagent-driven)

Branche `feature/8.10-admin-log-audit`. Commit précédent : `c3cc92b` (plan). Exécution subagent-driven
(implémenteur + revues spec & qualité par tâche, revue finale *ready to merge*). Migration appliquée
sur le cloud (CLI, 14/07/2026), `db:types` régénérés.

### Ajouté
- **`@wellness/shared/audit.ts`** (pur, testé) : `AUDIT_ACTIONS` (14 actions, source unique array-first),
  `AuditAction` dérivé, `auditEntrySchema` (Zod), `auditActionLabelKey`. +5 tests (shared 625).
- **Migration `20260714170000_admin_audit_log.sql`** : table `audit_log` (web/admin, **hors PowerSync**),
  append-only — RLS `select` super_admin / `insert` admin (`actor_id = auth.uid()`), **aucune** policy
  update/delete + **trigger d'immuabilité**. Index created_at/actor/action.
- **`apps/admin/src/data/audit.ts`** : `logAudit` (best-effort, try/catch global, **ne lève jamais**,
  capte l'acteur via session) + `listAudit` (curseur `created_at`, filtres acteur/action/période).
- **Écran `/audit`** (`AuditScreen.tsx`, super_admin) : liste anti-chronologique, filtres
  acteur/action/dates (bornes en **fuseau local**), pagination « Charger plus » (garde anti-course
  `requestId`), états vide/erreur, date `JJ/MM/AAAA HH:MM`. Route + `NavLink` gated super_admin.
- **i18n admin FR** : section `audit` + 14 libellés d'action.

### Modifié
- **Instrumentation `logAudit`** (best-effort, après succès) : `roles.ts` (grant/revoke — `grantRole`
  retourne l'id d'attribution, log par branche écrivante), `exercises.ts` (create/update/publish/archive),
  `programs.ts` (create/update/publish/archive), `foods.ts` (create/update/archive + import = 1 entrée).
  Écrans passant le libellé : Exercises/Programs/Foods/Roles. Paramètres additifs (`opts?.label`,
  `revokeRole(id, {role,userId})`) — retours inchangés, aucun appelant cassé.

### Technique / Notes
- **Écart assumé vs spec §7** (retenu) : `setStatus`/`archive*`/`revokeRole` reçoivent un libellé
  optionnel de l'écran (le nom n'est pas en main dans la couche). Publication tracée uniquement au
  passage à `published` (dépublication non tracée). Sous-éditions de programme non auditées.
- **Point relevé en revue finale (à trancher recette)** : publier un exercice **depuis le formulaire
  d'édition** est journalisé `exercise.update` (et non `.publish`) — `saveExercise` décide selon
  `input.id` ; seul le bouton de publication de la **liste** émet `exercise.publish`. Conforme spec §7 ;
  à accepter ou objet d'un suivi.
- **Limitations mineures acceptées** : curseur `created_at` sans tie-break ; filtre acteur limité aux
  lignes chargées.
- Vérif d'ensemble : typecheck (3 workspaces) + 625 tests shared + lint (0 erreur) + build admin verts.
- **Reste 🔴 recette (Florian/Damien)** : déclencher une action de chaque type → vérifier les entrées
  dans `/audit` ; tenter un `update`/`delete` d'entrée → refus (trigger).

## 14/07/2026 — Ajouté — Plan d'implémentation US 8.10 : log d'audit admin (relu, Approved)

Branche `feature/8.10-admin-log-audit`. Commit précédent : `e0005a1` (spec). Plan issu du skill
`writing-plans`, relu par un sous-agent `plan-document-reviewer` (Approved, signatures vérifiées
contre le code réel + migration validée contre 8.9).

### Ajouté
- **Plan d'implémentation** [docs/plans/8.10-admin-log-audit.md](docs/plans/8.10-admin-log-audit.md) :
  9 tâches TDD, commits fréquents. Structure — `@wellness/shared/audit.ts` (union d'actions,
  schéma Zod, clés libellés ; testé), migration `audit_log` (append-only, RLS super_admin, trigger
  d'immuabilité, hors PowerSync), `apps/admin/src/data/audit.ts` (`logAudit` best-effort +
  `listAudit` paginé), instrumentation des 4 couches data (rôles, exos, programmes, aliments),
  écran `/audit` super_admin + route + nav + i18n, vérification d'ensemble.

### Technique / Notes
- **Écart assumé vs spec §7** (à valider) : `setStatus`/`archive*`/`revokeRole` ne disposent que d'un
  `id`, pas du nom FR → ajout d'un **paramètre optionnel de libellé** passé par l'écran appelant
  (additif, comportement de retour inchangé). `grantRole` gagne `.select('id')` + retourne l'id
  d'attribution (log par branche écrivante). Publication tracée uniquement au passage à `published`
  (dépublication non tracée). Import CSV = 1 entrée `food.import` (`details.count`).
- **Checkpoint 🔴** à l'impl : migration `audit_log` via `db:push` + `db:types` (typecheck admin rouge
  tant que non appliqué). Aucune sync rule (hors PowerSync).

## 14/07/2026 — Ajouté — Spec US 8.10 : log d'audit admin (cadrage validé)

Branche `feature/8.10-admin-log-audit`. Commit précédent : `9626521`. Première des trois US de
gouvernance admin restantes (ordre acté : **8.10 audit → 8.7 modération → 8.8 utilisateurs**).
Cadrage complet issu du brainstorming (Florian, 14/07/2026), relu par un sous-agent
`spec-document-reviewer` (Approved après 4 corrections).

### Ajouté
- **Spec fonctionnelle** [docs/specs/functional/us/8.10-admin-log-audit.md](docs/specs/functional/us/8.10-admin-log-audit.md) :
  journal d'audit append-only et non supprimable des écritures éditoriales + rôles du back-office.
  - **Périmètre** : rôles (grant/revoke), CRUD exercices/programmes/aliments + import CSV.
    Exclus : lectures, actions mobile, diff avant/après, sous-éditions de structure d'un programme.
  - **Capture applicative** (approche A) : `logAudit()` après chaque mutation, best-effort non
    bloquant. Modèle de menace assumé (clé anon, équipe interne de confiance) ; durcissement futur
    possible via trigger `user_roles` sans casse.
  - **Modèle de données** : table `audit_log` (web/admin, hors PowerSync) — `actor_id`/`actor_email`
    (snapshot, pas de FK cascade), `action`/`target_table`/`target_id`/`target_label`/`details` jsonb.
    Schéma générique → accueillera 8.7/8.8 sans migration.
  - **Immuabilité** : RLS `select` super_admin, `insert` admin (`actor_id = auth.uid()`), aucune
    policy update/delete + trigger anti-`UPDATE`/`DELETE`.
  - **Écran** `/audit` (super_admin) : liste anti-chronologique + filtres acteur/action/période.
  - Logique pure `@wellness/shared/audit.ts` (testée), couche I/O `apps/admin/src/data/audit.ts`.

### Technique / Notes
- Décision produit (Florian) : détail limité à qui/quoi/cible/quand + libellé (pas de diff) ;
  consultation super_admin only. Checkpoint 🔴 à l'implémentation : migration `audit_log` + `db:types`.

## 14/07/2026 — Technique / Notes — Outillage migrations cloud + config build EAS + nettoyage prebuild

Branche `feature/seed-ciqual-enrichment`. Commit précédent : `0b1fac2`. Aligne la doc et l'outillage
sur le workflow **migrations directement sur le cloud** (pas de Docker chez les devs) et fiabilise le
build Android local.

### Ajouté
- **`package.json`** (racine) : scripts `db:new` (`supabase migration new`), `db:push`
  (`supabase db push`) et `db:push:dry` (`--dry-run`) — remplacent le copier-coller de SQL dans la
  console Supabase.
- **`apps/mobile/eas.json`** : bloc `env` sur le profil **preview** — `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` (clé **publishable**, publique par nature — protégée par RLS),
  `EXPO_PUBLIC_POWERSYNC_URL`. Pas de secret (`service_role` jamais exposée).

### Modifié
- **`CLAUDE.md`** : nouvelle section « Migrations base de données (OBLIGATOIRE) » (cycle sans Docker,
  garde-fou `--linked`, réconciliation `migration repair`) ; tableau des commandes Supabase avec
  colonne « Docker requis » ; état Supabase passé à **cloud provisionné** ; ajout du registre
  `supabase/MIGRATIONS.md` dans l'arborescence doc.
- **`supabase/MIGRATIONS.md`** : réalignement du tableau + ligne `20260714120000_seed_library_foods_ciqual`
  (à pousser).

### Supprimé (nettoyage)
- **`android/` (racine)** et **`app.json` (racine)** : artefacts d'un `npx expo run:android` lancé par
  erreur depuis la racine au lieu de `apps/mobile/`. Le vrai projet natif est `apps/mobile/android/`.
- Bloc `dependencies` (`expo`/`react`/`react-native`) injecté par erreur dans le **`package.json`
  racine** par ce même prebuild — ces deps appartiennent à `apps/mobile`, pas au workspace racine
  (annulé, avec restauration de `package-lock.json`).

### Notes débogage (environnement)
- Build Android local KO tant que `ANDROID_HOME`/`ANDROID_SDK_ROOT` contenaient des **guillemets
  littéraux** (« syntaxe du nom de fichier incorrecte » côté Gradle). Corrigé au niveau **variables
  User** (valeurs sans guillemets) + `platform-tools` ajouté au `PATH`. Rouvrir le terminal après coup.
- Détection du Pixel 6a par `adb` : nécessite serveur adb propre (`kill-server`/`start-server`) +
  autorisation RSA acceptée sur le téléphone + mode USB « Transfert de fichiers ».

## 14/07/2026 — Ajouté — Bibliothèque d'aliments enrichie CIQUAL 2025 (80 aliments, via migration)

Branche `feature/seed-ciqual-enrichment`. Réalise l'US d'enrichissement — **approche A** (voir révision
dans spec/plan). Données 100 % **CIQUAL 2025** (ANSES, Licence Ouverte / Etalab).

### Ajouté
- **Migration idempotente** `supabase/migrations/20260714120000_seed_library_foods_ciqual.sql` : upsert
  de **80 aliments de bibliothèque** (foods + food_translations FR/EN + `micronutrients`). **50**
  aliments existants voient **toute leur nutrition** (macros de base + sous-macros + 31 micros) reprise
  de CIQUAL, identités conservées (UUID/noms/catégorie/portions) ; **+30 nouveaux** (fruits, légumes,
  viandes/poissons, légumineuses, oléagineux). `on conflict do update` → réconcilie les aliments déjà
  présents sur le cloud + insère les nouveaux ; rejouable au `db:reset`.
- **Tooling reproductible** `supabase/scripts/enrich-ciqual/` : `generate.py` (stdlib, CSV→migration),
  `foods-catalog.json` (source unique : identité + code CIQUAL par aliment), `mapping-columns.json`
  (index colonne CIQUAL → clé/unité), `README.md`, `.gitignore` (export brut hors git).

### Modifié / Supprimé
- **`supabase/seed.sql`** : la bibliothèque d'aliments **quitte le seed** (remplacée par un pointeur
  vers la migration). Motif : nouvelle règle CLAUDE.md « jamais de SQL manuel en console » → la donnée
  de référence cloud passe par une migration versionnée (`db:push`), plus par une application hors-bande.
- **MIGRATIONS.md** : ligne ajoutée (`[ ]`, à pousser).

### Technique / Notes
- **Present-only, « ne rien inventer »** : `traces`/`NC`/`< x`/`-` omis. **Oméga** = somme des AG
  mesurés CIQUAL (ALA+EPA+DHA / linoléique+arachidonique / oléique). **Absents de CIQUAL 2025** :
  `trans_fat_g`, `vitamin_b7_ug` (biotine) → jamais renseignés. **Café noir** : pas de café-boisson
  dans CIQUAL (seulement « café moulu ») → non mappé, valeurs conservées. **Vitamine A** = colonne
  « équivalents rétinol (µg) ». Macros CIQUAL « - » → 0 (correct : glucides viandes, lipides fruits…).
- **Reste** : `npm run db:push` (cloud) + cocher MIGRATIONS.md + `npm run db:reset` + `db:types`
  (local, Docker) + recette device. **Aucune dépendance native.**

## 14/07/2026 — Technique/Notes — Cadrage US « enrichir le seed CIQUAL »

Branche `feature/seed-ciqual-enrichment`. **Cadrage seul (aucun code applicatif)** ; brainstorming +
design validés par Florian.

### Ajouté
- **Spec** [seed-ciqual-enrichment.md](docs/specs/functional/us/seed-ciqual-enrichment.md) + **plan**
  [seed-ciqual-enrichment.md](docs/plans/seed-ciqual-enrichment.md). Objectif : compléter les ~50
  aliments du seed avec les **micros (31) + sous-macros** issus de **CIQUAL** (ANSES), sans toucher les
  macros de base, via un **générateur reproductible** (export CIQUAL + `mapping-foods` UUID→code +
  `mapping-columns` → `UPDATE public.foods` dans `seed.sql` + `cloud-update.sql` one-shot).
- Décisions actées : source = export officiel fourni par Florian (hors git, licence Etalab) ; périmètre
  = 50 aliments seed ; livraison = seed + one-shot cloud (🔴) ; **present-only, « ne rien inventer »**
  (tokens `traces`/`NC`/`< x` omis) ; vitamine A mappée seulement si colonne µg présente.

### Technique / Notes
- **Bloqué** en attente de l'export ANSES CIQUAL (CSV) de Florian (Task 0). Ensuite : relecture Florian
  du `mapping-foods.json` (appariement aliment↔code CIQUAL). Aucune migration, aucun code runtime.

## 14/07/2026 — Ajouté — Panel nutritionnel étendu (10 → 31 micronutriments)

Branche `feature/panel-nutritionnel-etendu`. Implémentation de l'US cadrée + validée (spec + plan),
exécution subagent-driven + **revue de code indépendante *Approved***.

### Ajouté
- **+21 micronutriments** au panel (socle 10 → 31) : AG **monoinsaturés / polyinsaturés / trans** +
  **oméga-3/6/9** ; minéraux **zinc, phosphore, cuivre, manganèse, sélénium, iode** ; vitamines
  **A, E, K, B1, B2, B3, B5, B6, B7** (C/D/B9/B12 déjà gérées). Source unique `MICRONUTRIENT_KEYS`
  (`packages/shared/src/food.ts`) → schéma Zod, `scaleMicronutrients`/`sumMicronutrients`, import CSV
  et validation du formulaire admin **dérivent automatiquement**.
- **Capture OpenFoodFacts** (`apps/mobile/src/lib/openfoodfacts.ts`, `MICRO_MAP` 31 entrées) :
  conversion `*_100g` (grammes) → unité de la clé (g ×1 / mg ×1000 / µg ×1e6). **Garde vitamine A** :
  omise si l'unité OFF (`vitamin-a_unit`) n'est pas massique (ex. IU) → pas de valeur fausse. La clé
  `vitamin_a_ug` reste affichable/éditable (seed CIQUAL / admin).
- **Affichage** (`MicronutrientDetails.tsx`) : groupes Lipides / Minéraux / Vitamines étendus, unité
  `g` ajoutée au type `Unit`, `unitLabel` généralisé. **Present-only** conservé (aliment pauvre =
  rendu inchangé). **Formulaire admin** (`FoodEditScreen`) couvre les 31 (via `MICRONUTRIENT_KEYS`).

### Technique / Notes
- **Aucune migration** (colonne JSON `micronutrients`), **aucune dépendance native**, pas de checkpoint 🔴.
- i18n : +21 libellés mobile FR/EN (`nutrition.micros.labels.*`, parité **808/808**) + 21 libellés
  admin FR (`fr.foods.microNames`). Tests : shared **620**, mobile **42** (dont mapping OFF étendu +
  garde vit A IU). typecheck (3 workspaces) / lint (0 err) / build admin verts.
- **Écart de plan corrigé** : le découpage en 5 commits par tâche n'était pas viable (le typage
  exhaustif TS couple `MICRONUTRIENT_KEYS` au fixture `food-form.test.ts` et à l'indexation
  `fr.foods.microNames`) → **implémentation atomique en un commit**. `Unit` n'incluait pas `'g'`
  (supposé à tort dans le plan) → corrigé.
- **Valeur réelle** conditionnée à l'enrichissement du **seed CIQUAL** (US tracée) : un Nutella scanné
  reste pauvre (donnée absente d'OFF), c'est attendu. **Reste** : recette device.

## 14/07/2026 — Technique/Notes — Cadrage US « panel nutritionnel étendu » (spec validée)

Branche `feature/panel-nutritionnel-etendu`. **Cadrage uniquement (aucun code applicatif).**

### Ajouté
- **Spec** [panel-nutritionnel-etendu.md](docs/specs/functional/us/panel-nutritionnel-etendu.md),
  **validée par Florian** : étendre le panel micronutriments de 10 → 31 nutriments (AG mono/poly/trans
  + oméga-3/6/9, minéraux zinc/phosphore/cuivre/manganèse/sélénium/iode, vitamines A/E/K/B1/B2/B3/B5/
  B6/B7), stockés dans la colonne JSON `micronutrients` (**aucune migration**), captés depuis OFF
  (present-only, garde-fou unité vitamine A en IU). Décisions produit : périmètre complet, **pas de
  2ᵉ source** (USDA/CIQUAL par nom) pour l'instant.

### Modifié
- **TODO.md** : US « panel nutritionnel étendu » passée en cadrage (`[~]`, spec validée, reste
  plan → maquette → code) ; nouvelle US **« enrichir le seed avec les données CIQUAL détaillées »**
  tracée (prérequis à la valeur réelle du panel — les produits scannés OFF n'ont pas ces détails).

## 14/07/2026 — Corrigé + Modifié — Scan code-barres : échecs honnêtes + affichage nutritionnel enrichi

Branche `fix/scan-code-barres`. Investigation d'un « produit introuvable » au scan (Florian, adb
logcat + test direct de l'endpoint OFF). **Diagnostic** : ni OpenFoodFacts (HTTP 200 + données
complètes pour le Nutella `3017620422003`, quel que soit le User-Agent), ni notre parsing n'étaient
en cause. Le scan **fonctionne** (validé sur une bouteille Perrier physique) ; les échecs venaient de
scanner des **codes-barres à l'écran** (images Google / site OFF) → mauvaise lecture caméra → code
erroné réellement absent d'OFF. Le pot de Nutella lui-même ne scanne pas (surface courbée/brillante =
autofocus qui peine), ce n'est pas un bug.

### Corrigé
- **Messages d'échec de scan honnêtes** : `fetchOpenFoodFactsByBarcode` ne renvoie plus un `null`
  fourre-tout mais un **résultat typé** `OffLookup` (`found` / `notFound` / `incomplete` /
  `networkError` / `invalidCode`). L'écran de scan affiche désormais un message distinct :
  « Pas de connexion » (réseau), « Code-barres inconnu (`<code lu>`) » (avec le code, pour repérer
  une mauvaise lecture), ou « fiche sans calories ». Avant : tout tombait sur « produit introuvable ».
- Logique de décision isolée dans un helper **pur `interpretOffProduct`** (testable sans réseau).

### Modifié
- **Affichage nutritionnel au scan / dans le picker** : le `QuantityPanel` affiche maintenant la ligne
  **macros P/G/L** (mise à l'échelle en direct, motif repris de `nutrition-stats`), et **sucres /
  AG saturés / fibres** sont désormais **captés depuis OFF** (`mapProduct` + `OffFood` étendus),
  **stockés** à l'import (`importOpenFoodFactsFood`, au lieu de `null`) et affichés present-only.
  Les deux flux (scan + recherche texte du food-picker) passent ces champs au panneau.

### Technique / Notes
- **i18n** FR/EN : +3 clés `scan.error.*` (parité 787/787) ; macros réutilisent `nutrition.macros.*`
  (aucune nouvelle clé). Sucres/AGS/fibres réutilisent `food.custom.*`.
- Tests `packages`… → mobile `openfoodfacts.test.ts` : +5 tests sur `interpretOffProduct` (found +
  repli code-barres + sous-macros, notFound status 0, incomplete sans kcal / sans nom). 39/39 mobile.
- **100 % client** — aucune migration, aucune dépendance native, pas de checkpoint 🔴.
- **Point d'attention** : les produits déjà importés **avant** ce commit ont sucres/AGS/fibres à
  `null` en local → au re-scan ils remontent depuis le local sans ces champs ; les nouveaux scans ont
  tout. Logs de diagnostic temporaires (`[SCAN]…`) retirés. `apps/mobile/eas.json` **non commité**
  (contournement env local de Florian, contient des identifiants → hors git par convention).

## 14/07/2026 — Corrigé — Onglets du food-picker étirés en hauteur (régression `scrollable`)

Branche `fix/food-picker-onglets-scrollable`. Bug d'affichage remonté par Florian (capture) sur
l'écran « Ajouter un aliment » : l'onglet sélectionné (« Tous ») s'affichait comme une grande
barre orange occupant presque toute la hauteur de l'écran, libellé collé en haut, poussant la
liste des aliments vers le bas. Régression introduite par le passage des onglets en `ScrollView`
horizontal (commit `41e459b`).

### Corrigé
- [Segment.tsx](apps/mobile/src/components/Segment.tsx) (variante `scrollable`) : un `ScrollView`
  horizontal placé **directement** dans un flex colonne (`food-picker` `styles.screen`, `flex: 1`)
  s'étire sur toute la hauteur disponible, et comme `contentContainerStyle` garde
  `alignItems: stretch` par défaut, chaque onglet s'étire avec lui. Correctif : envelopper le
  `ScrollView` dans une `View` qui se cale sur la hauteur du contenu et porte désormais le cadre
  (bordure/rayon/fond) ; le `ScrollView` ne gère plus que le défilement horizontal. Le `style`
  `styles.viewport` passe de la `ScrollView` à la `View`.

### Technique / Notes
- Correctif **UI pur, 100 % client** — aucune migration, aucun cloud, pas de checkpoint 🔴,
  pas de chaîne i18n touchée.
- typecheck vert (tous workspaces), lint 0 erreur (4 warnings préexistants dans le smoke test
  charts, sans rapport), 619 tests shared verts. Pas de test unitaire ajouté : bug de mise en
  page RN sans logique testable. **Recette device validée par Florian le 14/07/2026** ✅ (barre
  d'onglets revenue à une hauteur d'une ligne, défilement horizontal OK).
- **Non committé dans cette passe** : la modification de [eas.json](apps/mobile/eas.json) (bloc
  `env` `EXPO_PUBLIC_*` au profil `preview`) toujours présente dans l'arbre — sujet distinct qui
  contredit la décision documentée (env via `eas env:push`), laissée de côté comme au commit
  précédent.

## 14/07/2026 — Modifié — Mise à jour du TODO rendue obligatoire à chaque `/commit`

Branche `fix/food-picker-onglets-scrollable`. Demande de Florian : rendre explicite, dans la
définition du workflow, que la commande `/commit` **doit** tenir à jour le suivi.

### Modifié
- [CLAUDE.md](CLAUDE.md) (section « Commits ») : la puce « coche le TODO.md » devient
  « **met à jour le TODO.md** — étape **obligatoire** à chaque commit & push » (cocher `[x]` ce
  qui est livré, passer en `[~]` ce qui est en cours, actualiser la date de « Dernière mise à
  jour »). Cohérent avec la section « Suivi — TODO.md » déjà présente.

### Technique / Notes
- Modification **documentaire uniquement** (Markdown) — aucun code applicatif touché, pas de
  lint/typecheck/tests pertinents.
- **Non committé dans cette passe** : une modification de [eas.json](apps/mobile/eas.json) (ajout
  d'un bloc `env` `EXPO_PUBLIC_*` au profil `preview`) présente dans l'arbre de travail. Sujet
  distinct, laissé de côté car il **contredit la décision documentée** (config env via
  `eas env:push`, `eas.json` sans bloc `env` — cf. TODO §URGENT) → à trancher avec Florian/Damien.

## 13/07/2026 — Corrigé — Onglets « Ajouter un aliment » qui passaient à la ligne

Branche `fix/food-picker-onglets-scrollable`. Sur l'écran food-picker, les 5 onglets
(Tous / Favoris / Récents / Recettes / Repas types) étaient rendus en `Segment` mode fixe
(`flex: 1`, sans `numberOfLines`) → « Repas types » débordait sur 2 lignes (affichage disgracieux,
remonté par Florian, capture device).

### Corrigé
- [food-picker.tsx](apps/mobile/src/app/food-picker.tsx) : ajout de la prop **`scrollable`** au
  `Segment` des onglets → libellés à largeur intrinsèque, une seule ligne, défilement horizontal si
  débordement (même patron que les filtres running). Aucune autre modification.

### Technique / Notes
- Le composant [Segment](apps/mobile/src/components/Segment.tsx) prévoyait déjà ce mode (prop
  documentée « libellés nombreux/longs ») — correctif d'une ligne, aucun changement du composant.
- typecheck vert (3 workspaces) ; lint mobile 0 erreur (4 warnings préexistants hors périmètre).
  **100 % client, aucune migration, aucune dépendance native.** Reste : recette device.

## 13/07/2026 — Corrigé — Fuite inter-piliers dans « Mes programmes » muscu

Branche `fix/programmes-filtre-pilier` (depuis `dev`). Bug remonté par Florian en recette :
côté **Musculation**, l'écran « Mes programmes » **et** la « Bibliothèque » affichaient aussi les
programmes **running**.

### Corrigé
- [apps/mobile/src/app/programs/index.tsx](apps/mobile/src/app/programs/index.tsx) : l'écran muscu
  ne passait **jamais** le pilier → `useMyPrograms()` sans argument (tous piliers) et `filters` sans
  `pillar`. Fix (~2 lignes, miroir de l'écran running) : `useMyPrograms('strength')` + `pillar:
  'strength'` toujours présent dans `ProgramLibraryFilters` (avec ou sans filtre de niveau).

### Technique / Notes
- Bug **unidirectionnel** : l'écran running filtrait déjà correctement (`useMyPrograms('running')` +
  `useProgramLibrary({ pillar: 'running' })`) — confirmé par Florian. Seul le muscu était touché.
- typecheck mobile vert. **100 % client, aucune migration, pas de checkpoint 🔴.** **Reste** : vérif device.

## 13/07/2026 — Feat — US 8.5 : gestion de la base d'aliments (CRUD éditorial admin)

Branche `feature/8.5-gestion-aliments` (depuis `dev` `63acf79`). Cadrage complet
(brainstorming → spec → plan) puis exécution TDD. Complément unitaire de l'import CSV (8.6) :
lister / rechercher / créer / éditer / archiver les aliments éditoriaux (`owner_id NULL`,
`source library`).

### Ajouté
- **`@wellness/shared/food-form.ts`** : `validateFoodInput(input)` pur — valide/mappe les champs
  saisis (nom FR/EN requis, `category` ∈ enum, kcal requis ≥ 0, macros/micros optionnels ≥ 0,
  virgule décimale tolérée, seules les clés micros fournies conservées via `micronutrientsSchema`),
  renvoie `values` typé ou `errors` par champ. **9 tests** (TDD).
- **Migration** `20260713160000_admin_editorial_foods_rls.sql` : rouvre `insert`/`update` sur
  `foods` + `food_translations` à `is_content_editor()` (patron identique 8.2/8.4).
- **Admin** : couche `data/foods.ts` étendue (`listEditorialFoods`, `getFood`, `saveFood`
  **insert/update ciblé**, `archiveFood` soft-delete) ; écran **liste** `FoodsScreen`
  (recherche + filtre catégorie + « Nouvel aliment » + « Importer un CSV » + éditer/archiver) ;
  écran **formulaire** `FoodEditScreen` (création/édition, nom FR/EN, catégorie, kcal, 6 macros,
  10 micros, `import_key` en lecture seule, erreurs par champ) ; i18n admin FR.

### Modifié
- **Routing « Aliments »** réorganisé : la **liste devient le hub** (`/foods` → `FoodsScreen`) ;
  l'import CSV 8.6 déplacé en `/foods/import` (+ lien retour) ; `/foods/new` et `/foods/:id` →
  `FoodEditScreen`. Nav « Aliments » inchangée (pointe `/foods`).

### Technique / Notes
- 🔴 **La migration RLS répare aussi l'US 8.6** : la RLS d'origine
  ([20260706150001_food_rls.sql](supabase/migrations/20260706150001_food_rls.sql)) n'autorisait
  l'écriture que pour `owner_id = auth.uid()` — l'écriture **éditoriale** (`owner_id NULL`) n'avait
  jamais été rouverte aux éditeurs de contenu (contrairement aux exos/programmes). Sans elle,
  **ni 8.5 ni l'import 8.6** ne peuvent écrire l'éditorial. La note « RLS inchangée » de la spec 8.6
  §4 était **erronée** — corrigée ici.
- **Pas de `db:types`, pas de sync rule à redéployer** (RLS seule ; archivage via `deleted_at` déjà
  couvert). Pas de dépendance native. 100 % client admin.
- **update ciblé à l'édition** (et non upsert) : ne touche que les colonnes du formulaire →
  `portions` / `import_key` / `barcode` intacts.
- Vérifs : typecheck (tous) OK, shared **619** tests (dont 9 nouveaux), mobile 34, lint 0 erreur,
  build admin OK. Revue du diff : miroir du CRUD exos 8.2 (déjà relu), validateur testé.
- **Reste 🔴 Florian** : appliquer la migration RLS foods (**débloque 8.5 + 8.6**) puis recette
  (créer / éditer / archiver un aliment ; ré-import CSV 8.6 fonctionnel ; affichage mobile).
- Différé : validation des aliments signalés (→ 8.7), restauration d'un archivé, édition des
  `portions`, audit (→ 8.10).

## 13/07/2026 — Feat — US 8.6 : import d'aliments par CSV (CIQUAL), back-office

Branche `feature/8.6-import-csv-ciqual` (depuis `dev` `81064a5`). Cadrage complet
(brainstorming → spec → plan) puis exécution TDD. Remplissage en masse de la base d'aliments
éditoriale depuis un CSV formaté (FR/EN + macros + micros).

### Ajouté
- **`@wellness/shared/food-csv.ts`** : `parseFoodCsv(rows)` pur — validation/mapping ligne à ligne
  (requis, `category` ∈ enum, nombres ≥ 0, `import_key` unique intra-fichier, micros via
  `micronutrientsSchema`), sépare `valid` / `errors` (ligne, champ, raison). **8 tests** (TDD).
- **Migration** `20260713150000_foods_import_key.sql` : colonne `foods.import_key` + index unique
  (arbitre `on conflict` de l'upsert idempotent ; NULL illimités pour OFF/custom). `database.types`
  régénéré (`import_key`).
- **Admin** : écran **Import CSV** (`screens/FoodImportScreen.tsx`) — upload → papaparse → aperçu
  (N valides / M erreurs) → confirmation → rapport (créés / mis à jour) + modèle CSV téléchargeable ;
  couche `data/foods.ts` (`importFoods` upsert `foods` par `import_key` + `food_translations` FR/EN,
  `owner_id NULL`, `source library`) ; route `/foods` + nav « Aliments » gated `content_editor` ;
  i18n admin FR ; dépendance `papaparse`.

### Technique / Notes
- Contrat CSV (spec §3) : `import_key, name_fr, name_en, category, kcal_per_100g` requis ;
  macros + 10 micros (`MICRONUTRIENT_KEYS`) optionnels. `portions` hors v1.
- Vérifs : typecheck (tous) OK, shared **610** tests, mobile 34, lint 0 erreur, build admin OK.
- **Checkpoint 🔴 déjà appliqué** (migration cloud + `db:types`, 13/07). **Reste** : recette (import
  d'un échantillon CIQUAL réel, ré-import idempotent, vérif base + affichage mobile) + relecture Damien.
- Différé : 8.5 (CRUD/édition unitaire), annulation/rollback d'import, import depuis le mobile.

## 13/07/2026 — Feat — Détail programme : séances repliables (expansion inline, muscu + running)

Branche `feature/detail-programme-seances-repliables` (depuis `dev` `abaf5df`). Cadrage complet
(brainstorming → spec → plan, maquette écartée / validation device — précédent 1.15). Exécution
TDD, 5 tâches, commits par tâche.

### Ajouté
- **`components/CollapsibleCard.tsx`** : carte de séance repliable réutilisable (en-tête tappable
  titre + résumé + chevron, toggle local éphémère, `footer` toujours visible, animation
  `LayoutAnimation` sobre dégradable). Test unitaire (`+1`, replié→déplié).
- i18n `programs.detail.exerciseCount` (pluriel `_one`/`_other`) fr + en.

### Modifié
- **Muscu** ([programs/[id].tsx](../apps/mobile/src/app/programs/[id].tsx)) : `SessionCard` via
  `CollapsibleCard` — séances **repliées par défaut**, ouverture **indépendante** ; en-tête =
  nom + « N exercices » ; bouton **« Démarrer »** en `footer` (accessible replié). Styles morts
  supprimés (`sessionCard`, `sessionName`).
- **Running** ([running-programs/[id].tsx](../apps/mobile/src/app/running-programs/[id].tsx)) :
  `RunningSessionCard` via `CollapsibleCard` — résumé d'en-tête = **type + cible** (« Endurance ·
  8 km ») ; détail (puces type/cible + allure) au dépli. Pas de bouton par séance (inchangé).

### Corrigé
- **Nom d'exercice tronqué** (bug #1) dans `PlanRow` (muscu) : nom et objectifs passent sur **2
  lignes** (objectifs sous le nom) au lieu de `space-between` sur une ligne → fini le « T… ».

### Technique / Notes
- Vérifs vertes : typecheck (tous), mobile **34** tests (10 suites), lint **0 erreur**, i18n
  **796/796**. **100 % client** : aucune donnée/migration/dépendance native. Pas de checkpoint 🔴.
- **Reste** : recette **device** (risque visuel — repli/dépli, nom 2 lignes, Démarrer replié) +
  relecture Damien avant merge.

## 13/07/2026 — Fix — Typecheck `running-history` au vert (route typée)

Branche `fix/finitions-affichage-profils` (depuis `dev` `bbbf82d`). Lot « finitions ».

### Corrigé
- **2 erreurs typecheck préexistantes** dans `app/running-history/index.tsx` : les
  `router.push('/run/summary?id=' + …)` (string brute rejetée par le typage de route
  expo-router) passent en **forme objet typée** `{ pathname: '/run/summary', params: { id } }`,
  alignée sur l'usage existant de `run/active.tsx`. **Typecheck 100 % vert** sur tous les workspaces.

### Technique / Notes
- **Vérification (pas de correctif nécessaire)** : `nutrition-profile.tsx` et `running-profile.tsx`
  ne souffrent PAS du bug « affichage vide » (contrairement à `profile.tsx`/`infos.tsx`) — ils
  lisent leur donnée de façon **réactive** (consts dérivés à chaque rendu, `paceText` retombe sur
  la valeur persistée), sans snapshot `useState` au montage. Point de suivi levé.
- Vérifs vertes : typecheck OK, mobile 33 tests, lint 0 erreur.
- Reste ouvert : bug **détail programme** (nom tronqué + séance non cliquable) → à cadrer.

## 13/07/2026 — Fix — Rejeu onboarding : crash, profil affiché vide, date de naissance −1

Branche `fix/onboarding-rejeu-profil` (depuis `dev` `92ef71e`). Correction du bug bloquant
« crash + non-enregistrement au 2ᵉ passage de l'onboarding depuis le profil » + finitions.
Diagnostic device via `adb logcat` (crash JS) puis logs `console.log` temporaires (base saine
mais affichée vide) — cause racine confirmée à chaque étape, pas de correctif à l'aveugle.

### Corrigé
- **Crash au « Terminer » du rejeu** (`TypeError: undefined is not a function` dans
  `OnboardingSummary`) : `active_pillars` triple-encodé était relu comme **chaîne** typée
  `Pillar[]` → `activePillars.map` plantait le rendu. `parseJsonColumn` gagne un **validateur
  de forme** optionnel (`isValid`) et déballe jusqu'à 3 niveaux ; `settings-repository` valide
  que `active_pillars` est bien un tableau de piliers (`isPillarArray`) aux 2 points de lecture.
- **Profil affiché vide alors que plein en base** (bug d'affichage, données bien enregistrées) :
  `profile.tsx` et `(onboarding)/infos.tsx` figeaient leur formulaire depuis `useProfile()` **au
  montage**, or `useQuery` (PowerSync) renvoie `null` au 1ᵉʳ rendu puis les données un tick plus
  tard → champs vides jamais re-remplis. Ajout d'un **gate sur `isLoading`** (composant formulaire
  monté après résolution de la requête) sur les 2 écrans.
- **Perte de données au rejeu** : garde anti-écrasement (prénom / sexe / date) dans `infos.tsx`
  (à l'image de poids/taille) — un champ non modifié réécrit la valeur du profil, jamais un blanc.
- **Date de naissance enregistrée à J−1** : `toDate(...).toISOString()` convertissait une date à
  minuit **local** en **UTC** (décalage −1 j en fuseau UTC+). Nouveau helper pur **`toIsoDate`**
  (formatage depuis les composants locaux, validé) ; `infos.tsx` + `profile.tsx` l'utilisent.
- **UI « Modifier le profil »** : sélecteur d'objectif en mode `scrollable` (une ligne) — plus de
  retour à la ligne disgracieux.
- **Note récap onboarding** obsolète (« synchro arrive bientôt ») → « profil enregistré et
  synchronisé de façon sécurisée » (fr + en), la synchro PowerSync étant active.

### Ajouté
- `packages/shared/src/age.ts` : `toIsoDate(day, month, year)` (+3 tests) — date-only ISO sans
  décalage de fuseau.
- `packages/shared/src/json-column.ts` : paramètre `isValid` sur `parseJsonColumn` (+3 tests,
  triple-encodage + rejet de forme).
- `docs/specs/technical/dev-build-android-local.md` : procédure complète **dev build Android en
  local** (JDK 17, SDK/NDK, `gradle.properties`, `ANDROID_HOME`/`local.properties`, conflit de
  signature, dépannage) — pour que Damien reproduise le setup.

### Fichiers touchés
`packages/shared/src/{age,json-column}.ts` (+ tests), `settings-repository.ts`,
`app/(onboarding)/infos.tsx`, `app/profile.tsx`, `i18n/locales/{fr,en}.json`,
`docs/specs/technical/dev-build-android-local.md`.

### Technique / Notes
- Vérifs vertes : shared **602** tests, mobile **33**, lint **0 erreur**, parité i18n **794/794**.
- **Point d'attention (hors périmètre)** : `nutrition-profile.tsx` et `running-profile.tsx`
  utilisent probablement le même schéma d'init au montage → même risque d'affichage vide à
  l'ouverture ; à corriger dans un lot dédié (même gate `isLoading`).
- **2 erreurs typecheck préexistantes** dans `app/running-history/index.tsx` (déjà sur `dev`,
  non introduites ici) — à traiter à part.
- 100 % client : aucune migration, aucun redéploiement de sync rules, aucune dépendance native.

## 13/07/2026 — US 8.4 — Admin : constructeur de programmes éditoriaux (muscu + running)

Branche `feature/admin-8.4-constructeur-programmes`. Back-office `apps/admin` : composer des
programmes éditoriaux (programme → séances → exos muscu | cibles running), bilingue FR/EN,
brouillon/publié, réorganisation glisser-déposer, archivage. **Aucun changement mobile ni sync rules.**

**Ajouté**
- Migration `supabase/migrations/20260713140000_admin_editorial_programs_rls.sql` : RLS d'écriture
  éditoriale (DROP+CREATE `insert`/`update`) sur `programs` / `program_translations` / `sessions` /
  `exercise_plans`, ouverte aux éditeurs de contenu via `public.is_content_editor()` (réutilisée de 8.2 ;
  non recréée). SELECT inchangé. 🔴 à appliquer manuellement (SQL Editor) puis `db:types`.
- Couche data `apps/admin/src/data/programs.ts` (supabase-js, éditorial `owner_id NULL`) : list/get,
  create/updateMeta/setStatus/archive (soft-delete cascade), séances (add/update/remove/reorder),
  exos (add/update/remove/reorder). *Pillar-aware*.
- Composants `apps/admin/src/components/SortableList.tsx` (drag & drop générique @dnd-kit, clavier,
  contrôlé) + `ExercisePicker.tsx` (exercices éditoriaux **publiés** — évite les références orphelines).
- Écrans `apps/admin/src/screens/ProgramsScreen.tsx` (liste : recherche, filtres pilier/statut,
  publier/brouillon, archiver), `ProgramCreateScreen.tsx` (création : pilier + nom FR/EN requis +
  niveau/objectif/durée), `ProgramEditScreen.tsx` (composition : métadonnées bilingues, séances
  ajout/nommage auto A/B/C/réorg/retrait, muscu = exos via picker + cibles séries/reps/charge/repos,
  running = type/distance/durée, publication gated sur le nom serveur).
- Dépendances `@dnd-kit/core` ^6.3.1, `@dnd-kit/sortable` ^10.0.0, `@dnd-kit/utilities` ^3.2.2 (`apps/admin`).
- Routes `/programs`, `/programs/new`, `/programs/:id` (gated `RequireContentEditor`) + entrée nav Programmes.
- Bloc i18n `fr.programs.*`.

**Corrigé (revues qualité)**
- Data layer : filtre `deleted_at` sur les jointures de traductions (nom obsolète ne réapparaît plus,
  aligné sur le repo mobile) ; coercion `numeric` `target_weight_kg` → nombre ; idempotence des cascades
  (`.is('deleted_at', null)`) ; reorder bornés au parent ; JSDoc retry.
- Écran composition : anti-clobber seed-once des sous-composants (une saisie en cours n'est plus écrasée
  par un changement de select voisin) ; réorg plus jamais silencieusement ignorée pendant un write en vol ;
  publication gated sur le nom **serveur** (pas la saisie locale non enregistrée) ; valeurs numériques
  négatives rejetées (→ null) ; `busy` toujours relâché (try/finally). Parité durée ≥ 1 côté création.

**Technique / Notes**
- Brouillons non exposés au mobile : `programs` filtre déjà `status='published'` dans les sync rules →
  **aucun redéploiement**. Séances/exos d'un brouillon restent orphelins invisibles (parent absent), même
  pattern inoffensif que les traductions d'exercices en 8.2.
- Revues : couche data (qualité), écran composition (qualité, 2 Critiques corrigés), revue finale (RAS).
- Périmètre : cadrage `docs/specs/functional/us/8.4-…` + `docs/plans/8.4-…` (commit `37ff6d0`).

## 13/07/2026 — Idées : consignation de 16 pistes produit dans IDEAS.md

Branche `feature/admin-8.4-constructeur-programmes`. Session de captation d'idées produit : après
analyse du cadrage (roadmap V0.1→V1.1, « hors périmètre », vision) pour écarter les doublons, ajout
de 16 idées neuves dans la boîte de dépôt. **Documentation uniquement — aucun code applicatif touché.**

### Ajouté
- **IDEAS.md** — 16 entrées 🆕 datées du 13/07/2026, en tête de « À trier » : bilan hebdo/mensuel
  auto, rétrospective annuelle « Wrapped », rappels intelligents contextuels, carte de séance/course
  partageable en image, programme de parrainage, reconnaissance de repas par photo, substitution
  d'aliments, jeûne intermittent, substitution d'exercices, détection de plateau + deload, météo
  avant sortie planifiée, journal bien-être/humeur, journal blessures/douleurs, widget écran
  d'accueil Android, commandes/annonces vocales en séance, langues supplémentaires (ES/DE).
- Chaque entrée signale explicitement les **chevauchements avec le cadrage** (ce qui est déjà prévu
  vs neuf) et tisse des liens `[[…]]` vers les idées connexes (analyses croisées, module coach, IA…).

### Technique / Notes
- Commit **volontairement limité à IDEAS.md**. `apps/mobile/eas.json` est modifié dans l'arbre de
  travail (ajout de variables d'env au profil `preview` : URL Supabase, clé **anon publishable**,
  URL PowerSync) mais **non committé ici** : sujet distinct (config de build, hors périmètre idées).
  Valeurs publiques par conception (pas de `service_role` ni de secret) ; à trancher par les devs
  (valeurs en dur vs secrets EAS).

## 13/07/2026 — Admin : CRUD des exercices éditoriaux + brouillon/publié (US 8.2)

Branche `feature/admin-8.2-exercices-crud`. Gestion des exercices éditoriaux depuis le back-office :
liste (recherche + filtres), création/édition bilingue (FR+EN requis), brouillon/publié, archivage.
⚠️ **Checkpoint cloud** : migration RLS/status + redéploiement des sync rules PowerSync + `db:types`
à réaliser par Florian (bon projet) avant recette. **Aucun code mobile modifié.**

### Ajouté
- **Migration** `supabase/migrations/20260713110000_admin_editorial_exercises.sql` : colonne
  `exercises.status` (text not null default `'published'`, check `draft`/`published`). RLS réécrite en
  **DROP+CREATE** (Postgres n'a pas `CREATE OR REPLACE POLICY`) : `exercises_select`
  (`owner_id = auth.uid()` **ou** éditorial publié **ou** `is_admin()`), `exercises_insert`/`exercises_update`
  (self **ou** `is_admin()`) ; `exercise_translations_insert`/`exercise_translations_update` rouverts à
  `is_admin()`. Défaut `'published'` → seed/customs existants restent visibles.
- **`apps/admin/src/data/exercises.ts`** : couche data (`listEditorialExercises`, `getExercise`,
  `saveExercise` — upsert exercice + 2 traductions séquentiel, UUID client —, `setStatus`,
  `archiveExercise` — soft-delete exercice + traductions). Typée via `Database`, réutilise `MUSCLE_GROUPS`.
- **`apps/admin/src/screens/ExercisesScreen.tsx`** : liste (nom FR, groupe traduit, badge statut, date),
  recherche par nom, filtres groupe + statut, « Nouvel exercice », actions éditer / publier-brouillon /
  archiver (confirmation) ; états loading/vide/erreur.
- **`apps/admin/src/screens/ExerciseEditScreen.tsx`** : formulaire créer/éditer (groupe, équipement
  optionnel, **nom FR + nom EN requis**, instructions FR/EN optionnelles, statut — brouillon par défaut).
- **Routes** `/exercises`, `/exercises/new`, `/exercises/:id` sous `RequireAdmin` + `AdminLayout`.
- **i18n** `apps/admin/src/i18n/fr.ts` : bloc `exercises.*` (liste, colonnes, formulaire, statuts,
  actions, erreurs, confirmations, noms de groupes).

### Modifié
- **`packages/shared/src/database.types.ts`** : ajout **manuel** de `status` à `exercises`
  (Row/Insert/Update), pour que les requêtes admin compilent avant l'apply cloud (idempotent `db:types`).
- **`docs/specs/technical/powersync-sync-rules.yaml`** : bucket `shared_content`, `exercises` filtre
  désormais `status = 'published'` (masque les brouillons éditoriaux au mobile, même pattern que
  `programs`). `exercise_translations` sans filtre status (parent brouillon non synchronisé).
- **`apps/admin/src/components/AdminLayout.tsx`** : entrée de nav « Exercices » désormais cliquable
  (NavLink) au lieu de « bientôt ».

### Technique / Notes
- Sécurité : clé anon uniquement (jamais `service_role`) ; RLS = frontière ; soft-delete uniquement ;
  brouillons éditoriaux jamais exposés au mobile (filtrés au niveau sync).
- 🔴 Reste à faire par Florian : appliquer la migration + redéployer les sync rules + `db:types` + recette.

## 13/07/2026 — Admin Fondation-2 : rôles + gate d'accès (US 8.9)

Branche `feature/admin-f2-roles-gate`. Restreint le back-office aux administrateurs (table
`user_roles` + RLS + gate) et ajoute une gestion minimale des rôles réservée au super_admin.
⚠️ **La migration est un checkpoint cloud** (apply manuel + `db:types` + bootstrap par Florian
avant que le gate soit testable en navigateur).

### Ajouté
- **Migration** `supabase/migrations/20260713100000_admin_user_roles.sql` : table `public.user_roles`
  (`role` = text + check `super_admin`/`content_editor`/`moderator`, soft delete `deleted_at`), index
  **unique partiel** `(user_id, role) WHERE deleted_at IS NULL` (ré-attribution possible), trigger
  `set_updated_at`. Fonctions `is_admin()`/`is_super_admin()` en **`SECURITY DEFINER STABLE SET
  search_path = public`** (évitent la récursion des policies). RLS : select (propre ligne ou
  super_admin), insert/update/delete (super_admin). **Hors publication PowerSync** (table web/admin).
- **`packages/shared/src/database.types.ts`** : ajout **manuel** de l'entrée `user_roles`
  (Row/Insert/Update/Relationships) + fonctions `is_admin`/`is_super_admin`, pour que
  `supabase.from('user_roles')` compile avant l'apply cloud (idempotent avec un futur `db:types`).
- **`apps/admin/src/data/roles.ts`** : couche data (`AdminRole`, `ADMIN_ROLES`, `fetchMyRoles`
  tolérant aux erreurs, `listRoles`, `grantRole` en update-puis-insert pour réactiver un rôle
  soft-deleted, `revokeRole` en soft-delete).
- **Contexte rôles** : `rolesContext.ts`, `RolesProvider.tsx`, `useRoles.ts` — charge les rôles
  après session (recharge au changement d'utilisateur), expose
  `roles/isAdmin/isSuperAdmin/rolesLoading/rolesError` ; erreur ⇒ non-admin (pas de crash).
- **`RequireAdmin.tsx`** : gate à l'intérieur de `RequireAuth` — spinner pendant le chargement,
  shell si admin, sinon `AccessDenied` (pas de redirection `/login`).
- **`AccessDenied.tsx`** : écran FR (message + bouton Déconnexion).
- **`RolesScreen.tsx`** (super_admin) : liste des attributions actives (user_id, rôle, date
  JJ/MM/AAAA), formulaire d'attribution par `user_id` (UUID + select rôle, aide dashboard Supabase),
  révocation avec confirmation ; erreurs Supabase surfacées en FR, états de chargement.

### Modifié
- **`App.tsx`** : `RolesProvider` en racine ; groupe protégé `RequireAuth → RequireAdmin →
  AdminLayout` ; routes `/` (accueil) et `/roles` (super_admin only, sinon redirection `/`).
- **`AdminLayout.tsx`** : entrées de nav `NavLink` (Accueil + « Rôles » visible **uniquement si
  super_admin**), lien actif géré.
- **`i18n/fr.ts`** : libellés `accessDenied.*` et `roles.*`.

### Technique / Notes
- **Vérifications** : racine `typecheck` + `lint` **verts** (admin inclus, aucune régression
  mobile/shared) ; `apps/admin` build OK.
- **Sécurité** : clé anon uniquement (jamais `service_role`) ; RLS = frontière ; gate client = confort.
- **Checkpoint cloud (Florian)** : appliquer la migration (SQL Editor) → bootstrap du 1ᵉʳ super_admin
  (`insert ... select id, 'super_admin' from auth.users where email = ...`) → `npm run db:types` →
  recette navigateur.

## 13/07/2026 — Admin Fondation-1 : écran de connexion + shell protégé

Branche `feature/admin-f1-scaffold-auth`. Clôt la fondation-1 du back-office : login + shell
protégé opérationnels (conforme à `design/admin-f1/admin-f1.html`, thème clair, accent terracotta).

### Ajouté
- **`LoginScreen`** (`apps/admin/src/screens/`) : formulaire e-mail + mot de passe contrôlés,
  bouton « Se connecter » avec état de chargement, message d'erreur FR (`Identifiants incorrects`) ;
  succès → `navigate('/')` ; déjà connecté → `<Navigate to="/">`.
- **`AdminLayout`** (`apps/admin/src/components/`) : barre latérale sombre (Accueil actif + modules
  Exercices/Aliments/Programmes/Utilisateurs grisés « bientôt », non cliquables), entête avec titre,
  e-mail utilisateur et bouton **Déconnexion** (`signOut`), `<Outlet/>`.
- **`HomePlaceholder`** (`apps/admin/src/screens/`) : message « Back-office — bientôt » + grille des
  futurs modules (non cliquables) + badge lots à venir.
- **Router** (`App.tsx`) : `/login` public ; groupe protégé (`RequireAuth` → `AdminLayout`) avec
  `/` → `HomePlaceholder` ; route `*` → redirection `/`. `AuthProvider` en racine.

### Technique / Notes
- **Vérifications** : `apps/admin` build OK ; racine `typecheck` + `lint` **verts** (admin inclus),
  aucune régression mobile/shared ; suites de tests inchangées. Aucune clé réelle (`.env.example` vide).
- **Flux runtime** (login effectif) nécessite un `.env` avec l'URL + la clé anon Supabase — non
  exécutable sans les identifiants (recette navigateur côté Florian).

## 13/07/2026 — Admin Fondation-1 : contexte d'auth Supabase + RequireAuth

Branche `feature/admin-f1-scaffold-auth`.

### Ajouté
- **Contexte d'authentification** (`apps/admin/src/auth/`) : `AuthProvider` (`getSession()` au montage
  + abonnement `onAuthStateChange`, nettoyé au démontage ; expose `session`, `user`, `loading`,
  `signIn` = `signInWithPassword`, `signOut`), `context.ts` (contexte + type), `useAuth.ts` (hook, dans
  un module dédié pour la compatibilité fast-refresh).
- **`RequireAuth`** (garde de route) : écran de chargement (spinner) tant que la session n'est pas
  restaurée, redirection `<Navigate to="/login">` si non connecté, sinon `<Outlet/>`. F1 =
  authentification seule (gate par rôle en F2).
- **Keyframe `admin-spin`** (`index.css`) pour le spinner de chargement.

## 13/07/2026 — Admin Fondation-1 : client Supabase web + libellés FR

Branche `feature/admin-f1-scaffold-auth`.

### Ajouté
- **Client Supabase web** (`apps/admin/src/lib/supabase.ts`) : `createClient<Database>` typé via
  `@wellness/shared`, env `import.meta.env.VITE_SUPABASE_URL/ANON_KEY`, `auth: { persistSession,
  autoRefreshToken }` (session `localStorage` par défaut). Garde-fou runtime si env manquante.
  **Clé anon uniquement** (jamais `service_role`).
- **`.env.example`** (`apps/admin/`) : `VITE_SUPABASE_URL=` / `VITE_SUPABASE_ANON_KEY=` **vides**
  (couvert par `.gitignore` racine ; jamais de vraie clé).
- **Libellés FR centralisés** (`apps/admin/src/i18n/fr.ts`) : login, erreurs, layout, placeholder
  (aucune chaîne d'UI en dur ailleurs).

## 13/07/2026 — Admin Fondation-1 : scaffold Vite + React + TypeScript (`apps/admin`)

Branche `feature/admin-f1-scaffold-auth`. Transformation du stub `apps/admin` en app web
**Vite + React + TypeScript** intégrée au monorepo npm workspaces. **100 % client web, aucune
migration, aucun cloud.**

### Ajouté
- **App web `@wellness/admin`** : `package.json` réécrit (deps `react`/`react-dom` **19.2.3 exact**
  — alignées mobile, `react-router-dom` ^7, `@supabase/supabase-js` ^2.110.0, `@wellness/shared` `*` ;
  devDeps `vite` ^7, `@vitejs/plugin-react`, `typescript` ~5.6.3, types React, ESLint flat web React).
  Scripts `dev` / `build` (`tsc -b && vite build`) / `preview` / `typecheck` / `lint`.
- **Config** : `vite.config.ts` (`@vitejs/plugin-react`), `index.html` (`#root` + `main.tsx`),
  `tsconfig.json` réécrit (extends base ; `lib` DOM+DOM.Iterable+ESNext, `jsx` react-jsx,
  `moduleResolution` bundler, `noEmit`, `include ["src"]`), `eslint.config.js` (flat, react-hooks +
  react-refresh + typescript-eslint), `src/vite-env.d.ts` (typage `import.meta.env` `VITE_*`).
- **Socle UI** : `src/theme.ts` (tokens couleurs thème clair, accent terracotta `#dd6e40`),
  `src/index.css` (variables CSS + reset), `src/main.tsx` (`createRoot` + `StrictMode`),
  `src/App.tsx` minimal (scaffold).

### Supprimé
- Ancien stub `apps/admin/src/index.ts`.

### Technique / Notes
- **Intégration monorepo** : `apps/admin` build OK ; racine `typecheck` + `lint` **verts** (admin
  inclus via `--workspaces --if-present`) ; aucune régression mobile/shared. `vite` 7.3.6 imbriqué
  dans `apps/admin` (le root garde un `vite` 5.x transitif hoisté, sans impact).

## 13/07/2026 — Suppression de programmes & de séances (muscu + course)

Branche `feature/suppression-programmes-seances`. Permet de supprimer un programme
(muscu **si possédé** + course) et une séance depuis l'app, proprement (cascade planning,
désactivation si actif, confirmations). **100 % client, soft delete, aucune migration, aucune
dépendance native, offline-first, i18n FR/EN à parité.**

### Ajouté
- **Variante `Button` `destructive`** (`apps/mobile/src/components/Button.tsx`) — fond plein
  `colors.danger`, texte/spinner `accentText` ; même API (label/loading/disabled), a11y conservée.
- **Bouton « Supprimer le programme »** sur les écrans détail muscu
  (`app/programs/[id].tsx`, **uniquement si `isOwned`**) et course (`app/running-programs/[id].tsx`,
  tous possédés) : confirmation `Alert` (titre = nom, message `deleteConfirm`), garde anti-double-tap
  + état `deleting` (loading), `deleteProgram` puis `router.replace` vers la liste ; en cas d'erreur,
  `Alert` non bloquant et maintien sur l'écran.
- **Confirmation avant suppression d'une séance** dans les deux éditeurs
  (`components/programs/SessionEditor.tsx`, `components/running/RunningSessionEditor.tsx`) :
  `Alert.alert(nom séance, removeSessionConfirm, [Annuler, Supprimer(destructive)])` autour de
  `removeSession` (auparavant suppression immédiate sans confirmation).
- **i18n FR/EN** (parité) — `programs.detail.{delete,deleting,deleteConfirm,deleteError,
  deleteErrorMessage}`, `programs.edit.removeSessionConfirm`, `running.program.{delete,deleting,
  deleteConfirm,deleteError,deleteErrorMessage,removeSessionConfirm}`.

### Modifié
- **`deleteProgram` durci** (`data/repositories/program-repository.ts`) — enveloppe désormais dans
  une **`writeTransaction`** le passage `is_active=0` (si le programme est actif) **puis** le
  soft-delete du programme, dans cet ordre impératif (jamais de ligne soft-deletée restée active,
  cohérent avec `activateProgram` qui filtre `is_active=1 AND deleted_at IS NULL`). Ajoute une
  **cascade `planned_sessions`** owner-scopée par `program_id` (nettoie les entrées de planning
  orphelines). La cascade existante (séances → `exercise_plans` → `program_translations`) est
  préservée. Idempotent (`deleted_at IS NULL`).
- **`removeSession` durci** — ajoute une **cascade `planned_sessions`** owner-scopée par
  `session_id`, en plus de la cascade `exercise_plans` existante.

### Technique / Notes
- Owner résolu via `currentUserId()` ; timestamps UTC ; écritures locales (PowerSync synchronise
  ensuite). Aucune régression des cascades existantes. typecheck/lint/tests verts (595 tests shared).
- Hors périmètre : hard delete, corbeille/restauration, multi-sélection.

## 13/07/2026 — Notifications locales : rappel série en danger, Ne pas déranger, gestion par type (US 2.6/2.8/1.17)

Branche `feature/notifications-v0.6`. Rappel local « série en danger » (2.6), fenêtre **Ne pas
déranger** configurable + plafond quotidien (2.8), **gestion par type** depuis les Réglages (1.17).
**Une seule dépendance native ajoutée** (`expo-notifications`), **aucune migration** (colonne texte
`user_settings.notifications` enrichie), offline-first, i18n FR/EN à parité.

### Ajouté
- **Logique pure (`@wellness/shared/notifications.ts`)** — interface `NotificationPrefs`
  (`streakDanger`, `reminderHour`, `dndEnabled`, `dndStartHour`, `dndEndHour`, `maxPerDay`) ;
  `defaultNotificationPrefs()` (`true/20/true/22/7/3` — `reminderHour=20` volontairement hors DND
  `[22,7)`) ; `parseNotificationPrefs()` **tolérant** (null/`{}`/ancien `Record<string,boolean>` →
  défauts, heures bornées 0-23, `maxPerDay≥1`) ; `isWithinDnd()` (fenêtre simple **et** enjambant
  minuit) ; `shouldScheduleStreakReminder()` ; `canScheduleMore()`. **Couverture Vitest** (défauts,
  bornes, DND minuit, règle streak, max/jour).
- **Wrapper natif (`apps/mobile/src/lib/notifications.ts`)** — API **expo-notifications SDK 57** :
  `ensurePermissionAndChannel()` (canal Android `reminders`, get/request permissions, retourne
  `granted`), `scheduleStreakReminder(date, content)` (trigger `DATE`, identifiant stable
  `STREAK_REMINDER_ID` → idempotent), `cancelStreakReminder()`, `setNotificationHandler` (affichage
  au premier plan). Permission refusée / module indisponible = **no-op silencieux** (jamais de throw).
- **Repository + scheduler (`notification-repository.ts`)** — `useNotificationPrefs()` (prefs
  réactives), `updateNotificationPrefs(current, patch)` (merge + `updateSettings`),
  `useStreakReminderScheduler()` : (re)planifie/annule selon `activeToday` (`useStreakData`) + prefs,
  au montage / changement / retour au premier plan (`AppState`, abonnement nettoyé au démontage).
- **Réglages (`settings.tsx`)** — sections « Notifications » (Switch rappel streak + `HourStepper`
  heure de rappel) et « Ne pas déranger » (Switch + steppers début/fin), suivant la maquette et le
  thème sombre. `HourStepper` : sélecteur d'heure 0-23 **pur JS** (boucle modulo 24, a11y), aucune
  dépendance native. Bandeau informatif si permission système refusée (non bloquant).
- **Init (`_layout.tsx`)** — montage de `useStreakReminderScheduler()` dans `RootNavigator`
  (permission + canal à l'init, (re)planification à l'ouverture).
- **i18n** — `settings.notifications.*` + `notifications.streakDanger.{title,body}` FR **et** EN à parité.

### Modifié
- **`@wellness/shared/settings.ts`** — colonne `notifications` : `z.record(z.string(), z.boolean())`
  → schéma typé `notificationPrefsSchema` (`.default(defaultNotificationPrefs())`). **Sans migration**
  (colonne texte). `settings.test.ts` adapté (nouvelle forme + rejet d'heure hors bornes).
- **`settings-repository.ts`** — lecture `notifications` via
  `parseNotificationPrefs(parseJsonColumn(row.notifications, null))` ; défauts d'insertion via
  `defaultNotificationPrefs()`.

### Technique / Notes
- `expo-notifications@~57.0.3` (aligné SDK 57) + plugin `app.json` + permission Android
  `POST_NOTIFICATIONS`. `owner`/`projectId` inchangés.
- **Nouveau build requis** (dépendance native) → recette device à faire (permission, rappel, DND,
  toggles). typecheck/lint/tests verts (595 tests shared), parité i18n confirmée.

## 12/07/2026 — Personnalisation du dashboard : mode édition, drag & drop, masquer, taille (US 7.1/7.2/7.3/7.11/7.12)

Branche `feature/dashboard-personnalisation`. Rend l'accueil personnalisable, disposition
persistée localement **et** dans le cloud via la colonne existante `user_settings.dashboard_layout`.
**100 % client — aucune migration, aucun checkpoint 🔴 cloud, aucune dépendance native ajoutée**
(`react-native-reanimated` / `react-native-gesture-handler` déjà présents).

### Ajouté
- **Logique pure (`@wellness/shared/dashboard.ts`)** — registre `DASHBOARD_WIDGET_IDS` (7 widgets)
  + `WIDGET_PILLARS` (gardes piliers, `always` transverse jamais filtré) ; types `WidgetSize`,
  `WidgetLayoutEntry`, `DashboardLayout` ; `defaultDashboardLayout()`, `resolveDashboardLayout()`
  (défaut, fusion forward-compat, filtre piliers, IDs inconnus ignorés, tri par ordre, recompactage,
  `visible`/`size` préservés), `moveWidget()` pur/immuable, `parseDashboardLayout()` tolérant.
  **25 tests Vitest**.
- **Persistance (`dashboard-layout-repository.ts`)** — `useDashboardLayout()` : lecture réactive
  (`useSettings`), parse tolérant, résolution filtrée piliers pour l'affichage ; mutateurs
  `toggleVisible`/`setSize`/`reorder`/`setLayout` écrivant le **layout complet non filtré** via
  `updateSettings({ dashboardLayout })`. **Débounce ~400 ms** sur le réordonnancement (drag).
- **Variante compacte (7.11)** — prop `size?: WidgetSize` sur les 7 widgets + composant partagé
  `DashboardCardCompact` (une ligne : icône + titre + valeur clé), conforme à la maquette.
- **Mode édition (7.1/7.3)** — bouton « Personnaliser » / « Terminé » dans l'en-tête ; rendu de la
  disposition résolue via map `id → composant` ; `DashboardWidgetRow` (cadre pointillé, marquage
  « Masqué » grisé + badge) + `DashboardEditControls` (œil masquer/afficher sur **tous** les widgets
  y compris streak — **masquabilité uniforme** ; bascule de taille). a11y sur tous les contrôles.
- **Drag & drop (7.2)** — `SortableDashboard` (`react-native-gesture-handler` `Pan` +
  `react-native-reanimated`) : poignée par carte, la carte active suit le doigt, calcul d'index
  cible sur hauteurs mesurées, `reorder(id, toIndex)` au drop. **Défilement du `ScrollView`
  neutralisé pendant un drag actif.** `GestureHandlerRootView` posé à la racine.
- i18n FR/EN à parité : `home.customize.*` et clés compactes des widgets (65/65 sur `home.*`).

### Technique / Notes
- Aucune migration : la colonne `dashboard_layout` (JSON TEXT PowerSync) préexistait. Offline-first.
- **Reste** : vérification device du drag & drop (non validable en CI — module natif + New Arch).
  **Auto-scroll près des bords pendant le drag : différé** (spec §8, optionnel MVP).

## 12/07/2026 — Widgets dashboard : Record récent, Volume muscu, Résumé running (US 7.8–7.10)

Branche `feature/7.8-7.10-widgets-dashboard`. 3 widgets additifs sur le tableau de bord,
100 % client (lectures locales réactives) — aucune migration, cloud ni dépendance native.

### Ajouté
- **Record récent (7.8)** — `RecordRecentCard` : dernier record battu, muscu OU course, avec
  badge pilier, libellé (exercice + poids, ou distance + temps M:SS) et date JJ/MM/AAAA. Lien
  vers Progression (muscu) ou Historique (course). Gardé si pilier `strength` OU `running` actif.
- **Volume muscu semaine (7.9)** — `MuscleVolumeCard` : histogramme du volume par groupe
  musculaire de la semaine (réutilise `MuscleVolumeBarChart`, unité **kg**). Gardé si `strength`.
- **Résumé running semaine (7.10)** — `RunningWeekCard` : distance + nombre de séances de la
  semaine, avec objectif de séances (`weeklyFrequency`) si défini. Gardé si `running`.
- `dashboard-repository` : hook composite `useMostRecentRecord()` composant record muscu le plus
  récent (nouveau `useQuery` + jointure `exercise_translations`) et record d'allure le plus récent
  (`useRunningRecords`), **filtré selon les piliers actifs** (hooks inconditionnels, filtrage sur
  les résultats).
- i18n FR/EN à parité : `home.record.*`, `home.volumeWeek.*`, `home.runningWeek.*`.

### Modifié
- `(tabs)/index.tsx` : intègre les 3 cartes à la suite des widgets existants, gardées par pilier.

### Technique / Notes
- Réutilisation stricte : `MuscleVolumeBarChart` non dupliqué ; libellés de groupes musculaires
  via `muscle.*` existant. Objectif de **distance** hebdo différé (Lot B / colonne dédiée).

## 12/07/2026 — Export GPX d'une course (US 5.33)

Branche `feature/5.33-export-gpx`.

### Ajouté
- **Export GPX** d'une course GPS terminée : bouton « Exporter (GPX) » sous la carte du
  résumé de course, visible uniquement pour une course GPS terminée avec ≥ 2 points valides.
  Génère un fichier `.gpx` (GPX 1.1, sans altitude) et l'ouvre via la feuille de partage OS.
  100 % local/hors-ligne (aucun réseau, cloud ni migration).
- `@wellness/shared` : `buildGpx(points, { startedAtMs, name })` (pur, testé), `gpxFileName`
  (nom daté en heure locale), `isValidCoord(lat, lng)` (extrait d'`isValidFix`).
- `apps/mobile/src/lib/gpx-export.ts` : couche native (écriture cache + `Sharing.shareAsync`).
- i18n FR/EN : `running.export.*` (cta, defaultName, dialogTitle, erreurs).

### Modifié
- `isValidFix` délègue désormais à `isValidCoord` (comportement inchangé — fix records préservé).

### Technique / Notes
- Dépendances : `expo-sharing` (~57.0.3) + `expo-file-system` (~57.0.0) → **nouveau build requis**.
- API `expo-file-system` **legacy** (`writeAsStringAsync` + `cacheDirectory`), nom de fichier
  cache fixe (`course.gpx`) pour éviter l'accumulation. Tests : 20 nouveaux (buildGpx + gpxFileName
  + isValidCoord), régression `isValidFix` verte.

## 12/07/2026 — Fix UI : écran Musculation non défilable + cartes collées

Branche `fix/strength-scroll-spacing`.

### Corrigé
- L'onglet **Musculation** posait ses cartes directement dans `Screen` (hauteur fixe) **sans `ScrollView`
  ni espacement** → impossible de défiler (carte « Progression » inatteignable) et cartes collées. Ajout d'un
  `ScrollView` (pattern du dashboard `(tabs)/index.tsx`) avec `contentContainerStyle={{ gap: 14, paddingBottom: 24 }}`,
  en-tête `ScreenHeader` conservé fixe. Fichier : `apps/mobile/src/app/(tabs)/strength.tsx`.

### Technique / Notes
- Le pilier Course (`(tabs)/running.tsx`) n'est pas concerné (2 cartes max, tient sans défilement).

## 12/07/2026 — Fix UI : sélecteur de niveau (création/édition de programme)

Branche `fix/segment-niveau-muscu-wrap`.

### Corrigé
- Le sélecteur segmenté « Niveau » faisait passer « Intermédiaire » sur deux lignes (mode par défaut
  `flex: 1` à 4 colonnes égales, libellés trop longs). Passage en mode `scrollable` (une ligne, largeur
  intrinsèque, défilement horizontal si besoin) — cohérent avec le sélecteur d'objectif de course.
- Fichiers : `apps/mobile/src/app/programs/edit.tsx` (muscu), `apps/mobile/src/app/running-programs/edit.tsx`
  (course, création + édition — même classe de bug).

### Technique / Notes
- Aucun changement du composant `Segment` (le mode `scrollable` existait déjà) ; simple opt-in par écran.

## 12/07/2026 — US 4.7b : détection anticipée des jours d'entraînement (nutrition)

Étend `useIsTrainingDay(dayKey)` pour qu'une séance **planifiée** (`planned_sessions`, statut
`planned`/`done`) compte comme jour d'entraînement **par anticipation** (aujourd'hui + futur).
Le passé reste rétroactif uniquement. Streak inchangé. Aucune migration, aucun cloud.
Branche `feature/nutrition-4.7-anticipee`.

### Ajouté
- **`packages/shared/src/training-day.ts`** : helper pur `isTrainingDay(i: TrainingDayInput): boolean`.
  Règle : `retroactiveDone || (hasPlanned && dayKey >= todayKey)`. Comparaison lexicographique
  `AAAA-MM-JJ` (= chronologique). Exporté via `index.ts`.
- **`packages/shared/src/training-day.test.ts`** : 6 tests Vitest TDD (passé+fait→vrai,
  passé+planifié-seul→faux, aujourd'hui planifié→vrai, futur planifié→vrai, futur vide→faux,
  aucun signal→faux). Frontière `dayKey===todayKey` explicitement couverte.
- **`useHasPlannedSession(dayKey)`** dans `planned-session-repository.ts` : hook réactif
  owner-scopé (`useAuthStore` + `useQuery`), requête bornée `SELECT 1 … WHERE owner_id=?
  AND scheduled_date=? AND status IN ('planned','done') AND deleted_at IS NULL LIMIT 1`.
  Retourne `{ hasPlanned: boolean; isLoading: boolean }`.

### Modifié
- **`useIsTrainingDay`** dans `dashboard-repository.ts` : compose l'existant (logique rétroactive
  inchangée, extraite dans `retroactiveDone`) + `useHasPlannedSession(dayKey)`. Import aliasé
  `isTrainingDay as computeIsTrainingDay` pour éviter la collision de nom avec le champ retourné.
  `isLoading` = OR des trois hooks. JSDoc mis à jour (rétroactif + anticipé). UI et signature
  inchangés.

## 12/07/2026 — Fix : précision GPS & records d'allure (marche/course lente)

Correctif du bug device : une marche de 1,01 km ne produisait **aucun record** (section
« Records d'allure » à « — », pas de badge 1 km) et la carte affichait un point aberrant à (0,0).
Diagnostic complet : [docs/specs/technical/fix-running-gps-precision-records.md](docs/specs/technical/fix-running-gps-precision-records.md).
Branche `fix/running-gps-precision-records`.

### Corrigé
- **Volet C (cause dominante) — précision d'encodage de trace `1e-5` → `1e-6`** (`packages/shared/src/running.ts`).
  La maille `1e-5` (~1,1 m) écrasait les pas d'une marche lente (~0,7 m) → la trace **décodée**
  sous-comptait la distance (< 1 km) alors que le tracker live cumulait ~1,01 km → aucun record.
  Passage à `1e-6` (~0,11 m) : trace décodée fidèle, record 1 km posé.
- **Volet A — filtre des fixes GPS invalides à l'ingestion** (helper pur `isValidFix` dans shared,
  câblé dans `apps/mobile/src/running/tracker-task.ts`). Rejette (0,0) « null island », coordonnées
  hors bornes, coords non finies, et `accuracy > 50 m`. Un fix rejeté n'entre ni dans la trace, ni
  dans le cumul distance/durée, ni comme `lastPoint`.
- **Volet B — auto-pause moins sensible au mouvement lent réel.** Seuil abaissé `0,5 → 0,3 m/s`
  **et** comparaison sur la **vitesse lissée** (moyenne sur fenêtre `AUTO_PAUSE_WINDOW_S = 10 s`,
  helper pur `smoothedSpeedMs`) au lieu de la vitesse instantanée bruitée. Une marche lente réelle
  ne déclenche plus de fausse pause ; un arrêt réel prolongé reste détecté ; auto-reprise conservée.

### Technique / Notes
- **Compat ascendante** (Volet C) : marqueur de version **par segment** — un segment hérité (v0,
  `1e-5`, sans marqueur) et un nouveau segment (v1, `1e-6`, préfixe `#1#`) coexistent dans la même
  trace et se décodent chacun à leur précision. Séparateur coords/temps `,` pour v1 (hors domaine
  polyline, car à `1e-6` le caractère `|` peut apparaître dans un chunk). **Aucune migration DB.**
- `distance_m` d'affichage **inchangé** (reste le cumul live pleine précision).
- Tests : test de reproduction (`fix-running-gps-precision-records.test.ts`, rouge avant / vert
  après) + tests unitaires `isValidFix`, `smoothedSpeedMs`, round-trip `1e-6`, décodage hérité `1e-5`
  et trace mixte. typecheck/lint/tests verts (shared 478 + mobile 29). **Rebuild preview requis**
  pour recette device (badge 1 km attendu).

## 12/07/2026 — US 3.9 : planning muscu daté + calendrier unifié (coordination muscu↔running)

_Branche : `feature/us3.9-planning-unifie`. Cadrage complet (spec+plan+maquette validés) puis code subagent-driven (revues par phase + finale = **Ready to merge**). **Généralise** l'infra de planification R3c-i (pilier-agnostique) : livre le planning muscu **et** l'essentiel de la coordination 5.6. **100 % JS — aucune migration, aucun cloud, aucune dépendance native** (`planned_sessions` déjà déployée)._

### Ajouté / Modifié
- **`@wellness/shared`** : `planRunningProgramInput{Schema}` → **`planProgramInput{Schema}`** (pilier-neutre).
- **`planned-session-repository.ts` — pilier-agnostique** : `planRunningProgram` → **`planProgram`** (active par le pilier du programme) ; `useWeekPlan`/`useMissedSessions` renvoient **tous les piliers** ; `PlannedSessionItem` gagne `pillar` + `exerciseCount` (sous-requête `COUNT(exercise_plans)`). `SELECT_MISSED` (ex-`SELECT_MISSED_RUNNING`) sans filtre pilier.
- **Écran unifié `/planning`** (renommé depuis `running-planning`) : vue semaine 7 jours affichant **muscu (nom + N exercices, puce bordeaux)** et **running (type/cible/allure, puce terracotta)** mélangés ; **indicateur de coordination** (« N séances ») quand ≥ 2 séances `planned`+`done` le même jour ; bannière manquées + actions (reporter/sauter/faite) tous piliers.
- **Assistant « Planifier » pilier-aware** (`planning/plan.tsx`) : muscu = noms de séance, running = types ; accessible depuis le détail programme **muscu** (`programs/[id].tsx`) **et** running.
- **Entrée « Mon planning »** dans l'onglet Muscu (`(tabs)/strength.tsx`, sans gating — pilier socle) et l'onglet Course (recâblée vers `/planning`).
- **i18n** : `running.planning.*` → namespace partagé **`planning.*`** (+ clés muscu/coordination), parité FR/EN 693/693.

### Technique / Notes
- **Non-régression running (device-validé)** : renommage i18n/route **exhaustif** ; greps `running.planning.`/`running-planning`/`running-programs/plan`/`planRunningProgram` = **0** ; comportement running iso (branches `if (isRunning)` additives). Vérifié par revue finale (diff commit à commit).
- **Aucune migration/cloud/rebuild bloquant** : `planned_sessions` + `exercise_plans` déjà déployés/synchronisés. Un simple rebuild preview suffit pour la recette device.
- Qualité verte (typecheck 3 workspaces / lint / shared 451 + mobile 29) ; 0 doublon i18n.
- **Débloque** : la coordination 5.6 (indicateur même-jour livré ici) et prépare la détection anticipée des jours d'entraînement (nutrition 4.7).
- **Suivi (non bloquant)** : le bouton « Planifier » s'affiche sur un programme éditorial non dupliqué (aspérité pré-existante R3c-i — idéalement masquer/rediriger vers duplication) ; à traiter ultérieurement.

## 12/07/2026 — Fix : champs du programme de course enregistrés à la saisie

_Branche : `fix/running-program-fields-onchange`. Suite du fix précédent : les champs texte du composer de programme (nom, résumé, **durée en semaines**) souffraient du même défaut que la cible de séance — commit `onBlur` uniquement, donc perdus si « Terminé » était tapé sans quitter le champ (le `Keyboard.dismiss()` posé avant ne suffit pas : le blur est asynchrone, `router.back()` navigue avant). 100 % JS._

### Corrigé
- **`running-programs/edit.tsx`** : commit-on-change sur les 3 champs du composer (`saveName`/`saveSummary`/`saveDurationWeeks` branchés sur `onChangeText`, écriture uniquement si valeur valide, `onBlur` conservé). Plus de perte à la modification, quel que soit le geste de sortie.
- Le **formulaire de création** (`RunningProgramCreateForm`) lit déjà l'état au submit (bouton « Créer ») — non concerné (aucune dépendance au blur).

### Technique / Notes
- Généralise le pattern commit-on-change du fix cible-de-séance à tous les champs texte running. Qualité verte (typecheck / lint / 451 shared + 29 mobile). Rebuild preview pour re-recette.

## 12/07/2026 — Nutrition : édition/suppression d'entrée + 8 correctifs base d'aliments & journal

_Branche : `feature/journal-modifier-supprimer-entree`. Deux lots : (a) éditer la quantité / supprimer une entrée depuis le détail du journal (US4.34) ; (b) 8 correctifs issus d'une analyse des manques du pilier Nutrition (hygiène de données, recherche, saisie rapide, dette technique). **100 % client** — deux parts nécessitant une migration cloud sont explicitement différées (eau, snapshot fibres/sucres/AGS par entrée). Qualité verte (467 tests shared dont +16, typecheck/lint OK sur les fichiers touchés, i18n FR/EN 708/708). Recette device Pixel 6a : recherche accent-insensible, onglet Récents, horodatage + réordonnancement du détail confirmés._

### Ajouté
- **Éditer la quantité / supprimer une entrée du journal** (`nutrition.tsx`, US4.34) : le détail d'une entrée expose « Modifier la quantité » (champ grammes + aperçu live kcal/macros/micros, recalcul par règle de trois) et « Supprimer » (avec confirmation) ; l'appui long reste un raccourci de suppression.
- **#1 Éditer / supprimer un aliment de la base** (`food-repository.ts`, `food-custom.tsx`, `food-picker.tsx`) : `updateFood`/`deleteFood`/`getFood`/`isEditableFood`. `food-custom` passe en **mode édition** (param `foodId`, préremplissage) ; **appui long** sur une ligne du picker → Modifier / Supprimer (réservé aux aliments perso & OFF importés ; la bibliothèque `library` reste en lecture seule).
- **#4 Fibres / sucres / AG saturés** : colonnes désormais **branchées** (saisie dans `food-custom`, stockage `addCustomFood`/`updateFood`, lecture dans `FoodListItem`, aperçu mis à l'échelle dans `QuantityPanel`). Étaient des colonnes mortes.
- **#5 Saisie rapide** : **onglet « Récents »** (`useRecentFoods`, aliments récemment journalisés) + **multi-ajout** (le picker reste ouvert après un ajout, bannière « N ajouté(s) » + « Terminé »).
- **#6 Réordonnancement + horodatage** : `moveEntry` (échange d'`order_index`) exposé par des chevrons ↑/↓ dans le détail (désactivés aux extrémités) ; l'heure de journalisation (`created_at`) s'affiche dans le sous-titre du détail.

### Modifié
- **#3 Recherche d'aliments insensible aux accents/ligatures** (`search.ts`, `food-repository.ts`) : `useFoods` filtre désormais **en mémoire** via `matchesSearch` (repli des diacritiques + ligatures œ/æ) au lieu d'un `LIKE '%…%'` SQL — « boeuf » trouve « Bœuf haché », « pates » trouve « Pâtes ».
- **#7 Logique de rescale extraite et testée** : `rescaleEntryNutrition` dans `@wellness/shared` (règle de trois depuis le snapshot, un seul arrondi) ; `nutrition.tsx` la consomme au lieu d'un calcul inline.

### Corrigé
- **#2 Doublons OpenFoodFacts** (`food-picker.tsx`) : la sélection d'un résultat OFF via la recherche texte fait désormais `findFoodByBarcode` **avant** d'importer → plus de lignes `foods` dupliquées (seul le scan dédupliquait jusqu'ici).
- **#8 Double-encodage JSON (cause racine)** : nouveau helper partagé `parseJsonColumn` (tolérant au double-encodage PowerSync/op-sqlite) ; `parseMicronutrients`, `parsePortions` (`food-repository`), et les `parseJsonColumn` locaux de `settings-repository` (`active_pillars`/`meals`) et `nutrition-repository` s'appuient dessus. Généralise le contournement jusque-là limité aux micronutriments (US4.34).

### Technique / Notes
- **Nouveaux modules shared** : `json-column.ts` (+6 tests), `search.ts` (+7 tests), `rescaleEntryNutrition` (+3 tests dans `food.test.ts`). i18n FR/EN : +14 clés (`journal.detail.*`, `journal.tabs.recent`, `journal.addedCount/done/noRecent`, `food.edit/delete/deleteConfirm/…`, `food.custom.sugars/saturatedFat/fiber/update`), parité 708/708.
- **Différé (déclenche le checkpoint 🔴 cloud)** : suivi de l'eau (#6, table `water_logs` à créer) et **snapshot fibres/sucres/AGS par entrée de journal** (#4, 3 colonnes sur `food_entries`) — nécessitent migration + activation cloud, non faites unilatéralement. Les valeurs fibres/sucres/AGS sont pour l'instant visibles à l'ajout (QuantityPanel) mais pas figées par entrée.
- **Hors périmètre** : les 2 erreurs typecheck préexistantes de `running-history/index.tsx` (typage `router.push(string)`) sont identiques à `origin/dev` — non introduites ici, à traiter séparément (feront échouer la CI).

## 12/07/2026 — Fix : cible de séance perdue sans blur + contrainte cloud bloquante

_Branche : `fix/running-commit-on-change`. Suite de la recette device : la durée d'une séance n'était pas enregistrée si l'utilisateur tapait « Terminé » sans sortir du champ (commit uniquement `onBlur`). Cause secondaire : une CHECK constraint cloud bloquait la synchro PowerSync pendant l'édition. 100 % JS + 1 migration cloud (déjà appliquée)._

### Corrigé
- **Cible de séance (distance/durée) enregistrée à la saisie** (`RunningSessionEditor.tsx`) : nouveau `saveTargetValue(kind, rawValue)` (commit-on-change silencieux — écrit **uniquement si la valeur est valide**, sans flash d'erreur pendant la frappe) branché sur `onChangeText` des deux champs, en plus de l'`onBlur` existant. Plus de perte de saisie si « Terminé » est tapé sans blur.
- **« Terminé » ferme le clavier avant de naviguer** (`running-programs/edit.tsx`) : `Keyboard.dismiss()` puis `router.back()` → les champs d'entête du programme (`name`/`summary`/`durationWeeks`, commit `onBlur`) sont bien enregistrés avant de quitter.
- **Contrainte cloud `sessions_running_target_chk` retirée** (`20260712130000_drop_sessions_running_target_chk.sql`, appliquée manuellement au cloud le 12/07) : cette CHECK multi-colonnes (« type ⇒ cible obligatoire », posée en R3b-i) **rejetait les écritures intermédiaires** (type choisi avant la cible) et **bloquait la file d'upload PowerSync** → aucune écriture running ne montait au cloud. La règle « cible requise » reste validée **côté app** (`hasRunningSessionTarget`).

### Technique / Notes
- **Leçon offline-first** (ajoutée à [bonnes-pratiques.md](docs/specs/technical/bonnes-pratiques.md) §5) : éviter les CHECK constraints multi-colonnes dépendant d'un état complet — elles rejettent les écritures optimistes incrémentales et bloquent la synchro. Valider ces invariants côté application.
- `db:types` inchangé (drop de contrainte ≠ changement de colonnes). Diagnostic confirmé par requête cloud (durée `NULL` avant drop → OK après). Qualité verte (typecheck / lint / 451 shared + 29 mobile). **Rebuild preview** pour re-recette.

## 12/07/2026 — Fix : 5 correctifs running (recette device R3/R4)

_Branche : `fix/running-r3-r4-persistance-ui`. Bugs remontés à la recette device du build preview ; cause racine diagnostiquée puis corrigée, revue qualité (bug 4 repris en 2 passes). **100 % JS** (aucune migration, aucun schéma) → simple rebuild pour re-tester._

### Corrigé
- **Cause racine commune (init offline-first)** : plusieurs champs contrôlés étaient figés au montage via `useState(() => valeurAsyncPowerSync)` — avant résolution de `useQuery` la valeur était `null`, le champ restait vide au rechargement bien que la donnée soit **bien enregistrée**. Idiome corrigé partout : state local `null` + valeur affichée `local ?? valeurDB`.
  - **Allure de référence** (`running-profile.tsx`) : s'affiche désormais au rechargement du profil coureur (l'écriture fonctionnait déjà).
  - **Séance de course** (`RunningSessionEditor.tsx`) : le **type de cible « Durée »** et sa valeur sont conservés à la réouverture (valeurs effectives dérivées de la séance rechargée).
  - **Résumé de programme** (`program-repository.ts` + `running-programs/edit.tsx`) : `ProgramDetail` **expose** désormais `summary` (requête détail dédiée `COALESCE(tl.summary, tfr.summary)`, `SELECT_PROGRAM_BASE` liste inchangé) et le champ est pré-rempli à l'édition. _(Durée : round-trip vérifié correct — l'affichage vide était le même artefact de timing, résolu par l'idiome null-init.)_
- **Sélecteur « Objectif »** : `Segment` gagne une prop **opt-in `scrollable`** (scroll horizontal, largeur intrinsèque) — plus de retour à la ligne disgracieux ; les ~10 autres usages de `Segment` inchangés (défaut `false`).
- **Courbe d'allure — axe Y en M:SS** : `ProgressLineChart` gagne une prop **opt-in `formatYLabel`** qui **impose l'échelle tracée** (`maxValue`/`yAxisOffset`/`stepValue`) **et** les libellés sur la même plage `[min, max]` (helper pur testé `buildPaceYAxis` dans `@wellness/shared`, +6 tests) → les points tombent pile sur leurs graduations M:SS (au lieu de secondes brutes sur une échelle 0→max). Cas une seule course (`min==max`) géré (bande ±30 s). Muscu (`progress/index.tsx`) inchangé (opt-in).

### Technique / Notes
- Chemins d'écriture (SQLite/PowerSync) et schéma **inchangés** — bugs purement UI/affichage/requête. Composants partagés (`Segment`, `ProgressLineChart`) modifiés **uniquement via props opt-in** (rétro-compatible). React Compiler-safe (state + valeurs dérivées, aucun memo manuel).
- Qualité verte (typecheck 3 workspaces / lint / **451 shared + 29 mobile**). 6 commits (1 par bug + reprise du bug 4).
- **Rebuild preview** requis pour re-recette (pas de migration/cloud).

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
