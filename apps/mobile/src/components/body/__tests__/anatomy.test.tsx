import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AnatomyFigure } from '../AnatomyFigure';
import { PainBodyMap } from '../PainBodyMap';
import { useTheme } from '@/theme/useTheme';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({ scheme: 'light', colors: require('@/theme/colors').palettes.light })),
}));
// Only the native drawing surface is replaced; mapping, fills and callbacks are real.
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View, Path: View, G: View, Circle: View,
    Defs: View, LinearGradient: View, RadialGradient: View, Stop: View };
});

it('selects biceps from either arm and never exposes posterior groups on the front', async () => {
  const onSelect = jest.fn();
  const screen = await render(<AnatomyFigure side="front" onSelect={onSelect} />);
  for (const arm of screen.getAllByTestId('muscle-biceps')) {
    await fireEvent.press(arm);
    expect(onSelect).toHaveBeenLastCalledWith('biceps');
  }
  expect(screen.queryAllByTestId('muscle-triceps')).toHaveLength(0);
  await screen.rerender(<AnatomyFigure side="back" onSelect={onSelect} />);
  await fireEvent.press(screen.getAllByTestId('muscle-triceps')[0]!);
  expect(onSelect).toHaveBeenLastCalledWith('triceps');
  expect(screen.queryAllByTestId('muscle-biceps')).toHaveLength(0);
});

it.each([
  ['front', ['chest', 'shoulders', 'biceps', 'abs', 'quadriceps']],
  ['back', ['back', 'shoulders', 'triceps', 'glutes', 'hamstrings', 'calves']],
] as const)('exposes every expected muscle on %s with its semantic callback', async (side, muscles) => {
  const onSelect = jest.fn();
  const screen = await render(<AnatomyFigure side={side} onSelect={onSelect} />);
  for (const muscle of muscles) {
    for (const region of screen.getAllByTestId(`muscle-${muscle}`)) {
      await fireEvent.press(region);
      expect(onSelect).toHaveBeenLastCalledWith(muscle);
    }
  }
});

it('uses the active theme for selection outline', async () => {
  const screen = await render(<AnatomyFigure side="front" selected="biceps" />);
  expect(screen.getAllByTestId('muscle-biceps')[0]!.props.stroke).toBe('#33291f');
  jest.mocked(useTheme).mockReturnValue({ scheme: 'dark', colors: require('@/theme/colors').palettes.dark });
  await screen.rerender(<AnatomyFigure side="front" selected="biceps" />);
  expect(screen.getAllByTestId('muscle-biceps')[0]!.props.stroke).toBe('#f4ecdd');
  jest.mocked(useTheme).mockReturnValue({ scheme: 'light', colors: require('@/theme/colors').palettes.light });
});

it('distinguishes full and reduced and prioritizes full', async () => {
  const screen = await render(<AnatomyFigure side="front" full={['biceps']} reduced={['biceps', 'chest']} />);
  const biceps = screen.getAllByTestId('muscle-biceps')[0]!;
  const chest = screen.getAllByTestId('muscle-chest')[0]!;
  expect(biceps.props.fill).not.toBe(chest.props.fill);
  const fullFill = biceps.props.fill;
  const reducedFill = chest.props.fill;
  await screen.rerender(<AnatomyFigure side="front" full={['biceps']} />);
  expect(screen.getAllByTestId('muscle-biceps')[0]!.props.fill).toBe(fullFill);
  expect(screen.getAllByTestId('muscle-chest')[0]!.props.fill).not.toBe(reducedFill);
});

it('highlights a selected muscle even without training context and adds an outline', async () => {
  const screen = await render(<AnatomyFigure side="front" />);
  const neutral = screen.getAllByTestId('muscle-biceps')[0]!.props.fill;
  const outline = screen.getAllByTestId('muscle-biceps')[0]!.props.strokeWidth;
  await screen.rerender(<AnatomyFigure side="front" selected="biceps" />);
  expect(screen.getAllByTestId('muscle-biceps')[0]!.props.fill).not.toBe(neutral);
  expect(screen.getAllByTestId('muscle-biceps')[0]!.props.strokeWidth).toBeGreaterThan(outline);
});

it.each([
  { label: 'reduced', full: ['biceps'], reduced: ['chest'], selected: 'chest' },
  { label: 'neutral', full: ['biceps'], reduced: ['chest'], selected: 'quadriceps' },
  { label: 'neutral with reduced-only context', full: [], reduced: ['biceps'], selected: 'chest' },
] as const)('preserves $label fill when selecting within training context', async ({ full, reduced, selected }) => {
  const screen = await render(<AnatomyFigure side="front" full={[...full]} reduced={[...reduced]} />);
  const before = screen.getAllByTestId(`muscle-${selected}`)[0]!;
  const contextFill = before.props.fill;
  const outline = before.props.strokeWidth;
  await screen.rerender(<AnatomyFigure side="front" full={[...full]} reduced={[...reduced]} selected={selected} />);
  expect(screen.getAllByTestId(`muscle-${selected}`)[0]!.props.fill).toBe(contextFill);
  expect(screen.getAllByTestId(`muscle-${selected}`)[0]!.props.strokeWidth).toBeGreaterThan(outline);
});

it('preserves explicit pain colors and symmetric joint selection', async () => {
  const onSelect = jest.fn();
  const screen = await render(<PainBodyMap levels={{ biceps: 'blocking', knee: 'pain' }} selected="knee" onSelect={onSelect} />);
  expect(screen.getAllByTestId('muscle-biceps')[0]!.props.fill).toBe('#b23b2e');
  const knees = screen.getAllByTestId('joint-knee');
  expect(knees).toHaveLength(4);
  for (const knee of knees) {
    await fireEvent.press(knee);
    expect(onSelect).toHaveBeenLastCalledWith('knee');
    expect(knee.props.fill).toBe('#b14f2b');
  }
  await screen.rerender(<PainBodyMap levels={{}} selected="biceps" onSelect={onSelect} />);
  expect(screen.getAllByTestId('muscle-biceps')[0]!.props.fill).toBe('#f3ddd0');
});
