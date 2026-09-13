/**
 * US DASH-01 (§4.4) — les deux cartes que le hub muscu gagne : la semaine séance par séance, et
 * « à ta portée ». Ce qui est vérifié est leur **règle de silence** (une carte sans rien à dire ne
 * se rend pas) et le geste qu'elles offrent ; les calculs vivent dans `@wellness/shared`.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StrengthWeekCard } from '../StrengthWeekCard';
import { NearRecordsCard } from '../NearRecordsCard';
import { useWeekPlan } from '@/data/repositories/planned-session-repository';
import { useWorkoutHistory } from '@/data/repositories/workout-repository';
import { useNearRecords } from '@/data/repositories/records-repository';

jest.mock('@/data/repositories/planned-session-repository', () => ({
  useWeekPlan: jest.fn(() => ({ items: [], isLoading: false })),
}));
jest.mock('@/data/repositories/workout-repository', () => ({
  useWorkoutHistory: jest.fn(() => ({ workouts: [], isLoading: false })),
}));
jest.mock('@/data/repositories/records-repository', () => ({
  useNearRecords: jest.fn(() => ({ items: [], isLoading: false })),
}));
jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: () => '2026-09-16' }));

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
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      track: '#eadcc6',
      accent: '#b14f2b',
      accentText: '#ffffff',
    },
  }),
}));

const mockPlan = useWeekPlan as jest.Mock;
const mockHistory = useWorkoutHistory as jest.Mock;
const mockNear = useNearRecords as jest.Mock;

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPlan.mockReturnValue({ items: [], isLoading: false });
  mockHistory.mockReturnValue({ workouts: [], isLoading: false });
  mockNear.mockReturnValue({ items: [], isLoading: false });
});

describe('la semaine séance par séance', () => {
  it('🔴 se tait quand la semaine est vide — ni plan, ni séance', async () => {
    await render(<StrengthWeekCard onOpenDay={jest.fn()} />);

    expect(screen.queryByTestId('strength-week-card')).toBeNull();
  });

  it('sept jours, et un tap ouvre le planning au jour choisi', async () => {
    // Semaine du 14/09/2026 (lundi) : une séance prévue jeudi, une faite lundi.
    mockPlan.mockReturnValue({
      items: [
        { pillar: 'strength', scheduledDate: '2026-09-17', status: 'planned' },
        { pillar: 'running', scheduledDate: '2026-09-18', status: 'planned' },
      ],
      isLoading: false,
    });
    mockHistory.mockReturnValue({
      workouts: [{ id: 'w-1', finishedAt: '2026-09-14T18:00:00.000Z' }],
      isLoading: false,
    });
    const onOpenDay = jest.fn();
    await render(<StrengthWeekCard onOpenDay={onOpenDay} />);

    const jours = screen.getAllByLabelText(/stage\.strength\.weekCard\.dayA11y/);
    expect(jours).toHaveLength(7);

    await taper(jours[0]!);
    expect(onOpenDay).toHaveBeenCalledWith('2026-09-14');
  });

  it('🔴 une séance de COURSE ne remplit pas un jour de muscu', async () => {
    mockPlan.mockReturnValue({
      items: [{ pillar: 'running', scheduledDate: '2026-09-17', status: 'planned' }],
      isLoading: false,
    });
    await render(<StrengthWeekCard onOpenDay={jest.fn()} />);

    expect(screen.queryByTestId('strength-week-card')).toBeNull();
  });
});

describe('à ta portée', () => {
  it('🔴 se tait quand aucun record n’est à portée', async () => {
    await render(<NearRecordsCard onOpenExercise={jest.fn()} />);

    expect(screen.queryByTestId('near-records-card')).toBeNull();
  });

  it('dit l’écart exercice par exercice, et ouvre la fiche', async () => {
    mockNear.mockReturnValue({
      items: [
        { exerciseId: 'e-1', exerciseName: 'Squat', gapKind: 'kg', gap: 2.5, ratio: 0.96 },
        { exerciseId: 'e-2', exerciseName: 'Développé', gapKind: 'reps', gap: 1, ratio: 0.8 },
      ],
      isLoading: false,
    });
    const onOpenExercise = jest.fn();
    await render(<NearRecordsCard onOpenExercise={onOpenExercise} />);

    expect(screen.getByText('Squat')).toBeTruthy();
    expect(screen.getByText(/stage\.strength\.near\.reps/)).toBeTruthy();

    await taper(screen.getByText('Squat'));
    expect(onOpenExercise).toHaveBeenCalledWith('e-1');
  });
});
