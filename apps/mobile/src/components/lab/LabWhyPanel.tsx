/**
 * US LABO-01 — onglet « Pourquoi ? » : quand une courbe cale, ce que les données disent.
 *
 * Trois lectures, dans cet ordre : **le constat** (la courbe et son plateau), **ce qui pèse**
 * (les suspects classés, avec leur chiffre et leur code d'analyse), **comment trancher**
 * (l'expérience, ou un rappel quand une expérience serait déplacée).
 *
 * Deux règles de ton, tenues par l'écran : ce qui est écarté est **dit**, ce qui manque est **dit**,
 * et rien n'est présenté comme une preuve.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';
import type { LabExperimentKind, LabQuestion } from '@wellness/shared';

import { Lens } from './Lens';
import { formatDecimal, formatPace } from './lab-format';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  questions: LabQuestion[];
  selectedId: string | null;
  runningExperiments: readonly LabExperimentKind[];
  onSelect: (id: string) => void;
  onStartExperiment: (kind: LabExperimentKind) => void;
  onGoToWeek: () => void;
};

/** La courbe du constat : huit points, le plateau surligné, le dernier point marqué. */
function Sparkline({ question, unitFormat }: { question: LabQuestion; unitFormat: (v: number) => string }) {
  const { colors } = useTheme();
  const points = question.series.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (points.length < 2) return null;
  const values = points.map((p) => p.v);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.15 || 1;
  const W = 300;
  const H = 76;
  const x = (i: number) => 4 + (i / (question.series.length - 1)) * (W - 8);
  const y = (v: number) => H - 8 - ((v - (lo - pad)) / (hi + pad - (lo - pad))) * (H - 16);
  const line = points.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const flat = points
    .filter((p) => p.i >= question.flatFrom)
    .map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`)
    .join(' ');
  const last = points[points.length - 1]!;

  return (
    <View style={styles.spark}>
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} accessibilityLabel={unitFormat(last.v)}>
        <Path d={line} fill="none" stroke={colors.text} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {flat.length > 0 ? <Path d={flat} fill="none" stroke={colors.warnText} strokeWidth={3.5} strokeLinecap="round" /> : null}
        <Circle cx={x(last.i)} cy={y(last.v)} r={4.5} fill={colors.warnText} stroke={colors.surface} strokeWidth={2} />
      </Svg>
    </View>
  );
}

export function LabWhyPanel({ questions, selectedId, runningExperiments, onSelect, onStartExperiment, onGoToWeek }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const locale = i18n.language;

  if (questions.length === 0) {
    return (
      <View style={styles.panel}>
        <Text style={[styles.lead, { color: colors.text }]}>{t('lab.why.emptyTitle')}</Text>
        <Text style={[styles.text, { color: colors.textMuted }]}>{t('lab.why.emptyBody')}</Text>
      </View>
    );
  }

  const question = questions.find((q) => q.id === selectedId) ?? questions[0]!;
  const unitFormat = (value: number) =>
    question.kind === 'paceFade' ? formatPace(value) : question.kind === 'weightPlateau' ? t('lab.why.kg', { value: formatDecimal(value, locale) }) : t('lab.why.kg', { value: Math.round(value) });
  const test = question.experiment;
  const alreadyRunning = test !== null && runningExperiments.includes(test);

  return (
    <View style={styles.panel}>
      <Text style={[styles.lead, { color: colors.text }]}>{t('lab.why.lead')}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {questions.map((q) => {
          const selected = q.id === question.id;
          return (
            <Pressable
              key={q.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSelect(q.id)}
              testID={`lab-question-${q.kind}`}
              style={[styles.chip, { backgroundColor: colors.surface, borderColor: selected ? colors.text : colors.border }]}
            >
              <Text style={[styles.chipTitle, { color: colors.text }]}>{t(`lab.questions.${q.kind}.title`, q.values)}</Text>
              <Text style={[styles.chipMeta, { color: colors.textMuted }]}>{t(`lab.questions.${q.kind}.detected`, q.values)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t(`lab.questions.${question.kind}.detected`, question.values)}</Text>
        <Sparkline question={question} unitFormat={unitFormat} />
        <Text style={[styles.cardNote, { color: colors.textMuted }]}>{t('lab.why.eightWeeks')}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('lab.why.suspects')}</Text>
          <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>{t('lab.why.suspectsMeta')}</Text>
        </View>
        {question.suspects.length === 0 ? (
          <Text style={[styles.text, { color: colors.textMuted }]}>{t('lab.why.noSuspect')}</Text>
        ) : (
          question.suspects.map((suspect) => (
            <View key={suspect.kind} testID={`lab-suspect-${suspect.kind}`} style={[styles.suspect, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Lens pair={suspect.pair} />
              <View style={styles.suspectBody}>
                <Text style={[styles.suspectTitle, { color: colors.text }]}>{t(`lab.suspects.${suspect.kind}.title`)}</Text>
                <Text style={[styles.suspectProof, { color: colors.textMuted }]}>
                  {t(`lab.suspects.${suspect.kind}.proof`, suspect.values)}
                </Text>
                <View style={styles.forceRow}>
                  <View style={[styles.forceTrack, { backgroundColor: colors.border }]}>
                    <View style={[styles.forceFill, { width: `${Math.round(suspect.effect * 100)}%`, backgroundColor: colors.warnText }]} />
                  </View>
                  <Text style={[styles.forceLabel, { color: colors.textMuted }]}>{t(`lab.why.level.${suspect.level}`)}</Text>
                </View>
                {suspect.proposal !== null ? (
                  <Pressable accessibilityRole="button" onPress={onGoToWeek} hitSlop={6}>
                    <Text style={[styles.link, { color: colors.text }]}>{t('lab.why.fixInWeek')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))
        )}

        {question.cleared.length > 0 ? (
          <View style={styles.clearedRow}>
            <Ionicons name="checkmark" size={16} color={colors.success} />
            <Text style={[styles.text, { color: colors.textMuted }]}>
              {t('lab.why.cleared', { list: question.cleared.map((k) => t(`lab.suspects.${k}.short`)).join(', ') })}
            </Text>
          </View>
        ) : null}
        {question.missing.length > 0 ? (
          <Text style={[styles.text, { color: colors.textMuted }]}>
            {t('lab.why.missing', { list: question.missing.map((k) => t(`lab.suspects.${k}.short`)).join(', ') })}
          </Text>
        ) : null}
      </View>

      <View style={[styles.test, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <Text style={[styles.testEyebrow, { color: colors.accent }]}>{t('lab.why.toSettle')}</Text>
        {test === null ? (
          <>
            <Text style={[styles.testTitle, { color: colors.text }]}>{t('lab.why.measureFirstTitle')}</Text>
            <Text style={[styles.text, { color: colors.textMuted }]}>{t('lab.why.measureFirstBody')}</Text>
          </>
        ) : (
          <>
            <Text style={[styles.testTitle, { color: colors.text }]}>{t(`lab.experiments.${test}.title`)}</Text>
            <Text style={[styles.text, { color: colors.textMuted }]}>{t(`lab.experiments.${test}.text`)}</Text>
            {alreadyRunning ? (
              <View style={styles.clearedRow}>
                <Ionicons name="checkmark" size={16} color={colors.success} />
                <Text style={[styles.state, { color: colors.success }]}>{t('lab.why.alreadyRunning')}</Text>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                testID="lab-start-experiment"
                onPress={() => onStartExperiment(test)}
                style={[styles.action, { borderColor: colors.text }]}
              >
                <Text style={[styles.actionLabel, { color: colors.text }]}>{t('lab.why.startExperiment')}</Text>
              </Pressable>
            )}
          </>
        )}
      </View>

      <Text style={[styles.honest, { color: colors.textMuted }]}>{t('lab.why.honest')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 16 },
  lead: { fontFamily: fontFamily.displayBold, fontSize: 19, lineHeight: 24 },
  text: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { maxWidth: 220, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  chipTitle: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  chipMeta: { fontFamily: fontFamily.body, fontSize: 11.5 },
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 6 },
  cardTitle: { fontFamily: fontFamily.displayBold, fontSize: 16 },
  cardNote: { fontFamily: fontFamily.body, fontSize: 11.5 },
  spark: { marginTop: 4 },
  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontFamily: fontFamily.mono, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  sectionMeta: { fontFamily: fontFamily.body, fontSize: 12 },
  suspect: { flexDirection: 'row', gap: 10, borderRadius: 16, borderWidth: 1, padding: 12 },
  suspectBody: { flex: 1, gap: 4 },
  suspectTitle: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  suspectProof: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  forceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  forceTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  forceFill: { height: 6, borderRadius: 3 },
  forceLabel: { fontFamily: fontFamily.mono, fontSize: 10.5, width: 52, textAlign: 'right' },
  clearedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  link: { fontFamily: fontFamily.bodySemi, fontSize: 12.5, textDecorationLine: 'underline' },
  test: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 8 },
  testEyebrow: { fontFamily: fontFamily.mono, fontSize: 10.5, letterSpacing: 1.1, textTransform: 'uppercase' },
  testTitle: { fontFamily: fontFamily.displayBold, fontSize: 17, lineHeight: 21 },
  state: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
  action: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5 },
  actionLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  honest: { fontFamily: fontFamily.body, fontSize: 12, fontStyle: 'italic', lineHeight: 16 },
});
