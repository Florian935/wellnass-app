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
 * Le **rendu** de la carte ne se teste que sur device (module natif). Ce que ce fichier décide —
 * l'état affiché, le GeoJSON produit, le cadrage de la caméra — l'est en revanche sous Jest, avec
 * MapLibre en sonde : voir [`__tests__/RouteMap.test.tsx`](./__tests__/RouteMap.test.tsx).
 */

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type LngLatBounds,
} from '@maplibre/maplibre-react-native';
import { dropOverlappingMedals, type GpsPoint } from '@wellness/shared';
import { PulseDot } from '@/components/running/PulseDot';
import { hasMapKey, MAP_STYLE_URL } from '@/lib/map';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Une médaille posée sur la carte, à l'endroit où l'effort a eu lieu (US EFFORT-01, R10).
 */
export interface RouteMedal {
  id: string;
  lat: number;
  lng: number;
  /** 1 = record personnel — c'est lui qui décide de la couleur de la pastille. */
  rank: number;
  /** Texte court affiché sur la pastille (« 2ᵉ · 1 km »). */
  label: string;
  /** Libellé lu par les lecteurs d'écran — une pastille de 2 mots ne se suffit pas. */
  accessibilityLabel: string;
  onPress?: () => void;
}

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
  /**
   * US EFFORT-01 (R14) — départ, arrivée et sens de parcours.
   *
   * Utile **indépendamment des médailles** : jusqu'ici la carte dessinait un tracé nu, sans dire
   * par où la course avait commencé. N'a de sens qu'en mode résumé (en suivi, le « dernier point »
   * est la position courante, pas une arrivée).
   */
  startEnd?: boolean;
  /** US EFFORT-01 (R10-R13) — au plus deux pastilles, filtrées de leurs chevauchements. */
  medals?: RouteMedal[];
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const DEFAULT_HEIGHT = 200;
const SOURCE_ROUTE_ID = 'route-source';
const SOURCE_POSITION_ID = 'position-source';
const LAYER_ROUTE_ID = 'route-layer';
const LAYER_POSITION_ID = 'position-layer';
const SOURCE_ENDS_ID = 'ends-source';
const LAYER_START_ID = 'start-layer';
const LAYER_FINISH_ID = 'finish-layer';
const LAYER_DIRECTION_ID = 'direction-layer';
const FOLLOW_ZOOM = 15;

/** Référence stable : un `[]` littéral en valeur par défaut relancerait les `useMemo` à chaque rendu. */
const EMPTY_MEDALS: RouteMedal[] = [];
const BOUNDS_PADDING = 40;

/**
 * Gouttière horizontale du corps d'écran, de chaque côté (`StageScrollView`). Sert à déduire la
 * largeur rendue de la carte sans la mesurer — voir `visibleMedals`.
 */
const SCREEN_GUTTER = 20;

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
  startEnd = false,
  medals,
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
      startEnd={startEnd}
      medals={medals ?? EMPTY_MEDALS}
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
  startEnd: boolean;
  medals: RouteMedal[];
}

function RouteMapInner({
  points,
  follow,
  height,
  colors,
  startEnd,
  medals,
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

  // US EFFORT-01 (R14) — départ et arrivée. Deux features distinctes dans une seule source, pour
  // n'ajouter qu'une source à la carte ; le calque les sépare sur `properties.kind`.
  const endsGeoJSON = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!startEnd || follow || points.length < 2) {
      return { type: 'FeatureCollection', features: [] };
    }
    const first = points[0]!;
    const last = points[points.length - 1]!;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { kind: 'start' },
          geometry: { type: 'Point', coordinates: [first.lng, first.lat] },
        },
        {
          type: 'Feature',
          properties: { kind: 'finish' },
          geometry: { type: 'Point', coordinates: [last.lng, last.lat] },
        },
      ],
    };
  }, [startEnd, follow, points]);

  // Bornes (résumé) — calculées uniquement si nécessaire.
  const bounds = useMemo<LngLatBounds | null>(() => {
    if (follow || points.length < 2) return null;
    return computeBounds(points);
  }, [follow, points]);

  // US EFFORT-01 (R13) — la largeur rendue, déduite de la fenêtre plutôt que mesurée.
  //
  // ⚠️ Pourquoi pas `onLayout` : il donnerait la vraie largeur, mais il impose un état, un premier
  // rendu sans médaille puis un second avec — donc un clignotement à chaque ouverture — et il n'est
  // pas déclenchable depuis les tests de ce dépôt. La carte occupe la largeur du corps de l'écran,
  // c'est-à-dire la fenêtre moins ses deux gouttières : c'est connu d'avance, exactement, et sans
  // état.
  //
  // On **sous-estime** volontairement plutôt que l'inverse : une largeur trop petite rapproche les
  // pastilles dans le calcul, donc on en retire une de trop plutôt que d'en laisser deux se
  // chevaucher — et la spec dit que deux pastilles superposées sont pires qu'une seule.
  const { width: windowWidth } = useWindowDimensions();

  const visibleMedals = useMemo<RouteMedal[]>(() => {
    if (medals.length === 0 || bounds === null) return [];
    const widthPx = Math.max(1, windowWidth - SCREEN_GUTTER * 2);
    return dropOverlappingMedals(
      medals.map((m) => ({ ...m, midLat: m.lat, midLng: m.lng })),
      bounds,
      widthPx,
      height,
    );
  }, [medals, bounds, windowWidth, height]);

  return (
    <View
      testID="route-map"
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
        {/*
          US EFFORT-01 (R14) — départ, arrivée, sens.

          Trois calques plutôt que des images : MapLibre ne sait afficher une icône que depuis un
          sprite, que ce style ne fournit pas. Un cercle et une flèche textuelle ne coûtent aucun
          asset et survivent à un changement de fond de carte.
        */}
        <GeoJSONSource id={SOURCE_ENDS_ID} data={endsGeoJSON}>
          <Layer
            id={LAYER_START_ID}
            type="circle"
            source={SOURCE_ENDS_ID}
            filter={['==', ['get', 'kind'], 'start']}
            paint={{
              'circle-radius': 7,
              'circle-color': colors.success,
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#ffffff',
            }}
          />
          <Layer
            id={LAYER_FINISH_ID}
            type="circle"
            source={SOURCE_ENDS_ID}
            filter={['==', ['get', 'kind'], 'finish']}
            paint={{
              'circle-radius': 7,
              'circle-color': colors.text,
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#ffffff',
            }}
          />
        </GeoJSONSource>

        {startEnd && !follow ? (
          <Layer
            id={LAYER_DIRECTION_ID}
            type="symbol"
            source={SOURCE_ROUTE_ID}
            layout={{
              'symbol-placement': 'line',
              'symbol-spacing': 90,
              // ASCII volontairement : un chevron typographique (›, ▸) dépend des glyphes du style
              // et disparaîtrait sans bruit s'ils manquaient.
              'text-field': '>',
              'text-size': 15,
              'text-rotation-alignment': 'map',
              'text-keep-upright': false,
              'text-allow-overlap': true,
            }}
            paint={{
              'text-color': '#ffffff',
              'text-halo-color': colors.accent,
              'text-halo-width': 1.5,
            }}
          />
        ) : null}
      </Map>

      {/*
        US EFFORT-01 (R10-R13) — les médailles, posées à l'endroit où l'effort a eu lieu.

        De vraies vues (`Marker`) et non des calques : une pastille doit être **touchable** et
        **lisible par un lecteur d'écran**, ce qu'un cercle MapLibre ne sera jamais.
      */}
      {visibleMedals.map((medal) => (
        <Marker key={medal.id} lngLat={[medal.lng, medal.lat]}>
          {/*
            `Pressable` **seulement** s'il y a quelque chose à faire au tap. Sans handler, un
            bouton qui ne réagit pas ment sur son interactivité — et le lecteur d'écran
            l'annoncerait comme actionnable. La pastille reste alors un simple libellé, lu par
            `accessibilityLabel` : le détail de l'effort vit dans la liste, juste en dessous.
          */}
          <Pressable
            onPress={medal.onPress}
            disabled={!medal.onPress}
            accessibilityRole={medal.onPress ? 'button' : 'text'}
            accessibilityLabel={medal.accessibilityLabel}
            style={[
              styles.medal,
              {
                backgroundColor: colors.surface,
                borderColor: medal.rank === 1 ? colors.amber : colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.medalDot,
                { backgroundColor: medal.rank === 1 ? colors.amber : colors.borderStrong },
              ]}
            >
              <Text style={styles.medalRank}>{medal.rank}</Text>
            </View>
            <Text style={[styles.medalLabel, { color: colors.text }]} numberOfLines={1}>
              {medal.label}
            </Text>
          </Pressable>
        </Marker>
      ))}

      {/*
        MOTION-01 (C1) — le `pulsedot` de la maquette, enfin posé. Uniquement en mode suivi : c'est
        le seul mode où la caméra est centrée sur le dernier point, donc le seul où un halo posé au
        centre du conteneur coïncide avec le marqueur (voir l'en-tête de `PulseDot`).
      */}
      {follow ? <PulseDot color={colors.accent} /> : null}
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
  // 44 px de haut minimum : c'est la cible tactile, et c'est aussi le seuil qui décide du
  // chevauchement (`MEDAL_MIN_PIXEL_GAP`) — les deux doivent rester d'accord.
  medal: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 5,
    paddingRight: 11,
    borderRadius: 999,
    borderWidth: 1.5,
    elevation: 4,
  },
  medalDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalRank: {
    fontFamily: fontFamily.displayBold,
    fontSize: 13,
    color: '#ffffff',
  },
  medalLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
  },
});
