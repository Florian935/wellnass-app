// morphs.mjs (v4, repris de la v3) — les 14 cibles de morph : champs de déplacement continus (m) pondérés par des masques
// d'appartenance aux groupes de primitives. Deux familles, deux mécaniques :
//   • prop_* (proportions, poids signé −1…+1) : mise à l'échelle RADIALE d'un segment autour de son axe
//     (ossature large/étroite), amplitudes modestes (±12 % tronc, ±18 % membres), fenêtres longues.
//   • goal_* (intentions, poids 0…1) : croissance EN FORME DE MUSCLE — chaque ventre musculaire gonfle le
//     long de la normale de son propre ellipsoïde, profil en cloche nul aux tendons, articulations
//     immobiles. C'est ce qui fait « athlète » plutôt que « ballon » : le biceps monte, le coude reste.
// Coutures du maillage découpé : jambes/tronc à y = 0.76 (le champ des hanches s'éteint sur le haut de
// cuisse), tronc/haut INCLINÉE le long du rebord costal (1.12 dans le dos → 1.20 devant, juste sous le
// bord des pectoraux) pour que le pincement inévitable des champs tombe sur un pli naturel.
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
const smooth = (t) => t * t * (3 - 2 * t);
const sstep = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : smooth(t));
// plans de découpe
export const Y_SEAM_LEGS = 0.76;
export const SEAM_UT_BACK = 1.12, SEAM_UT_FRONT = 1.20;
/**
 * Hauteur de la couture haut/tronc : basse au centre du dos (lombaires, 1.12), haute devant (sous les
 * pectoraux, 1.20) ET sur les flancs (rebord costal latéral, 1.19) — sinon la couture passerait à 1.16 sur
 * le flanc, en plein dans la bande d'atténuation du champ de taille, là où la taille est la plus étroite.
 */
export const seamUT = (x, z) => {
  const sz = sstep((z + 0.09) / 0.19), sx = sstep((Math.abs(x) - 0.06) / 0.08);
  const lift = 1 - (1 - sz) * (1 - 0.875 * sx); // 0 au centre du dos, 1 devant, 0.875 sur les flancs arrière
  return SEAM_UT_BACK + (SEAM_UT_FRONT - SEAM_UT_BACK) * lift;
};
export const Y_SEAM_UPPER = (SEAM_UT_BACK + SEAM_UT_FRONT) / 2; // valeur indicative (l'app n'en a pas besoin)
const BAND = 0.025; // marge : aucun morph d'une partie ne bouge dans ±BAND de la couture de l'autre

/** Fenêtre lisse : 0 hors de ]y0,y1[, montée y0→p0, plateau p0→p1, descente p1→y1. */
export function win(y, y0, y1, p0 = (y0 + y1) / 2, p1 = p0) {
  if (y <= y0 || y >= y1) return 0;
  if (y < p0) return smooth((y - y0) / (p0 - y0));
  if (y > p1) return smooth((y1 - y) / (y1 - p1));
  return 1;
}
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

// ─── croissance musculaire des intentions : [nom de primitive, amplitude (m) au poids 1, exposant du profil] ───
// Le profil en cloche (1 − u²)^pow suit le grand axe de l'ellipsoïde : 1 au ventre, 0 aux tendons.
export const GROWTH = {
  goal_shoulders: [['deltoïde', 0.012, 0.5, [0.3, 0.15, 0]], ['trapèze sup', 0.005, 1]],
  goal_chest: [['pectoral', 0.013, 0.7, [0, -0.1, 0.5]], ['pectoral claviculaire', 0.006, 1, [0, 0, 0.5]]],
  goal_back: [['grand dorsal', 0.013, 0.6, [0.2, 0, -0.4]], ['trapèze moyen', 0.007, 0.7], ['infra-épineux', 0.006, 1], ['grand rond', 0.005, 1], ['érecteur', 0.006, 1]],
  goal_arms: [['biceps', 0.012, 0.8], ['triceps', 0.013, 0.8], ['brachial', 0.005, 1], ['fléchisseurs', 0.008, 1], ['brachio-radial', 0.007, 1], ['extenseurs', 0.005, 1]],
  goal_glutes: [['grand glutéal', 0.011, 0.6, [0, 0.1, -0.9]], ['moyen glutéal', 0.005, 1]],
  goal_thighs: [['droit fémoral', 0.013, 0.8], ['vaste externe', 0.014, 0.8], ['vaste interne', 0.011, 1], ['biceps fémoral', 0.012, 0.8], ['semi-tendineux', 0.011, 0.8], ['adducteurs', 0.005, 1]],
  goal_calves: [['gastrocnémien médial', 0.014, 0.7], ['gastrocnémien latéral', 0.012, 0.7], ['soléaire', 0.007, 1], ['tibial antérieur', 0.004, 1]],
};
const R_MUSCLE = 0.028; // portée du poids d'un muscle autour de sa surface (v4 : ventres tangents, un peu plus large)

/**
 * Prépare, pour chaque sommet : masques d'appartenance par groupe, point d'axe du membre, et pour chaque
 * intention la SOMME PONDÉRÉE des croissances musculaires (direction × amplitude), déjà normalisée.
 */
export function prepareVertexData(body, positions, normals) {
  const V = positions.length / 3;
  const groups = body.groups();
  const masks = Object.fromEntries(groups.map((g) => [g, new Float32Array(V)]));
  const axisArm = new Float32Array(V * 3), axisLeg = new Float32Array(V * 3);
  const growth = Object.fromEntries(Object.keys(GROWTH).map((n) => [n, new Float32Array(V * 3)]));
  // primitives de croissance : pour chaque intention, la liste [prim(+x), prim(−x), g, pow, axe long]
  const gprims = {};
  for (const [goal, list] of Object.entries(GROWTH)) {
    gprims[goal] = [];
    for (const [name, g, pow] of list) {
      const ps = body.byName(name);
      if (!ps.length) throw new Error(`muscle inconnu pour ${goal} : ${name}`);
      const longAxis = ps[0].r.indexOf(Math.max(...ps[0].r));
      gprims[goal].push({ ps, g, pow, longAxis, bias: list.find(([n]) => n === name)?.[3] ?? null });
    }
  }
  for (let v = 0; v < V; v++) {
    const x = positions[3 * v], y = positions[3 * v + 1], z = positions[3 * v + 2];
    const nx = normals[3 * v], ny = normals[3 * v + 1], nz = normals[3 * v + 2];
    let sum = 0;
    const f = {};
    for (const g of groups) { f[g] = falloff(body.groupDist(g, x, y, z), R_BY_GROUP[g] ?? R_DEFAULT); sum += f[g]; }
    for (const g of groups) masks[g][v] = sum > 0 ? f[g] / sum : 0;
    const s = x < 0 ? -1 : 1;
    axisArm.set(nearestOnPolyline([mirror(J.shoulder, s), mirror(J.elbow, s), mirror(J.wrist, s)], x, y, z), 3 * v);
    axisLeg.set(nearestOnPolyline([mirror(J.hip, s), mirror(J.knee, s), mirror(J.ankle, s)], x, y, z), 3 * v);
    // croissances musculaires
    for (const [goal, list] of Object.entries(gprims)) {
      let dx = 0, dy = 0, dz = 0, wsum = 0;
      for (const { ps, g, pow, longAxis, bias } of list) {
        // la primitive du bon côté (la plus proche)
        let p = ps[0], d = body.primDist(p, x, y, z);
        for (let i = 1; i < ps.length; i++) { const di = body.primDist(ps[i], x, y, z); if (di < d) { d = di; p = ps[i]; } }
        let w = falloff(d, R_MUSCLE);
        if (w <= 0) continue;
        const u = body.ellipsoidU(p, x, y, z, longAxis);
        const bell = Math.pow(Math.max(0, 1 - u * u), pow);
        if (bell <= 0) continue;
        const nm = body.primGradient(p, x, y, z);
        // direction = normale du muscle + normale du sommet (+ biais optionnel, ex. fessiers vers l'arrière) :
        // au fond d'un pli entre deux muscles, leurs normales propres s'opposent latéralement ; la normale
        // du sommet les réconcilie et la croissance y reste cohérente (sinon les petits triangles du pli se retournent)
        const bx = bias ? bias[0] * (p.mirrored ? -1 : 1) : 0, by = bias ? bias[1] : 0, bz = bias ? bias[2] : 0;
        let n = [nm[0] + nx + bx, nm[1] + ny + by, nm[2] + nz + bz];
        const nl = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / nl, n[1] / nl, n[2] / nl];
        // un sommet dont la normale s'écarte de celle du muscle (fond de sillon, flanc) bouge un peu moins :
        // les ventres montent, les séparations restent en retrait → la définition augmente avec le volume
        const dot = Math.max(0, nm[0] * nx + nm[1] * ny + nm[2] * nz);
        w *= bell * (0.7 + 0.3 * dot * dot);
        dx += w * g * n[0]; dy += w * g * n[1]; dz += w * g * n[2]; wsum += w;
      }
      const k = wsum > 1 ? 1 / wsum : 1;
      growth[goal][3 * v] = dx * k; growth[goal][3 * v + 1] = dy * k; growth[goal][3 * v + 2] = dz * k;
    }
  }
  return { masks, axisArm, axisLeg, groups, growth, indices: null };
}

/**
 * Calcule les 14 deltas (Float32Array V×3 chacun).
 * `data` vient de prepareVertexData ; `normals` = normales de base (gradient du SDF).
 */
export function computeDeltas(positions, normals, data) {
  const V = positions.length / 3;
  const { masks, axisArm, axisLeg, growth } = data;
  const m = (g, v) => (masks[g] ? masks[g][v] : 0);
  const deltas = Object.fromEntries(MORPH_NAMES.map((n) => [n, new Float32Array(V * 3)]));
  const ZC_TORSO = -0.012; // axe avant-arrière du tronc

  for (let v = 0; v < V; v++) {
    const x = positions[3 * v], y = positions[3 * v + 1], z = positions[3 * v + 2];
    const sx = x < 0 ? -1 : 1, ax_ = Math.abs(x);
    const mArmAll = m('arm', v) + m('hand', v) + m('shoulder', v);   // tout le membre supérieur
    const mArm = m('arm', v);                                         // bras + avant-bras seuls
    const mLeg = m('leg', v);
    const mTorso = m('torso', v) + m('pelvis', v);                    // tronc sans cou ni tête
    const mCore = mTorso + m('neck', v) + m('head', v);
    const ax = axisArm[3 * v], az = axisArm[3 * v + 2];
    const lx = axisLeg[3 * v], lz = axisLeg[3 * v + 2];
    const yrel = y - seamUT(x, z); // hauteur relative à la couture haut/tronc (>0 = haut)
    const set = (name, dx, dy, dz) => { const d = deltas[name]; d[3 * v] = dx; d[3 * v + 1] = dy; d[3 * v + 2] = dz; };
    const grow = (name, scale) => { const g = growth[name]; set(name, g[3 * v] * scale, g[3 * v + 1] * scale, g[3 * v + 2] * scale); };

    // ─── proportions (poids signé −1…+1) ───
    {
      // épaules : la ceinture s'étire du sternum vers l'acromion (le cou ne bouge pas) et tout le membre
      // supérieur se translate vers l'extérieur, un peu moins en bas (le bras pivote légèrement)
      const t = 0.024;
      const wT = win(y, 1.24, 1.56, 1.34, 1.48) * sstep((ax_ - 0.04) / 0.11) * mCore;
      const tArm = (t - 0.008 * Math.max(0, Math.min(1, (1.41 - y) / 0.25))) * mArmAll; // 2,4 cm à l'épaule → 1,6 cm sous le coude
      set('prop_shoulders', sx * t * wT + sx * tArm, 0, 0);
    }
    {
      // poitrine : la cage thoracique gonfle en x et z (11 %) ; les bras suivent le flanc pour rester posés dessus
      const w = win(yrel, BAND, 0.30, 0.09, 0.22);
      const sT = 0.11 * w * mTorso;
      const tArm = sx * 0.012 * mArmAll * win(y, 1.0, 1.60, 1.22, 1.50); // seul le haut du bras suit (l'avant-bras reste : 1,2 cm de cisaillement sur 25 cm, invisible)
      set('prop_chest', x * sT + tArm, 0, (z - ZC_TORSO) * sT);
    }
    {
      // taille : tout l'abdomen (du bassin au rebord costal) s'épaissit — 11 % en largeur, 8 % en profondeur
      const w = win(y, 0.90, 1.30, 0.99, 1.29) * win(yrel, -1, -BAND, -0.9, -0.10) * mCore;
      set('prop_waist', x * 0.11 * w, 0, (z - ZC_TORSO) * 0.08 * w);
    }
    {
      // hanches : bassin plus large (1,7 cm par côté au grand trochanter), la ligne médiane ne bouge pas,
      // le champ s'éteint sur le haut de cuisse (couture à 0.76) ; légère épaisseur (6 %) centrée sur le bassin
      const wx = win(y, Y_SEAM_LEGS + BAND, 1.06, 0.87, 0.97) * sstep((ax_ - 0.03) / 0.09) * mCore;
      const wz = win(y, 0.83, 1.05, 0.90, 0.98) * mCore;
      set('prop_hips', sx * 0.017 * wx, 0, (z - ZC_TORSO) * 0.05 * wz);
    }
    {
      const w = win(y, 0.86, 1.40, 0.92, 1.30) * mArm;
      set('prop_arms', (x - ax) * 0.18 * w, 0, (z - az) * 0.18 * w);
    }
    // cuisses / mollets : partition COMPLÉMENTAIRE au genou (wT + wC = 1 entre la cheville et le haut de cuisse) :
    // à +1/+1 la jambe entière est mise à l'échelle uniformément, sans bourrelet au genou
    const kneeBlend = sstep((y - 0.46) / 0.08);
    {
      const w = kneeBlend * win(y, 0, Y_SEAM_LEGS - BAND, 0.001, 0.655) * mLeg;
      set('prop_thighs', (x - lx) * 0.18 * w, 0, (z - lz) * 0.18 * w);
    }
    {
      const w = (1 - kneeBlend) * win(y, 0.04, 1, 0.12, 0.99) * mLeg;
      set('prop_calves', (x - lx) * 0.18 * w, 0, (z - lz) * 0.18 * w);
    }

    // ─── intentions (poids 0…1) : croissance musculaire × fenêtre de couture ───
    {
      // deltoïdes (+ un léger élargissement de la ceinture pour que le trapèze suive)
      grow('goal_shoulders', 1);
      const d = deltas.goal_shoulders;
      d[3 * v] += sx * 0.006 * win(y, 1.26, 1.54, 1.40, 1.47) * sstep((ax_ - 0.05) / 0.10) * mCore;
    }
    grow('goal_chest', win(yrel, BAND, 0.40, 0.075, 0.30));
    {
      // dos : dorsaux/trapèzes (champ continu dans l'espace : les sommets du bras proches de l'aisselle suivent d'eux-mêmes)
      grow('goal_back', win(yrel, BAND, 0.45, 0.075, 0.36));
    }
    grow('goal_arms', win(y, 0.86, 1.42, 0.92, 1.36));
    grow('goal_glutes', win(y, Y_SEAM_LEGS + BAND, 1.08, 0.84, 1.0));
    grow('goal_thighs', win(y, 0.44, Y_SEAM_LEGS - BAND, 0.50, 0.665));
    grow('goal_calves', win(y, 0.06, 0.52, 0.14, 0.44));
  }
  // lissage laplacien : borne le gradient du champ de déplacement — dans les plis (aisselle, sillons)
  // les surface nets produisent de petits triangles qu'un saut de delta entre voisins peut retourner
  if (data.indices && !process.env.NO_SMOOTH) smoothDeltas(deltas, data.indices, V, 3, 0.5);
  // seuil : un delta < 0,5 mm est invisible sur un corps de 1,80 m mais coûte 14 octets en sparse
  const EPS = 5e-4;
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

/** Cas de test standard : chaque cible à ses extrêmes + les 5 combinaisons (les mêmes que verify-v3). */
export const TEST_WEIGHTS = [
  ...MORPH_NAMES.flatMap((n) => (n.startsWith('prop_') ? [1, -1] : [1]).map((w) => [`${n} ${w > 0 ? '+1' : '−1'}`, (x) => (x === n ? w : 0)])),
  ['tout +1', () => 1], ['props −1, goals +1', (n) => (n.startsWith('prop_') ? -1 : 1)],
  ['props −1', (n) => (n.startsWith('prop_') ? -1 : 0)], ['props +1', (n) => (n.startsWith('prop_') ? 1 : 0)], ['goals +1', (n) => (n.startsWith('goal_') ? 1 : 0)],
];
/**
 * Réparation ciblée : les surface nets laissent quelques micro-triangles (2–4 mm²) au fond des sillons ; sous
 * une compression légitime de 20–25 % (épaules −1 sur la ceinture) l'un d'eux peut se retourner. Pour chaque
 * cas de test, les triangles retournés voient les deltas de leurs 3 sommets remplacés par leur moyenne (le
 * triangle se translate rigidement) — écart ≈ 1 mm sur 3 mm, invisible — jusqu'à 0 retournement.
 * Renvoie le nombre total de triangles corrigés.
 */
export function repairFlips(positions, indices, deltas, tests = TEST_WEIGHTS, maxIter = 12) {
  const V = positions.length / 3;
  const cr = (ax, ay, az, bx, by, bz) => [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
  let total = 0;
  for (let it = 0; it < maxIter; it++) {
    let fixed = 0;
    for (const [, wOf] of tests) {
      const active = MORPH_NAMES.filter((n) => wOf(n));
      const c = new Float32Array(V * 3);
      for (const n of active) { const w = wOf(n), d = deltas[n]; for (let i = 0; i < c.length; i++) c[i] += w * d[i]; }
      for (let t = 0; t < indices.length; t += 3) {
        const i = indices[t], j = indices[t + 1], k = indices[t + 2];
        const P = (v, q) => positions[3 * v + q], Q = (v, q) => positions[3 * v + q] + c[3 * v + q];
        const n0 = cr(P(j, 0) - P(i, 0), P(j, 1) - P(i, 1), P(j, 2) - P(i, 2), P(k, 0) - P(i, 0), P(k, 1) - P(i, 1), P(k, 2) - P(i, 2));
        const n1 = cr(Q(j, 0) - Q(i, 0), Q(j, 1) - Q(i, 1), Q(j, 2) - Q(i, 2), Q(k, 0) - Q(i, 0), Q(k, 1) - Q(i, 1), Q(k, 2) - Q(i, 2));
        if (n1[0] * n0[0] + n1[1] * n0[1] + n1[2] * n0[2] >= 0) continue;
        for (const n of active) { const d = deltas[n]; for (let q = 0; q < 3; q++) { const m = (d[3 * i + q] + d[3 * j + q] + d[3 * k + q]) / 3; d[3 * i + q] = m; d[3 * j + q] = m; d[3 * k + q] = m; } }
        fixed++;
      }
    }
    total += fixed;
    if (!fixed) break;
  }
  return total;
}

/**
 * Étiquette chaque triangle : 'upper' | 'trunk' | 'legs'. Le membre supérieur (masque) est toujours
 * `upper` quelle que soit sa hauteur (les mains pendent au niveau des cuisses) ; le reste par coutures :
 * haut/tronc = surface inclinée seamUT(z), tronc/jambes = plan y = Y_SEAM_LEGS.
 */
export function tagTriangles(positions, indices, data) {
  const T = indices.length / 3;
  const tags = new Array(T);
  const up = (v) => (data.masks.arm?.[v] ?? 0) + (data.masks.hand?.[v] ?? 0) + (data.masks.shoulder?.[v] ?? 0);
  for (let t = 0; t < T; t++) {
    const i = indices[3 * t], j = indices[3 * t + 1], k = indices[3 * t + 2];
    const y = (positions[3 * i + 1] + positions[3 * j + 1] + positions[3 * k + 1]) / 3;
    const z = (positions[3 * i + 2] + positions[3 * j + 2] + positions[3 * k + 2]) / 3;
    const limb = (up(i) + up(j) + up(k)) / 3;
    if (limb > 0.5) tags[t] = 'upper';
    else if (y >= seamUT((positions[3 * i] + positions[3 * j] + positions[3 * k]) / 3, z)) tags[t] = 'upper';
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
