// preview.mjs — construit le corps de base et rend une planche de contrôle (face, dos, 3/4, profil).
// Usage : node preview.mjs [h=0.014] [nom=preview]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBody, GRID } from './lib/body.mjs';
import { extract } from './lib/surfacenets.mjs';
import { render, savePng, sheet } from './lib/render.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const h = Number(process.argv[2] ?? 0.014);
const name = process.argv[3] ?? 'preview';

const t0 = Date.now();
const body = buildBody();
const mesh = extract(body, { h, ...GRID });
const V = mesh.positions.length / 3, T = mesh.indices.length / 3;
console.log(`h=${h} : ${body.prims.length} primitives, ${mesh.grid.samples} échantillons (${mesh.grid.tSample} ms), ${V} sommets, ${T} triangles — ${Date.now() - t0} ms`);

// mesures : largeur (x) et profondeur (z) par tranche de hauteur
const P = mesh.positions;
const slice = (y0, y1) => { let x = 0, zmin = 1e9, zmax = -1e9; for (let i = 0; i < P.length; i += 3) { const y = P[i + 1]; if (y < y0 || y > y1) continue; x = Math.max(x, Math.abs(P[i])); zmin = Math.min(zmin, P[i + 2]); zmax = Math.max(zmax, P[i + 2]); } return `largeur ${(2 * x * 100).toFixed(1)} cm, prof. ${((zmax - zmin) * 100).toFixed(1)} cm`; };
for (const [n, a, b] of [['tête', 1.62, 1.76], ['épaules', 1.38, 1.46], ['poitrine', 1.27, 1.33], ['taille', 1.06, 1.12], ['hanches', 0.88, 0.96], ['cuisse (y .65)', 0.63, 0.67], ['mollet (y .35)', 0.33, 0.37]]) console.log(`  ${n.padEnd(16)} ${slice(a, b)}`);
let ymax = 0; for (let i = 1; i < P.length; i += 3) ymax = Math.max(ymax, P[i]); console.log(`  taille totale ${(ymax * 100).toFixed(1)} cm`);

const views = [
  ['FACE', { yaw: 0 }], ['DOS', { yaw: 180 }], ['3/4', { yaw: 40 }], ['PROFIL', { yaw: 90 }],
];
const pngs = views.map(([, o]) => render(mesh, { width: 380, height: 780, distance: 4.4, target: [0, 0.9, 0], ...o }));
const file = savePng(sheet(pngs, views.map((v) => v[0])), path.join(DIR, 'out', `${name}.png`));
console.log(file);

// gros plans : tête/épaules, mains, pieds
const closeups = [
  ['TETE', { yaw: 25, target: [0, 1.5, 0], distance: 1.6, fov: 26 }],
  ['MAIN', { yaw: 60, target: [0.27, 0.8, 0.02], distance: 1.0, fov: 26 }],
  ['PIED', { yaw: 40, target: [0.1, 0.08, 0.05], distance: 1.1, fov: 26 }],
  ['DOS HAUT', { yaw: 200, target: [0, 1.25, 0], distance: 1.8, fov: 26 }],
];
const cps = closeups.map(([, o]) => render(mesh, { width: 380, height: 380, ...o }));
console.log(savePng(sheet(cps, closeups.map((v) => v[0])), path.join(DIR, 'out', `${name}-closeups.png`)));
