# Vision & Contexte produit

> Document socle de la couche produit. Fusion des cadrages de Florian et de Damien, aligné sur les décisions actées le 04/07/2026.
> Source de vérité des décisions : [../../SYNTHESE-CADRAGE.md](../../SYNTHESE-CADRAGE.md).
> Voir aussi : [personas.md](./personas.md) · [prd.md](./prd.md) · [metriques-succes.md](./metriques-succes.md).
> Statut : Validé (base de fusion) · Date : 04/07/2026.

---

## Concept

Application mobile de suivi bien-être **tout-en-un**, organisée autour de **trois piliers** : **musculation, running, nutrition**.

L'idée centrale : **une seule app où les trois piliers se parlent**. Les calories cibles s'adaptent aux jours d'entraînement, le planning running tient compte des séances de muscu, le poids corporel alimente les calculs nutritionnels. L'utilisateur ne jongle plus entre trois ou quatre apps qui s'ignorent.

Le produit est pensé comme un **vrai produit** (utilisateurs réels, qualité de finition, monétisation à terme), pas comme un projet jetable. La monétisation existe dans l'architecture mais n'est **pas activée au lancement** (voir [prd.md](./prd.md) §Monétisation).

---

## Positionnement

Le marché du suivi sportif est dominé par des apps **silos**, chacune excellente sur un pilier mais aveugle aux autres.

| Concurrent | Ce qu'il fait bien | Ce qui lui manque |
|---|---|---|
| **Strava** | Running / GPS, couche sociale | Musculation, nutrition |
| **MyFitnessPal** | Nutrition (base d'aliments, macros) | Musculation, running |
| **Strong / Hevy** | Musculation (logging, progression) | Running, nutrition |

**Notre différenciateur : l'intégration des trois piliers.** Là où l'utilisateur doit aujourd'hui recopier son poids d'une app à l'autre et deviner l'impact de son volume d'entraînement sur ses besoins caloriques, notre app **connecte les données** :

- **Données croisées** : calories cibles ajustées aux jours d'entraînement ; alerte de déficit sur une semaine à fort volume.
- **Planning unifié** : muscu et running dans le même calendrier, avec détection des chevauchements.
- **Progression globale** visible au même endroit : force, allure, poids corporel, apports.

On ne gagne **pas** sur « être la seule app de muscu » (créneau saturé) ni sur « le meilleur GPS » : on gagne sur le fait d'être **le hub unique où tout se parle**.

---

## Utilisateur cible

**Profil principal — l'assidu multi-apps (20-35 ans).**
- Pratique déjà deux ou trois activités : salle + running + alimentation surveillée.
- Niveau intermédiaire à avancé, s'entraîne 3 à 6 fois par semaine.
- Lassé de jongler entre plusieurs apps qui ne communiquent pas.
- Veut être **motivé** (records, régularité, courbes), pas seulement tracké.
- Exige **fiabilité** et un fonctionnement **hors-ligne** en salle (réseau souvent absent).

**Profil secondaire — le débutant motivé.**
- Débute ou reprend, cherche une structure de départ claire.
- Veut un programme guidé + un suivi simple, sans se sentir noyé.

Formule directrice : **« conçu pour l'exigeant, utilisable par le débutant »** — l'app se conçoit pour l'assidu, mais reste accessible au débutant qui est capté de facto. Voir [personas.md](./personas.md).

---

## Objectifs produit

1. **Centraliser** — remplacer le trio Strava + Strong/Hevy + MyFitnessPal par une seule app cohérente.
2. **Connecter les piliers** — les données muscu / running / nutrition s'informent mutuellement (calories adaptées aux jours d'entraînement, coordination des plannings, progression globale).
3. **Motiver sur le long terme** — records personnels, streak de régularité, courbes de progression, notifications de célébration.
4. **Être irréprochable en séance** — saisie rapide, écran de suivi sans friction, aucune latence réseau bloquante, **zéro perte de données**.
5. **Poser les fondations d'un produit durable** — architecture prête pour la monétisation (RevenueCat câblé) et pour un futur ajout de couches (gamification, social), sans refonte.

---

## Principe directeur — « Intégration sans imposition »

C'est la colonne vertébrale du produit, héritée du cadrage de Flo (D2).

- **Chaque pilier est autonome et utile seul.** On peut n'utiliser que le suivi de séances, ou que le journal alimentaire, et en tirer une vraie valeur.
- **L'intégration inter-piliers est une couche opt-in par-dessus**, jamais un prérequis. Personne n'est forcé de paramétrer la nutrition, le running ou son poids pour utiliser la muscu.
- **On fait envie, on ne contraint pas.** Tension à gérer en permanence : « tout au même endroit » est la valeur n°1, mais rien n'est imposé — l'app doit **donner envie** de connecter les piliers (via les analyses croisées et les données qui se répondent), sans jamais bloquer l'utilisateur qui ne veut qu'un seul module.

Ce principe s'applique aussi au back-office et à toute future couche (social, gamification) : on ajoute des capacités par-dessus un socle qui reste utile sans elles.

---

## Périmètre V1 (les trois piliers)

La V1 couvre les **trois piliers**, livrés **par versions successives** (chaque fin de version = un build installable et testable avec de vrais utilisateurs). Le détail fonctionnel vit dans les specs (`../specs/functional/`).

**Musculation** — bibliothèque d'exercices (préchargée + custom), séances libres et programmes/templates, logging live (poids × reps, RPE optionnel, types de séries), timer de repos, historique éditable, records auto (1RM Epley), courbes, volume par groupe musculaire, surcharge progressive assistée, deload, notes, photos et mesures de progression.

**Running** — profil coureur, programmes, types de séance (endurance, fractionné/VMA, sortie longue, récupération, course libre), suivi GPS temps réel (auto-pause, écran verrouillé, annonces audio, guidage fractionné), historique, statistiques, records d'allure auto-détectés, export GPX, mode manuel de repli.

**Nutrition** — profil nutritionnel, calcul TDEE (Mifflin-St Jeor) et macros, base d'aliments (vérifiée + custom + OpenFoodFacts par scan), journal quotidien, portions usuelles, quick add, copie/duplication de repas, saisie par liste en langage naturel, recettes et repas types, planning repas, liste de courses, suivi du poids et des apports.

**Transverse** — compte Supabase (synchro multi-appareils), onboarding minimal avec parcours guidé optionnel, streak + records + notifications de célébration, import GPX/CSV depuis les apps concurrentes, back-office d'administration du contenu.

---

## Hors périmètre

Rappel des exclusions actées (voir [../../SYNTHESE-CADRAGE.md](../../SYNTHESE-CADRAGE.md)) :

- **Gamification / boucle de jeu complète** (conversion activité → énergie → exploration, missions, RPG façon Walkr) → **reportée en V3/V4**, réévaluée selon les métriques de rétention. On conserve uniquement streak + records + notifications de célébration (classés « motivation », pas « jeu »).
- **iOS, connexion Apple (OAuth), publication App Store** → **plus tard**. Android d'abord ; on reste sur des libs cross-platform pour ne pas fermer la porte à iOS.
- **Couche sociale** (feed, follows, kudos) → **V2**.
- **Wearables / smartwatch et zones cardio FC** → **V2** (en V1, les intensités running sont exprimées en allure).
- **Suivi de l'hydratation** → **V2**.
- **Synchronisation continue avec Strava / Garmin** → post-V1 (l'import ponctuel GPX/CSV est en V1).
- **Fonctionnalités IA** (programmes/plans assistés, désambiguïsation avancée de la saisie langage naturel) → **plus tard**.
- **Animations 3D des exercices** → hors périmètre (démonstration par GIF animé en V1).
- **Aucune monétisation active** (paywall / palier payant) en V1 — voir [prd.md](./prd.md).

---

## Hypothèses clés

- L'utilisateur s'entraîne **3 à 6 fois par semaine** (ni ultra-athlète, ni sédentaire complet).
- Le réseau est **souvent absent en salle** → l'offline-first est non négociable pour la crédibilité de l'outil.
- L'app est utilisée **principalement sur mobile**, Android d'abord.
- Les données sont stockées **localement d'abord**, avec synchronisation cloud en arrière-plan (compte requis).
- **Streak + records + notifications** suffisent comme moteur de motivation en V1 ; la gamification complète ne sera envisagée que si les métriques de rétention le justifient.
- Le **différenciateur « intégration »** est réellement perçu comme une valeur par le persona principal (hypothèse à valider avec de vrais utilisateurs dès les premières versions).
