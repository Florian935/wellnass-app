/**
 * US BIEN-03 / BIEN-06 / BIEN-07 — le check-in en deux temps (décision D4 du 01/10/2026).
 *
 * Ce qui est verrouillé ici, et qui se casserait sans qu'aucun écran ne le montre :
 *
 *  1. **une feuille n'écrit que les champs de son moment** — le soir ne remet pas la nuit à zéro,
 *     le matin n'efface pas l'humeur de la veille au soir ;
 *  2. **une nuit lue dans Health Connect et non touchée ne part pas** : la renvoyer la ferait passer
 *     pour une saisie manuelle, et la lecture suivante ne pourrait plus la compléter ;
 *  3. **les modules éteints ne posent pas leur question et n'écrivent rien** (D6) ;
 *  4. « non renseignée » reste atteignable pour une nuit saisie — pas pour une nuit lue, que la
 *     lecture suivante réécrirait.
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { MomentCheckinSheet } from '../MomentCheckinSheet';
import { saveWellbeing, type WellbeingEntry } from '@/data/repositories/daily-wellbeing-repository';
import { useWellbeingPillar } from '@/data/repositories/wellbeing-pillar-repository';

jest.mock('@/data/repositories/daily-wellbeing-repository', () => ({ saveWellbeing: jest.fn(async () => true) }));
jest.mock('@/data/repositories/bodyweight-repository', () => ({
  logWeight: jest.fn(async () => undefined),
  useLatestWeight: jest.fn(() => ({ latest: null })),
}));
jest.mock('@/data/repositories/wellbeing-pillar-repository', () => ({ useWellbeingPillar: jest.fn() }));
jest.mock('@/data/repositories/settings-repository', () => ({ useSettings: () => ({ settings: { painJournalEnabled: true } }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
// L'échelle a ses propres tests : ici, un appui pose le niveau 2.
jest.mock('@/components/wellbeing/WellbeingScale', () => {
  const { Pressable, Text } = require('react-native');
  return {
    WellbeingScale: ({ indicator, onChange }: { indicator: string; onChange: (level: number) => void }) => (
      <Pressable testID={`scale-${indicator}`} onPress={() => onChange(2)}>
        <Text>{indicator}</Text>
      </Pressable>
    ),
  };
});
jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    weightSymbol: 'kg',
    toWeightValue: (kg: number) => kg,
    parseWeightToKg: (text: string) => (text.trim() === '' ? null : Number(text.replace(',', '.'))),
  }),
}));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});
jest.mock('@/components/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => (
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={!!disabled} onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'fr' }, t: (k: string) => k }),
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    scheme: 'light',
    colors: { text: '#33291f', textMuted: '#96856f', background: '#fffaf2', surface: '#fffaf2', border: '#ece0cd', danger: '#b23b2e', accent: '#6a3fb0', track: '#eee' },
  }),
}));

const JOUR = '2026-10-01';
const onClose = jest.fn();

const MODULES_OFF = { alcohol: false, caffeine: false, nap: false, cravings: false };
const MODULES_ON = { alcohol: true, caffeine: true, nap: true, cravings: true };

function entry(over: Partial<WellbeingEntry> = {}): WellbeingEntry {
  return {
    id: 'w-1',
    logDate: JOUR,
    mood: null,
    energy: null,
    stress: null,
    sleepMinutes: null,
    sleepQuality: null,
    motivation: null,
    sick: false,
    busyDay: false,
    lateNight: false,
    travel: false,
    alcoholDrinks: null,
    lateCaffeine: null,
    napMinutes: null,
    cravings: null,
    sleepSource: null,
    sleepStartAt: null,
    sleepEndAt: null,
    ...over,
  };
}

const afficher = async (moment: 'morning' | 'evening', existing: WellbeingEntry | null = null, onCatchUpYesterday?: () => void) => {
  await render(<MomentCheckinSheet visible onClose={onClose} logDate={JOUR} moment={moment} existing={existing} onCatchUpYesterday={onCatchUpYesterday} />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const enregistrer = () => taper(screen.getByLabelText('wellbeing.moments.save'));
const envoye = () => (saveWellbeing as jest.Mock).mock.calls[0]![1] as Record<string, unknown>;

beforeEach(() => {
  jest.clearAllMocks();
  (useWellbeingPillar as jest.Mock).mockReturnValue({ modules: MODULES_OFF });
  (saveWellbeing as jest.Mock).mockResolvedValue(true);
});

describe('le matin', () => {
  it('🔴 n’écrit QUE les champs du matin — l’humeur de la veille au soir n’est pas touchée', async () => {
    await afficher('morning', entry({ mood: 4, stress: 2 }));

    await taper(screen.getByLabelText('wellbeing.sleepMore'));
    await taper(screen.getByTestId('scale-energy'));
    await taper(screen.getByTestId('moment-tag-sick'));
    await enregistrer();

    expect(saveWellbeing).toHaveBeenCalledWith(JOUR, {
      sleepQuality: null,
      energy: 2,
      motivation: null,
      sick: true,
      travel: false,
      sleepMinutes: 420,
    });
    expect(envoye()).not.toHaveProperty('mood');
    expect(envoye()).not.toHaveProperty('stress');
    expect(onClose).toHaveBeenCalled();
  });

  it('pose la nuit, sa qualité, l’énergie, l’envie, et deux étiquettes — pas celles du soir', async () => {
    await afficher('morning');

    expect(screen.getByTestId('moment-sleep')).toBeTruthy();
    for (const key of ['sleepQuality', 'energy', 'motivation']) expect(screen.getByTestId(`scale-${key}`)).toBeTruthy();
    expect(screen.queryByTestId('scale-mood')).toBeNull();
    expect(screen.getByTestId('moment-tag-travel')).toBeTruthy();
    expect(screen.queryByTestId('moment-tag-busyDay')).toBeNull();
  });

  it('« Courbatures » ouvre le journal des douleurs au lieu d’être une étiquette de plus', async () => {
    await afficher('morning');

    expect(screen.getByTestId('moment-soreness')).toBeTruthy();
    await taper(screen.getByTestId('moment-soreness'));
    expect(onClose).toHaveBeenCalled();
    expect(saveWellbeing).not.toHaveBeenCalled();
  });

  it('propose le rattrapage de la veille au soir quand on le lui donne', async () => {
    const rattraper = jest.fn();
    await afficher('morning', null, rattraper);

    await taper(screen.getByTestId('moment-catch-up'));
    expect(rattraper).toHaveBeenCalled();
  });

  it('un check-in vide n’enregistre rien', async () => {
    await afficher('morning');

    expect(screen.getByLabelText('wellbeing.moments.save').props.accessibilityState.disabled).toBe(true);
  });

  it('un échec d’écriture se voit — la feuille ne se ferme pas comme si c’était enregistré', async () => {
    (saveWellbeing as jest.Mock).mockRejectedValue(new Error('disque'));
    await afficher('morning');

    await taper(screen.getByTestId('scale-energy'));
    await enregistrer();

    expect(screen.getByText('wellbeing.saveError')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('la nuit lue dans Health Connect', () => {
  const lue = entry({ sleepMinutes: 450, sleepSource: 'health_connect', sleepStartAt: '2026-09-30T21:40:00.000Z' });

  it('🔴 non touchée, elle ne part PAS — elle resterait sinon « saisie à la main »', async () => {
    await afficher('morning', lue);

    expect(screen.getByText('wellbeing.moments.fromHealthConnect')).toBeTruthy();
    await taper(screen.getByTestId('scale-energy'));
    await enregistrer();

    expect(envoye()).not.toHaveProperty('sleepMinutes');
    expect(envoye()).toEqual(expect.objectContaining({ energy: 2 }));
  });

  it('corrigée avec − / +, elle part — et devient la nuit de l’utilisateur', async () => {
    await afficher('morning', lue);

    await taper(screen.getByLabelText('wellbeing.sleepLess'));
    expect(screen.queryByText('wellbeing.moments.fromHealthConnect')).toBeNull();
    await enregistrer();

    expect(envoye()).toEqual(expect.objectContaining({ sleepMinutes: 435 }));
  });

  it('🔴 « effacer » n’est pas proposé : la lecture suivante la réécrirait', async () => {
    await afficher('morning', lue);

    expect(screen.queryByTestId('moment-sleep-clear')).toBeNull();
  });
});

describe('la nuit saisie', () => {
  it('🔴 « effacer » ramène à non renseignée', async () => {
    await afficher('morning', entry({ sleepMinutes: 400, sleepSource: 'manual', energy: 3 }));

    await taper(screen.getByTestId('moment-sleep-clear'));
    expect(screen.getByTestId('moment-sleep-value').props.children).toBe('wellbeing.sleepNone');
    await enregistrer();

    expect(envoye()).toEqual(expect.objectContaining({ sleepMinutes: null }));
  });

  it('n’est proposé que quand il y a une nuit', async () => {
    await afficher('morning');

    expect(screen.queryByTestId('moment-sleep-clear')).toBeNull();
  });
});

describe('le soir', () => {
  it('🔴 n’écrit QUE les champs du soir — la nuit du matin n’est pas remise à zéro', async () => {
    await afficher('evening', entry({ sleepMinutes: 450, sleepSource: 'manual', energy: 4 }));

    await taper(screen.getByTestId('scale-mood'));
    await taper(screen.getByTestId('moment-tag-busyDay'));
    await enregistrer();

    expect(saveWellbeing).toHaveBeenCalledWith(JOUR, { mood: 2, stress: null, busyDay: true, lateNight: false });
    expect(envoye()).not.toHaveProperty('sleepMinutes');
    expect(envoye()).not.toHaveProperty('energy');
  });

  it('modules éteints : aucune question, aucune colonne écrite (D6)', async () => {
    await afficher('evening');

    for (const id of ['moment-alcohol', 'moment-caffeine', 'moment-nap']) expect(screen.queryByTestId(id)).toBeNull();
    expect(screen.queryByTestId('scale-cravings')).toBeNull();
  });

  it('modules allumés : chaque réponse part, et seulement elles', async () => {
    (useWellbeingPillar as jest.Mock).mockReturnValue({ modules: MODULES_ON });
    await afficher('evening');

    await taper(screen.getAllByLabelText('wellbeing.modules.alcohol.a11y')[0]!);
    await taper(screen.getByText('wellbeing.modules.caffeine.yes'));
    await taper(screen.getByTestId('scale-cravings'));
    await taper(screen.getByLabelText('wellbeing.modules.nap.more'));
    await enregistrer();

    expect(envoye()).toEqual({
      mood: null,
      stress: null,
      cravings: 2,
      busyDay: false,
      lateNight: false,
      // Le premier verre proposé est « 0 » : dire « aucun » est une réponse, pas un oubli.
      alcoholDrinks: 0,
      lateCaffeine: true,
      napMinutes: 20,
    });
  });

  it('retaper un niveau d’alcool le retire', async () => {
    (useWellbeingPillar as jest.Mock).mockReturnValue({ modules: { ...MODULES_OFF, alcohol: true } });
    await afficher('evening', entry({ alcoholDrinks: 2 }));

    const deux = screen.getAllByLabelText('wellbeing.modules.alcohol.a11y')[2]!;
    await taper(deux);
    await enregistrer();

    expect(envoye()).toEqual(expect.objectContaining({ alcoholDrinks: null }));
  });
});
