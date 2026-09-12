/**
 * US MUSCU-UX02 — **le** bilan de séance. Un composant, deux montages.
 *
 * ── Ce qu'il remplace ────────────────────────────────────────────────────────────────────────────
 * `workout-summary.tsx` (623 l) et `history/[id].tsx` (484 l) étaient deux implémentations
 * divergentes du même objet : l'un avait les agrégats et l'écart depuis la dernière fois, l'autre le
 * détail série par série et l'écart au planifié, et le ressenti s'y lisait « 8/10 » contre
 * « Difficile ». Maintenir l'iso à la main avait déjà échoué ; il devient ici une **propriété du
 * code** — il n'y a plus qu'un rendu.
 *
 * ── Ce que `context` pilote, et rien d'autre (spec R9) ───────────────────────────────────────────
 * 1. l'en-tête, rendu par la **route** (pas ici) ;
 * 2. l'animation de célébration, jouée **une seule fois** — elle ne doit pas rejouer quand on
 *    rouvre depuis l'historique une séance vieille de trois mois ;
 * 3. le bouton de pied, rendu par la route.
 *
 * Tout le reste est identique par construction.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  coerceWorkoutDisplayLevel,
  workoutReportVisibility,
  WORKOUT_DISPLAY_LEVELS,
  type WorkoutDisplayLevel,
  type WorkoutReport as Report,
} from '@wellness/shared';
import { CelebrationCard } from '@/components/CelebrationCard';
import { upsertProfile, useProfile } from '@/data/repositories/profile-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { FeelingSection } from './FeelingSection';
import {
  HabitComparison,
  MuscleSplit,
  ProgramCompliance,
  RecordList,
  RelativeIntensity,
  RepRanges,
  SecondaryStats,
  SessionWeight,
  SetTypes,
  StatBand,
  VerdictCard,
} from './ReportBlocks';
import { ReportExerciseList } from './ReportExerciseList';

/** Où le bilan est monté. Ne pilote que la célébration ici (voir l'en-tête du fichier). */
export type ReportContext = 'post-session' | 'history';

/**
 * Sélecteur de niveau — **sur l'écran**, pas dans les Réglages (décision D2).
 *
 * Un réglage enfoui n'aurait jamais été découvert ; ici il se bascule au moment où l'on lit, et
 * l'utilisateur comprend ce que chaque mode contient en le voyant.
 */
function LevelSwitcher({
  level,
  onChange,
}: {
  level: WorkoutDisplayLevel;
  onChange: (next: WorkoutDisplayLevel) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={[styles.switcher, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {WORKOUT_DISPLAY_LEVELS.map((value) => {
        const selected = level === value;
        return (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={t(`workout.report.level.${value}`)}
            onPress={() => onChange(value)}
            style={({ pressed }) => [
              styles.segment,
              selected && { backgroundColor: colors.accent },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                {
                  color: selected ? colors.accentText : colors.textMuted,
                  fontFamily: selected ? fontFamily.bodyBold : fontFamily.bodySemi,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {t(`workout.report.level.${value}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * ⚠️ **Le bilan est reçu en prop, il n'est pas relu ici.**
 *
 * Chaque `useQuery` de `useWorkoutReport` ouvre une **surveillance** PowerSync, et rien n'est
 * dédupliqué entre deux instances du hook. L'appeler ici alors que la route l'appelle déjà pour son
 * en-tête et sa carte de partage doublait les 9 requêtes — exactement le gaspillage que la spec R11
 * décrit, divisé par 1,5 au lieu d'être supprimé.
 *
 * La route lit, garde le chargement et l'introuvable, puis passe le résultat.
 */
export function WorkoutReport({ report, context }: { report: Report; context: ReportContext }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { profile } = useProfile();

  const level = coerceWorkoutDisplayLevel(profile?.summaryDisplayLevel);
  const visibility = workoutReportVisibility(level);

  const recordExercises = new Set(report.records.map((r) => r.exerciseId)).size;

  return (
    <View style={styles.wrap}>
      {/* La bannière n'est montée qu'en fin de séance : rouvrir une séance de mars ne doit pas
          déclencher une célébration. Elle démarre son animation au montage, d'où sa position tout
          en haut — montée plus bas, elle serait déjà terminée quand on y arriverait en scrollant. */}
      {context === 'post-session' && recordExercises > 0 ? (
        <CelebrationCard style={[styles.celebration, { backgroundColor: colors.accent }]}>
          <Text style={[styles.celebrationTitle, { color: colors.accentText }]}>
            {recordExercises === 1
              ? t('workout.summary.celebration.titleOne')
              : t('workout.summary.celebration.titleMany', { count: recordExercises })}
          </Text>
        </CelebrationCard>
      ) : null}

      <LevelSwitcher
        level={level}
        onChange={(next) => void upsertProfile({ summaryDisplayLevel: next })}
      />

      <VerdictCard report={report} />

      <StatBand totals={report.totals} />
      {visibility.secondaryStats ? (
        <SecondaryStats totals={report.totals} advanced={visibility.advancedStats} />
      ) : null}

      {visibility.habitComparison ? <HabitComparison comparison={report.comparison} /> : null}

      {visibility.muscleSplit ? (
        <MuscleSplit split={report.muscleSplit} showHardSets={visibility.hardSets} />
      ) : null}

      {visibility.programCompliance ? (
        <ProgramCompliance compliance={report.compliance} programName={report.title} />
      ) : null}

      {/* Les quatre blocs lourds sont **repliés**, chiffre-clé visible sur l'en-tête (décision D6) :
          dépliés d'office, le niveau Avancé dépassait les 3 500 px sans un seul repère. */}
      {visibility.relativeIntensity ? (
        <RelativeIntensity exercises={report.exercises} collapsible />
      ) : null}
      {visibility.repRanges ? <RepRanges ranges={report.repRanges} collapsible /> : null}
      {visibility.setTypes ? <SetTypes types={report.setTypes} collapsible /> : null}

      <ReportExerciseList
        exercises={report.exercises}
        detail={visibility.setDetail}
        warmupSets={report.totals.warmupSets}
      />

      {visibility.recordDetail ? <RecordList records={report.records} /> : null}
      {visibility.sessionWeight ? <SessionWeight report={report} collapsible /> : null}

      <FeelingSection
        key={report.workoutId}
        workoutId={report.workoutId}
        initialRpe={report.feelingRpe}
        initialNotes={report.notes}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  switcher: { flexDirection: 'row', gap: 4, padding: 4, borderWidth: 1, borderRadius: 14 },
  segment: {
    flex: 1,
    minWidth: 0,
    // 44 et non 36 : la spec §6 nomme explicitement ces trois boutons, et c'est le contrôle le plus
    // utilisé de l'écran. `FeelingSection` et `CollapsibleBlock` étaient déjà conformes.
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 4,
  },
  segmentLabel: { fontSize: 12.5 },
  celebration: { borderRadius: 16, padding: 16, alignItems: 'center', gap: 4 },
  celebrationTitle: { fontFamily: fontFamily.displayBold, fontSize: 17, textAlign: 'center' },
  pressed: { opacity: 0.8 },
});
