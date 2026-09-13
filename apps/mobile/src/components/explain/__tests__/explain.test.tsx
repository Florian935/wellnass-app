/**
 * US DASH-01 (§6.1) — « Pourquoi ? », testé sur son **contrat** : les étapes viennent de la brique,
 * la confiance est dite, et « ce n'est pas ça » n'atteint que les règles contestables.
 *
 * Le magasin de poids est testé ici aussi : c'est lui qui garantit qu'un désaccord **atténue** une
 * règle sans jamais la retourner (R12).
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ExplainSheet } from '../ExplainSheet';
import { ExplainButton } from '../ExplainButton';
import { DISAGREE_STEP, useRuleWeights } from '@/stores/rule-weights-store';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
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

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const EXPLICATION = {
  steps: [
    { key: 'explain.kcal.tdee', value: 2380 },
    { key: 'explain.kcal.objective', value: -300 },
    { key: 'explain.kcal.target', value: 2080 },
  ],
  confidence: 'high' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  // Le magasin est un singleton : sans remise à zéro, un désaccord fuit sur le test suivant.
  useRuleWeights.setState({ weights: {}, hydrated: true });
});

describe('la feuille', () => {
  it('rend chaque étape du calcul, et le niveau de confiance', async () => {
    await render(
      <ExplainSheet visible title="Cible du jour" explanation={EXPLICATION} onClose={jest.fn()} />,
    );

    expect(screen.getByText(/explain\.kcal\.tdee/)).toBeTruthy();
    expect(screen.getByText(/explain\.kcal\.target/)).toBeTruthy();
    expect(screen.getAllByText('explain.confidence.high').length).toBeGreaterThan(0);
  });

  it('🔴 sans explication disponible, le dit — elle n’en invente pas', async () => {
    await render(
      <ExplainSheet visible title="Cible du jour" explanation={null} onClose={jest.fn()} />,
    );

    expect(screen.getByText('explain.unavailable')).toBeTruthy();
    expect(screen.queryByText(/explain\.confidence/)).toBeNull();
  });

  it('🔴 aucune règle contestable par défaut : on ne pondère pas un garde-fou', async () => {
    await render(
      <ExplainSheet visible title="Cible du jour" explanation={EXPLICATION} onClose={jest.fn()} />,
    );

    expect(screen.queryByText('explain.disagreeTitle')).toBeNull();
  });
});

describe('« ce n’est pas ça »', () => {
  it('atténue la règle d’un cran, et la restaure ensuite', async () => {
    await render(
      <ExplainSheet
        visible
        title="Projection"
        explanation={EXPLICATION}
        weightableRules={['sleep']}
        onClose={jest.fn()}
      />,
    );

    await taper(screen.getByLabelText(/explain\.disagree/));
    expect(useRuleWeights.getState().weights.sleep).toBeCloseTo(1 - DISAGREE_STEP, 5);

    // Le bouton devient « finalement si » : la règle retrouve sa pleine force.
    await taper(screen.getByLabelText(/explain\.ruleRestore/));
    expect(useRuleWeights.getState().weights.sleep).toBeUndefined();
  });

  it('🔴 trois désaccords neutralisent la règle, sans jamais l’inverser', async () => {
    const { disagree } = useRuleWeights.getState();
    disagree('protein');
    disagree('protein');
    disagree('protein');
    disagree('protein');

    // Bornée à zéro : une règle atténuée ne peut pas devenir un effet négatif.
    expect(useRuleWeights.getState().weights.protein).toBe(0);
  });
});

describe('le bouton', () => {
  it('porte le sujet qu’il explique', async () => {
    const onPress = jest.fn();
    await render(<ExplainButton onPress={onPress} color="#000" subject="Cible du jour" />);

    await taper(screen.getByLabelText('explain.cta Cible du jour'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
