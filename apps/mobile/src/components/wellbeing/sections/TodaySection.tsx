/**
 * US BIEN-02 / BIEN-04 — Bien-être › Aujourd'hui.
 *
 * Ce que l'onglet dit, dans l'ordre (planche « Aujourd'hui », validée le 01/10/2026) :
 *  1. le garde-fou « humeur basse », s'il y a lieu (D7) ;
 *  2. les deux check-ins du jour, le moment de l'heure en tête (D4) ;
 *  3. **ce que l'état change aujourd'hui** à la séance prévue et à l'assiette (la boucle) ;
 *  4. les nuits de la semaine ;
 *  5. les suivis qui vivaient ailleurs : douleurs, cycle, pas, poids, eau.
 *
 * Rien n'est automatique : alléger ou décaler passe par la feuille « ce qui change dans ton plan » du
 * Labo, qui nomme le changement avant de l'écrire.
 */

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  REPS_REDUCTION_PCT,
  addDays,
  canEditDay,
  hasEveningCheckin,
  hasMorningCheckin,
  isSleepMinutes,
  localDateFromDayKey,
  localDayKey,
  startOfWeek,
  suggestCheckinMoment,
  type CheckinMoment,
  type SessionAdvice,
} from '@wellness/shared';

import { Card } from '@/components/Card';
import { LabApplySheet, type LabChangeItem } from '@/components/lab/LabApplySheet';
import { formatMinutes } from '@/components/lab/lab-format';
import { LowMoodCard } from '@/components/wellbeing/LowMoodCard';
import { MomentCheckinSheet } from '@/components/wellbeing/MomentCheckinSheet';
import { useWellbeingForDay, useWellbeingRows, type WellbeingEntry } from '@/data/repositories/daily-wellbeing-repository';
import { applyAdaptationForToday, reschedulePlannedSession } from '@/data/repositories/planned-session-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { useWellbeingDay, useWellbeingPillar } from '@/data/repositories/wellbeing-pillar-repository';
import { useCurrentHour, useTodayKey, useWindowStartKey } from '@/hooks/useTodayKey';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const shiftDay = (dayKey: string, n: number) => localDayKey(addDays(localDateFromDayKey(dayKey), n));

type Sheet = { logDate: string; moment: CheckinMoment; existing: WellbeingEntry | null } | null;

export function TodaySection() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const todayKey = useTodayKey();
  const yesterdayKey = shiftDay(todayKey, -1);
  const hour = useCurrentHour();
  const pillar = useWellbeingPillar();
  const { settings } = useSettings();
  const { entry: today } = useWellbeingForDay(todayKey);
  const { entry: yesterday } = useWellbeingForDay(yesterdayKey);
  const { day } = useWellbeingDay();
  const recentKey = useWindowStartKey(14);
  const { rows } = useWellbeingRows(recentKey);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [apply, setApply] = useState<SessionAdvice | null>(null);
  const [busy, setBusy] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Record<string, true>>({});

  const suggested = suggestCheckinMoment(hour, today);
  const morningDone = hasMorningCheckin(today);
  const eveningDone = hasEveningCheckin(today);
  // Le soir de la veille manque ? Le matin le rattrape en un geste (D4).
  const yesterdayEveningMissing = !hasEveningCheckin(yesterday) && canEditDay(yesterdayKey, todayKey);

  const open = (moment: CheckinMoment, logDate = todayKey, existing: WellbeingEntry | null = today) => setSheet({ logDate, moment, existing });

  // Les nuits de la semaine (lundi → dimanche), un trou n'est jamais un zéro.
  const weekStart = localDayKey(startOfWeek(localDateFromDayKey(todayKey)));
  const nights = useMemo(() => {
    const byDay = new Map(rows.map((r) => [r.logDate, r.sleepMinutes]));
    return Array.from({ length: 7 }, (_, i) => {
      const key = shiftDay(weekStart, i);
      const minutes = byDay.get(key);
      return { key, minutes: isSleepMinutes(minutes) ? minutes : null, future: key > todayKey, isToday: key === todayKey };
    });
  }, [rows, weekStart, todayKey]);
  const known = nights.filter((n) => n.minutes !== null);
  const average = known.length > 0 ? Math.round(known.reduce((s, n) => s + (n.minutes as number), 0) / known.length) : null;

  const tomorrowKey = shiftDay(todayKey, 1);
  const confirmApply = async () => {
    if (apply === null) return;
    setBusy(true);
    setApplyError(null);
    try {
      if (apply.kind === 'postpone') await reschedulePlannedSession(apply.sessionId, tomorrowKey);
      else await applyAdaptationForToday(apply.sessionId, { repsReductionPct: REPS_REDUCTION_PCT, paceSlowdownSPerKm: null });
      setApplied((prev) => ({ ...prev, [apply.sessionId]: true }));
      setApply(null);
    } catch {
      setApplyError(t('wellbeingHub.today.applyError'));
    } finally {
      setBusy(false);
    }
  };

  const sessionLabel = (a: SessionAdvice) => a.name ?? t(`wellbeingHub.today.pillarSession.${a.pillar === 'running' ? 'running' : 'strength'}`);
  const applyItems: LabChangeItem[] =
    apply === null
      ? []
      : [
          {
            id: apply.sessionId,
            pillar: apply.pillar,
            title: sessionLabel(apply),
            detail:
              apply.kind === 'postpone'
                ? t('wellbeingHub.today.apply.postponeDetail')
                : t('wellbeingHub.today.apply.lightenDetail', { pct: REPS_REDUCTION_PCT }),
            where: t(`wellbeingHub.today.apply.where.${apply.pillar === 'running' ? 'running' : 'strength'}`),
          },
        ];

  return (
    <View style={styles.stack} testID="wellbeing-today">
      <LowMoodCard rows={rows} todayKey={todayKey} />

      {/* Les deux check-ins du jour */}
      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('wellbeingHub.today.checkinsTitle')}</Text>
        {(['morning', 'evening'] as const).map((moment) => {
          const done = moment === 'morning' ? morningDone : eveningDone;
          const primary = moment === suggested && !done;
          return (
            <Pressable
              key={moment}
              testID={`wellbeing-checkin-${moment}`}
              onPress={() => open(moment)}
              accessibilityRole="button"
              accessibilityLabel={t(`wellbeingHub.today.${moment}.a11y`, { state: t(done ? 'wellbeingHub.today.done' : 'wellbeingHub.today.todo') })}
              style={[
                styles.moment,
                { borderColor: primary ? colors.accent : colors.border, backgroundColor: primary ? colors.track : 'transparent' },
              ]}
            >
              <View style={styles.grow}>
                <Text style={[styles.momentTitle, { color: colors.text }]}>{t(`wellbeingHub.today.${moment}.title`)}</Text>
                <Text style={[styles.muted, { color: colors.textMuted }]}>{t(`wellbeingHub.today.${moment}.hint`)}</Text>
              </View>
              <Text style={[styles.state, { color: done ? colors.success : primary ? colors.accent : colors.textMuted }]}>
                {t(done ? 'wellbeingHub.today.done' : primary ? 'wellbeingHub.today.now' : 'wellbeingHub.today.todo')}
              </Text>
            </Pressable>
          );
        })}
      </Card>

      {/* La boucle : ce que l'état change aujourd'hui */}
      {day !== null && (day.advice.length > 0 || day.nutritionNote !== null) ? (
        <Card>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('wellbeingHub.today.changesTitle')}</Text>
          {day.advice.map((a) => {
            const done = applied[a.sessionId] === true;
            return (
              <View key={a.sessionId} style={[styles.advice, { borderTopColor: colors.border }]} testID={`wellbeing-advice-${a.sessionId}`}>
                <Text style={[styles.adviceSession, { color: colors.text }]}>{sessionLabel(a)}</Text>
                <Text style={[styles.adviceText, { color: colors.text }]}>
                  {t(`wellbeingHub.today.advice.${a.kind}.${a.pillar === 'running' ? 'running' : 'strength'}`, { pct: REPS_REDUCTION_PCT })}
                </Text>
                {a.adapted ? <Text style={[styles.muted, { color: colors.textMuted }]}>{t('wellbeingHub.today.alreadyAdapted')}</Text> : null}
                {done ? (
                  <Text style={[styles.muted, { color: colors.success }]}>{t('wellbeingHub.today.applied')}</Text>
                ) : (
                  <View style={styles.actions}>
                    {(a.kind === 'postpone' || a.canWriteLighten) && !a.adapted ? (
                      <Pressable
                        testID={`wellbeing-apply-${a.sessionId}`}
                        onPress={() => setApply(a)}
                        accessibilityRole="button"
                        style={[styles.action, { backgroundColor: colors.accent }]}
                      >
                        <Text style={[styles.actionLabel, { color: colors.accentText }]}>
                          {t(a.kind === 'postpone' ? 'wellbeingHub.today.postpone' : 'wellbeingHub.today.lighten')}
                        </Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => router.push(a.pillar === 'running' ? '/running?section=run' : '/strength')}
                      accessibilityRole="link"
                      style={[styles.action, styles.ghost, { borderColor: colors.border }]}
                    >
                      <Text style={[styles.actionLabel, { color: colors.text }]}>{t('wellbeingHub.today.seeSession')}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
          {day.nutritionNote !== null ? (
            <View style={[styles.advice, { borderTopColor: colors.border }]} testID="wellbeing-nutrition-note">
              <Text style={[styles.adviceSession, { color: colors.text }]}>{t('pillars.nutrition')}</Text>
              <Text style={[styles.adviceText, { color: colors.text }]}>{t(`wellbeingHub.today.nutrition.${day.nutritionNote}`)}</Text>
            </View>
          ) : null}
          <Text style={[styles.muted, { color: colors.textMuted }]}>{t('wellbeingHub.today.advisory')}</Text>
        </Card>
      ) : null}

      {/* Les nuits de la semaine */}
      <Card>
        <View style={styles.rowBetween}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('wellbeingHub.today.nightsTitle')}</Text>
          {average !== null ? (
            <Text style={[styles.muted, { color: colors.textMuted }]}>
              {t('wellbeingHub.today.nightsAverage', { value: formatMinutes(average), count: known.length })}
            </Text>
          ) : null}
        </View>
        <View style={styles.bars} accessible accessibilityLabel={t('wellbeingHub.today.nightsA11y', { count: known.length })}>
          {nights.map((n, i) => {
            const height = n.minutes === null ? 6 : Math.max(8, Math.round((n.minutes / 540) * 60));
            return (
              <View key={n.key} style={styles.barCol}>
                <View
                  style={[
                    styles.bar,
                    n.minutes === null
                      ? { height, borderWidth: 1, borderStyle: 'dashed', borderColor: n.future ? 'transparent' : colors.border }
                      : { height, backgroundColor: n.minutes < 360 ? colors.track : colors.pillarWellbeing },
                    n.isToday && { borderWidth: 2, borderColor: colors.text },
                  ]}
                />
                <Text style={[styles.barLabel, { color: n.isToday ? colors.text : colors.textMuted }]}>
                  {t(`common.weekdayShort.${WEEKDAYS[i]}`)}
                </Text>
              </View>
            );
          })}
        </View>
        {!pillar.sleepFromHealthConnect ? (
          <Pressable onPress={() => router.push('/wellbeing-settings')} accessibilityRole="link">
            <Text style={[styles.link, { color: colors.accent }]}>{t('wellbeingHub.today.nightsHealthConnect')}</Text>
          </Pressable>
        ) : null}
      </Card>

      {/* Les suivis qui avaient chacun leur écran (le pilier les rassemble, D1) */}
      <View style={styles.followUps}>
        {settings?.painJournalEnabled === true ? (
          <FollowUp label={t('wellbeingHub.today.followUps.pain')} onPress={() => router.push('/pain')} />
        ) : null}
        {settings?.cycleTrackingEnabled === true ? (
          <FollowUp label={t('wellbeingHub.today.followUps.cycle')} onPress={() => router.push('/cycle')} />
        ) : null}
        <FollowUp label={t('wellbeingHub.today.followUps.steps')} onPress={() => router.push('/steps')} />
        <FollowUp label={t('wellbeingHub.today.followUps.weight')} onPress={() => router.push('/nutrition-stats?tab=weight')} />
        {pillar.activePillars.includes('nutrition') ? (
          <FollowUp label={t('wellbeingHub.today.followUps.water')} onPress={() => router.push('/nutrition?section=today')} />
        ) : null}
      </View>

      <MomentCheckinSheet
        visible={sheet !== null}
        onClose={() => setSheet(null)}
        logDate={sheet?.logDate ?? todayKey}
        moment={sheet?.moment ?? suggested}
        existing={sheet?.existing ?? null}
        onCatchUpYesterday={
          sheet?.moment === 'morning' && sheet.logDate === todayKey && yesterdayEveningMissing
            ? () => open('evening', yesterdayKey, yesterday)
            : undefined
        }
      />
      <LabApplySheet
        visible={apply !== null}
        title={t('wellbeingHub.today.apply.title')}
        subtitle={t('wellbeingHub.today.apply.subtitle')}
        items={applyItems}
        confirmLabel={t('wellbeingHub.today.apply.confirm')}
        busy={busy}
        error={applyError}
        onConfirm={() => void confirmApply()}
        onClose={() => {
          setApply(null);
          setApplyError(null);
        }}
      />
    </View>
  );
}

function FollowUp({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={[styles.followUp, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[styles.followUpLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  cardTitle: { fontFamily: fontFamily.bodyBold, fontSize: 15.5, marginBottom: 8 },
  moment: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 8, minHeight: 56 },
  momentTitle: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  state: { fontFamily: fontFamily.bodyBold, fontSize: 12.5 },
  grow: { flex: 1, minWidth: 0 },
  muted: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 18 },
  advice: { borderTopWidth: 1, paddingTop: 10, marginTop: 10, gap: 6 },
  adviceSession: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  adviceText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  action: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ghost: { borderWidth: 1.5, backgroundColor: 'transparent' },
  actionLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  rowBetween: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 84, marginTop: 4 },
  barCol: { alignItems: 'center', justifyContent: 'flex-end', gap: 4, flex: 1 },
  bar: { width: 18, borderRadius: 5 },
  barLabel: { fontFamily: fontFamily.bodySemi, fontSize: 11 },
  link: { fontFamily: fontFamily.bodySemi, fontSize: 13, marginTop: 10 },
  followUps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  followUp: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  followUpLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});
