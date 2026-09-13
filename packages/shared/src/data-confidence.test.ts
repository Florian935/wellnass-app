import { describe, expect, it } from 'vitest';
import { weekLoggingConfidence } from './data-confidence';

const today = '2026-09-20';

describe('weekLoggingConfidence (US DASH-01, brouillard de confiance)', () => {
  it('les 6 jours passés saisis → full, aucun jour manquant', () => {
    const days = ['14', '15', '16', '17', '18', '19'].map((d) => ({ dayKey: `2026-09-${d}`, kcal: 2000 }));
    expect(weekLoggingConfidence(days, today)).toEqual({ level: 'full', missingDayKeys: [] });
  });

  it('aujourd’hui n’est jamais compté comme manquant (la journée est en cours)', () => {
    const days = ['14', '15', '16', '17', '18', '19'].map((d) => ({ dayKey: `2026-09-${d}`, kcal: 2000 }));
    expect(weekLoggingConfidence([...days, { dayKey: today, kcal: 0 }], today).level).toBe('full');
  });

  it('un ou deux jours vides → partial, jours listés du plus récent au plus ancien', () => {
    const days = [
      { dayKey: '2026-09-14', kcal: 2000 },
      { dayKey: '2026-09-15', kcal: 0 },
      { dayKey: '2026-09-16', kcal: 2100 },
      { dayKey: '2026-09-17', kcal: 1900 },
      { dayKey: '2026-09-19', kcal: 2050 },
    ];
    expect(weekLoggingConfidence(days, today)).toEqual({
      level: 'partial',
      missingDayKeys: ['2026-09-18', '2026-09-15'],
    });
  });

  it('trois jours vides ou plus → low', () => {
    expect(weekLoggingConfidence([{ dayKey: '2026-09-19', kcal: 1800 }], today).level).toBe('low');
  });

  it('traverse les fins de mois', () => {
    const r = weekLoggingConfidence([], '2026-10-02');
    expect(r.missingDayKeys).toEqual([
      '2026-10-01',
      '2026-09-30',
      '2026-09-29',
      '2026-09-28',
      '2026-09-27',
      '2026-09-26',
    ]);
  });
});
