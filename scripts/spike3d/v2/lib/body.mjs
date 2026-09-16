// body.mjs — l'anatomie : un homme athlétique de 1,80 m, debout, de face (+z), pieds à y = 0.
// Chaque groupe musculaire est un volume (ellipsoïde) posé sur un « os » (cône arrondi), fusionné
// en lisse. Les repères verticaux (m) : menton 1.56, acromion 1.475, mamelon 1.31, nombril 1.08,
// entrejambe 0.835, genou 0.50, cheville 0.075. Tête = 0.24 m → 7,5 têtes.
import { Body } from './sdf.mjs';

// repères d'articulations (côté +x ; le côté −x est obtenu par miroir)
export const J = {
  shoulder: [0.205, 1.425, -0.005], elbow: [0.247, 1.155, -0.008], wrist: [0.268, 0.905, 0.012],
  hip: [0.095, 0.86, 0.0], knee: [0.098, 0.50, 0.005], ankle: [0.10, 0.075, -0.012],
};

export function buildBody() {
  const B = new Body();
  const M = { mirror: true };

  // ───────────────────────────── tête & cou ─────────────────────────────
  B.ellipsoid([0, 1.70, -0.006], [0.078, 0.10, 0.093], { group: 'head', k: 0.02, name: 'crâne' });
  B.ellipsoid([0, 1.612, 0.02], [0.062, 0.056, 0.076], { group: 'head', k: 0.025, name: 'mâchoire' });
  B.ellipsoid([0, 1.65, 0.094], [0.014, 0.024, 0.02], { group: 'head', k: 0.012, name: 'nez' });
  B.ellipsoid([0.076, 1.66, -0.012], [0.008, 0.024, 0.016], { group: 'head', k: 0.012, name: 'oreille', ...M });
  B.cone([0, 1.465, -0.012], [0, 1.578, 0.004], 0.062, 0.052, { group: 'neck', k: 0.03, name: 'cou' });
  B.cone([0.02, 1.48, 0.05], [0.05, 1.575, -0.02], 0.012, 0.01, { group: 'neck', k: 0.018, name: 'scm', ...M });

  // ───────────────────────────── tronc ─────────────────────────────
  const T = { group: 'torso' };
  B.ellipsoid([0, 1.25, -0.012], [0.155, 0.175, 0.105], { ...T, k: 0.035, name: 'cage thoracique' });
  B.ellipsoid([0, 1.385, -0.012], [0.14, 0.075, 0.078], { ...T, k: 0.05, name: 'ceinture scapulaire' });
  B.ellipsoid([0, 1.09, -0.015], [0.118, 0.13, 0.085], { ...T, k: 0.035, name: 'taille' });
  // trapèzes supérieurs : du cou vers l'acromion, descendants
  B.ellipsoid([0.10, 1.47, -0.028], [0.10, 0.036, 0.052], { ...T, k: 0.05, rot: [0, 0, -16], name: 'trapèze sup', ...M });
  // pectoraux : en éventail du sternum vers l'aisselle, bord externe relevé et enroulé vers l'arrière
  B.ellipsoid([0.088, 1.30, 0.07], [0.088, 0.066, 0.036], { ...T, k: 0.035, rot: [0, 11, 8], name: 'pectoral', ...M });
  B.ellipsoid([0.085, 1.352, 0.056], [0.09, 0.03, 0.026], { ...T, k: 0.05, rot: [0, 16, 10], name: 'pectoral claviculaire', ...M });
  // abdominaux : 3 paires de blocs + paire basse ; sillons par fusion faible
  for (const [y, ry] of [[1.212, 0.033], [1.147, 0.031], [1.083, 0.03]]) {
    B.ellipsoid([0.038, y, 0.07], [0.034, ry, 0.028], { ...T, k: 0.016, name: 'abdo', ...M });
  }
  B.ellipsoid([0.04, 1.015, 0.06], [0.042, 0.036, 0.026], { ...T, k: 0.02, name: 'abdo bas', ...M });
  B.ellipsoid([0, 0.985, 0.05], [0.095, 0.07, 0.035], { ...T, k: 0.03, name: 'bas-ventre' });
  B.cone([0, 1.04, 0.108], [0, 1.255, 0.118], 0.007, 0.007, { ...T, k: 0.014, op: 'sub', name: 'ligne blanche' });
  // obliques : galbe des flancs, plaqués sur la taille
  B.ellipsoid([0.108, 1.07, 0.01], [0.042, 0.10, 0.075], { ...T, k: 0.04, rot: [0, 0, -8], name: 'oblique', ...M });
  // dos : grands dorsaux en V (haut vers l'aisselle, bas vers la colonne), trapèzes moyens, érecteurs
  B.ellipsoid([0.11, 1.20, -0.072], [0.06, 0.15, 0.034], { ...T, k: 0.035, rot: [0, 0, -20], name: 'grand dorsal', ...M });
  B.ellipsoid([0, 1.36, -0.095], [0.10, 0.10, 0.026], { ...T, k: 0.035, name: 'trapèze moyen' });
  B.ellipsoid([0.112, 1.355, -0.086], [0.05, 0.052, 0.024], { ...T, k: 0.03, name: 'infra-épineux', ...M });
  B.ellipsoid([0.03, 1.07, -0.086], [0.03, 0.12, 0.028], { ...T, k: 0.03, name: 'érecteur', ...M });
  B.cone([0, 1.0, -0.122], [0, 1.44, -0.118], 0.006, 0.006, { ...T, k: 0.012, op: 'sub', name: 'sillon spinal' });

  // ───────────────────────────── bassin ─────────────────────────────
  const P = { group: 'pelvis' };
  B.ellipsoid([0, 0.93, -0.012], [0.16, 0.10, 0.095], { ...P, k: 0.035, name: 'bassin' });
  B.ellipsoid([0, 1.0, -0.075], [0.11, 0.06, 0.04], { ...P, k: 0.04, name: 'bas du dos' });
  B.ellipsoid([0.08, 0.905, -0.062], [0.082, 0.088, 0.06], { ...P, k: 0.04, rot: [0, -15, 0], name: 'grand glutéal', ...M });
  B.cone([0, 0.82, -0.135], [0, 0.95, -0.125], 0.006, 0.006, { ...P, k: 0.012, op: 'sub', name: 'pli interglutéal' });

  // ───────────────────────────── épaules & bras ─────────────────────────────
  const S = J.shoulder, E = J.elbow, W = J.wrist;
  B.ellipsoid([0.214, 1.41, -0.004], [0.062, 0.072, 0.066], { group: 'shoulder', k: 0.04, name: 'deltoïde', ...M });
  const A = { group: 'arm', mirror: true };
  B.cone(S, E, 0.046, 0.038, { ...A, k: 0.025, name: 'humérus' });
  B.muscle(S, E, 0.53, [-0.004, 0, 0.018], [0.036, 0.085, 0.034], { ...A, k: 0.025, name: 'biceps' });
  B.muscle(S, E, 0.45, [0.012, 0, -0.02], [0.038, 0.10, 0.036], { ...A, k: 0.025, name: 'triceps' });
  B.ellipsoid(E, [0.038, 0.04, 0.036], { ...A, k: 0.025, name: 'coude' });
  B.cone(E, W, 0.038, 0.026, { ...A, k: 0.025, name: 'avant-bras' });
  B.muscle(E, W, 0.3, [0.008, 0, 0.012], [0.04, 0.078, 0.042], { ...A, k: 0.025, name: 'fléchisseurs' });
  B.muscle(E, W, 0.22, [0.022, 0, -0.004], [0.026, 0.08, 0.03], { ...A, k: 0.022, name: 'brachio-radial' });
  B.ellipsoid(W, [0.02, 0.028, 0.03], { ...A, k: 0.02, name: 'poignet' });
  // main : paume plate (face vers la cuisse), 4 doigts serrés vers le bas, légèrement fléchis, pouce vers l'avant
  const Hd = { group: 'hand', mirror: true };
  const palm = [W[0] + 0.002, W[1] - 0.062, W[2] + 0.014];
  B.ellipsoid(palm, [0.016, 0.06, 0.044], { ...Hd, k: 0.014, name: 'paume' });
  const fingers = [[-0.032, 0.068], [-0.0107, 0.082], [0.0107, 0.088], [0.032, 0.080]]; // [z rel., longueur] : auriculaire → index
  for (const [dz, L] of fingers) {
    const y0 = palm[1] - 0.048, z = palm[2] + dz;
    B.cone([palm[0], y0, z], [palm[0] - 0.014, y0 - L, z + 0.006], 0.0105, 0.009, { ...Hd, k: 0.01, name: 'doigt' });
  }
  B.cone([palm[0] + 0.002, W[1] - 0.045, palm[2] + 0.04], [palm[0] - 0.004, W[1] - 0.112, palm[2] + 0.08], 0.0115, 0.009, { ...Hd, k: 0.01, name: 'pouce' });

  // ───────────────────────────── jambes ─────────────────────────────
  const Hj = J.hip, K = J.knee, An = J.ankle;
  const L = { group: 'leg', mirror: true };
  B.cone(Hj, K, 0.088, 0.062, { ...L, k: 0.03, name: 'fémur' });
  B.muscle(Hj, K, 0.42, [0, 0, 0.036], [0.042, 0.15, 0.03], { ...L, k: 0.03, name: 'droit fémoral' });
  B.muscle(Hj, K, 0.5, [0.042, 0, 0.012], [0.036, 0.14, 0.052], { ...L, k: 0.03, name: 'vaste externe' });
  B.muscle(Hj, K, 0.8, [-0.034, 0, 0.024], [0.034, 0.06, 0.038], { ...L, k: 0.025, name: 'vaste interne' });
  B.muscle(Hj, K, 0.45, [0.0, 0, -0.038], [0.055, 0.15, 0.034], { ...L, k: 0.03, name: 'ischio-jambiers' });
  B.muscle(Hj, K, 0.22, [-0.04, 0, 0.0], [0.03, 0.09, 0.05], { ...L, k: 0.03, name: 'adducteurs' });
  B.ellipsoid(K, [0.054, 0.05, 0.05], { ...L, k: 0.025, name: 'genou' });
  B.ellipsoid([K[0], K[1] + 0.01, K[2] + 0.046], [0.024, 0.03, 0.014], { ...L, k: 0.018, name: 'rotule' });
  B.cone(K, An, 0.05, 0.032, { ...L, k: 0.025, name: 'tibia' });
  B.muscle(K, An, 0.27, [-0.012, 0, -0.026], [0.038, 0.095, 0.046], { ...L, k: 0.025, name: 'gastrocnémien médial' });
  B.muscle(K, An, 0.24, [0.017, 0, -0.02], [0.032, 0.085, 0.04], { ...L, k: 0.025, name: 'gastrocnémien latéral' });
  B.muscle(K, An, 0.52, [0, 0, -0.012], [0.036, 0.11, 0.03], { ...L, k: 0.025, name: 'soléaire' });
  B.muscle(K, An, 0.35, [0.012, 0, 0.02], [0.024, 0.12, 0.022], { ...L, k: 0.025, name: 'tibial antérieur' });
  B.ellipsoid(An, [0.03, 0.035, 0.032], { ...L, k: 0.02, name: 'cheville' });
  B.ellipsoid([An[0] + 0.03, An[1] - 0.002, An[2]], [0.011, 0.018, 0.016], { ...L, k: 0.012, name: 'malléole ext' });
  B.ellipsoid([An[0] - 0.03, An[1] + 0.004, An[2]], [0.011, 0.018, 0.016], { ...L, k: 0.012, name: 'malléole int' });
  // pied : talon, corps, cou-de-pied, orteils ; la plante est aplatie par le sol (y ≥ 0)
  const F = { group: 'foot', mirror: true };
  B.ellipsoid([0.10, 0.03, -0.055], [0.034, 0.03, 0.04], { ...F, k: 0.018, name: 'talon' });
  B.cone([0.10, 0.04, -0.04], [0.106, 0.026, 0.12], 0.04, 0.03, { ...F, k: 0.018, name: 'pied' });
  B.ellipsoid([0.10, 0.045, 0.03], [0.036, 0.04, 0.07], { ...F, k: 0.018, name: 'cou-de-pied' });
  B.ellipsoid([0.108, 0.017, 0.152], [0.047, 0.016, 0.038], { ...F, k: 0.014, name: 'orteils' });

  return B;
}

export const GRID = { min: [-0.36, -0.012, -0.20], max: [0.36, 1.83, 0.25] };
