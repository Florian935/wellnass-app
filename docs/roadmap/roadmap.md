# Roadmap — Wellness App (par versions)

Roadmap versionnée de référence, **adaptée aux arbitrages de cadrage du 04/07/2026**
(voir [SYNTHESE-CADRAGE.md](../../SYNTHESE-CADRAGE.md) et les [ADR](../adr/)).
Elle reprend la structure de la « Validation des Fonctionnalités » de Dams et applique les décisions actées (PowerSync, iOS reporté, monétisation inactive, bilingue FR+EN, gamification hors périmètre).

Colonne **Statut** = **avancement réel du code** (réconcilié le 18/07/2026, **tenu à jour à chaque livraison** — voir [`/commit`](../../.claude/commands/commit.md)) : ✅ Livré · 🟡 Partiel (socle présent, incomplet) · ⬜ À faire · ⏳ Reporté · ❌ Abandonné (retiré du périmètre, décision produit tracée en Remarques)
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
| **V1.0** | Lancement store | Publication Play Store (Android) | 1 | — |
| **V1.1** | Post-lancement | Import de données, planning repas, liste de courses | 4 | ~18h |
| **Ultérieur — iOS** | Portage iOS (hors lancement) | App Store + OAuth Apple | 2 | — |
| | | **Total (périmètre de lancement)** | **179** | **~477h** |

**Logique d'ordonnancement** :
- **Muscu d'abord** : cœur de valeur, zéro dépendance externe (pas de GPS, pas de clé API) — on valide vite le produit.
- **Running en dernier des piliers** : c'est le plus gros risque technique (GPS arrière-plan, batterie, écran verrouillé) — on l'aborde avec une base stable (cf. [ADR-002](../adr/ADR-002-perimetre-v1.md)).
- **Offline-first + PowerSync dès V0.1** : impossible à rétrofitter. Le SQLite local **géré par PowerSync** est posé dès le départ ; la sync cloud s'active en V0.6, mais l'architecture est prête dès V0.1. **Le spike PowerSync précède le figeage du modèle de données** (cf. [ADR-001](../adr/ADR-001-moteur-sync-offline.md)).
- **Android d'abord** : le périmètre de lancement cible le Play Store ; iOS est reporté en section dédiée (cf. [ADR-004](../adr/ADR-004-plateforme-lancement.md)).
- **Bilingue FR + EN dès le départ** : l'infra i18n et le contenu bilingue sont intégrés version par version, pas en fin de projet.
- **Admin après les piliers** : pendant le dev, le contenu (exercices, programmes) est injecté par scripts de seed ; l'admin V0.7 industrialise avant la bêta.
- **Conformité et intégrations juste avant la bêta** : OAuth Google, export/suppression RGPD et analytics doivent exister avant d'ouvrir à de vrais testeurs.

> **📊 État réel au 18/07/2026 (réconciliation code ↔ roadmap)** : les **3 piliers sont fonctionnels**, l'app tourne offline avec synchro cloud réelle, le back-office existe. **V0.6 = 100 % livrée.** Le principal reste-à-faire du lancement (MVP1 = V1.0) est **V0.8 (conformité & intégrations : RGPD, OAuth Google, support, analytics, Health) — quasi vide**, plus des **finitions muscu (V0.2 : GIF, RPE, notes de séance, pause, dernière perf…)** et **running (V0.5 : splits/km, dénivelé, séances guidées vocales)**. Voir le [Récapitulatif](#récapitulatif) pour le décompte livré / partiel / à faire.

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
| 1.6 | Récupération mot de passe | Envoi d'un lien de réinitialisation par email. | Facile | 1h | 🟢 | ✅ | Géré par Supabase Auth. |
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
| 3.13 | Bibliothèque d'exercices | Base fournie par l'app avec fiche complète par exercice. | Moyen | 4h | 🟡 | 🟡 | Liste + seed OK, mais `exercises.tsx` = simple picker, **pas de fiche complète**. Import par seed (V0.7). 🌐 fiches bilingues FR+EN. |
| 6.1 | GIF animé par exercice | Animation en boucle du mouvement correct. | Moyen | 4h | 🔴 | ❌ | **Abandonné** (décision Florian/Damien, 20/07/2026) : jugé trop complexe pour la valeur apportée (sourcing + hébergement + import en masse). `media_url` reste stocké (colonne inoffensive, non retirée) mais ne sera **jamais rendu**. Voir [[Musculation]]. |
| 3.18 | Démonstration GIF animé | GIF affiché sur la fiche exercice. | Moyen | 4h | 🟡 | ❌ | **Abandonné** avec 6.1 (dont il dépendait). |
| 6.2 | Muscles ciblés sur schéma | Corps humain SVG avec muscles travaillés en évidence. | Moyen | 4h | 🟢 | ⬜ | **Aucun composant schéma corporel.** |
| 3.14 | Recherche d'exercices | Par nom, groupe musculaire ou matériel. | Facile | 2h | 🟢 | 🟡 | Recherche **par nom uniquement** (pas groupe ni matériel). |
| 3.15 | Exercices favoris | Épingler les exercices préférés. | Facile | 1h | 🟢 | ✅ | `toggleFavorite` + tri favoris. |
| 3.16 | Exercice personnalisé | Créer un exercice custom si absent de la base. | Facile | 2h | 🟢 | ✅ | `addCustomExercise`. |
| 3.17 | Note par exercice | Champ persistant (réglage de siège, position machine), affiché en séance. | Facile | 1h | 🟢 | ⬜ | **Aucun champ note persistant par exercice.** |
| 3.19 | Muscles ciblés | Muscle principal + secondaires sur la fiche. | Facile | 2h | 🟢 | 🟡 | `muscle_primary` seul ; **pas de muscle secondaire** (colonne absente). |
| 3.20 | Variantes / alternatives | Exercices similaires pour remplacer si besoin. | Facile | 2h | 🟢 | ⬜ | **Aucune notion de variantes.** |
| 3.23 | Séance libre | Séance vide sans programme, exercices ajoutés au fil de l'eau. | Moyen | 3h | 🟢 | ✅ | Le parcours cœur de cette version. |
| 3.25 | Validation de série | Reps + charge réels, valeurs pré-remplies. | Moyen | 4h | 🟢 | ✅ | `updateSet` + pré-remplissage `addSet`. |
| 3.26 | Dernière performance affichée | "La dernière fois : 80 kg × 8 / 8 / 7" au-dessus de la saisie. | Facile | 2h | 🟢 | ⬜ | **Aucune "dernière fois : …" dans `workout.tsx`.** |
| 3.27 | Types de séries avancés | Échauffement, superset, durée (gainage), poids de corps ± lest. | Moyen | 4h | 🟢 | 🟡 | Modèle OK (`set_type` + `duration_seconds`) mais **aucune UI** pour changer le type en séance libre. |
| 3.28 | Chrono de repos automatique | Déclenché après chaque série validée. Configurable par exercice. | Facile | 2h | 🟢 | 🟡 | Repos auto présent mais **`REST_SECONDS = 90` fixe**, non configurable par exercice. |
| 3.29 | Alerte vibration fin de repos | Vibration + signal visuel. | Facile | 1h | 🟢 | ⬜ | **Aucune `Vibration` dans `workout.tsx`.** |
| 3.30 | Ajouter / supprimer une série | En cours de séance. | Facile | 1h | 🟢 | ✅ | `addSet` / `removeSet`. |
| 3.31 | Modifier charge / reps en direct | Sans quitter l'écran. | Facile | 1h | 🟢 | ✅ | `updateSet` en direct. |
| 3.32 | Remplacer un exercice en direct | Choisir une variante en séance. | Moyen | 3h | 🟢 | ⬜ | **Pas de remplacement d'exercice en séance.** |
| 3.33 | Note de séance | Champ texte libre. | Facile | 1h | 🟢 | ⬜ | `finishWorkout` accepte `notes` mais l'UI ne les collecte jamais. |
| 3.34 | Ressenti global | RPE 1-10 ou 5 étoiles en fin de séance. | Facile | 1h | 🟢 | ⬜ | `rpe` supporté en modèle mais **aucune saisie**. |
| 3.35 | Résumé fin de séance | Durée, volume, séries validées, records battus. | Moyen | 3h | 🟢 | ✅ | `workout-summary.tsx`. |
| 3.36 | Mise en pause de séance | Suspendre et reprendre dans les 4 heures. | Moyen | 3h | 🟢 | ⬜ | Statuts active/completed/cancelled seulement, **pas de pause/reprise**. |
| 3.37 | Clôture automatique après 3h | Fermeture et sauvegarde automatiques. | Facile | 1h | 🟢 | ⬜ | **Aucune logique de clôture auto 3h.** |
| 3.22 | Record personnel (1RM estimé) | Formule d'Epley : charge × (1 + reps/30). | Facile | 1h | 🟢 | ✅ | `shared/records.ts` `estimate1RM`. Motivation (arbitrage C). |
| 2.3 | Écran actif pendant séance | Pas de mise en veille pendant un suivi actif. | Facile | 1h | 🟢 | ⬜ | `keepAwake` présent **uniquement** dans `run/active.tsx`, pas en muscu. |
| 6.3 | Accès démo pendant la séance | Modal depuis l'écran de suivi, sans couper le chrono. | Facile | 1h | 🟢 | ❌ | **Abandonné avec 6.1** (décision Florian/Damien, 20/07/2026) : plus de démo à afficher. Retiré du périmètre de l'US Refonte-C3. |

---

## V0.3 — Muscu : programmes, historique & records

*Objectif : le pilier muscu complet — programmes structurés, planning, courbes de progression, notifications.*

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|:---:|---|
| 3.4 | Création programme custom | Composer son propre programme de A à Z. | Moyen | 5h | 🟢 | ✅ | `createProgram` + `programs/edit.tsx`. Le custom valide le modèle de données. |
| 3.5 | Semaine type | Groupes musculaires par jour, base du planning. | Moyen | 3h | 🟢 | ✅ | `sessions` + affectation jour. |
| 3.6 | Composition de séance | Exercices + séries / reps / charge / repos. | Moyen | 4h | 🟢 | ✅ | `exercise_plans` + `SessionEditor`. |
| 3.1 | Bibliothèque de programmes | Catalogue pré-conçu (PPL, Full Body, 5×5…). | Moyen | 4h | 🟡 | 🟡 | Écran + filtres OK mais **aucun seed de programmes** (catalogue vide). 🌐 bilingues FR+EN. |
| 3.2 | Filtres bibliothèque | Objectif, niveau, durée, équipement. | Facile | 2h | 🟢 | ✅ | `useProgramLibrary(filters)`. |
| 3.3 | Dupliquer un programme | Copier pour personnaliser sans toucher l'original. | Facile | 1h | 🟢 | ✅ | `duplicateProgram`. |
| 3.12 | Un programme actif à la fois | Activer un programme désactive le précédent (historique conservé). | Facile | 1h | 🟢 | ✅ | `activateProgram` (un actif par pilier). |
| 3.9 | Planning calendrier auto | Séances placées automatiquement après activation. | Moyen | 4h | 🟢 | ✅ | `planProgram`. |
| 3.10 | Décalage de séance | Glisser-déposer vers un autre jour. | Moyen | 3h | 🟢 | 🟡 | `reschedulePlannedSession` par action, **pas de glisser-déposer**. |
| 3.11 | Gestion séance manquée | Reporter ou sauter. | Facile | 2h | 🟢 | ✅ | `skip` + `reschedule` + `useMissedSessions`. |
| 3.24 | Plan de séance avant démarrage | Récap des exercices prévus avec cibles. | Facile | 2h | 🟢 | ✅ | `programs/[id].tsx`. |
| 3.7 | Progression automatique | Charge cible +X d'une semaine à l'autre (si ≥ 80 % complété). | Moyen | 3h | 🟢 | ⬜ | **Aucune logique de progression automatique de charge.** |
| 3.8 | Deload / gestion de stagnation | Échec 2 semaines de suite → proposition −10 %. Jamais imposé. | Moyen | 3h | 🟢 | ⬜ | **Aucune logique de deload/stagnation.** |
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
| 5.26 | Tableau pace par km | Allure de chaque kilomètre. | Moyen | 3h | 🟢 | ⬜ | **Aucune logique de splits par km.** |
| 5.1 | Profil coureur | Objectif, niveau, allure de référence, fréquence. | Facile | 2h | 🟢 | ✅ | `running-profile.tsx`. |
| 5.8 | Endurance fondamentale | Allure de réf. + 60-90 s/km. Base aérobie. | Facile | 1h | 🟢 | ✅ | `sessionTargetPace('endurance')`. |
| 5.9 | Fractionné / intervalles | Blocs rapides / récupération (ex. 6×400 m à 95 % VMA). | Moyen | 4h | 🟢 | 🟡 | Type + plage d'allure seulement ; **pas de blocs rapide/récup structurés**. |
| 5.10 | Sortie longue | Allure de réf. + 30-60 s/km. +10 % max par semaine. | Facile | 1h | 🟢 | ✅ | `sessionTargetPace('sortie_longue')`. |
| 5.11 | Récupération active | Allure de réf. + 90 s/km ou plus, 20-30 min. | Facile | 1h | 🟢 | ✅ | `sessionTargetPace('recuperation')`. |
| 5.18 | Guidage fractionné vocal | Annonce vocale + vibration à chaque changement de bloc. | Moyen | 4h | 🟢 | ⬜ | **Aucune trace** (dépend de blocs + Speech, absents). |
| 5.4 | Création programme custom | Plan de course semaine par semaine. | Moyen | 4h | 🟢 | ✅ | `running-programs/edit.tsx`. |
| 5.2 | Bibliothèque programmes de course | "5 km en 8 semaines", "Prépa semi"… | Moyen | 4h | 🟡 | 🟡 | Écran + filtres OK, **contenu seed à vérifier**. 🌐 bilingues FR+EN. |
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
| 1.2 | Connexion via Google | OAuth Google. | Moyen | 3h | 🟡 | ⬜ | `sign-in.tsx` = email/mdp seul ; aucun `signInWithOAuth`. Clé OAuth Google à fournir. **Conservé** (arbitrage E). |
| 1.17 | Gestion des notifications | Activation / désactivation par type. | Facile | 2h | 🟢 | ✅ | Section Notifications de `settings.tsx`. |
| 1.18 | Export des données | JSON ou CSV (obligation RGPD). | Moyen | 4h | 🟢 | ⬜ | **Aucune trace.** Obligation RGPD. |
| 1.19 | Suppression du compte | Confirmation double + délai de grâce 30 jours. | Moyen | 3h | 🟢 | ⬜ | **Aucune trace** (settings n'a que `signOut`). **Exigé par les stores.** |
| 1.22 | Aide & support | FAQ + formulaire de contact / signalement de bug. | Facile | 2h | 🟢 | ⬜ | **Aucun écran FAQ/contact.** 🌐 bilingue FR+EN. |
| 9.9 | Health Connect | Écriture des séances, lecture du poids (Android). Apple Health lors du portage iOS. | Moyen | 6h | 🟢 | ⬜ | **Aucune trace.** Health Connect API. |
| 9.10 | Analytics produit first-party | Événements anonymisés, instance auto-hébergée. | Moyen | 4h | 🟢 | ⬜ | **Aucune trace.** **Avant la bêta** — sinon aucune mesure des testeurs. Alimente la décision gamification V3/V4. |
| 9.11 | Dynamic Type | Taille de texte selon les réglages système. | Facile | 2h | 🟢 | 🟡 | Comportement RN par défaut, **pas de gestion explicite** (`maxFontSizeMultiplier`/`fontScale`), non vérifié. |
| 9.12 | Contraste WCAG AA | Ratio minimum sur toute l'interface. | Moyen | — | 🟡 | 🟡 | Revue visuelle humaine, **aucune vérification outillée**. |

---

## V1.0 — Lancement store

*Objectif : publication publique **sur Android**. Le gros du travail est de la validation (review Google), pas du code. **iOS reporté** (arbitrage E). **= MVP1 complet.***

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|:---:|---|
| 9.2 | App Android | Publication Play Store via Expo EAS Build. | Difficile | — | 🟡 | ⬜ | Compte Google Play + review. **Plateforme de lancement** (arbitrage E). Dépend de V0.8. |

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

**Avancement réel du code — périmètre de lancement (V0.1 → V1.1, réconcilié le 18/07/2026)** :

| Statut | Nombre | % |
|---|:---:|:---:|
| ✅ Livré | 127 | ~71 % |
| 🟡 Partiel | 12 | ~7 % |
| ⬜ À faire | 35 | ~20 % |
| ⏳ Reporté (dans le périmètre — 8.7) | 1 | — |
| ❌ Abandonné (6.1, 3.18, 6.3, 8.3 — GIF/vidéos de démo exercices) | 4 | ~2 % |
| **Total périmètre de lancement** | **179** | |
| ⏳ Reporté (section « Ultérieur — iOS » : 9.1, 1.3) | 2 | *hors décompte* |

**Détail par version** (✅ / 🟡 / ⬜ / ⏳ / ❌) :

| Version | ✅ Livré | 🟡 Partiel | ⬜ À faire | ⏳ Reporté | ❌ Abandonné | État |
|---|:---:|:---:|:---:|:---:|:---:|---|
| V0.1 (17) | 16 | 0 | 1 | 0 | 0 | Quasi complet (reste 9.14 RevenueCat, optionnel) |
| V0.2 (32) | 13 | 5 | 11 | 0 | 3 | Cœur OK, **grosses finitions** (RPE, notes, pause…) ; GIF/démo (6.1/3.18/6.3) abandonnés |
| V0.3 (21) | 14 | 2 | 5 | 0 | 0 | Quasi complet (progression auto/deload + push manquants) |
| V0.4 (33) | 31 | 0 | 2 | 0 | 0 | Complet (2 notifs manquantes) |
| V0.5 (33) | 25 | 3 | 5 | 0 | 0 | Cœur GPS/carte OK, **séances guidées incomplètes** |
| V0.6 (19) | 19 | 0 | 0 | 0 | 0 | **100 % livré** |
| V0.7 (10) | 8 | 0 | 0 | 1 | 1 | 8.3 (upload média) abandonné ; 8.7 reporté |
| V0.8 (9) | 1 | 2 | 6 | 0 | 0 | 🔴 **Quasi vide — reste-à-faire clé du MVP1** |
| V1.0 (1) | 0 | 0 | 1 | 0 | 0 | Publication Play Store (dépend de V0.8) |
| V1.1 (4) | 0 | 0 | 4 | 0 | 0 | Post-lancement |

- **~179 fonctionnalités** dans le périmètre de lancement.
- **~477 h** de code brut, hors intégration, tests et itérations UX — prévoir une marge significative sur l'offline-first, le GPS et l'import de données.
- **+ 2 items reportés** en section « Ultérieur — iOS » (9.1, 1.3).

Autonomie Claude (périmètre de lancement) : 🟢 Full auto ≈ 167 · 🟡 Semi-auto ≈ 10 · 🔴 Humain requis ≈ 2 (9.13 PowerSync/dev build [livré], 4.8 base d'aliments [livré]).

**Décisions bloquantes à prendre en amont de leur version** :
- ~~avant **V0.1** → confirmer **PowerSync**~~ → **tranché & livré** (spike-001, ADR-001).
- ~~avant **V0.2** → source des GIF d'exercices (6.1)~~ → **tranché : abandonné** (Florian/Damien, 20/07/2026) —
  jugé trop complexe pour la valeur apportée ; 6.1/3.18/6.3/8.3 retirés du périmètre.
- ~~avant **V0.4** → source de la base d'aliments (4.8)~~ → **tranché & livré** : CIQUAL + OpenFoodFacts.
- ~~avant **V0.5** → fournisseur de cartes (5.17)~~ → **tranché : MapLibre + MapTiler** (ADR-006, 11/07/2026).
- avant **V0.8** → clé OAuth Google, textes CGU / confidentialité (rédaction dès que possible, relecture juridique). **OAuth Apple n'est plus bloquant** (reporté avec iOS).

---

*Dernière mise à jour : 18/07/2026 — colonne Statut renseignée par réconciliation code ↔ roadmap (avancement réel). Structure adaptée aux arbitrages de cadrage (PowerSync, Android d'abord, RevenueCat inactif, bilingue FR+EN, gamification V3/V4).*
