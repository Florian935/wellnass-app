/**
 * US BIEN-01 — écran d'historique du bien-être : courbe par indicateur + journal des jours.
 *
 * Deux choix de lecture assumés, et ce sont eux qui rendent l'écran honnête :
 * 1. **une seule courbe à la fois**, via un sélecteur d'indicateur — trois séries superposées sur un
 *    écran de téléphone sont illisibles ;
 * 2. **un jour non renseigné est un trou** : il n'apparaît pas dans la courbe et s'affiche « non
 *    renseigné » dans le journal, jamais comme un 0 (qui ferait plonger la courbe pour un jour où
 *    l'utilisateur n'a simplement rien dit).
 *
 * Le **poids n'est pas re-courbé ici** : sa courbe existe déjà côté Stats nutrition (roadmap 4.30).
 * En dupliquer une seconde donnerait deux graphiques à maintenir pour la même donnée.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  WELLBEING_INDICATORS,
  WELLBEING_SCALE_MAX,
  canEditDay,
  formatDayFull,
  isWellbeingLevel,
  wellbeingAverages,
  wellbeingSeries,
  type WellbeingIndicator,
  type WellbeingLevel,
} from '@wellness/shared';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ProgressLineChart } from '@/components/charts/ProgressLineChart';
import { WELLBEING_GLYPHS, useLevelLabel } from '@/components/wellbeing/WellbeingScale';
import { WellbeingCheckinSheet } from '@/components/wellbeing/WellbeingCheckinSheet';
import {
  useWellbeingEntries,
  type WellbeingEntry,
} from '@/data/repositories/daily-wellbeing-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useTodayKey } from '@/hooks/useTodayKey';

/** Fenêtres proposées, alignées sur `/progress`. */
const WINDOWS = [30, 90, 365] as const;
type Window = (typeof WINDOWS)[number];

/** Libellé d'axe abrégé (« 12/07 ») — la date complète va dans l'infobulle. */
function shortLabel(dayKey: string): string {
  const [, month, day] = dayKey.split('-');
  return `${day}/${month}`;
}

export default function WellbeingScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const levelLabel = useLevelLabel();

  const [indicator, setIndicator] = useState<WellbeingIndicator>('mood');
  const [window, setWindow] = useState<Window>(30);
  const [editing, setEditing] = useState<WellbeingEntry | null>(null);
  const [editingDay, setEditingDay] = useState<string | null>(null);

  const todayKey = useTodayKey();
  const { entries } = useWellbeingEntries();

  const series = useMemo(
    () => wellbeingSeries(entries, indicator, window, todayKey),
    [entries, indicator, window, todayKey],
  );
  const averages = useMemo(
    () => wellbeingAverages(entries, window, todayKey),
    [entries, window, todayKey],
  );

  const chartData = series.map((point) => ({
    label: shortLabel(point.dayKey),
    detail: formatDayFull(point.dayKey),
    value: point.value,
  }));

  const average = averages[indicator];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title={t('wellbeing.historyTitle')} />

        {entries.length === 0 ? (
          <>
            {/*
              Le check-in s'ouvre normalement en tapant un jour du journal. Sans aucun jour
              enregistré, il n'y avait donc **aucun** moyen de le lancer depuis cet écran : un
              cul-de-sac atteint par un lien direct ou par le widget d'accueil (constaté le
              30/07/2026 en passe device). Même patron que « Prendre mes mesures » côté MESUR-01.
            */}
            <Button
              label={t('wellbeing.checkinCta')}
              accessibilityLabel={t('wellbeing.a11yOpenCheckin')}
              onPress={() => setEditingDay(todayKey)}
            />
            <Card>
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                {t('wellbeing.emptyHistory')}
              </Text>
            </Card>
          </>
        ) : (
          <>
            {/* Sélecteur d'indicateur — une courbe à la fois */}
            <View style={styles.segs} accessibilityRole="tablist">
              {WELLBEING_INDICATORS.map((id) => {
                const active = id === indicator;
                return (
                  <Pressable
                    key={id}
                    onPress={() => setIndicator(id)}
                    hitSlop={8}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={t('wellbeing.a11yIndicatorTab', {
                      indicator: t(`wellbeing.indicators.${id}`),
                    })}
                    style={[
                      styles.seg,
                      {
                        borderColor: active ? colors.accent : colors.border,
                        backgroundColor: active ? colors.accent : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[styles.segLabel, { color: active ? colors.background : colors.textMuted }]}
                      maxFontSizeMultiplier={1.3}
                    >
                      {t(`wellbeing.indicators.${id}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Fenêtre */}
            <View style={styles.segs}>
              {WINDOWS.map((days) => {
                const active = days === window;
                return (
                  <Pressable
                    key={days}
                    onPress={() => setWindow(days)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.seg,
                      {
                        borderColor: active ? colors.accent : colors.border,
                        backgroundColor: active ? colors.accent : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[styles.segLabel, { color: active ? colors.background : colors.textMuted }]}
                      maxFontSizeMultiplier={1.3}
                    >
                      {days === 365
                        ? t('wellbeing.windowAll')
                        : t('wellbeing.windowDays', { count: days })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Card>
              {/* Un point n'est pas une tendance : on le dit plutôt que de tracer une ligne plate. */}
              {chartData.length < 2 ? (
                <Text style={[styles.empty, { color: colors.textMuted }]}>
                  {t('wellbeing.notEnoughForCurve')}
                </Text>
              ) : (
                <>
                  <ProgressLineChart
                    data={chartData}
                    title={t(`wellbeing.indicators.${indicator}`)}
                    unit={`/ ${WELLBEING_SCALE_MAX}`}
                    smooth
                  />
                  {average.average !== null && (
                    <Text style={[styles.average, { color: colors.textMuted }]}>
                      {t('wellbeing.averageOver', {
                        value: average.average.toFixed(1),
                        count: average.days,
                      })}
                    </Text>
                  )}
                </>
              )}
            </Card>

            {/* Journal */}
            <Text style={[styles.section, { color: colors.textMuted }]}>
              {t('wellbeing.journal')}
            </Text>
            <Card>
              {entries.map((entry, index) => {
                const editable = canEditDay(entry.logDate, todayKey);
                const glyphs = WELLBEING_INDICATORS.map((id) =>
                  isWellbeingLevel(entry[id]) ? WELLBEING_GLYPHS[id][entry[id] as WellbeingLevel] : '—',
                ).join('  ');
                const spoken = WELLBEING_INDICATORS.filter((id) => isWellbeingLevel(entry[id]))
                  .map(
                    (id) =>
                      `${t(`wellbeing.indicators.${id}`)} : ${levelLabel(id, entry[id] as WellbeingLevel)}`,
                  )
                  .join(', ');

                return (
                  <Pressable
                    key={entry.id}
                    disabled={!editable}
                    onPress={() => {
                      setEditing(entry);
                      setEditingDay(entry.logDate);
                    }}
                    accessibilityRole={editable ? 'button' : undefined}
                    accessibilityLabel={`${formatDayFull(entry.logDate)}. ${spoken || t('wellbeing.notLogged')}`}
                    style={[
                      styles.row,
                      index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.day, { color: colors.text }]} maxFontSizeMultiplier={1.3}>
                      {formatDayFull(entry.logDate)}
                    </Text>
                    <Text style={styles.glyphs} maxFontSizeMultiplier={1.4}>
                      {glyphs}
                    </Text>
                  </Pressable>
                );
              })}
            </Card>

            <Pressable
              onPress={() => router.push('/nutrition-stats')}
              hitSlop={8}
              accessibilityRole="link"
              style={styles.link}
            >
              <Text style={[styles.linkLabel, { color: colors.accent }]}>
                {t('wellbeing.weightSeeCurve')}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <WellbeingCheckinSheet
        visible={editingDay !== null}
        onClose={() => {
          setEditingDay(null);
          setEditing(null);
        }}
        logDate={editingDay ?? todayKey}
        existing={editing}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  segs: { flexDirection: 'row', gap: 6 },
  seg: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  segLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  section: { fontFamily: fontFamily.bodySemi, fontSize: 13, marginTop: 8 },
  empty: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19 },
  average: { fontFamily: fontFamily.body, fontSize: 12, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  day: { fontFamily: fontFamily.bodySemi, fontSize: 13, flex: 1 },
  glyphs: { fontSize: 16, letterSpacing: 1 },
  link: { paddingVertical: 10 },
  linkLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});
