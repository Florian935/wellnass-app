import { describe, expect, it } from 'vitest';
import { norynWeekSchema } from './contract';
import { NOW, OWNER, emptySnapshot, uid } from './noryn.testkit';
import type { OwnerSnapshot } from './snapshot';
import { buildNorynWeek } from './week';

const START = '2026-10-05';
const build = (snapshot: OwnerSnapshot, start = START, now = NOW) => {
  const week = buildNorynWeek(snapshot, { start, now });
  // Toute sortie passe le contrat.
  expect(norynWeekSchema.safeParse(week).success).toBe(true);
  return week;
};

const steps = (log_date: string, n: number) => ({ user_id: OWNER, log_date, steps: n });
const night = (log_date: string, sleep_minutes: number | null) => ({
  user_id: OWNER,
  log_date,
  sleep_minutes,
  sleep_quality: null,
  energy: null,
  motivation: null,
  sick: false,
});
const finished = (finished_at: string | null) => ({ user_id: OWNER, finished_at });
const planned = (n: number, scheduled_date: string) => ({
  owner_id: OWNER,
  id: uid(n),
  scheduled_date,
  scheduled_time: '07:00:00',
  status: 'planned',
  session_id: 's1',
  program_id: 'p1',
});
const runContent = {
  sessions: [
    {
      owner_id: null,
      id: 's1',
      session_type: 'sortie_longue',
      order_index: 0,
      target_duration_seconds: 5400,
      target_distance_m: null,
    },
  ],
  programs: [{ owner_id: null, id: 'p1', pillar: 'running', status: 'published' }],
};

describe('buildNorynWeek — une semaine', () => {
  it('rend les pas jour par jour, le sommeil, les séances et ce qui est fait', () => {
    const week = build(
      emptySnapshot({
        steps: [steps('2026-10-05', 9120), steps('2026-10-06', 7410), steps('2026-10-08', 6400), steps('2026-10-12', 99)],
        wellbeing: [night('2026-10-05', 420), night('2026-10-06', 401), night('2026-10-07', null), night('2026-10-04', 600)],
        planned: [planned(1, '2026-10-06'), planned(2, '2026-10-10'), planned(3, '2026-10-12')],
        ...runContent,
        workouts: [finished('2026-10-05T17:00:00Z'), finished('2026-10-07T17:00:00Z')],
        runs: [finished('2026-10-06T05:30:00Z')],
      }),
    );
    expect(week).toEqual({
      start: START,
      generated_at: '2026-10-08T12:00:00.000Z',
      synced_at: '2026-10-08T09:00:00.123Z',
      steps: {
        daily_target: 10_000,
        days: [
          { date: '2026-10-05', count: 9120 },
          { date: '2026-10-06', count: 7410 },
          { date: '2026-10-07', count: null },
          { date: '2026-10-08', count: 6400 },
          { date: '2026-10-09', count: null },
          { date: '2026-10-10', count: null },
          { date: '2026-10-11', count: null },
        ],
      },
      sleep: { average_minutes: 411, nights: 2 },
      training: {
        sessions: [
          {
            id: uid(1),
            date: '2026-10-06',
            start_time: '07:00',
            kind: 'running',
            intensity: 'moderate',
            estimated_minutes: 90,
            status: 'planned',
            tags: ['long_run'],
          },
          {
            id: uid(2),
            date: '2026-10-10',
            start_time: '07:00',
            kind: 'running',
            intensity: 'moderate',
            estimated_minutes: 90,
            status: 'planned',
            tags: ['long_run'],
          },
        ],
        done: { strength: 2, running: 1 },
      },
    });
  });

  it('sans nuit renseignée : zéro nuit, moyenne null', () => {
    expect(build(emptySnapshot()).sleep).toEqual({ average_minutes: null, nights: 0 });
  });

  it('une nuit hors bornes ne compte pas', () => {
    expect(build(emptySnapshot({ wellbeing: [night('2026-10-05', 900), night('2026-10-06', 480)] })).sleep).toEqual({
      average_minutes: 480,
      nights: 1,
    });
  });
});

describe('buildNorynWeek — séances faites, jour à Paris', () => {
  it('lundi 26/10/2026 00 h 30 à Paris (dimanche 23 h 30 UTC) compte pour la semaine du 26/10', () => {
    const snapshot = emptySnapshot({ runs: [finished('2026-10-25T23:30:00Z')] });
    const now = new Date('2026-10-27T10:00:00Z');
    expect(build(snapshot, '2026-10-26', now).training.done.running).toBe(1);
    expect(build(snapshot, '2026-10-19', now).training.done.running).toBe(0);
  });

  it('lundi 30/03/2026 00 h 30 à Paris, heure d’été (dimanche 22 h 30 UTC) compte pour la semaine du 30/03', () => {
    const snapshot = emptySnapshot({ workouts: [finished('2026-03-29T22:30:00Z')] });
    const now = new Date('2026-03-31T10:00:00Z');
    expect(build(snapshot, '2026-03-30', now).training.done.strength).toBe(1);
    expect(build(snapshot, '2026-03-23', now).training.done.strength).toBe(0);
  });

  it('ignore une séance sans fin, plafonne à 50', () => {
    const many = Array.from({ length: 60 }, () => finished('2026-10-06T10:00:00Z'));
    const week = build(emptySnapshot({ workouts: [...many, finished(null)] }));
    expect(week.training.done.strength).toBe(50);
  });
});

describe('buildNorynWeek — les trois null', () => {
  it('Health Connect éteint → steps null ; sommeil toujours suivi', () => {
    const settings = { ...emptySnapshot().settings!, health_connect_enabled: false };
    const week = build(emptySnapshot({ settings }));
    expect(week.steps).toBeNull();
    expect(week.sleep).not.toBeNull();
  });

  it('jamais synchronisé : aucun pas, aucune nuit, aucune séance, rien de fait', () => {
    const week = build(
      emptySnapshot({
        receivedAt: null,
        steps: [steps('2026-10-05', 9120)],
        wellbeing: [night('2026-10-05', 420)],
        planned: [planned(1, '2026-10-06')],
        ...runContent,
        workouts: [finished('2026-10-05T17:00:00Z')],
        runs: [finished('2026-10-06T05:30:00Z')],
      }),
    );
    expect(week.synced_at).toBeNull();
    expect(week.steps?.days.every((d) => d.count === null)).toBe(true);
    expect(week.steps?.daily_target).toBe(10_000);
    expect(week.sleep).toEqual({ average_minutes: null, nights: 0 });
    expect(week.training).toEqual({ sessions: [], done: { strength: 0, running: 0 } });
  });
});
