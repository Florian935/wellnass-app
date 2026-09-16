/**
 * Spike 3D — la logique pure qui traverse le pont du composant DOM.
 *
 * Voir [docs/specs/technical/spike-3d-corps.md](../../../../../../docs/specs/technical/spike-3d-corps.md).
 * Tout ce qui est testable a été sorti du moteur, exactement comme `scene-state.ts` l'a fait pour
 * LABO-01 : le moteur ne décide de rien, il reçoit.
 */

import {
  BODY_SPIKE_GOALS,
  BODY_SPIKE_PROPORTIONS,
  bodySpikeState,
  neutralSpikeInput,
} from '../body-spike-state';

describe('bodySpikeState — traduction des 14 paramètres CORPS-02 en influences de morph', () => {
  it('au neutre, aucune influence n’est demandée', () => {
    const state = bodySpikeState(neutralSpikeInput());

    expect(state.influences.every((influence) => influence.value === 0)).toBe(true);
    expect(state.requested).toBe(0);
  });

  // Une proportion vit dans [-2, +2] : elle est **signée**. On la rend par UNE seule cible de morph
  // et une influence négative, plutôt que par deux cibles opposées. C'est la décision qui décide de
  // tout le reste : 7 proportions + 7 intentions = 14 morphs, contre 21 avec deux cibles par
  // proportion. Et 21 franchirait le plafond des 8 encore plus vite.
  it('une proportion signée devient une influence signée, normalisée sur [-1, 1]', () => {
    const state = bodySpikeState({ ...neutralSpikeInput(), proportions: { shoulders: 2 } });
    const shoulders = state.influences.find((i) => i.name === 'prop_shoulders');

    expect(shoulders?.value).toBe(1);
    expect(bodySpikeState({ ...neutralSpikeInput(), proportions: { shoulders: -2 } })
      .influences.find((i) => i.name === 'prop_shoulders')?.value).toBe(-1);
    expect(bodySpikeState({ ...neutralSpikeInput(), proportions: { waist: -1 } })
      .influences.find((i) => i.name === 'prop_waist')?.value).toBe(-0.5);
  });

  it('une intention ne va que dans un sens, normalisée sur [0, 1]', () => {
    const state = bodySpikeState({ ...neutralSpikeInput(), goals: { glutes: 4, arms: 1 } });

    expect(state.influences.find((i) => i.name === 'goal_glutes')?.value).toBe(1);
    expect(state.influences.find((i) => i.name === 'goal_arms')?.value).toBe(0.25);
  });

  it('expose les 14 cibles, toujours dans le même ordre', () => {
    const state = bodySpikeState(neutralSpikeInput());

    expect(state.influences).toHaveLength(14);
    expect(state.influences.map((i) => i.name)).toEqual([
      ...BODY_SPIKE_PROPORTIONS.map((zone) => `prop_${zone}`),
      ...BODY_SPIKE_GOALS.map((zone) => `goal_${zone}`),
    ]);
  });

  // 🔴 Le cœur du spike. `requested` compte ce que l'utilisateur demande ; c'est le moteur qui
  // dira combien ont RÉELLEMENT été appliquées. L'écart entre les deux est la mesure : three r128
  // ne tient que 8 influences simultanées par maillage, et ignore le reste **sans erreur**.
  it('compte les influences demandées, y compris négatives', () => {
    const state = bodySpikeState({
      ...neutralSpikeInput(),
      proportions: { shoulders: 2, waist: -1.5, thighs: 0.25 },
      goals: { glutes: 3, arms: 2 },
    });

    expect(state.requested).toBe(5);
  });

  it('borne les valeurs hors plage au lieu de les laisser passer au moteur', () => {
    const state = bodySpikeState({
      ...neutralSpikeInput(),
      proportions: { chest: 9 },
      goals: { back: -3 },
    });

    expect(state.influences.find((i) => i.name === 'prop_chest')?.value).toBe(1);
    expect(state.influences.find((i) => i.name === 'goal_back')?.value).toBe(0);
  });
});

describe('frontière du composant DOM', () => {
  // Une fonction ou un `undefined` traverse la frontière WebView **sans erreur et sans valeur** :
  // la scène afficherait alors un corps muet, impossible à diagnostiquer. Ce test est le seul
  // filet — c'est le patron de `scene-state.test.ts`, repris tel quel.
  it('🔴 l’état est intégralement sérialisable', () => {
    const state = bodySpikeState({
      variant: 'split',
      reducedMotion: true,
      proportions: { shoulders: 2, waist: -1.5, calves: 0.75 },
      goals: { glutes: 4, back: 2 },
    });

    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('🔴 aucune valeur de l’état n’est une fonction ni `undefined`', () => {
    const state = bodySpikeState(neutralSpikeInput());
    const suspectes: string[] = [];

    const visiter = (valeur: unknown, chemin: string) => {
      if (typeof valeur === 'function' || valeur === undefined) suspectes.push(chemin);
      else if (Array.isArray(valeur)) valeur.forEach((v, i) => visiter(v, `${chemin}[${i}]`));
      else if (valeur && typeof valeur === 'object')
        for (const [cle, v] of Object.entries(valeur)) visiter(v, `${chemin}.${cle}`);
    };
    visiter(state, 'state');

    expect(suspectes).toEqual([]);
  });
});
