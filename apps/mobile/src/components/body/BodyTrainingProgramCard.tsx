import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { analyseBodyTrainingProgram, BODY_TRAINING_MUSCLES, type BodyGoalZone } from '@wellness/shared';
import { useBodyTrainingProgram } from '@/data/repositories/body-training-program-repository';
import { fontFamily } from '@/theme/fonts';
import { useUnits } from '@/hooks/useUnits';
import { useTheme } from '@/theme/useTheme';
import { BodyTrainingButton as Button } from './BodyTrainingButton';

export function BodyTrainingProgramCard({ priorities }: { priorities: BodyGoalZone[] }) {
  const { program, isLoading, error } = useBodyTrainingProgram();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { formatAxisNumber } = useUnits();
  const countLabel = (key: string, count: number) => t(key, { count, value: formatAxisNumber(count) });
  const router = useRouter();
  const text = { color: colors.text };
  const muted = { color: colors.textMuted };
  const coverage = program ? analyseBodyTrainingProgram(program, priorities) : [];
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <Text accessibilityRole="header" style={[styles.title, text]}>{t('bodyTraining.programTitle')}</Text>
    {error ? <Text accessibilityRole="alert" style={[styles.body, text]}>{t('bodyTraining.programError')}</Text>
      : isLoading ? <Text style={[styles.body, muted]}>{t('bodyTraining.programLoading')}</Text>
        : !program ? <>
          <Text style={[styles.body, muted]}>{t('bodyTraining.noProgram')}</Text>
          <Button label={t('bodyTraining.browsePrograms')} onPress={() => router.push('/programs')} />
        </> : <>
          <Text style={[styles.title, text]}>{program.name}</Text>
          <Text style={[styles.body, muted]}>{countLabel('bodyTraining.sessionCount', program.sessions.length)}</Text>
          <Text style={[styles.body, muted]}>{t('bodyTraining.programPeriod')}</Text>
          {!program.sessions.some(session => session.plans.length > 0) ? <Text style={[styles.body, text]}>{t('bodyTraining.emptyProgram')}</Text> : null}
          {coverage.map(zone => <View key={zone.zone} style={[styles.zone, { borderColor: colors.border }]}>
            <Text accessibilityRole="header" style={[styles.title, text]}>{t(`bodyShape.zones.${zone.zone}`)}</Text>
            <Text style={[styles.count, { color: colors.accent }]}>{countLabel('bodyTraining.exactSets', zone.exactSets)}</Text>
            <Text style={[styles.caption, muted]}>{t('bodyTraining.exactHint')}</Text>
            {zone.unknownSetPlans > 0 ? <Text style={[styles.body, text]}>{countLabel('bodyTraining.unknownSets', zone.unknownSetPlans)}</Text> : null}
            {zone.generalPlans > 0 ? <Text style={[styles.body, text]}>{countLabel('bodyTraining.generalPlans', zone.generalPlans)}</Text> : null}
            {zone.matches.length === 0 ? <Text style={[styles.body, muted]}>{t('bodyTraining.noMatch')}</Text> : null}
            {BODY_TRAINING_MUSCLES[zone.zone].map(muscle => <View key={muscle} style={styles.muscle}>
              <Text style={[styles.body, text]}>{t(`muscleFine.${muscle}`)}</Text>
              {!zone.matches.some(match => match.muscles.includes(muscle)) ? <Text style={[styles.caption, muted]}>{t('bodyTraining.noFineMuscle')}</Text> : null}
              <Button label={t(`bodyTraining.explore.${muscle}`)} onPress={() => router.push({ pathname: '/body', params: { muscle } })} />
            </View>)}
            {zone.matches.map(match => <View key={match.planId} style={[styles.match, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.exercise, text]}>{match.exerciseName || t('bodyTraining.unnamedExercise')}</Text>
              <Text style={[styles.caption, muted]}>{match.sessionName || t('bodyTraining.unnamedSession')}</Text>
              <Text style={[styles.body, text]}>{match.targetSets === null ? t('bodyTraining.setsUnknown') : countLabel('bodyTraining.plannedSets', match.targetSets)}</Text>
              <Text style={[styles.caption, muted]}>{match.kind === 'general' ? t('bodyTraining.generalOnly') : match.muscles.map(muscle => t(`muscleFine.${muscle}`)).join(' · ')}</Text>
            </View>)}
          </View>)}
          <Text style={[styles.caption, muted]}>{t('bodyTraining.countingHint')}</Text>
          <Button label={t('bodyTraining.openProgram')} onPress={() => router.push(`/programs/${program.id}`)} />
        </>}
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 16, borderWidth: 1, borderRadius: 24, gap: 12 },
  title: { fontFamily: fontFamily.bodyBold, fontSize: 18 },
  body: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 21 },
  caption: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 18 },
  count: { fontFamily: fontFamily.bodyBold, fontSize: 24 },
  zone: { borderTopWidth: 1, paddingTop: 16, gap: 10 },
  muscle: { gap: 6 },
  match: { padding: 12, borderRadius: 14, gap: 4 },
  exercise: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
});
