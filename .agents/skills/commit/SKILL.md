---
name: commit
description: Analyse et relit le diff, met à jour CHANGELOG, TODO et la roadmap si nécessaire, crée un commit sûr puis l'intègre à dev. Utiliser quand l'utilisateur demande de préparer, créer ou pousser un commit.
---

Depuis la racine du dépôt, lis intégralement
[`../../../docs/agent-workflows/commit.md`](../../../docs/agent-workflows/commit.md)
puis exécute ses étapes dans l'ordre.

Le texte fourni après `$commit`, ou le sujet demandé dans la conversation,
sert de sujet optionnel.

N'ajoute jamais une attribution Claude à un commit produit par Codex.
N'invente aucun trailer d'attribution OpenAI. Respecte le sandbox et les
approbations de la session courante.
