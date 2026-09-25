/**
 * `/history` (`app/history/index.tsx`) — une redirection depuis US MUSCU-UX07 (D7).
 *
 * L'historique des séances vit désormais dans l'onglet Historique du hub Musculation ; ce que ce
 * fichier vérifiait sur l'ancien écran (date de fin, liste vide, ouverture du détail, suppression)
 * est vérifié sur la section, dans `components/strength/__tests__/history-section.test.tsx`.
 *
 * Ce qui reste propre à la route : ne casser ni la carte d'activation du 6ᵉ jour, seul lien qui y
 * menait, ni un lien entrant.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import HistoryRedirect from '../index';

jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: unknown }) => <Text>redirection:{JSON.stringify(href)}</Text>,
  };
});

it('🔴 redirige vers Muscu › Historique', async () => {
  await render(<HistoryRedirect />);

  expect(
    screen.getByText('redirection:{"pathname":"/(tabs)/strength","params":{"section":"history"}}'),
  ).toBeTruthy();
});
