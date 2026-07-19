import { describe, expect, it } from 'vitest';
import {
  PROGRAM_STATUSES,
  programStatusSchema,
  PROGRAM_LEVELS,
  programLevelSchema,
  programRowSchema,
  programTranslationRowSchema,
  sessionRowSchema,
  exercisePlanRowSchema,
  resolveProgramName,
} from './program';

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const UUID2 = '4a3604e0-5f90-42d4-ab1d-1416f93d4412';
const UUID3 = '5b4704e0-6a01-43e5-bc2e-2527a04e5523';
const NOW = '2026-07-06T00:00:00.000Z';

const BASE_SYNC = {
  id: UUID,
  ownerId: null,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
};

// ---------------------------------------------------------------------------
// PROGRAM_STATUSES
// ---------------------------------------------------------------------------
describe('PROGRAM_STATUSES', () => {
  it('contient draft et published', () => {
    expect(PROGRAM_STATUSES).toEqual(['draft', 'published']);
  });

  it('programStatusSchema accepte draft', () => {
    expect(programStatusSchema.parse('draft')).toBe('draft');
  });

  it('programStatusSchema accepte published', () => {
    expect(programStatusSchema.parse('published')).toBe('published');
  });

  it('programStatusSchema rejette une valeur inconnue', () => {
    expect(programStatusSchema.safeParse('archived').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PROGRAM_LEVELS
// ---------------------------------------------------------------------------
describe('PROGRAM_LEVELS', () => {
  it('contient beginner, intermediate et advanced', () => {
    expect(PROGRAM_LEVELS).toEqual(['beginner', 'intermediate', 'advanced']);
  });

  it('programLevelSchema accepte beginner', () => {
    expect(programLevelSchema.parse('beginner')).toBe('beginner');
  });

  it('programLevelSchema accepte intermediate', () => {
    expect(programLevelSchema.parse('intermediate')).toBe('intermediate');
  });

  it('programLevelSchema accepte advanced', () => {
    expect(programLevelSchema.parse('advanced')).toBe('advanced');
  });

  it('programLevelSchema rejette une valeur inconnue', () => {
    expect(programLevelSchema.safeParse('expert').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// programRowSchema
// ---------------------------------------------------------------------------
describe('programRowSchema', () => {
  const validRow = {
    ...BASE_SYNC,
    pillar: 'strength',
    status: 'published',
    isActive: true,
    level: 'intermediate',
    goal: 'Prise de masse',
    durationWeeks: 8,
  };

  it('valide une ligne programme complète', () => {
    const result = programRowSchema.parse(validRow);
    expect(result).toMatchObject({ pillar: 'strength', status: 'published', isActive: true });
  });

  it('accepte level null', () => {
    const row = { ...validRow, level: null };
    expect(programRowSchema.safeParse(row).success).toBe(true);
  });

  it('accepte goal null', () => {
    const row = { ...validRow, goal: null };
    expect(programRowSchema.safeParse(row).success).toBe(true);
  });

  it('accepte durationWeeks null', () => {
    const row = { ...validRow, durationWeeks: null };
    expect(programRowSchema.safeParse(row).success).toBe(true);
  });

  it('accepte ownerId null (bibliothèque globale)', () => {
    expect(programRowSchema.safeParse(validRow).success).toBe(true);
  });

  it('rejette un status inconnu', () => {
    const row = { ...validRow, status: 'archived' };
    expect(programRowSchema.safeParse(row).success).toBe(false);
  });

  it('rejette un pilier inconnu', () => {
    const row = { ...validRow, pillar: 'yoga' };
    expect(programRowSchema.safeParse(row).success).toBe(false);
  });

  it('rejette sans isActive', () => {
    const { isActive: _isActive, ...withoutIsActive } = validRow;
    expect(programRowSchema.safeParse(withoutIsActive).success).toBe(false);
  });

  it('rejette durationWeeks négatif', () => {
    const row = { ...validRow, durationWeeks: 0 };
    expect(programRowSchema.safeParse(row).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// programTranslationRowSchema
// ---------------------------------------------------------------------------
describe('programTranslationRowSchema', () => {
  const validTranslation = {
    ...BASE_SYNC,
    programId: UUID2,
    lang: 'fr',
    name: 'Programme force débutant',
    summary: 'Un programme pour débuter',
    description: null,
  };

  it('valide une traduction complète', () => {
    const result = programTranslationRowSchema.parse(validTranslation);
    expect(result).toMatchObject({ lang: 'fr', name: 'Programme force débutant' });
  });

  it('accepte summary null', () => {
    const tr = { ...validTranslation, summary: null };
    expect(programTranslationRowSchema.safeParse(tr).success).toBe(true);
  });

  it('accepte description null', () => {
    expect(programTranslationRowSchema.safeParse(validTranslation).success).toBe(true);
  });

  it('accepte lang en', () => {
    const tr = { ...validTranslation, lang: 'en' };
    expect(programTranslationRowSchema.safeParse(tr).success).toBe(true);
  });

  it('rejette une lang inconnue', () => {
    const tr = { ...validTranslation, lang: 'es' };
    expect(programTranslationRowSchema.safeParse(tr).success).toBe(false);
  });

  it('rejette sans programId', () => {
    const { programId: _p, ...withoutProgramId } = validTranslation;
    expect(programTranslationRowSchema.safeParse(withoutProgramId).success).toBe(false);
  });

  it('rejette sans name', () => {
    const { name: _n, ...withoutName } = validTranslation;
    expect(programTranslationRowSchema.safeParse(withoutName).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sessionRowSchema
// ---------------------------------------------------------------------------
describe('sessionRowSchema', () => {
  const validSession = {
    ...BASE_SYNC,
    programId: UUID2,
    orderIndex: 0,
    name: 'Séance A',
  };

  it('valide une session complète', () => {
    const result = sessionRowSchema.parse(validSession);
    expect(result).toMatchObject({ programId: UUID2, orderIndex: 0, name: 'Séance A' });
  });

  it('accepte name null (sessions non traduites en V0.3)', () => {
    const session = { ...validSession, name: null };
    expect(sessionRowSchema.safeParse(session).success).toBe(true);
  });

  it('accepte orderIndex à 0', () => {
    expect(sessionRowSchema.safeParse(validSession).success).toBe(true);
  });

  it('rejette orderIndex négatif', () => {
    const session = { ...validSession, orderIndex: -1 };
    expect(sessionRowSchema.safeParse(session).success).toBe(false);
  });

  it('rejette sans programId', () => {
    const { programId: _p, ...withoutProgramId } = validSession;
    expect(sessionRowSchema.safeParse(withoutProgramId).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// exercisePlanRowSchema
// ---------------------------------------------------------------------------
describe('exercisePlanRowSchema', () => {
  const validPlan = {
    ...BASE_SYNC,
    sessionId: UUID2,
    exerciseId: UUID3,
    orderIndex: 0,
    setType: 'normal',
    targetSets: 4,
    targetReps: '8-12',
    targetWeightKg: 80,
    restSeconds: 90,
  };

  it('valide une ligne plan complète', () => {
    const result = exercisePlanRowSchema.parse(validPlan);
    expect(result).toMatchObject({ setType: 'normal', targetReps: '8-12' });
  });

  it('setType par défaut est normal', () => {
    const { setType: _st, ...withoutSetType } = validPlan;
    const result = exercisePlanRowSchema.parse(withoutSetType);
    expect(result.setType).toBe('normal');
  });

  it('accepte targetSets null', () => {
    const plan = { ...validPlan, targetSets: null };
    expect(exercisePlanRowSchema.safeParse(plan).success).toBe(true);
  });

  it('accepte targetReps null', () => {
    const plan = { ...validPlan, targetReps: null };
    expect(exercisePlanRowSchema.safeParse(plan).success).toBe(true);
  });

  it('accepte targetWeightKg null', () => {
    const plan = { ...validPlan, targetWeightKg: null };
    expect(exercisePlanRowSchema.safeParse(plan).success).toBe(true);
  });

  it('accepte restSeconds null', () => {
    const plan = { ...validPlan, restSeconds: null };
    expect(exercisePlanRowSchema.safeParse(plan).success).toBe(true);
  });

  it('accepte restSeconds à 0', () => {
    const plan = { ...validPlan, restSeconds: 0 };
    expect(exercisePlanRowSchema.safeParse(plan).success).toBe(true);
  });

  it('rejette orderIndex négatif', () => {
    const plan = { ...validPlan, orderIndex: -1 };
    expect(exercisePlanRowSchema.safeParse(plan).success).toBe(false);
  });

  it('rejette un setType inconnu', () => {
    const plan = { ...validPlan, setType: 'drop_set' };
    expect(exercisePlanRowSchema.safeParse(plan).success).toBe(false);
  });

  it('rejette targetSets négatif ou nul', () => {
    const plan = { ...validPlan, targetSets: 0 };
    expect(exercisePlanRowSchema.safeParse(plan).success).toBe(false);
  });

  it('rejette targetWeightKg négatif ou nul', () => {
    const plan = { ...validPlan, targetWeightKg: 0 };
    expect(exercisePlanRowSchema.safeParse(plan).success).toBe(false);
  });

  it('rejette restSeconds négatif', () => {
    const plan = { ...validPlan, restSeconds: -1 };
    expect(exercisePlanRowSchema.safeParse(plan).success).toBe(false);
  });

  it('rejette sans sessionId', () => {
    const { sessionId: _s, ...withoutSessionId } = validPlan;
    expect(exercisePlanRowSchema.safeParse(withoutSessionId).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveProgramName
// ---------------------------------------------------------------------------
describe('resolveProgramName', () => {
  const translations = [
    { lang: 'fr', name: 'Force débutant' },
    { lang: 'en', name: 'Beginner strength' },
  ];

  it('retourne la langue demandée', () => {
    expect(resolveProgramName(translations, 'en')).toBe('Beginner strength');
  });

  it('retourne le FR si la langue demandée est absente', () => {
    expect(resolveProgramName([{ lang: 'fr', name: 'Force débutant' }], 'en')).toBe('Force débutant');
  });

  it('retombe sur le premier élément si même le FR est absent', () => {
    expect(resolveProgramName([{ lang: 'en', name: 'Beginner strength' }], 'fr')).toBe(
      'Beginner strength',
    );
  });

  it('retourne undefined pour un tableau vide', () => {
    expect(resolveProgramName([], 'fr')).toBeUndefined();
  });
});
