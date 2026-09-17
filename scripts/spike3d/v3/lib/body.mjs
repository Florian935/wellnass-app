// body.mjs (v3) — l'anatomie : un homme athlétique de 1,80 m, debout, de face (+z), pieds à y = 0.
// v3 = « figurine de myologie » : chaque groupe musculaire est un volume convexe qui dépasse du
// cœur osseux de 2–3 cm, fusionné avec un k FAIBLE (0,012–0,02) pour garder une arête à chaque
// rencontre, et les séparations principales sont CREUSÉES par des sillons (capsules soustraites)
// le long des lignes d'insertion — comme les interstices clairs de la planche 2D de l'app.
// Repères verticaux (m) : menton 1.56, acromion 1.475, mamelon 1.31, nombril 1.08, entrejambe 0.835,
// genou 0.50, cheville 0.075. Tête = 0.24 m → 7,5 têtes.
import { Body, along } from './sdf.mjs';

// repères d'articulations (côté +x ; le côté −x est obtenu par miroir)
export const J = {
  shoulder: [0.205, 1.425, -0.005], elbow: [0.247, 1.155, -0.008], wrist: [0.268, 0.905, 0.012],
  hip: [0.095, 0.86, 0.0], knee: [0.098, 0.50, 0.005], ankle: [0.10, 0.075, -0.012],
};

export function buildBody() {
  const B = new Body();
  const M = { mirror: true };
  const S = J.shoulder, E = J.elbow, W = J.wrist;
  const Hj = J.hip, K = J.knee, An = J.ankle;
  const arm = (t, off) => along(S, E, t, off);      // point du bras (monde) : t le long humérus, off monde
  const fore = (t, off) => along(E, W, t, off);
  const thigh = (t, off) => along(Hj, K, t, off);
  const shank = (t, off) => along(K, An, t, off);

  // ───────────────────────────── tête & cou ─────────────────────────────
  B.ellipsoid([0, 1.70, -0.006], [0.078, 0.10, 0.093], { group: 'head', k: 0.02, name: 'crâne' });
  B.ellipsoid([0, 1.612, 0.02], [0.062, 0.056, 0.076], { group: 'head', k: 0.025, name: 'mâchoire' });
  B.ellipsoid([0, 1.65, 0.094], [0.014, 0.024, 0.02], { group: 'head', k: 0.012, name: 'nez' });
  B.ellipsoid([0.076, 1.66, -0.012], [0.008, 0.024, 0.016], { group: 'head', k: 0.012, name: 'oreille', ...M });
  B.cone([0, 1.465, -0.012], [0, 1.578, 0.004], 0.06, 0.05, { group: 'neck', k: 0.03, name: 'cou' });
  B.cone([0.022, 1.478, 0.05], [0.05, 1.575, -0.02], 0.013, 0.01, { group: 'neck', k: 0.014, name: 'scm', ...M });

  // ───────────────────────────── tronc : cœur ─────────────────────────────
  const T = { group: 'torso' };
  B.ellipsoid([0, 1.25, -0.012], [0.146, 0.17, 0.094], { ...T, k: 0.03, name: 'cage thoracique' });
  B.ellipsoid([0, 1.385, -0.012], [0.135, 0.07, 0.072], { ...T, k: 0.04, name: 'ceinture scapulaire' });
  B.ellipsoid([0, 1.09, -0.015], [0.108, 0.13, 0.078], { ...T, k: 0.03, name: 'taille' });
  // trapèzes supérieurs : du cou vers l'acromion, descendants
  B.ellipsoid([0.10, 1.468, -0.03], [0.10, 0.036, 0.05], { ...T, k: 0.025, rot: [0, 0, -16], name: 'trapèze sup', ...M });
  // pectoraux : en éventail du sternum vers l'aisselle, épais, bord externe relevé et enroulé vers l'arrière
  B.ellipsoid([0.087, 1.298, 0.072], [0.09, 0.07, 0.042], { ...T, k: 0.018, rot: [0, 10, 8], name: 'pectoral', ...M });
  B.ellipsoid([0.085, 1.356, 0.058], [0.088, 0.03, 0.028], { ...T, k: 0.02, rot: [0, 16, 10], name: 'pectoral claviculaire', ...M });
  // abdominaux : 3 paires de blocs + paire basse ; sillons transverses par fusion faible + creusés
  for (const [y, ry] of [[1.212, 0.033], [1.147, 0.031], [1.083, 0.03]]) {
    B.ellipsoid([0.038, y, 0.07], [0.034, ry, 0.03], { ...T, k: 0.012, name: 'abdo', ...M });
  }
  B.ellipsoid([0.04, 1.015, 0.06], [0.042, 0.036, 0.028], { ...T, k: 0.014, name: 'abdo bas', ...M });
  B.ellipsoid([0, 0.985, 0.05], [0.095, 0.07, 0.034], { ...T, k: 0.03, name: 'bas-ventre' });
  // obliques : galbe des flancs, plaqués sur la taille, séparés du droit par la ligne semi-lunaire
  B.ellipsoid([0.106, 1.07, 0.008], [0.04, 0.10, 0.072], { ...T, k: 0.02, rot: [0, 0, -8], name: 'oblique', ...M });
  // dos : grands dorsaux en V, trapèze moyen (losange), infra-épineux, grand rond, érecteurs
  B.ellipsoid([0.108, 1.20, -0.074], [0.064, 0.15, 0.036], { ...T, k: 0.02, rot: [0, 0, -20], name: 'grand dorsal', ...M });
  B.ellipsoid([0, 1.355, -0.096], [0.10, 0.105, 0.026], { ...T, k: 0.025, name: 'trapèze moyen' });
  B.ellipsoid([0.112, 1.352, -0.086], [0.05, 0.05, 0.026], { ...T, k: 0.018, name: 'infra-épineux', ...M });
  B.ellipsoid([0.16, 1.315, -0.07], [0.03, 0.028, 0.026], { ...T, k: 0.016, rot: [0, 0, 30], name: 'grand rond', ...M });
  B.ellipsoid([0.03, 1.07, -0.086], [0.03, 0.12, 0.03], { ...T, k: 0.02, name: 'érecteur', ...M });

  // ───────────────────────────── bassin ─────────────────────────────
  const P = { group: 'pelvis' };
  B.ellipsoid([0, 0.93, -0.012], [0.152, 0.10, 0.09], { ...P, k: 0.03, name: 'bassin' });
  B.ellipsoid([0, 1.0, -0.075], [0.11, 0.06, 0.04], { ...P, k: 0.035, name: 'bas du dos' });
  B.ellipsoid([0.08, 0.905, -0.062], [0.082, 0.09, 0.062], { ...P, k: 0.02, rot: [0, -15, 0], name: 'grand glutéal', ...M });
  B.ellipsoid([0.14, 0.945, -0.02], [0.03, 0.05, 0.05], { ...P, k: 0.025, name: 'moyen glutéal', ...M });

  // ───────────────────────────── épaules & bras ─────────────────────────────
  // deltoïde : calotte ronde sur l'épaule + pointe en V descendant sur la face latérale du bras
  B.ellipsoid([0.214, 1.412, -0.004], [0.06, 0.07, 0.066], { group: 'shoulder', k: 0.018, name: 'deltoïde', ...M });
  B.ellipsoid(arm(0.22, [0.03, 0, -0.002]), [0.032, 0.062, 0.042], { group: 'shoulder', k: 0.018, name: 'deltoïde pointe', ...M });
  const A = { group: 'arm', mirror: true };
  B.cone(S, E, 0.042, 0.034, { ...A, k: 0.02, name: 'humérus' });
  B.muscle(S, E, 0.52, [-0.004, 0, 0.02], [0.034, 0.088, 0.036], { ...A, k: 0.014, name: 'biceps' });
  B.muscle(S, E, 0.48, [0.012, 0, -0.024], [0.038, 0.105, 0.036], { ...A, k: 0.014, name: 'triceps' });
  B.muscle(S, E, 0.72, [0.022, 0, 0.004], [0.018, 0.05, 0.026], { ...A, k: 0.014, name: 'brachial' });
  B.ellipsoid(E, [0.036, 0.04, 0.034], { ...A, k: 0.02, name: 'coude' });
  B.cone(E, W, 0.034, 0.024, { ...A, k: 0.02, name: 'avant-bras' });
  B.muscle(E, W, 0.3, [0.006, 0, 0.014], [0.038, 0.08, 0.04], { ...A, k: 0.014, name: 'fléchisseurs' });
  B.muscle(E, W, 0.22, [0.024, 0, -0.002], [0.026, 0.085, 0.03], { ...A, k: 0.014, name: 'brachio-radial' });
  B.muscle(E, W, 0.35, [0.012, 0, -0.024], [0.026, 0.09, 0.024], { ...A, k: 0.014, name: 'extenseurs' });
  B.ellipsoid(W, [0.02, 0.028, 0.03], { ...A, k: 0.018, name: 'poignet' });
  // main : paume plate (face vers la cuisse), 4 doigts serrés vers le bas, légèrement fléchis, pouce vers l'avant
  const Hd = { group: 'hand', mirror: true };
  const palm = [W[0] + 0.002, W[1] - 0.062, W[2] + 0.014];
  B.ellipsoid(palm, [0.016, 0.06, 0.044], { ...Hd, k: 0.014, name: 'paume' });
  const fingers = [[-0.031, 0.066], [-0.0105, 0.08], [0.0105, 0.086], [0.031, 0.078]]; // [z rel., longueur] : auriculaire → index
  for (const [dz, L] of fingers) {
    const y0 = palm[1] - 0.046, z = palm[2] + dz;
    B.cone([palm[0], y0, z], [palm[0] - 0.014, y0 - L, z + 0.006], 0.0112, 0.0095, { ...Hd, k: 0.011, name: 'doigt' });
  }
  B.cone([palm[0] + 0.002, W[1] - 0.045, palm[2] + 0.04], [palm[0] - 0.004, W[1] - 0.112, palm[2] + 0.08], 0.012, 0.0095, { ...Hd, k: 0.011, name: 'pouce' });

  // ───────────────────────────── jambes ─────────────────────────────
  const L = { group: 'leg', mirror: true };
  B.cone(Hj, K, 0.084, 0.058, { ...L, k: 0.025, name: 'fémur' });
  // quadriceps : trois chefs visibles, chacun son volume
  B.muscle(Hj, K, 0.46, [0.0, 0, 0.038], [0.04, 0.15, 0.032], { ...L, k: 0.014, name: 'droit fémoral' });
  B.muscle(Hj, K, 0.52, [0.046, 0, 0.008], [0.036, 0.14, 0.052], { ...L, k: 0.014, name: 'vaste externe' });
  B.muscle(Hj, K, 0.68, [-0.036, 0, 0.026], [0.034, 0.10, 0.038], { ...L, k: 0.014, name: 'vaste interne' });
  // ischio-jambiers : deux chefs (biceps fémoral latéral, semi-tendineux/membraneux médial)
  B.muscle(Hj, K, 0.46, [0.028, 0, -0.042], [0.032, 0.15, 0.034], { ...L, k: 0.014, name: 'biceps fémoral' });
  B.muscle(Hj, K, 0.48, [-0.024, 0, -0.042], [0.03, 0.15, 0.034], { ...L, k: 0.014, name: 'semi-tendineux' });
  B.muscle(Hj, K, 0.30, [-0.044, 0, -0.002], [0.03, 0.12, 0.05], { ...L, k: 0.02, name: 'adducteurs' });
  B.ellipsoid(K, [0.052, 0.05, 0.048], { ...L, k: 0.02, name: 'genou' });
  B.ellipsoid([K[0], K[1] + 0.01, K[2] + 0.046], [0.024, 0.03, 0.014], { ...L, k: 0.016, name: 'rotule' });
  B.cone(K, An, 0.046, 0.03, { ...L, k: 0.02, name: 'tibia' });
  // mollets : deux chefs du gastrocnémien, soléaire dessous, tibial antérieur devant
  B.muscle(K, An, 0.27, [-0.014, 0, -0.03], [0.036, 0.095, 0.046], { ...L, k: 0.012, name: 'gastrocnémien médial' });
  B.muscle(K, An, 0.245, [0.02, 0, -0.024], [0.03, 0.085, 0.04], { ...L, k: 0.012, name: 'gastrocnémien latéral' });
  B.muscle(K, An, 0.55, [0, 0, -0.014], [0.034, 0.11, 0.03], { ...L, k: 0.014, name: 'soléaire' });
  B.muscle(K, An, 0.36, [0.014, 0, 0.022], [0.022, 0.12, 0.022], { ...L, k: 0.014, name: 'tibial antérieur' });
  B.ellipsoid(An, [0.03, 0.035, 0.032], { ...L, k: 0.02, name: 'cheville' });
  B.ellipsoid([An[0] + 0.03, An[1] - 0.002, An[2]], [0.011, 0.018, 0.016], { ...L, k: 0.012, name: 'malléole ext' });
  B.ellipsoid([An[0] - 0.03, An[1] + 0.004, An[2]], [0.011, 0.018, 0.016], { ...L, k: 0.012, name: 'malléole int' });
  // pied : talon, corps, cou-de-pied, orteils ; la plante est aplatie par le sol (y ≥ 0)
  const F = { group: 'foot', mirror: true };
  B.ellipsoid([0.10, 0.03, -0.055], [0.034, 0.03, 0.04], { ...F, k: 0.018, name: 'talon' });
  B.cone([0.10, 0.04, -0.04], [0.106, 0.026, 0.12], 0.04, 0.03, { ...F, k: 0.018, name: 'pied' });
  B.ellipsoid([0.10, 0.045, 0.03], [0.036, 0.04, 0.07], { ...F, k: 0.018, name: 'cou-de-pied' });
  B.ellipsoid([0.108, 0.017, 0.152], [0.047, 0.016, 0.038], { ...F, k: 0.014, name: 'orteils' });

  // ═════════════════════════════ SILLONS (soustractions) ═════════════════════════════
  // Chaque sillon suit une ligne d'insertion réelle. Les points sont PROJETÉS sur la peau par groove(),
  // par lancer de rayon selon dir (la face d'où on regarde le sillon) : seul le tracé compte.
  // width = largeur du creux, depth = sa profondeur (m). k = douceur des bords. Trois calibres :
  const MAJ = { width: 0.026, depth: 0.005, k: 0.009 };  // séparations principales (deltoïde/pectoral, chefs du mollet…)
  const MIN = { width: 0.02, depth: 0.0035, k: 0.01 };   // séparations secondaires
  const FIN = { width: 0.018, depth: 0.003, k: 0.01 };   // lignes fines (sartorius, clavicule)
  const LIN = { width: 0.016, depth: 0.004, k: 0.009 };  // lignes médianes (sternum, ligne blanche, sillon spinal)
  const FRONT = [0, 0, 1], BACK = [0, 0, -1], LAT = [1, 0, 0], MED = [-1, 0, 0];
  const G = (name, pts, cal, dir) => B.groove(pts, { ...cal, dir, name: 'sillon ' + name, ...M });
  const Gc = (name, pts, cal, dir) => B.groove(pts, { ...cal, dir, name: 'sillon ' + name }); // central (sans miroir)
  // tronc, face
  Gc('sternum', [[0, 1.235, 0.11], [0, 1.30, 0.114], [0, 1.372, 0.096]], LIN, FRONT);
  Gc('ligne blanche', [[0, 1.03, 0.10], [0, 1.15, 0.11], [0, 1.238, 0.11]], LIN, FRONT);
  for (const y of [1.18, 1.115, 1.052]) G('abdo transverse', [[0.006, y, 0.10], [0.07, y + 0.004, 0.096]], MIN, FRONT);
  G('semi-lunaire', [[0.075, 1.245, 0.085], [0.076, 1.17, 0.093], [0.076, 1.10, 0.09], [0.078, 1.02, 0.078]], MIN, FRONT);
  G('bord pectoral', [[0.02, 1.228, 0.11], [0.10, 1.226, 0.104], [0.16, 1.248, 0.08]], MIN, [0.2, -0.4, 1]);
  G('deltopectoral', [[0.13, 1.41, 0.05], [0.185, 1.352, 0.06], [0.232, 1.31, 0.036]], MAJ, [0.6, 0.3, 1]);
  G('clavicule', [[0.03, 1.418, 0.075], [0.08, 1.428, 0.066], [0.118, 1.436, 0.052]], FIN, [0, 0.4, 1]);
  // épaule / bras
  G('deltoïde post', [[0.14, 1.412, -0.066], [0.20, 1.36, -0.06], [0.236, 1.315, -0.034]], MAJ, [0.6, 0.3, -1]);
  G('bras latéral', [arm(0.34, [0.052, 0, 0.0]), arm(0.55, [0.052, 0, -0.004]), arm(0.80, [0.048, 0, -0.008])], MAJ, LAT);
  G('bras médial', [arm(0.40, [-0.046, 0, 0.004]), arm(0.75, [-0.044, 0, -0.002])], MIN, MED);
  G('avant-bras', [fore(0.15, [0.024, 0, 0.02]), fore(0.5, [0.03, 0, 0.012]), fore(0.85, [0.026, 0, 0.006])], MIN, [1, 0, 0.4]);
  // dos
  Gc('sillon spinal', [[0, 1.0, -0.122], [0, 1.20, -0.124], [0, 1.44, -0.118]], LIN, BACK);
  G('bord dorsal', [[0.165, 1.325, -0.075], [0.12, 1.24, -0.098], [0.062, 1.12, -0.108], [0.04, 1.05, -0.108]], MAJ, BACK);
  G('bord trapèze', [[0.15, 1.435, -0.062], [0.10, 1.35, -0.10], [0.05, 1.27, -0.112], [0.02, 1.20, -0.116]], MIN, BACK);
  G('infra/dorsal', [[0.08, 1.30, -0.108], [0.125, 1.305, -0.098], [0.155, 1.315, -0.085]], MIN, BACK);
  // bassin
  Gc('pli interglutéal', [[0, 0.82, -0.135], [0, 0.95, -0.125]], { width: 0.014, depth: 0.005, k: 0.01 }, BACK);
  G('pli glutéal', [[0.028, 0.826, -0.105], [0.09, 0.822, -0.10], [0.15, 0.835, -0.075]], MAJ, [0, -0.3, -1]);
  G('glutéal/moyen', [[0.105, 0.985, -0.075], [0.14, 0.945, -0.06], [0.16, 0.90, -0.04]], MIN, [1, 0, -0.6]);
  // cuisse
  G('droit/vaste ext', [thigh(0.12, [0.03, 0, 0.05]), thigh(0.5, [0.034, 0, 0.056]), thigh(0.86, [0.03, 0, 0.05])], MAJ, [0.5, 0, 1]);
  G('droit/vaste int', [thigh(0.42, [-0.028, 0, 0.056]), thigh(0.7, [-0.032, 0, 0.056]), thigh(0.9, [-0.03, 0, 0.05])], MIN, [-0.3, 0, 1]);
  G('sartorius', [thigh(0.06, [0.05, 0, 0.05]), thigh(0.4, [-0.006, 0, 0.062]), thigh(0.8, [-0.05, 0, 0.04])], FIN, FRONT);
  G('bande ilio-tibiale', [thigh(0.2, [0.078, 0, -0.016]), thigh(0.55, [0.076, 0, -0.018]), thigh(0.86, [0.066, 0, -0.016])], MIN, LAT);
  G('ischio', [thigh(0.18, [0.004, 0, -0.07]), thigh(0.55, [0.002, 0, -0.072]), thigh(0.86, [0.0, 0, -0.06])], MAJ, BACK);
  G('ischio/adducteurs', [thigh(0.25, [-0.05, 0, -0.045]), thigh(0.7, [-0.05, 0, -0.04])], MIN, [-0.7, 0, -0.7]);
  // jambe
  G('gastrocnémiens', [shank(0.06, [0.002, 0, -0.06]), shank(0.3, [0.002, 0, -0.07]), shank(0.5, [0.0, 0, -0.056])], MAJ, BACK);
  G('gastroc/soléaire', [shank(0.5, [-0.04, 0, -0.03]), shank(0.46, [0.0, 0, -0.052]), shank(0.5, [0.04, 0, -0.026])], MIN, BACK);
  G('crête tibiale', [shank(0.12, [-0.006, 0, 0.05]), shank(0.5, [-0.008, 0, 0.042]), shank(0.9, [-0.01, 0, 0.032])], MIN, [-0.3, 0, 1]);
  G('tibial/péroniers', [shank(0.15, [0.04, 0, 0.026]), shank(0.6, [0.036, 0, 0.018])], FIN, [0.8, 0, 0.6]);

  return B;
}

export const GRID = { min: [-0.36, -0.012, -0.20], max: [0.36, 1.83, 0.25] };
