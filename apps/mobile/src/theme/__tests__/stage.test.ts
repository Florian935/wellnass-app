/**
 * US DASH-01 (R10) — le texte d'une scène reste lisible sur **toute** sa surface.
 *
 * Une scène est un dégradé : un libellé posé en haut à gauche ne voit pas la même couleur qu'un
 * chiffre posé en bas. Et en nutrition, le niveau monte **sous** le texte. Ce test mesure donc chaque
 * encre contre **chaque** teinte que le texte peut traverser, pas contre une couleur moyenne.
 *
 * Les teintes de maquette échouaient ici : le libellé bleu clair de la course faisait 2,9:1 sur le
 * haut du dégradé, le vert clair de la nutrition 3,9:1 sous la ligne d'eau.
 *
 * US ACCUEIL-07 — la scène Aurore de l'accueil ajoute ses **surfaces mêlées** (les lueurs turquoise
 * et framboise posées sur la nuit), le verre de ses pastilles, et le bouton en dégradé.
 */
import { contrastRatio } from '@wellness/shared';
import {
  AURORA_DOSES,
  AURORA_FRAMBOISE,
  AURORA_MOMENTS,
  AURORA_TURQUOISE,
  AURORA_TURQUOISE_CAP,
  STAGE_KEYS,
  auroraMoment,
  blendOver,
  stageTheme,
} from '../stage';

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
      for (const surface of stage.glassSurfaces ?? []) {
        it(`${scheme} · ${key} : texte principal sur le verre ${surface} ≥ 4,5`, () => {
          expect(contrastRatio(stage.ink, surface)!).toBeGreaterThanOrEqual(4.5);
        });
      }
      it(`${scheme} · ${key} : libellé du bouton plein sur son fond ≥ 4,5`, () => {
        expect(contrastRatio(stage.onSolid, stage.solid)!).toBeGreaterThanOrEqual(4.5);
      });
      for (const stop of stage.solidGradient ?? []) {
        it(`${scheme} · ${key} : libellé du bouton sur l’arrêt ${stop} de son dégradé ≥ 4,5`, () => {
          expect(contrastRatio(stage.onSolid, stop)!).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }
});

describe('Aurore — les lueurs passent sous le texte (US ACCUEIL-07, D1)', () => {
  const home = stageTheme('home', 'light');

  it('🔴 la scène de l’accueil est sombre dans les DEUX thèmes, comme celles des piliers', () => {
    expect(stageTheme('home', 'dark')).toBe(home);
    expect(home.ink).toBe('#ffffff');
  });

  it('🔴 la lueur turquoise ne dépasse jamais 0,38 — au-delà, la date passe sous 4,5:1', () => {
    for (const moment of AURORA_MOMENTS) {
      expect(AURORA_DOSES[moment][0]).toBeLessThanOrEqual(AURORA_TURQUOISE_CAP);
    }
  });

  it('le plafond n’est pas arbitraire : à 0,45, le texte secondaire échouerait', () => {
    // Si ce test se met à échouer, le plafond peut monter — mais pas sans le remesurer.
    const top = home.gradient[0];
    expect(contrastRatio(home.inkMuted, blendOver(top, AURORA_TURQUOISE, AURORA_TURQUOISE_CAP))!).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(home.inkMuted, blendOver(top, AURORA_TURQUOISE, 0.45))!).toBeLessThan(4.5);
  });

  it('chaque lueur, à son dosage le plus fort, fait partie des surfaces mesurées', () => {
    const top = home.gradient[0];
    const turquoiseMax = Math.max(...AURORA_MOMENTS.map((m) => AURORA_DOSES[m][0]));
    const framboiseMax = Math.max(...AURORA_MOMENTS.map((m) => AURORA_DOSES[m][1]));
    expect(home.surfaces).toContain(blendOver(top, AURORA_TURQUOISE, turquoiseMax));
    expect(home.surfaces).toContain(blendOver(top, AURORA_FRAMBOISE, framboiseMax));
  });

  it('US ACCUEIL-08 — le texte secondaire des cadrans, sur le verre posé hors des lueurs, reste ≥ 4,5', () => {
    // L'encart des cadrans vient sous la salutation et la phrase du jour : là où les deux lueurs se
    // sont éteintes (le turquoise s'arrête vers 45 % de la hauteur). On mesure le verre posé sur
    // chaque arrêt du fond — le texte principal, lui, est mesuré sur tous les verres ci-dessus.
    const alpha = Number(/rgba\(255,255,255,([\d.]+)\)/.exec(home.glass)![1]);
    for (const stop of home.gradient) {
      expect(contrastRatio(home.inkMuted, blendOver(stop, [255, 255, 255], alpha))!).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('la lumière suit l’heure : aube, journée, heure dorée, soirée, nuit', () => {
    expect(auroraMoment(7)).toBe('aube');
    expect(auroraMoment(12.67)).toBe('jour');
    expect(auroraMoment(18)).toBe('dore');
    expect(auroraMoment(20.25)).toBe('soir');
    expect(auroraMoment(23)).toBe('nuit');
    expect(auroraMoment(3)).toBe('nuit');
  });

  it('turquoise le matin, framboise le soir', () => {
    expect(AURORA_DOSES.aube[0]).toBeGreaterThan(AURORA_DOSES.aube[1]);
    expect(AURORA_DOSES.soir[1]).toBeGreaterThan(AURORA_DOSES.soir[0]);
  });
});
