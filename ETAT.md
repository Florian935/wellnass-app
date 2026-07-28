# État du projet — 28/07/2026

> 🤖 **Fichier généré.** Ne pas l'éditer à la main : il est réécrit par `node scripts/etat.mjs`
> (skill [`/etat`](.claude/commands/etat.md)) à partir du front-matter des specs, de
> [BACKLOG.md](BACKLOG.md), de la [roadmap](docs/roadmap/roadmap.md), du registre des migrations
> et de git. Pour changer une ligne, **corrige la source puis relance**.

## 🎯 Cap

**MVP1 (= V1.0 complète)** `████████████████░░░░` **78 %** — 163 livré · 11 partiel · 29 à faire (sur 208)

Version en cours : **V0.8 — bêta : conformité & intégrations**. Il reste **3 candidats P0**
avant de pouvoir publier.

## 🔨 En cours

| US | Étape | Branche | Roadmap |
|---|---|---|---|
| **CONTENU-01** — Seed des bibliothèques de programmes (muscu + course) | `validation` | `docs/contenu-01-spec` | [3.1, 5.2] |

## ➡️ Prochain — P0 bloquant (3)

- CONF-07 — Accessibilité
- LANCE-00 — Compte développeur Google Play
- LANCE-01 — Publication Play Store

<details><summary>P1 finitions (18) · P2 confort (5)</summary>

**P1** — ADMIN-01 — Archivage sûr du contenu éditorial · BIEN-01 — Check-in quotidien & journal de bien-être · MESUR-01 — Mensurations corporelles · STREAK-01 — Joker / gel de streak · OBJ-01 — Objectifs personnels à échéance · BILAN-01 — Bilan hebdomadaire automatique · NUTR-F2 — Substitution d'aliments pour combler un macro · UX-02 — Création d'exercice perso en modale · UX-03 — Cohérence fiche exercice perso / bibliothèque · UX-04 — Réagencement du dashboard découvrable · MUSC-F7 — Progression assistée · MUSC-F8 — Notifications push muscu · MUSC-F9 — Décalage en glisser-déposer · MUSC-F1b — Muscles ciblés sur schéma SVG · MUSC-F6 — Fenêtre de reprise de séance · RUN-F2 — Séances guidées vocales · RUN-F3 — Résumé de course enrichi · RUN-F1b — Dénivelé cumulé

**P2** — NUTR-F1 — Rappels programmés nutrition · PARTAGE-01 — Carte de séance / course partageable · MUSC-F14 — Suggestion de substitution d'exercice · UX-05 — RPE ou RIR au choix · SOCLE-01 — RevenueCat câblé inactif

</details>

Détail et points durs : [BACKLOG.md](BACKLOG.md).

## 🩺 Santé du dépôt

| | |
|---|---|
| Branche courante | `feature/pas01-pas-quotidiens` (modifications non commitées) |
| Commits | 944 · `main` a **940** commits de retard sur `dev` |
| Specs d'US | 76 au total — 75 clôturées, 1 en cours |
| Migrations | 47/47 poussées sur le cloud |
| Tests | `npm run test` — **⚠️ lire le code de sortie sans pipe** (un `tail` en aval masque l'échec) |

### ⚠️ Alertes

- ⚠️ Working tree : modifications non commitées

## 🕒 Derniers commits

- `73f91a8` docs(pas01): livrables d'amont validés — pas quotidiens (US PAS-01, 9.15)
- `aea2ab1` fix(health-connect): normalise les horodatages et rend les échecs visibles (US CONF-06 close, 9.9)
- `c682993` feat(health-connect): écriture des séances/courses et lecture du poids (US CONF-06, 9.9)
- `d54f05b` docs(suivi): refonte du suivi d'avancement — ETAT genere, BACKLOG, front-matter, roadmap reconciliee
- `09899ca` chore(eas): versionne le Client ID Google, écarte la clé MapTiler du dépôt public

---

**Où trouver quoi** · [BACKLOG.md](BACKLOG.md) reste-à-faire · [roadmap](docs/roadmap/roadmap.md)
périmètre complet · [catalogue d'analyses](docs/product/analyses-donnees.md) ·
[IDEAS.md](IDEAS.md) idées non cadrées · [CHANGELOG.md](CHANGELOG.md) historique ·
[docs/journal/](docs/journal/) archives du suivi.
