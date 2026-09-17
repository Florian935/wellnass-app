// verify-v4.mjs (repris de verify-v3, plafond de poids = poids v3) — recharge les .glb produits avec le VRAI GLTFLoader de three r128 (node_modules du dépôt) et
// contrôle le contrat : triangles, 14 noms exacts (single) / découpe 7-3-4 (split), encodage sparse,
// morphTargetsRelative, normales présentes, poids des fichiers < 1,5 Mo, jonctions du split (coordonnées ET
// normales identiques, deltas cohérents), maillage fermé (single : 0 arête ouverte, 1 composante), et
// 0 face retournée / dégénérée à tous les extrêmes ET aux combinaisons — calculé sur les données RECHARGÉES.
// Usage : node verify-v4.mjs out/body-v4-single.glb out/body-v4-split.glb
import fs from 'node:fs';
import path from 'node:path';
import { loadThree, THREE_ROOT, THREE_VERSION } from 'file:///C:/wellness-app/scripts/spike3d/three-env.mjs';

const { THREE, GLTFLoader } = await loadThree();
const kb = (n) => (n / 1024).toFixed(1) + ' Ko';
const files = process.argv.slice(2);
if (!files.length) { console.error('donner des fichiers .glb'); process.exit(2); }
const EXPECTED = ['prop_shoulders', 'prop_chest', 'prop_waist', 'prop_hips', 'prop_arms', 'prop_thighs', 'prop_calves', 'goal_shoulders', 'goal_chest', 'goal_back', 'goal_arms', 'goal_glutes', 'goal_thighs', 'goal_calves'];
const EXPECTED_SPLIT = {
  body_upper: ['prop_shoulders', 'prop_chest', 'prop_arms', 'goal_shoulders', 'goal_chest', 'goal_back', 'goal_arms'],
  body_trunk: ['prop_waist', 'prop_hips', 'goal_glutes'],
  body_legs: ['prop_thighs', 'prop_calves', 'goal_thighs', 'goal_calves'],
};
// v4 : le plafond est le POIDS DE LA V3 (mesuré : 1 398 840 o single, 1 406 548 o split) — ne pas dépasser, essayer de descendre
const V3_BYTES = { single: 1398840, split: 1406548 };
const maxBytesFor = (file) => (/split/.test(file) ? V3_BYTES.split : V3_BYTES.single);
let failures = 0;
const fail = (msg) => { failures++; console.log('   ✖ ' + msg); };

async function loadGlb(file) {
  const buf = fs.readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
}
/** JSON brut du GLB (pour vérifier l'encodage sparse, que le loader masque une fois décodé). */
function glbJson(file) {
  const buf = fs.readFileSync(file);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('pas un GLB');
  const jsonLen = dv.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(buf.subarray(20, 20 + jsonLen)));
}
/** Faces retournées / dégénérées d'un maillage déplacé par un delta cumulé. */
function integrity(pos, idx, delta) {
  const p = new Float32Array(pos.length); for (let i = 0; i < p.length; i++) p[i] = pos[i] + delta[i];
  let flipped = 0, degenerate = 0;
  const cr = (ax, ay, az, bx, by, bz) => [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
  for (let t = 0; t < idx.length; t += 3) {
    const i = idx[t], j = idx[t + 1], k = idx[t + 2];
    const n = cr(p[3 * j] - p[3 * i], p[3 * j + 1] - p[3 * i + 1], p[3 * j + 2] - p[3 * i + 2], p[3 * k] - p[3 * i], p[3 * k + 1] - p[3 * i + 1], p[3 * k + 2] - p[3 * i + 2]);
    if (n[0] * n[0] + n[1] * n[1] + n[2] * n[2] < 1e-16) { degenerate++; continue; }
    const n0 = cr(pos[3 * j] - pos[3 * i], pos[3 * j + 1] - pos[3 * i + 1], pos[3 * j + 2] - pos[3 * i + 2], pos[3 * k] - pos[3 * i], pos[3 * k + 1] - pos[3 * i + 1], pos[3 * k + 2] - pos[3 * i + 2]);
    if (n[0] * n0[0] + n[1] * n0[1] + n[2] * n0[2] < 0) flipped++;
  }
  return { flipped, degenerate };
}
const COMBOS = [
  ['tout +1', () => 1], ['props −1, goals +1', (n) => (n.startsWith('prop_') ? -1 : 1)],
  ['props −1', (n) => (n.startsWith('prop_') ? -1 : 0)], ['props +1', (n) => (n.startsWith('prop_') ? 1 : 0)], ['goals +1', (n) => (n.startsWith('goal_') ? 1 : 0)],
];

console.log(`GLTFLoader de three ${THREE_VERSION} (REVISION ${THREE.REVISION}) — ${THREE_ROOT}\n`);
const loaded = {};
for (const file of files) {
  const size = fs.statSync(file).size;
  const MAX_BYTES = maxBytesFor(file);
  console.log(`■ ${path.basename(file)}  (${kb(size)}, ${size} octets) ${size <= MAX_BYTES ? '✔' : '✖'} vs v3 ${kb(MAX_BYTES)} : ${((size / MAX_BYTES - 1) * 100).toFixed(1)} %`);
  if (size > MAX_BYTES) failures++;
  // encodage sparse dans le JSON brut
  const json = glbJson(file);
  const targetAccessors = json.meshes.flatMap((m) => m.primitives.flatMap((p) => (p.targets ?? []).map((t) => json.accessors[t.POSITION])));
  const sparse = targetAccessors.filter((a) => a.sparse).length;
  console.log(`   cibles de morph dans le fichier : ${targetAccessors.length}, encodées sparse : ${sparse} ${sparse === targetAccessors.length ? '✔' : '✖'}`);
  if (sparse !== targetAccessors.length) failures++;
  const sparseBytes = targetAccessors.reduce((s, a) => s + (a.sparse ? json.bufferViews[a.sparse.indices.bufferView].byteLength + json.bufferViews[a.sparse.values.bufferView].byteLength : 0), 0);
  console.log(`   octets de morph (sparse) : ${kb(sparseBytes)} ; générateur : ${json.asset.generator}`);
  try {
    const gltf = await loadGlb(file);
    const meshes = [];
    gltf.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
    loaded[path.basename(file)] = meshes;
    let totalTris = 0;
    const isSplit = meshes.length > 1;
    for (const m of meshes) {
      const g = m.geometry;
      const tris = g.index ? g.index.count / 3 : g.getAttribute('position').count / 3;
      totalTris += tris;
      const mp = g.morphAttributes.position;
      const names = m.morphTargetDictionary ? Object.keys(m.morphTargetDictionary) : [];
      console.log(`   maillage « ${m.name} » : ${tris} triangles, ${g.getAttribute('position').count} sommets, index ${g.index ? g.index.array.constructor.name : 'aucun'}`);
      console.log(`     morph targets : ${mp ? mp.length : 0} | morphTargetsRelative : ${g.morphTargetsRelative} | normal attr : ${g.getAttribute('normal') ? 'oui' : 'non'}`);
      console.log(`     noms : ${names.join(', ')}`);
      if (!g.morphTargetsRelative) fail('morphTargetsRelative attendu');
      if (!g.getAttribute('normal')) fail('attribut NORMAL absent');
      if ((mp ? mp.length : 0) !== names.length) fail('nombre de morphs ≠ nombre de noms');
      const expected = isSplit ? EXPECTED_SPLIT[m.name] : EXPECTED;
      if (!expected) fail(`nom de maillage inattendu : ${m.name}`);
      else if (JSON.stringify(names) !== JSON.stringify(expected)) fail(`noms attendus : ${expected.join(', ')}`);
      if (mp) for (let i = 0; i < mp.length; i++) { let nz = 0; const a = mp[i].array; for (let q = 0; q < a.length; q++) if (a[q] !== 0) nz++; if (!nz) fail(`${names[i]} : delta entièrement nul`); }
      // intégrité aux extrêmes et combinaisons, sur les données rechargées
      const pos = g.getAttribute('position').array, idx = g.index.array;
      const delta = (wOf) => { const d = new Float32Array(pos.length); names.forEach((n, i) => { const w = wOf(n); if (!w) return; const a = mp[i].array; for (let q = 0; q < d.length; q++) d[q] += w * a[q]; }); return d; };
      const tests = [];
      for (const n of names) for (const w of n.startsWith('prop_') ? [1, -1] : [1]) tests.push([`${n} ${w > 0 ? '+1' : '−1'}`, (x) => (x === n ? w : 0)]);
      for (const c of COMBOS) tests.push(c);
      let bad = 0;
      const detail = [];
      for (const [label, wOf] of tests) { const r = integrity(pos, idx, delta(wOf)); if (r.flipped || r.degenerate) { bad++; detail.push(`${label} : ${r.flipped} retournées / ${r.degenerate} dégénérées`); } }
      console.log(`     intégrité (${tests.length} cas : chaque cible à ses extrêmes + ${COMBOS.length} combinaisons) : ${bad ? '✖ ' + detail.join(' ; ') : '✔ 0 face retournée, 0 dégénérée'}`);
      if (bad) failures++;
      // fermeture : arêtes ouvertes / non-manifold / composantes (un maillage de split a des bords ouverts aux coutures : attendu)
      const edges = new Map();
      for (let t = 0; t < idx.length; t += 3) for (let q = 0; q < 3; q++) { const a = idx[t + q], b = idx[t + (q + 1) % 3]; const k = a < b ? a * 1e6 + b : b * 1e6 + a; edges.set(k, (edges.get(k) ?? 0) + 1); }
      let open = 0, nonManifold = 0; for (const c of edges.values()) { if (c === 1) open++; else if (c > 2) nonManifold++; }
      const V = pos.length / 3; const parent = new Int32Array(V); for (let i = 0; i < V; i++) parent[i] = i;
      const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
      for (let t = 0; t < idx.length; t += 3) { const a = find(idx[t]), b = find(idx[t + 1]); parent[a] = b; parent[find(b)] = find(idx[t + 2]); }
      const roots = new Set(); for (let i = 0; i < V; i++) roots.add(find(i));
      console.log(`     topologie : ${edges.size} arêtes, ${open} ouvertes, ${nonManifold} non-manifold, ${roots.size} composante(s)${isSplit ? ' (bords ouverts = coutures, attendu)' : ''}`);
      if (!isSplit && (open || roots.size !== 1)) fail('le maillage unique doit être fermé et d\'une seule pièce');
    }
    console.log(`   total : ${totalTris} triangles\n`);
  } catch (e) { failures++; console.log(`   ✖ ÉCHEC DE CHARGEMENT : ${e?.message ?? e}\n`); }
}
// jonctions du split
for (const [fname, meshes] of Object.entries(loaded)) {
  if (meshes.length < 2) continue;
  console.log(`── Jonctions de ${fname}`);
  const byName = Object.fromEntries(meshes.map((m) => [m.name, m]));
  const key = (a, i) => `${a[3 * i]},${a[3 * i + 1]},${a[3 * i + 2]}`;
  for (const [an, bn] of [['body_upper', 'body_trunk'], ['body_trunk', 'body_legs'], ['body_upper', 'body_legs']]) {
    const A = byName[an], B = byName[bn];
    if (!A || !B) { fail(`${an}/${bn} : maillage manquant`); continue; }
    const pa = A.geometry.getAttribute('position').array, pb = B.geometry.getAttribute('position').array;
    const na = A.geometry.getAttribute('normal').array, nb = B.geometry.getAttribute('normal').array;
    const idxA = new Map(); for (let i = 0; i < pa.length / 3; i++) idxA.set(key(pa, i), i);
    let shared = 0, normalMismatch = 0, deltaMismatch = 0, checks = 0;
    const names = new Set([...Object.keys(A.morphTargetDictionary ?? {}), ...Object.keys(B.morphTargetDictionary ?? {})]);
    for (let j = 0; j < pb.length / 3; j++) {
      const i = idxA.get(key(pb, j));
      if (i === undefined) continue;
      shared++;
      if (Math.hypot(na[3 * i] - nb[3 * j], na[3 * i + 1] - nb[3 * j + 1], na[3 * i + 2] - nb[3 * j + 2]) > 1e-6) normalMismatch++;
      for (const n of names) {
        const da = A.morphTargetDictionary?.[n] !== undefined ? A.geometry.morphAttributes.position[A.morphTargetDictionary[n]].array : null;
        const db = B.morphTargetDictionary?.[n] !== undefined ? B.geometry.morphAttributes.position[B.morphTargetDictionary[n]].array : null;
        const va = da ? [da[3 * i], da[3 * i + 1], da[3 * i + 2]] : [0, 0, 0];
        const vb = db ? [db[3 * j], db[3 * j + 1], db[3 * j + 2]] : [0, 0, 0];
        checks++;
        if (Math.hypot(va[0] - vb[0], va[1] - vb[1], va[2] - vb[2]) > 1e-7) deltaMismatch++;
      }
    }
    console.log(`   ${an} ∩ ${bn} : ${shared} sommets partagés ; normales différentes : ${normalMismatch} ; deltas incohérents : ${deltaMismatch} / ${checks}`);
    if (normalMismatch || deltaMismatch) failures++;
    if (an === 'body_upper' && bn === 'body_legs' && shared) fail('upper et legs ne doivent pas se toucher');
  }
  console.log();
}
console.log(failures ? `✖ ${failures} problème(s).` : `✔ ${files.length} fichier(s) chargés par GLTFLoader r128 sans erreur : contrat respecté (noms, sparse, relatif, poids, jonctions, intégrité aux extrêmes et combinaisons, fermeture).`);
process.exitCode = failures ? 1 : 0;
