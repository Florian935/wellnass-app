/**
 * US LABO-01 — onglet « Acquis » : ce que le Labo a appris de toi, et à quoi ça sert.
 *
 * Deux sources, jamais confondues : une **expérience** rendue (verdict scellé jusqu'au bout) et une
 * **association** mesurée sur l'historique. L'écran dit toujours laquelle, avec son nombre de cas —
 * et « pas de lien » est un résultat, pas un vide.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { experimentProgress, type LabKnowledgeCard } from '@wellness/shared';

import type { LabExperimentView } from '@/data/repositories/lab-repository';
import { dayMonth } from './lab-format';
import { Lens } from './Lens';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  cards: LabKnowledgeCard[];
  experiments: LabExperimentView[];
  todayKey: string;
  onStop: (id: string) => void;
};

export function LabKnownPanel({ cards, experiments, todayKey, onStop }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const running = experiments.filter((e) => e.record.status === 'running' && e.verdict.status === 'sealed');
  const learned = cards.filter((c) => c.status !== 'learning');
  const learning = cards.filter((c) => c.status === 'learning');

  const statusColor = (status: LabKnowledgeCard['status']) =>
    status === 'verified' || status === 'solid' ? colors.success : status === 'probable' ? colors.warnText : colors.textMuted;

  return (
    <View style={styles.panel}>
      <Text style={[styles.lead, { color: colors.text }]}>{t('lab.known.lead')}</Text>
      <Text style={[styles.text, { color: colors.textMuted }]}>{t('lab.known.subtitle')}</Text>

      {running.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('lab.known.running')}</Text>
            <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>{t('lab.known.sealed')}</Text>
          </View>
          {running.map(({ record }) => {
            const progress = experimentProgress(record, todayKey);
            return (
              <View key={record.id} testID={`lab-running-${record.kind}`} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardHead}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{t(`lab.experiments.${record.kind}.title`)}</Text>
                  <Text style={[styles.dayCount, { color: colors.accent }]}>
                    {t('lab.known.day', { day: progress.day, total: progress.totalDays })}
                  </Text>
                </View>
                <View style={[styles.track, { backgroundColor: colors.border }]}>
                  <View style={[styles.fill, { width: `${Math.max(3, Math.round((progress.day / progress.totalDays) * 100))}%`, backgroundColor: colors.accent }]} />
                </View>
                <Text style={[styles.text, { color: colors.textMuted }]}>
                  {progress.weekIndex === null
                    ? t('lab.known.startsOn', { date: dayMonth(record.startKey) })
                    : t(`lab.known.arm.${progress.arm}`)}
                </Text>
                <Pressable accessibilityRole="button" onPress={() => onStop(record.id)} hitSlop={6}>
                  <Text style={[styles.link, { color: colors.textMuted }]}>{t('lab.known.stop')}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('lab.known.title')}</Text>
          <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>{t('lab.known.whatFor')}</Text>
        </View>

        {learned.length === 0 ? (
          <Text style={[styles.text, { color: colors.textMuted }]}>{t('lab.known.empty')}</Text>
        ) : (
          learned.map((card) => (
            <View key={card.id} testID={`lab-known-${card.kind}`} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHead}>
                <Lens pair={card.pair} />
                <Text style={[styles.status, { color: statusColor(card.status) }]}>{t(`lab.known.status.${card.status}`)}</Text>
              </View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t(`lab.knowledge.${card.kind}.${card.source === 'experiment' ? 'experiment' : 'association'}`, card.values)}
              </Text>
              <Text style={[styles.text, { color: colors.textMuted }]}>
                {card.source === 'experiment' ? t('lab.known.fromExperiment') : t('lab.known.fromCases', card.values)}
              </Text>
              {card.usedBy !== null ? (
                <View style={styles.useRow}>
                  <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
                  <Text style={[styles.use, { color: colors.text }]}>{t(`lab.known.usedBy.${card.usedBy}`)}</Text>
                </View>
              ) : null}
            </View>
          ))
        )}

        {learning.length > 0 ? (
          <Text style={[styles.text, { color: colors.textMuted }]}>
            {t('lab.known.learning', { count: learning.length, needed: learning[0]!.values.needed ?? 3 })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 16 },
  lead: { fontFamily: fontFamily.displayBold, fontSize: 19, lineHeight: 24 },
  text: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  sectionTitle: { fontFamily: fontFamily.mono, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  sectionMeta: { fontFamily: fontFamily.body, fontSize: 12 },
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 6 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardTitle: { fontFamily: fontFamily.bodyBold, fontSize: 14.5, lineHeight: 19 },
  dayCount: { fontFamily: fontFamily.monoBold, fontSize: 11.5 },
  status: { fontFamily: fontFamily.mono, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  link: { fontFamily: fontFamily.body, fontSize: 12.5, textDecorationLine: 'underline' },
  useRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  use: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
});
