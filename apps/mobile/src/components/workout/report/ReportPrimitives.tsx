/**
 * US MUSCU-UX02 — le vocabulaire visuel du bilan de séance.
 *
 * Ces briques sont extraites parce qu'elles se répètent dans une douzaine de blocs : un surtitre, une
 * carte, une barre, une pastille d'écart. Les redessiner bloc par bloc aurait garanti la dérive — et
 * c'est exactement ce qui était arrivé entre le récap et l'historique, où la même carte de record
 * existait en deux versions incompatibles.
 *
 * Toutes les valeurs (rayons, tailles, graisses) viennent du thème réel de l'app, relevées sur
 * `workout-summary.tsx` et `history/[id].tsx` avant leur réécriture : aucune couleur nouvelle,
 * aucun rayon inventé.
 */

import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Surtitre de section : petites capitales espacées, comme partout ailleurs dans l'app. */
export function Eyebrow({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.eyebrow, { color: colors.textMuted }]}>{children}</Text>;
}

/** Carte standard : fond `surface`, contour `border`, rayon 16. */
export function ReportCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Note de bas de carte — ce qui explique le calcul, en petit et en discret. */
export function CardNote({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.cardNote, { color: colors.textMuted }]}>{children}</Text>;
}

/**
 * Barre de proportion.
 *
 * `accessibilityLabel` est **obligatoire** : une barre seule n'est pas lisible au lecteur d'écran,
 * et c'est le défaut d'accessibilité le plus courant de ce genre d'écran (spec §6).
 */
export function Bar({
  ratio,
  color,
  accessibilityLabel,
}: {
  ratio: number;
  color: string;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  // Bornée : une intensité relative peut légitimement dépasser 100 % (nouveau record), mais la
  // barre, elle, ne peut pas déborder de son rail.
  const width = `${Math.max(0, Math.min(1, ratio)) * 100}%` as const;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={[styles.barTrack, { backgroundColor: colors.track }]}
    >
      <View style={[styles.barFill, { width, backgroundColor: color }]} />
    </View>
  );
}

/**
 * Pastille d'écart : verte en progrès, terracotta en recul, neutre à l'identique.
 *
 * ⚠️ `tone` est passé explicitement plutôt que déduit du signe : « −4 min » sur une durée n'est pas
 * une mauvaise nouvelle, alors que « −4 % » sur un tonnage en est une. Laisser le composant décider
 * aurait peint en rouge des séances plus efficaces.
 */
export function DeltaBadge({ label, tone }: { label: string; tone: 'up' | 'down' | 'neutral' }) {
  const { colors } = useTheme();
  const palette =
    tone === 'up'
      ? { color: colors.success, backgroundColor: `${colors.success}24` }
      : tone === 'down'
        ? { color: colors.accent, backgroundColor: `${colors.accent}1f` }
        : { color: colors.textMuted, backgroundColor: colors.surfaceAlt };
  return <Text style={[styles.delta, palette]}>{label}</Text>;
}

/**
 * Enveloppe de section : un surtitre, ou un en-tête repliable quand le bloc est lourd.
 *
 * C'est ce qui applique la décision D6 sans dupliquer le titre. Un bloc d'analyse ne sait pas s'il
 * doit se replier — c'est une propriété du **niveau de lecture**, pas du bloc —, il reçoit donc la
 * décision et se contente de fournir son titre et son chiffre-clé.
 */
export function ReportSection({
  title,
  summary,
  collapsible,
  children,
}: {
  title: string;
  /** Chiffre-clé, visible même replié : c'est lui qui donne envie (ou non) de déplier. */
  summary?: string;
  collapsible: boolean;
  children: ReactNode;
}) {
  if (collapsible) {
    return (
      <CollapsibleBlock title={title} summary={summary}>
        {children}
      </CollapsibleBlock>
    );
  }
  return (
    <View style={styles.section}>
      <Eyebrow>{title}</Eyebrow>
      {children}
    </View>
  );
}

/**
 * Bloc repliable — la parade à l'écran de 4 000 px du niveau Avancé (spec D6).
 *
 * Le `summary` reste visible replié : un bloc dont on ne voit que le titre n'invite pas à l'ouvrir,
 * et l'utilisateur doit pouvoir décider s'il vaut le déploiement **sans** l'avoir déployé.
 */
export function CollapsibleBlock({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={styles.collapsible}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [
          styles.collapsibleHead,
          { backgroundColor: colors.surface, borderColor: colors.border },
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.collapsibleTexts}>
          <Text style={[styles.collapsibleTitle, { color: colors.text }]}>{title}</Text>
          {summary ? (
            <Text style={[styles.collapsibleSummary, { color: colors.textMuted }]} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textMuted}
        />
      </Pressable>
      {open ? <View style={styles.collapsibleBody}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardNote: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 16 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  delta: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  section: { gap: 10 },
  collapsible: { gap: 10 },
  collapsibleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 44,
  },
  collapsibleTexts: { flex: 1, minWidth: 0, gap: 2 },
  collapsibleTitle: { fontFamily: fontFamily.bodySemi, fontSize: 14.5 },
  collapsibleSummary: { fontFamily: fontFamily.body, fontSize: 12.5 },
  collapsibleBody: { gap: 10 },
  pressed: { opacity: 0.8 },
});
