# État du projet — 04/08/2026

> 🤖 **Fichier généré.** Ne pas l'éditer à la main : il est réécrit par `node scripts/etat.mjs`
> (skill [`/etat`](.claude/commands/etat.md)) à partir du front-matter des specs, de
> [BACKLOG.md](BACKLOG.md), de la [roadmap](docs/roadmap/roadmap.md), du registre des migrations
> et de git. Pour changer une ligne, **corrige la source puis relance**.

## 🎯 Cap

**MVP1 (= V1.0 complète)** `██████████████████░░` **89 %** — 193 livré · 14 partiel · 5 à faire (sur 218)

Version en cours : **V0.8 — bêta : conformité & intégrations**. Il reste **2 candidats P0**
avant de pouvoir publier.

## 🔨 En cours

| US | Étape | Branche | Roadmap |
|---|---|---|---|
| **ACTIV-01** — Parcours « 7 jours pour démarrer » | `recette` | `feature/activ01-parcours-7-jours` | [1.27] |
| **ADMIN-01** — Archivage sûr du contenu éditorial (back-office) | `recette` | `feature/admin01-archivage-sur` | [8.11] |
| **BIEN-01** — Check-in quotidien & journal de bien-être | `recette` | `feature/bien01-checkin-bien-etre` | [1.24] |
| **BILAN-01** — Bilan hebdomadaire automatique | `recette` | `feature/bilan01-bilan-hebdo` | [7.16] |
| **CONF-07** — Accessibilité — solde des non-conformités WCAG AA | `recette` | `fix/conf07-accessibilite` | [9.11, 9.12] |
| **CONTENU-01** — Seed des bibliothèques de programmes (muscu + course) | `recette` | `docs/contenu-01-spec` | [3.1, 5.2] |
| **CYCLE-01** — Suivi du cycle menstruel — journal, prédiction et croisement | `recette` | `feature/cycle01-suivi-menstruel` | [1.25, 1.26] |
| **LAUNCHER-01** — Widget écran d'accueil Android | `recette` | `feature/launcher01-widget-ecran-accueil` | [7.19] |
| **MESUR-01** — Mensurations corporelles | `recette` | `feature/mesur01-mensurations` | [3.51] |
| **META-19** — Garde-fou surentraînement (ACWR combiné) | `recette` | `feature/meta19-acwr-garde-fou` | — |
| **MN-04** — Macros ajustées jours muscu (glucides péri-séance) | `recette` | `feature/mn04-glucides-peri-seance` | — |
| **MR-08** — Interférence concurrent training | `recette` | `feature/mr08-interference-concurrent-training` | — |
| **MR-14** — Jours consécutifs sans repos | `recette` | `feature/mr14-jours-consecutifs-sans-repos` | — |
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
| **NUTR-16** — Répartition calorique par repas | `recette` | `feature/nutr16-repartition-repas` | [4.38] |
| **NUTR-18** — Bilan calorique hebdomadaire | `recette` | `feature/nutr18-bilan-calorique-hebdo` | — |
| **NUTR-F1** — Rappels programmés nutrition — repas et pesée, à l'échéance apprise | `recette` | `feature/nutrf1-rappels-nutrition` | [1.14, 2.5] |
| **NUTR-F2** — Suggestion d'aliments pour combler un macro | `recette` | `feature/nutrf2-substitution-aliments` | [4.37] |
| **OBJ-01** — Objectifs personnels à échéance | `recette` | `feature/obj01-objectifs` | [7.15] |
| **PARTAGE-01** — Carte de séance / course partageable | `recette` | `feature/partage01-carte-partageable` | [7.17] |
| **RN-03** — Ajustement auto du TDEE selon le volume de course | `recette` | `feature/rn03-tdee-ajuste-course` | — |
| **RUN-14** — Prédiction de temps de course (formule de Riegel) | `recette` | `feature/run14-prediction-riegel` | [5.34] |
| **RUN-18** — Charge d'entraînement & ACWR (running seul) | `recette` | `feature/run18-acwr-running` | — |
| **RUN-F1b** — Dénivelé cumulé | `recette` | `feature/runf1b-denivele-cumule` | [5.32] |
| **RUN-F2a** — Annonces audio périodiques | `recette` | `feature/runf2a-annonces-audio` | [5.19] |
| **RUN-F2b** — Prolonger ou raccourcir — cible visible en direct | `recette` | `feature/runf2b-cible-en-direct` | [5.23] |
| **RUN-F2c** — Blocs fractionné / intervalles | `recette` | `feature/runf2c-blocs-fractionne` | [5.9] |
| **RUN-F2d** — Guidage fractionné vocal | `recette` | `feature/runf2d-guidage-fractionne-vocal` | [5.18] |
| **RUN-F3** — Résumé de course enrichi — objectif atteint et conditions | `recette` | `feature/runf3-resume-course-enrichi` | [5.24, 5.25] |
| **STREAK-01** — Joker de série (gel d'un jour manqué) | `recette` | `feature/streak01-joker` | [7.14] |
| **TRI-03** — Score de forme / readiness global | `recette` | `feature/tri03-score-readiness` | — |
| **TRI-12** — Détection de surcharge / sous-récupération globale | `recette` | `feature/tri12-garde-fou-global` | — |
| **UX-05** — Intensité en RPE ou en RIR, au choix | `recette` | `feature/ux05-rpe-ou-rir` | [3.55] |
| **UX-LOT-01** — Lot de finitions remontées en recette (UX-02, UX-03, UX-04) | `recette` | `feature/uxlot01-finitions-recette` | [3.53, 3.54, 7.18] |

⏳ **43 US attendent une recette humaine** (ACTIV-01, ADMIN-01, BIEN-01, BILAN-01, CONF-07, CONTENU-01, CYCLE-01, LAUNCHER-01, MESUR-01, META-19, MN-04, MR-08, MR-14, MUSC-09, MUSC-12, MUSC-19, MUSC-20, MUSC-F14, MUSC-F15, MUSC-F1b, MUSC-F7, MUSC-F8, MUSC-F9, NUTR-16, NUTR-18, NUTR-F1, NUTR-F2, OBJ-01, PARTAGE-01, RN-03, RUN-14, RUN-18, RUN-F1b, RUN-F2a, RUN-F2b, RUN-F2c, RUN-F2d, RUN-F3, STREAK-01, TRI-03, TRI-12, UX-05, UX-LOT-01) — critères cochables dans [RECETTES.md](RECETTES.md).

## ➡️ Prochain — P0 bloquant (2)

- LANCE-00 — Compte développeur Google Play
- LANCE-01 — Publication Play Store

<details><summary>P1 finitions (1) · P2 confort (1)</summary>

**P1** — RUN-F3b — Météo de course

**P2** — SOCLE-01 — RevenueCat câblé inactif

</details>

Détail et points durs : [BACKLOG.md](BACKLOG.md).

## 🩺 Santé du dépôt

| | |
|---|---|
| Branche courante | `feature/mr14-jours-consecutifs-sans-repos` (modifications non commitées) |
| Commits | 1072 · `main` a **1069** commits de retard sur `dev` |
| Specs d'US | 120 au total — 77 clôturées, 43 en cours |
| Migrations | 70/70 poussées sur le cloud |
| Tests | `npm run test` — **⚠️ lire le code de sortie sans pipe** (un `tail` en aval masque l'échec) |

### ⚠️ Alertes

- ⚠️ Working tree : modifications non commitées

## 🕒 Derniers commits

- `a68a958` feat(mr08): interférence concurrent training (US MR-08, catalogue d'analyses)
- `902143b` feat(nutr18): bilan calorique hebdomadaire (US NUTR-18, catalogue d'analyses)
- `94fe516` feat(musc20): régularité & consistance d'entraînement (US MUSC-20, catalogue d'analyses)
- `a91dc42` feat(musc12): densité d'entraînement volume/temps (US MUSC-12, catalogue d'analyses)
- `ecd3da4` feat(musc19): tonnage cumulé lifetime/annuel (US MUSC-19, catalogue d'analyses)

---

**Où trouver quoi** · [BACKLOG.md](BACKLOG.md) reste-à-faire · [roadmap](docs/roadmap/roadmap.md)
périmètre complet · [catalogue d'analyses](docs/product/analyses-donnees.md) ·
[IDEAS.md](IDEAS.md) idées non cadrées · [CHANGELOG.md](CHANGELOG.md) historique ·
[docs/journal/](docs/journal/) archives du suivi.
