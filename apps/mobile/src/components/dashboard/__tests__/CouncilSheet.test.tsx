/**
 * US CONS-01 — le Conseil, vu depuis l'écran.
 *
 * Ce qui se vérifie ici tient en trois points, et chacun serait un défaut grave s'il lâchait :
 *  1. **les deux boutons écrivent ce que la carte écrivait** — un écran d'arbitrage qui déclenche
 *     autre chose que ce qu'il chiffre serait pire que pas d'écran du tout ;
 *  2. **aucun chrono n'est projeté**, et l'écran le dit (la maquette du 13/09 en montrait) ;
 *  3. **sans données, on l'écrit** au lieu d'afficher deux colonnes vides.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { CouncilSheet } from '../CouncilSheet';
import { useLabComposer } from '@/data/repositories/lab-repository';
import type { GoalConflict, LabComposerContext } from '@wellness/shared';

jest.mock('@/data/repositories/lab-repository', () => ({ useLabComposer: jest.fn() }));
jest.mock('@/data/repositories/settings-repository', () => ({
  // Pas de consentement IA : le bloc « Résumer » ne doit pas apparaître.
  useSettings: () => ({ settings: null, isLoading: false }),
}));
jest.mock('@/components/lab/LabNarration', () => ({ LabNarration: () => null }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#786a59',
      surface: '#fffaf2',
      background: '#f7eede',
      border: '#ece0cd',
      accent: '#b14f2b',
      accentText: '#fff',
      danger: '#b23b2e',
      borderStrong: '#999',
    },
  }),
}));

const CONFLIT: GoalConflict = { rule: 'bulkVsCut', left: 'goal.muscle', right: 'nutrition.cut' };

const CONTEXTE: LabComposerContext = {
  activePillars: ['strength', 'nutrition'],
  baseline: {
    strengthSessions: 3,
    runningFrequency: 2,
    proteinGPerKg: 1.8,
    objective: 'cut',
    sleep: 'long',
  },
  weightKg: 78,
  tdeeKcal: 2600,
  sbd: { lastTotalKg: 420, slopePerWeek: 1.2 },
  loadRatio: 1.05,
  hoursPerRun: 0.8,
};

const mockComposer = useLabComposer as jest.Mock;
const onKeepMainGoal = jest.fn();
const onKeepPillarGoal = jest.fn();
const onClose = jest.fn();

const afficher = () =>
  render(
    <CouncilSheet
      visible
      conflict={CONFLIT}
      onKeepMainGoal={onKeepMainGoal}
      onKeepPillarGoal={onKeepPillarGoal}
      onClose={onClose}
    />,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockComposer.mockReturnValue({ context: CONTEXTE, isLoading: false });
});

describe('CouncilSheet', () => {
  it('montre les deux issues et les voix des piliers actifs', async () => {
    await afficher();

    expect(screen.getByTestId('council-option-keepMainGoal')).toBeTruthy();
    expect(screen.getByTestId('council-option-keepPillarGoal')).toBeTruthy();
    expect(screen.getByTestId('council-voice-strength')).toBeTruthy();
    expect(screen.getByTestId('council-voice-nutrition')).toBeTruthy();
    // Pilier course inactif dans ce contexte : il n'a pas d'avis à donner (décision H).
    expect(screen.queryByTestId('council-voice-running')).toBeNull();
  });

  it('🔴 dit qu’aucun chrono n’est projeté', async () => {
    await afficher();

    // La maquette du 13/09 affichait « 19:35–20:10 » : aucun calcul validé ne relie une dose à un
    // temps de course, et le dépôt a déjà refusé ça une fois (prototype Labo, 15/09).
    expect(screen.getByText('council.noPace')).toBeTruthy();
  });

  it('🔴 le bouton déclenche EXACTEMENT l’action de la carte, puis referme', async () => {
    await afficher();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('goalConflict.keepMainGoal'));
    });

    expect(onKeepMainGoal).toHaveBeenCalledTimes(1);
    expect(onKeepPillarGoal).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('🔴 sans poids, on l’écrit — pas deux colonnes vides', async () => {
    mockComposer.mockReturnValue({ context: { ...CONTEXTE, weightKg: null }, isLoading: false });

    await afficher();

    expect(screen.getByText('council.notEnough')).toBeTruthy();
    expect(screen.queryByTestId('council-option-keepMainGoal')).toBeNull();
  });

  it('pendant le chargement, rien n’est affirmé', async () => {
    mockComposer.mockReturnValue({ context: CONTEXTE, isLoading: true });

    await afficher();

    expect(screen.getByText('council.notEnough')).toBeTruthy();
  });
});
