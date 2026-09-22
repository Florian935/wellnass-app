/**
 * US IA-LAB-01 — l'instantané envoyé au modèle. Fichier à **0 %**, et le plus sensible du dépôt :
 * c'est le seul endroit où des données de l'utilisateur **quittent l'appareil**.
 *
 * Deux filets, de nature différente.
 *
 * ── 1. La garde de confidentialité, par lecture statique ─────────────────────────────────────────
 * L'en-tête du fichier pose une règle — « rien de ce qui est lu ici n'est du texte libre » — et la
 * confie à la vigilance du relecteur : « si vous ajoutez une requête ici, la question à se poser
 * est : est-ce que ça a le droit de quitter l'appareil ? ». Une consigne écrite en commentaire est
 * un test qui manque (leçon du lot 7, cf. `route-declarations.test.ts`). Ce test lit le source et
 * refuse toute colonne de texte libre ou identifiante. Il ne rend rien : monter le hook ne dirait
 * rien de ce qu'on aura ajouté demain, alors que la lecture du fichier, elle, le dira.
 *
 * ── 2. Les douze requêtes, exécutées pour de bon ─────────────────────────────────────────────────
 * Elles sont écrites **en ligne** dans le hook, non exportées. Plutôt que de les recopier — ce qui
 * testerait la copie et non le code embarqué (§3.3) — on **capture** le SQL et ses paramètres au
 * passage de `useQuery`, puis on les rejoue sur le harness SQLite. Ce qu'on vérifie alors :
 *
 * - que chacune **s'exécute** sur le schéma PowerSync réel — une colonne absente ferait lever la
 *   requête, `useQuery` avalerait l'erreur, et le champ correspondant disparaîtrait de l'instantané
 *   **sans bruit**. Le modèle répondrait alors sur des données amputées, avec le même aplomb ;
 * - les quatre 🔴 que le fichier documente : les **deux bornes de fenêtre** (dates locales vs
 *   instants UTC — les comparer donne un résultat faux d'un jour), la progression triée par **ce
 *   qui ne progresse pas**, la meilleure série **par exercice**, et les moyennes qui ignorent les
 *   jours non renseignés.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { renderHook } from '@testing-library/react-native';
import { useQuery } from '@powersync/react';

import { AI_CONTEXT_WINDOW_DAYS, useAiSnapshot } from '../ai-context-repository';
import { resetTestDb, seed, testPowerSync } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('../settings-repository', () => ({
  useSettings: jest.fn(() => ({ settings: { activePillars: ['strength'] }, isLoading: false })),
}));

const TODAY = new Date('2026-09-22T10:00:00');

jest.mock('@/hooks/useTodayKey', () => ({
  useTodayDate: jest.fn(() => new Date('2026-09-22T10:00:00')),
  useTodayKey: jest.fn(() => '2026-09-22'),
}));

const mockedQuery = useQuery as unknown as jest.Mock;

/** Une requête telle que le hook l'émet réellement. */
type Emitted = { sql: string; params: unknown[] };

/**
 * Monte le hook et rend les douze requêtes émises, dans l'ordre. `rows` permet d'alimenter une
 * requête donnée, repérée par un fragment de son SQL.
 */
async function emitted(rows: { match: string; data: unknown[] }[] = []): Promise<Emitted[]> {
  const calls: Emitted[] = [];
  mockedQuery.mockImplementation((sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    const hit = rows.find((r) => sql.includes(r.match));
    return { data: hit?.data ?? [], isLoading: false, error: undefined };
  });
  await renderHook(() => useAiSnapshot());
  return calls;
}

const find = (calls: Emitted[], fragment: string): Emitted => {
  const hit = calls.find((c) => c.sql.includes(fragment));
  if (!hit) throw new Error(`Aucune requête ne contient « ${fragment} »`);
  return hit;
};

beforeEach(() => {
  resetTestDb();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Confidentialité — la liste noire, par lecture du source
// ---------------------------------------------------------------------------

describe('garde de confidentialité', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/data/repositories/ai-context-repository.ts'),
    'utf-8',
  );
  /** Le SQL seul : les commentaires de prose citent légitimement « notes » ou « prénom ». */
  const sqlOnly = source
    .split('\n')
    .filter((line) => /SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|AS /.test(line))
    .join('\n');

  it.each([
    ['notes', 'les notes de séance et de course sont du texte libre saisi par l’utilisateur'],
    ['note_', 'même famille : toute colonne de note'],
    ['first_name', 'le prénom identifie directement'],
    ['display_name', 'idem'],
    ['email', 'un identifiant direct n’a rien à faire dans un contexte de modèle'],
    ['avatar', 'une photo de profil encore moins'],
    ['track', 'une trace GPS est une donnée de localisation'],
    ['polyline', 'idem, sous son autre nom'],
    ['latitude', 'idem'],
    ['longitude', 'idem'],
    ['pain', 'le journal de douleur est une donnée de santé en texte libre'],
    ['description', 'champ libre par nature'],
  ])('ne lit jamais la colonne « %s » — %s', (column) => {
    expect(sqlOnly).not.toMatch(new RegExp(`\\b${column}\\w*\\b`, 'i'));
  });

  it('lit la date de naissance mais ne la laisse pas sortir : seul l’âge est dérivé', async () => {
    const calls = await emitted([
      { match: 'FROM profiles', data: [{ sex: 'male', birth_date: '1990-05-04', height_cm: 180 }] },
    ]);
    const { result } = await renderHook(() => useAiSnapshot());

    expect(find(calls, 'FROM profiles').sql).toContain('birth_date');
    expect(JSON.stringify(result.current.snapshot)).not.toContain('1990-05-04');
    expect(result.current.snapshot?.profile.ageYears).toBe(36);
  });

  it('ne fait sortir, comme seul libellé, que des noms d’exercice de la bibliothèque', async () => {
    const calls = await emitted();
    const named = calls.filter((c) => /AS exercise_name/.test(c.sql));

    expect(named.length).toBeGreaterThan(0);
    for (const call of named) {
      // Le nom vient de `exercise_translations`, jamais d'une saisie de l'utilisateur.
      expect(call.sql).toContain('exercise_translations');
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Les douze requêtes, rejouées sur le schéma réel
// ---------------------------------------------------------------------------

describe('les requêtes émises', () => {
  it('émet douze requêtes : le contexte n’en perd aucune en chemin', async () => {
    expect(await emitted()).toHaveLength(12);
  });

  it('s’exécutent toutes sur le schéma PowerSync réel, base vide', async () => {
    for (const { sql, params } of await emitted()) {
      await expect(testPowerSync.getAll(sql, params)).resolves.toBeDefined();
    }
  });

  it('s’exécutent toutes sur une base peuplée', async () => {
    seed('profiles', [{ id: 'p', user_id: 'u', sex: 'male', birth_date: '1990-05-04', height_cm: 180 }]);
    seed('body_weight_entries', [{ id: 'bw', user_id: 'u', log_date: '2026-09-20', weight_kg: 72 }]);
    seed('daily_steps', [{ id: 'ds', user_id: 'u', log_date: '2026-09-20', steps: 8000 }]);
    seed('activities', [
      { id: 'a', user_id: 'u', activity_type: 'cycling', started_at: '2026-09-20T10:00:00.000Z', duration_seconds: 3600, intensity: 'moderate' },
    ]);

    for (const { sql, params } of await emitted()) {
      await expect(testPowerSync.getAll(sql, params)).resolves.toBeDefined();
    }
  });

  it('borne les tables de JOURNAL sur une date locale (YYYY-MM-DD), pas sur un instant ISO', async () => {
    const calls = await emitted();

    for (const fragment of ['FROM daily_steps', 'FROM daily_wellbeing', 'FROM body_weight_entries']) {
      const params = find(calls, fragment).params as string[];
      expect(params.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p))).toBe(true);
    }
  });

  it('borne les tables d’ÉVÉNEMENT sur un instant UTC, pas sur une date', async () => {
    const calls = await emitted();

    for (const fragment of ['FROM runs', 'FROM activities']) {
      const params = find(calls, fragment).params as string[];
      expect(params.every((p) => p.endsWith('Z'))).toBe(true);
    }
  });

  it('ouvre la fenêtre sur le nombre de jours demandé', async () => {
    const calls = await emitted();
    const params = find(calls, 'FROM runs').params as string[];
    const oldest = params.reduce((min, p) => (p < min ? p : min));

    const days = Math.round((TODAY.getTime() - new Date(oldest).getTime()) / 86_400_000);
    expect(days).toBe(AI_CONTEXT_WINDOW_DAYS);
  });
});

// ---------------------------------------------------------------------------
// 3. Les quatre 🔴 documentés, vérifiés sur du vrai SQLite
// ---------------------------------------------------------------------------

describe('les règles que les requêtes portent', () => {
  /** Une séance terminée à `finishedAt` avec une série `reps × kg` sur `exerciseId`. */
  const workoutWith = (id: string, finishedAt: string, exerciseId: string, reps: number, kg: number) => {
    seed('workouts', [
      { id, user_id: 'u', status: 'completed', started_at: finishedAt, finished_at: finishedAt, duration_seconds: 3600 },
    ]);
    seed('workout_sets', [
      { id: `s-${id}-${exerciseId}`, workout_id: id, user_id: 'u', exercise_id: exerciseId, order_index: 0, set_type: 'normal', reps, weight_kg: kg, done: 1 },
    ]);
  };

  const twoExercises = () => {
    seed('exercises', [
      { id: 'ex-bench', source: 'library', muscle_primary: 'chest' },
      { id: 'ex-press', source: 'library', muscle_primary: 'legs' },
    ]);
    seed('exercise_translations', [
      { id: 't1', exercise_id: 'ex-bench', lang: 'fr', name: 'Développé couché' },
      { id: 't2', exercise_id: 'ex-press', lang: 'fr', name: 'Presse' },
    ]);
  };

  it('🔴 classe la progression par ce qui NE progresse PAS, jamais par charge absolue', async () => {
    twoExercises();
    // Développé couché bloqué à 82,5 ; presse en hausse de 170 à 191. La presse est bien plus
    // lourde : un tri par charge classerait la stagnation en dernier — le défaut du 17/09/2026.
    workoutWith('w-vieux-bench', '2026-08-20T18:00:00.000Z', 'ex-bench', 5, 82.5);
    workoutWith('w-neuf-bench', '2026-09-18T18:00:00.000Z', 'ex-bench', 5, 82.5);
    workoutWith('w-vieux-press', '2026-08-20T18:00:00.000Z', 'ex-press', 8, 170);
    workoutWith('w-neuf-press', '2026-09-18T18:00:00.000Z', 'ex-press', 8, 191);

    const { sql, params } = find(await emitted(), 'previous_max');
    const rows = await testPowerSync.getAll<{ exercise_name: string }>(sql, params);

    expect(rows[0]!.exercise_name).toBe('Développé couché');
  });

  it('🔴 range en fin de liste ce qui n’a pas d’historique : commencer n’est pas régresser', async () => {
    twoExercises();
    workoutWith('w-vieux-bench', '2026-08-20T18:00:00.000Z', 'ex-bench', 5, 82.5);
    workoutWith('w-neuf-bench', '2026-09-18T18:00:00.000Z', 'ex-bench', 5, 80); // recul
    workoutWith('w-neuf-press', '2026-09-18T18:00:00.000Z', 'ex-press', 8, 191); // jamais vu avant

    const { sql, params } = find(await emitted(), 'previous_max');
    const rows = await testPowerSync.getAll<{ exercise_name: string; previous_max: number | null }>(sql, params);

    expect(rows[rows.length - 1]!.previous_max).toBeNull();
    expect(rows[0]!.exercise_name).toBe('Développé couché');
  });

  it('écarte de la progression un exercice abandonné : « rien récemment » n’est pas un progrès', async () => {
    twoExercises();
    workoutWith('w-vieux', '2026-08-01T18:00:00.000Z', 'ex-bench', 5, 82.5);

    const { sql, params } = find(await emitted(), 'previous_max');

    expect(await testPowerSync.getAll(sql, params)).toHaveLength(0);
  });

  it('🔴 rend la meilleure série PAR exercice, sinon un seul trusterait les six lignes', async () => {
    twoExercises();
    workoutWith('w-1', '2026-09-18T18:00:00.000Z', 'ex-bench', 5, 80);
    workoutWith('w-2', '2026-09-19T18:00:00.000Z', 'ex-bench', 5, 85);
    workoutWith('w-3', '2026-09-20T18:00:00.000Z', 'ex-press', 8, 170);

    const { sql, params } = find(await emitted(), 'ORDER BY weight_kg DESC');
    const rows = await testPowerSync.getAll<{ exercise_name: string; weight_kg: number }>(sql, params);

    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.exercise_name === 'Développé couché')!.weight_kg).toBe(85);
  });

  it('exclut échauffements et séries non faites du volume musculaire', async () => {
    twoExercises();
    seed('workouts', [
      { id: 'w-1', user_id: 'u', status: 'completed', started_at: '2026-09-18T18:00:00.000Z', finished_at: '2026-09-18T18:00:00.000Z' },
    ]);
    seed('workout_sets', [
      { id: 's-ok', workout_id: 'w-1', user_id: 'u', exercise_id: 'ex-bench', order_index: 0, set_type: 'normal', reps: 10, weight_kg: 50, done: 1 },
      { id: 's-warm', workout_id: 'w-1', user_id: 'u', exercise_id: 'ex-bench', order_index: 1, set_type: 'warmup', reps: 10, weight_kg: 20, done: 1 },
      { id: 's-non', workout_id: 'w-1', user_id: 'u', exercise_id: 'ex-bench', order_index: 2, set_type: 'normal', reps: 10, weight_kg: 90, done: 0 },
    ]);

    const { sql, params } = find(await emitted(), 'GROUP BY e.muscle_primary');
    const rows = await testPowerSync.getAll<{ muscle: string; volume: number }>(sql, params);

    expect(rows).toEqual([{ muscle: 'chest', sets: 1, volume: 500 }]);
  });

  it('🔴 moyenne le sommeil sur les nuits RENSEIGNÉES, pas sur les jours de check-in', async () => {
    seed('daily_wellbeing', [
      { id: 'd1', user_id: 'u', log_date: '2026-09-19', mood: 4, energy: 4, stress: 2, sleep_minutes: 480 },
      { id: 'd2', user_id: 'u', log_date: '2026-09-20', mood: 4, energy: 4, stress: 2, sleep_minutes: null },
      { id: 'd3', user_id: 'u', log_date: '2026-09-21', mood: 4, energy: 4, stress: 2, sleep_minutes: null },
    ]);

    const { sql, params } = find(await emitted(), 'FROM daily_wellbeing');
    const rows = await testPowerSync.getAll<{ days: number; sleep: number }>(sql, params);

    // 480 et non 160 : compter les deux jours vides comme des nuits de zéro heure diviserait par 3.
    expect(rows[0]).toMatchObject({ days: 3, sleep: 480 });
  });

  it('moyenne les calories PAR JOUR journalisé, pas par ligne d’aliment', async () => {
    seed('food_entries', [
      { id: 'f1', user_id: 'u', log_date: '2026-09-20', kcal: 300, protein_g: 20, carbs_g: 30, fat_g: 10 },
      { id: 'f2', user_id: 'u', log_date: '2026-09-20', kcal: 700, protein_g: 40, carbs_g: 70, fat_g: 20 },
      { id: 'f3', user_id: 'u', log_date: '2026-09-21', kcal: 2000, protein_g: 100, carbs_g: 200, fat_g: 60 },
    ]);

    const { sql, params } = find(await emitted(), 'FROM food_entries');
    const rows = await testPowerSync.getAll<{ days: number; kcal: number }>(sql, params);

    // 1 500 = (1 000 + 2 000) / 2 jours. Par ligne, on lirait 1 000 — la calorie moyenne d'un plat.
    expect(rows[0]).toMatchObject({ days: 2, kcal: 1500 });
  });

  it('recompose l’allure sur les sommes, pas sur une moyenne d’allures', async () => {
    const calls = await emitted();
    const { sql } = find(calls, 'FROM runs');

    expect(sql).not.toContain('AVG(avg_pace_s_per_km)');
    expect(sql).toContain('SUM(distance_m)');
  });
});

// ---------------------------------------------------------------------------
// 4. L'assemblage de l'instantané
// ---------------------------------------------------------------------------

describe('assemblage de l’instantané', () => {
  const snapshotOf = async (rows: { match: string; data: unknown[] }[]) => {
    mockedQuery.mockImplementation((sql: string) => {
      const hit = rows.find((r) => sql.includes(r.match));
      return { data: hit?.data ?? [], isLoading: false, error: undefined };
    });
    const { result } = await renderHook(() => useAiSnapshot());
    return result.current;
  };

  it('rend null et un contexte vide tant qu’une source charge', async () => {
    mockedQuery.mockReturnValue({ data: [], isLoading: true, error: undefined });
    const { result } = await renderHook(() => useAiSnapshot());

    expect(result.current.snapshot).toBeNull();
    expect(result.current.context).toBe('');
    expect(result.current.isLoading).toBe(true);
  });

  it('laisse les piliers sans donnée à null plutôt que de les remplir de zéros', async () => {
    const { snapshot } = await snapshotOf([]);

    expect(snapshot).not.toBeNull();
    expect(snapshot!.strength).toBeNull();
    expect(snapshot!.running).toBeNull();
    expect(snapshot!.nutrition).toBeNull();
    expect(snapshot!.weight).toBeNull();
  });

  it('garde le poids dès la première pesée : une pesée ne fait pas une tendance, mais fait un poids', async () => {
    const { snapshot } = await snapshotOf([
      {
        match: 'FROM body_weight_entries WHERE',
        data: [{ first_kg: 72, last_kg: 72, count: 1, first_date: '2026-09-20', last_date: '2026-09-20', recent_kg: 72, previous_kg: null }],
      },
    ]);

    expect(snapshot!.weight).toMatchObject({ firstKg: 72, lastKg: 72, count: 1 });
  });

  it('nomme les groupes musculaires JAMAIS travaillés — personne ne remarque ce qui n’est pas écrit', async () => {
    const { snapshot } = await snapshotOf([
      { match: 'AVG(w.duration_seconds)', data: [{ sessions: 4, volume: 12000, avg_seconds: 3600 }] },
      { match: 'GROUP BY e.muscle_primary', data: [{ muscle: 'chest', sets: 12, volume: 6000 }] },
    ]);

    expect(snapshot!.strength!.untrainedMuscles).toContain('legs');
    expect(snapshot!.strength!.untrainedMuscles).not.toContain('chest');
  });

  it('ne divise jamais par zéro mètre : l’allure est null plutôt qu’Infinity', async () => {
    const { snapshot } = await snapshotOf([
      { match: 'FROM runs', data: [{ runs: 1, distance_m: 0, seconds: 600, longest_m: 0, recent_m: null, recent_s: null, previous_m: null, previous_s: null }] },
    ]);

    expect(snapshot!.running!.avgPaceSPerKm).toBeNull();
  });

  it('rend « pas travaillé avant » comme null, jamais comme 0 kg soulevé', async () => {
    const { snapshot } = await snapshotOf([
      { match: 'AVG(w.duration_seconds)', data: [{ sessions: 1, volume: 400, avg_seconds: 3600 }] },
      { match: 'previous_max', data: [{ exercise_name: 'Squat', recent_max: 100, previous_max: null }] },
    ]);

    expect(snapshot!.strength!.progression[0]).toMatchObject({ exercise: 'Squat', previousMaxKg: null });
  });

  it('écarte une série sans nom d’exercice plutôt que de l’envoyer anonyme', async () => {
    const { snapshot } = await snapshotOf([
      { match: 'AVG(w.duration_seconds)', data: [{ sessions: 1, volume: 400, avg_seconds: 3600 }] },
      {
        match: 'ORDER BY weight_kg DESC',
        data: [{ exercise_name: null, weight_kg: 100, reps: 5 }, { exercise_name: 'Squat', weight_kg: 90, reps: 5 }],
      },
    ]);

    expect(snapshot!.strength!.topSets).toHaveLength(1);
    expect(snapshot!.strength!.topSets[0]!.exercise).toBe('Squat');
  });

  it('produit un contexte non vide dès qu’il y a un instantané', async () => {
    const { context, snapshot } = await snapshotOf([]);

    expect(snapshot).not.toBeNull();
    expect(context.length).toBeGreaterThan(0);
  });

  it('reprend les piliers actifs des réglages', async () => {
    const { snapshot } = await snapshotOf([]);

    expect(snapshot!.profile.activePillars).toEqual(['strength']);
  });
});
