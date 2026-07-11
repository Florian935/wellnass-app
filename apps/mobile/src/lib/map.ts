/**
 * Configuration carte (MapLibre + MapTiler). Clé via env (jamais committée).
 * Style choisi : outdoor (met en valeur parcs/chemins/relief — running).
 */
const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '';

/** Vrai si une clé MapTiler est configurée (sinon RouteMap affiche un état neutre). */
export const hasMapKey = MAPTILER_KEY.length > 0;

/** URL de style MapTiler (outdoor). Vide si pas de clé. */
export const MAP_STYLE_URL = hasMapKey
  ? `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${MAPTILER_KEY}`
  : '';
