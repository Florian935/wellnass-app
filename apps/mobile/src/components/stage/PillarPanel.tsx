/**
 * US CARDIO-UX02 — **le panneau de pilier** : la couleur du pilier, une deuxième fois, dans le corps
 * de la page.
 *
 * ── Le défaut que ça corrige ─────────────────────────────────────────────────────────────────────
 * MUSCU-UX04 a donné une palette à chaque pilier (`theme/pillar.ts`) : surfaces teintées et accent.
 * Ça suffit pour les teintes **chaudes** — le brun glisse vers le bordeaux et toute la page a l'air
 * muscu. Ça ne suffit pas pour le bleu : à luminance conservée, une teinte froide posée sur un brun
 * sombre produit un gris-bleu (voir la table mesurée dans `theme/pillar.ts`). Résultat, sur le
 * pilier Course, la seule surface franchement bleue de l'écran était la **scène**, et tout ce qui
 * venait après retombait dans le neutre. C'est exactement ce que décrivait Florian : « le héros est
 * super cool avec ce petit bleu, le problème c'est que ce n'est pas repris sur le reste ».
 *
 * Monter le gain de teinte règle la moitié du problème (les surfaces cessent d'être grises), pas
 * l'autre moitié : **il manquait une grande surface colorée**. Le panneau est cette surface. Il
 * reprend le dégradé de la scène, ses encres et son verre, et il est réservé à **une** carte par
 * écran — la carte dominante. Deux panneaux sur une page annuleraient l'effet : ce qui est partout
 * ne hiérarchise rien.
 *
 * ── Ce que le panneau n'est pas ──────────────────────────────────────────────────────────────────
 * Ce n'est pas une `Card` colorée : ses encres ne viennent **pas** de la palette (`colors.text`
 * serait illisible sur un bleu profond) mais de `stageTheme`, dont chaque couple est mesuré par
 * `theme/__tests__/stage.test.ts` contre toutes les teintes du dégradé. Un contenu posé ici doit
 * donc recevoir ses couleurs par `usePanelInk()`, jamais les lire dans `useTheme()`.
 */

import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale } from '@/components/motion/PressableScale';
import { fontFamily } from '@/theme/fonts';
import { stageTheme, type StageKey, type StageTheme } from '@/theme/stage';
import { useTheme } from '@/theme/useTheme';

/**
 * Les encres à employer **dans** un panneau. Identiques à celles de la scène du même pilier : une
 * seule table de couples mesurés, donc aucune divergence possible entre le haut et le milieu de la
 * page.
 */
export function usePanelInk(pillar: StageKey): StageTheme {
  const { scheme } = useTheme();
  return stageTheme(pillar, scheme);
}

type Props = {
  pillar: StageKey;
  title: string;
  meta?: string;
  children?: ReactNode;
  onPress?: () => void;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function PillarPanel({
  pillar,
  title,
  meta,
  children,
  onPress,
  accessibilityHint,
  style,
  testID,
}: Props) {
  const ink = usePanelInk(pillar);

  const content = (
    <>
      {/* Le dégradé est posé en fond absolu, comme sur la scène : le contenu reste au-dessus sans
          avoir à connaître la mécanique. */}
      <LinearGradient
        colors={ink.gradient}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={[StyleSheet.absoluteFill, styles.gradient]}
      />
      <View style={styles.header}>
        <Text style={[styles.title, { color: ink.ink }]} numberOfLines={2}>
          {title}
        </Text>
        {meta ? (
          <Text style={[styles.meta, { color: ink.inkMuted }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {onPress ? <Ionicons name="chevron-forward" size={16} color={ink.inkMuted} /> : null}
      </View>
      {children}
    </>
  );

  // La bordure reprend celle du verre de la scène : sans elle, le panneau se confond avec le fond
  // de page en thème sombre, où les deux sont déjà proches.
  const frame = [styles.panel, { backgroundColor: ink.surfaces[0], borderColor: ink.glassBorder }, style];

  if (onPress) {
    return (
      <PressableScale
        testID={testID}
        haptic="select"
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        style={frame}
      >
        {content}
      </PressableScale>
    );
  }

  return (
    <View testID={testID} style={frame}>
      {content}
    </View>
  );
}

/** Un encart translucide **dans** le panneau (chiffre secondaire, cellule, pastille). */
export function PanelGlass({
  ink,
  children,
  style,
}: {
  ink: StageTheme;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.glass, { backgroundColor: ink.glass, borderColor: ink.glassBorder }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // Mêmes rayon et rythme que `Card` / `DenseTile` : le panneau se distingue par sa couleur, pas
  // par sa forme — R5 de MUSCU-UX05 (« le rythme n'est pas cassé en variant les rayons »).
  panel: { borderRadius: 22, borderWidth: 1, padding: 18, gap: 12, overflow: 'hidden' },
  gradient: { borderRadius: 22 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: fontFamily.displayBold, fontSize: 15, letterSpacing: -0.3 },
  meta: { fontFamily: fontFamily.mono, fontSize: 11 },
  glass: { borderRadius: 14, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
});
