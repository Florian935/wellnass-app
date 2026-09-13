/**
 * US DASH-01 (§6.3) — « Et si… », testé sur son **contrat** : pas d'historique, pas de chiffre ; un
 * levier bouge la projection ; l'éventail est toujours affiché ; et les conséquences ailleurs
 * (charge, calories) suivent le même levier.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { WhatIfCard } from '../WhatIfCard';
import { useStrengthSection } from '@/data/repositories/strength-repository';
import { useNutritionSummary, useTrainingLoadAlert } from '@/data/repositories/dashboard-repository';
import { useLatestWeight } from '@/data/repositories/bodyweight-repository';
import { useRuleWeights } from '@/stores/rule-weights-store';

jest.mock('@/data/repositories/strength-repository', () => ({
  useStrengthSection: jest.fn(),
}));
jest.mock('@/data/repositories/dashboard-repository', () => ({
  useNutritionSummary: jest.fn(() => ({ target: 2400 })),
  useTrainingLoadAlert: jest.fn(() => null),
}));
jest.mock('@/data/repositories/bodyweight-repository', () => ({
  useLatestWeight: jest.fn(() => ({ latest: { weightKg: 78 }, isLoading: false })),
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

const mockSection = useStrengthSection as jest.Mock;
const mockNutrition = useNutritionSummary as jest.Mock;
const mockLoad = useTrainingLoadAlert as jest.Mock;
const mockWeight = useLatestWeight as jest.Mock;

/** Un historique de force réel : douze points sur six mois, en progression régulière. */
const historique = (points = 12) =>
  Array.from({ length: points }, (_, i) => ({
    date: `2026-0${Math.floor(i / 4) + 1}-${String((i % 4) * 7 + 1).padStart(2, '0')}`,
    totalKg: 300 + i * 5,
  }));

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

/** La projection affichée, en kg — lue dans la clé i18n rendue par le mock de `t`. */
const projete = (): number => {
  const texte = screen.getByText(/whatIf\.projected/).props.children as string;
  return JSON.parse(texte.split(':').slice(1).join(':')).kg as number;
};

beforeEach(() => {
  jest.clearAllMocks();
  useRuleWeights.setState({ weights: {}, hydrated: true });
  mockSection.mockReturnValue({ history: historique(), isLoading: false });
  mockNutrition.mockReturnValue({ target: 2400 });
  mockLoad.mockReturnValue(null);
  mockWeight.mockReturnValue({ latest: { weightKg: 78 }, isLoading: false });
});

describe('sans historique suffisant', () => {
  it('🔴 dit ce qui manque, et AUCUN chiffre', async () => {
    mockSection.mockReturnValue({ history: historique(2), isLoading: false });
    await render(<WhatIfCard baselineSessions={3} />);

    expect(screen.getByText(/whatIf\.need/)).toBeTruthy();
    expect(screen.queryByText(/whatIf\.projected/)).toBeNull();
    expect(screen.queryByText(/whatIf\.range/)).toBeNull();
  });
});

describe('les leviers', () => {
  it('une séance de plus augmente la projection', async () => {
    await render(<WhatIfCard baselineSessions={3} />);

    const avant = projete();
    await taper(screen.getByLabelText('whatIf.sessionsMore'));
    expect(projete()).toBeGreaterThan(avant);
  });

  it('🔴 l’éventail d’incertitude est TOUJOURS affiché avec le chiffre', async () => {
    await render(<WhatIfCard baselineSessions={3} />);

    expect(screen.getByText(/whatIf\.range/)).toBeTruthy();
  });

  it('🔴 deux séances de plus sans sommeil = surcharge, et la projection en tient compte', async () => {
    await render(<WhatIfCard baselineSessions={3} />);

    await taper(screen.getByLabelText('whatIf.sessionsMore'));
    const uneDePlus = projete();
    await taper(screen.getByLabelText('whatIf.sessionsMore'));

    // Le garde-fou de surcharge (×0,82) rattrape le gain de la deuxième séance.
    expect(screen.getByText('whatIf.overreach')).toBeTruthy();
    expect(projete()).toBeLessThan(uneDePlus);
  });
});

describe('les conséquences ailleurs', () => {
  it('la cible calorique suit les séances ajoutées', async () => {
    await render(<WhatIfCard baselineSessions={3} />);

    const lire = () =>
      JSON.parse(
        (screen.getByText(/whatIf\.kcal/).props.children as string).split(':').slice(1).join(':'),
      ).kcal as number;

    const avant = lire();
    await taper(screen.getByLabelText('whatIf.sessionsMore'));
    expect(lire()).toBeGreaterThan(avant);
  });

  it('la charge n’apparaît que si elle est calculable', async () => {
    await render(<WhatIfCard baselineSessions={3} />);
    expect(screen.queryByText(/whatIf\.load/)).toBeNull();

    mockLoad.mockReturnValue({ ratio: 1.1, zone: 'safe', showAlert: false });
    await render(<WhatIfCard baselineSessions={3} />);
    expect(screen.getByText(/whatIf\.load/)).toBeTruthy();
  });
});
