---
description: Analyse et relit le diff, met à jour CHANGELOG + TODO, commit propre et sûr, puis push sur dev
argument-hint: [sujet de commit optionnel]
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git rev-parse:*), Bash(git branch:*), Bash(git checkout:*), Bash(git merge:*), Bash(git fetch:*), Bash(git push:*), Bash(git log:*), Bash(npm:*), Bash(npx:*), Bash(pnpm:*), Read, Edit, Write, Task, Skill
---

Tu prépares et réalises un commit propre pour ce dépôt (Wellness App — RN/Expo + Supabase).

⚠️ **Garde-fou confidentialité** : ne committe **JAMAIS** de secrets ni de credentials —
`.env*`, clés Supabase (`service_role`), clés RevenueCat / Mapbox, `google-services.json`,
`GoogleService-Info.plist`, keystores et certificats (`*.keystore`, `*.jks`, `*.p12`,
`*.pem`, `*.key`), fichiers de credentials EAS. En cas de doute, **stoppe et préviens**.

Sujet fourni par l'utilisateur (optionnel) : `$ARGUMENTS`

Exécute ces étapes dans l'ordre, et arrête-toi en cas de doute :

1. **Analyse** : lance `git status` et `git diff` (+ `git diff --staged` si besoin) pour
   comprendre précisément _ce qui a changé et pourquoi_. **Lis le diff en entier** : il sert
   de matière première à la revue (étape 5) et au CHANGELOG (étape 6) — c'est la trace des
   modifications sur laquelle s'appuieront les devs et le débogage.

2. **Garde-fou confidentialité** : repère tout fichier sensible (voir liste ci-dessus).
   Ne le stage pas ; vérifie qu'il est couvert par `.gitignore`. Si un secret risque
   d'être committé et n'est pas ignoré, **stoppe** et préviens l'utilisateur.

3. **Branche** : vérifie la branche courante (`git rev-parse --abbrev-ref HEAD`). Si tu es
   sur `main` **ou `dev`**, **stoppe** et propose de créer une branche dédiée depuis `dev`
   (`feature/…`, `fix/…`, `chore/…`, `docs/…`, `refactor/…`) avant de committer — on ne
   commit jamais directement sur `main` ni `dev`.

4. **Qualité** (si le scaffolding existe, c.-à-d. un `package.json` est présent) : lance
   lint + typecheck + tests selon les scripts définis (ex. `npm run lint`, `npm run typecheck`,
   `npm test`). Si l'un échoue, **stoppe** et rapporte l'échec (pas de commit sur du rouge).
   Tant que le scaffolding n'est pas initialisé, saute cette étape.

5. **Revue de code** : relis le diff de façon critique avant de committer — bugs, régressions,
   secrets oubliés, incohérences avec les specs (`docs/specs/`) et les bonnes pratiques
   ([bonnes-pratiques.md](../../docs/specs/technical/bonnes-pratiques.md)), respect de l'offline-first
   et de l'i18n (aucune chaîne en dur). Pour un diff conséquent, délègue à l'agent
   `superpowers:code-reviewer` (ou la skill `/code-review`). Si un problème **bloquant** ressort,
   **stoppe** et corrige (ou préviens) avant de committer ; sinon consigne les points d'attention
   dans le CHANGELOG (étape 6).

6. **CHANGELOG** : ajoute une entrée dans [`CHANGELOG.md`](../../CHANGELOG.md), insérée **juste
   sous** la ligne `<!-- Nouvelles entrées ajoutées ICI ... -->` (ordre anté-chronologique).
   Construis-la **à partir du `git diff`** pour une trace complète : date (JJ/MM/AAAA), sujet,
   branche, catégories (Ajouté / Modifié / Corrigé / Supprimé / Technique-Notes), fichiers
   touchés, et toute note utile au débogage (décision, contournement, point d'attention issu de
   la revue). Le hash court est ajouté une fois le commit créé (étape 9).

7. **TODO** : mets à jour [`TODO.md`](../../TODO.md) — coche `[x]` ce qui est désormais fait,
   passe en `[~]` ce qui est en cours, ajoute les nouvelles tâches apparues, et actualise la
   date de « Dernière mise à jour ».

8. **Message de commit** : format conventionnel `type(scope): sujet` **en français**
   (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`). Si `$ARGUMENTS` est non vide,
   utilise-le comme base du sujet. Ajoute un corps concis si utile.
   Termine **toujours** le message par :

   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

9. **Commit** : `git add` uniquement les fichiers pertinents (jamais les sensibles), puis
   `git commit`. Reporte le hash court dans l'entrée CHANGELOG (étape 6) si tu l'y avais laissé
   en attente, puis affiche le hash du commit et un `git status` final propre.

10. **Push sur `dev`** : intègre le travail de la branche courante dans `dev` puis pousse.
    `git fetch origin`, puis mets `dev` à jour depuis `origin/dev` et fais avancer `dev` avec
    les commits de la branche (fast-forward si possible, sinon merge), enfin
    `git push origin dev`. Reviens ensuite sur la branche de travail. En cas de conflit ou de
    divergence de `dev`, **stoppe** et préviens l'utilisateur plutôt que de forcer.

Si le périmètre à committer est ambigu (mélange de sujets sans rapport), propose de scinder
en plusieurs commits **avant** d'agir.
