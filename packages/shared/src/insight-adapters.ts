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
import { EVEN_SHARE, type MuscleBalance, type MuscleGroupBalance } from './muscle-balance';
import { NOTABLE_CHANGE_PCT, type InsightCandidate } from './insights';
import type { RecordType } from './records';
import type { OvertrainingGuardResult } from './training-time';
import type { DeficitVolumeAlert } from './bodyweight';
import type { WeeklyReview } from './weekly-review';

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

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

/** Tout ce que le repository doit rassembler pour produire la liste de candidats. */
export type InsightSources = {
  overtrainingGuard: OvertrainingGuardResult;
  trainingLoad: { show: boolean; ratio: number | null };
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
