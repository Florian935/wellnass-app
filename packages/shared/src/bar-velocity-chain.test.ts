import { describe, it, expect } from 'vitest';
import { analyseSet } from './bar-velocity';
import { trackBrightPoint, type LumaPlane } from './bar-tracker';

/**
 * Spike VBT-01 — **la chaîne entière**, d'une image de caméra à la décision d'arrêter la série.
 *
 * Les deux autres fichiers testent chacun une moitié : le suivi d'un point sur une image
 * ([bar-tracker](./bar-tracker.ts)) et la trajectoire transformée en vitesses
 * ([bar-velocity](./bar-velocity.ts)). Celui-ci les **branche l'un sur l'autre** sur une vidéo
 * fabriquée : une pastille claire qui monte et descend à une vitesse connue, image par image.
 *
 * C'est la seule façon d'attraper les erreurs qui n'existent que dans le raccord — l'axe vertical
 * inversé entre le repère image et le monde réel, l'échelle pixels → mètres, un pixel de décalage
 * accumulé par ligne. Aucune ne se voit dans une moitié prise isolément, et toutes rendent des
 * vitesses parfaitement crédibles.
 *
 * Ce qui reste hors de portée ici, et n'appartient qu'à l'essai device : l'éclairage réel, les
 * disques qui tournent, la barre masquée par le corps, la cadence tenue par le téléphone, la chauffe.
 */

const LARGEUR = 240;
const HAUTEUR = 180;
const LIGNE = LARGEUR + 16; // padding d'alignement, comme une vraie caméra

/** Le disque de 45 cm occupe 100 px : l'échelle de la scène. */
const DISQUE_PX = 100;
const MPP = 0.45 / DISQUE_PX;

/** Dessine une image : fond sombre + pastille claire au centre donné. */
function frame(cx: number, cy: number, rayon = 6): LumaPlane {
  const data = new Uint8Array(LIGNE * HAUTEUR).fill(25);
  const r = Math.ceil(rayon) + 1;
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(HAUTEUR - 1, cy + r); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(LARGEUR - 1, cx + r); x += 1) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > rayon) continue;
      const bord = Math.max(0, Math.min(1, rayon - d));
      data[y * LIGNE + x] = Math.round(25 + 220 * bord);
    }
  }
  return { data, width: LARGEUR, height: HAUTEUR, bytesPerRow: LIGNE };
}

/**
 * Joue une série devant la caméra simulée et rend ce que le suivi en a tiré.
 * Le repère est celui de l'image : la barre monte, donc `y` **diminue**.
 */
function filmer(vitesses: readonly number[], { fps = 30, rangeM = 0.6 } = {}) {
  const dt = 1 / fps;
  const basPx = HAUTEUR - 25; // barre en bas du cadre
  const echelle = 1 / MPP; // mètres → pixels

  const samples: Array<{ t: number; y: number | null }> = [];
  let precedent: { x: number; y: number } | null = null;
  let t = 0;

  const capturer = (hauteurM: number) => {
    const image = frame(LARGEUR / 2, basPx - hauteurM * echelle);
    const trouve = trackBrightPoint(image, {
      threshold: 120,
      step: 2,
      previous: precedent,
      searchRadius: 60,
    });
    precedent = trouve === null ? null : { x: trouve.x, y: trouve.y };
    samples.push({ t: Math.round(t * 1000), y: trouve === null ? null : trouve.y });
    t += dt;
  };

  for (const v of vitesses) {
    const downS = rangeM / 0.4;
    for (let s = 0; s < downS; s += dt) capturer(rangeM * (1 - s / downS));
    for (let s = 0; s < 0.3; s += dt) capturer(0);
    const upS = rangeM / v;
    for (let s = 0; s < upS; s += dt) capturer((rangeM / 2) * (1 - Math.cos((Math.PI * s) / upS)));
    for (let s = 0; s < 0.5; s += dt) capturer(rangeM);
  }

  return samples;
}

describe('la chaîne complète : pixels → vitesses → décision', () => {
  it('🔴 compte les répétitions et retrouve leurs vitesses depuis des IMAGES', () => {
    const vraies = [0.6, 0.5, 0.4];
    const { reps, quality } = analyseSet(filmer(vraies), { metersPerPixel: MPP });

    expect(quality.lostFrames).toBe(0);
    expect(reps).toHaveLength(3);
    reps.forEach((rep, i) => {
      expect(Math.abs(rep.meanVelocity - vraies[i]!)).toBeLessThanOrEqual(0.05);
    });
  });

  it('🔴 l’axe est dans le bon sens : une barre qui MONTE donne une vitesse positive', () => {
    // Le repère image descend, le monde monte. Une inversion oubliée ici ne détecterait plus une
    // seule répétition — ou, pire, détecterait les descentes en croyant mesurer les montées.
    const { reps } = analyseSet(filmer([0.5]), { metersPerPixel: MPP });

    expect(reps).toHaveLength(1);
    expect(reps[0]!.meanVelocity).toBeGreaterThan(0);
    // La descente dure 1,5 s à 0,4 m/s : si l'axe était inversé, c'est ELLE qu'on mesurerait.
    expect(Math.abs(reps[0]!.meanVelocity - 0.5)).toBeLessThanOrEqual(0.05);
  });

  it('l’échelle tient : l’amplitude mesurée est bien celle du mouvement joué', () => {
    const { reps } = analyseSet(filmer([0.5], { rangeM: 0.45 }), { metersPerPixel: MPP });

    // 0,45 m joué, soit exactement le diamètre du disque qui sert d'étalon : une erreur d'échelle
    // se lirait directement ici.
    expect(Math.abs(reps[0]!.rangeM - 0.45)).toBeLessThan(0.03);
  });

  it('la décision d’arrêt survit au passage par les images', () => {
    const { velocityLossPct, stop } = analyseSet(filmer([0.6, 0.55, 0.45, 0.39]), {
      metersPerPixel: MPP,
    });

    // Perte réelle : 35 %. Le seuil de 20 % doit être franchi sans ambiguïté.
    expect(velocityLossPct).not.toBeNull();
    expect(Math.abs((velocityLossPct as number) - 35)).toBeLessThanOrEqual(5);
    expect(stop).toBe(true);
  });

  it('🔴 une pastille qui sort du cadre devient un TROU, jamais une position inventée', () => {
    const samples = filmer([0.5]);
    // On coupe 5 images en pleine montée, comme si le corps passait devant la barre.
    const montee = samples.filter((s) => s.y !== null);
    const debut = montee[Math.floor(montee.length * 0.75)]!.t;
    const troue = samples.map((s) =>
      s.t >= debut && s.t < debut + 120 ? { t: s.t, y: null } : s,
    );

    const { reps, quality } = analyseSet(troue, { metersPerPixel: MPP });

    expect(quality.lostFrames).toBeGreaterThan(0);
    expect(reps).toHaveLength(1);
    expect(reps[0]!.interpolated).toBe(true);
  });
});
