/**
 * Les quatre portes vers l'allure de référence, le test de 12 minutes guidé et l'accueil du pilier
 * Course (US CARDIO-02, roadmap 5.45).
 *
 * ── Le mur que ça lève ───────────────────────────────────────────────────────────────────────────
 * L'allure de référence produit **toutes** les allures cibles du pilier, et on ne pouvait la donner
 * que d'une façon : « ton allure actuelle sur 5 km » (constat F2). Les calculs des autres portes
 * existaient depuis CARDIO-UX01 (`referencePaceFromRaceTime`, Riegel inversé) ; aucun écran ne les
 * appelait. Ce module porte tout ce que ces écrans décident, pur et testé :
 *  - ce que chaque porte rend d'une saisie (`evaluateReferenceDoor`), avec **une seule borne** ;
 *  - quand un record 5 km a le droit de remplacer l'allure (`shouldRecordUpdateReference`) ;
 *  - d'où vient l'allure affichée (`referencePaceOrigin`), **déduit, jamais stocké** ;
 *  - le déroulé du test de 12 minutes et sa mesure sur la trace ;
 *  - quand l'accueil du pilier s'ouvre, et ce que le choix de voix écrit.
 *
 * Aucune valeur inventée : une saisie inexploitable rend un statut, jamais une allure.
 */

import { RUNNING_RECORD_DISTANCES, cumulativeDistances, type RecordDistanceKey } from './pace-records';
import { isValidCoord, type GpsPoint } from './running';
import { referencePaceFromRaceTime } from './running-hub';
import { parseMmSs, sessionTargetPace, type PaceRange, type SessionType } from './running-paces';
import { MI_PER_KM, PLAUSIBLE_PACE_S_PER_KM, parseNumberLoose, parsePaceText, type UnitSystem } from './units';

// ---------------------------------------------------------------------------
// Les portes (spec R1 → R7)
// ---------------------------------------------------------------------------

/** Les distances proposées en pastilles par la porte « j'ai un chrono récent » (R2). */
export const RACE_DISTANCE_KEYS = ['5k', '10k', 'semi', 'marathon'] as const satisfies readonly RecordDistanceKey[];
export type RaceDistanceKey = (typeof RACE_DISTANCE_KEYS)[number];

/** Distance en mètres d'une pastille — celle des records, pour que « semi » soit partout le même. */
export function raceDistanceMeters(key: RaceDistanceKey): number {
  return RUNNING_RECORD_DISTANCES.find((d) => d.key === key)!.meters;
}

/** « Autre » : de 1 km au marathon (R2). Au-delà, Riegel inversé ne veut plus rien dire. */
export const RACE_CUSTOM_RANGE_M = { min: 1000, max: 42195 } as const;

/**
 * L'exemple du champ de temps, selon la distance (R3) : un semi s'écrit `1:45:00`, pas `1:45` — que
 * `parseMmSs` lirait 1 min 45 s.
 */
export const RACE_TIME_EXAMPLE_S: Record<RaceDistanceKey | 'other', number> = {
  '5k': 25 * 60,
  '10k': 52 * 60 + 30,
  semi: 105 * 60,
  marathon: 225 * 60,
  other: 45 * 60,
};

/** Un mile, en mètres : le test de 12 minutes se saisit en miles en impérial. */
const METERS_PER_MILE = 1000 / MI_PER_KM;

/** Ce qu'une porte rend d'une saisie. `sPerKm` n'existe que pour une valeur lisible. */
export type ReferencePaceEvaluation =
  | { status: 'empty' | 'unreadable' | 'badDistance' }
  | { status: 'ok' | 'tooFast' | 'tooSlow'; sPerKm: number };

/**
 * Classe une allure **brute** (R4) — exactement comme `parsePaceToSPerKm`, sans quoi 4:01 /mi
 * (149,75 s/km) passerait ici et pas là — puis l'arrondit à la seconde (R1). L'arrondi vaut aussi en
 * impérial, où l'ancienne saisie stockait 8:00 /mi comme 298,26 s/km.
 */
export function classifyReferencePace(sPerKm: number | null): ReferencePaceEvaluation {
  if (sPerKm == null || !Number.isFinite(sPerKm) || sPerKm <= 0) return { status: 'empty' };
  const rounded = Math.round(sPerKm);
  if (sPerKm < PLAUSIBLE_PACE_S_PER_KM.min) return { status: 'tooFast', sPerKm: rounded };
  if (sPerKm > PLAUSIBLE_PACE_S_PER_KM.max) return { status: 'tooSlow', sPerKm: rounded };
  return { status: 'ok', sPerKm: rounded };
}

/** Les saisies des trois portes qui en ont une. « Je ne sais pas encore » n'écrit rien. */
export type ReferenceDoorInput =
  | {
      door: 'race';
      distance: RaceDistanceKey | 'other';
      /** Distance « Autre », dans l'unité d'affichage (km ou mi). */
      customDistanceText: string;
      /** `m:ss`, `h:mm:ss` ou un nombre nu compté en minutes (`parseMmSs`). */
      timeText: string;
      system: UnitSystem;
    }
  | {
      door: 'test';
      /** Distance couverte en 12 minutes : mètres en métrique, miles en impérial. */
      distanceText: string;
      system: UnitSystem;
    }
  | {
      door: 'known';
      /** `m:ss` par km ou par mile. */
      paceText: string;
      system: UnitSystem;
    };

/** Ce que rend une porte (R1 → R4). Une seule formule, une seule borne, pour les trois. */
export function evaluateReferenceDoor(input: ReferenceDoorInput): ReferencePaceEvaluation {
  switch (input.door) {
    case 'race': {
      let meters: number;
      if (input.distance === 'other') {
        if (input.customDistanceText.trim() === '') return { status: 'empty' };
        const value = parseNumberLoose(input.customDistanceText);
        if (value === null || value <= 0) return { status: 'badDistance' };
        meters = input.system === 'imperial' ? value * METERS_PER_MILE : value * 1000;
        // Tolérance d'un millimètre : 42,195 × 1 000 ne tombe pas toujours juste en flottant.
        if (meters < RACE_CUSTOM_RANGE_M.min - 1e-3 || meters > RACE_CUSTOM_RANGE_M.max + 1e-3) {
          return { status: 'badDistance' };
        }
      } else {
        meters = raceDistanceMeters(input.distance);
      }
      if (input.timeText.trim() === '') return { status: 'empty' };
      const seconds = parseMmSs(input.timeText);
      if (seconds === null || seconds <= 0) return { status: 'unreadable' };
      return classifyReferencePace(referencePaceFromRaceTime(meters, seconds));
    }
    case 'test': {
      const text = input.distanceText.replace(/\s/g, ''); // `\s` couvre aussi U+00A0 et U+202F
      if (text === '') return { status: 'empty' };
      const value = parseNumberLoose(text);
      if (value === null || value <= 0) return { status: 'unreadable' };
      const meters = input.system === 'imperial' ? value * METERS_PER_MILE : value;
      // Pas `referencePaceFromCooperTest`, qui rend `null` sous 400 m : un test de 300 m doit se dire
      // « trop lent », pas « vide » (relecture de la spec, constat 11).
      return classifyReferencePace(referencePaceFromRaceTime(meters, COOPER_TEST.durationS));
    }
    case 'known': {
      if (input.paceText.trim() === '') return { status: 'empty' };
      const sPerKm = parsePaceText(input.paceText, input.system);
      if (sPerKm === null) return { status: 'unreadable' };
      return classifyReferencePace(sPerKm);
    }
  }
}

/** Les quatre allures montrées par l'aperçu et le profil — l'ordre de « Mes allures » (R5). */
export const TRAINING_PACE_TYPES = ['endurance', 'sortie_longue', 'recuperation', 'fractionne'] as const satisfies readonly SessionType[];

/** Les quatre plages qu'une allure de référence produit : exactement celles des séances. */
export function trainingPaceBands(
  refSPerKm: number,
): { type: (typeof TRAINING_PACE_TYPES)[number]; range: PaceRange }[] {
  return TRAINING_PACE_TYPES.map((type) => ({ type, range: sessionTargetPace(type, refSPerKm)! }));
}

// ---------------------------------------------------------------------------
// La mise à jour, ensuite (R18, R21)
// ---------------------------------------------------------------------------

/** L'allure (s/km) qu'un temps 5 km donne — l'arrondi que le stockage applique depuis RUN-14. */
export function referencePaceFromRecord5k(bestTimeSeconds: number): number {
  return Math.round(bestTimeSeconds / 5);
}

/**
 * Un record 5 km de fin de course a-t-il le droit de remplacer l'allure (R18) ?
 *
 * ── Pourquoi « plus rapide seulement » ───────────────────────────────────────────────────────────
 * Le record 5 km est le meilleur segment de 5 km d'une **sortie**, pas une course à fond. Le premier
 * est souvent un footing. Il écrasait sans condition l'allure donnée par le coureur : un 10 km en 52:30
 * (5:02 /km) devenait 6:30 /km au premier footing de 5 km, et la bande d'endurance passait plus lente
 * que le footing lui-même. Un record plus lent ne dit rien de la capacité ; un record plus rapide dit
 * qu'elle a été sous-estimée.
 */
export function shouldRecordUpdateReference(currentSPerKm: number | null, record5kSeconds: number): boolean {
  if (currentSPerKm == null) return true;
  return referencePaceFromRecord5k(record5kSeconds) < currentSPerKm;
}

/** D'où vient l'allure affichée (R21). */
export type ReferencePaceOrigin =
  | { kind: 'none' }
  | { kind: 'record'; timeSeconds: number; achievedAt: string }
  | { kind: 'declared' };

/**
 * Provenance **déduite, jamais stockée** (D6) : la même règle d'égalité que `deleteRun` applique déjà
 * pour décider si l'allure venait du record supprimé. Une allure donnée qui tombe pile sur le record ÷ 5
 * se dit « d'après ton record » : sans gravité, c'est la même valeur.
 */
export function referencePaceOrigin(input: {
  refSPerKm: number | null;
  record5k: { bestTimeSeconds: number; achievedAt: string } | null;
}): ReferencePaceOrigin {
  const { refSPerKm, record5k } = input;
  if (refSPerKm == null) return { kind: 'none' };
  if (record5k && referencePaceFromRecord5k(record5k.bestTimeSeconds) === refSPerKm) {
    return { kind: 'record', timeSeconds: record5k.bestTimeSeconds, achievedAt: record5k.achievedAt };
  }
  return { kind: 'declared' };
}

// ---------------------------------------------------------------------------
// Le test de 12 minutes guidé (R8 → R13)
// ---------------------------------------------------------------------------

/** Le test de Cooper : 12 minutes d'une traite ; une annonce à 11:00, une à 12:00. */
export const COOPER_TEST = { durationS: 720, lastMinuteS: 660 } as const;

export type CooperPhase = 'running' | 'lastMinute' | 'done' | 'interrupted';

/** La phase du test sur le chrono de l'écran (sans auto-pause ni pause : le temps depuis le départ). */
export function cooperPhase(netSeconds: number, interrupted: boolean): CooperPhase {
  if (interrupted) return 'interrupted';
  if (netSeconds >= COOPER_TEST.durationS) return 'done';
  if (netSeconds >= COOPER_TEST.lastMinuteS) return 'lastMinute';
  return 'running';
}

/** Les secondes qu'il reste — jamais négatives. */
export function cooperRemainingS(netSeconds: number): number {
  return Math.max(0, COOPER_TEST.durationS - Math.floor(netSeconds));
}

export type CooperCue = 'lastMinute' | 'done';

/**
 * L'annonce à faire en passant de `previous` à `current` (R10), ou `null`.
 *
 * `previous === null` = l'écran vient de se monter : on adopte l'état **sans parler** (la règle du
 * fantôme, FANT-01 R7) — revenir sur l'écran ne rejoue rien. Un saut direct au-delà de 12:00 (app
 * revenue au premier plan) ne dit que « terminé ». Après une interruption, plus rien.
 */
export function cooperCue(previous: CooperPhase | null, current: CooperPhase): CooperCue | null {
  if (previous === null || previous === current) return null;
  if (previous === 'interrupted' || current === 'interrupted') return null;
  if (current === 'done') return 'done';
  if (current === 'lastMinute' && previous === 'running') return 'lastMinute';
  return null;
}

export type CooperMeasure =
  | { status: 'noTrack' }
  | { status: 'incomplete'; lastSeconds: number }
  | { status: 'interrupted' }
  | { status: 'ok' | 'tooFast' | 'tooSlow'; distanceM: number; sPerKm: number };

/**
 * La distance à 12:00, mesurée sur la trace (R11, R12).
 *
 * ── Pourquoi la trace, et pourquoi `cumulativeDistances` ─────────────────────────────────────────
 * La mesure ne doit dépendre ni du moment du Stop, ni de l'écran resté allumé. `t` est compté depuis
 * le départ de la course : sans auto-pause et sans pause (R9, R10), c'est le chrono de l'écran. On
 * prend la distance **filtrée des records** (un point aberrant ne gonfle rien) et on l'interpole à
 * 720 s. Un trou GPS compte son temps et sa distance en ligne droite — le profil du fantôme, lui,
 * gardait la distance d'un trou et jetait son temps, ce qui aurait gonflé la mesure (relecture, 1).
 *
 * Ordre des refus : pas de trace, puis incomplet (un « Terminer » avant 12:00), puis interrompu (une
 * pause puis une reprise), puis hors bornes.
 */
export function measureCooperTest(points: ReadonlyArray<GpsPoint>, opts: { interrupted: boolean }): CooperMeasure {
  const valid = points.filter((p) => isValidCoord(p.lat, p.lng) && Number.isFinite(p.t));
  if (valid.length < 2) return { status: 'noTrack' };

  const last = valid[valid.length - 1]!;
  if (last.t < COOPER_TEST.durationS) return { status: 'incomplete', lastSeconds: Math.round(last.t) };
  if (opts.interrupted) return { status: 'interrupted' };

  const cum = cumulativeDistances(valid);
  const target = COOPER_TEST.durationS;
  let distance = cum[cum.length - 1]!;
  for (let i = 1; i < valid.length; i++) {
    const before = valid[i - 1]!;
    const after = valid[i]!;
    if (after.t < target) continue;
    const span = after.t - before.t;
    const ratio = span > 0 ? Math.min(1, Math.max(0, (target - before.t) / span)) : 1;
    distance = cum[i - 1]! + (cum[i]! - cum[i - 1]!) * ratio;
    break;
  }

  const distanceM = Math.round(distance);
  if (distanceM <= 0) return { status: 'noTrack' };
  const evaluation = classifyReferencePace(referencePaceFromRaceTime(distanceM, target));
  if (evaluation.status !== 'ok' && evaluation.status !== 'tooFast' && evaluation.status !== 'tooSlow') {
    return { status: 'noTrack' };
  }
  return { status: evaluation.status, distanceM, sPerKm: evaluation.sPerKm };
}

// ---------------------------------------------------------------------------
// L'accueil du pilier (R14, R16)
// ---------------------------------------------------------------------------

export type RunningWelcomeInput = {
  /** Appareil connecté au service de synchronisation. */
  online: boolean;
  /** Une synchronisation s'est terminée pendant ce lancement de l'app. */
  syncedThisLaunch: boolean;
  profileLoading: boolean;
  /** Une ligne `running_profiles` existe (même vide). */
  hasProfile: boolean;
  hasActiveRun: boolean;
  /** L'accueil a déjà été ouvert pendant ce lancement. */
  alreadyOpened: boolean;
};

/**
 * L'accueil s'ouvre-t-il (R14) ?
 *
 * ⚠️ **En ligne et synchronisé pendant ce lancement, pas seulement « déjà synchronisé une fois ».**
 * L'accueil écrit une ligne de profil à son ouverture. Un second téléphone hors ligne, synchronisé
 * avant que le profil existe, en créerait une seconde : refusée par l'unicité de `user_id`, l'erreur
 * bloquerait **toute** sa file d'envoi (relecture de la spec, constat 2).
 */
export function shouldOpenRunningWelcome(input: RunningWelcomeInput): boolean {
  return (
    input.online &&
    input.syncedThisLaunch &&
    !input.profileLoading &&
    !input.hasProfile &&
    !input.hasActiveRun &&
    !input.alreadyOpened
  );
}

export const RUNNING_VOICE_CHOICES = ['all', 'intervals', 'none'] as const;
export type RunningVoiceChoice = (typeof RUNNING_VOICE_CHOICES)[number];

/**
 * Ce que la question « la voix pendant la course » écrit (R16). Le guidage commande aussi les alertes
 * d'allure de toute séance (`active.tsx`) : le libellé du choix le dit.
 */
export function voiceChoicePatch(choice: RunningVoiceChoice): {
  voiceAnnouncementsEnabled: boolean;
  intervalGuidanceEnabled: boolean;
} {
  return {
    voiceAnnouncementsEnabled: choice === 'all',
    intervalGuidanceEnabled: choice !== 'none',
  };
}
