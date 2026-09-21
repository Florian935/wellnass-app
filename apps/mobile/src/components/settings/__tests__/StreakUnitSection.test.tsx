/**
 * US SERIE-01 — le réglage de la régularité.
 *
 * Ce que ce fichier protège, dans l'ordre d'importance :
 *  1. **Rien n'est écrit tant qu'on n'a pas répondu** (D4/R9) — la colonne d'objectif reste à
 *     `null` et l'écran affiche le compte nu. C'est la leçon d'`activity_level`, où un repli
 *     affiché comme un choix a fini par surestimer une cible calorique en silence.
 *  2. **L'incohérence est signalée, jamais corrigée** (R10) — l'app ne réécrit aucun des deux
 *     chiffres de son propre chef.
 *  3. Les bornes de l'objectif ne s'enroulent pas : 1 reste 1, 14 reste 14.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StreakUnitSection } from '../StreakUnitSection';
import { updateSettings, useSettings } from '@/data/repositories/settings-repository';
import { useStreakData } from '@/data/repositories/dashboard-repository';

jest.mock('@/data/repositories/settings-repository', () => ({
  useSettings: jest.fn(),
  updateSettings: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/data/repositories/dashboard-repository', () => ({
  useStreakData: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
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
      accent: '#c0562f',
      accentText: '#ffffff',
      warnText: '#8a6b2f',
      success: '#7c8a5b',
      danger: '#b23b2e',
      track: '#eadcc6',
    },
  })),
}));

jest.mock('@/components/Segment', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Segment: <T,>({
      options,
      value,
      onChange,
      label,
    }: {
      options: readonly T[];
      value: T;
      onChange: (v: T) => void;
      label: (o: T) => string;
    }) =>
      options.map((o) => (
        <Pressable
          key={String(o)}
          accessibilityRole="button"
          accessibilityLabel={`segment-${String(o)}`}
          accessibilityState={{ selected: o === value }}
          onPress={() => onChange(o)}
        >
          <Text>{label(o)}</Text>
        </Pressable>
      )),
  };
});

/** Le bloc hebdomadaire du hook, dont chaque test ne précise que ce qui le concerne. */
const weekly = (over: Record<string, unknown> = {}) => ({
  weekly: {
    unit: 'week',
    offerSwitch: false,
    current: 3,
    activeThisWeek: true,
    doneThisWeek: 2,
    goal: null,
    goalMet: false,
    goalConflict: false,
    runningFrequency: null,
    weeks: [],
    ...over,
  },
});

const withGoal = (goal: number | null) =>
  (useSettings as jest.Mock).mockReturnValue({ settings: { weeklyActivityGoal: goal } });

describe('StreakUnitSection — le réglage de la régularité', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    withGoal(null);
    (useStreakData as jest.Mock).mockReturnValue(weekly());
  });

  it('🔴 sans objectif réglé, l’écran le DIT et n’écrit rien (R9, D4)', async () => {
    const { getByText } = await render(<StreakUnitSection />);

    expect(getByText('settings.streak.goalNone')).toBeTruthy();
    // Le simple fait d'ouvrir l'écran ne doit poser aucune valeur : `null` veut dire « la question
    // n'a jamais été posée », et il doit continuer de le vouloir dire après affichage.
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('l’objectif proposé s’aligne sur la fréquence de course visée', async () => {
    // Proposer 3 à quelqu'un qui vise déjà 4 sorties créerait l'incohérence que le bloc du dessous
    // est chargé de signaler — l'écran se contredirait lui-même dès le premier appui.
    (useStreakData as jest.Mock).mockReturnValue(weekly({ runningFrequency: 4 }));

    const { getByText } = await render(<StreakUnitSection />);
    fireEvent.press(getByText('settings.streak.goalSet'));

    expect(updateSettings).toHaveBeenCalledWith({ weeklyActivityGoal: 4 });
  });

  it('sans fréquence de course, la proposition vaut 3', async () => {
    const { getByText } = await render(<StreakUnitSection />);
    fireEvent.press(getByText('settings.streak.goalSet'));

    expect(updateSettings).toHaveBeenCalledWith({ weeklyActivityGoal: 3 });
  });

  // Un objectif qui passerait de 14 à 1 d'un seul appui serait une erreur de saisie, pas un choix :
  // contrairement au sélecteur d'heure, ce pas **borne** au lieu d'enrouler.
  //
  // ⚠️ **Un rendu et une interaction par test**, ici, et pas deux. Empiler deux `render()` ou deux
  // `fireEvent.press` dans un même test laisse le nettoyage de RNTL dans un état bancal : ce sont
  // les tests **suivants** qui rendent un arbre vide et échouent. On a cherché un moment le bug
  // dans « retirer l'objectif », qui n'y était pour rien.
  it('🔴 la borne haute ne s’enroule pas : 14 + 1 reste 14', async () => {
    withGoal(14);
    const { getByLabelText } = await render(<StreakUnitSection />);
    fireEvent.press(getByLabelText('settings.streak.goalIncrease'));

    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('🔴 la borne basse ne s’enroule pas : 1 − 1 reste 1', async () => {
    withGoal(1);
    const { getByLabelText } = await render(<StreakUnitSection />);
    fireEvent.press(getByLabelText('settings.streak.goalDecrease'));

    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('le pas monte d’une activité à l’intérieur des bornes', async () => {
    withGoal(4);
    const { getByLabelText } = await render(<StreakUnitSection />);
    fireEvent.press(getByLabelText('settings.streak.goalIncrease'));

    expect(updateSettings).toHaveBeenCalledWith({ weeklyActivityGoal: 5 });
  });

  it('le pas descend d’une activité à l’intérieur des bornes', async () => {
    withGoal(4);
    const { getByLabelText } = await render(<StreakUnitSection />);
    fireEvent.press(getByLabelText('settings.streak.goalDecrease'));

    expect(updateSettings).toHaveBeenCalledWith({ weeklyActivityGoal: 3 });
  });

  it('retirer l’objectif remet la colonne à null — pas à une valeur de repli', async () => {
    withGoal(4);
    const { getByText } = await render(<StreakUnitSection />);
    fireEvent.press(getByText('settings.streak.goalRemove'));

    expect(updateSettings).toHaveBeenCalledWith({ weeklyActivityGoal: null });
  });

  it('choisir une unité écrit le réglage', async () => {
    const { getByLabelText } = await render(<StreakUnitSection />);
    fireEvent.press(getByLabelText('segment-day'));

    expect(updateSettings).toHaveBeenCalledWith({ streakUnit: 'day' });
  });

  it('le sélecteur montre l’unité EFFECTIVE, celle que la carte d’accueil affiche', async () => {
    (useStreakData as jest.Mock).mockReturnValue(weekly({ unit: 'day' }));

    const { getByLabelText } = await render(<StreakUnitSection />);

    expect(getByLabelText('segment-day').props.accessibilityState.selected).toBe(true);
    expect(getByLabelText('segment-week').props.accessibilityState.selected).toBe(false);
  });

  it('🔴 l’incohérence est SIGNALÉE, et rien n’est corrigé tout seul (R10)', async () => {
    withGoal(2);
    (useStreakData as jest.Mock).mockReturnValue(
      weekly({ goal: 2, goalConflict: true, runningFrequency: 3 }),
    );

    const { getByText } = await render(<StreakUnitSection />);

    expect(getByText('settings.streak.conflictTitle')).toBeTruthy();
    // Le message s'affiche, l'objectif reste tel quel : les deux chiffres sont légitimes.
    expect(updateSettings).not.toHaveBeenCalled();

    // L'alignement n'a lieu que si on le demande.
    fireEvent.press(getByText('settings.streak.conflictFix'));
    expect(updateSettings).toHaveBeenCalledWith({ weeklyActivityGoal: 3 });
  });

  it('aucune incohérence signalée quand les deux cibles se tiennent', async () => {
    withGoal(5);
    (useStreakData as jest.Mock).mockReturnValue(
      weekly({ goal: 5, goalConflict: false, runningFrequency: 3 }),
    );

    const { queryByText } = await render(<StreakUnitSection />);

    expect(queryByText('settings.streak.conflictTitle')).toBeNull();
  });
});
