import type { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { resolveActivePillars, type Pillar } from '@wellness/shared';
import { TabBarIcon } from '@/components/motion/TabBarIcon';
import { useSettings } from '@/data/repositories/settings-repository';
import type { MenuKey } from '@/stores/menu-accent-store';
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
  const { colors, scheme } = useTheme();
  const { settings } = useSettings();
  const focusedMenu = useMenuAccent((s) => s.focusedMenu);
  const menuColorsEnabled = useMenuAccent((s) => s.enabled);
  const menuColors = useMenuAccent((s) => s.colors);
  // Tant que les réglages ne sont pas chargés, on affiche tous les piliers par défaut.
  const activePillars = resolveActivePillars(settings?.activePillars);

  const isActive = (pillar: Pillar) => activePillars.includes(pillar);
  // Couleurs par menu si activé (réglages), sinon accent unique pour tous les onglets.
  // US DASH-01 : sans « couleur par menu », chaque onglet actif prend la couleur de son pilier — lisible
  // dans le thème courant (jetons `pillar*`, R10). Avant, tous les onglets prenaient l'accent terracotta :
  // l'identité des piliers n'existait que derrière un réglage éteint par défaut.
  const PILLAR_TINT: Record<MenuKey, string> = {
    home: colors.pillarHome,
    strength: colors.pillarStrength,
    running: colors.pillarRunning,
    nutrition: colors.pillarNutrition,
  };
  const tabTint = (menu: MenuKey) => (menuColorsEnabled ? menuColors[menu] : PILLAR_TINT[menu]);
  // Les scènes muscu, course et nutrition sont sombres dans les deux thèmes : icônes de la barre d'état
  // claires. L'accueil suit le thème. Sous un écran empilé (`focusedMenu` nul), on rend la main au thème.
  const statusStyle =
    focusedMenu && focusedMenu !== 'home' ? 'light' : scheme === 'dark' ? 'light' : 'dark';

  return (
    <>
      <StatusBar style={statusStyle} />
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
            tabBarIcon: ({ color, size, focused }) => (
              <TabBarIcon name="home" color={color} size={size} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="strength"
          options={{
            title: t('tabs.strength'),
            href: isActive('strength') ? undefined : null,
            tabBarActiveTintColor: tabTint('strength'),
            tabBarIcon: ({ color, size, focused }) => (
              <TabBarIcon name={PILLAR_ICON.strength} color={color} size={size} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="running"
          options={{
            title: t('tabs.running'),
            href: isActive('running') ? undefined : null,
            tabBarActiveTintColor: tabTint('running'),
            tabBarIcon: ({ color, size, focused }) => (
              <TabBarIcon name={PILLAR_ICON.running} color={color} size={size} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="nutrition"
          options={{
            title: t('tabs.nutrition'),
            href: isActive('nutrition') ? undefined : null,
            tabBarActiveTintColor: tabTint('nutrition'),
            tabBarIcon: ({ color, size, focused }) => (
              <TabBarIcon
                name={PILLAR_ICON.nutrition}
                color={color}
                size={size}
                focused={focused}
              />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
