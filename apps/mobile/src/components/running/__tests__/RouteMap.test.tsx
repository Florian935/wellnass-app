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
  };
});

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: { text: '#33291f', surfaceAlt: '#f3ddd0', border: '#ece0cd', accent: '#c0562f' },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const point = (lng: number, lat: number): GpsPoint => ({ lng, lat, t: 0 });

/** Le JSON sérialisé dans `accessibilityValue.text` de la sonde `testID`. */
const propsDe = <T,>(testID: string): T =>
  JSON.parse(String(screen.getByTestId(testID).props.accessibilityValue.text)) as T;

const afficher = async (points: GpsPoint[], props: { follow?: boolean; height?: number } = {}) =>
  render(<RouteMap points={points} emptyLabel="aucun-point" {...props} />);

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
