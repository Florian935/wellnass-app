/**
 * US DOUL-01 — journal des zones douloureuses, écritures sur **du vrai SQLite**.
 *
 * Deux raisons d'exister, et la seconde est la plus importante :
 *
 * 1. le harness génère son DDL depuis `apps/mobile/src/powersync/schema.ts` — une écriture-relecture
 *    qui passe **prouve** que `pain_reports` **et** la colonne `pain_journal_enabled` y sont
 *    déclarées. C'est la panne exacte de CYCLE-01 : colonnes absentes du schéma local, écriture en
 *    échec, erreur avalée, réglage inactivable **sans le moindre message** ;
 * 2. la garde d'opt-in est **dans le repository**, pas seulement dans l'UI. Une route atteinte par
 *    deep-link ne doit pas pouvoir écrire une donnée de santé — défaut relevé en recette de CYCLE-01,
 *    où `wellness://cycle` s'ouvrait suivi éteint.
 */

import {
  deleteAllPainReports,
  deletePainReport,
  reportPain,
} from '../pain-repository';
import { resetTestDb, rowsOf, seed } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

type PainRow = {
  id: string;
  user_id: string;
  log_date: string;
  zone: string;
  level: string;
  deleted_at: string | null;
};

const reports = (includeDeleted = false) => rowsOf<PainRow>('pain_reports', includeDeleted);

function dayKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Réglages avec le journal activé (ou non) — la garde les relit en base. */
function seedSettings(enabled: boolean): void {
  seed('user_settings', [{ user_id: 'user-1', pain_journal_enabled: enabled ? 1 : 0 }]);
}

beforeEach(() => {
  resetTestDb();
});

describe('garde d’opt-in', () => {
  it('🔴 refuse toute écriture quand le journal est désactivé', () => {
    seedSettings(false);
    return expect(
      reportPain({ zone: 'back', level: 'pain', logDate: dayKey() }),
    ).rejects.toThrow(/désactivé/);
  });

  it('refuse aussi quand aucun réglage n’existe — l’absence ne vaut pas consentement', async () => {
    await expect(
      reportPain({ zone: 'back', level: 'pain', logDate: dayKey() }),
    ).rejects.toThrow(/désactivé/);
    expect(reports(true)).toHaveLength(0);
  });

  it('n’écrit RIEN quand elle refuse', async () => {
    seedSettings(false);
    await expect(reportPain({ zone: 'knee', level: 'blocking', logDate: dayKey() })).rejects.toThrow();
    expect(reports(true)).toHaveLength(0);
  });
});

describe('reportPain', () => {
  beforeEach(() => seedSettings(true));

  it('écrit la déclaration avec son propriétaire, sa zone et son niveau', async () => {
    // 🔴 S'il passe, la table EST dans `powersync/schema.ts`.
    const id = await reportPain({ zone: 'back', level: 'pain', logDate: dayKey() });

    expect(reports()).toHaveLength(1);
    expect(reports()[0]).toMatchObject({
      id,
      user_id: 'user-1',
      log_date: dayKey(),
      zone: 'back',
      level: 'pain',
      deleted_at: null,
    });
  });

  it('accepte une zone articulaire — le journal les enregistre, seul le signal les ignore', async () => {
    await reportPain({ zone: 'knee', level: 'blocking', logDate: dayKey() });
    expect(reports()[0]?.zone).toBe('knee');
  });

  it('MET À JOUR le niveau au lieu de créer un doublon le même jour (R2)', async () => {
    const first = await reportPain({ zone: 'back', level: 'discomfort', logDate: dayKey() });
    const second = await reportPain({ zone: 'back', level: 'blocking', logDate: dayKey() });

    expect(second).toBe(first);
    expect(reports()).toHaveLength(1);
    expect(reports()[0]?.level).toBe('blocking');
  });

  it('crée bien deux lignes pour deux zones le même jour', async () => {
    await reportPain({ zone: 'back', level: 'pain', logDate: dayKey() });
    await reportPain({ zone: 'knee', level: 'pain', logDate: dayKey() });
    expect(reports()).toHaveLength(2);
  });

  it('crée bien deux lignes pour la même zone sur deux jours', async () => {
    await reportPain({ zone: 'back', level: 'pain', logDate: dayKey(-1) });
    await reportPain({ zone: 'back', level: 'pain', logDate: dayKey() });
    expect(reports()).toHaveLength(2);
  });

  it('recrée une ligne après suppression, sans buter sur l’index unique', async () => {
    // L'index est **partiel** (`where deleted_at is null`) précisément pour ça.
    const id = await reportPain({ zone: 'back', level: 'pain', logDate: dayKey() });
    await deletePainReport(id);
    await reportPain({ zone: 'back', level: 'blocking', logDate: dayKey() });

    expect(reports()).toHaveLength(1);
    expect(reports()[0]?.level).toBe('blocking');
    expect(reports(true)).toHaveLength(2);
  });
});

describe('suppression', () => {
  beforeEach(() => seedSettings(true));

  it('deletePainReport fait un SOFT delete', async () => {
    const id = await reportPain({ zone: 'back', level: 'pain', logDate: dayKey() });
    await deletePainReport(id);

    expect(reports()).toHaveLength(0);
    expect(reports(true)).toHaveLength(1);
    expect(reports(true)[0]?.deleted_at).not.toBeNull();
  });

  it('deleteAllPainReports vide le journal et rend le nombre supprimé', async () => {
    await reportPain({ zone: 'back', level: 'pain', logDate: dayKey() });
    await reportPain({ zone: 'knee', level: 'blocking', logDate: dayKey() });

    expect(await deleteAllPainReports()).toBe(2);
    expect(reports()).toHaveLength(0);
    expect(reports(true)).toHaveLength(2);
  });

  it('deleteAllPainReports sur un journal vide ne casse rien', async () => {
    expect(await deleteAllPainReports()).toBe(0);
  });
});
