/**
 * US RUN-F4 (lot J) — des regles d'adaptation qui parlent enfin de LA SEANCE DU JOUR.
 * Ref. : docs/product/analyse-seances-structurees-running.md (mur M15)
 *
 * Le plan analyse se termine par une table « situation -> decision » : douleur mecanique ->
 * arreter ; jambes lourdes apres squat/deadlift -> decaler 24 h ; sommeil court ou HRV degradee
 * -> garder l'echauffement et retirer 20-30 % des repetitions ; deux premieres reps trop dures
 * -> ralentir de 3-5 s/km ; chaleur -> courir a l'effort plutot qu'au chrono.
 *
 * Le constat de l'analyse : **nous avons toutes les ENTREES** de cette table — DOUL-01
 * (douleur), BIEN-01 (energie), RUN-18/META-19 (ACWR), COLLIS-01 (collision jambes/course) —
 * et **aucune SORTIE** : rien ne modifie jamais la seance prevue.
 *
 * Ce fichier ne recalcule rien : il classe et combine, exactement comme `readiness.ts` le fait
 * deja pour le score de forme. Il compose des signaux existants et rend une PROPOSITION.
 *
 * ⚠️ **Strictement consultatif.** Aucune fonction ici n'ecrit, ne modifie une seance ni ne
 * reduit un nombre de repetitions en base. La seance planifiee reste la seance planifiee : on
 * informe et on explique, l'utilisateur decide. C'est le meme parti pris que COLLIS-01
 * (« informe + echange en un tap ») et la seule position defendable — reduire d'office le
 * volume de quelqu'un sur la foi d'un questionnaire a 5 niveaux serait de la prescription.
 */

import type { PainLevel } from './pain-zones';
import type { SessionType } from './running-paces';
import type { AcwrResult } from './training-time';

/** Ce qu'on propose de faire de la seance, du plus grave au plus benin. */
export type AdaptationAction =
  | 'stop'          // ne pas courir du tout
  | 'postpone'      // decaler de 24 h
  | 'convert_easy'  // transformer en footing facile
  | 'reduce_reps'   // garder l'echauffement, retirer des repetitions
  | 'slow_pace'     // meme structure, allure allegee
  | 'effort_based'  // courir a l'effort plutot qu'au chrono
  | 'none';

export type AdaptationSeverity = 'info' | 'caution' | 'alert';

/** Pourquoi on propose ca — un motif = un signal, jamais une synthese opaque. */
export type AdaptationReasonCode =
  | 'pain_blocking'
  | 'pain_present'
  | 'pain_discomfort'
  | 'low_energy'
  | 'load_risk'
  | 'heavy_legs_yesterday'
  | 'heat';

export type AdaptationReason = {
  code: AdaptationReasonCode;
  severity: AdaptationSeverity;
};

export type AdaptationProposal = {
  action: AdaptationAction;
  severity: AdaptationSeverity;
  /** Tous les signaux actifs, tries du plus grave au moins grave. */
  reasons: AdaptationReason[];
  /** Renseigne uniquement si `action === 'reduce_reps'`. Pourcentage entier a retirer. */
  repsReductionPct?: number;
  /** Renseigne uniquement si `action === 'slow_pace'`. Secondes/km a ajouter a la cible. */
  paceSlowdownSPerKm?: number;
};

export type AdaptationSignals = {
  /** Douleur la plus grave declaree recemment (DOUL-01). `null` = rien de declare. */
  worstPainLevel?: PainLevel | null;
  /** Energie du check-in du jour, echelle BIEN-01 1-5. `null` = pas de check-in recent. */
  energyLevel?: number | null;
  /** Charge aigue/chronique (RUN-18 / META-19). `null` = historique insuffisant. */
  acwr?: AcwrResult | null;
  /** Seance jambes lourdes la veille (COLLIS-01, `isHeavyLegSession`). */
  heavyLegSessionYesterday?: boolean;
  /**
   * Temperature exterieure en °C.
   * ⚠️ **Aucune source ne l'alimente aujourd'hui** : la meteo est RUN-F3b, bloquee avant le
   * lancement sur un arbitrage de confidentialite (transmettre une position a un tiers
   * contredit la fiche « Securite des donnees » deja redigee pour LANCE-00). Le parametre
   * existe pour que la regle soit ecrite et testee des maintenant, pas parce qu'elle tourne.
   */
  temperatureC?: number | null;
};

/** Energie a ce niveau ou en dessous = signal negatif. Aligne sur `WELLBEING_LOW_ENERGY`. */
const LOW_ENERGY_THRESHOLD = 2;

/** Au-dela, on court a l'effort. Repere communement admis, non invente par nous. */
const HEAT_THRESHOLD_C = 28;

/** Retrait de repetitions propose. Milieu de la fourchette 20-30 % du plan analyse. */
const REPS_REDUCTION_PCT = 25;

/** Ralentissement propose. Milieu de la fourchette 3-5 s/km du plan analyse. */
const PACE_SLOWDOWN_S_PER_KM = 4;

/** Les seances dont l'intensite justifie une adaptation ; les autres sont deja la solution. */
export function isIntenseSessionType(type: SessionType | null | undefined): boolean {
  return type === 'fractionne' || type === 'test' || type === 'course';
}

const SEVERITY_RANK: Record<AdaptationSeverity, number> = { info: 0, caution: 1, alert: 2 };

/**
 * Propose une adaptation de la seance du jour.
 *
 * **Un seul signal grave suffit** — jamais une moyenne qui lisserait un vrai signal. C'est la
 * regle R4 de `readiness.ts`, reprise telle quelle : une douleur bloquante ne se compense pas
 * par une bonne nuit de sommeil.
 *
 * L'action retenue est celle du signal **le plus grave** ; les autres restent listes dans
 * `reasons` pour que l'explication soit complete. Une seance non intense (endurance,
 * recuperation, sortie longue) ne recoit jamais de proposition d'allegement de volume ou
 * d'allure : c'est deja la seance qu'on proposerait a la place.
 */
export function proposeSessionAdaptation(
  sessionType: SessionType | null | undefined,
  signals: AdaptationSignals,
): AdaptationProposal {
  const reasons: AdaptationReason[] = [];
  const intense = isIntenseSessionType(sessionType);

  // 1. Douleur (DOUL-01). Seul signal qui s'applique quelle que soit l'intensite : une douleur
  //    bloquante ne se contourne pas en courant plus doucement.
  const pain = signals.worstPainLevel ?? null;
  if (pain === 'blocking') reasons.push({ code: 'pain_blocking', severity: 'alert' });
  else if (pain === 'pain') reasons.push({ code: 'pain_present', severity: 'alert' });
  else if (pain === 'discomfort') reasons.push({ code: 'pain_discomfort', severity: 'caution' });

  // 2. Energie declaree (BIEN-01).
  if (signals.energyLevel != null && signals.energyLevel <= LOW_ENERGY_THRESHOLD) {
    reasons.push({ code: 'low_energy', severity: 'caution' });
  }

  // 3. Charge (RUN-18 / META-19). On reutilise la ZONE deja calculee, on ne reinvente pas de
  //    seuil : le 1,3 vit dans `training-time.ts` et nulle part ailleurs.
  if (signals.acwr != null && signals.acwr.zone === 'risk') {
    reasons.push({ code: 'load_risk', severity: 'caution' });
  }

  // 4. Jambes lourdes de la veille (COLLIS-01). Ne concerne que les seances intenses — c'est
  //    exactement le conflit que COLLIS-01 detecte deja, vu depuis la course.
  if (signals.heavyLegSessionYesterday === true && intense) {
    reasons.push({ code: 'heavy_legs_yesterday', severity: 'caution' });
  }

  // 5. Chaleur. Regle ecrite, source absente (cf. `temperatureC`).
  if (signals.temperatureC != null && signals.temperatureC >= HEAT_THRESHOLD_C) {
    reasons.push({ code: 'heat', severity: 'info' });
  }

  reasons.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

  if (reasons.length === 0) {
    return { action: 'none', severity: 'info', reasons: [] };
  }

  const worst = reasons[0]!;

  // Une douleur bloquante arrete la seance, point. Une douleur simple la decale de 24 h plutot
  // que de l'alleger : courir moins vite sur une douleur mecanique reste courir dessus.
  if (worst.code === 'pain_blocking') {
    return { action: 'stop', severity: 'alert', reasons };
  }
  if (worst.code === 'pain_present') {
    return { action: intense ? 'postpone' : 'convert_easy', severity: 'alert', reasons };
  }

  // Signaux de fatigue sur seance intense : on garde l'echauffement et on retire du volume —
  // c'est la decision exacte du plan analyse, et elle preserve la qualite de ce qui reste.
  if (intense && (worst.code === 'low_energy' || worst.code === 'load_risk')) {
    return {
      action: 'reduce_reps',
      severity: 'caution',
      reasons,
      repsReductionPct: REPS_REDUCTION_PCT,
    };
  }
  if (intense && worst.code === 'heavy_legs_yesterday') {
    return {
      action: 'slow_pace',
      severity: 'caution',
      reasons,
      paceSlowdownSPerKm: PACE_SLOWDOWN_S_PER_KM,
    };
  }
  if (worst.code === 'heat') {
    return { action: 'effort_based', severity: 'info', reasons };
  }

  // Reste : une gene, ou un signal de fatigue sur une seance deja facile. On informe sans rien
  // proposer de changer — la seance prevue EST deja la reponse adaptee.
  return { action: 'none', severity: worst.severity, reasons };
}

/**
 * Applique la reduction proposee a un nombre de repetitions, pour l'AFFICHAGE d'un « 8 -> 6 ».
 *
 * Arrondi a l'inferieur et plancher a 1 : proposer « 0 repetition » n'est pas une adaptation,
 * c'est une annulation, et l'annulation a sa propre action (`stop`).
 */
export function reducedReps(reps: number, reductionPct: number): number {
  if (reps <= 1) return reps;
  return Math.max(1, Math.floor(reps * (1 - reductionPct / 100)));
}
