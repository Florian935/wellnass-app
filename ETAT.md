# État du projet — 26/10/2026

> 🤖 **Fichier généré.** Ne pas l'éditer à la main : il est réécrit par `node scripts/etat.mjs`
> (skill [`/etat`](.claude/commands/etat.md)) à partir du front-matter des specs, de
> [BACKLOG.md](BACKLOG.md), de la [roadmap](docs/roadmap/roadmap.md), du registre des migrations
> et de git. Pour changer une ligne, **corrige la source puis relance**.

## 🎯 Cap

**MVP1 (= V1.0 complète)** `███████████████████░` **96 %** — 274 livré · 4 partiel · 2 à faire (sur 286)

Version en cours : **V0.8 — bêta : conformité & intégrations**. Il reste **4 candidats P0**
avant de pouvoir publier.

## 🔨 En cours

| US | Étape | Branche | Roadmap |
|---|---|---|---|
| **IMPORT-01** — Import de données depuis d'autres apps — GPX (Strava), CSV (Hevy, Strong, MyFitnessPal) ⏸️ | `validation` *(en pause)* | `feature/import01-import-donnees-externes` | [1.20] |

⏸️ **1 US en pause sur une dépendance externe** :
- **IMPORT-01** — En attente d'un export réel de Hevy, Strong et MyFitnessPal pour figer les alias de colonnes (D4). Procédure et jeu de données attendu : docs/specs/technical/import-samples/README.md

## ➡️ Prochain — P0 bloquant (4)

- LANCE-00 — Compte développeur Google Play
- LANCE-01 — Publication Play Store
- LANCE-03 — Retirer le spike 3D de « Mon corps » du build de soumission
- LANCE-02 — Retirer le spike VBT-01 du build de soumission

<details><summary>P1 finitions (13) · P2 confort (12)</summary>

**P1** — PRISME-01b — Les résumés du Labo dans la voix de Prisme · RUN-F3b — Météo de course · CARDIO-03 — Écran de départ + saisie rétroactive · CARDIO-04 — Historique en trois onglets · CARDIO-05 — Éditeur de séance à trois niveaux · CARDIO-06 — Les semaines qui progressent · CARDIO-07 — Import GPX et Health Connect · TRAD-01 — Les aliments CIQUAL en anglais · SIGNOUT-01 — La déconnexion ne vide pas la base locale · LABO-05 — Deux constats ouverts de la revue du Labo · CONTENU-02 — Relire les contenus écrits sans coach · IDENT-02 — L'identité des écrans empilés du Bien-être et du Labo · BARRE-01 — La barre d'état suit le dernier composant monté, pas l'écran affiché

**P2** — CARDIO-09 — L'arrivée dit quand l'allure de référence change · PRISME-02 — La photo de repas, avec Prisme · SOCLE-01 — RevenueCat câblé inactif · VBT-01 — Vitesse de barre à la caméra · CIBLE-02 — Une séance planifiée d'un pilier éteint donne-t-elle le forfait ? · CIBLE-03 — La séance marquée faite sans séance enregistrée · CIBLE-05 — Les fenêtres jugées sur la cible d'aujourd'hui · CIBLE-06 — La cible du contexte du Labo IA · CALIB-01 — Calibrer les seuils posés sans mesure · MUSC-F14b — « Remplacer » dans l'éditeur de programme · MUSCU-UX01b — Les manques de l'historique muscu · CLAV-02 — Le champ actif remonte seul sur iOS

</details>

Détail et points durs : [BACKLOG.md](BACKLOG.md).

## 🩺 Santé du dépôt

| | |
|---|---|
| Branche courante | `feature/accueil08-ta-journee` (modifications non commitées) |
| Commits | 1391 · `main` a **1388** commits de retard sur `dev` |
| Specs d'US | 199 au total — 198 clôturées, 1 en cours |
| Migrations | 115/116 poussées sur le cloud |
| Tests | `npm run test` — **⚠️ lire le code de sortie sans pipe** (un `tail` en aval masque l'échec) |

### ⚠️ Alertes

- ⚠️ 1 migration(s) non poussée(s) sur le cloud
- ⚠️ Working tree : modifications non commitées

## 🕒 Derniers commits

- `b533e1d`  fix(accueil): ACCUEIL-07 — l'accueil dit vrai, et prend la teinte Aurore
- `d8fe320`  fix(identite): IDENT-01 — l'identité de pilier appartient à l'écran, pas à l'onglet
- `0cc173e`  feat(course): CARDIO-02 — les quatre portes vers l'allure de référence, l'accueil du pilier, le test de 12 minutes
- `9ef1824`  feat(course): CARDIO-02 socle — les portes calculent, l'allure ne recule plus au premier footing
- `f02b9a6`  docs(course): CARDIO-02 cadrée — les quatre portes vers l'allure de référence

---

**Où trouver quoi** · [BACKLOG.md](BACKLOG.md) reste-à-faire · [roadmap](docs/roadmap/roadmap.md)
périmètre complet · [catalogue d'analyses](docs/product/analyses-donnees.md) ·
[IDEAS.md](IDEAS.md) idées non cadrées · [CHANGELOG.md](CHANGELOG.md) historique ·
[docs/journal/](docs/journal/) archives du suivi.
