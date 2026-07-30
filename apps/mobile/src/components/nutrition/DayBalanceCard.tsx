/**
 * Carte héros « Bilan du jour » du journal alimentaire — refonte Nutrition (30/07/2026).
 *
 * Remplace le bloc plat de chiffres qui ouvrait l'onglet. Reprend la **variante « anneau »** de
 * la maquette `design/FitTrio - Nutrition.dc.html` : anneau calorique, restant au centre, détail
 * Consommé / Objectif / Restant à droite, badge de bonus séance en pied.
 *
 * > La maquette proposait deux variantes (anneau vs chiffres géants). L'anneau est retenu :
 * > c'est la forme déjà employée par le widget `NutritionSummaryCard` du dashboard et par le
 * > timer de repos — garder deux représentations du même chiffre dans une seule app aurait
 * > coûté en cohérence ce que la variante « chiffres » gagnait en impact.
 *
 * Le dépassement n'est pas traité comme une faute : l'anneau se remplit, la couleur passe à
 * `danger` et le libellé bascule sur « au-delà ». Aucune alerte, aucun rouge plein écran.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AccentHalo } from '@/components/AccentHalo';
import { Button } from '@/components/Button';
import { RingGauge } from '@/components/widgets/primitives';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

/** Espace un nombre par milliers dans la langue courante (1480 → « 1 480 »). */
const fmt = (n: number, lang: string) => new Intl.NumberFormat(lang).format(n);

export function DayBalanceCard({
  consumed,
  target,
  trainingBonus,
  bonusSource,
  isTrainingDay,
  onSetTarget,
}: {
  /** Calories consommées sur le jour affiché. */
  consumed: number;
  /** Objectif **effectif** du jour (bonus séance inclus), ou `null` si le profil est incomplet. */
  target: number | null;
  /** Bonus calorique du jour (séance ou course), déjà compris dans `target`. */
  trainingBonus: number;
  /** Origine du bonus — pilote le libellé du badge (`forfait` = jour de séance au forfait). */
  bonusSource: 'run' | 'forfait' | 'none';
  /** Vrai si un bonus s'applique au jour affiché et que le chargement est terminé. */
  isTrainingDay: boolean;
  /** Ouvre le profil nutritionnel — proposé quand aucun objectif n'est calculable. */
  onSetTarget: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const lang = i18n.language;

  const remaining = target != null ? target - consumed : null;
  const over = remaining != null && remaining < 0;
  const pct = target != null && target > 0 ? consumed / target : 0;

  // Sur `panel`, l'accent terracotta standard manque de contraste : on prend `panelAccent`.
  // Le vert de succès, lui, passe déjà sur ce fond sombre.
  const ringColor = over ? colors.danger : colors.accent;
  const remainingColor = over ? colors.danger : colors.success;

  return (
    <View style={[styles.card, { backgroundColor: colors.panel }]}>
      <AccentHalo />

      <Text style={[styles.eyebrow, { color: colors.panelAccent }]}>{t('journal.balance.title')}</Text>

      {target == null ? (
        // Profil incomplet : pas d'objectif calculable, donc pas d'anneau à remplir. On montre
        // le consommé seul et on ouvre la porte du réglage plutôt que d'afficher un anneau vide.
        <View style={styles.noTarget}>
          <View style={styles.bigRow}>
            <Text style={[styles.bigValue, { color: colors.panelText }]}>{fmt(consumed, lang)}</Text>
            <Text style={[styles.bigUnit, { color: colors.panelMuted }]}>{t('nutrition.kcal')}</Text>
          </View>
          <Text style={[styles.noTargetHint, { color: colors.panelMuted }]}>
            {t('journal.balance.noTargetHint')}
          </Text>
          <Button label={t('journal.setTarget')} onPress={onSetTarget} />
        </View>
      ) : (
        <View style={styles.body}>
          <RingGauge
            size={132}
            stroke={12}
            pct={pct}
            color={ringColor}
            trackColor="rgba(255,255,255,0.12)"
          >
            <View
              style={styles.ringCenter}
              accessible
              accessibilityLabel={t(over ? 'journal.balance.a11yOver' : 'journal.balance.a11yRemaining', {
                kcal: Math.abs(remaining ?? 0),
                target,
              })}
            >
              <Text style={[styles.ringValue, { color: colors.panelText }]}>
                {fmt(Math.abs(remaining ?? 0), lang)}
              </Text>
              <Text style={[styles.ringLabel, { color: remainingColor }]}>
                {t(over ? 'journal.balance.kcalOver' : 'journal.balance.kcalRemaining')}
              </Text>
            </View>
          </RingGauge>

          <View style={styles.breakdown}>
            <Row
              label={t('journal.balance.consumed')}
              value={fmt(consumed, lang)}
              valueColor={colors.panelText}
            />
            <Row
              label={t('journal.balance.target')}
              value={fmt(target, lang)}
              valueColor={colors.panelText}
            />
            <Row
              label={t('journal.balance.remaining')}
              value={`${over ? '+' : ''}${fmt(Math.abs(remaining ?? 0), lang)}`}
              valueColor={remainingColor}
              last
            />
          </View>
        </View>
      )}

      {isTrainingDay ? (
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Text style={[styles.badgeLabel, { color: colors.accentText }]}>
            {t(bonusSource === 'run' ? 'journal.runDayBadge' : 'journal.trainingDayBadge', {
              kcal: trainingBonus,
            })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Une ligne du détail à droite de l'anneau. */
function Row({
  label,
  value,
  valueColor,
  last,
}: {
  label: string;
  value: string;
  valueColor: string;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, last ? null : styles.rowDivider]}>
      <Text style={[styles.rowLabel, { color: colors.panelMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 20, paddingTop: 22, overflow: 'hidden', gap: 14 },
  eyebrow: { fontFamily: fontFamily.monoBold, fontSize: 11, letterSpacing: 0.8 },
  body: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  // `RingGauge` centre déjà ses enfants en absolu — on ne repositionne pas, on aligne le texte.
  ringCenter: { alignItems: 'center' },
  ringValue: { fontFamily: fontFamily.displayXBold, fontSize: 34, letterSpacing: -1.5 },
  ringLabel: { fontFamily: fontFamily.monoBold, fontSize: 10, marginTop: 2 },
  breakdown: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 5 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.14)' },
  rowLabel: { fontFamily: fontFamily.body, fontSize: 13 },
  rowValue: { fontFamily: fontFamily.monoBold, fontSize: 15 },
  noTarget: { gap: 10 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  bigValue: { fontFamily: fontFamily.displayXBold, fontSize: 44, letterSpacing: -2 },
  bigUnit: { fontFamily: fontFamily.bodySemi, fontSize: 14 },
  noTargetHint: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13 },
  badgeLabel: { fontFamily: fontFamily.bodyBold, fontSize: 12.5 },
});
