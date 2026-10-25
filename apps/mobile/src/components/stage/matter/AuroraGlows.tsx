/**
 * US ACCUEIL-07 — **la matière de la scène Aurore** : deux lueurs posées sur la nuit.
 *
 * Une lueur turquoise ancrée en haut à gauche, une lueur framboise en haut à droite, chacune un
 * dégradé radial qui s'éteint avant le milieu de la scène. Leur dosage suit la lumière de la
 * journée (`AURORA_DOSES`) : turquoise le matin, framboise le soir, presque éteintes la nuit.
 *
 * ⚠️ Elles passent sous le texte. Le contrat de lisibilité est tenu par `theme/stage.ts` (surfaces
 * mêlées mesurées par `__tests__/stage.test.ts`) et par le plafond de la lueur turquoise (0,38) ;
 * ce composant ne doit donc jamais doser au-delà de `AURORA_DOSES`.
 *
 * Décor pur (R1 de DASH-01) : aucune information n'est portée par les lueurs, d'où `pointerEvents`
 * coupé et aucune étiquette d'accessibilité.
 */

import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { AURORA_DOSES, AURORA_FRAMBOISE, AURORA_TURQUOISE, type AuroraMoment } from '@/theme/stage';

const rgb = (c: readonly number[]) => `rgb(${c.join(',')})`;

type Props = { moment: AuroraMoment };

export function AuroraGlows({ moment }: Props) {
  const [turquoise, framboise] = AURORA_DOSES[moment];
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none" testID="aurora-glows">
      <Defs>
        <RadialGradient id="aurora-turquoise" cx="0%" cy="0%" rx="110%" ry="75%" fx="0%" fy="0%">
          <Stop offset="0" stopColor={rgb(AURORA_TURQUOISE)} stopOpacity={turquoise} />
          <Stop offset="0.6" stopColor={rgb(AURORA_TURQUOISE)} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="aurora-framboise" cx="100%" cy="18%" rx="90%" ry="70%" fx="100%" fy="18%">
          <Stop offset="0" stopColor={rgb(AURORA_FRAMBOISE)} stopOpacity={framboise} />
          <Stop offset="0.62" stopColor={rgb(AURORA_FRAMBOISE)} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#aurora-turquoise)" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#aurora-framboise)" />
    </Svg>
  );
}
