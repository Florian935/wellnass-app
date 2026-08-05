/**
 * Défaut d'affichage de BILAN-01, corrigé le 05/08/2026.
 *
 * `ReviewDecision.subject` vaut `balance.neglected[0]` pour la décision `muscle_imbalance` — une
 * **clé** métier, pas un libellé. Les trois surfaces qui rendent cette décision (`review.tsx`,
 * `ReviewCard.tsx`, la carte `weekly_decision` de l'écran « Insights ») affichaient donc « Tu
 * délaisses un groupe musculaire : **back** ».
 *
 * Le défaut a vécu dans BILAN-01 sans être vu, jusqu'à ce qu'INSIGHTS-01 l'expose sur une
 * troisième surface — d'où ce test sur la fonction unique qui les sert désormais toutes les trois.
 */
import { resolveDecisionSubject } from '@/lib/decision-subject';

const t = (k: string) => k;

describe('resolveDecisionSubject', () => {
  it('traduit la clé de groupe musculaire du déséquilibre', () => {
    expect(resolveDecisionSubject('muscle_imbalance', 'back', t)).toBe('muscle.back');
  });

  it('laisse intact le libellé d’un objectif, qui est déjà résolu', () => {
    expect(resolveDecisionSubject('goal_behind', 'Semi-marathon', t)).toBe('Semi-marathon');
  });

  it('rend une chaîne vide sans sujet — ce qu’attendaient déjà les appelants', () => {
    expect(resolveDecisionSubject('consistency_drop', undefined, t)).toBe('');
  });

  it('rend une chaîne vide même pour un déséquilibre sans sujet, sans traduire « muscle.undefined »', () => {
    expect(resolveDecisionSubject('muscle_imbalance', undefined, t)).toBe('');
  });
});
