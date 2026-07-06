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
 *   2. DRAINER : attendre que le tout dernier flush en vol soit persisté, afin
 *      qu'AUCUN flush tardif ne retombe APRÈS `finishRun`.
 * Le repository garde en plus `flushTrack` contre les courses non actives (filet
 * de sécurité), mais `stopTracking` draine malgré tout pour un séquencement propre
 * (`avg_pace` calculé par `finishRun` reste cohérent avec la dernière distance).
 */

import i18n from '@/i18n';
import { flushTrack } from '@/data/repositories/run-repository';
import * as Location from 'expo-location';
import {
  RUN_TASK,
  initialTrackerState,
  lastFlushPromise,
  setLastFlushPromise,
  trackerState,
} from './tracker-task';

/** Fréquence cible des mises à jour (ms) côté Android. */
const TIME_INTERVAL_MS = 1000;

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
  Object.assign(trackerState, initialTrackerState(), {
    runId,
    startedAtMs,
    autoPause,
  });
  setLastFlushPromise(Promise.resolve());

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
 * Arrête le suivi puis DRAINE le dernier flush (voir contrat stop → drain → finish).
 * Résout uniquement quand le dernier flush est persisté : l'appelant peut ensuite
 * appeler `finishRun` sans risque de flush tardif retombant après la clôture.
 */
export async function stopTracking(): Promise<void> {
  const started = await Location.hasStartedLocationUpdatesAsync(RUN_TASK);
  if (started) {
    await Location.stopLocationUpdatesAsync(RUN_TASK);
  }
  // Drain : attendre le tout dernier flush en vol (déjà « catché » à la source).
  await drain();
  // Détache l'état : plus aucune course suivie (la ligne `runs` reste la vérité).
  Object.assign(trackerState, initialTrackerState());
}

/**
 * Attend la résolution du dernier flush en vol. Exposé pour les tests et pour
 * un usage explicite ; `stopTracking` l'appelle déjà.
 */
export async function drain(): Promise<void> {
  await lastFlushPromise;
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
  s.paused = true;
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
  s.paused = false;
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
  const p = flushTrack(s.runId, {
    segmentEncoded: '', // aucun nouveau point : appendTo'' est un no-op côté repo
    distanceM: s.cumulativeDistanceM,
    durationSeconds: Math.round(s.netDurationS),
  });
  setLastFlushPromise(p.catch(() => {}));
  await p;
}
