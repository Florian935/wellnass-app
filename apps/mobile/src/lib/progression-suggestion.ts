/**
 * La suggestion de progression, partagée entre la séance et le hub — US MUSCU-UX07, règle R11.
 *
 * Le hub affiche, avant de démarrer, la suggestion du jour sur les premiers exercices de la séance.
 * Elle doit être **la même** que celle que la séance affichera pour la première série : même moteur
 * (`computeProgressionSuggestion`), mêmes signaux (avant-dernière séance difficile, assiduité de la
 * semaine précédente du programme), même arrondi à une charge qu'on monte avec des disques. D'où ce
 * module, extrait de `app/workout.tsx` au lieu d'être recopié : une copie aurait dérivé à la
 * première retouche du moteur.
 *
 * Deux longueurs de libellé :
 *  - **long** (`workout.suggestion.*`), celui de la séance et de l'aperçu ;
 *  - **court** (`strengthHub.lastTime.tip.*`), pour une pastille de la carte du jour.
 */

import type { TFunction } from 'i18next';
import {
  computeProgressionSuggestion,
  loadableKg,
  type ProgressionSuggestion,
  type SetType,
} from '@wellness/shared';

/** Une série de la dernière fois, telle que `useLastPerformance` la rend. */
export type LastPerfEntry = {
  weightKg: number | null;
  reps: number | null;
  setType: SetType;
  rpe: number | null;
  durationSeconds: number | null;
};

/** « m:ss », tronqué à la seconde — le format de durée de la séance. */
export function formatSetDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Ramène une charge proposée à ce qu'on monte avec des disques de salle (barre seulement). */
export type LoadProposer = (kg: number | null) => number | null;

export function makeLoadProposer(opts: {
  isBarbell: boolean;
  barKg: number;
  imperial: boolean;
}): LoadProposer {
  return (kg) =>
    kg !== null && opts.isBarbell ? loadableKg(kg, { barKg: opts.barKg, imperial: opts.imperial }) : kg;
}

/**
 * La suggestion pour la série de rang `rang`, à partir de la dernière fois — le calcul exact de la
 * séance. `null` quand le moteur ne propose rien (jamais fait, séance précédente difficile…).
 */
export function progressionSuggestionFor(
  lastPerf: readonly LastPerfEntry[],
  rang: number,
  signals: { previousStruggled: boolean; priorWeekAdherenceOk: boolean | null },
): ProgressionSuggestion {
  return computeProgressionSuggestion(
    lastPerf.map((p) => ({ setType: p.setType, rpe: p.rpe, done: true })),
    lastPerf[rang],
    {
      weightIncrementKg: 2.5,
      durationIncrementSeconds: 10,
      previousStruggled: signals.previousStruggled,
      priorWeekAdherenceOk: signals.priorWeekAdherenceOk ?? undefined,
    },
  );
}

/** Le libellé d'une suggestion, long (séance, aperçu) ou court (pastille du hub). */
export function formatProgressionSuggestion(
  suggestion: ProgressionSuggestion,
  deps: {
    t: TFunction;
    /** `useUnits().formatWeight` : du texte affiché, dans l'unité de l'utilisateur. */
    formatWeight: (kg: number | null) => string;
    propose: LoadProposer;
    short?: boolean;
  },
): string | null {
  if (!suggestion) return null;
  const { t, formatWeight, propose } = deps;
  const ns = deps.short ? 'strengthHub.lastTime.tip' : 'workout.suggestion';
  switch (suggestion.kind) {
    case 'weightOrReps':
      return t(`${ns}.weightOrReps`, {
        weight: formatWeight(propose(suggestion.weightKg)),
        reps: suggestion.reps,
      });
    case 'reps':
      return t(`${ns}.reps`, { reps: suggestion.reps });
    case 'weightHold':
      return t(`${ns}.weightHold`, {
        weight: formatWeight(propose(suggestion.weightKg)),
        reps: suggestion.reps,
      });
    case 'deload':
      return t(`${ns}.deload`, { weight: formatWeight(propose(suggestion.weightKg)) });
    default:
      return t(`${ns}.duration`, { duration: formatSetDuration(suggestion.durationSeconds) });
  }
}
