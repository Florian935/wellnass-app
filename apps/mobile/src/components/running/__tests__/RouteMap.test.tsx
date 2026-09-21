/**
 * RouteMap — tracé GPS d'une course (`components/running/RouteMap`).
 *
 * Fichier à **0 %** avant ce test, et son en-tête disait « aucun test unitaire (module natif) ».
 * C'était vrai du **rendu** de la carte, jamais de ce que ce fichier décide : quel état afficher,
 * quel GeoJSON produire, et où pointer la caméra. MapLibre est ici une sonde ; ce qu'on vérifie,
 * c'est la géométrie qu'on lui passe.
 *
 * Ce qui casse en silence, et qui est couvert :
 *
 *  1. **Un seul point ne produit AUCUNE LineString.** GeoJSON exige ≥ 2 coordonnées ; une
 *     LineString à un point est un objet invalide que MapLibre refuse — sur device, la carte
 *     reste blanche sans message. C'est le cas réel d'une course arrêtée aussitôt démarrée.
 *  2. **Les bornes englobent le tracé entier**, pas seulement le premier et le dernier point.
 *     Une boucle qui revient à son point de départ donnerait, avec la version naïve, une boîte
 *     de taille nulle et un zoom absurde.
 *  3. **L'ordre des coordonnées est [lng, lat]**, l'inverse de la façon dont on les lit et écrit
 *     partout ailleurs. Inversé, le tracé part au large de la Somalie sans lever d'erreur.
 *  4. **Sans clé MapTiler, un bloc neutre remplace la carte** — pas un écran vide, pas un crash
 *     du module natif : c'est l'état d'un build sans secret d'environnement.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { GpsPoint } from '@wellness/shared';

import { RouteMap } from '../RouteMap';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/**
 * `hasMapKey` est une constante de module lue au rendu : un `jest.mock` figé interdirait de
 * tester l'état « sans clé ». Le getter la rend pilotable test par test — une fabrique `jest.mock`
 * est hoistée et ne peut refermer sur aucune variable du fichier, d'où le passage par `globalThis`.
 */
jest.mock('@/lib/map', () => ({
  get hasMapKey() {
    return (globalThis as { __cleCarte?: boolean }).__cleCarte ?? true;
  },
  MAP_STYLE_URL: 'https://style.test/style.json',
}));

/** Sondes MapLibre : le module natif ne se monte pas sous Jest, ses props si. */
jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = require('react-native');
  return {
    Map: ({ children, mapStyle }: { children: React.ReactNode; mapStyle: string }) => (
      <View testID="carte" accessibilityValue={{ text: mapStyle }}>
        {children}
      </View>
    ),
    Camera: (props: Record<string, unknown>) => <View testID="camera" accessibilityValue={{ text: JSON.stringify(props) }} />,
    GeoJSONSource: ({ id, data, children }: { id: string; data: unknown; children: React.ReactNode }) => (
      <View testID={`source-${id}`} accessibilityValue={{ text: JSON.stringify(data) }}>
        {children}
      </View>
    ),
    Layer: ({ id, type }: { id: string; type: string }) => (
      <View testID={`layer-${id}`} accessibilityValue={{ text: type }} />
    ),
    Marker: ({ children, lngLat }: { children: React.ReactNode; lngLat: [number, number] }) => (
      <View testID="marqueur" accessibilityValue={{ text: JSON.stringify(lngLat) }}>
        {children}
      </View>
    ),
  };
});

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

// La largeur rendue de la carte se déduit de la fenêtre (voir `visibleMedals`) : on la fixe à la
// largeur de la maquette pour que les écarts entre pastilles soient des pixels vérifiables.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }),
}));

// Le halo de position (MOTION-01 · C1) est purement décoratif et s'abonne au focus de l'écran
// (`useFocusEffect`), donc à un conteneur de navigation que ce test n'a pas — il teste la caméra
// et le GeoJSON, pas un écran. On le neutralise comme les autres dépendances externes du fichier.
jest.mock('@/components/running/PulseDot', () => ({ PulseDot: () => null }));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f', surfaceAlt: '#f3ddd0', border: '#ece0cd', accent: '#c0562f',
      surface: '#fffaf2', success: '#66714b', amber: '#b47f31', borderStrong: '#90897d',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const point = (lng: number, lat: number): GpsPoint => ({ lng, lat, t: 0 });

/** Le JSON sérialisé dans `accessibilityValue.text` de la sonde `testID`. */
const propsDe = <T,>(testID: string): T =>
  JSON.parse(String(screen.getByTestId(testID).props.accessibilityValue.text)) as T;

const afficher = async (
  points: GpsPoint[],
  props: Partial<React.ComponentProps<typeof RouteMap>> = {},
) => render(<RouteMap points={points} emptyLabel="aucun-point" {...props} />);

const medaille = (id: string, lat: number, lng: number, rank = 2) => ({
  id, lat, lng, rank, label: `${rank}e`, accessibilityLabel: `medaille-${id}`,
});

const sansCle = () => {
  (globalThis as { __cleCarte?: boolean }).__cleCarte = false;
};

beforeEach(() => {
  (globalThis as { __cleCarte?: boolean }).__cleCarte = true;
});

// ---------------------------------------------------------------------------
// États dégradés
// ---------------------------------------------------------------------------

describe('états dégradés', () => {
  it('🔴 sans clé MapTiler, un bloc neutre remplace la carte', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    sansCle();
    await afficher([point(2.35, 48.85), point(2.36, 48.86)]);

    // Un build sans secret d'environnement ne doit pas monter le module natif : le bloc neutre
    // dit pourquoi, là où un écran vide passerait pour un bug de chargement.
    expect(screen.getByText('running.map.unavailable')).toBeTruthy();
    expect(screen.queryByTestId('carte')).toBeNull();
    log.mockRestore();
  });

  it('🔴 l’absence de clé PRIME sur l’absence de points', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    sansCle();
    await afficher([]);

    // « Aucun tracé » sur un build sans clé serait un diagnostic faux : les points sont peut-être
    // là, c'est la carte qui manque.
    expect(screen.getByText('running.map.unavailable')).toBeTruthy();
    expect(screen.queryByText('aucun-point')).toBeNull();
    log.mockRestore();
  });

  it('sans point, affiche le libellé fourni par l’appelant', async () => {
    await afficher([]);

    // Le texte vient de l'appelant : « pas encore de GPS » pendant une course et « course sans
    // tracé » dans l'historique ne disent pas la même chose.
    expect(screen.getByText('aucun-point')).toBeTruthy();
    expect(screen.queryByTestId('carte')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tracé
// ---------------------------------------------------------------------------

describe('tracé', () => {
  it('monte la carte avec le style configuré', async () => {
    await afficher([point(2.35, 48.85), point(2.36, 48.86)]);

    expect(screen.getByTestId('carte').props.accessibilityValue.text).toBe(
      'https://style.test/style.json',
    );
    expect(screen.getByTestId('layer-route-layer').props.accessibilityValue.text).toBe('line');
    expect(screen.getByTestId('layer-position-layer').props.accessibilityValue.text).toBe('circle');
  });

  it('🔴 les coordonnées sortent en [lng, lat], dans l’ordre du parcours', async () => {
    await afficher([point(2.35, 48.85), point(2.36, 48.86), point(2.37, 48.87)]);

    // Inversé, le tracé part au large de la Somalie — sans erreur, sans avertissement.
    const source = propsDe<GeoJSON.FeatureCollection>('source-route-source');
    expect((source.features[0]!.geometry as GeoJSON.LineString).coordinates).toEqual([
      [2.35, 48.85],
      [2.36, 48.86],
      [2.37, 48.87],
    ]);
  });

  it('🔴 un SEUL point ne produit aucune LineString', async () => {
    await afficher([point(2.35, 48.85)]);

    // GeoJSON exige ≥ 2 coordonnées : une LineString à un point est refusée par MapLibre et la
    // carte reste blanche. Cas réel : une course arrêtée aussitôt démarrée.
    expect(propsDe<GeoJSON.FeatureCollection>('source-route-source').features).toEqual([]);
    // Le marqueur, lui, reste : c'est la seule chose qu'on sache montrer.
    expect(propsDe<GeoJSON.FeatureCollection>('source-position-source').features).toHaveLength(1);
  });

  it('le marqueur est sur le DERNIER point, pas le premier', async () => {
    await afficher([point(2.35, 48.85), point(2.4, 48.9)]);

    const marqueur = propsDe<GeoJSON.FeatureCollection>('source-position-source');
    expect((marqueur.features[0]!.geometry as GeoJSON.Point).coordinates).toEqual([2.4, 48.9]);
  });
});

// ---------------------------------------------------------------------------
// Caméra
// ---------------------------------------------------------------------------

describe('caméra', () => {
  it('en mode suivi, elle est centrée sur le dernier point', async () => {
    await afficher([point(2.35, 48.85), point(2.4, 48.9)], { follow: true });

    const camera = propsDe<{ center: [number, number]; zoom: number; bounds?: unknown }>('camera');
    expect(camera.center).toEqual([2.4, 48.9]);
    expect(camera.zoom).toBe(15);
    // Suivre ET cadrer sur les bornes s'annuleraient : la caméra reculerait à chaque nouveau point.
    expect(camera.bounds).toBeUndefined();
  });

  it('🔴 en mode résumé, les bornes englobent TOUT le tracé', async () => {
    await afficher([
      point(2.4, 48.85),
      point(2.3, 48.9),
      point(2.35, 48.8),
      point(2.45, 48.87),
    ]);

    // [ouest, sud, est, nord] — extrema sur les quatre points, pas seulement premier et dernier.
    // Une boucle qui revient à son départ donnerait sinon une boîte de taille nulle.
    const camera = propsDe<{ bounds: number[] }>('camera');
    expect(camera.bounds).toEqual([2.3, 48.8, 2.45, 48.9]);
  });

  it('🔴 un seul point en mode résumé : centrage, pas de bornes', async () => {
    await afficher([point(2.35, 48.85)]);

    // Des bornes de taille nulle poussent le zoom à l'infini : MapLibre affiche alors une tuile
    // grise. Le centrage à zoom fixe est le seul cadrage sensé pour un point unique.
    const camera = propsDe<{ center: [number, number]; zoom: number; bounds?: unknown }>('camera');
    expect(camera.bounds).toBeUndefined();
    expect(camera.center).toEqual([2.35, 48.85]);
    expect(camera.zoom).toBe(15);
  });

  it('en mode résumé, un padding entoure le tracé', async () => {
    await afficher([point(2.35, 48.85), point(2.4, 48.9)]);

    // Sans padding, le tracé colle aux quatre bords et le premier kilomètre est coupé.
    expect(propsDe<{ padding: Record<string, number> }>('camera').padding).toEqual({
      top: 40,
      right: 40,
      bottom: 40,
      left: 40,
    });
  });
});

// ---------------------------------------------------------------------------
// US EFFORT-01 — départ, arrivée, sens, médailles
// ---------------------------------------------------------------------------

describe('départ, arrivée et sens (R14)', () => {
  const boucle = [point(3, 45), point(3.01, 45.01), point(3.02, 45), point(3, 45.001)];

  it('🔴 le départ est le PREMIER point et l’arrivée le DERNIER', async () => {
    await afficher(boucle, { startEnd: true });
    const ends = propsDe<GeoJSON.FeatureCollection>('source-ends-source');
    expect(ends.features.map((f) => f.properties?.kind)).toEqual(['start', 'finish']);
    expect((ends.features[0]!.geometry as GeoJSON.Point).coordinates).toEqual([3, 45]);
    expect((ends.features[1]!.geometry as GeoJSON.Point).coordinates).toEqual([3, 45.001]);
  });

  it('sans `startEnd`, la carte reste nue — le comportement d’avant l’US', async () => {
    await afficher(boucle);
    expect(propsDe<GeoJSON.FeatureCollection>('source-ends-source').features).toEqual([]);
    expect(screen.queryByTestId('layer-direction-layer')).toBeNull();
  });

  it('🔴 en mode SUIVI, ni départ ni arrivée : le dernier point est la position courante', async () => {
    await afficher(boucle, { startEnd: true, follow: true });
    expect(propsDe<GeoJSON.FeatureCollection>('source-ends-source').features).toEqual([]);
    expect(screen.queryByTestId('layer-direction-layer')).toBeNull();
  });

  it('un seul point ne produit ni départ ni arrivée', async () => {
    await afficher([point(3, 45)], { startEnd: true });
    expect(propsDe<GeoJSON.FeatureCollection>('source-ends-source').features).toEqual([]);
  });

  it('le calque de sens est monté avec le tracé', async () => {
    await afficher(boucle, { startEnd: true });
    expect(screen.getByTestId('layer-direction-layer')).toBeTruthy();
  });
});

describe('médailles sur la carte (R10-R13)', () => {
  const trace = [point(3, 45), point(3.01, 45.005), point(3.02, 45.01)];

  it('aucune médaille quand l’appelant n’en passe pas', async () => {
    await afficher(trace);
    expect(screen.queryAllByTestId('marqueur')).toHaveLength(0);
  });

  it('une fois mesurée, la pastille se pose à sa position, en [lng, lat]', async () => {
    await afficher(trace, { medals: [medaille('a', 45.002, 3.004)] });
    const marqueur = screen.getByTestId('marqueur');
    expect(JSON.parse(String(marqueur.props.accessibilityValue.text))).toEqual([3.004, 45.002]);
    expect(screen.getByLabelText('medaille-a')).toBeTruthy();
  });

  it('garde les deux quand elles sont assez écartées', async () => {
    await afficher(trace, {
      medals: [medaille('a', 45.001, 3.002), medaille('b', 45.009, 3.018)],
    });
    expect(screen.queryAllByTestId('marqueur')).toHaveLength(2);
  });

  it('🔴 n’en garde qu’une quand elles se chevaucheraient (R13)', async () => {
    await afficher(trace, {
      medals: [medaille('a', 45.005, 3.010), medaille('b', 45.0051, 3.0101)],
    });
    expect(screen.queryAllByTestId('marqueur')).toHaveLength(1);
    // La première reste : elle vient de `pickMapMedals`, donc c'est la mieux classée.
    expect(screen.getByLabelText('medaille-a')).toBeTruthy();
  });

  it('aucune médaille en mode suivi : il n’y a pas de bornes à projeter', async () => {
    await afficher(trace, { follow: true, medals: [medaille('a', 45.002, 3.004)] });
    expect(screen.queryAllByTestId('marqueur')).toHaveLength(0);
  });
});
