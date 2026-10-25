/**
 * US DASH-01 — la scène de l'accueil : « le souffle » (spec §4.1).
 *
 * Quatre moments, un seul à la fois, décidés par `resolveHomeMoment` (`@wellness/shared`, pur et
 * testé) : **matin** (check-in d'énergie), **soir avec série en danger**, **retour** après une
 * absence, et **journée** (les anneaux de la semaine). La scène ne choisit rien — elle peint le
 * moment qu'on lui donne, comme `NowCard` peint la décision de `resolveNowAction`.
 *
 * ── US ACCUEIL-07 — la scène dit vrai, et prend la teinte Aurore ─────────────────────────────────
 *  - **deux lignes en tête** : la salutation (avec le prénom, enfin) et la phrase du jour, qui ne
 *    répète plus la carte « maintenant » (constat 6) ;
 *  - **le check-in en visages**, chacun avec son mot (constat 9) ;
 *  - **la série en jeu se sauve par un vrai geste** — marcher, noter une activité, le joker — au lieu
 *    d'un bouton qui ouvrait le planning (constat 5) ;
 *  - **la reprise en douceur ne mène plus nulle part** : elle démarre la période et le dit ici, sans
 *    pousser la route `/real-life`, qui n'a jamais existé (VIE-02) ;
 *  - **la matière** est faite des deux lueurs d'Aurore (`AuroraGlows`), posées sous le contenu.
 */

import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ReadinessVerdict, StreakRescueOption, WellbeingLevel } from '@wellness/shared';
import { CheckinFaces } from '@/components/dashboard/CheckinFaces';
import { StreakRescue } from '@/components/dashboard/StreakRescue';
import { ExplainButton } from '@/components/explain/ExplainButton';
import { AnimatedNumber, useLocaleSeparators } from '@/components/motion/AnimatedNumber';
import { PillarStage, useStageTheme } from '@/components/stage/PillarStage';
import { StageButton } from '@/components/stage/StageButton';
import { AuroraGlows } from '@/components/stage/matter/AuroraGlows';
import { BreathRings, type Ring } from '@/components/stage/matter/BreathRings';
import { useLoopActive } from '@/hooks/useLoopActive';
import { fontFamily } from '@/theme/fonts';
import type { AuroraMoment } from '@/theme/stage';

export type HomeScene =
  /** Avant 11 h, check-in du jour absent — la question la plus utile de la journée. */
  | {
      kind: 'morning';
      checkinDone: boolean;
      verdict: ReadinessVerdict | null;
      onCheckin: (level: WellbeingLevel) => void;
      saving: boolean;
    }
  /** Le soir, série en cours, rien de fait aujourd'hui : ce qu'il reste, et les vrais gestes. */
  | {
      kind: 'evening-at-risk';
      streak: number;
      hoursLeft: number;
      rescue: readonly StreakRescueOption[];
      onWalk: () => void;
      onActivity: () => void;
      onJoker: () => void;
      busy: boolean;
      formatSteps: (steps: number) => string;
    }
  /** Une semaine ou plus sans rien : on accueille, on ne réclame pas. */
  | {
      kind: 'comeback';
      /** Jours depuis la dernière activité. */
      days: number;
      bestStreak: number;
      /** La période « vie réelle » démarrée par « En douceur » court jusqu'à cette date (affichée). */
      gentleUntil: string | null;
      /** « Mon plan normal » choisi aujourd'hui. */
      normalChosen: boolean;
      onGentle: () => void;
      onNormal: () => void;
    }
  /** Le reste du temps : la semaine, pilier par pilier. */
  | { kind: 'day'; rings: readonly Ring[]; streak: number; verdict: ReadinessVerdict | null };

type Props = {
  scene: HomeScene;
  /** La salutation — « Bonjour Florian », « Content de te revoir »… (`greetingKind`). */
  greeting: string;
  /** La phrase du jour (`daySentence`) — elle dérive de la même décision que `NowCard`. */
  sentence: string;
  dateLabel: string;
  /** La lumière d'Aurore, selon l'heure (`auroraMoment`). */
  glowMoment: AuroraMoment;
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
  sentence,
  dateLabel,
  glowMoment,
  trailing,
  onExplainVerdict,
  children,
}: Props) {
  const { t } = useTranslation();
  const stage = useStageTheme('home');
  const active = useLoopActive('home');
  const { groupSeparator, decimalSeparator } = useLocaleSeparators();

  return (
    <PillarStage pillar="home" testID="home-stage" matter={<AuroraGlows moment={glowMoment} />}>
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
          // La salutation EST le titre de l'écran : annoncée comme tel, pas comme un texte après la date.
          accessibilityRole="header"
        >
          {greeting}
        </Text>
        <Text style={[styles.sentence, { color: stage.ink }]} maxFontSizeMultiplier={1.4}>
          {sentence}
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
              <Text style={[styles.line, { color: stage.ink }]}>{t('home.checkin.title')}</Text>
              <CheckinFaces
                onPick={scene.onCheckin}
                disabled={scene.saving}
                ink={stage.ink}
                glass={stage.glass}
                glassBorder={stage.glassBorder}
              />
              <Text style={[styles.hint, { color: stage.inkMuted }]}>{t('home.checkin.hint')}</Text>
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
          <Text style={[styles.hint, { color: stage.inkMuted }]}>{t('stage.home.rescue.lead')}</Text>
          <StreakRescue
            options={scene.rescue}
            onWalk={scene.onWalk}
            onActivity={scene.onActivity}
            onJoker={scene.onJoker}
            busy={scene.busy}
            formatSteps={scene.formatSteps}
          />
        </View>
      ) : scene.kind === 'comeback' ? (
        <View style={[styles.block, styles.panel, { backgroundColor: stage.glass, borderColor: stage.glassBorder }]}>
          <Text style={[styles.mono, { color: stage.ink }]}>
            {t('stage.home.comebackLine', { count: scene.days })}
          </Text>
          <Text style={[styles.body, { color: stage.ink }]}>{t('stage.home.comebackBody')}</Text>
          {scene.bestStreak > 0 ? (
            <Text style={[styles.body, { color: stage.ink }]}>
              {t('stage.home.bestStreak', { count: scene.bestStreak })}
            </Text>
          ) : null}
          {scene.gentleUntil ? (
            <Text style={[styles.confirm, { color: stage.ink }]} accessibilityLiveRegion="polite">
              {t('stage.home.gentleDone', { date: scene.gentleUntil })}
            </Text>
          ) : scene.normalChosen ? (
            <Text style={[styles.confirm, { color: stage.ink }]} accessibilityLiveRegion="polite">
              {t('stage.home.normalDone')}
            </Text>
          ) : (
            <View style={styles.ctaRow}>
              <StageButton
                pillar="home"
                icon="leaf-outline"
                label={t('stage.home.gentleRestart')}
                onPress={scene.onGentle}
                style={styles.flex}
                testID="home-gentle-restart"
              />
              <StageButton
                pillar="home"
                variant="glass"
                label={t('stage.home.normalPlan')}
                onPress={scene.onNormal}
                style={styles.flex}
                testID="home-normal-plan"
              />
            </View>
          )}
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
  greeting: { fontFamily: fontFamily.displayXBold, fontSize: 30, letterSpacing: -1.1, marginTop: 8 },
  sentence: { fontFamily: fontFamily.bodyMedium, fontSize: 15.5, lineHeight: 22, marginTop: 6 },
  block: { gap: 10, marginTop: 16 },
  panel: { borderRadius: 24, borderWidth: 1, padding: 16 },
  line: { fontFamily: fontFamily.displayBold, fontSize: 18, letterSpacing: -0.4 },
  mono: {
    fontFamily: fontFamily.monoBold,
    fontSize: 10.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  body: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  confirm: { fontFamily: fontFamily.bodySemi, fontSize: 14, lineHeight: 20 },
  verdict: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  hint: { fontFamily: fontFamily.bodyMedium, fontSize: 13, lineHeight: 18 },
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
