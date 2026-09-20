/**
 * US DEPENSE-03 — **« Ta journée en énergie »** : ce que la journée a coûté, source par source, et
 * ce que la cible calorique en retient.
 *
 * Elle répond à la question posée au cadrage — « où j'en suis sur la journée, faut-il manger un peu
 * plus ou un peu moins » — en montrant **le calcul**, pas seulement son résultat : socle, dépenses,
 * cible, mangé, reste. Une carte qui donnerait la cible sans la justifier n'apprendrait rien, et
 * c'est exactement ce qu'on reproche au bonus forfaitaire d'aujourd'hui.
 *
 * ⚠️ Deux chiffres différents par ligne, et c'est **voulu** : l'estimation centrale (« ≈ 370 ») est
 * ce que l'activité a coûté ; le « +260 » est ce que la cible autorise en plus (bas de fourchette,
 * décision D2). Les confondre reviendrait soit à mentir sur la dépense, soit à rendre 40 % de
 * calories qui n'ont peut-être pas été brûlées.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { activityTypeDef, formatHoursMinutes, isKnownActivityType } from '@wellness/shared';

import { Card } from '@/components/Card';
import { useDayCalorieTarget } from '@/data/repositories/dashboard-repository';
import { useDayEnergy, type DayEnergyItem } from '@/data/repositories/energy-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const ICONS: Record<DayEnergyItem['kind'], keyof typeof Ionicons.glyphMap> = {
  strength: 'barbell-outline',
  run: 'walk-outline',
  activity: 'bicycle-outline',
};

export function DayEnergyCard({ dayKey, consumedKcal }: { dayKey: string; consumedKcal: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const { items, totalKcal, targetKcal, isLoading } = useDayEnergy(dayKey);
  const { target, effectiveTarget, trainingBonus } = useDayCalorieTarget(dayKey);
  const { nutritionProfile } = useNutritionProfile();
  const { settings } = useSettings();

  const mode = nutritionProfile?.trainingBonusMode ?? 'fixed';
  const followsEnergy = mode === 'activities';
  const showNumbers = settings?.showEnergyEstimates ?? true;

  // Journée vide **et** cible qui ne suit pas les dépenses : la carte n'aurait rien à dire.
  if (isLoading || (items.length === 0 && !followsEnergy)) return null;

  /**
   * US NUTRI-UX02 — **repliée quand elle n'a qu'à rapporter, dépliée quand elle a une décision.**
   *
   * La carte occupait un bloc entier, haut dans le journal, pour redire un total que la scène
   * affichait déjà. Elle n'a pourtant rien d'inutile : le jour où le bonus forfaitaire et la
   * dépense réelle divergent, c'est elle qui porte la décision. D'où le critère — elle s'ouvre
   * d'elle-même **quand il y a un écart à arbitrer**, et se range en une ligne le reste du temps.
   *
   * 🔴 L'état est local et non persisté : la carte doit pouvoir se rouvrir seule le lendemain si la
   * situation change. Mémoriser « replié » ferait taire l'alerte pour de bon.
   */
  const needsAttention = !followsEnergy && items.length > 0;

  const label = (item: DayEnergyItem): string => {
    if (item.kind === 'strength') return item.title ?? t('energy.kinds.strength');
    if (item.kind === 'run') return t('energy.kinds.run');
    const def = activityTypeDef(item.activityType);
    return isKnownActivityType(item.activityType)
      ? t(`activity.types.${def.id}`)
      : t('activity.types.other');
  };

  if (!expanded && !needsAttention) {
    return (
      <Pressable
        onPress={() => setExpanded(true)}
        accessibilityRole="button"
        accessibilityState={{ expanded: false }}
        accessibilityLabel={t('energy.day.title')}
        testID="energy-collapsed"
        style={[styles.collapsed, { borderColor: colors.border }]}
      >
        <Ionicons name="time-outline" size={17} color={colors.textMuted} />
        <Text style={[styles.collapsedText, { color: colors.textMuted }]} numberOfLines={1}>
          {showNumbers && items.length > 0
            ? t('energy.day.collapsed', { kcal: totalKcal, first: label(items[0]!) })
            : t('energy.day.title')}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    );
  }

  return (
    <Card>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>{t('energy.day.title')}</Text>
        {showNumbers && items.length > 0 ? (
          <Text style={[styles.total, { color: colors.textMuted }]}>
            {t('energy.day.total', { kcal: totalKcal })}
          </Text>
        ) : null}
      </View>

      {items.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>{t('energy.day.empty')}</Text>
      ) : (
        <View style={styles.rows}>
          {items.map((item) => (
            <View key={`${item.kind}-${item.id}`} style={styles.row}>
              <Ionicons name={ICONS[item.kind]} size={18} color={colors.textMuted} />
              <View style={styles.rowTexts}>
                <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>
                  {label(item)}
                </Text>
                <Text style={[styles.rowSub, { color: colors.textMuted }]}>
                  {item.durationSeconds ? formatHoursMinutes(item.durationSeconds) : ''}
                  {showNumbers && item.estimate.source === 'estimate'
                    ? ` · ${t('energy.day.estimated', { kcal: item.estimate.kcal })}`
                    : ''}
                </Text>
              </View>
              {showNumbers ? (
                <Text style={[styles.rowValue, { color: colors.text }]}>
                  {followsEnergy ? `+${item.estimate.low}` : `${item.estimate.kcal}`}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {followsEnergy && target != null && effectiveTarget != null ? (
        <View style={[styles.mathBox, { borderColor: colors.border }]}>
          <MathRow label={t('energy.day.base')} value={`${target}`} />
          {targetKcal > 0 ? (
            <MathRow label={t('energy.day.fromActivity')} value={`+${targetKcal}`} accent />
          ) : null}
          <View style={[styles.sep, { backgroundColor: colors.border }]} />
          <MathRow label={t('energy.day.target')} value={`${effectiveTarget}`} strong />
          <MathRow
            label={t('energy.day.remaining')}
            value={`${effectiveTarget - consumedKcal}`}
            strong
          />
        </View>
      ) : null}

      {/*
        US NUTRI-UX02 — le bandeau cesse d'être un nag pour devenir la réponse.

        Il s'affichait **tous les jours, sur toutes les journées**, tant que le réglage n'était pas
        basculé : « Ta cible ne suit pas encore tes dépenses réelles. » Un message permanent n'est
        pas un conseil, c'est du bruit qu'on apprend à ne plus voir.

        Deux corrections, et la seconde est la vraie :

        1. **Il se tait les jours sans dépense** (`items.length > 0`). Dire que la cible ne suit pas
           les dépenses réelles un jour sans aucune dépense n'apporte rien : il n'y a rien à suivre.

        2. 🔴 **Il porte les deux nombres.** Florian l'a relevé sur la capture du 17/09 : la scène
           annonçait « +720 kcal — jour de séance » et cette carte « ≈ 750 kcal dépensées », à
           quatre centimètres l'un de l'autre, sans jamais les relier. Le forfait de MN-01 et la
           dépense réelle de DEPENSE-01 cohabitaient sans se parler. Les mettre côte à côte rend
           l'écart visible — et la décision de basculer évidente, ou inutile, selon le chiffre.
      */}
      {!followsEnergy && items.length > 0 ? (
        <Pressable
          onPress={() => router.push('/nutrition-profile')}
          accessibilityRole="button"
          accessibilityLabel={t('energy.day.notFollowingCta')}
          style={styles.hintRow}
          testID="energy-not-following"
        >
          <Ionicons name="information-circle-outline" size={16} color={colors.warnText} />
          <Text style={[styles.hint, { color: colors.warnText }]}>
            {showNumbers && trainingBonus > 0
              ? t('energy.day.notFollowingNumbers', { spent: totalKcal, bonus: trainingBonus })
              : t('energy.day.notFollowing')}
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => router.push('/activity')}
        accessibilityRole="button"
        accessibilityLabel={t('activity.addCta')}
        style={[styles.addBtn, { borderColor: colors.borderStrong }]}
      >
        <Ionicons name="add" size={18} color={colors.text} />
        <Text style={[styles.addLabel, { color: colors.text }]}>{t('activity.addCta')}</Text>
      </Pressable>
    </Card>
  );
}

function MathRow({
  label,
  value,
  strong,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.mathRow}>
      <Text
        style={[
          styles.mathLabel,
          { color: strong ? colors.text : colors.textMuted, fontFamily: strong ? fontFamily.bodyBold : fontFamily.body },
        ]}
      >
        {label}
      </Text>
      <Text style={[styles.mathValue, { color: accent ? colors.success : colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 18, letterSpacing: -0.3 },
  total: { fontFamily: fontFamily.mono, fontSize: 12 },
  empty: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 19, marginTop: 8 },
  rows: { gap: 10, marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTexts: { flex: 1, gap: 1 },
  rowLabel: { fontFamily: fontFamily.bodySemi, fontSize: 14.5 },
  rowSub: { fontFamily: fontFamily.body, fontSize: 12 },
  rowValue: { fontFamily: fontFamily.monoBold, fontSize: 14 },
  mathBox: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 6, marginTop: 14 },
  mathRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  mathLabel: { fontSize: 13.5, flexShrink: 1 },
  mathValue: { fontFamily: fontFamily.monoBold, fontSize: 14 },
  sep: { height: 1, marginVertical: 2 },
  // US NUTRI-UX02 — la forme repliée : une ligne, pas une carte.
  collapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 15,
    minHeight: 52,
  },
  collapsedText: { flex: 1, fontFamily: fontFamily.bodyMedium, fontSize: 13.5 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, minHeight: 44 },
  hint: { fontFamily: fontFamily.bodyMedium, fontSize: 13, flex: 1, lineHeight: 18 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginTop: 12,
  },
  addLabel: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
});
