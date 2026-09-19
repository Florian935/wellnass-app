/**
 * Spike VBT-01 — suivre un point clair sur une image, en JavaScript pur.
 * Réf. : docs/specs/technical/spike-vbt01-vitesse-barre.md §5
 *
 * ── Pourquoi ce module existe ─────────────────────────────────────────────────────────────────
 * La moitié « calcul » du spike ([bar-velocity](./bar-velocity.ts)) a montré que **le facteur
 * limitant n'est pas la cadence mais la précision du suivi** : à ±3 px tout tient, à ±8 px la mesure
 * s'effondre. Le suivi est donc la pièce qu'il faut pouvoir **tester sans téléphone** — sans quoi
 * chaque essai en salle mélangerait un défaut d'algorithme et un défaut de prise de vue.
 *
 * ── Ce que ça évite ───────────────────────────────────────────────────────────────────────────
 * VisionCamera 5 donne accès aux pixels depuis un worklet JS (`frame.getPlanes()[0].getPixelBuffer()`),
 * donc **aucun module natif à écrire** : ni OpenCV, ni ML Kit, ni plugin Expo maison. C'est la
 * différence entre un essai de deux jours et un chantier de deux semaines.
 *
 * ⚠️ Fonctions **compatibles worklet** : pas de fermeture sur l'extérieur, pas d'allocation inutile,
 * aucune dépendance. La directive `'worklet'` est posée par l'appelant, côté app.
 */

/**
 * Un plan de luminance (le plan Y d'une image YUV), tel que la caméra le rend.
 *
 * `bytesPerRow` n'est **pas** `width` : les caméras alignent leurs lignes sur 16, 32 ou 64 octets,
 * et lire l'image comme un rectangle compact décale progressivement chaque ligne — l'image paraît
 * cisaillée et le point suivi dérive. C'est l'erreur classique de ce genre de code.
 */
export type LumaPlane = {
  data: Uint8Array;
  width: number;
  height: number;
  bytesPerRow: number;
};

/** Zone de recherche, en fractions de l'image (0 → 1). */
export type TrackRegion = { x: number; y: number; width: number; height: number };

export type TrackOptions = {
  /** Luminance minimale (0-255) pour qu'un pixel compte comme « la pastille ». */
  threshold: number;
  /** Pas d'échantillonnage : 1 = tous les pixels, 4 = un sur 4 en x et en y. */
  step?: number;
  /** Restreint la recherche à une portion de l'image. */
  region?: TrackRegion;
  /** Dernière position connue : la recherche s'y accroche (voir `searchRadius`). */
  previous?: { x: number; y: number } | null;
  /** Rayon de recherche autour de `previous`, en pixels. */
  searchRadius?: number;
  /** En dessous de ce nombre de pixels retenus, on déclare le point perdu. */
  minPixels?: number;
};

export type TrackResult = {
  /** Position en pixels, **sous-pixellique** : c'est elle qui décide de la précision. */
  x: number;
  y: number;
  /** Nombre de pixels retenus — sert à juger la solidité de la détection. */
  pixels: number;
};

/** Valeurs par défaut : un réglage de départ, à réétalonner sur des images réelles. */
export const TRACK_DEFAULT_STEP = 2;
export const TRACK_DEFAULT_MIN_PIXELS = 12;
export const TRACK_DEFAULT_SEARCH_RADIUS = 120;

/**
 * Centre de gravité des pixels clairs — la position de la pastille.
 *
 * 🔴 **Pondéré par la luminance**, et pas un simple centre de la zone claire : la pondération donne
 * une position **sous-pixellique**, et c'est exactement ce qui sépare un suivi à ±1 px d'un suivi à
 * ±5 px. Le banc de mesure de `bar-velocity` a chiffré ce que coûte l'imprécision : à ±8 px, l'écart
 * de vitesse maximal passe de 0,056 à 0,437 m/s.
 *
 * 🔴 **Accroché à la position précédente** quand elle est fournie : un plafond de salle est plein de
 * néons plus brillants que n'importe quelle pastille. Sans cet accrochage, le suivi saute sur la
 * lampe à la première image où la barre passe devant une zone sombre — et la trajectoire obtenue
 * reste parfaitement lisse, donc indétectable en aval.
 *
 * Rend `null` quand rien de convaincant n'est trouvé : c'est un **trou de suivi**, que
 * `analyseSet` sait traiter (interpolation courte ou coupure), pas une erreur.
 */
export function trackBrightPoint(plane: LumaPlane, options: TrackOptions): TrackResult | null {
  'worklet';

  const step = options.step ?? TRACK_DEFAULT_STEP;
  const minPixels = options.minPixels ?? TRACK_DEFAULT_MIN_PIXELS;
  const threshold = options.threshold;

  // Fenêtre de recherche : la région demandée, resserrée autour du point précédent s'il existe.
  let left = 0;
  let top = 0;
  let right = plane.width;
  let bottom = plane.height;

  const region = options.region;
  if (region !== undefined) {
    left = Math.max(0, Math.floor(region.x * plane.width));
    top = Math.max(0, Math.floor(region.y * plane.height));
    right = Math.min(plane.width, Math.ceil((region.x + region.width) * plane.width));
    bottom = Math.min(plane.height, Math.ceil((region.y + region.height) * plane.height));
  }

  const previous = options.previous;
  if (previous !== undefined && previous !== null) {
    const radius = options.searchRadius ?? TRACK_DEFAULT_SEARCH_RADIUS;
    left = Math.max(left, Math.floor(previous.x - radius));
    top = Math.max(top, Math.floor(previous.y - radius));
    right = Math.min(right, Math.ceil(previous.x + radius));
    bottom = Math.min(bottom, Math.ceil(previous.y + radius));
  }

  let sumWeight = 0;
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (let y = top; y < bottom; y += step) {
    const rowStart = y * plane.bytesPerRow;
    for (let x = left; x < right; x += step) {
      const luma = plane.data[rowStart + x] ?? 0;
      if (luma < threshold) continue;
      // Le poids est l'excédent au-dessus du seuil : les pixels de bordure, à moitié dans la tache,
      // pèsent donc moins que son cœur. C'est ce qui donne la précision sous-pixellique.
      const weight = luma - threshold + 1;
      sumWeight += weight;
      sumX += x * weight;
      sumY += y * weight;
      count += 1;
    }
  }

  if (count < minPixels || sumWeight <= 0) return null;

  return { x: sumX / sumWeight, y: sumY / sumWeight, pixels: count };
}

/**
 * Seuil de luminance conseillé pour une image donnée : rien d'autre qu'un point de départ.
 *
 * On prend la luminance maximale observée et on en garde une fraction haute. Un seuil **fixe** ne
 * survit pas au passage d'une salle éclairée au néon à un garage : c'est le premier réglage que
 * l'essai device devra confirmer ou remplacer.
 */
export function suggestThreshold(plane: LumaPlane, share = 0.8, step = 8): number {
  'worklet';

  let max = 0;
  for (let y = 0; y < plane.height; y += step) {
    const rowStart = y * plane.bytesPerRow;
    for (let x = 0; x < plane.width; x += step) {
      const luma = plane.data[rowStart + x] ?? 0;
      if (luma > max) max = luma;
    }
  }
  // Jamais en dessous de 60 : sur une image très sombre, la fraction du maximum retiendrait le bruit.
  return Math.max(60, Math.round(max * share));
}
