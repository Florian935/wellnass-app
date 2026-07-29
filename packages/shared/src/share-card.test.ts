import { describe, expect, it } from 'vitest';

import {
  isDrawableTrack,
  projectTrack,
  sampleTrack,
  shareCardFileName,
  SHARE_CARD_SIZE,
  SHARE_TRACK_PADDING,
  trackPath,
  type TrackPoint,
} from './share-card';

/** Petit tracé en L, autour de Clermont-Ferrand. */
const track: TrackPoint[] = [
  { lat: 45.777, lng: 3.087 },
  { lat: 45.787, lng: 3.087 },
  { lat: 45.787, lng: 3.107 },
];

describe('projection du tracé', () => {
  it('tient dans la boîte, marges comprises', () => {
    const projected = projectTrack(track);
    for (const p of projected) {
      expect(p.x).toBeGreaterThanOrEqual(SHARE_TRACK_PADDING - 1);
      expect(p.x).toBeLessThanOrEqual(SHARE_CARD_SIZE - SHARE_TRACK_PADDING + 1);
      expect(p.y).toBeGreaterThanOrEqual(SHARE_TRACK_PADDING - 1);
      expect(p.y).toBeLessThanOrEqual(SHARE_CARD_SIZE - SHARE_TRACK_PADDING + 1);
    }
  });

  it('ne DÉFORME pas le tracé : l’échelle est uniforme sur les deux axes', () => {
    // Un couloir très allongé (≈ 2 km sur ≈ 100 m). S'il était étiré pour remplir le carré, le
    // rapport largeur/hauteur du rendu serait ≈ 1 au lieu de ≈ 20 — c'est ce qui transforme un
    // parcours en gribouillis.
    const corridor: TrackPoint[] = [
      { lat: 45.777, lng: 3.0 },
      { lat: 45.778, lng: 3.026 }, // ~0,001° lat ≈ 111 m ; 0,026° lng ≈ 2 km à cette latitude
    ];
    const projected = projectTrack(corridor);
    const a = projected[0]!;
    const b = projected[1]!;
    const drawnW = Math.abs(b.x - a.x);
    const drawnH = Math.abs(b.y - a.y);
    expect(drawnW / drawnH).toBeGreaterThan(10);
  });

  it('corrige la latitude — sinon les tracés paraissent étirés horizontalement', () => {
    // Un carré en DEGRÉS n'est pas un carré en mètres : à 45°, un degré de longitude vaut ~0,707
    // degré de latitude. Le rendu doit donc être plus large que haut... non : plus HAUT que large,
    // puisque la même variation en degrés couvre moins de mètres en longitude.
    const square: TrackPoint[] = [
      { lat: 45.0, lng: 3.0 },
      { lat: 45.01, lng: 3.0 },
      { lat: 45.01, lng: 3.01 },
    ];
    const projected = projectTrack(square);
    const xs = projected.map((p) => p.x);
    const ys = projected.map((p) => p.y);
    const drawnW = Math.max(...xs) - Math.min(...xs);
    const drawnH = Math.max(...ys) - Math.min(...ys);
    // cos(45°) ≈ 0,707 → la largeur dessinée doit valoir ~70 % de la hauteur.
    expect(drawnW / drawnH).toBeCloseTo(Math.cos((45 * Math.PI) / 180), 1);
  });

  it('inverse l’axe Y : le point le plus au NORD est le plus HAUT dans l’image', () => {
    const projected = projectTrack([
      { lat: 45.777, lng: 3.087 }, // sud
      { lat: 45.787, lng: 3.087 }, // nord
    ]);
    const south = projected[0]!;
    const north = projected[1]!;
    // En SVG, « plus haut » = y plus PETIT.
    expect(north.y).toBeLessThan(south.y);
  });

  it('rend une liste vide pour un tracé vide', () => {
    expect(projectTrack([])).toEqual([]);
  });

  it('centre un point unique au lieu de diviser par zéro', () => {
    const projected = projectTrack([{ lat: 45.777, lng: 3.087 }]);
    expect(projected).toEqual([{ x: SHARE_CARD_SIZE / 2, y: SHARE_CARD_SIZE / 2 }]);
  });

  it('centre aussi un tracé dont tous les points sont IDENTIQUES', () => {
    // Cas réel : GPS bloqué, l'utilisateur n'a pas bougé. Aucun NaN ne doit sortir d'ici.
    const stuck = Array.from({ length: 5 }, () => ({ lat: 45.777, lng: 3.087 }));
    const projected = projectTrack(stuck);
    for (const p of projected) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(p.x).toBe(SHARE_CARD_SIZE / 2);
    }
  });

  it('ne produit jamais de NaN sur un tracé purement horizontal ou vertical', () => {
    // Étendue nulle sur un axe : l'échelle de cet axe est ignorée (Infinity), pas propagée.
    for (const degenerate of [
      [{ lat: 45.777, lng: 3.0 }, { lat: 45.777, lng: 3.02 }], // spanY = 0
      [{ lat: 45.777, lng: 3.0 }, { lat: 45.797, lng: 3.0 }], // spanX = 0
    ]) {
      for (const p of projectTrack(degenerate)) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
    }
  });

  it('respecte une boîte et une marge personnalisées', () => {
    const projected = projectTrack(track, { width: 200, height: 200, padding: 20 });
    for (const p of projected) {
      expect(p.x).toBeGreaterThanOrEqual(19);
      expect(p.x).toBeLessThanOrEqual(181);
    }
  });
});

describe('échantillonnage', () => {
  const many = Array.from({ length: 5_000 }, (_, i) => ({ lat: 45 + i / 1e5, lng: 3 }));

  it('borne le nombre de points', () => {
    expect(sampleTrack(many, 400)).toHaveLength(400);
  });

  it('conserve le PREMIER et le DERNIER point — une boucle mal refermée se voit', () => {
    const sampled = sampleTrack(many, 400);
    expect(sampled[0]).toEqual(many[0]);
    expect(sampled[sampled.length - 1]).toEqual(many[many.length - 1]);
  });

  it('laisse un tracé court intact, sans le recopier par référence', () => {
    const short = [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }];
    const sampled = sampleTrack(short, 400);
    expect(sampled).toEqual(short);
    expect(sampled).not.toBe(short);
  });

  it('dégrade proprement sous 3 points demandés', () => {
    expect(sampleTrack(many, 2)).toEqual([many[0], many[many.length - 1]]);
    expect(sampleTrack(many, 1)).toEqual([many[0]]);
  });
});

describe('chemin SVG', () => {
  it('commence par M puis enchaîne des L', () => {
    expect(trackPath([{ x: 10, y: 20 }, { x: 30, y: 40 }])).toBe('M10 20 L30 40');
  });

  it('arrondit au dixième — un `path` de 400 points n’a pas besoin de 15 décimales', () => {
    expect(trackPath([{ x: 10.04, y: 20.06 }])).toBe('M10 20.1');
  });

  it('rend une chaîne vide sans point (et non un `path` invalide)', () => {
    expect(trackPath([])).toBe('');
  });
});

describe('tracé dessinable', () => {
  it('vrai dès que deux points diffèrent', () => {
    expect(isDrawableTrack(track)).toBe(true);
  });

  it('faux avec 0 ou 1 point', () => {
    expect(isDrawableTrack([])).toBe(false);
    expect(isDrawableTrack([{ lat: 45, lng: 3 }])).toBe(false);
  });

  it('faux si tous les points sont confondus — on basculera sur une carte SANS tracé', () => {
    // Afficher un artefact d'un pixel serait pire que de ne rien afficher.
    expect(isDrawableTrack([
      { lat: 45, lng: 3 },
      { lat: 45, lng: 3 },
      { lat: 45, lng: 3 },
    ])).toBe(false);
  });
});

describe('nom de fichier', () => {
  it('horodate, et distingue course et séance', () => {
    const ms = new Date(2026, 6, 29, 18, 5).getTime();
    expect(shareCardFileName('run', ms)).toBe('course-20260729-1805.png');
    expect(shareCardFileName('workout', ms)).toBe('seance-20260729-1805.png');
  });

  it('ne contient ni espace ni accent (compatibilité OS)', () => {
    const name = shareCardFileName('workout', new Date(2026, 0, 1, 9, 0).getTime());
    expect(name).toMatch(/^[a-z0-9-]+\.png$/);
  });
});
