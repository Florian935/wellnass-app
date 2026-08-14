/**
 * Contrôle du tracker GPS (`running/tracker.ts`) — pilier Running R1.
 *
 * Fichier à **0 %** avant ce test, et c'est le module qui décide de ce qui arrive à une course
 * pendant qu'on court. Trois mécanismes y portent tout le risque, et aucun n'est observable à
 * l'écran :
 *
 *  1. **Le contrat `stop → drain → finish`.** L'écran fait `await stopTracking()` puis
 *     `finishRun(...)`. Or l'OS peut livrer **un dernier lot après l'arrêt**, qui installe un
 *     nouveau flush *postérieur* à celui qu'on attendait. Le drain ré-attend donc la poignée tant
 *     qu'elle change — **borné**, pour ne jamais boucler indéfiniment. Sans lui, la distance
 *     persistée peut être antérieure au dernier point, et `avg_pace` calculé par `finishRun`
 *     devient incohérent avec la distance affichée.
 *  2. **Les deux permissions ne sont pas de même nature.** L'avant-plan est bloquant ; l'arrière-plan
 *     ne l'est pas (R1) — mais le suivi doit **quand même démarrer** avant de le signaler, sinon on
 *     prive de GPS la majorité des utilisateurs, Android refusant l'arrière-plan par défaut.
 *  3. **Pause et reprise sont idempotentes.** Un double appui, ou un appui hors course, ne doit ni
 *     écrire ni fausser la durée nette.
 */
/**
 * ⚠️ **`jest.setup.ts` mocke `@/running/tracker` GLOBALEMENT** (module natif : expo-location +
 * expo-task-manager). Sans ce `unmock`, ce fichier testerait le mock et non le module : chaque
 * assertion porterait sur `startTracking: jest.fn().mockResolvedValue({ ok: true })`, et **tout
 * serait vert sans rien exécuter**.
 *
 * C'est la raison pour laquelle ce module est resté à 0 % : le chiffre ne disait pas « personne
 * n'a écrit de test », il disait « aucun test ne peut l'atteindre ». À vérifier pour tout module
 * listé dans `jest.setup.ts` avant de conclure quoi que ce soit de sa couverture.
 */
jest.unmock('@/running/tracker');

import {
  drain,
  pauseTracking,
  resumeTracking,
  startTracking,
  stopTracking,
} from '../tracker';
import {
  RUN_TASK,
  getPaused,
  initialTrackerState,
  lastFlushPromise,
  setLastFlushPromise,
  setPaused,
  trackerState,
} from '../tracker-task';
import { flushTrack } from '@/data/repositories/run-repository';
import * as Location from 'expo-location';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  Accuracy: { BestForNavigation: 6 },
}));

jest.mock('@/data/repositories/run-repository', () => ({ flushTrack: jest.fn() }));

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: { t: (k: string) => k },
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockFg = Location.requestForegroundPermissionsAsync as jest.Mock;
const mockBg = Location.requestBackgroundPermissionsAsync as jest.Mock;
const mockHasStarted = Location.hasStartedLocationUpdatesAsync as jest.Mock;
const mockStartUpdates = Location.startLocationUpdatesAsync as jest.Mock;
const mockStopUpdates = Location.stopLocationUpdatesAsync as jest.Mock;
const mockFlush = flushTrack as jest.Mock;

/** Remet l'état module à neuf — il est partagé entre contextes, donc entre tests. */
const reinitialiserEtat = () => {
  setPaused(false);
  Object.assign(trackerState, initialTrackerState());
  setLastFlushPromise(Promise.resolve());
};

/** Installe une course en cours, comme après un `startTracking` réussi. */
const courseEnCours = (overrides: Partial<typeof trackerState> = {}) => {
  Object.assign(trackerState, initialTrackerState(), {
    runId: 'run-1',
    startedAtMs: 1_000_000,
    cumulativeDistanceM: 4200.6,
    netDurationS: 1234.7,
    cumulativeElevationGainM: 42.4,
    cumulativeElevationLossM: 38.9,
    ...overrides,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  reinitialiserEtat();
  mockFg.mockResolvedValue({ granted: true });
  mockBg.mockResolvedValue({ granted: true });
  mockHasStarted.mockResolvedValue(false);
  mockStartUpdates.mockResolvedValue(undefined);
  mockStopUpdates.mockResolvedValue(undefined);
  mockFlush.mockResolvedValue(undefined);
});

afterEach(() => {
  reinitialiserEtat();
});

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------

describe('startTracking', () => {
  it('demande l’avant-plan, l’arrière-plan, puis démarre le suivi', async () => {
    const res = await startTracking('run-1', 1_000_000);

    expect(res).toEqual({ ok: true });
    expect(mockStartUpdates).toHaveBeenCalledWith(RUN_TASK, expect.anything());
  });

  it('🔴 un refus AVANT-PLAN ne démarre RIEN', async () => {
    mockFg.mockResolvedValue({ granted: false });

    const res = await startTracking('run-1', 1_000_000);

    // Sans localisation, il n'y a pas de suivi possible : démarrer le service de premier plan
    // afficherait une notification permanente pour un suivi qui n'enregistre rien.
    expect(res).toEqual({ ok: false, reason: 'foreground-denied' });
    expect(mockStartUpdates).not.toHaveBeenCalled();
    expect(mockBg).not.toHaveBeenCalled();
  });

  it('🔴 un refus ARRIÈRE-PLAN démarre QUAND MÊME le suivi', async () => {
    mockBg.mockResolvedValue({ granted: false });

    const res = await startTracking('run-1', 1_000_000);

    // R1 : le suivi avant-plan reste utile tant que l'écran est allumé. Ne pas démarrer priverait
    // de GPS la majorité des utilisateurs, Android refusant l'arrière-plan par défaut. Le refus est
    // signalé à l'écran, il ne bloque pas.
    expect(res).toEqual({ ok: false, reason: 'background-denied' });
    expect(mockStartUpdates).toHaveBeenCalled();
  });

  it('🔴 l’état module est REMIS À NEUF pour la nouvelle course', async () => {
    courseEnCours({ cumulativeDistanceM: 9999, netDurationS: 5555 });

    await startTracking('run-2', 2_000_000);

    // Les cumuls sont module-level et survivent à une course : sans remise à zéro, la seconde
    // course démarrerait avec la distance de la première.
    expect(trackerState.runId).toBe('run-2');
    expect(trackerState.startedAtMs).toBe(2_000_000);
    expect(trackerState.cumulativeDistanceM).toBe(0);
    expect(trackerState.netDurationS).toBe(0);
  });

  it('🔴 une pause restée active est LEVÉE au démarrage', async () => {
    courseEnCours();
    setPaused(true);

    await startTracking('run-2', 2_000_000);

    // `setPaused` passe par la source de vérité unique et notifie l'UI : réécrire `paused` à la
    // main laisserait l'écran affichant « en pause » sur une course qui vient de partir.
    expect(getPaused()).toBe(false);
    expect(trackerState.paused).toBe(false);
  });

  it('🔴 un suivi DÉJÀ démarré n’est pas relancé', async () => {
    mockHasStarted.mockResolvedValue(true);

    const res = await startTracking('run-1', 1_000_000);

    // Relancer `startLocationUpdatesAsync` sur une tâche déjà enregistrée produirait un double
    // enregistrement — donc des points comptés deux fois.
    expect(mockStartUpdates).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: true });
  });

  it('l’auto-pause est active par défaut, désactivable', async () => {
    await startTracking('run-1', 1_000_000);
    expect(trackerState.autoPause).toBe(true);

    await startTracking('run-2', 1_000_000, { autoPause: false });
    expect(trackerState.autoPause).toBe(false);
  });

  it('🔴 le service de premier plan est configuré avec des libellés TRADUITS', async () => {
    await startTracking('run-1', 1_000_000);

    // C'est la notification permanente que l'utilisateur voit pendant toute sa course : une clé
    // i18n brute y serait visible, et Android exige ce service pour le suivi en arrière-plan.
    const options = mockStartUpdates.mock.calls[0]![1] as {
      foregroundService: { notificationTitle: string };
      pausesUpdatesAutomatically: boolean;
    };
    expect(options.foregroundService.notificationTitle).toBe('running.tracker.notificationTitle');
    // iOS ne met pas en pause automatiquement : l'auto-pause est gérée par l'app, pas par l'OS.
    expect(options.pausesUpdatesAutomatically).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Le drain
// ---------------------------------------------------------------------------

describe('drain', () => {
  it('attend le flush en vol', async () => {
    let resoudre: (() => void) | undefined;
    let resolu = false;
    setLastFlushPromise(
      new Promise<void>((r) => {
        resoudre = () => {
          resolu = true;
          r();
        };
      }),
    );

    const attente = drain();
    resoudre?.();
    await attente;

    expect(resolu).toBe(true);
  });

  it('🔴 il RÉ-ATTEND si un lot tardif remplace la poignée', async () => {
    // Premier flush : en se résolvant, il simule un ultime lot livré par l'OS après l'arrêt, qui
    // installe une NOUVELLE poignée — postérieure à celle que `drain` avait capturée.
    let secondResolu = false;
    const second = new Promise<void>((r) =>
      setTimeout(() => {
        secondResolu = true;
        r();
      }, 0),
    );
    const premier = Promise.resolve().then(() => {
      setLastFlushPromise(second);
    });
    setLastFlushPromise(premier);

    await drain();

    // Sans la ré-attente, `finishRun` partirait avant que le dernier point ne soit persisté :
    // `avg_pace` serait calculé sur une distance périmée.
    expect(secondResolu).toBe(true);
  });

  it('🔴 la boucle est BORNÉE — un flux qui se réinstalle en continu ne bloque pas', async () => {
    // Chaque flush réinstalle une nouvelle poignée. La borne dure de `drain` est de 3 itérations :
    // on en programme 10 pour qu'elle abandonne AVANT la fin de la chaîne — c'est exactement ce
    // qu'on veut prouver. Sans elle, `drain` ne reviendrait jamais et l'écran de course resterait
    // figé sur « arrêt en cours », l'utilisateur ne pouvant plus terminer sa séance.
    //
    // ⚠️ Une chaîne réellement infinie ferait tourner le test indéfiniment : le défaut se
    // manifesterait par un timeout, jamais par un échec lisible. Le compteur est le test.
    let restantes = 10;
    const reinstaller = (): Promise<void> =>
      Promise.resolve().then(() => {
        if (restantes-- > 0) setLastFlushPromise(reinstaller());
      });
    setLastFlushPromise(reinstaller());

    await expect(drain()).resolves.toBeUndefined();
    // La chaîne n'est pas épuisée : `drain` a bien rendu la main sans l'attendre jusqu'au bout.
    expect(restantes).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Arrêt
// ---------------------------------------------------------------------------

describe('stopTracking', () => {
  it('arrête les mises à jour puis détache l’état', async () => {
    mockHasStarted.mockResolvedValue(true);
    courseEnCours();

    await stopTracking();

    expect(mockStopUpdates).toHaveBeenCalledWith(RUN_TASK);
    // La ligne `runs` reste la vérité : garder un `runId` ici ferait croire à une course suivie
    // alors qu'elle est close.
    expect(trackerState.runId).toBeNull();
    expect(trackerState.cumulativeDistanceM).toBe(0);
  });

  it('🔴 un suivi jamais démarré n’appelle PAS l’arrêt', async () => {
    mockHasStarted.mockResolvedValue(false);

    await stopTracking();

    // `stopLocationUpdatesAsync` sur une tâche non enregistrée lève côté natif : l'écran de
    // course resterait bloqué sur une exception au moment précis où l'utilisateur termine.
    expect(mockStopUpdates).not.toHaveBeenCalled();
  });

  it('🔴 l’arrêt DRAINE avant de rendre la main', async () => {
    mockHasStarted.mockResolvedValue(true);
    let flushResolu = false;
    setLastFlushPromise(
      new Promise<void>((r) =>
        setTimeout(() => {
          flushResolu = true;
          r();
        }, 0),
      ),
    );

    await stopTracking();

    // Contrat `stop → drain → finish` : l'appelant enchaîne sur `finishRun`, qui calcule
    // `avg_pace`. Rendre la main avant la fin du flush rendrait ce calcul incohérent avec la
    // distance affichée.
    expect(flushResolu).toBe(true);
  });

  it('🔴 une pause active est levée à l’arrêt', async () => {
    mockHasStarted.mockResolvedValue(true);
    courseEnCours();
    setPaused(true);

    await stopTracking();

    // Sinon l'écran suivant démarrerait avec un indicateur « en pause » hérité d'une course
    // terminée.
    expect(getPaused()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Pause et reprise
// ---------------------------------------------------------------------------

describe('pauseTracking', () => {
  it('🔴 met en pause ET persiste l’état immédiatement', async () => {
    courseEnCours();

    await pauseTracking();

    // `pauseRun` est un no-op côté repository : c'est le tracker qui possède cette
    // responsabilité. Sans cette persistance, une app tuée pendant la pause perdrait la distance
    // parcourue depuis le dernier flush automatique.
    expect(getPaused()).toBe(true);
    expect(mockFlush).toHaveBeenCalledWith('run-1', expect.anything());
  });

  it('🔴 la persistance n’ajoute AUCUN point, et arrondit les cumuls', async () => {
    courseEnCours({
      cumulativeDistanceM: 4200.6,
      netDurationS: 1234.7,
      cumulativeElevationGainM: 42.4,
      cumulativeElevationLossM: 38.9,
    });

    await pauseTracking();

    // Segment vide : ajouter un point à la pause dessinerait un aller-retour immobile sur la
    // trace. Les durées et dénivelés sont des entiers en base.
    expect(mockFlush).toHaveBeenCalledWith('run-1', {
      segmentEncoded: '',
      distanceM: 4200.6,
      durationSeconds: 1235,
      elevationGainM: 42,
      elevationLossM: 39,
    });
  });

  it('🔴 une pause hors course n’écrit rien', async () => {
    await pauseTracking();

    // Écran rouvert après la fin d'une course, ou action différée : il n'y a pas de course à
    // mettre en pause, et écrire créerait un flush sur `null`.
    expect(mockFlush).not.toHaveBeenCalled();
  });

  it('🔴 une seconde pause est un NO-OP', async () => {
    courseEnCours();

    await pauseTracking();
    await pauseTracking();

    // Un double appui — ou un appui pendant que le premier flush est en vol — ne doit pas
    // produire deux écritures concurrentes sur la même course.
    expect(mockFlush).toHaveBeenCalledTimes(1);
  });

  it('la pause remet à zéro le compteur d’auto-pause', async () => {
    courseEnCours({ lowSpeedSinceT: 42 });

    await pauseTracking();

    // Sinon, à la reprise, l'auto-pause déclencherait aussitôt sur une fenêtre de lenteur
    // accumulée avant la pause manuelle.
    expect(trackerState.lowSpeedSinceT).toBeNull();
  });

  it('🔴 un échec de persistance ne laisse pas de rejet non capturé', async () => {
    courseEnCours();
    mockFlush.mockRejectedValue(new Error('hors ligne'));

    // `setLastFlushPromise(p.catch(...))` : la poignée mémorisée est déjà « catchée », sinon le
    // drain de `stopTracking` propagerait l'erreur et l'écran resterait bloqué à l'arrêt.
    await expect(pauseTracking()).rejects.toThrow('hors ligne');
    await expect(lastFlushPromise).resolves.toBeUndefined();
  });
});

describe('resumeTracking', () => {
  it('reprend une course en pause', async () => {
    courseEnCours();
    await pauseTracking();

    resumeTracking();

    expect(getPaused()).toBe(false);
  });

  it('🔴 une reprise hors course, ou hors pause, est un NO-OP', () => {
    // Hors course.
    resumeTracking();
    expect(getPaused()).toBe(false);

    // En course mais pas en pause : reprendre ne doit pas remettre à zéro le compteur
    // d'auto-pause, qui est en train de mesurer une lenteur réelle.
    courseEnCours({ lowSpeedSinceT: 42 });
    resumeTracking();
    expect(trackerState.lowSpeedSinceT).toBe(42);
  });

  it('la reprise remet à zéro le compteur d’auto-pause', async () => {
    courseEnCours();
    await pauseTracking();
    trackerState.lowSpeedSinceT = 42;

    resumeTracking();

    expect(trackerState.lowSpeedSinceT).toBeNull();
  });
});
