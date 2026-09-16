import { z } from 'zod';

import {
  BODY_TRAINING_MUSCLES,
  analyseBodyTrainingProgram,
} from './body-training';
import { bodyGoalZoneSchema, type BodyGoalZone } from './body-visual';
import {
  EQUIPMENTS,
  equipmentSchema,
  fineMuscleSchema,
  muscleGroupSchema,
  type Equipment,
} from './exercise';
import { trainingLevelSchema, type TrainingLevel } from './guidance';
import { programLevelSchema } from './program';
import { recoveryKindSchema, segmentKindSchema } from './running-paces';
import { setTypeSchema } from './workout';

export const STRENGTH_SESSION_MINUTES = [30, 45, 60, 75, 90] as const;
export type StrengthSessionMinutes = (typeof STRENGTH_SESSION_MINUTES)[number];

const strengthSessionMinutesValueSchema = z.union([
  z.literal(30),
  z.literal(45),
  z.literal(60),
  z.literal(75),
  z.literal(90),
]);

/**
 * Les deux champs durables de CORPS-04, **validables séparément**.
 *
 * ⚠️ `strengthProgramContextSchema` valide les quatre champs du contexte d'un seul tenant, et c'est
 * juste pour l'éditeur : on n'y enregistre rien de partiel. Mais un **lecteur** qui s'en sert pour
 * mapper une ligne de `profiles` hérite d'un défaut : une valeur invalide n'importe où rabat *tous*
 * les champs. Or `level` et `weeklyAvailability` appartiennent à GUID-01 — une valeur héritée, ou
 * écrite par un client plus récent, effacerait en silence une durée de séance parfaitement valide.
 * Chaque lecteur doit donc pouvoir demander un verdict **par champ**, et ces deux schémas sont là
 * pour ça. Le schéma composite ci-dessous les réutilise : une seule source de vérité par champ.
 */
export const strengthSessionMinutesFieldSchema = strengthSessionMinutesValueSchema.nullable();

export const strengthEquipmentFieldSchema = z
  .array(equipmentSchema)
  .nonempty()
  .nullable()
  .superRefine((equipment, refinement) => {
    if (equipment && new Set(equipment).size !== equipment.length) {
      refinement.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Le matériel ne doit pas contenir de doublon.',
      });
    }
  })
  // Ordre canonique : le matériel est un ensemble, pas une liste ordonnée. Le figer ici évite que
  // deux appareils affichent la même sélection dans deux ordres différents.
  .transform((equipment): Equipment[] | null =>
    equipment === null ? null : EQUIPMENTS.filter((item) => equipment.includes(item)),
  );

export const strengthSessionMinutesSchema = z
  .enum(['30', '45', '60', '75', '90'])
  .transform((value): StrengthSessionMinutes => Number(value) as StrengthSessionMinutes);

export type StrengthProgramContext = {
  level: TrainingLevel | null;
  weeklyAvailability: number | null;
  sessionMinutes: StrengthSessionMinutes | null;
  equipment: Equipment[] | null;
};

// Composé à partir des deux schémas par champ ci-dessus : le refus des doublons et l'ordre
// canonique du matériel y vivent une seule fois, et l'éditeur comme les lecteurs appliquent
// exactement la même règle. Zod préfixe tout seul le chemin de l'erreur par `equipment`.
export const strengthProgramContextSchema = z
  .object({
    level: trainingLevelSchema.nullable(),
    weeklyAvailability: z.number().int().min(1).max(7).nullable(),
    sessionMinutes: strengthSessionMinutesFieldSchema,
    equipment: strengthEquipmentFieldSchema,
  })
  .strict()
  .transform((context): StrengthProgramContext => context);

const candidatePlanSchema = z
  .object({
    id: z.string().min(1),
    exerciseId: z.string().min(1),
    exerciseName: z.string(),
    setType: setTypeSchema,
    targetSets: z.number().int().positive().nullable(),
    musclePrimary: muscleGroupSchema.nullable(),
    musclesSecondary: z.array(muscleGroupSchema),
    musclesFine: z.array(fineMuscleSchema),
    restSeconds: z.number().int().min(0).nullable(),
    equipment: equipmentSchema.nullable(),
  })
  .strict();

const candidateSessionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().nullable(),
    plans: z.array(candidatePlanSchema),
  })
  .strict();

export const strengthProgramCandidateSchema = z
  .object({
    program: z
      .object({
        id: z.string().min(1),
        name: z.string(),
        ownerId: z.string().nullable(),
        level: programLevelSchema.nullable(),
        sessions: z.array(candidateSessionSchema),
      })
      .strict(),
    isCurrent: z.boolean(),
  })
  .strict();

export type StrengthProgramCandidate = z.infer<typeof strengthProgramCandidateSchema>;

const copiedProgramSchema = z
  .object({
    pillar: z.literal('strength'),
    level: programLevelSchema.nullable(),
    goal: z.string().nullable(),
    durationWeeks: z.number().int().positive().nullable(),
    targetTimeSeconds: z.number().int().positive().nullable(),
    eventName: z.string().nullable(),
  })
  .strict();

const copiedProgramTranslationSchema = z
  .object({
    lang: z.string().min(1),
    name: z.string(),
    summary: z.string().nullable(),
    description: z.string().nullable(),
  })
  .strict();

const copiedSessionTranslationSchema = z
  .object({
    lang: z.string().min(1),
    name: z.string().nullable(),
    description: z.string().nullable(),
    instructions: z.string().nullable(),
  })
  .strict();

const copiedExercisePlanSchema = z
  .object({
    exerciseId: z.string().min(1),
    orderIndex: z.number().int().min(0),
    setType: setTypeSchema,
    targetSets: z.number().int().positive().nullable(),
    targetReps: z.string().nullable(),
    targetWeightKg: z.number().nonnegative().nullable(),
    restSeconds: z.number().int().min(0).nullable(),
  })
  .strict();

const sourceExerciseTranslationSchema = z
  .object({
    lang: z.string().min(1),
    name: z.string(),
    instructions: z.string().nullable(),
  })
  .strict();

const sourceExerciseFactSchema = z
  .object({
    id: z.string().min(1),
    equipment: equipmentSchema.nullable(),
    musclePrimary: muscleGroupSchema.nullable(),
    musclesSecondary: z.array(muscleGroupSchema),
    musclesFine: z.array(fineMuscleSchema),
    translations: z.array(sourceExerciseTranslationSchema),
  })
  .strict();

const sourceExerciseFactsSchema = z
  .array(sourceExerciseFactSchema)
  .superRefine((exercises, refinement) => {
    const ids = new Set<string>();
    for (const exercise of exercises) {
      if (ids.has(exercise.id)) {
        refinement.addIssue({
          code: z.ZodIssueCode.custom,
          message: `L'exercice ${exercise.id} apparaît plusieurs fois dans le snapshot.`,
        });
      }
      ids.add(exercise.id);
    }
  });

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
);

const copiedSessionIntervalSchema = z
  .object({
    orderIndex: z.number().int().min(0),
    reps: z.number().int().positive(),
    fastDistanceM: z.number().int().positive().nullable(),
    fastDurationSeconds: z.number().int().positive().nullable(),
    fastPacePctVma: z.number().int().positive().nullable(),
    recoveryDistanceM: z.number().int().positive().nullable(),
    recoveryDurationSeconds: z.number().int().positive().nullable(),
    kind: segmentKindSchema,
    label: z.string().nullable(),
    fastPaceMinSPerKm: z.number().int().positive().nullable(),
    fastPaceMaxSPerKm: z.number().int().positive().nullable(),
    fastTargetTimeMinSeconds: z.number().int().positive().nullable(),
    fastTargetTimeMaxSeconds: z.number().int().positive().nullable(),
    fastPaceProgressive: z.boolean(),
    recoveryKind: recoveryKindSchema.nullable(),
    recoveryPaceMinSPerKm: z.number().int().positive().nullable(),
    recoveryPaceMaxSPerKm: z.number().int().positive().nullable(),
    groupKey: z.string().nullable(),
    groupReps: z.number().int().positive().nullable(),
  })
  .strict();

const copiedSessionSchema = z
  .object({
    orderIndex: z.number().int().min(0),
    weekIndex: z.number().int().min(0).nullable(),
    name: z.string().nullable(),
    sessionType: z.string().nullable(),
    targetDistanceM: z.number().int().positive().nullable(),
    targetDurationSeconds: z.number().int().positive().nullable(),
    targetPaceMinSPerKm: z.number().int().positive().nullable(),
    targetPaceMaxSPerKm: z.number().int().positive().nullable(),
    targetRpe: z.number().int().min(1).max(10).nullable(),
    targetTimeSeconds: z.number().int().positive().nullable(),
    pacingPlan: jsonValueSchema,
    description: z.string().nullable(),
    instructions: z.string().nullable(),
    adaptationCriterion: z.string().nullable(),
    translations: z.array(copiedSessionTranslationSchema),
    plans: z.array(copiedExercisePlanSchema),
    intervals: z.array(copiedSessionIntervalSchema),
  })
  .strict();

/**
 * Source complète relue par la préparation transactionnelle d'un programme.
 * Les lignes programme/sessions/plans sont recopiées ; les exercices ne le sont pas, mais leurs
 * faits déterminent la compatibilité et participent donc au contrôle CAS de Task 4.
 * Les identifiants générés par la copie et les champs de synchronisation sont exclus.
 */
export const strengthProgramSourceSnapshotSchema = z
  .object({
    program: copiedProgramSchema,
    translations: z.array(copiedProgramTranslationSchema),
    exercises: sourceExerciseFactsSchema,
    sessions: z.array(copiedSessionSchema),
  })
  .strict();

export type StrengthProgramSourceSnapshot = z.infer<typeof strengthProgramSourceSnapshotSchema>;

export const STRENGTH_PROGRAM_REASONS = [
  'priorities',
  'level',
  'schedule',
  'equipment',
  'duration',
] as const;
export const STRENGTH_PROGRAM_ISSUES = ['schedule', 'equipment', 'duration'] as const;

const strengthProgramReasonSchema = z.enum(STRENGTH_PROGRAM_REASONS);
const strengthProgramIssueSchema = z.enum(STRENGTH_PROGRAM_ISSUES);

export const strengthPriorityCoverageSchema = z
  .object({
    zone: bodyGoalZoneSchema,
    requestedFineMuscles: z.array(fineMuscleSchema),
    exactFineMuscles: z.array(fineMuscleSchema),
    knownPlannedSets: z.number().int().min(0),
  })
  .strict();

export type StrengthPriorityCoverage = z.infer<typeof strengthPriorityCoverageSchema>;

export const strengthProgramRecommendationSchema = z
  .object({
    programId: z.string().min(1),
    isCurrent: z.boolean(),
    compatible: z.boolean(),
    exactPriorityCount: z.number().int().min(0),
    exactFineMuscles: z.array(fineMuscleSchema),
    missingFineMuscles: z.array(fineMuscleSchema),
    generalPriorityZones: z.array(bodyGoalZoneSchema),
    priorityCoverage: z.array(strengthPriorityCoverageSchema),
    sessionDurationMinutes: z.array(z.number().int().min(0).nullable()),
    reasons: z.array(strengthProgramReasonSchema),
    issues: z.array(strengthProgramIssueSchema),
  })
  .strict();

export type StrengthProgramRecommendation = z.infer<typeof strengthProgramRecommendationSchema>;

type StrengthCandidateSession = StrengthProgramCandidate['program']['sessions'][number];

export function estimateStrengthSessionMinutes(session: StrengthCandidateSession): number | null {
  const workingPlans = session.plans.filter((plan) => plan.setType !== 'warmup');
  if (workingPlans.some((plan) => plan.targetSets === null)) return null;

  const workingSeconds = workingPlans.reduce(
    (total, plan) => total + plan.targetSets! * (45 + (plan.restSeconds ?? 90)),
    0,
  );
  const transitionSeconds = Math.max(0, workingPlans.length - 1) * 60;
  return Math.ceil((workingSeconds + transitionSeconds) / 60);
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareCanonical(left: unknown, right: unknown): number {
  return compareText(canonicalJson(left), canonicalJson(right));
}

function normalizeSnapshot(snapshot: StrengthProgramSourceSnapshot): StrengthProgramSourceSnapshot {
  return {
    program: snapshot.program,
    translations: [...snapshot.translations].sort(
      (left, right) => compareText(left.lang, right.lang) || compareCanonical(left, right),
    ),
    exercises: snapshot.exercises
      .map((exercise) => ({
        ...exercise,
        translations: [...exercise.translations].sort(
          (left, right) => compareText(left.lang, right.lang) || compareCanonical(left, right),
        ),
      }))
      .sort((left, right) => compareText(left.id, right.id) || compareCanonical(left, right)),
    sessions: snapshot.sessions
      .map((session) => ({
        ...session,
        translations: [...session.translations].sort(
          (left, right) => compareText(left.lang, right.lang) || compareCanonical(left, right),
        ),
        plans: [...session.plans].sort(
          (left, right) => left.orderIndex - right.orderIndex || compareCanonical(left, right),
        ),
        intervals: [...session.intervals].sort(
          (left, right) => left.orderIndex - right.orderIndex || compareCanonical(left, right),
        ),
      }))
      .sort((left, right) => left.orderIndex - right.orderIndex || compareCanonical(left, right)),
  };
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    compareText(left, right),
  );
  return `{${entries
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
    .join(',')}}`;
}

function hashCanonicalText(text: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  const hex = (value: number) => (value >>> 0).toString(16).padStart(8, '0');
  return `sp1-${hex(first)}${hex(second)}`;
}

export function fingerprintStrengthProgram(snapshot: StrengthProgramSourceSnapshot): string {
  const parsed = strengthProgramSourceSnapshotSchema.parse(snapshot);
  return hashCanonicalText(canonicalJson(normalizeSnapshot(parsed)));
}

function candidateRecommendation(
  candidate: StrengthProgramCandidate,
  priorities: BodyGoalZone[],
  context: StrengthProgramContext,
): StrengthProgramRecommendation {
  const coverage = analyseBodyTrainingProgram(candidate.program, priorities);
  const priorityCoverage: StrengthPriorityCoverage[] = coverage.map((entry) => ({
    zone: entry.zone,
    requestedFineMuscles: [...BODY_TRAINING_MUSCLES[entry.zone]],
    exactFineMuscles: BODY_TRAINING_MUSCLES[entry.zone].filter((muscle) =>
      entry.matches.some((match) => match.kind === 'exact' && match.muscles.includes(muscle)),
    ),
    knownPlannedSets: entry.exactSets,
  }));
  const exactFineMuscles = priorityCoverage.flatMap((entry) => entry.exactFineMuscles);
  const missingFineMuscles = priorityCoverage.flatMap((entry) =>
    entry.requestedFineMuscles.filter((muscle) => !entry.exactFineMuscles.includes(muscle)),
  );
  const generalPriorityZones = coverage
    .filter((entry) => entry.generalPlans > 0)
    .map((entry) => entry.zone);
  const sessionDurationMinutes = candidate.program.sessions.map(estimateStrengthSessionMinutes);

  const issues: StrengthProgramRecommendation['issues'] = [];
  if (
    context.weeklyAvailability !== null &&
    candidate.program.sessions.length > context.weeklyAvailability
  ) {
    issues.push('schedule');
  }

  const requiredEquipment = new Set<Equipment>();
  for (const session of candidate.program.sessions) {
    for (const plan of session.plans) {
      if (plan.equipment !== null && plan.equipment !== 'bodyweight') {
        requiredEquipment.add(plan.equipment);
      }
    }
  }
  if (
    context.equipment !== null &&
    [...requiredEquipment].some((equipment) => !context.equipment!.includes(equipment))
  ) {
    issues.push('equipment');
  }

  if (
    context.sessionMinutes !== null &&
    sessionDurationMinutes.some(
      (duration) => duration !== null && duration > context.sessionMinutes!,
    )
  ) {
    issues.push('duration');
  }

  const reasons: StrengthProgramRecommendation['reasons'] = [];
  if (exactFineMuscles.length > 0) reasons.push('priorities');
  if (context.level !== null && candidate.program.level === context.level) reasons.push('level');
  if (context.weeklyAvailability !== null && !issues.includes('schedule')) reasons.push('schedule');
  if (context.equipment !== null && !issues.includes('equipment')) reasons.push('equipment');
  if (
    context.sessionMinutes !== null &&
    sessionDurationMinutes.every((duration) => duration !== null) &&
    !issues.includes('duration')
  ) {
    reasons.push('duration');
  }

  return {
    programId: candidate.program.id,
    isCurrent: candidate.isCurrent,
    compatible: issues.length === 0,
    exactPriorityCount: priorityCoverage.filter((entry) => entry.exactFineMuscles.length > 0).length,
    exactFineMuscles,
    missingFineMuscles,
    generalPriorityZones,
    priorityCoverage,
    sessionDurationMinutes,
    reasons,
    issues,
  };
}

function isExactLevel(
  candidate: StrengthProgramCandidate,
  contextLevel: TrainingLevel | null,
): boolean {
  return contextLevel !== null && candidate.program.level === contextLevel;
}

function scheduleDistance(
  candidate: StrengthProgramCandidate,
  weeklyAvailability: number | null,
): number {
  return weeklyAvailability === null
    ? 0
    : Math.abs(candidate.program.sessions.length - weeklyAvailability);
}

export function recommendStrengthPrograms(
  candidates: StrengthProgramCandidate[],
  priorities: BodyGoalZone[],
  context: StrengthProgramContext,
): StrengthProgramRecommendation[] {
  const byId = new Map(candidates.map((candidate) => [candidate.program.id, candidate]));
  const recommendations = candidates.map((candidate) =>
    candidateRecommendation(candidate, priorities, context),
  );

  recommendations.sort((left, right) => {
    const leftCandidate = byId.get(left.programId)!;
    const rightCandidate = byId.get(right.programId)!;
    return (
      Number(right.compatible) - Number(left.compatible) ||
      right.exactFineMuscles.length - left.exactFineMuscles.length ||
      right.exactPriorityCount - left.exactPriorityCount ||
      Number(isExactLevel(rightCandidate, context.level)) -
        Number(isExactLevel(leftCandidate, context.level)) ||
      Number(right.isCurrent) - Number(left.isCurrent) ||
      scheduleDistance(leftCandidate, context.weeklyAvailability) -
        scheduleDistance(rightCandidate, context.weeklyAvailability) ||
      compareText(left.programId, right.programId)
    );
  });

  const compatible = recommendations.filter((recommendation) => recommendation.compatible);
  return (compatible.length > 0
    ? compatible
    : recommendations.filter((recommendation) => !recommendation.compatible)
  ).slice(0, 3);
}
