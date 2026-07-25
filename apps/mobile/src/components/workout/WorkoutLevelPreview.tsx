import { StyleSheet, Text, View } from 'react-native';
import { workoutFieldVisibility, type WorkoutDisplayLevel } from '@wellness/shared';
import type { Palette } from '@/theme/colors';
import { fontFamily } from '@/theme/fonts';

/**
 * Vignette schématique d'aperçu d'un niveau d'affichage de séance (MUSC-F13b).
 *
 * But : à l'onboarding, montrer d'un coup d'œil « à quoi ça ressemble » — sans
 * dupliquer la vraie carte `CurrentSetCard`. On ne rend pas les vrais champs
 * mais une maquette symbolique : une barre de titre, une rangée de pastilles
 * représentant les *suppléments visibles à ce niveau* (pilotée par la même
 * source de vérité `workoutFieldVisibility` → cohérence garantie avec la carte),
 * et des barres « champs cœur » toujours présentes. Plus il y a de pastilles,
 * plus le niveau est détaillé.
 *
 * Purement présentationnel : reçoit `colors` en prop (pas de `useTheme`).
 */

/** Pastilles possibles, dans l'ordre d'affichage, avec leur libellé compact. */
const BADGES: { key: keyof ReturnType<typeof workoutFieldVisibility>; label: string }[] = [
  { key: 'warmupShortcut', label: '🔥' },
  { key: 'suggestion', label: '💡' },
  { key: 'typeSelector', label: 'Types' },
  { key: 'rpe', label: 'RPE' },
  { key: 'note', label: '📝' },
  { key: 'superset', label: '⇄' },
];

export function WorkoutLevelPreview({
  level,
  colors,
}: {
  level: WorkoutDisplayLevel;
  colors: Palette;
}) {
  const vis = workoutFieldVisibility(level);
  const badges = BADGES.filter((b) => vis[b.key]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {/* Barre de titre (nom d'exercice) — toujours présente. */}
      <View style={[styles.titleBar, { backgroundColor: colors.surfaceAlt }]} />

      {/* Rangée de pastilles : les suppléments visibles à ce niveau (vide en Simplifiée). */}
      {badges.length > 0 ? (
        <View style={styles.badges}>
          {badges.map((b) => (
            <View key={b.key} style={[styles.badge, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.badgeText, { color: colors.accent }]}>{b.label}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.badgesEmpty} />
      )}

      {/* Champs cœur (reps / charge) + valider — toujours présents. */}
      <View style={styles.fieldsRow}>
        <View style={[styles.fieldBar, { backgroundColor: colors.surfaceAlt }]} />
        <View style={[styles.fieldBar, { backgroundColor: colors.surfaceAlt }]} />
      </View>
      <View style={[styles.validateBar, { backgroundColor: colors.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 7 },
  titleBar: { height: 9, width: '55%', borderRadius: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  // Réserve la même hauteur que la rangée de pastilles pour que les 3 vignettes
  // gardent un gabarit comparable même quand la Simplifiée n'a aucune pastille.
  badgesEmpty: { height: 20 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontFamily: fontFamily.bodyBold, fontSize: 11 },
  fieldsRow: { flexDirection: 'row', gap: 8 },
  fieldBar: { flex: 1, height: 16, borderRadius: 6 },
  validateBar: { height: 12, borderRadius: 6 },
});
