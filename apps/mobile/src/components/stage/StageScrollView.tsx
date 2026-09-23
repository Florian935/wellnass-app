/**
 * US DASH-01 — l'écran d'un pilier : la scène, puis le corps.
 *
 * La scène défile **normalement**, à la même vitesse que le corps : rien de ce qu'on lit ne se déplace
 * à une autre vitesse, ce n'est donc pas la parallaxe exclue par MOTION-01 §5.
 *
 * ── Plus d'en-tête compact (recette MUSCU-UX06, 23/09/2026) ──────────────────────────────────────
 * DASH-01 (D2) faisait apparaître, une fois la scène sortie de l'écran, un bandeau opaque à la
 * couleur du haut de la scène, porteur du titre et du chiffre clé. Retour de Florian sur le pilier
 * muscu passé au rouge fonte : « un espèce de bandeau tout en haut en rouge […] c'est super moche,
 * il faut enlever ça, garder la transparence en plein écran ». Le bandeau existait sur les **quatre**
 * écrans à scène (bleu vif sur la course, plus discret ailleurs parce que plus sombre) : il est
 * retiré partout, sur décision de Florian. Le corps défile désormais sous la barre d'état
 * transparente. `__tests__/stage.test.tsx` garde qu'il ne revienne pas.
 */

import type { ReactElement, ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { StageKey } from '@/theme/stage';
import { useTheme } from '@/theme/useTheme';
import { useStageTheme } from './PillarStage';

/** Hauteur sur laquelle la teinte de la scène s'éteint dans le corps de la page. */
const SPILL_HEIGHT = 200;

type Props = {
  pillar: StageKey;
  stage: ReactNode;
  children: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
  scrollEnabled?: boolean;
  bodyStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

export function StageScrollView({
  pillar,
  stage,
  children,
  refreshControl,
  scrollEnabled = true,
  bodyStyle,
  testID,
}: Props) {
  const { colors } = useTheme();
  const theme = useStageTheme(pillar);

  // La teinte du BAS de la scène : c'est elle qui coule, pas celle du haut.
  const spillColor = theme.gradient[theme.gradient.length - 1] ?? theme.surfaces[0]!;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID={testID}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
        refreshControl={refreshControl}
      >
        {stage}
        <View style={[styles.body, bodyStyle]}>
          {/* La scène ne s'arrête plus net : sa teinte du bas **coule** sur le haut du corps et
              s'éteint en ~200 px. Sans ça, la bande colorée et les cartes restaient deux mondes
              posés l'un sur l'autre — la moitié de l'effet « pas ISO » remonté en recette.
              Le départ n'est PAS à pleine opacité : les coins arrondis de la scène laissent voir la
              page, et une continuation opaque juste en dessous les aurait transformés en deux
              encoches inexplicables. À 0,72 la coulée se lit comme une lueur, pas comme un bloc. */}
          <LinearGradient
            pointerEvents="none"
            colors={[`${spillColor}b8`, `${spillColor}00`]}
            style={styles.spill}
          />
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, gap: 12 },
  // Décalée de la gouttière du corps pour couler sur toute la largeur, et derrière les cartes.
  spill: { position: 'absolute', top: 0, left: -20, right: -20, height: SPILL_HEIGHT },
});
