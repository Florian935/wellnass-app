/**
 * US AUTRE-01 / DEPENSE-01 — le repository des **autres activités**, sur du vrai SQLite.
 *
 * Ce fichier était à **0 %** : livré le 15/09/2026, il n'a jamais eu de filet. Or c'est un chemin
 * d'écriture, et il porte deux règles dont la panne est **silencieuse** :
 *
 * 1. **Le ressenti prérempli** (`ACTIVITY_INTENSITY_RPE`). Sans lui, `rpe` vaut `null`, la charge
 *    sRPE de l'activité vaut **zéro**, et 90 km de vélo ne pèsent rien dans l'ACWR ni dans le
 *    garde-fou de charge — l'app annonce « repos » à quelqu'un qui vient de rouler trois heures.
 *    Rien à l'écran ne le montre : la ligne est bien enregistrée, elle est juste sans poids.
 * 2. **Le jour d'une activité est une clé LOCALE**, jamais `started_at` tronqué. `started_at` est en
 *    UTC ; une sortie à 23 h 30 en France y apparaît au lendemain. Filtrer en SQL sur cette colonne
 *    ferait basculer la dépense du jour d'une journée à l'autre selon le fuseau — exactement le
 *    genre d'écart qu'une recette sur un seul device, dans un seul fuseau, ne peut pas produire.
 *
 * Les écritures tournent sur le **harness SQLite** (§3.1 de strategie-tests.md) : une colonne
 * absente du schéma PowerSync local fait rougir le test au lieu d'avaler l'insertion.
 */

import { renderHook } from '@testing-library/react-native';
import { useQuery } from '@powersync/react';
import { ACTIVITY_INTENSITY_RPE } from '@wellness/shared';

import {
  addActivity,
  deleteActivity,
  updateActivity,
  useActivities,
  useActivitiesOnDay,
  useActivity,
  useActivityHabits,
} from '../activity-repository';
import { resetTestDb, rowsOf, seed } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: jest.fn(() => ({ session: { user: { id: 'user-1' } } })) },
}));

import { useAuthStore } from '@/stores/auth-store';

const getState = useAuthStore.getState as unknown as jest.Mock;

type ActivityRow = {
  id: string;
  user_id: string;
  activity_type: string;
  started_at: string;
  duration_seconds: number;
  intensity: string;
  rpe: number | null;
  distance_m: number | null;
  device_kcal: number | null;
  notes: string | null;
  updated_at: string;
  deleted_at: string | null;
};

const rows = () => rowsOf<ActivityRow>('activities');

beforeEach(() => {
  resetTestDb();
  getState.mockReturnValue({ session: { user: { id: 'user-1' } } });
});

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

describe('addActivity', () => {
  it('écrit toutes les colonnes du schéma local et rend l’id créé', async () => {
    const id = await addActivity({
      activityType: 'cycling',
      startedAt: '2026-09-18T07:30:00.000Z',
      durationSeconds: 5400,
      intensity: 'vigorous',
      distanceM: 42000,
      deviceKcal: 980,
      notes: 'Col de la Faucille',
    });

    const all = rows();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      id,
      user_id: 'user-1',
      activity_type: 'cycling',
      started_at: '2026-09-18T07:30:00.000Z',
      duration_seconds: 5400,
      intensity: 'vigorous',
      distance_m: 42000,
      device_kcal: 980,
      notes: 'Col de la Faucille',
    });
  });

  it.each([
    ['light', ACTIVITY_INTENSITY_RPE.light],
    ['moderate', ACTIVITY_INTENSITY_RPE.moderate],
    ['vigorous', ACTIVITY_INTENSITY_RPE.vigorous],
  ] as const)(
    'préremplit le ressenti depuis l’intensité « %s » quand il manque (sinon charge sRPE nulle)',
    async (intensity, expected) => {
      await addActivity({
        activityType: 'swimming',
        startedAt: '2026-09-18T07:30:00.000Z',
        durationSeconds: 1800,
        intensity,
      });

      expect(rows()[0]!.rpe).toBe(expected);
    },
  );

  it('garde un ressenti explicite plutôt que celui de l’intensité', async () => {
    await addActivity({
      activityType: 'swimming',
      startedAt: '2026-09-18T07:30:00.000Z',
      durationSeconds: 1800,
      intensity: 'vigorous',
      rpe: 4,
    });

    expect(rows()[0]!.rpe).toBe(4);
  });

  it('arrondit durée, distance et calories d’appareil — les colonnes sont entières', async () => {
    await addActivity({
      activityType: 'hiking',
      startedAt: '2026-09-18T07:30:00.000Z',
      durationSeconds: 1800.6,
      intensity: 'moderate',
      distanceM: 7345.4,
      deviceKcal: 410.9,
    });

    expect(rows()[0]).toMatchObject({ duration_seconds: 1801, distance_m: 7345, device_kcal: 411 });
  });

  it('laisse distance, calories et note à null quand elles ne sont pas fournies', async () => {
    await addActivity({
      activityType: 'yoga',
      startedAt: '2026-09-18T07:30:00.000Z',
      durationSeconds: 3600,
      intensity: 'light',
    });

    expect(rows()[0]).toMatchObject({ distance_m: null, device_kcal: null, notes: null });
  });

  it('n’écrit aucune colonne kcal : la dépense se recalcule à la lecture (décision D3)', async () => {
    await addActivity({
      activityType: 'cycling',
      startedAt: '2026-09-18T07:30:00.000Z',
      durationSeconds: 3600,
      intensity: 'moderate',
    });

    expect(Object.keys(rows()[0]!)).not.toContain('kcal');
  });

  it('refuse d’écrire sans session active plutôt que d’insérer une ligne orpheline', async () => {
    getState.mockReturnValue({ session: null });

    await expect(
      addActivity({
        activityType: 'cycling',
        startedAt: '2026-09-18T07:30:00.000Z',
        durationSeconds: 3600,
        intensity: 'moderate',
      }),
    ).rejects.toThrow(/session active/);

    expect(rows()).toHaveLength(0);
  });
});

describe('updateActivity', () => {
  const seedOne = () =>
    seed('activities', [
      {
        id: 'act-1',
        user_id: 'user-1',
        activity_type: 'cycling',
        started_at: '2026-09-18T07:30:00.000Z',
        duration_seconds: 3600,
        intensity: 'moderate',
        rpe: 5,
        distance_m: 20000,
        device_kcal: 500,
        notes: 'note initiale',
      },
    ]);

  it('ne touche que les champs fournis', async () => {
    seedOne();

    await updateActivity('act-1', { notes: 'corrigée' });

    expect(rows()[0]).toMatchObject({
      notes: 'corrigée',
      activity_type: 'cycling',
      duration_seconds: 3600,
      intensity: 'moderate',
      rpe: 5,
    });
  });

  it('fait suivre le ressenti quand l’intensité change sans ressenti explicite', async () => {
    seedOne();

    await updateActivity('act-1', { intensity: 'vigorous' });

    expect(rows()[0]).toMatchObject({ intensity: 'vigorous', rpe: ACTIVITY_INTENSITY_RPE.vigorous });
  });

  it('garde le ressenti fourni quand les deux changent ensemble', async () => {
    seedOne();

    await updateActivity('act-1', { intensity: 'vigorous', rpe: 6 });

    expect(rows()[0]).toMatchObject({ intensity: 'vigorous', rpe: 6 });
  });

  it('accepte de remettre distance, calories et note à null', async () => {
    seedOne();

    await updateActivity('act-1', { distanceM: null, deviceKcal: null, notes: null });

    expect(rows()[0]).toMatchObject({ distance_m: null, device_kcal: null, notes: null });
  });

  it('arrondit les valeurs numériques modifiées', async () => {
    seedOne();

    await updateActivity('act-1', { durationSeconds: 2400.7, distanceM: 15500.2, deviceKcal: 333.8 });

    expect(rows()[0]).toMatchObject({ duration_seconds: 2401, distance_m: 15500, device_kcal: 334 });
  });

  it('ignore une durée fournie à null plutôt que d’écrire une durée vide', async () => {
    seedOne();

    await updateActivity('act-1', { durationSeconds: null as unknown as number });

    expect(rows()[0]!.duration_seconds).toBe(3600);
  });

  it('n’écrit rien du tout quand aucun champ connu n’est fourni', async () => {
    seedOne();
    const before = rows()[0]!;

    await updateActivity('act-1', {});

    expect(rows()[0]!.updated_at).toBe(before.updated_at);
  });
});

describe('deleteActivity', () => {
  it('retire la ligne en soft delete : elle sort des lectures mais reste en base', async () => {
    seed('activities', [
      {
        id: 'act-1',
        user_id: 'user-1',
        activity_type: 'cycling',
        started_at: '2026-09-18T07:30:00.000Z',
        duration_seconds: 3600,
        intensity: 'moderate',
        rpe: 5,
      },
    ]);

    await deleteActivity('act-1');

    expect(rowsOf('activities')).toHaveLength(0);
    expect(rowsOf('activities', true)).toHaveLength(1);
    expect(rowsOf<ActivityRow>('activities', true)[0]!.deleted_at).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Lecture — l'assemblage des lignes en vue
// ---------------------------------------------------------------------------

const mockedQuery = useQuery as unknown as jest.Mock;

/** Alimente `useQuery` avec des lignes brutes de `activities`. */
const feed = (data: Partial<ActivityRow>[]) =>
  mockedQuery.mockReturnValue({ data, isLoading: false, error: undefined });

const row = (over: Partial<ActivityRow>): Partial<ActivityRow> => ({
  id: 'a',
  activity_type: 'cycling',
  started_at: '2026-09-18T09:00:00.000Z',
  duration_seconds: 3600,
  intensity: 'moderate',
  rpe: 5,
  distance_m: null,
  device_kcal: null,
  notes: null,
  ...over,
});

describe('useActivities', () => {
  it('convertit les colonnes SQL en champs de vue', async () => {
    feed([row({ id: 'a1', distance_m: 20000, device_kcal: 500, notes: 'n' })]);

    const { result } = await renderHook(() => useActivities());

    expect(result.current.activities).toEqual([
      {
        id: 'a1',
        activityType: 'cycling',
        startedAt: '2026-09-18T09:00:00.000Z',
        durationSeconds: 3600,
        intensity: 'moderate',
        rpe: 5,
        distanceM: 20000,
        deviceKcal: 500,
        notes: 'n',
      },
    ]);
  });

  it('garde une intensité inconnue telle quelle plutôt que de jeter la ligne', async () => {
    feed([row({ id: 'a1', intensity: 'extreme' })]);

    const { result } = await renderHook(() => useActivities());

    expect(result.current.activities[0]!.intensity).toBe('extreme');
  });

  it('relaie l’état de chargement', async () => {
    mockedQuery.mockReturnValue({ data: [], isLoading: true, error: undefined });

    const { result } = await renderHook(() => useActivities());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.activities).toEqual([]);
  });
});

describe('useActivitiesOnDay', () => {
  it('filtre sur la clé de jour LOCALE, pas sur les 10 premiers caractères d’un horodatage UTC', async () => {
    // 23 h 30 heure de Paris le 18 → `2026-09-18T21:30:00Z`. Un filtre SQL naïf sur `started_at`
    // rangerait cette sortie au bon jour ici, mais pas une sortie de 01 h du matin (cas suivant).
    feed([
      row({ id: 'tard', started_at: new Date('2026-09-18T23:30:00').toISOString() }),
      row({ id: 'tot', started_at: new Date('2026-09-19T01:00:00').toISOString() }),
    ]);

    const { result } = await renderHook(() => useActivitiesOnDay('2026-09-18'));

    expect(result.current.activities.map((a) => a.id)).toEqual(['tard']);
  });

  it('rend une liste vide pour un jour sans activité', async () => {
    feed([row({ id: 'a1', started_at: new Date('2026-09-18T10:00:00').toISOString() })]);

    const { result } = await renderHook(() => useActivitiesOnDay('2026-09-20'));

    expect(result.current.activities).toEqual([]);
  });
});

describe('useActivity', () => {
  it('retrouve une activité par son id', async () => {
    feed([row({ id: 'a1' }), row({ id: 'a2', activity_type: 'yoga' })]);

    const { result } = await renderHook(() => useActivity('a2'));

    expect(result.current.activity?.activityType).toBe('yoga');
  });

  it('rend null pour un id inconnu', async () => {
    feed([row({ id: 'a1' })]);

    const { result } = await renderHook(() => useActivity('absent'));

    expect(result.current.activity).toBeNull();
  });

  it('rend null sans id, sans parcourir la liste', async () => {
    feed([row({ id: 'a1' })]);

    const { result } = await renderHook(() => useActivity(null));

    expect(result.current.activity).toBeNull();
  });
});

describe('useActivityHabits', () => {
  it('remonte les combinaisons répétées, dans la limite demandée', async () => {
    feed([
      row({ id: '1', activity_type: 'cycling', intensity: 'moderate' }),
      row({ id: '2', activity_type: 'cycling', intensity: 'moderate' }),
      row({ id: '3', activity_type: 'yoga', intensity: 'light' }),
      row({ id: '4', activity_type: 'swimming', intensity: 'vigorous' }),
    ]);

    const { result } = await renderHook(() => useActivityHabits(1));

    expect(result.current.habits).toHaveLength(1);
    expect(result.current.habits[0]!.activityType).toBe('cycling');
  });

  it('rend une liste vide sans historique', async () => {
    feed([]);

    const { result } = await renderHook(() => useActivityHabits());

    expect(result.current.habits).toEqual([]);
  });
});
