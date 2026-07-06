import { describe, expect, it } from 'vitest';
import {
  MUSCLE_GROUPS,
  muscleGroupSchema,
  EQUIPMENTS,
  equipmentSchema,
  SOURCES,
  sourceSchema,
  exerciseRowSchema,
  exerciseTranslationRowSchema,
  resolveExerciseName,
} from './exercise';

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const UUID2 = '4a3604e0-5f90-42d4-ab1d-1416f93d4412';
const NOW = '2026-07-06T00:00:00.000Z';

const BASE_SYNC = {
  id: UUID,
  ownerId: null,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
};

// ---------------------------------------------------------------------------
// MUSCLE_GROUPS
// ---------------------------------------------------------------------------
describe('MUSCLE_GROUPS', () => {
  it('contient les 6 groupes musculaires canoniques', () => {
    expect(MUSCLE_GROUPS).toEqual(['chest', 'back', 'legs', 'shoulders', 'arms', 'core']);
  });

  it('muscleGroupSchema accepte une valeur valide', () => {
    expect(muscleGroupSchema.parse('chest')).toBe('chest');
  });

  it('muscleGroupSchema rejette une valeur inconnue', () => {
    expect(muscleGroupSchema.safeParse('glutes').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EQUIPMENTS
// ---------------------------------------------------------------------------
describe('EQUIPMENTS', () => {
  it('contient au moins barbell et bodyweight', () => {
    expect(EQUIPMENTS).toContain('barbell');
    expect(EQUIPMENTS).toContain('bodyweight');
  });

  it('equipmentSchema accepte une valeur valide', () => {
    expect(equipmentSchema.parse('dumbbell')).toBe('dumbbell');
  });

  it('equipmentSchema rejette une valeur inconnue', () => {
    expect(equipmentSchema.safeParse('magic_stick').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SOURCES
// ---------------------------------------------------------------------------
describe('SOURCES', () => {
  it('contient library et custom', () => {
    expect(SOURCES).toEqual(['library', 'custom']);
  });

  it('sourceSchema accepte library', () => {
    expect(sourceSchema.parse('library')).toBe('library');
  });
});

// ---------------------------------------------------------------------------
// exerciseRowSchema
// ---------------------------------------------------------------------------
describe('exerciseRowSchema', () => {
  const validRow = {
    ...BASE_SYNC,
    source: 'library',
    musclePrimary: 'legs',
    equipment: 'barbell',
    mediaUrl: 'https://example.com/squat.mp4',
  };

  it('valide une ligne exercice complète', () => {
    expect(exerciseRowSchema.parse(validRow)).toMatchObject({ source: 'library', musclePrimary: 'legs' });
  });

  it('accepte equipment null', () => {
    const row = { ...validRow, equipment: null };
    expect(exerciseRowSchema.safeParse(row).success).toBe(true);
  });

  it('accepte mediaUrl null', () => {
    const row = { ...validRow, mediaUrl: null };
    expect(exerciseRowSchema.safeParse(row).success).toBe(true);
  });

  it('rejette un musclePrimary inconnu', () => {
    const row = { ...validRow, musclePrimary: 'glutes' };
    expect(exerciseRowSchema.safeParse(row).success).toBe(false);
  });

  it('rejette sans source', () => {
    const { source: _source, ...withoutSource } = validRow;
    expect(exerciseRowSchema.safeParse(withoutSource).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// exerciseTranslationRowSchema
// ---------------------------------------------------------------------------
describe('exerciseTranslationRowSchema', () => {
  const validTranslation = {
    ...BASE_SYNC,
    exerciseId: UUID2,
    lang: 'fr',
    name: 'Squat',
    instructions: null,
  };

  it('valide une traduction complète', () => {
    expect(exerciseTranslationRowSchema.parse(validTranslation)).toMatchObject({ lang: 'fr', name: 'Squat' });
  });

  it('accepte instructions null', () => {
    expect(exerciseTranslationRowSchema.safeParse(validTranslation).success).toBe(true);
  });

  it('accepte une valeur de lang connue (en)', () => {
    const tr = { ...validTranslation, lang: 'en' };
    expect(exerciseTranslationRowSchema.safeParse(tr).success).toBe(true);
  });

  it('rejette une lang inconnue', () => {
    const tr = { ...validTranslation, lang: 'de' };
    expect(exerciseTranslationRowSchema.safeParse(tr).success).toBe(false);
  });

  it('rejette sans exerciseId', () => {
    const { exerciseId: _ex, ...withoutEx } = validTranslation;
    expect(exerciseTranslationRowSchema.safeParse(withoutEx).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveExerciseName
// ---------------------------------------------------------------------------
describe('resolveExerciseName', () => {
  const tr = [{ lang: 'fr', name: 'Squat' }, { lang: 'en', name: 'Squat (EN)' }];

  it('rend la langue demandée', () => {
    expect(resolveExerciseName(tr, 'en')).toBe('Squat (EN)');
  });

  it('retombe sur le FR si la langue manque', () => {
    expect(resolveExerciseName([{ lang: 'fr', name: 'Squat' }], 'en')).toBe('Squat');
  });

  it('retombe sur le premier élément si même le FR est absent', () => {
    expect(resolveExerciseName([{ lang: 'en', name: 'Squat (EN)' }], 'fr')).toBe('Squat (EN)');
  });

  it('retourne undefined pour un tableau vide', () => {
    expect(resolveExerciseName([], 'fr')).toBeUndefined();
  });
});
