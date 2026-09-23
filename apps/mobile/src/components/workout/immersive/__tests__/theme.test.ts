/**
 * La palette de la séance immersive — MUSCU-FIX02, recette du 23/09/2026.
 *
 * Elle valait `palettes.dark` : le brun et le terracotta neutres, d'avant l'identité des piliers.
 * Passer du classique (bordeaux, accent rose) à l'immersif faisait changer d'app. Elle reste
 * sombre quel que soit le thème, mais aux couleurs du pilier muscu.
 */

import { immersivePalette } from '../theme';
import { palettes } from '@/theme/colors';
import { pillarPalette } from '@/theme/pillar';

describe('immersivePalette', () => {
  it('🔴 porte l’accent du pilier muscu, pas le terracotta neutre', () => {
    expect(immersivePalette.accent).toBe(palettes.dark.pillarStrength);
    expect(immersivePalette.accent).not.toBe(palettes.dark.accent);
  });

  it('a les surfaces teintées du pilier — celles du mode classique en thème sombre', () => {
    expect(immersivePalette).toEqual(pillarPalette('dark', 'strength'));
    expect(immersivePalette.background).not.toBe(palettes.dark.background);
    expect(immersivePalette.surface).not.toBe(palettes.dark.surface);
  });

  it('reste sombre quel que soit le thème de l’app', () => {
    expect(immersivePalette).not.toEqual(pillarPalette('light', 'strength'));
  });
});
