// body.mjs (v4) — l'anatomie : un homme athlétique SEC de 1,80 m, debout, de face (+z), pieds à y = 0.
//
// v4 INVERSE l'approche de la v3. La v3 posait chaque muscle comme un ellipsoïde qui dépassait de la peau
// de 2–3 cm avec une fusion faible : de face les sillons se lisaient, de profil ces volumes devenaient des
// boules collées sur le corps (pectoraux, abdos, deltoïdes, fessiers). Ici :
//   1. on construit D'ABORD une ENVELOPPE corporelle lisse et juste (grands volumes, fusion large k ≥ 0,03) :
//      c'est elle, et elle seule, qui fait la silhouette et le profil ;
//   2. les ventres musculaires sont des ellipsoïdes TANGENTS À LA PEAU (Body.belly) : leur relief visible
//      n'est que le congé de la fusion, ≈ k/4, soit 3 à 5 mm — juste de quoi attraper la lumière ;
//   3. la lisibilité vient des SILLONS creusés le long des lignes d'insertion (repris de la v3, affinés).
// Repères verticaux (m) : menton 1.56, acromion 1.475, mamelon 1.31, nombril 1.08, entrejambe 0.835,
// genou 0.50, cheville 0.075. Tête = 0.24 m → 7,5 têtes.
import { Body, along } from './sdf.mjs';

// repères d'articulations (côté +x ; le côté −x est obtenu par miroir)
export const J = {
  shoulder: [0.204, 1.425, -0.005], elbow: [0.247, 1.155, -0.008], wrist: [0.268, 0.905, 0.012],
  hip: [0.095, 0.86, 0.0], knee: [0.098, 0.50, 0.005], ankle: [0.10, 0.075, -0.012],
};

// paramètres de relief des ventres (k de fusion → relief ≈ k/4)
export const RELIEF = { major: 0.02, medium: 0.016, minor: 0.012 }; // ≈ 5 mm, 4 mm, 3 mm

export function buildBody() {
  const B = new Body();
  const M = { mirror: true };
  const S = J.shoulder, E = J.elbow, W = J.wrist;
  const Hj = J.hip, K = J.knee, An = J.ankle;
  const arm = (t, off) => along(S, E, t, off);
  const fore = (t, off) => along(E, W, t, off);
  const thigh = (t, off) => along(Hj, K, t, off);
  const shank = (t, off) => along(K, An, t, off);
  const FRONT = [0, 0, 1], BACK = [0, 0, -1], LAT = [1, 0, 0], MED = [-1, 0, 0];

  // ═══════════════════════════ 1. ENVELOPPE (fusion large : la silhouette) ═══════════════════════════
  // ── tête & cou ──
  B.ellipsoid([0, 1.70, -0.006], [0.078, 0.10, 0.093], { group: 'head', k: 0.02, name: 'crâne' });
  B.ellipsoid([0, 1.612, 0.02], [0.062, 0.056, 0.076], { group: 'head', k: 0.025, name: 'mâchoire' });
  B.ellipsoid([0, 1.65, 0.094], [0.014, 0.024, 0.02], { group: 'head', k: 0.012, name: 'nez' });
  B.ellipsoid([0.076, 1.66, -0.012], [0.008, 0.024, 0.016], { group: 'head', k: 0.012, name: 'oreille', ...M });
  B.cone([0, 1.465, -0.012], [0, 1.578, 0.004], 0.06, 0.05, { group: 'neck', k: 0.03, name: 'cou' });
  B.cone([0.022, 1.478, 0.05], [0.05, 1.575, -0.02], 0.012, 0.009, { group: 'neck', k: 0.018, name: 'scm', ...M });

  // ── tronc ── : cage, ceinture scapulaire, taille, bas-ventre, flancs, dorsaux en V, bassin, lombaires, fessiers.
  // Profil visé (x = 0) : poitrine +0,10 (1.30) → abdomen +0,078 quasi plat → pubis +0,075 ;
  // dos : cyphose −0,112 (1.27) → lordose −0,093 (1.05) → fessiers −0,13 (0.90).
  const T = { group: 'torso' };
  B.ellipsoid([0, 1.265, -0.008], [0.152, 0.175, 0.102], { ...T, k: 0.04, name: 'cage thoracique' });
  B.ellipsoid([0, 1.395, -0.02], [0.155, 0.065, 0.078], { ...T, k: 0.045, name: 'ceinture scapulaire' });
  B.ellipsoid([0.10, 1.462, -0.028], [0.105, 0.034, 0.05], { ...T, k: 0.04, rot: [0, 0, -15], name: 'trapèze sup', ...M });
  B.ellipsoid([0, 1.09, -0.008], [0.122, 0.135, 0.085], { ...T, k: 0.05, name: 'taille' });
  B.ellipsoid([0, 0.985, 0.02], [0.10, 0.075, 0.06], { ...T, k: 0.04, name: 'bas-ventre' });
  B.ellipsoid([0.10, 1.08, 0.0], [0.042, 0.11, 0.072], { ...T, k: 0.035, rot: [0, 0, -6], name: 'oblique', ...M });
  B.ellipsoid([0.105, 1.235, -0.055], [0.07, 0.14, 0.048], { ...T, k: 0.035, rot: [0, 0, -18], name: 'grand dorsal', ...M });
  const P = { group: 'pelvis' };
  B.ellipsoid([0, 0.925, -0.015], [0.148, 0.10, 0.09], { ...P, k: 0.045, name: 'bassin' });
  B.ellipsoid([0, 1.0, -0.065], [0.11, 0.06, 0.03], { ...P, k: 0.045, name: 'bas du dos' });
  B.ellipsoid([0.08, 0.90, -0.065], [0.082, 0.09, 0.062], { ...P, k: 0.035, rot: [0, -12, 0], name: 'grand glutéal', ...M });

  // ── épaule & bras ── : le deltoïde est un CAPUCHON allongé le long de l'humérus (pas une sphère), fondu
  // large dans la ceinture et le trapèze : il prolonge la ligne de l'épaule vers le bras.
  B.muscle(S, E, 0.13, [0.008, 0, 0], [0.045, 0.085, 0.052], { group: 'shoulder', k: 0.03, name: 'deltoïde', ...M });
  const A = { group: 'arm', mirror: true };
  B.cone(S, E, 0.048, 0.037, { ...A, k: 0.03, name: 'humérus' });
  B.ellipsoid(E, [0.037, 0.04, 0.036], { ...A, k: 0.03, name: 'coude' });
  // avant-bras : cône qui s'effile régulièrement + masse des fléchisseurs/extenseurs JUSTE SOUS LE COUDE,
  // décalée vers l'avant-dehors (brachio-radial) : une direction, pas un renflement symétrique
  B.cone(E, W, 0.040, 0.026, { ...A, k: 0.03, name: 'avant-bras' });
  B.muscle(E, W, 0.27, [0.004, 0, 0.006], [0.045, 0.10, 0.045], { ...A, k: 0.035, name: 'masse avant-bras' });
  B.ellipsoid(W, [0.02, 0.028, 0.03], { ...A, k: 0.02, name: 'poignet' });
  // main : paume plate (face vers la cuisse), 4 doigts serrés vers le bas, pouce vers l'avant
  const Hd = { group: 'hand', mirror: true };
  const palm = [W[0] + 0.002, W[1] - 0.062, W[2] + 0.014];
  B.ellipsoid(palm, [0.016, 0.06, 0.044], { ...Hd, k: 0.014, name: 'paume' });
  const fingers = [[-0.031, 0.066], [-0.0105, 0.08], [0.0105, 0.086], [0.031, 0.078]];
  for (const [dz, L] of fingers) {
    const y0 = palm[1] - 0.046, z = palm[2] + dz;
    B.cone([palm[0], y0, z], [palm[0] - 0.014, y0 - L, z + 0.006], 0.0112, 0.0095, { ...Hd, k: 0.011, name: 'doigt' });
  }
  B.cone([palm[0] + 0.002, W[1] - 0.045, palm[2] + 0.04], [palm[0] - 0.004, W[1] - 0.112, palm[2] + 0.08], 0.012, 0.0095, { ...Hd, k: 0.011, name: 'pouce' });

  // ── jambes ── : fémur (cône plein), genou, tibia + masse du mollet POSTÉRIEURE (la vraie forme du mollet)
  const L = { group: 'leg', mirror: true };
  B.cone(Hj, K, 0.088, 0.062, { ...L, k: 0.03, name: 'fémur' });
  B.ellipsoid(K, [0.052, 0.05, 0.048], { ...L, k: 0.03, name: 'genou' });
  B.cone(K, An, 0.048, 0.031, { ...L, k: 0.03, name: 'tibia' });
  B.muscle(K, An, 0.27, [-0.004, 0, -0.008], [0.048, 0.11, 0.046], { ...L, k: 0.035, name: 'mollet' });
  B.ellipsoid(An, [0.03, 0.035, 0.032], { ...L, k: 0.02, name: 'cheville' });
  B.ellipsoid([An[0] + 0.03, An[1] - 0.002, An[2]], [0.011, 0.018, 0.016], { ...L, k: 0.012, name: 'malléole ext' });
  B.ellipsoid([An[0] - 0.03, An[1] + 0.004, An[2]], [0.011, 0.018, 0.016], { ...L, k: 0.012, name: 'malléole int' });
  const F = { group: 'foot', mirror: true };
  B.ellipsoid([0.10, 0.03, -0.055], [0.034, 0.03, 0.04], { ...F, k: 0.018, name: 'talon' });
  B.cone([0.10, 0.04, -0.04], [0.106, 0.026, 0.12], 0.04, 0.03, { ...F, k: 0.018, name: 'pied' });
  B.ellipsoid([0.10, 0.045, 0.03], [0.036, 0.04, 0.07], { ...F, k: 0.018, name: 'cou-de-pied' });
  B.ellipsoid([0.108, 0.017, 0.152], [0.047, 0.016, 0.038], { ...F, k: 0.014, name: 'orteils' });

  // ═══════════════════ 2. VENTRES TANGENTS (relief ≈ k/4 : 3 à 5 mm, jamais la silhouette) ═══════════════════
  const { major, medium, minor } = RELIEF;
  // tronc, face : plaques pectorales inclinées suivant la cage (bord inférieur net = sillon), abdos en 4 paires
  B.belly([0.082, 1.30, 0.06], [0.076, 0.062, 0.034], [0.15, -0.15, 1], { ...T, k: 0.024, rot: [0, 8, 6], name: 'pectoral', ...M });
  B.belly([0.078, 1.362, 0.05], [0.075, 0.026, 0.022], [0.1, 0.25, 1], { ...T, k: 0.014, rot: [0, 12, 8], name: 'pectoral claviculaire', ...M });
  for (const [y, ry] of [[1.212, 0.031], [1.147, 0.03], [1.083, 0.029]]) {
    B.belly([0.036, y, 0.07], [0.031, ry, 0.02], FRONT, { ...T, k: minor, name: 'abdo', ...M });
  }
  B.belly([0.03, 1.015, 0.06], [0.03, 0.034, 0.02], [0, -0.15, 1], { ...T, k: minor, name: 'abdo bas', ...M });
  // dos : trapèze moyen (losange), infra-épineux, grand rond, érecteurs (de part et d'autre du sillon spinal)
  B.belly([0, 1.355, -0.10], [0.095, 0.10, 0.025], BACK, { ...T, k: medium, name: 'trapèze moyen' });
  B.belly([0.11, 1.35, -0.09], [0.048, 0.048, 0.022], BACK, { ...T, k: 0.014, name: 'infra-épineux', ...M });
  B.belly([0.155, 1.315, -0.07], [0.028, 0.026, 0.02], [0.5, 0, -1], { ...T, k: minor, rot: [0, 0, 30], name: 'grand rond', ...M });
  B.belly([0.03, 1.07, -0.09], [0.028, 0.12, 0.022], BACK, { ...T, k: 0.014, name: 'érecteur', ...M });
  // bassin : moyen glutéal (hanche latérale)
  B.belly([0.15, 0.945, -0.02], [0.03, 0.05, 0.05], [1, 0.2, -0.3], { ...P, k: medium, name: 'moyen glutéal', ...M });
  // bras : biceps (avant, un peu médial), triceps (arrière), brachial (latéral bas) ; avant-bras : 3 loges
  B.bellyAlong(S, E, 0.55, [-0.004, 0, 0], [0.03, 0.085, 0.03], [-0.25, 0, 1], { ...A, k: major, name: 'biceps' });
  B.bellyAlong(S, E, 0.50, [0.006, 0, 0], [0.034, 0.10, 0.03], [0.3, 0, -1], { ...A, k: major, name: 'triceps' });
  B.bellyAlong(S, E, 0.72, [0, 0, 0], [0.016, 0.05, 0.02], [1, 0, 0.3], { ...A, k: minor, name: 'brachial' });
  B.bellyAlong(E, W, 0.35, [-0.006, 0, 0], [0.03, 0.09, 0.03], [-0.3, 0, 1], { ...A, k: medium, name: 'fléchisseurs' });
  B.bellyAlong(E, W, 0.22, [0, 0, 0], [0.022, 0.09, 0.024], [0.8, 0, 0.6], { ...A, k: medium, name: 'brachio-radial' });
  B.bellyAlong(E, W, 0.35, [0, 0, 0], [0.024, 0.09, 0.022], [0.6, 0, -0.8], { ...A, k: 0.014, name: 'extenseurs' });
  // cuisse : 3 chefs du quadriceps, 2 ischio-jambiers, adducteurs, rotule
  B.bellyAlong(Hj, K, 0.46, [0, 0, 0], [0.036, 0.15, 0.028], FRONT, { ...L, k: major, name: 'droit fémoral' });
  B.bellyAlong(Hj, K, 0.52, [0, 0, 0], [0.034, 0.14, 0.045], [1, 0, 0.25], { ...L, k: major, name: 'vaste externe' });
  B.bellyAlong(Hj, K, 0.70, [0, 0, 0], [0.032, 0.10, 0.034], [-0.7, 0, 0.7], { ...L, k: major, name: 'vaste interne' });
  B.bellyAlong(Hj, K, 0.46, [0, 0, 0], [0.03, 0.15, 0.03], [0.5, 0, -1], { ...L, k: major, name: 'biceps fémoral' });
  B.bellyAlong(Hj, K, 0.48, [0, 0, 0], [0.03, 0.15, 0.03], [-0.4, 0, -1], { ...L, k: major, name: 'semi-tendineux' });
  B.bellyAlong(Hj, K, 0.30, [0, 0, 0], [0.03, 0.12, 0.045], MED, { ...L, k: 0.025, name: 'adducteurs' });
  B.belly([K[0], K[1] + 0.01, K[2] + 0.03], [0.022, 0.028, 0.012], FRONT, { ...L, k: minor, name: 'rotule' });
  // jambe : 2 chefs du gastrocnémien, soléaire, tibial antérieur
  B.bellyAlong(K, An, 0.29, [-0.018, 0, 0], [0.034, 0.10, 0.032], [-0.3, 0, -1], { ...L, k: 0.014, relief: 0.009, name: 'gastrocnémien médial' });
  B.bellyAlong(K, An, 0.24, [0.022, 0, 0], [0.03, 0.085, 0.03], [0.35, 0, -1], { ...L, k: 0.014, relief: 0.008, name: 'gastrocnémien latéral' });
  B.bellyAlong(K, An, 0.55, [0, 0, 0], [0.03, 0.10, 0.026], BACK, { ...L, k: 0.014, name: 'soléaire' });
  B.bellyAlong(K, An, 0.36, [0.012, 0, 0], [0.02, 0.12, 0.02], [0.4, 0, 1], { ...L, k: minor, name: 'tibial antérieur' });

  // ═══════════════════════════ 3. SILLONS (soustractions) — la lisibilité ═══════════════════════════
  // Chaque sillon suit une ligne d'insertion réelle ; les points sont PROJETÉS sur la peau par lancer de rayon
  // selon dir (la face d'où on regarde le sillon). width = largeur du creux, depth = profondeur (m).
  const MAJ = { width: 0.026, depth: 0.005, k: 0.009 };  // séparations principales
  const MIN = { width: 0.02, depth: 0.0035, k: 0.01 };   // séparations secondaires
  const FIN = { width: 0.018, depth: 0.003, k: 0.01 };   // lignes fines
  const LIN = { width: 0.016, depth: 0.004, k: 0.009 };  // lignes médianes (sternum, ligne blanche, sillon spinal)
  const FSC = { width: 0.016, depth: 0.0025, k: 0.01 };  // faisceaux (deltoïde), très discret
  const DEL = { width: 0.024, depth: 0.004, k: 0.01 };   // bords du deltoïde (sur une enveloppe lisse, MAJ creusait trop)
  const G = (name, pts, cal, dir) => B.groove(pts, { ...cal, dir, name: 'sillon ' + name, ...M });
  const Gc = (name, pts, cal, dir) => B.groove(pts, { ...cal, dir, name: 'sillon ' + name });
  // tronc, face
  Gc('sternum', [[0, 1.235, 0.11], [0, 1.30, 0.114], [0, 1.372, 0.096]], LIN, FRONT);
  Gc('ligne blanche', [[0, 1.03, 0.10], [0, 1.15, 0.11], [0, 1.238, 0.11]], LIN, FRONT);
  for (const [y, xe] of [[1.18, 0.068], [1.115, 0.066], [1.052, 0.058]]) G('abdo transverse', [[0.006, y, 0.10], [xe, y + 0.004, 0.096]], MIN, FRONT);
  G('semi-lunaire', [[0.072, 1.245, 0.085], [0.074, 1.17, 0.093], [0.072, 1.10, 0.09], [0.058, 1.01, 0.078]], MIN, FRONT);
  G('bord pectoral', [[0.02, 1.23, 0.11], [0.10, 1.228, 0.104], [0.138, 1.248, 0.085]], { width: 0.02, depth: 0.0035, k: 0.012 }, [0.2, -0.4, 1]);
  G('deltopectoral', [[0.128, 1.41, 0.05], [0.182, 1.352, 0.06], [0.227, 1.31, 0.036]], DEL, [0.6, 0.3, 1]);
  G('clavicule', [[0.03, 1.418, 0.075], [0.08, 1.428, 0.066], [0.115, 1.436, 0.052]], FIN, [0, 0.4, 1]);
  // épaule : bord postérieur, et les trois faisceaux du deltoïde (deux lignes très discrètes du sommet vers la pointe)
  G('deltoïde post', [[0.138, 1.412, -0.066], [0.197, 1.36, -0.06], [0.233, 1.315, -0.034]], DEL, [0.6, 0.3, -1]);
  G('deltoïde ant/moyen', [[0.208, 1.458, 0.035], [0.242, 1.40, 0.04], [0.257, 1.335, 0.022]], FSC, [1, 0.2, 0.7]);
  G('deltoïde moyen/post', [[0.208, 1.458, -0.045], [0.242, 1.40, -0.05], [0.257, 1.335, -0.032]], FSC, [1, 0.2, -0.7]);
  // bras
  G('bras latéral', [arm(0.36, [0.052, 0, 0.0]), arm(0.55, [0.052, 0, -0.004]), arm(0.80, [0.048, 0, -0.008])], MAJ, LAT);
  G('bras médial', [arm(0.40, [-0.046, 0, 0.004]), arm(0.75, [-0.044, 0, -0.002])], MIN, MED);
  // avant-bras : fléchisseurs / brachio-radial (avant-dehors) et brachio-radial / extenseurs (dehors-arrière)
  G('avant-bras ant', [fore(0.12, [0.02, 0, 0.03]), fore(0.5, [0.024, 0, 0.022]), fore(0.85, [0.02, 0, 0.014])], MIN, [0.5, 0, 1]);
  G('avant-bras post', [fore(0.15, [0.03, 0, -0.016]), fore(0.55, [0.028, 0, -0.014]), fore(0.85, [0.024, 0, -0.01])], FIN, [1, 0, -0.5]);
  // dos
  Gc('sillon spinal', [[0, 1.0, -0.122], [0, 1.20, -0.124], [0, 1.44, -0.118]], LIN, BACK);
  G('bord dorsal', [[0.16, 1.325, -0.075], [0.118, 1.24, -0.098], [0.062, 1.12, -0.108], [0.04, 1.05, -0.108]], MAJ, BACK);
  G('bord trapèze', [[0.145, 1.435, -0.062], [0.10, 1.35, -0.10], [0.05, 1.27, -0.112], [0.02, 1.20, -0.116]], MIN, BACK);
  G('infra/dorsal', [[0.08, 1.30, -0.108], [0.125, 1.305, -0.098], [0.152, 1.315, -0.085]], MIN, BACK);
  // bassin
  Gc('pli interglutéal', [[0, 0.82, -0.135], [0, 0.95, -0.125]], { width: 0.014, depth: 0.005, k: 0.01 }, BACK);
  G('pli glutéal', [[0.028, 0.826, -0.105], [0.09, 0.822, -0.10], [0.15, 0.835, -0.075]], MAJ, [0, -0.3, -1]);
  G('glutéal/moyen', [[0.105, 0.985, -0.075], [0.14, 0.945, -0.06], [0.16, 0.90, -0.04]], MIN, [1, 0, -0.6]);
  // cuisse
  G('droit/vaste ext', [thigh(0.12, [0.03, 0, 0.05]), thigh(0.5, [0.034, 0, 0.056]), thigh(0.86, [0.03, 0, 0.05])], MAJ, [0.5, 0, 1]);
  G('droit/vaste int', [thigh(0.42, [-0.028, 0, 0.056]), thigh(0.7, [-0.032, 0, 0.056]), thigh(0.9, [-0.03, 0, 0.05])], MIN, [-0.3, 0, 1]);
  G('sartorius', [thigh(0.06, [0.05, 0, 0.05]), thigh(0.4, [-0.006, 0, 0.062]), thigh(0.8, [-0.05, 0, 0.04])], FIN, FRONT);
  G('bande ilio-tibiale', [thigh(0.2, [0.078, 0, -0.016]), thigh(0.55, [0.076, 0, -0.018]), thigh(0.86, [0.066, 0, -0.016])], MIN, LAT);
  G('ischio', [thigh(0.18, [0.004, 0, -0.07]), thigh(0.55, [0.002, 0, -0.072]), thigh(0.80, [0.0, 0, -0.06])], MAJ, BACK);
  G('ischio/adducteurs', [thigh(0.25, [-0.05, 0, -0.045]), thigh(0.7, [-0.05, 0, -0.04])], MIN, [-0.7, 0, -0.7]);
  // jambe
  G('gastrocnémiens', [shank(0.10, [0.002, 0, -0.06]), shank(0.3, [0.002, 0, -0.07]), shank(0.46, [0.0, 0, -0.06])], MAJ, BACK);
  G('gastroc/soléaire', [shank(0.60, [-0.042, 0, -0.024]), shank(0.55, [-0.02, 0, -0.05]), shank(0.46, [0.0, 0, -0.06]), shank(0.47, [0.024, 0, -0.046]), shank(0.52, [0.042, 0, -0.02])], MAJ, BACK);
  G('crête tibiale', [shank(0.12, [-0.006, 0, 0.05]), shank(0.5, [-0.008, 0, 0.042]), shank(0.9, [-0.01, 0, 0.032])], MIN, [-0.3, 0, 1]);
  G('tibial/péroniers', [shank(0.15, [0.04, 0, 0.026]), shank(0.6, [0.036, 0, 0.018])], FIN, [0.8, 0, 0.6]);

  return B;
}

export const GRID = { min: [-0.36, -0.012, -0.20], max: [0.36, 1.83, 0.25] };
