/**
 * L'en-tête du hub Nutrition — US NUTRI-UX03, §4.1.
 *
 * Le vert du pilier (`stageTheme('nutrition')`), coins bas arrondis, la coulée sous la page. Il porte
 * « Alimentation » (décision Q7), les trois accès de toujours (planning repas, bibliothèque, objectif
 * et réglages) et les trois onglets. Sur Aujourd'hui, le remplissage suit en enfant, avec sa matière
 * (le niveau qui monte) ; sur Historique et Progrès, l'en-tête reste compact.
 *
 * ⚠️ Les onglets **défilent avec la page** (D2) : le 23/09/2026, Florian a fait retirer sur les
 * quatre piliers le bandeau opaque qui restait collé en haut au défilement. Pour remonter, un nouvel
 * appui sur l'onglet Alim de la barre du bas.
 *
 * Même patron que `StrengthHeader` (MUSCU-UX07), écrit à part (§11 de la spec).
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NUTRITION_SECTIONS, type NutritionSection } from '@wellness/shared';
import { PillarStage, useStageTheme } from '@/components/stage/PillarStage';
import { StageIconButton } from '@/components/stage/StageIconButton';
import { hapticSelect } from '@/lib/haptics';
import { fontFamily } from '@/theme/fonts';

type Props = {
  section: NutritionSection;
  onSection: (section: NutritionSection) => void;
  onPlanning: () => void;
  onLibrary: () => void;
  onSettings: () => void;
  /** Peint derrière le contenu (le niveau du remplissage), sur Aujourd'hui seulement. */
  matter?: ReactNode;
  children?: ReactNode;
};

export function NutritionHeader({ section, onSection, onPlanning, onLibrary, onSettings, matter, children }: Props) {
  const { t } = useTranslation();
  const stage = useStageTheme('nutrition');

  return (
    <PillarStage pillar="nutrition" testID="nutrition-header" matter={matter}>
      <View style={styles.topRow}>
        <Text style={[styles.title, { color: stage.ink }]} accessibilityRole="header" numberOfLines={1}>
          {t('nutritionHub.title')}
        </Text>
        <View style={styles.icons}>
          <StageIconButton
            icon="calendar-outline"
            label={t('nutritionHub.icons.planning')}
            onPress={onPlanning}
            color={stage.ink}
          />
          <StageIconButton icon="library-outline" label={t('nutritionHub.icons.library')} onPress={onLibrary} color={stage.ink} />
          <StageIconButton icon="options-outline" label={t('nutritionHub.icons.settings')} onPress={onSettings} color={stage.ink} />
        </View>
      </View>

      <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: stage.glass, borderColor: stage.glassBorder }]}>
        {NUTRITION_SECTIONS.map((key) => {
          const selected = key === section;
          return (
            <Pressable
              key={key}
              testID={`nutrition-tab-${key}`}
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
                {t(`nutritionHub.sections.${key}`)}
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
  tabLabel: { fontFamily: fontFamily.bodyBold, fontSize: 14.5 },
});
