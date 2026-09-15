import { renderHook } from '@testing-library/react-native';
import { useQuery } from '@powersync/react';
import type { StrengthProgramContext } from '@wellness/shared';

import {
  StrengthProgramContextSaveError,
  saveStrengthProgramContext,
  useStrengthProgramContext,
} from '../strength-program-context-repository';
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

type ProfileRow = {
  id: string;
  user_id: string;
  first_name: string | null;
  training_level: string | null;
  weekly_availability: number | null;
  strength_session_minutes: number | null;
  strength_equipment: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const profiles = (includeDeleted = false) =>
  rowsOf<ProfileRow>('profiles', includeDeleted);

function seedProfile(overrides: Record<string, unknown> = {}): ProfileRow {
  seed('profiles', [
    {
      id: 'profile-1',
      user_id: 'user-1',
      first_name: 'Florian',
      training_level: 'advanced',
      weekly_availability: 4,
      strength_session_minutes: 60,
      strength_equipment: '["band","barbell","bodyweight"]',
      updated_at: '2026-09-15T10:00:00.000Z',
      ...overrides,
    },
  ]);
  return profiles(true)[0]!;
}

const context = (overrides: Partial<StrengthProgramContext> = {}): StrengthProgramContext => ({
  level: 'advanced',
  weeklyAvailability: 4,
  sessionMinutes: 45,
  equipment: ['dumbbell', 'band'],
  ...overrides,
});

async function expectCode(
  promise: Promise<unknown>,
  code: StrengthProgramContextSaveError['code'],
) {
  await expect(promise).rejects.toMatchObject({ code });
}

beforeEach(() => {
  mockUserId = 'user-1';
  resetTestDb();
  jest.mocked(useQuery).mockReset();
  jest.useRealTimers();
});

describe('useStrengthProgramContext', () => {
  it('mappe les faits GUID-01 et décode le matériel dans son ordre canonique', async () => {
    jest.mocked(useQuery).mockReturnValue({
      data: [seedProfile()],
      isLoading: false,
      isFetching: false,
      error: undefined,
    });

    const { result } = await renderHook(() => useStrengthProgramContext());

    expect(result.current).toEqual({
      context: {
        level: 'advanced',
        weeklyAvailability: 4,
        sessionMinutes: 60,
        equipment: ['barbell', 'bodyweight', 'band'],
      },
      updatedAt: '2026-09-15T10:00:00.000Z',
      isLoading: false,
      error: undefined,
    });
  });

  it('distingue absence, chargement et erreur de lecture locale', async () => {
    const queryError = new Error('sqlite unavailable');
    jest.mocked(useQuery).mockReturnValue({
      data: [],
      isLoading: true,
      isFetching: true,
      error: queryError,
    });

    const { result } = await renderHook(() => useStrengthProgramContext());

    expect(result.current).toEqual({
      context: null,
      updatedAt: null,
      isLoading: true,
      error: queryError,
    });
  });

  it('masque un ancien écho SQLite appartenant au compte précédent', async () => {
    jest.mocked(useQuery).mockReturnValue({
      data: [seedProfile({ user_id: 'user-2' })],
      isLoading: false,
      isFetching: false,
      error: undefined,
    });

    const { result } = await renderHook(() => useStrengthProgramContext());

    expect(result.current).toEqual({
      context: null,
      updatedAt: null,
      isLoading: false,
      error: undefined,
    });
  });

  it('signale un contexte stocké illisible sans le confondre avec une absence', async () => {
    jest.mocked(useQuery).mockReturnValue({
      data: [seedProfile({ strength_equipment: '["unknown"]' })],
      isLoading: false,
      isFetching: false,
      error: undefined,
    });

    const { result } = await renderHook(() => useStrengthProgramContext());

    expect(result.current.context).toBeNull();
    expect(result.current.updatedAt).toBe('2026-09-15T10:00:00.000Z');
    expect(result.current.error).toBeDefined();
  });
});

describe('saveStrengthProgramContext sur SQLite réel', () => {
  it('écrit uniquement les deux colonnes CORPS-04 et un unique updated_at', async () => {
    const before = seedProfile();
    jest.useFakeTimers().setSystemTime(new Date('2026-09-15T11:22:33.000Z'));

    const saved = await saveStrengthProgramContext(
      context({ equipment: ['band', 'barbell'] }),
      before.updated_at,
    );
    const after = profiles()[0]!;

    expect(saved).toEqual({
      context: context({ equipment: ['barbell', 'band'] }),
      updatedAt: '2026-09-15T11:22:33.000Z',
    });
    expect(after).toEqual({
      ...before,
      strength_session_minutes: 45,
      strength_equipment: '["barbell","band"]',
      updated_at: '2026-09-15T11:22:33.000Z',
    });
  });

  it('accepte null comme absence de contrainte et ne sérialise jamais un tableau vide', async () => {
    const before = seedProfile();

    await saveStrengthProgramContext(
      context({ sessionMinutes: null, equipment: null }),
      before.updated_at,
    );

    expect(profiles()[0]).toMatchObject({
      strength_session_minutes: null,
      strength_equipment: null,
    });
    await expectCode(
      saveStrengthProgramContext(context({ equipment: [] as never }), profiles()[0]!.updated_at),
      'invalid',
    );
    expect(profiles()[0]!.strength_equipment).toBeNull();
  });

  it('refuse un timestamp obsolète sans écriture partielle', async () => {
    const before = seedProfile();

    await expectCode(
      saveStrengthProgramContext(context(), '2026-09-15T09:59:59.000Z'),
      'conflict',
    );

    expect(profiles()[0]).toEqual(before);
  });

  it('abandonne si le compte change pendant la transaction', async () => {
    const before = seedProfile();

    const saving = saveStrengthProgramContext(context(), before.updated_at);
    mockUserId = 'user-2';

    await expectCode(saving, 'unauthenticated');
    expect(profiles()[0]).toEqual(before);
  });

  it('ignore un profil supprimé et ne le ressuscite pas', async () => {
    const before = seedProfile({ deleted_at: '2026-09-15T10:30:00.000Z' });

    await expectCode(saveStrengthProgramContext(context(), before.updated_at), 'profile_missing');

    expect(profiles(true)[0]).toEqual(before);
  });
});
