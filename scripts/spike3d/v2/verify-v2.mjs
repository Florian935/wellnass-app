// verify-v2.mjs — recharge les .glb produits avec le VRAI GLTFLoader de three r128 (node_modules du dépôt)
// et imprime : triangles, sommets, morphs (nombre, noms), morphAttributes.position, relatif, poids fichier.
// Puis contrôle les jonctions du split (mêmes coordonnées / normales / deltas cohérents).
// Usage : node verify-v2.mjs out/body-v2-single.glb out/body-v2-split.glb
import fs from 'node:fs';
import path from 'node:path';
import { loadThree, THREE_ROOT, THREE_VERSION } from 'file:///C:/wellness-app/scripts/spike3d/three-env.mjs';

const { THREE, GLTFLoader } = await loadThree();
const kb = (n) => (n / 1024).toFixed(1) + ' Ko';
const files = process.argv.slice(2);
if (!files.length) { console.error('donner des fichiers .glb'); process.exit(2); }

async function loadGlb(file) {
  const buf = fs.readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
}
console.log(`GLTFLoader de three ${THREE_VERSION} (REVISION ${THREE.REVISION}) — ${THREE_ROOT}\n`);
let failures = 0;
const loaded = {};
for (const file of files) {
  const size = fs.statSync(file).size;
  console.log(`■ ${path.basename(file)}  (${kb(size)}, ${size} octets)`);
  try {
    const gltf = await loadGlb(file);
    const meshes = [];
    gltf.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
    loaded[path.basename(file)] = meshes;
    let totalTris = 0;
    for (const m of meshes) {
      const g = m.geometry;
      const tris = g.index ? g.index.count / 3 : g.getAttribute('position').count / 3;
      totalTris += tris;
      const mp = g.morphAttributes.position;
      const names = m.morphTargetDictionary ? Object.keys(m.morphTargetDictionary) : [];
      console.log(`   maillage « ${m.name} » : ${tris} triangles, ${g.getAttribute('position').count} sommets, index ${g.index ? g.index.array.constructor.name : 'aucun'}`);
      console.log(`     morph targets : ${mp ? mp.length : 0} | morphAttributes.position : ${mp ? 'présent' : 'ABSENT'} | morphTargetsRelative : ${g.morphTargetsRelative} | normal attr : ${g.getAttribute('normal') ? 'oui' : 'non'}`);
      console.log(`     noms : ${names.join(', ')}`);
      if ((mp ? mp.length : 0) !== names.length) { console.log('     ⚠ nombre de morphs ≠ nombre de noms'); failures++; }
      // sanity : chaque morph a au moins un delta non nul
      if (mp) for (let i = 0; i < mp.length; i++) { let nz = 0; const a = mp[i].array; for (let q = 0; q < a.length; q++) if (a[q] !== 0) nz++; if (!nz) console.log(`     ⚠ ${names[i]} : delta entièrement nul`); }
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
    if (!A || !B) { console.log(`   ${an}/${bn} : maillage manquant`); failures++; continue; }
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
  }
  console.log();
}
console.log(failures ? `✖ ${failures} problème(s).` : `✔ ${files.length} fichier(s) chargés par GLTFLoader r128 sans erreur, jonctions cohérentes.`);
process.exitCode = failures ? 1 : 0;
