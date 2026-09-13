/**
 * US DASH-01 — la scène du pilier Course : « le flux » (spec §4.3).
 *
 * Elle garde les **quatre états** de `resolveRunHubState` (reprendre / séance du jour / repos /
 * démarrage) et leur en ajoute un cinquième, propre à la scène : **l'arrivée** — une sortie
 * terminée aujourd'hui. C'est le seul moment où le pilier a quelque chose à célébrer, et l'ancien
 * hub le traitait comme un jour de repos ordinaire.
 *
 * La matière est une trace parcourue sans fin (`FlowTrace`) : elle ne tourne que si l'onglet a le
 * focus, l'app est au premier plan et le mouvement est permis (R4).
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SessionCountdown } from '@wellness/shared';
import { AnimatedNumber, useLocaleSeparators } from '@/components/motion/AnimatedNumber';
import { PillarStage, useStageTheme } from '@/components/stage/PillarStage';
import { StageButton } from '@/components/stage/StageButton';
import { StageIconButton } from '@/components/stage/StageIconButton';
import { FlowTrace } from '@/components/stage/matter/FlowTrace';
import { useLoopActive } from '@/hooks/useLoopActive';
import { fontFamily } from '@/theme/fonts';

/** Hauteur de la trace : la scène de course est la plus haute des quatre, c'est son sujet. */
const TRACE_HEIGHT = 360;

export type RunScene =
  /** Une course est en cours (GPS ou manuelle) : rien d'autre ne compte. */
  | { kind: 'resume'; distanceLabel: string; durationLabel: string }
  /** Une sortie a été terminée aujourd'hui — le moment d'arrivée. */
  | {
      kind: 'arrival';
      distanceKm: number;
      distanceUnit: string;
      paceLabel: string;
      durationLabel: string;
      /**
       * Chrono 10 km estimé **après** cette sortie, déjà formaté — `null` tant qu'aucun record de
       * 5 km n'existe (la formule de Riegel n'a alors rien pour partir).
       */
      prediction10kLabel: string | null;
      /**
       * Cette sortie a-t-elle **établi** le record de 5 km qui porte l'estimation ?
       *
       * C'est la seule chose qu'on sache dire honnêtement : l'app ne garde pas l'historique des
       * records, donc l'écart avec l'estimation d'hier n'est pas calculable — et un écart inventé
       * serait pire qu'une absence (R1, R7).
       */
      prediction10kIsNew: boolean;
    }
  /** Une séance est prévue aujourd'hui. */
  | {
      kind: 'today';
      typeLabel: string;
      segments: readonly string[];
      volumeLabel: string | null;
      estimatedMinutes: number | null;
      paceLabel: string | null;
      scheduledTime: string | null;
      countdown: SessionCountdown | null;
      instructions: string | null;
    }
  /** Programme en cours, mais rien à faire aujourd'hui (ou déjà fait). */
  | {
      kind: 'rest';
      doneToday: boolean;
      nextLabel: string | null;
    }
  /** Pas encore de programme : le pilier se présente. */
  | { kind: 'onboarding' };

type Props = {
  scene: RunScene;
  weekDistanceLabel: string;
  weekSessionsLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  onProfile: () => void;
  onHistory: () => void;
};

export function RunStage({
  scene,
  weekDistanceLabel,
  weekSessionsLabel,
  onPrimary,
  onSecondary,
  onProfile,
  onHistory,
}: Props) {
  const { t } = useTranslation();
  const stage = useStageTheme('running');
  const active = useLoopActive('running');

  return (
    <PillarStage
      pillar="running"
      testID="run-stage"
      matter={<FlowTrace active={active} color={stage.accent} width={430} height={TRACE_HEIGHT} />}
    >
      <View style={styles.topRow}>
        <Text style={[styles.eyebrow, { color: stage.inkMuted }]} numberOfLines={1}>
          {t(`stage.running.eyebrow.${scene.kind}`)}
        </Text>
        <View style={styles.icons}>
          <StageIconButton icon="time-outline" label={t('running.history.title')} onPress={onHistory} color={stage.ink} />
          <StageIconButton icon="person-outline" label={t('running.profile.title')} onPress={onProfile} color={stage.ink} />
        </View>
      </View>

      {scene.kind === 'arrival' ? (
        <ArrivalScene scene={scene} inkMuted={stage.inkMuted} ink={stage.ink} />
      ) : scene.kind === 'resume' ? (
        <View style={styles.block}>
          <Text style={[styles.title, { color: stage.ink }]}>{scene.distanceLabel}</Text>
          <Text style={[styles.sub, { color: stage.inkMuted }]}>
            {t('stage.running.inProgress', { duration: scene.durationLabel })}
          </Text>
        </View>
      ) : scene.kind === 'today' ? (
        <TodayScene scene={scene} ink={stage.ink} inkMuted={stage.inkMuted} glass={stage.glass} glassBorder={stage.glassBorder} />
      ) : scene.kind === 'rest' ? (
        <View style={styles.block}>
          <Text style={[styles.title, { color: stage.ink }]}>
            {scene.doneToday ? t('running.hub.doneTodayTitle') : t('running.hub.restTitle')}
          </Text>
          <Text style={[styles.sub, { color: stage.inkMuted }]}>
            {scene.nextLabel ?? t('running.hub.nothingPlanned')}
          </Text>
        </View>
      ) : (
        <View style={styles.block}>
          <Text style={[styles.title, { color: stage.ink }]}>{t('running.hub.onboardingTitle')}</Text>
          <Text style={[styles.sub, { color: stage.inkMuted }]}>{t('running.hub.onboardingBody')}</Text>
        </View>
      )}

      {/* La semaine, en une ligne : elle est détaillée plus bas, ici c'est un repère, pas un tableau. */}
      <View style={styles.weekRow}>
        <Ionicons name="pulse-outline" size={14} color={stage.inkMuted} />
        <Text style={[styles.weekText, { color: stage.inkMuted }]} numberOfLines={1}>
          {t('stage.running.weekLine', { distance: weekDistanceLabel, sessions: weekSessionsLabel })}
        </Text>
      </View>

      <View style={styles.ctaRow}>
        <StageButton
          pillar="running"
          icon={PRIMARY_ICON[scene.kind]}
          label={t(`stage.running.primary.${scene.kind}`)}
          onPress={onPrimary}
          haptic={scene.kind === 'today' || scene.kind === 'resume' ? 'milestone' : 'confirm'}
          style={styles.flex}
        />
        <StageButton
          pillar="running"
          variant="glass"
          label={t(`stage.running.secondary.${scene.kind}`)}
          onPress={onSecondary}
          style={styles.flex}
        />
      </View>
    </PillarStage>
  );
}

const PRIMARY_ICON: Record<RunScene['kind'], keyof typeof Ionicons.glyphMap> = {
  resume: 'play',
  arrival: 'analytics-outline',
  today: 'play',
  rest: 'walk-outline',
  onboarding: 'flag-outline',
};

/** L'arrivée : la distance roule, l'allure et l'écart de prédiction la commentent. */
function ArrivalScene({
  scene,
  ink,
  inkMuted,
}: {
  scene: Extract<RunScene, { kind: 'arrival' }>;
  ink: string;
  inkMuted: string;
}) {
  const { t } = useTranslation();
  const { groupSeparator, decimalSeparator } = useLocaleSeparators();

  return (
    <View style={styles.block}>
      <View style={styles.bigRow}>
        <AnimatedNumber
          testID="run-arrival-distance"
          value={scene.distanceKm}
          decimals={2}
          groupSeparator={groupSeparator}
          decimalSeparator={decimalSeparator}
          style={[styles.big, { color: ink }]}
          accessibilityLabel={t('stage.running.arrivalA11y', {
            distance: scene.distanceKm.toFixed(2),
            unit: scene.distanceUnit,
            pace: scene.paceLabel,
          })}
        />
        <Text style={[styles.unit, { color: inkMuted }]}>{scene.distanceUnit}</Text>
      </View>
      <Text style={[styles.sub, { color: inkMuted }]}>
        {t('stage.running.arrivalMeta', { duration: scene.durationLabel, pace: scene.paceLabel })}
      </Text>
      {/* Ce que cette sortie change pour la suite — la projection, pas le bilan. */}
      {scene.prediction10kLabel ? (
        <Text style={[styles.prediction, { color: ink }]}>
          {t(scene.prediction10kIsNew ? 'stage.running.predictionNew' : 'stage.running.prediction', {
            time: scene.prediction10kLabel,
          })}
        </Text>
      ) : null}
    </View>
  );
}

/** La séance du jour : son type, sa structure, son volume — et l'heure, quand elle en a une. */
function TodayScene({
  scene,
  ink,
  inkMuted,
  glass,
  glassBorder,
}: {
  scene: Extract<RunScene, { kind: 'today' }>;
  ink: string;
  inkMuted: string;
  glass: string;
  glassBorder: string;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.block}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: ink }]} numberOfLines={2}>
          {scene.typeLabel}
        </Text>
        {scene.scheduledTime ? (
          <View style={[styles.timeChip, { backgroundColor: glass, borderColor: glassBorder }]}>
            <Ionicons name="alarm-outline" size={13} color={ink} />
            <Text style={[styles.timeChipText, { color: ink }]}>{scene.scheduledTime.slice(0, 5)}</Text>
          </View>
        ) : null}
      </View>

      {scene.countdown ? (
        <Text style={[styles.countdown, { color: inkMuted }]}>
          {scene.countdown.kind === 'now'
            ? t('stage.running.countdownNow')
            : scene.countdown.kind === 'in'
              ? t('stage.running.countdownIn', { count: scene.countdown.hours })
              : t('stage.running.countdownPast', { count: scene.countdown.hours })}
        </Text>
      ) : null}

      {scene.segments.length > 0 ? (
        <View style={styles.chips}>
          {scene.segments.map((segment, index) => (
            <View
              key={`${segment}-${index}`}
              style={[styles.chip, { backgroundColor: glass, borderColor: glassBorder }]}
            >
              <Text style={[styles.chipText, { color: ink }]}>{segment}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.stats}>
        {scene.volumeLabel ? (
          <Stat label={t('running.hub.volume')} value={scene.volumeLabel} ink={ink} inkMuted={inkMuted} />
        ) : null}
        {scene.estimatedMinutes != null ? (
          <Stat
            label={t('running.hub.estimated')}
            value={t('running.hub.minutes', { count: scene.estimatedMinutes })}
            ink={ink}
            inkMuted={inkMuted}
          />
        ) : null}
        {scene.paceLabel ? (
          <Stat label={t('running.paceGuidance.targetLabel')} value={scene.paceLabel} ink={ink} inkMuted={inkMuted} />
        ) : null}
      </View>

      {scene.instructions ? (
        <Text style={[styles.instructions, { color: inkMuted, borderLeftColor: ink }]} numberOfLines={3}>
          {scene.instructions}
        </Text>
      ) : null}
    </View>
  );
}

function Stat({ label, value, ink, inkMuted }: { label: string; value: string; ink: string; inkMuted: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: inkMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: ink }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  eyebrow: {
    fontFamily: fontFamily.monoBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  block: { gap: 8, marginTop: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 30, letterSpacing: -1, flexShrink: 1 },
  sub: { fontFamily: fontFamily.bodyMedium, fontSize: 14, lineHeight: 20 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  big: { fontFamily: fontFamily.displayXBold, fontSize: 62, letterSpacing: -2.8, lineHeight: 66 },
  unit: { fontFamily: fontFamily.bodySemi, fontSize: 16 },
  prediction: { fontFamily: fontFamily.displayBold, fontSize: 15, letterSpacing: -0.3 },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  timeChipText: { fontFamily: fontFamily.monoBold, fontSize: 13 },
  countdown: { fontFamily: fontFamily.bodySemi, fontSize: 13.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 9, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5 },
  chipText: { fontFamily: fontFamily.bodyMedium, fontSize: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  stat: { gap: 1 },
  statLabel: { fontFamily: fontFamily.bodySemi, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontFamily: fontFamily.monoBold, fontSize: 17 },
  instructions: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
    borderLeftWidth: 2,
    paddingLeft: 10,
  },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14 },
  weekText: { fontFamily: fontFamily.bodyMedium, fontSize: 12.5, flexShrink: 1 },
  ctaRow: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
