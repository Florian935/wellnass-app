/**
 * US NUTRI-UX03 — l'onglet Progrès (D12) : « La semaine » de NUTRI-UX02, renommée et inchangée.
 * Un compte sans aucun repas noté ni aucune pesée voit un seul message au lieu de six cartes muettes.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ProgressSection } from '../sections/ProgressSection';
import { useLatestWeight } from '@/data/repositories/bodyweight-repository';
import { useFirstLogDate } from '@/data/repositories/journal-repository';

jest.mock('@/data/repositories/bodyweight-repository', () => ({ useLatestWeight: jest.fn() }));
jest.mock('@/data/repositories/journal-repository', () => ({ useFirstLogDate: jest.fn() }));

const carte = (nom: string) => {
  const Carte = () => {
    const { Text } = require('react-native');
    return <Text>{nom}</Text>;
  };
  Carte.displayName = `Carte(${nom})`;
  return Carte;
};
jest.mock('@/components/nutrition/WeekVerdictCard', () => ({ WeekVerdictCard: carte('verdict') }));
jest.mock('@/components/ProteinPerKgCard', () => ({
  ProteinPerKgCard: ({ window }: { window?: string }) => {
    const { Text } = require('react-native');
    return <Text>{`proteines:${window}`}</Text>;
  },
}));
jest.mock('@/components/WeightGoalCard', () => ({ WeightGoalCard: carte('poids') }));
jest.mock('@/components/nutrition/RegularityCard', () => ({
  RegularityCard: ({ windowDays }: { windowDays: number }) => {
    const { Text } = require('react-native');
    return <Text>{`regularite:${windowDays}`}</Text>;
  },
}));
jest.mock('@/components/TrainingNutritionCrossCard', () => ({ TrainingNutritionCrossCard: carte('tableau-8-semaines') }));

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'fr' }, t: (k: string) => k }),
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ colors: { text: '#000', textMuted: '#666', surface: '#fff', border: '#ddd', accent: '#3f6b1c', accentText: '#fff' } }),
}));

const mockFirst = useFirstLogDate as jest.Mock;
const mockWeight = useLatestWeight as jest.Mock;

const afficher = async () => {
  const onStats = jest.fn();
  const onStart = jest.fn();
  await render(<ProgressSection targetKcal={2400} onStats={onStats} onStart={onStart} />);
  return { onStats, onStart };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFirst.mockReturnValue({ first: '2026-07-01', isLoading: false });
  mockWeight.mockReturnValue({ latest: null, isLoading: false });
});

it('le verdict d’abord, puis les cartes remontées de Stats, dans l’ordre de NUTRI-UX02', async () => {
  await afficher();

  const textes = screen.getAllByText(/^(verdict|proteines|poids|regularite)/).map((n) => n.props.children);
  expect(textes).toEqual(['verdict', 'proteines:7d', 'poids', 'regularite:7']);
});

it('🔴 le tableau 8 semaines reste hors de l’onglet (NUTRI-UX02 R24)', async () => {
  await afficher();

  expect(screen.queryByText('tableau-8-semaines')).toBeNull();
});

it('« Toutes tes statistiques » ouvre Stats', async () => {
  const { onStats } = await afficher();

  await act(async () => {
    fireEvent.press(screen.getByText('nutrition.week.allStats'));
  });
  expect(onStats).toHaveBeenCalled();
});

it('🔴 compte sans repas ni pesée : un seul message, et « Noter un repas »', async () => {
  mockFirst.mockReturnValue({ first: null, isLoading: false });
  const { onStart } = await afficher();

  expect(screen.getByTestId('nutrition-progress-empty')).toBeTruthy();
  expect(screen.queryByText('verdict')).toBeNull();
  await act(async () => {
    fireEvent.press(screen.getByText('nutritionHub.progressEmpty.cta'));
  });
  expect(onStart).toHaveBeenCalled();
});

it('une pesée suffit à montrer les cartes : l’objectif de poids a de quoi parler', async () => {
  mockFirst.mockReturnValue({ first: null, isLoading: false });
  mockWeight.mockReturnValue({ latest: { id: 'w', logDate: '2026-09-20', weightKg: 78 }, isLoading: false });
  await afficher();

  expect(screen.queryByTestId('nutrition-progress-empty')).toBeNull();
  expect(screen.getByText('poids')).toBeTruthy();
});
