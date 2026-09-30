/**
 * US ECHO-01 — l'écho d'un lien dans un pilier.
 *
 * La règle tient en trois cas, et chacun a son piège :
 *  1. **un lien qui demande quelque chose** (garde-fou, à régler) fait un écho, qui ouvre SA fiche ;
 *  2. **un écran d'où des cartes ont déménagé** (Stats nutrition) dit où elles sont parties quand
 *     aucun lien ne demande rien — sinon leur disparition se lirait comme une perte ;
 *  3. **sinon, rien** : un lien qui tient ne fait pas d'écho, la page reste celle du pilier.
 *
 * Le choix du lien (le plus pressant, pour cette surface) est la règle `echoFor`, testée sous Vitest
 * dans `cross-links.test.ts` ; ici, on vérifie ce que l'écran en fait.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { CrossLink, CrossLinkState } from '@wellness/shared';

import { CrossLinkEcho } from '../CrossLinkEcho';
import { useCrossLinkEcho, useCrossLinks } from '@/data/repositories/cross-links-repository';
import { useRouter } from 'expo-router';

jest.mock('@/data/repositories/cross-links-repository', () => ({
  useCrossLinkEcho: jest.fn(),
  useCrossLinks: jest.fn(),
}));
jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('@/lib/haptics', () => ({ hapticSelect: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const Stub = ({ children }: { children?: React.ReactNode }) => <View>{children}</View>;
  return { __esModule: true, default: Stub, Circle: Stub };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      background: '#fffaf2',
      surface: '#fffaf2',
      surfaceAlt: '#f5ecdd',
      border: '#ece0cd',
      amber: '#d99a2b',
      warnText: '#8a5a12',
      warnBorder: '#e6c98f',
      danger: '#b23b2e',
      pillarStrength: '#8a3d2a',
      pillarRunning: '#2f6b6b',
      pillarNutrition: '#6b7a2f',
      pillarLab: '#7a5714',
    },
  }),
}));

const mockEcho = useCrossLinkEcho as jest.Mock;
const mockLinks = useCrossLinks as jest.Mock;
const push = jest.fn();

const lien = (id: CrossLink['id'], state: CrossLinkState): CrossLink => ({
  id,
  zone: 'mn',
  lens: ['nutrition', 'strength'],
  state,
  verdict: { key: 'v', values: {} },
  short: { key: 'low', values: { gPerKg: 1.3 } },
  figures: [],
  rows: [],
  actions: [],
  missing: null,
  chart: null,
  source: { key: 'src', values: {} },
  echoes: ['strengthProgress', 'nutritionStats'],
});

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({ push });
  mockLinks.mockReturnValue({ links: [], isLoading: false });
});

describe('CrossLinkEcho', () => {
  it('un lien à régler fait un écho, qui dit la paire, l’état et la phrase courte', async () => {
    mockEcho.mockReturnValue(lien('fuelStrength', 'adjust'));

    await render(<CrossLinkEcho surface="strengthProgress" />);

    expect(screen.getByTestId('lab-echo-strengthProgress')).toBeTruthy();
    expect(screen.getByText('lab.links.states.adjust')).toBeTruthy();
    // La valeur passe par la mise en forme (1,3 et pas 1.3) : la même phrase qu'au Labo.
    expect(screen.getByText('lab.links.fuelStrength.short.low:{"gPerKg":"1,3"}')).toBeTruthy();
  });

  it('toucher l’écho ouvre la fiche DU lien, pas le Labo en général', async () => {
    mockEcho.mockReturnValue(lien('fuelStrength', 'guard'));

    await render(<CrossLinkEcho surface="strengthProgress" />);
    fireEvent.press(screen.getByTestId('lab-echo-strengthProgress'));

    expect(push).toHaveBeenCalledWith('/lab-link?id=fuelStrength');
  });

  it('🔴 sans lien pressant, un écran ordinaire ne montre RIEN', async () => {
    mockEcho.mockReturnValue(null);
    mockLinks.mockReturnValue({ links: [lien('fuelStrength', 'holds')], isLoading: false });

    await render(<CrossLinkEcho surface="strengthProgress" />);

    // Un lien qui tient n'a rien à demander au pilier : l'afficher ferait du bruit dans chaque hub.
    expect(screen.queryByTestId('lab-echo-strengthProgress')).toBeNull();
    expect(screen.queryByTestId('lab-echo-strengthProgress-moved')).toBeNull();
  });

  it('🔴 un écran d’où des cartes ont déménagé dit où elles sont parties', async () => {
    mockEcho.mockReturnValue(null);
    mockLinks.mockReturnValue({ links: [lien('fuelStrength', 'holds')], isLoading: false });

    await render(<CrossLinkEcho surface="nutritionStats" moved="fuelStrength" />);

    // Les cartes APPORT-01 / MN-03 ont quitté Stats nutrition pour le Labo (Q3) : sans cette ligne,
    // l'utilisateur qui les cherchait croirait l'analyse supprimée.
    expect(screen.getByTestId('lab-echo-nutritionStats-moved')).toBeTruthy();
    fireEvent.press(screen.getByTestId('lab-echo-nutritionStats-moved'));
    expect(push).toHaveBeenCalledWith('/lab-link?id=fuelStrength');
  });

  it('un lien absent (pilier désactivé) : pas de ligne « déménagé » vers une fiche vide', async () => {
    mockEcho.mockReturnValue(null);
    mockLinks.mockReturnValue({ links: [], isLoading: false });

    await render(<CrossLinkEcho surface="nutritionStats" moved="fuelStrength" />);

    expect(screen.queryByTestId('lab-echo-nutritionStats-moved')).toBeNull();
  });
});
