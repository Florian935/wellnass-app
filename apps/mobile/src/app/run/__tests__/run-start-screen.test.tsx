/**
 * Démarrage d'une course (`app/run/index.tsx`) — le **vrai** écran, monté.
 *
 * Écran à **0 %** avant ce fichier. Il portait le **dix-septième site** du défaut de double appui,
 * corrigé le 14/08/2026 : deux appuis du même cycle créaient **deux courses**, avec le suivi GPS
 * rattaché à une seule des deux. Le correctif avait été livré sans test — cette dette est close ici,
 * et le test a été vu rouge avant le verrou.
 *
 * Le reste porte le vrai risque de l'écran : **la course est créée AVANT que la permission GPS ne
 * soit connue.** C'est nécessaire (le tracker a besoin d'un identifiant de course pour démarrer),
 * et ça crée une fenêtre où une ligne `runs` existe sans suivi possible. Les trois issues sont
 * testées :
 *
 *  1. **Permission accordée** → on navigue vers le suivi.
 *  2. **Refus AVANT-PLAN** → on ne navigue **pas**, et on propose deux sorties : annuler la course,
 *     ou continuer en manuel. Les deux **annulent la ligne GPS créée** — sans quoi elle resterait
 *     ouverte pour toujours, et l'app proposerait de « reprendre » une course qui n'a jamais existé.
 *  3. **Refus ARRIÈRE-PLAN seul** → on continue (R1) : le suivi avant-plan fonctionne, l'écran de
 *     course reste utilisable tant que le téléphone est allumé.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import RunStartScreen from '../index';
import { cancelRun, startRun, useActiveRun } from '@/data/repositories/run-repository';
import { startTracking } from '@/running/tracker';
import { powerSync } from '@/powersync/system';
import { useLocalSearchParams, useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/run-repository', () => ({
  useActiveRun: jest.fn(() => ({ run: null, isLoading: false })),
  startRun: jest.fn(),
  cancelRun: jest.fn(),
}));
jest.mock('@/running/tracker', () => ({ startTracking: jest.fn() }));
jest.mock('@/powersync/system', () => ({
  powerSync: { getOptional: jest.fn() },
  connector: {},
}));

jest.mock('@/components/Screen', () => {
  const { View } = require('react-native');
  return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/ScreenHeader', () => {
  const { Text } = require('react-native');
  return { ScreenHeader: ({ title }: { title: string }) => <Text>{title}</Text> };
});
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

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({})),
}));

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
      surface: '#fffaf2',
      border: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockActiveRun = useActiveRun as jest.Mock;
const mockStartRun = startRun as jest.Mock;
const mockCancelRun = cancelRun as jest.Mock;
const mockStartTracking = startTracking as jest.Mock;
const mockGetOptional = (powerSync as unknown as { getOptional: jest.Mock }).getOptional;
const mockParams = useLocalSearchParams as unknown as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();

const afficher = async ({
  active = null as Record<string, unknown> | null,
  isLoading = false,
  params = {} as Record<string, string>,
} = {}) => {
  mockActiveRun.mockReturnValue({ run: active, isLoading });
  mockParams.mockReturnValue(params);
  await render(<RunStartScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const demarrer = async () => {
  await taper(screen.getByLabelText('running.start.startCta'));
};

/** Bascule sur le mode sans GPS. */
const choisirManuel = async () => {
  await taper(screen.getByText('running.start.manualMode'));
};

let boutonsAlerte: { text?: string; style?: string; onPress?: () => void }[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  boutonsAlerte = [];
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, boutons) => {
    boutonsAlerte = (boutons ?? []) as typeof boutonsAlerte;
  });
  mockUseRouter.mockReturnValue({ push });
  mockStartRun.mockResolvedValue('run-1');
  mockCancelRun.mockResolvedValue(undefined);
  mockStartTracking.mockResolvedValue({ ok: true });
  mockGetOptional.mockResolvedValue({ started_at: '2026-08-14T09:00:00.000Z' });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Course déjà active
// ---------------------------------------------------------------------------

describe('course déjà active', () => {
  it('un chargement n’affiche ni reprise ni démarrage', async () => {
    await afficher({ isLoading: true });

    // Proposer « démarrer » avant de savoir qu'une course tourne déjà mènerait à en créer une
    // seconde — le repository est idempotent, mais l'utilisateur ne le sait pas.
    expect(screen.queryByLabelText('running.start.startCta')).toBeNull();
    expect(screen.queryByLabelText('running.resume.cta')).toBeNull();
  });

  it('🔴 une course active REMPLACE le démarrage par une reprise', async () => {
    await afficher({ active: { id: 'run-en-cours' } });

    expect(screen.getByText('running.resume.title')).toBeTruthy();
    expect(screen.queryByLabelText('running.start.startCta')).toBeNull();
    // Le choix de mode disparaît aussi : il ne s'applique qu'à une course qu'on va créer.
    expect(screen.queryByText('running.start.gpsMode')).toBeNull();
  });

  it('reprendre ouvre le suivi sans rien créer', async () => {
    await afficher({ active: { id: 'run-en-cours' } });

    await taper(screen.getByLabelText('running.resume.cta'));

    expect(mockStartRun).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/run/active');
  });
});

// ---------------------------------------------------------------------------
// Choix du mode
// ---------------------------------------------------------------------------

describe('choix du mode', () => {
  it('le GPS est le mode par défaut', async () => {
    await afficher();

    await demarrer();

    // C'est l'usage principal : imposer un choix avant chaque course ajouterait un geste à
    // l'action la plus fréquente du pilier.
    expect(mockStartRun).toHaveBeenCalledWith('gps', undefined);
  });

  it('le mode manuel est transmis au démarrage', async () => {
    await afficher();

    await choisirManuel();
    await demarrer();

    expect(mockStartRun).toHaveBeenCalledWith('manual', undefined);
  });

  it('🔴 en mode manuel, AUCUN suivi GPS n’est lancé', async () => {
    await afficher();

    await choisirManuel();
    await demarrer();

    // Demander la localisation pour une course saisie à la main serait une permission réclamée
    // sans raison — et le refus bloquerait un mode qui n'en a pas besoin.
    expect(mockStartTracking).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/run/active');
  });

  it('🔴 une séance PLANIFIÉE est rattachée à la course', async () => {
    await afficher({ params: { plannedSessionId: 'ps-1' } });

    await demarrer();

    // Sans ce rattachement, la case du planning resterait « planifiée » après la course — même
    // règle que côté musculation.
    expect(mockStartRun).toHaveBeenCalledWith('gps', 'ps-1');
  });
});

// ---------------------------------------------------------------------------
// Le verrou
// ---------------------------------------------------------------------------

describe('démarrage', () => {
  it('🔴 deux appuis dans le MÊME cycle ne créent qu’UNE course', async () => {
    let resoudre: ((id: string) => void) | undefined;
    mockStartRun.mockReturnValue(new Promise<string>((r) => (resoudre = r)));
    await afficher();

    const b = screen.getByLabelText('running.start.startCta');
    await act(async () => {
      fireEvent.press(b);
      fireEvent.press(b);
    });

    // Dix-septième site du défaut du 08/08/2026 : sans le verrou, deux courses créées — dont une
    // orpheline — et le suivi GPS rattaché à une seule des deux.
    expect(mockStartRun).toHaveBeenCalledTimes(1);
    resoudre?.('run-1');
  });

  it('🔴 le tracker part de l’heure de la course EN BASE, pas de l’heure courante', async () => {
    mockGetOptional.mockResolvedValue({ started_at: '2026-08-14T09:00:00.000Z' });
    await afficher();

    await demarrer();

    // La base est la source de vérité : prendre l'horloge du téléphone ferait démarrer le chrono
    // avec un décalage égal au temps d'écriture, et les allures du premier kilomètre seraient fausses.
    expect(mockStartTracking).toHaveBeenCalledWith(
      'run-1',
      new Date('2026-08-14T09:00:00.000Z').getTime(),
      { autoPause: true },
    );
  });

  it('🔴 une course introuvable en base retombe sur l’heure courante', async () => {
    mockGetOptional.mockResolvedValue(null);
    await afficher();

    await demarrer();

    // Repli plutôt qu'échec : mieux vaut un chrono décalé de quelques millisecondes qu'une course
    // qui refuse de démarrer parce qu'une lecture a échoué.
    const [, startedAtMs] = mockStartTracking.mock.calls[0]!;
    expect(typeof startedAtMs).toBe('number');
    expect(push).toHaveBeenCalledWith('/run/active');
  });

  it('une permission accordée ouvre le suivi', async () => {
    await afficher();

    await demarrer();

    expect(push).toHaveBeenCalledWith('/run/active');
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Permissions refusées
// ---------------------------------------------------------------------------

describe('permission refusée', () => {
  const refusAvantPlan = () =>
    mockStartTracking.mockResolvedValue({ ok: false, reason: 'foreground-denied' });

  it('🔴 un refus AVANT-PLAN ne navigue PAS vers le suivi', async () => {
    refusAvantPlan();
    await afficher();

    await demarrer();

    // Ouvrir l'écran de course sans localisation afficherait un suivi qui n'avance jamais :
    // l'utilisateur courrait dix minutes pour rien.
    expect(push).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalled();
  });

  it('🔴 il propose DEUX sorties, jamais un cul-de-sac', async () => {
    refusAvantPlan();
    await afficher();

    await demarrer();

    expect(boutonsAlerte.map((b) => b.text)).toEqual([
      'running.permission.cancelRun',
      'running.permission.continueManual',
    ]);
  });

  it('🔴 annuler ANNULE la ligne GPS déjà créée', async () => {
    refusAvantPlan();
    await afficher();

    await demarrer();
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'running.permission.cancelRun')?.onPress?.();
    });

    // La course est créée AVANT que la permission ne soit connue : sans cette annulation, elle
    // resterait ouverte pour toujours, et l'écran proposerait de « reprendre » une course qui
    // n'a jamais démarré.
    expect(mockCancelRun).toHaveBeenCalledWith('run-1');
    expect(push).not.toHaveBeenCalled();
  });

  it('🔴 continuer en manuel annule la course GPS ET en crée une nouvelle', async () => {
    refusAvantPlan();
    await afficher();

    await demarrer();
    await act(async () => {
      await boutonsAlerte.find((b) => b.text === 'running.permission.continueManual')?.onPress?.();
    });

    // Réutiliser la ligne GPS laisserait une course marquée « gps » sans le moindre point : l'écran
    // de suivi y chercherait un signal indisponible au lieu d'afficher le chrono.
    expect(mockCancelRun).toHaveBeenCalledWith('run-1');
    expect(mockStartRun).toHaveBeenLastCalledWith('manual', undefined);
    expect(push).toHaveBeenCalledWith('/run/active');
  });

  it('🔴 le repli manuel conserve la séance planifiée', async () => {
    refusAvantPlan();
    await afficher({ params: { plannedSessionId: 'ps-1' } });

    await demarrer();
    await act(async () => {
      await boutonsAlerte.find((b) => b.text === 'running.permission.continueManual')?.onPress?.();
    });

    // Perdre le rattachement ici laisserait la case du planning « planifiée » alors que la course
    // a bien eu lieu — et le refus de permission n'a rien à voir avec le planning.
    expect(mockStartRun).toHaveBeenLastCalledWith('manual', 'ps-1');
  });

  it('🔴 un refus ARRIÈRE-PLAN seul ne bloque RIEN (R1)', async () => {
    mockStartTracking.mockResolvedValue({ ok: false, reason: 'background-denied' });
    await afficher();

    await demarrer();

    // Le suivi avant-plan fonctionne : l'écran de course reste utilisable tant que le téléphone
    // est allumé. Bloquer ici priverait de GPS une majorité d'utilisateurs, Android refusant
    // l'arrière-plan par défaut.
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/run/active');
  });
});
