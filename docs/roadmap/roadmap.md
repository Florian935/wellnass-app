# Roadmap — Wellness App (par versions)

Roadmap versionnée de référence, **adaptée aux arbitrages de cadrage du 04/07/2026**
(voir [SYNTHESE-CADRAGE.md](../../SYNTHESE-CADRAGE.md) et les [ADR](../adr/)).
Elle reprend la structure de la « Validation des Fonctionnalités » de Dams et applique les décisions actées (PowerSync, iOS reporté, monétisation inactive, bilingue FR+EN, gamification hors périmètre).

Colonne **Statut** : ✅ Validé · ❌ Refusé · 🔄 À modifier · ⏳ Reporté
**Autonomie Claude** : 🟢 Full auto (Claude seul) · 🟡 Semi (validation humaine requise) · 🔴 Humain requis (décision, data externe, clé API…)

> Les numéros (1.x compte, 2.x navigation/UX, 3.x muscu, 4.x alim, 5.x running, 6.x visualisation, 7.x dashboard, 8.x admin, 9.x technique) sont **thématiques** et stables — ils ne changent pas quand une fonctionnalité change de version. Les tâches ajoutées par les arbitrages portent un identifiant `9.x` explicite.
> Chaque développement suit les standards de [[Bonnes Pratiques Techniques]] (dont la Definition of Done, qui conditionne le passage d'une fonctionnalité à ✅).

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

---

## V0.1 — Socle technique & compte

*Objectif : une app qui démarre, avec compte, navigation et stockage local géré par PowerSync. Rien de sexy, tout est fondation. **Le spike PowerSync conditionne le modèle de données** — à mener avant de figer les tables.*

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|---|---|
| 9.13 | **Dev build Expo + intégration PowerSync** *(nouvel item — arbitrage B)* | Dev build Expo (Expo Go insuffisant, module natif). Intégration du SDK PowerSync : SQLite local géré par PowerSync + connecteur Supabase. | Difficile | 8h | 🔴 | | **À poser en tout premier.** Conditionne le modèle de données — voir [spike-001-powersync](../specs/technical/spike-001-powersync.md) et [ADR-001](../adr/ADR-001-moteur-sync-offline.md). |
| 9.3 | Stockage local SQLite (PowerSync) *(reformulé — arbitrage B)* | Toutes les données écrites localement en priorité dans le **SQLite local géré par PowerSync**. L'app fonctionne sans connexion. | Difficile | 6h | 🟢 | | Fondation offline-first, posée sur PowerSync (9.13) au lieu d'un SQLite maison. |
| 2.11 | Fonctionnement hors-ligne | Toutes les fonctions (saisie, suivi, consultation) marchent sans connexion. | Difficile | 8h | 🟢 | | Principe transverse appliqué à chaque feature dès V0.1. |
| 1.1 | Inscription email + mot de passe | Création de compte avec identifiants classiques. Email vérifié avant accès complet. | Facile | 2h | 🟢 | | |
| 1.4 | Vérification email obligatoire | Lien envoyé par email, compte bloqué tant que non vérifié. | Facile | 1h | 🟢 | | Géré par Supabase Auth. |
| 1.5 | Session persistante | Pas de reconnexion à chaque ouverture. Token rafraîchi silencieusement. | Facile | 2h | 🟢 | | |
| 1.6 | Récupération mot de passe | Envoi d'un lien de réinitialisation par email. | Facile | 1h | 🟢 | | Géré par Supabase Auth. |
| 9.5 | Authentification JWT | Token court (accès) + token long (refresh). Renouvellement silencieux. | Moyen | 4h | 🟢 | | Géré par Supabase Auth. |
| 9.6 | Isolation données utilisateur | Row Level Security — chaque utilisateur n'accède qu'à ses données. | Moyen | 3h | 🟢 | | |
| 9.8 | Chiffrement tokens | Android Keystore (iOS Keychain lors du portage). Jamais en clair. | Moyen | 2h | 🟢 | | |
| 9.14 | **Câblage RevenueCat / entitlements (inactif)** *(nouvel item optionnel — arbitrage D)* | SDK RevenueCat intégré, entitlements multi-paliers définis (Premium muscu → Écosystème → IA), **laissés inactifs**. **Aucun écran de paiement, aucun paywall.** | Facile | 2h | 🟡 | | Optionnel. Peu coûteux posé tôt, évite une refonte — voir [ADR-003](../adr/ADR-003-monetisation.md). |
| 1.21 | Écrans légaux & consentement | CGU + politique de confidentialité acceptées à l'inscription. Âge minimum 16 ans (RGPD). | Facile | 2h | 🟡 | | Textes juridiques à fournir / faire relire. 🌐 bilingue FR+EN. |
| 2.1 | Bottom tab bar 4 onglets | Navigation principale : Accueil / Muscu / Running / Alim. | Facile | 2h | 🟢 | | Onglets vides au début, remplis version après version. |
| 2.2 | Masquage onglets non activés | Si running non activé, son onglet disparaît. Réactivable depuis les paramètres. | Facile | 1h | 🟢 | | |
| 1.15 | Unités métrique / impérial | Bascule kg/km ↔ lbs/miles. S'applique à toute l'app. | Facile | 2h | 🟢 | | À poser tôt : impacte tous les affichages suivants. |
| 1.16 | Thème clair / sombre / système | Apparence de l'app. "Système" suit le réglage OS. | Facile | 2h | 🟢 | | |
| 2.10 | États vides soignés | Chaque écran sans données affiche explication + CTA. Jamais de graphique vide. | Facile | 3h | 🟢 | | Principe continu — appliqué à chaque nouvelle feature. |

> **🌐 i18n (arbitrage G)** : l'infra i18n est posée dès V0.1 (aucune chaîne en dur) **et** le contenu s'écrit bilingue FR + EN au fil des versions — voir la note 🌐 sur les items à contenu éditorial.

---

## V0.2 — Muscu : exercices & séance libre

*Objectif : la première vraie valeur utilisateur — faire une séance de muscu complète et l'enregistrer. La séance libre d'abord (aucune dépendance aux programmes).*

| #    | Fonctionnalité                   | Description                                                               | Difficulté | Temps | Autonomie Claude | Statut | Remarques                                                                            |
| ---- | -------------------------------- | ------------------------------------------------------------------------- | :--------: | :---: | :--------------: | ------ | ------------------------------------------------------------------------------------ |
| 1.7  | Onboarding — Infos de base       | Prénom, âge, poids, taille au premier lancement. **Skippable** (bouton « Passer »). |   Facile   |  3h   |        🟢        |        | Onboarding minimal par défaut (arbitrage F).                                          |
| 1.8  | Onboarding — Piliers actifs      | Choix des modules à activer. **Skippable.**                              |   Facile   |  2h   |        🟢        |        |                                                                                      |
| 1.9  | Onboarding — Objectif principal  | Masse / sèche / performance / santé. **Skippable.**                      |   Facile   |  2h   |        🟢        |        |                                                                                      |
| 1.11 | Onboarding — Récapitulatif       | Résumé des choix + suggestion d'une première action.                      |   Facile   |  1h   |        🟢        |        | S'enrichit en V0.4 (TDEE).                                                            |
| 1.12 | Modification du profil           | Mise à jour des données utilisateur depuis les paramètres.                |   Facile   |  2h   |        🟢        |        | Toute la config reste modifiable après onboarding.                                    |
| 3.13 | Bibliothèque d'exercices         | Base fournie par l'app avec fiche complète par exercice.                  |   Moyen    |  4h   |        🟡        |        | Import par script de seed en attendant l'admin (V0.7). 🌐 fiches bilingues FR+EN.     |
| 6.1  | GIF animé par exercice           | Animation en boucle du mouvement correct.                                 |   Moyen    |  4h   |        🔴        |        | **Décision bloquante V0.2** : exercises-dataset ou ExerciseDB — voir [[Musculation]]. |
| 3.18 | Démonstration GIF animé          | GIF affiché sur la fiche exercice.                                        |   Moyen    |  4h   |        🟡        |        | Dépend de 6.1.                                                                        |
| 6.2  | Muscles ciblés sur schéma        | Corps humain SVG avec muscles travaillés en évidence.                     |   Moyen    |  4h   |        🟢        |        |                                                                                      |
| 3.14 | Recherche d'exercices            | Par nom, groupe musculaire ou matériel.                                   |   Facile   |  2h   |        🟢        |        |                                                                                      |
| 3.15 | Exercices favoris                | Épingler les exercices préférés.                                          |   Facile   |  1h   |        🟢        |        |                                                                                      |
| 3.16 | Exercice personnalisé            | Créer un exercice custom si absent de la base.                            |   Facile   |  2h   |        🟢        |        |                                                                                      |
| 3.17 | Note par exercice                | Champ persistant (réglage de siège, position machine), affiché en séance. |   Facile   |  1h   |        🟢        |        |                                                                                      |
| 3.19 | Muscles ciblés                   | Muscle principal + secondaires sur la fiche.                              |   Facile   |  2h   |        🟢        |        |                                                                                      |
| 3.20 | Variantes / alternatives         | Exercices similaires pour remplacer si besoin.                            |   Facile   |  2h   |        🟢        |        |                                                                                      |
| 3.23 | Séance libre                     | Séance vide sans programme, exercices ajoutés au fil de l'eau.            |   Moyen    |  3h   |        🟢        |        | Le parcours cœur de cette version.                                                    |
| 3.25 | Validation de série              | Reps + charge réels, valeurs pré-remplies.                                |   Moyen    |  4h   |        🟢        |        |                                                                                      |
| 3.26 | Dernière performance affichée    | "La dernière fois : 80 kg × 8 / 8 / 7" au-dessus de la saisie.            |   Facile   |  2h   |        🟢        |        |                                                                                      |
| 3.27 | Types de séries avancés          | Échauffement, superset, durée (gainage), poids de corps ± lest.           |   Moyen    |  4h   |        🟢        |        | Modèle de données à prévoir dès maintenant (contraintes PowerSync).                   |
| 3.28 | Chrono de repos automatique      | Déclenché après chaque série validée. Configurable par exercice.          |   Facile   |  2h   |        🟢        |        |                                                                                      |
| 3.29 | Alerte vibration fin de repos    | Vibration + signal visuel.                                                |   Facile   |  1h   |        🟢        |        |                                                                                      |
| 3.30 | Ajouter / supprimer une série    | En cours de séance.                                                       |   Facile   |  1h   |        🟢        |        |                                                                                      |
| 3.31 | Modifier charge / reps en direct | Sans quitter l'écran.                                                     |   Facile   |  1h   |        🟢        |        |                                                                                      |
| 3.32 | Remplacer un exercice en direct  | Choisir une variante en séance.                                           |   Moyen    |  3h   |        🟢        |        |                                                                                      |
| 3.33 | Note de séance                   | Champ texte libre.                                                        |   Facile   |  1h   |        🟢        |        |                                                                                      |
| 3.34 | Ressenti global                  | RPE 1-10 ou 5 étoiles en fin de séance.                                   |   Facile   |  1h   |        🟢        |        |                                                                                      |
| 3.35 | Résumé fin de séance             | Durée, volume, séries validées, records battus.                           |   Moyen    |  3h   |        🟢        |        |                                                                                      |
| 3.36 | Mise en pause de séance          | Suspendre et reprendre dans les 4 heures.                                 |   Moyen    |  3h   |        🟢        |        |                                                                                      |
| 3.37 | Clôture automatique après 3h     | Fermeture et sauvegarde automatiques.                                     |   Facile   |  1h   |        🟢        |        |                                                                                      |
| 3.22 | Record personnel (1RM estimé)    | Formule d'Epley : charge × (1 + reps/30).                                 |   Facile   |  1h   |        🟢        |        | Motivation (conservé — arbitrage C).                                                  |
| 2.3  | Écran actif pendant séance       | Pas de mise en veille pendant un suivi actif.                             |   Facile   |  1h   |        🟢        |        | `keepAwake` Expo.                                                                     |
| 6.3  | Accès démo pendant la séance     | Modal depuis l'écran de suivi, sans couper le chrono.                     |   Facile   |  1h   |        🟢        |        |                                                                                      |

---

## V0.3 — Muscu : programmes, historique & records

*Objectif : le pilier muscu complet — programmes structurés, planning, courbes de progression, notifications.*

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|---|---|
| 3.4 | Création programme custom | Composer son propre programme de A à Z. | Moyen | 5h | 🟢 | | Avant la bibliothèque : le custom valide le modèle de données. |
| 3.5 | Semaine type | Groupes musculaires par jour, base du planning. | Moyen | 3h | 🟢 | | |
| 3.6 | Composition de séance | Exercices + séries / reps / charge / repos. | Moyen | 4h | 🟢 | | |
| 3.1 | Bibliothèque de programmes | Catalogue pré-conçu (PPL, Full Body, 5×5…). | Moyen | 4h | 🟡 | | Contenu par script de seed, industrialisé en V0.7. 🌐 programmes bilingues FR+EN. |
| 3.2 | Filtres bibliothèque | Objectif, niveau, durée, équipement. | Facile | 2h | 🟢 | | |
| 3.3 | Dupliquer un programme | Copier pour personnaliser sans toucher l'original. | Facile | 1h | 🟢 | | |
| 3.12 | Un programme actif à la fois | Activer un programme désactive le précédent (historique conservé). | Facile | 1h | 🟢 | | |
| 3.9 | Planning calendrier auto | Séances placées automatiquement après activation. | Moyen | 4h | 🟢 | | |
| 3.10 | Décalage de séance | Glisser-déposer vers un autre jour. | Moyen | 3h | 🟢 | | |
| 3.11 | Gestion séance manquée | Reporter ou sauter. | Facile | 2h | 🟢 | | |
| 3.24 | Plan de séance avant démarrage | Récap des exercices prévus avec cibles. | Facile | 2h | 🟢 | | |
| 3.7 | Progression automatique | Charge cible +X d'une semaine à l'autre (si ≥ 80 % complété). | Moyen | 3h | 🟢 | | |
| 3.8 | Deload / gestion de stagnation | Échec 2 semaines de suite → proposition −10 %. Jamais imposé. | Moyen | 3h | 🟢 | | |
| 3.38 | Historique des séances | Liste chronologique filtrable. | Moyen | 3h | 🟢 | | Journal horodaté = base d'une future couche jeu (arbitrage C). |
| 3.39 | Courbes charge / volume | Évolution par exercice sur différentes périodes. | Moyen | 4h | 🟢 | | |
| 3.21 | Courbe de progression par exercice | Charge max / volume sur 30 / 90 j / 1 an. | Moyen | 4h | 🟢 | | |
| 3.40 | Volume par groupe musculaire | Séries par groupe sur la semaine — détecte les déséquilibres. | Moyen | 3h | 🟢 | | Hors séries d'échauffement. |
| 3.41 | Alerte déséquilibre musculaire | Si un groupe très sous-sollicité sur 2 semaines. | Moyen | 3h | 🟢 | | |
| 3.42 | Notification nouveau record | Push + animation quand un record est battu. | Facile | 2h | 🟢 | | Notification de célébration (conservée — arbitrage C). |
| 2.4 | Notif — Rappel séance | Push 30 min avant une séance planifiée. | Moyen | 3h | 🟢 | | |
| 2.7 | Notif — Nouveau record | Push immédiat. | Facile | 1h | 🟢 | | |

---

## V0.4 — Alimentation

*Objectif : journal alimentaire complet, sans friction de saisie, avec TDEE et lien vers l'entraînement.*

| #    | Fonctionnalité                     | Description                                               | Difficulté | Temps | Autonomie Claude | Statut | Remarques                                                                     |
| ---- | ---------------------------------- | --------------------------------------------------------- | :--------: | :---: | :--------------: | ------ | ----------------------------------------------------------------------------- |
| 1.10 | Onboarding — Suivi alimentaire     | Activer ou non le module nutrition. **Skippable.**        |   Facile   |  1h   |        🟢        |        |                                                                               |
| 4.8  | Base d'aliments fournie            | Catalogue avec valeurs pour 100 g.                        |   Moyen    |  4h   |        🔴        |        | **Décision bloquante V0.4** : CIQUAL (bruts FR) + OpenFoodFacts (industriels). 🌐 **traduction EN de la base CIQUAL incluse au périmètre** (arbitrage G). |
| 4.1  | Calcul TDEE automatique            | Mifflin-St Jeor + facteur d'activité.                     |   Facile   |  2h   |        🟢        |        |                                                                               |
| 4.2  | Facteur d'activité paramétrable    | 5 niveaux, s'adapte au planning.                          |   Facile   |  1h   |        🟢        |        |                                                                               |
| 4.3  | Ajustement manuel de l'objectif    | Objectif calorique libre.                                 |   Facile   |  1h   |        🟢        |        |                                                                               |
| 4.4  | Répartition macros par défaut      | Ratios P/G/L selon l'objectif.                            |   Facile   |  2h   |        🟢        |        |                                                                               |
| 4.5  | Modification manuelle des macros   | En grammes ou %, vues synchronisées.                      |   Facile   |  2h   |        🟢        |        |                                                                               |
| 4.6  | Restrictions / allergènes          | Végétarien, vegan, sans gluten, halal, allergènes.        |   Facile   |  2h   |        🟢        |        |                                                                               |
| 4.7  | Calories adaptées à l'entraînement | Objectif plus élevé les jours de séance.                  |   Moyen    |  3h   |        🟢        |        | Utilise le planning muscu (V0.3) — intégration inter-piliers.                 |
| 4.9  | Recherche par nom                  | Suggestions en temps réel.                                |   Facile   |  2h   |        🟢        |        |                                                                               |
| 4.10 | Scan code-barres                   | EAN via caméra.                                           |   Moyen    |  3h   |        🟢        |        | Expo Camera / BarCodeScanner.                                                 |
| 4.11 | Import OpenFoodFacts               | Recherche auto si code-barres absent en local.            |   Moyen    |  4h   |        🟢        |        | API publique, pas de clé.                                                     |
| 4.12 | Aliments favoris / récents         | Accès rapide aux aliments fréquents.                      |   Facile   |  1h   |        🟢        |        |                                                                               |
| 4.13 | Aliment personnalisé               | Valeurs libres si non trouvé en base.                     |   Facile   |  2h   |        🟢        |        |                                                                               |
| 4.14 | Journal quotidien — 4 repas        | Petit-déj / Déjeuner / Dîner / Collation. Renommables.    |   Moyen    |  4h   |        🟢        |        |                                                                               |
| 4.15 | Ajout / suppression de repas       | 5e repas ou suppression.                                  |   Facile   |  1h   |        🟢        |        |                                                                               |
| 4.16 | Ajout aliment + quantité           | Rechercher, saisir la quantité, valider.                  |   Facile   |  2h   |        🟢        |        |                                                                               |
| 4.17 | Portions usuelles                  | "1 œuf = 60 g" — portion par défaut, grammes disponibles. |   Moyen    |  3h   |        🟢        |        | Anti-friction n°1.                                                            |
| 4.18 | Copier un repas / une journée      | Dupliquer un repas ou une journée en 2 taps.              |   Facile   |  2h   |        🟢        |        |                                                                               |
| 4.19 | Quick add calories                 | Calories directes sans recherche d'aliment.               |   Facile   |  1h   |        🟢        |        |                                                                               |
| 4.20 | Total calories + macros temps réel | Compteur instantané à chaque ajout.                       |   Facile   |  2h   |        🟢        |        |                                                                               |
| 4.21 | Barres de progression macros       | Jauges P / G / L vers l'objectif du jour.                 |   Facile   |  2h   |        🟢        |        |                                                                               |
| 4.22 | Navigation entre les jours         | ◀ / ▶ entre les journaux.                                 |   Facile   |  1h   |        🟢        |        |                                                                               |
| 4.23 | Saisie rétroactive                 | Journal passé modifiable sans limite.                     |   Facile   |  1h   |        🟢        |        |                                                                               |
| 4.24 | Création de recette                | Plusieurs ingrédients + nombre de portions.               |   Moyen    |  3h   |        🟢        |        |                                                                               |
| 4.25 | Valeurs nutritionnelles calculées  | Macros totales et par portion automatiques.               |   Facile   |  1h   |        🟢        |        |                                                                               |
| 4.26 | Repas types (templates)            | Réutiliser un repas entier en 1 tap.                      |   Facile   |  2h   |        🟢        |        |                                                                               |
| 1.13 | Historique poids corporel          | Pesées enregistrées et affichées en courbe.               |   Facile   |  3h   |        🟢        |        |                                                                               |
| 1.14 | Rappel de pesée                    | Notification optionnelle à heure fixe.                    |   Facile   |  1h   |        🟢        |        |                                                                               |
| 4.30 | Courbe poids corporel              | Évolution sur 4 sem / 3 mois / 1 an.                      |   Moyen    |  3h   |        🟢        |        |                                                                               |
| 4.31 | Évolution apports moyens           | Calories et macros moyennes 7 / 30 jours.                 |   Moyen    |  3h   |        🟢        |        |                                                                               |
| 4.32 | Alerte déficit + fort volume       | Déficit important + semaine à fort volume muscu.          |   Moyen    |  2h   |        🟢        |        | Première stat croisée entre piliers.                                          |
| 2.5  | Notif — Rappel repas               | Push à heure définie.                                     |   Facile   |  1h   |        🟢        |        |                                                                               |

---

## V0.5 — Running

*Objectif : le pilier au plus gros risque technique (GPS arrière-plan, batterie, écran verrouillé) — abordé une fois la base stable. Commencer par 5.12-5.16 : le tracker GPS nu, à valider sur le terrain avant le reste. Valider aussi tôt la tenue de PowerSync sur les traces GPS volumineuses.*

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|---|---|
| 5.13 | Démarrage GPS + chrono | GPS + chronomètre d'un tap. Compte à rebours optionnel. | Moyen | 3h | 🟢 | | Expo Location — valider le tracking arrière-plan en premier. |
| 5.12 | Course libre | Sans séance planifiée ni structure de blocs. | Facile | 1h | 🟢 | | |
| 5.14 | Distance parcourue en temps réel | Kilomètres en grand, mis à jour en continu. | Moyen | 3h | 🟢 | | |
| 5.15 | Allure instantanée et moyenne | Dernière minute glissante + moyenne depuis le départ. | Moyen | 3h | 🟢 | | |
| 5.16 | Auto-pause | Pause auto à l'arrêt, reprise auto. Désactivable. | Moyen | 2h | 🟢 | | |
| 5.22 | Mise en pause / reprise | Pause manuelle (GPS + chrono). | Moyen | 2h | 🟢 | | |
| 5.20 | Écran verrouillé | Notification persistante (Android). Live Activity iOS lors du portage. | Difficile | 6h | 🟢 | | Indispensable en course réelle. Rester cross-platform (arbitrage E). |
| 5.17 | Carte du parcours en direct | Tracé GPS pendant et après la course. | Difficile | 6h | 🟡 | | Clé Mapbox ou MapLibre + tuiles. |
| 5.21 | Mode sans GPS | Suivi à la durée seule (streak + historique, exclu des records). | Facile | 2h | 🟢 | | Couvre aussi le tapis. |
| 5.19 | Annonces audio périodiques | À chaque km (paramétrable) : distance, temps, allure. | Facile | 2h | 🟢 | | |
| 5.23 | Prolonger ou raccourcir | Terminer avant la cible ou continuer en libre. | Facile | 1h | 🟢 | | |
| 5.24 | Note + ressenti post-séance | RPE, météo, terrain. | Facile | 2h | 🟢 | | |
| 5.25 | Résumé post-séance | Distance, durée, allure, carte, dénivelé, comparaison objectif. | Moyen | 4h | 🟢 | | |
| 5.26 | Tableau pace par km | Allure de chaque kilomètre. | Moyen | 3h | 🟢 | | |
| 5.1 | Profil coureur | Objectif, niveau, allure de référence, fréquence. | Facile | 2h | 🟢 | | FC optionnelle — cibles en allure en V1. |
| 5.8 | Endurance fondamentale | Allure de réf. + 60-90 s/km. Base aérobie. | Facile | 1h | 🟢 | | |
| 5.9 | Fractionné / intervalles | Blocs rapides / récupération (ex. 6×400 m à 95 % VMA). | Moyen | 4h | 🟢 | | |
| 5.10 | Sortie longue | Allure de réf. + 30-60 s/km. +10 % max par semaine. | Facile | 1h | 🟢 | | |
| 5.11 | Récupération active | Allure de réf. + 90 s/km ou plus, 20-30 min. | Facile | 1h | 🟢 | | |
| 5.18 | Guidage fractionné vocal | Annonce vocale + vibration à chaque changement de bloc. | Moyen | 4h | 🟢 | | Expo Speech. |
| 5.4 | Création programme custom | Plan de course semaine par semaine. | Moyen | 4h | 🟢 | | |
| 5.2 | Bibliothèque programmes de course | "5 km en 8 semaines", "Prépa semi"… | Moyen | 4h | 🟡 | | Contenu par script de seed, industrialisé en V0.7. 🌐 programmes bilingues FR+EN. |
| 5.3 | Filtres bibliothèque | Objectif distance, niveau, durée. | Facile | 1h | 🟢 | | |
| 5.5 | Planning calendrier running | Séances placées automatiquement. | Moyen | 3h | 🟢 | | |
| 5.6 | Coordination muscu + running | Alerte si deux séances le même jour. | Facile | 2h | 🟢 | | Intégration inter-piliers. |
| 5.7 | Gestion séance manquée | Reporter ou sauter. | Facile | 1h | 🟢 | | |
| 5.27 | Historique séances avec carte | Liste + détail complet + carte. | Moyen | 4h | 🟢 | | |
| 5.28 | Statistiques distance | Semaine / mois / depuis le début. | Facile | 2h | 🟢 | | |
| 5.29 | Courbe d'allure moyenne | Sur 30 / 90 jours par type de séance. | Moyen | 3h | 🟢 | | |
| 5.30 | Records personnels | 1 / 5 / 10 km / semi / marathon — meilleur segment glissant. | Moyen | 3h | 🟢 | | Motivation (conservé — arbitrage C). |
| 5.31 | Mise à jour allure de référence | Auto si record 5 km battu. | Facile | 1h | 🟢 | | |
| 5.32 | Dénivelé cumulé | Dénivelé positif par semaine / mois. | Moyen | 2h | 🟢 | | |
| 5.33 | Export GPX | Export d'une sortie (partage / Strava). | Facile | 2h | 🟢 | | |

---

## V0.6 — Dashboard, streak & sync cloud

*Objectif : l'app devient un tout — accueil personnalisable, régularité transverse, et synchronisation multi-appareils via PowerSync.*

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|---|---|
| 2.9 | Calcul du streak | Jour actif = séance ou journée nutrition complétée. Repos = neutre. Minuit local. | Facile | 2h | 🟢 | | Motivation (conservé — arbitrage C). A besoin des 3 piliers. |
| 2.6 | Notif — Streak en danger | Push fin de journée si aucune activité. | Moyen | 2h | 🟢 | | |
| 2.8 | Mode Ne pas déranger | Aucune notif 22h-7h (modifiable). Max 3 push/jour. | Facile | 1h | 🟢 | | |
| 7.1 | Mode édition du dashboard | Bouton "Personnaliser" (widgets qui tremblent). | Moyen | 3h | 🟢 | | |
| 7.2 | Réorganisation par drag & drop | Changer l'ordre des blocs. | Moyen | 4h | 🟢 | | |
| 7.3 | Masquer / afficher un widget | Masquable sans suppression. | Facile | 2h | 🟢 | | |
| 7.4 | Widget — Séance du jour | Prochaine séance + CTA "Démarrer". | Moyen | 3h | 🟢 | | + accès séance libre. |
| 7.5 | Widget — Résumé nutrition | Calories restantes + macros compactes. | Facile | 2h | 🟢 | | |
| 7.6 | Widget — Streak & calendrier semaine | Jours consécutifs + 7 pastilles colorées. | Facile | 2h | 🟢 | | |
| 7.7 | Widget — Poids corporel | Dernière pesée + tendance 7 jours. | Facile | 2h | 🟢 | | |
| 7.8 | Widget — Record récent | Dernier record battu avec date. | Facile | 1h | 🟢 | | |
| 7.9 | Widget — Volume muscu semaine | Barres par groupe musculaire. | Moyen | 3h | 🟢 | | |
| 7.10 | Widget — Résumé running semaine | Distance + séances vs objectif hebdo. | Facile | 2h | 🟢 | | |
| 7.11 | Taille de widget configurable | Version compacte (ligne) ou normale (carte). | Moyen | 4h | 🟢 | | |
| 7.12 | Persistance de la configuration | Disposition sauvegardée localement + cloud (PowerSync). | Facile | 1h | 🟢 | | |
| 9.4 | Synchronisation cloud (PowerSync) *(reformulé — arbitrage B)* | Synchro bidirectionnelle **gérée par PowerSync** entre le SQLite local et Postgres/Supabase, en arrière-plan dès connexion. | Difficile | 8h | 🟢 | | Plus de protocole de synchro maison. L'architecture locale est prête depuis V0.1. |
| 9.7 | Gestion conflits de sync (PowerSync) *(reformulé — arbitrage B)* | **Conflits gérés par PowerSync** (plus de last-write-wins codé à la main). Vérifier le comportement sur 2 appareils. | Moyen | 3h | 🟢 | | Délégué à l'outil ; charge réduite (6h → 3h). |
| 2.12 | Sync cloud en arrière-plan (PowerSync) *(reformulé — arbitrage B)* | Synchro **automatique via PowerSync** dès connexion disponible. | Moyen | 3h | 🟢 | | Fournie par le SDK ; charge réduite (6h → 3h). |
| 2.13 | Indicateur mode hors-ligne | Bandeau discret quand offline (état de connexion PowerSync). | Facile | 1h | 🟢 | | |

---

## V0.7 — Admin & contenu

*Objectif : industrialiser la gestion du contenu (jusqu'ici injecté par scripts) et créer le catalogue éditorial avant la bêta. Back-office repris de Dams + principe « intégration sans imposition » (arbitrage H).*

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|---|---|
| 8.1 | Interface web admin séparée | Back-office, sous-domaine dédié, comptes admin. | Moyen | 6h | 🟢 | | Repris du pilier Administration de Dams. |
| 8.9 | Système de rôles | super_admin / content_editor / moderator. | Moyen | 3h | 🟢 | | |
| 8.2 | Gestion exercices (CRUD) | Créer, modifier, archiver. Brouillon / publié. | Moyen | 5h | 🟢 | | 🌐 champs bilingues FR+EN. |
| 8.3 | Upload média exercice | Image ou GIF + import en masse depuis la base choisie. | Moyen | 3h | 🟢 | | Stockage S3 ou Supabase Storage. |
| 8.4 | Constructeur de programmes | Drag & drop pour composer des programmes. | Difficile | 8h | 🟢 | | Sert à créer le contenu de 3.1 et 5.2. |
| 8.5 | Gestion base d'aliments | Créer, modifier, archiver. Validation des signalements. | Moyen | 4h | 🟢 | | |
| 8.6 | Import aliments CSV | Import en masse via CSV formaté. | Moyen | 3h | 🟢 | | Import initial CIQUAL (+ colonnes EN — arbitrage G). |
| 8.7 | Modération aliments signalés | File de revue des aliments utilisateurs signalés. | Moyen | 3h | 🟢 | | |
| 8.8 | Gestion utilisateurs | Profils en lecture seule, bannir / débannir. | Moyen | 3h | 🟢 | | |
| 8.10 | Log d'audit | Toute action admin tracée. Non supprimable. | Moyen | 3h | 🟢 | | |

---

## V0.8 — Bêta : conformité & intégrations

*Objectif : tout ce qui doit exister avant d'ouvrir à de vrais testeurs (Play interne) — OAuth Google, RGPD, Health, analytics, accessibilité. **OAuth Apple (1.3) sorti du périmètre de lancement** → section « Ultérieur — iOS » (arbitrage E).*

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|---|---|
| 1.2 | Connexion via Google | OAuth Google. | Moyen | 3h | 🟡 | | Clé OAuth Google à fournir. **Conservé** (arbitrage E). |
| 1.17 | Gestion des notifications | Activation / désactivation par type. | Facile | 2h | 🟢 | | |
| 1.18 | Export des données | JSON ou CSV (obligation RGPD). | Moyen | 4h | 🟢 | | |
| 1.19 | Suppression du compte | Confirmation double + délai de grâce 30 jours. | Moyen | 3h | 🟢 | | Exigé par les stores. |
| 1.22 | Aide & support | FAQ + formulaire de contact / signalement de bug. | Facile | 2h | 🟢 | | 🌐 bilingue FR+EN. |
| 9.9 | Health Connect | Écriture des séances, lecture du poids (Android). Apple Health lors du portage iOS. | Moyen | 6h | 🟢 | | Health Connect API. Apple Health traité en section « Ultérieur — iOS ». |
| 9.10 | Analytics produit first-party | Événements anonymisés, instance auto-hébergée. | Moyen | 4h | 🟢 | | **Avant la bêta** — sinon aucune mesure des testeurs. Alimente aussi la décision gamification V3/V4 (arbitrage C). |
| 9.11 | Dynamic Type | Taille de texte selon les réglages système. | Facile | 2h | 🟢 | | |
| 9.12 | Contraste WCAG AA | Ratio minimum sur toute l'interface. | Moyen | — | 🟡 | | Revue visuelle humaine. |

---

## V1.0 — Lancement store

*Objectif : publication publique **sur Android**. Le gros du travail est de la validation (review Google), pas du code. **iOS reporté** (arbitrage E).*

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|---|---|
| 9.2 | App Android | Publication Play Store via Expo EAS Build. | Difficile | — | 🟡 | | Compte Google Play + review. **Plateforme de lancement** (arbitrage E). |

---

## V1.1 — Post-lancement

*Objectif : les features d'adoption et de confort qui n'empêchent pas de lancer — priorisées selon les retours de la bêta et les analytics.*

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|---|---|
| 1.20 | Import de données | GPX (Strava), CSV (Hevy, Strong, MyFitnessPal). | Difficile | 8h | 🟢 | | Clé d'adoption pour la cible "multi-apps" — à remonter en V0.8 si la bêta le réclame. |
| 4.27 | Planning repas à la semaine | Vue calendrier des repas planifiés. | Difficile | 6h | 🟢 | | |
| 4.28 | Liste de courses générée | Tous les ingrédients depuis le planning. | Moyen | 3h | 🟢 | | Dépend de 4.27. |
| 4.29 | Export / partage liste de courses | Message, email ou texte brut. | Facile | 1h | 🟢 | | |

**Et au-delà (rappel du périmètre)** : V2 = wearables + zones FC, social / défis entre amis, hydratation, web app · **V3/V4 = gamification** (mini-jeu / boucle type Walkr — **réévaluée selon les analytics de rétention**, cf. [ADR-005](../adr/ADR-005-gamification.md)).

---

## Ultérieur — iOS (hors périmètre de lancement)

*Sorti du lancement par l'[ADR-004](../adr/ADR-004-plateforme-lancement.md) (Android d'abord). Traité une fois le produit stabilisé sur Android. Le code restant cross-platform, il s'agit d'un portage, pas d'une réécriture.*

| # | Fonctionnalité | Description | Difficulté | Temps | Autonomie Claude | Statut | Remarques |
|---|---|---|:---:|:---:|:---:|---|---|
| 9.1 | App iOS *(déplacé depuis V1.0 — arbitrage E)* | Publication App Store via Expo EAS Build. | Difficile | — | 🟡 | ⏳ Reporté | Compte Apple Developer + review App Store. Ajouter alors : Live Activity iOS (5.20), Apple Health (9.9), Keychain (9.8). |
| 1.3 | Connexion via Apple *(déplacé depuis V0.8 — arbitrage E)* | OAuth Apple — obligatoire dès qu'un autre OAuth est proposé **sur iOS**. | Moyen | 3h | 🟡 | ⏳ Reporté | Compte Apple Developer requis. Sans objet tant qu'on ne publie pas sur iOS. |

---

## Récapitulatif

> **Chiffres indicatifs, recalculés après les arbitrages du 04/07/2026.**
> Base initiale (cadrage Dams) : 179 fonctionnalités / ~470 h. Ajustements appliqués :
> **+ 9.13** Dev build Expo + PowerSync (+8 h) · **+ 9.14** RevenueCat inactif (+2 h, optionnel) ·
> **9.3** SQLite maison → PowerSync (8 h → 6 h) · **9.7** conflits délégués à PowerSync (6 h → 3 h) · **2.12** sync arrière-plan via PowerSync (6 h → 3 h) ·
> **− 1.3** OAuth Apple (−3 h) et **− 9.1** App iOS déplacés en « Ultérieur — iOS » (hors décompte de lancement).

**Décompte du périmètre de lancement (V0.1 → V1.1)** :

| Statut | Nombre |
|---|---|
| ✅ Validé | 0 |
| ❌ Refusé | 0 |
| 🔄 À modifier | 0 |
| ⏳ Reporté (section « Ultérieur — iOS ») | 2 |
| Non évalué (périmètre de lancement) | 179 |

- **~179 fonctionnalités** dans le périmètre de lancement (179 base − 2 items iOS déplacés + 2 tâches techniques ajoutées).
- **~477 h** de code brut (470 h − 3 h OAuth Apple + 8 h PowerSync + 2 h RevenueCat − 5 h économisés sur la synchro déléguée à PowerSync ≈ **~472–477 h**), hors intégration, tests et itérations UX — prévoir une marge significative sur l'offline-first, le GPS et l'import de données.
- **+ 2 items reportés** en section « Ultérieur — iOS » (9.1, 1.3).

Autonomie Claude (périmètre de lancement) : 🟢 Full auto ≈ 167 · 🟡 Semi-auto ≈ 10 · 🔴 Humain requis ≈ 2 (9.13 PowerSync/dev build, 6.1 GIF, 4.8 base d'aliments — les deux derniers déjà « décisions bloquantes »).

**Décisions bloquantes à prendre en amont de leur version** :
- avant **V0.1** → confirmer **PowerSync** par le [spike-001](../specs/technical/spike-001-powersync.md) (conditionne le modèle de données) — cf. [ADR-001](../adr/ADR-001-moteur-sync-offline.md).
- avant **V0.2** → source des GIF d'exercices (6.1) : exercises-dataset vs ExerciseDB.
- avant **V0.4** → source de la base d'aliments (4.8) : CIQUAL + OpenFoodFacts (+ plan de traduction EN).
- avant **V0.5** → fournisseur de cartes (5.17) : Mapbox vs MapLibre.
- avant **V0.8** → clé OAuth Google, textes CGU / confidentialité (rédaction dès que possible, relecture juridique). **OAuth Apple n'est plus bloquant** (reporté avec iOS).

---

*Dernière mise à jour : 04/07/2026 — roadmap adaptée aux arbitrages de cadrage (PowerSync, Android d'abord, RevenueCat inactif, bilingue FR+EN, gamification V3/V4).*
