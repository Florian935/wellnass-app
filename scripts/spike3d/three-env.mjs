// Socle Node pour utiliser three r128 (build ESM + modules examples/jsm) hors navigateur.
// - Les modules examples/jsm importent le spécificateur nu 'three' : on le résout vers
//   build/three.module.js via un crochet de résolution, pour n'avoir qu'UNE copie de three.
// - GLTFExporter r128 utilise window.TextEncoder, window.FileReader et Blob : polyfills minimaux.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

export const THREE_ROOT = process.env.THREE_ROOT ?? 'C:/wellness-app/node_modules/three';
const pkgPath = path.join(THREE_ROOT, 'package.json');
if (!fs.existsSync(pkgPath)) {
  throw new Error(`three introuvable dans ${THREE_ROOT} (définir THREE_ROOT)`);
}
export const THREE_VERSION = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;

const threeModuleUrl = pathToFileURL(path.join(THREE_ROOT, 'build/three.module.js')).href;
const hooks = `
export function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: ${JSON.stringify(threeModuleUrl)}, shortCircuit: true };
  return next(specifier, context);
}`;
register('data:text/javascript,' + encodeURIComponent(hooks));

// --- polyfills navigateur ---
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
if (typeof globalThis.FileReader === 'undefined') {
  class FileReader {
    readAsArrayBuffer(blob) {
      // asynchrone : l'exporteur assigne onloadend APRÈS l'appel
      blob.arrayBuffer().then((buf) => { this.result = buf; this.onloadend?.(); });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buf).toString('base64')}`;
        this.onloadend?.();
      });
    }
  }
  globalThis.FileReader = FileReader;
}

export async function loadThree() {
  const THREE = await import('three');
  const { GLTFExporter } = await import(pathToFileURL(path.join(THREE_ROOT, 'examples/jsm/exporters/GLTFExporter.js')).href);
  const { GLTFLoader } = await import(pathToFileURL(path.join(THREE_ROOT, 'examples/jsm/loaders/GLTFLoader.js')).href);
  return { THREE, GLTFExporter, GLTFLoader };
}
