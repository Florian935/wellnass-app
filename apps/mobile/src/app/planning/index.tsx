import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  addDays,
  findDropTarget,
  isMissed,
  localDayKey,
  sessionTargetPace,
  startOfWeek,
  type DropZone,
  type ProgramSessionType,
} from '@wellness/shared';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { PainSignalBanner } from '@/components/planning/PainSignalBanner';
import { SessionConflictBanner } from '@/components/planning/SessionConflictBanner';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  markPlannedSessionDone,
  reschedulePlannedSession,
  skipPlannedSession,
  useMissedSessions,
  useSessionConflicts,
  useWeekPainSignals,
  useWeekPlan,
  type PlannedSessionItem,
} from '@/data/repositories/planned-session-repository';
import { useRunnerProfile } from '@/data/repositories/running-profile-repository';
import {
  startWorkoutFromSession,
  useActiveWorkout,
} from '@/data/repositories/workout-repository';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Clés i18n des jours de semaine, indexées 0 = lundi … 6 = dimanche. */
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/**
 * Délai d'appui long avant que le glisser-déposer démarre (US MUSC-F9, D1) — plus court que les
 * 700 ms du réagencement du dashboard (`SortableWidgetGrid`) : ici la liste ne défile pas
 * verticalement sur la même zone que les cartes-jour, le risque de conflit est moindre.
 */
const LONG_PRESS_MS = 200;

/** Durée d'affichage du toast de confirmation (US MUSC-F9). */
const TOAST_MS = 2500;

/**
 * Couleur de pilier « muscu » : bordeaux de la charte (fixe, hors thème clair/sombre —
 * la palette d'app ne porte pas ce rôle ; mirroir de la maquette `--strength`).
 */
const STRENGTH_COLOR = '#6b0028';

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

export default function PlanningScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const router = useRouter();

  const [weekStart, setWeekStart] = useState<string>(() =>
    localDayKey(startOfWeek(new Date())),
  );
  const [selected, setSelected] = useState<PlannedSessionItem | null>(null);

  const { items } = useWeekPlan(weekStart);
  const { items: missed } = useMissedSessions();
  const { runnerProfile } = useRunnerProfile();
  const { workout: active } = useActiveWorkout();

  const todayKey = localDayKey(new Date());
  const ref5kPaceSPerKm = runnerProfile?.ref5kPaceSPerKm ?? null;

  const onPrevWeek = () => setWeekStart(localDayKey(addDays(dateFromKey(weekStart), -7)));
  const onNextWeek = () => setWeekStart(localDayKey(addDays(dateFromKey(weekStart), 7)));
  const weekStartDate = dateFromKey(weekStart);

  // ---------------------------------------------------------------------------
  // Glisser-déposer d'une séance planifiée (US MUSC-F9, roadmap 3.10)
  // ---------------------------------------------------------------------------

  /** Une ref de `View` par jour de la semaine affichée (indexée par `dateKey`). */
  const dayCardRefs = useRef<Record<string, View | null>>({});
  // US COLLIS-01 — conflits de séquençage de la semaine affichée. Rend [] tant que le réglage
  // opt-in est éteint (désactivé par défaut, décision H).
  const { conflicts } = useSessionConflicts(weekStart);
  const painSignals = useWeekPainSignals(weekStart);
  /** Zones mesurées à l'écran (coordonnées absolues) — fraîches à chaque début de geste. */
  const zonesRef = useRef<DropZone[]>([]);
  /** Id de la séance actuellement tirée (`null` = aucun geste en cours). */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /** Jour actuellement survolé pendant le geste — pour la surbrillance de la zone cible. */
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  /** Confirmation transitoire après un déplacement réussi. */
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(h);
  }, [toast]);

  /**
   * Mesure les 7 zones-jour **au moment où un geste démarre** (pas avant) : c'est ce qui rend le
   * calcul sûr même si l'utilisateur a fait défiler l'écran depuis le dernier rendu — mesurer trop
   * tôt (ou une seule fois au montage) reviendrait exactement au piège décrit par le plan
   * (« le dépôt vise juste tant qu'on n'a pas fait défiler »).
   */
  const measureZones = (): Promise<void> => {
    const dayKeys = WEEKDAY_KEYS.map((_, i) => localDayKey(addDays(weekStartDate, i)));
    return Promise.all(
      dayKeys.map(
        (dateKey) =>
          new Promise<DropZone>((resolve) => {
            const ref = dayCardRefs.current[dateKey];
            if (!ref) {
              resolve({ dateKey, y: 0, height: 0 });
              return;
            }
            ref.measureInWindow((_x, y, _width, height) => resolve({ dateKey, y, height }));
          }),
      ),
    ).then((zones) => {
      zonesRef.current = zones;
    });
  };

  const onDragBegin = (_itemId: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void measureZones();
    setDraggingId(_itemId);
  };

  const onDragUpdate = (absoluteY: number) => {
    setDragOverDate(findDropTarget(absoluteY, zonesRef.current));
  };

  const onDragEnd = (item: PlannedSessionItem, absoluteY: number) => {
    const target = findDropTarget(absoluteY, zonesRef.current);
    setDraggingId(null);
    setDragOverDate(null);
    // R3 — déposer sur son propre jour ne fait rien : ni écriture, ni toast (geste annulé).
    if (!target || target === item.scheduledDate) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void reschedulePlannedSession(item.id, target).catch(() => {
      // Écriture offline-first optimiste.
    });
    setToast(t('planning.movedTo', { date: formatDayKey(target) }));
  };

  // Regroupe les séances de la semaine par date planifiée.
  const byDate: Record<string, PlannedSessionItem[]> = {};
  for (const item of items) {
    (byDate[item.scheduledDate] ??= []).push(item);
  }

  const isEmpty = items.length === 0 && missed.length === 0;

  const closeSheet = () => setSelected(null);

  const onReschedule = async (target: string) => {
    if (!selected) return;
    const id = selected.id;
    closeSheet();
    try {
      await reschedulePlannedSession(id, target);
    } catch {
      // Écriture offline-first optimiste.
    }
  };

  const onSkip = async () => {
    if (!selected) return;
    const id = selected.id;
    closeSheet();
    try {
      await skipPlannedSession(id);
    } catch {
      // Écriture offline-first optimiste.
    }
  };

  const onMarkDone = async () => {
    if (!selected) return;
    const id = selected.id;
    closeSheet();
    try {
      await markPlannedSessionDone(id);
    } catch {
      // Écriture offline-first optimiste.
    }
  };

  const onStartSelected = async () => {
    if (!selected) return;
    if (active) {
      // Une seule séance active à la fois : on reprend l'existante plutôt que d'en créer une 2e.
      closeSheet();
      router.push('/workout');
      return;
    }
    const sessionId = selected.sessionId;
    const plannedSessionId = selected.id;
    closeSheet();
    try {
      await startWorkoutFromSession(sessionId, { plannedSessionId });
      router.push('/workout');
    } catch {
      // Écriture offline-first optimiste : échec très improbable.
    }
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={t('planning.title')} />

      {/* Confirmation transitoire après un glisser-déposer (US MUSC-F9) */}
      {toast ? (
        <View
          style={[styles.toast, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          accessibilityRole="text"
        >
          <Text style={[styles.toastText, { color: colors.text }]}>{toast}</Text>
        </View>
      ) : null}

      {/* Sélecteur de semaine */}
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

      {/* Indice de découvrabilité du geste (US MUSC-F9) — même patron que UX-LOT-01. */}
      {!isEmpty ? (
        <Text style={[styles.dragHint, { color: colors.textMuted }]}>{t('planning.dragHint')}</Text>
      ) : null}

      {isEmpty ? (
        <EmptyState
          icon="calendar-outline"
          title={t('planning.title')}
          message={t('planning.empty')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Bannière séances manquées */}
          {missed.length > 0 ? (
            <View
              style={[
                styles.missedBanner,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.missedTitle, { color: colors.text }]}>
                {t('planning.missedTitle')}
              </Text>
              <Text style={[styles.missedCount, { color: colors.textMuted }]}>
                {t('planning.missedCount', { count: missed.length })}
              </Text>
              <View style={styles.missedList}>
                {missed.map((item) => (
                  <PlannedSessionRow
                    key={item.id}
                    item={item}
                    todayKey={todayKey}
                    ref5kPaceSPerKm={ref5kPaceSPerKm}
                    units={units}
                    showDate
                    onPress={() => setSelected(item)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* 7 cartes de jour (lun → dim) */}
          {WEEKDAY_KEYS.map((key, i) => {
            const dayKey = localDayKey(addDays(weekStartDate, i));
            const dayItems = byDate[dayKey] ?? [];
            const isToday = dayKey === todayKey;
            // Coordination (5.6) : compte les séances réellement présentes ce jour
            // (planned + done ; on exclut skipped). Indicateur discret si ≥ 2.
            const coordCount = dayItems.filter(
              (it) => it.status === 'planned' || it.status === 'done',
            ).length;
            // US MUSC-F9 — surbrillance de la zone survolée pendant un glissement en cours.
            const isDropTarget = draggingId !== null && dragOverDate === dayKey;
            return (
              <View
                key={key}
                ref={(node) => {
                  dayCardRefs.current[dayKey] = node;
                }}
                style={[
                  styles.dayCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isDropTarget
                      ? colors.accent
                      : isToday
                        ? colors.accent
                        : colors.border,
                    borderWidth: isDropTarget ? 2 : isToday ? 2 : 1,
                    borderStyle: isDropTarget ? 'dashed' : 'solid',
                  },
                ]}
              >
                <View style={styles.dayHeaderRow}>
                  <Text style={[styles.dayHeader, { color: colors.text }]}>
                    {t(`common.weekday.${key}`)} · {formatDayKey(dayKey)}
                  </Text>
                  {coordCount >= 2 ? (
                    <View
                      style={[styles.coordBadge, { borderColor: colors.accent }]}
                      accessibilityRole="text"
                    >
                      <Text style={[styles.coordText, { color: colors.accent }]}>
                        {t('planning.multipleSameDay', { count: coordCount })}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {conflicts
                  .filter((c) => c.runDayKey === dayKey)
                  .map((c) => (
                    <SessionConflictBanner
                      key={c.runSessionId}
                      conflict={c}
                      onSwap={(target) => void reschedulePlannedSession(c.runSessionId, target)}
                    />
                  ))}
                {/* US DOUL-01 — un fait daté, sans action, sur la séance concernée (R4). */}
                {dayItems.map((item) => {
                  const signal = painSignals.get(item.id);
                  return signal ? <PainSignalBanner key={`pain-${item.id}`} signal={signal} /> : null;
                })}
                {dayItems.length === 0 ? (
                  <Text style={[styles.restDay, { color: colors.textMuted }]}>
                    {t('planning.restDay')}
                  </Text>
                ) : (
                  <View style={styles.dayItems}>
                    {dayItems.map((item) => (
                      <PlannedSessionRow
                        key={item.id}
                        item={item}
                        todayKey={todayKey}
                        ref5kPaceSPerKm={ref5kPaceSPerKm}
                        units={units}
                        onPress={() => setSelected(item)}
                        draggable
                        isDragging={draggingId === item.id}
                        onDragBegin={() => onDragBegin(item.id)}
                        onDragUpdate={(absoluteY) => onDragUpdate(absoluteY)}
                        onDragEnd={(absoluteY) => onDragEnd(item, absoluteY)}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Feuille d'actions sur une séance */}
      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={closeSheet}
      >
        <Pressable style={styles.backdrop} onPress={closeSheet}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.background }]}
            onPress={() => undefined}
          >
            {selected?.pillar === 'strength' && selected?.status === 'planned' ? (
              <Button
                label={active ? t('workout.resume') : t('planning.start')}
                onPress={() => void onStartSelected()}
              />
            ) : null}
            <Button
              label={t('planning.markDoneQuick')}
              variant="ghost"
              onPress={() => void onMarkDone()}
            />
            <Text style={[styles.sheetSection, { color: colors.textMuted }]}>
              {t('planning.reschedule')}
            </Text>
            <Button
              label={t('planning.rescheduleToday')}
              variant="ghost"
              onPress={() => void onReschedule(todayKey)}
            />
            <Button
              label={t('planning.rescheduleTomorrow')}
              variant="ghost"
              onPress={() => void onReschedule(localDayKey(addDays(new Date(), 1)))}
            />
            <Button
              label={t('planning.reschedulePlus7')}
              variant="ghost"
              onPress={() => void onReschedule(localDayKey(addDays(new Date(), 7)))}
            />
            <Button
              label={t('planning.skip')}
              variant="ghost"
              onPress={() => void onSkip()}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Ligne de séance planifiée (badge de statut + type + cible + allure)
// ---------------------------------------------------------------------------

type PlannedSessionRowProps = {
  item: PlannedSessionItem;
  todayKey: string;
  ref5kPaceSPerKm: number | null;
  units: ReturnType<typeof useUnits>;
  onPress: () => void;
  /** Affiche la date de la séance (bannière « manquées », hors carte de jour). */
  showDate?: boolean;
  /**
   * Active le geste de glisser-déposer (US MUSC-F9) — seulement dans la grille des 7 jours, pas
   * dans la bannière « séances manquées » (hors périmètre de cette US, cf. spec/plan).
   */
  draggable?: boolean;
  /** Vrai si CETTE ligne est la séance actuellement tirée (élévation + suit le doigt). */
  isDragging?: boolean;
  onDragBegin?: () => void;
  onDragUpdate?: (absoluteY: number) => void;
  onDragEnd?: (absoluteY: number) => void;
};

function PlannedSessionRow({
  item,
  todayKey,
  ref5kPaceSPerKm,
  units,
  onPress,
  showDate = false,
  draggable = false,
  isDragging = false,
  onDragBegin,
  onDragUpdate,
  onDragEnd,
}: PlannedSessionRowProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  // US MUSC-F9 — R1 : seules les séances `planned` se saisissent (une `done`/`skipped` ne réagit
  // pas au geste, elle reste sélectionnable à l'appui simple comme avant).
  const canDrag = draggable && item.status === 'planned';
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const active = useSharedValue(false);

  const pan = Gesture.Pan()
    .enabled(canDrag)
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart(() => {
      active.value = true;
      if (onDragBegin) runOnJS(onDragBegin)();
    })
    .onUpdate((e) => {
      dragX.value = e.translationX;
      dragY.value = e.translationY;
      if (onDragUpdate) runOnJS(onDragUpdate)(e.absoluteY);
    })
    .onEnd((e) => {
      if (onDragEnd) runOnJS(onDragEnd)(e.absoluteY);
    })
    .onFinalize(() => {
      active.value = false;
      dragX.value = 0;
      dragY.value = 0;
    });

  const animatedStyle = useAnimatedStyle(() => {
    if (!active.value) return { transform: [{ translateX: 0 }, { translateY: 0 }] };
    return {
      transform: [{ translateX: dragX.value }, { translateY: dragY.value }, { scale: 1.03 }],
      zIndex: 10,
      elevation: 8,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
    };
  });

  const isRunning = item.pillar === 'running';
  const sessionType = item.sessionType as ProgramSessionType | null;

  // Titre : muscu = nom de séance (fallback « Séance N ») ; running = type de séance.
  let typeLabel: string | null;
  if (isRunning) {
    typeLabel = sessionType ? t(`running.sessionType.${sessionType}`) : item.sessionName;
  } else {
    typeLabel = item.sessionName?.trim()
      ? item.sessionName
      : t('programs.detail.sessionFallback', { index: item.orderIndex + 1 });
  }

  // Muscu : ligne « N exercices ». Running : cible (distance/durée) + allure.
  const exerciseLabel = isRunning
    ? null
    : t('workout.exerciseCount', { count: item.exerciseCount });

  let targetLabel: string | null = null;
  if (isRunning) {
    if (item.targetDistanceM != null && item.targetDistanceM > 0) {
      targetLabel = units.formatDistance(item.targetDistanceM / 1000);
    } else if (item.targetDurationSeconds != null && item.targetDurationSeconds > 0) {
      targetLabel = `${Math.round(item.targetDurationSeconds / 60)} min`;
    }
  }

  let paceLabel: string | null = null;
  if (isRunning && sessionType) {
    if (ref5kPaceSPerKm == null) {
      paceLabel = t('planning.noProfileHint');
    } else {
      const range = sessionTargetPace(sessionType, ref5kPaceSPerKm);
      if (range) {
        paceLabel = `${units.formatPace(range.minSPerKm)} – ${units.formatPace(range.maxSPerKm)}`;
      }
    }
  }

  const pillarColor = isRunning ? colors.accent : STRENGTH_COLOR;
  const pillarLabel = t(isRunning ? 'planning.pillarRunning' : 'planning.pillarStrength');

  // Statut affiché : manqué (calculé), fait, sauté.
  let statusLabel: string | null = null;
  if (isMissed(item.scheduledDate, item.status, todayKey)) {
    statusLabel = t('planning.statusMissed');
  } else if (item.status === 'done') {
    statusLabel = t('planning.statusDone');
  } else if (item.status === 'skipped') {
    statusLabel = t('planning.statusSkipped');
  }

  const dimmed = item.status === 'done' || item.status === 'skipped';

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[isDragging && styles.rowLifted, animatedStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={typeLabel ?? undefined}
          onPress={onPress}
          style={[
            styles.row,
            { backgroundColor: colors.background, borderColor: colors.border },
            dimmed && styles.rowDimmed,
          ]}
        >
          <View
            style={[styles.pillarDot, { backgroundColor: pillarColor }]}
            accessibilityLabel={pillarLabel}
          />
          <View style={styles.rowText}>
            <Text
              style={[
                styles.rowTitle,
                { color: colors.text },
                item.status === 'skipped' && styles.strike,
              ]}
            >
              {typeLabel}
            </Text>
            {showDate ? (
              <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                {formatDayKey(item.scheduledDate)}
              </Text>
            ) : null}
            {exerciseLabel ? (
              <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{exerciseLabel}</Text>
            ) : null}
            {targetLabel ? (
              <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{targetLabel}</Text>
            ) : null}
            {paceLabel ? (
              <Text style={[styles.rowPace, { color: colors.textMuted }]}>{paceLabel}</Text>
            ) : null}
          </View>
          <View style={styles.rowEnd}>
            <View style={[styles.pillarChip, { backgroundColor: pillarColor }]}>
              <Text style={styles.pillarChipText}>{pillarLabel}</Text>
            </View>
            {statusLabel ? (
              <View style={[styles.statusBadge, { borderColor: colors.border }]}>
                <Text style={[styles.statusText, { color: colors.textMuted }]}>{statusLabel}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32, gap: 12 },
  weekSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
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
  missedBanner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  missedTitle: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  missedCount: { fontFamily: fontFamily.body, fontSize: 13 },
  missedList: { gap: 8, marginTop: 6 },
  dayCard: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dayHeader: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 14 },
  coordBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  coordText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  restDay: { fontFamily: fontFamily.body, fontSize: 13 },
  dayItems: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  rowDimmed: { opacity: 0.55 },
  pillarDot: { width: 10, height: 10, borderRadius: 5, flex: 0 },
  rowText: { flex: 1, gap: 2 },
  rowEnd: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pillarChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pillarChipText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 9,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  rowTitle: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  strike: { textDecorationLine: 'line-through' },
  rowMeta: { fontFamily: fontFamily.body, fontSize: 12 },
  rowPace: { fontFamily: fontFamily.mono, fontSize: 12 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: { fontFamily: fontFamily.bodySemi, fontSize: 11 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    gap: 10,
  },
  sheetSection: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
  },
  toast: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  toastText: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  dragHint: { fontFamily: fontFamily.body, fontSize: 12, marginBottom: 10 },
  rowLifted: { opacity: 0.95 },
});
