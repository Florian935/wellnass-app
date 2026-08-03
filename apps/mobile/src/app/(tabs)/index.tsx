import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { HomeWidgetId, WidgetId, WidgetSize } from '@wellness/shared';
import { Screen } from '@/components/Screen';
import { SyncStatus } from '@/components/SyncStatus';
import { DashboardWidget } from '@/components/dashboard/dashboard-widgets';
import { WidgetGrid } from '@/components/widgets/WidgetGrid';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { useMenuFocus } from '@/hooks/useMenuFocus';
import {
  useDeficitVolumeAlert,
  useOvertrainingGuardAlert,
  useTrainingLoadAlert,
} from '@/data/repositories/dashboard-repository';
import { useProfile } from '@/data/repositories/profile-repository';
import { useActivationPath } from '@/data/repositories/activation-path-repository';
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

  // Alerte déficit = widget **conditionnel** : rendu `null` tant qu'elle n'est pas déclenchée.
  // On l'exclut de la grille dans ce cas (sinon elle réserve une cellule vide → trou).
  const deficitActive = useDeficitVolumeAlert().show;
  // US ACTIV-01 : widget conditionnel temporel (7 jours après l'onboarding, ou jusqu'au dismiss).
  // Même raison que `deficit-volume` : sans cette déclaration, `WidgetGrid` réserverait sa
  // cellule après expiration au lieu de l'exclure (spec R4).
  const activationPathActive = useActivationPath().show;
  // META-19 / TRI-12 : même défaut que `deficit-volume` — ces deux widgets Tier 2 rendent `null`
  // hors de leur zone de risque, mais `isWidgetActive` les ignorait, donc `WidgetGrid` réservait
  // leur cellule même vide (trouvé en préparant ACTIV-01, cf. BACKLOG.md).
  const trainingLoadActive = useTrainingLoadAlert().show;
  const overtrainingGuardActive = useOvertrainingGuardAlert().show;
  const isWidgetActive = (id: WidgetId) => {
    if (id === 'deficit-volume') return deficitActive;
    if (id === 'activation-path') return activationPathActive;
    if (id === 'training-load') return trainingLoadActive;
    if (id === 'overtraining-guard') return overtrainingGuardActive;
    return true;
  };

  const greeting = firstName ? t('home.greetingName', { name: firstName }) : t('home.greeting');

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
      <View style={styles.header}>
        <View style={styles.headerTexts}>
          <Text style={[styles.hello, { color: colors.textMuted }]}>{greeting}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{t('common.appName')}</Text>
          {editing ? (
            // US UX-04 : le mode édition annonce désormais **comment** déplacer un widget. Le geste
            // (appui long) existait déjà mais restait invisible : personne ne le découvrait.
            <>
              <Text style={[styles.hello, { color: colors.accent }]}>
                {t('home.customize.editHint')}
              </Text>
              <Text style={[styles.hello, { color: colors.textMuted }]} maxFontSizeMultiplier={1.4}>
                {t('home.customize.dragHint')}
              </Text>
            </>
          ) : (
            <SyncStatus />
          )}
        </View>

        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: editing }}
            accessibilityLabel={
              editing ? t('home.customize.done') : t('home.customize.edit')
            }
            onPress={toggleEditing}
            hitSlop={8}
            style={StyleSheet.flatten([
              styles.persBtn,
              editing
                ? { backgroundColor: colors.accent, borderColor: colors.accent }
                : { backgroundColor: colors.surface, borderColor: colors.border },
            ])}
          >
            <Ionicons
              name={editing ? 'checkmark' : 'create-outline'}
              size={16}
              color={editing ? '#fff' : colors.text}
            />
            <Text
              style={[styles.persBtnText, { color: editing ? '#fff' : colors.text }]}
            >
              {editing ? t('home.customize.done') : t('home.customize.edit')}
            </Text>
          </Pressable>

          {!editing ? (
            <Link href="/settings" asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('settings.title')}
                hitSlop={10}
                style={StyleSheet.flatten([
                  styles.iconBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ])}
              >
                <Ionicons name="person-circle-outline" size={26} color={colors.text} />
              </Pressable>
            </Link>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.blocks}
        showsVerticalScrollIndicator={false}
        // Neutralise le défilement pendant un drag actif (maquette / spec 7.2).
        scrollEnabled={!dragging}
      >
        <WidgetGrid
          screen="home"
          editing={editing}
          renderWidget={renderWidget}
          onDragActiveChange={setDragging}
          isActive={isWidgetActive}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTexts: { gap: 4, flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hello: { fontFamily: fontFamily.bodyMedium, fontSize: 14 },
  title: { fontFamily: fontFamily.displayXBold, fontSize: 28, letterSpacing: -0.8 },
  persBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  persBtnText: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blocks: { gap: 14, paddingBottom: 24 },
});
