import { z } from 'zod';

export const BODY_BASES = ['balanced', 'broad_shoulders', 'broad_hips'] as const;
export const BODY_SHAPE_ZONES = [
  'shoulders',
  'chest',
  'waist',
  'hips',
  'arms',
  'thighs',
  'calves',
] as const;
export const BODY_GOAL_ZONES = [
  'shoulders',
  'chest',
  'back',
  'arms',
  'glutes',
  'thighs',
  'calves',
] as const;

export const BODY_SHAPE_MIN = -2;
export const BODY_SHAPE_MAX = 2;
export const BODY_SHAPE_STEP = 0.25;
export const BODY_GOAL_MIN = 0;
export const BODY_GOAL_MAX = 4;
export const BODY_GOAL_STEP = 1;

export const BODY_SHAPE_BOUNDS = {
  min: BODY_SHAPE_MIN,
  max: BODY_SHAPE_MAX,
  step: BODY_SHAPE_STEP,
} as const;
export const BODY_GOAL_BOUNDS = {
  min: BODY_GOAL_MIN,
  max: BODY_GOAL_MAX,
  step: BODY_GOAL_STEP,
} as const;

export type BodyBase = (typeof BODY_BASES)[number];
export type BodyShapeZone = (typeof BODY_SHAPE_ZONES)[number];
export type BodyGoalZone = (typeof BODY_GOAL_ZONES)[number];
export type BodyVisualZone = BodyShapeZone | BodyGoalZone;
export type BodyShape = { base: BodyBase; proportions: Record<BodyShapeZone, number> };
export type BodyEmphasis = Record<BodyGoalZone, number>;
export type BodyVisualGoal = {
  baseline: BodyShape;
  baselineSavedAt: string | null;
  emphasis: BodyEmphasis;
  savedAt: string | null;
};
export type BodyVisualDocument = {
  version: 1;
  assetVersion: 'body-shape-v1';
  baseline: BodyShape;
  baselineSavedAt: string | null;
  goal: BodyVisualGoal | null;
  updatedAt: string | null;
};

export const bodyBaseSchema = z.enum(BODY_BASES);
export const bodyShapeZoneSchema = z.enum(BODY_SHAPE_ZONES);
export const bodyGoalZoneSchema = z.enum(BODY_GOAL_ZONES);

const bodyShapeValueSchema = z
  .number()
  .finite()
  .min(BODY_SHAPE_MIN)
  .max(BODY_SHAPE_MAX)
  .multipleOf(BODY_SHAPE_STEP);
const bodyGoalValueSchema = z
  .number()
  .finite()
  .int()
  .min(BODY_GOAL_MIN)
  .max(BODY_GOAL_MAX);
const savedAtSchema = z.string().datetime().nullable();

export const bodyProportionsSchema = z
  .object({
    shoulders: bodyShapeValueSchema,
    chest: bodyShapeValueSchema,
    waist: bodyShapeValueSchema,
    hips: bodyShapeValueSchema,
    arms: bodyShapeValueSchema,
    thighs: bodyShapeValueSchema,
    calves: bodyShapeValueSchema,
  })
  .strict();

export const bodyShapeSchema = z
  .object({
    base: bodyBaseSchema,
    proportions: bodyProportionsSchema,
  })
  .strict();

export const bodyEmphasisSchema = z
  .object({
    shoulders: bodyGoalValueSchema,
    chest: bodyGoalValueSchema,
    back: bodyGoalValueSchema,
    arms: bodyGoalValueSchema,
    glutes: bodyGoalValueSchema,
    thighs: bodyGoalValueSchema,
    calves: bodyGoalValueSchema,
  })
  .strict();

export const bodyVisualGoalSchema = z
  .object({
    baseline: bodyShapeSchema,
    baselineSavedAt: savedAtSchema,
    emphasis: bodyEmphasisSchema,
    savedAt: savedAtSchema,
  })
  .strict();

export const bodyVisualDocumentSchema = z
  .object({
    version: z.literal(1),
    assetVersion: z.literal('body-shape-v1'),
    baseline: bodyShapeSchema,
    baselineSavedAt: savedAtSchema,
    goal: bodyVisualGoalSchema.nullable(),
    updatedAt: savedAtSchema,
  })
  .strict();

const zeroProportions = (): Record<BodyShapeZone, number> => ({
  shoulders: 0,
  chest: 0,
  waist: 0,
  hips: 0,
  arms: 0,
  thighs: 0,
  calves: 0,
});

const zeroEmphasis = (): BodyEmphasis => ({
  shoulders: 0,
  chest: 0,
  back: 0,
  arms: 0,
  glutes: 0,
  thighs: 0,
  calves: 0,
});

export function createBodyVisualDocument(): BodyVisualDocument {
  return {
    version: 1,
    assetVersion: 'body-shape-v1',
    baseline: { base: 'balanced', proportions: zeroProportions() },
    baselineSavedAt: null,
    goal: null,
    updatedAt: null,
  };
}

export function createBodyVisualGoal(document: BodyVisualDocument): BodyVisualGoal {
  return {
    baseline: bodyShapeSchema.parse(document.baseline),
    baselineSavedAt: document.baselineSavedAt,
    emphasis: zeroEmphasis(),
    savedAt: null,
  };
}

export type BodyVisualParseResult =
  | { status: 'empty' | 'invalid' | 'unsupported'; document: null }
  | { status: 'ready'; document: BodyVisualDocument };

export function parseBodyVisualDocument(raw: unknown): BodyVisualParseResult {
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

  const parsed = bodyVisualDocumentSchema.safeParse(value);
  return parsed.success
    ? { status: 'ready', document: parsed.data }
    : { status: 'invalid', document: null };
}

function shapeEquals(left: BodyShape, right: BodyShape): boolean {
  return (
    left.base === right.base &&
    BODY_SHAPE_ZONES.every((zone) => left.proportions[zone] === right.proportions[zone])
  );
}

function emphasisEquals(left: BodyEmphasis, right: BodyEmphasis): boolean {
  return BODY_GOAL_ZONES.every((zone) => left[zone] === right[zone]);
}

function goalEquals(left: BodyVisualGoal | null, right: BodyVisualGoal | null): boolean {
  if (left === null || right === null) return left === right;
  return shapeEquals(left.baseline, right.baseline) && emphasisEquals(left.emphasis, right.emphasis);
}

function contentEquals(left: BodyVisualDocument, right: BodyVisualDocument): boolean {
  return shapeEquals(left.baseline, right.baseline) && goalEquals(left.goal, right.goal);
}

export function bodyVisualDirty(
  draft: BodyVisualDocument,
  saved: BodyVisualDocument | null,
): boolean {
  return !contentEquals(draft, saved ?? createBodyVisualDocument());
}

export function bodyGoalUsesCurrentBaseline(document: BodyVisualDocument): boolean {
  return document.goal !== null && shapeEquals(document.baseline, document.goal.baseline);
}

export function bodyGoalZones(emphasis: BodyEmphasis): BodyGoalZone[] {
  return BODY_GOAL_ZONES.filter((zone) => emphasis[zone] > 0);
}

export function prepareBodyVisualSave(
  draft: BodyVisualDocument,
  previous: BodyVisualDocument | null,
  now: string,
): BodyVisualDocument {
  const parsedNow = z.string().datetime().safeParse(now);
  if (!parsedNow.success) throw parsedNow.error;

  const next = bodyVisualDocumentSchema.parse(draft);
  const before = previous === null ? null : bodyVisualDocumentSchema.parse(previous);
  if (before !== null && contentEquals(next, before)) return before;

  const baselineChanged = before === null || !shapeEquals(next.baseline, before.baseline);
  const baselineSavedAt = baselineChanged ? now : before.baselineSavedAt;
  const goalChanged = before === null ? next.goal !== null : !goalEquals(next.goal, before.goal);

  let goal = next.goal;
  if (!goalChanged && before?.goal) {
    goal = before.goal;
  } else if (goal !== null) {
    const capturesCurrentBaseline = shapeEquals(goal.baseline, next.baseline);
    const previousSnapshot = before?.goal;
    // Une intention existante garde la date de sa copie, même si le départ revient à
    // cette forme. Une forme intermédiaire de brouillon est datée à sa première sauvegarde.
    const baselineTimestamp = goal.savedAt !== null && previousSnapshot && shapeEquals(goal.baseline, previousSnapshot.baseline)
      ? previousSnapshot.baselineSavedAt
      : capturesCurrentBaseline ? baselineSavedAt
        : before && shapeEquals(goal.baseline, before.baseline) ? before.baselineSavedAt : now;
    goal = {
      ...goal,
      baseline: bodyShapeSchema.parse(goal.baseline),
      baselineSavedAt: baselineTimestamp,
      emphasis: bodyEmphasisSchema.parse(goal.emphasis),
      savedAt: now,
    };
  }

  return {
    ...next,
    baselineSavedAt,
    goal,
    updatedAt: now,
  };
}
