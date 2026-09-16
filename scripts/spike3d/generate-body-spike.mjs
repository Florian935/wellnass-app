// generate-body-spike.mjs — asset de test pour le spike « éditeur de silhouette 3D » (three r128).
//
// Génère par le calcul (aucun asset externe) un humanoïde low-poly, debout, de face, symétrique,
// et l'exporte en GLB avec le GLTFExporter de three r128 :
//   body-spike-single.glb : 1 maillage, 14 morph targets (déclenche le plafond de 8 de r128)
//   body-spike-split.glb  : 3 maillages (upper / trunk / legs), ≤ 8 morphs chacun, sommets de
//                           jonction partagés aux mêmes coordonnées (et mêmes normales)
// Plus, pour la mesure : series/ (poids selon le nombre de morphs), variantes *-sparse.glb
// (accesseurs sparse écrits à la main, lus par GLTFLoader r128) et *-normals.glb (morphs de
// normales, cas « plafond à 4 »).
//
// Usage : node generate-body-spike.mjs [--no-series] [--no-sparse] [--no-normals]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadThree, THREE_VERSION } from './three-env.mjs';

const { THREE, GLTFExporter } = await loadThree();
const OUT = path.dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));

// ---------------------------------------------------------------------------------------------
// 1. Paramètres produit → morph targets
// ---------------------------------------------------------------------------------------------
// Proportions : valeur applicative [-2,+2] → poids = valeur / 2 ∈ [-1,+1] (UN morph, poids signé)
// Intentions  : valeur applicative [0,4]   → poids = valeur / 4 ∈ [0,1]
export const MORPH_NAMES = [
  'prop_shoulders', 'prop_chest', 'prop_waist', 'prop_hips', 'prop_arms', 'prop_thighs', 'prop_calves',
  'goal_shoulders', 'goal_chest', 'goal_back', 'goal_arms', 'goal_glutes', 'goal_thighs', 'goal_calves',
];
// Répartition pour la version découpée (chaque liste ≤ 8)
export const MORPHS_BY_PART = {
  upper: ['prop_shoulders', 'prop_chest', 'prop_arms', 'goal_shoulders', 'goal_chest', 'goal_back', 'goal_arms'],
  trunk: ['prop_waist', 'prop_hips', 'goal_glutes'],
  legs:  ['prop_thighs', 'prop_calves', 'goal_thighs', 'goal_calves'],
};

// ---------------------------------------------------------------------------------------------
// 2. Constructeur de maillage par anneaux (tubes)
// ---------------------------------------------------------------------------------------------
const S = 32;       // segments par anneau (torse, tête, jambes) — doit être multiple de 4
const S_ARM = 20;   // segments par anneau (bras)

class Builder {
  constructor() {
    this.pos = [];      // xyz à plat
    this.meta = [];     // par sommet : { part, cx, cz, rx, rz, ringId }
    this.tris = [];     // indices à plat
    this.triPart = [];  // par triangle : 'upper' | 'trunk' | 'legs'
    this.ringCounter = 0;
  }
  get vertexCount() { return this.pos.length / 3; }
  addVertex(x, y, z, meta) {
    this.pos.push(x, y, z);
    this.meta.push(meta);
    return this.meta.length - 1;
  }
  /** Anneau elliptique de `segments` sommets, centre (cx,cy,cz), demi-axes rx (x) et rz (z). */
  ring(cx, cy, cz, rx, rz, segments, part) {
    const ringId = this.ringCounter++;
    const idx = [];
    for (let k = 0; k < segments; k++) {
      const t = (2 * Math.PI * k) / segments;
      idx.push(this.addVertex(cx + rx * Math.cos(t), cy, cz + rz * Math.sin(t), { part, cx, cz, rx, rz, ringId }));
    }
    return idx;
  }
  /** Relie deux anneaux de même taille par des quads (normales vers l'extérieur si `upper` est au-dessus de `lower`). */
  connect(lower, upper, split) {
    const n = lower.length;
    if (upper.length !== n) throw new Error('anneaux de tailles différentes');
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n;
      this.tris.push(lower[k], upper[k], upper[k1]); this.triPart.push(split);
      this.tris.push(lower[k], upper[k1], lower[k1]); this.triPart.push(split);
    }
  }
  /** Ferme un anneau par un éventail vers un sommet central. up=true : chapeau au-dessus. */
  cap(ring, cx, cy, cz, part, split, up) {
    const c = this.addVertex(cx, cy, cz, { part, cx, cz, rx: 0, rz: 0, ringId: -1 });
    const n = ring.length;
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n;
      if (up) this.tris.push(ring[k1], ring[k], c); else this.tris.push(ring[k], ring[k1], c);
      this.triPart.push(split);
    }
    return c;
  }
}

/** Interpolation linéaire d'un profil { y: [rx, rz] } trié par y. */
function profileAt(profile, y) {
  const ys = Object.keys(profile).map(Number).sort((a, b) => a - b);
  if (y <= ys[0]) return profile[ys[0]];
  if (y >= ys[ys.length - 1]) return profile[ys[ys.length - 1]];
  for (let i = 0; i < ys.length - 1; i++) {
    if (y >= ys[i] && y <= ys[i + 1]) {
      const t = (y - ys[i]) / (ys[i + 1] - ys[i]);
      const a = profile[ys[i]], b = profile[ys[i + 1]];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
  }
  throw new Error('profil');
}
const r3 = (v) => Math.round(v * 1000) / 1000;

// ---------------------------------------------------------------------------------------------
// 3. L'humanoïde (Y vers le haut, face vers +Z, unités = mètres, taille 1,80 m, pieds à y=0)
// ---------------------------------------------------------------------------------------------
const Y_CROTCH = 0.78;      // anneau bas du torse = jonction tronc/jambes
const Y_SEAM_UPPER = 1.14;  // anneau de jonction haut/tronc
const LEG_CX = 0.093;       // demi-écart des axes de jambes
const ARM_CX = 0.225;       // axe des bras à l'épaule
const ARM_SLOPE = 0.12;     // bras légèrement écartés (m de x par m de descente)
const armCx = (y) => ARM_CX + (1.44 - y) * ARM_SLOPE;

// profil torse + cou + tête : y → [rx, rz]
const CORE_PROFILE = {
  0.78: [0.165, 0.110], 0.86: [0.185, 0.125], 0.94: [0.170, 0.115], 1.02: [0.148, 0.105],
  1.10: [0.158, 0.115], 1.18: [0.172, 0.125], 1.26: [0.185, 0.135], 1.34: [0.190, 0.130],
  1.40: [0.205, 0.120], 1.44: [0.215, 0.105], 1.47: [0.150, 0.085], 1.50: [0.062, 0.062],
  1.57: [0.058, 0.060], 1.60: [0.075, 0.085], 1.64: [0.092, 0.100], 1.69: [0.098, 0.105],
  1.74: [0.090, 0.098], 1.78: [0.060, 0.070],
};
const CORE_RINGS = [];
for (let i = 0; i <= 22; i++) CORE_RINGS.push(r3(Y_CROTCH + i * 0.03)); // 0.78 … 1.44
CORE_RINGS.push(1.47, 1.50, 1.53, 1.57, 1.60, 1.63, 1.66, 1.69, 1.72, 1.75, 1.78);
const Y_HEAD_TOP = 1.805;

// profil jambe (rayons autour de l'axe de la jambe)
const LEG_PROFILE = {
  0.74: [0.092, 0.100], 0.66: [0.088, 0.096], 0.58: [0.078, 0.086], 0.50: [0.064, 0.070],
  0.42: [0.062, 0.072], 0.36: [0.064, 0.076], 0.26: [0.050, 0.060], 0.14: [0.040, 0.046], 0.10: [0.038, 0.044],
};
const LEG_RINGS = [0.74, 0.70, 0.66, 0.62, 0.58, 0.54, 0.50, 0.46, 0.42, 0.38, 0.34, 0.30, 0.26, 0.22, 0.18, 0.14, 0.10];
// pied : [y, cz, rx, rz]
const FOOT_RINGS = [[0.06, 0.025, 0.046, 0.085], [0.025, 0.05, 0.050, 0.115], [0.005, 0.05, 0.045, 0.110]];

// profil bras : [y, rx, rz]
const ARM_RINGS = [
  [1.46, 0.060, 0.060], [1.40, 0.062, 0.062], [1.32, 0.055, 0.055], [1.24, 0.048, 0.050],
  [1.17, 0.044, 0.046], [1.10, 0.046, 0.046], [1.02, 0.040, 0.040], [0.95, 0.032, 0.030],
  // main (palette aplatie)
  [0.92, 0.038, 0.020], [0.86, 0.045, 0.018], [0.80, 0.040, 0.016], [0.76, 0.025, 0.012],
];

function buildBody() {
  const b = new Builder();
  const seams = { upperTrunk: [], trunkLegs: [] };

  // --- tronc + cou + tête : un seul tube, chapeau en haut ---
  let prev = null;
  let bottomRing = null;
  for (let i = 0; i < CORE_RINGS.length; i++) {
    const y = CORE_RINGS[i];
    const [rx, rz] = profileAt(CORE_PROFILE, y);
    const ring = b.ring(0, y, 0, rx, rz, S, 'core');
    if (i === 0) { bottomRing = ring; seams.trunkLegs = ring.slice(); }
    if (Math.abs(y - Y_SEAM_UPPER) < 1e-6) seams.upperTrunk = ring.slice();
    if (prev) b.connect(prev, ring, y <= Y_SEAM_UPPER + 1e-6 ? 'trunk' : 'upper');
    prev = ring;
  }
  b.cap(prev, 0, Y_HEAD_TOP, 0, 'core', 'upper', true);

  // --- jambes : topologie « pantalon », soudées à l'anneau bas du torse ---
  for (const side of [-1, +1]) {
    const part = side < 0 ? 'legL' : 'legR';
    const cx = side * LEG_CX;
    const [rxT, rzT] = profileAt(CORE_PROFILE, Y_CROTCH);
    // anneau de pont : moitié externe = sommets du torse (partagés), moitié interne = ligne x=0
    const top = [];
    for (let k = 0; k < S; k++) {
      const t = (2 * Math.PI * k) / S;
      const outer = side < 0 ? (k >= S / 4 && k <= (3 * S) / 4) : (k <= S / 4 || k >= (3 * S) / 4);
      if (outer) top.push(bottomRing[k]);
      else top.push(b.addVertex(0, Y_CROTCH, rzT * Math.sin(t), { part, cx, cz: 0, rx: 0.001, rz: rzT, ringId: -2 }));
    }
    let prevL = top;
    for (const y of LEG_RINGS) {
      const [rx, rz] = profileAt(LEG_PROFILE, y);
      const ring = b.ring(cx, y, 0, rx, rz, S, part);
      b.connect(ring, prevL, 'legs');
      prevL = ring;
    }
    for (const [y, cz, rx, rz] of FOOT_RINGS) {
      const ring = b.ring(cx, y, cz, rx, rz, S, part);
      b.connect(ring, prevL, 'legs');
      prevL = ring;
    }
    b.cap(prevL, cx, 0, 0.05, part, 'legs', false);
  }

  // --- bras : coques séparées, insérées dans les épaules ---
  for (const side of [-1, +1]) {
    const part = side < 0 ? 'armL' : 'armR';
    let prevA = null;
    for (const [y, rx, rz] of ARM_RINGS) {
      const ring = b.ring(side * armCx(y), y, 0, rx, rz, S_ARM, part);
      if (!prevA) b.cap(ring, side * armCx(y), y + 0.03, 0, part, 'upper', true);
      else b.connect(ring, prevA, 'upper');
      prevA = ring;
    }
    const [yLast] = ARM_RINGS[ARM_RINGS.length - 1];
    b.cap(prevA, side * armCx(yLast), yLast - 0.015, 0, part, 'upper', false);
  }

  return { b, seams };
}

// ---------------------------------------------------------------------------------------------
// 4. Les 14 morph targets (deltas relatifs, en mètres, pour un poids de 1)
// ---------------------------------------------------------------------------------------------
const smooth = (t) => t * t * (3 - 2 * t);
/** Fenêtre lisse : 0 hors de ]y0,y1[, montée y0→p0, plateau p0→p1, descente p1→y1. */
function win(y, y0, y1, p0 = (y0 + y1) / 2, p1 = p0) {
  if (y <= y0 || y >= y1) return 0;
  if (y < p0) return smooth((y - y0) / (p0 - y0));
  if (y > p1) return smooth((y1 - y) / (y1 - p1));
  return 1;
}
const isArm = (p) => p === 'armL' || p === 'armR';
const isLeg = (p) => p === 'legL' || p === 'legR';

/** delta(x,y,z,meta) → [dx,dy,dz]. Toutes les fonctions rendent 0 exactement hors de leur zone. */
const MORPHS = {
  // --- proportions (bidirectionnelles : le consommateur applique un poids dans [-1,+1]) ---
  prop_shoulders(x, y, z, m) {
    if (m.part === 'core') { const s = 0.30 * win(y, 1.30, 1.50, 1.44); return [(x - m.cx) * s, 0, 0]; }
    if (isArm(m.part)) return [Math.sign(x) * 0.065, 0, 0]; // le bras suit l'épaule (translation)
    return [0, 0, 0];
  },
  prop_chest(x, y, z, m) {
    if (m.part !== 'core') return [0, 0, 0];
    const s = 0.25 * win(y, 1.15, 1.42, 1.28); return [(x - m.cx) * s, 0, (z - m.cz) * s];
  },
  prop_waist(x, y, z, m) {
    if (m.part !== 'core') return [0, 0, 0];
    const s = 0.30 * win(y, 0.88, 1.13, 1.02); return [(x - m.cx) * s, 0, (z - m.cz) * s];
  },
  prop_hips(x, y, z, m) {
    if (m.part !== 'core') return [0, 0, 0];
    const s = 0.25 * win(y, 0.79, 1.00, 0.87); return [(x - m.cx) * s, 0, (z - m.cz) * s];
  },
  prop_arms(x, y, z, m) {
    if (!isArm(m.part)) return [0, 0, 0];
    const s = 0.35 * win(y, 0.90, 1.47, 0.98, 1.40); return [(x - m.cx) * s, 0, (z - m.cz) * s];
  },
  prop_thighs(x, y, z, m) {
    if (!isLeg(m.part)) return [0, 0, 0];
    const s = 0.30 * win(y, 0.46, 0.78, 0.55, 0.70); return [(x - m.cx) * s, 0, (z - m.cz) * s];
  },
  prop_calves(x, y, z, m) {
    if (!isLeg(m.part)) return [0, 0, 0];
    const s = 0.35 * win(y, 0.10, 0.48, 0.30, 0.40); return [(x - m.cx) * s, 0, (z - m.cz) * s];
  },
  // --- intentions (unidirectionnelles : poids dans [0,1]) ---
  goal_shoulders(x, y, z, m) {
    if (m.part === 'core') { const s = 0.12 * win(y, 1.34, 1.50, 1.44); return [(x - m.cx) * s, 0, 0]; }
    if (isArm(m.part)) {
      const w = win(y, 1.28, 1.49, 1.40, 1.46);
      return [(x - m.cx) * 0.35 * w + Math.sign(x) * 0.02 * w, 0, (z - m.cz) * 0.35 * w];
    }
    return [0, 0, 0];
  },
  goal_chest(x, y, z, m) {
    if (m.part !== 'core' || m.rz === 0) return [0, 0, 0];
    const nz = Math.max(0, (z - m.cz) / m.rz);           // « frontalité » (0 dos → 1 poitrine)
    const w = win(y, 1.17, 1.40, 1.24, 1.32);
    return [(x - m.cx) * 0.06 * w * nz, 0, 0.045 * w * nz];
  },
  goal_back(x, y, z, m) {
    if (m.part !== 'core' || m.rz === 0) return [0, 0, 0];
    const nb = Math.max(0, -(z - m.cz) / m.rz);          // « dorsalité »
    const nx = Math.abs((x - m.cx) / m.rx);
    const w = win(y, 1.15, 1.44, 1.22, 1.38);
    return [Math.sign(x - m.cx) * 0.03 * w * nx, 0, -0.04 * w * nb];
  },
  goal_arms(x, y, z, m) {
    if (!isArm(m.part)) return [0, 0, 0];
    const s = 0.30 * win(y, 1.20, 1.44, 1.30, 1.36) + 0.25 * win(y, 0.96, 1.17, 1.05, 1.10);
    return [(x - m.cx) * s, 0, (z - m.cz) * s];
  },
  goal_glutes(x, y, z, m) {
    if (m.part !== 'core' || m.rz === 0) return [0, 0, 0];
    const nb = Math.max(0, -(z - m.cz) / m.rz);
    const w = win(y, 0.79, 1.00, 0.84, 0.92);
    return [(x - m.cx) * 0.05 * w * nb, 0, -0.05 * w * Math.pow(nb, 1.5)];
  },
  goal_thighs(x, y, z, m) {
    if (!isLeg(m.part) || m.rz === 0) return [0, 0, 0];
    const nf = Math.max(0, (z - m.cz) / m.rz);
    const s = 0.25 * win(y, 0.48, 0.78, 0.56, 0.68) * (1 + 0.5 * nf);
    return [(x - m.cx) * s, 0, (z - m.cz) * s];
  },
  goal_calves(x, y, z, m) {
    if (!isLeg(m.part) || m.rz === 0) return [0, 0, 0];
    const nb = Math.max(0, -(z - m.cz) / m.rz);
    const s = 0.30 * win(y, 0.14, 0.48, 0.32, 0.42) * (1 + 0.6 * nb);
    return [(x - m.cx) * s, 0, (z - m.cz) * s];
  },
};
for (const n of MORPH_NAMES) if (!MORPHS[n]) throw new Error(`morph sans définition : ${n}`);

function computeDeltas(b) {
  const V = b.vertexCount;
  const deltas = {};
  for (const name of MORPH_NAMES) {
    const d = new Float32Array(V * 3);
    for (let i = 0; i < V; i++) {
      const [dx, dy, dz] = MORPHS[name](b.pos[3 * i], b.pos[3 * i + 1], b.pos[3 * i + 2], b.meta[i]);
      d[3 * i] = dx; d[3 * i + 1] = dy; d[3 * i + 2] = dz;
    }
    deltas[name] = d;
  }
  return deltas;
}

// ---------------------------------------------------------------------------------------------
// 5. Géométries three (single + split) et contrôles
// ---------------------------------------------------------------------------------------------
function makeGeometry(positions, normals, indices, morphs /* [{name, delta}] */, morphNormals /* [{name, delta}] | null */) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  const idx = positions.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(indices, 1) : new THREE.Uint16BufferAttribute(indices, 1);
  g.setIndex(idx);
  g.morphTargetsRelative = true;
  if (morphs.length) {
    g.morphAttributes.position = morphs.map(({ name, delta }) => { const a = new THREE.Float32BufferAttribute(delta, 3); a.name = name; return a; });
    if (morphNormals) g.morphAttributes.normal = morphNormals.map(({ name, delta }) => { const a = new THREE.Float32BufferAttribute(delta, 3); a.name = name; return a; });
  }
  return g;
}
function makeMesh(name, geometry, morphNames) {
  const mat = new THREE.MeshStandardMaterial({ morphTargets: morphNames.length > 0 });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  mesh.morphTargetInfluences = new Array(morphNames.length).fill(0);
  mesh.morphTargetDictionary = Object.fromEntries(morphNames.map((n, i) => [n, i]));
  return mesh;
}

/** Normales de (base + delta) pour un poids de 1, moins normales de base → delta de normale. */
function morphNormalDelta(positions, baseNormals, indices, delta) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(positions.length);
  for (let i = 0; i < p.length; i++) p[i] = positions[i] + delta[i];
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setIndex(new THREE.BufferAttribute(indices, 1));
  g.computeVertexNormals();
  const n = g.getAttribute('normal').array;
  const out = new Float32Array(n.length);
  for (let i = 0; i < n.length; i++) out[i] = n[i] - baseNormals[i];
  return out;
}

/** Contrôle : aucune face dégénérée / retournée après application d'un morph à un poids donné. */
function checkMorphIntegrity(positions, indices, delta, weight) {
  const p = new Float32Array(positions.length);
  for (let i = 0; i < p.length; i++) p[i] = positions[i] + weight * delta[i];
  let flipped = 0, degenerate = 0, maxDisp = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), n0 = new THREE.Vector3(), tmp = new THREE.Vector3();
  for (let t = 0; t < indices.length; t += 3) {
    const i = indices[t], j = indices[t + 1], k = indices[t + 2];
    a.fromArray(p, 3 * i); b.fromArray(p, 3 * j); c.fromArray(p, 3 * k);
    n.subVectors(b, a).cross(tmp.subVectors(c, a));
    if (n.lengthSq() < 1e-14) { degenerate++; continue; }
    // référence : normale de la face au repos
    a.fromArray(positions, 3 * i); b.fromArray(positions, 3 * j); c.fromArray(positions, 3 * k);
    n0.subVectors(b, a).cross(tmp.subVectors(c, a));
    if (n.dot(n0) < 0) flipped++;
  }
  for (let i = 0; i < delta.length; i += 3) maxDisp = Math.max(maxDisp, Math.hypot(delta[i], delta[i + 1], delta[i + 2]) * Math.abs(weight));
  return { flipped, degenerate, maxDisp };
}

/** Extrait un sous-maillage à partir des triangles taggés `split` ; copie normales et deltas. */
function extractPart(b, normals, deltas, split, morphNames) {
  const remap = new Map();
  const indices = [];
  for (let t = 0; t < b.triPart.length; t++) {
    if (b.triPart[t] !== split) continue;
    for (let q = 0; q < 3; q++) {
      const old = b.tris[3 * t + q];
      if (!remap.has(old)) remap.set(old, remap.size);
      indices.push(remap.get(old));
    }
  }
  const V = remap.size;
  const positions = new Float32Array(V * 3), norm = new Float32Array(V * 3);
  const oldOf = new Array(V);
  for (const [old, nu] of remap) {
    oldOf[nu] = old;
    for (let q = 0; q < 3; q++) { positions[3 * nu + q] = b.pos[3 * old + q]; norm[3 * nu + q] = normals[3 * old + q]; }
  }
  const morphs = morphNames.map((name) => {
    const d = new Float32Array(V * 3);
    for (let nu = 0; nu < V; nu++) for (let q = 0; q < 3; q++) d[3 * nu + q] = deltas[name][3 * oldOf[nu] + q];
    return { name, delta: d };
  });
  // Contrôle : les morphs NON portés par cette partie doivent être nuls sur tous ses sommets
  const leaks = [];
  for (const name of MORPH_NAMES) {
    if (morphNames.includes(name)) continue;
    let touched = 0;
    for (let nu = 0; nu < V; nu++) { const o = oldOf[nu]; if (deltas[name][3 * o] || deltas[name][3 * o + 1] || deltas[name][3 * o + 2]) touched++; }
    if (touched) leaks.push(`${name} touche ${touched} sommets de ${split} sans y être porté`);
  }
  return { positions, normals: norm, indices: Uint32Array.from(indices), morphs, oldOf, leaks };
}

// ---------------------------------------------------------------------------------------------
// 6. Écriture GLB « sparse » à la main (l'exporteur r128 n'écrit que des morphs denses)
// ---------------------------------------------------------------------------------------------
function writeSparseGlb(meshes /* [{name, positions, normals, indices, morphs:[{name,delta}]}] */) {
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
    asset: { version: '2.0', generator: 'generate-body-spike.mjs (sparse, écrit à la main)' },
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

// ---------------------------------------------------------------------------------------------
// 7. Pipeline
// ---------------------------------------------------------------------------------------------
const exportGlb = (root) => new Promise((res, rej) => {
  try { new GLTFExporter().parse(root, res, { binary: true, onlyVisible: true }); } catch (e) { rej(e); }
});
const kb = (n) => (n / 1024).toFixed(1).padStart(7) + ' Ko';
const writeOut = (rel, data) => {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data));
  return { p, size: fs.statSync(p).size };
};

console.log(`three ${THREE_VERSION} (REVISION ${THREE.REVISION}) — génération de l'asset de spike\n`);

const { b, seams } = buildBody();
const V = b.vertexCount, T = b.tris.length / 3;
const positions = new Float32Array(b.pos);
const indices = Uint32Array.from(b.tris);

// normales lisses calculées sur le maillage COMPLET (réutilisées à l'identique par les 3 parties)
const full = new THREE.BufferGeometry();
full.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
full.setIndex(new THREE.BufferAttribute(indices, 1));
full.computeVertexNormals();
const normals = new Float32Array(full.getAttribute('normal').array);
full.computeBoundingBox();
const bb = full.boundingBox;
console.log(`Maillage : ${V} sommets, ${T} triangles, boîte ${bb.min.toArray().map(r3)} → ${bb.max.toArray().map(r3)} (m)`);

const deltas = computeDeltas(b);

// contrôle 1 : jonctions immobiles pour TOUS les morphs
for (const [seamName, ring] of Object.entries(seams)) {
  const moving = MORPH_NAMES.filter((n) => ring.some((i) => deltas[n][3 * i] || deltas[n][3 * i + 1] || deltas[n][3 * i + 2]));
  if (moving.length) throw new Error(`jonction ${seamName} déplacée par : ${moving.join(', ')}`);
}
console.log(`Jonctions : haut/tronc = ${seams.upperTrunk.length} sommets à y=${Y_SEAM_UPPER}, tronc/jambes = ${seams.trunkLegs.length} sommets à y=${Y_CROTCH} — immobiles pour les 14 morphs (vérifié)`);

// contrôle 2 : intégrité aux extrêmes (poids ±1 pour les proportions, +1 pour les intentions)
console.log('\nMorph target        | sommets touchés | dépl. max (cm) | faces retournées / dégénérées aux extrêmes');
for (const name of MORPH_NAMES) {
  const d = deltas[name];
  let touched = 0; for (let i = 0; i < V; i++) if (d[3 * i] || d[3 * i + 1] || d[3 * i + 2]) touched++;
  const weights = name.startsWith('prop_') ? [1, -1] : [1];
  const res = weights.map((w) => checkMorphIntegrity(positions, indices, d, w));
  const flipped = res.reduce((s, r) => s + r.flipped, 0), degen = res.reduce((s, r) => s + r.degenerate, 0);
  console.log(`${name.padEnd(19)} | ${String(touched).padStart(6)} / ${V}   | ${(res[0].maxDisp * 100).toFixed(1).padStart(8)}       | ${flipped} / ${degen}  (poids ${weights.join(', ')})`);
  if (flipped || degen) console.warn(`  ⚠ ${name} : ${flipped} faces retournées, ${degen} dégénérées`);
}

// --- single ---
const singleMorphs = MORPH_NAMES.map((name) => ({ name, delta: deltas[name] }));
const singleMesh = makeMesh('body', makeGeometry(positions, normals, indices, singleMorphs, null), MORPH_NAMES);
const singleGlb = await exportGlb(singleMesh);
const fSingle = writeOut('body-spike-single.glb', singleGlb);

// --- split ---
const parts = {};
const splitRoot = new THREE.Group(); splitRoot.name = 'body-split';
const splitMeshesForSparse = [];
for (const split of ['upper', 'trunk', 'legs']) {
  const part = extractPart(b, normals, deltas, split, MORPHS_BY_PART[split]);
  if (part.leaks.length) throw new Error('découpe incohérente :\n  ' + part.leaks.join('\n  '));
  parts[split] = part;
  splitRoot.add(makeMesh(`body_${split}`, makeGeometry(part.positions, part.normals, part.indices, part.morphs, null), MORPHS_BY_PART[split]));
  splitMeshesForSparse.push({ name: `body_${split}`, positions: part.positions, normals: part.normals, indices: part.indices, morphs: part.morphs });
}
const splitGlb = await exportGlb(splitRoot);
const fSplit = writeOut('body-spike-split.glb', splitGlb);

// sommets partagés entre parties (mêmes coordonnées exactes)
const keyOf = (arr, i) => `${arr[3 * i]},${arr[3 * i + 1]},${arr[3 * i + 2]}`;
const shared = (a, bp) => {
  const s = new Set(); for (let i = 0; i < a.positions.length / 3; i++) s.add(keyOf(a.positions, i));
  let n = 0; for (let i = 0; i < bp.positions.length / 3; i++) if (s.has(keyOf(bp.positions, i))) n++; return n;
};
console.log(`\nDécoupe : upper ${parts.upper.positions.length / 3} sommets / ${parts.upper.indices.length / 3} tris / ${parts.upper.morphs.length} morphs ;` +
  ` trunk ${parts.trunk.positions.length / 3} / ${parts.trunk.indices.length / 3} / ${parts.trunk.morphs.length} ;` +
  ` legs ${parts.legs.positions.length / 3} / ${parts.legs.indices.length / 3} / ${parts.legs.morphs.length}`);
console.log(`Sommets partagés (coordonnées identiques) : upper∩trunk = ${shared(parts.upper, parts.trunk)}, trunk∩legs = ${shared(parts.trunk, parts.legs)}, upper∩legs = ${shared(parts.upper, parts.legs)}`);

console.log(`\nFichiers principaux :\n  ${fSingle.p}  ${kb(fSingle.size)}\n  ${fSplit.p}  ${kb(fSplit.size)}`);

// --- série : poids selon le nombre de morphs (même maillage, m premiers morphs) ---
if (!args.has('--no-series')) {
  console.log('\nSérie « poids du GLB selon le nombre de morphs » (un seul maillage, exporteur r128, deltas denses) :');
  console.log('  morphs |     poids | Δ vs 0 morph | Δ par morph');
  let base = null;
  for (const m of [0, 1, 2, 4, 8, 14]) {
    const names = MORPH_NAMES.slice(0, m);
    const mesh = makeMesh('body', makeGeometry(positions, normals, indices, names.map((n) => ({ name: n, delta: deltas[n] })), null), names);
    const glb = await exportGlb(mesh);
    const f = writeOut(`series/body-spike-single-m${String(m).padStart(2, '0')}.glb`, glb);
    if (base === null) base = f.size;
    console.log(`  ${String(m).padStart(6)} | ${kb(f.size)} | ${kb(f.size - base)} | ${m ? kb((f.size - base) / m) : '      —'}`);
  }
  console.log(`  (théorie : 1 morph dense = ${V} sommets × 12 octets = ${kb(V * 12)})`);
}

// --- variante sparse (écrite à la main ; l'exporteur r128 ne sait pas l'écrire, le chargeur r128 sait la lire) ---
if (!args.has('--no-sparse')) {
  const sp1 = writeSparseGlb([{ name: 'body', positions, normals, indices, morphs: singleMorphs }]);
  const f1 = writeOut('body-spike-single-sparse.glb', sp1.glb);
  const sp3 = writeSparseGlb(splitMeshesForSparse);
  const f3 = writeOut('body-spike-split-sparse.glb', sp3.glb);
  const morphBytes = sp1.sparseStats.reduce((s, r) => s + r.bytes, 0);
  console.log(`\nVariante sparse : ${f1.p}  ${kb(f1.size)}  (données de morph : ${kb(morphBytes)} pour 14 morphs)` +
    `\n                  ${f3.p}  ${kb(f3.size)}`);
}

// --- variante avec morphs de normales (cas « plafond à 4 » du shader r128) ---
if (!args.has('--no-normals')) {
  const mn = MORPH_NAMES.map((name) => ({ name, delta: morphNormalDelta(positions, normals, indices, deltas[name]) }));
  const mesh = makeMesh('body', makeGeometry(positions, normals, indices, singleMorphs, mn), MORPH_NAMES);
  mesh.material.morphNormals = true;
  const glb = await exportGlb(mesh);
  const f = writeOut('body-spike-single-normals.glb', glb);
  console.log(`\nVariante positions + normales morphées : ${f.p}  ${kb(f.size)}`);
}

fs.writeFileSync(path.join(OUT, 'morph-map.json'), JSON.stringify({
  three: THREE_VERSION, vertices: V, triangles: T,
  morphs: MORPH_NAMES, morphsByPart: MORPHS_BY_PART,
  weightMapping: {
    'prop_*': 'poids = valeur / 2  (valeur ∈ [-2,+2] → poids ∈ [-1,+1], UN morph par proportion, poids signé)',
    'goal_*': 'poids = valeur / 4  (valeur ∈ [0,4] → poids ∈ [0,1])',
  },
  seams: { upperTrunk: { y: Y_SEAM_UPPER, vertices: seams.upperTrunk.length }, trunkLegs: { y: Y_CROTCH, vertices: seams.trunkLegs.length } },
}, null, 2));
console.log('\nTerminé.');
