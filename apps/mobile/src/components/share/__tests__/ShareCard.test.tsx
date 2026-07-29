/**
 * US PARTAGE-01 — smoke test de la carte partageable.
 *
 * Ce qui est vérifié est le **contrat de l'US**, pas le rendu pixel :
 *  - **aucune donnée de santé** sur l'image (décision D7) — c'est la règle qu'on ne peut pas
 *    rattraper une fois l'image partie sur un réseau public ;
 *  - une séance **sans record** n'affiche pas de section vide ;
 *  - une course **sans tracé exploitable** rend quand même sa carte (chiffres seuls), sans planter.
 *
 * `react-native-svg` est du natif → mocké, comme dans `charts-smoke.test.tsx`.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { ShareCard, type ShareCardData } from '../ShareCard';

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Stub = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, { testID: 'svg' }, children);
  return { __esModule: true, default: Stub, Path: Stub, Circle: Stub };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
}));

const runData: ShareCardData = {
  kind: 'run',
  points: [
    { lat: 45.777, lng: 3.087 },
    { lat: 45.787, lng: 3.097 },
  ],
  startedAtMs: new Date(2026, 6, 29, 18, 5).getTime(),
  stats: { distance: '12,4 km', duration: '1 h 02 min', pace: "5'00 /km" },
};

const workoutData: ShareCardData = {
  kind: 'workout',
  startedAtMs: new Date(2026, 6, 29, 18, 5).getTime(),
  stats: { exercises: 4, sets: 12, volume: '8 200,0 kg', duration: '65 min' },
  records: ['Développé couché · 105,0 kg'],
};

describe('ShareCard', () => {
  it('affiche les chiffres de la course', async () => {
    const { getByText } = await render(<ShareCard data={runData} size={320} />);
    expect(getByText('12,4 km')).toBeTruthy();
    expect(getByText("5'00 /km")).toBeTruthy();
  });

  it('trace le parcours en SVG — jamais une capture de carte native', async () => {
    const { queryAllByTestId } = await render(<ShareCard data={runData} size={320} />);
    expect(queryAllByTestId('svg').length).toBeGreaterThan(0);
  });

  it('rend la carte SANS tracé quand le GPS n’a rien donné, sans planter', async () => {
    // Tous les points confondus : `isDrawableTrack` est faux, les chiffres portent seuls la carte.
    const stuck: ShareCardData = {
      ...runData,
      points: [
        { lat: 45.777, lng: 3.087 },
        { lat: 45.777, lng: 3.087 },
      ],
    };
    const { getByText, queryAllByTestId } = await render(<ShareCard data={stuck} size={320} />);
    expect(getByText('12,4 km')).toBeTruthy();
    expect(queryAllByTestId('svg')).toHaveLength(0);
  });

  it('affiche les records d’une séance qui en a', async () => {
    const { getByText } = await render(<ShareCard data={workoutData} size={320} />);
    expect(getByText('Développé couché · 105,0 kg')).toBeTruthy();
    expect(getByText('share.workout.records')).toBeTruthy();
  });

  it('n’affiche PAS de section records vide quand il n’y en a aucun', async () => {
    const { queryByText, getByText } = await render(
      <ShareCard data={{ ...workoutData, records: [] }} size={320} />,
    );
    expect(queryByText('share.workout.records')).toBeNull();
    // Les chiffres, eux, restent là : la carte n'est jamais vide.
    expect(getByText('8 200,0 kg')).toBeTruthy();
  });

  it('borne les records affichés à 3 — au-delà la carte devient une liste illisible', async () => {
    const many = ['A · 1 kg', 'B · 2 kg', 'C · 3 kg', 'D · 4 kg', 'E · 5 kg'];
    const { queryByText } = await render(
      <ShareCard data={{ ...workoutData, records: many }} size={320} />,
    );
    expect(queryByText('C · 3 kg')).toBeTruthy();
    expect(queryByText('D · 4 kg')).toBeNull();
  });

  it('ne porte AUCUNE donnée de santé (D7) : ni poids de corps, ni mensuration, ni bien-être', async () => {
    // Le tonnage soulevé est une donnée d'activité, pas de santé — il reste autorisé. Ce qui est
    // interdit, c'est le poids DE CORPS, les circonférences et les indicateurs subjectifs. Ce test
    // fige l'intention : si un jour quelqu'un ajoute le poids à la carte, il échoue.
    const { toJSON } = await render(<ShareCard data={workoutData} size={320} />);
    const rendered = JSON.stringify(toJSON());
    for (const forbidden of ['weight.', 'bodyWeight', 'measurements.', 'wellbeing.']) {
      expect(rendered).not.toContain(forbidden);
    }
  });
});
