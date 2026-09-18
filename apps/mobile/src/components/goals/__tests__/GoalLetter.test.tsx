/**
 * US LETTRE-01 — le mot scellé, vu depuis la carte d'objectif.
 *
 * Ce qui est testé ici n'est pas l'affichage, c'est **la règle qui décide quand l'app ouvre la
 * bouche**. Une lettre est une promesse de discrétion : elle ne doit apparaître d'elle-même que
 * dans les trois cas prévus (R3), et son texte ne doit jamais fuir hors de la feuille de lecture
 * (R2). Ces deux garanties ne se voient pas à l'œil — elles se testent.
 *
 * Quatre pièges couverts :
 *  1. **Objectif sans lettre** : aucune trace nulle part (R5). Un objectif créé sans mot doit se
 *     comporter exactement comme avant cette US.
 *  2. **Objectif en cours** : l'enveloppe existe, mais l'app ne propose RIEN. Une lettre qu'on se
 *     fait proposer tous les jours ne veut plus rien dire (D3).
 *  3. **Déclencheur consommé** : après une ouverture par déclencheur, la proposition disparaît —
 *     mais la relecture volontaire reste possible.
 *  4. **Le texte ne fuit pas** : il n'est jamais rendu par la carte, quel que soit l'état.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { GoalCard } from '../GoalCard';
import { formatLetterAge } from '../GoalLetterSheet';
import type { GoalWithProgress } from '@/data/repositories/goal-repository';

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
      border: '#ece0cd',
      accent: '#b14f2b',
      danger: '#b23b2e',
      success: '#66714b',
      warnText: '#8a5a1f',
    },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    formatDistance: (km: number | null) => (km == null ? '—' : `${km} km`),
    formatWeight: (kg: number | null) => (kg == null ? '—' : `${kg} kg`),
  }),
}));

/** L'anneau est du SVG : hors sujet ici, et il tirerait `react-native-svg` dans le test. */
jest.mock('@/components/widgets/primitives', () => {
  const { View } = require('react-native');
  return { RingGauge: ({ children }: { children?: React.ReactNode }) => <View>{children}</View> };
});

const TEXTE = 'Parce que je veux tenir mes 20 minutes sans marcher.';

type Etat = 'active' | 'achieved' | 'missed';

const objectif = (
  options: { status?: Etat; letterText?: string | null; letterOpenedAt?: string | null } = {},
): GoalWithProgress => {
  const status = options.status ?? 'active';
  const letterText = options.letterText === undefined ? TEXTE : options.letterText;
  return {
    id: 'goal-1',
    kind: 'run_distance',
    targetValue: 50_000,
    startValue: null,
    exerciseId: null,
    startDate: '2026-06-20',
    deadline: '2026-09-15',
    exerciseName: null,
    letterText,
    letterWrittenAt: letterText === null ? null : '2026-06-20T08:00:00.000Z',
    letterOpenedAt: options.letterOpenedAt ?? null,
    progress: {
      currentValue: status === 'achieved' ? 50_000 : 20_000,
      ratio: status === 'achieved' ? 1 : 0.4,
      rawRatio: status === 'achieved' ? 1 : 0.4,
      status,
      unavailable: false,
    },
  };
};

const ouvrir = jest.fn();

beforeEach(() => jest.clearAllMocks());

describe('l’enveloppe sur la carte (R2, R5)', () => {
  it('🔴 aucun objectif sans lettre ne change d’apparence', async () => {
    await render(<GoalCard goal={objectif({ letterText: null })} onOpenLetter={ouvrir} />);

    expect(screen.queryByText(/goals\.letter\.sealed/)).toBeNull();
    expect(screen.queryByLabelText('goals.letter.open')).toBeNull();
  });

  it('montre l’enveloppe et sa date — jamais le texte', async () => {
    await render(<GoalCard goal={objectif()} onOpenLetter={ouvrir} />);

    expect(screen.getByText(/goals\.letter\.sealed/)).toBeTruthy();
    // R2 : le texte n'existe que dans la feuille de lecture. Sur la carte, il fuirait sous les yeux
    // de quiconque regarde par-dessus l'épaule — c'est exactement ce qu'une lettre scellée exclut.
    expect(screen.queryByText(TEXTE)).toBeNull();
  });
});

describe('les déclencheurs (R3)', () => {
  it('🔴 un objectif EN COURS ne propose rien', async () => {
    await render(<GoalCard goal={objectif({ status: 'active' })} onOpenLetter={ouvrir} />);

    expect(screen.queryByText('goals.letter.onAchieved')).toBeNull();
    expect(screen.queryByText('goals.letter.onDeadline')).toBeNull();
    // La relecture volontaire, elle, reste offerte (D3).
    expect(screen.getByLabelText('goals.letter.open')).toBeTruthy();
  });

  it('objectif ATTEINT : la carte propose de relire, et l’ouverture compte comme déclenchée', async () => {
    await render(<GoalCard goal={objectif({ status: 'achieved' })} onOpenLetter={ouvrir} />);

    expect(screen.getByText('goals.letter.onAchieved')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('goals.letter.open'));
    });

    expect(ouvrir).toHaveBeenCalledWith(true);
  });

  it('échéance PASSÉE sans réussite : même proposition, autre message', async () => {
    await render(<GoalCard goal={objectif({ status: 'missed' })} onOpenLetter={ouvrir} />);

    expect(screen.getByText('goals.letter.onDeadline')).toBeTruthy();
  });

  it('🔴 déclencheur déjà consommé : plus de proposition, mais la relecture reste', async () => {
    await render(
      <GoalCard
        goal={objectif({ status: 'achieved', letterOpenedAt: '2026-09-16T09:00:00.000Z' })}
        onOpenLetter={ouvrir}
      />,
    );

    expect(screen.queryByText('goals.letter.onAchieved')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('goals.letter.open'));
    });

    // `false` = relecture volontaire : elle ne doit pas ré-écrire la date d'ouverture.
    expect(ouvrir).toHaveBeenCalledWith(false);
  });
});

describe('formatLetterAge (R4)', () => {
  const t = ((k: string, opts?: Record<string, unknown>) =>
    opts ? `${k}:${JSON.stringify(opts)}` : k) as unknown as Parameters<typeof formatLetterAge>[0];

  it('« moins d’un jour » plutôt que « il y a 0 jour »', () => {
    expect(formatLetterAge(t, 0)).toBe('goals.letter.ageToday');
  });

  it('des jours tant que le mois n’est pas atteint', () => {
    expect(formatLetterAge(t, 29)).toBe('goals.letter.ageDays:{"count":29}');
  });

  it('des mois au-delà : « il y a 94 jours » ne parle à personne', () => {
    expect(formatLetterAge(t, 94)).toBe('goals.letter.ageMonths:{"count":3}');
  });
});
