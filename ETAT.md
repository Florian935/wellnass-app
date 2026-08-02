# État du projet — 02/08/2026

> 🤖 **Fichier généré.** Ne pas l'éditer à la main : il est réécrit par `node scripts/etat.mjs`
> (skill [`/etat`](.claude/commands/etat.md)) à partir du front-matter des specs, de
> [BACKLOG.md](BACKLOG.md), de la [roadmap](docs/roadmap/roadmap.md), du registre des migrations
> et de git. Pour changer une ligne, **corrige la source puis relance**.

## 🎯 Cap

**MVP1 (= V1.0 complète)** `█████████████████░░░` **85 %** — 182 livré · 16 partiel · 9 à faire (sur 213)

Version en cours : **V0.8 — bêta : conformité & intégrations**. Il reste **2 candidats P0**
avant de pouvoir publier.

## 🔨 En cours

| US | Étape | Branche | Roadmap |
|---|---|---|---|
| **ADMIN-01** — Archivage sûr du contenu éditorial (back-office) | `recette` | `feature/admin01-archivage-sur` | [8.11] |
| **BIEN-01** — Check-in quotidien & journal de bien-être | `recette` | `feature/bien01-checkin-bien-etre` | [1.24] |
| **BILAN-01** — Bilan hebdomadaire automatique | `recette` | `feature/bilan01-bilan-hebdo` | [7.16] |
| **CONF-07** — Accessibilité — solde des non-conformités WCAG AA | `recette` | `fix/conf07-accessibilite` | [9.11, 9.12] |
| **CONTENU-01** — Seed des bibliothèques de programmes (muscu + course) | `recette` | `docs/contenu-01-spec` | [3.1, 5.2] |
| **CYCLE-01** — Suivi du cycle menstruel — journal, prédiction et croisement | `recette` | `feature/cycle01-suivi-menstruel` | [1.25, 1.26] |
| **MESUR-01** — Mensurations corporelles | `recette` | `feature/mesur01-mensurations` | [3.51] |
| **MUSC-F14** — Suggestion de substitution d'exercice | `recette` | `feature/muscf14-substitution-exercice` | [3.52] |
| **MUSC-F1b** — Muscles ciblés sur schéma corporel — anatomie fine | `recette` | `feature/muscf1b-schema-muscles` | [6.2] |
| **MUSC-F7** — Progression assistée — deload sur stagnation | `recette` | `feature/muscf7-deload` | [3.8] |
| **MUSC-F8** — Notifications muscu — push de record agrégé, célébration animée, rappel de séance | `recette` | `feature/muscf8-notifications-muscu` | [3.42, 2.7, 2.4] |
| **MUSC-F9** — Décalage d'une séance planifiée en glisser-déposer | `recette` | `feature/muscf9-planning-glisser-deposer` | [3.10] |
| **NUTR-F1** — Rappels programmés nutrition — repas et pesée, à l'échéance apprise | `recette` | `feature/nutrf1-rappels-nutrition` | [1.14, 2.5] |
| **NUTR-F2** — Suggestion d'aliments pour combler un macro | `recette` | `feature/nutrf2-substitution-aliments` | [4.37] |
| **OBJ-01** — Objectifs personnels à échéance | `recette` | `feature/obj01-objectifs` | [7.15] |
| **PARTAGE-01** — Carte de séance / course partageable | `recette` | `feature/partage01-carte-partageable` | [7.17] |
| **RUN-F3** — Résumé de course enrichi — objectif atteint et conditions | `recette` | `feature/runf3-resume-course-enrichi` | [5.24, 5.25] |
| **STREAK-01** — Joker de série (gel d'un jour manqué) | `recette` | `feature/streak01-joker` | [7.14] |
| **UX-05** — Intensité en RPE ou en RIR, au choix | `recette` | `feature/ux05-rpe-ou-rir` | [3.55] |
| **UX-LOT-01** — Lot de finitions remontées en recette (UX-02, UX-03, UX-04) | `recette` | `feature/uxlot01-finitions-recette` | [3.53, 3.54, 7.18] |

⏳ **20 US attendent une recette humaine** (ADMIN-01, BIEN-01, BILAN-01, CONF-07, CONTENU-01, CYCLE-01, MESUR-01, MUSC-F14, MUSC-F1b, MUSC-F7, MUSC-F8, MUSC-F9, NUTR-F1, NUTR-F2, OBJ-01, PARTAGE-01, RUN-F3, STREAK-01, UX-05, UX-LOT-01) — critères cochables dans [RECETTES.md](RECETTES.md).

## ➡️ Prochain — P0 bloquant (2)

- LANCE-00 — Compte développeur Google Play
- LANCE-01 — Publication Play Store

<details><summary>P1 finitions (4) · P2 confort (1)</summary>

**P1** — Progression au niveau du programme (roadmap 3.7) · RUN-F2 — Séances guidées vocales · RUN-F3b — Météo de course · RUN-F1b — Dénivelé cumulé

**P2** — SOCLE-01 — RevenueCat câblé inactif

</details>

Détail et points durs : [BACKLOG.md](BACKLOG.md).

## 🩺 Santé du dépôt

| | |
|---|---|
| Branche courante | `fix/planning-preview-pillar-label` (modifications non commitées) |
| Commits | 1008 · `main` a **1005** commits de retard sur `dev` |
| Specs d'US | 97 au total — 77 clôturées, 20 en cours |
| Migrations | 65/65 poussées sur le cloud |
| Tests | `npm run test` — **⚠️ lire le code de sortie sans pipe** (un `tail` en aval masque l'échec) |

### ⚠️ Alertes

- ⚠️ Working tree : modifications non commitées

## 🕒 Derniers commits

- `6f0fc5d` fix(dette): accessibilité (chips, Segment, Button) + seed.sql en migration idempotente
- `54bf80b` feat(muscf1b): schéma corporel — anatomie fine additive (US MUSC-F1b, 6.2)
- `a293ba8` feat(muscf9): glisser-déposer du planning + retour haptique (US MUSC-F9, 3.10)
- `1773aaf` feat(runf3): comparaison à l'objectif de course + terrain (roadmap 5.25, D3)
- `4d6594d` fix(conf07): corrige les 5 non-conformités WCAG AA restantes (roadmap 9.11/9.12)

---

**Où trouver quoi** · [BACKLOG.md](BACKLOG.md) reste-à-faire · [roadmap](docs/roadmap/roadmap.md)
périmètre complet · [catalogue d'analyses](docs/product/analyses-donnees.md) ·
[IDEAS.md](IDEAS.md) idées non cadrées · [CHANGELOG.md](CHANGELOG.md) historique ·
[docs/journal/](docs/journal/) archives du suivi.
