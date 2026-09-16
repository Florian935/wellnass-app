// surfacenets.mjs — extraction de surface « naive surface nets » sur grille régulière.
// Un sommet par cellule traversée (moyenne des intersections d'arêtes), un quad par arête traversée.
// Produit un maillage fermé, continu, aux triangles réguliers ; normales = gradient du SDF.

export function extract(body, { h, min, max, weld }) {
  const nx = Math.ceil((max[0] - min[0]) / h), ny = Math.ceil((max[1] - min[1]) / h), nz = Math.ceil((max[2] - min[2]) / h);
  const NX = nx + 1, NY = ny + 1, NZ = nz + 1;
  const d = new Float32Array(NX * NY * NZ);
  const id = (i, j, k) => (i * NY + j) * NZ + k;
  const t0 = Date.now();
  for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) for (let k = 0; k < NZ; k++) {
    d[id(i, j, k)] = body.dist(min[0] + i * h, min[1] + j * h, min[2] + k * h);
  }
  const tSample = Date.now() - t0;

  // sommets : un par cellule avec changement de signe
  const cellVert = new Int32Array(nx * ny * nz).fill(-1);
  const cid = (i, j, k) => (i * ny + j) * nz + k;
  const pos = [];
  const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float64Array(8);
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { cv[c] = d[id(i + CORNERS[c][0], j + CORNERS[c][1], k + CORNERS[c][2])]; if (cv[c] < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of EDGES) {
      if ((cv[a] < 0) === (cv[b] < 0)) continue;
      const t = cv[a] / (cv[a] - cv[b]);
      const A = CORNERS[a], B = CORNERS[b];
      sx += A[0] + (B[0] - A[0]) * t; sy += A[1] + (B[1] - A[1]) * t; sz += A[2] + (B[2] - A[2]) * t; n++;
    }
    cellVert[cid(i, j, k)] = pos.length / 3;
    pos.push(min[0] + (i + sx / n) * h, min[1] + (j + sy / n) * h, min[2] + (k + sz / n) * h);
  }

  // quads : un par arête de grille traversée (3 orientations)
  const tris = [];
  const V = pos.length / 3;
  const quad = (v0, v1, v2, v3, nxs, nys, nzs) => {
    if (v0 < 0 || v1 < 0 || v2 < 0 || v3 < 0) return;
    // orientation : normale du quad (diagonales) alignée avec la direction intérieur→extérieur de l'arête
    const ax = pos[3 * v2] - pos[3 * v0], ay = pos[3 * v2 + 1] - pos[3 * v0 + 1], az = pos[3 * v2 + 2] - pos[3 * v0 + 2];
    const bx = pos[3 * v3] - pos[3 * v1], by = pos[3 * v3 + 1] - pos[3 * v1 + 1], bz = pos[3 * v3 + 2] - pos[3 * v1 + 2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    let a = v0, b = v1, c = v2, dd = v3;
    if (cx * nxs + cy * nys + cz * nzs < 0) { b = v3; dd = v1; }
    // découpe selon la diagonale la plus courte
    const l02 = ax * ax + ay * ay + az * az, l13 = bx * bx + by * by + bz * bz;
    if (l02 <= l13) { tris.push(a, b, c, a, c, dd); } else { tris.push(a, b, dd, b, c, dd); }
  };
  for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) for (let k = 0; k < NZ; k++) {
    const v = d[id(i, j, k)];
    if (i < nx && j > 0 && k > 0 && j < ny && k < nz) { const w = d[id(i + 1, j, k)]; if ((v < 0) !== (w < 0)) {
      const s = v < 0 ? 1 : -1;
      quad(cellVert[cid(i, j - 1, k - 1)], cellVert[cid(i, j, k - 1)], cellVert[cid(i, j, k)], cellVert[cid(i, j - 1, k)], s, 0, 0);
    } }
    if (j < ny && i > 0 && k > 0 && i < nx && k < nz) { const w = d[id(i, j + 1, k)]; if ((v < 0) !== (w < 0)) {
      const s = v < 0 ? 1 : -1;
      quad(cellVert[cid(i - 1, j, k - 1)], cellVert[cid(i, j, k - 1)], cellVert[cid(i, j, k)], cellVert[cid(i - 1, j, k)], 0, s, 0);
    } }
    if (k < nz && i > 0 && j > 0 && i < nx && j < ny) { const w = d[id(i, j, k + 1)]; if ((v < 0) !== (w < 0)) {
      const s = v < 0 ? 1 : -1;
      quad(cellVert[cid(i - 1, j - 1, k)], cellVert[cid(i, j - 1, k)], cellVert[cid(i, j, k)], cellVert[cid(i - 1, j, k)], 0, 0, s);
    } }
  }
  // soudure des sommets quasi confondus (les surface nets en produisent quand deux cellules voisines
  // placent leur sommet au même endroit) : sans cela, des triangles de 0,1 mm d'arête ont une
  // orientation numériquement instable et « se retournent » au moindre morph
  const weldEps = weld ?? h * 0.15;
  const { positions, indices, merged, dropped } = weldVertices(pos, tris, weldEps);
  const VV = positions.length / 3;
  // normales : gradient du SDF
  const normals = new Float32Array(VV * 3);
  for (let v = 0; v < VV; v++) {
    const g = body.gradient(positions[3 * v], positions[3 * v + 1], positions[3 * v + 2]);
    normals[3 * v] = g[0]; normals[3 * v + 1] = g[1]; normals[3 * v + 2] = g[2];
  }
  return { positions, normals, indices, grid: { nx, ny, nz, h, samples: d.length, tSample, rawVertices: V, merged, dropped } };
}

/** Fusionne les sommets distants de moins de eps (hachage spatial), supprime les triangles dégénérés. */
export function weldVertices(pos, tris, eps) {
  const V = pos.length / 3;
  const remap = new Int32Array(V).fill(-1);
  const cells = new Map();
  const key = (i, j, k) => `${i},${j},${k}`;
  const outPos = [];
  let merged = 0;
  for (let v = 0; v < V; v++) {
    const x = pos[3 * v], y = pos[3 * v + 1], z = pos[3 * v + 2];
    const ci = Math.floor(x / eps), cj = Math.floor(y / eps), ck = Math.floor(z / eps);
    let found = -1;
    for (let di = -1; di <= 1 && found < 0; di++) for (let dj = -1; dj <= 1 && found < 0; dj++) for (let dk = -1; dk <= 1 && found < 0; dk++) {
      const lst = cells.get(key(ci + di, cj + dj, ck + dk));
      if (!lst) continue;
      for (const u of lst) {
        if (Math.hypot(outPos[3 * u] - x, outPos[3 * u + 1] - y, outPos[3 * u + 2] - z) < eps) { found = u; break; }
      }
    }
    if (found >= 0) { remap[v] = found; merged++; continue; }
    const nu = outPos.length / 3;
    outPos.push(x, y, z);
    remap[v] = nu;
    const k = key(ci, cj, ck);
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(nu);
  }
  const outTris = [];
  let dropped = 0;
  for (let t = 0; t < tris.length; t += 3) {
    const a = remap[tris[t]], b = remap[tris[t + 1]], c = remap[tris[t + 2]];
    if (a === b || b === c || a === c) { dropped++; continue; }
    outTris.push(a, b, c);
  }
  return { positions: new Float32Array(outPos), indices: Uint32Array.from(outTris), merged, dropped };
}
