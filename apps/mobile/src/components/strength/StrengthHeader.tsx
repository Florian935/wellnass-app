/**
 * L'en-tête du hub Musculation — US MUSCU-UX07, §4.1.
 *
 * Remplace la scène de DASH-01 (`StrengthStage`) : le même dégradé rouge fonte et la même coulée sous
 * la page, mais **compact** et **sans matière** (la silhouette n'était pas nécessaire, Q3). Il porte le
 * titre, les deux accès de toujours (planning, bibliothèque) et les trois onglets.
 *
 * ⚠️ Les onglets **défilent avec la page** (D2) : le 23/09/2026, Florian a fait retirer sur les
 * quatre piliers le bandeau opaque qui restait collé en haut au défilement. Un sélecteur collé le
 * recréerait. Pour remonter, un nouvel appui sur l'onglet Muscu de la barre du bas.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { HUB_SECTIONS, type HubSection } from '@wellness/shared';
import { PillarStage, useStageTheme } from '@/components/stage/PillarStage';
import { StageIconButton } from '@/components/stage/StageIconButton';
import { hapticSelect } from '@/lib/haptics';
import { fontFamily } from '@/theme/fonts';

type Props = {
  section: HubSection;
  onSection: (section: HubSection) => void;
  onPlanning: () => void;
  onDirectory: () => void;
};

export function StrengthHeader({ section, onSection, onPlanning, onDirectory }: Props) {
  const { t } = useTranslation();
  const stage = useStageTheme('strength');

  return (
    <PillarStage pillar="strength" testID="strength-header">
      <View style={styles.topRow}>
        <Text style={[styles.title, { color: stage.ink }]} accessibilityRole="header">
          {t('tabs.strength')}
        </Text>
        <View style={styles.icons}>
          <StageIconButton icon="calendar-outline" label={t('planning.title')} onPress={onPlanning} color={stage.ink} />
          <StageIconButton
            icon="library-outline"
            label={t('strengthHub.directory')}
            onPress={onDirectory}
            color={stage.ink}
          />
        </View>
      </View>

      <View
        accessibilityRole="tablist"
        style={[styles.tabs, { backgroundColor: stage.glass, borderColor: stage.glassBorder }]}
      >
        {HUB_SECTIONS.map((key) => {
          const selected = key === section;
          return (
            <Pressable
              key={key}
              testID={`strength-tab-${key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => {
                if (selected) return;
                hapticSelect();
                onSection(key);
              }}
              style={[styles.tab, selected && { backgroundColor: stage.solid }]}
            >
              <Text
                style={[styles.tabLabel, { color: selected ? stage.onSolid : stage.ink }]}
                numberOfLines={1}
              >
                {t(`strengthHub.sections.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </PillarStage>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 30, letterSpacing: -0.8 },
  icons: { flexDirection: 'row', marginRight: -8 },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, borderWidth: 1 },
  tab: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontFamily: fontFamily.bodyBold, fontSize: 14.5 },
});
