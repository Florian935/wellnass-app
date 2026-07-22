import { describe, it, expect } from 'vitest';
import { buildExerciseFilterClause } from './exercise-filter';

describe('buildExerciseFilterClause', () => {
  it('aucun filtre → clause vide, aucun paramètre', () => {
    expect(buildExerciseFilterClause()).toEqual({ clause: '', params: [] });
    expect(buildExerciseFilterClause([], [])).toEqual({ clause: '', params: [] });
  });

  it('un seul groupe musculaire → IN (?) paramétré', () => {
    const { clause, params } = buildExerciseFilterClause(['back']);
    expect(clause).toBe('AND e.muscle_primary IN (?)');
    expect(params).toEqual(['back']);
  });

  it('plusieurs groupes → IN (?,?) — OU au sein de la facette', () => {
    const { clause, params } = buildExerciseFilterClause(['back', 'shoulders']);
    expect(clause).toBe('AND e.muscle_primary IN (?,?)');
    expect(params).toEqual(['back', 'shoulders']);
  });

  it('matériel seul → clause sur e.equipment', () => {
    const { clause, params } = buildExerciseFilterClause(undefined, ['barbell', 'dumbbell']);
    expect(clause).toBe('AND e.equipment IN (?,?)');
    expect(params).toEqual(['barbell', 'dumbbell']);
  });

  it('muscle + matériel → les deux IN reliés par AND — ET inter-facettes', () => {
    const { clause, params } = buildExerciseFilterClause(['back'], ['cable']);
    expect(clause).toBe('AND e.muscle_primary IN (?) AND e.equipment IN (?)');
    expect(params).toEqual(['back', 'cable']);
  });
});
