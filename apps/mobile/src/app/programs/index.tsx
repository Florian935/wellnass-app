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
import { PROGRAM_LEVELS, type ProgramLevel } from '@wellness/shared';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  duplicateProgram,
  useProgramLibrary,
  useMyPrograms,
  type ProgramListItem,
  type ProgramLibraryFilters,
} from '@/data/repositories/program-repository';
import { useActionLock } from '@/hooks/useActionLock';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

// Valeur sentinelle « Tous les niveaux » pour le filtre.
const ALL_LEVELS = 'all' as const;
type LevelFilter = ProgramLevel | typeof ALL_LEVELS;

const LEVEL_OPTIONS: readonly LevelFilter[] = [ALL_LEVELS, ...PROGRAM_LEVELS];

export default function ProgramsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const [levelFilter, setLevelFilter] = useState<LevelFilter>(ALL_LEVELS);
  // `duplicating` ne pilote que l'affichage (indicateur sur la bonne ligne) ; la garde contre le
  // double appui est portée par `useActionLock`.
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const lockDuplicate = useActionLock();

  // Filtre pilier muscu obligatoire : sans lui, la biblio et « Mes programmes » affichaient
  // aussi les programmes running (fuite inter-piliers). Miroir de l'écran running.
  const filters: ProgramLibraryFilters =
    levelFilter === ALL_LEVELS ? { pillar: 'strength' } : { pillar: 'strength', level: levelFilter };

  const { programs: libraryPrograms, isLoading: libraryLoading } = useProgramLibrary(filters);
  const { programs: myPrograms, isLoading: myLoading } = useMyPrograms('strength');

  const isLoading = libraryLoading || myLoading;

  const onDuplicate = (id: string) =>
    void lockDuplicate(async () => {
      setDuplicating(id);
      try {
        const newId = await duplicateProgram(id);
        router.push(`/programs/${newId}`);
      } catch {
        // En cas d'erreur silencieuse, on reste sur la liste (la copie partielle est
        // impossible côté transaction).
      } finally {
        setDuplicating(null);
      }
    });

  const onPress = (id: string) => {
    router.push(`/programs/${id}`);
  };

  const renderProgramCard = (item: ProgramListItem, showDuplicate: boolean) => (
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
            {item.level ? t(`programs.level.${item.level}`) : null}
            {item.level && item.durationWeeks ? ' · ' : null}
            {item.durationWeeks
              ? t('programs.weeks', { count: item.durationWeeks })
              : null}
          </Text>
        </View>
        {item.isActive ? (
          <View style={[styles.activeBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.activeBadgeText, { color: colors.accentText }]}>
              {t('programs.active')}
            </Text>
          </View>
        ) : null}
      </View>
      {showDuplicate ? (
        <Pressable
          onPress={() => onDuplicate(item.id)}
          hitSlop={12}
          disabled={duplicating === item.id}
          accessibilityRole="button"
          accessibilityLabel={t('programs.duplicateA11y', { name: item.name })}
          style={styles.duplicateBtn}
        >
          {duplicating === item.id ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons name="copy-outline" size={20} color={colors.accent} />
          )}
        </Pressable>
      ) : null}
    </Pressable>
  );

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('programs.title')}
        subtitle={t('programs.subtitle')}
        action={
          <Pressable
            onPress={() => router.push('/programs/edit')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('programs.create')}
            style={[styles.createBtn, { backgroundColor: colors.accent }]}
          >
            <Ionicons name="add" size={24} color={colors.accentText} />
          </Pressable>
        }
      />

      {/* Filtre par niveau */}
      <View style={styles.filtersRow}>
        {LEVEL_OPTIONS.map((lvl) => {
          const selected = levelFilter === lvl;
          return (
            <Pressable
              key={lvl}
              onPress={() => setLevelFilter(lvl)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.accent : colors.surface,
                  borderColor: selected ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  { color: selected ? colors.accentText : colors.text },
                ]}
              >
                {lvl === ALL_LEVELS ? t('programs.levelAll') : t(`programs.level.${lvl}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Section Bibliothèque */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('programs.sectionLibrary')}
          </Text>
          {libraryPrograms.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {t('programs.emptyLibrary')}
              </Text>
            </Card>
          ) : (
            <View style={styles.list}>
              {libraryPrograms.map((item) => renderProgramCard(item, true))}
            </View>
          )}

          {/* Section Mes programmes */}
          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced, { color: colors.text }]}>
            {t('programs.sectionMine')}
          </Text>
          {myPrograms.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {t('programs.emptyMine')}
              </Text>
            </Card>
          ) : (
            <View style={styles.list}>
              {myPrograms.map((item) => renderProgramCard(item, false))}
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 13,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  scroll: {
    paddingBottom: 24,
  },
  sectionTitle: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 18,
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  sectionTitleSpaced: {
    marginTop: 28,
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
  duplicateBtn: {
    padding: 4,
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
