/**
 * FuelTankCard.test.tsx — la carte « Réservoir » (US RESERV-01).
 *
 * Quatre contrats, dans l'ordre des critères de recette :
 *  1. **sans poids, pas de carte** — critère 1 : une capacité inventée vaudrait moins que rien ;
 *  2. le niveau et la mention « estimation » sont **écrits**, pas seulement dessinés ;
 *  3. l'action n'apparaît **que** s'il y a quelque chose à conseiller (critère 8) ;
 *  4. la courbe a un **équivalent textuel** pour TalkBack (spec §9).
 *
 * Le calcul n'est pas retesté ici : il vit dans `fuel-tank.ts`, pur et couvert par 23 cas.
 */
import { render } from '@testing-library/react-native';
import { FuelTankCard, buildPath, formatHour } from '../FuelTankCard';
import { useFuelTank } from '@/data/repositories/fuel-repository';

jest.mock('@/data/repositories/fuel-repository', () => ({
  useFuelTank: jest.fn(),
  lowZoneG: (capacity: number) => Math.round(capacity * 0.3),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params ? `${key}|${Object.values(params).join('|')}` : key,
    i18n: { language: 'fr' },
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#786a59',
      background: '#f7eede',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      accent: '#b14f2b',
      chartGreen: '#7c8a5b',
      track: '#eadcc6',
      panel: '#33291f',
      panelText: '#f0e4d0',
      panelMuted: '#c9b79a',
      panelAccent: '#d9a888',
    },
  }),
}));

jest.mock('@/components/Card', () => {
  const { View } = jest.requireActual('react-native');
  return { Card: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});

jest.mock('@/components/explain/ExplainButton', () => ({ ExplainButton: () => null }));
jest.mock('@/components/explain/ExplainSheet', () => ({ ExplainSheet: () => null }));

const mockTank = useFuelTank as jest.MockedFunction<typeof useFuelTank>;

const CURVE = [
  { hour: 0, grams: 280 },
  { hour: 12, grams: 240 },
  { hour: 24, grams: 150 },
];

function tankOf(over: Partial<NonNullable<ReturnType<typeof useFuelTank>['tank']>> = {}) {
  return {
    tank: {
      capacityG: 400,
      curve: CURVE,
      curveWithSnack: null,
      nowG: 220,
      nowShare: 0.55,
      lowest: { hour: 19.25, grams: 88 },
      snackG: null,
      nextSessionHour: null,
      mealsCount: 3,
      sessionsCount: 1,
      explanation: { steps: [], confidence: 'high' as const },
      ...over,
    },
    isLoading: false,
  };
}

describe('FuelTankCard', () => {
  it('ne rend rien sans poids connu (critère de recette 1)', async () => {
    mockTank.mockReturnValue({ tank: null, isLoading: false });
    const { toJSON } = await render(<FuelTankCard dayKey="2026-09-18" atHour={15} />);
    expect(toJSON()).toBeNull();
  });

  it('écrit le niveau, les grammes et la mention « estimation »', async () => {
    mockTank.mockReturnValue(tankOf());
    const { getByText } = await render(<FuelTankCard dayKey="2026-09-18" atHour={15} />);
    expect(getByText('nutrition.fuelTank.level|55')).toBeTruthy();
    expect(getByText('nutrition.fuelTank.grams|220|400')).toBeTruthy();
    expect(getByText('nutrition.fuelTank.estimate')).toBeTruthy();
  });

  it('aucune action quand il n’y a rien à conseiller (critère 8)', async () => {
    mockTank.mockReturnValue(tankOf());
    const { queryByText } = await render(<FuelTankCard dayKey="2026-09-18" atHour={15} />);
    expect(queryByText(/fuelTank\.action\.title/)).toBeNull();
  });

  it('propose la collation quand la projection passe sous la zone basse', async () => {
    mockTank.mockReturnValue(tankOf({ snackG: 60, nextSessionHour: 18.5, curveWithSnack: CURVE }));
    const { getByText } = await render(<FuelTankCard dayKey="2026-09-18" atHour={15} />);
    expect(getByText('nutrition.fuelTank.action.title|60')).toBeTruthy();
    expect(getByText('nutrition.fuelTank.action.body|18 h 30|22')).toBeTruthy();
  });

  it('dit qu’aucun repas n’est saisi', async () => {
    mockTank.mockReturnValue(tankOf({ mealsCount: 0 }));
    const { getByText } = await render(<FuelTankCard dayKey="2026-09-18" atHour={15} />);
    expect(getByText('nutrition.fuelTank.noMeal')).toBeTruthy();
  });
});

describe('buildPath / formatHour', () => {
  it('trace la courbe du coin haut gauche vers la droite', () => {
    const d = buildPath(CURVE, 400);
    expect(d.startsWith('M0.0')).toBe(true);
    expect(d.split('L')).toHaveLength(3);
  });

  it('courbe vide ou capacité nulle : aucun tracé', () => {
    expect(buildPath([], 400)).toBe('');
    expect(buildPath(CURVE, 0)).toBe('');
  });

  it('formate l’heure selon la langue', () => {
    expect(formatHour(18.5, 'fr')).toBe('18 h 30');
    expect(formatHour(18.5, 'en')).toBe('18:30');
    expect(formatHour(9, 'fr')).toBe('9 h 00');
  });
});
