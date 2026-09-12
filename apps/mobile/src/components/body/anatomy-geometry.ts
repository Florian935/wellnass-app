/**
 * CORPS-01 — coordonnées anatomiques communes aux cartes et au journal sensible.
 * Tracés MIT figés : voir vendor/README.md et vendor/LICENSE.
 * Les sous-parties restent graphiques : aucun nouvel identifiant métier.
 */
import type { FineMuscle, PainJointZone } from '@wellness/shared';
import paths from './vendor/anatomy-paths.json';

export type AnatomySide = 'front' | 'back';
export const ANATOMY_VIEW_BOX = '0 80 724 1290';
export const ANATOMY_ASPECT_RATIO = 724 / 1290;

type Region = { slug: string; muscle?: FineMuscle; paths: string[] };
const MUSCLE_MAPPING: Record<string, FineMuscle> = {
  chest: 'chest', obliques: 'abs', abs: 'abs', biceps: 'biceps',
  deltoids: 'shoulders', quadriceps: 'quadriceps', trapezius: 'back',
  'upper-back': 'back', 'lower-back': 'back', triceps: 'triceps',
  gluteal: 'glutes', hamstring: 'hamstrings', calves: 'calves',
};

function regions(source: typeof paths.bodyFront): Region[] {
  return source.filter(({ slug }) => slug !== 'hair' && slug !== 'head').map(({ slug, path }) => ({
    slug, muscle: MUSCLE_MAPPING[slug], paths: Object.values(path).flat(),
  }));
}

export const ANATOMY_REGIONS: Record<AnatomySide, Region[]> = {
  front: regions(paths.bodyFront), back: regions(paths.bodyBack),
};
export const ANATOMY_OUTLINE: Record<AnatomySide, string> = {
  front: paths.outlines[0]!, back: paths.outlines[1]!,
};
// La planche source place le dos 720 unités à droite de la face.
export const ANATOMY_TRANSLATE_X: Record<AnatomySide, number> = { front: 0, back: -720 };
// Tête unifiée sans chevelure : surface neutre cohérente avec le mannequin de la maquette.
export const ANATOMY_HEAD = 'M310 169 C303 164 300 172 303 183 C305 194 310 204 316 208 L320 211 C320 228 328 239 343 249 Q363 262 383 249 C399 240 408 227 408 211 L413 207 C420 196 425 185 425 176 Q426 164 417 169 C423 144 419 120 405 108 C393 98 378 95 363 96 C344 95 325 101 315 115 C306 130 306 150 310 169 Z';

/** Centres normalisés après translation du dos, utilisés aussi dans le rendu QA. */
export const ANATOMY_JOINTS: Record<PainJointZone, { x: number; y: number; bilateral: boolean; sides: AnatomySide[] }> = {
  neck: { x: 362, y: 274, bilateral: false, sides: ['front', 'back'] },
  shoulder_joint: { x: 231, y: 349, bilateral: true, sides: ['front', 'back'] },
  elbow: { x: 198, y: 505, bilateral: true, sides: ['front', 'back'] },
  wrist: { x: 140, y: 692, bilateral: true, sides: ['front', 'back'] },
  lower_back: { x: 362, y: 591, bilateral: false, sides: ['back'] },
  hip: { x: 273, y: 696, bilateral: true, sides: ['front', 'back'] },
  knee: { x: 291, y: 960, bilateral: true, sides: ['front', 'back'] },
  ankle: { x: 287, y: 1253, bilateral: true, sides: ['front', 'back'] },
};
