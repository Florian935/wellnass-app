/**
 * US BILAN-01 — bilan hebdomadaire automatique (roadmap 7.16).
 *
 * Aucune dépendance React ni base : du calcul, testé sous Vitest.
 *
 * ── La règle non négociable ───────────────────────────────────────────────────────────────────────
 * **Aucune narration sans les chiffres qui la justifient.** Ici, ce n'est pas une consigne de revue :
 * c'est le **type** qui l'impose. Un `ReviewDecision` transporte obligatoirement ses `metrics`, donc
 * un signal sans ses chiffres ne compile pas. Le texte, lui, est assemblé côté UI depuis des clés
 * i18n avec ces nombres interpolés — **jamais de texte libre, jamais d'IA**.
 *
 * ── Pourquoi la décision est choisie par des règles ORDONNÉES (décision D2) ──────────────────────
 * La première règle qui déclenche gagne. C'est déterministe, testable, et surtout **explicable** :
 * on peut répondre à « pourquoi ce conseil et pas l'autre ? ». Un score d'urgence par signal aurait
 * demandé des pondérations arbitraires, indéfendables et impossibles à tester sérieusement.
 * Changer l'ordre de priorité ne touche pas au calcul — seulement à la table `SIGNAL_ORDER`.
 */

import { percentChange, type PercentChange } from './comparison';
import { addDays, localDayKey, startOfWeek } from './date';

/** Retard de progression, en points, au-delà duquel un objectif est signalé (§5). */
export const GOAL_BEHIND_THRESHOLD = 0.15;

/** Chute de jours actifs (vs semaine précédente) qui déclenche le signal de régularité. */
export const CONSISTENCY_DROP_DAYS = 3;

/** Baisse relative de volume / distance qui déclenche le signal de décrochage. */
export const VOLUME_DROP_PCT = -25;

/** Part minimale de jours journalisés dans la cible avant de signaler l'adhérence. */
export const NUTRITION_ADHERENCE_FLOOR = 0.5;

/** Fenêtre d'une semaine ISO, bornes incluses (clés `AAAA-MM-JJ`). */
export type ReviewPeriod = { start: string; end: string };

/**
 * Dernière semaine ISO **close** (lundi → dimanche) à la date `ref` (décision D5).
 *
 * Un bilan sur une semaine close est **définitif** : il ne bougera plus, quoi que fasse
 * l'utilisateur ensuite. Même raisonnement que le verdict d'un objectif (OBJ-01, D5).
 *
 * Conséquence voulue : consulté un **dimanche**, le bilan montre encore la semaine d'avant — la
 * semaine en cours n'est pas terminée, la résumer serait faux.
 */
export function lastClosedWeek(ref: Date): ReviewPeriod {
  const thisMonday = startOfWeek(ref);
  return {
    start: localDayKey(addDays(thisMonday, -7)),
    end: localDayKey(addDays(thisMonday, -1)),
  };
}

/** Semaine précédant `period`, pour la comparaison. */
export function previousWeek(period: ReviewPeriod): ReviewPeriod {
  const [y, m, d] = period.start.split('-').map(Number);
  const start = new Date(y!, m! - 1, d!);
  return {
    start: localDayKey(addDays(start, -7)),
    end: localDayKey(addDays(start, -1)),
  };
}

/** Chiffres d'un pilier sur une semaine. `null` = pilier inactif, donc rien à dire. */
export type PillarWeek = {
  /** Séances de muscu terminées. */
  workouts: number;
  /** Tonnage cumulé (kg). */
  tonnageKg: number;
  /** Sorties de course terminées. */
  runs: number;
  /** Distance cumulée (m). */
  distanceM: number;
  /** Jours avec au moins 1 kcal journalisée. */
  loggedDays: number;
  /** Jours dans la cible calorique. `null` si aucune cible n'est définie. */
  daysInTarget: number | null;
  /** Jours actifs au sens de la série (0-7). */
  activeDays: number;
};

/** Un objectif réduit à ce dont le bilan a besoin (fourni par le repository). */
export type ReviewGoal = {
  id: string;
  /** Libellé déjà résolu (nom d'exercice ou type d'objectif). */
  label: string;
  /** Progression 0-1, ou `null` si non calculable (exercice supprimé). */
  ratio: number | null;
  /** Part du temps écoulé, 0-1. */
  elapsedRatio: number;
};

/** Entrée du calcul : tout est **déjà agrégé** par le repository, borné sur la même fenêtre (D6). */
export type WeeklyReviewInput = {
  period: ReviewPeriod;
  current: PillarWeek;
  /** Semaine précédente. `null` = première semaine d'utilisation, donc **aucune comparaison**. */
  previous: PillarWeek | null;
  /** Records battus pendant la semaine. */
  recordsBeaten: number;
  goals: ReadonlyArray<ReviewGoal>;
  /** Groupe musculaire nettement sous-travaillé sur la fenêtre, si un tel groupe existe. */
  underworkedMuscle: string | null;
  /** Piliers activés — un pilier inactif ne produit ni chiffre ni signal (arbitrage H). */
  activePillars: { strength: boolean; running: boolean; nutrition: boolean };
};

/** Nature de la décision de la semaine. L'ordre du tableau **est** la priorité (D2). */
export const SIGNAL_ORDER = [
  'goal_behind',
  'consistency_drop',
  'muscle_imbalance',
  'volume_drop',
  'nutrition_drift',
  'all_good',
] as const;

export type SignalKind = (typeof SIGNAL_ORDER)[number];

/**
 * La décision unique de la semaine.
 *
 * `metrics` n'est pas optionnel, et c'est **le** point de ce type : un signal doit transporter les
 * chiffres qui le justifient, sinon l'UI ne pourrait afficher qu'une affirmation nue.
 */
export type ReviewDecision = {
  kind: SignalKind;
  /** Nombres à interpoler dans la clé i18n correspondante. */
  metrics: Record<string, number>;
  /** Libellé de contexte déjà résolu (nom d'objectif, groupe musculaire), si le signal en porte un. */
  subject?: string;
};

/** Variation d'une mesure entre les deux semaines. `null` s'il n'y a rien à comparer. */
export type ReviewChange = PercentChange | null;

export type WeeklyReview = {
  period: ReviewPeriod;
  current: PillarWeek;
  previous: PillarWeek | null;
  recordsBeaten: number;
  /** Variations, `null` en l'absence de semaine précédente (pas de « +100 % » depuis zéro). */
  changes: {
    tonnage: ReviewChange;
    distance: ReviewChange;
    activeDays: ReviewChange;
    loggedDays: ReviewChange;
  };
  /** Vrai si la semaine n'a **aucune** activité : rien à résumer (décision D4). */
  isEmpty: boolean;
  /** La décision de la semaine. `null` **seulement** si la semaine est vide. */
  decision: ReviewDecision | null;
};

/** Vrai si la semaine ne contient aucune activité, tous piliers confondus. */
export function isEmptyWeek(week: PillarWeek): boolean {
  return (
    week.workouts === 0 && week.runs === 0 && week.loggedDays === 0 && week.activeDays === 0
  );
}

/**
 * Objectif le plus en retard, ou `null`.
 *
 * Un objectif dont la progression est **non calculable** est ignoré : un retard indéterminable n'est
 * pas un retard, et l'annoncer serait une accusation sans preuve.
 */
function mostBehindGoal(goals: ReadonlyArray<ReviewGoal>): { goal: ReviewGoal; gap: number } | null {
  let worst: { goal: ReviewGoal; gap: number } | null = null;
  for (const goal of goals) {
    if (goal.ratio === null) continue;
    const gap = goal.elapsedRatio - goal.ratio;
    if (gap < GOAL_BEHIND_THRESHOLD) continue;
    if (worst === null || gap > worst.gap) worst = { goal, gap };
  }
  return worst;
}

/**
 * Décision de la semaine, par règles ordonnées (D2).
 *
 * Chaque branche renvoie **ses** chiffres. L'ordre des `if` est l'ordre de `SIGNAL_ORDER`, et c'est
 * volontairement le seul endroit où la priorité est encodée.
 */
function decide(input: WeeklyReviewInput): ReviewDecision {
  const { current, previous, goals, underworkedMuscle, activePillars } = input;

  // 1. Un engagement pris par l'utilisateur lui-même, avec une échéance : rien de plus actionnable.
  const behind = mostBehindGoal(goals);
  if (behind !== null) {
    return {
      kind: 'goal_behind',
      subject: behind.goal.label,
      metrics: {
        progressPct: Math.round((behind.goal.ratio ?? 0) * 100),
        elapsedPct: Math.round(behind.goal.elapsedRatio * 100),
      },
    };
  }

  // 2. La régularité prime sur la performance : une semaine à 1 jour actif mérite d'être nommée
  //    avant un déséquilibre musculaire.
  const activeDrop = previous === null ? 0 : previous.activeDays - current.activeDays;
  if (current.activeDays === 0 || activeDrop >= CONSISTENCY_DROP_DAYS) {
    return {
      kind: 'consistency_drop',
      metrics: {
        activeDays: current.activeDays,
        previousActiveDays: previous?.activeDays ?? 0,
      },
    };
  }

  // 3. Concret, corrigeable en une séance, et c'est ce qui cause les blessures.
  if (activePillars.strength && underworkedMuscle !== null) {
    return {
      kind: 'muscle_imbalance',
      subject: underworkedMuscle,
      metrics: { workouts: current.workouts },
    };
  }

  // 4. Décrochage réel, mais moins urgent que l'absence de régularité.
  if (previous !== null) {
    const tonnage = percentChange(current.tonnageKg, previous.tonnageKg);
    if (activePillars.strength && tonnage.pct !== null && tonnage.pct <= VOLUME_DROP_PCT) {
      return {
        kind: 'volume_drop',
        metrics: { dropPct: Math.abs(Math.round(tonnage.pct)), workouts: current.workouts },
      };
    }
    const distance = percentChange(current.distanceM, previous.distanceM);
    if (activePillars.running && distance.pct !== null && distance.pct <= VOLUME_DROP_PCT) {
      return {
        kind: 'volume_drop',
        metrics: { dropPct: Math.abs(Math.round(distance.pct)), workouts: current.runs },
      };
    }
  }

  // 5. Dernier rang, et c'est délibéré : on ne veut pas ouvrir chaque semaine sur l'alimentation.
  if (
    activePillars.nutrition &&
    current.daysInTarget !== null &&
    current.loggedDays > 0 &&
    current.daysInTarget / current.loggedDays < NUTRITION_ADHERENCE_FLOOR
  ) {
    return {
      kind: 'nutrition_drift',
      metrics: { daysInTarget: current.daysInTarget, loggedDays: current.loggedDays },
    };
  }

  // 6. Rien à redire : on **nomme le point fort** plutôt que d'inventer un problème. Une semaine
  //    réussie doit se lire comme telle.
  return {
    kind: 'all_good',
    metrics: {
      activeDays: current.activeDays,
      workouts: current.workouts,
      runs: current.runs,
      recordsBeaten: input.recordsBeaten,
    },
  };
}

/**
 * Bilan complet d'une semaine : chiffres, variations et **une seule** décision.
 *
 * Les variations sont `null` en l'absence de semaine précédente : afficher « +100 % » parce qu'on
 * part de zéro serait une flatterie mensongère au premier usage.
 */
export function buildWeeklyReview(input: WeeklyReviewInput): WeeklyReview {
  const { current, previous } = input;
  const empty = isEmptyWeek(current);

  const change = (pick: (w: PillarWeek) => number): ReviewChange =>
    previous === null ? null : percentChange(pick(current), pick(previous));

  return {
    period: input.period,
    current,
    previous,
    recordsBeaten: input.recordsBeaten,
    changes: {
      tonnage: change((w) => w.tonnageKg),
      distance: change((w) => w.distanceM),
      activeDays: change((w) => w.activeDays),
      loggedDays: change((w) => w.loggedDays),
    },
    isEmpty: empty,
    // Semaine vide → aucune décision : il n'y a rien à conseiller, et surtout rien à reprocher (D4).
    decision: empty ? null : decide(input),
  };
}
