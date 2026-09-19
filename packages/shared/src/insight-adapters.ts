/**
 * US INSIGHTS-01 — conversion des signaux livrés en candidats pour le moteur (`insights.ts`).
 *
 * Une fonction pure par source. Chacune reçoit la sortie **déjà calculée** du signal et rend un
 * `InsightCandidate` ou `null` (« rien à dire maintenant »). Aucune analyse n'est calculée ici :
 * c'est la règle §1.2 de la spec, et c'est elle qui a fait écarter quatre sources au cadrage —
 * `readiness`, `concurrent_interference`, `activity_level` et les jalons de série ne portent aucun
 * nombre, donc ne pouvaient pas satisfaire R1 sans qu'on leur en invente un.
 *
 * Ces fonctions vivent dans `shared` et non dans le repository parce qu'elles portent les **règles**
 * (quels chiffres, quelle date, quel pilier) : le repository ne doit contenir que du câblage.
 *
 * ⚠️ **Aucune date par défaut.** `occurredOn` vaut la date réelle du fait, ou `null` s'il n'y en a
 * pas. Mettre `todayKey` par défaut affirmerait une fraîcheur fausse et neutraliserait la porte des
 * 14 jours du moteur.
 */

import type { GoalKind, GoalStatus } from './goals';
import type { PaceProgress } from './pace-progress';
import { POLARISATION_REFERENCE_LOW_PCT, type Polarisation } from './pace-zone-mix';
import type { RecordDistanceKey } from './pace-records';
import { EVEN_SHARE, type MuscleBalance, type MuscleGroupBalance } from './muscle-balance';
import { NOTABLE_CHANGE_PCT, type InsightCandidate } from './insights';
import type { RecordType } from './records';
import type { ConcurrentTrainingInterference, OvertrainingGuardResult } from './training-time';
import type { ReadinessResult } from './readiness';
import type { DeficitVolumeAlert } from './bodyweight';
import type { WeeklyReview } from './weekly-review';

/**
 * La suggestion de niveau d'activité, réduite à ce dont l'adaptateur a besoin. Type structurel
 * plutôt qu'import : `ActivityLevelSuggestion` vit côté mobile (`dashboard-repository.ts`), et
 * `shared` ne doit pas en dépendre.
 */
export type ActivityLevelSuggestionInput =
  | { show: false }
  | { show: true; suggested: string; runningDays: number };

// ---------------------------------------------------------------------------
// Famille `alert`
// ---------------------------------------------------------------------------

/**
 * Garde-fou charge & récupération (GARDE-01). Deux niveaux de gravité, donc deux messages : le
 * niveau part en `variant`. Aucun `occurredOn` — c'est un **état** en cours, pas un fait daté, et
 * il doit insister tant qu'il dure.
 */
export function candidateFromOvertrainingGuard(
  result: OvertrainingGuardResult,
): InsightCandidate | null {
  if (!result.show || result.severity === null) return null;
  return {
    id: 'overtraining_guard',
    family: 'alert',
    variant: result.severity,
    metrics: { streakDays: result.streakDays },
    occurredOn: null,
    pillars: ['strength', 'running'],
  };
}

/**
 * Charge aiguë / chronique (META-19). Le ratio n'est disponible que depuis la modification du
 * §2.5 de la spec : `useTrainingLoadAlert` le calculait puis le jetait, ce qui rendait l'alerte
 * inaffichable ici (R1 interdit une affirmation sans chiffre).
 *
 * Arrondi à 2 décimales : « 1,42 » se lit, « 1,4238095238 » non. Le seuil de risque n'est
 * volontairement **pas** transporté — le redire ici dupliquerait une constante qui vit déjà dans
 * `training-time.ts`, et la formulation i18n s'en passe très bien.
 */
export function candidateFromTrainingLoad(alert: {
  show: boolean;
  ratio: number | null;
}): InsightCandidate | null {
  if (!alert.show || alert.ratio === null) return null;
  return {
    id: 'training_load',
    family: 'alert',
    metrics: { ratio: Math.round(alert.ratio * 100) / 100 },
    occurredOn: null,
    pillars: ['strength', 'running'],
  };
}

/**
 * Score de forme (TRI-03), converti en carte par **INSIGHTS-02** (décision D3-B).
 *
 * Ne se déclenche **que** sur le verdict `rest` : un `ok` n'a rien à dire, et un `push` serait une
 * célébration qui n'en est pas une (l'utilisateur n'a rien accompli, il est juste frais).
 *
 * Les deux chiffres se dérivent des trois composantes déjà classées — aucune analyse nouvelle.
 */
export function candidateFromReadiness(result: ReadinessResult): InsightCandidate | null {
  if (!result.show || result.verdict !== 'rest') return null;
  return {
    id: 'readiness',
    family: 'alert',
    metrics: { negativeCount: result.negativeCount, availableCount: result.availableCount },
    occurredOn: null,
    pillars: [],
  };
}

/**
 * Divergence muscu/course (MR-08). Les deux ratios n'existent que depuis la modification du §R3
 * d'INSIGHTS-02 — ils étaient calculés puis jetés.
 *
 * `null` dès qu'**un** des deux manque : la carte compare deux tendances, en afficher une seule
 * n'aurait aucun sens. C'est le cas réel où la base chronique d'un pilier est vide.
 */
export function candidateFromInterference(
  result: ConcurrentTrainingInterference,
): InsightCandidate | null {
  if (!result.show || result.direction === null) return null;
  if (result.runRatio === null || result.strengthRatio === null) return null;
  return {
    id: 'concurrent_interference',
    family: 'alert',
    variant: result.direction,
    metrics: {
      runRatio: Math.round(result.runRatio * 100) / 100,
      strengthRatio: Math.round(result.strengthRatio * 100) / 100,
    },
    occurredOn: null,
    pillars: ['strength', 'running'],
  };
}

/**
 * Suggestion de niveau d'activité TDEE (RN-03).
 *
 * ⚠️ La spec d'INSIGHTS-01 affirmait que ce signal ne portait « aucune quantité » — **c'était
 * faux** : `runningDays` existe, et c'est exactement le chiffre qui justifie la suggestion
 * (« 4 jours de course sur 14 »). L'erreur a été trouvée en cadrant INSIGHTS-02.
 */
export function candidateFromActivityLevel(
  suggestion: ActivityLevelSuggestionInput,
): InsightCandidate | null {
  if (!suggestion.show) return null;
  return {
    id: 'activity_level',
    family: 'alert',
    variant: suggestion.suggested,
    metrics: { runningDays: suggestion.runningDays },
    occurredOn: null,
    pillars: ['running', 'nutrition'],
  };
}

/** Déficit calorique sous fort volume muscu (4.32). Deux chiffres, tous deux déjà calculés. */
export function candidateFromDeficitVolume(alert: DeficitVolumeAlert): InsightCandidate | null {
  if (!alert.show) return null;
  return {
    id: 'deficit_volume',
    family: 'alert',
    metrics: { deficitPct: alert.deficitPct, loggedDays: alert.loggedDays },
    occurredOn: null,
    pillars: ['strength', 'nutrition'],
  };
}

// ---------------------------------------------------------------------------
// Famille `celebration`
// ---------------------------------------------------------------------------

/** Un record muscu, réduit à ce dont l'adaptateur a besoin. `achievedOn` est une **clé de jour**. */
export type RecordCandidateInput = {
  type: RecordType;
  value: number;
  exerciseName: string;
  achievedOn: string;
};

/**
 * Le record muscu le plus récent. Le type part en `variant` : un volume ne se formate pas comme
 * une charge (`best_volume` est en kg cumulés, `max_weight` suit les unités de l'utilisateur) —
 * c'est déjà la distinction que fait `RecordRecentCard`.
 *
 * Le tri est refait ici plutôt que supposé : la requête ordonne bien par date décroissante, mais
 * une fonction pure qui dépend de l'ordre de son entrée est une fonction fragile.
 */
export function candidateFromRecentRecord(
  records: ReadonlyArray<RecordCandidateInput>,
): InsightCandidate | null {
  if (records.length === 0) return null;
  const latest = [...records].sort((a, b) => b.achievedOn.localeCompare(a.achievedOn))[0]!;
  return {
    id: 'record_recent',
    family: 'celebration',
    variant: latest.type,
    metrics: { value: latest.value },
    subject: latest.exerciseName,
    occurredOn: latest.achievedOn,
    pillars: ['strength'],
  };
}

/**
 * Un record de course, réduit à ce dont l'adaptateur a besoin (US CARDIO-UX02).
 *
 * `label` est **déjà résolu** (« 5 km », « Semi ») : la table `RUNNING_RECORD_DISTANCES` porte des
 * clés, pas des libellés, et `shared` ne traduit pas — même règle que `exerciseName` plus haut.
 */
export type RunRecordCandidateInput = {
  distanceKey: RecordDistanceKey;
  label: string;
  bestTimeSeconds: number;
  /** **Clé de jour** du record (`AAAA-MM-JJ`), jamais un ISO complet. */
  achievedOn: string;
};

/**
 * Le record de course le plus récent (RUN-03).
 *
 * ⚠️ `running_pace_records` ne garde **qu'une ligne par distance** : il n'y a pas d'historique, donc
 * pas d'écart avec le record précédent à afficher. C'est la même limite que la scène d'arrivée
 * assume déjà (« l'app ne garde pas l'historique des records, donc l'écart avec l'estimation d'hier
 * n'est pas calculable »). On dit le chrono, et rien de plus.
 *
 * La porte des 14 jours du moteur fait le reste du travail : un record de mars ne remonte pas.
 */
export function candidateFromRunningRecord(
  records: ReadonlyArray<RunRecordCandidateInput>,
): InsightCandidate | null {
  const usable = records.filter((r) => Number.isFinite(r.bestTimeSeconds) && r.bestTimeSeconds > 0);
  if (usable.length === 0) return null;
  const latest = [...usable].sort((a, b) => b.achievedOn.localeCompare(a.achievedOn))[0]!;
  return {
    id: 'run_record_recent',
    family: 'celebration',
    variant: latest.distanceKey,
    metrics: { seconds: Math.round(latest.bestTimeSeconds) },
    subject: latest.label,
    occurredOn: latest.achievedOn,
    pillars: ['running'],
  };
}

/** Un objectif clos, réduit à ce dont l'adaptateur a besoin. `label` est **déjà résolu**. */
export type GoalCandidateInput = {
  label: string;
  kind: GoalKind;
  targetValue: number;
  currentValue: number | null;
  deadline: string;
  status: GoalStatus;
};

/**
 * Un objectif **atteint** (OBJ-01).
 *
 * ⚠️ **Ce ne sont pas les jalons.** `GOAL_MILESTONES` (25/50/75 %) est documenté dans `goals.ts`
 * comme « des repères, **pas des récompenses** » — décision D4 d'OBJ-01. En faire une célébration
 * inverserait un arbitrage produit daté. Un objectif atteint, lui, est un accomplissement.
 *
 * `occurredOn` = l'échéance : un objectif ne bascule en `achieved` qu'à sa clôture, la fenêtre de
 * mesure étant plafonnée par `goalWindowEnd`. La porte des 14 jours s'applique donc normalement.
 *
 * Un objectif sans `currentValue` (exercice supprimé) est **écarté** : on ne célèbre pas une
 * réussite dont on ne peut plus citer le chiffre.
 */
export function candidateFromGoalAchieved(
  goals: ReadonlyArray<GoalCandidateInput>,
): InsightCandidate | null {
  const achieved = goals
    .filter((g) => g.status === 'achieved' && g.currentValue !== null)
    .sort((a, b) => b.deadline.localeCompare(a.deadline));
  const latest = achieved[0];
  if (latest === undefined) return null;
  return {
    id: 'goal_achieved',
    family: 'celebration',
    variant: latest.kind,
    metrics: { achievedValue: latest.currentValue as number, targetValue: latest.targetValue },
    subject: latest.label,
    occurredOn: latest.deadline,
    pillars: latest.kind === 'run_distance' ? ['running'] : ['strength'],
  };
}

// ---------------------------------------------------------------------------
// Famille `change`
// ---------------------------------------------------------------------------

/**
 * La décision de la semaine (BILAN-01), reprise **telle quelle** — `kind` en `variant`, `metrics`
 * et `subject` transmis sans retouche. C'est ce qui garantit qu'INSIGHTS-01 ne redouble pas le
 * moteur de décision hebdomadaire : si la priorité de BILAN-01 change, elle change à un seul
 * endroit et cette carte suit.
 *
 * `all_good` est **écarté**. C'est la branche « rien à redire » de BILAN-01 : en présence d'autres
 * cartes elle n'apporte rien, et en leur absence l'état vide de l'écran le dit mieux.
 */
export function candidateFromWeeklyDecision(review: WeeklyReview): InsightCandidate | null {
  if (review.isEmpty || review.decision === null) return null;
  if (review.decision.kind === 'all_good') return null;
  return {
    id: 'weekly_decision',
    family: 'change',
    variant: review.decision.kind,
    metrics: review.decision.metrics,
    ...(review.decision.subject === undefined ? {} : { subject: review.decision.subject }),
    occurredOn: review.period.end,
    pillars: [],
  };
}

/**
 * Le groupe musculaire le plus délaissé (un seul, même si plusieurs le sont) : trois cartes
 * « muscle négligé » diraient trois fois la même chose. Les parts sont converties en points de
 * pourcentage ici, pour que l'i18n n'ait plus qu'à interpoler.
 */
export function candidateFromMuscleBalance(balance: MuscleBalance): InsightCandidate | null {
  if (!balance.hasEnoughData || balance.neglected.length === 0) return null;
  const neglectedGroups = balance.groups.filter((g) => balance.neglected.includes(g.muscle));
  const worst = neglectedGroups.reduce<MuscleGroupBalance | null>(
    (lowest, g) => (lowest === null || g.share < lowest.share ? g : lowest),
    null,
  );
  if (worst === null) return null;
  return {
    id: 'muscle_neglected',
    family: 'change',
    metrics: {
      sharePct: Math.round(worst.share * 100),
      evenSharePct: Math.round(EVEN_SHARE * 100),
      sets: worst.sets,
    },
    subject: worst.muscle,
    occurredOn: null,
    pillars: ['strength'],
  };
}

/** Un favori délaissé, réduit à ce dont l'adaptateur a besoin. `name` est **déjà résolu**. */
export type NeglectedCandidateInput = {
  name: string;
  weeksSince: number;
  neverPracticed: boolean;
};

/**
 * Le favori le plus délaissé (EXEC-01 / MUSC-21).
 *
 * ⚠️ Un exercice **jamais pratiqué** depuis son ajout aux favoris est écarté : `weeksSince` n'y
 * mesure alors que l'ancienneté du favori, pas un abandon. Dire « tu n'as pas fait ça depuis
 * 12 semaines » d'un exercice qu'on n'a jamais fait serait faux, et c'est le genre de phrase qui
 * fait perdre confiance dans toutes les autres.
 *
 * `occurredOn: null` : c'est un **état**, pas un fait daté — il ne se périme donc pas au bout des
 * 14 jours de `isStale`, exactement comme `muscle_neglected`.
 */
export function candidateFromNeglectedExercise(
  neglected: ReadonlyArray<NeglectedCandidateInput>,
): InsightCandidate | null {
  const actionable = neglected.filter((n) => !n.neverPracticed && n.weeksSince > 0);
  if (actionable.length === 0) return null;
  const worst = actionable.reduce((a, b) => (b.weeksSince > a.weeksSince ? b : a));
  return {
    id: 'exercise_neglected',
    family: 'change',
    metrics: { weeks: worst.weeksSince },
    subject: worst.name,
    occurredOn: null,
    pillars: ['strength'],
  };
}

/**
 * Les variations de tonnage et de distance de la semaine close, au-delà de ±15 %
 * (`NOTABLE_CHANGE_PCT`). Sans ce seuil, l'écran annoncerait « ton tonnage a bougé de 0,4 % ».
 *
 * `pct === null` (semaine précédente à zéro) ne produit **aucun** candidat : « +100 % » depuis rien
 * serait une flatterie mensongère, même règle que BILAN-01. Le sens part en `variant`, ce qui
 * permet de réutiliser les formulations `review.changeUp` / `review.changeDown` déjà validées.
 */
export function candidatesFromWeeklyChanges(review: WeeklyReview): InsightCandidate[] {
  if (review.isEmpty) return [];
  const out: InsightCandidate[] = [];

  const push = (id: 'tonnage_change' | 'distance_change', pillar: 'strength' | 'running') => {
    const change = id === 'tonnage_change' ? review.changes.tonnage : review.changes.distance;
    if (change === null || change.pct === null) return;
    if (Math.abs(change.pct) < NOTABLE_CHANGE_PCT) return;
    out.push({
      id,
      family: 'change',
      variant: change.direction,
      metrics: { pct: Math.abs(change.pct) },
      occurredOn: review.period.end,
      pillars: [pillar],
    });
  };

  push('tonnage_change', 'strength');
  push('distance_change', 'running');
  return out;
}

/**
 * L'écart d'allure entre les deux fenêtres de 30 jours (RUN-05 / `pace-progress.ts`).
 *
 * Ne produit **rien** sur un visage `onboarding` ou `empty` : ils ne portent pas de comparaison, et
 * R1 interdit une affirmation sans chiffre. Ne produit rien non plus sur un écart classé `flat` —
 * « ton allure n'a pas bougé » n'est pas un insight, c'est un silence qui s'est cru utile.
 *
 * `occurredOn: null` : c'est un **état** mesuré sur une fenêtre glissante, pas un fait daté. Il ne
 * se périme donc pas au bout des 14 jours, exactement comme `muscle_neglected`.
 */
export function candidateFromPaceProgress(progress: PaceProgress): InsightCandidate | null {
  if (progress.kind !== 'established') return null;
  if (progress.direction === 'flat') return null;
  return {
    id: 'pace_trend',
    family: 'change',
    variant: progress.direction,
    metrics: {
      seconds: Math.abs(progress.deltaSPerKm),
      paceSPerKm: progress.currentPaceSPerKm,
    },
    occurredOn: null,
    pillars: ['running'],
  };
}

/**
 * La polarisation de l'entraînement (RUN-08), livrée par ALLURE-01 le 07/08/2026 et restée
 * jusqu'ici confinée au bas de `/running-history`.
 *
 * ⚠️ Le repère ~80/20 est **nommé, jamais prescrit** — c'est la réserve inscrite au catalogue, et
 * elle est reportée telle quelle : les deux nombres partent en `metrics`, la formulation i18n les
 * met côte à côte sans dire lequel est « bon ». Un coureur en préparation 5 km a de bonnes raisons
 * d'être à 70/30.
 */
export function candidateFromPolarisation(
  polarisation: Polarisation | null,
): InsightCandidate | null {
  // `computePolarisation` rend déjà `null` sous le seuil de courses ou sans allure de référence :
  // on ne redouble pas sa garde ici, on lui fait confiance (même parti pris que les autres
  // adaptateurs, qui ne recalculent jamais la condition d'existence de leur source).
  if (polarisation === null) return null;
  return {
    id: 'polarisation',
    family: 'change',
    metrics: {
      lowPct: Math.round(polarisation.lowIntensityPct),
      referencePct: POLARISATION_REFERENCE_LOW_PCT,
      km: polarisation.totalKm,
    },
    occurredOn: null,
    pillars: ['running'],
  };
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

/** Tout ce que le repository doit rassembler pour produire la liste de candidats. */
export type InsightSources = {
  overtrainingGuard: OvertrainingGuardResult;
  trainingLoad: { show: boolean; ratio: number | null };
  readiness: ReadinessResult;
  interference: ConcurrentTrainingInterference;
  activityLevel: ActivityLevelSuggestionInput;
  deficitVolume: DeficitVolumeAlert;
  records: ReadonlyArray<RecordCandidateInput>;
  goals: ReadonlyArray<GoalCandidateInput>;
  weeklyReview: WeeklyReview | null;
  muscleBalance: MuscleBalance | null;
};

/**
 * Assemble la liste complète des candidats à partir des signaux bruts.
 *
 * Vit ici, et non dans le repository mobile, pour une raison précise : c'est **la** composition de
 * l'US, et la garder pure la rend testable à 100 % sans React ni base. Le repository se réduit
 * alors à du câblage de hooks — la partie qu'aucun test unitaire de ce dépôt ne couvre de toute
 * façon (la convention y teste le SQL, pas les hooks).
 *
 * `weeklyReview` et `muscleBalance` sont nullables parce que leurs hooks peuvent n'avoir encore
 * rien à donner ; les autres sources ont toujours une forme, fût-elle « éteinte ».
 */
export function buildInsightCandidates(sources: InsightSources): InsightCandidate[] {
  const candidates: Array<InsightCandidate | null> = [
    candidateFromOvertrainingGuard(sources.overtrainingGuard),
    candidateFromTrainingLoad(sources.trainingLoad),
    candidateFromReadiness(sources.readiness),
    candidateFromInterference(sources.interference),
    candidateFromActivityLevel(sources.activityLevel),
    candidateFromDeficitVolume(sources.deficitVolume),
    candidateFromRecentRecord(sources.records),
    candidateFromGoalAchieved(sources.goals),
    sources.weeklyReview === null ? null : candidateFromWeeklyDecision(sources.weeklyReview),
    sources.muscleBalance === null ? null : candidateFromMuscleBalance(sources.muscleBalance),
  ];

  const changes =
    sources.weeklyReview === null ? [] : candidatesFromWeeklyChanges(sources.weeklyReview);

  return [...candidates.filter((c): c is InsightCandidate => c !== null), ...changes];
}
