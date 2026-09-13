/**
 * US DASH-01 (§6.1) — « **Pourquoi ?** » : d'où sort un chiffre.
 *
 * Chaque chiffre calculé de l'app (verdict de forme, cible calorique, chrono prédit, projection
 * « et si ») peut désormais être ouvert : la feuille montre **les étapes du calcul**, les valeurs
 * utilisées et un **niveau de confiance**. Rien n'est recalculé ici — les étapes viennent des
 * fonctions `explain*` (`@wellness/shared`, pures et testées), qui reprennent ce que les moteurs
 * ont produit. C'est ce qui rend l'explication honnête : elle ne peut pas diverger du chiffre.
 *
 * ── « Ce n'est pas ça » ──────────────────────────────────────────────────────────────────────────
 * Contester une règle enregistre un **poids local** (`rule-weights-store`) qui atténue son effet
 * dans les projections. Seules les règles de `WEIGHTABLE_RULES` sont contestables : on peut
 * contester un conseil, jamais un garde-fou de sécurité (R12).
 */

import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Confidence, Explanation } from '@wellness/shared';
import { Button } from '@/components/Button';
import { useRuleWeights, type WeightableRule } from '@/stores/rule-weights-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  visible: boolean;
  /** Titre : le chiffre qu'on explique, déjà formaté par l'appelant. */
  title: string;
  explanation: Explanation | null;
  /** Règles contestables dans ce contexte — vide quand l'explication ne porte aucun conseil. */
  weightableRules?: readonly WeightableRule[];
  /** Formate la valeur d'une étape ; par défaut, l'entier le plus proche. */
  formatValue?: (step: { key: string; value?: number }) => string | null;
  onClose: () => void;
};

const CONFIDENCE_ICON: Record<Confidence, keyof typeof Ionicons.glyphMap> = {
  high: 'checkmark-circle-outline',
  medium: 'help-circle-outline',
  low: 'alert-circle-outline',
};

export function ExplainSheet({
  visible,
  title,
  explanation,
  weightableRules = [],
  formatValue,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const weights = useRuleWeights((s) => s.weights);
  const disagree = useRuleWeights((s) => s.disagree);
  const reset = useRuleWeights((s) => s.reset);

  const confidenceColor = (confidence: Confidence): string =>
    confidence === 'high' ? colors.success : confidence === 'medium' ? colors.text : colors.warnText;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
      <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]} testID="explain-sheet">
        <View style={styles.head}>
          <View style={styles.headTexts}>
            <Text style={[styles.eyebrow, { color: colors.textMuted }]}>{t('explain.title')}</Text>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {title}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            hitSlop={10}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        {explanation === null ? (
          // Un chiffre sans explication disponible : on le dit, plutôt que d'en inventer une.
          <Text style={[styles.empty, { color: colors.textMuted }]}>{t('explain.unavailable')}</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {explanation.steps.map((step, index) => {
              const value = formatValue
                ? formatValue(step)
                : step.value != null
                  ? String(Math.round(step.value))
                  : null;
              return (
                <View key={`${step.key}-${index}`} style={styles.step}>
                  <View style={[styles.bullet, { backgroundColor: colors.accent }]} />
                  <Text style={[styles.stepText, { color: colors.text }]}>
                    {t(step.key, { ...step.params, value: value ?? '' })}
                  </Text>
                  {value ? (
                    <Text style={[styles.stepValue, { color: colors.textMuted }]}>{value}</Text>
                  ) : null}
                </View>
              );
            })}

            <View
              accessible
              accessibilityLabel={t(`explain.confidence.${explanation.confidence}`)}
              style={[styles.confidence, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Ionicons
                name={CONFIDENCE_ICON[explanation.confidence]}
                size={17}
                color={confidenceColor(explanation.confidence)}
              />
              <Text style={[styles.confidenceText, { color: confidenceColor(explanation.confidence) }]}>
                {t(`explain.confidence.${explanation.confidence}`)}
              </Text>
            </View>

            {weightableRules.length > 0 ? (
              <View style={styles.rules}>
                <Text style={[styles.rulesTitle, { color: colors.text }]}>{t('explain.disagreeTitle')}</Text>
                {weightableRules.map((rule) => {
                  const weight = weights[rule] ?? 1;
                  const muted = weight < 1;
                  return (
                    <View key={rule} style={styles.ruleRow}>
                      <Text style={[styles.ruleLabel, { color: colors.textMuted }]} numberOfLines={2}>
                        {t(`explain.rules.${rule}`)}
                        {muted ? ` · ${t('explain.ruleMuted', { percent: Math.round(weight * 100) })}` : ''}
                      </Text>
                      <Pressable
                        onPress={() => (muted ? reset(rule) : disagree(rule))}
                        accessibilityRole="button"
                        accessibilityLabel={t(muted ? 'explain.ruleRestore' : 'explain.disagree', {
                          rule: t(`explain.rules.${rule}`),
                        })}
                        hitSlop={6}
                        style={[styles.ruleBtn, { borderColor: colors.borderStrong }]}
                      >
                        <Text style={[styles.ruleBtnLabel, { color: colors.accent }]}>
                          {t(muted ? 'explain.ruleRestore' : 'explain.disagree', {
                            rule: t(`explain.rules.${rule}`),
                          })}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>
        )}

        <Button label={t('common.close')} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    padding: 20,
    gap: 14,
    maxHeight: '80%',
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headTexts: { flex: 1, gap: 2 },
  eyebrow: {
    fontFamily: fontFamily.monoBold,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: { fontFamily: fontFamily.displayBold, fontSize: 20, letterSpacing: -0.5 },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { gap: 12, paddingBottom: 4 },
  empty: { fontFamily: fontFamily.body, fontSize: 14 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  stepText: { flex: 1, fontFamily: fontFamily.bodyMedium, fontSize: 14, lineHeight: 20 },
  stepValue: { fontFamily: fontFamily.monoBold, fontSize: 14 },
  confidence: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  confidenceText: { fontFamily: fontFamily.bodySemi, fontSize: 13, flexShrink: 1 },
  rules: { gap: 10, marginTop: 4 },
  rulesTitle: { fontFamily: fontFamily.displaySemi, fontSize: 15 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ruleLabel: { flex: 1, fontFamily: fontFamily.body, fontSize: 13 },
  ruleBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 40, justifyContent: 'center' },
  ruleBtnLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
});
