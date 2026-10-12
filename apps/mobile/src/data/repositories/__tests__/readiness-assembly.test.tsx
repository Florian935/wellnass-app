/**
 * US NORYN-02 — le **filet** de l'assemblage du verdict de forme (`useReadiness`, TRI-03 + BIEN-04).
 *
 * Écrit et vert **avant** que la composition ne sorte vers `@wellness/shared` (la fonction
 * `noryn-context` l'appellera aussi) : il doit rester vert **sans une ligne modifiée** après.
 *
 * Ce qui est figé, c'est ce que les composantes **voient** : les bornes des fenêtres (charge J−6 et
 * J−27, nutrition J−6 sans borne haute, bien-être J−2), les piliers qui filtrent, la cible **de base**
 * (jamais l'effective) et ce que le pilier Bien-être ajoute (« malade », nuit courte).
 */

import { renderHook } from '@testing-library/react-native';

import { useReadiness } from '../dashboard-repository';
import { FROZEN_CLOCK, TODAY, atLocal, setSources, shiftKey, type Sources } from '@/test-utils/day-target-sources';

jest.mock('@/data/repositories/nutrition-repository', () => ({ useNutritionProfile: jest.fn() }));
jest.mock('@/data/repositories/profile-repository', () => ({ useProfile: jest.fn() }));
jest.mock('@/data/repositories/bodyweight-repository', () => ({ useLatestWeight: jest.fn(), useWeightEntries: jest.fn() }));
jest.mock('@/data/repositories/settings-repository', () => ({ useSettings: jest.fn() }));
jest.mock('@/data/repositories/workout-repository', () => ({
  useWorkoutHistory: jest.fn(),
  useActiveWorkout: jest.fn(() => ({ workout: null, isLoading: false })),
}));
jest.mock('@/data/repositories/run-repository', () => ({
  useRunHistory: jest.fn(),
  useRunStats: jest.fn(() => ({ stats: null, isLoading: false })),
}));
jest.mock('@/data/repositories/activity-repository', () => ({ useActivities: jest.fn(), useActivitiesOnDay: jest.fn() }));
jest.mock('@/data/repositories/planned-session-repository', () => ({ useHasPlannedSession: jest.fn() }));
jest.mock('@/data/repositories/real-life-repository', () => ({
  useRealLifePeriods: jest.fn(),
  useRealLifeState: jest.fn(() => ({ inRealLifePeriod: false, isLoading: false })),
  SELECT_WEEK_STRENGTH_SESSIONS: 'select-week-strength-sessions',
}));
jest.mock('@/data/repositories/energy-repository', () => ({ useDayEnergy: jest.fn(), useEnergyTargetByDay: jest.fn() }));
jest.mock('@/data/repositories/journal-repository', () => ({ useDailyTotals: jest.fn() }));
jest.mock('@/data/repositories/daily-wellbeing-repository', () => ({ useWellbeingRows: jest.fn() }));

const day = (offset: number) => shiftKey(TODAY, offset);
/** Une séance d'une heure à RPE 5 (charge 300), finie à midi local du jour `offset`. */
const session = (offset: number) => ({ finishedAt: atLocal(day(offset), 12), durationSeconds: 3600, rpe: 5 });
const logged = (offsets: number[], kcal: number) => offsets.map((o) => ({ logDate: day(o), kcal }));

const readiness = async (sources: Sources = {}) => {
  setSources(sources);
  const { result } = await renderHook(() => useReadiness());
  const r = result.current;
  return {
    show: r.show,
    verdict: r.verdict,
    load: r.load.state,
    nutrition: r.nutrition.state,
    wellbeing: r.wellbeing.state,
  };
};

beforeEach(() => jest.useFakeTimers(FROZEN_CLOCK));
afterEach(() => jest.useRealTimers());

describe('aucune composante évaluable', () => {
  it('rien du tout : pas de verdict', async () => {
    setSources();
    const { result } = await renderHook(() => useReadiness());
    expect(result.current).toEqual({
      show: false,
      verdict: null,
      load: { state: 'unavailable', reason: 'insufficient-history' },
      nutrition: { state: 'unavailable', reason: 'insufficient-logged-days' },
      wellbeing: { state: 'unavailable', reason: 'no-recent-checkin' },
      negativeCount: 0,
      availableCount: 0,
    });
  });
});

describe('charge — fenêtres J−6 et J−27, piliers actifs, autres activités', () => {
  it('une séance à J−28 : hors fenêtre chronique', async () => {
    expect((await readiness({ workouts: [session(-28)] })).load).toBe('unavailable');
  });

  it('une séance à J−27 seule : charge basse → `push`', async () => {
    expect(await readiness({ workouts: [session(-27)] })).toMatchObject({ load: 'positive', verdict: 'push', show: true });
  });

  it('J−27 et J−6 : ratio 2 → `rest`', async () => {
    expect(await readiness({ workouts: [session(-27), session(-6)] })).toMatchObject({ load: 'negative', verdict: 'rest' });
  });

  it('J−27 et J−7 : la séance de J−7 est hors fenêtre aiguë', async () => {
    expect((await readiness({ workouts: [session(-27), session(-7)] })).load).toBe('positive');
  });

  it('pilier muscu éteint : ses séances ne pèsent pas', async () => {
    expect(
      (await readiness({ activePillars: ['running', 'nutrition'], workouts: [session(-27), session(-6)] })).load,
    ).toBe('unavailable');
  });

  it('pilier course éteint : ses courses ne pèsent pas', async () => {
    expect((await readiness({ activePillars: ['strength', 'nutrition'], runs: [session(-27)] })).load).toBe('unavailable');
  });

  it('une autre activité pèse quels que soient les piliers, à sa fin reconstruite (début + durée)', async () => {
    // Commencée à J−28 à 23 h 30, une heure : finie à J−27 à 00 h 30 → dans la fenêtre chronique.
    const late = { startedAt: atLocal(day(-28), 23, 30), durationSeconds: 3600, rpe: 5 };
    expect((await readiness({ activePillars: [], activities: [late] })).load).toBe('positive');
    const early = { ...late, startedAt: atLocal(day(-28), 22, 0) };
    expect((await readiness({ activePillars: [], activities: [early] })).load).toBe('unavailable');
  });
});

describe('nutrition — 7 jours, cible de base, pilier actif', () => {
  const manual = { manualCalories: 2000 };

  it('3 jours notés : indisponible', async () => {
    expect((await readiness({ nutrition: manual, dailyKcal: logged([-2, -1, 0], 1500) })).nutrition).toBe('unavailable');
  });

  it('4 jours à 20 % sous la cible : `rest`', async () => {
    expect(await readiness({ nutrition: manual, dailyKcal: logged([-6, -3, -1, 0], 1600) })).toMatchObject({
      nutrition: 'negative',
      verdict: 'rest',
    });
  });

  it('4 jours à 10 % sous la cible : neutre, `ok`', async () => {
    expect(await readiness({ nutrition: manual, dailyKcal: logged([-6, -3, -1, 0], 1800) })).toMatchObject({
      nutrition: 'neutral',
      verdict: 'ok',
    });
  });

  it('J−7 ne compte pas ; un jour noté à l’avance (J+1) compte', async () => {
    expect((await readiness({ nutrition: manual, dailyKcal: logged([-7, -2, -1, 0], 1600) })).nutrition).toBe('unavailable');
    expect((await readiness({ nutrition: manual, dailyKcal: logged([-2, -1, 0, 1], 1600) })).nutrition).toBe('negative');
  });

  it('pilier Nutrition éteint : indisponible', async () => {
    expect(
      (await readiness({ activePillars: ['strength', 'running'], nutrition: manual, dailyKcal: logged([-6, -3, -1, 0], 1600) })).nutrition,
    ).toBe('unavailable');
  });

  it('contre la cible de **base**, pas l’effective : séance prévue aujourd’hui (forfait), 2 100 kcal', async () => {
    // Base 2 359 → 11 % sous la cible (neutre) ; l'effective 2 659 aurait donné 21 % (négatif).
    expect(
      (await readiness({ plannedDays: [TODAY], dailyKcal: logged([-6, -3, -1, 0], 2100) })).nutrition,
    ).toBe('neutral');
  });

  it('mode `activities` : base hors sport (2 048), sans la dépense du jour', async () => {
    // 1 800 : 12 % sous 2 048 (neutre) ; sous l'effective 2 648, ce serait 32 % (négatif).
    expect(
      (
        await readiness({
          nutrition: { trainingBonusMode: 'activities' },
          energyByDay: { [TODAY]: 600 },
          dailyKcal: logged([-6, -3, -1, 0], 1800),
        })
      ).nutrition,
    ).toBe('neutral');
  });
});

describe('bien-être — 3 jours du calendrier, énergie et stress ; nuit et « malade » pilier allumé', () => {
  it('J−2 compte, J−3 non, une ligne supprimée non plus', async () => {
    expect(
      await readiness({
        wellbeing: [
          { logDate: day(-3), energy: 1, stress: 5 },
          { logDate: day(-2), energy: 5, stress: 1 },
          { logDate: day(-1), energy: 1, stress: 5, deletedAt: '2026-10-07T20:00:00.000Z' },
        ],
      }),
    ).toMatchObject({ wellbeing: 'positive', verdict: 'push' });
  });

  it('énergie moyenne basse : `rest`', async () => {
    expect(
      (await readiness({ wellbeing: [{ logDate: day(-1), energy: 2, stress: 3 }, { logDate: day(0), energy: 2, stress: 3 }] })).verdict,
    ).toBe('rest');
  });

  it('« malade » ce matin : `rest` pilier Bien-être allumé, ignoré pilier éteint', async () => {
    const wellbeing = [{ logDate: TODAY, energy: 5, stress: 1, sick: true }];
    expect((await readiness({ wellbeingPillarEnabled: true, wellbeing })).verdict).toBe('rest');
    expect((await readiness({ wellbeingPillarEnabled: false, wellbeing })).verdict).toBe('push');
  });

  it('nuit courte ce matin (5 h), pilier allumé : `rest`', async () => {
    expect(
      (await readiness({ wellbeingPillarEnabled: true, wellbeing: [{ logDate: TODAY, energy: 5, stress: 1, sleepMinutes: 300 }] })).verdict,
    ).toBe('rest');
  });

  it('pilier allumé, seule la nuit est renseignée (bonne) : composante neutre', async () => {
    expect(
      (await readiness({ wellbeingPillarEnabled: true, wellbeing: [{ logDate: TODAY, sleepMinutes: 480, sleepQuality: 4 }] })).wellbeing,
    ).toBe('neutral');
  });

  it('nuit courte d’hier : ne compte pas (seulement ce matin)', async () => {
    expect(
      (await readiness({ wellbeingPillarEnabled: true, wellbeing: [{ logDate: day(-1), energy: 5, stress: 1, sleepMinutes: 300 }] })).verdict,
    ).toBe('push');
  });
});

describe('combinaison', () => {
  it('un seul signal négatif suffit : `rest`', async () => {
    expect(
      await readiness({
        workouts: [session(-27)],
        wellbeing: [{ logDate: TODAY, energy: 1, stress: 5 }],
      }),
    ).toMatchObject({ load: 'positive', wellbeing: 'negative', verdict: 'rest' });
  });
});
