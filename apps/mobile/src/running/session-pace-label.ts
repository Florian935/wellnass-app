/**
 * Libellé d'allure cible d'une séance, pour les surfaces en LECTURE SEULE
 * (détail de programme, carte de planning). US RUN-F4, lot A.
 *
 * Pourquoi ce fichier existe : les deux écrans calculaient chacun leur libellé avec
 * `sessionTargetPace(type, ref5k)` — la bande **dérivée**. Depuis RUN-F4, une séance peut porter
 * une allure **saisie**, et l'afficher n'était fait nulle part : on tapait « 4:20–4:25 » et
 * l'écran continuait d'annoncer la bande d'endurance. Ça ne ressemblait pas à un manque, ça
 * ressemblait à un bug.
 *
 * La règle de priorité (explicite > chrono > dérivée) vit dans `resolveSessionPace`, testée dans
 * `@wellness/shared`. Ici on ne fait que la **formater** — et on dit d'où vient le nombre, parce
 * qu'une allure saisie par l'utilisateur et une allure devinée par l'app ne se lisent pas pareil.
 */

import type { TFunction } from 'i18next';
import { resolveSessionPace, type ProgramSessionType } from '@wellness/shared';

export type SessionPaceLabelInput = {
  sessionType: ProgramSessionType | null;
  targetDistanceM?: number | null;
  targetTimeSeconds?: number | null;
  targetPaceMinSPerKm?: number | null;
  targetPaceMaxSPerKm?: number | null;
  ref5kPaceSPerKm: number | null;
};

export type SessionPaceLabel = {
  /** « 4:20 – 4:25 » ou « 4:00 » si la plage est dégénérée. */
  text: string;
  /** Provenance, à afficher en second plan — jamais au même niveau que le nombre. */
  sourceKey: string;
};

/**
 * Construit le libellé, ou `null` si aucune allure n'est calculable.
 *
 * `formatPace` est injecté (il vient de `useUnits`) : ce module ne doit pas connaître le système
 * d'unités de l'utilisateur, sinon il faudrait le mocker partout.
 *
 * ⚠️ **Retourne `null` plutôt qu'un texte de repli.** L'appelant garde la main : le détail de
 * programme affiche déjà « renseigne ton allure de référence » à la place, et c'est un message
 * d'écran, pas une valeur d'allure.
 */
export function sessionPaceLabel(
  input: SessionPaceLabelInput,
  formatPace: (sPerKm: number | null) => string,
): SessionPaceLabel | null {
  const resolved = resolveSessionPace({
    explicitMinSPerKm: input.targetPaceMinSPerKm,
    explicitMaxSPerKm: input.targetPaceMaxSPerKm,
    sessionType: input.sessionType,
    targetDistanceM: input.targetDistanceM,
    targetTimeSeconds: input.targetTimeSeconds,
    ref5kPaceSPerKm: input.ref5kPaceSPerKm,
  });
  if (resolved === null) return null;

  const { minSPerKm, maxSPerKm } = resolved.range;
  const text =
    minSPerKm === maxSPerKm
      ? formatPace(minSPerKm)
      : `${formatPace(minSPerKm)} – ${formatPace(maxSPerKm)}`;

  const sourceKey =
    resolved.source === 'explicit'
      ? 'running.consigne.paceSourceExplicit'
      : resolved.source === 'target-time'
        ? 'running.consigne.paceSourceTargetTime'
        : 'running.consigne.paceSourceDerived';

  return { text, sourceKey };
}

/** Variante « une seule chaîne », pour les surfaces trop denses pour deux lignes. */
export function sessionPaceLabelText(
  t: TFunction,
  input: SessionPaceLabelInput,
  formatPace: (sPerKm: number | null) => string,
): string | null {
  const label = sessionPaceLabel(input, formatPace);
  if (label === null) return null;
  // La provenance n'est rappelée que si l'allure a été SAISIE : c'est la seule information
  // dont la lecture change (« ce nombre vient de toi, pas d'un calcul »). Sur une allure
  // dérivée, l'annoncer alourdirait chaque ligne sans rien apprendre.
  return label.sourceKey === 'running.consigne.paceSourceExplicit'
    ? `${label.text} · ${t(label.sourceKey)}`
    : label.text;
}
