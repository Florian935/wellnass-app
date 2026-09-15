/**
 * Le fantôme de la dernière fois — US MUSCU-UX03, spec §5.10.
 *
 * ── L'idée ──────────────────────────────────────────────────────────────────────────────────────
 * La même séance, la dernière fois, court à côté de celle d'aujourd'hui. Ce n'est ni un score ni un
 * classement : c'est **soi contre soi**, en tonnage cumulé, série après série. Son vrai rôle arrive
 * à la dernière série, le moment où l'on a le plus envie de s'arrêter — il donne enfin un chiffre à
 * ce qu'il reste à faire.
 *
 * ── Ce que la courbe dit, et ce qu'elle ne dit pas ──────────────────────────────────────────────
 * Trait plein = aujourd'hui, pointillés = la dernière fois. Elle est **illustrative** : l'écart
 * chiffré, juste au-dessus, porte seul l'information (règle d'accessibilité du projet — une couleur
 * ou une forme ne porte jamais une information à elle seule).
 */

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import type { GhostState } from '@wellness/shared';
import type { useUnits } from '@/hooks/useUnits';
import type { Palette } from '@/theme/colors';
import { fontFamily } from '@/theme/fonts';

const CHART_WIDTH = 280;
const CHART_HEIGHT = 64;

/** Trace une série de valeurs cumulées sur la hauteur du graphe, échelle commune aux deux courbes. */
function line(values: number[], max: number): string {
  if (values.length < 2) return '';
  const stepX = CHART_WIDTH / (values.length - 1);
  return values
    .map((value, index) => {
      const x = index * stepX;
      const y = CHART_HEIGHT - (max > 0 ? (value / max) * CHART_HEIGHT : 0);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

type Props = {
  ghost: GhostState;
  /** Libellé du jour de référence, déjà résolu (« mardi », « le 3 septembre »). */
  dayLabel: string;
  units: ReturnType<typeof useUnits>;
  colors: Palette;
};

export function GhostCard({ ghost, dayLabel, units, colors }: Props) {
  const { t } = useTranslation();

  const ahead = ghost.delta >= 0;
  const max = Math.max(
    ...ghost.points.map((point) => Math.max(point.you, point.ghost)),
    ghost.ghostTotal,
    1,
  );

  return (
    <View style={styles.card}>
      <Text style={[styles.delta, { color: ahead ? colors.success : colors.text }]}>
        {t(ahead ? 'immersive.ghost.ahead' : 'immersive.ghost.behind', {
          weight: units.formatWeight(Math.abs(Math.round(ghost.delta))),
        })}
      </Text>
      <Text style={[styles.caption, { color: colors.textMuted }]}>
        {t('immersive.ghost.caption', { day: dayLabel })}
      </Text>

      <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
        <Path
          d={line(
            ghost.points.map((point) => point.ghost),
            max,
          )}
          stroke={colors.textMuted}
          strokeWidth={2}
          strokeDasharray="5 5"
          fill="none"
        />
        <Path
          d={line(
            ghost.points.map((point) => point.you),
            max,
          )}
          stroke={ahead ? colors.success : colors.accent}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>

      <View style={styles.legend}>
        <Text style={[styles.legendText, { color: colors.textMuted }]}>
          {t('immersive.ghost.you', { weight: units.formatWeight(Math.round(ghost.you)) })}
        </Text>
        <Text style={[styles.legendText, { color: colors.textMuted }]}>
          {t('immersive.ghost.total', {
            weight: units.formatWeight(Math.round(ghost.ghostTotal)),
          })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4 },
  delta: { fontFamily: fontFamily.displayXBold, fontSize: 30, letterSpacing: -1 },
  caption: { fontFamily: fontFamily.body, fontSize: 12.5, marginBottom: 6 },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  legendText: { fontFamily: fontFamily.mono, fontSize: 11 },
});
