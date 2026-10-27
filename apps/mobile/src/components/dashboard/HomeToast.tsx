/**
 * US ACCUEIL-09 — **le toast de l'accueil** : la confirmation d'un geste noté sur place (le verre
 * d'eau de la feuille « Noter »), qui ne navigue nulle part et n'aurait sinon aucune trace à l'écran.
 *
 * Il monte du bas, reste 2,6 s, puis redescend (planche « Le mouvement »). Il est annoncé par les
 * lecteurs d'écran (`accessibilityLiveRegion`), et ne capte aucun appui : il se pose au-dessus du
 * « + » sans le masquer. Animations réduites : il apparaît et disparaît sans glisser.
 */

import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { DURATION } from '@/theme/motion';
import { fontFamily } from '@/theme/fonts';

/** Le temps d'un toast à l'écran. */
export const HOME_TOAST_MS = 2600;

type Props = {
  /** Le message, ou `null` : rien à l'écran. */
  message: string | null;
  /** Le toast a fini son temps. */
  onHide: () => void;
};

export function HomeToast({ message, onHide }: Props) {
  const reduced = useAppReducedMotion();

  // Le minuteur ne suit que le MESSAGE : un nouveau rendu de l'écran (une nouvelle fonction `onHide`)
  // ne doit pas prolonger le toast au-delà de ses 2,6 s.
  useEffect(() => {
    if (message === null) return;
    const timer = setTimeout(onHide, HOME_TOAST_MS);
    return () => clearTimeout(timer);
  }, [message]); // eslint-disable-line react-hooks/exhaustive-deps

  if (message === null) return null;

  return (
    <Animated.View
      key={message}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      testID="home-toast"
      style={styles.toast}
      entering={reduced ? undefined : FadeInDown.duration(DURATION.base)}
      exiting={reduced ? undefined : FadeOutDown.duration(DURATION.base)}
    >
      <Ionicons name="checkmark-circle" size={18} color="#5eead4" />
      <Text style={styles.label} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 86,
    bottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    // La nuit de la carte du moment : l'encre claire y est mesurée (HOME_PANEL, stage.test.ts).
    backgroundColor: '#141a2e',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  label: { flex: 1, color: '#eef1fb', fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
});
