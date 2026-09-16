import { renderHook } from '@testing-library/react-native';
import { useQuery } from '@powersync/react';

import { useProfile } from '../profile-repository';
import { resetTestDb, rowsOf, seed } from '@/test-utils/sqlite-harness';

jest.mock('@/powersync/system', () => ({
  powerSync: require('@/test-utils/sqlite-harness').testPowerSync,
  connector: {},
}));

type ProfileRow = {
  id: string;
  user_id: string;
  training_level: string | null;
  weekly_availability: number | null;
  strength_session_minutes: number | null;
  strength_equipment: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function seedProfile(overrides: Record<string, unknown> = {}): ProfileRow {
  seed('profiles', [
    {
      id: 'profile-1',
      user_id: 'user-1',
      training_level: 'advanced',
      weekly_availability: 4,
      strength_session_minutes: 60,
      strength_equipment: '["band","barbell"]',
      updated_at: '2026-09-16T08:00:00.000Z',
      ...overrides,
    },
  ]);
  return rowsOf<ProfileRow>('profiles', true)[0]!;
}

async function profileFrom(row: ProfileRow) {
  jest.mocked(useQuery).mockReturnValue({
    data: [row],
    isLoading: false,
    isFetching: false,
    error: undefined,
  } as unknown as ReturnType<typeof useQuery>);
  const { result } = await renderHook(() => useProfile());
  return result.current.profile;
}

beforeEach(() => {
  resetTestDb();
  jest.mocked(useQuery).mockReset();
});

describe('useProfile — les deux champs de contexte CORPS-04 sont lus séparément', () => {
  it('lit les deux champs quand toute la ligne est valide', async () => {
    const profile = await profileFrom(seedProfile());

    expect(profile?.strengthSessionMinutes).toBe(60);
    expect(profile?.strengthEquipment).toEqual(['barbell', 'band']);
  });

  // 🔴 Le défaut différé en Task 2 de CORPS-04. `rowToProfile` validait les quatre champs dans UN
  // SEUL `safeParse` composite : une valeur invalide n'importe où rabattait les DEUX champs
  // CORPS-04 à `null`. Or `training_level` appartient à GUID-01 — une valeur héritée ou écrite par
  // un client plus récent effaçait en silence une durée de séance parfaitement valide, et l'écran
  // « Trouver un programme compatible » repartait de zéro sans le moindre message.
  it('ne perd pas la durée de séance quand le niveau GUID-01 est invalide', async () => {
    const profile = await profileFrom(seedProfile({ training_level: 'grandmaster' }));

    expect(profile?.trainingLevel).toBe('grandmaster');
    expect(profile?.strengthSessionMinutes).toBe(60);
    expect(profile?.strengthEquipment).toEqual(['barbell', 'band']);
  });

  it('ne perd pas la durée de séance quand la disponibilité GUID-01 est hors bornes', async () => {
    const profile = await profileFrom(seedProfile({ weekly_availability: 9 }));

    expect(profile?.strengthSessionMinutes).toBe(60);
    expect(profile?.strengthEquipment).toEqual(['barbell', 'band']);
  });

  // Les deux champs CORPS-04 ne se rabattent pas l'un l'autre non plus : chacun porte son propre
  // verdict, comme le fait déjà le repository dédié (`useStrengthProgramContext`).
  it('garde la durée de séance quand seul le matériel est invalide', async () => {
    const profile = await profileFrom(seedProfile({ strength_equipment: '["band","band"]' }));

    expect(profile?.strengthSessionMinutes).toBe(60);
    expect(profile?.strengthEquipment).toBeNull();
  });

  it('garde le matériel quand seule la durée est invalide', async () => {
    const profile = await profileFrom(seedProfile({ strength_session_minutes: 37 }));

    expect(profile?.strengthSessionMinutes).toBeNull();
    expect(profile?.strengthEquipment).toEqual(['barbell', 'band']);
  });

  it('laisse `null` à `null` — jamais répondu reste jamais répondu', async () => {
    const profile = await profileFrom(
      seedProfile({ strength_session_minutes: null, strength_equipment: null }),
    );

    expect(profile?.strengthSessionMinutes).toBeNull();
    expect(profile?.strengthEquipment).toBeNull();
  });
});
