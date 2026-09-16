// verify.mjs — recharge les .glb produits avec le GLTFLoader de three r128 et imprime, par maillage :
// triangles, morph targets (nombre, noms), présence de morphAttributes.position, poids du fichier.
// Puis : cohérence des jonctions du split, déformation mesurée (CPU) de chaque morph, et exécution
// du VRAI code WebGLMorphtargets.update de r128 (extrait du build) pour montrer le plafond de 8.
//
// Usage : node verify.mjs [fichiers.glb…]   (par défaut : tous les .glb du dossier + series/)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadThree, THREE_ROOT, THREE_VERSION } from './three-env.mjs';

const { THREE, GLTFLoader } = await loadThree();
const DIR = path.dirname(fileURLToPath(import.meta.url));
const kb = (n) => (n / 1024).toFixed(1) + ' Ko';

let files = process.argv.slice(2);
if (files.length === 0) {
  files = fs.readdirSync(DIR).filter((f) => f.endsWith('.glb')).map((f) => path.join(DIR, f));
  const series = path.join(DIR, 'series');
  if (fs.existsSync(series)) files.push(...fs.readdirSync(series).filter((f) => f.endsWith('.glb')).map((f) => path.join(series, f)));
}

async function loadGlb(file) {
  const buf = fs.readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
}
function meshesOf(gltf) {
  const out = [];
  gltf.scene.traverse((o) => { if (o.isMesh) out.push(o); });
  return out;
}
function describeMesh(m) {
  const g = m.geometry;
  const tris = g.index ? g.index.count / 3 : g.getAttribute('position').count / 3;
  const morphPos = g.morphAttributes.position;
  const morphNor = g.morphAttributes.normal;
  const names = m.morphTargetDictionary ? Object.keys(m.morphTargetDictionary) : [];
  return { name: m.name, vertices: g.getAttribute('position').count, tris, morphCount: morphPos ? morphPos.length : 0, names, hasMorphPosition: !!morphPos, hasMorphNormal: !!morphNor, relative: g.morphTargetsRelative, indexType: g.index ? g.index.array.constructor.name : 'aucun' };
}

// Position CPU d'un sommet après application de poids nommés (base + Σ w·delta, deltas relatifs).
function morphedPositions(mesh, weightsByName) {
  const g = mesh.geometry;
  const base = g.getAttribute('position').array;
  const out = Float32Array.from(base);
  for (const [name, w] of Object.entries(weightsByName)) {
    const i = mesh.morphTargetDictionary?.[name];
    if (i === undefined || !w) continue;
    const d = g.morphAttributes.position[i].array;
    for (let k = 0; k < out.length; k++) out[k] += w * d[k];
  }
  return out;
}
// Largeur max (2·max|x|) et profondeur max (2·max|z| ou étendue) dans une tranche de hauteur.
function extent(pos, y0, y1, axis) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    const y = pos[i + 1];
    if (y < y0 || y > y1) continue;
    const v = pos[i + axis];
    lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  return hi - lo;
}

console.log(`GLTFLoader de three ${THREE_VERSION} (REVISION ${THREE.REVISION}) — ${THREE_ROOT}\n`);

const loaded = {};
let failures = 0;
for (const file of files) {
  const size = fs.statSync(file).size;
  process.stdout.write(`■ ${path.relative(DIR, file)}  (${kb(size)}, ${size} octets)\n`);
  try {
    const gltf = await loadGlb(file);
    const meshes = meshesOf(gltf);
    loaded[path.basename(file)] = { gltf, meshes, file, size };
    for (const m of meshes) {
      const d = describeMesh(m);
      console.log(`   maillage « ${d.name} » : ${d.tris} triangles, ${d.vertices} sommets, index ${d.indexType}`);
      console.log(`     morph targets : ${d.morphCount}  | morphAttributes.position : ${d.hasMorphPosition ? 'présent' : 'ABSENT'}  | morphAttributes.normal : ${d.hasMorphNormal ? 'présent' : 'absent'}  | morphTargetsRelative : ${d.relative}`);
      if (d.names.length) console.log(`     noms : ${d.names.join(', ')}`);
      if (d.morphCount !== d.names.length) console.log(`     ⚠ ${d.morphCount} morphs mais ${d.names.length} noms (extras.targetNames)`);
    }
  } catch (e) {
    failures++;
    console.log(`   ✖ ÉCHEC DE CHARGEMENT : ${e?.message ?? e}`);
  }
  console.log();
}

// ---------------------------------------------------------------------------------------------
// Jonctions du split : mêmes coordonnées, mêmes normales, deltas cohérents sur les sommets partagés
// ---------------------------------------------------------------------------------------------
for (const splitName of ['body-spike-split.glb', 'body-spike-split-sparse.glb']) {
  const split = loaded[splitName];
  if (!split) continue;
  console.log(`── Jonctions de ${splitName}`);
  const byName = Object.fromEntries(split.meshes.map((m) => [m.name, m]));
  const key = (a, i) => `${a[3 * i]},${a[3 * i + 1]},${a[3 * i + 2]}`;
  const pairs = [['body_upper', 'body_trunk'], ['body_trunk', 'body_legs'], ['body_upper', 'body_legs']];
  for (const [an, bn] of pairs) {
    const A = byName[an], B = byName[bn];
    if (!A || !B) { console.log(`   ${an}/${bn} : maillage manquant`); continue; }
    const pa = A.geometry.getAttribute('position').array, pb = B.geometry.getAttribute('position').array;
    const na = A.geometry.getAttribute('normal').array, nb = B.geometry.getAttribute('normal').array;
    const idxA = new Map(); for (let i = 0; i < pa.length / 3; i++) idxA.set(key(pa, i), i);
    let shared = 0, normalMismatch = 0, deltaMismatch = 0, deltaChecks = 0;
    for (let j = 0; j < pb.length / 3; j++) {
      const i = idxA.get(key(pb, j));
      if (i === undefined) continue;
      shared++;
      if (Math.hypot(na[3 * i] - nb[3 * j], na[3 * i + 1] - nb[3 * j + 1], na[3 * i + 2] - nb[3 * j + 2]) > 1e-6) normalMismatch++;
      // pour chaque morph de A ou B : delta identique des deux côtés (0 si absent d'un côté)
      const names = new Set([...Object.keys(A.morphTargetDictionary ?? {}), ...Object.keys(B.morphTargetDictionary ?? {})]);
      for (const n of names) {
        const da = A.morphTargetDictionary?.[n] !== undefined ? A.geometry.morphAttributes.position[A.morphTargetDictionary[n]].array : null;
        const db = B.morphTargetDictionary?.[n] !== undefined ? B.geometry.morphAttributes.position[B.morphTargetDictionary[n]].array : null;
        const va = da ? [da[3 * i], da[3 * i + 1], da[3 * i + 2]] : [0, 0, 0];
        const vb = db ? [db[3 * j], db[3 * j + 1], db[3 * j + 2]] : [0, 0, 0];
        deltaChecks++;
        if (Math.hypot(va[0] - vb[0], va[1] - vb[1], va[2] - vb[2]) > 1e-7) deltaMismatch++;
      }
    }
    console.log(`   ${an} ∩ ${bn} : ${shared} sommets aux mêmes coordonnées ; normales différentes : ${normalMismatch} ; deltas de morph incohérents : ${deltaMismatch} / ${deltaChecks} contrôles`);
  }
  console.log();
}

// ---------------------------------------------------------------------------------------------
// Déformation mesurée sur CPU (single) : la zone visée bouge-t-elle, et de combien ?
// ---------------------------------------------------------------------------------------------
const single = loaded['body-spike-single.glb'];
if (single) {
  const mesh = single.meshes[0];
  console.log('── Déformation mesurée (CPU, base + poids × delta) sur body-spike-single.glb — en cm');
  const base = morphedPositions(mesh, {});
  // [morph, tranche y0..y1, axe (0=x largeur, 2=z profondeur), poids testés]
  const probes = [
    ['prop_shoulders', 1.40, 1.48, 0, [-1, 1]], ['prop_chest', 1.24, 1.32, 0, [-1, 1]], ['prop_waist', 0.99, 1.05, 0, [-1, 1]],
    ['prop_hips', 0.84, 0.90, 0, [-1, 1]], ['prop_arms', 1.20, 1.30, 0, [-1, 1]], ['prop_thighs', 0.58, 0.66, 0, [-1, 1]], ['prop_calves', 0.30, 0.40, 0, [-1, 1]],
    ['goal_shoulders', 1.40, 1.48, 0, [1]], ['goal_chest', 1.24, 1.32, 2, [1]], ['goal_back', 1.26, 1.34, 2, [1]], ['goal_arms', 1.30, 1.36, 0, [1]],
    ['goal_glutes', 0.84, 0.92, 2, [1]], ['goal_thighs', 0.58, 0.66, 0, [1]], ['goal_calves', 0.34, 0.42, 2, [1]],
  ];
  console.log('   morph               tranche (m)   axe   au repos   ' + 'poids → étendue (Δ)');
  for (const [name, y0, y1, axis, weights] of probes) {
    const e0 = extent(base, y0, y1, axis);
    const cells = weights.map((w) => { const e = extent(morphedPositions(mesh, { [name]: w }), y0, y1, axis); return `${w > 0 ? '+' : ''}${w} → ${(e * 100).toFixed(1)} (${e - e0 >= 0 ? '+' : ''}${((e - e0) * 100).toFixed(1)})`; });
    console.log(`   ${name.padEnd(18)} ${y0.toFixed(2)}–${y1.toFixed(2)}     ${axis === 0 ? 'x' : 'z'}    ${(e0 * 100).toFixed(1).padStart(6)}     ${cells.join('   ')}`);
  }
  console.log();
}

// ---------------------------------------------------------------------------------------------
// Le plafond de 8 : exécuter le VRAI code r128 (WebGLMorphtargets, extrait de build/three.js)
// ---------------------------------------------------------------------------------------------
if (single) {
  console.log('── Plafond r128 : exécution du code réel WebGLMorphtargets.update extrait de build/three.js');
  const src = fs.readFileSync(path.join(THREE_ROOT, 'build/three.js'), 'utf8');
  const start = src.indexOf('function numericalSort(a, b)');
  const end = src.indexOf('function WebGLObjects(');
  if (start < 0 || end < 0) {
    console.log('   ✖ impossible de localiser WebGLMorphtargets dans le build — étape sautée');
  } else {
    const chunk = src.slice(start, end);
    const lineNo = src.slice(0, src.indexOf('new Float32Array(8)')).split('\n').length;
    console.log(`   (source : ${THREE_ROOT}/build/three.js, « new Float32Array(8) » ligne ${lineNo}, ${chunk.split('\n').length} lignes extraites)`);
    const factory = new Function(chunk + '\nreturn WebGLMorphtargets;');
    const WebGLMorphtargets = factory();
    const uniforms = {};
    const fakeProgram = { getUniforms: () => ({ setValue: (_gl, name, value) => { uniforms[name] = Array.isArray(value) || ArrayBuffer.isView(value) ? Array.from(value) : value; } }) };
    const morphtargets = WebGLMorphtargets({});
    const mesh = single.meshes[0];
    const names = Object.keys(mesh.morphTargetDictionary);
    // scénario : les 14 paramètres non nuls, valeurs applicatives plausibles
    const appValues = { prop_shoulders: 1.5, prop_chest: -0.5, prop_waist: -1.0, prop_hips: 0.25, prop_arms: 0.75, prop_thighs: 1.0, prop_calves: -0.25,
      goal_shoulders: 3, goal_chest: 2, goal_back: 1, goal_arms: 4, goal_glutes: 2, goal_thighs: 1, goal_calves: 3 };
    for (const n of names) {
      const v = appValues[n];
      mesh.morphTargetInfluences[mesh.morphTargetDictionary[n]] = n.startsWith('prop_') ? v / 2 : v / 4;
    }
    mesh.material.morphTargets = true;
    morphtargets.update(mesh, mesh.geometry, mesh.material, fakeProgram);
    const kept = [];
    for (let i = 0; i < 8; i++) {
      const attr = mesh.geometry.getAttribute('morphTarget' + i);
      if (!attr) continue;
      const idx = mesh.geometry.morphAttributes.position.indexOf(attr);
      kept.push({ slot: i, name: names[idx], influence: uniforms.morphTargetInfluences[i] });
    }
    const keptNames = new Set(kept.map((k) => k.name));
    console.log(`   14 poids non nuls envoyés (valeurs applicatives : ${names.map((n) => `${n}=${appValues[n]}`).join(', ')})`);
    console.log(`   emplacements GPU remplis : ${kept.length} / 8  → ${kept.map((k) => `${k.name} (${k.influence.toFixed(3)})`).join(', ')}`);
    const dropped = names.filter((n) => !keptNames.has(n)).map((n) => `${n} (${mesh.morphTargetInfluences[mesh.morphTargetDictionary[n]].toFixed(3)})`);
    console.log(`   IGNORÉS SANS ERREUR (${dropped.length}) : ${dropped.join(', ')}`);
    console.log(`   morphTargetBaseInfluence = ${uniforms.morphTargetBaseInfluence} (mode relatif) ; règle : tri par |influence| décroissante, les 8 premiers gagnent`);
    // et sur la version découpée : chaque maillage passe-t-il entier ?
    const split = loaded['body-spike-split.glb'];
    if (split) {
      const mt2 = WebGLMorphtargets({});
      for (const m of split.meshes) {
        const ns = Object.keys(m.morphTargetDictionary);
        for (const n of ns) { const v = appValues[n]; m.morphTargetInfluences[m.morphTargetDictionary[n]] = n.startsWith('prop_') ? v / 2 : v / 4; }
        m.material.morphTargets = true;
        const u = {}; mt2.update(m, m.geometry, m.material, { getUniforms: () => ({ setValue: (_g, k, v) => { u[k] = Array.from(v ?? []); } }) });
        let filled = 0; for (let i = 0; i < 8; i++) if (m.geometry.getAttribute('morphTarget' + i)) filled++;
        console.log(`   split « ${m.name} » : ${ns.length} morphs actifs → ${filled} emplacements remplis, ${ns.length - filled} ignoré(s)`);
      }
    }
  }
  console.log();
}

console.log(failures ? `✖ ${failures} fichier(s) n'ont PAS pu être chargés par GLTFLoader r128.` : `✔ ${files.length} fichier(s) chargés par GLTFLoader r128 sans erreur.`);
process.exitCode = failures ? 1 : 0;
