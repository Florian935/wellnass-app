/**
 * Spike 3D — convertit les `.glb` en module TypeScript base64. **Script jetable.**
 *
 * Usage : `node scripts/spike3d/build-mesh-module.mjs <dossier-des-glb>`
 *
 * ── Pourquoi inliner en base64 plutôt que servir un asset ───────────────────────────────────────
 * Deux raisons, dans cet ordre :
 *
 * 1. **`assetExts` d'Expo 57 ne contient ni `glb`, ni `gltf`, ni `bin`** (vérifié en appelant
 *    `getDefaultConfig()`). Un `.glb` importé aujourd'hui échoue purement à la résolution Metro.
 * 2. Même en étendant `assetExts`, un asset React Native est exposé par une **URI** que la WebView
 *    du composant DOM n'a aucune garantie de pouvoir lire — et l'app est **offline-first**
 *    (décision B) : une scène qui a besoin du réseau pour s'afficher ne s'affiche pas au bon
 *    moment. Le base64 part avec le bundle DOM, donc il marche hors ligne par construction.
 *
 * ⚠️ Le prix est connu et assumé : le base64 pèse ~4/3 du binaire, et il gonfle le bundle JS au
 * lieu des assets. C'est précisément l'inconnue n° 2 du spike — on la mesure, on ne l'esquive pas.
 * La voie `assetExts` reste **non testée** : si le spike conclut à un feu vert, c'est la première
 * chose à instruire pour l'US, parce qu'elle éviterait ce surcoût.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const source = process.argv[2];
if (!source) {
  console.error('Usage : node build-mesh-module.mjs <dossier-des-glb>');
  process.exit(1);
}

// v2 du 16/09/2026 : la v1 (2 885 sommets, tubes et coques interpénétrées) servait à mesurer le
// plafond des morphs, pas à ressembler à un corps. Les deux fichiers sont déjà encodés en sparse.
const fichiers = {
  SPIKE_MESH_SINGLE: 'body-v4-single.glb',
  SPIKE_MESH_SPLIT: 'body-v4-split.glb',
};

const lignes = [
  '/**',
  ' * Spike 3D — les maillages, inlinés en base64. **Fichier généré, jetable.**',
  ' *',
  ' * Régénérer : `node scripts/spike3d/build-mesh-module.mjs <dossier>`.',
  ' * Ne pas éditer à la main. Voir docs/specs/technical/spike-3d-corps.md.',
  ' */',
  '',
];

let total = 0;
for (const [constante, fichier] of Object.entries(fichiers)) {
  const binaire = readFileSync(join(source, fichier));
  const base64 = binaire.toString('base64');
  total += base64.length;
  lignes.push(
    `/** \`${fichier}\` — ${(binaire.length / 1024).toFixed(0)} Ko binaires, ${(base64.length / 1024).toFixed(0)} Ko en base64. */`,
    `export const ${constante} =`,
    `  '${base64}';`,
    '',
  );
}

const cible = join(
  process.cwd(),
  'apps/mobile/src/components/body/spike3d/body-spike-mesh.ts',
);
writeFileSync(cible, lignes.join('\n'));
console.log(`✓ ${cible}`);
console.log(`  base64 total : ${(total / 1024).toFixed(0)} Ko`);
