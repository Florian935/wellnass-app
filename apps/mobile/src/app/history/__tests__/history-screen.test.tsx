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
// US IDENT-01 — chaque écran du pilier déclare son identité (`useMenuFocus`). Le hook s'appuie sur
// `useFocusEffect` et `useNavigation`, absents du mock d'`expo-router` de ce fichier : on le neutralise
// ici, comme les tests des onglets et du pilier Course. Son comportement est testé dans
// `hooks/__tests__/useMenuFocus.test.tsx`.
jest.mock('@/hooks/useMenuFocus', () => ({ useMenuFocus: jest.fn() }));

it('🔴 redirige vers Muscu › Historique', async () => {
  await render(<HistoryRedirect />);

  expect(
    screen.getByText('redirection:{"pathname":"/(tabs)/strength","params":{"section":"history"}}'),
  ).toBeTruthy();
});
