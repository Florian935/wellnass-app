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
import {
  PROGRAM_LEVELS,
  RUNNER_OBJECTIVES,
  type ProgramLevel,
  type RunnerObjective,
} from '@wellness/shared';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segment } from '@/components/Segment';
import {
  createProgram,
  duplicateProgram,
  useMyPrograms,
  useProgramLibrary,
  type ProgramLibraryFilters,
  type ProgramListItem,
} from '@/data/repositories/program-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

// Onglets de l'écran : mes programmes / bibliothèque éditoriale.
const TABS = ['mine', 'library'] as const;
type Tab = (typeof TABS)[number];

// Valeur sentinelle « Tous » pour les filtres objectif / niveau / durée.
const ALL = 'all' as const;

type ObjectiveFilter = RunnerObjective | typeof ALL;
type LevelFilter = ProgramLevel | typeof ALL;
type DurationFilter = number | typeof ALL;

const OBJECTIVE_OPTIONS: readonly ObjectiveFilter[] = [ALL, ...RUNNER_OBJECTIVES];
const LEVEL_OPTIONS: readonly LevelFilter[] = [ALL, ...PROGRAM_LEVELS];
// Durées cibles proposées (semaines) — repli « Tous » si aucune sélection.
const DURATION_OPTIONS: readonly DurationFilter[] = [ALL, 6, 8, 10, 12];

export default function RunningProgramsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('mine');
  const [objectiveFilter, setObjectiveFilter] = useState<ObjectiveFilter>(ALL);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>(ALL);
  const [durationFilter, setDurationFilter] = useState<DurationFilter>(ALL);
  const [creating, setCreating] = useState(false);
  const [duplicating, setDuplicating] = useState<string | null>(null);

  const { programs: myPrograms, isLoading: myLoading } = useMyPrograms('running');

  // Filtres combinés (ET) passés à la bibliothèque. Le pilier est toujours
  // « running » (Phase A) ; les sentinelles « Tous » n'ajoutent aucune clause.
  const libraryFilters: ProgramLibraryFilters = { pillar: 'running' };
  if (objectiveFilter !== ALL) libraryFilters.goal = objectiveFilter;
  if (levelFilter !== ALL) libraryFilters.level = levelFilter;
  if (durationFilter !== ALL) libraryFilters.durationWeeks = durationFilter;

  const { programs: libraryPrograms, isLoading: libraryLoading } =
    useProgramLibrary(libraryFilters);

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

  const onDuplicate = async (id: string) => {
    if (duplicating) return;
    setDuplicating(id);
    try {
      const newId = await duplicateProgram(id);
      router.push(`/running-programs/${newId}`);
    } catch {
      // En cas d'erreur, la transaction garantit l'absence de copie partielle :
      // on reste simplement sur la liste.
    } finally {
      setDuplicating(null);
    }
  };

  const onPress = (id: string) => {
    router.push(`/running-programs/${id}`);
  };

  // Ligne de chips de filtre (objectif / niveau / durée) — patron muscu.
  const renderFilterRow = <T extends string | number>(
    label: string,
    options: readonly T[],
    value: T,
    onChange: (v: T) => void,
    optionLabel: (v: T) => string,
  ) => (
    <View style={styles.filterGroup}>
      <Text style={[styles.filterLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.filtersRow}>
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <Pressable
              key={String(opt)}
              onPress={() => onChange(opt)}
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
                {optionLabel(opt)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  // Carte « Mes programmes » : navigation vers le détail, badge actif.
  const renderMyCard = (item: ProgramListItem) => (
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

  // Carte « Bibliothèque » : chips objectif/niveau/durée + bouton « Utiliser ».
  const renderLibraryCard = (item: ProgramListItem) => {
    const isDuplicating = duplicating === item.id;
    return (
      <Card key={item.id} style={styles.libraryCard}>
        <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
        <View style={styles.chips}>
          {item.goal ? (
            <View style={[styles.metaChip, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.metaChipLabel, { color: colors.text }]}>
                {t(`running.objective.${item.goal}`)}
              </Text>
            </View>
          ) : null}
          {item.level ? (
            <View style={[styles.metaChip, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.metaChipLabel, { color: colors.text }]}>
                {t(`running.programLevel.${item.level}`)}
              </Text>
            </View>
          ) : null}
          {item.durationWeeks ? (
            <View style={[styles.metaChip, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.metaChipLabel, { color: colors.text }]}>
                {t('programs.weeks', { count: item.durationWeeks })}
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={() => void onDuplicate(item.id)}
          disabled={isDuplicating}
          accessibilityRole="button"
          accessibilityLabel={t('running.library.use')}
          style={[styles.useBtn, { backgroundColor: colors.accent }]}
        >
          {isDuplicating ? (
            <ActivityIndicator size="small" color={colors.accentText} />
          ) : (
            <Text style={[styles.useBtnLabel, { color: colors.accentText }]}>
              {t('running.library.use')}
            </Text>
          )}
        </Pressable>
      </Card>
    );
  };

  const objectiveLabel = (opt: ObjectiveFilter) =>
    opt === ALL ? t('running.library.filterAll') : t(`running.objective.${opt}`);
  const levelLabel = (opt: LevelFilter) =>
    opt === ALL ? t('running.library.filterAll') : t(`running.programLevel.${opt}`);
  const durationLabel = (opt: DurationFilter) =>
    opt === ALL ? t('running.library.filterAll') : t('programs.weeks', { count: opt });

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={t('running.library.title')}
        action={
          tab === 'mine' ? (
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
          ) : undefined
        }
      />

      <View style={styles.tabs}>
        <Segment<Tab>
          options={TABS}
          value={tab}
          onChange={setTab}
          label={(option) =>
            option === 'mine' ? t('running.library.myTab') : t('running.library.tab')
          }
        />
      </View>

      {tab === 'mine' ? (
        myLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : myPrograms.length === 0 ? (
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
            <View style={styles.list}>{myPrograms.map((item) => renderMyCard(item))}</View>
          </ScrollView>
        )
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.filters}>
            {renderFilterRow(
              t('running.library.filterObjective'),
              OBJECTIVE_OPTIONS,
              objectiveFilter,
              setObjectiveFilter,
              objectiveLabel,
            )}
            {renderFilterRow(
              t('running.library.filterLevel'),
              LEVEL_OPTIONS,
              levelFilter,
              setLevelFilter,
              levelLabel,
            )}
            {renderFilterRow(
              t('running.library.filterDuration'),
              DURATION_OPTIONS,
              durationFilter,
              setDurationFilter,
              durationLabel,
            )}
          </View>

          {libraryLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : libraryPrograms.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {t('running.library.empty')}
              </Text>
            </Card>
          ) : (
            <View style={styles.list}>
              {libraryPrograms.map((item) => renderLibraryCard(item))}
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    marginBottom: 16,
  },
  filters: {
    gap: 12,
    marginBottom: 20,
  },
  filterGroup: {
    gap: 8,
  },
  filterLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  libraryCard: {
    padding: 16,
    gap: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  metaChipLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
  },
  useBtn: {
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useBtnLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 14,
  },
});
