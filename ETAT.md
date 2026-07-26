# État du projet — 26/07/2026

> 🤖 **Fichier généré.** Ne pas l'éditer à la main : il est réécrit par `node scripts/etat.mjs`
> (skill [`/etat`](.claude/commands/etat.md)) à partir du front-matter des specs, de
> [BACKLOG.md](BACKLOG.md), de la [roadmap](docs/roadmap/roadmap.md), du registre des migrations
> et de git. Pour changer une ligne, **corrige la source puis relance**.

## 🎯 Cap

**MVP1 (= V1.0 complète)** `█████████████████░░░` **83 %** — 161 livré · 11 partiel · 17 à faire (sur 194)

Version en cours : **V0.8 — bêta : conformité & intégrations**. Il reste **3 candidats P0**
avant de pouvoir publier.

## 🔨 En cours

| US | Étape | Branche | Roadmap |
|---|---|---|---|
| **CONTENU-01** — Seed des bibliothèques de programmes (muscu + course) | `validation` | `docs/contenu-01-spec` | [3.1, 5.2] |

## ➡️ Prochain — P0 bloquant (3)

- CONF-06 — Health Connect
- CONF-07 — Accessibilité
- LANCE-01 — Publication Play Store

<details><summary>P1 finitions (8) · P2 confort (2)</summary>

**P1** — MUSC-F7 — Progression assistée · MUSC-F8 — Notifications push muscu · MUSC-F9 — Décalage en glisser-déposer · MUSC-F1b — Muscles ciblés sur schéma SVG · MUSC-F6 — Fenêtre de reprise de séance · RUN-F2 — Séances guidées vocales · RUN-F3 — Résumé de course enrichi · RUN-F1b — Dénivelé cumulé

**P2** — NUTR-F1 — Rappels programmés nutrition · SOCLE-01 — RevenueCat câblé inactif

</details>

Détail et points durs : [BACKLOG.md](BACKLOG.md).

## 🩺 Santé du dépôt

| | |
|---|---|
| Branche courante | `docs/refonte-suivi-avancement` (modifications non commitées) |
| Commits | 940 · `main` a **937** commits de retard sur `dev` |
| Specs d'US | 74 au total — 73 clôturées, 1 en cours |
| Migrations | 44/44 poussées sur le cloud |
| Tests | `npm run test` — **⚠️ lire le code de sortie sans pipe** (un `tail` en aval masque l'échec) |

### ⚠️ Alertes

- ⚠️ Working tree : modifications non commitées

## 🕒 Derniers commits

- `09899ca` chore(eas): versionne le Client ID Google, écarte la clé MapTiler du dépôt public
- `d8cd84c` docs(ux01): clôture US UX-01 + relecture croisée non requise + doc environnement de dev local
- `77088f9` merge: intègre origin/dev (12 commits) dans feature/ux01-infobulle-graphiques
- `a1ea008` feat(workout): brique deload / gestion de stagnation (3.8, non cablee)
- `e6adb02` docs(roadmap): reconciliation code -> roadmap (finitions muscu/course)

---

**Où trouver quoi** · [BACKLOG.md](BACKLOG.md) reste-à-faire · [roadmap](docs/roadmap/roadmap.md)
périmètre complet · [catalogue d'analyses](docs/product/analyses-donnees.md) ·
[IDEAS.md](IDEAS.md) idées non cadrées · [CHANGELOG.md](CHANGELOG.md) historique ·
[docs/journal/](docs/journal/) archives du suivi.
