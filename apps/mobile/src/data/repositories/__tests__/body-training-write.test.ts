import { renderHook } from '@testing-library/react-native';
import { useQuery } from '@powersync/react';
import {
  createBodyVisualDocument,
  createBodyVisualGoal,
  createBodyTrainingDocument,
  parseBodyTrainingDocument,
  prepareBodyVisualSave,
  type BodyGoalZone,
} from '@wellness/shared';

import {
  BodyTrainingSaveError,
  saveBodyTraining,
  useBodyTraining,
} from '../body-training-repository';
import { resetTestDb, rowsOf, seed } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

let mockUserId: string | null = 'user-1';
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: Object.assign(
    (selector: (state: { session: { user: { id: string } } | null }) => unknown) =>
      selector({ session: mockUserId ? { user: { id: mockUserId } } : null }),
    {
      getState: () => ({ session: mockUserId ? { user: { id: mockUserId } } : null }),
    },
  ),
}));

type SettingsRow = {
  id: string;
  user_id: string;
  theme: string | null;
  active_pillars: string | null;
  body_visual_state: string | null;
  body_training_state: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const settings = (includeDeleted = false) =>
  rowsOf<SettingsRow>('user_settings', includeDeleted);

function savedVisualRaw(withGoal = true): string {
  const visual = createBodyVisualDocument();
  if (withGoal) visual.goal = createBodyVisualGoal(visual);
  return JSON.stringify(prepareBodyVisualSave(visual, null, '2026-09-13T12:00:00.000Z'));
}

function seedSettings(overrides: Record<string, unknown> = {}): SettingsRow {
  seed('user_settings', [
    {
      id: 'settings-1',
      user_id: 'user-1',
      theme: 'dark',
      active_pillars: '["strength"]',
      body_visual_state: savedVisualRaw(),
      body_training_state: null,
      ...overrides,
    },
  ]);
  return settings(true)[0]!;
}

async function expectCode(promise: Promise<unknown>, code: BodyTrainingSaveError['code']) {
  await expect(promise).rejects.toMatchObject({ code });
}

beforeEach(() => {
  mockUserId = 'user-1';
  resetTestDb();
  jest.mocked(useQuery).mockReset();
});

describe('saveBodyTraining sur SQLite reel', () => {
  it('sauvegarde puis relit un snapshot de l objectif courant sans toucher les autres colonnes', async () => {
    const before = seedSettings();

    const saved = await saveBodyTraining(['arms'], null, before.body_visual_state);
    const row = settings()[0]!;

    expect(saved).not.toBeNull();
    expect(parseBodyTrainingDocument(row.body_training_state)).toEqual({
      status: 'ready',
      document: saved,
    });
    expect(saved?.sourceGoal.savedAt).toBe('2026-09-13T12:00:00.000Z');
    expect(row.body_visual_state).toBe(before.body_visual_state);
    expect(row).toMatchObject({
      id: before.id,
      user_id: 'user-1',
      theme: 'dark',
      active_pillars: '["strength"]',
      created_at: before.created_at,
      deleted_at: null,
    });
  });

  it('efface uniquement les priorites apres verification des deux snapshots bruts', async () => {
    const before = seedSettings();
    const saved = await saveBodyTraining(['arms'], null, before.body_visual_state);
    const raw = JSON.stringify(saved);

    await expect(saveBodyTraining(null, raw, before.body_visual_state)).resolves.toBeNull();

    const row = settings()[0]!;
    expect(row.body_training_state).toBeNull();
    expect(row.body_visual_state).toBe(before.body_visual_state);
    expect(row.theme).toBe('dark');
  });

  it('refuse un conflit sur les priorites et conserve la valeur courante', async () => {
    const visualRaw = savedVisualRaw();
    seedSettings({ body_visual_state: visualRaw, body_training_state: '{"current":true}' });

    await expectCode(saveBodyTraining(['arms'], null, visualRaw), 'conflict');
    expect(settings()[0]!.body_training_state).toBe('{"current":true}');
  });

  it('refuse un conflit sur le document visuel meme si les priorites n ont pas change', async () => {
    const visualRaw = savedVisualRaw();
    seedSettings({ body_visual_state: visualRaw });

    await expectCode(saveBodyTraining(['arms'], null, savedVisualRaw(false)), 'conflict');
    expect(settings()[0]!.body_training_state).toBeNull();
  });

  it.each(['{', '{"version":99}'])(
    'n ecrase pas un document de priorites invalide ou futur, meme pour effacer : %s',
    async (raw) => {
      const row = seedSettings({ body_training_state: raw });
      await expectCode(saveBodyTraining(null, raw, row.body_visual_state), 'invalid');
      expect(settings()[0]!.body_training_state).toBe(raw);
    },
  );

  it.each(['{', '{"version":99}'])(
    'refuse un document visuel invalide ou futur sans ecriture : %s',
    async (raw) => {
      seedSettings({ body_visual_state: raw });
      await expectCode(saveBodyTraining(['arms'], null, raw), 'invalid');
      expect(settings()[0]!.body_training_state).toBeNull();
    },
  );

  it('refuse de confirmer quand l objectif enregistre manque', async () => {
    const visualRaw = savedVisualRaw(false);
    seedSettings({ body_visual_state: visualRaw });
    await expectCode(saveBodyTraining(['arms'], null, visualRaw), 'goal_missing');
  });

  it('ignore les lignes absente, etrangere ou supprimee', async () => {
    const visualRaw = savedVisualRaw();
    await expectCode(saveBodyTraining(['arms'], null, visualRaw), 'settings_missing');

    seed('user_settings', [
      { id: 'foreign', user_id: 'user-2', body_visual_state: visualRaw, body_training_state: null },
    ]);
    await expectCode(saveBodyTraining(['arms'], null, visualRaw), 'settings_missing');

    resetTestDb();
    seedSettings({ deleted_at: '2026-09-13T11:00:00.000Z' });
    await expectCode(saveBodyTraining(['arms'], null, visualRaw), 'settings_missing');
    expect(settings(true)[0]!.body_training_state).toBeNull();
  });

  it('refuse toute ecriture sans authentification', async () => {
    const row = seedSettings();
    mockUserId = null;
    await expectCode(saveBodyTraining(['arms'], null, row.body_visual_state), 'unauthenticated');
    expect(settings()[0]!.body_training_state).toBeNull();
  });

  it('abandonne une confirmation si le compte change pendant la transaction', async () => {
    const row = seedSettings();
    const saving = saveBodyTraining(['arms'], null, row.body_visual_state);
    mockUserId = 'user-2';
    await expectCode(saving, 'unauthenticated');
    expect(settings()[0]!.body_training_state).toBeNull();
  });

  it.each([
    { priorities: [] },
    { priorities: ['arms', 'arms'] },
    { priorities: ['shoulders', 'chest', 'back', 'arms'] },
  ])(
    'refuse une selection invalide sans aucune ecriture : %j',
    async ({ priorities }) => {
      const row = seedSettings();
      await expectCode(saveBodyTraining(priorities as BodyGoalZone[], null, row.body_visual_state), 'invalid');
      expect(settings()[0]).toEqual(row);
    },
  );

  it.each([null, savedVisualRaw(false)])('permet l effacement si l objectif manque : %s', async (visualRaw) => {
    const goal = { ...createBodyVisualGoal(createBodyVisualDocument()), savedAt: '2026-09-13T12:00:00Z' };
    const raw = JSON.stringify(createBodyTrainingDocument(['arms'], goal, '2026-09-13T12:01:00Z'));
    seedSettings({ body_training_state: raw, body_visual_state: visualRaw });
    await expect(saveBodyTraining(null, raw, visualRaw)).resolves.toBeNull();
    expect(settings()[0]).toMatchObject({ body_training_state: null, body_visual_state: visualRaw });
  });

  it.each(['{', '{"version":99}'])('bloque aussi l effacement si le visuel est illisible : %s', async (raw) => {
    const row = seedSettings({ body_visual_state: raw });
    await expectCode(saveBodyTraining(null, null, raw), 'invalid');
    expect(settings()[0]).toEqual(row);
  });
});

describe('useBodyTraining', () => {
  it('masque les resultats conserves d un autre compte', async () => {
    jest.mocked(useQuery).mockReturnValue({
      data: [{ id: 'foreign', user_id: 'user-2', body_training_state: '{"version":99}' }],
      isLoading: false, isFetching: false, error: undefined,
    });
    const { result } = await renderHook(() => useBodyTraining());
    expect(result.current).toMatchObject({ document: null, raw: null, status: 'empty' });
  });
  it('expose le raw, le statut parse et l erreur de la lecture locale', async () => {
    const error = new Error('sqlite unavailable');
    jest.mocked(useQuery).mockReturnValue({
      data: [{ id: 'settings-1', user_id: 'user-1', body_training_state: '{"version":99}' }],
      isLoading: false,
      isFetching: false,
      error,
    });

    const { result } = await renderHook(() => useBodyTraining());

    expect(result.current).toEqual({
      document: null,
      raw: '{"version":99}',
      status: 'unsupported',
      isLoading: false,
      error,
    });
  });
});
