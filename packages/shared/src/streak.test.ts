import { describe, expect, it } from 'vitest';
import { computeStreak, activeDayKeys, type DayActivity } from './streak';

const days = (arr: string[]) => new Set(arr);

describe('computeStreak', () => {
  it("compte les jours actifs consécutifs finissant aujourd'hui", () => {
    expect(computeStreak(days(['2026-07-09', '2026-07-10', '2026-07-11']), '2026-07-11'))
      .toEqual({ current: 3, activeToday: true });
  });

  it("aujourd'hui inactif mais hier actif → série conservée", () => {
    expect(computeStreak(days(['2026-07-09', '2026-07-10']), '2026-07-11'))
      .toEqual({ current: 2, activeToday: false });
  });

  it('un trou casse la série', () => {
    expect(computeStreak(days(['2026-07-07', '2026-07-10', '2026-07-11']), '2026-07-11'))
      .toEqual({ current: 2, activeToday: true });
  });

  it("ni aujourd'hui ni hier → 0", () => {
    expect(computeStreak(days(['2026-07-01']), '2026-07-11')).toEqual({ current: 0, activeToday: false });
  });

  it('aucun jour → 0', () => {
    expect(computeStreak(days([]), '2026-07-11')).toEqual({ current: 0, activeToday: false });
  });

  it('traverse un changement de mois (DST-safe)', () => {
    expect(computeStreak(days(['2026-02-28', '2026-03-01', '2026-03-02']), '2026-03-02'))
      .toEqual({ current: 3, activeToday: true });
  });
});

describe('activeDayKeys', () => {
  it('un jour est actif si au moins une activité', () => {
    const acts: DayActivity[] = [
      { day: '2026-07-10', strength: true, running: false, nutrition: false },
      { day: '2026-07-11', strength: false, running: false, nutrition: true },
      { day: '2026-07-12', strength: false, running: false, nutrition: false },
    ];
    expect(activeDayKeys(acts)).toEqual(new Set(['2026-07-10', '2026-07-11']));
  });
});
