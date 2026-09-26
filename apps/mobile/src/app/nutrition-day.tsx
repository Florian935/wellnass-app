/**
 * La page d'un jour passé — US NUTRI-UX03, §4.5 et R10.
 *
 * Avant cette US, relire un jour passé faisait basculer tout le hub : le grand chiffre, les ajouts
 * rapides, et « Chercher un aliment » qui écrivait alors sur ce jour-là. Le passé a désormais sa
 * page, ouverte depuis le calendrier et la liste d'Historique, la ligne « … n'a rien de saisi » et
 * les lignes de « Reprendre » :
 *  - on y **complète un oubli** (le + de chaque repas écrit sur ce jour, sans bandeau « il te reste ») ;
 *  - on y **reprend un repas** sur aujourd'hui (« Aujourd'hui »), ou **toute la journée** — avec une
 *    alerte si aujourd'hui n'est pas vide, et sans la section « Autres », qui deviendrait orpheline ;
 *  - on y retrouve ce que le hub montrait pour ce jour : l'énergie, les micronutriments, la qualité
 *    (D15 : rien ne se perd).
 *
 * Une date d'aujourd'hui ou à venir (lien forgé) renvoie sur l'onglet Aujourd'hui.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  dayTargetStatus,
  localDateFromDayKey,
  localDayKey,
  sumNutrients,
} from '@wellness/shared';
import { Screen } from '@/components/Screen';
import { DayEnergyCard } from '@/components/energy/DayEnergyCard';
import { AddFoodSheet } from '@/components/nutrition/AddFoodSheet';
import { DayJournal } from '@/components/nutrition/journal/DayJournal';
import { DayQualitySection, TrackedMicrosRecap } from '@/components/nutrition/journal/TrackedMicrosRecap';
import { useDailyCalorieTargets } from '@/data/repositories/dashboard-repository';
import { copyMeal, useDayEntries } from '@/data/repositories/journal-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { useKcalFormat } from '@/hooks/useKcalFormat';
import { useMealList } from '@/hooks/useMealList';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import { useTodayKey } from '@/hooks/useTodayKey';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const shiftDay = (dayKey: string, n: number) => localDayKey(addDays(localDateFromDayKey(dayKey), n));

export default function NutritionDayScreen() {
  useMenuFocus('nutrition');
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const kcal = useKcalFormat();
  const lang = i18n?.language ?? 'fr';
  const params = useLocalSearchParams<{ date?: string }>();
  const todayKey = useTodayKey();

  const requested = typeof params.date === 'string' && DAY_KEY.test(params.date) ? params.date : null;
  const valid = requested !== null && requested < todayKey;
  // Les hooks s'appellent toujours : un jour invalide lit la veille, le temps de la redirection.
  const day = valid ? requested! : shiftDay(todayKey, -1);

  // `dismissTo` revient au hub déjà dans la pile (ou le remplace s'il n'y est pas) : `replace` ou
  // `navigate` y empilaient un second arbre d'onglets, avec ses requêtes surveillées en double.
  useEffect(() => {
    if (!valid) router.dismissTo({ pathname: '/(tabs)/nutrition', params: { section: 'today' } });
  }, [valid, router]);

  const { entries } = useDayEntries(day);
  const { entries: todayEntries } = useDayEntries(todayKey);
  const mealList = useMealList();
  const { days: targetDays, marginPct } = useDailyCalorieTargets(day, day);
  const dayTarget = targetDays.find((d) => d.dayKey === day)?.effectiveTarget ?? null;

  const [addTarget, setAddTarget] = useState<{ mealKey: string } | null>(null);
  // Les repas repris, clés `jour:repas` : changer de jour (flèches) ne montre pas les « Ajouté » d'un
  // autre jour.
  const [redone, setRedone] = useState<ReadonlySet<string>>(new Set());
  const redoneToday = useMemo(
    () => new Set([...redone].filter((k) => k.startsWith(`${day}:`)).map((k) => k.slice(day.length + 1))),
    [redone, day],
  );
  const lockMeal = useActionLock();
  const lockDay = useActionLock();

  const totals = sumNutrients(entries);
  const status = dayTargetStatus(totals.kcal, dayTarget, marginPct);
  const date = localDateFromDayKey(day);
  const longDate = date.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });
  const title = longDate.charAt(0).toUpperCase() + longDate.slice(1);
  const summary =
    entries.length === 0
      ? t('nutritionHub.day.status.none')
      : status === null
        ? t('nutritionHub.day.status.noTarget', { kcal: kcal(totals.kcal) })
        : t(`nutritionHub.day.status.${status}`, {
            kcal: kcal(totals.kcal),
            delta: kcal(Math.abs(totals.kcal - (dayTarget ?? 0))),
          });

  // R10 — seules les entrées des repas configurés se reprennent : « Autres » deviendrait orphelin.
  const configured = useMemo(() => new Set(mealList.map((m) => m.key)), [mealList]);
  const redoable = mealList.filter((m) => entries.some((e) => e.mealType === m.key));
  const redoableKcal = entries.filter((e) => configured.has(e.mealType)).reduce((s, e) => s + e.kcal, 0);

  const redoMeal = (mealKey: string) => {
    if (redoneToday.has(mealKey)) return;
    void lockMeal(async () => {
      await copyMeal(day, mealKey, todayKey);
      setRedone((prev) => new Set(prev).add(`${day}:${mealKey}`));
    }).catch(() => undefined);
  };

  const redoAll = () => {
    const run = () =>
      void lockDay(async () => {
        for (const m of redoable) await copyMeal(day, m.key, todayKey);
        router.dismissTo({ pathname: '/(tabs)/nutrition', params: { section: 'today' } });
      }).catch(() => undefined);
    if (todayEntries.length === 0) {
      run();
      return;
    }
    Alert.alert(
      t('nutritionHub.day.confirmTitle'),
      t('nutritionHub.day.confirmBody', { count: todayEntries.length, date: longDate }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('nutritionHub.day.confirmAdd'), onPress: run },
      ],
    );
  };

  if (!valid) return null;

  const canNext = shiftDay(day, 1) < todayKey;

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </Pressable>
        <View style={styles.headerNav}>
          <Pressable
            onPress={() => router.setParams({ date: shiftDay(day, -1) })}
            accessibilityRole="button"
            accessibilityLabel={t('journal.prevDay')}
            style={styles.headerButton}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => canNext && router.setParams({ date: shiftDay(day, 1) })}
            disabled={!canNext}
            accessibilityRole="button"
            accessibilityLabel={t('journal.nextDay')}
            accessibilityState={{ disabled: !canNext }}
            style={[styles.headerButton, !canNext && styles.disabled]}
          >
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: (redoable.length > 0 ? 100 : 32) + insets.bottom }]}
      >
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header" testID="nutrition-day-title">
            {title}
          </Text>
          <Text style={[styles.summary, { color: colors.textMuted }]}>{summary}</Text>
          {entries.length > 0 ? (
            <Text style={[styles.macros, { color: colors.textMuted }]}>
              {t('nutritionHub.day.macros', { p: totals.proteinG, g: totals.carbsG, l: totals.fatG })}
            </Text>
          ) : null}
        </View>

        <DayJournal
          day={day}
          entries={entries}
          mealList={mealList}
          onAdd={(mealKey) => setAddTarget({ mealKey })}
          onRedoToday={redoMeal}
          redoneMeals={redoneToday}
          redoA11y={(meal, done) =>
            t(done ? 'nutritionHub.day.redoneA11y' : 'nutritionHub.day.redoMealA11y', { meal, date: longDate })
          }
        />

        {entries.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>{t('nutritionHub.day.empty')}</Text>
        ) : null}

        <DayEnergyCard dayKey={day} consumedKcal={totals.kcal} />
        <TrackedMicrosRecap entries={entries} />
        {entries.length > 0 ? <DayQualitySection day={day} targetKcal={dayTarget} /> : null}
      </ScrollView>

      {redoable.length > 0 ? (
        <View style={[styles.redoBar, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background }]}>
          <Pressable
            testID="nutrition-day-redo-all"
            onPress={redoAll}
            accessibilityRole="button"
            accessibilityLabel={t('nutritionHub.day.redoAll')}
            style={[styles.redo, { backgroundColor: colors.accent }]}
          >
            <View style={styles.redoRow}>
              <Ionicons name="refresh" size={17} color={colors.accentText} />
              <Text style={[styles.redoLabel, { color: colors.accentText }]}>{t('nutritionHub.day.redoAll')}</Text>
            </View>
            <Text style={[styles.redoHint, { color: colors.accentText }]}>
              {t('nutritionHub.day.redoAllMeta', { count: redoable.length, kcal: kcal(redoableKcal) })}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {addTarget != null ? (
        <AddFoodSheet
          visible
          date={day}
          mealKey={addTarget.mealKey}
          mealLabel={mealList.find((m) => m.key === addTarget.mealKey)?.label ?? t('journal.meals.other')}
          kcalRemaining={null}
          proteinRemaining={null}
          consumedRatio={0}
          onClose={() => setAddTarget(null)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, minHeight: 52 },
  headerNav: { flexDirection: 'row', alignItems: 'center' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  scroll: { paddingHorizontal: 20, gap: 12 },
  titleBlock: { gap: 4, marginBottom: 6 },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 28, letterSpacing: -0.8 },
  summary: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 19 },
  macros: { fontFamily: fontFamily.mono, fontSize: 11.5 },
  empty: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 20, paddingHorizontal: 4 },
  redoBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12 },
  redo: { minHeight: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 1 },
  redoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  redoLabel: { fontFamily: fontFamily.bodyBold, fontSize: 16.5 },
  redoHint: { fontFamily: fontFamily.body, fontSize: 12, opacity: 0.9 },
});
