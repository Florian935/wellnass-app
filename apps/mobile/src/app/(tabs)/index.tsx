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
import { useMenuFocus } from '@/hooks/useMenuFocus';
import { useProfile } from '@/data/repositories/profile-repository';
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

  const greeting = firstName ? t('home.greetingName', { name: firstName }) : t('home.greeting');

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
            <Text style={[styles.hello, { color: colors.accent }]}>
              {t('home.customize.editHint')}
            </Text>
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
            onPress={() => setEditing((v) => !v)}
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
