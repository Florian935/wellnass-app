/**
 * US GUID-01 / CONS-01 — les deux issues d'une contradiction d'objectifs, en un seul endroit.
 *
 * Extrait de `GoalConflictBanner` par LIENS-01 (30/09/2026) : la fiche « Tes objectifs tirent-ils dans
 * le même sens ? » du Labo propose les mêmes deux issues que la carte de l'accueil. Les écrire deux
 * fois, c'était prendre le risque qu'un même choix n'écrive pas la même chose selon l'écran.
 */

import type { GoalConflict } from '@wellness/shared';

import { upsertProfile } from '@/data/repositories/profile-repository';
import { upsertNutritionProfile } from '@/data/repositories/nutrition-repository';
import { upsertRunnerProfile } from '@/data/repositories/running-profile-repository';

/** L'objectif principal gagne : le réglage du pilier s'y aligne. */
export async function keepMainGoal(conflict: GoalConflict): Promise<void> {
  if (conflict.rule === 'bulkVsCut') {
    // L'objectif global gagne : la nutrition passe en surplus.
    await upsertNutritionProfile({ objective: 'bulk' });
  } else {
    // L'objectif global gagne : la course redevient de l'endurance d'entretien, sans échéance
    // de course longue qui imposerait son volume.
    await upsertRunnerProfile({ objective: 'endurance' });
  }
}

/** Le réglage du pilier gagne : l'objectif principal s'y aligne. */
export async function keepPillarGoal(conflict: GoalConflict): Promise<void> {
  if (conflict.rule === 'bulkVsCut') {
    // Le réglage du pilier gagne : l'objectif principal s'aligne sur le déficit déclaré.
    await upsertProfile({ mainGoal: 'weightloss' });
  } else {
    // Le réglage du pilier gagne : l'objectif principal devient la performance, en endurance —
    // ce que la préparation longue distance dit déjà.
    await upsertProfile({ mainGoal: 'performance', trainingFocus: 'endurance' });
  }
}
