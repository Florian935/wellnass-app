/**
 * Hub Bien-être — US BIEN-02 (décisions de Florian du 01/10/2026, D1 à D8).
 *
 * ── Pourquoi un quatrième pilier ─────────────────────────────────────────────────────────────────
 * Le check-in (BIEN-01), la nuit (LABO-01), les douleurs (DOUL-01), le cycle (CYCLE-01) et les pas
 * (PAS-01) existaient, éparpillés dans quatre écrans et une feuille : personne n'allait « dans » son
 * bien-être. Le pilier leur donne une maison, ajoute la qualité de la nuit, l'envie de s'entraîner et
 * le contexte du jour, et surtout **la boucle** : l'état du jour change la séance et l'assiette.
 *
 * ── Ce qu'il est ─────────────────────────────────────────────────────────────────────────────────
 * Le même patron que les trois autres hubs (MUSCU-UX07, CARDIO-UX03, NUTRI-UX03) :
 *   · **Aujourd'hui** — la forme du jour dans la scène, les deux check-ins, ce que ça change, les nuits ;
 *   · **Journal** — le mois en couleurs, les jours et ce que les piliers y ont fait ;
 *   · **Ce qui compte** — l'écho du lien du Labo, ce qui pèse sur les nuits, la régularité, les moyennes.
 *
 * Un **pilier activable** pour l'utilisateur, mais pas un `Pillar` dans le code (il n'a ni disque au
 * Labo, ni programme, ni guidage) : son onglet suit `wellbeingPillarEnabled`. Ouvert par un lien alors
 * qu'il est éteint, l'écran le dit et propose de l'activer — jamais une page vide.
 */

import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, type ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, useScrollToTop } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { resolveWellbeingSection } from '@wellness/shared';

import { Button } from '@/components/Button';
import { StageScrollView } from '@/components/stage/StageScrollView';
import { WellbeingHeader } from '@/components/wellbeing/WellbeingHeader';
import { WellbeingStageSummary } from '@/components/wellbeing/WellbeingStageSummary';
import { InsightsSection } from '@/components/wellbeing/sections/InsightsSection';
import { JournalSection } from '@/components/wellbeing/sections/JournalSection';
import { TodaySection } from '@/components/wellbeing/sections/TodaySection';
import { useWellbeingPillar } from '@/data/repositories/wellbeing-pillar-repository';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import { useWellbeingSection } from '@/stores/wellbeing-section-store';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function WellbeingHubScreen() {
  useMenuFocus('wellbeing');
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const pillar = useWellbeingPillar();

  const remembered = useWellbeingSection((s) => s.section);
  const setSection = useWellbeingSection((s) => s.setSection);
  const section = resolveWellbeingSection({ param: params.section, remembered });
  useEffect(() => {
    // Un paramètre de route est lu **une fois** : laissé en place, il écraserait le choix suivant.
    if (params.section === undefined) return;
    setSection(section);
    router.setParams({ section: undefined });
  }, [params.section, section, setSection, router]);

  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  return (
    <StageScrollView
      pillar="wellbeing"
      scrollRef={scrollRef}
      testID="wellbeing-hub"
      stage={
        <WellbeingHeader
          section={section}
          onSection={setSection}
          onHistory={() => router.push('/wellbeing')}
          onSettings={() => router.push('/wellbeing-settings')}
        >
          {pillar.enabled && section === 'today' ? <WellbeingStageSummary /> : null}
        </WellbeingHeader>
      }
    >
      {!pillar.enabled ? (
        pillar.isLoading ? null : (
          <View style={styles.off} testID="wellbeing-hub-off">
            <Text style={[styles.offTitle, { color: colors.text }]}>{t('wellbeingHub.off.title')}</Text>
            <Text style={[styles.offBody, { color: colors.textMuted }]}>{t('wellbeingHub.off.body')}</Text>
            <Button label={t('wellbeingHub.off.cta')} onPress={() => router.push('/wellbeing-settings')} />
          </View>
        )
      ) : section === 'today' ? (
        <TodaySection />
      ) : section === 'journal' ? (
        <JournalSection />
      ) : (
        <InsightsSection />
      )}
    </StageScrollView>
  );
}

const styles = StyleSheet.create({
  off: { gap: 12, paddingVertical: 12 },
  offTitle: { fontFamily: fontFamily.displayBold, fontSize: 20 },
  offBody: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 21 },
});
