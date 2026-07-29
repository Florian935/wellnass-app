/**
 * StreakCard.test.tsx — Smoke test pour le widget de régularité (streak).
 *
 * Vérifie que :
 *  1. Le nombre de jours n'est affiché qu'une seule fois (garde-fou contre la
 *     régression "double nombre" où `count` était interpolé dans le suffixe).
 *  2. L'état vide (`current === 0`) affiche la clé `home.streak.empty`.
 *  3. L'état de chargement (`isLoading === true`) rend null (rien dans l'arbre).
 *
 * Stratégie de mock :
 *  - `@/data/repositories/dashboard-repository` → `useStreakData` retourne
 *    des données contrôlées (jest.fn() réassignable via mockReturnValueOnce).
 *  - `react-i18next` → `useTranslation` retourne un spy `t` qui fournit des
 *    sentinelles fixes pour les clés testées, inspectable via `expect(t).toHaveBeenCalledWith`.
 *  - `@/theme/useTheme` → objet de couleurs statique (même patron que charts-smoke
 *    et history-smoke).
 *  - `@expo/vector-icons` → Ionicons remplacé par un View natif (composant muet).
 *
 * Note hoisting : les factories jest.mock() sont hoistées par Babel avant
 * const/let — on utilise `var` pour les variables mutables dans les factories.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { StreakCard } from '../StreakCard';
import { useStreakData } from '@/data/repositories/dashboard-repository';

// ---------------------------------------------------------------------------
// Mock du repository dashboard (isole PowerSync + SQLite)
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/dashboard-repository', () => ({
  useStreakData: jest.fn(() => ({
    current: 0,
    activeToday: false,
    last7: [],
    // US STREAK-01 : pas de trou rattrapable par défaut — le cas courant.
    restorableGap: null,
    isLoading: false,
  })),
  useTodaySession: jest.fn(),
  useNutritionSummary: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock react-i18next — spy inspectable avec sentinelles fixes
//
// `t` est un jest.fn() qui retourne :
//   - 'home.streak.days' → tableau de labels courts (7 éléments)
//   - 'home.streak.suffix' → sentinel 'STREAK_SUFFIX' (indépendant de count)
//   - 'home.streak.empty' → sentinel 'STREAK_EMPTY'
//   - toute autre clé → la clé elle-même (pass-through)
//
// Note : la factory jest.mock est hoistée — on utilise require() interne pour
// créer le mock et on expose tSpy via une variable de module accessible au
// moment de l'exécution des tests.
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-var
var tSpy: jest.Mock;

jest.mock('react-i18next', () => {
  // eslint-disable-next-line no-var
  var spy = jest.fn((k: string, _opts?: unknown) => {
    if (k === 'home.streak.days') {
      return ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    }
    if (k === 'home.streak.suffix') {
      return 'STREAK_SUFFIX';
    }
    if (k === 'home.streak.empty') {
      return 'STREAK_EMPTY';
    }
    return k;
  });
  tSpy = spy;
  return {
    useTranslation: () => ({ t: spy }),
  };
});

// ---------------------------------------------------------------------------
// Mock useTheme (évite useSettings → PowerSync)
// Même patron que charts-smoke.test.tsx et history-smoke.test.tsx.
// ---------------------------------------------------------------------------

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
      accent: '#c0562f',
      accentText: '#ffffff',
      success: '#7c8a5b',
      danger: '#b23b2e',
    },
  })),
}));

// ---------------------------------------------------------------------------
// Mock @expo/vector-icons — Ionicons utilisé dans DashboardCard
// Remplacé par null pour éviter les assets natifs (pas de require() dans la factory).
// ---------------------------------------------------------------------------

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

// ---------------------------------------------------------------------------
// Fixture last7 — 7 jours avec exactement un isToday (2026-07-08 = mardi)
// ---------------------------------------------------------------------------

const LAST7_FIXTURE = [
  { key: '2026-07-06', active: true, isToday: false },  // lundi
  { key: '2026-07-07', active: true, isToday: false },  // mardi précédent
  { key: '2026-07-08', active: true, isToday: true },   // aujourd'hui
  { key: '2026-07-09', active: false, isToday: false }, // mercredi (futur)
  { key: '2026-07-10', active: false, isToday: false }, // jeudi (futur)
  { key: '2026-07-11', active: false, isToday: false }, // vendredi (futur)
  { key: '2026-07-12', active: false, isToday: false }, // samedi (futur)
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StreakCard — smoke test', () => {
  beforeEach(() => {
    // Réinitialiser le spy entre les tests pour des assertions propres
    if (tSpy) tSpy.mockClear();
  });

  // -------------------------------------------------------------------------
  // 1. Garde-fou contre la régression double-nombre
  // -------------------------------------------------------------------------

  it('garde-fou double-nombre : le chiffre streak apparaît une seule fois', async () => {
    (useStreakData as jest.Mock).mockReturnValueOnce({
      current: 5,
      activeToday: true,
      last7: LAST7_FIXTURE,
      restorableGap: null,
      isLoading: false,
    });

    const { getAllByText, queryAllByText } = await render(<StreakCard />);

    // Le chiffre "5" doit apparaître exactement une fois dans l'arbre rendu.
    // Avant le fix, le suffixe interpolait count → "5 jours", créant un
    // second nœud texte contenant "5".
    const occurrences5 = queryAllByText('5');
    expect(occurrences5).toHaveLength(1);

    // Le suffixe doit afficher la sentinelle (sans chiffre intégré).
    expect(getAllByText('STREAK_SUFFIX')).toHaveLength(1);

    // L'ancienne clé fautive 'home.streak.count' ne doit jamais être appelée.
    const countKeyCalls = tSpy.mock.calls.filter(
      (args: string[]) => args[0] === 'home.streak.count',
    );
    expect(countKeyCalls).toHaveLength(0);

    // La clé correcte du suffixe doit avoir été appelée.
    const suffixCalls = tSpy.mock.calls.filter(
      (args: string[]) => args[0] === 'home.streak.suffix',
    );
    expect(suffixCalls.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 2. État vide (current === 0)
  // -------------------------------------------------------------------------

  it('état vide : affiche la sentinelle home.streak.empty et le chiffre 0', async () => {
    (useStreakData as jest.Mock).mockReturnValueOnce({
      current: 0,
      activeToday: false,
      last7: LAST7_FIXTURE,
      restorableGap: null,
      isLoading: false,
    });

    const { getAllByText, queryAllByText } = await render(<StreakCard />);

    // Le texte vide doit être présent.
    expect(getAllByText('STREAK_EMPTY')).toHaveLength(1);

    // Le grand nombre doit afficher 0.
    expect(queryAllByText('0')).toHaveLength(1);

    // Ni home.streak.suffix ni home.streak.count ne doivent être appelés.
    const suffixCalls = tSpy.mock.calls.filter(
      (args: string[]) => args[0] === 'home.streak.suffix',
    );
    expect(suffixCalls).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 3. État de chargement (isLoading === true) → null
  // -------------------------------------------------------------------------

  it('isLoading=true : le composant retourne null (arbre vide)', async () => {
    (useStreakData as jest.Mock).mockReturnValueOnce({
      current: 0,
      activeToday: false,
      last7: [],
      isLoading: true,
    });

    const { toJSON } = await render(<StreakCard />);

    // Le composant retourne null quand isLoading est vrai.
    expect(toJSON()).toBeNull();
  });
});
