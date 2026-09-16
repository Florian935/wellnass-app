/**
 * EnergyCard.test.tsx — US DEPENSE-02.
 *
 * On teste le **contrat de la carte**, pas sa mise en page :
 *  - le chiffre affiché est l'estimation centrale, jamais le bas de fourchette ;
 *  - la fourchette et ce que la cible retient sont dits ;
 *  - sans poids, la carte affiche son **remède** et aucun chiffre — c'est la règle « pas de valeur
 *    neutre » (un poids inventé donnerait une dépense fausse et parfaitement crédible) ;
 *  - un chiffre de montre n'affiche pas de fourchette : c'est une mesure, pas une estimation.
 */
import { render } from '@testing-library/react-native';
import type { EnergyEstimate } from '@wellness/shared';
import { EnergyCard } from '../EnergyCard';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

const resting = { kcalPerHour: 74.17, personalised: true };

const estimate: EnergyEstimate = {
  kcal: 370,
  low: 260,
  high: 480,
  confidence: 'medium',
  met: 6,
  source: 'estimate',
};

describe('EnergyCard', () => {
  it('affiche l’estimation centrale et sa fourchette', async () => {
    const { getByText, queryByText } = await render(
      <EnergyCard estimate={estimate} resting={resting} activeMinutes={60} />,
    );
    expect(getByText('370')).toBeTruthy();
    expect(queryByText(/260/)).toBeTruthy(); // la fourchette mentionne le bas retenu
  });

  it('sans poids, montre le remède et aucun chiffre', async () => {
    const { queryByText, getByText } = await render(
      <EnergyCard estimate={null} resting={null} activeMinutes={60} />,
    );
    expect(queryByText('370')).toBeNull();
    expect(getByText('Il manque ton poids')).toBeTruthy();
    expect(getByText('Me peser')).toBeTruthy();
  });

  it('un chiffre de montre est repris tel quel, sans fourchette', async () => {
    const device: EnergyEstimate = {
      kcal: 812,
      low: 812,
      high: 812,
      confidence: 'high',
      met: null,
      source: 'device',
    };
    const { getByText, queryByText } = await render(
      <EnergyCard estimate={device} resting={resting} activeMinutes={90} />,
    );
    expect(getByText('812')).toBeTruthy();
    expect(getByText('Chiffre de ta montre — repris tel quel.')).toBeTruthy();
    expect(queryByText(/entre 812 et 812/)).toBeNull();
  });

  it('n’affiche l’effet sur la journée que si l’appelant le fournit', async () => {
    const sans = await render(<EnergyCard estimate={estimate} resting={resting} activeMinutes={60} />);
    expect(sans.queryByText('Effet du jour')).toBeNull();

    const avec = await render(
      <EnergyCard estimate={estimate} resting={resting} activeMinutes={60} dayEffect="Effet du jour" />,
    );
    expect(avec.getByText('Effet du jour')).toBeTruthy();
  });
});
