# Workflows partagés entre agents

## Sources de vérité

- `CLAUDE.md` contient les conventions durables du dépôt.
- Codex le charge grâce à
  `.codex/config.toml -> project_doc_fallback_filenames`.
- `docs/agent-workflows/*.md` contient la logique commune des workflows.
- `.claude/skills/*/SKILL.md` expose les workflows à Claude Code.
- `.agents/skills/*/SKILL.md` expose les workflows à Codex.
- `.claude/commands/*.md` ne sert qu’à la compatibilité Claude historique.

Un `AGENTS.md` placé à la racine est prioritaire sur le fallback Codex et
masque donc `CLAUDE.md`. Le contrôle `npm run agents:check` signale ce cas.

## Invocation

| Workflow | Claude Code | Codex |
|---|---|---|
| Commit | `/commit [sujet]` | `$commit [sujet]` ou demande en langage naturel |

## Ajouter un workflow partagé

1. Créer `docs/agent-workflows/<nom>.md` avec toute la procédure neutre.
2. Créer `.claude/skills/<nom>/SKILL.md` avec les métadonnées et les règles
   propres à Claude.
3. Créer `.agents/skills/<nom>/SKILL.md` avec les métadonnées et les règles
   propres à Codex.
4. Ajouter un wrapper `.claude/commands/<nom>.md` uniquement si une commande
   Claude historique doit être conservée.
5. Étendre `scripts/check-agent-compat.mjs` avec les chemins et invariants du
   nouveau workflow.
6. Exécuter `npm run agents:check` dans un checkout sans `AGENTS.md` local.
7. Ouvrir de nouvelles sessions Claude et Codex : les métadonnées de skills
   et les instructions projet sont découvertes au démarrage.

## Règles de maintenance

- Ne jamais dupliquer la procédure complète dans les adaptateurs.
- Ne jamais mettre une attribution Claude dans un adaptateur Codex.
- Ne pas recopier les plugins globaux dans le dépôt.
- Un workflow dépendant d'un plugin doit diagnostiquer précisément son
  absence et proposer un comportement de repli sûr.
