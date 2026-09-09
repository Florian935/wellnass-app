/**
 * Écran d'accueil — **les cinq zones** (US ACCUEIL-01 → 05, 09/09/2026).
 *
 * ── Ce que cet écran était ───────────────────────────────────────────────────────────────────────
 * Un en-tête (salut figé + **nom de l'application** en 28 px + sync + « Personnaliser ») et une
 * `WidgetGrid`. Rien d'autre. Tout y était déplaçable et masquable, donc **rien n'y était garanti**
 * — alors que les deux hubs pilier, eux, ont chacun une carte d'action épinglée hors grille. L'écran
 * d'atterrissage était le seul à n'avoir aucune priorité.
 *
 * ── Ce qu'il est ─────────────────────────────────────────────────────────────────────────────────
 *   0 · `HomeHeader`   — date en clair + accroche contextuelle          (fixe)
 *   1 · `NowCard`      — la prochaine action, un seul sujet             (épinglée)
 *   2 · `QuickActions` — les quatre gestes du quotidien à un tap        (fixe)
 *   3 · `WidgetGrid`   — la grille personnalisable, densifiée           (personnalisable)
 *   4 · `UpNext`       — « la suite », trois lignes de texte            (fixe)
 *
 * ⚠️ **Les zones 0/1/2/4 ne sont pas des widgets** et ne consomment donc aucune place au plafond
 * de huit d'ADR-007 §2. C'est écrit dans l'ADR (amendement du 09/09/2026) parce que la distinction
 * est exactement le genre de nuance qu'une relecture rapide écrase — et le plafond ne doit pas
 * devenir une excuse pour laisser l'accueil sans hiérarchie.
 *
 * ⚠️ **Le mode édition masque le chrome.** Pendant la personnalisation, seules la grille et ses
 * consignes restent : garder une carte épinglée et une barre d'actions au-dessus d'une grille
 * qu'on réorganise ferait croire qu'elles sont déplaçables aussi.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { HomeWidgetId, WidgetId, WidgetSize } from '@wellness/shared';
import { Screen } from '@/components/Screen';
import { DashboardWidget } from '@/components/dashboard/dashboard-widgets';
import { HomeHeader } from '@/components/dashboard/HomeHeader';
import { NowCard } from '@/components/dashboard/NowCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { UpNext } from '@/components/dashboard/UpNext';
import { WidgetGrid } from '@/components/widgets/WidgetGrid';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import { useNowAction } from '@/hooks/useNowAction';
import { useProfile } from '@/data/repositories/profile-repository';
import { useActivationPath } from '@/data/repositories/activation-path-repository';
import { useInsights } from '@/data/repositories/insights-repository';
import { InsightsProvider } from '@/data/repositories/insights-context';
import { useRealLifeState } from '@/data/repositories/real-life-repository';
import { useSyncRefresh } from '@/hooks/useSyncRefresh';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function HomeScreen() {
  useMenuFocus('home');
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { profile } = useProfile();
  const firstName = profile?.firstName ?? '';

  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);

  // La décision est calculée **une seule fois ici** et partagée entre l'en-tête (zone 0), la carte
  // (zone 1) et la mise en avant du repas (zone 2) : trois appels à `useNowAction` monteraient
  // trois fois l'union d'une douzaine de hooks sur l'écran le plus ouvert de l'app — exactement le
  // défaut qu'`InsightsProvider` a corrigé pour les insights.
  const { action } = useNowAction();

  // ── Widgets conditionnels : ils rendent `null` hors condition, il faut donc les exclure de la
  // grille, sinon `WidgetGrid` réserve leur cellule et laisse un **trou**. Ce défaut s'est produit
  // quatre fois sur ce dashboard.
  const activationPathActive = useActivationPath().show;
  // US INSIGHTS-01 : la porte d'entrée de l'écran « Insights ». Calculée **une seule fois** ici,
  // puis diffusée au widget via `InsightsProvider` (voir `insights-context.tsx`).
  const insightsValue = useInsights();
  const insightsActive = insightsValue.insights.length > 0;
  const isWidgetActive = (id: WidgetId) => {
    if (id === 'activation-path') return activationPathActive;
    if (id === 'insights') return insightsActive;
    return true;
  };

  // US ACCUEIL-04 — forme **effective** de `real-life` : `row` hors période (une ligne suffit),
  // `wide` pendant (échéance, objectifs et deux boutons n'entrent pas dans une bande). La
  // disposition enregistrée n'est pas réécrite : le widget retrouve sa bande à la fin de la période.
  const { activePeriod } = useRealLifeState();
  const sizeFor = (id: WidgetId, stored: WidgetSize): WidgetSize =>
    id === 'real-life' && activePeriod !== null && stored === 'row' ? 'wide' : stored;

  const { refreshing, onRefresh } = useSyncRefresh();

  const toggleEditing = () => {
    // Analytics : uniquement à l'entrée en mode édition (pas à la sortie). Fire-and-forget.
    if (!editing) void track(ANALYTICS_EVENTS.dashboardCustomized);
    setEditing((v) => !v);
  };

  const renderWidget = (id: WidgetId, size: WidgetSize) => (
    <DashboardWidget id={id as HomeWidgetId} size={size} />
  );

  return (
    <Screen edges={['top']}>
      {editing ? (
        <View style={styles.editHeader}>
          <View style={styles.editTexts}>
            {/* US UX-04 : le mode édition annonce **comment** déplacer un widget. Le geste
                (appui long) existait déjà mais restait invisible : personne ne le découvrait. */}
            <Text style={[styles.editTitle, { color: colors.text }]}>
              {t('home.customize.editHint')}
            </Text>
            <Text style={[styles.editHint, { color: colors.textMuted }]} maxFontSizeMultiplier={1.4}>
              {t('home.customize.dragHint')}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: true }}
            accessibilityLabel={t('home.customize.done')}
            onPress={toggleEditing}
            hitSlop={8}
            style={StyleSheet.flatten([
              styles.doneBtn,
              { backgroundColor: colors.accent, borderColor: colors.accent },
            ])}
          >
            <Ionicons name="checkmark" size={16} color={colors.accentText} />
            <Text style={[styles.doneLabel, { color: colors.accentText }]}>
              {t('home.customize.done')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <HomeHeader action={action} firstName={firstName} />
      )}

      <ScrollView
        contentContainerStyle={styles.blocks}
        showsVerticalScrollIndicator={false}
        // Neutralise le défilement pendant un drag actif (maquette / spec 7.2).
        scrollEnabled={!dragging}
        refreshControl={
          // US ACCUEIL-05 : le geste est un réflexe et ne renvoyait rien — il n'existait pas un
          // seul `RefreshControl` dans l'app. Désactivé en édition, où le geste vertical sert au
          // glisser-déposer.
          editing ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          )
        }
      >
        {!editing ? (
          <>
            <NowCard />
            <QuickActions
              highlightMeal={action.kind === 'meal-due' ? action.meal : undefined}
            />
          </>
        ) : null}

        {/* US INSIGHTS-01 — un seul provider autour de la grille, pas un par cellule. */}
        <InsightsProvider value={insightsValue}>
          <WidgetGrid
            screen="home"
            editing={editing}
            renderWidget={renderWidget}
            onDragActiveChange={setDragging}
            isActive={isWidgetActive}
            sizeFor={sizeFor}
          />
        </InsightsProvider>

        {!editing ? <UpNext onCustomize={toggleEditing} /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  editTexts: { flex: 1, gap: 2 },
  editTitle: { fontFamily: fontFamily.displayBold, fontSize: 20, letterSpacing: -0.5 },
  editHint: { fontFamily: fontFamily.body, fontSize: 13 },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  doneLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  blocks: { gap: 12, paddingBottom: 8 },
});
