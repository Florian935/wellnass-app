/**
 * L'onglet Progrès du hub Musculation — US MUSCU-UX07, §4.4.
 *
 * Les cartes d'analyse que MUSCU-UX05 avait posées sous la scène, **déplacées telles quelles** : le
 * fil du jour, Tes charges, À ta portée, Ton corps, Le mur, le cumul. Elles gardent leur règle de
 * silence (MUSCU-UX05 R1). « Toute ta progression » ouvre l'écran de détail, qui reste (D8).
 *
 * Sans aucune séance : un seul message et « Commencer », plutôt que six cartes muettes.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/motion/PressableScale';
import { BodyBalanceCard } from '@/components/strength/BodyBalanceCard';
import { DayThread } from '@/components/strength/DayThread';
import { LifetimeLine } from '@/components/strength/LifetimeLine';
import { LoadProgressCard } from '@/components/strength/LoadProgressCard';
import { NearRecordsCard } from '@/components/strength/NearRecordsCard';
import { RecordWall } from '@/components/strength/RecordWall';
import { ResumeLine } from '@/components/strength/ResumeLine';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  hasWorkouts: boolean;
  resumeName: string | null;
  onResume: () => void;
  onInsights: () => void;
  onProgress: () => void;
  onBody: () => void;
  onOpenExercise: (exerciseId: string) => void;
  onStart: () => void;
};

export function ProgressSection(props: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={styles.section} testID="strength-section-progress">
      {props.resumeName !== null ? <ResumeLine name={props.resumeName} onPress={props.onResume} /> : null}

      {props.hasWorkouts ? (
        <>
          <DayThread onPress={props.onInsights} />
          <LoadProgressCard onPress={props.onProgress} />
          <NearRecordsCard onOpenExercise={props.onOpenExercise} />
          <BodyBalanceCard onPress={props.onBody} />
          <RecordWall onOpenExercise={props.onOpenExercise} />
          <LifetimeLine onPress={props.onProgress} />
          <PressableScale
            testID="strength-progress-link"
            onPress={props.onProgress}
            accessibilityRole="button"
            style={[styles.link, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.linkLabel, { color: colors.text }]}>{t('strengthHub.progressLink')}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </PressableScale>
        </>
      ) : (
        <View
          testID="strength-progress-empty"
          style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('strengthHub.progressEmpty.title')}</Text>
          <Text style={[styles.emptyBody, { color: colors.textMuted }]}>{t('strengthHub.progressEmpty.body')}</Text>
          <PressableScale
            testID="strength-progress-start"
            haptic="confirm"
            onPress={props.onStart}
            accessibilityRole="button"
            style={[styles.cta, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.ctaLabel, { color: colors.accentText }]}>{t('strengthHub.progressEmpty.cta')}</Text>
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
