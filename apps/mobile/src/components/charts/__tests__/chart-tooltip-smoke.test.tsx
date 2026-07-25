/**
 * chart-tooltip-smoke.test.tsx — infobulle partagée des graphiques (US UX-01).
 *
 * Vérifie le rendu des deux lignes et l'étiquette d'accessibilité, en thème clair et sombre. Le geste
 * réel (tap sur un point / une barre) n'est pas simulable ici (touches natives + rendu SVG de
 * react-native-gifted-charts) : il est couvert par la recette device.
 *
 * Mocks : useTheme uniquement — le composant ne dépend de rien d'autre.
 */
import { render } from '@testing-library/react-native';
import { ChartTooltip } from '../ChartTooltip';
import { useTheme } from '@/theme/useTheme';

jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(),
}));

const LIGHT = {
  scheme: 'light',
  colors: {
    text: '#33291f', textMuted: '#96856f', background: '#fffcf5', surface: '#fffaf2',
    border: '#ece0cd', accent: '#6b0028', accentText: '#fff', danger: '#b3261e',
  },
};

const DARK = {
  scheme: 'dark',
  colors: {
    text: '#f2e9dc', textMuted: '#a08f79', background: '#1b1611', surface: '#221c17',
    border: '#3a3129', accent: '#c9a96e', accentText: '#1b1611', danger: '#e5837a',
  },
};

describe('ChartTooltip', () => {
  beforeEach(() => {
    (useTheme as jest.Mock).mockReturnValue(LIGHT);
  });

  it('rend la date et la valeur formatée', async () => {
    const { getByText } = await render(<ChartTooltip heading="12/07/2026" value="82,5 kg" />);
    expect(getByText('12/07/2026')).toBeTruthy();
    expect(getByText('82,5 kg')).toBeTruthy();
  });

  it('expose un libellé d\'accessibilité groupé', async () => {
    const { getByLabelText } = await render(<ChartTooltip heading="12/07/2026" value="82,5 kg" />);
    expect(getByLabelText('12/07/2026, 82,5 kg')).toBeTruthy();
  });

  it('accepte un en-tête non daté (groupe musculaire) et une valeur sans unité', async () => {
    const { getByText } = await render(<ChartTooltip heading="Dos" value="18" />);
    expect(getByText('Dos')).toBeTruthy();
    expect(getByText('18')).toBeTruthy();
  });

  it('rend en thème sombre', async () => {
    (useTheme as jest.Mock).mockReturnValue(DARK);
    const { getByText } = await render(<ChartTooltip heading="12/07/2026" value="6:52 /km" />);
    expect(getByText('6:52 /km')).toBeTruthy();
  });
});
