/**
 * US MESUR-01 — écran d'historique des mensurations : courbe par mesure + relevés avec delta.
 *
 * Trois choix de lecture, les mêmes que l'historique de bien-être et pour les mêmes raisons :
 * 1. **une courbe à la fois** — six séries superposées sur un téléphone sont illisibles ;
 * 2. **un jour non mesuré est un trou**, jamais un zéro ;
 * 3. le **delta** du premier relevé est annoncé « premier relevé », pas « 0 » : rien à comparer n'est
 *    pas la même information qu'aucun changement.
 *
 * Le **poids n'est pas re-courbé ici** : sa courbe existe côté Stats nutrition (roadmap 4.30). On y
 * renvoie plutôt que d'en maintenir deux.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  MEASUREMENT_KINDS,
  formatDayFull,
  localDayKey,
  measurementDeltas,
  measurementSeries,
  type MeasurementKind,
} from '@wellness/shared';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ProgressLineChart } from '@/components/charts/ProgressLineChart';
import { MeasurementSheet } from '@/components/measurements/MeasurementSheet';
import {
  useLatestMeasurements,
  useMeasurements,
} from '@/data/repositories/body-measurement-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Fenêtres proposées, en jours. `null` = tout l'historique. */
const WINDOWS = [
  { key: 'windowThreeMonths', days: 90 },
  { key: 'windowYear', days: 365 },
  { key: 'windowAll', days: null },
] as const;

/** Début de fenêtre (clé de jour) ou `undefined` pour « tout ». */
function sinceKey(days: number | null): string | undefined {
  if (days === null) return undefined;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDayKey(d);
}

/** Libellé d'axe abrégé (« 12/07 ») — la date complète va dans l'infobulle. */
function shortLabel(dayKey: string): string {
  const [, month, day] = dayKey.split('-');
  return `${day}/${month}`;
}

export default function MeasurementsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();

  const [kind, setKind] = useState<MeasurementKind>('waist');
  const [windowIndex, setWindowIndex] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { rows } = useMeasurements();
  const { latest } = useLatestMeasurements();

  const since = sinceKey(WINDOWS[windowIndex]!.days);

  const series = useMemo(() => measurementSeries(rows, kind, since), [rows, kind, since]);
  const entries = useMemo(() => measurementDeltas(rows, kind), [rows, kind]);

  // La courbe est tracée dans l'unité **affichée** : en impérial, un axe en cm serait illisible.
  const chartData = series.map((point) => ({
    label: shortLabel(point.dayKey),
    detail: formatDayFull(point.dayKey),
    value: units.toCircumferenceValue(point.valueCm),
  }));

  const hasAnyMeasurement = rows.length > 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title={t('measurements.title')} />

        <Button label={t('measurements.cta')} onPress={() => setSheetOpen(true)} />

        {!hasAnyMeasurement ? (
          <Card>
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {t('measurements.emptyHistory')}
            </Text>
          </Card>
        ) : (
          <>
            {/* Sélecteur de mesure — 2 lignes de 3 pour garder des cibles confortables */}
            <View style={styles.segs} accessibilityRole="tablist">
              {MEASUREMENT_KINDS.slice(0, 3).map((id) => (
                <KindTab key={id} id={id} active={id === kind} onPress={() => setKind(id)} />
              ))}
            </View>
            <View style={styles.segs}>
              {MEASUREMENT_KINDS.slice(3).map((id) => (
                <KindTab key={id} id={id} active={id === kind} onPress={() => setKind(id)} />
              ))}
            </View>

            <View style={styles.segs}>
              {WINDOWS.map((w, index) => {
                const active = index === windowIndex;
                return (
                  <Pressable
                    key={w.key}
                    onPress={() => setWindowIndex(index)}
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
                      style={[
                        styles.segLabel,
                        { color: active ? colors.background : colors.textMuted },
                      ]}
                      maxFontSizeMultiplier={1.3}
                    >
                      {t(`measurements.${w.key}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Card>
              {/* Un point n'est pas une tendance : on le dit plutôt que de tracer une ligne plate. */}
              {chartData.length < 2 ? (
                <Text style={[styles.empty, { color: colors.textMuted }]}>
                  {t('measurements.notEnoughForCurve')}
                </Text>
              ) : (
                <ProgressLineChart
                  data={chartData}
                  title={t(`measurements.kinds.${kind}`)}
                  unit={units.circumferenceSymbol}
                  smooth
                  // Sans formateur, gifted-charts génère ses propres libellés en formatage JS
                  // brut — « 90.2 » en français. Le fournir impose aussi l'échelle sur [min, max],
                  // ce qui est de toute façon plus lisible ici : un tour de taille qui passe de 81
                  // à 82 cm est une ligne plate sur un axe partant de 0.
                  formatYLabel={units.formatAxisNumber}
                  // 2 cm de marge quand tous les relevés sont identiques (le défaut vaut 30, en
                  // secondes d'allure — il ouvrirait une bande de 60 cm).
                  flatPad={2}
                />
              )}
            </Card>

            <Text style={[styles.section, { color: colors.textMuted }]}>
              {t('measurements.entries')}
            </Text>
            <Card>
              {entries.length === 0 ? (
                <Text style={[styles.empty, { color: colors.textMuted }]}>
                  {t('measurements.emptyToday')}
                </Text>
              ) : (
                entries.map((entry, index) => {
                  // Delta converti dans l'unité affichée : un −1,5 cm vaut −0,6 in.
                  const delta =
                    entry.deltaCm === null
                      ? null
                      : Math.round(units.toCircumferenceValue(Math.abs(entry.deltaCm)) * 10) / 10;
                  const down = entry.deltaCm !== null && entry.deltaCm < 0;
                  const flat = entry.deltaCm === 0;

                  const spokenDelta =
                    entry.deltaCm === null
                      ? t('measurements.noDelta')
                      : flat
                        ? t('measurements.a11yDeltaFlat')
                        : t(down ? 'measurements.a11yDeltaDown' : 'measurements.a11yDeltaUp', {
                            value: `${delta} ${units.circumferenceSymbol}`,
                          });

                  return (
                    <View
                      key={`${entry.logDate}-${kind}`}
                      style={[
                        styles.row,
                        index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                      ]}
                      accessibilityLabel={`${formatDayFull(entry.logDate)}. ${units.formatCircumference(entry.valueCm)}. ${spokenDelta}`}
                    >
                      <Text
                        style={[styles.date, { color: colors.textMuted }]}
                        maxFontSizeMultiplier={1.3}
                      >
                        {formatDayFull(entry.logDate)}
                      </Text>
                      <Text
                        style={[styles.value, { color: colors.text }]}
                        maxFontSizeMultiplier={1.3}
                      >
                        {units.formatCircumference(entry.valueCm)}
                      </Text>
                      {/* Le signe est dans le texte : la couleur ne porte jamais seule le sens. */}
                      <Text
                        style={[
                          styles.delta,
                          {
                            color:
                              entry.deltaCm === null || flat
                                ? colors.textMuted
                                : down
                                  ? colors.success
                                  : colors.warnText,
                          },
                        ]}
                        maxFontSizeMultiplier={1.3}
                      >
                        {entry.deltaCm === null ? '—' : flat ? '=' : `${down ? '−' : '+'}${delta}`}
                      </Text>
                    </View>
                  );
                })
              )}
            </Card>

            <Pressable
              onPress={() => router.push('/nutrition-stats')}
              hitSlop={8}
              accessibilityRole="link"
              style={styles.link}
            >
              <Text style={[styles.linkLabel, { color: colors.accent }]}>
                {t('measurements.seeWeightCurve')}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <MeasurementSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        latest={latest}
      />
    </Screen>
  );
}

function KindTab({
  id,
  active,
  onPress,
}: {
  id: MeasurementKind;
  active: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={t('measurements.a11yKindTab', {
        kind: t(`measurements.kinds.${id}`),
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
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
      >
        {t(`measurements.kinds.${id}`)}
      </Text>
    </Pressable>
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
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  segLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  section: { fontFamily: fontFamily.bodySemi, fontSize: 13, marginTop: 8 },
  empty: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  date: { fontFamily: fontFamily.body, fontSize: 12.5, flex: 1 },
  value: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  delta: { fontFamily: fontFamily.bodySemi, fontSize: 12.5, minWidth: 52, textAlign: 'right' },
  link: { paddingVertical: 10 },
  linkLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});
