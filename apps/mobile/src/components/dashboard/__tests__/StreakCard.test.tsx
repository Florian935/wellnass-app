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
import { fireEvent, render } from '@testing-library/react-native';
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
    // US SERIE-01 : lecture en jours par défaut, aucune bascule proposée.
    weekly: {
      unit: 'day',
      offerSwitch: false,
      current: 0,
      activeThisWeek: false,
      doneThisWeek: 0,
      goal: null,
      goalMet: false,
      goalConflict: false,
      runningFrequency: null,
      weeks: [],
    },
    isLoading: false,
  })),
  useTodaySession: jest.fn(),
  useNutritionSummary: jest.fn(),
}));

// US SERIE-01 — la carte écrit le réglage d'unité quand on répond à la bascule. Mocké pour deux
// raisons : isoler l'écriture (inspectable), et couper l'import d'`@/i18n` que ce repository
// entraîne — il initialise i18next, ce que ce fichier ne veut surtout pas faire.
jest.mock('@/data/repositories/settings-repository', () => ({
  updateSettings: jest.fn(() => Promise.resolve()),
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
      // US STREAK-01 : la proposition de joker s'en sert. Absent, `withAlpha` levait une erreur
      // que React retentait en silence — le test voyait un arbre vide sans jamais dire pourquoi.
      warnText: '#8a6b2f',
      track: '#eadcc6',
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
// Fixture hebdomadaire (US SERIE-01)
//
// Toujours présente dans le retour de `useStreakData`, même en lecture quotidienne : les deux
// séries sont calculées côte à côte, c'est **l'affichage** qui en choisit une (spec D2).
// ---------------------------------------------------------------------------

const WEEKS_FIXTURE = [
  { key: '2026-05-18', active: true, transparent: false, isCurrent: false },
  { key: '2026-05-25', active: true, transparent: false, isCurrent: false },
  { key: '2026-06-01', active: false, transparent: false, isCurrent: false },
  { key: '2026-06-08', active: false, transparent: true, isCurrent: false },
  { key: '2026-06-15', active: true, transparent: false, isCurrent: false },
  { key: '2026-06-22', active: true, transparent: false, isCurrent: false },
  { key: '2026-06-29', active: true, transparent: false, isCurrent: false },
  { key: '2026-07-06', active: true, transparent: false, isCurrent: true },
];

const WEEKLY_FIXTURE = {
  unit: 'day' as const,
  offerSwitch: false,
  current: 4,
  activeThisWeek: true,
  doneThisWeek: 3,
  goal: null,
  goalMet: false,
  goalConflict: false,
  runningFrequency: null,
  weeks: WEEKS_FIXTURE,
};

/** Un retour de `useStreakData` complet, dont seul ce qui compte pour le test est précisé. */
const streakData = (over: Record<string, unknown> = {}) => ({
  current: 5,
  activeToday: true,
  last7: LAST7_FIXTURE,
  restorableGap: null,
  isLoading: false,
  ...over,
  weekly: { ...WEEKLY_FIXTURE, ...((over['weekly'] as object) ?? {}) },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StreakCard — smoke test', () => {
  beforeEach(() => {
    // Réinitialiser le spy entre les tests pour des assertions propres
    if (tSpy) tSpy.mockClear();
    // Et reposer une valeur **stable** pour le hook. Sans elle, un composant qui rend deux fois
    // (ce qui arrive dès qu'une offre est affichée) verrait la valeur `…Once` du premier rendu
    // puis la valeur d'usine au second — un test vert ou rouge selon le nombre de rendus. Les
    // tests qui suivent utilisent donc `mockReturnValue`, pas `mockReturnValueOnce`.
    (useStreakData as jest.Mock).mockReturnValue(
      streakData({ current: 0, activeToday: false, last7: [], weekly: { current: 0, weeks: [] } }),
    );
  });

  // -------------------------------------------------------------------------
  // 1. Garde-fou contre la régression double-nombre
  // -------------------------------------------------------------------------

  it('garde-fou double-nombre : le chiffre streak apparaît une seule fois', async () => {
    (useStreakData as jest.Mock).mockReturnValue(streakData({ current: 5 }));

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
    (useStreakData as jest.Mock).mockReturnValue(
      streakData({ current: 0, activeToday: false }),
    );

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
  // 3. État de chargement (isLoading === true) → squelette
  // -------------------------------------------------------------------------

  it('isLoading=true : un squelette, sans jamais afficher une série de 0', async () => {
    (useStreakData as jest.Mock).mockReturnValue(
      streakData({ current: 0, activeToday: false, last7: [], isLoading: true }),
    );

    const { toJSON, queryByText } = await render(<StreakCard />);

    // ⚠️ **Changement assumé (US ACCUEIL-04)** : le composant rendait `null`. Sur un accueil dont
    // les six widgets faisaient tous de même, l'écran était vide à l'ouverture puis se remplissait
    // carte par carte, en se réagençant à chaque arrivée.
    expect(toJSON()).not.toBeNull();

    // Ce qui compte autant : le squelette ne montre **aucun chiffre**. Afficher « 0 jour
    // d'affilée » une fraction de seconde à quelqu'un qui tient une série de 40 jours serait le
    // pire message possible de l'écran.
    expect(queryByText('0')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 4. US SERIE-01 — la lecture hebdomadaire
  // -------------------------------------------------------------------------

  it('🔴 en semaines, c’est le compteur HEBDO qui s’affiche — et lui seul (D2)', async () => {
    // La série quotidienne vaut 5, l'hebdomadaire 4. Afficher les deux serait demander à
    // l'utilisateur laquelle est la vraie : il ne doit y avoir qu'un chiffre sur la carte.
    (useStreakData as jest.Mock).mockReturnValue(
      streakData({ current: 5, weekly: { unit: 'week', current: 4 } }),
    );

    const { queryAllByText } = await render(<StreakCard />);

    expect(queryAllByText('4')).toHaveLength(1);
    expect(queryAllByText('5')).toHaveLength(0);
    expect(queryAllByText('home.streak.suffixWeek')).toHaveLength(1);
    // Le suffixe des jours ne doit même pas avoir été demandé.
    expect(tSpy.mock.calls.filter((a: string[]) => a[0] === 'home.streak.suffix')).toHaveLength(0);
  });

  it('la bande passe à HUIT semaines, étiquetées par le quantième de leur lundi', async () => {
    (useStreakData as jest.Mock).mockReturnValue(
      streakData({ weekly: { unit: 'week', current: 4 } }),
    );

    const { queryByText, queryAllByText } = await render(<StreakCard />);

    // Le lundi 2026-06-15 → « 15 ». Les abréviations de jours, elles, disparaissent.
    expect(queryByText('15')).not.toBeNull();
    expect(queryByText('06')).not.toBeNull();
    expect(queryAllByText('L')).toHaveLength(0);
  });

  it('sans objectif réglé, le bandeau affiche le COMPTE NU (R9)', async () => {
    (useStreakData as jest.Mock).mockReturnValue(
      streakData({ weekly: { unit: 'week', goal: null, doneThisWeek: 3 } }),
    );

    await render(<StreakCard />);

    const calls = tSpy.mock.calls.filter((a: string[]) => a[0] === 'home.streak.weekCount');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[1]).toEqual({ count: 3 });
    // Aucune cible inventée : la clé d'objectif n'est pas appelée.
    expect(tSpy.mock.calls.filter((a: string[]) => a[0] === 'home.streak.weekGoal')).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 5. US SERIE-01 — la bascule, proposée une fois (D1)
  // -------------------------------------------------------------------------

  it('la bascule ne s’affiche PAS quand la question a déjà été tranchée', async () => {
    (useStreakData as jest.Mock).mockReturnValue(streakData({ weekly: { offerSwitch: false } }));

    const { queryByText } = await render(<StreakCard />);

    expect(queryByText('home.streak.switchTitle')).toBeNull();
  });

  it('🔴 « garder les jours » écrit le réglage lui AUSSI — sinon la carte reviendrait', async () => {
    // Le piège serait de n'écrire la colonne que sur « oui ». Qui répond « non » reverrait alors la
    // proposition à chaque ouverture : `null` continuerait de vouloir dire « jamais demandé ».
    const { updateSettings } = require('@/data/repositories/settings-repository');
    (updateSettings as jest.Mock).mockClear();
    (useStreakData as jest.Mock).mockReturnValue(streakData({ weekly: { offerSwitch: true } }));

    const { getByText } = await render(<StreakCard />);
    fireEvent.press(getByText('home.streak.switchKeepDay'));

    expect(updateSettings).toHaveBeenCalledWith({ streakUnit: 'day' });
  });

  it('« compter en semaines » écrit l’unité hebdomadaire', async () => {
    const { updateSettings } = require('@/data/repositories/settings-repository');
    (updateSettings as jest.Mock).mockClear();
    (useStreakData as jest.Mock).mockReturnValue(streakData({ weekly: { offerSwitch: true } }));

    const { getByText } = await render(<StreakCard />);
    fireEvent.press(getByText('home.streak.switchToWeek'));

    expect(updateSettings).toHaveBeenCalledWith({ streakUnit: 'week' });
  });

  it('🔴 un joker à proposer efface la bascule — une seule offre à la fois', async () => {
    (useStreakData as jest.Mock).mockReturnValue(
      streakData({
        weekly: { offerSwitch: true },
        restorableGap: { day: '2026-07-07', streakIfUsed: 6 },
      }),
    );

    const { queryByText } = await render(<StreakCard />);

    expect(queryByText('home.streak.jokerTitle')).not.toBeNull();
    expect(queryByText('home.streak.switchTitle')).toBeNull();
  });
});
