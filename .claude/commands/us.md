---
description: Démarre une nouvelle US — branche, spec, plan, maquette, front-matter, entrée de suivi
argument-hint: <identifiant ou description courte de l'US>
allowed-tools: Bash(git status:*), Bash(git fetch:*), Bash(git checkout:*), Bash(git branch:*), Bash(git rev-parse:*), Bash(node scripts/etat.mjs:*), Read, Edit, Write, Glob, Grep, Skill
---

Tu fais entrer une nouvelle user story dans le pipeline. Sujet : `$ARGUMENTS`

⚠️ **Aucune ligne de code applicatif n'est écrite par cette commande.** Elle produit les livrables
d'amont (spec, plan, maquette) et s'arrête à la validation humaine — c'est la règle du projet
([CLAUDE.md](../../CLAUDE.md#workflow-obligatoire-par-fonctionnalité-primordial)).

## Étapes

1. **Identifie la demande.** Cherche-la d'abord dans [BACKLOG.md](../../BACKLOG.md), la
   [roadmap](../../docs/roadmap/roadmap.md), le
   [catalogue d'analyses](../../docs/product/analyses-donnees.md) et [IDEAS.md](../../IDEAS.md).
   Si elle y est, reprends son identifiant et son point dur. Sinon, c'est une entrée neuve : dis-le.

2. **Attribue un identifiant et un numéro de roadmap.**
   - Identifiant court et stable : `CONF-06`, `MUSC-F8`, `RUN-F2`…
   - S'il s'agit d'une fonctionnalité **absente de la roadmap**, attribue-lui un **numéro thématique
     libre** (1.x compte · 2.x navigation · 3.x muscu · 4.x alim · 5.x running · 6.x visualisation ·
     7.x dashboard · 8.x admin · 9.x technique) et **ajoute la ligne à la roadmap** dans la section
     « Hors périmètre de cadrage ». ⚠️ **Vérifie que le numéro est libre** — on a déjà eu une
     collision (4.5).

3. **Crée la branche** depuis `dev` : `git fetch origin` puis
   `git checkout -b <type>/<slug> origin/dev`, type ∈ `feature` `fix` `chore` `docs` `refactor`.
   Jamais de travail sur `main` ni `dev`.

4. **Écris la spec** dans `docs/specs/functional/us/<slug>.md`, **front-matter en tête** :

   ```yaml
   ---
   id: <identifiant>
   titre: "<titre nu, sans le préfixe « US … — »>"
   roadmap: [<numéros couverts>]     # [] si aucun
   catalogue: [<réfs analyses-donnees>]  # [] si aucune
   etape: spec
   branche: <type>/<slug>
   maj: JJ/MM/AAAA
   ---
   ```

   Contenu : périmètre, règles métier, cas limites, **i18n FR+EN**, **comportement offline**,
   critères de recette. Fais-toi relire (agent de revue) avant de la soumettre.

5. **Écris le plan** dans `docs/plans/<slug>.md` : découpage en tâches TDD, fichiers touchés, tests
   prévus, ordre de build, **migration éventuelle** (et si oui : sync rules PowerSync à redéployer ?).
   Passe `etape: plan`.

6. **Produis la maquette** dans `design/<slug>/` (Claude Design). Passe `etape: design`.

7. **Passe `etape: validation`**, régénère l'état (`node scripts/etat.mjs`) et **arrête-toi** :
   demande explicitement la validation de **Florian ou Damien** sur les 3 livrables.
   **Pas de code tant que ce n'est pas validé.**

## Après validation (rappel, hors périmètre de cette commande)

`etape: code` → implémentation par incréments → `etape: recette` → recette device →
`etape: relecture` si une relecture croisée est demandée → `etape: close`.
Chaque transition passe par [`/commit`](commit.md), qui régénère [ETAT.md](../../ETAT.md).
