/**
 * US ACCUEIL-08 — **ce que porte le ciel**, sous la salutation et la phrase du jour.
 *
 *  - `ListenBriefButton` — « Écouter mon brief », le matin : le brief existant (`buildMorningBrief`)
 *    lu à voix haute. Il remplace la carte du brief, qui redisait la scène (constat 8).
 *  - `LiveBanner` — une séance ou une course tourne : « Reprendre », au-dessus des cadrans.
 *  - `ComebackCard` — le retour après une absence : « En douceur » ou « Mon plan normal » (VIE-02
 *    réglé par ACCUEIL-07 : rien ne mène à une route morte).
 *  - `FirstStepsCard` — le tout premier jour : le parcours des sept jours, à la place des cadrans.
 *
 * Tout est posé sur la scène Aurore : encres et verre de `useStageTheme('home')`, mesurés par
 * `__tests__/stage.test.ts`.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import { useTranslation } from 'react-i18next';
import { buildMorningBrief, type BriefFacts } from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import { StageButton } from '@/components/stage/StageButton';
import { useStageTheme } from '@/components/stage/PillarStage';
import { fontFamily } from '@/theme/fonts';

/** Le brief du matin, à la demande. La voix s'arrête avec l'écran qui l'a lancée. */
export function ListenBriefButton({
  facts,
  lead,
  speechLanguage,
}: {
  facts: BriefFacts;
  /** La salutation et la phrase du jour, lues en tête du brief. */
  lead: readonly string[];
  speechLanguage: string;
}) {
  const { t } = useTranslation();
  const stage = useStageTheme('home');
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => void Speech.stop(), []);

  const sentences = [...lead, ...buildMorningBrief(facts).map((s) => t(s.key, s.params))];

  const toggle = () => {
    if (speaking) {
      void Speech.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    sentences.forEach((sentence, index) => {
      Speech.speak(sentence, {
        language: speechLanguage,
        onDone: () => {
          if (index === sentences.length - 1) setSpeaking(false);
        },
        onStopped: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    });
  };

  return (
    <PressableScale
      haptic="confirm"
      onPress={toggle}
      accessibilityRole="button"
      accessibilityState={{ selected: speaking }}
      accessibilityLabel={t(speaking ? 'home.sky.listenStopA11y' : 'home.sky.listenA11y')}
      testID="home-listen-brief"
      style={[styles.listen, { backgroundColor: stage.glass, borderColor: stage.glassBorder }]}
    >
      <Ionicons name={speaking ? 'stop' : 'volume-medium-outline'} size={16} color={stage.ink} />
      <Text style={[styles.listenLabel, { color: stage.ink }]}>
        {t(speaking ? 'brief.stop' : 'home.sky.listen')}
      </Text>
    </PressableScale>
  );
}

/** Une séance (rouge fonte) ou une course (bleu) tourne : on y revient d'un geste. */
export function LiveBanner({
  pillar,
  title,
  onResume,
}: {
  pillar: 'strength' | 'running';
  title: string;
  onResume: () => void;
}) {
  const { t } = useTranslation();
  const strength = pillar === 'strength';
  const bg = strength ? '#8e1b1b' : '#1d4586';
  return (
    <View style={[styles.live, { backgroundColor: bg }]} testID="home-live-banner">
      <View style={styles.liveHead}>
        <View style={[styles.liveDot, { backgroundColor: strength ? '#ff9a8f' : '#b7d6ff' }]} />
        <Text style={[styles.liveEyebrow, { color: strength ? '#f6c5bf' : '#d6e6fa' }]}>
          {t(strength ? 'home.sky.liveWorkout' : 'home.sky.liveRun')}
        </Text>
      </View>
      <Text style={styles.liveTitle} numberOfLines={1}>
        {title}
      </Text>
      <PressableScale
        haptic="confirm"
        onPress={onResume}
        accessibilityRole="button"
        accessibilityLabel={t(strength ? 'home.now.workoutActive.cta' : 'home.now.runActive.cta')}
        style={styles.liveCta}
      >
        <Ionicons name="play" size={16} color={bg} />
        <Text style={[styles.liveCtaLabel, { color: bg }]}>
          {t(strength ? 'home.now.workoutActive.cta' : 'home.now.runActive.cta')}
        </Text>
      </PressableScale>
    </View>
  );
}

export type ComebackProps = {
  days: number;
  bestStreak: number;
  /** La période « vie réelle » démarrée par « En douceur » court jusqu'à cette date (affichée). */
  gentleUntil: string | null;
  normalChosen: boolean;
  onGentle: () => void;
  onNormal: () => void;
};

/** Le retour : on accueille, on ne réclame pas. */
export function ComebackCard({ days, bestStreak, gentleUntil, normalChosen, onGentle, onNormal }: ComebackProps) {
  const { t } = useTranslation();
  const stage = useStageTheme('home');
  return (
    <View
      style={[styles.panel, { backgroundColor: stage.glass, borderColor: stage.glassBorder }]}
      testID="home-comeback"
    >
      <Text style={[styles.mono, { color: stage.ink }]}>{t('stage.home.comebackLine', { count: days })}</Text>
      <Text style={[styles.body, { color: stage.ink }]}>{t('stage.home.comebackBody')}</Text>
      {bestStreak > 0 ? (
        <Text style={[styles.body, { color: stage.ink }]}>{t('stage.home.bestStreak', { count: bestStreak })}</Text>
      ) : null}
      {gentleUntil ? (
        <Text style={[styles.confirm, { color: stage.ink }]} accessibilityLiveRegion="polite">
          {t('stage.home.gentleDone', { date: gentleUntil })}
        </Text>
      ) : normalChosen ? (
        <Text style={[styles.confirm, { color: stage.ink }]} accessibilityLiveRegion="polite">
          {t('stage.home.normalDone')}
        </Text>
      ) : (
        <View style={styles.ctaRow}>
          <StageButton
            pillar="home"
            icon="leaf-outline"
            label={t('stage.home.gentleRestart')}
            onPress={onGentle}
            style={styles.flex}
            testID="home-gentle-restart"
          />
          <StageButton
            pillar="home"
            variant="glass"
            label={t('stage.home.normalPlan')}
            onPress={onNormal}
            style={styles.flex}
            testID="home-normal-plan"
          />
        </View>
      )}
    </View>
  );
}

/** Le tout premier jour : le parcours des sept jours, et le geste du jour. */
export function FirstStepsCard({
  title,
  description,
  ctaLabel,
  onCta,
}: {
  title: string;
  description: string;
  ctaLabel: string | null;
  onCta: (() => void) | null;
}) {
  const { t } = useTranslation();
  const stage = useStageTheme('home');
  return (
    <View
      style={[styles.panel, { backgroundColor: stage.glass, borderColor: stage.glassBorder }]}
      testID="home-first-steps"
    >
      <View style={styles.firstHead}>
        <Text style={[styles.mono, { color: stage.ink }]}>{t('home.sky.firstSteps', { day: 1, total: 7 })}</Text>
        <Text style={[styles.firstCount, { color: stage.ink }]}>1/7</Text>
      </View>
      <View style={styles.segments}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <View
            key={i}
            style={[styles.segment, { backgroundColor: i === 0 ? stage.accent : 'rgba(255,255,255,0.18)' }]}
          />
        ))}
      </View>
      <Text style={[styles.firstTitle, { color: stage.ink }]}>{title}</Text>
      <Text style={[styles.body, { color: stage.ink }]}>{description}</Text>
      {ctaLabel && onCta ? <StageButton pillar="home" label={ctaLabel} onPress={onCta} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  listen: {
    alignSelf: 'flex-start',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  listenLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  live: { borderRadius: 24, padding: 16, gap: 10 },
  liveHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 9, height: 9, borderRadius: 5 },
  liveEyebrow: { fontFamily: fontFamily.monoBold, fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase' },
  liveTitle: { fontFamily: fontFamily.displayXBold, fontSize: 26, letterSpacing: -0.8, color: '#ffffff' },
  liveCta: {
    height: 50,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  liveCtaLabel: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  panel: { borderRadius: 24, borderWidth: 1, padding: 16, gap: 10 },
  mono: { fontFamily: fontFamily.monoBold, fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase' },
  body: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  confirm: { fontFamily: fontFamily.bodySemi, fontSize: 14, lineHeight: 20 },
  ctaRow: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  firstHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  firstCount: { fontFamily: fontFamily.displayXBold, fontSize: 22, letterSpacing: -0.6 },
  segments: { flexDirection: 'row', gap: 5 },
  segment: { flex: 1, height: 8, borderRadius: 4 },
  firstTitle: { fontFamily: fontFamily.displayBold, fontSize: 18, letterSpacing: -0.4 },
});
