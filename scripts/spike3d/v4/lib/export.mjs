// export.mjs — écriture GLB « sparse » à la main (repris du générateur v1, dont la mécanique est testée),
// découpe en parties, et contrôles d'intégrité des morphs aux extrêmes.
import { MORPH_NAMES } from './morphs.mjs';

/** Extrait un sous-maillage à partir des triangles taggés `split` ; copie normales et deltas. */
export function extractPart(positions, normals, indices, tags, deltas, split, morphNames) {
  const remap = new Map();
  const idx = [];
  for (let t = 0; t < tags.length; t++) {
    if (tags[t] !== split) continue;
    for (let q = 0; q < 3; q++) {
      const old = indices[3 * t + q];
      if (!remap.has(old)) remap.set(old, remap.size);
      idx.push(remap.get(old));
    }
  }
  const V = remap.size;
  const pos = new Float32Array(V * 3), nor = new Float32Array(V * 3);
  const oldOf = new Array(V);
  for (const [old, nu] of remap) {
    oldOf[nu] = old;
    for (let q = 0; q < 3; q++) { pos[3 * nu + q] = positions[3 * old + q]; nor[3 * nu + q] = normals[3 * old + q]; }
  }
  const morphs = morphNames.map((name) => {
    const d = new Float32Array(V * 3);
    for (let nu = 0; nu < V; nu++) for (let q = 0; q < 3; q++) d[3 * nu + q] = deltas[name][3 * oldOf[nu] + q];
    return { name, delta: d };
  });
  const leaks = [];
  for (const name of MORPH_NAMES) {
    if (morphNames.includes(name)) continue;
    let touched = 0;
    for (let nu = 0; nu < V; nu++) { const o = oldOf[nu]; if (deltas[name][3 * o] || deltas[name][3 * o + 1] || deltas[name][3 * o + 2]) touched++; }
    if (touched) leaks.push(`${name} touche ${touched} sommets de ${split} sans y être porté`);
  }
  return { positions: pos, normals: nor, indices: Uint32Array.from(idx), morphs, oldOf, leaks };
}

/** Contrôle : faces dégénérées / retournées après application d'un morph à un poids donné. */
export function checkMorphIntegrity(positions, indices, delta, weight) {
  const p = new Float32Array(positions.length);
  for (let i = 0; i < p.length; i++) p[i] = positions[i] + weight * delta[i];
  let flipped = 0, degenerate = 0, maxDisp = 0;
  const cr = (ax, ay, az, bx, by, bz) => [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
  for (let t = 0; t < indices.length; t += 3) {
    const i = indices[t], j = indices[t + 1], k = indices[t + 2];
    const n = cr(p[3 * j] - p[3 * i], p[3 * j + 1] - p[3 * i + 1], p[3 * j + 2] - p[3 * i + 2], p[3 * k] - p[3 * i], p[3 * k + 1] - p[3 * i + 1], p[3 * k + 2] - p[3 * i + 2]);
    const l2 = n[0] * n[0] + n[1] * n[1] + n[2] * n[2];
    if (l2 < 1e-16) { degenerate++; continue; }
    const n0 = cr(positions[3 * j] - positions[3 * i], positions[3 * j + 1] - positions[3 * i + 1], positions[3 * j + 2] - positions[3 * i + 2], positions[3 * k] - positions[3 * i], positions[3 * k + 1] - positions[3 * i + 1], positions[3 * k + 2] - positions[3 * i + 2]);
    if (n[0] * n0[0] + n[1] * n0[1] + n[2] * n0[2] < 0) flipped++;
  }
  for (let i = 0; i < delta.length; i += 3) maxDisp = Math.max(maxDisp, Math.hypot(delta[i], delta[i + 1], delta[i + 2]) * Math.abs(weight));
  return { flipped, degenerate, maxDisp };
}

/** GLB binaire : accesseurs sparse pour les morphs (lus par GLTFLoader r128, non écrits par l'exporteur r128). */
export function writeSparseGlb(meshes /* [{name, positions, normals, indices, morphs:[{name,delta}]}] */, generator = 'mesh-v2 (sparse)') {
  const bufferViews = [], accessors = [], chunks = [];
  let offset = 0;
  const pad4 = (n) => (n + 3) & ~3;
  const pushView = (typedArray, target) => {
    const bytes = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
    const padded = new Uint8Array(pad4(bytes.length)); padded.set(bytes);
    chunks.push(padded);
    const view = { buffer: 0, byteOffset: offset, byteLength: bytes.length };
    if (target) view.target = target;
    offset += padded.length;
    bufferViews.push(view);
    return bufferViews.length - 1;
  };
  const minMax = (arr, n) => {
    const min = new Array(n).fill(Infinity), max = new Array(n).fill(-Infinity);
    for (let i = 0; i < arr.length; i += n) for (let q = 0; q < n; q++) { min[q] = Math.min(min[q], arr[i + q]); max[q] = Math.max(max[q], arr[i + q]); }
    return { min, max };
  };
  const gltfMeshes = [], nodes = [];
  const sparseStats = [];
  for (const m of meshes) {
    const V = m.positions.length / 3;
    const posView = pushView(m.positions, 34962), norView = pushView(m.normals, 34962);
    const idxArr = V > 65535 ? new Uint32Array(m.indices) : new Uint16Array(m.indices);
    const idxView = pushView(idxArr, 34963);
    const { min, max } = minMax(m.positions, 3);
    accessors.push({ bufferView: posView, componentType: 5126, count: V, type: 'VEC3', min, max }); const posAcc = accessors.length - 1;
    accessors.push({ bufferView: norView, componentType: 5126, count: V, type: 'VEC3' }); const norAcc = accessors.length - 1;
    accessors.push({ bufferView: idxView, componentType: V > 65535 ? 5125 : 5123, count: idxArr.length, type: 'SCALAR' }); const idxAcc = accessors.length - 1;
    const targets = [], names = [];
    for (const { name, delta } of m.morphs) {
      const nz = [];
      for (let i = 0; i < V; i++) if (delta[3 * i] || delta[3 * i + 1] || delta[3 * i + 2]) nz.push(i);
      const sIdx = V > 65535 ? new Uint32Array(nz) : new Uint16Array(nz);
      const sVal = new Float32Array(nz.length * 3);
      nz.forEach((i, k) => { sVal[3 * k] = delta[3 * i]; sVal[3 * k + 1] = delta[3 * i + 1]; sVal[3 * k + 2] = delta[3 * i + 2]; });
      const mm = minMax(sVal.length ? sVal : new Float32Array([0, 0, 0]), 3);
      const acc = { componentType: 5126, count: V, type: 'VEC3', min: mm.min.map((v) => Math.min(v, 0)), max: mm.max.map((v) => Math.max(v, 0)) };
      if (nz.length) {
        acc.sparse = { count: nz.length, indices: { bufferView: pushView(sIdx), componentType: V > 65535 ? 5125 : 5123 }, values: { bufferView: pushView(sVal) } };
      }
      accessors.push(acc);
      targets.push({ POSITION: accessors.length - 1 });
      names.push(name);
      sparseStats.push({ mesh: m.name, morph: name, touched: nz.length, of: V, bytes: sIdx.byteLength + sVal.byteLength });
    }
    const prim = { attributes: { POSITION: posAcc, NORMAL: norAcc }, indices: idxAcc, mode: 4 };
    if (targets.length) prim.targets = targets;
    const meshDef = { name: m.name, primitives: [prim] };
    if (targets.length) { meshDef.weights = new Array(targets.length).fill(0); meshDef.extras = { targetNames: names }; }
    gltfMeshes.push(meshDef);
    nodes.push({ name: m.name, mesh: gltfMeshes.length - 1 });
  }
  const json = {
    asset: { version: '2.0', generator },
    scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes: gltfMeshes,
    accessors, bufferViews, buffers: [{ byteLength: offset }],
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPadded = new Uint8Array(pad4(jsonBytes.length)).fill(0x20); jsonPadded.set(jsonBytes);
  const total = 12 + 8 + jsonPadded.length + 8 + offset;
  const out = new Uint8Array(total); const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jsonPadded.length, true); dv.setUint32(16, 0x4e4f534a, true); out.set(jsonPadded, 20);
  let p = 20 + jsonPadded.length;
  dv.setUint32(p, offset, true); dv.setUint32(p + 4, 0x004e4942, true); p += 8;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return { glb: out, sparseStats };
}
