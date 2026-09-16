// build.mjs — pipeline complet : anatomie SDF → surface nets → 14 morphs → contrôles → GLB sparse
// (single + split) → planches PNG de contrôle (repos + extrêmes de morph).
// Usage : node build.mjs [h=0.014] [--no-render]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBody, GRID } from './lib/body.mjs';
import { extract } from './lib/surfacenets.mjs';
import { MORPH_NAMES, MORPHS_BY_PART, prepareVertexData, computeDeltas, tagTriangles, enforceSeams, Y_SEAM_UPPER, Y_SEAM_LEGS } from './lib/morphs.mjs';
import { extractPart, checkMorphIntegrity, writeSparseGlb } from './lib/export.mjs';
import { render, savePng, sheet, computeNormals } from './lib/render.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, process.argv.slice(2).find((a) => a.startsWith('--out='))?.slice(6) ?? 'out');
const args = process.argv.slice(2);
const h = Number(args.find((a) => !a.startsWith('--')) ?? 0.014);
const doRender = !args.includes('--no-render');
const kb = (n) => (n / 1024).toFixed(1).padStart(7) + ' Ko';

// ─── 1. géométrie ───
let t0 = Date.now();
const body = buildBody();
const mesh = extract(body, { h, ...GRID });
const { positions, normals, indices } = mesh;
const V = positions.length / 3, T = indices.length / 3;
console.log(`Anatomie : ${body.prims.length} primitives ; grille h=${h} m (${mesh.grid.nx}×${mesh.grid.ny}×${mesh.grid.nz}) ; ${V} sommets, ${T} triangles (soudure : ${mesh.grid.merged} sommets fusionnés, ${mesh.grid.dropped} triangles dégénérés retirés) — ${Date.now() - t0} ms`);

// mesures anatomiques par lancer de rayon dans le SDF (exclut les bras)
const march = (y, z, dir) => { let x = 0; while (x < 0.4 && body.dist(x * dir, y, z) < 0) x += 0.001; return x; };
const marchZ = (y, x, dir) => { let z = 0; while (z < 0.3 && body.dist(x, y, z * dir) < 0) z += 0.001; return z; };
const widthAt = (y, z = -0.012) => march(y, z, 1) + march(y, z, -1);
const depthAt = (y, x = 0) => marchZ(y, x, 1) + marchZ(y, x, -1);
console.log(`  tête ${(widthAt(1.70, -0.006) * 100).toFixed(1)} cm large × ${(depthAt(1.70) * 100).toFixed(1)} prof.` +
  ` | poitrine (y1.30) ${(widthAt(1.30) * 100).toFixed(1)} × ${(depthAt(1.30) * 100).toFixed(1)} | taille (y1.09) ${(widthAt(1.09) * 100).toFixed(1)} × ${(depthAt(1.09) * 100).toFixed(1)}` +
  ` | hanches (y0.92) ${(widthAt(0.92) * 100).toFixed(1)} × ${(depthAt(0.92) * 100).toFixed(1)}`);
let shoulderW = 0, ymax = 0; for (let i = 0; i < V; i++) { const y = positions[3 * i + 1]; ymax = Math.max(ymax, y); if (y > 1.36 && y < 1.48) shoulderW = Math.max(shoulderW, Math.abs(positions[3 * i])); }
console.log(`  épaules (deltoïdes) ${(2 * shoulderW * 100).toFixed(1)} cm | taille totale ${(ymax * 100).toFixed(1)} cm | cuisse (x .095) ${(( march(0.65, 0.0, 1) ) * 0 + (() => { let a = 0.095, lo = a, hi = a; while (body.dist(lo, 0.65, 0.01) < 0) lo -= 0.001; while (body.dist(hi, 0.65, 0.01) < 0) hi += 0.001; return (hi - lo) * 100; })()).toFixed(1)} cm large`);

// topologie : arêtes non-manifold / bords ouverts
{
  const edges = new Map();
  for (let t = 0; t < T; t++) for (let q = 0; q < 3; q++) { const a = indices[3 * t + q], b = indices[3 * t + (q + 1) % 3]; const k = a < b ? `${a}_${b}` : `${b}_${a}`; edges.set(k, (edges.get(k) ?? 0) + 1); }
  let open = 0, nonManifold = 0; for (const c of edges.values()) { if (c === 1) open++; else if (c > 2) nonManifold++; }
  console.log(`  topologie : ${edges.size} arêtes, ${open} ouvertes, ${nonManifold} non-manifold`);
}

// ─── 2. morphs ───
t0 = Date.now();
const data = prepareVertexData(body, positions, normals); data.indices = indices;
const deltas = computeDeltas(positions, normals, data);
const tags = tagTriangles(positions, indices, data);
const seamReport = enforceSeams(positions, indices, tags, deltas);
console.log(`Morphs calculés en ${Date.now() - t0} ms ; parties : ${['upper', 'trunk', 'legs'].map((p) => `${p} ${tags.filter((t) => t === p).length} tris`).join(', ')}`);
const forced = Object.entries(seamReport).filter(([, r]) => r.forced);
if (forced.length) console.log(`  ⚠ deltas écrasés aux jonctions : ${forced.map(([n, r]) => `${n} ${r.forced} sommets (max ${(r.maxKilled * 1000).toFixed(2)} mm)`).join(' ; ')}`);
else console.log('  jonctions : aucun delta à écraser (les fenêtres s\'arrêtent avant les plans de découpe)');

console.log('\nMorph target        | sommets touchés | dépl. max (cm) | faces retournées / dégénérées aux extrêmes');
let anyBad = false;
for (const name of MORPH_NAMES) {
  const d = deltas[name];
  let touched = 0; for (let i = 0; i < V; i++) if (d[3 * i] || d[3 * i + 1] || d[3 * i + 2]) touched++;
  const weights = name.startsWith('prop_') ? [1, -1] : [1];
  const res = weights.map((w) => checkMorphIntegrity(positions, indices, d, w));
  const flipped = res.reduce((s, r) => s + r.flipped, 0), degen = res.reduce((s, r) => s + r.degenerate, 0);
  if (flipped || degen) anyBad = true;
  console.log(`${name.padEnd(19)} | ${String(touched).padStart(6)} / ${V}  | ${(res[0].maxDisp * 100).toFixed(1).padStart(8)}       | ${flipped} / ${degen}  (poids ${weights.join(', ')})`);
}
// combinaison extrême : toutes les proportions à +1 et toutes les intentions à +1 (puis tout à −1 pour les proportions)
for (const [label, wOf] of [['tout +1', () => 1], ['props −1, goals +1', (n) => (n.startsWith('prop_') ? -1 : 1)]]) {
  const combo = new Float32Array(V * 3);
  for (const n of MORPH_NAMES) { const w = wOf(n); const d = deltas[n]; for (let i = 0; i < combo.length; i++) combo[i] += w * d[i]; }
  const r = checkMorphIntegrity(positions, indices, combo, 1);
  console.log(`combinaison « ${label} » : ${r.flipped} faces retournées, ${r.degenerate} dégénérées, dépl. max ${(r.maxDisp * 100).toFixed(1)} cm`);
  if (r.flipped) { // localiser : centroïdes des faces retournées, regroupés par zone
    const p = new Float32Array(positions.length); for (let i = 0; i < p.length; i++) p[i] = positions[i] + combo[i];
    const zones = {};
    for (let t = 0; t < indices.length; t += 3) {
      const i = indices[t], j = indices[t + 1], k = indices[t + 2];
      const n = [0, 1, 2].map((q) => 0), a = (arr, v, q) => arr[3 * v + q];
      const e1 = [a(p, j, 0) - a(p, i, 0), a(p, j, 1) - a(p, i, 1), a(p, j, 2) - a(p, i, 2)], e2 = [a(p, k, 0) - a(p, i, 0), a(p, k, 1) - a(p, i, 1), a(p, k, 2) - a(p, i, 2)];
      const f1 = [a(positions, j, 0) - a(positions, i, 0), a(positions, j, 1) - a(positions, i, 1), a(positions, j, 2) - a(positions, i, 2)], f2 = [a(positions, k, 0) - a(positions, i, 0), a(positions, k, 1) - a(positions, i, 1), a(positions, k, 2) - a(positions, i, 2)];
      const c1 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const c0 = [f1[1] * f2[2] - f1[2] * f2[1], f1[2] * f2[0] - f1[0] * f2[2], f1[0] * f2[1] - f1[1] * f2[0]];
      if (c1[0] * c0[0] + c1[1] * c0[1] + c1[2] * c0[2] >= 0) continue;
      const cx = (a(positions, i, 0) + a(positions, j, 0) + a(positions, k, 0)) / 3, cy = (a(positions, i, 1) + a(positions, j, 1) + a(positions, k, 1)) / 3, cz = (a(positions, i, 2) + a(positions, j, 2) + a(positions, k, 2)) / 3;
      const key = `y≈${(Math.round(cy * 20) / 20).toFixed(2)} |x|≈${(Math.round(Math.abs(cx) * 20) / 20).toFixed(2)} z${cz >= 0 ? '+' : '-'}`;
      zones[key] = (zones[key] ?? 0) + 1;
    }
    console.log('   zones : ' + Object.entries(zones).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k} ×${n}`).join(' ; '));
  }
  if (r.flipped || r.degenerate) anyBad = true;
}

// ─── 3. export ───
fs.mkdirSync(OUT, { recursive: true });
const singleMorphs = MORPH_NAMES.map((name) => ({ name, delta: deltas[name] }));
const sp1 = writeSparseGlb([{ name: 'body', positions, normals, indices, morphs: singleMorphs }], 'mesh-v2 build.mjs (sparse)');
const fSingle = path.join(OUT, 'body-v2-single.glb');
fs.writeFileSync(fSingle, sp1.glb);
const parts = {};
const splitMeshes = [];
for (const split of ['upper', 'trunk', 'legs']) {
  const part = extractPart(positions, normals, indices, tags, deltas, split, MORPHS_BY_PART[split]);
  if (part.leaks.length) throw new Error('découpe incohérente :\n  ' + part.leaks.join('\n  '));
  parts[split] = part;
  splitMeshes.push({ name: `body_${split}`, positions: part.positions, normals: part.normals, indices: part.indices, morphs: part.morphs });
}
const sp3 = writeSparseGlb(splitMeshes, 'mesh-v2 build.mjs (sparse, split)');
const fSplit = path.join(OUT, 'body-v2-split.glb');
fs.writeFileSync(fSplit, sp3.glb);
const morphBytes = sp1.sparseStats.reduce((s, r) => s + r.bytes, 0);
console.log(`\nFichiers :\n  ${fSingle}  ${kb(fs.statSync(fSingle).size)}  (dont données de morph sparse : ${kb(morphBytes)} ; base géométrie ≈ ${kb(V * 24 + T * 6)})\n  ${fSplit}  ${kb(fs.statSync(fSplit).size)}`);
console.log(`Découpe : ${['upper', 'trunk', 'legs'].map((s) => `${s} ${parts[s].positions.length / 3} sommets / ${parts[s].indices.length / 3} tris / ${parts[s].morphs.length} morphs`).join(' ; ')}`);
const keyOf = (arr, i) => `${arr[3 * i]},${arr[3 * i + 1]},${arr[3 * i + 2]}`;
const shared = (a, b) => { const s = new Set(); for (let i = 0; i < a.positions.length / 3; i++) s.add(keyOf(a.positions, i)); let n = 0; for (let i = 0; i < b.positions.length / 3; i++) if (s.has(keyOf(b.positions, i))) n++; return n; };
console.log(`Sommets partagés : upper∩trunk = ${shared(parts.upper, parts.trunk)}, trunk∩legs = ${shared(parts.trunk, parts.legs)}, upper∩legs = ${shared(parts.upper, parts.legs)}`);
fs.writeFileSync(path.join(OUT, 'morph-map.json'), JSON.stringify({
  vertices: V, triangles: T, grid: h, morphs: MORPH_NAMES, morphsByPart: MORPHS_BY_PART,
  seams: { upperTrunk: Y_SEAM_UPPER, trunkLegs: Y_SEAM_LEGS, note: 'membre supérieur (bras + mains) toujours dans upper' },
  weightMapping: { 'prop_*': 'poids = valeur / 2 ∈ [-1,+1]', 'goal_*': 'poids = valeur / 4 ∈ [0,1]' },
  files: { single: 'body-v2-single.glb', split: 'body-v2-split.glb' },
}, null, 2));

// ─── 4. planches de contrôle ───
if (doRender) {
  t0 = Date.now();
  const morphed = (weights, recomputeNormals = true) => {
    const p = Float32Array.from(positions);
    for (const [n, w] of Object.entries(weights)) { if (!w) continue; const d = deltas[n]; for (let i = 0; i < p.length; i++) p[i] += w * d[i]; }
    return { positions: p, normals: recomputeNormals ? computeNormals(p, indices) : normals, indices };
  };
  const big = { width: 380, height: 780, distance: 4.4, target: [0, 0.9, 0] };
  const small = { width: 250, height: 620, distance: 4.6, target: [0, 0.9, 0], fov: 26 };
  // repos
  const restViews = [['FACE', { yaw: 0 }], ['DOS', { yaw: 180 }], ['3/4', { yaw: 40 }], ['PROFIL', { yaw: 90 }]];
  savePng(sheet(restViews.map(([, o]) => render(mesh, { ...big, ...o })), restViews.map((v) => v[0])), path.join(OUT, 'ctrl-repos.png'));
  savePng(sheet([render(mesh, { ...big, yaw: 20, wire: true }), render(mesh, { yaw: 20, width: 380, height: 780, target: [0, 1.3, 0], distance: 1.9, wire: true })], ['FIL DE FER', 'FIL DE FER TORSE']), path.join(OUT, 'ctrl-filaire.png'));
  const closeups = [
    ['TETE', { yaw: 25, target: [0, 1.5, 0], distance: 1.6, fov: 26 }],
    ['MAIN', { yaw: 60, target: [0.27, 0.8, 0.02], distance: 1.0, fov: 26 }],
    ['PIED', { yaw: 40, target: [0.1, 0.08, 0.05], distance: 1.1, fov: 26 }],
    ['DOS HAUT', { yaw: 200, target: [0, 1.25, 0], distance: 1.8, fov: 26 }],
  ];
  savePng(sheet(closeups.map(([, o]) => render(mesh, { width: 380, height: 380, ...o })), closeups.map((v) => v[0])), path.join(OUT, 'ctrl-gros-plans.png'));
  // proportions : −1 | repos | +1, de face (et de dos pour les fessiers/mollets)
  const propsA = ['prop_shoulders', 'prop_chest', 'prop_waist', 'prop_hips'];
  const propsB = ['prop_arms', 'prop_thighs', 'prop_calves'];
  for (const [file, list] of [['ctrl-props-1.png', propsA], ['ctrl-props-2.png', propsB]]) {
    const imgs = [], labels = [];
    for (const n of list) for (const w of [-1, 1]) { imgs.push(render(morphed({ [n]: w }), { ...small, yaw: n === 'prop_calves' ? 180 : 0 })); labels.push(`${n.slice(5)} ${w > 0 ? '+1' : '-1'}`); }
    savePng(sheet(imgs, labels), path.join(OUT, file));
  }
  // intentions : +1, vue pertinente
  const goals = [['goal_shoulders', 0], ['goal_chest', 0], ['goal_back', 180], ['goal_arms', 0], ['goal_glutes', 180], ['goal_thighs', 0], ['goal_calves', 180]];
  savePng(sheet([render(mesh, { ...small, yaw: 0 }), ...goals.map(([n, yaw]) => render(morphed({ [n]: 1 }), { ...small, yaw }))], ['REPOS', ...goals.map(([n]) => n.slice(5) + ' +1')]), path.join(OUT, 'ctrl-goals.png'));
  // combinaisons extrêmes + normales de base (ce que l'app affiche, sans morph des normales)
  const all1 = Object.fromEntries(MORPH_NAMES.map((n) => [n, 1]));
  const propsNeg = Object.fromEntries(MORPH_NAMES.map((n) => [n, n.startsWith('prop_') ? -1 : 1]));
  const propsNegOnly = Object.fromEntries(MORPH_NAMES.map((n) => [n, n.startsWith('prop_') ? -1 : 0]));
  savePng(sheet([
    render(mesh, { ...small, yaw: 0 }), render(morphed(all1), { ...small, yaw: 0 }), render(morphed(all1), { ...small, yaw: 180 }),
    render(morphed(propsNegOnly), { ...small, yaw: 0 }), render(morphed(propsNeg), { ...small, yaw: 40 }),
    render(morphed(all1, false), { ...small, yaw: 0 }),
  ], ['REPOS', 'TOUT +1 FACE', 'TOUT +1 DOS', 'PROPS -1', 'PROPS -1 GOALS +1', 'TOUT +1 NORMALES BASE']), path.join(OUT, 'ctrl-extremes.png'));
  // gros plan aisselle/épaule aux extrêmes de prop_shoulders (zone soudée la plus sollicitée)
  const pit = { width: 380, height: 380, yaw: 30, target: [0.2, 1.3, 0], distance: 1.3, fov: 26 };
  savePng(sheet([render(mesh, pit), render(morphed({ prop_shoulders: -1 }), pit), render(morphed({ prop_shoulders: 1 }), pit), render(morphed({ prop_chest: -1 }), pit), render(morphed({ prop_chest: 1 }), pit)],
    ['EPAULE REPOS', 'SHOULDERS -1', 'SHOULDERS +1', 'CHEST -1', 'CHEST +1']), path.join(OUT, 'ctrl-epaule.png'));
  console.log(`\nPlanches PNG rendues en ${Date.now() - t0} ms dans ${OUT}`);
}
console.log(anyBad ? '\n⚠ Des faces retournées/dégénérées existent aux extrêmes (voir tableau).' : '\n✔ Aucune face retournée ni dégénérée aux extrêmes testés.');
