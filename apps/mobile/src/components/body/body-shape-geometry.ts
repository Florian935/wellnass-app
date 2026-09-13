import type { BodyEmphasis, BodyShape, BodyVisualZone } from '@wellness/shared';

export const BODY_SHAPE_VIEW_BOX = '0 0 300 680';
export const BODY_SHAPE_ASPECT_RATIO = 300 / 680;
type Point = { x: number; y: number };
type Curve = { from: Point; c1: Point; c2: Point; to: Point };
export type ShapeRegion = { zone: BodyVisualZone; d: string };
const bounded = (value: number | undefined, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value!)) : 0;
const point = (x: number, y: number): Point => ({ x, y });
const mirror = (p: Point): Point => point(300 - p.x, p.y);
const xy = (p: Point) => `${+p.x.toFixed(3)} ${+p.y.toFixed(3)}`;

/** Repères graphiques, sans unité corporelle. La pose et les hauteurs sont fixes :
 * seuls les rayons transversaux changent. Une courbe unique ferme le corps entier,
 * puis les volumes et cibles sont découpés par ce contour dans le renderer. */
export function createBodyShapeGeometry(shape: BodyShape, emphasis?: BodyEmphasis, side: 'front' | 'back' = 'front') {
  const p = (zone: keyof BodyShape['proportions']) => bounded(shape.proportions[zone], -2, 2);
  const e = (zone: keyof BodyEmphasis) => bounded(emphasis?.[zone], 0, 4);
  const broad = shape.base === 'broad_shoulders' ? 1 : 0;
  const wide = shape.base === 'broad_hips' ? 1 : 0;
  const widths = {
    shoulders: 61 + broad * 7 + p('shoulders') * 3.5 + e('shoulders') * 2,
    chest: 44 + broad * 3 + p('chest') * 3.5 + e('chest') * 1.8,
    back: 42 + broad * 3 + p('chest') * 2 + e('back') * 2,
    waist: 34 + p('waist') * 4,
    hips: 44 + wide * 8 + p('hips') * 4,
    glutes: 44 + wide * 8 + p('hips') * 4 + e('glutes') * 2,
    arms: 13 + p('arms') * 2.3 + e('arms') * 1.5,
    thighs: 24 + wide * 2 + p('thighs') * 3 + e('thighs') * 1.5,
    calves: 16 + p('calves') * 2 + e('calves') * 1.3,
  };
  const { shoulders: s, chest: c, back: b, waist: w, hips: h, glutes: g, arms: a, thighs: t, calves: k } = widths;
  // Les enveloppes des deux courbes d'aisselle restent de part et d'autre de cette
  // jonction, même lorsque bras et poitrine sont tous deux à leur volume maximal.
  const innerArm = Math.max(73 - a * .5, c + 8);
  const half: Curve[] = [];
  let cursor = point(150, 18);
  // Les coordonnées ci-dessous sont relatives à l'axe central, du crâne à l'entrejambe.
  const C = (x1: number, y1: number, x2: number, y2: number, x: number, y: number) => {
    const next = point(150 + x, y);
    half.push({ from: cursor, c1: point(150 + x1, y1), c2: point(150 + x2, y2), to: next });
    cursor = next;
  };
  C(21, 18, 25, 31, 24, 52);
  C(28, 48, 28, 66, 22, 67);
  C(20, 80, 15, 85, 12, 88);
  C(12, 96, 13, 101, 20, 105);
  C(32, 112, s - 10, 113, s, 124);
  C(s + 12, 132, 79 + a, 146, 78 + a, 167);
  C(78 + a, 190, 87 + a * .75, 215, 88 + a * .65, 230);
  C(92 + a, 247, 98 + a * .6, 266, 105, 298);
  C(106, 309, 113, 317, 112, 328);
  C(115, 338, 113, 348, 109, 350);
  C(106, 353, 104, 341, 104, 335);
  C(102, 341, 105, 352, 101, 352);
  C(97, 349, 95, 337, 96, 326);
  C(94, 322, 92, 324, 93, 331);
  C(92, 336, 88, 334, 89, 327);
  C(89, 315, 96, 309, 94, 298);
  C(89, 275, 88 - a * .55, 255, 88 - a * .55, 231);
  C(Math.max(85 - a * .6, innerArm + 8), 214, Math.max(79 - a * .6, innerArm + 4), 200, innerArm, 179);
  C(innerArm - 4, 167, c + 3, 174, c, 184);
  C(c, 199, b, 205, b, 216);
  C(b, 230, w, 241, w, 254);
  C(w, 271, h, 280, h, 301);
  C(h, 310, g, 316, g, 327);
  C(g, 342, 28 + t, 352, 28 + t, 370);
  C(28 + t, 400, 44, 428, 43, 448);
  C(42, 467, 30 + k, 488, 30 + k, 509);
  C(30 + k, 542, 40, 565, 40, 595);
  C(40, 613, 42, 625, 48, 637);
  C(50, 643, 60, 650, 57, 656);
  C(54, 663, 39, 662, 31, 660);
  C(21, 658, 20, 653, 23, 644);
  C(27, 632, 23, 616, 23, 595);
  C(23, 565, 30 - k * .65, 547, 30 - k * .65, 516);
  C(30 - k * .65, 490, 17, 466, 17, 448);
  C(17, 419, 7, 397, 6, 371);
  C(6, 357, 4, 351, 0, 351);
  const curves = [...half, ...[...half].reverse().map(curve => ({ from: mirror(curve.to), c1: mirror(curve.c2), c2: mirror(curve.c1), to: mirror(curve.from) }))];
  const outline = `M 150 18 ${curves.map(curve => `C ${xy(curve.c1)} ${xy(curve.c2)} ${xy(curve.to)}`).join(' ')} Z`;
  // Demi-volumes à appliquer des deux côtés, dans le même espace que le contour.
  const regions: ShapeRegion[] = [
    { zone: 'shoulders', d: `M 19 106 C 42 111 ${s - 7} 108 ${s + 8} 126 C ${s + 17} 137 96 154 89 169 C 80 180 65 167 58 153 C 51 138 29 130 19 106 Z` },
    { zone: 'chest', d: side === 'front'
      ? `M 1 128 C 21 125 40 131 57 145 L ${c + 8} 178 C ${c} 201 17 204 3 188 Z`
      : `M 21 127 C 40 129 53 133 63 151 L ${c + 5} 184 C 37 178 25 167 21 127 Z` },
    { zone: 'back', d: side === 'back'
      ? `M 1 109 C 27 110 48 122 59 152 L ${b + 7} 218 C 34 241 10 228 2 209 Z`
      : `M ${c - 8} 177 L ${c + 7} 181 L ${b + 5} 225 L 24 230 C 29 209 33 190 ${c - 8} 177 Z` },
    { zone: 'arms', d: `M 75 161 C 110 165 108 263 109 297 L 94 306 C 81 280 69 225 62 180 Z` },
    { zone: 'waist', d: `M 1 202 C 21 201 31 208 ${b + 2} 225 L ${w + 5} 266 C 29 282 14 284 1 279 Z` },
    { zone: 'hips', d: `M 1 279 C 20 280 33 270 ${h + 4} 285 L ${g + 5} 334 C 31 351 15 351 1 340 Z` },
    { zone: 'glutes', d: `M 1 279 C 20 280 33 270 ${h + 4} 285 L ${g + 5} 334 C 31 351 15 351 1 340 Z` },
    { zone: 'thighs', d: `M 3 341 C 19 349 32 341 ${g + 4} 331 C ${35 + t} 368 53 419 42 447 C 34 457 22 457 15 445 C 15 407 3 376 3 341 Z` },
    { zone: 'calves', d: `M 17 466 C 26 457 38 458 44 473 C ${38 + k} 515 43 558 39 606 L 24 606 C 22 560 ${22 - k * .65} 514 17 466 Z` },
  ];
  const details = side === 'front' ? [
    'M 11 89 C 9 104 14 114 24 121',
    `M 5 130 C 23 125 34 129 ${s - 8} 132`,
    `M 8 190 C 22 198 36 195 ${c - 6} 189`,
    'M 1 205 C 2 223 2 241 1 259',
    `M 3 281 C 18 288 31 285 ${h - 2} 278`,
    'M 9 347 C 18 362 21 383 20 400',
    'M 23 447 C 28 440 35 442 38 448',
    'M 29 476 C 32 521 31 555 31 583',
    'M 31 636 C 36 639 39 643 40 649',
  ] : [
    'M 10 92 C 15 111 26 118 36 124',
    `M 24 144 C 43 153 35 180 20 190`,
    'M 2 115 C 3 161 3 219 2 269',
    `M 5 320 C 14 344 32 345 ${g - 5} 329`,
    'M 23 442 C 28 448 35 448 40 444',
    `M 29 476 C ${21 - k * .3} 504 26 531 30 542`,
    'M 30 552 C 33 582 30 610 31 633',
  ];
  return { outline, curves, widths, regions, details };
}
