---
description: Démarre et implémente une US — identifiant, branche, spec écrite avec le code, tests, front-matter, entrée de suivi
argument-hint: <identifiant ou description courte de l'US>
allowed-tools: Bash(git status:*), Bash(git fetch:*), Bash(git checkout:*), Bash(git branch:*), Bash(git rev-parse:*), Bash(git log:*), Bash(git diff:*), Bash(node scripts/etat.mjs:*), Bash(npm:*), Bash(npx:*), Read, Edit, Write, Glob, Grep, Skill, Task
---

Tu fais entrer une user story dans le pipeline **et tu l'implémentes**. Sujet : `$ARGUMENTS`

Depuis le 23/10/2026, **on code directement** : pas de spec, de plan ni de maquette à faire valider
avant le code ([CLAUDE.md](../../CLAUDE.md#workflow-par-fonctionnalité--dev-direct-depuis-le-23102026)).
La spec s'écrit **avec** le code ; elle reste la trace de l'US.

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
   Jamais de travail sur `main` ; sur `dev` seulement si Florian l'a demandé.

4. **Pose la spec dès le départ** dans `docs/specs/functional/us/<slug>.md`, **front-matter en tête** :

   ```yaml
   ---
   id: <identifiant>
   titre: "<titre nu, sans le préfixe « US … — »>"
   roadmap: [<numéros couverts>]     # [] si aucun
   catalogue: [<réfs analyses-donnees>]  # [] si aucune
   etape: code
   branche: <type>/<slug>
   maj: JJ/MM/AAAA
   ---
   ```

   Quelques lignes suffisent à ce stade : le périmètre et les règles que tu vas coder.

5. **Une seule porte avant le code** : une question **qui change le produit** — règle métier
   ambiguë, donnée de santé, coût d'IA, texte légal, action sur le cloud (`db:push`, déploiement,
   secrets) — se pose à Florian ou Damien et s'attend. Tout le reste se tranche : note la décision
   dans la spec (`D1`, `D2`…) et avance.

6. **Implémente** par incréments bornés, **tests d'abord** : la logique pure dans `packages/shared`,
   les requêtes des repositories sur le harnais SQLite
   ([stratégie de tests](../../docs/specs/technical/strategie-tests.md)). Une migration suit le cycle
   de [CLAUDE.md](../../CLAUDE.md#migrations-base-de-données-obligatoire) ; une table synchronisée
   neuve impose de coller les sync rules PowerSync et de cocher le collage dans
   [MIGRATIONS.md](../../supabase/MIGRATIONS.md#déploiements-des-sync-rules-powersync).
   Un plan (`docs/plans/<slug>.md`) seulement si le chantier dépasse une session ou se partage entre
   plusieurs sessions.

7. **Complète la spec** avant de commiter : règles métier, cas limites, **i18n FR+EN**,
   **comportement offline**, décisions prises en route, et **ce qui n'est pas fait** (à reporter au
   [BACKLOG](../../BACKLOG.md) si ça doit l'être).

8. **Commite via [`/commit`](commit.md)** : qualité verte → `etape: close`, roadmap, CHANGELOG,
   [ETAT.md](../../ETAT.md), push sur `dev`.

## Si un cadrage est demandé d'abord

Si Florian ou Damien demande explicitement d'analyser, de proposer ou de maquetter avant de coder :
livre ce cadrage (spec, plan, maquette dans `design/<slug>/`), passe `etape: validation`, régénère
l'état (`node scripts/etat.mjs`) et **arrête-toi** jusqu'à son retour.

## Recette

Pas d'étape de recette. Si une vérification sur device est demandée, donne dans la conversation quoi
dérouler ([CLAUDE.md](../../CLAUDE.md#recette-à-la-demande-depuis-le-23102026)).
