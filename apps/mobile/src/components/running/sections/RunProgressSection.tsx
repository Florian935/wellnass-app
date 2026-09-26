/**
 * L'onglet Progrès du hub Course — US CARDIO-UX03, §4.4.
 *
 * Les cartes d'analyse de CARDIO-UX02, **déplacées telles quelles et dans leur ordre** : le fil du
 * jour, Ton allure (la carte dominante, R3 de CARDIO-UX02), Si tu courais demain, Ton moteur, Tes
 * records, Ta charge, Km par km, le cumul. Elles gardent leur règle de silence. « Toutes tes stats »
 * ouvre l'écran des analyses détaillées (l'ancien historique, moins sa liste — D7).
 *
 * « Ma semaine » et la carte d'adaptation ne sont pas ici : elles disent ce qu'il reste à faire, pas
 * ce qu'on a gagné, et vivent dans Courir.
 *
 * Sans aucune sortie : un seul message et « Commencer », plutôt que huit cartes muettes.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/motion/PressableScale';
import { PaceProgressCard } from '@/components/running/PaceProgressCard';
import { RunEngineCard } from '@/components/running/RunEngineCard';
import { RunLifetimeLine } from '@/components/running/RunLifetimeLine';
import { RunLoadCard } from '@/components/running/RunLoadCard';
import { RunPredictionsCard } from '@/components/running/RunPredictionsCard';
import { RunRecordWall } from '@/components/running/RunRecordWall';
import { RunResumeLine } from '@/components/running/RunResumeLine';
import { RunSplitsCard } from '@/components/running/RunSplitsCard';
import { RunThread } from '@/components/running/RunThread';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  hasRuns: boolean;
  /** Pendant une course : ce qu'en dit la ligne « Reprendre ». */
  resumeDetail: string | null;
  onResume: () => void;
  onInsights: () => void;
  onStats: () => void;
  /** Km par km : la dernière sortie terminée. */
  lastRun: { id: string; plannedSessionId: string | null } | null;
  onOpenRun: (runId: string) => void;
  onStart: () => void;
};

export function RunProgressSection(props: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { lastRun } = props;

  return (
    <View style={styles.section} testID="run-section-progress">
      {props.resumeDetail !== null ? <RunResumeLine detail={props.resumeDetail} onPress={props.onResume} /> : null}

      {props.hasRuns ? (
        <>
          <RunThread onPress={props.onInsights} />
          <PaceProgressCard onPress={props.onStats} />
          <RunPredictionsCard onOpen={props.onStats} />
          <RunEngineCard onOpen={props.onStats} />
          <RunRecordWall onOpen={props.onStats} />
          <RunLoadCard onOpen={props.onStats} />
          <RunSplitsCard
            runId={lastRun?.id ?? null}
            plannedSessionId={lastRun?.plannedSessionId ?? null}
            onOpen={() => (lastRun ? props.onOpenRun(lastRun.id) : undefined)}
          />
          <RunLifetimeLine onPress={props.onStats} />
          <PressableScale
            testID="run-progress-stats"
            onPress={props.onStats}
            accessibilityRole="button"
            style={[styles.link, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.linkLabel, { color: colors.text }]}>{t('runningHub.progressLink')}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </PressableScale>
        </>
      ) : (
        <View testID="run-progress-empty" style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('runningHub.progressEmpty.title')}</Text>
          <Text style={[styles.emptyBody, { color: colors.textMuted }]}>{t('runningHub.progressEmpty.body')}</Text>
          <PressableScale
            testID="run-progress-start"
            haptic="confirm"
            onPress={props.onStart}
            accessibilityRole="button"
            style={[styles.cta, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.ctaLabel, { color: colors.accentText }]}>{t('runningHub.progressEmpty.cta')}</Text>
          </PressableScale>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  linkLabel: { fontFamily: fontFamily.bodyBold, fontSize: 14.5 },
  empty: { gap: 10, padding: 18, borderRadius: 22, borderWidth: 1, borderStyle: 'dashed' },
  emptyTitle: { fontFamily: fontFamily.displayXBold, fontSize: 20, lineHeight: 25 },
  emptyBody: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  cta: { minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  ctaLabel: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
});
