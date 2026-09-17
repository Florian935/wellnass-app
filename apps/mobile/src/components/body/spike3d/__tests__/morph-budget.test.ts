/**
 * Spike 3D — quelles influences de morph three applique **réellement**.
 *
 * C'est la mesure centrale du spike, et jusqu'ici elle reposait sur « comptez à l'œil combien de
 * zones bougent ». On peut faire mieux : la sélection de three r128 est déterministe et tient en
 * quelques lignes, donc on la rejoue et on **affiche** les cibles ignorées.
 *
 * L'algorithme de `WebGLMorphtargets.update` (r128) : trier toutes les influences par **valeur
 * absolue décroissante**, garder les 8 premières **non nulles**, mettre les autres à zéro. Aucune
 * erreur, aucun avertissement — d'où l'intérêt de le dire à l'écran.
 */

import {
  MORPH_LIMIT_R128,
  morphBudget,
} from '../morph-budget';

const influence = (name: string, value: number) => ({ name, value });

describe('morphBudget — ce que three garde et ce qu’il jette', () => {
  it('applique tout tant qu’on reste sous le plafond', () => {
    const budget = morphBudget([
      influence('a', 1),
      influence('b', -0.5),
      influence('c', 0.25),
    ]);

    expect(budget.applied).toEqual(['a', 'b', 'c']);
    expect(budget.ignored).toEqual([]);
    expect(budget.overflow).toBe(false);
  });

  it('ignore les influences nulles : elles ne consomment aucun emplacement', () => {
    const budget = morphBudget([
      ...Array.from({ length: 10 }, (_, i) => influence(`vide${i}`, 0)),
      influence('a', 1),
      influence('b', 1),
    ]);

    expect(budget.applied).toEqual(['a', 'b']);
    expect(budget.ignored).toEqual([]);
  });

  // 🔴 Le cas qui compte : 14 demandées, 8 appliquées, 6 jetées en silence.
  it('garde les 8 plus fortes en valeur absolue et nomme les sacrifiées', () => {
    const budget = morphBudget([
      influence('p1', 0.9),
      influence('p2', 0.8),
      influence('p3', 0.7),
      influence('p4', 0.6),
      influence('p5', 0.5),
      influence('p6', 0.4),
      influence('p7', 0.3),
      influence('p8', 0.2),
      influence('p9', 0.1),
      influence('p10', 0.05),
    ]);

    expect(budget.applied).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']);
    expect(budget.ignored).toEqual(['p9', 'p10']);
    expect(budget.overflow).toBe(true);
  });

  // Une valeur négative pèse autant qu'une positive : three trie sur la valeur ABSOLUE. Une
  // proportion à −2 est donc aussi « prioritaire » qu'une intention à +4.
  it('traite une influence négative à égalité avec sa jumelle positive', () => {
    const budget = morphBudget([
      ...Array.from({ length: 8 }, (_, i) => influence(`faible${i}`, 0.1)),
      influence('fort', -1),
    ]);

    expect(budget.applied[0]).toBe('fort');
    expect(budget.ignored).toHaveLength(1);
  });

  // À égalité stricte, le tri de JavaScript est stable : l'ordre de déclaration tranche. C'est
  // exactement le cas de « tout pousser au max », où les 14 valent 1.
  it('à égalité, l’ordre de déclaration décide — le cas « tout au max »', () => {
    const quatorze = [
      'prop_shoulders', 'prop_chest', 'prop_waist', 'prop_hips',
      'prop_arms', 'prop_thighs', 'prop_calves',
      'goal_shoulders', 'goal_chest', 'goal_back',
      'goal_arms', 'goal_glutes', 'goal_thighs', 'goal_calves',
    ].map((name) => influence(name, 1));

    const budget = morphBudget(quatorze);

    expect(budget.applied).toHaveLength(MORPH_LIMIT_R128);
    expect(budget.ignored).toEqual([
      'goal_chest', 'goal_back', 'goal_arms', 'goal_glutes', 'goal_thighs', 'goal_calves',
    ]);
  });

  it('ne signale pas de débordement quand exactement 8 sont demandées', () => {
    const budget = morphBudget(
      Array.from({ length: 8 }, (_, i) => influence(`m${i}`, 1)),
    );

    expect(budget.overflow).toBe(false);
    expect(budget.ignored).toEqual([]);
  });
});
