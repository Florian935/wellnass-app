/**
 * L'en-tête du hub Bien-être — US BIEN-02.
 *
 * Le violet de nuit du pilier (`stageTheme('wellbeing')`), coins bas arrondis, la coulée sous la page.
 * Il porte « Bien-être », deux accès (l'historique en courbes de BIEN-01, les réglages du pilier) et les
 * trois onglets. Sur Aujourd'hui, la forme du jour suit en enfant.
 *
 * Même patron que `NutritionHeader` (NUTRI-UX03), écrit à part : la factorisation d'un
 * `PillarTabsHeader` commun reste notée au §11 de NUTRI-UX03.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { WELLBEING_SECTIONS, type WellbeingSection } from '@wellness/shared';
import { PillarStage, useStageTheme } from '@/components/stage/PillarStage';
import { StageIconButton } from '@/components/stage/StageIconButton';
import { hapticSelect } from '@/lib/haptics';
import { fontFamily } from '@/theme/fonts';

type Props = {
  section: WellbeingSection;
  onSection: (section: WellbeingSection) => void;
  onHistory: () => void;
  onSettings: () => void;
  children?: ReactNode;
};

export function WellbeingHeader({ section, onSection, onHistory, onSettings, children }: Props) {
  const { t } = useTranslation();
  const stage = useStageTheme('wellbeing');

  return (
    <PillarStage pillar="wellbeing" testID="wellbeing-header">
      <View style={styles.topRow}>
        <Text style={[styles.title, { color: stage.ink }]} accessibilityRole="header" numberOfLines={1}>
          {t('wellbeingHub.title')}
        </Text>
        <View style={styles.icons}>
          <StageIconButton icon="stats-chart-outline" label={t('wellbeingHub.icons.history')} onPress={onHistory} color={stage.ink} />
          <StageIconButton icon="options-outline" label={t('wellbeingHub.icons.settings')} onPress={onSettings} color={stage.ink} />
        </View>
      </View>

      <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: stage.glass, borderColor: stage.glassBorder }]}>
        {WELLBEING_SECTIONS.map((key) => {
          const selected = key === section;
          return (
            <Pressable
              key={key}
              testID={`wellbeing-tab-${key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => {
                if (selected) return;
                hapticSelect();
                onSection(key);
              }}
              style={[styles.tab, selected && { backgroundColor: stage.solid }]}
            >
              <Text style={[styles.tabLabel, { color: selected ? stage.onSolid : stage.ink }]} numberOfLines={1}>
                {t(`wellbeingHub.sections.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {children}
    </PillarStage>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flexShrink: 1, fontFamily: fontFamily.displayXBold, fontSize: 30, letterSpacing: -0.8 },
  icons: { flexDirection: 'row', marginRight: -8 },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, borderWidth: 1 },
  tab: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
});
