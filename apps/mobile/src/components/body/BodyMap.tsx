/**
 * Schéma corporel (US MUSC-F1b, roadmap 6.2) — silhouette muette, deux vues (face/dos, R4),
 * 11 tracés au total (5 face, 6 dos — épaules sur les deux, spec §1). Aucun accès repository :
 * reçoit `full`/`reduced` déjà résolus par `resolveFineMuscles` (spec §2), un seul chemin de
 * rendu pour les 3 points de montage (fiche, aperçu de séance, bilan hebdo).
 *
 * ── Ce qu'il reste ici ──────────────────────────────────────────────────────────────────────────
 * Les trois points de montage historiques conservent la silhouette anatomique CORPS-01. La carte
 * à partager utilise séparément `BodyMapCanvas`, sans thème ni langue (US MUSCU-UX03).
 */
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FINE_MUSCLES, type FineMuscle } from '@wellness/shared';
import { AnatomyFigure } from '@/components/body/AnatomyFigure';
import type { BodyHeat, BodyMapColors } from '@/components/body/BodyMapCanvas';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export { MUSCLE_PATHS } from '@/components/body/BodyMapCanvas';
export type { BodyHeat, BodyMapColors };

type BodyMapProps = {
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
  /** Couleurs imposées, quand le thème ambiant ne convient pas (fond sombre de séance). */
  colors?: BodyMapColors;
  /** Hauteur d'une silhouette (défaut 168 — la taille historique). */
  height?: number;
  /** Muscle qui vient d'être réchauffé : son halo pulse une fois. */
  pulse?: FineMuscle | null;
};

/**
 * `<BodyMap full={...} reduced={...} />` — deux silhouettes côte à côte (face puis dos), chacune
 * neutre par défaut (R2 : un muscle non sollicité n'est pas « éteint »). Le schéma reste un
 * complément : la liste textuelle des muscles sollicités est affichée par l'appelant, jamais
 * remplacée (R5) — ce composant ne rend que le dessin + son `accessibilityLabel`.
 */
export function BodyMap({
  full,
  reduced,
  heat,
  heatColor,
  colors: override,
  height = 168,
  pulse = null,
}: BodyMapProps) {
  const { t } = useTranslation();
  const { colors: theme } = useTheme();

  const colors = override ?? {
    neutral: theme.surfaceAlt,
    accent: theme.accent,
    caption: theme.textMuted,
  };

  // En mode chaleur, l'énoncé décrit ce qui a chauffé aujourd'hui : la liste des muscles de la
  // fiche n'aurait aucun sens ici (elle est identique à chaque séance).
  const warmed = heat
    ? (Object.keys(heat) as FineMuscle[]).filter((muscle) => (heat[muscle] ?? 0) > 0)
    : [...full, ...reduced];
  const label =
    warmed.length > 0
      ? t('bodyMap.a11yLabel', {
          muscles: warmed.map((m) => t(`muscleFine.${m}`)).join(', '),
        })
      : t('bodyMap.a11yLabelEmpty');

  const muscleColors =
    heat && heatColor
      ? Object.fromEntries(
          FINE_MUSCLES.map((muscle) => {
            const value = heat[muscle] ?? 0;
            return [muscle, value > 0 ? heatColor(value) : colors.neutral];
          }),
        ) as Partial<Record<FineMuscle, string>>
      : undefined;
  const muscleHaloColors =
    heat && heatColor
      ? Object.fromEntries(
          FINE_MUSCLES.flatMap((muscle) => {
            const value = heat[muscle] ?? 0;
            return value > 0.45 ? [[muscle, heatColor(value)]] : [];
          }),
        ) as Partial<Record<FineMuscle, string>>
      : undefined;
  const palette = override
    ? { neutral: override.neutral, edge: override.neutral, accent: override.accent }
    : undefined;

  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel={label}>
      <View style={styles.view}>
        <AnatomyFigure
          side="front"
          height={height}
          full={full}
          reduced={reduced}
          muscleColors={muscleColors}
          muscleHaloColors={muscleHaloColors}
          pulse={pulse}
          palette={palette}
        />
        <Text style={[styles.caption, { color: colors.caption }]}>{t('bodyMap.front')}</Text>
      </View>
      <View style={styles.view}>
        <AnatomyFigure
          side="back"
          height={height}
          full={full}
          reduced={reduced}
          muscleColors={muscleColors}
          muscleHaloColors={muscleHaloColors}
          pulse={pulse}
          palette={palette}
        />
        <Text style={[styles.caption, { color: colors.caption }]}>{t('bodyMap.back')}</Text>
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
