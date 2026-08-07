/**
 * Écran de course en cours (`app/run/active.tsx`) — le **vrai** écran, rendu.
 *
 * Ce fichier ne reconstruit pas une coquille imitant l'écran : il monte le composant exporté par
 * la route et n'isole que les modules natifs. La différence n'est pas cosmétique — une coquille de
 * test valide la copie qu'on vient d'écrire, pas le code qui tourne sur le téléphone.
 *
 * Ce qui est vérifié, et pourquoi :
 *
 *  1. **Le séquencement d'arrêt** `stopTracking → finishRun → navigation`, et son caractère
 *     **best-effort**. Si un échec de `stopTracking` empêchait `finishRun`, la course resterait
 *     « en cours » pour toujours : l'utilisateur ne peut plus en démarrer une autre, et sa sortie
 *     n'apparaît nulle part. C'est l'unique sortie de cet écran — s'y coincer est irréparable
 *     depuis l'app.
 *  2. **La garde de double appui.** Le bouton reste à l'écran pendant l'`await` : deux appuis
 *     clôtureraient deux fois et navigueraient deux fois.
 *  3. **L'état de pause vient du tracker**, jamais d'un état local — sinon l'auto-pause (déclenchée
 *     hors interaction) laisserait le bouton afficher « Pause » alors que le suivi est arrêté.
 *  4. **La comparaison à la cible n'utilise jamais l'horloge murale** (R1 bis) : l'horloge inclut
 *     les pauses. Un objectif de durée serait annoncé atteint pendant que le coureur est arrêté.
 *
 * Les modules natifs (tracker, GPS, voix) sont mockés ; les **fonctions pures** de `@wellness/shared`
 * (`compareToTarget`, `averagePace`, `decodeTrack`) tournent pour de vrai, elles sont testées chez elles.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import RunActiveScreen from '../active';
import { finishRun, useActiveRun, useRunTarget } from '@/data/repositories/run-repository';
import { stopTracking, pauseTracking, resumeTracking } from '@/running/tracker';
import { getPaused, subscribePaused } from '@/running/tracker-task';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks — uniquement ce qui ne peut pas tourner hors device
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/run-repository', () => ({
  useActiveRun: jest.fn(() => ({ run: null, isLoading: false })),
  useRunTarget: jest.fn(() => null),
  useIntervalBlocksForRun: jest.fn(() => ({ sessionType: null, blocks: [] })),
  finishRun: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/data/repositories/running-profile-repository', () => ({
  useRunnerProfile: jest.fn(() => ({ runnerProfile: null, isLoading: false })),
}));

// Émetteur de pause du tracker : c'est la source de vérité de l'écran, on la pilote.
jest.mock('@/running/tracker-task', () => ({
  getPaused: jest.fn(() => false),
  subscribePaused: jest.fn(() => jest.fn()),
}));

// Voix et vibration : hooks à effets natifs, sans intérêt ici et testés ailleurs.
jest.mock('@/running/announcements', () => ({ useDistanceAnnouncements: jest.fn() }));
jest.mock('@/running/interval-guidance', () => ({ useIntervalGuidance: jest.fn() }));

// Carte (Mapbox/MapLibre) et bandeau de synchro : rendus natifs, hors sujet.
jest.mock('@/components/running/RouteMap', () => ({ RouteMap: () => null }));
jest.mock('@/components/SyncStatus', () => ({ SyncStatus: () => null }));

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
      background: '#f7eede',
      surface: '#fffaf2',
      border: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
      success: '#7c8a5b',
      danger: '#b23b2e',
    },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    system: 'metric',
    distanceSymbol: 'km',
    formatDistance: (km: number | null | undefined) => (km == null ? '—' : `${km.toFixed(2)} km`),
    formatDistanceValue: (km: number | null | undefined) => (km == null ? '—' : km.toFixed(2)),
    formatPace: (s: number | null | undefined) => (s == null ? '—' : `${s} s/km`),
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockUseActiveRun = useActiveRun as jest.Mock;
const mockUseRunTarget = useRunTarget as jest.Mock;
const mockFinishRun = finishRun as jest.Mock;
const mockStopTracking = stopTracking as jest.Mock;
const mockPauseTracking = pauseTracking as jest.Mock;
const mockResumeTracking = resumeTracking as jest.Mock;
const mockGetPaused = getPaused as jest.Mock;
const mockSubscribePaused = subscribePaused as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const replace = jest.fn();

/** Une course GPS en cours, sur laquelle le tracker a déjà flushé une fois. */
const courseGps = (overrides: Record<string, unknown> = {}) => ({
  id: 'run-1',
  source: 'gps',
  startedAt: '2026-08-07T08:00:00.000Z',
  distanceM: 3200,
  durationSeconds: 900,
  gpsTrack: null,
  plannedSessionId: null,
  intervalPhaseIndex: null,
  intervalPhaseStartDistanceM: null,
  intervalPhaseStartDurationS: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ replace });
  mockUseActiveRun.mockReturnValue({ run: courseGps(), isLoading: false });
  mockUseRunTarget.mockReturnValue(null);
  mockGetPaused.mockReturnValue(false);
  mockSubscribePaused.mockReturnValue(jest.fn());
  mockStopTracking.mockResolvedValue(undefined);
  mockFinishRun.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// États d'écran
// ---------------------------------------------------------------------------

describe('états d’écran', () => {
  it('pendant le chargement, ne rend ni contenu ni état vide', async () => {
    mockUseActiveRun.mockReturnValue({ run: null, isLoading: true });

    await render(<RunActiveScreen />);

    // Afficher « course terminée » le temps d'une requête ferait clignoter un faux message
    // d'erreur au retour sur l'écran depuis l'arrière-plan.
    expect(screen.queryByText('running.active.ended')).toBeNull();
  });

  it('🔴 sans course active, EXPLIQUE avant de proposer la sortie', async () => {
    mockUseActiveRun.mockReturnValue({ run: null, isLoading: false });

    await render(<RunActiveScreen />);

    // Constat de recette device du 30/07/2026 : un bouton « Retour » seul au milieu d'un écran
    // vide se lit comme un plantage.
    expect(screen.getByText('running.active.ended')).toBeTruthy();
    expect(screen.getByText('common.back')).toBeTruthy();
  });

  it('en GPS, affiche les deux allures', async () => {
    await render(<RunActiveScreen />);

    expect(screen.getByText('running.active.avgPace')).toBeTruthy();
    expect(screen.getByText('running.active.instantPace')).toBeTruthy();
  });

  it('en manuel, n’affiche aucune allure ni bouton de pause', async () => {
    mockUseActiveRun.mockReturnValue({ run: courseGps({ source: 'manual' }), isLoading: false });

    await render(<RunActiveScreen />);

    // Sans trace GPS, une allure serait inventée — et une pause n'a rien à mettre en pause.
    expect(screen.queryByText('running.active.avgPace')).toBeNull();
    expect(screen.queryByText('running.active.pause')).toBeNull();
  });

  it('en GPS sans point reçu, annonce la recherche de signal', async () => {
    await render(<RunActiveScreen />);

    expect(screen.getByText('running.active.gpsSearching')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Arrêt de la course — le séquencement critique
// ---------------------------------------------------------------------------

describe('arrêt de la course', () => {
  const appuyerSurStop = async () => {
    await render(<RunActiveScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('running.active.stop'));
    });
  };

  it('arrête le tracker AVANT de clôturer, puis navigue vers le résumé', async () => {
    await appuyerSurStop();

    // L'ordre compte : un flush tardif après clôture réécrirait une course terminée.
    expect(mockStopTracking).toHaveBeenCalled();
    expect(mockFinishRun).toHaveBeenCalledWith('run-1');
    const [ordreStop] = mockStopTracking.mock.invocationCallOrder;
    const [ordreFinish] = mockFinishRun.mock.invocationCallOrder;
    expect(ordreStop).toBeLessThan(ordreFinish as number);
    expect(replace).toHaveBeenCalledWith({ pathname: '/run/summary', params: { id: 'run-1' } });
  });

  it('🔴 clôture et navigue MÊME si stopTracking échoue', async () => {
    mockStopTracking.mockRejectedValue(new Error('GPS injoignable'));

    await appuyerSurStop();

    // Sans ce best-effort, une panne du module natif laisse la course « en cours » pour toujours :
    // impossible d'en démarrer une autre, et la sortie n'apparaît nulle part.
    expect(mockFinishRun).toHaveBeenCalledWith('run-1');
    expect(replace).toHaveBeenCalled();
  });

  it('🔴 navigue MÊME si finishRun échoue', async () => {
    mockFinishRun.mockRejectedValue(new Error('base indisponible'));

    await appuyerSurStop();

    // Rester bloqué sur l'écran de suivi après un appui sur « Arrêter » est le pire des états :
    // l'utilisateur n'a plus aucune action possible.
    expect(replace).toHaveBeenCalledWith({ pathname: '/run/summary', params: { id: 'run-1' } });
  });

  it('🔴 un second appui ne clôture pas deux fois', async () => {
    let resoudreStop: (() => void) | undefined;
    mockStopTracking.mockReturnValue(
      new Promise<void>((resolve) => {
        resoudreStop = resolve;
      }),
    );

    await render(<RunActiveScreen />);
    // Le bouton reste monté pendant l'await : rien n'empêche physiquement un second appui.
    await act(async () => {
      fireEvent.press(screen.getByText('running.active.stop'));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('running.active.finishing'));
    });

    resoudreStop?.();
    await act(async () => {});

    expect(mockFinishRun).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('🔴 deux appuis dans le MÊME cycle de rendu ne clôturent pas deux fois', async () => {
    let resoudreStop: (() => void) | undefined;
    mockStopTracking.mockReturnValue(
      new Promise<void>((resolve) => {
        resoudreStop = resolve;
      }),
    );

    await render(<RunActiveScreen />);
    // Cas distinct du précédent, et le seul que la garde `if (stopping) return` protège vraiment :
    // ici React n'a pas re-rendu entre les deux appuis, donc le bouton n'est pas encore désactivé
    // et les deux gestionnaires partagent la même fermeture. C'est le double-appui rapide réel.
    const bouton = screen.getByText('running.active.stop');
    await act(async () => {
      fireEvent.press(bouton);
      fireEvent.press(bouton);
    });

    resoudreStop?.();
    await act(async () => {});

    expect(mockStopTracking).toHaveBeenCalledTimes(1);
    expect(mockFinishRun).toHaveBeenCalledTimes(1);
  });

  it('pendant la clôture, le bouton passe en attente et se désactive', async () => {
    let resoudreStop: (() => void) | undefined;
    mockStopTracking.mockReturnValue(
      new Promise<void>((resolve) => {
        resoudreStop = resolve;
      }),
    );

    await render(<RunActiveScreen />);
    expect(screen.getByText('running.active.stop')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText('running.active.stop'));
    });

    // Le libellé disparaît du rendu : `Button` en mode `loading` n'affiche plus qu'un indicateur,
    // et ne porte plus son texte que comme libellé d'accessibilité. C'est ce que TalkBack lit
    // (US CONF-07) — et la seule prise qu'un test ait sur l'état d'attente.
    const bouton = screen.getByLabelText('running.active.finishing');
    expect(bouton.props.accessibilityState).toMatchObject({ busy: true, disabled: true });

    resoudreStop?.();
    await act(async () => {});
  });
});

// ---------------------------------------------------------------------------
// Pause
// ---------------------------------------------------------------------------

describe('pause', () => {
  it('affiche l’état de pause tel que le tracker le donne au montage', async () => {
    mockGetPaused.mockReturnValue(true);

    await render(<RunActiveScreen />);

    expect(screen.getByText('running.active.resume')).toBeTruthy();
  });

  it('🔴 suit l’émetteur du tracker — l’auto-pause change le bouton sans interaction', async () => {
    let notifier: ((paused: boolean) => void) | undefined;
    mockSubscribePaused.mockImplementation((cb: (p: boolean) => void) => {
      notifier = cb;
      return jest.fn();
    });

    await render(<RunActiveScreen />);
    expect(screen.getByText('running.active.pause')).toBeTruthy();

    // L'auto-pause est déclenchée par le tracker, pas par l'utilisateur. Un état local ne la
    // verrait jamais : le bouton proposerait « Pause » alors que le suivi est déjà arrêté.
    await act(async () => notifier?.(true));

    expect(screen.getByText('running.active.resume')).toBeTruthy();
  });

  it('demande la pause au tracker, sans toucher à son propre état', async () => {
    await render(<RunActiveScreen />);

    await act(async () => {
      fireEvent.press(screen.getByText('running.active.pause'));
    });

    expect(mockPauseTracking).toHaveBeenCalled();
    // Le libellé ne change pas : c'est l'émetteur qui décidera. Un basculement optimiste mentirait
    // si la pause échouait.
    expect(screen.getByText('running.active.pause')).toBeTruthy();
  });

  it('demande la reprise quand la course est en pause', async () => {
    mockGetPaused.mockReturnValue(true);

    await render(<RunActiveScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('running.active.resume'));
    });

    expect(mockResumeTracking).toHaveBeenCalled();
    expect(mockPauseTracking).not.toHaveBeenCalled();
  });

  it('se désabonne de l’émetteur au démontage', async () => {
    const desabonner = jest.fn();
    mockSubscribePaused.mockReturnValue(desabonner);

    const vue = await render(<RunActiveScreen />);
    await act(async () => {
      vue.unmount();
    });

    // Un abonnement qui survit à l'écran garde une référence sur un `setState` démonté : chaque
    // auto-pause du tracker déclencherait alors un avertissement React, et la fuite s'accumule à
    // chaque aller-retour vers l'écran.
    expect(desabonner).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cible de la séance planifiée (US RUN-F2b)
// ---------------------------------------------------------------------------

describe('comparaison à la cible', () => {
  it('n’affiche aucun encart quand la course est libre', async () => {
    await render(<RunActiveScreen />);

    expect(screen.queryByText('running.target.title')).toBeNull();
  });

  it('compare la distance parcourue à la cible', async () => {
    mockUseRunTarget.mockReturnValue({ targetDistanceM: 5000, targetDurationSeconds: null });
    mockUseActiveRun.mockReturnValue({
      run: courseGps({ plannedSessionId: 'ps-1', distanceM: 3200 }),
      isLoading: false,
    });

    await render(<RunActiveScreen />);

    expect(screen.getByText('running.target.title')).toBeTruthy();
    expect(screen.getByText(/running\.target\.distanceUnder/)).toBeTruthy();
  });

  it('🔴 n’annonce PAS une durée cible tant que le tracker n’a rien flushé', async () => {
    mockUseRunTarget.mockReturnValue({ targetDistanceM: null, targetDurationSeconds: 1800 });
    mockUseActiveRun.mockReturnValue({
      run: courseGps({ plannedSessionId: 'ps-1', durationSeconds: null }),
      isLoading: false,
    });

    await render(<RunActiveScreen />);

    // R1 bis : l'horloge murale de l'écran inclut les pauses. S'en servir ici annoncerait un
    // objectif de durée atteint pendant que le coureur est arrêté au feu rouge.
    expect(screen.queryByText(/running\.target\.duration/)).toBeNull();
  });

  it('en manuel, ne compare pas la distance — il n’y en a pas de mesurée', async () => {
    mockUseRunTarget.mockReturnValue({ targetDistanceM: 5000, targetDurationSeconds: null });
    mockUseActiveRun.mockReturnValue({
      run: courseGps({ source: 'manual', plannedSessionId: 'ps-1' }),
      isLoading: false,
    });

    await render(<RunActiveScreen />);

    expect(screen.queryByText(/running\.target\.distance/)).toBeNull();
  });
});
