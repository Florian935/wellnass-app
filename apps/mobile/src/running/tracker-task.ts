/**
 * Définition de la tâche de fond de suivi GPS (pilier Running R1, Task 6).
 *
 * Ce module contient DEUX choses indissociables :
 *  1. l'état mutable de la course en cours, au niveau module (`trackerState`) ;
 *  2. la définition de la tâche `expo-task-manager` (`RUN_TASK`) qui reçoit les
 *     lots de positions GPS et les persiste immédiatement via le repository.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ Contexte JS séparé (à comprendre avant de toucher à ce fichier)
 * ─────────────────────────────────────────────────────────────────────────────
 * `expo-task-manager` exécute la tâche dans le MÊME graphe de modules JS que
 * l'app (pas un worker isolé), mais éventuellement dans un cycle de vie où
 * AUCUNE vue React n'est montée (app en arrière-plan, voire relancée après un
 * kill par le système pour livrer un lot de positions). Conséquences :
 *
 *  - La tâche NE PEUT PAS lire l'état React (stores/hooks) : elle écrit
 *    directement via `run-repository.flushTrack`, qui s'appuie sur le singleton
 *    PowerSync (accessible depuis n'importe quel module, hors React).
 *  - Les variables de ce module (`trackerState`) sont partagées avec `tracker.ts`
 *    TANT QUE le runtime JS reste vivant. `tracker.startTracking` initialise cet
 *    état ; la tâche le lit/écrit. C'est fiable dans la session courante
 *    (avant-plan + arrière-plan tant que le process vit).
 *  - Si le système relance le process UNIQUEMENT pour livrer un lot (JS neuf,
 *    `startTracking` jamais rappelé), `trackerState.runId` sera `null` : la tâche
 *    ne peut alors pas rattacher le lot à une course et l'ignore. La course
 *    active survit malgré tout (ligne `runs status='active'` en base) et le suivi
 *    reprend proprement au retour au premier plan (l'écran relance `startTracking`).
 *    C'est le compromis R1 assumé — la validation terrain (Task 10) confirme le
 *    comportement réel arrière-plan / après-kill.
 *
 * La tâche DOIT être définie au chargement du module (portée globale, pas dans un
 * cycle de vie React). Le fichier est importé à la racine (`app/_layout.tsx`)
 * pour garantir l'enregistrement dès le chargement du JS.
 */

import {
  encodeSegment,
  haversineMeters,
  type GpsPoint,
} from '@wellness/shared';
import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';
import { flushTrack } from '@/data/repositories/run-repository';

/** Nom de la tâche `expo-task-manager` de suivi GPS. */
export const RUN_TASK = 'run-location-task';

/**
 * Seuil de vitesse (m/s) sous lequel l'auto-pause peut se déclencher.
 * ~0,5 m/s ≈ 1,8 km/h : en dessous, on considère l'utilisateur à l'arrêt.
 */
export const AUTO_PAUSE_SPEED_MS = 0.5;

/** Durée (s) de vitesse basse continue avant déclenchement de l'auto-pause. */
export const AUTO_PAUSE_DELAY_S = 8;

/**
 * État mutable de la course en cours, partagé entre `tracker.ts` (contrôle) et la
 * tâche de fond (ci-dessous). Une seule course active à la fois (garanti par le
 * repository). `null`/valeurs initiales quand aucune course n'est suivie.
 */
export interface TrackerState {
  /** Id de la course active (`runs.id`), ou `null` si aucun suivi en cours. */
  runId: string | null;
  /** Epoch (ms) du démarrage de la course — base des `t` relatifs des points. */
  startedAtMs: number;
  /** Distance cumulée en mètres (hors segments filtrés), source de vérité. */
  cumulativeDistanceM: number;
  /** Durée nette cumulée en secondes, hors temps de pause. */
  netDurationS: number;
  /** Dernier point GPS retenu (pour raccorder le lot suivant), ou `null`. */
  lastPoint: GpsPoint | null;
  /** `t` (s depuis départ) du dernier point retenu, pour la comptabilité durée. */
  lastPointT: number | null;
  /** Course en pause (manuelle ou auto) : ni distance ni durée n'avancent. */
  paused: boolean;
  /** Auto-pause activée pour cette course. */
  autoPause: boolean;
  /**
   * `t` (s) du début de la période de vitesse basse continue en cours, ou `null`
   * si la dernière vitesse observée était au-dessus du seuil. Sert à mesurer la
   * durée sous le seuil pour déclencher l'auto-pause.
   */
  lowSpeedSinceT: number | null;
}

/** Valeurs par défaut d'un état « aucun suivi ». */
export function initialTrackerState(): TrackerState {
  return {
    runId: null,
    startedAtMs: 0,
    cumulativeDistanceM: 0,
    netDurationS: 0,
    lastPoint: null,
    lastPointT: null,
    paused: false,
    autoPause: true,
    lowSpeedSinceT: null,
  };
}

/**
 * État module-level (voir docstring d'en-tête sur le partage inter-contexte).
 * `tracker.ts` le réinitialise via `startTracking` et le mute pour pause/reprise.
 */
export const trackerState: TrackerState = initialTrackerState();

/**
 * Dernière promesse de flush en vol, exposée pour permettre à `tracker.stopTracking`
 * de « drainer » (attendre) le dernier flush avant que l'appelant n'appelle
 * `finishRun`. Le repository sérialise déjà les flush entre eux ; ici on garde une
 * poignée sur le tout dernier pour l'attendre explicitement.
 */
export let lastFlushPromise: Promise<void> = Promise.resolve();

/** Remplace la poignée de flush courante (usage interne tracker/tâche). */
export function setLastFlushPromise(p: Promise<void>): void {
  lastFlushPromise = p;
}

/**
 * Convertit un lot de positions natives en points GPS relatifs à la course.
 * `t` = (timestamp position − epoch départ) / 1000, en secondes (peut être
 * fractionnaire ; les entiers ne sont requis que pour l'encodage temporel, géré
 * par `encodeSegment`).
 */
function toGpsPoints(locations: LocationObject[], startedAtMs: number): GpsPoint[] {
  return locations.map((loc) => ({
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    t: (loc.timestamp - startedAtMs) / 1000,
  }));
}

/**
 * Traite un lot de positions : met à jour l'état cumulatif (distance/durée nette),
 * gère l'auto-pause, encode le lot et déclenche un flush append-only.
 *
 * Exportée pour être testable en isolation (aucun accès natif direct ici).
 *
 * @returns La promesse de flush déclenchée (ou une promesse résolue si rien à
 *          persister — course inactive, lot vide, ou entièrement en pause).
 */
export function handleLocationBatch(locations: LocationObject[]): Promise<void> {
  const s = trackerState;

  // Aucune course rattachée (ex. relance système sans startTracking) → on ignore.
  if (s.runId === null || locations.length === 0) {
    return Promise.resolve();
  }

  const points = toGpsPoints(locations, s.startedAtMs);
  // Points conservés pour l'encodage de CE lot (uniquement quand non en pause).
  const kept: GpsPoint[] = [];

  for (const p of points) {
    // Auto-pause : évaluer la vitesse instantanée par rapport au dernier point.
    if (s.autoPause) {
      evaluateAutoPause(p);
    }

    if (s.paused) {
      // En pause : ne pas cumuler distance/durée ; le point sert de nouvelle base
      // pour ne pas compter le trajet effectué pendant la pause à la reprise.
      s.lastPoint = p;
      s.lastPointT = p.t;
      continue;
    }

    if (s.lastPoint !== null && s.lastPointT !== null) {
      const dt = p.t - s.lastPointT;
      if (dt > 0) {
        const dist = haversineMeters(s.lastPoint, p);
        const speed = dist / dt;
        // Filtre glitch GPS (cohérent avec `totalDistance` de @wellness/shared).
        if (speed <= MAX_PLAUSIBLE_SPEED_MS) {
          s.cumulativeDistanceM += dist;
          s.netDurationS += dt;
        }
      }
    }

    s.lastPoint = p;
    s.lastPointT = p.t;
    kept.push(p);
  }

  if (kept.length === 0) {
    // Lot entièrement absorbé par la pause : rien à encoder ni à persister.
    return Promise.resolve();
  }

  const segmentEncoded = encodeSegment(kept);
  const p = flushTrack(s.runId, {
    segmentEncoded,
    distanceM: s.cumulativeDistanceM,
    durationSeconds: Math.round(s.netDurationS),
  });
  setLastFlushPromise(p.catch(() => {}));
  return p;
}

/**
 * Seuil de vitesse maximale plausible (m/s), aligné sur `@wellness/shared`.
 * Au-delà, le segment est un artefact GPS et n'incrémente pas la distance.
 */
const MAX_PLAUSIBLE_SPEED_MS = 12;

/**
 * Met à jour l'état d'auto-pause d'après un nouveau point.
 *
 * Vitesse basse continue pendant `AUTO_PAUSE_DELAY_S` → passe en pause.
 * Reprise dès qu'une vitesse au-dessus du seuil est observée.
 */
function evaluateAutoPause(p: GpsPoint): void {
  const s = trackerState;
  if (s.lastPoint === null || s.lastPointT === null) {
    return; // premier point : pas de vitesse mesurable.
  }
  const dt = p.t - s.lastPointT;
  if (dt <= 0) {
    return;
  }
  const speed = haversineMeters(s.lastPoint, p) / dt;

  if (speed < AUTO_PAUSE_SPEED_MS) {
    // Sous le seuil : démarrer/poursuivre la fenêtre de vitesse basse.
    if (s.lowSpeedSinceT === null) {
      s.lowSpeedSinceT = s.lastPointT;
    } else if (!s.paused && p.t - s.lowSpeedSinceT >= AUTO_PAUSE_DELAY_S) {
      s.paused = true;
    }
  } else {
    // Vitesse revenue au-dessus du seuil : réinitialise et reprend si auto-pausé.
    s.lowSpeedSinceT = null;
    if (s.paused) {
      s.paused = false;
    }
  }
}

/**
 * Enregistrement de la tâche (portée module = portée globale au chargement JS).
 *
 * `expo-task-manager` fournit `data.locations` (lot de `LocationObject`). On délègue
 * tout le traitement à `handleLocationBatch` (mutation d'état + flush). Les erreurs
 * sont avalées ici : une tâche de fond ne doit jamais rejeter (Expo la considérerait
 * en échec) ; le repository garde de son côté contre les flush sur course inactive.
 */
TaskManager.defineTask<{ locations: LocationObject[] }>(
  RUN_TASK,
  async ({ data, error }) => {
    if (error) {
      // Erreur remontée par le module natif : rien à persister, on ignore.
      return;
    }
    if (!data || !Array.isArray(data.locations)) {
      return;
    }
    try {
      await handleLocationBatch(data.locations);
    } catch {
      // Ne jamais laisser la tâche de fond rejeter (voir docstring).
    }
  },
);
