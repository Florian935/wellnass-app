import { describe, expect, it } from 'vitest';
import { composeReadiness, windowStartKey } from './readiness';
import { activityLoadSessions } from './training-time';
import { localDayKey, localDayKeyOf } from './date';

/** Rattachement **non local** : le jour UTC de l'instant (la brique ne lit aucun fuseau). */
const utcDay = (iso: string) => iso.slice(0, 10);
const TODAY = '2026-10-08';
const day = (offset: number) => {
  const d = new Date(Date.UTC(2026, 9, 8 + offset));
  return d.toISOString().slice(0, 10);
};
/** Une heure à RPE 5 (charge 300), finie à midi UTC du jour `offset`. */
const session = (offset: number) => ({ rpe: 5, durationSeconds: 3600, finishedAt: `${day(offset)}T12:00:00.000Z` });
const logged = (offsets: number[], kcal: number) => offsets.map((o) => ({ logDate: day(o), kcal }));

const base = {
  todayKey: TODAY,
  activePillars: ['strength', 'running', 'nutrition'] as const,
  wellbeingPillarEnabled: false,
  workouts: [],
  completedRuns: [],
  activities: [],
  dailyKcal: [],
  baseTargetKcal: 2000,
  wellbeingRows: [],
  dayKeyOf: utcDay,
};
const states = (input: Partial<Parameters<typeof composeReadiness>[0]>) => {
  const r = composeReadiness({ ...base, ...input });
  return { verdict: r.verdict, load: r.load.state, nutrition: r.nutrition.state, wellbeing: r.wellbeing.state };
};

describe('windowStartKey (US NORYN-02)', () => {
  it('fenêtre incluant aujourd’hui : 7 j → J−6, 28 j → J−27, 3 j → J−2', () => {
    expect(windowStartKey(TODAY, 7)).toBe('2026-10-02');
    expect(windowStartKey(TODAY, 28)).toBe('2026-09-11');
    expect(windowStartKey(TODAY, 3)).toBe('2026-10-06');
  });

  it('traverse un changement d’heure sans perdre de jour', () => {
    expect(windowStartKey('2026-10-26', 7)).toBe('2026-10-20');
    expect(windowStartKey('2026-03-30', 3)).toBe('2026-03-28');
  });
});

describe('localDayKeyOf / activityLoadSessions', () => {
  it('le jour local d’un instant', () => {
    const instant = new Date(2026, 9, 8, 23, 30).toISOString();
    expect(localDayKeyOf(instant)).toBe(localDayKey(new Date(instant)));
  });

  it('une activité devient une séance de charge, fin reconstruite', () => {
    expect(activityLoadSessions([{ rpe: 6, durationSeconds: 5400, startedAt: '2026-10-08T09:00:00.000Z' }])).toEqual([
      { rpe: 6, durationSeconds: 5400, finishedAt: '2026-10-08T10:30:00.000Z' },
    ]);
  });
});

describe('composeReadiness — rien à évaluer', () => {
  it('aucune composante : pas de verdict', () => {
    expect(composeReadiness({ ...base, activePillars: undefined })).toMatchObject({ show: false, verdict: null, availableCount: 0 });
  });
});

describe('composeReadiness — charge', () => {
  it('fenêtre chronique J−27 incluse, J−28 exclue', () => {
    expect(states({ workouts: [session(-28)] }).load).toBe('unavailable');
    expect(states({ workouts: [session(-27)] })).toMatchObject({ load: 'positive', verdict: 'push' });
  });

  it('fenêtre aiguë J−6 incluse, J−7 exclue', () => {
    expect(states({ workouts: [session(-27), session(-6)] })).toMatchObject({ load: 'negative', verdict: 'rest' });
    expect(states({ workouts: [session(-27), session(-7)] }).load).toBe('positive');
  });

  it('sans borne haute : une séance « demain » compte', () => {
    expect(states({ workouts: [session(-27), session(1)] }).load).toBe('negative');
  });

  it('piliers éteints : séances et courses ignorées ; les activités, jamais', () => {
    expect(states({ activePillars: ['nutrition'], workouts: [session(-27)], completedRuns: [session(-27)] }).load).toBe('unavailable');
    expect(states({ activePillars: ['running'], completedRuns: [session(-27)] }).load).toBe('positive');
    expect(
      states({ activePillars: [], activities: [{ rpe: 5, durationSeconds: 3600, startedAt: `${day(-28)}T23:30:00.000Z` }] }).load,
    ).toBe('positive');
  });

  it('une séance sans fin ne pèse pas', () => {
    expect(states({ workouts: [{ rpe: 5, durationSeconds: 3600, finishedAt: null }] }).load).toBe('unavailable');
  });
});

describe('composeReadiness — nutrition', () => {
  it('moins de 4 jours notés depuis J−6 : indisponible (J−7 ne compte pas)', () => {
    expect(states({ dailyKcal: logged([-7, -2, -1, 0], 1600) }).nutrition).toBe('unavailable');
  });

  it('4 jours à 20 % sous la cible de base : `rest` ; à 10 % : `ok`', () => {
    expect(states({ dailyKcal: logged([-6, -3, -1, 0], 1600) })).toMatchObject({ nutrition: 'negative', verdict: 'rest' });
    expect(states({ dailyKcal: logged([-6, -3, -1, 0], 1800) })).toMatchObject({ nutrition: 'neutral', verdict: 'ok' });
  });

  it('un jour noté à l’avance compte (pas de borne haute)', () => {
    expect(states({ dailyKcal: logged([-2, -1, 0, 1], 1600) }).nutrition).toBe('negative');
  });

  it('pilier Nutrition éteint, ou pas de cible de base : indisponible', () => {
    expect(states({ activePillars: ['strength'], dailyKcal: logged([-6, -3, -1, 0], 1600) }).nutrition).toBe('unavailable');
    expect(states({ baseTargetKcal: null, dailyKcal: logged([-6, -3, -1, 0], 1600) }).nutrition).toBe('unavailable');
  });
});

describe('composeReadiness — bien-être', () => {
  it('3 jours du calendrier, lignes supprimées écartées', () => {
    expect(
      states({
        wellbeingRows: [
          { logDate: day(-3), energy: 1, stress: 5 },
          { logDate: day(-2), energy: 5, stress: 1 },
          { logDate: day(-1), energy: 1, stress: 5, deletedAt: '2026-10-07T20:00:00.000Z' },
        ],
      }),
    ).toMatchObject({ wellbeing: 'positive', verdict: 'push' });
  });

  it('« malade » ce matin : `rest` pilier allumé, ignoré pilier éteint', () => {
    const rows = [{ logDate: TODAY, energy: 5, stress: 1, sick: true }];
    expect(states({ wellbeingPillarEnabled: true, wellbeingRows: rows }).verdict).toBe('rest');
    expect(states({ wellbeingPillarEnabled: false, wellbeingRows: rows }).verdict).toBe('push');
  });

  it('nuit courte ce matin, pilier allumé : `rest` ; ligne d’aujourd’hui supprimée : ignorée', () => {
    expect(states({ wellbeingPillarEnabled: true, wellbeingRows: [{ logDate: TODAY, energy: 5, stress: 1, sleepMinutes: 300 }] }).verdict).toBe('rest');
    expect(
      states({
        wellbeingPillarEnabled: true,
        wellbeingRows: [
          { logDate: TODAY, sleepMinutes: 300, deletedAt: '2026-10-08T09:00:00.000Z' },
          { logDate: day(-1), energy: 5, stress: 1 },
        ],
      }).verdict,
    ).toBe('push');
  });

  it('pilier allumé sans check-in : indisponible', () => {
    expect(states({ wellbeingPillarEnabled: true }).wellbeing).toBe('unavailable');
  });
});
