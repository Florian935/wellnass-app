# État du projet — 30/07/2026

> 🤖 **Fichier généré.** Ne pas l'éditer à la main : il est réécrit par `node scripts/etat.mjs`
> (skill [`/etat`](.claude/commands/etat.md)) à partir du front-matter des specs, de
> [BACKLOG.md](BACKLOG.md), de la [roadmap](docs/roadmap/roadmap.md), du registre des migrations
> et de git. Pour changer une ligne, **corrige la source puis relance**.

## 🎯 Cap

**MVP1 (= V1.0 complète)** `█████████████████░░░` **83 %** — 174 livré · 20 partiel · 10 à faire (sur 210)

Version en cours : **V0.8 — bêta : conformité & intégrations**. Il reste **2 candidats P0**
avant de pouvoir publier.

## 🔨 En cours

| US | Étape | Branche | Roadmap |
|---|---|---|---|
| **ADMIN-01** — Archivage sûr du contenu éditorial (back-office) | `recette` | `feature/admin01-archivage-sur` | [8.11] |
| **BIEN-01** — Check-in quotidien & journal de bien-être | `recette` | `feature/bien01-checkin-bien-etre` | [1.24] |
| **BILAN-01** — Bilan hebdomadaire automatique | `recette` | `feature/bilan01-bilan-hebdo` | [7.16] |
| **CONTENU-01** — Seed des bibliothèques de programmes (muscu + course) | `recette` | `docs/contenu-01-spec` | [3.1, 5.2] |
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
| **MUSC-F9** — Décalage d'une séance planifiée en glisser-déposer | `validation` | `feature/muscf9-planning-glisser-deposer` | [3.10] |

⏳ **14 US attendent une recette humaine** (ADMIN-01, BIEN-01, BILAN-01, CONTENU-01, MESUR-01, MUSC-F14, MUSC-F8, NUTR-F1, NUTR-F2, OBJ-01, PARTAGE-01, STREAK-01, UX-05, UX-LOT-01) — critères cochables dans [RECETTES.md](RECETTES.md).

## ➡️ Prochain — P0 bloquant (2)

- LANCE-00 — Compte développeur Google Play
- LANCE-01 — Publication Play Store

<details><summary>P1 finitions (6) · P2 confort (2)</summary>

**P1** — MUSC-F7 — Progression assistée · MUSC-F1b — Muscles ciblés sur schéma SVG · MUSC-F6 — Fenêtre de reprise de séance · RUN-F2 — Séances guidées vocales · RUN-F3 — Résumé de course enrichi · RUN-F1b — Dénivelé cumulé

**P2** — REFACTO-01 — Unifier la décision d'accès par pilier · SOCLE-01 — RevenueCat câblé inactif

</details>

Détail et points durs : [BACKLOG.md](BACKLOG.md).

## 🩺 Santé du dépôt

| | |
|---|---|
| Branche courante | `feature/muscf9-planning-glisser-deposer` (modifications non commitées) |
| Commits | 978 · `main` a **975** commits de retard sur `dev` |
| Specs d'US | 91 au total — 75 clôturées, 16 en cours |
| Migrations | 58/58 poussées sur le cloud |
| Tests | `npm run test` — **⚠️ lire le code de sortie sans pipe** (un `tail` en aval masque l'échec) |

### ⚠️ Alertes

- ⚠️ Working tree : modifications non commitées

## 🕒 Derniers commits

- `45abd7c` docs(lance00): rédige la fiche Play et la politique de confidentialité
- `0df5e02` docs(conf07): cadre l'accessibilité — 5 non-conformités WCAG restantes
- `cf17e5c` feat(partage01): carte de partage — charte alignée sur le thème sombre
- `56ea41d` merge: intègre origin/dev dans la refonte nutrition
- `e3abfa3` feat(nutrition): refonte visuelle du journal alimentaire

---

**Où trouver quoi** · [BACKLOG.md](BACKLOG.md) reste-à-faire · [roadmap](docs/roadmap/roadmap.md)
périmètre complet · [catalogue d'analyses](docs/product/analyses-donnees.md) ·
[IDEAS.md](IDEAS.md) idées non cadrées · [CHANGELOG.md](CHANGELOG.md) historique ·
[docs/journal/](docs/journal/) archives du suivi.
