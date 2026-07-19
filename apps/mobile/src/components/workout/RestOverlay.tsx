import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

// Bordeaux muscu — rôle fixe hors thème (identité de l'écran de repos).
const STRENGTH_COLOR = '#6b0028';

type RestOverlayProps = {
  secondsLeft: number;
  /** Replié = barre compacte en bas (n'obstrue pas la séance) ; sinon plein écran. */
  collapsed: boolean;
  onSkip: () => void;
  onExtend: () => void;
  onToggleCollapse: () => void;
};

/** Formate un nombre de secondes en `m:ss` (≥ 60s) ou `{n} s` sinon. */
function formatSecondsLeft(seconds: number, t: (key: string, options?: Record<string, unknown>) => string): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  if (safeSeconds < 60) {
    return t('workout.restRemaining', { seconds: safeSeconds });
  }
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

/**
 * Repos entre deux séries. Deux rendus pilotés par `collapsed` :
 *  - plein écran (compte à rebours + Passer / Prolonger + Réduire) ;
 *  - barre compacte en bas (continue de tourner, tap pour ré-agrandir, Passer dispo)
 *    qui laisse la séance manipulable derrière.
 * Composant présentational : la minuterie (source de vérité), la vibration et l'état
 * `collapsed` sont gérés par le parent (`workout.tsx`).
 */
export function RestOverlay({ secondsLeft, collapsed, onSkip, onExtend, onToggleCollapse }: RestOverlayProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const countdown = formatSecondsLeft(secondsLeft, t);

  if (collapsed) {
    return (
      <View style={styles.collapsedBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workout.restTitle')}
          onPress={onToggleCollapse}
          style={({ pressed }) => [styles.collapsedMain, pressed && styles.pressed]}
        >
          <Ionicons name="timer-outline" size={18} color="#ffffff" />
          <Text style={styles.collapsedText}>{`${t('workout.restTitle')} · ${countdown}`}</Text>
          <Ionicons name="chevron-up" size={18} color="#ffffff" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onSkip}
          style={({ pressed }) => [styles.collapsedSkip, pressed && styles.pressed]}
        >
          <Text style={styles.collapsedSkipLabel}>{t('workout.skipRest')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('workout.restCollapse')}
        onPress={onToggleCollapse}
        hitSlop={12}
        style={({ pressed }) => [styles.collapseBtn, { top: insets.top + 12 }, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-down" size={26} color="#ffffff" />
      </Pressable>
      <View style={styles.content}>
        <Text style={styles.title}>{t('workout.restTitle')}</Text>
        <Text style={styles.countdown}>{countdown}</Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onSkip}
            style={({ pressed }) => [styles.button, styles.buttonOutline, pressed && styles.pressed]}
          >
            <Text style={styles.buttonLabel}>{t('workout.skipRest')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onExtend}
            style={({ pressed }) => [styles.button, styles.buttonSolid, pressed && styles.pressed]}
          >
            <Text style={styles.buttonLabel}>{t('workout.restExtend')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: STRENGTH_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  // `top` est fourni en inline (safe-area) pour ne pas chevaucher la barre d'état.
  collapseBtn: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    zIndex: 11,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  title: {
    color: '#ffffff',
    opacity: 0.7,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  countdown: {
    color: '#ffffff',
    fontSize: 64,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  button: {
    minHeight: 52,
    minWidth: 120,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  buttonSolid: { backgroundColor: 'rgba(255, 255, 255, 0.16)' },
  buttonLabel: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  // Barre compacte (repos replié)
  collapsedBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: STRENGTH_COLOR,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  collapsedMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  collapsedText: { flex: 1, color: '#ffffff', fontWeight: '700', fontSize: 15, fontVariant: ['tabular-nums'] },
  collapsedSkip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  collapsedSkipLabel: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  pressed: { opacity: 0.7 },
});
