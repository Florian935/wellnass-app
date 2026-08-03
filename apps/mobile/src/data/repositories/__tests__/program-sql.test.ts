/**
 * Programmes — duplication, activation et suppression, sur **du vrai SQLite**.
 *
 * Lot 2 de [strategie-tests.md](../../../../../../docs/specs/technical/strategie-tests.md).
 * Trois opérations à fort risque de perte silencieuse de données :
 *
 *  - **`duplicateProgram`** copie 5 tables en remappant les `session_id`. Un oubli ne plante pas :
 *    il produit un programme qui a l'air correct mais dont les exercices (ou les blocs fractionné)
 *    ont disparu. Le cas s'est déjà produit — la cascade des blocs a été ajoutée en cours d'US
 *    RUN-F2c, trouvée en lisant le code, pas en recette.
 *  - **`activateProgram`** doit garantir **un seul actif par pilier** et refuser d'activer un
 *    programme non possédé (un éditorial activé en local est rejeté par la RLS au sync, ce qui
 *    donne une divergence local↔cloud invisible sur l'appareil).
 *  - **`deleteProgram`** doit désactiver **avant** de soft-deleter, sans quoi une ligne supprimée
 *    resterait `is_active = 1`.
 *
 * Aucun de ces trois défauts ne se voit sur un téléphone de recette : il faudrait inspecter la base.
 */

import {
  activateProgram,
  deleteProgram,
  duplicateProgram,
  removeSession,
  updateProgramTranslation,
} from '../program-repository';
import { resetTestDb, rowsOf, seed } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: { t: (k: string) => k },
  getAppLanguage: () => 'fr',
}));

// ---------------------------------------------------------------------------
// Types et aides
// ---------------------------------------------------------------------------

type ProgramRow = {
  id: string;
  owner_id: string | null;
  pillar: string;
  status: string;
  is_active: number;
  level: string | null;
  goal: string | null;
  duration_weeks: number | null;
};

type SessionRow = {
  id: string;
  program_id: string;
  owner_id: string | null;
  order_index: number;
  name: string | null;
  session_type: string | null;
};

type PlanRow = {
  id: string;
  session_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number | null;
  target_reps: string | null;
};

type IntervalRow = { id: string; session_id: string; reps: number; fast_distance_m: number | null };

type TranslationRow = { id: string; program_id: string; lang: string; name: string };

const programs = (d = false) => rowsOf<ProgramRow>('programs', d);
const sessions = (d = false) => rowsOf<SessionRow>('sessions', d);
const plans = (d = false) => rowsOf<PlanRow>('exercise_plans', d);
const intervals = (d = false) => rowsOf<IntervalRow>('session_intervals', d);
const translations = (d = false) => rowsOf<TranslationRow>('program_translations', d);

const program = (id: string) => programs().find((p) => p.id === id);
const sessionsOf = (programId: string) =>
  sessions()
    .filter((s) => s.program_id === programId)
    .sort((a, b) => a.order_index - b.order_index);
const plansOf = (sessionId: string) =>
  plans()
    .filter((p) => p.session_id === sessionId)
    .sort((a, b) => a.order_index - b.order_index);

/** Un programme complet : entête, traductions, séances, plans, blocs fractionné. */
function seedProgram(opts?: {
  ownerId?: string | null;
  pillar?: string;
  isActive?: boolean;
  withIntervals?: boolean;
}): string {
  const [programId] = seed('programs', [
    {
      owner_id: opts?.ownerId === undefined ? 'user-1' : opts.ownerId,
      pillar: opts?.pillar ?? 'strength',
      status: 'published',
      is_active: opts?.isActive ? 1 : 0,
      level: 'intermediate',
      goal: 'hypertrophy',
      duration_weeks: 8,
    },
  ]);
  seed('program_translations', [
    { program_id: programId, owner_id: opts?.ownerId ?? 'user-1', lang: 'fr', name: 'Full body' },
    { program_id: programId, owner_id: opts?.ownerId ?? 'user-1', lang: 'en', name: 'Full body EN' },
  ]);

  const [sessionA, sessionB] = seed('sessions', [
    { program_id: programId, owner_id: 'user-1', order_index: 0, name: 'Séance A' },
    { program_id: programId, owner_id: 'user-1', order_index: 1, name: 'Séance B' },
  ]);

  seed('exercise_plans', [
    {
      session_id: sessionA,
      owner_id: 'user-1',
      exercise_id: 'squat',
      order_index: 0,
      set_type: 'normal',
      target_sets: 4,
      target_reps: '8-12',
      target_weight_kg: 80,
      rest_seconds: 120,
    },
    {
      session_id: sessionA,
      owner_id: 'user-1',
      exercise_id: 'bench',
      order_index: 1,
      set_type: 'normal',
      target_sets: 3,
      target_reps: '10',
    },
    {
      session_id: sessionB,
      owner_id: 'user-1',
      exercise_id: 'row',
      order_index: 0,
      set_type: 'normal',
      target_sets: 5,
      target_reps: '5',
    },
  ]);

  if (opts?.withIntervals) {
    seed('session_intervals', [
      {
        session_id: sessionB,
        owner_id: 'user-1',
        order_index: 0,
        reps: 8,
        fast_distance_m: 400,
        recovery_duration_seconds: 90,
      },
    ]);
  }

  return programId!;
}

beforeEach(() => {
  resetTestDb();
});

// ---------------------------------------------------------------------------
// duplicateProgram
// ---------------------------------------------------------------------------

describe('duplicateProgram', () => {
  it('crée un programme possédé, publié et inactif, sans toucher la source', async () => {
    const sourceId = seedProgram({ ownerId: null, isActive: false });

    const copyId = await duplicateProgram(sourceId);

    expect(copyId).not.toBe(sourceId);
    expect(program(copyId)).toMatchObject({
      owner_id: 'user-1',
      status: 'published',
      is_active: 0,
      pillar: 'strength',
      level: 'intermediate',
      goal: 'hypertrophy',
      duration_weeks: 8,
    });
    expect(program(sourceId)?.owner_id).toBeNull();
  });

  it('copie toutes les traductions', async () => {
    const sourceId = seedProgram();

    const copyId = await duplicateProgram(sourceId);

    const copied = translations().filter((t) => t.program_id === copyId);
    expect(copied.map((t) => t.lang).sort()).toEqual(['en', 'fr']);
    expect(copied.find((t) => t.lang === 'fr')?.name).toBe('Full body');
  });

  it('copie les séances dans l’ordre, avec de nouveaux identifiants', async () => {
    const sourceId = seedProgram();

    const copyId = await duplicateProgram(sourceId);

    const copied = sessionsOf(copyId);
    expect(copied.map((s) => s.name)).toEqual(['Séance A', 'Séance B']);
    const sourceIds = sessionsOf(sourceId).map((s) => s.id);
    expect(copied.every((s) => !sourceIds.includes(s.id))).toBe(true);
  });

  it('remappe les plans d’exercice sur les NOUVELLES séances', async () => {
    const sourceId = seedProgram();

    const copyId = await duplicateProgram(sourceId);

    const [copyA, copyB] = sessionsOf(copyId);
    expect(plansOf(copyA!.id).map((p) => p.exercise_id)).toEqual(['squat', 'bench']);
    expect(plansOf(copyB!.id).map((p) => p.exercise_id)).toEqual(['row']);
    // Rien ne doit rester accroché aux séances de la source.
    expect(plans()).toHaveLength(6);
  });

  it('conserve les cibles de chaque plan', async () => {
    const sourceId = seedProgram();

    const copyId = await duplicateProgram(sourceId);

    const first = plansOf(sessionsOf(copyId)[0]!.id)[0];
    expect(first).toMatchObject({ target_sets: 4, target_reps: '8-12' });
  });

  it('copie les blocs fractionné en les remappant (US RUN-F2c)', async () => {
    const sourceId = seedProgram({ pillar: 'running', withIntervals: true });

    const copyId = await duplicateProgram(sourceId);

    const copyB = sessionsOf(copyId)[1]!;
    const copied = intervals().filter((b) => b.session_id === copyB.id);
    expect(copied).toEqual([
      expect.objectContaining({ reps: 8, fast_distance_m: 400 }),
    ]);
  });

  it('ne recopie ni séance, ni plan, ni traduction supprimés', async () => {
    const sourceId = seedProgram();
    const sessionB = sessionsOf(sourceId)[1]!;
    seed('sessions', [
      {
        program_id: sourceId,
        owner_id: 'user-1',
        order_index: 2,
        name: 'Séance supprimée',
        deleted_at: new Date().toISOString(),
      },
    ]);
    seed('program_translations', [
      {
        program_id: sourceId,
        owner_id: 'user-1',
        lang: 'es',
        name: 'Supprimée',
        deleted_at: new Date().toISOString(),
      },
    ]);
    await removeSession(sessionB.id); // supprime la séance B et ses plans

    const copyId = await duplicateProgram(sourceId);

    expect(sessionsOf(copyId).map((s) => s.name)).toEqual(['Séance A']);
    expect(translations().filter((t) => t.program_id === copyId).map((t) => t.lang).sort()).toEqual(
      ['en', 'fr'],
    );
  });

  it('refuse une source introuvable sans rien écrire', async () => {
    await expect(duplicateProgram('inconnu')).rejects.toThrow(/introuvable/);

    expect(programs(true)).toHaveLength(0);
    expect(sessions(true)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// activateProgram
// ---------------------------------------------------------------------------

describe('activateProgram', () => {
  it('active la cible et éteint l’ancien actif du même pilier', async () => {
    const previous = seedProgram({ isActive: true });
    const next = seedProgram();

    await activateProgram(next);

    expect(program(previous)?.is_active).toBe(0);
    expect(program(next)?.is_active).toBe(1);
  });

  it('laisse actif le programme d’un autre pilier', async () => {
    const running = seedProgram({ pillar: 'running', isActive: true });
    const strength = seedProgram({ pillar: 'strength' });

    await activateProgram(strength);

    expect(program(running)?.is_active).toBe(1);
  });

  it('n’active PAS un programme éditorial — il doit d’abord être dupliqué', async () => {
    const editorial = seedProgram({ ownerId: null });

    await activateProgram(editorial);

    // Sans le filtre owner, `is_active = 1` serait écrit en local puis rejeté par la RLS au
    // sync : divergence local↔cloud qu'aucun écran ne montre.
    expect(program(editorial)?.is_active).toBe(0);
  });

  it('n’active pas non plus le programme d’un autre utilisateur', async () => {
    const foreign = seedProgram({ ownerId: 'user-2' });

    await activateProgram(foreign);

    expect(program(foreign)?.is_active).toBe(0);
  });

  it('refuse un programme introuvable ou supprimé', async () => {
    await expect(activateProgram('inconnu')).rejects.toThrow(/introuvable/);

    const deleted = seedProgram();
    await deleteProgram(deleted);
    await expect(activateProgram(deleted)).rejects.toThrow(/introuvable/);
  });

  it('est idempotente sur un programme déjà actif', async () => {
    const id = seedProgram({ isActive: true });

    await activateProgram(id);

    expect(program(id)?.is_active).toBe(1);
    expect(programs().filter((p) => p.is_active === 1)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// deleteProgram
// ---------------------------------------------------------------------------

describe('deleteProgram', () => {
  it('désactive AVANT de supprimer — aucune ligne supprimée ne reste active', async () => {
    const id = seedProgram({ isActive: true });

    await deleteProgram(id);

    expect(programs()).toHaveLength(0);
    const removed = programs(true).find((p) => p.id === id);
    expect(removed).toMatchObject({ is_active: 0 });
  });

  it('cascade sur séances, plans et traductions', async () => {
    const id = seedProgram();

    await deleteProgram(id);

    expect(sessions()).toHaveLength(0);
    expect(plans()).toHaveLength(0);
    expect(translations()).toHaveLength(0);
    // Soft delete : tout subsiste, marqué supprimé.
    expect(sessions(true)).toHaveLength(2);
    expect(plans(true)).toHaveLength(3);
  });

  it('cascade sur le planning de l’owner', async () => {
    const id = seedProgram();
    seed('planned_sessions', [
      {
        owner_id: 'user-1',
        program_id: id,
        session_id: sessionsOf(id)[0]!.id,
        scheduled_date: '2026-08-03',
        status: 'planned',
      },
    ]);

    await deleteProgram(id);

    expect(rowsOf('planned_sessions')).toHaveLength(0);
  });

  it('ne touche pas un autre programme', async () => {
    const target = seedProgram();
    const other = seedProgram();

    await deleteProgram(target);

    expect(program(other)).toBeDefined();
    expect(sessionsOf(other)).toHaveLength(2);
  });

  it('est idempotente', async () => {
    const id = seedProgram();
    await deleteProgram(id);

    await expect(deleteProgram(id)).resolves.toBeUndefined();

    expect(programs(true).filter((p) => p.id === id)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// removeSession
// ---------------------------------------------------------------------------

describe('removeSession', () => {
  it('cascade sur les plans, les blocs fractionné et le planning', async () => {
    const id = seedProgram({ withIntervals: true });
    const sessionB = sessionsOf(id)[1]!;
    seed('planned_sessions', [
      {
        owner_id: 'user-1',
        program_id: id,
        session_id: sessionB.id,
        scheduled_date: '2026-08-03',
        status: 'planned',
      },
    ]);

    await removeSession(sessionB.id);

    expect(sessionsOf(id).map((s) => s.name)).toEqual(['Séance A']);
    expect(plansOf(sessionB.id)).toHaveLength(0);
    expect(intervals()).toHaveLength(0);
    expect(rowsOf('planned_sessions')).toHaveLength(0);
  });

  it('laisse intactes les autres séances du programme', async () => {
    const id = seedProgram();
    const sessionA = sessionsOf(id)[0]!;

    await removeSession(sessionsOf(id)[1]!.id);

    expect(plansOf(sessionA.id)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// updateProgramTranslation
// ---------------------------------------------------------------------------

describe('updateProgramTranslation', () => {
  it('met à jour la traduction existante de la langue courante, sans toucher l’autre', async () => {
    const id = seedProgram();

    await updateProgramTranslation(id, { name: 'Full body v2' });

    const forProgram = translations().filter((t) => t.program_id === id);
    expect(forProgram.find((t) => t.lang === 'fr')?.name).toBe('Full body v2');
    expect(forProgram.find((t) => t.lang === 'en')?.name).toBe('Full body EN');
  });

  it('crée la ligne quand la langue n’a pas encore de traduction', async () => {
    const [id] = seed('programs', [
      { owner_id: 'user-1', pillar: 'strength', status: 'published', is_active: 0 },
    ]);

    await updateProgramTranslation(id!, { name: 'Nouveau' });

    expect(translations().filter((t) => t.program_id === id)).toEqual([
      expect.objectContaining({ lang: 'fr', name: 'Nouveau' }),
    ]);
  });

  it('ne ressuscite pas une traduction supprimée : elle en crée une neuve', async () => {
    const [id] = seed('programs', [
      { owner_id: 'user-1', pillar: 'strength', status: 'published', is_active: 0 },
    ]);
    seed('program_translations', [
      {
        program_id: id,
        owner_id: 'user-1',
        lang: 'fr',
        name: 'Ancien',
        deleted_at: new Date().toISOString(),
      },
    ]);

    await updateProgramTranslation(id!, { name: 'Nouveau' });

    expect(translations().filter((t) => t.program_id === id)).toHaveLength(1);
    expect(translations()[0]?.name).toBe('Nouveau');
  });
});
