/**
 * Hub Bien-être (`app/(tabs)/wellbeing-hub.tsx`) — US BIEN-02, le **vrai** écran, monté.
 *
 * Les sections ont leurs propres tests de briques ; ce qui est vérifié ici est ce que l'écran
 * **décide** :
 *
 *  1. **l'onglet affiché** : un paramètre de route valide (lien entrant, « Ouvrir le journal » d'un
 *     bilan), lu UNE fois puis retiré ; sinon le dernier choisi ; sinon Aujourd'hui ;
 *  2. **pilier éteint, jamais une page vide** : ouvert par un lien alors que le pilier est éteint,
 *     l'écran le dit et mène aux réglages — aucune section, aucune donnée de santé affichée ;
 *  3. **la forme du jour dans la scène** seulement sur Aujourd'hui, pilier allumé.
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import WellbeingHubScreen from '../wellbeing-hub';
import { useWellbeingPillar } from '@/data/repositories/wellbeing-pillar-repository';
import { useWellbeingSection } from '@/stores/wellbeing-section-store';
import { useLocalSearchParams } from 'expo-router';

const mockPush = jest.fn();
const mockSetParams = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({})),
  useRouter: () => ({ push: mockPush, setParams: mockSetParams }),
  useScrollToTop: jest.fn(),
}));
jest.mock('@/data/repositories/wellbeing-pillar-repository', () => ({ useWellbeingPillar: jest.fn() }));
jest.mock('@/hooks/useMenuFocus', () => ({ useMenuFocus: jest.fn() }));
jest.mock('@/components/stage/StageScrollView', () => {
  const { View } = require('react-native');
  return {
    StageScrollView: ({ stage, children, testID }: { stage: React.ReactNode; children: React.ReactNode; testID?: string }) => (
      <View testID={testID}>
        {stage}
        {children}
      </View>
    ),
  };
});
// L'en-tête : trois onglets et deux boutons, sans la scène dessinée.
jest.mock('@/components/wellbeing/WellbeingHeader', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    WellbeingHeader: ({
      section,
      onSection,
      onSettings,
      children,
    }: {
      section: string;
      onSection: (s: string) => void;
      onSettings: () => void;
      children?: React.ReactNode;
    }) => (
      <View>
        <Text testID="current-section">{section}</Text>
        {['today', 'journal', 'insights'].map((s) => (
          <Pressable key={s} testID={`tab-${s}`} onPress={() => onSection(s)} />
        ))}
        <Pressable testID="open-settings" onPress={onSettings} />
        {children}
      </View>
    ),
  };
});
jest.mock('@/components/wellbeing/WellbeingStageSummary', () => {
  const { Text } = require('react-native');
  return { WellbeingStageSummary: () => <Text testID="stage-summary">forme du jour</Text> };
});
jest.mock('@/components/wellbeing/sections/TodaySection', () => {
  const { Text } = require('react-native');
  return { TodaySection: () => <Text testID="section-today">aujourd’hui</Text> };
});
jest.mock('@/components/wellbeing/sections/JournalSection', () => {
  const { Text } = require('react-native');
  return { JournalSection: () => <Text testID="section-journal">journal</Text> };
});
jest.mock('@/components/wellbeing/sections/InsightsSection', () => {
  const { Text } = require('react-native');
  return { InsightsSection: () => <Text testID="section-insights">ce qui compte</Text> };
});
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
jest.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'fr' }, t: (k: string) => k }) }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ colors: { text: '#222', textMuted: '#777' } }) }));

const params = useLocalSearchParams as jest.Mock;
const pillar = useWellbeingPillar as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  useWellbeingSection.setState({ section: null });
  params.mockReturnValue({});
  pillar.mockReturnValue({ enabled: true, isLoading: false });
});

describe('onglet affiché', () => {
  it('ouvre Aujourd’hui par défaut, forme du jour dans la scène', async () => {
    await render(<WellbeingHubScreen />);

    expect(screen.getByTestId('current-section').props.children).toBe('today');
    expect(screen.getByTestId('section-today')).toBeTruthy();
    expect(screen.getByTestId('stage-summary')).toBeTruthy();
  });

  it('rouvre le dernier onglet choisi', async () => {
    useWellbeingSection.setState({ section: 'insights' });
    await render(<WellbeingHubScreen />);

    expect(screen.getByTestId('section-insights')).toBeTruthy();
    // La forme du jour appartient à Aujourd'hui : ailleurs, la scène reste sobre.
    expect(screen.queryByTestId('stage-summary')).toBeNull();
  });

  it('🔴 un lien entrant choisit l’onglet, est retenu, puis le paramètre est retiré', async () => {
    useWellbeingSection.setState({ section: 'insights' });
    params.mockReturnValue({ section: 'journal' });
    await render(<WellbeingHubScreen />);

    expect(screen.getByTestId('section-journal')).toBeTruthy();
    expect(useWellbeingSection.getState().section).toBe('journal');
    // Laissé en place, le paramètre écraserait le choix suivant de l'utilisateur.
    expect(mockSetParams).toHaveBeenCalledWith({ section: undefined });
  });

  it('un paramètre inconnu ne casse rien : dernier choix, sinon Aujourd’hui', async () => {
    params.mockReturnValue({ section: 'nimporte' });
    await render(<WellbeingHubScreen />);

    expect(screen.getByTestId('section-today')).toBeTruthy();
  });

  it('changer d’onglet affiche sa section et le retient', async () => {
    await render(<WellbeingHubScreen />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('tab-journal'));
    });

    expect(screen.getByTestId('section-journal')).toBeTruthy();
    expect(useWellbeingSection.getState().section).toBe('journal');
  });
});

describe('pilier éteint', () => {
  beforeEach(() => {
    pillar.mockReturnValue({ enabled: false, isLoading: false });
  });

  it('🔴 dit qu’il est éteint et mène aux réglages — aucune section, aucune donnée', async () => {
    await render(<WellbeingHubScreen />);

    expect(screen.getByTestId('wellbeing-hub-off')).toBeTruthy();
    for (const id of ['section-today', 'section-journal', 'section-insights', 'stage-summary']) expect(screen.queryByTestId(id)).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('wellbeingHub.off.cta'));
    });
    expect(mockPush).toHaveBeenCalledWith('/wellbeing-settings');
  });

  it('ne clignote pas pendant le chargement des réglages', async () => {
    pillar.mockReturnValue({ enabled: false, isLoading: true });
    await render(<WellbeingHubScreen />);

    expect(screen.queryByTestId('wellbeing-hub-off')).toBeNull();
  });
});

it('le bouton des réglages ouvre les réglages du pilier', async () => {
  await render(<WellbeingHubScreen />);

  await act(async () => {
    fireEvent.press(screen.getByTestId('open-settings'));
  });
  expect(mockPush).toHaveBeenCalledWith('/wellbeing-settings');
});
