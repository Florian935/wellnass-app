/**
 * Carte « Macros par kg » — les états que la logique pure ne voit pas (MN-06 + FUEL-01).
 *
 * Ce fichier existe surtout pour **une** raison : FUEL-01 modifie une carte qui appartient à MN-06 et
 * que trois recettes en attente traversent (NUTR-10, NUTR-17, NUTR-18). Les trois premiers tests sont
 * des **non-régressions** : la ligne protéines doit continuer d'exister, avec sa valeur, sa cible et
 * son statut, que la ligne glucides s'affiche ou non.
 *
 * Le reste vérifie ce que la spec promet et qu'aucun calcul ne prouve :
 *  - la ligne glucides **disparaît** quand le hook ne renvoie rien (aucune course, pas de poids,
 *    pilier course éteint — les 4 conditions du §2 sont résolues côté hook, ici on voit l'effet) ;
 *  - la mention de journée est **absente** quand la journée est `unavailable` (décision D4) ;
 *  - le niveau de charge change la **référence affichée**, à apports constants (RN-05).
 *
 * Comme les autres tests d'écran du dépôt, `react-i18next` est mocké et les assertions portent sur
 * les **clés** : on vérifie le câblage, pas la traduction (elle a son propre contrôle d'alignement).
 *
 * ⚠️ **`render()` est ASYNCHRONE ici** (RNTL 14 + React 19) : il renvoie une promesse, et sans
 * `await` les queries de `screen` échouent sur « `render` function has not been called » — un
 * message qui envoie chercher le problème au mauvais endroit. Les tests existants du dépôt le
 * masquent derrière un `setup()` async sans le dire ; c'est écrit ici pour le prochain.
 */
import { render, screen } from '@testing-library/react-native';
import type { CarbsPerKg, ProteinPerKg } from '@wellness/shared';
import { ProteinPerKgCard } from '../ProteinPerKgCard';

const mockUseProteinPerKg = jest.fn();
const mockUseCarbsPerKg = jest.fn();
jest.mock('@/data/repositories/nutrition-repository', () => ({
  useProteinPerKg: (...a: unknown[]) => mockUseProteinPerKg(...a),
  useCarbsPerKg: (...a: unknown[]) => mockUseCarbsPerKg(...a),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${JSON.stringify(opts)}` : key,
    i18n: { language: 'fr' },
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
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      borderStrong: '#90897d',
      accent: '#b14f2b',
      accentText: '#ffffff',
      success: '#66714b',
      danger: '#b23b2e',
      warn: '#f7ead6',
      warnBorder: '#e9cfa0',
      warnText: '#8a6419',
    },
  })),
}));

const PROTEIN: ProteinPerKg = { gPerKg: 1.9, target: { min: 1.6, max: 2.0 }, status: 'in' };

function proteinOk() {
  mockUseProteinPerKg.mockReturnValue({
    result: PROTEIN,
    objective: 'maintain',
    hasWeight: true,
    isLoading: false,
  });
}

function carbs(result: CarbsPerKg | null, level: string | null, dayKind = 'easy') {
  mockUseCarbsPerKg.mockReturnValue({ result, level, dayKind, hasWeight: true, isLoading: false });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ProteinPerKgCard — non-régression MN-06', () => {
  it('la ligne protéines est rendue même sans ligne glucides', async () => {
    proteinOk();
    carbs(null, null);
    await render(<ProteinPerKgCard />);
    expect(screen.getByText('stats.macrosPerKg.protein')).toBeTruthy();
    expect(screen.getByText('1,9 stats.protein.perKgUnit')).toBeTruthy();
    expect(screen.getByText(/stats\.protein\.target.*"min":"1,6".*"max":"2,0"/)).toBeTruthy();
    expect(screen.getByText('stats.protein.status.in')).toBeTruthy();
    // Aucune trace de glucides quand le hook ne renvoie rien.
    expect(screen.queryByText('stats.macrosPerKg.carbs')).toBeNull();
  });

  it('la ligne protéines survit à l’ajout de la ligne glucides', async () => {
    proteinOk();
    carbs({ gPerKg: 4.2, target: { min: 3, max: 5 }, status: 'in' }, 'light');
    await render(<ProteinPerKgCard />);
    expect(screen.getByText('stats.macrosPerKg.protein')).toBeTruthy();
    expect(screen.getByText('1,9 stats.protein.perKgUnit')).toBeTruthy();
    expect(screen.getByText('stats.macrosPerKg.carbs')).toBeTruthy();
    expect(screen.getByText('4,2 stats.protein.perKgUnit')).toBeTruthy();
  });

  it('sans pesée : le message existant de MN-06, et aucune ligne', async () => {
    mockUseProteinPerKg.mockReturnValue({
      result: null,
      objective: 'maintain',
      hasWeight: false,
      isLoading: false,
    });
    carbs(null, null);
    await render(<ProteinPerKgCard />);
    expect(screen.getByText('stats.protein.noWeight')).toBeTruthy();
    expect(screen.queryByText('stats.macrosPerKg.carbs')).toBeNull();
  });

  it('le titre de la carte est celui des deux macros, pas celui des protéines seules', async () => {
    proteinOk();
    carbs(null, null);
    await render(<ProteinPerKgCard />);
    expect(screen.getByText('stats.macrosPerKg.title')).toBeTruthy();
    expect(screen.queryByText('stats.protein.title')).toBeNull();
  });
});

describe('ProteinPerKgCard — ligne glucides (FUEL-01)', () => {
  it('la référence affichée suit le niveau de charge, à apports constants', async () => {
    proteinOk();
    carbs({ gPerKg: 4.2, target: { min: 7, max: 10 }, status: 'low' }, 'high', 'hard');
    await render(<ProteinPerKgCard />);
    expect(screen.getByText('4,2 stats.protein.perKgUnit')).toBeTruthy();
    expect(
      screen.getByText(
        /stats\.macrosPerKg\.carbsReference.*"min":"7,0".*"max":"10,0".*stats\.macrosPerKg\.load\.high/,
      ),
    ).toBeTruthy();
    expect(screen.getByText('stats.macrosPerKg.day.hard')).toBeTruthy();
    expect(screen.getByText('stats.protein.status.low')).toBeTruthy();
  });

  it('journée sans course planifiée : la mention le dit', async () => {
    proteinOk();
    carbs({ gPerKg: 6.1, target: { min: 5, max: 7 }, status: 'in' }, 'moderate', 'rest');
    await render(<ProteinPerKgCard />);
    expect(screen.getByText('stats.macrosPerKg.day.rest')).toBeTruthy();
  });

  it('journée indisponible (course libre) : AUCUNE mention de journée (D4)', async () => {
    proteinOk();
    carbs({ gPerKg: 6.1, target: { min: 5, max: 7 }, status: 'in' }, 'moderate', 'unavailable');
    await render(<ProteinPerKgCard />);
    expect(screen.getByText('stats.macrosPerKg.carbs')).toBeTruthy();
    expect(screen.queryByText('stats.macrosPerKg.day.hard')).toBeNull();
    expect(screen.queryByText('stats.macrosPerKg.day.easy')).toBeNull();
    expect(screen.queryByText('stats.macrosPerKg.day.rest')).toBeNull();
  });

  it('la ligne glucides est un bloc accessible unique, pas des fragments', async () => {
    proteinOk();
    carbs({ gPerKg: 4.2, target: { min: 3, max: 5 }, status: 'in' }, 'light');
    await render(<ProteinPerKgCard />);
    // Un seul label composé : macro + valeur + unité + référence + statut.
    expect(
      screen.getByLabelText(
        /stats\.macrosPerKg\.carbs 4,2 stats\.protein\.perKgUnit,.*carbsReference.*stats\.protein\.status\.in/,
      ),
    ).toBeTruthy();
  });
});
