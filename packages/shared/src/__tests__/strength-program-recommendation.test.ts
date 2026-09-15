import { describe, expect, it } from 'vitest';

import type {
  StrengthProgramCandidate,
  StrengthProgramContext,
  StrengthProgramSourceSnapshot,
} from '../strength-program-recommendation';
import {
  estimateStrengthSessionMinutes,
  fingerprintStrengthProgram,
  recommendStrengthPrograms,
  strengthProgramContextSchema,
  strengthProgramSourceSnapshotSchema,
} from '../strength-program-recommendation';

type CandidateOverrides = {
  id?: string;
  isCurrent?: boolean;
  level?: StrengthProgramCandidate['program']['level'];
  sessionCount?: number;
  plans?: StrengthProgramCandidate['program']['sessions'][number]['plans'];
};

const basePlan: StrengthProgramCandidate['program']['sessions'][number]['plans'][number] = {
  id: 'plan-1',
  exerciseId: 'exercise-1',
  exerciseName: 'Curl',
  setType: 'normal',
  targetSets: 3,
  musclePrimary: 'arms',
  musclesSecondary: [],
  musclesFine: ['biceps'],
  restSeconds: 90,
  equipment: 'dumbbell',
};

function candidate(overrides: CandidateOverrides = {}): StrengthProgramCandidate {
  const id = overrides.id ?? 'program-a';
  const sessionCount = overrides.sessionCount ?? 1;
  return {
    program: {
      id,
      name: id,
      ownerId: null,
      level: overrides.level ?? 'beginner',
      sessions: Array.from({ length: sessionCount }, (_, index) => ({
        id: `${id}-session-${index}`,
        name: `Session ${index + 1}`,
        plans: overrides.plans ?? [{ ...basePlan, id: `${id}-plan-${index}` }],
      })),
    },
    isCurrent: overrides.isCurrent ?? false,
  };
}

const unconstrainedContext: StrengthProgramContext = {
  level: null,
  weeklyAvailability: null,
  sessionMinutes: null,
  equipment: null,
};

describe('strengthProgramContextSchema', () => {
  it('conserve l’union de durées et normalise le matériel dans l’ordre canonique', () => {
    expect(
      strengthProgramContextSchema.parse({
        level: 'intermediate',
        weeklyAvailability: 4,
        sessionMinutes: 60,
        equipment: ['band', 'barbell', 'bodyweight'],
      }),
    ).toEqual({
      level: 'intermediate',
      weeklyAvailability: 4,
      sessionMinutes: 60,
      equipment: ['barbell', 'bodyweight', 'band'],
    });
  });

  it('rejette une durée hors référentiel, une liste vide, les doublons et les champs inconnus', () => {
    const valid = {
      level: null,
      weeklyAvailability: null,
      sessionMinutes: null,
      equipment: null,
    };

    expect(strengthProgramContextSchema.safeParse({ ...valid, sessionMinutes: 50 }).success).toBe(
      false,
    );
    expect(strengthProgramContextSchema.safeParse({ ...valid, equipment: [] }).success).toBe(false);
    expect(
      strengthProgramContextSchema.safeParse({ ...valid, equipment: ['barbell', 'barbell'] })
        .success,
    ).toBe(false);
    expect(strengthProgramContextSchema.safeParse({ ...valid, surprise: true }).success).toBe(false);
  });
});

describe('estimateStrengthSessionMinutes', () => {
  it('additionne effort et repos par série, les transitions, puis arrondit à la minute supérieure', () => {
    const session = candidate({
      plans: [
        { ...basePlan, id: 'first', targetSets: 2, restSeconds: null },
        { ...basePlan, id: 'second', targetSets: 3, restSeconds: 60 },
      ],
    }).program.sessions[0]!;

    // 2 × (45 + 90) + 3 × (45 + 60) + 60 = 645 s = 10,75 min.
    expect(estimateStrengthSessionMinutes(session)).toBe(11);
  });

  it('ignore une ligne d’échauffement inconnue mais refuse une ligne de travail inconnue', () => {
    const warmup = { ...basePlan, id: 'warmup', setType: 'warmup' as const, targetSets: null };
    const known = { ...basePlan, id: 'known', targetSets: 1, restSeconds: 0 };
    const unknown = { ...basePlan, id: 'unknown', targetSets: null };

    expect(
      estimateStrengthSessionMinutes(candidate({ plans: [warmup, known] }).program.sessions[0]!),
    ).toBe(1);
    expect(
      estimateStrengthSessionMinutes(candidate({ plans: [warmup, unknown] }).program.sessions[0]!),
    ).toBeNull();
  });
});

describe('recommendStrengthPrograms', () => {
  it('compte uniquement les associations fines et les séries connues par priorité', () => {
    const result = recommendStrengthPrograms(
      [
        candidate({
          plans: [
            { ...basePlan, id: 'biceps', musclesFine: ['biceps'], targetSets: 3 },
            {
              ...basePlan,
              id: 'triceps-unknown',
              musclesFine: ['triceps'],
              targetSets: null,
            },
            {
              ...basePlan,
              id: 'chest',
              musclePrimary: 'chest',
              musclesFine: ['chest'],
              targetSets: 4,
            },
            {
              ...basePlan,
              id: 'general-arms',
              musclePrimary: 'arms',
              musclesFine: [],
              targetSets: 8,
            },
          ],
        }),
      ],
      ['chest', 'arms'],
      unconstrainedContext,
    );

    expect(result[0]).toMatchObject({
      exactPriorityCount: 2,
      exactFineMuscles: ['chest', 'biceps', 'triceps'],
      missingFineMuscles: [],
      generalPriorityZones: ['arms'],
      priorityCoverage: [
        {
          zone: 'chest',
          requestedFineMuscles: ['chest'],
          exactFineMuscles: ['chest'],
          knownPlannedSets: 4,
        },
        {
          zone: 'arms',
          requestedFineMuscles: ['biceps', 'triceps'],
          exactFineMuscles: ['biceps', 'triceps'],
          knownPlannedSets: 3,
        },
      ],
    });
  });

  it('expose une association générale sans remplir le critère fin', () => {
    const result = recommendStrengthPrograms(
      [
        candidate({
          plans: [
            {
              ...basePlan,
              musclePrimary: 'arms',
              musclesSecondary: [],
              musclesFine: [],
              targetSets: 5,
            },
          ],
        }),
      ],
      ['arms'],
      unconstrainedContext,
    );

    expect(result[0]).toMatchObject({
      exactPriorityCount: 0,
      exactFineMuscles: [],
      missingFineMuscles: ['biceps', 'triceps'],
      generalPriorityZones: ['arms'],
      priorityCoverage: [
        {
          zone: 'arms',
          exactFineMuscles: [],
          knownPlannedSets: 0,
        },
      ],
    });
  });

  it('signale les jours, le matériel et une durée connue excessifs', () => {
    const result = recommendStrengthPrograms(
      [
        candidate({
          sessionCount: 3,
          plans: [
            {
              ...basePlan,
              equipment: 'barbell',
              targetSets: 10,
              restSeconds: 180,
            },
          ],
        }),
      ],
      ['arms'],
      {
        level: 'beginner',
        weeklyAvailability: 2,
        sessionMinutes: 30,
        equipment: ['dumbbell'],
      },
    );

    expect(result[0]).toMatchObject({
      compatible: false,
      issues: ['schedule', 'equipment', 'duration'],
    });
  });

  it('ne contraint pas les valeurs nulles et accepte toujours poids du corps ou sans matériel', () => {
    const freeEquipment = candidate({
      id: 'free',
      plans: [
        { ...basePlan, id: 'bodyweight', equipment: 'bodyweight' },
        { ...basePlan, id: 'none', equipment: null },
      ],
    });
    const constrained = recommendStrengthPrograms(
      [freeEquipment],
      ['arms'],
      { ...unconstrainedContext, equipment: ['band'] },
    );
    const unknown = recommendStrengthPrograms(
      [candidate({ plans: [{ ...basePlan, equipment: 'barbell', targetSets: null }] })],
      ['arms'],
      unconstrainedContext,
    );

    expect(constrained[0]).toMatchObject({ compatible: true, issues: [] });
    expect(unknown[0]).toMatchObject({
      compatible: true,
      issues: [],
      sessionDurationMinutes: [null],
    });
  });

  it('expose les contraintes vérifiées et ne qualifie pas une durée inconnue', () => {
    const context: StrengthProgramContext = {
      level: 'beginner',
      weeklyAvailability: 1,
      sessionMinutes: 30,
      equipment: ['dumbbell'],
    };
    const known = recommendStrengthPrograms([candidate({ id: 'known' })], ['arms'], context);
    const unknown = recommendStrengthPrograms(
      [candidate({ id: 'unknown', plans: [{ ...basePlan, targetSets: null }] })],
      ['arms'],
      context,
    );

    expect(known[0]?.reasons).toEqual([
      'priorities',
      'level',
      'schedule',
      'equipment',
      'duration',
    ]);
    expect(unknown[0]?.reasons).toEqual(['priorities', 'level', 'schedule', 'equipment']);
  });

  it('applique chaque départage dans l’ordre spécifié', () => {
    const twoFineOneZone: StrengthProgramCandidate['program']['sessions'][number]['plans'] = [
      { ...basePlan, id: 'biceps', musclesFine: ['biceps'] },
      { ...basePlan, id: 'triceps', musclesFine: ['triceps'] },
    ];
    const twoFineTwoZones: StrengthProgramCandidate['program']['sessions'][number]['plans'] = [
      { ...basePlan, id: 'biceps', musclesFine: ['biceps'] },
      {
        ...basePlan,
        id: 'chest',
        musclePrimary: 'chest',
        musclesFine: ['chest'],
      },
    ];

    const cases: Array<{
      left: StrengthProgramCandidate;
      right: StrengthProgramCandidate;
      context?: StrengthProgramContext;
      priorities?: ('chest' | 'arms')[];
      expected: string;
    }> = [
      {
        left: candidate({ id: 'incompatible', sessionCount: 2 }),
        right: candidate({ id: 'compatible' }),
        context: { ...unconstrainedContext, weeklyAvailability: 1 },
        expected: 'compatible',
      },
      {
        left: candidate({ id: 'one-fine' }),
        right: candidate({ id: 'two-fine', plans: twoFineOneZone }),
        expected: 'two-fine',
      },
      {
        left: candidate({ id: 'one-zone', plans: twoFineOneZone }),
        right: candidate({ id: 'two-zones', plans: twoFineTwoZones }),
        priorities: ['chest', 'arms'],
        expected: 'two-zones',
      },
      {
        left: candidate({ id: 'wrong-level', level: 'beginner' }),
        right: candidate({ id: 'exact-level', level: 'advanced' }),
        context: { ...unconstrainedContext, level: 'advanced' },
        expected: 'exact-level',
      },
      {
        left: candidate({ id: 'not-current' }),
        right: candidate({ id: 'current', isCurrent: true }),
        expected: 'current',
      },
      {
        left: candidate({ id: 'far', sessionCount: 1 }),
        right: candidate({ id: 'near', sessionCount: 2 }),
        context: { ...unconstrainedContext, weeklyAvailability: 3 },
        expected: 'near',
      },
      {
        left: candidate({ id: 'z-last' }),
        right: candidate({ id: 'a-first' }),
        expected: 'a-first',
      },
    ];

    for (const entry of cases) {
      const result = recommendStrengthPrograms(
        [entry.left, entry.right],
        entry.priorities ?? ['arms'],
        entry.context ?? unconstrainedContext,
      );
      expect(result[0]?.programId).toBe(entry.expected);
    }
  });

  it('retourne trois compatibles au plus et aucune explication incompatible', () => {
    const result = recommendStrengthPrograms(
      [
        candidate({ id: 'd-compatible' }),
        candidate({ id: 'c-compatible' }),
        candidate({ id: 'b-compatible' }),
        candidate({ id: 'a-compatible' }),
        candidate({ id: 'incompatible', sessionCount: 2 }),
      ],
      ['arms'],
      { ...unconstrainedContext, weeklyAvailability: 1 },
    );

    expect(result.map(({ programId }) => programId)).toEqual([
      'a-compatible',
      'b-compatible',
      'c-compatible',
    ]);
    expect(result.every(({ compatible }) => compatible)).toBe(true);
  });

  it('retourne trois explications incompatibles au plus lorsqu’aucun candidat ne convient', () => {
    const result = recommendStrengthPrograms(
      ['d', 'c', 'b', 'a'].map((id) => candidate({ id, sessionCount: 2 })),
      ['arms'],
      { ...unconstrainedContext, weeklyAvailability: 1 },
    );

    expect(result.map(({ programId }) => programId)).toEqual(['a', 'b', 'c']);
    expect(result.every(({ compatible }) => !compatible)).toBe(true);
  });
});

const sourceSnapshot: StrengthProgramSourceSnapshot = {
  program: {
    pillar: 'strength',
    level: 'intermediate',
    goal: 'hypertrophy',
    durationWeeks: 8,
    targetTimeSeconds: null,
    eventName: null,
  },
  translations: [
    { lang: 'fr', name: 'Force', summary: 'Résumé', description: 'Description' },
    { lang: 'en', name: 'Strength', summary: null, description: null },
  ],
  sessions: [
    {
      orderIndex: 0,
      name: 'A',
      sessionType: null,
      targetDistanceM: null,
      targetDurationSeconds: null,
      targetPaceMinSPerKm: null,
      targetPaceMaxSPerKm: null,
      targetRpe: null,
      targetTimeSeconds: null,
      pacingPlan: null,
      description: null,
      instructions: 'Contrôle',
      adaptationCriterion: null,
      translations: [
        { lang: 'fr', name: 'Séance A', description: null, instructions: 'Respirer' },
        { lang: 'en', name: 'Session A', description: null, instructions: 'Breathe' },
      ],
      plans: [
        {
          exerciseId: 'exercise-b',
          orderIndex: 1,
          setType: 'normal',
          targetSets: 3,
          targetReps: '8-12',
          targetWeightKg: 20,
          restSeconds: 90,
        },
        {
          exerciseId: 'exercise-a',
          orderIndex: 0,
          setType: 'warmup',
          targetSets: 1,
          targetReps: '10',
          targetWeightKg: null,
          restSeconds: 30,
        },
      ],
    },
    {
      orderIndex: 1,
      name: 'B',
      sessionType: null,
      targetDistanceM: null,
      targetDurationSeconds: null,
      targetPaceMinSPerKm: null,
      targetPaceMaxSPerKm: null,
      targetRpe: null,
      targetTimeSeconds: null,
      pacingPlan: null,
      description: 'Deuxième séance',
      instructions: null,
      adaptationCriterion: null,
      translations: [],
      plans: [],
    },
  ],
};

function changedLeaves(value: unknown): unknown[] {
  if (value === null) return ['changed', 1, { changed: true }];
  if (typeof value === 'string') {
    return [`${value}-changed`, 'advanced', 'warmup', 'en'];
  }
  if (typeof value === 'number') return [value + 1];
  if (typeof value === 'boolean') return [!value];
  if (Array.isArray(value)) {
    return value.flatMap((child, index) =>
      changedLeaves(child).map((changed) => value.map((item, i) => (i === index ? changed : item))),
    );
  }
  if (typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      changedLeaves(child).map((changed) => ({ ...value, [key]: changed })),
    );
  }
  return [];
}

describe('fingerprintStrengthProgram', () => {
  it('est stable lorsque les clés et collections normalisées arrivent dans un ordre différent', () => {
    const reordered: StrengthProgramSourceSnapshot = {
      sessions: [...sourceSnapshot.sessions]
        .reverse()
        .map((session) => ({
          ...session,
          plans: [...session.plans].reverse(),
          translations: [...session.translations].reverse(),
        })),
      translations: [...sourceSnapshot.translations].reverse(),
      program: { ...sourceSnapshot.program },
    };

    expect(fingerprintStrengthProgram(reordered)).toBe(fingerprintStrengthProgram(sourceSnapshot));
  });

  it('change dès qu’un champ recopié du programme, des traductions, sessions ou plans change', () => {
    const fingerprint = fingerprintStrengthProgram(sourceSnapshot);
    const mutations = changedLeaves(sourceSnapshot).filter(
      (mutation): mutation is StrengthProgramSourceSnapshot =>
        JSON.stringify(mutation) !== JSON.stringify(sourceSnapshot) &&
        strengthProgramSourceSnapshotSchema.safeParse(mutation).success,
    );

    expect(mutations.length).toBeGreaterThan(30);
    for (const mutation of mutations) {
      expect(fingerprintStrengthProgram(mutation)).not.toBe(fingerprint);
    }
  });
});
