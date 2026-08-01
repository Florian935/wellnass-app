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
  normalizeSecondaryMuscles,
  FINE_MUSCLES,
  fineMuscleSchema,
  BROAD_TO_FINE,
  FINE_MUSCLE_VIEWS,
  normalizeFineMuscles,
  resolveFineMuscles,
  resolveSessionFineMuscles,
  resolveTonnageFineMuscles,
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

// ---------------------------------------------------------------------------
// normalizeSecondaryMuscles
// ---------------------------------------------------------------------------
describe('normalizeSecondaryMuscles', () => {
  it('conserve les groupes valides distincts du primaire', () => {
    expect(normalizeSecondaryMuscles(['arms', 'shoulders'], 'chest')).toEqual(['arms', 'shoulders']);
  });
  it('déduplique', () => {
    expect(normalizeSecondaryMuscles(['arms', 'arms'], 'chest')).toEqual(['arms']);
  });
  it('exclut le muscle primaire', () => {
    expect(normalizeSecondaryMuscles(['chest', 'arms'], 'chest')).toEqual(['arms']);
  });
  it('filtre les valeurs inconnues', () => {
    expect(normalizeSecondaryMuscles(['arms', 'bogus'], 'chest')).toEqual(['arms']);
  });
  it('renvoie [] pour une entrée non-tableau', () => {
    expect(normalizeSecondaryMuscles('nope', 'chest')).toEqual([]);
    expect(normalizeSecondaryMuscles(null, 'chest')).toEqual([]);
    expect(normalizeSecondaryMuscles(undefined, 'chest')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// exerciseRowSchema — musclesSecondary
// ---------------------------------------------------------------------------
describe('exerciseRowSchema — musclesSecondary', () => {
  const base = {
    id: '11111111-1111-1111-1111-111111111111',
    ownerId: null,
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
    deletedAt: null,
    source: 'library' as const,
    musclePrimary: 'chest' as const,
    equipment: null,
    mediaUrl: null,
  };
  it('défaut [] si absent', () => {
    expect(exerciseRowSchema.parse(base).musclesSecondary).toEqual([]);
  });
  it('accepte des groupes valides', () => {
    expect(exerciseRowSchema.parse({ ...base, musclesSecondary: ['arms'] }).musclesSecondary).toEqual(['arms']);
  });
});

// ---------------------------------------------------------------------------
// FINE_MUSCLES (US MUSC-F1b)
// ---------------------------------------------------------------------------
describe('FINE_MUSCLES', () => {
  it('contient les 10 muscles fins canoniques', () => {
    expect(FINE_MUSCLES).toEqual([
      'chest',
      'back',
      'shoulders',
      'biceps',
      'triceps',
      'abs',
      'glutes',
      'quadriceps',
      'hamstrings',
      'calves',
    ]);
  });

  it('fineMuscleSchema accepte une valeur valide', () => {
    expect(fineMuscleSchema.parse('biceps')).toBe('biceps');
  });

  it('fineMuscleSchema rejette une valeur inconnue', () => {
    expect(fineMuscleSchema.safeParse('deltoid_anterior').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FINE_MUSCLE_VIEWS
// ---------------------------------------------------------------------------
describe('FINE_MUSCLE_VIEWS', () => {
  it('shoulders est sur les deux vues, seul dans ce cas', () => {
    expect(FINE_MUSCLE_VIEWS.shoulders).toEqual(['front', 'back']);
    const onBoth = FINE_MUSCLES.filter((m) => FINE_MUSCLE_VIEWS[m].length === 2);
    expect(onBoth).toEqual(['shoulders']);
  });

  it('chest/biceps/abs/quadriceps sont uniquement en face', () => {
    expect(FINE_MUSCLE_VIEWS.chest).toEqual(['front']);
    expect(FINE_MUSCLE_VIEWS.biceps).toEqual(['front']);
    expect(FINE_MUSCLE_VIEWS.abs).toEqual(['front']);
    expect(FINE_MUSCLE_VIEWS.quadriceps).toEqual(['front']);
  });

  it('back/triceps/glutes/hamstrings/calves sont uniquement au dos', () => {
    expect(FINE_MUSCLE_VIEWS.back).toEqual(['back']);
    expect(FINE_MUSCLE_VIEWS.triceps).toEqual(['back']);
    expect(FINE_MUSCLE_VIEWS.glutes).toEqual(['back']);
    expect(FINE_MUSCLE_VIEWS.hamstrings).toEqual(['back']);
    expect(FINE_MUSCLE_VIEWS.calves).toEqual(['back']);
  });
});

// ---------------------------------------------------------------------------
// normalizeFineMuscles
// ---------------------------------------------------------------------------
describe('normalizeFineMuscles', () => {
  it('conserve les muscles fins valides', () => {
    expect(normalizeFineMuscles(['biceps', 'triceps'])).toEqual(['biceps', 'triceps']);
  });
  it('déduplique', () => {
    expect(normalizeFineMuscles(['biceps', 'biceps'])).toEqual(['biceps']);
  });
  it('n\'exclut pas un muscle qui porte la même clé qu\'un groupe large (pas d\'invariant primaire)', () => {
    expect(normalizeFineMuscles(['chest'])).toEqual(['chest']);
  });
  it('filtre les valeurs inconnues', () => {
    expect(normalizeFineMuscles(['biceps', 'bogus'])).toEqual(['biceps']);
  });
  it('renvoie [] pour une entrée non-tableau', () => {
    expect(normalizeFineMuscles('nope')).toEqual([]);
    expect(normalizeFineMuscles(null)).toEqual([]);
    expect(normalizeFineMuscles(undefined)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// resolveFineMuscles
// ---------------------------------------------------------------------------
describe('resolveFineMuscles', () => {
  it('exercice tagué fin → full = musclesFine, reduced = []', () => {
    expect(
      resolveFineMuscles({ musclePrimary: 'arms', musclesSecondary: [], musclesFine: ['biceps'] }),
    ).toEqual({ full: ['biceps'], reduced: [] });
  });

  it('exercice non tagué, primaire seul → full = expansion du primaire, reduced = []', () => {
    expect(
      resolveFineMuscles({ musclePrimary: 'chest', musclesSecondary: [], musclesFine: [] }),
    ).toEqual({ full: ['chest'], reduced: [] });
  });

  it('exercice non tagué, primaire + secondaires → reduced = union des expansions des secondaires', () => {
    expect(
      resolveFineMuscles({ musclePrimary: 'chest', musclesSecondary: ['arms', 'core'], musclesFine: [] }),
    ).toEqual({ full: ['chest'], reduced: ['biceps', 'triceps', 'abs'] });
  });

  it('arms non tagué → full contient biceps et triceps (défaut assumé)', () => {
    expect(
      resolveFineMuscles({ musclePrimary: 'arms', musclesSecondary: [], musclesFine: [] }).full,
    ).toEqual(['biceps', 'triceps']);
  });

  it('legs non tagué → full contient quadriceps, ischio-jambiers et mollets', () => {
    expect(
      resolveFineMuscles({ musclePrimary: 'legs', musclesSecondary: [], musclesFine: [] }).full,
    ).toEqual(['quadriceps', 'hamstrings', 'calves']);
  });

  it('BROAD_TO_FINE couvre les 6 groupes larges', () => {
    expect(new Set(Object.keys(BROAD_TO_FINE))).toEqual(new Set(MUSCLE_GROUPS));
  });
});

// ---------------------------------------------------------------------------
// exerciseRowSchema — musclesFine
// ---------------------------------------------------------------------------
describe('exerciseRowSchema — musclesFine', () => {
  const base = {
    id: '11111111-1111-1111-1111-111111111111',
    ownerId: null,
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
    deletedAt: null,
    source: 'library' as const,
    musclePrimary: 'chest' as const,
    equipment: null,
    mediaUrl: null,
  };
  it('défaut [] si absent', () => {
    expect(exerciseRowSchema.parse(base).musclesFine).toEqual([]);
  });
  it('accepte des muscles fins valides', () => {
    expect(exerciseRowSchema.parse({ ...base, musclesFine: ['chest', 'triceps'] }).musclesFine).toEqual([
      'chest',
      'triceps',
    ]);
  });
  it('rejette un muscle fin inconnu', () => {
    expect(exerciseRowSchema.safeParse({ ...base, musclesFine: ['bogus'] }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveSessionFineMuscles
// ---------------------------------------------------------------------------
describe('resolveSessionFineMuscles', () => {
  it('séance vide → aucune émphase', () => {
    expect(resolveSessionFineMuscles([])).toEqual({ full: [], reduced: [] });
  });

  it('union de plusieurs exercices non tagués, sans doublon', () => {
    const result = resolveSessionFineMuscles([
      { musclePrimary: 'chest', musclesSecondary: [], musclesFine: [] },
      { musclePrimary: 'chest', musclesSecondary: [], musclesFine: [] },
    ]);
    expect(result.full).toEqual(['chest']);
  });

  it('mêle exercices tagués et non tagués sans doublon d\'émphase', () => {
    const result = resolveSessionFineMuscles([
      { musclePrimary: 'arms', musclesSecondary: [], musclesFine: ['biceps'] },
      { musclePrimary: 'chest', musclesSecondary: ['arms'], musclesFine: [] },
    ]);
    expect(new Set(result.full)).toEqual(new Set(['biceps', 'chest']));
    expect(result.reduced).toEqual(['triceps']);
  });

  it('un muscle plein pour un exercice et réduit pour un autre finit plein (le plus fort gagne)', () => {
    const result = resolveSessionFineMuscles([
      { musclePrimary: 'arms', musclesSecondary: [], musclesFine: ['biceps'] },
      { musclePrimary: 'back', musclesSecondary: ['arms'], musclesFine: [] },
    ]);
    expect(result.full).toContain('biceps');
    expect(result.reduced).not.toContain('biceps');
  });
});

// ---------------------------------------------------------------------------
// resolveTonnageFineMuscles
// ---------------------------------------------------------------------------
describe('resolveTonnageFineMuscles', () => {
  it('semaine vide → silhouette neutre, sans division par zéro (critère 6)', () => {
    expect(resolveTonnageFineMuscles([])).toEqual({ full: [], reduced: [] });
  });

  it('le muscle au tonnage maximal est en pleine émphase, les autres touchés en réduite (critère 5)', () => {
    const result = resolveTonnageFineMuscles([
      { tonnageKg: 500, musclePrimary: 'legs', musclesSecondary: [], musclesFine: ['quadriceps'] },
      { tonnageKg: 80, musclePrimary: 'back', musclesSecondary: [], musclesFine: ['back'] },
    ]);
    expect(result.full).toEqual(['quadriceps']);
    expect(result.reduced).toEqual(['back']);
  });

  it('deux muscles à égalité de tonnage maximal sont tous les deux en pleine émphase', () => {
    const result = resolveTonnageFineMuscles([
      { tonnageKg: 100, musclePrimary: 'chest', musclesSecondary: [], musclesFine: ['chest'] },
      { tonnageKg: 100, musclePrimary: 'back', musclesSecondary: [], musclesFine: ['back'] },
    ]);
    expect(new Set(result.full)).toEqual(new Set(['chest', 'back']));
    expect(result.reduced).toEqual([]);
  });

  it('agrège le tonnage d\'un même muscle sur plusieurs exercices', () => {
    const result = resolveTonnageFineMuscles([
      { tonnageKg: 60, musclePrimary: 'arms', musclesSecondary: [], musclesFine: ['biceps'] },
      { tonnageKg: 60, musclePrimary: 'arms', musclesSecondary: [], musclesFine: ['biceps'] },
      { tonnageKg: 100, musclePrimary: 'legs', musclesSecondary: [], musclesFine: ['quadriceps'] },
    ]);
    // 120 (biceps agrégé) > 100 (quadriceps) → biceps devient le muscle plein, pas quadriceps.
    expect(result.full).toEqual(['biceps']);
    expect(result.reduced).toEqual(['quadriceps']);
  });
});
