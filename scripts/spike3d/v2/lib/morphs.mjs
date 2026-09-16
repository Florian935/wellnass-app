// morphs.mjs — les 14 cibles de morph : champs de déplacement continus (m) pondérés par des masques
// d'appartenance aux groupes de primitives (bras, jambes, tronc…). Le maillage étant soudé, un
// déplacement rigide d'un membre est fondu dans le tronc par le masque au lieu de déchirer la jonction.
// Toutes les fonctions rendent exactement 0 hors de leur zone (fenêtres lisses + masques à support compact).
import { J } from './body.mjs';

export const MORPH_NAMES = [
  'prop_shoulders', 'prop_chest', 'prop_waist', 'prop_hips', 'prop_arms', 'prop_thighs', 'prop_calves',
  'goal_shoulders', 'goal_chest', 'goal_back', 'goal_arms', 'goal_glutes', 'goal_thighs', 'goal_calves',
];
export const MORPHS_BY_PART = {
  upper: ['prop_shoulders', 'prop_chest', 'prop_arms', 'goal_shoulders', 'goal_chest', 'goal_back', 'goal_arms'],
  trunk: ['prop_waist', 'prop_hips', 'goal_glutes'],
  legs: ['prop_thighs', 'prop_calves', 'goal_thighs', 'goal_calves'],
};
// plans de découpe (les jonctions sont des bandes de ± une cellule autour de ces plans)
export const Y_SEAM_UPPER = 1.14;
export const Y_SEAM_LEGS = 0.80;
const BAND = 0.025; // marge de sécurité : aucun morph d'une partie ne bouge dans ±BAND du plan de l'autre

const smooth = (t) => t * t * (3 - 2 * t);
/** Fenêtre lisse : 0 hors de ]y0,y1[, montée y0→p0, plateau p0→p1, descente p1→y1. */
export function win(y, y0, y1, p0 = (y0 + y1) / 2, p1 = p0) {
  if (y <= y0 || y >= y1) return 0;
  if (y < p0) return smooth((y - y0) / (p0 - y0));
  if (y > p1) return smooth((y1 - y) / (y1 - p1));
  return 1;
}
// portée du masque d'appartenance par groupe : large à l'épaule (jonction bras/tronc très sollicitée
// par le cumul des morphs, il faut une bande de fondu large), courte ailleurs (les mains pendent à
// ~7 cm des cuisses : leur masque ne doit jamais atteindre les jambes ni le bassin)
const R_BY_GROUP = { shoulder: 0.06, torso: 0.05, arm: 0.045, neck: 0.04, head: 0.03 };
const R_DEFAULT = 0.035;
const falloff = (d, R) => (d <= 0 ? 1 : d >= R ? 0 : (1 - d / R) ** 2);

/** Point le plus proche sur une polyligne (liste de points), renvoie [x,y,z]. */
function nearestOnPolyline(pts, x, y, z) {
  let best = null, bd = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
    const l2 = abx * abx + aby * aby + abz * abz;
    let t = ((x - a[0]) * abx + (y - a[1]) * aby + (z - a[2]) * abz) / l2;
    t = Math.max(0, Math.min(1, t));
    const px = a[0] + abx * t, py = a[1] + aby * t, pz = a[2] + abz * t;
    const d = (x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2;
    if (d < bd) { bd = d; best = [px, py, pz]; }
  }
  return best;
}
const mirror = (p, s) => [s * p[0], p[1], p[2]];

/**
 * Prépare, pour chaque sommet, les masques d'appartenance par groupe et les données locales
 * (point d'axe du membre, normale). Renvoie { masks: {group: Float32Array}, axisArm, axisLeg }.
 */
export function prepareVertexData(body, positions, normals) {
  const V = positions.length / 3;
  const groups = body.groups();
  const masks = Object.fromEntries(groups.map((g) => [g, new Float32Array(V)]));
  const axisArm = new Float32Array(V * 3), axisLeg = new Float32Array(V * 3);
  for (let v = 0; v < V; v++) {
    const x = positions[3 * v], y = positions[3 * v + 1], z = positions[3 * v + 2];
    let sum = 0;
    const f = {};
    for (const g of groups) { f[g] = falloff(body.groupDist(g, x, y, z), R_BY_GROUP[g] ?? R_DEFAULT); sum += f[g]; }
    for (const g of groups) masks[g][v] = sum > 0 ? f[g] / sum : 0;
    const s = x < 0 ? -1 : 1;
    const a = nearestOnPolyline([mirror(J.shoulder, s), mirror(J.elbow, s), mirror(J.wrist, s)], x, y, z);
    const l = nearestOnPolyline([mirror(J.hip, s), mirror(J.knee, s), mirror(J.ankle, s)], x, y, z);
    axisArm.set(a, 3 * v); axisLeg.set(l, 3 * v);
  }
  return { masks, axisArm, axisLeg, groups, indices: null };
}

/**
 * Calcule les 14 deltas (Float32Array V×3 chacun).
 * `data` vient de prepareVertexData ; `normals` = normales de base (gradient du SDF).
 */
export function computeDeltas(positions, normals, data) {
  const V = positions.length / 3;
  const { masks, axisArm, axisLeg } = data;
  const m = (g, v) => (masks[g] ? masks[g][v] : 0);
  const deltas = Object.fromEntries(MORPH_NAMES.map((n) => [n, new Float32Array(V * 3)]));
  const ZC_TORSO = -0.012; // axe avant-arrière du tronc

  for (let v = 0; v < V; v++) {
    const x = positions[3 * v], y = positions[3 * v + 1], z = positions[3 * v + 2];
    const nx = normals[3 * v], ny = normals[3 * v + 1], nz = normals[3 * v + 2];
    const sx = x < 0 ? -1 : 1;
    const mArmAll = m('arm', v) + m('hand', v) + m('shoulder', v);   // tout le membre supérieur
    const mArm = m('arm', v);                                         // bras + avant-bras seuls
    const mSh = m('shoulder', v);
    const mLeg = m('leg', v);
    const mCore = m('torso', v) + m('pelvis', v) + m('neck', v) + m('head', v);
    const ax = axisArm[3 * v], az = axisArm[3 * v + 2];
    const lx = axisLeg[3 * v], lz = axisLeg[3 * v + 2];
    // « frontalité / dorsalité / latéralité » : direction radiale autour de l'axe du membre ou du tronc,
    // et NON la normale du sommet — la normale saute dans les sillons et ferait se retourner des faces.
    const isLimb = mArmAll + mLeg > 0.5;
    const cxr = isLimb ? (mLeg > mArmAll ? lx : ax) : 0, czr = isLimb ? (mLeg > mArmAll ? lz : az) : ZC_TORSO;
    const rdx = x - cxr, rdz = z - czr, rl = Math.hypot(rdx, rdz) || 1;
    const front = Math.max(0, rdz / rl), back = Math.max(0, -rdz / rl), side = Math.abs(rdx) / rl;
    const set = (name, dx, dy, dz) => { const d = deltas[name]; d[3 * v] = dx; d[3 * v + 1] = dy; d[3 * v + 2] = dz; };

    // ─── proportions (poids signé −1…+1) ───
    {
      // épaules : la ceinture s'élargit (tronc) et tout le membre supérieur se translate vers l'extérieur,
      // un peu moins en bas (le bras pivote légèrement) ; la cage haute suit pour ne pas être traversée à −1
      const wT = win(y, Y_SEAM_UPPER + BAND, 1.54, 1.34, 1.47) * mCore;
      const tArm = (0.045 - 0.017 * Math.max(0, Math.min(1, (1.41 - y) / 0.25))) * mArmAll; // 4,5 cm à l'épaule → 2,8 cm sous le coude
      set('prop_shoulders', x * 0.24 * wT + sx * tArm, 0, 0);
    }
    {
      // poitrine : la cage thoracique gonfle en x et z ; les bras suivent le flanc pour rester posés dessus
      const w = win(y, Y_SEAM_UPPER + BAND, 1.50, 1.24, 1.44); // monte jusqu'à la ceinture : le tronc suit le bras à la jonction
      const sT = 0.18 * w * mCore;
      const tArm = sx * 0.024 * mArmAll; // translation rigide du membre (constante)
      set('prop_chest', x * sT + tArm, 0, (z - ZC_TORSO) * sT);
    }
    {
      const w = win(y, 0.86, Y_SEAM_UPPER - BAND, 0.99, 1.07) * mCore;
      set('prop_waist', x * 0.24 * w, 0, (z - ZC_TORSO) * 0.24 * w);
    }
    {
      const w = win(y, Y_SEAM_LEGS + BAND, 1.03, 0.90, 0.96) * mCore;
      set('prop_hips', x * 0.20 * w, 0, (z - ZC_TORSO) * 0.20 * w);
    }
    {
      const w = win(y, 0.88, 1.40, 0.95, 1.32) * mArm;
      set('prop_arms', (x - ax) * 0.35 * w, 0, (z - az) * 0.35 * w);
    }
    {
      const w = win(y, 0.46, Y_SEAM_LEGS - BAND, 0.55, 0.70) * mLeg;
      set('prop_thighs', (x - lx) * 0.30 * w, 0, (z - lz) * 0.30 * w);
    }
    {
      const w = win(y, 0.10, 0.48, 0.30, 0.40) * mLeg;
      set('prop_calves', (x - lx) * 0.35 * w, 0, (z - lz) * 0.35 * w);
    }

    // ─── intentions (poids 0…1) ───
    {
      // deltoïdes : croissance autour d'un centre décalé vers l'intérieur (surtout vers l'extérieur et le haut)
      const w = win(y, 1.28, 1.52, 1.36, 1.47);
      const cx = sx * 0.15, cy = 1.39; // centre au bord interne du deltoïde : la jonction avec le tronc ne bouge pas
      const g = 0.24 * w * mSh;
      const tT = x * 0.06 * win(y, Y_SEAM_UPPER + BAND, 1.54, 1.40, 1.47) * mCore;
      set('goal_shoulders', (x - cx) * g + tT, (y - cy) * g, (z + 0.004) * g);
    }
    {
      // pectoraux : épaississement vers l'avant + élargissement vers l'aisselle, bord inférieur qui s'arrondit
      const w = win(y, 1.19, 1.42, 1.26, 1.35) * win(Math.abs(x), 0.004, 0.20, 0.04, 0.15) * front * front * mCore;
      set('goal_chest', sx * 0.012 * w, -0.006 * w, 0.042 * w);
    }
    {
      // dos : dorsaux en V (épaisseur vers l'arrière, largeur vers l'aisselle) + trapèzes ; les bras s'écartent un peu
      const w = win(y, Y_SEAM_UPPER + BAND, 1.47, 1.24, 1.40) * mCore;
      const wide = win(y, 1.22, 1.44, 1.30, 1.38) * mCore;
      const tArm = sx * 0.02 * mArmAll; // le bras suit l'élargissement du dorsal (sinon le dorsal le traverse à l'aisselle)
      set('goal_back', sx * 0.022 * wide * side + tArm, 0, -0.04 * w * back);
    }
    {
      // bras : biceps/triceps puis avant-bras, avec un « pic » de biceps vers l'avant
      const s = 0.30 * win(y, 1.19, 1.40, 1.27, 1.35) + 0.22 * win(y, 0.95, 1.16, 1.02, 1.10);
      const peak = 0.012 * win(y, 1.24, 1.38, 1.29, 1.33) * front;
      set('goal_arms', (x - ax) * s * mArm, 0, (z - az) * s * mArm + peak * mArm);
    }
    {
      const w = win(y, Y_SEAM_LEGS + BAND, 1.01, 0.86, 0.95) * mCore;
      const b = Math.pow(back, 1.4);
      set('goal_glutes', sx * 0.02 * w * b * side, 0.008 * w * b, -0.052 * w * b);
    }
    {
      const w = win(y, 0.48, Y_SEAM_LEGS - BAND, 0.56, 0.70) * mLeg * (1 + 0.5 * front);
      set('goal_thighs', (x - lx) * 0.25 * w, 0, (z - lz) * 0.25 * w);
    }
    {
      const w = win(y, 0.14, 0.48, 0.30, 0.42) * mLeg * (1 + 0.6 * back);
      set('goal_calves', (x - lx) * 0.30 * w, 0, (z - lz) * 0.30 * w);
    }
  }
  // lissage laplacien (1 passe) : borne le gradient du champ de déplacement — dans les plis (aisselle)
  // les surface nets produisent de petits triangles qu'un saut de delta entre voisins peut retourner
  if (data.indices && !process.env.NO_SMOOTH) smoothDeltas(deltas, data.indices, V, 1, 0.5);
  // seuil : un delta < 0,15 mm est invisible sur un corps de 1,80 m mais coûte 14 octets en sparse
  const EPS = 1.5e-4;
  for (const d of Object.values(deltas)) for (let v = 0; v < V; v++) {
    if (Math.hypot(d[3 * v], d[3 * v + 1], d[3 * v + 2]) < EPS) { d[3 * v] = 0; d[3 * v + 1] = 0; d[3 * v + 2] = 0; }
  }
  return deltas;
}

/** Lissage laplacien des deltas : d[v] ← (1−λ)·d[v] + λ·moyenne(d[voisins]). */
export function smoothDeltas(deltas, indices, V, iterations = 1, lambda = 0.5) {
  const nbrs = Array.from({ length: V }, () => new Set());
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t], b = indices[t + 1], c = indices[t + 2];
    nbrs[a].add(b); nbrs[a].add(c); nbrs[b].add(a); nbrs[b].add(c); nbrs[c].add(a); nbrs[c].add(b);
  }
  for (const name of Object.keys(deltas)) {
    let d = deltas[name];
    for (let it = 0; it < iterations; it++) {
      const out = new Float32Array(d.length);
      for (let v = 0; v < V; v++) {
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const u of nbrs[v]) { sx += d[3 * u]; sy += d[3 * u + 1]; sz += d[3 * u + 2]; n++; }
        if (!n) { out[3 * v] = d[3 * v]; out[3 * v + 1] = d[3 * v + 1]; out[3 * v + 2] = d[3 * v + 2]; continue; }
        out[3 * v] = (1 - lambda) * d[3 * v] + lambda * sx / n;
        out[3 * v + 1] = (1 - lambda) * d[3 * v + 1] + lambda * sy / n;
        out[3 * v + 2] = (1 - lambda) * d[3 * v + 2] + lambda * sz / n;
      }
      d = out;
    }
    deltas[name] = d;
  }
}

/**
 * Étiquette chaque triangle : 'upper' | 'trunk' | 'legs'. Le membre supérieur (masque) est toujours
 * `upper` quelle que soit sa hauteur (les mains pendent au niveau des cuisses) ; le reste par plans.
 */
export function tagTriangles(positions, indices, data) {
  const T = indices.length / 3;
  const tags = new Array(T);
  const up = (v) => (data.masks.arm?.[v] ?? 0) + (data.masks.hand?.[v] ?? 0) + (data.masks.shoulder?.[v] ?? 0);
  for (let t = 0; t < T; t++) {
    const i = indices[3 * t], j = indices[3 * t + 1], k = indices[3 * t + 2];
    const y = (positions[3 * i + 1] + positions[3 * j + 1] + positions[3 * k + 1]) / 3;
    const limb = (up(i) + up(j) + up(k)) / 3;
    if (limb > 0.5) tags[t] = 'upper';
    else if (y >= Y_SEAM_UPPER) tags[t] = 'upper';
    else if (y >= Y_SEAM_LEGS) tags[t] = 'trunk';
    else tags[t] = 'legs';
  }
  return tags;
}

/**
 * Sécurité : force à zéro les deltas d'un morph sur tout sommet appartenant à une partie qui ne le porte pas.
 * Renvoie, par morph, le nombre de sommets forcés et le plus grand déplacement écrasé (doit être ~0).
 */
export function enforceSeams(positions, indices, tags, deltas) {
  const V = positions.length / 3;
  const partsOf = Array.from({ length: V }, () => new Set());
  for (let t = 0; t < tags.length; t++) for (let q = 0; q < 3; q++) partsOf[indices[3 * t + q]].add(tags[t]);
  const report = {};
  for (const name of MORPH_NAMES) {
    const carriers = Object.entries(MORPHS_BY_PART).filter(([, l]) => l.includes(name)).map(([p]) => p);
    const d = deltas[name];
    let forced = 0, maxKilled = 0;
    for (let v = 0; v < V; v++) {
      let ok = true;
      for (const p of partsOf[v]) if (!carriers.includes(p)) ok = false;
      if (ok) continue;
      const mag = Math.hypot(d[3 * v], d[3 * v + 1], d[3 * v + 2]);
      if (mag > 0) { forced++; maxKilled = Math.max(maxKilled, mag); d[3 * v] = d[3 * v + 1] = d[3 * v + 2] = 0; }
    }
    report[name] = { forced, maxKilled };
  }
  return report;
}
