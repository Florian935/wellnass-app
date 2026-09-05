import {
  compareToTarget,
  computeKmSplits,
  summarizeIntervalSeries,
  decodeTrack,
  formatDayFull,
  formatPaceMMSS,
  isValidCoord,
  RUN_TERRAINS,
  RUNNING_RECORD_DISTANCES,
  simplifyTrack,
  type RecordDistanceKey,
  type RunTerrain,
} from '@wellness/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { PaceCurveCards } from '@/components/run/PaceCurveCards';
import { Card } from '@/components/Card';
import { CelebrationCard } from '@/components/CelebrationCard';
import { FormScreen } from '@/components/FormScreen';
import { RouteMap } from '@/components/running/RouteMap';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ShareCardSheet } from '@/components/share/ShareCardSheet';
import {
  setManualRunDistance,
  setRunFeedback,
  setRunTerrain,
  useRun,
  useRunIntervals,
  useRunTarget,
} from '@/data/repositories/run-repository';
import { detectAndStoreRunRecords } from '@/data/repositories/running-record-repository';
import { exportRunAsGpx } from '@/lib/gpx-export';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useUnits } from '@/hooks/useUnits';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Couleurs de la charte pour le bandeau de célébration (bordeaux + doré). */
const CELEBRATION_BG = '#6b0028';
const CELEBRATION_ACCENT = '#c9a96e';

/** Clé i18n du libellé de distance pour chaque record canonique. */
const RECORD_DISTANCE_KEY: Record<RecordDistanceKey, string> = {
  '1k': 'running.records.distance1k',
  '5k': 'running.records.distance5k',
  '10k': 'running.records.distance10k',
  semi: 'running.records.distanceSemi',
  marathon: 'running.records.distanceMarathon',
};

/** Ordre canonique des clés de distance (pour trier les records battus). */
const RECORD_ORDER: RecordDistanceKey[] = RUNNING_RECORD_DISTANCES.map((d) => d.key);

// ---------------------------------------------------------------------------
// Helpers d'affichage
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Sous-composant : ligne de stat
// ---------------------------------------------------------------------------

function StatRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sous-composant : sélecteur RPE (1-10)
// ---------------------------------------------------------------------------

function RpeSelector({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (rpe: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.rpeRow}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const selected = value === n;
        return (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(n)}
            accessibilityRole="button"
            accessibilityLabel={String(n)}
            accessibilityState={{ selected }}
            style={[
              styles.rpeBtn,
              {
                backgroundColor: selected ? colors.accent : colors.surface,
                borderColor: selected ? colors.accent : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.rpeBtnLabel,
                { color: selected ? colors.background : colors.text },
              ]}
            >
              {n}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sous-composant : bandeau de célébration de nouveau record
// ---------------------------------------------------------------------------

/**
 * Bandeau in-app affiché en tête du résumé quand la course vient de battre au moins
 * un record. Chips = distances battues (allure non affichée ici, seul le libellé) et
 * ligne dorée « allure de référence mise à jour » quand le 5 km est tombé.
 *
 * L'animation (fondu + léger zoom, respect de « réduire les animations ») vit dans
 * `CelebrationCard`, extrait en composant partagé pour MUSC-F8 — le contenu ci-dessous
 * reste propre à la course.
 */
function CelebrationBanner({ distances }: { distances: RecordDistanceKey[] }) {
  const { t } = useTranslation();

  // Distances triées dans l'ordre canonique + libellés i18n.
  const ordered = RECORD_ORDER.filter((k) => distances.includes(k));
  const labels = ordered.map((k) => t(RECORD_DISTANCE_KEY[k]));
  const includes5k = ordered.includes('5k');

  return (
    <CelebrationCard style={styles.celebration}>
      <Text style={styles.celebrationSpark}>🏅</Text>
      <Text style={styles.celebrationTitle}>{t('running.records.newRecordTitle')}</Text>
      <Text style={styles.celebrationBody}>
        {t('running.records.newRecordBody', { distances: labels.join(', ') })}
      </Text>
      {includes5k ? (
        <Text style={styles.celebrationRef}>★ {t('running.records.refPaceUpdated')}</Text>
      ) : null}
    </CelebrationCard>
  );
}

// ---------------------------------------------------------------------------
// Écran principal
// ---------------------------------------------------------------------------

/**
 * Résumé post-course (Running R1, US 5.24-5.26).
 *
 * La course est **déjà clôturée** (finishRun appelé par active.tsx avant la
 * navigation). Cet écran ne la re-termine pas : il patch uniquement les champs
 * de ressenti (RPE, notes) et, pour une course manuelle, la distance.
 */
export default function RunSummaryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnits();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const { run, isLoading } = useRun(id);

  // US RUN-F3 (5.25) : cible de la séance planifiée réalisée (null si course libre ou lien résolu
  // à rien) et comparaison pure — aucune clé si la séance ne visait pas cet axe (R1, R3).
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

  // État local du formulaire de feedback
  const [rpe, setRpe] = useState<number | null>(run?.rpe ?? null);
  const [notes, setNotes] = useState<string>(run?.notes ?? '');
  // Distance manuelle saisie (texte libre ; dans l'unité d'affichage courante)
  const [manualDistanceText, setManualDistanceText] = useState<string>('');
  // Terrain (D3) : facultatif, écrit à tout moment après la clôture.
  const [terrain, setTerrain] = useState<RunTerrain | null>(run?.terrain ?? null);

  // US PARTAGE-01 : aperçu de la carte partageable.
  const [shareOpen, setShareOpen] = useState(false);

  // Décodage + simplification de la trace GPS pour la carte du parcours.
  const points = useMemo(
    () => (run?.gpsTrack ? decodeTrack(run.gpsTrack) : []),
    [run],
  );
  const simplified = useMemo(() => simplifyTrack(points, 5), [points]);

  // Nombre de points VALIDES (mêmes règles que buildGpx : null island, hors bornes).
  // Réutilise le décodage déjà fait pour la carte (pas de re-décodage).
  const validPointCount = useMemo(
    () => points.filter((p) => isValidCoord(p.lat, p.lng)).length,
    [points],
  );

  // Splits par km plein (course GPS avec trace ≥ 1 km) : durée de chaque km + km le plus rapide.
  const splits = useMemo(() => computeKmSplits(points), [points]);

  // US RUN-F4 (lot F) — le réalisé par répétition de cette course. Vide (donc section absente)
  // sur une course libre et sur toute course antérieure à cette US.
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

  // État de l'export GPX (bouton en chargement pendant la génération/partage).
  const [isExporting, setIsExporting] = useState(false);

  // Sync initial des champs depuis la DB quand la course charge (premier rendu).
  // On utilise un ref pour n'initialiser qu'une fois.
  const [feedbackInit, setFeedbackInit] = useState(false);
  if (run && !feedbackInit) {
    setFeedbackInit(true);
    if (run.rpe !== null) setRpe(run.rpe);
    if (run.notes !== null) setNotes(run.notes);
    if (run.terrain !== null) setTerrain(run.terrain);
  }

  // Détection des records battus par cette course, une seule fois au montage.
  // GPS + terminée uniquement ; l'idempotence du repo garantit qu'un simple
  // remontage (revisite du résumé) ne re-célèbre pas (retourne []). Le ref évite
  // un double appel dans le même montage (StrictMode / re-rendus).
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
      .catch((err) => {
        console.warn('[RunSummary] detectAndStoreRunRecords failed:', err);
      });
    return () => {
      cancelled = true;
    };
    // Déps primitives : `useRun` renvoie un nouvel objet `run` à chaque rendu.
    // On dépend des seules valeurs lues (status/source) ; le corps lit `run`/`id`
    // et le ref `detectionRun` garantit l'exécution unique (one-shot).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, run?.status, run?.source]);

  const isManual = run?.source === 'manual';
  const hasDistance = run?.distanceM !== null && run?.distanceM !== undefined;

  // ----- handlers -----

  const onRpeChange = async (value: number) => {
    setRpe(value);
    if (id) {
      try {
        await setRunFeedback(id, { rpe: value });
      } catch (err) {
        console.warn('[RunSummary] setRunFeedback rpe failed:', err);
      }
    }
  };

  const onNotesBlur = async () => {
    if (id) {
      try {
        await setRunFeedback(id, { notes: notes.trim() || null });
      } catch (err) {
        console.warn('[RunSummary] setRunFeedback notes failed:', err);
      }
    }
  };

  const onTerrainChange = async (value: RunTerrain) => {
    setTerrain(value);
    if (id) {
      try {
        await setRunTerrain(id, value);
      } catch (err) {
        console.warn('[RunSummary] setRunTerrain failed:', err);
      }
    }
  };

  const onManualDistanceSubmit = async () => {
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

  const onExport = async () => {
    if (!run || isExporting) return;
    setIsExporting(true);
    try {
      const result = await exportRunAsGpx(run, t);
      if ('error' in result) {
        // `unavailable` = partage indisponible ; sinon message générique. Le cas
        // `empty` (< 2 points valides) est défensif et inatteignable ici (le bouton
        // n'est affiché que si `validPointCount >= 2`) → couvert par `errorFailed`.
        const message =
          result.error === 'unavailable'
            ? t('running.export.errorUnavailable')
            : t('running.export.errorFailed');
        Alert.alert(t('running.export.cta'), message);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const onDone = () => {
    router.replace('/(tabs)/running');
  };

  // ----- render guards -----

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

  // ----- affichage des métriques -----

  const distanceKm =
    run.distanceM !== null ? run.distanceM / 1000 : null;

  const durationDisplay = formatDuration(run.durationSeconds);

  // Export GPX : uniquement une course GPS terminée avec ≥ 2 points valides.
  const canExport =
    run.status === 'completed' && run.source !== 'manual' && validPointCount >= 2;

  // US RUN-F3 (5.25) : phrases d'écart, une par axe présent — jamais de concaténation, l'ordre
  // des mots diffère entre FR et EN (R2). `success` pour atteint/dépassé, neutre pour en deçà —
  // jamais `danger` (R4, ne pas atteindre un objectif de course n'est pas un échec).
  const distanceTarget = comparison.distance;
  const distanceTargetLabel = distanceTarget
    ? t(`running.target.distance${distanceTarget.status === 'reached' ? 'Reached' : distanceTarget.status === 'over' ? 'Over' : 'Under'}`, {
        done: units.formatDistance(distanceTarget.doneValue / 1000),
        target: units.formatDistance(distanceTarget.targetValue / 1000),
        diff: units.formatDistance(Math.abs(distanceTarget.diff) / 1000),
      })
    : null;
  const durationTarget = comparison.duration;
  const durationTargetLabel = durationTarget
    ? t(`running.target.duration${durationTarget.status === 'reached' ? 'Reached' : durationTarget.status === 'over' ? 'Over' : 'Under'}`, {
        done: formatDuration(durationTarget.doneValue),
        target: formatDuration(durationTarget.targetValue),
        diff: formatDuration(Math.abs(durationTarget.diff)),
      })
    : null;
  const hasTarget = distanceTargetLabel !== null || durationTargetLabel !== null;

  return (
    <FormScreen>
      <ScreenHeader
        title={t('running.summary.title')}
        subtitle={t('running.summary.subtitle')}
      />

      {/* Célébration in-app d'un ou plusieurs records battus */}
      {beatenRecords.length > 0 ? (
        <CelebrationBanner distances={beatenRecords} />
      ) : null}

      {/* Métriques principales */}
      <Card>
        <StatRow
          label={t('running.summary.distance')}
          value={
            distanceKm !== null
              ? units.formatDistance(distanceKm)
              : t('running.active.noData')
          }
        />
        <StatRow label={t('running.summary.duration')} value={durationDisplay} />
        <StatRow
          label={t('running.summary.avgPace')}
          value={units.formatPace(run.avgPaceSPerKm)}
        />
        {/* Dénivelé (US RUN-F1b) : absent si non connu (course manuelle ou antérieure à l'US) —
            jamais une ligne à « 0 m » (spec R5/§0, critère de recette 4-5). */}
        {run.elevationGainM !== null ? (
          <>
            <StatRow
              label={t('running.elevation.gainLabel')}
              value={`+${Math.round(run.elevationGainM)} m`}
            />
            <StatRow
              label={t('running.elevation.lossLabel')}
              value={`-${Math.round(run.elevationLossM ?? 0)} m`}
            />
          </>
        ) : null}
      </Card>

      {/* Comparaison à l'objectif (US RUN-F3, 5.25) — montée SEULEMENT si non vide (R1) : une
          course libre, ou une séance sans cible chiffrée, n'affiche aucun encart, jamais un
          « — » (spec §2, critère de recette 5). */}
      {hasTarget ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('running.target.title')}
          </Text>
          {distanceTargetLabel ? (
            <Text
              style={[
                styles.targetText,
                {
                  color:
                    distanceTarget!.status === 'under' ? colors.textMuted : colors.success,
                },
              ]}
            >
              {distanceTargetLabel}
            </Text>
          ) : null}
          {durationTargetLabel ? (
            <Text
              style={[
                styles.targetText,
                {
                  color:
                    durationTarget!.status === 'under' ? colors.textMuted : colors.success,
                },
              ]}
            >
              {durationTargetLabel}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {/* Saisie de distance manuelle (uniquement si source=manual et distance inconnue) */}
      {isManual && !hasDistance ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('running.summary.manualDistance')}
          </Text>
          <View style={styles.manualDistanceRow}>
            <TextInput
              style={[
                styles.distanceInput,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
              keyboardType="decimal-pad"
              placeholder={t(`running.summary.manualDistancePlaceholder_${units.system}`)}
              placeholderTextColor={colors.textMuted}
              value={manualDistanceText}
              onChangeText={setManualDistanceText}
              onBlur={onManualDistanceSubmit}
              onSubmitEditing={onManualDistanceSubmit}
              returnKeyType="done"
              accessibilityLabel={t('running.summary.manualDistance')}
            />
            <Text style={[styles.distanceUnit, { color: colors.textMuted }]}>
              {units.distanceSymbol}
            </Text>
          </View>
        </Card>
      ) : null}

      {/* Carte du parcours (GPS → trace ; manuel → état vide) */}
      <Card>
        <RouteMap
          points={simplified}
          emptyLabel={t('running.map.noTrack')}
        />
      </Card>

      {/* Splits par km (course GPS avec trace ≥ 1 km plein) — km le plus rapide en accent */}
      {splits.length > 0 ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('running.summary.splits')}
          </Text>
          {splits.map((s) => {
            const isFastest = s.km === fastestSplitKm;
            const barPct =
              slowestSplitSeconds > 0 ? (s.seconds / slowestSplitSeconds) * 100 : 0;
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

      {/*
        US RUN-F4 (lot F) — fraction par fraction.

        C'est l'équivalent de l'onglet « Détail des tours » d'une montre, et le mur M10 de
        l'analyse du 04/09/2026 : une séance de fractionné se lit « reps 1 à 5 à 4:01, la 7ᵉ a
        lâché à 4:40 », pas « j'ai couru 8 km ». La section est absente — pas vide — sur une
        course libre ou une course antérieure à cette US : il n'y a rien à dire, on ne dit rien.
      */}
      {intervalRows.length > 0 ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('running.realise.title')}
          </Text>

          {intervalRows.map((row) => {
            const isFast = row.phaseKind === 'fast';
            const range =
              row.plannedPaceMinSPerKm != null || row.plannedPaceMaxSPerKm != null
                ? { min: row.plannedPaceMinSPerKm, max: row.plannedPaceMaxSPerKm }
                : null;
            // Hors plage se signale en accent, jamais en rouge : une fraction 3 s trop lente
            // n'est pas une faute (même règle de ton que RUN-F2b R4).
            const outOfRange =
              range != null &&
              row.actualPaceSPerKm != null &&
              (row.actualPaceSPerKm < (range.min ?? 0) ||
                row.actualPaceSPerKm > (range.max ?? Number.POSITIVE_INFINITY));

            return (
              <View key={row.phaseIndex} style={styles.splitRow}>
                <Text style={[styles.splitKm, { color: colors.textMuted }]}>
                  {isFast
                    ? t('running.realise.rep', { defaultValue: 'Fraction' })
                    : t('running.realise.recoveryRow')}
                  {isFast ? ` ${row.rep}` : ''}
                </Text>
                <Text style={[styles.splitKm, { color: colors.textMuted, flex: 1 }]}>
                  {range
                    ? formatPaceMMSS(Math.round(range.min ?? range.max ?? 0), '—')
                    : t('running.realise.noData')}
                </Text>
                <Text
                  style={[
                    styles.splitPace,
                    { color: outOfRange ? colors.accent : colors.text },
                  ]}
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
            <Text style={[styles.splitKm, { color: colors.textMuted, marginTop: 8 }]}>
              {t('running.realise.avgPace')} :{' '}
              {formatPaceMMSS(Math.round(intervalSummary.avgFastPaceSPerKm), '—')}
              {intervalSummary.paceStdDevSPerKm != null
                ? ` · ${t('running.realise.regularity')} ${t('running.realise.regularityValue', {
                    value: Math.round(intervalSummary.paceStdDevSPerKm),
                  })}`
                : ''}
            </Text>
          ) : null}
          {intervalSummary.ratedCount > 0 ? (
            <Text style={[styles.splitKm, { color: colors.textMuted }]}>
              {t('running.realise.inRange', {
                done: intervalSummary.inRangeCount,
                total: intervalSummary.ratedCount,
              })}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {/* US ALLURE-01 — les trois lectures de la courbe d'allure (RUN-11, RUN-20, RUN-17).
          🔴 `splits` est passé en PROP : cet écran l'a déjà calculé plus haut (l.238), et le
          recalculer doublerait le coût du plus gros calcul de la page pour un résultat identique.
          Chaque carte se tait individuellement sous son seuil de données, et le composant entier
          rend `null` sur une course sans trace (spec R7) — une saisie manuelle n'a rien à analyser,
          et ce n'est pas une erreur. */}
      <PaceCurveCards splits={splits} />

      {/* Export GPX (course GPS terminée avec trace ≥ 2 points valides) */}
      {canExport ? (
        <Button
          label={t('running.export.cta')}
          variant="ghost"
          loading={isExporting}
          onPress={onExport}
        />
      ) : null}

      {/* Carte partageable (US PARTAGE-01) — proposée sur toute course TERMINÉE, y compris manuelle :
          sans tracé exploitable la carte s'affiche avec ses chiffres seuls, ce qui reste partageable.
          C'est la différence avec l'export GPX, qui exige une trace. */}
      {run.status === 'completed' ? (
        <Button
          label={t('share.cta')}
          variant="ghost"
          onPress={() => setShareOpen(true)}
        />
      ) : null}

      {/* Ressenti : RPE */}
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('running.summary.rpe')}
        </Text>
        <RpeSelector value={rpe} onChange={onRpeChange} />
        {rpe !== null ? (
          <Text style={[styles.rpeHint, { color: colors.textMuted }]}>
            {t('running.summary.rpeValue', { value: rpe })}
          </Text>
        ) : null}
      </Card>

      {/* Terrain (US RUN-F3, D3) — facultatif, sans rapport avec le GPS : une course sans
          terrain choisi reste parfaitement valide. */}
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
                    { color: selected ? colors.background : colors.text },
                  ]}
                >
                  {t(`running.terrain.${option}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      {/* Ressenti : note libre */}
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('running.summary.notes')}
        </Text>
        <TextInput
          style={[
            styles.notesInput,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
          multiline
          numberOfLines={3}
          placeholder={t('running.summary.notesPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={notes}
          onChangeText={setNotes}
          onBlur={onNotesBlur}
          accessibilityLabel={t('running.summary.notes')}
          textAlignVertical="top"
        />
      </Card>

      {/* Bouton Terminé */}
      <View style={styles.footer}>
        <Button label={t('running.summary.done')} onPress={onDone} />
      </View>

      {/* US PARTAGE-01 — aperçu, puis partage (décision D4 : on voit ce qu'on envoie). */}
      <ShareCardSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        data={{
          kind: 'run',
          // Le tracé BRUT : `projectTrack` fait sa propre réduction par échantillonnage. Passer
          // `simplified` (Douglas-Peucker à 5 m) reviendrait à simplifier deux fois.
          points,
          startedAtMs: Date.parse(run.startedAt),
          stats: {
            distance: units.formatDistance(distanceKm),
            duration: durationDisplay,
            pace: units.formatPace(run.avgPaceSPerKm),
          },
        }}
        accessibilityLabel={t('share.run.a11y', {
          date: formatDayFull(run.startedAt),
          distance: units.formatDistance(distanceKm),
          duration: durationDisplay,
        })}
      />
    </FormScreen>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  loading: {
    fontFamily: fontFamily.body,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 32,
  },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 32,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statLabel: { fontFamily: fontFamily.body, fontSize: 15 },
  statValue: { fontFamily: fontFamily.displaySemi, fontSize: 17 },
  sectionTitle: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 15,
    marginBottom: 4,
  },
  // Splits par km
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  splitKm: { fontFamily: fontFamily.body, fontSize: 13, width: 52 },
  splitBarTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  splitPace: { fontFamily: fontFamily.monoBold, fontSize: 14, width: 64, textAlign: 'right' },
  // Distance manuelle
  manualDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distanceInput: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  distanceUnit: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 15,
  },
  // Objectif de la séance (RUN-F3)
  targetText: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
  },
  // Terrain (RUN-F3, D3)
  terrainRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  terrainChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  terrainChipLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
  },
  // RPE
  rpeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  rpeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpeBtnLabel: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 14,
  },
  rpeHint: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    marginTop: 2,
  },
  // Notes
  notesInput: {
    fontFamily: fontFamily.body,
    fontSize: 15,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 80,
  },
  // Célébration de record
  celebration: {
    backgroundColor: CELEBRATION_BG,
    borderRadius: 16,
    padding: 16,
    gap: 4,
    overflow: 'hidden',
  },
  celebrationSpark: {
    fontSize: 30,
    position: 'absolute',
    top: 8,
    right: 14,
  },
  celebrationTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 19,
    color: '#ffffff',
  },
  celebrationBody: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    color: '#ffffff',
  },
  celebrationRef: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 13,
    color: CELEBRATION_ACCENT,
    marginTop: 6,
  },
  // Footer
  footer: { marginTop: 'auto' },
});
