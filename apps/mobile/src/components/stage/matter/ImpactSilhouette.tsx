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

const AnimatedG = Animated.createAnimatedComponent(G);

export type SilhouetteZone = 'chest' | 'shoulders' | 'arms' | 'back' | 'legs' | 'core';

const REST_OPACITY = 0.38;
const PEAK_OPACITY = 0.9;

/** Le corps : tête, cou, buste, deux bras, deux jambes. Sert aussi de détourage aux zones. */
function Body() {
  return (
    <>
      <Ellipse cx={60} cy={18.5} rx={10.5} ry={12.5} />
      <Path
        d={'M54 27 C 54 33, 53.5 37, 52.5 41 C 57.5 43, 62.5 43, 67.5 41 C 66.5 37, 66 33, 66 27 Z'}
      />
      <Path
        d={
          'M60 36 C 67 36, 73 38.5, 77.5 42 C 82 45, 85 50, 85 56 C 85 63, 83.5 70, 82 77 C 80.5 83, 78 88, 77.5 93 C 77 97, 79 101, 79.5 105 C 79.5 108, 77 110.5, 73 110.5 C 68 110.5, 64 106, 60 100 C 56 106, 52 110.5, 47 110.5 C 43 110.5, 40.5 108, 40.5 105 C 41 101, 43 97, 42.5 93 C 42 88, 39.5 83, 38 77 C 36.5 70, 35 63, 35 56 C 35 50, 38 45, 42.5 42 C 47 38.5, 53 36, 60 36 Z'
        }
      />
      <Path
        d={
          'M37 46 C 32 49, 29.5 54, 29.5 61 C 29.5 68, 29 75, 28 82 C 27 90, 26 98, 25 106 C 24.2 112, 23.5 118, 23.5 123 C 23.5 128, 25.5 130.5, 28 130.5 C 30.5 130.5, 32.2 128, 32 123.5 C 32 118, 32.5 112, 33.5 106 C 34.5 98, 35.5 90, 36.5 82 C 37.5 74, 38.5 66, 39.5 59 C 40 54, 39.5 49, 37 46 Z'
        }
      />
      <Path
        d={
          'M83 46 C 88 49, 90.5 54, 90.5 61 C 90.5 68, 91 75, 92 82 C 93 90, 94 98, 95 106 C 95.8 112, 96.5 118, 96.5 123 C 96.5 128, 94.5 130.5, 92 130.5 C 89.5 130.5, 87.8 128, 88 123.5 C 88 118, 87.5 112, 86.5 106 C 85.5 98, 84.5 90, 83.5 82 C 82.5 74, 81.5 66, 80.5 59 C 80 54, 80.5 49, 83 46 Z'
        }
      />
      <Path
        d={
          'M41 104 C 39 116, 38.5 128, 39.5 140 C 40 150, 40.5 158, 41 166 C 41.3 174, 41.5 182, 42 187 C 42.3 192, 44 194.5, 47 194.5 C 50 194.5, 51.5 192, 51.3 187 C 51 179, 51 171, 51.3 163 C 51.8 154, 52.5 145, 53.5 136 C 55 124, 57 112, 58 101 Z'
        }
      />
      <Path
        d={
          'M79 104 C 81 116, 81.5 128, 80.5 140 C 80 150, 79.5 158, 79 166 C 78.7 174, 78.5 182, 78 187 C 77.7 192, 76 194.5, 73 194.5 C 70 194.5, 68.5 192, 68.7 187 C 69 179, 69 171, 68.7 163 C 68.2 154, 67.5 145, 66.5 136 C 65 124, 63 112, 62 101 Z'
        }
      />
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
  const has = (z: SilhouetteZone) => zones.includes(z);

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
        {has('shoulders') ? (
          <>
            <Path
              key="delt0"
              d={
                'M44 43.5 C 38 44.5, 33.5 48, 31.8 53.5 C 30.8 58, 31.5 63, 34.5 64.5 C 37.5 65.5, 40 62, 41.5 57 C 43 51.5, 44 47, 44 43.5 Z'
              }
            />
            <Path
              key="delt1"
              d={
                'M76 43.5 C 82 44.5, 86.5 48, 88.2 53.5 C 89.2 58, 88.5 63, 85.5 64.5 C 82.5 65.5, 80 62, 78.5 57 C 77 51.5, 76 47, 76 43.5 Z'
              }
            />
          </>
        ) : null}
        {has('chest') ? (
          <Path
            d={
              'M60 44.8 C 52 43.2, 45.5 45, 42.6 49.4 C 41 54.6, 42.2 60.8, 46.4 64.2 C 51.5 67.4, 57 66, 60 61.6 C 63 66, 68.5 67.4, 73.6 64.2 C 77.8 60.8, 79 54.6, 77.4 49.4 C 74.5 45, 68 43.2, 60 44.8 Z'
            }
          />
        ) : null}
        {has('back') ? (
          <>
            <Path
              key="lat0"
              d={
                'M37.5 57 C 39 65, 41 73, 43.5 81 C 45 86, 42.5 88.5, 40.5 85 C 37.5 77.5, 36.5 67, 37.5 57 Z'
              }
            />
            <Path
              key="lat1"
              d={
                'M82.5 57 C 81 65, 79 73, 76.5 81 C 75 86, 77.5 88.5, 79.5 85 C 82.5 77.5, 83.5 67, 82.5 57 Z'
              }
            />
          </>
        ) : null}
        {has('arms') ? (
          <>
            <Path
              key="bicep0"
              d={
                'M31.5 55 C 35.5 54, 38.5 57, 38 62 C 37.2 69, 36.2 75, 35 81 C 33 84, 30.6 82, 30.5 77.5 C 30.2 69.5, 30.6 61, 31.5 55 Z'
              }
            />
            <Path
              key="bicep1"
              d={
                'M88.5 55 C 84.5 54, 81.5 57, 82 62 C 82.8 69, 83.8 75, 85 81 C 87 84, 89.4 82, 89.5 77.5 C 89.8 69.5, 89.4 61, 88.5 55 Z'
              }
            />
          </>
        ) : null}
        {has('core') ? (
          <Path
            d={
              'M51 65 C 56.5 63.5, 63.5 63.5, 69 65 C 69 74, 67.5 83, 65.5 90 C 61.5 92.5, 58.5 92.5, 54.5 90 C 52.5 83, 51 74, 51 65 Z'
            }
          />
        ) : null}
        {has('legs') ? (
          <>
            <Path
              key="quad0"
              d={
                'M42.5 107 C 48 103.5, 54 104.5, 56.8 110 C 55.5 121, 53 132, 49.8 142 C 47.5 144.5, 43.6 142.5, 42.8 137 C 41.8 127, 41.6 116, 42.5 107 Z'
              }
            />
            <Path
              key="quad1"
              d={
                'M77.5 107 C 72 103.5, 66 104.5, 63.2 110 C 64.5 121, 67 132, 70.2 142 C 72.5 144.5, 76.4 142.5, 77.2 137 C 78.2 127, 78.4 116, 77.5 107 Z'
              }
            />
          </>
        ) : null}
      </AnimatedG>
    </Svg>
  );
}

const styles = StyleSheet.create({
  silhouette: { position: 'absolute', right: -22, top: 22, opacity: 0.6 },
});
