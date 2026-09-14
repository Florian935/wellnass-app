import { z } from 'zod';

import {
  BODY_GOAL_ZONES,
  bodyGoalZoneSchema,
  bodyVisualGoalSchema,
  type BodyGoalZone,
  type BodyVisualGoal,
} from './body-visual';
import type { FineMuscle, MuscleGroup } from './exercise';
import type { SetType } from './workout';

const utcTimestampSchema = z.string().datetime();
const savedBodyVisualGoalSchema = bodyVisualGoalSchema.extend({
  savedAt: utcTimestampSchema,
});

const canonicalPrioritiesSchema = z
  .array(bodyGoalZoneSchema)
  .min(1)
  .max(3)
  .superRefine((priorities, context) => {
    if (new Set(priorities).size !== priorities.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Priorites dupliquees' });
      return;
    }
    const canonical = BODY_GOAL_ZONES.filter((zone) => priorities.includes(zone));
    if (canonical.some((zone, index) => zone !== priorities[index])) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Ordre non canonique' });
    }
  });

export type BodyTrainingDocument = {
  version: 1;
  priorities: BodyGoalZone[];
  sourceGoal: BodyVisualGoal;
  confirmedAt: string;
};

export type BodyTrainingParseResult = {
  status: 'empty' | 'ready' | 'invalid' | 'unsupported';
  document: BodyTrainingDocument | null;
};

export const bodyTrainingDocumentSchema = z
  .object({
    version: z.literal(1),
    priorities: canonicalPrioritiesSchema,
    sourceGoal: savedBodyVisualGoalSchema,
    confirmedAt: utcTimestampSchema,
  })
  .strict();

export const BODY_TRAINING_MUSCLES: Record<BodyGoalZone, readonly FineMuscle[]> = {
  shoulders: ['shoulders'],
  chest: ['chest'],
  back: ['back'],
  arms: ['biceps', 'triceps'],
  glutes: ['glutes'],
  thighs: ['quadriceps', 'hamstrings'],
  calves: ['calves'],
};

const BODY_TRAINING_GENERAL_GROUP: Record<BodyGoalZone, MuscleGroup> = {
  shoulders: 'shoulders',
  chest: 'chest',
  back: 'back',
  arms: 'arms',
  glutes: 'legs',
  thighs: 'legs',
  calves: 'legs',
};

export function parseBodyTrainingDocument(raw: unknown): BodyTrainingParseResult {
  if (raw === null || raw === undefined) return { status: 'empty', document: null };

  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return { status: 'invalid', document: null };
    }
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    typeof (value as { version?: unknown }).version === 'number' &&
    Number.isInteger((value as { version: number }).version) &&
    (value as { version: number }).version > 1
  ) {
    return { status: 'unsupported', document: null };
  }

  const parsed = bodyTrainingDocumentSchema.safeParse(value);
  return parsed.success
    ? { status: 'ready', document: parsed.data }
    : { status: 'invalid', document: null };
}

export function suggestBodyPriorities(goal: BodyVisualGoal): BodyGoalZone[] {
  const parsedGoal = bodyVisualGoalSchema.parse(goal);
  return BODY_GOAL_ZONES.filter((zone) => parsedGoal.emphasis[zone] > 0)
    .sort((left, right) => parsedGoal.emphasis[right] - parsedGoal.emphasis[left])
    .slice(0, 3);
}

export function createBodyTrainingDocument(
  priorities: BodyGoalZone[],
  goal: BodyVisualGoal,
  now: string,
): BodyTrainingDocument {
  const uniquePriorities = new Set(priorities);
  if (uniquePriorities.size !== priorities.length || priorities.length < 1 || priorities.length > 3) {
    throw new Error('Les priorites doivent contenir entre une et trois zones uniques.');
  }

  const canonical = BODY_GOAL_ZONES.filter((zone) => uniquePriorities.has(zone));
  if (canonical.length !== priorities.length) {
    throw new Error('Priorite inconnue.');
  }

  return bodyTrainingDocumentSchema.parse({
    version: 1,
    priorities: canonical,
    sourceGoal: goal,
    confirmedAt: now,
  });
}

export function bodyTrainingNeedsReview(
  document: BodyTrainingDocument,
  goal: BodyVisualGoal | null,
): boolean {
  if (goal === null) return true;
  const source = savedBodyVisualGoalSchema.safeParse(document.sourceGoal);
  const current = savedBodyVisualGoalSchema.safeParse(goal);
  if (!source.success || !current.success) return true;
  return JSON.stringify(source.data) !== JSON.stringify(current.data);
}

export type BodyTrainingPlan = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  setType: SetType;
  targetSets: number | null;
  musclePrimary: MuscleGroup | null;
  musclesSecondary: MuscleGroup[];
  musclesFine: FineMuscle[];
};

export type BodyTrainingProgram = {
  id: string;
  name: string;
  sessions: { id: string; name: string | null; plans: BodyTrainingPlan[] }[];
};

export type BodyTrainingMatch = {
  planId: string;
  exerciseId: string;
  exerciseName: string;
  sessionId: string;
  sessionName: string | null;
  kind: 'exact' | 'general';
  muscles: FineMuscle[];
  targetSets: number | null;
};

export type BodyTrainingCoverage = {
  zone: BodyGoalZone;
  exactSets: number;
  unknownSetPlans: number;
  generalPlans: number;
  matches: BodyTrainingMatch[];
};

function usableTargetSets(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

export function analyseBodyTrainingProgram(
  program: BodyTrainingProgram,
  priorities: BodyGoalZone[],
): BodyTrainingCoverage[] {
  return priorities.map((zone) => {
    const coverage: BodyTrainingCoverage = {
      zone,
      exactSets: 0,
      unknownSetPlans: 0,
      generalPlans: 0,
      matches: [],
    };

    for (const session of program.sessions) {
      for (const plan of session.plans) {
        if (plan.setType === 'warmup') continue;

        const exactMuscles = BODY_TRAINING_MUSCLES[zone].filter((muscle) =>
          plan.musclesFine.includes(muscle),
        );
        const isExact = exactMuscles.length > 0;
        const isGeneral =
          plan.musclesFine.length === 0 &&
          (plan.musclePrimary === BODY_TRAINING_GENERAL_GROUP[zone] ||
            plan.musclesSecondary.includes(BODY_TRAINING_GENERAL_GROUP[zone]));

        if (!isExact && !isGeneral) continue;

        const targetSets = usableTargetSets(plan.targetSets) ? plan.targetSets : null;
        coverage.matches.push({
          planId: plan.id,
          exerciseId: plan.exerciseId,
          exerciseName: plan.exerciseName,
          sessionId: session.id,
          sessionName: session.name,
          kind: isExact ? 'exact' : 'general',
          muscles: isExact ? [...exactMuscles] : [],
          targetSets,
        });

        if (isExact) {
          if (targetSets === null) coverage.unknownSetPlans += 1;
          else coverage.exactSets += targetSets;
        } else {
          coverage.generalPlans += 1;
        }
      }
    }

    return coverage;
  });
}
