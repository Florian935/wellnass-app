/**
 * Le plein écran de record — US MUSCU-UX03, spec §5.4.
 *
 * ── Pourquoi il prend tout l'écran, et pourquoi une seule fois ─────────────────────────────────
 * Battre sa charge maximale est l'événement le plus rare et le plus marquant d'une séance. Jusqu'ici
 * on l'apprenait au bilan, une fois l'émotion retombée. Il arrive donc **pendant le repos**, en
 * grand — mais **au plus une fois par séance** : la deuxième célébration plein écran ferait de la
 * première une animation de plus. Les records suivants se contentent de la pastille ambre.
 *
 * Le repos continue **dessous** : la minuterie n'est pas suspendue, un toucher renvoie au repos, et
 * elle se ferme d'elle-même au bout de 2,6 s. Rien de ce qui est ici n'est bloquant.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import type { LiveRecord } from '@wellness/shared';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { RECORD_AMBER, RECORD_BG } from '@/components/workout/immersive/theme';
import type { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { SPRING } from '@/theme/motion';

/** Durée d'affichage avant fermeture automatique (spec §5.4). */
const AUTO_CLOSE_MS = 2600;

type Props = {
  record: LiveRecord;
  exerciseName: string;
  units: ReturnType<typeof useUnits>;
  onClose: () => void;
};

export function RecordTakeover({ record, exerciseName, units, onClose }: Props) {
  const { t } = useTranslation();
  const reduced = useAppReducedMotion();

  const scale = useSharedValue(reduced ? 1 : 0.6);

  useEffect(() => {
    if (!reduced) scale.value = withSpring(1, SPRING.pop);
    const id = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(id);
  }, [onClose, reduced, scale]);

  const coreStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('immersive.record.close')}
      onPress={onClose}
      style={[StyleSheet.absoluteFill, styles.backdrop, { backgroundColor: RECORD_BG }]}
    >
      {/* Deux ondes décalées : c'est le seul ornement de l'écran, et il dure moins longtemps que
          le texte qu'il entoure. */}
      <Wave delay={0} reduced={reduced} />
      <Wave delay={260} reduced={reduced} />

      <Animated.View style={[styles.core, coreStyle]}>
        <Ionicons name="trophy" size={44} color={RECORD_AMBER} />
        <Text style={[styles.title, { color: RECORD_AMBER }]}>{t('immersive.record.title')}</Text>
        <Text style={styles.value}>{units.formatWeight(record.value)}</Text>
        <Text style={styles.exercise} numberOfLines={2}>
          {exerciseName}
        </Text>
        <Text style={styles.previous}>
          {t('immersive.record.previous', { weight: units.formatWeight(record.previous) })}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/** Une onde qui s'écarte et s'efface. Purement décorative : coupée avec les animations réduites. */
function Wave({ delay, reduced }: { delay: number; reduced: boolean }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }),
    );
  }, [delay, progress, reduced]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - progress.value),
    transform: [{ scale: 0.6 + progress.value * 1.5 }],
  }));

  if (reduced) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.wave, { borderColor: RECORD_AMBER }, style]} />
  );
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', justifyContent: 'center', zIndex: 40, padding: 28 },
  wave: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 2 },
  core: { alignItems: 'center', gap: 4 },
  title: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 10,
  },
  value: {
    fontFamily: fontFamily.displayXBold,
    fontSize: 68,
    letterSpacing: -2.5,
    color: '#fffcf5',
  },
  exercise: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 18,
    color: '#fffcf5',
    textAlign: 'center',
  },
  previous: { fontFamily: fontFamily.mono, fontSize: 13, color: '#fffcf5cc', marginTop: 8 },
});

/** Durée d'affichage, exportée pour les tests et pour le pilotage depuis l'écran de séance. */
export const RECORD_TAKEOVER_MS = AUTO_CLOSE_MS;
