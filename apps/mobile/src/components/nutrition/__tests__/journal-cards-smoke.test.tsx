/**
 * journal-cards-smoke.test.tsx — Smoke test des cartes de la refonte Nutrition (30/07/2026).
 *
 * Couvre ce que la maquette a introduit et que rien d'autre ne teste :
 *  1. `MacroTriple` rend les 3 macros, avec ou sans cibles ;
 *  2. `MicroCoverageGrid` affiche le % de couverture, et l'omet pour une clé sans VNR (sel).
 *
 * `DayBalanceCard` en est sortie le 30/09/2026 (LIENS-01) : codée, montée nulle part, retirée.
 *
 * `react-native-svg` est natif → mocké, comme dans les autres smokes de l'app.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { MacroTriple } from '../MacroTriple';
import { MicroCoverageGrid } from '../MicroCoverageGrid';

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const stub = (name: string) => {
    const Stub = ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, { testID: name }, children);
    Stub.displayName = `SvgStub(${name})`;
    return Stub;
  };
  return {
    __esModule: true,
    default: stub('svg'),
    Svg: stub('svg'),
    Circle: stub('circle'),
    Line: stub('line'),
    Path: stub('path'),
    G: stub('g'),
    Text: stub('svg-text'),
    Defs: stub('defs'),
    LinearGradient: stub('lg'),
    RadialGradient: stub('rg'),
    Stop: stub('stop'),
  };
});

// `t` renvoie la clé : on assert donc sur les clés, pas sur la traduction (qui peut bouger).
// `initReactI18next` reste exporté : une carte qui tire `useTheme` → `settings-repository` →
// `src/i18n` appelle `i18n.use(initReactI18next)` au chargement.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

describe('MacroTriple', () => {
  const consumed = { protein: 124, carbs: 180, fat: 52 };

  it('rend les 3 macros avec leur cible', async () => {
    const { getByText } = await render(
      <MacroTriple consumed={consumed} targets={{ protein: 165, carbs: 290, fat: 78 }} />,
    );
    expect(getByText('124 / 165 g')).toBeTruthy();
    expect(getByText('180 / 290 g')).toBeTruthy();
    expect(getByText('52 / 78 g')).toBeTruthy();
  });

  it('omet la cible quand aucun objectif n’est défini', async () => {
    const { getByText } = await render(<MacroTriple consumed={consumed} targets={null} />);
    expect(getByText('124 g')).toBeTruthy();
  });
});

describe('MicroCoverageGrid', () => {
  it('affiche le pourcentage de couverture d’une clé à VNR', async () => {
    const { getByText } = await render(
      <MicroCoverageGrid
        cells={[{ key: 'iron_mg', label: 'Fer', value: '8,4', unit: 'mg', amount: 8.4 }]}
      />,
    );
    // VNR fer = 14 mg → 8,4 / 14 = 60 %
    expect(getByText('60')).toBeTruthy();
    expect(getByText('Fer')).toBeTruthy();
  });

  it('n’affiche pas de pourcentage pour le sel (aucune VNR)', async () => {
    const { getByText } = await render(
      <MicroCoverageGrid
        cells={[{ key: 'salt', label: 'Sel', value: '4,20', unit: 'g', amount: null }]}
      />,
    );
    expect(getByText('Sel')).toBeTruthy();
    expect(getByText('—')).toBeTruthy();
  });

  it('ne rend rien sans micronutriment suivi', async () => {
    const { toJSON } = await render(<MicroCoverageGrid cells={[]} />);
    expect(toJSON()).toBeNull();
  });
});
