/**
 * Spike 3D — le cadrage du corps dans la vue.
 *
 * Ce fichier existe parce qu'une erreur de cadrage a coûté une recette le 16/09/2026 : la tête du
 * modèle sortait de l'écran. La cause n'était pas visuelle mais **arithmétique** — la transformation
 * locale d'un objet three est `T · R · S`, donc la géométrie est mise à l'échelle **autour de
 * l'origine de l'objet** puis translatée. Soustraire le centre avant de mettre à l'échelle laisse un
 * résidu de `centre × (échelle − 1)`.
 *
 * Or ce calcul est du calcul pur : il n'a aucune raison de vivre dans un moteur WebGL non testable.
 * Il est donc sorti ici, et vérifié en appliquant **le même ordre que three** — mise à l'échelle,
 * puis translation — pour constater que le corps tombe bien dans le cadre.
 */

import { fitToView } from '../fit-to-view';

/** Reproduit `T · S` de three : un point local `p` atterrit en `p × échelle + position`. */
const projeter = (
  point: { x: number; y: number; z: number },
  ajustement: ReturnType<typeof fitToView>,
) => ({
  x: point.x * ajustement.scale + ajustement.position.x,
  y: point.y * ajustement.scale + ajustement.position.y,
  z: point.z * ajustement.scale + ajustement.position.z,
});

/** Un corps debout de 1,80 m, pieds à y = 0, centré en x et z. */
const CORPS = { min: { x: -0.4, y: 0, z: -0.2 }, max: { x: 0.4, y: 1.8, z: 0.2 } };

/** La caméra du spike : champ vertical de 32°, à 7,2 unités, l'œil à y = 0,2. */
const CAMERA = { fov: 32, distance: 7.2, y: 0.2 };

/** Hauteur réellement visible à cette distance. */
const hauteurVisible = 2 * CAMERA.distance * Math.tan((CAMERA.fov * Math.PI) / 360);

describe('fitToView — le corps tient dans le cadre, quelle que soit sa taille', () => {
  it('centre le corps sur la hauteur du regard, pas sur y = 0', () => {
    const ajustement = fitToView(CORPS, CAMERA);

    const bas = projeter({ x: 0, y: CORPS.min.y, z: 0 }, ajustement);
    const haut = projeter({ x: 0, y: CORPS.max.y, z: 0 }, ajustement);

    expect((bas.y + haut.y) / 2).toBeCloseTo(CAMERA.y, 6);
  });

  // 🔴 Le test qui aurait attrapé le défaut du 16/09 : la tête sortait par le haut.
  it('laisse le corps entièrement dans le champ visible', () => {
    const ajustement = fitToView(CORPS, CAMERA);

    const haut = projeter({ x: 0, y: CORPS.max.y, z: 0 }, ajustement).y;
    const bas = projeter({ x: 0, y: CORPS.min.y, z: 0 }, ajustement).y;
    const plafond = CAMERA.y + hauteurVisible / 2;
    const plancher = CAMERA.y - hauteurVisible / 2;

    expect(haut).toBeLessThan(plafond);
    expect(bas).toBeGreaterThan(plancher);
  });

  it('garde une marge : le corps occupe 82 % de la hauteur visible, pas 100 %', () => {
    const ajustement = fitToView(CORPS, CAMERA);
    const hauteurRendue =
      projeter({ x: 0, y: CORPS.max.y, z: 0 }, ajustement).y -
      projeter({ x: 0, y: CORPS.min.y, z: 0 }, ajustement).y;

    expect(hauteurRendue / hauteurVisible).toBeCloseTo(0.82, 3);
  });

  it('recentre aussi un corps décentré en x et en z', () => {
    const decale = { min: { x: 1, y: 0, z: 5 }, max: { x: 1.8, y: 1.8, z: 5.4 } };
    const ajustement = fitToView(decale, CAMERA);

    const centre = projeter({ x: 1.4, y: 0.9, z: 5.2 }, ajustement);

    expect(centre.x).toBeCloseTo(0, 6);
    expect(centre.z).toBeCloseTo(0, 6);
  });

  it('cadre pareil un modèle exporté à une tout autre échelle', () => {
    // Le même corps en centimètres plutôt qu'en mètres : le cadrage doit être identique à l'écran.
    const enCm = { min: { x: -40, y: 0, z: -20 }, max: { x: 40, y: 180, z: 20 } };

    const metres = fitToView(CORPS, CAMERA);
    const centimetres = fitToView(enCm, CAMERA);

    const hautM = projeter({ x: 0, y: CORPS.max.y, z: 0 }, metres).y;
    const hautCm = projeter({ x: 0, y: enCm.max.y, z: 0 }, centimetres).y;
    expect(hautCm).toBeCloseTo(hautM, 6);
  });

  it('ne divise jamais par zéro sur un modèle plat ou vide', () => {
    const plat = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };

    const ajustement = fitToView(plat, CAMERA);

    expect(Number.isFinite(ajustement.scale)).toBe(true);
    expect(Number.isFinite(ajustement.position.y)).toBe(true);
  });
});
