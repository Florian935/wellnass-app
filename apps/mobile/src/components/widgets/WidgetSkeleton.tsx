/**
 * Squelette de chargement d'un widget (US ACCUEIL-04).
 *
 * ── Le défaut qu'il corrige ──────────────────────────────────────────────────────────────────────
 * Les huit widgets de l'accueil faisaient tous `if (isLoading) return null`. À l'ouverture de
 * l'app, l'écran était donc **vide**, puis les cartes apparaissaient une à une — et comme
 * `WidgetGrid` recompacte la disposition à chaque changement (`compactLayout`), la grille se
 * réagençait à chaque arrivée. Résultat : l'écran sautait sous le doigt, au moment précis du
 * premier contact, chaque matin.
 *
 * Un squelette **réserve la cellule** : la disposition est stable dès le premier rendu, et seul le
 * contenu de chaque carte se remplit.
 *
 * ── Pourquoi pas d'animation de pulsation ────────────────────────────────────────────────────────
 * Les données sont locales (SQLite via PowerSync) : l'attente se compte en dizaines de
 * millisecondes, pas en secondes. Une pulsation n'aurait pas le temps d'accomplir un cycle et se
 * lirait comme un scintillement. On montre donc une forme figée, discrète, qui disparaît vite.
 */

import { StyleSheet, Text, View } from 'react-native';
import type { WidgetSize } from '@wellness/shared';

import { Eyebrow, WidgetFrame } from '@/components/widgets/WidgetFrame';
import { useTheme } from '@/theme/useTheme';

/** Rembourrage par forme — le même que les cartes réelles, pour que rien ne se décale au remplacement. */
const PAD: Record<WidgetSize, number> = { row: 16, small: 16, wide: 18, large: 22 };

export function WidgetSkeleton({
  size = 'wide',
  /**
   * Sur-titre du widget. Affiché tel quel : c'est la seule information réellement disponible avant
   * les données, et elle suffit à ce que l'utilisateur reconnaisse la carte qui arrive.
   */
  label,
}: {
  size?: WidgetSize;
  label?: string;
}) {
  const { colors } = useTheme();

  // `accessibilityElementsHidden` + `importantForAccessibility` : un lecteur d'écran ne doit pas
  // annoncer des barres de remplacement. Le contenu réel sera annoncé dès qu'il arrive.
  return (
    <WidgetFrame pad={PAD[size]}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.col}
      >
        {label ? <Eyebrow>{label}</Eyebrow> : null}
        {size === 'row' ? (
          <View style={[styles.bar, styles.barShort, { backgroundColor: colors.track }]} />
        ) : (
          <>
            <View style={[styles.bar, styles.barTitle, { backgroundColor: colors.track }]} />
            <View style={[styles.bar, styles.barShort, { backgroundColor: colors.track }]} />
            {size !== 'small' ? (
              <View style={[styles.bar, styles.barWide, { backgroundColor: colors.track }]} />
            ) : null}
          </>
        )}
      </View>
      {/* Texte de remplacement lu par les technologies d'assistance à la place des barres. */}
      <Text style={styles.srOnly} accessibilityRole="progressbar">
        {label ?? ''}
      </Text>
    </WidgetFrame>
  );
}

const styles = StyleSheet.create({
  col: { gap: 10, marginTop: 6 },
  bar: { height: 12, borderRadius: 6 },
  barTitle: { width: '62%', height: 20 },
  barShort: { width: '40%' },
  barWide: { width: '80%' },
  // Hors flux visuel sans être retiré de l'arbre d'accessibilité.
  srOnly: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
