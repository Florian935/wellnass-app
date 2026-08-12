/**
 * US HORAIRE-01 — heure d'une séance planifiée, sur **du vrai SQLite**.
 *
 * Deux choses sont vérifiées ici, et la première est le **risque n° 1 de l'US**.
 *
 *  1. 🔴 **L'écriture-relecture de `scheduled_time`.** Une colonne absente du schéma PowerSync
 *     client fait échouer l'écriture **sans message** : l'appelant `void`-avale l'erreur et l'heure
 *     ne se pose jamais. C'est la panne exacte de CYCLE-01 (recette du 31/07/2026), reproduite
 *     depuis par `sbd_lifts`, `pain_journal_enabled` et `session_conflicts_enabled` — d'où la
 *     checklist du registre de migrations : déclarer la colonne **et** la couvrir par un
 *     écrire-puis-relire. Ce test est ce filet.
 *
 *  2. **Les filtres de la requête de rappel**, qui doivent être **exactement** ceux de
 *     `SELECT_HAS_PLANNED_STRENGTH_TODAY` : `status = 'planned'` strictement, pilier muscu, non
 *     supprimée. Deux conventions de « séance du jour à faire » dans le même fichier finiraient par
 *     diverger, et le rappel se calerait sur une séance que l'autre requête ne voit pas.
 */

import {
  SELECT_PLANNED_STRENGTH_TIMES_TODAY,
  setPlannedSessionTime,
} from '../planned-session-repository';
import { getTestDb, resetTestDb, rowsOf, seed } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-1' } } }) },
}));

const JOUR = '2026-08-14';

type PlannedRow = { id: string; scheduled_time: string | null };

/** Programme + séance nommée, possédés par l'utilisateur courant. */
function seedProgramme(pillar = 'strength', nom = 'Full body'): { programId: string; sessionId: string } {
  const programId = seed('programs', [
    { owner_id: 'user-1', pillar, is_active: 1, status: 'published' },
  ])[0]!;
  const sessionId = seed('sessions', [
    { program_id: programId, owner_id: 'user-1', order_index: 0, name: nom },
  ])[0]!;
  return { programId, sessionId };
}

/** Occurrence datée, avec ou sans heure. */
function seedOccurrence(over: Record<string, unknown> = {}): string {
  const { programId, sessionId } = (over.__ctx as { programId: string; sessionId: string }) ??
    seedProgramme();
  delete over.__ctx;
  return seed('planned_sessions', [
    {
      owner_id: 'user-1',
      program_id: programId,
      session_id: sessionId,
      scheduled_date: JOUR,
      status: 'planned',
      ...over,
    },
  ])[0]!;
}

/** Exécute la requête de rappel pour l'utilisateur et le jour de référence. */
const heuresDuJour = () =>
  getTestDb()
    .prepare(SELECT_PLANNED_STRENGTH_TIMES_TODAY)
    .all('user-1', JOUR) as { id: string; scheduled_time: string; name: string | null }[];

beforeEach(() => {
  resetTestDb();
});

// ---------------------------------------------------------------------------
// 🔴 Écriture-relecture — le filet contre la panne silencieuse
// ---------------------------------------------------------------------------

describe('setPlannedSessionTime', () => {
  it('🔴 écrit l’heure ET la relit — la colonne existe bien dans le schéma local', async () => {
    const id = seedOccurrence();

    await setPlannedSessionTime(id, '18:30');

    // Si `scheduled_time` manquait au schéma PowerSync client, l'écriture échouerait ici sans
    // message et ce test serait le seul endroit du dépôt à s'en apercevoir.
    const row = rowsOf<PlannedRow>('planned_sessions').find((r) => r.id === id);
    expect(row?.scheduled_time).toBe('18:30');
  });

  it('🔴 retire l’heure quand on passe `null`', async () => {
    const id = seedOccurrence({ scheduled_time: '18:30' });

    await setPlannedSessionTime(id, null);

    // Le retrait est une action offerte (D7), pas un accident : sans lui, poser une heure serait
    // irréversible et le régime d'échéance apprise inatteignable.
    const row = rowsOf<PlannedRow>('planned_sessions').find((r) => r.id === id);
    expect(row?.scheduled_time).toBeNull();
  });

  it('remplace une heure existante', async () => {
    const id = seedOccurrence({ scheduled_time: '18:30' });

    await setPlannedSessionTime(id, '07:15');

    const row = rowsOf<PlannedRow>('planned_sessions').find((r) => r.id === id);
    expect(row?.scheduled_time).toBe('07:15');
  });

  it('ne touche pas les autres occurrences', async () => {
    const ctx = seedProgramme();
    const a = seedOccurrence({ __ctx: ctx });
    const b = seedOccurrence({ __ctx: ctx, scheduled_date: '2026-08-15' });

    await setPlannedSessionTime(a, '18:30');

    const rows = rowsOf<PlannedRow>('planned_sessions');
    expect(rows.find((r) => r.id === a)?.scheduled_time).toBe('18:30');
    expect(rows.find((r) => r.id === b)?.scheduled_time).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// La requête de rappel
// ---------------------------------------------------------------------------

describe('SELECT_PLANNED_STRENGTH_TIMES_TODAY', () => {
  it('rend les occurrences à heure connue, les plus tôt d’abord', () => {
    const ctx = seedProgramme();
    seedOccurrence({ __ctx: ctx, scheduled_time: '19:00' });
    seedOccurrence({ __ctx: ctx, scheduled_time: '12:00' });

    // Le tri est fait en SQL : le choix « la prochaine à venir » (D6) devient un simple `find`
    // côté appelant, sans logique de comparaison à réécrire.
    expect(heuresDuJour().map((r) => r.scheduled_time)).toEqual(['12:00', '19:00']);
  });

  it('🔴 écarte les occurrences SANS heure — elles relèvent de l’échéance apprise', () => {
    const ctx = seedProgramme();
    seedOccurrence({ __ctx: ctx });
    seedOccurrence({ __ctx: ctx, scheduled_time: '18:30' });

    // Les inclure mêlerait les deux régimes, que la règle R5 veut exclusifs.
    expect(heuresDuJour().map((r) => r.scheduled_time)).toEqual(['18:30']);
  });

  it('🔴 écarte une séance déjà faite', () => {
    const ctx = seedProgramme();
    seedOccurrence({ __ctx: ctx, scheduled_time: '18:30', status: 'done' });

    // Même filtre que `SELECT_HAS_PLANNED_STRENGTH_TODAY` : `status = 'planned'` strictement.
    // Convoquer pour une séance faite est le défaut que MUSC-F8 avait déjà écarté.
    expect(heuresDuJour()).toEqual([]);
  });

  it('écarte une séance sautée', () => {
    const ctx = seedProgramme();
    seedOccurrence({ __ctx: ctx, scheduled_time: '18:30', status: 'skipped' });

    expect(heuresDuJour()).toEqual([]);
  });

  it('🔴 écarte une séance de COURSE — le rappel reste muscu', () => {
    const ctx = seedProgramme('running', 'Sortie longue');
    seedOccurrence({ __ctx: ctx, scheduled_time: '08:00' });

    // `planned_sessions` est pilier-agnostique : sans le filtre sur `programs.pillar`, une sortie
    // de course déclencherait le rappel muscu (décision D16 de MUSC-F8). Écart volontaire et
    // documenté : la colonne sert aux deux piliers, le rappel non.
    expect(heuresDuJour()).toEqual([]);
  });

  it('écarte une occurrence soft-deletée', () => {
    const ctx = seedProgramme();
    seedOccurrence({
      __ctx: ctx,
      scheduled_time: '18:30',
      deleted_at: new Date().toISOString(),
    });

    expect(heuresDuJour()).toEqual([]);
  });

  it('écarte un autre jour', () => {
    const ctx = seedProgramme();
    seedOccurrence({ __ctx: ctx, scheduled_time: '18:30', scheduled_date: '2026-08-15' });

    expect(heuresDuJour()).toEqual([]);
  });

  it('écarte l’occurrence d’un autre utilisateur', () => {
    const ctx = seedProgramme();
    seed('planned_sessions', [
      {
        owner_id: 'user-2',
        program_id: ctx.programId,
        session_id: ctx.sessionId,
        scheduled_date: JOUR,
        status: 'planned',
        scheduled_time: '18:30',
      },
    ]);

    expect(heuresDuJour()).toEqual([]);
  });

  it('rend le nom de la séance, pour le corps de la notification', () => {
    const ctx = seedProgramme('strength', 'Haut du corps');
    seedOccurrence({ __ctx: ctx, scheduled_time: '18:30' });

    expect(heuresDuJour()[0]?.name).toBe('Haut du corps');
  });
});
