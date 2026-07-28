/**
 * US PAS-01 — smoke test du widget des pas.
 *
 * Ce qui est vérifié, c'est le **contrat produit** de la spec §2.4 : aucun état muet. Les cinq
 * situations (indisponible / opt-in OFF / permission manquante / aucune donnée / nominal) doivent
 * chacune produire soit rien du tout (hors Android), soit un texte exploitable — jamais un widget
 * vide qui laisse croire à un bug.
 *
 * Même stratégie de mock que `StreakCard.test.tsx` : repositories, i18n, thème et icônes isolés
 * pour ne dépendre ni de PowerSync ni du natif.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { StepsCard } from '../StepsCard';
import { useDailySteps, useTodaySteps } from '@/data/repositories/daily-steps-repository';
import { useHealthConnectState } from '@/hooks/useHealthConnectState';

jest.mock('@/data/repositories/daily-steps-repository', () => ({
  useTodaySteps: jest.fn(() => ({ steps: 0, goal: 8000, reached: false, isLoading: false })),
  useDailySteps: jest.fn(() => ({ rows: [], isLoading: false })),
}));

jest.mock('@/hooks/useHealthConnectState', () => ({
  useHealthConnectState: jest.fn(() => ({ state: 'ready', refresh: jest.fn() })),
}));

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // `i18n.language` est lu par le formatage des milliers (séparateur FR vs EN).
    i18n: { language: 'fr' },
    t: (k: string, opts?: Record<string, unknown>) => {
      if (k === 'home.streak.days') return ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
      // Les libellés testés sont renvoyés en sentinelle pour être cherchés dans l'arbre.
      return opts && 'count' in opts ? `${k}:${String(opts['count'])}` : k;
    },
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      background: '#f7eede',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      track: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
      success: '#7c8a5b',
      danger: '#b23b2e',
      warn: '#fbf1dd',
      warnBorder: '#b5761f',
      warnText: '#b5761f',
      panel: '#2b2018',
      panelMuted: '#8f8272',
    },
  })),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

/**
 * Valeurs de retour **persistantes** (`mockReturnValue`, pas `…Once`) : le rendu React peut passer
 * plusieurs fois par un hook, et une valeur à usage unique retomberait alors sur le défaut au
 * deuxième passage — ce qui rendait ces tests dépendants du nombre de rendus.
 */
const mockState = (state: string | null) =>
  (useHealthConnectState as jest.Mock).mockReturnValue({ state, refresh: jest.fn() });

const mockToday = (steps: number, goal = 8000, reached = false) =>
  (useTodaySteps as jest.Mock).mockReturnValue({ steps, goal, reached, isLoading: false });

const mockRows = (rows: { logDate: string; steps: number }[]) =>
  (useDailySteps as jest.Mock).mockReturnValue({
    rows: rows.map((r, i) => ({ id: `r${i}`, ...r })),
    isLoading: false,
  });

describe('StepsCard — les 5 états de la spec §2.4', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Défauts explicites : chaque test pose ensuite ce qui l'intéresse.
    mockState('ready');
    mockToday(0);
    mockRows([]);
  });

  it('état non résolu → ne rend rien (pas de widget fantôme le temps d’une frame)', async () => {
    mockState(null);
    mockToday(0);
    mockRows([]);
    expect((await render(<StepsCard />)).toJSON()).toBeNull();
  });

  it('hors Android (unsupported) → widget masqué', async () => {
    mockState('unsupported');
    mockToday(0);
    mockRows([]);
    expect((await render(<StepsCard />)).toJSON()).toBeNull();
  });

  it('opt-in OFF → appel à l’action d’activation', async () => {
    mockState('off');
    mockToday(0);
    mockRows([]);
    const { getByText } = await render(<StepsCard />);
    expect(getByText('steps.enableCta')).toBeTruthy();
  });

  it('permission manquante → appel à l’action d’autorisation', async () => {
    mockState('permissions_missing');
    mockToday(0);
    mockRows([]);
    const { getByText } = await render(<StepsCard />);
    expect(getByText('steps.permissionCta')).toBeTruthy();
  });

  it('Health Connect absent → message d’indisponibilité', async () => {
    mockState('provider_missing');
    mockToday(0);
    mockRows([]);
    const { getByText } = await render(<StepsCard />);
    expect(getByText('steps.unsupported')).toBeTruthy();
  });

  it('autorisé mais aucune donnée → état vide explicite, aucun zéro affiché comme un total', async () => {
    mockState('ready');
    mockToday(0);
    mockRows([]);
    const { getByText } = await render(<StepsCard />);
    expect(getByText('steps.empty')).toBeTruthy();
  });

  it('nominal → total du jour affiché', async () => {
    mockState('ready');
    mockToday(6240, 8000, false);
    mockRows([{ logDate: '2026-07-28', steps: 6240 }]);
    const { getByText } = await render(<StepsCard />);
    // Espace insécable entre milliers (formatage FR).
    expect(getByText('6 240')).toBeTruthy();
    expect(getByText('78%')).toBeTruthy();
  });

  it('objectif atteint → pourcentage plafonné à 100 %', async () => {
    mockState('ready');
    mockToday(9000, 8000, true);
    mockRows([{ logDate: '2026-07-28', steps: 9000 }]);
    const { getByText } = await render(<StepsCard />);
    expect(getByText('100%')).toBeTruthy();
  });
});
