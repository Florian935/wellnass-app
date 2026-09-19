/**
 * US MUSCU-UX05 — **« Tes charges »**, la carte dominante du hub Musculation.
 *
 * C'est la plus grande carte de l'écran, et c'est délibéré : elle porte la seule question qui donne
 * envie de rouvrir l'app demain — *est-ce que je progresse ?* L'audit du 19/09 avait montré que le
 * hub n'y répondait nulle part, et que son plus gros chiffre (17 470 kg de volume hebdomadaire)
 * était rangé en bas d'écran sous un « ▼ 49 % » sans référence écrite.
 *
 * ── Trois visages, une seule carte ───────────────────────────────────────────────────────────────
 *  - `onboarding` : les **gains bruts depuis la première séance**, en kilos. Un débutant n'a pas de
 *    tendance à 30 jours exploitable, mais il a des gains énormes — et c'est le moment où l'app
 *    risque le plus d'être désinstallée.
 *  - `established` : la **médiane** des écarts de 1RM estimé, plus le détail par exercice.
 *  - `strength` : le total SBD, **uniquement** quand les trois mouvements sont désignés et
 *    pratiqués. Retour de Florian, 19/09 : le total parle à un powerlifter, pas à un pratiquant de
 *    muscu. Il est donc mérité par la pratique, jamais imposé (décision H, appliquée à une carte).
 *
 * Le choix se fait sur les **données**, pas sur un réglage qu'il faudrait penser à ouvrir. Le
 * réglage existe (`LoadCardMode`) mais il sert à contredire l'app, pas à la démarrer.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DenseTile } from '@/components/stage/DenseTile';
import { useLoadProgress } from '@/data/repositories/strength-cards-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = { onPress: () => void };

/** Couleur d'une tendance — jamais le seul porteur de l'information (le texte la dit aussi). */
function trendColor(
  trend: 'up' | 'flat' | 'down',
  colors: { success: string; amber: string; textMuted: string },
): string {
  if (trend === 'up') return colors.success;
  if (trend === 'down') return colors.amber;
  return colors.textMuted;
}

export function LoadProgressCard({ onPress }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const { progress, isLoading } = useLoadProgress();

  // Une carte qui n'a rien à dire ne dit rien : elle ne s'excuse pas (défaut 2 de l'audit).
  if (isLoading || progress.kind === 'empty') return null;

  return (
    <DenseTile
      title={t(`strengthHub.loads.title.${progress.kind}`)}
      meta={
        progress.kind === 'onboarding'
          ? t('strengthHub.loads.weeks', { count: progress.weeks })
          : t('strengthHub.loads.upOf', { up: progress.up, total: progress.total })
      }
      onPress={onPress}
      testID="load-progress-card"
    >
      {progress.kind === 'onboarding' ? (
        <>
          <View style={styles.heroRow}>
            <Text style={[styles.hero, { color: colors.text }]}>
              +{units.formatWeight(progress.best.gainKg)}
            </Text>
          </View>
          <Text style={[styles.caption, { color: colors.textMuted }]}>
            {t('strengthHub.loads.onboardingCaption', { exercise: progress.best.exerciseName })}
          </Text>
          <View style={styles.list}>
            {progress.gains.map((gain) => (
              <View key={gain.exerciseId} style={styles.row}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {gain.exerciseName}
                </Text>
                <Text style={[styles.range, { color: colors.textMuted }]}>
                  {units.formatWeight(gain.fromKg)} → {units.formatWeight(gain.toKg)}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <>
          <View style={styles.heroRow}>
            <Text style={[styles.hero, { color: colors.text }]}>
              {progress.medianPct >= 0 ? '+' : '−'}
              {Math.abs(progress.medianPct).toFixed(1)}
            </Text>
            <Text style={[styles.unit, { color: colors.textMuted }]}>%</Text>
          </View>
          <Text style={[styles.caption, { color: colors.textMuted }]}>
            {t('strengthHub.loads.medianCaption', { count: progress.total })}
          </Text>
          <View style={styles.list}>
            {progress.items.map((item) => (
              <View key={item.exerciseId} style={styles.row}>
                <Text
                  style={[
                    styles.name,
                    { color: item.trend === 'flat' ? colors.textMuted : colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {item.exerciseName}
                </Text>
                <Text style={[styles.range, { color: colors.textMuted }]}>
                  {units.formatWeight(item.fromKg)} → {units.formatWeight(item.toKg)}
                </Text>
                <Text
                  style={[
                    styles.delta,
                    { color: trendColor(item.trend, colors) },
                  ]}
                >
                  {item.trend === 'flat'
                    ? t('strengthHub.loads.flat')
                    : `${item.deltaPct >= 0 ? '+' : '−'}${Math.abs(item.deltaPct).toFixed(1)} %`}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* La limite, écrite sur la carte. Un 1RM « estimé » sur une série de 15 reps n'est pas une
          mesure : le dire vaut mieux que de laisser croire à une précision qui n'existe pas. */}
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {t('strengthHub.loads.hint')}
      </Text>
    </DenseTile>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 2 },
  hero: { fontFamily: fontFamily.displayXBold, fontSize: 42, letterSpacing: -1.6 },
  unit: { fontFamily: fontFamily.mono, fontSize: 16 },
  caption: { fontFamily: fontFamily.body, fontSize: 12 },
  list: { gap: 9, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  range: { fontFamily: fontFamily.mono, fontSize: 10.5 },
  delta: { fontFamily: fontFamily.monoBold, fontSize: 10.5, minWidth: 52, textAlign: 'right' },
  hint: { fontFamily: fontFamily.body, fontSize: 10.5, lineHeight: 14.5 },
});
