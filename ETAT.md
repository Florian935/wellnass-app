# État du projet — 23/10/2026

> 🤖 **Fichier généré.** Ne pas l'éditer à la main : il est réécrit par `node scripts/etat.mjs`
> (skill [`/etat`](.claude/commands/etat.md)) à partir du front-matter des specs, de
> [BACKLOG.md](BACKLOG.md), de la [roadmap](docs/roadmap/roadmap.md), du registre des migrations
> et de git. Pour changer une ligne, **corrige la source puis relance**.

## 🎯 Cap

**MVP1 (= V1.0 complète)** `███████████████████░` **96 %** — 271 livré · 4 partiel · 2 à faire (sur 283)

Version en cours : **V0.8 — bêta : conformité & intégrations**. Il reste **4 candidats P0**
avant de pouvoir publier.

## 🔨 En cours

| US | Étape | Branche | Roadmap |
|---|---|---|---|
| **IDENT-01** — L'identité de pilier appartient à l'écran, pas à l'onglet — les écrans empilés de Musculation et de Nutrition déclarent leur pilier | `code` | `fix/ident01-identite-pilier-ecran` | [3.63, 4.46] |
| **IMPORT-01** — Import de données depuis d'autres apps — GPX (Strava), CSV (Hevy, Strong, MyFitnessPal) ⏸️ | `validation` *(en pause)* | `feature/import01-import-donnees-externes` | [1.20] |

⏸️ **1 US en pause sur une dépendance externe** :
- **IMPORT-01** — En attente d'un export réel de Hevy, Strong et MyFitnessPal pour figer les alias de colonnes (D4). Procédure et jeu de données attendu : docs/specs/technical/import-samples/README.md

## ➡️ Prochain — P0 bloquant (4)

- LANCE-00 — Compte développeur Google Play
- LANCE-01 — Publication Play Store
- LANCE-03 — Retirer le spike 3D de « Mon corps » du build de soumission
- LANCE-02 — Retirer le spike VBT-01 du build de soumission

<details><summary>P1 finitions (15) · P2 confort (11)</summary>

**P1** — PRISME-01b — Les résumés du Labo dans la voix de Prisme · RUN-F3b — Météo de course · CARDIO-02 — Les quatre portes vers l'allure de référence · CARDIO-03 — Écran de départ + saisie rétroactive · CARDIO-04 — Historique en trois onglets · CARDIO-05 — Éditeur de séance à trois niveaux · CARDIO-06 — Les semaines qui progressent · CARDIO-07 — Import GPX et Health Connect · TRAD-01 — Les aliments CIQUAL en anglais · SIGNOUT-01 — La déconnexion ne vide pas la base locale · LABO-05 — Deux constats ouverts de la revue du Labo · CONTENU-02 — Relire les contenus écrits sans coach · IDENT-02 — L'identité des écrans empilés du Bien-être et du Labo · BARRE-01 — La barre d'état suit le dernier composant monté, pas l'écran affiché · VIE-02 — La « reprise en douceur » de l'Accueil mène à une route qui n'existe pas

**P2** — PRISME-02 — La photo de repas, avec Prisme · SOCLE-01 — RevenueCat câblé inactif · VBT-01 — Vitesse de barre à la caméra · CIBLE-02 — Une séance planifiée d'un pilier éteint donne-t-elle le forfait ? · CIBLE-03 — La séance marquée faite sans séance enregistrée · CIBLE-05 — Les fenêtres jugées sur la cible d'aujourd'hui · CIBLE-06 — La cible du contexte du Labo IA · CALIB-01 — Calibrer les seuils posés sans mesure · MUSC-F14b — « Remplacer » dans l'éditeur de programme · MUSCU-UX01b — Les manques de l'historique muscu · CLAV-02 — Le champ actif remonte seul sur iOS

</details>

Détail et points durs : [BACKLOG.md](BACKLOG.md).

## 🩺 Santé du dépôt

| | |
|---|---|
| Branche courante | `HEAD` (modifications non commitées) |
| Commits | 1384 · `main` a **1381** commits de retard sur `dev` |
| Specs d'US | 196 au total — 194 clôturées, 2 en cours |
| Migrations | 115/116 poussées sur le cloud |
| Tests | `npm run test` — **⚠️ lire le code de sortie sans pipe** (un `tail` en aval masque l'échec) |

### ⚠️ Alertes

- ⚠️ 1 migration(s) non poussée(s) sur le cloud
- ⚠️ Working tree : modifications non commitées

## 🕒 Derniers commits

- `ae9db4f`  fix(course): CARDIO-08 — l'analyse d'une sortie dit le même « X sur Y dans la plage » que le hub
- `b599bf8`  fix(labo): CIBLE-04 — le Labo « Et si… » et le Conseil des trois partent du socle de la cible du jour
- `9bcebe5`  docs(cardio): CARDIO-08 cadrée, relue et validée (D1 à D4) — spec, plan, BACKLOG
- `788baac`  docs(identite): IDENT-01 cadrée, relue et validée (D1 à D12) — spec, plan, BACKLOG
- `25c741f`  chore(suivi): fin de la recette consignée — RECETTES.md supprimé, une US passe de code à close

---

**Où trouver quoi** · [BACKLOG.md](BACKLOG.md) reste-à-faire · [roadmap](docs/roadmap/roadmap.md)
périmètre complet · [catalogue d'analyses](docs/product/analyses-donnees.md) ·
[IDEAS.md](IDEAS.md) idées non cadrées · [CHANGELOG.md](CHANGELOG.md) historique ·
[docs/journal/](docs/journal/) archives du suivi.
