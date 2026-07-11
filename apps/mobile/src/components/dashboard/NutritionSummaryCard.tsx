/**
 * Widget 7.5 — Résumé nutritionnel du jour.
 *
 * États :
 *  - `hasProfile = true`  : ligne calories (avec ou sans objectif), barre de progression,
 *                           3 chips macro, CTA "+ Ajouter un repas" (ghost)
 *  - `hasProfile = false` : texte vide + CTA "Définir mon objectif" (primary)
 *
 * Routing :
 *  - Ajouter un repas    → `/food-picker` (meal=breakfast, date=aujourd'hui)
 *  - Définir l'objectif  → `/nutrition-profile`
 *
 * i18n :
 *  - Réutilise `nutrition.macros.{protein,carbs,fat}` (déjà définis) — pas de duplication.
 *  - Nouvelles clés : `home.nutrition.{caloriesGoal, caloriesNoGoal, cta, setGoal, setGoalHint}`.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { DashboardCard } from '@/components/DashboardCard';
import { useNutritionSummary } from '@/data/repositories/dashboard-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

type MacroChipProps = { label: string; value: number };

function MacroChip({ label, value }: MacroChipProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.macroChip, { backgroundColor: colors.surfaceAlt }]}>
      <Text style={[styles.macroLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.macroValue, { color: colors.text }]}>{value} g</Text>
    </View>
  );
}

export function NutritionSummaryCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { kcal, target, macros, hasProfile, isLoading } = useNutritionSummary();

  if (isLoading) return null;

  // ── État : profil non configuré ────────────────────────────────────────────
  if (!hasProfile) {
    return (
      <DashboardCard icon="nutrition-outline" title={t('home.nutrition.title')}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {t('home.nutrition.setGoalHint')}
        </Text>
        <Button
          label={t('home.nutrition.setGoal')}
          onPress={() => router.push('/nutrition-profile')}
        />
      </DashboardCard>
    );
  }

  // ── État : profil configuré ────────────────────────────────────────────────
  const pct = target != null && target > 0
    ? Math.min(100, Math.round((kcal / target) * 100))
    : 0;
  const today = isoDay(new Date());

  return (
    <DashboardCard icon="nutrition-outline" title={t('home.nutrition.title')}>
      {/* Ligne calories */}
      <Text style={[styles.kcalValue, { color: colors.text }]}>
        {target != null
          ? t('home.nutrition.caloriesGoal', { kcal, target })
          : t('home.nutrition.caloriesNoGoal', { kcal })}
      </Text>

      {/* Barre de progression (uniquement si objectif défini) */}
      {target != null ? (
        <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
          <View
            style={[
              styles.fill,
              { backgroundColor: colors.accent, width: `${pct}%` },
            ]}
          />
        </View>
      ) : null}

      {/* 3 chips macro — réutilise nutrition.macros.{protein,carbs,fat} */}
      <View style={styles.macrosRow}>
        <MacroChip label={t('nutrition.macros.protein')} value={macros.p} />
        <MacroChip label={t('nutrition.macros.carbs')} value={macros.g} />
        <MacroChip label={t('nutrition.macros.fat')} value={macros.l} />
      </View>

      {/* CTA ajouter repas */}
      <Button
        label={t('home.nutrition.cta')}
        variant="ghost"
        onPress={() =>
          router.push({
            pathname: '/food-picker',
            params: { date: today, meal: 'breakfast' },
          })
        }
      />
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  emptyText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  kcalValue: { fontFamily: fontFamily.monoBold, fontSize: 22, letterSpacing: -0.5 },
  track: { height: 9, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  macrosRow: { flexDirection: 'row', gap: 8 },
  macroChip: { flex: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, gap: 2 },
  macroLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  macroValue: { fontFamily: fontFamily.monoBold, fontSize: 15 },
});
