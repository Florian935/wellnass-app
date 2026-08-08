import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { CollapsibleCard } from '@/components/CollapsibleCard';
import { useTrainingNutritionCross } from '@/data/repositories/dashboard-repository';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/**
 * Section « Manges-tu comme tu t'entraînes ? » de l'écran Nutrition (US APPORT-01).
 *
 * ── Conditionnelle et repliée, comme les deux lots précédents ────────────────────────────────────
 * Rend `null` quand ses quatre analyses se taisent : **un compte neuf ne voit rien de plus qu'avant**.
 * Patron de `StrengthSection` (MUSCPWR-01), `ExecutionSection` (EXEC-01) et `PolarisationSection`
 * (ALLURE-01) — et pour la même raison, désormais établie trois fois : la place d'affichage est une
 * ressource rare, et une section vide en consomme sans rien rendre.
 *
 * ── On met côte à côte, on ne conclut pas ───────────────────────────────────────────────────────
 * Aucune de ces cartes ne commente. Un écart négatif n'est pas reproché, un taux d'adhérence bas
 * n'est pas expliqué. Le lot **rapproche deux chiffres** — il ne dit jamais que l'un cause l'autre,
 * parce qu'il n'y a ni contrôle ni puissance statistique pour le soutenir.
 */
export function CrossTrainingSection() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { energy, adherence, lowFuelDays, protein, isLoading } = useTrainingNutritionCross();

  if (isLoading) return null;
  if (energy === null && adherence === null && lowFuelDays.length === 0 && protein === null) {
    return null;
  }

  /** Écart signé, arrondi et formaté **avant** `t()` — i18next n'a aucun formatage par défaut. */
  const signed = (kcal: number) => `${kcal > 0 ? '+' : ''}${Math.round(kcal)}`;

  return (
    <CollapsibleCard
      title={t('nutrition.crossTraining.title')}
      summary={t('nutrition.crossTraining.subtitle')}
    >
      {energy !== null ? (
        <View
          style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}
          accessible
          accessibilityLabel={[
            t('nutrition.crossTraining.energy.title'),
            `${t('nutrition.crossTraining.energy.trainingDay')} ${energy.trainingAvgKcal}`,
            `${t('nutrition.crossTraining.energy.restDay')} ${energy.restAvgKcal}`,
            t('nutrition.crossTraining.energy.delta', { kcal: signed(energy.deltaKcal) }),
            t('nutrition.crossTraining.energy.basis', {
              training: energy.trainingDays,
              rest: energy.restDays,
            }),
          ].join('. ')}
        >
          <Text style={[styles.cardTitle, { color: colors.textMuted }]}>
            {t('nutrition.crossTraining.energy.title')}
          </Text>
          <View style={styles.pair}>
            <View style={styles.stat}>
              <Text style={[styles.label, { color: colors.textMuted }]}>
                {t('nutrition.crossTraining.energy.trainingDay')}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>{energy.trainingAvgKcal}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.label, { color: colors.textMuted }]}>
                {t('nutrition.crossTraining.energy.restDay')}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>{energy.restAvgKcal}</Text>
            </View>
          </View>
          {/* 🔴 La couleur suit le SENS, pas le signe — et surtout elle ne juge pas : manger moins
              les jours de séance est un fait, pas une faute. Un ton neutre pour l'écart nul. */}
          <Text
            style={[
              styles.delta,
              { color: energy.deltaKcal === 0 ? colors.textMuted : colors.text },
            ]}
          >
            {t('nutrition.crossTraining.energy.delta', { kcal: signed(energy.deltaKcal) })}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {t('nutrition.crossTraining.energy.basis', {
              training: energy.trainingDays,
              rest: energy.restDays,
            })}
          </Text>
        </View>
      ) : null}

      {adherence !== null ? (
        <View
          style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}
          accessible
          accessibilityLabel={[
            t('nutrition.crossTraining.adherence.title'),
            `${t('nutrition.crossTraining.adherence.trainingDay')} ${adherence.trainingPct} %`,
            `${t('nutrition.crossTraining.adherence.restDay')} ${adherence.restPct} %`,
            t('nutrition.crossTraining.adherence.margin', { pct: adherence.marginPct }),
          ].join('. ')}
        >
          <Text style={[styles.cardTitle, { color: colors.textMuted }]}>
            {t('nutrition.crossTraining.adherence.title')}
          </Text>
          <View style={styles.pair}>
            <View style={styles.stat}>
              <Text style={[styles.label, { color: colors.textMuted }]}>
                {t('nutrition.crossTraining.adherence.trainingDay')}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>{adherence.trainingPct} %</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.label, { color: colors.textMuted }]}>
                {t('nutrition.crossTraining.adherence.restDay')}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>{adherence.restPct} %</Text>
            </View>
          </View>
          {/* Spec D2 — la marge affichée est CELLE DE L'UTILISATEUR. Sans cette ligne, deux taux
              d'adhérence différents dans l'app resteraient inexplicables. */}
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {t('nutrition.crossTraining.adherence.margin', { pct: adherence.marginPct })}
          </Text>
        </View>
      ) : null}

      {lowFuelDays.length > 0 ? (
        <View
          style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}
          accessible
          accessibilityLabel={[
            t('nutrition.crossTraining.lowFuel.title'),
            t('nutrition.crossTraining.lowFuel.count', { count: lowFuelDays.length }),
          ].join('. ')}
        >
          <Text style={[styles.cardTitle, { color: colors.textMuted }]}>
            {t('nutrition.crossTraining.lowFuel.title')}
          </Text>
          <Text style={[styles.value, { color: colors.warnText ?? colors.text }]}>
            {t('nutrition.crossTraining.lowFuel.count', { count: lowFuelDays.length })}
          </Text>
          {lowFuelDays.slice(0, 3).map((d) => (
            <Text key={d.dayKey} style={[styles.meta, { color: colors.textMuted }]}>
              {t('nutrition.crossTraining.lowFuel.detail', {
                day: d.dayKey,
                volume: Math.round(d.strengthVolume),
                kcal: Math.round(d.kcal),
                target: Math.round(d.effectiveTarget),
              })}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.textMuted }]}>
          {t('nutrition.crossTraining.protein.title')}
        </Text>
        {protein !== null ? (
          <View
            accessible
            accessibilityLabel={[
              t('nutrition.crossTraining.protein.title'),
              ...protein.servings.map((s) => `${s.mealKey} ${s.proteinG} g`),
              t('nutrition.crossTraining.protein.servings', {
                count: protein.servingsAtReference,
                grams: protein.referenceG,
              }),
            ].join('. ')}
          >
            {protein.servings.map((s) => (
              <View key={s.mealKey} style={styles.mealRow}>
                <Text style={[styles.mealLabel, { color: colors.text }]}>
                  {s.label ?? t(`journal.meals.${s.mealKey}`, s.mealKey)}
                </Text>
                <Text
                  style={[
                    styles.mealG,
                    { color: s.reachesReference ? colors.success : colors.textMuted },
                  ]}
                >
                  {s.proteinG} g
                </Text>
              </View>
            ))}
            {/* Spec R6/R7 — c'est le NOMBRE DE PRISES qui porte l'information : « 130 g » ne
                distingue pas un dîner unique de quatre prises. Et le repère est nommé, pas prescrit. */}
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {t('nutrition.crossTraining.protein.servings', {
                count: protein.servingsAtReference,
                grams: protein.referenceG,
              })}
            </Text>
          </View>
        ) : (
          /* Spec D4 — sans pesée, les g/kg n'existent pas et AUCUNE valeur neutre ne les remplace :
             prendre 70 kg par défaut produirait une répartition fausse et parfaitement crédible. La
             carte reste et dit quoi faire, comme la carte des zones d'ALLURE-01. */
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('nutrition.crossTraining.protein.needsWeight')}
            onPress={() => router.push('/measurements')}
            style={styles.needsRow}
          >
            <Text style={[styles.needs, { color: colors.textMuted }]}>
              {t('nutrition.crossTraining.protein.needsWeight')}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
    </CollapsibleCard>
  );
}

const styles = StyleSheet.create({
  // Aucune hauteur fixe : tout grandit avec la police système (recette à 1,5×).
  card: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10, gap: 3 },
  cardTitle: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  pair: { flexDirection: 'row', gap: 16, marginTop: 2 },
  stat: { flex: 1, gap: 1 },
  label: { fontFamily: fontFamily.bodyBold, fontSize: 11 },
  value: { fontFamily: fontFamily.bodyBold, fontSize: 22, lineHeight: 27 },
  delta: { fontFamily: fontFamily.bodyBold, fontSize: 13, marginTop: 5 },
  meta: { fontFamily: fontFamily.body, fontSize: 11.5, lineHeight: 16 },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  mealLabel: { fontFamily: fontFamily.body, fontSize: 13, flexShrink: 1 },
  mealG: { fontFamily: fontFamily.bodyBold, fontSize: 12, marginLeft: 'auto' },
  needsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  needs: { fontFamily: fontFamily.body, fontSize: 12.5, fontStyle: 'italic', flexShrink: 1 },
});
