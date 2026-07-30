/**
 * Cadre + blocs de base des widgets multi-formes, calés sur la galerie « FitTrio · Widgets ».
 *
 *  - `WidgetFrame` : la carte (surface / alerte douce / panneau inversé), tappable ou non,
 *    remplissant sa cellule de grille. `pad` ajuste le rembourrage selon la forme.
 *  - `Eyebrow`     : sur-titre mono majuscule atténué (« SÉANCE · 18:30 »).
 *  - `Chip`        : pastille de tendance/étiquette teintée (succès / accent / alerte / neutre).
 *  - `Metric`      : gros chiffre Bricolage + unité inline + sous-libellé (bas des petits carrés).
 *
 * Purement présentationnels ; aucune donnée, aucune chaîne en dur.
 */

import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { AccentHalo } from '@/components/AccentHalo';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/color-utils';

type Tone = 'card' | 'warn' | 'panel';

export function WidgetFrame({
  onPress,
  tone = 'card',
  pad = 16,
  style,
  children,
  accessibilityLabel,
  accessibilityHint,
}: {
  onPress?: () => void;
  tone?: Tone;
  /** Rembourrage interne (16 petit · 18 rectangle · 22 grand). */
  pad?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const { colors } = useTheme();

  const toneStyle: ViewStyle =
    tone === 'warn'
      ? { backgroundColor: colors.warn, borderColor: colors.warnBorder, borderWidth: 1 }
      : tone === 'panel'
        ? { backgroundColor: colors.panel, borderWidth: 0 }
        : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 };

  const base: StyleProp<ViewStyle> = [styles.card, { padding: pad }, toneStyle, style];

  // Cercle d'accent en coin (celui de la maquette). **Quels** widgets en portent, dans quel
  // coin et avec quel facteur de taille est décidé par `AccentHalo` à partir de l'identité du
  // widget (`hasHaloFor` / `geometryFromId`) ; ici on ne règle que ce qui dépend de la carte :
  //  - le **diamètre de base suit la taille de la carte** via `pad` (16 petit carré ·
  //    18 rectangle · 22 grand). Un cercle fixe de 150 comme dans la maquette — dessiné pour
  //    une carte pleine largeur — couvrait le tiers d'une petite tuile et s'y lisait comme une
  //    tache ;
  //  - l'opacité tombe à .1 sur les cartes claires, où .22 de terracotta sur du crème vire au
  //    rose sale (constaté sur device en thème clair).
  // Les cartes d'alerte en sont exemptées : leur teinte ambre porte déjà un sens, un cercle
  // accent par-dessus la brouillerait.
  const haloSize = pad <= 16 ? 90 : pad <= 18 ? 115 : 140;
  const content = (
    <>
      {tone === 'panel' ? <AccentHalo size={haloSize} /> : null}
      {tone === 'card' ? <AccentHalo size={haloSize} opacity={0.1} /> : null}
      {children}
    </>
  );

  if (!onPress) {
    return <View style={base}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

export function Eyebrow({
  children,
  tone = 'muted',
  style,
}: {
  children: ReactNode;
  tone?: 'muted' | 'warn' | 'panel';
  style?: StyleProp<TextStyle>;
}) {
  const { colors } = useTheme();
  const color = tone === 'warn' ? colors.warnText : tone === 'panel' ? colors.panelMuted : colors.textMuted;
  return (
    <Text style={[styles.eyebrow, { color }, style]} numberOfLines={1}>
      {children}
    </Text>
  );
}

export function Chip({
  label,
  tone = 'success',
}: {
  label: string;
  tone?: 'success' | 'accent' | 'warn' | 'neutral';
}) {
  const { colors } = useTheme();
  const base =
    tone === 'success'
      ? colors.success
      : tone === 'warn'
        ? colors.amber
        : tone === 'neutral'
          ? colors.textMuted
          : colors.accent;
  return (
    <View style={[styles.chip, { backgroundColor: withAlpha(base, 0.18) }]}>
      <Text style={[styles.chipText, { color: base }]}>{label}</Text>
    </View>
  );
}

export function Metric({
  value,
  unit,
  sub,
  color,
  muted,
}: {
  value: string;
  unit?: string;
  sub?: string;
  color?: string;
  /** Rend le chiffre en couleur atténuée (état vide). */
  muted?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View>
      <Text
        style={[
          styles.metricValue,
          // États vides (muted) = texte, pas un chiffre héro → police modeste pour éviter le « Aucune » démesuré.
          muted && styles.metricValueMuted,
          { color: color ?? (muted ? colors.textMuted : colors.text) },
        ]}
      >
        {value}
        {unit ? <Text style={[styles.metricUnit, { color: colors.textMuted }]}> {unit}</Text> : null}
      </Text>
      {sub ? <Text style={[styles.metricSub, { color: colors.textMuted }]}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, height: '100%', borderRadius: 22, overflow: 'hidden' },
  pressed: { opacity: 0.7 },
  eyebrow: {
    fontFamily: fontFamily.monoBold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: fontFamily.bodyBold, fontSize: 12 },
  metricValue: { fontFamily: fontFamily.displayXBold, fontSize: 38, letterSpacing: -1.4 },
  metricValueMuted: { fontFamily: fontFamily.displaySemi, fontSize: 20, letterSpacing: -0.3 },
  metricUnit: { fontFamily: fontFamily.displaySemi, fontSize: 16, letterSpacing: 0 },
  metricSub: { fontFamily: fontFamily.bodySemi, fontSize: 12.5, marginTop: 4 },
});
