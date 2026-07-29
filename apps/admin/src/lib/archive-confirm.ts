/**
 * US ADMIN-01 — message de confirmation d'archivage, décomptes d'usage inclus.
 *
 * Le back-office confirme partout avec `window.confirm` (exercices, programmes, aliments) : on garde
 * ce patron plutôt que d'introduire une modale maison, et on y injecte les décomptes. La valeur de
 * l'US n'est pas la forme du dialogue, c'est **qu'on n'archive plus en aveugle**.
 *
 * Trois messages distincts, et cette distinction est le cœur du garde-fou :
 *  1. des usages → on les liste, puis « Archiver quand même ? » ;
 *  2. aucun usage → on le **dit** (une liste vide se lirait comme un bug) ;
 *  3. décompte indisponible → on **avertit** que l'archivage se ferait à l'aveugle, au lieu de
 *     laisser croire à un zéro rassurant.
 */

import type { UsageSummary } from '@wellness/shared';

import { fr } from '../i18n/fr';

/** Texte à passer à `window.confirm` avant d'archiver un contenu éditorial. */
export function archiveConfirmMessage(baseConfirm: string, usage: UsageSummary): string {
  const t = fr.archive;

  if (usage.unavailable) {
    return `${baseConfirm}\n\n${t.usageUnavailable}\n\n${t.usageConfirm}`;
  }

  if (usage.isUnused) {
    return `${baseConfirm}\n\n${t.usageNone}`;
  }

  const lines = usage.lines
    .map((l) => `  • ${l.count} ${t.usageLabels[l.key] ?? l.key}`)
    .join('\n');

  return `${baseConfirm}\n\n${t.usageIntro}\n${lines}\n\n${t.usageConfirm}`;
}
