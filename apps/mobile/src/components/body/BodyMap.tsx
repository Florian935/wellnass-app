/**
 * Schéma corporel (US MUSC-F1b, roadmap 6.2) — silhouette muette, deux vues (face/dos, R4),
 * 11 tracés au total (5 face, 6 dos — épaules sur les deux, spec §1). Aucun accès repository :
 * reçoit `full`/`reduced` déjà résolus par `resolveFineMuscles` (spec §2), un seul chemin de
 * rendu pour les 3 points de montage (fiche, aperçu de séance, bilan hebdo).
 *
 * ── Ce qu'il reste ici ──────────────────────────────────────────────────────────────────────────
 * Le **dessin** vit dans `BodyMapCanvas`, qui ne connaît ni thème ni langue (US MUSCU-UX03) ; ce
 * fichier n'est plus que l'habillage qui lui passe les couleurs du thème et les libellés traduits.
 * Le rendu est inchangé pour les trois points de montage historiques.
 */
import { useTranslation } from 'react-i18next';
import type { FineMuscle } from '@wellness/shared';
import {
  BodyMapCanvas,
  type BodyHeat,
  type BodyMapColors,
} from '@/components/body/BodyMapCanvas';
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

  return (
    <BodyMapCanvas
      full={full}
      reduced={reduced}
      heat={heat}
      heatColor={heatColor}
      colors={colors}
      height={height}
      pulse={pulse}
      frontLabel={t('bodyMap.front')}
      backLabel={t('bodyMap.back')}
      a11yLabel={label}
    />
  );
}
