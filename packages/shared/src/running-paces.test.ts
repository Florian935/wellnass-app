import { describe, expect, it } from 'vitest';
import {
  RUNNER_OBJECTIVES,
  RUNNER_LEVELS,
  SESSION_TYPES,
  runnerObjectiveSchema,
  runnerLevelSchema,
  sessionTypeSchema,
  VMA_COEFFICIENT,
  derivedVmaPace,
  sessionTargetPace,
  PROGRAM_SESSION_TYPES,
  hasRunningSessionTarget,
  paceAtVmaPercent,
} from './running-paces';

describe('schemas enum running-paces', () => {
  it('runnerObjectiveSchema accepte 10k', () => {
    expect(runnerObjectiveSchema.parse('10k')).toBe('10k');
  });

  it('runnerObjectiveSchema rejette une valeur inconnue', () => {
    expect(runnerObjectiveSchema.safeParse('x').success).toBe(false);
  });

  it('RUNNER_OBJECTIVES contient toutes les valeurs', () => {
    expect(RUNNER_OBJECTIVES).toContain('5k');
    expect(RUNNER_OBJECTIVES).toContain('marathon');
    expect(RUNNER_OBJECTIVES).toContain('perte_poids');
  });

  it('runnerLevelSchema accepte les 3 niveaux', () => {
    for (const level of RUNNER_LEVELS) {
      expect(runnerLevelSchema.parse(level)).toBe(level);
    }
  });

  it('sessionTypeSchema accepte les types connus', () => {
    for (const type of SESSION_TYPES) {
      expect(sessionTypeSchema.parse(type)).toBe(type);
    }
  });

  it('sessionTypeSchema rejette un type inconnu', () => {
    expect(sessionTypeSchema.safeParse('inconnu').success).toBe(false);
  });
});

describe('derivedVmaPace', () => {
  it('retourne ref5k * VMA_COEFFICIENT', () => {
    expect(derivedVmaPace(300)).toBeCloseTo(300 * VMA_COEFFICIENT, 6);
  });

  it('VMA (285) est plus rapide (plus petit) que la ref 5km (300)', () => {
    expect(derivedVmaPace(300)).toBeLessThan(300);
  });
});

describe('sessionTargetPace avec ref = 300 s/km', () => {
  const ref = 300;

  it('endurance -> {360, 390}', () => {
    expect(sessionTargetPace('endurance', ref)).toEqual({ minSPerKm: 360, maxSPerKm: 390 });
  });

  it('sortie_longue -> {330, 360}', () => {
    expect(sessionTargetPace('sortie_longue', ref)).toEqual({ minSPerKm: 330, maxSPerKm: 360 });
  });

  it('recuperation -> {390, 420}', () => {
    expect(sessionTargetPace('recuperation', ref)).toEqual({ minSPerKm: 390, maxSPerKm: 420 });
  });

  it('fractionne -> min = vma (285), max = ref (300)', () => {
    const result = sessionTargetPace('fractionne', ref);
    expect(result).not.toBeNull();
    // vma = 300 * 0.95 = 285
    expect(result!.minSPerKm).toBeCloseTo(285, 5);
    expect(result!.maxSPerKm).toBeCloseTo(300, 5);
  });

  it('course_libre -> null', () => {
    expect(sessionTargetPace('course_libre', ref)).toBeNull();
  });

  it('min < max pour tous les types non-null', () => {
    for (const type of SESSION_TYPES) {
      const result = sessionTargetPace(type, ref);
      if (result !== null) {
        expect(result.minSPerKm).toBeLessThan(result.maxSPerKm);
      }
    }
  });
});

describe('PROGRAM_SESSION_TYPES', () => {
  it('exclut course_libre', () => {
    expect(PROGRAM_SESSION_TYPES).not.toContain('course_libre');
    expect(PROGRAM_SESSION_TYPES).toEqual(['endurance', 'fractionne', 'sortie_longue', 'recuperation']);
  });
  it('est un sous-ensemble de SESSION_TYPES', () => {
    expect(PROGRAM_SESSION_TYPES.every((t) => (SESSION_TYPES as readonly string[]).includes(t))).toBe(true);
  });
});

describe('hasRunningSessionTarget', () => {
  it('distance seule -> true', () => { expect(hasRunningSessionTarget(6000, null)).toBe(true); });
  it('duree seule -> true', () => { expect(hasRunningSessionTarget(null, 1800)).toBe(true); });
  it('les deux -> true', () => { expect(hasRunningSessionTarget(6000, 1800)).toBe(true); });
  it('aucune / 0 / null -> false', () => {
    expect(hasRunningSessionTarget(null, null)).toBe(false);
    expect(hasRunningSessionTarget(0, 0)).toBe(false);
    expect(hasRunningSessionTarget(undefined, undefined)).toBe(false);
  });
});

describe('paceAtVmaPercent (US RUN-F2c)', () => {
  it('reproduit une valeur deja connue de sessionTargetPace (ref=300 -> vma=285 -> 95% = 300)', () => {
    const vma = derivedVmaPace(300); // 285
    expect(paceAtVmaPercent(vma, 95)).toBeCloseTo(300, 5);
  });
  it('un pourcentage plus bas donne une allure plus lente (chiffre plus grand)', () => {
    expect(paceAtVmaPercent(240, 80)).toBeCloseTo(300, 5);
    expect(paceAtVmaPercent(240, 95)).toBeCloseTo(252.6, 1);
    expect(paceAtVmaPercent(240, 80)).toBeGreaterThan(paceAtVmaPercent(240, 95));
  });
  it('100 % renvoie l\'allure VMA inchangee', () => {
    expect(paceAtVmaPercent(240, 100)).toBeCloseTo(240, 5);
  });
});
