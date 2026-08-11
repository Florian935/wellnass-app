/**
 * US CYCLE-01 — section « Suivi du cycle » des Réglages (`components/CycleTrackingSection`).
 *
 * Fichier à **0 %** avant ce test, alors que c'est un des rares endroits de l'app où une erreur
 * coûte des **données de santé** — catégorie spéciale au sens du RGPD, et l'un des six types
 * déclarés à Google Play.
 *
 * Les quatre règles qui portent le risque :
 *
 *  1. **Désactiver n'efface PAS** (R17). L'extinction propose la suppression, ne l'impose pas :
 *     garder ses données tout en masquant la fonctionnalité est un choix valide, et ce qui est
 *     gardé reste dans l'export RGPD. Une suppression automatique serait irrattrapable.
 *  2. **Le réglage est coupé AVANT la question.** L'ordre inverse laisserait le widget affiché
 *     derrière la boîte de dialogue, comme si l'extinction n'avait pas pris.
 *  3. **La permission système d'abord, le réglage ensuite** (R20). Poser le réglage à ON puis
 *     découvrir le refus laisserait un interrupteur allumé qui ne synchronise rien.
 *  4. **Le second interrupteur n'existe que si le premier est actif** — proposer une synchro pour
 *     une fonctionnalité éteinte n'a pas de sens.
 *
 * Aucun filtre sur `profiles.sex` n'est testé ici parce qu'il n'en existe aucun : arbitrage du
 * 30/07/2026, un filtre sur le sexe déclaré exclurait sans recours les profils « non précisé ».
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { CycleTrackingSection } from '../CycleTrackingSection';
import { updateSettings } from '@/data/repositories/settings-repository';
import { deleteAllCycleData } from '@/data/repositories/menstrual-cycle-repository';
import { importCycleData, pushCycleData, requestCyclePermissions } from '@/lib/health-connect';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/settings-repository', () => ({ updateSettings: jest.fn() }));
jest.mock('@/data/repositories/menstrual-cycle-repository', () => ({
  deleteAllCycleData: jest.fn(),
}));
jest.mock('@/lib/health-connect', () => ({
  DEFAULT_WINDOW_DAYS: 30,
  requestCyclePermissions: jest.fn(),
  pushCycleData: jest.fn(),
  importCycleData: jest.fn(),
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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      accent: '#c0562f',
      danger: '#b23b2e',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockUpdate = updateSettings as jest.Mock;
const mockDelete = deleteAllCycleData as jest.Mock;
const mockPermissions = requestCyclePermissions as jest.Mock;
const mockPush = pushCycleData as jest.Mock;
const mockImport = importCycleData as jest.Mock;

let boutonsAlerte: { text?: string; style?: string; onPress?: () => void }[] = [];

const afficher = async (enabled = false, healthConnectEnabled = false) =>
  render(
    <CycleTrackingSection enabled={enabled} healthConnectEnabled={healthConnectEnabled} />,
  );

const basculer = async (label: string, valeur: boolean) => {
  await act(async () => {
    fireEvent(screen.getByLabelText(label), 'valueChange', valeur);
  });
};

const taperAlerte = async (texte: string) => {
  await act(async () => {
    boutonsAlerte.find((b) => b.text === texte)?.onPress?.();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  boutonsAlerte = [];
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, boutons) => {
    boutonsAlerte = (boutons ?? []) as typeof boutonsAlerte;
  });
  mockUpdate.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
  mockPermissions.mockResolvedValue(true);
  mockPush.mockResolvedValue(undefined);
  mockImport.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Opt-in
// ---------------------------------------------------------------------------

describe('opt-in du suivi', () => {
  it('éteint, la section n’affiche que l’interrupteur principal et l’avertissement', async () => {
    await afficher(false);

    expect(screen.getByLabelText('cycle.settings.toggle')).toBeTruthy();
    expect(screen.getByText('cycle.disclaimer')).toBeTruthy();
    // Ni synchro ni suppression tant que rien n'est activé : il n'y a rien à synchroniser, rien
    // à effacer, et deux commandes inertes de plus dans un écran de réglages déjà long.
    expect(screen.queryByLabelText('cycle.settings.healthConnect')).toBeNull();
    expect(screen.queryByLabelText('cycle.settings.deleteAll')).toBeNull();
  });

  it('activer écrit le réglage, SANS boîte de dialogue', async () => {
    await afficher(false);

    await basculer('cycle.settings.toggle', true);

    expect(mockUpdate).toHaveBeenCalledWith({ cycleTrackingEnabled: true });
    // Activer est réversible et n'engage aucune donnée : une confirmation ici serait du bruit.
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('activé, la synchro et la suppression apparaissent', async () => {
    await afficher(true);

    expect(screen.getByLabelText('cycle.settings.healthConnect')).toBeTruthy();
    expect(screen.getByLabelText('cycle.settings.deleteAll')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Extinction
// ---------------------------------------------------------------------------

describe('extinction', () => {
  it('🔴 coupe les DEUX réglages AVANT de poser la question', async () => {
    await afficher(true, true);

    await basculer('cycle.settings.toggle', false);

    // La synchro Health Connect est coupée avec le suivi : la laisser active alimenterait un hub
    // externe pour une fonctionnalité que l'utilisateur vient d'éteindre.
    expect(mockUpdate).toHaveBeenCalledWith({
      cycleTrackingEnabled: false,
      cycleHealthConnectEnabled: false,
    });
    // L'ordre compte : demander d'abord laisserait le widget affiché derrière la boîte de dialogue,
    // comme si l'extinction n'avait pas pris.
    expect(mockUpdate.mock.invocationCallOrder[0]!).toBeLessThan(
      (Alert.alert as jest.Mock).mock.invocationCallOrder[0]!,
    );
  });

  it('🔴 « garder mes données » n’efface RIEN (R17)', async () => {
    await afficher(true);

    await basculer('cycle.settings.toggle', false);
    await taperAlerte('cycle.settings.keepData');

    // Garder ses données tout en masquant la fonctionnalité est un choix valide — et ce qui est
    // gardé reste inclus dans l'export RGPD.
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('🔴 fermer la boîte sans choisir n’efface rien non plus', async () => {
    await afficher(true);

    await basculer('cycle.settings.toggle', false);

    // Aucun `onPress` déclenché : l'utilisateur a balayé la boîte. Une suppression par défaut sur
    // une donnée de santé serait irrattrapable.
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('« supprimer » efface, et seulement sur cette confirmation', async () => {
    await afficher(true);

    await basculer('cycle.settings.toggle', false);
    await taperAlerte('cycle.settings.deleteData');

    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('🔴 la suppression est proposée en style DESTRUCTIF, la conservation en annulation', async () => {
    await afficher(true);

    await basculer('cycle.settings.toggle', false);

    // Sur Android comme sur iOS, c'est le seul signal visuel qui distingue les deux issues ; sans
    // lui, effacer et garder se ressemblent.
    expect(boutonsAlerte.find((b) => b.text === 'cycle.settings.deleteData')?.style).toBe(
      'destructive',
    );
    expect(boutonsAlerte.find((b) => b.text === 'cycle.settings.keepData')?.style).toBe('cancel');
  });
});

// ---------------------------------------------------------------------------
// Suppression explicite
// ---------------------------------------------------------------------------

describe('suppression explicite', () => {
  it('demande confirmation avant d’effacer', async () => {
    await afficher(true);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('cycle.settings.deleteAll'));
    });

    expect(mockDelete).not.toHaveBeenCalled();
    await taperAlerte('cycle.settings.deleteData');
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('annuler n’efface rien', async () => {
    await afficher(true);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('cycle.settings.deleteAll'));
    });
    await taperAlerte('cycle.settings.cancel');

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('🔴 effacer les données ne coupe PAS le suivi', async () => {
    await afficher(true);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('cycle.settings.deleteAll'));
    });
    await taperAlerte('cycle.settings.deleteData');

    // Repartir de zéro sans quitter la fonctionnalité est le cas d'usage exact de ce bouton.
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Synchro Health Connect
// ---------------------------------------------------------------------------

describe('synchro Health Connect', () => {
  it('🔴 demande la permission AVANT d’écrire le réglage', async () => {
    await afficher(true, false);

    await basculer('cycle.settings.healthConnect', true);

    expect(mockPermissions).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({ cycleHealthConnectEnabled: true });
    // Poser le réglage à ON puis découvrir le refus laisserait un interrupteur allumé qui ne
    // synchronise rien — l'utilisateur croirait ses données partagées.
    expect(mockPermissions.mock.invocationCallOrder[0]!).toBeLessThan(
      mockUpdate.mock.invocationCallOrder[0]!,
    );
  });

  it('🔴 un refus n’active RIEN et le dit', async () => {
    mockPermissions.mockResolvedValue(false);
    await afficher(true, false);

    await basculer('cycle.settings.healthConnect', true);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockImport).not.toHaveBeenCalled();
    expect(screen.getByText('cycle.settings.healthConnectDenied')).toBeTruthy();
  });

  it('🔴 l’activation fait un aller-RETOUR complet, pas seulement un envoi', async () => {
    await afficher(true, false);

    await basculer('cycle.settings.healthConnect', true);

    // Sans le push, ce qui est déjà saisi dans l'app n'arriverait jamais dans le hub ; sans
    // l'import, ce qui existe déjà dans le hub resterait invisible. Les deux, ou la synchro
    // paraît ne fonctionner que dans un sens.
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockImport).toHaveBeenCalledWith(30);
  });

  it('couper la synchro écrit le réglage sans toucher aux permissions', async () => {
    await afficher(true, true);

    await basculer('cycle.settings.healthConnect', false);

    expect(mockUpdate).toHaveBeenCalledWith({ cycleHealthConnectEnabled: false });
    // Révoquer une permission système ne se fait pas depuis l'app : la redemander pour la couper
    // rouvrirait la boîte système au pire moment.
    expect(mockPermissions).not.toHaveBeenCalled();
  });

  it('🔴 couper la synchro efface le bandeau de refus', async () => {
    mockPermissions.mockResolvedValue(false);
    await afficher(true, false);

    await basculer('cycle.settings.healthConnect', true);
    expect(screen.getByText('cycle.settings.healthConnectDenied')).toBeTruthy();

    await basculer('cycle.settings.healthConnect', false);

    // Un bandeau « permission refusée » qui survit à l'extinction de la synchro décrit un état
    // qui n'existe plus.
    expect(screen.queryByText('cycle.settings.healthConnectDenied')).toBeNull();
  });
});
