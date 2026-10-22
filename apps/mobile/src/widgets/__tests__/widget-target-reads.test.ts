/**
 * US CIBLE-01 — **test-garde** des lectures du « Restant » du widget (spec R6).
 *
 * Pour sa cible, le widget lit comme l'app : séances, courses, activités, séances planifiées, pesées et
 * périodes passent par les constantes SQL des hooks, importées — jamais par une requête réécrite ici, qui
 * finirait par retenir d'autres lignes que l'app. Restent propres au widget : sa série, sa séance du jour,
 * et la lecture du profil, du profil nutritionnel et des repas du jour.
 *
 * Et son graphe d'imports reste léger : le widget est enregistré avant expo-router (`index.js`), et
 * `workout-repository` / `run-repository` tirent Health Connect, l'analytique, `react-i18next`, et
 * referment un cycle avec `refresh-home-widget`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('src/widgets/home-widget-data.ts'), 'utf-8');
const start = source.indexOf('async function computeKcalRemainingMetric(');
const body = source.slice(start);

describe('le « Restant » du widget lit comme l’app', () => {
  it('aucune requête réécrite sur les tables de la cible', () => {
    expect(start).toBeGreaterThan(0);
    for (const table of ['workouts', 'runs', 'activities', 'planned_sessions', 'body_weight_entries', 'real_life_periods']) {
      expect({ table, inline: new RegExp(`FROM\\s+${table}\\b`, 'i').test(body) }).toEqual({ table, inline: false });
    }
  });

  it('les constantes des hooks, importées', () => {
    for (const name of ['SELECT_WORKOUTS', 'SELECT_RUNS', 'SELECT_RUN_HISTORY', 'SELECT_ACTIVITIES', 'SELECT_PLANNED_DAYS_BETWEEN', 'SELECT_WEIGHT_ENTRIES', 'SELECT_PERIODS']) {
      expect({ name, used: body.includes(name) }).toEqual({ name, used: true });
    }
  });

  it('ni `workout-repository`, ni `run-repository`, ni `planned-session-repository`', () => {
    for (const heavy of ['workout-repository', 'run-repository', 'planned-session-repository']) {
      expect({ heavy, imported: source.includes(`/${heavy}'`) }).toEqual({ heavy, imported: false });
    }
  });

  it('aucune formule de cible importée (spec R1)', () => {
    const shared = /import \{([^}]*)\} from '@wellness\/shared'/.exec(source)?.[1] ?? '';
    const imported = shared.split(',').map((name) => name.replace(/^\s*type\s+/, '').trim());
    for (const formula of ['tdee', 'sportFreeTdee', 'targetCalories', 'effectiveNutritionObjective', 'computeAge', 'isRealLifeDay', 'objectiveFromGoal', 'trainingDayCalories', 'dayCalorieBonus', 'estimateRunCalories']) {
      expect({ formula, imported: imported.includes(formula) }).toEqual({ formula, imported: false });
    }
    expect(imported).toContain('composeCalorieTargetsForDays');
  });
});
