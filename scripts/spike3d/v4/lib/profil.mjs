// profil.mjs (v4) — MESURES du profil et de la silhouette : le juge de la v4.
// Pour une bande verticale x = x0, on intersecte la droite (x0, y) parallèle à z avec les TRIANGLES du maillage :
// z_avant(y) = plus grand z touché, z_arrière(y) = plus petit. Puis on quantifie les « bosses » : écart maximal
// à une moyenne glissante (fenêtre ≈ 7 cm) et rugosité (moyenne des |dérivées secondes|), en mm.
// Une bosse de muscle collé sur le corps = grand écart ; une enveloppe lisse = petit écart.
export function profile(mesh, { x0 = 0, y0 = 0.80, y1 = 1.56, dy = 0.01 } = {}) {
  const P = mesh.positions, I = mesh.indices;
  const n = Math.round((y1 - y0) / dy) + 1;
  const front = new Array(n).fill(null), back = new Array(n).fill(null);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const ax = P[3 * a], ay = P[3 * a + 1], az = P[3 * a + 2];
    const bx = P[3 * b], by = P[3 * b + 1], bz = P[3 * b + 2];
    const cx = P[3 * c], cy = P[3 * c + 1], cz = P[3 * c + 2];
    if (Math.min(ax, bx, cx) > x0 || Math.max(ax, bx, cx) < x0) continue;
    const ymin = Math.min(ay, by, cy), ymax = Math.max(ay, by, cy);
    const j0 = Math.max(0, Math.ceil((ymin - y0) / dy)), j1 = Math.min(n - 1, Math.floor((ymax - y0) / dy));
    const det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (Math.abs(det) < 1e-12) continue;
    for (let j = j0; j <= j1; j++) {
      const y = y0 + j * dy;
      const l1 = ((bx - x0) * (cy - y) - (cx - x0) * (by - y)) / det;
      const l2 = ((cx - x0) * (ay - y) - (ax - x0) * (cy - y)) / det;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
      const z = l1 * az + l2 * bz + l3 * cz;
      if (front[j] === null || z > front[j]) front[j] = z;
      if (back[j] === null || z < back[j]) back[j] = z;
    }
  }
  const ys = Array.from({ length: n }, (_, j) => y0 + j * dy);
  return { ys, front, back };
}
/** Bosses d'une courbe z(y) : écart max à la moyenne glissante (fenêtre w points) et rugosité (|z''| moyen), en mm. */
export function bumpiness(zs, w = 7) {
  let maxDev = 0, sum2 = 0, cnt2 = 0, n = 0;
  for (let i = 0; i < zs.length; i++) {
    if (zs[i] === null) continue;
    n++;
    let s = 0, c = 0;
    for (let k = -Math.floor(w / 2); k <= Math.floor(w / 2); k++) { const q = zs[i + k]; if (q != null) { s += q; c++; } }
    maxDev = Math.max(maxDev, Math.abs(zs[i] - s / c));
    if (zs[i - 1] != null && zs[i + 1] != null) { sum2 += Math.abs(zs[i - 1] - 2 * zs[i] + zs[i + 1]); cnt2++; }
  }
  return { maxDevMm: +(maxDev * 1000).toFixed(1), roughMm: +((cnt2 ? sum2 / cnt2 : 0) * 1000).toFixed(2), n };
}
/** Zones mesurées : bande verticale, plage de y, face(s) relevée(s). */
export const ZONES = [
  ['tronc avant (x=0)', { x0: 0, y0: 0.88, y1: 1.50 }, 'front'],
  ['tronc arrière (x=0)', { x0: 0, y0: 0.84, y1: 1.42 }, 'back'],
  ['abdomen avant (x=.04)', { x0: 0.04, y0: 0.98, y1: 1.26 }, 'front'],
  ['pectoral avant (x=.08)', { x0: 0.08, y0: 1.18, y1: 1.44 }, 'front'],
  ['fessier arrière (x=.08)', { x0: 0.08, y0: 0.78, y1: 1.02 }, 'back'],
  ['épaule (x=.21)', { x0: 0.21, y0: 1.28, y1: 1.47 }, 'both'],
  ['avant-bras (x=.25)', { x0: 0.25, y0: 0.93, y1: 1.14 }, 'both'],
  ['mollet (x=.10)', { x0: 0.10, y0: 0.14, y1: 0.47 }, 'both'],
];
export function report(mesh, label) {
  const lines = [];
  for (const [name, opt, which] of ZONES) {
    const p = profile(mesh, opt);
    const parts = [];
    if (which === 'front' || which === 'both') { const b = bumpiness(p.front); parts.push(`avant écart max ${String(b.maxDevMm).padStart(5)} mm, rugosité ${String(b.roughMm).padStart(5)} mm`); }
    if (which === 'back' || which === 'both') { const b = bumpiness(p.back); parts.push(`arrière écart max ${String(b.maxDevMm).padStart(5)} mm, rugosité ${String(b.roughMm).padStart(5)} mm`); }
    lines.push(`  ${label.padEnd(3)} ${name.padEnd(24)} ${parts.join(' | ')}`);
  }
  return lines.join('\n');
}
/** Résumé chiffré (objet) des zones, pour morph-map.json. */
export function summary(mesh) {
  const out = {};
  for (const [name, opt, which] of ZONES) {
    const p = profile(mesh, opt);
    out[name] = {};
    if (which !== 'back') out[name].front = bumpiness(p.front);
    if (which !== 'front') out[name].back = bumpiness(p.back);
  }
  return out;
}
/** Profondeurs clés (cm) du profil, pour lire la ligne : poitrine, sous-pectoral, nombril, bas-ventre ; dos, lombaires, fessiers. */
export function keyDepths(mesh) {
  const p = profile(mesh, { x0: 0, y0: 0.80, y1: 1.56, dy: 0.01 });
  const at = (y, arr) => { const j = Math.round((y - 0.80) / 0.01); const v = p[arr][j]; return v === null ? ' n/a' : (v * 100).toFixed(1); };
  const g = profile(mesh, { x0: 0.08, y0: 0.80, y1: 1.10, dy: 0.01 });
  const gAt = (y) => { const j = Math.round((y - 0.80) / 0.01); const v = g.back[j]; return v === null ? ' n/a' : (v * 100).toFixed(1); };
  return `avant : poitrine(1.31) ${at(1.31, 'front')} | sous-pec(1.22) ${at(1.22, 'front')} | creux(1.16) ${at(1.16, 'front')} | nombril(1.08) ${at(1.08, 'front')} | bas-ventre(0.98) ${at(0.98, 'front')} | pubis(0.90) ${at(0.90, 'front')}\n  arrière : haut du dos(1.35) ${at(1.35, 'back')} | dos(1.27) ${at(1.27, 'back')} | lombaires(1.05) ${at(1.05, 'back')} | sacrum(0.95) ${at(0.95, 'back')} | fessier(0.90, x=.08) ${gAt(0.90)}`;
}
