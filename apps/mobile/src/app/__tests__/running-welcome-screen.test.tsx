/**
 * L'accueil du pilier Course (`app/running-welcome.tsx`) — trois questions (US CARDIO-02, §3.3).
 *
 * Ce que ce fichier verrouille (R16, R17) :
 *  - chaque « Continuer » écrit **sa** page, et rien d'autre ;
 *  - « Plus tard » et « Passer » n'écrivent rien ;
 *  - une allure fausse à la question 2 n'est jamais avalée : le message reste, on ne passe pas ;
 *  - le dernier bouton dit « Terminer », et ferme l'accueil.
 *
 * L'ouverture et son marqueur (R14, R15) vivent dans `useRunningWelcome`, testé à part.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import RunningWelcomeScreen from '../running-welcome';
import { upsertRunnerProfile, useRunnerProfile } from '@/data/repositories/running-profile-repository';
import { useRouter } from 'expo-router';

jest.mock('@/hooks/useMenuFocus', () => ({ useMenuFocus: jest.fn() }));
jest.mock('@/data/repositories/running-profile-repository', () => ({
  useRunnerProfile: jest.fn(),
  upsertRunnerProfile: jest.fn(),
}));
jest.mock('@/data/repositories/running-record-repository', () => ({
  useRunningRecords: () => ({ records: [], isLoading: false }),
}));
jest.mock('@/data/repositories/profile-repository', () => ({ completeOnboarding: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('@/components/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
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
jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    system: 'metric',
    distanceSymbol: 'km',
    paceInputValue: () => '',
    formatPace: (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')} /km`,
  }),
}));

const mockProfile = useRunnerProfile as jest.Mock;
const mockUpsert = upsertRunnerProfile as jest.Mock;
const mockRouter = useRouter as jest.Mock;
const back = jest.fn();

const taperTexte = async (texte: string) => {
  await act(async () => {
    fireEvent.press(screen.getByText(texte));
  });
};
const taper = async (testID: string) => {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
};
const continuer = () => taperTexte('onboarding.continue');

beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.mockReturnValue({ back, replace: jest.fn() });
  mockProfile.mockReturnValue({ runnerProfile: { ref5kPaceSPerKm: null }, isLoading: false });
  mockUpsert.mockResolvedValue(undefined);
});

describe('les trois questions', () => {
  it('🔴 chaque « Continuer » écrit sa page, et rien d’autre', async () => {
    await render(<RunningWelcomeScreen />);

    expect(screen.getByText('running.welcome.step:{"current":1,"total":3}')).toBeTruthy();
    await taper('welcome-objective-10k');
    await taper('welcome-frequency-3');
    expect(mockUpsert).not.toHaveBeenCalled();
    await continuer();
    expect(mockUpsert).toHaveBeenLastCalledWith({ objective: '10k', weeklyFrequency: 3 });

    // Question 2 : un chrono de 10 km.
    expect(screen.getByTestId('running-welcome-pace')).toBeTruthy();
    // Pas de test guidé dans l'accueil : on ne part pas courir au milieu de trois questions.
    await taper('ref-door-test');
    expect(screen.queryByTestId('ref-start-test')).toBeNull();
    expect(screen.getByText('running.refPace.testLater')).toBeTruthy();
    await taper('ref-door-race');
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('ref-time'), '52:30');
    });
    await continuer();
    expect(mockUpsert).toHaveBeenLastCalledWith({ ref5kPaceSPerKm: 302 });

    // Question 3 : la voix.
    await taper('welcome-voice-intervals');
    await taperTexte('running.welcome.finish');
    expect(mockUpsert).toHaveBeenLastCalledWith({ voiceAnnouncementsEnabled: false, intervalGuidanceEnabled: true });
    expect(mockUpsert).toHaveBeenCalledTimes(3);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('🔴 « Plus tard » n’écrit rien, à aucune question', async () => {
    await render(<RunningWelcomeScreen />);

    await taper('welcome-objective-semi');
    await taperTexte('running.welcome.later');
    await taperTexte('running.welcome.later');
    await taper('welcome-voice-all');
    await taperTexte('running.welcome.later');

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('🔴 « Passer » sort de tout sans rien écrire', async () => {
    await render(<RunningWelcomeScreen />);

    await taper('welcome-objective-semi');
    await taperTexte('running.welcome.skipAll');

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('🔴 une allure hors bornes à la question 2 n’est jamais avalée', async () => {
    await render(<RunningWelcomeScreen />);
    await taperTexte('running.welcome.later');

    await taper('ref-door-race');
    await taper('ref-distance-5k');
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('ref-time'), '1:20:00');
    });
    await continuer();

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(screen.getByTestId('running-welcome-pace')).toBeTruthy();
    expect(screen.getByTestId('ref-error')).toBeTruthy();
  });

  it('« Je ne sais pas encore » puis « Continuer » passe sans rien écrire', async () => {
    await render(<RunningWelcomeScreen />);
    await taperTexte('running.welcome.later');

    await taper('ref-door-unknown');
    await continuer();

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(screen.getByTestId('running-welcome-voice')).toBeTruthy();
  });

  it('les choix sont des boutons radio, annoncés comme tels', async () => {
    await render(<RunningWelcomeScreen />);

    await taper('welcome-frequency-4');

    const quatre = screen.getByTestId('welcome-frequency-4');
    expect(quatre.props.accessibilityRole).toBe('radio');
    expect(quatre.props.accessibilityState).toMatchObject({ checked: true });
    expect(quatre.props.accessibilityLabel).toBe('running.welcome.goal.frequencyA11y:{"count":4}');
  });
});
