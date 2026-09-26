/**
 * La carte du moment, en tête de Courir — US CARDIO-UX03, §4.2-1. Remplace la scène `RunStage`.
 *
 * Un état parmi cinq, **dans l'ordre de priorité du code** (R2) : course en cours > séance du jour >
 * sortie finie aujourd'hui > repos > premiers pas (`resolveRunHubState`, puis l'arrivée hors séance
 * du jour, comme la scène).
 *
 * Ce qui change par rapport à la scène :
 *  - la séance du jour montre **la dernière fois** de la même séance (D3) — « Voir le détail », qui
 *    ouvrait le planning, disparaît : la structure complète est déjà dans la carte ;
 *  - après une sortie, le second geste est « Partager » — « Ma semaine », qui ouvrait l'historique,
 *    disparaît : la semaine est juste en dessous (D9) ;
 *  - une course **sans GPS** en cours dit sa durée, pas « 0,00 km » ;
 *  - en premiers pas, l'allure de référence manquante est signalée : sans elle, aucune allure cible.
 */

import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AnimatedNumber, useLocaleSeparators } from '@/components/motion/AnimatedNumber';
import { PressableScale } from '@/components/motion/PressableScale';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export type RunMoment =
  | {
      kind: 'resume';
      typeLabel: string;
      /** `null` pour une course sans GPS : on dit sa durée. */
      distanceLabel: string | null;
      durationLabel: string;
    }
  | {
      kind: 'today';
      typeLabel: string;
      /** « 18:30 », quand la séance a une heure. */
      scheduledTime: string | null;
      countdownLabel: string | null;
      segments: readonly string[];
      volumeLabel: string | null;
      estimatedLabel: string | null;
      paceLabel: string | null;
      instructions: string | null;
    }
  | {
      kind: 'arrival';
      typeLabel: string;
      distanceKm: number;
      distanceUnit: string;
      metaLabel: string;
      validated: boolean;
      inRange: { done: number; total: number } | null;
      predictionLabel: string | null;
    }
  | { kind: 'rest'; doneToday: boolean; nextLabel: string | null }
  | { kind: 'onboarding'; needsRefPace: boolean };

type Props = {
  moment: RunMoment;
  /** « semaine 3 sur 8 », quand le programme a une durée. */
  weekLabel: string | null;
  /** « La dernière fois », séance du jour seulement. */
  lastTime?: ReactNode;
  onResume: () => void;
  onStart: () => void;
  onAnalysis: () => void;
  onShare: () => void;
  onFreeRun: () => void;
  onPlanning: () => void;
  onPrograms: () => void;
  onProfile: () => void;
};

export function RunMomentCard(props: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { groupSeparator, decimalSeparator } = useLocaleSeparators();
  const { moment } = props;

  const eyebrow = [
    t(`runningHub.moment.eyebrow.${moment.kind}`),
    moment.kind === 'today' ? moment.scheduledTime?.slice(0, 5) : null,
    (moment.kind === 'today' || moment.kind === 'rest') && props.weekLabel ? props.weekLabel : null,
  ]
    .filter(Boolean)
    .join(' · ');

  let title: string;
  let meta: string | null = null;
  let body: ReactNode = null;
  let primary: { label: string; onPress: () => void; icon?: 'play' } | null = null;
  let secondary: { label: string; onPress: () => void } | null = null;

  switch (moment.kind) {
    case 'resume': {
      title = moment.typeLabel;
      body = (
        <View style={styles.bigBlock}>
          <Text style={[styles.big, { color: colors.accent }]}>{moment.distanceLabel ?? moment.durationLabel}</Text>
          <Text style={[styles.bigMeta, { color: colors.textMuted }]}>
            {moment.distanceLabel != null
              ? t('stage.running.inProgress', { duration: moment.durationLabel })
              : t('running.start.manualMode')}
          </Text>
        </View>
      );
      primary = { label: t('runningHub.moment.primary.resume'), onPress: props.onResume, icon: 'play' };
      break;
    }
    case 'today': {
      title = moment.typeLabel;
      meta = moment.countdownLabel;
      const stats = [
        moment.volumeLabel ? { label: t('running.hub.volume'), value: moment.volumeLabel } : null,
        moment.estimatedLabel ? { label: t('running.hub.estimated'), value: moment.estimatedLabel } : null,
        moment.paceLabel ? { label: t('running.paceGuidance.targetLabel'), value: moment.paceLabel } : null,
      ].filter((s): s is { label: string; value: string } => s != null);
      body = (
        <View style={styles.todayBody}>
          {moment.segments.length > 0 ? (
            <View style={styles.chips}>
              {moment.segments.map((segment, index) => (
                <View key={`${segment}-${index}`} style={[styles.chip, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.chipText, { color: colors.text }]}>{segment}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {stats.length > 0 ? (
            <View style={styles.stats}>
              {stats.map((stat) => (
                <View key={stat.label} style={styles.stat}>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>{stat.label}</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {moment.instructions ? (
            <Text
              style={[styles.instructions, { color: colors.textMuted, borderLeftColor: colors.accent }]}
              numberOfLines={3}
            >
              {moment.instructions}
            </Text>
          ) : null}
          {props.lastTime}
        </View>
      );
      primary = { label: t('runningHub.moment.primary.today'), onPress: props.onStart, icon: 'play' };
      break;
    }
    case 'arrival': {
      title = moment.typeLabel;
      body = (
        <View style={styles.todayBody}>
          <View style={styles.bigBlock}>
            <View style={styles.bigRow}>
              <AnimatedNumber
                testID="run-arrival-distance"
                value={moment.distanceKm}
                decimals={2}
                groupSeparator={groupSeparator}
                decimalSeparator={decimalSeparator}
                style={[styles.big, { color: colors.accent }]}
              />
              <Text style={[styles.unit, { color: colors.textMuted }]}>{moment.distanceUnit}</Text>
            </View>
            <Text style={[styles.bigMeta, { color: colors.textMuted }]}>{moment.metaLabel}</Text>
          </View>
          {moment.validated ? (
            <View style={[styles.note, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="checkmark" size={16} color={colors.accent} />
              <Text style={[styles.noteText, { color: colors.text }]}>{t('runningHub.moment.validated')}</Text>
            </View>
          ) : null}
          {moment.inRange ? (
            <Text style={[styles.line, { color: colors.text }]}>
              {t('runningHub.moment.inRange', { done: moment.inRange.done, total: moment.inRange.total })}
            </Text>
          ) : null}
          {moment.predictionLabel ? (
            <Text style={[styles.prediction, { color: colors.textMuted }]}>{moment.predictionLabel}</Text>
          ) : null}
        </View>
      );
      primary = { label: t('runningHub.moment.primary.arrival'), onPress: props.onAnalysis };
      secondary = { label: t('runningHub.moment.share'), onPress: props.onShare };
      break;
    }
    case 'rest': {
      title = moment.doneToday ? t('running.hub.doneTodayTitle') : t('running.hub.restTitle');
      meta = moment.nextLabel ?? t('running.hub.nothingPlanned');
      primary = { label: t('runningHub.moment.primary.rest'), onPress: props.onFreeRun };
      secondary = { label: t('runningHub.moment.planning'), onPress: props.onPlanning };
      break;
    }
    default: {
      title = t('running.hub.onboardingTitle');
      meta = t('running.hub.onboardingBody');
      body = moment.needsRefPace ? (
        <View style={[styles.refPace, { backgroundColor: colors.surfaceAlt }]}>
          <View style={styles.refPaceTexts}>
            <Text style={[styles.refPaceTitle, { color: colors.text }]}>{t('runningHub.moment.refPace.title')}</Text>
            <Text style={[styles.refPaceBody, { color: colors.textMuted }]}>{t('runningHub.moment.refPace.body')}</Text>
          </View>
          <PressableScale
            testID="run-moment-ref-pace"
            onPress={props.onProfile}
            accessibilityRole="button"
            style={[styles.refPaceCta, { borderColor: colors.accent }]}
          >
            <Text style={[styles.refPaceCtaLabel, { color: colors.accent }]}>{t('runningHub.moment.refPace.cta')}</Text>
          </PressableScale>
        </View>
      ) : null;
      primary = { label: t('runningHub.moment.primary.onboarding'), onPress: props.onPrograms };
      secondary = { label: t('runningHub.moment.freeRun'), onPress: props.onFreeRun };
    }
  }

  return (
    <View testID={`run-moment-${moment.kind}`} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.eyebrow, { color: colors.accent }]} numberOfLines={1}>
        {eyebrow}
      </Text>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {title}
        </Text>
        {meta ? <Text style={[styles.meta, { color: colors.textMuted }]}>{meta}</Text> : null}
      </View>

      {body}

      <View style={styles.actions}>
        <PressableScale
          testID="run-moment-primary"
          haptic={moment.kind === 'today' || moment.kind === 'resume' ? 'milestone' : 'confirm'}
          onPress={primary.onPress}
          accessibilityRole="button"
          accessibilityLabel={primary.label}
          style={[styles.primary, { backgroundColor: colors.accent }]}
        >
          {primary.icon ? <Ionicons name={primary.icon} size={17} color={colors.accentText} /> : null}
          <Text style={[styles.primaryLabel, { color: colors.accentText }]}>{primary.label}</Text>
        </PressableScale>
        {secondary ? (
          <PressableScale
            testID="run-moment-secondary"
            onPress={secondary.onPress}
            accessibilityRole="button"
            accessibilityLabel={secondary.label}
            style={[styles.secondary, { borderColor: colors.borderStrong }]}
          >
            <Text style={[styles.secondaryLabel, { color: colors.text }]}>{secondary.label}</Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 16, gap: 12 },
  eyebrow: { fontFamily: fontFamily.monoBold, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  heading: { gap: 3 },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 28, lineHeight: 32, letterSpacing: -0.8 },
  meta: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 19 },
  todayBody: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 },
  chipText: { fontFamily: fontFamily.bodyMedium, fontSize: 12.5 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  stat: { gap: 1 },
  statLabel: { fontFamily: fontFamily.bodySemi, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontFamily: fontFamily.monoBold, fontSize: 16 },
  instructions: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, fontStyle: 'italic', borderLeftWidth: 2, paddingLeft: 10 },
  bigBlock: { gap: 2 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  big: { fontFamily: fontFamily.displayXBold, fontSize: 50, lineHeight: 54, letterSpacing: -2 },
  unit: { fontFamily: fontFamily.bodySemi, fontSize: 16 },
  bigMeta: { fontFamily: fontFamily.mono, fontSize: 13 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  noteText: { flex: 1, fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  line: { fontFamily: fontFamily.bodyMedium, fontSize: 13.5 },
  prediction: { fontFamily: fontFamily.mono, fontSize: 12.5 },
  refPace: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 12 },
  refPaceTexts: { flex: 1, gap: 2 },
  refPaceTitle: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  refPaceBody: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  refPaceCta: { minHeight: 44, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1.5, justifyContent: 'center' },
  refPaceCtaLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10 },
  primary: {
    flex: 1,
    minHeight: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryLabel: { fontFamily: fontFamily.bodyBold, fontSize: 17 },
  secondary: { flex: 1, minHeight: 54, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
});
