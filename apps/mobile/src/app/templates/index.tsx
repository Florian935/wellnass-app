import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  startWorkoutFromTemplate,
  useWorkoutTemplates,
  type WorkoutTemplateListItem,
} from '@/data/repositories/workout-template-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Liste des templates de séance libre (US Refonte-D §2). Deux modes :
 *  - normal : tap sur une ligne → détail du template (`/templates/[id]`) ;
 *  - sélection (`?selectMode=1`, entrée depuis le hub muscu §2.3/§2.4) : tap sur une
 *    ligne démarre directement une séance depuis ce template puis navigue vers
 *    `/workout`. Les templates sans exercice sont désactivés dans ce mode.
 */
export default function TemplatesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ selectMode?: string }>();
  const selectMode = Boolean(params.selectMode);

  const { templates, isLoading } = useWorkoutTemplates();
  const [startingId, setStartingId] = useState<string | null>(null);

  const onStart = async (id: string) => {
    if (startingId) return;
    setStartingId(id);
    try {
      await startWorkoutFromTemplate(id);
      router.push('/workout');
    } catch {
      // Écriture offline-first : échec très improbable ; on réactive le bouton.
    } finally {
      setStartingId(null);
    }
  };

  const onPress = (item: WorkoutTemplateListItem) => {
    if (selectMode) {
      if (item.exerciseCount === 0 || startingId) return;
      void onStart(item.id);
      return;
    }
    router.push(`/templates/${item.id}`);
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('templates.title')}
        subtitle={t('templates.subtitle')}
        action={
          <Pressable
            onPress={() => router.push('/templates/edit')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('templates.create')}
            style={[styles.createBtn, { backgroundColor: colors.accent }]}
          >
            <Ionicons name="add" size={24} color={colors.accentText} />
          </Pressable>
        }
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : templates.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('templates.emptyList')}
          </Text>
        </Card>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.list}>
            {templates.map((item) => {
              const disabled = selectMode && (item.exerciseCount === 0 || startingId !== null);
              const starting = startingId === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => onPress(item)}
                  disabled={disabled}
                  style={[
                    styles.row,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    disabled && styles.rowDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                  accessibilityState={{ disabled }}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      {t('templates.exerciseCount', { count: item.exerciseCount })}
                    </Text>
                  </View>
                  {starting ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  scroll: {
    paddingBottom: 24,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 16,
  },
  meta: {
    fontFamily: fontFamily.body,
    fontSize: 13,
  },
  createBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    padding: 16,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
