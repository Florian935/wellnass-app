// preview.mjs (v4) — itération rapide sur la FORME : construit le corps, mesure le profil (v3 vs v4),
// et rend : repos (face, dos, 3/4, profil), profil v3/v4 côte à côte, silhouettes en aplat, gros plans.
// Usage : node preview.mjs [h=0.012] [nom=it]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBody, GRID } from './lib/body.mjs';
import { extract } from './lib/surfacenets.mjs';
import { render, savePng, sheet } from './lib/render.mjs';
import { components } from './lib/ctrl.mjs';
import { report, keyDepths } from './lib/profil.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const h = Number(process.argv[2] ?? 0.012);
const name = process.argv[3] ?? 'it';
const OUT = path.join(DIR, 'out');

const t0 = Date.now();
const body = buildBody();
const mesh = extract(body, { h, ...GRID });
const V = mesh.positions.length / 3, T = mesh.indices.length / 3;
const nSub = body.prims.filter((p) => p.op === 'sub').length;
console.log(`h=${h} : ${body.prims.length} primitives (${body.prims.length - nSub} volumes, ${nSub} capsules de sillon), ${V} sommets, ${T} triangles — ${Date.now() - t0} ms`);
const comps = components(mesh.indices, V);
console.log(`  composantes connexes : ${comps.length} ${comps.length > 1 ? '⚠ tailles ' + comps.join(', ') : '✔'}`);
const P = mesh.positions;
const slice = (y0, y1, xmax = 1) => { let x = 0, zmin = 1e9, zmax = -1e9; for (let i = 0; i < P.length; i += 3) { const y = P[i + 1]; if (y < y0 || y > y1 || Math.abs(P[i]) > xmax) continue; x = Math.max(x, Math.abs(P[i])); zmin = Math.min(zmin, P[i + 2]); zmax = Math.max(zmax, P[i + 2]); } return `${(2 * x * 100).toFixed(1)}×${((zmax - zmin) * 100).toFixed(1)}`; };
console.log(`  mesures (cm, largeur×prof.) : épaules ${slice(1.38, 1.46)} | poitrine ${slice(1.27, 1.33, 0.19)} | taille ${slice(1.06, 1.12, 0.19)} | hanches ${slice(0.88, 0.96, 0.21)} | cuisse ${slice(0.63, 0.67, 0.21)} | mollet ${slice(0.33, 0.37)}`);

// v3 de référence (cache)
const C = path.join(OUT, 'v3-cache');
const rd = (f, Ctor) => { const b = fs.readFileSync(path.join(C, f)); return new Ctor(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const v3 = { positions: rd('positions.f32', Float32Array), normals: rd('normals.f32', Float32Array), indices: rd('indices.u32', Uint32Array) };
console.log('\nProfil — bosses (écart max à la moyenne glissante 7 cm ; rugosité = |z″| moyen) :');
console.log(report(v3, 'v3'));
console.log(report(mesh, 'v4'));
console.log('\nProfondeurs médianes (cm) :\n  v3 ' + keyDepths(v3).replace('\n', '\n  v3 ') + '\n  v4 ' + keyDepths(mesh).replace('\n', '\n  v4 '));

const big = { width: 380, height: 780, distance: 4.4, target: [0, 0.9, 0] };
const views = [['FACE', { yaw: 0 }], ['DOS', { yaw: 180 }], ['3/4', { yaw: 40 }], ['PROFIL', { yaw: 90 }]];
savePng(sheet(views.map(([, o]) => render(mesh, { ...big, ...o })), views.map((v) => v[0])), path.join(OUT, `${name}-repos.png`));
// profil v3 / v4 côte à côte, torse en gros plan
const torso = { width: 380, height: 700, distance: 2.2, target: [0, 1.15, 0], fov: 26 };
savePng(sheet([render(v3, { ...torso, yaw: 90 }), render(mesh, { ...torso, yaw: 90 }), render(v3, { ...torso, yaw: 45 }), render(mesh, { ...torso, yaw: 45 })], ['V3 PROFIL', 'V4 PROFIL', 'V3 3/4', 'V4 3/4']), path.join(OUT, `${name}-profil.png`));
// silhouettes
const sil = { ...big, silhouette: true };
savePng(sheet([render(v3, { ...sil, yaw: 0 }), render(mesh, { ...sil, yaw: 0 }), render(v3, { ...sil, yaw: 90 }), render(mesh, { ...sil, yaw: 90 }), render(v3, { ...sil, yaw: 180 }), render(mesh, { ...sil, yaw: 180 })], ['V3 FACE', 'V4 FACE', 'V3 PROFIL', 'V4 PROFIL', 'V3 DOS', 'V4 DOS']), path.join(OUT, `${name}-silhouette.png`));
// gros plans : épaule (3/4 + profil), avant-bras, abdomen (face + profil), mollet
const CU = [
  ['EPAULE FACE', { yaw: 0, target: [0.2, 1.38, 0], distance: 1.0, fov: 26 }],
  ['EPAULE 3/4', { yaw: 35, target: [0.2, 1.36, 0], distance: 1.1, fov: 26 }],
  ['EPAULE DOS', { yaw: 180, target: [0.2, 1.38, 0], distance: 1.0, fov: 26 }],
  ['EPAULE PROFIL', { yaw: 90, target: [0.2, 1.36, 0], distance: 1.1, fov: 26 }],
  ['AVANT-BRAS', { yaw: 60, target: [0.25, 1.02, 0], distance: 1.1, fov: 26 }],
  ['ABDOMEN', { yaw: 0, target: [0, 1.15, 0.05], distance: 1.2, fov: 26 }],
  ['ABDOMEN PROFIL', { yaw: 90, target: [0, 1.15, 0.0], distance: 1.2, fov: 26 }],
  ['MOLLET', { yaw: 200, target: [0.1, 0.32, 0], distance: 1.1, fov: 26 }],
  ['DOS', { yaw: 180, target: [0, 1.25, 0], distance: 1.6, fov: 26 }],
  ['FESSIERS 3/4', { yaw: 150, target: [0.05, 0.9, 0], distance: 1.2, fov: 26 }],
];
savePng(sheet(CU.map(([, o]) => render(mesh, { width: 360, height: 420, ...o })), CU.map((v) => v[0])), path.join(OUT, `${name}-muscles.png`));
console.log(`\nPNG → ${OUT}/${name}-{repos,profil,silhouette,muscles}.png — ${Date.now() - t0} ms`);
