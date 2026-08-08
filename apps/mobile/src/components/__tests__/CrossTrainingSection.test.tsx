/**
 * CrossTrainingSection.test.tsx — la section croisée muscu × nutrition (US APPORT-01).
 *
 * Niveau 3 : les **états** que les moteurs purs ne voient pas.
 *
 *  - 🔴 **le silence total** : l'écran Nutrition ne doit pas gagner une section vide. C'est ce qui
 *    rend l'ajout acceptable sur un écran déjà chargé, et une régression ici ne casserait rien de
 *    visible — elle ajouterait juste du vide que personne ne signalerait en recette ;
 *  - 🔴 **la marge affichée** : sans elle, deux taux d'adhérence différents dans l'app resteraient
 *    inexplicables. La carte doit dire **laquelle** elle a utilisée ;
 *  - 🔴 **sans pesée, la carte protéines RESTE** et affiche son remède — masquer laisserait
 *    l'utilisateur ignorer à jamais qu'il lui manque une donnée ;
 *  - **chaque carte se tait seule** : trois muettes ne doivent pas emporter la quatrième.
 */

import { act, fireEvent, render } from '@testing-library/react-native';

import { CrossTrainingSection } from '../nutrition/CrossTrainingSection';

const mockCross = jest.fn();
const mockPush = jest.fn();

jest.mock('@/data/repositories/dashboard-repository', () => ({
  useTrainingNutritionCross: () => mockCross(),
}));

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown> | string) => {
      if (typeof opts !== 'object' || opts === null) return key;
      if ('count' in opts) return `${key}:${String(opts.count)}`;
      if ('pct' in opts) return `${key}:${String(opts.pct)}`;
      if ('kcal' in opts) return `${key}:${String(opts.kcal)}`;
      return key;
    },
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#786a59',
      background: '#f7eede',
      surface: '#fffaf2',
      border: '#ece0cd',
      accent: '#b14f2b',
      success: '#66714b',
      warnText: '#8a6419',
    },
  })),
}));

const SILENT = {
  energy: null,
  adherence: null,
  lowFuelDays: [],
  protein: null,
  isLoading: false,
};

const ENERGY = {
  trainingAvgKcal: 2480,
  restAvgKcal: 2160,
  deltaKcal: 320,
  trainingDays: 11,
  restDays: 13,
};

/**
 * Déplie la section. `CollapsibleCard` ne monte ses enfants qu'une fois déplié, et son en-tête porte
 * `accessibilityLabel={title}` — c'est **le label** qu'il faut presser. `await act` est obligatoire :
 * le `setState` du repli ne se reflète qu'au tour de boucle suivant (§3.6 de strategie-tests.md).
 */
async function expand(getByLabelText: (t: string) => unknown) {
  await act(async () => {
    fireEvent.press(getByLabelText('nutrition.crossTraining.title') as never);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCross.mockReturnValue(SILENT);
});

describe('CrossTrainingSection — le silence', () => {
  it('🔴 ne rend RIEN quand les quatre analyses se taisent', async () => {
    const { toJSON } = await render(<CrossTrainingSection />);
    expect(toJSON()).toBeNull();
  });

  it('ne rend rien pendant le chargement — pas de section qui clignote', async () => {
    mockCross.mockReturnValue({ ...SILENT, energy: ENERGY, isLoading: true });
    const { toJSON } = await render(<CrossTrainingSection />);
    expect(toJSON()).toBeNull();
  });
});

describe('CrossTrainingSection — chaque carte se tait seule', () => {
  it('rend la section pour le seul bilan énergétique', async () => {
    mockCross.mockReturnValue({ ...SILENT, energy: ENERGY });
    const { toJSON } = await render(<CrossTrainingSection />);
    expect(toJSON()).not.toBeNull();
  });

  it('rend la section pour les seuls jours à faible disponibilité', async () => {
    mockCross.mockReturnValue({
      ...SILENT,
      lowFuelDays: [
        { dayKey: '2026-07-12', strengthVolume: 14200, kcal: 1780, effectiveTarget: 2600 },
      ],
    });
    const { getByText, getByLabelText } = await render(<CrossTrainingSection />);
    await expand(getByLabelText);
    expect(getByText('nutrition.crossTraining.lowFuel.count:1')).toBeTruthy();
  });

  it('rend la section pour les seules protéines', async () => {
    mockCross.mockReturnValue({
      ...SILENT,
      protein: {
        servings: [
          { mealKey: 'lunch', label: null, proteinG: 42, reachesReference: true },
        ],
        servingsAtReference: 1,
        referenceG: 22,
        totalProteinG: 42,
      },
    });
    const { getByText, getByLabelText } = await render(<CrossTrainingSection />);
    await expand(getByLabelText);
    expect(getByText('42 g')).toBeTruthy();
  });
});

describe('CrossTrainingSection — les chiffres portent leur base', () => {
  it('affiche l’écart signé et le nombre de jours de chaque côté', async () => {
    mockCross.mockReturnValue({ ...SILENT, energy: ENERGY });
    const { getByText, getByLabelText } = await render(<CrossTrainingSection />);
    await expand(getByLabelText);
    expect(getByText('2480')).toBeTruthy();
    expect(getByText('2160')).toBeTruthy();
    expect(getByText('nutrition.crossTraining.energy.delta:+320')).toBeTruthy();
  });

  it('🔴 affiche un écart NÉGATIF tel quel — manger moins est un fait, pas une faute', async () => {
    mockCross.mockReturnValue({ ...SILENT, energy: { ...ENERGY, deltaKcal: -400 } });
    const { getByText, getByLabelText } = await render(<CrossTrainingSection />);
    await expand(getByLabelText);
    expect(getByText('nutrition.crossTraining.energy.delta:-400')).toBeTruthy();
  });

  it('🔴 affiche LA MARGE utilisée — sans elle, deux taux dans l’app seraient inexplicables', async () => {
    mockCross.mockReturnValue({
      ...SILENT,
      adherence: { trainingPct: 64, restPct: 85, marginPct: 5, trainingDays: 11, restDays: 13 },
    });
    const { getByText, getByLabelText } = await render(<CrossTrainingSection />);
    await expand(getByLabelText);
    expect(getByText('nutrition.crossTraining.adherence.margin:5')).toBeTruthy();
    expect(getByText('64 %')).toBeTruthy();
  });
});

describe('CrossTrainingSection — 🔴 sans pesée (spec D4)', () => {
  beforeEach(() => {
    mockCross.mockReturnValue({ ...SILENT, energy: ENERGY, protein: null });
  });

  it('garde la carte protéines et affiche son REMÈDE', async () => {
    // Masquer la carte laisserait l'utilisateur ignorer à jamais qu'il lui manque une pesée.
    const { getByText, getByLabelText } = await render(<CrossTrainingSection />);
    await expand(getByLabelText);
    expect(getByText('nutrition.crossTraining.protein.title')).toBeTruthy();
    expect(getByText('nutrition.crossTraining.protein.needsWeight')).toBeTruthy();
  });

  it('le remède est actionnable — il mène aux mensurations', async () => {
    const { getByLabelText } = await render(<CrossTrainingSection />);
    await expand(getByLabelText);
    await act(async () => {
      fireEvent.press(getByLabelText('nutrition.crossTraining.protein.needsWeight'));
    });
    expect(mockPush).toHaveBeenCalledWith('/measurements');
  });
});
