/**
 * US MESUR-01 — écritures du repository des mensurations.
 *
 * Les **règles** (bornes, séries, deltas) sont couvertes par `measurements.ts` dans
 * `@wellness/shared` ; ce qui est testé ici est la **plomberie** du modèle normalisé : une saisie
 * touche une ligne par `(jour, mesure)`, et **seulement** celles fournies. Le scénario qui compte :
 * vider un champ retire cette mesure sans toucher les autres du même jour (critère de recette 4).
 */

import { saveMeasurements } from '../body-measurement-repository';
import { insertWithSyncFields, patch, softDelete } from '../_sql';
import { powerSync } from '@/powersync/system';

jest.mock('@/powersync/system', () => ({
  powerSync: { getAll: jest.fn(), getOptional: jest.fn() },
}));

jest.mock('../_sql', () => ({
  insertWithSyncFields: jest.fn(async () => 'new-id'),
  patch: jest.fn(async () => undefined),
  softDelete: jest.fn(async () => undefined),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

const getOptional = powerSync.getOptional as jest.Mock;

function dayKeyAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const today = () => dayKeyAgo(0);

describe('saveMeasurements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getOptional.mockResolvedValue(null);
  });

  it('insère une ligne par mesure fournie, avec le propriétaire et la valeur en cm', async () => {
    const written = await saveMeasurements(today(), { waist: 82, arm: 35.5 });

    expect(written).toBe(2);
    expect(insertWithSyncFields).toHaveBeenCalledTimes(2);
    expect(insertWithSyncFields).toHaveBeenCalledWith('body_measurements', {
      user_id: 'user-1',
      log_date: today(),
      kind: 'waist',
      value_cm: 82,
    });
    expect(insertWithSyncFields).toHaveBeenCalledWith('body_measurements', {
      user_id: 'user-1',
      log_date: today(),
      kind: 'arm',
      value_cm: 35.5,
    });
  });

  it('ne touche QUE les mesures fournies — les autres du jour sont laissées telles quelles', async () => {
    await saveMeasurements(today(), { waist: 82 });

    expect(insertWithSyncFields).toHaveBeenCalledTimes(1);
    expect(softDelete).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it('MET À JOUR la ligne existante d’un (jour, mesure) au lieu de créer un doublon', async () => {
    getOptional.mockResolvedValue({ id: 'row-waist' });

    const written = await saveMeasurements(today(), { waist: 81.5 });

    expect(written).toBe(1);
    expect(patch).toHaveBeenCalledWith('body_measurements', 'row-waist', { value_cm: 81.5 });
    expect(insertWithSyncFields).not.toHaveBeenCalled();
  });

  it('retire la mesure du jour quand le champ est vidé (null), et elle seule', async () => {
    getOptional.mockResolvedValue({ id: 'row-arm' });

    const written = await saveMeasurements(today(), { arm: null });

    expect(written).toBe(1);
    expect(softDelete).toHaveBeenCalledWith('body_measurements', 'row-arm');
    expect(patch).not.toHaveBeenCalled();
    expect(insertWithSyncFields).not.toHaveBeenCalled();
  });

  it('ne fait rien si on vide une mesure qui n’existait pas pour ce jour', async () => {
    getOptional.mockResolvedValue(null);

    const written = await saveMeasurements(today(), { calf: null });

    expect(written).toBe(0);
    expect(softDelete).not.toHaveBeenCalled();
  });

  it('accepte une date passée — pas de fenêtre de rattrapage (décision D4)', async () => {
    // Divergence assumée avec BIEN-01 : une mensuration est une mesure objective, qu'on saisit
    // légitimement en retard depuis une note.
    await saveMeasurements(dayKeyAgo(120), { waist: 84 });
    expect(insertWithSyncFields).toHaveBeenCalled();
  });

  it('refuse une date future et une valeur implausible, en levant', async () => {
    await expect(saveMeasurements(dayKeyAgo(-1), { waist: 82 })).rejects.toThrow(/futur/);
    // 820 = virgule oubliée.
    await expect(saveMeasurements(today(), { waist: 820 })).rejects.toThrow(/implausible/);
    await expect(saveMeasurements(today(), { waist: 0 })).rejects.toThrow(/implausible/);
    expect(insertWithSyncFields).not.toHaveBeenCalled();
  });

  it('refuse une date illisible plutôt que de l’écrire', async () => {
    await expect(saveMeasurements('12/07/2026', { waist: 82 })).rejects.toThrow(/illisible/);
  });
});
