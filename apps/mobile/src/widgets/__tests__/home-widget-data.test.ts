/**
 * US LAUNCHER-01 — `computeHomeWidgetSnapshot`, exécuté sur du vrai SQLite (harness).
 *
 * Ce module est appelé par la tâche Headless JS du widget (D2/D3 de la spec) : il ne réutilise
 * aucun hook, seulement des requêtes directes + les fonctions pures déjà testées de
 * `@wellness/shared`. Les tests vérifient l'**orchestration** (D6 masquage par pilier, D10 état de
 * repli, priorité musculation > running), pas la logique déjà couverte ailleurs (streak, TDEE...).
 */

import { computeHomeWidgetSnapshot } from '../home-widget-data';
import { resetTestDb, seed } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

let mockUserId: string | null = 'user-1';
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ session: mockUserId ? { user: { id: mockUserId } } : null }) },
}));

const TODAY = '2026-08-03';
const NOW_ISO = `${TODAY}T12:00:00.000Z`;

function seedActivePillars(pillars: string[]): void {
  seed('user_settings', [{ user_id: 'user-1', active_pillars: JSON.stringify(pillars) }]);
}

function seedPlannedSession(pillar: string, opts: { status?: string; scheduledDate?: string; name?: string } = {}): void {
  const [programId] = seed('programs', [{ owner_id: 'user-1', pillar, is_active: 1 }]);
  const [sessionId] = seed('sessions', [{ program_id: programId, name: opts.name ?? 'Séance', order_index: 0 }]);
  seed('planned_sessions', [
    {
      owner_id: 'user-1',
      program_id: programId,
      session_id: sessionId,
      scheduled_date: opts.scheduledDate ?? TODAY,
      status: opts.status ?? 'planned',
    },
  ]);
}

beforeEach(() => {
  resetTestDb();
  mockUserId = 'user-1';
  jest.useFakeTimers().setSystemTime(new Date(NOW_ISO));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('computeHomeWidgetSnapshot', () => {
  it('D10 — aucune session active : état de repli, aucune requête plantée', async () => {
    mockUserId = null;

    const snapshot = await computeHomeWidgetSnapshot();

    expect(snapshot).toEqual({
      authState: 'no-session',
      streak: 0,
      todaySession: null,
      kcalRemaining: null,
    });
  });

  it("D6 — musculation ET course désactivées : todaySession est null (pas de 'repos' affiché)", async () => {
    seedActivePillars(['nutrition']);

    const snapshot = await computeHomeWidgetSnapshot();

    expect(snapshot.todaySession).toBeNull();
  });

  it('D6 — nutrition désactivée : kcalRemaining est null', async () => {
    seedActivePillars(['strength']);

    const snapshot = await computeHomeWidgetSnapshot();

    expect(snapshot.kcalRemaining).toBeNull();
  });

  it('un pilier actif sans séance planifiée aujourd’hui → repos', async () => {
    seedActivePillars(['strength']);

    const snapshot = await computeHomeWidgetSnapshot();

    expect(snapshot.todaySession).toEqual({ kind: 'rest' });
  });

  it('une séance planifiée aujourd’hui pour le pilier actif → son nom', async () => {
    seedActivePillars(['strength']);
    seedPlannedSession('strength', { name: 'Full Body B' });

    const snapshot = await computeHomeWidgetSnapshot();

    expect(snapshot.todaySession).toEqual({ kind: 'session', pillar: 'strength', name: 'Full Body B' });
  });

  it('musculation ET course prévues le même jour → priorité musculation (spec §3)', async () => {
    seedActivePillars(['strength', 'running']);
    seedPlannedSession('strength', { name: 'Full Body B' });
    seedPlannedSession('running', { name: 'Sortie 8 km' });

    const snapshot = await computeHomeWidgetSnapshot();

    expect(snapshot.todaySession).toEqual({ kind: 'session', pillar: 'strength', name: 'Full Body B' });
  });

  it('musculation inactive, course active avec séance du jour → bascule sur la course', async () => {
    seedActivePillars(['running']);
    seedPlannedSession('running', { name: 'Sortie 8 km' });

    const snapshot = await computeHomeWidgetSnapshot();

    expect(snapshot.todaySession).toEqual({ kind: 'session', pillar: 'running', name: 'Sortie 8 km' });
  });

  it('une occurrence déjà faite (status done) ne compte pas comme la séance du jour → repos', async () => {
    seedActivePillars(['strength']);
    seedPlannedSession('strength', { status: 'done', name: 'Full Body A' });

    const snapshot = await computeHomeWidgetSnapshot();

    expect(snapshot.todaySession).toEqual({ kind: 'rest' });
  });

  it('streak : 3 jours de musculation consécutifs jusqu’à aujourd’hui → 3', async () => {
    seedActivePillars(['strength']);
    seed('workouts', [
      { user_id: 'user-1', status: 'completed', finished_at: `${TODAY}T08:00:00.000Z` },
      { user_id: 'user-1', status: 'completed', finished_at: '2026-08-02T08:00:00.000Z' },
      { user_id: 'user-1', status: 'completed', finished_at: '2026-08-01T08:00:00.000Z' },
    ]);

    const snapshot = await computeHomeWidgetSnapshot();

    expect(snapshot.streak).toBe(3);
  });

  it('streak : jour couvert par un joker compte dans la série', async () => {
    seedActivePillars(['strength']);
    seed('workouts', [
      { user_id: 'user-1', status: 'completed', finished_at: `${TODAY}T08:00:00.000Z` },
      { user_id: 'user-1', status: 'completed', finished_at: '2026-08-01T08:00:00.000Z' },
    ]);
    // 02/08 manqué, mais couvert par un joker → la série ne casse pas.
    seed('streak_jokers', [{ user_id: 'user-1', log_date: '2026-08-02' }]);

    const snapshot = await computeHomeWidgetSnapshot();

    expect(snapshot.streak).toBe(3);
  });

  it('kcal restantes : objectif de base moins le consommé du jour', async () => {
    seedActivePillars(['nutrition']);
    seed('profiles', [
      {
        user_id: 'user-1',
        sex: 'male',
        height_cm: 180,
        weight_kg: 80,
        birth_date: '1990-01-01',
        main_goal: 'maintain',
      },
    ]);
    seed('nutrition_profiles', [{ user_id: 'user-1', objective: 'maintain', activity_level: 'moderate' }]);
    seed('food_entries', [
      { user_id: 'user-1', log_date: TODAY, meal_type: 'lunch', kcal: 600, protein_g: 0, carbs_g: 0, fat_g: 0 },
    ]);

    const snapshot = await computeHomeWidgetSnapshot();

    expect(snapshot.kcalRemaining).not.toBeNull();
    expect(snapshot.kcalRemaining).toBeGreaterThan(0);
  });

  it('kcal restantes : profil incomplet (pas de taille/poids) → null', async () => {
    seedActivePillars(['nutrition']);
    seed('nutrition_profiles', [{ user_id: 'user-1', objective: 'maintain', activity_level: 'moderate' }]);

    const snapshot = await computeHomeWidgetSnapshot();

    expect(snapshot.kcalRemaining).toBeNull();
  });
});
