import { addDays, localDayKey, startOfWeek } from './date';

export interface StatRun {
  finishedAtDayKey: string; // AAAA-MM-JJ (jour local de fin)
  distanceM: number | null;
  durationS: number | null;
  paceSPerKm: number | null;
}
export type StatPeriod = 'week' | 'month' | 'all';
export interface RunStats { totalDistanceM: number; totalDurationS: number; count: number; }
export interface PaceTrendPoint { dayKey: string; paceSPerKm: number; }
export type PaceTrendKind = 'improving' | 'declining' | 'stable';

function periodStartKey(period: StatPeriod, todayKey: string): string | null {
  if (period === 'all') return null;
  const [y, m, d] = todayKey.split('-').map(Number);
  const today = new Date(y!, m! - 1, d!);
  if (period === 'week') return localDayKey(startOfWeek(today));
  return `${todayKey.slice(0, 7)}-01`;
}

export function aggregateRunStats(runs: StatRun[], period: StatPeriod, todayKey: string): RunStats {
  const from = periodStartKey(period, todayKey);
  const inPeriod = (k: string): boolean => {
    if (period === 'all') return true;
    if (period === 'month') return k.slice(0, 7) === todayKey.slice(0, 7);
    const monday = from!;
    const [y, m, d] = monday.split('-').map(Number);
    const sunday = localDayKey(addDays(new Date(y!, m! - 1, d!), 6));
    return k >= monday && k <= sunday;
  };
  let totalDistanceM = 0, totalDurationS = 0, count = 0;
  for (const r of runs) {
    if (!inPeriod(r.finishedAtDayKey)) continue;
    totalDistanceM += r.distanceM ?? 0;
    totalDurationS += r.durationS ?? 0;
    count += 1;
  }
  return { totalDistanceM, totalDurationS, count };
}

export function paceTrendPoints(runs: StatRun[], days: number, todayKey: string): PaceTrendPoint[] {
  const [y, m, d] = todayKey.split('-').map(Number);
  const fromKey = localDayKey(addDays(new Date(y!, m! - 1, d!), -(days - 1)));
  return runs
    .filter((r) => r.paceSPerKm != null && r.finishedAtDayKey >= fromKey && r.finishedAtDayKey <= todayKey)
    .map((r) => ({ dayKey: r.finishedAtDayKey, paceSPerKm: r.paceSPerKm as number }))
    .sort((a, b) => (a.dayKey < b.dayKey ? -1 : a.dayKey > b.dayKey ? 1 : 0));
}

export function paceTrend(points: PaceTrendPoint[]): PaceTrendKind {
  if (points.length < 2) return 'stable';
  const n = points.length;
  const firstHalf = points.slice(0, Math.floor(n / 2));
  const secondHalf = points.slice(Math.ceil(n / 2));
  const avg = (xs: PaceTrendPoint[]) => xs.reduce((s, p) => s + p.paceSPerKm, 0) / xs.length;
  const m1 = avg(firstHalf), m2 = avg(secondHalf);
  const ratio = (m2 - m1) / m1;
  if (ratio < -0.02) return 'improving';
  if (ratio > 0.02) return 'declining';
  return 'stable';
}

export function formatDurationHms(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || totalSeconds < 0) return '';
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  return h > 0 ? `${h} h ${m} min ${s} s` : `${m} min ${s} s`;
}
