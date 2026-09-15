import React from 'react';
import { render } from '@testing-library/react-native';
import { BodyMap } from '../BodyMap';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({ scheme: 'light', colors: require('@/theme/colors').palettes.light })),
}));
// Seule la surface native est remplacée : BodyMap et AnatomyFigure restent réels.
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    Circle: View,
    Defs: View,
    Ellipse: View,
    G: View,
    LinearGradient: View,
    Path: View,
    RadialGradient: View,
    Rect: View,
    Stop: View,
  };
});

it('renders the compact CORPS anatomy for both BodyMap views', async () => {
  const screen = await render(<BodyMap full={['biceps']} reduced={['chest']} />);

  expect(screen.getAllByTestId('muscle-biceps')).toHaveLength(2);
  expect(screen.getAllByTestId('muscle-chest')).toHaveLength(2);
  expect(screen.getByText('bodyMap.front')).toBeTruthy();
  expect(screen.getByText('bodyMap.back')).toBeTruthy();
});

it('keeps heat, pulse and imposed colors on the anatomical paths', async () => {
  const screen = await render(
    <BodyMap
      full={[]}
      reduced={[]}
      heat={{ biceps: 0.8 }}
      heatColor={(value) => (value === 0.8 ? '#ff5500' : '#000000')}
      colors={{ neutral: '#101010', accent: '#ff5500', caption: '#eeeeee' }}
      pulse="biceps"
    />,
  );

  for (const biceps of screen.getAllByTestId('muscle-biceps')) {
    expect(biceps.props.fill).toBe('#ff5500');
  }
  expect(screen.getAllByTestId('muscle-biceps-pulse')).toHaveLength(2);
  expect(screen.getAllByTestId('muscle-chest')[0]!.props.fill).toBe('#101010');
  expect(screen.getByText('bodyMap.front')).toHaveStyle({ color: '#eeeeee' });
});
