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
  MAX_PLAUSIBLE_SPEED_MS,
  encodeSegment,
  haversineMeters,
  isValidFix,
  smoothedSpeedMs,
  type GpsPoint,
} from '@wellness/shared';
import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';
import { flushTrack } from '@/data/repositories/run-repository';

/** Nom de la tâche `expo-task-manager` de suivi GPS. */
export const RUN_TASK = 'run-location-task';

/**
 * Seuil de vitesse LISSÉE (m/s) sous lequel l'auto-pause peut se déclencher.
 *
 * Abaissé de 0,5 à 0,3 m/s (~1,1 km/h) — Volet B : 0,5 m/s coupait une marche
 * lente réelle (~0,72 m/s) dont le bruit GPS plonge sous le seuil. 0,3 m/s
 * réserve l'auto-pause au quasi-arrêt. La vitesse comparée n'est PLUS la vitesse
 * instantanée point-à-point (bruitée) mais la vitesse moyenne sur une fenêtre
 * (`AUTO_PAUSE_WINDOW_S`), calculée par `smoothedSpeedMs` (@wellness/shared).
 */
export const AUTO_PAUSE_SPEED_MS = 0.3;

/** Durée (s) de vitesse basse continue avant déclenchement de l'auto-pause. */
export const AUTO_PAUSE_DELAY_S = 8;

/**
 * Fenêtre (s) de lissage de la vitesse pour l'auto-pause. Moyenner sur ~10 s
 * absorbe les creux instantanés de bruit GPS sans retarder la détection d'un
 * arrêt réel (arrêt → moyenne tend vers 0 en quelques secondes).
 */
export const AUTO_PAUSE_WINDOW_S = 10;

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
  /**
   * Dénivelé positif/négatif cumulé en mètres (US RUN-F1b, spec R2/R3), source de vérité —
   * jamais recalculé depuis `gps_track` (même patron que `cumulativeDistanceM`).
   */
  cumulativeElevationGainM: number;
  cumulativeElevationLossM: number;
  /**
   * Solde d'altitude en attente de franchir le seuil de bruit avant validation (spec R3),
   * jamais flushé — état interne uniquement.
   */
  pendingElevationDeltaM: number;
  /**
   * Dernière altitude connue (US RUN-F1b), ou `null`. Suit exactement le sort de `lastPoint`/
   * `lastPointT` (spec R2/R4) : mise à jour même sur un segment rejeté ou pendant une pause.
   */
  lastAltitudeM: number | null;
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
  /**
   * Fenêtre glissante des derniers points GPS retenus (bornée à
   * `AUTO_PAUSE_WINDOW_S`), pour calculer la vitesse LISSÉE de l'auto-pause
   * (Volet B). Évite la sensibilité au bruit de la vitesse instantanée.
   */
  recentPoints: GpsPoint[];
}

/** Valeurs par défaut d'un état « aucun suivi ». */
export function initialTrackerState(): TrackerState {
  return {
    runId: null,
    startedAtMs: 0,
    cumulativeDistanceM: 0,
    netDurationS: 0,
    cumulativeElevationGainM: 0,
    cumulativeElevationLossM: 0,
    pendingElevationDeltaM: 0,
    lastAltitudeM: null,
    lastPoint: null,
    lastPointT: null,
    paused: false,
    autoPause: true,
    lowSpeedSinceT: null,
    recentPoints: [],
  };
}

/**
 * État module-level (voir docstring d'en-tête sur le partage inter-contexte).
 * `tracker.ts` le réinitialise via `startTracking` et le mute pour pause/reprise.
 */
export const trackerState: TrackerState = initialTrackerState();

// ─────────────────────────────────────────────────────────────────────────────
// État de pause observable (source de vérité unique)
// ─────────────────────────────────────────────────────────────────────────────
// `trackerState.paused` est LE seul drapeau de pause. Il change à trois endroits :
//   - pause/reprise manuelle (`tracker.pauseTracking` / `resumeTracking`) ;
//   - auto-pause et auto-reprise (`evaluateAutoPause`, ci-dessous).
// Pour que l'écran React reflète l'auto-pause (qui se produit hors interaction
// utilisateur), tout changement DOIT passer par `setPaused`, qui mute le drapeau
// et notifie les abonnés. Micro-émetteur module-level, sans lib de state.

type PausedListener = (paused: boolean) => void;
const pausedListeners = new Set<PausedListener>();

/**
 * Mute l'unique drapeau de pause (`trackerState.paused`) et notifie les abonnés
 * si la valeur change réellement. Point de passage obligé pour toute pause/reprise
 * (manuelle ou auto), afin que l'UI reste synchrone avec l'état réel du tracker.
 */
export function setPaused(next: boolean): void {
  if (trackerState.paused === next) {
    return;
  }
  trackerState.paused = next;
  for (const listener of pausedListeners) {
    listener(next);
  }
}

/** État de pause courant (lecture directe de la source de vérité). */
export function getPaused(): boolean {
  return trackerState.paused;
}

/**
 * Abonne un écouteur aux changements de l'état de pause. Renvoie la fonction de
 * désabonnement. L'écouteur n'est pas appelé immédiatement : l'appelant lit
 * `getPaused()` pour son état initial.
 */
export function subscribePaused(listener: PausedListener): () => void {
  pausedListeners.add(listener);
  return () => {
    pausedListeners.delete(listener);
  };
}

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
 * Seuil de précision verticale (m) au-delà duquel une altitude est traitée comme absente
 * (US RUN-F1b, spec R1). ⚠️ Valeur posée par analogie (montres GPS grand public), **non validée
 * terrain sur cette stack** — à ajuster après la première recette réelle (spec R7).
 */
const ALTITUDE_ACCURACY_MAX_M = 30;

/**
 * Point GPS retenu accompagné de son altitude (US RUN-F1b), construit dans la MÊME boucle que le
 * filtre de validité horizontale (`isValidFix`) — jamais par un second passage indépendant sur
 * `locations`, qui désynchroniserait silencieusement point et altitude dès qu'un fix est filtré
 * (spec R1 bis). `point` reste `{lat,lng,t}` : le codec de trace (`encodeSegment`/`decodeTrack`)
 * ne connaît pas l'altitude et n'a pas besoin de changer (spec §0).
 */
interface GpsPointWithAltitude {
  point: GpsPoint;
  /** `null` si absente, ou si `altitudeAccuracy` dépasse `ALTITUDE_ACCURACY_MAX_M` (spec R1). */
  altitudeM: number | null;
}

/**
 * Convertit un lot de positions natives en points GPS relatifs à la course (+ altitude, US
 * RUN-F1b), en ÉCARTANT les fixes invalides (Volet A : null island (0,0), hors bornes,
 * précision dégradée > seuil). Le filtre `isValidFix` (pur, dans `@wellness/shared`)
 * est la source de vérité ; ici on ne fait qu'adapter le `LocationObject` d'Expo
 * (`coords.accuracy` peut être `null`).
 *
 * `t` = (timestamp position − epoch départ) / 1000, en secondes (peut être
 * fractionnaire ; les entiers ne sont requis que pour l'encodage temporel, géré
 * par `encodeSegment`).
 *
 * Un fix rejeté n'entre pas dans le résultat : il n'est donc ni encodé, ni
 * cumulé (distance/durée/dénivelé), ni retenu comme `lastPoint`/`lastAltitudeM` par
 * `handleLocationBatch`.
 */
function toGpsPointsWithAltitude(
  locations: LocationObject[],
  startedAtMs: number,
): GpsPointWithAltitude[] {
  const result: GpsPointWithAltitude[] = [];
  for (const loc of locations) {
    if (
      !isValidFix({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
      })
    ) {
      continue; // fix invalide : écarté à l'ingestion.
    }
    const { altitude, altitudeAccuracy } = loc.coords;
    const altitudeM =
      altitude != null && (altitudeAccuracy == null || altitudeAccuracy <= ALTITUDE_ACCURACY_MAX_M)
        ? altitude
        : null;
    result.push({
      point: {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        t: (loc.timestamp - startedAtMs) / 1000,
      },
      altitudeM,
    });
  }
  return result;
}

/**
 * Seuil de bruit vertical (m) avant de valider un gain/une perte de dénivelé (US RUN-F1b, spec
 * R3). Simplification assumée, pas un modèle barométrique physique — même esprit pragmatique que
 * `MAX_PLAUSIBLE_SPEED_MS` pour la distance. ⚠️ Non validé terrain sur cette stack (spec R7).
 */
const ELEVATION_NOISE_THRESHOLD_M = 3;

/**
 * Traite un lot de positions : met à jour l'état cumulatif (distance/durée nette, dénivelé
 * US RUN-F1b), gère l'auto-pause, encode le lot et déclenche un flush append-only.
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

  const withAltitude = toGpsPointsWithAltitude(locations, s.startedAtMs);
  // Points conservés pour l'encodage de CE lot (uniquement quand non en pause).
  const kept: GpsPoint[] = [];

  for (const { point: p, altitudeM } of withAltitude) {
    // Auto-pause : évaluer la vitesse instantanée par rapport au dernier point.
    if (s.autoPause) {
      evaluateAutoPause(p);
    }

    if (s.paused) {
      // En pause : ne pas cumuler distance/durée/dénivelé ; le point (et son altitude) sert de
      // nouvelle base pour ne pas compter le trajet effectué pendant la pause à la reprise
      // (spec R4 — même traitement que lastPoint/lastPointT).
      s.lastPoint = p;
      s.lastPointT = p.t;
      s.lastAltitudeM = altitudeM ?? s.lastAltitudeM;
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
          // Dénivelé (US RUN-F1b) : accumulé UNIQUEMENT sur un segment déjà jugé fiable pour la
          // distance (spec R2) — une seule notion de « segment fiable ».
          if (altitudeM != null && s.lastAltitudeM != null) {
            s.pendingElevationDeltaM += altitudeM - s.lastAltitudeM;
            if (s.pendingElevationDeltaM >= ELEVATION_NOISE_THRESHOLD_M) {
              s.cumulativeElevationGainM += s.pendingElevationDeltaM;
              s.pendingElevationDeltaM = 0;
            } else if (s.pendingElevationDeltaM <= -ELEVATION_NOISE_THRESHOLD_M) {
              s.cumulativeElevationLossM += -s.pendingElevationDeltaM;
              s.pendingElevationDeltaM = 0;
            }
          }
        }
      }
    }

    s.lastPoint = p;
    s.lastPointT = p.t;
    // Même règle que lastPoint : mise à jour même si le segment a été rejeté par le filtre
    // vitesse ci-dessus (spec R2) — une seule notion de « dernier point connu ».
    s.lastAltitudeM = altitudeM ?? s.lastAltitudeM;
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
    elevationGainM: Math.round(s.cumulativeElevationGainM),
    elevationLossM: Math.round(s.cumulativeElevationLossM),
  });
  setLastFlushPromise(p.catch(() => {}));
  return p;
}

/**
 * Met à jour l'état d'auto-pause d'après un nouveau point (Volet B).
 *
 * La décision s'appuie sur la vitesse LISSÉE (`smoothedSpeedMs`) sur la fenêtre
 * `AUTO_PAUSE_WINDOW_S`, et non sur la vitesse instantanée point-à-point (trop
 * bruitée : une marche lente réelle plonge régulièrement sous le seuil sans être
 * à l'arrêt). Le point courant est ajouté à la fenêtre glissante bornée.
 *
 * Vitesse lissée basse en continu pendant `AUTO_PAUSE_DELAY_S` → passe en pause.
 * Reprise dès que la vitesse lissée repasse au-dessus du seuil (auto-reprise).
 */
function evaluateAutoPause(p: GpsPoint): void {
  const s = trackerState;

  // Ajouter le point à la fenêtre glissante et purger ce qui sort de la fenêtre.
  s.recentPoints.push(p);
  const windowStart = p.t - AUTO_PAUSE_WINDOW_S;
  while (s.recentPoints.length > 0 && s.recentPoints[0]!.t < windowStart) {
    s.recentPoints.shift();
  }

  const speed = smoothedSpeedMs(s.recentPoints, AUTO_PAUSE_WINDOW_S);
  if (speed === null) {
    return; // fenêtre insuffisante : pas de décision.
  }

  if (speed < AUTO_PAUSE_SPEED_MS) {
    // Sous le seuil : démarrer/poursuivre la fenêtre de vitesse basse.
    if (s.lowSpeedSinceT === null) {
      s.lowSpeedSinceT = p.t;
    } else if (!s.paused && p.t - s.lowSpeedSinceT >= AUTO_PAUSE_DELAY_S) {
      setPaused(true);
    }
  } else {
    // Vitesse lissée revenue au-dessus du seuil : réinitialise, reprend si auto-pausé.
    s.lowSpeedSinceT = null;
    if (s.paused) {
      setPaused(false);
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
