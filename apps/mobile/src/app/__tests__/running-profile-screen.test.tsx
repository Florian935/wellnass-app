/**
 * Profil coureur (`app/running-profile.tsx`) — le **vrai** écran, monté.
 *
 * L'un des **deux derniers écrans à 0 %** (44 instructions). Il fixe l'**allure de référence 5 km**,
 * dont dérivent toutes les allures cibles de l'app — programmes, planning, détail de séance. Une
 * erreur ici ne se voit pas ici : elle se voit dans une fourchette d'allure fausse, trois écrans
 * plus loin.
 *
 *  1. **La saisie d'allure n'écrit QUE si elle parse.** « 4:3 » en cours de frappe n'est pas une
 *     allure : écrire à chaque caractère enregistrerait des valeurs absurdes entre deux touches,
 *     et chacune recalculerait les quatre allures cibles.
 *  2. **Le champ affiche la saisie en cours, sinon la valeur persistée.** Sans cet état local,
 *     PowerSync réécrirait le champ sous les doigts de l'utilisateur à chaque flush.
 *  3. **Les allures ne s'affichent que si la référence existe** — les calculer sans elle
 *     donnerait quatre fourchettes dérivées de rien.
 *  4. **Les deux réglages vocaux sont indépendants et éteints par défaut** (R1/R3), et le
 *     sélecteur d'intervalle n'existe que si les annonces sont actives.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import RunnerProfileScreen from '../running-profile';
import {
  upsertRunnerProfile,
  useRunnerProfile,
} from '@/data/repositories/running-profile-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/running-profile-repository', () => ({
  useRunnerProfile: jest.fn(() => ({ runnerProfile: null })),
  upsertRunnerProfile: jest.fn(),
}));

jest.mock('@/components/Card', () => {
  const { View } = require('react-native');
  return { Card: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});
jest.mock('@/components/TextField', () => {
  const { TextInput } = require('react-native');
  return {
    TextField: ({
      label,
      value,
      onChangeText,
      placeholder,
    }: {
      label: string;
      value: string;
      onChangeText: (v: string) => void;
      placeholder?: string;
    }) => (
      <TextInput
        accessibilityLabel={label}
        value={value}
        placeholder={placeholder}
        onChangeText={onChangeText}
      />
    ),
  };
});

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

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
      background: '#fffaf2',
      surface: '#fffaf2',
      border: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
    },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({ useUnits: jest.fn() }));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockProfile = useRunnerProfile as jest.Mock;
const mockUpsert = upsertRunnerProfile as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;
const mockUnits = jest.requireMock('@/hooks/useUnits').useUnits as jest.Mock;

const back = jest.fn();

/**
 * `parsePace` reproduit le contrat réel : `M:SS` valide → secondes ; tout le reste → `null`.
 * C'est ce `null` qui empêche d'écrire une allure en cours de frappe.
 */
const unites = (system: 'metric' | 'imperial' = 'metric') => ({
  system,
  distanceSymbol: system === 'imperial' ? 'mi' : 'km',
  parsePace: (v: string) => {
    const m = /^(\d+):([0-5]\d)$/.exec(v.trim());
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  },
  paceInputValue: (s: number | null | undefined) =>
    s == null ? '' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
  formatPace: (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`,
});

const CHAMP_ALLURE = 'running.profile.ref5k (/km)';

const afficher = async ({
  runnerProfile = null as Record<string, unknown> | null,
  system = 'metric' as 'metric' | 'imperial',
} = {}) => {
  mockProfile.mockReturnValue({ runnerProfile });
  mockUnits.mockReturnValue(unites(system));
  await render(<RunnerProfileScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const saisir = async (label: string, valeur: string) => {
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText(label), valeur);
  });
};

const basculer = async (label: string, valeur: boolean) => {
  await act(async () => {
    fireEvent(screen.getByLabelText(label), 'valueChange', valeur);
  });
};

/** Une option de liste verticale, retrouvée par son libellé. */
const option = (cle: string) => screen.getByText(cle).parent!;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ back });
  mockUpsert.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Objectif, niveau, fréquence
// ---------------------------------------------------------------------------

describe('objectif, niveau et fréquence', () => {
  it('🔴 rien n’est présélectionné sur un profil neuf', async () => {
    await afficher();

    // Un objectif choisi d'office serait pris pour le sien : c'est lui qui pilote les
    // recommandations de programme.
    for (const o of ['5k', '10k', 'semi', 'marathon']) {
      expect(option(`running.objective.${o}`).props.accessibilityState.selected).toBe(false);
    }
  });

  it('choisir un objectif l’écrit immédiatement', async () => {
    await afficher();

    await taper(option('running.objective.10k'));

    // Aucun bouton « enregistrer » : l'écran est une modale qu'on referme d'un geste, et une
    // saisie non validée serait perdue sans prévenir.
    expect(mockUpsert).toHaveBeenCalledWith({ objective: '10k' });
  });

  it('choisir un niveau l’écrit immédiatement', async () => {
    await afficher();

    await taper(option('running.level.regulier'));

    expect(mockUpsert).toHaveBeenCalledWith({ level: 'regulier' });
  });

  it('les valeurs existantes sont marquées comme sélectionnées', async () => {
    await afficher({ runnerProfile: { objective: 'semi', level: 'confirme' } });

    expect(option('running.objective.semi').props.accessibilityState.selected).toBe(true);
    expect(option('running.level.confirme').props.accessibilityState.selected).toBe(true);
  });

  it('🔴 la fréquence va de 1 à 7, jamais 0', async () => {
    await afficher();

    // « 0 séance par semaine » n'est pas une fréquence d'entraînement : c'est l'absence de
    // réponse, et elle est déjà représentée par « rien de sélectionné ».
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('choisir une fréquence l’écrit', async () => {
    await afficher();

    await taper(screen.getByText('3'));

    expect(mockUpsert).toHaveBeenCalledWith({ weeklyFrequency: 3 });
  });
});

// ---------------------------------------------------------------------------
// Allure de référence
// ---------------------------------------------------------------------------

describe('allure de référence', () => {
  it('🔴 une saisie INCOMPLÈTE n’écrit RIEN', async () => {
    await afficher();

    await saisir(CHAMP_ALLURE, '4:3');

    // « 4:3 » est un état transitoire de frappe. L'écrire enregistrerait une allure absurde entre
    // deux touches — et chacune recalculerait les quatre allures cibles de l'app.
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('🔴 mais le champ AFFICHE quand même la frappe en cours', async () => {
    await afficher();

    await saisir(CHAMP_ALLURE, '4:3');

    // Refuser d'écrire ne doit pas refuser d'afficher : un champ qui n'avance pas sous les doigts
    // se lit comme un clavier bloqué.
    expect(screen.getByLabelText(CHAMP_ALLURE).props.value).toBe('4:3');
  });

  it('une allure complète est enregistrée en secondes', async () => {
    await afficher();

    await saisir(CHAMP_ALLURE, '4:30');

    expect(mockUpsert).toHaveBeenCalledWith({ ref5kPaceSPerKm: 270 });
  });

  it.each(['abc', '4:99', '', '430'])('🔴 « %s » n’écrit rien', async (saisie) => {
    await afficher();

    await saisir(CHAMP_ALLURE, saisie);

    // `4:99` n'existe pas ; `430` est ambigu (7 min 10 ou 4 min 30 ?). Deviner à la place de
    // l'utilisateur produirait une référence fausse dont il ne verrait jamais l'origine.
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('🔴 la saisie LOCALE prime sur la valeur persistée', async () => {
    await afficher({ runnerProfile: { ref5kPaceSPerKm: 270 } });
    expect(screen.getByLabelText(CHAMP_ALLURE).props.value).toBe('4:30');

    await saisir(CHAMP_ALLURE, '4:1');

    // Sans cet état local, PowerSync réécrirait le champ à chaque flush — sous les doigts de
    // l'utilisateur, au milieu de sa frappe.
    expect(screen.getByLabelText(CHAMP_ALLURE).props.value).toBe('4:1');
  });

  it('🔴 l’unité est dans le LIBELLÉ et le placeholder suit le système', async () => {
    await afficher({ system: 'imperial' });

    // Une allure « 4:30 » ne veut pas dire la même chose au kilomètre et au mile : sans l'unité,
    // l'écart est de 60 %.
    expect(screen.getByLabelText('running.profile.ref5k (/mi)')).toBeTruthy();
    expect(screen.getByLabelText('running.profile.ref5k (/mi)').props.placeholder).toBe(
      'running.profile.ref5kPlaceholderImperial',
    );
  });
});

// ---------------------------------------------------------------------------
// Allures dérivées
// ---------------------------------------------------------------------------

describe('allures d’entraînement', () => {
  it('🔴 sans référence, AUCUNE allure n’est calculée', async () => {
    await afficher();

    // Quatre fourchettes dérivées de rien seraient quatre chiffres faux, présentés comme des
    // consignes d'entraînement.
    expect(screen.getByText('running.profile.pacesEmpty')).toBeTruthy();
    expect(screen.queryByText(/running\.sessionType\./)).toBeNull();
  });

  it('avec une référence, les QUATRE types de séance sont dérivés', async () => {
    await afficher({ runnerProfile: { ref5kPaceSPerKm: 270 } });

    // `sessionTargetPace` est pure (`@wellness/shared`), prise telle quelle. La course libre est
    // exclue : elle n'a pas d'allure cible, par définition.
    for (const type of ['endurance', 'sortie_longue', 'recuperation', 'fractionne']) {
      expect(screen.getByText(`running.sessionType.${type}`)).toBeTruthy();
    }
    expect(screen.queryByText('running.sessionType.course_libre')).toBeNull();
  });

  it('🔴 chaque allure est une FOURCHETTE, pas une valeur unique', async () => {
    await afficher({ runnerProfile: { ref5kPaceSPerKm: 270 } });

    // Une allure unique serait intenable au mètre près ; la fourchette est ce qu'on peut
    // réellement tenir, et elle est formatée par les unités de l'utilisateur.
    expect(screen.getAllByText(/running\.paces\.range.*"min".*"max"/).length).toBe(4);
  });

  it('l’endurance est plus LENTE que la référence', async () => {
    await afficher({ runnerProfile: { ref5kPaceSPerKm: 270 } });

    // Référence 4:30 → endurance 5:30–6:00. Une endurance plus rapide que l'allure 5 km serait
    // une consigne dangereuse, et le signe d'une conversion inversée.
    expect(screen.getByText(/"min":"5:30","max":"6:00"/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Annonces vocales
// ---------------------------------------------------------------------------

describe('annonces vocales', () => {
  it('🔴 éteintes par défaut sur un profil ABSENT (R1)', async () => {
    await afficher();

    // Une voix qui se met à parler seule pendant la première course serait la pire des surprises.
    expect(
      screen.getByLabelText('running.profile.announcementsToggle').props.value,
    ).toBe(false);
  });

  it('🔴 le sélecteur d’intervalle n’existe QUE si les annonces sont actives', async () => {
    await afficher();
    expect(screen.queryByText('running.profile.announcementsInterval')).toBeNull();

    await afficher({ runnerProfile: { voiceAnnouncementsEnabled: true } });

    // Régler la fréquence d'annonces éteintes est un réglage sans objet, sur un écran déjà long.
    expect(screen.getByText('running.profile.announcementsInterval')).toBeTruthy();
  });

  it('activer les annonces écrit le réglage', async () => {
    await afficher();

    await basculer('running.profile.announcementsToggle', true);

    expect(mockUpsert).toHaveBeenCalledWith({ voiceAnnouncementsEnabled: true });
  });

  it('🔴 l’intervalle par défaut est le kilomètre', async () => {
    await afficher({ runnerProfile: { voiceAnnouncementsEnabled: true } });

    // C'est la maille à laquelle on pense sa course : 500 m serait bavard, 2 km trop rare pour
    // corriger son allure.
    const kilometre = screen.getByText('1 km').parent;
    expect(kilometre?.props.accessibilityState?.selected).toBe(true);
  });

  it('🔴 les intervalles sont libellés dans l’unité qui se lit', async () => {
    await afficher({ runnerProfile: { voiceAnnouncementsEnabled: true } });

    // « 500 m » et « 1 km » plutôt que « 500 » et « 1000 » : un nombre nu ne dit pas si l'on
    // parle de mètres ou de secondes.
    expect(screen.getByText('500 m')).toBeTruthy();
    expect(screen.getByText('2 km')).toBeTruthy();
  });

  it('choisir un intervalle l’écrit en MÈTRES', async () => {
    await afficher({ runnerProfile: { voiceAnnouncementsEnabled: true } });

    await taper(screen.getByText('2 km'));

    // L'affichage est en kilomètres, le stockage en mètres : écrire « 2 » ferait annoncer tous
    // les deux mètres.
    expect(mockUpsert).toHaveBeenCalledWith({ voiceAnnouncementIntervalM: 2000 });
  });
});

// ---------------------------------------------------------------------------
// Guidage fractionné
// ---------------------------------------------------------------------------

describe('guidage fractionné', () => {
  it('🔴 éteint par défaut, et INDÉPENDANT des annonces (R3)', async () => {
    await afficher({ runnerProfile: { voiceAnnouncementsEnabled: true } });

    // Deux besoins distincts : suivre son allure au kilomètre, et être guidé dans un fractionné.
    // Les lier obligerait à subir l'un pour avoir l'autre.
    expect(
      screen.getByLabelText('running.profile.intervalGuidanceToggle').props.value,
    ).toBe(false);
  });

  it('activer le guidage n’active pas les annonces', async () => {
    await afficher();

    await basculer('running.profile.intervalGuidanceToggle', true);

    expect(mockUpsert).toHaveBeenCalledWith({ intervalGuidanceEnabled: true });
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('le retour referme l’écran', async () => {
    await afficher();

    await taper(screen.getByLabelText('common.back'));

    expect(back).toHaveBeenCalled();
  });
});
