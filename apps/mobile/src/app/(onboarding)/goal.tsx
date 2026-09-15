/**
 * Onboarding — l'objectif principal (US GUID-01, volet A).
 *
 * ── Ce que l'écran promettait, et ne tenait pas ──────────────────────────────────────────────────
 * Son sous-titre dit « Oriente les recommandations ». Cartographie du 12/09/2026 : `main_goal`
 * était lu à HUIT endroits, tous le même appel `objectiveFromGoal(...)` — le repli de l'objectif
 * nutritionnel, et seulement tant que le profil nutritionnel n'avait pas été ouvert. Musculation :
 * zéro lecture. Course : zéro lecture. Pire, `performance` et `health` tombaient dans le même
 * `default` : deux options sur quatre donnaient une application **identique** à celle de quelqu'un
 * qui avait appuyé sur « Passer ».
 *
 * Trois changements ici, et le reste dans `goal-defaults.ts` :
 *  1. chaque option affiche **ce qu'elle décide vraiment** (issu de `pillarDefaults`, pas d'un texte
 *     écrit à côté qui divergerait au premier changement) ;
 *  2. une **échéance** optionnelle ;
 *  3. une question de discipline **conditionnelle** quand « Performance » est choisi (décision D2).
 */

import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  GOALS,
  TRAINING_FOCUSES,
  addDays,
  localDayKey,
  pillarDefaults,
  resolveActivePillars,
  type Goal,
  type TrainingFocus,
} from '@wellness/shared';
import { OnboardingScaffold } from '@/components/OnboardingScaffold';
import { upsertProfile } from '@/data/repositories/profile-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

const NEXT = '/(onboarding)/guidance';

/**
 * Horizons proposés, en jours.
 *
 * Volontairement des **préréglages** et non un sélecteur de date : à l'onboarding, ouvrir un
 * calendrier pour une information facultative coûte plus que ce qu'elle rapporte, et la maquette
 * ne demandait qu'un choix binaire « date / pas de date ». Trois horizons couvrent l'écrasante
 * majorité des intentions ; une date précise se règle ensuite dans le profil.
 */
const HORIZONS = [90, 180, 365] as const;
type Horizon = (typeof HORIZONS)[number];

export default function OnboardingGoal() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { settings } = useSettings();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [horizon, setHorizon] = useState<Horizon | null>(null);
  const [focus, setFocus] = useState<TrainingFocus | null>(null);

  const activePillars = resolveActivePillars(settings?.activePillars);

  /**
   * La question de discipline n'a de sens que si « Performance » est choisi ET que les deux piliers
   * d'entraînement sont actifs. Avec un seul, la discipline se déduit — poser la question serait
   * demander à quelqu'un de choisir entre une chose et rien (décision H, « sans imposition »).
   */
  const askFocus =
    goal === 'performance' &&
    activePillars.includes('strength') &&
    activePillars.includes('running');

  /** Résumé d'une option, construit depuis la matrice — jamais un texte parallèle qui divergerait. */
  const hintFor = useMemo(
    () => (option: Goal) => {
      const d = pillarDefaults(option);
      const parts: string[] = [t(`onboarding.goal.hints.nutrition.${d.nutrition.objective}`)];
      if (activePillars.includes('strength')) {
        parts.push(t(`onboarding.goal.hints.strength.${d.strength.progression}`));
      }
      if (activePillars.includes('running')) {
        parts.push(t(`onboarding.goal.hints.cardio.${d.cardio.emphasis}`));
      }
      return parts.join(' · ');
    },
    [activePillars, t],
  );

  const onContinue = async () => {
    await upsertProfile({
      mainGoal: goal,
      mainGoalDeadline: horizon ? localDayKey(addDays(new Date(), horizon)) : null,
      // La discipline n'est écrite que si la question avait lieu d'être : sinon `null`, qui veut
      // dire « sans objet », et non « endurance par défaut ».
      trainingFocus: askFocus ? focus : null,
    });
    router.push(NEXT);
  };

  return (
    <OnboardingScaffold
      step={3}
      title={t('onboarding.goal.title')}
      subtitle={t('onboarding.goal.subtitle')}
      onSkip={() => router.push(NEXT)}
      onContinue={onContinue}
    >
      <View style={styles.list}>
        {GOALS.map((option) => {
          const selected = goal === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${t(`onboarding.goal.options.${option}`)} — ${hintFor(option)}`}
              onPress={() => setGoal(option)}
              style={[
                styles.option,
                {
                  backgroundColor: colors.surface,
                  borderColor: selected ? colors.accent : colors.border,
                },
              ]}
            >
              <View style={styles.texts}>
                <Text style={[styles.optionLabel, { color: colors.text }]}>
                  {t(`onboarding.goal.options.${option}`)}
                </Text>
                <Text style={[styles.hint, { color: colors.textMuted }]}>{hintFor(option)}</Text>
              </View>
              {selected ? (
                <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              ) : (
                <View style={[styles.dot, { borderColor: colors.border, borderWidth: 1.5 }]} />
              )}
            </Pressable>
          );
        })}
      </View>

      {askFocus ? (
        <View style={styles.block}>
          <Text style={[styles.blockLabel, { color: colors.textMuted }]}>
            {t('onboarding.goal.focusLabel')}
          </Text>
          <View style={styles.chips}>
            {TRAINING_FOCUSES.map((option) => {
              const on = focus === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setFocus(on ? null : option)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: on ? colors.accent : colors.surface,
                      borderColor: on ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.chipText, { color: on ? colors.accentText : colors.textMuted }]}
                  >
                    {t(`guidance.focus.${option}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.block}>
        <Text style={[styles.blockLabel, { color: colors.textMuted }]}>
          {t('onboarding.goal.deadlineLabel')}
        </Text>
        <View style={styles.chips}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: horizon === null }}
            onPress={() => setHorizon(null)}
            style={[
              styles.chip,
              {
                backgroundColor: horizon === null ? colors.accent : colors.surface,
                borderColor: horizon === null ? colors.accent : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: horizon === null ? colors.accentText : colors.textMuted },
              ]}
            >
              {t('onboarding.goal.noDeadline')}
            </Text>
          </Pressable>
          {HORIZONS.map((days) => {
            const on = horizon === days;
            return (
              <Pressable
                key={days}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setHorizon(days)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: on ? colors.accent : colors.surface,
                    borderColor: on ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.chipText, { color: on ? colors.accentText : colors.textMuted }]}
                >
                  {t(`onboarding.goal.horizons.${days}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  texts: { flex: 1, gap: 3 },
  optionLabel: { fontFamily: fontFamily.bodySemi, fontSize: 16 },
  hint: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  dot: { width: 20, height: 20, borderRadius: 10 },
  block: { gap: 8 },
  blockLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  chipText: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});
