/**
 * Résolution du **sujet affichable** de la décision hebdomadaire (BILAN-01).
 *
 * ⚠️ `ReviewDecision.subject` n'est pas toujours du texte. Pour la décision `muscle_imbalance`, il
 * vaut `balance.neglected[0]` — une **clé métier** (`back`, `chest`…), pas un libellé. Interpolée
 * telle quelle, elle produisait « Tu délaisses un groupe musculaire : **back** ».
 *
 * Les autres natures de décision portent déjà du texte (`goal_behind` transporte le libellé résolu
 * de l'objectif), d'où la condition plutôt qu'une traduction systématique.
 *
 * Fonction unique et partagée par les surfaces qui rendent cette décision : l'écran `review.tsx` et
 * la carte `weekly_decision` de l'écran « Insights » (via `resolveInsightSubject`). Les avoir
 * laissées diverger est précisément ce qui a produit le défaut : il est resté invisible dans
 * BILAN-01 jusqu'à ce qu'INSIGHTS-01 l'expose sur une troisième surface.
 *
 * ⚠️ Elles étaient **trois** : le widget d'accueil `ReviewCard.tsx` a été supprimé le 08/08/2026,
 * INSIGHTS-02 l'ayant sorti du registre. La leçon, elle, ne dépend pas du nombre de surfaces.
 */

import type { SignalKind } from '@wellness/shared';

/**
 * Le sujet prêt à interpoler. Renvoie `''` en l'absence de sujet — c'est ce qu'attendaient déjà les
 * appelants (`decision.subject ?? ''`), et une clé i18n sans sujet n'utilise pas le placeholder.
 */
export function resolveDecisionSubject(
  kind: SignalKind,
  subject: string | undefined,
  t: (key: string) => string,
): string {
  if (subject === undefined) return '';
  return kind === 'muscle_imbalance' ? t(`muscle.${subject}`) : subject;
}
