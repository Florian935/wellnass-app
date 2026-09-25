/**
 * La carte du moment, en tête de S'entraîner — US MUSCU-UX07, §4.2-1.
 *
 * Un état parmi cinq, **dans l'ordre de priorité du code** (R2) : en cours > séance du jour > séance
 * faite aujourd'hui > repos > premiers pas. Une séance libre faite le matin d'un jour de séance
 * prévue laisse donc « Démarrer » à l'écran, comme avant cette US.
 *
 * Ce qui change par rapport à la scène qu'elle remplace (`StrengthStage`) :
 *  - la séance du jour montre **la dernière fois** de ses premiers exercices, et « Voir les N
 *    exercices » ouvre l'aperçu — « Voir le détail », qui ouvrait le planning, disparaît ;
 *  - le choix Classique · Immersif devient une ligne sous Démarrer (D4) ;
 *  - après la séance, le second geste est « Partager » : la semaine est juste en dessous ;
 *  - un jour de repos, le geste est « Voir le planning » : Refaire et Séance libre sont juste en
 *    dessous ;
 *  - plus de silhouette (Q3), plus de ligne « record à portée » (elle vit dans Progrès).
 */

import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { kgToLb, type HubState } from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** La séance terminée aujourd'hui, quand il n'y a plus de séance du jour à faire. */
export type DoneTodayWorkout = {
  id: string;
  name: string | null;
  tonnageKg: number;
  exerciseCount: number;
  recordsBeaten: number;
};

type Props = {
  state: HubState;
  doneToday: DoneTodayWorkout | null;
  /** « semaine 3 sur 8 », quand un programme a une durée. */
  weekLabel: string | null;
  /** Libellé de la prochaine séance, pour la carte de repos. */
  nextLabel: string | null;
  starting: boolean;
  onStart: () => void;
  onResume: () => void;
  onSummary: () => void;
  onShare: () => void;
  onPlanning: () => void;
  onPrograms: () => void;
  onPreview: () => void;
  /** « La dernière fois » (séance du jour seulement). */
  lastTime?: ReactNode;
  /** La ligne de mode (séance du jour seulement). */
  modeLine?: ReactNode;
};

type Kind = 'resume' | 'today' | 'after' | 'rest' | 'onboarding';

export function MomentCard(props: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const { state, doneToday } = props;

  const kind: Kind =
    state.kind === 'resume'
      ? 'resume'
      : state.kind === 'today'
        ? 'today'
        : doneToday
          ? 'after'
          : state.kind;

  const eyebrow = [
    t(`strengthHub.moment.eyebrow.${kind}`),
    (kind === 'today' || kind === 'rest') && props.weekLabel ? props.weekLabel : null,
  ]
    .filter(Boolean)
    .join(' · ');

  let title: string;
  let meta: string | null = null;
  let body: ReactNode = null;
  let primary: { label: string; onPress: () => void; icon?: 'play' } | null = null;
  let secondary: { label: string; onPress: () => void } | null = null;
  let titleSize = 30;

  switch (kind) {
    case 'resume': {
      const w = state.kind === 'resume' ? state.workout : null;
      title = w?.name?.trim() || t('stage.strength.freeSession');
      meta = w ? t('stage.strength.setsProgress', { done: w.doneSets, total: w.totalSets }) : null;
      const ratio = w && w.totalSets > 0 ? w.doneSets / w.totalSets : 0;
      body = (
        <View style={[styles.track, { backgroundColor: colors.track }]}>
          <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: colors.accent }]} />
        </View>
      );
      primary = { label: t('strengthHub.moment.primary.resume'), onPress: props.onResume, icon: 'play' };
      break;
    }
    case 'today': {
      const s = state.kind === 'today' ? state.session : null;
      title = s?.name?.trim() || t('programs.detail.sessionFallback', { index: (s?.orderIndex ?? 0) + 1 });
      meta = s
        ? [
            s.programName,
            t('stage.strength.exercises', { count: s.exerciseCount }),
            s.estimatedMinutes != null ? t('strengthHub.minutesShort', { count: s.estimatedMinutes }) : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : null;
      body = (
        <View style={styles.todayBody}>
          {props.lastTime}
          {s ? (
            <PressableScale
              testID="strength-see-all"
              onPress={props.onPreview}
              accessibilityRole="button"
              style={styles.seeAll}
            >
              <Text style={[styles.seeAllLabel, { color: colors.accent }]}>
                {t('strengthHub.lastTime.seeAll', { count: s.exerciseCount })}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.accent} />
            </PressableScale>
          ) : null}
        </View>
      );
      primary = { label: t('strengthHub.moment.primary.today'), onPress: props.onStart, icon: 'play' };
      break;
    }
    case 'after': {
      const d = doneToday!;
      const value = units.system === 'imperial' ? kgToLb(d.tonnageKg) : d.tonnageKg;
      title = `${new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }).format(value)} ${units.weightSymbol}`;
      titleSize = 38;
      meta = t('stage.strength.afterMeta', {
        name: d.name?.trim() || t('stage.strength.freeSession'),
        exercises: d.exerciseCount,
      });
      body =
        d.recordsBeaten > 0 ? (
          <View style={[styles.record, { backgroundColor: colors.warn }]}>
            <Ionicons name="trophy-outline" size={16} color={colors.warnText} />
            <Text style={[styles.recordText, { color: colors.warnText }]}>
              {t('stage.strength.recordsBeaten', { count: d.recordsBeaten })}
            </Text>
          </View>
        ) : null;
      primary = { label: t('strengthHub.moment.primary.after'), onPress: props.onSummary };
      secondary = { label: t('strengthHub.moment.share'), onPress: props.onShare };
      break;
    }
    case 'rest': {
      const done = state.kind === 'rest' && state.doneToday !== null;
      title = done ? t('strengthHub.rest.doneTitle') : t('strengthHub.rest.title');
      meta = props.nextLabel ?? t('strengthHub.rest.noNext');
      primary = { label: t('strengthHub.moment.primary.rest'), onPress: props.onPlanning };
      break;
    }
    default: {
      title = t('strengthHub.onboarding.title');
      meta = t('strengthHub.onboarding.subtitle');
      titleSize = 24;
      primary = { label: t('strengthHub.moment.primary.onboarding'), onPress: props.onPrograms };
    }
  }

  return (
    <View
      testID={`strength-moment-${kind}`}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={[styles.eyebrow, { color: colors.accent }]} numberOfLines={1}>
        {eyebrow}
      </Text>
      <View style={styles.heading}>
        <Text
          style={[styles.title, { color: colors.text, fontSize: titleSize, lineHeight: Math.round(titleSize * 1.1) }]}
          accessibilityRole="header"
        >
          {title}
        </Text>
        {meta ? <Text style={[styles.meta, { color: colors.textMuted }]}>{meta}</Text> : null}
      </View>

      {body}

      <View style={styles.actions}>
        {primary ? (
          <PressableScale
            testID="strength-moment-primary"
            haptic={kind === 'today' || kind === 'resume' ? 'milestone' : 'confirm'}
            onPress={primary.onPress}
            disabled={props.starting && kind === 'today'}
            accessibilityRole="button"
            accessibilityLabel={primary.label}
            style={[styles.primary, { backgroundColor: colors.accent }]}
          >
            {primary.icon ? <Ionicons name={primary.icon} size={17} color={colors.accentText} /> : null}
            <Text style={[styles.primaryLabel, { color: colors.accentText }]}>{primary.label}</Text>
          </PressableScale>
        ) : null}
        {secondary ? (
          <PressableScale
            testID="strength-moment-secondary"
            onPress={secondary.onPress}
            accessibilityRole="button"
            accessibilityLabel={secondary.label}
            style={[styles.secondary, { borderColor: colors.borderStrong }]}
          >
            <Text style={[styles.secondaryLabel, { color: colors.text }]}>{secondary.label}</Text>
          </PressableScale>
        ) : null}
      </View>

      {kind === 'today' ? props.modeLine : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 16, gap: 12 },
  eyebrow: { fontFamily: fontFamily.monoBold, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  heading: { gap: 3 },
  title: { fontFamily: fontFamily.displayXBold, letterSpacing: -0.8 },
  meta: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 19 },
  todayBody: { gap: 2 },
  seeAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 44 },
  seeAllLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  record: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  recordText: { flex: 1, fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
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
