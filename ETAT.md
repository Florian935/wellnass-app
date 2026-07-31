# État du projet — 31/07/2026

> 🤖 **Fichier généré.** Ne pas l'éditer à la main : il est réécrit par `node scripts/etat.mjs`
> (skill [`/etat`](.claude/commands/etat.md)) à partir du front-matter des specs, de
> [BACKLOG.md](BACKLOG.md), de la [roadmap](docs/roadmap/roadmap.md), du registre des migrations
> et de git. Pour changer une ligne, **corrige la source puis relance**.

## 🎯 Cap

**MVP1 (= V1.0 complète)** `████████████████░░░░` **82 %** — 174 livré · 22 partiel · 10 à faire (sur 212)

Version en cours : **V0.8 — bêta : conformité & intégrations**. Il reste **2 candidats P0**
avant de pouvoir publier.

## 🔨 En cours

| US | Étape | Branche | Roadmap |
|---|---|---|---|
| **ADMIN-01** — Archivage sûr du contenu éditorial (back-office) | `recette` | `feature/admin01-archivage-sur` | [8.11] |
| **BIEN-01** — Check-in quotidien & journal de bien-être | `recette` | `feature/bien01-checkin-bien-etre` | [1.24] |
| **BILAN-01** — Bilan hebdomadaire automatique | `recette` | `feature/bilan01-bilan-hebdo` | [7.16] |
| **CONTENU-01** — Seed des bibliothèques de programmes (muscu + course) | `recette` | `docs/contenu-01-spec` | [3.1, 5.2] |
| **CYCLE-01** — Suivi du cycle menstruel — journal, prédiction et croisement | `recette` | `feature/cycle01-suivi-menstruel` | [1.25, 1.26] |
| **MESUR-01** — Mensurations corporelles | `recette` | `feature/mesur01-mensurations` | [3.51] |
| **MUSC-F14** — Suggestion de substitution d'exercice | `recette` | `feature/muscf14-substitution-exercice` | [3.52] |
| **MUSC-F8** — Notifications muscu — push de record agrégé, célébration animée, rappel de séance | `recette` | `feature/muscf8-notifications-muscu` | [3.42, 2.7, 2.4] |
| **NUTR-F1** — Rappels programmés nutrition — repas et pesée, à l'échéance apprise | `recette` | `feature/nutrf1-rappels-nutrition` | [1.14, 2.5] |
| **NUTR-F2** — Suggestion d'aliments pour combler un macro | `recette` | `feature/nutrf2-substitution-aliments` | [4.37] |
| **OBJ-01** — Objectifs personnels à échéance | `recette` | `feature/obj01-objectifs` | [7.15] |
| **PARTAGE-01** — Carte de séance / course partageable | `recette` | `feature/partage01-carte-partageable` | [7.17] |
| **STREAK-01** — Joker de série (gel d'un jour manqué) | `recette` | `feature/streak01-joker` | [7.14] |
| **UX-05** — Intensité en RPE ou en RIR, au choix | `recette` | `feature/ux05-rpe-ou-rir` | [3.55] |
| **UX-LOT-01** — Lot de finitions remontées en recette (UX-02, UX-03, UX-04) | `recette` | `feature/uxlot01-finitions-recette` | [3.53, 3.54, 7.18] |
| **CONF-07** — Accessibilité — solde des non-conformités WCAG AA | `validation` | `fix/conf07-accessibilite` | [9.11, 9.12] |
| **MUSC-F1b** — Muscles ciblés sur schéma corporel | `validation` | `feature/muscf1b-schema-muscles` | [6.2] |
| **MUSC-F9** — Décalage d'une séance planifiée en glisser-déposer | `validation` | `feature/muscf9-planning-glisser-deposer` | [3.10] |
| **RUN-F3** — Résumé de course enrichi — objectif atteint et conditions | `validation` | `feature/runf3-resume-course-enrichi` | [5.24, 5.25] |

⏳ **15 US attendent une recette humaine** (ADMIN-01, BIEN-01, BILAN-01, CONTENU-01, CYCLE-01, MESUR-01, MUSC-F14, MUSC-F8, NUTR-F1, NUTR-F2, OBJ-01, PARTAGE-01, STREAK-01, UX-05, UX-LOT-01) — critères cochables dans [RECETTES.md](RECETTES.md).

## ➡️ Prochain — P0 bloquant (2)

- LANCE-00 — Compte développeur Google Play
- LANCE-01 — Publication Play Store

<details><summary>P1 finitions (5) · P2 confort (2)</summary>

**P1** — MUSC-F7 — Progression assistée · MUSC-F6 — Fenêtre de reprise de séance · RUN-F2 — Séances guidées vocales · RUN-F3b — Météo de course · RUN-F1b — Dénivelé cumulé

**P2** — REFACTO-01 — Unifier la décision d'accès par pilier · SOCLE-01 — RevenueCat câblé inactif

</details>

Détail et points durs : [BACKLOG.md](BACKLOG.md).

## 🩺 Santé du dépôt

| | |
|---|---|
| Branche courante | `feature/cycle01-suivi-menstruel` (propre) |
| Commits | 991 · `main` a **988** commits de retard sur `dev` |
| Specs d'US | 94 au total — 75 clôturées, 19 en cours |
| Migrations | 60/60 poussées sur le cloud |
| Tests | `npm run test` — **⚠️ lire le code de sortie sans pipe** (un `tail` en aval masque l'échec) |

✅ Aucune alerte.

## 🕒 Derniers commits

- `e5efdde` feat(cycle01): synchro Health Connect du cycle (permissions, push/import, dédup R21)
- `4e9c2c3` feat(cycle01): calendrier mensuel, croisement complet, tests smoke (US CYCLE-01, 1.25/1.26)
- `e947659` docs(roadmap): réactualise les compteurs après CYCLE-01 (1.25/1.26 → 🟡)
- `b460410` feat(cycle01): réglages, désactivation et écran de croisement
- `1fa7eee` feat(cycle01): opt-in, widget 3 formes et écrans de saisie

---

**Où trouver quoi** · [BACKLOG.md](BACKLOG.md) reste-à-faire · [roadmap](docs/roadmap/roadmap.md)
périmètre complet · [catalogue d'analyses](docs/product/analyses-donnees.md) ·
[IDEAS.md](IDEAS.md) idées non cadrées · [CHANGELOG.md](CHANGELOG.md) historique ·
[docs/journal/](docs/journal/) archives du suivi.
