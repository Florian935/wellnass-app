// ctrl.mjs — utilitaires de contrôle partagés par preview.mjs et build.mjs (composantes connexes, vues des gros plans musculaires).
// composantes connexes (union-find) : on veut exactement 1 (pas de doigt détaché, pas de fragment)
export function components(indices, V) {
  const parent = new Int32Array(V); for (let i = 0; i < V; i++) parent[i] = i;
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let t = 0; t < indices.length; t += 3) { const a = find(indices[t]), b = find(indices[t + 1]), c = find(indices[t + 2]); parent[a] = b; parent[find(b)] = find(c); }
  const roots = new Map(); for (let i = 0; i < V; i++) { const r = find(i); roots.set(r, (roots.get(r) ?? 0) + 1); }
  return [...roots.values()].sort((a, b) => b - a);
}
// gros plans musculaires : épaule-bras (3/4 face), dos haut, cuisse (face), mollet (dos)
export const MUSCLE_VIEWS = [
  ['EPAULE BRAS', { yaw: 35, target: [0.2, 1.3, 0], distance: 1.25, fov: 26 }],
  ['DOS', { yaw: 180, target: [0, 1.25, 0], distance: 1.6, fov: 26 }],
  ['CUISSE', { yaw: 15, target: [0.1, 0.66, 0.02], distance: 1.3, fov: 26 }],
  ['MOLLET', { yaw: 200, target: [0.1, 0.32, 0], distance: 1.2, fov: 26 }],
  ['TORSE', { yaw: 0, target: [0, 1.22, 0.04], distance: 1.6, fov: 26 }],
  ['MAIN', { yaw: 60, target: [0.27, 0.8, 0.02], distance: 0.9, fov: 26 }],
];
