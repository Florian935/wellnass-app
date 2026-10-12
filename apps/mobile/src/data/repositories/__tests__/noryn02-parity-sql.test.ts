/**
 * US NORYN-02 — la **parité des lectures**, côté app.
 *
 * La fonction `noryn-context` sert à Noryn la cible calorique, la cible de protéines et le verdict
 * de forme, en appelant les **mêmes** compositions que les hooks. Mais une partie de « ce que l'app
 * retient » ne vit pas dans les compositions : elle vit dans le SQL des repositories (séances
 * `completed`, séries `done` échauffements compris, courses sans filtre de statut pour la dépense,
 * séances planifiées sans jointure, dernière pesée…). Le serveur doit le refaire à l'identique.
 *
 * Ce test joue le jeu de données commun (`packages/shared/src/noryn/parity.fixture.json`) dans le
 * harnais SQLite, avec **les requêtes de l'app**, et compare à `expected`. Le côté serveur
 * (`packages/shared/src/noryn/source.test.ts`) compare ses propres lectures **au même `expected`** :
 * un écart entre les deux fait échouer l'un ou l'autre.
 */

import parity from '../../../../../../packages/shared/src/noryn/parity.fixture.json';
import { SELECT_LATEST_WEIGHT, SELECT_WEIGHT_ENTRIES } from '../bodyweight-repository';
import { SELECT_WELLBEING_SINCE } from '../daily-wellbeing-repository';
import { SELECT_RUNS, SELECT_WORKOUTS } from '../energy-repository';
import { SELECT_ACTIVITIES } from '../activity-repository';
import { SELECT_DAILY_TOTALS } from '../journal-repository';
import { SELECT_HAS_PLANNED } from '../planned-session-repository';
import { SELECT_PERIODS } from '../real-life-repository';
import { SELECT_HISTORY_FOR_TEST as SELECT_RUN_HISTORY } from '../run-repository';
import { SELECT_HISTORY as SELECT_WORKOUT_HISTORY } from '../workout-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

const query = <T>(sql: string, params: unknown[] = []) => testPowerSync.getAll<T>(sql, params);
const sorted = (ids: string[]) => [...ids].sort();
const { expected } = parity;

beforeEach(() => {
  resetTestDb();
  for (const [table, rows] of Object.entries(parity.rows)) seed(table, rows as Record<string, unknown>[]);
});

describe('NORYN-02 — les requêtes de l’app retiennent `expected`', () => {
  it('séances de l’historique : `completed`, non supprimées (avec ou sans fin)', async () => {
    const rows = await query<{ id: string }>(SELECT_WORKOUT_HISTORY, ['fr', 'fr']);
    expect(sorted(rows.map((r) => r.id))).toEqual(expected.historyWorkoutIds);
  });

  it('séances de la dépense : `completed` finies, séries validées échauffements compris', async () => {
    const rows = await query<{ id: string; total_sets: number }>(SELECT_WORKOUTS);
    expect(
      rows.map((r) => ({ id: r.id, totalSets: r.total_sets })).sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual(expected.energyWorkouts);
  });

  it('courses de l’historique : `completed`, non supprimées', async () => {
    const rows = await query<{ id: string }>(SELECT_RUN_HISTORY);
    expect(sorted(rows.map((r) => r.id))).toEqual(expected.historyRunIds);
  });

  it('courses de la dépense : finies, non supprimées, **tout statut**', async () => {
    const rows = await query<{ id: string }>(SELECT_RUNS);
    expect(sorted(rows.map((r) => r.id))).toEqual(expected.energyRunIds);
  });

  it('autres activités : non supprimées, type hors catalogue compris', async () => {
    const rows = await query<{ id: string }>(SELECT_ACTIVITIES);
    expect(sorted(rows.map((r) => r.id))).toEqual(expected.activityIds);
  });

  it('séance planifiée du jour : `planned`/`done`, non supprimée, **sans jointure**', async () => {
    for (const [day, has] of Object.entries(expected.hasPlanned)) {
      const rows = await query(SELECT_HAS_PLANNED, [parity.owner, day]);
      expect({ day, has: rows.length > 0 }).toEqual({ day, has });
    }
  });

  it('dernière pesée et pesées : non supprimées', async () => {
    const [latest] = await query<{ log_date: string; weight_kg: number }>(SELECT_LATEST_WEIGHT);
    expect({ logDate: latest?.log_date, weightKg: latest?.weight_kg }).toEqual(expected.latestWeight);

    const entries = await query<{ log_date: string; weight_kg: number }>(SELECT_WEIGHT_ENTRIES);
    expect(entries.map((r) => ({ logDate: r.log_date, weightKg: r.weight_kg }))).toEqual(expected.weightEntries);
  });

  it('périodes « vie réelle » : non supprimées', async () => {
    const rows = await query<{ started_on: string; ends_on: string }>(SELECT_PERIODS);
    expect(rows.map((r) => ({ startedOn: r.started_on, endsOn: r.ends_on }))).toEqual(expected.periods);
  });

  it('totaux de kcal par jour : depuis la borne, sans borne haute, un jour à 0 compris', async () => {
    const rows = await query<{ log_date: string; kcal: number }>(SELECT_DAILY_TOTALS, [expected.dailyKcalSince]);
    // Même arrondi jour par jour que `useDailyTotals`.
    expect(rows.map((r) => ({ logDate: r.log_date, kcal: Math.round(r.kcal) }))).toEqual(expected.dailyKcal);
  });

  it('check-ins : depuis la borne, non supprimés', async () => {
    const rows = await query<{ log_date: string }>(SELECT_WELLBEING_SINCE, [expected.wellbeingSince]);
    expect(sorted(rows.map((r) => r.log_date))).toEqual(expected.wellbeingDates);
  });
});
