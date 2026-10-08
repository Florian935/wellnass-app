#!/usr/bin/env node
// US NORYN-01 — construit et déploie la fonction Edge `noryn-context` (décision D2).
//
// Pourquoi un bundle : la CLI Supabase, avec `--use-api`, téléverse les fichiers importés par chemin
// relatif mais lit chaque chemin LITTÉRALEMENT ; les imports internes de `packages/shared` sont sans
// extension (`from './pillar'`), elle ne les trouve pas. esbuild les résout comme le reste du
// monorepo et rend UN fichier ESM, `zod` compris : la fonction importe `./core.bundle.js`, que la CLI
// téléverse normalement. Les formules restent écrites une fois, dans `packages/shared`.
//
// Usage — une seule commande, et c'est voulu :
//   npm run noryn:deploy
// Elle refuse un arbre non commité (ce qui part en production est toujours un état versionné, dont la
// bannière porte le commit), efface tout bundle qui traînerait, construit, déploie avec
// `supabase functions deploy noryn-context --use-api`, puis efface le bundle. Il n'en reste donc jamais
// sur le disque : un `supabase functions deploy` lancé à la main, sans passer par ici, échoue (fichier
// absent) au lieu de déployer un bundle périmé.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ENTRY = join(ROOT, 'packages/shared/src/noryn/index.ts');
export const OUTFILE = join(ROOT, 'supabase/functions/noryn-context/core.bundle.js');

/** Ce qui, modifié et non commité, changerait ce qui part en production. */
const VERSIONED_INPUTS = [
  'packages/shared',
  'supabase/functions/noryn-context',
  'supabase/config.toml',
  'package.json',
  'package-lock.json',
  'scripts/noryn-context-bundle.mjs',
];

/** Construit le bundle ; rend son texte (`write: false`) ou l'écrit dans `OUTFILE`. */
export async function buildNorynBundle({ write = false, banner = '' } = {}) {
  const result = await build({
    entryPoints: [ENTRY],
    outfile: OUTFILE,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    target: 'es2022',
    legalComments: 'none',
    banner: { js: banner },
    logLevel: 'silent',
    write,
  });
  return write ? null : result.outputFiles[0].text;
}

/** Charge un bundle à part, comme le ferait la fonction (tests). */
export async function loadBundle(text) {
  const dir = mkdtempSync(join(tmpdir(), 'noryn-bundle-'));
  try {
    const file = join(dir, 'core.bundle.mjs');
    writeFileSync(file, text);
    return await import(pathToFileURL(file).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

/** Vrai si ce fichier est le point d'entrée — comparé par chemin réel (jonctions, liens, `subst`). */
function isMain() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

async function deploy() {
  rmSync(OUTFILE, { force: true });
  const dirty = git('status', '--porcelain', '--', ...VERSIONED_INPUTS);
  if (dirty) {
    console.error(
      'noryn:deploy refusé : des fichiers qui partent en production ont des modifications non commitées.\n' +
        `${dirty}\nCe qui part en production doit être un état versionné : commite d'abord.`,
    );
    return 1;
  }
  const commit = git('rev-parse', 'HEAD');
  try {
    await buildNorynBundle({
      write: true,
      banner: `// Fichier GÉNÉRÉ par \`npm run noryn:deploy\` (US NORYN-01), commit ${commit} — ne pas éditer, ne pas commiter.`,
    });
    console.log(`noryn:deploy — bundle construit (commit ${commit}), déploiement…`);
    const result = spawnSync('npx', ['supabase', 'functions', 'deploy', 'noryn-context', '--use-api'], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    return result.status ?? 1;
  } finally {
    rmSync(OUTFILE, { force: true });
  }
}

if (isMain()) {
  if (process.argv[2] !== 'deploy') {
    console.error('Usage : npm run noryn:deploy');
    process.exit(2);
  }
  process.exit(await deploy());
}
