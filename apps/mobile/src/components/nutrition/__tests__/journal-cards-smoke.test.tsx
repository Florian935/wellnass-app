/**
 * journal-cards-smoke.test.tsx — Smoke test des cartes de la refonte Nutrition (30/07/2026).
 *
 * Couvre ce que la maquette a introduit et que rien d'autre ne teste :
 *  1. `DayBalanceCard` affiche le restant, et bascule sur le libellé « au-delà » en dépassement ;
 *  2. sans objectif, elle propose le réglage au lieu d'un anneau vide ;
 *  3. `MacroTriple` rend les 3 macros, avec ou sans cibles ;
 *  4. `MicroCoverageGrid` affiche le % de couverture, et l'omet pour une clé sans VNR (sel).
 *
 * `react-native-svg` est natif → mocké, comme dans les autres smokes de l'app.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { DayBalanceCard } from '../DayBalanceCard';
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
// `initReactI18next` doit rester exporté : `DayBalanceCard` tire `Button` → `useTheme` →
// `settings-repository` → `src/i18n`, qui appelle `i18n.use(initReactI18next)` au chargement.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const balanceProps = {
  consumed: 1480,
  target: 2150,
  trainingBonus: 250,
  bonusSource: 'forfait' as const,
  isTrainingDay: false,
  onSetTarget: jest.fn(),
};

describe('DayBalanceCard', () => {
  it('affiche le restant et le détail consommé / objectif', async () => {
    const { getByText, getAllByText } = await render(<DayBalanceCard {...balanceProps} />);
    // 2150 - 1480 = 670, écrit deux fois : au centre de l'anneau et sur la ligne « Restant ».
    expect(getAllByText('670')).toHaveLength(2);
    expect(getByText('journal.balance.kcalRemaining')).toBeTruthy();
    expect(getByText('journal.balance.consumed')).toBeTruthy();
    expect(getByText('journal.balance.target')).toBeTruthy();
  });

  it('bascule sur « au-delà » quand l’objectif est dépassé', async () => {
    const { getByText, queryByText } = await render(<DayBalanceCard {...balanceProps} consumed={2400} />);
    expect(getByText('journal.balance.kcalOver')).toBeTruthy();
    expect(queryByText('journal.balance.kcalRemaining')).toBeNull();
  });

  it('propose de définir un objectif quand il n’y en a pas', async () => {
    const { getByText, queryByText } = await render(<DayBalanceCard {...balanceProps} target={null} />);
    expect(getByText('journal.balance.noTargetHint')).toBeTruthy();
    expect(queryByText('journal.balance.kcalRemaining')).toBeNull();
  });

  it('n’affiche le badge de séance que les jours concernés', async () => {
    const off = await render(<DayBalanceCard {...balanceProps} />);
    expect(off.queryByText('journal.trainingDayBadge')).toBeNull();

    const on = await render(<DayBalanceCard {...balanceProps} isTrainingDay />);
    expect(on.getByText('journal.trainingDayBadge')).toBeTruthy();
  });
});

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
