import { describe, expect, it } from 'vitest';
import { buildWeeklyStory } from './weekly-story';
import type { WeeklyReview } from './weekly-review';

const review = (over: Partial<WeeklyReview> = {}): WeeklyReview => ({
  period: { start: '2026-09-07', end: '2026-09-13' },
  current: {
    workouts: 3,
    tonnageKg: 18400,
    runs: 2,
    distanceM: 16600,
    loggedDays: 6,
    daysInTarget: 5,
    activeDays: 6,
  },
  previous: null,
  recordsBeaten: 1,
  changes: {
    tonnage: { pct: 12, direction: 'up' },
    distance: { pct: -5, direction: 'down' },
    activeDays: { pct: 20, direction: 'up' },
    loggedDays: null,
  },
  isEmpty: false,
  decision: { kind: 'goal_behind', metrics: { gap: 12 }, subject: '10 km' },
  realLifeDays: 0,
  ...over,
});

describe('buildWeeklyStory (US DASH-01, bilan en cartes — BILAN-01)', () => {
  it('semaine vide → aucune carte (pas de bilan creux)', () => {
    expect(buildWeeklyStory(review({ isEmpty: true }))).toEqual([]);
  });

  it('semaine pleine → cinq cartes, dans l’ordre du récit', () => {
    expect(buildWeeklyStory(review()).map((c) => c.kind)).toEqual([
      'volume',
      'records',
      'regularity',
      'nutrition',
      'decision',
    ]);
  });

  it('la carte volume porte les chiffres bruts et l’évolution du tonnage si la muscu a tourné', () => {
    const [volume] = buildWeeklyStory(review());
    expect(volume).toEqual({
      kind: 'volume',
      workouts: 3,
      runs: 2,
      tonnageKg: 18400,
      distanceM: 16600,
      change: { pct: 12, direction: 'up' },
    });
  });

  it('sans muscu, l’évolution portée est celle de la distance', () => {
    const [volume] = buildWeeklyStory(
      review({ current: { ...review().current, workouts: 0, tonnageKg: 0 } }),
    );
    expect(volume).toMatchObject({ kind: 'volume', change: { pct: -5, direction: 'down' } });
  });

  it('aucun record battu → pas de carte record', () => {
    expect(buildWeeklyStory(review({ recordsBeaten: 0 })).map((c) => c.kind)).not.toContain('records');
  });

  it('aucun entraînement ni sortie → pas de carte volume', () => {
    const cards = buildWeeklyStory(
      review({ current: { ...review().current, workouts: 0, runs: 0, tonnageKg: 0, distanceM: 0 } }),
    );
    expect(cards.map((c) => c.kind)).not.toContain('volume');
  });

  it('nutrition non suivie (daysInTarget null) → pas de carte nutrition', () => {
    const cards = buildWeeklyStory(review({ current: { ...review().current, daysInTarget: null } }));
    expect(cards.map((c) => c.kind)).not.toContain('nutrition');
  });

  it('pas de décision du moteur → pas de carte « la suite »', () => {
    expect(buildWeeklyStory(review({ decision: null })).map((c) => c.kind)).not.toContain('decision');
  });

  it('la régularité porte les jours actifs sur 7', () => {
    const regularity = buildWeeklyStory(review()).find((c) => c.kind === 'regularity');
    expect(regularity).toEqual({ kind: 'regularity', activeDays: 6, change: { pct: 20, direction: 'up' } });
  });
});
