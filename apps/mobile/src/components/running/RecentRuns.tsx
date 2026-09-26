/**
 * « Tes dernières sorties » — les trois plus récentes, visibles sans geste (US CARDIO-UX03, §4.2-3).
 *
 * Sur le hub d'avant, la seule sortie passée visible était la dernière, en « km par km », au dixième
 * bloc, et seulement si elle avait une trace. L'historique était à un geste, puis il fallait passer
 * deux sections de statistiques. Chaque ligne ouvre le détail ; « Recourir » repart contre elle.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RunHistoryItem } from '@/data/repositories/run-repository';
import { PressableScale } from '@/components/motion/PressableScale';
import { RunRow } from '@/components/running/RunRow';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Nombre de sorties montrées : au-delà, c'est l'historique. */
export const RECENT_RUNS_LIMIT = 3;

type Props = {
  runs: readonly RunHistoryItem[];
  todayKey: string;
  recordCounts: ReadonlyMap<string, number>;
  onOpen: (runId: string) => void;
  onAgain: (runId: string) => void;
  onAllHistory: () => void;
};

export function RecentRuns({ runs, todayKey, recordCounts, onOpen, onAgain, onAllHistory }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const recent = runs.slice(0, RECENT_RUNS_LIMIT);
  if (recent.length === 0) return null;

  return (
    <View style={styles.block} testID="run-recent">
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {t('runningHub.recent.title')}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {recent.map((run) => (
          <RunRow
            key={run.id}
            run={run}
            todayKey={todayKey}
            recordCount={recordCounts.get(run.id) ?? 0}
            onOpen={() => onOpen(run.id)}
            onAgain={() => onAgain(run.id)}
          />
        ))}
        <PressableScale
          testID="run-all-history"
          onPress={onAllHistory}
          accessibilityRole="button"
          style={styles.all}
        >
          <Text style={[styles.allLabel, { color: colors.text }]}>{t('runningHub.recent.allHistory')}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 20, letterSpacing: -0.4 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  all: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  allLabel: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
});
