/**
 * Barre d'onglets (`app/(tabs)/_layout.tsx`) — ce qu'elle montre selon les réglages.
 *
 * US BIEN-02 a ajouté le seul onglet qui suit un **drapeau** plutôt que la liste des piliers
 * (`wellbeingPillarEnabled`), et la décision D2 du 01/10/2026 a gardé le Labo même à six onglets.
 * Trois règles, toutes invisibles tant qu'on n'a pas le bon compte sous la main :
 *
 *  1. **Bien-être est masqué tant que les réglages ne disent pas « oui »** — donnée de santé : un
 *     chargement lent ne doit pas faire apparaître un onglet que personne n'a activé ;
 *  2. **le Labo reste à six onglets** (D2) ;
 *  3. **les libellés passent à 10 px au-delà de cinq onglets**, pour tenir sur un écran étroit.
 */

import React from 'react';
import { render } from '@testing-library/react-native';

import TabsLayout from '../_layout';
import { useSettings } from '@/data/repositories/settings-repository';

type ScreenProps = { name: string; options: { href?: null; title?: string } };
const mockScreens: ScreenProps[] = [];
let mockScreenOptions: { tabBarLabelStyle?: { fontSize?: number } } = {};

jest.mock('expo-router', () => {
  function Tabs({ children, screenOptions }: { children: React.ReactNode; screenOptions: typeof mockScreenOptions }) {
    mockScreenOptions = screenOptions;
    return <>{children}</>;
  }
  function TabsScreen(props: ScreenProps) {
    mockScreens.push(props);
    return null;
  }
  Tabs.Screen = TabsScreen;
  return { Tabs };
});
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@/components/motion/TabBarIcon', () => ({ TabBarIcon: () => null }));
jest.mock('@/data/repositories/settings-repository', () => ({ useSettings: jest.fn() }));
jest.mock('@/stores/menu-accent-store', () => ({
  useMenuAccent: (select: (s: { focusedMenu: null; enabled: boolean; colors: Record<string, string> }) => unknown) =>
    select({ focusedMenu: null, enabled: false, colors: {} }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light', colors: { textMuted: '#777', surface: '#fff', border: '#ddd' } }) }));

const settings = useSettings as jest.Mock;

/** Les onglets visibles (un `href: null` masque l'onglet sans démonter la route). */
const visibles = () => mockScreens.filter((s) => s.options.href !== null).map((s) => s.name);

async function monter(value: Record<string, unknown> | null) {
  mockScreens.length = 0;
  settings.mockReturnValue({ settings: value });
  await render(<TabsLayout />);
}

describe('onglet Bien-être', () => {
  it('🔴 masqué tant que les réglages ne sont pas chargés — l’absence ne vaut pas consentement', async () => {
    await monter(null);

    expect(visibles()).not.toContain('wellbeing-hub');
  });

  it('masqué pilier éteint, visible pilier allumé', async () => {
    await monter({ activePillars: ['strength', 'running', 'nutrition'], wellbeingPillarEnabled: false });
    expect(visibles()).not.toContain('wellbeing-hub');

    await monter({ activePillars: ['strength', 'running', 'nutrition'], wellbeingPillarEnabled: true });
    expect(visibles()).toContain('wellbeing-hub');
  });

  it('🔴 D2 : les quatre piliers allumés, le Labo garde son onglet — six destinations', async () => {
    await monter({ activePillars: ['strength', 'running', 'nutrition'], wellbeingPillarEnabled: true });

    expect(visibles()).toEqual(['index', 'strength', 'running', 'lab', 'nutrition', 'wellbeing-hub']);
  });

  it('les libellés passent à 10 px au-delà de cinq onglets, et restent à 11 sinon', async () => {
    await monter({ activePillars: ['strength', 'running', 'nutrition'], wellbeingPillarEnabled: true });
    expect(mockScreenOptions.tabBarLabelStyle?.fontSize).toBe(10);

    await monter({ activePillars: ['strength', 'running', 'nutrition'], wellbeingPillarEnabled: false });
    expect(mockScreenOptions.tabBarLabelStyle?.fontSize).toBe(11);
  });

  it('Bien-être seul (aucun des trois piliers) : Accueil et Bien-être, pas de Labo à vide', async () => {
    await monter({ activePillars: [], wellbeingPillarEnabled: true });

    expect(visibles()).toEqual(['index', 'wellbeing-hub']);
  });
});
