/**
 * Grille des micronutriments suivis, **à couverture** — refonte Nutrition (30/07/2026).
 *
 * Avant : une liste de lignes « libellé — valeur unité ». Un chiffre nu (« fer 8,4 mg ») ne dit
 * rien à qui ne connaît pas la référence ; la grille le rapporte donc à la **VNR européenne**
 * (`micronutrientCoverage`) et le rend lisible en un mini-anneau + un pourcentage.
 *
 * Code couleur sobre, seuils de la maquette : vert ≥ 70 %, ambre 45–69 %, terracotta < 45 %.
 * La couleur **ne porte pas seule l'information** (WCAG 1.4.1) : le pourcentage est écrit au
 * centre de chaque anneau et l'anneau lui-même est un second canal.
 *
 * Les clés sans VNR — sodium, lipides détaillés — sont affichées **sans anneau** : ce sont des
 * plafonds, pas des cibles, et un « 95 % couverts » y serait un contresens
 * (voir `MICRONUTRIENT_NRV` dans `@wellness/shared`).
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  coverageLevel,
  micronutrientCoverage,
  type MicronutrientKey,
} from '@wellness/shared';
import { RingGauge } from '@/components/widgets/primitives';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';

export type MicroCell = {
  /** Clé du panel, ou `salt` pour le sel dérivé du sodium (pas de VNR → pas d'anneau). */
  key: MicronutrientKey | 'salt';
  label: string;
  /** Valeur déjà formatée dans la langue courante (« 8,4 »). */
  value: string;
  unit: string;
  /** Apport brut, pour le calcul de couverture. `null` pour le sel. */
  amount: number | null;
};

export function MicroCoverageGrid({ cells }: { cells: MicroCell[] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  if (cells.length === 0) return null;

  const colorOf = { high: colors.chartGreen, mid: colors.amber, low: colors.accent } as const;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.textMuted }]}>{t('journal.micros.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('journal.micros.subtitle')}</Text>
      </View>

      <View style={styles.grid}>
        {cells.map((cell) => {
          const pct =
            cell.key === 'salt' || cell.amount == null
              ? null
              : micronutrientCoverage(cell.key, cell.amount);
          const color = pct == null ? colors.textMuted : colorOf[coverageLevel(pct)];

          return (
            <View
              key={cell.key}
              style={[styles.cell, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessible
              accessibilityLabel={
                pct == null
                  ? `${cell.label} ${cell.value} ${cell.unit}`
                  : t('journal.micros.a11yCell', {
                      label: cell.label,
                      value: cell.value,
                      unit: cell.unit,
                      pct,
                    })
              }
            >
              {pct == null ? (
                // Pas de référence : une pastille neutre tient la colonne, sans suggérer un score.
                <View style={[styles.noRing, { borderColor: colors.border }]}>
                  <Text style={[styles.noRingMark, { color: colors.textMuted }]}>—</Text>
                </View>
              ) : (
                <RingGauge size={34} stroke={4} pct={pct / 100} color={color}>
                  <Text style={[styles.pct, { color }]}>{Math.min(999, pct)}</Text>
                </RingGauge>
              )}

              <View style={styles.cellText}>
                <Text style={[styles.cellLabel, { color: colors.text }]} numberOfLines={1}>
                  {cell.label}
                </Text>
                <Text style={[styles.cellValue, { color: colors.textMuted }]} numberOfLines={1}>
                  {cell.value} {cell.unit}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  title: { fontFamily: fontFamily.monoBold, fontSize: 11, letterSpacing: 0.8 },
  subtitle: { fontFamily: fontFamily.body, fontSize: 11.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Deux colonnes : `48%` + `gap: 8` laisse la place au retour à la ligne sans calcul de largeur.
  cell: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  pct: { fontFamily: fontFamily.monoBold, fontSize: 9 },
  noRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noRingMark: { fontFamily: fontFamily.monoBold, fontSize: 10 },
  cellText: { flex: 1, minWidth: 0 },
  cellLabel: { fontFamily: fontFamily.bodySemi, fontSize: 13 },
  cellValue: { fontFamily: fontFamily.monoBold, fontSize: 11 },
});
