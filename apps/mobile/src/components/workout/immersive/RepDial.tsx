/**
 * Le cadran — US MUSCU-UX03, spec §5.7.
 *
 * ── Pourquoi un cadran plutôt qu'un champ ───────────────────────────────────────────────────────
 * Juste après une série, les mains tremblent et le nombre saisi diffère rarement de plus de deux
 * reps de l'objectif. Un clavier numérique est ici le pire outil possible : il ouvre une surface de
 * 300 dp, masque tout, et demande une précision qu'on n'a pas. Le cadran part **pré-réglé** sur la
 * bonne valeur — les reps comptées au doigt, sinon l'objectif — et un glissé vertical suffit à
 * corriger. Un cran tous les 26 dp : assez large pour ne pas déraper, assez court pour aller de 8
 * à 12 sans lever le doigt.
 *
 * ── Le ressenti, et le piège du 8 ───────────────────────────────────────────────────────────────
 * Quatre mots valent mieux qu'une échelle de 1 à 10 que personne ne calibre pareil. Ils sont écrits
 * dans la colonne `rpe` existante (aucune migration). ⚠️ **« Solide » vaut 7, jamais 8** :
 * `sessionStruggled` classe une séance comme difficile dès un RPE ≥ 8 et coupe alors la suggestion
 * de progression, puis déclenche le deload de MUSC-F7. Mapper la réponse *attendue* d'une bonne
 * série sur 8 éteindrait silencieusement la progression assistée. La règle vit dans
 * `packages/shared/src/set-feel.ts`, qui l'explique aussi.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { SET_FEELS, feelToRpe, type SetFeel } from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import type { ImmersiveRuntime, ValidateOverride } from '@/components/workout/immersive/types';
import { hapticSelect } from '@/lib/haptics';
import { fontFamily } from '@/theme/fonts';

/** Un cran de cadran tous les 26 dp de glissé vertical (spec §5.7). */
const STEP_DP = 26;

/** Pas d'un cran, selon ce que le cadran règle. Les durées avancent de 5 s, comme le pont. */
const DURATION_STEP_S = 5;

type Props = {
  runtime: ImmersiveRuntime;
  /** Répétitions comptées pendant l'effort — 0 si l'utilisateur n'a rien touché. */
  taps: number;
  startedAt: number | null;
  onCancel: () => void;
  onValidate: (override: ValidateOverride) => void;
};

export function RepDial({ runtime, taps, startedAt, onCancel, onValidate }: Props) {
  const { t } = useTranslation();
  const { colors, units, level, currentSetType } = runtime;

  const isDuration = currentSetType === 'duration';

  // Le cadran s'ouvre sur ce que l'utilisateur a réellement fait quand on le sait, sinon sur la
  // consigne. Une série chronométrée part du temps écoulé : c'est la seule valeur mesurée.
  const [value, setValue] = useState(() => {
    if (isDuration) {
      const measured = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
      return measured > 0 ? measured : (runtime.displayDurationSeconds ?? 0);
    }
    if (taps > 0) return taps;
    const planned = Number(runtime.displayReps);
    return Number.isNaN(planned) ? 0 : planned;
  });
  const [feel, setFeel] = useState<SetFeel | null>(null);

  /** Départ du glissé — sans lui, chaque `onUpdate` recalculerait depuis la valeur déjà corrigée. */
  const [anchor, setAnchor] = useState(value);

  const step = isDuration ? DURATION_STEP_S : 1;

  const applyDelta = (crans: number) => {
    const next = Math.max(0, anchor + crans * step);
    setValue((previous) => {
      if (previous !== next) hapticSelect();
      return next;
    });
  };

  const bump = (direction: -1 | 1) => {
    hapticSelect();
    setValue((previous) => {
      const next = Math.max(0, previous + direction * step);
      setAnchor(next);
      return next;
    });
  };

  // Vers le haut = plus. Le geste est absolu depuis son point de départ : il peut donc revenir en
  // arrière sans accumuler d'erreur, contrairement à un cumul d'incréments.
  const pan = Gesture.Pan()
    .onBegin(() => {
      runOnJS(setAnchor)(value);
    })
    .onUpdate((event) => {
      runOnJS(applyDelta)(Math.round(-event.translationY / STEP_DP));
    })
    .onEnd(() => {
      runOnJS(setAnchor)(value);
    });

  const label = isDuration
    ? t('immersive.dial.seconds', { count: value })
    : t('immersive.dial.reps', { count: value });

  const validate = () => {
    onValidate({
      reps: isDuration ? null : value,
      durationSeconds: isDuration ? value : null,
      weightKg: runtime.displayWeightKg,
      // Le ressenti n'écrase le RPE existant que si l'utilisateur en a choisi un : laisser `null`
      // ici effacerait une valeur saisie dans les options de la série.
      feel,
    });
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      {/* Une modale Android vit dans sa propre fenêtre, hors de la racine de gestes posée par
          `_layout.tsx` : sans cette racine-ci, le glissé du cadran n'était jamais reçu — seuls les
          boutons − / + répondaient (MUSCU-FIX02). */}
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={[styles.backdrop, { backgroundColor: `${colors.background}f2` }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            onPress={onCancel}
            hitSlop={12}
            style={styles.close}
          >
            <Ionicons name="chevron-down" size={26} color={colors.textMuted} />
          </Pressable>

          <Text style={[styles.title, { color: colors.textMuted }]}>
            {isDuration ? t('immersive.dial.titleDuration') : t('immersive.dial.title')}
          </Text>

          <GestureDetector gesture={pan}>
            <View style={styles.dialZone}>
              <View
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={label}
                accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                onAccessibilityAction={(event) =>
                  bump(event.nativeEvent.actionName === 'increment' ? 1 : -1)
                }
                style={styles.dialRow}
              >
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t('workout.stepDown', { field: label })}
                  haptic="none"
                  onPress={() => bump(-1)}
                  style={[styles.bump, { backgroundColor: colors.surfaceAlt }]}
                >
                  <Ionicons name="remove" size={24} color={colors.text} />
                </PressableScale>

                <View style={styles.dialCore}>
                  <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
                  <Text style={[styles.unit, { color: colors.textMuted }]}>
                    {isDuration ? t('workout.durationLabel') : t('workout.reps')}
                  </Text>
                </View>

                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t('workout.stepUp', { field: label })}
                  haptic="none"
                  onPress={() => bump(1)}
                  style={[styles.bump, { backgroundColor: colors.surfaceAlt }]}
                >
                  <Ionicons name="add" size={24} color={colors.text} />
                </PressableScale>
              </View>

              <Text style={[styles.hint, { color: colors.textMuted }]}>
                {t('immersive.dial.hint')}
              </Text>
            </View>
          </GestureDetector>

          {/* Rappel de la charge : on la voit, on ne la change pas ici — le pont s'en occupe avant
              de lancer la série (spec §5.7). */}
          {!isDuration && runtime.displayWeightKg !== null ? (
            <Text style={[styles.load, { color: colors.textMuted }]}>
              {units.formatWeight(runtime.displayWeightKg)}
            </Text>
          ) : null}

          {/* Le ressenti, facultatif : quatre mots plutôt qu'une échelle que personne ne calibre. */}
          {level !== 'simplified' ? (
            <View style={styles.feels}>
              <Text style={[styles.feelsLabel, { color: colors.textMuted }]}>
                {t('immersive.dial.feelLabel')}
              </Text>
              <View style={styles.feelRow}>
                {SET_FEELS.map((candidate) => {
                  const selected = feel === candidate;
                  return (
                    <PressableScale
                      key={candidate}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityHint={t('immersive.dial.feelHint', { rpe: feelToRpe(candidate) })}
                      haptic="select"
                      // Retaper le mot choisi l'efface : c'est la seule façon de revenir en arrière
                      // sans ajouter un bouton « aucun » que personne ne chercherait.
                      onPress={() => setFeel(selected ? null : candidate)}
                      style={[
                        styles.feel,
                        {
                          backgroundColor: selected ? colors.accent : colors.surfaceAlt,
                          borderColor: selected ? colors.accent : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.feelText,
                          { color: selected ? colors.accentText : colors.textMuted },
                        ]}
                      >
                        {t(`immersive.feel.${candidate}`)}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.footer}>
            <PressableScale
              accessibilityRole="button"
              haptic="confirm"
              onPress={validate}
              style={[styles.primary, { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.primaryLabel, { color: colors.accentText }]}>
                {runtime.chainsToSuperset ? t('workout.validateAndChain') : t('workout.validateSet')}
              </Text>
            </PressableScale>
            <Pressable accessibilityRole="button" onPress={onCancel} style={styles.secondary}>
              <Text style={[styles.secondaryLabel, { color: colors.textMuted }]}>
                {t('immersive.dial.back')}
              </Text>
            </Pressable>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'center', gap: 18, paddingHorizontal: 24 },
  close: { position: 'absolute', top: 46, alignSelf: 'center', padding: 8 },
  title: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  dialZone: { gap: 10 },
  dialRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  bump: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  dialCore: { minWidth: 140, alignItems: 'center' },
  value: { fontFamily: fontFamily.displayXBold, fontSize: 116, letterSpacing: -5, lineHeight: 120 },
  unit: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: -6,
  },
  hint: { fontFamily: fontFamily.body, fontSize: 12, textAlign: 'center' },
  load: { fontFamily: fontFamily.monoBold, fontSize: 17, textAlign: 'center' },
  feels: { gap: 8 },
  feelsLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  feelRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  feel: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  feelText: { fontFamily: fontFamily.bodySemi, fontSize: 13.5 },
  footer: { gap: 6, marginTop: 8 },
  primary: {
    minHeight: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { fontFamily: fontFamily.bodyBold, fontSize: 18 },
  secondary: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
});
