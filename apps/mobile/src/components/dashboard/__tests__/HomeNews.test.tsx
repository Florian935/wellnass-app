/**
 * « Du nouveau » (`HomeNews`, US ACCUEIL-08) — deux cartes au plus.
 *
 * L'ordre et le plafond vivent dans `selectHomeNews` (`home-sections.test.ts`). Ici, ce que le
 * composant ajoute : QUAND chaque source compte comme « du nouveau » (le parcours à partir du jour
 * 2, le record le jour même et le lendemain, le record à portée un jour de séance seulement), et que
 * chaque carte garde son composant d'origine.
 */
import '@/i18n';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { HomeNews } from '../HomeNews';
import { useVisibleGoalConflict } from '@/components/dashboard/GoalConflictBanner';
import { useSinceLastVisit } from '@/components/dashboard/SinceLastVisitCard';
import { useActivationPath } from '@/data/repositories/activation-path-repository';
import { useMostRecentRecord } from '@/data/repositories/dashboard-repository';
import { useGoals } from '@/data/repositories/goal-repository';
import { useInsights } from '@/data/repositories/insights-repository';
import { usePressingLink } from '@/data/repositories/cross-links-repository';
import { useNearRecords } from '@/data/repositories/records-repository';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: () => '2026-10-25' }));
jest.mock('@/hooks/useUnits', () => ({ useUnits: () => ({ formatWeight: (kg: number) => `${kg} kg` }) }));

/** Les cartes d'origine, réduites à leur nom : leurs propres tests couvrent leur contenu. */
jest.mock('@/components/dashboard/GoalConflictBanner', () => {
  const { Text } = require('react-native');
  return { GoalConflictBanner: () => <Text>CARTE conflit</Text>, useVisibleGoalConflict: jest.fn() };
});
jest.mock('@/components/dashboard/SinceLastVisitCard', () => {
  const { Text } = require('react-native');
  return { SinceLastVisitCard: () => <Text>CARTE depuis</Text>, useSinceLastVisit: jest.fn() };
});
jest.mock('@/components/dashboard/ActivationPathCard', () => {
  const { Text } = require('react-native');
  return { ActivationPathCard: () => <Text>CARTE parcours</Text> };
});
jest.mock('@/components/dashboard/InsightsCard', () => {
  const { Text } = require('react-native');
  return { InsightsCard: () => <Text>CARTE labo</Text> };
});
jest.mock('@/components/goals/GoalCard', () => {
  const { Text } = require('react-native');
  return { GoalCard: () => <Text>CARTE objectif</Text> };
});
jest.mock('@/data/repositories/activation-path-repository', () => ({ useActivationPath: jest.fn() }));
jest.mock('@/data/repositories/dashboard-repository', () => ({ useMostRecentRecord: jest.fn() }));
jest.mock('@/data/repositories/goal-repository', () => ({ useGoals: jest.fn() }));
jest.mock('@/data/repositories/insights-repository', () => ({ useInsights: jest.fn() }));
jest.mock('@/data/repositories/insights-context', () => ({
  InsightsProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/data/repositories/cross-links-repository', () => ({ usePressingLink: jest.fn() }));
jest.mock('@/data/repositories/records-repository', () => ({ useNearRecords: jest.fn() }));

const push = jest.fn();

/** Rien de neuf : chaque test n'allume que ce qu'il éprouve. */
function quiet() {
  (useRouter as jest.Mock).mockReturnValue({ push });
  (useVisibleGoalConflict as jest.Mock).mockReturnValue(null);
  (useSinceLastVisit as jest.Mock).mockReturnValue([]);
  (useActivationPath as jest.Mock).mockReturnValue({ show: false, day: null });
  (useMostRecentRecord as jest.Mock).mockReturnValue({ record: null });
  (useGoals as jest.Mock).mockReturnValue({ active: [] });
  (useInsights as jest.Mock).mockReturnValue({ insights: [] });
  (usePressingLink as jest.Mock).mockReturnValue({ link: null });
  (useNearRecords as jest.Mock).mockReturnValue({ items: [] });
}

const squat = {
  pillar: 'strength' as const,
  type: 'best_weight',
  value: 100,
  exerciseName: 'Squat',
  achievedAt: '2026-10-25T17:40:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  quiet();
});

const cards = () => screen.queryAllByText(/^CARTE /).map((n) => String(n.props.children).replace('CARTE ', ''));

it('rien de neuf : la section entière se tait', async () => {
  const vue = await render(<HomeNews strengthSessionToday={false} />);
  expect(vue.toJSON()).toBeNull();
});

it('🔴 deux cartes AU PLUS, dans l’ordre écrit une fois', async () => {
  (useVisibleGoalConflict as jest.Mock).mockReturnValue({ kind: 'deficit-volume' });
  (useSinceLastVisit as jest.Mock).mockReturnValue([{ kind: 'run' }]);
  (useGoals as jest.Mock).mockReturnValue({ active: [{ id: 'g1' }] });
  await render(<HomeNews strengthSessionToday={false} />);
  expect(cards()).toEqual(['conflit', 'depuis']);
});

describe('le record', () => {
  it('battu aujourd’hui : la carte record, qui mène aux progrès', async () => {
    (useMostRecentRecord as jest.Mock).mockReturnValue({ record: squat });
    await render(<HomeNews strengthSessionToday={false} />);
    expect(screen.getByText('Nouveau record')).toBeTruthy();
    expect(screen.getByText('Squat · 100 kg')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('news-record'));
    expect(push).toHaveBeenCalledWith('/progress');
  });

  it('🔴 battu il y a trois jours : plus du nouveau', async () => {
    (useMostRecentRecord as jest.Mock).mockReturnValue({ record: { ...squat, achievedAt: '2026-10-22T17:40:00.000Z' } });
    const vue = await render(<HomeNews strengthSessionToday={false} />);
    expect(vue.toJSON()).toBeNull();
  });

  it('🔴 à portée : seulement un jour de séance de musculation', async () => {
    (useNearRecords as jest.Mock).mockReturnValue({
      items: [{ exerciseId: 'e1', exerciseName: 'Squat', gapKind: 'kg', gap: 2.5, ratio: 0.97 }],
    });
    const sansSeance = await render(<HomeNews strengthSessionToday={false} />);
    expect(sansSeance.toJSON()).toBeNull();
    await sansSeance.unmount();

    await render(<HomeNews strengthSessionToday />);
    expect(screen.getByText('Record à portée')).toBeTruthy();
    expect(screen.getByTestId('news-near-record')).toBeTruthy();
  });
});

it('🔴 le parcours des premiers jours : à partir du jour 2 (le jour 1 est dans le ciel)', async () => {
  (useActivationPath as jest.Mock).mockReturnValue({ show: true, day: 1 });
  const jour1 = await render(<HomeNews strengthSessionToday={false} />);
  expect(jour1.toJSON()).toBeNull();
  await jour1.unmount();

  (useActivationPath as jest.Mock).mockReturnValue({ show: true, day: 2 });
  await render(<HomeNews strengthSessionToday={false} />);
  expect(cards()).toEqual(['parcours']);
});

it('le lien du Labo et l’objectif le plus proche, quand rien d’autre ne presse', async () => {
  (useInsights as jest.Mock).mockReturnValue({ insights: [{ id: 'i1' }] });
  (useGoals as jest.Mock).mockReturnValue({ active: [{ id: 'g1' }] });
  await render(<HomeNews strengthSessionToday={false} />);
  expect(cards()).toEqual(['labo', 'objectif']);
});
