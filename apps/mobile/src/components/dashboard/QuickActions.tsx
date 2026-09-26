/**
 * US ACCUEIL-03 — **zone 2 de l'accueil** : les actions rapides.
 *
 * ── Le défaut qu'elle corrige, chiffré ───────────────────────────────────────────────────────────
 * Sur les cinq gestes réellement quotidiens, **un seul** était accessible en un tap depuis
 * l'accueil livré :
 *
 *  | Geste                  | Avant                                   | Après |
 *  |------------------------|-----------------------------------------|-------|
 *  | Démarrer la séance     | 1 tap (bouton du widget)                | 1 tap (zone 1) |
 *  | Ajouter un repas       | 1 tap, mais **toujours le petit-déj**   | 1 tap, le bon repas |
 *  | Démarrer une course    | changement d'onglet + 1 tap             | 1 tap |
 *  | Se peser               | 3 taps (Muscu › Progression › Mensur.)  | 1 tap |
 *  | Check-in bien-être     | 3 taps (Réglages › Suivi › Bien-être)   | 1 tap |
 *
 * ⚠️ **Quatre pastilles, pas cinq.** Sur un cadre de 392 px, quatre cibles occupent 82 px chacune,
 * ce qui laisse la cible tactile largement au-dessus des 44 dp exigés (navigation-ux §8). Une
 * cinquième descendrait à ~64 px de large : encore acceptable en largeur, mais le libellé passerait
 * sur deux lignes et deviendrait illisible aux grandes tailles de police système.
 *
 * ⚠️ **Filtrées par piliers actifs** (décision H — intégration sans imposition) : proposer
 * « Course » à quelqu'un qui n'a pas activé le pilier serait lui imposer une fonctionnalité qu'il a
 * explicitement écartée. La pesée et le bien-être, eux, sont transverses.
 */

import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { mealForHour, resolveActivePillars, type MealType } from '@wellness/shared';

import { useSettings } from '@/data/repositories/settings-repository';
import { useCurrentHour, useTodayKey } from '@/hooks/useTodayKey';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type QuickAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Mise en avant : l'action est celle que le moment réclame. */
  primary?: boolean;
};

export function QuickActions({
  /**
   * Repas mis en avant, quand la carte « maintenant » réclame une saisie. `undefined` → le repas
   * est déduit de l'heure courante.
   */
  highlightMeal,
}: {
  highlightMeal?: MealType;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const hour = useCurrentHour();
  const todayKey = useTodayKey();
  const { settings } = useSettings();
  const activePillars = resolveActivePillars(settings?.activePillars);

  // Le repas ouvert suit l'heure — c'est la correction du `meal: 'breakfast'` en dur du widget
  // nutrition, qui ouvrait le petit-déjeuner à 20 h comme à 7 h.
  const meal = highlightMeal ?? mealForHour(hour);

  const actions: QuickAction[] = [];

  if (activePillars.includes('nutrition')) {
    actions.push({
      key: 'meal',
      label: t(`home.quick.meal.${meal}`),
      icon: 'add',
      primary: highlightMeal != null,
      onPress: () =>
        router.push({ pathname: '/food-picker', params: { date: todayKey, meal } }),
    });
  }

  if (activePillars.includes('running')) {
    actions.push({
      key: 'run',
      label: t('home.quick.run'),
      icon: 'walk',
      onPress: () => router.push('/run'),
    });
  }

  // Transverses : le poids et le bien-être n'appartiennent à aucun pilier.
  actions.push({
    key: 'weigh-in',
    label: t('home.quick.weighIn'),
    icon: 'speedometer-outline',
    onPress: () => router.push('/nutrition-stats?tab=weight'),
  });
  actions.push({
    key: 'wellbeing',
    label: t('home.quick.wellbeing'),
    icon: 'heart-outline',
    onPress: () => router.push('/wellbeing'),
  });

  // Un utilisateur « musculation seule » n'a que deux transverses : la rangée reste utile, mais on
  // ne l'affiche pas pour une seule pastille — ce serait un bouton déguisé en barre.
  if (actions.length < 2) return null;

  return (
    <View style={styles.row} accessibilityRole="toolbar">
      {actions.slice(0, 4).map((a) => (
        <Pressable
          key={a.key}
          onPress={a.onPress}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          style={StyleSheet.flatten([
            styles.pill,
            a.primary
              ? { backgroundColor: colors.accent, borderColor: colors.accent }
              : { backgroundColor: colors.surface, borderColor: colors.border },
          ])}
        >
          <Ionicons
            name={a.icon}
            size={20}
            color={a.primary ? colors.accentText : colors.text}
          />
          <Text
            style={[styles.label, { color: a.primary ? colors.accentText : colors.text }]}
            numberOfLines={1}
            // La pastille ne peut pas s'élargir : au-delà, le libellé serait rogné. On borne donc
            // la mise à l'échelle plutôt que de laisser couper (navigation-ux §8).
            maxFontSizeMultiplier={1.2}
          >
            {a.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    minWidth: 0,
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  label: { fontFamily: fontFamily.bodySemi, fontSize: 11 },
});
