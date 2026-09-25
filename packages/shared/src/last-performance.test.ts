import { describe, expect, it } from 'vitest';
import {
  commonDayKey,
  formatLastPerformance,
  type LastPerfFormat,
  type LastPerfSet,
} from './last-performance';

/** Format de test : décimales à la française, sans zéro inutile, comme l'app. */
const FR: LastPerfFormat = {
  load: (kg) => String(Number.isInteger(kg) ? kg : kg.toFixed(1)).replace('.', ','),
  unit: 'kg',
  bodyweight: 'PdC',
  duration: (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
};

const charge = (weightKg: number | null, reps: number | null, setType = 'normal'): LastPerfSet => ({
  setType,
  weightKg,
  reps,
  durationSeconds: null,
});
const pdc = (reps: number | null, weightKg: number | null = null): LastPerfSet => ({
  setType: 'bodyweight',
  weightKg,
  reps,
  durationSeconds: null,
});
const duree = (s: number | null, weightKg: number | null = null): LastPerfSet => ({
  setType: 'duration',
  weightKg,
  reps: null,
  durationSeconds: s,
});

describe('formatLastPerformance — R3', () => {
  it('rien à dire : null (l’appelant affiche « Première fois »)', () => {
    expect(formatLastPerformance([], FR)).toBeNull();
  });

  it('une seule charge : la charge une fois, puis les répétitions', () => {
    expect(
      formatLastPerformance([charge(80, 8), charge(80, 8), charge(80, 7), charge(80, 6)], FR),
    ).toBe('80 kg × 8 · 8 · 7 · 6');
  });

  it('charges différentes : chaque série, l’unité une fois en fin', () => {
    expect(formatLastPerformance([charge(80, 8), charge(77.5, 8), charge(75, 9)], FR)).toBe(
      '80 × 8 · 77,5 × 8 · 75 × 9 kg',
    );
  });

  it('dropsets et séries à l’échec comptent comme des séries de travail', () => {
    expect(
      formatLastPerformance([charge(60, 10, 'normal'), charge(60, 8, 'failure'), charge(60, 6, 'dropset')], FR),
    ).toBe('60 kg × 10 · 8 · 6');
  });

  it('les échauffements sont écartés, par sécurité', () => {
    expect(formatLastPerformance([charge(40, 10, 'warmup'), charge(80, 8)], FR)).toBe('80 kg × 8');
  });

  it('poids du corps', () => {
    expect(formatLastPerformance([pdc(12), pdc(10)], FR)).toBe('PdC × 12 · 10');
  });

  it('lesté : le lest signé', () => {
    expect(formatLastPerformance([pdc(10, 10), pdc(9, 10), pdc(8, 10)], FR)).toBe(
      '+10 kg × 10 · 9 · 8',
    );
  });

  it('assisté : une charge négative se lit avec un vrai signe moins', () => {
    expect(formatLastPerformance([pdc(8, -20), pdc(8, -20)], FR)).toBe('−20 kg × 8 · 8');
  });

  it('poids du corps et lest mêlés : chaque série en entier', () => {
    expect(formatLastPerformance([pdc(10), pdc(8, 10)], FR)).toBe('PdC × 10 · +10 kg × 8');
  });

  it('série sans charge, série sans répétitions', () => {
    expect(formatLastPerformance([charge(null, 8), charge(null, 8)], FR)).toBe('× 8 · 8');
    expect(formatLastPerformance([charge(80, null), charge(80, 5)], FR)).toBe('80 · 80 × 5 kg');
  });

  it('durée, en m:ss comme la séance', () => {
    expect(formatLastPerformance([duree(45), duree(40), duree(40)], FR)).toBe('0:45 · 0:40 · 0:40');
  });

  it('durée lestée : le lest une fois en tête', () => {
    expect(formatLastPerformance([duree(45, 10), duree(40, 10)], FR)).toBe('+10 kg · 0:45 · 0:40');
  });

  it('durées à lests différents : le lest de chaque série entre parenthèses', () => {
    expect(formatLastPerformance([duree(45, 10), duree(40)], FR)).toBe('0:45 (+10 kg) · 0:40');
  });

  it('au-delà de cinq séries : les cinq premières, puis le reste compté', () => {
    const six = [8, 8, 8, 7, 7, 6].map((r) => charge(80, r));
    expect(formatLastPerformance(six, FR)).toBe('80 kg × 8 · 8 · 8 · 7 · 7 · +1');
  });

  it('le plafond se règle', () => {
    const quatre = [8, 8, 8, 7].map((r) => charge(80, r));
    expect(formatLastPerformance(quatre, { ...FR, maxSets: 2 })).toBe('80 kg × 8 · 8 · +2');
  });

  it('l’unité suit le format (livres)', () => {
    const LB: LastPerfFormat = { ...FR, unit: 'lb', load: (kg) => String(Math.round(kg * 2.20462)) };
    expect(formatLastPerformance([charge(80, 8), charge(80, 8)], LB)).toBe('176 lb × 8 · 8');
  });
});

describe('commonDayKey', () => {
  it('une date commune à toutes les lignes', () => {
    expect(commonDayKey(['2026-09-17', '2026-09-17', '2026-09-17'])).toBe('2026-09-17');
  });

  it('des dates différentes : pas de date commune', () => {
    expect(commonDayKey(['2026-09-17', '2026-09-10'])).toBeNull();
  });

  it('une ligne jamais faite ne casse pas la date des autres', () => {
    expect(commonDayKey(['2026-09-17', null, '2026-09-17'])).toBe('2026-09-17');
  });

  it('rien de fait : pas de date', () => {
    expect(commonDayKey([null, null])).toBeNull();
    expect(commonDayKey([])).toBeNull();
  });
});
