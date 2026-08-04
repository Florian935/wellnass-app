/**
 * Widget 7.5 — Résumé nutritionnel du jour, décliné aux 3 formes de la galerie « FitTrio · Widgets ».
 *
 *  - `small` : eyebrow + kcal restantes + barre de progression fine ;
 *  - `wide`  : anneau kcal (restantes) + détail Consommé / Objectif / Sport ;
 *  - `large` : anneau kcal (consommé/objectif) + budget restant + 3 barres macro (consommé/cible).
 *
 * Données : `useNutritionSummary` (kcal, objectif effectif, macros, bonus séance). Cibles macro
 * calculées comme l'écran nutrition (`trainingDayMacroGrams` + manuel prioritaire, US MN-04 — le
 * bonus du jour est redirigé vers les glucides plutôt que d'être invisible dans le détail).
 * États sans profil → CTA « Définir mon objectif ».
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  objectiveFromGoal,
  trainingDayMacroGrams,
  type WidgetSize,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { RingGauge } from '@/components/widgets/primitives';
import { Eyebrow, Metric, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { useNutritionSummary } from '@/data/repositories/dashboard-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { useProfile } from '@/data/repositories/profile-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useTodayKey } from '@/hooks/useTodayKey';


/** Une barre macro (consommé / cible) avec pastille de couleur. */
function MacroBar({ label, consumed, target, color }: { label: string; consumed: number; target: number | null; color: string }) {
  const { colors } = useTheme();
  const pct = target && target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
  return (
    <View style={styles.macroRow}>
      <View style={styles.macroHead}>
        <Text style={[styles.macroLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.macroFig, { color: colors.textMuted }]}>
          {consumed}
          {target != null ? `/${target}` : ''} g
        </Text>
      </View>
      <View style={[styles.macroTrack, { backgroundColor: colors.track }]}>
        <View style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 5 }} />
      </View>
    </View>
  );
}

export function NutritionSummaryCard({ size = 'wide' }: { size?: WidgetSize }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { kcal, target, effectiveTarget, trainingBonus, isTrainingDay, macros, hasProfile, isLoading } =
    useNutritionSummary();
  const { nutritionProfile } = useNutritionProfile();
  const { profile } = useProfile();
  // Hook AVANT tout retour anticipé (règle des hooks). L'ancien `isoDay(new Date())` était placé
  // après le `if (isLoading)` — légal pour un simple calcul, illégal pour un hook.
  const today = useTodayKey();

  if (isLoading) return null;

  const openFood = () =>
    router.push({ pathname: '/food-picker', params: { date: today, meal: 'breakfast' } });
  const openProfile = () => router.push('/nutrition-profile');

  // ── État sans profil configuré ────────────────────────────────────────────
  if (!hasProfile) {
    if (size === 'small') {
      return (
        <WidgetFrame pad={16} onPress={openProfile} accessibilityLabel={t('home.nutrition.title')}>
          <Eyebrow>{t('home.nutrition.eyebrow')}</Eyebrow>
          <View style={styles.smallBottom}>
            <Metric value={t('home.nutrition.compactNoGoal')} muted />
          </View>
        </WidgetFrame>
      );
    }
    return (
      <WidgetFrame pad={18} style={styles.center}>
        <Eyebrow>{t('home.nutrition.eyebrow')}</Eyebrow>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('home.nutrition.setGoalHint')}</Text>
        <Button label={t('home.nutrition.setGoal')} onPress={openProfile} />
      </WidgetFrame>
    );
  }

  const eff = effectiveTarget;
  const remaining = eff != null ? Math.max(0, eff - kcal) : null;
  const pct = eff != null && eff > 0 ? Math.min(1, kcal / eff) : 0;
  const pctBudget = eff != null && eff > 0 ? Math.round((remaining! / eff) * 100) : 0;

  // Cibles macro (mêmes règles que l'écran nutrition : manuel prioritaire, sinon ratios objectif).
  const objective = nutritionProfile?.objective ?? objectiveFromGoal(profile?.mainGoal ?? null);
  const manualSet =
    nutritionProfile?.manualProteinG != null ||
    nutritionProfile?.manualCarbsG != null ||
    nutritionProfile?.manualFatG != null;
  const targetMacros = manualSet
    ? {
        protein: nutritionProfile?.manualProteinG ?? 0,
        carbs: nutritionProfile?.manualCarbsG ?? 0,
        fat: nutritionProfile?.manualFatG ?? 0,
      }
    : target != null && effectiveTarget != null && objective != null
      ? trainingDayMacroGrams({ targetBase: target, effectiveTarget, objective })
      : null;

  // ── Petit carré ────────────────────────────────────────────────────────────
  if (size === 'small') {
    return (
      <WidgetFrame pad={16} onPress={openFood} accessibilityLabel={t('home.nutrition.title')}>
        <Eyebrow>{t('home.nutrition.eyebrow')}</Eyebrow>
        <View style={styles.smallBottom}>
          <Metric
            value={remaining != null ? String(remaining) : String(kcal)}
            sub={remaining != null ? t('home.nutrition.remaining') : t('home.nutrition.consumedSub')}
          />
          {eff != null ? (
            <View style={[styles.thinTrack, { backgroundColor: colors.track }]}>
              <View style={{ height: '100%', width: `${Math.round(pct * 100)}%`, backgroundColor: colors.accent, borderRadius: 5 }} />
            </View>
          ) : null}
        </View>
      </WidgetFrame>
    );
  }

  // ── Rectangle ────────────────────────────────────────────────────────────────
  if (size === 'wide') {
    return (
      <WidgetFrame pad={18} onPress={openFood} accessibilityLabel={t('home.nutrition.title')} style={styles.wideRow}>
        <RingGauge size={86} stroke={9} pct={pct}>
          <Text style={[styles.ringBig, { color: colors.text }]}>{remaining ?? kcal}</Text>
          <Text style={[styles.ringSub, { color: colors.textMuted }]}>
            {remaining != null ? t('home.nutrition.remaining') : t('home.nutrition.consumedSub')}
          </Text>
        </RingGauge>
        <View style={styles.wideList}>
          <Eyebrow>{t('home.nutrition.todayEyebrow')}</Eyebrow>
          <DetailRow label={t('home.nutrition.consumed')} value={String(kcal)} />
          {eff != null ? <DetailRow label={t('home.nutrition.goal')} value={t('home.nutrition.kcalValue', { kcal: eff })} /> : null}
          {isTrainingDay && trainingBonus > 0 ? (
            <DetailRow label={t('home.nutrition.sport')} value={`+${trainingBonus}`} accent />
          ) : null}
        </View>
      </WidgetFrame>
    );
  }

  // ── Grand carré ──────────────────────────────────────────────────────────────
  return (
    <WidgetFrame pad={22} onPress={openFood} accessibilityLabel={t('home.nutrition.title')} style={styles.largeCol}>
      <View style={styles.largeHead}>
        <RingGauge size={104} stroke={11} pct={pct}>
          <Text style={[styles.ringBig, { color: colors.text }]}>{kcal}</Text>
          {eff != null ? (
            <Text style={[styles.ringSub, { color: colors.textMuted }]}>
              {t('home.nutrition.ofGoal', { target: eff })}
            </Text>
          ) : null}
        </RingGauge>
        <View style={styles.largeHeadRight}>
          <Eyebrow>{t('home.nutrition.remainingEyebrow')}</Eyebrow>
          <Text style={[styles.remainBig, { color: colors.accent }]}>{remaining ?? kcal}</Text>
          {eff != null ? (
            <Text style={[styles.budgetSub, { color: colors.textMuted }]}>
              {t('home.nutrition.budgetPct', { pct: pctBudget })}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.macros}>
        <MacroBar label={t('nutrition.macros.protein')} consumed={macros.p} target={targetMacros?.protein ?? null} color={colors.accent} />
        <MacroBar label={t('nutrition.macros.carbs')} consumed={macros.g} target={targetMacros?.carbs ?? null} color={colors.amber} />
        <MacroBar label={t('nutrition.macros.fat')} consumed={macros.l} target={targetMacros?.fat ?? null} color={colors.chartGreen} />
      </View>
    </WidgetFrame>
  );
}

/** Ligne « label ⋯ valeur » du rectangle. */
function DetailRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: accent ? colors.success : colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', gap: 8 },
  emptyText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  smallBottom: { marginTop: 'auto', gap: 8 },
  thinTrack: { height: 7, borderRadius: 5, overflow: 'hidden' },
  ringBig: { fontFamily: fontFamily.displayXBold, fontSize: 18, letterSpacing: -0.5 },
  ringSub: { fontFamily: fontFamily.body, fontSize: 9 },
  wideRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  wideList: { flex: 1, gap: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  detailLabel: { fontFamily: fontFamily.body, fontSize: 13 },
  detailValue: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  largeCol: { justifyContent: 'space-between' },
  largeHead: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  largeHeadRight: { flex: 1 },
  remainBig: { fontFamily: fontFamily.displayXBold, fontSize: 40, letterSpacing: -1.5 },
  budgetSub: { fontFamily: fontFamily.body, fontSize: 12 },
  macros: { gap: 13, marginTop: 'auto' },
  macroRow: { gap: 5 },
  macroHead: { flexDirection: 'row', justifyContent: 'space-between' },
  macroLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  macroFig: { fontFamily: fontFamily.mono, fontSize: 11 },
  macroTrack: { height: 8, borderRadius: 5, overflow: 'hidden' },
});
