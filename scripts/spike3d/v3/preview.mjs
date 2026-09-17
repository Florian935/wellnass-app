// preview.mjs (v3) — construit le corps de base et rend : repos (face, dos, 3/4, profil) + gros plans
// musculaires (épaule-bras, dos, cuisse, mollet) pour juger les sillons. Compte les composantes connexes.
// Usage : node preview.mjs [h=0.010] [nom=preview]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBody, GRID } from './lib/body.mjs';
import { extract } from './lib/surfacenets.mjs';
import { render, savePng, sheet } from './lib/render.mjs';
import { components, MUSCLE_VIEWS } from './lib/ctrl.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const h = Number(process.argv[2] ?? 0.010);
const name = process.argv[3] ?? 'preview';

const t0 = Date.now();
const body = buildBody();
const mesh = extract(body, { h, ...GRID });
const V = mesh.positions.length / 3, T = mesh.indices.length / 3;
console.log(`h=${h} : ${body.prims.length} primitives (${body.prims.filter((p) => p.op === 'sub').length} sillons), ${mesh.grid.samples} échantillons (${mesh.grid.tSample} ms), ${V} sommets, ${T} triangles — ${Date.now() - t0} ms`);

const comps = components(mesh.indices, V);
console.log(`  composantes connexes : ${comps.length} ${comps.length > 1 ? '⚠ tailles ' + comps.join(', ') : '✔'}`);

// mesures : largeur (x) et profondeur (z) par tranche de hauteur
const P = mesh.positions;
const slice = (y0, y1, xmax = 1) => { let x = 0, zmin = 1e9, zmax = -1e9; for (let i = 0; i < P.length; i += 3) { const y = P[i + 1]; if (y < y0 || y > y1 || Math.abs(P[i]) > xmax) continue; x = Math.max(x, Math.abs(P[i])); zmin = Math.min(zmin, P[i + 2]); zmax = Math.max(zmax, P[i + 2]); } return `largeur ${(2 * x * 100).toFixed(1)} cm, prof. ${((zmax - zmin) * 100).toFixed(1)} cm`; };
for (const [n, a, b, xm] of [['tête', 1.62, 1.76], ['épaules', 1.38, 1.46], ['poitrine (tronc)', 1.27, 1.33, 0.19], ['taille (tronc)', 1.06, 1.12, 0.19], ['hanches (tronc)', 0.88, 0.96, 0.21], ['cuisse (y .65)', 0.63, 0.67, 0.21], ['mollet (y .35)', 0.33, 0.37]]) console.log(`  ${n.padEnd(18)} ${slice(a, b, xm)}`);
let ymax = 0; for (let i = 1; i < P.length; i += 3) ymax = Math.max(ymax, P[i]); console.log(`  taille totale ${(ymax * 100).toFixed(1)} cm`);

const big = { width: 380, height: 780, distance: 4.4, target: [0, 0.9, 0] };
const views = [['FACE', { yaw: 0 }], ['DOS', { yaw: 180 }], ['3/4', { yaw: 40 }], ['PROFIL', { yaw: 90 }]];
console.log(savePng(sheet(views.map(([, o]) => render(mesh, { ...big, ...o })), views.map((v) => v[0])), path.join(DIR, 'out', `${name}-repos.png`)));

console.log(savePng(sheet(MUSCLE_VIEWS.map(([, o]) => render(mesh, { width: 380, height: 420, ...o })), MUSCLE_VIEWS.map((v) => v[0])), path.join(DIR, 'out', `${name}-muscles.png`)));
