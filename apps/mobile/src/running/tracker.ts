/**
 * API de contrôle du tracker GPS (pilier Running R1, Task 6).
 *
 * Ce module pilote le suivi de position en avant-plan ET en arrière-plan via
 * `expo-location` + le foreground service Android, sur la tâche définie dans
 * `tracker-task.ts`. Il est le point d'entrée de l'UI (écrans Task 7-8) :
 *
 *   startTracking → pauseTracking / resumeTracking → stopTracking
 *
 * Il ne touche PAS l'UI ni le state React : il mute l'état module partagé
 * (`trackerState` de `tracker-task.ts`) et écrit en base via `run-repository`
 * (`flushTrack`). L'écran observe la course via `useActiveRun` (réactif à chaque
 * flush) + une horloge locale pour un affichage fluide (voir plan Task 7).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ Contrat de séquencement stop → drain → finish (IMPORTANT)
 * ─────────────────────────────────────────────────────────────────────────────
 * L'écran fait : `await stopTracking()` PUIS `finishRun(runId, …)`.
 * `stopTracking` doit donc :
 *   1. arrêter les mises à jour de position (`stopLocationUpdatesAsync`) ;
 *   2. DRAINER : attendre que le tout dernier flush en vol soit persisté.
 * Subtilité : après `stopLocationUpdatesAsync`, l'OS peut encore livrer UN dernier
 * lot à la tâche, qui installe alors un NOUVEAU `lastFlushPromise` — postérieur à
 * celui déjà capturé. Le drain ré-attend donc la poignée tant qu'elle change
 * (boucle bornée), pour absorber ce dernier lot en vol.
 * Malgré cela, la garantie ultime reste le garde-fou du repository : `flushTrack`
 * ignore toute course qui n'est plus `active`. Un flush tardif qui retomberait
 * après `finishRun` serait donc de toute façon sans effet — le drain vise avant
 * tout un séquencement propre (`avg_pace` calculé par `finishRun` cohérent avec la
 * dernière distance), le garde-fou de statut étant le filet de sécurité final.
 */

import i18n from '@/i18n';
import { flushTrack } from '@/data/repositories/run-repository';
import * as Location from 'expo-location';
import {
  RUN_TASK,
  advanceNetDuration,
  initialTrackerState,
  lastFlushPromise,
  setLastFlushPromise,
  setPaused,
  trackerState,
} from './tracker-task';

/** Fréquence cible des mises à jour (ms) côté Android. */
const TIME_INTERVAL_MS = 1000;

/**
 * Période du tick d'horloge (ms) — US CARDIO-UX01 (R1a).
 *
 * Ce tick est ce qui rend la durée **indépendante du GPS** : il avance `netDurationS` même quand
 * aucun point n'arrive (tunnel, forêt — constat F16) et il est la **seule** source en mode manuel,
 * où il n'y a aucun point du tout (constat F15 : une course sans GPS n'enregistrait aucune durée).
 *
 * L'avancement se calcule sur `Date.now()`, pas sur « une seconde par tick » : si Android étrangle
 * le timer en arrière-plan, l'écart réel est rattrapé au tick suivant au lieu d'être perdu.
 */
const CLOCK_TICK_MS = 1000;

/**
 * Nombre de ticks entre deux flushs en base. À 1 s par tick, on persiste donc toutes les 10 s.
 *
 * Pourquoi pas à chaque tick : un flush est une écriture SQLite + une entrée de file de synchro.
 * Pourquoi pas plus rare : c'est la granularité de ce qu'on perd si le processus est tué en
 * pleine course. Dix secondes est le compromis retenu ; la clôture, elle, flushe toujours la
 * valeur exacte (voir `stopTracking`).
 */
const CLOCK_FLUSH_EVERY_TICKS = 10;

/** Handle du tick d'horloge, ou `null` si aucune course n'est suivie. */
let clockTimer: ReturnType<typeof setInterval> | null = null;

/** Compteur de ticks depuis le dernier flush. */
let ticksSinceFlush = 0;

/**
 * Démarre le tick d'horloge. Idempotent : deux appels ne créent pas deux timers (ce qui
 * doublerait la vitesse d'avancement — le genre de défaut invisible en test et brutal en course).
 */
function startClock(): void {
  if (clockTimer !== null) {
    return;
  }
  ticksSinceFlush = 0;
  clockTimer = setInterval(() => {
    advanceNetDuration(Date.now());
    ticksSinceFlush += 1;
    if (ticksSinceFlush >= CLOCK_FLUSH_EVERY_TICKS) {
      ticksSinceFlush = 0;
      // Fire-and-forget : le flush est déjà sérialisé côté repository, et une écriture ratée
      // sera rattrapée au tick suivant. On ne bloque jamais l'horloge sur la base.
      void persistCurrentState();
    }
  }, CLOCK_TICK_MS);
}

/**
 * Arrête le tick d'horloge. Idempotent.
 *
 * Exporté parce qu'un test qui démarre un suivi sans le clore laisserait sinon un `setInterval`
 * vivant entre deux cas — un timer fantôme qui avance la durée d'une course déjà finie.
 */
export function stopClock(): void {
  if (clockTimer !== null) {
    clearInterval(clockTimer);
    clockTimer = null;
  }
  ticksSinceFlush = 0;
}

/** Exposé pour les tests : le tick d'horloge est-il actif ? */
export function isClockRunning(): boolean {
  return clockTimer !== null;
}

/** Distance minimale (m) entre deux mises à jour retenues. */
const DISTANCE_INTERVAL_M = 5;

/** Résultat du démarrage du suivi, à interpréter par l'écran. */
export type StartTrackingResult =
  | { ok: true }
  /** Permission avant-plan refusée : impossible de suivre (bloquant). */
  | { ok: false; reason: 'foreground-denied' }
  /**
   * Permission arrière-plan refusée : le suivi avant-plan reste possible, mais
   * l'écran verrouillé / arrière-plan ne fonctionnera pas. L'écran décide (R1 :
   * on démarre quand même et on prévient l'utilisateur).
   */
  | { ok: false; reason: 'background-denied' };

/**
 * Démarre le suivi GPS d'une course déjà créée en base (`runId`, `status='active'`).
 *
 * Étapes :
 *  1. demande les permissions (avant-plan obligatoire, arrière-plan souhaitée) ;
 *  2. réinitialise l'état module (runId, base temps, cumuls à zéro) ;
 *  3. lance `startLocationUpdatesAsync` avec le foreground service Android.
 *
 * @param runId       Id de la course active (`runs.id`).
 * @param startedAtMs Epoch (ms) du démarrage — base des `t` relatifs des points.
 *                    À aligner sur `started_at` de la ligne (course = source de vérité).
 * @param opts.autoPause Active l'auto-pause (défaut : `true`).
 */
export async function startTracking(
  runId: string,
  startedAtMs: number,
  opts: { autoPause?: boolean } = {},
): Promise<StartTrackingResult> {
  const autoPause = opts.autoPause ?? true;

  // 1. Permissions. Avant-plan obligatoire ; sans elle, aucun suivi possible.
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) {
    return { ok: false, reason: 'foreground-denied' };
  }
  // Arrière-plan : nécessaire pour l'écran verrouillé / l'app minimisée.
  const bg = await Location.requestBackgroundPermissionsAsync();

  // 2. Réinitialise l'état module partagé pour cette course.
  //    `setPaused(false)` d'abord : passe par la source de vérité unique et
  //    notifie l'UI si une pause (manuelle ou auto) était encore active.
  setPaused(false);
  Object.assign(trackerState, initialTrackerState(), {
    runId,
    startedAtMs,
    autoPause,
    mode: 'gps' as const,
    // Le repère part de l'instant de DÉPART de la course, pas du premier tick : sinon la
    // première seconde n'est jamais comptée, et le chrono retarde d'une seconde pour toujours.
    lastAdvanceAtMs: startedAtMs,
  });
  setLastFlushPromise(Promise.resolve());

  // US CARDIO-UX01 (R1a) — l'horloge démarre AVANT les mises à jour de position : la durée ne
  // dépend plus de l'arrivée du premier fix.
  startClock();

  // 3. Démarre les mises à jour de position + foreground service Android.
  //    Ne relance pas si déjà démarré (évite un double enregistrement).
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(RUN_TASK);
  if (!alreadyStarted) {
    await Location.startLocationUpdatesAsync(RUN_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: TIME_INTERVAL_MS,
      distanceInterval: DISTANCE_INTERVAL_M,
      // iOS ne met pas en pause automatiquement : on gère l'auto-pause nous-mêmes.
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: i18n.t('running.tracker.notificationTitle'),
        notificationBody: i18n.t('running.tracker.notificationBody'),
        notificationColor: '#c0562f',
      },
    });
  }

  if (!bg.granted) {
    return { ok: false, reason: 'background-denied' };
  }
  return { ok: true };
}

/**
 * Démarre le suivi d'une course **sans GPS** (US CARDIO-UX01, R1b — constat F15).
 *
 * ── Ce que ça corrige ────────────────────────────────────────────────────────────────────────────
 * `runs.duration_seconds` n'est écrit que par `flushTrack`, appelé seulement par le tracker,
 * lui-même lancé seulement en mode GPS (`if (source === 'gps')` dans `run/index.tsx`). Une course
 * manuelle finissait donc à `duration_seconds = null` : le résumé affichait « Durée — » et
 * « Allure — », et les 45 minutes que le coureur venait de regarder défiler n'étaient **nulle
 * part**. La roadmap 5.21 annonçait pourtant « suivi à la durée seule » et « couvre aussi le
 * tapis » — c'est-à-dire exactement ce qui ne marchait pas.
 *
 * ── Ce que ça fait ───────────────────────────────────────────────────────────────────────────────
 * Le même état, le même drapeau de pause, le même chemin de flush que le mode GPS : seule la
 * source d'avancement change (le tick d'horloge au lieu des points). Pause, reprise, auto-pause
 * (désactivée, faute de vitesse à observer), clôture et persistance sont donc **identiques**, et
 * l'écran de suivi n'a pas à savoir dans quel mode il est pour afficher le chrono.
 *
 * Aucune permission, aucun service de premier plan, aucune trace.
 */
export function startManualClock(runId: string, startedAtMs: number): void {
  setPaused(false);
  Object.assign(trackerState, initialTrackerState(), {
    runId,
    startedAtMs,
    // Rien à observer : sans points GPS, aucune vitesse lissée, donc aucune auto-pause possible.
    autoPause: false,
    mode: 'manual' as const,
    // Même repère qu'en GPS : la durée court depuis le départ, pas depuis le premier tick.
    lastAdvanceAtMs: startedAtMs,
  });
  setLastFlushPromise(Promise.resolve());
  startClock();
}

/**
 * Arrête le suivi puis DRAINE le dernier flush (voir contrat stop → drain → finish).
 * Résout uniquement quand le dernier flush est persisté : l'appelant peut ensuite
 * appeler `finishRun` sans risque de flush tardif retombant après la clôture.
 */
export async function stopTracking(): Promise<void> {
  const started = await Location.hasStartedLocationUpdatesAsync(RUN_TASK);
  if (started) {
    await Location.stopLocationUpdatesAsync(RUN_TASK);
  }

  // US CARDIO-UX01 (R1a) — l'horloge s'arrête, mais on compte d'abord les secondes écoulées
  // depuis le dernier tick, puis on les ÉCRIT. Sans ce flush final, la durée enregistrée serait
  // celle du dernier flush périodique, donc jusqu'à 10 s trop courte — et en mode manuel, la
  // seule durée jamais écrite.
  stopClock();
  advanceNetDuration(Date.now());
  await persistCurrentState();
  // Drain : attendre le tout dernier flush en vol (déjà « catché » à la source).
  // Un ultime lot livré par l'OS après l'arrêt peut réinstaller `lastFlushPromise`
  // APRÈS notre capture ; on ré-attend donc tant que la poignée change (borné).
  await drain();
  // Détache l'état : plus aucune course suivie (la ligne `runs` reste la vérité).
  //    `setPaused(false)` d'abord : notifie l'UI si une pause était active.
  setPaused(false);
  Object.assign(trackerState, initialTrackerState());
}

/** Nombre maximal d'itérations de drain (borne dure contre une boucle infinie). */
const MAX_DRAIN_ITERATIONS = 3;

/**
 * Attend la résolution du dernier flush en vol jusqu'à stabilité. Exposé pour les
 * tests et pour un usage explicite ; `stopTracking` l'appelle déjà.
 *
 * Un ultime lot GPS livré après l'arrêt peut réinstaller `lastFlushPromise` (via
 * `setLastFlushPromise`) APRÈS que nous ayons capturé la poignée courante. On
 * capture donc, on attend, puis on recommence si la poignée a changé entre-temps —
 * borné à `MAX_DRAIN_ITERATIONS` pour ne jamais boucler indéfiniment. Le garde-fou
 * de statut du repository reste le filet de sécurité final (voir en-tête).
 */
export async function drain(): Promise<void> {
  for (let i = 0; i < MAX_DRAIN_ITERATIONS; i++) {
    const captured = lastFlushPromise;
    await captured;
    // `lastFlushPromise` est une liaison de module vivante : si un lot tardif l'a
    // remplacée pendant l'attente, on ré-attend la nouvelle poignée.
    if (lastFlushPromise === captured) {
      return;
    }
  }
}

/**
 * Met la course en pause : distance et durée nette cessent d'avancer, et on
 * persiste immédiatement l'état courant (le repository `pauseRun` étant un no-op,
 * le tracker possède cette responsabilité — cf. docstring de `run-repository`).
 */
export async function pauseTracking(): Promise<void> {
  const s = trackerState;
  if (s.runId === null || s.paused) {
    return;
  }
  // Compter le temps couru JUSQU'À l'instant de la pause, avant de figer le compteur.
  advanceNetDuration(Date.now());
  setPaused(true);
  s.lowSpeedSinceT = null;
  await persistCurrentState();
}

/**
 * Reprend une course en pause. Les prochains points repartiront du dernier point
 * connu (déjà mis à jour pendant la pause), donc le trajet immobile n'est pas compté.
 */
export function resumeTracking(): void {
  const s = trackerState;
  if (s.runId === null || !s.paused) {
    return;
  }
  // Déplacer le repère jusqu'à maintenant AVANT de sortir de pause : sans ça, le premier
  // avancement après la reprise compterait toute la durée de la pause d'un seul coup.
  advanceNetDuration(Date.now());
  setPaused(false);
  s.lowSpeedSinceT = null;
}

/**
 * Persiste l'état courant sans ajouter de nouveau segment (segment vide).
 * Utilisé sur pause : fige `distance_m` / `duration_seconds` en base tout de suite.
 */
async function persistCurrentState(): Promise<void> {
  const s = trackerState;
  if (s.runId === null) {
    return;
  }
  // Mode manuel : la durée seule. `null` = « ne pas écrire » (voir `FlushInput`) — écrire
  // `distance_m: 0` ferait disparaître le champ de saisie de distance du résumé, et « +0 m » de
  // dénivelé serait un chiffre inventé.
  const isManual = s.mode === 'manual';
  const p = flushTrack(s.runId, {
    segmentEncoded: '', // aucun nouveau point : appendTo'' est un no-op côté repo
    distanceM: isManual ? null : s.cumulativeDistanceM,
    durationSeconds: Math.round(s.netDurationS),
    elevationGainM: isManual ? null : Math.round(s.cumulativeElevationGainM),
    elevationLossM: isManual ? null : Math.round(s.cumulativeElevationLossM),
  });
  setLastFlushPromise(p.catch(() => {}));
  await p;
}
