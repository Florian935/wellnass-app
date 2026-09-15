/**
 * US DASH-01 (§7.3) — « Demande-moi », testé sur son **contrat** : trois questions, une réponse
 * calculée par le client, et ses sources à un tap.
 *
 * ⚠️ La reformulation par un modèle a été **retirée** le 13/09/2026 (l'app est gratuite en V1, et
 * l'IA était cadrée en palier payant post-V1). La carte n'appelle plus rien : ce fichier n'a plus
 * aucun mock de réseau, et c'est la preuve que la fonctionnalité ne dépendait pas du modèle.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AskCard, type AskQuestion } from '../AskCard';

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
      background: '#fffaf2',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      borderStrong: '#d9c8b0',
      accent: '#b14f2b',
      accentText: '#fff',
      success: '#66714b',
      warnText: '#8a4b12',
    },
  }),
}));

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

const QUESTIONS: AskQuestion[] = [
  {
    key: 'today',
    label: 'Je m’entraîne aujourd’hui ?',
    answer: 'Tout est au vert : bon jour pour pousser.',
    explanation: { steps: [{ key: 'explain.readiness.load.positive' }], confidence: 'high' },
  },
  {
    key: 'eat',
    label: 'Qu’est-ce que je mange ce soir ?',
    answer: 'Il te reste 780 kcal et 46 g de protéines.',
    explanation: null,
  },
];

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => jest.clearAllMocks());

describe('les réponses', () => {
  it('🔴 répondent sans réseau et sans modèle — elles sont calculées ici', async () => {
    await render(<AskCard questions={QUESTIONS} />);

    await taper(screen.getByLabelText('Qu’est-ce que je mange ce soir ?'));
    expect(screen.getByText('Il te reste 780 kcal et 46 g de protéines.')).toBeTruthy();

    await taper(screen.getByLabelText('Je m’entraîne aujourd’hui ?'));
    expect(screen.getByText('Tout est au vert : bon jour pour pousser.')).toBeTruthy();
  });

  it('rien n’est affiché tant qu’aucune question n’est choisie', async () => {
    await render(<AskCard questions={QUESTIONS} />);

    expect(screen.queryByText('Tout est au vert : bon jour pour pousser.')).toBeNull();
  });

  it('se tait quand il n’y a aucune question', async () => {
    await render(<AskCard questions={[]} />);

    expect(screen.queryByTestId('ask-card')).toBeNull();
  });
});

describe('les sources', () => {
  it('« Pourquoi ? » n’apparaît que si la réponse a une explication', async () => {
    await render(<AskCard questions={QUESTIONS} />);

    await taper(screen.getByLabelText('Je m’entraîne aujourd’hui ?'));
    expect(screen.getByLabelText(/explain\.cta/)).toBeTruthy();

    await taper(screen.getByLabelText('Qu’est-ce que je mange ce soir ?'));
    expect(screen.queryByLabelText(/explain\.cta/)).toBeNull();
  });

  it('la feuille s’ouvre sur les étapes du calcul', async () => {
    await render(<AskCard questions={QUESTIONS} />);

    await taper(screen.getByLabelText('Je m’entraîne aujourd’hui ?'));
    await taper(screen.getByLabelText(/explain\.cta/));

    expect(screen.getByTestId('explain-sheet')).toBeTruthy();
    expect(screen.getByText(/explain\.readiness\.load\.positive/)).toBeTruthy();
  });
});
