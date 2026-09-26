/**
 * L'en-tête du hub Course — US CARDIO-UX03, §4.1.
 *
 * Remplace la scène de DASH-01 (`RunStage`) : le même dégradé bleu et la même coulée sous la page,
 * mais **compact**. La trace qui défile reste (Q3, décision de Florian) — **en filigrane** : elle ne
 * réserve plus 360 px de hauteur, elle court derrière le titre et les onglets, avec la même règle
 * d'animation (onglet au premier plan, app active, mouvement permis : `useLoopActive`).
 *
 * Il porte le titre, trois accès (planning ; profil coureur, qui garde son entrée d'en-tête depuis
 * CARDIO-UX01 R2a parce qu'il porte l'allure de référence ; programmes) et les trois onglets.
 *
 * ⚠️ Les onglets **défilent avec la page** (D1) : le 23/09/2026, Florian a fait retirer sur les
 * quatre piliers le bandeau opaque qui restait collé en haut au défilement. Pour remonter, un nouvel
 * appui sur l'onglet Course de la barre du bas.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RUN_HUB_SECTIONS, type RunHubSection } from '@wellness/shared';
import { PillarStage, useStageTheme } from '@/components/stage/PillarStage';
import { StageIconButton } from '@/components/stage/StageIconButton';
import { FlowTrace } from '@/components/stage/matter/FlowTrace';
import { useLoopActive } from '@/hooks/useLoopActive';
import { hapticSelect } from '@/lib/haptics';
import { fontFamily } from '@/theme/fonts';

/** Hauteur de la trace : celle de l'en-tête, pas celle de l'ancienne scène. */
const TRACE_HEIGHT = 170;

type Props = {
  section: RunHubSection;
  onSection: (section: RunHubSection) => void;
  onPlanning: () => void;
  onProfile: () => void;
  onPrograms: () => void;
};

export function RunHeader({ section, onSection, onPlanning, onProfile, onPrograms }: Props) {
  const { t } = useTranslation();
  const stage = useStageTheme('running');
  const active = useLoopActive('running');

  return (
    <PillarStage
      pillar="running"
      testID="run-header"
      matter={
        <View style={styles.filigree}>
          <FlowTrace active={active} color={stage.accent} width={430} height={TRACE_HEIGHT} />
        </View>
      }
    >
      <View style={styles.topRow}>
        <Text style={[styles.title, { color: stage.ink }]} accessibilityRole="header">
          {t('tabs.running')}
        </Text>
        <View style={styles.icons}>
          <StageIconButton icon="calendar-outline" label={t('planning.title')} onPress={onPlanning} color={stage.ink} />
          <StageIconButton icon="person-outline" label={t('running.profile.title')} onPress={onProfile} color={stage.ink} />
          <StageIconButton
            icon="library-outline"
            label={t('running.library.title')}
            onPress={onPrograms}
            color={stage.ink}
          />
        </View>
      </View>

      <View
        accessibilityRole="tablist"
        style={[styles.tabs, { backgroundColor: stage.glass, borderColor: stage.glassBorder }]}
      >
        {RUN_HUB_SECTIONS.map((key) => {
          const selected = key === section;
          return (
            <Pressable
              key={key}
              testID={`run-tab-${key}`}
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
                {t(`runningHub.sections.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </PillarStage>
  );
}

const styles = StyleSheet.create({
  // Le filigrane : la trace passe derrière le texte sans jamais lui disputer le contraste.
  filigree: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.45 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 30, letterSpacing: -0.8 },
  icons: { flexDirection: 'row', marginRight: -8 },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, borderWidth: 1 },
  tab: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontFamily: fontFamily.bodyBold, fontSize: 14.5 },
});
