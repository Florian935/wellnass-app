/**
 * US ACTIV-01 — parcours « 7 jours pour démarrer » (`components/dashboard/ActivationPathCard`).
 *
 * Fichier à **0 %** avant ce test. Widget **conditionnel temporel** : il n'existe que pendant les
 * sept jours qui suivent l'onboarding, et disparaît sur fermeture explicite. Ce qui est vérifié :
 *
 *  1. **La table de routage `ctaRoute`** — quatorze cas (trois piliers × jours pilier, plus les
 *     replis 3/4/6, plus les jours informationnels 2/5/7). C'est de la donnée déguisée en code :
 *     une ligne fausse envoie l'utilisateur sur l'onglet d'un pilier qu'il n'a pas activé, ce qui
 *     ne lève aucune erreur et se lit comme un bug de navigation.
 *  2. **Un jour informationnel n'affiche AUCUN bouton d'action** — et, dans la forme petite, la
 *     carte entière cesse d'être tappable. Une carte qui répond au toucher sans rien faire est
 *     pire qu'une carte inerte : l'utilisateur réessaie.
 *  3. **La fermeture est explicite et persistée** (`dismissActivationPath`), pas un simple état
 *     local : refermer le widget à chaque ouverture de l'accueil serait le même défaut que ne pas
 *     pouvoir le fermer.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ActivationDayTheme } from '@wellness/shared';

import { ActivationPathCard } from '../ActivationPathCard';
import { useActivationPath } from '@/data/repositories/activation-path-repository';
import { dismissActivationPath } from '@/data/repositories/profile-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/activation-path-repository', () => ({
  useActivationPath: jest.fn(),
}));
jest.mock('@/data/repositories/profile-repository', () => ({
  dismissActivationPath: jest.fn(),
}));

jest.mock('@/components/widgets/WidgetFrame', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    WidgetFrame: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) =>
      onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel="cadre" onPress={onPress}>
          {children}
        </Pressable>
      ) : (
        <View accessibilityLabel="cadre-inerte">{children}</View>
      ),
    Eyebrow: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      accent: '#c0562f',
      accentText: '#ffffff',
      success: '#7c8a5b',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockPath = useActivationPath as jest.Mock;
const mockDismiss = dismissActivationPath as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();

const TAILLES = ['small', 'wide', 'large'] as const;

const pilier = (p: 'strength' | 'running' | 'nutrition'): ActivationDayTheme => ({
  kind: 'pillar',
  rank: 1,
  pillar: p,
});
const universel = (day: number): ActivationDayTheme => ({ kind: 'universal', day });

const afficher = async (
  size: (typeof TAILLES)[number] = 'wide',
  overrides: Partial<{
    show: boolean;
    day: number | null;
    theme: ActivationDayTheme | null;
    completed: boolean;
  }> = {},
) => {
  mockPath.mockReturnValue({
    show: true,
    day: 1,
    theme: pilier('strength'),
    completed: false,
    ...overrides,
  });
  await render(<ActivationPathCard size={size} />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push });
  mockDismiss.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Fenêtre d'affichage
// ---------------------------------------------------------------------------

describe('fenêtre d’affichage', () => {
  it.each([
    ['fermé par l’utilisateur', { show: false, day: null, theme: null }],
    ['hors des 7 jours', { show: true, day: null, theme: null }],
    ['thème indisponible', { show: true, day: 1, theme: null }],
  ])('ne rend RIEN : %s', async (_cas, overrides) => {
    await afficher('wide', overrides);

    expect(screen.toJSON()).toBeNull();
  });

  it.each(TAILLES)('affiche jour et titre dans la forme %s', async (size) => {
    await afficher(size, { day: 4, theme: universel(4) });

    expect(screen.getByText('activationPath.progress:{"day":4,"total":7}')).toBeTruthy();
    expect(screen.getByText('activationPath.day4.title')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Routage de l'action principale
// ---------------------------------------------------------------------------

describe('cible de l’action principale', () => {
  it.each([
    ['strength', '/(tabs)/strength'],
    ['running', '/(tabs)/running'],
    ['nutrition', '/(tabs)/nutrition'],
  ] as const)('un jour pilier %s mène à son onglet', async (p, route) => {
    await afficher('wide', { day: 1, theme: pilier(p) });

    await taper(screen.getByText('activationPath.day1.cta'));
    expect(push).toHaveBeenCalledWith(route);
  });

  it.each([
    [3, '/goals'],
    [4, '/wellbeing'],
    [6, '/history'],
  ])('le repli universel du jour %i mène à %s', async (day, route) => {
    await afficher('wide', { day, theme: universel(day) });

    // Ces trois jours n'ont pas de pilier attitré mais gardent une cible naturelle : les laisser
    // sans bouton priverait le parcours de son action la moitié de la semaine.
    await taper(screen.getByText(`activationPath.day${day}.cta`));
    expect(push).toHaveBeenCalledWith(route);
  });

  it.each([2, 5, 7])('🔴 le jour informationnel %i n’a AUCUN bouton d’action', async (day) => {
    await afficher('wide', { day, theme: universel(day) });

    // Aucune cible unique n'est naturelle ces jours-là. Un bouton qui pointerait « quelque part »
    // serait un choix arbitraire déguisé en recommandation.
    expect(screen.queryByText(`activationPath.day${day}.cta`)).toBeNull();
    expect(screen.getByText(`activationPath.day${day}.title`)).toBeTruthy();
  });

  it('🔴 sans cible, le petit carré n’est même pas tappable', async () => {
    await afficher('small', { day: 5, theme: universel(5) });

    // Une carte qui répond au toucher sans rien faire est pire qu'une carte inerte : l'utilisateur
    // réessaie, puis conclut que l'app est cassée.
    expect(screen.getByLabelText('cadre-inerte')).toBeTruthy();
    expect(screen.queryByLabelText('cadre')).toBeNull();
  });

  it('avec une cible, le petit carré mène à l’onglet du jour', async () => {
    await afficher('small', { day: 1, theme: pilier('running') });

    await taper(screen.getByLabelText('cadre'));
    expect(push).toHaveBeenCalledWith('/(tabs)/running');
  });
});

// ---------------------------------------------------------------------------
// Badge « fait »
// ---------------------------------------------------------------------------

describe('badge « fait »', () => {
  it.each(['wide', 'large'] as const)('%s affiche le badge quand le jour est accompli', async (size) => {
    await afficher(size, { completed: true });

    expect(screen.getByText('activationPath.doneBadge')).toBeTruthy();
  });

  it.each(['wide', 'large'] as const)('%s ne l’affiche pas sinon', async (size) => {
    await afficher(size, { completed: false });

    expect(screen.queryByText('activationPath.doneBadge')).toBeNull();
  });

  it('🔴 le badge accompli n’enlève PAS l’action du jour', async () => {
    await afficher('wide', { day: 1, theme: pilier('strength'), completed: true });

    // Le parcours suggère, il ne verrouille pas : avoir fait sa séance ne doit pas retirer le
    // raccourci vers l'onglet, qui reste le bon endroit où aller.
    expect(screen.getByText('activationPath.day1.cta')).toBeTruthy();
  });

  it('le petit carré n’affiche pas le badge — il n’a la place que pour le titre', async () => {
    await afficher('small', { completed: true });

    expect(screen.queryByText('activationPath.doneBadge')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Fermeture
// ---------------------------------------------------------------------------

describe('fermeture', () => {
  it.each(['wide', 'large'] as const)('%s propose de passer le parcours', async (size) => {
    await afficher(size);

    await taper(screen.getByText('activationPath.dismiss'));

    // Fermeture **persistée** (`dismissActivationPath` écrit sur le profil) : un simple état local
    // ferait revenir le widget au remontage suivant de l'accueil, soit à chaque navigation.
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  it('🔴 le petit carré n’a pas de « passer » — il n’en a pas la place', async () => {
    await afficher('small');

    // Le lien de fermeture y aurait une zone tactile sous le seuil : mieux vaut l'absence qu'une
    // cible qu'on rate une fois sur deux.
    expect(screen.queryByText('activationPath.dismiss')).toBeNull();
  });

  it('🔴 un échec d’écriture ne casse pas le rendu', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockDismiss.mockRejectedValue(new Error('hors ligne'));
    await afficher('wide');

    await taper(screen.getByText('activationPath.dismiss'));

    // Le rejet est capturé et tracé : sans `catch`, React Native remonte une rejection non
    // capturée en avertissement global, pour une écriture locale qui repartira d'elle-même.
    expect(screen.getByText('activationPath.day1.title')).toBeTruthy();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
