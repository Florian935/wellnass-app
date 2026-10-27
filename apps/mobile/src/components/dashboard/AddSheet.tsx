/**
 * US ACCUEIL-08 — **le « + » et sa feuille « Noter »** (décision D4 : un bouton flottant, sur
 * l'accueil seulement).
 *
 * Remplace la barre d'actions rapides, arrivée au pli de l'écran (constat 12) : le repas du moment,
 * un scan, la pesée, le check-in, un verre d'eau, une activité, une course libre, une séance libre —
 * filtrés par piliers actifs (décision H). Chaque tuile mène à l'écran qui sait déjà le faire ; seul
 * le verre d'eau s'écrit sur place, c'est le geste d'un tap du pilier.
 *
 * US ACCUEIL-09 — la feuille monte, ses tuiles arrivent en cascade (`StaggerIn`, au montage de la
 * feuille seulement), et le verre d'eau noté se confirme par le toast de l'écran (`onWaterAdded`).
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { DEFAULT_GLASS_ML, mealForHour, type Pillar } from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import { StaggerIn } from '@/components/motion/StaggerIn';
import { useStageTheme } from '@/components/stage/PillarStage';
import { addWater } from '@/data/repositories/water-repository';
import { useTodayKey } from '@/hooks/useTodayKey';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { withAlpha } from '@/theme/color-utils';

type IconName = keyof typeof Ionicons.glyphMap;

type Tile = {
  key: string;
  label: string;
  icon: IconName;
  color: string;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  pillars: readonly Pillar[];
  /** Heure décimale courante (réactive) : le repas proposé est celui de l'heure. */
  hour: number;
  /** Le verre d'eau est noté : l'écran le dit (toast, ACCUEIL-09). */
  onWaterAdded?: () => void;
};

/** Le « + » flottant de l'accueil : turquoise → rose, au-dessus de la barre d'onglets. */
export function AddFab({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const stage = useStageTheme('home');
  return (
    <PressableScale
      haptic="confirm"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('home.add.fab')}
      testID="home-add-fab"
      style={styles.fab}
    >
      <LinearGradient
        colors={['#2dd4bf', '#f472b6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fabFill}
      >
        <Ionicons name="add" size={28} color={stage.onSolid} />
      </LinearGradient>
    </PressableScale>
  );
}

export function AddSheet({ visible, onClose, pillars, hour, onWaterAdded }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const todayKey = useTodayKey();

  const go = (href: Href) => {
    onClose();
    router.push(href);
  };

  const tiles: Tile[] = [];
  if (pillars.includes('nutrition')) {
    // L'heure vient de l'écran (`useCurrentClock`), jamais de `new Date()` au rendu : React Compiler
    // la gèlerait au montage de la feuille, qui reste montée tant que l'accueil l'est.
    const meal = mealForHour(hour);
    tiles.push(
      {
        key: 'meal',
        label: t(`home.quick.meal.${meal}`),
        icon: 'restaurant-outline',
        color: colors.pillarNutrition,
        onPress: () => go({ pathname: '/food-picker', params: { date: todayKey, meal } }),
      },
      {
        key: 'scan',
        label: t('home.add.scan'),
        icon: 'barcode-outline',
        color: colors.pillarNutrition,
        onPress: () => go({ pathname: '/food-scan', params: { date: todayKey, meal } }),
      },
    );
  }
  tiles.push(
    {
      key: 'weigh',
      label: t('home.quick.weighIn'),
      icon: 'scale-outline',
      color: colors.pillarHome,
      onPress: () => go('/nutrition-stats?tab=weight'),
    },
    {
      key: 'checkin',
      label: t('home.add.checkin'),
      icon: 'happy-outline',
      color: colors.pillarWellbeing,
      onPress: () => go('/wellbeing'),
    },
  );
  if (pillars.includes('nutrition')) {
    tiles.push({
      key: 'water',
      label: t('home.add.water'),
      icon: 'water-outline',
      color: colors.pillarRunning,
      onPress: () => {
        onClose();
        void addWater(todayKey, DEFAULT_GLASS_ML)
          .then(() => onWaterAdded?.())
          .catch(() => undefined);
      },
    });
  }
  tiles.push({
    key: 'activity',
    label: t('home.add.activity'),
    icon: 'flash-outline',
    color: colors.pillarHome,
    onPress: () => go('/activity'),
  });
  if (pillars.includes('running')) {
    tiles.push({
      key: 'run',
      label: t('home.add.run'),
      icon: 'walk-outline',
      color: colors.pillarRunning,
      onPress: () => go('/run'),
    });
  }
  if (pillars.includes('strength')) {
    tiles.push({
      key: 'workout',
      label: t('home.add.workout'),
      icon: 'barbell-outline',
      color: colors.pillarStrength,
      // Le hub muscu sait démarrer une séance libre, choisir un modèle ou reprendre celle en cours.
      onPress: () => go('/(tabs)/strength'),
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      />
      <View
        style={[styles.sheet, { backgroundColor: colors.surface }]}
        accessibilityViewIsModal
        testID="home-add-sheet"
      >
        <View style={[styles.grip, { backgroundColor: colors.borderStrong }]} />
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {t('home.add.title')}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>{t('home.add.meta')}</Text>
        </View>
        <View style={styles.grid}>
          {tiles.map((tile, index) => (
            <StaggerIn key={tile.key} index={index} style={styles.tileSlot}>
              <PressableScale
                haptic="confirm"
                onPress={tile.onPress}
                accessibilityRole="button"
                accessibilityLabel={tile.label}
                testID={`home-add-${tile.key}`}
                style={[
                  styles.tile,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <View style={[styles.tileIcon, { backgroundColor: withAlpha(tile.color, 0.14) }]}>
                  <Ionicons name={tile.icon} size={21} color={tile.color} />
                </View>
                <Text style={[styles.tileLabel, { color: colors.text }]} numberOfLines={2}>
                  {tile.label}
                </Text>
              </PressableScale>
            </StaggerIn>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 58,
    height: 58,
    borderRadius: 20,
    shadowColor: '#db2777',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  fabFill: { flex: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,10,6,0.46)' },
  sheet: {
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 26,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  grip: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 22, letterSpacing: -0.6 },
  meta: { fontFamily: fontFamily.bodyBold, fontSize: 12.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  tileSlot: { width: '23%', flexGrow: 1 },
  tile: {
    minHeight: 86,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 18,
    borderWidth: 1,
  },
  tileIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11.5,
    textAlign: 'center',
    lineHeight: 14,
  },
});
