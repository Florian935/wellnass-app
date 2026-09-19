/**
 * US MUSCU-UX05 — **« Ton corps »** : la silhouette cesse de décorer et se met à dire quelque chose.
 *
 * L'audit du 19/09 a relevé que la silhouette était déjà à l'écran — derrière la scène, en matière
 * décorative — pendant que `muscle-balance.ts` (MUSC-05) calculait la répartition du volume par
 * groupe sans jamais l'afficher ailleurs que dans le troisième onglet de `/progress`.
 *
 * La carte croise les deux : les mêmes zones que la scène allume à l'arrivée portent ici la part de
 * volume de chaque groupe, et le groupe qui décroche est nommé en toutes lettres avec le geste qui
 * le remet dans la course.
 *
 * ⚠️ **Elle se tait sous 12 séries** (`hasEnoughData`) : classer un groupe « délaissé » sur trois
 * séries au total serait une accusation tirée du bruit.
 */

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { EVEN_SHARE, type MuscleGroup } from '@wellness/shared';
import { DenseTile } from '@/components/stage/DenseTile';
import {
  BODY_PATHS,
  HEAD,
  ZONE_PATHS,
  type SilhouetteZone,
} from '@/components/stage/matter/silhouette-paths';
import { useMuscleBalance, useNeglectedFavorites } from '@/data/repositories/records-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Les six groupes de `MUSCLE_GROUPS` sont exactement les six zones de la silhouette. */
const ZONES: readonly SilhouetteZone[] = ['chest', 'shoulders', 'arms', 'back', 'legs', 'core'];

const isZone = (muscle: MuscleGroup): muscle is SilhouetteZone =>
  (ZONES as readonly string[]).includes(muscle);

type Props = { onPress: () => void };

export function BodyBalanceCard({ onPress }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { balance, isLoading } = useMuscleBalance();
  const { neglected: forgottenExercises } = useNeglectedFavorites();

  if (isLoading || !balance.hasEnoughData) return null;

  // Les quatre groupes les plus parlants : les trois premiers, plus celui qui décroche le plus.
  const sorted = [...balance.groups].sort((a, b) => b.share - a.share);
  const worst = sorted[sorted.length - 1];
  const shown = [...sorted.slice(0, 3), ...(worst && !sorted.slice(0, 3).includes(worst) ? [worst] : [])];

  // L'échelle des barres se lit contre la part d'un corps équilibré (1/6), pas contre le maximum :
  // sinon le groupe le plus travaillé serait toujours « plein », quelle que soit la réalité.
  const widthOf = (share: number): `${number}%` =>
    `${Math.min(100, Math.round((share / (EVEN_SHARE * 2)) * 100))}%`;

  const nameOf = (muscle: MuscleGroup) => t(`muscles.${muscle}`, { defaultValue: muscle });
  const forgotten = forgottenExercises[0] ?? null;

  return (
    <DenseTile
      title={t('strengthHub.body.title')}
      meta={t('strengthHub.body.meta')}
      onPress={onPress}
      testID="body-balance-card"
    >
      <View style={styles.split}>
        <View style={styles.bars}>
          {shown.map((group) => {
            const low = group.status === 'neglected';
            return (
              <View key={group.muscle} style={styles.row}>
                <Text
                  style={[styles.name, { color: low ? colors.amber : colors.textMuted }]}
                  numberOfLines={1}
                >
                  {nameOf(group.muscle)}
                </Text>
                <View style={[styles.track, { backgroundColor: colors.track }]}>
                  <View
                    style={[
                      styles.fill,
                      {
                        width: widthOf(group.share),
                        backgroundColor: low ? colors.amber : colors.accent,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>

        <Svg width={78} height={130} viewBox="0 0 120 200" style={styles.figure}>
          <G fill={colors.textMuted} opacity={0.22}>
            <Ellipse cx={HEAD.cx} cy={HEAD.cy} rx={HEAD.rx} ry={HEAD.ry} />
            {BODY_PATHS.map((d) => (
              <Path key={d.slice(0, 14)} d={d} />
            ))}
          </G>
          {balance.groups.filter((g) => isZone(g.muscle)).map((group) => {
            const zone = group.muscle as SilhouetteZone;
            const low = group.status === 'neglected';
            return ZONE_PATHS[zone].map((d) => (
              <Path
                key={`${zone}-${d.slice(0, 12)}`}
                d={d}
                fill={low ? colors.amber : colors.accent}
                // L'opacité PORTE la part : un groupe à peine travaillé s'efface, sans jamais
                // disparaître tout à fait (sinon on lirait « ce muscle n'existe pas »).
                opacity={low ? 0.95 : Math.max(0.28, Math.min(0.9, group.share / EVEN_SHARE * 0.55))}
              />
            ));
          })}
        </Svg>
      </View>

      {balance.neglected.length > 0 ? (
        <Text style={[styles.verdict, { color: colors.amber }]}>
          {t('strengthHub.body.neglected', { muscle: nameOf(balance.neglected[0]!) })}
        </Text>
      ) : forgotten && !forgotten.neverPracticed ? (
        <Text style={[styles.verdict, { color: colors.textMuted }]}>
          {t('strengthHub.body.forgotten', {
            exercise: forgotten.name,
            count: forgotten.weeksSince,
          })}
        </Text>
      ) : (
        <Text style={[styles.verdict, { color: colors.success }]}>
          {t('strengthHub.body.balanced')}
        </Text>
      )}
    </DenseTile>
  );
}

const styles = StyleSheet.create({
  split: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bars: { flex: 1, gap: 7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { width: 62, fontFamily: fontFamily.bodyMedium, fontSize: 11 },
  track: { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  figure: { flexShrink: 0 },
  verdict: { fontFamily: fontFamily.bodyMedium, fontSize: 11.5, lineHeight: 16 },
});
