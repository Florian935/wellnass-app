/**
 * US DASH-01 (§6.3) — « **Et si…** » : manipuler son futur, sans IA.
 *
 * Trois leviers (séances par semaine, sommeil, protéines), un moteur **déterministe**
 * (`projectWhatIf`, `@wellness/shared`) bâti sur la pente réelle de `projectSbd` — la même
 * régression que la section Force de l'écran Progression. Rien n'est deviné : les coefficients sont
 * fixes, lisibles, et la feuille « Pourquoi ? » les montre un par un.
 *
 * ── Ce que la carte refuse de faire ──────────────────────────────────────────────────────────────
 *  - **Projeter sans historique** : sous le minimum de `projectSbd` (points et fenêtre), elle
 *    affiche ce qui manque et **aucun chiffre** (R7).
 *  - **Cacher l'incertitude** : la projection s'affiche toujours avec son éventail, qui s'élargit
 *    avec la surcharge — c'est à l'écran de le dire, pas aux petits caractères.
 *  - **Laisser contester un garde-fou** : seuls le sommeil et les protéines sont pondérables ; la
 *    surcharge ne l'est pas (R12).
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  explainWhatIf,
  projectSbd,
  projectWhatIf,
  SBD_MAX_PROJECTION_WEEKS,
  whatIfConsequences,
  type WhatIfLevers,
} from '@wellness/shared';
import { ExplainButton } from '@/components/explain/ExplainButton';
import { ExplainSheet } from '@/components/explain/ExplainSheet';
import { PressableScale } from '@/components/motion/PressableScale';
import { DenseTile } from '@/components/stage/DenseTile';
import { useNutritionSummary, useTrainingLoadAlert } from '@/data/repositories/dashboard-repository';
import { useLatestWeight } from '@/data/repositories/bodyweight-repository';
import { useStrengthSection } from '@/data/repositories/strength-repository';
import { useRuleWeights, WEIGHTABLE_RULES } from '@/stores/rule-weights-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Horizon de la projection : douze semaines, comme la section Force. */
const HORIZON_WEEKS = 12;
const MIN_SESSIONS = 0;
const MAX_SESSIONS = 7;

type Props = {
  /** Rythme habituel de séances par semaine, la référence des leviers. */
  baselineSessions: number;
};

export function WhatIfCard({ baselineSessions }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { history } = useStrengthSection(i18n.language);
  const { latest } = useLatestWeight();
  const { target } = useNutritionSummary();
  const load = useTrainingLoadAlert();
  const weights = useRuleWeights((s) => s.weights);

  const [levers, setLevers] = useState<WhatIfLevers>({
    sessionsPerWeek: Math.max(MIN_SESSIONS, Math.round(baselineSessions)),
    baselineSessions: Math.max(1, Math.round(baselineSessions)),
    sleep: 'short',
    protein: 'base',
  });
  const [explainOpen, setExplainOpen] = useState(false);

  const projection = projectSbd(history, Math.min(HORIZON_WEEKS, SBD_MAX_PROJECTION_WEEKS));

  // Pas assez d'historique : on dit ce qui manque, on n'affiche aucun chiffre.
  if (!projection.ok) {
    return (
      <DenseTile title={t('whatIf.title')} testID="what-if-card">
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          {t(
            projection.reason === 'not-enough-points'
              ? 'whatIf.needPoints'
              : 'whatIf.needDays',
            { count: projection.reason === 'not-enough-points' ? projection.pointsMissing : projection.daysMissing },
          )}
        </Text>
      </DenseTile>
    );
  }

  const lastTotalKg = projection.projectedKg - projection.slopePerWeek * projection.weeks;
  const result = projectWhatIf({
    lastTotalKg,
    slopePerWeek: projection.slopePerWeek,
    weeks: projection.weeks,
    levers,
    ruleWeights: weights,
  });

  const consequences = whatIfConsequences({
    sessionsPerWeek: levers.sessionsPerWeek,
    baselineSessions: levers.baselineSessions,
    loadRatio: load?.ratio ?? null,
    baseKcalTarget: target ?? 0,
    protein: levers.protein,
    weightKg: latest?.weightKg ?? null,
  });

  const setSessions = (delta: number) =>
    setLevers((current) => ({
      ...current,
      sessionsPerWeek: Math.min(MAX_SESSIONS, Math.max(MIN_SESSIONS, current.sessionsPerWeek + delta)),
    }));

  return (
    <DenseTile
      title={t('whatIf.title')}
      meta={t('whatIf.horizon', { count: projection.weeks })}
      testID="what-if-card"
    >
      {/* Le chiffre, et son éventail : jamais l'un sans l'autre. */}
      <View style={styles.result}>
        <Text style={[styles.projected, { color: colors.text }]}>
          {t('whatIf.projected', { kg: Math.round(result.projectedKg) })}
        </Text>
        <Text style={[styles.range, { color: colors.textMuted }]}>
          {t('whatIf.range', { low: Math.round(result.lowKg), high: Math.round(result.highKg) })}
        </Text>
        {result.overreach ? (
          <Text style={[styles.warn, { color: colors.warnText }]}>{t('whatIf.overreach')}</Text>
        ) : null}
      </View>

      {/* ── Les leviers ──────────────────────────────────────────────────────────────────── */}
      <View style={styles.lever}>
        <Text style={[styles.leverLabel, { color: colors.text }]}>{t('whatIf.sessions')}</Text>
        <View style={styles.stepper}>
          <Stepper
            label="−"
            accessibilityLabel={t('whatIf.sessionsLess')}
            onPress={() => setSessions(-1)}
            colors={colors}
          />
          <Text style={[styles.stepperValue, { color: colors.text }]}>{levers.sessionsPerWeek}</Text>
          <Stepper
            label="+"
            accessibilityLabel={t('whatIf.sessionsMore')}
            onPress={() => setSessions(1)}
            colors={colors}
          />
        </View>
      </View>

      <Toggle
        label={t('whatIf.sleep')}
        options={[
          { value: 'short', label: t('whatIf.sleepShort') },
          { value: 'long', label: t('whatIf.sleepLong') },
        ]}
        value={levers.sleep}
        onChange={(value) => setLevers((current) => ({ ...current, sleep: value as 'short' | 'long' }))}
        colors={colors}
      />

      <Toggle
        label={t('whatIf.protein')}
        options={[
          { value: 'base', label: t('whatIf.proteinBase') },
          { value: 'high', label: t('whatIf.proteinHigh') },
        ]}
        value={levers.protein}
        onChange={(value) => setLevers((current) => ({ ...current, protein: value as 'base' | 'high' }))}
        colors={colors}
      />

      {/* ── Les conséquences ailleurs : un levier de muscu bouge la course et l'assiette ──── */}
      <View style={[styles.consequences, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
        {consequences.loadRatio !== null && consequences.loadZone ? (
          <Text
            style={[
              styles.consequence,
              { color: consequences.loadZone === 'risk' ? colors.warnText : colors.textMuted },
            ]}
          >
            {t(`whatIf.load.${consequences.loadZone}`, { ratio: consequences.loadRatio.toFixed(2) })}
          </Text>
        ) : null}
        {target != null ? (
          <Text style={[styles.consequence, { color: colors.textMuted }]}>
            {t('whatIf.kcal', { kcal: Math.round(consequences.kcalTarget) })}
          </Text>
        ) : null}
      </View>

      <ExplainButton
        onPress={() => setExplainOpen(true)}
        color={colors.textMuted}
        subject={t('whatIf.title')}
      />

      <ExplainSheet
        visible={explainOpen}
        title={t('whatIf.projected', { kg: Math.round(result.projectedKg) })}
        explanation={explainWhatIf(result, {
          baseSlopePerWeek: projection.slopePerWeek,
          historyPoints: history.length,
        })}
        weightableRules={WEIGHTABLE_RULES}
        formatValue={(step) => (step.value == null ? null : step.value.toFixed(2))}
        onClose={() => setExplainOpen(false)}
      />
    </DenseTile>
  );
}

type Colors = ReturnType<typeof useTheme>['colors'];

function Stepper({
  label,
  accessibilityLabel,
  onPress,
  colors,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  colors: Colors;
}) {
  return (
    <PressableScale
      haptic="select"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.stepperBtn, { borderColor: colors.borderStrong }]}
    >
      <Text style={[styles.stepperLabel, { color: colors.accent }]}>{label}</Text>
    </PressableScale>
  );
}

function Toggle({
  label,
  options,
  value,
  onChange,
  colors,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  colors: Colors;
}) {
  return (
    <View style={styles.lever}>
      <Text style={[styles.leverLabel, { color: colors.text }]}>{label}</Text>
      <View style={styles.toggle}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <PressableScale
              key={option.value}
              haptic="select"
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              style={[
                styles.toggleOption,
                {
                  backgroundColor: selected ? colors.accent : 'transparent',
                  borderColor: selected ? colors.accent : colors.borderStrong,
                },
              ]}
            >
              <Text
                style={[styles.toggleLabel, { color: selected ? colors.accentText : colors.textMuted }]}
              >
                {option.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontFamily: fontFamily.body, fontSize: 13.5, lineHeight: 19 },
  result: { gap: 2 },
  projected: { fontFamily: fontFamily.displayXBold, fontSize: 26, letterSpacing: -0.8 },
  range: { fontFamily: fontFamily.mono, fontSize: 12.5 },
  warn: { fontFamily: fontFamily.bodySemi, fontSize: 12.5, marginTop: 4 },
  lever: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  leverLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13.5, flexShrink: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperLabel: { fontFamily: fontFamily.displayBold, fontSize: 18 },
  stepperValue: { fontFamily: fontFamily.monoBold, fontSize: 16, minWidth: 18, textAlign: 'center' },
  toggle: { flexDirection: 'row', gap: 6 },
  toggleOption: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  toggleLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  consequences: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  consequence: { fontFamily: fontFamily.bodyMedium, fontSize: 12.5, lineHeight: 18 },
});
