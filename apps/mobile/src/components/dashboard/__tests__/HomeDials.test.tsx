/**
 * Les trois cadrans du ciel (`HomeDials`, US ACCUEIL-08, décision D2) : Bouger · Manger · Récupérer.
 *
 * QUELS cadrans s'affichent (un par pilier actif, Marcher pour la nutrition seule, Récupérer quand
 * la charge existe) est décidé et testé dans `buildDayDials` (`home-sections.test.ts`). Ici, le
 * rendu : chaque cadran dit son chiffre, son unité, sa ligne d'appoint, et se nomme en entier pour
 * un lecteur d'écran — l'anneau, lui, n'a pas de texte.
 */
import '@/i18n';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { DayDial } from '@wellness/shared';
import { HomeDials } from '../HomeDials';

jest.mock('@/hooks/useAppReducedMotion', () => ({ useAppReducedMotion: jest.fn(() => false) }));
jest.mock('@/lib/haptics', () => ({ hapticConfirm: jest.fn(), hapticSelect: jest.fn(), hapticMilestone: jest.fn() }));

const fmt = (n: number) => n.toLocaleString('fr-FR').replace(/ /g, ' ');

const move: DayDial = {
  key: 'move',
  done: 2,
  total: 4,
  restToday: false,
  segments: ['strength', 'running', 'strength-soft', 'idle'],
};
const eat = (over: Partial<Extract<DayDial, { key: 'eat' }>> = {}): DayDial => ({
  key: 'eat',
  consumed: 1100,
  target: 2300,
  remaining: 1200,
  progress: 0.48,
  proteinG: 62,
  proteinTarget: 140,
  ...over,
});
const recover = (over: Partial<Extract<DayDial, { key: 'recover' }>> = {}): DayDial => ({
  key: 'recover',
  pending: false,
  verdict: 'push',
  segments: ['positive', 'neutral', 'positive'],
  ...over,
});

const show = (dials: DayDial[], onPress = jest.fn()) =>
  render(<HomeDials dials={dials} onPress={onPress} formatNumber={fmt} />);

it('sans cadran (aucun pilier actif), rien — pas une boîte vide', async () => {
  const vue = await show([]);
  expect(vue.toJSON()).toBeNull();
});

describe('Bouger', () => {
  it('« 2/4 séances · cette semaine », et le compte entier pour un lecteur d’écran', async () => {
    await show([move]);
    expect(screen.getByText('2/4')).toBeTruthy();
    expect(screen.getByText('séances')).toBeTruthy();
    expect(screen.getByText('cette semaine')).toBeTruthy();
    expect(screen.getByLabelText('Bouger : 2 séances faites sur 4 cette semaine')).toBeTruthy();
  });

  it('un jour de repos le dit sous le cadran', async () => {
    await show([{ ...move, restToday: true } as DayDial]);
    expect(screen.getByText("repos aujourd'hui")).toBeTruthy();
  });
});

describe('Manger', () => {
  it('les kcal RESTANTES, et les protéines sur leur cible', async () => {
    await show([eat()]);
    expect(screen.getByText('1 200')).toBeTruthy();
    expect(screen.getByText('kcal restantes')).toBeTruthy();
    expect(screen.getByText('protéines 62/140 g')).toBeTruthy();
  });

  it('🔴 une cible dépassée se dit « +n kcal au-delà », jamais un reste négatif', async () => {
    await show([eat({ remaining: -150, progress: 1 })]);
    expect(screen.getByText('+150')).toBeTruthy();
    expect(screen.getByText('kcal au-delà')).toBeTruthy();
    expect(screen.queryByText(/-150/)).toBeNull();
  });

  it('sans cible : ce qui est noté, sans reste inventé', async () => {
    await show([eat({ target: null, remaining: null, proteinTarget: null, progress: 0 })]);
    expect(screen.getByText('1 100')).toBeTruthy();
    expect(screen.getByText('kcal notées')).toBeTruthy();
    expect(screen.getByText('pas de cible')).toBeTruthy();
  });
});

describe('Récupérer', () => {
  it('le verdict en un mot', async () => {
    await show([recover()]);
    expect(screen.getByText('Pousse')).toBeTruthy();
    expect(screen.getByLabelText('Récupérer : Prêt à pousser')).toBeTruthy();
  });

  it('🔴 check-in pas fait : « ? » et le renvoi vers le geste, pas un verdict deviné', async () => {
    await show([recover({ pending: true, verdict: null })]);
    expect(screen.getByText('?')).toBeTruthy();
    expect(screen.getByText('check-in à faire')).toBeTruthy();
    expect(screen.getByLabelText('Récupérer : check-in du matin à faire')).toBeTruthy();
  });
});

describe('Marcher (nutrition seule)', () => {
  it('les pas du jour sur l’objectif', async () => {
    await show([{ key: 'walk', steps: 4200, goal: 8000, progress: 0.525 }]);
    expect(screen.getByText('4 200')).toBeTruthy();
    expect(screen.getByText('objectif 8 000')).toBeTruthy();
  });
});

it('chaque cadran s’ouvre sur son détail', async () => {
  const onPress = jest.fn();
  await show([move, eat(), recover()], onPress);
  await fireEvent.press(screen.getByTestId('home-dial-eat'));
  expect(onPress).toHaveBeenCalledWith('eat');
  await fireEvent.press(screen.getByTestId('home-dial-recover'));
  expect(onPress).toHaveBeenLastCalledWith('recover');
});
