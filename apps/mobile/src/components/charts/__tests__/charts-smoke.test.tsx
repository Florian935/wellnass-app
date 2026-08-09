/**
 * charts-smoke.test.tsx — Smoke test minimal pour les composants graphes.
 *
 * Vérifie que :
 *  1. ProgressLineChart rend sans planter avec des données valides.
 *  2. MuscleVolumeBarChart rend sans planter avec des données valides.
 *  3. Les deux composants rendent null quand data est vide.
 *
 * react-native-gifted-charts et react-native-svg utilisent de l'ESM / du natif ;
 * on les mocke entièrement pour isoler les composants de la lib.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { ProgressLineChart } from '../ProgressLineChart';
import { MuscleVolumeBarChart } from '../MuscleVolumeBarChart';

// ---------------------------------------------------------------------------
// Mock react-native-gifted-charts — ESM non transformé par jest.
// On utilise require() dans la factory pour contourner la restriction de portée
// des variables dans jest.mock() (babel hoist).
// ---------------------------------------------------------------------------

jest.mock('react-native-gifted-charts', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LineChart: ({ testID }: { testID?: string }) =>
      React.createElement(View, { testID: testID ?? 'line-chart' }),
    BarChart: ({ testID }: { testID?: string }) =>
      React.createElement(View, { testID: testID ?? 'bar-chart' }),
  };
});

// Les deux graphes lisent la locale active (`useTranslation().i18n.language`) pour le séparateur
// décimal de l'infobulle (US UX-01). Sans instance i18next montée ici, react-i18next émettrait un
// avertissement à chaque rendu : on le mocke, comme les autres smokes de l'app.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
}));

// ---------------------------------------------------------------------------
// Mock react-native-svg — module natif
// ---------------------------------------------------------------------------

jest.mock('react-native-svg', () => {
  const { View: RNView } = require('react-native');
  return {
    __esModule: true,
    default: RNView,
    Svg: RNView,
    Path: RNView,
    G: RNView,
    Rect: RNView,
    Circle: RNView,
    Text: RNView,
  };
});

// ---------------------------------------------------------------------------
// Mock useTheme (évite useSettings → PowerSync)
// ---------------------------------------------------------------------------

jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      background: '#f7eede',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
      success: '#7c8a5b',
      danger: '#b23b2e',
    },
  })),
}));

// ---------------------------------------------------------------------------
// Données de test
// ---------------------------------------------------------------------------

const sampleData = [
  { label: 'Sem 1', value: 100 },
  { label: 'Sem 2', value: 120 },
  { label: 'Sem 3', value: 110 },
];

// ---------------------------------------------------------------------------
// Tests ProgressLineChart
// ---------------------------------------------------------------------------

describe('ProgressLineChart — smoke test', () => {
  it('rend sans planter avec des données valides', async () => {
    const { getByTestId } = await render(
      <ProgressLineChart data={sampleData} title="Charge totale" unit="kg" />,
    );
    expect(getByTestId('line-chart')).toBeTruthy();
  });

  it('rend null quand data est vide', async () => {
    const { toJSON } = await render(<ProgressLineChart data={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('rend sans title ni unit', async () => {
    const { getByTestId } = await render(<ProgressLineChart data={sampleData} />);
    expect(getByTestId('line-chart')).toBeTruthy();
  });

  it('rend avec smooth sur une série longue (≥ 4 points)', async () => {
    // ⚠️ sampleData du fichier n'a que 3 points → série locale ≥ 4 points ici.
    const longData = [
      { label: 'L', value: 80 }, { label: 'Ma', value: 79 }, { label: 'Me', value: 81 },
      { label: 'J', value: 78 }, { label: 'V', value: 80 }, { label: 'S', value: 79 },
    ];
    const { getByTestId } = await render(
      <ProgressLineChart data={longData} title="Poids" unit="kg" smooth />,
    );
    expect(getByTestId('line-chart')).toBeTruthy();
  });

  it('rend avec smooth sur une série courte (< 4 points) sans crash', async () => {
    const short = [
      { label: 'L', value: 80 },
      { label: 'M', value: 81 },
    ];
    const { getByTestId } = await render(<ProgressLineChart data={short} smooth />);
    expect(getByTestId('line-chart')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tests MuscleVolumeBarChart
// ---------------------------------------------------------------------------

describe('MuscleVolumeBarChart — smoke test', () => {
  it('rend sans planter avec des données valides', async () => {
    const { getByTestId } = await render(
      <MuscleVolumeBarChart data={sampleData} title="Volume par semaine" unit="séries" />,
    );
    expect(getByTestId('bar-chart')).toBeTruthy();
  });

  it('rend null quand data est vide', async () => {
    const { toJSON } = await render(<MuscleVolumeBarChart data={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('rend sans title ni unit', async () => {
    const { getByTestId } = await render(<MuscleVolumeBarChart data={sampleData} />);
    expect(getByTestId('bar-chart')).toBeTruthy();
  });
});
