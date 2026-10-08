import { describe, expect, it } from 'vitest';
import { norynDaySchema } from './contract';
import { buildNorynDay } from './day';
import { NOW, OWNER, emptySnapshot, uid } from './noryn.testkit';
import type { OwnerSnapshot } from './snapshot';

const DATE = '2026-10-08';
const build = (snapshot: OwnerSnapshot, date = DATE) => {
  const day = buildNorynDay(snapshot, { date, now: NOW });
  // Toute sortie passe le contrat.
  expect(norynDaySchema.safeParse(day).success).toBe(true);
  return day;
};

const food = (log_date: string, kcal: number, protein_g: number) => ({ user_id: OWNER, log_date, kcal, protein_g });
const wellbeing = (log_date: string, over = {}) => ({
  user_id: OWNER,
  log_date,
  sleep_minutes: 425,
  sleep_quality: 4,
  energy: 3,
  motivation: 4,
  sick: false,
  ...over,
});

/** Une journée complète : pas, repas, eau, check-in, une séance de jambes à 18 h 30. */
const full = (over: Partial<OwnerSnapshot> = {}) =>
  emptySnapshot({
    steps: [{ user_id: OWNER, log_date: DATE, steps: 6400 }],
    food: [food(DATE, 800.4, 50.4), food(DATE, 649.8, 41.7), food('2026-10-07', 3000, 200)],
    water: [
      { user_id: OWNER, log_date: DATE, volume_ml: 250 },
      { user_id: OWNER, log_date: DATE, volume_ml: 1000 },
      { user_id: OWNER, log_date: '2026-10-07', volume_ml: 3000 },
    ],
    wellbeing: [wellbeing(DATE), wellbeing('2026-10-07', { sleep_minutes: 300, sick: true })],
    planned: [
      {
        owner_id: OWNER,
        id: uid(1),
        scheduled_date: DATE,
        scheduled_time: '18:30:00',
        status: 'planned',
        session_id: 's1',
        program_id: 'p1',
      },
    ],
    sessions: [
      { owner_id: null, id: 's1', session_type: null, order_index: 0, target_duration_seconds: null, target_distance_m: null },
    ],
    programs: [{ owner_id: null, id: 'p1', pillar: 'strength', status: 'published' }],
    exercisePlans: [
      { owner_id: null, session_id: 's1', exercise_id: 'e1', order_index: 0, target_sets: 5, rest_seconds: 150 },
      { owner_id: null, session_id: 's1', exercise_id: 'e2', order_index: 1, target_sets: 4, rest_seconds: 120 },
    ],
    exercises: [
      { owner_id: null, id: 'e1', muscle_primary: 'legs', status: 'published', deleted_at: null },
      { owner_id: null, id: 'e2', muscle_primary: 'legs', status: 'published', deleted_at: null },
    ],
    ...over,
  });

describe('buildNorynDay — une journée complète', () => {
  it('rend chaque domaine, cibles et verdict à null (D1)', () => {
    expect(build(full())).toEqual({
      date: DATE,
      generated_at: '2026-10-08T12:00:00.000Z',
      synced_at: '2026-10-08T09:00:00.123Z',
      steps: { count: 6400, daily_target: 10_000 },
      nutrition: { energy_kcal: 1450, energy_target_kcal: null, protein_g: 92, protein_target_g: null },
      hydration: { volume_ml: 1250, target_ml: 2_500 },
      recovery: { sleep_minutes: 425, sleep_quality: 4, energy: 3, motivation: 4 },
      readiness: null,
      intensity_on_hold: false,
      training: [
        {
          id: uid(1),
          date: DATE,
          start_time: '18:30',
          kind: 'strength',
          intensity: null,
          estimated_minutes: 25,
          status: 'planned',
          tags: ['heavy_lower'],
        },
      ],
    });
  });

  it('ne lit que la date demandée', () => {
    const day = build(full(), '2026-10-07');
    expect(day.nutrition?.energy_kcal).toBe(3000);
    expect(day.hydration?.volume_ml).toBe(3000);
    expect(day.recovery?.sleep_minutes).toBe(300);
    expect(day.steps?.count).toBeNull();
    expect(day.training).toEqual([]);
  });
});

describe('buildNorynDay — les trois null', () => {
  it('domaine non suivi : Health Connect éteint → steps null', () => {
    const settings = { ...emptySnapshot().settings!, health_connect_enabled: false };
    expect(build(full({ settings })).steps).toBeNull();
  });

  it('domaine non suivi : pilier Nutrition éteint → nutrition et eau null, récupération gardée', () => {
    const settings = { ...emptySnapshot().settings!, active_pillars: ['strength', 'running'] };
    const day = build(full({ settings }));
    expect(day.nutrition).toBeNull();
    expect(day.hydration).toBeNull();
    expect(day.recovery).not.toBeNull();
  });

  it('rien de saisi : valeurs null, objectifs présents', () => {
    expect(build(emptySnapshot())).toEqual({
      date: DATE,
      generated_at: '2026-10-08T12:00:00.000Z',
      synced_at: '2026-10-08T09:00:00.123Z',
      steps: { count: null, daily_target: 10_000 },
      nutrition: { energy_kcal: null, energy_target_kcal: null, protein_g: null, protein_target_g: null },
      hydration: { volume_ml: null, target_ml: 2_500 },
      recovery: { sleep_minutes: null, sleep_quality: null, energy: null, motivation: null },
      readiness: null,
      intensity_on_hold: false,
      training: [],
    });
  });

  it('jamais synchronisé : aucune valeur mesurée, aucune séance, pas de veille', () => {
    const day = build(full({ receivedAt: null, wellbeing: [wellbeing(DATE, { sick: true })] }));
    expect(day.synced_at).toBeNull();
    expect(day.steps).toEqual({ count: null, daily_target: 10_000 });
    expect(day.nutrition).toEqual({ energy_kcal: null, energy_target_kcal: null, protein_g: null, protein_target_g: null });
    expect(day.hydration).toEqual({ volume_ml: null, target_ml: 2_500 });
    expect(day.recovery).toEqual({ sleep_minutes: null, sleep_quality: null, energy: null, motivation: null });
    expect(day.intensity_on_hold).toBe(false);
    expect(day.training).toEqual([]);
  });
});

describe('buildNorynDay — valeurs', () => {
  it('arrondit les sommes du journal à l’entier', () => {
    const day = build(emptySnapshot({ food: [food(DATE, 0.4, 0.3), food(DATE, 0.4, 0.3)] }));
    expect(day.nutrition).toMatchObject({ energy_kcal: 1, protein_g: 1 });
  });

  it('des kcal hors bornes rendent les deux consommations null (jamais rognées, jamais l’une sans l’autre)', () => {
    const day = build(emptySnapshot({ food: [food(DATE, 15_000, 50), food(DATE, 6_000, 50)] }));
    expect(day.nutrition).toMatchObject({ energy_kcal: null, protein_g: null });
    const negative = build(emptySnapshot({ food: [food(DATE, -10, 5)] }));
    expect(negative.nutrition).toMatchObject({ energy_kcal: null, protein_g: null });
    const tooMuchProtein = build(emptySnapshot({ food: [food(DATE, 2_000, 2_001)] }));
    expect(tooMuchProtein.nutrition).toMatchObject({ energy_kcal: null, protein_g: null });
  });

  it('eau hors bornes → null', () => {
    const day = build(emptySnapshot({ water: [{ user_id: OWNER, log_date: DATE, volume_ml: 20_001 }] }));
    expect(day.hydration?.volume_ml).toBeNull();
  });

  it('plusieurs totaux de pas pour un jour : le plus grand (règle 7 de PAS-01) ; hors bornes → null', () => {
    const steps = (n: number) => ({ user_id: OWNER, log_date: DATE, steps: n });
    expect(build(emptySnapshot({ steps: [steps(300), steps(9000)] })).steps?.count).toBe(9000);
    expect(build(emptySnapshot({ steps: [steps(200_001)] })).steps?.count).toBeNull();
  });

  it('check-in hors bornes → null, champ par champ', () => {
    const day = build(
      emptySnapshot({ wellbeing: [wellbeing(DATE, { sleep_minutes: 900, sleep_quality: 6, energy: 0, motivation: null })] }),
    );
    expect(day.recovery).toEqual({ sleep_minutes: null, sleep_quality: null, energy: null, motivation: null });
  });

  it('objectifs normalisés comme l’app : pas absents → 8 000, hors bornes → bornés ; eau absente ou hors bornes → 2 000', () => {
    expect(build(emptySnapshot({ profile: null })).steps?.daily_target).toBe(8000);
    expect(build(emptySnapshot({ profile: { user_id: OWNER, daily_step_goal: 60_000 } })).steps?.daily_target).toBe(
      50_000,
    );
    expect(build(emptySnapshot({ nutritionProfile: null })).hydration?.target_ml).toBe(2000);
    expect(
      build(emptySnapshot({ nutritionProfile: { user_id: OWNER, water_target_ml: 12_000 } })).hydration?.target_ml,
    ).toBe(2000);
  });
});

describe('buildNorynDay — intensité en veille (D4)', () => {
  it('malade + pilier Bien-être allumé → vrai', () => {
    expect(build(emptySnapshot({ wellbeing: [wellbeing(DATE, { sick: true })] })).intensity_on_hold).toBe(true);
  });

  it('malade, pilier Bien-être éteint → faux', () => {
    const settings = { ...emptySnapshot().settings!, wellbeing_pillar_enabled: false };
    expect(build(emptySnapshot({ settings, wellbeing: [wellbeing(DATE, { sick: true })] })).intensity_on_hold).toBe(
      false,
    );
  });

  it('malade la veille seulement → faux ; « malade » non renseigné → faux', () => {
    expect(build(emptySnapshot({ wellbeing: [wellbeing('2026-10-07', { sick: true })] })).intensity_on_hold).toBe(false);
    expect(build(emptySnapshot({ wellbeing: [wellbeing(DATE, { sick: null })] })).intensity_on_hold).toBe(false);
  });
});

describe('buildNorynDay — fraîcheur', () => {
  it('reçu postérieur à la réponse : borné', () => {
    expect(build(emptySnapshot({ receivedAt: '2026-10-08T13:00:00Z' })).synced_at).toBe(NOW.toISOString());
  });

  it('une date future garde ses séances planifiées', () => {
    const snapshot = full();
    const planned = snapshot.planned.map((p) => ({ ...p, scheduled_date: '2026-10-20' }));
    const day = build({ ...snapshot, planned }, '2026-10-20');
    expect(day.training).toHaveLength(1);
    expect(day.steps?.count).toBeNull();
  });
});
