# État du projet — 28/07/2026

> 🤖 **Fichier généré.** Ne pas l'éditer à la main : il est réécrit par `node scripts/etat.mjs`
> (skill [`/etat`](.claude/commands/etat.md)) à partir du front-matter des specs, de
> [BACKLOG.md](BACKLOG.md), de la [roadmap](docs/roadmap/roadmap.md), du registre des migrations
> et de git. Pour changer une ligne, **corrige la source puis relance**.

## 🎯 Cap

**MVP1 (= V1.0 complète)** `█████████████████░░░` **84 %** — 162 livré · 11 partiel · 16 à faire (sur 194)

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

<details><summary>P1 finitions (8) · P2 confort (2)</summary>

**P1** — MUSC-F7 — Progression assistée · MUSC-F8 — Notifications push muscu · MUSC-F9 — Décalage en glisser-déposer · MUSC-F1b — Muscles ciblés sur schéma SVG · MUSC-F6 — Fenêtre de reprise de séance · RUN-F2 — Séances guidées vocales · RUN-F3 — Résumé de course enrichi · RUN-F1b — Dénivelé cumulé

**P2** — NUTR-F1 — Rappels programmés nutrition · SOCLE-01 — RevenueCat câblé inactif

</details>

Détail et points durs : [BACKLOG.md](BACKLOG.md).

## 🩺 Santé du dépôt

| | |
|---|---|
| Branche courante | `feature/conf06-health-connect` (modifications non commitées) |
| Commits | 942 · `main` a **939** commits de retard sur `dev` |
| Specs d'US | 75 au total — 74 clôturées, 1 en cours |
| Migrations | 45/45 poussées sur le cloud |
| Tests | `npm run test` — **⚠️ lire le code de sortie sans pipe** (un `tail` en aval masque l'échec) |

### ⚠️ Alertes

- ⚠️ Working tree : modifications non commitées

## 🕒 Derniers commits

- `c682993` feat(health-connect): écriture des séances/courses et lecture du poids (US CONF-06, 9.9)
- `d54f05b` docs(suivi): refonte du suivi d'avancement — ETAT genere, BACKLOG, front-matter, roadmap reconciliee
- `09899ca` chore(eas): versionne le Client ID Google, écarte la clé MapTiler du dépôt public
- `d8cd84c` docs(ux01): clôture US UX-01 + relecture croisée non requise + doc environnement de dev local
- `77088f9` merge: intègre origin/dev (12 commits) dans feature/ux01-infobulle-graphiques

---

**Où trouver quoi** · [BACKLOG.md](BACKLOG.md) reste-à-faire · [roadmap](docs/roadmap/roadmap.md)
périmètre complet · [catalogue d'analyses](docs/product/analyses-donnees.md) ·
[IDEAS.md](IDEAS.md) idées non cadrées · [CHANGELOG.md](CHANGELOG.md) historique ·
[docs/journal/](docs/journal/) archives du suivi.
