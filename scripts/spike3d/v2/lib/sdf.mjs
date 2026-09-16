// sdf.mjs — champ de distance signé (SDF) composé de primitives lisses.
// Le corps est une union « smooth-min » d'ellipsoïdes et de cônes arrondis (muscles, os, volumes),
// moins quelques sillons (soustraction lisse). Chaque primitive porte un groupe (bras, tronc…)
// utilisé ensuite pour l'appartenance des sommets (masques de morph) et la découpe en 3 parties.

const DEG = Math.PI / 180;

export function rotMatrix(rx, ry, rz) {
  // R = Rz · Ry · Rx (degrés) ; renvoie les 9 coefficients ligne par ligne
  const cx = Math.cos(rx * DEG), sx = Math.sin(rx * DEG);
  const cy = Math.cos(ry * DEG), sy = Math.sin(ry * DEG);
  const cz = Math.cos(rz * DEG), sz = Math.sin(rz * DEG);
  const Rx = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
  const Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  const Rz = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  return mul3(Rz, mul3(Ry, Rx));
}
export function mul3(a, b) {
  const o = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) o[3 * i + j] += a[3 * i + k] * b[3 * k + j];
  return o;
}
/** Matrice dont la colonne Y est `dir` (normalisée), la colonne Z « vers l'avant » (+z monde projeté). */
export function frameAlong(dir) {
  const l = Math.hypot(dir[0], dir[1], dir[2]);
  const y = [dir[0] / l, dir[1] / l, dir[2] / l];
  let z = [0 - y[0] * y[2], 0 - y[1] * y[2], 1 - y[2] * y[2]]; // (0,0,1) − (y·ẑ) y
  const lz = Math.hypot(z[0], z[1], z[2]); z = z.map((v) => v / lz);
  const x = [y[1] * z[2] - y[2] * z[1], y[2] * z[0] - y[0] * z[2], y[0] * z[1] - y[1] * z[0]]; // y × z
  // colonnes x, y, z
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}

export const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
export const smax = (a, b, k) => -smin(-a, -b, k);

export class Body {
  constructor() { this.prims = []; }
  /**
   * Ellipsoïde. c : centre, r : demi-axes [rx, ry, rz] (locaux), opts : { rot:[rx,ry,rz] degrés | mat: 9 coeffs,
   * k: rayon de fusion, group, mirror: dupliquer en x→−x, op: 'union'|'sub', name }
   */
  ellipsoid(c, r, opts = {}) {
    const mat = opts.mat ?? (opts.rot ? rotMatrix(...opts.rot) : null);
    return this._add({ type: 'ell', c: [...c], r: [...r], mat, ...this._common(opts) });
  }
  /** Cône arrondi entre a (rayon ra) et b (rayon rb). */
  cone(a, b, ra, rb, opts = {}) {
    return this._add({ type: 'cone', a: [...a], b: [...b], ra, rb, ...this._common(opts) });
  }
  /**
   * Muscle : ellipsoïde posé le long de l'axe a→b, à la fraction t, décalé de `off` (monde),
   * demi-axes r = [travers, le long de l'axe, avant-arrière].
   */
  muscle(a, b, t, off, r, opts = {}) {
    const c = [a[0] + (b[0] - a[0]) * t + off[0], a[1] + (b[1] - a[1]) * t + off[1], a[2] + (b[2] - a[2]) * t + off[2]];
    const dir = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    let mat = frameAlong(dir);
    if (opts.rot) mat = mul3(mat, rotMatrix(...opts.rot)); // rotation additionnelle dans le repère local
    return this.ellipsoid(c, r, { ...opts, mat, rot: undefined });
  }
  _common(o) { return { k: o.k ?? 0.02, group: o.group ?? 'core', mirror: !!o.mirror, op: o.op ?? 'union', name: o.name ?? '' }; }
  _add(p) {
    p.bbox = bboxOf(p);
    this.prims.push(p);
    if (p.mirror) {
      const m = { ...p, mirror: false, mirrored: true };
      m.bbox = [-p.bbox[3], p.bbox[1], p.bbox[2], -p.bbox[0], p.bbox[4], p.bbox[5]];
      this.prims.push(m);
    }
    return p;
  }
  /** Distance signée de la primitive p au point (x,y,z). */
  primDist(p, x, y, z) {
    if (p.mirrored) x = -x;
    if (p.type === 'ell') {
      let lx = x - p.c[0], ly = y - p.c[1], lz = z - p.c[2];
      if (p.mat) { // local = Rᵀ · (p − c)
        const m = p.mat;
        const tx = m[0] * lx + m[3] * ly + m[6] * lz, ty = m[1] * lx + m[4] * ly + m[7] * lz, tz = m[2] * lx + m[5] * ly + m[8] * lz;
        lx = tx; ly = ty; lz = tz;
      }
      const rx = p.r[0], ry = p.r[1], rz = p.r[2];
      const k0 = Math.hypot(lx / rx, ly / ry, lz / rz);
      const k1 = Math.hypot(lx / (rx * rx), ly / (ry * ry), lz / (rz * rz));
      return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
    }
    // cône arrondi (Inigo Quilez)
    const bax = p.b[0] - p.a[0], bay = p.b[1] - p.a[1], baz = p.b[2] - p.a[2];
    const l2 = bax * bax + bay * bay + baz * baz;
    const rr = p.ra - p.rb, a2 = l2 - rr * rr, il2 = 1 / l2;
    const pax = x - p.a[0], pay = y - p.a[1], paz = z - p.a[2];
    const yy = pax * bax + pay * bay + paz * baz;
    const zz = yy - l2;
    const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = yy * yy * l2, z2 = zz * zz * l2;
    const kk = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > kk) return Math.sqrt(x2 + z2) * il2 - p.rb;
    if (Math.sign(yy) * a2 * y2 < kk) return Math.sqrt(x2 + y2) * il2 - p.ra;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - p.ra;
  }
  /** SDF complet : unions lisses puis soustractions lisses, puis sol plat (y ≥ 0). */
  dist(x, y, z) {
    let d = 1e9;
    const P = this.prims;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      if (p.op !== 'union') continue;
      const bb = p.bbox, k = p.k;
      const dx = Math.max(bb[0] - x, 0, x - bb[3]), dy = Math.max(bb[1] - y, 0, y - bb[4]), dz = Math.max(bb[2] - z, 0, z - bb[5]);
      if (d < 1e8 && dx * dx + dy * dy + dz * dz > (d + k) * (d + k)) continue;
      d = smin(d, this.primDist(p, x, y, z), k);
    }
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      if (p.op !== 'sub') continue;
      const bb = p.bbox;
      const dx = Math.max(bb[0] - x, 0, x - bb[3]), dy = Math.max(bb[1] - y, 0, y - bb[4]), dz = Math.max(bb[2] - z, 0, z - bb[5]);
      if (dx * dx + dy * dy + dz * dz > 4 * p.k * p.k) continue;
      d = smax(d, -this.primDist(p, x, y, z), p.k);
    }
    return Math.max(d, -y); // sol
  }
  gradient(x, y, z, e = 0.003) {
    const gx = this.dist(x + e, y, z) - this.dist(x - e, y, z);
    const gy = this.dist(x, y + e, z) - this.dist(x, y - e, z);
    const gz = this.dist(x, y, z + e) - this.dist(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    return [gx / l, gy / l, gz / l];
  }
  /** Distance (min) des primitives « union » d'un groupe au point. */
  groupDist(group, x, y, z) {
    let d = 1e9;
    for (const p of this.prims) if (p.op === 'union' && p.group === group) d = Math.min(d, this.primDist(p, x, y, z));
    return d;
  }
  groups() { return [...new Set(this.prims.filter((p) => p.op === 'union').map((p) => p.group))]; }
}

function bboxOf(p) {
  if (p.type === 'ell') {
    // boîte englobante d'un ellipsoïde tourné : demi-étendue sur l'axe i = sqrt(Σ_j (M_ij r_j)²)
    const m = p.mat ?? [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const e = [0, 1, 2].map((i) => Math.hypot(m[3 * i] * p.r[0], m[3 * i + 1] * p.r[1], m[3 * i + 2] * p.r[2]));
    return [p.c[0] - e[0], p.c[1] - e[1], p.c[2] - e[2], p.c[0] + e[0], p.c[1] + e[1], p.c[2] + e[2]];
  }
  const r = Math.max(p.ra, p.rb);
  return [Math.min(p.a[0], p.b[0]) - r, Math.min(p.a[1], p.b[1]) - r, Math.min(p.a[2], p.b[2]) - r, Math.max(p.a[0], p.b[0]) + r, Math.max(p.a[1], p.b[1]) + r, Math.max(p.a[2], p.b[2]) + r];
}
