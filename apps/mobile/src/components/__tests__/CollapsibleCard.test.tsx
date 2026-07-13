/**
 * CollapsibleCard.test.tsx — carte de séance repliable.
 *
 * Vérifie : replié par défaut (children cachés), footer toujours visible,
 * tap sur l'en-tête → children révélés.
 */
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { CollapsibleCard } from '../CollapsibleCard';

jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      background: '#f7eede',
      surface: '#fffaf2',
      border: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
    },
  })),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

describe('CollapsibleCard', () => {
  it('replié par défaut : children cachés, footer visible ; tap en-tête → children visibles', async () => {
    const { getByRole, getByText, queryByText, findByText } = await render(
      <CollapsibleCard title="Séance A" summary="5 exercices" footer={<Text>Démarrer</Text>}>
        <Text>Détail exercice</Text>
      </CollapsibleCard>,
    );

    // Footer toujours visible + résumé dans l'en-tête.
    expect(getByText('Démarrer')).toBeTruthy();
    expect(getByText('5 exercices')).toBeTruthy();
    // Replié : le détail n'est pas monté.
    expect(queryByText('Détail exercice')).toBeNull();

    // Tap sur l'en-tête (seul élément accessibilityRole="button").
    fireEvent.press(getByRole('button'));
    expect(await findByText('Détail exercice')).toBeTruthy();
  });
});
