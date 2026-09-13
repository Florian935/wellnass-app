import { describe, expect, it } from 'vitest';

import { computeSessionHeat, hottestMuscles, type HeatSet } from './session-heat';

const MUSCLES = {
  couche: { full: ['chest' as const], reduced: ['triceps' as const, 'shoulders' as const] },
  militaire: { full: ['shoulders' as const], reduced: ['triceps' as const] },
};

const serie = (exerciseId: string, over: Partial<HeatSet> = {}): HeatSet => ({
  exerciseId,
  setType: 'normal',
  done: true,
  ...over,
});

describe('chaleur de séance', () => {
  it('chauffe le muscle principal plus vite que les secondaires', () => {
    const heat = computeSessionHeat([serie('couche'), serie('couche')], MUSCLES);
    expect(heat.chest).toBeCloseTo(0.4, 5);
    expect(heat.triceps).toBeCloseTo(0.2, 5);
  });

  it('cumule un muscle plein pour un exercice et réduit pour un autre', () => {
    const heat = computeSessionHeat([serie('couche'), serie('militaire')], MUSCLES);
    // Épaules : réduites au couché (0,1) puis pleines au militaire (0,2).
    expect(heat.shoulders).toBeCloseTo(0.3, 5);
  });

  it('ignore les séries non validées et les échauffements', () => {
    const heat = computeSessionHeat(
      [serie('couche', { done: false }), serie('couche', { setType: 'warmup' })],
      MUSCLES,
    );
    expect(heat.chest).toBeUndefined();
  });

  it('compte une série à la durée — un gainage chauffe', () => {
    const heat = computeSessionHeat([serie('gainage', { setType: 'duration' })], {
      gainage: { full: ['abs'], reduced: [] },
    });
    expect(heat.abs).toBeCloseTo(0.2, 5);
  });

  it('plafonne à 1 au lieu de dépasser', () => {
    const heat = computeSessionHeat(Array.from({ length: 12 }, () => serie('couche')), MUSCLES);
    expect(heat.chest).toBe(1);
  });

  it('ignore un exercice dont on ne connaît pas les muscles', () => {
    expect(computeSessionHeat([serie('inconnu')], MUSCLES)).toEqual({});
  });

  it('classe les muscles les plus chauds, de façon déterministe', () => {
    const heat = computeSessionHeat([serie('couche'), serie('couche'), serie('militaire')], MUSCLES);
    expect(hottestMuscles(heat)).toEqual(['chest', 'shoulders']);
  });
});
