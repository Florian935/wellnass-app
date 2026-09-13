import {
  createBodyVisualDocument,
  parseBodyVisualDocument,
  type BodyVisualDocument,
} from '@wellness/shared';
import { BodyVisualSaveError, saveBodyVisual } from '../body-visual-repository';
import { resetTestDb, rowsOf, seed } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

let mockUserId: string | null = 'user-1';
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: {
    getState: () => ({ session: mockUserId ? { user: { id: mockUserId } } : null }),
  },
}));

type SettingsRow = {
  id: string;
  user_id: string;
  theme: string | null;
  active_pillars: string | null;
  body_visual_state: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const settings = (includeDeleted = false) =>
  rowsOf<SettingsRow>('user_settings', includeDeleted);

function seedSettings(overrides: Record<string, unknown> = {}): SettingsRow {
  seed('user_settings', [
    {
      id: 'settings-1',
      user_id: 'user-1',
      theme: 'dark',
      active_pillars: '["strength"]',
      body_visual_state: null,
      ...overrides,
    },
  ]);
  return settings(true)[0]!;
}

async function expectCode(promise: Promise<unknown>, code: BodyVisualSaveError['code']) {
  await expect(promise).rejects.toMatchObject({ code });
}

beforeEach(() => {
  mockUserId = 'user-1';
  resetTestDb();
});

describe('saveBodyVisual sur SQLite réel', () => {
  it('sauvegarde et relit le document JSON sur la ligne de réglages existante', async () => {
    const before = seedSettings();
    const draft = createBodyVisualDocument();
    draft.baseline.proportions.shoulders = 0.75;

    const saved = await saveBodyVisual(draft, null);
    const row = settings()[0]!;

    expect(parseBodyVisualDocument(row.body_visual_state)).toEqual({
      status: 'ready',
      document: saved,
    });
    expect(saved.baseline.proportions.shoulders).toBe(0.75);
    expect(saved.updatedAt).toMatch(/Z$/);
    expect(row.updated_at).toBe(saved.updatedAt);
    expect(row).toMatchObject({
      id: before.id,
      user_id: 'user-1',
      theme: 'dark',
      active_pillars: '["strength"]',
      created_at: before.created_at,
      deleted_at: null,
    });
  });

  it('refuse un raw concurrent et conserve exactement la valeur courante', async () => {
    const current = createBodyVisualDocument();
    current.baseline.base = 'broad_hips';
    const currentRaw = JSON.stringify(current);
    seedSettings({ body_visual_state: currentRaw });
    const draft = createBodyVisualDocument();
    draft.baseline.base = 'broad_shoulders';

    await expectCode(saveBodyVisual(draft, null), 'conflict');
    expect(settings()[0]!.body_visual_state).toBe(currentRaw);
  });

  it.each(['{', '{"version":99}'])(
    'refuse un document attendu illisible ou futur même quand le raw correspond : %s',
    async (raw) => {
      seedSettings({ body_visual_state: raw });

      await expectCode(saveBodyVisual(createBodyVisualDocument(), raw), 'invalid');
      expect(settings()[0]!.body_visual_state).toBe(raw);
    },
  );

  it('compare la chaîne brute, même si deux JSON décrivent le même document', async () => {
    const document = createBodyVisualDocument();
    const storedRaw = JSON.stringify(document);
    const reorderedRaw = JSON.stringify({
      assetVersion: document.assetVersion,
      version: document.version,
      baseline: document.baseline,
      baselineSavedAt: document.baselineSavedAt,
      goal: document.goal,
      updatedAt: document.updatedAt,
    });
    seedSettings({ body_visual_state: storedRaw });

    await expectCode(saveBodyVisual(document, reorderedRaw), 'conflict');
  });

  it('met à jour uniquement la ligne possédée par la session capturée', async () => {
    seedSettings();
    seed('user_settings', [
      { id: 'settings-2', user_id: 'user-2', body_visual_state: null, theme: 'light' },
    ]);
    const saved = await saveBodyVisual(createBodyVisualDocument(), null);

    expect(settings().find((row) => row.user_id === 'user-1')?.body_visual_state).toBe(
      JSON.stringify(saved),
    );
    expect(settings().find((row) => row.user_id === 'user-2')?.body_visual_state).toBeNull();
  });

  it('retourne settings_missing sans créer de seconde ligne si la ligne possédée manque', async () => {
    seed('user_settings', [{ id: 'settings-2', user_id: 'user-2', body_visual_state: null }]);
    await expectCode(saveBodyVisual(createBodyVisualDocument(), null), 'settings_missing');
    expect(settings(true)).toHaveLength(1);
  });

  it('ignore une ligne supprimée et retourne settings_missing', async () => {
    seedSettings({ deleted_at: '2026-09-12T07:00:00.000Z' });
    await expectCode(saveBodyVisual(createBodyVisualDocument(), null), 'settings_missing');
    expect(settings(true)[0]!.body_visual_state).toBeNull();
  });

  it('refuse toute écriture sans authentification', async () => {
    seedSettings();
    mockUserId = null;
    await expectCode(saveBodyVisual(createBodyVisualDocument(), null), 'unauthenticated');
    expect(settings()[0]!.body_visual_state).toBeNull();
  });

  it('refuse un brouillon invalide avant écriture', async () => {
    seedSettings();
    const draft = createBodyVisualDocument();
    draft.baseline.proportions.waist = 9;
    await expectCode(saveBodyVisual(draft as BodyVisualDocument, null), 'invalid');
    expect(settings()[0]!.body_visual_state).toBeNull();
  });
});
