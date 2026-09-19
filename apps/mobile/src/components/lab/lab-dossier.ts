/**
 * US NARR-01 — le dossier envoyé au modèle, construit **à partir de ce que l'écran affiche**.
 *
 * ── Pourquoi passer par les mêmes `t()` que le panneau ────────────────────────────────────────
 * Parce que c'est ce qui rend le garde-fou possible. Les nombres autorisés sont ceux du dossier ;
 * si le texte envoyé au modèle n'était pas **exactement** celui montré à l'utilisateur, un résumé
 * juste pourrait citer un chiffre que l'écran n'affiche pas — et serait rejeté — tandis qu'un
 * chiffre affiché mais non envoyé passerait pour inventé. Une seule source, donc aucun écart.
 *
 * C'est aussi la garantie de minimisation (spec R4) : rien ne part qui ne soit déjà sous les yeux
 * de la personne.
 */

import type { LabExperimentKind, LabQuestion, NarrationDossier } from '@wellness/shared';

/** La fonction de traduction, réduite à ce qu'on en utilise. */
type Translate = (key: string, options?: Record<string, unknown>) => string;

export function buildLabDossier(
  question: LabQuestion,
  experiment: LabExperimentKind | null,
  t: Translate,
): NarrationDossier {
  return {
    headline: t(`lab.questions.${question.kind}.detected`, question.values),
    facts: question.suspects.map((suspect) => ({
      label: t(`lab.suspects.${suspect.kind}.title`),
      detail: t(`lab.suspects.${suspect.kind}.proof`, suspect.values),
      // Les valeurs brutes complètent le texte : un ratio affiché « 34 % » y figure en 0,34, et le
      // garde-fou accepte alors les deux écritures.
      values: Object.values(suspect.values),
    })),
    cleared: question.cleared.map((kind) => t(`lab.suspects.${kind}.short`)),
    missing: question.missing.map((kind) => t(`lab.suspects.${kind}.short`)),
    experiment: experiment === null ? null : t(`lab.experiments.${experiment}.title`),
  };
}
