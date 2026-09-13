/**
 * La cérémonie de fin — US MUSCU-UX03, spec §5.13.
 *
 * ── Pourquoi elle existe ────────────────────────────────────────────────────────────────────────
 * « Terminer la séance » renvoyait au bilan après une seconde d'attente muette. Or la clôture
 * demande de toute façon ce temps-là (écriture, évaluation des records) : autant le **remplir** par
 * la seule chose que l'utilisateur veut voir à cet instant — ce qu'il vient de faire.
 *
 * Elle ne remplace pas le bilan (MUSCU-UX02) : elle y mène. Trois respirations, puis
 * « Voir le bilan ». Aucune information n'est exclusive à cet écran.
 *
 * ── Le relais nutrition ─────────────────────────────────────────────────────────────────────────
 * S'il apparaît, c'est le moment où les trois piliers cessent d'être trois apps dans une. Il est
 * silencieux quand le pilier Nutrition est désactivé (décision H).
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  computeSessionHeat,
  hottestMuscles,
  pickCoachLine,
  setTonnage,
  type FineMuscle,
  type GhostState,
} from '@wellness/shared';
import { PressableScale } from '@/components/motion/PressableScale';
import { StaggerIn } from '@/components/motion/StaggerIn';
import { BodyHeatCard } from '@/components/workout/immersive/BodyHeatCard';
import { RECORD_AMBER } from '@/components/workout/immersive/theme';
import { useNutritionRelay } from '@/components/workout/immersive/useNutritionRelay';
import type { ImmersiveRuntime } from '@/components/workout/immersive/types';
import { fontFamily } from '@/theme/fonts';

type Props = {
  runtime: ImmersiveRuntime;
  ghost: GhostState;
  /** Jour de la séance de référence (« mardi »), pour le verdict du fantôme. */
  ghostDayLabel: string;
  onOpenSummary: () => void;
};

export function SessionClosing({ runtime, ghost, ghostDayLabel, onOpenSummary }: Props) {
  const { t } = useTranslation();
  const { colors, units, entries, prefs } = runtime;
  const relay = useNutritionRelay();

  const doneSets = useMemo(
    () => entries.flatMap((entry) => entry.sets.filter((set) => set.done)),
    [entries],
  );
  const tonnage = doneSets.reduce((total, set) => total + setTonnage(set), 0);

  const heatSets = useMemo(
    () =>
      entries.flatMap((entry) =>
        entry.sets.map((set) => ({
          exerciseId: entry.exerciseId,
          setType: set.setType,
          done: set.done,
        })),
      ),
    [entries],
  );
  const heat = useMemo(() => computeSessionHeat(heatSets, runtime.muscles), [heatSets, runtime.muscles]);
  const setsByMuscle = useMemo(() => {
    const counts: Partial<Record<FineMuscle, number>> = {};
    for (const set of heatSets) {
      if (!set.done || set.setType === 'warmup') continue;
      const muscles = runtime.muscles[set.exerciseId];
      if (!muscles) continue;
      for (const muscle of muscles.full) counts[muscle] = (counts[muscle] ?? 0) + 1;
    }
    return counts;
  }, [heatSets, runtime.muscles]);

  // Verdict du fantôme, en pourcentage de tonnage : « Mardi battu : +4 % » se compare d'une séance
  // à l'autre, contrairement à un écart en kilos qui dépend des exercices du jour.
  const ghostPercent =
    ghost.hasGhost && ghost.ghostTotal > 0
      ? Math.round(((ghost.you - ghost.ghostTotal) / ghost.ghostTotal) * 100)
      : null;

  const coach = pickCoachLine({
    event: 'sessionEnd',
    character: prefs.coach,
    vars: { sets: doneSets.length, tonnage: Math.round(tonnage) },
  });

  useEffect(() => {
    runtime.speak(coach);
    // La réplique de fin se dit une fois : la relancer à chaque rendu couperait sa propre phrase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <StaggerIn index={0}>
          <Text style={[styles.title, { color: colors.text }]}>{t('immersive.closing.title')}</Text>
        </StaggerIn>

        <StaggerIn index={1}>
          <BodyHeatCard heat={heat} setsByMuscle={setsByMuscle} pulse={hottestMuscles(heat, 1)[0] ?? null} colors={colors} />
        </StaggerIn>

        <StaggerIn index={2}>
          <View style={styles.stats}>
            <Stat value={runtime.elapsed} label={t('workout.summary.duration')} colors={colors} />
            <Stat
              value={units.formatWeight(Math.round(tonnage))}
              label={t('workout.summary.volume')}
              colors={colors}
            />
            <Stat value={String(doneSets.length)} label={t('workout.summary.sets')} colors={colors} />
            {runtime.recordsCount > 0 ? (
              <Stat
                value={String(runtime.recordsCount)}
                label={t('immersive.closing.records')}
                color={RECORD_AMBER}
                colors={colors}
              />
            ) : null}
          </View>
        </StaggerIn>

        {ghostPercent !== null ? (
          <StaggerIn index={3}>
            <Text
              style={[
                styles.ghost,
                { color: ghostPercent >= 0 ? colors.success : colors.textMuted },
              ]}
            >
              {t(ghostPercent >= 0 ? 'immersive.closing.ghostBeat' : 'immersive.closing.ghostAhead', {
                percent: Math.abs(ghostPercent),
                day: ghostDayLabel,
              })}
            </Text>
          </StaggerIn>
        ) : null}

        {coach ? (
          <StaggerIn index={4}>
            <Text style={[styles.coach, { color: colors.textMuted }]}>
              {t(coach.key, coach.vars)}
            </Text>
          </StaggerIn>
        ) : null}

        {/* Le seul endroit de la séance où les piliers se parlent à voix haute. */}
        {relay ? (
          <StaggerIn index={5}>
            <View style={[styles.relay, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Ionicons name="restaurant-outline" size={18} color={colors.accent} />
              <Text style={[styles.relayText, { color: colors.text }]}>
                {t('immersive.closing.nutritionRelay', { grams: relay.extraCarbsG })}
              </Text>
            </View>
          </StaggerIn>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PressableScale
          accessibilityRole="button"
          haptic="milestone"
          onPress={onOpenSummary}
          style={[styles.primary, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.primaryLabel, { color: colors.accentText }]}>
            {t('immersive.closing.openSummary')}
          </Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

function Stat({
  value,
  label,
  color,
  colors,
}: {
  value: string;
  label: string;
  color?: string;
  colors: ImmersiveRuntime['colors'];
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: color ?? colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 22, paddingVertical: 18, gap: 18, alignItems: 'stretch' },
  title: {
    fontFamily: fontFamily.displayXBold,
    fontSize: 34,
    letterSpacing: -1.4,
    textAlign: 'center',
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 22 },
  stat: { alignItems: 'center', gap: 2, minWidth: 74 },
  statValue: { fontFamily: fontFamily.displayXBold, fontSize: 24, letterSpacing: -0.8 },
  statLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  ghost: { fontFamily: fontFamily.bodyBold, fontSize: 15, textAlign: 'center' },
  coach: { fontFamily: fontFamily.body, fontSize: 13.5, textAlign: 'center', fontStyle: 'italic' },
  relay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  relayText: { flex: 1, fontFamily: fontFamily.bodySemi, fontSize: 13.5, lineHeight: 18 },
  footer: { paddingHorizontal: 22, paddingBottom: 16 },
  primary: {
    minHeight: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { fontFamily: fontFamily.bodyBold, fontSize: 18 },
});
