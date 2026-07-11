import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  createProgram,
  useMyPrograms,
  type ProgramListItem,
} from '@/data/repositories/program-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export default function RunningProgramsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { programs, isLoading } = useMyPrograms('running');
  const [creating, setCreating] = useState(false);

  const onCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const id = await createProgram({
        pillar: 'running',
        name: t('running.program.createTitle'),
      });
      router.push(`/running-programs/edit?id=${id}`);
    } catch {
      // Écriture offline-first : échec très improbable ; on réactive le bouton.
    } finally {
      setCreating(false);
    }
  };

  const onPress = (id: string) => {
    router.push(`/running-programs/${id}`);
  };

  const renderCard = (item: ProgramListItem) => (
    <Pressable
      key={item.id}
      onPress={() => onPress(item.id)}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={item.name}
    >
      <View style={styles.rowMain}>
        <View style={styles.rowText}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {[
              item.goal ? t(`running.objective.${item.goal}`) : null,
              item.level ? t(`running.programLevel.${item.level}`) : null,
              item.durationWeeks
                ? t('programs.weeks', { count: item.durationWeeks })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        {item.isActive ? (
          <View style={[styles.activeBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.activeBadgeText, { color: colors.accentText }]}>
              {t('running.program.activeBadge')}
            </Text>
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('running.program.myTitle')}
        action={
          <Pressable
            onPress={() => void onCreate()}
            hitSlop={12}
            disabled={creating}
            accessibilityRole="button"
            accessibilityLabel={t('running.program.create')}
            style={[styles.createBtn, { backgroundColor: colors.accent }]}
          >
            {creating ? (
              <ActivityIndicator size="small" color={colors.accentText} />
            ) : (
              <Ionicons name="add" size={24} color={colors.accentText} />
            )}
          </Pressable>
        }
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : programs.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('running.program.empty')}
          </Text>
        </Card>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.list}>
            {programs.map((item) => renderCard(item))}
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
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
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
