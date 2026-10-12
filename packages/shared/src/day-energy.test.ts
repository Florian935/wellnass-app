import { describe, expect, it } from 'vitest';
import { dayEnergyTotals, energyItemsByDay, restingMetabolismOn, type EnergyActivity, type EnergyRun, type EnergyWorkout } from './day-energy';
import { computeAge } from './age';
import { estimateActivityEnergy, estimateRunEnergy, estimateStrengthEnergy, restingMetabolism } from './energy';

/** Rattachement **non local** : le jour UTC de l'instant. Prouve que la brique ne lit aucun fuseau. */
const utcDay = (iso: string) => iso.slice(0, 10);
const AT = new Date(Date.UTC(2026, 9, 8, 12));
const PROFILE = { sex: 'male' as const, heightCm: 180, birthDate: '1996-01-15', weightKg: 82 };
const AGE = computeAge(new Date(PROFILE.birthDate), AT);
const resting = (weightKg: number) => restingMetabolism({ sex: 'male', weightKg, heightCm: 180, age: AGE });

const workout = (over: Partial<EnergyWorkout> = {}): EnergyWorkout => ({
  id: 'w1',
  startedAt: '2026-10-08T16:00:00.000Z',
  finishedAt: '2026-10-08T17:00:00.000Z',
  durationSeconds: 3600,
  rpe: 7,
  totalSets: 18,
  ...over,
});
const run = (over: Partial<EnergyRun> = {}): EnergyRun => ({
  id: 'r1',
  finishedAt: '2026-10-08T06:30:00.000Z',
  distanceM: 8000,
  durationSeconds: 2700,
  elevationGainM: 50,
  rpe: 5,
  ...over,
});
const activity = (over: Partial<EnergyActivity> = {}): EnergyActivity => ({
  id: 'a1',
  activityType: 'bike',
  startedAt: '2026-10-08T09:00:00.000Z',
  durationSeconds: 3600,
  intensity: 'moderate',
  rpe: 6,
  distanceM: 25000,
  deviceKcal: null,
  ...over,
});

describe('restingMetabolismOn (US NORYN-02)', () => {
  const weights = [
    { logDate: '2026-10-01', weightKg: 80 },
    { logDate: '2026-10-09', weightKg: 78 },
  ];

  it('pesée la plus récente au plus tard le jour dit', () => {
    expect(restingMetabolismOn({ profile: PROFILE, weightEntries: weights, dayKey: '2026-10-08', at: AT })).toEqual({
      weightKg: 80,
      resting: resting(80),
    });
  });

  it('avant toute pesée : la plus ancienne', () => {
    expect(restingMetabolismOn({ profile: PROFILE, weightEntries: weights, dayKey: '2026-09-01', at: AT }).weightKg).toBe(80);
  });

  it('sans pesée : le profil ; sans profil ni pesée : rien', () => {
    expect(restingMetabolismOn({ profile: PROFILE, weightEntries: [], dayKey: '2026-10-08', at: AT }).weightKg).toBe(82);
    expect(restingMetabolismOn({ profile: null, weightEntries: [], dayKey: '2026-10-08', at: AT })).toEqual({
      weightKg: null,
      resting: null,
    });
  });

  it('l’âge se prend à `at` : la veille et le jour d’un anniversaire diffèrent', () => {
    const born = { ...PROFILE, birthDate: '1996-10-09' };
    const eve = restingMetabolismOn({ profile: born, weightEntries: [], dayKey: '2026-10-08', at: new Date(Date.UTC(2026, 9, 8, 12)) });
    const day = restingMetabolismOn({ profile: born, weightEntries: [], dayKey: '2026-10-08', at: new Date(Date.UTC(2026, 9, 9, 12)) });
    expect(eve.resting?.kcalPerHour).toBeGreaterThan(day.resting?.kcalPerHour as number);
  });

  it('sans date de naissance : MET standard, non personnalisé', () => {
    expect(
      restingMetabolismOn({ profile: { ...PROFILE, birthDate: null }, weightEntries: [], dayKey: '2026-10-08', at: AT }).resting,
    ).toEqual({ kcalPerHour: 82, personalised: false });
  });
});

describe('energyItemsByDay (US NORYN-02)', () => {
  it('rattache chaque source à son jour par `dayKeyOf`, triée par début, au poids de ce jour', () => {
    const weights = [{ logDate: '2026-10-05', weightKg: 79.5 }];
    const byDay = energyItemsByDay({
      profile: PROFILE,
      weightEntries: weights,
      workouts: [workout()],
      finishedRuns: [run()],
      activities: [activity()],
      dayKeyOf: utcDay,
      at: AT,
    });
    const items = byDay.get('2026-10-08') ?? [];
    expect(items.map((i) => [i.id, i.kind, i.activityType, i.startedAt])).toEqual([
      ['r1', 'run', null, '2026-10-08T06:30:00.000Z'],
      ['a1', 'activity', 'bike', '2026-10-08T09:00:00.000Z'],
      ['w1', 'strength', null, '2026-10-08T16:00:00.000Z'],
    ]);
    expect(items[0]?.estimate).toEqual(
      estimateRunEnergy({ distanceM: 8000, durationSeconds: 2700, elevationGainM: 50, rpe: 5, weightKg: 79.5, resting: resting(79.5) }),
    );
    expect(items[1]?.estimate).toEqual(
      estimateActivityEnergy({ activityType: 'bike', intensity: 'moderate', durationSeconds: 3600, distanceM: 25000, deviceKcal: null, resting: resting(79.5) }),
    );
    expect(items[2]?.estimate).toEqual(estimateStrengthEnergy({ durationSeconds: 3600, totalSets: 18, rpe: 7, resting: resting(79.5) }));
  });

  it('une séance appartient au jour de sa fin, une activité au jour de son début', () => {
    const byDay = energyItemsByDay({
      profile: PROFILE,
      weightEntries: [],
      workouts: [workout({ startedAt: '2026-10-07T23:30:00.000Z', finishedAt: '2026-10-08T00:30:00.000Z' })],
      finishedRuns: [],
      activities: [activity({ startedAt: '2026-10-07T23:50:00.000Z' })],
      dayKeyOf: utcDay,
      at: AT,
    });
    expect(byDay.get('2026-10-08')?.map((i) => i.id)).toEqual(['w1']);
    expect(byDay.get('2026-10-07')?.map((i) => i.id)).toEqual(['a1']);
  });

  it('chaque jour garde son poids (repos recalculé une fois par jour)', () => {
    const byDay = energyItemsByDay({
      profile: PROFILE,
      weightEntries: [{ logDate: '2026-09-01', weightKg: 85 }, { logDate: '2026-10-05', weightKg: 79.5 }],
      workouts: [],
      finishedRuns: [run({ id: 'old', finishedAt: '2026-09-10T08:00:00.000Z' }), run(), run({ id: 'r2', finishedAt: '2026-10-08T18:00:00.000Z' })],
      activities: [],
      dayKeyOf: utcDay,
      at: AT,
    });
    expect(byDay.get('2026-09-10')?.[0]?.estimate).toEqual(
      estimateRunEnergy({ distanceM: 8000, durationSeconds: 2700, elevationGainM: 50, rpe: 5, weightKg: 85, resting: resting(85) }),
    );
    expect(byDay.get('2026-10-08')?.map((i) => i.id)).toEqual(['r1', 'r2']);
  });

  it('une estimation impossible n’entre pas', () => {
    const byDay = energyItemsByDay({
      profile: PROFILE,
      weightEntries: [],
      workouts: [workout({ durationSeconds: null, totalSets: 0 })],
      finishedRuns: [run({ distanceM: null, durationSeconds: null })],
      activities: [activity({ durationSeconds: 0 })],
      dayKeyOf: utcDay,
      at: AT,
    });
    expect(byDay.size).toBe(0);
  });

  it('sans poids du tout : rien, sauf les calories d’une montre', () => {
    const byDay = energyItemsByDay({
      profile: null,
      weightEntries: [],
      workouts: [workout()],
      finishedRuns: [run()],
      activities: [activity({ activityType: 'parapente', deviceKcal: 120 })],
      dayKeyOf: utcDay,
      at: AT,
    });
    expect(byDay.get('2026-10-08')?.map((i) => [i.id, i.estimate.kcal])).toEqual([['a1', 120]]);
  });
});

describe('dayEnergyTotals (US NORYN-02)', () => {
  it('total central et bas de fourchette', () => {
    const items = energyItemsByDay({
      profile: PROFILE,
      weightEntries: [],
      workouts: [workout()],
      finishedRuns: [run()],
      activities: [],
      dayKeyOf: utcDay,
      at: AT,
    }).get('2026-10-08') ?? [];
    const totals = dayEnergyTotals(items);
    expect(totals.totalKcal).toBe(items.reduce((s, i) => s + i.estimate.kcal, 0));
    expect(totals.targetKcal).toBe(items.reduce((s, i) => s + i.estimate.low, 0));
  });

  it('une journée vide vaut 0', () => {
    expect(dayEnergyTotals([])).toEqual({ totalKcal: 0, targetKcal: 0 });
  });
});
