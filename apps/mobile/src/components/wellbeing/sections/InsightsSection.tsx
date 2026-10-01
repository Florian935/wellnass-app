/**
 * US BIEN-05 — Bien-être › Ce qui compte.
 *
 * Depuis le Labo carrefour (LIENS-01, décision du 30/09/2026), **les croisements entre piliers vivent
 * au Labo** ; un pilier n'en garde qu'un écho. Cet onglet suit la règle :
 *  - l'**écho** du lien « Ton état du jour pèse-t-il sur tes séances ? », qui ouvre sa fiche au Labo
 *    (nuit → tonnage, allure, apports ; envie → séances ; stress → journal ; séance → humeur) ;
 *  - ce qui reste **à l'intérieur du pilier** : ce qui pèse sur tes nuits (alcool, café tardif — modules),
 *    la régularité du coucher (nuits lues), et tes moyennes des 30 derniers jours.
 *
 * Mêmes règles que le registre : « va souvent avec », jamais « parce que » ; toujours le nombre de cas ;
 * une piste écartée se dit aussi.
 */

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  WELLBEING_LINKS_WINDOW_DAYS,
  bedtimeSpread,
  isSleepMinutes,
  linkProgress,
  wellbeingScaleAverage,
  type WellbeingLink,
} from '@wellness/shared';

import { Card } from '@/components/Card';
import { formatDecimal, formatMinutes } from '@/components/lab/lab-format';
import { linkTexts } from '@/components/lab/link-format';
import { linkHref } from '@/components/lab/link-routes';
import { useCrossLinks } from '@/data/repositories/cross-links-repository';
import { useWellbeingEntries } from '@/data/repositories/daily-wellbeing-repository';
import { useWellbeingPillar } from '@/data/repositories/wellbeing-pillar-repository';
import { useTodayKey, useWindowStartKey } from '@/hooks/useTodayKey';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const AVERAGE_DAYS = 30;

function clock(minutesOfDay: number): string {
  const h = Math.floor(minutesOfDay / 60);
  const m = minutesOfDay % 60;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

export function InsightsSection() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const todayKey = useTodayKey();
  const pillar = useWellbeingPillar();
  const crossLinks = useCrossLinks();
  const since = useWindowStartKey(AVERAGE_DAYS);
  const { entries: rows } = useWellbeingEntries(since);

  const link = crossLinks?.links.find((l) => l.id === 'wellbeing') ?? null;
  const texts = link === null ? null : linkTexts(t, i18n.language, link);
  const intra = (crossLinks?.wellbeing?.links ?? []).filter((l) => l.scope === 'intra');

  const averages = useMemo(() => {
    const nights = rows.filter((r) => isSleepMinutes(r.sleepMinutes)).map((r) => r.sleepMinutes as number);
    const night = nights.length > 0 ? { value: formatMinutes(Math.round(nights.reduce((a, b) => a + b, 0) / nights.length)), days: nights.length } : null;
    const scales = (['sleepQuality', 'energy', 'motivation', 'mood', 'stress'] as const)
      .map((key) => ({ key, avg: wellbeingScaleAverage(rows, key, AVERAGE_DAYS, todayKey) }))
      .filter((s) => s.avg.average !== null);
    return { night, scales };
  }, [rows, todayKey]);

  const regularity = useMemo(
    () => bedtimeSpread(rows.map((r) => ({ logDate: r.logDate, sleepStartAt: r.sleepStartAt })), todayKey),
    [rows, todayKey],
  );

  const intraText = (l: WellbeingLink): string => {
    if (l.status === 'learning') return t('wellbeingHub.insights.learning', { have: linkProgress(l), need: l.need });
    if (l.status === 'noLink') return t(`wellbeingHub.insights.intra.${l.id}.noLink`, { exposed: l.exposed, other: l.other });
    return t(`wellbeingHub.insights.intra.${l.id}.known`, {
      delta: formatMinutes(Math.abs(l.delta ?? 0)),
      direction: t((l.delta ?? 0) < 0 ? 'wellbeingHub.insights.shorter' : 'wellbeingHub.insights.longer'),
      exposed: l.exposed,
      other: l.other,
    });
  };

  return (
    <View style={styles.stack} testID="wellbeing-insights">
      <Text style={[styles.intro, { color: colors.textMuted }]}>{t('wellbeingHub.insights.intro', { days: WELLBEING_LINKS_WINDOW_DAYS })}</Text>

      {link !== null && texts !== null ? (
        <Pressable
          testID="wellbeing-lab-echo"
          onPress={() => router.push(linkHref('wellbeing'))}
          accessibilityRole="link"
          accessibilityLabel={`${texts.question}. ${texts.state}. ${texts.short}`}
          style={[styles.echo, { backgroundColor: colors.surface, borderColor: colors.pillarWellbeing }]}
        >
          <Text style={[styles.overline, { color: colors.pillarWellbeing }]}>{t('wellbeingHub.insights.labOverline')}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{texts.question}</Text>
          <Text style={[styles.body, { color: colors.text }]}>{texts.short}</Text>
          <Text style={[styles.state, { color: colors.textMuted }]}>
            {texts.state}
            {link.missing !== null && texts.meter !== null ? ` · ${texts.meter}` : ''}
          </Text>
          <Text style={[styles.cta, { color: colors.accent }]}>{t('wellbeingHub.insights.openLab')}</Text>
        </Pressable>
      ) : (
        <Card>
          <Text style={[styles.body, { color: colors.textMuted }]}>{t('wellbeingHub.insights.noPillarToCross')}</Text>
        </Card>
      )}

      {intra.length > 0 ? (
        <Card>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('wellbeingHub.insights.nightsTitle')}</Text>
          {intra.map((l) => (
            <View key={l.id} style={[styles.row, { borderTopColor: colors.border }]} testID={`wellbeing-intra-${l.id}`}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t(`wellbeingHub.insights.intra.${l.id}.label`)}</Text>
              <Text style={[styles.body, { color: l.status === 'learning' ? colors.textMuted : colors.text }]}>{intraText(l)}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('wellbeingHub.insights.regularityTitle')}</Text>
        {regularity !== null ? (
          <Text style={[styles.body, { color: colors.text }]} testID="wellbeing-regularity">
            {t('wellbeingHub.insights.regularity', { bedtime: clock(regularity.meanBedtimeMinutes), spread: regularity.spreadMinutes, count: regularity.nights })}
          </Text>
        ) : (
          <Text style={[styles.body, { color: colors.textMuted }]}>
            {t(pillar.sleepFromHealthConnect ? 'wellbeingHub.insights.regularityLearning' : 'wellbeingHub.insights.regularityNeedsHealthConnect')}
          </Text>
        )}
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('wellbeingHub.insights.averagesTitle', { days: AVERAGE_DAYS })}</Text>
        {averages.night === null && averages.scales.length === 0 ? (
          <Text style={[styles.body, { color: colors.textMuted }]}>{t('wellbeingHub.insights.averagesEmpty')}</Text>
        ) : null}
        {averages.night !== null ? (
          <View style={[styles.row, { borderTopColor: colors.border }]}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{t('wellbeing.sleepLabel')}</Text>
            <Text style={[styles.body, { color: colors.text }]}>{t('wellbeingHub.insights.averageNight', { value: averages.night.value, count: averages.night.days })}</Text>
          </View>
        ) : null}
        {averages.scales.map(({ key, avg }) => (
          <View key={key} style={[styles.row, { borderTopColor: colors.border }]}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{t(`wellbeing.indicators.${key}`)}</Text>
            <Text style={[styles.body, { color: colors.text }]}>
              {t('wellbeing.averageOver', { value: formatDecimal(avg.average as number, i18n.language, 1), count: avg.days })}
            </Text>
          </View>
        ))}
      </Card>

      <Text style={[styles.footnote, { color: colors.textMuted }]}>{t('wellbeingHub.insights.footnote')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  intro: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19 },
  echo: { borderRadius: 22, borderWidth: 1.5, padding: 18, gap: 6 },
  overline: { fontFamily: fontFamily.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 18, lineHeight: 23 },
  body: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  state: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  cta: { fontFamily: fontFamily.bodyBold, fontSize: 13.5, marginTop: 4 },
  cardTitle: { fontFamily: fontFamily.bodyBold, fontSize: 15.5, marginBottom: 4 },
  row: { borderTopWidth: 1, paddingTop: 10, marginTop: 10, gap: 3 },
  rowLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13.5 },
  footnote: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 },
});
