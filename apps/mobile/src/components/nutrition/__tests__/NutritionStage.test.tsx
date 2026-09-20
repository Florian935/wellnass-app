/**
 * US DASH-01 — la scène du pilier Nutrition, testée sur son **contrat** : ce qu'elle dit, ce qu'elle
 * propose, et ce qu'elle refuse de faire. Rien sur la trajectoire du niveau (Jest ne fait pas
 * tourner d'horloge Reanimated) — seulement sur la valeur d'arrivée, qui est la seule que
 * l'utilisateur lit (R1).
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { NutritionStage } from '../NutritionStage';
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

const afficher = async (overrides: Partial<Parameters<typeof NutritionStage>[0]> = {}) => {
  const props = {
    day: AUJOURDHUI,
    todayKey: AUJOURDHUI,
    dayLabel: 'mer. 12 août',
    consumedKcal: 1200,
    targetKcal: 2000,
    consumedMacros: { protein: 60, carbs: 140, fat: 40 },
    targetMacros: { protein: 130, carbs: 220, fat: 70 },
    trainingBonusKcal: 0,
    quickFoods: [],
    onSelectDay: noop,
    onOpenCalendar: noop,
    onSetTarget: noop,
    onSearch: noop,
    onScan: noop,
    onStats: noop,
    onProfile: noop,
    ...overrides,
  } as Parameters<typeof NutritionStage>[0];
  await render(<NutritionStage {...props} />);
};

const niveau = () => screen.getByTestId('fill-level', { includeHiddenElements: true });

/**
 * Un appui, rendu **complet**. `PressableScale` pose une valeur animée à l'enfoncement : sans `act`
 * asynchrone, deux appuis d'affilée ouvrent deux portées `act()` imbriquées et l'arbre suivant
 * revient vide.
 */
const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTotals.mockReturnValue({ totals: [], isLoading: false });
});

describe('le niveau', () => {
  it('monte à hauteur de ce qui a été mangé', async () => {
    await afficher({ consumedKcal: 1000, targetKcal: 2000 });

    // La moitié de la cible, sur les 62 % de scène que couvre la jauge.
    expect(niveau()).toHaveStyle({ height: '31%' });
  });

  it('🔴 au-delà de la cible, il s’arrête au filet — c’est le texte qui dit l’excédent', async () => {
    await afficher({ consumedKcal: 2400, targetKcal: 2000 });

    // Un niveau qui déborde afficherait une quantité fausse : 2 400 kcal ne sont pas « 120 % de
    // scène », et la scène n'a pas de place au-dessus du filet.
    expect(niveau()).toHaveStyle({ height: '62%' });
    expect(screen.getByText('stage.nutrition.over:{"kcal":400}')).toBeTruthy();
  });

  it('sans objectif, aucun niveau inventé', async () => {
    await afficher({ targetKcal: null, targetMacros: null });

    expect(niveau()).toHaveStyle({ height: '0%' });
    expect(screen.getByText('stage.nutrition.noTarget')).toBeTruthy();
    expect(screen.getByText('journal.setTarget')).toBeTruthy();
  });

  it('un jour passé dit la cible, pas un reste à manger', async () => {
    // « Il te reste 800 kcal » sur le 5 août n'a aucun sens : la journée est finie.
    await afficher({ day: '2026-08-05', consumedKcal: 1200 });

    expect(screen.getByText('stage.nutrition.ofTarget:{"kcal":2000}')).toBeTruthy();
  });

  it('le bonus de séance est nommé quand il existe', async () => {
    await afficher({ consumedKcal: 500, trainingBonusKcal: 300 });

    // ⚠️ Depuis NUTRI-UX02, le bonus n'est plus une pastille isolée mais la **sous-ligne de
    // détail** : il n'avait de sens qu'à côté de la cible qu'il augmente, et la pastille
    // l'affichait seul, au-dessus d'un calcul qu'elle ne montrait pas.
    expect(
      screen.getByText('stage.nutrition.detailWithBonus:{"consumed":500,"target":2000,"bonus":300}'),
    ).toBeTruthy();
  });

  it('🔴 US NUTRI-UX02 — le grand chiffre dit ce qu’il RESTE sur la journée en cours', async () => {
    await afficher({ consumedKcal: 500, targetKcal: 2000 });

    // Le consommé reste lisible deux fois — par le niveau derrière le texte et par la sous-ligne.
    // Le grand chiffre, lui, répond à la question qui amène sur l'écran.
    expect(screen.getByTestId('stage-kcal', { includeHiddenElements: true }).props.defaultValue.replace(/[  \s]/g, ' ')).toBe('1 500');
    expect(screen.getByText('stage.nutrition.stillAvailable')).toBeTruthy();
    expect(screen.getByText('stage.nutrition.detail:{"consumed":500,"target":2000}')).toBeTruthy();
  });

  it('🔴 les macros portent enfin leurs GRAMMES — ils n’étaient lus que par TalkBack', async () => {
    await afficher({ consumedMacros: { protein: 59, carbs: 112, fat: 31 } });

    // Passe 2 : le gramme porte sa CIBLE. « 59g » seul ne disait pas si c'était bien — la cible
    // dessinait déjà la hauteur de la tige et restait non écrite.
    expect(screen.getByText('stage.nutrition.macroGrams:{"value":59,"goal":130}')).toBeTruthy();
    expect(screen.getByText('stage.nutrition.macroGrams:{"value":112,"goal":220}')).toBeTruthy();
    expect(screen.getByText('stage.nutrition.macroGrams:{"value":31,"goal":70}')).toBeTruthy();
  });
});

describe('le jour affiché', () => {
  it('🔴 passe 2 — un jour passé propose de REVENIR à aujourd’hui', async () => {
    await afficher({ day: '2026-08-05' });

    // Sur un jour passé, trois choses disparaissent d'un coup : le restant, la carte de décision et
    // l'ajout rapide. Ce sont les bonnes règles — mais rien ne les annonçait, et on se retrouvait
    // devant un écran qui ne propose plus rien sans comprendre pourquoi.
    expect(screen.getByTestId('back-to-today')).toBeTruthy();
  });

  it('et il ne s’affiche pas quand on y est déjà', async () => {
    await afficher();

    expect(screen.queryByTestId('back-to-today')).toBeNull();
  });

  it('🔴 la sous-ligne de détail se TAIT sur un jour passé — le statut dit déjà la cible', async () => {
    await afficher({ day: '2026-08-05', consumedKcal: 1200 });

    // Sinon on lit « sur 2000 kcal visées » puis « 1200 sur 2000 » deux lignes plus bas.
    expect(screen.getByText('stage.nutrition.ofTarget:{"kcal":2000}')).toBeTruthy();
    expect(screen.queryByText(/stage\.nutrition\.detail/)).toBeNull();
  });
});

describe('les sept verres', () => {
  it('taper un verre change de jour', async () => {
    const onSelectDay = jest.fn();
    await afficher({ onSelectDay });

    // Lundi de la semaine du 12 août 2026 (un mercredi) = le 10.
    await taper(screen.getByLabelText('journal.calendar.dayA11y.empty:{"day":10}'));
    expect(onSelectDay).toHaveBeenCalledWith('2026-08-10');
  });

  it('🔴 un jour à venir est inerte', async () => {
    const onSelectDay = jest.fn();
    await afficher({ onSelectDay });

    // Dimanche 16 août : proposer de saisir un repas qu'on n'a pas encore mangé n'a pas de sens.
    await taper(screen.getByLabelText('journal.calendar.dayA11y.empty:{"day":16}'));
    expect(onSelectDay).not.toHaveBeenCalled();
  });

  it('le verre d’un jour saisi est rempli à hauteur de sa journée', async () => {
    mockTotals.mockReturnValue({
      totals: [{ logDate: '2026-08-10', kcal: 1900 }],
      isLoading: false,
    });
    await afficher();

    expect(screen.getByLabelText('journal.calendar.dayA11y.complete:{"day":10}')).toBeTruthy();
  });
});

describe('le brouillard de confiance', () => {
  it('nomme le jour passé sans saisie — celui qui affinerait le plus les conseils', async () => {
    mockTotals.mockReturnValue({
      totals: [{ logDate: '2026-08-11', kcal: 2100 }],
      isLoading: false,
    });
    await afficher();

    // Six jours passés, un seul saisi : la scène nomme le plus récent des trous.
    expect(screen.getByText(/stage\.nutrition\.missingDay/)).toBeTruthy();
  });

  it('🔴 il se tait sur un jour passé', async () => {
    // On consulte le 5 août : y afficher « il manque le 10 » demanderait de naviguer deux fois.
    await afficher({ day: '2026-08-05' });

    expect(screen.queryByText(/stage\.nutrition\.missingDay/)).toBeNull();
  });
});

describe('les gestes', () => {
  it('l’ajout rapide propose les récents en un tap', async () => {
    const onAdd = jest.fn();
    await afficher({ quickFoods: [{ id: 'f-1', name: 'Banane', kcal: 105, onAdd }] });

    await taper(screen.getByLabelText('stage.nutrition.quickAddA11y:{"name":"Banane","kcal":105}'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('🔴 mais jamais sur un jour passé', async () => {
    // Ajouter une banane « d'hier » au jour affiché écrirait dans l'historique sans le dire.
    await afficher({
      day: '2026-08-05',
      quickFoods: [{ id: 'f-1', name: 'Banane', kcal: 105, onAdd: jest.fn() }],
    });

    expect(screen.queryByText('Banane')).toBeNull();
  });

  it('la recherche et le calendrier sont à un tap', async () => {
    const onSearch = jest.fn();
    const onOpenCalendar = jest.fn();
    await afficher({ onSearch, onOpenCalendar });

    await taper(screen.getByLabelText('stage.nutrition.search'));
    await taper(screen.getByLabelText('journal.calendar.open'));

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onOpenCalendar).toHaveBeenCalledTimes(1);
  });

  it('🔴 aucun bouton de photo : la surface IA a été retirée du build de lancement', async () => {
    await afficher();

    expect(screen.queryByLabelText('stage.nutrition.photo')).toBeNull();
  });

  it('les flèches décalent d’un jour, en franchissant les mois', async () => {
    const onSelectDay = jest.fn();
    await afficher({ day: '2026-08-01', onSelectDay });

    await taper(screen.getByLabelText('journal.prevDay'));
    expect(onSelectDay).toHaveBeenCalledWith('2026-07-31');
  });
});
