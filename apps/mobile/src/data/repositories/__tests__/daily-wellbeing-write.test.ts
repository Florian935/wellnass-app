/**
 * US BIEN-01 — écritures du repository du check-in de bien-être.
 *
 * Les **règles** (échelle valide, check-in vide, fenêtre de rattrapage) sont déjà couvertes par
 * `wellbeing.ts` dans `@wellness/shared` ; ce qui est testé ici est la **plomberie** : les bonnes
 * colonnes à l'insertion, le bon `id` au patch, le refus d'un check-in vide, et surtout le fait
 * qu'un second enregistrement le même jour **met à jour** au lieu de créer un doublon — le scénario
 * que la spec veut voir en recette (critère 2), vérifié ici sans device.
 */

import { saveWellbeing } from '../daily-wellbeing-repository';
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

const getOptional = powerSync.getOptional as jest.Mock;

/** Clé du jour courant, calculée comme le repository (localDayKey sur maintenant). */
function todayKey(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Jour à J-n, dans le même référentiel local. */
function dayKeyAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

describe('saveWellbeing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getOptional.mockResolvedValue(null);
  });

  it('insère un check-in complet avec le propriétaire et les 3 indicateurs', async () => {
    const written = await saveWellbeing(todayKey(), { mood: 4, energy: 3, stress: 1 });

    expect(written).toBe(true);
    expect(insertWithSyncFields).toHaveBeenCalledWith('daily_wellbeing', {
      user_id: 'user-1',
      log_date: todayKey(),
      mood: 4,
      energy: 3,
      stress: 1,
    });
    expect(patch).not.toHaveBeenCalled();
  });

  it('accepte un check-in partiel : les indicateurs absents partent à null (décision D3)', async () => {
    await saveWellbeing(todayKey(), { energy: 3 });

    expect(insertWithSyncFields).toHaveBeenCalledWith('daily_wellbeing', {
      user_id: 'user-1',
      log_date: todayKey(),
      mood: null,
      energy: 3,
      stress: null,
    });
  });

  it('MET À JOUR la ligne du jour au lieu de créer un doublon', async () => {
    getOptional.mockResolvedValue({ id: 'row-1' });

    const written = await saveWellbeing(todayKey(), { mood: 5, energy: 4, stress: 2 });

    expect(written).toBe(true);
    expect(patch).toHaveBeenCalledWith('daily_wellbeing', 'row-1', {
      mood: 5,
      energy: 4,
      stress: 2,
    });
    expect(insertWithSyncFields).not.toHaveBeenCalled();
  });

  it('n’écrit rien pour un check-in vide plutôt que de créer une ligne inutile', async () => {
    const written = await saveWellbeing(todayKey(), {});

    expect(written).toBe(false);
    expect(insertWithSyncFields).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it('traite une valeur hors échelle comme absente, et refuse donc le check-in', async () => {
    const written = await saveWellbeing(todayKey(), { mood: 9 });

    expect(written).toBe(false);
    expect(insertWithSyncFields).not.toHaveBeenCalled();
  });

  it('accepte le rattrapage jusqu’à J-6', async () => {
    await saveWellbeing(dayKeyAgo(6), { mood: 3 });
    expect(insertWithSyncFields).toHaveBeenCalled();
  });

  it('refuse J-7 et le futur, en levant plutôt qu’en échouant en silence', async () => {
    await expect(saveWellbeing(dayKeyAgo(7), { mood: 3 })).rejects.toThrow(/hors fenêtre/);
    await expect(saveWellbeing(dayKeyAgo(-1), { mood: 3 })).rejects.toThrow(/hors fenêtre/);
    expect(insertWithSyncFields).not.toHaveBeenCalled();
  });
});
