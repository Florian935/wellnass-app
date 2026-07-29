/**
 * US PARTAGE-01 — carte de séance / course partageable (roadmap 7.17).
 *
 * Aucune dépendance React ni base : du calcul, testé sous Vitest.
 *
 * ── Pourquoi le tracé est redessiné et non capturé ────────────────────────────────────────────────
 * L'écran de résumé affiche le tracé via `RouteMap`, qui repose sur **MapLibre natif**. Capturer une
 * vue native de carte donne, en pratique, une image **noire ou vide** — c'est un piège classique de
 * `captureRef`. Le tracé de la carte partageable est donc **reprojeté en polyligne SVG** à partir des
 * points GPS.
 *
 * Ce détour a deux bénéfices qui n'étaient pas l'intention de départ : la carte fonctionne **sans
 * clé MapTiler** (l'écran de résumé, lui, affiche un bloc neutre sans clé) et **hors ligne**.
 *
 * ── La subtilité qui fait la différence entre un tracé et un gribouillis ─────────────────────────
 * Le facteur d'échelle est **uniforme** sur les deux axes, et la latitude est corrigée par
 * `cos(latitude)`. Sans ces deux précautions, un parcours de 10 km de long sur 200 m de large serait
 * étiré pour remplir le carré : illisible, et faux.
 */

/** Point GPS minimal nécessaire au tracé (compatible `GpsPoint`). */
export type TrackPoint = { lat: number; lng: number };

/** Point projeté dans le repère de l'image, en pixels. */
export type ProjectedPoint = { x: number; y: number };

/** Côté de l'image partagée, en pixels (carré — décision D3). */
export const SHARE_CARD_SIZE = 1080;

/** Marge intérieure du tracé, en pixels, pour qu'il ne touche jamais les bords. */
export const SHARE_TRACK_PADDING = 96;

/** Nombre de points au-delà duquel le tracé est simplifié avant projection. */
export const SHARE_TRACK_MAX_POINTS = 400;

const METERS_PER_DEG_LAT = 111_320;

/**
 * Projette un tracé GPS dans une boîte de `width` × `height`, marges comprises.
 *
 * Garanties, et ce sont elles qui comptent :
 *  1. **échelle uniforme** — le tracé n'est jamais déformé, seulement réduit et centré ;
 *  2. **correction de latitude** — un degré de longitude vaut `cos(lat)` degré de latitude en
 *     distance réelle ; sans cette correction, tous les tracés paraissent étirés horizontalement,
 *     d'autant plus qu'on s'éloigne de l'équateur ;
 *  3. **axe Y inversé** — en SVG, `y` croît vers le bas alors que la latitude croît vers le nord.
 *     Sans l'inversion, le tracé serait un miroir vertical du parcours réel.
 *
 * Cas dégénérés : un tracé vide rend `[]`, un point unique (ou plusieurs points identiques) rend le
 * **centre de la boîte** — plutôt qu'une division par zéro ou un `NaN` qui casserait le rendu SVG.
 */
export function projectTrack(
  points: ReadonlyArray<TrackPoint>,
  options: { width?: number; height?: number; padding?: number } = {},
): ProjectedPoint[] {
  const width = options.width ?? SHARE_CARD_SIZE;
  const height = options.height ?? SHARE_CARD_SIZE;
  const padding = options.padding ?? SHARE_TRACK_PADDING;

  if (points.length === 0) return [];

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Latitude médiane comme référence de correction : sur un parcours de quelques kilomètres, l'écart
  // avec la latitude de chaque point est négligeable devant la précision d'affichage.
  const latRef = (minLat + maxLat) / 2;
  const lngScale = Math.cos((latRef * Math.PI) / 180);

  // Étendue en **mètres**, pas en degrés : c'est ce qui rend le tracé fidèle.
  const spanX = (maxLng - minLng) * METERS_PER_DEG_LAT * lngScale;
  const spanY = (maxLat - minLat) * METERS_PER_DEG_LAT;

  const innerW = Math.max(1, width - 2 * padding);
  const innerH = Math.max(1, height - 2 * padding);

  // Un seul point, ou tous les points confondus : rien à mettre à l'échelle.
  if (spanX <= 0 && spanY <= 0) {
    return points.map(() => ({ x: width / 2, y: height / 2 }));
  }

  // Échelle **uniforme** : la plus contraignante des deux dimensions gagne.
  const scale = Math.min(spanX > 0 ? innerW / spanX : Infinity, spanY > 0 ? innerH / spanY : Infinity);

  // Centrage : la moitié de l'espace restant de chaque côté.
  const drawnW = spanX * scale;
  const drawnH = spanY * scale;
  const offsetX = (width - drawnW) / 2;
  const offsetY = (height - drawnH) / 2;

  return points.map((p) => {
    const mx = (p.lng - minLng) * METERS_PER_DEG_LAT * lngScale;
    const my = (p.lat - minLat) * METERS_PER_DEG_LAT;
    return {
      x: offsetX + mx * scale,
      // Y inversé : la latitude monte vers le nord, `y` descend en SVG.
      y: offsetY + (drawnH - my * scale),
    };
  });
}

/**
 * Réduit un tracé à au plus `max` points, en conservant **le premier et le dernier**.
 *
 * Un échantillonnage régulier suffit ici : la carte est une vignette de 1080 px, où deux points
 * distants de moins d'un pixel sont indiscernables. On ne réutilise pas `simplifyTrack`
 * (Douglas-Peucker) parce que son critère est une **tolérance en mètres**, pas un nombre de points :
 * il ne garantit donc aucune borne sur la taille du `path` SVG produit.
 */
export function sampleTrack<T>(points: ReadonlyArray<T>, max = SHARE_TRACK_MAX_POINTS): T[] {
  if (points.length <= max) return [...points];
  if (max <= 2) {
    const first = points[0]!;
    const last = points[points.length - 1]!;
    return max <= 1 ? [first] : [first, last];
  }

  const step = (points.length - 1) / (max - 1);
  const out: T[] = [];
  for (let i = 0; i < max - 1; i += 1) {
    out.push(points[Math.round(i * step)]!);
  }
  // Le dernier point est ajouté explicitement : l'arrondi ci-dessus pourrait le manquer, et une
  // boucle qui ne se referme pas au bon endroit se voit immédiatement à l'œil.
  out.push(points[points.length - 1]!);
  return out;
}

/** Construit l'attribut `d` d'un `<Path>` SVG à partir de points projetés. */
export function trackPath(points: ReadonlyArray<ProjectedPoint>): string {
  if (points.length === 0) return '';
  const round = (n: number): number => Math.round(n * 10) / 10;
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`)
    .join(' ');
}

/**
 * Vrai si un tracé peut être **dessiné** comme une ligne.
 *
 * Deux points identiques ne forment pas une ligne : l'UI doit alors basculer sur une carte **sans
 * tracé** (chiffres seuls) plutôt que d'afficher un artefact d'un pixel. Même raisonnement que
 * `RouteMap`, qui n'affiche pas de `LineString` sous 2 coordonnées.
 */
export function isDrawableTrack(points: ReadonlyArray<TrackPoint>): boolean {
  if (points.length < 2) return false;
  const first = points[0]!;
  return points.some((p) => p.lat !== first.lat || p.lng !== first.lng);
}

/** Nom de fichier de l'image partagée, horodaté. Sans espace ni accent (compatibilité OS). */
export function shareCardFileName(kind: 'run' | 'workout', startedAtMs: number): string {
  const d = new Date(startedAtMs);
  const pad = (n: number): string => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${kind === 'run' ? 'course' : 'seance'}-${stamp}.png`;
}
