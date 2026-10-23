/**
 * « Ton allure de référence » (`app/running-pace.tsx`) — le vrai écran, et les vraies portes.
 *
 * US CARDIO-02 (§3.1, R1 → R8). Ce que ce fichier verrouille :
 *  - **rien n'est écrit avant « Retenir cette allure »**, et une seule fois, arrondi (R6, R1) ;
 *  - l'aperçu montre l'allure et les quatre allures avant de retenir, « Avant » quand on en change ;
 *  - une saisie hors bornes se dit, et ne s'écrit pas (R4) ;
 *  - « Je ne sais pas encore » n'existe que sans allure (R7) ;
 *  - les meilleurs temps remplissent la porte, le test se lance ou se saisit, la mesure d'un test non
 *    retenu pré-remplit la porte (R8).
 *
 * Les calculs eux-mêmes sont testés dans `@wellness/shared` (`reference-pace.test.ts`).
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import RunningPaceScreen from '../running-pace';
import { upsertRunnerProfile, useRunnerProfile } from '@/data/repositories/running-profile-repository';
import { useRunningRecords } from '@/data/repositories/running-record-repository';
import { usePendingCooperTest } from '@/running/cooper-measure';
import { useCooperTest } from '@/stores/cooper-test-store';
import { useLocalSearchParams, useRouter } from 'expo-router';

jest.mock('@/hooks/useMenuFocus', () => ({ useMenuFocus: jest.fn() }));
jest.mock('@/data/repositories/running-profile-repository', () => ({
  useRunnerProfile: jest.fn(),
  upsertRunnerProfile: jest.fn(),
}));
jest.mock('@/data/repositories/running-record-repository', () => ({
  useRunningRecords: jest.fn(),
}));
jest.mock('@/running/cooper-measure', () => ({ usePendingCooperTest: jest.fn() }));
jest.mock('@/lib/secure-storage', () => ({
  secureStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('expo-router', () => ({ useRouter: jest.fn(), useLocalSearchParams: jest.fn() }));
jest.mock('@/components/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({
      label,
      onPress,
      disabled,
      testID,
    }: {
      label: string;
      onPress: () => void;
      disabled?: boolean;
      testID?: string;
    }) => (
      <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#786a59',
      background: '#f7eede',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#e3d3ba',
      borderStrong: '#90897d',
      accent: '#2a64ad',
      accentText: '#ffffff',
      warn: '#f5e6c4',
      warnBorder: '#e0c98c',
      warnText: '#6b4c0f',
    },
  }),
}));
jest.mock('@/hooks/useUnits', () => ({ useUnits: jest.fn() }));

const mockProfile = useRunnerProfile as jest.Mock;
const mockUpsert = upsertRunnerProfile as jest.Mock;
const mockRecords = useRunningRecords as jest.Mock;
const mockPending = usePendingCooperTest as jest.Mock;
const mockRouter = useRouter as jest.Mock;
const mockParams = useLocalSearchParams as jest.Mock;
const mockUnits = jest.requireMock('@/hooks/useUnits').useUnits as jest.Mock;
const back = jest.fn();
const push = jest.fn();

const mmss = (s: number) => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
const unites = (system: 'metric' | 'imperial' = 'metric') => ({
  system,
  distanceSymbol: system === 'imperial' ? 'mi' : 'km',
  paceInputValue: (s: number | null | undefined) =>
    s == null ? '' : mmss(system === 'imperial' ? s / 0.6213711922 : s),
  formatPace: (s: number) => `${mmss(system === 'imperial' ? s / 0.6213711922 : s)} /${system === 'imperial' ? 'mi' : 'km'}`,
});

const afficher = async ({
  ref = null as number | null,
  system = 'metric' as 'metric' | 'imperial',
} = {}) => {
  mockProfile.mockReturnValue({ runnerProfile: ref == null ? null : { ref5kPaceSPerKm: ref }, isLoading: false });
  mockUnits.mockReturnValue(unites(system));
  await render(<RunningPaceScreen />);
};

const taper = async (testID: string) => {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
};
const saisir = async (testID: string, valeur: string) => {
  await act(async () => {
    fireEvent.changeText(screen.getByTestId(testID), valeur);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.mockReturnValue({ back, push });
  mockParams.mockReturnValue({});
  mockUpsert.mockResolvedValue(undefined);
  mockRecords.mockReturnValue({ records: [], isLoading: false });
  mockPending.mockReturnValue(null);
  useCooperTest.setState({ marker: null, hydrated: true });
});

describe('les portes, et rien d’écrit avant « Retenir »', () => {
  it('🔴 un chrono donne l’aperçu, et n’écrit qu’au « Retenir », une seule fois', async () => {
    await afficher();

    await taper('ref-door-race');
    await saisir('ref-time', '52:30'); // 10 km par défaut
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(screen.getByTestId('ref-preview')).toBeTruthy();
    expect(screen.getByText('5:02 /km')).toBeTruthy();
    // Les quatre allures qu'elle produit, avant de valider.
    for (const type of ['endurance', 'sortie_longue', 'recuperation', 'fractionne']) {
      expect(screen.getByText(`running.sessionType.${type}`)).toBeTruthy();
    }

    await taper('running-pace-save');

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith({ ref5kPaceSPerKm: 302 });
    expect(back).toHaveBeenCalled();
  });

  it('🔴 sans porte choisie, « Retenir » ne fait rien', async () => {
    await afficher();

    await taper('running-pace-save');

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('🔴 hors bornes : le message, pas d’aperçu, pas d’écriture', async () => {
    await afficher();

    await taper('ref-door-race');
    await taper('ref-distance-5k');
    await saisir('ref-time', '1:20:00');

    expect(screen.getByTestId('ref-error')).toBeTruthy();
    expect(screen.getByText(/running\.refPace\.error\.tooSlow/)).toBeTruthy();
    expect(screen.queryByTestId('ref-preview')).toBeNull();
    await taper('running-pace-save');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('« Autre » ouvre un champ de distance', async () => {
    await afficher();

    await taper('ref-door-race');
    expect(screen.queryByTestId('ref-custom-distance')).toBeNull();
    await taper('ref-distance-other');
    await saisir('ref-custom-distance', '0,5');
    await saisir('ref-time', '3:00');

    expect(screen.getByText('running.refPace.error.badDistance')).toBeTruthy();
  });
});

describe('changer une allure existante', () => {
  it('« Avant » rappelle l’ancienne, et « Je ne sais pas encore » disparaît', async () => {
    await afficher({ ref: 320 });

    expect(screen.queryByTestId('ref-door-unknown')).toBeNull();
    await taper('ref-door-known');
    // Le champ part de l'allure actuelle.
    expect(screen.getByTestId('ref-known').props.value).toBe('5:20');
    await saisir('ref-known', '4:58');

    expect(screen.getByTestId('ref-before')).toBeTruthy();
    await taper('running-pace-save');
    expect(mockUpsert).toHaveBeenCalledWith({ ref5kPaceSPerKm: 298 });
  });

  it('les meilleurs temps remplissent la porte du chrono', async () => {
    mockRecords.mockReturnValue({
      records: [
        { distanceKey: '1k', bestTimeSeconds: 280, runId: 'r0', achievedAt: '2026-10-01T08:00:00Z' },
        { distanceKey: '10k', bestTimeSeconds: 3252, runId: 'r1', achievedAt: '2026-10-03T08:00:00Z' },
      ],
      isLoading: false,
    });
    await afficher({ ref: 320 });

    await taper('ref-door-race');
    // Le 1 km n'est pas proposé : trop court pour une course de référence.
    expect(screen.queryByTestId('ref-record-1k')).toBeNull();
    await taper('ref-record-10k');

    expect(screen.getByTestId('ref-time').props.value).toBe('54:12');
    expect(screen.getByTestId('ref-distance-10k').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByText('5:12 /km')).toBeTruthy();
  });

  it('🔴 en impérial, l’allure saisie au mile est arrondie à la seconde par km', async () => {
    await afficher({ system: 'imperial' });

    await taper('ref-door-known');
    await saisir('ref-known', '8:00');
    await taper('running-pace-save');

    expect(mockUpsert).toHaveBeenCalledWith({ ref5kPaceSPerKm: 298 });
  });
});

describe('je ne sais pas encore', () => {
  it('existe sans allure, et n’écrit rien', async () => {
    await afficher();

    await taper('ref-door-unknown');
    expect(screen.getByText('running.refPace.door.unknown.detail')).toBeTruthy();
    await taper('running-pace-save');

    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

describe('le test de 12 minutes', () => {
  it('« Le faire maintenant » lance la course du test', async () => {
    await afficher();

    await taper('ref-door-test');
    await taper('ref-start-test');

    expect(push).toHaveBeenCalledWith({ pathname: '/run', params: { test: 'cooper' } });
  });

  it('« Je l’ai déjà fait » : 2 400 m donnent 5:14 /km', async () => {
    await afficher();

    await taper('ref-door-test');
    await taper('ref-test-done');
    await saisir('ref-test-distance', '2400');
    await taper('running-pace-save');

    expect(mockUpsert).toHaveBeenCalledWith({ ref5kPaceSPerKm: 314 });
  });

  it('🔴 la mesure d’un test non retenu pré-remplit la porte, et la retenir clôt le test', async () => {
    mockPending.mockReturnValue({ distanceM: 2400, date: '2026-10-23T08:00:00Z' });
    useCooperTest.setState({ marker: { runId: 'r-test', interrupted: false }, hydrated: true });
    await afficher();

    await taper('ref-door-test');
    expect(screen.getByTestId('ref-test-distance').props.value).toBe('2400');
    expect(screen.getByTestId('ref-test-pending')).toBeTruthy();
    await taper('running-pace-save');

    expect(mockUpsert).toHaveBeenCalledWith({ ref5kPaceSPerKm: 314 });
    expect(useCooperTest.getState().marker).toBeNull();
  });

  it('la porte peut être présélectionnée par la route', async () => {
    mockParams.mockReturnValue({ door: 'test' });
    await afficher();

    expect(screen.getByTestId('ref-door-test').props.accessibilityState).toMatchObject({ checked: true });
  });
});
