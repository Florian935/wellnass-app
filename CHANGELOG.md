# Changelog

Toutes les modifications notables du projet sont consignées ici — **maintenu automatiquement
par la commande [`/commit`](.claude/commands/commit.md)**. Chaque entrée est construite à partir
de l'analyse du `git diff` du commit, pour garder une **trace complète** des modifications
(utile aux devs et au débogage).

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/). Dates au format **JJ/MM/AAAA**.
Catégories : **Ajouté** · **Modifié** · **Corrigé** · **Supprimé** · **Technique / Notes**.

<!-- Nouvelles entrées ajoutées ICI (ordre anté-chronologique, la plus récente en haut) -->

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
