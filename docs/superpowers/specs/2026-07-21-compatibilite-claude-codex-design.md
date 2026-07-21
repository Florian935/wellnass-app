# Compatibilité Claude Code / Codex — conception technique

**Date :** 21/07/2026

**Statut :** conception validée oralement, document à relire avant plan d'implémentation

**Branche cible :** `chore/compatibilite-claude-codex` depuis `dev`

## Objectif

Permettre à Claude Code et Codex de travailler sur le même dépôt avec les mêmes règles
projet et les mêmes workflows partagés, sans dupliquer leur contenu ni modifier le
fonctionnement actuel de Claude Code.

La migration doit garantir qu'une nouvelle conversation Codex charge automatiquement les
instructions suivies par Claude Code et qu'un workflow projet portable, en premier lieu le
commit, reste accessible dans les deux outils.

## État initial constaté

- `CLAUDE.md` est suivi par Git et constitue la source actuelle des conventions du dépôt.
- Un `AGENTS.md` non suivi existe dans le checkout principal. Il duplique presque entièrement
  `CLAUDE.md` et contient des adaptations Codex non valides, dont le chemin
  `.Codex/commands/commit.md`.
- La présence d'un `AGENTS.md` empêche Codex d'utiliser un nom de fallback dans le même
  répertoire, car `AGENTS.md` est prioritaire.
- Le dépôt ne contient aucun skill projet sous `.claude/skills/` ou `.agents/skills/`.
- Le workflow de commit vit dans `.claude/commands/commit.md`, ancien format de commande Claude
  toujours pris en charge.
- `apps/mobile/.claude/settings.json` active un plugin Expo propre à Claude. Cette configuration
  ne doit pas être modifiée par la migration.
- Superpowers est installé séparément dans Claude et Codex. Il reste géré par chaque outil et
  n'est pas recopié dans le dépôt.

## Périmètre

### Inclus

- Chargement de `CLAUDE.md` par Codex grâce au fallback officiel.
- Mise en place d'un format commun pour les workflows partagés.
- Portage du workflow de commit vers Claude Code et Codex.
- Documentation de la cohabitation et de la procédure d'ajout d'un futur skill partagé.
- Tests de découverte, de cohérence et de non-régression dans de nouvelles sessions.

### Exclus

- Alignement des modèles, prompts système internes ou comportements probabilistes des deux
  agents.
- Copie ou conversion automatique des plugins installés globalement.
- Installation d'un plugin Expo dans Codex.
- Modification du code applicatif, du schéma Supabase, de l'i18n ou du fonctionnement offline.
- Création d'une syntaxe `/commit` dans Codex : Codex invoque un skill explicitement avec
  `$commit`, ou implicitement lorsque la demande correspond à sa description.

## Architecture retenue

### 1. Source unique des instructions

`CLAUDE.md` reste la source de vérité commune. Le dépôt ajoute :

```toml
# .codex/config.toml
project_doc_fallback_filenames = ["CLAUDE.md"]
```

Le dépôt ne versionne pas d'`AGENTS.md`. Dans un répertoire donné, Codex cherche d'abord
`AGENTS.override.md`, puis `AGENTS.md`, puis les noms de fallback. Un `AGENTS.md` local doit donc
être absent pour que `CLAUDE.md` soit chargé.

La taille actuelle de `CLAUDE.md` reste inférieure à la limite Codex de 32 Kio ;
`project_doc_max_bytes` n'est pas modifié.

### 2. Source unique des workflows

La logique fonctionnelle du commit est extraite dans un document neutre :

```text
docs/agent-workflows/commit.md
```

Ce document contient les invariants partagés : analyse du diff, contrôle des secrets, branche,
qualité, revue, mise à jour du changelog, du TODO et de la roadmap, commit conventionnel et
intégration vers `dev`.

Trois adaptateurs minces exposent ce workflow :

```text
.claude/skills/commit/SKILL.md  # format Agent Skills moderne pour Claude
.agents/skills/commit/SKILL.md  # format Agent Skills pour Codex
.claude/commands/commit.md      # compatibilité avec les versions/usages Claude historiques
```

Chaque adaptateur contient uniquement les métadonnées de découverte, les restrictions propres à
la plateforme et l'instruction de lire intégralement le workflow commun avant de l'exécuter.
Le maintien de l'adaptateur historique évite une rupture de `/commit` sur Claude Code.

### 3. Différences assumées entre plateformes

- Claude utilise `/commit` ; Codex utilise `$commit` ou le déclenchement implicite.
- Les restrictions `allowed-tools` restent dans les adaptateurs Claude. Codex utilise son
  sandbox et son système d'approbation.
- L'attribution `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` est conservée uniquement
  côté Claude pour ne pas changer son comportement actuel. Codex ne doit jamais attribuer son
  travail à Claude et n'ajoute aucun trailer OpenAI non officiellement configuré.
- Une revue conséquente utilise la capacité de revue disponible dans l'outil courant ; l'absence
  d'un agent nommé `superpowers:code-reviewer` ne doit pas bloquer une revue inline complète.
- Les plugins globaux restent indépendants. Un skill qui dépend d'un plugin doit déclarer cette
  dépendance et fournir un comportement de repli ou s'arrêter avec un diagnostic précis.

## Flux de chargement

### Nouvelle session Claude Code

1. Claude charge `CLAUDE.md` selon son mécanisme existant.
2. Claude découvre `.claude/skills/commit/SKILL.md`.
3. `/commit` résout le skill moderne ; une version ancienne peut encore résoudre
   `.claude/commands/commit.md`.
4. L'adaptateur charge `docs/agent-workflows/commit.md` et applique les règles Claude.

### Nouvelle session Codex

1. Codex charge la configuration du projet approuvé `.codex/config.toml`.
2. En l'absence d'`AGENTS.md`, il charge `CLAUDE.md` via
   `project_doc_fallback_filenames`.
3. Codex découvre `.agents/skills/commit/SKILL.md`.
4. `$commit` ou une demande correspondante charge le workflow commun et applique les règles
   Codex.

## Gestion des erreurs

- **`AGENTS.md` masque le fallback :** arrêter la validation et afficher le chemin exact du
  fichier prioritaire. Ne jamais supprimer automatiquement un fichier non suivi appartenant au
  développeur.
- **Configuration Codex non approuvée :** demander d'approuver le projet, puis ouvrir une nouvelle
  session. La chaîne d'instructions est construite au démarrage.
- **Workflow commun introuvable :** l'adaptateur s'arrête avant toute action Git et nomme le
  chemin manquant.
- **Plugin ou skill de revue absent :** effectuer la revue inline avec le diff complet. Ne jamais
  ignorer silencieusement l'étape de revue.
- **Divergence de `dev`, conflit ou tests rouges :** arrêter le workflow de commit sans forcer ni
  pousser.
- **Secret détecté :** ne pas le stage, vérifier `.gitignore` et prévenir l'utilisateur.

## Stratégie de déploiement

1. Implémenter la configuration et les adaptateurs sur
   `chore/compatibilite-claude-codex`, créée depuis `dev`.
2. Conserver le workflow Claude historique comme adaptateur pendant la transition.
3. Tester la découverte sans exécuter de push destructif.
4. Dans le checkout principal, sauvegarder le `AGENTS.md` non suivi sous un nom qui n'est pas
   découvert par Codex, puis le retirer seulement après accord explicite du propriétaire.
5. Ouvrir de nouvelles sessions Claude et Codex pour la validation manuelle finale.

## Tests et critères d'acceptation

### Contrôles statiques

- `.codex/config.toml` est un TOML valide et ne contient que le fallback nécessaire.
- Aucun `AGENTS.md` n'est suivi dans le dépôt.
- Les trois adaptateurs référencent le même fichier commun existant.
- Le workflow commun conserve toutes les étapes actuellement documentées dans
  `.claude/commands/commit.md`.
- `CLAUDE.md` référence le nouvel emplacement commun et ne contient aucun chemin `.Codex/`.
- Le diff ne touche ni `apps/`, ni `packages/`, ni `supabase/`, ni le travail musculation en cours.

### Validation Claude Code

- Une nouvelle session affiche `CLAUDE.md` dans `/memory`.
- `/skills` affiche `commit`.
- `/commit` charge le workflow commun et conserve les restrictions/outils Claude.

### Validation Codex

- Une nouvelle session peut résumer les instructions de `CLAUDE.md` sans `AGENTS.md`.
- Le skill `$commit` est découvert.
- Une demande de préparation de commit charge le workflow sans attribuer le travail à Claude.

### Non-régression du dépôt

- `npm run typecheck` passe.
- `npm run lint` ne produit aucune erreur ; les quatre avertissements initiaux restent hors
  périmètre.
- `npm test` passe avec les 775 tests partagés et les 44 tests mobiles constatés dans la
  baseline du 21/07/2026.

## Rollback

La migration ne modifie pas le code applicatif et conserve `CLAUDE.md` comme source de vérité.
Un revert du commit de migration retire `.codex/config.toml`, les adaptateurs et le workflow
commun. L'ancien contenu de `.claude/commands/commit.md` doit rester récupérable dans l'historique
Git. Le `AGENTS.md` local sauvegardé n'est supprimé qu'après validation finale.

## Documentation de référence

- Codex : instructions persistantes, fallback et priorité d'`AGENTS.md`.
- Codex : skills projet sous `.agents/skills/` et chargement progressif.
- Claude Code : chargement de `CLAUDE.md` et import d'`AGENTS.md`.
- Claude Code : format Agent Skills sous `.claude/skills/` et compatibilité des anciennes
  commandes `.claude/commands/`.
