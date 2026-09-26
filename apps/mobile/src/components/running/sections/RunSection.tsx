/**
 * L'onglet Courir du hub Course — US CARDIO-UX03, §4.2.
 *
 * De haut en bas : la carte du moment (avec « la dernière fois » un jour de séance), la carte
 * d'adaptation (F36, qui se tait sans signal), tes trois dernières sorties avec Recourir, « Autre
 * chose » (la course libre, les jours où la carte ne la propose pas déjà — D10), ta semaine, ton
 * programme.
 *
 * Pendant une course, seule la carte « Reprendre » reste : proposer d'en commencer une autre serait
 * proposer ce que l'écran de départ refuse (comme MUSCU-UX07 R8).
 */

import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RunHistoryItem } from '@/data/repositories/run-repository';
import { PressableScale } from '@/components/motion/PressableScale';
import { RecentRuns } from '@/components/running/RecentRuns';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  inProgress: boolean;
  /** La carte du moment. */
  moment: ReactNode;
  /** La carte d'adaptation de la séance du jour — `null` quand elle se tait. */
  adaptation: ReactNode;
  runs: readonly RunHistoryItem[];
  todayKey: string;
  recordCounts: ReadonlyMap<string, number>;
  onOpenRun: (runId: string) => void;
  onAgain: (runId: string) => void;
  onAllHistory: () => void;
  /** D10 — « Autre chose » : seulement quand la carte du moment ne propose pas déjà la course libre. */
  showFreeRun: boolean;
  onFreeRun: () => void;
  week: ReactNode;
  program: ReactNode;
};

export function RunSection(props: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={styles.section} testID="run-section-run">
      {props.moment}

      {props.inProgress ? null : (
        <>
          {props.adaptation}
          <RecentRuns
            runs={props.runs}
            todayKey={props.todayKey}
            recordCounts={props.recordCounts}
            onOpen={props.onOpenRun}
            onAgain={props.onAgain}
            onAllHistory={props.onAllHistory}
          />
          {props.showFreeRun ? (
            <View style={styles.block}>
              <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
                {t('runningHub.other.title')}
              </Text>
              <PressableScale
                testID="run-other-free"
                onPress={props.onFreeRun}
                accessibilityRole="button"
                style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Ionicons name="walk-outline" size={22} color={colors.accent} />
                <View style={styles.rowTexts}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{t('runningHub.moment.freeRun')}</Text>
                  <Text style={[styles.rowHint, { color: colors.textMuted }]}>{t('runningHub.other.freeHint')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </PressableScale>
            </View>
          ) : null}
          {props.week}
          {props.program}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 18 },
  block: { gap: 10 },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 20, letterSpacing: -0.4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  rowTexts: { flex: 1, gap: 1 },
  rowTitle: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  rowHint: { fontFamily: fontFamily.body, fontSize: 12.5 },
});
