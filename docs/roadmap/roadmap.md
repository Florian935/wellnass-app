# Roadmap — Wellness App (par versions)

Roadmap versionnée de référence, **adaptée aux arbitrages de cadrage du 04/07/2026**
(voir [SYNTHESE-CADRAGE.md](../../SYNTHESE-CADRAGE.md) et les [ADR](../adr/)).
Elle reprend la structure de la « Validation des Fonctionnalités » de Dams et applique les décisions actées (PowerSync, iOS reporté, monétisation inactive, bilingue FR+EN, gamification hors périmètre).

Colonne **Statut** = **avancement réel du code** (réconcilié le 26/07/2026, **tenu à jour à chaque livraison** — voir [`/commit`](../../.claude/commands/commit.md) et [`/reconcilier`](../../.claude/commands/reconcilier.md)) : ✅ Livré · 🟡 Partiel (socle présent, incomplet) · ⬜ À faire · ⏳ Reporté · ❌ Abandonné (retiré du périmètre, décision produit tracée en Remarques)
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
| **[Hors cadrage](#hors-périmètre-de-cadrage--livré-en-cours-de-route)** | Né après le 04/07, déjà livré | Refonte muscu, widgets multi-formes, micronutriments, infobulle graphiques… | 15 | *non estimé* |
| **Ultérieur — iOS** | Portage iOS (hors lancement) | App Store + OAuth Apple | 2 | — |
| | | **Total (périmètre de lancement)** | **208** | **~534h** |

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
| 9.14 | **Câblage RevenueCat / entitlements (inactif)** *(nouvel item optionnel — arbitrage D)* | SDK RevenueCat intégré, entitlements multi-paliers définis (Premium muscu → Écosystème → IA), **laissés inactifs**. **Aucun écran de paiement, aucun paywall.** | Facile | 2h | 🟡 | ⬜ | Optionnel. Peu coûteux posé tôt, évite une refonte — voir [ADR-003](../adr/ADR-003-monetisation.md). **Aucune trace dans le code.** |
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
| 6.2 | Muscles ciblés sur schéma | Corps humain SVG avec muscles travaillés en évidence. | Moyen | 4h | 🟢 | ⬜ | **Aucun composant schéma corporel.** |
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
| 3.36 | Mise en pause de séance | Suspendre et reprendre dans les 4 heures. | Moyen | 3h | 🟢 | 🟡 | Pause = quitter (séance reste active, reprise via « Reprendre ») ; **pas de fenêtre 4 h explicite**, bornée à 3 h par la clôture auto (3.37) — seuils 3 h/4 h à réconcilier. |
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
| 3.10 | Décalage de séance | Glisser-déposer vers un autre jour. | Moyen | 3h | 🟢 | 🟡 | `reschedulePlannedSession` par action, **pas de glisser-déposer**. |
| 3.11 | Gestion séance manquée | Reporter ou sauter. | Facile | 2h | 🟢 | ✅ | `skip` + `reschedule` + `useMissedSessions`. |
| 3.24 | Plan de séance avant démarrage | Récap des exercices prévus avec cibles. | Facile | 2h | 🟢 | ✅ | `programs/[id].tsx`. |
| 3.7 | Progression automatique | Charge cible +X d'une semaine à l'autre (si ≥ 80 % complété). | Moyen | 3h | 🟢 | 🟡 | Suggestion de progression **par exercice** en séance (`computeProgressionSuggestion`, RPE-aware, jamais imposée) — Refonte-C3. **Manque la progression au niveau du programme** (cible de charge recalculée d'une semaine à l'autre). Voir MUSC-F7 au [backlog](../../BACKLOG.md). |
| 3.8 | Deload / gestion de stagnation | Échec 2 semaines de suite → proposition −10 %. Jamais imposé. | Moyen | 3h | 🟢 | 🟡 | Brique pure livrée et testée (`computeProgressionSuggestion` kind `deload`, −10 %) mais **non câblée** : il manque le signal `previousStruggled` (séance avant-dernière) et la validation de la règle. Voir MUSC-F7 au [backlog](../../BACKLOG.md). |
| 3.38 | Historique des séances | Liste chronologique filtrable. | Moyen | 3h | 🟢 | ✅ | `history/index.tsx`. Journal horodaté = base future couche jeu (arbitrage C). |
| 3.39 | Courbes charge / volume | Évolution par exercice sur différentes périodes. | Moyen | 4h | 🟢 | ✅ | `progress/index.tsx` + `ProgressLineChart`. |
| 3.21 | Courbe de progression par exercice | Charge max / volume sur 30 / 90 j / 1 an. | Moyen | 4h | 🟢 | ✅ | + 1RM estimé + période « tout » (MUSC-04). |
| 3.40 | Volume par groupe musculaire | Séries par groupe sur la semaine — détecte les déséquilibres. | Moyen | 3h | 🟢 | ✅ | `MuscleVolumeBarChart` + `useMuscleVolumeThisWeek`. |
| 3.41 | Alerte déséquilibre musculaire | Si un groupe très sous-sollicité sur 2 semaines. | Moyen | 3h | 🟢 | ✅ | `useMuscleBalance` + alerte groupes négligés (MUSC-05). |
| 3.42 | Notification nouveau record | Push + animation quand un record est battu. | Facile | 2h | 🟢 | ⬜ | Records affichés au résumé, **aucun push** (notifs = streak seul). |
| 2.4 | Notif — Rappel séance | Push 30 min avant une séance planifiée. | Moyen | 3h | 🟢 | ⬜ | **Aucune notif de rappel de séance planifiée.** |
| 2.7 | Notif — Nouveau record | Push immédiat. | Facile | 1h | 🟢 | ⬜ | **Aucune notif push de record.** |

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
| 1.14 | Rappel de pesée | Notification optionnelle à heure fixe. | Facile | 1h | 🟢 | ⬜ | **Aucune trace** (notifs = streak seul). |
| 4.30 | Courbe poids corporel | Évolution sur 4 sem / 3 mois / 1 an. | Moyen | 3h | 🟢 | ✅ | `nutrition-stats.tsx`. |
| 4.31 | Évolution apports moyens | Calories et macros moyennes 7 / 30 jours. | Moyen | 3h | 🟢 | ✅ | `averageIntake`. |
| 4.32 | Alerte déficit + fort volume | Déficit important + semaine à fort volume muscu. | Moyen | 2h | 🟢 | ✅ | `DeficitVolumeAlertCard`. Première stat croisée entre piliers. |
| 2.5 | Notif — Rappel repas | Push à heure définie. | Facile | 1h | 🟢 | ⬜ | **Aucun scheduling repas.** |

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
| 5.19 | Annonces audio périodiques | À chaque km (paramétrable) : distance, temps, allure. | Facile | 2h | 🟢 | ⬜ | **Aucune trace `expo-speech`/audio.** |
| 5.23 | Prolonger ou raccourcir | Terminer avant la cible ou continuer en libre. | Facile | 1h | 🟢 | ⬜ | Course active = libre uniquement, **aucune cible**. |
| 5.24 | Note + ressenti post-séance | RPE, météo, terrain. | Facile | 2h | 🟢 | 🟡 | RPE + notes OK, mais **pas météo/terrain**. |
| 5.25 | Résumé post-séance | Distance, durée, allure, carte, dénivelé, comparaison objectif. | Moyen | 4h | 🟢 | 🟡 | Distance/durée/allure/carte OK ; **dénivelé + comparaison objectif absents**. |
| 5.26 | Tableau pace par km | Allure de chaque kilomètre. | Moyen | 3h | 🟢 | ✅ | `computeKmSplits` + tableau splits/km sur `run/summary.tsx`, km le plus rapide en accent (25/07/2026). |
| 5.1 | Profil coureur | Objectif, niveau, allure de référence, fréquence. | Facile | 2h | 🟢 | ✅ | `running-profile.tsx`. |
| 5.8 | Endurance fondamentale | Allure de réf. + 60-90 s/km. Base aérobie. | Facile | 1h | 🟢 | ✅ | `sessionTargetPace('endurance')`. |
| 5.9 | Fractionné / intervalles | Blocs rapides / récupération (ex. 6×400 m à 95 % VMA). | Moyen | 4h | 🟢 | 🟡 | Type + plage d'allure seulement ; **pas de blocs rapide/récup structurés**. |
| 5.10 | Sortie longue | Allure de réf. + 30-60 s/km. +10 % max par semaine. | Facile | 1h | 🟢 | ✅ | `sessionTargetPace('sortie_longue')`. |
| 5.11 | Récupération active | Allure de réf. + 90 s/km ou plus, 20-30 min. | Facile | 1h | 🟢 | ✅ | `sessionTargetPace('recuperation')`. |
| 5.18 | Guidage fractionné vocal | Annonce vocale + vibration à chaque changement de bloc. | Moyen | 4h | 🟢 | ⬜ | **Aucune trace** (dépend de blocs + Speech, absents). |
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
| 5.32 | Dénivelé cumulé | Dénivelé positif par semaine / mois. | Moyen | 2h | 🟢 | ⬜ | **Aucun calcul d'élévation/altitude.** |
| 5.33 | Export GPX | Export d'une sortie (partage / Strava). | Facile | 2h | 🟢 | ✅ | `lib/gpx-export.ts`. |

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
| 9.4 | Synchronisation cloud (PowerSync) *(reformulé — arbitrage B)* | Synchro bidirectionnelle **gérée par PowerSync** entre le SQLite local et Postgres/Supabase, en arrière-plan dès connexion. | Difficile | 8h | 🟢 | ✅ | `powersync/system.ts` + `connector.ts`. |
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

*Objectif : tout ce qui doit exister avant d'ouvrir à de vrais testeurs (Play interne) — OAuth Google, RGPD, Health, analytics, accessibilité. **OAuth Apple (1.3) sorti du périmètre de lancement** → section « Ultérieur — iOS » (arbitrage E).* **⚠️ Version quasi non entamée — principal reste-à-faire du MVP1.**

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|:---:|---|
| 1.2 | Connexion via Google | OAuth Google. | Moyen | 3h | 🟡 | ✅ | **US 1.2 code livré (24/07/2026).** Sign-In natif (`@react-native-google-signin`) → `supabase.auth.signInWithIdToken` ; bouton « Continuer avec Google » (2 écrans) + mention consentement ; liaison auto e-mail vérifié. **Conservé** (arbitrage E). **Recette validée 100 % (Florian, 24/07/2026)** : connexion Google + liaison auto sur e-mail vérifié (même compte). |
| 1.17 | Gestion des notifications | Activation / désactivation par type. | Facile | 2h | 🟢 | ✅ | Section Notifications de `settings.tsx`. |
| 1.18 | Export des données | JSON ou CSV (obligation RGPD). | Moyen | 4h | 🟢 | ✅ | **CONF-01 livré (23/07/2026).** Export JSON local (hors-ligne) de toutes les données perso (31 tables possédées + traductions perso) via feuille de partage ; Réglages → « Exporter mes données ». Reste recette + Damien. |
| 1.19 | Suppression du compte | Confirmation double + délai de grâce 30 jours. | Moyen | 3h | 🟢 | ✅ | **CONF-02 livré (23/07/2026).** Zone Danger + ré-auth mot de passe + délai de grâce 30 j récupérable (gate) + purge serveur `pg_cron` (cascade FK). Reste recette device + Damien. |
| 1.22 | Aide & support | FAQ + formulaire de contact / signalement de bug. | Facile | 2h | 🟢 | ✅ | **US 1.22 livré (24/07/2026).** Réglages → écran `/help` : FAQ statique embarquée (accordéon, 7 Q/R) + « Nous contacter » (mail natif) + « Signaler un bug » (mail + bloc technique). `expo-mail-composer`, zéro backend. `SUPPORT_EMAIL` placeholder + dev build requis avant recette. 🌐 bilingue FR+EN. Reste recette + Damien. |
| 9.9 | Health Connect | Écriture des séances, lecture du poids (Android). Apple Health lors du portage iOS. | Moyen | ~20h (réel — 6h sous-estimait : module natif + plugin Expo maison + 2 correctifs de recette) | 🟢 | ✅ | **Livré et recetté sur device le 28/07/2026** (US CONF-06) : écriture séances/courses, lecture du poids, opt-in, plugin Expo maison. La **déclaration Google Play** reste requise pour la **publication** (LANCE-00/01) — sans effet sur le fonctionnement en dev build. |
| 9.10 | Analytics produit first-party | Événements anonymisés, instance auto-hébergée. | Moyen | 4h | 🟢 | ✅ | **US 9.10 livré (24/07/2026).** Événements anonymisés dans notre base Supabase (`analytics_events` append-only + RLS + FK cascade), offline-first PowerSync. Consentement **opt-out** + réglage « Statistiques d'usage » + mention confidentialité. Service `track()` (allowlist anti-PII, non bloquant), 15 points instrumentés. Migration + sync rule PowerSync déployées ; **recette validée 100 % (Florian, 24/07/2026)**. Dashboards via outil BI = ultérieur. |
| 9.11 | Dynamic Type | Taille de texte selon les réglages système. | Facile | 2h | 🟢 | 🟡 | Comportement RN par défaut, **pas de gestion explicite** (`maxFontSizeMultiplier`/`fontScale`), non vérifié. |
| 9.12 | Contraste WCAG AA | Ratio minimum sur toute l'interface. | Moyen | — | 🟡 | 🟡 | Revue visuelle humaine, **aucune vérification outillée**. |

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
| 1.24 | Check-in quotidien & journal de bien-être | Humeur / énergie / stress en ~10 s le matin (+ poids), historique et courbes. 🌐 FR+EN. | Moyen | 5h | 🟢 | 🟡 | **BIEN-01 — code livré le 28/07/2026** : table `daily_wellbeing` (2 migrations poussées), briques pures testées, repository, feuille de check-in, widget transverse 3 formes, écran d'historique, i18n FR+EN, export RGPD. **4ᵉ dimension légère**, pas un 4ᵉ pilier (widget `'always'`). 🟡 et non ✅ pour deux raisons : **la sync rule PowerSync reste à déployer à la main** sur l'instance, et **la recette device n'a pas eu lieu**. Alimentera les corrélations récup ↔ perfs (post-V1). |
| 3.51 | Mensurations corporelles | Tour de taille, poitrine, bras, cuisses… historisées + courbes d'évolution, à côté du poids. | Moyen | 5h | 🟢 | ⬜ | **MESUR-01**. Fait enfin descendre **E8** de la [spec muscu §5](../specs/functional/musculation.md) — décrite au cadrage mais **jamais descendue en US**, donc sans modèle de données. Réutilise l'infra courbes du poids (4.30) et `useUnits()` (cm/in). **Photos de progression exclues** (Storage privé = sous-lot post-V1). |
| 3.52 | Suggestion de substitution d'exercice | Matériel pris ou zone douloureuse → proposer des alternatives du même groupe musculaire. | Moyen | 4h | 🟢 | ⬜ | **MUSC-F14**. Le **remplacement en direct existe déjà** (3.32) ; ce qui manque, c'est la **suggestion**. Sélection déterministe sur le groupe musculaire, aucun appel externe. |
| 3.53 | Création d'exercice perso en modale | Bottom-sheet (patron `ExerciseFilterDrawer`) au lieu de la card intercalée, segment `scrollable`, placeholder sur le nom. | Facile | 2h | 🟢 | ⬜ | **UX-02**. Remonté en **recette F10c** : la card « sandwich » entre la recherche et la liste, le sélecteur de groupe musculaire sur plusieurs lignes, le champ nom qui paraît vide. |
| 3.54 | Cohérence fiche exercice perso / bibliothèque | Mêmes sections et états vides explicites ; édition des instructions et muscles secondaires sur un exo perso. | Moyen | 3h | 🟢 | ⬜ | **UX-03**. Recette F10c : un exo perso créé sur mobile n'a **ni instructions ni muscles secondaires** (pas de saisie) → sa fiche paraît « plus vide », l'écart est **subi**, pas voulu. Modifier/Supprimer réservés au perso restent **volontaires**. |
| 3.55 | RPE ou RIR au choix | Préférence de profil : afficher l'intensité en RPE **ou** en RIR (RIR ≈ 10 − RPE), une seule donnée stockée. | Facile | 2h | 🟢 | ⬜ | **UX-05**. Évolution du RPE par série (3.34) : beaucoup de pratiquants raisonnent en *reps in reserve*. Conversion à l'affichage, pas en base. |
| 4.37 | Substitution d'aliments pour combler un macro | « il te manque 20 g de protéines → ajoute X » : suggestions puisées dans la base et les aliments récents. | Moyen | 4h | 🟢 | ⬜ | **NUTR-F2**. **Calcul local déterministe, pas d'IA** — s'appuie sur le socle macros/TDEE et le journal du jour, déjà livrés. Rend le journal *actionnable* au lieu de constatif. |
| 7.14 | Joker / gel de streak | 1 joker par mois protège la série sur un jour manqué, sans remettre le compteur à zéro. | Moyen | 3h | 🟢 | ⬜ | **STREAK-01**. Levier de rétention le plus éprouvé du marché (Duolingo) : enlève la frustration qui fait abandonner. **Reste gratuit en V1** (arbitrage D) ; la frontière premium se rediscutera post-V1. Étend le streak (V0.6), **n'ouvre pas** la boucle de jeu (arbitrage C). |
| 7.15 | Objectifs personnels à échéance | « 50 km ce mois », « +5 kg au développé d'ici 8 semaines » — anneau de progression, jalons, célébration. | Moyen | 6h | 🟢 | ⬜ | **OBJ-01**. **Non social** (les défis entre amis restent V2) et **mono-objectif** : l'objectif hybride transverse à arbitrage de compromis reste post-V1. Lit les agrégats existants. |
| 7.16 | Bilan hebdomadaire automatique | Récap poussé en notification : ce qui progresse, ce qui bloque, **une seule décision** pour la semaine à venir. | Moyen | 5h | 🟢 | ⬜ | **BILAN-01**. Format « une seule décision » plutôt que vingt graphiques. **Aucune narration sans les chiffres affichés à côté** — texte assemblé à partir de clés i18n et d'agrégats calculés localement, pas d'IA. Réutilise l'infra notifications (streak, DND). |
| 7.17 | Carte de séance / course partageable | Export image (trace GPS + stats, ou résumé muscu) pour les stories Instagram / WhatsApp. | Moyen | 4h | 🟢 | ⬜ | **PARTAGE-01**. **Partage sortant statique, zéro backend** — le feed social reste V2. Levier d'acquisition disponible dès le jour du lancement. |
| 7.18 | Réagencement du dashboard découvrable | Poignée ≥ 48 dp + `hitSlop`, appui long sur une card, retour visuel pendant le glissement. | Facile | 2h | 🟢 | ⬜ | **UX-04**. Remonté en recette (16/07/2026) : bouton en bas à gauche trop petit et peu explicite, drag qui demande trop de précision. Corrige la découvrabilité de 7.13 (widgets multi-formes). |
| 8.11 | Archivage sûr du contenu éditorial | Écran des archivés + restauration (`deleted_at → null`) + garde-fou qui compte les usages avant d'archiver. | Moyen | 4h | 🟢 | 🟡 | **ADMIN-01 — code livré le 29/07/2026** : fonction SQL `editorial_usage_counts` (security definer, admins — la RLS interdit à un admin de compter les données des autres), décompte affiché avant archivage (3 types), filtre actifs/archivés/tous et **restauration en cascade miroir** dans les 3 écrans, audit `*.restore`, import CSV qui **réactive** un aliment archivé au lieu de le mettre à jour dans l'ombre. Correctif de fond : `shared_content` ne retire plus `exercises`/`exercise_translations` archivés des appareils, et l'historique muscu + les records résolvent le nom sans filtrer `deleted_at`. 🟡 : **sync rule à redéployer à la main** + recette navigateur à faire. |
| 9.15 | Pas quotidiens (lecture Health Connect) | Lire le total de pas par jour via Health Connect, objectif de pas quotidien, widget + historique. Les pas comptent dans le streak. | Moyen | 8h | 🟢 | ✅ | **PAS-01 — livré et recetté le 28/07/2026** (recette device Florian, APK release local `r4`). Lecture par **agrégation** Health Connect (jamais la somme des records), table `daily_steps` synchronisée, objectif de pas, widget 3 formes, écran d'historique, **pas comptés dans la série** (jour actif = objectif atteint). Reste la **déclaration Play** étendue à `READ_STEPS` — prérequis de LANCE-00, sans effet en dev build. **Sommeil écarté** (décision Florian, 28/07/2026) : aucune valeur avant les analyses croisées, qui sont post-V1 → l'ajouter plus tard imposera une **re-déclaration Play**, coût accepté. Décisions actées : données **synchronisées dans le cloud** (donc politique de confidentialité et « Sécurité des données » Play à revoir — voir la spec §7) et **pas comptés dans le streak**. ⚠️ 1 type de données en plus (`READ_STEPS`) à justifier dans le **même** formulaire que CONF-06 → à figer avant LANCE-00. |

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
| 1.20 | Import de données | GPX (Strava), CSV (Hevy, Strong, MyFitnessPal). | Difficile | 8h | 🟢 | ⬜ | Clé d'adoption pour la cible "multi-apps" — à remonter en V0.8 si la bêta le réclame. |
| 4.27 | Planning repas à la semaine | Vue calendrier des repas planifiés. | Difficile | 6h | 🟢 | ⬜ | |
| 4.28 | Liste de courses générée | Tous les ingrédients depuis le planning. | Moyen | 3h | 🟢 | ⬜ | Dépend de 4.27. |
| 4.29 | Export / partage liste de courses | Message, email ou texte brut. | Facile | 1h | 🟢 | ⬜ | Dépend de 4.27. |

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
| 6.4 | Infobulle de valeur au tap sur les graphiques | Tap sur une courbe ou un histogramme → date complète + valeur exacte. | 🟢 | ✅ | UX-01 — **première idée promue depuis [IDEAS.md](../../IDEAS.md)**. Couvre les 6 surfaces graphiques via 2 composants mutualisés. |
| 7.13 | Grille de widgets multi-formes | Généralise la personnalisation du dashboard aux **3 hubs** (accueil, muscu, course) : 16 widgets × 3 formes, réordonnancement, masquage, compaction. | 🟢 | ✅ | WIDGETS-01. Chantier majeur, demande Damien d'après la maquette `FitTrio - Widgets`. |

> **Ne figurent pas dans ce tableau, volontairement** :
> - les **US d'analyse** (META-06/08/09, MN-03/06, MR-06, NUTR-10/11/17, RN-01/02, MUSC-04/05) —
>   elles sont suivies dans le [catalogue d'analyses](../product/analyses-donnees.md), leur source de
>   vérité, pour ne pas dupliquer un backlog dans l'autre ;
> - les **corrections de bugs** cadrées en US (`fix-*`) — elles vivent dans le
>   [CHANGELOG](../../CHANGELOG.md), pas dans un plan de versions.

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

**Avancement réel du code — périmètre de lancement (V0.1 → V1.1, réconcilié le 28/07/2026)** :

| Statut | Nombre | % |
|---|:---:|:---:|
| ✅ Livré | 165 | ~79 % |
| 🟡 Partiel | 11 | ~5 % |
| ⬜ À faire | 27 | ~13 % |
| ⏳ Reporté (dans le périmètre — 8.7) | 1 | — |
| ❌ Abandonné (6.1, 3.18, 6.3, 8.3 — GIF/vidéos de démo exercices) | 4 | ~2 % |
| **Total périmètre de lancement** | **208** | |
| ⏳ Reporté (section « Ultérieur — iOS » : 9.1, 1.3) | 2 | *hors décompte* |

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
| V0.1 (17) | 16 | 0 | 1 | 0 | 0 | Quasi complet (reste 9.14 RevenueCat, optionnel) |
| V0.2 (32) | 27 | 1 | 1 | 0 | 3 | **Complet côté séance** : types de séries (3.27), repos par exercice (3.28), remplacement en direct (3.32), fiche exercice (3.13) livrés par la refonte muscu. Reste 🟡 3.36 (fenêtre de reprise à réconcilier) et ⬜ 6.2 (schéma SVG) ; GIF/démo (6.1/3.18/6.3) abandonnés |
| V0.3 (21) | 15 | 3 | 3 | 0 | 0 | Reste les **3 push** (3.42, 2.4, 2.7) ; progression auto (3.7) et deload (3.8) partiels — briques livrées, non câblées. **3.1 → ✅** (bibliothèque de programmes muscu seedée, 29/07) |
| V0.4 (33) | 31 | 0 | 2 | 0 | 0 | Complet (2 notifs manquantes) |
| V0.5 (33) | 26 | 3 | 4 | 0 | 0 | Cœur GPS/carte OK, **séances guidées incomplètes** ; 🟡 = 5.9, 5.24, 5.25. **5.2 → ✅** (contenu vérifié en base le 29/07 : 3 programmes complets) |
| V0.6 (19) | 19 | 0 | 0 | 0 | 0 | **100 % livré** |
| V0.7 (10) | 8 | 0 | 0 | 1 | 1 | 8.3 (upload média) abandonné ; 8.7 reporté |
| V0.8 (9) | 7 | 2 | 0 | 0 | 0 | 🟠 **Reste-à-faire MVP1** ; 1.19 (CONF-02) + 1.18 (CONF-01) + 1.22 (aide & support) + 9.10 (analytics) + 1.2 (OAuth Google) + **9.9 (Health Connect, recetté le 28/07)** livrés ; restent les finitions accessibilité (9.11/9.12 partiels) |
| V0.9 (14) | 1 | 2 | 11 | 0 | 0 | 🆕 **Créée le 28/07/2026** — enrichissements retenus depuis [IDEAS.md](../../IDEAS.md), construits pendant les délais externes de Google. ✅ = **9.15 PAS-01** (livré et recetté le 28/07) · 🟡 = **1.24 BIEN-01** (code livré le 28/07 ; reste la sync rule PowerSync et la recette device) |
| V1.0 (1) | 0 | 0 | 1 | 0 | 0 | Publication Play Store (dépend de V0.8 **et V0.9**) |
| V1.1 (4) | 0 | 0 | 4 | 0 | 0 | Post-lancement |
| Hors cadrage (15) | 15 | 0 | 0 | 0 | 0 | **100 % livré** — refonte muscu, widgets multi-formes, micronutriments, infobulle graphiques… |

- **~208 fonctionnalités** dans le périmètre de lancement (179 du cadrage + 15 nées en cours de route + 14 de V0.9).
- **~534 h** de code brut estimées, hors intégration, tests et itérations UX — l'estimation ne couvre pas les 15 items hors cadrage.
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
  on ajoute les **pas** (`READ_STEPS`), on **écarte le sommeil**. La déclaration Play doit donc porter
  **4 types** (`WRITE_EXERCISE`, `WRITE_DISTANCE`, `READ_WEIGHT`, `READ_STEPS`) et, les pas étant
  **synchronisés dans le cloud**, la section « Sécurité des données » doit déclarer une **donnée de santé
  transmise hors de l'appareil** — ce que CONF-06 n'avait pas à déclarer.

---

## Journal des réconciliations

> Une entrée par réconciliation, la plus récente en haut. **Trois lignes maximum par entrée** — le
> détail vit dans le [CHANGELOG](../../CHANGELOG.md). Au-delà de 10 entrées, les plus anciennes
> descendent dans [docs/journal/](../journal/).

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
