/**
 * L'accueil du pilier Course — trois questions, une seule fois (US CARDIO-02, §3.3, D3, D4).
 *
 * ── Pourquoi ─────────────────────────────────────────────────────────────────────────────────────
 * Rien n'accueillait le coureur qui activait le pilier (F3) : l'allure de référence restait vide, la
 * voix coupée, la semaine sans objectif. Trois questions, chacune avec « Plus tard » :
 *  1. **ce que tu vises** — l'objectif et la fréquence, deux champs déjà lus ailleurs (conflits
 *     d'objectifs, « Ta semaine », Labo). Le niveau n'est pas demandé : il n'est lu nulle part ;
 *  2. **ton allure de référence** — les quatre portes, sans le test guidé (on ne part pas courir au
 *     milieu d'un accueil) ;
 *  3. **la voix pendant la course** — les deux réglages de voix, coupés par défaut.
 *
 * Chaque « Continuer » écrit sa page et rien d'autre ; « Plus tard » et « Passer » n'écrivent rien
 * (R16). L'ouverture, elle, est décidée et marquée par `useRunningWelcome` (R14, R15) : c'est une
 * **route**, pas une `Modal`, et le retour Android la ferme comme « Passer ».
 */

import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  RUNNER_OBJECTIVES,
  RUNNING_VOICE_CHOICES,
  voiceChoicePatch,
  type RunnerObjective,
  type RunningVoiceChoice,
} from '@wellness/shared';
import { OnboardingScaffold } from '@/components/OnboardingScaffold';
import { ReferencePaceDoors, useReferenceDoors } from '@/components/running/ReferencePaceDoors';
import {
  upsertRunnerProfile,
  useRunnerProfile,
  type RunnerProfileInput,
} from '@/data/repositories/running-profile-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const TOTAL = 3;
const FREQUENCIES = [1, 2, 3, 4, 5, 6, 7] as const;

export default function RunningWelcomeScreen() {
  useMenuFocus('running');

  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { runnerProfile } = useRunnerProfile();
  const lock = useActionLock();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [objective, setObjective] = useState<RunnerObjective | null>(null);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [voice, setVoice] = useState<RunningVoiceChoice | null>(null);
  const doors = useReferenceDoors({
    currentSPerKm: runnerProfile?.ref5kPaceSPerKm ?? null,
    allowGuidedTest: false,
  });

  // Deux appuis dans le même rendu (le défaut documenté par `useActionLock`) ne doivent ni sauter une
  // question, ni fermer deux fois — un second `router.back()` quitterait le hub (R17).
  const closing = useRef(false);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    router.back();
  };
  const next = () =>
    step === TOTAL ? close() : setStep((s) => (s === step ? ((s + 1) as 1 | 2 | 3) : s));

  const onContinue = () =>
    void lock(async () => {
      if (step === 1) {
        const patch: Partial<RunnerProfileInput> = {};
        if (objective) patch.objective = objective;
        if (frequency != null) patch.weeklyFrequency = frequency;
        if (Object.keys(patch).length > 0) await upsertRunnerProfile(patch);
      } else if (step === 2) {
        const evaluation = doors.evaluation;
        if (evaluation?.status === 'ok') {
          await upsertRunnerProfile({ ref5kPaceSPerKm: evaluation.sPerKm });
        } else if (evaluation && evaluation.status !== 'empty') {
          // Une saisie fausse n'est jamais avalée en silence : le message reste, on ne passe pas.
          return;
        }
      } else if (voice) {
        await upsertRunnerProfile(voiceChoicePatch(voice));
      }
      next();
    });

  const titles = {
    1: { title: t('running.welcome.goal.title'), subtitle: t('running.welcome.goal.subtitle') },
    2: { title: t('running.welcome.pace.title'), subtitle: t('running.refPace.subtitle') },
    3: { title: t('running.welcome.voice.title'), subtitle: t('running.welcome.voice.subtitle') },
  }[step];

  return (
    <OnboardingScaffold
      step={step}
      total={TOTAL}
      title={titles.title}
      subtitle={titles.subtitle}
      stepLabel={t('running.welcome.step', { current: step, total: TOTAL })}
      skipAllLabel={t('running.welcome.skipAll')}
      skipLabel={t('running.welcome.later')}
      continueLabel={step === TOTAL ? t('running.welcome.finish') : undefined}
      onSkipAll={close}
      onSkip={next}
      onContinue={onContinue}
      showProgressBar
    >
      {step === 1 ? (
        <View testID="running-welcome-goal" style={styles.block}>
          <Text style={[styles.label, { color: colors.textMuted }]}>{t('running.welcome.goal.objective')}</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('running.welcome.goal.objective')} style={styles.grid}>
            {RUNNER_OBJECTIVES.map((o) => {
              const active = objective === o;
              return (
                <Pressable
                  key={o}
                  testID={`welcome-objective-${o}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  onPress={() => setObjective(o)}
                  style={[
                    styles.gridItem,
                    { backgroundColor: active ? colors.accent : colors.surface, borderColor: active ? colors.accent : colors.borderStrong },
                  ]}
                >
                  <Text style={[styles.gridText, { color: active ? colors.accentText : colors.text }]}>
                    {t(`running.objective.${o}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.label, { color: colors.textMuted }]}>{t('running.welcome.goal.frequency')}</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('running.welcome.goal.frequency')} style={styles.freqRow}>
            {FREQUENCIES.map((n) => {
              const active = frequency === n;
              return (
                <Pressable
                  key={n}
                  testID={`welcome-frequency-${n}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={t('running.welcome.goal.frequencyA11y', { count: n })}
                  onPress={() => setFrequency(n)}
                  style={[
                    styles.freq,
                    { backgroundColor: active ? colors.accent : colors.surface, borderColor: active ? colors.accent : colors.borderStrong },
                  ]}
                >
                  <Text style={[styles.freqText, { color: active ? colors.accentText : colors.text }]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('running.welcome.goal.frequencyHint')}</Text>
        </View>
      ) : step === 2 ? (
        <View testID="running-welcome-pace">
          <ReferencePaceDoors state={doors} currentSPerKm={runnerProfile?.ref5kPaceSPerKm ?? null} allowGuidedTest={false} />
        </View>
      ) : (
        <View
          testID="running-welcome-voice"
          accessibilityRole="radiogroup"
          accessibilityLabel={t('running.welcome.voice.title')}
          style={styles.block}
        >
          {RUNNING_VOICE_CHOICES.map((choice) => {
            const active = voice === choice;
            return (
              <Pressable
                key={choice}
                testID={`welcome-voice-${choice}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => setVoice(choice)}
                style={[
                  styles.voice,
                  { backgroundColor: colors.surface, borderColor: active ? colors.accent : colors.border, borderWidth: active ? 1.5 : 1 },
                ]}
              >
                <View style={[styles.radio, { borderColor: active ? colors.accent : colors.borderStrong }]}>
                  {active ? <View style={[styles.radioDot, { backgroundColor: colors.accent }]} /> : null}
                </View>
                <View style={styles.voiceTexts}>
                  <Text style={[styles.voiceTitle, { color: colors.text }]}>{t(`running.welcome.voice.${choice}.title`)}</Text>
                  <Text style={[styles.hint, { color: colors.textMuted }]}>{t(`running.welcome.voice.${choice}.body`)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridItem: { flexBasis: '47%', flexGrow: 1, minHeight: 52, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 12, justifyContent: 'center' },
  gridText: { fontFamily: fontFamily.bodyBold, fontSize: 14.5 },
  freqRow: { flexDirection: 'row', gap: 6 },
  freq: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  freqText: { fontFamily: fontFamily.monoBold, fontSize: 15 },
  hint: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  voice: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 16, borderRadius: 18, minHeight: 44 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  voiceTexts: { flex: 1, gap: 2 },
  voiceTitle: { fontFamily: fontFamily.bodyBold, fontSize: 15.5 },
});
