/**
 * US ACCUEIL-07 — **l'Aurore appartient à l'accueil, le terracotta au reste** (décision D1).
 *
 * L'identité `home` porte désormais la teinte Aurore. Sans règle, tout écran qui en hérite — les
 * Réglages ouverts depuis l'accueil, l'onboarding avant toute barre d'onglets — serait passé au
 * turquoise, alors que Florian a décidé que « le terracotta ne reste que la couleur de marque
 * (réglages, onboarding) ». Ce test fige la règle de `useTheme` : `home` seulement quand l'onglet
 * Accueil est au premier plan, `brand` sinon ; les écrans de pilier gardent le leur.
 */
import { renderHook } from '@testing-library/react-native';

import { useMenuAccent } from '@/stores/menu-accent-store';
import { useColorSchemeStore } from '@/stores/color-scheme-store';
import { palettes } from '../colors';
import { useTheme } from '../useTheme';

const accentOf = async () => (await renderHook(() => useTheme())).result.current.colors.accent;

beforeEach(() => {
  useColorSchemeStore.setState({ scheme: 'light' });
  useMenuAccent.setState({ enabled: false, activeMenu: 'home', focusedMenu: null });
});

describe('useTheme — identité de l’accueil et de la marque', () => {
  it('l’onglet Accueil au premier plan porte la teinte Aurore', async () => {
    useMenuAccent.setState({ activeMenu: 'home', focusedMenu: 'home' });
    expect(await accentOf()).toBe(palettes.light.pillarHome);
  });

  it('🔴 un écran transverse ouvert depuis l’accueil (Réglages) garde le terracotta de marque', async () => {
    // L'écran empilé hérite de `home` mais l'onglet n'est plus au premier plan.
    useMenuAccent.setState({ activeMenu: 'home', focusedMenu: null });
    expect(await accentOf()).toBe(palettes.light.brand);
  });

  it('🔴 l’onboarding (aucun onglet encore monté) garde le terracotta de marque', async () => {
    expect(await accentOf()).toBe(palettes.light.brand);
  });

  it('un écran de pilier garde son pilier, onglet au premier plan ou non', async () => {
    useMenuAccent.setState({ activeMenu: 'nutrition', focusedMenu: null });
    expect(await accentOf()).toBe(palettes.light.pillarNutrition);
  });

  it('la préférence « Couleurs des menus » ne s’applique pas aux écrans de marque', async () => {
    useMenuAccent.setState({ enabled: true, activeMenu: 'home', focusedMenu: null });
    expect(await accentOf()).toBe(palettes.light.brand);
  });
});
