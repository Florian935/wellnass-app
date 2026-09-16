# État du projet — 16/09/2026

> 🤖 **Fichier généré.** Ne pas l'éditer à la main : il est réécrit par `node scripts/etat.mjs`
> (skill [`/etat`](.claude/commands/etat.md)) à partir du front-matter des specs, de
> [BACKLOG.md](BACKLOG.md), de la [roadmap](docs/roadmap/roadmap.md), du registre des migrations
> et de git. Pour changer une ligne, **corrige la source puis relance**.

## 🎯 Cap

**MVP1 (= V1.0 complète)** `███████████████████░` **95 %** — 236 livré · 4 partiel · 2 à faire (sur 248)

Version en cours : **V0.8 — bêta : conformité & intégrations**. Il reste **2 candidats P0**
avant de pouvoir publier.

## 🔨 En cours

| US | Étape | Branche | Roadmap |
|---|---|---|---|
| **ACTIV-01** — Parcours « 7 jours pour démarrer » | `recette` | `feature/activ01-parcours-7-jours` | [1.27] |
| **ADMIN-01** — Archivage sûr du contenu éditorial (back-office) | `recette` | `feature/admin01-archivage-sur` | [8.11] |
| **ALLURE-01** — La courbe d'allure — ce que ta façon de courir dit | `recette` | `feature/allure01-courbe-allure` | [5.35] |
| **APPORT-01** — Manges-tu comme tu t'entraînes ? — lot d'analyses croisées muscu × nutrition | `recette` | `feature/apport01-manger-comme-on-sentraine` | [4.40] |
| **AUTRE-01** — Les autres activités : vélo, natation, rando… saisies à la main | `recette` | `dev` | [4.42] |
| **BIEN-01** — Check-in quotidien & journal de bien-être | `recette` | `feature/bien01-checkin-bien-etre` | [1.24] |
| **BILAN-01** — Bilan hebdomadaire automatique | `recette` | `feature/bilan01-bilan-hebdo` | [7.16] |
| **CARDIO-UX01** — Refonte UX du pilier Course — justesse, hub, course, après-course, préparation | `recette` | `feature/cardio-refonte-ux` | [5.40] |
| **COLLIS-01** — Détecteur de collisions entre séances — séquençage muscu ↔ course | `recette` | `fix/collis01-conflit-veille-hors-semaine` | [3.57] |
| **CONF-07** — Accessibilité — solde des non-conformités WCAG AA | `recette` | `fix/conf07-accessibilite` | [9.11, 9.12] |
| **CONTENU-01** — Seed des bibliothèques de programmes (muscu + course) | `recette` | `docs/contenu-01-spec` | [3.1, 5.2] |
| **CYCLE-01** — Suivi du cycle menstruel — journal, prédiction et croisement | `recette` | `feature/cycle01-suivi-menstruel` | [1.25, 1.26] |
| **DASH-01** — Dashboards immersifs — une atmosphère par pilier, des écrans vivants, une app qui comprend | `recette` | `feature/dash01-dashboards-immersifs` | [7.29] |
| **DEPENSE-01** — Le moteur de dépense énergétique (muscu, course, activité) | `recette` | `dev` | [4.41] |
| **DOUL-01** — Journal des zones douloureuses — déclaration, historique et signal factuel | `recette` | `feature/doul01-journal-zones-douloureuses` | [1.29] |
| **EXEC-01** — Écart entre le prévu et le réalisé — lot d'analyses d'exécution muscu | `recette` | `feature/exec01-prevu-vs-realise` | [3.58] |
| **FUEL-01** — Socle glucidique du coureur — besoin g/kg selon la charge et périodisation jours durs / faciles | `recette` | `feature/fuel01-socle-glucidique-coureur` | — |
| **GARDE-01** — Garde-fou unifié charge & récupération (fusion TRI-12 + MR-14) | `recette` | `refactor/garde01-fusion-garde-fou` | — |
| **GUID-01** — Objectif utile et régime de guidage | `recette` | `feature/guid01-objectif-regime-guidage` | [1.30] |
| **HORAIRE-01** — Heure d'une séance planifiée — et le rappel « ça commence bientôt » | `recette` | `feature/horaire01-heure-seance` | [2.4] |
| **IA-LAB-01** — Labo IA — évaluer un modèle sur des données factices, avec un fournisseur gratuit | `recette` | `dev` | [7.31] |
| **INSIGHTS-01** — Écran « Insights » — moteur de sélection des analyses pertinentes (Tier 3) | `recette` | `feature/insights01-ecran-insights` | [7.20] |
| **INSIGHTS-02** — Dégonflage du Tier 0 — ramener l'accueil au plafond d'ADR-007 | `recette` | `feature/insights02-degonflage-tier0` | [7.21] |
| **LABO-01** — Le Labo — là où tes piliers se croisent | `recette` | `dev` | [7.30] |
| **LAUNCHER-01** — Widget écran d'accueil Android | `recette` | `feature/launcher01-widget-ecran-accueil` | [7.19] |
| **MESUR-01** — Mensurations corporelles | `recette` | `feature/mesur01-mensurations` | [3.51] |
| **META-19** — Garde-fou surentraînement (ACWR combiné) | `recette` | `feature/meta19-acwr-garde-fou` | — |
| **MN-04** — Macros ajustées jours muscu (glucides péri-séance) | `recette` | `feature/mn04-glucides-peri-seance` | — |
| **MOTION-01** — Langage de mouvement — une physique par pilier, socle partagé, 19 effets livrés | `recette` | `feature/motion01-langage-mouvement` | [3.60] |
| **MR-08** — Interférence concurrent training | `recette` | `feature/mr08-interference-concurrent-training` | — |
| **MUSC-09** — Record personnel par plage de répétitions | `recette` | `feature/musc09-record-plage-reps` | [3.56] |
| **MUSC-12** — Densité d'entraînement (volume/temps) | `recette` | `feature/musc12-densite-entrainement` | — |
| **MUSC-19** — Tonnage cumulé (lifetime/annuel) | `recette` | `feature/musc19-tonnage-cumule` | — |
| **MUSC-20** — Régularité & consistance d'entraînement | `recette` | `feature/musc20-regularite-entrainement` | — |
| **MUSC-F14** — Suggestion de substitution d'exercice | `recette` | `feature/muscf14-substitution-exercice` | [3.52] |
| **MUSC-F15** — Progression au niveau du programme | `recette` | `feature/muscf15-progression-programme` | [3.7] |
| **MUSC-F1b** — Muscles ciblés sur schéma corporel — anatomie fine | `recette` | `feature/muscf1b-schema-muscles` | [6.2] |
| **MUSC-F7** — Progression assistée — deload sur stagnation | `recette` | `feature/muscf7-deload` | [3.8] |
| **MUSC-F8** — Notifications muscu — push de record agrégé, célébration animée, rappel de séance | `recette` | `feature/muscf8-notifications-muscu` | [3.42, 2.7, 2.4] |
| **MUSC-F9** — Décalage d'une séance planifiée en glisser-déposer | `recette` | `feature/muscf9-planning-glisser-deposer` | [3.10] |
| **MUSCPWR-01** — Module force — intensité relative (%1RM), force relative (DOTS) et total SBD avec projection | `recette` | `feature/muscpwr01-module-force` | — |
| **MUSCU-UX01** — Refonte UX du pilier Musculation — hub, séance, après-séance, entrée programme | `recette` | `feature/muscu-refonte-ux` | [3.59] |
| **MUSCU-UX03** — Mode immersif de la séance de musculation — la séance vivante, en plus du mode classique | `recette` | `feature/muscu-ux03-mode-immersif` | [3.61] |
| **MUSCU-UX02** — Bilan de séance — 3 niveaux de lecture, écran unique récap/historique | `recette` | `feature/muscu-ux02-bilan-seance` | [3.35] |
| **NUTR-16** — Répartition calorique par repas | `recette` | `feature/nutr16-repartition-repas` | [4.38] |
| **NUTR-18** — Bilan calorique hebdomadaire | `recette` | `feature/nutr18-bilan-calorique-hebdo` | — |
| **NUTR-F1** — Rappels programmés nutrition — repas et pesée, à l'échéance apprise | `recette` | `feature/nutrf1-rappels-nutrition` | [1.14, 2.5] |
| **NUTR-F2** — Suggestion d'aliments pour combler un macro | `recette` | `feature/nutrf2-substitution-aliments` | [4.37] |
| **NUTRI-UX01** — Refonte UX du pilier Nutrition — objectif juste, geste de saisie, journal, suivi, planning | `recette` | `feature/nutri-refonte-ux` | [4.41] |
| **OBJ-01** — Objectifs personnels à échéance | `recette` | `feature/obj01-objectifs` | [7.15] |
| **PARTAGE-01** — Carte de séance / course partageable | `recette` | `feature/partage01-carte-partageable` | [7.17] |
| **REPAS-01** — Planning repas à la semaine, liste de courses générée et partage | `recette` | `feature/repas01-planning-repas-liste-courses` | [4.27, 4.28, 4.29] |
| **RN-03** — Ajustement auto du TDEE selon le volume de course | `recette` | `feature/rn03-tdee-ajuste-course` | — |
| **RUN-14** — Prédiction de temps de course (formule de Riegel) | `recette` | `feature/run14-prediction-riegel` | [5.34] |
| **RUN-18** — Charge d'entraînement & ACWR (running seul) | `recette` | `feature/run18-acwr-running` | — |
| **RUN-F1b** — Dénivelé cumulé | `recette` | `feature/runf1b-denivele-cumule` | [5.32] |
| **RUN-F2a** — Annonces audio périodiques | `recette` | `feature/runf2a-annonces-audio` | [5.19] |
| **RUN-F2b** — Prolonger ou raccourcir — cible visible en direct | `recette` | `feature/runf2b-cible-en-direct` | [5.23] |
| **RUN-F2c** — Blocs fractionné / intervalles | `recette` | `feature/runf2c-blocs-fractionne` | [5.9] |
| **RUN-F2d** — Guidage fractionné vocal | `recette` | `feature/runf2d-guidage-fractionne-vocal` | [5.18] |
| **RUN-F3** — Résumé de course enrichi — objectif atteint et conditions | `recette` | `feature/runf3-resume-course-enrichi` | [5.24, 5.25] |
| **RUN-F4** — La séance de course porte enfin sa consigne | `recette` | `feature/run-seances-structurees` | [5.36, 5.37, 5.38, 5.39] |
| **STREAK-01** — Joker de série (gel d'un jour manqué) | `recette` | `feature/streak01-joker` | [7.14] |
| **TRI-03** — Score de forme / readiness global | `recette` | `feature/tri03-score-readiness` | — |
| **UX-05** — Intensité en RPE ou en RIR, au choix | `recette` | `feature/ux05-rpe-ou-rir` | [3.55] |
| **UX-LOT-01** — Lot de finitions remontées en recette (UX-02, UX-03, UX-04) | `recette` | `feature/uxlot01-finitions-recette` | [3.53, 3.54, 7.18] |
| **VIE-01** — Mode « vie réelle » — dégradation gracieuse des objectifs | `recette` | `feature/vie01-mode-vie-reelle` | [1.28] |
| **IMPORT-01** — Import de données depuis d'autres apps — GPX (Strava), CSV (Hevy, Strong, MyFitnessPal) ⏸️ | `validation` *(en pause)* | `feature/import01-import-donnees-externes` | [1.20] |
| **FANT-01** — Le Fantôme — courir contre soi-même sur le même parcours | `spec` | `dev` | [5.41] |
| **LETTRE-01** — Lettre à ton futur toi — un message écrit en fixant un objectif, rouvert à l'échéance | `spec` | `dev` | [7.31] |
| **RESERV-01** — Le Réservoir — la jauge de glucides de la journée | `spec` | `dev` | [4.45] |

⏸️ **1 US en pause sur une dépendance externe** :
- **IMPORT-01** — En attente d'un export réel de Hevy, Strong et MyFitnessPal pour figer les alias de colonnes (D4). Procédure et jeu de données attendu : docs/specs/technical/import-samples/README.md

⏳ **67 US attendent une recette humaine** (ACTIV-01, ADMIN-01, ALLURE-01, APPORT-01, AUTRE-01, BIEN-01, BILAN-01, CARDIO-UX01, COLLIS-01, CONF-07, CONTENU-01, CYCLE-01, DASH-01, DEPENSE-01, DOUL-01, EXEC-01, FUEL-01, GARDE-01, GUID-01, HORAIRE-01, IA-LAB-01, INSIGHTS-01, INSIGHTS-02, LABO-01, LAUNCHER-01, MESUR-01, META-19, MN-04, MOTION-01, MR-08, MUSC-09, MUSC-12, MUSC-19, MUSC-20, MUSC-F14, MUSC-F15, MUSC-F1b, MUSC-F7, MUSC-F8, MUSC-F9, MUSCPWR-01, MUSCU-UX01, MUSCU-UX03, MUSCU-UX02, NUTR-16, NUTR-18, NUTR-F1, NUTR-F2, NUTRI-UX01, OBJ-01, PARTAGE-01, REPAS-01, RN-03, RUN-14, RUN-18, RUN-F1b, RUN-F2a, RUN-F2b, RUN-F2c, RUN-F2d, RUN-F3, RUN-F4, STREAK-01, TRI-03, UX-05, UX-LOT-01, VIE-01) — critères cochables dans [RECETTES.md](RECETTES.md).

## ➡️ Prochain — P0 bloquant (2)

- LANCE-00 — Compte développeur Google Play
- LANCE-01 — Publication Play Store

<details><summary>P1 finitions (8) · P2 confort (2)</summary>

**P1** — RUN-F3b — Météo de course · CLAV-01 — Le clavier recouvre les formulaires (edge-to-edge) · CARDIO-02 — Les quatre portes vers l'allure de référence · CARDIO-03 — Écran de départ + saisie rétroactive · CARDIO-04 — Historique en trois onglets · CARDIO-05 — Éditeur de séance à trois niveaux · CARDIO-06 — Les semaines qui progressent · CARDIO-07 — Import GPX et Health Connect

**P2** — SOCLE-01 — RevenueCat câblé inactif · VBT-01 — Vitesse de barre à la caméra

</details>

Détail et points durs : [BACKLOG.md](BACKLOG.md).

## 🩺 Santé du dépôt

| | |
|---|---|
| Branche courante | `dev` (modifications non commitées) |
| Commits | 1238 · `main` a **1235** commits de retard sur `dev` |
| Specs d'US | 157 au total — 85 clôturées, 71 en cours |
| Migrations | 102/104 poussées sur le cloud |
| Tests | `npm run test` — **⚠️ lire le code de sortie sans pipe** (un `tail` en aval masque l'échec) |

### ⚠️ Alertes

- ⚠️ 1 spec(s) sans front-matter : depense00-socle-hors-sport.md
- ⚠️ 2 migration(s) absente(s) du registre : 20260912235121_corps02_body_visual_state.sql, 20260913204247_corps03_body_training_state.sql
- ⚠️ 2 migration(s) non poussée(s) sur le cloud
- ⚠️ Working tree : modifications non commitées

## 🕒 Derniers commits

- `9b10cb8`  feat(labo01): le Labo, la ou tes piliers se croisent (roadmap 7.30)
- `1869dff`  chore(guid01): integre dev, pousse la migration et active l'ecriture du guidage
- `2b43b72`  feat(guid01): l'objectif pilote les 3 piliers, et le guidage devient reglable
- `ec1b999`  Merge remote-tracking branch 'origin/dev' into feature/nutri-refonte-ux
- `89396aa`  feat(nutri-ux01): la bibliotheque passe de 80 a 3 244 aliments (import CIQUAL)

---

**Où trouver quoi** · [BACKLOG.md](BACKLOG.md) reste-à-faire · [roadmap](docs/roadmap/roadmap.md)
périmètre complet · [catalogue d'analyses](docs/product/analyses-donnees.md) ·
[IDEAS.md](IDEAS.md) idées non cadrées · [CHANGELOG.md](CHANGELOG.md) historique ·
[docs/journal/](docs/journal/) archives du suivi.
