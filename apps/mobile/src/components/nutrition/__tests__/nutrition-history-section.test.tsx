/**
 * US NUTRI-UX03 — l'onglet Historique (R7 à R9), monté avec le vrai calendrier.
 *
 *  1. **Une seule source de cible** : le calendrier et la liste lisent `useDailyCalorieTargets` sur le
 *     mois affiché, et la marge de l'utilisateur (D9).
 *  2. **La liste des jours** : les jours notés, plus les trous récents à compléter (R8).
 *  3. **Les repas habituels** : deux fois les mêmes aliments, repris en un geste, qui dit « Ajouté »
 *     sans changer d'onglet (R9).
 *  4. **L'état survit** au changement d'onglet : il vit dans le store (§4.3-3).
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { HistorySection } from '../sections/HistorySection';
import { useDailyCalorieTargets } from '@/data/repositories/dashboard-repository';
import { copyMeal, useEntriesBetween, useFirstLogDate } from '@/data/repositories/journal-repository';
import { useNutritionSection } from '@/stores/nutrition-section-store';

jest.mock('@/data/repositories/dashboard-repository', () => ({
  useDailyCalorieTargets: jest.fn(),
}));
jest.mock('@/data/repositories/journal-repository', () => ({
  copyMeal: jest.fn(),
  useEntriesBetween: jest.fn(),
  useFirstLogDate: jest.fn(),
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
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#786a59',
      surface: '#fffaf2',
      border: '#e3d3ba',
      borderStrong: '#90897d',
      track: '#efe3cf',
      accent: '#3f6b1c',
      accentText: '#ffffff',
    },
  }),
}));

const mockTargets = useDailyCalorieTargets as jest.Mock;
const mockBetween = useEntriesBetween as jest.Mock;
const mockFirst = useFirstLogDate as jest.Mock;
const mockCopy = copyMeal as jest.Mock;

const AUJOURDHUI = '2026-09-25';
const MEALS = [
  { key: 'breakfast', label: 'Petit-déjeuner' },
  { key: 'lunch', label: 'Déjeuner' },
  { key: 'dinner', label: 'Dîner' },
];

const ligne = (logDate: string, mealType: string, name: string, orderIndex = 0) => ({
  logDate,
  mealType,
  foodId: `f-${name}`,
  name,
  kcal: 200,
  orderIndex,
});

/** Le mois : trois jours notés, dont un au-dessus de sa cible. */
const MOIS = [
  ligne('2026-09-24', 'breakfast', 'Skyr', 0),
  ligne('2026-09-24', 'breakfast', 'Flocons', 1),
  ligne('2026-09-24', 'breakfast', 'Banane', 2),
  ligne('2026-09-24', 'lunch', 'Poulet', 0),
  ligne('2026-09-23', 'lunch', 'Burger', 0),
  ligne('2026-09-10', 'dinner', 'Soupe', 0),
];

/** Les 60 derniers jours : le même déjeuner deux fois, un autre une fois. */
const HISTORIQUE = [
  ligne('2026-09-24', 'lunch', 'Poulet', 0),
  ligne('2026-09-24', 'lunch', 'Riz', 1),
  ligne('2026-09-22', 'lunch', 'Riz', 0),
  ligne('2026-09-22', 'lunch', 'Poulet', 1),
  ligne('2026-09-23', 'lunch', 'Burger', 0),
];

const afficher = async (overrides: Partial<Parameters<typeof HistorySection>[0]> = {}) => {
  const props = {
    todayKey: AUJOURDHUI,
    mealOfHour: 'lunch',
    mealList: MEALS,
    historyRows: HISTORIQUE,
    onOpenDay: jest.fn(),
    onToday: jest.fn(),
    ...overrides,
  };
  await render(<HistorySection {...props} />);
  return props;
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  useNutritionSection.setState({ section: 'history', historyMonth: null, historyTab: 'days', habitsMeal: null });
  mockFirst.mockReturnValue({ first: '2026-07-02', isLoading: false });
  mockTargets.mockReturnValue({
    days: [
      { dayKey: '2026-09-24', kcal: 2218, effectiveTarget: 2400, isTrainingDay: false },
      { dayKey: '2026-09-23', kcal: 3050, effectiveTarget: 2400, isTrainingDay: false },
      { dayKey: '2026-09-10', kcal: 1500, effectiveTarget: 2400, isTrainingDay: false },
    ],
    marginPct: 10,
    hasTarget: true,
    weightKg: 78,
    isLoading: false,
  });
  mockBetween.mockImplementation((from: string) => ({
    rows: from.endsWith('-01') ? MOIS.filter((r) => r.logDate.startsWith(from.slice(0, 8))) : [],
    isLoading: false,
  }));
  mockCopy.mockResolvedValue(2);
});

describe('les données', () => {
  it('🔴 une seule source de cible : le mois affiché, bornes incluses', async () => {
    await afficher();

    expect(mockTargets).toHaveBeenCalledWith('2026-09-01', '2026-09-30');
    expect(mockBetween).toHaveBeenCalledWith('2026-09-01', '2026-09-30');
  });

  it('🔴 la fenêtre de 60 jours n’est PAS relue : le hub la passe (une requête surveillée de moins)', async () => {
    await afficher();

    expect(mockBetween).toHaveBeenCalledTimes(1);
    expect(mockBetween).toHaveBeenCalledWith('2026-09-01', '2026-09-30');
  });
});

describe('Jours (R8)', () => {
  it('les jours notés, du plus récent au plus ancien, avec les trous récents à compléter', async () => {
    await afficher();

    const cles = screen
      .getAllByTestId(/^nutrition-history-day-/)
      .map((n) => (n.props.testID as string).replace('nutrition-history-day-', ''));
    expect(cles).toEqual([
      '2026-09-24',
      '2026-09-23',
      '2026-09-22',
      '2026-09-21',
      '2026-09-20',
      '2026-09-19',
      '2026-09-10',
    ]);
  });

  it('une ligne résume la journée repas par repas, deux aliments chacun', async () => {
    await afficher();

    expect(screen.getByText('Skyr, Flocons · Poulet')).toBeTruthy();
  });

  it('🔴 le statut est jugé avec la marge : « dans ta cible », « +N kcal »', async () => {
    await afficher();

    expect(screen.getByText('nutritionHub.days.in')).toBeTruthy();
    expect(screen.getByText(/nutritionHub\.days\.over:\{"kcal":"650"\}/)).toBeTruthy();
    expect(screen.getByText(/nutritionHub\.days\.under/)).toBeTruthy();
  });

  it('un trou récent invite à compléter, et ouvre sa page', async () => {
    const props = await afficher();

    expect(screen.getAllByText('nutritionHub.days.complete').length).toBeGreaterThan(0);
    await taper(screen.getByTestId('nutrition-history-day-2026-09-20'));

    expect(props.onOpenDay).toHaveBeenCalledWith('2026-09-20');
  });

  it('un appui sur un jour du calendrier ouvre sa page ; aujourd’hui, l’onglet Aujourd’hui', async () => {
    const props = await afficher();

    await taper(screen.getByTestId('nutrition-day-2026-09-24'));
    await taper(screen.getByTestId('nutrition-day-2026-09-25'));

    expect(props.onOpenDay).toHaveBeenCalledWith('2026-09-24');
    expect(props.onToday).toHaveBeenCalledTimes(1);
  });

  it('🔴 compte neuf : aucune ligne « Rien de noté » à compléter (§6)', async () => {
    mockFirst.mockReturnValue({ first: null, isLoading: false });
    mockTargets.mockReturnValue({ days: [], marginPct: 10, hasTarget: true, weightKg: null, isLoading: false });
    await afficher({ historyRows: [] });

    expect(screen.queryAllByTestId(/^nutrition-history-day-/)).toHaveLength(0);
    // Le calendrier dit déjà « Aucun jour noté ce mois-ci » : la liste ne le répète pas.
    expect(screen.getAllByText('nutritionHub.calendar.empty')).toHaveLength(1);
  });

  it('🔴 le mois choisi survit au changement d’onglet (store)', async () => {
    await afficher();

    await taper(screen.getByLabelText('nutritionHub.calendar.previous'));

    expect(useNutritionSection.getState().historyMonth).toEqual({ year: 2026, month: 8 });
    expect(mockTargets).toHaveBeenLastCalledWith('2026-08-01', '2026-08-31');
  });
});

describe('Repas habituels (R9)', () => {
  const ouvrir = async () => {
    await afficher();
    await taper(screen.getByTestId('nutrition-history-tab-habits'));
  };

  it('🔴 seul un repas noté au moins deux fois est habituel', async () => {
    await ouvrir();

    expect(screen.getByText('Poulet, Riz')).toBeTruthy();
    expect(screen.queryByText('Burger')).toBeNull();
    expect(screen.getByText(/nutritionHub\.habits\.meta:\{"count":2/)).toBeTruthy();
  });

  it('le repas de l’heure est présélectionné', async () => {
    await ouvrir();

    expect(screen.getByRole('tab', { name: 'Déjeuner' }).props.accessibilityState.selected).toBe(true);
  });

  it('Reprendre copie la DERNIÈRE occurrence dans le même repas, aujourd’hui, puis dit « Ajouté »', async () => {
    await ouvrir();

    await taper(screen.getByLabelText('nutritionHub.habits.a11y:{"name":"Poulet, Riz","meal":"Déjeuner"}'));

    expect(mockCopy).toHaveBeenCalledWith('2026-09-24', 'lunch', AUJOURDHUI);
    expect(screen.getByText('nutritionHub.repeat.done')).toBeTruthy();
    expect(useNutritionSection.getState().section).toBe('history');
  });

  it('🔴 un second appui n’ajoute pas une seconde fois', async () => {
    await ouvrir();

    const bouton = screen.getByLabelText('nutritionHub.habits.a11y:{"name":"Poulet, Riz","meal":"Déjeuner"}');
    await taper(bouton);
    await taper(bouton);

    expect(mockCopy).toHaveBeenCalledTimes(1);
  });

  it('🔴 après minuit, « Ajouté » ne vaut plus : la nouvelle journée peut reprendre ce repas', async () => {
    await ouvrir();
    await taper(screen.getByLabelText('nutritionHub.habits.a11y:{"name":"Poulet, Riz","meal":"Déjeuner"}'));
    expect(screen.getByText('nutritionHub.repeat.done')).toBeTruthy();

    await act(async () => {
      await screen.rerender(
        <HistorySection
          todayKey="2026-09-26"
          mealOfHour="lunch"
          mealList={MEALS}
          historyRows={HISTORIQUE}
          onOpenDay={jest.fn()}
          onToday={jest.fn()}
        />,
      );
    });

    expect(screen.queryByText('nutritionHub.repeat.done')).toBeNull();
  });

  it('un autre repas se choisit, et le choix est retenu', async () => {
    await ouvrir();

    await taper(screen.getByRole('tab', { name: 'Petit-déjeuner' }));

    expect(useNutritionSection.getState().habitsMeal).toBe('breakfast');
    expect(screen.getByText('nutritionHub.habits.empty')).toBeTruthy();
  });

  it('« Tous tes repas habituels » arrive ici sur le repas transmis', async () => {
    useNutritionSection.setState({ historyTab: 'habits', habitsMeal: 'dinner' });
    await afficher();

    expect(screen.getByRole('tab', { name: 'Dîner' }).props.accessibilityState.selected).toBe(true);
  });
});
