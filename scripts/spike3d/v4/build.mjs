// build.mjs (v4) — pipeline complet : anatomie SDF (enveloppe lisse + ventres tangents + sillons) → surface nets
// → 14 morphs → contrôles → GLB sparse (single + split) → planches PNG. Le PROFIL est le juge : mesures de
// bosses v3/v4 et planches ctrl-profil / ctrl-silhouette en tête.
// Usage : node build.mjs [h=0.012] [--no-render] [--out=out]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBody, GRID } from './lib/body.mjs';
import { extract } from './lib/surfacenets.mjs';
import { MORPH_NAMES, MORPHS_BY_PART, prepareVertexData, computeDeltas, tagTriangles, enforceSeams, repairFlips, Y_SEAM_LEGS, SEAM_UT_BACK, SEAM_UT_FRONT } from './lib/morphs.mjs';
import { extractPart, checkMorphIntegrity, writeSparseGlb } from './lib/export.mjs';
import { render, savePng, sheet, computeNormals } from './lib/render.mjs';
import { components } from './lib/ctrl.mjs';
import { report, keyDepths, summary } from './lib/profil.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const OUT = path.join(DIR, args.find((a) => a.startsWith('--out='))?.slice(6) ?? 'out');
const h = Number(args.find((a) => !a.startsWith('--')) ?? 0.012);
const doRender = !args.includes('--no-render');
const kb = (n) => (n / 1024).toFixed(1).padStart(7) + ' Ko';
const V3_SINGLE_BYTES = 1398840, V3_SPLIT_BYTES = 1406548, V3_TRIS = 44866; // v3 h=0.011, mesurés (build v3-ref)

// ─── 1. géométrie ───
let t0 = Date.now();
const body = buildBody();
const mesh = extract(body, { h, ...GRID });
const { positions, normals, indices } = mesh;
const V = positions.length / 3, T = indices.length / 3;
const nSub = body.prims.filter((p) => p.op === 'sub').length, nBelly = body.prims.filter((p) => p.skin).length;
console.log(`Anatomie v4 : ${body.prims.length} primitives (${body.prims.length - nSub - nBelly} volumes d'enveloppe, ${nBelly} ventres tangents, ${nSub} capsules de sillon) ; grille h=${h} m (${mesh.grid.nx}×${mesh.grid.ny}×${mesh.grid.nz}) ; ${V} sommets, ${T} triangles (v3 : ${V3_TRIS}, ${(100 * (T / V3_TRIS - 1)).toFixed(0)} %) — ${Date.now() - t0} ms`);
console.log(`  soudure : ${mesh.grid.merged} sommets fusionnés, ${mesh.grid.dropped} triangles dégénérés retirés ; nettoyage : ${mesh.grid.removedComponents} composante(s) < 50 tris retirée(s) (${mesh.grid.removedTriangles} tris), ${mesh.grid.orphanVertices} sommet(s) orphelin(s)`);
const comps = components(indices, V);
console.log(`  composantes connexes : ${comps.length}${comps.length > 1 ? ' ⚠ tailles ' + comps.join(', ') : ' ✔'}`);
const P = positions;
const slice = (y0, y1, xmax = 1) => { let x = 0, zmin = 1e9, zmax = -1e9; for (let i = 0; i < P.length; i += 3) { const y = P[i + 1]; if (y < y0 || y > y1 || Math.abs(P[i]) > xmax) continue; x = Math.max(x, Math.abs(P[i])); zmin = Math.min(zmin, P[i + 2]); zmax = Math.max(zmax, P[i + 2]); } return { w: 2 * x, d: zmax - zmin }; };
const mes = (label, a, b, xm) => { const s = slice(a, b, xm); return `${label} ${(s.w * 100).toFixed(1)}×${(s.d * 100).toFixed(1)}`; };
let ymax = 0; for (let i = 1; i < P.length; i += 3) ymax = Math.max(ymax, P[i]);
console.log(`  mesures (cm, largeur×prof.) : ${mes('épaules', 1.38, 1.46)} | ${mes('poitrine', 1.27, 1.33, 0.19)} | ${mes('taille', 1.06, 1.12, 0.19)} | ${mes('hanches', 0.88, 0.96, 0.21)} | ${mes('cuisse', 0.63, 0.67, 0.21)} | ${mes('mollet', 0.33, 0.37)} | taille totale ${(ymax * 100).toFixed(1)}`);
{
  const edges = new Map();
  for (let t = 0; t < T; t++) for (let q = 0; q < 3; q++) { const a = indices[3 * t + q], b = indices[3 * t + (q + 1) % 3]; const k = a < b ? `${a}_${b}` : `${b}_${a}`; edges.set(k, (edges.get(k) ?? 0) + 1); }
  let open = 0, nonManifold = 0; for (const c of edges.values()) { if (c === 1) open++; else if (c > 2) nonManifold++; }
  console.log(`  topologie : ${edges.size} arêtes, ${open} ouvertes, ${nonManifold} non-manifold`);
}
// v3 de référence (cache produit par v3-cache.mjs)
const C = path.join(DIR, 'out', 'v3-cache');
const rd = (f, Ctor) => { const b = fs.readFileSync(path.join(C, f)); return new Ctor(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const v3 = { positions: rd('positions.f32', Float32Array), normals: rd('normals.f32', Float32Array), indices: rd('indices.u32', Uint32Array), goals: rd('goals.f32', Float32Array), all: rd('all.f32', Float32Array) };
const displaced = (m, d, w = 1) => { const p = new Float32Array(m.positions.length); for (let i = 0; i < p.length; i++) p[i] = m.positions[i] + w * d[i]; return { positions: p, normals: computeNormals(p, m.indices), indices: m.indices }; };
console.log('\nPROFIL au repos — bosses (écart max à la moyenne glissante 7 cm ; rugosité = |z″| moyen), mesuré par intersection ligne/maillage :');
console.log(report(v3, 'v3')); console.log(report(mesh, 'v4'));
console.log('Profondeurs du profil médian (cm) :\n  v3 ' + keyDepths(v3).replace('\n', '\n  v3 ') + '\n  v4 ' + keyDepths(mesh).replace('\n', '\n  v4 '));

// ─── 2. morphs ───
t0 = Date.now();
const data = prepareVertexData(body, positions, normals); data.indices = indices;
const deltas = computeDeltas(positions, normals, data);
const tags = tagTriangles(positions, indices, data);
let seamReport = enforceSeams(positions, indices, tags, deltas);
const repaired = repairFlips(positions, indices, deltas);
if (repaired) { seamReport = enforceSeams(positions, indices, tags, deltas); }
console.log(`\nMorphs calculés en ${Date.now() - t0} ms ; réparation ciblée : ${repaired} micro-triangle(s) ; parties : ${['upper', 'trunk', 'legs'].map((p) => `${p} ${tags.filter((t) => t === p).length} tris`).join(', ')} ; coutures : haut/tronc ${SEAM_UT_BACK} (dos) → ${SEAM_UT_FRONT} (face), tronc/jambes y=${Y_SEAM_LEGS}`);
const forced = Object.entries(seamReport).filter(([, r]) => r.forced);
console.log(forced.length ? `  ⚠ deltas écrasés aux jonctions : ${forced.map(([n, r]) => `${n} ${r.forced} sommets (max ${(r.maxKilled * 1000).toFixed(2)} mm)`).join(' ; ')}` : '  jonctions : aucun delta à écraser');
console.log('\nMorph target        | sommets touchés | dépl. max (cm) | faces retournées / dégénérées aux extrêmes');
let anyBad = false;
const stats = {};
for (const name of MORPH_NAMES) {
  const d = deltas[name];
  let touched = 0; for (let i = 0; i < V; i++) if (d[3 * i] || d[3 * i + 1] || d[3 * i + 2]) touched++;
  const weights = name.startsWith('prop_') ? [1, -1] : [1];
  const res = weights.map((w) => checkMorphIntegrity(positions, indices, d, w));
  const flipped = res.reduce((s, r) => s + r.flipped, 0), degen = res.reduce((s, r) => s + r.degenerate, 0);
  if (flipped || degen) anyBad = true;
  stats[name] = { touched, maxDispCm: +(res[0].maxDisp * 100).toFixed(2), flipped, degenerate: degen };
  console.log(`${name.padEnd(19)} | ${String(touched).padStart(6)} / ${V}  | ${(res[0].maxDisp * 100).toFixed(1).padStart(8)}       | ${flipped} / ${degen}  (poids ${weights.join(', ')})`);
}
const COMBOS = [
  ['tout +1', () => 1], ['props −1, goals +1', (n) => (n.startsWith('prop_') ? -1 : 1)],
  ['props −1', (n) => (n.startsWith('prop_') ? -1 : 0)], ['props +1', (n) => (n.startsWith('prop_') ? 1 : 0)], ['goals +1', (n) => (n.startsWith('goal_') ? 1 : 0)],
];
const comboDelta = (wOf) => { const c = new Float32Array(V * 3); for (const n of MORPH_NAMES) { const w = wOf(n); if (!w) continue; const d = deltas[n]; for (let i = 0; i < c.length; i++) c[i] += w * d[i]; } return c; };
const comboStats = {};
for (const [label, wOf] of COMBOS) {
  const r = checkMorphIntegrity(positions, indices, comboDelta(wOf), 1);
  comboStats[label] = { flipped: r.flipped, degenerate: r.degenerate, maxDispCm: +(r.maxDisp * 100).toFixed(2) };
  console.log(`combinaison « ${label} » : ${r.flipped} faces retournées, ${r.degenerate} dégénérées, dépl. max ${(r.maxDisp * 100).toFixed(1)} cm`);
  if (r.flipped || r.degenerate) anyBad = true;
}
const morphedPositions = (wOf) => { const c = comboDelta(wOf); const p = new Float32Array(V * 3); for (let i = 0; i < p.length; i++) p[i] = positions[i] + c[i]; return p; };
{
  const coreMask = data.masks.torso.map((m, i) => m + data.masks.pelvis[i]);
  const widths = (p) => { const s = (y0, y1, xm, core = false) => { let x = 0; for (let i = 0; i < p.length; i += 3) { const y = p[i + 1]; if (y < y0 || y > y1 || Math.abs(p[i]) > xm || (core && coreMask[i / 3] < 0.5)) continue; x = Math.max(x, Math.abs(p[i])); } return (200 * x).toFixed(1); }; return `épaules ${s(1.36, 1.48, 1)} | poitrine ${s(1.27, 1.33, 1, true)} | taille ${s(1.06, 1.12, 1, true)} | hanches ${s(0.88, 0.96, 1, true)} | cuisse ${s(0.63, 0.67, 0.22)} | mollet ${s(0.33, 0.37, 1)}`; };
  console.log(`\nLargeurs (cm)  repos            : ${widths(positions)}`);
  for (const [label, wOf] of COMBOS) console.log(`               ${label.padEnd(17)}: ${widths(morphedPositions(wOf))}`);
}
// profil à « goals +1 » : les intentions doivent rester des muscles, pas des ballons
const v4goals = { positions: morphedPositions((n) => (n.startsWith('goal_') ? 1 : 0)), indices };
const v3goals = displaced(v3, v3.goals);
console.log('\nPROFIL à « goals +1 » — bosses :');
console.log(report(v3goals, 'v3')); console.log(report(v4goals, 'v4'));

// ─── 3. export ───
fs.mkdirSync(OUT, { recursive: true });
const singleMorphs = MORPH_NAMES.map((name) => ({ name, delta: deltas[name] }));
const sp1 = writeSparseGlb([{ name: 'body', positions, normals, indices, morphs: singleMorphs }], 'mesh-v4 build.mjs (sparse)');
const fSingle = path.join(OUT, 'body-v4-single.glb');
fs.writeFileSync(fSingle, sp1.glb);
const parts = {};
const splitMeshes = [];
for (const split of ['upper', 'trunk', 'legs']) {
  const part = extractPart(positions, normals, indices, tags, deltas, split, MORPHS_BY_PART[split]);
  if (part.leaks.length) throw new Error('découpe incohérente :\n  ' + part.leaks.join('\n  '));
  parts[split] = part;
  splitMeshes.push({ name: `body_${split}`, positions: part.positions, normals: part.normals, indices: part.indices, morphs: part.morphs });
}
const sp3 = writeSparseGlb(splitMeshes, 'mesh-v4 build.mjs (sparse, split)');
const fSplit = path.join(OUT, 'body-v4-split.glb');
fs.writeFileSync(fSplit, sp3.glb);
const morphBytes = sp1.sparseStats.reduce((s, r) => s + r.bytes, 0);
const sSingle = fs.statSync(fSingle).size, sSplit = fs.statSync(fSplit).size;
console.log(`\nFichiers :\n  ${fSingle}  ${kb(sSingle)}  (v3 ${kb(V3_SINGLE_BYTES)} → ${((sSingle / V3_SINGLE_BYTES - 1) * 100).toFixed(1)} %) — dont morphs sparse ${kb(morphBytes)}, base géométrie ≈ ${kb(V * 24 + T * 6)}\n  ${fSplit}  ${kb(sSplit)}  (v3 ${kb(V3_SPLIT_BYTES)} → ${((sSplit / V3_SPLIT_BYTES - 1) * 100).toFixed(1)} %)`);
console.log(`Découpe : ${['upper', 'trunk', 'legs'].map((s) => `${s} ${parts[s].positions.length / 3} sommets / ${parts[s].indices.length / 3} tris / ${parts[s].morphs.length} morphs`).join(' ; ')}`);
const keyOf = (arr, i) => `${arr[3 * i]},${arr[3 * i + 1]},${arr[3 * i + 2]}`;
const shared = (a, b) => { const s = new Set(); for (let i = 0; i < a.positions.length / 3; i++) s.add(keyOf(a.positions, i)); let n = 0; for (let i = 0; i < b.positions.length / 3; i++) if (s.has(keyOf(b.positions, i))) n++; return n; };
console.log(`Sommets partagés : upper∩trunk = ${shared(parts.upper, parts.trunk)}, trunk∩legs = ${shared(parts.trunk, parts.legs)}, upper∩legs = ${shared(parts.upper, parts.legs)}`);
fs.writeFileSync(path.join(OUT, 'morph-map.json'), JSON.stringify({
  version: 'v4', approach: 'enveloppe lisse (k ≥ 0,03) + ventres tangents (relief ≈ k/4 = 3–7 mm) + sillons creusés', vertices: V, triangles: T, grid: h, morphs: MORPH_NAMES, morphsByPart: MORPHS_BY_PART,
  seams: { upperTrunk: { back: SEAM_UT_BACK, front: SEAM_UT_FRONT, note: 'surface seamUT(x,z) le long du rebord costal' }, trunkLegs: Y_SEAM_LEGS, note: 'membre supérieur (bras + mains) toujours dans upper' },
  weightMapping: { 'prop_*': 'poids = valeur / 2 ∈ [-1,+1]', 'goal_*': 'poids = valeur / 4 ∈ [0,1]' },
  files: { single: 'body-v4-single.glb', split: 'body-v4-split.glb' },
  sizes: { single: sSingle, split: sSplit, v3single: V3_SINGLE_BYTES, v3split: V3_SPLIT_BYTES },
  profile: { rest: { v3: summary(v3), v4: summary(mesh) }, goals1: { v3: summary(v3goals), v4: summary(v4goals) } },
  stats, combos: comboStats,
}, null, 2));

// ─── 4. planches de contrôle ───
if (doRender) {
  t0 = Date.now();
  const morphed = (weights, recomputeNormals = true) => {
    const p = Float32Array.from(positions);
    for (const [n, w] of Object.entries(weights)) { if (!w) continue; const d = deltas[n]; for (let i = 0; i < p.length; i++) p[i] += w * d[i]; }
    return { positions: p, normals: recomputeNormals ? computeNormals(p, indices) : normals, indices };
  };
  const morphedSplit = (weights, recomputeNormals = true) => {
    const pos = [], idx = [], nor = [];
    let base = 0;
    for (const split of ['upper', 'trunk', 'legs']) {
      const part = parts[split];
      const p = Float32Array.from(part.positions);
      for (const { name, delta } of part.morphs) { const w = weights[name] ?? 0; if (!w) continue; for (let i = 0; i < p.length; i++) p[i] += w * delta[i]; }
      const n = recomputeNormals ? computeNormals(p, part.indices) : part.normals;
      for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
      for (let i = 0; i < part.indices.length; i++) idx.push(part.indices[i] + base);
      base += p.length / 3;
    }
    return { positions: new Float32Array(pos), normals: new Float32Array(nor), indices: Uint32Array.from(idx) };
  };
  const all1 = Object.fromEntries(MORPH_NAMES.map((n) => [n, 1]));
  const goalsOnly = Object.fromEntries(MORPH_NAMES.map((n) => [n, n.startsWith('goal_') ? 1 : 0]));
  const propsNeg = Object.fromEntries(MORPH_NAMES.map((n) => [n, n.startsWith('prop_') ? -1 : 1]));
  const propsNegOnly = Object.fromEntries(MORPH_NAMES.map((n) => [n, n.startsWith('prop_') ? -1 : 0]));
  const propsPosOnly = Object.fromEntries(MORPH_NAMES.map((n) => [n, n.startsWith('prop_') ? 1 : 0]));
  const v4goalsMesh = morphedSplit(goalsOnly);
  const big = { width: 380, height: 780, distance: 4.4, target: [0, 0.9, 0] };
  const small = { width: 250, height: 620, distance: 4.6, target: [0, 0.9, 0], fov: 26 };
  // ★ ctrl-profil : profil strict + 3/4, repos et goals +1, v3 / v4 côte à côte (torse en gros plan, la zone qui fâchait)
  const torso = { width: 340, height: 720, distance: 2.3, target: [0, 1.12, 0], fov: 26 };
  savePng(sheet([
    render(v3, { ...torso, yaw: 90 }), render(mesh, { ...torso, yaw: 90 }), render(v3, { ...torso, yaw: 45 }), render(mesh, { ...torso, yaw: 45 }),
    render(v3goals, { ...torso, yaw: 90 }), render(v4goalsMesh, { ...torso, yaw: 90 }), render(v3goals, { ...torso, yaw: 45 }), render(v4goalsMesh, { ...torso, yaw: 45 }),
  ], ['V3 PROFIL REPOS', 'V4 PROFIL REPOS', 'V3 3/4 REPOS', 'V4 3/4 REPOS', 'V3 PROFIL GOALS +1', 'V4 PROFIL GOALS +1', 'V3 3/4 GOALS +1', 'V4 3/4 GOALS +1']), path.join(OUT, 'ctrl-profil.png'));
  // ★ ctrl-silhouette : aplat noir, face / profil / dos, v3 vs v4
  const sil = { ...big, silhouette: true, width: 330 };
  savePng(sheet([render(v3, { ...sil, yaw: 0 }), render(mesh, { ...sil, yaw: 0 }), render(v3, { ...sil, yaw: 90 }), render(mesh, { ...sil, yaw: 90 }), render(v3, { ...sil, yaw: 180 }), render(mesh, { ...sil, yaw: 180 })],
    ['V3 FACE', 'V4 FACE', 'V3 PROFIL', 'V4 PROFIL', 'V3 DOS', 'V4 DOS']), path.join(OUT, 'ctrl-silhouette.png'));
  // repos
  const restViews = [['FACE', { yaw: 0 }], ['DOS', { yaw: 180 }], ['3/4', { yaw: 40 }], ['PROFIL', { yaw: 90 }]];
  savePng(sheet(restViews.map(([, o]) => render(mesh, { ...big, ...o })), restViews.map((v) => v[0])), path.join(OUT, 'ctrl-repos.png'));
  // gros plans : épaule, avant-bras, abdomen, mollet (+ dos, fessiers) — 2 planches lisibles
  const cu = { width: 480, height: 540, fov: 26 };
  const CU1 = [
    ['EPAULE 3/4', { yaw: 40, target: [0.2, 1.37, 0], distance: 0.9 }], ['EPAULE PROFIL', { yaw: 90, target: [0.2, 1.37, 0], distance: 0.9 }],
    ['AVANT-BRAS 3/4', { yaw: 60, target: [0.25, 1.03, 0], distance: 0.9 }], ['AVANT-BRAS PROFIL', { yaw: 90, target: [0.25, 1.03, 0], distance: 0.9 }],
  ];
  const CU2 = [
    ['ABDOMEN', { yaw: 0, target: [0, 1.17, 0.05], distance: 1.2 }], ['ABDOMEN PROFIL', { yaw: 90, target: [0, 1.15, 0.0], distance: 1.2 }],
    ['MOLLET DOS', { yaw: 180, target: [0.1, 0.32, 0], distance: 0.9 }], ['MOLLET 3/4', { yaw: 220, target: [0.1, 0.32, 0], distance: 0.9 }],
  ];
  const CU3 = [
    ['DOS', { yaw: 180, target: [0, 1.2, 0], distance: 1.4 }], ['FESSIERS 3/4', { yaw: 140, target: [0.05, 0.9, 0], distance: 1.0 }],
    ['HANCHE PROFIL', { yaw: 90, target: [0, 0.9, 0], distance: 1.0 }], ['CUISSE FACE', { yaw: 10, target: [0.1, 0.66, 0.02], distance: 1.1 }],
  ];
  savePng(sheet([...CU1, ...CU2].map(([, o]) => render(mesh, { ...cu, ...o })), [...CU1, ...CU2].map((v) => v[0])), path.join(OUT, 'ctrl-muscles.png'));
  savePng(sheet(CU3.map(([, o]) => render(mesh, { ...cu, ...o })), CU3.map((v) => v[0])), path.join(OUT, 'ctrl-muscles-2.png'));
  // extrêmes EN DÉCOUPÉ (les 14 cibles s'appliquent vraiment)
  savePng(sheet([
    render(morphedSplit({}), { ...small, yaw: 0 }), render(morphedSplit(all1), { ...small, yaw: 0 }), render(morphedSplit(all1), { ...small, yaw: 180 }), render(morphedSplit(all1), { ...small, yaw: 40 }), render(morphedSplit(all1), { ...small, yaw: 90 }),
    render(morphedSplit(propsNegOnly), { ...small, yaw: 0 }), render(morphedSplit(propsNeg), { ...small, yaw: 0 }), render(morphedSplit(propsNeg), { ...small, yaw: 180 }),
    render(morphedSplit(propsPosOnly), { ...small, yaw: 0 }), render(v4goalsMesh, { ...small, yaw: 0 }), render(v4goalsMesh, { ...small, yaw: 90 }), render(morphedSplit(all1, false), { ...small, yaw: 0 }),
  ], ['REPOS SPLIT', 'TOUT +1 FACE', 'TOUT +1 DOS', 'TOUT +1 3/4', 'TOUT +1 PROFIL', 'PROPS -1', 'PROPS -1 GOALS +1', 'MIXTE DOS', 'PROPS +1', 'GOALS +1', 'GOALS +1 PROFIL', 'TOUT +1 NORM. BASE']), path.join(OUT, 'ctrl-extremes.png'));
  // raccords aux coutures, aux extrêmes
  const seamViews = [
    ['HANCHES TOUT +1', { yaw: 20, target: [0.1, 0.8, 0], distance: 1.2, fov: 26 }], ['HANCHES DOS TOUT +1', { yaw: 200, target: [0.1, 0.8, 0], distance: 1.2, fov: 26 }],
    ['TAILLE TOUT +1', { yaw: 30, target: [0, 1.15, 0], distance: 1.3, fov: 26 }], ['TAILLE DOS TOUT +1', { yaw: 200, target: [0, 1.15, 0], distance: 1.3, fov: 26 }],
    ['HANCHES PROPS -1', { yaw: 20, target: [0.1, 0.8, 0], distance: 1.2, fov: 26 }], ['TAILLE PROPS -1', { yaw: 30, target: [0, 1.15, 0], distance: 1.3, fov: 26 }],
  ];
  savePng(sheet(seamViews.map(([l, o]) => render(morphedSplit(l.includes('-1') ? propsNegOnly : all1), { width: 380, height: 420, ...o })), seamViews.map((v) => v[0])), path.join(OUT, 'ctrl-raccords.png'));
  // proportions −1 | +1 et intentions +1
  const propsA = ['prop_shoulders', 'prop_chest', 'prop_waist', 'prop_hips'], propsB = ['prop_arms', 'prop_thighs', 'prop_calves'];
  for (const [file, list] of [['ctrl-props-1.png', propsA], ['ctrl-props-2.png', propsB]]) {
    const imgs = [], labels = [];
    for (const n of list) for (const w of [-1, 1]) { imgs.push(render(morphed({ [n]: w }), { ...small, yaw: n === 'prop_calves' ? 180 : 0 })); labels.push(`${n.slice(5)} ${w > 0 ? '+1' : '-1'}`); }
    savePng(sheet(imgs, labels), path.join(OUT, file));
  }
  const goals = [['goal_shoulders', 0], ['goal_chest', 0], ['goal_back', 180], ['goal_arms', 0], ['goal_glutes', 180], ['goal_thighs', 0], ['goal_calves', 180]];
  savePng(sheet([render(mesh, { ...small, yaw: 0 }), ...goals.map(([n, yaw]) => render(morphed({ [n]: 1 }), { ...small, yaw }))], ['REPOS', ...goals.map(([n]) => n.slice(5) + ' +1')]), path.join(OUT, 'ctrl-goals.png'));
  // comparaison v3 / v4 au repos : face et dos (+ 3/4)
  savePng(sheet([render(v3, { ...big, yaw: 0 }), render(mesh, { ...big, yaw: 0 }), render(v3, { ...big, yaw: 180 }), render(mesh, { ...big, yaw: 180 }), render(v3, { ...big, yaw: 40 }), render(mesh, { ...big, yaw: 40 })],
    ['V3 FACE', 'V4 FACE', 'V3 DOS', 'V4 DOS', 'V3 3/4', 'V4 3/4']), path.join(OUT, 'ctrl-comparaison.png'));
  savePng(sheet([render(mesh, { ...big, yaw: 20, wire: true }), render(mesh, { yaw: 20, width: 380, height: 780, target: [0, 1.3, 0], distance: 1.9, wire: true })], ['FIL DE FER', 'FIL DE FER TORSE']), path.join(OUT, 'ctrl-filaire.png'));
  console.log(`\nPlanches PNG rendues en ${Date.now() - t0} ms dans ${OUT}`);
}
console.log(anyBad ? '\n⚠ Des faces retournées/dégénérées existent aux extrêmes (voir tableau).' : '\n✔ Aucune face retournée ni dégénérée aux extrêmes ni aux combinaisons testés.');
