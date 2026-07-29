# État du projet — 29/07/2026

> 🤖 **Fichier généré.** Ne pas l'éditer à la main : il est réécrit par `node scripts/etat.mjs`
> (skill [`/etat`](.claude/commands/etat.md)) à partir du front-matter des specs, de
> [BACKLOG.md](BACKLOG.md), de la [roadmap](docs/roadmap/roadmap.md), du registre des migrations
> et de git. Pour changer une ligne, **corrige la source puis relance**.

## 🎯 Cap

**MVP1 (= V1.0 complète)** `████████████████░░░░` **81 %** — 168 livré · 13 partiel · 22 à faire (sur 208)

Version en cours : **V0.8 — bêta : conformité & intégrations**. Il reste **3 candidats P0**
avant de pouvoir publier.

## 🔨 En cours

| US | Étape | Branche | Roadmap |
|---|---|---|---|
| **ADMIN-01** — Archivage sûr du contenu éditorial (back-office) | `recette` | `feature/admin01-archivage-sur` | [8.11] |
| **BIEN-01** — Check-in quotidien & journal de bien-être | `recette` | `feature/bien01-checkin-bien-etre` | [1.24] |
| **CONTENU-01** — Seed des bibliothèques de programmes (muscu + course) | `recette` | `docs/contenu-01-spec` | [3.1, 5.2] |
| **MESUR-01** — Mensurations corporelles | `recette` | `feature/mesur01-mensurations` | [3.51] |
| **NUTR-F2** — Suggestion d'aliments pour combler un macro | `recette` | `feature/nutrf2-substitution-aliments` | [4.37] |
| **UX-LOT-01** — Lot de finitions remontées en recette (UX-02, UX-03, UX-04) | `recette` | `feature/uxlot01-finitions-recette` | [3.53, 3.54, 7.18] |

## ➡️ Prochain — P0 bloquant (3)

- CONF-07 — Accessibilité
- LANCE-00 — Compte développeur Google Play
- LANCE-01 — Publication Play Store

<details><summary>P1 finitions (11) · P2 confort (5)</summary>

**P1** — STREAK-01 — Joker / gel de streak · OBJ-01 — Objectifs personnels à échéance · BILAN-01 — Bilan hebdomadaire automatique · MUSC-F7 — Progression assistée · MUSC-F8 — Notifications push muscu · MUSC-F9 — Décalage en glisser-déposer · MUSC-F1b — Muscles ciblés sur schéma SVG · MUSC-F6 — Fenêtre de reprise de séance · RUN-F2 — Séances guidées vocales · RUN-F3 — Résumé de course enrichi · RUN-F1b — Dénivelé cumulé

**P2** — NUTR-F1 — Rappels programmés nutrition · PARTAGE-01 — Carte de séance / course partageable · MUSC-F14 — Suggestion de substitution d'exercice · UX-05 — RPE ou RIR au choix · SOCLE-01 — RevenueCat câblé inactif

</details>

Détail et points durs : [BACKLOG.md](BACKLOG.md).

## 🩺 Santé du dépôt

| | |
|---|---|
| Branche courante | `feature/nutrf2-substitution-aliments` (modifications non commitées) |
| Commits | 954 · `main` a **951** commits de retard sur `dev` |
| Specs d'US | 81 au total — 75 clôturées, 6 en cours |
| Migrations | 53/53 poussées sur le cloud |
| Tests | `npm run test` — **⚠️ lire le code de sortie sans pipe** (un `tail` en aval masque l'échec) |

### ⚠️ Alertes

- ⚠️ Working tree : modifications non commitées

## 🕒 Derniers commits

- `9704ece` feat(mesur01): mensurations corporelles — 6 mesures historisées, courbes et deltas (US MESUR-01, 3.51)
- `1d59fa7` feat(uxlot01): finitions de recette — états vides, cibles 48 dp, affordance de glissement (3.53/3.54/7.18)
- `911922b` feat(admin01): archivage sûr du contenu éditorial — décomptes, restauration, historique préservé (US ADMIN-01, 8.11)
- `44e567f` feat(contenu01): 3 programmes muscu publiés et bibliothèque nettoyée (US CONTENU-01, 3.1/5.2)
- `085cc71` docs(admin01): spec, plan et maquette de l'archivage sûr (US ADMIN-01, 8.11)

---

**Où trouver quoi** · [BACKLOG.md](BACKLOG.md) reste-à-faire · [roadmap](docs/roadmap/roadmap.md)
périmètre complet · [catalogue d'analyses](docs/product/analyses-donnees.md) ·
[IDEAS.md](IDEAS.md) idées non cadrées · [CHANGELOG.md](CHANGELOG.md) historique ·
[docs/journal/](docs/journal/) archives du suivi.
