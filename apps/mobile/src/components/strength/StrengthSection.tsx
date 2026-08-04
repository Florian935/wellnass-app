import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  dotsScore,
  projectSbd,
  SBD_MAX_PROJECTION_WEEKS,
} from '@wellness/shared';
import { CollapsibleCard } from '@/components/CollapsibleCard';
import { useStrengthSection } from '@/data/repositories/strength-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Section « Force » de l'écran Progression (US MUSCPWR-01 — catalogue MUSC-16 / MUSC-27 / MUSC-29).
 *
 * **Tier 1 conditionnel** (ADR-007, décision D4) : une **seule** section, **repliée par défaut**, et
 * qui rend `null` dès qu'aucune de ses trois analyses n'est calculable. Ce module sert une minorité
 * (pratiquants de force) — il ne doit rien coûter à quelqu'un qui fait du renforcement général, et
 * l'écran Progression compte déjà cinq sections.
 *
 * Rien n'est stocké : tout est dérivé à l'affichage (règle R13).
 */
export function StrengthSection() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { lifts, oneRmByLift, total, history, bodyweight, sex, isLoading } =
    useStrengthSection(i18n.language);

  const designatedCount = lifts.filter((l) => l.exerciseId !== null).length;
  const dots = dotsScore(total.totalKg, bodyweight?.weightKg ?? null, sex);
  const projection = useMemo(
    () => projectSbd(history, SBD_MAX_PROJECTION_WEEKS),
    [history],
  );

  // Conditionnel par défaut : tant que rien n'est désigné et qu'aucun total n'existe, la section
  // n'existe pas. Pas de section vide, pas de « — », pas d'invitation permanente.
  if (isLoading || (designatedCount === 0 && total.totalKg === null)) return null;

  const summary =
    total.totalKg !== null
      ? t('strength.sbd.summary', { total: Math.round(total.totalKg) })
      : t('strength.sbd.incomplete', { count: total.missing.length });

  return (
    <CollapsibleCard title={t('strength.section.title')} summary={summary}>
      {/* ── Score de force relative (MUSC-27) ─────────────────────────────── */}
      <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.textMuted }]}>
          {t('strength.dots.title')}
        </Text>
        {dots !== null && bodyweight ? (
          <>
            <Text style={[styles.value, { color: colors.text }]}>{dots.toFixed(1)}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {t('strength.dots.atBodyweight', {
                weight: bodyweight.weightKg,
                date: formatDay(bodyweight.logDate),
              })}
            </Text>
          </>
        ) : (
          <Missing
            // R6 : sans sexe, le DOTS n'est pas calculable — les coefficients diffèrent et il
            // n'existe pas de valeur neutre. On le dit, avec le chemin pour y remédier.
            message={
              sex === 'unspecified'
                ? t('strength.dots.missingSex')
                : bodyweight === null
                  ? t('strength.dots.missingWeight')
                  : t('strength.dots.missingTotal')
            }
            actionLabel={sex === 'unspecified' ? t('strength.dots.completeProfile') : undefined}
            onAction={sex === 'unspecified' ? () => router.push('/profile') : undefined}
          />
        )}
      </View>

      {/* ── Total SBD (MUSC-29) ───────────────────────────────────────────── */}
      <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.textMuted }]}>
          {t('strength.sbd.title')}
        </Text>

        {lifts.map((lift) => (
          <View key={lift.lift} style={[styles.liftRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.liftName, { color: colors.text }]}>
              {lift.name ?? t(`strength.sbd.lifts.${lift.lift}`)}
            </Text>
            {lift.archived ? (
              <Text style={[styles.liftMissing, { color: colors.warnText }]}>
                {t('strength.sbd.archived')}
              </Text>
            ) : lift.exerciseId === null ? (
              <Text style={[styles.liftMissing, { color: colors.warnText }]}>
                {t('strength.sbd.notDesignated')}
              </Text>
            ) : (
              <Text style={[styles.liftValue, { color: colors.text }]}>
                {oneRmByLift[lift.lift] === null
                  ? t('strength.sbd.noRecord')
                  : t('strength.sbd.oneRm', { value: formatKg(oneRmByLift[lift.lift]!) })}
              </Text>
            )}
          </View>
        ))}

        {total.totalKg !== null ? (
          <View style={[styles.totalRow, { borderTopColor: colors.borderStrong }]}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>
              {t('strength.sbd.total')}
            </Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>
              {t('strength.sbd.oneRm', { value: formatKg(total.totalKg) })}
            </Text>
          </View>
        ) : (
          // R11 : un total partiel n'est jamais présenté comme un total. On dit combien il manque.
          <Missing
            message={t('strength.sbd.missingLifts', { count: total.missing.length })}
            actionLabel={t('strength.sbd.designate')}
            onAction={() => router.push('/strength-lifts')}
          />
        )}
      </View>

      {/* ── Projection (MUSC-29) ──────────────────────────────────────────── */}
      {total.totalKg !== null && (
        <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.textMuted }]}>
            {t('strength.projection.title')}
          </Text>
          {projection.ok ? (
            <>
              <Text style={[styles.value, { color: colors.text }]}>
                {t('strength.projection.value', { value: Math.round(projection.projectedKg) })}
              </Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {t('strength.projection.atCurrentRate', {
                  weeks: projection.weeks,
                  rate: projection.slopePerWeek.toFixed(1),
                })}
              </Text>
              {/* R9 : jamais présenté comme un objectif. */}
              <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
                {t('strength.projection.disclaimer')}
              </Text>
            </>
          ) : (
            // R8 : le refus DIT ce qui manque — masquer sans expliquer se lit comme un bug.
            <Missing
              message={
                projection.reason === 'not-enough-points'
                  ? t('strength.projection.needPoints', { count: projection.pointsMissing })
                  : t('strength.projection.needDays', { count: projection.daysMissing })
              }
            />
          )}
        </View>
      )}

      <Pressable
        onPress={() => router.push('/strength-lifts')}
        accessibilityRole="button"
        accessibilityLabel={t('strength.sbd.designate')}
        style={styles.manage}
      >
        <Ionicons name="options-outline" size={16} color={colors.textMuted} />
        <Text style={[styles.manageLabel, { color: colors.textMuted }]}>
          {t('strength.sbd.designate')}
        </Text>
      </Pressable>
    </CollapsibleCard>
  );
}

/** Message d'indisponibilité, avec une action facultative — jamais un simple « — ». */
function Missing({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.missing, { backgroundColor: colors.warn, borderColor: colors.warnBorder }]}>
      <Text style={[styles.missingText, { color: colors.warnText }]}>{message}</Text>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Text style={[styles.missingAction, { color: colors.accent }]}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** `AAAA-MM-JJ` → `JJ/MM/AAAA`, sans dépendre de la locale système (convention projet). */
function formatDay(dayKey: string): string {
  const [y, m, d] = dayKey.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Une décimale au plus, et pas de « 195,0 kg » quand la valeur est ronde. */
function formatKg(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 11, padding: 11, marginBottom: 8 },
  cardTitle: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  value: { fontFamily: fontFamily.displayXBold, fontSize: 27, letterSpacing: -0.5 },
  meta: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17, marginTop: 3 },
  disclaimer: { fontFamily: fontFamily.body, fontSize: 11, lineHeight: 15, marginTop: 7, fontStyle: 'italic' },
  liftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  liftName: { fontFamily: fontFamily.body, fontSize: 13, flex: 1 },
  liftValue: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  liftMissing: { fontFamily: fontFamily.body, fontSize: 12, fontStyle: 'italic' },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 9,
    paddingTop: 9,
    borderTopWidth: 1.5,
  },
  totalLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  totalValue: { fontFamily: fontFamily.displayBold, fontSize: 20 },
  missing: { borderWidth: 1, borderRadius: 10, padding: 9, marginTop: 8, gap: 5 },
  missingText: { fontFamily: fontFamily.body, fontSize: 12.5, lineHeight: 17 },
  missingAction: { fontFamily: fontFamily.bodyBold, fontSize: 12.5, textDecorationLine: 'underline' },
  manage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  manageLabel: { fontFamily: fontFamily.bodySemi, fontSize: 12.5 },
});
