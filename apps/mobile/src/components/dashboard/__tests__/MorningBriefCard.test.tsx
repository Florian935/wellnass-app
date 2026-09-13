/**
 * US DASH-01 (§6.2) — le brief du matin, testé sur son **contrat** : trois phrases au plus, la
 * lecture qui s'arrête, et la transcription qui suit la voix. Aucun réseau, aucune IA : ce qui est
 * lu est exactement ce qui est écrit.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import type { BriefFacts } from '@wellness/shared';
import { MorningBriefCard } from '../MorningBriefCard';

jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (k: string, opts?: Record<string, unknown>) =>
      opts && Object.keys(opts).length > 0 ? `${k}:${JSON.stringify(opts)}` : k,
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#786a59',
      surface: '#fffaf2',
      border: '#ece0cd',
      borderStrong: '#d9c8b0',
      accent: '#b14f2b',
    },
  }),
}));

const speak = Speech.speak as jest.Mock;
const stop = Speech.stop as jest.Mock;

const FAITS: BriefFacts = {
  verdict: 'push',
  todaySession: { title: 'Push A', time: '18:30' },
  nearRecord: { exerciseName: 'Squat', gapKind: 'kg', gap: 2.5 },
  proteinGapG: 40,
  streak: 12,
  realLifeActive: false,
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => jest.clearAllMocks());

describe('le brief', () => {
  it('trois phrases au plus, dans l’ordre : forme, séance, record', async () => {
    await render(<MorningBriefCard facts={FAITS} speechLanguage="fr-FR" />);

    expect(screen.getByText('brief.verdict.push')).toBeTruthy();
    expect(screen.getByText(/brief\.sessionAt/)).toBeTruthy();
    expect(screen.getByText(/brief\.nearRecordKg/)).toBeTruthy();
    // Les protéines et la série sont écartées : trois phrases, pas plus (BRIEF_MAX_SENTENCES).
    expect(screen.queryByText(/brief\.protein/)).toBeNull();
    expect(screen.queryByText(/brief\.streak/)).toBeNull();
  });

  it('🔴 se tait quand il n’a rien à dire', async () => {
    const vide: BriefFacts = {
      verdict: null,
      todaySession: null,
      nearRecord: null,
      proteinGapG: null,
      streak: 0,
      realLifeActive: false,
    };
    await render(<MorningBriefCard facts={vide} speechLanguage="fr-FR" />);

    expect(screen.queryByTestId('morning-brief-card')).toBeNull();
  });

  it('pendant une période « vie réelle », la phrase est douce — aucun verdict', async () => {
    await render(<MorningBriefCard facts={{ ...FAITS, realLifeActive: true }} speechLanguage="fr-FR" />);

    expect(screen.getByText('brief.gentle')).toBeTruthy();
    expect(screen.queryByText('brief.verdict.push')).toBeNull();
  });
});

describe('la lecture', () => {
  it('lit chaque phrase dans la langue de l’app', async () => {
    await render(<MorningBriefCard facts={FAITS} speechLanguage="fr-FR" />);

    await taper(screen.getByLabelText('brief.listen'));

    expect(speak).toHaveBeenCalledTimes(3);
    expect(speak.mock.calls[0]?.[1]).toMatchObject({ language: 'fr-FR' });
  });

  it('🔴 un second appui ARRÊTE la lecture au lieu de la relancer', async () => {
    await render(<MorningBriefCard facts={FAITS} speechLanguage="fr-FR" />);

    await taper(screen.getByLabelText('brief.listen'));
    // La première phrase démarre : la carte passe en lecture.
    await act(async () => {
      speak.mock.calls[0]?.[1]?.onStart?.();
    });

    await taper(screen.getByLabelText('brief.stop'));
    expect(stop).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledTimes(3);
  });

  it('🔴 la voix ne survit pas à l’écran', async () => {
    const { unmount } = await render(<MorningBriefCard facts={FAITS} speechLanguage="fr-FR" />);

    await act(async () => {
      unmount();
    });
    expect(stop).toHaveBeenCalled();
  });
});
