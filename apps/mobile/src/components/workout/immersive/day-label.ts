/**
 * Nommer la séance de référence — US MUSCU-UX03, spec §5.3.
 *
 * « vs mardi » se lit instantanément ; « vs 02/08 » demande un calcul mental. On nomme donc le jour
 * tant qu'il n'y a aucune ambiguïté — **moins de 7 jours**, la règle que porte déjà
 * `computeSetVerdict` via `dayKind`. Au-delà, deux mardis pourraient se disputer le mot : la date
 * reprend la main.
 *
 * Le calcul du `dayKind` reste dans `packages/shared` (testé) ; ce fichier ne fait que **rendre** le
 * mot, parce que le nom d'un jour dépend de la langue de l'appareil.
 */

import type { ReferenceDayKind } from '@wellness/shared';

/**
 * Libellé du jour d'une séance de référence, ou `null` s'il n'y en a pas.
 *
 * @param finishedAt Fin de la séance de référence (UTC ISO).
 * @param dayKind    Résolu par `computeSetVerdict` — jour nommé, date, ou rien.
 * @param language   Langue courante d'i18next (`fr`, `en`…).
 */
export function referenceDayLabel(
  finishedAt: string | null | undefined,
  dayKind: ReferenceDayKind,
  language: string,
): string | null {
  if (!finishedAt || dayKind === 'none') return null;
  const date = new Date(finishedAt);
  if (Number.isNaN(date.getTime())) return null;

  if (dayKind === 'named') {
    return new Intl.DateTimeFormat(language, { weekday: 'long' }).format(date);
  }
  return new Intl.DateTimeFormat(language, { day: '2-digit', month: '2-digit' }).format(date);
}

/** Fin de séance la plus récente parmi des références — le jour que le fantôme porte (spec §5.10). */
export function latestReferenceDate(
  references: Readonly<Record<string, { finishedAt: string | null }>>,
): string | null {
  let latest: string | null = null;
  for (const reference of Object.values(references)) {
    if (!reference.finishedAt) continue;
    if (latest === null || reference.finishedAt > latest) latest = reference.finishedAt;
  }
  return latest;
}

/** Une référence de moins de 7 jours se nomme par son jour (« mardi »), au-delà par sa date. */
const NAMED_DAY_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Le jour du fantôme : la référence la plus récente de la séance, nommée.
 *
 * ⚠️ `now` est lu **ici** et non chez l'appelant : `Date.now()` dans le corps d'un composant est
 * un appel impur au milieu d'un rendu (règle `react-hooks/purity`), et c'est exactement le genre
 * de valeur qui change d'un rendu à l'autre sans raison visible.
 */
export function ghostDayLabel(
  references: Readonly<Record<string, { finishedAt: string | null }>>,
  language: string,
  now: number = Date.now(),
): string | null {
  const latest = latestReferenceDate(references);
  if (!latest) return null;
  const age = now - new Date(latest).getTime();
  return referenceDayLabel(latest, age < NAMED_DAY_LIMIT_MS ? 'named' : 'date', language);
}
