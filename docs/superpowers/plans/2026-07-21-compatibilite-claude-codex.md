# Compatibilité Claude Code / Codex — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire charger `CLAUDE.md` par Codex et partager le workflow de commit entre Claude Code et Codex sans dupliquer sa logique ni modifier le code applicatif.

**Architecture:** `CLAUDE.md` reste l'unique source des conventions projet et `.codex/config.toml` le déclare comme fallback Codex. Le workflow de commit est extrait dans `docs/agent-workflows/commit.md` puis exposé par trois adaptateurs minces : skill Claude moderne, commande Claude historique et skill Codex. Un contrôle Node autonome empêche les régressions de chemins, de priorité et d'attribution.

**Tech Stack:** Markdown, TOML, Agent Skills (`SKILL.md`), Node.js ≥ 20, npm workspaces, Git.

## Global Constraints

- `CLAUDE.md` reste la source de vérité commune ; aucun `AGENTS.md` n'est versionné.
- `project_doc_fallback_filenames = ["CLAUDE.md"]` est la seule option ajoutée à la configuration Codex projet.
- Aucun changement dans `apps/`, `packages/`, `supabase/`, l'i18n, PowerSync ou le schéma cloud.
- Claude conserve `/commit` et son attribution existante ; Codex utilise `$commit` et ne s'attribue jamais à Claude.
- Les plugins globaux Claude/Codex restent indépendants et ne sont pas recopiés dans le dépôt.
- Les dates documentaires utilisent le format JJ/MM/AAAA et les commits conventionnels sont en français.
- Le `AGENTS.md` non suivi du checkout principal n'est jamais supprimé automatiquement.
- La roadmap produit n'est pas modifiée : ce chantier est un outillage hors périmètre fonctionnel.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `.codex/config.toml` | Déclarer `CLAUDE.md` comme fallback d'instructions Codex. |
| `docs/agent-workflows/commit.md` | Contenir toute la procédure de commit indépendante de la plateforme. |
| `.claude/skills/commit/SKILL.md` | Exposer le workflow à Claude Code au format Agent Skills moderne. |
| `.claude/commands/commit.md` | Conserver `/commit` pour les versions/usages Claude historiques. |
| `.agents/skills/commit/SKILL.md` | Exposer le workflow à Codex avec `$commit` et sans attribution Claude. |
| `scripts/check-agent-compat.mjs` | Vérifier le fallback, les fichiers requis, les références et les attributions. |
| `package.json` | Exposer `npm run agents:check`. |
| `docs/agent-workflows/README.md` | Documenter la cohabitation et l'ajout d'un futur workflow partagé. |
| `CLAUDE.md` | Pointer vers le workflow commun et documenter `/commit` / `$commit`. |
| `CHANGELOG.md` / `TODO.md` | Tracer chaque incrément et l'état réel de la migration. |

---

### Task 1: Socle de compatibilité et workflow de commit partagé

**Files:**
- Create: `.codex/config.toml`
- Create: `scripts/check-agent-compat.mjs`
- Create: `docs/agent-workflows/commit.md`
- Create: `.claude/skills/commit/SKILL.md`
- Create: `.agents/skills/commit/SKILL.md`
- Modify: `.claude/commands/commit.md`
- Modify: `package.json`
- Modify: `CHANGELOG.md`
- Modify: `TODO.md`
- Test: `npm run agents:check`

**Interfaces:**
- Consumes: `CLAUDE.md`, le workflow historique `.claude/commands/commit.md` et les règles Git documentées dans la spec.
- Produces: le contrat `docs/agent-workflows/commit.md`, invoqué par les trois adaptateurs ; la commande de validation `npm run agents:check`.

- [ ] **Step 1: Ajouter le contrôle d'acceptation avant les fichiers attendus**

Créer `scripts/check-agent-compat.mjs` :

```js
import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowReference = "docs/agent-workflows/commit.md";
const claudeAttribution =
  "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>";
const errors = [];

async function exists(relativePath) {
  try {
    await access(path.join(repoRoot, relativePath), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readRequired(label, relativePath) {
  try {
    return await readFile(path.join(repoRoot, relativePath), "utf8");
  } catch {
    errors.push(`${label} introuvable : ${relativePath}`);
    return "";
  }
}

const [
  config,
  claudeInstructions,
  workflow,
  claudeSkill,
  claudeCommand,
  codexSkill,
] = await Promise.all([
  readRequired("Configuration Codex", ".codex/config.toml"),
  readRequired("Instructions projet", "CLAUDE.md"),
  readRequired("Workflow commun", workflowReference),
  readRequired("Skill Claude", ".claude/skills/commit/SKILL.md"),
  readRequired("Commande Claude historique", ".claude/commands/commit.md"),
  readRequired("Skill Codex", ".agents/skills/commit/SKILL.md"),
]);

if (
  config.trim() !==
  'project_doc_fallback_filenames = ["CLAUDE.md"]'
) {
  errors.push(
    '.codex/config.toml doit contenir uniquement project_doc_fallback_filenames = ["CLAUDE.md"].',
  );
}

if (Buffer.byteLength(claudeInstructions, "utf8") >= 32 * 1024) {
  errors.push("CLAUDE.md atteint ou dépasse la limite Codex de 32 Kio.");
}

if (await exists("AGENTS.md")) {
  errors.push(
    "AGENTS.md masque le fallback CLAUDE.md : sauvegardez-le sous un nom non découvert.",
  );
}

const trackedAgents = spawnSync(
  "git",
  ["ls-files", "--error-unmatch", "AGENTS.md"],
  { cwd: repoRoot, encoding: "utf8" },
);

if (trackedAgents.status === 0) {
  errors.push("AGENTS.md ne doit pas être versionné dans ce dépôt.");
}

for (const [label, content] of [
  ["Skill Claude", claudeSkill],
  ["Commande Claude historique", claudeCommand],
  ["Skill Codex", codexSkill],
]) {
  if (!content.includes(workflowReference)) {
    errors.push(`${label} ne référence pas ${workflowReference}.`);
  }
}

if (!workflow.includes("# Préparer et livrer un commit")) {
  errors.push("Le workflow commun ne contient pas son titre contractuel.");
}

if (!claudeSkill.includes(claudeAttribution)) {
  errors.push("Le skill Claude doit conserver l'attribution Claude existante.");
}

if (!claudeCommand.includes(claudeAttribution)) {
  errors.push(
    "La commande Claude historique doit conserver l'attribution Claude existante.",
  );
}

if (codexSkill.includes("Co-Authored-By: Claude")) {
  errors.push("Le skill Codex ne doit jamais attribuer son travail à Claude.");
}

if (claudeInstructions.includes(".Codex/")) {
  errors.push("CLAUDE.md contient un chemin .Codex/ invalide.");
}

if (errors.length > 0) {
  console.error("Compatibilité agents invalide :");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  "Compatibilité agents valide : fallback CLAUDE.md et workflow commit partagé.",
);
```

Modifier `package.json` en insérant le script après `test` :

```json
"test": "npm run test --workspaces --if-present",
"agents:check": "node scripts/check-agent-compat.mjs",
```

- [ ] **Step 2: Exécuter le contrôle et constater l'échec attendu**

Run: `npm run agents:check`

Expected: FAIL avec au minimum :

```text
Configuration Codex introuvable : .codex/config.toml
Workflow commun introuvable : docs/agent-workflows/commit.md
Skill Claude introuvable : .claude/skills/commit/SKILL.md
Skill Codex introuvable : .agents/skills/commit/SKILL.md
```

- [ ] **Step 3: Ajouter le fallback Codex minimal**

Créer `.codex/config.toml` :

```toml
project_doc_fallback_filenames = ["CLAUDE.md"]
```

- [ ] **Step 4: Extraire la procédure commune complète**

Créer `docs/agent-workflows/commit.md` :

```markdown
# Préparer et livrer un commit

Ce workflow prépare et réalise un commit sûr pour Wellness App
(React Native/Expo + Supabase). L'adaptateur de l'agent courant fournit
le sujet optionnel et, pour Claude uniquement, son attribution.

## Garde-fou confidentialité

Ne jamais committer de secrets ou de credentials : `.env*`, clé Supabase
`service_role`, clés RevenueCat ou Mapbox, `google-services.json`,
`GoogleService-Info.plist`, keystores et certificats (`*.keystore`,
`*.jks`, `*.p12`, `*.pem`, `*.key`), ou credentials EAS.
En cas de doute, arrêter le workflow et prévenir l'utilisateur.

## Procédure obligatoire

1. **Analyser le périmètre**
   - Exécuter `git status`, `git diff` et, si nécessaire,
     `git diff --staged`.
   - Lire le diff complet pour comprendre ce qui a changé et pourquoi.
   - Si plusieurs sujets indépendants sont mélangés, proposer de les
     scinder avant toute action.

2. **Contrôler la confidentialité**
   - Repérer les fichiers sensibles listés ci-dessus.
   - Ne jamais les stage.
   - Vérifier qu'ils sont couverts par `.gitignore`.
   - Si un secret risque d'être committé, arrêter et prévenir.

3. **Contrôler la branche**
   - Exécuter `git rev-parse --abbrev-ref HEAD`.
   - Si la branche est `main` ou `dev`, arrêter et proposer une branche
     dédiée créée depuis `dev` avec un préfixe `feature/`, `fix/`,
     `chore/`, `docs/` ou `refactor/`.
   - Ne jamais committer directement sur `main` ou `dev`.

4. **Exécuter les contrôles qualité**
   - Si `package.json` existe, lancer `npm run lint`,
     `npm run typecheck` et `npm test`.
   - Lancer aussi `npm run agents:check` lorsque le script existe.
   - Si un contrôle échoue, arrêter sans committer et rapporter l'échec.

5. **Relire le diff**
   - Rechercher bugs, régressions, secrets, incohérences avec
     `docs/specs/` et
     `docs/specs/technical/bonnes-pratiques.md`.
   - Vérifier l'offline-first et l'i18n lorsqu'ils sont concernés.
   - Pour un diff conséquent, utiliser la capacité de revue disponible
     dans l'outil courant. Si aucun agent/skill de revue n'est
     disponible, effectuer une revue inline complète.
   - Corriger tout problème bloquant avant de poursuivre.

6. **Mettre à jour CHANGELOG.md**
   - Insérer une entrée juste sous le marqueur
     `<!-- Nouvelles entrées ajoutées ICI ... -->`.
   - Construire l'entrée depuis le diff : date JJ/MM/AAAA, sujet,
     branche, catégories, fichiers touchés, décisions et points
     d'attention.
   - Ne jamais écrire le hash du commit en cours ni amender uniquement
     pour ajouter ce hash.

7. **Mettre à jour TODO.md**
   - Cocher `[x]` ce qui est livré, passer `[~]` ce qui reste en cours,
     ajouter les tâches apparues et actualiser la date de dernière mise
     à jour.

8. **Mettre à jour la roadmap si nécessaire**
   - Si le commit fait avancer une fonctionnalité de la roadmap,
     actualiser son statut et les compteurs du récapitulatif.
   - Pour une modification documentaire, d'outillage ou hors roadmap,
     ne pas modifier la roadmap et le signaler dans le changelog.

9. **Construire le message**
   - Utiliser le format conventionnel français
     `type(scope): sujet` avec `feat`, `fix`, `docs`, `refactor`,
     `test` ou `chore`.
   - Utiliser le sujet fourni par l'utilisateur lorsqu'il existe.
   - Ajouter l'attribution uniquement si l'adaptateur courant l'exige.

10. **Créer le commit**
    - Stager uniquement les fichiers du périmètre avec des chemins
      explicites ; ne jamais utiliser aveuglément `git add .`.
    - Créer le commit, afficher son hash puis vérifier que le statut du
      périmètre est propre.

11. **Intégrer vers dev**
    - Exécuter `git fetch origin`.
    - Mettre `dev` à jour depuis `origin/dev`.
    - Faire avancer `dev` avec les commits de la branche, en
      fast-forward si possible, sinon avec un merge non forcé.
    - Exécuter `git push origin dev` puis revenir sur la branche de
      travail.
    - En cas de conflit ou de divergence, arrêter sans forcer et
      prévenir l'utilisateur.
```

- [ ] **Step 5: Remplacer les wrappers Claude et créer le wrapper Codex**

Créer `.claude/skills/commit/SKILL.md` :

```markdown
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
```

Remplacer intégralement `.claude/commands/commit.md` par :

```markdown
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
```

Créer `.agents/skills/commit/SKILL.md` :

```markdown
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
```

- [ ] **Step 6: Vérifier que le contrôle passe**

Run: `npm run agents:check`

Expected:

```text
Compatibilité agents valide : fallback CLAUDE.md et workflow commit partagé.
```

- [ ] **Step 7: Exécuter la non-régression du monorepo**

Run:

```powershell
npm run typecheck
npm run lint
npm test
```

Expected:

- typecheck : exit 0 ;
- lint : exit 0, avec au plus les 4 avertissements préexistants ;
- tests : 775 tests partagés et 44 tests mobiles passants au minimum.

- [ ] **Step 8: Tracer l'incrément dans CHANGELOG et TODO**

Ajouter sous le marqueur de `CHANGELOG.md` :

```markdown
### 21/07/2026 — `chore/compatibilite-claude-codex` — socle de compatibilité des agents

**Ajouté**
- Fallback Codex vers `CLAUDE.md`, validation `npm run agents:check` et skill `$commit`.
- Workflow de commit partagé avec adaptateurs Claude moderne, Claude historique et Codex.

**Technique / Notes**
- Aucun code applicatif, aucune migration et aucun statut de roadmap modifiés.
```

Dans la section « Outillage agents » de `TODO.md`, conserver `[~]` et remplacer le détail par :

```markdown
- [~] **Migration Claude Code / Codex** (`chore/compatibilite-claude-codex`, 21/07/2026) —
  fallback Codex, workflow commun, wrappers Claude/Codex et contrôle statique livrés sur la
  branche. Reste : documentation d'usage, validation dans de nouvelles sessions et intégration.
```

- [ ] **Step 9: Commit de l'incrément**

```powershell
git add .codex/config.toml scripts/check-agent-compat.mjs package.json docs/agent-workflows/commit.md .claude/skills/commit/SKILL.md .claude/commands/commit.md .agents/skills/commit/SKILL.md CHANGELOG.md TODO.md
git diff --cached --check
git commit -m "chore(outillage): partager le workflow de commit entre Claude et Codex"
```

Expected: commit créé sur `chore/compatibilite-claude-codex`, sans attribution Claude si l'exécutant est Codex.

---

### Task 2: Documentation d'usage et références durables

**Files:**
- Create: `docs/agent-workflows/README.md`
- Modify: `CLAUDE.md:84-101`
- Modify: `CHANGELOG.md:3-5`
- Modify: `TODO.md:3-10`
- Modify: `CHANGELOG.md`
- Modify: `TODO.md`
- Test: recherches `rg` et `npm run agents:check`

**Interfaces:**
- Consumes: le workflow commun et les adaptateurs produits par Task 1.
- Produces: les conventions de maintenance destinées aux développeurs et aux futures conversations Claude/Codex.

- [ ] **Step 1: Montrer que les anciennes références sont encore présentes**

Run:

```powershell
rg -n "\.claude/commands/commit\.md|\.Codex/" CLAUDE.md CHANGELOG.md TODO.md
```

Expected: au moins deux correspondances vers `.claude/commands/commit.md` dans les textes d'introduction.

- [ ] **Step 2: Documenter l'architecture et l'ajout d'un futur workflow**

Créer `docs/agent-workflows/README.md` :

```markdown
# Workflows partagés entre agents

## Sources de vérité

- `CLAUDE.md` contient les conventions durables du dépôt.
- Codex le charge grâce à
  `.codex/config.toml -> project_doc_fallback_filenames`.
- `docs/agent-workflows/*.md` contient la logique commune des workflows.
- `.claude/skills/*/SKILL.md` expose les workflows à Claude Code.
- `.agents/skills/*/SKILL.md` expose les workflows à Codex.
- `.claude/commands/*.md` ne sert qu'à la compatibilité Claude historique.

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
```

- [ ] **Step 3: Mettre à jour les références de CLAUDE.md**

Remplacer la ligne d'introduction de la section « Commits » par :

```markdown
### Commits
Utiliser le workflow partagé **commit**
([docs/agent-workflows/commit.md](docs/agent-workflows/commit.md)) :
- Claude Code : `/commit [sujet optionnel]` ;
- Codex : `$commit [sujet optionnel]` ou une demande équivalente en langage naturel.

En une passe, il :
```

Conserver sans modification les puces fonctionnelles existantes qui suivent, en accordant
« elle » en « il » si une phrase y fait référence.

- [ ] **Step 4: Mettre à jour les liens d'introduction de CHANGELOG et TODO**

Dans `CHANGELOG.md`, remplacer :

```markdown
par la commande [`/commit`](.claude/commands/commit.md)
```

par :

```markdown
par le workflow partagé [`commit`](docs/agent-workflows/commit.md)
```

Dans `TODO.md`, appliquer la même substitution au paragraphe d'introduction.

- [ ] **Step 5: Vérifier la disparition des références obsolètes**

Run:

```powershell
rg -n "\.claude/commands/commit\.md|\.Codex/" CLAUDE.md CHANGELOG.md TODO.md
npm run agents:check
```

Expected:

- `rg` ne retourne aucune correspondance ;
- `agents:check` affiche « Compatibilité agents valide ».

- [ ] **Step 6: Tracer et committer la documentation**

Ajouter une entrée CHANGELOG exacte :

```markdown
### 21/07/2026 — `chore/compatibilite-claude-codex` — documentation des workflows multi-agents

**Ajouté**
- Guide de maintenance des workflows partagés et procédure d'ajout d'un futur skill.

**Modifié**
- `CLAUDE.md`, `CHANGELOG.md` et `TODO.md` pointent vers la source commune du workflow commit.

**Technique / Notes**
- Claude conserve `/commit` ; Codex utilise `$commit`.
```

Mettre à jour la tâche TODO en conservant `[~]` et en ajoutant :

```markdown
Documentation d'usage livrée. Reste : validation manuelle dans de nouvelles sessions Claude/Codex.
```

Puis exécuter :

```powershell
git add docs/agent-workflows/README.md CLAUDE.md CHANGELOG.md TODO.md
git diff --cached --check
git commit -m "docs(outillage): documenter les workflows multi-agents"
```

Expected: second commit d'implémentation créé, aucun fichier applicatif touché.

---

### Task 3: Validation croisée, bascule locale et intégration

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `TODO.md`
- Local-only: `C:\wellness-app\AGENTS.md` -> sauvegarde non découverte après approbation
- Test: `npm run agents:check`, suite monorepo, nouvelles sessions Claude et Codex

**Interfaces:**
- Consumes: l'ensemble des fichiers produits par Tasks 1 et 2.
- Produces: une branche vérifiée, un checkout principal où le fallback est effectif, et une intégration `dev` sans divergence.

- [ ] **Step 1: Vérifier statiquement tout le périmètre**

Run:

```powershell
npm run agents:check
npm run typecheck
npm run lint
npm test
git diff --name-only dev...HEAD
git ls-files AGENTS.md
```

Expected:

- `agents:check` passe ;
- typecheck, lint et tests passent selon la baseline ;
- `git diff --name-only dev...HEAD` ne contient aucun chemin sous `apps/`, `packages/` ou `supabase/` ;
- `git ls-files AGENTS.md` ne retourne rien.

- [ ] **Step 2: Faire relire le diff complet avant bascule locale**

Run:

```powershell
git status --short --branch
git diff dev...HEAD -- . ":(exclude)package-lock.json"
```

Expected: uniquement configuration Codex, workflows, adaptateurs, contrôle Node et documentation.

- [ ] **Step 3: Checkpoint utilisateur avant de déplacer le AGENTS.md non suivi**

Demander explicitement l'autorisation de déplacer :

```text
C:\wellness-app\AGENTS.md
```

vers :

```text
C:\wellness-app\AGENTS.md.pre-codex-fallback.bak
```

Après approbation, vérifier les deux chemins puis exécuter avec `Move-Item -LiteralPath`.
Ne jamais écraser une sauvegarde existante. Expected: `AGENTS.md` absent et sauvegarde présente.

- [ ] **Step 4: Valider une nouvelle session Codex**

Depuis la racine dépourvue d'`AGENTS.md`, démarrer une nouvelle session Codex puis demander :

```text
Liste les fichiers d'instructions projet chargés, résume les règles de branche,
puis indique le chemin du skill commit sans l'exécuter.
```

Expected:

- `CLAUDE.md` est déclaré comme instruction projet ;
- la règle « jamais directement sur main/dev » est résumée ;
- `.agents/skills/commit/SKILL.md` est découvert ;
- aucun commit ou push n'est exécuté.

- [ ] **Step 5: Valider une nouvelle session Claude Code**

Dans Claude Code :

```text
/memory
/skills
```

Expected:

- `CLAUDE.md` apparaît dans `/memory` ;
- `commit` apparaît dans `/skills` ;
- `/commit` reste disponible, sans l'exécuter sur un diff réel.

- [ ] **Step 6: Marquer la migration vérifiée**

Dans `TODO.md`, remplacer la tâche de migration par :

```markdown
- [x] **Migration Claude Code / Codex** (`chore/compatibilite-claude-codex`, 21/07/2026) —
  `CLAUDE.md` chargé par fallback Codex, workflow commit partagé, `/commit` Claude et
  `$commit` Codex découverts dans de nouvelles sessions, contrôles monorepo verts.
```

Ajouter sous le marqueur de `CHANGELOG.md` :

```markdown
### 21/07/2026 — `chore/compatibilite-claude-codex` — validation croisée Claude Code / Codex

**Validé**
- Chargement de `CLAUDE.md` et découverte du workflow commit dans de nouvelles sessions Claude et Codex.
- `npm run agents:check`, typecheck, lint et tests monorepo verts.

**Technique / Notes**
- `AGENTS.md` local sauvegardé sous un nom non découvert ; rollback disponible.
- Aucun changement de roadmap, d'application ou de base de données.
```

- [ ] **Step 7: Créer le commit final de validation**

```powershell
git add CHANGELOG.md TODO.md
git diff --cached --check
git commit -m "test(outillage): valider la compatibilité Claude Code et Codex"
git status --short --branch
```

Expected: branche propre avec trois commits d'implémentation après le commit de conception/plan.

- [ ] **Step 8: Intégrer sur dev sans forcer**

```powershell
git fetch origin
git switch dev
git merge --ff-only origin/dev
git merge --ff-only chore/compatibilite-claude-codex
git push origin dev
git switch chore/compatibilite-claude-codex
```

Expected:

- aucune divergence ni aucun conflit ;
- `origin/dev` contient la migration ;
- retour sur `chore/compatibilite-claude-codex` ;
- le checkout principal `feature/refonte-muscu-d` conserve ses modifications `IDEAS.md`.

## Rollback vérifié

Si la découverte Codex échoue après intégration :

1. conserver la sauvegarde `AGENTS.md.pre-codex-fallback.bak` ;
2. revert les commits de migration sur une branche dédiée, sans `git reset --hard` ;
3. rétablir l'ancien workflow Claude depuis l'historique Git si nécessaire ;
4. ouvrir de nouvelles sessions, car les instructions et métadonnées de skills sont chargées au démarrage.
