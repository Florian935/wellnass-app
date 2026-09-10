import { describe, expect, it } from 'vitest';
import { compareExercisePerformance, type ComparableSet } from './workout-comparison';

/** Fabrique une série de travail validée. */
const set = (weightKg: number | null, reps: number | null, over: Partial<ComparableSet> = {}): ComparableSet => ({
  weightKg,
  reps,
  durationSeconds: null,
  setType: 'normal',
  done: true,
  ...over,
});

const duration = (seconds: number, over: Partial<ComparableSet> = {}): ComparableSet => ({
  weightKg: null,
  reps: null,
  durationSeconds: seconds,
  setType: 'duration',
  done: true,
  ...over,
});

describe('compareExercisePerformance', () => {
  it('signale une progression en charge', () => {
    const delta = compareExercisePerformance([set(82.5, 8)], [set(80, 8)]);
    expect(delta).toEqual({ kind: 'weight', deltaKg: 2.5 });
  });

  it('signale une régression en charge', () => {
    expect(compareExercisePerformance([set(75, 8)], [set(80, 8)])).toEqual({
      kind: 'weight',
      deltaKg: -5,
    });
  });

  it('à charge égale, compare les reps', () => {
    expect(compareExercisePerformance([set(80, 10)], [set(80, 8)])).toEqual({
      kind: 'reps',
      deltaReps: 2,
    });
  });

  it('rend `equal` quand rien ne bouge', () => {
    expect(compareExercisePerformance([set(80, 8)], [set(80, 8)])).toEqual({ kind: 'equal' });
  });

  it('exclut les échauffements des deux côtés', () => {
    // Règle métier §8 : les échauffements sortent du volume, des records et de la progression.
    // Sans ce filtre, un échauffement lourd de la fois précédente écraserait la comparaison.
    const delta = compareExercisePerformance(
      [set(100, 3, { setType: 'warmup' }), set(82.5, 8)],
      [set(120, 2, { setType: 'warmup' }), set(80, 8)],
    );
    expect(delta).toEqual({ kind: 'weight', deltaKg: 2.5 });
  });

  it('ignore les séries non validées', () => {
    const delta = compareExercisePerformance(
      [set(82.5, 8), set(200, 1, { done: false })],
      [set(80, 8)],
    );
    expect(delta).toEqual({ kind: 'weight', deltaKg: 2.5 });
  });

  it('retient la meilleure série, pas la dernière', () => {
    // Une dernière série en dégradation ne doit pas faire passer la séance pour une régression.
    const delta = compareExercisePerformance([set(85, 6), set(70, 10)], [set(80, 8)]);
    expect(delta).toEqual({ kind: 'weight', deltaKg: 5 });
  });

  it('à charge égale, retient les reps de la meilleure série', () => {
    const delta = compareExercisePerformance([set(80, 6), set(80, 11)], [set(80, 8)]);
    expect(delta).toEqual({ kind: 'reps', deltaReps: 3 });
  });

  it('compare les durées sur un exercice à la durée', () => {
    expect(compareExercisePerformance([duration(75)], [duration(60)])).toEqual({
      kind: 'duration',
      deltaSeconds: 15,
    });
    expect(compareExercisePerformance([duration(60)], [duration(60)])).toEqual({ kind: 'equal' });
  });

  it('arrondit au dixième pour ne pas afficher un flottant qui traîne', () => {
    const delta = compareExercisePerformance([set(82.5, 8)], [set(80.3, 8)]);
    expect(delta).toEqual({ kind: 'weight', deltaKg: 2.2 });
  });

  it('ne compare rien sans référence — un premier passage n’a pas « progressé de 0 »', () => {
    expect(compareExercisePerformance([set(80, 8)], null)).toBeNull();
    expect(compareExercisePerformance([set(80, 8)], [])).toBeNull();
  });

  it('ne compare rien si un côté n’a que des échauffements', () => {
    expect(
      compareExercisePerformance([set(80, 8)], [set(60, 5, { setType: 'warmup' })]),
    ).toBeNull();
  });
});
