/**
 * Linearisation d'une seance de course structuree en liste ordonnee de PHASES.
 *
 * Origine : US RUN-F2d (roadmap 5.18) — guidage fractionne vocal + vibration. Une seance
 * structuree (`session_intervals`) se linearise en phases : pour chaque bloc, dans l'ordre,
 * `reps` fois la paire (phase rapide, phase recup si presente). C'est a chaque changement de
 * phase — pas seulement de ligne de bloc — que l'annonce est utile (RUN-F2d R1) : un bloc
 * `reps=6` avec recup produit 12 phases, pas 2.
 *
 * Etendu par US RUN-F4 (lots B, C, D) apres l'analyse du 04/09/2026
 * (docs/product/analyse-seances-structurees-running.md) :
 *  - **lot B** — chaque segment porte sa NATURE (`kind`) : echauffement, gammes, corps, recup
 *    autonome, retour au calme. 24 seances sur 24 du plan analyse prescrivent un echauffement,
 *    aucune n'etait representable.
 *  - **lot C** — une fraction bornee en distance peut porter un CHRONO CIBLE
 *    (« 400 m en 1:38 »), distinct de son etendue.
 *  - **lot D** — des segments consecutifs de meme `groupKey` forment un groupe repete
 *    `groupReps` fois : « 3 x (800 m + 400 m) », les pyramides, les echelles.
 *
 * Retrocompatibilite stricte : tous les champs ajoutes sont optionnels. Un bloc RUN-F2c
 * (sans `kind`, sans `groupKey`) se linearise exactement comme avant.
 */

import {
  DEFAULT_SEGMENT_KIND,
  normalizePaceRange,
  paceAtVmaPercent,
  paceFromDistanceAndTime,
  type PaceRange,
  type RecoveryKind,
  type ResolvedPace,
  type SegmentKind,
} from './running-paces';

export type IntervalPhaseBlockInput = {
  reps: number;
  fastDistanceM: number | null;
  fastDurationSeconds: number | null;
  fastPacePctVma: number | null;
  recoveryDistanceM: number | null;
  recoveryDurationSeconds: number | null;

  // ---- US RUN-F4, tous optionnels (un bloc RUN-F2c reste valide tel quel) ----

  /** Nature du segment (lot B). Absent => `'work'`, le sens des lignes RUN-F2c. */
  kind?: SegmentKind | null;
  /** Libelle libre (« lignes droites », « bloc cle »). */
  label?: string | null;

  /** Plage d'allure ABSOLUE de la phase rapide, en s/km (lot A). */
  fastPaceMinSPerKm?: number | null;
  fastPaceMaxSPerKm?: number | null;

  /**
   * Chrono cible de la fraction quand elle est bornee en distance (lot C).
   * N'est PAS l'etendue : `fastDistanceM` borne la phase, ceci est la cible a tenir dedans.
   */
  fastTargetTimeMinSeconds?: number | null;
  fastTargetTimeMaxSeconds?: number | null;

  /** Nature et allure de la recuperation (lot A) — « trot tres lent » vs « marche active ». */
  recoveryKind?: RecoveryKind | null;
  recoveryPaceMinSPerKm?: number | null;
  recoveryPaceMaxSPerKm?: number | null;

  /** Imbrication (lot D) : segments consecutifs de meme cle = un groupe repete. */
  groupKey?: string | null;
  groupReps?: number | null;
};

export type ExpandedIntervalPhase = {
  kind: 'fast' | 'recovery';
  blockIndex: number;
  /** 1-based : la 1ere repetition du bloc est `rep = 1`. */
  rep: number;
  totalReps: number;
  distanceM: number | null;
  durationSeconds: number | null;
  /** Uniquement significatif pour `kind === 'fast'` (RUN-F2c R4 : nullable, jamais invente). */
  fastPacePctVma: number | null;

  // ---- US RUN-F4 ----

  /** Nature du segment d'origine (lot B). */
  segmentKind: SegmentKind;
  label: string | null;
  /** Plage d'allure explicite de CETTE phase (rapide ou recup selon `kind`), en s/km. */
  paceMinSPerKm: number | null;
  paceMaxSPerKm: number | null;
  /** Chrono cible de la fraction (lot C) — milieu de la plage saisie, `null` si absente. */
  targetTimeSeconds: number | null;
  /** Nature de la recuperation, uniquement sur `kind === 'recovery'`. */
  recoveryKind: RecoveryKind | null;
  /** 1-based : quelle repetition DU GROUPE (lot D). Vaut 1 hors groupe. */
  groupRep: number;
  /** Nombre total de repetitions du groupe. Vaut 1 hors groupe. */
  groupTotalReps: number;
};

/** Milieu d'une plage de chrono cible ; `null` si aucune borne. Une seule borne => elle-meme. */
function midTargetTime(
  min: number | null | undefined,
  max: number | null | undefined,
): number | null {
  const lo = min != null && min > 0 ? min : null;
  const hi = max != null && max > 0 ? max : null;
  if (lo == null && hi == null) return null;
  if (lo == null) return hi;
  if (hi == null) return lo;
  return (lo + hi) / 2;
}

type BlockWithIndex = { block: IntervalPhaseBlockInput; index: number };
type GroupRun = { members: BlockWithIndex[]; reps: number };

/**
 * Decoupe la liste de blocs en « series » a repeter (lot D).
 *
 * Des blocs CONSECUTIFS partageant la meme `groupKey` non nulle forment un groupe, repete
 * `groupReps` fois — la valeur du PREMIER membre fait foi (elle est dupliquee sur chaque ligne
 * en base, cf. la migration : pas de seconde table pour un seul niveau d'imbrication).
 * Un bloc sans `groupKey` est une serie d'un seul membre, jouee une fois : c'est exactement le
 * comportement RUN-F2c, obtenu sans cas particulier.
 *
 * « Consecutifs » et non « partout dans la seance » : deux groupes distincts peuvent reutiliser
 * la meme cle sans fusionner, et surtout l'ORDRE de la seance reste celui des `order_index`.
 */
function groupRuns(blocks: readonly IntervalPhaseBlockInput[]): GroupRun[] {
  const runs: GroupRun[] = [];
  blocks.forEach((block, index) => {
    const key = block.groupKey ?? null;
    const previous = runs[runs.length - 1];
    const previousKey =
      previous != null && previous.members.length > 0
        ? (previous.members[0]!.block.groupKey ?? null)
        : null;

    if (key !== null && previous != null && previousKey === key) {
      previous.members.push({ block, index });
      return;
    }
    // `groupReps` n'a de sens qu'avec une cle ; sans cle, une serie se joue une fois.
    const reps = key !== null && block.groupReps != null && block.groupReps > 0 ? block.groupReps : 1;
    runs.push({ members: [{ block, index }], reps });
  });
  return runs;
}

/** Linearise les blocs d'une seance en liste de phases (RUN-F2d §1, R1 ; RUN-F4 lots B/C/D). */
export function expandIntervalPhases(
  blocks: readonly IntervalPhaseBlockInput[],
): ExpandedIntervalPhase[] {
  const phases: ExpandedIntervalPhase[] = [];

  for (const run of groupRuns(blocks)) {
    for (let groupRep = 1; groupRep <= run.reps; groupRep += 1) {
      for (const { block, index } of run.members) {
        const segmentKind = block.kind ?? DEFAULT_SEGMENT_KIND;
        const label = block.label ?? null;
        const targetTimeSeconds = midTargetTime(
          block.fastTargetTimeMinSeconds,
          block.fastTargetTimeMaxSeconds,
        );

        for (let rep = 1; rep <= block.reps; rep += 1) {
          phases.push({
            kind: 'fast',
            blockIndex: index,
            rep,
            totalReps: block.reps,
            distanceM: block.fastDistanceM,
            durationSeconds: block.fastDurationSeconds,
            fastPacePctVma: block.fastPacePctVma,
            segmentKind,
            label,
            paceMinSPerKm: block.fastPaceMinSPerKm ?? null,
            paceMaxSPerKm: block.fastPaceMaxSPerKm ?? null,
            targetTimeSeconds,
            recoveryKind: null,
            groupRep,
            groupTotalReps: run.reps,
          });

          const hasRecovery =
            block.recoveryDistanceM != null || block.recoveryDurationSeconds != null;
          if (hasRecovery) {
            phases.push({
              kind: 'recovery',
              blockIndex: index,
              rep,
              totalReps: block.reps,
              distanceM: block.recoveryDistanceM,
              durationSeconds: block.recoveryDurationSeconds,
              fastPacePctVma: null,
              segmentKind,
              label,
              paceMinSPerKm: block.recoveryPaceMinSPerKm ?? null,
              paceMaxSPerKm: block.recoveryPaceMaxSPerKm ?? null,
              targetTimeSeconds: null,
              recoveryKind: block.recoveryKind ?? null,
              groupRep,
              groupTotalReps: run.reps,
            });
          }
        }
      }
    }
  }
  return phases;
}

/**
 * L'allure cible effective d'une phase, et sa provenance (US RUN-F4, lot A).
 *
 * Ordre : allure absolue saisie > chrono cible sur la distance > `%VMA` (repli RUN-F2c).
 * Le `%VMA` n'est PAS supprime — les deux coexistent, c'est l'arbitrage 1 de l'analyse §7 :
 * il reste la seule source des seances deja saisies, et un plan sans allure de reference ne
 * pourrait pas le convertir.
 *
 * `vmaPaceSPerKm` = allure a 100 % VMA (typiquement `derivedVmaPace(ref5kPaceSPerKm)`), `null`
 * si le profil n'a pas d'allure de reference — le repli `%VMA` est alors inexploitable, ce qui
 * est correct : mieux vaut « — » qu'un nombre invente.
 */
export function resolvePhasePace(
  phase: ExpandedIntervalPhase,
  vmaPaceSPerKm: number | null | undefined,
): ResolvedPace | null {
  const explicit = normalizePaceRange(phase.paceMinSPerKm, phase.paceMaxSPerKm);
  if (explicit !== null) return { range: explicit, source: 'explicit' };

  const fromTime = paceFromDistanceAndTime(phase.distanceM, phase.targetTimeSeconds);
  if (fromTime !== null) {
    return { range: { minSPerKm: fromTime, maxSPerKm: fromTime }, source: 'target-time' };
  }

  if (phase.fastPacePctVma != null && vmaPaceSPerKm != null && vmaPaceSPerKm > 0) {
    const pace = paceAtVmaPercent(vmaPaceSPerKm, phase.fastPacePctVma);
    return { range: { minSPerKm: pace, maxSPerKm: pace }, source: 'derived' };
  }
  return null;
}

/**
 * Une phase est-elle franchie, vue depuis son propre point de depart (pas depuis le debut de la
 * course) ? Si aucune cible n'est renseignee, retourne `false` — jamais une exception.
 *
 * ⚠️ **La distance l'emporte sur la duree, et c'est ce qui rend le lot C correct sans toucher a
 * cette fonction** : depuis RUN-F4, une fraction peut porter les deux (« 400 m en 1:38 »). La
 * distance est alors l'ETENDUE (ce qui termine la phase) et le chrono la CIBLE (porte a part,
 * dans `targetTimeSeconds`, jamais dans `durationSeconds`). La precedence ci-dessous etait deja
 * la bonne.
 */
export function isIntervalPhaseComplete(
  phase: ExpandedIntervalPhase,
  distanceSincePhaseStartM: number,
  durationSincePhaseStartS: number,
): boolean {
  if (phase.distanceM != null) return distanceSincePhaseStartM >= phase.distanceM;
  if (phase.durationSeconds != null) return durationSincePhaseStartS >= phase.durationSeconds;
  return false;
}

export type IntervalResyncResult = {
  index: number;
  phaseStartDistanceM: number;
  phaseStartDurationS: number;
  /** `true` si au moins une phase a ete franchie pendant ce resync. */
  advanced: boolean;
};

/**
 * Avance l'index de phase autant de fois que necessaire (RUN-F2d R8 bis) — une boucle, jamais un
 * simple pas unique : la distance/duree courante peut avoir franchi plusieurs seuils d'un coup
 * (ecran non monte pendant tout un rapide + sa recup, R5/R8). `advanced` indique si au moins
 * une transition a eu lieu ; a l'appelant de decider s'il l'annonce (silencieux au premier calcul
 * suivant un remontage).
 */
export function resyncIntervalPhase(
  phases: readonly ExpandedIntervalPhase[],
  fromIndex: number,
  distanceM: number,
  durationS: number,
  phaseStartDistanceM: number,
  phaseStartDurationS: number,
): IntervalResyncResult {
  let index = fromIndex;
  let startD = phaseStartDistanceM;
  let startT = phaseStartDurationS;
  let advanced = false;
  while (index < phases.length) {
    const phase = phases[index]!;
    if (!isIntervalPhaseComplete(phase, distanceM - startD, durationS - startT)) break;
    // Avance la baseline de l'axe utilise par CETTE phase, exactement de sa cible — jamais un
    // "snap" a la valeur courante : sinon, quand plusieurs phases sont franchies en une seule
    // evaluation (rattrapage apres un remontage), le surplus deja couvert dans la phase suivante
    // serait efface au lieu d'etre reporte (ex. 700 m parcourus, phase 400 m puis 200 m franchies
    // -> la phase suivante doit repartir de 600 m, pas de 700 m, sous peine de perdre 100 m de
    // progression deja reelle). L'axe non utilise par la phase n'est pas touche.
    if (phase.distanceM != null) {
      startD += phase.distanceM;
    } else if (phase.durationSeconds != null) {
      startT += phase.durationSeconds;
    }
    index += 1;
    advanced = true;
  }
  return { index, phaseStartDistanceM: startD, phaseStartDurationS: startT, advanced };
}

// ---------------------------------------------------------------------------
// Volume d'une seance structuree (US RUN-F4) — le « volume estime » du plan analyse
// ---------------------------------------------------------------------------

export type SessionVolume = {
  /** Somme des distances de toutes les phases qui en portent une. */
  distanceM: number;
  /** Somme des durees de toutes les phases qui en portent une. */
  durationSeconds: number;
  /** Nombre de phases rapides — « combien de repetitions au total ». */
  fastPhaseCount: number;
  /**
   * `true` si au moins une phase n'a NI distance NI duree : le total est alors un plancher,
   * pas une valeur. L'UI doit ecrire « au moins X », jamais « X ».
   */
  partial: boolean;
};

/**
 * Volume total d'une seance structuree, echauffement et retour au calme COMPRIS — c'est
 * precisement ce que le plan analyse chiffre dans ses colonnes « volume estime » et « duree
 * estimee », et qui manquait tant que l'echauffement n'etait pas modelisable.
 */
export function sessionVolume(phases: readonly ExpandedIntervalPhase[]): SessionVolume {
  let distanceM = 0;
  let durationSeconds = 0;
  let fastPhaseCount = 0;
  let partial = false;

  for (const phase of phases) {
    if (phase.kind === 'fast') fastPhaseCount += 1;
    if (phase.distanceM != null) distanceM += phase.distanceM;
    if (phase.durationSeconds != null) durationSeconds += phase.durationSeconds;
    if (phase.distanceM == null && phase.durationSeconds == null) partial = true;
  }
  return { distanceM, durationSeconds, fastPhaseCount, partial };
}

/** Plage d'allure d'une phase, resolue — raccourci de lecture pour l'UI. */
export function phasePaceRange(
  phase: ExpandedIntervalPhase,
  vmaPaceSPerKm: number | null | undefined,
): PaceRange | null {
  return resolvePhasePace(phase, vmaPaceSPerKm)?.range ?? null;
}
