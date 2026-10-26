/**
 * Les deux repères neufs de « Tes repères » (US ACCUEIL-08, D5) : Sommeil et Eau.
 *
 * Leur GARDE (pilier Bien-être pour le sommeil, nutrition pour l'eau) vit dans le registre des
 * widgets (`widgets.test.ts`). Ici, ce que la tuile dit et ce que son appui fait.
 */
import '@/i18n';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DEFAULT_GLASS_ML } from '@wellness/shared';
import { useRouter } from 'expo-router';
import { SleepCard } from '../SleepCard';
import { WaterCard } from '../WaterCard';
import { useWellbeingEntries } from '@/data/repositories/daily-wellbeing-repository';
import { addWater, useDayWater } from '@/data/repositories/water-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('@/hooks/useTodayKey', () => ({
  useTodayKey: () => '2026-10-25',
  useWindowStartKey: () => '2026-10-19',
}));
jest.mock('@/data/repositories/daily-wellbeing-repository', () => ({ useWellbeingEntries: jest.fn() }));
jest.mock('@/data/repositories/water-repository', () => ({ addWater: jest.fn(), useDayWater: jest.fn() }));
jest.mock('@/data/repositories/nutrition-repository', () => ({ useNutritionProfile: jest.fn() }));
jest.mock('@/components/widgets/primitives', () => ({ Sparkline: () => null }));

const push = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({ push });
  (addWater as jest.Mock).mockResolvedValue(undefined);
});

describe('Sommeil', () => {
  it('la nuit qui précède ce matin, en heures et minutes', async () => {
    (useWellbeingEntries as jest.Mock).mockReturnValue({
      entries: [
        { logDate: '2026-10-24', sleepMinutes: 400 },
        { logDate: '2026-10-25', sleepMinutes: 440 },
      ],
    });
    await render(<SleepCard />);
    expect(screen.getByLabelText('Sommeil cette nuit : 7h 20')).toBeTruthy();
  });

  it('🔴 pas de nuit notée ce matin : un tiret, jamais la nuit d’avant-hier', async () => {
    (useWellbeingEntries as jest.Mock).mockReturnValue({ entries: [{ logDate: '2026-10-23', sleepMinutes: 480 }] });
    await render(<SleepCard />);
    expect(screen.getByLabelText('Sommeil cette nuit : —')).toBeTruthy();
    expect(screen.queryByText(/8h 00/)).toBeNull();
  });

  it('un appui ouvre le pilier Bien-être', async () => {
    (useWellbeingEntries as jest.Mock).mockReturnValue({ entries: [] });
    await render(<SleepCard />);
    await fireEvent.press(screen.getByLabelText('Sommeil cette nuit : —'));
    expect(push).toHaveBeenCalledWith('/(tabs)/wellbeing-hub');
  });
});

describe('Eau', () => {
  beforeEach(() => {
    (useDayWater as jest.Mock).mockReturnValue({ totalMl: 1250 });
    (useNutritionProfile as jest.Mock).mockReturnValue({ nutritionProfile: { waterTargetMl: 2000 } });
  });

  it('l’eau du jour sur l’objectif, en litres', async () => {
    await render(<WaterCard />);
    expect(screen.getByLabelText('Eau : 1,3 litres sur 2')).toBeTruthy();
    expect(screen.getByText('sur 2 L')).toBeTruthy();
  });

  it('🔴 un appui ajoute UN verre, sur place — sans navigation', async () => {
    await render(<WaterCard />);
    await fireEvent.press(screen.getByLabelText('Eau : 1,3 litres sur 2'));
    expect(addWater).toHaveBeenCalledTimes(1);
    expect(addWater).toHaveBeenCalledWith('2026-10-25', DEFAULT_GLASS_ML);
    expect(push).not.toHaveBeenCalled();
  });
});
