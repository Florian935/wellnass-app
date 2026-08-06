/**
 * US VIE-01 — périodes « mode vie réelle », écritures sur **du vrai SQLite**.
 *
 * Ce fichier existe pour une raison précise : le harness génère son DDL depuis
 * `apps/mobile/src/powersync/schema.ts`. Une écriture-relecture qui passe **prouve** que la table est
 * bien déclarée dans le schéma **local** — la panne exacte de CYCLE-01, où le suivi était impossible
 * à activer parce que les colonnes manquaient au schéma local : l'écriture échouait et l'erreur était
 * avalée, sans le moindre message à l'écran.
 *
 * Les règles pures (`validateRealLifePeriod`, `realLifeDayKeys`, `activeRealLifePeriod`) sont testées
 * dans `@wellness/shared` (`real-life.test.ts`) ; on vérifie ici leur **câblage** aux requêtes.
 */

import {
  RealLifePeriodValidationError,
  extendRealLifePeriod,
  startRealLifePeriod,
  stopRealLifePeriod,
} from '../real-life-repository';
import { resetTestDb, rowsOf, seed } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

type PeriodRow = {
  id: string;
  user_id: string;
  started_on: string;
  ends_on: string;
  deleted_at: string | null;
};

const periods = (includeDeleted = false) =>
  rowsOf<PeriodRow>('real_life_periods', includeDeleted);

/** Clé de jour local, décalée de `offsetDays`. */
function dayKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

beforeEach(() => {
  resetTestDb();
});

describe('startRealLifePeriod', () => {
  it('écrit la période avec son propriétaire et ses bornes', async () => {
    // 🔴 Le test qui compte : s'il passe, la table EST dans `powersync/schema.ts`.
    const id = await startRealLifePeriod({ startedOn: dayKey(), endsOn: dayKey(6) });

    expect(periods()).toHaveLength(1);
    expect(periods()[0]).toMatchObject({
      id,
      user_id: 'user-1',
      started_on: dayKey(),
      ends_on: dayKey(6),
      deleted_at: null,
    });
  });

  it('accepte une rétro-déclaration à J-7', async () => {
    await startRealLifePeriod({ startedOn: dayKey(-7), endsOn: dayKey(3) });
    expect(periods()).toHaveLength(1);
  });

  it('refuse une rétro-déclaration à J-8, et n’écrit RIEN', async () => {
    await expect(
      startRealLifePeriod({ startedOn: dayKey(-8), endsOn: dayKey(3) }),
    ).rejects.toBeInstanceOf(RealLifePeriodValidationError);
    expect(periods(true)).toHaveLength(0);
  });

  it('refuse une fin antérieure au début, et n’écrit RIEN', async () => {
    await expect(
      startRealLifePeriod({ startedOn: dayKey(2), endsOn: dayKey(1) }),
    ).rejects.toBeInstanceOf(RealLifePeriodValidationError);
    expect(periods(true)).toHaveLength(0);
  });

  it('porte le motif de refus, pour que l’UI puisse le traduire', async () => {
    await expect(
      startRealLifePeriod({ startedOn: dayKey(-8), endsOn: dayKey(3) }),
    ).rejects.toMatchObject({ reason: 'backdated_too_far' });
  });

  it('laisse coexister deux périodes qui se chevauchent', async () => {
    // Aucune contrainte de plage en base, DÉLIBÉRÉMENT : une violation bloquerait la file d'upload
    // PowerSync (patron REPAS-01, D6). Deux appareils hors réseau peuvent produire ce cas, et la
    // lecture l'absorbe en prenant l'union des jours.
    await startRealLifePeriod({ startedOn: dayKey(), endsOn: dayKey(6) });
    await startRealLifePeriod({ startedOn: dayKey(3), endsOn: dayKey(9) });
    expect(periods()).toHaveLength(2);
  });
});

describe('extendRealLifePeriod', () => {
  it('repousse la date de fin', async () => {
    const id = await startRealLifePeriod({ startedOn: dayKey(), endsOn: dayKey(6) });
    await extendRealLifePeriod(id, dayKey(13));
    expect(periods()[0]?.ends_on).toBe(dayKey(13));
  });

  it('relit `started_on` EN BASE pour valider, pas ce que l’écran croit savoir', async () => {
    // Une période commencée il y a 5 jours, prolongée : la validation doit porter sur l'intervalle
    // réel. Passer une fin antérieure à ce début doit échouer même si l'appelant l'ignore.
    seed('real_life_periods', [
      { id: 'p-seed', user_id: 'user-1', started_on: dayKey(-5), ends_on: dayKey(1) },
    ]);
    await expect(extendRealLifePeriod('p-seed', dayKey(-6))).rejects.toBeInstanceOf(
      RealLifePeriodValidationError,
    );
    expect(periods()[0]?.ends_on).toBe(dayKey(1));
  });

  it('échoue clairement sur une période introuvable', async () => {
    await expect(extendRealLifePeriod('inconnue', dayKey(3))).rejects.toThrow(/introuvable/);
  });
});

describe('stopRealLifePeriod', () => {
  it('termine la période aujourd’hui', async () => {
    const id = await startRealLifePeriod({ startedOn: dayKey(-2), endsOn: dayKey(6) });
    await stopRealLifePeriod(id);
    expect(periods()[0]?.ends_on).toBe(dayKey());
  });

  it('ne SUPPRIME pas la ligne — elle doit continuer d’annoter les analyses (D2)', async () => {
    const id = await startRealLifePeriod({ startedOn: dayKey(-2), endsOn: dayKey(6) });
    await stopRealLifePeriod(id);

    expect(periods()).toHaveLength(1);
    expect(periods()[0]?.deleted_at).toBeNull();
    // Les jours écoulés sont conservés : la période a bien existé du J-2 à aujourd'hui.
    expect(periods()[0]?.started_on).toBe(dayKey(-2));
  });

  it('réduit à un seul jour une période commencée aujourd’hui, sans produire d’intervalle inversé', async () => {
    const id = await startRealLifePeriod({ startedOn: dayKey(), endsOn: dayKey(13) });
    await stopRealLifePeriod(id);
    expect(periods()[0]).toMatchObject({ started_on: dayKey(), ends_on: dayKey() });
  });
});
