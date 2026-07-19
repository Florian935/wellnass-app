import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

// Bordeaux muscu — rôle fixe hors thème (identique à STRENGTH_COLOR de planning/index.tsx).
const STRENGTH_COLOR = '#6b0028';

type RestOverlayProps = {
  secondsLeft: number;
  onSkip: () => void;
  onExtend: () => void;
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
 * Overlay plein écran affiché pendant le repos entre deux séries.
 * Composant purement présentational : la minuterie (source de vérité) et ses
 * effets de bord (setInterval, vibration) sont gérés par le parent (`workout.tsx`).
 */
export function RestOverlay({ secondsLeft, onSkip, onExtend }: RestOverlayProps) {
  const { t } = useTranslation();

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('workout.restTitle')}</Text>
        <Text style={styles.countdown}>{formatSecondsLeft(secondsLeft, t)}</Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onSkip}
            style={({ pressed }) => [styles.button, styles.buttonOutline, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonLabel}>{t('workout.skipRest')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onExtend}
            style={({ pressed }) => [styles.button, styles.buttonSolid, pressed && styles.buttonPressed]}
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
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
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
  buttonSolid: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
