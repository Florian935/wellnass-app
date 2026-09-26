/**
 * US NUTRI-UX03 — le remplissage d'aujourd'hui, dans l'en-tête du hub, testé sur son **contrat** :
 * ce qu'il dit, ce qu'il propose. Il remplace la scène de DASH-01 (`NutritionStage`), **moins la
 * navigation par jour** : Aujourd'hui est toujours aujourd'hui (D4).
 *
 * Rien sur la trajectoire du niveau (Jest ne fait pas tourner d'horloge Reanimated) — seulement sur
 * la valeur d'arrivée, la seule que l'utilisateur lit.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { NutritionLevel, NutritionLevelMatter } from '../NutritionLevel';
import { useMonthTotals } from '@/data/repositories/journal-repository';

jest.mock('@/data/repositories/journal-repository', () => ({
  useMonthTotals: jest.fn(() => ({ totals: [], isLoading: false })),
}));

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
  useTheme: () => ({ scheme: 'light', colors: { background: '#fffaf2' } }),
}));

const mockTotals = useMonthTotals as jest.Mock;

const AUJOURDHUI = '2026-08-12'; // un mercredi

const noop = jest.fn();

const afficher = async (overrides: Partial<Parameters<typeof NutritionLevel>[0]> = {}) => {
  const props = {
    todayKey: AUJOURDHUI,
    consumedKcal: 1200,
    targetKcal: 2000,
    consumedMacros: { protein: 60, carbs: 140, fat: 40 },
    targetMacros: { protein: 130, carbs: 220, fat: 70 },
    trainingBonusKcal: 0,
    quickFoods: [],
    onSetTarget: noop,
    onSearch: noop,
    onScan: noop,
    onOpenDay: noop,
    ...overrides,
  } as Parameters<typeof NutritionLevel>[0];
  await render(<NutritionLevel {...props} />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTotals.mockReturnValue({ totals: [], isLoading: false });
});

describe('le niveau (matière de l’en-tête)', () => {
  const niveau = () => screen.getByTestId('fill-level', { includeHiddenElements: true });

  it('monte à hauteur de ce qui a été mangé', async () => {
    await render(<NutritionLevelMatter consumedKcal={1000} targetKcal={2000} />);

    // La moitié de la cible, sur les 62 % de l'en-tête que couvre la jauge.
    expect(niveau()).toHaveStyle({ height: '31%' });
  });

  it('🔴 au-delà de la cible, il s’arrête au filet — c’est le texte qui dit l’excédent', async () => {
    await render(<NutritionLevelMatter consumedKcal={2400} targetKcal={2000} />);

    expect(niveau()).toHaveStyle({ height: '62%' });
  });

  it('sans objectif, aucun niveau inventé', async () => {
    await render(<NutritionLevelMatter consumedKcal={1200} targetKcal={null} />);

    expect(niveau()).toHaveStyle({ height: '0%' });
  });
});

describe('le grand chiffre', () => {
  it('🔴 dit ce qu’il RESTE, et la sous-ligne porte le détail', async () => {
    await afficher({ consumedKcal: 500, targetKcal: 2000 });

    expect(
      screen.getByTestId('stage-kcal', { includeHiddenElements: true }).props.defaultValue.replace(/[  \s]/g, ' '),
    ).toBe('1 500');
    expect(screen.getByText('stage.nutrition.stillAvailable')).toBeTruthy();
    expect(screen.getByText('stage.nutrition.detail:{"consumed":500,"target":2000}')).toBeTruthy();
  });

  it('cible dépassée : le texte dit l’excédent', async () => {
    await afficher({ consumedKcal: 2400, targetKcal: 2000 });

    expect(screen.getByText('stage.nutrition.over:{"kcal":400}')).toBeTruthy();
  });

  it('sans objectif, le lien de réglage', async () => {
    await afficher({ targetKcal: null, targetMacros: null });

    expect(screen.getByText('stage.nutrition.noTarget')).toBeTruthy();
    expect(screen.getByText('journal.setTarget')).toBeTruthy();
  });

  it('le bonus de séance est nommé dans la sous-ligne', async () => {
    await afficher({ consumedKcal: 500, trainingBonusKcal: 300 });

    expect(
      screen.getByText('stage.nutrition.detailWithBonus:{"consumed":500,"target":2000,"bonus":300}'),
    ).toBeTruthy();
  });

  it('🔴 les macros portent leurs grammes ET leur cible', async () => {
    await afficher({ consumedMacros: { protein: 59, carbs: 112, fat: 31 } });

    expect(screen.getByText('stage.nutrition.macroGrams:{"value":59,"goal":130}')).toBeTruthy();
    expect(screen.getByText('stage.nutrition.macroGrams:{"value":112,"goal":220}')).toBeTruthy();
    expect(screen.getByText('stage.nutrition.macroGrams:{"value":31,"goal":70}')).toBeTruthy();
  });
});

describe('Aujourd’hui, toujours (D4)', () => {
  it('🔴 plus de flèches, plus de verres, plus de « Revenir à aujourd’hui »', async () => {
    await afficher();

    expect(screen.queryByLabelText('journal.prevDay')).toBeNull();
    expect(screen.queryByLabelText('journal.nextDay')).toBeNull();
    expect(screen.queryByTestId('back-to-today')).toBeNull();
    expect(screen.queryByLabelText(/journal\.calendar/)).toBeNull();
  });

  it('le jour est nommé en tête', async () => {
    await afficher();

    expect(screen.getByText(/nutritionHub\.eyebrow/)).toBeTruthy();
  });

  it('le jour passé sans saisie le plus récent ouvre SA page', async () => {
    const onOpenDay = jest.fn();
    mockTotals.mockReturnValue({ totals: [{ logDate: '2026-08-09', kcal: 2100 }], isLoading: false });
    await afficher({ onOpenDay });

    await taper(screen.getByText(/stage\.nutrition\.missingDay/));

    expect(onOpenDay).toHaveBeenCalledWith('2026-08-11');
  });

  it('les six jours précédents lus, pas plus', async () => {
    await afficher();

    expect(mockTotals).toHaveBeenCalledWith('2026-08-06', AUJOURDHUI);
  });
});

describe('les gestes', () => {
  it('l’ajout rapide propose les récents en un tap', async () => {
    const onAdd = jest.fn();
    await afficher({ quickFoods: [{ id: 'f-1', name: 'Banane', kcal: 105, onAdd }] });

    await taper(screen.getByLabelText('stage.nutrition.quickAddA11y:{"name":"Banane","kcal":105}'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('🔴 « Chercher un aliment » et Scanner, côte à côte', async () => {
    const onSearch = jest.fn();
    const onScan = jest.fn();
    await afficher({ onSearch, onScan });

    await taper(screen.getByLabelText('stage.nutrition.search'));
    await taper(screen.getByLabelText('scan.title'));

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledTimes(1);
  });

  it('🔴 aucun bouton de photo : la surface IA a été retirée du build de lancement', async () => {
    await afficher();

    expect(screen.queryByLabelText('stage.nutrition.photo')).toBeNull();
  });
});
