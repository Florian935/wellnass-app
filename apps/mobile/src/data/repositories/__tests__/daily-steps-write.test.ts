/**
 * US PAS-01 — écritures du repository des pas quotidiens.
 *
 * La **décision** (créer / mettre à jour / ne rien faire) est déjà couverte par `mergeDailySteps`
 * dans `@wellness/shared` ; ce qui est testé ici est la **plomberie** : les bonnes colonnes à
 * l'insertion, le bon `id` au patch, et surtout le fait qu'un total plus faible venant d'un autre
 * appareil **n'écrase pas** le total stocké (règle du max) — le scénario que la spec veut voir en
 * recette multi-appareils, vérifié ici sans device.
 */

import { upsertDailySteps } from '../daily-steps-repository';
import { insertWithSyncFields, patch } from '../_sql';
import { powerSync } from '@/powersync/system';

jest.mock('@/powersync/system', () => ({
  powerSync: { getAll: jest.fn(), getOptional: jest.fn() },
}));

jest.mock('../_sql', () => ({
  insertWithSyncFields: jest.fn(async () => 'new-id'),
  patch: jest.fn(async () => undefined),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

const getAll = powerSync.getAll as jest.Mock;

/** Lignes locales renvoyées par la requête de lecture du repository. */
const local = (rows: { id: string; log_date: string; steps: number; deleted_at?: string | null }[]) =>
  getAll.mockResolvedValueOnce(
    rows.map((r) => ({ ...r, deleted_at: r.deleted_at ?? null })),
  );

describe('upsertDailySteps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('insère un jour absent avec la source et le propriétaire', async () => {
    local([]);

    const written = await upsertDailySteps([{ logDate: '2026-07-28', steps: 8432 }]);

    expect(written).toBe(1);
    expect(insertWithSyncFields).toHaveBeenCalledWith('daily_steps', {
      user_id: 'user-1',
      log_date: '2026-07-28',
      steps: 8432,
      source: 'health_connect',
    });
    expect(patch).not.toHaveBeenCalled();
  });

  it('met à jour le jour existant quand le total a augmenté', async () => {
    local([{ id: 'row-1', log_date: '2026-07-28', steps: 6000 }]);

    const written = await upsertDailySteps([{ logDate: '2026-07-28', steps: 8432 }]);

    expect(written).toBe(1);
    expect(patch).toHaveBeenCalledWith('daily_steps', 'row-1', { steps: 8432 });
    expect(insertWithSyncFields).not.toHaveBeenCalled();
  });

  it('n’écrase pas un total plus élevé (2ᵉ appareil peu porté)', async () => {
    local([{ id: 'row-1', log_date: '2026-07-28', steps: 9000 }]);

    const written = await upsertDailySteps([{ logDate: '2026-07-28', steps: 300 }]);

    expect(written).toBe(0);
    expect(patch).not.toHaveBeenCalled();
    expect(insertWithSyncFields).not.toHaveBeenCalled();
  });

  it('recrée un jour dont la ligne a été supprimée, sans la patcher', async () => {
    local([{ id: 'row-1', log_date: '2026-07-28', steps: 9000, deleted_at: '2026-07-28T09:00:00Z' }]);

    await upsertDailySteps([{ logDate: '2026-07-28', steps: 4000 }]);

    expect(insertWithSyncFields).toHaveBeenCalledTimes(1);
    expect(patch).not.toHaveBeenCalled();
  });

  it('ne touche ni la base ni la session sur un lot vide', async () => {
    const written = await upsertDailySteps([]);

    expect(written).toBe(0);
    expect(getAll).not.toHaveBeenCalled();
    expect(insertWithSyncFields).not.toHaveBeenCalled();
  });
});
