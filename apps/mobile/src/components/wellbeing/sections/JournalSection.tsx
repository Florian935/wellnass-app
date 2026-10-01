/**
 * US BIEN-02 — Bien-être › Journal.
 *
 * Le mois en couleurs, un indicateur à la fois (une seule mesure lisible par case), puis les derniers
 * jours avec **ce que les piliers ont fait** ce jour-là — c'est ce voisinage qui rend le journal utile :
 * « nuit de 5 h 10, veille de soirée » à côté de la sortie lente.
 *
 * Deux règles tenues : un jour non renseigné est un **trou** (case en pointillé), jamais une valeur ;
 * la couleur n'est jamais seule — chaque case porte son numéro de jour, la légende dit le sens, et les
 * jours de la liste disent leurs valeurs en mots.
 */

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ALCOHOL_DRINKS_MAX,
  addDays,
  canEditDay,
  formatDayFull,
  isAlcoholDrinks,
  isNapMinutes,
  isSleepMinutes,
  isWellbeingLevel,
  localDateFromDayKey,
  localDayKey,
  type CheckinMoment,
  type WellbeingLevel,
} from '@wellness/shared';

import { Card } from '@/components/Card';
import { formatMinutes } from '@/components/lab/lab-format';
import { MomentCheckinSheet } from '@/components/wellbeing/MomentCheckinSheet';
import { useLevelLabel } from '@/components/wellbeing/WellbeingScale';
import { useWellbeingEntries, type WellbeingEntry } from '@/data/repositories/daily-wellbeing-repository';
import { useDailyTotals } from '@/data/repositories/journal-repository';
import { useRunHistory } from '@/data/repositories/run-repository';
import { useWorkoutHistory } from '@/data/repositories/workout-repository';
import { useTodayKey, useWindowStartKey } from '@/hooks/useTodayKey';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Les mesures que le calendrier sait colorer. La nuit en premier : c'est la plus parlante. */
const METRICS = ['sleep', 'sleepQuality', 'energy', 'motivation', 'mood', 'stress'] as const;
type Metric = (typeof METRICS)[number];

/** Nuit en classes de 1 à 5 : moins de 5 h, 5-6 h, 6-7 h, 7-8 h, 8 h et plus. */
function sleepBin(minutes: number): WellbeingLevel {
  if (minutes < 300) return 1;
  if (minutes < 360) return 2;
  if (minutes < 420) return 3;
  if (minutes < 480) return 4;
  return 5;
}

function levelOf(entry: WellbeingEntry, metric: Metric): WellbeingLevel | null {
  if (metric === 'sleep') return isSleepMinutes(entry.sleepMinutes) ? sleepBin(entry.sleepMinutes) : null;
  const v = entry[metric];
  return isWellbeingLevel(v) ? v : null;
}

/** Cinq teintes du violet du pilier, de la plus claire à la plus profonde, et leur encre. */
const SCALE = {
  light: { fill: ['#efe8f7', '#d4c3ec', '#b096dc', '#7d58bd', '#5f37a6'], ink: ['#33291f', '#33291f', '#33291f', '#ffffff', '#ffffff'] },
  dark: { fill: ['#2c2440', '#43356b', '#5f4a99', '#9a80dc', '#c2a3ff'], ink: ['#f4ecdd', '#f4ecdd', '#f4ecdd', '#0f0a06', '#0f0a06'] },
} as const;

const DAYS_LISTED = 14;

export function JournalSection() {
  const { t, i18n } = useTranslation();
  const { colors, scheme } = useTheme();
  const router = useRouter();
  const levelLabel = useLevelLabel();
  const todayKey = useTodayKey();
  const [metric, setMetric] = useState<Metric>('sleep');
  const [monthOffset, setMonthOffset] = useState(0);
  const [sheet, setSheet] = useState<{ logDate: string; moment: CheckinMoment; existing: WellbeingEntry | null } | null>(null);

  const { entries } = useWellbeingEntries();
  const listStart = useWindowStartKey(DAYS_LISTED);
  const { workouts } = useWorkoutHistory();
  const { runs } = useRunHistory();
  const { totals } = useDailyTotals(listStart);
  const byDay = useMemo(() => new Map(entries.map((e) => [e.logDate, e])), [entries]);

  // Le mois affiché (0 = le mois courant).
  const today = localDateFromDayKey(todayKey);
  const first = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // lundi en premier
  const cells: ({ key: string; n: number } | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ key: localDayKey(new Date(first.getFullYear(), first.getMonth(), i + 1)), n: i + 1 })),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const monthLabel = first.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });
  const palette = SCALE[scheme === 'dark' ? 'dark' : 'light'];

  // Les derniers jours, du plus récent au plus ancien, avec ce que les piliers ont fait.
  const days = useMemo(() => {
    const activity = new Map<string, string[]>();
    const add = (k: string | null, s: string) => {
      if (k === null || k < listStart) return;
      activity.set(k, [...(activity.get(k) ?? []), s]);
    };
    for (const w of workouts) add(w.finishedAt ? localDayKey(new Date(w.finishedAt)) : null, t('wellbeingHub.journal.didStrength', { name: w.sessionName ?? t('wellbeingHub.today.pillarSession.strength') }));
    for (const r of runs) add(r.finishedAt ? localDayKey(new Date(r.finishedAt)) : null, t('wellbeingHub.journal.didRun', { km: ((r.distanceM ?? 0) / 1000).toFixed(1) }));
    for (const d of totals) add(d.logDate, t('wellbeingHub.journal.didEat', { kcal: d.kcal }));
    const base = localDateFromDayKey(todayKey);
    return Array.from({ length: DAYS_LISTED }, (_, i) => localDayKey(addDays(base, -i))).map((key) => ({ key, entry: byDay.get(key) ?? null, did: activity.get(key) ?? [] }));
  }, [byDay, workouts, runs, totals, listStart, todayKey, t]);

  const summary = (e: WellbeingEntry): string => {
    const parts: string[] = [];
    if (isSleepMinutes(e.sleepMinutes)) parts.push(t('wellbeingHub.journal.night', { value: formatMinutes(e.sleepMinutes) }));
    for (const key of ['sleepQuality', 'energy', 'motivation', 'mood', 'stress', 'cravings'] as const) {
      const v = e[key];
      if (isWellbeingLevel(v)) parts.push(`${t(`wellbeing.indicators.${key}`)} ${levelLabel(key, v).toLocaleLowerCase()}`);
    }
    // US BIEN-07 — les réponses des modules restent lisibles même module éteint depuis : ce qui a été
    // noté se relit. Un « non » au café n'est pas affiché (il chargerait chaque ligne pour rien).
    if (isAlcoholDrinks(e.alcoholDrinks)) {
      parts.push(
        e.alcoholDrinks === 0
          ? t('wellbeingHub.journal.alcoholNone')
          : e.alcoholDrinks >= ALCOHOL_DRINKS_MAX
            ? t('wellbeingHub.journal.alcoholMax', { max: ALCOHOL_DRINKS_MAX })
            : t('wellbeingHub.journal.alcohol', { count: e.alcoholDrinks }),
      );
    }
    if (e.lateCaffeine === true) parts.push(t('wellbeingHub.journal.lateCaffeine'));
    if (isNapMinutes(e.napMinutes) && e.napMinutes > 0) parts.push(t('wellbeingHub.journal.nap', { value: formatMinutes(e.napMinutes) }));
    return parts.join(' · ');
  };
  const tags = (e: WellbeingEntry): string[] =>
    (['sick', 'busyDay', 'lateNight', 'travel'] as const).filter((tag) => e[tag]).map((tag) => t(`wellbeing.tags.${tag}`));

  return (
    <View style={styles.stack} testID="wellbeing-journal">
      <View style={styles.chips} accessibilityRole="tablist">
        {METRICS.map((m) => {
          const selected = m === metric;
          return (
            <Pressable
              key={m}
              testID={`journal-metric-${m}`}
              onPress={() => setMetric(m)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.chip, { borderColor: selected ? colors.text : colors.border, backgroundColor: selected ? colors.text : colors.surface }]}
            >
              <Text style={[styles.chipLabel, { color: selected ? colors.background : colors.text }]}>
                {m === 'sleep' ? t('wellbeing.sleepLabel') : t(`wellbeing.indicators.${m}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card>
        <View style={styles.monthRow}>
          <Pressable onPress={() => setMonthOffset((o) => o - 1)} accessibilityRole="button" accessibilityLabel={t('wellbeingHub.journal.previousMonth')} hitSlop={10}>
            <Text style={[styles.arrow, { color: colors.text }]}>‹</Text>
          </Pressable>
          <Text style={[styles.month, { color: colors.text }]}>{monthLabel}</Text>
          <Pressable
            onPress={() => setMonthOffset((o) => Math.min(0, o + 1))}
            disabled={monthOffset === 0}
            accessibilityRole="button"
            accessibilityLabel={t('wellbeingHub.journal.nextMonth')}
            hitSlop={10}
          >
            <Text style={[styles.arrow, { color: monthOffset === 0 ? colors.border : colors.text }]}>›</Text>
          </Pressable>
        </View>
        <View style={styles.grid}>
          {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((d) => (
            <Text key={d} style={[styles.weekday, { color: colors.textMuted }]}>
              {t(`common.weekdayShort.${d}`)}
            </Text>
          ))}
          {cells.map((cell, i) => {
            if (cell === null) return <View key={`e${i}`} style={styles.cell} />;
            const entry = byDay.get(cell.key) ?? null;
            const level = entry === null ? null : levelOf(entry, metric);
            const future = cell.key > todayKey;
            const tagged = entry !== null && tags(entry).length > 0;
            const fill = level === null ? 'transparent' : palette.fill[level - 1];
            const ink = level === null ? colors.textMuted : palette.ink[level - 1];
            return (
              <View
                key={cell.key}
                style={[
                  styles.cell,
                  styles.day,
                  { backgroundColor: fill },
                  level === null && !future && { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
                  cell.key === todayKey && { borderWidth: 2, borderStyle: 'solid', borderColor: colors.text },
                ]}
                accessible
                accessibilityLabel={
                  level === null
                    ? t('wellbeingHub.journal.cellEmpty', { day: formatDayFull(cell.key) })
                    : t('wellbeingHub.journal.cellA11y', {
                        day: formatDayFull(cell.key),
                        value: metric === 'sleep' && entry !== null && isSleepMinutes(entry.sleepMinutes) ? formatMinutes(entry.sleepMinutes) : levelLabel(metric === 'sleep' ? 'energy' : metric, level),
                      })
                }
              >
                <Text style={[styles.dayNumber, { color: ink }]}>{cell.n}</Text>
                {tagged ? <View style={[styles.dot, { backgroundColor: ink }]} /> : null}
              </View>
            );
          })}
        </View>
        <Text style={[styles.muted, { color: colors.textMuted }]}>
          {t(metric === 'sleep' ? 'wellbeingHub.journal.legendSleep' : metric === 'stress' ? 'wellbeingHub.journal.legendStress' : 'wellbeingHub.journal.legend')}
        </Text>
      </Card>

      <Text style={[styles.section, { color: colors.textMuted }]}>{t('wellbeingHub.journal.recent')}</Text>
      <Card>
        {days.map(({ key, entry, did }, index) => {
          const editable = canEditDay(key, todayKey);
          return (
            <View key={key} style={[styles.dayRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]} testID={`journal-day-${key}`}>
              <Text style={[styles.dayTitle, { color: colors.text }]}>{key === todayKey ? t('common.today') : formatDayFull(key)}</Text>
              <Text style={[styles.muted, { color: entry === null ? colors.textMuted : colors.text }]}>
                {entry === null || summary(entry) === '' ? t('wellbeingHub.journal.empty') : summary(entry)}
              </Text>
              {entry !== null && tags(entry).length > 0 ? <Text style={[styles.tagLine, { color: colors.accent }]}>{tags(entry).join(' · ')}</Text> : null}
              {did.length > 0 ? <Text style={[styles.muted, { color: colors.textMuted }]}>{did.join(' · ')}</Text> : null}
              {editable ? (
                <View style={styles.edit}>
                  {(['morning', 'evening'] as const).map((moment) => (
                    <Pressable
                      key={moment}
                      onPress={() => setSheet({ logDate: key, moment, existing: entry })}
                      accessibilityRole="button"
                      accessibilityLabel={t(`wellbeingHub.journal.edit.${moment}A11y`, { day: formatDayFull(key) })}
                      style={[styles.editButton, { borderColor: colors.border }]}
                    >
                      <Text style={[styles.editLabel, { color: colors.text }]}>{t(`wellbeingHub.journal.edit.${moment}`)}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </Card>

      <Pressable onPress={() => router.push('/wellbeing')} accessibilityRole="link" style={styles.linkRow}>
        <Text style={[styles.link, { color: colors.accent }]}>{t('wellbeingHub.journal.curves')}</Text>
      </Pressable>

      <MomentCheckinSheet
        visible={sheet !== null}
        onClose={() => setSheet(null)}
        logDate={sheet?.logDate ?? todayKey}
        moment={sheet?.moment ?? 'morning'}
        existing={sheet?.existing ?? null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  arrow: { fontFamily: fontFamily.bodyBold, fontSize: 24, paddingHorizontal: 10 },
  month: { fontFamily: fontFamily.bodyBold, fontSize: 15, textTransform: 'capitalize' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: fontFamily.bodySemi, fontSize: 11, marginBottom: 4 },
  cell: { width: `${100 / 7}%`, height: 38, padding: 2 },
  day: { borderRadius: 9, paddingTop: 4, paddingLeft: 6 },
  dayNumber: { fontFamily: fontFamily.bodyBold, fontSize: 11 },
  dot: { position: 'absolute', right: 6, bottom: 6, width: 6, height: 6, borderRadius: 3 },
  muted: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 18 },
  section: { fontFamily: fontFamily.bodySemi, fontSize: 13, marginTop: 4 },
  dayRow: { paddingVertical: 10, gap: 3 },
  dayTitle: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  tagLine: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  edit: { flexDirection: 'row', gap: 8, marginTop: 4 },
  editButton: { minHeight: 36, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  editLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  linkRow: { paddingVertical: 8 },
  link: { fontFamily: fontFamily.bodySemi, fontSize: 13.5 },
});
