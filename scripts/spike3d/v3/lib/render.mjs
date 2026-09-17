// render.mjs — rastériseur logiciel (sans GPU) : caméra perspective, z-buffer, ombrage par pixel
// (normales interpolées), 3 lumières proches de celles du moteur de l'app. Sortie PNG via pngjs.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('C:/wellness-app/package.json');
const { PNG } = require('pngjs');

const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Normales lisses recalculées depuis les triangles (pour juger la forme déformée). */
export function computeNormals(positions, indices) {
  const n = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const i = indices[t], j = indices[t + 1], k = indices[t + 2];
    const a = [positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]];
    const b = [positions[3 * j], positions[3 * j + 1], positions[3 * j + 2]];
    const c = [positions[3 * k], positions[3 * k + 1], positions[3 * k + 2]];
    const fn = cross(sub(b, a), sub(c, a));
    for (const v of [i, j, k]) { n[3 * v] += fn[0]; n[3 * v + 1] += fn[1]; n[3 * v + 2] += fn[2]; }
  }
  for (let v = 0; v < n.length; v += 3) { const l = Math.hypot(n[v], n[v + 1], n[v + 2]) || 1; n[v] /= l; n[v + 1] /= l; n[v + 2] /= l; }
  return n;
}

/**
 * Rend un maillage. opts : { width, height, yaw (deg, 0 = de face), pitch (deg), fov, target [x,y,z],
 * distance, color [r,g,b], wire: bool, flatNormals: bool, background }
 */
export function render(mesh, opts = {}) {
  const W = opts.width ?? 420, H = opts.height ?? 800;
  const yaw = (opts.yaw ?? 0) * Math.PI / 180, pitch = (opts.pitch ?? 0) * Math.PI / 180;
  const fov = (opts.fov ?? 28) * Math.PI / 180;
  const target = opts.target ?? [0, 0.9, 0];
  const dist = opts.distance ?? 4.2;
  // caméra orbitale : position = target + R·(0,0,dist)
  const cx = Math.sin(yaw) * Math.cos(pitch) * dist, cy = Math.sin(pitch) * dist, cz = Math.cos(yaw) * Math.cos(pitch) * dist;
  const eye = [target[0] + cx, target[1] + cy, target[2] + cz];
  const f = norm(sub(target, eye));              // forward
  const r = norm(cross(f, [0, 1, 0]));           // right
  const u = cross(r, f);                         // up
  const focal = (H / 2) / Math.tan(fov / 2);
  const P = mesh.positions, N = mesh.normals ?? computeNormals(mesh.positions, mesh.indices), I = mesh.indices;
  const V = P.length / 3;
  const sx = new Float32Array(V), sy = new Float32Array(V), sz = new Float32Array(V);
  for (let v = 0; v < V; v++) {
    const p = sub([P[3 * v], P[3 * v + 1], P[3 * v + 2]], eye);
    const x = dot(p, r), y = dot(p, u), z = dot(p, f);
    sx[v] = W / 2 + focal * x / z; sy[v] = H / 2 - focal * y / z; sz[v] = z;
  }
  const zbuf = new Float32Array(W * H).fill(Infinity);
  const img = new Float32Array(W * H * 3);
  const bg = opts.background ?? [0.93, 0.92, 0.90];
  for (let i = 0; i < W * H; i++) { img[3 * i] = bg[0]; img[3 * i + 1] = bg[1]; img[3 * i + 2] = bg[2]; }
  const baseColor = opts.color ?? [0.91, 0.80, 0.71];
  // lumières (direction VERS la lumière, monde) — clé chaude en haut à gauche devant, contre-jours
  // lumières exprimées dans le repère caméra (x = droite, y = haut, z = vers l'observateur) puis
  // ramenées au monde : la clé reste en haut à gauche devant l'observateur, quel que soit le point de vue.
  const toWorld = (v) => norm([r[0] * v[0] + u[0] * v[1] - f[0] * v[2], r[1] * v[0] + u[1] * v[1] - f[1] * v[2], r[2] * v[0] + u[2] * v[1] - f[2] * v[2]]);
  const lights = (opts.lights ?? [
    { dir: [-2.4, 6, 4], color: [1.0, 0.95, 0.88], I: 1.2 },
    { dir: [6, 3, -6], color: [0.6, 0.72, 1.0], I: 0.5 },
    { dir: [-6, 2.5, -4], color: [1.0, 0.62, 0.72], I: 0.35 },
  ]).map((L) => ({ ...L, dir: toWorld(L.dir) }));
  const hemiSky = [1.0, 0.96, 0.90], hemiGround = [0.16, 0.11, 0.08], hemiI = 0.35;
  const viewDir = [-f[0], -f[1], -f[2]];
  const flat = !!opts.flatNormals;
  const tri = [0, 0, 0];
  for (let t = 0; t < I.length; t += 3) {
    tri[0] = I[t]; tri[1] = I[t + 1]; tri[2] = I[t + 2];
    const [a, b, c] = tri;
    if (sz[a] <= 0.01 || sz[b] <= 0.01 || sz[c] <= 0.01) continue;
    // culling des faces arrière (aire signée à l'écran) — y écran vers le bas donc signe inversé
    const area = (sx[b] - sx[a]) * (sy[c] - sy[a]) - (sx[c] - sx[a]) * (sy[b] - sy[a]);
    if (area >= 0) { if (!opts.showBackfaces) continue; }
    let fn = null;
    if (flat) {
      const A = [P[3 * a], P[3 * a + 1], P[3 * a + 2]], B = [P[3 * b], P[3 * b + 1], P[3 * b + 2]], C = [P[3 * c], P[3 * c + 1], P[3 * c + 2]];
      fn = norm(cross(sub(B, A), sub(C, A)));
    }
    const minX = Math.max(0, Math.floor(Math.min(sx[a], sx[b], sx[c]))), maxX = Math.min(W - 1, Math.ceil(Math.max(sx[a], sx[b], sx[c])));
    const minY = Math.max(0, Math.floor(Math.min(sy[a], sy[b], sy[c]))), maxY = Math.min(H - 1, Math.ceil(Math.max(sy[a], sy[b], sy[c])));
    const invArea = 1 / area;
    for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
      const x = px + 0.5, y = py + 0.5;
      let w0 = ((sx[b] - x) * (sy[c] - y) - (sx[c] - x) * (sy[b] - y)) * invArea;
      let w1 = ((sx[c] - x) * (sy[a] - y) - (sx[a] - x) * (sy[c] - y)) * invArea;
      let w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      // interpolation correcte en perspective
      const iz = w0 / sz[a] + w1 / sz[b] + w2 / sz[c];
      const z = 1 / iz;
      const idx = py * W + px;
      if (z >= zbuf[idx]) continue;
      zbuf[idx] = z;
      const q0 = w0 / sz[a] * z, q1 = w1 / sz[b] * z, q2 = w2 / sz[c] * z;
      let nx, ny, nz;
      if (flat) { [nx, ny, nz] = fn; } else {
        nx = q0 * N[3 * a] + q1 * N[3 * b] + q2 * N[3 * c];
        ny = q0 * N[3 * a + 1] + q1 * N[3 * b + 1] + q2 * N[3 * c + 1];
        nz = q0 * N[3 * a + 2] + q1 * N[3 * b + 2] + q2 * N[3 * c + 2];
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      }
      const n = [nx, ny, nz];
      // hémisphérique
      const hk = 0.5 + 0.5 * ny;
      let cr = baseColor[0] * hemiI * (hemiSky[0] * hk + hemiGround[0] * (1 - hk));
      let cg = baseColor[1] * hemiI * (hemiSky[1] * hk + hemiGround[1] * (1 - hk));
      let cb = baseColor[2] * hemiI * (hemiSky[2] * hk + hemiGround[2] * (1 - hk));
      for (const L of lights) {
        const nl = Math.max(0, dot(n, L.dir));
        if (nl <= 0) continue;
        const hv = norm([L.dir[0] + viewDir[0], L.dir[1] + viewDir[1], L.dir[2] + viewDir[2]]);
        const spec = Math.pow(Math.max(0, dot(n, hv)), 24) * 0.12;
        cr += L.I * (baseColor[0] * nl + spec) * L.color[0];
        cg += L.I * (baseColor[1] * nl + spec) * L.color[1];
        cb += L.I * (baseColor[2] * nl + spec) * L.color[2];
      }
      img[3 * idx] = cr; img[3 * idx + 1] = cg; img[3 * idx + 2] = cb;
    }
  }
  // fil de fer optionnel (arêtes) par-dessus
  if (opts.wire) {
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], b = I[t + 1], c = I[t + 2];
      const area = (sx[b] - sx[a]) * (sy[c] - sy[a]) - (sx[c] - sx[a]) * (sy[b] - sy[a]);
      if (area >= 0) continue;
      for (const [p, q] of [[a, b], [b, c], [c, a]]) line(sx[p], sy[p], sz[p], sx[q], sy[q], sz[q]);
    }
  }
  function line(x0, y0, z0, x1, y1, z1) {
    const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
    for (let s = 0; s <= steps; s++) {
      const t = steps ? s / steps : 0;
      const px = Math.round(x0 + (x1 - x0) * t), py = Math.round(y0 + (y1 - y0) * t);
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const idx = py * W + px;
      const z = z0 + (z1 - z0) * t;
      if (z > zbuf[idx] + 0.004) continue;
      img[3 * idx] = 0.15; img[3 * idx + 1] = 0.12; img[3 * idx + 2] = 0.10;
    }
  }
  // tonemap + gamma
  const png = new PNG({ width: W, height: H });
  for (let i = 0; i < W * H; i++) {
    for (let q = 0; q < 3; q++) {
      let v = img[3 * i + q];
      v = v / (1 + v * 0.15);
      png.data[4 * i + q] = Math.max(0, Math.min(255, Math.round(Math.pow(v, 1 / 2.2) * 255)));
    }
    png.data[4 * i + 3] = 255;
  }
  return png;
}

export function savePng(png, file) {
  fs.mkdirSync(require('node:path').dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(png));
  return file;
}

/** Assemble plusieurs PNG côte à côte (même hauteur) avec un libellé « pixel-art » simple. */
export function sheet(pngs, labels = [], gap = 6) {
  const H = Math.max(...pngs.map((p) => p.height));
  const W = pngs.reduce((s, p) => s + p.width, 0) + gap * (pngs.length - 1);
  const out = new PNG({ width: W, height: H });
  out.data.fill(255);
  let x0 = 0;
  pngs.forEach((p, i) => {
    for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
      const s = 4 * (y * p.width + x), d = 4 * (y * W + x0 + x);
      out.data[d] = p.data[s]; out.data[d + 1] = p.data[s + 1]; out.data[d + 2] = p.data[s + 2]; out.data[d + 3] = 255;
    }
    if (labels[i]) drawText(out, x0 + 6, 6, labels[i]);
    x0 += p.width + gap;
  });
  return out;
}

// police 3×5 minimaliste pour les libellés (majuscules, chiffres, quelques signes)
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101011001', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101011', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
  '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001001001001', '8': '111101111101111', '9': '111101111001111',
  '-': '000000111000000', '+': '000010111010000', '.': '000000000000010', ' ': '000000000000000', '_': '000000000000111', '/': '001001010100100',
  '=': '000111000111000', '(': '010100100100010', ')': '010001001001010', ',': '000000000010100', ':': '000010000010000',
};
export function drawText(png, x0, y0, text, scale = 3) {
  const W = png.width;
  let x = x0;
  for (const ch of text.toUpperCase()) {
    const g = FONT[ch] ?? FONT[' '];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
      const on = g[r * 3 + c] === '1';
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const px = x + c * scale + dx, py = y0 + r * scale + dy;
        if (px < 0 || py < 0 || px >= W || py >= png.height) continue;
        const i = 4 * (py * W + px);
        if (on) { png.data[i] = 40; png.data[i + 1] = 30; png.data[i + 2] = 25; }
      }
    }
    x += 4 * scale;
  }
}
