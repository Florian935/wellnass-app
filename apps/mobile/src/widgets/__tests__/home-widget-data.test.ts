/**
 * US LAUNCHER-01 — `computeHomeWidgetSnapshot`, exécuté sur du vrai SQLite (harness).
 *
 * Ce module est appelé par la tâche Headless JS du widget (D2/D3 de la spec) : il ne réutilise
 * aucun hook, seulement des requêtes directes + les fonctions pures déjà testées de
 * `@wellness/shared`. Les tests vérifient l'**orchestration** (D6 masquage par pilier, D10 état de
 * repli, priorité musculation > running), pas la logique déjà couverte ailleurs (streak, TDEE...).
 */

import { tdee } from '@wellness/shared';

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

  // ── US CIBLE-01 — le filet du « Restant » ─────────────────────────────────────────────────────
  // Profil A (homme, 80 kg, 180 cm, 30 ans) : `tdee` « modéré » 2 759, hors sport « debout » 2 448 ;
  // sèche −400, forfait 300 ; 2 000 kcal mangées. Les tests étiquetés figent la valeur d'aujourd'hui
  // d'un cas que la spec (§6) annonce comme changé : seul leur attendu bouge, à l'étape du widget.
  const seedProfileA = (overrides: Record<string, unknown> = {}) =>
    seed('profiles', [
      { user_id: 'user-1', sex: 'male', height_cm: 180, weight_kg: 80, birth_date: '1996-01-15', main_goal: 'muscle', ...overrides },
    ]);
  const seedNutritionA = (overrides: Record<string, unknown> = {}) =>
    seed('nutrition_profiles', [
      {
        user_id: 'user-1',
        objective: 'cut',
        activity_level: 'moderate',
        training_day_bonus: 300,
        training_bonus_mode: 'fixed',
        sport_free_level: 'standing',
        ...overrides,
      },
    ]);
  const seedEaten = (kcal = 2000) =>
    seed('food_entries', [{ user_id: 'user-1', log_date: TODAY, meal_type: 'lunch', kcal, protein_g: 0, carbs_g: 0, fat_g: 0 }]);

  it('kcal restantes : jour de repos, mode `fixed` — base 2 359', async () => {
    seedActivePillars(['strength', 'running', 'nutrition']);
    seedProfileA();
    seedNutritionA();
    seedEaten();

    expect((await computeHomeWidgetSnapshot()).kcalRemaining).toBe(359);
  });

  it('CIBLE-01 C16 — séance faite aujourd’hui, forfait 300 : le restant ignore le bonus', async () => {
    seedActivePillars(['strength', 'running', 'nutrition']);
    seedProfileA();
    seedNutritionA();
    seedEaten();
    seed('workouts', [
      { user_id: 'user-1', status: 'completed', started_at: `${TODAY}T09:00:00.000Z`, finished_at: `${TODAY}T10:00:00.000Z`, duration_seconds: 3600 },
    ]);

    expect((await computeHomeWidgetSnapshot()).kcalRemaining).toBe(359);
  });

  it('CIBLE-01 C17 — mode `activities` : socle `tdee`', async () => {
    seedActivePillars(['strength', 'running', 'nutrition']);
    seedProfileA();
    seedNutritionA({ training_bonus_mode: 'activities' });
    seedEaten();

    expect((await computeHomeWidgetSnapshot()).kcalRemaining).toBe(359);
  });

  it('CIBLE-01 C18 — dernière pesée (70 kg) ≠ poids du profil (80 kg) : socle au poids de la pesée', async () => {
    seedActivePillars(['strength', 'running', 'nutrition']);
    seedProfileA();
    seedNutritionA();
    seedEaten();
    seed('body_weight_entries', [{ user_id: 'user-1', log_date: '2026-08-01', weight_kg: 70 }]);
    const at70 = tdee({ sex: 'male', weightKg: 70, heightCm: 180, age: 30, activityLevel: 'moderate' })! - 400;

    expect((await computeHomeWidgetSnapshot()).kcalRemaining).toBe(at70 - 2000);
  });

  it('CIBLE-01 C19 — profil sans poids, une pesée : un restant au poids de la pesée', async () => {
    seedActivePillars(['strength', 'running', 'nutrition']);
    seedProfileA({ weight_kg: null });
    seedNutritionA();
    seedEaten();
    seed('body_weight_entries', [{ user_id: 'user-1', log_date: '2026-08-01', weight_kg: 80 }]);

    expect((await computeHomeWidgetSnapshot()).kcalRemaining).toBe(359);
  });

  it('kcal restantes : profil incomplet (pas de taille/poids) → null', async () => {
    seedActivePillars(['nutrition']);
    seed('nutrition_profiles', [{ user_id: 'user-1', objective: 'maintain', activity_level: 'moderate' }]);

    const snapshot = await computeHomeWidgetSnapshot();

    expect(snapshot.kcalRemaining).toBeNull();
  });
});
