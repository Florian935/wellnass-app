/**
 * Le toast de l'accueil (`HomeToast`, US ACCUEIL-09) : la confirmation d'un geste noté sur place.
 * Il s'annonce aux lecteurs d'écran, reste 2,6 s, puis se retire de lui-même.
 */
import { act, render, screen } from '@testing-library/react-native';
import { HOME_TOAST_MS, HomeToast } from '../HomeToast';

jest.mock('@/hooks/useAppReducedMotion', () => ({ useAppReducedMotion: jest.fn(() => false) }));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('rien à dire : rien à l’écran', async () => {
  const vue = await render(<HomeToast message={null} onHide={jest.fn()} />);
  expect(vue.toJSON()).toBeNull();
});

it('🔴 s’annonce, puis demande à se retirer après 2,6 s — pas avant', async () => {
  const onHide = jest.fn();
  await render(<HomeToast message="Un verre d'eau de plus, c'est noté." onHide={onHide} />);

  const toast = screen.getByTestId('home-toast');
  expect(toast.props.accessibilityLiveRegion).toBe('polite');
  expect(screen.getByText("Un verre d'eau de plus, c'est noté.")).toBeTruthy();

  await act(async () => {
    jest.advanceTimersByTime(HOME_TOAST_MS - 1);
  });
  expect(onHide).not.toHaveBeenCalled();
  await act(async () => {
    jest.advanceTimersByTime(1);
  });
  expect(onHide).toHaveBeenCalledTimes(1);
});

it('ne capte aucun appui : le « + » reste atteignable dessous', async () => {
  await render(<HomeToast message="ok" onHide={jest.fn()} />);
  expect(screen.getByTestId('home-toast').props.pointerEvents).toBe('none');
});

it('🔴 un nouveau rendu de l’écran ne prolonge pas le toast', async () => {
  const onHide = jest.fn();
  const vue = await render(<HomeToast message="ok" onHide={onHide} />);
  await act(async () => {
    jest.advanceTimersByTime(HOME_TOAST_MS - 100);
  });
  // L'écran re-rend avec une NOUVELLE fonction : le minuteur ne repart pas de zéro.
  await vue.rerender(<HomeToast message="ok" onHide={onHide} />);
  await act(async () => {
    jest.advanceTimersByTime(100);
  });
  expect(onHide).toHaveBeenCalledTimes(1);
});
