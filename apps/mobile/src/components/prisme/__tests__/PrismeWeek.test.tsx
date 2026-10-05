/**
 * US PRISME-01 — le bloc « Prisme raconte ta semaine » du bilan hebdo (spec §4, §6.2).
 *
 * Il ne se montre que si Prisme est visible et la semaine non vide ; il n'envoie que ce que l'écran
 * affiche, piliers actifs seulement, avec la décision telle qu'elle est écrite au-dessus (R16).
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { WeeklyReview } from '@wellness/shared';

import { PrismeWeek } from '../PrismeWeek';

const mockTell = jest.fn();
jest.mock('../PrismeTell', () => ({
  PrismeTell: (props: unknown) => {
    mockTell(props);
    return null;
  },
}));

let mockVisible = true;
jest.mock('@/hooks/usePrismeVisibility', () => ({
  usePrismeVisibility: () => ({ visible: mockVisible, minor: false, status: null }),
}));

let mockActivePillars: string[] = ['strength', 'running', 'nutrition'];
jest.mock('@/data/repositories/settings-repository', () => ({
  useSettings: () => ({ settings: { activePillars: mockActivePillars }, isLoading: false }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'fr' } }),
}));

const REVIEW: WeeklyReview = {
  period: { start: '2026-09-21', end: '2026-09-27' },
  current: { workouts: 2, tonnageKg: 16280, runs: 2, distanceM: 31540, loggedDays: 7, daysInTarget: 5, activeDays: 5 },
  previous: null,
  recordsBeaten: 0,
  changes: { tonnage: null, distance: null, activeDays: null, loggedDays: null },
  isEmpty: false,
  decision: { kind: 'all_good', metrics: { activeDays: 5 } },
  realLifeDays: 0,
};

type TellProps = { dossier: { facts: { label: string }[]; decision: string | null }; storeKey: string; usage: string };
const lastTell = () => mockTell.mock.calls.at(-1)![0] as TellProps;

beforeEach(() => {
  jest.clearAllMocks();
  mockVisible = true;
  mockActivePillars = ['strength', 'running', 'nutrition'];
});

describe('PrismeWeek', () => {
  it('raconte la semaine close, avec la décision telle qu’affichée', async () => {
    await render(<PrismeWeek review={REVIEW} periodLabel="du 21 au 27 septembre" decisionText="Point fort : 5 jours actifs." />);

    const props = lastTell();
    expect(props.usage).toBe('week');
    expect(props.storeKey).toBe('week:2026-09-21');
    expect(props.dossier.decision).toBe('Point fort : 5 jours actifs.');
  });

  it('🔴 un objectif en retard part SANS son nom : le nom d’un exercice perso est du texte saisi (R4)', async () => {
    const behind: WeeklyReview = {
      ...REVIEW,
      decision: { kind: 'goal_behind', subject: 'Squat chez Julie', metrics: { progressPct: 30, elapsedPct: 60 } },
    };

    await render(
      <PrismeWeek
        review={behind}
        periodLabel="p"
        decisionText="Ton objectif « Squat chez Julie » a pris du retard : 30 % de progression pour 60 % du temps écoulé."
      />,
    );

    // Trouvé à la relecture avant commit : l'écran garde le nom, Prisme reçoit la même décision sans lui.
    expect(lastTell().dossier.decision).toBe('prisme.dossier.week.goalBehind');
    expect(JSON.stringify(lastTell().dossier)).not.toContain('Julie');
  });

  it('🔴 un pilier inactif n’est pas envoyé (IA-LAB-01 R5)', async () => {
    mockActivePillars = ['strength', 'nutrition'];

    await render(<PrismeWeek review={REVIEW} periodLabel="p" decisionText="d" />);

    expect(lastTell().dossier.facts.map((f) => f.label)).not.toContain('prisme.dossier.session.run');
  });

  it('Prisme invisible : rien', async () => {
    mockVisible = false;

    await render(<PrismeWeek review={REVIEW} periodLabel="p" decisionText="d" />);

    expect(mockTell).not.toHaveBeenCalled();
    expect(screen.toJSON()).toBeNull();
  });

  it('semaine vide : rien (BILAN-01 D4)', async () => {
    await render(<PrismeWeek review={{ ...REVIEW, isEmpty: true, decision: null }} periodLabel="p" decisionText={null} />);

    expect(mockTell).not.toHaveBeenCalled();
  });
});
