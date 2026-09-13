/**
 * US DASH-01 (R10) — le texte d'une scène reste lisible sur **toute** sa surface.
 *
 * Une scène est un dégradé : un libellé posé en haut à gauche ne voit pas la même couleur qu'un
 * chiffre posé en bas. Et en nutrition, le niveau monte **sous** le texte. Ce test mesure donc chaque
 * encre contre **chaque** teinte que le texte peut traverser, pas contre une couleur moyenne.
 *
 * Les teintes de maquette échouaient ici : le libellé bleu clair de la course faisait 2,9:1 sur le
 * haut du dégradé, le vert clair de la nutrition 3,9:1 sous la ligne d'eau.
 */
import { contrastRatio } from '@wellness/shared';
import { STAGE_KEYS, stageTheme } from '../stage';

const SCHEMES = ['light', 'dark'] as const;

describe('Scènes — contraste WCAG AA de l’encre sur chaque teinte traversée', () => {
  for (const scheme of SCHEMES) {
    for (const key of STAGE_KEYS) {
      const stage = stageTheme(key, scheme);
      for (const surface of stage.surfaces) {
        it(`${scheme} · ${key} : texte principal sur ${surface} ≥ 4,5`, () => {
          expect(contrastRatio(stage.ink, surface)!).toBeGreaterThanOrEqual(4.5);
        });
        it(`${scheme} · ${key} : texte secondaire sur ${surface} ≥ 4,5`, () => {
          expect(contrastRatio(stage.inkMuted, surface)!).toBeGreaterThanOrEqual(4.5);
        });
      }
      it(`${scheme} · ${key} : libellé du bouton plein sur son fond ≥ 4,5`, () => {
        expect(contrastRatio(stage.onSolid, stage.solid)!).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
