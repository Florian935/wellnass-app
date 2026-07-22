import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PILLARS, type Pillar } from '@wellness/shared';
import { useSettings } from '@/data/repositories/settings-repository';
import { useMenuAccent } from '@/stores/menu-accent-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type TabIcon = keyof typeof Ionicons.glyphMap;

const PILLAR_ICON: Record<Pillar, TabIcon> = {
  strength: 'barbell',
  running: 'walk',
  nutrition: 'nutrition',
};

/**
 * Barre d'onglets principale (spec navigation-ux §2). Accueil est toujours présent ;
 * chaque pilier n'apparaît que s'il est activé (décision H — masquage des piliers non
 * activés, réactivable depuis les Réglages).
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { settings } = useSettings();
  const menuColorsEnabled = useMenuAccent((s) => s.enabled);
  const menuColors = useMenuAccent((s) => s.colors);
  // Tant que les réglages ne sont pas chargés, on affiche tous les piliers par défaut.
  const activePillars = settings?.activePillars ?? [...PILLARS];

  const isActive = (pillar: Pillar) => activePillars.includes(pillar);
  // Couleurs par menu si activé (réglages), sinon accent unique pour tous les onglets.
  const tabTint = (menu: keyof typeof menuColors) =>
    menuColorsEnabled ? menuColors[menu] : colors.accent;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Chaque onglet actif prend sa propre couleur de menu (surchargé par écran ci-dessous).
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fontFamily.bodySemi, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarActiveTintColor: tabTint('home'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="strength"
        options={{
          title: t('tabs.strength'),
          href: isActive('strength') ? undefined : null,
          tabBarActiveTintColor: tabTint('strength'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={PILLAR_ICON.strength} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="running"
        options={{
          title: t('tabs.running'),
          href: isActive('running') ? undefined : null,
          tabBarActiveTintColor: tabTint('running'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={PILLAR_ICON.running} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: t('tabs.nutrition'),
          href: isActive('nutrition') ? undefined : null,
          tabBarActiveTintColor: tabTint('nutrition'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={PILLAR_ICON.nutrition} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
