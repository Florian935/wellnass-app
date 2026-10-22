/**
 * US CIBLE-01 — **test-garde R1** : aucune formule de la cible du jour hors des compositions.
 *
 * L'historique (`dashboard-repository.ts`), le planning repas et le widget d'écran d'accueil recalculaient
 * la cible chacun à leur façon, et leurs règles avaient dérivé (autres activités oubliées, socle `tdee`
 * quel que soit le mode, séances sautées comptées, poids de la dernière pesée). Ils passent désormais par
 * `composeCalorieTargetsForDays` (ou, pour un jour, `composeDayCalorieTarget`). Ce test refuse qu'une des
 * briques de calcul de la cible revienne dans leurs imports : ce serait le début d'une seconde définition.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FILES = [
  'src/data/repositories/dashboard-repository.ts',
  'src/app/meal-plan/index.tsx',
  'src/widgets/home-widget-data.ts',
];

/** Les briques qui fabriquent une cible du jour — réservées aux compositions de `@wellness/shared`. */
const FORBIDDEN = [
  'tdee',
  'sportFreeTdee',
  'basalMetabolicRate',
  'activityFactor',
  'targetCalories',
  'effectiveNutritionObjective',
  'objectiveFromGoal',
  'isRealLifeDay',
  'isTrainingDay',
  'trainingDayCalories',
  'dayCalorieBonus',
  'estimateRunCalories',
  'computeAge',
  'DEFAULT_SPORT_FREE_LEVEL',
  'computeEffectiveTargetForDay',
];

/** Les noms importés de `@wellness/shared` par un fichier (les `type` compris, sans le mot-clé). */
function sharedImports(file: string): string[] {
  const source = readFileSync(resolve(file), 'utf-8');
  const names: string[] = [];
  for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*'@wellness\/shared'/g)) {
    for (const raw of match[1]!.split(',')) {
      const name = raw.replace(/^\s*type\s+/, '').split(/\s+as\s+/)[0]!.trim();
      if (name) names.push(name);
    }
  }
  return names;
}

describe.each(FILES)('%s', (file) => {
  it('importe des briques de `@wellness/shared` (le test lit bien le fichier)', () => {
    expect(sharedImports(file).length).toBeGreaterThan(0);
  });

  it('n’importe aucune brique de calcul de la cible du jour', () => {
    const imported = new Set(sharedImports(file));
    expect(FORBIDDEN.filter((name) => imported.has(name))).toEqual([]);
  });
});
