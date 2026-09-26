/**
 * US NUTRI-UX03 — le calendrier d'Historique (R7, décision Q2 : « comme les anciens verres »).
 *
 * Le calcul (remplissage, statut, résumé) est testé dans `packages/shared/nutrition-calendar.test.ts`.
 * Ici : ce que TalkBack annonce, ce qui est un bouton ou pas, les bornes de navigation, et le
 * statut lisible sans la couleur (« + », « − »).
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { NutritionCalendar } from '../NutritionCalendar';

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
    },
  }),
}));

const AUJOURDHUI = '2026-09-25';
const SEPTEMBRE = { year: 2026, month: 9 };
const RANGE = { min: { year: 2026, month: 7 }, max: SEPTEMBRE };

const jours = [
  { dayKey: '2026-09-24', kcal: 2218, target: 2400 },
  { dayKey: '2026-09-19', kcal: 2738, target: 2400 },
  { dayKey: '2026-09-22', kcal: 1917, target: 2400 },
  { dayKey: '2026-09-21', kcal: 2000, target: null },
  { dayKey: '2026-09-25', kcal: 467, target: 2400 },
];

const afficher = async (overrides: Partial<Parameters<typeof NutritionCalendar>[0]> = {}) => {
  const props = {
    month: SEPTEMBRE,
    range: RANGE,
    days: jours,
    todayKey: AUJOURDHUI,
    marginPct: 10,
    onMonth: jest.fn(),
    onDay: jest.fn(),
    ...overrides,
  };
  await render(<NutritionCalendar {...props} />);
  return props;
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

describe('les jours', () => {
  it('🔴 chaque jour passé dit son total ET son statut, en toutes lettres', async () => {
    await afficher();

    // Le séparateur de milliers vient d'Intl (espace fine insécable en français) : on le normalise.
    const label = (screen.getByTestId('nutrition-day-2026-09-24').props.accessibilityLabel as string).replace(
      /[  ]/g,
      ' ',
    );
    expect(label).toContain('"date":"jeudi 24 septembre"');
    expect(label).toContain('nutritionHub.calendar.status.in');
    expect(label).toContain('2 218');
  });

  it('au-dessus et en dessous se lisent sans la couleur : « + » et « − »', async () => {
    await afficher();

    expect(within(screen.getByTestId('nutrition-day-2026-09-19')).getByText('+')).toBeTruthy();
    expect(within(screen.getByTestId('nutrition-day-2026-09-22')).getByText('−')).toBeTruthy();
    expect(within(screen.getByTestId('nutrition-day-2026-09-24')).queryByText('+')).toBeNull();
  });

  it('sans cible : noté, sans statut', async () => {
    await afficher();

    expect(screen.getByTestId('nutrition-day-2026-09-21').props.accessibilityLabel).toContain(
      'nutritionHub.calendar.status.logged',
    );
  });

  it('un jour passé sans rien de noté reste un bouton : on le complète', async () => {
    const props = await afficher();

    await taper(screen.getByTestId('nutrition-day-2026-09-20'));

    expect(screen.getByTestId('nutrition-day-2026-09-20').props.accessibilityLabel).toContain(
      'nutritionHub.calendar.status.none',
    );
    expect(props.onDay).toHaveBeenCalledWith('2026-09-20');
  });

  it('aujourd’hui est un bouton, annoncé « en cours »', async () => {
    await afficher();

    expect(screen.getByTestId('nutrition-day-2026-09-25').props.accessibilityLabel).toContain(
      'nutritionHub.calendar.status.today',
    );
  });

  it('🔴 un jour à venir n’est pas un bouton', async () => {
    await afficher();

    expect(screen.queryByTestId('nutrition-day-2026-09-26')).toBeNull();
    expect(screen.getByText('26')).toBeTruthy();
  });
});

describe('le résumé', () => {
  it('jours notés avant aujourd’hui, leur moyenne, puis la répartition', async () => {
    await afficher();

    expect(screen.getByText(/nutritionHub\.calendar\.loggedDays:\{"count":4\}/)).toBeTruthy();
    expect(screen.getByText(/nutritionHub\.calendar\.split:\{"inTarget":1,"over":1,"under":1\}/)).toBeTruthy();
  });

  it('mois vide : un message, pas de zéros', async () => {
    await afficher({ days: [] });

    expect(screen.getByText('nutritionHub.calendar.empty')).toBeTruthy();
    expect(screen.queryByText(/loggedDays/)).toBeNull();
  });
});

describe('la navigation', () => {
  it('🔴 pas de mois suivant après le mois courant', async () => {
    const props = await afficher();

    const suivant = screen.getByLabelText('nutritionHub.calendar.next');
    expect(suivant.props.accessibilityState.disabled).toBe(true);
    await taper(suivant);
    expect(props.onMonth).not.toHaveBeenCalled();
  });

  it('le mois précédent, jusqu’au mois de la première entrée', async () => {
    const props = await afficher();

    await taper(screen.getByLabelText('nutritionHub.calendar.previous'));
    expect(props.onMonth).toHaveBeenCalledWith({ year: 2026, month: 8 });
  });

  it('🔴 au premier mois, plus de mois précédent', async () => {
    await afficher({ month: { year: 2026, month: 7 } });

    expect(screen.getByLabelText('nutritionHub.calendar.previous').props.accessibilityState.disabled).toBe(true);
  });
});
