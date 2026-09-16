/**
 * US LABO-01 — la note de nuit dans la feuille de check-in (BIEN-01).
 *
 * Health Connect « sommeil » avait été écarté (une déclaration Play de plus pour une donnée que
 * personne ne mesure la nuit) : la nuit est donc **saisie**, ici, au même endroit que l'humeur. Ce
 * qui est testé est ce qui déciderait de son adoption, et ce qui la rendrait fausse :
 *
 *  1. **elle est facultative comme le reste** — une feuille ouverte puis refermée n'écrit rien, et
 *     une nuit SEULE suffit à enregistrer (décision D3) ;
 *  2. **un premier appui pose une nuit plausible**, pas un quart d'heure : personne ne monte de 0 à
 *     7 h par pas de 15 min, et une feuille qui demande 28 appuis n'est jamais remplie ;
 *  3. **« non renseignée » reste atteignable** — sans sortie, une nuit posée par erreur resterait
 *     dans l'historique et fausserait l'anneau des nuits du Labo.
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { WellbeingCheckinSheet } from '../WellbeingCheckinSheet';
import { saveWellbeing } from '@/data/repositories/daily-wellbeing-repository';
import { useLatestWeight } from '@/data/repositories/bodyweight-repository';

jest.mock('@/data/repositories/daily-wellbeing-repository', () => ({ saveWellbeing: jest.fn(async () => true) }));
jest.mock('@/data/repositories/bodyweight-repository', () => ({
  logWeight: jest.fn(async () => undefined),
  useLatestWeight: jest.fn(() => ({ latest: null })),
}));
// Le champ est gardé par `LAB_WRITE_READY`, à `false` tant que la migration n'est pas poussée.
// Le drapeau est lu à CHAQUE rendu (accès de propriété après transpilation) : un accesseur suffit
// donc à le faire varier d'un test à l'autre, sans remonter les modules.
let mockWriteReady = true;
jest.mock('@/data/repositories/lab-experiment-repository', () => ({
  get LAB_WRITE_READY() {
    return mockWriteReady;
  },
}));
jest.mock('@/components/wellbeing/WellbeingScale', () => ({ WellbeingScale: () => null }));
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
    colors: { text: '#33291f', textMuted: '#96856f', background: '#fffaf2', surface: '#fffaf2', border: '#ece0cd', danger: '#b23b2e' },
  }),
}));

const JOUR = '2026-09-16';
const onClose = jest.fn();

const afficher = async (existing: Parameters<typeof WellbeingCheckinSheet>[0]['existing'] = null) => {
  await render(<WellbeingCheckinSheet visible onClose={onClose} logDate={JOUR} existing={existing} />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const valeurNuit = () => screen.getByTestId('wellbeing-sleep-value').props.children as string;

beforeEach(() => {
  jest.clearAllMocks();
  mockWriteReady = true;
  (useLatestWeight as jest.Mock).mockReturnValue({ latest: null });
});

describe('note de nuit', () => {
  it('ouvre sur « non renseignée » : rien n’est supposé', async () => {
    await afficher();

    expect(valeurNuit()).toBe('wellbeing.sleepNone');
    // Un check-in vide reste vide : le bouton n'écrit rien tant que rien n'est dit.
    expect(screen.getByLabelText('wellbeing.save').props.accessibilityState.disabled).toBe(true);
  });

  it('🔴 le premier « + » pose 7 h, pas 15 min', async () => {
    await afficher();

    await taper(screen.getByLabelText('wellbeing.sleepMore'));

    // Monter de 0 à 7 h par quarts d'heure demanderait 28 appuis : la feuille ne serait jamais
    // remplie, et la donnée qui alimente tout le Labo n'existerait pas.
    expect(valeurNuit()).toBe('7 h');
  });

  it('les crans suivants valent un quart d’heure', async () => {
    await afficher();

    await taper(screen.getByLabelText('wellbeing.sleepMore'));
    await taper(screen.getByLabelText('wellbeing.sleepMore'));
    await taper(screen.getByLabelText('wellbeing.sleepLess'));
    await taper(screen.getByLabelText('wellbeing.sleepLess'));
    await taper(screen.getByLabelText('wellbeing.sleepLess'));

    // 7 h → 7 h 15 → 7 h → 6 h 45 → 6 h 30.
    expect(valeurNuit()).toBe('6 h 30');
  });

  it('🔴 une nuit SEULE suffit à enregistrer (décision D3)', async () => {
    await afficher();

    await taper(screen.getByLabelText('wellbeing.sleepMore'));
    await taper(screen.getByLabelText('wellbeing.save'));

    expect(saveWellbeing).toHaveBeenCalledWith(JOUR, expect.objectContaining({ sleepMinutes: 420 }));
  });

  it('🔴 « effacer » ramène à non renseignée — et redonne un check-in vide', async () => {
    await afficher();

    await taper(screen.getByLabelText('wellbeing.sleepMore'));
    await taper(screen.getByText('wellbeing.sleepClear'));

    // Sans sortie, une nuit posée par erreur resterait dans l'historique et fausserait l'anneau
    // des nuits du Labo — sans que rien ne permette de la retirer.
    expect(valeurNuit()).toBe('wellbeing.sleepNone');
    expect(screen.getByLabelText('wellbeing.save').props.accessibilityState.disabled).toBe(true);
  });

  it('un check-in existant rouvre sur SA nuit', async () => {
    await afficher({ id: 'w-1', logDate: JOUR, mood: 4, energy: 3, stress: 2, sleepMinutes: 450 });

    expect(valeurNuit()).toBe('7 h 30');
  });

  it('🔴 « effacer » n’est proposé que quand il y a quelque chose à effacer', async () => {
    await afficher();

    expect(screen.queryByText('wellbeing.sleepClear')).toBeNull();
  });
});

describe('garde-fou d’écriture', () => {
  it('🔴 le champ DISPARAÎT tant que la migration n’est pas sur le cloud', async () => {
    // Écrire une colonne que le serveur ne connaît pas met en file une opération que le cloud
    // rejette — et PowerSync sérialise la file, donc c'est la remontée de TOUTES les tables qui se
    // fige. Le check-in étant un écran partagé, n'importe qui pourrait déclencher ça sans jamais
    // ouvrir le Labo. Patron `ADAPTATION_WRITE_READY` (CARDIO-UX01).
    mockWriteReady = false;
    await afficher();

    expect(screen.queryByTestId('wellbeing-sleep')).toBeNull();
    // Le reste du check-in continue de fonctionner : le garde-fou retire un champ, pas l'écran.
    expect(screen.getByLabelText('wellbeing.weightLabel')).toBeTruthy();
  });
});
