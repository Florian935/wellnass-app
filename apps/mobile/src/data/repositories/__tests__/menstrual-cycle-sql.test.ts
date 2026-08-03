/**
 * US CYCLE-01 — écritures du suivi de cycle, exécutées sur **du vrai SQLite**.
 *
 * Ce fichier est le premier usage du harness `@/test-utils/sqlite-harness` : les requêtes des
 * repositories sont réellement exécutées sur une base créée depuis le schéma PowerSync de l'app.
 * Ce que ça attrape et qu'un `powerSync` mocké laissait passer :
 *  - une colonne absente du schéma local (le bug de la recette du 31/07/2026) ;
 *  - un `WHERE deleted_at IS NULL` oublié ;
 *  - l'idempotence réelle de `startPeriod` (deux appels → une seule ligne en base).
 */

import {
  autoCloseStalePeriods,
  deleteAllCycleData,
  endPeriod,
  getMenstrualLogForDay,
  saveMenstrualDailyLog,
  startPeriod,
} from '../menstrual-cycle-repository';
import { resetTestDb, rowsOf, seed } from '@/test-utils/sqlite-harness';

// Branche les repositories sur la base en mémoire (remplace le mock global de jest.setup.ts).
jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

/** Clé de jour local, au format des colonnes `*_on` / `log_date`. */
function dayKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Active le suivi (R16) : sans cette ligne, toute écriture est refusée. */
function enableTracking(): void {
  seed('user_settings', [{ user_id: 'user-1', cycle_tracking_enabled: 1 }]);
}

beforeEach(() => {
  resetTestDb();
});

describe('garde d’activation (R16)', () => {
  it('refuse toute écriture tant que le suivi n’est pas activé', async () => {
    seed('user_settings', [{ user_id: 'user-1', cycle_tracking_enabled: 0 }]);

    await expect(startPeriod(dayKey())).rejects.toThrow(/désactivé/);
    expect(rowsOf('menstrual_periods')).toHaveLength(0);
  });

  it('refuse aussi quand aucun réglage n’existe encore', async () => {
    await expect(startPeriod(dayKey())).rejects.toThrow(/désactivé/);
  });
});

describe('startPeriod', () => {
  beforeEach(enableTracking);

  it('insère la période et la laisse ouverte', async () => {
    const id = await startPeriod(dayKey(-2));

    const rows = rowsOf<{ id: string; started_on: string; ended_on: string | null; source: string }>(
      'menstrual_periods',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id,
      started_on: dayKey(-2),
      ended_on: null,
      source: 'manual',
    });
  });

  it('est idempotent sur la date de début (import Health Connect rejouable, R21)', async () => {
    const first = await startPeriod(dayKey(-2));
    const second = await startPeriod(dayKey(-2), 'health_connect');

    expect(second).toBe(first);
    expect(rowsOf('menstrual_periods')).toHaveLength(1);
  });

  it('clôt la période restée ouverte la veille du nouveau début (R2)', async () => {
    await startPeriod(dayKey(-30));
    await startPeriod(dayKey(-2));

    const rows = rowsOf<{ started_on: string; ended_on: string | null }>('menstrual_periods');
    expect(rows).toHaveLength(2);
    const previous = rows.find((r) => r.started_on === dayKey(-30));
    expect(previous?.ended_on).toBe(dayKey(-3));
    expect(rows.find((r) => r.started_on === dayKey(-2))?.ended_on).toBeNull();
  });

  it('refuse une date future (R4)', async () => {
    await expect(startPeriod(dayKey(1))).rejects.toThrow(/future/);
    expect(rowsOf('menstrual_periods')).toHaveLength(0);
  });

  it('ignore une période supprimée pour l’idempotence', async () => {
    seed('menstrual_periods', [
      {
        id: 'supprimee',
        user_id: 'user-1',
        started_on: dayKey(-2),
        ended_on: null,
        source: 'manual',
        deleted_at: new Date().toISOString(),
      },
    ]);

    const id = await startPeriod(dayKey(-2));

    expect(id).not.toBe('supprimee');
    expect(rowsOf('menstrual_periods')).toHaveLength(1);
  });
});

describe('endPeriod / autoCloseStalePeriods', () => {
  beforeEach(enableTracking);

  it('pose la date de fin sur la bonne ligne', async () => {
    const other = await startPeriod(dayKey(-40));
    const id = await startPeriod(dayKey(-3));

    await endPeriod(id, dayKey(-1));

    const rows = rowsOf<{ id: string; ended_on: string | null }>('menstrual_periods');
    expect(rows.find((r) => r.id === id)?.ended_on).toBe(dayKey(-1));
    expect(rows.find((r) => r.id === other)?.ended_on).toBe(dayKey(-4));
  });

  it('clôt d’office une période ouverte depuis plus de 15 jours et renvoie le compte (R3)', async () => {
    seed('menstrual_periods', [
      { user_id: 'user-1', started_on: dayKey(-40), ended_on: null, source: 'manual' },
    ]);

    const corrected = await autoCloseStalePeriods(dayKey());

    expect(corrected).toBe(1);
    expect(rowsOf<{ ended_on: string | null }>('menstrual_periods')[0]?.ended_on).not.toBeNull();
  });

  it('ne touche pas une période ouverte récente', async () => {
    await startPeriod(dayKey(-2));

    expect(await autoCloseStalePeriods(dayKey())).toBe(0);
    expect(rowsOf<{ ended_on: string | null }>('menstrual_periods')[0]?.ended_on).toBeNull();
  });
});

describe('saveMenstrualDailyLog', () => {
  beforeEach(enableTracking);

  it('crée le journal du jour puis le met à jour sans créer de doublon', async () => {
    await saveMenstrualDailyLog(dayKey(), { flow: 'medium', symptoms: ['cramps'] });
    await saveMenstrualDailyLog(dayKey(), { flow: 'light', symptoms: [] });

    const rows = rowsOf<{ flow: string | null; symptoms: string }>('menstrual_daily_logs');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.flow).toBe('light');
    expect(JSON.parse(rows[0]?.symptoms ?? 'null')).toEqual([]);
  });

  it('accepte une saisie vide — c’est ainsi qu’on efface une saisie précédente', async () => {
    await saveMenstrualDailyLog(dayKey(), { flow: 'heavy', symptoms: ['cramps'] });
    await saveMenstrualDailyLog(dayKey(), { flow: null, symptoms: [] });

    const log = await getMenstrualLogForDay(dayKey());
    expect(log?.flow).toBeNull();
    expect(log?.symptoms).toEqual([]);
  });

  it('relit ce qui a été écrit, pour la bonne date seulement', async () => {
    await saveMenstrualDailyLog(dayKey(-1), { flow: 'spotting', symptoms: ['headache'] });

    expect((await getMenstrualLogForDay(dayKey(-1)))?.flow).toBe('spotting');
    expect(await getMenstrualLogForDay(dayKey())).toBeNull();
  });

  it('refuse une date future (R4)', async () => {
    await expect(saveMenstrualDailyLog(dayKey(1), { flow: 'light' })).rejects.toThrow(/future/);
  });
});

describe('deleteAllCycleData (R17)', () => {
  it('supprime en douceur périodes et journaux, y compris après désactivation du suivi', async () => {
    enableTracking();
    await startPeriod(dayKey(-2));
    await saveMenstrualDailyLog(dayKey(), { flow: 'medium', symptoms: [] });

    await deleteAllCycleData();

    expect(rowsOf('menstrual_periods')).toHaveLength(0);
    expect(rowsOf('menstrual_daily_logs')).toHaveLength(0);
    // Soft delete : les lignes existent toujours, marquées supprimées (jamais de hard delete client).
    expect(rowsOf('menstrual_periods', true)).toHaveLength(1);
    expect(rowsOf('menstrual_daily_logs', true)).toHaveLength(1);
  });
});
