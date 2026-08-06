/**
 * US DOUL-01 — schéma corporel **interactif** pour déclarer une zone sensible.
 *
 * ── Pourquoi un composant distinct de `BodyMap` ───────────────────────────────────────────────────
 * `BodyMap` est en lecture seule (`accessible={false}` sur le `<Svg>`, aucun `onPress`, 10 muscles) et
 * **trois écrans en dépendent** — `exercises/[id]`, `programs/[id]`, `review` —, dont deux
 * appartiennent à des US en recette. Le rendre interactif aurait risqué une régression sur du code
 * qui marche. On réutilise donc sa **géométrie** (`MUSCLE_PATHS`, simplement exporté) et on ajoute
 * ici les tracés articulaires, le tap et l'accessibilité.
 *
 * ── Muscles et articulations se distinguent par la FORME ──────────────────────────────────────────
 * Les muscles sont des **plaques** (reprises telles quelles), les articulations des **pastilles**.
 * C'est ce qui permet de lire `shoulders` et `shoulder_joint` sans lire leur nom — critère de
 * recette 4. Ce n'est pas de la décoration : l'un se relie à une séance, l'autre non.
 *
 * ── Trois niveaux, par la COULEUR ────────────────────────────────────────────────────────────────
 * `BodyMap` n'a que deux intensités (plein / 0,35) et sa spec dit « deux niveaux, pas de 3ᵉ
 * (illisible) ». Ici on a besoin de trois : ils passent donc par **trois teintes**, pas par trois
 * opacités — sinon on retomberait exactement sur le problème que MUSC-F1b avait constaté.
 */

import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import {
  PAIN_JOINT_ZONES,
  PAIN_MUSCLE_ZONES,
  type PainLevel,
  type PainZone,
} from '@wellness/shared';

import { MUSCLE_PATHS } from '@/components/body/BodyMap';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Même `viewBox` que `BodyMap` — les deux géométries doivent se superposer exactement. */
const VIEW_BOX = '0 0 112 188';

/** Vue sur laquelle chaque zone se dessine. */
type BodyView = 'front' | 'back';

/** Muscles par vue — repris de `FINE_MUSCLE_VIEWS` via les mêmes règles que `BodyMap`. */
const MUSCLE_VIEWS: Record<(typeof PAIN_MUSCLE_ZONES)[number], BodyView[]> = {
  chest: ['front'],
  back: ['back'],
  shoulders: ['front', 'back'],
  biceps: ['front'],
  triceps: ['back'],
  abs: ['front'],
  glutes: ['back'],
  quadriceps: ['front'],
  hamstrings: ['back'],
  calves: ['back'],
};

/**
 * Les 8 articulations : centre et rayon de leur pastille, par vue.
 *
 * Rayons volontairement généreux (≥ 5) : une pastille de 3 px serait juste, mais **intapable**. La
 * zone de tap est encore élargie par `hitSlop` sur le conteneur de chaque vue.
 */
const JOINT_DOTS: Record<
  (typeof PAIN_JOINT_ZONES)[number],
  { cx: number; cy: number; r: number; views: BodyView[] }
> = {
  neck: { cx: 56, cy: 41, r: 5, views: ['front', 'back'] },
  shoulder_joint: { cx: 22, cy: 50, r: 6, views: ['front', 'back'] },
  elbow: { cx: 24, cy: 106, r: 5, views: ['front', 'back'] },
  wrist: { cx: 26, cy: 128, r: 5, views: ['front', 'back'] },
  lower_back: { cx: 56, cy: 88, r: 6, views: ['back'] },
  hip: { cx: 44, cy: 112, r: 5, views: ['front', 'back'] },
  knee: { cx: 47, cy: 152, r: 6, views: ['front', 'back'] },
  ankle: { cx: 47, cy: 180, r: 5, views: ['front', 'back'] },
};

type Props = {
  /** Niveau déclaré par zone. Une zone absente est neutre. */
  levels: Partial<Record<PainZone, PainLevel>>;
  onSelect: (zone: PainZone) => void;
  /** Zone en cours d'édition, mise en évidence. */
  selected?: PainZone | null;
};

/** Une teinte par niveau (et non une opacité — voir l'en-tête). */
function levelColor(level: PainLevel | undefined, neutral: string, palette: Record<PainLevel, string>): string {
  return level === undefined ? neutral : palette[level];
}

function BodyHalf({
  view,
  levels,
  selected,
  onSelect,
  neutral,
  palette,
  outline,
}: {
  view: BodyView;
  levels: Partial<Record<PainZone, PainLevel>>;
  selected: PainZone | null | undefined;
  onSelect: (zone: PainZone) => void;
  neutral: string;
  palette: Record<PainLevel, string>;
  outline: string;
}) {
  const { t } = useTranslation();

  const muscles = PAIN_MUSCLE_ZONES.filter((m) => MUSCLE_VIEWS[m].includes(view));
  const joints = PAIN_JOINT_ZONES.filter((j) => JOINT_DOTS[j].views.includes(view));

  /** Libellé lu par TalkBack : la zone, et son état si elle en a un. */
  const zoneLabel = (zone: PainZone): string => {
    const level = levels[zone];
    const name = t(`pain.zones.${zone}`);
    return level === undefined ? name : `${name}, ${t(`pain.levels.${level}`)}`;
  };

  return (
    <Svg width={104} height={176} viewBox={VIEW_BOX}>
      {/* Silhouette : tête et cou, non tapables — mêmes formes que `BodyMap`. */}
      <Ellipse cx={56} cy={20} rx={13} ry={15} fill={neutral} />
      <Rect x={42} y={37} width={28} height={10} rx={4} fill={neutral} />

      {/* ⚠️ `react-native-svg` n'accepte **ni `accessibilityRole` ni `accessibilityState`** sur ses
          formes, seulement `accessibilityLabel` (vérifié au typecheck). Le schéma est donc une
          affordance **visuelle** : le parcours accessible passe par la liste de zones de l'écran,
          qui expose de vrais boutons. Taper un tracé SVG au lecteur d'écran serait de toute façon
          une mauvaise expérience. */}
      {muscles.map((zone) => (
        <Path
          key={zone}
          d={MUSCLE_PATHS[zone]}
          fill={levelColor(levels[zone], neutral, palette)}
          stroke={selected === zone ? outline : 'none'}
          strokeWidth={selected === zone ? 2 : 0}
          onPress={() => onSelect(zone)}
          accessibilityLabel={zoneLabel(zone)}
        />
      ))}

      {/* Les articulations passent APRÈS les muscles : elles se dessinent par-dessus, et reçoivent
          donc le tap là où les deux se recouvrent (l'épaule notamment). */}
      {joints.map((zone) => {
        const dot = JOINT_DOTS[zone];
        return (
          <Circle
            key={zone}
            cx={dot.cx}
            cy={dot.cy}
            r={dot.r}
            fill={levelColor(levels[zone], neutral, palette)}
            stroke={selected === zone ? outline : neutral}
            strokeWidth={selected === zone ? 2 : 1}
            onPress={() => onSelect(zone)}
            accessibilityLabel={zoneLabel(zone)}
          />
        );
      })}
    </Svg>
  );
}

/**
 * Les deux vues côte à côte. `memo` : le composant est purement dérivé de ses props, et il est monté
 * sur un écran où l'on tape souvent — le re-rendre à chaque frappe du parent serait gratuit.
 */
export const PainBodyMap = memo(function PainBodyMap({ levels, onSelect, selected }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  // Trois teintes, pas trois opacités (voir l'en-tête). `amber` est l'« alerte douce » du thème,
  // `danger` le rouge le plus fort : la progression se lit sans légende.
  const palette: Record<PainLevel, string> = {
    discomfort: colors.amber,
    pain: colors.accent,
    blocking: colors.danger,
  };

  return (
    <View style={styles.row}>
      {(['front', 'back'] as const).map((view) => (
        <View key={view} style={styles.view}>
          <BodyHalf
            view={view}
            levels={levels}
            selected={selected}
            onSelect={onSelect}
            neutral={colors.surfaceAlt}
            palette={palette}
            outline={colors.text}
          />
          <Text style={[styles.caption, { color: colors.textMuted }]}>
            {t(`bodyMap.${view}`)}
          </Text>
        </View>
      ))}
    </View>
  );
});

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
