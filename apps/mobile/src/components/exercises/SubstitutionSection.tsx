/**
 * US MUSC-F14 — section « Suggestions » en tête d'une liste d'exercices.
 *
 * Un seul composant pour les **deux** surfaces (écran de remplacement en séance, et sélecteur de
 * l'éditeur de programme) : la logique de suggestion ne doit exister qu'à un endroit.
 *
 * ── Ce que la section ne dit jamais ──────────────────────────────────────────────────────────────
 * Aucune promesse sur la douleur ou l'articulation (décision D1) : nous n'avons ni information
 * articulaire ni schéma de mouvement en base. Les suggestions sont **neutres** — « même groupe
 * musculaire », et rien de plus. La seule justification affichée est factuelle et vérifiable :
 * « variante » (déclarée par un humain) ou le matériel, qui répond au cas « machine occupée ».
 *
 * Rien ne s'affiche s'il n'y a rien de pertinent : pas de section vide, pas de suggestion forcée.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Substitution } from '@wellness/shared';

import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  substitutions: Substitution[];
  onPick: (substitution: Substitution) => void;
};

export function SubstitutionSection({ substitutions, onPick }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  // Aucune suggestion pertinente → aucune section. C'est un choix, pas un oubli.
  if (substitutions.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: colors.textMuted }]} maxFontSizeMultiplier={1.3}>
        {t('substitution.title')}
      </Text>

      {substitutions.map((item) => {
        // Justification factuelle, jamais interprétative.
        const reason = item.isDeclaredVariant
          ? t('substitution.reasonVariant')
          : item.differentEquipment && item.equipment !== null
            ? t(`equipment.${item.equipment}`, item.equipment)
            : null;

        return (
          <Pressable
            key={item.id}
            onPress={() => onPick(item)}
            accessibilityRole="button"
            accessibilityLabel={
              reason === null ? item.name : `${item.name}, ${reason}`
            }
            style={({ pressed }) => [
              styles.row,
              { borderColor: colors.border, backgroundColor: colors.surface },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[styles.name, { color: colors.text }]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
            >
              {item.name}
            </Text>
            {reason !== null && (
              <Text
                style={[
                  styles.reason,
                  { color: item.isDeclaredVariant ? colors.accent : colors.textMuted },
                ]}
                maxFontSizeMultiplier={1.3}
              >
                {reason}
              </Text>
            )}
          </Pressable>
        );
      })}

      <Text style={[styles.hint, { color: colors.textMuted }]} maxFontSizeMultiplier={1.3}>
        {t('substitution.hint')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8, marginBottom: 16 },
  title: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11.5,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    // Cible tactile confortable, cohérente avec le reste des listes (≥ 48 dp).
    minHeight: 52,
  },
  pressed: { opacity: 0.85 },
  name: { fontFamily: fontFamily.bodySemi, fontSize: 14.5, flex: 1 },
  reason: { fontFamily: fontFamily.body, fontSize: 12 },
  hint: { fontFamily: fontFamily.body, fontSize: 11.5 },
});
