/**
 * US VIE-01 — widget « mode vie réelle » (`components/dashboard/RealLifeCard`).
 *
 * Fichier à **0 %** avant ce test. Widget singulier à deux titres :
 *
 *  1. **Deux états dans un seul identifiant.** Hors période, il n'est qu'une ligne discrète ;
 *     en période, une carte à deux actions. Séparer les deux en deux widgets aurait défait
 *     INSIGHTS-02, qui venait de ramener l'accueil de 21 à 7 entrées — d'où le test : la ligne
 *     d'entrée ne doit **jamais** afficher d'échéance ni d'actions, et réciproquement.
 *  2. **Le ton est une règle testée (R9).** Aucun « seulement », « manqué », « raté », aucun
 *     compteur d'écart négatif. C'est ce qui distingue une pause assumée d'un aveu d'échec, et
 *     rien dans le typage ne l'empêche de revenir : un test le tient.
 *
 * Vérifié aussi : **prolonger repart de la fin COURANTE** — deux prolongations ajoutent 14 jours,
 * pas 7. Recalculer depuis aujourd'hui ferait perdre les jours restants à chaque appui, un défaut
 * silencieux qui ne se voit qu'en comparant deux dates.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { RealLifeCard } from '../RealLifeCard';
import { useMinimalWeekTargets } from '@/data/repositories/dashboard-repository';
import {
  extendRealLifePeriod,
  stopRealLifePeriod,
  useRealLifeState,
} from '@/data/repositories/real-life-repository';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/dashboard-repository', () => ({
  useMinimalWeekTargets: jest.fn(() => ({ strengthSessions: null, runs: null, proteinG: null })),
}));
jest.mock('@/data/repositories/real-life-repository', () => ({
  useRealLifeState: jest.fn(),
  extendRealLifePeriod: jest.fn(),
  stopRealLifePeriod: jest.fn(),
}));

/** La feuille de déclaration a ses propres tests : sonde ici, pour prouver l'ouverture. */
jest.mock('@/components/real-life/RealLifeSheet', () => {
  const { Text } = require('react-native');
  return {
    RealLifeSheet: ({ visible }: { visible: boolean }) =>
      visible ? <Text>feuille-ouverte</Text> : null,
  };
});

jest.mock('@/components/widgets/WidgetFrame', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    WidgetFrame: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) =>
      onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel="cadre" onPress={onPress}>
          {children}
        </Pressable>
      ) : (
        <View>{children}</View>
      ),
    Eyebrow: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});

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
      border: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockState = useRealLifeState as jest.Mock;
const mockTargets = useMinimalWeekTargets as jest.Mock;
const mockExtend = extendRealLifePeriod as jest.Mock;
const mockStop = stopRealLifePeriod as jest.Mock;

const TAILLES = ['small', 'wide', 'large'] as const;

const periode = (overrides: Record<string, unknown> = {}) => ({
  id: 'rl-1',
  startsOn: '2026-08-05',
  endsOn: '2026-08-20',
  ...overrides,
});

const horsPeriode = async (size: (typeof TAILLES)[number] = 'wide') => {
  mockState.mockReturnValue({ activePeriod: null, daysRemaining: null });
  await render(<RealLifeCard size={size} />);
};

const enPeriode = async (
  size: (typeof TAILLES)[number] = 'wide',
  overrides: Record<string, unknown> = {},
  jours: number | null = 9,
) => {
  mockState.mockReturnValue({ activePeriod: periode(overrides), daysRemaining: jours });
  await render(<RealLifeCard size={size} />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

/** Tout l'arbre rendu sérialisé, pour les assertions de ton (R9). */
const texteRendu = () => JSON.stringify(screen.toJSON());

beforeEach(() => {
  jest.clearAllMocks();
  mockTargets.mockReturnValue({ strengthSessions: null, runs: null, proteinG: null });
  mockExtend.mockResolvedValue(undefined);
  mockStop.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Hors période
// ---------------------------------------------------------------------------

describe('hors période', () => {
  it.each(TAILLES)('n’est qu’une ligne d’entrée, sans action (%s)', async (size) => {
    await horsPeriode(size);

    expect(screen.getByLabelText('realLife.cta')).toBeTruthy();
    // Les deux actions n'ont de sens que sur une période en cours : les afficher hors période
    // donnerait « Prolonger » quoi, et « Reprendre » depuis où.
    expect(screen.queryByLabelText('realLife.extend')).toBeNull();
    expect(screen.queryByLabelText('realLife.stop')).toBeNull();
    expect(screen.queryByText(/realLife\.activeUntil/)).toBeNull();
  });

  it('un appui ouvre la feuille de déclaration', async () => {
    await horsPeriode();

    expect(screen.queryByText('feuille-ouverte')).toBeNull();
    await taper(screen.getByLabelText('cadre'));
    expect(screen.getByText('feuille-ouverte')).toBeTruthy();
  });

  it('🔴 la ligne ne réclame rien : aucun terme de reproche (R9)', async () => {
    await horsPeriode();

    expect(texteRendu()).not.toMatch(/seulement|manqué|raté|retard|-\d/i);
  });
});

// ---------------------------------------------------------------------------
// En période
// ---------------------------------------------------------------------------

describe('en période', () => {
  it('annonce l’échéance et les jours restants', async () => {
    await enPeriode('wide', {}, 9);

    expect(screen.getByText(/realLife\.activeUntil/)).toBeTruthy();
    expect(screen.getByText('realLife.remaining:{"count":9}')).toBeTruthy();
  });

  it('🔴 le dernier jour a sa propre formulation, pas « 0 jour restant »', async () => {
    await enPeriode('wide', {}, 0);

    // « 0 » se lit comme une fin déjà consommée ; l'utilisateur est encore en pause aujourd'hui.
    expect(screen.getByText('realLife.lastDay')).toBeTruthy();
    expect(screen.queryByText(/"count":0/)).toBeNull();
  });

  it('le petit carré garde l’essentiel et RETIRE les actions', async () => {
    await enPeriode('small');

    expect(screen.getByText('realLife.remaining:{"count":9}')).toBeTruthy();
    // 44 px de zone tactile pour deux boutons ne tiennent pas dans une tuile : les y forcer
    // produirait des cibles trop petites, ce que l'audit d'accessibilité proscrit.
    expect(screen.queryByLabelText('realLife.extend')).toBeNull();
    expect(screen.queryByLabelText('realLife.stop')).toBeNull();
  });

  it.each(['wide', 'large'] as const)('%s porte les deux actions', async (size) => {
    await enPeriode(size);

    expect(screen.getByLabelText('realLife.extend')).toBeTruthy();
    expect(screen.getByLabelText('realLife.stop')).toBeTruthy();
  });

  it('🔴 ne reproche rien : aucun compteur d’écart négatif ni terme d’échec (R9)', async () => {
    mockTargets.mockReturnValue({ strengthSessions: 2, runs: 1, proteinG: 90.4 });
    await enPeriode('large');

    expect(texteRendu()).not.toMatch(/seulement|manqué|raté|retard/i);
  });
});

// ---------------------------------------------------------------------------
// Objectifs minimaux de la semaine
// ---------------------------------------------------------------------------

describe('objectifs minimaux', () => {
  it('n’affiche que les piliers qui ont une cible', async () => {
    mockTargets.mockReturnValue({ strengthSessions: 2, runs: null, proteinG: null });
    await enPeriode('wide');

    expect(screen.getByText('realLife.targets.strength:{"count":2}')).toBeTruthy();
    expect(screen.queryByText('realLife.targets.running')).toBeNull();
    expect(screen.queryByText(/realLife\.targets\.nutrition/)).toBeNull();
  });

  it('🔴 les protéines sont ARRONDIES au gramme', async () => {
    mockTargets.mockReturnValue({ strengthSessions: null, runs: null, proteinG: 90.4 });
    await enPeriode('wide');

    // « 90,4 g de protéines » sur un objectif minimal de pause suggère une précision qui n'existe
    // pas — la cible est une estimation, pas une pesée.
    expect(screen.getByText('realLife.targets.nutrition:{"grams":90}')).toBeTruthy();
  });

  it('sans aucune cible, le bloc entier disparaît au lieu d’un titre vide', async () => {
    await enPeriode('wide');

    expect(screen.queryByText('realLife.targets.label')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Prolonger / arrêter
// ---------------------------------------------------------------------------

describe('actions', () => {
  it('🔴 prolonger repart de la fin COURANTE, +7 jours', async () => {
    await enPeriode('wide', { endsOn: '2026-08-20' });

    await taper(screen.getByLabelText('realLife.extend'));

    // Recalculer depuis aujourd'hui ferait perdre les jours restants à chaque prolongation :
    // deux appuis donneraient 7 jours au total au lieu de 14.
    expect(mockExtend).toHaveBeenCalledWith('rl-1', '2026-08-27');
  });

  it('🔴 prolonger franchit correctement une fin de mois', async () => {
    await enPeriode('wide', { endsOn: '2026-08-29' });

    await taper(screen.getByLabelText('realLife.extend'));

    // `setDate(+7)` sur un 29 août doit donner le 5 septembre, pas un « 36 août ».
    expect(mockExtend).toHaveBeenCalledWith('rl-1', '2026-09-05');
  });

  it('reprendre le plan normal arrête la période en cours', async () => {
    await enPeriode('wide');

    await taper(screen.getByLabelText('realLife.stop'));

    expect(mockStop).toHaveBeenCalledWith('rl-1');
  });

  it('🔴 pendant l’écriture, les DEUX actions sont désactivées', async () => {
    let resoudre: (() => void) | undefined;
    mockExtend.mockReturnValue(new Promise<void>((r) => (resoudre = r)));
    await enPeriode('wide');

    await taper(screen.getByLabelText('realLife.extend'));

    // Prolonger puis arrêter pendant que la première écriture est en vol laisserait une période
    // à la fois prolongée et close, selon l'ordre d'arrivée des deux réponses.
    expect(screen.getByLabelText('realLife.extend').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.getByLabelText('realLife.stop').props.accessibilityState).toMatchObject({
      disabled: true,
    });

    await act(async () => {
      resoudre?.();
    });
    expect(screen.getByLabelText('realLife.extend').props.accessibilityState).toMatchObject({
      disabled: false,
    });
  });

  it('🔴 un échec d’écriture REND la main', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockExtend.mockRejectedValue(new Error('hors ligne'));
    await enPeriode('wide');

    await taper(screen.getByLabelText('realLife.extend'));

    // `finally` et non `then` : rester bloqué en « occupé » après un échec réseau laisserait la
    // carte inerte jusqu'au prochain remontage de l'accueil.
    expect(screen.getByLabelText('realLife.extend').props.accessibilityState).toMatchObject({
      disabled: false,
    });
    // L'échec est tracé — silencieux serait indébogable — mais pas remonté à l'utilisateur : la
    // synchro repartira, la période n'est pas perdue.
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
