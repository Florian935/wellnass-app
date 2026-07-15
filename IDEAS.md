# 💡 Idées — boîte de dépôt

Idées brutes captées au fil de l'eau, **sans cadrage**. Le but est de ne rien perdre :
on note vite ici, on trie plus tard.

Ce fichier n'est **pas** le pipeline de travail. Une idée retenue devient une US
(spec → plan → design → validation, voir [CLAUDE.md](CLAUDE.md)) puis rejoint la
[roadmap](docs/roadmap/roadmap.md) et le [TODO.md](TODO.md). Ici, c'est le brouillon d'avant.

- **Format** : une idée = une ligne, préfixée de la date `[JJ/MM/AAAA]` et d'un statut.
- **Statuts** : 🆕 nouvelle · 🔍 à creuser · ✅ promue en US · ❌ écartée
- **Tri** : on relit ensemble régulièrement ; ce qui est promu (✅) ou écarté (❌) descend
  dans « Archives » avec un mot d'explication.

---

## À trier

<!-- Ajoute tes idées ici, la plus récente en haut. Exemple :
- [12/07/2026] 🆕 Widget écran d'accueil avec la séance du jour.
-->

- [15/07/2026] 🔍 **SaaS coach (web, hors app mobile) — wedge = import IA de fichiers Excel/Sheets** :
  concrétise et prolonge [[module-coach-coache]] + [[offre-payante-coach]] (12/07). Idée : une
  **application web séparée** (pas dans l'app mobile), payante (B2B, le **coach paie**, l'athlète reste
  gratuit), qui permet aux coachs de **construire les programmes de leurs coachés** et de les suivre. Trois
  modules : **(1) program builder « en béton »** (exigence explicite de Florian) — constructeur manuel très
  poussé, réutilise/étend le constructeur admin **US 8.4** ; **(2) import IA** = **le wedge choisi** (décision
  Florian, 15/07) : les coachs bossent aujourd'hui sur des **fichiers Excel/Google Sheets** aux structures
  **toutes différentes** → pipeline IA qui **parcourt le fichier, infère la structure, propose un mapping en
  prévisualisation** (programme / cycles / séances / exos), le coach **vérifie et corrige** la traduction,
  **puis pousse en base** (Postgres/Supabase) ; **(3) dashboard coach** — vue de **tous ses athlètes**, perfs,
  stats détaillées (tendances, PR, volume/tonnage, nutrition, mensurations…), croisement des données.
  **Côté client = l'app Wellness gratuite** (différenciateur qu'aucun concurrent n'a : l'athlète suit les
  programmes de son coach dans une app 3 piliers qu'il veut *pour lui*). **Monétisation** : abonnement coach
  **+ suivi de paiements souple**, incluant les encaissements **hors plateforme** (virement/espèces coché
  manuellement, **sans commission** — anti « Stripe-tax »). _Marché (recherche 15/07) :_ le SaaS coach
  tout-en-un **est saturé** (Trainerize, TrueCoach — 5 % sur CB depuis 01/2026 —, Everfit, MyPTHub, 12REPS,
  TeamBuildr, TrainingPeaks) → **ne pas attaquer en généraliste**. Deux angles peu couverts = notre pari :
  (a) **import IA de fichiers hétérogènes** (concurrent le plus proche à **benchmarker en priorité =
  Repport** ; les autres imposent un CSV à modèle) ; (b) **paiements hors-plateforme** (les plateformes
  enferment dans leurs rails carte, les coachs bricolent avec Wave/compta). _Points durs (à instruire) :_
  **le pipeline d'import IA n'est PAS trivial** — l'appel au modèle ≈ 10 % du travail ; les 90 % = ingérer
  des fichiers en désordre (cellules fusionnées, semaines en colonnes, %1RM vs charges, RPE, texte libre,
  multi-onglets), **l'écran de préviz/mapping + correction**, et la **confiance** (vérifiable + réversible
  avant push). **Modèle relation coach↔athlète casse le RLS actuel** (tout est `owner_id`-scopé) → invitation
  + **consentement de l'athlète** + partage de données ciblé + RGPD. _Réemploi :_ constructeur **8.4**,
  `packages/shared`, socle Auth/RLS/offline. _Cible :_ **post-V1** (nouvelle ligne produit — ne pas ouvrir en
  dev tant que Wellness V1 n'est pas posée : admin 8.7/8.8 + recettes device en attente). À fusionner dans la
  réflexion « plateforme créateur » ([[module-influenceur]], [[marketplace-createurs-coachs]]) et
  [[bibliotheque-programmes-premium]]. _Prochaine étape :_ vraie session de **brainstorming** avant toute spec.

- [15/07/2026] 🆕 **Profils enrichis (fitness / running / alimentation) + mode « simple » gratuit vs
  « avancé » payant** : la section **Profil** doit être **bien plus poussée** — beaucoup plus de
  **réglages/paramètres** par pilier, pour personnaliser suggestions et analyses. Exemples de réglages
  à prévoir : **fitness/muscu** (objectif précis, niveau/expérience, matériel & lieu — salle/maison,
  fréquence hebdo dispo, jours dispo, blessures/contre-indications, préférences d'exercices, durée de
  séance visée) ; **running** (objectif/distance cible, allures de référence, VMA/FC si dispo,
  fréquence, terrain, échéance de course) ; **alimentation** (régime/restrictions/allergènes, nombre
  de repas, macros cibles fines, préférences/aversions, budget/temps de prépa). Ces réglages doivent
  être **pris en compte dans les analyses, les suggestions de programmes (muscu/running), les plans
  nutrition et les analyses croisées** (et alimenter le prompt/RAG de l'IA). **Piste monétisation** :
  deux modes de profil — **« simple » (plan gratuit)** = réglages minimaux, suggestions génériques ;
  **« poussé / avancé » (plan payant)** = réglages fins qui **débloquent des suggestions de
  programmes / plans alim / analyses croisées spécifiques et plus personnalisées**. Cohérent avec le
  principe « l'intelligence de croisement est payante » (cf. [[principe-monetisation]] et
  [ia-integration-analyse.md](docs/product/ia-integration-analyse.md) §6). Recoupe US 4.1 (profil
  nutritionnel), 5.1 (profil coureur), onboarding 1.7-1.9, et [[integration-ia]]. _À creuser :_ liste
  exacte des réglages par pilier ; comment le mode avancé nourrit concrètement les suggestions IA ;
  où placer le curseur gratuit/payant sans frustrer l'adoption.

- [15/07/2026] 🆕 **Podométrie — suivi des pas au quotidien** : compter les **pas** de l'utilisateur
  tout au long de la journée, en **arrière-plan**, **sans avoir à lancer une course** à chaque fois
  (ce serait relou de démarrer une séance running juste pour compter ses pas quotidiens). **Doit
  passer par l'accéléromètre du téléphone, pas par le GPS** : cas d'usage clé = marcher sur un **tapis
  de marche** (walking pad) pendant le travail — le GPS ne bouge pas, donc pas, allure et distance ne
  seraient pas comptés ; l'accéléromètre, lui, détecte le mouvement. À creuser : capteur/API pas natif
  (Android step counter / Health Connect côté Android, `expo-sensors`/pédomètre) vs comptage maison
  sur l'accéléromètre ; objectif de pas quotidien + streak/pastilles ; distinct du pilier Running (pas
  = activité de fond, pas une séance) mais peut nourrir les analyses transverses (dépense, régularité).
  Recoupe potentiellement l'intégration santé (Health Connect, US 9.9).

- [15/07/2026] 🆕 **Board de suggestions utilisateurs + votes (feature request board)** : un endroit
  dans l'app (emplacement à définir) où les utilisateurs **soumettent** des idées d'amélioration ou de
  nouvelles fonctionnalités, et où les **autres utilisateurs votent** (upvote) pour celles qu'ils
  veulent. Système qui **recense toutes les demandes**, classées par nombre de votes ; les plus votées
  sont candidates au dev (arbitrage Florian + Damien). Style **Canny / Featurebase / roadmap publique**.
  Briques : soumission (titre + description), **upvote** (1 voix/user), liste triée par votes + filtres
  (récent / plus votés / statut), **dédoublonnage/fusion** des demandes similaires, **statuts**
  (à l'étude / planifié / en cours / livré / refusé) visibles par tous, notif à l'auteur/aux votants
  quand une demande change de statut. Côté **back-office** : triage des demandes (fusion, statut,
  passage en US → rejoint [[catalogue-analyses]] / la roadmap), **modération** (spam, doublons,
  hors-sujet) — recoupe l'US 8.7 modération. _Points durs (à instruire) :_ modération & spam,
  **RGPD** (contenu utilisateur, droit à l'effacement), gestion des attentes (une demande votée ≠
  promesse de dev), i18n des demandes (FR/EN), abus de vote (multi-comptes). _À creuser :_ cible
  **post-V1** (nécessite une base d'utilisateurs pour avoir du sens) ; réutilise le socle Auth/RLS
  offline-first ; boucle vertueuse d'engagement communautaire.

- [15/07/2026] 🆕 **Module dédié Powerlifting (SBD)** : mode/module spécifique pour les pratiquants de
  powerlifting, avec **squat / bench / deadlift** au centre. Spécificités attendues : travail en
  **pourcentages du 1RM** (le max devient la référence, pas juste une charge saisie), **RPE / RIR**,
  planification de **blocs** (accumulation → intensification → **peaking / prépa compétition**),
  **calculateur de barre + disques**, suivi des **tentatives** et des **compétitions** (fédération,
  catégorie de poids, total, points **Wilks / DOTS / IPF**), historique des maxes par mouvement.
  **Gros besoin anticipé** sur l'app **et levier d'acquisition** : démarchage prévu de nombreux
  **coachs powerlifting** → à croiser avec [[module-coach-coache]]. _À creuser :_ cible **ultérieure**
  (pas V1) ; réutilise le socle muscu existant (exercices, séances, record 1RM Epley déjà en place)
  mais ajoute % du max, RPE/RIR, calculateur de disques et des objets « compétition ». Recoupe aussi
  le futur [[catalogue-analyses]] (analyses intra-muscu : progression au % du max, courbe de force).

- [13/07/2026] 🆕 **Suggestion de compléments alimentaires + partenariats vendeurs** : recommander des
  compléments (protéines, créatine, oméga-3, vitamine D, magnésium…) en croisant **alimentation loggée**
  (carences vs apports, micronutriments US 4.33), **profil nutritionnel** (objectif, TDEE, macros/RDA),
  **profil fitness** (pilier, volume, intensité) et **perfs/récup**. Ex. « apports en fer bas 5 j
  d'affilée + gros volume → envisager X ». Volet **monétisation** : **partenariats/affiliation** avec des
  vendeurs de compléments (lien tracké, revenue-share/CPA — même mécanique d'affiliation que
  [[module-influenceur]] et [[defis-sponsorises-marques]]). S'appuie sur le socle micronutriments (4.33)
  et le moteur [[analyses-croisees-poussees]] ; prolonge [[suggestions-substitution-aliments]] (aliment →
  complément). **Points durs (à instruire) : responsabilité santé / cadre réglementaire** (allégations
  santé, un complément n'est pas un médicament — conseil ≠ prescription), **conflit d'intérêt** (reco
  sincère vs sponsorisée → transparence obligatoire), **RGPD/santé** (données sensibles), qualité des
  données de carence (le journal ne couvre pas tout). Séparer **le moteur de reco** (valeur produit, peut
  rester neutre/gratuit) de la **couche partenariale** (monétisation par-dessus). Cible **post-V1** (après
  micros consolidés + activation paiement).
- [13/07/2026] 🔍 **Mensurations corporelles + historisation (tour de taille, poitrine, bras, cuisses…)** :
  saisie de mensurations avec **courbes d'évolution** dans le temps, à côté du poids de corps.
  _Vérifié le 13/07/2026 : **partiellement cadré mais non planifié**. La spec muscu §5 « Mesures
  corporelles & photos (E8) » ([musculation.md:182-187](docs/specs/functional/musculation.md#L182-L187))
  décrit déjà des « mesures corporelles optionnelles » + « courbes d'évolution du poids ET des mesures » +
  photos de progression (galerie privée RLS). MAIS E8 **n'est descendue en aucune US** dans la
  [roadmap](docs/roadmap/roadmap.md) : pas de version cible, **pas de modèle de données** (seul le poids
  de corps existe via `bodyweight`). → à promouvoir en US._ Piste data : table `body_measurements`
  (offline-first, historisée, une ligne par mesure/date), réutilise l'infra courbes du poids (4.30) et le
  hook `useUnits()` (cm/in). Recoupe les « analyses des coachés (mensurations) » de [[module-coach-coache]]
  et le check-in [[journal-bien-etre]]. Photos de progression = sous-lot distinct (Storage privé).

- [13/07/2026] 🆕 **Télémétrie d'usage comportementale (enrichir le plan analytics)** : compléter le
  cadrage analytics existant avec des métriques d'**usage**, pas seulement de résultat métier.
  _Vérifié le 13/07/2026 : l'**outil** (PostHog auto-hébergé US 9.10, V0.8 + Sentry) et un **doc de
  métriques** ([metriques-succes.md](docs/product/metriques-succes.md)) SONT cadrés — activation,
  rétention W1/W4, engagement par pilier (séances/sorties/jours de journal, streak, records), sync,
  crash, conversion post-V1. Mais ce sont des **résultats**, pas de la télémétrie comportementale._
  **Non énuméré → à ajouter** : temps passé dans l'app (durée de session) & temps cumulé/jour ;
  nombre de sessions/jour & fréquence d'ouverture ; **DAU/WAU/MAU + stickiness (DAU/MAU)** ; rétention
  long terme (W8/W12, courbe lissée) ; **funnels de parcours** (onboarding étape par étape → drop-off,
  activation pilier, création programme — aurait révélé le bug de rejeu onboarding) ; écrans les
  plus/moins vus + écran de sortie ; **adoption par fonctionnalité** ; profondeur de session
  (écrans/actions par session) ; heures/jours d'usage (caler les notifs) ; time-to-value par pilier ;
  taux de rebond J1. **Faisable dès V0.8** (PostHog capte tout ça) ; surtout un travail de définition
  d'événements + tableaux de bord. Respecter l'anonymisation/RGPD déjà prévue.
- [13/07/2026] 🆕 **Garde-manger virtuel (stock) + recettes selon le stock + alertes de réappro** :
  à la validation du « panier de courses », les articles entrent dans un **stock virtuel** (le
  « frigo » de l'app) ; le pilier nutrition propose alors des **recettes à partir de ce qu'on a**, et
  **alerte** quand un aliment est bientôt en rupture. Ferme une boucle avec les briques prévues :
  planning repas (US 4.27) → liste de courses (US 4.28) → **panier validé → garde-manger** → recettes
  ([[nutrition-recettes-healthy]] rendu concret/persistant) → cuisiner/logger **décrémente** le stock
  → alerte réappro → réalimente la liste. Scan code-barres OpenFoodFacts pour l'ajout. Différenciateur
  (anti-gaspillage, « je mange quoi ce soir ? » → engagement quotidien). **Points durs** : mode de
  décrément (manuel vs auto au log d'un repas/recette — sûrement un mix) ; **quantités par article**
  (données en plus vs journal actuel) ; périmètre logiquement **après** planning + liste (V1.1+).
  **Piste premium** : garde-manger de base gratuit, intelligence recettes-selon-stock en premium.
- [13/07/2026] 🆕 **Onglet compétition (muscu/fitness) — groupes / régional / global** : créer de
  petites compétitions au sein d'un groupe ou à l'échelle régionale/globale (classements par tonnage,
  distance, PR, progression…). Fort moteur d'engagement + **viralité** (inviter ses potes) → rétention
  & acquisition. Expression « compétition » de [[clubs-groupes]] ; support des
  [[defis-sponsorises-marques]]. **Calendrier & difficultés (honnête)** : le social est V2 et la
  gamification complète V3/V4 → **post-V1** ; **équité** (comparer entre gabarits/niveaux → catégories
  ou métriques relatives : % progression, score Wilks/DOTS, allure) ; **anti-triche** (données
  auto-déclarées → classement manipulable, enjeu d'intégrité) ; **vie privée** (classement régional =
  info de localisation → consentement). À distinguer des objectifs personnels (non sociaux) et des
  défis sponsorisés (compétition = mécanisme, sponsoring = monétisation par-dessus). Cible **V2+**.

### Salve plateforme créateur / communauté / B2B (13/07/2026)

- [13/07/2026] 🔍 **Principe directeur « plateforme créateur » (note)** : influenceur, coach et
  marketplace sont **la même plateforme** à des intensités différentes — coach = relation 1-à-1
  (suivi profond, facturation) ; créateur/influenceur = 1-à-plusieurs (programmes vendus en volume,
  communauté). Construire une **plateforme créateur unifiée** à deux modes plutôt que deux produits :
  mêmes briques (studio de programmes, paiement/reversements, analytics d'audience). Cadre les idées
  [[module-influenceur]], [[module-coach-coache]] et [[marketplace-createurs-coachs]] ci-dessous.

- [13/07/2026] 🆕 **Module influenceur (volant d'acquisition à deux faces)** : faire de l'app le canal
  de **livraison ET de monétisation** des influenceurs fitness, pour qu'ils l'adoptent et amènent leur
  audience. Thèse : l'influenceur gagne de l'argent + gagne du temps (remplace PDF + Sheets + DM +
  Stripe) → il promeut l'app lui-même → ses abonnés arrivent pour SON contenu → ils restent grâce à
  l'intégration muscu/nutrition/course → preuves de résultats → recrutement d'autres créateurs.
  **Plus-values concrètes** : (a) **studio de publication de programmes brandés** — réutilise le
  constructeur admin **US 8.4** ; (b) **partage de revenus/commission** (⚠️ infra paiement marketplace
  + reversements, au-delà de RevenueCat) ; (c) **espace créateur white-label léger** (thème/logo/
  vitrine) ; (d) **dashboard analytics d'audience** consenti/anonymisé (rétention, adhérence,
  résultats moyens) ; (e) **affiliation/parrainage créateur** (code/lien unique, CPA ou revenue-share
  — généralise [[programme-parrainage]]) ; (f) **défis animés par le créateur** ; (g) **broadcast**
  aux abonnés ; (h) lien avec le contenu YouTube/Insta ; (i) upsell coaching 1-à-1 via
  [[module-coach-coache]]. **Garde-fous** : marketplace bilatéral (fiscalité, droits de contenu,
  consentement RGPD des analytics), modération/responsabilité (programmes → risque blessure),
  amorçage poule/œuf (démarrer avec quelques créateurs triés), dépend de l'activation paiement
  (post-V1). **Reco court terme** : brique la moins chère et quasi prête = ouvrir le **studio 8.4** +
  un **système d'affiliation** pour les 1ers créateurs démarchés. _À penser fusionné avec
  [[module-coach-coache]] (cf. note ci-dessus)._
  - _**Arbitrage 15/07/2026** (même principe que [[module-coach-coache]] : produire sur le web,
    consommer sur mobile) :_ **on garde l'influenceur/créateur dans l'app mobile** — mais côté
    **audience** (1-à-N) : **vitrine, découverte, achat, communauté, broadcast, défis** vivent sur
    mobile, là où est son audience. En revanche l'**authoring des programmes** (le builder) est le
    **même moteur web partagé** que le [[saas-coach-import-ia]] (cf. note « plateforme créateur
    unifiée » : mêmes briques — studio de programmes, paiement, analytics — **surfaces différentes**).
    → **« influenceur en mobile » = oui pour la face vente/communauté** ; il construit ses programmes
    avec le même outil web que le coach._
- [13/07/2026] 🆕 **Marketplace de créateurs & coachs** : place de marché de programmes/plans —
  vitrines par créateur, notes/avis, découverte, badge « créateur vérifié ». Généralisation de
  [[module-influenceur]] + [[module-coach-coache]] ; alimente [[bibliotheque-programmes-premium]].
- [13/07/2026] 🆕 **Clubs & groupes (communauté)** : clubs de running, « crews » de salle — espace de
  groupe, classements, sorties communes. Brique communauté distincte du feed social (V2) ; support
  naturel pour les [[defis-sponsorises-marques]] et les défis animés par un créateur.
- [13/07/2026] 🆕 **Défis sponsorisés par des marques** : une marque finance un challenge (dotations)
  → engagement + revenu + acquisition. S'appuie sur [[clubs-groupes]] et la couche défis/sociale.
- [13/07/2026] 🆕 **Offre salles de sport (white-label) — B2B** : la salle offre l'app à ses adhérents
  et y publie ses cours/programmes. Revenu B2B récurrent ; réutilise le studio de programmes (US 8.4)
  et le white-label du [[module-influenceur]].
- [13/07/2026] 🆕 **Score de récupération / readiness (façon Whoop/Oura)** : croise sommeil, RPE et
  charge d'entraînement → « prêt à performer aujourd'hui ? ». S'appuie sur [[donnees-sommeil-pas]],
  [[journal-bien-etre]] et [[analyses-croisees-poussees]] ; recoupe le garde-fou surentraînement.

### Salve rétention / adoption / monétisation (13/07/2026)

- [13/07/2026] 🔍 **Principe directeur monétisation (note)** : le différenciateur du produit —
  l'**intégration des 3 piliers** — est la meilleure frontière payante. Gratuit = excellent tracker
  mono-pilier ; payant = l'**intelligence de croisement** (analyses, planning intelligent, coaching).
  Ne JAMAIS faire payer ce qui doit rester gratuit : export RGPD, synchro multi-appareils de base,
  offline. _Cadre les idées M1→M8 ci-dessous._

- [13/07/2026] 🆕 **[Rétention] Joker / gel de streak (façon Duolingo)** : un « streak freeze » qui
  protège la série un jour manqué — enlève la frustration qui fait abandonner. Levier de rétention
  très prouvé. Bon candidat premium (gratuit = 1 joker/mois, payant = plus).
- [13/07/2026] 🆕 **[Rétention] Notifications de reprise (win-back)** : après X jours d'inactivité,
  « ça fait 5 jours, on reprend en douceur ? » avec une séance courte proposée.
- [13/07/2026] 🆕 **[Rétention] Objectifs personnels à échéance + jalons** : « courir 50 km ce mois »,
  « +5 kg au développé d'ici 8 semaines » — anneau de progression + célébration. Non social
  (contrairement aux défis V2).
- [13/07/2026] 🆕 **[Rétention] Check-in quotidien léger (rituel)** : 10 s le matin
  (humeur/énergie/poids) pour créer la boucle d'habitude. Alimente [[journal-bien-etre]] et les
  corrélations [[analyses-croisees-poussees]].
- [13/07/2026] 🆕 **[Rétention] « Il y a 1 an » / souvenirs** : rappel d'une perf ou séance passée à
  la même date. Rétention émotionnelle, peu coûteux.
- [13/07/2026] 🆕 **[Rétention] Garde-fou surentraînement / rappel de repos** : détecte l'accumulation
  et suggère un jour off — éviter la blessure = éviter l'abandon. Recoupe [[detection-plateau-deload]]
  et [[journal-blessures]].

- [13/07/2026] 🆕 **[Adoption] Mode invité (essai sans compte)** : essayer l'app immédiatement, créer
  le compte plus tard (migration des données locales). Réduit la friction d'entrée ; va plus loin que
  l'onboarding skippable déjà cadré.
- [13/07/2026] 🆕 **[Adoption] Assistant de migration packagé** : l'import GPX/CSV (V1.1) présenté
  comme un vrai wizard « viens de Strava/Hevy/MyFitnessPal en 2 min », mis en avant à l'onboarding.
  Angle acquisition de la cible multi-apps.
- [13/07/2026] 🆕 **[Adoption] Partage de programme par lien/QR** : « essaie mon programme » — un
  utilisateur partage un template, le destinataire l'importe (et installe l'app). Viralité produit ;
  recoupe [[bibliotheque-programmes-premium]].
- [13/07/2026] 🆕 **[Adoption] Aperçu web d'une séance/course partagée** : le destinataire du lien
  voit un aperçu web soigné → incitation à installer. Entonnoir d'acquisition ; s'appuie sur
  [[carte-seance-partageable]] et la web app V2.
- [13/07/2026] 🆕 **[Adoption] Parcours « 7 jours pour démarrer »** : mini-programme d'activation
  guidé pour les nouveaux, tous piliers, pour atteindre vite le « aha moment ».

- [13/07/2026] 🆕 **[Monétisation] Analyses avancées & corrélations en premium** : le moteur
  [[analyses-croisees-poussees]] comme cœur de l'offre payante. Le gratuit montre les données, le
  payant explique les liens (perf ↔ nutrition ↔ récup). C'est LE différenciateur.
- [13/07/2026] 🆕 **[Monétisation] Historique illimité** : gratuit = N derniers mois de
  courbes/stats, premium = tout l'historique. Frontière indolore pour le nouvel utilisateur,
  précieuse pour l'assidu.
- [13/07/2026] 🆕 **[Monétisation] Bibliothèque de programmes experts premium** : programmes conçus
  par des coachs (prépa semi, PPL, prise de masse…). Alimente [[module-coach-coache]] et le
  constructeur admin (US 8.4).
- [13/07/2026] 🆕 **[Monétisation] Coach IA conversationnel** : sous-cas premium de
  [[integration-ia]] — pose des questions, ajuste le programme, répond « pourquoi je stagne ? » à
  partir des données de l'utilisateur.
- [13/07/2026] 🆕 **[Monétisation] Rapport PDF exportable (bilan santé/perf)** : beau document
  mensuel/trimestriel à partager avec un coach ou médecin. Le CSV RGPD reste gratuit ; le rapport mis
  en forme est premium.
- [13/07/2026] 🆕 **[Monétisation] Plafonds sur le gratuit** : ex. nombre de programmes actifs,
  d'exercices/aliments custom, ou de séances planifiées à l'avance ; illimité en premium. À doser
  pour ne pas frustrer l'adoption.
- [13/07/2026] 🆕 **[Monétisation] Personnalisation premium (cosmétique)** : thèmes, dashboard
  réarrangeable, badges. Revenu « fanatique » sans toucher aux fonctions cœur.
- [13/07/2026] 🆕 **[Monétisation] Accès anticipé aux nouveautés** : les abonnés testent les features
  en avant-première. Renforce le sentiment d'appartenance.

- [13/07/2026] 🆕 **Bilan hebdo/mensuel automatique** : un récap périodique narratif (volume, sorties,
  calories, PR, tendance) poussé en notification — distinct des widgets dashboard (vue live). Digest
  qui raconte la période. S'appuie sur les agrégats déjà cadrés.
- [13/07/2026] 🆕 **Rétrospective annuelle façon « Wrapped »** : récap annuel imagé et partageable
  (km parcourus, tonnage total, top exercices, records…). Fort levier d'acquisition virale ; recoupe
  [[carte-seance-partageable]].
- [13/07/2026] 🆕 **Rappels intelligents contextuels** : notifications situées — « séance prévue
  aujourd'hui », « déjeuner non loggé », « streak en danger ce soir ». S'appuie sur le planning
  unifié déjà cadré.
- [13/07/2026] 🆕 **Carte de séance/course partageable en image** : export visuel (trace GPS + stats,
  ou résumé muscu) pour stories Insta/WhatsApp. _NB : le feed social est V2 ; ici c'est du partage
  sortant statique, faisable avant._
- [13/07/2026] 🆕 **Programme de parrainage** : code d'invitation + récompense. Utile quand la
  monétisation s'activera (lié à [[offre-payante-coach]] / RevenueCat câblé).
- [13/07/2026] 🆕 **Reconnaissance de repas par photo** : sous-cas concret de [[integration-ia]] —
  photo de l'assiette → estimation des aliments/macros. Recoupe [[nutrition-recettes-healthy]].
- [13/07/2026] 🆕 **Suggestions de substitution d'aliments** : « il te manque 20 g de protéines
  aujourd'hui → ajoute X ». Complète le socle calories/macros cadré (TDEE, journal).
- [13/07/2026] 🆕 **Suivi du jeûne intermittent / fenêtre alimentaire** : timer + historique de la
  fenêtre repas. Public fitness demandeur ; non couvert par le cadrage nutrition.
- [13/07/2026] 🆕 **Substitution d'exercices (matériel indispo / blessure)** : « banc pris → variante
  haltères ». Améliore le logging live muscu ; lié à [[journal-blessures]].
- [13/07/2026] 🆕 **Détection de plateau + suggestion de deload proactive** : au-delà de la surcharge
  progressive déjà cadrée, détecter la stagnation d'un exercice et proposer un deload. Recoupe
  [[analyses-croisees-poussees]].
- [13/07/2026] 🆕 **Météo avant une sortie planifiée** : aujourd'hui la météo n'est qu'un champ
  post-séance ; l'afficher **en amont** d'une sortie prévue aide à planifier. Lié aux rappels
  contextuels.
- [13/07/2026] 🆕 **Journal de bien-être / humeur / énergie** : mini-suivi quotidien (humeur, énergie,
  stress) — potentielle **4ᵉ dimension légère** cohérente avec le nom « wellness ». Nourrit
  directement [[analyses-croisees-poussees]] (corrélation récup ↔ perfs).
- [13/07/2026] 🆕 **Journal blessures/douleurs & courbatures** : noter une zone sensible → l'app évite
  de programmer ce groupe ou alerte. Complète la récup ; lié à [[substitution-exercices]] et
  [[analyses-croisees-poussees]].
- [13/07/2026] 🆕 **Widget écran d'accueil Android** : les widgets 7.x cadrés sont *in-app* ; un vrai
  widget home-screen (séance du jour, streak, calories restantes) est un gap. _Chevauchement partiel
  avec le dashboard._
- [13/07/2026] 🆕 **Commandes / annonces vocales pendant la séance** : mains occupées — « série
  validée », « prochain exercice ». Étend à la muscu les annonces audio running déjà prévues.
- [13/07/2026] 🆕 **Langues supplémentaires (ES, DE…)** : extension naturelle post-FR/EN ; l'archi
  i18n (i18next) est déjà en place.
- [13/07/2026] 🆕 **Archivage sûr du contenu éditorial (désarchiver + garde-fou d'usage)** : suite au
  CRUD exercices (US 8.2), l'archivage = soft-delete **à sens unique** (pas de « désarchiver » dans
  l'admin) et **sans garde-fou**. Or archiver un exercice **déjà utilisé** dans des séances
  d'utilisateurs (`workout_sets`/`exercise_plans` le référencent) le retire de leur base locale
  (sync `deleted_at IS NULL`) → **référence orpheline** : le nom disparaît de leur historique.
  Pistes : (a) écran des **archivés** + **restauration** (`deleted_at → null`) ; (b) **garde-fou** qui
  compte les usages (`workout_sets`/`exercise_plans` référençant l'exercice) et **prévient/empêche**
  l'archivage d'un exercice populaire ; (c) généraliser aux autres contenus éditoriaux (aliments,
  programmes). Transverse aux lots CRUD admin (8.2→8.5). _Noté le 13/07/2026._
- [13/07/2026] 🆕 **Moteur d'analyses croisées poussées (corrélations)** : au-delà du socle de
  croisement déjà cadré, un vrai moteur qui met les données en relation — tendance des PR selon le
  volume/intensité, surplus vs déficit calorique corrélé à l'évolution des perfs, impact des pas
  sur la récup et les perfs, etc.
  _Vérifié le 13/07/2026 : le **socle** du croisement EST cadré (calories ajustées aux jours
  d'entraînement + vue « séances vs apports » §7.1-7.3 ; alerte déficit + fort volume US 4.32 =
  « première stat croisée » ; courbes volume/PR 3.21/3.39/3.40 ; RPE capté 3.34/5.24). Mais ce sont
  des stats croisées simples, pas un moteur de corrélation. Les analyses causales décrites ici ne
  sont PAS au cadrage → idée neuve. Dépend en partie de [[donnees-sommeil-pas]] (pas trackés) et
  recoupe les « analyses avancées » du [[module-coach-coache]]._
- [12/07/2026] 🆕 **Intégration de l'IA** dans le produit (thème transverse à préciser).
- [12/07/2026] 🆕 **Nutrition — suggestion de recettes healthy** : l'utilisateur renseigne les
  ingrédients qu'il a, l'app propose des recettes saines correspondantes (piste IA à évaluer).
- [12/07/2026] 🆕 **Données sommeil & pas (podométrie/steps)** : indicateur + saisie/import.
  _Vérifié le 12/07/2026 : non couvert par le cadrage actuel. Health Connect (US 9.9, V1) se
  limite à l'écriture des séances + lecture du poids ; les wearables V2 (zones FC, hydratation)
  ne nomment ni le sommeil ni les pas. → idée neuve à instruire. Piste : source de vérité via
  Health Connect (Android) / Apple Health (iOS ultérieur) plutôt que saisie manuelle._
- [12/07/2026] 🆕 **Gamification ludique via équivalences parlantes** : streak/indicateurs qui
  traduisent les perfs en repères concrets — ex. « Tu as couru X km ce mois-ci, soit la distance
  Paris–Marseille » ou « Tu as soulevé X tonnes cette séance, soit l'équivalent d'un Boeing ».
- [12/07/2026] 🆕 **Module Coach ⇄ Coaché (feature complète)** : espace dédié aux coachs et à
  leurs clients — templates/programmes, suivi poussé côté coach ET coaché, volet nutrition,
  facturation (coachs auto-entrepreneurs), suivi compta, analyses avancées des coachés (tendances,
  nutrition, mensurations, PR, perf, volume, tonnage…) et croisement des données
  muscu/nutrition/bien-être/course.
  - _**Arbitrage 15/07/2026** (principe directeur : **on produit sur le web, on consomme sur
    mobile** ; l'intensité de la relation — **1-à-1** coach vs **1-à-N** créateur — décide de la
    surface de gestion) :_ **séparer les deux faces de la relation.** **Face coach** (construire des
    programmes détaillés, piloter 10-30 clients, facturer, analyser) = travail lourd clavier/grand
    écran → **c'est le [[saas-coach-import-ia]] (web)**, PAS un module mobile. La « console coach »
    sur mobile est donc **rendue superflue par le SaaS** — on **ne construit pas** de console coach
    sur téléphone. **Face coaché** (recevoir le programme assigné par son coach, le suivre, renvoyer
    check-ins/retours) = **reste dans l'app mobile Wellness** — ce n'est pas un « module coach », c'est
    l'app de l'athlète qui sait afficher un programme assigné + un fil avec le coach. → **on ne
    supprime pas l'idée, on la recadre** : console coach = SaaS ; expérience coaché = mobile._
- [12/07/2026] 🆕 **Offre payante dédiée** aux coachs et à leurs coachés (monétisation du module
  Coach ci-dessus). _MàJ 15/07/2026 : la monétisation coach est portée par le [[saas-coach-import-ia]]
  (abonnement B2B + paiements souples, dont hors-plateforme sans commission) — voir arbitrage ci-dessus._

---

## Archives

<!-- Idées tranchées (promues ou écartées), pour garder la trace de la décision. Exemple :
- [10/07/2026] ✅ Export GPX des sorties → promue en US 5.xx.
- [10/07/2026] ❌ Intégration montres Garmin → hors périmètre V1, revoir en V2.
-->
