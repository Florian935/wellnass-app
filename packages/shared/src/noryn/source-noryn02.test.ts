/**
 * US NORYN-02 — la source : ce qu'elle lit pour les cibles et le verdict, quand, et avec quels filtres.
 *
 * Le test qui compte est le premier : la **parité des lectures**. Le même jeu de données
 * (`parity.fixture.json`) est joué côté app dans le harnais SQLite avec les requêtes de l'app
 * (`apps/mobile/.../noryn02-parity-sql.test.ts`) et ici dans la fausse base avec les lectures du
 * serveur ; les deux comparent au **même** `expected`.
 */

import { describe, expect, it } from 'vitest';
import parity from './parity.fixture.json';
import { weightAtDate } from '../bodyweight';
import { isRealLifeDay } from '../real-life';
import { buildNorynDay } from './day';
import { NOW, OTHER, OWNER, fakeDb, twoUserTables } from './noryn.testkit';
import {
  decodeActivities,
  decodeCompletedRuns,
  decodeDailyKcal,
  decodeEnergyWorkouts,
  decodeFinishedRuns,
  decodePeriods,
  decodeWeights,
  hasPlannedOn,
} from './snapshot';
import {
  NorynSourceError,
  POSTGREST_MAX_ROWS,
  READINESS_COLUMNS,
  READ_COLUMNS,
  TARGET_COLUMNS,
  WEEK_WELLBEING_COLUMNS,
  createNorynSource,
} from './source';

type Row = Record<string, unknown>;

const TODAY = '2026-10-08';
const day = (date: string, today = TODAY) => ({ from: date, to: date, scope: 'day' as const, today });

/** Le jeu de parité, complété de ce qui décide : reçu, réglages, profils (mode `activities`). */
function parityTables(): Record<string, Row[]> {
  const owner = parity.owner;
  return {
    ...(parity.rows as Record<string, Row[]>),
    sync_receipts: [{ user_id: owner, received_at: '2026-10-08T09:00:00+00:00' }],
    user_settings: [
      {
        user_id: owner,
        active_pillars: ['strength', 'running', 'nutrition'],
        health_connect_enabled: false,
        wellbeing_pillar_enabled: true,
        deleted_at: null,
      },
    ],
    profiles: [
      {
        user_id: owner,
        daily_step_goal: 8000,
        birth_date: '1996-01-15',
        sex: 'male',
        height_cm: 180,
        weight_kg: 80,
        main_goal: 'muscle',
        deleted_at: null,
      },
    ],
    nutrition_profiles: [
      {
        user_id: owner,
        water_target_ml: 2000,
        objective: 'cut',
        activity_level: 'moderate',
        manual_calories: null,
        manual_protein_g: null,
        manual_carbs_g: null,
        manual_fat_g: null,
        training_day_bonus: 300,
        training_bonus_mode: 'activities',
        sport_free_level: null,
        deleted_at: null,
      },
    ],
    running_profiles: [],
    daily_steps: [],
    water_entries: [],
  };
}

const load = (date: string, tables = parityTables()) => createNorynSource(fakeDb(tables).client).load(parity.owner, day(date));
const sortedIds = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

describe('NORYN-02 — parité des lectures avec les requêtes de l’app (même `expected`)', () => {
  const { expected } = parity;

  it('séances de la dépense : terminées, finies, séries validées échauffements compris', async () => {
    const { targets } = await load(TODAY);
    expect(
      decodeEnergyWorkouts(targets!.workouts, targets!.workoutSets)
        .map((w) => ({ id: w.id, totalSets: w.totalSets }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual(expected.energyWorkouts);
  });

  it('séances de l’historique : les mêmes, sauf celles sans fin — que l’app ignore partout où le serveur s’en sert', async () => {
    const { targets, readiness } = await load(TODAY);
    const withEnd = expected.historyWorkoutIds.filter(
      (id) => parity.rows.workouts.find((w) => w.id === id)?.finished_at != null,
    );
    expect(sortedIds(targets!.workouts)).toEqual(withEnd);
    expect(readiness!.workouts).toHaveLength(withEnd.length);
  });

  it('courses : finies tout statut pour la dépense, terminées pour le reste', async () => {
    const { targets, readiness } = await load(TODAY);
    expect(sortedIds(decodeFinishedRuns(targets!.runs))).toEqual(expected.energyRunIds);
    expect(sortedIds(decodeCompletedRuns(targets!.runs))).toEqual(expected.historyRunIds);
    expect(readiness!.runs).toHaveLength(expected.historyRunIds.length);
  });

  it('autres activités : non supprimées, type hors catalogue compris', async () => {
    const { targets, readiness } = await load(TODAY);
    expect(sortedIds(decodeActivities(targets!.activities) as { id: string }[])).toEqual(expected.activityIds);
    expect(readiness!.activities).toHaveLength(expected.activityIds.length);
  });

  it('séance planifiée du jour : `planned`/`done`, non supprimée, sans jointure', async () => {
    for (const [date, has] of Object.entries(expected.hasPlanned)) {
      const snapshot = await load(date);
      expect({ date, has: hasPlannedOn(snapshot.planned, date) }).toEqual({ date, has });
    }
  });

  it('pesées : la dernière (mode `auto`), et la pesée à la date (`activities`), comme `weightAtDate` sur toutes', async () => {
    const auto = parityTables();
    auto.nutrition_profiles = auto.nutrition_profiles!.map((n) => ({ ...n, training_bonus_mode: 'auto' }));
    const { targets } = await load(TODAY, auto);
    expect({ logDate: targets!.latestWeight?.log_date, weightKg: targets!.latestWeight?.weight_kg }).toEqual(
      expected.latestWeight,
    );
    for (const date of ['2026-08-01', '2026-09-15', '2026-10-03', '2026-10-05', TODAY]) {
      const snapshot = await load(date);
      const served = weightAtDate(decodeWeights([snapshot.targets!.weightAtDate, snapshot.targets!.oldestWeight]), date);
      expect({ date, weight: served }).toEqual({ date, weight: weightAtDate(expected.weightEntries, date) });
    }
  });

  it('périodes « vie réelle » : celles qui couvrent la date, non supprimées', async () => {
    for (const date of [TODAY, '2026-10-09', '2026-10-13', '2026-10-14', '2026-10-15']) {
      const snapshot = await load(date);
      expect({ date, covered: isRealLifeDay(decodePeriods(snapshot.targets!.periods), date) }).toEqual({
        date,
        covered: isRealLifeDay(expected.periods, date),
      });
    }
  });

  it('totaux de kcal par jour depuis J−6, sans borne haute, un jour à 0 compris', async () => {
    const { readiness } = await load(TODAY);
    expect(decodeDailyKcal(readiness!.food)).toEqual(expected.dailyKcal);
  });

  it('check-ins depuis J−2, non supprimés', async () => {
    const { readiness } = await load(TODAY);
    expect(readiness!.wellbeing.map((r) => r.log_date).sort()).toEqual(expected.wellbeingDates);
  });
});

describe('NORYN-02 — ce qui est lu, et quand (D9)', () => {
  const tablesRead = async (tables: Record<string, Row[]>, range: ReturnType<typeof day>) => {
    const { client, log } = fakeDb(tables);
    await createNorynSource(client).load(OWNER, range);
    return log;
  };

  it('aujourd’hui, pilier Nutrition actif, mode `activities` : cibles, pesées, séries et verdict', async () => {
    const log = await tablesRead(twoUserTables(), day(TODAY));
    const tables = new Set(log.map((q) => q.table));
    for (const t of ['real_life_periods', 'body_weight_entries', 'activities', 'workout_sets']) expect(tables).toContain(t);
    expect(log.some((q) => q.table === 'daily_wellbeing' && q.columns.includes('stress'))).toBe(true);
  });

  it('une autre date : les cibles, jamais le verdict (ni 28 jours de séances, ni le stress)', async () => {
    const log = await tablesRead(twoUserTables(), day('2026-10-07'));
    expect(log.some((q) => q.columns.includes('stress'))).toBe(false);
    expect(log.some((q) => q.table === 'workouts' && q.columns.join() === READINESS_COLUMNS.workouts.join())).toBe(false);
    expect(log.some((q) => q.table === 'profiles' && q.columns.join() === TARGET_COLUMNS.profiles.join())).toBe(true);
  });

  it('pilier Nutrition éteint : ni profil étendu, ni profil nutritionnel, ni repas, ni pesées, ni périodes', async () => {
    const tables = twoUserTables();
    tables.user_settings = tables.user_settings!.map((s) => ({ ...s, active_pillars: ['strength', 'running'] }));
    const log = await tablesRead(tables, day(TODAY));
    const read = new Set(log.map((q) => q.table));
    for (const t of ['nutrition_profiles', 'food_entries', 'water_entries', 'body_weight_entries', 'real_life_periods', 'workout_sets']) {
      expect(read).not.toContain(t);
    }
    expect(log.filter((q) => q.table === 'profiles').map((q) => q.columns)).toEqual([['user_id', 'daily_step_goal']]);
    // Le verdict, lui, reste lu : il ne dépend pas du pilier Nutrition.
    expect(log.some((q) => q.columns.includes('stress'))).toBe(true);
  });

  it('mode `fixed` : aucune pesée, aucune série ; `auto` : la dernière pesée seulement ; `activities` : la pesée à la date et la plus ancienne', async () => {
    const fixed = twoUserTables();
    fixed.nutrition_profiles = fixed.nutrition_profiles!.map((n) => ({ ...n, training_bonus_mode: 'fixed' }));
    let read = (await tablesRead(fixed, day(TODAY))).map((q) => q.table);
    expect(read).not.toContain('body_weight_entries');
    expect(read).not.toContain('workout_sets');

    const auto = twoUserTables();
    auto.nutrition_profiles = auto.nutrition_profiles!.map((n) => ({ ...n, training_bonus_mode: 'auto' }));
    const log = await tablesRead(auto, day(TODAY));
    read = log.map((q) => q.table);
    expect(read.filter((t) => t === 'body_weight_entries')).toHaveLength(1);
    expect(read).not.toContain('workout_sets');

    read = (await tablesRead(twoUserTables(), day(TODAY))).map((q) => q.table);
    expect(read.filter((t) => t === 'body_weight_entries')).toHaveLength(2);
  });

  it('jamais synchronisé : aucune entrée des cibles ni du verdict', async () => {
    const tables = { ...twoUserTables(), sync_receipts: [] };
    const log = await tablesRead(tables, day(TODAY));
    const read = new Set(log.map((q) => q.table));
    for (const t of ['real_life_periods', 'body_weight_entries', 'activities', 'workout_sets', 'workouts', 'runs']) {
      expect(read).not.toContain(t);
    }
  });

  it('la semaine : exactement les lectures de NORYN-01 — tables et colonnes', async () => {
    const log = await tablesRead(twoUserTables(), { from: '2026-10-05', to: '2026-10-11', scope: 'week', today: TODAY } as never);
    expect(log.map((q) => q.table).sort()).toEqual(
      ['daily_steps', 'daily_wellbeing', 'planned_sessions', 'profiles', 'running_profiles', 'runs', 'sync_receipts', 'user_settings', 'workouts', 'sessions', 'programs', 'exercise_plans', 'session_intervals', 'exercises'].sort(),
    );
    for (const q of log) {
      const expectedColumns = q.table === 'daily_wellbeing' ? WEEK_WELLBEING_COLUMNS : READ_COLUMNS[q.table as keyof typeof READ_COLUMNS];
      expect({ table: q.table, columns: q.columns }).toEqual({ table: q.table, columns: [...expectedColumns] });
    }
  });

  it('les séries : seulement celles des séances du jour, validées ; jamais charge ni répétitions', async () => {
    const log = await tablesRead(twoUserTables(), day(TODAY));
    const sets = log.find((q) => q.table === 'workout_sets');
    expect(sets?.columns).toEqual(['user_id', 'workout_id']);
    expect(sets?.filters).toEqual(expect.arrayContaining([`eq:user_id=${OWNER}`, 'is:deleted_at=null', 'eq:done=true', 'in:workout_id']));
  });
});

describe('NORYN-02 — filtres repris des requêtes de l’app (R4)', () => {
  const logOf = async () => {
    const { client, log } = fakeDb(twoUserTables());
    await createNorynSource(client).load(OWNER, day(TODAY));
    return log;
  };
  const query = (log: Awaited<ReturnType<typeof logOf>>, table: string, columns: readonly string[]) =>
    log.filter((q) => q.table === table && q.columns.join() === columns.join());

  it('séances de la cible : terminées, autour de la date (jour à Paris ensuite)', async () => {
    const [q] = query(await logOf(), 'workouts', TARGET_COLUMNS.workouts);
    expect(q?.filters).toEqual(
      expect.arrayContaining(['eq:status=completed', 'gte:finished_at=2026-10-07T00:00:00Z', 'lt:finished_at=2026-10-10T00:00:00Z']),
    );
  });

  it('courses de la cible : **tout statut**, finies autour de la date', async () => {
    const [q] = query(await logOf(), 'runs', TARGET_COLUMNS.runs);
    expect(q?.filters.some((f) => f.startsWith('eq:status'))).toBe(false);
    expect(q?.filters).toEqual(expect.arrayContaining(['gte:finished_at=2026-10-07T00:00:00Z', 'lt:finished_at=2026-10-10T00:00:00Z']));
  });

  it('verdict : depuis J−28 (UTC) pour les séances, J−29 pour les activités, J−6 pour les repas, J−2 pour les check-ins — sans borne haute', async () => {
    const log = await logOf();
    const w = query(log, 'workouts', READINESS_COLUMNS.workouts)[0]!;
    const a = query(log, 'activities', READINESS_COLUMNS.activities)[0]!;
    const f = query(log, 'food_entries', READINESS_COLUMNS.food_entries)[0]!;
    const d = query(log, 'daily_wellbeing', READINESS_COLUMNS.daily_wellbeing)[0]!;
    expect(w.filters).toEqual(expect.arrayContaining(['eq:status=completed', 'gte:finished_at=2026-09-10T00:00:00Z']));
    expect(a.filters).toContain('gte:started_at=2026-09-09T00:00:00Z');
    expect(f.filters).toContain('gte:log_date=2026-10-02');
    expect(d.filters).toContain('gte:log_date=2026-10-06');
    for (const q of [w, a, f, d]) expect(q.filters.some((x) => x.startsWith('lt:') || x.startsWith('lte:'))).toBe(false);
  });

  it('pesées (`activities`) : à la date (date décroissante, puis id), la plus ancienne — une ligne chacune', async () => {
    const weights = query(await logOf(), 'body_weight_entries', TARGET_COLUMNS.body_weight_entries);
    expect(weights.map((q) => q.filters.filter((f) => !f.startsWith('eq:user_id') && f !== 'is:deleted_at=null'))).toEqual([
      ['lte:log_date=2026-10-08', 'order:log_date=desc', 'order:id=asc', 'limit:1'],
      ['order:log_date=asc', 'order:id=asc', 'limit:1'],
    ]);
  });

  it('DD9 — deux pesées le même jour, de poids différents : la plus petite `id` l’emporte, partout', async () => {
    const tables = twoUserTables();
    tables.body_weight_entries = [
      { user_id: OWNER, id: 'b-z', log_date: '2026-10-05', weight_kg: 70, deleted_at: null },
      { user_id: OWNER, id: 'b-a', log_date: '2026-10-05', weight_kg: 90, deleted_at: null },
    ];
    const activities = await createNorynSource(fakeDb(tables).client).load(OWNER, day(TODAY));
    expect(activities.targets?.weightAtDate?.weight_kg).toBe(90);
    tables.nutrition_profiles = tables.nutrition_profiles!.map((n) => ({ ...n, training_bonus_mode: 'auto' }));
    const auto = await createNorynSource(fakeDb(tables).client).load(OWNER, day(TODAY));
    expect(auto.targets?.latestWeight?.weight_kg).toBe(90);
  });

  it('périodes : celles qui couvrent la date', async () => {
    const [q] = query(await logOf(), 'real_life_periods', TARGET_COLUMNS.real_life_periods);
    expect(q?.filters).toEqual(expect.arrayContaining(['lte:started_on=2026-10-08', 'gte:ends_on=2026-10-08']));
  });
});

describe('NORYN-02 — isolation et pannes', () => {
  /** Les tables sans aucune ligne de l'autre compte. */
  const withoutOther = () =>
    Object.fromEntries(
      Object.entries(twoUserTables()).map(([t, rows]) => [t, rows.filter((r) => r.user_id !== OTHER && r.owner_id !== OTHER)]),
    );

  it('la journée de Florian est identique avec et sans les lignes de l’autre compte', async () => {
    const both = buildNorynDay(await createNorynSource(fakeDb(twoUserTables()).client).load(OWNER, day(TODAY)), { date: TODAY, now: NOW });
    const alone = buildNorynDay(await createNorynSource(fakeDb(withoutOther()).client).load(OWNER, day(TODAY)), { date: TODAY, now: NOW });
    expect(both).toEqual(alone);
    expect(both.nutrition?.energy_target_kcal).not.toBeNull();
    expect(both.readiness).not.toBeNull();
  });

  it.each([
    'real_life_periods',
    'body_weight_entries',
    'activities',
    'workout_sets',
    'workouts',
    'runs',
    'food_entries',
    'daily_wellbeing',
    'profiles',
    'nutrition_profiles',
  ])('un filtre oublié sur %s fait échouer la lecture (double barrière), au second temps', async (table) => {
    const { client } = fakeDb(twoUserTables(), { ignoreOwnerFilterOn: [table] });
    await expect(createNorynSource(client).load(OWNER, day(TODAY))).rejects.toMatchObject({ code: 'foreign_row' });
  });

  it('une lecture au plafond de PostgREST échoue au lieu de calculer sur une liste coupée', async () => {
    const tables = twoUserTables();
    tables.activities = Array.from({ length: POSTGREST_MAX_ROWS }, (_, i) => ({
      ...tables.activities![0]!,
      id: `a-${i}`,
    }));
    await expect(createNorynSource(fakeDb(tables).client).load(OWNER, day(TODAY))).rejects.toBeInstanceOf(NorynSourceError);
    await expect(createNorynSource(fakeDb(tables).client).load(OWNER, day(TODAY))).rejects.toMatchObject({ code: 'truncated' });
  });
});
