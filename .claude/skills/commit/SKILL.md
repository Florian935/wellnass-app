---
name: commit
description: Analyse et relit le diff, met à jour CHANGELOG, TODO et la roadmap si nécessaire, crée un commit sûr puis l'intègre à dev. Utiliser quand l'utilisateur demande de préparer, créer ou pousser un commit.
argument-hint: [sujet de commit optionnel]
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git rev-parse:*), Bash(git branch:*), Bash(git checkout:*), Bash(git merge:*), Bash(git fetch:*), Bash(git push:*), Bash(git log:*), Bash(npm:*), Bash(npx:*), Bash(pnpm:*), Read, Edit, Write, Task, Skill
---

Depuis la racine du dépôt, lis intégralement
[`../../../docs/agent-workflows/commit.md`](../../../docs/agent-workflows/commit.md)
puis exécute ses étapes dans l'ordre.

Sujet optionnel fourni par l'utilisateur : `$ARGUMENTS`

Pour le message de commit Claude, termine toujours par :

`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
