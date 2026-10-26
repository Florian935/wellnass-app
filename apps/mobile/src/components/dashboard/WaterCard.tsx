/**
 * US ACCUEIL-08 — **le repère « Eau »** de « Tes repères ».
 *
 * L'eau du jour sur l'objectif (NUTRI-UX01, `hydrationProgress`) et, d'un appui, un verre de plus —
 * le seul geste du pilier qui coûte un tap. Gardé par le pilier nutrition dans le registre.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DEFAULT_GLASS_ML, hydrationProgress, millilitresToLitres, type WidgetSize } from '@wellness/shared';
import { Eyebrow, Metric, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { addWater, useDayWater } from '@/data/repositories/water-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { useTodayKey } from '@/hooks/useTodayKey';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export function WaterCard({ size = 'small' }: { size?: WidgetSize }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const todayKey = useTodayKey();
  const { totalMl } = useDayWater(todayKey);
  const { nutritionProfile } = useNutritionProfile();
  const [adding, setAdding] = useState(false);

  const progress = hydrationProgress(totalMl, nutritionProfile?.waterTargetMl ?? undefined);
  const litres = (ml: number) =>
    new Intl.NumberFormat(i18n.language === 'en' ? 'en-GB' : 'fr-FR', { maximumFractionDigits: 1 }).format(
      millilitresToLitres(ml),
    );

  // Un verre de plus, en un geste : l'écriture est locale, l'échec est improbable et se tait.
  const addGlass = () => {
    if (adding) return;
    setAdding(true);
    void addWater(todayKey, DEFAULT_GLASS_ML)
      .catch(() => undefined)
      .finally(() => setAdding(false));
  };

  return (
    <WidgetFrame
      pad={size === 'small' ? 16 : 18}
      onPress={addGlass}
      accessibilityLabel={t('home.reperes.water.a11y', {
        value: litres(progress.totalMl),
        target: litres(progress.targetMl),
      })}
      accessibilityHint={t('home.reperes.water.hint')}
    >
      <View style={styles.col}>
        <Eyebrow>{t('home.reperes.water.title')}</Eyebrow>
        <Metric value={litres(progress.totalMl)} unit="L" />
        <View style={[styles.track, { backgroundColor: colors.track }]}>
          <View
            style={[styles.fill, { width: `${Math.round(progress.ratio * 100)}%`, backgroundColor: colors.pillarRunning }]}
          />
        </View>
        <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
          {t('home.reperes.water.sub', { target: litres(progress.targetMl) })}
        </Text>
      </View>
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  col: { gap: 6 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  sub: { fontFamily: fontFamily.body, fontSize: 11.5 },
});
