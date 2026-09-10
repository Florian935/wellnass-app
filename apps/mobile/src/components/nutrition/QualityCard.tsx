/**
 * Repères de qualité de l'assiette (US NUTRI-UX01, R3.5 — catalogue NUTR-15).
 *
 * ── Le défaut corrigé ────────────────────────────────────────────────────────────────────────
 * Fibres, sucres et acides gras saturés sont **stockés et affichés** depuis le socle 4.33, mais
 * jamais rapportés à un repère. « Fibres 12 g » ne dit rien ; « 12 g sur 25-30 » dit tout. Même
 * traitement que les micronutriments, dont la grille rapporte déjà chaque valeur à sa VNR.
 *
 * Deux des trois repères sont **proportionnels à l'objectif du jour** (10 % de l'énergie, OMS) :
 * un plafond figé à 2 000 kcal signalerait à tort un sportif à 2 800 et laisserait passer une
 * sèche à 1 600. Le détail du calcul vit dans `diet-quality.ts`.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  qualityRatio,
  qualityStatus,
  qualityTargets,
  type QualityKey,
  type QualityStatus,
} from '@wellness/shared';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export type QualityValues = Record<QualityKey, number>;

export function QualityCard({
  values,
  targetKcal,
  compact = false,
}: {
  values: QualityValues;
  /** Objectif calorique du jour — sert de base aux plafonds proportionnels. */
  targetKcal: number | null;
  /** Variante resserrée pour le journal ; la version pleine vit dans l'écran Suivi. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const targets = qualityTargets(targetKcal);

  const colorFor = (status: QualityStatus) =>
    status === 'over' ? colors.danger : status === 'under' ? colors.amber : colors.chartGreen;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>{t('quality.title')}</Text>
        {!compact ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('quality.subtitle')}</Text>
        ) : null}
      </View>

      <View style={styles.rows}>
        {targets.map((target) => {
          const value = Math.round(values[target.key] ?? 0);
          const status = qualityStatus(target, value);
          const ratio = qualityRatio(target, value);
          const color = colorFor(status);
          const rangeLabel =
            target.kind === 'range'
              ? t('quality.range', { min: target.minG ?? 0, max: target.maxG })
              : t('quality.cap', { max: target.maxG });

          return (
            <View
              key={target.key}
              accessible
              accessibilityLabel={`${t(`quality.keys.${target.key}`)} ${value} g, ${rangeLabel}`}
            >
              <View style={styles.rowHead}>
                <Text style={[styles.label, { color: colors.text }]}>
                  {t(`quality.keys.${target.key}`)}
                </Text>
                <Text style={[styles.value, { color }]}>
                  {value} g <Text style={[styles.ref, { color: colors.textMuted }]}>{rangeLabel}</Text>
                </Text>
              </View>
              <View style={[styles.track, { backgroundColor: colors.track }]}>
                <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
                {/* Repère de la borne basse d'une plage : « atteindre 25 g » se voit, alors qu'une
                    barre seule ne dit pas où commence le suffisant. */}
                {target.kind === 'range' && target.minG != null && target.maxG > 0 ? (
                  <View
                    style={[
                      styles.marker,
                      {
                        left: `${Math.min(100, (target.minG / target.maxG) * 100)}%`,
                        backgroundColor: colors.success,
                      },
                    ]}
                  />
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 14 },
  head: { gap: 2 },
  title: { fontFamily: fontFamily.bodyBold, fontSize: 13.5 },
  subtitle: { fontFamily: fontFamily.body, fontSize: 12 },
  rows: { gap: 13 },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 10,
  },
  label: { fontFamily: fontFamily.body, fontSize: 13, flexShrink: 1 },
  value: { fontFamily: fontFamily.monoBold, fontSize: 12.5 },
  ref: { fontFamily: fontFamily.mono, fontSize: 11.5 },
  track: { height: 8, borderRadius: 5, overflow: 'hidden', position: 'relative' },
  fill: { height: '100%', borderRadius: 5 },
  marker: { position: 'absolute', top: 0, bottom: 0, width: 2 },
});
