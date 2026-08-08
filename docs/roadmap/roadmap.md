# Roadmap — Wellness App (par versions)

Roadmap versionnée de référence, **adaptée aux arbitrages de cadrage du 04/07/2026**
(voir [SYNTHESE-CADRAGE.md](../../SYNTHESE-CADRAGE.md) et les [ADR](../adr/)).
Elle reprend la structure de la « Validation des Fonctionnalités » de Dams et applique les décisions actées (PowerSync, iOS reporté, monétisation inactive, bilingue FR+EN, gamification hors périmètre).

Colonne **Statut** = **avancement réel du code** (réconcilié le 06/08/2026, **tenu à jour à chaque livraison** — voir [`/commit`](../../.claude/commands/commit.md) et [`/reconcilier`](../../.claude/commands/reconcilier.md)) : ✅ Livré · 🟡 Partiel (socle présent, incomplet) · ⬜ À faire · ⏳ Reporté · ❌ Abandonné (retiré du périmètre, décision produit tracée en Remarques)

> 🔴 **Ce que ✅ veut dire, tranché le 06/08/2026 (Florian).** ✅ = **le code est complet**. Une
> recette device en attente ne fait **pas** redescendre une ligne à 🟡 : 🟡 est réservé à un
> **socle réellement incomplet** (un morceau de la fonctionnalité n'existe pas). La règle était déjà
> écrite ligne à ligne (7.19, 7.20, 7.21, 1.27, 3.57) mais 15 autres lignes appliquaient l'inverse —
> la colonne mesurait alors deux choses à la fois, et l'avancement affiché sous-estimait de 7 points.
> **Le reste-à-recetter se suit ailleurs, et uniquement là** : [RECETTES.md](../../RECETTES.md) pour
> les critères cochables, [ETAT.md](../../ETAT.md) pour le décompte.
**Autonomie Claude** : 🟢 Full auto (Claude seul) · 🟡 Semi (validation humaine requise) · 🔴 Humain requis (décision, data externe, clé API…)

> Les numéros (1.x compte, 2.x navigation/UX, 3.x muscu, 4.x alim, 5.x running, 6.x visualisation, 7.x dashboard, 8.x admin, 9.x technique) sont **thématiques** et stables — ils ne changent pas quand une fonctionnalité change de version. Les tâches ajoutées par les arbitrages portent un identifiant `9.x` explicite.
> Chaque développement suit les standards de [[Bonnes Pratiques Techniques]] (dont la Definition of Done, qui conditionne le passage d'une fonctionnalité à ✅).
> **MVP1 = V1.0 complète** (périmètre de lancement V0.1 → V1.0). V1.1 = post-lancement.

## ⚠️ Changements appliqués par les arbitrages du 04/07/2026 (à lire d'abord)

| # | Décision (ADR) | Impact sur la roadmap |
|---|---|---|
| B | [ADR-001](../adr/ADR-001-moteur-sync-offline.md) — **PowerSync** | Items **9.3 / 9.4 / 9.7 / 2.12** reformulés (SQLite local **géré par PowerSync**, conflits gérés par l'outil — plus de last-write-wins maison). **Nouvel item 9.13** « Dev build Expo + intégration PowerSync » ajouté en V0.1. **Le spike PowerSync conditionne le modèle de données** (à mener avant de figer les tables). |
| E | [ADR-004](../adr/ADR-004-plateforme-lancement.md) — **Android d'abord** | **9.1 (App iOS)** et **1.3 (OAuth Apple)** sortis du périmètre de lancement → section **« Ultérieur — iOS »**. **OAuth Google (1.2) conservé.** |
| D | [ADR-003](../adr/ADR-003-monetisation.md) — **RevenueCat inactif** | Aucun paywall en V1. **Nouvel item 9.14** « Câblage RevenueCat / entitlements (inactif) » — optionnel, sans écran de paiement. |
| G | Cadrage — **FR + EN au lancement** | Contenu **bilingue inclus dans le périmètre** des versions concernées (UI + programmes + traduction EN de la base CIQUAL) — **pas repoussé en V2**. Voir items marqués 🌐. |
| C | [ADR-005](../adr/ADR-005-gamification.md) — **Gamification hors V1** | Confirmée hors périmètre (réévaluation V3/V4). **Streak (V0.6) et records (V0.2/V0.3/V0.5) conservés** au titre de la motivation. |

*Chiffres (nb de fonctionnalités, heures) recalculés après ces arbitrages — voir [Récapitulatif](#récapitulatif). Chiffres indicatifs.*

---

## Plan de versions

| Version | Contenu | Livrable testable | Nb | Estimation |
|---|---|---|:---:|:---:|
| **V0.1** | Socle technique & compte (+ PowerSync, RevenueCat câblé inactif) | App qui démarre : compte, connexion, navigation, base locale gérée PowerSync | 17 | ~53h |
| **V0.2** | Muscu — exercices & séance libre | Première vraie valeur : faire et enregistrer une séance complète | 32 | ~69h |
| **V0.3** | Muscu — programmes, historique & records | Pilier muscu complet, utilisable au quotidien | 21 | ~60h |
| **V0.4** | Alimentation | Journal alimentaire complet + TDEE + recettes | 33 | ~68h |
| **V0.5** | Running | Suivi GPS complet + programmes de course | 33 | ~85h |
| **V0.6** | Dashboard, streak & sync cloud (PowerSync) | Accueil personnalisable, régularité, multi-appareils | 19 | ~55h |
| **V0.7** | Admin & contenu | Back-office + création du contenu éditorial | 10 | ~41h |
| **V0.8** | Bêta — conformité & intégrations | Play interne : OAuth Google, RGPD, Health, analytics | 9 | ~26h |
| **V0.9** | Enrichissements avant lancement *(ajoutée le 28/07/2026)* | Rétention (check-in, objectifs, bilan, joker de streak), mensurations, pas quotidiens, finitions UX de recette | 14 | ~57h |
| **V1.0** | Lancement store | Publication Play Store (Android) | 1 | — |
| **V1.1** | Post-lancement | Import de données, planning repas, liste de courses | 4 | ~18h |
| **[Hors cadrage](#hors-périmètre-de-cadrage--livré-en-cours-de-route)** | Né après le 04/07, déjà livré | Refonte muscu, widgets multi-formes, micronutriments, refonte nutrition… | 17 | *non estimé* |
| **Ultérieur — iOS** | Portage iOS (hors lancement) | App Store + OAuth Apple | 2 | — |
| | | **Total (périmètre de lancement)** | **210** | **~534h** |

**Logique d'ordonnancement** :
- **Muscu d'abord** : cœur de valeur, zéro dépendance externe (pas de GPS, pas de clé API) — on valide vite le produit.
- **Running en dernier des piliers** : c'est le plus gros risque technique (GPS arrière-plan, batterie, écran verrouillé) — on l'aborde avec une base stable (cf. [ADR-002](../adr/ADR-002-perimetre-v1.md)).
- **Offline-first + PowerSync dès V0.1** : impossible à rétrofitter. Le SQLite local **géré par PowerSync** est posé dès le départ ; la sync cloud s'active en V0.6, mais l'architecture est prête dès V0.1. **Le spike PowerSync précède le figeage du modèle de données** (cf. [ADR-001](../adr/ADR-001-moteur-sync-offline.md)).
- **Android d'abord** : le périmètre de lancement cible le Play Store ; iOS est reporté en section dédiée (cf. [ADR-004](../adr/ADR-004-plateforme-lancement.md)).
- **Bilingue FR + EN dès le départ** : l'infra i18n et le contenu bilingue sont intégrés version par version, pas en fin de projet.
- **Admin après les piliers** : pendant le dev, le contenu (exercices, programmes) est injecté par scripts de seed ; l'admin V0.7 industrialise avant la bêta.
- **Conformité et intégrations juste avant la bêta** : OAuth Google, export/suppression RGPD et analytics doivent exister avant d'ouvrir à de vrais testeurs.

> **📊 État réel au 28/07/2026** : les **3 piliers sont fonctionnels**, l'app tourne offline avec synchro
> cloud réelle, le back-office existe, la refonte muscu et les widgets multi-formes sont livrés.
> **V0.6 et V0.7 sont bouclées** ; V0.2/V0.3/V0.4/V0.5 sont complètes à quelques finitions près ;
> **9.9 Health Connect est livré et recetté**. Le reste-à-faire bloquant tient en **2 items** :
> **accessibilité (9.11/9.12)** et **9.2 publication Play Store** (compte développeur + review).
> Le cahier des charges étant en avance sur le calendrier de publication, la version **V0.9** a été
> créée le 28/07/2026 pour enrichir le produit pendant les délais externes de Google.
> **L'état courant se lit dans [ETAT.md](../../ETAT.md)** (généré) ; le reste-à-faire détaillé dans
> [BACKLOG.md](../../BACKLOG.md). Cette roadmap donne la **photo d'ensemble du périmètre**.

---

## V0.1 — Socle technique & compte

*Objectif : une app qui démarre, avec compte, navigation et stockage local géré par PowerSync. Rien de sexy, tout est fondation. **Le spike PowerSync conditionne le modèle de données** — à mener avant de figer les tables.*

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|:---:|---|
| 9.13 | **Dev build Expo + intégration PowerSync** *(nouvel item — arbitrage B)* | Dev build Expo (Expo Go insuffisant, module natif). Intégration du SDK PowerSync : SQLite local géré par PowerSync + connecteur Supabase. | Difficile | 8h | 🔴 | ✅ | **À poser en tout premier.** Conditionne le modèle de données — voir [spike-001-powersync](../specs/technical/spike-001-powersync.md) et [ADR-001](../adr/ADR-001-moteur-sync-offline.md). |
| 9.3 | Stockage local SQLite (PowerSync) *(reformulé — arbitrage B)* | Toutes les données écrites localement en priorité dans le **SQLite local géré par PowerSync**. L'app fonctionne sans connexion. | Difficile | 6h | 🟢 | ✅ | Fondation offline-first, posée sur PowerSync (9.13) au lieu d'un SQLite maison. |
| 2.11 | Fonctionnement hors-ligne | Toutes les fonctions (saisie, suivi, consultation) marchent sans connexion. | Difficile | 8h | 🟢 | ✅ | Principe transverse appliqué à chaque feature dès V0.1. |
| 1.1 | Inscription email + mot de passe | Création de compte avec identifiants classiques. Email vérifié avant accès complet. | Facile | 2h | 🟢 | ✅ | |
| 1.4 | Vérification email obligatoire | Lien envoyé par email, compte bloqué tant que non vérifié. | Facile | 1h | 🟢 | ✅ | Géré par Supabase Auth. |
| 1.5 | Session persistante | Pas de reconnexion à chaque ouverture. Token rafraîchi silencieusement. | Facile | 2h | 🟢 | ✅ | |
| 1.6 | Récupération mot de passe | Envoi d'un lien de réinitialisation par email. | Facile | 1h | 🟢 | ✅ | Envoi géré par Supabase Auth. **Complété par US CONF-08 (25/07/2026)** : l'envoi seul ne suffisait pas — le lien menait à une page morte `localhost:3000` et **aucun écran de saisie du nouveau mot de passe n'existait** (récupération impossible sur mobile). Livré : deep link `wellness://password-reset`, gate de routing `password-recovery`, écran « nouveau mot de passe », révocation de tous les appareils, gestion des liens expirés. **Recette validée à 100 % (Florian, 25/07/2026)** — Redirect URL Supabase configurée ; 2 bugs de deep link corrigés en recette (route à nommer d'après le chemin du lien, échappatoire depuis `auth-callback`). Relecture Damien non requise. **US clôturée.** |
| 9.5 | Authentification JWT | Token court (accès) + token long (refresh). Renouvellement silencieux. | Moyen | 4h | 🟢 | ✅ | Géré par Supabase Auth. |
| 9.6 | Isolation données utilisateur | Row Level Security — chaque utilisateur n'accède qu'à ses données. | Moyen | 3h | 🟢 | ✅ | |
| 9.8 | Chiffrement tokens | Android Keystore (iOS Keychain lors du portage). Jamais en clair. | Moyen | 2h | 🟢 | ✅ | `lib/secure-storage.ts` (SecureStore/Keystore). |
| 9.14 | **Câblage RevenueCat / entitlements (inactif)** *(nouvel item optionnel — arbitrage D)* | SDK RevenueCat intégré, entitlements multi-paliers définis (Premium muscu → Écosystème → IA), **laissés inactifs**. **Aucun écran de paiement, aucun paywall.** | Facile | 2h | 🟡 | ⏳ | **Reportée le 30/07/2026 (Florian)** après cadrage : le [PRD](../product/prd.md) dit les paliers « non engageants », « Premium muscu » n'a aucun contenu défini, aucune fonctionnalité IA n'est livrée (donc **aucun consommateur réel** pour la couture) et LANCE-00 non fait (donc aucun produit configurable). Motifs détaillés dans [BACKLOG.md](../../BACKLOG.md). **À reprendre avec la 1ʳᵉ US IA.** |
| 1.21 | Écrans légaux & consentement | CGU + politique de confidentialité acceptées à l'inscription. Âge minimum 16 ans (RGPD). | Facile | 2h | 🟡 | ✅ | `(auth)/terms.tsx`, `privacy.tsx`, contrôle âge 16+ à l'inscription. 🌐 bilingue FR+EN. |
| 2.1 | Bottom tab bar 4 onglets | Navigation principale : Accueil / Muscu / Running / Alim. | Facile | 2h | 🟢 | ✅ | Onglets vides au début, remplis version après version. |
| 2.2 | Masquage onglets non activés | Si running non activé, son onglet disparaît. Réactivable depuis les paramètres. | Facile | 1h | 🟢 | ✅ | Filtre sur `settings.activePillars`. |
| 1.15 | Unités métrique / impérial | Bascule kg/km ↔ lbs/miles. S'applique à toute l'app. | Facile | 2h | 🟢 | ✅ | À poser tôt : impacte tous les affichages suivants. |
| 1.16 | Thème clair / sombre / système | Apparence de l'app. "Système" suit le réglage OS. | Facile | 2h | 🟢 | ✅ | |
| 2.10 | États vides soignés | Chaque écran sans données affiche explication + CTA. Jamais de graphique vide. | Facile | 3h | 🟢 | ✅ | `components/EmptyState.tsx`, principe continu. |

> **🌐 i18n (arbitrage G)** : l'infra i18n est posée dès V0.1 (aucune chaîne en dur) **et** le contenu s'écrit bilingue FR + EN au fil des versions — voir la note 🌐 sur les items à contenu éditorial.

---

## V0.2 — Muscu : exercices & séance libre

*Objectif : la première vraie valeur utilisateur — faire une séance de muscu complète et l'enregistrer. La séance libre d'abord (aucune dépendance aux programmes).*

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|:---:|---|
| 1.7 | Onboarding — Infos de base | Prénom, âge, poids, taille au premier lancement. **Skippable** (bouton « Passer »). | Facile | 3h | 🟢 | ✅ | Onboarding minimal par défaut (arbitrage F). |
| 1.8 | Onboarding — Piliers actifs | Choix des modules à activer. **Skippable.** | Facile | 2h | 🟢 | ✅ | |
| 1.9 | Onboarding — Objectif principal | Masse / sèche / performance / santé. **Skippable.** | Facile | 2h | 🟢 | ✅ | |
| 1.11 | Onboarding — Récapitulatif | Résumé des choix + suggestion d'une première action. | Facile | 1h | 🟢 | ✅ | S'enrichit en V0.4 (TDEE). |
| 1.12 | Modification du profil | Mise à jour des données utilisateur depuis les paramètres. | Facile | 2h | 🟢 | ✅ | Toute la config reste modifiable après onboarding. |
| 3.13 | Bibliothèque d'exercices | Base fournie par l'app avec fiche complète par exercice. | Moyen | 4h | 🟡 | ✅ | Fiche complète `/exercises/[id]` (nom, groupe, matériel, instructions, muscles secondaires, variantes, records) + accès direct depuis le hub muscu — MUSC-F10a/b (22/07/2026). 🌐 fiches bilingues FR+EN. |
| 6.1 | GIF animé par exercice | Animation en boucle du mouvement correct. | Moyen | 4h | 🔴 | ❌ | **Abandonné** (décision Florian/Damien, 20/07/2026) : jugé trop complexe pour la valeur apportée (sourcing + hébergement + import en masse). `media_url` reste stocké (colonne inoffensive, non retirée) mais ne sera **jamais rendu**. Voir [[Musculation]]. |
| 3.18 | Démonstration GIF animé | GIF affiché sur la fiche exercice. | Moyen | 4h | 🟡 | ❌ | **Abandonné** avec 6.1 (dont il dépendait). |
| 6.2 | Muscles ciblés sur schéma | Corps humain SVG avec muscles travaillés en évidence. | Moyen | 4h | 🟢 | ✅ | **MUSC-F1b, 02/08/2026** : anatomie fine à 10 muscles (`muscles_fine`, **additive** aux 6 groupes larges existants, spec §0), `<BodyMap/>` (11 tracés, face + dos), montée sur la fiche exercice, l'aperçu de séance et le bilan hebdo. Repli automatique sur les groupes larges tant qu'un exercice n'est pas tagué fin (travail de coach, hors dev). ⚠️ Critère de recette 12 (relecture anatomique des 11 tracés) reste à valider — device requis. |
| 3.14 | Recherche d'exercices | Par nom, groupe musculaire ou matériel. | Facile | 2h | 🟢 | ✅ | Nom + **filtre groupe musculaire & matériel** (tiroir Filtres, MUSC-F3). Recette device validée (Florian, 22/07/2026). |
| 3.15 | Exercices favoris | Épingler les exercices préférés. | Facile | 1h | 🟢 | ✅ | `toggleFavorite` + tri favoris. |
| 3.16 | Exercice personnalisé | Créer un exercice custom si absent de la base. | Facile | 2h | 🟢 | ✅ | `addCustomExercise` ; création en **modale bottom-sheet** (MUSC-F11) ; **édition enrichie** (groupe, matériel, muscles secondaires, instructions) en modale (MUSC-F12, 23/07/2026). **Recette validée (Florian, 23/07/2026).** |
| 3.17 | Note par exercice | Champ persistant (réglage de siège, position machine), affiché en séance. | Facile | 1h | 🟢 | ✅ | Champ note persistant par exercice (refonte C3, `exercise_notes`), édité en séance (`CurrentSetCard`). |
| 3.19 | Muscles ciblés | Muscle principal + secondaires sur la fiche. | Facile | 2h | 🟢 | ✅ | Primaire + **muscles secondaires** (colonne `muscles_secondary`, saisie admin, affichage fiche — MUSC-F10c-1, 22/07/2026). **Recette validée (Florian, 23/07/2026).** Schéma corporel SVG = 6.2 (séparé). |
| 3.20 | Variantes / alternatives | Exercices similaires pour remplacer si besoin. | Facile | 2h | 🟢 | ✅ | Table `exercise_variants` symétrique ; liens **éditoriaux** (admin, biblio↔biblio) + **personnels** (mobile, toute fiche) ; section cliquable sur la fiche — MUSC-F10c-2, 22/07/2026. **Recette validée (Florian, 23/07/2026).** Remplacement en séance = 3.32 (séparé). |
| 3.23 | Séance libre | Séance vide sans programme, exercices ajoutés au fil de l'eau. | Moyen | 3h | 🟢 | ✅ | Le parcours cœur de cette version. |
| 3.25 | Validation de série | Reps + charge réels, valeurs pré-remplies. | Moyen | 4h | 🟢 | ✅ | `updateSet` + pré-remplissage `addSet`. |
| 3.26 | Dernière performance affichée | "La dernière fois : 80 kg × 8 / 8 / 7" au-dessus de la saisie. | Facile | 2h | 🟢 | ✅ | `useLastPerformance` + `lastPerfLabel` (« dernière fois ») au-dessus de la saisie (`workout.tsx`). |
| 3.27 | Types de séries avancés | Échauffement, superset, durée (gainage), poids de corps ± lest. | Moyen | 4h | 🟢 | ✅ | Sélecteur de type en séance (`TYPE_CHIPS` dans `CurrentSetCard` : normal / dropset / échec / durée / poids de corps + raccourci échauffement) — Refonte-C2 ; superset par liaison explicite (`workout_superset_pairs`) — Refonte-C3. |
| 3.28 | Chrono de repos automatique | Déclenché après chaque série validée. Configurable par exercice. | Facile | 2h | 🟢 | ✅ | Repos auto **par exercice** : cible du plan (`sessionRest`) puis surcharge en séance (`restOverride`, ± en direct), repli 90 s (`workout.tsx`). |
| 3.29 | Alerte vibration fin de repos | Vibration + signal visuel. | Facile | 1h | 🟢 | ✅ | `Vibration.vibrate()` à 0 s du repos (`workout.tsx`). |
| 3.30 | Ajouter / supprimer une série | En cours de séance. | Facile | 1h | 🟢 | ✅ | `addSet` / `removeSet`. |
| 3.31 | Modifier charge / reps en direct | Sans quitter l'écran. | Facile | 1h | 🟢 | ✅ | `updateSet` en direct. |
| 3.32 | Remplacer un exercice en direct | Choisir une variante en séance. | Moyen | 3h | 🟢 | ✅ | `replaceExercise` + action « Remplacer » sur l'exercice courant (picker existant, exclut les exercices déjà présents) — Refonte-C3. |
| 3.33 | Note de séance | Champ texte libre. | Facile | 1h | 🟢 | ✅ | Note de séance collectée au résumé (`workout-summary.tsx` → `setWorkoutFeedback`). |
| 3.34 | Ressenti global | RPE 1-10 ou 5 étoiles en fin de séance. | Facile | 1h | 🟢 | ✅ | RPE de séance saisi au résumé (`RpeSelector` → `setWorkoutFeedback`). |
| 3.35 | Résumé fin de séance | Durée, volume, séries validées, records battus. | Moyen | 3h | 🟢 | ✅ | `workout-summary.tsx`. |
| 3.36 | Mise en pause de séance | Reprenable jusqu'à la clôture automatique (3h, US 3.37). | Moyen | 3h | 🟢 | ✅ | **MUSC-F6 — réconcilié le 01/08/2026 (Option A, Florian).** Le « conflit 3h/4h » n'a **jamais existé dans le comportement observable** : `WORKOUT_AUTO_CLOSE_SECONDS` (3h, déjà testée) est la seule limite réelle ; la promesse « 4h + popup Pause » de `musculation.md` §4.4 n'avait jamais été implémentée (aucun statut `paused`, aucune constante, aucune chaîne i18n). Doc corrigée pour dire ce que le code fait déjà — **zéro ligne de code applicatif**. |
| 3.37 | Clôture automatique après 3h | Fermeture et sauvegarde automatiques. | Facile | 1h | 🟢 | ✅ | `isWorkoutStale` + `autoCloseStaleWorkout()` au démarrage (gaté `hasSynced`), durée plafonnée à la dernière activité réelle (25/07/2026). |
| 3.22 | Record personnel (1RM estimé) | Formule d'Epley : charge × (1 + reps/30). | Facile | 1h | 🟢 | ✅ | `shared/records.ts` `estimate1RM`. Motivation (arbitrage C). |
| 2.3 | Écran actif pendant séance | Pas de mise en veille pendant un suivi actif. | Facile | 1h | 🟢 | ✅ | `useKeepAwake()` dans `workout.tsx` (muscu) — présent aussi en course. |
| 6.3 | Accès démo pendant la séance | Modal depuis l'écran de suivi, sans couper le chrono. | Facile | 1h | 🟢 | ❌ | **Abandonné avec 6.1** (décision Florian/Damien, 20/07/2026) : plus de démo à afficher. Retiré du périmètre de l'US Refonte-C3. |

---

## V0.3 — Muscu : programmes, historique & records

*Objectif : le pilier muscu complet — programmes structurés, planning, courbes de progression, notifications.*

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|:---:|---|
| 3.4 | Création programme custom | Composer son propre programme de A à Z. | Moyen | 5h | 🟢 | ✅ | `createProgram` + `programs/edit.tsx`. Le custom valide le modèle de données. |
| 3.5 | Semaine type | Groupes musculaires par jour, base du planning. | Moyen | 3h | 🟢 | ✅ | `sessions` + affectation jour. |
| 3.6 | Composition de séance | Exercices + séries / reps / charge / repos. | Moyen | 4h | 🟢 | ✅ | `exercise_plans` + `SessionEditor`. |
| 3.1 | Bibliothèque de programmes | Catalogue pré-conçu (PPL, Full Body, 5×5…). | Moyen | 4h | 🟡 | ✅ | **CONTENU-01, 29/07/2026** : 3 programmes publiés, bilingues FR+EN — Full Body Débutant (seed initial), **Push / Pull / Legs** et **Half Body haut/bas** (migration idempotente `20260729075443`). 35 exercices planifiés au total, tous issus des 16 de la bibliothèque. |
| 3.2 | Filtres bibliothèque | Objectif, niveau, durée, équipement. | Facile | 2h | 🟢 | ✅ | `useProgramLibrary(filters)`. |
| 3.3 | Dupliquer un programme | Copier pour personnaliser sans toucher l'original. | Facile | 1h | 🟢 | ✅ | `duplicateProgram`. |
| 3.12 | Un programme actif à la fois | Activer un programme désactive le précédent (historique conservé). | Facile | 1h | 🟢 | ✅ | `activateProgram` (un actif par pilier). |
| 3.9 | Planning calendrier auto | Séances placées automatiquement après activation. | Moyen | 4h | 🟢 | ✅ | `planProgram`. |
| 3.10 | Décalage de séance | Glisser-déposer vers un autre jour. | Moyen | 3h | 🟢 | ✅ | **MUSC-F9, 01/08/2026** : appui long + glissement (`react-native-gesture-handler`/`reanimated`), zones de dépôt mesurées à chaque prise de geste, `reschedulePlannedSession` réutilisée telle quelle. Les 3 boutons de report restent (chemin accessible). ⚠️ `expo-haptics` neuf → nouveau dev build requis pour recette device. |
| 3.11 | Gestion séance manquée | Reporter ou sauter. | Facile | 2h | 🟢 | ✅ | `skip` + `reschedule` + `useMissedSessions`. |
| 3.24 | Plan de séance avant démarrage | Récap des exercices prévus avec cibles. | Facile | 2h | 🟢 | ✅ | `programs/[id].tsx`. |
| 3.7 | Progression automatique | Charge cible +X d'une semaine à l'autre (si ≥ 80 % complété). | Moyen | 3h ⚠️ *sous-évalué* | 🟢 | ✅ | **MUSC-F15 — code livré le 02/08/2026** → [spec](../specs/functional/us/muscf15-progression-programme.md) · [plan](../plans/muscf15-progression-programme.md) · [maquette](../../design/muscf15-progression-programme/muscf15-progression-programme.html), en recette → [RECETTES.md](../../RECETTES.md). Cadrage tranché sans cible évolutive stockée : second gate sur `computeProgressionSuggestion` (`weightHold`, symétrique au `previousStruggled` de MUSC-F7) — poids gelé si la semaine précédente du programme (`week_index − 1`) n'a pas atteint 80 % de complétion. Le deload (3.8) reste prioritaire sur ce gate. |
| 3.8 | Deload / gestion de stagnation | Échec 2 semaines de suite → proposition −10 %. Jamais imposé. | Moyen | 3h | 🟢 | ✅ | **MUSC-F7 — code livré le 01/08/2026** → [spec](../specs/functional/us/muscf7-progression-assistee.md) · [plan](../plans/muscf7-progression-assistee.md), en recette → [RECETTES.md](../../RECETTES.md). `sessionStruggled` exportée + requête symétrique (`OFFSET 1`) + hook `usePreviousStruggled` : le signal manquant est câblé, la brique de calcul et l'UI existaient déjà (Refonte-C3). Pas de maquette (aucune UI nouvelle). |
| 3.38 | Historique des séances | Liste chronologique filtrable. | Moyen | 3h | 🟢 | ✅ | `history/index.tsx`. Journal horodaté = base future couche jeu (arbitrage C). |
| 3.39 | Courbes charge / volume | Évolution par exercice sur différentes périodes. | Moyen | 4h | 🟢 | ✅ | `progress/index.tsx` + `ProgressLineChart`. |
| 3.21 | Courbe de progression par exercice | Charge max / volume sur 30 / 90 j / 1 an. | Moyen | 4h | 🟢 | ✅ | + 1RM estimé + période « tout » (MUSC-04). |
| 3.40 | Volume par groupe musculaire | Séries par groupe sur la semaine — détecte les déséquilibres. | Moyen | 3h | 🟢 | ✅ | `MuscleVolumeBarChart` + `useMuscleVolumeThisWeek`. |
| 3.41 | Alerte déséquilibre musculaire | Si un groupe très sous-sollicité sur 2 semaines. | Moyen | 3h | 🟢 | ✅ | `useMuscleBalance` + alerte groupes négligés (MUSC-05). |
| 3.42 | Notification nouveau record | Push + animation quand un record est battu. | Facile | 2h | 🟢 | ✅ | US MUSC-F8. Push **agrégé** (1 par séance, jamais 1 par record) + célébration animée transposée de la course. |
| 2.4 | Notif — Rappel séance | Push 30 min avant une séance planifiée. | Moyen | 3h | 🟢 | 🟡 | US MUSC-F8. **Recadré en échéance apprise** (p90 de `finished_at`) : `scheduled_date` est un jour sans heure, « 30 min avant » est incalculable en l'état. Vrai horaire = US à part (heure de séance en base). |
| 2.7 | Notif — Nouveau record | Push immédiat. | Facile | 1h | 🟢 | ✅ | US MUSC-F8. Muscu uniquement (course écartée : son chemin de détection est aussi celui du backfill, qui rejouerait tout l'historique). Plafond de 3/jour réellement appliqué (D14, solde D3 de NUTR-F1). |
| 3.56 | Record par plage de répétitions | Meilleure charge par tranche de reps (1/3/5/8/10/12+) sur la fiche exercice. | Facile | 2h | 🟢 | ✅ | **MUSC-09, code livré le 02/08/2026**, en recette → [RECETTES.md](../../RECETTES.md). `resolveRepBucketRecords` (packages/shared, pur, 7 tests) + section sous les 3 tuiles de records existantes (`[id].tsx`). Même éligibilité de série que le reste du système de records, plage jamais travaillée absente (pas à 0), ordre fixe 1→12+. Aucune migration. |

---

## V0.4 — Alimentation

*Objectif : journal alimentaire complet, sans friction de saisie, avec TDEE et lien vers l'entraînement.*

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|:---:|---|
| 1.10 | Onboarding — Suivi alimentaire | Activer ou non le module nutrition. **Skippable.** | Facile | 1h | 🟢 | ✅ | Pilier activable. |
| 4.8 | Base d'aliments fournie | Catalogue avec valeurs pour 100 g. | Moyen | 4h | 🔴 | ✅ | **Décision bloquante V0.4** tranchée : CIQUAL (bruts FR) + OpenFoodFacts (industriels). 🌐 traduction EN incluse (arbitrage G). |
| 4.1 | Calcul TDEE automatique | Mifflin-St Jeor + facteur d'activité. | Facile | 2h | 🟢 | ✅ | `tdee()` Mifflin-St Jeor. |
| 4.2 | Facteur d'activité paramétrable | 5 niveaux, s'adapte au planning. | Facile | 1h | 🟢 | ✅ | `ACTIVITY_LEVELS` (5 niveaux). |
| 4.3 | Ajustement manuel de l'objectif | Objectif calorique libre. | Facile | 1h | 🟢 | ✅ | `manualCalories`. |
| 4.4 | Répartition macros par défaut | Ratios P/G/L selon l'objectif. | Facile | 2h | 🟢 | ✅ | `defaultMacroRatios(objective)`. |
| 4.5 | Modification manuelle des macros | En grammes ou %, vues synchronisées. | Facile | 2h | 🟢 | ✅ | g↔% synchronisés. |
| 4.6 | Restrictions / allergènes | Végétarien, vegan, sans gluten, halal, allergènes. | Facile | 2h | 🟢 | ✅ | `DIET_RESTRICTIONS` + allergènes. |
| 4.7 | Calories adaptées à l'entraînement | Objectif plus élevé les jours de séance. | Moyen | 3h | 🟢 | ✅ | `trainingDayBonus` + `useDayCalorieTarget` (forfait/auto). Intégration inter-piliers. |
| 4.9 | Recherche par nom | Suggestions en temps réel. | Facile | 2h | 🟢 | ✅ | `useFoods(search)`. |
| 4.10 | Scan code-barres | EAN via caméra. | Moyen | 3h | 🟢 | ✅ | `food-scan.tsx` (`CameraView`). |
| 4.11 | Import OpenFoodFacts | Recherche auto si code-barres absent en local. | Moyen | 4h | 🟢 | ✅ | `searchOpenFoodFacts` / `importOpenFoodFactsFood`. |
| 4.12 | Aliments favoris / récents | Accès rapide aux aliments fréquents. | Facile | 1h | 🟢 | ✅ | `useFavoriteFoods` / `useRecentFoods`. |
| 4.13 | Aliment personnalisé | Valeurs libres si non trouvé en base. | Facile | 2h | 🟢 | ✅ | `food-custom.tsx`. |
| 4.14 | Journal quotidien — 4 repas | Petit-déj / Déjeuner / Dîner / Collation. Renommables. | Moyen | 4h | 🟢 | ✅ | `resolveMealConfig`. |
| 4.15 | Ajout / suppression de repas | 5e repas ou suppression. | Facile | 1h | 🟢 | ✅ | `nutrition-meals.tsx`. |
| 4.16 | Ajout aliment + quantité | Rechercher, saisir la quantité, valider. | Facile | 2h | 🟢 | ✅ | `QuantityPanel`. |
| 4.17 | Portions usuelles | "1 œuf = 60 g" — portion par défaut, grammes disponibles. | Moyen | 3h | 🟢 | ✅ | `scalePortions`. Anti-friction n°1. |
| 4.18 | Copier un repas / une journée | Dupliquer un repas ou une journée en 2 taps. | Facile | 2h | 🟢 | ✅ | `copyMeal` / `duplicateDay`. |
| 4.19 | Quick add calories | Calories directes sans recherche d'aliment. | Facile | 1h | 🟢 | ✅ | `QuickAddPanel`. |
| 4.20 | Total calories + macros temps réel | Compteur instantané à chaque ajout. | Facile | 2h | 🟢 | ✅ | `sumNutrients`. |
| 4.21 | Barres de progression macros | Jauges P / G / L vers l'objectif du jour. | Facile | 2h | 🟢 | ✅ | `nutrition.tsx` macroBars. |
| 4.22 | Navigation entre les jours | ◀ / ▶ entre les journaux. | Facile | 1h | 🟢 | ✅ | `addDays` ◀/▶. |
| 4.23 | Saisie rétroactive | Journal passé modifiable sans limite. | Facile | 1h | 🟢 | ✅ | `addFoodEntry(date, …)`. |
| 4.24 | Création de recette | Plusieurs ingrédients + nombre de portions. | Moyen | 3h | 🟢 | ✅ | `recipe-edit.tsx`. |
| 4.25 | Valeurs nutritionnelles calculées | Macros totales et par portion automatiques. | Facile | 1h | 🟢 | ✅ | `perServing`. |
| 4.26 | Repas types (templates) | Réutiliser un repas entier en 1 tap. | Facile | 2h | 🟢 | ✅ | `saveMealAsTemplate` / `applyTemplate`. |
| 1.13 | Historique poids corporel | Pesées enregistrées et affichées en courbe. | Facile | 3h | 🟢 | ✅ | `bodyweight-repository.ts`. |
| 1.14 | Rappel de pesée | Notification optionnelle à heure fixe. | Facile | 1h | 🟢 | ✅ | US NUTR-F1. Périmètre **élargi** : l'heure n'est pas fixe mais **apprise** (p90 des heures de pesée, 14 j, local). Opt-in. `reminder-habits-repository.ts`. |
| 4.30 | Courbe poids corporel | Évolution sur 4 sem / 3 mois / 1 an. | Moyen | 3h | 🟢 | ✅ | `nutrition-stats.tsx`. |
| 4.31 | Évolution apports moyens | Calories et macros moyennes 7 / 30 jours. | Moyen | 3h | 🟢 | ✅ | `averageIntake`. |
| 4.32 | Alerte déficit + fort volume | Déficit important + semaine à fort volume muscu. | Moyen | 2h | 🟢 | ✅ | `DeficitVolumeAlertCard`. Première stat croisée entre piliers. |
| 2.5 | Notif — Rappel repas | Push à heure définie. | Facile | 1h | 🟢 | ✅ | US NUTR-F1. **Un** rappel de journal (pas un par repas : aucune heure n'est associée aux repas en base). Échéance apprise, opt-in. `useProgrammedRemindersScheduler`. |
| 4.38 | Répartition calorique par repas | Part (%) + moyenne (kcal/j) par repas, fenêtre 7 j/30 j. | Facile | 2h | 🟢 | ✅ | **NUTR-16, code livré le 02/08/2026**, en recette → [RECETTES.md](../../RECETTES.md). `resolveMealSplit` (packages/shared, pur, 8 tests) + section « Répartition par repas » sous « Apports moyens » (`nutrition-stats.tsx`, même toggle 7 j/30 j). Groupe par la **valeur réelle** de `meal_type` (plus un enum fixe depuis les repas personnalisés, item 4.15) ; bucket « Autres » et repli de libellé réutilisés du journal. Aucune migration. |

---

## V0.5 — Running

*Objectif : le pilier au plus gros risque technique (GPS arrière-plan, batterie, écran verrouillé) — abordé une fois la base stable. Commencer par 5.12-5.16 : le tracker GPS nu, à valider sur le terrain avant le reste. Valider aussi tôt la tenue de PowerSync sur les traces GPS volumineuses.*

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|:---:|---|
| 5.13 | Démarrage GPS + chrono | GPS + chronomètre d'un tap. Compte à rebours optionnel. | Moyen | 3h | 🟢 | ✅ | `run/index.tsx` + `running/tracker.ts`. |
| 5.12 | Course libre | Sans séance planifiée ni structure de blocs. | Facile | 1h | 🟢 | ✅ | Source gps/manual. |
| 5.14 | Distance parcourue en temps réel | Kilomètres en grand, mis à jour en continu. | Moyen | 3h | 🟢 | ✅ | `run/active.tsx` hero distance. |
| 5.15 | Allure instantanée et moyenne | Dernière minute glissante + moyenne depuis le départ. | Moyen | 3h | 🟢 | ✅ | `instantPace` / `averagePace`. |
| 5.16 | Auto-pause | Pause auto à l'arrêt, reprise auto. Désactivable. | Moyen | 2h | 🟢 | ✅ | `startTracking({autoPause})`. |
| 5.22 | Mise en pause / reprise | Pause manuelle (GPS + chrono). | Moyen | 2h | 🟢 | ✅ | `pauseTracking` / `resumeTracking`. |
| 5.20 | Écran verrouillé | Notification persistante (Android). Live Activity iOS lors du portage. | Difficile | 6h | 🟢 | ✅ | `foregroundService` notif persistante Android. Rester cross-platform (arbitrage E). |
| 5.17 | Carte du parcours en direct | Tracé GPS pendant et après la course. | Difficile | 6h | 🟡 | ✅ | `RouteMap.tsx` — MapLibre + MapTiler (ADR-006). |
| 5.21 | Mode sans GPS | Suivi à la durée seule (streak + historique, exclu des records). | Facile | 2h | 🟢 | ✅ | Source `manual`. Couvre aussi le tapis. |
| 5.19 | Annonces audio périodiques | À chaque km (paramétrable) : distance, temps, allure. | Facile | 2h | 🟢 | ✅ | **RUN-F2a — code livré le 02/08/2026** → [spec](../specs/functional/us/runf2a-annonces-audio.md) · [plan](../plans/runf2a-annonces-audio.md) · [maquette](../../design/runf2a-annonces-audio/runf2a-annonces-audio.html), en recette → [RECETTES.md](../../RECETTES.md). `expo-speech` (dépendance native neuve, nouveau dev build requis). Réglage opt-in (désactivé par défaut) sur `running_profiles`, intervalle 500 m/1 km/2 km. Déclenché depuis `run/active.tsx` (premier plan), pas la tâche de fond — aucune annonce si l'écran de suivi n'est pas monté (changement d'onglet ou verrouillage). |
| 5.23 | Prolonger ou raccourcir | Terminer avant la cible ou continuer en libre. | Facile | 1h | 🟢 | ✅ | **RUN-F2b — code livré le 02/08/2026** → [spec](../specs/functional/us/runf2b-cible-en-direct.md) · [plan](../plans/runf2b-cible-en-direct.md) · [maquette](../../design/runf2b-cible-en-direct/runf2b-cible-en-direct.html), en recette → [RECETTES.md](../../RECETTES.md). Les deux actions étaient déjà natives (Stop existant, poursuite libre déjà possible) : seule manquait la visibilité de la cible en direct — carte objectif dans `run/active.tsx`, réutilise `compareToTarget`/`useRunTarget`/`running.target.*` de RUN-F3 tels quels. |
| 5.24 | Note + ressenti post-séance | RPE, météo, terrain. | Facile | 2h | 🟢 | 🟡 | **RUN-F3 — terrain livré le 01/08/2026** (D3, 4 choix, aucun réseau) ; RPE + notes déjà OK. **Reste la météo** — scindée en **RUN-F3b** (roadmap 5.24 bis, backlog) : dépend d'un arbitrage confidentialité (position transmise à un tiers) à trancher avant LANCE-00. |
| 5.25 | Résumé post-séance | Distance, durée, allure, carte, dénivelé, comparaison objectif. | Moyen | 4h | 🟢 | ✅ | **RUN-F3 — code livré le 01/08/2026**, en recette → [RECETTES.md](../../RECETTES.md). Distance/durée/allure/carte déjà livrés ; **comparaison à l'objectif** ajoutée (`compareToTarget`, tolérance 2 %) — a exigé de construire le lien course↔séance planifiée, inexistant jusqu'ici (`runs.planned_session_id`, nouveau point d'entrée sur le hub course). **Dénivelé reste absent** : bloqué séparément (RUN-F1b, `GpsPoint` ne porte pas l'altitude). |
| 5.26 | Tableau pace par km | Allure de chaque kilomètre. | Moyen | 3h | 🟢 | ✅ | `computeKmSplits` + tableau splits/km sur `run/summary.tsx`, km le plus rapide en accent (25/07/2026). |
| 5.1 | Profil coureur | Objectif, niveau, allure de référence, fréquence. | Facile | 2h | 🟢 | ✅ | `running-profile.tsx`. |
| 5.8 | Endurance fondamentale | Allure de réf. + 60-90 s/km. Base aérobie. | Facile | 1h | 🟢 | ✅ | `sessionTargetPace('endurance')`. |
| 5.9 | Fractionné / intervalles | Blocs rapides / récupération (ex. 6×400 m à 95 % VMA). | Moyen | 4h | 🟢 | ✅ | **RUN-F2c — code livré le 03/08/2026** → [spec](../specs/functional/us/runf2c-blocs-fractionne.md) · [plan](../plans/runf2c-blocs-fractionne.md) · [maquette](../../design/runf2c-blocs-fractionne/runf2c-blocs-fractionne.html), en recette → [RECETTES.md](../../RECETTES.md). Nouvelle table `session_intervals` (une ligne = un bloc, comme `exercise_plans.target_sets`), éditeurs mobile (`IntervalBlockEditor`) + admin (`SortableList`), affichage lecture seule sur 2 écrans. ⚠️ **2 sync rules à déployer manuellement sur le dashboard PowerSync** (table neuve, non fait par cette session). |
| 5.10 | Sortie longue | Allure de réf. + 30-60 s/km. +10 % max par semaine. | Facile | 1h | 🟢 | ✅ | `sessionTargetPace('sortie_longue')`. |
| 5.11 | Récupération active | Allure de réf. + 90 s/km ou plus, 20-30 min. | Facile | 1h | 🟢 | ✅ | `sessionTargetPace('recuperation')`. |
| 5.18 | Guidage fractionné vocal | Annonce vocale + vibration à chaque changement de bloc. | Moyen | 4h | 🟢 | ✅ | **RUN-F2d — code livré le 03/08/2026** → [spec](../specs/functional/us/runf2d-guidage-fractionne-vocal.md) · [plan](../plans/runf2d-guidage-fractionne-vocal.md) · [maquette](../../design/runf2d-guidage-fractionne-vocal/runf2d-guidage-fractionne-vocal.html), en recette → [RECETTES.md](../../RECETTES.md). 4ᵉ et dernier candidat de la famille RUN-F2. Annonce + vibration à **chaque changement de phase** (rapide↔récup), pas seulement de ligne de bloc. Progression persistée sur `runs` (3 colonnes additives, aucune sync rule) pour un rattrapage silencieux au remontage de l'écran. Aucune dépendance native neuve. |
| 5.4 | Création programme custom | Plan de course semaine par semaine. | Moyen | 4h | 🟢 | ✅ | `running-programs/edit.tsx`. |
| 5.2 | Bibliothèque programmes de course | "5 km en 8 semaines", "Prépa semi"… | Moyen | 4h | 🟡 | ✅ | **Contenu vérifié en base le 29/07/2026** (CONTENU-01) : 3 programmes publiés et bilingues — 10 km/8 sem, Prépa semi-marathon, Reprise en douceur — séances typées avec distances cibles. Le 🟡 précédent supposait le catalogue vide : il ne l'était pas. |
| 5.3 | Filtres bibliothèque | Objectif distance, niveau, durée. | Facile | 1h | 🟢 | ✅ | Filtres objectif/niveau/durée. |
| 5.5 | Planning calendrier running | Séances placées automatiquement. | Moyen | 3h | 🟢 | ✅ | `planning/index.tsx`. |
| 5.6 | Coordination muscu + running | Alerte si deux séances le même jour. | Facile | 2h | 🟢 | ✅ | Badge `multipleSameDay`. Intégration inter-piliers. |
| 5.7 | Gestion séance manquée | Reporter ou sauter. | Facile | 1h | 🟢 | ✅ | `reschedule`/`skip`/`useMissedSessions`. |
| 5.27 | Historique séances avec carte | Liste + détail complet + carte. | Moyen | 4h | 🟢 | ✅ | `running-history` + détail carte. |
| 5.28 | Statistiques distance | Semaine / mois / depuis le début. | Facile | 2h | 🟢 | ✅ | `StatsSection`. |
| 5.29 | Courbe d'allure moyenne | Sur 30 / 90 jours par type de séance. | Moyen | 3h | 🟢 | ✅ | `PaceSection` + tendance. |
| 5.30 | Records personnels | 1 / 5 / 10 km / semi / marathon — meilleur segment glissant. | Moyen | 3h | 🟢 | ✅ | `RecordsSection`. Motivation (arbitrage C). |
| 5.31 | Mise à jour allure de référence | Auto si record 5 km battu. | Facile | 1h | 🟢 | ✅ | `refPaceUpdated` sur record 5k. |
| 5.32 | Dénivelé cumulé | Dénivelé positif par semaine / mois. | Moyen | 2h | 🟢 | ✅ | **RUN-F1b — code livré le 02/08/2026** → [spec](../specs/functional/us/runf1b-denivele-cumule.md) · [plan](../plans/runf1b-denivele-cumule.md) · [maquette](../../design/runf1b-denivele-cumule/runf1b-denivele-cumule.html), en recette → [RECETTES.md](../../RECETTES.md). Blocage initial (« il faut étendre le codec de trace ») levé : `elevation_gain_m`/`elevation_loss_m` cumulés en direct par le tracker comme `distance_m`/`duration_seconds`, `gps_track` inchangé. Seuils de précision GPS (30 m) et de bruit vertical (3 m) non validés terrain — à ajuster après la première recette réelle. |
| 5.33 | Export GPX | Export d'une sortie (partage / Strava). | Facile | 2h | 🟢 | ✅ | `lib/gpx-export.ts`. |
| 5.34 | Prédiction de temps de course (Riegel) | Estime le temps sur 10 km/semi/marathon depuis un record récent (`T2 = T1×(D2/D1)^1,06`) ; sert à fixer un objectif chrono réaliste et une allure cible. | Facile | 1h | 🟢 | ✅ | **RUN-14, code livré le 02/08/2026**, en recette → [RECETTES.md](../../RECETTES.md). `predictRaceTime`/`resolveRacePredictions` (packages/shared, purs, 7 tests) + bloc « Objectifs estimés » sous les records existants (`running-history/index.tsx`). Source fixe = record 5 km (R1) ; un vrai record bat toujours une estimation (R3) ; avertissement dédié sur le marathon (R5). Aucune migration, aucune dépendance native. |

---

## V0.6 — Dashboard, streak & sync cloud

*Objectif : l'app devient un tout — accueil personnalisable, régularité transverse, et synchronisation multi-appareils via PowerSync. **Version intégralement livrée.***

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|:---:|---|
| 2.9 | Calcul du streak | Jour actif = séance ou journée nutrition complétée. Repos = neutre. Minuit local. | Facile | 2h | 🟢 | ✅ | `useStreakData` + `StreakCard`. Motivation (arbitrage C). |
| 2.6 | Notif — Streak en danger | Push fin de journée si aucune activité. | Moyen | 2h | 🟢 | ✅ | `useStreakReminderScheduler`. |
| 2.8 | Mode Ne pas déranger | Aucune notif 22h-7h (modifiable). Max 3 push/jour. | Facile | 1h | 🟢 | ✅ | Prefs DND + `isWithinDnd`. |
| 7.1 | Mode édition du dashboard | Bouton "Personnaliser" (widgets qui tremblent). | Moyen | 3h | 🟢 | ✅ | `DashboardEditControls`. |
| 7.2 | Réorganisation par drag & drop | Changer l'ordre des blocs. | Moyen | 4h | 🟢 | ✅ | `SortableDashboard` + `reorder`. |
| 7.3 | Masquer / afficher un widget | Masquable sans suppression. | Facile | 2h | 🟢 | ✅ | `toggleVisible`. |
| 7.4 | Widget — Séance du jour | Prochaine séance + CTA "Démarrer". | Moyen | 3h | 🟢 | ✅ | `TodaySessionCard`. |
| 7.5 | Widget — Résumé nutrition | Calories restantes + macros compactes. | Facile | 2h | 🟢 | ✅ | `NutritionSummaryCard`. |
| 7.6 | Widget — Streak & calendrier semaine | Jours consécutifs + 7 pastilles colorées. | Facile | 2h | 🟢 | ✅ | `StreakCard` (7 pastilles). |
| 7.7 | Widget — Poids corporel | Dernière pesée + tendance 7 jours. | Facile | 2h | 🟢 | ✅ | `WeightCard`. |
| 7.8 | Widget — Record récent | Dernier record battu avec date. | Facile | 1h | 🟢 | ✅ | `RecordRecentCard`. |
| 7.9 | Widget — Volume muscu semaine | Barres par groupe musculaire. | Moyen | 3h | 🟢 | ✅ | `MuscleVolumeCard`. |
| 7.10 | Widget — Résumé running semaine | Distance + séances vs objectif hebdo. | Facile | 2h | 🟢 | ✅ | `RunningWeekCard`. |
| 7.11 | Taille de widget configurable | Version compacte (ligne) ou normale (carte). | Moyen | 4h | 🟢 | ✅ | `setSize` compact/full. |
| 7.12 | Persistance de la configuration | Disposition sauvegardée localement + cloud (PowerSync). | Facile | 1h | 🟢 | ✅ | `dashboard-layout-repository`. |
| 9.4 | Synchronisation cloud (PowerSync) *(reformulé — arbitrage B)* | Synchro bidirectionnelle **gérée par PowerSync** entre le SQLite local et Postgres/Supabase, en arrière-plan dès connexion. | Difficile | 8h | 🟢 | ✅ | `powersync/system.ts` + `connector.ts`. **Correctif 01/08/2026** : les colonnes `jsonb` remontaient en **texte** (SQLite n'a pas de type JSON), ce qui bloquait la file d'envoi en boucle sur `menstrual_daily_logs` (colonne gardée par un `check`) et corrompait silencieusement `foods.portions` (colonne sans garde). Rien ne montait **ni ne descendait**, tableau de bord sur « Synchronisé ». `decodeJsonColumns()` + 10 tests. ⚠️ Reste ouvert : une opération en échec bloque toujours la file indéfiniment (traitement des « opérations empoisonnées » = arbitrage produit), et l'indicateur de synchro ne reflète pas l'état de la file. |
| 9.7 | Gestion conflits de sync (PowerSync) *(reformulé — arbitrage B)* | **Conflits gérés par PowerSync** (plus de last-write-wins codé à la main). Vérifier le comportement sur 2 appareils. | Moyen | 3h | 🟢 | ✅ | Délégué au SDK. |
| 2.12 | Sync cloud en arrière-plan (PowerSync) *(reformulé — arbitrage B)* | Synchro **automatique via PowerSync** dès connexion disponible. | Moyen | 3h | 🟢 | ✅ | `PowerSyncProvider` connecte dès session. |
| 2.13 | Indicateur mode hors-ligne | Bandeau discret quand offline (état de connexion PowerSync). | Facile | 1h | 🟢 | ✅ | `SyncStatus.tsx`. |

---

## V0.7 — Admin & contenu

*Objectif : industrialiser la gestion du contenu (jusqu'ici injecté par scripts) et créer le catalogue éditorial avant la bêta. Back-office repris de Dams + principe « intégration sans imposition » (arbitrage H).*

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|:---:|---|
| 8.1 | Interface web admin séparée | Back-office, sous-domaine dédié, comptes admin. | Moyen | 6h | 🟢 | ✅ | `apps/admin` (React+Vite), routes protégées. |
| 8.9 | Système de rôles | super_admin / content_editor / moderator. | Moyen | 3h | 🟢 | ✅ | `RolesScreen` + migration `admin_user_roles`. |
| 8.2 | Gestion exercices (CRUD) | Créer, modifier, archiver. Brouillon / publié. | Moyen | 5h | 🟢 | ✅ | `ExerciseEditScreen` (bilingue, draft/published). 🌐 champs FR+EN. |
| 8.3 | Upload média exercice | Image ou GIF + import en masse depuis la base choisie. | Moyen | 3h | 🟢 | ❌ | **Abandonné avec 6.1** (décision Florian/Damien, 20/07/2026). Aucun bucket/Storage/upload à prévoir. |
| 8.4 | Constructeur de programmes | Drag & drop pour composer des programmes. | Difficile | 8h | 🟢 | ✅ | `ProgramEditScreen` + `SortableList`. Sert à créer 3.1 et 5.2. |
| 8.5 | Gestion base d'aliments | Créer, modifier, archiver. Validation des signalements. | Moyen | 4h | 🟢 | ✅ | `FoodEditScreen` + migration `admin_editorial_foods_rls`. |
| 8.6 | Import aliments CSV | Import en masse via CSV formaté. | Moyen | 3h | 🟢 | ✅ | `FoodImportScreen` (papaparse) + `parseFoodCsv`. Import CIQUAL (+ EN). |
| 8.7 | Modération aliments signalés | File de revue des aliments utilisateurs signalés. | Moyen | 3h | 🟢 | ⏳ | **Reportée le 16/07/2026** : modèle **privé par utilisateur** (RLS `owner_id`), aucun mécanisme de signalement → file sans objet. Prérequis : signalement d'aliments éditoriaux ou modèle communautaire (hors périmètre). À redéfinir avant reprise. |
| 8.8 | Gestion utilisateurs | Profils en lecture seule, bannir / débannir. | Moyen | 3h | 🟢 | ✅ | `UsersScreen`/`UserDetailScreen` + migrations `admin_users_view` & `user_bans`. |
| 8.10 | Log d'audit | Toute action admin tracée. Non supprimable. | Moyen | 3h | 🟢 | ✅ | `AuditScreen` + migration `admin_audit_log`. |

---

## V0.8 — Bêta : conformité & intégrations

*Objectif : tout ce qui doit exister avant d'ouvrir à de vrais testeurs (Play interne) — OAuth Google, RGPD, Health, analytics, accessibilité. **OAuth Apple (1.3) sorti du périmètre de lancement** → section « Ultérieur — iOS » (arbitrage E).* **✅ Version complète le 01/08/2026** (code livré sur les 10 items — la recette device de CONF-07 reste à faire, RECETTES.md).

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|:---:|---|
| 1.2 | Connexion via Google | OAuth Google. | Moyen | 3h | 🟡 | ✅ | **US 1.2 code livré (24/07/2026).** Sign-In natif (`@react-native-google-signin`) → `supabase.auth.signInWithIdToken` ; bouton « Continuer avec Google » (2 écrans) + mention consentement ; liaison auto e-mail vérifié. **Conservé** (arbitrage E). **Recette validée 100 % (Florian, 24/07/2026)** : connexion Google + liaison auto sur e-mail vérifié (même compte). |
| 1.17 | Gestion des notifications | Activation / désactivation par type. | Facile | 2h | 🟢 | ✅ | Section Notifications de `settings.tsx`. |
| 1.18 | Export des données | JSON ou CSV (obligation RGPD). | Moyen | 4h | 🟢 | ✅ | **CONF-01 livré (23/07/2026).** Export JSON local (hors-ligne) de toutes les données perso (31 tables possédées + traductions perso) via feuille de partage ; Réglages → « Exporter mes données ». Reste recette + Damien. |
| 1.19 | Suppression du compte | Confirmation double + délai de grâce 30 jours. | Moyen | 3h | 🟢 | ✅ | **CONF-02 livré (23/07/2026).** Zone Danger + ré-auth mot de passe + délai de grâce 30 j récupérable (gate) + purge serveur `pg_cron` (cascade FK). Reste recette device + Damien. |
| 1.22 | Aide & support | FAQ + formulaire de contact / signalement de bug. | Facile | 2h | 🟢 | ✅ | **US 1.22 livré (24/07/2026).** Réglages → écran `/help` : FAQ statique embarquée (accordéon, 7 Q/R) + « Nous contacter » (mail natif) + « Signaler un bug » (mail + bloc technique). `expo-mail-composer`, zéro backend. `SUPPORT_EMAIL` placeholder + dev build requis avant recette. 🌐 bilingue FR+EN. Reste recette + Damien. |
| 9.9 | Health Connect | Écriture des séances, lecture du poids (Android). Apple Health lors du portage iOS. | Moyen | ~20h (réel — 6h sous-estimait : module natif + plugin Expo maison + 2 correctifs de recette) | 🟢 | ✅ | **Livré et recetté sur device le 28/07/2026** (US CONF-06) : écriture séances/courses, lecture du poids, opt-in, plugin Expo maison. La **déclaration Google Play** reste requise pour la **publication** (LANCE-00/01) — sans effet sur le fonctionnement en dev build. **Correctif UX le 31/07/2026** : le compte rendu d'échec des Réglages annonçait désormais clairement (FR+EN) que le détail interpolé est un diagnostic technique volontairement non traduit — sans quoi un utilisateur anglophone lisait du français brut et pouvait croire l'app mal traduite. |
| 9.10 | Analytics produit first-party | Événements anonymisés, instance auto-hébergée. | Moyen | 4h | 🟢 | ✅ | **US 9.10 livré (24/07/2026).** Événements anonymisés dans notre base Supabase (`analytics_events` append-only + RLS + FK cascade), offline-first PowerSync. Consentement **opt-out** + réglage « Statistiques d'usage » + mention confidentialité. Service `track()` (allowlist anti-PII, non bloquant), 15 points instrumentés. Migration + sync rule PowerSync déployées ; **recette validée 100 % (Florian, 24/07/2026)**. Dashboards via outil BI = ultérieur. |
| 9.11 | Dynamic Type | Taille de texte selon les réglages système. | Facile | 2h | 🟢 | ✅ | **CONF-07 — clôturé le 01/08/2026.** Vérifié le 30/07/2026 : 41 écrans capturés à `font_scale` 1,5×, **aucune troncature** — le comportement RN par défaut suffit. Aucun `maxFontSizeMultiplier` posé en masse (ce serait *dégrader* l'accessibilité) — le garde-fou reste ponctuel, là où déjà justifié (`ShareCard`, `StreakCard`). |
| 9.12 | Contraste WCAG AA | Ratio minimum sur toute l'interface. | Moyen | — | 🟢 | ✅ | **CONF-07 — code livré le 01/08/2026**, en recette → [RECETTES.md](../../RECETTES.md). Les 5 non-conformités trouvées le 30/07/2026 sont corrigées : `success` 3,23→**4,53**, `warnText` 3,19→**4,52** (vs `warn`), `amber` 2,29→**3,03** — tous assombrissements purs en HSL (teinte/saturation conservées, R1). Sombre : `accentText`/`accent` 3,29→**5,48** (**D1 validée**, le libellé des boutons pleins passe du blanc au brun foncé — changement le plus visible de cette US). `accent`/`surface` 4,45 laissé **tel quel** (**D2 validée**, écart assumé sous le bruit de l'arrondi). **Garde-fou durable** : `packages/shared/src/contrast.ts` (`contrastRatio`, pur, testé) + `apps/mobile/src/theme/__tests__/contrast.test.ts`, qui parcourt la palette réelle et échoue si une paire repasse sous son seuil — la 1ʳᵉ passe avait échoué **faute de mesure**, ce test est le vrai livrable. |

---

## V0.9 — Enrichissements avant lancement

*Ajoutée le **28/07/2026**. Le code a **pris de l'avance sur le cahier des charges** : le périmètre
fonctionnel du cadrage est bouclé à quelques finitions près, alors que les prérequis de publication
(compte développeur Play, déclaration « Health apps », relecture juridique) sont **à délai externe —
environ 3 semaines**. Cette version occupe cette fenêtre avec des fonctionnalités **retenues depuis
[IDEAS.md](../../IDEAS.md)** plutôt que d'attendre Google. **Critères de sélection** : offline-first,
aucune dépendance backend/IA, hors gamification (arbitrage C), hors social (V2), hors paiement
(arbitrage D), et réutilisation d'une infra déjà livrée. Tout ce qui demande un moteur de règles, de
l'historique long ou une base d'utilisateurs est resté en post-V1.*

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|:---:|---|
| 1.24 | Check-in quotidien & journal de bien-être | Humeur / énergie / stress en ~10 s le matin (+ poids), historique et courbes. 🌐 FR+EN. | Moyen | 5h | 🟢 | ✅ | **BIEN-01 — code livré le 28/07/2026** : table `daily_wellbeing` (2 migrations poussées), briques pures testées, repository, feuille de check-in, widget transverse 3 formes, écran d'historique, i18n FR+EN, export RGPD. **4ᵉ dimension légère**, pas un 4ᵉ pilier (widget `'always'`). ✅ **sync rule déployée** (confirmé Florian, 06/08/2026). ⏳ Reste la **recette device** ([RECETTES.md](../../RECETTES.md) §2). Alimentera les corrélations récup ↔ perfs (post-V1). |
| 1.25 | Suivi du cycle menstruel — journal & prédiction | Périodes, flux, symptômes (liste fermée), calendrier, historique + estimation du prochain cycle avec fourchette. Health Connect en lecture/écriture. 🌐 FR+EN. | Moyen | 18h | 🟢 | ✅ | **CYCLE-01 — code complet le 31/07/2026** (journal, prédiction 3 états, widget 3 formes avec mini-calendrier de la période en cours, calendrier mensuel sur l'écran de détail, réglages, désactivation avec suppression optionnelle). **Health Connect câblé le 31/07/2026** : permissions dédiées (séparées des 4 permissions générales — l'ET logique de `hasPermissions()` aurait sinon fait régresser tous les comptes n'utilisant pas le cycle), push des périodes closes + flux saisis à la main, import throttlé au retour au premier plan, dédup R21 (la saisie manuelle gagne toujours). 🟡 : **2 bloquants levés en recette device du 01/08/2026** — le suivi était **impossible à activer** (colonnes `cycle_tracking_enabled` / `cycle_health_connect_enabled` absentes du schéma PowerSync local, écriture en échec et erreur avalée par `void updateSettings`), et les routes `wellness://cycle` / `/cycle/insights` s'ouvraient **suivi éteint** (critère 1), désormais fermées par `CycleTrackingGuard`. Le manifest embarque bien les 2 permissions Menstruation après `prebuild --clean`. Reste **la recette device** (RECETTES.md #15) — vérifier les sync rules PowerSync du cycle (non confirmées déployées, contrairement au lot du 29/07) et si le build embarque bien les 2 permissions Menstruation dans le manifest. Cadrée le 30/07/2026. Ligne **créée** (le sujet n'avait jamais été évoqué sur ce projet : zéro occurrence dans le code, les 58 migrations, le catalogue et IDEAS.md). 4 arbitrages Damien, tous en option maximale. **Opt-in strict, sans filtre sur `sex`** ; désactivé = aucune ligne écrite. **Pas d'onglet** (arbitrage 31/07, contre la maquette) : **widget 3 formes** sur l'accueil + écran de détail, comme `steps` et `wellbeing` — le cycle est une dimension transverse, pas un 4ᵉ pilier, cohérent avec BIEN-01. **Aucune notification, jamais** (R11) — c'est le point où un carnet devient anxiogène. Prédiction : rien sous 3 cycles, toujours une fourchette, **pas de date si l'écart-type > 7 j**. ⚠️ **Donnée de santé sensible** : rouvre la politique de confidentialité et le formulaire « Sécurité des données » de LANCE-00, et impose une **nouvelle déclaration Health apps à 6 types** (~2 sem. en série). Chemin critique du lancement : ~3 → ~5 semaines, **assumé**. |
| 1.26 | Croisement cycle ↔ énergie, performance et nutrition | Moyennes observées par phase (menstruelle / folliculaire / ovulatoire / lutéale) sur les données déjà collectées. | Moyen | 12h | 🟢 | ✅ | **CYCLE-01 — code complet le 31/07/2026** : écran « Croisement », moyennes par phase, seuil vérifié **métrique par métrique**, **6 métriques câblées** (énergie, humeur, stress, tonnage, apport calorique, allure de course) — `useDailyTotals` et `avgPaceSPerKm` existaient déjà, il ne manquait que le branchement. ⏳ Reste la **recette device** (même US que 1.25, voir 1.25 pour le détail). C'est l'angle « les 3 piliers se parlent » appliqué au cycle. **Ne collecte rien de neuf** : lit `daily_wellbeing`, `workouts`, `runs`, `food_entries`. Seuil vérifié **métrique par métrique** (l'énergie peut être exploitable quand la performance ne l'est pas). 🔴 **Contrainte de fond : on affiche des moyennes observées, jamais une causalité ni un conseil.** « Ta baisse d'énergie est due à ta phase lutéale » ou « évite les séances lourdes » sont des défauts bloquants — d'où des calculs qui ne renvoient que des nombres, les libellés vivant en i18n. |
| 3.51 | Mensurations corporelles | Tour de taille, poitrine, bras, cuisses… historisées + courbes d'évolution, à côté du poids. | Moyen | 5h | 🟢 | ✅ | **MESUR-01 — code livré le 29/07/2026.** Fait enfin descendre **E8** de la spec muscu §5, cadrée le 04/07 et jamais dotée d'un modèle de données. Table `body_measurements` **normalisée** (une ligne par jour ET par mesure, décision D1 : la liste des mesures a vocation à bouger, une table large coûterait une migration par ajout et serait majoritairement `NULL`) — 6 mesures, stockage **toujours en cm**, feuille de saisie pré-remplie, historique avec courbe par mesure et delta. Entrée depuis **Progression** (pas de widget : une mesure mensuelle ne mérite pas une place sur un écran quotidien). ✅ **sync rule déployée** (confirmé Florian, 06/08/2026). ⏳ Reste la **recette device**. |
| 3.52 | Suggestion de substitution d'exercice | Matériel pris → proposer des alternatives du même groupe musculaire. | Moyen | 4h | 🟢 | 🟡 | **MUSC-F14** livré (séance), recette device à faire. ⚠️ Le motif **« zone douloureuse » a été retiré** : sans information articulaire ni schéma de mouvement en base, y répondre serait un **conseil de santé inventé**. Suggestions **neutres**, au plus 4. Une **variante déclarée** (MUSC-F10c-2) prime toujours sur un score calculé. Tri déterministe. Exercices archivés jamais suggérés. **Aucune migration.** ⚠️ L'éditeur de programme n'a **pas de parcours de remplacement** : décision attendue (spec §0.2). |
| 3.53 | Création d'exercice perso en modale | Bottom-sheet (patron `ExerciseFilterDrawer`) au lieu de la card intercalée, segment `scrollable`, placeholder sur le nom. | Facile | 2h | 🟢 | ✅ | **UX-02 — constaté déjà livré le 29/07/2026** par `12bd3a1` (« feat(muscf11) »), avant même que la ligne ne soit créée : `CreateExerciseModal.tsx` est une modale bottom-sheet avec placeholder et segment `scrollable`. Les 3 points, ligne pour ligne. ✅ par **réconciliation**, sans commit de code. |
| 3.54 | Cohérence fiche exercice perso / bibliothèque | Mêmes sections et états vides explicites ; édition des instructions et muscles secondaires sur un exo perso. | Moyen | 3h | 🟢 | ✅ | **UX-LOT-01, 29/07/2026.** L'édition des instructions et muscles secondaires **existait déjà** (`EditExerciseModal` + `updateCustomExercise`) ; livré ici : les 3 sections de la fiche sont **toujours rendues**, avec « Non renseigné » au lieu de disparaître — un exo perso n'avait pas la même structure de fiche qu'un exo de bibliothèque. L'écart **volontaire** Modifier/Supprimer est préservé. |
| 3.55 | RPE ou RIR au choix | Préférence de profil : afficher l'intensité en RPE **ou** en RIR (RIR = 10 − RPE), une seule donnée stockée. | Facile | 2h | 🟢 | ✅ | **UX-05** livré, recette device à faire. Porte sur le **RPE par série uniquement** : le ressenti de séance (5 étoiles) et le ressenti de course sont inchangés — « répétitions en réserve » n'a aucun sens pour eux. **Inversion pure 0→9** et non plage restreinte 0-4, pour que la bascule soit **réversible sans perte** (les RPE 1-5 resteraient sinon inaffichables). Le RIR n'est **jamais stocké** ; `null` reste `null`, jamais « RIR 10 ». **Aucune sync rule.** |
| 4.37 | Substitution d'aliments pour combler un macro | « il te manque 20 g de protéines → ajoute X » : suggestions puisées dans la base et les aliments récents. | Moyen | 4h | 🟢 | 🟡 | **NUTR-F2 — code livré le 29/07/2026.** Score **déterministe, sans IA** : densité du macro **pour 100 kcal** (trier sur les g/100 g désignerait les aliments les plus caloriques), macro choisi sur l'écart **relatif** (en absolu les glucides gagneraient toujours), quantité arrondie à 5 g et **bornée 10–400 g** — hors bornes l'aliment est **écarté**, pas tronqué. Carte conditionnelle sous le journal, ajout en un tap. 18 tests. **Contrat revu le 01/08/2026 après recette device** : la quantité comblait 100 % de l'écart, d'où des propositions inutilisables (« Chipolatas 350 g · 952 kcal »). Une suggestion est désormais une **portion** — plafonnée par `foods.portions` (ou 200 g à défaut), un tiers du budget calorique max, écartée sous 25 % de couverture — et la carte **annonce son apport réel** (« +30,9 g de lipides »). 50 portions manquantes renseignées en base (migration `20260801001204`). 26 tests. 🟡 : vivier limité aux **aliments récents** (le repli sur la base demande un pré-filtrage SQL, voir spec §2), recette à rejouer, et 3 valeurs de calibrage à trancher à l'usage. |
| 7.14 | Joker / gel de streak | 1 joker par mois protège la série sur un jour manqué, sans remettre le compteur à zéro. | Moyen | 3h | 🟢 | ✅ | **STREAK-01 — code livré le 29/07/2026**, après arbitrage des 4 décisions produit par Florian. **Manuel et rétroactif** : l'app détecte la rupture à l'ouverture et propose le joker en annonçant les jours sauvés — un joker automatique rendrait la série sourdement inbrisable. 1 par mois calendaire · **un seul jour isolé** (deux jours d'affilée = interruption réelle) · fenêtre de 7 jours · **n'affecte QUE la série**, jamais l'adhérence ni le journal. Table `streak_jokers`, 18 tests. ✅ **sync rule déployée** (confirmé Florian, 06/08/2026). ⏳ Reste la **recette device**. |
| 7.15 | Objectifs personnels à échéance | « 50 km ce mois », « +5 kg au développé d'ici 8 semaines » — anneau de progression, jalons, célébration. | Moyen | 6h | 🟢 | ✅ | **OBJ-01** livré, recette device à faire. **Non social** et **mono-objectif** (l'objectif hybride à arbitrage de compromis reste post-V1). 2 types au lancement : cumul de course + 1RM sur un exercice, choisis pour être les **cas durs** (un départ à zéro, un départ à valeur existante). **Ni statut ni progression stockés** : fonctions pures de la fenêtre `[début, échéance]` — aucun cron, verdict stable, calcul hors ligne. **Jalons visuels seuls** (25/50/75 %), aucune célébration : arbitrage C respecté. ✅ sync rule `personal_goals` déployée (confirmé Florian, 06/08/2026). |
| 7.16 | Bilan hebdomadaire automatique | Récap poussé en notification : ce qui progresse, ce qui bloque, **une seule décision** pour la semaine à venir. | Moyen | 5h | 🟢 | ✅ | **BILAN-01** livré, recette device à faire. Fait descendre **MR-22**, **TRI-07** et **NUTR-18** du catalogue. « Aucune narration sans les chiffres » est imposé par **le type** : une décision transporte obligatoirement ses métriques. La décision est choisie par **règles ordonnées** (priorité fixe, la 1ʳᵉ qui déclenche gagne) — déterministe et explicable. La notification est **volontairement non chiffrée**, tout est recalculé à l'ouverture : c'est ce qui neutralise le **doze mode**. Semaine ISO **close**, donc bilan définitif. **Aucune migration, aucune sync rule.** |
| 7.17 | Carte de séance / course partageable | Export image (trace GPS + stats, ou résumé muscu) pour les stories Instagram / WhatsApp. | Moyen | 4h | 🟢 | ✅ | **PARTAGE-01** livré (course **et** muscu), recette device à faire. Fait descendre **META-41**. **Partage sortant statique, zéro backend.** Le tracé est **redessiné en SVG** et non capturé : une vue MapLibre native ressort noire d'un `captureRef` — d'où un bénéfice collatéral, la carte marche **sans clé MapTiler et hors ligne**. Échelle uniforme + correction `cos(latitude)`, sinon le tracé est déformé. **Aucune donnée de santé** sur l'image. ⚠️ `react-native-view-shot` est une **dépendance native** → **second build requis** pour la recette. 🎨 **Habillage revu le 30/07/2026** : bordeaux/doré → couleurs du **thème sombre**, pour que l'image reste reconnaissable **hors** de l'app. Couleurs **figées** (non lues via `useTheme`) — la carte doit rendre à l'identique quel que soit le thème actif. Changement **JS pur**, le même APK reste valable. |
| 7.18 | Réagencement du dashboard découvrable | Poignée ≥ 48 dp + `hitSlop`, appui long sur une card, retour visuel pendant le glissement. | Facile | 2h | 🟢 | ✅ | **UX-LOT-01, 29/07/2026.** ⚠️ Diagnostic initial **faux sur 2 points** : l'appui long (`activateAfterLongPress(700)`) et le retour visuel existaient déjà. Les vrais défauts, corrigés ici : les chips faisaient **36 dp effectifs** (24 + hitSlop 6) au lieu de 48 (CONF-07), et **aucune affordance** n'indiquait le geste. Ajout d'une poignée `pointerEvents="none"` (elle signale sans réduire la zone de préhension, qui reste toute la carte) + indice « appui long » dans le bandeau. |
| 8.11 | Archivage sûr du contenu éditorial | Écran des archivés + restauration (`deleted_at → null`) + garde-fou qui compte les usages avant d'archiver. | Moyen | 4h | 🟢 | ✅ | **ADMIN-01 — code livré le 29/07/2026** : fonction SQL `editorial_usage_counts` (security definer, admins — la RLS interdit à un admin de compter les données des autres), décompte affiché avant archivage (3 types), filtre actifs/archivés/tous et **restauration en cascade miroir** dans les 3 écrans, audit `*.restore`, import CSV qui **réactive** un aliment archivé au lieu de le mettre à jour dans l'ombre. Correctif de fond : `shared_content` ne retire plus `exercises`/`exercise_translations` archivés des appareils, et l'historique muscu + les records résolvent le nom sans filtrer `deleted_at`. ✅ **sync rule redéployée** (confirmé Florian, 06/08/2026). ⏳ Reste la **recette navigateur**. |
| 9.15 | Pas quotidiens (lecture Health Connect) | Lire le total de pas par jour via Health Connect, objectif de pas quotidien, widget + historique. Les pas comptent dans le streak. | Moyen | 8h | 🟢 | ✅ | **PAS-01 — livré et recetté le 28/07/2026** (recette device Florian, APK release local `r4`). Lecture par **agrégation** Health Connect (jamais la somme des records), table `daily_steps` synchronisée, objectif de pas, widget 3 formes, écran d'historique, **pas comptés dans la série** (jour actif = objectif atteint). Reste la **déclaration Play** étendue à `READ_STEPS` — prérequis de LANCE-00, sans effet en dev build. **Sommeil écarté** (décision Florian, 28/07/2026) : aucune valeur avant les analyses croisées, qui sont post-V1 → l'ajouter plus tard imposera une **re-déclaration Play**, coût accepté. Décisions actées : données **synchronisées dans le cloud** (donc politique de confidentialité et « Sécurité des données » Play à revoir — voir la spec §7) et **pas comptés dans le streak**. ⚠️ 1 type de données en plus (`READ_STEPS`) à justifier dans le **même** formulaire que CONF-06 → à figer avant LANCE-00. |
| 9.16 | Unifier la décision d'accès par pilier | Point de décision unique (`resolveActivePillars`) pour « ce pilier est-il actif ? », au lieu de ~10 copies en ligne de `activePillars ?? [...PILLARS]`. | Facile | 2h | 🟢 | ✅ | **REFACTO-01 — livré et clôturé le 31/07/2026.** Trouvée le 30/07/2026 en cadrant SOCLE-01 : le gating de la décision H était recopié en ligne dans ~10 endroits, sans helper partagé — dont un repli **codé en dur et désynchronisé de `PILLARS`** dans `weekly-review-repository.ts` (bug latent, corrigé au passage). **Dette pure, zéro changement de comportement** à 3 piliers → pas de recette device, clôturée par lecture + tests + typecheck (`resolveActivePillars` testée, 1282 tests Vitest + 247 Jest verts). Périmètre volontairement étroit : le `WidgetGuard` de `widgets.ts` n'est pas touché (rôle différent), ni les 2 sites de conjonction (`&&`, lisibles tels quels), ni `apps/admin/.../users.ts` (repli inversé, hors sujet). |

---

## V1.0 — Lancement store

*Objectif : publication publique **sur Android**. Le gros du travail est de la validation (review Google), pas du code. **iOS reporté** (arbitrage E). **= MVP1 complet.***

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|:---:|---|
| 9.2 | App Android | Publication Play Store via Expo EAS Build. | Difficile | — | 🟡 | ⬜ | Compte Google Play + review. **Plateforme de lancement** (arbitrage E). Dépend de V0.8 **et de V0.9** (décision du 28/07/2026 : on enrichit pendant les délais externes de Google). Seuls **9.15** (types de données Health) et **8.11** (intégrité des références) sont sur le chemin critique — le reste de V0.9 peut être coupé sans bloquer la soumission. |

---

## V1.1 — Post-lancement

*Objectif : les features d'adoption et de confort qui n'empêchent pas de lancer — priorisées selon les retours de la bêta et les analytics.*

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|:---:|---|
| 1.20 | Import de données | GPX (Strava), CSV (Hevy, Strong, MyFitnessPal). | Difficile | 8h | 🟢 | ⬜ | ⏸️ **Cadrée le 04/08/2026, développement EN PAUSE** — US **IMPORT-01** → [spec](../specs/functional/us/import01-import-donnees-externes.md) · [plan](../plans/import01-import-donnees-externes.md) · [maquette](../../design/import01-import-donnees-externes/import01-import-donnees-externes.html). Les 3 livrables d'amont sont finis ; le code n'a **pas** démarré. 🔴 **Bloquée sur une dépendance externe** : il faut un **export réel de Hevy, Strong et MyFitnessPal** pour figer les alias de colonnes (ces formats ne sont pas documentés de façon fiable et changent selon les versions) → procédure et jeu de données attendu dans [import-samples/README.md](../specs/technical/import-samples/README.md). Reste ⬜ : rien de livré. **Trois découvertes de cadrage** : `food_entries.food_id` est nullable → une entrée MyFitnessPal devient un quick add, **aucune correspondance d'aliment à faire** ; à l'inverse `workout_sets.exercise_id` est **NOT NULL** → la résolution d'exercice est **obligatoire** (3 passes : nom exact → alias → création en perso) ; et `personal_records` **n'est pas dérivée** → sans appel explicite à `evaluateWorkoutRecords`, dans l'ordre chronologique et daté de la séance, un historique importé n'aurait aucun record. |
| 4.27 | Planning repas à la semaine | — | Difficile | 6h | 🟢 | ✅ | ⬆️ **Remontée de V1.1 dans le périmètre courant le 04/08/2026 (arbitrage Florian)** puis **livrée le jour même** — US **REPAS-01**, en recette → [spec](../specs/functional/us/repas01-planning-repas-liste-courses.md) · [plan](../plans/repas01-planning-repas-liste-courses.md) · [maquette](../../design/repas01-planning-repas-liste-courses/repas01-planning-repas-liste-courses.html) · [RECETTES.md](../../RECETTES.md) §28. **Aucun impact sur le chemin critique du lancement** (pas de dépendance Play, pas de donnée de santé, pas de service tiers). Coût réel très inférieur aux 6h estimées : `recipes`/`recipe_ingredients`/`meal_templates`/`meal_template_items` et `applyTemplate()` existaient déjà — seule la table de planning manquait. **Cadrage corrigé au passage** : la spec annonçait « 4 cases par jour », périmé depuis l'US 4.15 (repas personnalisables) — coder 4 en dur aurait fait régresser du livré. 🔴 **Garde-fou central** : le planning n'écrit **jamais** dans `food_entries` (règle R1) — un planning compté comme consommé aurait faussé totaux, adhérence, série, bilan hebdo et analyses croisées, silencieusement. Assertion dédiée en CI. ✅ **3 sync rules déployées** (confirmé Florian, 06/08/2026). ⏳ Reste la **recette device** (26 critères). |
| 4.28 | Liste de courses générée | — | Moyen | 3h | 🟢 | ✅ | ✅ **Livrée le 04/08/2026** (REPAS-01), en recette. Liste **matérialisée** et non dérivée (D5) : une liste recalculée en continu changerait de lignes pendant qu'on est au rayon et perdrait les cases cochées. Regroupement par rayon **gratuit** — `foods.category` (9 valeurs) et ses libellés FR+EN existaient déjà. Deux pièges neutralisés : `recipe_ingredients.quantity_g` est la quantité **totale de la recette** (donc facteur `P/S`, pas `P` — planifier 2 portions d'une recette de 4 ne prend que la moitié), et `quantity_g` est **nullable** — un `null` compté comme 0 aurait produit des courses incomplètes sans le dire. ⚠️ **Pas de contrainte unique `(user_id, week_start_date)`, délibérément** (D6) : deux appareils générant la même semaine hors réseau bloqueraient la file d'upload PowerSync. |
| 4.29 | Export / partage liste de courses | — | Facile | 1h | 🟢 | ✅ | ✅ **Livrée le 04/08/2026** (REPAS-01), en recette. **Texte brut** via `Share.share()` de React Native. Le « PDF » du cadrage d'origine est **écarté** (D8) : `expo-print` est une dépendance native, donc un nouveau build avant toute recette, pour un gain nul sur une liste lue en magasin. Conséquence utile : cette US est **recettable sur l'APK existant**, contrairement à PARTAGE-01 / RUN-F2a / MUSC-F9 / LAUNCHER-01 qui attendent tous un build. |

**Et au-delà (rappel du périmètre)** : V2 = wearables + zones FC, social / défis entre amis, hydratation, web app · **V3/V4 = gamification** (mini-jeu / boucle type Walkr — **réévaluée selon les analytics de rétention**, cf. [ADR-005](../adr/ADR-005-gamification.md)).

---

## Hors périmètre de cadrage — livré en cours de route

*Fonctionnalités **nées après le cadrage du 04/07/2026** et déjà livrées. Elles n'existaient dans
aucune version parce qu'elles n'avaient pas été anticipées : refonte de flux, demandes de Damien ou
de Florian en cours de route, trous fonctionnels révélés à l'usage. **Numérotées ici** pour que la
roadmap redevienne l'inventaire complet — sans quoi l'avancement affiché sous-estime le travail réel.*

| # | Fonctionnalité | Description | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|---|
| 1.23 | Sélecteur de langue | Bascule FR / EN depuis les Réglages. | 🟢 | ✅ | La langue était figée à la création du compte (suivait la locale OS). `Segment` FR/EN dans les Réglages. |
| 3.43 | Niveaux d'affichage de la séance | Simplifiée / Normale / Détaillée — l'écran de séance s'adapte au besoin. | 🟢 | ✅ | MUSC-F13. Colonne `profiles.workout_display_level`. |
| 3.44 | Unification programme → planning → séance | Un seul flux : activer un programme le planifie, démarrer depuis le calendrier marque l'occurrence `done`. | 🟢 | ✅ | Refonte-A (socle). Migration `planned_session_id`. Corrige un défaut structurel propagé au running. |
| 3.45 | Séance du jour en accès direct | Raccourci « séance du jour » sur le hub muscu (hook partagé `useTodaySession`). | 🟢 | ✅ | Refonte-B. |
| 3.46 | Écran de séance : flux guidé + garde-fous | Carte « série en cours » + liste repliée, valider = log + repos + avance, repos plein écran, garde 0 série, résumé éditable. | 🟢 | ✅ | Refonte-C1. Le plus gros chantier de la refonte muscu. |
| 3.47 | Templates de séance libre | Enregistrer une séance libre comme routine réutilisable, à froid ou après coup. | 🟢 | ✅ | Refonte-D. Tables `workout_templates` / `workout_template_exercises`. |
| 3.48 | Records sur la fiche exercice | Tuiles 1RM réel/estimé, charge max, meilleur volume + lien vers la progression. | 🟢 | ✅ | MUSC-F10b. Lecture seule. |
| 3.49 | Détail de programme : séances repliables | Expansion inline des séances sur la fiche programme. | 🟢 | ✅ | |
| 3.50 | Suppression de programmes & de séances | Supprimer un programme (muscu possédé + course) et une séance depuis l'app. | 🟢 | ✅ | Soft delete + cascade `planned_sessions`, confirmation destructive. |
| 4.33 | Micronutriments | Panel de micronutriments sur la base d'aliments et le journal (colonne JSON, snapshot par entrée). | 🟢 | ✅ | Étendu ensuite aux AG détaillés + vitamines/minéraux complets (10 → 31). Mapping OpenFoodFacts avec normalisation d'unité. |
| 4.34 | Détail d'une entrée de repas | Écran de détail complet d'une entrée journalisée. | 🟢 | ✅ | |
| 4.35 | Suivi de micronutriments | Récapitulatif des micros suivis sur la journée. | 🟢 | ✅ | Sélection des micros suivis (`tracked-micros`). |
| 4.36 | Saisie de repas par liste | Saisie en **langage naturel** (« 100 g de riz, 2 œufs ») → analyse → revue éditable → confirmation. | 🟢 | ✅ | ⚠️ Cette US porte historiquement le n° « 4.5 » dans son nom de fichier — **collision** avec 4.5 « Modification manuelle des macros ». Le numéro qui fait foi est **4.36**. Anti-friction majeur. |
| 4.39 | Refonte visuelle du journal alimentaire | Carte héros « Bilan du jour » (anneau calorique + détail consommé/objectif/restant), macros en 3 colonnes, grille de micronutriments **à couverture** (% des VNR), cartes de repas (icône, total, menu replié), repas vides en pointillés, état « journée vide » plein. | 🟢 | ✅ | Maquette [FitTrio - Nutrition](../../design/FitTrio%20-%20Nutrition.dc.html), demande Damien. Le pilier nutrition était le plus pauvre visuellement des trois. **Écran 01 (journal) seul** — les 9 autres écrans du pilier gardent leur habillage. Variante « anneau » retenue contre « chiffres » (cohérence avec le widget dashboard). |
| 7.22 | Cercle d'accent sur les cartes | Reflet terracotta en coin de carte, repris de la maquette. Coin, taille et **présence** dérivés par hachage de l'identité du widget : ~1 carte sur 3, géométrie stable au réagencement. | 🟢 | ✅ | Demande Damien (« casser la monotonie »). Arbitré sur device : le cercle net de la maquette est retenu contre une variante en dégradé radial. |
| 6.4 | Infobulle de valeur au tap sur les graphiques | Tap sur une courbe ou un histogramme → date complète + valeur exacte. | 🟢 | ✅ | UX-01 — **première idée promue depuis [IDEAS.md](../../IDEAS.md)**. Couvre les 6 surfaces graphiques via 2 composants mutualisés. |
| 7.13 | Grille de widgets multi-formes | Généralise la personnalisation du dashboard aux **3 hubs** (accueil, muscu, course) : 16 widgets × 3 formes, réordonnancement, masquage, compaction. | 🟢 | ✅ | WIDGETS-01. Chantier majeur, demande Damien d'après la maquette `FitTrio - Widgets`. |
| 1.27 | Parcours « 7 jours pour démarrer » | Mini-programme d'activation guidé (7 jours, tous piliers actifs), pour atteindre vite le « aha moment » sans exiger d'historique. | 🟢 | ✅ | **ACTIV-01 — code livré le 03/08/2026** → [spec](../specs/functional/us/activ01-parcours-7-jours.md) · [plan](../plans/activ01-parcours-7-jours.md) · [maquette](../../design/activ01-parcours-7-jours/activ01-parcours-7-jours.html), en recette → [RECETTES.md](../../RECETTES.md). Idée promue depuis [IDEAS.md](../../IDEAS.md) (13/07/2026). Widget d'accueil auto-masquant (`'always'`, wiré dans `isWidgetActive`), aucune notification, 1 colonne additive (`profiles.activation_path_dismissed_at`), aucune sync rule. Distinct de l'onboarding (1.7-1.11). ⚠️ **Contenu des 7 jours = brouillon**, à valider par Florian/Damien. |
| 7.19 | Widget écran d'accueil Android | Widget du **launcher** Android (hors de l'app) : série, séance du jour, kcal restantes. Dernier candidat non démarré de la 2ᵉ salve d'enrichissements. | 🟡 | ✅ | **LAUNCHER-01 — code livré le 03/08/2026**, en recette → [spec](../specs/functional/us/launcher01-widget-ecran-accueil.md) · [plan](../plans/launcher01-widget-ecran-accueil.md) · [maquette](../../design/launcher01-widget-ecran-accueil/launcher01-widget-ecran-accueil.html) · [RECETTES.md](../../RECETTES.md). Idée promue depuis [IDEAS.md](../../IDEAS.md) (13/07/2026), initialement estimée « le plus cher des 5 » (natif Kotlin). **Recherche technique : révisée à la baisse** — `react-native-android-widget` (JSX → RemoteViews, config plugin Expo, aucun Kotlin écrit à la main) tient la promesse ; spike de compatibilité SDK 57/New Architecture **confirmé sur device** (build + widget affiché). Distinct des 16 widgets **in-app** (WIDGETS-01, 7.13) — vocabulaire « widget launcher » explicitement pour ne pas confondre. Données recalculées hors React (Headless JS, singleton PowerSync partagé), aucune duplication de logique métier (streak/TDEE réutilisés de `@wellness/shared`). ⚠️ **Dépendance native neuve : second build requis** avant recette (comme PARTAGE-01/RUN-F2a/MUSC-F9). |
| 7.20 | Écran « Insights » — moteur de sélection des analyses | Tier 3 d'[ADR-007](../adr/ADR-007-surfacage-analyses.md) : un moteur **déterministe** choisit les **1 à 3 analyses les plus pertinentes de l'instant** parmi 3 familles (alerte / changement / célébration) et les présente sur un écran dédié, à la demande. | 🟢 | ✅ | **INSIGHTS-01 — code livré le 05/08/2026**, en recette → [spec](../specs/functional/us/insights01-ecran-insights.md) · [plan](../plans/insights01-ecran-insights.md) · [maquette](../../design/insights01-ecran-insights/insights01-ecran-insights.html) · [RECETTES.md](../../RECETTES.md) §30 (17 critères). ✅ et non 🟡 : le code est **complet**, comme 7.19 et 1.27 dans le même état — 🟡 signalerait un socle incomplet. **Aucune migration ni sync rule**, donc recettable sur l'APK existant. Dernier morceau non construit d'ADR-007, qui la nomme explicitement « US à cadrer ». **Aucune analyse nouvelle n'est calculée** : uniquement de la sélection au-dessus de **9 signaux** déjà livrés et testés (ADR-007 §3, « des briques, pas 180 variantes »). ⚠️ **La spec a été relue contre le code et corrigée en profondeur** (révision 2, §11) : la 1ʳᵉ rédaction annonçait 13 sources et un moteur à score pondéré — **4 sources ne fournissaient aucun nombre** (donc ne pouvaient pas satisfaire la règle « jamais d'affirmation sans chiffre »), la `severity` du score **n'existait nulle part**, et la décote de fraîcheur faisait passer les alertes **derrière** les célébrations. Le moteur est désormais une **table ordonnée** (patron `SIGNAL_ORDER` de BILAN-01), sans arithmétique. **Aucune migration, aucune sync rule, aucune dépendance native** → **recettable sur l'APK existant**, contrairement à PARTAGE-01 / RUN-F2a / MUSC-F9 / RUN-F2c / LAUNCHER-01. Le moteur hebdomadaire de BILAN-01 (`decide()`) **n'est pas réimplémenté** : sa décision entre comme un candidat parmi les autres. ⚠️ **2 arbitrages ouverts** : gratuit vs gaté premium (proposition **gratuit** — SOCLE-01/RevenueCat étant différée, le livrer gaté reviendrait à le livrer invisible ; **exige un amendement daté d'ADR-007 §2**), et la porte d'entrée (widget d'accueil conditionnel vs ligne sur Progression). **Ne dégonfle pas le dashboard** — le passage des 20 widgets actuels aux 4-6 du plafond ADR-007 est une **US de suite**, délibérément placée après la recette en cours pour ne pas déplacer la cible. |
| 7.21 | Dégonflage du Tier 0 — accueil ramené au plafond d'ADR-007 | Faire redescendre l'écran d'accueil de **21 widgets à 6** (plafond [ADR-007](../adr/ADR-007-surfacage-analyses.md) §2), maintenant que l'écran « Insights » (7.20) existe pour héberger les signaux conditionnels. Chaque widget retiré reçoit une **destination explicite** ; aucun signal ne disparaît. | 🟢 | ✅ | **INSIGHTS-02 — code livré le 05/08/2026**, en recette → [spec](../specs/functional/us/insights02-degonflage-tier0.md) · [plan](../plans/insights02-degonflage-tier0.md) · [maquette](../../design/insights02-degonflage-tier0/insights02-degonflage-tier0.html). Suite directe de 7.20, qui avait délibérément **ajouté** le 21ᵉ widget sans dégonfler, pour ne pas refactorer des écrans en recette. Deux bénéfices : referme la classe de bug `isWidgetActive` (**4 occurrences**), et supprime la double instanciation de 4 hooks lourds sur l'écran le plus ouvert de l'app. **Aucune migration ni sync rule** — `resolveScreenLayout` ignore déjà les ids inconnus (éprouvé par GARDE-01). ⚠️ **Audit de cadrage** : le sujet annonçait 3 signaux irrécupérables faute de chiffre ; **2 l'étaient à tort** — `activity_level` porte déjà `runningDays` (erreur factuelle dans la spec de 7.20, corrigée par cette US) et `concurrent_interference` calcule deux ratios qu'il **jette**, comme la charge d'entraînement avant elle. ⚠️ **3 arbitrages ouverts** : les 6 widgets conservés (D1), le rattrapage de `steps`/`wellbeing`/`goals` qui perdent leur unique point d'entrée (D2), et le sort du score de forme, **seul signal réellement sans chiffre** (D3). Plus une question de calendrier (D4) : l'US touche 9 widgets appartenant à des US en recette. |
| 1.29 | Journal des zones douloureuses | Déclarer une zone sensible sur un schéma corporel (**muscles et articulations**), en garder l'historique, et recevoir un **fait daté** quand une séance planifiée cible une zone récemment signalée. | 🟢 | ✅ | **DOUL-01 — code livré le 06/08/2026**, en recette → [RECETTES.md](../../RECETTES.md) §34. ✅ **3 migrations poussées le 06/08/2026** (warning CLI `failed to cache migrations catalog` identique à REPAS-01 et VIE-01, bénin — démenti par `npm run db:types` : +44 lignes, aucune suppression) et **sync rule déployée par Florian**. ⏳ Reste la **recette device** (22 critères). Vérifié : **typecheck 3 workspaces à 0**, **lint 0 erreur**, **2 943 tests verts** (181 admin + 842 mobile + 1 920 shared). → [spec](../specs/functional/us/doul01-journal-zones-douloureuses.md) · [plan](../plans/doul01-journal-zones-douloureuses.md) · [maquette](../../design/doul01-journal-zones-douloureuses/doul01-journal-zones-douloureuses.html). Idée promue depuis [IDEAS.md](../../IDEAS.md) (13/07/2026). **4 arbitrages Florian** : zones **muscles + articulations** · **signal factuel, jamais de conseil** · 3 niveaux (gêne / douleur / bloquant) · **substitution hors périmètre**. 🔴 **Correction de cadrage importante** : contrairement à ce qui avait été annoncé, cette US **ne débloque pas** la substitution d'exercice de MUSC-F14. Sa spec §0.1 ne bloquait pas faute de savoir *où* l'utilisateur a mal, mais faute d'**information articulaire et de schéma de mouvement sur `exercises`** — le journal fournit la moitié gauche de l'équation, la droite reste absente, et suggérer un remplacement resterait un **conseil de santé inventé**. ⚠️ **Asymétrie structurante, et testée** : les 10 zones **musculaires** produisent un signal (projetables vers `FINE_MUSCLES`), les 8 zones **articulaires** n'en produisent aucun — on sait qu'un squat charge les quadriceps, pas qu'il charge le genou. ⚠️ `<BodyMap/>` est en **lecture seule** (props `full`/`reduced`, `accessible={false}`, 10 muscles, aucun `onPress`) et **3 écrans en dépendent, dont 2 en recette** : on crée un `PainBodyMap` distinct réutilisant la géométrie plutôt que de le rendre interactif. **3 migrations**, ✅ **1 sync rule déployée** (table neuve, confirmé Florian le 06/08/2026). ✅ **Conformité légère, à l'inverse de CYCLE-01** : la catégorie « Santé » et le disclaimer médical **existent déjà** dans la fiche Play, et l'US **n'écrit rien dans Health Connect** → déclaration « Health apps » **inchangée à 6 types**, **aucun délai externe ajouté**. ✅ Aucune dépendance native → recettable sur l'APK existant. |
| 1.28 | Mode « vie réelle » — dégradation gracieuse des objectifs | En **un tap**, l'utilisateur déclare une période où la vie prend le dessus (vacances, maladie, déplacement) : l'app **abaisse ce qu'elle demande** — cibles de semaine, déficit calorique, série, signaux de reproche — puis **reprend le plan normal toute seule, sans reset**. | 🟢 | ✅ | **VIE-01 — code livré le 05/08/2026**, en recette → [RECETTES.md](../../RECETTES.md) §33. ✅ **sync rule déployée** (confirmé Florian, 06/08/2026) — c'était la dernière raison matérielle. ⏳ Reste la **recette device** ([RECETTES.md](../../RECETTES.md) §33). ✅ **2 migrations poussées le 05/08/2026** — warning CLI `failed to cache migrations catalog` identique à celui de REPAS-01, bénin, et démenti par `npm run db:types` qui rapatrie `real_life_periods` et ses 7 colonnes depuis le cloud. Vérifié : **typecheck 3 workspaces à 0** et **2 885 tests verts** (181 admin + 824 mobile + 1 880 shared). → [spec](../specs/functional/us/vie01-mode-vie-reelle.md) · [plan](../plans/vie01-mode-vie-reelle.md) · [maquette](../../design/vie01-mode-vie-reelle/vie01-mode-vie-reelle.html). Idée promue depuis [IDEAS.md](../../IDEAS.md) (25/07/2026), portée par **3 modèles sur 4** du benchmark IA et désignée **cause n°1 d'abandon à 3-6 semaines**. Sa fiche annonçait « cadrage **après** le détecteur de collisions, les deux partagent le même moteur de règles » : 3.57 étant livrée le même jour, c'est son tour. **4 arbitrages Florian du 05/08/2026** : (D1) on fléchit **les cibles, pas le programme** — réécrire les séances exigerait un contenu de coach, blocage de CONTENU-01 ; (D2) les analyses **restent vraies et sont annotées**, jamais amputées — c'est la règle que STREAK-01 s'est imposée sur le joker (« falsifier la donnée pour sauver un affichage serait le pire des choix ») ; (D3) **durée choisie** (3/7/14 j) avec sortie automatique, patron de fenêtre calculée d'OBJ-01 ; (D4) la série est **mise en pause** — un jour inactif en période est *transparent*, un jour actif compte. **2 décisions de cadrage à confirmer** : rétro-déclaration bornée à 7 j (réutilise `JOKER_MAX_AGE_DAYS`, car le moment du retour est le moment critique) et **aucun effet sur les échéances d'OBJ-01** (sinon le verdict devient manipulable). ⚠️ **Trouvé en cadrage** : faire taire les cartes d'insight sans filtrer `decide()` aurait laissé le bilan hebdo dire « ton volume a chuté de 40 % » en titre — **5 des 6 natures de décision de BILAN-01 sont des reproches**. `goal_behind` est **délibérément conservé**, conséquence directe de D6. 🔴 **Risque n° 1 : `targetCalories` a 7 appels dans 5 fichiers** — en oublier un fait afficher 2 250 kcal à l'accueil et 1 850 dans l'onglet Nutrition. Et **2 des 7 ne doivent surtout pas recevoir la règle** : l'écran de *réglage de l'objectif* doit continuer d'afficher la cible du `cut`, sinon l'utilisateur croit que son réglage n'a pas pris. La distinction cible-du-jour / réglage-de-l'objectif est une règle du plan, pas un oubli. **2 migrations** (table `real_life_periods` + publication), 🔴 **1 sync rule à redéployer à la main** (table neuve — étape déjà oubliée sur BIEN-01 puis RUN-F2c), 🔴 table à déclarer dans `powersync/schema.ts` (panne CYCLE-01) et dans l'export RGPD. ✅ **Aucune dépendance native** → recettable sur l'APK existant. **Aucune donnée de santé** : la période ne porte **pas de motif**, pour ne pas rouvrir la déclaration Google Play « Health apps » déjà passée à 6 types par CYCLE-01. |
| 3.57 | Détecteur de collisions entre séances — séquençage muscu ↔ course | Le planning **place** les séances ; il ne dit rien de leur **enchaînement**. Un moteur de règles **déterministe** repère les combinaisons qui s'auto-sabotent et **propose une correction — jamais un blocage**. | 🟢 | ✅ | **COLLIS-01 — code livré le 05/08/2026**, en recette → [spec](../specs/functional/us/collis01-detecteur-collisions.md) · [plan](../plans/collis01-detecteur-collisions.md) · [maquette](../../design/collis01-detecteur-collisions/collis01-detecteur-collisions.html). Idée promue depuis [IDEAS.md](../../IDEAS.md) (25/07/2026), **signal le plus fort du benchmark IA — retenue par 4 modèles sur 4** — et qualifiée de « cœur du différenciateur d'intégration ». Design brainstormé et validé par Florian le 05/08/2026 : 6 décisions acquises. Vérifié au cadrage : **aucune détection de conflit n'existe** (l'US 3.9 avait différé la « coordination avancée charge/récup », et son « chevauchement » est un conflit d'**agenda**, pas physiologique). **UNE seule règle en V1** — jambes majoritaires ET ≥ 8 séries, suivies le lendemain d'une sortie longue ou d'un fractionné — parce que quatre règles moyennes valent moins qu'une règle juste et que le bruit fait désactiver ce genre de fonctionnalité. ⚠️ **Le seuil de 8 séries n'est calibré sur rien de mesuré** : constante exportée, à juger en recette par un pratiquant. ⚠️ **1 migration** (le réglage opt-in). ✅ **Aucune sync rule** — `user_settings` est lue en `select *`, la relecture a démenti l'affirmation inverse du premier cadrage. 🔴 Le vrai risque est la colonne dans **`powersync/schema.ts`** : absente, l'écriture échoue et l'interrupteur reste éteint **sans message** — la panne exacte de CYCLE-01. ⚠️ Touche `/planning`, où MUSC-F9 est en recette : risque de **conflit de merge**, pas de régression. 🔴 **Rouverte puis corrigée le 07/08/2026** (`fix/collis01-conflit-veille-hors-semaine`) — reste ✅ : la règle disait « le lendemain » mais la détection était bornée à la **semaine affichée**, donc le conflit **dimanche → lundi** n'était **jamais** détecté (une paire de jours sur sept). Corrigé **avant recette**, pour ne pas la faire passer deux fois. **D7** : détection sur **8 jours**, repli toujours borné aux 7 jours affichés. ⚠️ **Le bug était double** — la revue a trouvé la même erreur d'index dans le **repli**, qui pouvait proposer le lundi sans vérifier le dimanche précédent, donc **fabriquer le conflit qu'il prétend résoudre**. ✅ Aucune migration, aucune sync rule, aucun changement d'écran ni d'i18n : 2 fichiers applicatifs. Recette : **22 critères** (§32), les 5 derniers propres au correctif. |
| 3.58 | Écart entre le prévu et le réalisé — lot d'analyses d'exécution muscu | L'app sait dire **ce qui a été fait** (tonnage, volume, records, régularité) mais rien de l'**écart avec ce qui était prévu**. Quatre analyses regroupées en une section de l'écran Progression : **prescrit vs réalisé** (charge et répétitions), **durée de séance** (médiane et tendance), **répartition par type de série**, **exercices favoris délaissés**. On constate, on ne prescrit pas. | 🟢 | ✅ | **EXEC-01 — validé et livré le 07/08/2026**, en recette → [RECETTES.md](../../RECETTES.md) §51 · [spec](../specs/functional/us/exec01-prevu-vs-realise.md) · [plan](../plans/exec01-prevu-vs-realise.md) · [maquette](../../design/exec01-prevu-vs-realise/exec01-prevu-vs-realise.html). **Lot d'items du [catalogue](../product/analyses-donnees.md)** (MUSC-33, MUSC-26, MUSC-13, MUSC-21) regroupés parce qu'ils lisent les mêmes tables et partagent une section. ✅ **Aucune migration, aucune sync rule, aucune dépendance native** → recettable sur l'APK existant : c'est un critère de choix du lot. 🔴 **Deux items du catalogue ne sont pas ce qu'ils annoncent**, vérifié dans le code : **MUSC-14** (repos réel) est **écartée** — il n'existe aucun horodatage de validation sur `workout_sets`, et `updated_at` bouge à chaque édition ultérieure, donc l'analyse serait fausse *et silencieusement* fausse ; la faire rentrer coûte une migration **et** l'analyse serait vide pour tout le monde au lancement. **MUSC-21** est **à moitié déjà livrée** (`muscle_neglected` + carte d'équilibre musculaire) → on ne garde que le niveau **exercice**. ⚠️ **Pas de cartes d'insight** : `MAX_INSIGHTS = 3` pour **13 candidats** déjà en lice — 4 de plus seraient structurellement invisibles et dégraderaient la sélection. Leçon d'INSIGHTS-02, qui a dû dégonfler l'accueil de 21 à 7 widgets. ADR-007 n'est pas touché. ⚠️ Le [catalogue](../product/analyses-donnees.md) n'est **pas** une source de vérité sur le livré (2 réconciliations, 8 lignes corrigées) : les 4 analyses ont été vérifiées dans le code avant la spec. |
| 5.35 | La courbe d'allure — lot d'analyses de gestion d'effort (course) | L'app tire d'une trace une distance, une durée, une allure moyenne et des splits, mais ne dit **rien de la forme de la courbe**. Quatre analyses : **negative split**, **indice de dégradation** en fin de sortie, **temps par zone d'allure**, et **polarisation** du volume sur 4 semaines face au repère ~80/20. On nomme le repère, on ne le prescrit pas. | 🟢 | ✅ | **ALLURE-01 — validée et livrée le 07/08/2026**, en recette → [RECETTES.md](../../RECETTES.md) §52 · [spec](../specs/functional/us/allure01-courbe-allure.md) · [plan](../plans/allure01-courbe-allure.md) · [maquette](../../design/allure01-courbe-allure/allure01-courbe-allure.html). **2ᵉ lot d'items du [catalogue](../product/analyses-donnees.md)** (RUN-11, RUN-20, RUN-17, RUN-08) après EXEC-01, sur le running pour équilibrer. 🟢 **Le socle existe déjà** : `computeKmSplits` et `decodeTrack` sont livrés, et **`run/summary.tsx` décode et splitte déjà** — 3 des 4 analyses sont du calcul pur sur un tableau **en mémoire**, une seule requête neuve. 🟢 **Les zones d'allure ne sont pas inventées** : elles se **dérivent** des bandes de `sessionTargetPace`, déjà calibrées depuis l'allure de réf 5 km. Aucun nombre neuf — un test vérifie qu'un changement de référence déplace **toutes** les bornes. 🔴 **Point dur tranché** : `runs` **n'a pas de `session_type`** (le mur qui laisse RUN-07 en ⏳) — filtrer le fade sur « sortie longue » le rendrait muet pour la majorité, qui court sans programme. Borné en **distance** à la place : `FADE_MIN_DISTANCE_KM`, **seul nombre inventé du lot**. ⚠️ **Sans allure de référence**, aucune zone n'est calculable et il n'existe **aucune valeur neutre** : l'écran affiche l'indisponibilité **et son remède** (patron `StrengthSection`), jamais un « — ». ⚠️ **Pas de FC** (V2 wearables) : la « dérive cardio-mécanique » du catalogue est approchée par la **seule allure**, et la spec le dit. ✅ Aucune migration, aucune sync rule, aucune écriture → recettable sur l'APK existant. |
| 4.40 | Manges-tu comme tu t'entraînes ? — lot d'analyses croisées muscu × nutrition | L'app sait ce que tu manges et comment tu t'entraînes, mais ne dit **jamais si l'un va avec l'autre**. Quatre analyses : **bilan énergétique** jours de séance vs repos, **adhérence** aux macros comparée entre les deux, **disponibilité énergétique** les jours de gros volume, et **protéines fractionnées** dans la journée. On met deux chiffres côte à côte ; on n'affirme aucune causalité. | 🟢 | ⬜ | **APPORT-01 — cadrage du 08/08/2026**, spec + plan + maquette faits, **en attente de validation** → [spec](../specs/functional/us/apport01-manger-comme-on-sentraine.md) · [plan](../plans/apport01-manger-comme-on-sentraine.md) · [maquette](../../design/apport01-manger-comme-on-sentraine/apport01-manger-comme-on-sentraine.html). **3ᵉ lot du [catalogue](../product/analyses-donnees.md)** (MN-20, MN-16, MN-15, MN-10) après EXEC-01 (muscu) et ALLURE-01 (running) — cette fois le **croisé**, c'est-à-dire le différenciateur revendiqué par la [vision](../product/vision.md). 🟢 **Ce lot ne réinvente presque rien** : `isTrainingDay`, `computeGoalAdherence`, `computeCaloricBalance`, `resolveMealSplit` et `computeVolume` sont livrés. 🔴 **Trois calibrages sont RÉUTILISÉS et non recopiés** — la définition d'un jour d'entraînement (règle non triviale : le passé n'est jamais anticipé), la **marge d'adhérence qui est un réglage utilisateur** (`adherenceMarginPct`, défaut 10 — en coder une en dur donnerait deux taux contradictoires dans la même app), et le groupement par repas de NUTR-16. **Un seul nombre inventé** dans tout le lot : le facteur de « gros volume », et encore relatif à la **médiane personnelle**. ⚠️ **Asymétrie délibérée** : une course compte comme jour d'entraînement pour le bilan et l'adhérence, mais produit zéro volume muscu — donc jamais un « gros volume ». ⚠️ **Aucune causalité affirmée** : les 6 items du catalogue qui corrèlent apport et progression de force relèvent du moteur de corrélations, hors lot. ⚠️ Sans pesée, les g/kg n'existent pas et **aucune valeur neutre** ne les remplace : la carte reste et affiche son remède. ✅ Aucune migration, aucune sync rule, aucune écriture → recettable sur l'APK existant. |

> **Ne figurent pas dans ce tableau, volontairement** :
> - les **US d'analyse** (META-06/08/09, MN-03/06, MR-06, NUTR-10/11/17, RN-01/02, MUSC-04/05) —
>   elles sont suivies dans le [catalogue d'analyses](../product/analyses-donnees.md), leur source de
>   vérité, pour ne pas dupliquer un backlog dans l'autre ;
> - les **corrections de bugs** cadrées en US (`fix-*`) — elles vivent dans le
>   [CHANGELOG](../../CHANGELOG.md), pas dans un plan de versions.
>
> ⚠️ **Exception constatée le 02/08/2026** : RUN-14 (5.34), NUTR-16 (4.38) et MUSC-09 (3.56) sont
> des **US d'analyse** du catalogue mais ont reçu une ligne roadmap — la règle ci-dessus a été
> retrouvée *après coup*, en cherchant un numéro pour META-19. Retirer ces 3 lignes aurait exigé de
> défaire plusieurs commits de récapitulatif déjà poussés ; laissées telles quelles, dupliquées avec
> leur entrée (désormais ✅) dans le catalogue. **META-19 et toute US d'analyse suivante suivent la
> règle correctement : catalogue seul, aucune ligne ici.**

---

## Ultérieur — iOS (hors périmètre de lancement)

*Sorti du lancement par l'[ADR-004](../adr/ADR-004-plateforme-lancement.md) (Android d'abord). Traité une fois le produit stabilisé sur Android. Le code restant cross-platform, il s'agit d'un portage, pas d'une réécriture.*

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|:---:|---|
| 9.1 | App iOS *(déplacé depuis V1.0 — arbitrage E)* | Publication App Store via Expo EAS Build. | Difficile | — | 🟡 | ⏳ | Compte Apple Developer + review App Store. Ajouter alors : Live Activity iOS (5.20), Apple Health (9.9), Keychain (9.8). |
| 1.3 | Connexion via Apple *(déplacé depuis V0.8 — arbitrage E)* | OAuth Apple — obligatoire dès qu'un autre OAuth est proposé **sur iOS**. | Moyen | 3h | 🟡 | ⏳ | Compte Apple Developer requis. Sans objet tant qu'on ne publie pas sur iOS. |

---

## Récapitulatif

> **Chiffres indicatifs, recalculés après les arbitrages du 04/07/2026.**
> Base initiale (cadrage Dams) : 179 fonctionnalités / ~470 h. Ajustements appliqués :
> **+ 9.13** Dev build Expo + PowerSync (+8 h) · **+ 9.14** RevenueCat inactif (+2 h, optionnel) ·
> **9.3** SQLite maison → PowerSync (8 h → 6 h) · **9.7** conflits délégués à PowerSync (6 h → 3 h) · **2.12** sync arrière-plan via PowerSync (6 h → 3 h) ·
> **− 1.3** OAuth Apple (−3 h) et **− 9.1** App iOS déplacés en « Ultérieur — iOS » (hors décompte de lancement).

**Avancement réel du code — périmètre de lancement (V0.1 → V1.1, réconcilié le 07/08/2026)** :

| Statut | Nombre | % |
|---|:---:|:---:|
| ✅ Livré | 213 | ~95 % |
| 🟡 Partiel (2.4, 5.24, 3.52, 4.37 — les **seules** lignes à trou réel) | 4 | ~2 % |
| ⬜ À faire (9.2, 1.20, **4.40**) | 3 | ~1 % |
| ⏳ Reporté (dans le périmètre — 8.7, 9.14) | 2 | ~1 % |
| ❌ Abandonné (6.1, 3.18, 6.3, 8.3 — GIF/vidéos de démo exercices) | 4 | ~2 % |
| **Total périmètre de lancement** | **226** | |
| ⏳ Reporté (section « Ultérieur — iOS » : 9.1, 1.3) | 2 | *hors décompte* |

> ⚠️ **Ce tableau mesure le code, pas la recette.** 49 US sont livrées mais **en attente de recette
> device** ([RECETTES.md](../../RECETTES.md), [ETAT.md](../../ETAT.md)) : les 95 % ci-dessus ne veulent
> pas dire « validé », ils veulent dire « écrit, typé, testé et poussé ». Voir l'encadré sur la
> convention ✅ en tête de fichier.

> **Le total est passé de 179 à 194** le 26/07/2026 : les **15 fonctionnalités** de la section
> « [Hors périmètre de cadrage — livré en cours de route](#hors-périmètre-de-cadrage--livré-en-cours-de-route) »
> ont été intégrées au décompte. Elles étaient livrées mais invisibles, ce qui faisait **sous-estimer**
> l'avancement. Les 10 US d'analyse (suivies au [catalogue](../product/analyses-donnees.md)) et les
> correctifs restent hors décompte.
>
> **Puis de 194 à 208** le 28/07/2026 : création de la version **[V0.9](#v09--enrichissements-avant-lancement)**
> (14 fonctionnalités, ~57 h) — décision d'**élargir le périmètre de lancement** puisque le code a pris
> de l'avance sur le cahier des charges et que les prérequis Play sont à délai externe. Le pourcentage
> d'avancement **baisse mécaniquement de 84 % à 78 %** sans qu'une ligne de code ne régresse : c'est le
> dénominateur qui grandit, volontairement.

**Détail par version** (✅ / 🟡 / ⬜ / ⏳ / ❌) :

| Version | ✅ Livré | 🟡 Partiel | ⬜ À faire | ⏳ Reporté | ❌ Abandonné | État |
|---|:---:|:---:|:---:|:---:|:---:|---|
| V0.1 (17) | 16 | 0 | 0 | 1 | 0 | Quasi complet ; le reliquat 9.14 (RevenueCat) est **⏳ reporté**, pas ⬜ — il était compté à tort en « à faire » |
| V0.2 (32) | 29 | 0 | 0 | 0 | 3 | **Complet côté séance** : types de séries (3.27), repos par exercice (3.28), remplacement en direct (3.32), fiche exercice (3.13) livrés par la refonte muscu, **3.36 réconciliée le 01/08/2026** (MUSC-F6). **6.2 → ✅ le 02/08/2026** (MUSC-F1b, schéma corporel SVG). GIF/démo (6.1/3.18/6.3) abandonnés |
| V0.3 (22) | 21 | 1 | 0 | 0 | 0 | **Les 3 push livrés le 30/07** (US MUSC-F8) : 3.42 et 2.7 → ✅ (push agrégé + célébration), 2.4 → 🟡 (recadré en échéance apprise, un vrai « 30 min avant » exigerait une heure de séance en base). **Deload (3.8) câblé le 01/08** (MUSC-F7) — brique et UI livrées, il ne manquait qu'un signal. **3.10 → ✅ le 01/08/2026** (MUSC-F9, glisser-déposer). **3.56 → ✅ le 02/08/2026** (MUSC-09, record par plage de reps, en recette). **3.7 → ✅ le 02/08/2026** (MUSC-F15, progression au niveau du programme — second gate `weightHold`, aucune cible évolutive stockée). |
| V0.4 (34) | 34 | 0 | 0 | 0 | 0 | **100 % livré.** La mention « 2 notifs manquantes » était périmée : **1.14 et 2.5 → ✅ le 30/07/2026** (NUTR-F1, rappels repas + pesée). **4.38 → ✅ le 02/08/2026** (NUTR-16, répartition par repas). |
| V0.5 (34) | 33 | 1 | 0 | 0 | 0 | Cœur GPS/carte OK ; 🟡 = 5.24 (météo, RUN-F3b) — **seul restant**. **5.25 → ✅ le 01/08/2026** (RUN-F3, comparaison à l'objectif). **5.2 → ✅** (contenu vérifié en base le 29/07 : 3 programmes complets). **5.34 → ✅ le 02/08/2026** (RUN-14, prédiction Riegel, en recette). **5.32 → ✅ le 02/08/2026** (RUN-F1b, dénivelé cumulé — blocage codec levé, scalaires cumulés en direct par le tracker). **5.19 → ✅ le 02/08/2026** (RUN-F2a, annonces audio périodiques — `expo-speech`, nouveau dev build requis). **5.23 → ✅ le 02/08/2026** (RUN-F2b, cible en direct — réutilise RUN-F3 tel quel). **5.9 → ✅ le 03/08/2026** (RUN-F2c, blocs fractionné/intervalles — nouvelle table `session_intervals`, en recette). **5.18 → ✅ le 03/08/2026** (RUN-F2d, guidage fractionné vocal — dernier de la famille RUN-F2, en recette). |
| V0.6 (19) | 19 | 0 | 0 | 0 | 0 | **100 % livré** |
| V0.7 (10) | 8 | 0 | 0 | 1 | 1 | 8.3 (upload média) abandonné ; 8.7 reporté |
| V0.8 (9) | 9 | 0 | 0 | 0 | 0 | ✅ **Complet.** 1.19 (CONF-02) + 1.18 (CONF-01) + 1.22 (aide & support) + 9.10 (analytics) + 1.2 (OAuth Google) + 9.9 (Health Connect, recetté le 28/07) + **9.11/9.12 (CONF-07, livré le 01/08, en recette)**. ⚠️ **9 lignes et non 10** : cette version était créditée de **9.16** (REFACTO-01), qui vit en réalité dans le tableau V0.9 — d'où un total de version faux depuis le 31/07/2026. |
| V0.9 (17) | 15 | 2 | 0 | 0 | 0 | 🆕 **Créée le 28/07/2026** (+2 le 30/07 : 1.25 / 1.26, CYCLE-01) — enrichissements retenus depuis [IDEAS.md](../../IDEAS.md), construits pendant les délais externes de Google. **17 lignes** (9.16 incluse, cf. V0.8). 🟡 = **3.52** (MUSC-F14 : l'éditeur de programme n'a pas de parcours « remplacer ») et **4.37** (NUTR-F2 : vivier limité aux aliments récents) — les 2 seuls trous réels. Les 12 autres 🟡 d'avant le 06/08/2026 étaient de la **dette de recette**, pas du code manquant. |
| V1.0 (1) | 0 | 0 | 1 | 0 | 0 | Publication Play Store (dépend de V0.8 **et V0.9**) |
| V1.1 (4) | 3 | 0 | 1 | 0 | 0 | **3 des 4 items livrés le 04/08/2026** (4.27 / 4.28 / 4.29, US REPAS-01) : remontés de V1.1 dans le périmètre courant par arbitrage Florian, le code étant en avance sur le cahier des charges pendant les délais externes de Google. Reste **1.20** (import GPX/CSV), seul item encore ⬜ de cette version. |
| Hors cadrage (24) | 24 | 0 | 0 | 0 | 0 | **100 % livré.** ⚠️ **24 lignes et non 20** : le total n'avait pas suivi les 4 lignes créées depuis le 05/08 (7.20, 7.21, 1.28, 1.29). Refonte muscu, widgets multi-formes, micronutriments, refonte nutrition, écran « Insights » + dégonflage du Tier 0, mode « vie réelle », journal des zones douloureuses. |

- **223 fonctionnalités** dans le périmètre de lancement — **compté, pas estimé** (179 du cadrage + 24 hors cadrage + 17 de V0.9 + 3 remontées de V1.1). L'ancienne mention « ~210 » datait du 28/07/2026 et n'avait pas suivi les 13 lignes créées depuis.
- **~534 h** de code brut estimées, hors intégration, tests et itérations UX — l'estimation ne couvre pas les 24 items hors cadrage.
- **+ 2 items reportés** en section « Ultérieur — iOS » (9.1, 1.3).
- **+ ~10 US d'analyse** suivies au [catalogue](../product/analyses-donnees.md), hors décompte.

Autonomie Claude (périmètre de lancement) : 🟢 Full auto ≈ 167 · 🟡 Semi-auto ≈ 10 · 🔴 Humain requis ≈ 2 (9.13 PowerSync/dev build [livré], 4.8 base d'aliments [livré]).

**Décisions bloquantes à prendre en amont de leur version** :
- ~~avant **V0.1** → confirmer **PowerSync**~~ → **tranché & livré** (spike-001, ADR-001).
- ~~avant **V0.2** → source des GIF d'exercices (6.1)~~ → **tranché : abandonné** (Florian/Damien, 20/07/2026) —
  jugé trop complexe pour la valeur apportée ; 6.1/3.18/6.3/8.3 retirés du périmètre.
- ~~avant **V0.4** → source de la base d'aliments (4.8)~~ → **tranché & livré** : CIQUAL + OpenFoodFacts.
- ~~avant **V0.5** → fournisseur de cartes (5.17)~~ → **tranché : MapLibre + MapTiler** (ADR-006, 11/07/2026).
- avant **V0.8** → clé OAuth Google, textes CGU / confidentialité (rédaction dès que possible, relecture juridique). **OAuth Apple n'est plus bloquant** (reporté avec iOS).
- ~~avant **LANCE-00** → quels types de données Health Connect déclarer ?~~ → **tranché (Florian, 28/07/2026)** :
  on ajoute les **pas** (`READ_STEPS`), on **écarte le sommeil**. Puis **étendu à 6 types le 30/07/2026**
  par CYCLE-01 : la déclaration Play doit porter `WRITE_EXERCISE`, `WRITE_DISTANCE`, `READ_WEIGHT`,
  `READ_STEPS`, **`READ_MENSTRUATION`** et **`WRITE_MENSTRUATION`**. Et, les pas étant **synchronisés
  dans le cloud**, la section « Sécurité des données » doit déclarer une **donnée de santé transmise
  hors de l'appareil** — ce que CONF-06 n'avait pas à déclarer.
  🔴 **Ce bullet annonçait encore 4 types au 06/08/2026** (comme le §4 de la fiche LANCE-00), deux
  fichiers sur quatre étant seuls à jour. La déclaration se dépose **une seule fois** : partir à 4
  aurait coûté une re-déclaration et ~2 semaines de délai externe. Source de vérité :
  [health-connect-play-declaration.md](../specs/technical/health-connect-play-declaration.md) §2 bis.

---

## Journal des réconciliations

> Une entrée par réconciliation, la plus récente en haut. **Trois lignes maximum par entrée** — le
> détail vit dans le [CHANGELOG](../../CHANGELOG.md). Au-delà de 10 entrées, les plus anciennes
> descendent dans [docs/journal/](../journal/).

**06/08/2026 — `/reconcilier` : convention ✅ tranchée (option A, Florian), 15 lignes 🟡 → ✅**
Compteurs : **211 livré / 4 partiel / 2 à faire sur 223** (~95 %) — le détail par version ne
s'additionnait plus (219 ≠ 223) et 5 de ses 12 lignes étaient fausses : V0.4 (34 ✅, pas 32), V0.8
(9 lignes, pas 10), V0.9 (17, pas 16), Hors cadrage (24, pas 20), V0.1 (9.14 est ⏳, pas ⬜).
Corrigés aussi : collisions **7.14 → 7.22** et **4.37 → 4.39**, catalogue **11 → 8 ⏳**, déclaration
Health **4 → 6 types** (2 fichiers sur 4 seuls à jour, chemin critique du lancement), backlog purgé
de 34 candidats livrés, chantier Codex abandonné. Ouvert : **15 US en recette sans critères**.

**06/08/2026 — DOUL-01 : journal des zones douloureuses livré (1.29 créée puis 🟡)**
Compteurs : **196 livré / 19 partiel / 2 à faire sur 223** (Hors cadrage 21 → 22). Typecheck 0,
lint 0, **2 943 tests verts**. 🟡 : 3 migrations non poussées + sync rule d'une table neuve.
L'US **ne débloque pas** la substitution de MUSC-F14 : il manque l'info articulaire, pas la douleur.

**05/08/2026 — VIE-01 : mode « vie réelle » livré (1.28 créée puis 🟡)**
Compteurs : **196 livré / 18 partiel / 2 à faire sur 222** (Hors cadrage 20 → 21). Typecheck 0 et
**2 885 tests verts**. 2 migrations poussées ; 🟡 car la sync rule d'une table neuve reste à déployer.
Le cliquet `MAX_HOME_WIDGETS` d'INSIGHTS-02 a **cassé la CI** et forcé son 1ᵉʳ arbitrage : 7 → 8.

**08/08/2026 — APPORT-01 : création de la ligne 4.40 (lot croisé muscu × nutrition, cadrage seul)**
3ᵉ lot du catalogue (MN-20, MN-16, MN-15, MN-10). Total 225 → **226**, « à faire » 2 → **3**. Trois
calibrages réutilisés au lieu d'être recopiés — dont `adherenceMarginPct`, qui est un **réglage
utilisateur** : en coder un en dur aurait donné deux taux d'adhérence contradictoires dans l'app.

**07/08/2026 — ALLURE-01 (5.35) : livrée, ⬜ → ✅**
5 moteurs purs à 100 %, 1 requête bornée, 3 cartes sur le résumé de course et 1 section sur
l'historique. 213 livré / 2 à faire sur 225. Zones dérivées de `sessionTargetPace` sans aucun nombre
neuf ; fade borné en distance faute de `session_type` sur `runs`. Recette : 22 critères, §52.

**07/08/2026 — ALLURE-01 : création de la ligne 5.35 (lot « courbe d'allure », cadrage seul)**
2ᵉ lot du catalogue (RUN-11, RUN-20, RUN-17, RUN-08), sur le running. Total 224 → **225**, « à faire »
2 → **3**. Zones dérivées de `sessionTargetPace` (aucun nombre neuf) ; `runs` sans `session_type` a
imposé de borner le fade en distance.

**07/08/2026 — EXEC-01 (3.58) : livrée, ⬜ → ✅**
4 moteurs purs à 100 %, 4 requêtes, section conditionnelle sur l'écran Progression. 212 livré / 2 à
faire sur 224. MUSC-14 écartée (aucun horodatage de validation de série), MUSC-21 réduite au niveau
exercice (l'autre moitié était déjà livrée). Recette : 22 critères, §51.

**07/08/2026 — EXEC-01 : création de la ligne 3.58 (lot « prévu vs réalisé », cadrage seul)**
Regroupe 4 items du catalogue (MUSC-33, MUSC-26, MUSC-13, MUSC-21) en une US. Total 223 → **224**,
« à faire » 2 → **3**. MUSC-14 écartée et MUSC-21 réduite de moitié après vérification **dans le
code** — le catalogue les annonçait faisables et entières, elles ne l'étaient pas.

**07/08/2026 — COLLIS-01 (3.57) : correctif « veille hors semaine », statut inchangé ✅**
Le conflit dimanche → lundi n'était jamais détecté (détection bornée à la semaine affichée). Corrigé
avant recette, D7 ajoutée. La revue a trouvé un **second** bug de même origine dans le repli.
Aucun compteur ne bouge : la ligne était déjà ✅, elle l'est maintenant pour de bon.

**05/08/2026 — COLLIS-01 : création de la ligne 3.57 (détecteur de collisions, cadrage seul)**
Compteurs : **195 livré / 17 partiel / 3 à faire sur 221** (Hors cadrage 19 → 20). Aucun code.
Idée promue depuis IDEAS.md (25/07), design brainstormé et validé le jour même. Vérifié : aucune
détection de conflit n'existe, et `PlannedSessionItem` ne porte pas les muscles d'une séance.

**05/08/2026 — INSIGHTS-02 : dégonflage du Tier 0 livré (7.21 créée puis ✅)**
Compteurs : **195 livré / 17 partiel / 2 à faire sur 220** (Hors cadrage 18 → 19, désormais 100 %).
L accueil passe de **21 à 7 widgets** : le plafond d ADR-007 §2, dépassé de 350 % depuis le
16/07/2026, est rétabli **et appliqué par un test**. Les 14 retirés ont chacun une destination
vérifiée. Les hubs absorbent : muscu 5 → 7, course 3 → 4.
Audit : sur les 3 signaux annoncés « sans chiffre » donc sans destination, **2 l'étaient à tort** —
`activity_level` porte déjà `runningDays` (erreur factuelle de la spec 7.20, corrigée par cette US)
et `concurrent_interference` jette deux ratios qu'il calcule. Reste `readiness`, seul cas réel (D3).

**05/08/2026 — INSIGHTS-01 : écran « Insights » livré (7.20 créée puis ✅)**
Compteurs : **194 livré / 17 partiel / 2 à faire sur 219** (section Hors cadrage 17 → 18).
⚠️ L'accueil passe de **20 à 21 widgets** contre les 4-6 du plafond ADR-007 §2 : cette US crée
l'endroit où faire vivre les signaux conditionnels, **INSIGHTS-02 dégonflera** après la recette.
Audit d'ouverture : les **17 🟡** d'alors étaient à **15/17 de la dette de recette ou de sync
rule**, pas du code incomplet — seuls 2.4, 3.52 et 4.37 ont un vrai trou. Écarts relevés et **non
corrigés** : le catalogue annonce **11 ⏳ alors qu'il en reste 8**, et **7.14 est en collision**
(« Joker de série » V0.9 vs « Cercle d'accent » hors cadrage) — 3ᵉ après 4.5/4.36 et 4.37.

**04/08/2026 — REPAS-01 : planning repas, liste de courses et partage (4.27 / 4.28 / 4.29 ⬜ → 🟡),
remontés de V1.1 dans le périmètre courant (arbitrage Florian)**
Compteurs : **193 livré / 17 partiel / 2 à faire** — V1.1 passe de 0/0/4 à 0/3/1, il n'y reste que
**1.20** (import GPX/CSV). Le cadrage d'origine (alimentation.md §6) était périmé sur deux points :
« 4 repas par jour » (l'US 4.15 les a rendus personnalisables) et l'export PDF (écarté, D8).

**03/08/2026 — LAUNCHER-01 : widget écran d'accueil Android livré (7.19 ⬜ → ✅, entrée créée le
même jour)**
Dernier candidat non démarré de la 2ᵉ salve. Coût révisé à la baisse en cours de spec :
`react-native-android-widget` (JSX → RemoteViews) évite le Kotlin natif redouté ; spike de
compatibilité SDK 57/New Architecture confirmé sur device avant d'investir dans le contenu réel.

**03/08/2026 — Deux bugs remontés en usage corrigés : objectif de pas (9.15, reste ✅) et partage de
course (7.17, reste 🟡)**
`daily_step_goal` manquait au **schéma client** PowerSync (colonne existante côté Supabase et dans
le code depuis PAS-01, jamais déclarée en local) : lecture/écriture silencieusement en échec. Carte
de partage : capture différée de deux frames pour laisser le re-rendu se stabiliser avant de saisir
le tracé SVG — hypothèse non confirmée sur device, à valider par Florian.

**03/08/2026 — ACTIV-01 : parcours 7 jours pour démarrer livré (1.27 ⬜ → ✅)**
Widget d'accueil auto-masquant (7 jours après l'onboarding, ou jusqu'au dismiss), piliers actifs
lus en direct (jamais un instantané), aucune notification. ⚠️ **Contenu des 7 jours = brouillon**,
à valider par Florian/Damien avant de le considérer figé.

**03/08/2026 — RUN-F2d : guidage fractionné vocal livré, dernier de la famille RUN-F2 (5.18 ⬜ → ✅)**
Annonce vocale + vibration à chaque changement de **phase** (rapide↔récup), pas seulement de ligne
de bloc — un `reps=6` produit 12 transitions. Progression persistée sur `runs` (3 colonnes
additives, aucune sync rule) pour un rattrapage silencieux au remontage de l'écran, sans annoncer
« rapide » par erreur pendant une récup.

**03/08/2026 — RUN-F2c : blocs fractionné/intervalles livrés (5.9 🟡 → ✅)**
Nouvelle table `session_intervals` (une ligne = un bloc, comme `exercise_plans.target_sets`),
éditeurs mobile + admin (`SortableList`), affichage lecture seule sur 2 écrans. ⚠️ 2 sync rules
à déployer manuellement sur le dashboard PowerSync avant recette (table neuve, non fait ce jour).

**02/08/2026 — RUN-F2b : cible en direct livrée (5.23 ⬜ → ✅)**
Réutilise `compareToTarget`/`useRunTarget`/`running.target.*` de RUN-F3 tels quels — aucune
fonction ni clé neuve, juste `ActiveRun` étendu (`plannedSessionId`) et une carte dans
`run/active.tsx`. Les deux actions du titre roadmap étaient déjà natives (Stop existant, poursuite
libre déjà possible) ; seule manquait la visibilité.

**02/08/2026 — RUN-F2a : annonces audio périodiques livrées (5.19 ⬜ → ✅)**
`expo-speech` (dépendance native neuve, nouveau dev build requis), réglage opt-in sur
`running_profiles`, déclenché depuis `run/active.tsx` (premier plan). RUN-F2 scindée en 4
candidats (RUN-F2a/b/c/d) — trop hétérogènes pour un seul incrément, voir BACKLOG.md.

**02/08/2026 — RUN-F1b : dénivelé cumulé livré, blocage codec levé (5.32 ⬜ → ✅)**
`elevation_gain_m`/`elevation_loss_m` cumulés en direct par le tracker (comme `distance_m`/
`duration_seconds`), `gps_track` inchangé — le blocage supposait à tort qu'il fallait étendre le
codec de trace. Seuils GPS non validés terrain (30 m précision, 3 m bruit), à ajuster en recette.

**02/08/2026 — MUSC-F15 : progression au niveau du programme livrée (3.7 🟡 → ✅)**
Second gate `weightHold` sur `computeProgressionSuggestion` (symétrique à `previousStruggled`,
MUSC-F7) : poids gelé si la semaine précédente du programme n'a pas atteint 80 % de complétion.
Aucune cible évolutive stockée, aucune migration — chantier scindé de MUSC-F7 le 01/08/2026.

**02/08/2026 — MUSC-09 : record par plage de reps livré (3.56 ⬜ → ✅)**
Complète les 3 records existants de la fiche exercice par la charge max par plage (1/3/5/8/10/12+).
Même éligibilité de série que le reste du système, plage jamais travaillée absente. Aucune migration.

**02/08/2026 — NUTR-16 : répartition par repas livrée (4.38 ⬜ → ✅)**
Part (%) + moyenne (kcal/j), groupées sur la clé réelle de `meal_type` (plus un enum fixe depuis
les repas personnalisés). Bucket « Autres » et repli de libellé réutilisés du journal, sans 2ᵉ
implémentation. Calcul pur, aucune migration.

**02/08/2026 — RUN-14 : prédiction de temps (Riegel) livrée (5.34 ⬜ → ✅)**
Source fixe = record 5 km (R1), un vrai record bat toujours une estimation (R3), avertissement
dédié marathon (R5). Calcul pur, aucune migration — bloc monté sous les records existants.

**02/08/2026 — MUSC-F1b : schéma corporel, anatomie fine (6.2 ⬜ → ✅)**
`muscles_fine` additif aux 6 groupes larges (aucun ricochet sur les 18 fichiers qui les
consomment). `<BodyMap/>` monté sur fiche/aperçu de séance/bilan hebdo, repli large tant qu'un
exercice n'est pas tagué (travail de coach, hors dev). Critère 12 (relecture anatomique) restant.

**01/08/2026 — MUSC-F9 : glisser-déposer du planning (3.10 🟡 → ✅)**
Geste appui long + glissement sur les cartes du planning, zones mesurées à chaque prise de geste
(`measureInWindow`). Les 3 boutons de report restent (chemin accessible). ⚠️ `expo-haptics` neuf → nouveau build requis.

**01/08/2026 — RUN-F3 : comparaison à l'objectif + terrain (5.25 🟡 → ✅, 5.24 partiel)**
Construit le lien course↔séance planifiée, inexistant jusqu'ici (`runs.planned_session_id`,
nouveau point d'entrée sur le hub). Météo (5.24) reste scindée en RUN-F3b, à part.

**01/08/2026 — CONF-07 : palette corrigée, V0.8 complète (9.11/9.12 🟡 → ✅)**
5 paires corrigées (assombrissement pur HSL), D1/D2 validées par Florian. Garde-fou durable :
`contrastRatio` testé + un test qui parcourt la palette réelle — la 1ʳᵉ passe avait échoué faute de mesure.

**01/08/2026 — MUSC-F7 : deload câblé (3.8 🟡 → ✅), 3.7 scindé (reste 🟡)**
Signal `previousStruggled` câblé sur une brique/UI déjà livrées (Refonte-C3) — zéro nouvelle UI.
3.7 (progression au niveau programme) scindé : aucune brique de données n'existe, cadrage à part.

**01/08/2026 — MUSC-F6 : réconciliée (3.36 🟡 → ✅, Option A)**
Le conflit « 3h/4h » n'existait que dans la doc — `WORKOUT_AUTO_CLOSE_SECONDS` (3h) est la seule
limite réelle, déjà testée. Corrigé `musculation.md` §4.4 + le libellé roadmap. Zéro code.

**01/08/2026 — Recette device : 8 correctifs (1.25 🟡, 4.37 🟡, statuts inchangés)**
CYCLE-01 était **inactivable** (colonnes absentes du schéma local) et ses routes ouvertes suivi éteint ;
NUTR-F2 proposait 350 g de chipolatas. Contrat des suggestions revu + 50 portions renseignées en base.
Aucun compteur ne bouge : tout reste en attente de recette humaine.

**01/08/2026 — Synchro bloquée : correctif du connecteur PowerSync (9.4, reste ✅)**
Les colonnes `jsonb` remontaient en texte : file d'envoi gelée en boucle, plus rien ne montait ni ne
descendait, « Synchronisé » affiché. Trouvé en recette device. Aucun compteur ne bouge.

**31/07/2026 — REFACTO-01 : livrée et clôturée (9.16 ✅)**
~10 sites unifiés sur `resolveActivePillars`, corrige au passage un repli codé en dur désynchronisé
de `PILLARS` (`weekly-review-repository.ts`). Aucune recette device : clôturée directement.

**31/07/2026 — REFACTO-01 : ligne créée (9.16 🟡)**
Dette trouvée le 30/07/2026 en cadrant SOCLE-01, entrée en pipeline (spec + plan). Total 212 → **213**,
V0.8 9 → **10**. Aucune recette device (refactor invisible, comportement inchangé à 3 piliers).

**31/07/2026 — CYCLE-01 : Health Connect câblé, code complet (1.25 / 1.26 toujours 🟡)**
Permissions dédiées, push (périodes closes + flux manuels) et import throttlé (dédup R21), en
briques pures testées + adaptateur mobile. **Ne reste que la recette device** (RECETTES.md #15).

**31/07/2026 — CYCLE-01 : calendrier, croisement complet, tests (1.25 / 1.26 toujours 🟡)**
Calendrier mensuel (écran + mini-calendrier du widget `large`) et les 2 métriques de croisement
manquantes (kcal, allure) — aucune n'exigeait de nouvel agrégat, seulement le branchement. 16 tests
smoke ajoutés. **Ne reste que Health Connect** (délai externe, nouveau build requis).

**30/07/2026 — CYCLE-01 : suivi du cycle menstruel (1.25 / 1.26 créées)**
Sujet totalement absent du dépôt jusqu'ici. Total 210 → **212**, V0.9 14 → **16**. 4 arbitrages
Damien en option maximale ; chemin critique du lancement ~3 → **~5 semaines**, assumé.

**30/07/2026 (soir) — Réconciliation : 4 affirmations fausses corrigées, 4 US entrées en pipeline**
Aucun statut de livraison ne change (rien n'a été codé). Corrigé : 9.12 « le clair passe AA » (faux,
3 non-conformités restantes), RUN-F3 « la météo est un champ post-séance » (aucun champ n'existe),
« 2 tests en timeout » (suite verte), retard de `main` (927 → 972). Entrées : CONF-07, MUSC-F9,
MUSC-F1b, RUN-F3. **5.24 scindé en RUN-F3b** — il touche la confidentialité de LANCE-00.

**30/07/2026 — Carte de partage : charte alignée sur le thème sombre (7.17, reste 🟡)**
Aucun changement de statut : habillage seul, l'US reste en recette device. Couleurs figées
volontairement. Constat « 2 tests en timeout » **clos** au backlog — suite 100 % verte (231 + 1218).

**30/07/2026 — Refonte visuelle du pilier Nutrition (4.37 ✅) + cercle d'accent (7.14 ✅)**
Deux lignes **créées** hors cadrage : ni l'une ni l'autre n'existait dans la roadmap. Journal
alimentaire seul (écran 01/10) ; les 9 autres écrans du pilier gardent leur habillage.
Total **208 → 210**, hors cadrage **15 → 17**. Compteurs : **174 / 20 / 10 / 2⏳**.

**30/07/2026 — MUSC-F8 : notifications muscu (3.42, 2.7 ✅ · 2.4 🟡)**
Push de record **agrégé** (jamais 1 par record — jusqu'à 15 en une séance) + célébration animée +
rappel de séance recadré en échéance apprise sur `finished_at` (pas `started_at` : même piège que D1,
déplacé). Solde D3 de NUTR-F1 : plafond de 3/jour réellement appliqué aux notifications immédiates.
Compteurs : **172 / 20 / 10 / 2⏳**.

**30/07/2026 — SOCLE-01 : entitlements RevenueCat (9.14) ⬜ → ⏳ Reporté**
Cadrée puis reportée le même jour : le PRD dit les paliers « non engageants », « Premium muscu » n'a
aucun contenu défini, et **aucune fonctionnalité IA n'est livrée** — la couture n'aurait aucun
consommateur. Dette d'accès réelle isolée en **REFACTO-01**. Compteurs : **170 / 19 / 13 / 2⏳**.

**30/07/2026 — NUTR-F1 : rappels programmés nutrition (1.14, 2.5) ⬜ → ✅ ×2**
Défaut de conception corrigé avant tout code : on apprend le **p90** de l'heure du geste (une échéance),
pas la médiane — sinon le rappel partait pendant que l'utilisateur faisait le geste. Le hint « max 3
notifs/jour », faux depuis V0.6, est corrigé par le **texte** (D3). 0 migration. Compteurs : **170 / 19 / 14**.

**29/07/2026 — MUSC-F14 : substitution d'exercice (3.52) ⬜ → 🟡**
Motif « zone douloureuse » **retiré** : sans donnée articulaire, y répondre serait un conseil de santé
inventé. Suggestions neutres, variantes déclarées prioritaires sur le calcul. L'éditeur de programme
n'ayant **pas de remplacement**, seule la séance est couverte. 19 tests. Compteurs : **168 / 19 / 16**.

**29/07/2026 — UX-05 : intensité en RPE ou RIR (3.55) ⬜ → 🟡**
Portée réduite au **RPE par série** après inventaire : le ressenti de séance est sur 5 étoiles et le
RIR n'a aucun sens sur une course. Inversion pure 0→9 pour que la bascule soit réversible sans perte.
**1 migration, 0 sync rule.** 20 tests. Compteurs : **168 / 18 / 17**.

**29/07/2026 — PARTAGE-01 : carte partageable (7.17) ⬜ → 🟡**
Tracé **redessiné en SVG** plutôt que capturé : une vue MapLibre native ressort noire d'un
`captureRef`. Bénéfice collatéral — la carte marche sans clé de carte et hors ligne. 28 tests.
⚠️ Dépendance native → **second build requis** pour la recette. Compteurs : **168 / 17 / 18**.

**29/07/2026 — BILAN-01 : bilan hebdomadaire (7.16) ⬜ → 🟡**
« Aucune narration sans les chiffres » imposé par le **type**, pas par la discipline. Décision choisie
par règles ordonnées, donc explicable. Notification non chiffrée + calcul à l'ouverture : le doze mode
devient sans conséquence. **Aucune migration.** 32 tests. Compteurs : **168 / 16 / 19**.

**29/07/2026 — OBJ-01 : objectifs à échéance (7.15) ⬜ → 🟡**
Ni statut ni progression stockés : fonctions pures de la fenêtre `[début, échéance]` — donc aucun
cron à faire tourner, un verdict qu'aucune activité ultérieure ne peut réécrire, et un calcul qui
marche hors ligne. 2 types choisis pour être les cas durs. 26 tests. Compteurs : **168 / 15 / 20**.

**29/07/2026 — STREAK-01 : joker de série (7.14) ⬜ → 🟡**
4 décisions produit arbitrées avant tout code. Manuel et rétroactif (un joker automatique
dévaloriserait la série), 1 par mois, **un seul jour isolé**, et surtout : il protège **le compteur
sans fabriquer d'activité** — l'adhérence et le journal voient toujours un jour vide. 18 tests.
Compteurs : **168 / 14 / 21**.

**29/07/2026 — NUTR-F2 : suggestion pour combler un macro (4.37) ⬜ → 🟡**
Score déterministe (18 tests) : densité **pour 100 kcal** et non pour 100 g, macro sur l'écart
**relatif**, quantité bornée 10–400 g avec **écartement** hors bornes — pas de « 900 g de brocoli ».
Compteurs : **168 / 13 / 22**. 🟡 : vivier réduit aux récents + recette device.

**29/07/2026 — MESUR-01 : mensurations corporelles (3.51) ⬜ → 🟡**
E8 enfin descendue de la spec muscu, 25 jours après son cadrage. Modèle **normalisé** (D1) : ajouter
une mesure — ou gauche/droite — ne coûtera aucune migration. Stockage toujours en cm, la bascule
d'unité étant un fait d'affichage. Compteurs : **168 / 12 / 23**. 🟡 : sync rule + recette device.

**29/07/2026 — UX-LOT-01 : les 3 finitions de recette (3.53, 3.54, 7.18) ⬜ → ✅**
Inventaire du code avant d'écrire : **3.53 était déjà livré** (`12bd3a1`), l'édition de 3.54 aussi, et
le diagnostic de 7.18 était **faux sur 2 points** (appui long et retour visuel existaient). Livré :
états vides explicites sur la fiche exercice, cibles portées à 48 dp, poignée et indice de geste.
Compteurs : **168 / 11 / 24**.

**29/07/2026 — ADMIN-01 : archivage sûr du contenu éditorial (8.11) ⬜ → 🟡**
Décompte des usages avant archivage (fonction `security definer` — la RLS interdisait le comptage
inter-utilisateurs), restauration en cascade dans les 3 écrans, import CSV corrigé. Le vrai correctif
était ailleurs que prévu : les sélections filtraient déjà, mais les **jointures de traduction** aussi.
Compteurs : **165 / 11 / 27**. 🟡 : sync rule à redéployer + recette navigateur.

**29/07/2026 — CONTENU-01 : bibliothèques de programmes (3.1, 5.2) 🟡 → ✅**
L'inventaire du cloud a démenti la spec : la **course n'était pas vide** (3 programmes complets), et
**2 programmes de test étaient publiés**, donc visibles dans l'app. Migration idempotente : test
dépubliés + 2 programmes muscu bilingues (PPL, Half Body). Compteurs : **165 / 10 / 28**.

**28/07/2026 — BIEN-01 : check-in de bien-être (1.24) ⬜ → 🟡**
Code livré : table `daily_wellbeing` (2 migrations), briques pures testées, feuille de check-in en
~10 s, widget **transverse** (`'always'` — 4ᵉ dimension, pas 4ᵉ pilier), historique, i18n FR+EN,
export RGPD. **Le check-in ne compte pas dans la série** (décision D5). Compteurs : **163 / 12 / 28**
(V0.9 : 1/1/12). 🟡 : sync rule PowerSync à déployer à la main + recette device à faire.

**28/07/2026 — audit `/reconcilier` : le catalogue d'analyses avait dérivé, pas la roadmap**
Roadmap **juste sur ses 40 lignes ⬜/🟡** (preuve cherchée à charge), compteurs et 47 migrations OK.
En revanche 4 lignes fausses au [catalogue](../product/analyses-donnees.md) — **RUN-10** (splits/km) et
**RUN-05** livrées, **MUSC-06** livrée avec MUSC-05, **MN-13** absorbée par MN-06 — + `roadmap:` vide
sur 4 specs livrées (1.23, 3.48, 3.49, 3.50). 2ᵉ salve de 5 candidats inscrite au backlog, après V0.9.

**30/07/2026 — accessibilité (9.11 / 9.12) : audit outillé, contraste du thème clair corrigé**
Les ratios WCAG se calculent depuis la palette : 3 non-conformités en clair, toutes corrigées ;
Dynamic Type vérifié sans défaut sur 41 écrans. Les deux lignes **restent 🟡** — il demeure le blanc
sur accent en thème sombre (3,29), qui est un choix de charte. Compteurs inchangés.

**30/07/2026 — passe device sur 41 écrans : 5 correctifs, aucun statut modifié**
Défauts d'affichage et d'accessibilité sur 9.9 (bandeau d'erreur alors que Health Connect est juste
désactivé), 7.15, 1.24, 5.12 et 9.11/9.12. Tous rendaient — donc invisibles de la CI. Inventaire des
73 écrans créé : [plan-de-test.md](../plan-de-test.md). Compteurs inchangés.

**30/07/2026 — PAS-01 (9.15) : correctif d'en-tête post-clôture, statut ✅ inchangé**
La route `steps` était absente de `_layout.tsx` : aucun en-tête de navigation, titre de page sous la
barre d'état. Trouvé en passe adb sur device, invisible du typecheck et des tests. Compteurs inchangés.

**28/07/2026 — PAS-01 : pas quotidiens (9.15) ⬜ → ✅**
Cadrée, codée et recettée le même jour : lecture par **agrégation** Health Connect (jamais la somme
des records), table `daily_steps` synchronisée, objectif de pas, widget 3 formes, historique, et
**les pas comptent dans la série** (jour actif = objectif atteint). Compteurs : **163 / 11 / 29**
(V0.9 : 1/0/13). 2 migrations, dont une pour la publication `powersync` — l'oubli du 24/07.

**28/07/2026 — création de V0.9 : élargissement du périmètre de lancement (+14)**
Le code étant en avance sur le cahier des charges et les prérequis Play étant à délai externe (~3 s.),
14 idées d'[IDEAS.md](../../IDEAS.md) sont promues avant le lancement : 1.24, 3.51→3.55, 4.37,
7.14→7.18, 8.11, 9.15. Compteurs : **162 / 11 / 30 sur 208** (V0.9 : 0/0/14) — le % passe de 84 à 78 %
parce que le dénominateur grandit, pas parce que quelque chose a régressé.

**28/07/2026 — CONF-06 : Health Connect (9.9) 🟡 → ✅**
Recette device validée par Florian. Deux correctifs trouvés en recette : format d'horodatage
(`Instant.parse` refuse l'espace de Postgres) et retour d'erreur visible. Compteurs : **162 / 11 / 16**
(V0.8 : 7/2/0). Estimation réelle ~20 h contre 6 h annoncées.

**27/07/2026 — CONF-06 : Health Connect (9.9) ⬜ → 🟡**
Code livré (écriture séances/courses, lecture poids, opt-in) ; reste la **recette device** et la
**déclaration Google Play**. Estimation corrigée : 6 h → ~16 h réelles. Compteurs : **161 / 12 / 16**
(V0.8 : 6/3/0). LANCE-00 (compte développeur Play, non créé) ajouté en P0 au backlog.

**26/07/2026 — réconciliation de fond (refonte du suivi d'avancement)**
6 lignes périmées corrigées : **3.13 / 3.27 / 3.28 / 3.32** 🟡⬜ → ✅ (livrées par la refonte muscu, jamais
réconciliées), **3.7 / 3.8** ⬜ → 🟡 (briques livrées non câblées). Création de la section
« Hors périmètre de cadrage » : **15 fonctionnalités livrées mais absentes de la roadmap** y sont
intégrées, dont la collision de numéro **4.5 → 4.36** (saisie en langage naturel).
Compteurs : **161 livré / 11 partiel / 17 à faire sur 194** (V0.2 : 27/1/1 · V0.3 : 14/4/3 ·
V0.5 : 25/4/4 — l'item **5.2** était compté livré à tort depuis le 18/07, son catalogue est vide).
Comptage désormais **vérifié par script** (somme des colonnes = total, par section et au global).

**25/07/2026 — finitions muscu / course**
8 items ⬜ → ✅ : 3.17, 3.26, 3.29, 3.33, 3.34, 2.3, 3.37 (clôture auto 3 h), 5.26 (splits/km).
3.36 (pause) ⬜ → 🟡. Compteurs de l'époque : 143 / 11 / 20 sur 179.

**23–24/07/2026 — V0.8 conformité**
1.18 (CONF-01 export), 1.19 (CONF-02 suppression), 1.22 (aide & support), 9.10 (analytics),
1.2 (OAuth Google) passées ⬜ → ✅.

**22/07/2026 — fiche exercice**
3.14 (recherche multi-critères), 3.19 (muscles secondaires), 3.20 (variantes) 🟡⬜ → ✅.

**18/07/2026 — première réconciliation code ↔ roadmap**
Colonne Statut renseignée sur l'ensemble du périmètre. Structure adaptée aux arbitrages de cadrage
(PowerSync, Android d'abord, RevenueCat inactif, bilingue FR+EN, gamification V3/V4).

<details><summary>Détail brut des réconciliations antérieures (conservé pour trace)</summary>

*25/07/2026 — **réconciliation code ↔ roadmap (finitions muscu/course)** : 8 items marqués ⬜ mais **déjà livrés** (par le chantier refonte muscu, non réconciliés) ou **livrés ce jour** passés ✅ — **3.17** (note/exo), **3.26** (dernière perf), **3.29** (vibration fin repos), **3.33** (note séance), **3.34** (RPE ressenti), **2.3** (écran actif muscu), **3.37** (clôture auto 3 h, `feature/auto-close-seance-perimee`), **5.26** (tableau splits/km, `feature/run-summary-splits`) ; **3.36** (pause) ⬜ → 🟡 (pause=quitter, pas de fenêtre 4 h explicite ; seuils 3 h/4 h à réconcilier avec 3.37). Compteurs : **143 livré / 11 partiel / 20 à faire** (V0.2 : 23/4/2 ; V0.5 : 26/3/4). Preuves code vérifiées. Précédemment : 24/07/2026 — 1.2 (connexion via Google) passée ⬜ → ✅ (compteurs : 135 livré / 10 partiel / 29 à faire ; V0.8 : 6 livré, reste 9.9). Code livré ; reste prérequis Google Cloud/Supabase + dev build + recette. Précédemment : 24/07/2026 — 9.10 (analytics produit first-party) passée ⬜ → ✅ (compteurs : 134 livré / 10 partiel / 30 à faire ; V0.8 : 5 livré). Migration déployée ; reste sync rule PowerSync + recette. Précédemment : 24/07/2026 — 1.22 (aide & support) passée ⬜ → ✅ (compteurs : 133 livré / 10 partiel / 31 à faire ; V0.8 : 4 livré). Reste dev build + recette + Damien. Précédemment : 23/07/2026 — 1.18 (export des données, CONF-01) passée ⬜ → ✅ (compteurs : 132 livré / 10 partiel / 32 à faire ; V0.8 : 3 livré). Précédemment : 23/07/2026 — 1.19 (suppression du compte, CONF-02) passée ⬜ → ✅ (compteurs : 131 livré / 10 partiel / 33 à faire ; V0.8 : 2 livré). Précédemment : 22/07/2026 — 3.20 (variantes / alternatives, MUSC-F10c-2) passée ⬜ → ✅ (compteurs : 130 livré / 10 partiel / 34 à faire). Précédemment : 22/07/2026 — 3.19 (muscles ciblés : primaire + secondaires, MUSC-F10c-1) passée 🟡 → ✅ (129 livré / 10 partiel). Antérieurement : 22/07/2026 — 3.14 (recherche d'exercices multi-critères, MUSC-F3) passée 🟡 → ✅ (128 livré / 11 partiel). Antérieurement : 18/07/2026 — colonne Statut renseignée par réconciliation code ↔ roadmap (avancement réel). Structure adaptée aux arbitrages de cadrage (PowerSync, Android d'abord, RevenueCat inactif, bilingue FR+EN, gamification V3/V4).*

</details>
