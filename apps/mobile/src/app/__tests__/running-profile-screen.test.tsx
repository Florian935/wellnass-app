/**
 * Profil coureur (`app/running-profile.tsx`) — le **vrai** écran, monté.
 *
 * L'un des **deux derniers écrans à 0 %** (44 instructions). Il fixe l'**allure de référence 5 km**,
 * dont dérivent toutes les allures cibles de l'app — programmes, planning, détail de séance. Une
 * erreur ici ne se voit pas ici : elle se voit dans une fourchette d'allure fausse, trois écrans
 * plus loin.
 *
 *  1. **L'allure de référence ne se saisit plus ici** (US CARDIO-02, D8) : la carte dit la valeur,
 *     d'où elle vient, et mène aux quatre portes (`/running-pace`). L'ancien champ écrivait à chaque
 *     frappe lisible, sans rien montrer de ce qu'il produisait.
 *  2. **La provenance est déduite** : égale au record 5 km ÷ 5, elle vient du record ; sinon, du coureur.
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
import { useRunningRecords } from '@/data/repositories/running-record-repository';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// US CARDIO-UX02 — chaque écran du pilier déclare désormais sa couleur (`useMenuFocus`). Le hook
// s'appuie sur `useFocusEffect`, absent des mocks d'`expo-router` de ces fichiers : on le neutralise
// ici, comme le font déjà les quatre tests d'onglet.
jest.mock('@/hooks/useMenuFocus', () => ({ useMenuFocus: jest.fn() }));

jest.mock('@/data/repositories/running-profile-repository', () => ({
  useRunnerProfile: jest.fn(() => ({ runnerProfile: null })),
  upsertRunnerProfile: jest.fn(),
}));
jest.mock('@/data/repositories/running-record-repository', () => ({
  useRunningRecords: jest.fn(() => ({ records: [], isLoading: false })),
}));

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
const mockRecords = useRunningRecords as jest.Mock;
const push = jest.fn();
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

const basculer = async (label: string, valeur: boolean) => {
  await act(async () => {
    fireEvent(screen.getByLabelText(label), 'valueChange', valeur);
  });
};

/** Une option de liste verticale, retrouvée par son libellé. */
const option = (cle: string) => screen.getByText(cle).parent!;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ back, push });
  mockUpsert.mockResolvedValue(undefined);
  mockRecords.mockReturnValue({ records: [], isLoading: false });
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

describe('allure de référence — la carte (US CARDIO-02, D8)', () => {
  it('🔴 l’écran ne la saisit plus : aucun champ, aucune écriture', async () => {
    await afficher({ runnerProfile: { ref5kPaceSPerKm: 270 } });

    // L'ancien champ écrivait à chaque frappe lisible, sans montrer ce qu'il produisait (F2).
    expect(screen.queryByLabelText(/running.profile.ref5k/)).toBeNull();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('sans allure : la carte le dit, et « La donner » ouvre les portes', async () => {
    await afficher();

    expect(screen.getByText('running.refPace.card.emptyTitle')).toBeTruthy();
    await taper(screen.getByTestId('ref-card-change'));
    expect(push).toHaveBeenCalledWith('/running-pace');
  });

  it('avec une allure donnée : la valeur, « Donnée par toi », et « Changer »', async () => {
    await afficher({ runnerProfile: { ref5kPaceSPerKm: 270 } });

    expect(screen.getByTestId('ref-card-value').props.children).toBe('4:30');
    expect(screen.getByText('running.refPace.origin.declared')).toBeTruthy();
    expect(screen.getByText('running.refPace.card.change')).toBeTruthy();
  });

  it('🔴 égale au record 5 km ÷ 5, elle vient du record — provenance déduite, jamais stockée', async () => {
    mockRecords.mockReturnValue({
      records: [{ distanceKey: '5k', bestTimeSeconds: 1350, runId: 'r1', achievedAt: '2026-10-12T08:00:00Z' }],
      isLoading: false,
    });
    await afficher({ runnerProfile: { ref5kPaceSPerKm: 270 } });

    expect(screen.getByTestId('ref-card-origin').props.children).toMatch(/running.refPace.origin.record.*"time":"22:30"/);
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
    expect(screen.getByText('running.refPace.card.emptyBody')).toBeTruthy();
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

  it('🔴 plus de bouton « Retour » en pied : la flèche de l’en-tête suffit (F39)', async () => {
    await afficher();

    expect(screen.queryByLabelText('common.back')).toBeNull();
    expect(screen.queryByText('common.back')).toBeNull();
  });
});
