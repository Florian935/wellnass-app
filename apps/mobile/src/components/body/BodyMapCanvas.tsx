/**
 * Le **dessin** du schéma corporel — sans thème, sans i18n, sans données.
 *
 * ── Pourquoi il est séparé de `BodyMap` ─────────────────────────────────────────────────────────
 * `BodyMap` lit le thème (`useTheme`) et la langue, et ces deux-là tirent derrière eux le
 * repository de réglages et l'instance i18next. C'est sans conséquence dans un écran — mais la
 * **carte à partager** (US MUSCU-UX03, §5.13) est capturée hors contexte, avec des couleurs
 * imposées et une palette qui ne doit pas suivre le thème de l'app : lui faire traverser cette
 * chaîne d'imports n'avait aucun sens, et la rendait intestable isolément.
 *
 * Ici, tout arrive en prop. Aucun changement de rendu : `BodyMap` n'est plus qu'un habillage qui
 * lui passe les couleurs du thème et les libellés traduits.
 *
 * Coordonnées reprises de la maquette validée
 * (design/muscf1b-schema-muscles/muscf1b-schema-muscles.html) — pas redessinées ici, le calage
 * anatomique a déjà été relu sur le dessin.
 */

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import { FINE_MUSCLES, FINE_MUSCLE_VIEWS, type FineMuscle } from '@wellness/shared';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { fontFamily } from '@/theme/fonts';
import { DURATION } from '@/theme/motion';

/**
 * Chaleur par muscle, 0 → 1 (US MUSCU-UX03, spec §5.11). **Facultative** : sans elle, le schéma
 * rend exactement comme avant (deux niveaux `full` / `reduced`), ce que font ses trois points de
 * montage historiques — fiche d'exercice, aperçu de séance, bilan hebdo.
 */
export type BodyHeat = Partial<Record<FineMuscle, number>>;

/** Couleurs imposées par l'appelant : ce composant n'en connaît aucune. */
export type BodyMapColors = { neutral: string; accent: string; caption: string };

/** viewBox partagé par les deux vues (repris tel quel de la maquette). */
const VIEW_BOX = '0 0 112 188';

/** Émphase réduite (repli large, secondaires) — R1 : deux niveaux, pas de 3ᵉ (illisible). */
const REDUCED_OPACITY = 0.35;

/** Au-delà de cette chaleur, le muscle gagne un halo (spec §5.11). */
const HALO_THRESHOLD = 0.45;

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Tracé de chaque muscle fin — `d` du `<Path>`, un ou deux sous-tracés (M…z) pour les muscles
 * bilatéraux (épaules, biceps, triceps, fessiers, quadriceps, ischio-jambiers, mollets).
 * Régions reprises de la maquette (rectangles à main levée, pas une planche d'anatomie complète —
 * le niveau de détail assumé par le produit, spec §1).
 */
// ⚠️ Exporté pour `PainBodyMap` (US DOUL-01), qui réutilise la **géométrie** sans rendre ce
// composant-ci interactif : trois écrans en dépendent (`exercises/[id]`, `programs/[id]`, `review`),
// dont deux appartiennent à des US en recette. Un fichier de plus vaut mieux qu'une régression sur
// des écrans qui marchent.
export const MUSCLE_PATHS: Record<FineMuscle, string> = {
  chest: 'M34 48h44v30H34z',
  back: 'M34 48h44v34H34z',
  shoulders: 'M24 46h14v12H24z M74 46h14v12H74z',
  biceps: 'M22 58h11v46H22z M79 58h11v46H79z',
  triceps: 'M22 58h11v46H22z M79 58h11v46H79z',
  abs: 'M38 78h36v30H38z',
  glutes: 'M40 110h14v16H40z M58 110h14v16H58z',
  quadriceps: 'M40 110h14v72H40z M58 110h14v72H58z',
  hamstrings: 'M40 126h14v30H40z M58 126h14v30H58z',
  calves: 'M40 156h14v26H40z M58 156h14v26H58z',
};

/** Muscles à tracer par vue — dérivé de `FINE_MUSCLE_VIEWS`, une seule source de vérité (spec §1). */
const FRONT_MUSCLES = FINE_MUSCLES.filter((m) => FINE_MUSCLE_VIEWS[m].includes('front'));
const BACK_MUSCLES = FINE_MUSCLES.filter((m) => FINE_MUSCLE_VIEWS[m].includes('back'));

/**
 * Le halo du muscle qui vient de chauffer — une pulsation, **une seule fois** (spec §5.11).
 *
 * C'est un contour, pas un flou : `react-native-svg` n'a pas de filtre de flou fiable sur Android,
 * et un trait épais à faible opacité donne la même lecture périphérique pour un coût nul.
 */
function Halo({ d, color, pulsing }: { d: string; color: string; pulsing: boolean }) {
  const reduced = useAppReducedMotion();
  const opacity = useSharedValue(0.34);

  useEffect(() => {
    if (!pulsing || reduced) return;
    opacity.value = withSequence(
      withTiming(0.85, { duration: DURATION.quick }),
      withTiming(0.34, { duration: DURATION.celebrate }),
    );
  }, [opacity, pulsing, reduced]);

  const animatedProps = useAnimatedProps(() => ({ strokeOpacity: opacity.value }));

  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={4}
      animatedProps={animatedProps}
      strokeOpacity={0.34}
    />
  );
}

/** Une des deux vues (face ou dos) — silhouette commune (tête, cou) + tracés propres à la vue. */
function BodyView({
  muscles,
  full,
  reduced,
  neutralFill,
  accentFill,
  heat,
  heatColor,
  height,
  pulse,
}: {
  muscles: FineMuscle[];
  full: FineMuscle[];
  reduced: FineMuscle[];
  neutralFill: string;
  accentFill: string;
  heat?: BodyHeat;
  heatColor?: (value: number) => string;
  height: number;
  pulse?: FineMuscle | null;
}) {
  return (
    <Svg width={(height * 100) / 168} height={height} viewBox={VIEW_BOX} accessible={false}>
      <Ellipse cx={56} cy={20} rx={13} ry={15} fill={neutralFill} />
      <Rect x={42} y={37} width={28} height={10} rx={4} fill={neutralFill} />
      {muscles.map((muscle) => {
        // Mode chaleur : le dégradé porte l'information, `full` / `reduced` ne servent plus.
        if (heat && heatColor) {
          const value = heat[muscle] ?? 0;
          return (
            <Path
              key={muscle}
              d={MUSCLE_PATHS[muscle]}
              fill={value > 0 ? heatColor(value) : neutralFill}
            />
          );
        }
        const isFull = full.includes(muscle);
        const isReduced = !isFull && reduced.includes(muscle);
        return (
          <Path
            key={muscle}
            d={MUSCLE_PATHS[muscle]}
            fill={isFull || isReduced ? accentFill : neutralFill}
            opacity={isReduced ? REDUCED_OPACITY : 1}
          />
        );
      })}
      {/* Les halos passent **après** les remplissages : sinon un muscle voisin les recouvrirait. */}
      {heat && heatColor
        ? muscles
            .filter((muscle) => (heat[muscle] ?? 0) > HALO_THRESHOLD)
            .map((muscle) => (
              <Halo
                key={`halo-${muscle}`}
                d={MUSCLE_PATHS[muscle]}
                color={heatColor(heat[muscle] ?? 0)}
                pulsing={pulse === muscle}
              />
            ))
        : null}
    </Svg>
  );
}

export type BodyMapCanvasProps = {
  full: FineMuscle[];
  reduced: FineMuscle[];
  /**
   * Quand elle est fournie, la chaleur **remplace** `full` / `reduced` pour le remplissage : un
   * muscle se colore parce qu'il a été travaillé aujourd'hui, plus parce qu'il figure dans la
   * fiche de l'exercice.
   */
  heat?: BodyHeat;
  /** Convertit une chaleur en couleur. Requis dès que `heat` est passée. */
  heatColor?: (heat: number) => string;
  colors: BodyMapColors;
  /** Hauteur d'une silhouette (168 = la taille historique). */
  height?: number;
  /** Muscle qui vient d'être réchauffé : son halo pulse une fois. */
  pulse?: FineMuscle | null;
  /** Légendes des deux vues, déjà traduites. `null` = aucune légende (carte à partager). */
  frontLabel: string | null;
  backLabel: string | null;
  /** Énoncé lu par les lecteurs d'écran, déjà composé. */
  a11yLabel: string;
};

/** Deux silhouettes côte à côte (face puis dos). Ne lit rien : tout arrive en prop. */
export function BodyMapCanvas({
  full,
  reduced,
  heat,
  heatColor,
  colors,
  height = 168,
  pulse = null,
  frontLabel,
  backLabel,
  a11yLabel,
}: BodyMapCanvasProps) {
  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel={a11yLabel}>
      <View style={styles.view}>
        <BodyView
          muscles={FRONT_MUSCLES}
          full={full}
          reduced={reduced}
          neutralFill={colors.neutral}
          accentFill={colors.accent}
          heat={heat}
          heatColor={heatColor}
          height={height}
          pulse={pulse}
        />
        {frontLabel ? (
          <Text style={[styles.caption, { color: colors.caption }]}>{frontLabel}</Text>
        ) : null}
      </View>
      <View style={styles.view}>
        <BodyView
          muscles={BACK_MUSCLES}
          full={full}
          reduced={reduced}
          neutralFill={colors.neutral}
          accentFill={colors.accent}
          heat={heat}
          heatColor={heatColor}
          height={height}
          pulse={pulse}
        />
        {backLabel ? (
          <Text style={[styles.caption, { color: colors.caption }]}>{backLabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  view: { alignItems: 'center', gap: 4 },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
