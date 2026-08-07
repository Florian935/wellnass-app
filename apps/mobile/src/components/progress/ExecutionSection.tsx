import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CollapsibleCard } from '@/components/CollapsibleCard';
import {
  useExecutionCompliance,
  useNeglectedFavorites,
  useSessionDurationStats,
  useSetTypeMix,
} from '@/data/repositories/records-repository';
import { useRealLifeState } from '@/data/repositories/real-life-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Section « Exécution » de l'écran Progression (US EXEC-01 — catalogue MUSC-33 / 26 / 13 / 21).
 *
 * L'écran savait dire **ce qui avait été fait** ; il ne disait rien de **l'écart avec ce qui était
 * prévu**. Quatre analyses regroupées ici parce qu'elles répondent à la même question.
 *
 * ── Conditionnelle, et repliée par défaut (ADR-007, spec §3.1) ───────────────────────────────────
 * L'écran Progression était **déjà au seuil de repli d'ADR-007** avant cette US — c'est ce qui avait
 * fait replier MUSCPWR-01. On suit le même patron : la section **rend `null`** quand ses quatre
 * analyses se taisent, donc elle ne coûte **rien** à quelqu'un qui n'a pas d'historique.
 *
 * Et ce n'est pas une concession : la règle R3 (« sous le seuil de données, on se tait ») imposait
 * déjà ce silence pour une raison de **justesse statistique**. Il se trouve qu'elle répond aussi au
 * plafond d'ADR-007 — la même décision servait déjà deux fins.
 *
 * ── On constate, on ne prescrit pas ──────────────────────────────────────────────────────────────
 * Aucune de ces cartes ne conseille. Un taux de 78 % n'est pas commenté, un dépassement au-delà de
 * 100 % n'est pas félicité. Ton de GARDE-01 et DOUL-01, déjà validé.
 *
 * ⚠️ **Chaque chiffre porte sa base** (spec R2) : « 94 % » ne veut rien dire sans « sur 87 séries ».
 */
export function ExecutionSection() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  // US VIE-01 (spec D3) : pendant une période déclarée, seul le taux d'exécution se tait — c'est le
  // seul des quatre qui puisse se lire comme un reproche. Durée, types de série et favoris délaissés
  // sont des constats neutres, ils restent.
  const { inRealLifePeriod } = useRealLifeState();

  const { compliance, isLoading: complianceLoading } = useExecutionCompliance();
  const { duration, isLoading: durationLoading } = useSessionDurationStats();
  const { mix, isLoading: mixLoading } = useSetTypeMix();
  const { neglected, isLoading: neglectedLoading } = useNeglectedFavorites();

  const isLoading = complianceLoading || durationLoading || mixLoading || neglectedLoading;

  // Un taux dont les DEUX ratios sont nuls n'a rien à montrer : le moteur rend quand même un objet
  // (il porte `sessionCount`), mais l'écran n'a aucun chiffre à afficher.
  const showCompliance =
    !inRealLifePeriod &&
    compliance !== null &&
    (compliance.loadRatio !== null || compliance.repsRatio !== null);

  const showNeglected = neglected.length > 0;

  // Conditionnelle : tant qu'aucune des quatre analyses n'a de quoi parler, la section n'existe pas.
  // Pas de section vide, pas de « — », pas de promesse de contenu futur.
  if (isLoading) return null;
  if (!showCompliance && duration === null && mix === null && !showNeglected) return null;

  const pct = (ratio: number) => `${Math.round(ratio * 100)} %`;
  const minutes = (seconds: number) => Math.round(seconds / 60);

  return (
    <CollapsibleCard
      title={t('progress.execution.title')}
      summary={t('progress.execution.subtitle')}
    >
      {showCompliance ? (
        <View
          style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}
          accessible
          accessibilityLabel={[
            t('progress.execution.compliance.title'),
            compliance.loadRatio !== null
              ? `${t('progress.execution.compliance.load')} ${pct(compliance.loadRatio)}, ${t('progress.execution.compliance.basisSets', { count: compliance.loadSetCount })}`
              : null,
            compliance.repsRatio !== null
              ? `${t('progress.execution.compliance.reps')} ${pct(compliance.repsRatio)}, ${t('progress.execution.compliance.basisSets', { count: compliance.repsSetCount })}`
              : null,
            t('progress.execution.compliance.basis', { count: compliance.sessionCount }),
          ]
            .filter(Boolean)
            .join('. ')}
        >
          <Text style={[styles.cardTitle, { color: colors.textMuted }]}>
            {t('progress.execution.compliance.title')}
          </Text>
          <View style={styles.metricRow}>
            {compliance.loadRatio !== null ? (
              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
                  {t('progress.execution.compliance.load')}
                </Text>
                <Text style={[styles.value, { color: colors.text }]}>
                  {pct(compliance.loadRatio)}
                </Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {t('progress.execution.compliance.basisSets', { count: compliance.loadSetCount })}
                </Text>
              </View>
            ) : null}
            {compliance.repsRatio !== null ? (
              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
                  {t('progress.execution.compliance.reps')}
                </Text>
                <Text style={[styles.value, { color: colors.text }]}>
                  {pct(compliance.repsRatio)}
                </Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {t('progress.execution.compliance.basisSets', { count: compliance.repsSetCount })}
                </Text>
              </View>
            ) : null}
          </View>
          {/* Spec R2 — le dénominateur en séances est dit, jamais un pourcentage nu. Et il explique
              pourquoi les deux taux ci-dessus peuvent porter sur des nombres de séries différents. */}
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {t('progress.execution.compliance.basis', { count: compliance.sessionCount })}
          </Text>
        </View>
      ) : null}

      {duration !== null ? (
        <View
          style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}
          accessible
          accessibilityLabel={[
            t('progress.execution.duration.title'),
            t('progress.execution.duration.median', { minutes: minutes(duration.medianSeconds) }),
            t(
              duration.trendSeconds >= 0
                ? 'progress.execution.duration.trendUp'
                : 'progress.execution.duration.trendDown',
              { minutes: Math.abs(minutes(duration.trendSeconds)) },
            ),
            duration.excludedCount > 0
              ? t('progress.execution.duration.excluded', { count: duration.excludedCount })
              : null,
          ]
            .filter(Boolean)
            .join('. ')}
        >
          <Text style={[styles.cardTitle, { color: colors.textMuted }]}>
            {t('progress.execution.duration.title')}
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {t('progress.execution.duration.median', { minutes: minutes(duration.medianSeconds) })}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {t(
              duration.trendSeconds >= 0
                ? 'progress.execution.duration.trendUp'
                : 'progress.execution.duration.trendDown',
              { minutes: Math.abs(minutes(duration.trendSeconds)) },
            )}
          </Text>
          {/* Spec R10 — sans ce compte, l'utilisateur lit une médiane calculée sur moins de séances
              qu'il n'en a faites, sans explication. */}
          {duration.excludedCount > 0 ? (
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {t('progress.execution.duration.excluded', { count: duration.excludedCount })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {mix !== null ? (
        <View
          style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}
          accessible
          accessibilityLabel={[
            t('progress.execution.setTypes.title'),
            ...mix.map((s) => `${t(`workout.setType.${s.setType}`, s.setType)} ${s.percent} %`),
          ].join('. ')}
        >
          <Text style={[styles.cardTitle, { color: colors.textMuted }]}>
            {t('progress.execution.setTypes.title')}
          </Text>
          {mix.map((share) => (
            <View key={share.setType} style={styles.shareRow}>
              <Text style={[styles.shareLabel, { color: colors.text }]}>
                {/* Repli sur la valeur brute : un `set_type` ajouté en base après ce code doit
                    rester visible plutôt que d'afficher une clé i18n manquante. */}
                {t(`workout.setType.${share.setType}`, share.setType)}
              </Text>
              <Text style={[styles.sharePercent, { color: colors.textMuted }]}>
                {share.percent} %
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {showNeglected ? (
        <View
          style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}
          accessible
          accessibilityLabel={[
            t('progress.execution.neglected.title'),
            ...neglected.map((e) =>
              t('progress.execution.neglected.item', { name: e.name, count: e.weeksSince }),
            ),
          ].join('. ')}
        >
          <Text style={[styles.cardTitle, { color: colors.textMuted }]}>
            {t('progress.execution.neglected.title')}
          </Text>
          {neglected.map((exercise) => (
            <View key={exercise.exerciseId} style={styles.shareRow}>
              <Text style={[styles.shareLabel, { color: colors.text }]}>{exercise.name}</Text>
              <Text style={[styles.sharePercent, { color: colors.textMuted }]}>
                {t('progress.execution.neglected.weeks', { count: exercise.weeksSince })}
              </Text>
            </View>
          ))}
          {/* « Parmi tes favoris » n'est pas un détail de formulation : c'est la portée exacte de
              l'analyse (spec R8), et sans ça l'utilisateur croirait qu'on juge tout son catalogue. */}
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {t('progress.execution.neglected.scope')}
          </Text>
        </View>
      ) : null}
    </CollapsibleCard>
  );
}

const styles = StyleSheet.create({
  // Aucune hauteur fixe nulle part : tout grandit avec la police système (recette à 1,5×).
  card: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10, gap: 3 },
  cardTitle: { fontFamily: fontFamily.bodyBold, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.6 },
  metricRow: { flexDirection: 'row', gap: 18, marginTop: 2 },
  metric: { flex: 1, gap: 1 },
  metricLabel: { fontFamily: fontFamily.bodyBold, fontSize: 11 },
  value: { fontFamily: fontFamily.bodyBold, fontSize: 24, lineHeight: 29 },
  meta: { fontFamily: fontFamily.body, fontSize: 11.5, lineHeight: 16 },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  shareLabel: { fontFamily: fontFamily.body, fontSize: 13, flexShrink: 1 },
  sharePercent: { fontFamily: fontFamily.bodyBold, fontSize: 12, marginLeft: 'auto' },
});
