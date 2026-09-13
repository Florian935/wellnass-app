/**
 * Le corps qui chauffe — US MUSCU-UX03, spec §5.11.
 *
 * Chaque série validée réchauffe les muscles qu'elle sollicite : le schéma corporel de MUSC-F1b
 * devient la mémoire visuelle de la séance, et l'image de fin (partageable) en découle.
 *
 * L'échelle est **absolue et lisible**, pas normalisée : 0,2 par série pour un muscle sollicité en
 * plein, 0,1 pour un muscle secondaire, plafonné à 1. Normaliser sur le muscle le plus chaud ferait
 * virer la toute première série à l'or — la chaleur ne voudrait plus rien dire.
 */

import type { FineMuscle } from './exercise';
import type { SetType } from './workout';

/** Apport de chaleur d'une série, selon l'émphase du muscle pour l'exercice. */
export const HEAT_PER_FULL_SET = 0.2;
export const HEAT_PER_REDUCED_SET = 0.1;

export type HeatSet = { exerciseId: string; setType: SetType; done: boolean };

/** Muscles d'un exercice, tels que `resolveFineMuscles` les rend. */
export type ExerciseMuscles = { full: FineMuscle[]; reduced: FineMuscle[] };

export type SessionHeat = Partial<Record<FineMuscle, number>>;

/**
 * Chaleur par muscle fin, à partir des séries **validées** (hors échauffement — un échauffement ne
 * « travaille » pas le muscle au sens où on l'entend ici).
 *
 * Une série à la durée compte : un gainage chauffe les abdominaux, même sans charge.
 */
export function computeSessionHeat(
  sets: ReadonlyArray<HeatSet>,
  musclesByExercise: Readonly<Record<string, ExerciseMuscles>>,
): SessionHeat {
  const heat: SessionHeat = {};
  const add = (muscle: FineMuscle, amount: number): void => {
    heat[muscle] = Math.min(1, (heat[muscle] ?? 0) + amount);
  };

  for (const set of sets) {
    if (!set.done || set.setType === 'warmup') continue;
    const muscles = musclesByExercise[set.exerciseId];
    if (!muscles) continue;
    for (const muscle of muscles.full) add(muscle, HEAT_PER_FULL_SET);
    for (const muscle of muscles.reduced) {
      // Un muscle plein pour un exercice et réduit pour un autre cumule les deux apports : c'est
      // bien ce qu'on veut (le triceps du couché PUIS du militaire chauffe deux fois).
      add(muscle, HEAT_PER_REDUCED_SET);
    }
  }

  return heat;
}

/**
 * Les muscles les plus chauds, pour la légende écrite qui double la couleur (accessibilité : la
 * couleur ne porte jamais seule l'information). Ordre décroissant, puis alphabétique pour rester
 * déterministe à égalité.
 */
export function hottestMuscles(heat: SessionHeat, count = 2): FineMuscle[] {
  return (Object.keys(heat) as FineMuscle[])
    .filter((muscle) => (heat[muscle] ?? 0) > 0)
    .sort((a, b) => {
      const delta = (heat[b] ?? 0) - (heat[a] ?? 0);
      return delta !== 0 ? delta : a.localeCompare(b);
    })
    .slice(0, count);
}
