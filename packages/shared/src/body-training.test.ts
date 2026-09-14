import { describe, expect, it } from 'vitest';

import {
  BODY_TRAINING_MUSCLES,
  analyseBodyTrainingProgram,
  bodyTrainingNeedsReview,
  createBodyTrainingDocument,
  parseBodyTrainingDocument,
  suggestBodyPriorities,
  type BodyTrainingProgram,
} from './body-training';
import {
  createBodyVisualDocument,
  createBodyVisualGoal,
  type BodyGoalZone,
  type BodyVisualGoal,
} from './body-visual';

const GOAL_SAVED_AT = '2026-09-13T12:00:00.000Z';
const CONFIRMED_AT = '2026-09-13T12:01:00.000Z';

function savedGoal(): BodyVisualGoal {
  return {
    ...createBodyVisualGoal(createBodyVisualDocument()),
    savedAt: GOAL_SAVED_AT,
  };
}

describe('priorites issues de l objectif visuel', () => {
  it('suggere au plus trois accents positifs, par intensite puis ordre canonique', () => {
    const goal = savedGoal();
    goal.emphasis.arms = 4;
    goal.emphasis.shoulders = 4;
    goal.emphasis.back = 2;
    goal.emphasis.calves = 1;

    expect(suggestBodyPriorities(goal)).toEqual(['shoulders', 'arms', 'back']);
  });

  it('ne suggere rien quand toutes les emphases sont nulles', () => {
    expect(suggestBodyPriorities(savedGoal())).toEqual([]);
  });

  it('cree un document canonique sans partager le snapshot de l objectif', () => {
    const goal = savedGoal();
    const preferences = createBodyTrainingDocument(
      ['arms', 'shoulders'],
      goal,
      CONFIRMED_AT,
    );

    goal.emphasis.arms = 4;

    expect(preferences).toMatchObject({
      version: 1,
      priorities: ['shoulders', 'arms'],
      confirmedAt: CONFIRMED_AT,
    });
    expect(preferences.sourceGoal.emphasis.arms).toBe(0);
    expect(bodyTrainingNeedsReview(preferences, goal)).toBe(true);
  });

  it.each([
    { priorities: [] },
    { priorities: ['arms', 'arms'] },
    { priorities: ['shoulders', 'chest', 'back', 'arms'] },
  ])('rejette une selection hors limites ou dupliquee : %j', ({ priorities }) => {
    expect(() =>
      createBodyTrainingDocument(priorities as BodyGoalZone[], savedGoal(), CONFIRMED_AT),
    ).toThrow();
  });

  it('rejette un objectif non enregistre et un horodatage non UTC', () => {
    const goal = savedGoal();
    goal.savedAt = null;
    expect(() => createBodyTrainingDocument(['arms'], goal, CONFIRMED_AT)).toThrow();
    expect(() => createBodyTrainingDocument(['arms'], savedGoal(), '13/09/2026')).toThrow();
  });
});

describe('lecture versionnee des priorites', () => {
  it('distingue absence, document invalide et version future', () => {
    expect(parseBodyTrainingDocument(null)).toEqual({ status: 'empty', document: null });
    expect(parseBodyTrainingDocument('{')).toEqual({ status: 'invalid', document: null });
    expect(parseBodyTrainingDocument({ version: 99 })).toEqual({
      status: 'unsupported',
      document: null,
    });
  });

  it('refuse un ordre non canonique et accepte une chaine JSON valide', () => {
    const document = createBodyTrainingDocument(
      ['shoulders', 'arms'],
      savedGoal(),
      CONFIRMED_AT,
    );
    expect(
      parseBodyTrainingDocument({ ...document, priorities: ['arms', 'shoulders'] }),
    ).toEqual({ status: 'invalid', document: null });
    expect(parseBodyTrainingDocument(JSON.stringify(document))).toEqual({
      status: 'ready',
      document,
    });
  });

  it('compare le snapshot complet et signale un objectif absent', () => {
    const goal = savedGoal();
    const document = createBodyTrainingDocument(['arms'], goal, CONFIRMED_AT);

    expect(bodyTrainingNeedsReview(document, structuredClone(goal))).toBe(false);
    expect(bodyTrainingNeedsReview(document, null)).toBe(true);

    const redated = structuredClone(goal);
    redated.savedAt = '2026-09-13T13:00:00.000Z';
    expect(bodyTrainingNeedsReview(document, redated)).toBe(true);
  });
});

describe('analyse factuelle d un passage dans le programme', () => {
  const program: BodyTrainingProgram = {
    id: 'program-1',
    name: 'Haut et bas du corps',
    sessions: [
      {
        id: 'session-1',
        name: 'Seance A',
        plans: [
          {
            id: 'arms',
            exerciseId: 'curl-extension',
            exerciseName: 'Curl et extension',
            setType: 'normal',
            targetSets: 3,
            musclePrimary: 'arms',
            musclesSecondary: [],
            musclesFine: ['biceps', 'triceps'],
          },
          {
            id: 'warmup',
            exerciseId: 'warmup-arms',
            exerciseName: 'Echauffement bras',
            setType: 'warmup',
            targetSets: 8,
            musclePrimary: 'arms',
            musclesSecondary: [],
            musclesFine: ['biceps'],
          },
          {
            id: 'glutes-bodyweight',
            exerciseId: 'bridge',
            exerciseName: 'Pont fessier',
            setType: 'bodyweight',
            targetSets: 2,
            musclePrimary: 'legs',
            musclesSecondary: [],
            musclesFine: ['glutes'],
          },
          {
            id: 'thighs-unknown',
            exerciseId: 'hinge',
            exerciseName: 'Hip hinge',
            setType: 'normal',
            targetSets: null,
            musclePrimary: 'legs',
            musclesSecondary: [],
            musclesFine: ['hamstrings'],
          },
          {
            id: 'calves-zero',
            exerciseId: 'calves',
            exerciseName: 'Mollets',
            setType: 'normal',
            targetSets: 0,
            musclePrimary: 'legs',
            musclesSecondary: [],
            musclesFine: ['calves'],
          },
          {
            id: 'legs-general',
            exerciseId: 'squat',
            exerciseName: 'Squat',
            setType: 'normal',
            targetSets: 4,
            musclePrimary: 'legs',
            musclesSecondary: [],
            musclesFine: [],
          },
          {
            id: 'fine-blocks-fallback',
            exerciseId: 'tagged-chest',
            exerciseName: 'Exercice mal classe',
            setType: 'normal',
            targetSets: 5,
            musclePrimary: 'legs',
            musclesSecondary: [],
            musclesFine: ['chest'],
          },
        ],
      },
    ],
  };

  it('compte une ligne biceps et triceps une seule fois pour les bras', () => {
    expect(analyseBodyTrainingProgram(program, ['arms'])[0]).toMatchObject({
      zone: 'arms',
      exactSets: 3,
      unknownSetPlans: 0,
      generalPlans: 0,
    });
    expect(analyseBodyTrainingProgram(program, ['arms'])[0]!.matches).toHaveLength(1);
  });

  it('separe les associations fines, generales et les series inconnues', () => {
    expect(analyseBodyTrainingProgram(program, ['glutes', 'thighs', 'calves'])).toEqual([
      expect.objectContaining({ zone: 'glutes', exactSets: 2, unknownSetPlans: 0, generalPlans: 1 }),
      expect.objectContaining({ zone: 'thighs', exactSets: 0, unknownSetPlans: 1, generalPlans: 1 }),
      expect.objectContaining({ zone: 'calves', exactSets: 0, unknownSetPlans: 0, generalPlans: 1 }),
    ]);
  });

  it('exclut l echauffement, inclut le poids de corps et bloque le repli si un tag fin existe', () => {
    const glutes = analyseBodyTrainingProgram(program, ['glutes'])[0]!;
    expect(glutes.matches.map(({ planId }) => planId)).toEqual([
      'glutes-bodyweight',
      'legs-general',
    ]);
    expect(glutes.matches.find(({ planId }) => planId === 'glutes-bodyweight')).toMatchObject({
      kind: 'exact',
      targetSets: 2,
    });
  });

  it.each([-1, 1.5, Number.POSITIVE_INFINITY, null])(
    'classe une cible de series inexploitable comme inconnue : %s',
    (targetSets) => {
      const copy = structuredClone(program);
      copy.sessions[0]!.plans[0]!.targetSets = targetSets;
      expect(analyseBodyTrainingProgram(copy, ['arms'])[0]).toMatchObject({
        exactSets: 0,
        unknownSetPlans: 1,
      });
    },
  );

  it('ne mute ni le programme ni la liste de priorites', () => {
    const input = structuredClone(program);
    const priorities: BodyGoalZone[] = ['arms', 'glutes'];
    const before = JSON.stringify(input);

    analyseBodyTrainingProgram(input, priorities);

    expect(JSON.stringify(input)).toBe(before);
    expect(priorities).toEqual(['arms', 'glutes']);
    expect(BODY_TRAINING_MUSCLES.arms).toEqual(['biceps', 'triceps']);
  });
});
