/**
 * US CARDIO-UX01 (R5 / constat F10) — où en est le coureur dans sa séance, à l'écran.
 *
 * ── Le trou que ça comble ────────────────────────────────────────────────────────────────────────
 * RUN-F4 a été l'US la plus lourde du pilier : segments typés, rampes d'allure, groupes imbriqués,
 * curseur de phase persisté sur `runs`. Toute cette machinerie était pilotée **à la voix**
 * (`useIntervalGuidance` : annonce + vibration) et n'avait **aucune surface visuelle**. L'écran de
 * suivi affichait distance, chrono, allure moyenne, allure instantanée, allure cible — et jamais :
 *
 *   - dans quel segment on est (échauffement / gammes / fraction / récup / retour au calme) ;
 *   - quelle répétition (« 3 sur 6 ») ;
 *   - ce qui reste dans le segment (250 m, ou 0:40) ;
 *   - ce qui vient après.
 *
 * Le seul indice visuel était l'allure cible qui **changeait silencieusement** de valeur quand le
 * segment tournait. Écouteurs retirés, musique forte, annonce manquée, casque déconnecté : le
 * coureur était aveugle au milieu de sa propre séance.
 *
 * ── Aucune seconde source de vérité (règle R5-1) ─────────────────────────────────────────────────
 * Ce module ne **décide** rien : il **lit**. Le curseur de phase est déjà persisté par RUN-F2d
 * (`runs.interval_phase_index`, `interval_phase_start_distance_m`, `interval_phase_start_duration_s`)
 * et c'est le guidage vocal qui l'avance. Le bandeau se reconstruit à partir de lui, exactement
 * comme l'allure cible du segment le faisait déjà. Deux avantages : le visuel et la voix ne
 * peuvent pas se contredire, et un remontage d'écran retrouve l'état sans rien recalculer.
 */

import {
  expandIntervalPhases,
  resolvePhasePace,
  type ExpandedIntervalPhase,
  type IntervalPhaseBlockInput,
} from './running-intervals';
import { progressivePaceTarget } from './run-pace-guidance';
import type { PaceRange, SegmentKind } from './running-paces';

/** Ce qui reste à couvrir dans la phase courante, sur l'axe qui la borne. */
export type SegmentRemaining =
  | { axis: 'distance'; meters: number }
  | { axis: 'duration'; seconds: number };

/** Aperçu de la phase suivante — juste assez pour annoncer ce qui vient. */
export type NextSegment = {
  kind: 'fast' | 'recovery';
  segmentKind: SegmentKind;
  distanceM: number | null;
  durationSeconds: number | null;
};

/** État du bandeau de segment. */
export type RunSegmentBanner =
  | {
      state: 'running';
      /** Phase courante, 1-based sur l'ensemble des phases développées. */
      phaseNumber: number;
      totalPhases: number;
      /** Phase d'effort ou de récupération. */
      kind: 'fast' | 'recovery';
      /** Nature du segment d'origine — c'est elle qui nomme le bandeau. */
      segmentKind: SegmentKind;
      /** Libellé libre du segment (« lignes droites », « bloc clé »), s'il y en a un. */
      label: string | null;
      /** Répétition dans le bloc, 1-based. `totalReps === 1` : rien à annoncer. */
      rep: number;
      totalReps: number;
      /** Ce qui reste, ou `null` si la phase n'est bornée ni en distance ni en durée. */
      remaining: SegmentRemaining | null;
      /** Avancement DANS la phase, 0 → 1. `null` si la phase n'est pas bornée. */
      progress: number | null;
      /** Allure cible de la phase, rampe résolue si elle est progressive. */
      targetRange: PaceRange | null;
      /** Ce qui vient après, ou `null` sur la dernière phase. */
      next: NextSegment | null;
      /** Avancement de la séance entière, 0 → 1 (phases franchies + avancement courant). */
      sessionProgress: number;
    }
  | {
      /**
       * Toutes les phases ont été franchies. On l'annonce explicitement — sans ça le bandeau
       * afficherait « fraction 7 sur 6 », ce qui se lit comme un bug (spec §3).
       */
      state: 'done';
      totalPhases: number;
    };

/** Entrées du bandeau — tout vient du curseur persisté et des cumuls du tracker. */
export type SegmentBannerInput = {
  /** Blocs de la séance planifiée réalisée. Vide = course libre : aucun bandeau. */
  blocks: readonly IntervalPhaseBlockInput[];
  /** Index de phase courant, tel que persisté par RUN-F2d. `null` = pas encore démarré. */
  phaseIndex: number | null;
  /** Distance (m) au franchissement de la phase courante. */
  phaseStartDistanceM: number;
  /** Durée nette (s) au franchissement de la phase courante. */
  phaseStartDurationS: number;
  /** Distance cumulée courante (m). */
  distanceM: number;
  /** Durée nette courante (s). */
  durationSeconds: number;
  /** Allure à VMA (s/km) dérivée du profil, ou `null` — sert au repli `%VMA`. */
  vmaPaceSPerKm: number | null;
};

/** Borne une valeur dans `[0, 1]`. */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

/** Aperçu compact d'une phase, pour l'annonce « puis … ». */
function toNext(phase: ExpandedIntervalPhase | undefined): NextSegment | null {
  if (!phase) return null;
  return {
    kind: phase.kind,
    segmentKind: phase.segmentKind,
    distanceM: phase.distanceM,
    durationSeconds: phase.durationSeconds,
  };
}

/**
 * Ce qui reste dans la phase, et l'avancement qui va avec.
 *
 * L'axe est celui qui **borne** la phase : une fraction de 400 m se décompte en mètres, une phase
 * de 3 min en secondes. Une phase sans borne (« jusqu'à ce que tu veuilles ») ne décompte rien —
 * et c'est un cas réel, pas une donnée manquante.
 */
function resolveRemaining(
  phase: ExpandedIntervalPhase,
  coveredM: number,
  coveredS: number,
): { remaining: SegmentRemaining | null; progress: number | null } {
  if (phase.distanceM != null && phase.distanceM > 0) {
    const done = Math.max(coveredM, 0);
    return {
      remaining: { axis: 'distance', meters: Math.max(phase.distanceM - done, 0) },
      progress: clamp01(done / phase.distanceM),
    };
  }
  if (phase.durationSeconds != null && phase.durationSeconds > 0) {
    const done = Math.max(coveredS, 0);
    return {
      remaining: { axis: 'duration', seconds: Math.max(Math.round(phase.durationSeconds - done), 0) },
      progress: clamp01(done / phase.durationSeconds),
    };
  }
  return { remaining: null, progress: null };
}

/**
 * Résout le bandeau de segment, ou `null` quand il n'y a **rien à dire**.
 *
 * `null` couvre trois situations qui ne sont pas des erreurs : une course libre (aucun bloc), une
 * séance sans structure, et une séance structurée dont le guidage n'a pas encore franchi la
 * première phase. Dans ces cas l'écran ne doit afficher **aucun** bandeau — pas un bandeau vide
 * (règle déjà appliquée par `SessionAdaptationCard` et `PolarisationSection` : rien à dire, rien à
 * l'écran).
 */
export function resolveSegmentBanner(
  input: SegmentBannerInput,
): RunSegmentBanner | null {
  const { blocks, phaseIndex } = input;

  if (blocks.length === 0 || phaseIndex == null || phaseIndex < 0) {
    return null;
  }

  const phases = expandIntervalPhases(blocks);
  if (phases.length === 0) {
    return null;
  }

  // Curseur au-delà de la dernière phase : la séance est finie.
  if (phaseIndex >= phases.length) {
    return { state: 'done', totalPhases: phases.length };
  }

  const phase = phases[phaseIndex]!;
  const coveredM = input.distanceM - input.phaseStartDistanceM;
  const coveredS = input.durationSeconds - input.phaseStartDurationS;
  const { remaining, progress } = resolveRemaining(phase, coveredM, coveredS);

  // Allure cible : celle de la phase, et si elle est progressive, la valeur du moment sur la rampe.
  const baseRange = resolvePhasePace(phase, input.vmaPaceSPerKm)?.range ?? null;
  const targetRange =
    baseRange !== null && phase.paceProgressive && progress !== null
      ? progressivePaceTarget(baseRange, progress)
      : baseRange;

  // Avancement de la séance : les phases franchies, plus l'avancement de la courante. Compter en
  // phases entières ferait sauter la barre par paliers ; l'avancement continu se lit mieux.
  const sessionProgress = clamp01((phaseIndex + (progress ?? 0)) / phases.length);

  return {
    state: 'running',
    phaseNumber: phaseIndex + 1,
    totalPhases: phases.length,
    kind: phase.kind,
    segmentKind: phase.segmentKind,
    label: phase.label,
    rep: phase.rep,
    totalReps: phase.totalReps,
    remaining,
    progress,
    targetRange,
    next: toNext(phases[phaseIndex + 1]),
    sessionProgress,
  };
}

// ---------------------------------------------------------------------------
// Chiffre en héros (règle R5-2 / constat F13)
// ---------------------------------------------------------------------------

/** Les trois métriques qui peuvent occuper le grand chiffre de l'écran de suivi. */
export const HERO_METRICS = ['pace', 'distance', 'duration'] as const;
export type HeroMetric = (typeof HERO_METRICS)[number];

/**
 * Quel chiffre mettre en grand pendant la course (règle R5-2).
 *
 * ── Pourquoi ce n'est pas toujours la distance ───────────────────────────────────────────────────
 * L'écran affichait la distance en 72 px, **toujours**, quelle que soit la séance (constat F13).
 * Or le chiffre qu'on regarde en courant dépend de ce qu'on fait : sur un fractionné c'est
 * l'**allure** (c'est elle qu'on corrige, seconde par seconde) ; sur une sortie longue c'est la
 * **distance** ; sur une séance bornée en durée c'est le **chrono**. Le hub est personnalisable
 * depuis INSIGHTS-02 ; l'écran de course, lui, ne l'était pas — alors que c'est le seul écran
 * qu'on regarde en mouvement.
 *
 * Le réglage utilisateur prime toujours : ce défaut ne fait que **bien commencer**.
 */
export function resolveHeroMetric(input: {
  /** Type de la séance planifiée réalisée, ou `null` pour une course libre. */
  sessionType: string | null;
  /** La séance est-elle bornée en durée plutôt qu'en distance ? */
  boundedByDuration?: boolean;
  /** Choix explicite de l'utilisateur, prioritaire sur le défaut. */
  override?: HeroMetric | null;
}): HeroMetric {
  if (input.override) return input.override;

  // Une séance qu'on borne en minutes se juge au chrono, quel que soit son type.
  if (input.boundedByDuration === true) return 'duration';

  switch (input.sessionType) {
    // On y corrige l'allure à chaque fraction : c'est le chiffre actionnable.
    case 'fractionne':
    case 'test':
      return 'pace';
    // Le but est de couvrir la distance ; l'allure est un moyen.
    case 'sortie_longue':
    case 'course':
      return 'distance';
    default:
      return 'distance';
  }
}
