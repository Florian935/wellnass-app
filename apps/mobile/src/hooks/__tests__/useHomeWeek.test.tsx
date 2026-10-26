/**
 * La semaine de l'accueil (`useHomeWeek`, US ACCUEIL-08) — la bande « Ta semaine » et les séances
 * du cadran Bouger, collectées une fois.
 *
 * Reprend les règles que `useWeekRings` (supprimé avec les anneaux) faisait tenir à la semaine :
 *  - **la semaine se compte en jour LOCAL**, du lundi au dimanche ;
 *  - une séance **jamais terminée** ne compte pas ;
 *  - une séance d'une **autre semaine** non plus ;
 *  - un pilier **désactivé** n'a pas de marque (décision H).
 * Et deux règles neuves, propres au cadran Bouger :
 *  - une séance prévue **faite** ne se compte qu'une fois, même quand une séance terminée tombe le
 *    même jour ; une séance faite **hors plan** compte aussi ;
 *  - une séance **sautée** n'est plus prévue.
 */
import { renderHook } from '@testing-library/react-native';
import { useHomeWeek } from '../useHomeWeek';
import { useDailyCalorieTargets } from '@/data/repositories/dashboard-repository';
import { useWeekPlan } from '@/data/repositories/planned-session-repository';
import { useRealLifeState } from '@/data/repositories/real-life-repository';
import { useRunHistory } from '@/data/repositories/run-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { useWorkoutHistory } from '@/data/repositories/workout-repository';

jest.mock('../useTodayKey', () => ({ useTodayKey: jest.fn(() => '2026-09-16') })); // mercredi
jest.mock('@/data/repositories/dashboard-repository', () => ({ useDailyCalorieTargets: jest.fn() }));
jest.mock('@/data/repositories/planned-session-repository', () => ({ useWeekPlan: jest.fn() }));
jest.mock('@/data/repositories/real-life-repository', () => ({ useRealLifeState: jest.fn() }));
jest.mock('@/data/repositories/run-repository', () => ({ useRunHistory: jest.fn() }));
jest.mock('@/data/repositories/settings-repository', () => ({ useSettings: jest.fn() }));
jest.mock('@/data/repositories/workout-repository', () => ({ useWorkoutHistory: jest.fn() }));

const m = {
  targets: useDailyCalorieTargets as jest.Mock,
  plan: useWeekPlan as jest.Mock,
  realLife: useRealLifeState as jest.Mock,
  runs: useRunHistory as jest.Mock,
  settings: useSettings as jest.Mock,
  workouts: useWorkoutHistory as jest.Mock,
};

/** Une heure LOCALE de la semaine du 14/09/2026, en ISO (UTC) comme la base la stocke. */
const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute).toISOString();

const plan = (scheduledDate: string, pillar: 'strength' | 'running', status = 'planned') => ({
  scheduledDate,
  pillar,
  status,
});

beforeEach(() => {
  jest.clearAllMocks();
  m.targets.mockReturnValue({ days: [], marginPct: 10 });
  m.plan.mockReturnValue({ items: [] });
  m.realLife.mockReturnValue({ pausedDays: new Set<string>() });
  m.runs.mockReturnValue({ runs: [] });
  m.settings.mockReturnValue({ settings: { activePillars: ['strength', 'running', 'nutrition'] } });
  m.workouts.mockReturnValue({ workouts: [] });
});

const weekOf = async () => (await renderHook(() => useHomeWeek())).result.current;
const day = (strip: Awaited<ReturnType<typeof weekOf>>['strip'], key: string) => strip.days.find((d) => d.key === key)!;

it('lit le plan et les jours notés de la semaine du LUNDI au dimanche', async () => {
  const { strip } = await weekOf();
  expect(m.plan).toHaveBeenCalledWith('2026-09-14');
  expect(m.targets).toHaveBeenCalledWith('2026-09-14', '2026-09-20');
  expect(strip.days.map((d) => d.key)).toEqual([
    '2026-09-14',
    '2026-09-15',
    '2026-09-16',
    '2026-09-17',
    '2026-09-18',
    '2026-09-19',
    '2026-09-20',
  ]);
  expect(day(strip, '2026-09-16').isToday).toBe(true);
});

it('🔴 une séance de 23 h 30 compte pour SON jour local, pas pour le lendemain', async () => {
  m.workouts.mockReturnValue({ workouts: [{ finishedAt: at(15, 23, 30) }] });
  const { strip } = await weekOf();
  expect(day(strip, '2026-09-15').marks.strength).toBe('done');
  expect(day(strip, '2026-09-16').marks.strength).not.toBe('done');
});

it('🔴 une séance d’une autre semaine, ou jamais terminée, ne compte pas', async () => {
  m.workouts.mockReturnValue({ workouts: [{ finishedAt: at(7, 18) }, { finishedAt: null }, { finishedAt: 'n/a' }] });
  const { strip, weekSessions } = await weekOf();
  expect(strip.days.every((d) => d.marks.strength !== 'done')).toBe(true);
  expect(weekSessions).toEqual([]);
});

it('🔴 un pilier désactivé n’a pas de marque (décision H)', async () => {
  m.settings.mockReturnValue({ settings: { activePillars: ['nutrition'] } });
  m.runs.mockReturnValue({ runs: [{ finishedAt: at(15, 8) }] });
  const { strip } = await weekOf();
  expect(day(strip, '2026-09-15').marks.running).toBeUndefined();
  expect(day(strip, '2026-09-15').marks.strength).toBeUndefined();
});

describe('le cadran Bouger', () => {
  it('chaque séance prévue, faite ou non, dans l’ordre du plan', async () => {
    m.plan.mockReturnValue({ items: [plan('2026-09-14', 'strength'), plan('2026-09-17', 'strength')] });
    m.workouts.mockReturnValue({ workouts: [{ finishedAt: at(14, 18) }] });
    const { weekSessions } = await weekOf();
    expect(weekSessions).toEqual([
      { pillar: 'strength', dayKey: '2026-09-14', done: true },
      { pillar: 'strength', dayKey: '2026-09-17', done: false },
    ]);
  });

  it('🔴 une séance prévue marquée faite ET terminée le même jour ne compte qu’UNE fois', async () => {
    m.plan.mockReturnValue({ items: [plan('2026-09-14', 'strength', 'done')] });
    m.workouts.mockReturnValue({ workouts: [{ finishedAt: at(14, 18) }] });
    const { weekSessions } = await weekOf();
    expect(weekSessions).toHaveLength(1);
  });

  it('une sortie faite HORS plan compte aussi', async () => {
    m.plan.mockReturnValue({ items: [plan('2026-09-14', 'strength')] });
    m.runs.mockReturnValue({ runs: [{ finishedAt: at(15, 8) }] });
    const { weekSessions } = await weekOf();
    expect(weekSessions).toContainEqual({ pillar: 'running', dayKey: '2026-09-15', done: true });
    expect(weekSessions).toHaveLength(2);
  });

  it('🔴 pas de segment pour un pilier désactivé : une course gardée de l’an dernier ne colore pas Bouger', async () => {
    m.settings.mockReturnValue({ settings: { activePillars: ['strength'] } });
    m.plan.mockReturnValue({ items: [plan('2026-09-14', 'strength'), plan('2026-09-15', 'running')] });
    m.runs.mockReturnValue({ runs: [{ finishedAt: at(15, 8) }] });
    const { weekSessions } = await weekOf();
    expect(weekSessions).toEqual([{ pillar: 'strength', dayKey: '2026-09-14', done: false }]);
  });

  it('🔴 une séance sautée n’est plus prévue', async () => {
    m.plan.mockReturnValue({ items: [plan('2026-09-14', 'strength', 'skipped'), plan('2026-09-18', 'running')] });
    const { weekSessions } = await weekOf();
    expect(weekSessions).toEqual([{ pillar: 'running', dayKey: '2026-09-18', done: false }]);
  });
});
