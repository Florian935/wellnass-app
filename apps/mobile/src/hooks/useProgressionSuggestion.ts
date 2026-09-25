/**
 * La dernière fois d'un exercice et la suggestion du jour pour une série — US MUSCU-UX07, R11.
 *
 * Une seule source pour la séance (série courante) et le hub (première série des exercices de la
 * séance du jour) : les mêmes trois lectures, le même calcul. Voir `lib/progression-suggestion.ts`.
 *
 * `exerciseId` vide : aucune ligne, aucune suggestion — le patron des hooks du dépôt, appelables
 * sans condition (règle des hooks).
 */

import type { ProgressionSuggestion } from '@wellness/shared';
import { usePriorWeekAdherence } from '@/data/repositories/planned-session-repository';
import { useLastPerformance, usePreviousStruggled } from '@/data/repositories/workout-repository';
import { progressionSuggestionFor, type LastPerfEntry } from '@/lib/progression-suggestion';

export function useProgressionSuggestion(
  exerciseId: string,
  rang: number,
  /** Programme et semaine de l'occurrence : la séance en cours, ou celle du jour pour le hub. */
  program: { programId: string | null; weekIndex: number | null },
): { lastPerf: LastPerfEntry[]; suggestion: ProgressionSuggestion } {
  const lastPerf = useLastPerformance(exerciseId);
  const previousStruggled = usePreviousStruggled(exerciseId);
  const priorWeekAdherenceOk = usePriorWeekAdherence(program.programId, program.weekIndex);
  return {
    lastPerf,
    suggestion: progressionSuggestionFor(lastPerf, rang, { previousStruggled, priorWeekAdherenceOk }),
  };
}
