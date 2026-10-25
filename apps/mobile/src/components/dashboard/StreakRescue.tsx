/**
 * US ACCUEIL-07 — **sauver la série par un vrai geste** (constat 5 du 24/10/2026).
 *
 * Remplace le bouton « Sauver ma série », qui ouvrait le planning — où rien ne se sauve. Les sorties
 * proposées sont choisies par `streakRescueOptions` (`@wellness/shared`, testée) : marcher (si les pas
 * sont suivis), noter une activité, et le joker (s'il reste, et pas au lendemain d'un autre). La
 * première est le geste principal, les autres sont en verre.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { StreakRescueOption } from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import { useStageTheme } from '@/components/stage/PillarStage';
import { LinearGradient } from 'expo-linear-gradient';
import { fontFamily } from '@/theme/fonts';

type Props = {
  options: readonly StreakRescueOption[];
  onWalk: () => void;
  onActivity: () => void;
  onJoker: () => void;
  busy?: boolean;
  formatSteps: (steps: number) => string;
};

const ICON: Record<StreakRescueOption['kind'], keyof typeof Ionicons.glyphMap> = {
  walk: 'walk-outline',
  activity: 'flash-outline',
  joker: 'shield-outline',
};

export function StreakRescue({ options, onWalk, onActivity, onJoker, busy = false, formatSteps }: Props) {
  const { t } = useTranslation();
  const stage = useStageTheme('home');

  return (
    <View style={styles.list}>
      {options.map((option, index) => {
        const main = index === 0;
        // Sur le verre, libellé ET détail à l'encre principale : c'est la seule mesurée sur les verres
        // mêlés aux lueurs (glassSurfaces, stage.test.ts).
        const ink = main ? stage.onSolid : stage.ink;
        const { label, detail, onPress } =
          option.kind === 'walk'
            ? {
                label: t('stage.home.rescue.walk', { minutes: option.minutes }),
                detail: t('stage.home.rescue.walkSub', { steps: formatSteps(option.stepsLeft) }),
                onPress: onWalk,
              }
            : option.kind === 'activity'
              ? {
                  label: t('stage.home.rescue.activity'),
                  detail: t('stage.home.rescue.activitySub'),
                  onPress: onActivity,
                }
              : {
                  label: t('stage.home.rescue.joker'),
                  detail: t('stage.home.rescue.jokerSub'),
                  onPress: onJoker,
                };
        return (
          <PressableScale
            key={option.kind}
            testID={`streak-rescue-${option.kind}`}
            haptic={main ? 'milestone' : 'confirm'}
            disabled={busy}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${label}. ${detail}`}
            accessibilityState={{ disabled: busy }}
            style={[
              styles.option,
              main
                ? { backgroundColor: stage.solid }
                : { backgroundColor: stage.glass, borderColor: stage.glassBorder, borderWidth: 1 },
              busy && styles.dimmed,
            ]}
          >
            {main && stage.solidGradient ? (
              <LinearGradient
                pointerEvents="none"
                colors={stage.solidGradient}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.gradient}
              />
            ) : null}
            <Ionicons name={ICON[option.kind]} size={20} color={ink} />
            <View style={styles.texts}>
              <Text style={[styles.label, { color: ink }]} numberOfLines={1}>
                {label}
              </Text>
              <Text style={[styles.detail, { color: ink }]} numberOfLines={2}>
                {detail}
              </Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  option: {
    minHeight: 58,
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  gradient: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 15 },
  texts: { flex: 1, gap: 1 },
  label: { fontFamily: fontFamily.bodyBold, fontSize: 14.5 },
  detail: { fontFamily: fontFamily.bodyMedium, fontSize: 12 },
  dimmed: { opacity: 0.55 },
});
