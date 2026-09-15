import { describe, expect, it } from 'vitest';
import {
  GOAL_CONFLICT_RULES,
  detectGoalConflicts,
  firstVisibleConflict,
  type GoalConflictInput,
} from './goal-conflicts';

const NONE: GoalConflictInput = {
  mainGoal: null,
  nutritionObjective: null,
  runnerObjective: null,
};

describe('detectGoalConflicts', () => {
  it('ne voit aucun conflit quand rien n’est renseigné', () => {
    expect(detectGoalConflicts(NONE)).toEqual([]);
  });

  it('détecte masse ↔ sèche', () => {
    const found = detectGoalConflicts({ ...NONE, mainGoal: 'muscle', nutritionObjective: 'cut' });
    expect(found).toHaveLength(1);
    expect(found[0]?.rule).toBe('bulkVsCut');
    expect(found[0]?.left).toBe('goal.muscle');
    expect(found[0]?.right).toBe('nutrition.cut');
  });

  it('détecte aussi masse ↔ perte de poids (l’autre objectif en déficit)', () => {
    const found = detectGoalConflicts({
      ...NONE,
      mainGoal: 'muscle',
      nutritionObjective: 'weightloss',
    });
    expect(found.map((c) => c.rule)).toEqual(['bulkVsCut']);
  });

  it('ne déclenche pas quand la nutrition est cohérente avec la masse', () => {
    expect(
      detectGoalConflicts({ ...NONE, mainGoal: 'muscle', nutritionObjective: 'bulk' }),
    ).toEqual([]);
    expect(
      detectGoalConflicts({ ...NONE, mainGoal: 'muscle', nutritionObjective: 'maintain' }),
    ).toEqual([]);
  });

  it('ne déclenche pas quand la sèche est cohérente avec l’objectif global', () => {
    expect(
      detectGoalConflicts({ ...NONE, mainGoal: 'weightloss', nutritionObjective: 'cut' }),
    ).toEqual([]);
  });

  it('détecte longue distance ↔ masse', () => {
    for (const objective of ['semi', 'marathon'] as const) {
      const found = detectGoalConflicts({ ...NONE, mainGoal: 'muscle', runnerObjective: objective });
      expect(found.map((c) => c.rule)).toEqual(['enduranceVsMass']);
      expect(found[0]?.right).toBe(`running.${objective}`);
    }
  });

  it('laisse passer les distances courtes — elles ne contrarient pas la masse', () => {
    for (const objective of ['5k', '10k', 'endurance', 'perte_poids'] as const) {
      expect(
        detectGoalConflicts({ ...NONE, mainGoal: 'muscle', runnerObjective: objective }),
      ).toEqual([]);
    }
  });

  it('peut en remonter deux à la fois', () => {
    const found = detectGoalConflicts({
      mainGoal: 'muscle',
      nutritionObjective: 'cut',
      runnerObjective: 'marathon',
    });
    expect(found).toHaveLength(2);
  });
});

describe('firstVisibleConflict', () => {
  const both = detectGoalConflicts({
    mainGoal: 'muscle',
    nutritionObjective: 'cut',
    runnerObjective: 'marathon',
  });

  it('n’en montre qu’un seul — l’accueil est plafonné (ADR-007)', () => {
    expect(firstVisibleConflict(both, [])?.rule).toBe('bulkVsCut');
  });

  it('respecte l’ordre déclaré des règles, pas l’ordre de détection', () => {
    const reversed = [...both].reverse();
    expect(firstVisibleConflict(reversed, [])?.rule).toBe(GOAL_CONFLICT_RULES[0]);
  });

  it('passe au suivant quand la règle a été rejetée', () => {
    expect(firstVisibleConflict(both, ['bulkVsCut'])?.rule).toBe('enduranceVsMass');
  });

  it('ne montre rien quand tout a été rejeté', () => {
    expect(firstVisibleConflict(both, [...GOAL_CONFLICT_RULES])).toBeNull();
  });

  it('ne montre rien quand il n’y a rien', () => {
    expect(firstVisibleConflict([], [])).toBeNull();
  });
});
