import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BodyExplorerLink } from '../BodyExplorerLink';
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ colors: require('@/theme/colors').palettes.light }) }));

it('ouvre une exploration contextualisée sans transformer une association réduite en muscle principal', async () => {
  await act(async () => { render(<BodyExplorerLink full={['biceps']} reduced={['shoulders']} context="exercise" />); });
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'bodyExplorer.explore' })); });
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/body', params: { full: 'biceps', reduced: 'shoulders', muscle: 'biceps', context: 'exercise' } });
});
