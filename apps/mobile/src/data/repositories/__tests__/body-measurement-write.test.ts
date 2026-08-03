/**
 * US MESUR-01 — écritures du repository des mensurations, sur **du vrai SQLite**.
 *
 * Les **règles** (bornes, séries, deltas) sont couvertes par `measurements.ts` dans
 * `@wellness/shared` ; ce qui est testé ici est la **plomberie** du modèle normalisé : une saisie
 * touche une ligne par `(jour, mesure)`, et **seulement** celles fournies. Le scénario qui compte :
 * vider un champ retire cette mesure sans toucher les autres du même jour (critère de recette 4).
 *
 * Réécrit le 03/08/2026 pour passer par le harness SQLite au lieu de mocker `_sql` : la version
 * précédente vérifiait qu'on **appelait** `softDelete`, pas que la bonne ligne — et elle seule —
 * disparaissait effectivement. C'est justement le critère de recette qui compte ici.
 */

import { saveMeasurements } from '../body-measurement-repository';
import { resetTestDb, rowsOf, seed } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

type MeasurementRow = {
  id: string;
  user_id: string;
  log_date: string;
  kind: string;
  value_cm: number;
};

const measurements = (includeDeleted = false) =>
  rowsOf<MeasurementRow>('body_measurements', includeDeleted).sort((a, b) =>
    a.kind.localeCompare(b.kind),
  );

/** Mesure d'un jour donné, ou `undefined` si elle n'existe pas (ou plus). */
const measure = (kind: string, logDate: string) =>
  measurements().find((m) => m.kind === kind && m.log_date === logDate);

function dayKeyAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const today = () => dayKeyAgo(0);

beforeEach(() => {
  resetTestDb();
});

describe('saveMeasurements', () => {
  it('insère une ligne par mesure fournie, avec le propriétaire et la valeur en cm', async () => {
    const written = await saveMeasurements(today(), { waist: 82, arm: 35.5 });

    expect(written).toBe(2);
    expect(measurements()).toHaveLength(2);
    expect(measure('waist', today())).toMatchObject({ user_id: 'user-1', value_cm: 82 });
    expect(measure('arm', today())).toMatchObject({ user_id: 'user-1', value_cm: 35.5 });
  });

  it('ne touche QUE les mesures fournies — les autres du jour sont laissées telles quelles', async () => {
    await saveMeasurements(today(), { waist: 82, arm: 35.5 });

    await saveMeasurements(today(), { waist: 81 });

    expect(measure('waist', today())?.value_cm).toBe(81);
    expect(measure('arm', today())?.value_cm).toBe(35.5);
  });

  it('MET À JOUR la ligne existante d’un (jour, mesure) au lieu de créer un doublon', async () => {
    await saveMeasurements(today(), { waist: 82 });

    const written = await saveMeasurements(today(), { waist: 81.5 });

    expect(written).toBe(1);
    expect(measurements()).toHaveLength(1);
    expect(measure('waist', today())?.value_cm).toBe(81.5);
  });

  it('retire la mesure du jour quand le champ est vidé (null), et elle seule', async () => {
    await saveMeasurements(today(), { waist: 82, arm: 35.5 });

    const written = await saveMeasurements(today(), { arm: null });

    expect(written).toBe(1);
    expect(measure('arm', today())).toBeUndefined();
    expect(measure('waist', today())?.value_cm).toBe(82);
    // Soft delete : la ligne subsiste, marquée supprimée.
    expect(measurements(true)).toHaveLength(2);
  });

  it('ne touche pas la même mesure d’un AUTRE jour quand on en vide une', async () => {
    await saveMeasurements(dayKeyAgo(7), { waist: 84 });
    await saveMeasurements(today(), { waist: 82 });

    await saveMeasurements(today(), { waist: null });

    expect(measure('waist', today())).toBeUndefined();
    expect(measure('waist', dayKeyAgo(7))?.value_cm).toBe(84);
  });

  it('ne fait rien si on vide une mesure qui n’existait pas pour ce jour', async () => {
    const written = await saveMeasurements(today(), { calf: null });

    expect(written).toBe(0);
    expect(measurements(true)).toHaveLength(0);
  });

  it('recrée une mesure précédemment retirée', async () => {
    await saveMeasurements(today(), { waist: 82 });
    await saveMeasurements(today(), { waist: null });

    await saveMeasurements(today(), { waist: 80 });

    expect(measure('waist', today())?.value_cm).toBe(80);
    expect(measurements()).toHaveLength(1);
  });

  it('ignore une ligne supprimée lors de la mise à jour — pas de résurrection', async () => {
    seed('body_measurements', [
      {
        user_id: 'user-1',
        log_date: today(),
        kind: 'waist',
        value_cm: 999,
        deleted_at: new Date().toISOString(),
      },
    ]);

    await saveMeasurements(today(), { waist: 82 });

    expect(measure('waist', today())?.value_cm).toBe(82);
    expect(measurements()).toHaveLength(1);
  });

  it('accepte une date passée — pas de fenêtre de rattrapage (décision D4)', async () => {
    // Divergence assumée avec BIEN-01 : une mensuration est une mesure objective, qu'on saisit
    // légitimement en retard depuis une note.
    await saveMeasurements(dayKeyAgo(120), { waist: 84 });

    expect(measure('waist', dayKeyAgo(120))?.value_cm).toBe(84);
  });

  it('refuse une date future et une valeur implausible, en levant', async () => {
    await expect(saveMeasurements(dayKeyAgo(-1), { waist: 82 })).rejects.toThrow(/futur/);
    // 820 = virgule oubliée.
    await expect(saveMeasurements(today(), { waist: 820 })).rejects.toThrow(/implausible/);
    await expect(saveMeasurements(today(), { waist: 0 })).rejects.toThrow(/implausible/);

    expect(measurements(true)).toHaveLength(0);
  });

  it('refuse une date illisible plutôt que de l’écrire', async () => {
    await expect(saveMeasurements('12/07/2026', { waist: 82 })).rejects.toThrow(/illisible/);

    expect(measurements(true)).toHaveLength(0);
  });
});
