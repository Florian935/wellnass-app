import { Ionicons } from '@expo/vector-icons';
import { type ReactNode, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

// Android (ancienne archi) : LayoutAnimation doit être activé explicitement.
// No-op sur New Arch / iOS ; sans effet si la méthode n'existe pas.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type CollapsibleCardProps = {
  /** Titre affiché dans l'en-tête (ex. nom de séance). */
  title: string;
  /** Résumé court à droite du titre (ex. « 5 exercices », « Endurance · 8 km »). */
  summary?: string;
  /** Détail révélé au dépli. */
  children?: ReactNode;
  /** Élément toujours visible (replié comme déplié), ex. bouton « Démarrer ». */
  footer?: ReactNode;
  /** État initial. Par défaut replié. */
  defaultExpanded?: boolean;
};

/**
 * Carte de séance repliable : en-tête tappable (titre + résumé + chevron) qui bascule
 * l'affichage du détail (`children`). État local éphémère ; ouverture indépendante.
 * Le `footer` reste visible quel que soit l'état. Utilisé par les écrans détail programme
 * (muscu + running). Voir docs/specs/functional/us/detail-programme-seances-repliables.md.
 */
export function CollapsibleCard({
  title,
  summary,
  children,
  footer,
  defaultExpanded = false,
}: CollapsibleCardProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = () => {
    // Animation sobre ; dégrade en toggle instantané si indisponible.
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch {
      // ignore
    }
    setExpanded((v) => !v);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        onPress={toggle}
        style={styles.header}
      >
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {summary ? (
          <Text style={[styles.summary, { color: colors.textMuted }]} numberOfLines={1}>
            {summary}
          </Text>
        ) : null}
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={18}
          color={colors.textMuted}
        />
      </Pressable>

      {expanded && children ? <View style={styles.body}>{children}</View> : null}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 16 },
  summary: { flexShrink: 0, fontFamily: fontFamily.body, fontSize: 13 },
  body: { gap: 10 },
  footer: {},
});
