import {
  canRunAgain,
  computeKmSplits,
  feelingFromStoredRpe,
  formatDurationHms,
  ordinalCategory,
  RECORD_DISTANCE_I18N_KEY,
  decodeTrack,
  formatDayFull,
  formatPaceMMSS,
  isValidCoord,
  RUN_TERRAINS,
  simplifyTrack,
  summarizeIntervalSeries,
  type RunTerrain,
} from '@wellness/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { PaceCurveCards } from '@/components/run/PaceCurveCards';
import { Card } from '@/components/Card';
import { FormScreen } from '@/components/FormScreen';
import { RouteMap } from '@/components/running/RouteMap';
import { RunEffortsCard } from '@/components/running/RunEffortsCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ShareCardSheet } from '@/components/share/ShareCardSheet';
import {
  deleteRun,
  setRunTerrain,
  updateRunCore,
  useIntervalBlocksForRun,
  useRun,
  useRunIntervals,
} from '@/data/repositories/run-repository';
import { useRunEfforts } from '@/data/repositories/run-effort-repository';
import { exportRunAsGpx } from '@/lib/gpx-export';
import { useActionLock } from '@/hooks/useActionLock';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useMenuFocus } from '@/hooks/useMenuFocus';

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

/**
 * **Second temps** du résumé de course (US CARDIO-UX01, R6 / constat F17).
 *
 * ── Pourquoi un écran à part ─────────────────────────────────────────────────────────────────────
 * Ces sections étaient toutes empilées dans `run/summary.tsx`, entre la célébration de record et
 * le bouton « Terminé » : douze sections à traverser pour noter son ressenti et fermer. Elles ne
 * disparaissent pas — elles cessent d'être sur le chemin.
 *
 * Ce qui vit ici : les splits par km, le réalisé fraction par fraction, les trois lectures de la
 * courbe d'allure, la carte, le terrain, l'export GPX, le partage — et les deux actions qui
 * manquaient à l'app : **corriger** (constat F19) et **supprimer** (constat F18).
 */
export default function RunAnalysisScreen() {
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
  // US CARDIO-UX03 — `share=1` : « Partager », depuis la carte d'arrivée du hub, ouvre la carte à
  // partager une fois la course chargée (même geste que le bilan muscu, MUSCU-UX07).
  const { id, share } = useLocalSearchParams<{ id?: string; share?: string }>();

  const { run, isLoading } = useRun(id);

  const [terrain, setTerrain] = useState<RunTerrain | null>(null);
  const [terrainInit, setTerrainInit] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [distanceText, setDistanceText] = useState('');

  const lockDelete = useActionLock();

  // US CARDIO-UX03 (D6) — le type de la séance réalisée : l'analyse sert désormais de détail à toute
  // sortie ouverte depuis le hub ou l'historique, et doit dire ce qu'était la sortie.
  const { sessionType } = useIntervalBlocksForRun(run?.plannedSessionId ?? null);
  const [shareInit, setShareInit] = useState(false);
  if (run && !shareInit) {
    setShareInit(true);
    if (share === '1') setShareOpen(true);
  }

  if (run && !terrainInit) {
    setTerrainInit(true);
    setTerrain(run.terrain);
  }

  const points = useMemo(() => (run?.gpsTrack ? decodeTrack(run.gpsTrack) : []), [run]);
  const simplified = useMemo(() => simplifyTrack(points, 5), [points]);
  const validPointCount = useMemo(
    () => points.filter((p) => isValidCoord(p.lat, p.lng)).length,
    [points],
  );
  const splits = useMemo(() => computeKmSplits(points), [points]);

  // US EFFORT-01 — les pastilles posées sur la carte. Second appel au même hook que
  // `RunEffortsCard` : la requête locale est identique, donc PowerSync la partage, et garder la
  // carte des efforts autonome vaut mieux que de lui faire descendre ses données en props.
  const { medals } = useRunEfforts(id);
  const mapMedals = useMemo(
    () =>
      medals
        .filter((m) => m.midLat != null && m.midLng != null)
        .map((m) => ({
          id: m.id,
          lat: m.midLat as number,
          lng: m.midLng as number,
          rank: m.rank,
          label: `${m.rank} · ${t(RECORD_DISTANCE_I18N_KEY[m.distanceKey])}`,
          accessibilityLabel: t('run.efforts.a11yRow', {
            rank: t(`run.efforts.ordinal.${ordinalCategory(m.rank, i18n.language)}`, { n: m.rank }),
            distance: t(RECORD_DISTANCE_I18N_KEY[m.distanceKey]),
            time: formatDurationHms(m.timeSeconds),
          }),
        })),
    [medals, t, i18n.language],
  );

  const { intervals: intervalRows } = useRunIntervals(id);
  const intervalSummary = useMemo(() => summarizeIntervalSeries(intervalRows), [intervalRows]);

  const fastestSplitKm = useMemo(() => {
    if (splits.length === 0) return null;
    return splits.reduce((best, s) => (s.seconds < best.seconds ? s : best), splits[0]!).km;
  }, [splits]);
  const slowestSplitSeconds = useMemo(
    () => (splits.length > 0 ? Math.max(...splits.map((s) => s.seconds)) : 0),
    [splits],
  );

  const onTerrainChange = async (value: RunTerrain) => {
    setTerrain(value);
    if (!id) return;
    try {
      await setRunTerrain(id, value);
    } catch (err) {
      console.warn('[RunAnalysis] setRunTerrain failed:', err);
    }
  };

  const onExport = async () => {
    if (!run || isExporting) return;
    setIsExporting(true);
    try {
      const result = await exportRunAsGpx(run, t);
      if ('error' in result) {
        Alert.alert(
          t('running.export.cta'),
          result.error === 'unavailable'
            ? t('running.export.errorUnavailable')
            : t('running.export.errorFailed'),
        );
      }
    } finally {
      setIsExporting(false);
    }
  };

  /** Corrige la distance (constat F19) — la seule que l'utilisateur peut connaître mieux que le GPS. */
  const onCorrectDistance = async () => {
    if (!id) return;
    const km = units.parseDistanceToKm(distanceText);
    if (km == null) return;
    try {
      await updateRunCore(id, { distanceM: Math.round(km * 1000) });
      setDistanceText('');
      setCorrecting(false);
    } catch (err) {
      console.warn('[RunAnalysis] updateRunCore failed:', err);
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
              console.warn('[RunAnalysis] deleteRun failed:', err);
            }
            router.replace('/(tabs)/running');
          }),
      },
    ]);
  };

  if (isLoading || !run) {
    return (
      <FormScreen>
        <ScreenHeader title={t('running.analysis.title')} />
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          {isLoading ? t('running.summary.loading') : t('running.summary.notFound')}
        </Text>
      </FormScreen>
    );
  }

  const distanceKm = run.distanceM !== null ? run.distanceM / 1000 : null;
  const feeling = feelingFromStoredRpe(run.rpe);
  const canExport = run.status === 'completed' && run.source !== 'manual' && validPointCount >= 2;

  return (
    <FormScreen>
      <ScreenHeader
        title={t('running.analysis.title')}
        subtitle={formatDayFull(run.startedAt)}
      />

      {/* ── US CARDIO-UX03 (D6) — ce qu'était la sortie, puis la recourir ──────────────────── */}
      <Card>
        <View style={styles.identity}>
          {run.plannedSessionId ? (
            <Text style={[styles.eyebrow, { color: colors.accent }]}>{t('running.analysis.fromProgram')}</Text>
          ) : null}
          <Text style={[styles.identityTitle, { color: colors.text }]} accessibilityRole="header">
            {sessionType ? t(`running.sessionType.${sessionType}`) : t('running.hub.freeRun')}
          </Text>
          <Text testID="run-analysis-meta" style={[styles.identityMeta, { color: colors.textMuted }]}>
            {[
              new Date(run.startedAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }),
              run.terrain ? t(`running.terrain.${run.terrain}`) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        <View style={styles.figures}>
          {[
            { label: t('running.summary.distance'), value: units.formatDistance(distanceKm) },
            { label: t('running.summary.duration'), value: formatDuration(run.durationSeconds) },
            { label: t('running.summary.avgPace'), value: units.formatPace(run.avgPaceSPerKm) },
            {
              label: t('running.summary.feeling'),
              value: feeling ? t(`workout.summary.feeling.${feeling}`) : '—',
            },
          ].map((figure) => (
            <View key={figure.label} style={[styles.figure, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.figureLabel, { color: colors.textMuted }]}>{figure.label}</Text>
              <Text style={[styles.figureValue, { color: colors.text }]}>{figure.value}</Text>
            </View>
          ))}
        </View>
      </Card>

      {canRunAgain(run) ? (
        <Button
          testID="run-analysis-again"
          label={t('running.analysis.again')}
          accessibilityLabel={`${t('running.analysis.again')} · ${t('running.analysis.againHint')}`}
          haptic="confirm"
          onPress={() => router.push({ pathname: '/run', params: { ghostRunId: run.id } })}
        />
      ) : null}

      {/* ── Fraction par fraction (constat F21) ─────────────────────────────────────────── */}
      {intervalRows.length > 0 ? (
        <Card>
          <View style={styles.headRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('running.realise.title')}
            </Text>
            {intervalSummary.ratedCount > 0 ? (
              <Text style={[styles.headNote, { color: colors.success }]}>
                {t('running.realise.inRange', {
                  done: intervalSummary.inRangeCount,
                  total: intervalSummary.ratedCount,
                })}
              </Text>
            ) : null}
          </View>

          {/*
            La grille passe de « colonne figée à 52 px » à `84px 1fr 68px` : « Récupération » ne
            tient pas en 52 px et se faisait tronquer (constat F21). Et le prévu affiche
            désormais **la plage complète**, là où le code n'en montrait qu'une borne
            (`range.min ?? range.max`) — une plage 4:05–4:10 s'affichait « 4:05 », ce qui se lit
            comme une cible unique.
          */}
          <View style={[styles.tableHead, { borderBottomColor: colors.border }]}>
            <Text style={[styles.thFraction, { color: colors.textMuted }]}>
              {t('running.realise.rep')}
            </Text>
            <Text style={[styles.thPlanned, { color: colors.textMuted }]}>
              {t('running.realise.planned')}
            </Text>
            <Text style={[styles.thActual, { color: colors.textMuted }]}>
              {t('running.realise.actual')}
            </Text>
          </View>

          {intervalRows.map((row) => {
            const isFast = row.phaseKind === 'fast';
            const min = row.plannedPaceMinSPerKm;
            const max = row.plannedPaceMaxSPerKm;
            const plannedLabel =
              min == null && max == null
                ? t('running.realise.noData')
                : min != null && max != null && min !== max
                  ? t('running.paceGuidance.range', {
                      min: formatPaceMMSS(Math.round(min), '—'),
                      max: formatPaceMMSS(Math.round(max), '—'),
                    })
                  : formatPaceMMSS(Math.round((min ?? max)!), '—');

            const outOfRange =
              row.actualPaceSPerKm != null &&
              ((min != null && row.actualPaceSPerKm < min) ||
                (max != null && row.actualPaceSPerKm > max));

            return (
              <View key={row.phaseIndex} style={styles.tableRow}>
                <Text style={[styles.tdFraction, { color: colors.text }]} numberOfLines={1}>
                  {isFast
                    ? `${t('running.realise.rep')} ${row.rep}`
                    : t('running.realise.recoveryRow')}
                </Text>
                <Text style={[styles.tdPlanned, { color: colors.textMuted }]} numberOfLines={1}>
                  {plannedLabel}
                </Text>
                <Text
                  style={[styles.tdActual, { color: outOfRange ? colors.accent : colors.text }]}
                >
                  {row.actualPaceSPerKm != null
                    ? formatPaceMMSS(Math.round(row.actualPaceSPerKm), '—')
                    : t('running.realise.noData')}
                </Text>
              </View>
            );
          })}

          {/* La régularité est LE sujet d'une séance de VMA — plus que la moyenne. */}
          {intervalSummary.avgFastPaceSPerKm != null ? (
            <Text style={[styles.tableNote, { color: colors.textMuted }]}>
              {t('running.realise.avgPace')} :{' '}
              {formatPaceMMSS(Math.round(intervalSummary.avgFastPaceSPerKm), '—')}
              {intervalSummary.paceStdDevSPerKm != null
                ? ` · ${t('running.realise.regularity')} ${t('running.realise.regularityValue', {
                    value: Math.round(intervalSummary.paceStdDevSPerKm),
                  })}`
                : ''}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {/* ── Splits par km ───────────────────────────────────────────────────────────────── */}
      {splits.length > 0 ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('running.summary.splits')}
          </Text>
          {splits.map((s) => {
            const isFastest = s.km === fastestSplitKm;
            const barPct = slowestSplitSeconds > 0 ? (s.seconds / slowestSplitSeconds) * 100 : 0;
            return (
              <View key={s.km} style={styles.splitRow}>
                <Text style={[styles.splitKm, { color: colors.textMuted }]}>
                  {t('running.summary.splitKm', { km: s.km })}
                </Text>
                <View style={[styles.splitBarTrack, { backgroundColor: colors.surfaceAlt }]}>
                  <View
                    style={{
                      height: '100%',
                      width: `${barPct}%`,
                      backgroundColor: isFastest ? colors.accent : colors.border,
                      borderRadius: 4,
                    }}
                  />
                </View>
                <Text
                  style={[styles.splitPace, { color: isFastest ? colors.accent : colors.text }]}
                >
                  {formatPaceMMSS(s.seconds, '—')}
                </Text>
              </View>
            );
          })}
        </Card>
      ) : null}

      {/* ── Les trois lectures de la courbe d'allure (US ALLURE-01) ─────────────────────── */}
      <PaceCurveCards splits={splits} />

      {/* ── Carte du parcours ───────────────────────────────────────────────────────────── */}
      <Card>
        <RouteMap
          points={simplified}
          emptyLabel={t('running.map.noTrack')}
          startEnd
          medals={mapMedals}
        />
      </Card>

      {/* ── Tes meilleurs efforts (US EFFORT-01) ────────────────────────────────────────── */}
      <RunEffortsCard runId={id} hasTrack={points.length > 0} />

      {/* ── Terrain ─────────────────────────────────────────────────────────────────────── */}
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('running.terrain.title')}
        </Text>
        <View style={styles.terrainRow}>
          {RUN_TERRAINS.map((option) => {
            const selected = terrain === option;
            return (
              <TouchableOpacity
                key={option}
                onPress={() => void onTerrainChange(option)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[
                  styles.terrainChip,
                  {
                    backgroundColor: selected ? colors.accent : colors.surface,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.terrainChipLabel,
                    { color: selected ? colors.accentText : colors.text },
                  ]}
                >
                  {t(`running.terrain.${option}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      {/* ── Corriger (constat F19) ──────────────────────────────────────────────────────── */}
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('running.analysis.correctTitle')}
        </Text>
        {correcting ? (
          <>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
              {t('running.summary.manualDistance')} ({units.distanceSymbol})
            </Text>
            <TextInput
              style={[
                styles.input,
                { color: colors.text, borderColor: colors.borderStrong, backgroundColor: colors.surface },
              ]}
              keyboardType="decimal-pad"
              placeholder={units.formatDistanceValue(distanceKm)}
              placeholderTextColor={colors.textMuted}
              value={distanceText}
              onChangeText={setDistanceText}
              accessibilityLabel={t('running.summary.manualDistance')}
            />
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {t('running.analysis.correctHint')}
            </Text>
            <Button label={t('running.analysis.saveCorrection')} onPress={() => void onCorrectDistance()} />
            <Button
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => {
                setCorrecting(false);
                setDistanceText('');
              }}
            />
          </>
        ) : (
          <Button
            label={t('running.analysis.correctCta')}
            variant="ghost"
            onPress={() => setCorrecting(true)}
          />
        )}
      </Card>

      {/* ── Partage et export ───────────────────────────────────────────────────────────── */}
      {canExport ? (
        <Button
          label={t('running.export.cta')}
          variant="ghost"
          loading={isExporting}
          onPress={() => void onExport()}
        />
      ) : null}
      {run.status === 'completed' ? (
        <Button label={t('share.cta')} variant="ghost" onPress={() => setShareOpen(true)} />
      ) : null}

      {/* ── Supprimer (constat F18) ─────────────────────────────────────────────────────── */}
      <Button label={t('running.stop.delete')} variant="destructive" onPress={onDelete} />

      <ShareCardSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        data={{
          kind: 'run',
          points,
          startedAtMs: Date.parse(run.startedAt),
          stats: {
            distance: units.formatDistance(distanceKm),
            duration: formatDuration(run.durationSeconds),
            pace: units.formatPace(run.avgPaceSPerKm),
          },
        }}
        accessibilityLabel={t('share.run.a11y', {
          date: formatDayFull(run.startedAt),
          distance: units.formatDistance(distanceKm),
          duration: formatDuration(run.durationSeconds),
        })}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  empty: { fontFamily: fontFamily.body, fontSize: 15, textAlign: 'center', marginTop: 32 },
  identity: { gap: 3, marginBottom: 12 },
  eyebrow: { fontFamily: fontFamily.monoBold, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  identityTitle: { fontFamily: fontFamily.displayXBold, fontSize: 24, letterSpacing: -0.6 },
  identityMeta: { fontFamily: fontFamily.body, fontSize: 13.5 },
  figures: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  figure: { flexGrow: 1, flexBasis: '45%', gap: 2, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  figureLabel: { fontFamily: fontFamily.bodySemi, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  figureValue: { fontFamily: fontFamily.monoBold, fontSize: 17 },
  sectionTitle: { fontFamily: fontFamily.displaySemi, fontSize: 15 },
  headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  headNote: { fontFamily: fontFamily.bodyBold, fontSize: 12 },
  fieldLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12 },
  hint: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 },
  input: {
    minHeight: 48,
    fontFamily: fontFamily.body,
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },

  // Tableau fraction par fraction — la grille qui manquait de place
  tableHead: { flexDirection: 'row', gap: 8, paddingBottom: 5, borderBottomWidth: 1 },
  thFraction: {
    width: 84,
    fontFamily: fontFamily.bodySemi,
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  thPlanned: {
    flex: 1,
    fontFamily: fontFamily.bodySemi,
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  thActual: {
    width: 68,
    textAlign: 'right',
    fontFamily: fontFamily.bodySemi,
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 6 },
  tdFraction: { width: 84, fontFamily: fontFamily.bodySemi, fontSize: 13 },
  tdPlanned: { flex: 1, fontFamily: fontFamily.mono, fontSize: 12 },
  tdActual: { width: 68, textAlign: 'right', fontFamily: fontFamily.monoBold, fontSize: 13.5 },
  tableNote: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 18, marginTop: 6 },

  // Splits
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  splitKm: { fontFamily: fontFamily.body, fontSize: 13, width: 52 },
  splitBarTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  splitPace: { fontFamily: fontFamily.monoBold, fontSize: 14, width: 64, textAlign: 'right' },

  // Terrain
  terrainRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  terrainChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  terrainChipLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 13 },
});
