/**
 * US CONF-07 — garde-fou de contraste WCAG AA sur la palette réelle.
 *
 * La première passe (30/07/2026) n'avait mesuré que 3 paires et affirmait le clair conforme — faux
 * sur 3 points, jamais détecté faute de mesure automatisée. Ce test parcourt la **table complète**
 * des paires réellement utilisées (spec §0) et échoue si l'une repasse sous son seuil : c'est le
 * vrai livrable durable de cette US.
 *
 * Vit côté mobile (pas `packages/shared`) parce que la palette elle-même
 * (`apps/mobile/src/theme/colors.ts`) vit ici — voir le plan §Étape 1 pour l'arbitrage.
 */
import { contrastRatio } from '@wellness/shared';
import { palettes } from '../colors';

/**
 * `[thème, premier plan, fond, seuil, usage]`. Le seuil dépend de l'usage réel du token, pas de son
 * nom (R2 de la spec) : 4,5 pour du texte (WCAG 1.4.3), 3,0 pour de la donnée / une limite de
 * composant (WCAG 1.4.11).
 */
const PAIRS: {
  theme: 'light' | 'dark';
  fg: keyof typeof palettes.light;
  bg: keyof typeof palettes.light;
  threshold: number;
  usage: string;
}[] = [
  // Thème clair — 3 non-conformités trouvées le 30/07/2026 (spec §0.1).
  { theme: 'light', fg: 'success', bg: 'background', threshold: 4.5, usage: 'texte de succès (sign-in, steps, WeightGoalCard, CurrentSetCard)' },
  { theme: 'light', fg: 'warnText', bg: 'warn', threshold: 4.5, usage: 'texte d’alerte (DeficitVolumeAlertCard, StreakCard, GoalCard)' },
  { theme: 'light', fg: 'amber', bg: 'background', threshold: 3.0, usage: 'donnée (barre glucides NutritionSummaryCard, MicroCoverageGrid, MacroTriple)' },
  // Thème sombre — 2 non-conformités déjà connues (spec §0.2).
  { theme: 'dark', fg: 'accentText', bg: 'accent', threshold: 4.5, usage: 'libellé des boutons pleins (D1, acceptée le 01/08/2026)' },
  // `accent`/`surface` sombre (D2, 4,45) est un écart ASSUMÉ (spec §4) — volontairement absent de
  // cette table : le consigner ici comme une assertion qui doit rester rouge serait exactement le
  // bruit qu'on veut éviter. Voir le commentaire dans colors.ts.
];

describe('Palette — contraste WCAG AA', () => {
  it.each(PAIRS)(
    '$theme : $fg / $bg ≥ $threshold ($usage)',
    ({ theme, fg, bg, threshold }) => {
      const ratio = contrastRatio(palettes[theme][fg], palettes[theme][bg]);
      expect(ratio).not.toBeNull();
      expect(ratio!).toBeGreaterThanOrEqual(threshold);
    },
  );

  it('non-régression : chartGreen (clair) reste inchangée — R3, ne diverge pas de success par hasard', () => {
    expect(palettes.light.chartGreen).toBe('#7c8a5b');
    // Seuil « donnée » (3,0), pas « texte » (4,5) : chartGreen ne peint que des courbes.
    expect(contrastRatio(palettes.light.chartGreen, palettes.light.background)).toBeGreaterThanOrEqual(3.0);
  });
});
