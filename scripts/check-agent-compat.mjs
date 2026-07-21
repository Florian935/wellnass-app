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
