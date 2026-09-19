/**
 * US DASH-01 — la matière de la musculation : la silhouette, et les muscles de la séance qui
 * encaissent un impact (physique « impact »).
 *
 * ── Le correctif D6 ───────────────────────────────────────────────────────────────────────────────
 * La maquette faisait clignoter les muscles **deux fois, en boucle** (0,22 → 0,92 → 0,5 → 0,8 en 450 ms,
 * toutes les 2,6 s) : relu sur device, ça ressemblait à un néon qui grésille, donc à un bug. L'impact
 * joue désormais **une seule fois**, à l'arrivée sur l'écran (`play` passe à vrai), puis se pose. Montée
 * courte, retour amorti sans rebond visible : le geste est fini quand l'œil arrive.
 *
 * ── Le corps redessiné (recette du 19/09/2026) ────────────────────────────────────────────────────
 * Le premier tracé était un mannequin : segments rectangulaires séparés par des trous, arêtes
 * droites, tête posée à côté du buste. « C'est tout carré, c'est tout segmenté. »
 *
 * Trois règles portent le nouveau tracé :
 *  1. **Un canon 7,5 têtes** — sommet du crâne y=6, menton 31, épaules 44, taille 90, entrejambe
 *     100 (la mi-hauteur exacte), genou 145, cheville 186. L'ancien mettait l'entrejambe à 126 sur
 *     190 : des jambes trop courtes sous un buste trop large, d'où la silhouette trapue.
 *  2. **Des formes qui se chevauchent sous un même remplissage.** Les trous d'avant venaient de
 *     pièces posées bout à bout. Ici le cou est noyé dans les trapèzes, les bras dans les
 *     deltoïdes, les jambes dans le bassin : aucune couture ne peut apparaître.
 *  3. **Que des courbes** (`C`) — pas une seule arête droite dans tout le corps.
 *
 * Les zones musculaires sont **détourées par le corps** (`ClipPath`) : elles ne peuvent pas
 * déborder, donc rien ne flotte à côté de la silhouette. La poitrine est une seule masse et non
 * deux pectoraux jumeaux : côte à côte, ils laissaient au sternum une fente terminée en pointe,
 * qui se lisait comme une découpe.
 */

import { useEffect, useId } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Ellipse, G, Path } from 'react-native-svg';
import { useAppReducedMotion } from '@/hooks/useAppReducedMotion';
import { SPRING } from '@/theme/motion';
import { BODY_PATHS, HEAD, ZONE_PATHS, type SilhouetteZone } from './silhouette-paths';

const AnimatedG = Animated.createAnimatedComponent(G);

export type { SilhouetteZone };

const REST_OPACITY = 0.38;
const PEAK_OPACITY = 0.9;

/** Le corps : tête, cou, buste, deux bras, deux jambes. Sert aussi de détourage aux zones. */
export function Body() {
  return (
    <>
      <Ellipse cx={HEAD.cx} cy={HEAD.cy} rx={HEAD.rx} ry={HEAD.ry} />
      {BODY_PATHS.map((d) => (
        <Path key={d.slice(0, 16)} d={d} />
      ))}
    </>
  );
}

type Props = { zones: readonly SilhouetteZone[]; play: boolean; color: string };

export function ImpactSilhouette({ zones, play, color }: Props) {
  const reduced = useAppReducedMotion();
  const glow = useSharedValue(REST_OPACITY);
  // Un id de détourage unique par instance — même patron que `BodyShapeFigure`. Deux silhouettes
  // montées en même temps (onglets conservés vivants par Expo Router) partageraient sinon le même
  // `url(#…)`.
  const clipId = `silho${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  useEffect(() => {
    if (!play || reduced) {
      glow.value = REST_OPACITY;
      return;
    }
    glow.value = withSequence(
      withTiming(PEAK_OPACITY, { duration: 140 }),
      withSpring(REST_OPACITY, SPRING.settle),
    );
  }, [glow, play, reduced]);

  const glowProps = useAnimatedProps(() => ({ opacity: glow.value }));

  return (
    <Svg width={176} height={280} viewBox="0 0 120 200" style={styles.silhouette}>
      <Defs>
        <ClipPath id={clipId}>
          <Body />
        </ClipPath>
      </Defs>

      <G fill="#ffffff" opacity={0.1}>
        <Body />
      </G>

      <AnimatedG fill={color} animatedProps={glowProps} clipPath={`url(#${clipId})`}>
        {zones.flatMap((zone) =>
          ZONE_PATHS[zone].map((d) => <Path key={`${zone}-${d.slice(0, 12)}`} d={d} />),
        )}
      </AnimatedG>
    </Svg>
  );
}

const styles = StyleSheet.create({
  silhouette: { position: 'absolute', right: -22, top: 22, opacity: 0.6 },
});
