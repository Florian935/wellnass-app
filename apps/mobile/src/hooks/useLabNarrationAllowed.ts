/**
 * US ACCES-IA — le récit d'un dossier du Labo (NARR-01) et du Conseil des trois (CONS-01) est-il
 * proposé ? (spec §4.1, QA1)
 *
 * Ces deux résumés passent par le Labo IA (`coach`) : il faut son accord **et** un accès confirmé. Un
 * accès inconnu (hors ligne, premier rendu) ne suffit pas — l'accord au Labo IA s'écrit en local, et un
 * bouton qui partirait vers un refus « bêta fermée » serait un bouton mort. Un seul crochet pour les deux
 * appelants : la règle ne peut pas diverger de l'un à l'autre.
 */

import { useSettings } from '@/data/repositories/settings-repository';
import { useAiAccess } from '@/hooks/useAiAccess';

export function useLabNarrationAllowed(): boolean {
  const { settings } = useSettings();
  const { access } = useAiAccess();
  return settings?.aiConsentAt != null && access === 'allowed';
}
