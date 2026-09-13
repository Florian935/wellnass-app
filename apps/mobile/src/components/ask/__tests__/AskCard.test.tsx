/**
 * US DASH-01 (§7.3) — « Demande-moi », testé sur **l'inversion** qui le définit : la réponse est
 * calculée par le client, le modèle ne fait que la formuler. Donc sans IA, la carte répond quand
 * même — et un modèle qui renvoie n'importe quoi ne change jamais un chiffre affiché.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AskCard, type AskQuestion } from '../AskCard';
import { useAiAvailability } from '@/hooks/useAiAvailability';
import { callAiAssist } from '@/lib/ai/ai-client';

jest.mock('@/hooks/useAiAvailability', () => ({ useAiAvailability: jest.fn() }));
jest.mock('@/lib/ai/ai-client', () => ({ callAiAssist: jest.fn() }));
jest.mock('@/lib/analytics', () => ({
  ANALYTICS_EVENTS: { aiAskUsed: 'ai_ask_used' },
  track: jest.fn(),
}));

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

const mockAvailability = useAiAvailability as jest.Mock;
const mockCall = callAiAssist as jest.Mock;

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

beforeEach(() => {
  jest.clearAllMocks();
  mockAvailability.mockReturnValue({ consented: true, ready: true, online: true, quota: 30 });
  mockCall.mockResolvedValue({ ok: false, code: 'failed' });
});

describe('sans IA', () => {
  it('🔴 répond quand même — la réponse déterministe EST la réponse', async () => {
    mockAvailability.mockReturnValue({ consented: false, ready: false, online: true, quota: 30 });
    await render(<AskCard questions={QUESTIONS} />);

    await taper(screen.getByLabelText('Qu’est-ce que je mange ce soir ?'));

    expect(screen.getByText('Il te reste 780 kcal et 46 g de protéines.')).toBeTruthy();
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('se tait quand il n’y a aucune question', async () => {
    await render(<AskCard questions={[]} />);
    expect(screen.queryByTestId('ask-card')).toBeNull();
  });
});

describe('avec IA', () => {
  it('le modèle ne fait que reformuler, et la carte le dit', async () => {
    mockCall.mockResolvedValue({ ok: true, text: '{"headline":"Feu vert : pousse aujourd\'hui."}', used: 1, quota: 30 });
    await render(<AskCard questions={QUESTIONS} />);

    await taper(screen.getByLabelText('Je m’entraîne aujourd’hui ?'));

    expect(screen.getByText("Feu vert : pousse aujourd'hui.")).toBeTruthy();
    expect(screen.getByText('ask.rephrased')).toBeTruthy();
  });

  it('🔴 une réponse illisible du modèle laisse la réponse calculée en place', async () => {
    // Le garde-fou central : un modèle qui déraille ne peut pas changer ce qui est affiché.
    mockCall.mockResolvedValue({ ok: true, text: 'je ne suis pas du JSON', used: 1, quota: 30 });
    await render(<AskCard questions={QUESTIONS} />);

    await taper(screen.getByLabelText('Je m’entraîne aujourd’hui ?'));

    expect(screen.getByText('Tout est au vert : bon jour pour pousser.')).toBeTruthy();
    expect(screen.queryByText('ask.rephrased')).toBeNull();
  });

  it('🔴 un échec d’appel ne casse rien : la réponse reste', async () => {
    mockCall.mockResolvedValue({ ok: false, code: 'quota-exceeded' });
    await render(<AskCard questions={QUESTIONS} />);

    await taper(screen.getByLabelText('Je m’entraîne aujourd’hui ?'));

    expect(screen.getByText('Tout est au vert : bon jour pour pousser.')).toBeTruthy();
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
});
