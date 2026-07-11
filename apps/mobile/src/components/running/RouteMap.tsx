/**
 * RouteMap — affiche le tracé GPS d'une course sur une carte MapLibre.
 *
 * Trois états (priorité décroissante) :
 *  1. Pas de clé MapTiler (`!hasMapKey`) → bloc neutre avec message.
 *  2. Aucun point (`points.length === 0`) → bloc neutre avec `emptyLabel`.
 *  3. Carte MapLibre avec le tracé en LineLayer + marqueur de position courante
 *     en mode `follow`, ou caméra ajustée aux bornes en mode résumé.
 *
 * Cas limite : si `points.length === 1`, on ne peut pas tracer un LineString
 * (qui requiert ≥ 2 coordonnées) — on affiche juste le marqueur, centré sur
 * le point unique, sans la ligne.
 *
 * Aucun test unitaire (module natif) ; la recette se fait sur device.
 */

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type LngLatBounds,
} from '@maplibre/maplibre-react-native';
import type { GpsPoint } from '@wellness/shared';
import { hasMapKey, MAP_STYLE_URL } from '@/lib/map';
import { useTheme } from '@/theme/useTheme';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RouteMapProps {
  /** Points GPS décodés (via `decodeTrack`). */
  points: GpsPoint[];
  /**
   * Mode suivi en direct : la caméra suit le dernier point et affiche un
   * marqueur de position courante. En mode résumé (`false`), la caméra
   * s'ajuste pour englober toute la trace.
   */
  follow?: boolean;
  /** Texte affiché quand il n'y a aucun point (état vide). */
  emptyLabel: string;
  /** Hauteur du composant en pixels. */
  height?: number;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const DEFAULT_HEIGHT = 200;
const SOURCE_ROUTE_ID = 'route-source';
const SOURCE_POSITION_ID = 'position-source';
const LAYER_ROUTE_ID = 'route-layer';
const LAYER_POSITION_ID = 'position-layer';
const FOLLOW_ZOOM = 15;
const BOUNDS_PADDING = 40;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Calcule les bornes [west, south, east, north] d'un tableau de points (≥ 1). */
function computeBounds(pts: GpsPoint[]): LngLatBounds {
  // pts est garanti non vide par l'appelant.
  const first = pts[0]!;
  let minLng = first.lng;
  let maxLng = first.lng;
  let minLat = first.lat;
  let maxLat = first.lat;
  for (const p of pts.slice(1)) {
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function RouteMap({
  points,
  follow = false,
  emptyLabel,
  height = DEFAULT_HEIGHT,
}: RouteMapProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  // --- État 1 : clé absente ---
  if (!hasMapKey) {
    if (__DEV__) {
      console.log('[RouteMap] Clé MapTiler absente — carte désactivée.');
    }
    return (
      <View
        style={[
          styles.neutral,
          {
            height,
            backgroundColor: colors.surfaceAlt,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.neutralText, { color: colors.text }]}>
          {t('running.map.unavailable')}
        </Text>
      </View>
    );
  }

  // --- État 2 : aucun point ---
  if (points.length === 0) {
    return (
      <View
        style={[
          styles.neutral,
          {
            height,
            backgroundColor: colors.surfaceAlt,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.neutralText, { color: colors.text }]}>
          {emptyLabel}
        </Text>
      </View>
    );
  }

  return (
    <RouteMapInner
      points={points}
      follow={follow}
      height={height}
      colors={colors}
    />
  );
}

// ---------------------------------------------------------------------------
// Partie interne (montée uniquement quand la carte est visible)
// ---------------------------------------------------------------------------

interface RouteMapInnerProps {
  points: GpsPoint[];
  follow: boolean;
  height: number;
  colors: ReturnType<typeof useTheme>['colors'];
}

function RouteMapInner({
  points,
  follow,
  height,
  colors,
}: RouteMapInnerProps) {
  // RouteMapInner n'est rendu que si points.length > 0 (vérifié dans RouteMap).
  const lastPoint = points[points.length - 1]!;
  // LngLat = [longitude, latitude]
  const lastLngLat: [number, number] = [lastPoint.lng, lastPoint.lat];

  // GeoJSON du tracé — mémorisé pour ne pas reconstruire à chaque render.
  // Si un seul point, on produit quand même un FeatureCollection mais sans
  // LineString (GeoJSON LineString invalide avec < 2 coords).
  const routeGeoJSON = useMemo<GeoJSON.FeatureCollection>(() => {
    if (points.length < 2) {
      return { type: 'FeatureCollection', features: [] };
    }
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: points.map((p) => [p.lng, p.lat]),
          },
        },
      ],
    };
  }, [points]);

  // GeoJSON du marqueur de position courante (dernier point).
  const positionGeoJSON = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [lastPoint.lng, lastPoint.lat],
        },
      },
    ],
  }), [lastPoint.lng, lastPoint.lat]);

  // Bornes (résumé) — calculées uniquement si nécessaire.
  const bounds = useMemo<LngLatBounds | null>(() => {
    if (follow || points.length < 2) return null;
    return computeBounds(points);
  }, [follow, points]);

  return (
    <View
      style={[
        styles.mapContainer,
        {
          height,
          borderColor: colors.border,
        },
      ]}
    >
      <Map
        mapStyle={MAP_STYLE_URL}
        style={StyleSheet.absoluteFill}
      >
        {/* Caméra : mode suivi ou mode bornes */}
        {follow ? (
          <Camera
            center={lastLngLat}
            zoom={FOLLOW_ZOOM}
            duration={500}
          />
        ) : bounds !== null ? (
          <Camera
            bounds={bounds}
            padding={{
              top: BOUNDS_PADDING,
              right: BOUNDS_PADDING,
              bottom: BOUNDS_PADDING,
              left: BOUNDS_PADDING,
            }}
          />
        ) : (
          /* 1 seul point en mode résumé : centré sur ce point */
          <Camera
            center={lastLngLat}
            zoom={FOLLOW_ZOOM}
          />
        )}

        {/* Source + layer du tracé (visible seulement si ≥ 2 points) */}
        <GeoJSONSource id={SOURCE_ROUTE_ID} data={routeGeoJSON}>
          <Layer
            id={LAYER_ROUTE_ID}
            type="line"
            source={SOURCE_ROUTE_ID}
            paint={{
              'line-color': colors.accent,
              'line-width': 4,
            }}
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
          />
        </GeoJSONSource>

        {/* Marqueur de position courante (dernier point) */}
        <GeoJSONSource id={SOURCE_POSITION_ID} data={positionGeoJSON}>
          <Layer
            id={LAYER_POSITION_ID}
            type="circle"
            source={SOURCE_POSITION_ID}
            paint={{
              'circle-radius': 7,
              'circle-color': colors.accent,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            }}
          />
        </GeoJSONSource>
      </Map>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  neutral: {
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  neutralText: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  mapContainer: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
