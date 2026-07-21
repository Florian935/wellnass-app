---
description: Analyse et relit le diff, met à jour CHANGELOG + TODO + statut roadmap, commit propre et sûr, puis push sur dev
argument-hint: [sujet de commit optionnel]
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git rev-parse:*), Bash(git branch:*), Bash(git checkout:*), Bash(git merge:*), Bash(git fetch:*), Bash(git push:*), Bash(git log:*), Bash(npm:*), Bash(npx:*), Bash(pnpm:*), Read, Edit, Write, Task, Skill
---

Compatibilité avec les commandes Claude historiques :

1. Depuis la racine du dépôt, lis intégralement
   [`../../docs/agent-workflows/commit.md`](../../docs/agent-workflows/commit.md).
2. Exécute toutes ses étapes dans l'ordre.
3. Utilise comme sujet optionnel : `$ARGUMENTS`.
4. Termine toujours le message de commit par :

   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
