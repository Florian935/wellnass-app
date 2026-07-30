/**
 * Conteneur animé de célébration (décoratif) — US MUSC-F8 (roadmap 3.42).
 *
 * ── Origine ────────────────────────────────────────────────────────────────────────────────────────
 * Extrait de `CelebrationBanner` (`apps/mobile/src/app/run/summary.tsx`), qui existait déjà côté
 * course : fondu + léger zoom, 320 ms, `useNativeDriver`, aucun module natif. Son contenu (chips de
 * distances, libellés `running.records.*`) est **intégralement running** et n'a pas été extrait —
 * seul le conteneur, réutilisé ici pour la célébration muscu.
 *
 * ── Respect de « réduire les animations » ─────────────────────────────────────────────────────────
 * Nouveau par rapport à l'existant : la bannière course ne le gère pas. Si le réglage système est
 * actif, la carte s'affiche directement à son état final, sans transition — une animation est
 * toujours **décorative**, jamais porteuse d'information, donc son absence ne doit rien cacher.
 *
 * ── Pourquoi `useState` et pas `useRef` pour la valeur animée ─────────────────────────────────────
 * Patron du dépôt (voir `run/summary.tsx`) : sous React Compiler, lire une ref **pendant le rendu**
 * viole la règle de pureté. `Animated.Value` est créé une fois via `useState(() => …)`, jamais lu
 * hors effet.
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';

export function CelebrationCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  const [anim] = useState(() => new Animated.Value(0));
  // `null` = pas encore su. La lecture du réglage système est asynchrone ; démarrer l'animation
  // avant d'avoir la réponse ferait jouer `Animated.timing` une fois de trop si la réponse est
  // finalement « réduire les animations » — l'effet ci-dessous attend donc une valeur connue.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(enabled);
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return; // réglage pas encore connu : on attend, on ne joue rien
    if (reduceMotion) {
      // État final direct, sans transition : l'animation ne porte aucune information.
      anim.setValue(1);
      return;
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [anim, reduceMotion]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
