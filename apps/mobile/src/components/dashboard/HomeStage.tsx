/**
 * US DASH-01 — la scène de l'accueil : « le souffle » (spec §4.1).
 *
 * Quatre moments, un seul à la fois, décidés par `resolveHomeMoment` (`@wellness/shared`, pur et
 * testé) : **matin** (check-in d'énergie), **soir avec série en danger**, **retour** après une
 * absence, et **journée** (les anneaux de la semaine). La scène ne choisit rien — elle peint le
 * moment qu'on lui donne, comme `NowCard` peint la décision de `resolveNowAction`.
 *
 * La matière du pilier est l'anneau qui respire (`BreathRings`) : il vit dans le flux du contenu
 * plutôt que derrière lui, parce qu'un anneau à demi caché sous du texte ne se lit plus — et qu'un
 * anneau, ici, **porte une information** (la semaine par pilier), contrairement aux trois autres
 * matières qui ne sont que du décor (R1).
 */

import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ReadinessVerdict, WellbeingLevel } from '@wellness/shared';
import { ExplainButton } from '@/components/explain/ExplainButton';
import { AnimatedNumber, useLocaleSeparators } from '@/components/motion/AnimatedNumber';
import { PressableScale } from '@/components/motion/PressableScale';
import { PillarStage, useStageTheme } from '@/components/stage/PillarStage';
import { StageButton } from '@/components/stage/StageButton';
import { BreathRings, type Ring } from '@/components/stage/matter/BreathRings';
import { useLoopActive } from '@/hooks/useLoopActive';
import { fontFamily } from '@/theme/fonts';

const ENERGY_LEVELS: readonly WellbeingLevel[] = [1, 2, 3, 4, 5];

export type HomeScene =
  /** Avant 11 h, check-in du jour absent — la question la plus utile de la journée. */
  | {
      kind: 'morning';
      checkinDone: boolean;
      verdict: ReadinessVerdict | null;
      onCheckin: (level: WellbeingLevel) => void;
      saving: boolean;
    }
  /** Le soir, série en cours, rien de fait aujourd'hui : ce qu'il reste, et le filet du joker. */
  | {
      kind: 'evening-at-risk';
      streak: number;
      hoursLeft: number;
      jokersRemaining: number;
      onSave: () => void;
    }
  /** Une semaine ou plus sans rien : on accueille, on ne réclame pas. */
  | {
      kind: 'comeback';
      bestStreak: number;
      onGentle: () => void;
      onNormal: () => void;
    }
  /** Le reste du temps : la semaine, pilier par pilier. */
  | { kind: 'day'; rings: readonly Ring[]; streak: number; verdict: ReadinessVerdict | null };

type Props = {
  scene: HomeScene;
  /** L'accroche du jour (`headlineKey`) — elle dérive de la même décision que `NowCard`. */
  greeting: string;
  dateLabel: string;
  /** Posé à droite de la date : la pastille de synchro et l'accès aux réglages. */
  trailing?: ReactNode;
  /** Ouvre « Pourquoi ? » sur le verdict de forme (§6.1) — absent quand il n'y a pas de verdict. */
  onExplainVerdict?: () => void;
  /** La carte « maintenant » (`NowCard`), posée sur la scène : l'action du moment. */
  children?: ReactNode;
};

export function HomeStage({
  scene,
  greeting,
  dateLabel,
  trailing,
  onExplainVerdict,
  children,
}: Props) {
  const { t } = useTranslation();
  const stage = useStageTheme('home');
  const active = useLoopActive('home');
  const { groupSeparator, decimalSeparator } = useLocaleSeparators();

  return (
    <PillarStage pillar="home" testID="home-stage">
      <View>
        <View style={styles.topRow}>
          <Text style={[styles.eyebrow, { color: stage.inkMuted }]} numberOfLines={1}>
            {dateLabel}
          </Text>
          {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
        </View>
        <Text
          style={[styles.greeting, { color: stage.ink }]}
          numberOfLines={2}
          maxFontSizeMultiplier={1.4}
          // L'accroche EST le titre de l'écran : annoncée comme tel, pas comme un texte après la date.
          accessibilityRole="header"
        >
          {greeting}
        </Text>
      </View>

      {scene.kind === 'morning' ? (
        <View style={styles.block}>
          {scene.checkinDone ? (
            <>
              <Text style={[styles.line, { color: stage.ink }]}>{t('wellbeing.checkinDone')}</Text>
              {scene.verdict ? (
                <View style={styles.verdictRow}>
                  <Text style={[styles.verdict, { color: stage.ink }]}>
                    {t(`home.readiness.verdict.${scene.verdict}.title`)}
                  </Text>
                  {onExplainVerdict ? (
                    <ExplainButton
                      onPress={onExplainVerdict}
                      color={stage.inkMuted}
                      subject={t('home.readiness.eyebrow')}
                    />
                  ) : null}
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Text style={[styles.line, { color: stage.ink }]}>{t('wellbeing.checkinPrompt')}</Text>
              <View style={styles.pills} accessibilityRole="radiogroup">
                {ENERGY_LEVELS.map((level) => (
                  <PressableScale
                    key={level}
                    haptic="confirm"
                    disabled={scene.saving}
                    onPress={() => scene.onCheckin(level)}
                    accessibilityRole="radio"
                    accessibilityState={{ disabled: scene.saving }}
                    accessibilityLabel={t('wellbeing.a11yLevel', {
                      indicator: t('wellbeing.indicators.energy'),
                      level,
                      label: t(`wellbeing.levels.energy.${level}`),
                    })}
                    style={[styles.pill, { backgroundColor: stage.glass, borderColor: stage.glassBorder }]}
                  >
                    <Text style={[styles.pillLabel, { color: stage.ink }]}>{level}</Text>
                  </PressableScale>
                ))}
              </View>
              <Text style={[styles.hint, { color: stage.inkMuted }]}>{t('wellbeing.checkinHint')}</Text>
            </>
          )}
        </View>
      ) : scene.kind === 'evening-at-risk' ? (
        <View style={styles.block}>
          <View style={styles.bigRow}>
            <AnimatedNumber
              testID="home-streak"
              value={scene.streak}
              groupSeparator={groupSeparator}
              decimalSeparator={decimalSeparator}
              style={[styles.big, { color: stage.ink }]}
              accessibilityLabel={t('home.streak.suffix', { count: scene.streak })}
            />
            <Text style={[styles.unit, { color: stage.inkMuted }]}>
              {t('home.streak.suffix', { count: scene.streak })}
            </Text>
          </View>
          <Text style={[styles.line, { color: stage.ink }]}>
            {t('stage.home.timeLeft', { count: scene.hoursLeft })}
          </Text>
          {/* Le joker est un filet, pas une excuse : on dit qu'il existe, on ne le propose pas. */}
          <Text style={[styles.hint, { color: stage.inkMuted }]}>
            {scene.jokersRemaining > 0
              ? t('stage.home.jokerLeft', { count: scene.jokersRemaining })
              : t('stage.home.jokerNone')}
          </Text>
          <StageButton
            pillar="home"
            icon="flash-outline"
            label={t('stage.home.saveStreak')}
            onPress={scene.onSave}
            haptic="milestone"
          />
        </View>
      ) : scene.kind === 'comeback' ? (
        <View style={styles.block}>
          <Text style={[styles.line, { color: stage.ink }]}>{t('stage.home.comeback')}</Text>
          {scene.bestStreak > 0 ? (
            <Text style={[styles.hint, { color: stage.inkMuted }]}>
              {t('stage.home.bestStreak', { count: scene.bestStreak })}
            </Text>
          ) : null}
          <View style={styles.ctaRow}>
            <StageButton
              pillar="home"
              icon="leaf-outline"
              label={t('stage.home.gentleRestart')}
              onPress={scene.onGentle}
              style={styles.flex}
            />
            <StageButton
              pillar="home"
              variant="glass"
              label={t('stage.home.normalPlan')}
              onPress={scene.onNormal}
              style={styles.flex}
            />
          </View>
        </View>
      ) : (
        <View style={styles.dayRow}>
          <View style={styles.dayTexts}>
            {scene.streak > 0 ? (
              <View style={styles.bigRow}>
                <AnimatedNumber
                  testID="home-streak"
                  value={scene.streak}
                  groupSeparator={groupSeparator}
                  decimalSeparator={decimalSeparator}
                  style={[styles.big, { color: stage.ink }]}
                  accessibilityLabel={t('home.streak.suffix', { count: scene.streak })}
                />
                <Text style={[styles.unit, { color: stage.inkMuted }]}>
                  {t('home.streak.suffix', { count: scene.streak })}
                </Text>
              </View>
            ) : (
              <Text style={[styles.line, { color: stage.ink }]}>{t('home.streak.empty')}</Text>
            )}
            {scene.verdict ? (
              <View style={styles.verdictRow}>
                <Ionicons name="pulse-outline" size={14} color={stage.inkMuted} />
                <Text style={[styles.hint, { color: stage.inkMuted }]} numberOfLines={2}>
                  {t(`home.readiness.verdict.${scene.verdict}.title`)}
                </Text>
                {onExplainVerdict ? (
                  <ExplainButton
                    onPress={onExplainVerdict}
                    color={stage.inkMuted}
                    subject={t('home.readiness.eyebrow')}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
          {scene.rings.length > 0 ? (
            <BreathRings rings={scene.rings} active={active} size={112} />
          ) : null}
        </View>
      )}

      {children ? <View style={styles.slot}>{children}</View> : null}
    </PillarStage>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrow: {
    fontFamily: fontFamily.monoBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  greeting: { fontFamily: fontFamily.displayXBold, fontSize: 28, letterSpacing: -1, marginTop: 4 },
  block: { gap: 10, marginTop: 16 },
  line: { fontFamily: fontFamily.displayBold, fontSize: 18, letterSpacing: -0.4 },
  verdict: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  hint: { fontFamily: fontFamily.bodyMedium, fontSize: 13, lineHeight: 18 },
  pills: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLabel: { fontFamily: fontFamily.displayBold, fontSize: 18 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  big: { fontFamily: fontFamily.displayXBold, fontSize: 52, letterSpacing: -2, lineHeight: 56 },
  unit: { fontFamily: fontFamily.bodySemi, fontSize: 14, flexShrink: 1 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 },
  dayTexts: { flex: 1, gap: 6 },
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ctaRow: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  slot: { marginTop: 16 },
});
