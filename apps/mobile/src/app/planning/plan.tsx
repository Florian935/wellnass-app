import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  localDayKey,
  sessionTargetPace,
  startOfWeek,
  type Pillar,
  type ProgramSessionType,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import {
  useActiveProgram,
  useProgramDetail,
  type SessionDetail,
} from '@/data/repositories/program-repository';
import { planProgram } from '@/data/repositories/planned-session-repository';
import { useRunnerProfile } from '@/data/repositories/running-profile-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Clés i18n des jours de semaine, indexées 0 = lundi … 6 = dimanche. */
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** Construit une `Date` locale depuis une clé AAAA-MM-JJ (jamais `new Date('AAAA-MM-JJ')`). */
function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

/** Formate une clé AAAA-MM-JJ en JJ/MM/AAAA (affichage FR). */
function formatDayKey(key: string): string {
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

export default function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const programId = typeof id === 'string' ? id : '';
  return <PlanView programId={programId} />;
}

function PlanView({ programId }: { programId: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();

  const { detail, isLoading } = useProgramDetail(programId);
  const { runnerProfile } = useRunnerProfile();
  const { program: activeProgram } = useActiveProgram(detail?.pillar ?? 'strength');
  const hasOtherActive = !!activeProgram && activeProgram.id !== programId;

  // Durée en semaines (saisie libre, pré-remplie depuis le programme).
  const [duration, setDuration] = useState<string | null>(null);
  // Lundi de la semaine de début, gardé en clé AAAA-MM-JJ. Défaut : lundi prochain.
  const [weekStart, setWeekStart] = useState<string>(() =>
    localDayKey(startOfWeek(addDays(new Date(), 7))),
  );
  // Affectation d'un jour de semaine (0..6) par séance.
  const [dayAssignments, setDayAssignments] = useState<Record<string, number>>({});
  const [planning, setPlanning] = useState(false);

  const currentDuration =
    duration ?? (detail?.durationWeeks != null ? String(detail.durationWeeks) : '');
  const parsedDuration = Number(currentDuration.trim());
  const durationValid =
    currentDuration.trim() !== '' &&
    Number.isInteger(parsedDuration) &&
    parsedDuration > 0;

  const sessions = detail?.sessions ?? [];
  const allAssigned =
    sessions.length > 0 && sessions.every((s) => dayAssignments[s.id] !== undefined);

  const canPlan = durationValid && allAssigned && !planning;

  const onPrevWeek = () => setWeekStart(localDayKey(addDays(dateFromKey(weekStart), -7)));
  const onNextWeek = () => setWeekStart(localDayKey(addDays(dateFromKey(weekStart), 7)));

  const assignDay = (sessionId: string, day: number) => {
    setDayAssignments((prev) => ({ ...prev, [sessionId]: day }));
  };

  const doPlan = async (removePreviousFuture: boolean) => {
    setPlanning(true);
    try {
      await planProgram(
        programId,
        { startDate: weekStart, durationWeeks: parsedDuration, dayAssignments },
        { removePreviousFuture },
      );
      router.replace('/planning');
    } catch {
      Alert.alert(t('planning.planErrorTitle'), t('planning.planErrorMessage'));
      setPlanning(false);
    }
  };

  const onPlan = () => {
    if (!canPlan) return;
    if (hasOtherActive) {
      Alert.alert(t('planning.switchProgram.title'), t('planning.switchProgram.message'), [
        { text: t('planning.switchProgram.remove'), onPress: () => void doPlan(true) },
        { text: t('planning.switchProgram.keep'), onPress: () => void doPlan(false) },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    } else {
      void doPlan(false);
    }
  };

  if (isLoading && !detail) {
    return (
      <Screen edges={['top']} center>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (!detail) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={t('planning.planCta')} />
        <Text style={[styles.notFound, { color: colors.textMuted }]}>
          {t('programs.detail.notFoundMessage')}
        </Text>
      </Screen>
    );
  }

  const plannedCount = durationValid ? sessions.length * parsedDuration : 0;

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={t('planning.planCta')} subtitle={detail.name} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Durée */}
        <TextField
          label={t('planning.durationWeeks')}
          value={currentDuration}
          onChangeText={setDuration}
          keyboardType="number-pad"
          maxLength={3}
        />

        {/* Semaine de début */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
            {t('planning.startDate')}
          </Text>
          <View style={styles.weekSelector}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('planning.prevWeek')}
              onPress={onPrevWeek}
              hitSlop={8}
              style={[styles.weekArrow, { borderColor: colors.border }]}
            >
              <Text style={[styles.weekArrowText, { color: colors.text }]}>◀</Text>
            </Pressable>
            <Text style={[styles.weekLabel, { color: colors.text }]}>
              {t('planning.weekOf', { date: formatDayKey(weekStart) })}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('planning.nextWeek')}
              onPress={onNextWeek}
              hitSlop={8}
              style={[styles.weekArrow, { borderColor: colors.border }]}
            >
              <Text style={[styles.weekArrowText, { color: colors.text }]}>▶</Text>
            </Pressable>
          </View>
        </View>

        {/* Séances : type, cible, allure + choix du jour */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('running.program.sessions')}
        </Text>

        <View style={styles.sessionList}>
          {sessions.map((session, index) => (
            <PlanSessionCard
              key={session.id}
              session={session}
              index={index}
              pillar={detail.pillar}
              ref5kPaceSPerKm={runnerProfile?.ref5kPaceSPerKm ?? null}
              units={units}
              assignedDay={dayAssignments[session.id]}
              onAssignDay={(day) => assignDay(session.id, day)}
            />
          ))}
        </View>

        {/* Action */}
        <View style={styles.actions}>
          <Button
            label={
              durationValid
                ? t('planning.generatedCount', { count: plannedCount })
                : t('planning.planCta')
            }
            onPress={() => void onPlan()}
            loading={planning}
            disabled={!canPlan}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Carte de séance avec sélecteur de jour
// ---------------------------------------------------------------------------

type PlanSessionCardProps = {
  session: SessionDetail;
  index: number;
  pillar: Pillar;
  ref5kPaceSPerKm: number | null;
  units: ReturnType<typeof useUnits>;
  assignedDay: number | undefined;
  onAssignDay: (day: number) => void;
};

function PlanSessionCard({
  session,
  index,
  pillar,
  ref5kPaceSPerKm,
  units,
  assignedDay,
  onAssignDay,
}: PlanSessionCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const isRunning = pillar === 'running';

  // Nom de séance : running → « Séance {lettre} », muscu → nom saisi ou « Séance {n} ».
  const sessionName = isRunning
    ? session.name?.trim() ||
      t('running.program.sessionDefaultName', { letter: sessionLetter(index) })
    : session.name?.trim() ||
      t('programs.detail.sessionFallback', { index: session.orderIndex + 1 });

  // Type/cible/allure sont spécifiques au running ; pour la muscu la ligne se limite au nom.
  const sessionType = isRunning
    ? (session.sessionType as ProgramSessionType | null)
    : null;
  const typeLabel = sessionType ? t(`running.sessionType.${sessionType}`) : null;

  let targetLabel: string | null = null;
  if (isRunning) {
    if (session.targetDistanceM != null && session.targetDistanceM > 0) {
      targetLabel = units.formatDistance(session.targetDistanceM / 1000);
    } else if (
      session.targetDurationSeconds != null &&
      session.targetDurationSeconds > 0
    ) {
      targetLabel = `${Math.round(session.targetDurationSeconds / 60)} min`;
    }
  }

  let paceLabel: string | null = null;
  if (sessionType) {
    if (ref5kPaceSPerKm == null) {
      paceLabel = t('planning.noProfileHint');
    } else {
      const range = sessionTargetPace(sessionType, ref5kPaceSPerKm);
      if (range) {
        paceLabel = `${units.formatPace(range.minSPerKm)} – ${units.formatPace(range.maxSPerKm)}`;
      }
    }
  }

  return (
    <View
      style={[
        styles.sessionCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.sessionName, { color: colors.text }]}>{sessionName}</Text>

      <View style={styles.chipsRow}>
        {typeLabel ? (
          <View
            style={[
              styles.chip,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.chipText, { color: colors.textMuted }]}>{typeLabel}</Text>
          </View>
        ) : null}
        {targetLabel ? (
          <View
            style={[
              styles.chip,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.chipText, { color: colors.textMuted }]}>{targetLabel}</Text>
          </View>
        ) : null}
      </View>

      {paceLabel ? (
        <Text style={[styles.paceLabel, { color: colors.textMuted }]}>{paceLabel}</Text>
      ) : null}

      {/* Choix du jour de la semaine */}
      <Text style={[styles.assignLabel, { color: colors.textMuted }]}>
        {t('planning.assignDay')}
      </Text>
      <View style={styles.dayRow}>
        {WEEKDAY_KEYS.map((key, day) => {
          const selected = assignedDay === day;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onAssignDay(day)}
              style={[
                styles.dayPill,
                {
                  backgroundColor: selected ? colors.accent : colors.background,
                  borderColor: selected ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.dayPillText,
                  { color: selected ? colors.accentText : colors.textMuted },
                ]}
              >
                {t(`common.weekday.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Lettre de séance à partir d'un index 0-based : A, B, C… */
function sessionLetter(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32, gap: 20 },
  field: { gap: 8 },
  fieldLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  weekSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  weekArrow: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekArrowText: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
  weekLabel: { flex: 1, textAlign: 'center', fontFamily: fontFamily.bodySemi, fontSize: 15 },
  sectionTitle: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 18,
    letterSpacing: -0.3,
  },
  sessionList: { gap: 12 },
  sessionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  sessionName: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: { fontFamily: fontFamily.body, fontSize: 12 },
  paceLabel: { fontFamily: fontFamily.mono, fontSize: 13 },
  assignLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12, marginTop: 4 },
  dayRow: { flexDirection: 'row', gap: 6 },
  dayPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  dayPillText: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  actions: { gap: 10, marginTop: 8 },
  notFound: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
});
