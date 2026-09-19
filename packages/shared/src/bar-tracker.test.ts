import { describe, it, expect } from 'vitest';
import {
  suggestThreshold,
  trackBrightPoint,
  TRACK_DEFAULT_MIN_PIXELS,
  type LumaPlane,
} from './bar-tracker';

/**
 * Spike VBT-01 — le suivi du point, éprouvé sans caméra.
 *
 * Le banc de `bar-velocity` a chiffré l'enjeu : **±3 px et tout tient, ±8 px et la mesure
 * s'effondre**. Ces tests vérifient donc d'abord une chose : la position rendue est-elle
 * sous-pixellique, et le reste-t-elle quand l'image est bruitée, tramée, ou pleine de néons ?
 *
 * Les images sont fabriquées ici : une tache claire sur fond sombre, exactement ce que rend le plan
 * de luminance d'une caméra filmant une pastille fluo.
 */

/** Fabrique un plan de luminance avec un disque clair au centre demandé. */
function planeWithDisc(
  discs: ReadonlyArray<{ x: number; y: number; radius: number; luma?: number }>,
  options: { width?: number; height?: number; padding?: number; background?: number } = {},
): LumaPlane {
  const width = options.width ?? 320;
  const height = options.height ?? 240;
  // Padding volontaire : les caméras alignent leurs lignes, `bytesPerRow > width` est la norme.
  const bytesPerRow = width + (options.padding ?? 16);
  const data = new Uint8Array(bytesPerRow * height).fill(options.background ?? 20);

  for (const disc of discs) {
    const luma = disc.luma ?? 250;
    const r = Math.ceil(disc.radius) + 1;
    for (let y = Math.max(0, Math.floor(disc.y - r)); y <= Math.min(height - 1, disc.y + r); y += 1) {
      for (let x = Math.max(0, Math.floor(disc.x - r)); x <= Math.min(width - 1, disc.x + r); x += 1) {
        const d = Math.hypot(x - disc.x, y - disc.y);
        if (d > disc.radius) continue;
        // Bord adouci : un capteur ne rend jamais un disque net, et c'est ce dégradé qui porte
        // l'information sous-pixellique.
        const bord = Math.max(0, Math.min(1, disc.radius - d));
        data[y * bytesPerRow + x] = Math.round((options.background ?? 20) + (luma - (options.background ?? 20)) * bord);
      }
    }
  }

  return { data, width, height, bytesPerRow };
}

describe('trackBrightPoint — la précision, qui décide de tout', () => {
  it('🔴 retrouve le centre à mieux qu’un pixel', () => {
    const plane = planeWithDisc([{ x: 160, y: 120, radius: 9 }]);
    const found = trackBrightPoint(plane, { threshold: 120, step: 1 });

    expect(found).not.toBeNull();
    expect(Math.abs(found!.x - 160)).toBeLessThan(1);
    expect(Math.abs(found!.y - 120)).toBeLessThan(1);
  });

  it('🔴 sous-pixellique : un centre à 100,5 px n’est pas arrondi à 100', () => {
    const plane = planeWithDisc([{ x: 100.5, y: 60.5, radius: 9 }]);
    const found = trackBrightPoint(plane, { threshold: 120, step: 1 });

    // Sans pondération par la luminance, on obtiendrait un entier — et ±0,5 px d'erreur systématique
    // à chaque image, donc du bruit injecté dans chaque vitesse.
    expect(Math.abs(found!.x - 100.5)).toBeLessThan(0.6);
    expect(Math.abs(found!.y - 60.5)).toBeLessThan(0.6);
  });

  it('tient la précision en n’examinant qu’un pixel sur quatre', () => {
    const plane = planeWithDisc([{ x: 200, y: 90, radius: 12 }]);
    const found = trackBrightPoint(plane, { threshold: 120, step: 4 });

    // 16 fois moins de pixels lus, donc 16 fois moins de travail par image — c'est ce qui décidera
    // du nombre d'images par seconde tenu sur un Android moyen.
    expect(Math.abs(found!.x - 200)).toBeLessThan(1.5);
    expect(Math.abs(found!.y - 90)).toBeLessThan(1.5);
  });

  it('🔴 lit correctement une image dont les lignes sont alignées (bytesPerRow > width)', () => {
    const serre = planeWithDisc([{ x: 80, y: 60, radius: 8 }], { padding: 0 });
    const aligne = planeWithDisc([{ x: 80, y: 60, radius: 8 }], { padding: 48 });

    const a = trackBrightPoint(serre, { threshold: 120, step: 1 })!;
    const b = trackBrightPoint(aligne, { threshold: 120, step: 1 })!;

    // Lire une image alignée comme un rectangle compact décale chaque ligne un peu plus que la
    // précédente : l'image paraît cisaillée et le point dérive. L'erreur classique de ce code-là.
    expect(Math.abs(a.x - b.x)).toBeLessThan(0.01);
    expect(Math.abs(a.y - b.y)).toBeLessThan(0.01);
  });
});

describe('trackBrightPoint — ce qu’il refuse de suivre', () => {
  it('🔴 rend null sur une image sans rien de clair : c’est un trou, pas une position', () => {
    const plane = planeWithDisc([], {});
    expect(trackBrightPoint(plane, { threshold: 120, step: 1 })).toBeNull();
  });

  it('rend null sur un reflet minuscule', () => {
    const plane = planeWithDisc([{ x: 50, y: 50, radius: 0.8 }]);
    const found = trackBrightPoint(plane, { threshold: 120, step: 1 });

    // Deux ou trois pixels ne font pas une pastille. Sans ce garde-fou, la trajectoire suivrait
    // n'importe quelle poussière brillante, et paraîtrait pourtant crédible.
    expect(found === null || found.pixels < TRACK_DEFAULT_MIN_PIXELS).toBe(true);
  });

  it('🔴 le néon du plafond ne vole pas le suivi', () => {
    // Le plafond est PLUS brillant que la pastille, et il ne bouge pas.
    const plane = planeWithDisc([
      { x: 60, y: 20, radius: 16, luma: 255 },
      { x: 220, y: 150, radius: 10, luma: 200 },
    ]);

    const sansAccrochage = trackBrightPoint(plane, { threshold: 120, step: 1 })!;
    const avecAccrochage = trackBrightPoint(plane, {
      threshold: 120,
      step: 1,
      previous: { x: 222, y: 148 },
      searchRadius: 40,
    })!;

    // Sans accrochage, le centre de gravité est tiré vers la lampe ; avec, on reste sur la barre.
    expect(Math.abs(sansAccrochage.x - 220)).toBeGreaterThan(20);
    expect(Math.abs(avecAccrochage.x - 220)).toBeLessThan(1.5);
    expect(Math.abs(avecAccrochage.y - 150)).toBeLessThan(1.5);
  });

  it('la zone de recherche exclut ce qui est hors cadre utile', () => {
    const plane = planeWithDisc([
      { x: 30, y: 30, radius: 12 },
      { x: 250, y: 180, radius: 12 },
    ]);

    const found = trackBrightPoint(plane, {
      threshold: 120,
      step: 1,
      region: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    })!;

    expect(Math.abs(found.x - 250)).toBeLessThan(1.5);
  });
});

describe('suggestThreshold', () => {
  it('propose un seuil sous le point le plus clair de l’image', () => {
    const plane = planeWithDisc([{ x: 160, y: 120, radius: 20, luma: 240 }]);
    const seuil = suggestThreshold(plane, 0.8, 2);

    expect(seuil).toBeGreaterThan(150);
    expect(seuil).toBeLessThan(240);
  });

  it('🔴 ne descend jamais assez bas pour suivre le bruit d’une image sombre', () => {
    const noire: LumaPlane = {
      data: new Uint8Array(320 * 240).fill(12),
      width: 320,
      height: 240,
      bytesPerRow: 320,
    };

    // 80 % de 12 ferait un seuil de 10 : chaque pixel de l'image deviendrait « la pastille ».
    expect(suggestThreshold(noire)).toBeGreaterThanOrEqual(60);
  });
});
