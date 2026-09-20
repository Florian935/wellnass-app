/**
 * US DASH-01 — l'écran d'un pilier : la scène, puis le corps, et le repli au défilement (D2).
 *
 * ── Ce que le repli est, et ce qu'il n'est pas ────────────────────────────────────────────────────
 * La scène défile **normalement**, à la même vitesse que le corps : rien de ce qu'on lit ne se déplace
 * à une autre vitesse, ce n'est donc pas la parallaxe exclue par MOTION-01 §5. Quand elle sort de
 * l'écran, un en-tête compact apparaît en haut, porteur du titre et du chiffre clé : on garde le
 * contexte sans sacrifier la place des données.
 *
 * Le calcul tourne sur le thread UI (`useAnimatedScrollHandler`, R3). Mouvement coupé : l'en-tête
 * apparaît d'un coup au franchissement du seuil, sans fondu (R1).
 */

import { useState, type ReactElement, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { fontFamily } from '@/theme/fonts';
import type { StageKey } from '@/theme/stage';
import { useTheme } from '@/theme/useTheme';
import { useStageTheme } from './PillarStage';

const COMPACT_BAR_HEIGHT = 52;
/** Hauteur du dégradé posé SOUS la barre compacte, pour que le contenu n'y soit pas tranché net. */
const COMPACT_FADE_HEIGHT = 20;
const FADE_SPAN = 36;
/** Hauteur sur laquelle la teinte de la scène s'éteint dans le corps de la page. */
const SPILL_HEIGHT = 200;

type Props = {
  pillar: StageKey;
  stage: ReactNode;
  compactTitle: string;
  compactValue?: string;
  children: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
  scrollEnabled?: boolean;
  bodyStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

export function StageScrollView({
  pillar,
  stage,
  compactTitle,
  compactValue,
  children,
  refreshControl,
  scrollEnabled = true,
  bodyStyle,
  testID,
}: Props) {
  const { colors } = useTheme();
  const theme = useStageTheme(pillar);
  const insets = useSafeAreaInsets();
  const reduced = useAppReducedMotion();
  const scrollY = useSharedValue(0);
  const [stageHeight, setStageHeight] = useState(0);
  const [compactVisible, setCompactVisible] = useState(false);

  // Seuil : la scène est presque entièrement sortie, sous la barre compacte.
  const threshold = Math.max(0, stageHeight - insets.top - COMPACT_BAR_HEIGHT - 12);

  // La teinte du BAS de la scène : c'est elle qui coule, pas celle du haut.
  const spillColor = theme.gradient[theme.gradient.length - 1] ?? theme.surfaces[0]!;

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const headerStyle = useAnimatedStyle(() => {
    const p = reduced
      ? scrollY.value >= threshold && threshold > 0
        ? 1
        : 0
      : interpolate(scrollY.value, [threshold - FADE_SPAN, threshold], [0, 1], Extrapolation.CLAMP);
    return { opacity: stageHeight === 0 ? 0 : p, transform: [{ translateY: (1 - p) * -6 }] };
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID={testID}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) =>
          setCompactVisible(e.nativeEvent.contentOffset.y >= threshold && threshold > 0)
        }
        onScrollEndDrag={(e) =>
          setCompactVisible(e.nativeEvent.contentOffset.y >= threshold && threshold > 0)
        }
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
        refreshControl={refreshControl}
      >
        <View onLayout={(e) => setStageHeight(e.nativeEvent.layout.height)}>{stage}</View>
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
      </Animated.ScrollView>

      <Animated.View
        testID="stage-compact-header"
        pointerEvents="none"
        // Invisible pour l'œil tant que la scène est dépliée : il doit l'être aussi pour TalkBack.
        importantForAccessibility={compactVisible ? 'auto' : 'no-hide-descendants'}
        accessibilityElementsHidden={!compactVisible}
        style={[
          styles.compact,
          {
            paddingTop: insets.top,
            height: insets.top + COMPACT_BAR_HEIGHT,
            backgroundColor: theme.surfaces[0],
          },
          headerStyle,
        ]}
      >
        <Text style={[styles.compactTitle, { color: theme.ink }]} numberOfLines={1}>
          {compactTitle}
        </Text>
        {compactValue ? (
          <Text style={[styles.compactValue, { color: theme.ink }]} numberOfLines={1}>
            {compactValue}
          </Text>
        ) : null}
      </Animated.View>

      {/*
        US NUTRI-UX02 — le bord du contenu qui passe SOUS la barre.

        La barre compacte est opaque, et le corps défile dessous : le contenu était donc tranché
        net, à la règle. Sur une carte qui porte une courbe (le Réservoir), on lit un fragment
        coupé au cutter, sans comprendre qu'il continue derrière.

        🔴 Ce n'est **pas** un fondu sur la barre : R1 de DASH-01 impose qu'elle apparaisse d'un
        coup, et elle le fait toujours (`headerStyle`, partagé). C'est une **bordure** dégradée
        posée sous elle, qui suit sa visibilité. La distinction compte : ce qui est interdit, c'est
        que l'en-tête se fonde en arrivant, pas que son bord inférieur soit adouci.

        L'opacité de départ est de 85 %, et pas 100, pour la raison déjà rencontrée sur `spill` :
        la barre a des coins arrondis en bas, et un rectangle opaque juste en dessous les
        remplirait — transformant l'arrondi en deux encoches inexplicables.
      */}
      <Animated.View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.compactFade,
          { top: insets.top + COMPACT_BAR_HEIGHT, height: COMPACT_FADE_HEIGHT },
          headerStyle,
        ]}
      >
        <LinearGradient
          colors={[`${theme.surfaces[0]}d9`, `${theme.surfaces[0]}00`]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, gap: 12 },
  // Décalée de la gouttière du corps pour couler sur toute la largeur, et derrière les cartes.
  spill: { position: 'absolute', top: 0, left: -20, right: -20, height: SPILL_HEIGHT },
  compact: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  compactTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 17,
    letterSpacing: -0.4,
    flexShrink: 1,
  },
  compactValue: { fontFamily: fontFamily.displayXBold, fontSize: 17, letterSpacing: -0.4 },
  compactFade: { position: 'absolute', left: 0, right: 0 },
});
