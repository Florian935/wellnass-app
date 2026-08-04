/**
 * US MUSCPWR-01 — module force, sur **du vrai SQLite** (harness, niveau 2).
 *
 * Le test qui compte le plus ici est le **premier** : `sbd_lifts` s'écrit et se relit.
 *
 * Ce n'est pas une précaution théorique. Deux colonnes ont déjà été ajoutées côté Supabase et dans
 * le code **sans être déclarées** dans le schéma PowerSync local — `cycle_tracking_enabled`
 * (CYCLE-01, constaté en recette device le 31/07/2026 : le suivi était *impossible à activer*) et
 * `daily_step_goal` (PAS-01, constaté le 03/08). Dans les deux cas l'écriture échouait, l'erreur
 * était avalée, et **aucun message n'apparaissait** : le réglage refusait simplement de s'enregistrer.
 * Un test d'écriture-relecture est le seul garde-fou contre cette classe de panne.
 *
 * Le reste vérifie les requêtes de lecture, dont la plus subtile : résoudre le nom d'un exercice
 * **archivé** (règle R12), sans quoi un mouvement désigné disparaîtrait de l'écran et le total
 * baisserait sans explication.
 */

import {
  SELECT_BODYWEIGHTS,
  SELECT_DESIGNATED_EXERCISES,
  SELECT_ESTIMATED_1RM,
  setSbdLift,
} from '../strength-repository';
import { updateSettings } from '../settings-repository';
import { resetTestDb, rowsOf, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

const SQUAT = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const BENCH = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const DEAD = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';

type SettingsRow = { user_id: string; sbd_lifts: string | null };

beforeEach(() => {
  resetTestDb();
});

// ---------------------------------------------------------------------------
// L'écriture — la classe de panne qui s'est déjà produite deux fois
// ---------------------------------------------------------------------------

describe('sbd_lifts — écriture et relecture', () => {
  it('s’écrit réellement en base et se relit', async () => {
    seed('user_settings', [{ user_id: 'user-1', theme: 'system', units: 'metric', language: 'fr' }]);

    await setSbdLift('squat', SQUAT, { squat: null, bench: null, deadlift: null });

    const [row] = rowsOf<SettingsRow>('user_settings');
    expect(row!.sbd_lifts).not.toBeNull();
    expect(JSON.parse(row!.sbd_lifts!)).toEqual({ squat: SQUAT, bench: null, deadlift: null });
  });

  it('écrit l’objet COMPLET : désigner un mouvement n’efface pas les autres', () => {
    // `sbd_lifts` est une colonne JSON : un patch partiel écraserait les deux autres mouvements.
    // C'est le piège de toute colonne JSON, et il ne se voit qu'à la relecture.
    seed('user_settings', [{ user_id: 'user-1', theme: 'system', units: 'metric', language: 'fr' }]);

    return (async () => {
      await setSbdLift('squat', SQUAT, { squat: null, bench: null, deadlift: null });
      await setSbdLift('bench', BENCH, { squat: SQUAT, bench: null, deadlift: null });
      await setSbdLift('deadlift', DEAD, { squat: SQUAT, bench: BENCH, deadlift: null });

      const [row] = rowsOf<SettingsRow>('user_settings');
      expect(JSON.parse(row!.sbd_lifts!)).toEqual({
        squat: SQUAT,
        bench: BENCH,
        deadlift: DEAD,
      });
    })();
  });

  it('permet de retirer une désignation (null)', async () => {
    seed('user_settings', [{ user_id: 'user-1', theme: 'system', units: 'metric', language: 'fr' }]);

    await setSbdLift('squat', null, { squat: SQUAT, bench: BENCH, deadlift: DEAD });

    const [row] = rowsOf<SettingsRow>('user_settings');
    expect(JSON.parse(row!.sbd_lifts!).squat).toBeNull();
    // Les deux autres survivent.
    expect(JSON.parse(row!.sbd_lifts!).bench).toBe(BENCH);
  });

  it('crée la ligne de réglages si elle n’existe pas encore', async () => {
    // Compte neuf : `updateSettings` insère la ligne avec les défauts (il fait l'upsert), il ne
    // doit pas échouer en silence — c'est le parcours d'un utilisateur qui découvre le module.
    await updateSettings({ sbdLifts: { squat: SQUAT, bench: null, deadlift: null } });

    const rows = rowsOf<SettingsRow>('user_settings');
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0]!.sbd_lifts!).squat).toBe(SQUAT);
  });
});

// ---------------------------------------------------------------------------
// Lectures
// ---------------------------------------------------------------------------

describe('SELECT_ESTIMATED_1RM', () => {
  const seedRecord = (over: Record<string, unknown>) =>
    seed('personal_records', [
      {
        user_id: 'user-1',
        exercise_id: SQUAT,
        type: 'estimated_1rm',
        value: 180,
        achieved_at: '2026-01-10T10:00:00.000Z',
        ...over,
      },
    ]);

  it('ne retient que les 1RM estimés, vivants, de l’utilisateur', async () => {
    seedRecord({});
    seedRecord({ type: 'max_weight', value: 999 });
    seedRecord({ type: 'best_volume', value: 5000 });
    seedRecord({ value: 500, deleted_at: '2026-02-01T00:00:00.000Z' });
    seedRecord({ user_id: 'user-2', value: 400 });

    const rows = await testPowerSync.getAll<{ value: number }>(SELECT_ESTIMATED_1RM, ['user-1']);
    expect(rows.map((r) => r.value)).toEqual([180]);
  });

  it('ordonne par date croissante', async () => {
    seedRecord({ value: 190, achieved_at: '2026-03-10T10:00:00.000Z' });
    seedRecord({ value: 180, achieved_at: '2026-01-10T10:00:00.000Z' });

    const rows = await testPowerSync.getAll<{ value: number }>(SELECT_ESTIMATED_1RM, ['user-1']);
    expect(rows.map((r) => r.value)).toEqual([180, 190]);
  });
});

describe('SELECT_DESIGNATED_EXERCISES (R12)', () => {
  const seedExercise = (id: string, name: string, deletedAt: string | null = null) => {
    seed('exercises', [
      { id, owner_id: null, source: 'library', muscle_primary: 'legs', deleted_at: deletedAt },
    ]);
    seed('exercise_translations', [{ exercise_id: id, lang: 'fr', name }]);
  };

  it('résout le libellé d’un exercice ARCHIVÉ, avec son drapeau', async () => {
    // Sans ça, un mouvement désigné puis archivé disparaîtrait de l'écran et le total baisserait
    // sans explication. Il doit au contraire être signalé « à re-désigner ».
    seedExercise(SQUAT, 'Squat');
    seedExercise(BENCH, 'Développé couché', '2026-07-01T00:00:00.000Z');

    const rows = await testPowerSync.getAll<{ id: string; name: string; deleted_at: string | null }>(
      SELECT_DESIGNATED_EXERCISES,
      ['fr', SQUAT, BENCH, DEAD],
    );

    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(SQUAT)?.name).toBe('Squat');
    expect(byId.get(BENCH)?.name).toBe('Développé couché');
    expect(byId.get(BENCH)?.deleted_at).not.toBeNull();
  });

  it('retombe sur le libellé FR quand la langue demandée manque', async () => {
    seedExercise(SQUAT, 'Squat');

    const rows = await testPowerSync.getAll<{ name: string }>(SELECT_DESIGNATED_EXERCISES, [
      'en',
      SQUAT,
      BENCH,
      DEAD,
    ]);
    expect(rows[0]!.name).toBe('Squat');
  });

  it('ne rend rien pour un mouvement non désigné (chaîne vide)', async () => {
    seedExercise(SQUAT, 'Squat');

    const rows = await testPowerSync.getAll(SELECT_DESIGNATED_EXERCISES, ['fr', SQUAT, '', '']);
    expect(rows).toHaveLength(1);
  });
});

describe('SELECT_BODYWEIGHTS', () => {
  it('rend les pesées vivantes de l’utilisateur, du plus ancien au plus récent', async () => {
    seed('body_weight_entries', [
      { user_id: 'user-1', log_date: '2026-07-28', weight_kg: 82.4 },
      { user_id: 'user-1', log_date: '2026-01-10', weight_kg: 75 },
      { user_id: 'user-1', log_date: '2026-04-15', weight_kg: 79, deleted_at: '2026-05-01' },
      { user_id: 'user-2', log_date: '2026-02-02', weight_kg: 99 },
    ]);

    const rows = await testPowerSync.getAll<{ log_date: string; weight_kg: number }>(
      SELECT_BODYWEIGHTS,
      ['user-1'],
    );
    expect(rows.map((r) => r.weight_kg)).toEqual([75, 82.4]);
  });
});
