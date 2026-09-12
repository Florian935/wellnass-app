/**
 * US MUSCU-UX02 — les blocs du bilan de séance.
 *
 * Un fichier, parce que ces blocs partagent tous le même idiome : un surtitre, une carte, des lignes
 * « libellé · barre · valeur », une note qui explique le calcul. Les séparer en douze fichiers de
 * quarante lignes aurait dispersé une seule idée visuelle sans rien isoler de testable.
 *
 * Chaque bloc suit la **règle R2** : il rend `null` quand sa donnée manque, plutôt que de s'afficher
 * à zéro. C'est ce qui fait qu'une première séance reste digne au lieu d'être un champ de tirets.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type {
  MuscleGroupSessionSplit,
  RepRangeShare,
  ReportExercise,
  ReportRecord,
  SessionComparison,
  SessionCompliance,
  SessionTotals,
  SetTypeShare,
  WorkoutReport,
} from '@wellness/shared';
import { useUnits } from '@/hooks/useUnits';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { Bar, CardNote, DeltaBadge, Eyebrow, ReportCard, ReportSection } from './ReportPrimitives';

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

/**
 * La phrase qui conclut le bilan. **Le bloc qui manquait** : l'ancien écran ne concluait jamais, on
 * scrollait jusqu'à « Retour à l'accueil ».
 *
 * Une clé i18n par cas (spec R3) — l'ordre des mots diffère en anglais, et une concaténation
 * produirait une phrase juste en français et bancale ailleurs.
 */
export function VerdictCard({ report }: { report: WorkoutReport }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const verdict = report.verdict;
  const units = useUnits();

  const title =
    verdict.kind === 'record'
      ? t('workout.report.verdict.record', { exercise: verdict.exerciseName })
      : verdict.kind === 'best_volume'
        ? t('workout.report.verdict.bestVolume', { session: verdict.sessionTitle })
        : verdict.kind === 'progress'
          ? t('workout.report.verdict.progress', {
              exercise: verdict.exerciseName,
              weight: units.formatWeight(verdict.deltaKg),
            })
          : verdict.kind === 'weekly'
            ? t('workout.report.verdict.weekly', { count: verdict.sessionCount })
            : t('workout.report.verdict.done', { count: verdict.durationMin });

  const subtitle =
    verdict.kind === 'record'
      ? t('workout.report.verdict.recordSubtitle', { count: verdict.recordCount })
      : null;

  return (
    <View style={[styles.verdict, { backgroundColor: colors.panel }]}>
      <View style={[styles.verdictIcon, { backgroundColor: `${colors.accent}29` }]}>
        <Ionicons
          name={verdict.kind === 'record' ? 'trophy-outline' : 'checkmark-circle-outline'}
          size={21}
          color={colors.panelAccent}
        />
      </View>
      <View style={styles.verdictTexts}>
        <Text style={[styles.verdictTitle, { color: colors.panelText }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.verdictSubtitle, { color: colors.panelMuted }]}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Bandes de statistiques
// ---------------------------------------------------------------------------

/** Une cellule de la bande principale : la valeur d'abord, son nom dessous. */
function StatCell({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.statCell}>
      {/* `adjustsFontSizeToFit` : un tonnage à quatre chiffres débordait de la bande et poussait la
          dernière cellule hors de l'écran. La valeur rétrécit dans sa colonne plutôt que de pousser
          ses voisines — comportement conservé de l'ancien récap. */}
      <Text
        style={[styles.statValue, { color: colors.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Text>
      <Text
        style={[styles.statLabel, { color: colors.textMuted }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

/** Les trois chiffres qui ne bougent jamais, quel que soit le niveau (spec R1). */
export function StatBand({ totals }: { totals: SessionTotals }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  return (
    <View style={[styles.statBand, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <StatCell
        value={t('workout.report.minutes', { count: totals.durationMin })}
        label={t('workout.report.stat.duration')}
      />
      <View style={[styles.statSep, { backgroundColor: colors.border }]} />
      <StatCell value={units.formatWeight(totals.volumeKg)} label={t('workout.report.stat.volume')} />
      <View style={[styles.statSep, { backgroundColor: colors.border }]} />
      <StatCell value={String(totals.workingSets)} label={t('workout.report.stat.sets')} />
    </View>
  );
}

/** Une pastille de la grille secondaire. */
function StatChip({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text
        style={[styles.chipValue, { color: colors.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Text>
      <Text style={[styles.chipLabel, { color: colors.textMuted }]} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

/**
 * Les chiffres qui s'ajoutent **sous** la bande principale, jamais dedans (spec R1).
 *
 * Une pastille dont la valeur est indisponible n'est pas rendue : « — % du 1RM » sur un exercice
 * jamais testé serait une case vide déguisée en information.
 */
export function SecondaryStats({
  totals,
  advanced,
}: {
  totals: SessionTotals;
  advanced: boolean;
}) {
  const { t } = useTranslation();
  const units = useUnits();

  // ⚠️ **La densité n'est pas un poids.** `formatWeight` convertirait bien la valeur en livres mais
  // lui collerait un symbole de poids, sous un libellé « kg/min » figé — soit « 18,1 lb » sous
  // « KG/MIN » en impérial. On convertit la valeur et on compose l'unité, comme le faisait l'ancien
  // récap.
  const chips: { key: string; value: string; label: string }[] = [
    {
      key: 'density',
      value: units.formatAxisNumber(Math.round(units.toWeightValue(totals.densityKgPerMin))),
      label: t('workout.report.stat.density', { unit: units.weightSymbol }),
    },
  ];
  if (totals.relativeIntensityPercent !== null) {
    chips.push({
      key: 'intensity',
      value: t('workout.report.percent', {
        value: Math.round(totals.relativeIntensityPercent),
      }),
      label: t('workout.report.stat.ofMax'),
    });
  }
  if (totals.averageRpe !== null) {
    chips.push({
      key: 'rpe',
      value: totals.averageRpe.toFixed(1).replace('.', ','),
      label: t('workout.report.stat.averageRpe'),
    });
  }
  if (advanced) {
    if (totals.sessionLoad !== null) {
      chips.push({
        key: 'load',
        value: String(Math.round(totals.sessionLoad)),
        label: t('workout.report.stat.load'),
      });
    }
    if (totals.ratedSets > 0) {
      chips.push({
        key: 'hard',
        value: `${totals.hardSets}/${totals.ratedSets}`,
        label: t('workout.report.stat.hardSets'),
      });
    }
    if (totals.bestEstimated1RM !== null) {
      chips.push({
        key: 'onerm',
        value: units.formatWeight(totals.bestEstimated1RM),
        label: t('workout.report.stat.best1rm'),
      });
    }
  }

  if (chips.length === 0) return null;

  return (
    <View style={styles.chipGrid}>
      {chips.map((chip) => (
        <StatChip key={chip.key} value={chip.value} label={chip.label} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Vs ton habitude
// ---------------------------------------------------------------------------

/** Une métrique comparée : sa barre, sa médiane repérée par un trait, son écart. */
function ComparisonRow({
  label,
  medianLabel,
  ratio,
  tone,
  deltaLabel,
}: {
  label: string;
  medianLabel: string;
  ratio: number;
  tone: 'up' | 'down' | 'neutral';
  deltaLabel: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  // La barre suit le **ton**, pas le signe. La ligne « Durée » porte délibérément une pastille neutre
  // (une séance plus courte n'est pas un échec) ; laisser sa barre verdir ou griser selon le signe
  // faisait dire deux choses contradictoires à la même ligne.
  const fill =
    tone === 'up' ? colors.success : tone === 'down' ? colors.accent : colors.borderStrong;
  // La médiane est toujours au même endroit (70 % du rail) ; c'est la barre courante qui bouge
  // autour d'elle. Un repère fixe se lit d'une ligne à l'autre, un repère mobile ne se lit pas.
  const MEDIAN_MARK = 0.7;
  return (
    <View style={styles.comparisonRow}>
      <View style={styles.comparisonHead}>
        <Text style={[styles.comparisonLabel, { color: colors.text }]}>{label}</Text>
        <View style={styles.comparisonRight}>
          <Text style={[styles.comparisonMedian, { color: colors.textMuted }]}>{medianLabel}</Text>
          <DeltaBadge label={deltaLabel} tone={tone} />
        </View>
      </View>
      <View style={styles.comparisonBarWrap}>
        <Bar
          ratio={Math.min(1, ratio * MEDIAN_MARK)}
          color={fill}
          accessibilityLabel={t('workout.report.habit.a11y', {
            metric: label,
            delta: deltaLabel,
            median: medianLabel,
          })}
        />
        <View
          style={[styles.medianMark, { left: `${MEDIAN_MARK * 100}%`, backgroundColor: colors.textMuted }]}
        />
      </View>
    </View>
  );
}

export function HabitComparison({ comparison }: { comparison: SessionComparison | null }) {
  const { t } = useTranslation();
  const units = useUnits();
  if (comparison === null) return null;

  // Le signe est composé ici, l'espace avant le « % » par la clé : il existe en français, pas en
  // anglais, et le coder en dur ferait dire deux choses différentes au texte et à son libellé a11y.
  const percentLabel = (value: number) =>
    t('workout.report.percent', { value: `${value > 0 ? '+' : ''}${value}` });
  const tone = (value: number): 'up' | 'down' | 'neutral' =>
    value > 0 ? 'up' : value < 0 ? 'down' : 'neutral';

  return (
    <View style={styles.block}>
      <Eyebrow>{t('workout.report.habit.title')}</Eyebrow>
      <ReportCard>
        <ComparisonRow
          label={t('workout.report.stat.volume')}
          medianLabel={t('workout.report.habit.median', {
            value: units.formatWeight(comparison.volume.median),
          })}
          ratio={comparison.volume.current / comparison.volume.median}
          tone={tone(comparison.volume.deltaPercent)}
          deltaLabel={percentLabel(comparison.volume.deltaPercent)}
        />

        {comparison.density ? (
          <ComparisonRow
            label={t('workout.report.stat.density', { unit: units.weightSymbol })}
            medianLabel={t('workout.report.habit.median', {
              value: units.formatAxisNumber(Math.round(units.toWeightValue(comparison.density.median))),
            })}
            ratio={comparison.density.current / comparison.density.median}
            tone={tone(comparison.density.deltaPercent)}
            deltaLabel={percentLabel(comparison.density.deltaPercent)}
          />
        ) : null}

        {comparison.durationSeconds ? (
          <ComparisonRow
            label={t('workout.report.stat.duration')}
            medianLabel={t('workout.report.habit.median', {
              value: t('workout.report.minutes', {
                count: Math.round(comparison.durationSeconds.median / 60),
              }),
            })}
            ratio={comparison.durationSeconds.current / comparison.durationSeconds.median}
            // Une séance plus COURTE n'est pas une mauvaise nouvelle : la durée reste neutre, quel
            // que soit le signe. La peindre en rouge reprocherait une séance plus efficace.
            tone="neutral"
            deltaLabel={t('workout.report.habit.minutesDelta', {
              count: Math.round(
                (comparison.durationSeconds.current - comparison.durationSeconds.median) / 60,
              ),
            })}
          />
        ) : null}

        {comparison.load ? (
          <ComparisonRow
            label={t('workout.report.stat.load')}
            medianLabel={t('workout.report.habit.median', {
              value: String(Math.round(comparison.load.median)),
            })}
            ratio={comparison.load.current / comparison.load.median}
            tone={tone(comparison.load.deltaPercent)}
            deltaLabel={percentLabel(comparison.load.deltaPercent)}
          />
        ) : null}

        <CardNote>
          {t('workout.report.habit.note', { count: comparison.referenceCount })}
        </CardNote>
      </ReportCard>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Groupes musculaires
// ---------------------------------------------------------------------------

export function MuscleSplit({
  split,
  showHardSets,
}: {
  split: MuscleGroupSessionSplit[] | null;
  showHardSets: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (split === null || split.length === 0) return null;

  const max = Math.max(...split.map((g) => g.sets));

  return (
    <View style={styles.block}>
      <Eyebrow>{t('workout.report.muscles.title')}</Eyebrow>
      <ReportCard>
        {split.map((group) => {
          const name = t(`workout.report.muscle.${group.group}`);
          const value = showHardSets
            ? t('workout.report.muscles.setsWithHard', { sets: group.sets, hard: group.hardSets })
            : String(group.sets);
          return (
            <View key={group.group} style={styles.barRow}>
              <Text style={[styles.barLabel, { color: colors.text }]} numberOfLines={1}>
                {name}
              </Text>
              <Bar
                ratio={group.sets / max}
                color={colors.accent}
                accessibilityLabel={t('workout.report.muscles.a11y', {
                  muscle: name,
                  count: group.sets,
                })}
              />
              <Text style={[styles.barValue, { color: colors.textMuted }]}>{value}</Text>
            </View>
          );
        })}
        <CardNote>
          {showHardSets
            ? t('workout.report.muscles.noteHard')
            : t('workout.report.muscles.note')}
        </CardNote>
      </ReportCard>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Prescrit vs réalisé
// ---------------------------------------------------------------------------

export function ProgramCompliance({
  compliance,
  programName,
}: {
  compliance: SessionCompliance | null;
  programName: string | null;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  if (compliance === null) return null;

  const deviation = compliance.deviations[0] ?? null;
  // ⚠️ Pas de vert inconditionnel : « 0 % » peint en vert dirait l'inverse du chiffre qu'il
  // accompagne. Le seuil est bas (50 %) — il s'agit de ne pas féliciter un échec, pas de punir.
  const complianceTone = compliance.percent >= 50 ? colors.success : colors.accent;

  return (
    <View style={styles.block}>
      <Eyebrow>{t('workout.report.program.title')}</Eyebrow>
      <ReportCard>
        <View style={styles.programHead}>
          <Text style={[styles.programName, { color: colors.text }]} numberOfLines={1}>
            {programName ?? t('workout.report.program.fallbackName')}
          </Text>
          <Text style={[styles.programPercent, { color: complianceTone }]}>
            {t('workout.report.percent', { value: compliance.percent })}
          </Text>
        </View>
        <Bar
          ratio={compliance.percent / 100}
          color={complianceTone}
          accessibilityLabel={t('workout.report.program.a11y', { percent: compliance.percent })}
        />
        <CardNote>
          {t('workout.report.program.note', {
            compliant: compliance.compliantSets,
            planned: compliance.plannedSets,
          })}
          {deviation
            ? ` ${t('workout.report.program.deviation', {
                exercise: deviation.exerciseName,
                actual: units.formatWeight(deviation.weightKg ?? 0),
                planned: units.formatWeight(deviation.plannedWeightKg),
              })}`
            : ''}
        </CardNote>
      </ReportCard>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Blocs d'analyse (même idiome : libellé · barre · valeur)
// ---------------------------------------------------------------------------

/**
 * Intensité relative par exercice.
 *
 * Les exercices **sans 1RM de référence sont absents**, pas affichés à « — » : leur intensité n'est
 * pas nulle, elle est inconnue, et la note du bas le dit plutôt que de laisser croire à un oubli.
 */
export function RelativeIntensity({
  exercises,
  collapsible = false,
}: {
  exercises: ReportExercise[];
  collapsible?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const rated = exercises.filter((e) => e.relativeIntensityPercent !== null);
  if (rated.length === 0) return null;
  const missing = exercises.length - rated.length;

  // Chiffre-clé replié : l'exercice le plus intense, celui qui décide si ça vaut le dépliage.
  const lead = rated.reduce((a, b) =>
    (b.relativeIntensityPercent ?? 0) > (a.relativeIntensityPercent ?? 0) ? b : a,
  );

  return (
    <ReportSection
      title={t('workout.report.intensity.title')}
      summary={`${lead.exerciseName} · ${t('workout.report.percent', {
        value: Math.round(lead.relativeIntensityPercent!),
      })}`}
      collapsible={collapsible}
    >
      <ReportCard>
        {rated.map((exercise) => {
          const percent = Math.round(exercise.relativeIntensityPercent!);
          return (
            <View key={exercise.exerciseId} style={styles.barRow}>
              <Text style={[styles.barLabel, { color: colors.text }]} numberOfLines={1}>
                {exercise.exerciseName}
              </Text>
              <Bar
                ratio={percent / 100}
                color={colors.amber}
                accessibilityLabel={t('workout.report.intensity.a11y', {
                  exercise: exercise.exerciseName,
                  percent,
                })}
              />
              <Text style={[styles.barValue, { color: colors.text }]}>
                {t('workout.report.percent', { value: percent })}
              </Text>
            </View>
          );
        })}
        <CardNote>
          {t('workout.report.intensity.note')}
          {missing > 0 ? ` ${t('workout.report.intensity.missing', { count: missing })}` : ''}
        </CardNote>
      </ReportCard>
    </ReportSection>
  );
}

/** Plages de répétitions — force / hypertrophie / endurance, pondérées par le tonnage. */
export function RepRanges({
  ranges,
  collapsible = false,
}: {
  ranges: RepRangeShare[] | null;
  collapsible?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (ranges === null || ranges.length === 0) return null;

  // Chiffre-clé replié : la plage dominante — c'est toute la réponse du bloc en trois mots.
  const lead = ranges.reduce((a, b) => (b.percent > a.percent ? b : a));

  const tint: Record<string, string> = {
    strength: colors.accent,
    hypertrophy: colors.chartGreen,
    endurance: colors.amber,
  };

  return (
    <ReportSection
      title={t('workout.report.repRanges.title')}
      summary={`${t(`workout.report.repRange.${lead.range}`)} · ${t('workout.report.percent', {
        value: lead.percent,
      })}`}
      collapsible={collapsible}
    >
      <ReportCard>
        <View
          accessible
          accessibilityLabel={ranges
            .map(
              (r) =>
                `${t(`workout.report.repRange.${r.range}`)} ${t('workout.report.percent', {
                  value: r.percent,
                })}`,
            )
            .join(', ')}
          style={[styles.stack, { backgroundColor: colors.track }]}
        >
          {ranges.map((range) => (
            <View
              key={range.range}
              style={{ width: `${range.percent}%`, backgroundColor: tint[range.range] }}
            />
          ))}
        </View>
        {ranges.map((range) => (
          <View key={range.range} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: tint[range.range] }]} />
            <Text style={[styles.legendLabel, { color: colors.text }]} numberOfLines={1}>
              {t(`workout.report.repRange.${range.range}`)}
            </Text>
            <Text style={[styles.legendValue, { color: colors.textMuted }]}>
              {t('workout.report.percent', { value: range.percent })}
            </Text>
          </View>
        ))}
        <CardNote>{t('workout.report.repRanges.note')}</CardNote>
      </ReportCard>
    </ReportSection>
  );
}

/** Répartition par type de série — le seul endroit où les échauffements comptent. */
export function SetTypes({
  types,
  collapsible = false,
}: {
  types: SetTypeShare[] | null;
  collapsible?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (types === null || types.length === 0) return null;

  const max = Math.max(...types.map((s) => s.count));
  const lead = types.reduce((a, b) => (b.count > a.count ? b : a));

  return (
    <ReportSection
      title={t('workout.report.setTypes.title')}
      summary={t('workout.report.setTypes.a11y', {
        type: t(`workout.report.setType.${lead.setType}`, lead.setType),
        count: lead.count,
      })}
      collapsible={collapsible}
    >
      <ReportCard>
        {types.map((share) => {
          const label = t(`workout.report.setType.${share.setType}`, share.setType);
          return (
            <View key={share.setType} style={styles.barRow}>
              <Text style={[styles.barLabel, { color: colors.text }]} numberOfLines={1}>
                {label}
              </Text>
              <Bar
                ratio={share.count / max}
                color={share.setType === 'warmup' ? colors.borderStrong : colors.accent}
                accessibilityLabel={t('workout.report.setTypes.a11y', {
                  type: label,
                  count: share.count,
                })}
              />
              <Text style={[styles.barValue, { color: colors.textMuted }]}>{share.count}</Text>
            </View>
          );
        })}
        <CardNote>{t('workout.report.setTypes.note')}</CardNote>
      </ReportCard>
    </ReportSection>
  );
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export function RecordList({ records }: { records: ReportRecord[] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  if (records.length === 0) return null;

  /** Un volume de série est un nombre brut (kg·reps), pas un poids : il ne prend pas d'unité. */
  const format = (type: string, value: number) =>
    type === 'best_volume' ? String(Math.round(value)) : units.formatWeight(value);

  return (
    <View style={styles.block}>
      <Eyebrow>{t('workout.report.records.title')}</Eyebrow>
      {records.map((record) => (
        <View
          key={`${record.exerciseId}-${record.type}`}
          style={[styles.recordRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="trophy-outline" size={18} color={colors.accent} />
          <View style={styles.recordTexts}>
            <Text style={[styles.recordName, { color: colors.text }]} numberOfLines={1}>
              {record.exerciseName}
            </Text>
            <Text style={[styles.recordMeta, { color: colors.textMuted }]} numberOfLines={1}>
              {t(`workout.report.records.type.${record.type}`, record.type)}
              {record.previousValue !== null
                ? ` · ${t('workout.report.records.previous', {
                    value: format(record.type, record.previousValue),
                  })}`
                : ''}
            </Text>
          </View>
          <Text style={[styles.recordValue, { color: colors.accent }]}>
            {format(record.type, record.value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Ce que ça pèse
// ---------------------------------------------------------------------------

export function SessionWeight({
  report,
  collapsible = false,
}: {
  report: WorkoutReport;
  collapsible?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const units = useUnits();
  const { weekSessionCount, weekVolumeKg, lifetimeVolumeKg } = report.weight;

  // ⚠️ Seul bloc qui n'avait pas sa garde R2. Sur un compte qui ne fait que du poids du corps, les
  // deux tonnages valent 0 et la carte affichait « 0,0 kg » deux fois sous « Ce que ça pèse » —
  // exactement le bloc à zéro que la règle interdit.
  if (lifetimeVolumeKg <= 0) return null;

  return (
    <ReportSection
      title={t('workout.report.weight.title')}
      summary={units.formatWeight(lifetimeVolumeKg)}
      collapsible={collapsible}
    >
      <ReportCard>
        <View style={styles.weightRow}>
          <Text style={[styles.weightLabel, { color: colors.text }]}>
            {t('workout.report.weight.week')}
          </Text>
          <Text style={[styles.weightValue, { color: colors.textMuted }]}>
            {t('workout.report.weight.weekValue', {
              count: weekSessionCount,
              volume: units.formatWeight(weekVolumeKg),
            })}
          </Text>
        </View>
        <View style={[styles.weightSep, { backgroundColor: colors.border }]} />
        <View style={styles.weightRow}>
          <Text style={[styles.weightLabel, { color: colors.text }]}>
            {t('workout.report.weight.lifetime')}
          </Text>
          <Text style={[styles.weightValue, { color: colors.textMuted }]}>
            {units.formatWeight(lifetimeVolumeKg)}
          </Text>
        </View>
      </ReportCard>
    </ReportSection>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },

  verdict: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', borderRadius: 18, padding: 18 },
  verdictIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verdictTexts: { flex: 1, minWidth: 0, gap: 5 },
  verdictTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  verdictSubtitle: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },

  statBand: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 8,
  },
  statCell: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3, paddingHorizontal: 2 },
  statValue: { fontFamily: fontFamily.monoBold, fontSize: 17 },
  statLabel: { fontFamily: fontFamily.bodySemi, fontSize: 9.5, letterSpacing: 0.5 },
  statSep: { width: 1, height: 30 },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 3,
  },
  chipValue: { fontFamily: fontFamily.monoBold, fontSize: 14 },
  chipLabel: { fontFamily: fontFamily.bodySemi, fontSize: 9, letterSpacing: 0.4 },

  comparisonRow: { gap: 7 },
  comparisonHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  comparisonLabel: { fontFamily: fontFamily.body, fontSize: 13.5 },
  comparisonRight: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  comparisonMedian: { fontFamily: fontFamily.mono, fontSize: 12.5 },
  comparisonBarWrap: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  medianMark: { position: 'absolute', top: -2, width: 2, height: 12, borderRadius: 1 },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 96, flexShrink: 0, fontFamily: fontFamily.body, fontSize: 13 },
  barValue: {
    width: 52,
    flexShrink: 0,
    textAlign: 'right',
    fontFamily: fontFamily.mono,
    fontSize: 12.5,
  },

  programHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  programName: { flex: 1, minWidth: 0, fontFamily: fontFamily.bodySemi, fontSize: 14.5 },
  programPercent: { fontFamily: fontFamily.monoBold, fontSize: 22 },

  stack: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  legendDot: { width: 10, height: 10, borderRadius: 3, flexShrink: 0 },
  legendLabel: { flex: 1, minWidth: 0, fontFamily: fontFamily.body, fontSize: 13 },
  legendValue: { fontFamily: fontFamily.mono, fontSize: 12.5 },

  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  recordTexts: { flex: 1, minWidth: 0, gap: 2 },
  recordName: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  recordMeta: { fontFamily: fontFamily.body, fontSize: 12 },
  recordValue: { flexShrink: 0, fontFamily: fontFamily.monoBold, fontSize: 14 },

  weightRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  weightLabel: { fontFamily: fontFamily.body, fontSize: 13.5 },
  weightValue: { fontFamily: fontFamily.mono, fontSize: 13 },
  weightSep: { height: 1 },
});
