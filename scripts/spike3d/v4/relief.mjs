// relief.mjs — MESURE le relief réel de chaque ventre tangent : au point de peau où il a été posé (p.skin),
// on relève la position de la surface le long de la normale avec (a) l'enveloppe seule (unions sans ventres),
// (b) toutes les unions (enveloppe + ventres), (c) le corps complet (avec sillons). relief = b − a, en mm.
import { buildBody } from './lib/body.mjs';
const body = buildBody();
const bellies = body.prims.filter((p) => p.skin && !p.mirrored);
const bellySet = new Set(body.prims.filter((p) => p.skin || (p.mirrored && p.skinOf)));
// distance « enveloppe seule » : on neutralise les ventres (toutes primitives portant skin, + leurs miroirs par nom)
const bellyNames = new Set(bellies.map((p) => p.name));
const distEnv = (x, y, z) => {
  let d = 1e9;
  for (const p of body.prims) {
    if (p.op !== 'union' || bellyNames.has(p.name)) continue;
    const bb = p.bbox, k = p.k;
    const dx = Math.max(bb[0] - x, 0, x - bb[3]), dy = Math.max(bb[1] - y, 0, y - bb[4]), dz = Math.max(bb[2] - z, 0, z - bb[5]);
    if (d < 1e8 && dx * dx + dy * dy + dz * dz > (d + k) * (d + k)) continue;
    const a = d, b = body.primDist(p, x, y, z);
    const h = Math.max(k - Math.abs(a - b), 0) / k; d = Math.min(a, b) - h * h * k * 0.25;
  }
  return Math.max(d, -y);
};
// racine le long du rayon skin + t·dir (t ∈ [−0.03, 0.03]) par bissection
const root = (f, s, d) => {
  let a = -0.03, b = 0.03;
  const fa = f(s[0] + a * d[0], s[1] + a * d[1], s[2] + a * d[2]);
  if (fa > 0) return NaN;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (f(s[0] + m * d[0], s[1] + m * d[1], s[2] + m * d[2]) < 0) a = m; else b = m; }
  return (a + b) / 2;
};
console.log('ventre                    | relief enveloppe→ventres (mm) | avec sillons (mm) | k → k/4 attendu');
let sum = 0, n = 0, maxR = 0;
for (const p of bellies) {
  const s = p.skin, d = p.tangentDir;
  const tEnv = root(distEnv, s, d);
  const tUni = root((x, y, z) => body.dist(x, y, z, true), s, d);
  const tAll = root((x, y, z) => body.dist(x, y, z, false), s, d);
  const r = (tUni - tEnv) * 1000, rAll = (tAll - tEnv) * 1000;
  sum += r; n++; maxR = Math.max(maxR, r);
  console.log(`${p.name.padEnd(25)} | ${r.toFixed(1).padStart(8)}                      | ${rAll.toFixed(1).padStart(8)}          | ${p.k} → ${(p.k / 4 * 1000).toFixed(1)}`);
}
console.log(`\n${n} ventres : relief moyen ${(sum / n).toFixed(1)} mm, max ${maxR.toFixed(1)} mm (v3 : ventres dépassant de 20–30 mm).`);
