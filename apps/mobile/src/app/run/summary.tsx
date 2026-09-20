import {
  compareToTarget,
  feelingFromStoredRpe,
  feelingToStoredRpe,
  ghostGap,
  formatDayFull,
  pausedSeconds,
  WORKOUT_FEELINGS,
  RECORD_DISTANCE_I18N_KEY,
  type RecordDistanceKey,
  type WorkoutFeeling,
  RUNNING_RECORD_DISTANCES,
} from '@wellness/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CelebrationCard } from '@/components/CelebrationCard';
import { RunEnergySection } from '@/components/energy/RunEnergySection';
import { FormScreen } from '@/components/FormScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  deleteRun,
  setManualRunDistance,
  setManualRunDuration,
  setRunFeedback,
  unlinkPlannedSession,
  useRun,
  useRunGhost,
  useRunTarget,
} from '@/data/repositories/run-repository';
import { detectAndStoreRunRecords } from '@/data/repositories/running-record-repository';
import { formatGapDistance } from '@/components/running/GhostBand';
import { useActionLock } from '@/hooks/useActionLock';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { stageTheme } from '@/theme/stage';
import { useTheme } from '@/theme/useTheme';
import { useMenuFocus } from '@/hooks/useMenuFocus';

/**
 * Couleurs du bandeau de célébration — **celles du pilier Course** (US CARDIO-UX02).
 *
 * ⚠️ Elles étaient en dur, et c'était `#7c2734` : la teinte exacte de la **scène Musculation**.
 * Un record de course se célébrait donc en bordeaux, sur un écran bleu, sans que personne l'ait
 * décidé — vestige d'un copier-coller depuis le résumé de séance muscu. Les deux valeurs viennent
 * désormais de `stageTheme('running')`, dont chaque couple encre/fond est mesuré par
 * `theme/__tests__/stage.test.ts`.
 *
 * Le `'dark'` passé en second argument n'est pas un choix : la scène Course est **indépendante du
 * thème** (le bleu nuit est déjà sombre, un thème sombre n'a rien à y changer — voir l'en-tête de
 * `theme/stage.ts`). La constante peut donc vivre au niveau module, comme avant.
 */
const CELEBRATION_STAGE = stageTheme('running', 'dark');

const RECORD_ORDER: RecordDistanceKey[] = RUNNING_RECORD_DISTANCES.map((d) => d.key);

/** Formate une durée en secondes → `H h MM min SS s` / `MM min SS s` / `SS s`. */
function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds == null || totalSeconds < 0) return '—';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} h`);
  if (m > 0 || h > 0) parts.push(`${String(m).padStart(2, '0')} min`);
  parts.push(`${String(s).padStart(2, '0')} s`);
  return parts.join(' ');
}

/** `MM:SS` compact, pour l'écart de pause. */
function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  return `${m}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

/**
 * Résumé post-course, **premier temps** (US CARDIO-UX01, R6 / constat F17).
 *
 * ── Ce que ça remplace ───────────────────────────────────────────────────────────────────────────
 * Un formulaire de **douze sections** dans un seul défilement : célébration, métriques, objectif,
 * distance manuelle, carte, splits par km, fraction par fraction, **trois** cartes d'analyse de
 * courbe d'allure, export GPX, partage, RPE, terrain, notes, puis « Terminé » — tout en bas.
 *
 * Le geste attendu trente secondes après l'effort — noter son ressenti et fermer — exigeait donc
 * de traverser toute l'analyse. Et le **RPE**, la seule donnée que seul l'utilisateur peut
 * fournir, était en onzième position.
 *
 * ── Ce que cet écran fait maintenant ─────────────────────────────────────────────────────────────
 * Quatre chiffres, la séance validée, le ressenti, *Enregistrer*. Sans défilement. Tout le reste
 * — splits, fractions, courbes, carte, export, partage, corriger, supprimer — vit derrière
 * « Analyser » (`run/analysis.tsx`), à la demande.
 *
 * La course est **déjà clôturée** (`finishRun` appelé par `active.tsx` avant la navigation). Cet
 * écran ne la re-termine pas : il complète le ressenti et, pour une course manuelle, ses chiffres.
 */
export default function RunSummaryScreen() {
  // US CARDIO-UX02 — **l'identité du pilier appartient à l'écran, pas à l'onglet d'où l'on vient.**
  // `useMenuFocus` n'était appelé que par les cinq onglets : un écran course ouvert depuis
  // l'Accueil (`NowCard`, `QuickActions`, `RecordRecentCard` y poussent tous vers `/run…`)
  // héritait du terracotta de l'accueil. Le déclarer ici rend la couleur du pilier vraie quel
  // que soit le chemin — un test de garde vérifie qu'aucun écran course ne l'oublie.
  useMenuFocus('running');

  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const { run, isLoading } = useRun(id);
  // US FANT-01 — l'écart final : la distance du coureur moins celle du fantôme au même temps net.
  const { ghost } = useRunGhost(run?.ghostRunId ?? null);
  const ghostGapLabel = (() => {
    if (ghost === null) return '';
    const gap = ghostGap({
      profile: ghost.profile,
      runnerDistanceM: run?.distanceM ?? 0,
      netSeconds: run?.durationSeconds ?? 0,
      avgPaceSPerKm: run?.avgPaceSPerKm ?? null,
    });
    const { value, symbol } = formatGapDistance(gap.meters, units.system);
    return gap.status === 'level'
      ? t('running.ghost.level')
      : gap.meters >= 0
        ? t('running.ghost.ahead', { meters: `${value} ${symbol}` })
        : t('running.ghost.behind', { meters: `${value} ${symbol}` });
  })();
  const target = useRunTarget(run?.plannedSessionId ?? null);

  const comparison = useMemo(
    () =>
      compareToTarget(
        { distanceM: run?.distanceM ?? null, durationS: run?.durationSeconds ?? null },
        {
          targetDistanceM: target?.targetDistanceM ?? null,
          targetDurationS: target?.targetDurationSeconds ?? null,
        },
      ),
    [run?.distanceM, run?.durationSeconds, target],
  );

  // ── Ressenti : cinq niveaux nommés, partagés avec la muscu ────────────────────────────────
  // Réutilisation directe de `workout-feeling.ts` (US MUSCU-UX01) : même question — « c'était
  // dur ? » — même échelle des deux côtés de l'app. `runs.rpe` continue de stocker un RPE 1-10,
  // les cinq crans ne sont qu'une lecture. Aucune migration.
  const [feeling, setFeeling] = useState<WorkoutFeeling | null>(null);
  const [manualDistanceText, setManualDistanceText] = useState('');
  const [manualDurationText, setManualDurationText] = useState('');
  const [notes, setNotes] = useState('');
  const [validated, setValidated] = useState(true);

  const lockDelete = useActionLock();

  // Sync initial depuis la base au premier rendu où la course est chargée.
  const [initialised, setInitialised] = useState(false);
  if (run && !initialised) {
    setInitialised(true);
    setFeeling(feelingFromStoredRpe(run.rpe));
    if (run.notes !== null) setNotes(run.notes);
  }

  // Détection des records battus, une seule fois au montage (idempotente côté repo).
  const [beatenRecords, setBeatenRecords] = useState<RecordDistanceKey[]>([]);
  const detectionRun = useRef(false);
  useEffect(() => {
    if (!id || !run || detectionRun.current) return;
    if (run.source === 'manual' || run.status !== 'completed') return;
    detectionRun.current = true;
    let cancelled = false;
    detectAndStoreRunRecords(id)
      .then((beaten) => {
        if (!cancelled) setBeatenRecords(beaten);
      })
      .catch((err) => console.warn('[RunSummary] detectAndStoreRunRecords failed:', err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, run?.status, run?.source]);

  const isManual = run?.source === 'manual';

  // ── Actions ───────────────────────────────────────────────────────────────────────────────

  const onFeeling = async (next: WorkoutFeeling) => {
    setFeeling(next);
    if (!id) return;
    try {
      await setRunFeedback(id, { rpe: feelingToStoredRpe(next) });
    } catch (err) {
      console.warn('[RunSummary] setRunFeedback failed:', err);
    }
  };

  const onManualDistanceBlur = async () => {
    if (!id) return;
    const km = units.parseDistanceToKm(manualDistanceText);
    if (km == null) return;
    try {
      await setManualRunDistance(id, km * 1000);
      setManualDistanceText('');
    } catch (err) {
      console.warn('[RunSummary] setManualRunDistance failed:', err);
    }
  };

  /**
   * Durée d'une course manuelle, corrigeable (US CARDIO-UX01, R1b).
   *
   * Le tracker la pose désormais à la clôture — mais un chrono lancé en retard, un oubli d'arrêt
   * ou une saisie d'après-coup restent des cas réels. Saisie en **minutes**, l'unité dans laquelle
   * on se souvient d'une course.
   */
  const onManualDurationBlur = async () => {
    if (!id) return;
    const minutes = Number.parseFloat(manualDurationText.trim().replace(',', '.'));
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    try {
      await setManualRunDuration(id, Math.round(minutes * 60));
      setManualDurationText('');
    } catch (err) {
      console.warn('[RunSummary] setManualRunDuration failed:', err);
    }
  };

  const onNotesBlur = async () => {
    if (!id) return;
    try {
      await setRunFeedback(id, { notes: notes.trim() || null });
    } catch (err) {
      console.warn('[RunSummary] setRunFeedback notes failed:', err);
    }
  };

  /** Dé-valider la séance rattachée (R1c-2) : le rattachement pouvait être faux. */
  const onUnlink = async () => {
    if (!id) return;
    setValidated(false);
    try {
      await unlinkPlannedSession(id);
    } catch (err) {
      console.warn('[RunSummary] unlinkPlannedSession failed:', err);
      setValidated(true);
    }
  };

  const onDelete = () => {
    if (!id) return;
    Alert.alert(t('running.stop.deleteConfirmTitle'), t('running.stop.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('running.stop.delete'),
        style: 'destructive',
        onPress: () =>
          void lockDelete(async () => {
            try {
              await deleteRun(id);
            } catch (err) {
              console.warn('[RunSummary] deleteRun failed:', err);
            }
            router.replace('/(tabs)/running');
          }),
      },
    ]);
  };

  const onDone = () => router.replace('/(tabs)/running');

  // ── Gardes de rendu ───────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <FormScreen>
        <ScreenHeader title={t('running.summary.title')} />
        <Text style={[styles.loading, { color: colors.textMuted }]}>
          {t('running.summary.loading')}
        </Text>
      </FormScreen>
    );
  }

  if (!run) {
    return (
      <FormScreen>
        <ScreenHeader title={t('running.summary.title')} />
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          {t('running.summary.notFound')}
        </Text>
        <View style={styles.footer}>
          <Button label={t('running.summary.done')} onPress={onDone} />
        </View>
      </FormScreen>
    );
  }

  const distanceKm = run.distanceM !== null ? run.distanceM / 1000 : null;

  /**
   * L'écart entre le temps écoulé et le temps compté, **expliqué** (US CARDIO-UX01, R1a).
   *
   * Sans cette ligne, un coureur qui a fait deux pauses découvre au résumé une durée plus courte
   * que ce qu'il a vu défiler — et n'a aucun moyen de comprendre pourquoi. C'était la moitié du
   * constat F9 : l'autre moitié était le chrono lui-même, corrigé sur l'écran de course.
   */
  const pauses =
    run.finishedAt !== null
      ? pausedSeconds({
          startedAtMs: Date.parse(run.startedAt),
          finishedAtMs: Date.parse(run.finishedAt),
          netSeconds: run.durationSeconds,
        })
      : null;

  const distanceTarget = comparison.distance;
  const durationTarget = comparison.duration;
  const targetReached =
    (distanceTarget?.status === 'reached' || distanceTarget?.status === 'over') ||
    (durationTarget?.status === 'reached' || durationTarget?.status === 'over');

  return (
    <FormScreen>
      <ScreenHeader
        title={t('running.summary.doneTitle')}
        subtitle={formatDayFull(run.startedAt)}
      />

      {/* US FANT-01 — la course affrontée, rappelée une fois la course finie (spec §3). */}
      {ghost !== null ? (
        <Card>
          <Text style={[styles.ghostLine, { color: colors.textMuted }]}>
            {t('running.ghost.summary', {
              date: new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(
                new Date(ghost.finishedAt),
              ),
            })}
            {'  '}
            <Text style={{ color: colors.text }}>{ghostGapLabel}</Text>
          </Text>
        </Card>
      ) : null}

      {/* Célébration d'un ou plusieurs records battus */}
      {beatenRecords.length > 0 ? <CelebrationBanner distances={beatenRecords} /> : null}

      {/* ── Les quatre chiffres ─────────────────────────────────────────────────────────── */}
      <Card>
        <View style={styles.figures}>
          <Figure
            label={t('running.summary.distance')}
            value={distanceKm !== null ? units.formatDistance(distanceKm) : t('running.active.noData')}
          />
          <Figure label={t('running.hero.duration')} value={formatDuration(run.durationSeconds)} />
          <Figure label={t('running.summary.avgPace')} value={units.formatPace(run.avgPaceSPerKm)} />
          {run.elevationGainM !== null ? (
            <Figure
              label={t('running.elevation.gainLabel')}
              value={`+${Math.round(run.elevationGainM)} m`}
            />
          ) : null}
        </View>

        {/* L'écart de pause, dit plutôt que subi. */}
        {pauses ? (
          <View style={[styles.pauseNote, { backgroundColor: colors.background }]}>
            <Text style={[styles.pauseText, { color: colors.textMuted }]}>
              {t('running.summary.pauseExplained', {
                paused: formatMmSs(pauses.pausedS),
                elapsed: formatDuration(pauses.elapsedS),
              })}
            </Text>
          </View>
        ) : null}
      </Card>

      {/* US DEPENSE-02 — ce que la sortie a coûté (dénivelé compris), et ce que ça change. */}
      <RunEnergySection
        finishedAt={run.finishedAt}
        distanceM={run.distanceM}
        durationSeconds={run.durationSeconds}
        elevationGainM={run.elevationGainM}
        rpe={run.rpe}
      />

      {/* ── La séance planifiée validée (R1c / constat F20) ─────────────────────────────── */}
      {run.plannedSessionId !== null && validated ? (
        <Card>
          <View style={styles.validatedRow}>
            <View style={[styles.validatedIcon, { backgroundColor: colors.success }]}>
              <Text style={[styles.validatedCheck, { color: colors.accentText }]}>✓</Text>
            </View>
            <View style={styles.validatedTexts}>
              <Text style={[styles.validatedTitle, { color: colors.text }]}>
                {t('running.summary.sessionValidated')}
              </Text>
              <Text style={[styles.validatedBody, { color: colors.textMuted }]}>
                {targetReached
                  ? t('running.summary.targetReached')
                  : t('running.summary.sessionRecorded')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => void onUnlink()}
              accessibilityRole="button"
              accessibilityLabel={t('running.summary.unlink')}
              style={styles.unlinkBtn}
            >
              <Text style={[styles.unlinkLabel, { color: colors.accent }]}>
                {t('running.summary.unlink')}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
      ) : null}

      {/* ── Une course manuelle complète ses chiffres ici (R1b) ─────────────────────────── */}
      {isManual ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('running.summary.manualFigures')}
          </Text>
          <View style={styles.manualRow}>
            <View style={styles.manualField}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                {t('running.summary.manualDistance')} ({units.distanceSymbol})
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.borderStrong, backgroundColor: colors.surface },
                ]}
                keyboardType="decimal-pad"
                placeholder={t(`running.summary.manualDistancePlaceholder_${units.system}`)}
                placeholderTextColor={colors.textMuted}
                value={manualDistanceText}
                onChangeText={setManualDistanceText}
                onBlur={onManualDistanceBlur}
                onSubmitEditing={onManualDistanceBlur}
                returnKeyType="done"
                accessibilityLabel={t('running.summary.manualDistance')}
              />
            </View>
            <View style={styles.manualField}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                {t('running.summary.manualDuration')}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.borderStrong, backgroundColor: colors.surface },
                ]}
                keyboardType="decimal-pad"
                placeholder={t('running.summary.manualDurationPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={manualDurationText}
                onChangeText={setManualDurationText}
                onBlur={onManualDurationBlur}
                onSubmitEditing={onManualDurationBlur}
                returnKeyType="done"
                accessibilityLabel={t('running.summary.manualDuration')}
              />
            </View>
          </View>
        </Card>
      ) : null}

      {/* ── Le ressenti : la seule donnée que l'app ne peut pas connaître ───────────────── */}
      <Card>
        <View style={styles.feelingHead}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('running.summary.feeling')}
          </Text>
          {feeling ? (
            <Text style={[styles.feelingValue, { color: colors.textMuted }]}>
              {t(`workout.summary.feeling.${feeling}`)}
            </Text>
          ) : null}
        </View>
        <View style={styles.feelingRow}>
          {WORKOUT_FEELINGS.map((level) => {
            const selected = feeling === level;
            return (
              <TouchableOpacity
                key={level}
                onPress={() => void onFeeling(level)}
                accessibilityRole="button"
                accessibilityLabel={t(`workout.summary.feeling.${level}`)}
                accessibilityState={{ selected }}
                style={[
                  styles.feelingBtn,
                  {
                    backgroundColor: selected ? colors.accent : colors.surface,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.feelingBtnLabel,
                    { color: selected ? colors.accentText : colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {t(`workout.summary.feeling.${level}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          style={[
            styles.notesInput,
            { color: colors.text, borderColor: colors.borderStrong, backgroundColor: colors.background },
          ]}
          multiline
          numberOfLines={2}
          placeholder={t('running.summary.notesPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={notes}
          onChangeText={setNotes}
          onBlur={onNotesBlur}
          accessibilityLabel={t('running.summary.notes')}
          textAlignVertical="top"
        />
      </Card>

      {/* ── Deux actions, et rien d'autre à ce niveau ───────────────────────────────────── */}
      <View style={styles.actions}>
        <View style={styles.actionMain}>
          <Button label={t('running.summary.save')} onPress={onDone} />
        </View>
        <Button
          label={t('running.summary.analyse')}
          variant="ghost"
          onPress={() => router.push({ pathname: '/run/analysis', params: { id } })}
        />
      </View>

      {/* La suppression reste accessible, en pied et en teinte destructive (constat F18). */}
      <View style={styles.deleteWrap}>
        <Button label={t('running.stop.delete')} variant="destructive" onPress={onDelete} />
      </View>
    </FormScreen>
  );
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

/** Un des quatre chiffres clés, en grand. */
function Figure({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.figure}>
      <Text style={[styles.figureLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.figureValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

/**
 * Bandeau in-app affiché en tête du résumé quand la course vient de battre au moins un record.
 * L'animation vit dans `CelebrationCard` (partagé avec MUSC-F8).
 */
function CelebrationBanner({ distances }: { distances: RecordDistanceKey[] }) {
  const { t } = useTranslation();
  const ordered = RECORD_ORDER.filter((k) => distances.includes(k));
  const labels = ordered.map((k) => t(RECORD_DISTANCE_I18N_KEY[k]));
  const includes5k = ordered.includes('5k');

  return (
    <CelebrationCard
      style={[styles.celebration, { backgroundColor: CELEBRATION_STAGE.surfaces[1] }]}
    >
      <Text style={styles.celebrationSpark}>🏅</Text>
      <Text style={[styles.celebrationTitle, { color: CELEBRATION_STAGE.ink }]}>
        {t('running.records.newRecordTitle')}
      </Text>
      <Text style={[styles.celebrationBody, { color: CELEBRATION_STAGE.ink }]}>
        {t('running.records.newRecordBody', { distances: labels.join(', ') })}
      </Text>
      {includes5k ? (
        // `accent` est documenté dans `theme/stage.ts` comme la couleur de la **matière**, « jamais
        // porteuse de texte » — parce qu'il n'est pas mesuré contre toutes les teintes du dégradé
        // (3,99:1 sur `surfaces[0]`). Ici le fond est épinglé à `surfaces[1]`, où il donne
        // **6,26:1** : au-dessus du seuil, et c'est ce qui rend la ligne de mise à jour de l'allure
        // de référence distincte du corps sans changer de taille.
        <Text style={[styles.celebrationRef, { color: CELEBRATION_STAGE.accent }]}>
          ★ {t('running.records.refPaceUpdated')}
        </Text>
      ) : null}
    </CelebrationCard>
  );
}

const styles = StyleSheet.create({
  ghostLine: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  loading: { fontFamily: fontFamily.body, fontSize: 15, textAlign: 'center', marginTop: 32 },
  empty: { fontFamily: fontFamily.body, fontSize: 15, textAlign: 'center', marginTop: 32 },
  sectionTitle: { fontFamily: fontFamily.displaySemi, fontSize: 15 },
  fieldLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12 },

  // Les quatre chiffres
  figures: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, columnGap: 16 },
  figure: { minWidth: '44%', gap: 2 },
  figureLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  figureValue: { fontFamily: fontFamily.displayXBold, fontSize: 28, letterSpacing: -0.8 },
  pauseNote: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  pauseText: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 },

  // Séance validée
  validatedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  validatedIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  validatedCheck: { fontFamily: fontFamily.bodyBold, fontSize: 18 },
  validatedTexts: { flex: 1, gap: 1 },
  validatedTitle: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  validatedBody: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  unlinkBtn: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  unlinkLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13 },

  // Course manuelle
  manualRow: { flexDirection: 'row', gap: 10 },
  manualField: { flex: 1, gap: 5 },
  input: {
    minHeight: 48,
    fontFamily: fontFamily.body,
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },

  // Ressenti
  feelingHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  feelingValue: { fontFamily: fontFamily.body, fontSize: 13 },
  feelingRow: { flexDirection: 'row', gap: 5 },
  feelingBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  feelingBtnLabel: { fontFamily: fontFamily.bodySemi, fontSize: 11.5, textAlign: 'center' },
  notesInput: {
    fontFamily: fontFamily.body,
    fontSize: 15,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 60,
  },

  actions: { gap: 10 },
  actionMain: { width: '100%' },
  deleteWrap: { marginTop: 4 },
  footer: { marginTop: 'auto' },

  // Célébration de record
  celebration: {
    borderRadius: 16,
    padding: 16,
    gap: 4,
    overflow: 'hidden',
  },
  celebrationSpark: { fontSize: 30, position: 'absolute', top: 8, right: 14 },
  celebrationTitle: { fontFamily: fontFamily.displayBold, fontSize: 19 },
  celebrationBody: { fontFamily: fontFamily.body, fontSize: 14 },
  celebrationRef: { fontFamily: fontFamily.bodySemi, fontSize: 13, marginTop: 6 },
});
