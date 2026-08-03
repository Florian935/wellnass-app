/**
 * Guidage fractionné vocal + vibration (US RUN-F2d, roadmap 5.18).
 *
 * Une séance fractionné structurée (US RUN-F2c, `session_intervals`) se linéarise en une liste
 * ordonnée de *phases* : pour chaque bloc, dans l'ordre, `reps` fois la paire (phase rapide, phase
 * récup si présente). C'est à chaque changement de phase — pas seulement de ligne de bloc — que
 * l'annonce est utile (spec R1) : un bloc `reps=6` avec récup produit 12 phases, pas 2.
 */

export type IntervalPhaseBlockInput = {
  reps: number;
  fastDistanceM: number | null;
  fastDurationSeconds: number | null;
  fastPacePctVma: number | null;
  recoveryDistanceM: number | null;
  recoveryDurationSeconds: number | null;
};

export type ExpandedIntervalPhase = {
  kind: 'fast' | 'recovery';
  blockIndex: number;
  /** 1-based : la 1ère répétition du bloc est `rep = 1`. */
  rep: number;
  totalReps: number;
  distanceM: number | null;
  durationSeconds: number | null;
  /** Uniquement significatif pour `kind === 'fast'` (RUN-F2c R4 : nullable, jamais inventé). */
  fastPacePctVma: number | null;
};

/** Linéarise les blocs d'une séance en liste de phases (spec §1, R1). */
export function expandIntervalPhases(
  blocks: readonly IntervalPhaseBlockInput[],
): ExpandedIntervalPhase[] {
  const phases: ExpandedIntervalPhase[] = [];
  blocks.forEach((block, blockIndex) => {
    for (let rep = 1; rep <= block.reps; rep += 1) {
      phases.push({
        kind: 'fast',
        blockIndex,
        rep,
        totalReps: block.reps,
        distanceM: block.fastDistanceM,
        durationSeconds: block.fastDurationSeconds,
        fastPacePctVma: block.fastPacePctVma,
      });
      const hasRecovery = block.recoveryDistanceM != null || block.recoveryDurationSeconds != null;
      if (hasRecovery) {
        phases.push({
          kind: 'recovery',
          blockIndex,
          rep,
          totalReps: block.reps,
          distanceM: block.recoveryDistanceM,
          durationSeconds: block.recoveryDurationSeconds,
          fastPacePctVma: null,
        });
      }
    }
  });
  return phases;
}

/**
 * Une phase est-elle franchie, vue depuis son propre point de départ (pas depuis le début de la
 * course) ? Exactement une des deux cibles est renseignée (RUN-F2c R2/R3) ; si aucune ne l'est
 * (ne devrait pas arriver), retourne `false` — jamais une exception.
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
  /** `true` si au moins une phase a été franchie pendant ce resync. */
  advanced: boolean;
};

/**
 * Avance l'index de phase autant de fois que nécessaire (spec R8 bis) — une boucle, jamais un
 * simple pas unique : la distance/durée courante peut avoir franchi plusieurs seuils d'un coup
 * (écran non monté pendant tout un rapide + sa récup, spec R5/R8). `advanced` indique si au moins
 * une transition a eu lieu ; à l'appelant de décider s'il l'annonce (silencieux au premier calcul
 * suivant un remontage, spec R8 bis).
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
    // Avance la baseline de l'axe utilisé par CETTE phase, exactement de sa cible — jamais un
    // "snap" à la valeur courante : sinon, quand plusieurs phases sont franchies en une seule
    // évaluation (rattrapage après un remontage), le surplus déjà couvert dans la phase suivante
    // serait effacé au lieu d'être reporté (ex. 700 m parcourus, phase 400 m puis 200 m franchies
    // -> la phase suivante doit repartir de 600 m, pas de 700 m, sous peine de perdre 100 m de
    // progression déjà réelle). L'axe non utilisé par la phase n'est pas touché.
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
