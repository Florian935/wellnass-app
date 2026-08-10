/**
 * Section « Health Connect » des réglages (`components/HealthConnectSection`, US CONF-06).
 *
 * Composant à **0 %** avant ce fichier, et le plus délicat des réglages : il négocie des
 * **permissions système** sur des données de santé, et il est le seul endroit de l'app où l'on
 * écrit dans une base tierce.
 *
 * Quatre règles, toutes vérifiables sans device :
 *
 *  1. **Le réglage est un opt-in strict.** Les permissions ne sont demandées **que** par le tap sur
 *     l'interrupteur — jamais à l'ouverture de l'écran. Ouvrir ses réglages ne doit pas déclencher
 *     une demande d'accès à des données de santé.
 *  2. **Un refus laisse le réglage OFF et l'explique**, sans réessayer. Rien n'est plus hostile
 *     qu'une boîte de permission qui revient à chaque affichage.
 *  3. **L'état est recalculé au retour au premier plan** : les permissions peuvent avoir été
 *     révoquées depuis les réglages système pendant qu'on y était. Sans ça, l'app affirme un
 *     accès qu'elle n'a plus.
 *  4. **Un seul état est rendu à la fois** (spec §2.1), et **rien** tant qu'il n'est pas résolu —
 *     pas de section fantôme qui clignote au milieu des réglages.
 */
import React from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { HealthConnectSection } from '../HealthConnectSection';
import { updateSettings } from '@/data/repositories/settings-repository';
import {
  getLastStepsImportAt,
  getLastSyncReport,
  getLastWeightImportAt,
  getState,
  importSteps,
  importWeight,
  openProviderInstall,
  openSettings,
  pushRecent,
  requestPermissions,
} from '@/lib/health-connect';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/settings-repository', () => ({
  updateSettings: jest.fn(),
}));

jest.mock('@/lib/health-connect', () => ({
  DEFAULT_WINDOW_DAYS: 30,
  getState: jest.fn(),
  getLastWeightImportAt: jest.fn(),
  getLastStepsImportAt: jest.fn(),
  getLastSyncReport: jest.fn(),
  requestPermissions: jest.fn(),
  pushRecent: jest.fn(),
  importWeight: jest.fn(),
  importSteps: jest.fn(),
  openProviderInstall: jest.fn(),
  openSettings: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
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

const mockState = getState as jest.Mock;
const mockLastWeight = getLastWeightImportAt as jest.Mock;
const mockLastSteps = getLastStepsImportAt as jest.Mock;
const mockReport = getLastSyncReport as jest.Mock;
const mockPermissions = requestPermissions as jest.Mock;
const mockPush = pushRecent as jest.Mock;
const mockImportWeight = importWeight as jest.Mock;
const mockImportSteps = importSteps as jest.Mock;
const mockUpdateSettings = updateSettings as jest.Mock;

let appStateListener: ((status: string) => void) | undefined;

/** Rend la section et attend que l'état soit résolu. */
async function afficher(enabled = false) {
  await render(<HealthConnectSection enabled={enabled} />);
  await waitFor(() => expect(mockState).toHaveBeenCalled());
}

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const T = {
  toggle: 'settings.healthConnect.toggle',
  title: 'settings.healthConnect.title',
  denied: 'settings.healthConnect.denied',
  grant: 'settings.healthConnect.grant',
  syncNow: 'settings.healthConnect.syncNow',
  importWeight: 'settings.healthConnect.importWeight',
  importSteps: 'settings.healthConnect.importSteps',
  install: 'settings.healthConnect.install',
  update: 'settings.healthConnect.update',
  openSettings: 'settings.healthConnect.openSettings',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockState.mockResolvedValue('ready');
  mockLastWeight.mockResolvedValue(null);
  mockLastSteps.mockResolvedValue(null);
  mockReport.mockReturnValue(null);
  mockPermissions.mockResolvedValue(true);
  mockPush.mockResolvedValue(3);
  mockImportWeight.mockResolvedValue(5);
  mockImportSteps.mockResolvedValue(7);
  mockUpdateSettings.mockResolvedValue(undefined);
  appStateListener = undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _type: string,
    handler: (status: string) => void,
  ) => {
    appStateListener = handler;
    return { remove: jest.fn() };
  }) as unknown as typeof AppState.addEventListener);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// États du service
// ---------------------------------------------------------------------------

describe('états du service', () => {
  it('🔴 ne rend RIEN tant que l’état n’est pas résolu', async () => {
    mockState.mockReturnValue(new Promise(() => {}));

    const vue = await render(<HealthConnectSection enabled={false} />);

    // Pas de section fantôme qui clignote au milieu des réglages.
    expect(vue.toJSON()).toBeNull();
  });

  it('🔴 hors Android, ne rend RIEN du tout', async () => {
    mockState.mockResolvedValue('unsupported');

    await afficher();

    // Une section grisée « indisponible sur cet appareil » n'apprend rien et allonge un écran déjà
    // long.
    expect(screen.queryByText(T.title)).toBeNull();
  });

  it('🔴 fournisseur absent → on propose de l’INSTALLER, pas un interrupteur mort', async () => {
    mockState.mockResolvedValue('provider_missing');

    await afficher();

    expect(screen.getByText('settings.healthConnect.providerMissing')).toBeTruthy();
    expect(screen.getByText(T.install)).toBeTruthy();
    // Un interrupteur qui ne peut rien activer se lit comme une panne.
    expect(screen.queryByLabelText(T.toggle)).toBeNull();
  });

  it('fournisseur à mettre à jour → on propose la mise à jour', async () => {
    mockState.mockResolvedValue('provider_update_required');

    await afficher();

    expect(screen.getByText('settings.healthConnect.updateRequired')).toBeTruthy();
    await taper(screen.getByText(T.update));
    expect(openProviderInstall).toHaveBeenCalled();
  });

  it('🔴 permissions manquantes → un bouton pour les demander, pas les trois imports', async () => {
    mockState.mockResolvedValue('permissions_missing');

    await afficher();

    // Proposer « importer » sans permission, c'est proposer un bouton qui échouera.
    expect(screen.getByText(T.grant)).toBeTruthy();
    expect(screen.queryByText(T.importWeight)).toBeNull();
  });

  it('prêt → les trois actions manuelles sont proposées', async () => {
    await afficher(true);

    expect(screen.getByText(T.syncNow)).toBeTruthy();
    expect(screen.getByText(T.importWeight)).toBeTruthy();
    expect(screen.getByText(T.importSteps)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Opt-in
// ---------------------------------------------------------------------------

describe('opt-in', () => {
  it('🔴 l’ouverture de l’écran ne demande AUCUNE permission', async () => {
    await afficher();

    // Ouvrir ses réglages ne doit pas déclencher une demande d'accès à des données de santé :
    // c'est le tap sur l'interrupteur, et lui seul, qui la déclenche.
    expect(mockPermissions).not.toHaveBeenCalled();
  });

  it('activer demande les permissions PUIS écrit le réglage', async () => {
    await afficher();

    await act(async () => {
      fireEvent(screen.getByLabelText(T.toggle), 'valueChange', true);
    });

    expect(mockPermissions).toHaveBeenCalled();
    expect(mockUpdateSettings).toHaveBeenCalledWith({ healthConnectEnabled: true });
  });

  it('🔴 un REFUS laisse le réglage OFF et l’explique', async () => {
    mockPermissions.mockResolvedValue(false);
    await afficher();

    await act(async () => {
      fireEvent(screen.getByLabelText(T.toggle), 'valueChange', true);
    });

    // Écrire le réglage à `true` sans permission afficherait « activé » sur une intégration qui
    // ne peut rien faire.
    expect(mockUpdateSettings).not.toHaveBeenCalled();
    expect(screen.getByText(T.denied)).toBeTruthy();
  });

  it('🔴 un refus ne relance PAS la demande', async () => {
    mockPermissions.mockResolvedValue(false);
    await afficher();

    await act(async () => {
      fireEvent(screen.getByLabelText(T.toggle), 'valueChange', true);
    });

    // Rien n'est plus hostile qu'une boîte de permission qui revient toute seule. On explique, et
    // on attend un nouveau geste.
    expect(mockPermissions).toHaveBeenCalledTimes(1);
  });

  it('🔴 activer enchaîne les trois opérations et rend un compte rendu CHIFFRÉ', async () => {
    await afficher();

    await act(async () => {
      fireEvent(screen.getByLabelText(T.toggle), 'valueChange', true);
    });

    // Un « c'est activé » sans chiffres laisse l'utilisateur se demander si quoi que ce soit a
    // transité. Les trois comptes sont affichés ensemble.
    expect(mockPush).toHaveBeenCalledWith(30, expect.any(Object));
    expect(mockImportWeight).toHaveBeenCalledWith(30);
    expect(mockImportSteps).toHaveBeenCalledWith(30);
    expect(screen.getByText(/pushed.*"count":3.*imported.*"count":5.*stepsImported.*"count":7/)).toBeTruthy();
  });

  it('🔴 désactiver n’écrit QUE le réglage — aucun import, aucune permission', async () => {
    await afficher(true);

    await act(async () => {
      fireEvent(screen.getByLabelText(T.toggle), 'valueChange', false);
    });

    expect(mockUpdateSettings).toHaveBeenCalledWith({ healthConnectEnabled: false });
    expect(mockPermissions).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('🔴 désactiver efface le compte rendu précédent', async () => {
    await afficher();

    await act(async () => {
      fireEvent(screen.getByLabelText(T.toggle), 'valueChange', true);
    });
    expect(screen.getByText(/pushed/)).toBeTruthy();

    await act(async () => {
      fireEvent(screen.getByLabelText(T.toggle), 'valueChange', false);
    });

    // Laisser « 3 activités synchronisées » sous un interrupteur éteint ferait croire que la
    // synchro continue.
    expect(screen.queryByText(/pushed/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Actions manuelles
// ---------------------------------------------------------------------------

describe('actions manuelles', () => {
  it('le renvoi manuel rend son décompte', async () => {
    await afficher(true);

    await taper(screen.getByText(T.syncNow));

    // Sûr à répéter (dédup par `clientRecordId`) : c'est le geste qui rattrape une séance non
    // envoyée parce que Health Connect était indisponible à la clôture.
    expect(mockPush).toHaveBeenCalledWith(30, expect.any(Object));
    expect(screen.getByText(/pushed.*"count":3/)).toBeTruthy();
  });

  it('l’import du poids et celui des pas sont deux gestes DISTINCTS', async () => {
    await afficher(true);

    await taper(screen.getByText(T.importWeight));
    expect(mockImportWeight).toHaveBeenCalled();
    expect(mockImportSteps).not.toHaveBeenCalled();

    await taper(screen.getByText(T.importSteps));
    expect(mockImportSteps).toHaveBeenCalled();
  });

  it('🔴 chaque action rafraîchit l’état après coup', async () => {
    await afficher(true);
    const avant = mockState.mock.calls.length;

    await taper(screen.getByText(T.syncNow));

    // Sans ce rafraîchissement, la date du dernier import resterait celle d'avant l'action —
    // l'utilisateur relancerait indéfiniment en croyant que rien ne part.
    expect(mockState.mock.calls.length).toBeGreaterThan(avant);
  });
});

// ---------------------------------------------------------------------------
// Retour au premier plan
// ---------------------------------------------------------------------------

describe('retour au premier plan', () => {
  it('🔴 recalcule l’état quand l’app revient au premier plan', async () => {
    await afficher(true);
    const avant = mockState.mock.calls.length;

    await act(async () => {
      appStateListener?.('active');
    });

    // Les permissions peuvent avoir été révoquées depuis les réglages système pendant qu'on y
    // était : sans ce recalcul, l'app affirme un accès qu'elle n'a plus.
    expect(mockState.mock.calls.length).toBeGreaterThan(avant);
  });

  it('🔴 ne recalcule PAS sur un passage en arrière-plan', async () => {
    await afficher(true);
    const avant = mockState.mock.calls.length;

    await act(async () => {
      appStateListener?.('background');
    });

    // Interroger le service pendant que l'app s'endort ne sert à rien, et consomme au pire moment.
    expect(mockState.mock.calls.length).toBe(avant);
  });
});

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

describe('diagnostic', () => {
  it('🔴 un échec de la dernière tentative est AFFICHÉ, avec son détail technique', async () => {
    mockReport.mockReturnValue({ kind: 'push', error: 'SecurityException: not granted' });

    await afficher(true);

    // Sans ce bandeau, une panne d'écriture est totalement invisible : l'app paraît synchronisée.
    expect(screen.getByText(/lastAttemptFailed.*SecurityException/)).toBeTruthy();
  });

  it('aucun bandeau quand la dernière tentative a réussi', async () => {
    mockReport.mockReturnValue({ kind: 'push', error: null });

    await afficher(true);

    expect(screen.queryByText(/lastAttemptFailed/)).toBeNull();
  });

  it('les dates de dernier import sont affichées quand elles existent', async () => {
    mockLastWeight.mockResolvedValue('2026-08-09T18:30:00.000Z');
    mockLastSteps.mockResolvedValue('2026-08-10T07:00:00.000Z');

    await afficher(true);

    expect(screen.getByText(/lastImport/)).toBeTruthy();
    expect(screen.getByText(/lastStepsImport/)).toBeTruthy();
  });

  it('🔴 aucune ligne de date quand aucun import n’a eu lieu', async () => {
    await afficher(true);

    // « Dernier import : — » se lit comme une panne ; l'absence de ligne se lit comme un début.
    expect(screen.queryByText(/lastImport/)).toBeNull();
  });

  it('le lien vers les réglages système est toujours offert', async () => {
    await afficher(true);

    await taper(screen.getByLabelText(T.openSettings));

    // C'est le seul chemin pour révoquer un accès qu'on a accordé par erreur.
    expect(openSettings).toHaveBeenCalled();
  });
});
