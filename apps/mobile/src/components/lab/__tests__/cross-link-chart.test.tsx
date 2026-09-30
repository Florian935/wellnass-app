/**
 * US LABO-03 — le graphique d'une fiche de lien.
 *
 * Ce qui est vérifié ici, et que le dessin ne dit pas à un test :
 *  1. **chaque forme se monte** (sept formes, une par nature de lien) — une forme qui plante emporte
 *     toute la fiche ;
 *  2. **un trou reste un trou** : la lecture d'une semaine sans donnée dit « pas de donnée », jamais
 *     « 0 » ;
 *  3. **toucher une semaine la lit** : la ligne au-dessus du dessin change (c'est elle que TalkBack lit,
 *     le dessin étant caché aux lecteurs d'écran) ;
 *  4. **deux mesures, deux panneaux** : le graphique protéines × force dit, sous le dessin, qu'il n'y a
 *     pas d'axe commun.
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { CrossLinkChart as Chart } from '@wellness/shared';

import { CrossLinkChart } from '../CrossLinkChart';

jest.mock('react-native-svg', () => {
  const { Text, View } = require('react-native');
  const Stub = ({ children }: { children?: React.ReactNode }) => <View>{children}</View>;
  const SvgText = ({ children }: { children?: React.ReactNode }) => <Text>{children}</Text>;
  return { __esModule: true, default: Stub, Svg: Stub, Circle: Stub, G: Stub, Line: Stub, Path: Stub, Rect: Stub, Text: SvgText };
});
// Le tableau du cycle suit le système d'unités (revue du 30/09/2026) : un double qui se reconnaît.
jest.mock('@/hooks/useUnits', () => ({ useUnits: () => ({ formatPace: (s: number) => `allure-${s}` }) }));
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
      textMuted: '#96856f',
      surface: '#fffaf2',
      border: '#ece0cd',
      pillarLab: '#7a5714',
      pillarStrength: '#8a3d2a',
      pillarRunning: '#2f6b6b',
      pillarNutrition: '#6b7a2f',
      amber: '#d99a2b',
      danger: '#b23b2e',
      success: '#3f7d4f',
    },
  }),
}));

const WEEKS = ['2026-08-06', '2026-08-13', '2026-08-20', '2026-08-27', '2026-09-03', '2026-09-10', '2026-09-17', '2026-09-24'];

const CHARTS: Chart[] = [
  {
    type: 'pair',
    weeks: WEEKS,
    protein: [1.8, 1.8, null, 1.7, 1.6, 1.5, 1.4, 1.4],
    band: [1.6, 2.2],
    lift: { name: 'Squat', values: [108, 111, 113, 116, 119, 120, 120, 120], plateauFrom: 5 },
  },
  { type: 'split', exposed: [252, 249, 255, 250], other: [246, 248, 244, 249, 247] },
  { type: 'groups', hard: 3.2, easy: 3.4, hardDays: 4, easyDays: 10, band: [5, 7] },
  { type: 'band', weeks: WEEKS, values: [0.95, 1.02, 1.08, null, 1.05, 1.12, 1.15, 1.42] },
  { type: 'line', metric: 'weightKg', weeks: WEEKS, values: [72.9, 72.8, 72.7, 72.7, null, 72.5, 72.4, 72.4] },
  { type: 'grid', weeks: WEEKS, rows: [{ pillar: 'strength', values: [3, 3, 2, null, 3, 3, 4, 3] }, { pillar: 'running', values: [2, 3, 3, 2, 0, 3, 3, 2] }] },
  { type: 'phases', metrics: [{ metric: 'energy', byPhase: { menstrual: 2.6, follicular: 3.4, ovulatory: 3.6, luteal: 3.0 } }] },
];

describe('CrossLinkChart', () => {
  it.each(CHARTS.map((c) => [c.type, c] as const))('la forme « %s » se monte', async (_type, chart) => {
    await render(<CrossLinkChart chart={chart} />);

    expect(screen.getByTestId(`lab-chart-${chart.type}`)).toBeTruthy();
  });

  it('🔴 une semaine sans donnée se lit « pas de donnée », jamais zéro', async () => {
    await render(<CrossLinkChart chart={CHARTS[3]!} />);

    // La 4ᵉ semaine de la bande ACWR est un trou.
    await act(async () => {
      fireEvent.press(screen.getAllByRole('button')[3]!);
    });

    expect(screen.getByText(/lab\.fiche\.chart\.noValue/)).toBeTruthy();
  });

  it('toucher une semaine change la lecture, qui part de la semaine en cours', async () => {
    await render(<CrossLinkChart chart={CHARTS[4]!} />);
    const avant = screen.getByText(/"week":"24\/09"/);
    expect(avant).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getAllByRole('button')[0]!);
    });

    expect(screen.getByText(/"week":"06\/08"/)).toBeTruthy();
  });

  it('le tableau du cycle écrit l’allure dans les unités de l’utilisateur, et les calories en kcal', async () => {
    await render(
      <CrossLinkChart
        chart={{
          type: 'phases',
          metrics: [
            { metric: 'pace', byPhase: { menstrual: 330, follicular: 318, ovulatory: 315, luteal: 325 } },
            { metric: 'calories', byPhase: { menstrual: 2100, follicular: 2050, ovulatory: 2000, luteal: 2250 } },
          ],
        }}
      />,
    );

    // Avant : `formatPace` au kilomètre, quel que soit le réglage — une allure fausse en impérial.
    expect(screen.getByText('allure-318')).toBeTruthy();
    expect(screen.getByText('2250 nutrition.kcal')).toBeTruthy();
  });

  it('protéines × force : deux panneaux, et la note le dit', async () => {
    await render(<CrossLinkChart chart={CHARTS[0]!} />);

    expect(screen.getByText('lab.fiche.chart.pairNote')).toBeTruthy();
  });
});
