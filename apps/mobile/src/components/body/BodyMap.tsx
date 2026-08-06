/**
 * Schéma corporel (US MUSC-F1b, roadmap 6.2) — silhouette muette, deux vues (face/dos, R4),
 * 11 tracés au total (5 face, 6 dos — épaules sur les deux, spec §1). Aucun accès repository :
 * reçoit `full`/`reduced` déjà résolus par `resolveFineMuscles` (spec §2), un seul chemin de
 * rendu pour les 3 points de montage (fiche, aperçu de séance, bilan hebdo).
 *
 * Coordonnées reprises de la maquette validée
 * (design/muscf1b-schema-muscles/muscf1b-schema-muscles.html, critère de recette 12) — pas
 * redessinées ici, le calage anatomique a déjà été relu sur le dessin.
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { FINE_MUSCLES, FINE_MUSCLE_VIEWS, type FineMuscle } from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type BodyMapProps = {
  full: FineMuscle[];
  reduced: FineMuscle[];
};

/** viewBox partagé par les deux vues (repris tel quel de la maquette). */
const VIEW_BOX = '0 0 112 188';

/** Émphase réduite (repli large, secondaires) — R1 : deux niveaux, pas de 3ᵉ (illisible). */
const REDUCED_OPACITY = 0.35;

/**
 * Tracé de chaque muscle fin — `d` du `<Path>`, un ou deux sous-tracés (M…z) pour les muscles
 * bilatéraux (épaules, biceps, triceps, fessiers, quadriceps, ischio-jambiers, mollets).
 * Régions reprises de la maquette (rectangles à main levée, pas une planche d'anatomie complète —
 * le niveau de détail assumé par le produit, spec §1).
 */
// ⚠️ Exporté pour `PainBodyMap` (US DOUL-01), qui réutilise la **géométrie** sans rendre ce
// composant-ci interactif : trois écrans en dépendent (`exercises/[id]`, `programs/[id]`, `review`),
// dont deux appartiennent à des US en recette. Un fichier de plus vaut mieux qu'une régression sur
// des écrans qui marchent. C'est le seul changement apporté à ce fichier par DOUL-01.
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

/** Une des deux vues (face ou dos) — silhouette commune (tête, cou) + tracés propres à la vue. */
function BodyView({
  muscles,
  full,
  reduced,
  neutralFill,
  accentFill,
}: {
  muscles: FineMuscle[];
  full: FineMuscle[];
  reduced: FineMuscle[];
  neutralFill: string;
  accentFill: string;
}) {
  return (
    <Svg width={100} height={168} viewBox={VIEW_BOX} accessible={false}>
      <Ellipse cx={56} cy={20} rx={13} ry={15} fill={neutralFill} />
      <Rect x={42} y={37} width={28} height={10} rx={4} fill={neutralFill} />
      {muscles.map((muscle) => {
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
    </Svg>
  );
}

/**
 * `<BodyMap full={...} reduced={...} />` — deux silhouettes côte à côte (face puis dos), chacune
 * neutre par défaut (R2 : un muscle non sollicité n'est pas « éteint »). Le schéma reste un
 * complément : la liste textuelle des muscles sollicités est affichée par l'appelant, jamais
 * remplacée (R5) — ce composant ne rend que le dessin + son `accessibilityLabel`.
 */
export function BodyMap({ full, reduced }: BodyMapProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const sollicited = [...full, ...reduced];
  const label =
    sollicited.length > 0
      ? t('bodyMap.a11yLabel', {
          muscles: sollicited.map((m) => t(`muscleFine.${m}`)).join(', '),
        })
      : t('bodyMap.a11yLabelEmpty');

  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel={label}>
      <View style={styles.view}>
        <BodyView
          muscles={FRONT_MUSCLES}
          full={full}
          reduced={reduced}
          neutralFill={colors.surfaceAlt}
          accentFill={colors.accent}
        />
        <Text style={[styles.caption, { color: colors.textMuted }]}>{t('bodyMap.front')}</Text>
      </View>
      <View style={styles.view}>
        <BodyView
          muscles={BACK_MUSCLES}
          full={full}
          reduced={reduced}
          neutralFill={colors.surfaceAlt}
          accentFill={colors.accent}
        />
        <Text style={[styles.caption, { color: colors.textMuted }]}>{t('bodyMap.back')}</Text>
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
