import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  EQUIPMENTS,
  type BodyGoalZone,
  type Equipment,
  type StrengthProgramRecommendation,
} from '@wellness/shared';

import type { StrengthProgramRecommendationCandidate } from '@/data/repositories/strength-program-recommendation-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

type Props = {
  candidate: StrengthProgramRecommendationCandidate;
  recommendation: StrengthProgramRecommendation;
  onAction: () => void;
  actionDisabled?: boolean;
};

function requiredEquipment(candidate: StrengthProgramRecommendationCandidate): Equipment[] {
  const found = new Set<Equipment>();
  for (const session of candidate.program.sessions) {
    for (const plan of session.plans) {
      if (plan.equipment && plan.equipment !== 'bodyweight') found.add(plan.equipment);
    }
  }
  return EQUIPMENTS.filter((equipment) => found.has(equipment));
}

export function StrengthProgramRecommendationCard({
  candidate,
  recommendation,
  onAction,
  actionDisabled = false,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const equipment = requiredEquipment(candidate);
  const canPrepare = recommendation.isCurrent || recommendation.compatible;

  const zoneLabel = (zone: BodyGoalZone) => t(`bodyShape.zones.${zone}`);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: recommendation.compatible ? colors.accent : colors.warnBorder,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text
            accessibilityRole="header"
            accessibilityLabel={t('strengthProgramFinder.card.a11y', {
              name: candidate.program.name,
            })}
            style={[styles.title, { color: colors.text }]}
          >
            {candidate.program.name}
          </Text>
          <Text style={[styles.badge, { color: colors.accent }]}>
            {t(
              recommendation.isCurrent
                ? 'strengthProgramFinder.card.current'
                : 'strengthProgramFinder.card.editorial',
            )}
          </Text>
        </View>
        <Text style={[styles.status, { color: recommendation.compatible ? colors.success : colors.warnText }]}>
          {t(
            recommendation.compatible
              ? 'strengthProgramFinder.card.compatible'
              : 'strengthProgramFinder.card.toReview',
          )}
        </Text>
      </View>

      <View style={styles.facts}>
        <Text style={[styles.fact, { color: colors.text }]}>
          {t('strengthProgramFinder.card.level', {
            value: candidate.program.level
              ? t(`running.programLevel.${candidate.program.level}`)
              : t('strengthProgramFinder.card.unknown'),
          })}
        </Text>
        <Text style={[styles.fact, { color: colors.text }]}>
          {t('strengthProgramFinder.card.sessions', {
            count: candidate.program.sessions.length,
          })}
        </Text>
        <Text style={[styles.fact, { color: colors.text }]}>
          {equipment.length === 0
            ? t('strengthProgramFinder.card.noEquipment')
            : t('strengthProgramFinder.card.requiredEquipment', {
                value: equipment.map((value) => t(`equipment.${value}`)).join(', '),
              })}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('strengthProgramFinder.card.durationTitle')}
        </Text>
        {candidate.program.sessions.map((session, index) => {
          const duration = recommendation.sessionDurationMinutes[index];
          const sessionName = session.name ?? t('bodyTraining.unnamedSession');
          return (
            <Text key={session.id} style={[styles.line, { color: colors.textMuted }]}>
              {duration === null
                ? <>
                    <Text style={[styles.sessionName, { color: colors.text }]}>{sessionName}: </Text>
                    {t('strengthProgramFinder.card.durationUnknown')}
                  </>
                : t('strengthProgramFinder.card.durationKnown', {
                    session: sessionName,
                    count: duration,
                  })}
            </Text>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('strengthProgramFinder.card.coverageTitle')}
        </Text>
        {recommendation.priorityCoverage.map((coverage) => (
          <Text key={coverage.zone} style={[styles.line, { color: colors.textMuted }]}>
            {t('strengthProgramFinder.card.knownSets', {
              zone: zoneLabel(coverage.zone),
              count: coverage.knownPlannedSets,
            })}
          </Text>
        ))}
        {recommendation.missingFineMuscles.length > 0 ? (
          <Text style={[styles.line, { color: colors.textMuted }]}>
            {t('strengthProgramFinder.card.missingFine', {
              value: recommendation.missingFineMuscles
                .map((muscle) => t(`muscleFine.${muscle}`))
                .join(', '),
            })}
          </Text>
        ) : null}
        {recommendation.generalPriorityZones.map((zone) => (
          <Text key={zone} style={[styles.line, { color: colors.textMuted }]}>
            {t('strengthProgramFinder.card.generalOnly', { zone: zoneLabel(zone) })}
          </Text>
        ))}
      </View>

      {recommendation.reasons.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('strengthProgramFinder.card.reasonsTitle')}
          </Text>
          {recommendation.reasons.map((reason) => (
            <Text key={reason} style={[styles.line, { color: colors.success }]}>
              {t(`strengthProgramFinder.card.reasons.${reason}`)}
            </Text>
          ))}
        </View>
      ) : null}

      {recommendation.issues.length > 0 ? (
        <View
          accessibilityRole="alert"
          style={[styles.issues, { backgroundColor: colors.warn, borderColor: colors.warnBorder }]}
        >
          {recommendation.issues.map((issue) => (
            <Text key={issue} style={[styles.line, { color: colors.warnText }]}>
              {t(`strengthProgramFinder.card.issues.${issue}`)}
            </Text>
          ))}
        </View>
      ) : null}

      {canPrepare ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(
            recommendation.isCurrent
              ? 'strengthProgramFinder.card.editCurrent'
              : 'strengthProgramFinder.card.prepare',
          )}
          accessibilityState={{ disabled: actionDisabled }}
          disabled={actionDisabled}
          onPress={onAction}
          style={[
            styles.action,
            {
              backgroundColor: recommendation.isCurrent ? colors.surface : colors.accent,
              borderColor: recommendation.isCurrent ? colors.borderStrong : colors.accent,
              opacity: actionDisabled ? 0.5 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.actionText,
              { color: recommendation.isCurrent ? colors.text : colors.accentText },
            ]}
          >
            {t(
              recommendation.isCurrent
                ? 'strengthProgramFinder.card.editCurrent'
                : 'strengthProgramFinder.card.prepare',
            )}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1.5, padding: 16, gap: 14 },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerText: { flex: 1, minWidth: 160, gap: 3 },
  title: { fontFamily: fontFamily.bodyBold, fontSize: 20, lineHeight: 27 },
  badge: { fontFamily: fontFamily.bodySemi, fontSize: 12, lineHeight: 18 },
  status: { fontFamily: fontFamily.bodyBold, fontSize: 13, lineHeight: 19, flexShrink: 1 },
  facts: { gap: 5 },
  fact: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 21 },
  section: { gap: 5 },
  sectionTitle: { fontFamily: fontFamily.bodyBold, fontSize: 14, lineHeight: 21 },
  sessionName: { fontFamily: fontFamily.bodySemi, fontSize: 13, lineHeight: 19 },
  line: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19 },
  issues: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 5 },
  action: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
});
