import { decodeTrack, simplifyTrack } from '@wellness/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormScreen } from '@/components/FormScreen';
import { RouteMap } from '@/components/running/RouteMap';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  setManualRunDistance,
  setRunFeedback,
  useRun,
} from '@/data/repositories/run-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { useUnits } from '@/hooks/useUnits';

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

  // État local du formulaire de feedback
  const [rpe, setRpe] = useState<number | null>(run?.rpe ?? null);
  const [notes, setNotes] = useState<string>(run?.notes ?? '');
  // Distance manuelle saisie (texte libre ; dans l'unité d'affichage courante)
  const [manualDistanceText, setManualDistanceText] = useState<string>('');

  // Décodage + simplification de la trace GPS pour la carte du parcours.
  const points = useMemo(
    () => (run?.gpsTrack ? decodeTrack(run.gpsTrack) : []),
    [run],
  );
  const simplified = useMemo(() => simplifyTrack(points, 5), [points]);

  // Sync initial des champs depuis la DB quand la course charge (premier rendu).
  // On utilise un ref pour n'initialiser qu'une fois.
  const [feedbackInit, setFeedbackInit] = useState(false);
  if (run && !feedbackInit) {
    setFeedbackInit(true);
    if (run.rpe !== null) setRpe(run.rpe);
    if (run.notes !== null) setNotes(run.notes);
  }

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

  return (
    <FormScreen>
      <ScreenHeader
        title={t('running.summary.title')}
        subtitle={t('running.summary.subtitle')}
      />

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
      </Card>

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
  // Footer
  footer: { marginTop: 'auto' },
});
